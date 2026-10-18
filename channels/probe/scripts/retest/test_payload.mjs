import { spawn, execSync } from 'node:child_process';

const PORT = 44226;
const BASE = `http://127.0.0.1:${PORT}`;

async function test() {
  const server = spawn('cmd.exe', ['/c', 'opencode', 'serve', '--port', String(PORT), '--hostname', '127.0.0.1'], {
    stdio: ['ignore', 'pipe', 'pipe']
  });

  for (let i = 0; i < 20; i++) {
    await new Promise(r => setTimeout(r, 300));
    try {
      const res = await fetch(`${BASE}/global/health`);
      if (res.ok) break;
    } catch (e) {}
  }

  try {
    const docRes = await fetch(`${BASE}/doc`);
    const doc = await docRes.json();
    console.log('PromptInput schema:');
    console.log(JSON.stringify(doc.components?.schemas?.PromptInput || doc.components?.schemas, null, 2).slice(0, 800));
    // Also check the path schema for prompt
    const promptPath = doc.paths['/api/session/{sessionID}/prompt'] || doc.paths['/api/session/{id}/prompt'];
    console.log('Prompt path schema:', JSON.stringify(promptPath, null, 2).slice(0, 800));
  } finally {
    try { execSync(`taskkill /F /T /PID ${server.pid}`, { stdio: 'ignore' }); } catch (e) {}
    try { execSync('taskkill /F /IM opencode.exe', { stdio: 'ignore' }); } catch (e) {}
    process.exit(0);
  }
}

test();
