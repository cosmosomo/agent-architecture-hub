/**
 * Constants and small helpers shared by the gateway: limits and folders, tool classification, text cleanup,
 * and the meta-agents' defaults.
 */
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { ToolFamily } from '@hub-trace/contract';
import type { MetaAgentId, MetaAgentConfig, LiveToolCall } from './types.ts';

export const HOME = homedir();

/** A resident ACP bridge with no turn for this long is closed; the next turn starts it again and reloads the session. */
export const ACP_IDLE_MS = 15 * 60_000;
// Seconds one turn may run before it is stopped. Was hard-coded to 180, which killed any longer task started
// from the page (2026-10-17). Override with HUB_ACPX_TIMEOUT_SEC.
export const ACPX_TURN_TIMEOUT_SEC = Number(process.env.HUB_ACPX_TIMEOUT_SEC) > 0 ? Number(process.env.HUB_ACPX_TIMEOUT_SEC) : 3600;

// The workbench opens an agent session in a folder, the same as opening the agent there yourself. A new
// session the user did not point at a folder gets a new empty one under this root; the hub's own repository
// is never the default (2026-10-18). Override with HUB_WORKSPACE_ROOT. The pages send NEW_CWD to ask for one.
export const WORKSPACE_ROOT = process.env.HUB_WORKSPACE_ROOT || join(HOME, 'hub-workspaces');
/**
 * HUB_BACKGROUND=0: this instance only answers requests — no meta-agent patrol, no goal steps, no reconciling of
 * dispatch files. For a second copy on another port (a test of new code, an agent's smoke test) beside the main
 * 8899, which keeps doing that work; two instances doing it would act on the same dispatches twice.
 * Off under `node --test` (NODE_TEST_CONTEXT is set in each test file's process): a test that builds a real hub
 * would otherwise step the real goals and dispatch real tasks into its temp repo (seen 2026-10-19).
 */
export const BACKGROUND = process.env.HUB_BACKGROUND !== '0' && !process.env.NODE_TEST_CONTEXT;
export const NEW_CWD = '__new__';
export const UPSTREAM_ERROR_REPLY = /unexpected status \d{3}|Service Unavailable|Bad Gateway|No available channel/i;

export function isSmokeTestPrompt(text: string): boolean {
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

export function classifyTool(name: string, inputStr = ''): {
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

export function quoteWinArg(a: string): string {
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

export function stripUserRequestTags(raw: string): string {
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

export function stripWorkbuddyUserText(raw: string): string {
  const s = String(raw || '').trim();
  const q = /<user_query>\s*([\s\S]*?)\s*<\/user_query>/i.exec(s);
  if (q) return q[1].trim();
  return s.replace(/<system-reminder[\s\S]*?<\/system-reminder>/gi, '').trim() || s;
}

// The title Antigravity shows in its own window. Probe and named sessions keep their name (people and tests look
// them up by it); a task started from the pages gets the first line of what was asked, so it is recognisable.
export function agyTitle(sessionName: string, prompt: string): string {
  if (!/^m-/.test(sessionName)) return sessionName;
  const line = String(prompt).split(/\r?\n/).map((l) => l.replace(/^[#>*\s-]+/, '').trim()).find(Boolean) || sessionName;
  return line.length > 40 ? line.slice(0, 40) + '…' : line;
}

export const MAX_DISPATCH_DEPTH = 3;

/** Format an ISO string or epoch ms into local timezone string `YYYY-MM-DD HH:mm:ss+08:00`. */
export function formatLocalStamp(isoOrMs?: string | number | null): string {
  if (isoOrMs === undefined || isoOrMs === null || isoOrMs === '') return '';
  const ms = typeof isoOrMs === 'number' ? isoOrMs : Date.parse(String(isoOrMs));
  if (!Number.isFinite(ms)) return String(isoOrMs);
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  const offMin = -d.getTimezoneOffset();
  const sign = offMin >= 0 ? '+' : '-';
  const absOff = Math.abs(offMin);
  const offStr = `${sign}${pad(Math.floor(absOff / 60))}:${pad(absOff % 60)}`;
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}${offStr}`;
}

/** Format a duration in milliseconds into a concise human-readable string (`0.4s`, `45s`, `2h 11m 54s`). */
export function formatDurationShort(deltaMs: number): string {
  if (!Number.isFinite(deltaMs)) return '0s';
  const sign = deltaMs < 0 ? '-' : '';
  const abs = Math.abs(deltaMs);
  if (abs < 1000) return `${sign}${(abs / 1000).toFixed(1)}s`;
  const totalSec = Math.round(abs / 1000);
  if (totalSec < 60) return `${sign}${totalSec}s`;
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${sign}${h}h ${m}m ${s}s`;
  return `${sign}${m}m ${s}s`;
}

/**
 * Build a dual-timestamp verification banner comparing `sentIso` (sent_at) and `recvIso` (received_at),
 * flagging stale/backlogged messages when `deltaMs > 60_000` (e.g. an unloaded session flushed hours later).
 */
export function formatMessageTimingBanner(sentIso?: string, recvIso?: string, sender?: string): string {
  const sentLocal = formatLocalStamp(sentIso);
  const recvLocal = formatLocalStamp(recvIso);
  const sentMs = sentIso ? Date.parse(sentIso) : NaN;
  const recvMs = recvIso ? Date.parse(recvIso) : NaN;
  const deltaMs = Number.isFinite(sentMs) && Number.isFinite(recvMs) ? recvMs - sentMs : NaN;
  const senderPart = sender ? `｜发送方: ${sender}` : '';
  if (Number.isFinite(deltaMs) && deltaMs > 60_000) {
    return `【⚠️ 跨会话消息积压延迟告警｜发送(sent_at): ${sentLocal} → 接收(received_at): ${recvLocal}｜滞后 Δt = +${formatDurationShort(deltaMs)}${senderPart}｜请核对时效，切勿盲目覆盖最新指令】`;
  }
  const deltaPart = Number.isFinite(deltaMs) ? `｜耗时 Δt = ${formatDurationShort(Math.max(0, deltaMs))}` : '';
  if (sentLocal && recvLocal) {
    return `【跨会话消息时效核对｜发送(sent_at): ${sentLocal} → 接收(received_at): ${recvLocal}${deltaPart}${senderPart}】`;
  }
  return `【跨会话消息时效核对｜时间: ${recvLocal || sentLocal}${senderPart}】`;
}

/** Ensure an outgoing cross-session prompt carries an explicit `sent_at` timestamp header before sending. */
export function ensurePromptSentStamp(prompt: string, sentIso = new Date().toISOString()): string {
  const text = String(prompt || '');
  if (!text.trim() || isSmokeTestPrompt(text)) return text;
  if (/发送时间\s*\(sent_at\)|跨会话消息时效/i.test(text)) return text;
  const sentLocal = formatLocalStamp(sentIso);
  return `【跨会话消息时效戳｜发送时间 (sent_at): ${sentLocal} (${sentIso})｜接收时请核对当前本地时间 (received_at)，若间隔过长或与用户最新指令冲突请勿盲目覆盖】\n${text}`;
}

/** Compute local timestamps and latency deltas from a dispatch's 4-stage `receipts`. */
export function computeReceiptTiming(receipts?: {
  issuedAt?: string;
  deliveredAt?: string;
  seenAt?: string;
  returnedAt?: string;
}) {
  if (!receipts) return undefined;
  const iMs = receipts.issuedAt ? Date.parse(receipts.issuedAt) : NaN;
  const dMs = receipts.deliveredAt ? Date.parse(receipts.deliveredAt) : NaN;
  const sMs = receipts.seenAt ? Date.parse(receipts.seenAt) : NaN;
  const rMs = receipts.returnedAt ? Date.parse(receipts.returnedAt) : NaN;
  const deliveryLatencyMs = Number.isFinite(iMs) && Number.isFinite(dMs) ? Math.max(0, dMs - iMs) : undefined;
  const seenLatencyMs = Number.isFinite(iMs) && Number.isFinite(sMs) ? Math.max(0, sMs - iMs) : undefined;
  const totalDurationMs = Number.isFinite(iMs) && Number.isFinite(rMs) ? Math.max(0, rMs - iMs) : undefined;
  return {
    sentAtLocal: formatLocalStamp(receipts.issuedAt) || undefined,
    deliveredAtLocal: formatLocalStamp(receipts.deliveredAt) || undefined,
    seenAtLocal: formatLocalStamp(receipts.seenAt) || undefined,
    returnedAtLocal: formatLocalStamp(receipts.returnedAt) || undefined,
    deliveryLatencyMs,
    seenLatencyMs,
    totalDurationMs,
    deliveryDelta: deliveryLatencyMs !== undefined ? formatDurationShort(deliveryLatencyMs) : undefined,
    seenDelta: seenLatencyMs !== undefined ? formatDurationShort(seenLatencyMs) : undefined,
    totalDelta: totalDurationMs !== undefined ? formatDurationShort(totalDurationMs) : undefined,
    staleWarning:
      seenLatencyMs !== undefined && seenLatencyMs > 60_000
        ? `⚠️ 接收滞后 +${formatDurationShort(seenLatencyMs)}`
        : undefined,
  };
}
