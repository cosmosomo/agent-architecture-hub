/**
 * Codex session records (`~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl`) to the trace contract.
 *
 * Two formats (docs/ARCHITECTURE.md):
 * - envelope: every line is `{timestamp, type, payload}`; turns are framed by
 *   event_msg/task_started and task_complete | turn_aborted; a token_usage_record
 *   closes each model call; event_msg/item_completed reports what tools did.
 * - legacy: a header line `{id, timestamp, instructions, git}`, then bare response
 *   items without timestamps; turns are inferred from user messages.
 *
 * Unknown record kinds are counted into `notes`, never dropped silently.
 * The turn/model/tool lifecycle lives in ../turns.ts; this file only maps records.
 */
import {
  CONTRACT_VERSION,
  sessionId,
  type AdapterCapabilities,
  type Effect,
  type Iso,
  type RateLimit,
  type Session,
  type SessionLink,
  type Todo,
  type ToolFamily,
  type ToolStep,
  type Usage,
} from '@hub-trace/contract';
import type { FinishOptions, LineParser, SourceFile } from '../types.ts';
import { clean, isoFromEpoch, oneLine, partsText } from '../text.ts';
import { basename, titleFallback, TurnBuilder } from '../turns.ts';
import { detectState } from '../state.ts';

export const CODEX_KIND = 'codex';
export const CODEX_ADAPTER_VERSION = '0.2.2';

export const CODEX_CAPABILITIES: AdapterCapabilities = {
  observe_only: true,
  control_lifecycle: { start: true, resume: true, fork: true, stop: true },
  steer_in_turn: { in_turn: true, next_turn: true, inbox_file: true },
  coordinate_team: { spawn_subagent: true, peer_message: true, task_board: true },
};

// Raw records are external JSON; they are read defensively field by field.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type J = any;

const AGENT_TOOLS = new Set(['spawn_agent', 'send_message', 'wait_agent', 'wait', 'list_agents', 'followup_task', 'interrupt_agent', 'close_agent', 'send_input', 'resume_agent']);
const SHELL_TOOLS = new Set(['shell', 'shell_command', 'exec', 'exec_command', 'write_stdin', 'local_shell', 'js']);
const CONTEXT_PREFIX = /^\s*(<[A-Za-z_][\w-]*[\s>]|# AGENTS\.md)/;
const KNOWN_TOP = new Set(['session_meta', 'turn_context', 'world_state', 'token_usage_record', 'compacted', 'event_msg', 'response_item', 'inter_agent_communication_metadata', 'realtime_item']);
const IGNORED_EVENTS = new Set(['agent_message', 'agent_reasoning', 'agent_reasoning_raw_content', 'exec_command_begin', 'exec_command_output_delta', 'patch_apply_begin', 'mcp_tool_call_begin', 'web_search_begin']);
const IGNORED_ITEMS = new Set(['AgentMessage', 'Reasoning', 'HookPrompt', 'FunctionCallOutput']);

export function toolFamily(name: string, type?: string): ToolFamily {
  if (type === 'web_search_call' || type === 'tool_search_call') return 'web';
  if (type === 'local_shell_call') return 'shell';
  if (name === 'apply_patch') return 'patch';
  if (name === 'update_plan') return 'plan';
  if (name === 'view_image') return 'image';
  if (AGENT_TOOLS.has(name)) return 'agent';
  if (SHELL_TOOLS.has(name)) return 'shell';
  if (name.includes('__') || name.startsWith('mcp')) return 'mcp';
  return 'other';
}

function usageOf(u: J): Usage | undefined {
  if (!u || typeof u !== 'object') return undefined;
  const out: Usage = {};
  const put = (k: keyof Usage, v: unknown) => { if (typeof v === 'number' && Number.isFinite(v)) out[k] = v; };
  put('input', u.input_tokens);
  put('cachedInput', u.cached_input_tokens);
  put('cacheWrite', u.cache_write_input_tokens);
  put('output', u.output_tokens);
  put('reasoning', u.reasoning_output_tokens);
  put('total', u.total_tokens);
  return Object.keys(out).length ? out : undefined;
}

function durationMs(d: J): number | undefined {
  if (typeof d === 'number') return d;
  if (d && typeof d.secs === 'number') return Math.round(d.secs * 1000 + (d.nanos || 0) / 1e6);
  return undefined;
}

function exitCodeOf(text: string): number | undefined {
  const m = /^Exit code: (-?\d+)/m.exec(text) || /Process exited with code (-?\d+)/.exec(text);
  return m ? Number(m[1]) : undefined;
}

function todosOf(argsText: string): Todo[] | undefined {
  try {
    const a = JSON.parse(argsText);
    if (!Array.isArray(a?.plan)) return undefined;
    return a.plan
      .filter((p: J) => p && typeof p.step === 'string')
      .map((p: J) => ({
        title: oneLine(p.step, 200),
        status: p.status === 'completed' || p.status === 'in_progress' ? p.status : 'pending',
      }));
  } catch {
    return undefined;
  }
}

export function createCodexParser(file: SourceFile): LineParser {
  let format: 'codex/envelope' | 'codex/legacy' | undefined;
  let meta: J = null;
  let legacyHeader: J = null;
  let records = 0;
  let skipped = 0;

  const B = new TurnBuilder({ messageClosesModel: true });
  // Tools whose call already returned, by family: effects that report later (a process still running
  // when `exec` returned) attach here.
  const recentByFamily = new Map<ToolFamily, ToolStep>();
  let recentTool: ToolStep | null = null;
  let provider: string | undefined;
  let sessionUsage: Usage | undefined;
  let limits: RateLimit[] | undefined;
  const children = new Map<string, string>(); // global id -> label
  const realUserTexts = new Set<string>();
  let lastCompactionAt = -Infinity;

  function addCompaction(at: Iso | undefined, text?: string) {
    const ms = at ? Date.parse(at) : NaN;
    if (Number.isFinite(ms) && Math.abs(ms - lastCompactionAt) < 5000) return;
    if (Number.isFinite(ms)) lastCompactionAt = ms;
    B.closeModel(at);
    B.addEvent('compaction', at, text ? clean(text) : '上下文已压缩');
  }

  function addToolCall(p: J, at: Iso | undefined, turnId?: string) {
    const type: string = p.type;
    const name: string = typeof p.name === 'string' ? p.name : type === 'web_search_call' ? 'web_search' : type === 'local_shell_call' ? 'local_shell' : type === 'tool_search_call' ? 'tool_search' : 'tool';
    const callId: string | undefined = typeof p.call_id === 'string' ? p.call_id : typeof p.id === 'string' ? p.id : undefined;
    let input: string | undefined;
    if (typeof p.arguments === 'string') input = p.arguments;
    else if (typeof p.input === 'string') input = p.input;
    else if (p.action && typeof p.action === 'object') input = JSON.stringify(p.action);
    const tool = B.addToolCall({ callId, name, family: toolFamily(name, type), input, at, turnId });
    if (name === 'update_plan' && tool.input) { const todos = todosOf(tool.input); if (todos) tool.todos = todos; }
    if (type === 'web_search_call') {
      // No output record follows a web search; the call is its own result.
      tool.status = p.status === 'failed' ? 'error' : 'ok';
      tool.endAt = at;
      return;
    }
    recentByFamily.set(tool.family, tool);
    recentTool = tool;
  }

  function addToolOutput(p: J, at: Iso | undefined, turnId?: string) {
    const callId: string | undefined = typeof p.call_id === 'string' ? p.call_id : undefined;
    const text = partsText(p.output);
    const tool = B.addToolOutput({ callId, name: typeof p.name === 'string' ? p.name : 'tool', output: text, at, turnId });
    if (typeof p.output === 'string' && p.output.startsWith('{')) {
      try {
        const o = JSON.parse(p.output);
        if (o && typeof o === 'object' && 'output' in o && o.metadata && typeof o.metadata === 'object') {
          const inner = typeof o.output === 'string' ? o.output : JSON.stringify(o.output);
          tool.output = clean(inner);
          if (typeof o.metadata.exit_code === 'number') tool.exitCode = o.metadata.exit_code;
          if (typeof o.metadata.duration_seconds === 'number') tool.durationMs = Math.round(o.metadata.duration_seconds * 1000);
        }
      } catch { /* plain text output */ }
    }
    if (tool.exitCode === undefined && tool.family === 'shell') { const code = exitCodeOf(tool.output || text); if (code !== undefined) tool.exitCode = code; }
    B.settle(tool);
  }

  function effectTarget(itemId: unknown): ToolStep | null {
    if (typeof itemId === 'string' && B.openTools.has(itemId)) return B.openTools.get(itemId)!;
    return B.lastTool;
  }

  const EFFECT_FAMILY: Record<Effect['kind'], ToolFamily> = { command: 'shell', file: 'patch', mcp: 'mcp', web: 'web', image: 'image', subagent: 'agent' };

  function addEffect(e: Effect, itemId: unknown, at: Iso | undefined) {
    const tool = effectTarget(itemId);
    if (tool) { tool.effects.push(e); return; }
    if (e.kind === 'subagent') { B.addEvent('subagent', at, e.label, e.ref); return; }
    const late = recentByFamily.get(EFFECT_FAMILY[e.kind]) || recentTool;
    if (!late) { B.note('effect-without-tool:' + e.kind); return; }
    e.late = true;
    late.effects.push(e);
    if (e.status === 'error' && late.status === 'ok') late.status = 'error';
  }

  function onItem(it: J, at: Iso | undefined) {
    const type = it?.type;
    switch (type) {
      case 'CommandExecution': {
        const cmd = Array.isArray(it.parsed_cmd) && it.parsed_cmd[0]?.cmd ? it.parsed_cmd[0].cmd : Array.isArray(it.command) ? it.command[it.command.length - 1] : String(it.command || '');
        const e: Effect = { kind: 'command', label: oneLine(cmd, 200), status: it.status === 'failed' || (typeof it.exit_code === 'number' && it.exit_code !== 0) ? 'error' : 'ok' };
        if (typeof it.exit_code === 'number') e.exitCode = it.exit_code;
        const d = durationMs(it.duration);
        if (d !== undefined) e.durationMs = d;
        addEffect(e, it.id, at);
        return;
      }
      case 'FileChange': {
        const paths = it.changes && typeof it.changes === 'object' ? Object.keys(it.changes) : [];
        const e: Effect = { kind: 'file', label: oneLine(paths.map(basename).join(', ') || '文件改动', 200), status: it.status === 'failed' ? 'error' : 'ok' };
        if (paths.length) e.ref = paths[0];
        const diffs = paths.map((p) => '--- ' + p + '\n' + (typeof it.changes[p]?.unified_diff === 'string' ? it.changes[p].unified_diff : '')).join('\n');
        if (diffs.trim()) e.detail = clean(diffs);
        addEffect(e, it.id, at);
        return;
      }
      case 'McpToolCall':
      case 'DynamicToolCall': {
        const label = [it.server || it.namespace, it.tool].filter(Boolean).join('.');
        const e: Effect = { kind: 'mcp', label: oneLine(label || 'MCP', 120), status: it.status === 'failed' || it.result?.isError || it.success === false ? 'error' : 'ok' };
        const d = durationMs(it.duration);
        if (d !== undefined) e.durationMs = d;
        addEffect(e, it.id, at);
        return;
      }
      case 'SubAgentActivity': {
        if (typeof it.agent_thread_id !== 'string') return;
        const ref = sessionId(CODEX_KIND, it.agent_thread_id);
        const label = (it.agent_path || it.agent_thread_id) as string;
        if (it.kind === 'started' || !children.has(ref)) children.set(ref, label);
        const verb = it.kind === 'started' ? '启动' : it.kind === 'completed' ? '完成' : '交互';
        addEffect({ kind: 'subagent', label: oneLine(verb + ' ' + label, 160), ref }, it.id, at);
        return;
      }
      case 'CollabAgentToolCall': {
        const tool = typeof it.id === 'string' ? B.openTools.get(it.id) : undefined;
        const ids: string[] = Array.isArray(it.receiver_thread_ids) ? it.receiver_thread_ids.filter((x: unknown) => typeof x === 'string') : [];
        if (tool && ids.length) tool.agents = ids.map((x) => sessionId(CODEX_KIND, x));
        if (it.tool === 'spawn_agent') for (const x of ids) { const ref = sessionId(CODEX_KIND, x); if (!children.has(ref)) children.set(ref, x); }
        if (tool && it.status === 'failed') tool.effects.push({ kind: 'subagent', label: oneLine(String(it.tool) + ' 失败', 80), status: 'error' });
        return;
      }
      case 'WebSearch':
      case 'Extension':
        addEffect({ kind: 'web', label: oneLine(it.query || it.kind || '搜索', 160) }, it.id, at);
        return;
      case 'ImageView':
        addEffect({ kind: 'image', label: oneLine(typeof it.path === 'string' ? basename(it.path) : '图片', 120), ref: it.path }, it.id, at);
        return;
      case 'ContextCompaction':
        addCompaction(at);
        return;
      case 'UserMessage': {
        const text = Array.isArray(it.content) ? it.content.filter((c: J) => c && typeof c.text === 'string').map((c: J) => c.text).join('\n') : '';
        if (text) realUserTexts.add(clean(text));
        return;
      }
      default:
        if (!IGNORED_ITEMS.has(type)) B.note('item:' + String(type));
    }
  }

  function onEvent(p: J, at: Iso | undefined) {
    switch (p.type) {
      case 'task_started': {
        const id: string | undefined = typeof p.turn_id === 'string' ? p.turn_id : undefined;
        const start = at || isoFromEpoch(p.started_at);
        if (B.cur && !B.cur.inferred) B.closeTurn(B.cur, start, 'aborted', '（没有结束记录）');
        if (B.cur && B.cur.inferred && B.cur.steps.length === 0) { B.turns.pop(); B.turnById.delete(B.cur.id); B.cur = null; }
        if (B.cur && B.cur.inferred) B.closeTurn(B.cur, start, 'completed');
        B.openTurn(id, start, false);
        return;
      }
      case 'task_complete':
      case 'turn_aborted': {
        const t = (typeof p.turn_id === 'string' && B.turnById.get(p.turn_id)) || B.cur;
        if (!t) { B.note('event:' + p.type + ':no-turn'); return; }
        const end = at || isoFromEpoch(p.completed_at);
        if (typeof p.duration_ms === 'number') t.durationMs = p.duration_ms;
        if (typeof p.time_to_first_token_ms === 'number') t.firstTokenMs = p.time_to_first_token_ms;
        if (p.type === 'turn_aborted') {
          const reason = p.reason === 'interrupted' ? '被打断' : String(p.reason || '中止');
          B.addEvent('aborted', end, reason);
          B.closeTurn(t, end, 'aborted', reason);
          return;
        }
        if (typeof p.last_agent_message === 'string') t.output = oneLine(p.last_agent_message, 400);
        const err = p.error && typeof p.error === 'object' ? oneLine(p.error.message || p.error.codex_error_info || '出错', 400) : undefined;
        if (err) B.addEvent('error', end, err);
        B.closeTurn(t, end, err ? 'failed' : 'completed', err);
        return;
      }
      case 'token_count': {
        const info = p.info;
        if (info?.total_token_usage) sessionUsage = usageOf(info.total_token_usage) || sessionUsage;
        if (B.model && !B.model.usage && info?.last_token_usage) B.closeModel(at, usageOf(info.last_token_usage));
        const rl = p.rate_limits;
        if (rl && typeof rl === 'object') {
          const out: RateLimit[] = [];
          for (const k of ['primary', 'secondary']) {
            const w = rl[k];
            if (w && typeof w.used_percent === 'number') {
              const r: RateLimit = { name: k, usedPercent: w.used_percent };
              if (typeof w.window_minutes === 'number') r.windowMinutes = w.window_minutes;
              const reset = isoFromEpoch(w.resets_at);
              if (reset) r.resetsAt = reset;
              out.push(r);
            }
          }
          if (out.length) limits = out;
        }
        return;
      }
      case 'item_completed':
        onItem(p.item, at);
        return;
      case 'thread_settings_applied': {
        const ts = p.thread_settings || {};
        B.settings = {
          ...B.settings,
          ...(typeof ts.model === 'string' ? { model: ts.model } : {}),
          ...(typeof ts.reasoning_effort === 'string' ? { effort: ts.reasoning_effort } : {}),
          ...(typeof ts.approval_policy === 'string' ? { approval: ts.approval_policy } : {}),
          ...(typeof ts.permission_profile?.type === 'string' ? { sandbox: ts.permission_profile.type } : {}),
        };
        if (typeof ts.model_provider_id === 'string') provider = ts.model_provider_id;
        return;
      }
      case 'thread_goal_updated': {
        const g = p.goal || {};
        B.addEvent('goal', at, oneLine((g.status ? '[' + g.status + '] ' : '') + (g.objective || ''), 300));
        return;
      }
      case 'user_message':
        if (typeof p.message === 'string') realUserTexts.add(clean(p.message));
        return;
      default:
        if (!IGNORED_EVENTS.has(p.type)) B.note('event:' + String(p.type));
    }
  }

  function onResponseItem(p: J, at: Iso | undefined) {
    const turnId: string | undefined = p.internal_chat_message_metadata_passthrough?.turn_id;
    switch (p.type) {
      case 'message': {
        const text = partsText(p.content);
        if (p.role === 'assistant') {
          const m = B.ensureModel(at, turnId);
          const t = clean(text);
          m.text = m.text ? m.text + '\n\n' + t : t;
          if (p.phase === 'final_answer') m.phase = 'final';
          else if (p.phase === 'commentary' && !m.phase) m.phase = 'commentary';
          return;
        }
        if (p.role === 'user') { B.addMessage(CONTEXT_PREFIX.test(text) ? 'context' : 'user', text, at, p.id); return; }
        B.addMessage('developer', text, at, p.id);
        return;
      }
      case 'reasoning': {
        const m = B.ensureModel(at, turnId);
        const summary = partsText(p.summary) || (Array.isArray(p.content) ? partsText(p.content) : '');
        if (summary.trim()) m.reasoning = m.reasoning ? m.reasoning + '\n\n' + clean(summary) : clean(summary);
        else if (p.encrypted_content) m.reasoningHidden = true;
        return;
      }
      case 'function_call':
      case 'custom_tool_call':
      case 'local_shell_call':
      case 'web_search_call':
      case 'tool_search_call':
        addToolCall(p, at, turnId);
        return;
      case 'function_call_output':
      case 'custom_tool_call_output':
      case 'tool_search_output':
        addToolOutput(p, at, turnId);
        return;
      case 'agent_message': {
        const text = partsText(p.content);
        B.addMessage('agent', text || '（加密内容）', at, p.id, { from: oneLine(p.author, 80), to: oneLine(p.recipient, 80) });
        return;
      }
      case 'compaction':
      case 'compaction_summary':
        addCompaction(at);
        return;
      case 'additional_tools':
        // The tool list sent to the model as a developer message: context, not conversation (10-19).
        return;
      default:
        B.note('response_item:' + String(p.type));
    }
  }

  function onRecord(o: J, index: number) {
    if (index === 0) {
      format = o && typeof o === 'object' && 'payload' in o ? 'codex/envelope' : 'codex/legacy';
      B.userStartsTurn = format === 'codex/legacy';
    }
    if (format === 'codex/legacy') {
      if (index === 0) { legacyHeader = o; B.stamp(typeof o.timestamp === 'string' ? o.timestamp : undefined); return; }
      if (o.record_type === 'state') return;
      onResponseItem(o, undefined);
      return;
    }
    const at: Iso | undefined = typeof o.timestamp === 'string' ? o.timestamp : undefined;
    B.stamp(at);
    const p = o.payload;
    switch (o.type) {
      case 'session_meta':
        if (!meta) meta = p || {};
        return;
      case 'turn_context': {
        B.settings = {
          ...B.settings,
          ...(typeof p?.model === 'string' ? { model: p.model } : {}),
          ...(typeof p?.effort === 'string' ? { effort: p.effort } : {}),
          ...(typeof p?.approval_policy === 'string' ? { approval: p.approval_policy } : {}),
          ...(typeof p?.sandbox_policy?.type === 'string' ? { sandbox: p.sandbox_policy.type } : {}),
        };
        const t = (typeof p?.turn_id === 'string' && B.turnById.get(p.turn_id)) || B.cur;
        if (t) t.settings = { ...B.settings };
        return;
      }
      case 'token_usage_record': {
        const usage = usageOf(p?.usage);
        if (!B.model && usage) B.ensureModel(at, p?.turn_id);
        B.closeModel(at, usage, typeof p?.response_id === 'string' ? p.response_id : undefined);
        const t = (typeof p?.turn_id === 'string' && B.turnById.get(p.turn_id)) || B.cur;
        const tu = usageOf(p?.turn_token_usage);
        if (t && tu) t.usage = tu;
        sessionUsage = usageOf(p?.thread_token_usage) || sessionUsage;
        return;
      }
      case 'compacted':
        addCompaction(at, typeof p?.message === 'string' ? p.message : undefined);
        return;
      case 'event_msg':
        if (p && typeof p === 'object') onEvent(p, at);
        return;
      case 'response_item':
        if (p && typeof p === 'object') onResponseItem(p, at);
        return;
      default:
        if (!KNOWN_TOP.has(o.type)) B.note('record:' + String(o.type));
    }
  }

  return {
    push(line: string) {
      if (!line || !line.trim()) return;
      let o: J;
      try {
        o = JSON.parse(line);
      } catch {
        skipped++;
        records++;
        return;
      }
      onRecord(o, records);
      records++;
    },

    finish(opts: FinishOptions): Session {
      B.finishPending();

      // Real user inputs reported by the client upgrade messages the prefix check took for context.
      if (realUserTexts.size) {
        for (const t of B.turns) for (const s of t.steps) {
          if (s.kind === 'message' && s.role === 'context' && realUserTexts.has(s.text)) {
            s.role = 'user';
            if (!t.input) t.input = oneLine(s.text, 400);
          }
        }
      }

      const m = meta || {};
      const sourceId: string = String(m.id || m.session_id || legacyHeader?.id || (file.path ? basename(file.path).replace(/\.jsonl$/i, '') : 'unknown'));
      const parentId: string | undefined = typeof m.parent_thread_id === 'string' ? m.parent_thread_id : m.source?.subagent?.thread_spawn?.parent_thread_id;
      const nickname: string | undefined = typeof m.agent_nickname === 'string' ? m.agent_nickname : undefined;
      const isSub = Boolean(parentId || m.source?.subagent);

      const links: SessionLink[] = [];
      if (parentId) links.push({ rel: 'parent', id: sessionId(CODEX_KIND, parentId) });
      if (typeof m.forked_from_id === 'string') links.push({ rel: 'forked-from', id: sessionId(CODEX_KIND, m.forked_from_id) });
      for (const [id, label] of children) links.push({ rel: 'child', id, label: oneLine(label, 80) });

      const f = B.fold({ preferFinalPhase: true });
      const cwd: string | undefined = typeof m.cwd === 'string' ? m.cwd : undefined;
      const startedAt = (typeof m.timestamp === 'string' ? m.timestamp : undefined) || B.firstAt;
      const title = titleFallback(
        isSub && nickname ? [nickname + (f.firstAgent || f.firstUser ? '：' + (f.firstAgent || f.firstUser) : ''), f.firstUser || f.firstAgent] : [f.firstUser || f.firstAgent],
        cwd,
        startedAt,
        'Codex',
      );

      const lastModel = [...B.turns].reverse().find((t) => t.settings?.model)?.settings?.model || B.settings.model;
      const session: Session = {
        id: sessionId(CODEX_KIND, sourceId),
        sourceId,
        source: {
          kind: CODEX_KIND,
          format: format || 'codex/envelope',
          adapter: CODEX_KIND + '@' + CODEX_ADAPTER_VERSION,
          ...(typeof m.cli_version === 'string' ? { version: m.cli_version } : {}),
          ...(file.path ? { path: file.path } : {}),
          ...(file.size !== undefined ? { size: file.size } : {}),
          ...(file.mtimeMs !== undefined ? { mtimeMs: file.mtimeMs } : {}),
        },
        title,
        agent: {
          product: 'Codex',
          name: nickname || 'Codex',
          role: isSub ? 'subagent' : 'main',
          ...(nickname ? { nickname } : {}),
          ...(typeof m.agent_path === 'string' ? { path: m.agent_path } : {}),
          ...(typeof m.originator === 'string' ? { originator: m.originator } : {}),
          ...(provider || typeof m.model_provider === 'string' ? { provider: provider || m.model_provider } : {}),
          ...(lastModel ? { model: lastModel } : {}),
        },
        ...(cwd ? { cwd } : {}),
        ...(startedAt ? { startedAt } : {}),
        ...(B.lastAt ? { updatedAt: B.lastAt } : {}),
        links,
        turns: B.turns,
        ...(sessionUsage ? { usage: sessionUsage } : {}),
        ...(limits ? { limits } : {}),
        capabilities: CODEX_CAPABILITIES,
        state: { status: 'empty' },
        stats: {
          turns: B.turns.length,
          modelCalls: f.modelCalls,
          toolCalls: f.toolCalls,
          toolErrors: f.toolErrors,
          messages: f.messages,
          compactions: f.compactions,
          subagents: children.size,
          ...(f.durationTotal ? { durationMs: f.durationTotal } : {}),
          records,
          skipped,
        },
        notes: B.notes(),
      };
      session.state = detectState(session, { now: opts.now, mtimeMs: file.mtimeMs, staleMs: opts.staleMs, openTools: Array.from(B.openTools.values()) });
      return session;
    },
  };
}

export { CONTRACT_VERSION };
