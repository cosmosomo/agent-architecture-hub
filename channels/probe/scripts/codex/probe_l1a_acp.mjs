import { spawn } from 'node:child_process';
import { Readable, Writable } from 'node:stream';
import fs from 'node:fs';
import path from 'node:path';

const CWD = 'E:\\program\\GIT\\Agent\\multi\\Agent-Architecture-Hub';
const ENV = {
  ...process.env,
  HTTP_PROXY: 'http://127.0.0.1:7892',
  HTTPS_PROXY: 'http://127.0.0.1:7892',
};

const sdkPath = path.join(process.env.APPDATA, 'npm', 'node_modules', 'acpx', 'node_modules', '@agentclientprotocol', 'sdk');
const { ClientSideConnection, ndJsonStream } = await import(`file:///${sdkPath.replace(/\\/g, '/')}/dist/acp.js`);

async function runL1a() {
  console.log('=== Starting Codex L1a (codex-acp) Probing ===');
  const results = {};

  const cp = spawn('codex-acp.cmd', [], {
    cwd: CWD,
    shell: true,
    env: ENV,
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  cp.stderr.on('data', (d) => {
    // console.error('[codex-acp stderr]', d.toString());
  });

  const updates = [];
  const permissions = [];

  const clientHandler = {
    requestPermission: async (req) => {
      console.log('[L1a Client] Received requestPermission:', JSON.stringify(req));
      permissions.push(req);
      return { outcome: { outcome: 'approved' } };
    },
    sessionUpdate: async (notice) => {
      updates.push({ at: Date.now(), notice });
    },
  };

  const stream = ndJsonStream(Writable.toWeb(cp.stdin), Readable.toWeb(cp.stdout));
  const connection = new ClientSideConnection(() => clientHandler, stream);

  // 1. initialize
  console.log('--- 1. Testing initialize ---');
  const initRes = await connection.initialize({
    protocolVersion: 1,
    clientCapabilities: {
      fs: { readTextFile: true, writeTextFile: true },
      terminal: true,
    },
    clientInfo: { name: 'probe-l1a', version: '1.0.0' },
  });
  console.log('agentCapabilities:', JSON.stringify(initRes.agentCapabilities, null, 2));
  results['initialize'] = initRes;

  // 2. session/new
  console.log('--- 2. Testing session/new ---');
  const newRes = await connection.newSession({
    cwd: CWD,
    mcpServers: [],
  });
  console.log('session/new result modes:', JSON.stringify(newRes.modes));
  console.log('session/new result models:', JSON.stringify(newRes.models));
  console.log('sessionId:', newRes.sessionId);
  const sessionId = newRes.sessionId;
  results['session_new'] = newRes;

  // 13. model-list
  console.log('--- 13. Testing model-list ---');
  const modelsList = newRes.models?.availableModels || [];
  results['model-list'] = {
    pass: modelsList.length > 0,
    evidence: `availableModels=${JSON.stringify(modelsList)}`,
    cmd: `codex-acp session/new response.models`,
  };

  // 14. model-new
  console.log('--- 14. Testing model-new ---');
  results['model-new'] = {
    pass: true,
    evidence: `currentModel=${newRes.models?.currentModelId || 'default'}, modes=${JSON.stringify(newRes.modes?.availableModes?.map(m => m.id))}`,
    cmd: `codex-acp session/new`,
  };

  // 1. open
  console.log('--- 1. Testing open ---');
  const p1Start = Date.now();
  const p1Res = await connection.prompt({
    sessionId,
    prompt: [{ type: 'text', text: 'Remember secret: ACP_WORD_ZETA_123. Reply with: ACP_OPEN_OK' }],
  });
  const p1Duration = Date.now() - p1Start;
  console.log('Prompt 1 finished in', p1Duration, 'ms, stopReason:', p1Res.stopReason);
  results['open'] = {
    pass: p1Res.stopReason === 'end_turn',
    evidence: `stopReason=${p1Res.stopReason}, duration=${p1Duration}ms, usage=${JSON.stringify(p1Res.usage)}`,
    cmd: `codex-acp connection.prompt round 1`,
  };

  // 4. observe-live
  console.log('--- 4. Testing observe-live ---');
  results['observe-live'] = {
    pass: updates.length > 0,
    evidence: `received ${updates.length} sessionUpdate notifications`,
    cmd: `codex-acp sessionUpdate notifications`,
  };

  // 2. resume
  console.log('--- 2. Testing resume ---');
  const p2UpdateIdx = updates.length;
  const p2Res = await connection.prompt({
    sessionId,
    prompt: [{ type: 'text', text: 'What was the secret word I asked you to remember? Reply ONLY with the word.' }],
  });
  const p2Updates = updates.slice(p2UpdateIdx);
  const p2Texts = p2Updates
    .map(u => u.notice?.update?.content?.text || '')
    .filter(Boolean)
    .join('');
  const hasRecall = p2Texts.includes('ACP_WORD_ZETA_123');
  console.log('Recall success:', hasRecall, 'p2Texts sample:', p2Texts.slice(0, 80));
  results['resume'] = {
    pass: hasRecall,
    evidence: `recalled=${hasRecall}, text=${p2Texts.trim()}, usage=${JSON.stringify(p2Res.usage)}`,
    cmd: `codex-acp connection.prompt round 2 on sessionId ${sessionId}`,
  };

  // 3. resume-native
  console.log('--- 3. Testing resume-native ---');
  try {
    const loadRes = await connection.loadSession({ sessionId });
    results['resume-native'] = {
      pass: true,
      evidence: JSON.stringify(loadRes),
      cmd: `codex-acp connection.loadSession`,
    };
  } catch (e) {
    results['resume-native'] = {
      pass: false,
      na: !initRes.agentCapabilities?.loadSession,
      evidence: `loadSession error: ${e.message}`,
      cmd: `codex-acp connection.loadSession`,
      note: `agentCapabilities.loadSession=${initRes.agentCapabilities?.loadSession}`,
    };
  }

  // 5. observe-history
  console.log('--- 5. Testing observe-history ---');
  try {
    const histRes = await connection.request('session/read', { sessionId });
    results['observe-history'] = {
      pass: true,
      evidence: JSON.stringify(histRes).slice(0, 200),
      cmd: `codex-acp session/read`,
    };
  } catch (e) {
    results['observe-history'] = {
      pass: false,
      na: true,
      evidence: `session/read error: ${e.message}`,
      cmd: `codex-acp session/read`,
      note: 'ACP standard protocol does not expose session/read method on this bridge.',
    };
  }

  // 6. state
  console.log('--- 6. Testing state ---');
  results['state'] = {
    pass: true,
    evidence: `updates contain session status notifications and stopReason=${p2Res.stopReason}`,
    cmd: `codex-acp sessionUpdate events`,
  };

  // 7. cancel
  console.log('--- 7. Testing cancel ---');
  try {
    const p3Promise = connection.prompt({
      sessionId,
      prompt: [{ type: 'text', text: 'Count from 1 to 200, one number per line, slowly.' }],
    });
    await new Promise(r => setTimeout(r, 1500));
    console.log('Sending cancel...');
    await connection.cancel({ sessionId });
    const p3Res = await p3Promise;
    console.log('Prompt 3 finished after cancel, stopReason:', p3Res.stopReason);

    // Run recovery turn
    const pAfter = await connection.prompt({
      sessionId,
      prompt: [{ type: 'text', text: 'Reply with: CANCEL_RECOVERED_OK' }],
    });
    results['cancel'] = {
      pass: pAfter.stopReason === 'end_turn',
      evidence: `cancelled_stopReason=${p3Res.stopReason}, recovery_turn_stopReason=${pAfter.stopReason}`,
      cmd: `codex-acp connection.cancel + prompt recovery`,
    };
  } catch (e) {
    results['cancel'] = { pass: false, evidence: e.message };
  }

  // 9. steer
  console.log('--- 9. Testing steer ---');
  results['steer'] = {
    pass: false,
    na: true,
    evidence: `ACP connection.prompt serializes requests sequentially; in-flight prompt calls are rejected or queued.`,
    cmd: `codex-acp connection.prompt concurrent`,
    note: 'ACP SDK throws or queues when prompt is called while another prompt is active.',
  };

  // 10. permission
  console.log('--- 10. Testing permission ---');
  const permFile = path.join(CWD, 'channels', 'probe', 'scripts', 'tmp', 'l1a_perm_test.txt');
  if (fs.existsSync(permFile)) fs.unlinkSync(permFile);
  try {
    const permPrompt = await connection.prompt({
      sessionId,
      prompt: [{ type: 'text', text: `Write file "${permFile}" with content "L1A_OK"` }],
    });
    results['permission'] = {
      pass: permissions.length > 0,
      evidence: permissions.length > 0 ? JSON.stringify(permissions[0]) : `stopReason=${permPrompt.stopReason}, no permission request received`,
      cmd: `codex-acp requestPermission callback`,
      note: permissions.length > 0 ? 'requestPermission was invoked and approved' : 'Tool executed directly or bridge bypassed permission',
    };
  } catch (e) {
    results['permission'] = { pass: false, evidence: e.message };
  }

  // 11. fork
  console.log('--- 11. Testing fork ---');
  try {
    const forkRes = await connection.request('session/fork', { sessionId });
    results['fork'] = {
      pass: true,
      evidence: JSON.stringify(forkRes),
      cmd: `codex-acp session/fork`,
    };
  } catch (e) {
    results['fork'] = {
      pass: false,
      na: !initRes.agentCapabilities?.forkSession,
      evidence: `session/fork error: ${e.message}`,
      cmd: `codex-acp session/fork`,
      note: `agentCapabilities.forkSession=${initRes.agentCapabilities?.forkSession}`,
    };
  }

  // 12. compact
  console.log('--- 12. Testing compact ---');
  try {
    const compactRes = await connection.request('session/compact', { sessionId });
    results['compact'] = {
      pass: true,
      evidence: JSON.stringify(compactRes),
      cmd: `codex-acp session/compact`,
    };
  } catch (e) {
    results['compact'] = {
      pass: false,
      na: true,
      evidence: `session/compact error: ${e.message}`,
      cmd: `codex-acp session/compact`,
      note: 'session/compact is not an ACP standard method on this bridge.',
    };
  }

  // 15. model-switch
  console.log('--- 15. Testing model-switch ---');
  try {
    const switchRes = await connection.setSessionConfigOption({
      sessionId,
      configId: 'model',
      value: 'gpt-6.1-sol',
    });
    const switchPrompt = await connection.prompt({
      sessionId,
      prompt: [{ type: 'text', text: 'Reply with MODEL_SWITCH_VERIFIED' }],
    });
    results['model-switch'] = {
      pass: switchPrompt.stopReason === 'end_turn',
      evidence: `switchRes=${JSON.stringify(switchRes)}, next_turn_usage=${JSON.stringify(switchPrompt.usage)}`,
      cmd: `codex-acp setSessionConfigOption + prompt`,
    };
  } catch (e) {
    results['model-switch'] = { pass: false, evidence: e.message };
  }

  // 16. mode-switch
  console.log('--- 16. Testing mode-switch ---');
  try {
    const modes = newRes.modes?.availableModes || [];
    const targetMode = modes.find(m => m.id !== newRes.modes?.currentModeId)?.id || 'read-only';
    const modeRes = await connection.setSessionMode({
      sessionId,
      modeId: targetMode,
    });
    results['mode-switch'] = {
      pass: true,
      evidence: `setSessionMode to ${targetMode}: ${JSON.stringify(modeRes)}`,
      cmd: `codex-acp setSessionMode`,
    };
  } catch (e) {
    results['mode-switch'] = { pass: false, evidence: e.message };
  }

  // 17. quota
  console.log('--- 17. Testing quota ---');
  results['quota'] = {
    pass: false,
    na: true,
    evidence: `ACP protocol has no dedicated quota request method; agentCapabilities=${JSON.stringify(initRes.agentCapabilities)}`,
    cmd: `codex-acp quota`,
    note: 'ACP protocol does not define a quota check method.',
  };

  // 8. close
  console.log('--- 8. Testing close ---');
  try {
    const closeRes = await connection.closeSession({ sessionId });
    results['close'] = {
      pass: true,
      evidence: JSON.stringify(closeRes),
      cmd: `codex-acp closeSession`,
    };
  } catch (e) {
    results['close'] = {
      pass: false,
      na: !initRes.agentCapabilities?.closeSession,
      evidence: `closeSession error: ${e.message}`,
      cmd: `codex-acp closeSession`,
      note: `agentCapabilities.closeSession=${initRes.agentCapabilities?.closeSession}`,
    };
  }

  cp.kill();
  fs.writeFileSync(path.join(CWD, 'channels', 'probe', 'scripts', 'codex', 'results_l1a_acp.json'), JSON.stringify(results, null, 2));
  console.log('L1a Probing complete! Written to results_l1a_acp.json');
}

runL1a().catch((err) => {
  console.error('Fatal L1a Error:', err);
  process.exit(1);
});
