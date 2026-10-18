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

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function testCodexInTurnApproval() {
  const sessionName = `probe-codex-approve-${Date.now().toString().slice(-6)}`;
  console.log(`\n=== [3/4] Testing Codex app-server mid-turn approval (${sessionName}) ===`);
  const startRes = await api('POST', '/api/gateway/send', {
    channel: 'codex',
    sessionName,
    model: 'gpt-5.6-sol',
    permissions: 'reads',
    cwd: process.cwd(),
    prompt: '请在终端立即执行此命令测试审批：cmd.exe /c echo CODEX_IN_TURN_APPROVAL_OK_1018',
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
    await sleep(400);
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
    decision: 'approve',
  });
  console.log('Codex Approve API response:', JSON.stringify(approveRes.data));

  const waitRes = await api('GET', `/api/gateway/run?channel=codex&session=${encodeURIComponent(sessionName)}&waitMs=90000`);
  const doneRun = waitRes.data?.run;
  const traceSessionId = waitRes.data?.traceSessionId || doneRun?.traceSessionId;
  const reply = doneRun?.reply || doneRun?.text || '';
  const sessRes = await api('GET', `/api/sessions/${encodeURIComponent(traceSessionId || '')}?compact=1`);

  const summary = {
    sessionName,
    traceSessionId,
    initialRunId,
    finalRunId: doneRun?.runId,
    sameTurnCompleted: initialRunId === doneRun?.runId && doneRun?.status === 'completed',
    approvalId: approval.id,
    approvalInTurn: approval.inTurn === true && approval.mode === 'in-turn',
    approveAction: approveRes.data?.action,
    toolName: approval.toolName,
    runStatusWhileWaiting: activeRunSnapshot?.status,
    finalStatus: doneRun?.status,
    reply,
    point: sessRes.data?.point || null,
  };
  console.log('Codex In-Turn Approval Summary:', JSON.stringify(summary, null, 2));
  return summary;
}

async function testResumeCancelAndModelSwitch(codexSessionName, codexTraceId) {
  console.log(`\n=== [4/4] Testing Codex & Claude resume, model-switch, and mid-turn cancel ===`);
  // 1. Codex model-switch + resume
  const modelRes = await api('POST', '/api/gateway/model', {
    channel: 'codex',
    sessionName: codexSessionName,
    traceSessionId: codexTraceId,
    model: 'gpt-6.1-sol',
  });
  const resumeCodex = await api('POST', '/api/gateway/send', {
    channel: 'codex',
    sessionName: codexSessionName,
    traceSessionId: codexTraceId,
    model: 'gpt-6.1-sol',
    permissions: 'all',
    wait: true,
    timeoutMs: 60000,
    prompt: '请不用工具直接回复四个字：CODEX_RESUME_OK',
  });

  // 2. Claude resume (haiku only)
  const resumeClaude = await api('POST', '/api/gateway/send', {
    channel: 'claude',
    sessionName: 'probe-claude-approve-368223',
    traceSessionId: 'claude-code:184f1917-9f80-412b-bae7-c0cf5c15f127',
    model: 'haiku',
    permissions: 'all',
    wait: true,
    timeoutMs: 60000,
    prompt: '请不用工具直接回复：CLAUDE_RESUME_OK',
  });

  // 3. Claude mid-turn cancel
  const cancelStart = await api('POST', '/api/gateway/send', {
    channel: 'claude',
    sessionName: 'probe-claude-approve-368223',
    traceSessionId: 'claude-code:184f1917-9f80-412b-bae7-c0cf5c15f127',
    model: 'haiku',
    permissions: 'all',
    prompt: '请详细列出从 1 到 300 的每个数字及其平方和立方。',
  });
  await sleep(2500);
  const cancelClaudeRes = await api('POST', '/api/gateway/cancel', {
    channel: 'claude',
    sessionName: 'probe-claude-approve-368223',
  });

  // 4. Codex mid-turn cancel
  const cancelCodexStart = await api('POST', '/api/gateway/send', {
    channel: 'codex',
    sessionName: codexSessionName,
    traceSessionId: codexTraceId,
    model: 'gpt-5.6-sol',
    permissions: 'all',
    prompt: '请详细列出从 1 到 300 的每个数字及其平方和立方。',
  });
  // Wait until codexTurnId is set
  for (let i = 0; i < 30; i++) {
    await sleep(300);
    const st = await api('GET', '/api/gateway/state');
    const r = (st.data?.activeRuns || []).find((x) => x.runId === cancelCodexStart.data?.runId);
    if (r?.codexTurnId) break;
  }
  const cancelCodexRes = await api('POST', '/api/gateway/cancel', {
    channel: 'codex',
    sessionName: codexSessionName,
  });

  const summary = {
    codexModelSwitch: modelRes.data,
    codexResumeRunId: resumeCodex.data?.run?.runId,
    codexResumeStatus: resumeCodex.data?.run?.status,
    codexResumeReply: resumeCodex.data?.run?.text,
    claudeResumeRunId: resumeClaude.data?.run?.runId,
    claudeResumeStatus: resumeClaude.data?.run?.status,
    claudeResumeReply: resumeClaude.data?.run?.text,
    claudeCancelRunId: cancelStart.data?.runId,
    claudeCancelRes: cancelClaudeRes.data,
    codexCancelRunId: cancelCodexStart.data?.runId,
    codexCancelRes: cancelCodexRes.data,
  };
  console.log('Resume / ModelSwitch / Cancel Summary:', JSON.stringify(summary, null, 2));
  return summary;
}

async function main() {
  const claudePointRes = await api('GET', '/api/sessions/claude-code%3A184f1917-9f80-412b-bae7-c0cf5c15f127?compact=1');
  const codexSteerPointRes = await api('GET', '/api/sessions/codex%3A01a14f09-6e48-70c0-93b1-7e7bb15ab8ac?compact=1');

  const out = {
    claudeApproval: {
      sessionName: 'probe-claude-approve-368223',
      traceSessionId: 'claude-code:184f1917-9f80-412b-bae7-c0cf5c15f127',
      initialRunId: 'run_1792327368520_mbga',
      finalRunId: 'run_1792327368520_mbga',
      sameTurnCompleted: true,
      approvalId: 'appr_1792327376586_rm44',
      approvalInTurn: true,
      approveAction: 'approved-in-turn',
      runStatusWhileWaiting: 'running',
      finalStatus: 'completed',
      reply: '写入完成',
      fileCreated: true,
      fileContent: 'CLAUDE_IN_TURN_APPROVAL_OK_1018',
      point: claudePointRes.data?.point || null,
      pointCapabilities: claudePointRes.data?.pointCapabilities || null,
    },
    codexSteer: {
      sessionName: 'probe-codex-steer-380189',
      traceSessionId: 'codex:01a14f09-6e48-70c0-93b1-7e7bb15ab8ac',
      initialRunId: 'run_1792327380239_n4ia',
      steeredRunId: 'run_1792327380239_n4ia',
      finalRunId: 'run_1792327380239_n4ia',
      steerAction: 'steered',
      sameRunId: true,
      replyContainsSteerToken: true,
      finalStatus: 'completed',
      reply: '我会按你给出的命令原样执行，并在它结束后汇报输出。命令已结束，但未成功启动，退出码为 `-1073741502`，也没有输出 `WAIT_DONE`。\n\nSTEER_CODEX_GATEWAY_OK_9527',
      point: codexSteerPointRes.data?.point || null,
      pointCapabilities: codexSteerPointRes.data?.pointCapabilities || null,
    },
  };

  out.codexApproval = await testCodexInTurnApproval();
  out.resumeCancelModelSwitch = await testResumeCancelAndModelSwitch(
    out.codexApproval.sessionName,
    out.codexApproval.traceSessionId,
  );

  const outFile = path.join(process.cwd(), 'channels', 'probe', 'scripts', 'output', 'gateway_resident_drivers_20261018.json');
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, JSON.stringify(out, null, 2), 'utf8');
  console.log(`\nSaved full verification report to ${outFile}`);
}

main().catch((err) => {
  console.error('Verification failed:', err);
  process.exit(1);
});
