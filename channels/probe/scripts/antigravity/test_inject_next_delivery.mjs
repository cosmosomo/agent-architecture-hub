import { runAgentApi } from './run_probe.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { DatabaseSync } from 'node:sqlite';

const credFile = path.join(os.tmpdir(), 'agy-probe-ls-cred.json');
const cred = JSON.parse(fs.readFileSync(credFile, 'utf8'));
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

function sendUserCascadeMessage(cascadeId, text, deliveryStrategy = undefined) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: '127.0.0.1',
      port: cred.port,
      path: '/exa.language_server_pb.LanguageServerService/SendUserCascadeMessage',
      method: 'POST',
      headers: {
        'x-codeium-csrf-token': cred.csrfToken,
        'Connect-Protocol-Version': '1',
        'Content-Type': 'application/json'
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(body || '{}') });
        } catch {
          resolve({ status: res.statusCode, raw: body });
        }
      });
    });
    req.on('error', reject);

    const payload = {
      cascadeId,
      items: [{ text }]
    };
    if (deliveryStrategy !== undefined) {
      payload.deliveryStrategy = deliveryStrategy;
    }
    req.write(JSON.stringify(payload));
    req.end();
  });
}

async function testStrategy(strategyName, strategyValue) {
  console.log(`\n=======================================================`);
  console.log(`TESTING deliveryStrategy: ${strategyName} (${strategyValue})`);
  console.log(`=======================================================`);

  const prompt1 = 'Run powershell command: Start-Sleep -Seconds 6; Write-Output "TURN_1_OK". Then reply with "FINISHED_TURN_1".';
  console.log('1. Launching conversation...');
  const newRes = runAgentApi(['new-conversation', `--title=probe-strategy-${strategyName.toLowerCase()}`, '--model=flash_lite', prompt1]);
  const cid = newRes.json?.response?.newConversation?.conversationId;
  console.log('Conversation ID:', cid);
  if (!cid) {
    console.error('Failed to create conversation');
    return null;
  }

  const tPath = path.join(os.homedir(), '.gemini', 'antigravity', 'brain', cid, '.system_generated', 'logs', 'transcript.jsonl');

  // Wait until it is RUNNING
  let isRunning = false;
  for (let i = 0; i < 20; i++) {
    await sleep(400);
    const row = getDbStatus(cid);
    if (row && row.status.endsWith('RUNNING') && row.not_fully_idle === 1) {
      isRunning = true;
      console.log('>>> Confirmed RUNNING! Sending injected user message now...');
      break;
    }
  }

  if (!isRunning) {
    console.error('Did not catch RUNNING state');
    return null;
  }

  const injectText = `INJECTED_TURN_2: Please calculate 888 * 222 and reply with the token TOKEN_${strategyName}_PASS.`;
  const sendRes = await sendUserCascadeMessage(cid, injectText, strategyValue);
  console.log('SendUserCascadeMessage RPC response:', sendRes);

  // Monitor execution trajectory
  console.log('Monitoring lifecycle until idle...');
  let idleStreak = 0;
  for (let i = 0; i < 40; i++) {
    await sleep(1000);
    const row = getDbStatus(cid);
    let lineCount = 0;
    if (fs.existsSync(tPath)) {
      lineCount = fs.readFileSync(tPath, 'utf8').trim().split('\n').length;
    }
    console.log(`Poll ${i}: status=${row?.status}, not_fully_idle=${row?.not_fully_idle}, transcriptLines=${lineCount}`);
    if (row && row.not_fully_idle === 0 && row.status.endsWith('IDLE')) {
      idleStreak++;
      if (idleStreak >= 3) {
        console.log('Stabilized at IDLE.');
        break;
      }
    } else {
      idleStreak = 0;
    }
  }

  // Print all transcript steps
  let passed = false;
  if (fs.existsSync(tPath)) {
    const lines = fs.readFileSync(tPath, 'utf8').trim().split('\n');
    console.log(`\n--- TRANSCRIPT TRAJECTORY for ${strategyName} (${lines.length} steps) ---`);
    lines.forEach((l, idx) => {
      try {
        const step = JSON.parse(l);
        console.log(`Step ${step.step_index}: source=${step.source} type=${step.type} status=${step.status}`);
        if (step.tool_calls) console.log(`  tool: ${step.tool_calls[0]?.name}`);
        if (step.content) console.log(`  content: ${step.content.slice(0, 140)}...`);
        if (step.content && step.content.includes(`TOKEN_${strategyName}_PASS`)) {
          passed = true;
        }
      } catch {
        console.log(`Line ${idx}: ${l}`);
      }
    });
  }
  return { strategyName, cid, passed };
}

async function run() {
  const r1 = await testStrategy('NEXT_INVOCATION', 'MESSAGE_DELIVERY_STRATEGY_NEXT_INVOCATION');
  const r2 = await testStrategy('DEFAULT', undefined);
  console.log('\n--- FINAL SUMMARY ---');
  console.log('WHEN_IDLE: pass (cid: 4fc25e9e-6bb4-467c-a944-bcdad100921a)');
  console.log(`NEXT_INVOCATION: ${r1?.passed ? 'pass' : 'fail'} (cid: ${r1?.cid})`);
  console.log(`DEFAULT (unspecified): ${r2?.passed ? 'pass' : 'fail'} (cid: ${r2?.cid})`);
}

run().catch(console.error);
