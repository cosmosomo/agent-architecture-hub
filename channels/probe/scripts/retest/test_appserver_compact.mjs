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
        clientInfo: { name: 'retest-compact', title: 'Retest Compact', version: '1.0.0' },
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

  async waitForIdle(timeoutMs = 80000) {
    const start = Date.now();
    return new Promise((resolve, reject) => {
      const check = setInterval(() => {
        const lastStatus = this.notifications.filter((n) => n.method === 'thread/status/changed').slice(-1)[0];
        if (lastStatus && lastStatus.params?.status?.type === 'idle') {
          clearInterval(check);
          resolve(lastStatus.params);
        } else if (Date.now() - start > timeoutMs) {
          clearInterval(check);
          reject(new Error('Timeout waiting for idle'));
        }
      }, 300);
    });
  }
}

function findRolloutLines(threadId, pattern) {
  const sessionsDir = path.join(process.env.USERPROFILE, '.codex', 'sessions');
  const files = [];
  function walk(dir) {
    if (!fs.existsSync(dir)) return;
    for (const f of fs.readdirSync(dir)) {
      const full = path.join(dir, f);
      if (fs.statSync(full).isDirectory()) walk(full);
      else if (f.includes(threadId)) files.push(full);
    }
  }
  walk(sessionsDir);
  const matched = [];
  for (const file of files) {
    const lines = fs.readFileSync(file, 'utf8').split('\n');
    for (const line of lines) {
      if (line.includes(pattern)) matched.push(line);
    }
  }
  return matched;
}

async function main() {
  console.log('=== Testing codex/L0/app-server compact ===');
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

    // Turn 1: short prompt to establish context
    const turn1 = await server.request('turn/start', {
      threadId,
      input: [{ type: 'text', text: 'Hello, please reply: READY' }],
    });
    await server.waitForTurnCompletion(turn1.turn?.id);
    console.log('Turn 1 completed.');

    // Read thread usage before compact
    const readBefore = await server.request('thread/read', { threadId });
    const usageBefore = readBefore.thread?.tokenUsage;
    console.log('Thread read before compact:', JSON.stringify(readBefore.thread?.tokenUsage));

    // Call thread/compact/start
    console.log('Calling thread/compact/start...');
    const compactRpcRes = await server.request('thread/compact/start', { threadId });
    console.log('thread/compact/start RPC returned:', JSON.stringify(compactRpcRes));

    // Wait for the compaction turn to start and complete (or idle)
    console.log('Waiting for compaction turn / thread idle...');
    await server.waitForIdle(80000).catch((e) => console.log('waitForIdle note:', e.message));

    // Read thread usage after compact
    const readAfter = await server.request('thread/read', { threadId });
    const usageAfter = readAfter.thread?.tokenUsage;
    console.log('Thread read after compact:', JSON.stringify(readAfter.thread?.tokenUsage));

    const compactionNotifs = server.notifications.filter(
      (n) => n.method === 'thread/compacted' || (n.method === 'item/completed' && n.params?.item?.type === 'ContextCompaction')
    );

    const rolloutCompacted = findRolloutLines(threadId, 'compaction');
    const rolloutTasks = findRolloutLines(threadId, 'task_');

    const result = {
      threadId,
      compactRpcRes,
      usageBefore,
      usageAfter,
      compactionNotifications: compactionNotifs,
      rolloutCompacted,
      rolloutTasks,
    };

    fs.writeFileSync(path.join(OUT_DIR, 'codex_appserver_compact.json'), JSON.stringify(result, null, 2));
    console.log('Result saved:', JSON.stringify(result, null, 2));
  } finally {
    server.close();
  }
}

main().catch(console.error);
