import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { writeFileSync } from 'node:fs';

const REPO_ROOT = 'E:\\program\\GIT\\Agent\\multi\\Agent-Architecture-Hub';
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

const cliResults = {
  targets: null,
  status: {},
  cancel: {},
  quota: null,
  run: {},
};

function runNode(args, timeout = 30000, env = {}) {
  const t0 = Date.now();
  const res = spawnSync('node', ['hub/tools/agent_gateway.js', ...args], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    timeout,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, ...env },
  });
  return {
    exitCode: res.status,
    stdout: res.stdout || '',
    stderr: res.stderr || '',
    durationMs: Date.now() - t0,
  };
}

console.log('[1] Testing agent_gateway.js targets --json...');
const targetsRes = runNode(['targets', '--json'], 15000);
try {
  cliResults.targets = JSON.parse(targetsRes.stdout);
  console.log(`  - Targets count: ${cliResults.targets.count}`);
} catch (e) {
  cliResults.targets = { raw: targetsRes.stdout, stderr: targetsRes.stderr, exitCode: targetsRes.exitCode };
  console.log(`  - Targets raw exitCode: ${targetsRes.exitCode}`);
}

console.log('\n[2] Testing agent_gateway.js status for 7 families...');
for (const fam of FAMILIES) {
  const sname = `probe-L2b-${fam}-status`;
  const res = runNode(['status', '--agent', fam, '--session', sname], 25000);
  let parsed = null;
  try {
    parsed = JSON.parse(res.stdout);
  } catch {
    parsed = { raw: res.stdout, stderr: res.stderr };
  }
  cliResults.status[fam] = {
    exitCode: res.exitCode,
    data: parsed,
    durationMs: res.durationMs,
  };
  console.log(`  - ${fam}: exitCode=${res.exitCode}, ok=${parsed.ok ?? false}, driver=${parsed.driver ?? 'unknown'}`);
}

console.log('\n[3] Testing agent_gateway.js cancel for 7 families (standalone mode)...');
for (const fam of FAMILIES) {
  const sname = `probe-L2b-${fam}-cancel`;
  const res = runNode(['cancel', '--agent', fam, '--session', sname, '--standalone'], 15000);
  let parsed = null;
  try {
    parsed = JSON.parse(res.stdout);
  } catch {
    parsed = { raw: res.stdout, stderr: res.stderr };
  }
  cliResults.cancel[fam] = {
    exitCode: res.exitCode,
    output: parsed,
    stderr: res.stderr,
    durationMs: res.durationMs,
  };
  console.log(`  - ${fam}: exitCode=${res.exitCode}, output=${JSON.stringify(parsed).slice(0, 80)}`);
}

console.log('\n[4] Testing agent_gateway.js quota --json...');
const quotaRes = runNode(['quota', '--json'], 25000);
try {
  cliResults.quota = JSON.parse(quotaRes.stdout);
  console.log(`  - Quota checkedAt: ${cliResults.quota.checkedAt}, activeSessions: ${cliResults.quota.activeWorkspaceAcpxSessions?.length}`);
} catch (e) {
  cliResults.quota = { raw: quotaRes.stdout, stderr: quotaRes.stderr, exitCode: quotaRes.exitCode };
  console.log(`  - Quota parse error, exitCode: ${quotaRes.exitCode}`);
}

console.log('\n[5] Testing agent_gateway.js run (dry run/minimal execution checks)...');
// We test run with --standalone for antigravity and for codex/claude with cheap models
// Check preflight validation and underlying route
for (const fam of ['antigravity', 'codex', 'claude', 'zcode']) {
  const sname = `probe-L2b-${fam}-runtest`;
  const cheapM = CHEAP_MODELS[fam];
  console.log(`  - Running probe prompt on ${fam} (${cheapM})...`);
  const runRes = runNode(
    [
      'run',
      '--agent', fam,
      '--session', sname,
      '--model', cheapM,
      '--permissions', 'read',
      '--prompt', '请输出文字: PROBE_L2B_VERIFY',
      '--timeout', '40',
      '--standalone',
    ],
    45000
  );
  let parsed = null;
  try {
    parsed = JSON.parse(runRes.stdout);
  } catch {
    parsed = { raw: runRes.stdout, stderr: runRes.stderr };
  }
  cliResults.run[fam] = {
    exitCode: runRes.exitCode,
    data: parsed,
    durationMs: runRes.durationMs,
  };
  console.log(`    Result ${fam}: exitCode=${runRes.exitCode}, ok=${parsed.ok ?? false}, gatewayMode=${parsed.gatewayMode ?? '-'}`);
}

const outPath = resolve(REPO_ROOT, 'channels/probe/scripts/L2/cli_gateway_results.json');
writeFileSync(outPath, JSON.stringify(cliResults, null, 2), 'utf8');
console.log(`\nCLI Gateway test results written to ${outPath}`);
