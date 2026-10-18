import { spawn } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';

const PORT = 8931;
const REPO_ROOT = 'E:\\program\\GIT\\Agent\\multi\\Agent-Architecture-Hub';

const srv = spawn('node', ['--no-warnings=ExperimentalWarning', 'trace/apps/cli/src/main.ts', 'serve', '--port', String(PORT)], {
  cwd: REPO_ROOT,
  stdio: ['ignore', 'pipe', 'pipe'],
  windowsHide: true,
});

function httpPost(path, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request(
      `http://127.0.0.1:${PORT}${path}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
        },
      },
      (res) => {
        let buf = '';
        res.on('data', (c) => (buf += c));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, data: JSON.parse(buf), raw: buf });
          } catch {
            resolve({ status: res.statusCode, data: buf, raw: buf });
          }
        });
      },
    );
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function httpGet(path) {
  return new Promise((resolve, reject) => {
    http.get(`http://127.0.0.1:${PORT}${path}`, (res) => {
      let buf = '';
      res.on('data', (c) => (buf += c));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(buf), raw: buf });
        } catch {
          resolve({ status: res.statusCode, data: buf, raw: buf });
        }
      });
    }).on('error', reject);
  });
}

async function waitHealth(maxMs = 60000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    try {
      const res = await httpGet('/api/health');
      if (res.status === 200 && res.data?.ok) return res.data;
    } catch {}
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error('Timeout waiting for health');
}

try {
  await waitHealth();
  console.log('=== L2 Testing: Core Lifecycle & HANDOFF.md Verification ===\n');

  const evidence = {};

  // ----------------------------------------------------
  // TEST 1: Native session dispatch (traceSessionId pointing to native session)
  // Check HANDOFF.md §3 claim: "点开原生会话发消息是否新建了 acpx 空会话"
  // ----------------------------------------------------
  console.log('--- TEST 1: Native Session Dispatch ---');
  // Sample native IDs:
  // codex: codex:01a14366-e657-7af2-8e24-4064d3a80609
  // claude: claude-code:455376bf-3926-4c9b-8324-e29d545a99fe
  // zcode: zcode:sess_2f9d76a9-0152-48a2-9b09-7525811c9715
  // antigravity: antigravity:1b07e8ee-2b57-4420-9651-2239b4f8a439

  const nativeTargets = [
    { channel: 'zcode', traceSessionId: 'zcode:sess_2f9d76a9-0152-48a2-9b09-7525811c9715' },
    { channel: 'codex', traceSessionId: 'codex:01a14366-e657-7af2-8e24-4064d3a80609' },
    { channel: 'claude', traceSessionId: 'claude-code:455376bf-3926-4c9b-8324-e29d545a99fe' },
    { channel: 'antigravity', traceSessionId: 'antigravity:1b07e8ee-2b57-4420-9651-2239b4f8a439' },
  ];

  evidence.nativeDispatch = [];

  for (const t of nativeTargets) {
    console.log(`Testing native dispatch for channel=${t.channel}, traceSessionId=${t.traceSessionId}...`);
    // Pass wait=false so we observe how gateway resolves the sessionName and run
    const res = await httpPost('/api/gateway/send', {
      channel: t.channel,
      traceSessionId: t.traceSessionId,
      // sessionName omitted intentionally to simulate frontend clicking on a native session!
      prompt: 'PING-TEST-NATIVE-DISPATCH',
      wait: false,
    });
    console.log(`Result: ok=${res.data?.ok}, action=${res.data?.action}, sessionName=${res.data?.sessionName}, traceSessionId=${res.data?.run?.traceSessionId}`);
    evidence.nativeDispatch.push({
      channel: t.channel,
      inputTraceSessionId: t.traceSessionId,
      assignedSessionName: res.data?.sessionName,
      returnedRunTraceSessionId: res.data?.run?.traceSessionId,
      response: res.data,
    });
    // Immediately cancel to not waste tokens/cycles
    await httpPost('/api/gateway/cancel', { channel: t.channel, sessionName: res.data?.sessionName });
    await new Promise((r) => setTimeout(r, 1000));
  }

  // ----------------------------------------------------
  // TEST 2: mode="queue" and mode="interrupt"
  // ----------------------------------------------------
  console.log('\n--- TEST 2: mode=queue & mode=interrupt ---');
  const qSession = 'probe-l2a-queue-test';
  console.log('Starting background run on antigravity...');
  const run1 = await httpPost('/api/gateway/send', {
    channel: 'antigravity',
    sessionName: qSession,
    prompt: '请用慢速思考，详细写出1到50的英文单词，每行一个。',
    model: 'flash_lite',
    wait: false,
  });
  console.log('Run 1 started:', run1.data?.runId, 'status:', run1.data?.status);

  await new Promise((r) => setTimeout(r, 500));

  console.log('Sending concurrent message with mode=queue...');
  const queueRes = await httpPost('/api/gateway/send', {
    channel: 'antigravity',
    sessionName: qSession,
    prompt: 'QUEUE_TEST_PROMPT',
    mode: 'queue',
    wait: false,
  });
  console.log('Queue result:', queueRes.status, queueRes.data);
  evidence.queueTest = queueRes.data;

  console.log('Sending concurrent message with mode=interrupt...');
  const interruptRes = await httpPost('/api/gateway/send', {
    channel: 'antigravity',
    sessionName: qSession,
    prompt: 'INTERRUPT_TEST_PROMPT',
    mode: 'interrupt',
    wait: false,
  });
  console.log('Interrupt result:', interruptRes.status, interruptRes.data);
  evidence.interruptTest = interruptRes.data;

  // ----------------------------------------------------
  // TEST 3: POST /api/gateway/cancel
  // ----------------------------------------------------
  console.log('\n--- TEST 3: POST /api/gateway/cancel ---');
  const cancelRes = await httpPost('/api/gateway/cancel', {
    channel: 'antigravity',
    sessionName: qSession,
  });
  console.log('Cancel result:', cancelRes.status, cancelRes.data);
  evidence.cancelTest = cancelRes.data;

  await new Promise((r) => setTimeout(r, 1000));
  const postCancelState = await httpGet('/api/gateway/state');
  const recentAborted = postCancelState.data.recentRuns.find((r) => r.sessionName === qSession);
  console.log('Recent run status after cancel:', recentAborted?.status, 'durationMs:', recentAborted?.durationMs);
  evidence.postCancelRun = recentAborted;

  // ----------------------------------------------------
  // TEST 4: POST /api/gateway/resume
  // ----------------------------------------------------
  console.log('\n--- TEST 4: POST /api/gateway/resume ---');
  const resumeRes = await httpPost('/api/gateway/resume', {
    channel: 'antigravity',
    sessionName: qSession,
    customHint: 'RESUME_HINT_TOKEN_999',
  });
  console.log('Resume response:', resumeRes.status, resumeRes.data?.action, resumeRes.data?.sessionName, resumeRes.data?.run?.prompt);
  evidence.resumeTest = resumeRes.data;

  // Cancel it
  await httpPost('/api/gateway/cancel', { channel: 'antigravity', sessionName: qSession });

  // ----------------------------------------------------
  // TEST 5: Model switch verification (POST /api/gateway/model)
  // Check HANDOFF.md §3 claim: "切模型是否只改了 .acpx 会话文件"
  // ----------------------------------------------------
  console.log('\n--- TEST 5: POST /api/gateway/model ---');
  const modelResZcode = await httpPost('/api/gateway/model', {
    channel: 'zcode',
    sessionName: 'probe-l2a-zcode-round',
    model: 'builtin:bigmodel-coding-plan\\GLM-5.3',
  });
  console.log('zcode set-model result:', modelResZcode.status, modelResZcode.data);

  const modelResAgy = await httpPost('/api/gateway/model', {
    channel: 'antigravity',
    sessionName: 'probe-l2a-antigravity-round',
    model: 'flash',
  });
  console.log('antigravity set-model result:', modelResAgy.status, modelResAgy.data);

  evidence.modelSwitch = {
    zcode: modelResZcode.data,
    antigravity: modelResAgy.data,
  };

  // ----------------------------------------------------
  // TEST 6: Fork / Handoff verification (POST /api/gateway/handoff)
  // Check HANDOFF.md §3 claim: "“分叉”是否只是把文字拼成提示发给新会话"
  // ----------------------------------------------------
  console.log('\n--- TEST 6: POST /api/gateway/handoff ---');
  const handoffRes = await httpPost('/api/gateway/handoff', {
    fromChannel: 'zcode',
    fromSessionName: 'probe-l2a-zcode-round',
    toChannel: 'antigravity',
    toSessionName: 'probe-l2a-handoff-dst',
    customInstruction: 'HANDOFF_INSTRUCTION_TOKEN_123',
    wait: false,
  });
  console.log('Handoff response:', handoffRes.status, handoffRes.data?.fromSessionName, '->', handoffRes.data?.toSessionName);
  console.log('Prompt generated in handoff:', handoffRes.data?.run?.prompt?.slice(0, 300));
  evidence.handoffTest = {
    response: handoffRes.data,
    promptSample: handoffRes.data?.run?.prompt,
  };
  await httpPost('/api/gateway/cancel', { channel: 'antigravity', sessionName: 'probe-l2a-handoff-dst' });

  // ----------------------------------------------------
  // TEST 7: Approval verification (POST /api/gateway/approve)
  // Check HANDOFF.md §3 claim: "审批是否是进程结束后用正则匹配出来的"
  // ----------------------------------------------------
  console.log('\n--- TEST 7: Approval Check (gateway.ts code & state) ---');
  const stateApprovals = (await httpGet('/api/gateway/state')).data.pendingApprovals;
  console.log('Current pendingApprovals in state:', stateApprovals.length);
  evidence.pendingApprovalsCount = stateApprovals.length;

  fs.writeFileSync(
    'channels/probe/scripts/L2/evidence_lifecycle_core.json',
    JSON.stringify(evidence, null, 2),
    'utf8',
  );
  console.log('\nAll tests complete! Evidence written to channels/probe/scripts/L2/evidence_lifecycle_core.json');

} catch (e) {
  console.error('Error during lifecycle test:', e);
} finally {
  srv.kill('SIGINT');
  await new Promise((r) => setTimeout(r, 2000));
  if (!srv.killed) srv.kill('SIGKILL');
}
