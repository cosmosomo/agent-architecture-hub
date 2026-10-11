import type { SessionStatus, Usage } from '@hub-trace/contract';

export const STATUS_LABEL: Record<SessionStatus, string> = {
  working: '在做',
  waiting: '等待中',
  idle: '空闲',
  aborted: '被打断',
  failed: '出错',
  stale: '疑似已退出',
  empty: '空',
};

/** Tailwind classes for the status dot, from AgentPrism's status tokens. */
export const STATUS_DOT: Record<SessionStatus, string> = {
  working: 'bg-agentprism-pending',
  waiting: 'bg-agentprism-warning',
  idle: 'bg-agentprism-success',
  aborted: 'bg-agentprism-warning',
  failed: 'bg-agentprism-error',
  stale: 'bg-agentprism-border-strong',
  empty: 'bg-agentprism-border-strong',
};

export const STATUS_ORDER: SessionStatus[] = ['working', 'waiting', 'failed', 'aborted', 'stale', 'idle', 'empty'];

export function cut(s: string | undefined, n: number): string {
  if (!s) return '';
  const flat = s.replace(/\s+/g, ' ').trim();
  return flat.length <= n ? flat : flat.slice(0, n - 1) + '…';
}

export function ago(iso: string | undefined, now = Date.now()): string {
  if (!iso) return '';
  const ms = now - Date.parse(iso);
  if (!Number.isFinite(ms)) return '';
  const min = Math.round(ms / 60000);
  if (min < 1) return '刚刚';
  if (min < 60) return min + ' 分钟前';
  const h = Math.round(min / 60);
  if (h < 24) return h + ' 小时前';
  const d = Math.round(h / 24);
  if (d < 31) return d + ' 天前';
  return iso.slice(0, 10);
}

export function when(iso: string | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
}

export function tokens(n: number | undefined): string {
  if (n === undefined) return '';
  if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'k';
  return String(n);
}

export function duration(ms: number | undefined): string {
  if (ms === undefined) return '';
  if (ms < 1000) return ms + ' 毫秒';
  const s = Math.round(ms / 1000);
  if (s < 60) return s + ' 秒';
  const m = Math.floor(s / 60);
  if (m < 60) return m + ' 分 ' + (s % 60) + ' 秒';
  return Math.floor(m / 60) + ' 小时 ' + (m % 60) + ' 分';
}

export function usageLine(u: Usage | undefined): string {
  if (!u) return '';
  const parts = [];
  if (u.input !== undefined) parts.push('输入 ' + tokens(u.input) + (u.cachedInput ? '（缓存 ' + tokens(u.cachedInput) + '）' : ''));
  if (u.output !== undefined) parts.push('输出 ' + tokens(u.output) + (u.reasoning ? '（推理 ' + tokens(u.reasoning) + '）' : ''));
  return parts.join('，');
}

export function basename(p: string | undefined): string {
  if (!p) return '';
  const parts = p.split(/[\\/]/).filter(Boolean);
  return parts[parts.length - 1] || p;
}

export const KIND_LABEL: Record<string, string> = { codex: 'Codex', 'claude-code': 'Claude', opencode: 'OpenCode' };

/** Display name for a source kind; unknown future kinds degrade to their id, not "undefined". */
export function kindLabel(kind: string): string {
  return KIND_LABEL[kind] || kind;
}

export function usd(n: number | undefined): string {
  if (n === undefined) return '';
  return '$' + (n >= 100 ? n.toFixed(0) : n >= 1 ? n.toFixed(2) : n.toFixed(3));
}
