import fs from 'node:fs';
import path from 'node:path';

export function appendFact(entry) {
  const file = path.resolve('channels/probe/blackboard.jsonl');
  const line = JSON.stringify(entry) + '\n';
  fs.appendFileSync(file, line, 'utf8');
  console.log(`[blackboard] Appended capability=${entry.capability} result=${entry.result}`);
}
