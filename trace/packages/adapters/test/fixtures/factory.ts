/**
 * Hand-made Factory CLI sessions (never real ones): one JSON record per line
 * under .factory/sessions/<uuid>.jsonl. The <uuid>.settings.json next to them
 * is not a session and never appears here.
 */
export const SID = 'a1b2c3d4-1111-4222-8333-444444444444';
export const T0 = Date.parse('2026-10-10T08:00:00.000Z');

export const SESSION = '/home/u/.factory/sessions/' + SID + '.jsonl';

const at = (sec: number) => new Date(T0 + sec * 1000).toISOString();
const start = (title?: string) => JSON.stringify({ type: 'session_start', id: SID, owner: 'COLORFIRE', ...(title ? { title } : {}) });
const msg = (sec: number, role: string, content: unknown) =>
  JSON.stringify({ type: 'message', id: SID, timestamp: at(sec), message: { role, content } });

/** Two finished turns, with an unknown content block and a system role to count. */
export function twoTurnSession(): string[] {
  return [
    start('添加 context7 服务'),
    msg(1, 'user', [{ type: 'text', text: '帮我把 context7 加进 MCP 配置' }]),
    msg(2, 'assistant', '好，先看现有配置。'),
    msg(30, 'user', [{ type: 'text', text: '再加一个搜索服务' }]),
    msg(31, 'assistant', [{ type: 'text', text: '两个都加好了。' }, { type: 'tool_use', id: 'tu-1', name: 'demo' }]),
    msg(32, 'system', 'internal'),
  ];
}

/** Only the session_start marker: no turn can close, the session is empty. */
export function emptySession(): string[] {
  return [start()];
}

/** A broken JSON line and an unknown record type mid-file: both counted, parsing continues. */
export function brokenSession(): string[] {
  return [
    start('清理依赖'),
    msg(1, 'user', '看看哪些依赖没用到'),
    '{"type":"message","id":"' + SID + '","timestamp":"' + at(2) + '","message":{ broken',
    msg(2, 'assistant', '这三个没用到。'),
    JSON.stringify({ type: 'summary', text: '会话摘要' }),
    msg(30, 'user', '删掉它们'),
    msg(31, 'assistant', '删完了，测试还是绿的。'),
  ];
}
