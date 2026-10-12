/**
 * The observatory draws a run's detail with the trace view, so what it hands over must be the contract:
 * every simulated run of every preset, converted by hub/js/core/to-trace.js, has to pass the same checks
 * a parsed session does, and its decisions have to form a valid coarse-grained layer.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { CONTRACT_VERSION, isStale, validateAnnotationSet, validateSessionDoc, type AnnotationSet, type Session } from '../src/index.ts';

type Run = { id: string; start: number; end: number; outcome: string };
type Model = { facts: { runs: Run[] }; idx: { decsByRun: Map<string, unknown[]> } };
type Hub = {
  base: { presets: Record<string, unknown> };
  model: { select: (id: string) => Model };
  toTrace: { fromRun: (m: Model, run: Run, cut: number | null) => { session: Session; layer: AnnotationSet } };
};

const require = createRequire(import.meta.url);
const { createContext, loadScripts, pageScripts } = require(fileURLToPath(new URL('../../../../hub/tools/load.js', import.meta.url)));

function hub(): Hub {
  return loadScripts(createContext(), pageScripts(['data/', 'js/core/', 'js/sources/'])).HUB;
}

// what the page hands the trace view travels as JSON
const plain = <T>(x: T): T => JSON.parse(JSON.stringify(x));

test('every simulated run converts to a valid session and decision layer', () => {
  const HUB = hub();
  let runs = 0, segments = 0;
  for (const id of Object.keys(HUB.base.presets)) {
    const m = HUB.model.select(id);
    for (const run of m.facts.runs) {
      const { session, layer } = plain(HUB.toTrace.fromRun(m, run, null));
      const where = id + ' ' + run.id;
      assert.deepEqual(validateSessionDoc({ contract: CONTRACT_VERSION, session }), [], where);
      assert.deepEqual(validateAnnotationSet(layer, session), [], where);
      assert.equal(isStale(layer, session), false, where);
      assert.equal(layer.segments.length, (m.idx.decsByRun.get(run.id) || []).length, where + ': every decision is a segment');
      runs += 1;
      segments += layer.segments.length;
    }
  }
  assert.ok(runs > 1000 && segments > runs, runs + ' runs, ' + segments + ' decisions');
});

test('a run cut halfway is still running and shows only what happened before the cut', () => {
  const HUB = hub();
  const m = HUB.model.select('deep_five_minds');
  const run = m.facts.runs.find((r) => (m.idx.decsByRun.get(r.id) || []).length >= 3 && r.end - r.start > 60_000)!;
  const whole = plain(HUB.toTrace.fromRun(m, run, null));
  const cut = plain(HUB.toTrace.fromRun(m, run, Math.round((run.start + run.end) / 2)));
  assert.deepEqual(validateSessionDoc({ contract: CONTRACT_VERSION, session: cut.session }), []);
  assert.deepEqual(validateAnnotationSet(cut.layer, cut.session), []);
  assert.equal(cut.session.turns[0].status, 'running');
  assert.equal(cut.session.state.status, 'working');
  assert.ok(cut.session.turns[0].steps.length < whole.session.turns[0].steps.length);
  assert.ok(cut.layer.segments.length <= whole.layer.segments.length);
});
