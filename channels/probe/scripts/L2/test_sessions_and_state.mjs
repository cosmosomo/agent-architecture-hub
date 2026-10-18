import { spawn } from 'node:child_process';
import http from 'node:http';

const PORT = 8931;
const REPO_ROOT = 'E:\\program\\GIT\\Agent\\multi\\Agent-Architecture-Hub';

const srv = spawn('node', ['--no-warnings=ExperimentalWarning', 'trace/apps/cli/src/main.ts', 'serve', '--port', String(PORT)], {
  cwd: REPO_ROOT,
  stdio: ['ignore', 'pipe', 'pipe'],
  windowsHide: true,
});

function httpGet(path) {
  return new Promise((resolve, reject) => {
    http.get(`http://127.0.0.1:${PORT}${path}`, (res) => {
      let buf = '';
      res.on('data', (c) => (buf += c));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(buf), raw: buf });
        } catch {
          resolve({ status: res.statusCode, data: buf, raw: buf });
        }
      });
    }).on('error', reject);
  });
}

async function waitHealth(maxMs = 60000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    try {
      const res = await httpGet('/api/health');
      if (res.status === 200 && res.data?.ok) return res.data;
    } catch {}
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error('Timeout waiting for health');
}

try {
  await waitHealth();
  console.log('--- 1. Testing GET /api/gateway/state ---');
  const stateRes = await httpGet('/api/gateway/state');
  console.log('state status:', stateRes.status);
  console.log('channels reported:', stateRes.data.channels.map(c => ({
    id: c.id,
    status: c.status,
    activeRuns: c.activeRuns,
    currentModel: c.currentModel,
    capabilities: c.capabilities
  })));
  console.log('activeRuns:', stateRes.data.activeRuns.length);
  console.log('acpxSessions total:', stateRes.data.acpxSessions.length);
  const sampleByChannel = {};
  for (const s of stateRes.data.acpxSessions) {
    if (!sampleByChannel[s.channel]) sampleByChannel[s.channel] = s;
  }
  console.log('acpxSessions sample by channel:', Object.keys(sampleByChannel).map(ch => ({
    channel: ch,
    sessionName: sampleByChannel[ch].sessionName,
    traceSessionId: sampleByChannel[ch].traceSessionId,
    acpxRecordId: sampleByChannel[ch].acpxRecordId
  })));

  console.log('\n--- 2. Testing GET /api/sessions ---');
  const sessListRes = await httpGet('/api/sessions?limit=50');
  console.log('sessions totalCount:', sessListRes.data.totalCount);
  console.log('sessions channelCounts:', sessListRes.data.channelCounts);
  
  // Find sample sessions of different types: native vs acpx
  const prefixCounts = {};
  for (const s of sessListRes.data.sessions) {
    const prefix = s.id.split(':')[0];
    prefixCounts[prefix] = (prefixCounts[prefix] || 0) + 1;
  }
  console.log('Session ID prefix breakdown in first 50:', prefixCounts);

  // Test GET /api/sessions/<id> on various session types
  console.log('\n--- 3. Testing GET /api/sessions/<id> ---');
  const testIds = [];
  for (const s of sessListRes.data.sessions) {
    const p = s.id.split(':')[0];
    if (!testIds.some(x => x.startsWith(p + ':'))) {
      testIds.push(s.id);
    }
  }
  console.log('Sample IDs to query:', testIds);
  for (const id of testIds) {
    const dRes = await httpGet(`/api/sessions/${encodeURIComponent(id)}?limit=1`);
    console.log(`GET /api/sessions/${id} -> status: ${dRes.status}, title: ${dRes.data?.title?.slice(0, 40)}, turns: ${dRes.data?.turns?.length}, state:`, dRes.data?.state);
  }

} catch (e) {
  console.error('Error during test:', e);
} finally {
  srv.kill('SIGINT');
  await new Promise((r) => setTimeout(r, 2000));
  if (!srv.killed) srv.kill('SIGKILL');
}
