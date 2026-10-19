import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readAgyTranscript } from '../src/gateway/antigravity.ts';

// Records shaped like a real brain/<cid>/.system_generated/logs/transcript.jsonl (seen 10-19).
const sys = (sender: string, content: string) =>
  `The following is a <SYSTEM_MESSAGE> not actually sent by the user.\n\n<SYSTEM_MESSAGE>\n[Message] timestamp=2026-10-18T18:30:22Z sender=${sender} priority=MESSAGE_PRIORITY_HIGH content=${content}\n</SYSTEM_MESSAGE>`;
const rec = (o: object) => JSON.stringify(o);
const lines = [
  rec({ step_index: 1, source: 'USER_EXPLICIT', type: 'USER_INPUT', status: 'DONE', created_at: '2026-10-18T13:00:00Z', content: '<USER_REQUEST>\n读一下目录\n</USER_REQUEST>' }),
  rec({
    step_index: 2, source: 'MODEL', type: 'PLANNER_RESPONSE', status: 'DONE', created_at: '2026-10-18T13:00:05Z', thinking: '先看看', input_tokens: 100, output_tokens: 20,
    tool_calls: [
      { name: 'view_file', args: { AbsolutePath: '"E:\\\\a.md"' } },
      { name: 'run_command', args: { CommandLine: '"dir"', Cwd: '"E:\\\\program\\\\x"', WaitMsBeforeAsync: '500' } },
    ],
  }),
  rec({ step_index: 3, source: 'MODEL', type: 'GENERIC', status: 'DONE', created_at: '2026-10-18T13:00:06Z', content: 'a.md 的内容' }),
  rec({ step_index: 4, source: 'MODEL', type: 'GENERIC', status: 'RUNNING', created_at: '2026-10-18T13:00:06Z', content: 'Tool is running as a background task' }),
  rec({ step_index: 5, source: 'MODEL', type: 'PLANNER_RESPONSE', status: 'DONE', created_at: '2026-10-18T13:00:09Z', tool_calls: [{ name: 'grep_search', args: { Query: '"x"' } }] }),
  rec({ step_index: 6, source: 'MODEL', type: 'GENERIC', status: 'DONE', created_at: '2026-10-18T13:00:10Z', error: 'no such file' }),
  rec({ step_index: 7, source: 'SYSTEM', type: 'ERROR_MESSAGE', status: 'DONE', created_at: '2026-10-18T13:00:11Z', error: 'API error (attempt 1): request failed: EOF' }),
  rec({ step_index: 8, source: 'SYSTEM', type: 'ERROR_MESSAGE', status: 'DONE', created_at: '2026-10-18T13:00:13Z', error: 'API error (attempt 2): request failed: EOF' }),
  rec({ step_index: 9, source: 'SYSTEM', type: 'SYSTEM_MESSAGE', status: 'DONE', created_at: '2026-10-18T13:01:00Z', content: sys('system', 'The subagent 调研专家 (research) with id "85699ef4" encountered an error') }),
  rec({ step_index: 10, source: 'SYSTEM', type: 'SYSTEM_MESSAGE', status: 'DONE', created_at: '2026-10-18T13:01:01Z', content: sys('e5114178/task-12', 'Task id "e5114178/task-12" finished') }),
  rec({ step_index: 11, source: 'SYSTEM', type: 'SYSTEM_MESSAGE', status: 'DONE', created_at: '2026-10-18T13:02:00Z', content: sys('system', '接着做第二步') }),
  rec({ step_index: 12, source: 'MODEL', type: 'PLANNER_RESPONSE', status: 'DONE', created_at: '2026-10-18T13:02:05Z', content: '做完了' }),
  'not json',
];

test('one reader: who said what, model steps with their results, events', () => {
  const { entries, firstAt, lastAt } = readAgyTranscript(lines);
  assert.equal(firstAt, '2026-10-18T13:00:00Z');
  assert.equal(lastAt, '2026-10-18T13:02:05Z');
  assert.deepEqual(
    entries.map((e) => (e.kind === 'event' ? `event:${e.name}` : e.kind)),
    ['user', 'model', 'model', 'event:error', 'event:subagent', 'event:note', 'user', 'model'],
  );
  assert.equal((entries[0] as any).text, '读一下目录');
  assert.equal((entries[6] as any).text, '接着做第二步', 'words sent from outside are a person speaking');
});

test('tool results pair with their calls in order; ids stay unique across steps', () => {
  const models = readAgyTranscript(lines).entries.filter((e) => e.kind === 'model') as any[];
  const [view, run] = models[0].calls;
  const [grep] = models[1].calls;
  assert.equal(view.output, 'a.md 的内容');
  assert.equal(run.background, true);
  assert.equal(grep.error, true);
  assert.equal(grep.output, 'no such file');
  assert.deepEqual([view.id, run.id, grep.id], ['agy_2_1', 'agy_2_2', 'agy_5_1']);
  assert.deepEqual(models[0].usage, { input: 100, cached: 0, output: 20 });
});

test('argument values are unwrapped once, so the folder is a real path', () => {
  const run = (readAgyTranscript(lines).entries[1] as any).calls[1];
  assert.equal(run.args.Cwd, 'E:\\program\\x');
  assert.equal(run.args.WaitMsBeforeAsync, 500);
  assert.match(run.input, /"Cwd": "E:\\\\program\\\\x"/);
});

test('retries of one request fold into one error with the latest attempt', () => {
  const errors = readAgyTranscript(lines).entries.filter((e) => e.kind === 'event' && e.name === 'error') as any[];
  assert.equal(errors.length, 1);
  assert.match(errors[0].text, /attempt 2/);
});
