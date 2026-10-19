/**
 * Types of the gateway (gateway.ts): products, runs, approvals, questions, dispatches, meta-agents.
 */

/** What one turn needs, whichever route runs it. */
export type RunOpts = {
  prof: ChannelProfile;
  sessionName: string;
  traceSessionId?: string;
  cwd: string;
  prompt: string;
  model: string;
  permissions: 'all' | 'reads' | 'deny';
  source: 'web' | 'cli';
  retryCount?: number;
  resumedByMeta?: string;
  originalPrompt?: string;
};
export type ChannelId = 'codex' | 'claude' | 'zcode' | 'workbuddy' | 'opencode' | 'antigravity' | 'hermes';

export type MetaAgentId = 'meta_approver' | 'meta_resumer' | 'meta_maint' | 'meta_auditor';

export type MetaAgentConfig = {
  id: MetaAgentId;
  name: string;
  role: string;
  badge: string;
  accent: string;
  enabled: boolean;
  policy?: 'all' | 'safe_write' | 'reads';
  maxRetries?: number;
  retryDelaySec?: number;
  maxConsecutiveErrors?: number;
  engineMode?: 'agent_brain' | 'local_rules';
  brainChannel?: ChannelId;
  brainModel?: string;
  brainSessionName?: string;
  patrolIntervalSec?: number;
  persona?: string;
  runtimeStatus?: 'standby' | 'patrolling' | 'thinking' | 'intervening' | 'fallback';
  lastPatrolAt?: string;
  lastBrainSessionId?: string;
  description: string;
  triggersCount: number;
  lastTriggeredAt?: string;
  lastAction?: string;
};

export type MetaAgentLogEntry = {
  id: string;
  metaId: MetaAgentId;
  metaName: string;
  channel: ChannelId;
  sessionName: string;
  action: string;
  detail: string;
  brainUsed?: string;
  brainTraceSessionId?: string;
  eventKind?: string;
  at: string;
};

export type ChannelCapabilities = {
  canCreateSession: boolean;
  canSendPrompt: boolean;
  canCancelRun: boolean;
  canSwitchModelOnNew: boolean;
  canSwitchModelMidSession: boolean;
  canSetPermissionMode: boolean;
  canReadExternalSessions: boolean;
};

export type ChannelProfile = {
  id: ChannelId;
  label: string;
  product: string;
  traceKind: string;
  /** How the backend runs a turn for this product: the `route` column of hub/data/products.json. */
  route: string;
  acpModes?: Partial<Record<'all' | 'reads' | 'deny', string>>;
  modes?: string[];
  maxConcurrent: number;
  acpxAgent: string;
  defaultModel: string;
  recommendedModels: string[];
  capabilities: ChannelCapabilities;
  accent: string;
  badge: string;
  buildEnv: () => Record<string, string>;
  notes: string;
};

export type LiveToolCall = {
  id: string;
  name: string;
  category: 'read' | 'edit' | 'shell' | 'search' | 'agent' | 'other';
  icon: string;
  summary: string;
  status: 'running' | 'ok' | 'error';
  input?: string;
  output?: string;
  startedAt: string;
  durationMs?: number;
};

export type QueuedPrompt = {
  id: string;
  prompt: string;
  model?: string;
  permissions: 'all' | 'reads' | 'deny';
  source: 'web' | 'cli';
  enqueuedAt: string;
};

export type ActiveRun = {
  runId: string;
  /** Reply text assembled from the NDJSON stream only (run.text is the longer of this and the session file). */
  streamText?: string;
  channel: ChannelId;
  channelId: ChannelId;
  sessionName: string;
  traceSessionId?: string;
  cwd: string;
  model: string;
  permissions: 'all' | 'reads' | 'deny';
  source: 'web' | 'cli';
  prompt: string;
  status: 'running' | 'cancelling' | 'completed' | 'failed' | 'aborted';
  startedAt: string;
  endedAt?: string;
  durationMs?: number;
  thoughts: string;
  text: string;
  tools: LiveToolCall[];
  error?: string;
  initialMsgCount?: number;
  retryCount?: number;
  resumedByMeta?: string;
  /** stopReason of this turn's own prompt result. It decides the outcome; errors from other requests do not. */
  stopReason?: string;
  /** Errors from other requests in the same stream (loading an old backend session, applying a model). */
  warnings?: string[];
  /** Tools the agent asked to use that the permission policy turned down during this turn. */
  deniedTools?: string[];
  /** Codex `_meta.codex.error` notices during the turn (upstream 5xx it retries on its own). */
  upstreamErrors?: number;
  /** True when `acpx sessions ensure` failed, so no prompt was sent. */
  setupFailed?: boolean;
  /** The tool named by a permission ask that has not been answered yet. */
  permissionAsk?: string;
  /** The user's own words for this turn. Automatic retries reuse them instead of wrapping the last retry prompt. */
  originalPrompt?: string;
  /** Codex app-server native threadId and active turnId. */
  codexThreadId?: string;
  codexTurnId?: string;
  /** Claude stream-json native sessionId. */
  claudeSessionId?: string;
  /** ACP session id when the turn runs on a resident ACP bridge (ZCode, WorkBuddy, OpenCode, Hermes). */
  acpSessionId?: string;
  /** Mid-turn steered instructions injected into the active turn. */
  steeredPrompts?: string[];
  /** Currently pending live in-turn approval ID, when the turn is suspended waiting for approval. */
  waitingApprovalId?: string;
  /** Pending question this turn is waiting on, when the agent asked a person something mid-turn. */
  waitingQuestionId?: string;
};

export type AcpxSessionInfo = {
  acpxRecordId: string;
  acpSessionId: string;
  sessionName: string;
  channel: ChannelId;
  channelId: ChannelId;
  cwd: string;
  title: string;
  closed: boolean;
  pid?: number | null;
  createdAt?: string;
  updatedAt?: string;
  turnCount: number;
  traceSessionId: string;
  currentModel?: string;
  availableModels?: string[];
  isDraft?: boolean;
  fromAcpxStore?: boolean;
  interrupted?: boolean;
  lastError?: string;
};

/** A question an agent asked a person in the middle of a turn; the turn waits for the answer (unit ask-user). */
export type PendingQuestion = {
  id: string;
  runId: string;
  channel: ChannelId;
  sessionName: string;
  traceSessionId?: string;
  /** choicesOnly: the answer must be one of the options (a question that came as a permission ask has no way to carry text). */
  questions: Array<{ id: string; header?: string; question: string; options: Array<{ label: string; description?: string }>; multiSelect?: boolean; choicesOnly?: boolean }>;
  createdAt: string;
  status: 'pending' | 'answered' | 'cancelled';
  answers?: Record<string, string[]>;
};

export type PendingApproval = {
  id: string;
  runId: string;
  channel: ChannelId;
  sessionName: string;
  traceSessionId?: string;
  cwd: string;
  model: string;
  prompt: string;
  toolName: string;
  toolInput?: string;
  reason: string;
  createdAt: string;
  status: 'pending' | 'approved' | 'rejected';
  /** True when the turn is suspended mid-turn waiting for live RPC/stdio approval. */
  inTurn?: boolean;
  /** 'in-turn' for live suspended turns; 'session-retry' for post-turn session-level retry. */
  mode?: 'in-turn' | 'session-retry';
};

export type ExternalSessionAnomaly = {
  id: string;
  channel: ChannelId;
  sessionName: string;
  traceSessionId: string;
  title: string;
  cwd: string;
  updatedAt: string;
  toolErrors: number;
  lastError: string;
};

export type DispatchReceiptState = 'issued' | 'delivered' | 'seen' | 'returned';
export type DispatchStatus = 'issued' | 'running' | 'yielded' | 'completed' | 'failed' | 'stalled' | 'cancelled';

export interface DispatchRecord {
  id: string;
  kind: 'spawn-subagent' | 'peer-message' | 'handoff';
  status: DispatchStatus;
  receipt: DispatchReceiptState;
  receipts: {
    issuedAt: string;
    deliveredAt?: string;
    seenAt?: string;
    returnedAt?: string;
  };
  from: {
    channel?: ChannelId;
    sessionName?: string;
    traceSessionId?: string;
  };
  to: {
    channel: ChannelId;
    sessionName: string;
    traceSessionId?: string;
    model?: string;
    cwd: string;
  };
  task: string;
  contextDigest?: string;
  depth: number;
  parentDispatchId?: string;
  targetRunId?: string;
  waitingFor?: string;
  progressReports: Array<{ at: string; text: string; via: 'cli' | 'web' }>;
  requests?: Array<{ at: string; text: string; status: 'pending' | 'resolved'; answer?: string }>;
  delivery?: {
    at: string;
    via: 'cli' | 'structured-output' | 'turn-end' | 'recovered';
    summary: string;
    reply: string;
    files: string[];
  };
  wake: {
    mode: 'auto-resume' | 'wait-poll' | 'none';
    state: 'none' | 'pending' | 'waking' | 'woken' | 'wake-failed';
    wokenRunId?: string;
    wokenAt?: string;
    error?: string;
  };
  error?: string;
  updatedAt: string;
}
