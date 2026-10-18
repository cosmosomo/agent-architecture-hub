import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { spawnSync } from 'node:child_process';
import os from 'node:os';

const HOME = process.env.USERPROFILE;
const baseCid = '67fa191b-ed51-4b51-9188-81a8eb004372';
const newCid = 'a1b2c3d4-e5f6-4a1b-8c2d-3e4f5a6b7c8d';

const convDir = path.join(HOME, '.gemini', 'antigravity', 'conversations');
const brainDir = path.join(HOME, '.gemini', 'antigravity', 'brain');
const sumDbPath = path.join(HOME, '.gemini', 'antigravity', 'conversation_summaries.db');

console.log('1. Copying conversations db...');
const srcDb = path.join(convDir, `${baseCid}.db`);
const dstDb = path.join(convDir, `${newCid}.db`);
if (fs.existsSync(srcDb)) {
  fs.copyFileSync(srcDb, dstDb);
  console.log('Copied db to', dstDb);
} else {
  console.log('Source db not found:', srcDb);
}

console.log('2. Copying brain dir if exists...');
const srcBrain = path.join(brainDir, baseCid);
const dstBrain = path.join(brainDir, newCid);
if (fs.existsSync(srcBrain)) {
  fs.cpSync(srcBrain, dstBrain, { recursive: true });
  console.log('Copied brain dir to', dstBrain);
} else {
  console.log('No brain dir for baseCid');
}

console.log('3. Updating conversation_summaries.db...');
const sumDb = new DatabaseSync(sumDbPath);
const orig = sumDb.prepare('select * from conversation_summaries where conversation_id = ?').get(baseCid);

if (orig) {
  const row = { ...orig, conversation_id: newCid, title: 'probe-file-fork-clone' };
  const keys = Object.keys(row);
  const placeholders = keys.map(() => '?').join(', ');
  const values = Object.values(row);
  
  sumDb.prepare(`insert or replace into conversation_summaries (${keys.join(', ')}) values (${placeholders})`).run(...values);
  console.log('Inserted cloned conversation into conversation_summaries.db');
}
sumDb.close();

console.log('4. Testing send-message to cloned conversation...');
const credFile = path.join(os.tmpdir(), 'agy-probe-ls-cred.json');
const cred = JSON.parse(fs.readFileSync(credFile, 'utf8'));
const lsBin = path.join(process.env.LOCALAPPDATA, 'Programs', 'antigravity', 'resources', 'bin', 'language_server.exe');

const env = {
  ...process.env,
  ANTIGRAVITY_LS_ADDRESS: cred.address,
  ANTIGRAVITY_CSRF_TOKEN: cred.csrfToken,
  ANTIGRAVITY_PROJECT_ID: 'a22912fa-7d84-44c6-93e7-9de2f9330b93'
};

const sendRes = spawnSync(
  lsBin,
  ['agentapi', 'send-message', newCid, 'What was the exact prompt I gave you in step 0? Answer briefly.'],
  { env, encoding: 'utf8', timeout: 25000 }
);

console.log('send-message exit:', sendRes.status);
console.log('send-message stdout:', sendRes.stdout);
console.log('send-message stderr:', sendRes.stderr);

console.log('5. Checking if language_server picked it up and generated a response...');
// 等待 8 秒让它生成
spawnSync('powershell.exe', ['-NoProfile', '-Command', 'Start-Sleep -Seconds 8']);

const checkDb = new DatabaseSync(sumDbPath, { readOnly: true });
const checkRow = checkDb.prepare('select conversation_id, status, not_fully_idle, step_count from conversation_summaries where conversation_id = ?').get(newCid);
console.log('Updated summary row:', JSON.stringify(checkRow));
checkDb.close();

// 检查 dstBrain 中的 transcript
const tFile = path.join(dstBrain, '.system_generated', 'logs', 'transcript.jsonl');
if (fs.existsSync(tFile)) {
  const lines = fs.readFileSync(tFile, 'utf8').trim().split('\n');
  console.log('Transcript lines count:', lines.length);
  for (const l of lines.slice(-2)) {
    const s = JSON.parse(l);
    console.log(`Step ${s.step_index} (${s.type}): ${(s.content || '').slice(0, 160)}`);
  }
} else {
  console.log('transcript.jsonl does not exist in destination brain dir');
}
