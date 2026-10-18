#!/usr/bin/env node
// An agent asks a person mid-turn (unit ask-user): ask it to use its own question tool, wait for the question in
// /api/gateway/state pendingQuestions, answer through POST /api/gateway/answer, and check the same run finishes
// using the answer. One blackboard row per product.
//   node channels/probe/scripts/probe_ask_user.js [--product claude,codex,zcode] [--base http://127.0.0.1:18904]
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..', '..');
const arg = (k) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : undefined; };
// --base http://127.0.0.1:18904 tests a second copy (HUB_BACKGROUND=0) without restarting the main service.
const BASE = arg('base') || 'http://127.0.0.1:8899';
const products = (arg('product') || 'claude,codex').split(',');
const stamp = new Date().toISOString().replace(/\D/g, '').slice(4, 12);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function http(method, p, body, timeoutMs = 60000) {
  const r = await fetch(BASE + p, { method, headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(timeoutMs) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.ok === false) throw new Error(`${method} ${p} → ${r.status} ${j.error || ''}`);
  return j;
}
const PROMPT = {
  claude: '用 AskUserQuestion 工具问我一个单选题：我更喜欢红色还是蓝色（两个选项：红色、蓝色）。拿到我的回答后，只回复一行：你选了<颜色>。不要做别的。',
  // ZCode turns AskUserQuestion into a permission ask whose options are the answers (channels/probe/results/ask-user-acp-20261019.md).
  zcode: '用 AskUserQuestion 工具问我一个单选题：我更喜欢红色还是蓝色（两个选项：红色、蓝色）。拿到我的回答后，只回复一行：你选了<颜色>。不要做别的。',
  codex: 'Use your request_user_input tool to ask me one question: do I prefer red or blue (options: red, blue). After I answer, reply with exactly one line: YOU CHOSE <colour>. Do nothing else.',
};
const ANSWER = { claude: '蓝色', codex: 'blue', zcode: '蓝色' };

async function one(p) {
  const session = `verify-ask-${p}-${stamp}`;
  // Codex offers its question tool (request_user_input) in plan mode only.
  if (p === 'codex') await http('POST', '/api/gateway/session-control', { channel: p, sessionName: session, op: 'mode', value: 'plan' });
  const sent = await http('POST', '/api/gateway/send', { channel: p, sessionName: session, source: 'cli', permissions: 'all', prompt: PROMPT[p], model: p === 'claude' ? 'haiku' : undefined });
  let q = null;
  let run = {};
  for (let i = 0; i < 60 && !q; i++) {
    await sleep(2000);
    q = ((await http('GET', '/api/gateway/state')).pendingQuestions || []).find((x) => x.channel === p && x.sessionName === session);
    run = (await http('GET', `/api/gateway/run?channel=${p}&session=${encodeURIComponent(session)}`)).run || {};
    if (!q && run.status && run.status !== 'running') break;
  }
  if (!q) return { p, ok: false, evidence: `没有等到提问；run ${run.runId} ${run.status} 回复：${String(run.reply || run.text || '').slice(0, 160)}` };
  const opt = q.questions[0].options.find((o) => o.label.toLowerCase().includes(ANSWER[p].toLowerCase()));
  await http('POST', '/api/gateway/answer', { id: q.id, answers: { [q.questions[0].id]: [opt ? opt.label : ANSWER[p]] } });
  const done = (await http('GET', `/api/gateway/run?channel=${p}&session=${encodeURIComponent(session)}&waitMs=180000`, null, 200000)).run || {};
  const reply = String(done.reply || done.text || '');
  const used = reply.toLowerCase().includes(ANSWER[p].toLowerCase());
  const same = done.runId === (sent.runId || run.runId);
  return { p, ok: done.status === 'completed' && used && same, evidence: `${q.id}「${q.questions[0].question.slice(0, 40)}」选项 ${q.questions[0].options.map((o) => o.label).join('/')}，答 ${opt ? opt.label : ANSWER[p]}；${done.runId} ${done.status} 同一轮=${same} 回复用上答案=${used}：${reply.slice(0, 80)}` };
}

(async () => {
  const out = await Promise.all(products.map((p) => one(p).catch((e) => ({ p, ok: false, evidence: String(e.message || e) }))));
  const bb = path.join(ROOT, 'channels', 'probe', 'blackboard.jsonl');
  for (const r of out) {
    console.log(`${r.ok ? 'PASS' : 'FAIL'} ${r.p}: ${r.evidence}`);
    fs.appendFileSync(bb, JSON.stringify({ ts: new Date().toISOString(), route: `${r.p}/L2/server-api`, capability: 'ask-user', result: r.ok ? 'pass' : 'fail', by: 'probe_ask_user.js', condition: 'POST /api/gateway/answer，轮内', evidence: r.evidence, note: `verify ${stamp}` }) + '\n');
  }
})();
