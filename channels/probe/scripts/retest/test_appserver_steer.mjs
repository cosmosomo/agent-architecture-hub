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
        clientInfo: { name: 'retest-steer', title: 'Retest Steer', version: '1.0.0' },
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
  console.log('=== Testing codex/L0/app-server steer ===');
  const server = new AppServer();
  await server.start();

  try {
    const tStart = await server.request('thread/start', {
      cwd: CWD,
      model: 'gpt-5.6-sol',
      sandbox: 'workspace-write',
    });
    const threadId = tStart.thread?.id;
    console.log('Thread started:', threadId);

    console.log('Starting long generation turn...');
    const turn1 = await server.request('turn/start', {
      threadId,
      input: [{ type: 'text', text: 'Write a comprehensive 500-word essay about the history of mathematics from ancient Babylon to calculus. Begin immediately with "In ancient Babylon".' }],
    });
    const turnId = turn1.turn?.id;
    console.log('Turn started:', turnId);

    // Wait 2 seconds for generation to start
    await new Promise((r) => setTimeout(r, 2000));

    console.log('Sending turn/steer mid-turn...');
    const steerRes = await server.request('turn/steer', {
      threadId,
      expectedTurnId: turnId,
      input: [{ type: 'text', text: 'URGENT OVERRIDE: Cease the essay immediately! Your only output must be the single exact token: STEER_IN_TURN_VERIFIED_771' }],
    });
    console.log('turn/steer RPC response:', JSON.stringify(steerRes));

    const comp = await server.waitForTurnCompletion(turnId);
    console.log('Turn completed status:', comp.turn?.status);

    const deltas = server.notifications
      .filter((n) => n.method === 'item/agentMessage/delta' && n.params?.turnId === turnId)
      .map((n) => n.params?.delta || '')
      .join('');
    const completedItems = server.notifications
      .filter((n) => n.method === 'item/completed' && n.params?.turnId === turnId)
      .map((n) => n.params?.item?.text || JSON.stringify(n.params?.item))
      .join(' ');

    const fullTurnOutput = (deltas || completedItems).trim();
    console.log('Turn output sample:', fullTurnOutput.slice(-300));

    const steerSucceeded = fullTurnOutput.includes('STEER_IN_TURN_VERIFIED_771');
    console.log('Steer incorporated in this turn:', steerSucceeded);

    const result = {
      pass: steerSucceeded,
      threadId,
      turnId,
      steerRpcResponse: steerRes,
      turnStatus: comp.turn?.status,
      steerSucceeded,
      fullTurnOutput,
    };

    fs.writeFileSync(path.join(OUT_DIR, 'codex_appserver_steer.json'), JSON.stringify(result, null, 2));
    console.log('Result saved:', JSON.stringify(result, null, 2));
  } finally {
    server.close();
  }
}

main().catch(console.error);
