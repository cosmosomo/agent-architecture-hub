// probe_workbuddy_ask2_20261019.mjs — research-acp (ZCode)
// WorkBuddy codebuddy --acp 2.168.2：AskUserQuestion 经 ACP 的新流。
// 同时处理两类入口：session/request_permission（选项里若有真实答案直接选）
// 和 sessionUpdate=interruption_request（回 _codebuddy.ai/resolveInterruption，answers 以问题原文为 key）。
import { spawn } from 'node:child_process';
import readline from 'node:readline';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const HOME = os.homedir();
const CWD = 'E:\\program\\GIT\\Agent\\multi\\Agent-Architecture-Hub';
const acpxConfig = JSON.parse(fs.readFileSync(path.join(HOME, '.acpx', 'config.json'), 'utf8'));
const productsData = JSON.parse(fs.readFileSync(path.join(CWD, 'hub', 'data', 'products.json'), 'utf8'));

function resolveCommand(agent) {
  let argv = [agent, 'acp'];
  if (acpxConfig.agents?.[agent]?.argv) argv = acpxConfig.agents[agent].argv;
  if (process.platform === 'win32' && !path.isAbsolute(argv[0])) return { cmd: 'cmd.exe', args: ['/d', '/s', '/c', ...argv] };
  return { cmd: argv[0], args: argv.slice(1) };
}
function getAgentEnv(agent) {
  const prod = productsData.products?.find((p) => p.id === agent);
  const env = { ...process.env };
  delete env.CLAUDECODE; delete env.ANTHROPIC_API_KEY;
  for (const [k, v] of Object.entries(prod?.env || {})) env[k] = typeof v === 'string' ? v.replace('{HOME}', HOME) : v;
  return env;
}

const ANSWER = '香蕉';
let SID = null;
let pendingAskToolCall = null; // 最近一个 pending 的 AskUserQuestion tool_call
const summary = { permissionFrames: [], questionFrames: [], interruptions: [], resolveResults: [], finalText: '', stopReason: null };

const tester = {
  reqId: 1, pending: new Map(), cp: null,
  call(method, params) {
    const id = this.reqId++;
    return new Promise((res, rej) => { this.pending.set(id, { res, rej }); this.write({ jsonrpc: '2.0', id, method, params }); });
  },
  write(payload) { if (this.cp?.stdin && !this.cp.stdin.destroyed) this.cp.stdin.write(JSON.stringify(payload) + '\n'); },
  sendResult(id, result) { this.write({ jsonrpc: '2.0', id, result }); },
};

function handleUpdate(update) {
  const u = update?.sessionUpdate;
  if (u === 'agent_message_chunk') { summary.finalText += update.content?.text || ''; return; }
  if (u === 'tool_call') {
    const name = update._meta?.['codebuddy.ai/toolName'] || update.title || '';
    if (/AskUserQuestion|ask/i.test(name) && update.status === 'pending') {
      pendingAskToolCall = update;
      console.log(`[tool_call] PENDING ask: id=${update.toolCallId} name=${name} rawInput=${JSON.stringify(update.rawInput).slice(0, 300)}`);
    }
  } else if (u === 'interruption_request') {
    console.log(`[interruption_request]`, JSON.stringify(update).slice(0, 400));
    summary.interruptions.push(update);
    const qText = pendingAskToolCall?.rawInput?.questions?.[0]?.question;
    const toolCallId = update.toolCallId || pendingAskToolCall?.toolCallId;
    const params = { sessionId: SID, toolCallId, decision: 'allow', answers: qText ? { [qText]: ANSWER } : { feedback: ANSWER } };
    console.log(`-> resolveInterruption`, JSON.stringify(params).slice(0, 300));
    tester.call('_codebuddy.ai/resolveInterruption', params)
      .then((r) => { console.log(`[resolveInterruption ok]`, JSON.stringify(r).slice(0, 200)); summary.resolveResults.push({ ok: r }); })
      .catch((e) => { console.log(`[resolveInterruption err]`, JSON.stringify(e).slice(0, 300)); summary.resolveResults.push({ err: e }); });
  }
}

function handleLine(line) {
  const t = line.trim(); if (!t) return;
  let msg; try { msg = JSON.parse(t); } catch { return; }
  if (msg.id !== undefined && msg.method === undefined) {
    const p = tester.pending.get(msg.id);
    if (p) { tester.pending.delete(msg.id); msg.error ? p.rej(msg.error) : p.res(msg.result); }
    return;
  }
  if (msg.id !== undefined && msg.method !== undefined) {
    console.log(`\n>>> SERVER REQUEST: ${msg.method} id=${msg.id}`);
    if (msg.method === 'session/request_permission') {
      const tc = msg.params?.toolCall || {};
      const options = msg.params?.options || [];
      summary.permissionFrames.push(msg.params);
      console.log(`  title=${tc.title} meta=${JSON.stringify(tc._meta)} rawInput=${JSON.stringify(tc.rawInput).slice(0, 400)}`);
      console.log(`  options: ${options.map((o) => `${o.optionId}(${o.kind})`).join(' | ')}`);
      // 真实选项（非 allow/reject）直接选 ANSWER
      const real = options.find((o) => !/allow|reject|deny/i.test(o.optionId));
      if (real) {
        console.log(`  -> 选择真实选项: ${real.optionId}`);
        tester.sendResult(msg.id, { outcome: { outcome: 'selected', optionId: real.optionId } });
      } else {
        console.log(`  -> 批准工具执行 (allow)，随后补发 resolveInterruption 带 answers`);
        tester.sendResult(msg.id, { outcome: { outcome: 'selected', optionId: 'allow' } });
        if (tc._meta?.['codebuddy.ai/toolName'] === 'AskUserQuestion' || /askuser/i.test(tc.title || '')) {
          const qs = tc.rawInput?.questions || [];
          const answers = {};
          for (const q of qs) if (q?.question) answers[q.question] = ANSWER;
          setTimeout(() => {
            console.log(`-> resolveInterruption(allow+answers)`, JSON.stringify({ toolCallId: tc.toolCallId, answers }).slice(0, 300));
            tester.call('_codebuddy.ai/resolveInterruption', { sessionId: SID, toolCallId: tc.toolCallId, decision: 'allow', answers })
              .then((r) => { console.log(`[resolveInterruption ok]`, JSON.stringify(r).slice(0, 200)); summary.resolveResults.push({ ok: r }); })
              .catch((e) => { console.log(`[resolveInterruption err]`, JSON.stringify(e).slice(0, 300)); summary.resolveResults.push({ err: e }); });
          }, 600);
        }
      }
      return;
    }
    if (msg.method === '_codebuddy.ai/question') {
      summary.questionFrames.push(msg.params);
      const qs = msg.params?.schema?.questions || [];
      console.log(`  QUESTION 帧: ${JSON.stringify(msg.params).slice(0, 500)}`);
      const answers = {};
      for (const q of qs) answers[q.id] = ANSWER;
      console.log(`  -> 提交答案:`, JSON.stringify(answers));
      tester.sendResult(msg.id, { outcome: 'submitted', answers });
      return;
    }
    console.log(`  (无处理器) 原样回空`);
    tester.sendResult(msg.id, {});
    return;
  }
  if (msg.method === 'session/update') { console.log(`[update] ${msg.params?.update?.sessionUpdate}`); handleUpdate(msg.params?.update); }
}

async function main() {
  const { cmd, args } = resolveCommand('workbuddy');
  console.log('starting', cmd, args.join(' '));
  tester.cp = spawn(cmd, args, { cwd: CWD, env: getAgentEnv('workbuddy'), stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
  readline.createInterface({ input: tester.cp.stdout }).on('line', handleLine);
  tester.cp.stderr.on('data', (d) => { const s = d.toString(); if (!/DeprecationWarning/.test(s)) console.error(`[wb:stderr]`, s.trim().slice(0, 200)); });

  await tester.call('initialize', {
    protocolVersion: 1,
    clientInfo: { name: 'probe-wb-ask2', version: '1.0.0' },
    clientCapabilities: { fs: { readTextFile: true, writeTextFile: true }, terminal: false, _meta: { "codebuddy.ai": { question: true } } },
  });
  const s = await tester.call('session/new', { cwd: CWD, mcpServers: [] });
  SID = s.sessionId;
  console.log('sessionId=', SID);
  try { await tester.call('session/set_model', { sessionId: SID, modelId: 'custom-local:glm-5.3-flash' }); console.log('model set'); } catch (e) { console.log('set_model notice:', e?.message || e); }

  const prompt = '你必须向我提问一个二选一的问题（问我喜欢苹果还是香蕉），提供选项，必须调用你的提问工具（AskUserQuestion）向我提问，等我回答后再根据我的选择回复我。';
  const timeout = new Promise((r) => setTimeout(() => r({ timeout: true }), 170000));
  const promptRes = await Promise.race([tester.call('session/prompt', { sessionId: SID, prompt: [{ type: 'text', text: prompt }] }), timeout]);
  console.log('\nPROMPT RESULT:', JSON.stringify(promptRes).slice(0, 600));
  summary.stopReason = promptRes?.stopReason || (promptRes?.timeout ? 'timeout' : null);

  // 收集最终文本
  await new Promise((r) => setTimeout(r, 3000));
  console.log('\n===== SUMMARY =====');
  console.log(JSON.stringify({
    permissionCount: summary.permissionFrames.length,
    permissionFrames: summary.permissionFrames,
    interruptions: summary.interruptions.length,
    resolveResults: summary.resolveResults,
    stopReason: summary.stopReason,
    finalText: String(summary.finalText).slice(-800),
  }, null, 1));
  tester.cp.kill();
  process.exit(0);
}
main().catch((e) => { console.error('FATAL', e); try { tester.cp.kill(); } catch {} process.exit(1); });
