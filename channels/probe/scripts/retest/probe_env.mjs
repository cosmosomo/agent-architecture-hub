import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const PROXY_ENV = {
  ...process.env,
  HTTP_PROXY: 'http://127.0.0.1:7892',
  HTTPS_PROXY: 'http://127.0.0.1:7892',
  http_proxy: 'http://127.0.0.1:7892',
  https_proxy: 'http://127.0.0.1:7892',
};

function runCmd(cmd, args, timeoutMs = 15000) {
  return new Promise((resolve) => {
    const start = Date.now();
    let stdout = '';
    let stderr = '';
    const cp = spawn(cmd, args, {
      env: PROXY_ENV,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: true,
    });
    cp.stdout.on('data', (d) => { stdout += d.toString(); });
    cp.stderr.on('data', (d) => { stderr += d.toString(); });
    const timer = setTimeout(() => {
      cp.kill();
      resolve({ code: -1, timedOut: true, stdout, stderr, ms: Date.now() - start });
    }, timeoutMs);
    cp.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code, timedOut: false, stdout, stderr, ms: Date.now() - start });
    });
  });
}

async function check() {
  console.log('1. Checking opencode version...');
  const v = await runCmd('opencode', ['--version']);
  console.log('opencode version:', v.stdout.trim() || v.stderr.trim());

  console.log('2. Checking opencode models (90s limit)...');
  const m = await runCmd('opencode', ['models'], 30000);
  console.log('opencode models code:', m.code, 'len:', m.stdout.length);
  // print first 50 lines or matching zhipu / free
  const lines = m.stdout.split('\n');
  const matched = lines.filter(l => l.includes('zhipu') || l.includes('glm') || l.includes('free') || l.includes('zai'));
  console.log('Matched models:\n', matched.slice(0, 20).join('\n'));

  console.log('3. Checking acpx version...');
  const av = await runCmd('acpx', ['--version']);
  console.log('acpx version:', av.stdout.trim() || av.stderr.trim());

  console.log('4. Checking @agentclientprotocol/sdk location...');
  const sdkPath = path.join(process.env.APPDATA || '', 'npm/node_modules/acpx/node_modules/@agentclientprotocol/sdk');
  console.log('SDK path exists?', fs.existsSync(sdkPath), sdkPath);

  // Check storage directory
  const home = process.env.USERPROFILE || process.env.HOME || '';
  const storageDir = path.join(home, '.local', 'share', 'opencode');
  console.log('Opencode storage dir exists?', fs.existsSync(storageDir), storageDir);
}

check().catch(console.error);
