#!/usr/bin/env node
// acp_resident_bridge.mjs — ACP 常驻桥驱动（research-acp / zcode，2026-10-19）
// 作用：中心侧驱动四家（zcode/workbuddy/opencode/hermes）的常驻 ACP 桥，
//   提供 1) 真活闭环（task：派一件真活→中途问答→收回产物并核验）
//        2) fork 实测（session/fork 后问原会话内容）
//        3) load 实测（session/load 恢复既有会话）。
// 改动说明（交负责人过目）：本文件为 hub/tools/ 下新增驱动，不改中心主体（trace/、m/）。
//   产品命令与 env 取自 ~/.acpx/config.json 与 hub/data/products.json（与 acpx 一致）。
// 用法：
//   node hub/tools/acp_resident_bridge.mjs task  --product <id> [--ask 苹果|香蕉|--no-ask] [--model <id>]
//   node hub/tools/acp_resident_bridge.mjs fork  --product <id>
//   node hub/tools/acp_resident_bridge.mjs load  --product <id> --session <原生会话id>
import { spawn } from 'node:child_process';
import readline from 'node:readline';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const HOME = os.homedir();
const HUB = path.resolve(import.meta.dirname, '..', '..'); // 仓库根（本文件在 hub/tools/ 下）
const CWD = process.cwd();
const acpxConfig = (() => { try { return JSON.parse(fs.readFileSync(path.join(HOME, '.acpx', 'config.json'), 'utf8')); } catch { return {}; } })();
const productsData = (() => { try { return JSON.parse(fs.readFileSync(path.join(HUB, 'hub', 'data', 'products.json'), 'utf8')); } catch { return {}; } })();

function resolveCommand(agent) {
  let argv = [agent, 'acp'];
  if (acpxConfig.agents?.[agent]?.argv) argv = acpxConfig.agents[agent].argv;
  if (process.platform === 'win32' && !path.isAbsolute(argv[0])) return { cmd: 'cmd.exe', args: ['/d', '/s', '/c', ...argv] };
  return { cmd: argv[0], args: argv.slice(1) };
}
function agentEnv(agent) {
  const prod = (productsData.products || []).find((p) => p.id === agent);
  const env = { ...process.env };
  delete env.CLAUDECODE; delete env.ANTHROPIC_API_KEY;
  for (const [k, v] of Object.entries(prod?.env || {})) env[k] = typeof v === 'string' ? v.replace('{HOME}', HOME) : v;
  return env;
}

export class AcpBridge {
  constructor(agent, { onEvent } = {}) {
    this.agent = agent;
    this.onEvent = onEvent || (() => {});
    this.reqId = 1;
    this.pending = new Map();
    this.chunks = '';
    this.toolCalls = [];
    this.permissionFrames = [];
    this.extMethodCalls = []; // 我们主动调过的 extMethod 及其结果
    this.askRounds = [];      // 提问/答题记录
  }
  call(method, params) {
    const id = this.reqId++;
    return new Promise((res, rej) => { this.pending.set(id, { res, rej }); this.#write({ jsonrpc: '2.0', id, method, params }); });
  }
  #write(payload) { if (this.cp?.stdin && !this.cp.stdin.destroyed) this.cp.stdin.write(JSON.stringify(payload) + '\n'); }
  #result(id, result) { this.#write({ jsonrpc: '2.0', id, result }); }
  #log(...a) { console.error(`[${this.agent}]`, ...a); }

  async start(opts = {}) {
    const { cmd, args } = resolveCommand(this.agent);
    this.cp = spawn(cmd, args, { cwd: CWD, env: agentEnv(this.agent), stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
    this.pid = this.cp.pid;
    readline.createInterface({ input: this.cp.stdout }).on('line', (l) => this.#handleLine(l, opts));
    this.cp.stderr.on('data', (d) => { const s = String(d); if (!/DeprecationWarning|ExperimentalWarning/.test(s)) this.#log('[stderr]', s.trim().slice(0, 160)); });
    const init = await this.call('initialize', {
      protocolVersion: 1,
      clientInfo: { name: 'hub-acp-resident-bridge', version: '0.1.0' },
      clientCapabilities: { fs: { readTextFile: true, writeTextFile: true }, terminal: false, _meta: { 'codebuddy.ai': { question: true } } },
    });
    this.agentCaps = init?.agentCapabilities || {};
    return init;
  }
  #handleLine(line, opts) {
    const t = line.trim(); if (!t) return;
    let msg; try { msg = JSON.parse(t); } catch { return; }
    // 响应
    if (msg.id !== undefined && msg.method === undefined) {
      const p = this.pending.get(msg.id);
      if (p) { this.pending.delete(msg.id); msg.error ? p.rej(msg.error) : p.res(msg.result); }
      return;
    }
    // 服务端请求（审批 / 提问 / fs 委托）
    if (msg.id !== undefined && msg.method !== undefined) return void this.#handleServerRequest(msg, opts);
    // 通知
    if (msg.method === 'session/update') {
      const u = msg.params?.update || {};
      if (u.sessionUpdate === 'agent_message_chunk') { this.chunks += u.content?.text || ''; this.onEvent({ type: 'chunk', text: u.content?.text || '' }); }
      else if (u.sessionUpdate === 'tool_call') { this.toolCalls.push({ id: u.toolCallId, name: u._meta?.['codebuddy.ai/toolName'] || u.title, status: u.status, rawInput: u.rawInput }); this.onEvent({ type: 'tool_call', u }); }
      else this.onEvent({ type: u.sessionUpdate, u });
      return;
    }
    if (msg.method === 'session/available_commands_update') { this.commands = msg.params?.commands || []; return; }
  }
  #handleServerRequest(msg, opts) {
    const { method, params } = msg;
    if (method === 'session/request_permission') {
      this.permissionFrames.push(params);
      const tc = params?.toolCall || {};
      const options = params?.options || [];
      const toolName = tc._meta?.['codebuddy.ai/toolName'] || tc.title || '';
      this.#log('permission frame:', JSON.stringify(params).slice(0, 500));
      // WorkBuddy 提问流：问题可在 request_permission.rawInput，也可只在先前的 tool_call 更新里；
      // answers 的 key 用 q_0，桥端 handleResolveInterruption 会把别名归一化成问题原文。
      const isAsk = /askuser/i.test(toolName) || /askuser/i.test(tc.title || '') || /askuser/i.test(String(this.toolCalls.at(-1)?.name || ''));
      const askQ = (tc.rawInput?.questions || [])[0] || (this.toolCalls.at(-1)?.rawInput?.questions || [])[0];
      if (this.agent === 'workbuddy' && isAsk && opts.answer) {
        this.#log('ask:', JSON.stringify(askQ || { key: 'q_0' }).slice(0, 200), '->', opts.answer);
        this.askRounds.push({ question: askQ?.question, options: (askQ?.options || []).map((o) => o.label), answer: opts.answer });
        this.#result(msg.id, { outcome: { outcome: 'selected', optionId: 'allow' } });
        setTimeout(() => {
          const answers = askQ?.question ? { [askQ.question]: opts.answer } : { q_0: opts.answer };
          this.call('_codebuddy.ai/resolveInterruption', { sessionId: this.sessionId, toolCallId: tc.toolCallId, decision: 'allow', answers })
            .then((r) => { this.extMethodCalls.push({ method: '_codebuddy.ai/resolveInterruption', result: r }); this.#log('resolveInterruption ->', JSON.stringify(r)); })
            .catch((e) => { this.extMethodCalls.push({ method: '_codebuddy.ai/resolveInterruption', error: e }); this.#log('resolveInterruption error', JSON.stringify(e).slice(0, 200)); });
        }, 500);
        return;
      }
      // ZCode 式提问：request_permission 的选项本身就是业务选项（非 allow/reject）
      const real = options.filter((o) => !/allow|reject|deny/i.test(o.optionId));
      if (real.length > 0 && opts.answer) {
        const pick = real.find((o) => (o.name || o.optionId) === opts.answer) || real[0];
        this.askRounds.push({ question: tc.title, options: real.map((o) => o.name || o.optionId), answer: pick.name || pick.optionId });
        this.#log('ask(zc-style):', tc.title, '->', pick.optionId);
        this.#result(msg.id, { outcome: { outcome: 'selected', optionId: pick.optionId } });
        return;
      }
      // 普通审批：放行一次
      this.#log('permission:', toolName || tc.title, options.map((o) => o.optionId).join('|'));
      const allow = options.find((o) => o.kind === 'allow_once') || options[0];
      this.#result(msg.id, { outcome: { outcome: 'selected', optionId: allow?.optionId || 'allow' } });
      return;
    }
    if (method === 'fs/read_text_file' || method === 'fs/write_text_file') {
      // 客户端 FS 委托：WorkBuddy 审批后由客户端写盘
      if (method === 'fs/write_text_file') { try { fs.mkdirSync(path.dirname(params.path), { recursive: true }); fs.writeFileSync(params.path, params.content ?? '', 'utf8'); } catch (e) { this.#log('fs write failed', e.message); } }
      this.#result(msg.id, {});
      return;
    }
    this.#log('unhandled server request:', method);
    this.#result(msg.id, {});
  }
  async newSession(cwd) {
    const r = await this.call('session/new', { cwd, mcpServers: [] });
    this.sessionId = r.sessionId;
    return r;
  }
  async setModel(modelId) { if (modelId) try { await this.call('session/set_model', { sessionId: this.sessionId, modelId }); } catch (e) { this.#log('set_model notice:', e?.message || e); } }
  prompt(text, { timeoutMs = 240000 } = {}) {
    return Promise.race([
      this.call('session/prompt', { sessionId: this.sessionId, prompt: [{ type: 'text', text }] }),
      new Promise((r) => setTimeout(() => r({ timeout: true }), timeoutMs)),
    ]);
  }
  async fork(cwd) { const r = await this.call('session/fork', { sessionId: this.sessionId, cwd }); return r; }
  async load(sessionId, cwd) { const r = await this.call('session/load', { sessionId, cwd }); this.sessionId = sessionId; return r; }
  close() { try { this.cp?.kill(); } catch {} }
}

// ---- 子命令 ----
function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) args[a.slice(2)] = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
    else args._.push(a);
  }
  return args;
}

async function runTask(args) {
  const product = args.product;
  const stamp = new Date().toISOString().slice(0, 10);
  const outDir = path.join(HUB, 'channels', 'probe', 'scripts', 'output', `closed-loop-${stamp}`);
  fs.mkdirSync(outDir, { recursive: true });
  const artifact = path.join(outDir, `${product}-loop.md`);
  const answer = args.ask === false || args['no-ask'] ? null : (args.ask || '香蕉');
  const canAsk = Boolean(answer) && (product === 'workbuddy' || product === 'zcode'); // 仅这两家 ACP 提问已通
  const fixedCode = 'CENTER-LOOP913';
  const askLine = canAsk
    ? `第一步必须先用你的提问工具（AskUserQuestion）问我：「交付暗号选哪个？」选项：苹果、香蕉。等我回答后再继续。`
    : ``;
  const prompt = [
    `这是一件真任务，按步骤做，不要省略：`,
    askLine,
    canAsk ? `第二步：根据我对暗号的选择，继续第三步。` : ``,
    `第三步：创建文件 ${artifact}（UTF-8），内容恰好三行：`,
    `  第1行：${product.toUpperCase()}-LOOP-OK ${stamp}`,
    canAsk ? `  第2行：交付暗号：<把我第一步问你、你得到的那个答案写在这里>` : `  第2行：交付暗号：${fixedCode}`,
    `  第3行：一句话：经 ACP 常驻桥派活闭环${canAsk ? '（含中途提问）' : ''}打通。`,
    `做完后回复 DONE 和文件前三行内容。`,
  ].filter(Boolean).join('\n');

  const b = new AcpBridge(product);
  const result = { product, startedAt: new Date().toISOString() };
  try {
    await b.start({ answer });
    await b.newSession(CWD);
    result.sessionId = b.sessionId;
    if (product === 'workbuddy') await b.setModel(args.model || 'custom-local:glm-5.3-flash');
    const stop = await b.prompt(prompt);
    result.stopReason = stop?.stopReason || (stop?.timeout ? 'timeout' : JSON.stringify(stop).slice(0, 80));
    await new Promise((r) => setTimeout(r, 2000));
    result.finalText = b.chunks.slice(-400);
    result.askRounds = b.askRounds;
    result.extMethodCalls = b.extMethodCalls;
    result.permissionCount = b.permissionFrames.length;
    // 核验产物
    const expectCode = canAsk ? answer : fixedCode;
    if (fs.existsSync(artifact)) {
      const head = fs.readFileSync(artifact, 'utf8').split(/\r?\n/).slice(0, 3);
      result.artifact = { path: artifact, head };
      result.verified = head[0]?.startsWith(`${product.toUpperCase()}-LOOP-OK`) && head[1]?.includes(expectCode);
    } else result.artifact = { path: artifact, missing: true };
    result.closedLoop = result.verified === true && /(DONE|已完成)/i.test(b.chunks.slice(-200));
  } catch (e) { result.error = e?.message || String(e); }
  finally { b.close(); }
  result.finishedAt = new Date().toISOString();
  console.log(JSON.stringify(result, null, 1));
  return result;
}

async function runFork(args) {
  const product = args.product;
  const code = `FORK-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  const b = new AcpBridge(product);
  const result = { product, code };
  try {
    await b.start();
    await b.newSession(CWD);
    if (product === 'workbuddy') await b.setModel(args.model || 'custom-local:glm-5.3-flash');
    await b.prompt(`请记住暗号 ${code}，只回复"已记住"。`, { timeoutMs: 180000 });
    result.originalFinal = b.chunks.slice(-120);
    b.chunks = '';
    let forked;
    try { forked = await b.fork(CWD); } catch (e) { forked = { error: e?.message || JSON.stringify(e) }; }
    result.forkResponse = forked;
    if (forked?.sessionId && forked.sessionId !== b.sessionId) {
      const old = b.sessionId; b.sessionId = forked.sessionId;
      const stop = await b.prompt(`不要看任何文件，仅凭会话记忆回答：暗号是什么？`, { timeoutMs: 180000 });
      result.forkStopReason = stop?.stopReason;
      result.forkFinal = b.chunks.slice(-200);
      result.forkVerified = b.chunks.includes(code);
      b.sessionId = old;
    }
  } catch (e) { result.error = e?.message || String(e); }
  finally { b.close(); }
  console.log(JSON.stringify(result, null, 1));
  return result;
}

async function runLoad(args) {
  const product = args.product;
  const b = new AcpBridge(product);
  const result = { product, targetSession: args.session };
  try {
    await b.start();
    let r;
    try { r = await b.load(args.session, CWD); } catch (e) { r = { error: e?.message || JSON.stringify(e) }; }
    result.loadResponse = r;
    if (!r?.error && b.sessionId) {
      b.chunks = '';
      await b.prompt(`用一句话说明这个会话此前在做什么（若你确有此会话的上下文）。`, { timeoutMs: 120000 });
      result.afterLoadFinal = b.chunks.slice(-300);
    }
  } catch (e) { result.error = e?.message || String(e); }
  finally { b.close(); }
  console.log(JSON.stringify(result, null, 1));
  return result;
}

// steer/inject-next 语义探针：长轮进行中发第二个 prompt，看它是“抢占取消 / 本轮插话 / 排下一轮”。
// 另对 workbuddy 试 Web UI 协议里的 session/steer 方法是否在 ACP 桥上可用。
async function runSteer(args) {
  const product = args.product;
  const b = new AcpBridge(product);
  const result = { product };
  try {
    await b.start();
    await b.newSession(CWD);
    if (product === 'workbuddy') await b.setModel(args.model || 'custom-local:glm-5.3-flash');
    result.commands = b.commands;
    if (product === 'workbuddy') {
      try { result.wbSessionSteer = await b.call('session/steer', { sessionId: b.sessionId, prompt: [{ type: 'text', text: 'steer-probe' }] }); }
      catch (e) { result.wbSessionSteer = { error: e?.message || JSON.stringify(e) }; }
    }
    const p1 = b.prompt('从 1 数到 30，每个数字单独一行，不要省略，不要解释。', { timeoutMs: 180000 });
    await new Promise((r) => setTimeout(r, 5000));
    const mid = b.chunks.length;
    const p2 = b.prompt('改要求：数到 5 就停下，然后立刻回复"改为5-OK"。', { timeoutMs: 180000 });
    const [r1, r2] = [await p1, await p2];
    result.firstStopReason = r1?.stopReason || (r1?.timeout ? 'timeout' : null);
    result.secondStopReason = r2?.stopReason || (r2?.timeout ? 'timeout' : null);
    result.secondResultText = JSON.stringify(r2).slice(0, 200);
    result.chunksLenAtSecond = mid;
    result.finalTail = b.chunks.slice(-300);
    // 判定留给调用者：firstStopReason=cancelled → 抢占；r2 立即返回 "Redirected..."（hermes）→ 本轮插话；两轮各自 end_turn → 排队/新轮
  } catch (e) { result.error = e?.message || String(e); }
  finally { b.close(); }
  console.log(JSON.stringify(result, null, 1));
  return result;
}

const args = parseArgs(process.argv.slice(2));
const sub = args._[0];
const invokedDirectly = process.argv[1] && import.meta.url === (await import('node:url')).pathToFileURL(path.resolve(process.argv[1])).href;
if (invokedDirectly) {
  if (sub === 'task') await runTask(args);
  else if (sub === 'fork') await runFork(args);
  else if (sub === 'load') await runLoad(args);
  else if (sub === 'steer') await runSteer(args);
  else { console.error('用法: acp_resident_bridge.mjs task|fork|load|steer --product <id> [--ask <答案>] [--model <id>] [--session <id>]'); process.exit(1); }
  process.exit(0);
}
