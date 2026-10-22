import { runAgentApi } from './run_probe.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const prompt = 'Execute two shell commands in sequence using run_command: First run `echo STEP1_PROGRESS`. Then after seeing the output, run `echo STEP2_PROGRESS`. Finally output DONE.';

console.log('--- Starting new-conversation for act-report ---');
const res = runAgentApi(['new-conversation', '--title=probe-act-report-evidence', '--model=flash_lite', prompt]);
const cid = res.json?.response?.newConversation?.conversationId;
console.log('Conversation ID:', cid);

if (cid) {
  const transcriptPath = path.join(os.homedir(), '.gemini', 'antigravity', 'brain', cid, '.system_generated', 'logs', 'transcript.jsonl');
  let intermediateFound = false;
  let finalFound = false;
  for (let i = 0; i < 20; i++) {
    if (fs.existsSync(transcriptPath)) {
      const content = fs.readFileSync(transcriptPath, 'utf8');
      if (content.includes('STEP1_PROGRESS') && !content.includes('STEP2_PROGRESS')) {
        console.log(`[t+${i*500}ms] Observed intermediate Step 1 output while round was still progressing!`);
        intermediateFound = true;
      }
      if (content.includes('STEP2_PROGRESS') && content.includes('DONE')) {
        console.log(`[t+${i*500}ms] Final round complete.`);
        finalFound = true;
        break;
      }
    }
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 500);
  }
  console.log('Result: intermediateFound =', intermediateFound, 'finalFound =', finalFound);
}
