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

try {
  await waitHealth();
  console.log('=== L2 Testing: SSE Event Stream (/api/gateway/stream) ===\n');

  // Open SSE client
  const sseEvents = [];
  const sseReq = http.request(
    `http://127.0.0.1:${PORT}/api/gateway/stream`,
    {
      method: 'GET',
      headers: {
        Accept: 'text/event-stream',
      },
    },
    (res) => {
      console.log(`SSE connected! Status: ${res.statusCode}, Content-Type: ${res.headers['content-type']}`);
      let buffer = '';
      res.on('data', (chunk) => {
        buffer += chunk.toString('utf8');
        const lines = buffer.split(/\r?\n\r?\n/);
        buffer = lines.pop() || '';
        for (const block of lines) {
          if (!block.trim()) continue;
          for (const line of block.split(/\r?\n/)) {
            if (line.startsWith('data: ')) {
              try {
                const parsed = JSON.parse(line.slice(6));
                sseEvents.push({ ts: new Date().toISOString(), event: parsed.type, data: parsed });
                console.log(`[SSE EVENT] type=${parsed.type} runId=${parsed.run?.runId || '-'}`);
              } catch {
                sseEvents.push({ ts: new Date().toISOString(), raw: line });
              }
            }
          }
        }
      });
    },
  );
  sseReq.on('error', (e) => console.error('SSE connection error:', e));
  sseReq.end();

  // Wait 1s for initial gateway_snapshot
  await new Promise((r) => setTimeout(r, 1000));

  // Trigger a fast send using antigravity with flash_lite (or zcode)
  console.log('\nTriggering prompt via POST /api/gateway/send...');
  const sendRes = await httpPost('/api/gateway/send', {
    channel: 'antigravity',
    sessionName: 'probe-l2a-sse-test',
    prompt: '请只回复四个字：测试成功，不要调用任何工具',
    model: 'flash_lite',
    wait: true,
    timeoutMs: 40000,
  });

  console.log('Send completed. Status:', sendRes.status, 'OK:', sendRes.data?.ok, 'Reply:', sendRes.data?.reply);

  // Wait 1s for trailing events
  await new Promise((r) => setTimeout(r, 1500));

  sseReq.destroy();

  console.log('\nTotal SSE events captured:', sseEvents.length);
  const types = sseEvents.map((e) => e.event || 'unknown');
  console.log('Event types sequence:', types);

  const hasSnapshot = types.includes('gateway_snapshot');
  const hasRunStart = types.includes('run_start');
  const hasRunDone = types.includes('run_done');
  console.log(`Summary: gateway_snapshot=${hasSnapshot}, run_start=${hasRunStart}, run_done=${hasRunDone}`);

  fs.writeFileSync(
    'channels/probe/scripts/L2/evidence_stream_sse.json',
    JSON.stringify({ sendRes, sseEventsSummary: { total: sseEvents.length, types }, sseEvents: sseEvents.slice(0, 20) }, null, 2),
    'utf8',
  );
  console.log('Saved evidence to channels/probe/scripts/L2/evidence_stream_sse.json');

} catch (e) {
  console.error('Error during SSE test:', e);
} finally {
  srv.kill('SIGINT');
  await new Promise((r) => setTimeout(r, 2000));
  if (!srv.killed) srv.kill('SIGKILL');
}
