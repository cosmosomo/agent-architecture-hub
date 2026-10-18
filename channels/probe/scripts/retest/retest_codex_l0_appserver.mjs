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
        clientInfo: { name: 'retest-appserver', title: 'Retest AppServer', version: '1.0.0' },
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

  async waitForTurnCompletion(turnId, timeoutMs = 45000) {
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
  console.log('=== [Retest 2] codex/L0/app-server (steer, fork, compact, model-switch) ===');
  const server = new AppServer();
  await server.start();
  console.log('AppServer handshake complete.');

  const results = {};

  try {
    // -------------------------------------------------------------
    // Test 1: steer
    // -------------------------------------------------------------
    console.log('\n--- 1. Testing steer ---');
    const t1 = await server.request('thread/start', {
      cwd: CWD,
      model: 'gpt-5.6-sol',
      sandbox: 'workspace-write',
    });
    const steerThreadId = t1.thread?.id;
    console.log('Steer threadId:', steerThreadId);

    const steerTurnStart = await server.request('turn/start', {
      threadId: steerThreadId,
      input: [{ type: 'text', text: 'Count slowly from 1 to 50, outputting one number per line.' }],
    });
    const steerTurnId = steerTurnStart.turn?.id;
    console.log('Steer turnId:', steerTurnId);

    // Wait 1.5 seconds then steer
    await new Promise((r) => setTimeout(r, 1500));
    console.log('Sending turn/steer mid-turn...');
    const steerRpcRes = await server.request('turn/steer', {
      threadId: steerThreadId,
      expectedTurnId: steerTurnId,
      input: [{ type: 'text', text: 'STOP COUNTING NOW. Immediately reply with the exact phrase: STEER_IN_TURN_SUCCESS_781' }],
    });
    console.log('turn/steer RPC response:', JSON.stringify(steerRpcRes));

    const steerCompleted = await server.waitForTurnCompletion(steerTurnId);
    console.log('Turn completed status:', steerCompleted.turn?.status);

    // Collect agent messages and text deltas for this turn
    const deltas = server.notifications
      .filter((n) => n.method === 'item/agentMessage/delta' && n.params?.turnId === steerTurnId)
      .map((n) => n.params?.delta || '')
      .join('');
    const completedItems = server.notifications
      .filter((n) => n.method === 'item/completed' && n.params?.turnId === steerTurnId)
      .map((n) => n.params?.item?.text || JSON.stringify(n.params?.item))
      .join(' ');

    const allTurnText = (deltas + ' ' + completedItems).trim();
    const steerTookEffect = allTurnText.includes('STEER_IN_TURN_SUCCESS_781');
    console.log('Steer took effect in-turn:', steerTookEffect, 'snippet:', allTurnText.slice(-200));

    results['steer'] = {
      pass: steerTookEffect,
      threadId: steerThreadId,
      turnId: steerTurnId,
      steerRpcResponse: steerRpcRes,
      turnCompletedStatus: steerCompleted.turn?.status,
      steerTookEffect,
      turnOutputSample: allTurnText.slice(-300),
    };

    // -------------------------------------------------------------
    // Test 2: fork
    // -------------------------------------------------------------
    console.log('\n--- 2. Testing fork ---');
    const tForkParent = await server.request('thread/start', {
      cwd: CWD,
      model: 'gpt-5.6-sol',
      sandbox: 'workspace-write',
    });
    const forkParentId = tForkParent.thread?.id;
    console.log('Fork parent threadId:', forkParentId);

    const secret = 'APP_FORK_SEC_7721';
    const parentTurn = await server.request('turn/start', {
      threadId: forkParentId,
      input: [{ type: 'text', text: `Remember secret word: ${secret}. Reply with: SECRET_ACK.` }],
    });
    await server.waitForTurnCompletion(parentTurn.turn?.id);
    console.log('Parent saved secret.');

    const forkRpcRes = await server.request('thread/fork', { threadId: forkParentId });
    const forkedThreadId = forkRpcRes.thread?.id;
    console.log('Forked threadId:', forkedThreadId);

    const isDiffForkId = forkedThreadId && forkedThreadId !== forkParentId;

    // Ask secret in forked thread
    const forkTurn = await server.request('turn/start', {
      threadId: forkedThreadId,
      input: [{ type: 'text', text: 'What was the secret word saved in our previous conversation? Reply with ONLY the exact word.' }],
    });
    const forkTurnCompleted = await server.waitForTurnCompletion(forkTurn.turn?.id);

    const forkDeltas = server.notifications
      .filter((n) => n.method === 'item/agentMessage/delta' && n.params?.turnId === forkTurn.turn?.id)
      .map((n) => n.params?.delta || '')
      .join('');
    const forkCompletedItems = server.notifications
      .filter((n) => n.method === 'item/completed' && n.params?.turnId === forkTurn.turn?.id)
      .map((n) => n.params?.item?.text || JSON.stringify(n.params?.item))
      .join(' ');
    const forkReply = (forkDeltas + ' ' + forkCompletedItems).trim();
    const forkRecalled = forkReply.includes(secret);
    console.log('Fork recalled secret:', forkRecalled, 'reply:', forkReply);

    results['fork'] = {
      pass: isDiffForkId && forkRecalled,
      parentThreadId: forkParentId,
      forkedThreadId,
      forkRpcResponse: forkRpcRes,
      forkReply,
    };

    // -------------------------------------------------------------
    // Test 3: compact
    // -------------------------------------------------------------
    console.log('\n--- 3. Testing compact ---');
    const tCompact = await server.request('thread/start', {
      cwd: CWD,
      model: 'gpt-5.6-sol',
      sandbox: 'workspace-write',
    });
    const compactThreadId = tCompact.thread?.id;

    // Build context
    const bigText = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. '.repeat(100);
    const cTurn1 = await server.request('turn/start', {
      threadId: compactThreadId,
      input: [{ type: 'text', text: `Here is a long text to remember: ${bigText}. Reply with: OK.` }],
    });
    await server.waitForTurnCompletion(cTurn1.turn?.id);

    // Read thread token usage before compaction
    const threadBefore = await server.request('thread/read', { threadId: compactThreadId });
    const usageBefore = threadBefore.thread?.tokenUsage || (await server.request('thread/turns/list', { threadId: compactThreadId }));
    console.log('Usage before compact:', JSON.stringify(threadBefore.thread?.tokenUsage));

    // Call thread/compact/start
    console.log('Calling thread/compact/start...');
    const compactStartRes = await server.request('thread/compact/start', { threadId: compactThreadId });
    console.log('thread/compact/start result:', JSON.stringify(compactStartRes));

    // Wait for compact completion (either thread/compacted or turn/completed or delay)
    await new Promise((r) => setTimeout(r, 4000));

    const threadAfter = await server.request('thread/read', { threadId: compactThreadId });
    console.log('Usage after compact:', JSON.stringify(threadAfter.thread?.tokenUsage));

    const compactedNotifs = server.notifications.filter(
      (n) => n.method === 'thread/compacted' || (n.method === 'item/completed' && n.params?.item?.type === 'ContextCompaction')
    );

    results['compact'] = {
      compactStartRes,
      usageBefore: threadBefore.thread?.tokenUsage,
      usageAfter: threadAfter.thread?.tokenUsage,
      compactedNotifications: compactedNotifs,
      turnsAfter: (await server.request('thread/turns/list', { threadId: compactThreadId })).data?.length,
    };

    // -------------------------------------------------------------
    // Test 4: model-switch
    // -------------------------------------------------------------
    console.log('\n--- 4. Testing model-switch ---');
    const tSwitch = await server.request('thread/start', {
      cwd: CWD,
      model: 'gpt-5.6-sol',
      sandbox: 'workspace-write',
    });
    const switchThreadId = tSwitch.thread?.id;
    console.log('Switch threadId:', switchThreadId);

    // Turn 1 on gpt-5.6-sol
    const turn1 = await server.request('turn/start', {
      threadId: switchThreadId,
      input: [{ type: 'text', text: 'Turn 1 on gpt-5.6-sol. Reply with: T1_OK.' }],
    });
    await server.waitForTurnCompletion(turn1.turn?.id);

    // Turn 2 with model switched to gpt-5.5
    console.log('Starting Turn 2 with model: gpt-5.5...');
    const turn2 = await server.request('turn/start', {
      threadId: switchThreadId,
      model: 'gpt-5.5',
      input: [{ type: 'text', text: 'Turn 2 on gpt-5.5. Reply with: T2_OK.' }],
    });
    await server.waitForTurnCompletion(turn2.turn?.id);

    // Inspect rollout file for exact turn_context of turn 2
    const rolloutTurnContexts = findRolloutLines(switchThreadId, 'turn_context');
    const rolloutSettings = findRolloutLines(switchThreadId, 'thread_settings_applied');

    results['model-switch'] = {
      threadId: switchThreadId,
      turn1Id: turn1.turn?.id,
      turn2Id: turn2.turn?.id,
      turn2RequestedModel: 'gpt-5.5',
      rolloutTurnContexts,
      rolloutSettings,
    };

  } finally {
    server.close();
  }

  fs.writeFileSync(path.join(OUT_DIR, 'codex_l0_appserver.json'), JSON.stringify(results, null, 2));
  console.log('\nAll AppServer retest results saved to codex_l0_appserver.json');
}

main().catch((err) => {
  console.error('Fatal in appserver retest:', err);
  process.exit(1);
});
