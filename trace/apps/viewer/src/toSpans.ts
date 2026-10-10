/**
 * Trace contract -> AgentPrism's view model (TraceSpan). Mapped directly rather than
 * through the OTLP export, so reasoning summaries and plan items reach the Thinking
 * tab and the task list. Tree: session > turns > steps (> effects of a tool call).
 */
import type { TokenUsage, TraceSpan, TraceSpanAttribute, TraceSpanCategory, TraceSpanStatus } from '@evilmartians/agent-prism-types';
import type { Effect, EventStep, MessageStep, ModelStep, Session, SessionStatus, Step, ToolStep, Turn } from '@hub-trace/contract';
import { STATUS_LABEL, basename, cut } from './format.ts';

const SESSION_STATUS: Record<SessionStatus, TraceSpanStatus> = {
  working: 'pending',
  waiting: 'pending',
  idle: 'success',
  aborted: 'warning',
  failed: 'error',
  stale: 'warning',
  empty: 'warning',
};
const TURN_STATUS: Record<Turn['status'], TraceSpanStatus> = { running: 'pending', completed: 'success', failed: 'error', aborted: 'warning' };
const TOOL_STATUS: Record<ToolStep['status'], TraceSpanStatus> = { ok: 'success', error: 'error', pending: 'pending' };
const ROLE_LABEL: Record<MessageStep['role'], string> = { user: '用户', developer: '开发者消息', context: '注入的上下文', agent: '智能体消息' };
const EVENT_LABEL: Record<EventStep['name'], string> = { compaction: '上下文压缩', aborted: '被打断', error: '出错', goal: '目标', subagent: '子智能体', note: '备注' };
const EFFECT_LABEL: Record<Effect['kind'], string> = { command: '命令', file: '文件', mcp: 'MCP', subagent: '子智能体', web: '搜索', image: '图片' };

export const SESSION_SPAN_ID = 'session';
export const turnSpanId = (t: Turn) => 'turn:' + t.id;

function attrs(pairs: [string, unknown][]): TraceSpanAttribute[] {
  const out: TraceSpanAttribute[] = [];
  for (const [key, v] of pairs) {
    if (v === undefined || v === null || v === '') continue;
    if (typeof v === 'number') out.push({ key, value: Number.isInteger(v) ? { intValue: v } : { doubleValue: v } });
    else if (typeof v === 'boolean') out.push({ key, value: { boolValue: v } });
    else out.push({ key, value: { stringValue: typeof v === 'string' ? v : JSON.stringify(v) } });
  }
  return out;
}

const ms = (iso: string | undefined): number | undefined => {
  const t = iso ? Date.parse(iso) : NaN;
  return Number.isFinite(t) ? t : undefined;
};

function times(at: string | undefined, endAt: string | undefined, fallback: number, durationMs?: number): { startTime: Date; endTime: Date } {
  const start = ms(at) ?? fallback;
  let end = ms(endAt) ?? (durationMs !== undefined ? start + durationMs : start);
  if (end < start) end = start;
  return { startTime: new Date(start), endTime: new Date(end) };
}

function tokenUsage(m: ModelStep): TokenUsage | undefined {
  const u = m.usage;
  if (!u) return undefined;
  const out: TokenUsage = {};
  if (u.input !== undefined) out.input = { tokens: Math.max(u.input - (u.cachedInput || 0) - (u.cacheWrite || 0), 0) };
  if (u.cachedInput) out.cache_read = { tokens: u.cachedInput };
  if (u.cacheWrite) out.cache_write = { tokens: u.cacheWrite };
  if (u.output !== undefined) out.output = { tokens: u.output };
  if (!Object.keys(out).length && u.total !== undefined) out.total = { tokens: u.total };
  return Object.keys(out).length ? out : undefined;
}

function json(s: string | undefined): Record<string, unknown> | null {
  if (!s || s[0] !== '{') return null;
  try {
    const v = JSON.parse(s);
    return v && typeof v === 'object' && !Array.isArray(v) ? v : null;
  } catch {
    return null;
  }
}

/** One line saying what a tool call did, from its input. */
export function toolSummary(t: ToolStep): string {
  const input = t.input || '';
  if (t.family === 'patch') {
    const files = Array.from(input.matchAll(/^\*\*\* (?:Add|Update|Delete) File: (.+)$/gm)).map((m) => basename(m[1].trim()));
    if (files.length) return '改 ' + files.join('、');
  }
  if (t.family === 'plan' && t.todos) return '更新计划（' + t.todos.length + ' 项）';
  const args = json(input);
  if (args && t.family === 'agent') {
    const n = t.agents?.length || (Array.isArray(args.agents) ? args.agents.length : 0) || (Array.isArray(args.ids) ? args.ids.length : 0);
    if (t.name === 'wait_agent' || t.name === 'wait') return '等 ' + (n || '') + ' 个子智能体';
    if (t.name === 'list_agents') return '列出智能体';
  }
  if (args) {
    const cmd = args.command ?? args.cmd;
    if (Array.isArray(cmd)) {
      const parts = cmd.map(String);
      return parts.length >= 3 && /^-l?c$/.test(parts[1]) ? parts.slice(2).join(' ') : parts.join(' ');
    }
    if (typeof cmd === 'string') return cmd;
    for (const k of ['message', 'task', 'prompt', 'query', 'path', 'file_path', 'url', 'nickname', 'pattern']) {
      if (typeof args[k] === 'string') return String(args[k]);
    }
    return Object.keys(args).slice(0, 4).join('、');
  }
  return input.split('\n').find((l) => l.trim()) || '';
}

const NOISE = /^(Exit code:|Wall time:|Output:|Process exited|Process running|Chunk ID:|Original token count:)/;

/** Short error message for AgentPrism's error blocks: exit code plus the first meaningful output line. */
function toolError(t: ToolStep): string {
  const line = (t.output || '').split(/\r?\n/).map((l) => l.trim()).find((l) => l && !NOISE.test(l));
  const failed = t.effects.find((e) => e.status === 'error');
  const head = t.exitCode !== undefined && t.exitCode !== 0 ? '退出码 ' + t.exitCode : failed ? EFFECT_LABEL[failed.kind] + '失败：' + failed.label : '出错';
  return head + (line ? '：' + cut(line, 160) : '');
}

function effectSpan(e: Effect, parentId: string, i: number, start: Date): TraceSpan {
  const end = new Date(start.getTime() + (e.durationMs || 0));
  return {
    id: parentId + '/effect:' + i,
    title: EFFECT_LABEL[e.kind] + ' · ' + cut(e.label, 80) + (e.late ? '（调用返回后结束）' : ''),
    type: e.kind === 'subagent' ? 'create_agent' : e.kind === 'web' ? 'retrieval' : 'span',
    status: e.status === 'error' ? 'error' : 'success',
    startTime: start,
    endTime: end,
    ...(e.detail ? { output: e.detail } : {}),
    attributes: attrs([['effect.kind', e.kind], ['exit_code', e.exitCode], ['duration_ms', e.durationMs], ['ref', e.ref], ['late', e.late], ['error.message', e.status === 'error' ? (e.exitCode !== undefined ? '退出码 ' + e.exitCode : '失败') : undefined]]),
    raw: [JSON.stringify(e, null, 2)],
    children: [],
  };
}

function stepSpan(s: Step, fallback: number): TraceSpan {
  const base = { id: s.id, raw: [JSON.stringify(s, null, 2)], children: [] as TraceSpan[] };
  switch (s.kind) {
    case 'message': {
      const who = s.role === 'agent' ? (s.from || '?') + ' → ' + (s.to || '?') : ROLE_LABEL[s.role];
      return { ...base, ...times(s.at, s.at, fallback), title: who + ' · ' + cut(s.text, 60), type: 'event', status: 'success', input: s.text, attributes: attrs([['role', s.role], ['from', s.from], ['to', s.to]]) };
    }
    case 'model': {
      const what = s.text ? cut(s.text, 60) : s.calls.length ? '请求 ' + s.calls.length + ' 个工具调用' : s.reasoning || s.reasoningHidden ? '思考' : '（无可见输出）';
      const u = s.usage;
      const span: TraceSpan = {
        ...base,
        ...times(s.at, s.endAt, fallback),
        title: (s.model || '模型') + ' · ' + what,
        type: 'llm_call',
        status: 'success',
        ...(s.text ? { output: s.text } : {}),
        attributes: attrs([['gen_ai.request.model', s.model], ['gen_ai.response.id', s.responseId], ['phase', s.phase], ['tool_calls', s.calls.length ? s.calls.join(', ') : undefined], ['tokens.total', u?.total], ['tokens.reasoning', u?.reasoning]]),
      };
      const usage = tokenUsage(s);
      if (usage) span.tokenUsage = usage;
      if (s.reasoning || s.reasoningHidden || (u?.reasoning || 0) > 0) span.reasoning = { content: s.reasoning || '', ...(u?.reasoning ? { tokens: u.reasoning } : {}) };
      return span;
    }
    case 'tool': {
      const t = times(s.at, s.endAt, fallback, s.durationMs);
      const span: TraceSpan = {
        ...base,
        ...t,
        title: s.name + ' · ' + cut(toolSummary(s), 70),
        type: (s.name === 'spawn_agent' ? 'create_agent' : s.family === 'web' ? 'retrieval' : 'tool_execution') as TraceSpanCategory,
        status: TOOL_STATUS[s.status],
        ...(s.input ? { input: s.input } : {}),
        ...(s.output ? { output: s.output } : {}),
        attributes: attrs([['gen_ai.tool.name', s.name], ['tool.family', s.family], ['gen_ai.tool.call.id', s.callId], ['exit_code', s.exitCode], ['duration_ms', s.durationMs], ['agents', s.agents?.join(', ')], ['error.message', s.status === 'error' ? toolError(s) : undefined]]),
        children: s.effects.map((e, i) => effectSpan(e, s.id, i, t.startTime)),
      };
      if (s.todos) span.todos = s.todos.map((x) => ({ title: x.title, status: x.status }));
      return span;
    }
    case 'event':
      return { ...base, ...times(s.at, s.at, fallback), title: EVENT_LABEL[s.name] + (s.text ? ' · ' + cut(s.text, 70) : ''), type: 'event', status: s.name === 'error' ? 'error' : s.name === 'aborted' ? 'warning' : 'success', ...(s.text ? { output: s.text } : {}), attributes: attrs([['event', s.name], ['ref', s.ref], ['error.message', s.name === 'error' ? s.text : undefined]]) };
  }
}

function turnSpan(t: Turn, fallback: number): TraceSpan {
  const start = ms(t.startedAt) ?? fallback;
  const children = t.steps.map((s) => stepSpan(s, start));
  let end = ms(t.endedAt) ?? start;
  for (const c of children) end = Math.max(end, c.endTime.getTime());
  const firstInput = t.steps.find((s): s is MessageStep => s.kind === 'message' && (s.role === 'user' || s.role === 'agent'));
  const final = [...t.steps].reverse().find((s): s is ModelStep => s.kind === 'model' && Boolean(s.text));
  const { steps: _steps, ...rest } = t;
  return {
    id: turnSpanId(t),
    // An inferred turn with no input holds what came before the first real turn: inherited context, instructions.
    title: t.inferred && !t.input ? '开场 · 继承的上下文和说明' : '第 ' + t.index + ' 轮' + (t.inferred ? '（推断）' : '') + (t.input ? ' · ' + cut(t.input, 50) : ''),
    type: 'chain_operation',
    status: TURN_STATUS[t.status],
    startTime: new Date(start),
    endTime: new Date(end),
    ...(firstInput ? { input: firstInput.text } : t.input ? { input: t.input } : {}),
    ...(final?.text ? { output: final.text } : t.output ? { output: t.output } : {}),
    attributes: attrs([['turn.id', t.id], ['status', t.status], ['error.message', t.status === 'failed' ? t.error : undefined], ['note', t.status === 'aborted' ? t.error : undefined], ['duration_ms', t.durationMs], ['first_token_ms', t.firstTokenMs], ['model', t.settings?.model], ['effort', t.settings?.effort], ['approval', t.settings?.approval], ['sandbox', t.settings?.sandbox], ['tokens.total', t.usage?.total]]),
    raw: [JSON.stringify(rest, null, 2)],
    children,
  };
}

export function toSpans(s: Session): TraceSpan[] {
  const start = ms(s.startedAt) ?? ms(s.turns[0]?.startedAt) ?? Date.now();
  const turns = s.turns.map((t) => turnSpan(t, start));
  let end = ms(s.updatedAt) ?? start;
  for (const t of turns) end = Math.max(end, t.endTime.getTime());
  const last = s.turns[s.turns.length - 1];
  const { turns: _turns, ...summary } = s;
  return [
    {
      id: SESSION_SPAN_ID,
      title: '整个会话 · ' + s.agent.name,
      type: 'agent_invocation',
      status: SESSION_STATUS[s.state.status],
      startTime: new Date(start),
      endTime: new Date(Math.max(end, start)),
      input: s.title,
      ...(last?.output ? { output: last.output } : {}),
      attributes: attrs([
        ['session.id', s.id],
        ['state', STATUS_LABEL[s.state.status] + (s.state.detail ? '：' + s.state.detail : '')],
        ['agent.role', s.agent.role],
        ['agent.path', s.agent.path],
        ['agent.originator', s.agent.originator],
        ['gen_ai.provider.name', s.agent.provider],
        ['gen_ai.request.model', s.agent.model],
        ['cwd', s.cwd],
        ['source.format', s.source.format],
        ['source.adapter', s.source.adapter],
        ['source.version', s.source.version],
        ['source.path', s.source.path],
        ['tokens.total', s.usage?.total],
        ['notes', s.notes.length ? s.notes.join('；') : undefined],
      ]),
      raw: [JSON.stringify(summary, null, 2)],
      children: turns,
    },
  ];
}

/** Child id -> parent id, for opening the path to a span. */
export function parentsOf(spans: TraceSpan[]): Map<string, string> {
  const out = new Map<string, string>();
  const walk = (list: TraceSpan[], parent?: string) => {
    for (const x of list) {
      if (parent) out.set(x.id, parent);
      if (x.children) walk(x.children, x.id);
    }
  };
  walk(spans);
  return out;
}

/** Ids to expand at first: the session, the last turn, and any turn that failed. */
export function initialExpanded(s: Session): string[] {
  const ids = [SESSION_SPAN_ID];
  s.turns.forEach((t, i) => {
    if (i === s.turns.length - 1 || t.status === 'failed') ids.push(turnSpanId(t));
  });
  return ids;
}
