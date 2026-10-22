import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const credFile = path.join(os.tmpdir(), 'agy-probe-ls-cred.json');
const cred = JSON.parse(fs.readFileSync(credFile, 'utf8'));

function callRpc(method, bodyObj) {
  const body = JSON.stringify(bodyObj);
  const res = spawnSync(
    'curl.exe',
    [
      '-s', '--max-time', '15', '-w', '\nHTTP_STATUS:%{http_code}',
      '-X', 'POST',
      '-H', `x-codeium-csrf-token: ${cred.csrfToken}`,
      '-H', 'Connect-Protocol-Version: 1',
      '-H', 'Content-Type: application/json',
      '-d', body,
      `http://127.0.0.1:${cred.port}/exa.language_server_pb.LanguageServerService/${method}`,
    ],
    { encoding: 'utf8', timeout: 15000, windowsHide: true }
  );
  const m = (res.stdout || '').match(/\nHTTP_STATUS:(\d+)\s*$/);
  return {
    status: m ? Number(m[1]) : 0,
    body: (res.stdout || '').replace(/\nHTTP_STATUS:\d+\s*$/, '').trim()
  };
}

const testCid = '86954bb0-b3e4-48f5-9bb4-966f557ff532';
console.log('--- 1. SendUserCascadeMessage with cascadeId ---');
console.log(callRpc('SendUserCascadeMessage', { cascadeId: testCid }));

console.log('--- 2. SendUserCascadeMessage with conversation_id ---');
console.log(callRpc('SendUserCascadeMessage', { conversation_id: testCid }));

console.log('--- 3. SendUserCascadeMessage with conversationId & userMessage ---');
console.log(callRpc('SendUserCascadeMessage', { conversationId: testCid, userMessage: { content: 'test message' } }));
