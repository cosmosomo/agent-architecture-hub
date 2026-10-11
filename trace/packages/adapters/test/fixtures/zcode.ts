/**
 * Hand-made ZCode session files (never real sessions): one JSON document per task
 * under .zcode/v2/sessions/<project>/<taskId>.json.
 */
export const TID = 'task-0123456789abcdef';
export const T0 = 1771000000000;

const base = '/home/u/.zcode/v2/sessions/projhash01';
export const TASK = base + '/' + TID + '.json';

const iso = T0;

/** Two finished turns, with an empty assistant message and an unknown role to count. */
export function taskFile(): string {
  return JSON.stringify({
    meta: {
      taskId: TID,
      title: '把构建修好',
      workspacePath: 'C:\\code\\demo',
      createdAt: iso,
      updatedAt: T0 + 60000,
      status: 'completed',
    },
    messages: [
      { role: 'user', content: '构建挂了，看看为什么', timestamp: T0 + 1000, turnIndex: 0 },
      { role: 'assistant', content: '先看日志。', timestamp: T0 + 2000, turnIndex: 0 },
      { role: 'assistant', content: '', timestamp: T0 + 3000, turnIndex: 0 },
      { role: 'user', content: '修一下', timestamp: T0 + 30000, turnIndex: 1 },
      { role: 'assistant', content: '修好了，构建全绿。', timestamp: T0 + 40000, turnIndex: 1 },
      { role: 'system', content: 'internal', timestamp: T0 + 41000, turnIndex: 1 },
    ],
  });
}

/** Turn 1 only and a running status: the session is working, then stale by age. */
export function runningFile(): string {
  return JSON.stringify({
    meta: {
      taskId: TID,
      workspacePath: 'C:\\code\\demo',
      createdAt: iso,
      updatedAt: T0 + 9000,
      status: 'running',
    },
    messages: [
      { role: 'user', content: '继续跑', timestamp: T0 + 1000, turnIndex: 0 },
      { role: 'assistant', content: '在跑了。', timestamp: T0 + 8000, turnIndex: 0 },
    ],
  });
}

/** No title: falls back to the first user message. */
export function untitledFile(): string {
  return JSON.stringify({
    meta: { taskId: TID, workspacePath: '/tmp/x', createdAt: iso, updatedAt: T0 + 1000 },
    messages: [{ role: 'user', content: '随便看看', timestamp: T0 + 500, turnIndex: 0 }],
  });
}

/** Broken JSON: still yields a metadata-only session, skipped counted. */
export function brokenFile(): string {
  return '{"meta":{"taskId":"' + TID + '"},"messages":[ broken';
}
