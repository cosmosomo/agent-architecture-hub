import { runAgentApi } from './run_probe.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const prompt = 'Deliver the task completion report. Your output MUST be strictly a single JSON object with exact keys: "status", "deliveryId", "verdict". Example: {"status":"DELIVERED","deliveryId":"TASK-1019","verdict":"SUCCESS"}. Do not output any explanation.';

console.log('--- Starting new-conversation for act-deliver & output-contract ---');
const res = runAgentApi(['new-conversation', '--title=probe-act-deliver-output-contract', '--model=flash_lite', prompt]);
console.log('Exit status:', res.status);
const cid = res.json?.response?.newConversation?.conversationId;
console.log('Conversation ID:', cid);

if (cid) {
  // Wait 3 seconds for transcript to flush
  const transcriptPath = path.join(os.homedir(), '.gemini', 'antigravity', 'brain', cid, '.system_generated', 'logs', 'transcript.jsonl');
  let found = false;
  for (let i = 0; i < 10; i++) {
    if (fs.existsSync(transcriptPath)) {
      const lines = fs.readFileSync(transcriptPath, 'utf8').trim().split('\n');
      for (const l of lines) {
        try {
          const step = JSON.parse(l);
          if (step.type === 'PLANNER_RESPONSE' && step.status === 'DONE') {
            console.log('Found PLANNER_RESPONSE Step:', step.step_index);
            console.log('Content:', step.content);
            found = true;
            break;
          }
        } catch {}
      }
    }
    if (found) break;
    const AtomicsWait = Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1000);
  }
}
