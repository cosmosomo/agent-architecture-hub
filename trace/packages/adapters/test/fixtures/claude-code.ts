/**
 * Hand-made Claude Code session records in the shape really written to
 * `~/.claude/projects/<encoded-path>/<sessionId>.jsonl` (field names verified
 * against a real home directory; no real session content). Tool results are
 * blocks inside user entries — there is no top-level tool_result record.
 */

export const MAIN_ID = 'ccfix-0000-0000-0000-000000000001';
export const CHILD_ID = 'ccfix-0000-0000-0000-000000000002';

const T0 = Date.parse('2026-10-10T09:00:00.000Z');
const at = (sec: number) => new Date(T0 + sec * 1000).toISOString();
let _seq = 0;
const uuid = () => 'uuid-' + String(++_seq).padStart(4, '0');
const base = (sec: number, extra?: object) => ({
  uuid: uuid(), parentUuid: null, isSidechain: false,
  timestamp: at(sec), sessionId: MAIN_ID, entrypoint: 'cli', version: '2.0.14',
  cwd: '/home/user/project', ...extra,
});

const user = (sec: number, content: unknown, extra?: object) => JSON.stringify(
  base(sec, { type: 'user', message: { role: 'user', content }, ...extra }));

const assistant = (sec: number, content: unknown, model = 'claude-opus-5-5', usage?: object, extra?: object) => JSON.stringify(
  base(sec, { type: 'assistant', message: { role: 'assistant', content, model, ...(usage ? { usage } : {}) }, ...extra }));

/** A tool result the way Claude Code writes it: a user entry holding a tool_result block. */
const toolResult = (sec: number, callId: string, content: unknown, isError = false, extra?: object) => JSON.stringify(
  base(sec, { type: 'user', message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: callId, content, is_error: isError }] }, ...extra }));

const meta = (sec: number, type: string, fields: object = {}) => JSON.stringify(base(sec, { type, ...fields }));

/** Main session: two turns. Turn 1 thinks, runs bash, patches, answers. Turn 2 is running. */
export function mainSession(): string[] {
  return [
    // meta noise — filtered without a note
    meta(0, 'queue-operation', { queue: [] }),
    meta(0, 'progress', { progress: 10 }),
    meta(0, 'permission-mode', { permissionMode: 'auto' }),
    // a message the user typed while turn 0 was busy
    meta(1, 'attachment', { attachment: { type: 'queued_command', queuedCommand: { prompt: '顺便看看 lint' } } }),
    // titles: the desktop one wins over the AI one, both over the first message
    meta(1, 'ai-title', { aiTitle: '修测试' }),
    meta(1, 'custom-title', { customTitle: '把测试跑通' }),
    // turn 1
    user(2, '请帮我把测试跑通'),
    assistant(3, [
      { type: 'thinking', thinking: '先看测试文件，再决定改哪里。', signature: 'sig-abc' },
      { type: 'text', text: '好的，我先看看测试文件。' },
      { type: 'tool_use', id: 'call-001', name: 'execute_bash', input: { command: 'npm test' } },
    ], 'claude-opus-5-5', { input_tokens: 1000, output_tokens: 200, cache_read_input_tokens: 500 }),
    toolResult(5, 'call-001', [{ type: 'text', text: '1 failing: expect(1).toBe(2)' }], false, { toolUseResult: { stdout: '1 failing: expect(1).toBe(2)', stderr: '', interrupted: false } }),
    assistant(6, [
      { type: 'text', text: '找到问题了，修一下。' },
      { type: 'tool_use', id: 'call-002', name: 'str_replace', input: { file_path: 'src/calc.ts', old_string: 'return 1', new_string: 'return 2' } },
    ]),
    toolResult(8, 'call-002', 'The file is updated'),
    // a sub-agent spawned to review, and its result
    assistant(8.5, [
      { type: 'tool_use', id: 'call-003', name: 'Task', input: { prompt: 'review the fix', subagent_type: 'reviewer' } },
    ]),
    toolResult(9, 'call-003', '改得没问题'),
    assistant(10, [
      { type: 'text', text: '已修复，测试现在通过了。' },
    ], 'claude-opus-5-5', { input_tokens: 2000, output_tokens: 300 }),
    // cost summary the CLI writes
    meta(10, 'cost-state', {
      totalCostUSD: 0.084, totalLinesAdded: 3, totalLinesRemoved: 1,
      modelUsage: { 'claude-opus-5-5': { inputTokens: 3000, outputTokens: 500, cacheReadTokens: 500, cacheCreationInputTokens: 0 } },
    }),
    // turn 2: still running (no closing usage record)
    user(20, '再检查一下 lint'),
    assistant(21, [
      { type: 'text', text: '正在跑 lint…' },
      { type: 'tool_use', id: 'call-004', name: 'execute_bash', input: { command: 'npm run lint' } },
    ]),
  ];
}

/** A record from another thread in the same file (sub-agent sidechain): skipped. */
export function sidechainLine(): string {
  return JSON.stringify(base(4, { type: 'assistant', isSidechain: true, sessionId: 'side-0001', message: { role: 'assistant', content: '子线程的内容' } }));
}

/** Client wrapper text: shown as context, not as turn input. */
export function contextLine(): string {
  return user(19, '<command-name>/clear</command-name><command-message>clear</command-message>');
}

/** Child session in the desktop app. */
export function childSession(): string[] {
  return [
    meta(30, 'agent-name', { agentName: 'Skill理解', entrypoint: 'claude-desktop' }),
    user(30, '请帮我写单元测试', { sessionId: CHILD_ID, entrypoint: 'claude-desktop' }),
    assistant(31, [
      { type: 'text', text: '好的，这是测试代码。' },
    ], 'claude-sonnet-5-5', { input_tokens: 800, output_tokens: 120 }, { sessionId: CHILD_ID }),
  ];
}

/** Session with no turns (empty). */
export function emptySession(): string[] {
  return [meta(0, 'queue-operation', { queue: [] })];
}
