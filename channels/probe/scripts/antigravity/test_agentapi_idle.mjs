import { runAgentApi } from './run_probe.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const dbPath = path.join(os.homedir(), '.gemini', 'antigravity', 'conversation_summaries.db');

function getDbStatus(cid) {
  try {
    const db = new DatabaseSync(dbPath, { readOnly: true });
    const row = db.prepare('SELECT status, not_fully_idle FROM conversation_summaries WHERE conversation_id = ?').get(cid);
    db.close();
    return row;
  } catch (e) {
    return null;
  }
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log('1. Creating test conversation with flash_lite...');
  const res = runAgentApi(['new-conversation', '--title=probe-test-agentapi-idle', '--model=flash_lite', 'Reply with single token: INIT_OK']);
  console.log('new-conversation res:', res.json);
  const cid = res.json?.response?.newConversation?.conversationId;
  if (!cid) {
    console.error('Failed to create conversation');
    return;
  }
  console.log('Created CID:', cid);

  // Wait for it to become IDLE
  for (let i = 0; i < 30; i++) {
    await sleep(1000);
    const row = getDbStatus(cid);
    console.log(`Poll ${i}: status=${row?.status}, not_fully_idle=${row?.not_fully_idle}`);
    if (row && row.not_fully_idle === 0 && row.status.endsWith('IDLE')) {
      console.log('Conversation is idle!');
      break;
    }
  }

  // Now send a message via agentapi send-message
  console.log('2. Sending message via agentapi send-message...');
  const sendRes = runAgentApi(['send-message', cid, 'Now reply with single token: RESUME_OK']);
  console.log('send-message res:', sendRes.json || sendRes.stdout);

  // Monitor transcript and db
  const tPath = path.join(os.homedir(), '.gemini', 'antigravity', 'brain', cid, '.system_generated', 'logs', 'transcript.jsonl');
  for (let i = 0; i < 30; i++) {
    await sleep(1000);
    const row = getDbStatus(cid);
    console.log(`After send Poll ${i}: status=${row?.status}, not_fully_idle=${row?.not_fully_idle}`);
    if (fs.existsSync(tPath)) {
      const lines = fs.readFileSync(tPath, 'utf8').trim().split('\n');
      console.log(`Transcript lines: ${lines.length}`);
      const last = lines[lines.length - 1];
      try {
        const parsed = JSON.parse(last);
        if (parsed.type === 'PLANNER_RESPONSE' && parsed.content && parsed.content.includes('RESUME_OK')) {
          console.log('Got expected response in transcript!');
          break;
        }
      } catch {}
    }
  }
}

main().catch(console.error);
