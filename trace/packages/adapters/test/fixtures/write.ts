/**
 * Writes the hand-made Codex sessions as files, laid out like ~/.codex/sessions.
 * Usage: node packages/adapters/test/fixtures/write.ts [outDir]
 * Default outDir: trace/trace-data/demo-codex-sessions (ignored by git).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FIXTURES } from './codex.ts';

const here = dirname(fileURLToPath(import.meta.url));
const out = resolve(process.argv[2] || join(here, '..', '..', '..', '..', 'trace-data', 'demo-codex-sessions'));
for (const [rel, make] of Object.entries(FIXTURES)) {
  const file = join(out, rel);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, make().join('\n') + '\n');
}
console.log('wrote ' + Object.keys(FIXTURES).length + ' sessions to ' + out);
