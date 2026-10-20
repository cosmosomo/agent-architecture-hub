import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// The account cooldown file goes to a temp folder, not the real ~/.agent-hub.
process.env.HUB_DATA_DIR = mkdtempSync(join(tmpdir(), 'hub-capacity-'));
const { loadQuotaCooldowns, quotaResetAt } = await import('../src/gateway/capacity.ts');
const { isQuotaError } = await import('../src/gateway/failure.ts');
const { CHANNEL_PROFILES } = await import('../src/gateway/products.ts');
const { AgentGatewayHub } = await import('../src/gateway.ts');
const { SessionStore } = await import('../src/store.ts');
const { claudeCodeAdapter } = await import('@hub-trace/adapters');

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

const hubDirs: string[] = [];
after(() => { for (const dir of hubDirs) rmSync(dir, { recursive: true, force: true }); });
/** Real hub and store, with native source directories isolated from the user's running products. */
function testHub(store?: InstanceType<typeof SessionStore>) {
  const dir = mkdtempSync(join(tmpdir(), 'hub-capacity-state-'));
  hubDirs.push(dir);
  const hub = new AgentGatewayHub(dir, store || new SessionStore({ roots: [], cacheFile: join(dir, 'index.json') }));
  Object.assign(hub, { acpxDir: join(dir, 'acpx'), agyBrainDir: join(dir, 'brain'), agyMapFile: join(dir, 'agy-map.json'), wbDir: join(dir, 'workbuddy'), hermesDir: join(dir, 'hermes') });
  return hub;
}
const run = (status: string, error?: string) => ({ status, error }) as any;

test('eleven external Claude sessions do not block named work or exclude its only automatic candidate', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'hub-capacity-external-'));
  const sources = join(dir, '.claude', 'projects', 'test');
  mkdirSync(sources, { recursive: true });
  const now = new Date().toISOString();
  for (let i = 0; i < 11; i++) {
    const sessionId = `external-${i}`;
    const rows = [
      { type: 'user', uuid: 'u', sessionId, timestamp: now, message: { role: 'user', content: '读取文档' } },
      { type: 'assistant', uuid: 'a', sessionId, timestamp: now, message: { role: 'assistant', content: [{ type: 'tool_use', id: 'read', name: 'Read', input: { file_path: '/code/doc.md' } }] } },
    ];
    writeFileSync(join(sources, sessionId + '.jsonl'), rows.map((r) => JSON.stringify(r)).join('\n'));
  }
  const store = new SessionStore({ roots: [{ adapter: claudeCodeAdapter, dir: sources }], cacheFile: join(dir, 'cache', 'index.json') });
  try {
    await store.scan();
    const hub = testHub(store);
    const load = hub.channelLoad('claude');
    assert.equal(load.outside, 11);
    assert.equal(load.ours, 0);
    assert.equal(hub.holdFor('claude'), null);
    assert.equal(hub.pickChannel(['claude']).channel, 'claude');
    const cap = CHANNEL_PROFILES.claude.maxConcurrent;
    for (let i = 0; i < cap; i++) hub.activeRuns.set(`claude:test-${i}`, { ...run('running'), channel: 'claude' });
    assert.match(hub.holdFor('claude')!, new RegExp(`${cap}/${cap} 已满`));
    assert.equal(hub.pickChannel(['claude']).channel, null);
    assert.equal(hub.channelLoad('claude').outside, load.outside);
  } finally {
    await store.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test('one product hitting the account limit keeps every product on that account out of the pick until the reset', () => {
  const hub = testHub();
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
  assert.ok(cd);
  assert.equal(Math.round(cd.until / 60_000), Math.round(Date.parse(bjText.replace(' ', 'T') + '+08:00') / 60_000));

  // Kept on disk: a restarted center still knows.
  assert.ok(loadQuotaCooldowns().has('zhipu-coding-plan'));

  // A completed turn on the account clears it.
  hub.recordTurnHealth(CHANNEL_PROFILES.opencode, run('completed'));
  assert.equal(hub.pickChannel(['workbuddy', 'codex']).channel, 'workbuddy');
  assert.ok(!loadQuotaCooldowns().has('zhipu-coding-plan'));
});

test('a quota failure without a reset time cools the account for the short cooldown; products on other accounts are untouched', () => {
  const hub = testHub();
  hub.recordTurnHealth(CHANNEL_PROFILES.workbuddy, run('failed', 'Quota exceeded: 429 您的账户已达到速率限制'));
  const cd = hub.quotaCooldowns.get('zhipu-coding-plan');
  assert.ok(cd);
  assert.ok(cd.until - Date.now() <= 120_000 && cd.until > Date.now());
  assert.equal(hub.pickChannel(['hermes', 'claude']).channel, 'claude');
  hub.recordTurnHealth(CHANNEL_PROFILES.codex, run('failed', 'Quota exceeded'));
  assert.equal(CHANNEL_PROFILES.codex.quotaAccount, undefined);
  assert.equal(hub.quotaCooldowns.size, 1);
});
