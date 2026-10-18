import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

const REPO_ROOT = 'E:\\program\\GIT\\Agent\\multi\\Agent-Architecture-Hub';
const PORT = 8932;

console.log('Testing server startup on port', PORT);
const proc = spawn('node', ['--no-warnings=ExperimentalWarning', 'trace/apps/cli/src/main.ts', 'serve', '--port', String(PORT)], {
  cwd: REPO_ROOT,
  stdio: ['ignore', 'pipe', 'pipe'],
  windowsHide: true,
});

proc.stdout.on('data', (d) => process.stdout.write(`[SERVER OUT] ${d}`));
proc.stderr.on('data', (d) => process.stderr.write(`[SERVER ERR] ${d}`));

async function waitHealth(maxRetries = 40) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/api/health`);
      if (res.ok) {
        const json = await res.json();
        console.log('Health response:', json);
        return json;
      }
    } catch (e) {
      // wait
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error('Health check timeout');
}

try {
  const h = await waitHealth();
  console.log('Server is healthy! Scanning status:', h.scanning);
} finally {
  console.log('Shutting down test server...');
  proc.kill('SIGTERM');
  await new Promise((r) => setTimeout(r, 1000));
  try { proc.kill('SIGKILL'); } catch {}
  console.log('Server killed.');
}
