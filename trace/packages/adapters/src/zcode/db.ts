/**
 * ZCode's full history lives in one SQLite store (~/.zcode/cli/db/db.sqlite) beside
 * the JSON exports: session/message/part tables whose `data` columns hold opencode-
 * shaped records ({role, time, modelId, tokens, finish} messages; text|reasoning|
 * tool|step-* parts). The store opens the database read-only and injects the query
 * surface (types.ts SqliteSource); this module only maps rows to the contract.
 * Subagent sessions (parent_id set) become subagent sessions with a parent link,
 * which the observatory draws as one org graph.
 */
import { sessionId, type Iso, type Session, type SessionLink, type Usage } from '@hub-trace/contract';
import { detectState, STALE_MS } from '../state.ts';
import { TurnBuilder, titleFallback } from '../turns.ts';
import { clean, oneLine } from '../text.ts';
import { toolFamily } from '../opencode/parse.ts';
import type { FinishOptions, SourceFile, SqliteSource } from '../types.ts';
import { ZCODE_ADAPTER_VERSION, ZCODE_KIND } from './parse.ts';

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

type MsgRow = { id: string; session_id: string; data: string };

/** Every session in the store: three table reads total, grouping in memory. */
export function parseZcodeDb(file: SourceFile, db: SqliteSource, opts: FinishOptions): Session[] {
  const sessions = db.all('SELECT id, parent_id, directory, title, task_type, summary_additions, summary_deletions, time_created, time_updated FROM session') as J[];
  const messages = db.all('SELECT id, session_id, data FROM message ORDER BY session_id, sequence') as MsgRow[];
  const parts = db.all('SELECT message_id, data FROM part ORDER BY message_id, sequence') as { message_id: string; data: string }[];

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
    out.push(zcodeSessionFromRows(s, msgsBySession.get(s.id) || [], partsByMessage, file, opts));
  }
  return out;
}

function zcodeSessionFromRows(
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
  let costUsd: number | undefined;
  let lastModel: string | undefined;
  let firstUser = '';

  for (const { id, data: m } of msgs) {
    records++;
    const at = iso(m.time?.created);
    const parts = partsByMessage.get(id) || [];
    if (m.role === 'user') {
      const texts: string[] = [];
      for (const p of parts) {
        records++;
        if (p.type === 'text' && typeof p.text === 'string') texts.push(p.text);
        else if (p.type && p.type !== 'step-start' && p.type !== 'step-finish') { skipped++; B.note('part:' + p.type); }
      }
      const text = texts.map((t) => clean(t)).filter(Boolean).join('\n').trim();
      if (text) {
        B.addMessage('user', text, at, id);
        if (!firstUser) firstUser = oneLine(text, 80);
      }
      continue;
    }
    if (m.role !== 'assistant') { skipped++; B.note('role:' + String(m.role)); continue; }

    if (typeof m.modelId === 'string' && m.modelId) {
      lastModel = m.modelId;
      B.settings = { ...B.settings, model: m.modelId };
      if (B.cur) B.cur.settings = { ...B.cur.settings, model: m.modelId };
      if (B.model) B.model.model = m.modelId;
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
      } else if (p.type === 'tool' && typeof p.tool === 'string') {
        const input = p.state?.input !== undefined ? JSON.stringify(p.state.input) : undefined;
        B.addToolCall({ callId: p.callID, name: p.tool, family: toolFamily(p.tool), input, at: pat });
        const status = String(p.state?.status || '');
        if (status && status !== 'running' && status !== 'pending') {
          const output = typeof p.state?.output === 'string' ? p.state.output : p.state?.output !== undefined ? JSON.stringify(p.state.output) : p.state?.error || '';
          B.addToolOutput({ callId: p.callID, name: p.tool, output, at: iso(p.time?.end) || iso(m.time?.completed) || at, isError: status === 'error' });
        }
      } else if (p.type === 'step-finish') {
        const u = usageOf(p.tokens);
        if (u) { B.closeModel(iso(p.time?.end) || iso(m.time?.completed), u); usageSum = addUsage(usageSum, u); usageFromStep = true; }
      } else if (p.type === 'step-start' || p.type === 'timeline') {
        // structural markers, not content
      } else if (p.type) {
        skipped++; B.note('part:' + p.type);
      }
    }
    const mu = usageOf(m.tokens);
    if (mu && !usageFromStep) { B.closeModel(iso(m.time?.completed), mu); usageSum = addUsage(usageSum, mu); }
    else if (B.model) B.closeModel(iso(m.time?.completed));
    const endAt = iso(m.time?.completed) || at;
    if (m.finish === 'stop' && B.cur) B.closeTurn(B.cur, endAt, 'completed');
    else if (m.finish === 'error' && B.cur) B.closeTurn(B.cur, endAt, 'failed', '模型以 error 结束');
    if (Number.isFinite(+m.cost) && +m.cost > 0) costUsd = (costUsd || 0) + +m.cost;
    if (!parts.length) B.note('assistant-without-parts');
  }

  B.finishPending();
  const f = B.fold();
  const startedAt = iso(s.time_created);
  const updatedAt = iso(s.time_updated);
  const cwd = typeof s.directory === 'string' && s.directory ? s.directory : undefined;
  const isSub = typeof s.parent_id === 'string' && !!s.parent_id;
  const links: SessionLink[] = isSub ? [{ rel: 'parent', id: sessionId(ZCODE_KIND, s.parent_id) }] : [];
  const title = typeof s.title === 'string' && s.title.trim() ? oneLine(s.title, 80) : '';

  const session: Session = {
    id: sessionId(ZCODE_KIND, s.id),
    sourceId: s.id,
    source: {
      kind: ZCODE_KIND,
      format: 'zcode/sqlite',
      adapter: ZCODE_KIND + '@' + ZCODE_ADAPTER_VERSION,
      ...(file.path ? { path: file.path } : {}),
      ...(file.size !== undefined ? { size: file.size } : {}),
      ...(file.mtimeMs !== undefined ? { mtimeMs: file.mtimeMs } : {}),
    },
    title: title || titleFallback([firstUser || f.firstUser], cwd, startedAt, 'ZCode'),
    agent: {
      product: 'ZCode',
      name: 'ZCode',
      role: isSub ? 'subagent' : 'main',
      ...(lastModel ? { model: lastModel } : {}),
    },
    links,
    ...(cwd ? { cwd } : {}),
    ...(startedAt ? { startedAt } : {}),
    ...(updatedAt ? { updatedAt } : {}),
    turns: B.turns,
    ...(usageSum ? { usage: usageSum } : {}),
    state: { status: 'empty' },
    stats: {
      turns: B.turns.length,
      modelCalls: f.modelCalls,
      toolCalls: f.toolCalls,
      toolErrors: f.toolErrors,
      messages: f.messages,
      compactions: 0,
      subagents: 0,
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
    // The database file is always hot (the CLI writes it live); a session's own last
    // update is what its open turns should age against, not the file's mtime.
    mtimeMs: (s.time_updated as number | undefined) ?? file.mtimeMs,
    staleMs: opts.staleMs ?? STALE_MS,
    openTools: Array.from(B.openTools.values()),
  });
  return session;
}
