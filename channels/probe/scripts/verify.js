#!/usr/bin/env node
// One command to test the backend for real: for every product the backend drives, run each testable unit on a fresh
// verify- session through the service's own endpoints, check the result against our run records and dispatch files,
// write one blackboard row per (product, unit), print a summary. Tests follow the four tables: a product is tested
// when products.json marks it backend; a unit when integration-map.json says the backend has it for that product.
//   node channels/probe/scripts/verify.js [--product zcode,opencode] [--unit open,cancel] [--base http://127.0.0.1:8899] [--dry]
// Also `node hub/tools/agent_gateway.js verify ...`.
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const arg = (k) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : undefined; };
const BASE = arg('base') || 'http://127.0.0.1:8899';
const DRY = process.argv.includes('--dry');
const data = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, 'hub', 'data', f), 'utf8'));
const products = data('products.json').products;
const integ = data('integration-map.json').backend || {};
const runsFile = path.join(os.homedir(), '.agent-hub', 'runs.jsonl');
const stamp = new Date().toISOString().replace(/\D/g, '').slice(4, 12);

// Cheap models for testing; the model-switch step goes to the second one. Claude: haiku, and sonnet only to switch.
// Codex: only gpt-6.1-sol works through the relay (gpt-6-luna answers 503), so its model switch is skipped.
// OpenCode: its own free models are blocked for this machine's IP; the Zhipu plan models are used.
const MODELS = {
  claude: ['haiku', 'sonnet'],
  antigravity: ['flash', 'flash_lite'],
  codex: ['gpt-6.1-sol'],
  opencode: ['zhipuai-coding-plan/glm-5.3-flash', 'zhipuai-coding-plan/glm-5.3'],
};
const modelsOf = (p) => MODELS[p.id] || [p.defaultModel, ...(p.models || []).filter((m) => m !== p.defaultModel)].filter(Boolean);

// A refused or reset local connection under the full concurrent run is retried once (the full test of 10-18 saw two).
async function http(method, p, body, timeoutMs = 60000, retried = false) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    let r;
    try {
      r = await fetch(BASE + p, { method, headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined, signal: ctl.signal });
    } catch (e) {
      if (retried || ctl.signal.aborted || !/fetch failed/i.test(String(e && e.message))) throw e;
      clearTimeout(t);
      await sleep(2000);
      return http(method, p, body, timeoutMs, true);
    }
    const text = await r.text(); let j; try { j = JSON.parse(text); } catch { j = { raw: text }; }
    if (!r.ok) throw new Error(`${method} ${p} → ${r.status} ${String(j.error || text).slice(0, 160)}`);
    return j;
  } finally { clearTimeout(t); }
}
const send = (ch, session, prompt, extra = {}) => http('POST', '/api/gateway/send', { channel: ch, sessionName: session, prompt, source: 'cli', permissions: 'all', ...extra });
const runOf = async (ch, session, waitMs = 180000) => (await http('GET', `/api/gateway/run?channel=${ch}&session=${encodeURIComponent(session)}&waitMs=${waitMs}`, null, waitMs + 30000)).run || {};
const inRunsFile = (id) => fs.existsSync(runsFile) && fs.readFileSync(runsFile, 'utf8').includes(id);
const has = (unit, ch) => (integ[unit] || []).some((e) => (e.channels || []).includes(ch) && e.status !== 'todo');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// One recipe per unit. Each returns { ok, evidence } and may use ctx (the session made by "open").
const RECIPES = {
  async open(p, ctx) {
    const tok = `VERIFY_OPEN_${p.id.toUpperCase()}_${stamp}`;
    await send(p.id, ctx.session, `只回复一行：${tok}。不要调用任何工具。`, { model: ctx.models[0] });
    const r = await runOf(p.id, ctx.session); ctx.traceSessionId = ctx.traceSessionId || r.traceSessionId;
    ctx.firstRun = r.runId;
    return { ok: r.status === 'completed' && String(r.reply || '').includes(tok) && inRunsFile(r.runId), evidence: `${r.runId} ${r.status} model=${r.model} reply含暗号=${String(r.reply || '').includes(tok)} runs.jsonl=${inRunsFile(r.runId)}` };
  },
  async resume(p, ctx) {
    const tok = `VERIFY_RESUME_${stamp}`;
    await send(p.id, ctx.session, `再回复一行：${tok}。不要调用任何工具。`);
    const r = await runOf(p.id, ctx.session);
    return { ok: r.status === 'completed' && r.runId !== ctx.firstRun && String(r.reply || '').includes(tok), evidence: `${r.runId} ${r.status} 同一会话第二轮 reply含暗号=${String(r.reply || '').includes(tok)}` };
  },
  async 'discover-sessions'(p, ctx) {
    const j = await http('GET', '/api/sessions?slim=1', null, 90000);
    const list = j.sessions || j;
    const s = list.find((x) => x.channel === p.id && (x.controlName === ctx.session || x.name === ctx.session));
    ctx.sessionId = s && s.id;
    return { ok: Boolean(s), evidence: s ? `列表里找到 ${s.id}（controlName=${ctx.session}）` : `列表里没有 controlName=${ctx.session}` };
  },
  async 'observe-history'(p, ctx) {
    if (!ctx.sessionId) return { ok: false, evidence: '没有会话编号（discover-sessions 没找到）' };
    const j = await http('GET', `/api/sessions/${encodeURIComponent(ctx.sessionId)}?tail=5`, null, 90000);
    const n = ((j.session || j).turns || []).length;
    return { ok: n >= 2, evidence: `${ctx.sessionId} 详情 ${n} 轮` };
  },
  async 'model-switch'(p, ctx) {
    const to = ctx.models[1];
    if (!to) return { skip: '只有一个可用模型' };
    await http('POST', '/api/gateway/model', { channel: p.id, sessionName: ctx.session, model: to });
    await send(p.id, ctx.session, '只回复一个字：好。不要调用任何工具。');
    const r = await runOf(p.id, ctx.session);
    return { ok: r.status === 'completed' && String(r.model || '').includes(to), evidence: `${r.runId} ${r.status} 换到 ${to} 后 run.model=${r.model}` };
  },
  async cancel(p, ctx) {
    await send(p.id, ctx.session, '从 1 数到 400，每个数字单独一行，不要调用任何工具。');
    await sleep(2500);
    await http('POST', '/api/gateway/cancel', { channel: p.id, sessionName: ctx.session });
    const r = await runOf(p.id, ctx.session, 60000);
    return { ok: ['aborted', 'cancelled', 'canceled'].includes(r.status), evidence: `${r.runId} 停之后 status=${r.status}` };
  },
  async 'spawn-subagent'(p) {
    const tok = `VERIFY_DSP_${p.id.toUpperCase()}_${stamp}`;
    const j = await http('POST', '/api/gateway/dispatch', { toChannel: p.id, toSessionName: `verify-dsp-${p.id}-${stamp}`, toModel: MODELS[p.id] ? MODELS[p.id][0] : undefined, task: `不要调用任何工具，只回复一行 ${tok}，并按派活单的要求交回。` });
    const id = (j.dispatch || {}).id;
    let d = {};
    let slow = 0;
    for (let i = 0; i < 36 && id; i++) {
      // One slow poll is not the unit failing; it is counted and shown in the evidence.
      const r = await http('GET', `/api/gateway/dispatches?id=${id}`, null, 30000).catch(() => (slow++, null));
      if (!r) continue;
      d = r.dispatch || (r.dispatches || []).find((x) => x.id === id) || {};
      if (['completed', 'failed'].includes(d.status)) break;
      await sleep(10000);
    }
    const back = String((d.delivery || {}).summary || (d.delivery || {}).reply || '');
    return { ok: d.status === 'completed' && back.includes(tok), evidence: `${id} ${d.status}/${d.receipt} 交回含暗号=${back.includes(tok)}${slow ? ` 轮询超时 ${slow} 次` : ''}` };
  },
  // The "一群会话" level: a goal of two tasks on this product, the second needs what the first handed back.
  async 'task-board'(p) {
    const tok = `VERIFY_TB_${p.id.toUpperCase()}_${stamp}`;
    const j = await http('POST', '/api/gateway/goals', {
      title: `verify-goal ${p.id} ${stamp}`,
      objective: '两件接力：第二件要用到第一件交回的内容',
      channel: p.id,
      model: MODELS[p.id] ? MODELS[p.id][0] : undefined,
      verifyBy: 'auto',
      budget: { maxDispatches: 4, maxParallel: 1 },
      tasks: [
        { key: 'a', title: `不要调用任何工具，只回复一行 ${tok}` },
        { key: 'b', title: '不要调用任何工具，把前置任务交回的那行暗号原样回复一次，后面紧跟 _B', dependsOn: ['a'] },
      ],
    });
    const id = j.goal.id;
    let v = {};
    let slow = 0;
    for (let i = 0; i < 48; i++) {
      const got = await http('GET', `/api/gateway/goals?id=${id}`, null, 30000).catch(() => (slow++, null));
      if (!got) continue;
      v = got;
      if (['completed', 'fused', 'paused', 'cancelled'].includes(v.goal.status)) break;
      await sleep(10000);
    }
    const b = (v.tasks || []).find((t) => t.key === 'b') || {};
    const passed = String((b.delivery || {}).reply || '').includes(tok + '_B');
    return { ok: v.goal && v.goal.status === 'completed' && passed, evidence: `${id} ${v.goal && v.goal.status}${v.goal && v.goal.reason ? '（' + v.goal.reason + '）' : ''} 派活 ${v.goal && v.goal.usage.dispatches} 次，第二件交回含 ${tok}_B=${passed}${slow ? ` 轮询超时 ${slow} 次` : ''}` };
  },
};
const ORDER = ['open', 'resume', 'discover-sessions', 'observe-history', 'model-switch', 'cancel', 'spawn-subagent', 'task-board'];

async function testProduct(p, units) {
  const ctx = { session: `verify-${p.id}-${stamp}`, models: modelsOf(p) };
  const out = [];
  for (const u of units) {
    if (!has(u, p.id)) { out.push({ unit: u, result: 'n/a', evidence: '后端没登记这一单元' }); continue; }
    if (u !== 'open' && u !== 'spawn-subagent' && u !== 'task-board' && !ctx.firstRun) { out.push({ unit: u, result: 'skip', evidence: '新建没成功，后面的步骤不跑' }); continue; }
    try {
      const r = await RECIPES[u](p, ctx);
      out.push(r.skip ? { unit: u, result: 'skip', evidence: r.skip } : { unit: u, result: r.ok ? 'pass' : 'fail', evidence: r.evidence });
    } catch (e) { out.push({ unit: u, result: 'fail', evidence: String(e.message || e).slice(0, 200) }); }
  }
  return { product: p.id, session: ctx.session, out };
}

(async () => {
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    console.log(`用法：node hub/tools/agent_gateway.js verify [--product ${products.filter((p) => p.backend).map((p) => p.id).join(',')}] [--unit ${ORDER.join(',')}] [--base http://127.0.0.1:8899] [--dry]\n不带参数 = 所有后端产品 × 所有单元，真跑，每格写一行黑板；--dry 只列不跑。`);
    return;
  }
  const only = (arg('product') || '').split(',').filter(Boolean);
  const units = (arg('unit') || '').split(',').filter(Boolean);
  const ps = products.filter((p) => p.backend && (!only.length || only.includes(p.id)));
  const us = ORDER.filter((u) => !units.length || units.includes(u));
  console.log(`verify ${stamp}: ${ps.map((p) => p.id).join(' ')} × ${us.join(' ')}${DRY ? '（dry，只列不跑）' : ''}`);
  if (DRY) return;
  const results = [];
  const queue = ps.slice();
  await Promise.all([0, 1, 2].map(async () => { while (queue.length) results.push(await testProduct(queue.shift(), us)); }));
  const bb = path.join(ROOT, 'channels', 'probe', 'blackboard.jsonl');
  for (const r of results) for (const x of r.out) if (x.result === 'pass' || x.result === 'fail') {
    fs.appendFileSync(bb, JSON.stringify({ ts: new Date().toISOString(), route: `${r.product}/L2/server-api`, capability: x.unit, result: x.result, by: 'verify.js', condition: `会话 ${r.session}`, evidence: x.evidence, note: `verify ${stamp}` }) + '\n');
  }
  console.log('\n产品'.padEnd(13) + us.map((u) => u.padEnd(18)).join(''));
  for (const r of results.sort((a, b) => a.product.localeCompare(b.product))) console.log(r.product.padEnd(12) + us.map((u) => (r.out.find((x) => x.unit === u) || {}).result || '-').map((s) => s.padEnd(18)).join(''));
  console.log('\n没过的：');
  for (const r of results) for (const x of r.out) if (x.result === 'fail') console.log(`  ${r.product} ${x.unit}: ${x.evidence}`);
})().catch((e) => { console.error(e); process.exit(1); });
