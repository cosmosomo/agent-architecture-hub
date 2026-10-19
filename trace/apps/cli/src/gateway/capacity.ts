/**
 * The center choosing who gets a piece of work: each product's load against its limit (maxConcurrent in the product
 * table) and its health (the circuit breaker in channelFailures: three failed turns in a row open it), and the pick
 * among candidates. Mixed into AgentGatewayHub (gateway.ts); `this` is the hub.
 */
import type { AgentGatewayHub } from '../gateway.ts';
import type { ChannelId } from './types.ts';
import { CHANNEL_PROFILES } from './products.ts';

/** An open breaker keeps a product out of the pick this long; after that one turn may probe it again. */
const COOLDOWN_MS = 120_000;

export const capacityMethods = {
  /** One product as the pick sees it: turns running now, its limit, its breaker. */
  channelLoad(this: AgentGatewayHub, id: string) {
    const prof = CHANNEL_PROFILES[id as ChannelId];
    const running = [...this.activeRuns.values()].filter((r) => r.channel === id && r.status === 'running').length;
    const h = this.channelFailures.get(id as ChannelId);
    const cooling = Boolean(h && h.state === 'open' && h.openedAt && Date.now() - Date.parse(h.openedAt) < COOLDOWN_MS);
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
    };
  },

  /**
   * Pick a product for a piece of work among candidates (all driven products when none are given), leaving out
   * `exclude`: not driven or cannot take a turn, breaker cooling down, or full. Of the rest, the least loaded (running
   * against its limit), ties in the candidates' order. Says why, including why the others were left out.
   */
  pickChannel(this: AgentGatewayHub, candidates?: string[], exclude: string[] = []) {
    const pool = (candidates && candidates.length ? candidates : Object.keys(CHANNEL_PROFILES)).filter((c) => !exclude.includes(c));
    const loads = pool.map((c) => this.channelLoad(c));
    const left: string[] = [];
    const ok = loads.filter((l) => {
      if (!l.driven) left.push(`${l.label}：后端不驱动`);
      else if (!l.canSend) left.push(`${l.label}：后端不能发话`);
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
