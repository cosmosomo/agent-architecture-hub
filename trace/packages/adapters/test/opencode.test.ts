import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONTRACT_VERSION, validateSessionDoc, type ModelStep, type Session, type ToolStep } from '@hub-trace/contract';
import { adapterForFile, opencodeAdapter, opencodeBundleMembers } from '../src/index.ts';
import { parseOpencodeBundle } from '../src/opencode/parse.ts';
import { A1, MARKER, SID, T0, U1, allFiles, finishedBundle, partPath, runningBundle, untitledBundle } from './fixtures/opencode.ts';

const parse = (b = finishedBundle(), mtimeMs = T0 + 90000, now = T0 + 100000) =>
  parseOpencodeBundle({ path: MARKER, mtimeMs }, b, { now });

const tools = (s: Session) => s.turns.flatMap((t) => t.steps).filter((x): x is ToolStep => x.kind === 'tool');
const models = (s: Session) => s.turns.flatMap((t) => t.steps).filter((x): x is ModelStep => x.kind === 'model');

test('registration: marker files match, message and part files do not', () => {
  assert.equal(adapterForFile('C:/u/.local/share/opencode/storage/session/global/' + SID + '.json')?.kind, 'opencode');
  assert.equal(adapterForFile('/home/u/.local/share/opencode/storage/session/proj/' + SID + '.json')?.kind, 'opencode');
  assert.equal(adapterForFile('/home/u/.local/share/opencode/storage/message/' + SID + '/msg_x.json'), undefined);
  assert.equal(adapterForFile('/home/u/.local/share/opencode/storage/part/msg_x/prt_y.json'), undefined);
  assert.equal(opencodeAdapter.label, 'OpenCode');
});

test('bundleMembers: marker + its messages + their parts, nothing from the neighbour session', () => {
  const members = opencodeBundleMembers(MARKER, allFiles());
  assert.ok(members.includes(MARKER));
  const b = finishedBundle();
  for (const p of b.files) assert.ok(members.includes(p), p);
  assert.ok(!members.some((p) => p.endsWith('x-ignored.txt')));
  assert.ok(!members.some((p) => p.includes('ses_other')));
});

test('identity, two turns, title, cwd', () => {
  const s = parse();
  assert.deepEqual(validateSessionDoc({ contract: CONTRACT_VERSION, session: s }), []);
  assert.equal(s.id, 'opencode:' + SID);
  assert.equal(s.source.format, 'opencode/json-dir');
  assert.equal(s.source.version, '1.1.16');
  assert.equal(s.title, '修复登录 bug');
  assert.equal(s.cwd, 'C:\\code\\app');
  assert.equal(s.agent.product, 'OpenCode');
  assert.equal(s.agent.model, 'glm-4.7');
  assert.equal(s.turns.length, 2);
  assert.deepEqual(s.turns.map((t) => t.status), ['completed', 'completed']);
  assert.equal(s.turns[0].input, '先看下登录测试为什么挂');
  assert.match(s.turns[1].output || '', /测试已修好/);
});

test('tools pair with their state; bash ok, read error', () => {
  const s = parse();
  const [bash, read] = tools(s);
  assert.equal(bash.name, 'bash');
  assert.equal(bash.family, 'shell');
  assert.equal(bash.status, 'ok');
  assert.match(bash.input || '', /npm test/);
  assert.match(bash.output || '', /failures: 3/);
  assert.equal(read.name, 'read');
  assert.equal(read.status, 'error');
  assert.match(read.output || '', /file not found/);
  assert.equal(s.stats.toolCalls, 2);
  assert.equal(s.stats.toolErrors, 1);
});

test('reasoning and text land on the model step; tokens counted once (step-finish and message agree)', () => {
  const s = parse();
  const ms = models(s);
  assert.equal(ms.length, 2);
  assert.equal(ms[0].reasoning, '先跑测试。');
  assert.equal(ms[0].model, 'glm-4.7');
  assert.match(ms[1].text || '', /测试已修好/);
  assert.deepEqual(s.usage, { input: 2200, output: 130, reasoning: 0, cachedInput: 200, cacheWrite: 0 });
  assert.equal(s.stats.costUsd, 0.005);
  assert.equal(s.stats.linesAdded, 5);
  assert.equal(s.stats.linesRemoved, 2);
});

test('a tool still running keeps the last turn open and the session working/stale by age', () => {
  const fresh = parseOpencodeBundle({ path: MARKER, mtimeMs: T0 + 8000 }, runningBundle(), { now: T0 + 9000 });
  assert.equal(fresh.turns[0].status, 'running');
  assert.equal(tools(fresh)[0].status, 'pending');
  assert.ok(['working', 'waiting'].includes(fresh.state.status), fresh.state.status);
  const old = parseOpencodeBundle({ path: MARKER, mtimeMs: T0 + 8000 }, runningBundle(), { now: T0 + 8000 + 31 * 60000 });
  assert.equal(old.state.status, 'stale');
});

test('untitled marker falls back to the first user message', () => {
  assert.equal(parse(untitledBundle()).title, '先看下登录测试为什么挂');
});

test('titles are one-lined and secrets in a title, message or tool input are masked', () => {
  const SECRET = 'ghp_01234567890123456789AB';
  const b = finishedBundle();
  const files = new Map(b.files.map((p) => [p, b.read(p)]));
  const marker = JSON.parse(files.get(MARKER)!);
  marker.title = '排障\nkey ' + SECRET;
  files.set(MARKER, JSON.stringify(marker));
  const userText = files.get(partPath(U1, 'prt_u1text'))!;
  files.set(partPath(U1, 'prt_u1text'), userText.replace('先看下登录测试为什么挂', '日志里有 ' + SECRET));

  const s = parseOpencodeBundle({ path: MARKER, mtimeMs: T0 + 90000 }, {
    files: Array.from(files.keys()).sort(),
    read: (p) => files.get(p)!,
  }, { now: T0 + 100000 });
  assert.ok(!/\n/.test(s.title), 'title is one line: ' + s.title);
  assert.ok(!JSON.stringify(s).includes(SECRET), 'the raw token appears nowhere in the parsed session');
  assert.match(s.title, /已打码/);
});

test('unknown part types and non-user/assistant messages are counted as skipped, not dropped', () => {
  const b = finishedBundle();
  const files = new Map(b.files.map((p) => [p, b.read(p)]));
  files.set(partPath(A1, 'prt_a1weird'), JSON.stringify({ id: 'prt_a1weird', messageID: A1, type: 'file' }));
  const s = parseOpencodeBundle({ path: MARKER, mtimeMs: T0 + 90000 }, {
    files: Array.from(files.keys()).sort(),
    read: (p) => files.get(p)!,
  }, { now: T0 + 100000 });
  assert.ok(s.stats.skipped >= 1, 'unknown part counted: ' + s.stats.skipped);
  assert.ok(s.notes.some((n) => n.includes('part:file')));
});

test('a lone marker file (dropped) parses metadata without steps', () => {
  const text = JSON.stringify({ id: SID, title: '只有元数据', time: { created: T0 }, directory: '/tmp/x' });
  const p = opencodeAdapter.createParser({ path: MARKER });
  p.push(text);
  const s = p.finish({ now: T0 + 1000 });
  assert.equal(s.title, '只有元数据');
  assert.equal(s.turns.length, 0);
  assert.equal(s.state.status, 'empty');
});
