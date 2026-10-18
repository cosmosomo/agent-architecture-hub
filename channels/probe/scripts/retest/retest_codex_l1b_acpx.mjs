import { spawn, spawnSync } from 'node:child_process';
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

function runCmd(cmd, timeoutMs = 60000) {
  const res = spawnSync(cmd, {
    cwd: CWD,
    env: ENV,
    shell: true,
    timeout: timeoutMs,
    encoding: 'utf8',
  });
  return {
    code: res.status,
    stdout: res.stdout || '',
    stderr: res.stderr || '',
  };
}

function findRolloutLines(sessionId, pattern) {
  const sessionsDir = path.join(process.env.USERPROFILE, '.codex', 'sessions');
  const files = [];
  function walk(dir) {
    if (!fs.existsSync(dir)) return;
    for (const f of fs.readdirSync(dir)) {
      const full = path.join(dir, f);
      if (fs.statSync(full).isDirectory()) walk(full);
      else if (f.includes(sessionId)) files.push(full);
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

function getAcpxSessionUuid(sessionName) {
  const sessionsFile = path.join(process.env.USERPROFILE, '.acpx', 'sessions', 'codex.json');
  if (fs.existsSync(sessionsFile)) {
    try {
      const j = JSON.parse(fs.readFileSync(sessionsFile, 'utf8'));
      if (j[sessionName]?.sessionId) return j[sessionName].sessionId;
      for (const k of Object.keys(j)) {
        if (j[k]?.name === sessionName) return j[k].sessionId;
      }
    } catch {}
  }
  return null;
}

async function main() {
  console.log('=== Retesting codex/L1b/acpx (model-new, model-switch, cancel) ===');
  const results = {};

  // -------------------------------------------------------------
  // Test 1: model-new & model-switch
  // -------------------------------------------------------------
  const sessionName = `probe-codex-l1b-mtest-${Date.now()}`;
  console.log('1. Creating session:', sessionName);
  const newRes = runCmd(`acpx codex sessions new --name ${sessionName}`);
  console.log('sessions new output:', newRes.stdout.trim() || newRes.stderr.trim());

  // Prompt 1
  console.log('Running Prompt 1...');
  const p1Res = runCmd(`acpx codex -s ${sessionName} "Reply with: MNEW_OK"`);
  console.log('p1Res code:', p1Res.code, 'out:', p1Res.stdout.trim());

  let sessionUuid = getAcpxSessionUuid(sessionName);
  console.log('Found acpx session UUID:', sessionUuid);

  // If not found in .acpx, search status
  if (!sessionUuid) {
    const statusRes = runCmd(`acpx codex status -s ${sessionName}`);
    const m = statusRes.stdout.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
    if (m) sessionUuid = m[1];
  }
  console.log('Resolved session UUID:', sessionUuid);

  // Find rollout file for Prompt 1
  const rolloutContexts = sessionUuid ? findRolloutLines(sessionUuid, 'turn_context') : [];
  console.log('Found rollout turn_contexts count:', rolloutContexts.length);

  let p1Model = null;
  if (rolloutContexts[0]) {
    try {
      p1Model = JSON.parse(rolloutContexts[0]).payload?.model;
    } catch {}
  }
  console.log('Prompt 1 actual runtime model:', p1Model);

  results['model-new'] = {
    pass: !!p1Model,
    sessionName,
    sessionUuid,
    p1ExitCode: p1Res.code,
    p1Stdout: p1Res.stdout.trim(),
    actualModel: p1Model,
    rawTurnContext: rolloutContexts[0] || null,
  };

  // Model-switch: switch to gpt-5.6-sol (or gpt-6.1-sol)
  console.log('\n2. Testing model-switch on session:', sessionName);
  const targetModel = p1Model === 'gpt-6.1-sol' ? 'gpt-5.6-sol' : 'gpt-6.1-sol';
  console.log('Setting model to:', targetModel);
  const setRes = runCmd(`acpx codex set -s ${sessionName} model ${targetModel}`);
  console.log('acpx set output:', setRes.stdout.trim());

  console.log('Running Prompt 2 after model switch...');
  const p2Res = runCmd(`acpx codex -s ${sessionName} "Reply with: MSWITCH_OK"`);
  console.log('p2Res code:', p2Res.code, 'out:', p2Res.stdout.trim());

  const rolloutContextsAfter = sessionUuid ? findRolloutLines(sessionUuid, 'turn_context') : [];
  console.log('Found rollout turn_contexts count after switch:', rolloutContextsAfter.length);

  let p2Model = null;
  if (rolloutContextsAfter[1]) {
    try {
      p2Model = JSON.parse(rolloutContextsAfter[1]).payload?.model;
    } catch {}
  }
  console.log('Prompt 2 actual runtime model:', p2Model);

  results['model-switch'] = {
    pass: p2Model === targetModel && p2Model !== p1Model,
    sessionName,
    sessionUuid,
    setCmdOutput: setRes.stdout.trim(),
    targetModel,
    p1Model,
    p2Model,
    p2Stdout: p2Res.stdout.trim(),
    rawTurn1Context: rolloutContextsAfter[0] || null,
    rawTurn2Context: rolloutContextsAfter[1] || null,
  };

  // Close session
  runCmd(`acpx codex sessions close ${sessionName}`);

  // -------------------------------------------------------------
  // Test 3: cancel
  // -------------------------------------------------------------
  const cancelSessionName = `probe-codex-l1b-cancel-${Date.now()}`;
  console.log('\n3. Testing cancel on session:', cancelSessionName);
  runCmd(`acpx codex sessions new --name ${cancelSessionName}`);

  console.log('Spawning long prompt in background...');
  const longPromptCp = spawn('acpx', ['codex', '-s', cancelSessionName, 'Write a 1000-word comprehensive history of space exploration from Sputnik to the ISS.'], {
    cwd: CWD,
    env: ENV,
    shell: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let longStdout = '';
  let longStderr = '';
  longPromptCp.stdout.on('data', (d) => longStdout += d.toString());
  longPromptCp.stderr.on('data', (d) => longStderr += d.toString());

  // Wait 2.5 seconds then call cancel via acpx CLI
  await new Promise((r) => setTimeout(r, 2500));
  console.log('Calling acpx codex cancel...');
  const cancelRes = runCmd(`acpx codex cancel -s ${cancelSessionName}`);
  console.log('cancel CLI output:', cancelRes.stdout.trim());

  // Wait for the long prompt process to finish
  const longProcessEnd = await new Promise((resolve) => {
    const timer = setTimeout(() => {
      longPromptCp.kill();
      resolve({ timedOut: true, code: -1 });
    }, 25000);
    longPromptCp.on('close', (code) => {
      clearTimeout(timer);
      resolve({ timedOut: false, code });
    });
  });
  console.log('Interrupted prompt process closed with code:', longProcessEnd.code, 'timedOut:', longProcessEnd.timedOut);
  console.log('Interrupted stdout sample:', longStdout.slice(0, 150));
  console.log('Interrupted stderr sample:', longStderr.slice(0, 150));

  // Verify session can accept recovery prompt
  console.log('Testing recovery prompt...');
  const recoveryRes = runCmd(`acpx codex -s ${cancelSessionName} "Reply with: CANCEL_RECOVERED_OK"`, 45000);
  console.log('Recovery prompt code:', recoveryRes.code, 'out:', recoveryRes.stdout.trim());

  results['cancel'] = {
    pass: recoveryRes.stdout.includes('CANCEL_RECOVERED_OK'),
    cancelCmdOutput: cancelRes.stdout.trim(),
    interruptedProcessExitCode: longProcessEnd.code,
    interruptedStdout: longStdout.trim(),
    interruptedStderr: longStderr.trim(),
    recoveryStdout: recoveryRes.stdout.trim(),
    recoveryExitCode: recoveryRes.code,
  };

  runCmd(`acpx codex sessions close ${cancelSessionName}`);

  fs.writeFileSync(path.join(OUT_DIR, 'codex_l1b_results.json'), JSON.stringify(results, null, 2));
  console.log('\nAll Codex L1b results saved to codex_l1b_results.json');
}

main().catch(console.error);
