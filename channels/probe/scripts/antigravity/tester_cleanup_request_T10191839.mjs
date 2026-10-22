// tester-antigravity · 2026-10-20 · 清理挂起的测试会话（act-request 测试收尾）
import { spawnSync } from 'node:child_process';

const CID = '8abf5bb1-ab14-4db4-887c-c0b6778ec3b3';
const ps =
  "$p = Get-CimInstance Win32_Process -Filter \"Name = 'language_server.exe'\" | Select-Object -First 1; " +
  'if (-not $p) { exit 1 }; ' +
  "$csrf = [regex]::Match($p.CommandLine, '--csrf_token\\s+([a-f0-9-]+)').Groups[1].Value; " +
  '$ports = (Get-NetTCPConnection -OwningProcess $p.ProcessId -State Listen -ErrorAction SilentlyContinue).LocalPort | Sort-Object -Unique; ' +
  'Write-Output ("$($p.ProcessId)|$csrf|" + ($ports -join ","))';
const res = spawnSync('powershell.exe', ['-NoProfile', '-Command', ps], { encoding: 'utf8', timeout: 8000, windowsHide: true });
const [pidStr, csrfToken, portsStr] = (res.stdout || '').trim().split('|');
let httpPort = null;
for (const p of (portsStr || '').split(',').map(Number).filter(Boolean)) {
  const h = spawnSync('curl.exe', ['-s', '--max-time', '2', `http://127.0.0.1:${p}/healthz`], { encoding: 'utf8', timeout: 4000, windowsHide: true });
  if (/"status"\s*:\s*"ok"/.test(h.stdout || '')) { httpPort = p; break; }
}
console.log(`[discover] pid=${pidStr} httpPort=${httpPort}`);
const call = (method, body) => {
  const r = spawnSync('curl.exe', ['-s', '--max-time', '10', '-X', 'POST',
    `http://127.0.0.1:${httpPort}/exa.language_server_pb.LanguageServerService/${method}`,
    '-H', 'Content-Type: application/json', '-H', 'Connect-Protocol-Version: 1', '-H', `x-codeium-csrf-token: ${csrfToken}`,
    '-d', body], { encoding: 'utf8', timeout: 15000, windowsHide: true });
  return (r.stdout || '(empty)').slice(0, 250);
};
console.log('[ForceStopCascadeTree]', call('ForceStopCascadeTree', JSON.stringify({ conversationId: CID })));
