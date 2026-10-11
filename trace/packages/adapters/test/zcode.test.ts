import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONTRACT_VERSION, validateSessionDoc, type Session } from '@hub-trace/contract';
import { zcodeAdapter } from '../src/zcode/index.ts';
import { parseZcodeSession } from '../src/zcode/parse.ts';
import { T0, TID, TASK, brokenFile, runningFile, taskFile, untitledFile } from './fixtures/zcode.ts';

const parse = (text: string, mtimeMs = T0 + 60000, now = T0 + 120000) =>
  parseZcodeSession(text, { path: TASK, mtimeMs }, { now });

const texts = (s: Session) => s.turns.map((t) => [t.status, t.input?.slice(0, 8), t.output?.slice(0, 8)]);

test('registration: session files match, other .zcode files do not', () => {
  assert.equal(zcodeAdapter.matchFile(TASK), true);
  assert.equal(zcodeAdapter.matchFile('/home/u/.zcode/v2/config.json'), false);
  assert.equal(zcodeAdapter.matchFile('/home/u/.zcode/v2/sessions/projhash01/notes.txt'), false);
  assert.equal(zcodeAdapter.label, 'ZCode');
});

test('two turns from turnIndex, title, cwd, unknown roles counted', () => {
  const s = parse(taskFile());
  assert.deepEqual(validateSessionDoc({ contract: CONTRACT_VERSION, session: s }), []);
  assert.equal(s.id, 'zcode:' + TID);
  assert.equal(s.source.format, 'zcode/session-json');
  assert.equal(s.title, '把构建修好');
  assert.equal(s.cwd, 'C:\\code\\demo');
  assert.equal(s.agent.product, 'ZCode');
  assert.equal(s.turns.length, 2);
  assert.deepEqual(texts(s), [
    ['completed', '构建挂了，看看为', '先看日志。'],
    ['completed', '修一下', '修好了，构建全绿'],
  ]);
  assert.equal(s.stats.messages, 2);
  assert.equal(s.stats.skipped, 1);
  assert.ok(s.notes.some((n) => n.includes('role:system')));
});

test('a running task stays working, then stale by age', () => {
  const fresh = parse(runningFile(), T0 + 9000, T0 + 9500);
  assert.equal(fresh.turns.length, 1);
  assert.ok(['working', 'waiting'].includes(fresh.state.status), fresh.state.status);
  const old = parse(runningFile(), T0 + 9000, T0 + 9000 + 31 * 60000);
  assert.equal(old.state.status, 'stale');
});

test('untitled task falls back to the first user message', () => {
  assert.equal(parse(untitledFile()).title, '随便看看');
});

test('broken JSON still parses to an empty, valid session', () => {
  const s = parse(brokenFile());
  assert.deepEqual(validateSessionDoc({ contract: CONTRACT_VERSION, session: s }), []);
  assert.equal(s.turns.length, 0);
  assert.equal(s.state.status, 'empty');
  assert.ok(s.stats.skipped >= 1);
});

test('createParser accumulates the whole document', () => {
  const p = zcodeAdapter.createParser({ path: TASK });
  for (const line of taskFile().split('\n')) p.push(line);
  const s = p.finish({ now: T0 + 120000 });
  assert.equal(s.turns.length, 2);
});
