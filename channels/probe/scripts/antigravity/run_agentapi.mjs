// Run `language_server.exe agentapi <args...>` with discovered env. Prints raw stdout/stderr + exit code.
// Usage: node run_agentapi.mjs [--timeout 20000] <agentapi args...>
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const credFile = path.join(os.tmpdir(), 'agy-probe-ls-cred.json');
const cred = JSON.parse(fs.readFileSync(credFile, 'utf8'));
const lsBin = path.join(process.env.LOCALAPPDATA, 'Programs', 'antigravity', 'resources', 'bin', 'language_server.exe');

let timeoutMs = 90000;
const args = [];
for (let i = 2; i < process.argv.length; i++) {
  if (process.argv[i] === '--timeout') { timeoutMs = Number(process.argv[++i]); continue; }
  args.push(process.argv[i]);
}
// Per hub/tools/agent_gateway.js resolveAntigravityProjectId(): 2.23.1 requires a project id on new-conversation.
// outside-of-project is the registered catch-all for work outside any open folder.
const env = {
  ...process.env,
  ANTIGRAVITY_LS_ADDRESS: cred.address,
  ANTIGRAVITY_CSRF_TOKEN: cred.csrfToken,
  ANTIGRAVITY_PROJECT_ID: process.env.ANTIGRAVITY_PROJECT_ID || 'outside-of-project',
};
const t0 = Date.now();
const res = spawnSync(lsBin, ['agentapi', ...args], { env, encoding: 'utf8', timeout: timeoutMs, windowsHide: true });
console.log('--- exit:', res.status, 'durationMs:', Date.now() - t0);
if (res.stdout) console.log('--- stdout ---\n' + res.stdout.trim());
if (res.stderr) console.log('--- stderr ---\n' + res.stderr.trim());
if (res.error) console.log('--- error:', res.error.message);
