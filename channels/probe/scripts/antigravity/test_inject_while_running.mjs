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
  console.log('--- Test 1: agentapi send-message while turn is actively executing ---');
  // First prompt: ask model to run a 6-second sleep command and then reply
  const prompt1 = 'Run the powershell command: Start-Sleep -Seconds 6; Write-Output "TURN_1_DONE". Then reply with the exact text "TURN_1_FINISHED".';
  console.log('1. Starting conversation...');
  const res = runAgentApi(['new-conversation', '--title=probe-inject-next-running', '--model=flash_lite', prompt1]);
  const cid = res.json?.response?.newConversation?.conversationId;
  console.log('Conversation ID:', cid);
  if (!cid) return;

  const tPath = path.join(os.homedir(), '.gemini', 'antigravity', 'brain', cid, '.system_generated', 'logs', 'transcript.jsonl');

  // Wait until it is actively running
  let isRunning = false;
  for (let i = 0; i < 20; i++) {
    await sleep(500);
    const row = getDbStatus(cid);
    console.log(`Pre-inject check ${i}: status=${row?.status}, not_fully_idle=${row?.not_fully_idle}`);
    if (row && row.status.endsWith('RUNNING') && row.not_fully_idle === 1) {
      isRunning = true;
      console.log('>>> Confirmed conversation is actively RUNNING! Ingesting injected message NOW...');
      break;
    }
  }

  if (!isRunning) {
    console.log('Failed to catch conversation in RUNNING state.');
    return;
  }

  // Send injected message while running!
  const sendRes = runAgentApi(['send-message', cid, 'INJECTED_PROMPT: Please calculate 12345 + 54321 and output INJECT_NEXT_TOKEN_66666.']);
  console.log('send-message exit status:', sendRes.status);
  console.log('send-message output:', sendRes.json || sendRes.stdout);

  // Monitor the full trajectory until it returns to IDLE
  console.log('Monitoring execution trajectory...');
  let idleCount = 0;
  for (let i = 0; i < 40; i++) {
    await sleep(1000);
    const row = getDbStatus(cid);
    let lineCount = 0;
    if (fs.existsSync(tPath)) {
      lineCount = fs.readFileSync(tPath, 'utf8').trim().split('\n').length;
    }
    console.log(`Poll ${i}: status=${row?.status}, not_fully_idle=${row?.not_fully_idle}, transcriptLines=${lineCount}`);
    if (row && row.not_fully_idle === 0 && row.status.endsWith('IDLE')) {
      idleCount++;
      if (idleCount >= 3) {
        console.log('Conversation stabilized at IDLE!');
        break;
      }
    } else {
      idleCount = 0;
    }
  }

  // Read full transcript
  if (fs.existsSync(tPath)) {
    const lines = fs.readFileSync(tPath, 'utf8').trim().split('\n');
    console.log('\n--- FULL TRANSCRIPT TRAJECTORY ---');
    lines.forEach((l, idx) => {
      try {
        const step = JSON.parse(l);
        console.log(`[Step ${step.step_index}] source=${step.source} type=${step.type} status=${step.status}`);
        if (step.tool_calls) {
          console.log(`  tool_calls: ${JSON.stringify(step.tool_calls)}`);
        }
        if (step.content) {
          console.log(`  content: ${step.content.slice(0, 120)}...`);
        }
      } catch {
        console.log(`[Line ${idx}] ${l}`);
      }
    });
  }
}

main().catch(console.error);
