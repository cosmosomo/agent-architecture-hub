/**
 * OpenCode v1.18+ stores full session history in SQLite (~/.local/share/opencode/opencode.db)
 * alongside legacy JSON storage: `session`, `message`, and `part` tables whose `data` columns
 * hold OpenCode message/part JSON objects. The store opens the database read-only and injects
 * the query surface (types.ts SqliteSource); this module maps rows to the contract.
 */
import { sessionId, type Iso, type Session, type SessionLink, type Usage } from '@hub-trace/contract';
import { detectState, STALE_MS } from '../state.ts';
import { TurnBuilder, titleFallback } from '../turns.ts';
import { clean, oneLine } from '../text.ts';
import type { FinishOptions, SourceFile, SqliteSource } from '../types.ts';
import { OPENCODE_ADAPTER_VERSION, OPENCODE_CAPABILITIES, OPENCODE_KIND, toolFamily } from './parse.ts';

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

function normalizeModel(raw: unknown): string | undefined {
  if (!raw) return undefined;
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return undefined;
    if (trimmed.startsWith('{')) {
      try {
        return normalizeModel(JSON.parse(trimmed));
      } catch {
        return trimmed;
      }
    }
    return trimmed;
  }
  if (typeof raw === 'object') {
    const obj = raw as J;
    const id = typeof obj.modelID === 'string' ? obj.modelID : typeof obj.id === 'string' ? obj.id : '';
    const provider = typeof obj.providerID === 'string' ? obj.providerID : '';
    if (id && provider) return `${provider}/${id}`;
    if (id) return id;
  }
  return undefined;
}

function normalizeCwd(dir: unknown): string | undefined {
  if (typeof dir !== 'string' || !dir.trim()) return undefined;
  const d = dir.trim();
  return /^[A-Za-z]:\//.test(d) ? d.replace(/\//g, '\\') : d;
}

type MsgRow = { id: string; session_id: string; data: string };

/** Every session in ~/.local/share/opencode/opencode.db (or only `opts.onlySourceIds`). */
export function parseOpencodeDb(file: SourceFile, db: SqliteSource, opts: FinishOptions): Session[] {
  const only = opts.onlySourceIds;
  if (only && only.size === 0) return [];
  const allSessions = db.all(
    'SELECT id, parent_id, directory, title, version, model, summary_additions, summary_deletions, time_created, time_updated, cost, tokens_input, tokens_output, tokens_reasoning, tokens_cache_read, tokens_cache_write FROM session',
  ) as J[];
  const sessions = only ? allSessions.filter((s) => s && typeof s.id === 'string' && only.has(s.id)) : allSessions;
  if (!sessions.length) return [];

  let messages: MsgRow[];
  let parts: { message_id: string; data: string }[];
  if (only && only.size <= 40) {
    const ids = Array.from(only);
    const ph = ids.map(() => '?').join(',');
    messages = db.all(
      `SELECT id, session_id, data FROM message WHERE session_id IN (${ph}) ORDER BY session_id, time_created, id`,
      ...ids,
    ) as MsgRow[];
    try {
      parts = db.all(
        `SELECT message_id, data FROM part WHERE session_id IN (${ph}) ORDER BY message_id, time_created, id`,
        ...ids,
      ) as { message_id: string; data: string }[];
    } catch {
      parts = db.all(
        `SELECT message_id, data FROM part WHERE message_id IN (SELECT id FROM message WHERE session_id IN (${ph})) ORDER BY message_id, time_created, id`,
        ...ids,
      ) as { message_id: string; data: string }[];
    }
  } else {
    messages = db.all('SELECT id, session_id, data FROM message ORDER BY session_id, time_created, id') as MsgRow[];
    parts = db.all('SELECT message_id, data FROM part ORDER BY message_id, time_created, id') as { message_id: string; data: string }[];
  }

  const partsByMessage = new Map<string, J[]>();
  for (const row of parts) {
    let p: J;
    try { p = JSON.parse(row.data); } catch { continue; }
    let list = partsByMessage.get(row.message_id);
    if (!list) { list = []; partsByMessage.set(row.message_id, list); }
    list.push(p);
  }
  const msgsBySession = new Map<string, { id: string; data: J }[]>();
  for (const row of messages) {
    let m: J;
    try { m = JSON.parse(row.data); } catch { continue; }
    let list = msgsBySession.get(row.session_id);
    if (!list) { list = []; msgsBySession.set(row.session_id, list); }
    list.push({ id: row.id, data: m });
  }

  const out: Session[] = [];
  for (const s of sessions) {
    if (!s || typeof s.id !== 'string' || !s.id) continue;
    out.push(opencodeSessionFromRows(s, msgsBySession.get(s.id) || [], partsByMessage, file, opts));
  }
  return out;
}

function opencodeSessionFromRows(
  s: J,
  msgs: { id: string; data: J }[],
  partsByMessage: Map<string, J[]>,
  file: SourceFile,
  opts: FinishOptions,
): Session {
  const B = new TurnBuilder({ userStartsTurn: true, turnForInferred: false });
  let skipped = 0;
  let records = 0;
  let usageSum: Usage | undefined;
  let costUsd: number | undefined = Number.isFinite(+s.cost) && +s.cost > 0 ? +s.cost : undefined;
  let lastModel: string | undefined = normalizeModel(s.model);
  let firstUser = '';

  for (const { id, data: m } of msgs) {
    records++;
    const at = iso(m.time?.created);
    const parts = partsByMessage.get(id) || [];
    const msgModel = normalizeModel(m.model) || normalizeModel(m.modelID) || normalizeModel(m.modelId);
    if (msgModel) lastModel = msgModel;

    if (m.role === 'user') {
      const texts: string[] = [];
      let hadCompaction = false;
      for (const p of parts) {
        records++;
        if (p.type === 'text' && typeof p.text === 'string') texts.push(p.text);
        else if (p.type === 'file') {
          const fname = typeof p.filename === 'string' && p.filename ? p.filename : typeof p.url === 'string' ? p.url.slice(0, 60) : 'file';
          texts.push('[附件: ' + fname + ']');
        } else if (p.type === 'compaction') {
          hadCompaction = true;
        } else if (p.type && p.type !== 'step-start' && p.type !== 'step-finish') {
          skipped++;
          B.note('part:' + p.type);
        }
      }
      const text = texts.map((t) => clean(t)).filter(Boolean).join('\n').trim();
      if (text) {
        B.addMessage('user', text, at, id);
        if (!firstUser) firstUser = oneLine(text, 80);
      }
      if (hadCompaction) B.addEvent('compaction', at, '上下文压缩');
      continue;
    }
    if (m.role !== 'assistant') {
      skipped++;
      B.note('role:' + String(m.role));
      continue;
    }

    if (lastModel) {
      B.settings = { ...B.settings, model: lastModel };
      if (B.cur) B.cur.settings = { ...B.cur.settings, model: lastModel };
      if (B.model) B.model.model = lastModel;
    }
    let usageFromStep = false;
    for (const p of parts) {
      records++;
      const pat = iso(p.time?.start) || at;
      if (p.type === 'text' && typeof p.text === 'string' && p.text.trim()) {
        const model = B.ensureModel(pat);
        model.text = model.text ? model.text + '\n\n' + clean(p.text) : clean(p.text);
      } else if (p.type === 'reasoning' && typeof p.text === 'string' && p.text.trim()) {
        const model = B.ensureModel(pat);
        model.reasoning = model.reasoning ? model.reasoning + '\n\n' + clean(p.text) : clean(p.text);
      } else if (p.type === 'file') {
        const fname = typeof p.filename === 'string' && p.filename ? p.filename : typeof p.url === 'string' ? p.url.slice(0, 60) : 'file';
        const model = B.ensureModel(pat);
        const tag = '[附件: ' + fname + ']';
        model.text = model.text ? model.text + '\n\n' + tag : tag;
      } else if (p.type === 'compaction') {
        B.addEvent('compaction', pat, '上下文压缩');
      } else if (p.type === 'tool' && typeof p.tool === 'string') {
        const input = p.state?.input !== undefined ? JSON.stringify(p.state.input) : undefined;
        const tool = B.addToolCall({ callId: p.callID, name: p.tool, family: toolFamily(p.tool), input, at: pat });
        const status = String(p.state?.status || '');
        if (status && status !== 'running' && status !== 'pending') {
          const output =
            typeof p.state?.output === 'string'
              ? p.state.output
              : p.state?.output !== undefined
                ? JSON.stringify(p.state.output)
                : p.state?.error || '';
          B.addToolOutput({
            callId: p.callID,
            name: p.tool,
            output,
            at: iso(p.time?.end) || iso(m.time?.completed) || at,
            isError: status === 'error',
          });
          if (status === 'error') tool.status = 'error';
        }
      } else if (p.type === 'step-finish') {
        const u = usageOf(p.tokens);
        if (u) {
          B.closeModel(iso(p.time?.end) || iso(m.time?.completed), u);
          usageSum = addUsage(usageSum, u);
          usageFromStep = true;
        }
      } else if (p.type === 'step-start' || p.type === 'timeline' || p.type === 'patch') {
        // structural markers
      } else if ((p.type === 'text' || p.type === 'reasoning') && !String(p.text || '').trim()) {
        // an empty text or reasoning part (the stream opened one and wrote nothing): nothing to show
      } else if (p.type) {
        skipped++;
        B.note('part:' + p.type);
      }
    }
    const mu = usageOf(m.tokens);
    if (mu && !usageFromStep) {
      B.closeModel(iso(m.time?.completed), mu);
      usageSum = addUsage(usageSum, mu);
    } else if (B.model) {
      B.closeModel(iso(m.time?.completed));
    }
    const endAt = iso(m.time?.completed) || at;
    if (m.finish === 'stop' && B.cur) B.closeTurn(B.cur, endAt, 'completed');
    else if (m.finish === 'error' && B.cur) B.closeTurn(B.cur, endAt, 'failed', '模型以 error 结束');
    if (Number.isFinite(+m.cost) && +m.cost > 0) costUsd = (costUsd || 0) + +m.cost;
    // A reply that failed before writing anything carries only its error (401, a used-up quota, an abort): show it
    // as an error or abort in the turn instead of dropping it (10-19, display regression).
    if (!parts.length && m.error && typeof m.error === 'object') {
      const msg = String(m.error.data?.message || m.error.name || 'error').slice(0, 400);
      const aborted = m.error.name === 'MessageAbortedError';
      B.addEvent(aborted ? 'aborted' : 'error', endAt, aborted ? msg : `${m.error.name || 'Error'}：${msg}`);
      if (B.cur) B.closeTurn(B.cur, endAt, aborted ? 'aborted' : 'failed', aborted ? undefined : msg);
    } else if (!parts.length) B.note('assistant-without-parts');
  }

  if (!usageSum) {
    usageSum = usageOf({
      input: s.tokens_input,
      output: s.tokens_output,
      reasoning: s.tokens_reasoning,
      cache: { read: s.tokens_cache_read, write: s.tokens_cache_write },
    });
  }

  B.finishPending();
  const f = B.fold();
  const startedAt = iso(s.time_created);
  const updatedAt = iso(s.time_updated);
  const cwd = normalizeCwd(s.directory);
  const isSub = typeof s.parent_id === 'string' && !!s.parent_id;
  const links: SessionLink[] = isSub ? [{ rel: 'parent', id: sessionId(OPENCODE_KIND, s.parent_id) }] : [];
  const title = typeof s.title === 'string' && s.title.trim() ? oneLine(s.title, 80) : '';

  const session: Session = {
    id: sessionId(OPENCODE_KIND, s.id),
    sourceId: s.id,
    source: {
      kind: OPENCODE_KIND,
      format: 'opencode/sqlite',
      adapter: OPENCODE_KIND + '@' + OPENCODE_ADAPTER_VERSION,
      ...(s.version ? { version: String(s.version) } : {}),
      ...(file.path ? { path: file.path } : {}),
      ...(file.size !== undefined ? { size: file.size } : {}),
      ...(file.mtimeMs !== undefined ? { mtimeMs: file.mtimeMs } : {}),
    },
    title: title || titleFallback([firstUser || f.firstUser], cwd, startedAt, 'OpenCode'),
    agent: {
      product: 'OpenCode',
      name: 'OpenCode',
      role: isSub ? 'subagent' : 'main',
      ...(lastModel ? { model: lastModel } : {}),
    },
    links,
    ...(cwd ? { cwd } : {}),
    ...(startedAt ? { startedAt } : {}),
    ...(updatedAt ? { updatedAt } : {}),
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
      subagents: links.filter((l) => l.rel === 'child').length,
      ...(f.durationTotal ? { durationMs: f.durationTotal } : {}),
      ...(costUsd !== undefined ? { costUsd } : {}),
      ...(Number.isFinite(+s.summary_additions) ? { linesAdded: +s.summary_additions } : {}),
      ...(Number.isFinite(+s.summary_deletions) ? { linesRemoved: +s.summary_deletions } : {}),
      records,
      skipped,
    },
    notes: B.notes(),
  };
  session.state = detectState(session, {
    now: opts.now,
    mtimeMs: (s.time_updated as number | undefined) ?? file.mtimeMs,
    staleMs: opts.staleMs ?? STALE_MS,
    openTools: Array.from(B.openTools.values()),
  });
  return session;
}
