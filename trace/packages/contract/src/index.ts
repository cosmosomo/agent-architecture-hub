/**
 * Trace contract v0.1. Adapters produce it, the CLI serves it, the viewer and the
 * OpenTelemetry export read it; no module looks at another module's raw input.
 * Any field change bumps CONTRACT_VERSION. See hub/SPEC.md section 17.
 *
 * Token counts follow the OpenAI / OTel GenAI convention: `input` includes the
 * cached and cache-write parts, `output` includes `reasoning`.
 */

export const CONTRACT_VERSION = '0.1';

/** ISO 8601 timestamp. */
export type Iso = string;

/** One parsed session, as served by the CLI and written by exports. */
export type SessionDoc = {
  contract: string;
  session: Session;
};

/** The session list: summaries only, so thousands of sessions stay cheap. */
export type SessionIndex = {
  contract: string;
  generatedAt: Iso;
  sessions: SessionSummary[];
};

export type SessionSummary = Omit<Session, 'turns'>;

/** Where a session came from. `path` is a local file path and never leaves this machine. */
export type SourceRef = {
  /** Adapter kind: 'codex', later 'claude-code', ... */
  kind: string;
  /** Source format variant the adapter recognised, e.g. 'codex/envelope'. */
  format: string;
  /** Adapter id and version, e.g. 'codex@0.1.0'. */
  adapter: string;
  /** Version of the program that wrote the source, e.g. the Codex CLI version. */
  version?: string;
  path?: string;
  size?: number;
  mtimeMs?: number;
};

export type AgentRef = {
  /** Product that ran the agent: 'Codex', 'Claude Code', ... */
  product: string;
  /** Display name: the nickname of a sub-agent, otherwise the product. */
  name: string;
  role: 'main' | 'subagent';
  nickname?: string;
  /** Position in the agent tree, e.g. '/root/reviewer'. */
  path?: string;
  /** Client that started the session, e.g. a CLI or an editor extension. */
  originator?: string;
  provider?: string;
  /** Model of the latest turn. */
  model?: string;
};

export type SessionLink = {
  rel: 'parent' | 'child' | 'forked-from';
  /** Global session id (`kind:sourceId`). */
  id: string;
  label?: string;
};

export type SessionStatus =
  | 'working' // a turn is open and the source was written recently
  | 'waiting' // a turn is open and waits on something, e.g. sub-agents
  | 'idle' // the last turn finished; the agent waits for its next input
  | 'aborted' // the last turn was interrupted
  | 'failed' // the last turn ended with an error
  | 'stale' // a turn is open but the source has not changed for a while: the process probably ended
  | 'empty'; // no turn at all

export type SessionState = {
  status: SessionStatus;
  since?: Iso;
  detail?: string;
};

export type SessionStats = {
  turns: number;
  modelCalls: number;
  toolCalls: number;
  toolErrors: number;
  messages: number;
  compactions: number;
  /** Sub-agents this session started or talked to. */
  subagents: number;
  /** Sum of turn durations. */
  durationMs?: number;
  /** Source records read and records that could not be parsed. */
  records: number;
  skipped: number;
};

export type Usage = {
  input?: number;
  cachedInput?: number;
  cacheWrite?: number;
  output?: number;
  reasoning?: number;
  total?: number;
};

export type RateLimit = {
  name: string;
  usedPercent: number;
  windowMinutes?: number;
  resetsAt?: Iso;
};

export type Session = {
  /** Global id: `kind:sourceId`. */
  id: string;
  sourceId: string;
  source: SourceRef;
  title: string;
  agent: AgentRef;
  cwd?: string;
  startedAt?: Iso;
  /** Time of the latest record. */
  updatedAt?: Iso;
  links: SessionLink[];
  turns: Turn[];
  usage?: Usage;
  /** Provider rate limits as last reported: the state of the model channel. */
  limits?: RateLimit[];
  state: SessionState;
  stats: SessionStats;
  /** Parser notes, e.g. counts of record kinds it did not know. Never source content. */
  notes: string[];
};

export type TurnStatus = 'running' | 'completed' | 'aborted' | 'failed';

export type TurnSettings = {
  model?: string;
  effort?: string;
  approval?: string;
  sandbox?: string;
};

export type Turn = {
  id: string;
  /** 1-based. */
  index: number;
  /** True when the source has no turn markers and the adapter inferred the boundaries. */
  inferred?: boolean;
  status: TurnStatus;
  startedAt?: Iso;
  endedAt?: Iso;
  durationMs?: number;
  firstTokenMs?: number;
  error?: string;
  settings?: TurnSettings;
  /** What started the turn (a user or agent message), shortened. */
  input?: string;
  /** The final answer, shortened. */
  output?: string;
  steps: Step[];
  usage?: Usage;
};

export type Step = MessageStep | ModelStep | ToolStep | EventStep;
export type StepKind = Step['kind'];

type StepBase = {
  /** Unique within the session. */
  id: string;
  at?: Iso;
  endAt?: Iso;
};

/**
 * Something that went into the agent: a user message, a developer or context
 * message injected by the client, or a message from another agent.
 */
export type MessageStep = StepBase & {
  kind: 'message';
  role: 'user' | 'developer' | 'context' | 'agent';
  /** For agent messages: sender and recipient as the source names them. */
  from?: string;
  to?: string;
  text: string;
};

/** One model call: what the model thought and said, the tools it asked for, the tokens it used. */
export type ModelStep = StepBase & {
  kind: 'model';
  model?: string;
  responseId?: string;
  /** Reasoning summary, when the provider gives one. */
  reasoning?: string;
  /** The model reasoned but only an encrypted form was kept. */
  reasoningHidden?: boolean;
  /** Visible text. */
  text?: string;
  phase?: 'commentary' | 'final';
  /** Ids of the tool steps this call asked for. */
  calls: string[];
  usage?: Usage;
};

export type ToolFamily = 'shell' | 'patch' | 'mcp' | 'web' | 'agent' | 'plan' | 'image' | 'other';
export type ToolStatus = 'ok' | 'error' | 'pending';

export type ToolStep = StepBase & {
  kind: 'tool';
  /** Tool name as the agent saw it. */
  name: string;
  family: ToolFamily;
  callId?: string;
  input?: string;
  output?: string;
  status: ToolStatus;
  exitCode?: number;
  durationMs?: number;
  /** What the call did, as the source reported it: commands run, files changed, agents reached. */
  effects: Effect[];
  /** For plan updates: the task list after the call. */
  todos?: Todo[];
  /** Global ids of the sessions this call reached (sub-agents). */
  agents?: string[];
};

export type Effect = {
  kind: 'command' | 'file' | 'mcp' | 'subagent' | 'web' | 'image';
  label: string;
  status?: ToolStatus;
  exitCode?: number;
  durationMs?: number;
  detail?: string;
  /** A path, or a global session id for sub-agents. */
  ref?: string;
  /** Reported after the call had returned, e.g. a process that kept running; attached to the latest call of the matching kind. */
  late?: boolean;
};

export type Todo = {
  title: string;
  status: 'pending' | 'in_progress' | 'completed';
};

export type EventStep = StepBase & {
  kind: 'event';
  name: 'compaction' | 'aborted' | 'error' | 'goal' | 'subagent' | 'note';
  text?: string;
  /** A global session id for sub-agent events. */
  ref?: string;
};

export function sessionId(kind: string, sourceId: string): string {
  return kind + ':' + sourceId;
}

export function summarize(session: Session): SessionSummary {
  const { turns: _turns, ...rest } = session;
  return rest;
}

/** 0.x versions are compatible only with themselves. */
export function isCompatible(version: string): boolean {
  return version === CONTRACT_VERSION;
}

const SESSION_STATUS = new Set<SessionStatus>(['working', 'waiting', 'idle', 'aborted', 'failed', 'stale', 'empty']);
const TURN_STATUS = new Set<TurnStatus>(['running', 'completed', 'aborted', 'failed']);
const STEP_KINDS = new Set<StepKind>(['message', 'model', 'tool', 'event']);
const TOOL_STATUS = new Set<ToolStatus>(['ok', 'error', 'pending']);
const LINK_RELS = new Set<SessionLink['rel']>(['parent', 'child', 'forked-from']);

/** Structural check of a session document. Returns problems; an empty list means valid. */
export function validateSessionDoc(doc: unknown): string[] {
  const errs: string[] = [];
  const d = doc as SessionDoc;
  if (!d || typeof d !== 'object') return ['not an object'];
  if (!isCompatible(d.contract)) errs.push('contract version ' + String(d.contract) + ' is not ' + CONTRACT_VERSION);
  const s = d.session;
  if (!s || typeof s !== 'object') return errs.concat('no session');
  if (typeof s.id !== 'string' || s.id !== sessionId(s.source?.kind, s.sourceId)) errs.push('session id must be kind:sourceId');
  if (typeof s.title !== 'string') errs.push('title missing');
  if (!s.agent || typeof s.agent.product !== 'string' || typeof s.agent.name !== 'string') errs.push('agent missing');
  if (!SESSION_STATUS.has(s.state?.status)) errs.push('bad session status ' + String(s.state?.status));
  if (!Array.isArray(s.links) || s.links.some((l) => !LINK_RELS.has(l.rel) || typeof l.id !== 'string')) errs.push('bad links');
  if (!Array.isArray(s.notes)) errs.push('notes missing');
  if (!Array.isArray(s.turns)) return errs.concat('turns missing');
  const ids = new Set<string>();
  s.turns.forEach((t, i) => {
    if (t.index !== i + 1) errs.push('turn ' + t.id + ' has index ' + t.index + ', expected ' + (i + 1));
    if (!TURN_STATUS.has(t.status)) errs.push('turn ' + t.id + ' bad status ' + String(t.status));
    if (!Array.isArray(t.steps)) { errs.push('turn ' + t.id + ' has no steps'); return; }
    for (const st of t.steps) {
      if (!STEP_KINDS.has(st.kind)) errs.push('step ' + st.id + ' bad kind');
      if (ids.has(st.id)) errs.push('duplicate step id ' + st.id);
      ids.add(st.id);
      if (st.kind === 'tool' && (!TOOL_STATUS.has(st.status) || !Array.isArray(st.effects))) errs.push('tool step ' + st.id + ' malformed');
      if (st.kind === 'model' && !Array.isArray(st.calls)) errs.push('model step ' + st.id + ' has no calls list');
    }
  });
  for (const t of s.turns) for (const st of t.steps) {
    if (st.kind === 'model') for (const c of st.calls) if (!ids.has(c)) errs.push('model step ' + st.id + ' points at missing tool ' + c);
  }
  if (s.stats?.turns !== s.turns.length) errs.push('stats.turns does not match turns');
  return errs;
}

/**
 * Step search (the retrieval layer, hub/SPEC.md 17.4). Types only: the service builds
 * the index and answers, the viewer and the observatory ask. Kept here so both sides
 * read the same field names without importing the service's database code.
 */
export type SearchRequest = {
  /** Free text; several words all have to match one step. */
  q?: string;
  /** Facet keys as returned in `facets.kinds`: 'tool', 'tool:shell', 'message:user'. */
  kinds?: string[];
  errors?: boolean;
  /** Restrict to these session ids. */
  sessions?: string[];
  cwd?: string;
  role?: 'main' | 'subagent';
  since?: Iso;
  until?: Iso;
  limit?: number;
  offset?: number;
};

export type SearchHit = {
  session: string;
  turn: number;
  step: string;
  kind: StepKind;
  /** Message role, tool family or event name. */
  sub: string;
  /** Tool name or model, when the step has one. */
  name?: string;
  status?: string;
  at?: Iso;
  /** Text around the match, matches wrapped in \u0001 and \u0002. */
  snippet: string;
};

export type SearchResult = {
  total: number;
  hits: SearchHit[];
  facets: {
    /** Every step in scope before the kind and error filters: what the "全部" chip shows. */
    all: number;
    /** Steps per facet key, e.g. `tool:shell`, under the same scope. */
    kinds: Record<string, number>;
    errors: number;
    sessions: number;
    cwd: { cwd: string; n: number }[];
  };
  /** How far the index has got through the sessions on this machine. */
  indexing: { done: number; total: number; running: boolean };
  ms: number;
};
