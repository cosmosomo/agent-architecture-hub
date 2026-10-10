/**
 * Shared turn machinery for the source adapters (hub/SPEC.md 17). Both record
 * formats describe the same thing — turns that hold steps, one open model step
 * per model reply, tool calls paired with their outputs — so the lifecycle
 * lives here once: an adapter feeds it records and keeps only what is specific
 * to its source (which record opens a turn, what an output means).
 *
 * Fields are public on purpose: adapters reach for openTools (effect targeting)
 * and settings (turn context) the way the code they replaced did.
 */
import type { EventStep, Iso, MessageStep, ModelStep, Session, Step, ToolFamily, ToolStep, Turn, TurnSettings, Usage } from '@hub-trace/contract';
import { LIMITS, clean, msBetween, oneLine } from './text.ts';

export type TurnBuilderOptions = {
  /** A user message starts a new turn when the current one already has a model step. Default false. */
  userStartsTurn?: boolean;
  /** Any message closes the open model step first. Default false. */
  messageClosesModel?: boolean;
  /** A step outside any open turn opens an inferred (already completed) turn. Sources with their
   *  own turn markers leave this on; sources without them (Claude Code) open running turns. Default true. */
  turnForInferred?: boolean;
  /** How a finished tool call is judged; default is by effects and exit code. */
  settle?: (tool: ToolStep) => void;
};

export class TurnBuilder {
  readonly turns: Turn[] = [];
  readonly turnById = new Map<string, Turn>();
  cur: Turn | null = null;
  model: ModelStep | null = null;
  readonly openTools = new Map<string, ToolStep>();
  lastTool: ToolStep | null = null;
  lastInputAt: Iso | undefined;
  settings: TurnSettings = {};
  firstAt: Iso | undefined;
  lastAt: Iso | undefined;
  readonly unknown = new Map<string, number>();

  userStartsTurn: boolean;
  messageClosesModel: boolean;
  turnForInferred: boolean;
  private readonly settleFn: (tool: ToolStep) => void;

  private readonly usedIds = new Set<string>();
  private seq = 0;

  constructor(opts: TurnBuilderOptions = {}) {
    this.userStartsTurn = opts.userStartsTurn === true;
    this.messageClosesModel = opts.messageClosesModel === true;
    this.turnForInferred = opts.turnForInferred !== false;
    this.settleFn = opts.settle || defaultSettle;
  }

  note(key: string) {
    this.unknown.set(key, (this.unknown.get(key) || 0) + 1);
  }

  uid(base: string | undefined, prefix: string): string {
    let id = base && typeof base === 'string' ? base : prefix + ++this.seq;
    if (this.usedIds.has(id)) id = id + '#' + ++this.seq;
    this.usedIds.add(id);
    return id;
  }

  stamp(at: Iso | undefined) {
    if (!at) return;
    if (!this.firstAt || at < this.firstAt) this.firstAt = at;
    if (!this.lastAt || at > this.lastAt) this.lastAt = at;
  }

  openTurn(id: string | undefined, at: Iso | undefined, inferred = false): Turn {
    const t: Turn = {
      id: id || 't' + (this.turns.length + 1),
      index: this.turns.length + 1,
      status: inferred ? 'completed' : 'running',
      startedAt: at,
      steps: [],
      settings: { ...this.settings },
    };
    if (inferred) t.inferred = true;
    else this.lastInputAt = at;
    this.turns.push(t);
    this.turnById.set(t.id, t);
    this.cur = t;
    return t;
  }

  turnFor(at: Iso | undefined, turnId?: string): Turn {
    if (this.cur) return this.cur;
    if (turnId && this.turnById.has(turnId)) return this.turnById.get(turnId)!;
    return this.openTurn(turnId, at, this.turnForInferred);
  }

  push(t: Turn, s: Step) {
    t.steps.push(s);
    if (s.at && (!t.startedAt || s.at < t.startedAt)) t.startedAt = s.at;
    const end = s.endAt || s.at;
    if (t.inferred && end && (!t.endedAt || end > t.endedAt)) t.endedAt = end;
  }

  ensureModel(at: Iso | undefined, turnId?: string): ModelStep {
    if (this.model) return this.model;
    const t = this.turnFor(at, turnId);
    this.model = { kind: 'model', id: this.uid(undefined, 'm'), at: this.lastInputAt || at, calls: [] };
    if (t.settings?.model) this.model.model = t.settings.model;
    this.push(t, this.model);
    return this.model;
  }

  closeModel(at: Iso | undefined, usage?: Usage, responseId?: string) {
    const m = this.model;
    if (!m) return;
    if (at) m.endAt = at;
    if (usage && !m.usage) m.usage = usage;
    if (responseId) m.responseId = responseId;
    this.model = null;
  }

  settle(tool: ToolStep) {
    this.settleFn(tool);
  }

  closeTool(tool: ToolStep, at: Iso | undefined) {
    if (at) tool.endAt = at;
    if (tool.durationMs === undefined) tool.durationMs = msBetween(tool.at, at);
    if (tool.callId) this.openTools.delete(tool.callId);
    if (this.lastTool === tool) {
      const rest = Array.from(this.openTools.values());
      this.lastTool = rest.length ? rest[rest.length - 1] : null;
    }
  }

  closeTurn(t: Turn, at: Iso | undefined, status: Turn['status'], error?: string) {
    if (this.model && t.steps.includes(this.model)) this.closeModel(at);
    for (const tool of Array.from(this.openTools.values())) {
      if (!t.steps.includes(tool)) continue;
      if (status === 'completed') { this.settle(tool); tool.output = tool.output || '（来源里没有输出记录）'; }
      else { tool.status = 'error'; tool.output = tool.output || '（未完成：这一轮' + (status === 'aborted' ? '被打断' : '出错') + '）'; }
      this.closeTool(tool, at);
    }
    t.status = status;
    if (error) t.error = error;
    if (at) t.endedAt = at;
    if (t.durationMs === undefined) t.durationMs = msBetween(t.startedAt, t.endedAt);
    if (this.cur === t) this.cur = null;
  }

  addMessage(role: MessageStep['role'], text: string, at: Iso | undefined, id?: string, extra?: Partial<MessageStep>) {
    if (this.messageClosesModel) this.closeModel(undefined);
    if (role === 'user' && this.userStartsTurn && this.cur && this.cur.steps.some((s) => s.kind === 'model')) {
      this.closeTurn(this.cur, this.lastAt, 'completed');
    }
    const t = this.turnFor(at);
    const m: MessageStep = { kind: 'message', id: this.uid(id, 'msg'), at, role, text: clean(text), ...extra };
    this.push(t, m);
    if ((role === 'user' || role === 'agent') && !t.input) t.input = oneLine(text, 400);
    this.lastInputAt = at;
  }

  addEvent(name: EventStep['name'], at: Iso | undefined, text?: string, ref?: string) {
    const t = this.turnFor(at);
    const e: EventStep = { kind: 'event', id: this.uid(undefined, 'e'), at, name };
    if (text) e.text = text;
    if (ref) e.ref = ref;
    this.push(t, e);
  }

  addToolCall(p: { callId?: string; name: string; family: ToolFamily; input?: string; at?: Iso; turnId?: string }): ToolStep {
    const m = this.ensureModel(p.at, p.turnId);
    const tool: ToolStep = {
      kind: 'tool',
      id: this.uid(p.callId ? 'tool:' + p.callId : undefined, 'tool'),
      at: p.at,
      name: p.name,
      family: p.family,
      status: 'pending',
      effects: [],
    };
    if (p.callId) tool.callId = p.callId;
    if (p.input !== undefined) tool.input = clean(p.input, LIMITS.io);
    m.calls.push(tool.id);
    this.push(this.turnFor(p.at, p.turnId), tool);
    if (p.callId) this.openTools.set(p.callId, tool);
    this.lastTool = tool;
    return tool;
  }

  /** Pair an output with its call: finds the open tool by call id (or makes one for an
   *  orphan output), stores the text, closes it. Sources with their own success rules
   *  (exit codes) call settle() again on the returned tool afterwards. */
  addToolOutput(p: { callId?: string; name?: string; output: string; at?: Iso; isError?: boolean; turnId?: string }): ToolStep {
    this.closeModel(undefined);
    let tool = p.callId ? this.openTools.get(p.callId) : undefined;
    if (!tool) {
      tool = { kind: 'tool', id: this.uid(p.callId ? 'tool:' + p.callId + ':out' : undefined, 'tool'), at: p.at, name: p.name || 'tool', family: 'other', status: 'pending', effects: [] };
      if (p.callId) tool.callId = p.callId;
      this.push(this.turnFor(p.at, p.turnId), tool);
    }
    tool.output = clean(p.output, LIMITS.io);
    tool.status = p.isError ? 'error' : 'ok';
    this.closeTool(tool, p.at);
    this.lastInputAt = p.at;
    return tool;
  }

  /** Close what is still open at the end of the file; tools inside a still-running turn keep waiting. */
  finishPending() {
    if (this.model) this.closeModel(this.lastAt);
    for (const tool of Array.from(this.openTools.values())) {
      const t = this.turns.find((x) => x.steps.includes(tool));
      if (t && t.status === 'running') continue;
      this.settle(tool);
      this.closeTool(tool, tool.at);
    }
  }

  /** Fill each finished turn's output from its last model text; returns the folded stats fields. */
  fold(p: { preferFinalPhase?: boolean } = {}) {
    let firstUser = '';
    let firstAgent = '';
    let messages = 0;
    let modelCalls = 0;
    let toolCalls = 0;
    let toolErrors = 0;
    let compactions = 0;
    let durationTotal = 0;
    for (const t of this.turns) {
      if (t.durationMs) durationTotal += t.durationMs;
      for (const s of t.steps) {
        if (s.kind === 'message') {
          messages++;
          if (s.role === 'user' && !firstUser) firstUser = s.text;
          if (s.role === 'agent' && !firstAgent) firstAgent = s.text;
        } else if (s.kind === 'model') modelCalls++;
        else if (s.kind === 'tool') { toolCalls++; if (s.status === 'error') toolErrors++; }
        else if (s.kind === 'event' && s.name === 'compaction') compactions++;
      }
      if (!t.output) {
        const finals = t.steps.filter((s): s is ModelStep => s.kind === 'model' && Boolean(s.text));
        const f = p.preferFinalPhase ? (finals.find((s) => s.phase === 'final') || finals[finals.length - 1]) : finals[finals.length - 1];
        if (f?.text && t.status !== 'running') t.output = oneLine(f.text, 400);
      }
    }
    return { firstUser, firstAgent, messages, modelCalls, toolCalls, toolErrors, compactions, durationTotal };
  }

  notes(): string[] {
    return Array.from(this.unknown.entries()).sort((a, b) => b[1] - a[1]).map(([k, n]) => '未识别 ' + k + ' × ' + n);
  }
}

function defaultSettle(tool: ToolStep) {
  if (tool.effects.some((e) => e.status === 'error')) tool.status = 'error';
  else if (tool.exitCode !== undefined && tool.exitCode !== 0) tool.status = 'error';
  else tool.status = 'ok';
}

/** Title fallback both adapters end with: the first words of the session, else the project and date. */
export function titleFallback(parts: string[], cwd: string | undefined, startedAt: Iso | undefined, product: string): string {
  for (const p of parts) {
    const t = oneLine(p, 80);
    if (t) return t;
  }
  return (cwd ? basename(cwd) : product) + (startedAt ? ' · ' + startedAt.slice(0, 16).replace('T', ' ') : '');
}

export function basename(p: string): string {
  const parts = p.split(/[\\/]/);
  return parts[parts.length - 1] || p;
}
