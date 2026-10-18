import { spawn } from 'node:child_process';

const env = {
  ...process.env,
  HTTP_PROXY: 'http://127.0.0.1:7892',
  HTTPS_PROXY: 'http://127.0.0.1:7892',
};

const PORT = 44201;
const server = spawn('cmd.exe', ['/c', 'opencode', 'serve', '--port', String(PORT), '--hostname', '127.0.0.1'], {
  env,
  stdio: ['ignore', 'pipe', 'pipe']
});

async function getDoc() {
  await new Promise(r => setTimeout(r, 3000));
  try {
    const res = await fetch(`http://127.0.0.1:${PORT}/doc`);
    const data = await res.json();
    console.log('Available API paths:');
    console.log(Object.keys(data.paths).sort());
  } catch (e) {
    console.error('Error fetching doc:', e.message);
  } finally {
    server.kill();
    process.exit(0);
  }
}

getDoc();
