import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { CONTRACT_VERSION, validateSessionDoc } from '@hub-trace/contract';
import { parseZcodeDb } from '../src/zcode/db.ts';
import { zcodeDbAdapter } from '../src/zcode/index.ts';

const T0 = 1791000000000;

/** A hand-made store (never real data): one main session with a tool turn and
 *  usage, one subagent child with a parent link, one empty session. */
function memDb(): { db: DatabaseSync; src: { all(sql: string, ...args: unknown[]): unknown[] } } {
  const db = new DatabaseSync(':memory:');
  db.exec('CREATE TABLE session (id TEXT, parent_id TEXT, directory TEXT, title TEXT, task_type TEXT, summary_additions INTEGER, summary_deletions INTEGER, time_created INTEGER, time_updated INTEGER)');
  db.exec('CREATE TABLE message (id TEXT, session_id TEXT, data TEXT, sequence INTEGER)');
  db.exec('CREATE TABLE part (id TEXT, message_id TEXT, session_id TEXT, data TEXT, sequence INTEGER)');
  const ins = db.prepare('INSERT INTO session VALUES (?,?,?,?,?,?,?,?,?)');
  ins.run('sess_main', null, 'C:\\code\\demo', '修构建', 'interactive', 5, 2, T0, T0 + 60000);
  ins.run('sess_sub', 'sess_main', 'C:\\code\\demo', '子任务', 'subagent_child', null, null, T0 + 1000, T0 + 9000);
  ins.run('sess_empty', null, 'C:\\code\\demo', '', 'interactive', null, null, T0 + 2000, T0 + 3000);

  const msg = db.prepare('INSERT INTO message VALUES (?,?,?,?)');
  const part = db.prepare('INSERT INTO part VALUES (?,?,?,?,?)');
  let seq = 0, pseq = 0;
  const addMsg = (sid: string, data: unknown) => { const id = 'm' + seq; msg.run(id, sid, JSON.stringify(data), seq++); return id; };
  const addPart = (mid: string, data: unknown) => part.run('p' + pseq, mid, 'x', JSON.stringify(data), pseq++);

  const u1 = addMsg('sess_main', { role: 'user', time: { created: T0 + 1000 } });
  addPart(u1, { type: 'text', text: '构建挂了' });
  const a1 = addMsg('sess_main', { role: 'assistant', time: { created: T0 + 2000, completed: T0 + 9000 }, modelId: 'glm-5.3', finish: 'tool-calls', cost: 0.001 });
  addPart(a1, { type: 'reasoning', text: '先跑测试。', time: { start: T0 + 2100 } });
  addPart(a1, { type: 'tool', tool: 'bash', callID: 'c1', state: { status: 'completed', input: { command: 'npm test' }, output: '3 failures' }, time: { start: T0 + 2200, end: T0 + 8000 } });
  addPart(a1, { type: 'step-finish', tokens: { input: 500, output: 40 }, time: { end: T0 + 8900 } });
  const u2 = addMsg('sess_main', { role: 'user', time: { created: T0 + 20000 } });
  addPart(u2, { type: 'text', text: '修好了吗' });
  const a2 = addMsg('sess_main', { role: 'assistant', time: { created: T0 + 21000, completed: T0 + 30000 }, modelId: 'glm-5.3', finish: 'stop', cost: 0.002 });
  addPart(a2, { type: 'text', text: '修好了，全绿。', time: { start: T0 + 21500 } });
  addPart(a2, { type: 'step-finish', tokens: { input: 800, output: 60 }, time: { end: T0 + 29500 } });

  const su = addMsg('sess_sub', { role: 'user', time: { created: T0 + 1500 } });
  addPart(su, { type: 'text', text: '查一下日志' });

  return { db, src: { all: (sql: string, ...args: unknown[]) => db.prepare(sql).all(...(args as never[])) } };
}

const parse = (now = T0 + 120000) => {
  const { db, src } = memDb();
  try {
    return parseZcodeDb({ path: 'C:/u/.zcode/cli/db/db.sqlite', size: 1, mtimeMs: T0 + 60000 }, src, { now });
  } finally {
    db.close();
  }
};

test('registration: the db file matches', () => {
  assert.equal(zcodeDbAdapter.matchFile('C:/Users/u/.zcode/cli/db/db.sqlite'), true);
  assert.equal(zcodeDbAdapter.matchFile('C:/Users/u/.zcode/v2/sessions/a/b.json'), false);
});

test('every session in the store, valid, with turns, tools and usage', () => {
  const sessions = parse();
  assert.equal(sessions.length, 3);
  for (const s of sessions) assert.deepEqual(validateSessionDoc({ contract: CONTRACT_VERSION, session: s }), []);
  const main = sessions.find((s) => s.id === 'zcode:sess_main')!;
  assert.equal(main.source.format, 'zcode/sqlite');
  assert.equal(main.title, '修构建');
  assert.equal(main.cwd, 'C:\\code\\demo');
  assert.equal(main.agent.role, 'main');
  assert.equal(main.agent.model, 'glm-5.3');
  assert.equal(main.turns.length, 2);
  assert.equal(main.stats.toolCalls, 1);
  assert.deepEqual(main.usage, { input: 1300, output: 100 });
  assert.equal(main.stats.costUsd, 0.003);
  assert.equal(main.stats.linesAdded, 5);
  assert.equal(main.turns[0].input, '构建挂了');
});

test('a subagent session carries a parent link', () => {
  const sub = parse().find((s) => s.id === 'zcode:sess_sub')!;
  assert.equal(sub.agent.role, 'subagent');
  assert.deepEqual(sub.links, [{ rel: 'parent', id: 'zcode:sess_main' }]);
});

test('a session without messages is empty but valid', () => {
  const empty = parse().find((s) => s.id === 'zcode:sess_empty')!;
  assert.equal(empty.state.status, 'empty');
  assert.equal(empty.turns.length, 0);
});
