import { spawn } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';

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

const FAMILIES = ['codex', 'claude', 'zcode', 'workbuddy', 'opencode', 'antigravity', 'hermes'];

try {
  await waitHealth();
  console.log('=== L2 Testing: Sessions & State API ===\n');

  // 1. State API test
  const stateRes = await httpGet('/api/gateway/state');
  const stateData = stateRes.data;
  console.log('--- 1. Gateway State Check ---');
  const stateResults = {};
  for (const ch of FAMILIES) {
    const p = stateData.channels.find((c) => c.id === ch);
    stateResults[ch] = {
      found: Boolean(p),
      status: p?.status,
      activeRuns: p?.activeRuns,
      queuedCount: p?.queuedCount,
      currentModel: p?.currentModel,
      canSendPrompt: p?.capabilities?.canSendPrompt,
      sessionCountInState: p?.sessions?.length,
    };
  }
  console.log('Channel State Matrix:', JSON.stringify(stateResults, null, 2));

  // 2. GET /api/sessions check
  console.log('\n--- 2. GET /api/sessions Check ---');
  const allSessionsRes = await httpGet('/api/sessions');
  const allSessions = allSessionsRes.data.sessions || [];
  console.log(`Total sessions returned: ${allSessions.length}`);
  console.log('Channel counts header:', allSessionsRes.data.channelCounts);

  const familySessions = {};
  for (const fam of FAMILIES) {
    familySessions[fam] = {
      native: [],
      acpx: [],
      other: [],
    };
  }

  for (const s of allSessions) {
    const rawKind = String(s.source?.kind || s.channel || '').toLowerCase();
    let fam = rawKind === 'claude-code' ? 'claude' : rawKind === 'agy' ? 'antigravity' : rawKind;
    if (!familySessions[fam]) continue;

    const id = s.id;
    if (id.startsWith('acpx:')) {
      familySessions[fam].acpx.push(s);
    } else if (id.startsWith('new:')) {
      familySessions[fam].other.push(s);
    } else {
      familySessions[fam].native.push(s);
    }
  }

  const breakdown = {};
  for (const fam of FAMILIES) {
    breakdown[fam] = {
      nativeCount: familySessions[fam].native.length,
      acpxCount: familySessions[fam].acpx.length,
      otherCount: familySessions[fam].other.length,
      sampleNativeId: familySessions[fam].native[0]?.id || null,
      sampleAcpxId: familySessions[fam].acpx[0]?.id || null,
    };
  }
  console.log('Session Separation Breakdown (Native vs acpx):', JSON.stringify(breakdown, null, 2));

  // 3. GET /api/sessions/<id> check for each family
  console.log('\n--- 3. Detail Query: GET /api/sessions/<id> ---');
  const detailResults = {};
  for (const fam of FAMILIES) {
    const nativeSample = breakdown[fam].sampleNativeId;
    const acpxSample = breakdown[fam].sampleAcpxId;
    detailResults[fam] = {};

    if (nativeSample) {
      const res = await httpGet(`/api/sessions/${encodeURIComponent(nativeSample)}?limit=1`);
      detailResults[fam].native = {
        id: nativeSample,
        httpStatus: res.status,
        contractOk: res.data?.contract === '0.2',
        title: res.data?.session?.title || null,
        turnsCount: res.data?.session?.turns?.length,
        state: res.data?.session?.state,
      };
    } else {
      detailResults[fam].native = { note: 'No native session found in store' };
    }

    if (acpxSample) {
      const res = await httpGet(`/api/sessions/${encodeURIComponent(acpxSample)}?limit=1`);
      detailResults[fam].acpx = {
        id: acpxSample,
        httpStatus: res.status,
        contractOk: res.data?.contract === '0.2',
        title: res.data?.session?.title || null,
        turnsCount: res.data?.session?.turns?.length,
        state: res.data?.session?.state,
      };
    } else {
      detailResults[fam].acpx = { note: 'No acpx session found in store' };
    }
  }
  console.log('Session Detail Resolution Results:', JSON.stringify(detailResults, null, 2));

  // Save raw evidence
  fs.writeFileSync(
    'channels/probe/scripts/L2/evidence_sessions_state.json',
    JSON.stringify({ stateResults, breakdown, detailResults }, null, 2),
    'utf8',
  );
  console.log('\nSaved evidence to channels/probe/scripts/L2/evidence_sessions_state.json');

} catch (e) {
  console.error('Error during test:', e);
} finally {
  srv.kill('SIGINT');
  await new Promise((r) => setTimeout(r, 2000));
  if (!srv.killed) srv.kill('SIGKILL');
}
