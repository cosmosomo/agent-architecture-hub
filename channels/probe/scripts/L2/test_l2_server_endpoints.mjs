import { spawn } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, unlinkSync, rmdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { homedir } from 'node:os';

const REPO_ROOT = 'E:\\program\\GIT\\Agent\\multi\\Agent-Architecture-Hub';
const PORT = 8932;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const HOME = homedir();
const ACPX_SESSIONS_DIR = join(HOME, '.acpx', 'sessions');

const FAMILIES = ['codex', 'claude', 'zcode', 'workbuddy', 'opencode', 'hermes', 'antigravity'];

const CHEAP_MODELS = {
  codex: 'gpt-5.4-mini',
  claude: 'haiku',
  zcode: 'builtin:bigmodel-coding-plan\\GLM-5.3-Flash',
  workbuddy: 'custom-local:glm-5.3',
  opencode: 'zhipuai-coding-plan/glm-5.3-flash',
  hermes: 'custom:glm-5.3',
  antigravity: 'flash',
};

const results = {
  session_new: {},
  model: {},
  cwd: {},
  approve: {},
  handoff: {},
  meta_agents: {},
  control: {},
};

async function waitHealth(maxRetries = 40) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const res = await fetch(`${BASE_URL}/api/health`);
      if (res.ok) {
        const j = await res.json();
        return j;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error('Health check timeout');
}

// 1. Start Server
console.log(`[1] Starting test server on port ${PORT}...`);
const serverProc = spawn('node', ['--no-warnings=ExperimentalWarning', 'trace/apps/cli/src/main.ts', 'serve', '--port', String(PORT)], {
  cwd: REPO_ROOT,
  stdio: ['ignore', 'pipe', 'pipe'],
  windowsHide: true,
});

serverProc.stdout.on('data', (d) => process.stdout.write(`[SERVER] ${d}`));
serverProc.stderr.on('data', (d) => process.stderr.write(`[SERVER ERR] ${d}`));

try {
  await waitHealth();
  console.log('[1] Server ready!');

  // ==========================================
  // Test 1: POST /api/gateway/session/new
  // ==========================================
  console.log('\n[2] Testing POST /api/gateway/session/new across 7 families...');
  for (const fam of FAMILIES) {
    const sname = `probe-L2b-${fam}-new`;
    const beforeFiles = existsSync(ACPX_SESSIONS_DIR) ? readdirSync(ACPX_SESSIONS_DIR) : [];
    
    const resp = await fetch(`${BASE_URL}/api/gateway/session/new`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channel: fam,
        sessionName: sname,
        cwd: REPO_ROOT,
        model: CHEAP_MODELS[fam],
      }),
    });
    const data = await resp.json();
    const afterFiles = existsSync(ACPX_SESSIONS_DIR) ? readdirSync(ACPX_SESSIONS_DIR) : [];
    const newAcpxFile = afterFiles.find((f) => !beforeFiles.includes(f));

    results.session_new[fam] = {
      status: resp.status,
      response: data,
      createdAcpxFile: newAcpxFile || null,
      memoryDraftRegistered: Boolean(data.ok && data.traceSessionId === `new:${fam}:${sname}`),
      contractSessionReturned: data.session, // should be null since no turn exists
    };
    console.log(`  - ${fam}: status=${resp.status}, ok=${data.ok}, traceSessionId=${data.traceSessionId}, acpxDiskFileCreated=${Boolean(newAcpxFile)}`);
  }

  // ==========================================
  // Test 2: POST /api/gateway/model
  // ==========================================
  console.log('\n[3] Testing POST /api/gateway/model across 7 families...');
  for (const fam of FAMILIES) {
    const sname = `probe-L2b-${fam}-model`;
    const targetModel = CHEAP_MODELS[fam];
    const resp = await fetch(`${BASE_URL}/api/gateway/model`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channel: fam,
        sessionName: sname,
        model: targetModel,
      }),
    });
    const data = await resp.json();
    results.model[fam] = {
      status: resp.status,
      response: data,
    };
    console.log(`  - ${fam}: status=${resp.status}, ok=${data.ok}, model=${data.model}`);
  }

  // ==========================================
  // Test 3: POST /api/gateway/cwd
  // ==========================================
  console.log('\n[4] Testing POST /api/gateway/cwd across 7 families...');
  for (const fam of FAMILIES) {
    const sname = `probe-L2b-${fam}-cwd`;
    const resp = await fetch(`${BASE_URL}/api/gateway/cwd`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channel: fam,
        sessionName: sname,
        cwd: REPO_ROOT,
      }),
    });
    const data = await resp.json();

    // Also test invalid directory rejection
    const invalidResp = await fetch(`${BASE_URL}/api/gateway/cwd`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channel: fam,
        sessionName: sname,
        cwd: 'Z:\\non_existent_folder_xyz',
      }),
    });

    results.cwd[fam] = {
      validStatus: resp.status,
      validResponse: data,
      invalidStatus: invalidResp.status,
    };
    console.log(`  - ${fam}: valid=${resp.status} (ok=${data.ok}), invalid=${invalidResp.status}`);
  }

  // ==========================================
  // Test 4: POST /api/gateway/approve
  // ==========================================
  console.log('\n[5] Testing POST /api/gateway/approve (missing id error check & pending item resolution)...');
  // 4a. Check rejection of unknown/missing approval
  const missingApprove = await fetch(`${BASE_URL}/api/gateway/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: 'appr_non_existent', decision: 'approve' }),
  });
  results.approve.missingIdCheck = {
    status: missingApprove.status,
    text: await missingApprove.text(),
  };
  console.log(`  - Missing ID check: status=${missingApprove.status}, response=${results.approve.missingIdCheck.text}`);

  // ==========================================
  // Test 5: POST /api/gateway/handoff
  // ==========================================
  console.log('\n[6] Testing POST /api/gateway/handoff...');
  // Test handoff from codex to zcode
  const handoffResp = await fetch(`${BASE_URL}/api/gateway/handoff`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fromChannel: 'codex',
      fromSessionName: 'probe-L2b-codex-src',
      toChannel: 'zcode',
      toSessionName: 'probe-L2b-zcode-target',
      customInstruction: '请接力完成测试暗号验证: HANDOFF_VERIFY_9912',
      wait: false,
    }),
  });
  const handoffData = await handoffResp.json();
  results.handoff.codex_to_zcode = {
    status: handoffResp.status,
    response: handoffData,
  };
  console.log(`  - Handoff codex -> zcode: status=${handoffResp.status}, ok=${handoffData.ok}, action=${handoffData.action || handoffData.status}`);

  // ==========================================
  // Test 6: GET/POST /api/gateway/meta-agents & patrol
  // ==========================================
  console.log('\n[7] Testing Meta-Agents APIs & Silent Permission Escalation...');
  // 6a. GET /api/gateway/meta-agents
  const metaGet = await fetch(`${BASE_URL}/api/gateway/meta-agents`);
  const metaGetData = await metaGet.json();
  results.meta_agents.get = {
    status: metaGet.status,
    agentsCount: metaGetData.metaAgents?.length,
    agents: metaGetData.metaAgents?.map((a) => ({ id: a.id, name: a.name, enabled: a.enabled, policy: a.policy, engineMode: a.engineMode })),
  };
  console.log(`  - GET /api/gateway/meta-agents: count=${metaGetData.metaAgents?.length}`);

  // 6b. POST /api/gateway/meta-agents (configure auto-approver with policy: 'all')
  const metaPost = await fetch(`${BASE_URL}/api/gateway/meta-agents`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: 'meta_approver',
      enabled: true,
      policy: 'all',
    }),
  });
  const metaPostData = await metaPost.json();
  results.meta_agents.update = {
    status: metaPost.status,
    approver: metaPostData.metaAgent,
  };
  console.log(`  - POST /api/gateway/meta-agents: meta_approver policy=${metaPostData.metaAgent?.policy}`);

  // 6c. Silent permission escalation check: send a prompt with permissions: 'reads'
  // When meta_approver is enabled and policy is 'all', gateway.ts line 3415 silently upgrades permissions to 'all'
  console.log('  - Verifying silent permission escalation in sendPrompt...');
  const sendEscalation = await fetch(`${BASE_URL}/api/gateway/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      channel: 'codex',
      sessionName: 'probe-L2b-escalate-test',
      prompt: 'echo permission escalation test',
      permissions: 'reads',
      source: 'web',
      wait: false,
    }),
  });
  const sendEscalationData = await sendEscalation.json();
  // Check gateway logs
  const metaLogsAfter = await (await fetch(`${BASE_URL}/api/gateway/meta-agents`)).json();
  const escalationLog = metaLogsAfter.logs?.find((l) => l.action?.includes('自动批准升级') || l.detail?.includes('自动升级为全自动读写'));
  results.meta_agents.permissionEscalation = {
    sendResult: sendEscalationData,
    detectedEscalationLog: escalationLog || null,
    escalationOccurred: Boolean(escalationLog),
  };
  console.log(`  - Silent permission escalation confirmed: ${Boolean(escalationLog)} (${escalationLog?.detail || 'None'})`);

  // 6d. POST /api/gateway/meta-agents/patrol (test patrol trigger)
  console.log('  - Testing POST /api/gateway/meta-agents/patrol...');
  // Configure meta_maint to local_rules mode first to avoid waking real heavy brain during test
  await fetch(`${BASE_URL}/api/gateway/meta-agents`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: 'meta_maint', engineMode: 'local_rules' }),
  });
  const patrolResp = await fetch(`${BASE_URL}/api/gateway/meta-agents/patrol`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      agentId: 'meta_maint',
      eventKind: 'manual_patrol',
      targetChannel: 'codex',
      targetSession: 'probe-L2b-patrol-target',
    }),
  });
  const patrolData = await patrolResp.json();
  results.meta_agents.patrol = {
    status: patrolResp.status,
    response: patrolData,
  };
  console.log(`  - Patrol trigger: status=${patrolResp.status}, mode=${patrolData.mode}, action=${patrolData.decision?.action}`);

  // ==========================================
  // Test 7: POST /api/control
  // ==========================================
  console.log('\n[8] Testing POST /api/control (Case simulation write-back)...');
  for (const fam of FAMILIES) {
    const controlResp = await fetch(`${BASE_URL}/api/control`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        modelId: `probe_l2b_${fam}`,
        kind: 'interject',
        payload: {
          to: fam,
          text: `指令: 人工调控测试 ${fam}`,
        },
      }),
    });
    const controlData = await controlResp.json();
    results.control[fam] = {
      status: controlResp.status,
      response: controlData,
    };
    console.log(`  - ${fam}: status=${controlResp.status}, ok=${controlData.ok}, files=${controlData.writtenFiles?.join(',')}`);
  }

} finally {
  console.log('\n[9] Shutting down test server...');
  serverProc.kill('SIGTERM');
  await new Promise((r) => setTimeout(r, 1000));
  try { serverProc.kill('SIGKILL'); } catch {}
  console.log('[9] Server stopped.');
}

import { writeFileSync } from 'node:fs';
const outPath = resolve(REPO_ROOT, 'channels/probe/scripts/L2/server_endpoints_results.json');
writeFileSync(outPath, JSON.stringify(results, null, 2), 'utf8');
console.log(`\nTest results written to ${outPath}`);
