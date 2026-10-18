import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import crypto from 'node:crypto';
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import type { ServerResponse } from 'node:http';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { Session, SessionSummary, Step, ToolFamily, ToolStep, Turn } from '@hub-trace/contract';
import { CodexAppServerDriver, type ApprovalDecision, type ServerApprovalRequest } from './drivers/codex_app_server.ts';
import { ClaudeStreamDriver, type ClaudeCanUseToolRequest, type ClaudeStreamSession } from './drivers/claude_stream.ts';
import { TaskBoard, type DispatchView } from './collab/taskboard.ts';
import { AcpResidentDriver, resolveAcpBridgeCommand, type AcpApprovalDecision, type AcpPermissionRequest } from './drivers/acp_runtime.ts';
import type { SessionStore } from './store.ts';

const HOME = homedir();

// Seconds acpx lets one turn run before killing it. Was hard-coded to 180, which killed any longer
// task started from the page (2026-10-17). Override with HUB_ACPX_TIMEOUT_SEC.
/** What one turn needs, whichever route runs it. */
type RunOpts = {
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
/** A resident ACP bridge with no turn for this long is closed; the next turn starts it again and reloads the session. */
const ACP_IDLE_MS = 15 * 60_000;
const ACPX_TURN_TIMEOUT_SEC = Number(process.env.HUB_ACPX_TIMEOUT_SEC) > 0 ? Number(process.env.HUB_ACPX_TIMEOUT_SEC) : 3600;

// The workbench opens an agent session in a folder, the same as opening the agent there yourself. A new
// session the user did not point at a folder gets a new empty one under this root; the hub's own repository
// is never the default (2026-10-18). Override with HUB_WORKSPACE_ROOT. The pages send NEW_CWD to ask for one.
const WORKSPACE_ROOT = process.env.HUB_WORKSPACE_ROOT || join(HOME, 'hub-workspaces');
export const NEW_CWD = '__new__';
const UPSTREAM_ERROR_REPLY = /unexpected status \d{3}|Service Unavailable|Bad Gateway|No available channel/i;

/**
 * Variables a Claude host (Claude Code, the Claude desktop app) puts into every process it starts. If the hub
 * runs inside such a host it would pass them on, and a Claude it launches then fails to log in ("Authentication
 * required") because the host's own ANTHROPIC_* are not meant for it (2026-10-18; agent-hub's runs.platform_env()
 * learnt the same). They are removed for every agent the hub starts.
 */
const HOST_ENV = /^(CLAUDECODE$|CLAUDE_|ANTHROPIC_)/;
function agentBaseEnv(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {};
  for (const [k, v] of Object.entries(process.env)) if (!HOST_ENV.test(k)) env[k] = v;
  return env;
}

/**
 * Claude Code keeps its relay address and token in ~/.claude/settings.json. They are read at launch and given
 * to this one process only, never written or logged. Loading the whole user settings instead
 * (ACPX_CLAUDE_INCLUDE_USER_SETTINGS=1) gave a canned, unrelated first reply on 2026-10-18 ("printed
 * HELLO_CHECK"); set HUB_CLAUDE_USER_SETTINGS=1 to go back to it.
 */
function claudeProviderEnv(): Record<string, string> {
  const env: Record<string, string> = { HTTP_PROXY: 'http://127.0.0.1:7892', HTTPS_PROXY: 'http://127.0.0.1:7892' };
  // Loading the whole user settings ("user" setting source) also loads ~/.claude/agents/*.md, and one description
  // there ("code execution") makes the relayed model answer every prompt with a sandbox self-test (HELLO_CHECK,
  // channels/probe/results/agy-pro-claude-settings-20261018.md). The global CLAUDE.md is appended to the system
  // prompt instead (claudeGlobalInstructions); memory and skills load without it. The provider variables below are
  // needed either way: returning early here used to drop them.
  if (process.env.HUB_CLAUDE_USER_SETTINGS === '1') env.ACPX_CLAUDE_INCLUDE_USER_SETTINGS = '1';
  try {
    const settings = JSON.parse(readFileSync(join(HOME, '.claude', 'settings.json'), 'utf8'));
    for (const [k, v] of Object.entries(settings?.env || {})) {
      if (/^ANTHROPIC_/.test(k) && typeof v === 'string') env[k] = v;
    }
  } catch {}
  return env;
}

/** The user's global instructions (~/.claude/CLAUDE.md), which a Claude session started here would otherwise miss. */
function claudeGlobalInstructions(): string {
  try {
    const text = readFileSync(join(HOME, '.claude', 'CLAUDE.md'), 'utf8').trim();
    return text ? '以下是用户的全局说明（~/.claude/CLAUDE.md），和用户直接说的话同等有效：\n\n' + text : '';
  } catch {
    return '';
  }
}

/**
 * acpx's own entry script, run with node directly: no cmd.exe in between, so arguments (a multi-line system prompt)
 * arrive whole. Without it the caller falls back to `cmd.exe /c acpx …`, which cuts an argument at a newline.
 */
const ACPX_CLI = join(process.env.APPDATA || join(HOME, 'AppData', 'Roaming'), 'npm', 'node_modules', 'acpx', 'dist', 'cli.js');

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
  acpxAgent: string;
  defaultModel: string;
  recommendedModels: string[];
  capabilities: ChannelCapabilities;
  accent: string;
  badge: string;
  buildEnv: () => Record<string, string>;
  notes: string;
};

/**
 * The products come from the product table, hub/data/products.json: the one list of products, shared with
 * hub/tools/agent_gateway.js. The backend drives the rows marked backend. Only Claude's provider variables stay
 * code (claudeProviderEnv, read at launch). The capability flags are not written here either: they follow the
 * unit → action table (hub/data/integration-map.json), where anything implemented counts, tested or not.
 */
const REPO_ROOT = resolve(import.meta.dirname, '..', '..', '..', '..');
type ProductRow = {
  id: string; name: string; label: string; aliases?: string[]; route: string; acpxAgent: string | null; backend: boolean;
  readKind: string | null; defaultModel: string | null; models: string[]; env?: Record<string, string>; envFrom?: string;
  accent: string; badge: string; notes: string;
  /** Resident ACP route: which of the agent's own modes each permission level maps to (ZCode: yolo / guarded / plan). */
  acpModes?: Partial<Record<'all' | 'reads' | 'deny', string>>;
  /** The agent's own working modes, for switching mid-session (session-control mode). */
  modes?: string[];
};
const PRODUCT_ROWS: ProductRow[] = JSON.parse(readFileSync(join(REPO_ROOT, 'hub', 'data', 'products.json'), 'utf8')).products;

function productEnv(p: ProductRow): Record<string, string> {
  const env = Object.fromEntries(Object.entries(p.env || {}).map(([k, v]) => [k, v.replaceAll('{HOME}', HOME)]));
  return p.envFrom === 'claude-settings' ? { ...env, ...claudeProviderEnv() } : env;
}

function unitFlags(id: string): ChannelCapabilities {
  let backend: Record<string, Array<{ channels?: string[]; status?: string }>> = {};
  try {
    backend = JSON.parse(readFileSync(join(REPO_ROOT, 'hub', 'data', 'integration-map.json'), 'utf8')).backend || {};
  } catch {}
  const has = (unit: string) => (backend[unit] || []).some((e) => (e.channels || []).includes(id) && e.status !== 'todo');
  return {
    canCreateSession: has('open'),
    canSendPrompt: has('open'),
    canCancelRun: has('cancel'),
    canSwitchModelOnNew: has('model-new'),
    canSwitchModelMidSession: has('model-switch'),
    canSetPermissionMode: has('mode-switch'),
    canReadExternalSessions: has('discover-sessions'),
  };
}

export const CHANNEL_PROFILES = Object.fromEntries(
  PRODUCT_ROWS.filter((p) => p.backend).map((p) => [
    p.id,
    {
      id: p.id as ChannelId,
      label: p.label,
      product: p.name,
      traceKind: p.readKind || p.id,
      route: p.route,
      acpModes: p.acpModes,
      modes: p.modes,
      acpxAgent: p.acpxAgent || p.aliases?.[0] || p.id,
      defaultModel: p.defaultModel || '',
      recommendedModels: p.models,
      get capabilities() {
        return unitFlags(p.id);
      },
      accent: p.accent,
      badge: p.badge,
      buildEnv: () => productEnv(p),
      notes: p.notes,
    } satisfies ChannelProfile,
  ]),
) as Record<ChannelId, ChannelProfile>;

export function resolveChannel(raw?: string | null): ChannelProfile | null {
  if (!raw) return null;
  const k = raw.trim().toLowerCase();
  if (k === 'claude-code') return CHANNEL_PROFILES.claude;
  if (k === 'codebuddy' || k === 'workbuddy') return CHANNEL_PROFILES.workbuddy;
  if (k === 'agy' || k === 'antigravity') return CHANNEL_PROFILES.antigravity;
  if (k === 'hermes' || k === 'hermes-agent') return CHANNEL_PROFILES.hermes;
  if (k in CHANNEL_PROFILES) return CHANNEL_PROFILES[k as ChannelId];
  return null;
}

export function detectChannelFromCommand(cmd: string): ChannelId {
  const s = (cmd || '').toLowerCase();
  if (s.includes('antigravity') || s.includes('language_server') || s === 'agy') return 'antigravity';
  if (s.includes('hermes')) return 'hermes';
  if (s.includes('claude')) return 'claude';
  if (s.includes('zcode')) return 'zcode';
  if (s.includes('codebuddy') || s.includes('workbuddy')) return 'workbuddy';
  if (s.includes('opencode')) return 'opencode';
  return 'codex';
}

export function normalizeAgyCliModel(raw?: string | null): 'flash_lite' | 'flash' | 'pro' {
  const m = String(raw || '').trim().toLowerCase();
  if (!m) return 'pro';
  if (m === 'flash_lite' || m.includes('flash-low') || m.includes('lite')) return 'flash_lite';
  if (m === 'flash' || m.includes('flash') || m.includes('argon-low')) return 'flash';
  return 'pro';
}

/**
 * Since AGY 2.23.1 `agentapi new-conversation` fails with "project_id is required" unless
 * ANTIGRAVITY_PROJECT_ID is set (the sidecar SDK passes it the same way). Pick the registered
 * project in ~/.gemini/config/projects whose folder contains cwd (longest match), else
 * "outside-of-project".
 */
export function resolveAgyProjectId(cwd: string): string {
  if (process.env.ANTIGRAVITY_PROJECT_ID) return process.env.ANTIGRAVITY_PROJECT_ID;
  const norm = (p: string) => p.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
  const target = norm(resolve(cwd));
  const dir = join(HOME, '.gemini', 'config', 'projects');
  let best = { id: 'outside-of-project', len: 0 };
  let files: string[] = [];
  try {
    files = readdirSync(dir).filter((f) => f.endsWith('.json'));
  } catch {}
  for (const f of files) {
    let proj: any;
    try {
      proj = JSON.parse(readFileSync(join(dir, f), 'utf8'));
    } catch {
      continue;
    }
    for (const r of proj?.projectResources?.resources || []) {
      const uri: string | undefined = r?.folderUri || r?.gitFolder?.folderUri;
      if (!uri) continue;
      const folder = norm(decodeURIComponent(uri.replace(/^file:\/\/\//, '')));
      if ((target === folder || target.startsWith(folder + '/')) && folder.length > best.len) {
        best = { id: proj.id, len: folder.length };
      }
    }
  }
  return best.id;
}

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

function isSmokeTestPrompt(text: string): boolean {
  const t = String(text || '').trim();
  return (
    /PONG-(CODEX|CLAUDE|ZCODE|WB|OPENCODE)/i.test(t) ||
    /GATEWAY-(ZCODE|WB)-/i.test(t) ||
    /LIVE-WEB-GW-OK/i.test(t) ||
    /刚才让你记住的(秘密口令|暗语)是什么/i.test(t) ||
    /把刚才你的第一句回复重复一遍.*-TURN2/i.test(t) ||
    /should_be_denied\.txt/i.test(t) ||
    /尝试读取 README\.md 的第一行；如果权限被拒绝/i.test(t)
  );
}

function classifyTool(name: string, inputStr = ''): {
  category: LiveToolCall['category'];
  icon: string;
  family: ToolFamily;
  summary: string;
} {
  const n = (name || '').toLowerCase();
  let summary = name || 'tool';
  let parsed: Record<string, any> | null = null;
  if (inputStr) {
    try {
      parsed = JSON.parse(inputStr);
    } catch {
      parsed = null;
    }
  }
  const argHint =
    parsed?.command ||
    parsed?.cmd ||
    parsed?.file_path ||
    parsed?.path ||
    parsed?.pattern ||
    parsed?.query ||
    (typeof inputStr === 'string' && inputStr.length < 120 ? inputStr : '');

  if (/^(read|view|cat|get_file)/i.test(n) || n.includes('read_file') || n.startsWith('read:')) {
    return {
      category: 'read',
      icon: '📖',
      family: 'other',
      summary: n.startsWith('read:') ? name : `Read ${argHint || name}`.slice(0, 100),
    };
  }
  if (/^(write|edit|patch|apply_patch|replace|multi_edit)/i.test(n) || n.startsWith('write:') || n.startsWith('edit:')) {
    return {
      category: 'edit',
      icon: '✏️',
      family: 'patch',
      summary: n.startsWith('write:') || n.startsWith('edit:') ? name : `Edit ${argHint || name}`.slice(0, 100),
    };
  }
  if (/^(bash|sh|exec|shell|run_command|powershell|cmd|terminal)/i.test(n) || n.includes('exec')) {
    return {
      category: 'shell',
      icon: '💻',
      family: 'shell',
      summary: `Shell: ${argHint || name}`.slice(0, 110),
    };
  }
  if (/^(grep|search|glob|find|web_search|fetch)/i.test(n)) {
    return {
      category: 'search',
      icon: '🔍',
      family: 'web',
      summary: `Search: ${argHint || name}`.slice(0, 100),
    };
  }
  if (/^(spawn|delegate|subagent|task|agent)/i.test(n)) {
    return {
      category: 'agent',
      icon: '🤖',
      family: 'agent',
      summary: `Subagent: ${argHint || name}`.slice(0, 100),
    };
  }
  return {
    category: 'other',
    icon: '🔧',
    family: 'other',
    summary: argHint ? `${name} · ${String(argHint).slice(0, 80)}` : name,
  };
}

function quoteWinArg(a: string): string {
  const s = String(a);
  if (!/[\s"&|<>^()]/.test(s)) return s;
  return '"' + s.replace(/"/g, '\\"') + '"';
}

export const DEFAULT_SUPERVISOR_PERSONA =
  '你是智能体控制室的元智能体，负责系统的巡检和维护。先核对事实，再安排工作；不夸大战果，客观严谨。语言简短清晰，明确谁接手、接什么、故障根因与下一步维护动作。';

export const DEFAULT_META_AGENTS: Record<MetaAgentId, MetaAgentConfig> = {
  meta_approver: {
    id: 'meta_approver',
    name: '自动批准与代理审批督导',
    role: 'Auto-Approval & Proxy Gate Meta-Agent',
    badge: '自动批准',
    accent: '#10B981',
    enabled: false, // off by default: tools run read-only unless the user widens it (2026-10-17)
    policy: 'reads',
    engineMode: 'agent_brain',
    brainChannel: 'zcode',
    brainModel: 'builtin:bigmodel-coding-plan\\GLM-5.3-Flash',
    brainSessionName: 'meta-brain-supervisor',
    patrolIntervalSec: 15,
    persona: DEFAULT_SUPERVISOR_PERSONA,
    runtimeStatus: 'standby',
    description:
      '自动放行安全工具读写与命令调用（--approve-all），并在无人值守时由元智能体的诊断会话代理常规门禁审批，高危操作升级人类',
    triggersCount: 0,
  },
  meta_resumer: {
    id: 'meta_resumer',
    name: '断网与Bug续跑督导',
    role: 'Auto-Resume & Self-Heal Meta-Agent',
    badge: '🔄 断网/Bug续跑',
    accent: '#38BDF8',
    enabled: true,
    maxRetries: 2,
    retryDelaySec: 2,
    engineMode: 'agent_brain',
    brainChannel: 'zcode',
    brainModel: 'builtin:bigmodel-coding-plan\\GLM-5.3-Flash',
    brainSessionName: 'meta-brain-supervisor',
    patrolIntervalSec: 15,
    persona: DEFAULT_SUPERVISOR_PERSONA,
    runtimeStatus: 'standby',
    description:
      '后台用不调模型的规则巡检断网超时、进程异常退出、空转报错或流中断，特殊事件触发元智能体的诊断会话裁决并自动注入断点上下文续跑',
    triggersCount: 0,
  },
  meta_maint: {
    id: 'meta_maint',
    name: '渠道熔断与模型容灾督导',
    role: 'Circuit-Breaker & Model Failover Meta-Agent',
    badge: '渠道容灾',
    accent: '#F59E0B',
    enabled: true,
    engineMode: 'agent_brain',
    brainChannel: 'zcode',
    brainModel: 'builtin:bigmodel-coding-plan\\GLM-5.3-Flash',
    brainSessionName: 'meta-brain-supervisor',
    patrolIntervalSec: 15,
    persona: DEFAULT_SUPERVISOR_PERSONA,
    runtimeStatus: 'standby',
    description:
      '监测七个产品的渠道健康、连续报错熔断、配额耗尽（429/Quota）与模型拒绝，自动换到同一产品已验证的备选模型',
    triggersCount: 0,
  },
  meta_auditor: {
    id: 'meta_auditor',
    name: '看门狗去噪与防死循环督导',
    role: 'Watchdog & Loop Guard Meta-Agent',
    badge: '🧭 防死循环',
    accent: '#A78BFA',
    enabled: true,
    maxConsecutiveErrors: 3,
    engineMode: 'agent_brain',
    brainChannel: 'zcode',
    brainModel: 'builtin:bigmodel-coding-plan\\GLM-5.3-Flash',
    brainSessionName: 'meta-brain-supervisor',
    patrolIntervalSec: 15,
    persona: DEFAULT_SUPERVISOR_PERSONA,
    runtimeStatus: 'standby',
    description:
      '过滤 stderr 诊断噪音（防假活跃死循环），监控连续重复工具报错与僵死进程，发现异常时叫诊断会话注入纠偏提示或安全中断',
    triggersCount: 0,
  },
};

function stripUserRequestTags(raw: string): string {
  const s = String(raw || '').trim();
  const m = /<USER_REQUEST>\s*([\s\S]*?)\s*<\/USER_REQUEST>/i.exec(s);
  if (m) return m[1].trim();
  if (s.startsWith('<CONTEXT_SUMMARY>')) {
    const tail = s.split('</CONTEXT_SUMMARY>').pop()?.trim() || '';
    const m2 = /<USER_REQUEST>\s*([\s\S]*?)\s*<\/USER_REQUEST>/i.exec(tail);
    if (m2) return m2[1].trim();
    return tail || '[上下文压缩检查点]';
  }
  return s;
}

function stripWorkbuddyUserText(raw: string): string {
  const s = String(raw || '').trim();
  const q = /<user_query>\s*([\s\S]*?)\s*<\/user_query>/i.exec(s);
  if (q) return q[1].trim();
  return s.replace(/<system-reminder[\s\S]*?<\/system-reminder>/gi, '').trim() || s;
}

// The title Antigravity shows in its own window. Probe and named sessions keep their name (people and tests look
// them up by it); a task started from the pages gets the first line of what was asked, so it is recognisable.
function agyTitle(sessionName: string, prompt: string): string {
  if (!/^m-/.test(sessionName)) return sessionName;
  const line = String(prompt).split(/\r?\n/).map((l) => l.replace(/^[#>*\s-]+/, '').trim()).find(Boolean) || sessionName;
  return line.length > 40 ? line.slice(0, 40) + '…' : line;
}

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

const MAX_DISPATCH_DEPTH = 3;

export class AgentGatewayHub {
  private readonly repoRoot: string;
  private readonly store: SessionStore;
  private readonly acpxDir = join(HOME, '.acpx', 'sessions');
  private readonly agyMapFile = join(HOME, '.acpx', 'agy-sessions.json');
  private readonly agyBrainDir = join(HOME, '.gemini', 'antigravity', 'brain');
  private readonly wbDir = join(HOME, '.workbuddy');
  private readonly hermesDir = join(HOME, 'AppData', 'Local', 'hermes');
  private readonly metaAgentsFile = join(HOME, '.acpx', 'hub-meta-agents.json');
  private readonly dispatchesDir = join(HOME, '.agent-hub', 'dispatches');
  /**
   * The "一群会话" level (collab/taskboard.ts): goals made of tasks. It dispatches through dispatchTask below and
   * hears back from saveDispatch; the page and agent_gateway.js reach it under /api/gateway/goals and /tasks.
   */
  readonly taskboard = new TaskBoard({
    dispatch: async (p) => (await this.dispatchTask({ kind: 'spawn-subagent', ...p })).dispatch as DispatchView,
    changed: (g) => this.broadcast('goal_update', { id: g.id, status: g.status, reason: g.reason }),
  });
  private readonly eventsFile: string;
  private readonly clients = new Set<ServerResponse>();
  private readonly activeRuns = new Map<string, ActiveRun>();
  private readonly activeProcs = new Map<string, ChildProcess>();
  private readonly queues = new Map<string, QueuedPrompt[]>();
  private readonly draftSessions = new Map<string, AcpxSessionInfo>();
  private readonly selectedModels = new Map<string, string>();
  private readonly selectedCwds = new Map<string, string>();
  private readonly channelFailures = new Map<
    ChannelId,
    {
      started: number;
      delivered: number;
      failed: number;
      consecutiveFailures: number;
      state: 'closed' | 'open' | 'probing';
      openedAt?: string;
      lastAt: number;
      lastError?: string;
    }
  >();
  private readonly recentRuns: ActiveRun[] = [];
  /** Image blocks waiting for the acpx prompt whose text is the key (set in sendPrompt, taken in startRunInternal). */
  private readonly promptImages = new Map<string, Array<{ type: 'image'; mimeType: string; data: string }>>();
  private readonly runWaiters = new Map<string, Array<(r: ActiveRun) => void>>();
  private readonly dispatches = new Map<string, DispatchRecord>();
  private readonly dispatchWaiters = new Map<string, Array<(d: DispatchRecord) => void>>();
  private readonly wakingCallers = new Set<string>();
  private readonly pendingApprovals: PendingApproval[] = [];
  private readonly liveApprovalResolvers = new Map<
    string,
    { runId: string; channel: ChannelId; resolve: (allow: boolean) => void }
  >();
  private codexDriver: CodexAppServerDriver | null = null;
  private codexDriverStarting: Promise<CodexAppServerDriver> | null = null;
  private claudeDriver: ClaudeStreamDriver | null = null;
  private readonly activeCodexRunsByThread = new Map<string, ActiveRun>();
  private readonly activeClaudeRunsBySession = new Map<string, ActiveRun>();
  /** Resident ACP bridges, one per "<product>|<folder>", and which run is on which ACP session right now. */
  private readonly acpDrivers = new Map<string, AcpResidentDriver>();
  private readonly activeAcpRunsBySession = new Map<string, ActiveRun>();
  private acpIdleTimer: ReturnType<typeof setInterval> | null = null;
  /** A mode the person set on an ACP session (session-control mode); it wins over the per-turn permission mapping. */
  private readonly acpPinnedModes = new Map<string, string>();
  /** Codex reasoning effort per session slot (session-control effort); turns default to low. */
  private readonly codexEfforts = new Map<string, string>();
  private externalAnomalies: ExternalSessionAnomaly[] = [];
  private readonly metaAgents = new Map<MetaAgentId, MetaAgentConfig>();
  private readonly metaAgentLogs: MetaAgentLogEntry[] = [];
  private patrolTimer: ReturnType<typeof setInterval> | null = null;
  private lastPatrolTickMs = 0;
  private patrolListCache: { at: number; list: AcpxSessionInfo[] } | null = null;
  private agyListCache: { at: number; list: AcpxSessionInfo[] } | null = null;
  private wbListCache: { at: number; list: AcpxSessionInfo[] } | null = null;
  private readonly acpxJsonCache = new Map<string, { mtimeMs: number; raw: any }>();
  private patrolTicksCount = 0;
  private readonly healedIncidents = new Set<string>();
  private readonly agySummaryCache = new Map<
    string,
    { mtimeMs: number; info: AcpxSessionInfo; contract: Session }
  >();
  private readonly wbSummaryCache = new Map<
    string,
    { mtimeMs: number; info: AcpxSessionInfo; contract: Session }
  >();
  private hermesCache: {
    at: number;
    sessions: Map<string, { info: AcpxSessionInfo; contract: Session }>;
  } | null = null;
  private agyLsCache: {
    at: number;
    bin: string;
    csrf: string;
    port: string;
    address: string;
    env: Record<string, string>;
  } | null = null;

  constructor(repoRoot: string, store: SessionStore) {
    this.repoRoot = repoRoot;
    this.store = store;
    this.eventsFile = join(repoRoot, 'channels', 'events.jsonl');
    this.loadMetaAgents();
    this.loadRecentRuns();
    this.loadDispatches();
    this.startMetaPatrolLoop();
    // Dispatches that ended while the service was down, then the board's own steps (budget, stall, unblock).
    for (const d of this.dispatches.values()) this.taskboard.onDispatch(d);
    setInterval(() => void this.taskboard.step(), 15_000).unref?.();
    void this.taskboard.step();
  }

  // Finished runs go to ~/.agent-hub/runs.jsonl so `agent_gateway.js read`/`wait` and the pages still have the
  // last result of a session after this service restarts. Tool calls are kept as names and status only.
  private readonly runsFile = join(homedir(), '.agent-hub', 'runs.jsonl');

  private rememberRun(run: ActiveRun) {
    this.recentRuns.unshift(run);
    if (this.recentRuns.length > 200) this.recentRuns.pop();
    try {
      mkdirSync(join(homedir(), '.agent-hub'), { recursive: true });
      const tools = (run.tools || []).map((t) => ({ ...t, input: undefined, output: undefined }));
      appendFileSync(this.runsFile, JSON.stringify({ ...run, tools }) + '\n', 'utf8');
    } catch {}
  }

  private loadRecentRuns() {
    try {
      const lines = readFileSync(this.runsFile, 'utf8').split(/\r?\n/).filter(Boolean).slice(-200);
      for (const line of lines.reverse()) {
        try {
          this.recentRuns.push(JSON.parse(line) as ActiveRun);
        } catch {}
      }
    } catch {}
  }

  private saveDispatch(d: DispatchRecord, broadcastUpdate = true) {
    d.updatedAt = new Date().toISOString();
    this.dispatches.set(d.id, d);
    try {
      mkdirSync(this.dispatchesDir, { recursive: true });
      const finalPath = join(this.dispatchesDir, `${d.id}.json`);
      const tmpPath = join(this.dispatchesDir, `${d.id}.json.tmp`);
      const content = JSON.stringify(d, null, 2);
      writeFileSync(tmpPath, content, 'utf8');
      try {
        renameSync(tmpPath, finalPath);
      } catch {
        writeFileSync(finalPath, content, 'utf8');
      }
    } catch {}
    if (broadcastUpdate) {
      this.broadcast('dispatch_update', d);
      this.broadcast('state', this.getState());
    }
    this.taskboard.onDispatch(d);
  }

  private resolveDispatchWaiters(d: DispatchRecord) {
    const waiters = this.dispatchWaiters.get(d.id);
    if (waiters && waiters.length > 0) {
      this.dispatchWaiters.delete(d.id);
      for (const fn of waiters) {
        try {
          fn(d);
        } catch {}
      }
    }
  }

  private loadDispatches() {
    try {
      if (!existsSync(this.dispatchesDir)) return;
      const files = readdirSync(this.dispatchesDir).filter((f) => f.endsWith('.json'));
      const loaded: DispatchRecord[] = [];
      for (const f of files) {
        try {
          const raw = JSON.parse(readFileSync(join(this.dispatchesDir, f), 'utf8')) as DispatchRecord;
          if (raw && raw.id && raw.to?.channel) {
            loaded.push(raw);
          }
        } catch {}
      }
      loaded.sort((a, b) => String(b.receipts?.issuedAt || '').localeCompare(String(a.receipts?.issuedAt || '')));
      for (const d of loaded) {
        this.dispatches.set(d.id, d);
      }
      setTimeout(() => {
        try {
          this.reconcileDispatches(true);
        } catch {}
      }, 1200);
    } catch {}
  }

  private extractFilesFromText(text: string): string[] {
    const out = new Set<string>();
    const re = /(?:[A-Za-z]:[\\/][^\s"'`<>|()[\]{}，。；：！？]+|(?:channels|hub|trace)[\\/][^\s"'`<>|()[\]{}，。；：！？]+)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      out.add(m[0].replace(/[.,;:!?)]+$/, ''));
      if (out.size >= 12) break;
    }
    return Array.from(out);
  }

  /**
   * Reconcile in-flight dispatches and pending wakes (runs on `:8899` startup and periodic patrol):
   * - If a target session finished while `:8899` was restarting, harvests its latest turn output (`via: 'recovered'`).
   * - If a running dispatch has no active process and exceeded stall timeout, marks it `stalled` and wakes caller (`wake-stall`).
   * - If a dispatch has `wake.state === 'pending'` (or was interrupted in `'waking'`), resumes waking the caller (`wake-persist`).
   */
  public reconcileDispatches(isStartup = false) {
    const nowMs = Date.now();
    const nowIso = new Date(nowMs).toISOString();
    for (const d of this.dispatches.values()) {
      if (isStartup && d.wake.state === 'waking') {
        d.wake.state = 'pending';
        this.saveDispatch(d, false);
      }
      if (d.status === 'running' || d.status === 'issued') {
        const slot = this.slotKey(d.to.channel, d.to.sessionName);
        const liveRun = this.activeRuns.get(slot);
        if (liveRun && liveRun.status === 'running') continue;

        const issuedMs = Date.parse(d.receipts.issuedAt) || 0;
        if (!isStartup && nowMs - issuedMs < 5000) continue;

        // 1. Check recentRuns first
        const matchedRun = this.recentRuns.find(
          (r) =>
            (d.targetRunId && r.runId === d.targetRunId) ||
            (r.channel === d.to.channel &&
              r.sessionName === d.to.sessionName &&
              Date.parse(r.startedAt) >= issuedMs - 2000),
        );
        if (matchedRun && matchedRun.status !== 'running') {
          this.harvestRunIntoDispatch(d, matchedRun.text || '', matchedRun.error, matchedRun.status === 'failed', isStartup ? 'recovered' : 'turn-end', matchedRun.startedAt, matchedRun.traceSessionId);
          continue;
        }

        // 2. Check target session's native/acpx transcript on disk
        const contract =
          (d.to.traceSessionId && this.getAcpxSessionAsContract(d.to.traceSessionId)) ||
          this.getAcpxSessionAsContract(d.to.sessionName);
        if (contract && contract.turns.length > 0) {
          const lastTurn = contract.turns[contract.turns.length - 1];
          const turnEndedMs = lastTurn.endedAt ? Date.parse(lastTurn.endedAt) : lastTurn.startedAt ? Date.parse(lastTurn.startedAt) : 0;
          if (lastTurn.output && (turnEndedMs >= issuedMs - 2000 || isStartup)) {
            if (!d.to.traceSessionId && contract.id) d.to.traceSessionId = contract.id;
            this.harvestRunIntoDispatch(
              d,
              lastTurn.output,
              lastTurn.error,
              lastTurn.status === 'failed',
              'recovered',
              lastTurn.startedAt || nowIso,
              contract.id,
            );
            continue;
          }
        }

        // 3. Stall detection (`wake-stall`): if no live run and > 10 minutes elapsed
        if (issuedMs > 0 && nowMs - issuedMs > 10 * 60 * 1000) {
          d.status = 'stalled';
          d.error = '目标会话超过 10 分钟无运行进程且未交回结果 (stalled)';
          d.receipt = 'returned';
          d.receipts.returnedAt = nowIso;
          d.delivery = {
            at: nowIso,
            via: 'recovered',
            summary: d.error,
            reply: '',
            files: [],
          };
          this.saveDispatch(d);
          this.resolveDispatchWaiters(d);
          this.wakeCallerIfNeeded(d);
        }
      } else if (d.wake.mode === 'auto-resume' && d.wake.state === 'pending' && d.from.channel && d.from.sessionName) {
        this.processCallerWakes(d.from.channel, d.from.sessionName).catch(() => {});
      }
    }
  }

  private harvestRunIntoDispatch(
    d: DispatchRecord,
    rawText: string,
    rawErr: string | undefined,
    isFailed: boolean,
    fallbackVia: 'turn-end' | 'recovered',
    seenFallbackIso: string,
    traceSessionId?: string,
  ) {
    const nowIso = new Date().toISOString();
    if (traceSessionId && !traceSessionId.startsWith('new:')) {
      d.to.traceSessionId = traceSessionId;
    }
    if (!d.receipts.deliveredAt) d.receipts.deliveredAt = seenFallbackIso || nowIso;
    if (!d.receipts.seenAt && (rawText || !isFailed)) d.receipts.seenAt = seenFallbackIso || nowIso;
    if (d.receipt === 'returned' && d.delivery?.via === 'cli') {
      // Target already explicitly called `deliver` via CLI during the turn; just ensure wake & waiters fire
      this.saveDispatch(d);
      this.resolveDispatchWaiters(d);
      this.wakeCallerIfNeeded(d);
      return;
    }

    const text = String(rawText || '').trim();
    const files = this.extractFilesFromText(text);
    const yieldMatch = /【让出[:：]\s*([^】]+)】/.exec(text);
    const deliverMatch = /【交回[:：]?\s*([\s\S]*?)】|【交回】\s*([\s\S]*)$/.exec(text);

    if (yieldMatch) {
      d.status = 'yielded';
      d.waitingFor = yieldMatch[1].trim();
      d.receipt = 'returned';
      d.receipts.returnedAt = nowIso;
      d.delivery = {
        at: nowIso,
        via: 'structured-output',
        summary: `让出等待：${d.waitingFor}`,
        reply: text,
        files,
      };
    } else if (deliverMatch) {
      const extracted = (deliverMatch[1] || deliverMatch[2] || text).trim();
      d.status = isFailed && !text ? 'failed' : 'completed';
      d.waitingFor = undefined;
      d.receipt = 'returned';
      d.receipts.returnedAt = nowIso;
      d.delivery = {
        at: nowIso,
        via: 'structured-output',
        summary: extracted.slice(0, 300) || text.slice(0, 300),
        reply: text,
        files,
      };
    } else {
      d.status = isFailed && !text ? 'failed' : 'completed';
      d.waitingFor = undefined;
      if (isFailed && rawErr) d.error = rawErr;
      d.receipt = 'returned';
      d.receipts.returnedAt = nowIso;
      d.delivery = {
        at: nowIso,
        via: fallbackVia,
        summary: (text || rawErr || '目标轮次已结束').replace(/\s+/g, ' ').slice(0, 300),
        reply: text,
        files,
      };
    }

    this.saveDispatch(d);
    this.resolveDispatchWaiters(d);
    this.wakeCallerIfNeeded(d);
  }

  private markRunSeenByDispatch(run: ActiveRun) {
    const nowIso = new Date().toISOString();
    for (const d of this.dispatches.values()) {
      if (d.status !== 'running' && d.status !== 'issued') continue;
      const matchById = d.targetRunId && d.targetRunId === run.runId;
      const matchBySlot = !d.targetRunId && d.to.channel === run.channel && d.to.sessionName === run.sessionName;
      if (!matchById && !matchBySlot) continue;
      let changed = false;
      if (!d.targetRunId) {
        d.targetRunId = run.runId;
        changed = true;
      }
      if (run.traceSessionId && !run.traceSessionId.startsWith('new:') && d.to.traceSessionId !== run.traceSessionId) {
        d.to.traceSessionId = run.traceSessionId;
        changed = true;
      }
      if (!d.receipts.deliveredAt) {
        d.receipts.deliveredAt = run.startedAt || nowIso;
        changed = true;
      }
      if (!d.receipts.seenAt) {
        d.receipts.seenAt = nowIso;
        if (d.receipt === 'issued' || d.receipt === 'delivered') {
          d.receipt = 'seen';
        }
        changed = true;
      }
      if (changed) {
        this.saveDispatch(d);
      }
    }
  }

  private onRunFinalizedForDispatches(run: ActiveRun) {
    for (const d of this.dispatches.values()) {
      if (d.status !== 'running' && d.status !== 'issued') continue;
      const matchById = d.targetRunId && d.targetRunId === run.runId;
      const matchBySlot = d.to.channel === run.channel && d.to.sessionName === run.sessionName;
      if (!matchById && !matchBySlot) continue;
      const toolFiles: string[] = [];
      for (const t of run.tools || []) {
        if (t.input) {
          for (const f of this.extractFilesFromText(t.input)) toolFiles.push(f);
        }
      }
      this.harvestRunIntoDispatch(
        d,
        run.text || '',
        run.error,
        run.status === 'failed',
        'turn-end',
        run.startedAt,
        run.traceSessionId,
      );
      if (d.delivery && toolFiles.length > 0) {
        d.delivery.files = Array.from(new Set([...d.delivery.files, ...toolFiles])).slice(0, 15);
        this.saveDispatch(d);
      }
    }

    // If the finished run was itself a caller session that had pending wakes waiting for its turn to end, wake it now!
    this.processCallerWakes(run.channel, run.sessionName).catch(() => {});
  }

  private wakeCallerIfNeeded(d: DispatchRecord) {
    if (d.wake.mode !== 'auto-resume') return;
    if (!d.from.channel || !d.from.sessionName) return;
    if (d.wake.state === 'woken' || d.wake.state === 'waking') return;
    d.wake.state = 'pending';
    this.saveDispatch(d);
    this.processCallerWakes(d.from.channel, d.from.sessionName).catch(() => {});
  }

  private async processCallerWakes(callerChannel: ChannelId, callerSessionName: string) {
    const callerKey = this.slotKey(callerChannel, callerSessionName);
    if (this.wakingCallers.has(callerKey)) return;
    // Wait until caller's own turn finishes before injecting the wake message (just like agent-hub wake.py)
    const activeCaller = this.activeRuns.get(callerKey);
    if (activeCaller && activeCaller.status === 'running') return;

    const pending = Array.from(this.dispatches.values()).filter(
      (d) =>
        d.from.channel === callerChannel &&
        d.from.sessionName === callerSessionName &&
        d.wake.mode === 'auto-resume' &&
        d.wake.state === 'pending',
    );
    if (pending.length === 0) return;

    this.wakingCallers.add(callerKey);
    try {
      for (const d of pending) {
        d.wake.state = 'waking';
        this.saveDispatch(d, false);
      }
      const lines: string[] = [
        `【跨会话协同回执唤醒 · 共 ${pending.length} 项派活已返回】`,
      ];
      for (const d of pending) {
        const statusLabel =
          d.status === 'completed'
            ? '已完成交回'
            : d.status === 'yielded'
            ? `已让出 (等待: ${d.waitingFor || '外部输入'})`
            : d.status === 'stalled'
            ? '超时停滞 (stalled)'
            : `异常结束 (${d.status})`;
        lines.push(
          `- 派活单 [${d.id}] -> ${d.to.channel}/${d.to.sessionName} (${statusLabel}, 通道: ${d.delivery?.via || 'turn-end'}):`,
        );
        lines.push(`  摘要: ${d.delivery?.summary || d.error || '(无摘要)'}`);
        if (d.delivery?.files?.length) {
          lines.push(`  产物文件: ${d.delivery.files.join(', ')}`);
        }
      }
      lines.push(`请根据上述交回结果继续完成你的后续工作。`);

      const wakeRes = await this.sendPrompt({
        channel: callerChannel,
        sessionName: callerSessionName,
        traceSessionId: pending[0].from.traceSessionId,
        prompt: lines.join('\n'),
        permissions: 'all',
        mode: 'send',
        source: 'cli',
      });
      const nowIso = new Date().toISOString();
      for (const d of pending) {
        d.wake.state = 'woken';
        d.wake.wokenRunId = wakeRes.run?.runId;
        d.wake.wokenAt = nowIso;
        this.saveDispatch(d);
      }
    } catch (err: any) {
      for (const d of pending) {
        d.wake.state = 'wake-failed';
        d.wake.error = err?.message || String(err);
        this.saveDispatch(d);
      }
    } finally {
      this.wakingCallers.delete(callerKey);
    }
  }

  public waitForDispatch(id: string, timeoutMs = 120000): Promise<DispatchRecord | null> {
    const cur = this.dispatches.get(id);
    if (!cur) return Promise.resolve(null);
    if (cur.receipt === 'returned' || (cur.status !== 'issued' && cur.status !== 'running')) {
      return Promise.resolve(cur);
    }
    return new Promise((resolvePromise) => {
      const timer = setTimeout(() => {
        const list = this.dispatchWaiters.get(id) || [];
        this.dispatchWaiters.set(
          id,
          list.filter((fn) => fn !== onDone),
        );
        resolvePromise(this.dispatches.get(id) || null);
      }, Math.max(1000, timeoutMs));

      const onDone = (finished: DispatchRecord) => {
        clearTimeout(timer);
        resolvePromise(finished);
      };
      const existing = this.dispatchWaiters.get(id) || [];
      existing.push(onDone);
      this.dispatchWaiters.set(id, existing);
    });
  }

  /**
   * Dispatch a task between two sessions (`spawn-subagent` / `peer-message`), tracking the 4-stage receipt
   * (`issued` -> `delivered` -> `seen` -> `returned`) and optionally waking the caller session upon return.
   */
  public async dispatchTask(params: {
    kind?: 'spawn-subagent' | 'peer-message' | 'handoff';
    fromChannel?: string;
    fromSessionName?: string;
    fromTraceId?: string;
    toChannel: string;
    toSessionName?: string;
    toTraceId?: string;
    toModel?: string;
    cwd?: string;
    task: string;
    contextDigest?: string;
    parentDispatchId?: string;
    wakeCaller?: boolean;
    wait?: boolean;
    timeoutMs?: number;
    rawPrompt?: boolean;
  }) {
    const toProf = resolveChannel(params.toChannel);
    if (!toProf) {
      throw new Error(`未知目标渠道: ${params.toChannel}`);
    }
    const task = String(params.task || '').trim();
    if (!task) {
      throw new Error('派活任务内容 (task) 不能为空');
    }

    const fromProf = params.fromChannel ? resolveChannel(params.fromChannel) : null;
    const fromSessionName = fromProf
      ? this.resolveBoundSessionName(fromProf, params.fromSessionName, params.fromTraceId) ||
        (params.fromSessionName || '').trim() ||
        undefined
      : (params.fromSessionName || '').trim() || undefined;

    // Compute delegation depth & prevent infinite delegation loops (borrowing agent-hub delegation.py MAX_DEPTH=3)
    let depth = 1;
    if (params.parentDispatchId && this.dispatches.has(params.parentDispatchId)) {
      depth = (this.dispatches.get(params.parentDispatchId)!.depth || 1) + 1;
    } else if (fromProf && fromSessionName) {
      const activeParent = Array.from(this.dispatches.values()).find(
        (d) => d.status === 'running' && d.to.channel === fromProf.id && d.to.sessionName === fromSessionName,
      );
      if (activeParent) {
        depth = (activeParent.depth || 1) + 1;
      }
    }
    if (depth > MAX_DISPATCH_DEPTH) {
      throw new Error(`派活深度超过上限 (${MAX_DISPATCH_DEPTH})，拒绝继续向下派生以防递归死循环`);
    }

    const stamp = new Date().toISOString().replace(/\D/g, '').slice(8, 14);
    const id = `dsp_${stamp}_${Math.random().toString(36).slice(2, 6)}`;
    const kind = params.kind || 'spawn-subagent';
    const boundToName = this.resolveBoundSessionName(toProf, params.toSessionName, params.toTraceId);
    const toSessionName = boundToName || (params.toSessionName || '').trim() || `sub-${toProf.id}-${stamp}`;
    const resolvedCwd =
      (params.cwd && existsSync(params.cwd) ? resolve(params.cwd) : '') ||
      this.selectedCwds.get(this.slotKey(toProf.id, toSessionName)) ||
      (fromProf && fromSessionName ? this.selectedCwds.get(this.slotKey(fromProf.id, fromSessionName)) : '') ||
      this.repoRoot;
    const toModel =
      params.toModel && toProf.recommendedModels.includes(params.toModel)
        ? params.toModel
        : this.selectedModels.get(this.slotKey(toProf.id, toSessionName)) ||
          this.selectedModels.get(toProf.id) ||
          toProf.defaultModel;

    const nowIso = new Date().toISOString();
    const wakeMode: DispatchRecord['wake']['mode'] =
      params.wakeCaller && fromProf && fromSessionName
        ? 'auto-resume'
        : params.wait
        ? 'wait-poll'
        : 'none';

    const record: DispatchRecord = {
      id,
      kind,
      status: 'issued',
      receipt: 'issued',
      receipts: {
        issuedAt: nowIso,
      },
      from: {
        channel: fromProf?.id,
        sessionName: fromSessionName,
        traceSessionId: params.fromTraceId,
      },
      to: {
        channel: toProf.id,
        sessionName: toSessionName,
        traceSessionId: params.toTraceId,
        model: toModel,
        cwd: resolvedCwd,
      },
      task,
      contextDigest: params.contextDigest ? String(params.contextDigest).trim() : undefined,
      depth,
      parentDispatchId: params.parentDispatchId,
      progressReports: [],
      requests: [],
      wake: {
        mode: wakeMode,
        state: 'none',
      },
      updatedAt: nowIso,
    };

    // Stage 1: issued (persisted before target invocation)
    this.saveDispatch(record);

    const gwToolPath = join(this.repoRoot, 'hub', 'tools', 'agent_gateway.js').replace(/\\/g, '/');
    // Agents' shells often lack node on PATH (ZCode's Git Bash, 2026-10-18), so the command names this node.
    const nodeBin = process.execPath.replace(/\\/g, '/');
    const fromLabel = fromProf ? `${fromProf.label} (${fromSessionName || 'caller'})` : '中心调度方';
    const fullPrompt = params.rawPrompt
      ? task
      : [
          `【跨会话派活单 · ID: ${id} · 类型: ${kind}】`,
          `- 派活来源: ${fromLabel}`,
          `- 目标座席: ${toProf.label} / ${toSessionName}`,
          record.contextDigest ? `- 上下文摘要: ${record.contextDigest}` : '',
          `---`,
          `【任务要求】`,
          task,
          `---`,
          `【回执与交回约定（任选其一，中心亦会在本轮结束时自动兜底采集回复）】`,
          `1. 命令行交回/汇报（若你有终端工具）：`,
          `   - 中途汇报进度（不打断当前轮）："${nodeBin}" "${gwToolPath}" report --id ${id} --text "进度说明"`,
          `   - 完成并交回："${nodeBin}" "${gwToolPath}" deliver --id ${id} --summary "一句话结论"`,
          `   - 阻塞并让出："${nodeBin}" "${gwToolPath}" yield --id ${id} --waiting-for "等待的输入或条件"`,
          `2. 结构化尾注交回（无需调工具）：在回复末尾写一行 \`【交回】一句话结论\` 或 \`【让出：等待什么】\`。`,
        ]
          .filter(Boolean)
          .join('\n');

    try {
      const sendRes = await this.sendPrompt({
        channel: toProf.id,
        sessionName: toSessionName,
        traceSessionId: params.toTraceId,
        cwd: resolvedCwd,
        model: toModel,
        prompt: fullPrompt,
        permissions: 'all',
        mode: 'send',
        source: 'cli',
        wait: false,
      });

      // Stage 2: delivered (target process/queue has accepted the prompt)
      const cur = this.dispatches.get(id) || record;
      if (!cur.receipts.deliveredAt) {
        cur.receipts.deliveredAt = new Date().toISOString();
      }
      if (cur.receipt === 'issued') {
        cur.receipt = 'delivered';
      }
      if (cur.status === 'issued') {
        cur.status = 'running';
      }
      if (sendRes.run?.runId) {
        cur.targetRunId = sendRes.run.runId;
      }
      if (sendRes.run?.traceSessionId && !sendRes.run.traceSessionId.startsWith('new:')) {
        cur.to.traceSessionId = sendRes.run.traceSessionId;
      }
      this.saveDispatch(cur);

      if (params.wait) {
        const finished = await this.waitForDispatch(id, params.timeoutMs || 180000);
        return {
          ok: true,
          dispatch: finished || this.dispatches.get(id) || cur,
        };
      }

      return {
        ok: true,
        dispatch: this.dispatches.get(id) || cur,
      };
    } catch (err: any) {
      record.status = 'failed';
      record.error = err?.message || String(err);
      record.receipt = 'returned';
      record.receipts.returnedAt = new Date().toISOString();
      this.saveDispatch(record);
      throw err;
    }
  }

  /**
   * Handle explicit collaboration actions (`deliver`, `report`, `yield`, `request`, `reclaim`)
   * from either the target session CLI (`agent_gateway.js`) or the web UI.
   */
  public async recordCollabEvent(params: {
    id?: string;
    channel?: string;
    sessionName?: string;
    kind: 'deliver' | 'report' | 'yield' | 'request' | 'reclaim';
    summary?: string;
    text?: string;
    reply?: string;
    waitingFor?: string;
    files?: string[];
    via?: 'cli' | 'web';
  }) {
    let d: DispatchRecord | undefined;
    if (params.id) {
      d = this.dispatches.get(params.id);
    }
    if (!d && params.channel && params.sessionName) {
      const ch = resolveChannel(params.channel)?.id || params.channel;
      d = Array.from(this.dispatches.values()).find(
        (x) => (x.status === 'running' || x.status === 'issued' || x.status === 'yielded') && x.to.channel === ch && x.to.sessionName === params.sessionName,
      );
    }
    if (!d) {
      throw new Error(`未找到匹配的派活单: ${params.id || `${params.channel}/${params.sessionName}`}`);
    }

    const nowIso = new Date().toISOString();
    const via = params.via || 'cli';
    const msg = String(params.summary || params.text || params.waitingFor || '').trim();

    if (!d.receipts.deliveredAt) d.receipts.deliveredAt = nowIso;
    if (!d.receipts.seenAt) {
      d.receipts.seenAt = nowIso;
      if (d.receipt === 'issued' || d.receipt === 'delivered') d.receipt = 'seen';
    }

    if (params.kind === 'report') {
      d.progressReports.push({
        at: nowIso,
        text: msg || '执行中进度上报',
        via,
      });
      this.saveDispatch(d);
      return { ok: true, kind: 'report', dispatch: d };
    }

    if (params.kind === 'request') {
      d.requests = d.requests || [];
      d.requests.push({
        at: nowIso,
        text: msg || '请求补充信息或权限',
        status: 'pending',
      });
      d.waitingFor = msg || '等待补充信息';
      this.saveDispatch(d);
      return { ok: true, kind: 'request', dispatch: d };
    }

    if (params.kind === 'yield') {
      d.status = 'yielded';
      d.waitingFor = String(params.waitingFor || msg || '等待上游或外部输入').trim();
      d.receipt = 'returned';
      d.receipts.returnedAt = nowIso;
      d.delivery = {
        at: nowIso,
        via: 'cli',
        summary: `让出等待：${d.waitingFor}`,
        reply: String(params.reply || msg || d.waitingFor),
        files: Array.isArray(params.files) ? params.files : [],
      };
      this.saveDispatch(d);
      this.resolveDispatchWaiters(d);
      this.wakeCallerIfNeeded(d);
      return { ok: true, kind: 'yield', dispatch: d };
    }

    if (params.kind === 'deliver') {
      const files = Array.isArray(params.files) && params.files.length > 0 ? params.files : this.extractFilesFromText(msg + ' ' + (params.reply || ''));
      d.status = 'completed';
      d.waitingFor = undefined;
      d.receipt = 'returned';
      d.receipts.returnedAt = nowIso;
      d.delivery = {
        at: nowIso,
        via: 'cli',
        summary: (msg || params.reply || '已完成并交回').slice(0, 300),
        reply: String(params.reply || msg || ''),
        files,
      };
      this.saveDispatch(d);
      this.resolveDispatchWaiters(d);
      this.wakeCallerIfNeeded(d);
      return { ok: true, kind: 'deliver', dispatch: d };
    }

    if (params.kind === 'reclaim') {
      try {
        await this.cancelRun(d.to.channel, d.to.sessionName);
      } catch {}
      d.status = 'cancelled';
      d.waitingFor = undefined;
      d.error = msg || '派活方主动收回任务 (reclaim)';
      d.receipt = 'returned';
      d.receipts.returnedAt = nowIso;
      d.delivery = {
        at: nowIso,
        via: 'cli',
        summary: d.error,
        reply: '',
        files: [],
      };
      this.saveDispatch(d);
      this.resolveDispatchWaiters(d);
      return { ok: true, kind: 'reclaim', dispatch: d };
    }

    throw new Error(`未知协同动作类型: ${params.kind}`);
  }

  public getDispatchesSummary() {
    const all = Array.from(this.dispatches.values()).sort((a, b) =>
      String(b.updatedAt || b.receipts.issuedAt).localeCompare(String(a.updatedAt || a.receipts.issuedAt)),
    );
    const waitingEdges = all
      .filter((d) => d.status === 'running' || d.status === 'issued' || d.status === 'yielded')
      .map((d) => ({
        dispatchId: d.id,
        kind: d.kind,
        fromChannel: d.from.channel || null,
        fromSession: d.from.sessionName || null,
        fromTraceId: d.from.traceSessionId || null,
        toChannel: d.to.channel,
        toSession: d.to.sessionName,
        toTraceId: d.to.traceSessionId || null,
        status: d.status,
        receipt: d.receipt,
        waitingFor:
          d.status === 'yielded'
            ? d.waitingFor || '被派方已让出，等待外部输入'
            : `等待 ${d.to.channel}/${d.to.sessionName} 执行完成`,
        updatedAt: d.updatedAt,
      }));
    return {
      summary: {
        total: all.length,
        running: all.filter((d) => d.status === 'running' || d.status === 'issued').length,
        yielded: all.filter((d) => d.status === 'yielded').length,
        completed: all.filter((d) => d.status === 'completed').length,
        failed: all.filter((d) => d.status === 'failed' || d.status === 'stalled' || d.status === 'cancelled').length,
      },
      waitingEdges,
      dispatches: all.slice(0, 60),
    };
  }

  public async getDispatches(params?: {
    id?: string;
    channel?: string;
    sessionName?: string;
    status?: string;
    waitMs?: number;
  }) {
    this.reconcileDispatches(false);
    if (params?.id) {
      if (params.waitMs && params.waitMs > 0) {
        const waited = await this.waitForDispatch(params.id, params.waitMs);
        if (!waited) return { ok: false, error: `未找到派活单: ${params.id}` };
        return { ok: true, dispatch: waited };
      }
      const d = this.dispatches.get(params.id);
      if (!d) return { ok: false, error: `未找到派活单: ${params.id}` };
      return { ok: true, dispatch: d };
    }
    const base = this.getDispatchesSummary();
    let list = base.dispatches;
    if (params?.channel) {
      const ch = resolveChannel(params.channel)?.id || params.channel;
      list = list.filter((d) => d.to.channel === ch || d.from.channel === ch);
    }
    if (params?.sessionName) {
      const sn = params.sessionName.trim();
      list = list.filter((d) => d.to.sessionName === sn || d.from.sessionName === sn);
    }
    if (params?.status) {
      list = list.filter((d) => d.status === params.status);
    }
    return {
      ok: true,
      summary: base.summary,
      waitingEdges: base.waitingEdges,
      dispatches: list,
    };
  }

  public sessionDispatchSummary(traceSessionId: string, channel: string, controlName: string) {
    const rawSid = traceSessionId.split(':').pop() || traceSessionId;
    const matchFrom = (d: DispatchRecord) =>
      (d.from.traceSessionId && (d.from.traceSessionId === traceSessionId || d.from.traceSessionId.endsWith(rawSid))) ||
      (d.from.channel === channel && d.from.sessionName === controlName);
    const matchTo = (d: DispatchRecord) =>
      (d.to.traceSessionId && (d.to.traceSessionId === traceSessionId || d.to.traceSessionId.endsWith(rawSid))) ||
      (d.to.channel === channel && d.to.sessionName === controlName);

    const outList: Array<Record<string, any>> = [];
    const inList: Array<Record<string, any>> = [];
    let waitingFor: { kind: 'subagent' | 'external'; target?: string; dispatchId: string; detail: string } | undefined;

    for (const d of this.dispatches.values()) {
      if (matchFrom(d)) {
        outList.push({
          id: d.id,
          kind: d.kind,
          toChannel: d.to.channel,
          toSession: d.to.sessionName,
          toTraceId: d.to.traceSessionId,
          status: d.status,
          receipt: d.receipt,
          receipts: d.receipts,
          summary: d.delivery?.summary || d.waitingFor || d.task.slice(0, 80),
          wakeState: d.wake.state,
          updatedAt: d.updatedAt,
        });
        if (!waitingFor && (d.status === 'running' || d.status === 'issued')) {
          waitingFor = {
            kind: 'subagent',
            target: `${d.to.channel}/${d.to.sessionName}`,
            dispatchId: d.id,
            detail: `等待被派会话 ${d.to.channel}/${d.to.sessionName} 交回 (${d.receipt})`,
          };
        }
      }
      if (matchTo(d)) {
        inList.push({
          id: d.id,
          kind: d.kind,
          fromChannel: d.from.channel,
          fromSession: d.from.sessionName,
          fromTraceId: d.from.traceSessionId,
          status: d.status,
          receipt: d.receipt,
          receipts: d.receipts,
          waitingFor: d.waitingFor,
          progressCount: d.progressReports.length,
          deliveryVia: d.delivery?.via,
          summary: d.delivery?.summary || d.task.slice(0, 80),
          updatedAt: d.updatedAt,
        });
        if (!waitingFor && d.status === 'yielded' && d.waitingFor) {
          waitingFor = {
            kind: 'external',
            target: d.from.sessionName ? `${d.from.channel}/${d.from.sessionName}` : undefined,
            dispatchId: d.id,
            detail: `已让出：等待 ${d.waitingFor}`,
          };
        }
      }
    }
    if (!outList.length && !inList.length && !waitingFor) return null;
    return {
      waitingFor,
      dispatchedOut: outList.length ? outList : undefined,
      dispatchedIn: inList.length ? inList : undefined,
    };
  }

  private loadMetaAgents() {
    for (const [id, def] of Object.entries(DEFAULT_META_AGENTS) as [MetaAgentId, MetaAgentConfig][]) {
      this.metaAgents.set(id, { ...def });
    }
    try {
      if (existsSync(this.metaAgentsFile)) {
        const raw = JSON.parse(readFileSync(this.metaAgentsFile, 'utf8'));
        if (raw && typeof raw === 'object') {
          for (const [id, cfg] of Object.entries(raw.agents || raw)) {
            if (id in DEFAULT_META_AGENTS && cfg && typeof cfg === 'object') {
              const base = this.metaAgents.get(id as MetaAgentId)!;
              const merged: MetaAgentConfig = {
                ...base,
                ...(cfg as Partial<MetaAgentConfig>),
                id: id as MetaAgentId,
                runtimeStatus: 'standby',
              };
              const bCh = resolveChannel(merged.brainChannel || 'zcode') || CHANNEL_PROFILES.zcode;
              merged.brainChannel = bCh.id;
              if (!merged.brainModel || !bCh.recommendedModels.includes(merged.brainModel)) {
                merged.brainModel = bCh.defaultModel;
              }
              if (!merged.brainSessionName || merged.brainSessionName === 'meta-brain-fufu') {
                merged.brainSessionName = 'meta-brain-supervisor';
              }
              if (!merged.engineMode) merged.engineMode = 'agent_brain';
              if (!merged.patrolIntervalSec) merged.patrolIntervalSec = 15;
              // Name, description and persona are the product's own text, not settings a person changes: they
              // always come from the code, so a rename (the 10-18 wording cleanup) is not undone by the saved file.
              merged.name = base.name;
              merged.description = base.description;
              merged.persona = base.persona || DEFAULT_SUPERVISOR_PERSONA;
              if (merged.lastAction && merged.lastAction.includes('芙芙')) {
                merged.lastAction = merged.lastAction.replace(/芙芙大脑/g, '元智能体的诊断会话').replace(/芙芙/g, '元智能体');
              }
              this.metaAgents.set(id as MetaAgentId, merged);
            }
          }
          if (Array.isArray(raw.logs)) {
            this.metaAgentLogs.push(
              ...raw.logs.slice(0, 40).map((lg: MetaAgentLogEntry) => ({
                ...lg,
                detail: String(lg.detail || '').replace(/芙芙大脑/g, '元智能体的诊断会话').replace(/芙芙/g, '元智能体'),
              })),
            );
          }
          this.saveMetaAgents();
        }
      }
    } catch {}
  }

  private saveMetaAgents() {
    try {
      mkdirSync(join(HOME, '.acpx'), { recursive: true });
      const agentsObj: Record<string, MetaAgentConfig> = {};
      for (const [id, cfg] of this.metaAgents.entries()) {
        agentsObj[id] = cfg;
      }
      writeFileSync(
        this.metaAgentsFile,
        JSON.stringify({ agents: agentsObj, logs: this.metaAgentLogs.slice(0, 40) }, null, 2),
        'utf8',
      );
    } catch {}
  }

  public getMetaAgents(): MetaAgentConfig[] {
    return Array.from(this.metaAgents.values());
  }

  public getMetaAgentLogs(): MetaAgentLogEntry[] {
    return this.metaAgentLogs.slice(0, 30);
  }

  public updateMetaAgent(params: {
    id?: string;
    applyToAll?: boolean;
    enabled?: boolean;
    policy?: 'all' | 'safe_write' | 'reads';
    maxRetries?: number;
    retryDelaySec?: number;
    maxConsecutiveErrors?: number;
    engineMode?: 'agent_brain' | 'local_rules';
    brainChannel?: string;
    brainModel?: string;
    brainSessionName?: string;
    patrolIntervalSec?: number;
    persona?: string;
  }) {
    const targetIds: MetaAgentId[] =
      params.applyToAll || !params.id || params.id === 'all'
        ? (['meta_approver', 'meta_resumer', 'meta_maint', 'meta_auditor'] as MetaAgentId[])
        : [params.id as MetaAgentId];

    let resolvedBrainChannel: ChannelProfile | null = null;
    if (params.brainChannel) {
      resolvedBrainChannel = resolveChannel(params.brainChannel);
    }

    for (const id of targetIds) {
      const existing = this.metaAgents.get(id);
      if (!existing) continue;
      if (typeof params.enabled === 'boolean' && !params.applyToAll) existing.enabled = params.enabled;
      if (params.policy && id === 'meta_approver') existing.policy = params.policy;
      if (typeof params.maxRetries === 'number') existing.maxRetries = Math.max(0, Math.min(5, params.maxRetries));
      if (typeof params.retryDelaySec === 'number') {
        existing.retryDelaySec = Math.max(1, Math.min(30, params.retryDelaySec));
      }
      if (typeof params.maxConsecutiveErrors === 'number') {
        existing.maxConsecutiveErrors = Math.max(1, Math.min(10, params.maxConsecutiveErrors));
      }
      if (params.engineMode === 'agent_brain' || params.engineMode === 'local_rules') {
        existing.engineMode = params.engineMode;
      }
      if (resolvedBrainChannel) {
        existing.brainChannel = resolvedBrainChannel.id;
        if (!params.brainModel || !resolvedBrainChannel.recommendedModels.includes(params.brainModel)) {
          existing.brainModel = resolvedBrainChannel.defaultModel;
        }
      }
      if (params.brainModel) {
        const chProf = resolveChannel(existing.brainChannel || 'zcode') || CHANNEL_PROFILES.zcode;
        if (chProf.recommendedModels.includes(params.brainModel)) {
          existing.brainModel = params.brainModel;
        }
      }
      if (params.brainSessionName && params.brainSessionName.trim()) {
        existing.brainSessionName = params.brainSessionName.trim();
      }
      if (typeof params.patrolIntervalSec === 'number') {
        existing.patrolIntervalSec = Math.max(5, Math.min(300, params.patrolIntervalSec));
      }
      if (typeof params.persona === 'string' && params.persona.trim()) {
        existing.persona = params.persona.trim().slice(0, 1200);
      }
      this.metaAgents.set(id, existing);
    }

    if (resolvedBrainChannel || params.brainModel || params.engineMode) {
      const sample = this.metaAgents.get(targetIds[0])!;
      this.recordMetaAction(
        targetIds[0],
        sample.brainChannel || 'zcode',
        sample.brainSessionName || 'meta-brain-supervisor',
        '切换元智能体的诊断会话配置',
        `诊断会话设为 ${CHANNEL_PROFILES[sample.brainChannel || 'zcode'].label} · ${sample.brainModel} (${
          sample.engineMode === 'local_rules' ? '只用本地规则' : '出事时叫智能体诊断，平时用规则'
        })`,
      );
    } else {
      this.saveMetaAgents();
      this.broadcast('state', this.getState());
    }

    return {
      ok: true,
      metaAgent: this.metaAgents.get(targetIds[0]),
      metaAgents: this.getMetaAgents(),
      logs: this.getMetaAgentLogs(),
    };
  }

  public recordMetaAction(
    metaId: MetaAgentId,
    channel: ChannelId,
    sessionName: string,
    action: string,
    detail: string,
    extra?: { brainUsed?: string; brainTraceSessionId?: string; eventKind?: string },
  ) {
    const cfg = this.metaAgents.get(metaId);
    const now = new Date().toISOString();
    if (cfg) {
      cfg.triggersCount = (cfg.triggersCount || 0) + 1;
      cfg.lastTriggeredAt = now;
      cfg.lastAction = `${action}: ${detail}`.slice(0, 140);
      if (extra?.brainTraceSessionId) {
        cfg.lastBrainSessionId = extra.brainTraceSessionId;
      }
      this.metaAgents.set(metaId, cfg);
    }
    const entry: MetaAgentLogEntry = {
      id: `mlog_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      metaId,
      metaName: cfg?.name || metaId,
      channel,
      sessionName,
      action,
      detail,
      brainUsed:
        extra?.brainUsed ||
        (cfg ? `${CHANNEL_PROFILES[cfg.brainChannel || 'zcode']?.label || cfg.brainChannel} · ${cfg.brainModel}` : undefined),
      brainTraceSessionId: extra?.brainTraceSessionId || cfg?.lastBrainSessionId,
      eventKind: extra?.eventKind,
      at: now,
    };
    this.metaAgentLogs.unshift(entry);
    if (this.metaAgentLogs.length > 50) this.metaAgentLogs.pop();
    this.saveMetaAgents();
    this.broadcast('meta_agent_action', entry);
  }

  /** Background patrol: rules only, no model calls; a model is called only for an incident. */
  private startMetaPatrolLoop() {
    if (this.patrolTimer) clearInterval(this.patrolTimer);
    this.patrolTimer = setInterval(() => {
      try {
        this.tickMetaPatrol();
      } catch {}
    }, 5000);
    if (typeof this.patrolTimer.unref === 'function') {
      this.patrolTimer.unref();
    }
  }

  private tickMetaPatrol() {
    const nowMs = Date.now();
    const resumer = this.metaAgents.get('meta_resumer');
    const intervalMs = Math.max(5, resumer?.patrolIntervalSec || 15) * 1000;
    if (nowMs - this.lastPatrolTickMs < intervalMs) return;
    this.lastPatrolTickMs = nowMs;
    this.patrolTicksCount++;
    const nowIso = new Date(nowMs).toISOString();

    for (const [id, ma] of this.metaAgents.entries()) {
      ma.lastPatrolAt = nowIso;
      if (!ma.runtimeStatus || ma.runtimeStatus === 'patrolling') {
        ma.runtimeStatus = 'standby';
      }
      this.metaAgents.set(id, ma);
    }

    // 1. Watchdog check for stalled active runs (only substantive progress counts, not stderr noise)
    const auditor = this.metaAgents.get('meta_auditor');
    if (auditor?.enabled) {
      for (const [slot, run] of this.activeRuns.entries()) {
        if (run.status !== 'running') continue;
        if (run.sessionName.startsWith('meta-brain')) continue;
        const elapsedSec = Math.round((nowMs - Date.parse(run.startedAt)) / 1000);
        const errTools = run.tools.filter((t) => t.status === 'error');
        if (errTools.length >= (auditor.maxConsecutiveErrors || 3)) {
          const incKey = `loop:${run.runId}:${errTools.length}`;
          if (!this.healedIncidents.has(incKey)) {
            this.healedIncidents.add(incKey);
            this.recordMetaAction(
              'meta_auditor',
              run.channel,
              run.sessionName,
              '看门狗死循环拦截',
              `巡检发现运行 ${run.runId} 连续 ${errTools.length} 次工具报错，触发防死循环督导`,
              { eventKind: 'loop_detected' },
            );
          }
        } else if (elapsedSec > 240 && !run.text && !run.thoughts && run.tools.length === 0) {
          const incKey = `stall:${run.runId}`;
          if (!this.healedIncidents.has(incKey)) {
            this.healedIncidents.add(incKey);
            this.recordMetaAction(
              'meta_auditor',
              run.channel,
              run.sessionName,
              '僵死进程巡检告警',
              `会话 ${run.sessionName} 已逾 ${elapsedSec}s 无实质进展（排除 stderr 噪音），已标记看门狗重点监控`,
              { eventKind: 'stalled_run' },
            );
          }
        }
      }
    }

    // 2. Scan recent sessions (including external WorkBuddy Desktop / AGY / Hermes / ACPX sessions) for anomalies
    if (resumer?.enabled) {
      try {
        const recentWindowMs = 60 * 60 * 1000; // last 60 minutes
        const detected: ExternalSessionAnomaly[] = [];
        // The patrol only looks at the 18 most recent sessions; listing every session (all Antigravity transcripts,
        // the ZCode store, WorkBuddy files) held the event loop ~0.5 s each 15 s tick (profiled 10-18), so the list is
        // reused for a minute. The API still lists fresh.
        if (!this.patrolListCache || nowMs - this.patrolListCache.at > 60_000) {
          this.patrolListCache = { at: nowMs, list: this.listAcpxSessions().slice(0, 18) };
        }
        for (const s of this.patrolListCache.list) {
          if (s.sessionName.startsWith('meta-brain')) continue;
          const slot = this.slotKey(s.channel, s.sessionName);
          if (this.activeRuns.get(slot)?.status === 'running') continue;
          const updMs = s.updatedAt ? Date.parse(s.updatedAt) : 0;
          if (!updMs || nowMs - updMs > recentWindowMs) continue;
          if (s.interrupted || s.lastError) {
            detected.push({
              id: `anom_${s.traceSessionId}`,
              channel: s.channel,
              sessionName: s.sessionName,
              traceSessionId: s.traceSessionId,
              title: s.title || s.sessionName,
              cwd: s.cwd || this.repoRoot,
              updatedAt: s.updatedAt || nowIso,
              toolErrors: 1,
              lastError: s.lastError || '最近一轮异常中断或未产出有效回复',
            });
            continue;
          }
          const contract = this.getAcpxSessionAsContract(s.traceSessionId);
          if (!contract || contract.turns.length === 0) continue;
          const lastTurn = contract.turns[contract.turns.length - 1];
          const errStep = lastTurn.steps.find((st) => st.kind === 'tool' && st.status === 'error');
          if (lastTurn.status === 'failed' || lastTurn.status === 'aborted' || errStep) {
            const errMsg =
              errStep && errStep.kind === 'tool'
                ? `${errStep.name}: ${(errStep.output || '执行失败').slice(0, 100)}`
                : contract.state.detail || '会话存在未恢复的工具报错';
            detected.push({
              id: `anom_${s.traceSessionId}`,
              channel: s.channel,
              sessionName: s.sessionName,
              traceSessionId: s.traceSessionId,
              title: s.title || s.sessionName,
              cwd: s.cwd || this.repoRoot,
              updatedAt: s.updatedAt || nowIso,
              toolErrors: contract.stats.toolErrors || 1,
              lastError: errMsg,
            });
          }
          if (detected.length >= 5) break;
        }
        this.externalAnomalies = detected;
      } catch {}
    }

    try {
      this.reconcileDispatches(false);
    } catch {}
  }

  /**
   * Event-driven Meta-Agent Supervisor Brain invocation:
   * - Wakes up the configured `brainChannel` + `brainModel` in a dedicated coordination session (`meta-brain-supervisor`)
   * - Feeds structured incident telemetry, parses JSON verdict (`retry | switch_model | approve | hold`)
   * - Seamlessly falls back to deterministic local rules if brain is busy or in `local_rules` mode.
   */
  public async invokeMetaBrainForIncident(params: {
    metaId?: MetaAgentId;
    eventKind: 'execution_failure' | 'quota_or_model_error' | 'loop_detected' | 'manual_patrol';
    targetChannel: string;
    targetSessionName?: string;
    targetTraceId?: string;
    summary: string;
    errorDetail?: string;
    executeDecision?: boolean;
  }) {
    const metaId: MetaAgentId = params.metaId || 'meta_resumer';
    const ma = this.metaAgents.get(metaId) || this.metaAgents.get('meta_resumer')!;
    const targetProf = resolveChannel(params.targetChannel) || CHANNEL_PROFILES.codex;
    const targetSessionName = (params.targetSessionName || '').trim() || `hub-${targetProf.id}`;
    const brainProf = resolveChannel(ma.brainChannel || 'zcode') || CHANNEL_PROFILES.zcode;
    const brainModel =
      ma.brainModel && brainProf.recommendedModels.includes(ma.brainModel)
        ? ma.brainModel
        : brainProf.defaultModel;
    const brainSessionName = (ma.brainSessionName || 'meta-brain-supervisor').trim();
    const brainSlot = this.slotKey(brainProf.id, brainSessionName);

    // Gather target session telemetry
    const targetContract =
      (params.targetTraceId && this.getAcpxSessionAsContract(params.targetTraceId)) ||
      this.getAcpxSessionAsContract(targetSessionName);
    const lastTurn =
      targetContract && targetContract.turns.length > 0
        ? targetContract.turns[targetContract.turns.length - 1]
        : null;
    const lastInput = (lastTurn?.input || '').slice(0, 180);
    const lastErr =
      params.errorDetail ||
      lastTurn?.error ||
      lastTurn?.steps
        ?.filter((s): s is ToolStep => s.kind === 'tool' && s.status === 'error')
        .map((s) => `${s.name}: ${(s.output || '').slice(0, 100)}`)
        .join('; ') ||
      '无报错（常规健康巡检）';

    // Deterministic Fallback check: if engineMode is local_rules or brain slot is already busy
    const existingBrainRun = this.activeRuns.get(brainSlot);
    if (ma.engineMode === 'local_rules' || (existingBrainRun && existingBrainRun.status === 'running')) {
      const fbReason =
        ma.engineMode === 'local_rules'
          ? '当前配置为只用本地规则，不调模型'
          : `元智能体的诊断会话 (${brainProf.label}) 当前正在处理其他案件，这次改用本地规则判断`;
      ma.runtimeStatus = 'fallback';
      this.metaAgents.set(metaId, ma);
      this.recordMetaAction(
        metaId,
        targetProf.id,
        targetSessionName,
        '确定性规则底座兜底',
        `${fbReason} · 目标状态: ${params.summary.slice(0, 70)}`,
        {
          brainUsed: `本地规则底座 (Fallback)`,
          eventKind: params.eventKind,
        },
      );
      ma.runtimeStatus = 'standby';
      this.metaAgents.set(metaId, ma);
      this.broadcast('state', this.getState());
      return {
        ok: true,
        mode: 'local_fallback',
        brainChannel: brainProf.id,
        brainModel,
        brainSessionName,
        decision: { action: 'retry', reason: fbReason },
      };
    }

    // Wake up the real Agent + Model Brain!
    ma.runtimeStatus = 'thinking';
    this.metaAgents.set(metaId, ma);
    this.broadcast('state', this.getState());

    const activeChannelsSummary = Object.values(CHANNEL_PROFILES)
      .map((p) => {
        const fail = this.channelFailures.get(p.id);
        return `${p.label}(模型:${this.selectedModels.get(p.id) || p.defaultModel}${
          fail?.failed ? `, 近期异常:${fail.failed}次` : ', 健康'
        })`;
      })
      .join('；');

    const coordinationPrompt = [
      `【元智能体 · 出事时的诊断】`,
      `人设与职责：${ma.persona || DEFAULT_SUPERVISOR_PERSONA}`,
      `触发督导席位：${ma.name} (${ma.id}) · 事件类型：${params.eventKind}`,
      `目标渠道与会话：${targetProf.label} / ${targetSessionName} (当前模型: ${
        this.selectedModels.get(this.slotKey(targetProf.id, targetSessionName)) || targetProf.defaultModel
      }，可选备选模型: ${targetProf.recommendedModels.join(', ')})`,
      `最近用户指令：${lastInput || '（暂无或刚新建）'}`,
      `事件摘要与现场诊断：${params.summary} | 详细异常：${lastErr}`,
      `七个产品现在的状态：${activeChannelsSummary}`,
      ``,
      `注意：本次为【只读协调裁决运行（coordination_only）】，严禁调用任何修改项目文件的工具，严禁长篇大论。`,
      `请直接用 2~3 句简短清晰的话汇报你的巡检判断，并在末尾紧跟一行 JSON 裁决（不要其他代码块）：`,
      `{"action":"retry|switch_model|approve|standby","targetModel":"若需切换模型填备选模型否则留空","reason":"一句话原因","hint":"若需注入续跑提示词填此处否则留空"}`,
    ].join('\n');

    this.recordMetaAction(
      metaId,
      targetProf.id,
      targetSessionName,
      `唤醒元智能体的诊断会话 (${brainProf.label})`,
      `事件 [${params.eventKind}] 唤醒 ${brainProf.label} · ${brainModel} (会话: ${brainSessionName}) 进行协调裁决`,
      {
        brainUsed: `${brainProf.label} · ${brainModel}`,
        eventKind: params.eventKind,
      },
    );

    const brainRun = this.startRunInternal({
      prof: brainProf,
      sessionName: brainSessionName,
      cwd: this.repoRoot,
      prompt: coordinationPrompt,
      model: brainModel,
      permissions: 'reads',
      source: 'web',
      resumedByMeta: metaId,
    });

    // Attach completion listener to parse the brain's verdict when `brainRun` completes
    const checkDoneTimer = setInterval(() => {
      const live = this.activeRuns.get(brainSlot);
      if (live && live.runId === brainRun.runId && live.status === 'running') return;
      clearInterval(checkDoneTimer);

      const currentMa = this.metaAgents.get(metaId) || ma;
      currentMa.runtimeStatus = 'standby';
      if (brainRun.traceSessionId) {
        currentMa.lastBrainSessionId = brainRun.traceSessionId;
      }
      this.metaAgents.set(metaId, currentMa);

      const outText = String(brainRun.text || '').trim();
      let parsedDecision: { action?: string; targetModel?: string; reason?: string; hint?: string } | null = null;
      const jsonMatch = /\{[\s\S]*?"action"\s*:\s*"[^"]+"[\s\S]*?\}/.exec(outText);
      if (jsonMatch) {
        try {
          parsedDecision = JSON.parse(jsonMatch[0]);
        } catch {}
      }

      if (outText) {
        const cleanSummary = outText
          .replace(/\{[\s\S]*?"action"[\s\S]*?\}/g, '')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 140);
        const actionLabel = parsedDecision?.action ? `裁决: ${parsedDecision.action}` : '巡检完毕';
        this.recordMetaAction(
          metaId,
          targetProf.id,
          targetSessionName,
          `元智能体的诊断会话${actionLabel}`,
          cleanSummary || parsedDecision?.reason || outText.slice(0, 120),
          {
            brainUsed: `${brainProf.label} · ${brainModel}`,
            brainTraceSessionId: brainRun.traceSessionId,
            eventKind: params.eventKind,
          },
        );

        if (params.executeDecision && parsedDecision) {
          if (
            parsedDecision.action === 'switch_model' &&
            parsedDecision.targetModel &&
            targetProf.recommendedModels.includes(parsedDecision.targetModel)
          ) {
            this.setSessionModel({
              channel: targetProf.id,
              sessionName: targetSessionName,
              traceSessionId: params.targetTraceId,
              model: parsedDecision.targetModel,
            });
          }
          if (parsedDecision.action === 'retry' || parsedDecision.action === 'switch_model') {
            this.resumeInterruptedSession({
              channel: targetProf.id,
              sessionName: targetSessionName,
              traceSessionId: params.targetTraceId,
              customHint: parsedDecision.hint || undefined,
            }).catch(() => {});
          }
        }
      } else {
        this.recordMetaAction(
          metaId,
          targetProf.id,
          targetSessionName,
          '诊断超时，改用本地规则',
          `诊断会话 (${brainProf.label} · ${brainModel}) 未返回结构化裁决，已由本地确定性规则底座接管`,
          {
            brainUsed: `本地规则兜底 (${brainProf.label})`,
            brainTraceSessionId: brainRun.traceSessionId,
            eventKind: params.eventKind,
          },
        );
      }
      this.broadcast('state', this.getState());
    }, 700);

    return {
      ok: true,
      mode: 'agent_brain',
      runId: brainRun.runId,
      brainChannel: brainProf.id,
      brainModel,
      brainSessionName,
      brainTraceSessionId: brainRun.traceSessionId || `new:${brainProf.id}:${brainSessionName}`,
    };
  }

  private slotKey(channel: ChannelId, sessionName: string): string {
    return `${channel}:${sessionName}`;
  }

  private loadAgySessionMap(): Record<string, string> {
    try {
      if (existsSync(this.agyMapFile)) {
        return JSON.parse(readFileSync(this.agyMapFile, 'utf8'));
      }
    } catch {}
    return {};
  }

  private saveAgySessionMap(map: Record<string, string>) {
    try {
      mkdirSync(join(HOME, '.acpx'), { recursive: true });
      writeFileSync(this.agyMapFile, JSON.stringify(map, null, 2), 'utf8');
    } catch {}
  }

  private discoverAntigravityLs(force = false) {
    if (!force && this.agyLsCache && Date.now() - this.agyLsCache.at < 30_000) {
      return this.agyLsCache;
    }
    const bin = join(
      HOME,
      'AppData',
      'Local',
      'Programs',
      'antigravity',
      'resources',
      'bin',
      'language_server.exe',
    );
    if (!existsSync(bin)) {
      throw new Error(`未找到 Antigravity language_server.exe: ${bin}`);
    }
    const psScript = `
$procs = Get-CimInstance Win32_Process -Filter "Name LIKE 'language_server%.exe'"
foreach ($p in $procs) {
  if ($p.CommandLine -match '--csrf_token\\s+([a-f0-9-]+)') {
    $csrf = $matches[1]
    $pidVal = $p.ProcessId
    $conns = Get-NetTCPConnection -OwningProcess $pidVal -State Listen -ErrorAction SilentlyContinue
    foreach ($c in $conns) {
      Write-Output "FOUND|$pidVal|$csrf|$($c.LocalPort)"
    }
  }
}
`;
    const r = spawnSync('powershell.exe', ['-NoProfile', '-Command', psScript], {
      encoding: 'utf8',
      timeout: 8000,
      windowsHide: true,
    });
    const lines = String(r.stdout || '')
      .split(/\r?\n/)
      .filter((l) => l.startsWith('FOUND|'));
    if (!lines.length) {
      throw new Error('未检测到运行中的 Antigravity language_server.exe 进程，请确认 Antigravity 已启动');
    }
    // The LS listens on an HTTPS (gRPC) port and a plain-HTTP (Connect-RPC) port in no stable order;
    // agentapi needs the one that answers GET /healthz over plain HTTP.
    const found = lines.map((l) => l.split('|'));
    const hit =
      found.find(([, , , p]) => {
        const h = spawnSync('curl.exe', ['-s', '--max-time', '2', `http://127.0.0.1:${p}/healthz`], {
          encoding: 'utf8',
          timeout: 3000,
          windowsHide: true,
        });
        return /"status"\s*:\s*"ok"/.test(String(h.stdout || ''));
      }) || found[0];
    const [, , csrf, port] = hit;
    const address = `localhost:${port}`;
    this.agyLsCache = {
      at: Date.now(),
      bin,
      csrf,
      port,
      address,
      env: {
        ANTIGRAVITY_CLI_ALIAS: 'agy',
        ANTIGRAVITY_LS_ADDRESS: address,
        ANTIGRAVITY_CSRF_TOKEN: csrf,
      },
    };
    return this.agyLsCache;
  }

  /** Parse a single Antigravity `transcript.jsonl` into `AcpxSessionInfo` + `Session` contract (cached by mtimeMs). */
  private parseAntigravityBrain(
    cid: string,
    transcriptPath: string,
    reverseNameMap: Map<string, string>,
  ): { info: AcpxSessionInfo; contract: Session } | null {
    try {
      const stat = statSync(transcriptPath);
      const cached = this.agySummaryCache.get(cid);
      const sessionName = reverseNameMap.get(cid) || `agy-${cid.slice(0, 8)}`;
      const slot = this.slotKey('antigravity', sessionName);
      const prof = CHANNEL_PROFILES.antigravity;
      const activeModel =
        this.selectedModels.get(slot) ||
        this.selectedModels.get('antigravity') ||
        prof.defaultModel;
      const isRunning = this.activeRuns.get(slot)?.status === 'running';

      if (cached && cached.mtimeMs === stat.mtimeMs) {
        cached.info.sessionName = sessionName;
        cached.info.currentModel = activeModel;
        cached.contract.agent.model = activeModel;
        cached.contract.state.status = isRunning ? 'working' : 'idle';
        return cached;
      }

      const content = readFileSync(transcriptPath, 'utf8');
      const lines = content.split(/\r?\n/).filter((l) => l.trim());
      const turns: Turn[] = [];
      let curSteps: Step[] = [];
      let curInput = '';
      let curOutput = '';
      let curStartedAt = '';
      let curEndedAt = '';
      let firstCreatedAt = '';
      let lastCreatedAt = '';
      let turnIdx = 0;
      let stepSeq = 0;
      let modelCalls = 0;
      let toolCalls = 0;
      let toolErrors = 0;
      let subagents = 0;
      let detectedCwd = this.repoRoot;
      let lastInterrupted = false;
      let lastErrorText = '';
      const childLinks: { rel: 'child'; id: string; label?: string }[] = [];

      const flushTurn = () => {
        if (!curSteps.length) return;
        turnIdx++;
        turns.push({
          id: `t${turnIdx}`,
          index: turnIdx,
          status: 'completed',
          startedAt: curStartedAt || firstCreatedAt || new Date(stat.mtimeMs).toISOString(),
          endedAt: curEndedAt || lastCreatedAt || new Date(stat.mtimeMs).toISOString(),
          input: curInput || undefined,
          output: curOutput || undefined,
          steps: curSteps,
        });
        curSteps = [];
        curInput = '';
        curOutput = '';
        curStartedAt = '';
        curEndedAt = '';
      };

      for (const line of lines) {
        try {
          const obj = JSON.parse(line);
          const at = String(obj.created_at || '');
          if (at) {
            if (!firstCreatedAt) firstCreatedAt = at;
            lastCreatedAt = at;
          }
          if (obj.type === 'USER_INPUT') {
            flushTurn();
            curStartedAt = at;
            const rawText = String(obj.content || '');
            const cleanText = stripUserRequestTags(rawText);
            if (/^Error:\s*The stream was interrupted/i.test(cleanText)) {
              lastInterrupted = true;
              lastErrorText = cleanText;
            }
            curInput = cleanText;
            stepSeq++;
            curSteps.push({
              id: `s${stepSeq}`,
              kind: 'message',
              role: 'user',
              text: cleanText,
              at: at || undefined,
            });
          } else if (obj.type === 'SYSTEM_MESSAGE') {
            // Words sent from outside (`agentapi send-message`: the hub, the phone page, the command line) arrive
            // as "[Message] timestamp=… sender=system priority=… content=<text>" and start a new turn, like the
            // person typing in the window. sender=<conversation>/task-N is the agent's own background task
            // reporting back: an event inside the current turn, not something a person said (seen 2026-10-18).
            const raw = String(obj.content || '');
            const m = /\[Message\] timestamp=(\S+) sender=(\S+) priority=\S+ content=([\s\S]*?)\s*(?:<\/SYSTEM_MESSAGE>[\s\S]*)?$/.exec(raw);
            if (m && m[2] === 'system') {
              flushTurn();
              curStartedAt = at;
              curInput = m[3].trim();
              stepSeq++;
              curSteps.push({ id: `s${stepSeq}`, kind: 'message', role: 'user', text: curInput, at: at || undefined });
            } else if (m) {
              stepSeq++;
              curSteps.push({ id: `s${stepSeq}`, kind: 'event', name: 'note', text: '后台任务回报：' + m[3].trim().slice(0, 200), at: at || undefined });
            }
          } else if (obj.type === 'PLANNER_RESPONSE') {
            curEndedAt = at || curEndedAt;
            const thinking = typeof obj.thinking === 'string' ? obj.thinking.trim() : '';
            const text = typeof obj.content === 'string' ? obj.content.trim() : '';
            if (text) {
              curOutput = text;
              lastInterrupted = false;
            }
            const rawCalls: any[] = Array.isArray(obj.tool_calls) ? obj.tool_calls : [];
            const callIds: string[] = [];
            const toolSteps: Step[] = [];

            for (let i = 0; i < rawCalls.length; i++) {
              const tc = rawCalls[i];
              const tName = String(tc?.name || 'tool');
              const tid = String(tc?.id || `agy_tc_${stepSeq}_${i + 1}`);
              let argsObj: Record<string, any> | null = null;
              let inStr = '';
              if (tc?.args && typeof tc.args === 'object') {
                argsObj = tc.args;
                inStr = JSON.stringify(tc.args, null, 2);
              } else if (typeof tc?.args === 'string') {
                inStr = tc.args;
                try {
                  argsObj = JSON.parse(tc.args);
                } catch {}
              }
              if (argsObj?.Cwd && typeof argsObj.Cwd === 'string') {
                detectedCwd = argsObj.Cwd;
              }
              if (tName === 'invoke_subagent') {
                subagents++;
              }
              const outStr =
                typeof tc?.result === 'string'
                  ? tc.result
                  : typeof tc?.output === 'string'
                  ? tc.output
                  : tc?.result
                  ? JSON.stringify(tc.result, null, 2)
                  : '';
              const isErr = Boolean(tc?.error || obj.status === 'ERROR');
              const cls = classifyTool(tName, inStr);
              toolCalls++;
              if (isErr) toolErrors++;
              callIds.push(tid);
              toolSteps.push({
                id: tid,
                kind: 'tool',
                name: tName,
                family: cls.family,
                callId: tid,
                input: inStr || undefined,
                output: outStr || undefined,
                status: isErr ? 'error' : 'ok',
                at: at || undefined,
                effects: [],
              });
            }

            if (thinking || text || toolSteps.length) {
              modelCalls++;
              stepSeq++;
              const inTok = Number(obj.input_tokens || 0);
              const cacheTok = Number(obj.cache_read_tokens || 0);
              const outTok = Number(obj.output_tokens || 0);
              curSteps.push({
                id: `s${stepSeq}`,
                kind: 'model',
                model: activeModel,
                at: at || undefined,
                reasoning: thinking || undefined,
                text: text || undefined,
                phase: toolSteps.length ? 'commentary' : 'final',
                calls: callIds,
                usage:
                  inTok || outTok
                    ? {
                        input: inTok,
                        cachedInput: cacheTok || undefined,
                        output: outTok,
                        total: inTok + outTok,
                      }
                    : undefined,
              });
              curSteps.push(...toolSteps);
            }
          }
        } catch {}
      }
      flushTurn();

      const realTurns = turns.filter((t) => !isSmokeTestPrompt(t.input || ''));
      const finalTurns = (realTurns.length > 0 ? realTurns : turns).map((t, idx) => ({
        ...t,
        id: `t${idx + 1}`,
        index: idx + 1,
      }));

      const firstUserTurn = finalTurns.find(
        (t) => t.input && !t.input.startsWith('[上下文压缩检查点]') && !t.input.startsWith('Error:'),
      );
      const title =
        (firstUserTurn?.input || finalTurns[0]?.input || `Antigravity · ${sessionName}`)
          .replace(/\s+/g, ' ')
          .slice(0, 110);

      const traceSessionId = `antigravity:${cid}`;
      const createdAtIso = firstCreatedAt || new Date(stat.birthtimeMs || stat.mtimeMs).toISOString();
      const updatedAtIso = lastCreatedAt || new Date(stat.mtimeMs).toISOString();

      const info: AcpxSessionInfo = {
        acpxRecordId: `antigravity:${cid}`,
        acpSessionId: cid,
        sessionName,
        channel: 'antigravity',
        channelId: 'antigravity',
        cwd: detectedCwd,
        title,
        closed: false,
        pid: null,
        createdAt: createdAtIso,
        updatedAt: updatedAtIso,
        turnCount: finalTurns.length,
        traceSessionId,
        currentModel: activeModel,
        availableModels: Array.from(new Set([activeModel, ...prof.recommendedModels])),
        interrupted: lastInterrupted,
        lastError: lastErrorText || undefined,
      };

      const contract: Session = {
        id: traceSessionId,
        sourceId: cid,
        source: {
          kind: 'antigravity',
          format: 'antigravity/transcript-jsonl',
          adapter: 'antigravity-ls@1.0',
          path: transcriptPath,
          size: stat.size,
          mtimeMs: stat.mtimeMs,
        },
        title,
        agent: {
          product: prof.product,
          name: sessionName,
          role: 'main',
          model: activeModel,
          originator: 'antigravity',
        },
        cwd: detectedCwd,
        startedAt: createdAtIso,
        updatedAt: updatedAtIso,
        links: childLinks,
        turns: finalTurns,
        state: {
          status: isRunning ? 'working' : lastInterrupted ? 'failed' : 'idle',
          detail: lastInterrupted
            ? `流中断待续跑 (${sessionName})`
            : `Antigravity Brain: ${sessionName} (${cid.slice(0, 8)})`,
        },
        stats: {
          turns: finalTurns.length,
          modelCalls,
          toolCalls,
          toolErrors,
          messages: finalTurns.length,
          compactions: 0,
          subagents,
          records: lines.length,
          skipped: 0,
        },
        notes: [],
      };

      const entry = { mtimeMs: stat.mtimeMs, info, contract };
      this.agySummaryCache.set(cid, entry);
      return entry;
    } catch {
      return null;
    }
  }

  /**
   * An Antigravity conversation whose transcript is gone (older versions did not keep one, 16 such on 2026-10-18)
   * but whose brain folder still holds what it produced: task.md, implementation_plan.md, walkthrough.md. Antigravity
   * still lists it, so we do too, honestly marked, showing those documents as its content.
   */
  private parseAntigravityArtifactsOnly(
    cid: string,
    reverseNameMap: Map<string, string>,
  ): { info: AcpxSessionInfo; contract: Session } | null {
    const dir = join(this.agyBrainDir, cid);
    let names: string[] = [];
    try {
      names = readdirSync(dir).filter((n) => /\.md$/i.test(n));
    } catch {
      return null;
    }
    const order = ['task.md', 'implementation_plan.md', 'walkthrough.md'];
    names.sort((a, b) => (order.indexOf(a) + 1 || 9) - (order.indexOf(b) + 1 || 9));
    const docs = names
      .map((n) => {
        try {
          return { name: n, text: readFileSync(join(dir, n), 'utf8') };
        } catch {
          return null;
        }
      })
      .filter((d): d is { name: string; text: string } => Boolean(d && d.text.trim()));
    let row: { lm?: string; ws?: string; title?: string } = {};
    try {
      const db = new DatabaseSync(join(homedir(), '.gemini', 'antigravity', 'conversation_summaries.db'), { readOnly: true });
      try {
        row = (db.prepare('SELECT last_modified_time AS lm, workspace_uris AS ws, title FROM conversation_summaries WHERE conversation_id = ?').get(cid) as typeof row) || {};
      } finally {
        db.close();
      }
    } catch {}
    const at = row.lm ? new Date(String(row.lm).replace(' ', 'T').replace(/(\.\d{3})\d*/, '$1')).toISOString() : new Date(statSync(dir).mtimeMs).toISOString();
    let cwd = this.repoRoot;
    try {
      const uri = (JSON.parse(String(row.ws || '[]')) as string[])[0];
      if (uri) cwd = decodeURIComponent(uri.replace(/^file:\/\/\//, '')).replace(/\//g, '\\');
    } catch {}
    // Only conversations Antigravity itself still lists; an empty one is shown as empty rather than left out.
    if (!docs.length && !row.lm) return null;
    const heading = docs.map((d) => /^#+\s+(.+)$/m.exec(d.text)?.[1]).find(Boolean) || row.title || docs[0]?.name || '（没有留下内容的对话）';
    const sessionName = reverseNameMap.get(cid) || `agy-${cid.slice(0, 8)}`;
    const title = heading.replace(/\s+/g, ' ').slice(0, 110);
    const traceSessionId = `antigravity:${cid}`;
    const steps: Step[] = [
      { id: 's1', kind: 'event', name: 'note', text: docs.length ? '这个对话的记录文件已经不在了，下面是它留下的产出物' : '这个对话没有留下记录文件，也没有产出物', at },
      ...docs.map((d, i) => ({ id: `s${i + 2}`, kind: 'model' as const, at, text: `**${d.name}**\n\n${d.text.slice(0, 40000)}`, phase: 'final' as const, calls: [] })),
    ];
    const turn: Turn = { id: 't1', index: 1, status: 'completed', startedAt: at, endedAt: at, steps };
    const info: AcpxSessionInfo = {
      acpxRecordId: traceSessionId,
      acpSessionId: cid,
      sessionName,
      channel: 'antigravity',
      channelId: 'antigravity',
      cwd,
      title,
      closed: false,
      pid: null,
      createdAt: at,
      updatedAt: at,
      turnCount: 1,
      traceSessionId,
      currentModel: CHANNEL_PROFILES.antigravity.defaultModel,
      availableModels: CHANNEL_PROFILES.antigravity.recommendedModels,
    };
    const contract: Session = {
      id: traceSessionId,
      sourceId: cid,
      source: { kind: 'antigravity', format: 'antigravity/brain-artifacts', adapter: 'antigravity-ls@1.0', path: dir },
      title,
      agent: { product: 'Antigravity', name: sessionName, role: 'main', originator: 'antigravity' },
      cwd,
      startedAt: at,
      updatedAt: at,
      links: [],
      turns: [turn],
      state: { status: 'idle', detail: docs.length ? '只剩产出物，对话记录已不在' : '空对话' },
      stats: { turns: 1, modelCalls: 0, toolCalls: 0, toolErrors: 0, messages: 0, compactions: 0, subagents: 0, records: docs.length, skipped: 0 },
      notes: ['transcript missing; artifacts only'],
    };
    return { info, contract };
  }

  /** List all Antigravity sessions from `~/.gemini/antigravity/brain/<cid>/.system_generated/logs/transcript.jsonl`. */
  public listAntigravitySessions(): AcpxSessionInfo[] {
    if (this.agyListCache && Date.now() - this.agyListCache.at < 8_000) {
      return this.agyListCache.list;
    }
    if (!existsSync(this.agyBrainDir)) return [];
    const nameMap = this.loadAgySessionMap();
    const reverseNameMap = new Map<string, string>();
    for (const [sName, cid] of Object.entries(nameMap)) {
      if (cid) reverseNameMap.set(cid, sName);
    }

    const out: AcpxSessionInfo[] = [];
    try {
      for (const d of readdirSync(this.agyBrainDir, { withFileTypes: true })) {
        if (!d.isDirectory()) continue;
        const cid = d.name;
        const transcriptPath = join(this.agyBrainDir, cid, '.system_generated', 'logs', 'transcript.jsonl');
        if (!existsSync(transcriptPath)) {
          const docsOnly = this.parseAntigravityArtifactsOnly(cid, reverseNameMap);
          if (docsOnly) out.push(docsOnly.info);
          continue;
        }
        const parsed = this.parseAntigravityBrain(cid, transcriptPath, reverseNameMap);
        if (parsed && parsed.info.turnCount > 0) {
          out.push(parsed.info);
        }
      }
    } catch {}
    out.sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
    this.agyListCache = { at: Date.now(), list: out };
    return out;
  }

  /** Parse a single WorkBuddy Desktop `.jsonl` session from `~/.workbuddy/projects/<project>/<id>.jsonl`. */
  private parseWorkbuddyJsonlSession(
    sessionId: string,
    jsonlPath: string,
    dbMeta?: { title?: string; cwd?: string; createdAtMs?: number; updatedAtMs?: number },
  ): { info: AcpxSessionInfo; contract: Session } | null {
    try {
      const stat = statSync(jsonlPath);
      const cached = this.wbSummaryCache.get(sessionId);
      const prof = CHANNEL_PROFILES.workbuddy;
      const sessionName = `wb-${sessionId.slice(0, 8)}`;
      const slot = this.slotKey('workbuddy', sessionName);
      const activeModel = prof.defaultModel;
      const isRunning = this.activeRuns.get(slot)?.status === 'running';

      if (cached && cached.mtimeMs === stat.mtimeMs) {
        cached.contract.state.status = isRunning ? 'working' : 'idle';
        return cached;
      }

      const lines = readFileSync(jsonlPath, 'utf8')
        .split(/\r?\n/)
        .filter((l) => l.trim());
      const turns: Turn[] = [];
      let curSteps: Step[] = [];
      let curInput = '';
      let curOutput = '';
      let curStartedAt = '';
      let curEndedAt = '';
      let firstAt = '';
      let lastAt = '';
      let turnIdx = 0;
      let stepSeq = 0;
      let modelCalls = 0;
      let toolCalls = 0;
      let toolErrors = 0;
      let detectedCwd = dbMeta?.cwd || this.repoRoot;
      let reasoningBuf = '';
      let pendingTools: Step[] = [];
      let pendingCallIds: string[] = [];
      const toolStepByCallId = new Map<string, Step>();

      const flushModelAndTools = (text?: string, atIso?: string) => {
        if (!reasoningBuf && !text && !pendingTools.length) return;
        modelCalls++;
        stepSeq++;
        curSteps.push({
          id: `s${stepSeq}`,
          kind: 'model',
          model: activeModel,
          at: atIso || undefined,
          reasoning: reasoningBuf || undefined,
          text: text || undefined,
          phase: pendingTools.length && !text ? 'commentary' : 'final',
          calls: pendingCallIds,
        });
        curSteps.push(...pendingTools);
        reasoningBuf = '';
        pendingTools = [];
        pendingCallIds = [];
      };

      const flushTurn = () => {
        flushModelAndTools();
        if (!curSteps.length) return;
        turnIdx++;
        turns.push({
          id: `t${turnIdx}`,
          index: turnIdx,
          status: 'completed',
          startedAt: curStartedAt || firstAt || new Date(stat.mtimeMs).toISOString(),
          endedAt: curEndedAt || lastAt || new Date(stat.mtimeMs).toISOString(),
          input: curInput || undefined,
          output: curOutput || undefined,
          steps: curSteps,
        });
        curSteps = [];
        curInput = '';
        curOutput = '';
        curStartedAt = '';
        curEndedAt = '';
      };

      for (const line of lines) {
        try {
          const obj = JSON.parse(line);
          const tsNum = Number(obj.timestamp || 0);
          const atIso = tsNum > 0 ? new Date(tsNum).toISOString() : '';
          if (atIso) {
            if (!firstAt) firstAt = atIso;
            lastAt = atIso;
          }
          if (typeof obj.cwd === 'string' && obj.cwd.trim()) {
            detectedCwd = obj.cwd.trim();
          }

          if (obj.type === 'message' && obj.role === 'user') {
            flushTurn();
            curStartedAt = atIso;
            const rawTexts = (Array.isArray(obj.content) ? obj.content : [])
              .map((c: any) => String(c?.text || ''))
              .filter(Boolean)
              .join('\n');
            const cleanText = stripWorkbuddyUserText(rawTexts);
            curInput = cleanText;
            stepSeq++;
            curSteps.push({
              id: `s${stepSeq}`,
              kind: 'message',
              role: 'user',
              text: cleanText,
              at: atIso || undefined,
            });
          } else if (obj.type === 'reasoning') {
            if (pendingTools.length) flushModelAndTools(undefined, atIso);
            const rItems: any[] = Array.isArray(obj.rawContent)
              ? obj.rawContent
              : Array.isArray(obj.content)
              ? obj.content
              : [];
            const rText = rItems
              .map((c: any) => String(c?.text || ''))
              .filter(Boolean)
              .join('\n')
              .trim();
            if (rText) {
              reasoningBuf += (reasoningBuf ? '\n\n' : '') + rText;
            }
          } else if (obj.type === 'function_call') {
            const cid = String(obj.callId || obj.id || `wb_tc_${++stepSeq}`);
            const tName = String(obj.name || 'tool');
            const argStr =
              typeof obj.arguments === 'string'
                ? obj.arguments
                : obj.arguments
                ? JSON.stringify(obj.arguments, null, 2)
                : '';
            const cls = classifyTool(tName, argStr);
            toolCalls++;
            pendingCallIds.push(cid);
            const tStep: Step = {
              id: cid,
              kind: 'tool',
              name: tName,
              family: cls.family,
              callId: cid,
              input: argStr || undefined,
              status: 'ok',
              at: atIso || undefined,
              effects: [],
            };
            pendingTools.push(tStep);
            toolStepByCallId.set(cid, tStep);
          } else if (obj.type === 'function_call_result') {
            const cid = String(obj.callId || '');
            const existing = toolStepByCallId.get(cid);
            const outStr =
              typeof obj.output === 'string'
                ? obj.output
                : obj.output
                ? JSON.stringify(obj.output, null, 2)
                : '';
            const isErr = obj.status === 'error' || obj.status === 'failed';
            if (isErr) toolErrors++;
            if (existing && existing.kind === 'tool') {
              existing.output = outStr || undefined;
              existing.status = isErr ? 'error' : 'ok';
            }
          } else if (obj.type === 'message' && obj.role === 'assistant') {
            curEndedAt = atIso || curEndedAt;
            const outTexts = (Array.isArray(obj.content) ? obj.content : [])
              .map((c: any) => String(c?.text || ''))
              .filter(Boolean)
              .join('\n')
              .trim();
            if (outTexts) {
              curOutput = outTexts;
              flushModelAndTools(outTexts, atIso);
            }
          }
        } catch {}
      }
      flushTurn();

      if (turns.length === 0) return null;

      const createdAtIso =
        firstAt ||
        (dbMeta?.createdAtMs ? new Date(dbMeta.createdAtMs).toISOString() : new Date(stat.birthtimeMs || stat.mtimeMs).toISOString());
      const updatedAtIso =
        lastAt ||
        (dbMeta?.updatedAtMs ? new Date(dbMeta.updatedAtMs).toISOString() : new Date(stat.mtimeMs).toISOString());
      const rawTitle = dbMeta?.title || turns[0]?.input || `WorkBuddy · ${sessionName}`;
      const title = String(rawTitle).replace(/\s+/g, ' ').slice(0, 110);
      const traceSessionId = `workbuddy:${sessionId}`;

      const info: AcpxSessionInfo = {
        acpxRecordId: traceSessionId,
        acpSessionId: sessionId,
        sessionName,
        channel: 'workbuddy',
        channelId: 'workbuddy',
        cwd: detectedCwd,
        title,
        closed: false,
        pid: null,
        createdAt: createdAtIso,
        updatedAt: updatedAtIso,
        turnCount: turns.length,
        traceSessionId,
        currentModel: activeModel,
        availableModels: [...prof.recommendedModels],
      };

      const contract: Session = {
        id: traceSessionId,
        sourceId: sessionId,
        source: {
          kind: 'workbuddy',
          format: 'workbuddy/projects-jsonl',
          adapter: 'workbuddy-desktop@1.0',
          path: jsonlPath,
          size: stat.size,
          mtimeMs: stat.mtimeMs,
        },
        title,
        agent: {
          product: prof.product,
          name: sessionName,
          role: 'main',
          model: activeModel,
          originator: 'workbuddy',
        },
        cwd: detectedCwd,
        startedAt: createdAtIso,
        updatedAt: updatedAtIso,
        links: [],
        turns,
        state: {
          status: isRunning ? 'working' : 'idle',
          detail: `WorkBuddy 桌面会话: ${sessionName}`,
        },
        stats: {
          turns: turns.length,
          modelCalls,
          toolCalls,
          toolErrors,
          messages: turns.length,
          compactions: 0,
          subagents: 0,
          records: lines.length,
          skipped: 0,
        },
        notes: [],
      };

      const entry = { mtimeMs: stat.mtimeMs, info, contract };
      this.wbSummaryCache.set(sessionId, entry);
      return entry;
    } catch {
      return null;
    }
  }

  /** List all WorkBuddy Desktop sessions from `~/.workbuddy/projects/<project>/<id>.jsonl` + `~/.workbuddy/workbuddy.db`. */
  public listWorkbuddyDesktopSessions(excludeAcpIds?: Set<string>): AcpxSessionInfo[] {
    if (!excludeAcpIds && this.wbListCache && Date.now() - this.wbListCache.at < 10_000) {
      return this.wbListCache.list;
    }
    const projectsDir = join(this.wbDir, 'projects');
    if (!existsSync(projectsDir)) return [];

    const dbMap = new Map<string, { title?: string; cwd?: string; createdAtMs?: number; updatedAtMs?: number }>();
    const dbPath = join(this.wbDir, 'workbuddy.db');
    if (existsSync(dbPath)) {
      try {
        const db = new DatabaseSync(dbPath, { readOnly: true });
        const rows = db
          .prepare('SELECT id, title, custom_title, cwd, created_at, updated_at FROM sessions WHERE deleted_at IS NULL')
          .all() as any[];
        for (const r of rows) {
          if (r?.id) {
            dbMap.set(String(r.id), {
              title: String(r.custom_title || r.title || '').trim() || undefined,
              cwd: String(r.cwd || '').trim() || undefined,
              createdAtMs: Number(r.created_at || 0) || undefined,
              updatedAtMs: Number(r.updated_at || 0) || undefined,
            });
          }
        }
        db.close();
      } catch {}
    }

    const out: AcpxSessionInfo[] = [];
    try {
      for (const proj of readdirSync(projectsDir, { withFileTypes: true })) {
        if (!proj.isDirectory()) continue;
        const pFull = join(projectsDir, proj.name);
        for (const f of readdirSync(pFull)) {
          if (!f.endsWith('.jsonl') || f.includes('.compact.')) continue;
          const sid = f.replace(/\.jsonl$/, '');
          const parsed = this.parseWorkbuddyJsonlSession(sid, join(pFull, f), dbMap.get(sid));
          if (excludeAcpIds?.has(sid)) continue;
          if (parsed && parsed.info.turnCount > 0) {
            out.push(parsed.info);
          }
        }
      }
    } catch {}
    out.sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
    if (!excludeAcpIds) {
      this.wbListCache = { at: Date.now(), list: out };
    }
    return out;
  }

  /** Load and cache Hermes sessions from `AppData/Local/hermes/state.db` and `profiles/eni/state.db`. */
  private loadHermesSessions(force = false): Map<string, { info: AcpxSessionInfo; contract: Session }> {
    if (!force && this.hermesCache && Date.now() - this.hermesCache.at < 15_000) {
      return this.hermesCache.sessions;
    }
    const map = new Map<string, { info: AcpxSessionInfo; contract: Session }>();
    const prof = CHANNEL_PROFILES.hermes;
    const dbPaths = [
      join(this.hermesDir, 'state.db'),
      join(this.hermesDir, 'profiles', 'eni', 'state.db'),
    ].filter((p) => existsSync(p));

    for (const dbPath of dbPaths) {
      try {
        const dbStat = statSync(dbPath);
        const db = new DatabaseSync(dbPath, { readOnly: true });
        const sessRows = db
          .prepare('SELECT * FROM sessions WHERE COALESCE(message_count, 0) > 0 ORDER BY started_at DESC')
          .all() as any[];
        const msgStmt = db.prepare('SELECT * FROM messages WHERE session_id = ? ORDER BY timestamp ASC, id ASC');

        for (const sRow of sessRows) {
          const sid = String(sRow.id || '').trim();
          if (!sid || map.has(sid)) continue;
          const msgs = msgStmt.all(sid) as any[];
          if (!msgs.length) continue;

          let detectedCwd = String(sRow.cwd || '').trim() || this.repoRoot;
          if (!sRow.cwd && typeof sRow.model_config === 'string') {
            try {
              const mc = JSON.parse(sRow.model_config);
              if (typeof mc?.cwd === 'string' && mc.cwd.trim()) detectedCwd = mc.cwd.trim();
            } catch {}
          }

          const turns: Turn[] = [];
          let curSteps: Step[] = [];
          let curInput = '';
          let curOutput = '';
          let curStartedAt = '';
          let curEndedAt = '';
          let turnIdx = 0;
          let stepSeq = 0;
          let modelCalls = 0;
          let toolCalls = 0;
          let toolErrors = 0;
          const toolByCallId = new Map<string, Step>();

          const flushTurn = () => {
            if (!curSteps.length) return;
            turnIdx++;
            turns.push({
              id: `t${turnIdx}`,
              index: turnIdx,
              status: 'completed',
              startedAt: curStartedAt || new Date((Number(sRow.started_at) || Date.now() / 1000) * 1000).toISOString(),
              endedAt: curEndedAt || curStartedAt || new Date((Number(sRow.started_at) || Date.now() / 1000) * 1000).toISOString(),
              input: curInput || undefined,
              output: curOutput || undefined,
              steps: curSteps,
            });
            curSteps = [];
            curInput = '';
            curOutput = '';
            curStartedAt = '';
            curEndedAt = '';
          };

          for (const m of msgs) {
            const role = String(m.role || '');
            const atIso = m.timestamp ? new Date(Number(m.timestamp) * 1000).toISOString() : '';
            const contentStr = String(m.content || '').trim();

            if (role === 'user') {
              flushTurn();
              curStartedAt = atIso;
              curInput = contentStr;
              stepSeq++;
              curSteps.push({
                id: `s${stepSeq}`,
                kind: 'message',
                role: 'user',
                text: contentStr,
                at: atIso || undefined,
              });
            } else if (role === 'assistant') {
              curEndedAt = atIso || curEndedAt;
              const reasoningStr = String(m.reasoning || m.reasoning_content || '').trim();
              if (contentStr) curOutput = contentStr;

              let rawCalls: any[] = [];
              if (typeof m.tool_calls === 'string' && m.tool_calls.trim()) {
                try {
                  const parsed = JSON.parse(m.tool_calls);
                  if (Array.isArray(parsed)) rawCalls = parsed;
                } catch {}
              }

              const callIds: string[] = [];
              const tSteps: Step[] = [];
              for (let i = 0; i < rawCalls.length; i++) {
                const tc = rawCalls[i];
                const cid = String(tc?.call_id || tc?.id || `hm_tc_${stepSeq}_${i + 1}`);
                const fnName = String(tc?.function?.name || tc?.name || 'tool');
                const fnArgs =
                  typeof tc?.function?.arguments === 'string'
                    ? tc.function.arguments
                    : tc?.function?.arguments
                    ? JSON.stringify(tc.function.arguments, null, 2)
                    : '';
                const cls = classifyTool(fnName, fnArgs);
                toolCalls++;
                callIds.push(cid);
                const st: Step = {
                  id: cid,
                  kind: 'tool',
                  name: fnName,
                  family: cls.family,
                  callId: cid,
                  input: fnArgs || undefined,
                  status: 'ok',
                  at: atIso || undefined,
                  effects: [],
                };
                tSteps.push(st);
                toolByCallId.set(cid, st);
              }

              if (reasoningStr || contentStr || tSteps.length) {
                modelCalls++;
                stepSeq++;
                curSteps.push({
                  id: `s${stepSeq}`,
                  kind: 'model',
                  model: prof.defaultModel,
                  at: atIso || undefined,
                  reasoning: reasoningStr || undefined,
                  text: contentStr || undefined,
                  phase: tSteps.length ? 'commentary' : 'final',
                  calls: callIds,
                });
                curSteps.push(...tSteps);
              }
            } else if (role === 'tool') {
              const cid = String(m.tool_call_id || '');
              const target = toolByCallId.get(cid);
              let outText = contentStr;
              let isErr = false;
              if (contentStr.startsWith('{')) {
                try {
                  const p = JSON.parse(contentStr);
                  if (typeof p.output === 'string') outText = p.output;
                  if (p.error || (typeof p.exit_code === 'number' && p.exit_code !== 0)) isErr = true;
                } catch {}
              }
              if (isErr) toolErrors++;
              if (target && target.kind === 'tool') {
                target.output = outText || undefined;
                target.status = isErr ? 'error' : 'ok';
              }
            }
          }
          flushTurn();

          if (!turns.length) continue;
          const realTurns = turns.filter((t) => !isSmokeTestPrompt(t.input || ''));
          const finalTurns = (realTurns.length > 0 ? realTurns : turns).map((t, idx) => ({
            ...t,
            id: `t${idx + 1}`,
            index: idx + 1,
          }));

          const sessionName = `hermes-${sid.slice(0, 8)}`;
          const startedIso = sRow.started_at
            ? new Date(Number(sRow.started_at) * 1000).toISOString()
            : finalTurns[0]?.startedAt || new Date(dbStat.mtimeMs).toISOString();
          const updatedIso = sRow.last_activity_at
            ? new Date(Number(sRow.last_activity_at) * 1000).toISOString()
            : finalTurns[finalTurns.length - 1]?.endedAt || startedIso;
          const title = String(sRow.title || finalTurns[0]?.input || `Hermes · ${sessionName}`)
            .replace(/\s+/g, ' ')
            .slice(0, 110);
          const traceSessionId = `hermes:${sid}`;

          const info: AcpxSessionInfo = {
            acpxRecordId: traceSessionId,
            acpSessionId: sid,
            sessionName,
            channel: 'hermes',
            channelId: 'hermes',
            cwd: detectedCwd,
            title,
            closed: false,
            pid: null,
            createdAt: startedIso,
            updatedAt: updatedIso,
            turnCount: finalTurns.length,
            traceSessionId,
            currentModel: prof.defaultModel,
            availableModels: [...prof.recommendedModels],
          };

          const contract: Session = {
            id: traceSessionId,
            sourceId: sid,
            source: {
              kind: 'hermes',
              format: 'hermes/state-sqlite',
              adapter: 'hermes-acp@0.21.1',
              path: dbPath,
              size: dbStat.size,
              mtimeMs: dbStat.mtimeMs,
            },
            title,
            agent: {
              product: prof.product,
              name: sessionName,
              role: 'main',
              model: prof.defaultModel,
              originator: 'hermes',
            },
            cwd: detectedCwd,
            startedAt: startedIso,
            updatedAt: updatedIso,
            links: [],
            turns: finalTurns,
            state: {
              status: 'idle',
              detail: `Hermes 会话 (${sRow.source || 'cli'}): ${sessionName}`,
            },
            stats: {
              turns: finalTurns.length,
              modelCalls,
              toolCalls,
              toolErrors,
              messages: finalTurns.length,
              compactions: 0,
              subagents: 0,
              records: msgs.length,
              skipped: 0,
            },
            notes: [],
          };

          map.set(sid, { info, contract });
        }
        db.close();
      } catch {}
    }

    this.hermesCache = { at: Date.now(), sessions: map };
    return map;
  }

  /** The folder an existing session was created in. acpx finds a named session by its folder. */
  private existingSessionCwd(prof: ChannelProfile, sessionName: string): string | undefined {
    const hit = this.listAcpxSessions()
      .filter((s) => s.channel === prof.id && s.sessionName === sessionName && s.cwd)
      .sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')))[0];
    return hit?.cwd && existsSync(hit.cwd) ? hit.cwd : undefined;
  }

  /**
   * Where a session runs. A real folder the user picked wins. Otherwise an existing session keeps its own
   * folder (even if a page sends NEW_CWD out of date), and a new session gets a new empty folder.
   */
  private resolveSessionCwd(prof: ChannelProfile, sessionName: string, requested?: string): string {
    const want = String(requested || '').trim();
    if (want && want !== NEW_CWD && existsSync(want)) return resolve(want);
    const own = this.selectedCwds.get(this.slotKey(prof.id, sessionName)) || this.existingSessionCwd(prof, sessionName);
    if (own && own !== NEW_CWD && existsSync(own)) return own;
    const safeName = sessionName.replace(/[^\w.-]+/g, '-').slice(0, 40) || prof.id;
    const stamp = new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
    const dir = join(WORKSPACE_ROOT, `${prof.id}-${safeName}-${stamp}`);
    mkdirSync(dir, { recursive: true });
    return dir;
  }

  /** Explicitly register a brand-new session slot for a channel so UI + Backend stay in sync immediately. */
  public createNewSession(params: { channel: string; sessionName?: string; cwd?: string; model?: string }) {
    const prof = resolveChannel(params.channel) || CHANNEL_PROFILES.codex;
    const now = new Date();
    const hhmmss = now.toTimeString().slice(0, 8).replace(/:/g, '');
    const sessionName = (params.sessionName || '').trim() || `${prof.id}-${hhmmss}`;
    const slot = this.slotKey(prof.id, sessionName);
    // A new session defaults to a new folder; picking a folder for one session no longer changes the
    // channel-wide default for the next one.
    const cwd = this.resolveSessionCwd(prof, sessionName, params.cwd);
    this.selectedCwds.set(slot, cwd);
    const traceSessionId = `new:${prof.id}:${sessionName}`;
    const isoNow = now.toISOString();
    const rawCandidate =
      (params.model || '').trim() ||
      this.selectedModels.get(slot) ||
      this.selectedModels.get(prof.id) ||
      prof.defaultModel;
    const chosenModel = prof.recommendedModels.includes(rawCandidate) ? rawCandidate : prof.defaultModel;
    this.selectedModels.set(slot, chosenModel);
    const info: AcpxSessionInfo = {
      acpxRecordId: `new-${prof.id}-${sessionName}`,
      acpSessionId: '',
      sessionName,
      channel: prof.id,
      channelId: prof.id,
      cwd,
      title: `新会话 · ${prof.label} (${sessionName})`,
      closed: false,
      pid: null,
      createdAt: isoNow,
      updatedAt: isoNow,
      turnCount: 0,
      traceSessionId,
      currentModel: chosenModel,
      availableModels: [...prof.recommendedModels],
      isDraft: true,
    };
    this.draftSessions.set(slot, info);
    this.broadcast('state', this.getState());
    return {
      ok: true,
      channel: prof.id,
      channelId: prof.id,
      sessionName,
      traceSessionId,
      currentModel: chosenModel,
      cwd,
      session: this.getAcpxSessionAsContract(traceSessionId),
    };
  }

  private zcodeLazyCache: { mtimeMs: number; map: Record<string, { zcodeSid?: string; cwd?: string }> } | null = null;

  /** Resolve a ZCode ACP lazy placeholder UUID to its backend `sess_<uuid>` via `~/.zcode/v2/acp-lazy-sessions.json`. */
  private resolveZcodeLazySid(acpId: string): string {
    if (!acpId || acpId.startsWith('sess_')) return acpId;
    const lazyPath = join(HOME, '.zcode', 'v2', 'acp-lazy-sessions.json');
    try {
      const st = statSync(lazyPath);
      if (!this.zcodeLazyCache || this.zcodeLazyCache.mtimeMs !== st.mtimeMs) {
        this.zcodeLazyCache = { mtimeMs: st.mtimeMs, map: JSON.parse(readFileSync(lazyPath, 'utf8')) };
      }
      const mapped = this.zcodeLazyCache.map?.[acpId]?.zcodeSid;
      if (mapped) return mapped;
    } catch {}
    return `sess_${acpId}`;
  }

  /** Canonical unified session ID (`<readKind>:<nativeId>`) shared by both Read and Control paths. */
  public canonicalSessionId(channel: ChannelId, acpId: string, recId?: string): string {
    const prof = CHANNEL_PROFILES[channel] || CHANNEL_PROFILES.codex;
    const cleanAcp = String(acpId || '').trim();
    if (!cleanAcp) return recId ? `acpx:${recId}` : `${prof.traceKind}:unknown`;
    const nativeId = channel === 'zcode' ? this.resolveZcodeLazySid(cleanAcp) : cleanAcp;
    return `${prof.traceKind}:${nativeId}`;
  }

  /** Read all `~/.acpx/sessions/*.json` records + Antigravity Brain + WorkBuddy Desktop + Hermes SQLite sessions. */
  public listAcpxSessions(): AcpxSessionInfo[] {
    const out: AcpxSessionInfo[] = [];
    const seenSlots = new Set<string>();
    const seenAcpIds = new Set<string>();
    const byTraceId = new Map<string, number>();

    // 1. Antigravity Brain sessions
    for (const agyInfo of this.listAntigravitySessions()) {
      const slot = this.slotKey('antigravity', agyInfo.sessionName);
      seenSlots.add(slot);
      this.draftSessions.delete(slot);
      byTraceId.set(agyInfo.traceSessionId, out.length);
      out.push(agyInfo);
    }

    // Warm WorkBuddy native JSONL cache first so acpx WorkBuddy records inherit full native turns & cwd.
    const wbDesktopList = this.listWorkbuddyDesktopSessions();

    // 2. ~/.acpx/sessions/*.json records (unified to canonical <traceKind>:<nativeId>)
    if (existsSync(this.acpxDir)) {
      for (const f of readdirSync(this.acpxDir)) {
        if (!f.endsWith('.json')) continue;
        try {
          const fullJsonPath = join(this.acpxDir, f);
          const fStat = statSync(fullJsonPath);
          let cachedJson = this.acpxJsonCache.get(fullJsonPath);
          if (!cachedJson || cachedJson.mtimeMs !== fStat.mtimeMs) {
            cachedJson = { mtimeMs: fStat.mtimeMs, raw: JSON.parse(readFileSync(fullJsonPath, 'utf8')) };
            this.acpxJsonCache.set(fullJsonPath, cachedJson);
          }
          const raw = cachedJson.raw;
          if (!raw || raw.schema !== 'acpx.session.v1') continue;
          const channel = detectChannelFromCommand(raw.agent_command || '');
          const prof = CHANNEL_PROFILES[channel];
          const acpId = String(raw.acp_session_id || '');
          if (acpId) seenAcpIds.add(acpId);
          const recId = String(raw.acpx_record_id || f.replace(/\.json$/, ''));
          const sessionName = String(raw.name || `gw-${channel}`);

          const msgs: any[] = Array.isArray(raw.messages) ? raw.messages : [];
          const realUserPrompts: string[] = [];
          let totalUserTurns = 0;
          for (const m of msgs) {
            if (m?.User) {
              totalUserTurns++;
              const texts = (Array.isArray(m.User.content) ? m.User.content : [])
                .map((c: any) => c?.Text || '')
                .filter(Boolean)
                .join('\n')
                .trim();
              if (texts && !isSmokeTestPrompt(texts)) {
                realUserPrompts.push(texts);
              }
            }
          }

          // Skip pure CLI connectivity smoke-test sessions that have no real user messages
          if (totalUserTurns > 0 && realUserPrompts.length === 0 && /^poc(-|$)/i.test(sessionName)) {
            continue;
          }

          const firstText = (realUserPrompts[0] || raw.title || '').slice(0, 90);
          const traceSessionId = this.canonicalSessionId(channel, acpId, recId);

          const slot = this.slotKey(channel, sessionName);
          seenSlots.add(slot);
          this.draftSessions.delete(slot);

          let rawModel =
            this.selectedModels.get(slot) ||
            (typeof raw.acpx?.current_model_id === 'string' && raw.acpx.current_model_id.trim()) ||
            this.selectedModels.get(channel) ||
            prof.defaultModel;

          // Strictly heal any unverified model (e.g. WorkBuddy space-bunny -> custom-local:glm-5.3)
          if (!prof.recommendedModels.includes(rawModel)) {
            rawModel = prof.defaultModel;
            if (channel === 'workbuddy' && raw.acpx && raw.acpx.current_model_id !== rawModel) {
              try {
                raw.acpx.current_model_id = rawModel;
                writeFileSync(fullJsonPath, JSON.stringify(raw, null, 2), 'utf8');
              } catch {}
            }
          }
          const availableModels = [...prof.recommendedModels];

          const wbNative = channel === 'workbuddy' && acpId ? this.wbSummaryCache.get(acpId) : undefined;
          if (wbNative) {
            wbNative.info.sessionName = sessionName;
            wbNative.contract.agent.name = sessionName;
          }

          const item: AcpxSessionInfo = {
            acpxRecordId: recId,
            acpSessionId: channel === 'zcode' && acpId ? this.resolveZcodeLazySid(acpId) : acpId,
            sessionName,
            channel,
            channelId: channel,
            cwd: raw.cwd || wbNative?.info.cwd || this.repoRoot,
            title: firstText || wbNative?.info.title || `${prof.label} 会话 (${sessionName})`,
            closed: Boolean(raw.closed),
            pid: raw.pid ?? null,
            createdAt: raw.created_at || wbNative?.info.createdAt,
            updatedAt: raw.last_used_at || raw.updated_at || raw.created_at || wbNative?.info.updatedAt,
            turnCount: Math.max(realUserPrompts.length || totalUserTurns, wbNative?.info.turnCount || 0),
            traceSessionId,
            currentModel: rawModel,
            availableModels,
            fromAcpxStore: true,
          };

          const prevIdx = byTraceId.get(traceSessionId);
          if (prevIdx !== undefined) {
            if (String(item.updatedAt || '') >= String(out[prevIdx].updatedAt || '')) {
              out[prevIdx] = item;
            }
          } else {
            byTraceId.set(traceSessionId, out.length);
            out.push(item);
          }
        } catch {
          // Ignore malformed session files
        }
      }
    }

    // 3. WorkBuddy Desktop sessions (~/.workbuddy/projects/*/*.jsonl)
    for (const wbInfo of wbDesktopList) {
      if (seenAcpIds.has(wbInfo.acpSessionId) || byTraceId.has(wbInfo.traceSessionId)) continue;
      const slot = this.slotKey('workbuddy', wbInfo.sessionName);
      if (!seenSlots.has(slot)) {
        seenSlots.add(slot);
        byTraceId.set(wbInfo.traceSessionId, out.length);
        out.push(wbInfo);
      }
    }

    // 4. Hermes SQLite sessions (AppData/Local/hermes/state.db)
    for (const [sid, entry] of this.loadHermesSessions().entries()) {
      if (seenAcpIds.has(sid) || byTraceId.has(entry.info.traceSessionId)) continue;
      const slot = this.slotKey('hermes', entry.info.sessionName);
      if (!seenSlots.has(slot)) {
        seenSlots.add(slot);
        byTraceId.set(entry.info.traceSessionId, out.length);
        out.push(entry.info);
      }
    }

    // 5. Draft sessions
    for (const [slot, draft] of this.draftSessions.entries()) {
      if (!seenSlots.has(slot)) {
        const chosen = this.selectedModels.get(slot) || draft.currentModel;
        out.push(chosen ? { ...draft, currentModel: chosen } : draft);
      }
    }

    out.sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
    return out;
  }

  /** Synthesize a `@hub-trace/contract` Session from Antigravity Brain, WorkBuddy Desktop, Hermes SQLite, `~/.acpx/sessions/<id>.json`, or `new:<channel>:<name>`. */
  public getAcpxSessionAsContract(idOrRecordId: string): Session | null {
    // 1. Antigravity Brain session
    if (
      idOrRecordId.startsWith('antigravity:') ||
      idOrRecordId.startsWith('agy:') ||
      existsSync(join(this.agyBrainDir, idOrRecordId, '.system_generated', 'logs', 'transcript.jsonl'))
    ) {
      const cid = idOrRecordId.replace(/^(antigravity|agy):/, '');
      const transcriptPath = join(this.agyBrainDir, cid, '.system_generated', 'logs', 'transcript.jsonl');
      if (existsSync(transcriptPath)) {
        const nameMap = this.loadAgySessionMap();
        const reverseNameMap = new Map<string, string>();
        for (const [sName, mappedCid] of Object.entries(nameMap)) {
          if (mappedCid) reverseNameMap.set(mappedCid, sName);
        }
        const parsed = this.parseAntigravityBrain(cid, transcriptPath, reverseNameMap);
        if (parsed) return parsed.contract;
      } else if (existsSync(join(this.agyBrainDir, cid))) {
        const docsOnly = this.parseAntigravityArtifactsOnly(cid, new Map());
        if (docsOnly) return docsOnly.contract;
      }
    }

    // 2. WorkBuddy Desktop session (workbuddy:<uuid>) — falls through to .acpx/sessions if native JSONL has 0 turns
    if (idOrRecordId.startsWith('workbuddy:')) {
      const sid = idOrRecordId.slice('workbuddy:'.length);
      let cached = this.wbSummaryCache.get(sid);
      if (!cached) {
        this.listWorkbuddyDesktopSessions();
        cached = this.wbSummaryCache.get(sid);
      }
      if (cached && cached.contract.turns.length > 0) return cached.contract;
    }

    // 3. Hermes SQLite session (hermes:<id>) — falls through to .acpx/sessions if not in state.db
    if (idOrRecordId.startsWith('hermes:')) {
      const sid = idOrRecordId.slice('hermes:'.length);
      const map = this.loadHermesSessions();
      const found = map.get(sid) || this.loadHermesSessions(true).get(sid);
      if (found && found.contract.turns.length > 0) return found.contract;
    }

    if (idOrRecordId.startsWith('new:')) {
      const parts = idOrRecordId.split(':');
      const chRaw = parts[1] || 'codex';
      const sName = parts.slice(2).join(':') || `${chRaw}-new`;
      const prof = resolveChannel(chRaw) || CHANNEL_PROFILES.codex;
      if (prof.id === 'antigravity') {
        const agyMap = this.loadAgySessionMap();
        const mappedCid = agyMap[sName];
        if (mappedCid) {
          const agySess = this.getAcpxSessionAsContract(`antigravity:${mappedCid}`);
          if (agySess && agySess.turns.length > 0) return agySess;
        }
      }
      if (existsSync(this.acpxDir)) {
        for (const f of readdirSync(this.acpxDir)) {
          if (!f.endsWith('.json')) continue;
          try {
            const r = JSON.parse(readFileSync(join(this.acpxDir, f), 'utf8'));
            if (r.name === sName && Array.isArray(r.messages) && r.messages.length > 0) {
              return this.getAcpxSessionAsContract(r.acpx_record_id || f.replace(/\.json$/, ''));
            }
          } catch {}
        }
      }
      const slot = this.slotKey(prof.id, sName);
      const draft = this.draftSessions.get(slot);
      const now = draft?.createdAt || new Date().toISOString();
      const isRunning = this.activeRuns.get(slot)?.status === 'running';
      const rawCand =
        this.selectedModels.get(slot) ||
        draft?.currentModel ||
        this.selectedModels.get(prof.id) ||
        prof.defaultModel;
      const activeModel = prof.recommendedModels.includes(rawCand) ? rawCand : prof.defaultModel;
      return {
        id: idOrRecordId,
        sourceId: sName,
        source: {
          kind: prof.traceKind,
          format: prof.id === 'antigravity' ? 'antigravity/transcript-jsonl' : 'acpx/session-v1',
          adapter: prof.id === 'antigravity' ? 'antigravity-ls@1.0' : 'acpx@0.19.5',
          path: join(this.acpxDir, `${sName}.json`),
          size: 0,
          mtimeMs: Date.now(),
        },
        title: `新会话 · ${prof.label} (${sName})`,
        agent: {
          product: prof.product,
          name: sName,
          role: 'main',
          model: activeModel,
          originator: prof.id,
        },
        cwd: draft?.cwd || this.repoRoot,
        startedAt: now,
        updatedAt: now,
        links: [],
        turns: [],
        state: {
          status: isRunning ? 'working' : 'idle',
          detail: `新建会话槽: ${sName}`,
        },
        stats: {
          turns: 0,
          modelCalls: 0,
          toolCalls: 0,
          toolErrors: 0,
          messages: 0,
          compactions: 0,
          subagents: 0,
          records: 0,
          skipped: 0,
        },
        notes: [],
      };
    }

    if (!existsSync(this.acpxDir)) return null;
    const cleanId = idOrRecordId.startsWith('acpx:')
      ? idOrRecordId.slice(5)
      : idOrRecordId.includes(':')
      ? idOrRecordId.split(':').slice(1).join(':')
      : idOrRecordId;
    let targetFile = join(this.acpxDir, `${cleanId}.json`);
    if (!existsSync(targetFile)) {
      for (const f of readdirSync(this.acpxDir)) {
        if (!f.endsWith('.json')) continue;
        try {
          const r = JSON.parse(readFileSync(join(this.acpxDir, f), 'utf8'));
          const rCh = detectChannelFromCommand(r.agent_command || '');
          const rRecId = String(r.acpx_record_id || f.replace(/\.json$/, ''));
          const rCanon = this.canonicalSessionId(rCh, String(r.acp_session_id || ''), rRecId);
          if (
            rCanon === idOrRecordId ||
            r.name === cleanId ||
            r.acp_session_id === cleanId ||
            r.acpx_record_id === cleanId
          ) {
            targetFile = join(this.acpxDir, f);
            break;
          }
        } catch {}
      }
    }
    if (!existsSync(targetFile)) return null;

    try {
      const raw = JSON.parse(readFileSync(targetFile, 'utf8'));
      const stat = statSync(targetFile);
      const channel = detectChannelFromCommand(raw.agent_command || '');
      const prof = CHANNEL_PROFILES[channel];
      const recId = String(raw.acpx_record_id || cleanId);
      const msgs: any[] = Array.isArray(raw.messages) ? raw.messages : [];
      const turns: Turn[] = [];
      let curSteps: Step[] = [];
      let curInput = '';
      let curOutput = '';
      let turnIdx = 0;
      let modelCalls = 0;
      let toolCalls = 0;
      let toolErrors = 0;
      let messageCount = 0;

      let streamTail = '';
      let streamRefusalError = '';
      const streamPath = raw.event_log?.active_path || targetFile.replace(/\.json$/, '.stream.ndjson');
      if (streamPath && existsSync(streamPath)) {
        try {
          const stStat = statSync(streamPath);
          if (stStat.size <= 512 * 1024) {
            streamTail = readFileSync(streamPath, 'utf8');
            for (const sLine of streamTail.split(/\r?\n/)) {
              if (!sLine.includes('"stopReason"') && !sLine.includes('"error"')) continue;
              try {
                const sObj = JSON.parse(sLine);
                const errMeta = sObj?.result?._meta?.['codebuddy.ai/errorMessage'];
                if (sObj?.result?.stopReason === 'refusal' || errMeta) {
                  streamRefusalError = String(errMeta || '模型拒绝响应或需客户端 OAuth 鉴权 (stopReason: refusal)');
                } else if (sObj?.error?.message) {
                  streamRefusalError = String(sObj.error.message);
                }
              } catch {}
            }
          }
        } catch {}
      }

      const slot = this.slotKey(channel, raw.name || `gw-${channel}`);
      const isRunning = this.activeRuns.get(slot)?.status === 'running';
      const rawCandModel =
        this.selectedModels.get(slot) ||
        (typeof raw.acpx?.current_model_id === 'string' && raw.acpx.current_model_id.trim()) ||
        this.selectedModels.get(channel) ||
        prof.defaultModel;
      const activeModel = prof.recommendedModels.includes(rawCandModel) ? rawCandModel : prof.defaultModel;

      let stepSeq = 0;
      const flushTurn = () => {
        if (!curSteps.length) return;
        turnIdx++;
        const hasAgentResponse = curSteps.some((s) => s.kind === 'model' || s.kind === 'tool');
        let turnStatus: Turn['status'] = 'completed';
        if (!hasAgentResponse && !isRunning) {
          turnStatus = 'failed';
          stepSeq++;
          const diagMsg =
            streamRefusalError ||
            `⚠️ 该轮未收到模型响应（原请求模型不可用或鉴权被拒，现已自动锁定可用模型 ${prof.defaultModel}）。`;
          curSteps.push({
            id: `s${stepSeq}`,
            kind: 'model',
            model: activeModel,
            text: diagMsg,
            phase: 'final',
            calls: [],
          });
          curOutput = diagMsg;
        }
        turns.push({
          id: `t${turnIdx}`,
          index: turnIdx,
          status: turnStatus,
          ...(turnStatus === 'failed' ? { error: curOutput || streamRefusalError || '渠道/模型调用异常' } : {}),
          startedAt: raw.created_at,
          endedAt: raw.last_used_at || raw.updated_at,
          input: curInput || undefined,
          output: curOutput || undefined,
          steps: curSteps,
        });
        curSteps = [];
        curInput = '';
        curOutput = '';
      };

      for (const m of msgs) {
        if (m?.User) {
          flushTurn();
          const texts = (Array.isArray(m.User.content) ? m.User.content : [])
            .map((c: any) => c?.Text || '')
            .filter(Boolean)
            .join('\n');
          curInput = texts;
          messageCount++;
          stepSeq++;
          curSteps.push({
            id: `s${stepSeq}`,
            kind: 'message',
            role: 'user',
            text: texts,
            at: raw.last_prompt_at || raw.created_at,
          });
        } else if (m?.Agent) {
          const contents: any[] = Array.isArray(m.Agent.content) ? m.Agent.content : [];
          const toolResults: Record<string, any> = m.Agent.tool_results || {};
          let reasoningBuf = '';
          let textBuf = '';
          let callIds: string[] = [];
          let pendingToolSteps: Step[] = [];

          const flushModelSegment = () => {
            if (!reasoningBuf && !textBuf && !pendingToolSteps.length) return;
            modelCalls++;
            stepSeq++;
            curSteps.push({
              id: `s${stepSeq}`,
              kind: 'model',
              model: activeModel,
              reasoning: reasoningBuf || undefined,
              text: textBuf || undefined,
              phase: pendingToolSteps.length ? 'commentary' : 'final',
              calls: callIds,
            });
            curSteps.push(...pendingToolSteps);
            reasoningBuf = '';
            textBuf = '';
            callIds = [];
            pendingToolSteps = [];
          };

          for (const item of contents) {
            if (item?.Thinking?.text) {
              if (pendingToolSteps.length) flushModelSegment();
              const t = String(item.Thinking.text).replace(/^Thinking…\s*/i, '').trim();
              if (t) reasoningBuf += (reasoningBuf ? '\n\n' : '') + t;
            } else if (typeof item?.Text === 'string' && item.Text.trim()) {
              if (pendingToolSteps.length) flushModelSegment();
              textBuf += (textBuf ? '\n\n' : '') + item.Text;
              curOutput = item.Text;
            } else if (item?.ToolUse) {
              const tu = item.ToolUse;
              const tid = String(tu.id || `tool_${++stepSeq}`);
              const tr = toolResults[tid];
              const inputStr =
                typeof tu.raw_input === 'string' && tu.raw_input
                  ? tu.raw_input
                  : tu.input
                  ? JSON.stringify(tu.input, null, 2)
                  : '';
              let outStr =
                typeof tr?.output === 'string'
                  ? tr.output
                  : typeof tr?.content?.Text === 'string'
                  ? tr.content.Text
                  : tr?.content
                  ? JSON.stringify(tr.content, null, 2)
                  : '';
              let isErr = Boolean(tr?.is_error);
              if (
                !isErr &&
                !outStr &&
                streamTail &&
                streamTail.includes(tid) &&
                (streamTail.includes('"PERMISSION_DENIED"') ||
                  streamTail.includes('"decision":"deny"') ||
                  streamTail.includes('"optionId":"reject"'))
              ) {
                isErr = true;
                outStr =
                  '⚠️ 权限被拦截 (PERMISSION_DENIED)：此前处于「只读安全 (reads)」模式，acpx 拒绝了命令/写入工具执行。现已默认开启「自动读写 (all)」。';
              }
              const cls = classifyTool(tu.name || 'tool', inputStr);
              toolCalls++;
              if (isErr) toolErrors++;
              callIds.push(tid);
              pendingToolSteps.push({
                id: tid,
                kind: 'tool',
                name: tu.name || 'tool',
                family: cls.family,
                callId: tid,
                input: inputStr || undefined,
                output: outStr || undefined,
                status: isErr ? 'error' : 'ok',
                effects: [],
              });
            }
          }

          flushModelSegment();
        }
      }
      flushTurn();

      // If this is a Hermes acpx session with 0 messages in acpx JSON (because hermes stores messages in state.db), merge from state.db!
      if (channel === 'hermes' && turns.length === 0 && raw.acp_session_id) {
        const hm = this.loadHermesSessions().get(String(raw.acp_session_id));
        if (hm && hm.contract.turns.length > 0) {
          turns.push(...hm.contract.turns);
          modelCalls = hm.contract.stats.modelCalls;
          toolCalls = hm.contract.stats.toolCalls;
          toolErrors = hm.contract.stats.toolErrors;
        }
      }

      const realTurns = turns.filter((t) => !isSmokeTestPrompt(t.input || ''));
      const finalTurns = (realTurns.length > 0 ? realTurns : turns).map((t, idx) => ({
        ...t,
        id: `t${idx + 1}`,
        index: idx + 1,
      }));

      const firstTitle =
        finalTurns[0]?.input?.slice(0, 120) ||
        raw.title ||
        `${prof.label} · ${raw.name || recId.slice(0, 8)}`;

      const canonicalId = this.canonicalSessionId(channel, String(raw.acp_session_id || ''), recId);
      const canonicalSourceId = canonicalId.split(':').slice(1).join(':') || recId;

      return {
        id: canonicalId,
        sourceId: canonicalSourceId,
        source: {
          kind: prof.traceKind,
          format: 'acpx/session-v1',
          adapter: 'acpx@0.19.5',
          path: targetFile,
          size: stat.size,
          mtimeMs: stat.mtimeMs,
        },
        title: firstTitle,
        agent: {
          product: prof.product,
          name: raw.name || prof.label,
          role: 'main',
          model: activeModel,
          originator: prof.id,
        },
        cwd: raw.cwd || this.repoRoot,
        startedAt: raw.created_at,
        updatedAt: raw.last_used_at || raw.updated_at || raw.created_at,
        links: [],
        turns: finalTurns,
        state: {
          status: isRunning ? 'working' : 'idle',
          detail: `acpx 命名会话: ${raw.name || recId.slice(0, 8)}`,
        },
        stats: {
          turns: finalTurns.length,
          modelCalls,
          toolCalls,
          toolErrors,
          messages: finalTurns.length,
          compactions: 0,
          subagents: 0,
          records: msgs.length,
          skipped: 0,
        },
        notes: [],
      };
    } catch {
      return null;
    }
  }

  /** Get synthetic summaries for `acpx` / WorkBuddy / Hermes / Antigravity sessions that aren't already in `SessionStore`. */
  public getExtraSummaries(existingIds: Set<string>): SessionSummary[] {
    const extras: SessionSummary[] = [];
    const seen = new Set(existingIds);
    for (const info of this.listAcpxSessions()) {
      if (seen.has(info.traceSessionId)) continue;
      const full =
        this.getAcpxSessionAsContract(info.traceSessionId) ||
        this.getAcpxSessionAsContract(info.acpxRecordId);
      if (full && full.turns.length > 0) {
        const unifiedId = info.traceSessionId || full.id;
        if (seen.has(unifiedId)) continue;
        seen.add(unifiedId);
        const { turns: _t, ...summary } = full;
        extras.push({ ...summary, id: unifiedId });
      }
    }
    return extras;
  }

  public listWorkspaceDirs(extraSessions?: AcpxSessionInfo[]): string[] {
    const seen = new Set<string>();
    const addDir = (p?: string) => {
      if (!p) return;
      const clean = resolve(String(p).trim());
      if (!seen.has(clean.toLowerCase()) && existsSync(clean)) {
        try {
          if (statSync(clean).isDirectory()) {
            seen.add(clean.toLowerCase());
            dirs.push(clean);
          }
        } catch {}
      }
    };
    const dirs: string[] = [];
    addDir(this.repoRoot);
    addDir(resolve(this.repoRoot, '..'));
    addDir('E:\\program\\GIT\\Agent\\agent-hub');
    addDir('E:\\program\\GIT\\Agent\\ap-vibe');
    addDir('E:\\program\\sota');
    for (const v of this.selectedCwds.values()) addDir(v);
    for (const s of (extraSessions || []).slice(0, 35)) {
      if (s?.cwd) addDir(s.cwd);
    }
    return dirs.slice(0, 14);
  }

  /**
   * Sessions of one channel that the hub manages, with the state the phone page shows:
   * working (a run is going), failed (the last run failed), idle. ACP channels have no in-turn steer, so a
   * message sent while working waits for the next turn (queued counts them).
   */
  /** The run of one named session as the command line sees it: the active turn, else the latest finished one.
   *  With waitMs, a running turn is waited on first. Runs live in memory, so after a restart only the session
   *  record (traceSessionId) is left and the caller reads the transcript instead. */
  public async sessionRun(channelRaw: string, sessionName: string, waitMs = 0) {
    const prof = resolveChannel(channelRaw);
    if (!prof) return { ok: false, error: `未知渠道: ${channelRaw}` };
    const key = this.slotKey(prof.id, sessionName);
    let run: ActiveRun | null | undefined = this.activeRuns.get(key);
    if (run && run.status === 'running' && waitMs > 0) run = (await this.waitForRunCompletion(run.runId, waitMs)) || run;
    if (!run || run.status === 'completed' || run.status === 'failed' || run.status === 'aborted') {
      run = this.recentRuns.find((r) => r.channel === prof.id && r.sessionName === sessionName) || run;
    }
    const record = this.listAcpxSessions().find((s) => s.channel === prof.id && s.sessionName === sessionName);
    const agyId = prof.id === 'antigravity' ? this.loadAgySessionMap()[sessionName] : '';
    // Antigravity keeps its own run state, which survives our restarts: RUNNING is working, the rest is done.
    let agyState = '';
    if (agyId) {
      try {
        const db = new DatabaseSync(join(homedir(), '.gemini', 'antigravity', 'conversation_summaries.db'), { readOnly: true });
        try {
          const deadline = Date.now() + waitMs;
          for (;;) {
            const r = db.prepare('SELECT status, killed, not_fully_idle AS busy FROM conversation_summaries WHERE conversation_id = ?').get(agyId) as { status?: string; killed?: number; busy?: number } | undefined;
            // "waiting": it yielded and waits on its own background task; the work is not done yet.
            agyState = !r ? '' : r.killed ? 'aborted' : String(r.status).endsWith('RUNNING') ? 'running' : r.busy ? 'waiting' : 'completed';
            if ((agyState !== 'running' && agyState !== 'waiting') || run?.status === 'running' || Date.now() >= deadline) break;
            await new Promise((ok) => setTimeout(ok, 3000));
          }
        } finally {
          db.close();
        }
      } catch {}
    }
    if (agyId && run && run.status !== 'running') {
      if (agyState === 'running' || agyState === 'waiting') {
        run = null;
      } else {
        try {
          const tPath = join(this.agyBrainDir, agyId, '.system_generated', 'logs', 'transcript.jsonl');
          const tMtime = statSync(tPath).mtimeMs;
          const runEndMs = Date.parse(run.endedAt || run.startedAt) || 0;
          if (tMtime > runEndMs + 2000) {
            run = null;
          }
        } catch {}
      }
    }
    return {
      agyState: agyState || undefined,
      ok: true,
      channel: prof.id,
      sessionName,
      known: Boolean(run || record || agyId),
      traceSessionId: run?.traceSessionId || record?.traceSessionId || (agyId ? 'antigravity:' + agyId : null),
      queued: (this.queues.get(key) || []).length,
      run: run
        ? {
            runId: run.runId, status: run.status, startedAt: run.startedAt, endedAt: run.endedAt || null,
            durationMs: run.durationMs || Date.now() - Date.parse(run.startedAt), model: run.model, cwd: run.cwd,
            permissions: run.permissions, prompt: run.originalPrompt || run.prompt, reply: run.text || '',
            toolCallsCount: (run.tools || []).length, deniedTools: run.deniedTools || [], error: run.error || null,
          }
        : null,
    };
  }

  /**
   * What this service knows about sessions it ran itself, keyed by the agent's own session id (the part after
   * "<kind>:" in any trace id that names it). A transcript cannot tell a finished-but-unmarked turn from a live
   * one for 30 minutes; the run record can. Rebuilt at most every 2 s.
   */
  private hubRunCache: { at: number; map: Map<string, { status: string; detail: string; endedAt: string }> } = { at: 0, map: new Map() };
  public hubRunStates(): Map<string, { status: string; detail: string; endedAt: string }> {
    if (Date.now() - this.hubRunCache.at < 2000) return this.hubRunCache.map;
    const map = new Map<string, { status: string; detail: string; endedAt: string }>();
    const bySlot = new Map<string, string[]>();
    for (const s of this.listAcpxSessions()) {
      const ids = [s.acpSessionId, String(s.traceSessionId || '').split(':').pop() || ''].filter(Boolean);
      bySlot.set(this.slotKey(s.channel, s.sessionName), ids);
    }
    const put = (r: ActiveRun, status: string, detail: string) => {
      const ids = new Set([...(bySlot.get(this.slotKey(r.channel, r.sessionName)) || []), String(r.traceSessionId || '').split(':').pop() || '']);
      for (const id of ids) if (id && !map.has(id)) map.set(id, { status, detail, endedAt: r.endedAt || '' });
    };
    for (const r of this.activeRuns.values()) if (r.status === 'running') put(r, 'working', '在干活（经 hub 发起）');
    const label: Record<string, [string, string]> = {
      completed: ['idle', '这一轮已完成'],
      aborted: ['aborted', '已被停下'],
      failed: ['failed', '出错停了'],
    };
    for (const r of this.recentRuns) {
      const l = label[r.status];
      if (l) put(r, l[0], l[1] + (r.error ? '：' + String(r.error).slice(0, 80) : ''));
    }
    this.hubRunCache = { at: Date.now(), map };
    return map;
  }

  private bindingCache: {
    at: number;
    map: Map<string, { sessionName: string; fromAcpxStore: boolean; channel: ChannelId; currentModel?: string }>;
  } = { at: 0, map: new Map() };

  public sessionBindings(): Map<string, { sessionName: string; fromAcpxStore: boolean; channel: ChannelId; currentModel?: string }> {
    if (Date.now() - this.bindingCache.at < 2000) return this.bindingCache.map;
    const map = new Map<string, { sessionName: string; fromAcpxStore: boolean; channel: ChannelId; currentModel?: string }>();
    for (const s of this.listAcpxSessions()) {
      const entry = {
        sessionName: s.sessionName,
        fromAcpxStore: Boolean(s.fromAcpxStore),
        channel: s.channel,
        currentModel: s.currentModel,
      };
      if (s.traceSessionId) map.set(s.traceSessionId, entry);
      if (s.acpSessionId && !map.has(s.acpSessionId)) map.set(s.acpSessionId, entry);
    }
    const agyMap = this.loadAgySessionMap();
    for (const [name, cid] of Object.entries(agyMap)) {
      if (cid) {
        map.set('antigravity:' + cid, { sessionName: name, fromAcpxStore: true, channel: 'antigravity' });
      }
    }
    this.bindingCache = { at: Date.now(), map };
    return map;
  }

  public mobileSessions(channelRaw: string, limit = 60) {
    const prof = resolveChannel(channelRaw);
    if (!prof) return [];
    const rows = this.listAcpxSessions()
      .filter((s) => s.channel === prof.id && !s.closed)
      .sort((a, b) => String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || '')))
      .slice(0, limit);
    return rows.map((s) => {
      const key = this.slotKey(prof.id, s.sessionName);
      const active = this.activeRuns.get(key);
      const last = this.recentRuns.find((r) => r.channel === prof.id && r.sessionName === s.sessionName);
      const state = active && active.status === 'running' ? 'working' : last && last.status === 'failed' ? 'failed' : 'idle';
      return {
        id: s.acpSessionId || s.acpxRecordId,
        traceSessionId: s.traceSessionId,
        sessionName: s.sessionName,
        title: s.title || s.sessionName,
        state,
        error: state === 'failed' ? last?.error || s.lastError || '' : '',
        updatedAt: s.updatedAt || s.createdAt || '',
        turns: s.turnCount,
        model: s.currentModel || '',
        cwd: s.cwd,
        queued: (this.queues.get(key) || []).length,
      };
    });
  }

  public getState() {
    const acpxSessions = this.listAcpxSessions();
    const workspaceDirs = this.listWorkspaceDirs(acpxSessions);
    const channels = Object.values(CHANNEL_PROFILES).map((p) => {
      const chSessions = acpxSessions.filter((s) => s.channel === p.id);
      const running = Array.from(this.activeRuns.values()).filter(
        (r) => r.channel === p.id && r.status === 'running',
      );
      let queuedCount = 0;
      for (const [k, q] of this.queues.entries()) {
        if (k.startsWith(p.id + ':')) queuedCount += q.length;
      }
      const rawCandidate =
        this.selectedModels.get(p.id) ||
        chSessions[0]?.currentModel ||
        p.defaultModel;
      const chCurrentModel = p.recommendedModels.includes(rawCandidate) ? rawCandidate : p.defaultModel;
      const chCurrentCwd =
        this.selectedCwds.get(p.id) ||
        chSessions[0]?.cwd ||
        this.repoRoot;

      const health = this.channelFailures.get(p.id) || {
        started: chSessions.reduce((acc, s) => acc + (s.turnCount > 0 ? 1 : 0), 0),
        delivered: chSessions.reduce((acc, s) => acc + (s.turnCount > 0 ? 1 : 0), 0),
        failed: 0,
        consecutiveFailures: 0,
        state: 'closed' as const,
        lastAt: 0,
      };

      return {
        id: p.id,
        label: p.label,
        product: p.product,
        traceKind: p.traceKind,
        defaultModel: p.defaultModel,
        currentModel: chCurrentModel,
        currentCwd: chCurrentCwd,
        recommendedModels: [...p.recommendedModels],
        modes: p.modes || [],
        capabilities: this.registryCapabilities(p),
        capabilityEvidence: this.capabilityRegistry()?.families?.[p.id]?.gateway ?? null,
        accent: p.accent,
        badge: p.badge,
        notes: p.notes,
        status: running.length > 0 ? 'working' : 'idle',
        activeRuns: running.length,
        queuedCount,
        health,
        sessions: chSessions,
      };
    });

    const queuesObj: Record<string, QueuedPrompt[]> = {};
    for (const [k, q] of this.queues.entries()) {
      if (q.length) queuesObj[k] = q;
    }

    return {
      ok: true,
      channels,
      workspaceDirs,
      activeRuns: Array.from(this.activeRuns.values()),
      recentRuns: this.recentRuns.slice(0, 15),
      queues: queuesObj,
      acpxSessions,
      pendingApprovals: this.pendingApprovals.filter((a) => a.status === 'pending'),
      externalAnomalies: this.externalAnomalies,
      metaAgents: this.getMetaAgents(),
      metaAgentLogs: this.getMetaAgentLogs(),
      dispatches: this.getDispatchesSummary(),
    };
  }

  /**
   * Resolve the acpx/antigravity control sessionName for a session: if `traceSessionId` (or a generic `m-<id>`
   * fallback name from the web page) already has a bound `.acpx/sessions` record (`fromAcpxStore`) or Antigravity
   * mapping, reuse that exact `sessionName` so sending/switching model on the web page never forks a second record.
   */
  public resolveBoundSessionName(prof: ChannelProfile, rawSessionName?: string, traceSessionId?: string): string {
    const reqName = (rawSessionName || '').trim();
    const tsid = (traceSessionId || '').trim();
    if (tsid && tsid.startsWith('new:')) {
      return reqName || tsid.split(':').slice(2).join(':');
    }
    const all = this.listAcpxSessions();
    if (tsid) {
      const tail = tsid.split(':').slice(1).join(':');
      const bound = all.find(
        (s) =>
          s.channel === prof.id &&
          (s.fromAcpxStore || prof.id === 'antigravity') &&
          (s.traceSessionId === tsid || s.acpSessionId === tail || `acpx:${s.acpxRecordId}` === tsid),
      );
      if (bound) return bound.sessionName;
    }
    if (reqName) {
      const exact = all.find((s) => s.channel === prof.id && (s.fromAcpxStore || prof.id === 'antigravity') && s.sessionName === reqName);
      if (exact) return exact.sessionName;
      if (reqName.startsWith('m-')) {
        const byShort = all.find(
          (s) =>
            s.channel === prof.id &&
            (s.fromAcpxStore || prof.id === 'antigravity') &&
            'm-' + s.traceSessionId.split(':').pop()!.replace(/[^\w-]/g, '').slice(0, 12) === reqName,
        );
        if (byShort) return byShort.sessionName;
      }
      return reqName;
    }
    if (tsid) {
      const anyMatch = all.find(
        (s) =>
          s.traceSessionId === tsid ||
          s.acpSessionId === tsid.split(':').slice(1).join(':') ||
          `acpx:${s.acpxRecordId}` === tsid,
      );
      if (anyMatch) return anyMatch.sessionName;
    }
    return '';
  }

  /** Switch the working directory (`cwd`) for a channel and/or named session. */
  public setSessionCwd(params: {
    channel: string;
    sessionName?: string;
    traceSessionId?: string;
    cwd: string;
  }) {
    const prof = resolveChannel(params.channel);
    if (!prof) {
      throw new Error(`未知渠道: ${params.channel}`);
    }
    const rawCwd = String(params.cwd || '').trim();
    if (!rawCwd) {
      throw new Error('工作目录路径不能为空');
    }
    const resolvedCwd = resolve(rawCwd);
    if (!existsSync(resolvedCwd) || !statSync(resolvedCwd).isDirectory()) {
      throw new Error(`工作目录不存在或不是有效文件夹: ${resolvedCwd}`);
    }

    const sessionName = this.resolveBoundSessionName(prof, params.sessionName, params.traceSessionId);

    this.selectedCwds.set(prof.id, resolvedCwd);
    if (sessionName) {
      const slot = this.slotKey(prof.id, sessionName);
      this.selectedCwds.set(slot, resolvedCwd);
      const draft = this.draftSessions.get(slot);
      if (draft) {
        draft.cwd = resolvedCwd;
      }
      if (prof.id !== 'antigravity' && existsSync(this.acpxDir)) {
        for (const f of readdirSync(this.acpxDir)) {
          if (!f.endsWith('.json')) continue;
          const fullPath = join(this.acpxDir, f);
          try {
            const raw = JSON.parse(readFileSync(fullPath, 'utf8'));
            if (raw && raw.name === sessionName && detectChannelFromCommand(raw.agent_command || '') === prof.id) {
              raw.cwd = resolvedCwd;
              writeFileSync(fullPath, JSON.stringify(raw, null, 2), 'utf8');
              break;
            }
          } catch {}
        }
      }
    }

    this.broadcast('state', this.getState());
    return {
      ok: true,
      channel: prof.id,
      sessionName: sessionName || null,
      cwd: resolvedCwd,
      workspaceDirs: this.listWorkspaceDirs(),
    };
  }

  /** Switch the active model for a channel and/or named session (persisting to acpx session JSON & invoking `acpx <agent> set-model`). */
  /**
   * Operations on an existing session other than a turn, each sent to the product's own driver:
   *   mode    — ACP bridge: session/set_mode, then kept for the session (the per-turn permission mapping no longer
   *             overrides it); Claude: set_permission_mode on its live process
   *   compact — Codex: thread/compact/start; Claude and ACP agents: a "/compact" turn (their own command)
   *   fork    — Codex: thread/fork, recorded as a new session newSessionName that continues on its own
   *   effort  — Codex: reasoning effort for this session's turns (thread/settings/update now, turn/start after)
   *   commands — read: the slash commands the agent lists (ACP available_commands_update; Claude system/init)
   * A product that cannot do the operation gets an error that says so.
   */
  public async sessionControl(params: {
    channel: string;
    sessionName?: string;
    traceSessionId?: string;
    op: string;
    value?: string;
    newSessionName?: string;
  }) {
    const prof = resolveChannel(params.channel);
    if (!prof) throw new Error(`未知渠道: ${params.channel}`);
    const sessionName = this.resolveBoundSessionName(prof, params.sessionName, params.traceSessionId);
    if (!sessionName) throw new Error('要指明会话（sessionName 或 traceSessionId）');
    const slot = this.slotKey(prof.id, sessionName);
    const rec = this.listAcpxSessions().find((s) => s.channel === prof.id && s.sessionName === sessionName && s.acpSessionId);
    const prefix = prof.traceKind + ':';
    const nativeId = rec?.acpSessionId || (params.traceSessionId?.startsWith(prefix) ? params.traceSessionId.slice(prefix.length) : '');
    const cwd = rec?.cwd || this.selectedCwds.get(slot) || this.repoRoot;
    const value = String(params.value || '').trim();
    const op = String(params.op || '');
    const done = (how: string, extra: Record<string, unknown> = {}) => {
      try {
        appendFileSync(this.eventsFile, JSON.stringify({ ts: new Date().toISOString(), kind: 'session_control', channel: prof.id, session: sessionName, op, value, how, ...extra }) + '\n', 'utf8');
      } catch {}
      return { ok: true, op, channel: prof.id, sessionName, value, how, ...extra };
    };

    if (op === 'mode') {
      if (!value) throw new Error('切模式要给 value（模式名）');
      if (prof.route === 'acp-resident') {
        if (!nativeId) throw new Error('这个会话还没在智能体那边建出来，先发一句话');
        const driver = await this.ensureAcpDriver(prof, cwd);
        if (!driver.getSession(nativeId)) await driver.loadSession(nativeId, cwd);
        const modes = driver.getSession(nativeId)?.availableModes;
        if (modes && !modes.includes(value)) throw new Error(`${prof.label} 没有模式 ${value}，可选：${modes.join('、')}`);
        await driver.setSessionMode(nativeId, value);
        this.acpPinnedModes.set(nativeId, value);
        return done('session/set_mode', { modes });
      }
      if (prof.id === 'claude') {
        const live = nativeId ? this.claudeDriver?.getSession(nativeId) : undefined;
        if (!live?.running) throw new Error('Claude 会话没在常驻进程上（先发一句话让它起来）');
        const ok = await live.switchPermissionMode(value as any);
        if (!ok) throw new Error(`Claude 没接受模式 ${value}`);
        return done('set_permission_mode');
      }
      throw new Error(`${prof.label} 还不能中途切模式（权限随每一轮的 permissions 走）`);
    }

    if (op === 'compact') {
      if (prof.id === 'codex') {
        if (!nativeId) throw new Error('这个 Codex 会话还没有线程编号');
        if (this.activeRuns.get(slot)) throw new Error('这个会话正在跑一轮，等它结束再压缩');
        const driver = await this.ensureCodexDriver();
        const model = this.selectedModels.get(slot) || prof.defaultModel;
        await driver.resumeThread(nativeId, { cwd, model, sandbox: 'workspace-write', approvalPolicy: 'untrusted' });
        await driver.compactThread(nativeId, true, 180000);
        return done('thread/compact/start');
      }
      if (prof.id === 'claude' || prof.route === 'acp-resident') {
        const r: any = await this.sendPrompt({ channel: prof.id, sessionName, traceSessionId: params.traceSessionId, prompt: '/compact', source: 'web' });
        return done('/compact 作为一轮', { runId: r?.run?.runId || r?.runId });
      }
      throw new Error(`${prof.label} 还不能压缩上下文`);
    }

    if (op === 'fork') {
      if (prof.id !== 'codex') throw new Error(`${prof.label} 的分叉还没接（Codex 已接）`);
      if (!nativeId) throw new Error('这个 Codex 会话还没有线程编号');
      const driver = await this.ensureCodexDriver();
      const model = this.selectedModels.get(slot) || prof.defaultModel;
      await driver.resumeThread(nativeId, { cwd, model, sandbox: 'workspace-write', approvalPolicy: 'untrusted' }).catch(() => '');
      const forked = await driver.forkThread({ threadId: nativeId } as any);
      const newName = String(params.newSessionName || `${sessionName}-fork-${Date.now().toString(36).slice(-4)}`);
      this.saveDriverSessionRecord({ channel: 'codex', sessionName: newName, nativeId: forked.forkedThreadId, cwd, model, driverName: 'app-server' });
      return done('thread/fork', { newSessionName: newName, traceSessionId: `codex:${forked.forkedThreadId}` });
    }

    if (op === 'effort') {
      if (prof.id !== 'codex') throw new Error(`${prof.label} 的推理力度还没接（Codex 已接）`);
      const ok = ['none', 'minimal', 'low', 'medium', 'high', 'xhigh'];
      if (!ok.includes(value)) throw new Error(`推理力度只能是 ${ok.join('、')}`);
      this.codexEfforts.set(slot, value);
      if (nativeId && this.codexDriver) {
        const model = this.selectedModels.get(slot) || prof.defaultModel;
        await this.codexDriver.switchModel(nativeId, model, value as any).catch(() => {});
      }
      return done('thread/settings/update + turn/start effort');
    }

    if (op === 'commands') {
      // Read-only: the slash commands the agent itself lists for this session (not logged as an event).
      if (prof.route === 'acp-resident') {
        if (!nativeId) throw new Error('这个会话还没在智能体那边建出来，先发一句话');
        const driver = await this.ensureAcpDriver(prof, cwd);
        if (!driver.getSession(nativeId)) await driver.loadSession(nativeId, cwd);
        // The agent announces its commands just after session/new or session/load.
        for (let i = 0; i < 15 && !driver.getCommands(nativeId).length; i++) await new Promise((r) => setTimeout(r, 200));
        return { ok: true, op, channel: prof.id, sessionName, how: 'available_commands_update', commands: driver.getCommands(nativeId) };
      }
      if (prof.id === 'claude') {
        const live = nativeId ? this.claudeDriver?.getSession(nativeId) : undefined;
        if (!live?.slashCommands?.length) throw new Error('Claude 的命令清单要会话在常驻进程上跑过一轮才有');
        return { ok: true, op, channel: prof.id, sessionName, how: 'system/init slash_commands', commands: live.slashCommands.map((name) => ({ name, description: '', hint: '' })) };
      }
      throw new Error(`${prof.label} 不报自己的命令清单`);
    }

    throw new Error(`没有这个会话操作：${op}（mode、compact、fork、effort、commands）`);
  }

  public setSessionModel(params: {
    channel: string;
    sessionName?: string;
    traceSessionId?: string;
    model: string;
  }) {
    const prof = resolveChannel(params.channel);
    if (!prof) {
      throw new Error(`未知渠道: ${params.channel}`);
    }
    const model = String(params.model || '').trim();
    if (!model) {
      throw new Error('模型名称不能为空');
    }

    const sessionName = this.resolveBoundSessionName(prof, params.sessionName, params.traceSessionId);

    // With a session, the choice is that session's; without one, it is the product's default for new sessions.
    if (!sessionName) this.selectedModels.set(prof.id, model);
    if (sessionName) {
      const slot = this.slotKey(prof.id, sessionName);
      this.selectedModels.set(slot, model);
      const draft = this.draftSessions.get(slot);
      if (draft) {
        draft.currentModel = model;
        draft.availableModels = Array.from(new Set([model, ...(draft.availableModels || prof.recommendedModels)]));
      }

      if (prof.id !== 'antigravity') {
        let sessionCwd = this.selectedCwds.get(slot) || this.selectedCwds.get(prof.id) || this.repoRoot;
        // Persist into ~/.acpx/sessions/<id>.json if the session exists on disk
        if (existsSync(this.acpxDir)) {
          for (const f of readdirSync(this.acpxDir)) {
            if (!f.endsWith('.json')) continue;
            const fullPath = join(this.acpxDir, f);
            try {
              const raw = JSON.parse(readFileSync(fullPath, 'utf8'));
              if (raw && raw.name === sessionName && detectChannelFromCommand(raw.agent_command || '') === prof.id) {
                if (typeof raw.cwd === 'string' && raw.cwd.trim()) {
                  sessionCwd = raw.cwd.trim();
                }
                raw.acpx = raw.acpx || {};
                raw.acpx.current_model_id = model;
                if (Array.isArray(raw.acpx.available_models) && !raw.acpx.available_models.includes(model)) {
                  raw.acpx.available_models.unshift(model);
                }
                writeFileSync(fullPath, JSON.stringify(raw, null, 2), 'utf8');
                break;
              }
            } catch {}
          }
        }

        if (prof.id === 'codex') {
          const bound = this.listAcpxSessions().find((s) => s.channel === 'codex' && s.sessionName === sessionName && s.acpSessionId);
          const tid = bound?.acpSessionId || (params.traceSessionId?.startsWith('codex:') ? params.traceSessionId.slice(6) : '');
          if (tid && this.codexDriver) {
            this.codexDriver.switchModel(tid, model).catch(() => {});
          }
        } else if (prof.id === 'claude') {
          const bound = this.listAcpxSessions().find((s) => s.channel === 'claude' && s.sessionName === sessionName && s.acpSessionId);
          const sid =
            bound?.acpSessionId ||
            (params.traceSessionId?.startsWith('claude-code:') ? params.traceSessionId.slice(12) : '');
          if (sid && this.claudeDriver) {
            const liveSess = this.claudeDriver.getSession(sid);
            if (liveSess?.running) {
              liveSess.switchModel(model).catch(() => {});
            }
          }
        } else if (prof.route === 'acp-resident') {
          // A hot session switches now; otherwise the next turn loads it and applies the model recorded above.
          const bound = this.listAcpxSessions().find((s) => s.channel === prof.id && s.sessionName === sessionName && s.acpSessionId);
          const sid = bound?.acpSessionId || '';
          const d = sid ? this.acpDriverOf(sid) : undefined;
          if (d) d.setSessionModel(sid, model).catch(() => {});
        } else {
          // Fire `acpx --cwd <sessionCwd> <agent> set-model <model> -s <sessionName>` asynchronously so live ACP daemon updates too
          try {
            const env = { ...agentBaseEnv(), ...prof.buildEnv() };
            const setArgs = ['--format', 'json', '--cwd', sessionCwd, prof.acpxAgent, 'set-model', model, '-s', sessionName];
            const setCmd = ['acpx', ...setArgs.map(quoteWinArg)].join(' ');
            const p = spawn(
              existsSync(ACPX_CLI) ? process.execPath : 'cmd.exe',
              existsSync(ACPX_CLI) ? [ACPX_CLI, ...setArgs] : ['/d', '/s', '/c', setCmd],
              {
                cwd: sessionCwd,
                env,
                stdio: ['ignore', 'pipe', 'pipe'], // acpx waits for EOF on an open stdin pipe
                windowsHide: true,
              },
            );
            p.on('error', () => {});
          } catch {}
        }
      }
    }

    this.broadcast('state', this.getState());
    return {
      ok: true,
      channel: prof.id,
      sessionName: sessionName || null,
      model,
    };
  }

  private capRegistryCache: { mtimeMs: number; data: any } | null = null;

  /** hub/data/capabilities.json, generated from the probe blackboard (channels/probe/scripts/build_capabilities.js). */
  private capabilityRegistry(): any | null {
    const file = join(this.repoRoot, 'hub', 'data', 'capabilities.json');
    try {
      const st = statSync(file);
      if (!this.capRegistryCache || this.capRegistryCache.mtimeMs !== st.mtimeMs) {
        this.capRegistryCache = { mtimeMs: st.mtimeMs, data: JSON.parse(readFileSync(file, 'utf8')) };
      }
      return this.capRegistryCache.data;
    } catch {
      return null;
    }
  }

  /**
   * Capability flags the pages render from. A flag is turned off only when the registry shows the
   * gateway path as tested and broken (fail / n/a); passing, partial and untested stay on. Without a
   * registry the hand-written profile flags are used, as before.
   */
  private registryCapabilities(p: ChannelProfile): ChannelCapabilities {
    const g = this.capabilityRegistry()?.families?.[p.id]?.gateway;
    if (!g) return p.capabilities;
    const ok = (cap: string, fallback: boolean) => {
      const st = g[cap]?.state;
      return st ? st !== 'fail' && st !== 'n/a' : fallback;
    };
    const c = p.capabilities;
    return {
      canCreateSession: ok('open', c.canCreateSession),
      canSendPrompt: ok('open', c.canSendPrompt),
      canCancelRun: ok('cancel', c.canCancelRun),
      canSwitchModelOnNew: ok('model-new', c.canSwitchModelOnNew),
      canSwitchModelMidSession: ok('model-switch', c.canSwitchModelMidSession),
      canSetPermissionMode: ok('mode-switch', c.canSetPermissionMode),
      canReadExternalSessions: c.canReadExternalSessions,
    };
  }

  public addSseClient(res: ServerResponse) {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Content-Type-Options': 'nosniff',
    });
    res.write(`data: ${JSON.stringify({ type: 'gateway_snapshot', ...this.getState() })}\n\n`);
    this.clients.add(res);
    res.on('close', () => {
      this.clients.delete(res);
    });
  }

  private broadcast(event: string, payload: unknown) {
    const envelope =
      event === 'state'
        ? { type: 'gateway_snapshot', ...(payload as Record<string, unknown>) }
        : event === 'meta_agent_action'
        ? { type: 'meta_agent_action', entry: payload, metaAgents: this.getMetaAgents() }
        : event === 'dispatch_update'
        ? { type: 'dispatch_update', dispatch: payload, dispatches: this.getDispatchesSummary() }
        : { type: event, run: payload };
    const msg = `data: ${JSON.stringify(envelope)}\n\n`;
    for (const client of this.clients) {
      try {
        client.write(msg);
      } catch {
        this.clients.delete(client);
      }
    }
  }

  /** Resume an interrupted, disconnected, or errored session (either triggered by user 1-click or `meta_resumer`). */
  public async resumeInterruptedSession(params: {
    channel: string;
    sessionName?: string;
    traceSessionId?: string;
    customHint?: string;
  }) {
    const prof = resolveChannel(params.channel) || CHANNEL_PROFILES.codex;
    let sessionName = (params.sessionName || '').trim();
    const tsid = params.traceSessionId;
    if (!sessionName && tsid) {
      const existing = this.listAcpxSessions().find(
        (s) =>
          s.traceSessionId === tsid ||
          s.acpSessionId === tsid.split(':').slice(1).join(':') ||
          `acpx:${s.acpxRecordId}` === tsid,
      );
      if (existing) sessionName = existing.sessionName;
    }
    if (!sessionName) sessionName = `hub-${prof.id}`;

    const contract = tsid
      ? this.getAcpxSessionAsContract(tsid) || this.getAcpxSessionAsContract(sessionName)
      : this.getAcpxSessionAsContract(sessionName);

    let lastInput = '';
    let lastErrorStep = '';
    if (contract && contract.turns.length > 0) {
      const lastTurn = contract.turns[contract.turns.length - 1];
      lastInput = (lastTurn.input || '').slice(0, 240);
      for (const st of lastTurn.steps) {
        if (st.kind === 'tool' && st.status === 'error') {
          lastErrorStep = `${st.name}: ${(st.output || '').slice(0, 140)}`;
        }
      }
    }

    const hint = (params.customHint || '').trim();
    const resumePrompt = hint
      ? hint
      : lastErrorStep
      ? `请从刚才中断或报错的步骤继续执行并完成任务（上一轮报错工具：${lastErrorStep}；现已开启自动读写权限）。`
      : lastInput && !lastInput.startsWith('Error:')
      ? `请从刚才中断的位置继续完成未尽任务（原任务摘要：${lastInput}）。`
      : 'Error: The stream was interrupted. Please continue the task you were working on.';

    this.recordMetaAction(
      'meta_resumer',
      prof.id,
      sessionName,
      '断点续跑注入',
      `自动注入断点上下文并续跑 (${resumePrompt.slice(0, 60)})`,
    );

    return this.sendPrompt({
      channel: prof.id,
      sessionName,
      traceSessionId: tsid,
      prompt: resumePrompt,
      permissions: 'all',
      mode: 'send',
      source: 'web',
      resumedByMeta: 'meta_resumer',
    });
  }

  public waitForRunCompletion(runId: string, timeoutMs = ACPX_TURN_TIMEOUT_SEC * 1000): Promise<ActiveRun | null> {
    const recent = this.recentRuns.find((r) => r.runId === runId);
    if (recent && recent.status !== 'running') {
      return Promise.resolve(recent);
    }
    return new Promise((resolvePromise) => {
      const timer = setTimeout(() => {
        const list = this.runWaiters.get(runId) || [];
        this.runWaiters.set(
          runId,
          list.filter((fn) => fn !== onDone),
        );
        const cur = Array.from(this.activeRuns.values()).find((r) => r.runId === runId) || null;
        resolvePromise(cur);
      }, Math.max(2000, timeoutMs));

      const onDone = (finishedRun: ActiveRun) => {
        clearTimeout(timer);
        resolvePromise(finishedRun);
      };

      const existing = this.runWaiters.get(runId) || [];
      existing.push(onDone);
      this.runWaiters.set(runId, existing);
    });
  }

  /** Interactive Approval Gate: Approve or reject a pending tool/permission request in the Control Room. */
  public async resolveApproval(params: {
    id: string;
    decision: 'approve' | 'reject';
    customHint?: string;
  }) {
    const item = this.pendingApprovals.find((a) => a.id === params.id && a.status === 'pending');
    if (!item) {
      throw new Error(`未找到待审批项或已处理: ${params.id}`);
    }
    item.status = params.decision === 'approve' ? 'approved' : 'rejected';

    // 1. Live in-turn approval (Codex app-server or Claude stream-json suspended mid-turn)
    const liveResolver = this.liveApprovalResolvers.get(item.id);
    if (liveResolver) {
      this.liveApprovalResolvers.delete(item.id);
      liveResolver.resolve(params.decision === 'approve');
      const slot = this.slotKey(item.channel, item.sessionName);
      const activeRun = this.activeRuns.get(slot);
      if (activeRun && activeRun.waitingApprovalId === item.id) {
        activeRun.waitingApprovalId = undefined;
        this.broadcast('run_update', activeRun);
      }
      this.recordMetaAction(
        'meta_approver',
        item.channel,
        item.sessionName,
        params.decision === 'approve' ? '轮内原位批准放行' : '轮内原位驳回拦截',
        params.decision === 'approve'
          ? `已在当前轮次内原位放行会话 ${item.sessionName} 执行 ${item.toolName}（当轮继续，无需重开新轮次）`
          : `已在当前轮次内原位驳回会话 ${item.sessionName} 的工具操作 (${item.toolName})`,
      );
      this.broadcast('state', this.getState());
      return {
        ok: true,
        id: item.id,
        status: item.status,
        action: params.decision === 'approve' ? 'approved-in-turn' : 'rejected-in-turn',
        inTurn: true,
        mode: 'in-turn',
        runId: item.runId,
        run: activeRun || null,
      };
    }

    this.broadcast('state', this.getState());

    if (params.decision === 'reject') {
      this.recordMetaAction(
        'meta_approver',
        item.channel,
        item.sessionName,
        '人工驳回权限请求',
        `已拦截会话 ${item.sessionName} 的工具操作 (${item.toolName})`,
      );
      return { ok: true, id: item.id, status: 'rejected', inTurn: false, mode: 'session-retry' };
    }

    this.recordMetaAction(
      'meta_approver',
      item.channel,
      item.sessionName,
      '批准权限并续跑',
      `已批准会话 ${item.sessionName} 执行 ${item.toolName}，升级为全权限 (--approve-all) 继续执行`,
    );

    const resumePrompt =
      (params.customHint || '').trim() ||
      `已批准你的权限请求（工具：${item.toolName}），现已开启全读写与命令执行权限 (--approve-all)，请继续完成刚才的操作（原任务：${item.prompt.slice(0, 180)}）。`;

    const res = await this.sendPrompt({
      channel: item.channel,
      sessionName: item.sessionName,
      traceSessionId: item.traceSessionId,
      cwd: item.cwd,
      model: item.model,
      prompt: resumePrompt,
      permissions: 'all',
      mode: 'send',
      source: 'web',
      resumedByMeta: 'meta_approver',
    });

    return {
      ok: true,
      id: item.id,
      status: 'approved',
      inTurn: false,
      mode: 'session-retry',
      run: res.run,
    };
  }

  /** Cross-Channel Session Handoff: Transfer recent context & working directory from one Agent channel to another. */
  public async handoffSession(params: {
    fromChannel: string;
    fromSessionName?: string;
    fromTraceId?: string;
    toChannel: string;
    toModel?: string;
    toSessionName?: string;
    customInstruction?: string;
    wait?: boolean;
    timeoutMs?: number;
  }) {
    const fromProf = resolveChannel(params.fromChannel) || CHANNEL_PROFILES.codex;
    const toProf = resolveChannel(params.toChannel);
    if (!toProf) {
      throw new Error(`未知目标接力渠道: ${params.toChannel}`);
    }

    let fromSessionName = (params.fromSessionName || '').trim();
    const fromTsid = params.fromTraceId;
    if (!fromSessionName && fromTsid) {
      const existing = this.listAcpxSessions().find(
        (s) =>
          s.traceSessionId === fromTsid ||
          s.acpSessionId === fromTsid.split(':').slice(1).join(':') ||
          `acpx:${s.acpxRecordId}` === fromTsid,
      );
      if (existing) fromSessionName = existing.sessionName;
    }
    if (!fromSessionName) fromSessionName = `hub-${fromProf.id}`;

    // SessionStore has no get(); its async session() reads a native session (this threw before 2026-10-18).
    const contract =
      (fromTsid ? this.getAcpxSessionAsContract(fromTsid) || (await this.store.session(fromTsid)) : null) ||
      this.getAcpxSessionAsContract(fromSessionName);

    const sourceCwd =
      contract?.cwd ||
      this.selectedCwds.get(this.slotKey(fromProf.id, fromSessionName)) ||
      this.selectedCwds.get(fromProf.id) ||
      this.repoRoot;

    const recentTurns = contract?.turns ? contract.turns.slice(-3) : [];
    const turnDigestLines: string[] = [];
    for (const t of recentTurns) {
      const uIn = (t.input || '').replace(/\s+/g, ' ').slice(0, 260);
      const aOut = (t.output || '').replace(/\s+/g, ' ').slice(0, 320);
      const errs = t.steps
        .filter((s) => s.kind === 'tool' && s.status === 'error')
        .map((s) => (s.kind === 'tool' ? `${s.name}: ${(s.output || '').slice(0, 120)}` : ''))
        .filter(Boolean);
      turnDigestLines.push(
        `- [第 ${t.index} 轮] 用户指令: ${uIn || '(无)'}` +
          (aOut ? `\n  前序回复摘要: ${aOut}` : '') +
          (errs.length ? `\n  遗留报错: ${errs.join(' | ')}` : ''),
      );
    }

    const hhmm = new Date().toTimeString().slice(0, 5).replace(':', '');
    const toSessionName =
      (params.toSessionName || '').trim() || `handoff-${fromProf.id}-to-${toProf.id}-${hhmm}`;
    const toModel =
      params.toModel && toProf.recommendedModels.includes(params.toModel)
        ? params.toModel
        : this.selectedModels.get(toProf.id) || toProf.defaultModel;

    const instruction =
      (params.customInstruction || '').trim() ||
      '请基于上述前序智能体会话的上下文与工作目录，接手并继续完成未尽任务（若前序存在报错请直接定位修复）。';

    const handoffPrompt = [
      `【跨智能体协同接力 (Session Handoff): ${fromProf.label} -> ${toProf.label}】`,
      `- 源会话: ${fromProf.label} (${fromSessionName})`,
      `- 工作目录: ${sourceCwd}`,
      turnDigestLines.length > 0
        ? `- 最近 ${recentTurns.length} 轮上下文摘要:\n${turnDigestLines.join('\n')}`
        : `- 前序会话暂无历史轮次记录`,
      `---`,
      `【接力执行指令】: ${instruction}`,
    ].join('\n');

    this.recordMetaAction(
      'meta_maint',
      toProf.id,
      toSessionName,
      '跨渠道会话接力 (Handoff)',
      `已将 ${fromProf.label} (${fromSessionName}) 的上下文与目录 (${sourceCwd}) 转交至 ${toProf.label} · ${toModel} (${toSessionName})`,
    );

    const stamp = new Date().toISOString().replace(/\D/g, '').slice(8, 14);
    const dispatchId = `dsp_${stamp}_${Math.random().toString(36).slice(2, 6)}`;
    const nowIso = new Date().toISOString();
    const handoffRecord: DispatchRecord = {
      id: dispatchId,
      kind: 'handoff',
      status: 'issued',
      receipt: 'issued',
      receipts: { issuedAt: nowIso },
      from: {
        channel: fromProf.id,
        sessionName: fromSessionName,
        traceSessionId: fromTsid || contract?.id,
      },
      to: {
        channel: toProf.id,
        sessionName: toSessionName,
        model: toModel,
        cwd: sourceCwd,
      },
      task: instruction,
      contextDigest: turnDigestLines.join('\n').slice(0, 600) || undefined,
      depth: 1,
      progressReports: [],
      requests: [],
      wake: { mode: 'none', state: 'none' },
      updatedAt: nowIso,
    };
    this.saveDispatch(handoffRecord);

    const sendRes = await this.sendPrompt({
      channel: toProf.id,
      sessionName: toSessionName,
      cwd: sourceCwd,
      model: toModel,
      prompt: handoffPrompt,
      permissions: 'all',
      mode: 'send',
      source: 'web',
      wait: params.wait,
      timeoutMs: params.timeoutMs,
    });

    const cur = this.dispatches.get(dispatchId) || handoffRecord;
    if (!cur.receipts.deliveredAt) cur.receipts.deliveredAt = new Date().toISOString();
    if (cur.receipt === 'issued') cur.receipt = 'delivered';
    if (cur.status === 'issued') cur.status = 'running';
    if (sendRes.run?.runId) cur.targetRunId = sendRes.run.runId;
    if (sendRes.run?.traceSessionId && !sendRes.run.traceSessionId.startsWith('new:')) {
      cur.to.traceSessionId = sendRes.run.traceSessionId;
    }
    this.saveDispatch(cur);

    return {
      ...sendRes,
      dispatchId,
      dispatch: this.dispatches.get(dispatchId) || cur,
      fromChannel: fromProf.id,
      fromSessionName,
      toChannel: toProf.id,
      toSessionName,
      toModel,
      cwd: sourceCwd,
      traceSessionId: sendRes.run?.traceSessionId || `new:${toProf.id}:${toSessionName}`,
    };
  }

  public async sendPrompt(params: {
    channel: string;
    sessionName?: string;
    traceSessionId?: string;
    cwd?: string;
    prompt: string;
    model?: string;
    permissions?: 'all' | 'reads' | 'deny';
    mode?: 'send' | 'queue' | 'interrupt';
    source?: 'web' | 'cli';
    retryCount?: number;
    resumedByMeta?: string;
    wait?: boolean;
    timeoutMs?: number;
    /** Pictures sent with the words (data: URLs, e.g. a pasted phone screenshot). */
    images?: string[];
  }) {
    const prof = resolveChannel(params.channel);
    if (!prof) {
      throw new Error(`未知渠道: ${params.channel}`);
    }
    let prompt = String(params.prompt || '').trim();
    const images = (params.images || []).filter((d) => /^data:image\/[\w.+-]+;base64,/.test(String(d))).slice(0, 8);
    if (!prompt && !images.length) {
      throw new Error('消息内容不能为空');
    }
    if (images.length) {
      // Saved to disk and named in the words, so every agent can open them with its file tools (Antigravity's
      // send-message takes text only); acpx agents also get them as ACP image blocks (startRunInternal).
      const dir = join(HOME, '.agent-hub', 'uploads', new Date().toISOString().replace(/\D/g, '').slice(0, 14) + '-' + Math.random().toString(36).slice(2, 6));
      mkdirSync(dir, { recursive: true });
      const blocks: Array<{ type: 'image'; mimeType: string; data: string }> = [];
      const paths = images.map((d, i) => {
        const m = /^data:(image\/[\w.+-]+);base64,(.*)$/s.exec(d)!;
        const ext = m[1].split('/')[1].replace('jpeg', 'jpg').replace(/[^a-z0-9]/gi, '');
        const file = join(dir, `img-${i + 1}.${ext}`);
        writeFileSync(file, Buffer.from(m[2], 'base64'));
        blocks.push({ type: 'image', mimeType: m[1], data: m[2] });
        return file;
      });
      prompt = (prompt || '请看图。') + `\n\n（附图 ${paths.length} 张，已存到：\n${paths.join('\n')}\n如果你看不到图片内容，请用读文件或查看图片的工具打开这些文件。）`;
      this.promptImages.set(prompt, blocks);
    }

    // Resolve sessionName from traceSessionId or bound acpx record if provided
    const sessionName = this.resolveBoundSessionName(prof, params.sessionName, params.traceSessionId) || `hub-${prof.id}`;

    const key = this.slotKey(prof.id, sessionName);
    const cwd = this.resolveSessionCwd(prof, sessionName, params.cwd);
    this.selectedCwds.set(key, cwd);
    // Read-only unless the caller asked for more; no meta-agent may widen it silently (2026-10-17 decision).
    const permissions = params.permissions || 'all';
    const source = params.source || 'web';
    const mode = params.mode || 'send';
    // An existing session keeps the model it runs on (its own record) unless one is chosen: the in-memory choice
    // is lost on restart, and falling back to the family default silently switched sessions (seen 2026-10-18).
    const model =
      (params.model || '').trim() ||
      this.selectedModels.get(key) ||
      this.listAcpxSessions().find((s) => s.channel === prof.id && s.sessionName === sessionName)?.currentModel ||
      this.selectedModels.get(prof.id) ||
      prof.defaultModel;
    // Only this session's choice is remembered: writing it to the product too made every later new session of the
    // product inherit it (OpenCode after one session switched to a blocked free model, full test 10-18).
    this.selectedModels.set(key, model);

    const existingRun = this.activeRuns.get(key);
    if (existingRun && existingRun.status === 'running') {
      // Antigravity reads a message sent to a running conversation within the turn (measured 2026-10-17:
      // inserted at step 18, answered at step 23). Queueing it until the turn ends threw that away.
      if (mode !== 'interrupt' && mode !== 'queue' && prof.id === 'antigravity' && this.steerAntigravity(sessionName, existingRun, prompt, cwd)) {
        return { ok: true, status: 'running', action: 'steered', channel: prof.id, sessionName, runId: existingRun.runId };
      }
      // Codex app-server supports real in-turn steer via turn/steer RPC with expectedTurnId
      if (mode !== 'interrupt' && mode !== 'queue' && prof.id === 'codex') {
        const steered = await this.steerCodexRun(existingRun, prompt);
        if (steered) {
          return { ok: true, status: 'running', action: 'steered', channel: prof.id, sessionName, runId: existingRun.runId };
        }
      }
      if (mode === 'interrupt') {
        await this.cancelRun(prof.id, sessionName);
      } else {
        const q = this.queues.get(key) || [];
        const item: QueuedPrompt = {
          id: 'q_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
          prompt,
          model,
          permissions,
          source,
          enqueuedAt: new Date().toISOString(),
        };
        q.push(item);
        this.queues.set(key, q);
        this.broadcast('state', this.getState());
        return {
          ok: true,
          status: 'queued',
          action: 'queued',
          queueLength: q.length,
          channel: prof.id,
          sessionName,
          queuePosition: q.length,
          queuedItem: item,
        };
      }
    }

    const run = this.startRunInternal({
      prof,
      sessionName,
      traceSessionId: params.traceSessionId,
      cwd,
      prompt,
      model,
      permissions,
      source,
      retryCount: params.retryCount || 0,
      resumedByMeta: params.resumedByMeta,
    });

    if (params.wait) {
      const doneRun = (await this.waitForRunCompletion(run.runId, params.timeoutMs || ACPX_TURN_TIMEOUT_SEC * 1000)) || run;
      return {
        ok: doneRun.status === 'completed' && !doneRun.error,
        status: doneRun.status,
        action: 'completed',
        runId: doneRun.runId,
        channel: prof.id,
        sessionName,
        traceSessionId: doneRun.traceSessionId,
        model: doneRun.model,
        cwd: doneRun.cwd,
        reply: doneRun.text || '',
        thoughts: doneRun.thoughts || '',
        tools: doneRun.tools || [],
        durationMs: doneRun.durationMs || Date.now() - Date.parse(doneRun.startedAt),
        error: doneRun.error || null,
        run: doneRun,
      };
    }

    return {
      ok: true,
      status: 'running',
      action: 'started',
      runId: run.runId,
      channel: prof.id,
      sessionName,
      run,
    };
  }

  public async cancelRun(channelRaw: string, sessionName?: string, queuedId?: string) {
    const prof = resolveChannel(channelRaw);
    if (!prof) throw new Error(`未知渠道: ${channelRaw}`);
    const sName = this.resolveBoundSessionName(prof, sessionName) || sessionName || `hub-${prof.id}`;
    const key = this.slotKey(prof.id, sName);

    if (queuedId) {
      const q = (this.queues.get(key) || []).filter((x) => x.id !== queuedId);
      this.queues.set(key, q);
      this.broadcast('state', this.getState());
      return { ok: true, removedQueuedId: queuedId };
    }

    const run = this.activeRuns.get(key);
    if (run && run.status === 'running') {
      run.status = 'cancelling';
      this.broadcast('run_update', run);
    }

    // Decline any pending in-turn approval for this run before interrupting
    if (run) {
      for (const [apprId, entry] of this.liveApprovalResolvers.entries()) {
        if (entry.runId === run.runId) {
          this.liveApprovalResolvers.delete(apprId);
          const item = this.pendingApprovals.find((a) => a.id === apprId);
          if (item && item.status === 'pending') item.status = 'rejected';
          try {
            entry.resolve(false);
          } catch {}
        }
      }
      run.waitingApprovalId = undefined;
    }

    if (prof.id === 'antigravity') {
      try {
        const ls = this.discoverAntigravityLs();
        const agyMap = this.loadAgySessionMap();
        const cid =
          agyMap[sName] ||
          (run?.traceSessionId?.startsWith('antigravity:') ? run.traceSessionId.slice(12) : '');
        if (cid && ls.port && ls.csrf) {
          await fetch(
            `http://127.0.0.1:${ls.port}/exa.language_server_pb.LanguageServerService/CancelCascadeInvocation`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Connect-Protocol-Version': '1',
                'x-codeium-csrf-token': ls.csrf,
              },
              body: JSON.stringify({ cascadeId: cid }),
            },
          ).catch(() => {});
        }
      } catch {}
    } else if (prof.id === 'codex') {
      try {
        const tid =
          run?.codexThreadId ||
          (run?.traceSessionId?.startsWith('codex:') ? run.traceSessionId.slice('codex:'.length) : '');
        if (tid && this.codexDriver) {
          await this.codexDriver.interruptTurn(tid, run?.codexTurnId).catch(() => {});
        }
      } catch {}
    } else if (prof.id === 'claude') {
      try {
        const sid =
          run?.claudeSessionId ||
          (run?.traceSessionId?.startsWith('claude-code:') ? run.traceSessionId.slice('claude-code:'.length) : '');
        if (sid && this.claudeDriver) {
          await this.claudeDriver.getSession(sid)?.interrupt().catch(() => {});
        }
      } catch {}
    } else if (run?.acpSessionId && this.acpDriverOf(run.acpSessionId)) {
      this.acpDriverOf(run.acpSessionId)!.cancelTurn(run.acpSessionId);
    } else {
      // Invoke acpx cancel
      try {
        const env = { ...agentBaseEnv(), ...prof.buildEnv() };
        spawnSync(
          'cmd.exe',
          ['/d', '/s', '/c', `acpx --format json ${prof.acpxAgent} cancel -s ${quoteWinArg(sName)}`],
          { cwd: this.repoRoot, env, timeout: 8000, windowsHide: true },
        );
      } catch {}
    }

    const proc = this.activeProcs.get(key);
    if (proc && !proc.killed) {
      try {
        proc.kill();
      } catch {}
    }

    if (run) {
      run.status = 'aborted';
      run.endedAt = new Date().toISOString();
      run.durationMs = Date.now() - Date.parse(run.startedAt);
      this.activeRuns.delete(key);
      this.activeProcs.delete(key);
      if (run.codexThreadId) this.activeCodexRunsByThread.delete(run.codexThreadId);
      if (run.claudeSessionId) this.activeClaudeRunsBySession.delete(run.claudeSessionId);
      if (run.acpSessionId) this.activeAcpRunsBySession.delete(run.acpSessionId);
      this.rememberRun(run);
      this.broadcast('run_done', run);
      this.broadcast('state', this.getState());
    }

    return { ok: true, channel: prof.id, sessionName: sName };
  }

  private getExistingMessageCount(channel: ChannelId, sessionName: string): number {
    try {
      const info = this.listAcpxSessions().find(
        (s) => s.channel === channel && s.sessionName === sessionName,
      );
      if (!info) return 0;
      if (channel === 'antigravity') {
        const cid = info.acpSessionId;
        const transcriptPath = join(this.agyBrainDir, cid, '.system_generated', 'logs', 'transcript.jsonl');
        if (!existsSync(transcriptPath)) return 0;
        return readFileSync(transcriptPath, 'utf8')
          .split(/\r?\n/)
          .filter((l) => l.trim()).length;
      }
      const file = join(this.acpxDir, `${info.acpxRecordId}.json`);
      if (!existsSync(file)) return 0;
      const raw = JSON.parse(readFileSync(file, 'utf8'));
      return Array.isArray(raw.messages) ? raw.messages.length : 0;
    } catch {
      return 0;
    }
  }

  /** Send a message into a running Antigravity conversation; false when it cannot be sent (caller queues). */
  private steerAntigravity(sessionName: string, run: ActiveRun, prompt: string, cwd: string): boolean {
    try {
      const ls = this.discoverAntigravityLs();
      const cid =
        this.loadAgySessionMap()[sessionName] ||
        (run.traceSessionId?.startsWith('antigravity:') ? run.traceSessionId.slice('antigravity:'.length) : '');
      if (!cid) return false;
      const child = spawn(ls.bin, ['agentapi', 'send-message', cid, prompt], {
        cwd,
        env: { ...agentBaseEnv(), ...ls.env, ANTIGRAVITY_PROJECT_ID: resolveAgyProjectId(cwd) },
        windowsHide: true,
        stdio: 'ignore',
      });
      child.on('error', () => {});
      (run.warnings ||= []).push('中途插话：' + prompt.slice(0, 80));
      this.broadcast('run_update', run);
      return true;
    } catch {
      return false;
    }
  }

  private startAntigravityRun(
    run: ActiveRun,
    opts: {
      prof: ChannelProfile;
      sessionName: string;
      traceSessionId?: string;
      cwd: string;
      prompt: string;
      model: string;
      permissions: 'all' | 'reads' | 'deny';
      source: 'web' | 'cli';
    },
  ): ActiveRun {
    const { prof, sessionName, cwd, prompt, model } = opts;
    const key = this.slotKey(prof.id, sessionName);
    let ls: ReturnType<AgentGatewayHub['discoverAntigravityLs']>;
    try {
      ls = this.discoverAntigravityLs();
    } catch (e: any) {
      run.status = 'failed';
      run.error = e?.message || '无法连接 Antigravity language_server.exe';
      this.finalizeRun(run, opts);
      return run;
    }

    const agyMap = this.loadAgySessionMap();
    let cid = agyMap[sessionName] || '';
    if (!cid && opts.traceSessionId?.startsWith('antigravity:')) {
      cid = opts.traceSessionId.slice('antigravity:'.length);
      agyMap[sessionName] = cid;
      this.saveAgySessionMap(agyMap);
    }

    const hasExistingBrain =
      Boolean(cid) &&
      existsSync(join(this.agyBrainDir, cid, '.system_generated', 'logs', 'transcript.jsonl'));

    const cliModel = normalizeAgyCliModel(model);
    const args = hasExistingBrain
      ? ['agentapi', 'send-message', cid, prompt]
      : ['agentapi', 'new-conversation', `--model=${cliModel}`, `--title=${agyTitle(sessionName, prompt)}`, prompt];

    const child = spawn(ls.bin, args, {
      cwd,
      env: { ...agentBaseEnv(), ...ls.env, ANTIGRAVITY_PROJECT_ID: resolveAgyProjectId(cwd) },
      windowsHide: true,
    });

    this.activeProcs.set(key, child);
    let stdoutBuf = '';
    let stderrBuf = '';

    child.stdout.on('data', (chunk: Buffer) => {
      stdoutBuf += chunk.toString('utf8');
      // Try extracting conversationId early if new-conversation outputs it
      if (!cid) {
        const m = /"conversationId"\s*:\s*"([0-9a-f-]{36})"/i.exec(stdoutBuf);
        if (m) {
          cid = m[1];
          agyMap[sessionName] = cid;
          this.saveAgySessionMap(agyMap);
          run.traceSessionId = `antigravity:${cid}`;
        }
      }
    });

    child.stderr.on('data', (chunk: Buffer) => {
      stderrBuf += chunk.toString('utf8');
    });

    // agentapi only delivers the message and exits; the turn ends when the transcript shows a final
    // PLANNER_RESPONSE. So after a successful delivery keep polling until then (or cancel / 1h cap).
    let delivered = false;
    let finished = false;
    const deadline = Date.now() + 60 * 60_000;
    const finish = (status: 'completed' | 'failed' | 'aborted', error?: string) => {
      if (finished) return;
      finished = true;
      clearInterval(pollTimer);
      run.status = status;
      if (error) run.error = error;
      this.finalizeRun(run, opts);
    };
    const pollTimer = setInterval(() => {
      if (cid) {
        this.syncFromAntigravityTranscript(run, cid);
      }
      if (!delivered) return;
      if (run.status === 'cancelling' || run.status === 'aborted') finish('aborted');
      else if (this.isAgyTurnDone(run, cid)) finish('completed');
      else if (Date.now() > deadline) finish('failed', 'Antigravity 一小时内没有在 transcript 里写出最终回复');
    }, 600);

    child.on('close', (code) => {
      try {
        const parsed = JSON.parse(stdoutBuf.trim());
        const newCid = parsed?.response?.newConversation?.conversationId;
        if (newCid && !cid) {
          cid = newCid;
          agyMap[sessionName] = cid;
          this.saveAgySessionMap(agyMap);
        }
      } catch {}

      if (cid) {
        run.traceSessionId = `antigravity:${cid}`;
        this.syncFromAntigravityTranscript(run, cid);
      }

      if (run.status === 'cancelling' || run.status === 'aborted') {
        finish('aborted');
      } else if ((code !== 0 && !run.text) || !cid) {
        finish('failed', stderrBuf.trim() || stdoutBuf.trim() || `Antigravity 退出码 ${code}`);
      } else {
        delivered = true;
      }
    });

    return run;
  }

  /** runId → when the turn first looked done, and the transcript length at that moment. */
  private readonly agyDoneSince = new Map<string, { at: number; lines: number }>();

  /**
   * The turn is over when the last PLANNER_RESPONSE written since the run began is DONE with no pending
   * tool calls, the conversation index says idle, and both have held for 5 s with no new transcript lines
   * (the index can read idle for a moment before a background task registers; seen 2026-10-17).
   */
  private isAgyTurnDone(run: ActiveRun, cid: string): boolean {
    try {
      const transcriptPath = join(this.agyBrainDir, cid, '.system_generated', 'logs', 'transcript.jsonl');
      if (!existsSync(transcriptPath)) return false;
      const all = readFileSync(transcriptPath, 'utf8')
        .split(/\r?\n/)
        .filter((l) => l.trim());
      const steps = all
        .slice(run.initialMsgCount ?? 0)
        .map((l) => {
          try {
            return JSON.parse(l);
          } catch {
            return null;
          }
        })
        .filter((s) => s && s.type === 'PLANNER_RESPONSE');
      const last = steps[steps.length - 1];
      const textDone = Boolean(last && last.status === 'DONE' && !(Array.isArray(last.tool_calls) && last.tool_calls.length));
      // A text-only DONE step can also mean the agent yielded while a background command runs;
      // the conversation index says whether the cascade is really idle (null = index unreadable).
      const looksDone = textDone && this.agyConversationIdle(cid) !== false;
      const seen = this.agyDoneSince.get(run.runId);
      if (!looksDone || !seen || seen.lines !== all.length) {
        if (looksDone) this.agyDoneSince.set(run.runId, { at: Date.now(), lines: all.length });
        else this.agyDoneSince.delete(run.runId);
        return false;
      }
      if (Date.now() - seen.at < 5000) return false;
      this.agyDoneSince.delete(run.runId);
      return true;
    } catch {
      return false;
    }
  }

  private agyConversationIdle(cid: string): boolean | null {
    try {
      const db = new DatabaseSync(join(HOME, '.gemini', 'antigravity', 'conversation_summaries.db'), { readOnly: true });
      const row = db
        .prepare('select status, not_fully_idle as busy from conversation_summaries where conversation_id = ?')
        .get(cid) as { status?: string; busy?: number } | undefined;
      db.close();
      if (!row) return null;
      return !Number(row.busy) && !String(row.status || '').endsWith('RUNNING');
    } catch {
      return null;
    }
  }

  private syncFromAntigravityTranscript(run: ActiveRun, cid: string) {
    try {
      const transcriptPath = join(this.agyBrainDir, cid, '.system_generated', 'logs', 'transcript.jsonl');
      if (!existsSync(transcriptPath)) return;
      const lines = readFileSync(transcriptPath, 'utf8')
        .split(/\r?\n/)
        .filter((l) => l.trim());
      const minIdx = run.initialMsgCount ?? 0;
      if (lines.length <= minIdx) return;

      const newLines = lines.slice(minIdx);
      let thoughts = '';
      let text = '';
      let changed = false;

      for (const line of newLines) {
        try {
          const obj = JSON.parse(line);
          if (obj.type === 'PLANNER_RESPONSE') {
            if (typeof obj.thinking === 'string' && obj.thinking.trim()) {
              thoughts = obj.thinking.trim();
            }
            if (typeof obj.content === 'string' && obj.content.trim()) {
              text = obj.content.trim();
            }
            const rawCalls: any[] = Array.isArray(obj.tool_calls) ? obj.tool_calls : [];
            for (let i = 0; i < rawCalls.length; i++) {
              const tc = rawCalls[i];
              const tid = String(tc?.id || `agy_live_${i + 1}`);
              const tName = String(tc?.name || 'tool');
              const inStr =
                tc?.args && typeof tc.args === 'object'
                  ? JSON.stringify(tc.args)
                  : typeof tc?.args === 'string'
                  ? tc.args
                  : '';
              const outStr =
                typeof tc?.result === 'string'
                  ? tc.result
                  : typeof tc?.output === 'string'
                  ? tc.output
                  : '';
              const cls = classifyTool(tName, inStr);
              const st: LiveToolCall['status'] = tc?.error
                ? 'error'
                : outStr || obj.status === 'DONE'
                ? 'ok'
                : 'running';
              const ex = run.tools.find((x) => x.id === tid);
              if (!ex) {
                run.tools.push({
                  id: tid,
                  name: tName,
                  category: cls.category,
                  icon: cls.icon,
                  summary: cls.summary,
                  status: st,
                  input: inStr || undefined,
                  output: outStr || undefined,
                  startedAt: new Date().toISOString(),
                });
                changed = true;
              } else if (ex.status !== st || (outStr && !ex.output)) {
                ex.status = st;
                if (outStr) ex.output = outStr;
                changed = true;
              }
            }
          }
        } catch {}
      }

      if (thoughts && thoughts !== run.thoughts) {
        run.thoughts = thoughts;
        changed = true;
      }
      if (text && text !== run.text) {
        run.text = text;
        changed = true;
      }
      if (changed) {
        this.markRunSeenByDispatch(run);
        this.broadcast('run_update', run);
      }
    } catch {}
  }

  private finalizeRun(
    run: ActiveRun,
    opts: {
      prof: ChannelProfile;
      sessionName: string;
      traceSessionId?: string;
      cwd: string;
      prompt: string;
      model: string;
      permissions: 'all' | 'reads' | 'deny';
      source: 'web' | 'cli';
    },
  ) {
    const { prof, sessionName, cwd, model } = opts;
    const key = this.slotKey(prof.id, sessionName);

    this.activeProcs.delete(key);
    this.activeRuns.delete(key);
    if (run.codexThreadId) this.activeCodexRunsByThread.delete(run.codexThreadId);
    if (run.claudeSessionId) this.activeClaudeRunsBySession.delete(run.claudeSessionId);

    // Clean up any unresolved live in-turn approvals for this run
    for (const [apprId, entry] of this.liveApprovalResolvers.entries()) {
      if (entry.runId === run.runId) {
        this.liveApprovalResolvers.delete(apprId);
        const item = this.pendingApprovals.find((a) => a.id === apprId);
        if (item && item.status === 'pending') item.status = 'rejected';
        try {
          entry.resolve(false);
        } catch {}
      }
    }
    run.waitingApprovalId = undefined;

    for (const t of run.tools) {
      if (t.status === 'running') t.status = run.status === 'failed' ? 'error' : 'ok';
    }

    run.endedAt = new Date().toISOString();
    run.durationMs = Date.now() - Date.parse(run.startedAt);

    // Find updated traceSessionId
    const linked = this.listAcpxSessions().find(
      (s) => s.channel === prof.id && s.sessionName === sessionName,
    );
    if (linked) {
      run.traceSessionId = linked.traceSessionId;
    }

    this.rememberRun(run);
    try {
      this.onRunFinalizedForDispatches(run);
    } catch {}

    // Update per-channel circuit-breaker & health stats
    const curHealth = this.channelFailures.get(prof.id) || {
      started: 1,
      delivered: 0,
      failed: 0,
      consecutiveFailures: 0,
      state: 'closed' as const,
      lastAt: Date.now(),
    };
    curHealth.lastAt = Date.now();
    if (run.status === 'completed' && !run.error) {
      curHealth.delivered += 1;
      curHealth.consecutiveFailures = 0;
      curHealth.state = 'closed';
      curHealth.openedAt = undefined;
    } else if (run.status === 'failed') {
      curHealth.failed += 1;
      curHealth.consecutiveFailures += 1;
      curHealth.lastError = run.error || '执行异常退出';
      if (curHealth.consecutiveFailures >= 3) {
        curHealth.state = 'open';
        if (!curHealth.openedAt) curHealth.openedAt = new Date().toISOString();
      }
    }
    this.channelFailures.set(prof.id, curHealth);

    // Append governance event to channels/events.jsonl
    try {
      mkdirSync(join(this.repoRoot, 'channels'), { recursive: true });
      appendFileSync(
        this.eventsFile,
        JSON.stringify({
          ts: run.endedAt,
          kind: 'gateway_turn',
          source: run.source,
          channel: run.channel,
          session: run.sessionName,
          traceSessionId: run.traceSessionId,
          status: run.status,
          durationMs: run.durationMs,
          promptPreview: run.prompt.slice(0, 80),
        }) + '\n',
        'utf8',
      );
    } catch {}

    this.draftSessions.delete(key);

    // Detect if any tool call or turn output was blocked due to read-only / denied permissions
    // (Skip post-turn fill for codex & claude since they use real in-turn approval via app-server / stream-json)
    const permRe = /(permission|denied|not allowed|read-only|refused|approval|未经授权|权限被拒|拒绝执行)/i;
    const blockedTool = run.tools.find(
      (t) =>
        (t.status === 'error' && permRe.test(t.output || '')) ||
        (opts.permissions !== 'all' && (t.category === 'edit' || t.category === 'shell') && t.status === 'error'),
    );
    if (
      prof.id !== 'codex' &&
      prof.id !== 'claude' &&
      !sessionName.startsWith('meta-brain') &&
      (blockedTool || (opts.permissions !== 'all' && permRe.test(run.error || run.text || '')))
    ) {
      const approvalItem: PendingApproval = {
        id: `appr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        runId: run.runId,
        channel: prof.id,
        sessionName,
        traceSessionId: run.traceSessionId,
        cwd,
        model,
        prompt: opts.prompt,
        toolName: blockedTool ? blockedTool.summary || blockedTool.name : '写入/终端工具请求',
        toolInput: blockedTool?.input,
        reason: blockedTool?.output || run.error || `当前会话处于 ${opts.permissions} 权限门禁下，操作等待批准`,
        createdAt: new Date().toISOString(),
        status: 'pending',
        inTurn: false,
        mode: 'session-retry',
      };
      this.pendingApprovals.unshift(approvalItem);
      if (this.pendingApprovals.length > 20) this.pendingApprovals.pop();
    }

    // Resolve any synchronous CLI/MCP waiters waiting on this runId
    const waiters = this.runWaiters.get(run.runId);
    if (waiters && waiters.length > 0) {
      this.runWaiters.delete(run.runId);
      for (const fn of waiters) {
        try {
          fn(run);
        } catch {}
      }
    }

    this.broadcast('run_done', run);
    this.broadcast('state', this.getState());

    // Refresh SessionStore asynchronously in background so SSE run_done is never delayed
    this.store.refresh(0).catch(() => {});

    // Check Meta-Agents for Loop Guard / Model Failover / Auto-Resume on failure (skip for brain sessions themselves!)
    const isBrainSession = sessionName.startsWith('meta-brain');
    const errTools = run.tools.filter((t) => t.status === 'error');
    const auditor = this.metaAgents.get('meta_auditor');
    if (!isBrainSession && auditor?.enabled && errTools.length >= (auditor.maxConsecutiveErrors || 3)) {
      this.recordMetaAction(
        'meta_auditor',
        prof.id,
        sessionName,
        '死循环预警',
        `检测到单轮连续 ${errTools.length} 次工具调用报错，已触发元智能体的诊断会话审计`,
        { eventKind: 'loop_detected' },
      );
      if (auditor.engineMode !== 'local_rules') {
        this.invokeMetaBrainForIncident({
          metaId: 'meta_auditor',
          eventKind: 'loop_detected',
          targetChannel: prof.id,
          targetSessionName: sessionName,
          summary: `单轮连续 ${errTools.length} 次工具调用报错`,
          errorDetail: errTools.map((t) => `${t.name}: ${(t.output || '').slice(0, 120)}`).join(' | '),
        }).catch(() => {});
      }
    }

    const resumer = this.metaAgents.get('meta_resumer');
    const maint = this.metaAgents.get('meta_maint');
    const retryCount = run.retryCount || 0;
    const maxRetries = resumer?.maxRetries ?? 2;

    // Retry only a turn that never got its own result (the process or the connection broke mid-turn).
    // A turn that ended (even with a refusal), a failed session setup, or a refused tool is not retried:
    // retrying those repeats the same outcome and spends a turn each time.
    const brokeMidTurn = !run.stopReason && !run.setupFailed && !run.deniedTools?.length;
    if (!isBrainSession && run.status === 'failed' && brokeMidTurn && resumer?.enabled && retryCount < maxRetries) {
      let nextModel = model;
      const errMsg = String(run.error || '');
      const isQuotaErr = /(429|quota|rate[_\s-]?limit|overloaded|model_not_found|unavailable|refusal)/i.test(errMsg);
      if (maint?.enabled && isQuotaErr) {
        const candidates = prof.recommendedModels.filter((m) => m !== model);
        if (candidates.length > 0) {
          nextModel = candidates[0];
          this.selectedModels.set(key, nextModel);
          this.recordMetaAction(
            'meta_maint',
            prof.id,
            sessionName,
            '模型容灾切换',
            `检测到配额/模型异常 (${errMsg.slice(0, 50)})，自动从 ${model} 切换至备选模型 ${nextModel}`,
            { eventKind: 'quota_or_model_error' },
          );
        }
      }

      const delayMs = (resumer.retryDelaySec || 2) * 1000;
      this.recordMetaAction(
        'meta_resumer',
        prof.id,
        sessionName,
        `断网/Bug自动续跑 (#${retryCount + 1})`,
        `检测到异常中断 (${errMsg.slice(0, 60) || '进程非零退出'})，唤醒元智能体的诊断会话诊断并在 ${resumer.retryDelaySec || 2}s 后自动续跑`,
        { eventKind: 'execution_failure' },
      );

      // Wake up Supervisor Meta-Agent brain in parallel if configured
      if (resumer.engineMode !== 'local_rules') {
        this.invokeMetaBrainForIncident({
          metaId: 'meta_resumer',
          eventKind: isQuotaErr ? 'quota_or_model_error' : 'execution_failure',
          targetChannel: prof.id,
          targetSessionName: sessionName,
          summary: errMsg || '进程非零退出',
        }).catch(() => {});
      }

      setTimeout(() => {
        if (this.activeRuns.get(key)?.status === 'running') return;
        this.startRunInternal({
          prof,
          sessionName,
          traceSessionId: run.traceSessionId,
          cwd,
          // Quote the user's original words, not the previous retry prompt (retries used to nest).
          prompt: `上一轮在中途断开了，没有拿到回复。请接着完成原来的请求：${(run.originalPrompt || opts.prompt).slice(0, 400)}`,
          model: nextModel,
          permissions: opts.permissions,
          source: opts.source,
          retryCount: retryCount + 1,
          resumedByMeta: 'meta_resumer',
          originalPrompt: run.originalPrompt || opts.prompt,
        });
      }, delayMs);
      return;
    }

    // Dequeue next prompt if any
    const q = this.queues.get(key) || [];
    if (q.length > 0) {
      const next = q.shift()!;
      this.queues.set(key, q);
      this.startRunInternal({
        prof,
        sessionName,
        traceSessionId: run.traceSessionId,
        cwd,
        prompt: next.prompt,
        model: next.model || model,
        permissions: next.permissions,
        source: next.source,
      });
    }
  }

  private saveDriverSessionRecord(params: {
    channel: ChannelId;
    sessionName: string;
    nativeId: string;
    cwd: string;
    model: string;
    driverName: 'app-server' | 'stream-json' | 'acp-resident';
    prompt?: string;
    reply?: string;
  }) {
    try {
      mkdirSync(this.acpxDir, { recursive: true });
      const safeName = params.sessionName.replace(/[^a-zA-Z0-9._-]/g, '_');
      const recordId = `driver-${params.channel}-${safeName}`;
      const filePath = join(this.acpxDir, `${recordId}.json`);
      const now = new Date().toISOString();
      let existing: any = null;
      if (existsSync(filePath)) {
        try {
          existing = JSON.parse(readFileSync(filePath, 'utf8'));
        } catch {}
      }
      const messages: any[] = Array.isArray(existing?.messages) ? existing.messages : [];
      if (params.prompt) {
        messages.push({ User: { content: [{ Text: params.prompt }] } });
      }
      if (params.reply) {
        messages.push({ Agent: { content: [{ Text: params.reply }], tool_results: {} } });
      }
      const record = {
        schema: 'acpx.session.v1',
        acpx_record_id: recordId,
        acp_session_id: params.nativeId,
        // acpx reads this to start the agent and listAcpxSessions to tell the product: for a resident ACP session it is
        // the same bridge command acpx would use.
        agent_command:
          params.driverName === 'acp-resident'
            ? (({ cmd, args }) => [cmd, ...args].join(' '))(resolveAcpBridgeCommand(CHANNEL_PROFILES[params.channel]?.acpxAgent || params.channel))
            : params.channel === 'codex'
            ? 'codex app-server'
            : 'claude --input-format stream-json',
        cwd: params.cwd,
        name: params.sessionName,
        created_at: existing?.created_at || now,
        last_used_at: now,
        last_seq: messages.length,
        event_count: messages.length,
        messages,
        acpx: {
          ...(existing?.acpx || {}),
          current_model_id: params.model,
          driver: params.driverName,
        },
      };
      writeFileSync(filePath, JSON.stringify(record, null, 2), 'utf8');
    } catch {}
  }

  private hasClaudeTranscriptOnDisk(sessionId: string): boolean {
    if (!sessionId) return false;
    try {
      const projectsDir = join(HOME, '.claude', 'projects');
      if (!existsSync(projectsDir)) return false;
      for (const dir of readdirSync(projectsDir, { withFileTypes: true })) {
        if (!dir.isDirectory()) continue;
        if (existsSync(join(projectsDir, dir.name, `${sessionId}.jsonl`))) {
          return true;
        }
      }
    } catch {}
    return false;
  }

  private async ensureCodexDriver(): Promise<CodexAppServerDriver> {
    if (this.codexDriver) return this.codexDriver;
    if (this.codexDriverStarting) return this.codexDriverStarting;

    this.codexDriverStarting = (async () => {
      const driver = new CodexAppServerDriver({
        cwd: this.repoRoot,
        proxyUrl: 'http://127.0.0.1:7892',
        defaultSandbox: 'workspace-write',
        defaultApprovalPolicy: 'untrusted',
        autoApprove: false,
        onApprovalRequest: (req) => this.handleCodexApproval(req),
      });

      driver.on('exit', () => {
        if (this.codexDriver === driver) {
          this.codexDriver = null;
        }
      });

      driver.on('notification', (msg: { method: string; params: any }) => {
        const method = msg?.method;
        const p = msg?.params || {};
        const tid = p?.threadId || p?.turn?.threadId;
        if (!tid) return;
        const r = this.activeCodexRunsByThread.get(tid);
        if (!r) return;

        if (method === 'turn/started' && p?.turn?.id) {
          r.codexTurnId = p.turn.id;
          this.broadcast('run_update', r);
        } else if (method === 'item/agentMessage/delta' && typeof p.delta === 'string') {
          r.text += p.delta;
          this.markRunSeenByDispatch(r);
          this.broadcast('run_update', r);
        } else if (
          (method === 'item/reasoning/summaryTextDelta' || method === 'item/reasoning/textDelta') &&
          typeof p.delta === 'string'
        ) {
          r.thoughts += p.delta;
          this.markRunSeenByDispatch(r);
          this.broadcast('run_update', r);
        } else if (method === 'item/started' && p.item) {
          const item = p.item;
          if (item.type === 'commandExecution' || item.type === 'fileChange' || item.type === 'mcpToolCall') {
            const itemId = String(item.id || `codex_item_${r.tools.length + 1}`);
            const tName =
              item.type === 'commandExecution'
                ? 'Bash'
                : item.type === 'fileChange'
                ? 'FileChange'
                : String(item.tool || item.name || 'mcp');
            const inStr =
              typeof item.command === 'string'
                ? item.command
                : Array.isArray(item.command)
                ? item.command.join(' ')
                : JSON.stringify(item.changes || item.arguments || {}).slice(0, 400);
            const cls = classifyTool(tName, inStr);
            if (!r.tools.some((x) => x.id === itemId)) {
              r.tools.push({
                id: itemId,
                name: tName,
                category: cls.category,
                icon: cls.icon,
                summary: cls.summary,
                status: 'running',
                input: inStr || undefined,
                startedAt: new Date().toISOString(),
              });
              this.markRunSeenByDispatch(r);
              this.broadcast('run_update', r);
            }
          }
        } else if (method === 'item/completed' && p.item) {
          const item = p.item;
          if (item.type === 'agentMessage' && typeof item.text === 'string' && item.text.trim()) {
            if (!r.text) {
              r.text = item.text;
            } else if (!r.text.includes(item.text.trim())) {
              r.text = `${r.text}\n${item.text}`;
            }
            this.markRunSeenByDispatch(r);
            this.broadcast('run_update', r);
          } else if (item.id) {
            const ex = r.tools.find((x) => x.id === String(item.id));
            if (ex) {
              ex.status =
                (typeof item.exitCode === 'number' && item.exitCode !== 0) ||
                item.status === 'failed' ||
                item.status === 'declined'
                  ? 'error'
                  : 'ok';
              const out = item.aggregatedOutput || item.output || '';
              if (typeof out === 'string' && out) ex.output = out.slice(0, 1200);
              this.markRunSeenByDispatch(r);
              this.broadcast('run_update', r);
            }
          }
        }
      });

      await driver.start();
      this.codexDriver = driver;
      return driver;
    })().finally(() => {
      this.codexDriverStarting = null;
    });

    return this.codexDriverStarting;
  }

  private async handleCodexApproval(req: ServerApprovalRequest): Promise<ApprovalDecision> {
    const run = this.activeCodexRunsByThread.get(req.threadId);
    if (!run) return 'decline';
    if (run.permissions === 'all') return 'accept';
    if (run.permissions === 'deny') return 'decline';

    const apprId = `appr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    // The protocol says a string; older servers sent an argv array.
    const rawCmd: unknown = req.command;
    const cmdText = typeof rawCmd === 'string' ? rawCmd : Array.isArray(rawCmd) ? rawCmd.join(' ') : '';
    const toolName =
      req.method === 'item/commandExecution/requestApproval' || req.method === 'execCommandApproval'
        ? `CommandExecution${cmdText ? ': ' + cmdText.slice(0, 80) : ''}`
        : req.method === 'item/fileChange/requestApproval' || req.method === 'applyPatchApproval'
        ? 'FileChange (写入/修改文件)'
        : req.method;
    const toolInput = JSON.stringify(req.raw || req).slice(0, 600);

    const approvalItem: PendingApproval = {
      id: apprId,
      runId: run.runId,
      channel: 'codex',
      sessionName: run.sessionName,
      traceSessionId: run.traceSessionId,
      cwd: run.cwd,
      model: run.model,
      prompt: run.prompt,
      toolName,
      toolInput,
      reason: req.reason || `Codex 轮内请求执行受控操作 (${req.method})，批准后当前轮继续执行`,
      createdAt: new Date().toISOString(),
      status: 'pending',
      inTurn: true,
      mode: 'in-turn',
    };

    this.pendingApprovals.unshift(approvalItem);
    if (this.pendingApprovals.length > 20) this.pendingApprovals.pop();
    run.waitingApprovalId = apprId;
    (run.warnings ||= []).push(`轮内等待审批: ${toolName}`);
    this.broadcast('run_update', run);
    this.broadcast('state', this.getState());

    return new Promise<ApprovalDecision>((resolve) => {
      this.liveApprovalResolvers.set(apprId, {
        runId: run.runId,
        channel: 'codex',
        resolve: (allow: boolean) => resolve(allow ? 'accept' : 'decline'),
      });
    });
  }

  private async steerCodexRun(run: ActiveRun, prompt: string): Promise<boolean> {
    try {
      const deadline = Date.now() + 5000;
      while (run.status === 'running' && (!run.codexThreadId || !run.codexTurnId) && Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 80));
      }
      if (run.status !== 'running' || !run.codexThreadId || !run.codexTurnId || !this.codexDriver) {
        return false;
      }
      await this.codexDriver.steerTurn(run.codexThreadId, run.codexTurnId, prompt);
      (run.steeredPrompts ||= []).push(prompt);
      (run.warnings ||= []).push('中途插话 (turn/steer)：' + prompt.slice(0, 80));
      this.markRunSeenByDispatch(run);
      this.broadcast('run_update', run);
      return true;
    } catch {
      return false;
    }
  }

  private startCodexAppServerRun(
    run: ActiveRun,
    opts: {
      prof: ChannelProfile;
      sessionName: string;
      traceSessionId?: string;
      cwd: string;
      prompt: string;
      model: string;
      permissions: 'all' | 'reads' | 'deny';
      source: 'web' | 'cli';
    },
  ): ActiveRun {
    const { sessionName, cwd, prompt, model } = opts;
    (async () => {
      let threadId = '';
      try {
        const driver = await this.ensureCodexDriver();
        const existingRec = this.listAcpxSessions().find(
          (s) => s.channel === 'codex' && s.sessionName === sessionName,
        );
        let candidateId = existingRec?.acpSessionId || '';
        if (!candidateId && opts.traceSessionId) {
          candidateId = opts.traceSessionId.startsWith('codex:')
            ? opts.traceSessionId.slice('codex:'.length)
            : /^[0-9a-f-]{36}$/i.test(opts.traceSessionId)
            ? opts.traceSessionId
            : '';
        }

        if (candidateId) {
          try {
            threadId = await driver.resumeThread(candidateId, {
              cwd,
              model,
              sandbox: 'workspace-write',
              approvalPolicy: 'untrusted',
            });
          } catch {
            threadId = '';
          }
        }
        if (!threadId) {
          const started = await driver.startThread({
            cwd,
            model,
            sandbox: 'workspace-write',
            approvalPolicy: 'untrusted',
            name: sessionName,
          });
          threadId = started.threadId;
        }

        run.codexThreadId = threadId;
        run.traceSessionId = `codex:${threadId}`;
        this.activeCodexRunsByThread.set(threadId, run);
        this.saveDriverSessionRecord({
          channel: 'codex',
          sessionName,
          nativeId: threadId,
          cwd,
          model,
          driverName: 'app-server',
        });
        this.broadcast('run_update', run);

        const turnRes = await driver.startTurn({
          threadId,
          input: prompt,
          model,
          effort: (this.codexEfforts.get(this.slotKey('codex', sessionName)) as any) || 'low',
          cwd,
        });
        run.codexTurnId = turnRes.turnId;
        this.broadcast('run_update', run);

        const done = await driver.waitForTurn(turnRes.turnId, ACPX_TURN_TIMEOUT_SEC * 1000);
        if ((run.status as string) === 'cancelling' || (run.status as string) === 'aborted') {
          run.status = 'aborted';
        } else if (done.status === 'interrupted') {
          run.status = 'aborted';
        } else if (done.status === 'failed') {
          run.status = 'failed';
          run.error = done.error?.message || 'Codex turn failed';
        } else {
          run.status = 'completed';
        }

        if (!run.text.trim()) {
          try {
            const threadData = await driver.readThread(threadId);
            const turns = Array.isArray(threadData?.turns) ? threadData.turns : [];
            const lastTurn = turns.find((t: any) => t?.id === turnRes.turnId) || turns[turns.length - 1];
            const items = Array.isArray(lastTurn?.items) ? lastTurn.items : [];
            const texts = items
              .filter((it: any) => it?.type === 'agentMessage' && typeof it.text === 'string')
              .map((it: any) => it.text);
            if (texts.length > 0) run.text = texts.join('\n');
          } catch {}
        }

        this.saveDriverSessionRecord({
          channel: 'codex',
          sessionName,
          nativeId: threadId,
          cwd,
          model,
          driverName: 'app-server',
          prompt,
          reply: run.text,
        });
      } catch (e: any) {
        if ((run.status as string) !== 'aborted' && (run.status as string) !== 'cancelling') {
          run.status = 'failed';
          run.error = e?.message || String(e);
        } else {
          run.status = 'aborted';
        }
      } finally {
        if (threadId) this.activeCodexRunsByThread.delete(threadId);
        if (this.activeRuns.get(this.slotKey('codex', sessionName))?.runId === run.runId) {
          this.finalizeRun(run, opts);
        }
      }
    })();
    return run;
  }

  private ensureClaudeDriver(): ClaudeStreamDriver {
    if (this.claudeDriver) return this.claudeDriver;
    const driver = new ClaudeStreamDriver({
      cwd: this.repoRoot,
      proxyUrl: 'http://127.0.0.1:7892',
      defaultModel: 'haiku',
      settingSources: 'project,local',
      permissionMode: 'default',
      autoApprove: false,
      onApprovalRequest: (req) => this.handleClaudeApproval(req),
    });

    driver.on('sessionEvent', ({ sessionId, event }: { sessionId: string; event: any }) => {
      const r = this.activeClaudeRunsBySession.get(sessionId);
      if (!r || !event) return;

      if (event.type === 'assistant' && Array.isArray(event.message?.content)) {
        let changed = false;
        for (const block of event.message.content) {
          if (block.type === 'thinking' && typeof block.thinking === 'string' && block.thinking.trim()) {
            r.thoughts = block.thinking.trim();
            changed = true;
          } else if (block.type === 'text' && typeof block.text === 'string' && block.text.trim()) {
            r.text = block.text;
            changed = true;
          } else if (block.type === 'tool_use') {
            const tid = String(block.id || `claude_tool_${r.tools.length + 1}`);
            const tName = String(block.name || 'tool');
            const inStr = block.input ? JSON.stringify(block.input) : '';
            const cls = classifyTool(tName, inStr);
            if (!r.tools.some((x) => x.id === tid)) {
              r.tools.push({
                id: tid,
                name: tName,
                category: cls.category,
                icon: cls.icon,
                summary: cls.summary,
                status: 'running',
                input: inStr || undefined,
                startedAt: new Date().toISOString(),
              });
              changed = true;
            }
          }
        }
        if (changed) {
          this.markRunSeenByDispatch(r);
          this.broadcast('run_update', r);
        }
      } else if (event.type === 'user' && Array.isArray(event.message?.content)) {
        let changed = false;
        for (const block of event.message.content) {
          if (block.type === 'tool_result' && block.tool_use_id) {
            const ex = r.tools.find((x) => x.id === String(block.tool_use_id));
            if (ex) {
              ex.status = block.is_error ? 'error' : 'ok';
              const outStr =
                typeof block.content === 'string'
                  ? block.content
                  : JSON.stringify(block.content || '').slice(0, 1200);
              if (outStr) ex.output = outStr;
              changed = true;
            }
          }
        }
        if (changed) {
          this.markRunSeenByDispatch(r);
          this.broadcast('run_update', r);
        }
      }
    });

    this.claudeDriver = driver;
    return driver;
  }

  private async handleClaudeApproval(req: ClaudeCanUseToolRequest): Promise<'allow' | 'deny'> {
    const run = this.activeClaudeRunsBySession.get(req.sessionId);
    if (!run) return 'deny';
    if (run.permissions === 'all') return 'allow';
    if (run.permissions === 'deny') return 'deny';

    // Under 'reads', auto-allow purely read-only tools and intercept write/edit/shell tools in-turn
    if (/^(Read|Glob|Grep|LS|WebFetch|WebSearch)$/i.test(req.toolName || '')) {
      return 'allow';
    }

    const apprId = `appr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const toolName = req.displayName || req.toolName || 'can_use_tool';
    const toolInput = JSON.stringify(req.input || {}).slice(0, 600);

    const approvalItem: PendingApproval = {
      id: apprId,
      runId: run.runId,
      channel: 'claude',
      sessionName: run.sessionName,
      traceSessionId: run.traceSessionId,
      cwd: run.cwd,
      model: run.model,
      prompt: run.prompt,
      toolName,
      toolInput,
      reason: req.description || `Claude 轮内请求调用受控工具 ${toolName}（批准后当前轮继续执行）`,
      createdAt: new Date().toISOString(),
      status: 'pending',
      inTurn: true,
      mode: 'in-turn',
    };

    this.pendingApprovals.unshift(approvalItem);
    if (this.pendingApprovals.length > 20) this.pendingApprovals.pop();
    run.waitingApprovalId = apprId;
    (run.warnings ||= []).push(`轮内等待审批: ${toolName}`);
    this.broadcast('run_update', run);
    this.broadcast('state', this.getState());

    return new Promise<'allow' | 'deny'>((resolve) => {
      this.liveApprovalResolvers.set(apprId, {
        runId: run.runId,
        channel: 'claude',
        resolve: (allow: boolean) => resolve(allow ? 'allow' : 'deny'),
      });
    });
  }

  private startClaudeStreamRun(
    run: ActiveRun,
    opts: {
      prof: ChannelProfile;
      sessionName: string;
      traceSessionId?: string;
      cwd: string;
      prompt: string;
      model: string;
      permissions: 'all' | 'reads' | 'deny';
      source: 'web' | 'cli';
    },
  ): ActiveRun {
    const { sessionName, cwd, prompt, model } = opts;
    (async () => {
      let sessionId = '';
      try {
        const driver = this.ensureClaudeDriver();
        const existingRec = this.listAcpxSessions().find(
          (s) => s.channel === 'claude' && s.sessionName === sessionName,
        );
        let candidateId = existingRec?.acpSessionId || '';
        if (!candidateId && opts.traceSessionId) {
          candidateId = opts.traceSessionId.startsWith('claude-code:')
            ? opts.traceSessionId.slice('claude-code:'.length)
            : /^[0-9a-f-]{36}$/i.test(opts.traceSessionId)
            ? opts.traceSessionId
            : '';
        }
        sessionId = candidateId || crypto.randomUUID();
        run.claudeSessionId = sessionId;
        run.traceSessionId = `claude-code:${sessionId}`;
        this.activeClaudeRunsBySession.set(sessionId, run);
        this.saveDriverSessionRecord({
          channel: 'claude',
          sessionName,
          nativeId: sessionId,
          cwd,
          model,
          driverName: 'stream-json',
        });
        this.broadcast('run_update', run);

        const hotSession = driver.getSession(sessionId);
        let session: ClaudeStreamSession;
        if (hotSession && hotSession.running) {
          session = hotSession;
        } else if (this.hasClaudeTranscriptOnDisk(sessionId)) {
          session = await driver.resume(sessionId, { cwd, defaultModel: model });
        } else {
          session = await driver.open(sessionId, { cwd, defaultModel: model });
        }

        const res = await session.submit(prompt, ACPX_TURN_TIMEOUT_SEC * 1000);
        if (res.resultText && !run.text.trim()) {
          run.text = res.resultText;
        }
        if ((run.status as string) === 'cancelling' || (run.status as string) === 'aborted' || res.status === 'interrupted') {
          run.status = 'aborted';
        } else if (res.status === 'failed') {
          run.status = 'failed';
          run.error = res.resultText || 'Claude turn failed';
        } else {
          run.status = 'completed';
        }

        this.saveDriverSessionRecord({
          channel: 'claude',
          sessionName,
          nativeId: sessionId,
          cwd,
          model,
          driverName: 'stream-json',
          prompt,
          reply: run.text,
        });
      } catch (e: any) {
        if ((run.status as string) !== 'aborted' && (run.status as string) !== 'cancelling') {
          run.status = 'failed';
          run.error = e?.message || String(e);
        } else {
          run.status = 'aborted';
        }
      } finally {
        if (sessionId) this.activeClaudeRunsBySession.delete(sessionId);
        if (this.activeRuns.get(this.slotKey('claude', sessionName))?.runId === run.runId) {
          this.finalizeRun(run, opts);
        }
      }
    })();
    return run;
  }

  /**
   * One turn on the product's resident ACP bridge (route "acp-resident" in hub/data/products.json): the bridge
   * for this folder stays up between turns and a session, once loaded, stays hot. Its frames go through the
   * same parser as acpx's output (handleAcpFrame), so replies, thoughts, tools and refusals read the same way.
   * A session the bridge cannot load falls back to acpx for this turn.
   */
  private startAcpResidentRun(run: ActiveRun, opts: RunOpts): ActiveRun {
    const { prof, sessionName, cwd, prompt, model } = opts;
    (async () => {
      let sid = '';
      let handedOff = false;
      try {
        const driver = await this.ensureAcpDriver(prof, cwd);
        const rec = this.listAcpxSessions().find((s) => s.channel === prof.id && s.sessionName === sessionName && s.acpSessionId);
        const prefix = prof.traceKind + ':';
        sid = rec?.acpSessionId || (opts.traceSessionId?.startsWith(prefix) ? opts.traceSessionId.slice(prefix.length) : '');
        let info = sid ? driver.getSession(sid) : undefined;
        if (!info && sid) {
          try {
            info = await driver.loadSession(sid, cwd);
          } catch (e: any) {
            (run.warnings ||= []).push(`常驻桥载入会话失败，这一轮改走 acpx：${e?.message || e}`);
            handedOff = true;
            this.startAcpxRun(run, opts);
            return;
          }
        }
        if (!info) {
          info = await driver.createSession(cwd);
          sid = info.sessionId;
        }
        run.acpSessionId = sid;
        if (model && info.currentModel !== model) {
          try {
            await driver.setSessionModel(sid, model);
          } catch (e: any) {
            (run.warnings ||= []).push(`没换成模型 ${model}：${e?.message || e}`);
          }
        }
        // The model the agent says it is on, not only the one asked for.
        if (info.currentModel) run.model = info.currentModel;
        // Products whose own mode decides whether they ask before writing (ZCode) get the mode for this turn's permission.
        const mode = this.acpPinnedModes.get(sid) || prof.acpModes?.[opts.permissions];
        if (mode && info.currentMode !== mode) {
          try {
            await driver.setSessionMode(sid, mode);
          } catch (e: any) {
            (run.warnings ||= []).push(`没切到模式 ${mode}：${e?.message || e}`);
          }
        }
        const ownRecord = !rec || rec.acpxRecordId.startsWith('driver-');
        if (ownRecord) {
          this.saveDriverSessionRecord({ channel: prof.id, sessionName, nativeId: sid, cwd, model: run.model, driverName: 'acp-resident' });
        }
        run.traceSessionId = this.canonicalSessionId(prof.id, sid);
        this.activeAcpRunsBySession.set(sid, run);
        this.broadcast('run_update', run);

        const pics = this.promptImages.get(prompt);
        if (pics) this.promptImages.delete(prompt);
        let timer: ReturnType<typeof setTimeout> | undefined;
        const timeout = new Promise<never>((_, rej) => {
          timer = setTimeout(() => {
            driver.cancelTurn(sid);
            rej(new Error(`这一轮超过 ${ACPX_TURN_TIMEOUT_SEC} 秒没结束，已叫停`));
          }, ACPX_TURN_TIMEOUT_SEC * 1000);
        });
        const turn = driver.promptTurn(sid, pics ? [{ type: 'text', text: prompt }, ...pics] : prompt);
        const res = await Promise.race([turn, timeout]).finally(() => clearTimeout(timer));
        this.handleAcpFrame(run, { result: res.raw || { stopReason: res.stopReason } });
        if (!run.text.trim() && res.text) run.text = res.text;
        if ((run.status as string) === 'cancelling' || (run.status as string) === 'aborted') {
          run.status = 'aborted';
        } else {
          const outcome = this.judgeAcpxTurn(run, 0, '');
          run.status = outcome.status;
          if (outcome.error) run.error = outcome.error;
        }
        if (ownRecord) {
          this.saveDriverSessionRecord({
            channel: prof.id,
            sessionName,
            nativeId: sid,
            cwd,
            model: run.model,
            driverName: 'acp-resident',
            prompt,
            reply: run.text,
          });
        }
      } catch (e: any) {
        if ((run.status as string) === 'cancelling' || (run.status as string) === 'aborted') {
          run.status = 'aborted';
        } else {
          run.status = 'failed';
          run.error = e?.message || String(e);
        }
      } finally {
        if (!handedOff) {
          if (sid && this.activeAcpRunsBySession.get(sid) === run) this.activeAcpRunsBySession.delete(sid);
          if (prof.id === 'hermes') this.hermesCache = null;
          if (this.activeRuns.get(this.slotKey(prof.id, sessionName))?.runId === run.runId) this.finalizeRun(run, opts);
        }
      }
    })();
    return run;
  }

  /** The resident bridge for this product and folder, started on first use; idle ones close after ACP_IDLE_MS. */
  private async ensureAcpDriver(prof: ChannelProfile, cwd: string): Promise<AcpResidentDriver> {
    const key = `${prof.id}|${cwd.toLowerCase()}`;
    let driver = this.acpDrivers.get(key);
    if (!driver) {
      const d = new AcpResidentDriver({
        product: prof.id,
        cwd,
        bridge: { ...resolveAcpBridgeCommand(prof.acpxAgent), env: { ...agentBaseEnv(), ...prof.buildEnv() } },
        onApprovalRequest: (req) => this.handleAcpApproval(prof, req),
      });
      d.on('frame', (msg: any) => {
        const r = this.activeAcpRunsBySession.get(msg?.params?.sessionId);
        if (r) this.handleAcpFrame(r, msg);
      });
      d.on('exit', () => {
        if (this.acpDrivers.get(key) === d) this.acpDrivers.delete(key);
      });
      this.acpDrivers.set(key, d);
      driver = d;
      if (!this.acpIdleTimer) {
        this.acpIdleTimer = setInterval(() => {
          for (const [k, x] of this.acpDrivers) {
            if (!x.busy && Date.now() - x.lastUsedAt > ACP_IDLE_MS) {
              this.acpDrivers.delete(k);
              x.close().catch(() => {});
            }
          }
        }, 60_000);
        this.acpIdleTimer.unref?.();
      }
    }
    try {
      await driver.start();
    } catch (e) {
      this.acpDrivers.delete(key);
      await driver.close().catch(() => {});
      throw e;
    }
    return driver;
  }

  /** The resident bridge that has this ACP session loaded, if any. */
  private acpDriverOf(sid: string): AcpResidentDriver | undefined {
    for (const d of this.acpDrivers.values()) if (d.getSession(sid)) return d;
    return undefined;
  }

  /**
   * A permission ask from a resident ACP bridge. "all" allows, "deny" refuses; "reads" allows reading kinds
   * and holds anything else as an in-turn approval the person answers (the turn waits, as with Codex and Claude).
   */
  private async handleAcpApproval(prof: ChannelProfile, req: AcpPermissionRequest): Promise<AcpApprovalDecision> {
    const run = this.activeAcpRunsBySession.get(req.sessionId);
    if (!run) return 'reject_once';
    const last = run.tools[run.tools.length - 1];
    const title = String(req.toolCall?.title || '').trim() || run.permissionAsk || (last ? last.name : '某个工具');
    const settle = (allow: boolean): AcpApprovalDecision => {
      run.permissionAsk = undefined;
      if (!allow) (run.deniedTools ||= []).push(title);
      return allow ? 'allow_once' : 'reject_once';
    };
    // Leaving plan mode is the plan itself waiting for a yes: it always goes to the person, whatever the permission.
    const planExit = String(req.toolCall?.kind || '') === 'switch_mode' || /exit plan mode/i.test(title);
    if (run.permissions === 'deny') return settle(false);
    if (run.permissions === 'all' && !planExit) return settle(true);
    if (!planExit && ['read', 'search', 'fetch', 'think'].includes(String(req.toolCall?.kind || ''))) return settle(true);

    const apprId = `appr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    this.pendingApprovals.unshift({
      id: apprId,
      runId: run.runId,
      channel: prof.id,
      sessionName: run.sessionName,
      traceSessionId: run.traceSessionId,
      cwd: run.cwd,
      model: run.model,
      prompt: run.prompt,
      toolName: title,
      toolInput: JSON.stringify(req.toolCall?.rawInput || req.toolCall || {}).slice(0, 600),
      reason: `${prof.label} 轮内请求：${title}。批准后这一轮继续`,
      createdAt: new Date().toISOString(),
      status: 'pending',
      inTurn: true,
      mode: 'in-turn',
    });
    if (this.pendingApprovals.length > 20) this.pendingApprovals.pop();
    run.waitingApprovalId = apprId;
    (run.warnings ||= []).push(`轮内等待审批: ${title}`);
    this.broadcast('run_update', run);
    this.broadcast('state', this.getState());
    return new Promise<AcpApprovalDecision>((resolve) => {
      this.liveApprovalResolvers.set(apprId, { runId: run.runId, channel: prof.id, resolve: (allow: boolean) => resolve(settle(allow)) });
    });
  }

  private startRunInternal(opts: RunOpts): ActiveRun {
    const { prof, sessionName, cwd, prompt, model, permissions, source } = opts;
    const key = this.slotKey(prof.id, sessionName);
    const runId = `run_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const startedAt = new Date().toISOString();
    const initialMsgCount = this.getExistingMessageCount(prof.id, sessionName);

    const startHealth = this.channelFailures.get(prof.id) || {
      started: 0,
      delivered: 0,
      failed: 0,
      consecutiveFailures: 0,
      state: 'closed' as const,
      lastAt: Date.now(),
    };
    startHealth.started += 1;
    startHealth.lastAt = Date.now();
    if (startHealth.state === 'open') startHealth.state = 'probing';
    this.channelFailures.set(prof.id, startHealth);

    const run: ActiveRun = {
      runId,
      channel: prof.id,
      channelId: prof.id,
      sessionName,
      traceSessionId: opts.traceSessionId,
      cwd,
      model,
      permissions,
      source,
      prompt,
      status: 'running',
      startedAt,
      thoughts: '',
      text: '',
      tools: [],
      initialMsgCount,
      retryCount: opts.retryCount || 0,
      resumedByMeta: opts.resumedByMeta,
      originalPrompt: opts.originalPrompt || prompt,
    };

    this.activeRuns.set(key, run);
    this.broadcast('run_start', run);
    this.broadcast('state', this.getState());

    if (prof.id === 'antigravity') {
      return this.startAntigravityRun(run, opts);
    }
    if (prof.id === 'codex') {
      return this.startCodexAppServerRun(run, opts);
    }
    if (prof.id === 'claude') {
      return this.startClaudeStreamRun(run, opts);
    }
    if (prof.route === 'acp-resident') {
      return this.startAcpResidentRun(run, opts);
    }
    return this.startAcpxRun(run, opts);
  }

  /** One turn through acpx: `sessions ensure`, then `prompt`, one process per turn. */
  private startAcpxRun(run: ActiveRun, opts: RunOpts): ActiveRun {
    const { prof, sessionName, cwd, prompt, model, permissions } = opts;
    const key = this.slotKey(prof.id, sessionName);
    const env = { ...agentBaseEnv(), ...prof.buildEnv() };
    const permFlag =
      permissions === 'all'
        ? '--approve-all'
        : permissions === 'deny'
        ? '--deny-all'
        : '--approve-reads';

    // Whether acpx already has this session. Only a session that does not exist yet makes a failed ensure fatal.
    const existedBefore = this.listAcpxSessions().some(
      (s) => s.channel === prof.id && s.sessionName === sessionName && Boolean(s.fromAcpxStore),
    );

    // A session this family wrote on its own (desktop app, its CLI) is addressed by its trace id "<traceKind>:<id>".
    // Taking it over means binding the acpx name to that same agent session, not starting a fresh one beside it
    // (the "read and control are two identities" problem, evaluation R3).
    const nativeId =
      !existedBefore && opts.traceSessionId?.startsWith(prof.traceKind + ':') ? opts.traceSessionId.slice(prof.traceKind.length + 1) : '';

    // A new Claude session gets the user's global instructions appended to its system prompt (set once, when acpx
    // creates the session; an existing session keeps what it has).
    const appendPrompt = prof.id === 'claude' && !existedBefore && existsSync(ACPX_CLI) ? claudeGlobalInstructions() : '';

    // Ensure session asynchronously then stream prompt
    const ensureArgs = [
      '--format',
      'json',
      '--cwd',
      cwd,
      ...(model ? ['--model', model] : []),
      ...(appendPrompt ? ['--append-system-prompt', appendPrompt] : []),
      prof.acpxAgent,
      'sessions',
      'ensure',
      '--name',
      sessionName,
      ...(nativeId ? ['--resume-session', nativeId] : []),
    ];
    const ensureCmd = ['acpx', ...ensureArgs.map(quoteWinArg)].join(' ');

    const ensureProc = spawn(existsSync(ACPX_CLI) ? process.execPath : 'cmd.exe', existsSync(ACPX_CLI) ? [ACPX_CLI, ...ensureArgs] : ['/d', '/s', '/c', ensureCmd], {
      cwd,
      env,
      // acpx sessions ensure blocks until stdin hits EOF when stdin is a pipe (measured 2026-10-17:
      // 200 s with an open pipe vs 12 s closed), which stalled every first turn sent from the page.
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });

    ensureProc.stdout.on('data', (chunk: Buffer) => {
      this.parseNdjsonChunk(run, chunk.toString('utf8'));
    });
    let ensureErr = '';
    ensureProc.stderr.on('data', (chunk: Buffer) => {
      ensureErr += chunk.toString('utf8');
    });

    ensureProc.on('close', (ensureCode) => {
      if (run.status !== 'running') return;
      // A failed ensure used to fall through to the prompt, whose "No acpx session found" then replaced
      // the real reason (OpenCode 2026-10-18: the requested model was not one the agent advertised).
      // For a session that already exists the failure is only a warning: Hermes reported "No LLM provider
      // configured" while reloading an existing session, yet the prompt that followed answered correctly.
      if (ensureCode !== 0 && !existedBefore) {
        run.setupFailed = true;
        run.status = 'failed';
        const reason = run.warnings?.[run.warnings.length - 1] || ensureErr.trim() || `acpx 退出码 ${ensureCode}`;
        run.error = `建会话失败：${reason}`;
        this.finalizeRun(run, opts);
        return;
      }

      const promptArgs = [
        '--format',
        'json',
        permFlag,
        '--timeout',
        String(ACPX_TURN_TIMEOUT_SEC),
        '--cwd',
        cwd,
        ...(model ? ['--model', model] : []),
        prof.acpxAgent,
        'prompt', '-s', sessionName, '-f', '-',
      ];
      const runCmd = ['acpx', ...promptArgs.map(quoteWinArg)].join(' ');

      const child = spawn(
        existsSync(ACPX_CLI) ? process.execPath : 'cmd.exe',
        existsSync(ACPX_CLI) ? [ACPX_CLI, ...promptArgs] : ['/d', '/s', '/c', runCmd],
        {
          cwd,
          env,
          windowsHide: true,
        },
      );

      this.activeProcs.set(key, child);

      // Write prompt to stdin: plain text, or an ACP content-block array when pictures came with it.
      try {
        const pics = this.promptImages.get(prompt);
        if (pics) this.promptImages.delete(prompt);
        child.stdin.write(pics ? JSON.stringify([{ type: 'text', text: prompt }, ...pics]) : prompt, 'utf8');
        child.stdin.end();
      } catch {}

      let stdoutBuf = '';
      child.stdout.on('data', (chunk: Buffer) => {
        stdoutBuf += chunk.toString('utf8');
        const lines = stdoutBuf.split(/\r?\n/);
        stdoutBuf = lines.pop() || '';
        for (const line of lines) {
          if (line.trim()) this.handleAcpxLine(run, line.trim());
        }
      });

      let stderrBuf = '';
      child.stderr.on('data', (chunk: Buffer) => {
        stderrBuf += chunk.toString('utf8');
      });

      // Poll acpx session file every 600ms while running to catch live Thinking / ToolUse updates
      const pollTimer = setInterval(() => {
        this.syncFromAcpxSessionFile(run);
      }, 600);

      child.on('close', async (code) => {
        clearInterval(pollTimer);
        if (stdoutBuf.trim()) this.handleAcpxLine(run, stdoutBuf.trim());
        if (run.channel === 'hermes') this.hermesCache = null;
        this.syncFromAcpxSessionFile(run);

        if (run.status === 'cancelling' || run.status === 'aborted') {
          run.status = 'aborted';
        } else {
          const outcome = this.judgeAcpxTurn(run, code, stderrBuf);
          run.status = outcome.status;
          if (outcome.error) run.error = outcome.error;
        }

        this.finalizeRun(run, opts);
      });
    });

    return run;
  }

  /**
   * How an acpx turn ended. The turn's own prompt result decides. Errors from other requests in the same
   * stream (reloading an old backend session, applying a model) are kept as warnings: Hermes answered
   * correctly on 2026-10-17 but one of those errors marked the turn failed and set off two retries.
   * WorkBuddy's bridge reports stopReason "cancelled" even for a normal reply, so a cancelled turn that did
   * reply counts as done; one that was cancelled after a tool was refused says which tool.
   */
  private judgeAcpxTurn(run: ActiveRun, code: number | null, stderr: string): { status: 'completed' | 'failed'; error?: string } {
    // A refused tool with no reply: name the tool. WorkBuddy's own note ("Permission denied for tool(s):
    // unknown") does not say which tool it was, so it only follows in brackets.
    if (run.deniedTools?.length && !run.text.trim()) {
      const tools = run.deniedTools.slice(-3).join('；');
      const own = run.error ? `（智能体的原话：${run.error}）` : '';
      return {
        status: 'failed',
        error: `权限被拒：${tools}。当前权限不允许这个操作，智能体随后结束了这一轮，没有回复。需要的话，允许后重新发送。${own}`,
      };
    }
    if (run.error) return { status: 'failed', error: run.error }; // refusal or an error the agent attached to its result
    const stop = run.stopReason;
    // After its retries run out Codex prints the upstream error as the reply and still ends with end_turn
    // (seen 2026-10-18: "unexpected status 503 Service Unavailable: No available channel for model ...").
    if (run.upstreamErrors && UPSTREAM_ERROR_REPLY.test(run.text)) {
      return { status: 'failed', error: `上游模型渠道出错，Codex 重试 ${run.upstreamErrors} 次后放弃：${run.text.trim().slice(0, 200)}` };
    }
    if (stop === 'end_turn' || stop === 'max_tokens' || stop === 'max_turn_requests') return { status: 'completed' };
    if (stop === 'cancelled') {
      if (run.text.trim()) return { status: 'completed' };
      return { status: 'failed', error: '智能体取消了这一轮，没有回复' };
    }
    if (stop === 'refusal') return { status: 'failed', error: '模型拒绝回答（stopReason: refusal）' };
    // No result for this turn's prompt: the process ended before the agent answered.
    const last = run.warnings?.[run.warnings.length - 1];
    if (code !== 0 || !run.text) return { status: 'failed', error: last || stderr.trim() || `进程退出码 ${code}` };
    return { status: 'completed' };
  }

  private parseNdjsonChunk(run: ActiveRun, chunk: string) {
    for (const line of chunk.split(/\r?\n/)) {
      if (line.trim()) this.handleAcpxLine(run, line.trim());
    }
  }

  private handleAcpxLine(run: ActiveRun, line: string) {
    let obj: any;
    try {
      obj = JSON.parse(line);
    } catch {
      // Plain text fallback
      if (!line.startsWith('{')) {
        run.text += (run.text ? '\n' : '') + line;
        this.broadcast('run_update', run);
      }
      return;
    }
    this.handleAcpFrame(run, obj);
  }

  /** One ACP frame of a turn, from acpx's `--format json` output or from a resident bridge. */
  private handleAcpFrame(run: ActiveRun, obj: any) {
    try {
      if (obj.acpxSessionId || obj.acpxRecordId) {
        const linked = this.listAcpxSessions().find(
          (s) => s.acpxRecordId === obj.acpxRecordId || s.acpSessionId === obj.acpxSessionId,
        );
        if (linked) run.traceSessionId = linked.traceSessionId;
      }
      if (obj.method === 'session/update' && obj.params?.update) {
        this.markRunSeenByDispatch(run);
        const u = obj.params.update;
        const kind = u.sessionUpdate;
        if (kind === 'agent_thought_chunk' && u.content?.text) {
          run.thoughts += u.content.text;
          this.broadcast('run_update', run);
        } else if (kind === 'agent_message_chunk' && u.content?.text) {
          // The stream and the session-file poll each see the whole reply; keep them apart and show the
          // longer one, instead of appending onto text the poll already filled in (reply came out doubled).
          run.streamText = (run.streamText || '') + u.content.text;
          if (run.streamText.length > run.text.length) run.text = run.streamText;
          this.broadcast('run_update', run);
        } else if (kind === 'tool_call' || kind === 'tool_call_update') {
          const tid = String(u.toolCallId || u.id || `tc_${run.tools.length + 1}`);
          const rawName = String(u.title || u.name || u.toolName || 'tool');
          const inStr =
            typeof u.rawInput === 'string'
              ? u.rawInput
              : u.input
              ? JSON.stringify(u.input)
              : '';
          const outStr =
            typeof u.output === 'string'
              ? u.output
              : Array.isArray(u.content)
              ? u.content.map((c: any) => c?.text || c?.content?.text || '').join('\n')
              : '';
          const cls = classifyTool(rawName, inStr);
          let existing = run.tools.find((x) => x.id === tid);
          const st: LiveToolCall['status'] =
            u.status === 'failed' || u.status === 'error' || u.isError
              ? 'error'
              : u.status === 'completed' || u.status === 'done' || Boolean(outStr)
              ? 'ok'
              : 'running';

          if (!existing) {
            existing = {
              id: tid,
              name: rawName,
              category: cls.category,
              icon: cls.icon,
              summary: cls.summary,
              status: st,
              input: inStr || undefined,
              output: outStr || undefined,
              startedAt: new Date().toISOString(),
            };
            run.tools.push(existing);
          } else {
            if (rawName && rawName !== 'tool') {
              existing.name = rawName;
              existing.summary = cls.summary;
              existing.category = cls.category;
              existing.icon = cls.icon;
            }
            if (inStr) existing.input = inStr;
            if (outStr) existing.output = outStr;
            existing.status = st;
          }
          this.broadcast('run_update', run);
        }
      }
      // Codex reports each upstream failure it retries as `_meta.codex.error` ("Reconnecting... 1/5").
      const codexErr = obj.params?.update?._meta?.codex?.error;
      if (codexErr) {
        run.upstreamErrors = (run.upstreamErrors || 0) + 1;
        (run.warnings ||= []).push(String(codexErr.message || '上游模型渠道出错'));
      }
      // Permission asks and how the policy answered them. WorkBuddy sends an empty title, so fall back to
      // the tool call just before the ask (e.g. "Write …\memory\user_passcode.md").
      if (obj.method === 'session/request_permission') {
        const title = String(obj.params?.toolCall?.title || '').trim();
        const last = run.tools[run.tools.length - 1];
        run.permissionAsk = title || (last ? last.name : '某个工具');
      }
      const outcome = obj.result?.outcome;
      if (outcome && run.permissionAsk) {
        if (outcome.outcome === 'cancelled' || /reject|deny/i.test(String(outcome.optionId || ''))) {
          (run.deniedTools ||= []).push(run.permissionAsk);
        }
        run.permissionAsk = undefined;
      }
      if (typeof obj.result?.stopReason === 'string') run.stopReason = obj.result.stopReason;
      if (obj.result?.stopReason === 'refusal' || obj.result?._meta?.['codebuddy.ai/errorMessage']) {
        run.error =
          obj.result?._meta?.['codebuddy.ai/errorMessage'] ||
          '模型拒绝响应或需客户端 OAuth 鉴权 (stopReason: refusal)';
        this.broadcast('run_update', run);
      }
      // Errors are kept as warnings here; judgeAcpxTurn decides whether the turn failed.
      if (obj.error) {
        const details = obj.error.data?.details ? `（${String(obj.error.data.details).slice(0, 200)}）` : '';
        (run.warnings ||= []).push((obj.error.message || JSON.stringify(obj.error)) + details);
        this.broadcast('run_update', run);
      }
    } catch {}
  }

  /** Sync current turn's Thinking / ToolUse / Text from `~/.acpx/sessions/*.json` ONLY for messages added in THIS run. */
  private syncFromAcpxSessionFile(run: ActiveRun) {
    try {
      const info = this.listAcpxSessions().find(
        (s) => s.channel === run.channel && s.sessionName === run.sessionName,
      );
      if (!info) return;
      run.traceSessionId = info.traceSessionId;
      const file = join(this.acpxDir, `${info.acpxRecordId}.json`);
      if (!existsSync(file)) return;
      const raw = JSON.parse(readFileSync(file, 'utf8'));
      const msgs: any[] = Array.isArray(raw.messages) ? raw.messages : [];
      const minIdx = run.initialMsgCount ?? 0;
      // CRITICAL: Do not read messages from previous turns! Wait until acpx appends the new turn.
      if (msgs.length <= minIdx) return;

      const newSlice = msgs.slice(minIdx);
      const lastAgent = [...newSlice].reverse().find((m) => Boolean(m?.Agent));
      if (!lastAgent?.Agent) return;

      const contents: any[] = Array.isArray(lastAgent.Agent.content) ? lastAgent.Agent.content : [];
      const results: Record<string, any> = lastAgent.Agent.tool_results || {};
      let changed = false;

      let thoughts = '';
      let text = '';
      for (const item of contents) {
        if (item?.Thinking?.text) {
          const clean = String(item.Thinking.text).replace(/^Thinking…\s*/i, '').trim();
          if (clean) thoughts += (thoughts ? '\n\n' : '') + clean;
        } else if (typeof item?.Text === 'string' && item.Text) {
          text += (text ? '\n\n' : '') + item.Text;
        } else if (item?.ToolUse) {
          const tu = item.ToolUse;
          const tid = String(tu.id || '');
          if (!tid) continue;
          const tr = results[tid];
          const inStr = tu.raw_input || (tu.input ? JSON.stringify(tu.input) : '');
          const outStr = tr?.output || tr?.content?.Text || '';
          const cls = classifyTool(tu.name || 'tool', inStr);
          const st: LiveToolCall['status'] = tr ? (tr.is_error ? 'error' : 'ok') : 'running';
          const ex = run.tools.find((x) => x.id === tid);
          if (!ex) {
            run.tools.push({
              id: tid,
              name: tu.name || 'tool',
              category: cls.category,
              icon: cls.icon,
              summary: cls.summary,
              status: st,
              input: inStr || undefined,
              output: outStr || undefined,
              startedAt: new Date().toISOString(),
            });
            changed = true;
          } else if (ex.status !== st || (outStr && !ex.output)) {
            ex.status = st;
            if (outStr) ex.output = outStr;
            changed = true;
          }
        }
      }
      if (thoughts.length > run.thoughts.length) {
        run.thoughts = thoughts;
        changed = true;
      }
      if (text.length > run.text.length) {
        run.text = text;
        changed = true;
      }
      if (changed) {
        this.markRunSeenByDispatch(run);
        this.broadcast('run_update', run);
      }
    } catch {}
  }
}
