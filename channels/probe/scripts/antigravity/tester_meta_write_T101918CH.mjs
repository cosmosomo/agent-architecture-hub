// tester-antigravity · 2026-10-20 · native-meta-write 测试题（暗号 T101918CH）
// L0 原生入口：Connect-RPC UpdateConversationAnnotations 把隔离 probe 会话改名为
// meta-test-T101918CH，然后核对原生持久化（annotations/<cid>.pbtxt + conversation_summaries.db）。
// 只读探测与一次性 RPC，不写共享记录文件。
import { spawnSync } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const CID = process.argv[2] || 'a5e71081-591c-4f3f-8b9d-a322bb4e21d8';
const NEW_TITLE = 'meta-test-T101918CH';
const HOME = os.homedir();

const psScript =
  "$p = Get-CimInstance Win32_Process -Filter \"Name = 'language_server.exe'\" | Select-Object -First 1; " +
  'if (-not $p) { exit 1 }; ' +
  "$csrf = [regex]::Match($p.CommandLine, '--csrf_token\\s+([a-f0-9-]+)').Groups[1].Value; " +
  '$ports = (Get-NetTCPConnection -OwningProcess $p.ProcessId -State Listen -ErrorAction SilentlyContinue).LocalPort | Sort-Object -Unique; ' +
  'Write-Output ("$($p.ProcessId)|$csrf|" + ($ports -join ","))';
const res = spawnSync('powershell.exe', ['-NoProfile', '-Command', psScript], { encoding: 'utf8', timeout: 8000, windowsHide: true });
const [pidStr, csrfToken, portsStr] = (res.stdout || '').trim().split('|');
const ports = (portsStr || '').split(',').map(Number).filter(Boolean);
let httpPort = null;
for (const p of ports) {
  const h = spawnSync('curl.exe', ['-s', '--max-time', '2', `http://127.0.0.1:${p}/healthz`], { encoding: 'utf8', timeout: 4000, windowsHide: true });
  if (/"status"\s*:\s*"ok"/.test(h.stdout || '')) { httpPort = p; break; }
}
if (!csrfToken || !httpPort) {
  console.log(JSON.stringify({ ok: false, step: 'discover', stdout: res.stdout, stderr: res.stderr, status: res.status }));
  process.exit(1);
}
console.log(`[discover] pid=${pidStr} httpPort=${httpPort} csrf=${csrfToken.slice(0, 8)}…`);

const dbPath = path.join(HOME, '.gemini', 'antigravity', 'conversation_summaries.db');
const readTitle = () => {
  const db = new DatabaseSync(dbPath, { readOnly: true });
  try {
    const row = db.prepare('SELECT conversation_id, title, status, not_fully_idle FROM conversation_summaries WHERE conversation_id = ?').get(CID);
    return row || null;
  } finally { db.close(); }
};

const before = readTitle();
console.log(`[before-db] ${JSON.stringify(before)}`);
const annPath = path.join(HOME, '.gemini', 'antigravity', 'annotations', `${CID}.pbtxt`);
const beforeAnn = fs.existsSync(annPath) ? fs.readFileSync(annPath, 'utf8') : '(no pbtxt)';
console.log(`[before-pbtxt] ${beforeAnn.replace(/\s+/g, ' ').slice(0, 300)}`);

const body = JSON.stringify({ cascadeId: CID, annotations: { title: NEW_TITLE }, mergeAnnotations: true });
const rpc = spawnSync('curl.exe', [
  '-s', '--max-time', '10', '-X', 'POST',
  `http://127.0.0.1:${httpPort}/exa.language_server_pb.LanguageServerService/UpdateConversationAnnotations`,
  '-H', 'Content-Type: application/json',
  '-H', 'Connect-Protocol-Version: 1',
  '-H', `x-codeium-csrf-token: ${csrfToken}`,
  '-d', body,
], { encoding: 'utf8', timeout: 15000, windowsHide: true });
console.log(`[rpc] http=${rpc.status} body=${rpc.stdout || '(empty)'} ${rpc.stderr ? 'stderr=' + rpc.stderr.trim() : ''}`);

const after = readTitle();
console.log(`[after-db] ${JSON.stringify(after)}`);
const afterAnn = fs.existsSync(annPath) ? fs.readFileSync(annPath, 'utf8').replace(/\s+/g, ' ').slice(0, 300) : '(no pbtxt)';
console.log(`[after-pbtxt] ${afterAnn}`);
console.log(`[verdict-db] ${after && after.title === NEW_TITLE ? 'title persisted in SQLite' : 'title NOT persisted in SQLite'}`);
console.log(`[verdict-pbtxt] ${afterAnn.includes(NEW_TITLE) ? 'title persisted in pbtxt' : 'title NOT in pbtxt'}`);
