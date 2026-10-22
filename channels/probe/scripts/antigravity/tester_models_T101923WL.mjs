// tester-antigravity · 2026-10-20 · model-list 独立原生核对（暗号 T101923WL）
// 直连 language_server.exe Connect-RPC GetCascadeModelConfigData，取原生模型池原样清单。
import { spawnSync } from 'node:child_process';

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
console.log(`[discover] pid=${pidStr} httpPort=${httpPort} csrf=${csrfToken ? csrfToken.slice(0, 8) + '…' : '(none)'}`);
const rpc = spawnSync('curl.exe', [
  '-s', '--max-time', '10', '-X', 'POST',
  `http://127.0.0.1:${httpPort}/exa.language_server_pb.LanguageServerService/GetCascadeModelConfigData`,
  '-H', 'Content-Type: application/json',
  '-H', 'Connect-Protocol-Version: 1',
  '-H', `x-codeium-csrf-token: ${csrfToken}`,
  '-d', '{}',
], { encoding: 'utf8', timeout: 15000, windowsHide: true });
const j = JSON.parse(rpc.stdout || '{}');
const list = (j.clientModelConfigs || []).map((m) => ({ id: m.modelId, label: m.label }));
console.log(`[native] clientModelConfigs = ${list.length}`);
for (const m of list) console.log(`${m.id} | ${m.label}`);
if (!list.length) console.log('[native] raw head:', (rpc.stdout || '(empty)').slice(0, 200));
