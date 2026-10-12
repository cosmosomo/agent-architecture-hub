import { test } from 'node:test';
import assert from 'node:assert/strict';
import { appendFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { request } from 'node:http';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { ADAPTERS } from '@hub-trace/adapters';
import { validateSessionDoc } from '@hub-trace/contract';
import { createService, listen } from '../src/server.ts';
import { SessionStore } from '../src/store.ts';
import { CHILD_ID, FIXTURES, MAIN_ID } from '../../../packages/adapters/test/fixtures/codex.ts';

function setup() {
  const dir = mkdtempSync(join(tmpdir(), 'hub-trace-'));
  const sessions = join(dir, 'sessions');
  for (const [rel, make] of Object.entries(FIXTURES)) {
    const f = join(sessions, rel);
    mkdirSync(dirname(f), { recursive: true });
    writeFileSync(f, make().join('\n') + '\n');
  }
  writeFileSync(join(sessions, 'notes.jsonl'), '{}\n');
  const store = new SessionStore({ roots: ADAPTERS.map((adapter) => ({ adapter, dir: sessions })), cacheFile: join(dir, 'cache', 'index.json') });
  return { dir, sessions, store };
}

test('scan builds the index, links children, and reuses unchanged files', async () => {
  const { dir, sessions, store } = setup();
  try {
    const r1 = await store.scan();
    assert.equal(r1.files, 4, 'only rollout files are sessions');
    assert.equal(r1.parsed, 4);
    const idx = store.index();
    assert.equal(idx.sessions.length, 4);
    const main = idx.sessions.find((s) => s.id === 'codex:' + MAIN_ID)!;
    assert.equal((main as { turns?: unknown }).turns, undefined, 'the index holds summaries only');
    assert.deepEqual(main.links.filter((l) => l.rel === 'child').map((l) => l.id), ['codex:' + CHILD_ID]);

    const again = new SessionStore({ roots: store.roots, cacheFile: store.cacheFile });
    const r2 = await again.scan();
    assert.equal(main.state.status, 'working', 'files were just written, so the open turn counts as working');
    assert.equal(r2.parsed, 1, 'only the session with an open turn is parsed again');
    assert.equal(r2.reused, 3);

    const child = Object.keys(FIXTURES).find((k) => k.includes(CHILD_ID))!;
    appendFileSync(join(sessions, child), JSON.stringify({ timestamp: '2026-10-10T08:01:00.000Z', type: 'event_msg', payload: { type: 'task_started', turn_id: 'turn-c002' } }) + '\n');
    const r3 = await again.scan();
    assert.equal(r3.parsed, 2, 'a grown file is parsed again');
    const s = await again.session('codex:' + CHILD_ID);
    assert.equal(s?.turns.length, 3);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

function get(base: string, path: string, host?: string): Promise<{ status: number; body: string; headers: Record<string, unknown> }> {
  const u = new URL(base);
  return new Promise((ok, fail) => {
    const req = request({ host: u.hostname, port: u.port, path, headers: host ? { host } : {} }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (c) => (body += c));
      res.on('end', () => ok({ status: res.statusCode || 0, body, headers: res.headers }));
    });
    req.on('error', fail);
    req.end();
  });
}

test('service: index, sessions, OTLP, static files, and its guards', async () => {
  const { dir, store } = setup();
  const repo = join(dir, 'repo');
  mkdirSync(join(repo, 'hub', 'js'), { recursive: true });
  writeFileSync(join(repo, 'index.html'), '<!doctype html><title>obs</title>');
  mkdirSync(join(repo, 'concept'));
  writeFileSync(join(repo, 'concept', 'index.html'), '<!doctype html><title>board</title>');
  writeFileSync(join(repo, 'hub', 'js', 'a.js'), 'var a = 1;');
  mkdirSync(join(repo, 'hub', 'cases', 'alpha'), { recursive: true });
  mkdirSync(join(repo, 'hub', 'cases', '_reference'), { recursive: true });
  writeFileSync(join(repo, 'hub', 'cases', '_index.md'), '');
  writeFileSync(join(repo, 'hub', '.hidden'), 'x');
  writeFileSync(join(repo, 'secret.txt'), 'outside');
  const viewer = join(dir, 'viewer');
  mkdirSync(viewer);
  writeFileSync(join(viewer, 'index.html'), '<!doctype html><title>trace</title>');
  await store.scan();
  const server = createService({ store, repoRoot: repo, viewerDir: viewer });
  const base = await listen(server, 0);
  try {
    const idx = await get(base, '/api/sessions');
    assert.equal(idx.status, 200);
    assert.equal(idx.headers['access-control-allow-origin'], undefined, 'no CORS');
    assert.equal(JSON.parse(idx.body).sessions.length, 4);

    const one = await get(base, '/api/sessions/' + encodeURIComponent('codex:' + MAIN_ID));
    assert.equal(one.status, 200);
    assert.deepEqual(validateSessionDoc(JSON.parse(one.body)), []);

    const otel = await get(base, '/api/sessions/' + encodeURIComponent('codex:' + MAIN_ID) + '/otel');
    assert.equal(JSON.parse(otel.body).resourceSpans[0].scopeSpans[0].spans.length, 16);

    assert.equal((await get(base, '/api/sessions/codex:nope')).status, 404);

    const tree = JSON.parse((await get(base, '/api/sessions/' + encodeURIComponent('codex:' + MAIN_ID) + '/tree')).body);
    assert.deepEqual(tree.sessions.map((s: { id: string }) => s.id), ['codex:' + MAIN_ID, 'codex:' + CHILD_ID], 'the main session, then the sub-agent it started');
    for (const s of tree.sessions) assert.deepEqual(validateSessionDoc({ contract: tree.contract, session: s }), []);
    assert.equal(JSON.parse((await get(base, '/api/sessions/' + encodeURIComponent('codex:' + CHILD_ID) + '/tree')).body).sessions.length, 1, 'a sub-agent alone');
    assert.equal((await get(base, '/api/sessions/codex:nope/tree')).status, 404);
    assert.match((await get(base, '/')).body, /obs/);
    assert.match((await get(base, '/concept/')).body, /board/, 'the concept board is its own page');
    assert.equal((await get(base, '/concept')).status, 302);
    assert.equal((await get(base, '/hub/js/a.js')).body, 'var a = 1;');
    assert.match((await get(base, '/trace/some/route')).body, /trace/, 'viewer routes fall back to its page');
    assert.equal((await get(base, '/hub/../secret.txt')).status, 404, 'no way out of hub/');
    assert.equal((await get(base, '/hub/%2e%2e/secret.txt')).status, 404);
    assert.equal((await get(base, '/secret.txt')).status, 404);

    const ls = await get(base, '/hub/cases/');
    assert.equal(ls.status, 200);
    assert.match(String(ls.headers['content-type']), /text\/html/);
    assert.match(ls.body, /href="alpha\/"/, 'a directory is listed with a trailing slash, as a static server does');
    assert.match(ls.body, /href="_reference\/"/);
    assert.match(ls.body, /href="_index\.md"/);
    assert.doesNotMatch((await get(base, '/hub/')).body, /hidden/, 'dotfiles are not listed');
    assert.equal((await get(base, '/hub/cases')).status, 301, 'a directory without the slash is sent to the one with it');
    assert.equal((await get(base, '/hub/%252e%252e/')).status, 404, 'no listing outside hub/');
    assert.equal((await get(base, '/api/health')).body.includes('"scanning":false'), true);
    assert.equal((await get(base, '/api/sessions', 'evil.example:80')).status, 403, 'foreign Host header is refused');
  } finally {
    server.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
