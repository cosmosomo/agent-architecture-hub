import { spawn, execSync } from 'node:child_process';
import { Readable, Writable } from 'node:stream';
import path from 'node:path';

const CWD = 'E:\\program\\GIT\\Agent\\multi\\Agent-Architecture-Hub';
const ENV = {
  ...process.env,
  HTTP_PROXY: 'http://127.0.0.1:7892',
  HTTPS_PROXY: 'http://127.0.0.1:7892',
  http_proxy: 'http://127.0.0.1:7892',
  https_proxy: 'http://127.0.0.1:7892',
};

const sdkPath = path.join(process.env.APPDATA, 'npm', 'node_modules', 'acpx', 'node_modules', '@agentclientprotocol', 'sdk');
const { ClientSideConnection, ndJsonStream } = await import(`file:///${sdkPath.replace(/\\/g, '/')}/dist/acp.js`);

setTimeout(() => {
  console.error('TIMEOUT 20s');
  process.exit(1);
}, 20000);

async function main() {
  console.log('Spawning opencode acp...');
  const cp = spawn('cmd.exe', ['/c', 'opencode', 'acp'], {
    cwd: CWD,
    env: ENV,
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  cp.stderr.on('data', d => console.log('[stderr]', d.toString()));

  const clientHandler = {
    requestPermission: async req => ({ outcome: { outcome: 'approved' } }),
    sessionUpdate: async notice => console.log('[update]', JSON.stringify(notice).slice(0, 100)),
  };

  const stream = ndJsonStream(Writable.toWeb(cp.stdin), Readable.toWeb(cp.stdout));
  const connection = new ClientSideConnection(() => clientHandler, stream);

  console.log('Calling initialize...');
  const initRes = await connection.initialize({
    protocolVersion: 1,
    clientCapabilities: {
      fs: { readTextFile: true, writeTextFile: true },
      terminal: true,
    },
    clientInfo: { name: 'probe-l1a', version: '1.0.0' },
  });
  console.log('initialize result:', JSON.stringify(initRes, null, 2));

  console.log('Calling session/new...');
  const newRes = await connection.newSession({
    cwd: CWD,
    mcpServers: [],
  });
  console.log('session/new result:', JSON.stringify(newRes, null, 2));

  try { execSync(`taskkill /F /T /PID ${cp.pid}`, { stdio: 'ignore' }); } catch (e) {}
  try { execSync('taskkill /F /IM opencode.exe', { stdio: 'ignore' }); } catch (e) {}
  process.exit(0);
}

main().catch(err => {
  console.error('Handshake error:', err);
  process.exit(1);
});
