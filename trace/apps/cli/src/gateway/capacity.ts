/**
 * The center choosing who gets a piece of work: each product's load against its limit (maxConcurrent in the product
 * table), its health (the circuit breaker in channelFailures), the quota account it shares with other products
 * (quotaAccount: one product hitting the account's limit stops them all until the reset time the provider gave),
 * and the pick among candidates. Mixed into AgentGatewayHub (gateway.ts); `this` is the hub.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { AgentGatewayHub } from '../gateway.ts';
import type { ActiveRun, ChannelId, ChannelProfile } from './types.ts';
import { CHANNEL_PROFILES, QUOTA_ACCOUNTS } from './products.ts';
import { HOME } from './common.ts';

/** An open breaker keeps a product out of the pick this long; after that one turn may probe it again. */
const COOLDOWN_MS = 120_000;
/** A reset time further out than this is not believed (a misread date). */
const MAX_RESET_MS = 7 * 24 * 3600_000;

export type QuotaCooldown = { until: number; reason: string; from: string; at: string };

/** A failure that says the account's quota or rate is used up: another try only hits the same wall. */
export function isQuotaError(text: string): boolean {
  return /\b429\b|\b1308\b|quota|rate.?limit|usage limit|速率限制|额度|配额|使用上限|用量上限/i.test(text);
}

/**
 * When the provider says the quota comes back, as epoch ms, or null when the text does not say. Understands a date
 * and time next to "重置 / reset / 恢复" (in `tz` when it has no offset: Zhipu writes Beijing time, e.g. "您的限额将在
 * 2026-10-19 06:02:11 重置"), and "retry after N" / "try again in N s|m|h". Only a time ahead of `now` and within a week.
 */
export function quotaResetAt(text: string, tz = '+00:00', now = Date.now()): number | null {
  const ok = (t: number) => (Number.isFinite(t) && t > now && t - now < MAX_RESET_MS ? t : null);
  const date = '(\\d{4}-\\d{2}-\\d{2})[ T](\\d{2}:\\d{2}(?::\\d{2})?)(?:\\.\\d+)?(Z|[+-]\\d{2}:?\\d{2})?';
  const m =
    new RegExp(date + '[^。\\n]{0,12}?(?:重置|恢复|reset)', 'i').exec(text) ||
    new RegExp('(?:重置|恢复|reset)[^\\d\\n]{0,24}' + date, 'i').exec(text);
  if (m) {
    const off = m[3] ? (m[3] === 'Z' ? 'Z' : m[3].replace(/^([+-]\d{2})(\d{2})$/, '$1:$2')) : tz;
    const t = ok(Date.parse(`${m[1]}T${m[2].length === 5 ? m[2] + ':00' : m[2]}${off}`));
    if (t) return t;
  }
  const r = /retry[- ]after\D{0,4}(\d+)/i.exec(text);
  if (r) return ok(now + Number(r[1]) * 1000);
  const a = /try again in (\d+)\s*(s|sec|seconds?|m|min|minutes?|h|hours?)\b/i.exec(text);
  if (a) return ok(now + Number(a[1]) * ({ s: 1000, m: 60_000, h: 3600_000 } as Record<string, number>)[a[2][0].toLowerCase()]);
  return null;
}

/** Account cooldowns survive a restart: the reset is usually hours away. HUB_DATA_DIR moves the file (side instance). */
function cooldownFile() {
  return join(process.env.HUB_DATA_DIR || join(HOME, '.agent-hub'), 'quota-cooldowns.json');
}

export function loadQuotaCooldowns(): Map<string, QuotaCooldown> {
  try {
    const raw = JSON.parse(readFileSync(cooldownFile(), 'utf8')) as Record<string, QuotaCooldown>;
    return new Map(Object.entries(raw).filter(([, c]) => c && c.until > Date.now()));
  } catch {
    return new Map();
  }
}

const clock = (t: number) => {
  const d = new Date(t);
  const sameDay = d.toDateString() === new Date().toDateString();
  return (sameDay ? '' : `${d.getMonth() + 1}-${d.getDate()} `) + d.toTimeString().slice(0, 5);
};

export const capacityMethods = {
  /**
   * After every turn: the product's breaker (three failures in a row open it; a quota failure opens it at once; each
   * failure while open restarts the cooldown) and, for a quota failure, its account's cooldown until the reset time.
   * A turn that completes clears both: the quota is evidently back.
   */
  recordTurnHealth(this: AgentGatewayHub, prof: ChannelProfile, run: ActiveRun) {
    const h = this.channelFailures.get(prof.id) || {
      started: 1,
      delivered: 0,
      failed: 0,
      consecutiveFailures: 0,
      state: 'closed' as const,
      lastAt: Date.now(),
    };
    h.lastAt = Date.now();
    if (run.status === 'completed' && !run.error) {
      h.delivered += 1;
      h.consecutiveFailures = 0;
      h.state = 'closed';
      h.openedAt = undefined;
      if (prof.quotaAccount && this.quotaCooldowns.delete(prof.quotaAccount)) this.saveQuotaCooldowns();
    } else if (run.status === 'failed') {
      h.failed += 1;
      h.consecutiveFailures += 1;
      h.lastError = run.error || '执行异常退出';
      const quota = isQuotaError(h.lastError);
      if (quota || h.consecutiveFailures >= 3) {
        h.state = 'open';
        h.openedAt = new Date().toISOString();
      }
      if (quota && prof.quotaAccount) {
        const tz = QUOTA_ACCOUNTS[prof.quotaAccount]?.resetTimezone;
        const until = quotaResetAt(h.lastError, tz) ?? Date.now() + COOLDOWN_MS;
        this.quotaCooldowns.set(prof.quotaAccount, { until, reason: h.lastError.slice(0, 200), from: prof.id, at: new Date().toISOString() });
        this.saveQuotaCooldowns();
      }
    }
    this.channelFailures.set(prof.id, h);
  },

  saveQuotaCooldowns(this: AgentGatewayHub) {
    try {
      mkdirSync(join(cooldownFile(), '..'), { recursive: true });
      writeFileSync(cooldownFile(), JSON.stringify(Object.fromEntries(this.quotaCooldowns), null, 2), 'utf8');
    } catch {}
  },

  /** One product as the pick sees it: turns running now, its limit, its breaker, its account's cooldown. */
  channelLoad(this: AgentGatewayHub, id: string) {
    const prof = CHANNEL_PROFILES[id as ChannelId];
    const running = [...this.activeRuns.values()].filter((r) => r.channel === id && r.status === 'running').length;
    const h = this.channelFailures.get(id as ChannelId);
    const cooling = Boolean(h && h.state === 'open' && h.openedAt && Date.now() - Date.parse(h.openedAt) < COOLDOWN_MS);
    const account = prof?.quotaAccount;
    const ac = account ? this.quotaCooldowns.get(account) : undefined;
    const accountCooling = Boolean(ac && ac.until > Date.now());
    return {
      id,
      label: prof?.label || id,
      driven: Boolean(prof),
      canSend: Boolean(prof?.capabilities.canSendPrompt),
      running,
      cap: prof?.maxConcurrent || 3,
      health: (h?.state || 'closed') as 'closed' | 'open' | 'probing',
      cooling,
      lastError: h?.lastError,
      account,
      accountCooling,
      accountUntil: accountCooling ? new Date(ac!.until).toISOString() : undefined,
      accountWhy: accountCooling
        ? `额度账号 ${QUOTA_ACCOUNTS[account!]?.label || account} 用完，${clock(ac!.until)} 恢复（${CHANNEL_PROFILES[ac!.from as ChannelId]?.label || ac!.from} 报的）`
        : undefined,
    };
  },

  /**
   * Pick a product for a piece of work among candidates (all driven products when none are given), leaving out
   * `exclude`: not driven or cannot take a turn, its quota account used up, breaker cooling down, or full. Of the
   * rest, the least loaded (running against its limit), ties in the candidates' order. Says why, including why the
   * others were left out.
   */
  pickChannel(this: AgentGatewayHub, candidates?: string[], exclude: string[] = []) {
    const pool = (candidates && candidates.length ? candidates : Object.keys(CHANNEL_PROFILES)).filter((c) => !exclude.includes(c));
    const loads = pool.map((c) => this.channelLoad(c));
    const left: string[] = [];
    const ok = loads.filter((l) => {
      if (!l.driven) left.push(`${l.label}：后端不驱动`);
      else if (!l.canSend) left.push(`${l.label}：后端不能发话`);
      else if (l.accountCooling) left.push(`${l.label}：${l.accountWhy}`);
      else if (l.cooling) left.push(`${l.label}：熔断冷却中${l.lastError ? `（${String(l.lastError).slice(0, 60)}）` : ''}`);
      else if (l.running >= l.cap) left.push(`${l.label}：在跑 ${l.running}/${l.cap} 已满`);
      else return true;
      return false;
    });
    if (exclude.length) left.push(`排除：${exclude.join('、')}`);
    if (!ok.length) return { channel: null as string | null, why: left.join('；') || '没有候选', loads };
    ok.sort((a, b) => a.running / a.cap - b.running / b.cap || pool.indexOf(a.id) - pool.indexOf(b.id));
    const p = ok[0];
    const state = p.health === 'closed' ? '健康' : '熔断后试探一轮';
    return { channel: p.id as string | null, why: `${p.label}：${state}，在跑 ${p.running}/${p.cap}${left.length ? `；没选：${left.join('；')}` : ''}`, loads };
  },
};
