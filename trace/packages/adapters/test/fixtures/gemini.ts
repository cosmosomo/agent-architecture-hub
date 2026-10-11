/**
 * Hand-made Gemini CLI log files (never real sessions): one file per session
 * directory under .gemini/tmp/<hash>/, in the three generations of shape —
 * JSON array, legacy whole object, JSONL with $set/$rewindTo control lines.
 */
export const SID = '11111111-2222-3333-4444-555555555555';
export const OTHER = '99999999-8888-7777-6666-555555555555';
export const HASH = '7f3a9c1e6b2d5f8a4e0c9b1d3f7a5e2c';
export const T0 = 1751700000000;

const base = '/home/u/.gemini/tmp/' + HASH;
export const LOGS = base + '/logs.json';
export const LOGS_JSONL = base + '/session.jsonl';
export const BROKEN = base + '/crash.json';

const iso = (ms: number) => new Date(ms).toISOString();

/** Generation a: one JSON array of records, three user echoes and an 'info' to count. */
export function arrayFile(): string {
  return JSON.stringify([
    { sessionId: SID, messageId: 0, type: 'user', message: '帮我把这个目录下的图片压缩一下', timestamp: iso(T0 + 1000) },
    { sessionId: SID, messageId: 1, type: 'user', message: '压缩完了，再改个名字', timestamp: iso(T0 + 61000) },
    { sessionId: SID, messageId: 2, type: 'info', message: 'compacted', timestamp: iso(T0 + 62000) },
    { sessionId: SID, messageId: 3, type: 'user', message: '好了，谢谢', timestamp: iso(T0 + 121000) },
  ]);
}

/** Generation b: legacy whole object; a gemini message with thoughts, a tool call and tokens. */
export function legacyFile(): string {
  return JSON.stringify({
    sessionId: SID,
    projectHash: HASH,
    startTime: iso(T0),
    lastUpdated: iso(T0 + 130000),
    kind: 'main',
    messages: [
      { id: 'm1', type: 'user', content: '看看这个项目的结构', timestamp: iso(T0 + 1000) },
      {
        id: 'm2',
        type: 'gemini',
        content: '这个项目分三个包。',
        thoughts: [{ subject: '先看目录', description: '列出了顶层目录' }],
        toolCalls: [
          { id: 'call-1', name: 'run_shell_command', args: { command: 'ls packages' }, result: 'adapters\napps\ncontract', status: 'success' },
        ],
        tokens: { input: 1200, output: 80, cached: 300, thoughts: 40 },
        timestamp: iso(T0 + 20000),
      },
      { id: 'm3', type: 'user', content: [{ type: 'text', text: '第二个包是干什么的' }], timestamp: iso(T0 + 61000) },
      { id: 'm4', type: 'gemini', content: [{ type: 'text', text: '放契约类型。' }], tokens: { input: 2000, output: 30 }, timestamp: iso(T0 + 80000) },
    ],
  }, null, 2);
}

/** Generation c: JSONL — metadata first, $set updates it, $rewindTo is skipped. */
export function jsonlFile(): string {
  return [
    JSON.stringify({ sessionId: SID, projectHash: HASH, startTime: iso(T0), lastUpdated: iso(T0 + 1000), kind: 'main' }),
    JSON.stringify({ id: 'm1', type: 'user', content: '帮我总结一下这个仓库', timestamp: iso(T0 + 1000) }),
    JSON.stringify({
      id: 'm2',
      type: 'gemini',
      content: '这是个多 CLI 会话解析器。',
      toolCalls: [{ id: 't1', name: 'google_web_search', args: { query: 'agent trace' }, result: 'ok' }],
      tokens: { input: 900, output: 60 },
      timestamp: iso(T0 + 30000),
    }),
    JSON.stringify({ $set: { lastUpdated: iso(T0 + 35000) } }),
    JSON.stringify({ $rewindTo: 'm1' }),
    JSON.stringify({ id: 'm3', type: 'user', content: '再细一点', timestamp: iso(T0 + 70000) }),
    JSON.stringify({ id: 'm4', type: 'warning', content: 'rate limit', timestamp: iso(T0 + 71000) }),
  ].join('\n');
}

/** Two session ids in one file: the first wins, the others are noted; plus an unknown type. */
export function mixedFile(): string {
  return JSON.stringify([
    { sessionId: SID, messageId: 0, type: 'user', message: '第一段', timestamp: iso(T0 + 1000) },
    { sessionId: OTHER, messageId: 0, type: 'user', message: '另一场会话', timestamp: iso(T0 + 2000) },
    { sessionId: OTHER, messageId: 1, type: 'user', message: '又一条', timestamp: iso(T0 + 3000) },
    { sessionId: SID, messageId: 9, type: 'debug', message: 'trace', timestamp: iso(T0 + 4000) },
  ]);
}

/** No records: an empty but valid session. */
export function emptyFile(): string {
  return '[]';
}

/** Broken JSON: still yields a metadata-only session, id from the file name. */
export function brokenFile(): string {
  return '[{"sessionId":"' + SID + '","type":"user","mess';
}
