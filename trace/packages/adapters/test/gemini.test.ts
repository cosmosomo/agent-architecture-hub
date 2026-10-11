import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONTRACT_VERSION, validateSessionDoc, type ModelStep, type Session, type ToolStep } from '@hub-trace/contract';
import { geminiAdapter } from '../src/gemini/index.ts';
import { parseGeminiLogs } from '../src/gemini/parse.ts';
import { LOGS, LOGS_JSONL, SID, T0, arrayFile, brokenFile, emptyFile, jsonlFile, legacyFile, mixedFile } from './fixtures/gemini.ts';

const parse = (text: string, path = LOGS, mtimeMs = T0 + 200000, now = T0 + 300000) =>
  parseGeminiLogs(text, { path, mtimeMs }, { now });

const tools = (s: Session) => s.turns.flatMap((t) => t.steps).filter((x): x is ToolStep => x.kind === 'tool');
const models = (s: Session) => s.turns.flatMap((t) => t.steps).filter((x): x is ModelStep => x.kind === 'model');

test('registration: tmp session files match, other .gemini files do not', () => {
  assert.equal(geminiAdapter.matchFile('/home/u/.gemini/tmp/abc/logs.json'), true);
  assert.equal(geminiAdapter.matchFile('/home/u/.gemini/tmp/abc/session.jsonl'), true);
  assert.equal(geminiAdapter.matchFile('/home/u/.gemini/tmp/abc/settings.json'), true); // format probing decides; *.json are candidates
  assert.equal(geminiAdapter.matchFile('/home/u/.gemini/config.json'), false);
  assert.equal(geminiAdapter.label, 'Gemini CLI');
});

test('generation a: a JSON array of user echoes, one turn each, info counted', () => {
  const s = parse(arrayFile());
  assert.deepEqual(validateSessionDoc({ contract: CONTRACT_VERSION, session: s }), []);
  assert.equal(s.id, 'gemini:' + SID);
  assert.equal(s.source.format, 'gemini/logs-json');
  assert.equal(s.title, '帮我把这个目录下的图片压缩一下');
  assert.equal(s.turns.length, 3);
  assert.deepEqual(s.turns.map((t) => t.input), ['帮我把这个目录下的图片压缩一下', '压缩完了，再改个名字', '好了，谢谢']);
  assert.equal(s.stats.skipped, 1);
  assert.ok(s.notes.some((n) => n.includes('sys:info')));
});

test('generation b: legacy object — reasoning, tool call with result, usage', () => {
  const s = parse(legacyFile());
  assert.deepEqual(validateSessionDoc({ contract: CONTRACT_VERSION, session: s }), []);
  assert.equal(s.source.format, 'gemini/legacy-json');
  assert.equal(s.turns.length, 2);
  const [m1] = models(s);
  assert.match(m1.reasoning || '', /先看目录/);
  assert.match(m1.text || '', /三个包/);
  assert.equal(m1.usage?.input, 1200);
  assert.equal(m1.usage?.cachedInput, 300);
  const [call] = tools(s);
  assert.equal(call.name, 'run_shell_command');
  assert.equal(call.status, 'ok');
  assert.match(call.output || '', /adapters/);
  assert.equal(s.usage?.input, 3200);
});

test('generation c: jsonl — $set merges metadata, $rewindTo skipped, warning counted', () => {
  const s = parse(jsonlFile(), LOGS_JSONL);
  assert.deepEqual(validateSessionDoc({ contract: CONTRACT_VERSION, session: s }), []);
  assert.equal(s.source.format, 'gemini/logs-jsonl');
  assert.equal(s.turns.length, 2);
  assert.equal(s.updatedAt, new Date(T0 + 35000).toISOString());
  assert.ok(s.notes.some((n) => n.includes('sys:warning')));
  assert.equal(tools(s).length, 1);
});

test('mixed session ids: first wins, others noted and skipped', () => {
  const s = parse(mixedFile());
  assert.equal(s.id, 'gemini:' + SID);
  assert.equal(s.turns.length, 1);
  assert.ok(s.notes.some((n) => n.includes('multi-session:99999999-8888')));
  assert.ok(s.notes.some((n) => n.includes('type:debug')));
});

test('empty and broken files still yield valid metadata sessions', () => {
  const empty = parse(emptyFile());
  assert.deepEqual(validateSessionDoc({ contract: CONTRACT_VERSION, session: empty }), []);
  assert.equal(empty.turns.length, 0);
  assert.equal(empty.state.status, 'empty');
  const broken = parse(brokenFile());
  assert.deepEqual(validateSessionDoc({ contract: CONTRACT_VERSION, session: broken }), []);
  assert.ok(broken.stats.skipped >= 1);
});

test('createParser accumulates the whole document (jsonl lines)', () => {
  const p = geminiAdapter.createParser({ path: LOGS_JSONL });
  for (const line of jsonlFile().split('\n')) p.push(line);
  const s = p.finish({ now: T0 + 300000 });
  assert.equal(s.turns.length, 2);
});
