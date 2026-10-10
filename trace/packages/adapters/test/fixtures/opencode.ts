/**
 * Hand-made OpenCode storage tree (never a real session): the session marker,
 * per-message JSON and per-part JSON the CLI writes under storage/.
 */
export const SID = 'ses_testaaaaaaaaaaaaaaaaaa';
export const T0 = 1770000000000;

const base = '/home/u/.local/share/opencode/storage';
export const MARKER = base + '/session/proj/' + SID + '.json';
export const msgPath = (m: string) => base + '/message/' + SID + '/' + m + '.json';
export const partPath = (m: string, p: string) => base + '/part/' + m + '/' + p + '.json';

type Bundle = { files: string[]; read: (p: string) => string };

export const U1 = 'msg_u10000000000000000000001';
export const A1 = 'msg_a10000000000000000000002';
export const U2 = 'msg_u20000000000000000000003';
export const A2 = 'msg_a20000000000000000000004';

/** A normal finished two-turn session: a bash tool in turn 1, a failing read + final text in turn 2. */
export function finishedBundle(): Bundle {
  const f = new Map<string, any>();
  f.set(MARKER, {
    id: SID,
    version: '1.1.16',
    projectID: 'proj',
    directory: 'C:\\code\\app',
    title: '修复登录 bug',
    time: { created: T0, updated: T0 + 90000 },
    summary: { additions: 5, deletions: 2, files: 1 },
  });

  f.set(msgPath(U1), { id: U1, sessionID: SID, role: 'user', time: { created: T0 + 1000 } });
  f.set(partPath(U1, 'prt_u1text'), { id: 'prt_u1text', sessionID: SID, messageID: U1, type: 'text', text: '先看下登录测试为什么挂' });

  f.set(msgPath(A1), {
    id: A1, sessionID: SID, role: 'assistant', time: { created: T0 + 2000, completed: T0 + 8000 },
    parentID: U1, modelID: 'glm-4.7', providerID: 'zhipuai', mode: 'build', agent: 'build',
    path: { cwd: 'C:\\code\\app', root: '/' }, cost: 0.002,
    tokens: { input: 1000, output: 50, reasoning: 0, cache: { read: 200, write: 0 } }, finish: 'tool-calls',
  });
  f.set(partPath(A1, 'prt_a1start'), { id: 'prt_a1start', messageID: A1, type: 'step-start' });
  f.set(partPath(A1, 'prt_a1reason'), { id: 'prt_a1reason', messageID: A1, type: 'reasoning', text: '先跑测试。', time: { start: T0 + 2100, end: T0 + 2500 } });
  f.set(partPath(A1, 'prt_a1tool'), {
    id: 'prt_a1tool', messageID: A1, type: 'tool', callID: 'call-1', tool: 'bash',
    state: { status: 'completed', input: { command: 'npm test' }, output: 'failures: 3' },
    time: { start: T0 + 2600, end: T0 + 7000 },
  });
  f.set(partPath(A1, 'prt_a1finish'), {
    id: 'prt_a1finish', messageID: A1, type: 'step-finish', reason: 'tool-calls', cost: 0.002,
    tokens: { input: 1000, output: 50, reasoning: 0, cache: { read: 200, write: 0 } },
  });

  f.set(msgPath(U2), { id: U2, sessionID: SID, role: 'user', time: { created: T0 + 20000 } });
  f.set(partPath(U2, 'prt_u2text'), { id: 'prt_u2text', messageID: U2, type: 'text', text: '修一下' });

  f.set(msgPath(A2), {
    id: A2, sessionID: SID, role: 'assistant', time: { created: T0 + 21000, completed: T0 + 30000 },
    parentID: U2, modelID: 'glm-4.7', cost: 0.003,
    tokens: { input: 1200, output: 80, reasoning: 0, cache: { read: 0, write: 0 } }, finish: 'stop',
  });
  f.set(partPath(A2, 'prt_a2tool'), {
    id: 'prt_a2tool', messageID: A2, type: 'tool', callID: 'call-2', tool: 'read',
    state: { status: 'error', input: { filePath: 'x.ts' }, error: 'file not found' },
  });
  f.set(partPath(A2, 'prt_a2text'), { id: 'prt_a2text', messageID: A2, type: 'text', text: '测试已修好，全绿了。' });
  f.set(partPath(A2, 'prt_a2finish'), {
    id: 'prt_a2finish', messageID: A2, type: 'step-finish', reason: 'stop', cost: 0.003,
    tokens: { input: 1200, output: 80, reasoning: 0, cache: { read: 0, write: 0 } },
  });

  return toBundle(f);
}

/** Only turn 1, and its bash call is still running: no completed state. */
export function runningBundle(): Bundle {
  const b = finishedBundle();
  const files = new Map(b.files.map((p) => [p, b.read(p)]));
  // Drop turn 2 entirely: a later user message would close the open turn.
  for (const p of Array.from(files.keys())) {
    if (p.includes(U2) || p.includes(A2) || p.includes('/part/' + A2 + '/')) files.delete(p);
  }
  files.set(partPath(A1, 'prt_a1tool'), JSON.stringify({
    id: 'prt_a1tool', messageID: A1, type: 'tool', callID: 'call-1', tool: 'bash',
    state: { status: 'running', input: { command: 'npm test' } },
  }));
  return toBundle(files);
}

/** Marker without a title: the first user message becomes the title. */
export function untitledBundle(): Bundle {
  const b = finishedBundle();
  const files = new Map(b.files.map((p) => [p, b.read(p)]));
  const marker = JSON.parse(files.get(MARKER)!);
  delete marker.title;
  files.set(MARKER, JSON.stringify(marker));
  return toBundle(files);
}

/** Every file below one storage root, including a neighbour session (for bundleMembers tests). */
export function allFiles(): string[] {
  const b = finishedBundle();
  const other = base + '/message/' + SID + '/x-ignored.txt';
  const neighbour = base + '/session/proj/ses_other00000000000000000.json';
  return b.files.concat([other, neighbour]).sort();
}

function toBundle(f: Map<string, any>): Bundle {
  const files = Array.from(f.keys()).sort();
  return { files, read: (p: string) => (typeof f.get(p) === 'string' ? f.get(p) : JSON.stringify(f.get(p))) };
}
