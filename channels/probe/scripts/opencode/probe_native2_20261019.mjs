import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const PORT = 18933;
const BASE = `http://127.0.0.1:${PORT}`;
const SID = 'ses_eafc38fb7ffeN7Z2BMQEuTJbnV';
const out = {};
const log = (k, v) => { out[k] = v; writeFileSync(import.meta.dirname + '/probe_native_20261019_results2.json', JSON.stringify(out, null, 2)); console.log(`[${k}]`, JSON.stringify(v).slice(0, 400)); };
const j = async (method, path, body) => {
  const res = await fetch(BASE + path, { method, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  let data; try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, data };
};

const server = spawn('cmd.exe', ['/c', 'opencode', 'serve', '--port', String(PORT), '--hostname', '127.0.0.1'], { cwd: 'C:\\Users\\COLORFIRE\\AppData\\Local\\Temp\\opencode\\probe-oc-native-1019', stdio: ['ignore', 'ignore', 'ignore'] });
for (let i = 0; i < 30; i++) { await new Promise(r => setTimeout(r, 1000)); try { if ((await j('GET', '/global/health')).status === 200) break; } catch {} }

// wait: idle → should return fast with status
{
  const t0 = Date.now();
  const r = await j('GET', `/api/session/${SID}/wait?timeout=3000`);
  log('wait-idle', { status: r.status, ms: Date.now() - t0, body: JSON.stringify(r.data).slice(0, 150) });
}

// wait: busy → should block until done or timeout
{
  const p = await j('POST', `/session/${SID}/prompt_async`, { parts: [{ type: 'text', text: '只回复两个字：收到' }], model: { providerID: 'zhipuai-coding-plan', modelID: 'glm-5.3-flash' } });
  log('busy-prompt', { status: p.status });
  const t0 = Date.now();
  const r = await j('GET', `/api/session/${SID}/wait?timeout=60000`);
  log('wait-busy-block', { status: r.status, ms: Date.now() - t0, body: JSON.stringify(r.data).slice(0, 200) });
}

// fork with messageID
{
  const msgs = await j('GET', `/session/${SID}/message`);
  const lastUser = (msgs.data || []).filter(x => x.info?.role === 'user').slice(-1)[0];
  const r = await j('POST', `/session/${SID}/fork`, { messageID: lastUser?.info?.id, title: 'probe-oc-native-fork' });
  log('fork', { status: r.status, id: r.data?.id, parentID: r.data?.parentID, title: r.data?.title });
  if (r.data?.id) {
    const c = await j('GET', `/session/${SID}/children`);
    log('fork-children', { status: c.status, body: JSON.stringify(c.data).slice(0, 200) });
  }
}

// background via /api prefix
{
  const r = await j('GET', `/api/experimental/session/${SID}/background`);
  log('background-api', { status: r.status, body: JSON.stringify(r.data).slice(0, 200) });
}

// prompt_async as background task? check /api variant exists
{
  const r = await j('GET', '/api/experimental/capabilities');
  log('capabilities', { status: r.status, body: JSON.stringify(r.data).slice(0, 300) });
}

// share url verify
{
  const s = await j('GET', `/session/${SID}`);
  log('session-share-url', { share_url: s.data?.shareUrl || s.data?.share_url, revert: s.data?.revert, model: s.data?.model });
}

server.kill();
process.exit(0);
