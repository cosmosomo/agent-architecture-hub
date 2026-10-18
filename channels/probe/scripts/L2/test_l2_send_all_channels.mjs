import { spawn } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';

const PORT = 8931;
const REPO_ROOT = 'E:\\program\\GIT\\Agent\\multi\\Agent-Architecture-Hub';

const srv = spawn('node', ['--no-warnings=ExperimentalWarning', 'trace/apps/cli/src/main.ts', 'serve', '--port', String(PORT)], {
  cwd: REPO_ROOT,
  stdio: ['ignore', 'pipe', 'pipe'],
  windowsHide: true,
});

function httpPost(path, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request(
      `http://127.0.0.1:${PORT}${path}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
        },
      },
      (res) => {
        let buf = '';
        res.on('data', (c) => (buf += c));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, data: JSON.parse(buf), raw: buf });
          } catch {
            resolve({ status: res.statusCode, data: buf, raw: buf });
          }
        });
      },
    );
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function httpGet(path) {
  return new Promise((resolve, reject) => {
    http.get(`http://127.0.0.1:${PORT}${path}`, (res) => {
      let buf = '';
      res.on('data', (c) => (buf += c));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(buf), raw: buf });
        } catch {
          resolve({ status: res.statusCode, data: buf, raw: buf });
        }
      });
    }).on('error', reject);
  });
}

async function waitHealth(maxMs = 60000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    try {
      const res = await httpGet('/api/health');
      if (res.status === 200 && res.data?.ok) return res.data;
    } catch {}
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error('Timeout waiting for health');
}

const CHANNELS_CONFIG = [
  { channel: 'antigravity', model: 'flash_lite' },
  { channel: 'claude', model: 'haiku' },
  { channel: 'codex', model: 'gpt-5.4-mini' },
  { channel: 'zcode', model: 'builtin:bigmodel-coding-plan\\GLM-5.3-Flash' },
  { channel: 'workbuddy', model: 'custom-local:glm-5.3-flash' },
  { channel: 'opencode', model: 'opencode/big-pickle' },
  { channel: 'hermes', model: 'custom:glm-5.3' },
];

try {
  await waitHealth();
  console.log('=== L2 Testing: POST /api/gateway/send across all 7 channels ===\n');

  const results = {};

  for (const cfg of CHANNELS_CONFIG) {
    const ch = cfg.channel;
    const sessionName = `probe-l2a-${ch}-round`;
    const token = `SEC_${ch.toUpperCase()}_${Math.floor(100000 + Math.random() * 900000)}`;
    console.log(`\n----------------- Testing ${ch} (${cfg.model}) -----------------`);
    console.log(`Session: ${sessionName}, Secret Token: ${token}`);

    results[ch] = {
      channel: ch,
      model: cfg.model,
      sessionName,
      token,
      open: null,
      resume: null,
    };

    // 1. Turn 1 (open)
    console.log(`[${ch}] Sending Turn 1 (open)...`);
    try {
      const t1Start = Date.now();
      const res1 = await httpPost('/api/gateway/send', {
        channel: ch,
        sessionName,
        prompt: `请牢记暗号：${token}，只回复两个字：收到。不要调用任何工具。`,
        model: cfg.model,
        wait: true,
        timeoutMs: 60000,
      });
      const t1Ms = Date.now() - t1Start;
      console.log(`[${ch}] Turn 1 status: ${res1.status}, ok: ${res1.data?.ok}, durationMs: ${t1Ms}`);
      console.log(`[${ch}] Turn 1 reply: ${String(res1.data?.reply || '').slice(0, 150)}`);
      if (res1.data?.error) console.log(`[${ch}] Turn 1 error: ${res1.data.error}`);

      results[ch].open = {
        httpStatus: res1.status,
        ok: res1.data?.ok,
        runId: res1.data?.runId,
        traceSessionId: res1.data?.traceSessionId,
        reply: res1.data?.reply,
        error: res1.data?.error,
        durationMs: t1Ms,
      };

      // 2. Turn 2 (resume) if Turn 1 succeeded or created session
      console.log(`[${ch}] Sending Turn 2 (resume)...`);
      const t2Start = Date.now();
      const res2 = await httpPost('/api/gateway/send', {
        channel: ch,
        sessionName,
        prompt: `上一轮我告诉你的暗号是什么？请只完整回复该暗号本身。`,
        model: cfg.model,
        wait: true,
        timeoutMs: 60000,
      });
      const t2Ms = Date.now() - t2Start;
      const r2Reply = String(res2.data?.reply || '');
      const recalled = r2Reply.includes(token);
      console.log(`[${ch}] Turn 2 status: ${res2.status}, ok: ${res2.data?.ok}, recalled: ${recalled}`);
      console.log(`[${ch}] Turn 2 reply: ${r2Reply.slice(0, 150)}`);
      if (res2.data?.error) console.log(`[${ch}] Turn 2 error: ${res2.data.error}`);

      results[ch].resume = {
        httpStatus: res2.status,
        ok: res2.data?.ok,
        runId: res2.data?.runId,
        traceSessionId: res2.data?.traceSessionId,
        reply: r2Reply,
        recalled,
        error: res2.data?.error,
        durationMs: t2Ms,
      };
    } catch (err) {
      console.error(`[${ch}] Exception:`, err.message);
      results[ch].exception = err.message;
    }

    // Save intermediate results
    fs.writeFileSync(
      'channels/probe/scripts/L2/evidence_send_all_channels.json',
      JSON.stringify(results, null, 2),
      'utf8',
    );
  }

  console.log('\n=== All Channels Completed. Summary: ===');
  for (const ch of Object.keys(results)) {
    const r = results[ch];
    console.log(
      `- ${ch.padEnd(12)}: open=${r.open?.ok ? 'PASS' : 'FAIL'} | resume=${r.resume?.recalled ? 'PASS(recalled)' : r.resume?.ok ? 'FAIL(not recalled)' : 'FAIL'}`,
    );
  }
} catch (e) {
  console.error('Error in send suite:', e);
} finally {
  srv.kill('SIGINT');
  await new Promise((r) => setTimeout(r, 2000));
  if (!srv.killed) srv.kill('SIGKILL');
}
