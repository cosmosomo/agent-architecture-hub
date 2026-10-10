import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONTRACT_VERSION, validateSessionDoc, type ModelStep, type Session, type ToolStep } from '@hub-trace/contract';
import { adapterForFile, claudeCodeAdapter } from '../src/index.ts';
import { MAIN_ID, childSession, emptySession, mainSession } from './fixtures/claude-code.ts';

function parse(lines: string[], opts: { mtimeMs?: number; now?: number } = {}): Session {
  const p = claudeCodeAdapter.createParser({ path: '.claude/projects/test/' + MAIN_ID + '.jsonl', mtimeMs: opts.mtimeMs });
  for (const l of lines) p.push(l);
  return p.finish({ now: opts.now ?? Date.now() });
}

const tools = (s: Session) => s.turns.flatMap((t) => t.steps).filter((x): x is ToolStep => x.kind === 'tool');
const models = (s: Session) => s.turns.flatMap((t) => t.steps).filter((x): x is ModelStep => x.kind === 'model');

test('claude-code adapter: registration and matchFile', () => {
  assert.ok(adapterForFile('.claude/projects/abc/session.jsonl'), 'matches .claude/projects path');
  assert.equal(adapterForFile('.codex/sessions/rollout-xyz.jsonl')?.kind, 'codex', 'codex file still matches codex');
  assert.equal(claudeCodeAdapter.kind, 'claude-code');
  assert.equal(claudeCodeAdapter.homeRoots[0], '.claude/projects');
});

test('claude-code adapter: main session identity and contract validity', () => {
  const s = parse(mainSession());
  assert.deepEqual(validateSessionDoc({ contract: CONTRACT_VERSION, session: s }), []);
  assert.match(s.id, /^claude-code:/);
  assert.equal(s.source.format, 'claude-code/jsonl');
  assert.equal(s.agent.product, 'Claude Code');
  assert.match(s.agent.originator ?? '', /CLI/i);
});

test('claude-code adapter: two turns, correct step counts', () => {
  const s = parse(mainSession());
  // turn 1 completed, turn 2 running
  assert.equal(s.turns.length, 2);
  assert.equal(s.turns[0].status, 'completed');
  assert.equal(s.turns[1].status, 'running');
  // turn 1: 2 model steps (before and after tool), 2 tool steps (bash + patch)
  const t1 = s.turns[0];
  const t1tools = t1.steps.filter((x): x is ToolStep => x.kind === 'tool');
  assert.equal(t1tools.length, 2);
  assert.equal(t1tools[0].family, 'shell');   // execute_bash
  assert.equal(t1tools[1].family, 'patch');   // str_replace
  assert.ok(t1tools[0].status === 'ok');
});

test('claude-code adapter: running turn is open (no endedAt)', () => {
  const s = parse(mainSession(), { now: Date.now() });
  const last = s.turns[s.turns.length - 1];
  assert.equal(last.status, 'running');
  assert.equal(last.endedAt, undefined);
});

test('claude-code adapter: system message types filtered out', () => {
  const s = parse(mainSession());
  // queue-operation and progress lines should produce no noise steps
  for (const t of s.turns) {
    for (const st of t.steps) {
      if (st.kind === 'message') assert.notEqual(st.text, undefined);
    }
  }
  assert.ok(s.notes.every((n) => !n.includes('type:queue-operation') && !n.includes('type:progress')));
});

test('claude-code adapter: empty session', () => {
  const s = parse(emptySession());
  assert.deepEqual(validateSessionDoc({ contract: CONTRACT_VERSION, session: s }), []);
  assert.equal(s.turns.length, 0);
  assert.equal(s.state.status, 'empty');
});

test('claude-code adapter: child session has model and title', () => {
  const p = claudeCodeAdapter.createParser({ path: '.claude/projects/test/child.jsonl' });
  for (const l of childSession()) p.push(l);
  const s = p.finish({ now: Date.now() });
  assert.deepEqual(validateSessionDoc({ contract: CONTRACT_VERSION, session: s }), []);
  assert.ok(s.turns.length >= 1);
  assert.ok(s.title.length > 0);
});

test('claude-code adapter: stale state when file old and turn open', () => {
  const staleMs = 10 * 60 * 1000; // 10 minutes
  const s = parse(mainSession(), { mtimeMs: Date.now() - staleMs, now: Date.now() });
  const last = s.turns[s.turns.length - 1];
  if (last.status === 'running') {
    assert.equal(s.state.status, 'stale');
  }
});
