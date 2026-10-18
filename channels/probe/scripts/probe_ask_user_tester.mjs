import { spawn } from 'node:child_process';
import readline from 'node:readline';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const HOME = os.homedir();
const CWD = 'E:\\program\\GIT\\Agent\\multi\\Agent-Architecture-Hub';

// Read config from ~/.acpx/config.json
let acpxConfig = {};
try {
  acpxConfig = JSON.parse(fs.readFileSync(path.join(HOME, '.acpx', 'config.json'), 'utf8'));
} catch (e) {
  console.error('Failed to read ~/.acpx/config.json:', e);
}

// Read products.json
let productsData = {};
try {
  productsData = JSON.parse(fs.readFileSync(path.join(CWD, 'hub', 'data', 'products.json'), 'utf8'));
} catch (e) {
  console.error('Failed to read products.json:', e);
}

function resolveCommand(agent) {
  let argv = [agent, 'acp'];
  if (acpxConfig.agents?.[agent]?.argv) {
    argv = acpxConfig.agents[agent].argv;
  }
  if (process.platform === 'win32' && !path.isAbsolute(argv[0])) {
    return { cmd: 'cmd.exe', args: ['/d', '/s', '/c', ...argv] };
  }
  return { cmd: argv[0], args: argv.slice(1) };
}

function getAgentEnv(agent) {
  const prod = productsData.products?.find((p) => p.id === agent);
  const baseEnv = { ...process.env };
  delete baseEnv.CLAUDECODE;
  delete baseEnv.ANTHROPIC_API_KEY;
  if (!prod?.env) return baseEnv;
  const env = { ...baseEnv };
  for (const [k, v] of Object.entries(prod.env)) {
    env[k] = typeof v === 'string' ? v.replace('{HOME}', HOME) : v;
  }
  return env;
}

export class AcpRawTester {
  constructor(agent, clientCaps = { fs: { readTextFile: true, writeTextFile: true }, terminal: false }) {
    this.agent = agent;
    this.clientCaps = clientCaps;
    this.cmd = resolveCommand(agent);
    this.env = getAgentEnv(agent);
    this.reqId = 1;
    this.pending = new Map();
    this.frames = [];
    this.onServerRequest = null;
    this.cp = null;
  }

  async start() {
    console.log(`[${this.agent}] Starting bridge:`, this.cmd.cmd, this.cmd.args.join(' '));
    this.cp = spawn(this.cmd.cmd, this.cmd.args, {
      cwd: CWD,
      env: this.env,
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    });

    const rl = readline.createInterface({ input: this.cp.stdout });
    rl.on('line', (line) => this.handleLine(line));

    this.cp.stderr.on('data', (d) => {
      const str = d.toString();
      // Print interesting stderr
      if (!str.includes('DeprecationWarning')) {
        console.log(`[${this.agent}:stderr]`, str.trim().slice(0, 300));
      }
    });

    this.cp.on('exit', (code, sig) => {
      console.log(`[${this.agent}] Process exited: code=${code}, signal=${sig}`);
    });

    const init = await this.call('initialize', {
      protocolVersion: 1,
      clientInfo: { name: 'probe-askuser-tester', version: '1.0.0' },
      clientCapabilities: this.clientCaps,
    });
    console.log(`[${this.agent}] Initialized. Agent capabilities:`, JSON.stringify(init?.agentCapabilities || {}));
    return init;
  }

  handleLine(line) {
    const trimmed = line.trim();
    if (!trimmed) return;
    let msg;
    try {
      msg = JSON.parse(trimmed);
    } catch {
      return;
    }

    this.frames.push(msg);

    // Response to client request
    if (msg.id !== undefined && msg.method === undefined) {
      const p = this.pending.get(msg.id);
      if (p) {
        this.pending.delete(msg.id);
        if (msg.error) p.rej(msg.error);
        else p.res(msg.result);
      }
      return;
    }

    // Server request (agent -> client)
    if (msg.id !== undefined && msg.method !== undefined) {
      console.log(`\n>>> [${this.agent}] RECEIVED SERVER REQUEST: method=${msg.method}, id=${msg.id}`);
      console.log(JSON.stringify(msg, null, 2));
      if (this.onServerRequest) {
        this.onServerRequest(msg, (resPayload) => {
          this.sendResult(msg.id, resPayload);
        }, (errPayload) => {
          this.sendError(msg.id, errPayload);
        });
      }
      return;
    }

    // Notification (e.g. session/update)
    if (msg.method === 'session/update') {
      const update = msg.params?.update;
      const uType = update?.sessionUpdate;
      if (uType === 'agent_message_chunk') {
        process.stdout.write(update.content?.text || '');
      } else if (uType === 'tool_call') {
        console.log(`\n[${this.agent}:tool_call] title=${update.title}, status=${update.status}, toolCallId=${update.toolCallId}, kind=${update.kind}`);
        if (update.rawInput) console.log(`   rawInput:`, JSON.stringify(update.rawInput).slice(0, 200));
      } else {
        console.log(`\n[${this.agent}:update] ${uType}`);
      }
    }
  }

  call(method, params) {
    const id = this.reqId++;
    return new Promise((res, rej) => {
      this.pending.set(id, { res, rej });
      this.write({ jsonrpc: '2.0', id, method, params });
    });
  }

  notify(method, params) {
    this.write({ jsonrpc: '2.0', method, params });
  }

  sendResult(id, result) {
    console.log(`<<< [${this.agent}] SENDING RESULT FOR id=${id}:`, JSON.stringify(result));
    this.write({ jsonrpc: '2.0', id, result });
  }

  sendError(id, error) {
    console.log(`<<< [${this.agent}] SENDING ERROR FOR id=${id}:`, JSON.stringify(error));
    this.write({ jsonrpc: '2.0', id, error });
  }

  write(payload) {
    if (this.cp?.stdin && !this.cp.stdin.destroyed) {
      this.cp.stdin.write(JSON.stringify(payload) + '\n');
    }
  }

  async close() {
    if (this.cp && !this.cp.killed) {
      this.cp.kill();
    }
  }
}
