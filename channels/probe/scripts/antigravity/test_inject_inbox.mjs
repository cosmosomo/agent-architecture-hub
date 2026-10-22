import { runAgentApi } from './run_probe.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Ensure dir exists
const tmpDir = path.resolve('channels/probe/tmp');
if (!fs.existsSync(tmpDir)) {
  fs.mkdirSync(tmpDir, { recursive: true });
}

// 1. Write external task payload to inbox file
const inboxFile = path.join(tmpDir, 'inbox_signal.json');
const testToken = 'INBOX_SIGNAL_' + Date.now();
fs.writeFileSync(inboxFile, JSON.stringify({
  action: 'execute_command',
  token: testToken,
  instruction: `Echo exactly ${testToken}`
}, null, 2));

console.log('1. External script wrote inbox file:', inboxFile, 'with token:', testToken);

// 2. Start conversation instructing agent to check inbox file
process.env.ANTIGRAVITY_PROJECT_ID = 'a22912fa-7d84-44c6-93e7-9de2f9330b93';
const prompt = `Inspect the file ${inboxFile}. Read its content, extract the token field, and output a message containing the token.`;

console.log('2. Starting probe conversation...');
const res = runAgentApi(['new-conversation', '--title=probe-inject-inbox', '--model=flash_lite', prompt]);
const cid = res.json?.response?.newConversation?.conversationId;
console.log('Conversation ID:', cid);

if (!cid) {
  console.error('Failed to start conversation:', res.stdout, res.stderr);
  process.exit(1);
}

// 3. Monitor transcript to verify agent consumed the inbox payload
const transcriptPath = path.join(os.homedir(), '.gemini', 'antigravity', 'brain', cid, '.system_generated', 'logs', 'transcript.jsonl');

let success = false;
for (let i = 0; i < 30; i++) {
  if (fs.existsSync(transcriptPath)) {
    const content = fs.readFileSync(transcriptPath, 'utf8');
    if (content.includes(testToken)) {
      console.log(`[t+${i}s] Verified! Agent read inbox file and echoed token: ${testToken}`);
      success = true;
      break;
    }
  }
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1000);
}

console.log('Result:', { success, token: testToken, cid });
