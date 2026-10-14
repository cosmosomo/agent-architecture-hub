/**
 * OpenCode adapter. OpenCode (sst/opencode) keeps sessions not in one JSONL but as
 * a tree of JSON files below ~/.local/share/opencode/storage:
 *
 *   session/<project>/ses_<id>.json     marker: title, directory, time, summary
 *   message/<sid>/msg_<id>.json         one message (role, model, tokens, cost)
 *   part/<msgid>/prt_<id>.json          its parts: text | reasoning | tool | step-start | step-finish
 *
 * This module is pure: the Node store finds the files and passes a Bundle whose
 * read() opens them; tests pass an in-memory map. A dropped marker file alone
 * degrades to a metadata-only session (createParser accumulates the JSON text).
 */
import { sessionId, type AdapterCapabilities, type Iso, type Session, type ToolFamily, type Usage } from '@hub-trace/contract';
import { detectState, STALE_MS } from '../state.ts';
import { TurnBuilder, titleFallback } from '../turns.ts';
import { clean, oneLine } from '../text.ts';
import type { Bundle, FinishOptions, LineParser, SourceFile } from '../types.ts';

export const OPENCODE_KIND = 'opencode';
export const OPENCODE_ADAPTER_VERSION = '0.1.1';

export const OPENCODE_CAPABILITIES: AdapterCapabilities = {
  observe_only: true,
  control_lifecycle: { start: true, resume: true, fork: true, stop: true },
  steer_in_turn: { in_turn: true, next_turn: true, inbox_file: true },
  coordinate_team: { spawn_subagent: true, peer_message: false, task_board: false },
};

type J = Record<string, any>;

const iso = (ms: unknown): Iso | undefined =>
  typeof ms === 'number' && Number.isFinite(ms) && ms > 0 ? new Date(ms).toISOString() : undefined;

function usageOf(t: J | undefined): Usage | undefined {
  if (!t || typeof t !== 'object') return undefined;
  const u: Usage = {};
  if (Number.isFinite(+t.input)) u.input = +t.input;
  if (Number.isFinite(+t.output)) u.output = +t.output;
  if (Number.isFinite(+t.reasoning)) u.reasoning = +t.reasoning;
  if (Number.isFinite(+t.cache?.read)) u.cachedInput = +t.cache.read;
  if (Number.isFinite(+t.cache?.write)) u.cacheWrite = +t.cache.write;
  return Object.keys(u).length ? u : undefined;
}

function addUsage(a: Usage | undefined, b: Usage | undefined): Usage | undefined {
  if (!b) return a;
  const out: Usage = { ...a };
  for (const k of ['input', 'cachedInput', 'cacheWrite', 'output', 'reasoning'] as const) {
    if (typeof b[k] === 'number') out[k] = (out[k] || 0) + b[k]!;
  }
  return out;
}

/** OpenCode tool names to the contract families (same coarse bins as the other adapters). */
export function toolFamily(name: string): ToolFamily {
  const n = name.toLowerCase();
  if (n === 'task' || n === 'agent' || n.includes('subagent')) return 'agent';
  if (['bash', 'shell', 'terminal', 'powershell', 'execute'].some((x) => n === x || n.startsWith(x + '_')) || n.startsWith('run_')) return 'shell';
  if (['edit', 'write', 'patch', 'apply_patch', 'str_replace', 'str_replace_editor', 'multiedit', 'create', 'delete', 'mkdir'].some((x) => n === x || n.startsWith(x))) return 'patch';
  if (['webfetch', 'web_search', 'web-search', 'fetch'].some((x) => n.startsWith(x))) return 'web';
  if (n.includes('mcp') || n.includes('__')) return 'mcp';
  if (n.startsWith('plan') || n === 'todo') return 'plan';
  return 'other';
}

function escRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function joinJson(a: unknown, b: unknown): string {
  if (typeof a === 'string' && typeof b === 'string') return a + '\n\n' + b;
  return (a as string) || (b as string);
}

/** Parse one session from its assembled files. */
export function parseOpencodeBundle(file: SourceFile, bundle: Bundle, opts: FinishOptions): Session {
  const B = new TurnBuilder({ userStartsTurn: true, turnForInferred: false });
  const records = { markers: 0, messages: 0, parts: 0 };
  let skipped = 0;

  let marker: J = {};
  try {
    marker = JSON.parse(bundle.read(file.path!));
    records.markers = 1;
  } catch {
    // A bundle without a readable marker still parses; ids come from file names.
    skipped++;
  }
  const sid: string = marker.id || file.path!.split(/[\\/]/).pop()!.replace(/\.json$/i, '');
  const startedAt = iso(marker.time?.created);
  const updatedAt = iso(marker.time?.updated);
  const cwd: string | undefined = typeof marker.directory === 'string' ? marker.directory : undefined;

  const readJsonSafe = (p: string): J | undefined => {
    try { return JSON.parse(bundle.read(p)); } catch { return undefined; }
  };
  const messageRe = new RegExp('[\\\\/]message[\\\\/]' + escRe(sid) + '[\\\\/]msg_[A-Za-z0-9]+\\.json$', 'i');
  // Sort by the record's created time (file names usually embed the clock too, but ids vary by provider).
  const messageFiles = bundle.files.filter((p) => messageRe.test(p)).map((p) => {
    const t = readJsonSafe(p)?.time?.created;
    return { p, t: typeof t === 'number' ? t : Number.POSITIVE_INFINITY };
  }).sort((a, b) => (a.t - b.t || (a.p < b.p ? -1 : 1))).map((x) => x.p);
  const partRe = (msgid: string) => new RegExp('[\\\\/]part[\\\\/]' + escRe(msgid) + '[\\\\/]prt_[A-Za-z0-9]+\\.json$', 'i');
  /** Parts of a message in time order (missing time sorts last-ish, file name breaks ties). */
  const partsOf = (msgid: string) => bundle.files.filter((p) => partRe(msgid).test(p)).map((p) => {
    const t = readJsonSafe(p)?.time?.start;
    return { p, t: typeof t === 'number' ? t : Number.POSITIVE_INFINITY };
  }).sort((a, b) => (a.t - b.t || (a.p < b.p ? -1 : 1))).map((x) => x.p);

  let usageSum: Usage | undefined;
  let costUsd: number | undefined;
  let lastModel: string | undefined;
  let firstUser = '';

  for (const mp of messageFiles) {
    const m = readJsonSafe(mp);
    if (!m) { skipped++; continue; }
    records.messages++;
    const msgId = String(m.id || mp.split(/[\\/]/).pop()!.replace(/\.json$/i, ''));
    const at = iso(m.time?.created);
    const parts = partsOf(msgId);

    if (m.role === 'user') {
      const texts: string[] = [];
      for (const pp of parts) {
        const p = readJsonSafe(pp);
        if (!p) { skipped++; continue; }
        records.parts++;
        if (p.type === 'text' && typeof p.text === 'string') texts.push(p.text);
        else if (p.type && p.type !== 'step-start' && p.type !== 'step-finish') { B.note('part:' + p.type); skipped++; }
      }
      const text = texts.map((t) => clean(t)).filter(Boolean).join('\n').trim();
      if (text) {
        B.addMessage('user', text, at, msgId);
        if (!firstUser) firstUser = oneLine(text, 80);
      }
      continue;
    }
    if (m.role !== 'assistant') { skipped++; continue; }

    if (typeof m.modelID === 'string') {
      lastModel = m.modelID;
      B.settings = { ...B.settings, model: m.modelID };
      // The open turn copied the settings when the user message opened it.
      if (B.cur) B.cur.settings = { ...B.cur.settings, model: m.modelID };
      if (B.model) B.model.model = m.modelID;
    }
    let sawStep = false;
    let usageFromStep = false;
    for (const pp of parts) {
      const p = readJsonSafe(pp);
      if (!p) { skipped++; continue; }
      records.parts++;
      const pat = iso(p.time?.start) || at;
      if (p.type === 'text' && typeof p.text === 'string' && p.text.trim()) {
        const model = B.ensureModel(pat);
        model.text = model.text ? joinJson(model.text, clean(p.text)) : clean(p.text);
      } else if (p.type === 'reasoning' && typeof p.text === 'string' && p.text.trim()) {
        const model = B.ensureModel(pat);
        model.reasoning = model.reasoning ? joinJson(model.reasoning, clean(p.text)) : clean(p.text);
      } else if (p.type === 'tool' && typeof p.tool === 'string') {
        sawStep = true;
        const input = p.state?.input !== undefined ? JSON.stringify(p.state.input) : undefined;
        const tool = B.addToolCall({ callId: p.callID, name: p.tool, family: toolFamily(p.tool), input, at: pat });
        const status = String(p.state?.status || '');
        if (status && status !== 'running' && status !== 'pending') {
          const output = typeof p.state?.output === 'string'
            ? p.state.output
            : p.state?.output !== undefined ? JSON.stringify(p.state.output) : p.state?.error || '';
          B.addToolOutput({ callId: p.callID, name: p.tool, output, at: iso(p.time?.end) || iso(m.time?.completed) || at, isError: status === 'error' });
          if (status === 'error') tool.status = 'error';
        }
      } else if (p.type === 'step-start') {
        sawStep = true;
      } else if (p.type === 'step-finish') {
        const u = usageOf(p.tokens);
        if (u) { B.closeModel(iso(p.time?.end) || iso(m.time?.completed), u); usageSum = addUsage(usageSum, u); usageFromStep = true; }
      } else if (p.type) {
        // text/reasoning/tool/step-start/step-finish are handled above; anything else is counted.
        B.note('part:' + p.type);
        skipped++;
      } else {
        skipped++;
      }
    }
    // Some writes roll tokens onto the message without any step-finish part.
    const mu = usageOf(m.tokens);
    if (mu && !usageFromStep) { B.closeModel(iso(m.time?.completed), mu); usageSum = addUsage(usageSum, mu); }
    else if (!mu || usageFromStep) { if (B.model) B.closeModel(iso(m.time?.completed)); }
    // finish says whether the agent yielded: 'stop' ends the turn, 'tool-calls' keeps it open,
    // 'error' failed it. Unknown values leave the turn running (state detection handles stale).
    const endAt = iso(m.time?.completed) || at;
    if (m.finish === 'stop' && B.cur) B.closeTurn(B.cur, endAt, 'completed');
    else if (m.finish === 'error' && B.cur) B.closeTurn(B.cur, endAt, 'failed', '模型以 error 结束');
    if (Number.isFinite(+m.cost) && +m.cost > 0) costUsd = (costUsd || 0) + +m.cost;
    if (!sawStep && !parts.length) B.note('assistant-without-parts');
  }

  B.finishPending();
  const f = B.fold();
  const markerTitle = typeof marker.title === 'string' ? oneLine(marker.title, 80) : '';
  const title = markerTitle
    ? markerTitle
    : titleFallback([firstUser || f.firstUser], cwd, startedAt, 'OpenCode');

  const session: Session = {
    id: sessionId(OPENCODE_KIND, sid),
    sourceId: sid,
    source: {
      kind: OPENCODE_KIND,
      format: 'opencode/json-dir',
      adapter: OPENCODE_KIND + '@' + OPENCODE_ADAPTER_VERSION,
      ...(marker.version ? { version: String(marker.version) } : {}),
      ...(file.path ? { path: file.path } : {}),
      ...(file.size !== undefined ? { size: file.size } : {}),
      ...(file.mtimeMs !== undefined ? { mtimeMs: file.mtimeMs } : {}),
    },
    title,
    agent: {
      product: 'OpenCode',
      name: 'OpenCode',
      role: 'main',
      ...(lastModel ? { model: lastModel } : {}),
    },
    ...(cwd ? { cwd } : {}),
    ...(startedAt ? { startedAt } : {}),
    ...(updatedAt ? { updatedAt } : {}),
    links: [],
    turns: B.turns,
    ...(usageSum ? { usage: usageSum } : {}),
    capabilities: OPENCODE_CAPABILITIES,
    state: { status: 'empty' },
    stats: {
      turns: B.turns.length,
      modelCalls: f.modelCalls,
      toolCalls: f.toolCalls,
      toolErrors: f.toolErrors,
      messages: f.messages,
      compactions: f.compactions,
      subagents: 0,
      ...(f.durationTotal ? { durationMs: f.durationTotal } : {}),
      ...(costUsd !== undefined ? { costUsd } : {}),
      ...(Number.isFinite(+marker.summary?.additions) ? { linesAdded: +marker.summary.additions } : {}),
      ...(Number.isFinite(+marker.summary?.deletions) ? { linesRemoved: +marker.summary.deletions } : {}),
      records: records.markers + records.messages + records.parts,
      skipped,
    },
    notes: B.notes(),
  };
  session.state = detectState(session, {
    now: opts.now,
    mtimeMs: file.mtimeMs ?? (marker.time?.updated as number | undefined),
    staleMs: opts.staleMs ?? STALE_MS,
    openTools: Array.from(B.openTools.values()),
  });
  return session;
}

/** A marker file parsed on its own (e.g. dropped into the viewer): metadata, no steps. */
export function createOpencodeParser(file: SourceFile): LineParser {
  const lines: string[] = [];
  return {
    push(line: string) { lines.push(line); },
    finish(opts: FinishOptions) {
      return parseOpencodeBundle(file, { files: file.path ? [file.path] : [], read: () => lines.join('\n') }, opts);
    },
  };
}
