import { spawn } from 'node:child_process';

const PROXY_ENV = {
  ...process.env,
  HTTP_PROXY: 'http://127.0.0.1:7892',
  HTTPS_PROXY: 'http://127.0.0.1:7892',
  http_proxy: 'http://127.0.0.1:7892',
  https_proxy: 'http://127.0.0.1:7892',
};

const PORT = 44210;
const BASE = `http://127.0.0.1:${PORT}`;

async function main() {
  console.log(`Starting opencode serve on ${PORT}...`);
  const server = spawn('cmd.exe', ['/c', 'opencode', 'serve', '--port', String(PORT), '--hostname', '127.0.0.1'], {
    env: PROXY_ENV,
    stdio: ['ignore', 'pipe', 'pipe']
  });

  try {
    let ok = false;
    for (let i = 0; i < 20; i++) {
      await new Promise(r => setTimeout(r, 400));
      try {
        const res = await fetch(`${BASE}/global/health`);
        if (res.ok) {
          ok = true;
          break;
        }
      } catch (e) {}
    }

    if (!ok) {
      console.log('Failed to start server');
      return;
    }

    console.log('Server is up! Fetching /doc...');
    const docRes = await fetch(`${BASE}/doc`);
    const doc = await docRes.json();
    console.log('All API Paths:');
    for (const p of Object.keys(doc.paths).sort()) {
      const methods = Object.keys(doc.paths[p]).map(m => m.toUpperCase()).join(',');
      console.log(`  ${methods} ${p}`);
    }

    // Inspect some key paths details
    const targetPaths = [
      '/session',
      '/session/{id}',
      '/api/session/{id}',
      '/api/session/{id}/prompt',
      '/api/session/{id}/compact',
      '/api/session/{id}/permission',
      '/api/session/{id}/model',
      '/api/session/{id}/agent',
      '/api/model'
    ];

    for (const tp of targetPaths) {
      if (doc.paths[tp]) {
        console.log(`\n--- Schema for ${tp} ---`);
        console.log(JSON.stringify(doc.paths[tp], null, 2).slice(0, 800));
      }
    }

  } finally {
    server.kill();
    console.log('Server killed.');
  }
}

main().catch(console.error);
