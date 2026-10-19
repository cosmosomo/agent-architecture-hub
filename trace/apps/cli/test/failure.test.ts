import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyFailure } from '../src/gateway/failure.ts';

const run = (over: Record<string, any>) => ({ text: '', tools: [], ...over }) as any;

// Real failures from 10-18 / 10-19, one per kind.
test('each real failure gets its kind', () => {
  const cases: Array<[string, Record<string, any>]> = [
    ['quota', { error: 'ZCode turn failed: 1308 [1308][已达到 5 小时的使用上限。您的限额将在 2026-10-19 06:02:11 重置。]' }],
    ['quota', { error: '{"code":-32003,"message":"Quota exceeded: 429 您的账户已达到速率限制，请您控制请求频率"}', stopReason: 'end_turn' }],
    ['timeout', { error: 'Timeout waiting for turn 01a1503e-31e9-7c90-9bc3-64dc779576fc after 3600000ms' }],
    ['timeout', { error: '这一轮超过 3600 秒没结束，已叫停' }],
    ['timeout', { error: 'Antigravity 一小时内没有在 transcript 里写出最终回复' }],
    ['network', { error: 'API Error: Connection dropped (ECONNRESET)', stopReason: 'stop_sequence', text: 'API Error: Connection dropped (ECONNRESET)' }],
    ['upstream', { error: '上游模型渠道出错，Codex 重试 5 次后放弃：unexpected status 503 Service Unavailable: No available channel for model' }],
    ['refusal', { error: '模型拒绝回答（stopReason: refusal）', stopReason: 'refusal' }],
    ['permission', { error: '权限被拒：Write', deniedTools: ['Write'] }],
    ['setup', { error: 'acpx sessions ensure failed', setupFailed: true }],
    ['empty', { error: '智能体这一轮什么都没回就结束了（stopReason end_turn）', stopReason: 'end_turn' }],
    ['broken', { error: '进程退出码 1' }],
    ['other', { error: '智能体取消了这一轮', stopReason: 'cancelled', text: '做了一半' }],
  ];
  for (const [kind, r] of cases) assert.equal(classifyFailure(run(r)), kind, String(r.error));
});
