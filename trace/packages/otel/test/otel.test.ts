import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openTelemetrySpanAdapter } from '@evilmartians/agent-prism-data';
import { codexAdapter, parseText } from '@hub-trace/adapters';
import { sessionToOtlp } from '../src/index.ts';
import { mainSession, legacySession } from '../../adapters/test/fixtures/codex.ts';

test('OTLP document: one trace, spans nested session > turn > calls, stable ids', () => {
  const s = parseText(codexAdapter, mainSession().join('\n'), {}, 0);
  const doc = sessionToOtlp(s);
  const spans = doc.resourceSpans[0].scopeSpans[0].spans;
  assert.equal(new Set(spans.map((x) => x.traceId)).size, 1);
  assert.equal(new Set(spans.map((x) => x.spanId)).size, spans.length, 'span ids are unique');
  assert.equal(spans.length, 1 + 2 + 7 + 6, 'session, turns, model calls, tool calls');
  const root = spans[0];
  assert.equal(root.parentSpanId, undefined);
  assert.ok(spans.slice(1).every((x) => x.parentSpanId), 'every other span has a parent');
  assert.deepEqual(sessionToOtlp(s), doc, 'same session, same document');
  for (const x of spans) assert.ok(BigInt(x.endTimeUnixNano) >= BigInt(x.startTimeUnixNano), x.name + ' ends before it starts');
});

test('AgentPrism reads the export: categories, tree, status, tokens', () => {
  const s = parseText(codexAdapter, mainSession().join('\n'), {}, 0);
  const tree = openTelemetrySpanAdapter.convertRawDocumentsToSpans(sessionToOtlp(s));
  assert.equal(tree.length, 1);
  const [root] = tree;
  assert.equal(root.type, 'agent_invocation');
  assert.equal(root.children?.length, 2);
  const turn1 = root.children![0];
  assert.equal(turn1.type, 'agent_invocation');
  assert.equal(turn1.status, 'success');
  assert.equal(turn1.input, '请把购物车的测试跑通');
  const kinds = turn1.children!.map((c) => c.type);
  assert.deepEqual(kinds.slice(0, 3), ['llm_call', 'tool_execution', 'llm_call']);
  const llm = turn1.children![0];
  assert.equal(llm.title, 'gpt-6.1-sol - chat gpt-6.1-sol');
  assert.equal(llm.tokenUsage?.input?.tokens, 4000, 'cached input is taken out of input');
  assert.equal(llm.tokenUsage?.cache_read?.tokens, 8000);
  assert.equal(llm.tokenUsage?.output?.tokens, 300);
  assert.equal(llm.reasoning?.tokens, 120);
  const failed = turn1.children![1];
  assert.equal(failed.status, 'error');
  assert.match(failed.output || '', /expected total 30/);
  const turn2 = root.children![1];
  assert.equal(turn2.status, 'warning', 'an open turn has no final status');
});

test('sessions without timestamps still export', () => {
  const s = parseText(codexAdapter, legacySession().join('\n'), {}, 0);
  const spans = sessionToOtlp(s).resourceSpans[0].scopeSpans[0].spans;
  assert.ok(spans.length > 3);
  for (const x of spans) assert.ok(BigInt(x.endTimeUnixNano) >= BigInt(x.startTimeUnixNano));
});
