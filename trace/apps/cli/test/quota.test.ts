import { test } from 'node:test';
import assert from 'node:assert/strict';
import { quotaMethods, tightestOf, QUOTA_FLOOR, QUOTA_RESERVE, type ProductQuota } from '../src/gateway/quota.ts';

const later = new Date(Date.now() + 3 * 86400_000).toISOString();
const earlier = new Date(Date.now() - 3600_000).toISOString();

const agy = (geminiWeekly: number): ProductQuota => ({
  channel: 'antigravity',
  ok: true,
  source: 'test',
  observedAt: new Date().toISOString(),
  groups: [
    { name: 'Gemini Models', usedByCenter: true, buckets: [{ window: 'weekly', label: '每周', remaining: geminiWeekly, resetAt: later }, { window: '5h', label: '5 小时', remaining: 0.98, resetAt: later }] },
    { name: 'Claude and GPT models', usedByCenter: false, buckets: [{ window: 'weekly', label: '每周', remaining: 0.01, resetAt: later }] },
  ],
});

/** A hub whose snapshot is fixed, so the policy can be read without reading any product. */
const hubWith = (q: ProductQuota) => {
  const hub: any = { quotaTightest: quotaMethods.quotaTightest, quotaSnapshot: () => ({ products: { [q.channel]: { ...q, tightest: tightestOf(q) } } }) };
  return { hold: () => quotaMethods.quotaHold.call(hub, q.channel), low: () => quotaMethods.quotaLow.call(hub, q.channel) };
};

test('only the groups the center draws from count: a spent Claude group does not hold Antigravity', () => {
  const t = tightestOf(agy(0.9))!;
  assert.equal(t.group, 'Gemini Models');
  assert.equal(t.remaining, 0.9);
  assert.equal(hubWith(agy(0.9)).hold(), null);
  assert.equal(hubWith(agy(0.9)).low(), null);
});

test('under the reserve automatic picks go elsewhere; under the floor the product takes no work', () => {
  const low = hubWith(agy(0.17));
  assert.equal(low.hold(), null);
  assert.match(low.low()!, /每周额度只剩 17%.*先给别家/);
  const out = hubWith(agy(QUOTA_FLOOR / 2));
  assert.match(out.hold()!, /Gemini Models 每周额度只剩 2%/);
  assert.ok(QUOTA_FLOOR < QUOTA_RESERVE);
});

test('a bucket past its reset time counts as full', () => {
  const q = agy(0.01);
  q.groups[0].buckets[0].resetAt = earlier;
  assert.equal(tightestOf(q)!.window, '5h');
  assert.equal(hubWith(q).hold(), null);
});

test('a relay balance reads as a balance, not as a window with a reset time', () => {
  const claude: ProductQuota = { channel: 'claude', ok: true, source: 'test', observedAt: '', groups: [{ name: '银子中转', usedByCenter: true, buckets: [{ window: 'balance', label: '余额 ¥0.30', remaining: 0 }] }] };
  assert.match(hubWith(claude).hold()!, /银子中转余额 ¥0\.30，不够用了，充值后恢复/);
});
