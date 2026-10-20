/**
 * Quota as each product reports it, for the page (a quota bar where work is handed out) and for dispatch (a product
 * nearly out of quota is passed over, and one that is out takes no work until its bucket resets).
 * User 10-20, on Antigravity's View Usage panel: “这种面板可以打通吗”; then “两件一起做：你把额度从中心做通到网页和派活”;
 * then “agy现在的额度也不多了，尝试调度调度”.
 *
 * Read in the background, at most every five minutes, never on a request's path: finding Antigravity's language server
 * takes a PowerShell call, and the center's main thread must not wait on it (10-20 a blocked main thread hung 8899).
 * - Antigravity: its language server's RetrieveUserQuotaSummary, the same numbers as the panel (blackboard 2431).
 *   Turns the center sends go through agentapi, which only takes Gemini models, so only the Gemini group limits them.
 * - Codex: the newest rate_limits Codex wrote into a session log (5-hour and weekly windows), with when it was written.
 *   Its workspace credits are not in there: 10-20 Codex read 97% weekly and still failed “out of credits”.
 * - Claude: the yinzi relay's wallet, when Claude Code's settings point there (claudeQuota).
 * Every other product only has what its failures said (capacity.ts quota cooldowns), shown with the snapshot.
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import type { AgentGatewayHub } from '../gateway.ts';
import { HOME } from './common.ts';
import { CHANNEL_PROFILES } from './products.ts';
import type { ChannelId } from './types.ts';

const exec = promisify(execFile);

export type QuotaBucket = { window: string; label: string; remaining: number; resetAt?: string };
export type QuotaGroup = { name: string; models?: string; usedByCenter: boolean; buckets: QuotaBucket[] };
export type ProductQuota = { channel: string; ok: boolean; source: string; observedAt: string; plan?: string; groups: QuotaGroup[]; error?: string };

/** Below the reserve an automatic pick goes to another product; below the floor the product takes no work until the
 *  bucket resets. Named work still goes above the floor: the person or the lead chose it. */
export const QUOTA_RESERVE = 0.2;
export const QUOTA_FLOOR = 0.03;
const REFRESH_MS = 5 * 60_000;

type QuotaState = { at: number; products: Record<string, ProductQuota>; refreshing?: Promise<void> };
const states = new WeakMap<AgentGatewayHub, QuotaState>();
const stateOf = (hub: AgentGatewayHub) => states.get(hub) || states.set(hub, { at: 0, products: {} }).get(hub)!;

const pct = (x: number) => `${Math.round(x * 100)}%`;
const clock = (iso?: string) => (iso ? new Date(iso).toLocaleString('zh-CN', { hour12: false, month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '');

async function antigravityQuota(): Promise<ProductQuota> {
  const base = { channel: 'antigravity', source: '语言服务 RetrieveUserQuotaSummary', observedAt: new Date().toISOString(), groups: [] as QuotaGroup[] };
  const ps =
    `$p = Get-CimInstance Win32_Process -Filter "Name LIKE 'language_server%.exe'" | Select-Object -First 1; ` +
    `if ($p -and $p.CommandLine -match '--csrf_token\\s+([a-f0-9-]+)') { $c = $matches[1]; ` +
    `(Get-NetTCPConnection -OwningProcess $p.ProcessId -State Listen -ErrorAction SilentlyContinue).LocalPort | ForEach-Object { "$c|$_" } }`;
  let stdout = '';
  try {
    stdout = (await exec('powershell.exe', ['-NoProfile', '-Command', ps], { timeout: 20_000, windowsHide: true })).stdout;
  } catch (e: any) {
    return { ...base, ok: false, error: '找不到语言服务：' + String(e?.message || e).slice(0, 120) };
  }
  const ports = stdout.split(/\r?\n/).map((l) => l.trim().split('|')).filter((x) => x.length === 2);
  if (!ports.length) return { ...base, ok: false, error: '语言服务没在跑（Antigravity 没开）' };
  // It listens on an HTTPS port and a plain one in no fixed order; the plain one answers Connect-RPC.
  for (const [csrf, port] of ports) {
    try {
      const r = await fetch(`http://127.0.0.1:${port}/exa.language_server_pb.LanguageServerService/RetrieveUserQuotaSummary`, {
        method: 'POST',
        headers: { 'x-codeium-csrf-token': csrf, 'Connect-Protocol-Version': '1', 'Content-Type': 'application/json' },
        body: '{}',
        signal: AbortSignal.timeout(8000),
      });
      if (!r.ok) continue;
      const j: any = await r.json();
      const groups: QuotaGroup[] = (j?.response?.groups || []).map((g: any) => ({
        name: String(g.displayName || ''),
        models: String(g.description || '').replace(/^Models within this group:\s*/i, ''),
        usedByCenter: /gemini/i.test(String(g.displayName || '')),
        buckets: (g.buckets || []).map((b: any) => ({ window: String(b.window || ''), label: b.window === 'weekly' ? '每周' : b.window === '5h' ? '5 小时' : String(b.displayName || b.window || ''), remaining: Number(b.remainingFraction ?? 0), resetAt: b.resetTime })),
      }));
      return { ...base, ok: true, groups };
    } catch {}
  }
  return { ...base, ok: false, error: '语言服务的端口都没有回额度' };
}

async function codexQuota(): Promise<ProductQuota> {
  const base = { channel: 'codex', source: 'Codex 会话记录里最新的 rate_limits', observedAt: '', groups: [] as QuotaGroup[] };
  const root = join(HOME, '.codex', 'sessions');
  const newest = async (dir: string) => {
    try {
      return (await readdir(dir)).sort().reverse().map((n) => join(dir, n));
    } catch {
      return [];
    }
  };
  let days = 0;
  for (const y of await newest(root)) for (const m of await newest(y)) for (const d of await newest(m)) {
    if (++days > 3) break;
    const files = await Promise.all((await newest(d)).filter((f) => f.endsWith('.jsonl')).map(async (f) => ({ f, t: (await stat(f)).mtimeMs })));
    for (const { f } of files.sort((a, b) => b.t - a.t).slice(0, 3)) {
      const lines = (await readFile(f, 'utf8')).trimEnd().split(/\r?\n/).reverse();
      for (const line of lines) {
        if (!line.includes('"rate_limits"')) continue;
        let o: any;
        try {
          o = JSON.parse(line);
        } catch {
          continue;
        }
        const rl = o?.payload?.rate_limits;
        if (!rl?.primary) continue;
        const bucket = (w: any, fallback: string): QuotaBucket => {
          const minutes = Number(w.window_minutes || 0);
          const window = minutes >= 10_000 ? 'weekly' : minutes ? `${Math.round(minutes / 60)}h` : fallback;
          return { window, label: window === 'weekly' ? '每周' : window === '5h' ? '5 小时' : window, remaining: Math.max(0, 1 - Number(w.used_percent || 0) / 100), resetAt: w.resets_at ? new Date(Number(w.resets_at) * 1000).toISOString() : undefined };
        };
        const buckets = [bucket(rl.primary, '5h'), ...(rl.secondary ? [bucket(rl.secondary, 'weekly')] : [])];
        return { ...base, ok: true, observedAt: String(o.timestamp || new Date((await stat(f)).mtimeMs).toISOString()), plan: rl.plan_type, groups: [{ name: 'Codex', usedByCenter: true, buckets }] };
      }
    }
  }
  return { ...base, ok: false, observedAt: new Date().toISOString(), error: '会话记录里没有 rate_limits' };
}

/**
 * Claude's turns go wherever Claude Code's own settings point. When that is the yinzi relay, its wallet is Claude's
 * quota: 10-20 night every Claude turn failed “insufficient wallet quota” at ¥0.29. A balance is not a fraction, so it
 * is mapped onto the policy: under ¥1 counts as used up (the floor), under ¥5 as low (the reserve).
 * The relay's access token is read from channels/_private/sites.local.json, used for this one call, never kept or shown.
 */
async function claudeQuota(): Promise<ProductQuota | null> {
  const base = { channel: 'claude', source: '银子中转钱包余额（Claude Code 设置指向它）', observedAt: new Date().toISOString(), groups: [] as QuotaGroup[] };
  let host = '';
  try {
    host = String(JSON.parse(await readFile(join(HOME, '.claude', 'settings.json'), 'utf8'))?.env?.ANTHROPIC_BASE_URL || '');
  } catch {}
  if (!/yinziapi/i.test(host)) return null;
  try {
    const vault = JSON.parse(await readFile(join(HOME_REPO(), 'channels', '_private', 'sites.local.json'), 'utf8'));
    const yz = vault?.yinziapi;
    if (!yz?.access_token || !yz.base_url) return { ...base, ok: false, error: '私密配置里没有银子的账号' };
    // curl, not fetch: the relay is reached through the user's proxy (HTTPS_PROXY), which curl honours and fetch does not.
    const { stdout } = await exec('curl.exe', ['-s', '--max-time', '10', '-H', `Authorization: Bearer ${yz.access_token}`, '-H', `New-Api-User: ${yz.user_id || '21'}`, `${yz.base_url}/api/user/self`], { timeout: 15_000, windowsHide: true });
    const u = (JSON.parse(stdout || '{}') as any)?.data;
    if (!u) return { ...base, ok: false, error: '余额接口没回数据' };
    const yuan = Number(u.quota || 0) / (yz.quota_per_unit || 500000);
    const remaining = yuan < 1 ? 0 : yuan < 5 ? 0.1 : 1;
    return { ...base, ok: true, groups: [{ name: '银子中转', usedByCenter: true, buckets: [{ window: 'balance', label: `余额 ¥${yuan.toFixed(2)}`, remaining }] }] };
  } catch (e: any) {
    return { ...base, ok: false, error: String(e?.message || e).slice(0, 120) };
  }
}
const HOME_REPO = () => join(import.meta.dirname, '..', '..', '..', '..', '..');

export const quotaMethods = {
  /** Read every product that can say its quota; at most one refresh at a time. */
  async refreshQuota(this: AgentGatewayHub): Promise<void> {
    const s = stateOf(this);
    if (s.refreshing) return s.refreshing;
    s.refreshing = (async () => {
      const read = await Promise.all([antigravityQuota(), codexQuota(), claudeQuota()].map((p) => p.catch((e) => ({ channel: '?', ok: false, source: '', observedAt: new Date().toISOString(), groups: [], error: String(e) }) as ProductQuota)));
      for (const q of read) if (q && q.channel !== '?') s.products[q.channel] = q;
      s.at = Date.now();
      this.broadcast('quota', this.quotaSnapshot());
    })().finally(() => {
      s.refreshing = undefined;
    });
    return s.refreshing;
  },

  /** The last reading, plus what failures said (quota cooldowns); starts a refresh in the background when stale. */
  quotaSnapshot(this: AgentGatewayHub) {
    const s = stateOf(this);
    if (Date.now() - s.at > REFRESH_MS && !s.refreshing) void this.refreshQuota().catch(() => {});
    const products: Record<string, ProductQuota & { cooldown?: { until: string; why: string }; tightest?: ReturnType<typeof tightestOf> }> = {};
    for (const id of Object.keys(CHANNEL_PROFILES)) {
      const l = this.channelLoad(id, false);
      const q = s.products[id];
      if (!q && !l.accountCooling) continue;
      products[id] = { ...(q || { channel: id, ok: false, source: '失败时记下的', observedAt: '', groups: [] }), tightest: q ? tightestOf(q) : undefined, ...(l.accountCooling ? { cooldown: { until: l.accountUntil!, why: l.accountWhy! } } : {}) };
    }
    return { at: s.at ? new Date(s.at).toISOString() : null, reserve: QUOTA_RESERVE, floor: QUOTA_FLOOR, products };
  },

  /** Why this product takes no work now because a bucket its center turns draw from is under the floor; else null. */
  quotaHold(this: AgentGatewayHub, id: string): string | null {
    const t = this.quotaTightest(id);
    if (!t || t.remaining >= QUOTA_FLOOR) return null;
    return `${CHANNEL_PROFILES[id as ChannelId]?.label || id}：${spent(t)}`;
  },

  /** Why an automatic pick should go elsewhere: under the reserve; else null. */
  quotaLow(this: AgentGatewayHub, id: string): string | null {
    const t = this.quotaTightest(id);
    if (!t || t.remaining >= QUOTA_RESERVE) return null;
    return `${CHANNEL_PROFILES[id as ChannelId]?.label || id}：${spent(t)}，先给别家`;
  },

  quotaTightest(this: AgentGatewayHub, id: string) {
    const q = this.quotaSnapshot().products[id];
    return q ? q.tightest : undefined;
  },
};

/** How a nearly spent bucket reads: a window resets at a time, a balance comes back when it is topped up. */
export function spent(t: QuotaBucket & { group: string }) {
  return t.window === 'balance' ? `${t.group}${t.label}，不够用了，充值后恢复` : `${t.group} ${t.label}额度只剩 ${pct(t.remaining)}，${clock(t.resetAt)} 重置`;
}

/** The tightest bucket among the groups the center's turns draw from; a bucket past its reset time counts as full. */
export function tightestOf(q: ProductQuota) {
  let best: (QuotaBucket & { group: string }) | undefined;
  for (const g of q.groups) {
    if (!g.usedByCenter) continue;
    for (const b of g.buckets) {
      if (b.resetAt && Date.parse(b.resetAt) < Date.now()) continue;
      if (!best || b.remaining < best.remaining) best = { ...b, group: g.name };
    }
  }
  return best;
}
