import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONTRACT_VERSION, validateSessionDoc, type Session } from '@hub-trace/contract';
import { factoryAdapter } from '../src/factory/index.ts';
import { parseText } from '../src/index.ts';
import { SESSION, SID, T0, brokenSession, emptySession, twoTurnSession } from './fixtures/factory.ts';

const parse = (lines: string[], mtimeMs = T0 + 60000, now = T0 + 120000): Session => {
  const p = factoryAdapter.createParser({ path: SESSION, mtimeMs });
  for (const l of lines) p.push(l);
  return p.finish({ now });
};

const texts = (s: Session) => s.turns.map((t) => [t.status, t.input, t.output]);

test('registration: <uuid>.jsonl below .factory/sessions matches, settings and other files do not', () => {
  assert.equal(factoryAdapter.matchFile(SESSION), true);
  assert.equal(factoryAdapter.matchFile('C:\\Users\\u\\.factory\\sessions\\' + SID + '.jsonl'), true);
  assert.equal(factoryAdapter.matchFile('/home/u/.factory/sessions/' + SID + '.settings.json'), false);
  assert.equal(factoryAdapter.matchFile('/home/u/.factory/config.json'), false);
  assert.equal(factoryAdapter.matchFile('/home/u/.factory/sessions/sub/' + SID + '.jsonl'), false);
  assert.equal(factoryAdapter.label, 'Factory');
});

test('two turns from user messages: title, stats, unknown blocks and roles counted', () => {
  const s = parse(twoTurnSession());
  assert.deepEqual(validateSessionDoc({ contract: CONTRACT_VERSION, session: s }), []);
  assert.equal(s.id, 'factory:' + SID);
  assert.equal(s.source.format, 'factory/jsonl');
  assert.equal(s.title, '添加 context7 服务');
  assert.equal(s.agent.product, 'Factory');
  assert.equal(s.cwd, undefined, 'the format has no working directory');
  assert.equal(s.startedAt, '2026-10-10T08:00:01.000Z');
  assert.equal(s.updatedAt, '2026-10-10T08:00:32.000Z');
  assert.equal(s.state.status, 'idle');
  assert.equal(s.turns.length, 2);
  assert.deepEqual(texts(s), [
    ['completed', '帮我把 context7 加进 MCP 配置', '好，先看现有配置。'],
    ['completed', '再加一个搜索服务', '两个都加好了。'],
  ]);
  assert.equal(s.stats.messages, 2);
  assert.equal(s.stats.modelCalls, 2);
  assert.equal(s.stats.toolCalls, 1, 'the tool_use block is a real tool step now');
  assert.equal(s.usage, undefined, 'the format reports no tokens');
  assert.equal(s.stats.records, 6);
  assert.equal(s.stats.skipped, 1, 'only the unknown role is counted now');
  assert.ok(s.notes.some((n) => n.includes('role:system')));
});

test('a session_start without messages is an empty session', () => {
  const s = parse(emptySession());
  assert.deepEqual(validateSessionDoc({ contract: CONTRACT_VERSION, session: s }), []);
  assert.equal(s.id, 'factory:' + SID);
  assert.equal(s.turns.length, 0);
  assert.equal(s.state.status, 'empty');
  assert.equal(s.title, 'Factory');
  assert.equal(s.stats.records, 1);
  assert.equal(s.stats.skipped, 0);
});

test('a broken line mid-file is skipped, parsing continues', () => {
  const s = parse(brokenSession());
  assert.deepEqual(validateSessionDoc({ contract: CONTRACT_VERSION, session: s }), []);
  assert.equal(s.turns.length, 2);
  assert.deepEqual(texts(s), [
    ['completed', '看看哪些依赖没用到', '这三个没用到。'],
    ['completed', '删掉它们', '删完了，测试还是绿的。'],
  ]);
  assert.equal(s.stats.records, 6);
  assert.equal(s.stats.skipped, 2);
  assert.ok(s.notes.some((n) => n.includes('type:summary')));
});

test('streamed push line by line equals whole-text parsing', () => {
  const s = parse(twoTurnSession());
  const whole = parseText(factoryAdapter, twoTurnSession().join('\n'), { path: SESSION, mtimeMs: T0 + 60000 }, T0 + 120000);
  assert.deepEqual(whole, s);
  // 空行与回车不影响
  const noisy = parse(twoTurnSession().flatMap((l, i) => (i === 1 ? [l, '', '\r'] : [l])));
  assert.deepEqual(noisy, s);
});
