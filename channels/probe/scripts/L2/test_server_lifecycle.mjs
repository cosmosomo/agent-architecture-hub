import { spawn } from 'node:child_process';
import http from 'node:http';

const PORT = 8931;
const REPO_ROOT = 'E:\\program\\GIT\\Agent\\multi\\Agent-Architecture-Hub';

console.log('Spawning gateway server on port', PORT);
const srv = spawn('node', ['--no-warnings=ExperimentalWarning', 'trace/apps/cli/src/main.ts', 'serve', '--port', String(PORT)], {
  cwd: REPO_ROOT,
  stdio: ['ignore', 'pipe', 'pipe'],
  windowsHide: true,
});

srv.stdout.on('data', (d) => process.stdout.write('[SRV OUT] ' + d.toString()));
srv.stderr.on('data', (d) => process.stderr.write('[SRV ERR] ' + d.toString()));

function waitHealth(maxMs = 60000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const iv = setInterval(() => {
      if (Date.now() - start > maxMs) {
        clearInterval(iv);
        return reject(new Error('Timeout waiting for health'));
      }
      http.get(`http://127.0.0.1:${PORT}/api/health`, (res) => {
        let buf = '';
        res.on('data', (c) => (buf += c));
        res.on('end', () => {
          if (res.statusCode === 200) {
            clearInterval(iv);
            try {
              resolve(JSON.parse(buf));
            } catch (e) {
              resolve(buf);
            }
          }
        });
      }).on('error', () => {
        // still starting
      });
    }, 1000);
  });
}

try {
  const health = await waitHealth();
  console.log('Health check passed:', JSON.stringify(health));
} catch (e) {
  console.error('Failed to get health:', e);
} finally {
  console.log('Killing server...');
  srv.kill('SIGINT');
  await new Promise((r) => setTimeout(r, 2000));
  if (!srv.killed) srv.kill('SIGKILL');
  console.log('Server killed');
}
