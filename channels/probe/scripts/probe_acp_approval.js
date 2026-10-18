#!/usr/bin/env node
// In-turn approval on the resident ACP route: with permissions "reads", ask the agent to write a file; the turn
// should stop on an approval (pendingApprovals, inTurn), and after POST /api/gateway/approve the same run should
// finish and the file exist. One blackboard row per product.
//   node channels/probe/scripts/probe_acp_approval.js [--product zcode,workbuddy] [--reject]
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..', '..');
const BASE = 'http://127.0.0.1:8899';
const arg = (k) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : undefined; };
const products = (arg('product') || 'zcode,workbuddy,opencode,hermes').split(',');
const REJECT = process.argv.includes('--reject');
const stamp = new Date().toISOString().replace(/\D/g, '').slice(4, 12);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function http(method, p, body, timeoutMs = 60000) {
  const r = await fetch(BASE + p, { method, headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(timeoutMs) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${method} ${p} → ${r.status} ${j.error || ''}`);
  return j;
}

async function one(p) {
  const session = `verify-appr-${p}-${stamp}`;
  const file = `probe_perm_${p}_${stamp}.txt`;
  await http('POST', '/api/gateway/send', { channel: p, sessionName: session, source: 'cli', permissions: 'reads', prompt: `用你的写文件工具在当前工作目录创建文件 ${file}，内容只有一行 OK_${p}。写完只回复 DONE。` });
  let appr = null;
  let run = {};
  for (let i = 0; i < 90 && !appr; i++) {
    await sleep(2000);
    const st = await http('GET', '/api/gateway/state');
    appr = (st.pendingApprovals || []).find((a) => a.channel === p && a.sessionName === session && a.inTurn);
    run = (await http('GET', `/api/gateway/run?channel=${p}&session=${encodeURIComponent(session)}`)).run || {};
    if (!appr && run.status && run.status !== 'running') break;
  }
  if (!appr) return { p, ok: false, evidence: `没有等到轮内审批；run ${run.runId} ${run.status} 回复：${String(run.reply || run.text || '').slice(0, 120)} 拒绝过：${(run.deniedTools || []).join('、')}` };
  const runIdBefore = run.runId;
  await http('POST', '/api/gateway/approve', { id: appr.id, decision: REJECT ? 'reject' : 'approve' });
  const done = (await http('GET', `/api/gateway/run?channel=${p}&session=${encodeURIComponent(session)}&waitMs=180000`, null, 200000)).run || {};
  const cwd = done.cwd || run.cwd || '';
  const exists = Boolean(cwd) && fs.existsSync(path.join(cwd, file));
  const sameRun = done.runId === runIdBefore;
  const ok = REJECT ? sameRun && !exists : sameRun && done.status === 'completed' && exists;
  return { p, ok, evidence: `${appr.id}（${appr.toolName}）${REJECT ? '拒绝' : '批准'}后 ${done.runId} ${done.status} 同一轮=${sameRun} 文件存在=${exists}（${cwd}）` };
}

(async () => {
  const out = await Promise.all(products.map((p) => one(p).catch((e) => ({ p, ok: false, evidence: String(e.message || e) }))));
  const bb = path.join(ROOT, 'channels', 'probe', 'blackboard.jsonl');
  for (const r of out) {
    console.log(`${r.ok ? 'PASS' : 'FAIL'} ${r.p}: ${r.evidence}`);
    fs.appendFileSync(bb, JSON.stringify({ ts: new Date().toISOString(), route: `${r.p}/L2/server-api`, capability: 'permission', result: r.ok ? 'pass' : 'fail', by: 'probe_acp_approval.js', condition: `常驻 ACP 驱动，permissions=reads${REJECT ? '，拒绝' : ''}`, evidence: r.evidence, note: `verify ${stamp}` }) + '\n');
  }
})();
