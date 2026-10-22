import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const credFile = path.join(os.tmpdir(), 'agy-probe-ls-cred.json');
const cred = JSON.parse(fs.readFileSync(credFile, 'utf8'));
const cid = 'c931dd50-e2aa-4d15-9587-d69afd4addb5';

function callRpc(method, bodyObj) {
  const res = spawnSync(
    'curl.exe',
    [
      '-s', '--max-time', '15', '-w', '\nHTTP_STATUS:%{http_code}',
      '-X', 'POST',
      '-H', `x-codeium-csrf-token: ${cred.csrfToken}`,
      '-H', 'Connect-Protocol-Version: 1',
      '-H', 'Content-Type: application/json',
      '-d', JSON.stringify(bodyObj),
      `http://127.0.0.1:${cred.port}/exa.language_server_pb.LanguageServerService/${method}`,
    ],
    { encoding: 'utf8', timeout: 15000, windowsHide: true }
  );
  const m = (res.stdout || '').match(/\nHTTP_STATUS:(\d+)\s*$/);
  const status = m ? Number(m[1]) : 0;
  const body = (res.stdout || '').replace(/\nHTTP_STATUS:\d+\s*$/, '').trim();
  return { status, body };
}

for (const field of ['conversation_id', 'conversationId', 'cascadeId', 'cascade_id', 'id']) {
  console.log(`Testing DeleteCascadeTrajectory with ${field}...`);
  console.log(callRpc('DeleteCascadeTrajectory', { [field]: cid }));
}

import { DatabaseSync } from 'node:sqlite';
const dbPath = path.join(os.homedir(), '.gemini', 'antigravity', 'conversation_summaries.db');
const db = new DatabaseSync(dbPath, { readOnly: true });
const row = db.prepare('SELECT conversation_id, status, title FROM conversation_summaries WHERE conversation_id = ?').get(cid);
console.log('Final DB row after DeleteCascadeTrajectory:', row);

