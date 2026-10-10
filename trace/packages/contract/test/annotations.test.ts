import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ANNOTATION_VERSION, isStale, validateAnnotationSet, type AnnotationSet, type Segment, type Session } from '../src/index.ts';

const AT = '2026-10-01T09:00:00.000Z';

function session(): Session {
  const step = (id: string) => ({ id, kind: 'event' as const, name: 'note' as const, at: AT, text: id });
  return {
    id: 'test:s1', sourceId: 's1', source: { kind: 'test', format: 'test/v1', adapter: 'test@0' }, title: 't',
    agent: { product: 'test', name: 't', role: 'main' }, links: [], notes: [], state: { status: 'idle' },
    stats: { turns: 2, modelCalls: 0, toolCalls: 0, toolErrors: 0, messages: 0, compactions: 0, subagents: 0, records: 5, skipped: 0 },
    turns: [
      { id: 't1', index: 1, status: 'completed', steps: [step('a'), step('b'), step('c')] },
      { id: 't2', index: 2, status: 'completed', steps: [step('d'), step('e')] },
    ],
  };
}

function layer(segments: Segment[], steps = 5): AnnotationSet {
  return { version: ANNOTATION_VERSION, session: 'test:s1', producer: { kind: 'rules', name: 'test@1', at: AT }, basis: { steps }, segments };
}

const seg = (id: string, turn: string, steps: string[]): Segment => ({ id, kind: 'decision', turn, steps, title: id });

test('a layer of consecutive, disjoint segments is valid, and goes stale when the session grows', () => {
  const s = session();
  const l = layer([seg('x', 't1', ['a', 'b']), seg('y', 't1', ['c']), seg('z', 't2', ['d'])]);
  assert.deepEqual(validateAnnotationSet(l, s), []);
  assert.equal(isStale(l, s), false);
  s.turns[1].steps.push({ id: 'f', kind: 'event', name: 'note', at: AT });
  assert.equal(isStale(l, s), true, 'a step the producer did not see');
});

test('segments must be consecutive steps of their own turn, each step in one segment', () => {
  const s = session();
  assert.match(validateAnnotationSet(layer([seg('x', 't1', ['a', 'c'])]), s).join(), /not consecutive/);
  assert.match(validateAnnotationSet(layer([seg('x', 't1', ['c', 'd'])]), s).join(), /outside turn t1/);
  assert.match(validateAnnotationSet(layer([seg('x', 't1', ['a', 'b']), seg('y', 't1', ['b', 'c'])]), s).join(), /b is in two segments/);
  assert.match(validateAnnotationSet(layer([seg('x', 't9', ['a'])]), s).join(), /missing turn t9/);
  assert.match(validateAnnotationSet(layer([seg('x', 't1', [])]), s).join(), /covers no steps/);
  assert.match(validateAnnotationSet(layer([seg('x', 't1', ['a']), seg('x', 't1', ['b'])]), s).join(), /repeated/);
});

test('a layer names its producer, its version and its session', () => {
  const s = session();
  assert.match(validateAnnotationSet({ ...layer([]), version: '9' }, s).join(), /version 9/);
  assert.match(validateAnnotationSet({ ...layer([]), producer: { kind: 'oracle', name: 'x', at: AT } }, s).join(), /bad producer/);
  assert.match(validateAnnotationSet({ ...layer([]), session: 'test:other' }, s).join(), /not test:s1/);
  assert.deepEqual(validateAnnotationSet(layer([])), [], 'without the session only the structure is checked');
});
