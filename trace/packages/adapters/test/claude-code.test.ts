import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONTRACT_VERSION, validateSessionDoc, type ModelStep, type Session, type ToolStep } from '@hub-trace/contract';
import { adapterForFile, claudeCodeAdapter } from '../src/index.ts';
import { MAIN_ID, childSession, contextLine, emptySession, mainSession, sidechainLine } from './fixtures/claude-code.ts';

function parse(lines: string[], opts: { mtimeMs?: number; now?: number } = {}): Session {
  const p = claudeCodeAdapter.createParser({ path: '.claude/projects/test/' + MAIN_ID + '.jsonl', mtimeMs: opts.mtimeMs });
  for (const l of lines) p.push(l);
  return p.finish({ now: opts.now ?? Date.now() });
}

const tools = (s: Session) => s.turns.flatMap((t) => t.steps).filter((x): x is ToolStep => x.kind === 'tool');
const models = (s: Session) => s.turns.flatMap((t) => t.steps).filter((x): x is ModelStep => x.kind === 'model');
const texts = (s: Session, role: string) => s.turns.flatMap((t) => t.steps).filter((x) => x.kind === 'message' && x.role === role).map((x) => (x as { text: string }).text);

test('claude-code adapter: registration and matchFile', () => {
  assert.ok(adapterForFile('.claude/projects/abc/session.jsonl'), 'matches .claude/projects path');
  assert.equal(adapterForFile('.codex/sessions/rollout-xyz.jsonl')?.kind, 'codex', 'codex file still matches codex');
  assert.equal(claudeCodeAdapter.kind, 'claude-code');
  assert.equal(claudeCodeAdapter.homeRoots[0], '.claude/projects');
});

test('claude-code adapter: main session identity and contract validity', () => {
  const s = parse(mainSession());
  assert.deepEqual(validateSessionDoc({ contract: CONTRACT_VERSION, session: s }), []);
  assert.equal(s.id, 'claude-code:' + MAIN_ID);
  assert.equal(s.source.format, 'claude-code/jsonl');
  assert.equal(s.source.version, '2.0.14');
  assert.equal(s.agent.product, 'Claude Code');
  assert.match(s.agent.originator ?? '', /CLI/i);
  assert.equal(s.cwd, '/home/user/project');
});

test('claude-code adapter: title prefers custom-title, then ai-title, then first message', () => {
  assert.equal(parse(mainSession()).title, '把测试跑通');
  const noCustom = mainSession().filter((l) => !l.includes('customTitle'));
  assert.equal(parse(noCustom).title, '修测试');
  const noTitles = noCustom.filter((l) => !l.includes('aiTitle'));
  assert.equal(parse(noTitles).title, '请帮我把测试跑通');
});

test('claude-code adapter: tool results pair with their calls (real block shape)', () => {
  const s = parse(mainSession());
  const all = tools(s);
  const done = all.filter((t) => t.callId !== 'call-004'); // the last bash has no result yet
  for (const t of done) {
    assert.notEqual(t.status, 'pending', t.name + ' should be settled');
    assert.ok(t.output, t.name + ' should have the block output');
  }
  assert.equal(all[0]!.family, 'shell');
  assert.equal(all[1]!.family, 'patch');
  assert.match(all[0]!.output ?? '', /1 failing/);
  const stillOpen = all.find((t) => t.callId === 'call-004')!;
  assert.equal(stillOpen.status, 'pending');
});

test('claude-code adapter: thinking becomes reasoning; usage closes the model call', () => {
  const s = parse(mainSession());
  const first = models(s)[0];
  assert.match(first.reasoning ?? '', /先看测试文件/);
  assert.equal(first.usage?.input, 1000);
  assert.equal(first.usage?.cachedInput, 500);
  assert.ok(first.endAt, 'usage record closes the model step');
});

test('claude-code adapter: two turns, turn 2 running', () => {
  const s = parse(mainSession());
  assert.equal(s.turns.length, 2);
  assert.equal(s.turns[0].status, 'completed');
  assert.equal(s.turns[1].status, 'running');
  assert.ok(s.turns[0].output, 'turn output filled from the last model text');
});

test('claude-code adapter: cost-state reaches the stats and usage', () => {
  const s = parse(mainSession());
  assert.ok(Math.abs((s.stats.costUsd ?? 0) - 0.084) < 1e-9);
  assert.equal(s.stats.linesAdded, 3);
  assert.equal(s.stats.linesRemoved, 1);
  assert.equal(s.usage?.input, 3000);
});

test('claude-code adapter: queued command, context wrapper, sub-agent count, sidechain skip', () => {
  const s = parse([...mainSession(), sidechainLine(), contextLine()]);
  assert.ok(texts(s, 'user').some((t) => t.startsWith('[排队] 顺便看看 lint')), 'queued prompt kept as a user message');
  assert.ok(s.turns.flatMap((t) => t.steps).some((st) => st.kind === 'message' && st.role === 'context' && st.text.includes('command-name')), 'wrapper text is context, not input');
  assert.equal(s.stats.subagents, 1, 'the Task call counts as a sub-agent');
  assert.ok(!JSON.stringify(s.turns).includes('子线程'), 'sidechain content stays out');
  assert.deepEqual(validateSessionDoc({ contract: CONTRACT_VERSION, session: s }), []);
});

test('claude-code adapter: empty session', () => {
  const s = parse(emptySession());
  assert.deepEqual(validateSessionDoc({ contract: CONTRACT_VERSION, session: s }), []);
  assert.equal(s.turns.length, 0);
  assert.equal(s.state.status, 'empty');
});

test('claude-code adapter: child session has model and title from agent-name', () => {
  const p = claudeCodeAdapter.createParser({ path: '.claude/projects/test/child.jsonl' });
  for (const l of childSession()) p.push(l);
  const s = p.finish({ now: Date.now() });
  assert.deepEqual(validateSessionDoc({ contract: CONTRACT_VERSION, session: s }), []);
  assert.ok(s.turns.length >= 1);
  assert.equal(s.title, 'Skill理解');
  assert.match(s.agent.originator ?? '', /Desktop/);
});

test('claude-code adapter: stale state when the file is old and a turn is open', () => {
  const s = parse(mainSession(), { mtimeMs: Date.now() - 60 * 60 * 1000, now: Date.now() });
  assert.equal(s.state.status, 'stale');
});
