import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const credFile = path.join(os.tmpdir(), 'agy-probe-ls-cred.json');
const cred = JSON.parse(fs.readFileSync(credFile, 'utf8'));
const lsBin = path.join(process.env.LOCALAPPDATA, 'Programs', 'antigravity', 'resources', 'bin', 'language_server.exe');

export function runAgentApi(args, timeoutMs = 45000) {
  const env = {
    ...process.env,
    ANTIGRAVITY_LS_ADDRESS: cred.address,
    ANTIGRAVITY_CSRF_TOKEN: cred.csrfToken,
    ANTIGRAVITY_PROJECT_ID: process.env.ANTIGRAVITY_PROJECT_ID || 'outside-of-project',
  };
  const res = spawnSync(lsBin, ['agentapi', ...args], { env, encoding: 'utf8', timeout: timeoutMs, windowsHide: true });
  let stdoutJson = null;
  try {
    stdoutJson = JSON.parse(res.stdout);
  } catch {}
  return { status: res.status, stdout: res.stdout, stderr: res.stderr, json: stdoutJson };
}
