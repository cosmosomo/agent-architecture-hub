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

class AppServerClient {
  constructor() {
    this.cp = null;
    this.rl = null;
    this.reqId = 1;
    this.pending = new Map();
    this.notifications = [];
    this.reverseRequests = [];
    this.reverseHandler = null;
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
          console.error('[AppServer Non-JSON]', line);
        }
      });

      this.cp.stderr.on('data', (d) => {
        // console.error('[AppServer Stderr]', d.toString());
      });

      this.cp.on('error', reject);

      // Perform handshake
      this.request('initialize', {
        clientInfo: { name: 'probe-appserver', title: 'Probe AppServer', version: '1.0.0' },
        capabilities: { experimentalApi: true, optOutNotificationMethods: [] },
      }).then((res) => {
        // Send initialized notification
        this.notify('initialized', {});
        resolve(res);
      }).catch(reject);
    });
  }

  handleMessage(msg) {
    if (msg.id !== undefined && !msg.method) {
      // Response to client request
      const p = this.pending.get(msg.id);
      if (p) {
        this.pending.delete(msg.id);
        if (msg.error) p.reject(msg.error);
        else p.resolve(msg.result);
      }
    } else if (msg.id !== undefined && msg.method) {
      // Reverse request from server (ServerRequest)
      console.log('[AppServer ReverseRequest]', msg.method, 'ID:', msg.id);
      this.reverseRequests.push(msg);
      if (this.reverseHandler) {
        this.reverseHandler(msg).then((res) => {
          this.sendResponse(msg.id, res);
        }).catch((err) => {
          this.sendResponse(msg.id, { error: err.message });
        });
      }
    } else if (msg.method && msg.id === undefined) {
      // Server notification
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

  sendResponse(id, result) {
    const payload = JSON.stringify({ id, result }) + '\n';
    this.cp.stdin.write(payload);
  }

  close() {
    if (this.cp) {
      this.cp.kill();
    }
  }
}

async function main() {
  console.log('=== Starting Codex L0 App-Server Probing ===');
  const client = new AppServerClient();
  const initRes = await client.start();
  console.log('Handshake succeeded:', JSON.stringify(initRes));

  const results = {};

  // 13. model-list
  console.log('--- Testing model/list ---');
  try {
    const modelListRes = await client.request('model/list', {});
    const count = modelListRes.data?.length || 0;
    const sample = modelListRes.data?.map(m => m.model || m.id).slice(0, 5) || [];
    results['model-list'] = {
      pass: count > 0,
      evidence: `model_count=${count}, models=${sample.join(',')}`,
      cmd: `app-server RPC model/list`,
    };
  } catch (e) {
    results['model-list'] = { pass: false, evidence: JSON.stringify(e) };
  }

  // 17. quota
  console.log('--- Testing quota (account/rateLimits/read) ---');
  try {
    const quotaRes = await client.request('account/rateLimits/read', {});
    results['quota'] = {
      pass: true,
      evidence: JSON.stringify(quotaRes),
      cmd: `app-server RPC account/rateLimits/read`,
    };
  } catch (e) {
    results['quota'] = {
      pass: false,
      na: true,
      evidence: JSON.stringify(e),
      cmd: `app-server RPC account/rateLimits/read`,
      note: 'codex account authentication required to read rate limits; fails under third-party bearer token config.',
    };
  }

  // 1. open & 14. model-new
  console.log('--- Testing thread/start and turn/start (open & model-new) ---');
  let threadId = null;
  let turn1Id = null;
  let turn1Answer = '';
  try {
    const threadRes = await client.request('thread/start', {
      cwd: CWD,
      model: 'gpt-5.6-sol',
      sandbox: 'workspace-write',
      approvalPolicy: 'never',
    });
    threadId = threadRes.thread?.id;
    console.log('thread/start returned threadId:', threadId);

    const turnStartNoticePromise = new Promise((resolve) => {
      const check = setInterval(() => {
        const completed = client.notifications.find(n => n.method === 'turn/completed' && n.params?.threadId === threadId);
        if (completed) {
          clearInterval(check);
          resolve(completed.params.turn);
        }
      }, 300);
    });

    const turnRes = await client.request('turn/start', {
      threadId,
      input: [{ type: 'text', text: 'Remember secret: APPSERVER_CODE_DELTA_999. Reply with: APPSERVER_OPEN_OK' }],
    });
    turn1Id = turnRes.turn?.id;
    console.log('turn/start returned turnId:', turn1Id);

    const completedTurn = await turnStartNoticePromise;
    console.log('turn 1 completed, status:', completedTurn?.status);

    const agentMsgs = client.notifications.filter(n => n.method === 'item/completed' && n.params?.item?.type === 'agent_message');
    turn1Answer = agentMsgs[agentMsgs.length - 1]?.params?.item?.text || '';

    results['open'] = {
      pass: completedTurn?.status === 'completed' && turn1Answer.includes('APPSERVER_OPEN_OK'),
      evidence: `threadId=${threadId}, turnId=${turn1Id}, status=${completedTurn?.status}, reply=${turn1Answer.trim()}`,
      cmd: `app-server RPC thread/start + turn/start`,
    };
    results['model-new'] = {
      pass: !!threadRes.model && threadRes.model === 'gpt-5.6-sol',
      evidence: `thread.model=${threadRes.model}, requested=gpt-5.6-sol`,
      cmd: `app-server RPC thread/start { model: "gpt-5.6-sol" }`,
    };
  } catch (e) {
    results['open'] = { pass: false, evidence: JSON.stringify(e) };
    results['model-new'] = { pass: false, evidence: JSON.stringify(e) };
  }

  // 4. observe-live
  console.log('--- Testing observe-live ---');
  const liveNotifs = client.notifications.filter(n => n.params?.threadId === threadId);
  const liveMethods = [...new Set(liveNotifs.map(n => n.method))];
  results['observe-live'] = {
    pass: liveNotifs.length > 5,
    evidence: `received ${liveNotifs.length} notifications, methods: ${liveMethods.join(',')}`,
    cmd: `app-server ServerNotification stream`,
  };

  // 2. resume
  console.log('--- Testing resume ---');
  if (threadId) {
    const resumeTurnNotice = new Promise((resolve) => {
      const check = setInterval(() => {
        const completed = client.notifications.filter(n => n.method === 'turn/completed' && n.params?.threadId === threadId);
        if (completed.length >= 2) {
          clearInterval(check);
          resolve(completed[completed.length - 1].params.turn);
        }
      }, 300);
    });

    const turn2Res = await client.request('turn/start', {
      threadId,
      input: [{ type: 'text', text: 'What was the secret code I asked you to remember? Reply ONLY with the code.' }],
    });
    const cTurn2 = await resumeTurnNotice;
    const msgs = client.notifications.filter(n => n.method === 'item/completed' && n.params?.item?.type === 'agent_message');
    const lastMsg = msgs[msgs.length - 1]?.params?.item?.text || '';
    const recalled = lastMsg.includes('APPSERVER_CODE_DELTA_999');
    console.log('turn 2 recall:', recalled, 'text:', lastMsg);
    results['resume'] = {
      pass: recalled,
      evidence: `recalled=${recalled}, reply=${lastMsg.trim()}`,
      cmd: `app-server RPC turn/start on loaded thread`,
    };
  } else {
    results['resume'] = { pass: false, evidence: 'skipped: threadId missing' };
  }

  // 5. observe-history
  console.log('--- Testing observe-history (thread/read and thread/turns/list) ---');
  try {
    const readRes = await client.request('thread/read', { threadId });
    const turnsRes = await client.request('thread/turns/list', { threadId });
    const turnsCount = turnsRes.data?.length || 0;
    results['observe-history'] = {
      pass: turnsCount >= 2,
      evidence: `thread/read title="${readRes.thread?.title}", thread/turns/list count=${turnsCount}`,
      cmd: `app-server RPC thread/read + thread/turns/list`,
    };
  } catch (e) {
    results['observe-history'] = { pass: false, evidence: JSON.stringify(e) };
  }

  // 6. state
  console.log('--- Testing state ---');
  const statusNotifs = client.notifications.filter(n => n.method === 'thread/status/changed');
  const stateTypes = statusNotifs.map(n => n.params?.status?.type);
  results['state'] = {
    pass: stateTypes.length > 0,
    evidence: `thread/status/changed transitions: ${stateTypes.join(' -> ')}`,
    cmd: `app-server ServerNotification thread/status/changed`,
  };

  // 7. cancel (turn/interrupt)
  console.log('--- Testing cancel (turn/interrupt) ---');
  try {
    const countTurnRes = await client.request('turn/start', {
      threadId,
      input: [{ type: 'text', text: 'Count slowly from 1 to 200, one per line.' }],
    });
    const cTurnId = countTurnRes.turn?.id;
    console.log('Started counting turn:', cTurnId);

    // Wait 1.5 seconds and interrupt
    await new Promise(r => setTimeout(r, 1500));
    console.log('Sending turn/interrupt...');
    await client.request('turn/interrupt', { threadId, turnId: cTurnId });

    // Wait for turn/completed with status interrupted
    const interruptedNotice = await new Promise((resolve) => {
      const check = setInterval(() => {
        const n = client.notifications.find(x => x.method === 'turn/completed' && x.params?.turn?.id === cTurnId);
        if (n) {
          clearInterval(check);
          resolve(n.params.turn);
        }
      }, 200);
    });
    console.log('Interrupted notice received, status:', interruptedNotice?.status);

    // Verify thread can accept next turn
    const resumeAfterInterrupt = new Promise((resolve) => {
      const check = setInterval(() => {
        const completed = client.notifications.filter(x => x.method === 'turn/completed' && x.params?.threadId === threadId);
        const last = completed[completed.length - 1];
        if (last && last.params?.turn?.id !== cTurnId) {
          clearInterval(check);
          resolve(last.params.turn);
        }
      }, 300);
    });
    await client.request('turn/start', {
      threadId,
      input: [{ type: 'text', text: 'Reply with: INTERRUPT_RECOVERED_OK' }],
    });
    const nextTurn = await resumeAfterInterrupt;
    const allMsgs = client.notifications.filter(n => n.method === 'item/completed' && n.params?.item?.type === 'agent_message');
    const finalMsg = allMsgs[allMsgs.length - 1]?.params?.item?.text || '';

    results['cancel'] = {
      pass: interruptedNotice?.status === 'interrupted' && finalMsg.includes('INTERRUPT_RECOVERED_OK'),
      evidence: `interrupted_turn_status=${interruptedNotice?.status}, next_turn_reply=${finalMsg.trim()}`,
      cmd: `app-server RPC turn/interrupt { threadId, turnId }`,
    };
  } catch (e) {
    results['cancel'] = { pass: false, evidence: JSON.stringify(e) };
  }

  // 9. steer (turn/steer)
  console.log('--- Testing steer (turn/steer) ---');
  try {
    const steerTurnRes = await client.request('turn/start', {
      threadId,
      input: [{ type: 'text', text: 'Count from 1 to 100, one number per line.' }],
    });
    const sTurnId = steerTurnRes.turn?.id;

    await new Promise(r => setTimeout(r, 1000));
    console.log('Sending turn/steer mid-turn...');
    const steerRes = await client.request('turn/steer', {
      threadId,
      expectedTurnId: sTurnId,
      input: [{ type: 'text', text: 'Stop counting now and reply with: STEER_RECEIVED_CONFIRMED' }],
    });
    console.log('turn/steer RPC result:', JSON.stringify(steerRes));

    // Wait for completion
    const steerTurnCompleted = await new Promise((resolve) => {
      const check = setInterval(() => {
        const n = client.notifications.find(x => x.method === 'turn/completed' && x.params?.turn?.id === sTurnId);
        if (n) {
          clearInterval(check);
          resolve(n.params.turn);
        }
      }, 300);
    });
    const steerMsgs = client.notifications.filter(n => n.method === 'item/completed' && n.params?.item?.type === 'agent_message');
    const sReply = steerMsgs[steerMsgs.length - 1]?.params?.item?.text || '';
    const steerSuccess = sReply.includes('STEER_RECEIVED_CONFIRMED');

    results['steer'] = {
      pass: steerSuccess,
      evidence: `steerResult=${JSON.stringify(steerRes)}, reply=${sReply.trim()}`,
      cmd: `app-server RPC turn/steer { threadId, expectedTurnId, input }`,
    };
  } catch (e) {
    results['steer'] = { pass: false, evidence: JSON.stringify(e) };
  }

  // 10. permission
  console.log('--- Testing permission (on-request approval) ---');
  let permThreadId = null;
  let receivedApprovalReq = null;
  const permFile = path.join(CWD, 'channels', 'probe', 'scripts', 'tmp', 'appserver_perm_test.txt');
  if (fs.existsSync(permFile)) fs.unlinkSync(permFile);

  try {
    const pThread = await client.request('thread/start', {
      cwd: CWD,
      model: 'gpt-5.6-sol',
      sandbox: 'workspace-write',
      approvalPolicy: 'on-request',
      approvalsReviewer: 'user',
    });
    permThreadId = pThread.thread?.id;

    client.reverseHandler = async (req) => {
      console.log('Captured ReverseRequest in test:', req.method);
      receivedApprovalReq = req;
      return { decision: 'accept' };
    };

    const pTurn = await client.request('turn/start', {
      threadId: permThreadId,
      input: [{ type: 'text', text: `Write a file at "${permFile}" with content "PERM_SUCCESS".` }],
    });

    // Wait for turn completion or approval request
    await new Promise((resolve) => {
      const check = setInterval(() => {
        const comp = client.notifications.find(x => x.method === 'turn/completed' && x.params?.threadId === permThreadId);
        if (comp || receivedApprovalReq) {
          clearInterval(check);
          resolve();
        }
      }, 300);
    });

    results['permission'] = {
      pass: !!receivedApprovalReq,
      evidence: receivedApprovalReq ? JSON.stringify(receivedApprovalReq) : 'No ServerRequest received during turn',
      cmd: `app-server RPC approvalPolicy="on-request" ServerRequest callback`,
      note: receivedApprovalReq ? 'Server sent reverse request, client responded decision: accept' : 'Tool ran without reverse request or failed',
    };
  } catch (e) {
    results['permission'] = { pass: false, evidence: JSON.stringify(e) };
  }

  // 11. fork
  console.log('--- Testing fork (thread/fork) ---');
  try {
    const forkRes = await client.request('thread/fork', { threadId });
    const forkedId = forkRes.thread?.id;
    const isForkDiff = forkedId && forkedId !== threadId;
    results['fork'] = {
      pass: isForkDiff,
      evidence: `originalThreadId=${threadId}, forkedThreadId=${forkedId}`,
      cmd: `app-server RPC thread/fork { threadId }`,
    };
  } catch (e) {
    results['fork'] = { pass: false, evidence: JSON.stringify(e) };
  }

  // 12. compact
  console.log('--- Testing compact (thread/compact/start) ---');
  try {
    const compactRes = await client.request('thread/compact/start', { threadId });
    results['compact'] = {
      pass: true,
      evidence: JSON.stringify(compactRes),
      cmd: `app-server RPC thread/compact/start { threadId }`,
    };
  } catch (e) {
    results['compact'] = { pass: false, evidence: JSON.stringify(e) };
  }

  // 15. model-switch
  console.log('--- Testing model-switch ---');
  try {
    const switchTurnPromise = new Promise((resolve) => {
      const check = setInterval(() => {
        const completed = client.notifications.filter(x => x.method === 'turn/completed' && x.params?.threadId === threadId);
        const last = completed[completed.length - 1];
        if (last) {
          clearInterval(check);
          resolve(last.params);
        }
      }, 300);
    });

    const switchTurn = await client.request('turn/start', {
      threadId,
      model: 'gpt-6.1-sol',
      input: [{ type: 'text', text: 'Reply with MODEL_SWITCH_OK' }],
    });
    const completedTurnInfo = await switchTurnPromise;
    results['model-switch'] = {
      pass: true,
      evidence: `turn/start requested model="gpt-6.1-sol", turn.id=${switchTurn.turn?.id}, usage=${JSON.stringify(completedTurnInfo?.tokenUsage?.total || completedTurnInfo?.turn?.usage)}`,
      cmd: `app-server RPC turn/start { threadId, model: "gpt-6.1-sol" }`,
    };
  } catch (e) {
    results['model-switch'] = { pass: false, evidence: JSON.stringify(e) };
  }

  // 16. mode-switch
  console.log('--- Testing mode-switch (thread/settings/update) ---');
  try {
    const modeRes = await client.request('thread/settings/update', {
      threadId,
      sandboxPolicy: { type: 'readOnly' },
    });
    results['mode-switch'] = {
      pass: true,
      evidence: JSON.stringify(modeRes),
      cmd: `app-server RPC thread/settings/update { threadId, sandboxPolicy: "readOnly" }`,
    };
  } catch (e) {
    results['mode-switch'] = {
      pass: false,
      evidence: JSON.stringify(e),
      cmd: `app-server RPC thread/settings/update`,
    };
  }

  // 3. resume-native
  console.log('--- Testing resume-native (thread/resume) ---');
  try {
    const resumeRes = await client.request('thread/resume', {
      threadId,
      model: 'gpt-5.6-sol',
      sandbox: 'workspace-write',
      approvalPolicy: 'never',
    });
    results['resume-native'] = {
      pass: !!resumeRes.thread?.id,
      evidence: `thread/resume successfully reloaded thread ${resumeRes.thread?.id}`,
      cmd: `app-server RPC thread/resume { threadId }`,
    };
  } catch (e) {
    results['resume-native'] = { pass: false, evidence: JSON.stringify(e) };
  }

  // 8. close
  console.log('--- Testing close (thread/unsubscribe / thread/archive) ---');
  try {
    const unsubsRes = await client.request('thread/unsubscribe', { threadId });
    const archiveRes = await client.request('thread/archive', { threadId });
    results['close'] = {
      pass: true,
      evidence: `unsubscribe=${JSON.stringify(unsubsRes)}, archive=${JSON.stringify(archiveRes)}`,
      cmd: `app-server RPC thread/unsubscribe + thread/archive`,
    };
  } catch (e) {
    results['close'] = { pass: false, evidence: JSON.stringify(e) };
  }

  client.close();
  fs.writeFileSync(path.join(CWD, 'channels', 'probe', 'scripts', 'codex', 'results_l0_appserver.json'), JSON.stringify(results, null, 2));
  console.log('L0 AppServer probing complete! Written to results_l0_appserver.json');
}

main().catch(console.error);
