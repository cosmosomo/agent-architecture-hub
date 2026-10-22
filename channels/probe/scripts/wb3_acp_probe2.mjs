// probe-wb-native3-1019 part 2: slash /context /cost /todos /plan over ACP + attach(image) + artifact/notify tool headers
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
const CWD = process.env.PROBE_CWD || fs.mkdtempSync(path.join(os.tmpdir(), 'probe-wb3-acp2-'));
const MODEL = 'custom-local:glm-5.3-flash';
const CLI = 'C:/Users/COLORFIRE/AppData/Roaming/npm/node_modules/@tencent-ai/codebuddy-code/bin/codebuddy';
const OUT = 'e:/program/GIT/Agent/multi/Agent-Architecture-Hub/channels/probe/scripts/output';
fs.mkdirSync(OUT, { recursive: true });

function log(...a) { console.log(new Date().toISOString().slice(11, 23), ...a); }

class Acp {
  constructor() { this.id = 1; this.pending = new Map(); this.chunks = []; this.usage = []; }
  start() {
    this.cp = spawn(process.execPath, [CLI, '--acp', '--model', MODEL], { cwd: CWD, env: ENV, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
    this.buf = '';
    this.cp.stdout.on('data', (d) => {
      this.buf += d.toString();
      let i;
      while ((i = this.buf.indexOf('\n')) >= 0) { const line = this.buf.slice(0, i).trim(); this.buf = this.buf.slice(i + 1); if (line) this.onLine(line); }
    });
    this.cp.stderr.on('data', (d) => process.stderr.write('[stderr] ' + d));
    return new Promise((res) => this.cp.on('spawn', () => res()));
  }
  onLine(line) {
    let j; try { j = JSON.parse(line); } catch { return; }
    if (j.id && (j.result !== undefined || j.error !== undefined)) {
      const p = this.pending.get(j.id);
      if (p) { this.pending.delete(j.id); j.error ? p.rej(new Error(JSON.stringify(j.error))) : p.res(j.result); }
      return;
    }
    if (j.method === 'session/update') {
      const u = j.params?.update;
      if (u?.sessionUpdate === 'usage_update') this.usage.push(u);
      if (u?.sessionUpdate === 'agent_message_chunk') this.chunks.push(u.content?.[0]?.text || '');
      if (u?.sessionUpdate === 'tool_call') this.lastToolCall = u;
      if (u?.sessionUpdate === 'user_message_chunk') this.chunks.push('\n[USER] ' + (u.content?.[0]?.text || '') + '\n');
    }
  }
  call(method, params, timeoutMs = 120000) {
    const id = this.id++;
    return new Promise((res, rej) => {
      this.pending.set(id, { res, rej });
      this.cp.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
      setTimeout(() => { if (this.pending.has(id)) { this.pending.delete(id); rej(new Error(method + ' timeout')); } }, timeoutMs);
    });
  }
  text() { return this.chunks.join(''); }
  reset() { this.chunks = []; }
  async stop() {
    try { this.cp.stdin.end(); } catch {}
    try { spawn('taskkill', ['/pid', String(this.cp.pid), '/t', '/f'], { stdio: 'ignore', windowsHide: true }); } catch {}
  }
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// test: read-slashes — /context /cost /todos /plan as turns, capture their stdout echoes
async function testReadSlashes() {
  const a = new Acp();
  try {
    await a.start();
    await a.call('initialize', { protocolVersion: 1, clientInfo: { name: 'probe-wb3', version: '0.1' }, clientCapabilities: { fs: { readTextFile: true, writeTextFile: true } } });
    const s = await a.call('session/new', { cwd: CWD, mcpServers: [] });
    log('session', s.sessionId);
    const out = { at: new Date().toISOString(), sessionId: s.sessionId, cmds: {} };
    for (const cmd of ['/context', '/cost', '/todos', '/plan']) {
      a.reset();
      const r = await a.call('session/prompt', { sessionId: s.sessionId, prompt: [{ type: 'text', text: cmd }] });
      const t = a.text();
      out.cmds[cmd] = { stopReason: r.stopReason, echo: t.slice(0, 300) };
      log(cmd, '-> stop', r.stopReason, 'echo len', t.length, '|', t.slice(0, 100).replace(/\n/g, '|'));
    }
    fs.writeFileSync(path.join(OUT, 'wb3_acp_readslashes.json'), JSON.stringify(out, null, 1));
  } finally { await a.stop(); }
}

// test: attach — image block in session/prompt
async function testAttach() {
  const a = new Acp();
  try {
    await a.start();
    await a.call('initialize', { protocolVersion: 1, clientInfo: { name: 'probe-wb3', version: '0.1' }, clientCapabilities: { fs: { readTextFile: true, writeTextFile: true } } });
    const s = await a.call('session/new', { cwd: CWD, mcpServers: [] });
    log('session', s.sessionId);
    // 1x1 red PNG
    const b64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    let result = 'ERR';
    try {
      const r = await a.call('session/prompt', { sessionId: s.sessionId, prompt: [{ type: 'text', text: '这张图片是什么颜色？只回一个词。' }, { type: 'image', data: b64, mimeType: 'image/png' }] });
      result = { stopReason: r.stopReason, answer: a.text().slice(0, 100) };
      log('image prompt ->', JSON.stringify(result));
    } catch (e) { result = 'ERROR: ' + e.message; log(result); }
    fs.appendFileSync(path.join(OUT, 'wb3_acp_attach.json'), JSON.stringify({ at: new Date().toISOString(), sessionId: s.sessionId, result }) + '\n');
  } finally { await a.stop(); }
}

// test: tools — ask model to call PushNotification / Artifact headers; check permission frames carry tool identity
async function testToolHeaders() {
  const a = new Acp();
  const permFrames = [];
  try {
    await a.start();
    // intercept reverse requests to observe rawInput (tool headers)
    const origCall = a.call.bind(a);
    a.call = async (method, params) => {
      if (method === 'session/prompt') { /* keep */ }
      return origCall(method, params);
    };
    // patch onLine to also capture server->client requests
    const origOnLine = a.onLine.bind(a);
    a.onLine = (line) => {
      let j; try { j = JSON.parse(line); } catch { return origOnLine(line); }
      if (j.method === 'session/request_permission') { permFrames.push(j.params); }
      return origOnLine(line);
    };
    // auto-allow any permission request
    // We need to respond: patch pending by watching stdin? Simpler: override call to intercept ids of server requests.
    await a.call('initialize', { protocolVersion: 1, clientInfo: { name: 'probe-wb3', version: '0.1' }, clientCapabilities: { fs: { readTextFile: true, writeTextFile: true } } });
    const s = await a.call('session/new', { cwd: CWD, mcpServers: [] });
    log('session', s.sessionId);
    // To answer reverse requests we must write results; hook via a public method:
    a.replyPermission = (id, optionId) => a.cp.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, result: { outcome: { outcome: 'selected', optionId } } }) + '\n');
    // watch for requests in onLine — we already push params; also need id
    a.permIds = [];
    const origOnLine2 = a.onLine.bind(a);
    a.onLine = (line) => {
      let j; try { j = JSON.parse(line); } catch { return origOnLine2(line); }
      if (j.method === 'session/request_permission') { a.permIds.push(j.id); a.replyPermission(j.id, 'allow'); }
      return origOnLine2(line);
    };
    a.reset();
    const r = await a.call('session/prompt', { sessionId: s.sessionId, prompt: [{ type: 'text', text: '请调用 PushNotification 工具发一条桌面通知，标题"WB3-PROBE"，消息"经ACP测试通知"。发完只回复:已发' }] }, 180000);
    const pushResult = { stopReason: r.stopReason, answer: a.text().slice(0, 200), permCount: permFrames.length, permTools: permFrames.map((p) => p.toolCall?.title || p.toolCall?.kind) };
    log('PushNotification ->', JSON.stringify(pushResult));
    fs.appendFileSync(path.join(OUT, 'wb3_acp_toolheaders.json'), JSON.stringify({ at: new Date().toISOString(), sessionId: s.sessionId, test: 'PushNotification', pushResult }) + '\n');
  } finally { await a.stop(); }
}

const test = process.argv[2];
const fns = { readslashes: testReadSlashes, attach: testAttach, tools: testToolHeaders };
if (!fns[test]) { console.error('tests: ' + Object.keys(fns).join(', ')); process.exit(1); }
fns[test]().then(() => process.exit(0)).catch((e) => { console.error('FATAL', e); process.exit(1); });
