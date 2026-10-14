/**
 * ZCode adapter. ZCode keeps one JSON file per task under
 * ~/.zcode/v2/sessions/<project-hash>/<taskId>.json:
 *
 *   { meta: { taskId, title, workspacePath, createdAt, updatedAt, status },
 *     messages: [ { role: 'user'|'assistant', content, timestamp (epoch ms), turnIndex } ] }
 *
 * The file is one JSON document (not JSONL): createParser accumulates the text and
 * finish() parses it whole. Messages carry a turnIndex, so turns come straight from
 * the source rather than from role transitions.
 */
import { sessionId, type AdapterCapabilities, type Iso, type Session } from '@hub-trace/contract';
import { detectState, STALE_MS } from '../state.ts';
import { TurnBuilder, titleFallback } from '../turns.ts';
import { clean, oneLine } from '../text.ts';
import type { FinishOptions, LineParser, SourceFile } from '../types.ts';

export const ZCODE_KIND = 'zcode';
export const ZCODE_ADAPTER_VERSION = '0.1.0';
export const ZCODE_CAPABILITIES: AdapterCapabilities = {
  observe_only: true,
  control_lifecycle: { start: true, resume: true, fork: false, stop: false },
  steer_in_turn: { in_turn: false, next_turn: true, inbox_file: true },
  coordinate_team: { spawn_subagent: true, peer_message: false, task_board: true },
};

type J = Record<string, any>;

const iso = (ms: unknown): Iso | undefined =>
  typeof ms === 'number' && Number.isFinite(ms) && ms > 0 ? new Date(ms).toISOString() : undefined;

/** Parse one task's JSON text. */
export function parseZcodeSession(text: string, file: SourceFile, opts: FinishOptions): Session {
  const B = new TurnBuilder({ userStartsTurn: true, turnForInferred: false });
  let doc: J | undefined;
  let skipped = 0;
  try {
    doc = JSON.parse(text);
  } catch {
    skipped++;
  }
  const meta: J = doc?.meta || {};
  const messages: J[] = Array.isArray(doc?.messages) ? doc.messages : (skipped++, []);

  const id: string = typeof meta.taskId === 'string' && meta.taskId
    ? meta.taskId
    : String(file.path || '').split(/[\\/]/).pop()!.replace(/\.json$/i, '');
  const startedAt = iso(meta.createdAt);
  const updatedAt = iso(meta.updatedAt) || iso(meta.updated_at);
  const cwd: string | undefined = typeof meta.workspacePath === 'string' && meta.workspacePath ? meta.workspacePath : undefined;
  let lastAt: Iso | undefined;

  // turnIndex groups messages into turns; consecutive records with the same index are
  // one turn regardless of role (a user message followed by its assistant answer).
  let currentTurn = -1;
  for (const m of messages) {
    if (!m || typeof m !== 'object' || typeof m.role !== 'string') { skipped++; continue; }
    const at = iso(m.timestamp);
    if (at) lastAt = at;
    const text = clean(typeof m.content === 'string' ? m.content : '');
    const ti = Number.isFinite(m.turnIndex) ? m.turnIndex : currentTurn + 1;
    if (m.role === 'user') {
      if (ti !== currentTurn || !text) {
        if (B.cur) B.closeTurn(B.cur, at || lastAt, 'completed');
        currentTurn = ti;
      }
      if (text) B.addMessage('user', text, at, String(m.id || m.timestamp || ''));
    } else if (m.role === 'assistant') {
      if (!B.cur && ti !== currentTurn) currentTurn = ti;
      if (text) {
        const model = B.ensureModel(at);
        model.text = model.text ? model.text + '\n\n' + text : text;
      } else {
        B.note('assistant-empty');
      }
    } else {
      skipped++;
      B.note('role:' + m.role);
    }
  }
  const endedAt = updatedAt || lastAt;
  // 'running' leaves the last turn open: state detection decides working vs stale.
  if (B.cur) {
    const failed = String(meta.status || '') === 'failed';
    const done = failed || meta.status === 'completed' || meta.status === 'done';
    if (done) B.closeTurn(B.cur, endedAt, failed ? 'failed' : 'completed', failed ? '任务标记为失败' : undefined);
  }
  B.finishPending();
  const f = B.fold();

  const title = typeof meta.title === 'string' && meta.title.trim() ? oneLine(meta.title, 80) : '';
  const session: Session = {
    id: sessionId(ZCODE_KIND, id),
    sourceId: id,
    source: {
      kind: ZCODE_KIND,
      format: 'zcode/session-json',
      adapter: ZCODE_KIND + '@' + ZCODE_ADAPTER_VERSION,
      ...(file.path ? { path: file.path } : {}),
      ...(file.size !== undefined ? { size: file.size } : {}),
      ...(file.mtimeMs !== undefined ? { mtimeMs: file.mtimeMs } : {}),
    },
    title: title || titleFallback([f.firstUser], cwd, startedAt, 'ZCode'),
    agent: { product: 'ZCode', name: 'ZCode', role: 'main' },
    ...(cwd ? { cwd } : {}),
    ...(startedAt ? { startedAt } : {}),
    ...(updatedAt || lastAt ? { updatedAt: updatedAt || lastAt } : {}),
    links: [],
    turns: B.turns,
    capabilities: ZCODE_CAPABILITIES,
    state: { status: 'empty' },
    stats: {
      turns: B.turns.length,
      modelCalls: f.modelCalls,
      toolCalls: f.toolCalls,
      toolErrors: f.toolErrors,
      messages: f.messages,
      compactions: 0,
      subagents: 0,
      records: messages.length,
      skipped,
    },
    notes: B.notes(),
  };
  session.state = detectState(session, {
    now: opts.now,
    mtimeMs: file.mtimeMs ?? (meta.updatedAt as number | undefined),
    staleMs: opts.staleMs ?? STALE_MS,
    openTools: Array.from(B.openTools.values()),
  });
  return session;
}

/** Whole-file JSON: every push() line accumulates, finish() parses once. */
export function createZcodeParser(file: SourceFile): LineParser {
  const lines: string[] = [];
  return {
    push(line: string) { lines.push(line); },
    finish(opts: FinishOptions) {
      return parseZcodeSession(lines.join('\n'), file, opts);
    },
  };
}
