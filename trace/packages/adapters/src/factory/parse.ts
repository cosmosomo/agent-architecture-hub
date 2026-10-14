/**
 * Factory CLI adapter. Factory streams one JSON record per line into
 * ~/.factory/sessions/<uuid>.jsonl:
 *
 *   {"type":"session_start","id":"<uuid>","title":"...","owner":"..."}
 *   {"type":"message","id":"<uuid>","timestamp":"...","message":{"role":"user","content":[...]}}
 *
 * The format carries no turn markers, tool calls or token counts: turns come
 * from user messages, toolCalls stay 0, and the last turn always closes as
 * completed — there is no running marker, so detectState never sees an open turn.
 */
import { sessionId, type AdapterCapabilities, type Iso, type Session, type Todo } from '@hub-trace/contract';
import { detectState, STALE_MS } from '../state.ts';
import { TurnBuilder, titleFallback } from '../turns.ts';
import { toolFamily } from '../opencode/parse.ts';
import { clean, oneLine } from '../text.ts';
import type { FinishOptions, LineParser, SourceFile } from '../types.ts';

export const FACTORY_KIND = 'factory';
export const FACTORY_ADAPTER_VERSION = '0.1.0';
export const FACTORY_CAPABILITIES: AdapterCapabilities = {
  observe_only: true,
  control_lifecycle: { start: true, resume: true, fork: false, stop: false },
  steer_in_turn: { in_turn: false, next_turn: true, inbox_file: false },
  coordinate_team: { spawn_subagent: false, peer_message: false, task_board: true },
};

type J = Record<string, any>;

function parseFactoryTodos(raw: unknown): Todo[] | undefined {
  const inner = (raw && typeof raw === 'object' && 'todos' in (raw as J)) ? (raw as J).todos : raw;
  const out: Todo[] = [];
  if (Array.isArray(inner)) {
    for (const it of inner) {
      if (!it || typeof it !== 'object') continue;
      const text = clean(typeof it.content === 'string' ? it.content : typeof it.text === 'string' ? it.text : '');
      const rawSt = String(it.status || 'pending').toLowerCase();
      const status: Todo['status'] = rawSt === 'completed' || rawSt === 'in_progress' ? rawSt : 'pending';
      if (text) out.push({ title: text, status });
    }
    return out.length ? out : undefined;
  }
  const str = typeof inner === 'string' ? inner : '';
  if (!str.trim()) return undefined;
  for (const line of str.split(/\r?\n/)) {
    const m = line.match(/^\s*\d+\.\s*\[(completed|in_progress|pending)\]\s*(.+)$/i);
    if (!m) continue;
    const st = m[1].toLowerCase() as 'completed' | 'in_progress' | 'pending';
    const text = clean(m[2]);
    if (text) out.push({ title: text, status: st });
  }
  return out.length ? out : undefined;
}

/** Streamed JSONL: every push() line is collected, finish() parses line by line. */
export function createFactoryParser(file: SourceFile): LineParser {
  const lines: string[] = [];
  return {
    push(line: string) { lines.push(line); },

    finish(opts: FinishOptions): Session {
      const B = new TurnBuilder({ userStartsTurn: true, turnForInferred: false });
      let records = 0;
      let skipped = 0;
      let markerId = '';
      let markerTitle = '';
      let lastAt: Iso | undefined;

      for (const line of lines) {
        if (!line || !line.trim()) continue;
        let o: J;
        try {
          o = JSON.parse(line);
        } catch {
          skipped++;
          continue;
        }
        records++;
        const at: Iso | undefined = typeof o?.timestamp === 'string' ? o.timestamp : undefined;
        if (at) { B.stamp(at); lastAt = at; }
        const type = o && typeof o === 'object' && typeof o.type === 'string' ? o.type : '';
        if (type === 'session_start') {
          // 首个 marker 为准
          if (!markerId && typeof o.id === 'string' && o.id) markerId = o.id;
          if (!markerTitle && typeof o.title === 'string' && o.title.trim()) markerTitle = o.title;
        } else if (type === 'todo_state') {
          const todos = parseFactoryTodos(o.todos);
          const tool = B.addToolCall({
            callId: typeof o.id === 'string' && o.id ? o.id : undefined,
            name: 'TodoWrite',
            family: 'plan',
            input: o.todos !== undefined ? JSON.stringify(o.todos) : undefined,
            at,
          });
          if (todos) tool.todos = todos;
          tool.status = 'ok';
          B.closeTool(tool, at);
        } else if (type === 'compaction_state') {
          const summary = typeof o.summaryText === 'string' && o.summaryText.trim()
            ? oneLine(o.summaryText, 120)
            : '上下文压缩';
          B.addEvent('compaction', at, summary);
        } else if (type === 'message') {
          const m = o.message;
          if (!m || typeof m !== 'object' || typeof m.role !== 'string') {
            skipped++;
            B.note('message:bad');
            continue;
          }
          // content 是字符串或块数组。块是 Claude 形状：text/thinking/tool_use/tool_result/image。
          let text = '';
          if (typeof m.content === 'string') {
            text = m.content;
          } else if (Array.isArray(m.content)) {
            const parts: string[] = [];
            for (const b of m.content) {
              if (!b || typeof b !== 'object' || typeof b.type !== 'string') { skipped++; B.note('block:unknown'); continue; }
              if (b.type === 'text' && typeof b.text === 'string') parts.push(b.text);
              else if (b.type === 'thinking' && typeof b.thinking === 'string') {
                const model = B.ensureModel(at);
                const think = clean(b.thinking);
                model.reasoning = model.reasoning ? model.reasoning + '\n\n' + think : think;
              } else if (b.type === 'tool_use') {
                B.addToolCall({
                  callId: typeof b.id === 'string' && b.id ? b.id : undefined,
                  name: typeof b.name === 'string' && b.name ? b.name : 'tool',
                  family: toolFamily(typeof b.name === 'string' ? b.name : ''),
                  input: b.input !== undefined ? JSON.stringify(b.input) : undefined,
                  at,
                });
              } else if (b.type === 'tool_result') {
                B.addToolOutput({
                  callId: typeof b.tool_use_id === 'string' && b.tool_use_id ? b.tool_use_id : undefined,
                  output: typeof b.content === 'string' ? b.content : b.content !== undefined ? JSON.stringify(b.content) : '',
                  at,
                  isError: b.is_error === true || b.isError === true,
                });
              } else if (b.type === 'image') {
                parts.push('[图片]');
              } else {
                skipped++;
                B.note('block:' + b.type);
              }
            }
            text = parts.join('\n');
          } else {
            skipped++;
            B.note('content:' + (m.content === null ? 'null' : typeof m.content));
          }
          if (m.role === 'user') {
            // Client-injected environment blocks are context, not words the user typed
            // (same rule as the claude-code adapter): keep them out of turn inputs.
            if (/^\s*<system-reminder>/.test(text)) {
              B.addMessage('context', text, at);
              B.note('injected-reminder');
            } else if (text) {
              B.addMessage('user', text, at);
            } else { skipped++; B.note('user-empty'); }
          } else if (m.role === 'assistant') {
            if (text) {
              const model = B.ensureModel(at);
              const t = clean(text);
              model.text = model.text ? model.text + '\n\n' + t : t;
            } else {
              B.note('assistant-empty');
            }
          } else {
            skipped++;
            B.note('role:' + m.role);
          }
        } else {
          skipped++;
          B.note('type:' + (type || 'unknown'));
        }
      }

      // 没有运行标记：最后一条消息时间收尾，还开着的轮一律按完成处理
      if (B.cur) B.closeTurn(B.cur, lastAt, 'completed');
      B.finishPending();
      const f = B.fold();

      const id: string = markerId || String(file.path || '').split(/[\\/]/).pop()!.replace(/\.jsonl$/i, '');
      const startedAt = B.firstAt;
      const title = markerTitle ? oneLine(markerTitle, 80) : '';
      const session: Session = {
        id: sessionId(FACTORY_KIND, id),
        sourceId: id,
        source: {
          kind: FACTORY_KIND,
          format: 'factory/jsonl',
          adapter: FACTORY_KIND + '@' + FACTORY_ADAPTER_VERSION,
          ...(file.path ? { path: file.path } : {}),
          ...(file.size !== undefined ? { size: file.size } : {}),
          ...(file.mtimeMs !== undefined ? { mtimeMs: file.mtimeMs } : {}),
        },
        // 格式里没有工作目录，title 兜底也不带 cwd
        title: title || titleFallback([f.firstUser], undefined, startedAt, 'Factory'),
        agent: { product: 'Factory', name: 'Factory', role: 'main' },
        ...(startedAt ? { startedAt } : {}),
        ...(lastAt ? { updatedAt: lastAt } : {}),
        links: [],
        turns: B.turns,
        capabilities: FACTORY_CAPABILITIES,
        state: { status: 'empty' },
        stats: {
          turns: B.turns.length,
          modelCalls: f.modelCalls,
          toolCalls: f.toolCalls,
          toolErrors: f.toolErrors,
          messages: f.messages,
          compactions: f.compactions,
          subagents: 0,
          records,
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
    },
  };
}
