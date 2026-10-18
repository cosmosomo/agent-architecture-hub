import { spawn } from 'node:child_process';
import http from 'node:http';

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

async function waitHealth(maxMs = 60000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    try {
      const res = await new Promise((res, rej) => {
        http.get(`http://127.0.0.1:${PORT}/api/health`, (r) => {
          let b = '';
          r.on('data', (c) => (b += c));
          r.on('end', () => res(JSON.parse(b)));
        }).on('error', rej);
      });
      if (res?.ok) return res;
    } catch {}
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error('Timeout waiting for health');
}

try {
  await waitHealth();
  console.log('Testing Codex with advertised model gpt-5.5...');
  const sessionName = 'probe-l2a-codex-v2';
  const token = 'SEC_CODEX_883192';

  console.log('Codex Turn 1...');
  const res1 = await httpPost('/api/gateway/send', {
    channel: 'codex',
    sessionName,
    prompt: `请牢记暗号：${token}，只回复两个字：收到。不要调用任何工具。`,
    model: 'gpt-5.5',
    wait: true,
    timeoutMs: 90000,
  });
  console.log('Turn 1 result:', res1.status, res1.data?.ok, res1.data?.reply, res1.data?.error);

  console.log('Codex Turn 2...');
  const res2 = await httpPost('/api/gateway/send', {
    channel: 'codex',
    sessionName,
    prompt: `上一轮我告诉你的暗号是什么？请只完整回复该暗号本身。`,
    model: 'gpt-5.5',
    wait: true,
    timeoutMs: 90000,
  });
  console.log('Turn 2 result:', res2.status, res2.data?.ok, res2.data?.reply, res2.data?.error);
} catch (e) {
  console.error('Error:', e);
} finally {
  srv.kill('SIGINT');
  await new Promise((r) => setTimeout(r, 2000));
  if (!srv.killed) srv.kill('SIGKILL');
}
