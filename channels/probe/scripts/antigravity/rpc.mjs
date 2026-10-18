// Call a Connect-RPC method on the local LanguageServerService. Prints raw HTTP status + body.
// Usage: node rpc.mjs <Method> [json-body]
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const credFile = path.join(os.tmpdir(), 'agy-probe-ls-cred.json');
const cred = JSON.parse(fs.readFileSync(credFile, 'utf8'));
const method = process.argv[2];
const body = process.argv[3] || '{}';
const res = spawnSync(
  'curl.exe',
  [
    '-s', '--max-time', '90', '-w', '\nHTTP_STATUS:%{http_code}',
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
console.log('status:', m ? m[1] : '?');
console.log((res.stdout || '').replace(/\nHTTP_STATUS:\d+\s*$/, '').trim() || '(empty body)');
if (res.error) console.log('curl error:', res.error.message);
