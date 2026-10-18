import { spawn } from 'node:child_process';

const env = {
  ...process.env,
  HTTP_PROXY: 'http://127.0.0.1:7892',
  HTTPS_PROXY: 'http://127.0.0.1:7892',
  http_proxy: 'http://127.0.0.1:7892',
  https_proxy: 'http://127.0.0.1:7892'
};

const PORT = 44199;
console.log(`Starting opencode serve on port ${PORT}...`);
const server = spawn('cmd.exe', ['/c', 'opencode', 'serve', '--port', String(PORT), '--hostname', '127.0.0.1'], {
  env,
  stdio: ['ignore', 'pipe', 'pipe']
});

server.stdout.on('data', d => console.log('[Serve stdout]:', d.toString()));
server.stderr.on('data', d => console.error('[Serve stderr]:', d.toString()));

async function probe() {
  await new Promise(r => setTimeout(r, 4000));
  const endpoints = ['/', '/api', '/health', '/session', '/sessions', '/models', '/doc', '/openapi.json'];
  for (const ep of endpoints) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}${ep}`);
      console.log(`Probe ${ep}: status=${res.status}, text=${(await res.text()).slice(0, 150)}`);
    } catch (e) {
      console.log(`Probe ${ep} error:`, e.message);
    }
  }
  server.kill();
  process.exit(0);
}

probe();
