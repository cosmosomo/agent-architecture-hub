import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { guardMethods, jsonRows, rebuild } from '../src/gateway/guard.ts';

test('rows glued onto one line are split apart', () => {
  assert.deepEqual(jsonRows('{"a":1}{"b":"x}y"}\n\n{"c":"\\"{"}\n'), ['{"a":1}', '{"b":"x}y"}', '{"c":"\\"{"}']);
});

test('rebuild keeps the snapshot and adds what only the short file has', () => {
  assert.deepEqual(rebuild('{"n":1}\n{"n":2}\n{"n":3}\n', '{"n":9}\n{"n":2}\n'), ['{"n":1}', '{"n":2}', '{"n":3}', '{"n":9}']);
});

test('a rewritten blackboard is set aside and restored from the newest copy plus its new rows', () => {
  const root = mkdtempSync(join(tmpdir(), 'hub-guard-'));
  const dir = join(root, 'channels', 'probe');
  mkdirSync(dir, { recursive: true });
  const file = join(dir, 'blackboard.jsonl');
  const rows = Array.from({ length: 50 }, (_, i) => JSON.stringify({ at: 't' + i, by: 'x', n: i }));
  writeFileSync(file, rows.join('\n') + '\n');
  const events: string[] = [];
  const hub: any = { repoRoot: root, eventsFile: join(root, 'channels', 'events.jsonl'), broadcast: (k: string) => events.push(k) };
  for (const [k, f] of Object.entries(guardMethods)) hub[k] = f;

  hub.guardAppendOnly(); // first look: snapshot taken
  assert.equal(readdirSync(join(dir, 'snapshots')).filter((f) => f.endsWith('.snap')).length, 1);

  // An agent rewrites the file whole with only its own rows, one of them glued to another.
  writeFileSync(file, '{"by":"agy","n":100}{"by":"agy","n":101}\n');
  hub.guardAppendOnly();

  const after = readFileSync(file, 'utf8').trim().split('\n');
  assert.equal(after.length, 52);
  assert.equal(after[0], rows[0]);
  assert.deepEqual(after.slice(-2), ['{"by":"agy","n":100}', '{"by":"agy","n":101}']);
  assert.ok(readdirSync(join(dir, 'snapshots')).some((f) => f.startsWith('blackboard.jsonl.shrunk-')));
  assert.match(readFileSync(hub.eventsFile, 'utf8'), /"kind":"guard_restore"/);
  assert.deepEqual(events, ['guard_restore']);
});
