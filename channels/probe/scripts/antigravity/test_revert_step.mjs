import { runAgentApi } from './run_probe.mjs';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const credFile = path.join(os.tmpdir(), 'agy-probe-ls-cred.json');
const cred = JSON.parse(fs.readFileSync(credFile, 'utf8'));

function callRpc(method, bodyObj) {
  const res = spawnSync(
    'curl.exe',
    [
      '-s', '--max-time', '15', '-w', '\nHTTP_STATUS:%{http_code}',
      '-X', 'POST',
      '-H', `x-codeium-csrf-token: ${cred.csrfToken}`,
      '-H', 'Connect-Protocol-Version: 1',
      '-H', 'Content-Type: application/json',
      '-d', JSON.stringify(bodyObj),
      `http://127.0.0.1:${cred.port}/exa.language_server_pb.LanguageServerService/${method}`,
    ],
    { encoding: 'utf8', timeout: 15000, windowsHide: true }
  );
  const m = (res.stdout || '').match(/\nHTTP_STATUS:(\d+)\s*$/);
  const status = m ? Number(m[1]) : 0;
  const body = (res.stdout || '').replace(/\nHTTP_STATUS:\d+\s*$/, '').trim();
  return { status, body };
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  process.env.ANTIGRAVITY_PROJECT_ID = 'a22912fa-7d84-44c6-93e7-9de2f9330b93';
  console.log('1. Creating multi-step conversation...');
  const res = runAgentApi(['new-conversation', '--title=probe-revert-step', '--model=flash_lite', 'Execute: first echo TOKEN_A, then echo TOKEN_B, then echo TOKEN_C']);
  const cid = res.json?.response?.newConversation?.conversationId;
  console.log('CID:', cid);
  if (!cid) {
    console.error('Failed to create:', res.stdout);
    return;
  }

  const transcriptPath = path.join(os.homedir(), '.gemini', 'antigravity', 'brain', cid, '.system_generated', 'logs', 'transcript.jsonl');

  // Wait for some steps
  for (let i = 0; i < 20; i++) {
    await sleep(1000);
    if (fs.existsSync(transcriptPath)) {
      const lines = fs.readFileSync(transcriptPath, 'utf8').trim().split('\n').filter(Boolean);
      console.log(`[t+${i}s] Transcript lines: ${lines.length}`);
      if (lines.length >= 3) break;
    }
  }

  const beforeLines = fs.readFileSync(transcriptPath, 'utf8').trim().split('\n').filter(Boolean);
  console.log(`Before revert: ${beforeLines.length} steps in transcript`);

  console.log('2. Calling RevertToCascadeStep to stepIndex 1 (conversationOnly: true)...');
  const revertRes = callRpc('RevertToCascadeStep', {
    cascadeId: cid,
    stepIndex: 1,
    conversationOnly: true
  });
  console.log('RevertToCascadeStep result:', revertRes);

  await sleep(1000);
  if (fs.existsSync(transcriptPath)) {
    const afterLines = fs.readFileSync(transcriptPath, 'utf8').trim().split('\n').filter(Boolean);
    console.log(`After revert: ${afterLines.length} steps in transcript`);
  }

  // Cleanup probe session
  callRpc('DeleteCascadeTrajectory', { cascadeId: cid });
}

main().catch(console.error);
