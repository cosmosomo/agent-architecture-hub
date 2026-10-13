/**
 * Hand-made Codex sessions in the shapes recorded in docs/ARCHITECTURE.md. No real
 * session content: tests and the viewer demo use only these.
 * `node packages/adapters/test/fixtures/write.ts` writes them as .jsonl files.
 */

export const MAIN_ID = '0199aaaa-0000-7000-8000-000000000001';
export const CHILD_ID = '0199aaaa-0000-7000-8000-000000000002';
export const LEGACY_ID = '0199aaaa-0000-7000-8000-000000000003';
export const BROKEN_ID = '0199aaaa-0000-7000-8000-000000000004';

const T0 = Date.parse('2026-10-10T08:00:00.000Z');
const at = (sec: number) => new Date(T0 + sec * 1000).toISOString();
const usage = (input: number, cached: number, output: number, reasoning: number) => ({
  input_tokens: input,
  cached_input_tokens: cached,
  cache_write_input_tokens: 0,
  output_tokens: output,
  reasoning_output_tokens: reasoning,
  total_tokens: input + output,
});
const rec = (sec: number, type: string, payload: object) => JSON.stringify({ timestamp: at(sec), type, payload });
const ev = (sec: number, payload: object) => rec(sec, 'event_msg', payload);
const ri = (sec: number, turn: string, payload: object) => rec(sec, 'response_item', { ...payload, internal_chat_message_metadata_passthrough: { turn_id: turn } });
const text = (t: string, kind = 'input_text') => [{ type: kind, text: t }];
const tur = (sec: number, turn: string, response: string, u: object, turnU: object, threadU: object) =>
  rec(sec, 'token_usage_record', { thread_id: MAIN_ID, turn_id: turn, session_id: MAIN_ID, root_turn_id: turn, response_id: response, usage: u, turn_token_usage: turnU, thread_token_usage: threadU });
const tokenCount = (sec: number, total: object, last: object) =>
  ev(sec, { type: 'token_count', info: { total_token_usage: total, last_token_usage: last, model_context_window: 272000 }, rate_limits: { limit_id: 'codex', primary: { used_percent: 12.5, window_minutes: 300, resets_at: 1791633600 }, secondary: { used_percent: 40, window_minutes: 10080, resets_at: 1792152000 } } });

/** Main agent: two turns. Turn 1 runs a failing test, updates the plan, patches a file, spawns a sub-agent, waits, answers. Turn 2 is still running. */
export function mainSession(): string[] {
  const t1 = 'turn-0001';
  const t2 = 'turn-0002';
  const u1 = usage(12000, 8000, 300, 120);
  const u2 = usage(12500, 12000, 80, 20);
  const u3 = usage(13000, 12400, 260, 40);
  const u4 = usage(13400, 12900, 90, 10);
  const u5 = usage(13600, 13300, 30, 0);
  const u6 = usage(14000, 13500, 60, 0);
  return [
    rec(0, 'session_meta', { session_id: MAIN_ID, id: MAIN_ID, timestamp: at(0), cwd: 'E:\\demo\\shop', originator: 'codex_cli_rs', cli_version: '0.140.0', source: 'cli', model_provider: 'openai' }),
    ev(0, { type: 'thread_settings_applied', thread_id: MAIN_ID, thread_settings: { model: 'gpt-6.1-sol', model_provider_id: 'openai', approval_policy: 'on-request', permission_profile: { type: 'workspace-write' }, reasoning_effort: 'high' } }),
    ev(1, { type: 'task_started', turn_id: t1, root_turn_id: t1, started_at: (T0 + 1000) / 1000, model_context_window: 272000 }),
    ri(1, t1, { type: 'message', id: 'msg-dev-1', role: 'developer', content: text('<permissions instructions>只在工作区内写文件。</permissions instructions>') }),
    ri(1, t1, { type: 'message', id: 'msg-ctx-1', role: 'user', content: text('<environment_context>\n  <cwd>E:\\demo\\shop</cwd>\n</environment_context>') }),
    ri(2, t1, { type: 'message', id: 'msg-user-1', role: 'user', content: text('请把购物车的测试跑通') }),
    rec(2, 'world_state', { full: true, state: { environments: { subagents: '' } } }),
    rec(2, 'turn_context', { turn_id: t1, root_turn_id: t1, cwd: 'E:\\demo\\shop', approval_policy: 'on-request', sandbox_policy: { type: 'workspace-write' }, model: 'gpt-6.1-sol', effort: 'high', summary: 'detailed' }),
    ev(2, { type: 'item_completed', turn_id: t1, item: { type: 'UserMessage', id: 'um-1', content: [{ type: 'text', text: '请把购物车的测试跑通', text_elements: [] }] } }),
    ri(4, t1, { type: 'reasoning', id: 'rs-1', summary: [{ type: 'summary_text', text: '先跑一遍测试，看失败在哪里。' }], encrypted_content: 'ENCRYPTED' }),
    ev(4, { type: 'item_completed', turn_id: t1, item: { type: 'Reasoning', id: 'rs-1', summary_text: ['先跑一遍测试，看失败在哪里。'], raw_content: [] } }),
    ri(5, t1, { type: 'message', id: 'msg-a-1', role: 'assistant', phase: 'commentary', content: text('我先运行测试。', 'output_text') }),
    ri(5, t1, { type: 'custom_tool_call', id: 'ctc-1', status: 'completed', call_id: 'call-1', name: 'exec', input: 'npm test' }),
    tur(5, t1, 'resp-1', u1, u1, u1),
    ev(9, { type: 'item_completed', turn_id: t1, item: { type: 'CommandExecution', id: 'exec-1', process_id: '41', command: ['bash', '-lc', 'npm test'], cwd: 'E:\\demo\\shop', parsed_cmd: [{ type: 'unknown', cmd: 'npm test' }], source: 'unified_exec_startup', status: 'failed', stdout: '', stderr: '', aggregated_output: '', exit_code: 1, duration: { secs: 3, nanos: 500000000 }, formatted_output: '' } }),
    ri(9, t1, { type: 'custom_tool_call_output', id: 'ctco-1', call_id: 'call-1', output: text('Exit code: 1\nWall time: 3.5 seconds\nOutput:\nFAIL cart.test.ts\n  expected total 30, got 25\nAPI_KEY=abcd1234efgh5678ijkl\n') }),
    tokenCount(9, u1, u1),
    ri(11, t1, { type: 'reasoning', id: 'rs-2', summary: [], encrypted_content: 'ENCRYPTED' }),
    ri(11, t1, { type: 'function_call', id: 'fc-2', name: 'update_plan', arguments: JSON.stringify({ plan: [{ step: '修正折扣计算', status: 'in_progress' }, { step: '重跑测试', status: 'pending' }] }), call_id: 'call-2' }),
    tur(11, t1, 'resp-2', u2, usage(24500, 20000, 380, 140), usage(24500, 20000, 380, 140)),
    ri(11, t1, { type: 'function_call_output', id: 'fco-2', call_id: 'call-2', output: 'Plan updated' }),
    tokenCount(11, usage(24500, 20000, 380, 140), u2),
    ri(14, t1, { type: 'custom_tool_call', id: 'ctc-3', status: 'completed', call_id: 'call-3', name: 'apply_patch', input: '*** Begin Patch\n*** Update File: src/cart.ts\n@@\n-  return sum;\n+  return sum - discount;\n*** End Patch' }),
    tur(14, t1, 'resp-3', u3, usage(37500, 32400, 640, 180), usage(37500, 32400, 640, 180)),
    ev(15, { type: 'item_completed', turn_id: t1, item: { type: 'FileChange', id: 'patch-3', changes: { 'E:\\demo\\shop\\src\\cart.ts': { type: 'update', unified_diff: '@@ -10 +10 @@\n-  return sum;\n+  return sum - discount;', move_path: null } }, status: 'completed', stdout: '', stderr: '' } }),
    ri(15, t1, { type: 'custom_tool_call_output', id: 'ctco-3', call_id: 'call-3', output: text('Success. Updated the following files:\nM src/cart.ts') }),
    tokenCount(15, usage(37500, 32400, 640, 180), u3),
    ri(16, t1, { type: 'function_call', id: 'fc-4', name: 'spawn_agent', namespace: 'agents', arguments: JSON.stringify({ nickname: 'tester', message: '给折扣计算补边界用例' }), call_id: 'call-4' }),
    tur(16, t1, 'resp-4', u4, usage(50900, 45300, 730, 190), usage(50900, 45300, 730, 190)),
    ev(17, { type: 'item_completed', turn_id: t1, item: { type: 'CollabAgentToolCall', id: 'call-4', tool: 'spawn_agent', status: 'completed', sender_thread_id: MAIN_ID, receiver_thread_ids: [CHILD_ID], receiver_agents: [], agents_states: {} } }),
    ev(17, { type: 'item_completed', turn_id: t1, item: { type: 'SubAgentActivity', id: 'sa-1', kind: 'started', agent_thread_id: CHILD_ID, agent_path: '/root/tester' } }),
    ri(17, t1, { type: 'function_call_output', id: 'fco-4', call_id: 'call-4', output: JSON.stringify({ agent_id: CHILD_ID }) }),
    ri(18, t1, { type: 'function_call', id: 'fc-5', name: 'wait_agent', namespace: 'agents', arguments: JSON.stringify({ agents: [CHILD_ID] }), call_id: 'call-5' }),
    tur(18, t1, 'resp-5', u5, usage(64500, 58600, 760, 190), usage(64500, 58600, 760, 190)),
    ev(38, { type: 'item_completed', turn_id: t1, item: { type: 'SubAgentActivity', id: 'sa-2', kind: 'completed', agent_thread_id: CHILD_ID, agent_path: '/root/tester' } }),
    ri(38, t1, { type: 'function_call_output', id: 'fco-5', call_id: 'call-5', output: 'tester 完成：已添加 3 个用例，全部通过' }),
    ri(41, t1, { type: 'message', id: 'msg-a-2', role: 'assistant', phase: 'final_answer', content: text('测试已全部通过：修正了折扣计算，并由 tester 补了 3 个边界用例。', 'output_text') }),
    tur(41, t1, 'resp-6', u6, usage(78500, 72100, 820, 190), usage(78500, 72100, 820, 190)),
    tokenCount(41, usage(78500, 72100, 820, 190), u6),
    ev(43, { type: 'task_complete', turn_id: t1, last_agent_message: '测试已全部通过：修正了折扣计算，并由 tester 补了 3 个边界用例。', started_at: (T0 + 1000) / 1000, completed_at: (T0 + 43000) / 1000, duration_ms: 42000, time_to_first_token_ms: 800 }),
    ev(100, { type: 'task_started', turn_id: t2, root_turn_id: t2, started_at: (T0 + 100000) / 1000, model_context_window: 272000 }),
    ri(100, t2, { type: 'message', id: 'msg-user-2', role: 'user', content: text('再跑一次完整测试') }),
    rec(100, 'turn_context', { turn_id: t2, root_turn_id: t2, cwd: 'E:\\demo\\shop', approval_policy: 'on-request', sandbox_policy: { type: 'workspace-write' }, model: 'gpt-6.1-sol', effort: 'medium', summary: 'detailed' }),
    ri(102, t2, { type: 'custom_tool_call', id: 'ctc-6', status: 'completed', call_id: 'call-6', name: 'exec', input: 'npm test -- --coverage' }),
    tur(102, t2, 'resp-7', u6, u6, usage(92500, 85600, 880, 190)),
  ];
}

/** Sub-agent spawned by the main session: inherited context first, then one turn. */
export function childSession(): string[] {
  const t = 'turn-c001';
  const u = usage(9000, 4000, 200, 50);
  return [
    rec(16, 'session_meta', { session_id: CHILD_ID, id: CHILD_ID, parent_thread_id: MAIN_ID, timestamp: at(16), cwd: 'E:\\demo\\shop', originator: 'codex_cli_rs', cli_version: '0.140.0', source: { subagent: { thread_spawn: { parent_thread_id: MAIN_ID, depth: 1 } } }, agent_nickname: 'tester', agent_path: '/root/tester', model_provider: 'openai' }),
    rec(16, 'session_meta', { session_id: MAIN_ID, id: MAIN_ID, timestamp: at(0), cwd: 'E:\\demo\\shop', originator: 'codex_cli_rs', cli_version: '0.140.0', source: 'cli' }),
    rec(16, 'compacted', { message: '主智能体在修购物车测试；折扣计算已修正。', replacement_history: [], window_number: 1 }),
    rec(16, 'world_state', { full: true, state: {} }),
    rec(16, 'turn_context', { turn_id: t, model: 'gpt-6-luna', effort: 'medium', approval_policy: 'never', sandbox_policy: { type: 'workspace-write' } }),
    rec(16, 'response_item', { type: 'message', id: 'c-dev-1', role: 'developer', content: text('你是 tester，只写测试。'), internal_chat_message_metadata_passthrough: { turn_id: t } }),
    ev(16, { type: 'task_started', turn_id: t, root_turn_id: t, started_at: (T0 + 16000) / 1000 }),
    rec(17, 'inter_agent_communication_metadata', { trigger_turn: true }),
    rec(17, 'response_item', { type: 'agent_message', id: 'c-am-1', author: '/root', recipient: '/root/tester', content: text('给折扣计算补边界用例'), internal_chat_message_metadata_passthrough: { turn_id: t } }),
    rec(20, 'response_item', { type: 'custom_tool_call', id: 'c-ctc-1', status: 'completed', call_id: 'c-call-1', name: 'exec', input: 'npm test -- cart.edge', internal_chat_message_metadata_passthrough: { turn_id: t } }),
    rec(20, 'token_usage_record', { thread_id: CHILD_ID, turn_id: t, session_id: CHILD_ID, root_turn_id: t, response_id: 'c-resp-1', usage: u, turn_token_usage: u, thread_token_usage: u }),
    ev(30, { type: 'item_completed', turn_id: t, item: { type: 'CommandExecution', id: 'c-exec-1', command: ['bash', '-lc', 'npm test -- cart.edge'], parsed_cmd: [{ type: 'unknown', cmd: 'npm test -- cart.edge' }], status: 'completed', exit_code: 0, duration: { secs: 9, nanos: 0 } } }),
    rec(30, 'response_item', { type: 'custom_tool_call_output', id: 'c-ctco-1', call_id: 'c-call-1', output: text('Exit code: 0\nOutput:\n3 passed'), internal_chat_message_metadata_passthrough: { turn_id: t } }),
    rec(36, 'response_item', { type: 'message', id: 'c-a-1', role: 'assistant', phase: 'final_answer', content: text('已添加 3 个用例，全部通过。', 'output_text'), internal_chat_message_metadata_passthrough: { turn_id: t } }),
    rec(36, 'token_usage_record', { thread_id: CHILD_ID, turn_id: t, session_id: CHILD_ID, root_turn_id: t, response_id: 'c-resp-2', usage: u, turn_token_usage: usage(18000, 8000, 400, 100), thread_token_usage: usage(18000, 8000, 400, 100) }),
    ev(37, { type: 'task_complete', turn_id: t, last_agent_message: '已添加 3 个用例，全部通过。', started_at: (T0 + 16000) / 1000, completed_at: (T0 + 37000) / 1000, duration_ms: 21000 }),
  ];
}

/** Old format: header line, bare items without timestamps, a state record, one broken line. */
export function legacySession(): string[] {
  const j = (o: object) => JSON.stringify(o);
  return [
    j({ id: LEGACY_ID, timestamp: '2025-05-01T10:00:00.000Z', instructions: '', git: { branch: 'main' } }),
    j({ record_type: 'state' }),
    j({ type: 'message', role: 'user', content: text('<environment_context>\n  <cwd>/home/demo</cwd>\n</environment_context>') }),
    j({ record_type: 'state' }),
    j({ type: 'message', role: 'user', content: text('列出当前目录的文件') }),
    j({ type: 'reasoning', id: 'l-rs-1', summary: [{ type: 'summary_text', text: '用 ls 看一下。' }] }),
    j({ type: 'function_call', name: 'shell', arguments: JSON.stringify({ command: ['ls'] }), call_id: 'l-call-1' }),
    j({ type: 'function_call_output', call_id: 'l-call-1', output: JSON.stringify({ output: 'a.txt\n', metadata: { exit_code: 0, duration_seconds: 0.1 } }) }),
    j({ type: 'message', role: 'assistant', content: text('目录里只有 a.txt。', 'output_text') }),
    '{not json',
    j({ type: 'message', role: 'user', content: text('删掉它') }),
    j({ type: 'function_call', name: 'shell', arguments: JSON.stringify({ command: ['rm', 'a.txt'] }), call_id: 'l-call-2' }),
    j({ type: 'function_call_output', call_id: 'l-call-2', output: JSON.stringify({ output: 'rm: a.txt: Permission denied', metadata: { exit_code: 1, duration_seconds: 0.05 } }) }),
    j({ type: 'message', role: 'assistant', content: text('删除失败：没有权限。', 'output_text') }),
  ];
}

/** Envelope session whose first turn is interrupted with a command still running and whose second turn fails. */
export function brokenSession(): string[] {
  const a = 'turn-b001';
  const b = 'turn-b002';
  const u = usage(5000, 0, 50, 0);
  return [
    rec(0, 'session_meta', { id: BROKEN_ID, timestamp: at(0), cwd: '/home/demo/api', originator: 'codex_vscode', cli_version: '0.139.2', model_provider: 'openai' }),
    ev(1, { type: 'task_started', turn_id: a, started_at: (T0 + 1000) / 1000 }),
    ri(1, a, { type: 'message', id: 'b-u-1', role: 'user', content: text('启动开发服务器') }),
    ri(3, a, { type: 'custom_tool_call', id: 'b-ctc-1', status: 'completed', call_id: 'b-call-1', name: 'exec', input: 'npm run dev' }),
    rec(3, 'token_usage_record', { turn_id: a, response_id: 'b-resp-1', usage: u, turn_token_usage: u, thread_token_usage: u }),
    ev(60, { type: 'turn_aborted', turn_id: a, reason: 'interrupted', started_at: (T0 + 1000) / 1000, completed_at: (T0 + 60000) / 1000, duration_ms: 59000 }),
    ev(70, { type: 'task_started', turn_id: b, started_at: (T0 + 70000) / 1000 }),
    ri(70, b, { type: 'message', id: 'b-u-2', role: 'user', content: text('换个端口再试') }),
    ev(75, { type: 'task_complete', turn_id: b, last_agent_message: null, error: { message: 'stream disconnected before completion', codex_error_info: 'other' }, started_at: (T0 + 70000) / 1000, completed_at: (T0 + 75000) / 1000, duration_ms: 5000 }),
  ];
}

export const FIXTURES: Record<string, () => string[]> = {
  ['2026/10/10/rollout-2026-10-10T08-00-00-' + MAIN_ID + '.jsonl']: mainSession,
  ['2026/10/10/rollout-2026-10-10T08-00-16-' + CHILD_ID + '.jsonl']: childSession,
  ['2025/05/01/rollout-2025-05-01T10-00-00-' + LEGACY_ID + '.jsonl']: legacySession,
  ['2026/10/10/rollout-2026-10-10T09-00-00-' + BROKEN_ID + '.jsonl']: brokenSession,
};

/** Fixture timestamps run from here; tests compute ages from it. */
export const FIXTURE_T0 = T0;
