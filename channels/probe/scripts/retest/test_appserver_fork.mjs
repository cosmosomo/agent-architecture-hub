import { spawn } from 'node:child_process';
import readline from 'node:readline';
import fs from 'node:fs';
import path from 'node:path';

const CWD = 'E:\\program\\GIT\\Agent\\multi\\Agent-Architecture-Hub';
const OUT_DIR = path.join(CWD, 'channels', 'probe', 'scripts', 'retest', 'output');
fs.mkdirSync(OUT_DIR, { recursive: true });

const ENV = {
  ...process.env,
  HTTP_PROXY: 'http://127.0.0.1:7892',
  HTTPS_PROXY: 'http://127.0.0.1:7892',
};

class AppServer {
  constructor() {
    this.cp = null;
    this.rl = null;
    this.reqId = 1;
    this.pending = new Map();
    this.notifications = [];
  }

  async start() {
    return new Promise((resolve, reject) => {
      this.cp = spawn('codex', ['app-server', '--listen', 'stdio://'], {
        cwd: CWD,
        env: ENV,
        shell: true,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      this.rl = readline.createInterface({ input: this.cp.stdout });
      this.rl.on('line', (line) => {
        try {
          const msg = JSON.parse(line);
          this.handleMessage(msg);
        } catch (e) {}
      });

      this.cp.on('error', reject);

      this.request('initialize', {
        clientInfo: { name: 'retest-fork', title: 'Retest Fork', version: '1.0.0' },
        capabilities: { experimentalApi: true, optOutNotificationMethods: [] },
      }).then((res) => {
        this.notify('initialized', {});
        resolve(res);
      }).catch(reject);
    });
  }

  handleMessage(msg) {
    if (msg.id !== undefined && !msg.method) {
      const p = this.pending.get(msg.id);
      if (p) {
        this.pending.delete(msg.id);
        if (msg.error) p.reject(msg.error);
        else p.resolve(msg.result);
      }
    } else if (msg.method && msg.id === undefined) {
      this.notifications.push(msg);
    }
  }

  request(method, params = {}) {
    const id = this.reqId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      const payload = JSON.stringify({ id, method, params }) + '\n';
      this.cp.stdin.write(payload);
    });
  }

  notify(method, params = {}) {
    const payload = JSON.stringify({ method, params }) + '\n';
    this.cp.stdin.write(payload);
  }

  close() {
    if (this.cp) {
      this.cp.kill();
    }
  }

  async waitForTurnCompletion(turnId, timeoutMs = 80000) {
    const start = Date.now();
    return new Promise((resolve, reject) => {
      const check = setInterval(() => {
        const notif = this.notifications.find(
          (n) => n.method === 'turn/completed' && n.params?.turn?.id === turnId
        );
        if (notif) {
          clearInterval(check);
          resolve(notif.params);
        } else if (Date.now() - start > timeoutMs) {
          clearInterval(check);
          reject(new Error(`Timeout waiting for turn ${turnId} completion`));
        }
      }, 200);
    });
  }
}

async function main() {
  console.log('=== Testing codex/L0/app-server fork ===');
  const server = new AppServer();
  await server.start();

  try {
    const secret = 'APP_FORK_TOKEN_8829';
    const tParent = await server.request('thread/start', {
      cwd: CWD,
      model: 'gpt-5.6-sol',
      reasoningEffort: 'low',
      sandbox: 'workspace-write',
    });
    const parentThreadId = tParent.thread?.id;
    console.log('Parent threadId:', parentThreadId);

    // Save secret in parent thread
    const turn1 = await server.request('turn/start', {
      threadId: parentThreadId,
      input: [{ type: 'text', text: `Please remember secret code: ${secret}. Reply with: SAVED.` }],
    });
    await server.waitForTurnCompletion(turn1.turn?.id);
    console.log('Turn 1 completed.');

    // Call thread/fork
    console.log('Calling thread/fork...');
    const forkRes = await server.request('thread/fork', { threadId: parentThreadId });
    const forkedThreadId = forkRes.thread?.id;
    console.log('Fork response:', JSON.stringify(forkRes));
    console.log('Forked threadId:', forkedThreadId);

    // Ask secret in forked thread
    const turnFork = await server.request('turn/start', {
      threadId: forkedThreadId,
      input: [{ type: 'text', text: 'What was the secret code saved in our previous conversation? Reply with ONLY the exact code.' }],
    });
    const turnForkCompleted = await server.waitForTurnCompletion(turnFork.turn?.id);
    console.log('Fork turn completed status:', turnForkCompleted.turn?.status);

    const deltas = server.notifications
      .filter((n) => n.method === 'item/agentMessage/delta' && n.params?.turnId === turnFork.turn?.id)
      .map((n) => n.params?.delta || '')
      .join('');
    const completedItems = server.notifications
      .filter((n) => n.method === 'item/completed' && n.params?.turnId === turnFork.turn?.id)
      .map((n) => n.params?.item?.text || '')
      .filter(Boolean)
      .join(' ');

    const reply = (deltas || completedItems).trim();
    console.log('Fork reply:', reply);
    const recalled = reply.includes(secret);

    const result = {
      pass: !!forkedThreadId && forkedThreadId !== parentThreadId && recalled,
      parentThreadId,
      forkedThreadId,
      forkRpcResponse: forkRes,
      forkReply: reply,
      recalled,
      turnForkCompleted,
    };

    fs.writeFileSync(path.join(OUT_DIR, 'codex_appserver_fork.json'), JSON.stringify(result, null, 2));
    console.log('Result saved:', JSON.stringify(result, null, 2));
  } finally {
    server.close();
  }
}

main().catch(console.error);
