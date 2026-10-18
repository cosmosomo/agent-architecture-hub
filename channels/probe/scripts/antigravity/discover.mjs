// Discover the running language_server.exe (port + CSRF token), same protocol as
// hub/tools/agent_gateway.js discoverAntigravityLs(). Writes the token to a temp
// file OUTSIDE the repo (csrf is a credential; must not land in blackboard/report)
// and prints sanitized info.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const psScript =
  "$p = Get-CimInstance Win32_Process -Filter \"Name = 'language_server.exe'\" | Select-Object -First 1; " +
  'if (-not $p) { exit 1 }; ' +
  "$csrf = [regex]::Match($p.CommandLine, '--csrf_token\\s+([a-f0-9-]+)').Groups[1].Value; " +
  '$ports = (Get-NetTCPConnection -OwningProcess $p.ProcessId -State Listen -ErrorAction SilentlyContinue).LocalPort | Sort-Object -Unique; ' +
  'Write-Output ("$($p.ProcessId)|$csrf|" + ($ports -join ","))';

const res = spawnSync('powershell.exe', ['-NoProfile', '-Command', psScript], { encoding: 'utf8', timeout: 8000 });
if (res.status !== 0 || !res.stdout.trim()) {
  console.error(JSON.stringify({ ok: false, error: 'language_server.exe process not found', stderr: res.stderr }));
  process.exit(1);
}
const [pidStr, csrfToken, portsStr] = res.stdout.trim().split('|');
const ports = (portsStr || '').split(',').map(Number).filter(Boolean);
let httpPort = null;
let healthz = '';
for (const p of ports) {
  const h = spawnSync('curl.exe', ['-s', '--max-time', '2', `http://127.0.0.1:${p}/healthz`], { encoding: 'utf8', timeout: 4000 });
  if (/"status"\s*:\s*"ok"/.test(h.stdout || '')) {
    httpPort = p;
    healthz = h.stdout.trim();
    break;
  }
}
if (!httpPort) {
  console.error(JSON.stringify({ ok: false, error: 'no plain-HTTP /healthz port among', ports }));
  process.exit(1);
}
const credFile = path.join(os.tmpdir(), 'agy-probe-ls-cred.json');
fs.writeFileSync(credFile, JSON.stringify({ address: `localhost:${httpPort}`, port: httpPort, csrfToken, pid: Number(pidStr) }));
console.log(JSON.stringify({ ok: true, pid: Number(pidStr), port: httpPort, healthz, credFile, csrfLen: csrfToken.length }));
