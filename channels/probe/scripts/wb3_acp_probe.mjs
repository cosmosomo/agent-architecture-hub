// probe-wb-native3-1019: WorkBuddy L1a ACP probe — slash commands as a turn, open-idle, inject-next, usage_update.
// Raw stdio JSON-RPC against codebuddy --acp. Usage: node channels/probe/scripts/wb3_acp_probe.mjs <test>
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const HOME = os.homedir();
const ENV = {
  ...process.env,
  HTTP_PROXY: 'http://127.0.0.1:7892', HTTPS_PROXY: 'http://127.0.0.1:7892',
  CODEBUDDY_CONFIG_DIR: path.join(HOME, '.workbuddy'),
  WORKBUDDY_CONFIG_DIR: path.join(HOME, '.workbuddy'),
  ACC_PRODUCT_CONFIG_V3: JSON.stringify({ authentication: { type: 'custom-token', attributes: { token: 'wb-local-byok' } } }),
};
const CWD = process.env.PROBE_CWD || fs.mkdtempSync(path.join(os.tmpdir(), 'probe-wb3-acp-'));
const MODEL = 'custom-local:glm-5.3-flash';

function log(...a) { console.log(new Date().toISOString().slice(11, 23), ...a); }

class Acp {
  constructor() {
    this.id = 1;
    this.pending = new Map();
    this.events = [];
    this.usageEvents = [];
    this.commands = null;
    this.procs = [];
  }
  start() {
    const nodeBin = 'E:/java/node_js/node.exe';
    const cliJs = 'C:/Users/COLORFIRE/AppData/Roaming/npm/node_modules/@tencent-ai/codebuddy-code/bin/codebuddy';
    this.cp = spawn(process.execPath, [cliJs, '--acp', '--model', MODEL], { cwd: CWD, env: ENV, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
    this.procs.push(this.cp.pid);
    this.buf = '';
    this.cp.stdout.on('data', (d) => {
      this.buf += d.toString();
      let i;
      while ((i = this.buf.indexOf('\n')) >= 0) {
        const line = this.buf.slice(0, i).trim();
        this.buf = this.buf.slice(i + 1);
        if (line) this.onLine(line);
      }
    });
    this.cp.stderr.on('data', (d) => process.stderr.write('[stderr] ' + d));
    return new Promise((res) => { this.cp.on('spawn', () => res()); });
  }
  onLine(line) {
    let j; try { j = JSON.parse(line); } catch { return; }
    if (j.id && (j.result !== undefined || j.error !== undefined)) {
      const p = this.pending.get(j.id);
      if (p) { this.pending.delete(j.id); j.error ? p.rej(new Error(JSON.stringify(j.error))) : p.res(j.result); }
      return;
    }
    // notifications
    if (j.method === 'session/update') {
      const u = j.params?.update;
      this.events.push(u);
      if (u?.sessionUpdate === 'usage_update' || (u?.sessionUpdate && JSON.stringify(u).includes('usage'))) this.usageEvents.push(u);
      if (u?.sessionUpdate === 'available_commands_update') this.commands = u.availableCommands;
      if (u?.sessionUpdate === 'agent_message_chunk') process.stdout.write(u.content?.[0]?.text || '');
    }
  }
  call(method, params) {
    const id = this.id++;
    return new Promise((res, rej) => {
      this.pending.set(id, { res, rej });
      this.cp.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
      setTimeout(() => { if (this.pending.has(id)) { this.pending.delete(id); rej(new Error(method + ' timeout')); } }, 120000);
    });
  }
  notify(method, params) { this.cp.stdin.write(JSON.stringify({ jsonrpc: '2.0', method, params }) + '\n'); }
  async init() {
    const r = await this.call('initialize', { protocolVersion: 1, clientInfo: { name: 'probe-wb3', version: '0.1' }, clientCapabilities: { fs: { readTextFile: true, writeTextFile: true } } });
    log('initialize ->', JSON.stringify(r?.agentCapabilities));
  }
  async stop() {
    try { this.cp.stdin.end(); } catch {}
    try { if (process.platform === 'win32') spawn('taskkill', ['/pid', String(this.cp.pid), '/t', '/f'], { stdio: 'ignore', windowsHide: true }); else this.cp.kill(); } catch {}
  }
}

async function waitMs(ms) { return new Promise((r) => setTimeout(r, ms)); }

// ---- test: slash ---- sends /goal as a whole turn, then a plain follow-up
async function testSlash() {
  const a = new Acp();
  try {
    await a.start(); await a.init();
    const s = await a.call('session/new', { cwd: CWD, mcpServers: [] });
    log('session/new ->', s.sessionId, 'stopReason n/a; cmds after new:', a.commands ? a.commands.length : 'none-yet');
    await waitMs(1500);
    log('available_commands count:', a.commands ? a.commands.length : 'none', a.commands ? a.commands.slice(0, 12).map((c) => c.name).join(',') : '');
    // 1. /goal slash command as its own turn
    const r1 = await a.call('session/prompt', { sessionId: s.sessionId, prompt: [{ type: 'text', text: '/goal 目标：验证经 ACP 发斜杠命令。完成后即可停止。' }] });
    log('PROMPT(/goal) stopReason=', r1.stopReason);
    const r2 = await a.call('session/prompt', { sessionId: s.sessionId, prompt: [{ type: 'text', text: '刚才执行的 /goal 命令设定的目标文本是什么？只引用目标文本本身。' }] });
    log('PROMPT(follow-up) stopReason=', r2.stopReason);
    log('usage events during slash test:', a.usageEvents.length, a.usageEvents.slice(-1).map((u) => JSON.stringify(u).slice(0, 200)).join(''));
    fs.appendFileSync('e:/program/GIT/Agent/multi/Agent-Architecture-Hub/channels/probe/scripts/output/wb3_acp_slash.json', JSON.stringify({ at: new Date().toISOString(), sessionId: s.sessionId, cmds: a.commands?.map((c) => c.name), r1, r2, usage: a.usageEvents.slice(-2) }, null, 1));
  } finally { await a.stop(); }
}

// ---- test: open-idle ---- session/new without any prompt; verify session file exists on disk with 0 turns
async function testOpenIdle() {
  const a = new Acp();
  try {
    await a.start(); await a.init();
    const s = await a.call('session/new', { cwd: CWD, mcpServers: [] });
    await waitMs(2500);
    const dirSlug = CWD.replace(/[:\\]/g, '-').replace(/^-/, '');
    // find newest jsonl under projects matching cwd slug
    const projRoot = path.join(HOME, '.workbuddy', 'projects');
    const cands = fs.readdirSync(projRoot).filter((d) => d.toLowerCase().endsWith(dirSlug.toLowerCase()));
    let found = null;
    for (const d of cands) {
      const p = path.join(projRoot, d, s.sessionId + '.jsonl');
      if (fs.existsSync(p)) { found = p; break; }
    }
    let lineCount = -1, hasUserTurn = false;
    if (found) {
      const lines = fs.readFileSync(found, 'utf8').trim().split('\n').filter(Boolean);
      lineCount = lines.length;
      hasUserTurn = lines.some((l) => l.includes('"role":"user"'));
    }
    log('open-idle: sessionId=', s.sessionId, 'file=', found, 'lines=', lineCount, 'hasUserTurn=', hasUserTurn);
    fs.appendFileSync('e:/program/GIT/Agent/multi/Agent-Architecture-Hub/channels/probe/scripts/output/wb3_acp_openidle.json', JSON.stringify({ at: new Date().toISOString(), sessionId: s.sessionId, file: found, lineCount, hasUserTurn }) + '\n');
  } finally { await a.stop(); }
}

// ---- test: inject-next ---- start a slow turn, immediately send a 2nd session/prompt; observe behavior
async function testInjectNext() {
  const a = new Acp();
  try {
    await a.start(); await a.init();
    const s = await a.call('session/new', { cwd: CWD, mcpServers: [] });
    log('inject-next session:', s.sessionId);
    const p1 = a.call('session/prompt', { sessionId: s.sessionId, prompt: [{ type: 'text', text: '请从1数到30，每个数一行，慢慢数，数完停止。' }] });
    await waitMs(1200);
    log('sending concurrent 2nd prompt mid-turn...');
    let second = null;
    try {
      second = await Promise.race([a.call('session/prompt', { sessionId: s.sessionId, prompt: [{ type: 'text', text: '插入消息：记住暗号 WB3-INJ-42，之后我会问你。' }] }), waitMs(8000).then(() => 'TIMEOUT-8s')]);
    } catch (e) { second = 'ERROR: ' + e.message; }
    log('2nd prompt result:', typeof second === 'string' ? second : JSON.stringify(second).slice(0, 200));
    const r1 = await p1;
    log('1st turn stopReason=', r1.stopReason);
    // after turn 1 done, ask for the injected secret
    const r3 = await a.call('session/prompt', { sessionId: s.sessionId, prompt: [{ type: 'text', text: '我之前插入的暗号是什么？只回复暗号。' }] });
    log('recall turn stopReason=', r3.stopReason);
    const recallText = a.events.filter((u) => u.sessionUpdate === 'agent_message_chunk').slice(-30).map((u) => u.content?.[0]?.text || '').join('');
    log('recall text tail:', recallText.slice(-200));
    fs.appendFileSync('e:/program/GIT/Agent/multi/Agent-Architecture-Hub/channels/probe/scripts/output/wb3_acp_injectnext.json', JSON.stringify({ at: new Date().toISOString(), sessionId: s.sessionId, second, r1stop: r1.stopReason, recallTail: recallText.slice(-200) }) + '\n');
  } finally { await a.stop(); }
}

// ---- test: usage ---- check usage_update / token counters over ACP
async function testUsage() {
  const a = new Acp();
  try {
    await a.start(); await a.init();
    const s = await a.call('session/new', { cwd: CWD, mcpServers: [] });
    const r = await a.call('session/prompt', { sessionId: s.sessionId, prompt: [{ type: 'text', text: '只回复两个字：好的' }] });
    log('turn stopReason=', r.stopReason);
    await waitMs(1000);
    log('usage events:', JSON.stringify(a.usageEvents.slice(0, 3)));
    const kinds = [...new Set(a.events.map((u) => u.sessionUpdate))];
    log('update kinds:', kinds.join(','));
    fs.appendFileSync('e:/program/GIT/Agent/multi/Agent-Architecture-Hub/channels/probe/scripts/output/wb3_acp_usage.json', JSON.stringify({ at: new Date().toISOString(), kinds, usage: a.usageEvents.slice(0, 3) }) + '\n');
  } finally { await a.stop(); }
}

const test = process.argv[2];
const fns = { slash: testSlash, openidle: testOpenIdle, injectnext: testInjectNext, usage: testUsage };
if (!fns[test]) { console.error('tests: ' + Object.keys(fns).join(', ')); process.exit(1); }
fs.mkdirSync('e:/program/GIT/Agent/multi/Agent-Architecture-Hub/channels/probe/scripts/output', { recursive: true });
fns[test]().then(() => process.exit(0)).catch((e) => { console.error('FATAL', e); process.exit(1); });
