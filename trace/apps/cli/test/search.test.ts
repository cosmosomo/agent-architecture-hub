import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { ADAPTERS } from '@hub-trace/adapters';
import { createService, listen } from '../src/server.ts';
import { SearchIndex, snippet } from '../src/search.ts';
import { SessionStore } from '../src/store.ts';
import { FIXTURES, MAIN_ID } from '../../../packages/adapters/test/fixtures/codex.ts';

function setup() {
  const dir = mkdtempSync(join(tmpdir(), 'hub-trace-search-'));
  const sessions = join(dir, 'sessions');
  for (const [rel, make] of Object.entries(FIXTURES)) {
    const f = join(sessions, rel);
    mkdirSync(dirname(f), { recursive: true });
    writeFileSync(f, make().join('\n') + '\n');
  }
  const store = new SessionStore({ roots: ADAPTERS.map((adapter) => ({ adapter, dir: sessions })), cacheFile: join(dir, 'cache', 'index.json') });
  return { dir, store };
}

test('search index: steps are findable, filters and facets follow, and a second sync does nothing', async () => {
  const { dir, store } = setup();
  try {
    await store.scan();
    const search = new SearchIndex(join(dir, 'search.sqlite'));
    try {
      const files = store.files();
      const first = await search.sync(files, (f) => store.parseSource(f));
      assert.equal(first.indexed, 4);
      assert.ok(first.steps > 10, 'the fixtures have steps to index');
      assert.equal((await search.sync(store.files(), (f) => store.parseSource(f))).indexed, 0, 'nothing changed since');

      const all = search.search({});
      assert.equal(all.total, first.steps, 'no query means every step');
      assert.equal(all.facets.all, first.steps);
      assert.equal(all.hits.length, Math.min(50, first.steps), 'a page is at most 50 by default');
      assert.ok(all.facets.kinds['tool:shell'] >= 1, 'tool families are facets');

      const byText = search.search({ q: 'npm' });
      assert.ok(byText.total >= 1 && byText.total < all.total, 'a word narrows the set');
      assert.match(byText.hits[0].snippet, /\u0001.*\u0002/, 'the match is marked in the snippet');

      const bySession = search.search({ sessions: ['codex:' + MAIN_ID] });
      assert.ok(bySession.hits.every((h) => h.session === 'codex:' + MAIN_ID));

      const toolOnly = search.search({ kinds: ['tool'] });
      assert.ok(toolOnly.hits.every((h) => h.kind === 'tool'));
      assert.equal(toolOnly.facets.all, all.total, 'facets stay on the unfiltered scope');

      const errors = search.search({ errors: true });
      assert.ok(errors.hits.every((h) => h.status === 'error'));
      assert.ok(errors.facets.errors >= errors.total);

      const subagentIds = new Set(store.files().filter((f) => f.summary.agent.role === 'subagent').map((f) => f.id));
      assert.ok(subagentIds.size >= 1, 'the fixtures have a sub-agent session');
      const role = search.search({ role: 'subagent' });
      assert.ok(role.total > 0 && role.hits.every((h) => subagentIds.has(h.session)), 'only sub-agent sessions');
      assert.ok(search.search({ role: 'main' }).hits.every((h) => !subagentIds.has(h.session)));
      assert.equal(search.search({ cwd: '/nowhere' }).total, 0);
      assert.equal(search.status().steps, first.steps);
    } finally {
      search.close();
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('service: /api/search answers and says when search is off', async () => {
  const { dir, store } = setup();
  await store.scan();
  const search = new SearchIndex(join(dir, 'search.sqlite'));
  await search.sync(store.files(), (f) => store.parseSource(f));
  const repo = join(dir, 'repo');
  mkdirSync(repo, { recursive: true });
  writeFileSync(join(repo, 'index.html'), '<!doctype html>');
  const withSearch = createService({ store, search, repoRoot: repo, viewerDir: join(dir, 'nope') });
  const without = createService({ store, repoRoot: repo, viewerDir: join(dir, 'nope') });
  const a = await listen(withSearch, 0);
  const b = await listen(without, 0);
  try {
    const res = await fetch(a + '/api/search?q=npm&kind=tool%3Ashell');
    assert.equal(res.status, 200);
    const body = (await res.json()) as { total: number; hits: { kind: string }[] };
    assert.ok(body.total >= 1);
    assert.ok(body.hits.every((h) => h.kind === 'tool'));
    assert.equal((await fetch(b + '/api/search?q=npm')).status, 404, 'search off is not an error page');
    const health = (await (await fetch(a + '/api/health')).json()) as { search: { steps: number } };
    assert.ok(health.search.steps >= 1);
  } finally {
    withSearch.close();
    without.close();
    search.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test('snippet: window around the first match, every match marked', () => {
  assert.equal(snippet('abc', []), 'abc');
  const s = snippet('  前面有很多字 ' + 'X'.repeat(200) + ' 关键词 后面也有很多字 ' + 'Y'.repeat(200), ['关键词']);
  assert.ok(s.startsWith('…'), 'the window starts where the text was cut');
  assert.ok(s.includes('\u0001关键词\u0002'), 'the match is marked');
  assert.ok(s.length < 200);
  assert.match(snippet('KeyWord and keyword', ['keyword']), /\u0001KeyWord\u0002 and \u0001keyword\u0002/, 'case-insensitive, both marked');
});
