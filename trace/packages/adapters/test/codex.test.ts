import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONTRACT_VERSION, validateSessionDoc, type ModelStep, type Session, type ToolStep } from '@hub-trace/contract';
import { adapterForFile, codexAdapter, maskSecrets, parseText } from '../src/index.ts';
import { BROKEN_ID, CHILD_ID, FIXTURE_T0, LEGACY_ID, MAIN_ID, brokenSession, childSession, legacySession, mainSession } from './fixtures/codex.ts';

const MIN = 60 * 1000;

function parse(lines: string[], opts: { mtimeMs?: number; now?: number } = {}): Session {
  const p = codexAdapter.createParser({ path: 'rollout-test.jsonl', mtimeMs: opts.mtimeMs });
  for (const l of lines) p.push(l);
  return p.finish({ now: opts.now ?? Date.now() });
}

const tools = (s: Session) => s.turns.flatMap((t) => t.steps).filter((x): x is ToolStep => x.kind === 'tool');
const models = (s: Session) => s.turns.flatMap((t) => t.steps).filter((x): x is ModelStep => x.kind === 'model');

test('main session: identity, turns, steps', () => {
  const s = parse(mainSession());
  assert.deepEqual(validateSessionDoc({ contract: CONTRACT_VERSION, session: s }), []);
  assert.equal(s.id, 'codex:' + MAIN_ID);
  assert.equal(s.source.format, 'codex/envelope');
  assert.equal(s.source.version, '0.140.0');
  assert.equal(s.title, '请把购物车的测试跑通');
  assert.equal(s.agent.role, 'main');
  assert.equal(s.agent.model, 'gpt-6.1-sol');
  assert.equal(s.agent.provider, 'openai');
  assert.equal(s.turns.length, 2);

  const [t1, t2] = s.turns;
  assert.equal(t1.status, 'completed');
  assert.equal(t1.durationMs, 42000);
  assert.equal(t1.firstTokenMs, 800);
  assert.equal(t1.input, '请把购物车的测试跑通');
  assert.match(t1.output || '', /测试已全部通过/);
  assert.equal(t1.settings?.effort, 'high');
  assert.equal(t2.settings?.effort, 'medium');
  assert.equal(t2.status, 'running');

  const roles = t1.steps.filter((x) => x.kind === 'message').map((x) => (x.kind === 'message' ? x.role : ''));
  assert.deepEqual(roles, ['developer', 'context', 'user']);
  assert.equal(models(s).length, 7);
  assert.equal(s.stats.modelCalls, 7);
  assert.equal(s.stats.toolCalls, 6);
});

test('main session: model calls carry reasoning, text, usage and the tools they asked for', () => {
  const s = parse(mainSession());
  const [m1, m2] = models(s);
  assert.equal(m1.reasoning, '先跑一遍测试，看失败在哪里。');
  assert.equal(m1.text, '我先运行测试。');
  assert.equal(m1.phase, 'commentary');
  assert.equal(m1.responseId, 'resp-1');
  assert.deepEqual(m1.usage, { input: 12000, cachedInput: 8000, cacheWrite: 0, output: 300, reasoning: 120, total: 12300 });
  assert.equal(m1.at, '2026-10-10T08:00:02.000Z', 'a call starts at its last input');
  assert.equal(m1.endAt, '2026-10-10T08:00:05.000Z');
  assert.deepEqual(m1.calls, ['tool:call-1']);
  assert.equal(m2.reasoningHidden, true);
  assert.equal(m2.reasoning, undefined);
  const final = models(s).find((m) => m.phase === 'final');
  assert.match(final?.text || '', /tester 补了 3 个边界用例/);
});

test('main session: tool results, effects, plan and sub-agents', () => {
  const s = parse(mainSession());
  const byCall = new Map(tools(s).map((t) => [t.callId, t]));
  const run = byCall.get('call-1')!;
  assert.equal(run.family, 'shell');
  assert.equal(run.status, 'error');
  assert.equal(run.exitCode, 1);
  assert.equal(run.durationMs, 4000);
  assert.equal(run.effects[0].kind, 'command');
  assert.equal(run.effects[0].label, 'npm test');
  assert.equal(run.effects[0].durationMs, 3500);
  assert.match(run.output || '', /API_KEY=\[已打码\]/);
  assert.doesNotMatch(run.output || '', /abcd1234efgh5678ijkl/);

  const plan = byCall.get('call-2')!;
  assert.equal(plan.family, 'plan');
  assert.deepEqual(plan.todos, [{ title: '修正折扣计算', status: 'in_progress' }, { title: '重跑测试', status: 'pending' }]);

  const patch = byCall.get('call-3')!;
  assert.equal(patch.family, 'patch');
  assert.equal(patch.status, 'ok');
  assert.equal(patch.effects[0].kind, 'file');
  assert.equal(patch.effects[0].label, 'cart.ts');
  assert.match(patch.effects[0].detail || '', /return sum - discount/);

  const spawn = byCall.get('call-4')!;
  assert.equal(spawn.family, 'agent');
  assert.deepEqual(spawn.agents, ['codex:' + CHILD_ID]);
  assert.equal(spawn.effects[0].kind, 'subagent');
  assert.equal(spawn.effects[0].ref, 'codex:' + CHILD_ID);

  const wait = byCall.get('call-5')!;
  assert.equal(wait.status, 'ok');
  assert.equal(wait.effects[0].label, '完成 /root/tester');

  assert.deepEqual(s.links, [{ rel: 'child', id: 'codex:' + CHILD_ID, label: '/root/tester' }]);
  assert.equal(s.stats.subagents, 1);
  assert.equal(s.stats.toolErrors, 1);
});

test('main session: usage, rate limits and state', () => {
  const end = Date.parse('2026-10-10T08:01:42.000Z');
  const working = parse(mainSession(), { mtimeMs: end, now: end + 2 * MIN });
  assert.deepEqual(working.state, { status: 'working', since: '2026-10-10T08:01:42.000Z', detail: '在执行 exec' });
  assert.equal(working.usage?.total, 93380);
  assert.deepEqual(working.limits?.map((l) => [l.name, l.usedPercent, l.windowMinutes]), [['primary', 12.5, 300], ['secondary', 40, 10080]]);
  const stale = parse(mainSession(), { mtimeMs: end, now: end + 3 * 60 * MIN });
  assert.equal(stale.state.status, 'stale');
  assert.match(stale.state.detail || '', /3 小时/);
  const pending = tools(stale).find((t) => t.callId === 'call-6')!;
  assert.equal(pending.status, 'pending', 'a call in a still-open turn stays pending');
});

test('child session: sub-agent identity, inherited context, parent link', () => {
  const s = parse(childSession(), { now: FIXTURE_T0 + 60 * MIN });
  assert.deepEqual(validateSessionDoc({ contract: CONTRACT_VERSION, session: s }), []);
  assert.equal(s.id, 'codex:' + CHILD_ID, 'the first session_meta is the session itself');
  assert.equal(s.agent.role, 'subagent');
  assert.equal(s.agent.name, 'tester');
  assert.equal(s.agent.path, '/root/tester');
  assert.equal(s.agent.model, 'gpt-6-luna');
  assert.equal(s.title, 'tester：给折扣计算补边界用例');
  assert.deepEqual(s.links, [{ rel: 'parent', id: 'codex:' + MAIN_ID }]);
  assert.equal(s.turns.length, 2);
  assert.equal(s.turns[0].inferred, true, 'records before the first task form an inferred turn');
  assert.deepEqual(s.turns[0].steps.map((x) => x.kind), ['event', 'message']);
  const agentMsg = s.turns[1].steps[0];
  assert.equal(agentMsg.kind, 'message');
  if (agentMsg.kind === 'message') {
    assert.equal(agentMsg.role, 'agent');
    assert.equal(agentMsg.from, '/root');
    assert.equal(agentMsg.to, '/root/tester');
  }
  assert.equal(s.turns[1].input, '给折扣计算补边界用例');
  assert.equal(s.state.status, 'idle');
  assert.equal(s.stats.compactions, 1);
});

test('legacy session: inferred turns, shell exit codes, skipped lines', () => {
  const s = parse(legacySession());
  assert.deepEqual(validateSessionDoc({ contract: CONTRACT_VERSION, session: s }), []);
  assert.equal(s.id, 'codex:' + LEGACY_ID);
  assert.equal(s.source.format, 'codex/legacy');
  assert.equal(s.startedAt, '2025-05-01T10:00:00.000Z');
  assert.equal(s.title, '列出当前目录的文件');
  assert.equal(s.stats.skipped, 1);
  assert.equal(s.turns.length, 2);
  assert.ok(s.turns.every((t) => t.inferred && t.status === 'completed'));
  const [ls, rm] = tools(s);
  assert.equal(ls.exitCode, 0);
  assert.equal(ls.status, 'ok');
  assert.equal(ls.output, 'a.txt\n');
  assert.equal(ls.durationMs, 100);
  assert.equal(rm.exitCode, 1);
  assert.equal(rm.status, 'error');
  assert.equal(s.turns[1].output, '删除失败：没有权限。');
  assert.equal(s.state.status, 'idle');
});

test('broken session: interrupted turn closes its running command, failed turn sets the state', () => {
  const s = parse(brokenSession());
  assert.deepEqual(validateSessionDoc({ contract: CONTRACT_VERSION, session: s }), []);
  assert.equal(s.id, 'codex:' + BROKEN_ID);
  const [a, b] = s.turns;
  assert.equal(a.status, 'aborted');
  assert.equal(a.error, '被打断');
  const dev = tools(s)[0];
  assert.equal(dev.status, 'error');
  assert.match(dev.output || '', /被打断/);
  assert.equal(b.status, 'failed');
  assert.equal(b.error, 'stream disconnected before completion');
  assert.equal(s.state.status, 'failed');
  assert.equal(s.agent.originator, 'codex_vscode');
});

test('a command that finishes after its call returned attaches to that call', () => {
  const lines = mainSession().slice(0, 18);
  lines.push(JSON.stringify({ timestamp: '2026-10-10T08:00:10.000Z', type: 'event_msg', payload: { type: 'item_completed', item: { type: 'CommandExecution', id: 'exec-late', command: ['bash', '-lc', 'npm run watch'], status: 'failed', exit_code: 2, duration: { secs: 1, nanos: 0 } } } }));
  const s = parse(lines);
  const run = tools(s).find((t) => t.callId === 'call-1')!;
  assert.equal(run.effects.length, 2);
  assert.equal(run.effects[1].late, true);
  assert.equal(run.effects[1].label, 'npm run watch');
  assert.deepEqual(s.notes, []);
});

test('unknown record kinds become notes, not errors', () => {
  const lines = mainSession().slice(0, 3).concat([
    JSON.stringify({ timestamp: '2026-10-10T08:00:03.000Z', type: 'event_msg', payload: { type: 'brand_new_event' } }),
    JSON.stringify({ timestamp: '2026-10-10T08:00:03.000Z', type: 'mystery', payload: {} }),
  ]);
  const s = parse(lines);
  assert.deepEqual(s.notes, ['未识别 event:brand_new_event × 1', '未识别 record:mystery × 1']);
});

test('parsing is deterministic', () => {
  const a = parse(mainSession(), { mtimeMs: 1, now: 2 });
  const b = parse(mainSession(), { mtimeMs: 1, now: 2 });
  assert.deepEqual(a, b);
});

test('adapter registry and whole-text parsing', () => {
  assert.equal(adapterForFile('C:\\Users\\x\\.codex\\sessions\\2026\\10\\10\\rollout-2026-10-10T08-00-00-abc.jsonl'), codexAdapter);
  assert.equal(adapterForFile('/home/x/.codex/sessions/2026/10/10/notes.jsonl'), undefined);
  const s = parseText(codexAdapter, mainSession().join('\n'));
  assert.equal(s.turns.length, 2);
});

test('secret masking', () => {
  const raw = [
    'key sk-proj-ABCDEFGHIJKLMNOPQRSTUV and ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZ012345',
    'Authorization: Bearer abcdefghijklmnopqrstuvwxyz123456',
    'password = "hunter2hunter2"',
    'url https://user:pa55word@example.com/x',
    'img data:image/png;base64,' + 'A'.repeat(80),
  ].join('\n');
  const out = maskSecrets(raw);
  for (const leaked of ['sk-proj-ABCDEFGHIJKLMNOPQRSTUV', 'ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZ012345', 'abcdefghijklmnopqrstuvwxyz123456', 'hunter2hunter2', 'pa55word', 'AAAAAAAAAAAAAAAA']) {
    assert.ok(!out.includes(leaked), 'leaked ' + leaked);
  }
  assert.match(out, /\[图片\]/);
});
