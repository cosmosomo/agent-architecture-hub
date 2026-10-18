import { spawn } from 'node:child_process';
import readline from 'node:readline';
import fs from 'node:fs';
import path from 'node:path';

const CWD = 'E:\\program\\GIT\\Agent\\multi\\Agent-Architecture-Hub';
const ENV = {
  ...process.env,
  HTTP_PROXY: 'http://127.0.0.1:7892',
  HTTPS_PROXY: 'http://127.0.0.1:7892',
};

class CodexAppServerProbe {
  constructor() {
    this.cp = null;
    this.rl = null;
    this.reqId = 1;
    this.pending = new Map();
    this.notifications = [];
    this.serverRequests = [];
    this.approvalResolver = null;
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
        } catch (e) {
          // ignore non-json
        }
      });

      this.cp.stderr.on('data', (d) => {
        const s = d.toString();
        if (s.includes('ERROR') || s.includes('error')) {
          console.error('[STDERR]', s.trim());
        }
      });

      this.cp.on('error', reject);

      this.request('initialize', {
        clientInfo: { name: 'probe-appserver', title: 'Probe App Server', version: '0.1.0' },
        capabilities: { experimentalApi: true, optOutNotificationMethods: [] },
      }).then((res) => {
        this.notify('initialized', {});
        resolve(res);
      }).catch(reject);
    });
  }

  handleMessage(msg) {
    // 1. Response to client request
    if (msg.id !== undefined && !msg.method) {
      const p = this.pending.get(msg.id);
      if (p) {
        this.pending.delete(msg.id);
        if (msg.error) p.reject(msg.error);
        else p.resolve(msg.result);
      }
      return;
    }

    // 2. ServerRequest (Reverse RPC: approval, user input, etc.)
    if (msg.id !== undefined && msg.method) {
      console.log(`[SERVER_REQUEST] id=${msg.id} method=${msg.method}`);
      this.serverRequests.push(msg);
      if (this.approvalResolver) {
        this.approvalResolver(msg);
      } else {
        // Default decline to avoid hanging
        console.log(`[SERVER_REQUEST] Auto-declining unhandled request ${msg.id}`);
        this.sendResponse(msg.id, { decision: 'decline' });
      }
      return;
    }

    // 3. ServerNotification
    if (msg.method && msg.id === undefined) {
      this.notifications.push(msg);
      if (msg.method === 'thread/status/changed') {
        console.log(`[NOTIF status] threadId=${msg.params?.threadId} status=${JSON.stringify(msg.params?.status)}`);
      } else if (msg.method === 'turn/started') {
        console.log(`[NOTIF turn/started] turnId=${msg.params?.turn?.id}`);
      } else if (msg.method === 'turn/completed') {
        console.log(`[NOTIF turn/completed] turnId=${msg.params?.turn?.id} status=${msg.params?.turn?.status}`);
      }
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

  sendResponse(id, result) {
    const payload = JSON.stringify({ id, result }) + '\n';
    this.cp.stdin.write(payload);
  }

  sendError(id, error) {
    const payload = JSON.stringify({ id, error }) + '\n';
    this.cp.stdin.write(payload);
  }

  close() {
    if (this.cp) {
      try {
        this.cp.kill();
      } catch (e) {}
    }
  }

  async waitForTurnCompletion(turnId, timeoutMs = 90000) {
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
          reject(new Error(`Timeout waiting for turn ${turnId} completion (${timeoutMs}ms)`));
        }
      }, 200);
    });
  }
}

async function runTest() {
  console.log('=== Starting Codex App Server Probe Test ===');
  const probe = new CodexAppServerProbe();
  const initRes = await probe.start();
  console.log('Init success! UserAgent:', initRes.userAgent, 'CodexHome:', initRes.codexHome);

  const results = {};

  try {
    // 1. 新建 (open / thread/start)
    console.log('\n--- Step 1: 新建会话 (thread/start + thread/name/set) ---');
    const tStart = await probe.request('thread/start', {
      cwd: CWD,
      model: 'gpt-6.1-sol',
      sandbox: 'workspace-write',
      approvalPolicy: 'never',
    });
    const threadId = tStart.thread?.id;
    console.log('Created threadId:', threadId);

    const sessionName = `probe-appserver-${Date.now()}`;
    const nameRes = await probe.request('thread/name/set', {
      threadId,
      name: sessionName,
    });
    console.log('Named thread:', sessionName, 'result:', nameRes);
    results.open = { threadId, sessionName, tStart };

    // 2. 跑一轮 (turn/start)
    console.log('\n--- Step 2: 跑第一轮常规问答 ---');
    const turn1 = await probe.request('turn/start', {
      threadId,
      input: [{ type: 'text', text: '请输出一个很短的字符串：HELLO_CODEX_APPSERVER' }],
    });
    const turn1Id = turn1.turn?.id;
    console.log('Turn 1 started:', turn1Id);
    const comp1 = await probe.waitForTurnCompletion(turn1Id);
    console.log('Turn 1 completed:', comp1.turn?.status);

    const deltas1 = probe.notifications
      .filter((n) => n.method === 'item/agentMessage/delta' && n.params?.turnId === turn1Id)
      .map((n) => n.params?.delta || '')
      .join('');
    console.log('Turn 1 text:', deltas1.trim());
    results.first_turn = { turn1Id, status: comp1.turn?.status, text: deltas1.trim() };

    // 3. 轮内插话 (turn/steer)
    console.log('\n--- Step 3: 在进行中插一句话并确认被采纳 (turn/steer) ---');
    const turn2 = await probe.request('turn/start', {
      threadId,
      input: [{ type: 'text', text: '请详细阐述微积分的发展历程（写 300 字以上）。' }],
    });
    const turn2Id = turn2.turn?.id;
    console.log('Turn 2 started for steer test:', turn2Id);

    // 等待 1.5 秒确保模型开始生成
    await new Promise((r) => setTimeout(r, 1500));

    const steerSecret = `STEER_INJECTED_KEY_${Date.now() % 10000}`;
    console.log('Sending turn/steer with token:', steerSecret);
    const steerRes = await probe.request('turn/steer', {
      threadId,
      expectedTurnId: turn2Id,
      input: [{ type: 'text', text: `紧急插话：请立即停止微积分阐述，并在最终回复末尾单独附上唯一识别码：${steerSecret}` }],
    });
    console.log('turn/steer RPC response:', steerRes);

    const comp2 = await probe.waitForTurnCompletion(turn2Id);
    console.log('Turn 2 completed:', comp2.turn?.status);

    const deltas2 = probe.notifications
      .filter((n) => n.method === 'item/agentMessage/delta' && n.params?.turnId === turn2Id)
      .map((n) => n.params?.delta || '')
      .join('');
    console.log('Turn 2 end text sample:', deltas2.slice(-200));
    const steerAdopted = deltas2.includes(steerSecret);
    console.log('Steer token adopted:', steerAdopted);
    results.steer = { turn2Id, steerSecret, steerAdopted, steerRes };

    // 4. 打断 (turn/interrupt)
    console.log('\n--- Step 4: 轮内打断 (turn/interrupt) ---');
    const turn3 = await probe.request('turn/start', {
      threadId,
      input: [{ type: 'text', text: '从 1 连续数到 1000，每行输出一个数字和它的平方。' }],
    });
    const turn3Id = turn3.turn?.id;
    console.log('Turn 3 started for interrupt test:', turn3Id);

    // 等待 1 秒等生成开始
    await new Promise((r) => setTimeout(r, 1000));

    console.log('Calling turn/interrupt...');
    const interruptRes = await probe.request('turn/interrupt', {
      threadId,
      turnId: turn3Id,
    });
    console.log('turn/interrupt response:', interruptRes);

    const comp3 = await probe.waitForTurnCompletion(turn3Id);
    console.log('Turn 3 completed status:', comp3.turn?.status);
    results.interrupt = { turn3Id, status: comp3.turn?.status, interrupted: comp3.turn?.status === 'interrupted' };

    // 5. 分叉 (thread/fork)
    console.log('\n--- Step 5: 分叉出会话 (thread/fork) ---');
    const forkRes = await probe.request('thread/fork', {
      threadId,
    });
    const forkedThreadId = forkRes.thread?.id;
    console.log('Forked threadId:', forkedThreadId, 'forkedFromId:', forkRes.thread?.forkedFromId);

    // 在分叉会话上问一个第一轮的问题
    const turnFork = await probe.request('turn/start', {
      threadId: forkedThreadId,
      input: [{ type: 'text', text: '你在第一轮回复的测试字符串是什么？请只输出该字符串。' }],
    });
    const compFork = await probe.waitForTurnCompletion(turnFork.turn?.id);
    const deltasFork = probe.notifications
      .filter((n) => n.method === 'item/agentMessage/delta' && n.params?.turnId === turnFork.turn?.id)
      .map((n) => n.params?.delta || '')
      .join('');
    console.log('Fork reply text:', deltasFork.trim());
    const forkInherited = deltasFork.includes('HELLO_CODEX_APPSERVER');
    console.log('Fork inherited context:', forkInherited);
    results.fork = { forkedThreadId, parentThreadId: threadId, forkInherited, forkedFromId: forkRes.thread?.forkedFromId };

    // 6. 压缩 (thread/compact/start)
    console.log('\n--- Step 6: 压缩上下文 (thread/compact/start) ---');
    let compactNotif = null;
    const compactPromise = new Promise((resolve) => {
      const listener = (msg) => {
        if (msg.method === 'thread/compacted' || msg.method === 'context_compacted') {
          compactNotif = msg;
          resolve(msg);
        }
      };
      probe.notifications.push = function(...args) {
        for (const a of args) listener(a);
        return Array.prototype.push.apply(this, args);
      };
    });

    try {
      const compactRes = await probe.request('thread/compact/start', {
        threadId,
      });
      console.log('thread/compact/start response:', compactRes);
      // Wait a moment for possible compact notification or completion
      await Promise.race([compactPromise, new Promise((r) => setTimeout(r, 4000))]);
      results.compact = { success: true, compactRes, compactNotif };
    } catch (e) {
      console.error('Compact error:', e);
      results.compact = { success: false, error: e.message || String(e) };
    }

    // 7. 切模型再跑一轮 (model-switch via turn/start or thread/settings/update)
    console.log('\n--- Step 7: 切换模型并跑一轮 (model-switch) ---');
    try {
      // 方式 1: thread/settings/update
      const switchRes = await probe.request('thread/settings/update', {
        threadId,
        model: 'gpt-6-luna',
      });
      console.log('thread/settings/update response:', switchRes);

      // 跑一轮并显式指定或使用当前更新后的模型
      const turnModel = await probe.request('turn/start', {
        threadId,
        model: 'gpt-6-luna',
        input: [{ type: 'text', text: '请用一句话介绍你自己。' }],
      });
      const turnModelId = turnModel.turn?.id;
      const compModel = await probe.waitForTurnCompletion(turnModelId);
      console.log('Turn with gpt-6-luna completed:', compModel.turn?.status);

      const deltasModel = probe.notifications
        .filter((n) => n.method === 'item/agentMessage/delta' && n.params?.turnId === turnModelId)
        .map((n) => n.params?.delta || '')
        .join('');
      console.log('Model switch reply:', deltasModel.trim());
      results.modelSwitch = { success: true, model: 'gpt-6-luna', reply: deltasModel.trim() };
    } catch (e) {
      console.error('Model switch error:', e);
      results.modelSwitch = { success: false, error: e.message || String(e) };
    }

    // 8. 审批挂起与答复测试 (approval request & resolution)
    console.log('\n--- Step 8: 审批挂起与外部答复测试 (ServerRequest requestApproval) ---');
    try {
      // 创建一个 approvalPolicy 为 on-request 的新线程来测试审批
      const tApproval = await probe.request('thread/start', {
        cwd: CWD,
        model: 'gpt-6.1-sol',
        sandbox: 'workspace-write',
        approvalPolicy: 'on-request',
      });
      const approvalThreadId = tApproval.thread?.id;
      console.log('Approval test threadId:', approvalThreadId);

      let approvalRequestReceived = null;
      let approvalResolvedNotif = null;

      probe.approvalResolver = (req) => {
        console.log(`[APPROVAL HANDLER] Got approval request: method=${req.method} id=${req.id}`);
        approvalRequestReceived = req;
        // 外部在挂起时答复：同意执行
        setTimeout(() => {
          console.log(`[APPROVAL HANDLER] Sending accept decision for id=${req.id}`);
          probe.sendResponse(req.id, { decision: 'accept' });
        }, 1000);
      };

      // 监听 serverRequest/resolved 通知
      const origPush = probe.notifications.push;
      probe.notifications.push = function(...args) {
        for (const a of args) {
          if (a.method === 'serverRequest/resolved') {
            approvalResolvedNotif = a;
            console.log('[NOTIF serverRequest/resolved]:', JSON.stringify(a.params));
          }
        }
        return origPush.apply(this, args);
      };

      const turnApproval = await probe.request('turn/start', {
        threadId: approvalThreadId,
        input: [{ type: 'text', text: '请运行命令：cmd.exe /c echo APPROVAL_TEST_SUCCESS' }],
      });
      const turnAppId = turnApproval.turn?.id;
      console.log('Approval turn started:', turnAppId);

      const compApp = await probe.waitForTurnCompletion(turnAppId, 60000);
      console.log('Approval turn completed:', compApp.turn?.status);

      results.approval = {
        success: !!approvalRequestReceived,
        requestMethod: approvalRequestReceived?.method,
        requestId: approvalRequestReceived?.id,
        resolved: !!approvalResolvedNotif,
        turnStatus: compApp.turn?.status,
      };
    } catch (e) {
      console.error('Approval test error:', e);
      results.approval = { success: false, error: e.message || String(e) };
    }

    // 9. 读历史 (thread/read & thread/turns/list)
    console.log('\n--- Step 9: 读每一步的事件流与历史 (thread/read + thread/turns/list) ---');
    try {
      const readMeta = await probe.request('thread/read', { threadId });
      const turnsList = await probe.request('thread/turns/list', { threadId, limit: 10 });
      console.log('Thread read historyMode:', readMeta.thread?.historyMode, 'turnsCount:', turnsList.data?.length || turnsList.data?.items?.length);
      results.read = {
        historyMode: readMeta.thread?.historyMode,
        turnsCount: turnsList.data?.length || turnsList.data?.items?.length,
      };
    } catch (e) {
      console.error('Read error:', e);
      results.read = { success: false, error: e.message || String(e) };
    }

    // 保存测试产物
    fs.writeFileSync(
      path.join(CWD, 'channels', 'probe', 'scripts', 'codex_appserver_full_cycle_result.json'),
      JSON.stringify(results, null, 2)
    );
    console.log('\n=== Full Cycle Result Summary ===');
    console.log(JSON.stringify(results, null, 2));

  } finally {
    probe.close();
  }
}

runTest().catch((err) => {
  console.error('Fatal probe error:', err);
  process.exit(1);
});
