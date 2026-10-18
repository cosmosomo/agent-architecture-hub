#!/usr/bin/env node
// POST /api/gateway/session-control on real sessions: mode (ZCode, Hermes), compact (ZCode, Codex), effort and fork
// (Codex). Each opens its own verify- session with one short turn first. One blackboard row per (product, op).
//   node channels/probe/scripts/probe_session_control.js
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..', '..');
const BASE = 'http://127.0.0.1:8899';
const stamp = new Date().toISOString().replace(/\D/g, '').slice(4, 12);
async function http(method, p, body, timeoutMs = 240000) {
  const r = await fetch(BASE + p, { method, headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(timeoutMs) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.ok === false) throw new Error(`${method} ${p} → ${r.status} ${j.error || ''}`);
  return j;
}
const turn = async (ch, s, prompt) => {
  await http('POST', '/api/gateway/send', { channel: ch, sessionName: s, prompt, source: 'cli', permissions: 'all' });
  return (await http('GET', `/api/gateway/run?channel=${ch}&session=${encodeURIComponent(s)}&waitMs=240000`, null, 270000)).run || {};
};
const ctl = (ch, s, op, value, extra = {}) => http('POST', '/api/gateway/session-control', { channel: ch, sessionName: s, op, value, ...extra });

const cases = {
  async zcode() {
    const s = `verify-ctl-zcode-${stamp}`;
    const r0 = await turn('zcode', s, '只回复一行 CTL_OK。不要调用任何工具。');
    const out = [];
    const m = await ctl('zcode', s, 'mode', 'plan');
    // In plan mode the agent asks to leave it before writing; that ask must reach a person even with permissions "all".
    await http('POST', '/api/gateway/send', { channel: 'zcode', sessionName: s, prompt: '用写文件工具创建 ctl.txt，内容 hi，然后回复 DONE。', source: 'cli', permissions: 'all' });
    let appr = null;
    for (let i = 0; i < 60 && !appr; i++) {
      await new Promise((r) => setTimeout(r, 2000));
      appr = ((await http('GET', '/api/gateway/state')).pendingApprovals || []).find((a) => a.channel === 'zcode' && a.sessionName === s);
    }
    if (appr) await http('POST', '/api/gateway/approve', { id: appr.id, decision: 'reject' });
    const r1 = (await http('GET', `/api/gateway/run?channel=zcode&session=${encodeURIComponent(s)}&waitMs=240000`, null, 270000)).run || {};
    const written = fs.existsSync(path.join(r1.cwd || r0.cwd || '', 'ctl.txt'));
    out.push(['mode-switch', Boolean(appr) && !written, `${m.how} → plan（可选 ${(m.modes || []).join('、')}）；全放行下仍挂起审批：${appr ? appr.toolName : '没有'}，拒绝后 ${r1.runId} ${r1.status} 文件写出=${written}`]);
    const c = await ctl('zcode', s, 'compact');
    const rc = (await http('GET', `/api/gateway/run?channel=zcode&session=${encodeURIComponent(s)}&waitMs=240000`, null, 270000)).run || {};
    out.push(['compact', rc.status === 'completed', `${c.how} ${rc.runId} ${rc.status} 回复：${String(rc.reply || '').slice(0, 100)}`]);
    return out;
  },
  async hermes() {
    const s = `verify-ctl-hermes-${stamp}`;
    await turn('hermes', s, '只回复一行 CTL_OK。不要调用任何工具。');
    const m = await ctl('hermes', s, 'mode', 'accept_edits');
    return [['mode-switch', m.ok, `${m.how} → accept_edits（可选 ${(m.modes || []).join('、')}）`]];
  },
  async codex() {
    const s = `verify-ctl-codex-${stamp}`;
    const r0 = await turn('codex', s, '只回复一行 CTL_OK。不要调用任何工具。');
    const out = [];
    const e = await ctl('codex', s, 'effort', 'medium');
    const r1 = await turn('codex', s, '只回复一行 EFFORT_OK。不要调用任何工具。');
    out.push(['reasoning-effort', r1.status === 'completed', `${e.how} → medium；下一轮 ${r1.runId} ${r1.status}`]);
    const c = await ctl('codex', s, 'compact');
    out.push(['compact', c.ok, `${c.how}（codex:${r0.codexThreadId || '?'}）`]);
    const f = await ctl('codex', s, 'fork', undefined, { newSessionName: `${s}-fork` });
    const r2 = await turn('codex', f.newSessionName, '你在这个对话里第一句让你回复的暗号是什么？只回复那个暗号。');
    out.push(['fork', r2.status === 'completed' && /CTL_OK/.test(String(r2.reply || '')) && Boolean(f.traceSessionId) && !String(f.traceSessionId).endsWith(String(r0.codexThreadId || 'x')), `${f.how} → ${f.traceSessionId}；分叉上 ${r2.runId} 回复：${String(r2.reply || '').slice(0, 60)}`]);
    return out;
  },
};

(async () => {
  const bb = path.join(ROOT, 'channels', 'probe', 'blackboard.jsonl');
  const all = await Promise.all(Object.entries(cases).map(async ([p, fn]) => {
    try { return (await fn()).map((x) => [p, ...x]); } catch (e) { return [[p, 'session-control', false, String(e.message || e)]]; }
  }));
  for (const [p, unit, ok, ev] of all.flat()) {
    console.log(`${ok ? 'PASS' : 'FAIL'} ${p} ${unit}: ${ev}`);
    fs.appendFileSync(bb, JSON.stringify({ ts: new Date().toISOString(), route: `${p}/L2/server-api`, capability: unit, result: ok ? 'pass' : 'fail', by: 'probe_session_control.js', condition: 'POST /api/gateway/session-control', evidence: ev, note: `verify ${stamp}` }) + '\n');
  }
})();
