import { runAgentApi } from './run_probe.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { spawnSync } from 'node:child_process';

const credFile = path.join(os.tmpdir(), 'agy-probe-ls-cred.json');
const cred = JSON.parse(fs.readFileSync(credFile, 'utf8'));
const dbPath = path.join(os.homedir(), '.gemini', 'antigravity', 'conversation_summaries.db');

process.env.ANTIGRAVITY_PROJECT_ID = 'a22912fa-7d84-44c6-93e7-9de2f9330b93';

function getDbStatus(cid) {
  try {
    const db = new DatabaseSync(dbPath, { readOnly: true });
    const row = db.prepare('SELECT conversation_id, status, not_fully_idle, title FROM conversation_summaries WHERE conversation_id = ?').get(cid);
    db.close();
    return row;
  } catch (e) {
    return null;
  }
}

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
  console.log('--- Step 1: Create conversation ---');
  const res = runAgentApi(['new-conversation', '--title=probe-test-close-cascade', '--model=flash_lite', 'Count from 1 to 20 slowly']);
  const cid = res.json?.response?.newConversation?.conversationId;
  console.log('Created cid:', cid);
  if (!cid) {
    console.error('Failed to create:', res.stdout, res.stderr);
    return;
  }

  let dbRow = getDbStatus(cid);
  console.log('Initial DB status:', dbRow);

  console.log('--- Step 2: Test ForceStopCascadeTree ---');
  const stopRes = callRpc('ForceStopCascadeTree', { conversationId: cid });
  console.log('ForceStopCascadeTree result:', stopRes);

  await sleep(1000);
  dbRow = getDbStatus(cid);
  console.log('Post-ForceStop DB status:', dbRow);

  console.log('--- Step 3: Test CancelCascadeInvocation ---');
  const cancelRes = callRpc('CancelCascadeInvocation', { conversationId: cid });
  console.log('CancelCascadeInvocation result:', cancelRes);

  await sleep(1000);
  dbRow = getDbStatus(cid);
  console.log('Post-Cancel DB status:', dbRow);

  console.log('--- Step 4: Test DeleteCascadeTrajectory ---');
  const delRes = callRpc('DeleteCascadeTrajectory', { conversationId: cid });
  console.log('DeleteCascadeTrajectory result:', delRes);

  await sleep(1000);
  dbRow = getDbStatus(cid);
  console.log('Post-Delete DB status:', dbRow);
}

main().catch(console.error);
