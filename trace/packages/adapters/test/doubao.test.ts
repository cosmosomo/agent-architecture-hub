import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONTRACT_VERSION, validateSessionDoc } from '@hub-trace/contract';
import { doubaoAdapter, ADAPTERS } from '../src/index.ts';

const root = '/home/user/AppData/Local/Doubao/User Data/Default/.doubao/agent_mode/workspace/.sessions/123';
const main = root + '/agents/m_main/system/assignment.md';
const organizer = root + '/agents/o_org/system/assignment.md';
const child = root + '/agents/s_child/system/assignment.md';
const stamp = '2026-10-19T01:02:03.000Z';
const assignment = `## [${stamp}] 需求\n原话一\n## [2026-10-19T02:00:00Z] 需求\n原话二`;
function parse(rows: unknown[], marker = main, extra: Record<string, string> = {}) {
  const files: Record<string, string> = {
    [main]: assignment,
    [marker]: assignment,
    [marker.replace('assignment.md', 'trajectory.jsonl')]: rows.map((r) => typeof r === 'string' ? r : JSON.stringify(r)).join('\n'),
    ...extra,
  };
  const members = doubaoAdapter.bundleMembers!(marker, Object.keys(files));
  return doubaoAdapter.parseBundle!({ path: marker, mtimeMs: Date.parse(stamp) }, {
    files: members, read(path) { assert.ok(path in files); return files[path]; },
  }, { now: Date.parse(stamp) });
}

test('Doubao registration selects assignment markers and only their own trajectory', () => {
  assert.ok(ADAPTERS.includes(doubaoAdapter));
  assert.equal(doubaoAdapter.matchFile(main), true);
  assert.equal(doubaoAdapter.matchFile(main.replace('assignment.md', 'trajectory.jsonl')), false);
  const other = child.replace('assignment.md', 'trajectory.jsonl');
  const members = doubaoAdapter.bundleMembers!(main, [main, child, other]);
  assert.deepEqual(members, [main, child]);
});

test('full user words, replies and tool input/output survive without display truncation', () => {
  const long = '原话'.repeat(7000);
  const input = JSON.stringify({ command: long });
  const session = parse([
    { role: 'user', content: long },
    { role: 'assistant', content: '先执行', tool_calls: [{ id: 'call1', function: { name: 'Bash', arguments: input } }] },
    { role: 'tool', tool_call_id: 'call1', content: long },
    { role: 'assistant', content: long },
    { role: 'user', content: '原话二' },
    { role: 'assistant', content: '回复二' },
  ]);
  assert.deepEqual(validateSessionDoc({ contract: CONTRACT_VERSION, session }), []);
  assert.equal(session.id, 'doubao-desktop:123');
  assert.equal(session.turns.length, 2);
  assert.equal(session.turns[0].input, long);
  assert.equal(session.turns[0].output, long);
  const tool = session.turns[0].steps.find((s) => s.kind === 'tool')!;
  assert.equal(tool.kind, 'tool');
  if (tool.kind === 'tool') {
    assert.equal(tool.input, input);
    assert.equal(tool.output, long);
    assert.equal(tool.status, 'ok');
  }
  assert.equal(session.state.status, 'idle');
  assert.equal(session.capabilities?.control_lifecycle.resume, false);
});

test('system records remain context; original timestamps only match user requirements', () => {
  const session = parse([{ role: 'system', content: '系统说明' }, { role: 'user', content: '原话一' }, { role: 'assistant', content: '回复' }]);
  assert.equal(session.turns[0].steps[0].kind, 'message');
  assert.equal((session.turns[0].steps[0] as any).role, 'context');
  assert.equal(session.turns[1].startedAt, stamp);
  assert.equal(session.turns[1].steps.find((s) => s.kind === 'model')?.at, stamp);
  assert.equal(session.stats.skipped, 0);
});

test('organizers and subagents have distinct IDs and native parent links', () => {
  const session = parse([], child, { [child]: `# Assignment\n- Assigned by: o_org\n${assignment}`, [organizer]: assignment });
  assert.equal(session.id, 'doubao-desktop:123:s_child');
  assert.equal(session.agent.role, 'subagent');
  assert.deepEqual(session.links, [{ rel: 'parent', id: 'doubao-desktop:123:o_org' }]);
  assert.equal(parse([], organizer).links[0].id, 'doubao-desktop:123');
});

test('pending tool remains pending and state does not claim a live process', () => {
  const session = parse([{ role: 'user', content: '原话一' }, { role: 'assistant', content: '', tool_calls: [{ id: 'c', function: { name: 'Read', arguments: '{}' } }] }]);
  assert.equal(session.state.status, 'stale');
  assert.equal(session.turns[0].steps.find((s) => s.kind === 'tool')?.status, 'pending');
});

test('malformed JSONL and unrecognized roles fail with source location', () => {
  assert.throws(() => parse(['{invalid']), /trajectory.jsonl:1/);
  assert.throws(() => parse([{ role: 'surprise' }]), /Unsupported Doubao record/);
});

test('secrets are masked while ordinary original wording remains', () => {
  const session = parse([{ role: 'user', content: '请使用 sk-abcdefghijklmnopqrstuvwxyz 读取文档' }]);
  assert.equal(session.turns[0].input, '请使用 [已打码] 读取文档');
});
