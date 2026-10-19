import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const PORT = 18933;
const BASE = `http://127.0.0.1:${PORT}`;
const SID = 'ses_eafc38fb7ffeN7Z2BMQEuTJbnV';
const out = {};
const log = (k, v) => { out[k] = v; writeFileSync(import.meta.dirname + '/probe_native3_20261019_results.json', JSON.stringify(out, null, 2)); console.log(`[${k}]`, JSON.stringify(v).slice(0, 400)); };
const j = async (method, path, body) => {
  const res = await fetch(BASE + path, { method, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  let data; try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, data };
};

const server = spawn('cmd.exe', ['/c', 'opencode', 'serve', '--port', String(PORT), '--hostname', '127.0.0.1'], { cwd: 'C:\\Users\\COLORFIRE\\AppData\\Local\\Temp\\opencode\\probe-oc-native-1019', stdio: ['ignore', 'ignore', 'ignore'] });
for (let i = 0; i < 30; i++) { await new Promise(r => setTimeout(r, 1000)); try { if ((await j('GET', '/global/health')).status === 200) break; } catch {} }

const p = await j('POST', `/session/${SID}/prompt_async`, { parts: [{ type: 'text', text: '请立刻用 question 工具问我：“选 A 还是 B？”（选项 A、B）。拿到回答后只回复我的选择。' }], model: { providerID: 'zhipuai-coding-plan', modelID: 'glm-5.3-flash' } });
log('q-prompt', { status: p.status });

let reqID = null, asked = null;
const t0 = Date.now();
while (Date.now() - t0 < 90000 && !reqID) {
  await new Promise(r => setTimeout(r, 1500));
  const q = await j('GET', `/api/session/${SID}/question`);
  if (q.status === 200 && Array.isArray(q.data) && q.data.length) {
    const pend = q.data.filter(x => (x.status === 'pending') || !x.replied);
    if (pend.length) { reqID = pend[0].id; asked = pend[0]; }
  } else {
    // question pending may surface on the new-session list /session/status as ask type
    const st = await j('GET', '/session/status');
    const txt = JSON.stringify(st.data);
    if (txt.includes('"ask"')) log('q-status-hint', { txt: txt.slice(0, 200) });
  }
}
log('q-request', { found: !!reqID, reqID, asked: JSON.stringify(asked).slice(0, 400) });

if (reqID) {
  const rep = await j('POST', `/question/${reqID}/reply`, { answers: [['A']] });
  log('q-reply', { status: rep.status, body: JSON.stringify(rep.data).slice(0, 150) });
  const t1 = Date.now();
  while (Date.now() - t1 < 90000) {
    await new Promise(r => setTimeout(r, 2000));
    const msgs = await j('GET', `/session/${SID}/message`);
    if (msgs.status !== 200 || !Array.isArray(msgs.data)) continue;
    const assistants = (msgs.data || []).filter(x => x.info?.role === 'assistant' && x.info?.time?.completed);
    const last = assistants.slice(-1)[0];
    if (last && last.info.time.completed > t1) {
      log('q-result', { text: String(last.parts?.filter(pp => pp.type === 'text').map(pp => pp.text).join(' ')).slice(0, 200) });
      break;
    }
  }
}

server.kill();
process.exit(0);
