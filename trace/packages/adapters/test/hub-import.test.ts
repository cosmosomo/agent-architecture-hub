/**
 * Real sessions drawn as an org graph: parsed Codex sessions (the fixtures, a main session that starts a
 * sub-agent) go through hub/js/sources/from-trace.js into the observatory's model, and the analysis and the
 * org scene have to take it the way they take a simulated case.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Session } from '@hub-trace/contract';
import { codexAdapter } from '../src/index.ts';
import { CHILD_ID, MAIN_ID, childSession, mainSession } from './fixtures/codex.ts';

type Ind = { id: string; kind: string; name: string; isHub: boolean; groupId: string | null; natives: string[] };
type Card = { key: string };
type Link = { key: string; from: string; to: string };
type Hub = {
  fromTrace: { model: (s: Session[], o: { id: string }) => any };
  model: { current: unknown; an: (s: unknown, m: unknown) => any };
  analysis: { buildIdx: (def: unknown, facts: unknown) => unknown };
  store: { init: (p: object) => void; get: () => object };
  obsSceneOrg: { build: (m: unknown, s: unknown, a: unknown, v: object) => { cards: Card[]; frames: Card[]; links: Link[] } };
  obsSceneProcess: { build: (m: unknown, s: unknown, a: unknown, v: object) => { cards: Card[]; frames: Card[]; links: Link[] } };
};

const require = createRequire(import.meta.url);
const { createContext, loadScripts, HUB_DIR } = require(fileURLToPath(new URL('../../../../hub/tools/load.js', import.meta.url)));

function hub(): Hub {
  const cases = readdirSync(join(HUB_DIR, 'data', 'cases')).filter((f: string) => f.endsWith('.js')).map((f: string) => 'data/cases/' + f);
  return loadScripts(createContext(), ['data/base.js', 'data/zh.js', ...cases,
    'js/core/util.js', 'js/core/store.js', 'js/sources/casedef.js', 'js/sources/sim.js', 'js/core/analysis.js', 'js/core/model.js', 'js/sources/from-trace.js',
    'js/core/views.js', 'js/obs/cards.js', 'js/obs/scene-org.js', 'js/obs/scene-process.js']).HUB;
}

function parse(lines: string[], id: string): Session {
  const p = codexAdapter.createParser({ path: 'rollout-' + id + '.jsonl' });
  for (const l of lines) p.push(l);
  return p.finish({ now: Date.parse('2026-10-10T09:00:00Z') });
}

test('a main session and its sub-agent become a model the org views draw like a simulated case', () => {
  const HUB = hub();
  const sessions = [parse(mainSession(), MAIN_ID), parse(childSession(), CHILD_ID)];
  const m = HUB.fromTrace.model(JSON.parse(JSON.stringify(sessions)), { id: 'tree:codex:' + MAIN_ID });

  // definitions, read off the facts
  const agents: Ind[] = m.def.individuals.filter((x: Ind) => x.kind === 'agent');
  assert.equal(agents.length, 2);
  const main = agents.find((x) => x.isHub)!, child = agents.find((x) => !x.isHub)!;
  assert.equal(child.name, 'tester');
  const wave = m.def.groups.find((g: { id: string }) => g.id === child.groupId);
  assert.equal(wave.parentId, main.groupId, 'the sub-agent sits in a group under the main one');
  assert.ok(m.def.relations.some((r: Link & { type: string; sub: string }) => r.type === 'task' && r.sub === 'dispatch' && r.from === main.id && r.to === child.id));

  // facts: a run per turn, each pointing back at its session and turn
  assert.equal(m.facts.runs.length, sessions.reduce((n, s) => n + s.turns.length, 0));
  for (const r of m.facts.runs) assert.ok(m.source.runs[r.id], 'run ' + r.id + ' points back at its turn');
  assert.ok(m.facts.handoffs.some((h: Link) => h.from === main.id && h.to === child.id), 'the dispatch happened');
  assert.ok(m.facts.calls.length > 0);

  // the analysis and the scenes simulated cases go through
  m.idx = HUB.analysis.buildIdx(m.def, m.facts);
  HUB.model.current = m;
  HUB.store.init({ caseId: m.id });
  const base = HUB.store.get();
  for (const d of [1, 2, 3]) {
    const s = { ...base, subject: 'org', depth: { org: d, process: 1, exec: 1 } };
    const a = HUB.model.an(s, m);
    assert.equal(a.indStats[child.id].runs, sessions[1].turns.length);
    const sc = HUB.obsSceneOrg.build(m, s, a, { w: 1300, h: 760 });
    const keys = new Set([...sc.cards, ...sc.frames].map((o) => o.key));
    assert.ok(keys.has('i:human'));
    for (const l of sc.links) assert.ok(keys.has(l.from) && keys.has(l.to), 'both ends of ' + l.key + ' are drawn');
    if (d === 3) assert.ok(keys.has('i:' + main.id) && keys.has('i:' + child.id), 'every agent is drawn at the finest grain');
  }
  // a source without a business process gets a note instead of an empty drawing
  const sp = { ...base, subject: 'process', depth: { org: 1, process: 1, exec: 1 } };
  const proc = HUB.obsSceneProcess.build(m, sp, HUB.model.an(sp, m), { w: 1300, h: 760 });
  assert.ok(proc.cards.some((c) => c.key === 'x:noprocess'));
});
