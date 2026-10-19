import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// The account cooldown file goes to a temp folder, not the real ~/.agent-hub.
process.env.HUB_DATA_DIR = mkdtempSync(join(tmpdir(), 'hub-capacity-'));
const { capacityMethods, loadQuotaCooldowns, quotaResetAt } = await import('../src/gateway/capacity.ts');
const { isQuotaError } = await import('../src/gateway/failure.ts');
const { CHANNEL_PROFILES } = await import('../src/gateway/products.ts');

const NOW = Date.parse('2026-10-19T02:44:40+08:00');

test('quota errors are recognised, other failures are not', () => {
  assert.ok(isQuotaError('ZCode turn failed: 1308 [1308][已达到 5 小时的使用上限。您的限额将在 2026-10-19 06:02:11 重置。]'));
  assert.ok(isQuotaError('Quota exceeded: 429 您的账户已达到速率限制，请您控制请求频率'));
  assert.ok(isQuotaError('Rate limit reached for requests'));
  assert.ok(!isQuotaError('这一轮超过 3600 秒没结束，已叫停'));
  assert.ok(!isQuotaError('API Error: Connection dropped (ECONNRESET)'));
});

test('the reset time is read in the account timezone when the text has none', () => {
  const t = quotaResetAt('已达到 5 小时的使用上限。您的限额将在 2026-10-19 06:02:11 重置。', '+08:00', NOW);
  assert.equal(t, Date.parse('2026-10-19T06:02:11+08:00'));
});

test('reset times in other shapes', () => {
  assert.equal(quotaResetAt('limit resets at 2026-10-19T00:00:00Z', '+08:00', NOW), Date.parse('2026-10-19T00:00:00Z'));
  assert.equal(quotaResetAt('429 Too Many Requests, retry-after: 30', undefined, NOW), NOW + 30_000);
  assert.equal(quotaResetAt('Rate limited. Please try again in 5m.', undefined, NOW), NOW + 300_000);
});

test('no reset time, a past one, or a date that is not the reset gives null', () => {
  assert.equal(quotaResetAt('Quota exceeded: 429 您的账户已达到速率限制', '+08:00', NOW), null);
  assert.equal(quotaResetAt('您的限额将在 2026-10-18 06:02:11 重置', '+08:00', NOW), null);
  assert.equal(quotaResetAt('started 2026-10-19 09:00:00, quota exceeded', '+08:00', NOW), null);
});

/** Just the parts of the hub the capacity block touches. */
function fakeHub() {
  const hub: any = { activeRuns: new Map(), channelFailures: new Map(), quotaCooldowns: new Map() };
  for (const [k, f] of Object.entries(capacityMethods)) hub[k] = f;
  return hub;
}
const run = (status: string, error?: string) => ({ status, error }) as any;

test('one product hitting the account limit keeps every product on that account out of the pick until the reset', () => {
  const hub = fakeHub();
  const zcode = CHANNEL_PROFILES.zcode;
  assert.equal(zcode.quotaAccount, 'zhipu-coding-plan');
  const reset = new Date(Date.now() + 3 * 3600_000);
  const pad = (n: number) => String(n).padStart(2, '0');
  // The account's timezone in the table is +08:00; write the reset in UTC+8 the way Zhipu does.
  const bj = new Date(reset.getTime() + 8 * 3600_000);
  const bjText = `${bj.getUTCFullYear()}-${pad(bj.getUTCMonth() + 1)}-${pad(bj.getUTCDate())} ${pad(bj.getUTCHours())}:${pad(bj.getUTCMinutes())}:00`;
  hub.recordTurnHealth(zcode, run('failed', `1308 已达到 5 小时的使用上限。您的限额将在 ${bjText} 重置。`));

  const pick = hub.pickChannel(['workbuddy', 'hermes', 'opencode', 'codex']);
  assert.equal(pick.channel, 'codex', pick.why);
  assert.match(pick.why, /WorkBuddy：额度账号 智谱 Coding Plan 用完/);
  assert.match(pick.why, /ZCode 报的/);
  const cd = hub.quotaCooldowns.get('zhipu-coding-plan');
  assert.equal(Math.round(cd.until / 60_000), Math.round(Date.parse(bjText.replace(' ', 'T') + '+08:00') / 60_000));

  // Kept on disk: a restarted center still knows.
  assert.ok(loadQuotaCooldowns().has('zhipu-coding-plan'));

  // A completed turn on the account clears it.
  hub.recordTurnHealth(CHANNEL_PROFILES.opencode, run('completed'));
  assert.equal(hub.pickChannel(['workbuddy', 'codex']).channel, 'workbuddy');
  assert.ok(!loadQuotaCooldowns().has('zhipu-coding-plan'));
});

test('a quota failure without a reset time cools the account for the short cooldown; products on other accounts are untouched', () => {
  const hub = fakeHub();
  hub.recordTurnHealth(CHANNEL_PROFILES.workbuddy, run('failed', 'Quota exceeded: 429 您的账户已达到速率限制'));
  const cd = hub.quotaCooldowns.get('zhipu-coding-plan');
  assert.ok(cd.until - Date.now() <= 120_000 && cd.until > Date.now());
  assert.equal(hub.pickChannel(['hermes', 'claude']).channel, 'claude');
  hub.recordTurnHealth(CHANNEL_PROFILES.codex, run('failed', 'Quota exceeded'));
  assert.equal(CHANNEL_PROFILES.codex.quotaAccount, undefined);
  assert.equal(hub.quotaCooldowns.size, 1);
});
