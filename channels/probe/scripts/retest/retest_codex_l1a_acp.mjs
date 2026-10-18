import { spawn } from 'node:child_process';
import { Readable, Writable } from 'node:stream';
import fs from 'node:fs';
import path from 'node:path';

const CWD = 'E:\\program\\GIT\\Agent\\multi\\Agent-Architecture-Hub';
const OUT_DIR = path.join(CWD, 'channels', 'probe', 'scripts', 'retest', 'output');
fs.mkdirSync(OUT_DIR, { recursive: true });

const ENV = {
  ...process.env,
  HTTP_PROXY: 'http://127.0.0.1:7892',
  HTTPS_PROXY: 'http://127.0.0.1:7892',
};

const sdkPath = path.join(process.env.APPDATA, 'npm', 'node_modules', 'acpx', 'node_modules', '@agentclientprotocol', 'sdk');
const { ClientSideConnection, ndJsonStream } = await import(`file:///${sdkPath.replace(/\\/g, '/')}/dist/acp.js`);

function findRolloutLines(threadId, pattern) {
  const sessionsDir = path.join(process.env.USERPROFILE, '.codex', 'sessions');
  const files = [];
  function walk(dir) {
    if (!fs.existsSync(dir)) return;
    for (const f of fs.readdirSync(dir)) {
      const full = path.join(dir, f);
      if (fs.statSync(full).isDirectory()) walk(full);
      else if (f.includes(threadId)) files.push(full);
    }
  }
  walk(sessionsDir);
  const matched = [];
  for (const file of files) {
    const lines = fs.readFileSync(file, 'utf8').split('\n');
    for (const line of lines) {
      if (line.includes(pattern)) matched.push(line);
    }
  }
  return matched;
}

async function main() {
  console.log('=== [Retest 6] codex/L1a/codex-acp model-new ===');
  const cp = spawn('codex-acp.cmd', [], {
    cwd: CWD,
    shell: true,
    env: ENV,
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  const stream = ndJsonStream(Writable.toWeb(cp.stdin), Readable.toWeb(cp.stdout));
  const connection = new ClientSideConnection(() => ({}), stream);

  try {
    const initRes = await connection.initialize({
      protocolVersion: 1,
      clientCapabilities: {
        fs: { readTextFile: true, writeTextFile: true },
        terminal: true,
      },
      clientInfo: { name: 'retest-codex-l1a', version: '1.0.0' },
    });
    console.log('codex-acp initialized.');

    // 1. New session
    const newRes = await connection.newSession({
      cwd: CWD,
      mcpServers: [],
    });
    const sessionId = newRes.sessionId;
    const configuredModelId = newRes.models?.currentModelId;
    console.log('New session created:', sessionId, 'configuredModelId:', configuredModelId);

    // 2. Execute prompt turn
    console.log('Executing prompt turn...');
    const promptRes = await connection.prompt({
      sessionId,
      prompt: [{ type: 'text', text: 'Reply with: MODEL_NEW_VERIFIED' }],
    });
    console.log('Prompt finished, stopReason:', promptRes.stopReason);
    console.log('Usage:', JSON.stringify(promptRes.usage));
    console.log('_meta:', JSON.stringify(promptRes._meta));

    // 3. Check rollout file on disk for actual model used
    const rolloutTurnContext = findRolloutLines(sessionId, 'turn_context');
    const rolloutSettings = findRolloutLines(sessionId, 'thread_settings_applied');

    let actualModelFromRollout = null;
    for (const line of rolloutTurnContext) {
      try {
        const j = JSON.parse(line);
        if (j.payload?.model) actualModelFromRollout = j.payload.model;
      } catch {}
    }

    console.log('Actual model from rollout:', actualModelFromRollout);

    const result = {
      pass: !!actualModelFromRollout,
      sessionId,
      configuredModelId,
      promptStopReason: promptRes.stopReason,
      promptUsage: promptRes.usage,
      promptMeta: promptRes._meta,
      actualModelFromRollout,
      rawRolloutTurnContext: rolloutTurnContext[0] || null,
      rawRolloutSettings: rolloutSettings[0] || null,
    };

    fs.writeFileSync(path.join(OUT_DIR, 'codex_l1a_model_new.json'), JSON.stringify(result, null, 2));
    console.log('Result saved:', JSON.stringify(result, null, 2));
  } finally {
    cp.kill();
  }
}

main().catch(console.error);
