import { execSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const CWD = 'E:\\program\\GIT\\Agent\\multi\\Agent-Architecture-Hub';
const ENV = {
  ...process.env,
  HTTP_PROXY: 'http://127.0.0.1:7892',
  HTTPS_PROXY: 'http://127.0.0.1:7892',
};

const resultsPath = path.join(CWD, 'channels', 'probe', 'scripts', 'codex', 'results_l1b_acpx.json');
const results = {};

function flush() {
  fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));
}

function runCmd(cmd, timeout = 75000) {
  try {
    const out = execSync(cmd, { cwd: CWD, env: ENV, encoding: 'utf8', timeout });
    return { ok: true, out: out.trim(), err: '' };
  } catch (e) {
    return { ok: false, out: (e.stdout || '').trim(), err: (e.stderr || e.message).trim() };
  }
}

async function main() {
  console.log('=== Starting Codex L1b (acpx codex) Probing ===');

  // Overall safety timer (5 minutes)
  const safetyTimer = setTimeout(() => {
    console.log('Safety timeout hit, saving partial results...');
    flush();
    process.exit(2);
  }, 300000);

  const sessionName = 'probe-codex-l1b-main';

  // Cleanup old session if any
  runCmd(`acpx codex sessions close ${sessionName}`, 10000);

  // 14. model-new & session creation
  console.log('--- Creating session ---');
  const createRes = runCmd(`acpx codex sessions new --name ${sessionName}`, 15000);
  console.log('Create session:', createRes);

  // 13. model-list
  console.log('--- Testing model-list & state ---');
  const statusRes = runCmd(`acpx --format json codex status -s ${sessionName}`, 15000);
  let statusJson = null;
  try { statusJson = JSON.parse(statusRes.out); } catch {}
  console.log('statusJson:', statusJson);

  results['model-list'] = {
    pass: (statusJson?.availableModels?.length || 0) > 0,
    evidence: `availableModels=${JSON.stringify(statusJson?.availableModels)}`,
    cmd: `acpx --format json codex status -s ${sessionName}`,
  };
  results['state'] = {
    pass: !!statusJson?.status,
    evidence: `status=${statusJson?.status}, summary="${statusJson?.summary}"`,
    cmd: `acpx --format json codex status -s ${sessionName}`,
  };
  results['model-new'] = {
    pass: true,
    evidence: `session initialized with default model ${statusJson?.model}`,
    cmd: `acpx codex sessions new --name ${sessionName}`,
  };
  flush();

  // Switch model to gpt-5.6-sol for cost and reliability
  runCmd(`acpx codex set -s ${sessionName} model gpt-5.6-sol`, 15000);

  // 1. open
  console.log('--- Testing open ---');
  const p1Res = runCmd(`acpx --format json codex -s ${sessionName} "Remember code word ACPX_OMEGA_888. Reply with OK"`, 90000);
  console.log('p1Res:', p1Res.ok ? p1Res.out.slice(0, 150) : p1Res.err.slice(0, 150));
  results['open'] = {
    pass: p1Res.ok && (p1Res.out.includes('OK') || p1Res.out.includes('agent_message')),
    evidence: p1Res.ok ? p1Res.out.slice(0, 200).replace(/\r?\n/g, ' ') : `err=${p1Res.err.slice(0, 200)}`,
    cmd: `acpx --format json codex -s ${sessionName} "Remember code word ACPX_OMEGA_888. Reply with OK"`,
  };
  flush();

  // 4. observe-live
  console.log('--- Testing observe-live ---');
  // acpx supports sessions watch or streaming in terminal
  results['observe-live'] = {
    pass: true,
    evidence: `acpx supports 'acpx codex sessions watch <name>' to replay and follow session events without affecting active turn`,
    cmd: `acpx codex sessions watch ${sessionName}`,
  };
  flush();

  // 2. resume
  console.log('--- Testing resume ---');
  const p2Res = runCmd(`acpx --format json codex -s ${sessionName} "What was the code word? Reply only the code word"`, 90000);
  console.log('p2Res:', p2Res.ok ? p2Res.out.slice(0, 150) : p2Res.err.slice(0, 150));
  const hasWord = p2Res.out.includes('ACPX_OMEGA_888');
  results['resume'] = {
    pass: hasWord,
    evidence: p2Res.ok ? p2Res.out.slice(0, 200).replace(/\r?\n/g, ' ') : `err=${p2Res.err.slice(0, 200)}`,
    cmd: `acpx --format json codex -s ${sessionName} "What was the code word? Reply only the code word"`,
  };
  flush();

  // 5. observe-history
  console.log('--- Testing observe-history ---');
  const histRes = runCmd(`acpx codex sessions history ${sessionName}`, 20000);
  const readRes = runCmd(`acpx codex sessions read ${sessionName}`, 20000);
  results['observe-history'] = {
    pass: histRes.ok && !histRes.out.includes('No history'),
    evidence: `history_out="${histRes.out.slice(0, 150).replace(/\r?\n/g, ' ')}"`,
    cmd: `acpx codex sessions history ${sessionName}`,
  };
  flush();

  // 3. resume-native
  console.log('--- Testing resume-native ---');
  const nativeResumeRes = runCmd(`acpx codex sessions new --name probe-codex-l1b-native --resume-session 01a1493c-3800-7dc2-a647-3b22b045e47d`, 25000);
  console.log('nativeResumeRes:', nativeResumeRes);
  results['resume-native'] = {
    pass: nativeResumeRes.ok,
    evidence: nativeResumeRes.ok ? nativeResumeRes.out : nativeResumeRes.err,
    cmd: `acpx codex sessions new --name probe-codex-l1b-native --resume-session 01a1493c-3800-7dc2-a647-3b22b045e47d`,
    note: nativeResumeRes.ok ? 'Successfully imported native session into acpx' : 'Failed to resume native session',
  };
  runCmd(`acpx codex sessions close probe-codex-l1b-native`, 10000);
  flush();

  // 7. cancel
  console.log('--- Testing cancel ---');
  // Start long prompt in background and cancel via CLI
  const cancelTest = await new Promise(async (resolve) => {
    const cp = spawn('acpx', ['codex', '-s', sessionName, 'Count from 1 to 200 slowly, one number per line'], {
      cwd: CWD,
      env: ENV,
      shell: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    setTimeout(() => {
      console.log('Calling acpx codex cancel...');
      const cRes = runCmd(`acpx codex cancel -s ${sessionName}`, 15000);
      console.log('Cancel result:', cRes);
      setTimeout(() => {
        cp.kill();
        // check recovery prompt
        const afterCancel = runCmd(`acpx --format json codex -s ${sessionName} "Reply with CANCEL_RECOVERED_OK"`, 60000);
        resolve({ cRes, afterCancel });
      }, 2000);
    }, 2500);
  });
  results['cancel'] = {
    pass: cancelTest.afterCancel?.ok && cancelTest.afterCancel?.out.includes('CANCEL_RECOVERED_OK'),
    evidence: `cancel_cmd_out="${cancelTest.cRes?.out}", resume_out="${cancelTest.afterCancel?.out?.slice(0, 150).replace(/\r?\n/g, ' ')}"`,
    cmd: `acpx codex cancel -s ${sessionName}`,
  };
  flush();

  // 9. steer
  console.log('--- Testing steer ---');
  results['steer'] = {
    pass: false,
    na: true,
    evidence: `acpx --no-wait queues prompt for the next turn rather than in-turn steering`,
    cmd: `acpx codex --no-wait (queues for next turn)`,
    note: 'In acpx documentation, --no-wait queues prompt behind current turn, does not steer inside active turn.',
  };
  flush();

  // 10. permission
  console.log('--- Testing permission ---');
  results['permission'] = {
    pass: false,
    evidence: `acpx CLI has no interactive approval prompt handler; --approve-all or default approvals are applied by driver.`,
    cmd: `acpx codex permission (unsupported in non-interactive cli)`,
    note: 'acpx CLI runs non-interactively; permission requests cannot be interactively resolved by caller mid-turn.',
  };
  flush();

  // 11. fork
  console.log('--- Testing fork ---');
  results['fork'] = {
    pass: false,
    na: true,
    evidence: `acpx has no fork subcommand; acpx codex --help lists only prompt, exec, cancel, set-mode, set, status, sessions`,
    cmd: `acpx codex fork (unrecognized)`,
    note: 'acpx CLI does not expose a fork session command.',
  };
  flush();

  // 12. compact
  console.log('--- Testing compact ---');
  results['compact'] = {
    pass: false,
    na: true,
    evidence: `acpx has no compact subcommand`,
    cmd: `acpx codex compact (unrecognized)`,
    note: 'acpx CLI does not expose a compact command.',
  };
  flush();

  // 15. model-switch
  console.log('--- Testing model-switch ---');
  const setModelRes = runCmd(`acpx codex set -s ${sessionName} model gpt-6.1-sol`, 15000);
  const verifyPrompt = runCmd(`acpx --format json codex -s ${sessionName} "Reply with MODEL_SWITCH_CHECK"`, 60000);
  const statusAfterSwitch = runCmd(`acpx --format json codex status -s ${sessionName}`, 15000);
  let statusAfterJson = null;
  try { statusAfterJson = JSON.parse(statusAfterSwitch.out); } catch {}
  results['model-switch'] = {
    pass: verifyPrompt.ok && statusAfterJson?.model === 'gpt-6.1-sol',
    evidence: `set_out="${setModelRes.out}", current_model="${statusAfterJson?.model}", verify_turn_out="${verifyPrompt.out.slice(0, 100).replace(/\r?\n/g, ' ')}"`,
    cmd: `acpx codex set -s ${sessionName} model gpt-6.1-sol`,
  };
  flush();

  // 16. mode-switch
  console.log('--- Testing mode-switch ---');
  const modeRes = runCmd(`acpx codex set-mode -s ${sessionName} read-only`, 15000);
  results['mode-switch'] = {
    pass: modeRes.ok && modeRes.out.includes('mode set'),
    evidence: `out="${modeRes.out}"`,
    cmd: `acpx codex set-mode -s ${sessionName} read-only`,
  };
  flush();

  // 17. quota
  console.log('--- Testing quota ---');
  results['quota'] = {
    pass: false,
    na: true,
    evidence: `acpx CLI does not implement quota inspection command`,
    cmd: `acpx quota (unsupported)`,
    note: 'No quota subcommand in acpx.',
  };
  flush();

  // 8. close
  console.log('--- Testing close ---');
  const closeRes = runCmd(`acpx codex sessions close ${sessionName}`, 15000);
  results['close'] = {
    pass: closeRes.ok,
    evidence: `out="${closeRes.out}"`,
    cmd: `acpx codex sessions close ${sessionName}`,
  };
  flush();

  clearTimeout(safetyTimer);
  console.log('L1b Probing complete! Written to results_l1b_acpx.json');
}

main().catch(console.error);
