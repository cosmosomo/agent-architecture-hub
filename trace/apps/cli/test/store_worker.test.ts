import { test } from 'node:test';
import assert from 'node:assert/strict';
import { appendFileSync, mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { DatabaseSync } from 'node:sqlite';
import { dirname, join } from 'node:path';
import { codexAdapter, doubaoAdapter } from '@hub-trace/adapters';
import { zcodeDbAdapter } from '../../../packages/adapters/src/zcode/index.ts';
import { SessionStore } from '../src/store.ts';
import { SearchIndex } from '../src/search.ts';
import { FIXTURES, MAIN_ID } from '../../../packages/adapters/test/fixtures/codex.ts';

test('worker scan and on-demand parse preserve source identity, data and file invalidation', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'hub-worker-'));
  const sources = join(dir, 'sources');
  const stores = [false, true].map((worker, i) => new SessionStore({ worker, roots: [{ adapter: codexAdapter, dir: sources }], cacheFile: join(dir, `cache-${i}`, 'index.json') }));
  try {
    for (const [relative, rows] of Object.entries(FIXTURES)) {
      const path = join(sources, relative);
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, rows().join('\n') + '\n');
    }
    const reports = await Promise.all(stores.map((s) => s.scan()));
    assert.equal(reports[0].files, reports[1].files);
    assert.equal(reports[1].failed, 0);
    assert.deepEqual(stores[1].index().sessions.map((s) => s.id), stores[0].index().sessions.map((s) => s.id));
    const id = 'codex:' + MAIN_ID;
    const [direct, offthread] = await Promise.all(stores.map((s) => s.session(id)));
    assert.deepEqual(offthread, direct);
    const path = stores[1].files().find((f) => f.id === id)!.path;
    appendFileSync(path, JSON.stringify({ timestamp: '2026-10-20T01:00:00Z', type: 'event_msg', payload: { type: 'user_message', message: '新增原话' } }) + '\n');
    assert.deepEqual(await stores[1].session(id), await stores[0].session(id));
    const source = stores[1].files().find((f) => f.id === id)!;
    assert.deepEqual(await stores[1].parseSource(source), await stores[0].parseSource(source));
  } finally {
    await Promise.all(stores.map((s) => s.close()));
    rmSync(dir, { recursive: true, force: true });
  }
});

test('bundle cache invalidates when only trajectory changes, on both threads', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'hub-worker-bundle-'));
  const root = join(dir, '.sessions');
  const system = join(root, '123', 'agents', 'm_main', 'system');
  mkdirSync(system, { recursive: true });
  writeFileSync(join(system, 'assignment.md'), '## [2026-10-20T00:00:00Z] 需求\n原话');
  const trajectory = join(system, 'trajectory.jsonl');
  writeFileSync(trajectory, '{"role":"user","content":"原话"}\n');
  const stores = [false, true].map((worker, i) => new SessionStore({ worker, roots: [{ adapter: doubaoAdapter, dir: root }], cacheFile: join(dir, `cache-${i}`, 'index.json') }));
  try {
    await Promise.all(stores.map((s) => s.scan()));
    await Promise.all(stores.map((s) => s.session('doubao-desktop:123')));
    appendFileSync(trajectory, '{"role":"assistant","content":"新的完整回复"}\n');
    const updated = new Date('2030-01-01T00:00:00Z');
    utimesSync(trajectory, updated, updated);
    for (const store of stores) {
      const session = (await store.session('doubao-desktop:123'))!;
      assert.equal(session.turns[0].output, '新的完整回复');
      assert.equal(session.updatedAt, updated.toISOString());
      await store.scan();
      assert.equal(store.index().sessions[0].updatedAt, updated.toISOString());
    }
  } finally {
    await Promise.all(stores.map((s) => s.close()));
    rmSync(dir, { recursive: true, force: true });
  }
});

test('search writes on a worker stay visible to queries and removed sources disappear', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'hub-worker-search-'));
  const sources = join(dir, 'sources');
  const store = new SessionStore({ roots: [{ adapter: codexAdapter, dir: sources }], cacheFile: join(dir, 'cache', 'index.json'), worker: true });
  let search: SearchIndex | undefined;
  try {
    for (const [relative, rows] of Object.entries(FIXTURES)) {
      const path = join(sources, relative);
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, rows().join('\n') + '\n');
    }
    await store.scan();
    search = new SearchIndex(join(dir, 'search.sqlite'), { worker: true });
    const report = await search.sync(store.files(), (f) => store.parseSource(f));
    assert.equal(report.failed, 0);
    assert.equal(report.indexed, 4);
    assert.equal(search.search({}).total, report.steps);
    assert.ok(search.search({ q: 'npm' }).total > 0);
    assert.equal((await search.sync(store.files(), (f) => store.parseSource(f))).indexed, 0);
    assert.equal((await search.sync([], (f) => store.parseSource(f))).removed, 4);
    assert.equal(search.search({}).total, 0);
  } finally {
    await search?.close();
    await store.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test('worker retains the database adapter identity and observes a WAL-only change', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'hub-worker-wal-'));
  const root = join(dir, '.zcode', 'cli', 'db');
  mkdirSync(root, { recursive: true });
  const db = new DatabaseSync(join(root, 'db.sqlite'));
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA wal_autocheckpoint=0;
    CREATE TABLE session (id TEXT, parent_id TEXT, directory TEXT, title TEXT, task_type TEXT, summary_additions INTEGER, summary_deletions INTEGER, time_created INTEGER, time_updated INTEGER);
    CREATE TABLE message (id TEXT, session_id TEXT, data TEXT, sequence INTEGER);
    CREATE TABLE part (id TEXT, message_id TEXT, session_id TEXT, data TEXT, sequence INTEGER);
    INSERT INTO session VALUES ('sess_one', NULL, '/code', '原始标题', 'interactive', 0, 0, 1791000000000, 1791000000000);`);
  const store = new SessionStore({ roots: [{ adapter: zcodeDbAdapter, dir: root }], worker: true, cacheFile: join(dir, 'cache', 'index.json') });
  try {
    const first = await store.scan();
    assert.equal(first.files, 1);
    assert.equal(first.failed, 0);
    assert.equal((await store.session('zcode:sess_one'))!.title, '原始标题');
    db.exec("UPDATE session SET title='更新后的标题', time_updated=1791000001000");
    assert.equal((await store.session('zcode:sess_one'))!.title, '更新后的标题');
    await store.scan();
    assert.equal(store.index().sessions[0].title, '更新后的标题');
  } finally {
    await store.close();
    db.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
