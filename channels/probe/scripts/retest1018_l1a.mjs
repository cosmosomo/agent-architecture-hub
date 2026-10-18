// L1a 直连 claude-agent-acp 桥的复测脚本（observe-history/state/cancel/close/compact/model-list/model-new/mode-switch/quota）
// 结果增量写 l1a_results.json；每步的原始返回都保留。
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { Readable, Writable } from 'node:stream';

const WS = 'C:/Users/COLORFIRE/hub-workspaces/probe-retest-zcode-1018';
const SDK = process.env.APPDATA + '/npm/node_modules/acpx/node_modules/@agentclientprotocol/sdk/dist/acp.js';
const { ClientSideConnection, ndJsonStream } = await import(pathToFileURL(SDK).href);

const N1 = fs.readFileSync(path.join(WS, 'n1_id.txt'), 'utf8').trim();
const results = {};
const save = () => fs.writeFileSync(path.join(WS, 'l1a_results.json'), JSON.stringify(results, null, 1));
const step = (k, v) => { results[k] = v; save(); console.log('STEP', k, 'done'); };

// 事件与审批策略（可变）
const updates = [];           // {sessionId, update}
let permPolicy = 'deny';      // 'deny' | 'allow'
const permLog = [];

const clientImpl = {
  async requestPermission(params) {
    const opts = (params.options || []).map(o => ({ id: o.optionId, name: o.name, kind: o.kind }));
    permLog.push({ sessionId: params.sessionId, toolCall: params.toolCall && params.toolCall.rawInput ? 'has-rawInput' : JSON.stringify(params.toolCall || {}).slice(0, 120), options: opts });
    const allow = permPolicy === 'allow';
    const pick = allow
      ? (opts.find(o => o.kind === 'allow_once') || opts.find(o => /allow/i.test(o.id)) || opts[0])
      : (opts.find(o => o.kind === 'reject_once') || opts.find(o => /deny|reject/i.test(o.id)) || opts[0]);
    return { outcome: { outcome: 'selected', optionId: pick.id } };
  },
  async sessionUpdate(params) {
    updates.push({ sessionId: params.sessionId, update: params.update });
  },
  async writeTextFile(params) { fs.writeFileSync(params.path, params.content); return {}; },
  async readTextFile(params) { return { content: fs.readFileSync(params.path, 'utf8') }; },
};
const clientProxy = new Proxy(clientImpl, {
  get(t, p) {
    if (p in t) return t[p];
    return async () => { throw new Error('client method not implemented: ' + String(p)); };
  },
});

// 拉起桥（清掉宿主变量；cwd=probe 工作区）
const env = { ...process.env };
delete env.ANTHROPIC_API_KEY; delete env.CLAUDECODE; delete env.CLAUDE_CODE_ENTRYPOINT; delete env.CLAUDE_CODE_SSE_PORT;
const BRIDGE = process.env.APPDATA + '/npm/node_modules/@agentclientprotocol/claude-agent-acp/dist/index.js';
const proc = spawn(process.execPath, [BRIDGE], { cwd: WS, env, stdio: ['pipe', 'pipe', 'pipe'] });
proc.stderr.on('data', d => { const s = d.toString(); if (s.trim()) console.error('[bridge stderr]', s.slice(0, 200)); });
const stream = ndJsonStream(Writable.toWeb(proc.stdin), Readable.toWeb(proc.stdout));
const conn = new ClientSideConnection(() => clientProxy, stream);

const withTimeout = (p, ms, tag) => Promise.race([
  p,
  new Promise((_, rej) => setTimeout(() => rej(new Error('TIMEOUT:' + tag)), ms)),
]);

// 发 prompt 并收集该轮的 updates
async function runPrompt(sessionId, text, tag, timeoutMs = 100000) {
  const before = updates.length;
  let resp;
  try {
    resp = await withTimeout(conn.prompt({ sessionId, prompt: [{ type: 'text', text }] }), timeoutMs, tag);
  } catch (e) {
    return { error: String(e.message || e), updates: updates.slice(before) };
  }
  return { stopReason: resp.stopReason, _meta: resp._meta, updates: updates.slice(before) };
}
const texts = us => us.map(u => u.update.sessionUpdate === 'agent_message_chunk' ? (u.update.content && u.update.content.text) : null).filter(Boolean).join('');

try {
  // 1. initialize + newSession（model-list 证据 + 能力声明）
  const init = await withTimeout(conn.initialize({
    protocolVersion: 1,
    clientCapabilities: { fs: { readTextFile: true, writeTextFile: true }, terminal: true },
    clientInfo: { name: 'zcode-retest-1018', version: '0.0.1' },
  }), 30000, 'initialize');
  step('initialize', {
    protocolVersion: init.protocolVersion,
    agentCapabilities: init.agentCapabilities,
    authMethods: init.authMethods,
  });

  const sessA = await withTimeout(conn.newSession({ cwd: WS, mcpServers: [] }), 60000, 'newSession-A');
  const modelCfg = (sessA.configOptions || []).map(c => ({ id: c.id, current: c.currentValue, options: (c.options || (c.valueType === 'string' ? undefined : undefined) || []).map ? undefined : undefined, rawOptions: c.options }));
  step('newSession-A', {
    sessionId: sessA.sessionId, modes: sessA.modes, modelConfig: modelCfg,
    _meta: sessA._meta,
  });

  // 2. A1: 记暗号（含 _meta，给 quota/model-new 用）
  const a1 = await runPrompt(sessA.sessionId, '记住暗号 PROBE_RT_ACP_A_777，只回复 ACK_A', 'A1');
  step('A1_secret', { stopReason: a1.stopReason, _meta: a1._meta, text: texts(a1.updates).slice(0, 120), error: a1.error, updateKinds: a1.updates.map(u => u.update.sessionUpdate) });

  // 3. A2: 问暗号（桥内 resume）
  const a2 = await runPrompt(sessA.sessionId, '暗号是什么？只回复暗号本身', 'A2');
  step('A2_recall', { stopReason: a2.stopReason, text: texts(a2.updates).slice(0, 120), error: a2.error });

  // 4. observe-history：loadSession 原生会话 N1
  const updatesBeforeLoad = updates.length;
  let loadResp = null, loadErr = null;
  try { loadResp = await withTimeout(conn.loadSession({ cwd: WS, mcpServers: [], sessionId: N1 }), 90000, 'loadSession'); }
  catch (e) { loadErr = String(e.message || e); }
  const replay = updates.slice(updatesBeforeLoad);
  step('loadSession-N1', {
    loadResp, loadErr,
    replayCount: replay.length,
    replayKinds: [...new Set(replay.map(u => u.update.sessionUpdate))],
    replaySample: replay.slice(0, 6).map(u => JSON.stringify(u.update).slice(0, 220)),
    replayAll: replay.map(u => JSON.stringify(u.update).slice(0, 500)),
  });
  const h1 = await runPrompt(sessA.sessionId === N1 ? N1 : N1, '暗号是什么？只回复暗号本身', 'H1');
  step('N1_recall_after_load', { stopReason: h1.stopReason, text: texts(h1.updates).slice(0, 120), error: h1.error });

  // 5. state：长任务运行中可观察（in-flight updates）
  const longP = runPrompt(N1, '从 1 数到 300，每行一个数，数完回复 COUNT_DONE', 'LONG', 120000);
  await new Promise(r => setTimeout(r, 10000));
  const inFlightKinds = updates.slice(-12).map(u => u.update.sessionUpdate);
  const longRes = await longP;
  step('state_inflight', {
    inFlightUpdateKindsAt10s: inFlightKinds,
    finalStopReason: longRes.stopReason,
    finalTextTail: texts(longRes.updates).slice(-60),
    updateCount: longRes.updates.length,
  });

  // 6. cancel：长轮中打断，再验会话存活
  permPolicy = 'deny';
  const bigP = runPrompt(N1, '从 1 数到 900，每行一个数，数完回复 BIG_DONE', 'BIG', 120000);
  await new Promise(r => setTimeout(r, 8000));
  let cancelErr = null;
  try { await conn.cancel({ sessionId: N1 }); } catch (e) { cancelErr = String(e.message || e); }
  const bigRes = await bigP;
  const c1 = await runPrompt(N1, '回复 STILL_ALIVE', 'STILL', 60000);
  step('cancel', { cancelErr, stopReasonAfterCancel: bigRes.stopReason, textAfterCancel: texts(bigRes.updates).slice(-80), followUp: { stopReason: c1.stopReason, text: texts(c1.updates).slice(0, 60) } });

  // 7. close：关会话，再 prompt 应报错
  let closeResp = null, closeErr = null, afterClose = null;
  try { closeResp = await withTimeout(conn.closeSession({ sessionId: N1 }), 30000, 'closeSession'); }
  catch (e) { closeErr = String(e.message || e); }
  try { const r = await runPrompt(N1, '回复 AFTER_CLOSE', 'AC', 30000); afterClose = r; }
  catch (e) { afterClose = { error: String(e.message || e) }; }
  step('close', { closeResp, closeErr, afterClose: { error: afterClose.error, stopReason: afterClose.stopReason, text: afterClose.updates ? texts(afterClose.updates).slice(0, 60) : undefined } });

  // 8. compact：新会话 B，大材料 → /compact → 对比用量
  const sessB = await withTimeout(conn.newSession({ cwd: WS, mcpServers: [] }), 60000, 'newSession-B');
  const mat = fs.readFileSync(path.join(WS, 'material.txt'), 'utf8');
  const b1 = await runPrompt(sessB.sessionId, mat + '\n标记词：PROBE_RT_ACP_COMPACT_888。只回复 MATERIAL_OK', 'B1', 120000);
  step('B1_big_material', { stopReason: b1.stopReason, _meta: b1._meta, text: texts(b1.updates).slice(0, 60), error: b1.error });
  const b2 = await runPrompt(sessB.sessionId, '/compact', 'B2', 120000);
  step('B2_compact', { stopReason: b2.stopReason, _meta: b2._meta, text: texts(b2.updates).slice(0, 200), error: b2.error });
  const b3 = await runPrompt(sessB.sessionId, '材料里的标记词是什么？只回复标记词本身', 'B3', 90000);
  step('B3_after_compact', { stopReason: b3.stopReason, _meta: b3._meta, text: texts(b3.updates).slice(0, 120), error: b3.error });

  // 9. model-new：newSession 时带 _meta 选模型（桥特定），D 会话
  let sessDResp = null, sessDErr = null;
  try {
    sessDResp = await withTimeout(conn.newSession({
      cwd: WS, mcpServers: [],
      _meta: { claudeCode: { options: { settings: { env: { ANTHROPIC_MODEL: 'claude-haiku-5-5' } } } } },
    }), 60000, 'newSession-D');
  } catch (e) { sessDErr = String(e.message || e); }
  step('newSession-D-modelmeta', sessDResp ? { sessionId: sessDResp.sessionId, modelConfig: (sessDResp.configOptions || []).map(c => ({ id: c.id, current: c.currentValue })), _meta: sessDResp._meta } : { error: sessDErr });
  if (sessDResp) {
    const d1 = await runPrompt(sessDResp.sessionId, '回复 D_READY', 'D1');
    step('D1_modelnew_turn', { stopReason: d1.stopReason, _meta: d1._meta, text: texts(d1.updates).slice(0, 60), error: d1.error });

    // 10. mode-switch：D 会话 plan → 写文件被挡；acceptEdits → 写成功
    let modeSet = null, modeErr = null;
    try { modeSet = await withTimeout(conn.setSessionMode({ sessionId: sessDResp.sessionId, modeId: 'plan' }), 30000, 'setSessionMode'); }
    catch (e) { modeErr = String(e.message || e); }
    step('setMode_plan', { modeSet, modeErr });
    permPolicy = 'deny';
    const dp = await runPrompt(sessDResp.sessionId, '用 Write 工具在当前目录创建文件 acp_plan.txt，内容 PLAN_TRY', 'DP', 90000);
    step('D_plan_write', { stopReason: dp.stopReason, text: texts(dp.updates).slice(0, 200), permLog: permLog.slice(), error: dp.error });
    fs.rmFileSync ? null : null;
    const planFileExists1 = fs.existsSync(path.join(WS, 'acp_plan.txt'));

    let modeSet2 = null, modeErr2 = null;
    try { modeSet2 = await withTimeout(conn.setSessionMode({ sessionId: sessDResp.sessionId, modeId: 'acceptEdits' }), 30000, 'setSessionMode2'); }
    catch (e) { modeErr2 = String(e.message || e); }
    permPolicy = 'allow';
    const de = await runPrompt(sessDResp.sessionId, '现在用 Write 工具在当前目录创建文件 acp_edit.txt，内容 EDIT_OK', 'DE', 90000);
    step('D_acceptEdits_write', { modeSet2, modeErr2, stopReason: de.stopReason, text: texts(de.updates).slice(0, 150), planFileExists: planFileExists1, editFileExists: fs.existsSync(path.join(WS, 'acp_edit.txt')), editFileContent: (() => { try { return fs.readFileSync(path.join(WS, 'acp_edit.txt'), 'utf8'); } catch (e) { return null; } })(), permLogTail: permLog.slice(-3) });
  }

  // 11. quota：用 A1/B1 的 _meta 原文（已在上面），这里再抓一轮当前会话（若还开着）做对照
  step('permLog_final', permLog);
  console.log('ALL STEPS DONE');
} catch (e) {
  step('fatal', { error: String(e.stack || e) });
} finally {
  try { proc.kill(); } catch (e) {}
  setTimeout(() => process.exit(0), 500);
}
