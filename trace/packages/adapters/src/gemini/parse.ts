/**
 * Gemini CLI adapter. Gemini keeps its logs under ~/.gemini/tmp/<hash>/, and the
 * shape changed across generations — probed here at parse time:
 *
 *   a. one JSON array:  [ { sessionId, messageId, type: 'user'|'info'|…, message, timestamp } ]
 *   b. legacy document: { sessionId, startTime, lastUpdated, kind,
 *                         messages: [ { id, type, content, timestamp, … } ] }
 *   c. JSONL: metadata on the first line, one message per line after it;
 *      {"$set":{…}} updates the metadata, {"$rewindTo":…} is skipped.
 *
 * 'user' and 'gemini' records render; 'info'/'warning'/'error' and anything
 * unknown are counted and noted. Bodies are the `message` field (a) or `content`
 * (b/c), a string or a [{type:'text',text}] parts list. The parser is pure: the
 * .project_root file some directories carry is not read, so the session has no cwd.
 */
import { sessionId, type AdapterCapabilities, type Iso, type Session, type ToolFamily, type Usage } from '@hub-trace/contract';
import { detectState, STALE_MS } from '../state.ts';
import { TurnBuilder, titleFallback } from '../turns.ts';
import { clean, oneLine, partsText, LIMITS } from '../text.ts';
import type { FinishOptions, LineParser, SourceFile } from '../types.ts';

export const GEMINI_KIND = 'gemini';
export const GEMINI_ADAPTER_VERSION = '0.1.0';
export const GEMINI_CAPABILITIES: AdapterCapabilities = {
  observe_only: true,
  control_lifecycle: { start: true, resume: true, fork: false, stop: false },
  steer_in_turn: { in_turn: false, next_turn: true, inbox_file: false },
  coordinate_team: { spawn_subagent: false, peer_message: false, task_board: false },
};

type J = Record<string, any>;

const iso = (v: unknown): Iso | undefined => {
  if (typeof v !== 'string' || !v) return undefined;
  const ms = Date.parse(v);
  return Number.isFinite(ms) && ms > 0 ? new Date(ms).toISOString() : undefined;
};

export function toolFamily(name: string): ToolFamily {
  if (/shell|terminal|exec/.test(name)) return 'shell';
  if (/file|edit|replace|write|read|patch|directory/.test(name)) return 'patch';
  if (/search|fetch|web|url|browser/.test(name)) return 'web';
  if (/agent|task|subagent/.test(name)) return 'agent';
  if (/plan|todo/.test(name)) return 'plan';
  if (/image|photo|draw/.test(name)) return 'image';
  if (name.includes('__') || name.startsWith('mcp')) return 'mcp';
  return 'other';
}

/** thoughts: [{ subject, description }] → one "**subject**\ndescription" block per thought. */
function thoughtsOf(v: unknown): string {
  if (!Array.isArray(v)) return '';
  const out: string[] = [];
  for (const th of v) {
    if (!th || typeof th !== 'object') continue;
    const subject = typeof th.subject === 'string' ? th.subject : '';
    const description = typeof th.description === 'string' ? th.description : '';
    const block = (subject ? '**' + subject + '**\n' : '') + description;
    if (block.trim()) out.push(block);
  }
  return out.join('\n');
}

/** tokens: { input, output, cached, thoughts|reasoning } → contract usage. */
function addUsage(a: Usage, b: Usage): Usage {
  const out: Usage = { ...a };
  for (const k of ['input', 'cachedInput', 'cacheWrite', 'output', 'reasoning'] as const) {
    if (typeof b[k] === 'number') out[k] = (out[k] || 0) + b[k]!;
  }
  return out;
}

function usageOf(v: unknown): Usage | undefined {
  if (!v || typeof v !== 'object') return undefined;
  const t = v as J;
  const out: Usage = {};
  const put = (k: keyof Usage, x: unknown) => { if (typeof x === 'number' && Number.isFinite(x) && x >= 0) out[k] = x; };
  put('input', t.input);
  put('output', t.output);
  put('cachedInput', t.cached);
  put('reasoning', t.thoughts !== undefined ? t.thoughts : t.reasoning);
  return Object.keys(out).length ? out : undefined;
}

/** Shape c: metadata on the first line, {"$set":…} updates it, {"$rewindTo":…} skipped. */
function parseJsonl(text: string): { meta: J; records: J[]; skipped: number } {
  const meta: J = {};
  const records: J[] = [];
  let skipped = 0;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    let v: unknown;
    try { v = JSON.parse(line); } catch { skipped++; continue; }
    if (!v || typeof v !== 'object' || Array.isArray(v)) { skipped++; continue; }
    const o = v as J;
    if ('$set' in o) {
      if (o.$set && typeof o.$set === 'object' && !Array.isArray(o.$set)) Object.assign(meta, o.$set);
      else skipped++;
      continue;
    }
    if ('$rewindTo' in o) { skipped++; continue; }
    if (typeof o.type !== 'string') { Object.assign(meta, o); continue; }
    records.push(o);
  }
  return { meta, records, skipped };
}

/** Parse one logs file's text, whichever of the three shapes it turns out to be. */
export function parseGeminiLogs(text: string, file: SourceFile, opts: FinishOptions, projectRoot?: string): Session {
  const B = new TurnBuilder({ userStartsTurn: true, turnForInferred: false });
  let meta: J = {};
  let records: J[] = [];
  let skipped = 0;
  let usageSum: Usage | undefined;
  let lastModel: string | undefined;
  let format = 'gemini/logs-jsonl';
  let doc: unknown;
  let whole = false;
  try { doc = JSON.parse(text.trim()); whole = true; } catch { whole = false; }
  if (whole && Array.isArray(doc)) {
    format = 'gemini/logs-json';
    records = doc;
  } else if (whole && doc && typeof doc === 'object') {
    format = 'gemini/legacy-json';
    meta = doc as J;
    records = Array.isArray(meta.messages) ? meta.messages : (skipped++, []);
  } else if (!whole) {
    const jl = parseJsonl(text);
    meta = jl.meta;
    records = jl.records;
    skipped += jl.skipped;
  } else {
    skipped++;
  }

  let id = typeof meta.sessionId === 'string' && meta.sessionId ? meta.sessionId : '';
  let valid = 0;
  let lastStepAt: Iso | undefined; // time of the last rendered record: turns close here
  for (const r of records) {
    if (!r || typeof r !== 'object' || Array.isArray(r)) { skipped++; continue; }
    const at = iso(r.timestamp);
    B.stamp(at);
    const sid = typeof r.sessionId === 'string' && r.sessionId ? r.sessionId : undefined;
    if (!id && sid) id = sid;
    if (sid && sid !== id) { skipped++; B.note('multi-session:' + sid); continue; }
    const type = r.type;
    if (type === 'user') {
      const body = clean(partsText(r.message ?? r.content));
      if (!body) { skipped++; B.note('user-empty'); continue; }
      // Every user echo opens its own turn; the log has no turn markers.
      if (B.cur) B.closeTurn(B.cur, lastStepAt, 'completed');
      B.addMessage('user', body, at, typeof r.id === 'string' && r.id ? r.id : String(r.messageId ?? ''));
      if (at) lastStepAt = at;
      valid++;
    } else if (type === 'gemini') {
      const body = clean(partsText(r.content));
      const reasoning = clean(thoughtsOf(r.thoughts));
      const calls: J[] = Array.isArray(r.toolCalls) ? r.toolCalls : [];
      const usage = usageOf(r.tokens);
      if (!body && !reasoning && !calls.length && !usage) { skipped++; B.note('gemini-empty'); continue; }
      const m = B.ensureModel(at);
      if (typeof r.model === 'string' && r.model) {
        lastModel = r.model;
        m.model = r.model;
        B.settings = { ...B.settings, model: r.model };
        if (B.cur) B.cur.settings = { ...B.cur.settings, model: r.model };
      }
      if (reasoning) m.reasoning = m.reasoning ? m.reasoning + '\n\n' + reasoning : reasoning;
      if (body) m.text = m.text ? m.text + '\n\n' + body : body;
      if (usage) { m.usage = usage; usageSum = usageSum ? addUsage(usageSum, usage) : usage; }
      for (const tc of calls) {
        if (!tc || typeof tc !== 'object') { skipped++; continue; }
        const name = typeof tc.name === 'string' && tc.name ? tc.name : 'tool';
        const callId = typeof tc.id === 'string' && tc.id ? tc.id : undefined;
        const tool = B.addToolCall({
          callId,
          name,
          family: toolFamily(name),
          input: tc.args !== undefined ? JSON.stringify(tc.args) : undefined,
          at,
        });
        if (tc.result !== undefined && tc.result !== null) {
          const output = typeof tc.result === 'string' ? tc.result : JSON.stringify(tc.result);
          if (callId) B.addToolOutput({ callId, name, output, at, isError: tc.status === 'error' });
          else {
            tool.output = clean(output, LIMITS.io);
            tool.status = tc.status === 'error' ? 'error' : 'ok';
            B.closeTool(tool, at);
          }
        }
      }
      if (at) lastStepAt = at;
      valid++;
    } else if (type === 'info' || type === 'warning' || type === 'error') {
      skipped++;
      B.note('sys:' + type);
    } else {
      skipped++;
      B.note('type:' + String(type));
    }
  }
  // The log records no endings, so every turn still open is closed here.
  if (B.cur) B.closeTurn(B.cur, lastStepAt, 'completed');
  B.finishPending();
  const f = B.fold();

  if (!id) {
    const name = String(file.path || '').split(/[\\/]/).pop() || '';
    id = name.replace(/\.(json|jsonl)$/i, '');
  }
  // Shapes b/c carry their own times; the array only has the records' timestamps.
  const startedAt = (format === 'gemini/logs-json' ? undefined : iso(meta.startTime)) || B.firstAt;
  const updatedAt = (format === 'gemini/logs-json' ? undefined : iso(meta.lastUpdated)) || B.lastAt;
  const cwd = typeof projectRoot === 'string' && projectRoot.trim()
    ? projectRoot.trim()
    : typeof meta.cwd === 'string' && meta.cwd.trim() ? meta.cwd.trim() : undefined;
  const title = oneLine(f.firstUser, 80);
  const session: Session = {
    id: sessionId(GEMINI_KIND, id),
    sourceId: id,
    source: {
      kind: GEMINI_KIND,
      format,
      adapter: GEMINI_KIND + '@' + GEMINI_ADAPTER_VERSION,
      ...(file.path ? { path: file.path } : {}),
      ...(file.size !== undefined ? { size: file.size } : {}),
      ...(file.mtimeMs !== undefined ? { mtimeMs: file.mtimeMs } : {}),
    },
    title: title || titleFallback([f.firstUser], cwd, startedAt, 'Gemini CLI'),
    agent: {
      product: 'Gemini CLI',
      name: 'Gemini CLI',
      role: 'main',
      ...(lastModel ? { model: lastModel } : {}),
    },
    ...(cwd ? { cwd } : {}),
    ...(startedAt ? { startedAt } : {}),
    ...(updatedAt ? { updatedAt } : {}),
    links: [],
    turns: B.turns,
    ...(usageSum ? { usage: usageSum } : {}),
    capabilities: GEMINI_CAPABILITIES,
    state: { status: 'empty' },
    stats: {
      turns: B.turns.length,
      modelCalls: f.modelCalls,
      toolCalls: f.toolCalls,
      toolErrors: f.toolErrors,
      messages: f.messages,
      compactions: 0,
      subagents: 0,
      records: valid,
      skipped,
    },
    notes: B.notes(),
  };
  session.state = detectState(session, {
    now: opts.now,
    mtimeMs: file.mtimeMs,
    staleMs: opts.staleMs ?? STALE_MS,
    openTools: Array.from(B.openTools.values()),
  });
  return session;
}

/** Whole-file JSON or JSONL: every push() line accumulates, finish() parses once. */
export function createGeminiParser(file: SourceFile): LineParser {
  const lines: string[] = [];
  return {
    push(line: string) { lines.push(line); },
    finish(opts: FinishOptions) {
      return parseGeminiLogs(lines.join('\n'), file, opts);
    },
  };
}
