// L1a probe: try to speak ACP directly to the antigravity bridge that acpx's registry
// expects (`agy_acp_server.exe`, see acpx/dist/agent-registry-kHdpsK9F.js).
// Flow: spawn bridge -> initialize (record agentCapabilities verbatim) -> session/new
// (record modes/models verbatim) -> capability probes. Every step degrades to recording
// the raw spawn error, since the bridge binary is not shipped publicly.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const sdkPath = path.join(process.env.APPDATA, 'npm', 'node_modules', 'acpx', 'node_modules', '@agentclientprotocol', 'sdk');
const { ClientSideConnection, ndJsonStream } = await import(`file:///${sdkPath.replace(/\\/g, '/')}/dist/acp.js`);

const timeout = (ms) => new Promise((r) => setTimeout(r, ms));

const cp = spawn('agy_acp_server.exe', [], { stdio: ['pipe', 'pipe', 'pipe'] });
let spawnError = null;
cp.on('error', (e) => { spawnError = e; });
let stderrBuf = '';
cp.stderr.on('data', (d) => { stderrBuf += d.toString(); });

// give the spawn error event time to fire
await timeout(3000);
if (spawnError || !cp.pid) {
  console.log(JSON.stringify({
    step: 'spawn agy_acp_server.exe',
    ok: false,
    error: spawnError ? { code: spawnError.code, message: spawnError.message, syscall: spawnError.syscall, path: spawnError.path } : { pid: cp.pid },
    stderr: stderrBuf.trim(),
    registryBasis: 'acpx/dist/agent-registry-kHdpsK9F.js: antigravity argv = ["agy_acp_server.exe"] (win32)',
  }, null, 2));
  process.exit(1);
}

const clientHandler = {
  requestPermission: async (req) => {
    console.log('[requestPermission]', JSON.stringify(req));
    return { outcome: { outcome: 'approved' } };
  },
  sessionUpdate: async (notice) => console.log('[sessionUpdate]', JSON.stringify(notice.update ?? notice).slice(0, 400)),
};
const stream = ndJsonStream(cp.stdin, cp.stdout);
const conn = new ClientSideConnection(() => clientHandler, stream);

const init = await conn.initialize({ protocolVersion: 1, clientCapabilities: { fs: { readTextFile: true, writeTextFile: true }, terminal: true }, clientInfo: { name: 'probe-antigravity-l1a', version: '1.0.0' } });
console.log('=== initialize.agentCapabilities (verbatim) ===');
console.log(JSON.stringify(init.agentCapabilities ?? init, null, 2));

const s = await conn.newSession({ cwd: 'file:///E:/program/GIT/Agent/multi/Agent-Architecture-Hub', mcpServers: [] });
console.log('=== session/new (verbatim) ===');
console.log(JSON.stringify(s, null, 2));

for (const [label, fn] of [
  ['session/load (resume-native probe)', () => conn.loadSession({ sessionId: s.sessionId, cwd: 'file:///E:/', mcpServers: [] })],
  ['session/set_mode', () => conn.setSessionMode?.({ sessionId: s.sessionId, modeId: (s.modes?.availableModes?.[0] || {}).id })],
  ['session/set_model', () => conn.setSessionModel?.({ sessionId: s.sessionId, modelId: (s.models?.availableModels?.[0] || {}).id })],
]) {
  try { console.log(`=== ${label} ===\n`, JSON.stringify(await fn()).slice(0, 600)); }
  catch (e) { console.log(`=== ${label} ERROR ===\n`, e.message); }
}
cp.kill();
