import { test } from 'node:test';
import assert from 'node:assert/strict';
import { overview, type RootInfo } from '@hub-trace/contract';
import type { SessionSummary } from '@hub-trace/contract';

function mk(id: string, kind: string, over: Partial<SessionSummary> = {}): SessionSummary {
  return {
    id,
    sourceId: id,
    source: { kind, format: kind + '/jsonl', adapter: kind + '@0' },
    title: id,
    agent: { product: kind, name: kind, role: 'main' },
    links: [],
    state: { status: 'idle' },
    stats: { turns: 1, modelCalls: 1, toolCalls: 0, toolErrors: 0, messages: 1, compactions: 0, subagents: 0, records: 1, skipped: 0 },
    notes: [],
    ...over,
  } as SessionSummary;
}

const roots: RootInfo[] = [
  { kind: 'codex', label: 'Codex', dir: '/home/u/.codex/sessions', exists: true },
  { kind: 'claude-code', label: 'Claude Code', dir: '/home/u/.claude/projects', exists: true },
  { kind: 'opencode', label: 'OpenCode', dir: '/home/u/.opencode', exists: false },
];

test('overview: groups by source and project, sums the money and counts roles', () => {
  const summaries = [
    mk('codex:a', 'codex', { cwd: '/work/alpha', updatedAt: '2026-10-11T10:00:00Z', startedAt: '2026-10-10T09:00:00Z', stats: { turns: 3, modelCalls: 3, toolCalls: 2, toolErrors: 0, messages: 3, compactions: 0, subagents: 0, records: 9, skipped: 0, costUsd: 1.5 }, agent: { product: 'Codex', name: 'Codex', role: 'main', model: 'gpt-5.3' } }),
    mk('codex:b', 'codex', { cwd: '/work/alpha', updatedAt: '2026-10-11T11:00:00Z', agent: { product: 'Codex', name: 'sub', role: 'subagent' } }),
    mk('codex:c', 'codex', { cwd: '/work/beta', updatedAt: '2026-10-01T08:00:00Z', state: { status: 'working' } }),
    mk('claude-code:x', 'claude-code', { cwd: '/work/alpha', updatedAt: '2026-10-11T12:00:00Z', stats: { turns: 2, modelCalls: 2, toolCalls: 1, toolErrors: 1, messages: 2, compactions: 0, subagents: 0, records: 5, skipped: 0, costUsd: 0.25 }, agent: { product: 'Claude Code', name: 'Claude Code', role: 'main', model: 'claude-opus-5-5' } }),
  ];
  const o = overview(summaries, roots, '0.2', () => Date.parse('2026-10-11T12:00:00Z'));

  assert.equal(o.sources.length, 3, 'every known root appears, even without sessions');
  const codex = o.sources.find((s) => s.kind === 'codex')!;
  assert.equal(o.sources[0]!.kind, 'codex', 'sorted by session count');
  assert.equal(codex.sessions, 3);
  assert.equal(codex.main, 2);
  assert.equal(codex.subagents, 1);
  assert.equal(codex.working, 1);
  assert.equal(codex.costUsd, 1.5);
  assert.equal(codex.projects.length, 2);
  const alpha = codex.projects[0]!;
  assert.equal(alpha.cwd, '/work/alpha');
  assert.equal(alpha.lastAt, '2026-10-11T11:00:00Z');
  assert.equal(alpha.main, 1);
  assert.equal(alpha.subagents, 1);
  assert.equal(codex.firstAt, '2026-10-10T09:00:00Z');

  const claude = o.sources.find((s) => s.kind === 'claude-code')!;
  assert.equal(claude.projects[0]!.costUsd, 0.25);
  assert.equal(claude.models[0]!.model, 'claude-opus-5-5');

  const empty = o.sources.find((s) => s.kind === 'opencode')!;
  assert.equal(empty.exists, false);
  assert.equal(empty.sessions, 0);
  assert.deepEqual(empty.projects, []);
});

test('overview: sessions without a cwd land in one bucket', () => {
  const o = overview([mk('claude-code:y', 'claude-code')], roots.slice(1), '0.2');
  assert.equal(o.sources[0]!.projects.length, 1);
  assert.match(o.sources[0]!.projects[0]!.cwd, /没有目录记录/);
});
