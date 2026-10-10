/**
 * Hand-made Claude Code session records in the shape written by the desktop app / CLI
 * (`~/.claude/projects/<encoded-path>/<sessionId>.jsonl`). No real session content.
 * Each line is a JSON object with uuid, parentUuid, sessionId, timestamp, type, etc.
 */

export const MAIN_ID = 'ccfix-0000-0000-0000-000000000001';
export const CHILD_ID = 'ccfix-0000-0000-0000-000000000002';

const T0 = Date.parse('2026-10-10T09:00:00.000Z');
const at = (sec: number) => new Date(T0 + sec * 1000).toISOString();
let _seq = 0;
const uuid = () => 'uuid-' + String(++_seq).padStart(4, '0');

const user = (sec: number, text: string, extra?: object) => JSON.stringify({
  type: 'user', uuid: uuid(), parentUuid: null, isSidechain: false,
  message: { role: 'user', content: text },
  timestamp: at(sec), sessionId: MAIN_ID, entrypoint: 'cli',
  cwd: '/home/user/project', ...extra,
});

const assistant = (sec: number, content: unknown, model = 'claude-opus-5-5', extra?: object) => JSON.stringify({
  type: 'assistant', uuid: uuid(), parentUuid: null, isSidechain: false,
  message: { role: 'assistant', content, model, usage: { input_tokens: 1000, output_tokens: 200, total_tokens: 1200 } },
  timestamp: at(sec), sessionId: MAIN_ID, entrypoint: 'cli', ...extra,
});

const toolResult = (sec: number, callId: string, output: string, isError = false) => JSON.stringify({
  type: 'tool_result', uuid: uuid(), parentUuid: null, isSidechain: false,
  toolUseResult: { tool_use_id: callId, content: output, isError },
  timestamp: at(sec), sessionId: MAIN_ID, entrypoint: 'cli',
});

const system = (sec: number, msgType: string) => JSON.stringify({
  type: msgType, uuid: uuid(), timestamp: at(sec), sessionId: MAIN_ID,
});

/** Main session: two turns. Turn 1 reads a file, patches it, returns. Turn 2 is running. */
export function mainSession(): string[] {
  return [
    // system noise — should be filtered out
    system(0, 'queue-operation'),
    system(1, 'progress'),
    // turn 1: user asks, model calls a tool, result comes back, model replies
    user(2, '请帮我把测试跑通'),
    assistant(3, [
      { type: 'text', text: '好的，我先看看测试文件。' },
      { type: 'tool_use', id: 'call-001', name: 'execute_bash', input: { command: 'npm test' } },
    ]),
    toolResult(5, 'call-001', '1 failing: expect(1).toBe(2)'),
    assistant(6, [
      { type: 'text', text: '找到问题了，修一下。' },
      { type: 'tool_use', id: 'call-002', name: 'str_replace', input: { file_path: 'src/calc.ts', old_string: 'return 1', new_string: 'return 2' } },
    ]),
    toolResult(8, 'call-002', 'ok'),
    assistant(9, [
      { type: 'text', text: '已修复，测试现在通过了。', },
    ], 'claude-opus-5-5'),
    // turn 2: still running
    user(20, '再检查一下 lint'),
    assistant(21, [
      { type: 'text', text: '正在跑 lint…' },
      { type: 'tool_use', id: 'call-003', name: 'execute_bash', input: { command: 'npm run lint' } },
    ]),
    // no tool result yet — turn is open / running
  ];
}

/** Child sub-agent session (sub-agent role). */
export function childSession(): string[] {
  return [
    user(30, '请帮我写单元测试', { sessionId: CHILD_ID, entrypoint: 'claude-desktop' }),
    assistant(31, [
      { type: 'text', text: '好的，这是测试代码。' },
    ], 'claude-sonnet-5-5', { sessionId: CHILD_ID }),
  ];
}

/** Session with no turns (empty). */
export function emptySession(): string[] {
  return [system(0, 'queue-operation')];
}
