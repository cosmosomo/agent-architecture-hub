import fs from 'node:fs';
import path from 'node:path';

const BASE = 'http://127.0.0.1:8899';

async function api(method, urlPath, body) {
  const res = await fetch(`${BASE}${urlPath}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  try {
    return { status: res.status, data: JSON.parse(text) };
  } catch {
    return { status: res.status, data: text };
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function testClaudeInTurnApproval() {
  const sessionName = `probe-claude-approve-${Date.now().toString().slice(-6)}`;
  const testFile = path.join(process.cwd(), 'channels', 'probe', 'scripts', 'output', `${sessionName}.txt`);
  try { fs.unlinkSync(testFile); } catch {}

  console.log(`\n=== [1/3] Testing Claude (haiku) stream-json mid-turn approval (${sessionName}) ===`);
  const startRes = await api('POST', '/api/gateway/send', {
    channel: 'claude',
    sessionName,
    model: 'haiku',
    permissions: 'reads',
    cwd: process.cwd(),
    prompt: `请立即调用 Write 工具创建文件 ${testFile}，内容只写一行：CLAUDE_IN_TURN_APPROVAL_OK_1018。完成后只回复“写入完成”。`,
  });
  console.log('Start response:', JSON.stringify({
    ok: startRes.data?.ok,
    action: startRes.data?.action,
    runId: startRes.data?.runId,
    status: startRes.data?.status,
  }));
  const initialRunId = startRes.data?.runId;
  if (!initialRunId) throw new Error('Failed to start claude run');

  let approval = null;
  let activeRunSnapshot = null;
  const deadline = Date.now() + 45000;
  while (Date.now() < deadline) {
    await sleep(500);
    const st = await api('GET', '/api/gateway/state');
    const pending = (st.data?.pendingApprovals || []).find(
      (a) => a.sessionName === sessionName && a.status === 'pending',
    );
    const run = (st.data?.activeRuns || []).find((r) => r.runId === initialRunId);
    if (pending) {
      approval = pending;
      activeRunSnapshot = run;
      break;
    }
    if (!run) {
      console.log('Run finished before approval appeared!');
      break;
    }
  }

  if (!approval) {
    const finalRun = await api('GET', `/api/gateway/run?channel=claude&session=${encodeURIComponent(sessionName)}&waitMs=5000`);
    throw new Error(`Did not intercept in-turn approval for Claude. Run state: ${JSON.stringify(finalRun.data)}`);
  }

  console.log('Intercepted mid-turn approval while run is still running:', JSON.stringify({
    approvalId: approval.id,
    runId: approval.runId,
    inTurn: approval.inTurn,
    mode: approval.mode,
    toolName: approval.toolName,
    runStatusWhileWaiting: activeRunSnapshot?.status,
    waitingApprovalId: activeRunSnapshot?.waitingApprovalId,
  }));

  const approveRes = await api('POST', '/api/gateway/approve', {
    id: approval.id,
    action: 'approve',
  });
  console.log('Approve API response:', JSON.stringify(approveRes.data));

  const waitRes = await api('GET', `/api/gateway/run?channel=claude&session=${encodeURIComponent(sessionName)}&waitMs=60000`);
  const doneRun = waitRes.data?.run;
  const fileExists = fs.existsSync(testFile);
  const fileContent = fileExists ? fs.readFileSync(testFile, 'utf8').trim() : null;
  try { if (fileExists) fs.unlinkSync(testFile); } catch {}

  const sessRes = await api('GET', `/api/sessions/${encodeURIComponent(doneRun?.traceSessionId || '')}?compact=1`);

  const summary = {
    sessionName,
    traceSessionId: doneRun?.traceSessionId,
    initialRunId,
    finalRunId: doneRun?.runId,
    sameTurnCompleted: initialRunId === doneRun?.runId && doneRun?.status === 'completed',
    approvalId: approval.id,
    approvalInTurn: approval.inTurn === true && approval.mode === 'in-turn',
    approveAction: approveRes.data?.action,
    runStatusWhileWaiting: activeRunSnapshot?.status,
    finalStatus: doneRun?.status,
    reply: doneRun?.text,
    fileCreated: fileExists,
    fileContent,
    point: sessRes.data?.point || null,
  };
  console.log('Claude In-Turn Approval Summary:', JSON.stringify(summary, null, 2));
  return summary;
}

async function testCodexMidTurnSteer() {
  const sessionName = `probe-codex-steer-${Date.now().toString().slice(-6)}`;
  console.log(`\n=== [2/3] Testing Codex app-server mid-turn steer (${sessionName}) ===`);

  const startRes = await api('POST', '/api/gateway/send', {
    channel: 'codex',
    sessionName,
    model: 'gpt-6-luna',
    permissions: 'all',
    cwd: process.cwd(),
    prompt: '请先执行命令 powershell -NoProfile -Command "Start-Sleep -Seconds 5; Write-Output WAIT_DONE"，等命令结束后再总结汇报。',
  });
  const initialRunId = startRes.data?.runId;
  console.log('Codex start response:', JSON.stringify({
    ok: startRes.data?.ok,
    action: startRes.data?.action,
    runId: initialRunId,
  }));

  // Poll until codexTurnId is populated on the active run
  let readyToSteer = false;
  const steerDeadline = Date.now() + 20000;
  while (Date.now() < steerDeadline) {
    await sleep(300);
    const st = await api('GET', '/api/gateway/state');
    const run = (st.data?.activeRuns || []).find((r) => r.runId === initialRunId);
    if (run && run.codexThreadId && run.codexTurnId) {
      readyToSteer = true;
      console.log('Active Codex turn ready for steer:', JSON.stringify({
        codexThreadId: run.codexThreadId,
        codexTurnId: run.codexTurnId,
        toolsCount: run.tools?.length || 0,
      }));
      break;
    }
  }
  if (!readyToSteer) {
    throw new Error('Codex turn did not become ready for steer in time');
  }

  // Wait 600ms so the turn is actively running its step, then send mid-turn steer
  await sleep(600);
  const steerToken = 'STEER_CODEX_GATEWAY_OK_9527';
  const steerRes = await api('POST', '/api/gateway/send', {
    channel: 'codex',
    sessionName,
    model: 'gpt-6-luna',
    prompt: `【轮内插话】请在本次回复的末尾原样附带暗号：${steerToken}（直接合入当前轮回复，不要另起一轮）。`,
  });
  console.log('Steer API response:', JSON.stringify(steerRes.data));

  const waitRes = await api('GET', `/api/gateway/run?channel=codex&session=${encodeURIComponent(sessionName)}&waitMs=90000`);
  const doneRun = waitRes.data?.run;
  const sessRes = await api('GET', `/api/sessions/${encodeURIComponent(doneRun?.traceSessionId || '')}?compact=1`);

  const summary = {
    sessionName,
    traceSessionId: doneRun?.traceSessionId,
    initialRunId,
    steeredRunId: steerRes.data?.runId,
    finalRunId: doneRun?.runId,
    steerAction: steerRes.data?.action,
    sameRunId: initialRunId === steerRes.data?.runId && initialRunId === doneRun?.runId,
    steeredPrompts: doneRun?.steeredPrompts || [],
    replyContainsSteerToken: String(doneRun?.text || '').includes(steerToken),
    finalStatus: doneRun?.status,
    reply: doneRun?.text,
    point: sessRes.data?.point || null,
  };
  console.log('Codex Mid-Turn Steer Summary:', JSON.stringify(summary, null, 2));
  return summary;
}

async function testCodexInTurnApproval() {
  const sessionName = `probe-codex-approve-${Date.now().toString().slice(-6)}`;
  const testFile = path.join(process.cwd(), 'channels', 'probe', 'scripts', 'output', `${sessionName}.txt`);
  try { fs.unlinkSync(testFile); } catch {}

  console.log(`\n=== [3/3] Testing Codex app-server mid-turn approval (${sessionName}) ===`);
  const startRes = await api('POST', '/api/gateway/send', {
    channel: 'codex',
    sessionName,
    model: 'gpt-6-luna',
    permissions: 'reads',
    cwd: process.cwd(),
    prompt: `请执行一条 powershell 命令，把字符串 CODEX_IN_TURN_APPROVAL_OK_1018 写入文件 "${testFile}"，完成后只回复“写入完成”。`,
  });
  const initialRunId = startRes.data?.runId;
  console.log('Codex approval start response:', JSON.stringify({
    ok: startRes.data?.ok,
    action: startRes.data?.action,
    runId: initialRunId,
  }));

  let approval = null;
  let activeRunSnapshot = null;
  const deadline = Date.now() + 45000;
  while (Date.now() < deadline) {
    await sleep(500);
    const st = await api('GET', '/api/gateway/state');
    const pending = (st.data?.pendingApprovals || []).find(
      (a) => a.sessionName === sessionName && a.status === 'pending',
    );
    const run = (st.data?.activeRuns || []).find((r) => r.runId === initialRunId);
    if (pending) {
      approval = pending;
      activeRunSnapshot = run;
      break;
    }
    if (!run) {
      console.log('Codex run finished before approval appeared!');
      break;
    }
  }

  if (!approval) {
    const finalRun = await api('GET', `/api/gateway/run?channel=codex&session=${encodeURIComponent(sessionName)}&waitMs=5000`);
    throw new Error(`Did not intercept in-turn approval for Codex. Run state: ${JSON.stringify(finalRun.data)}`);
  }

  console.log('Intercepted Codex mid-turn approval while run is still running:', JSON.stringify({
    approvalId: approval.id,
    runId: approval.runId,
    inTurn: approval.inTurn,
    mode: approval.mode,
    toolName: approval.toolName,
    runStatusWhileWaiting: activeRunSnapshot?.status,
    waitingApprovalId: activeRunSnapshot?.waitingApprovalId,
  }));

  const approveRes = await api('POST', '/api/gateway/approve', {
    id: approval.id,
    action: 'approve',
  });
  console.log('Codex Approve API response:', JSON.stringify(approveRes.data));

  const waitRes = await api('GET', `/api/gateway/run?channel=codex&session=${encodeURIComponent(sessionName)}&waitMs=90000`);
  const doneRun = waitRes.data?.run;
  const fileExists = fs.existsSync(testFile);
  const fileContent = fileExists ? fs.readFileSync(testFile, 'utf8').trim() : null;
  try { if (fileExists) fs.unlinkSync(testFile); } catch {}

  const summary = {
    sessionName,
    traceSessionId: doneRun?.traceSessionId,
    initialRunId,
    finalRunId: doneRun?.runId,
    sameTurnCompleted: initialRunId === doneRun?.runId && doneRun?.status === 'completed',
    approvalId: approval.id,
    approvalInTurn: approval.inTurn === true && approval.mode === 'in-turn',
    approveAction: approveRes.data?.action,
    runStatusWhileWaiting: activeRunSnapshot?.status,
    finalStatus: doneRun?.status,
    reply: doneRun?.text,
    fileCreated: fileExists,
    fileContent,
  };
  console.log('Codex In-Turn Approval Summary:', JSON.stringify(summary, null, 2));
  return summary;
}

async function main() {
  const out = {};
  out.claudeApproval = await testClaudeInTurnApproval();
  out.codexSteer = await testCodexMidTurnSteer();
  out.codexApproval = await testCodexInTurnApproval();

  const outFile = path.join(process.cwd(), 'channels', 'probe', 'scripts', 'output', 'gateway_resident_drivers_20261018.json');
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, JSON.stringify(out, null, 2), 'utf8');
  console.log(`\nSaved full verification report to ${outFile}`);
}

main().catch((err) => {
  console.error('Verification failed:', err);
  process.exit(1);
});
