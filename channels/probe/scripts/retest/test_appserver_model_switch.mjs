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
        clientInfo: { name: 'retest-mswitch', title: 'Retest Model Switch', version: '1.0.0' },
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

  async waitForTurnCompletion(turnId, timeoutMs = 60000) {
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
  console.log('=== Testing codex/L0/app-server model-switch ===');
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

    // Turn 1 on gpt-5.6-sol
    const turn1 = await server.request('turn/start', {
      threadId,
      input: [{ type: 'text', text: 'Turn 1 on gpt-5.6-sol. Reply with: T1_DONE' }],
    });
    const t1Comp = await server.waitForTurnCompletion(turn1.turn?.id);
    console.log('Turn 1 completed:', turn1.turn?.id);

    // Turn 2: switch model to gpt-5.5
    console.log('Starting Turn 2 with model: gpt-5.5...');
    const turn2 = await server.request('turn/start', {
      threadId,
      model: 'gpt-5.5',
      input: [{ type: 'text', text: 'Turn 2 on gpt-5.5. Reply with: T2_DONE' }],
    });
    const t2Comp = await server.waitForTurnCompletion(turn2.turn?.id);
    console.log('Turn 2 completed:', turn2.turn?.id);

    // Check rollout lines on disk
    const rolloutTurnContext = findRolloutLines(threadId, 'turn_context');
    const rolloutSettings = findRolloutLines(threadId, 'thread_settings_applied');

    let t1Model = null;
    let t2Model = null;
    for (const line of rolloutTurnContext) {
      try {
        const j = JSON.parse(line);
        if (j.payload?.turn_id === turn1.turn?.id) t1Model = j.payload?.model;
        if (j.payload?.turn_id === turn2.turn?.id) t2Model = j.payload?.model;
      } catch {}
    }

    console.log('Rollout Turn 1 model:', t1Model);
    console.log('Rollout Turn 2 model:', t2Model);

    const result = {
      pass: t2Model === 'gpt-5.5' && t1Model !== t2Model,
      threadId,
      turn1Id: turn1.turn?.id,
      turn2Id: turn2.turn?.id,
      turn1Model: t1Model,
      turn2Model: t2Model,
      rawTurn1Context: rolloutTurnContext.find((l) => l.includes(turn1.turn?.id)) || null,
      rawTurn2Context: rolloutTurnContext.find((l) => l.includes(turn2.turn?.id)) || null,
    };

    fs.writeFileSync(path.join(OUT_DIR, 'codex_appserver_model_switch.json'), JSON.stringify(result, null, 2));
    console.log('Result saved:', JSON.stringify(result, null, 2));
  } finally {
    server.close();
  }
}

main().catch(console.error);
