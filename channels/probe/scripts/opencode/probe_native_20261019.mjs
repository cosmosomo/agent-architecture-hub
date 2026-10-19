import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const PORT = 18933;
const BASE = `http://127.0.0.1:${PORT}`;
const MODEL = 'zhipuai-coding-plan/glm-5.3-flash';
const CWD = 'C:\\Users\\COLORFIRE\\AppData\\Local\\Temp\\opencode\\probe-oc-native-1019';

const out = {};
const log = (k, v) => { out[k] = v; writeFileSync(import.meta.dirname + '/probe_native_20261019_results.json', JSON.stringify(out, null, 2)); console.log(`[${k}]`, JSON.stringify(v).slice(0, 400)); };
const j = async (method, path, body) => {
  const res = await fetch(BASE + path, { method, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  let data; try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, data };
};

const server = spawn('cmd.exe', ['/c', 'opencode', 'serve', '--port', String(PORT), '--hostname', '127.0.0.1', '--print-logs'], { cwd: CWD, stdio: ['ignore', 'ignore', 'pipe'] });
let stderr = '';
server.stderr.on('data', d => stderr += d);

// wait for health
for (let i = 0; i < 30; i++) {
  await new Promise(r => setTimeout(r, 1000));
  try { const h = await j('GET', '/global/health'); if (h.status === 200) break; } catch {}
}

// 1. open-idle: POST /session without prompt
{
  const r = await j('POST', '/session', { title: 'probe-oc-native-idle' });
  log('open-idle', { status: r.status, id: r.data?.id, title: r.data?.title });
  var SID = r.data?.id;
}

// 2. inject-next: POST /session/{id}/message while idle (no run in progress)
{
  const r = await j('POST', `/session/${SID}/message`, { parts: [{ type: 'text', text: '请记住暗号 NATIVE_4471，回复已记住。' }], model: { providerID: 'zhipuai-coding-plan', modelID: 'glm-5.3-flash' } });
  log('inject-next-post', { status: r.status, keys: Object.keys(r.data || {}) });
  // wait for the run to finish
  for (let i = 0; i < 60; i++) {
    await new Promise(r2 => setTimeout(r2, 2000));
    const st = await j('GET', `/session/${SID}/wait?timeout=2000`).catch(() => null);
    const msgs = await j('GET', `/session/${SID}/message`);
    const last = (msgs.data || []).slice(-1)[0];
    if (last && last.info?.role === 'assistant' && last.info?.time?.completed) { log('inject-next-result', { role: last.info.role, completed: last.info.time, text: JSON.stringify(last.parts?.filter(p => p.type === 'text').map(p => p.text)).slice(0, 200) }); break; }
    if (i === 59) log('inject-next-result', { timeout: true, msgCount: (msgs.data || []).length });
  }
}

// 3. model-switch: POST /session/{id}/model then read back
{
  const r = await j('POST', `/session/${SID}/model`, { providerID: 'zhipuai-coding-plan', modelID: 'glm-5.3-flash' });
  const s = await j('GET', `/session/${SID}`);
  log('model-switch', { status: r.status, sessionModel: s.data?.model });
}

// 4. steer: prompt_async long task, mid-run POST /message
{
  const p = await j('POST', `/session/${SID}/prompt_async`, { parts: [{ type: 'text', text: '从 1 数到 20，每个数字单独一行，不要省略。' }], model: { providerID: 'zhipuai-coding-plan', modelID: 'glm-5.3-flash' } });
  log('steer-prompt-async', { status: p.status });
  await new Promise(r => setTimeout(r, 3000));
  const mid = await j('GET', '/session/status');
  log('steer-status-mid', { busy: JSON.stringify(mid.data).slice(0, 200) });
  const m = await j('POST', `/session/${SID}/message`, { parts: [{ type: 'text', text: '提醒：数完后把最后一个数字乘以 2 报出来。' }], model: { providerID: 'zhipuai-coding-plan', modelID: 'glm-5.3-flash' } });
  log('steer-mid-message', { status: m.status, body: JSON.stringify(m.data).slice(0, 150) });
  let finalText = '';
  for (let i = 0; i < 60; i++) {
    await new Promise(r => setTimeout(r, 2000));
    await j('GET', `/session/${SID}/wait?timeout=2000`).catch(() => null);
    const msgs = await j('GET', `/session/${SID}/message`);
    const assistants = (msgs.data || []).filter(x => x.info?.role === 'assistant' && x.info?.time?.completed);
    if (assistants.length >= 2) {
      finalText = assistants.slice(-1)[0].parts?.filter(pp => pp.type === 'text').map(pp => pp.text).join(' ');
      log('steer-result', { assistantMsgs: assistants.length, text: String(finalText).slice(0, 300) });
      break;
    }
    if (i === 59) log('steer-result', { timeout: true });
  }
}

// 5. rewind: revert stage on last message
{
  const msgs = await j('GET', `/session/${SID}/message`);
  const last = (msgs.data || []).slice(-1)[0];
  const r = await j('POST', `/session/${SID}/revert/stage`, { messageID: last?.info?.id });
  const s = await j('GET', `/session/${SID}`);
  log('rewind-stage', { status: r.status, revert: s.data?.revert });
  const c = await j('POST', `/session/${SID}/revert/clear`, {});
  const s2 = await j('GET', `/session/${SID}`);
  log('rewind-clear', { status: c.status, revert: s2.data?.revert });
}

// 6. wake-stall: GET /session/{id}/wait with timeout on idle session
{
  const t0 = Date.now();
  const r = await j('GET', `/session/${SID}/wait?timeout=3000`);
  log('wake-stall-wait', { status: r.status, ms: Date.now() - t0, body: JSON.stringify(r.data).slice(0, 120) });
}

// 7. fork: POST /session/{id}/fork
{
  const r = await j('POST', `/session/${SID}/fork`, { messageID: null, title: 'probe-oc-native-fork' });
  log('fork-native-http', { status: r.status, id: r.data?.id, parent: r.data?.parentID });
}

// 8. background: experimental background endpoint
{
  const r = await j('GET', `/experimental/session/${SID}/background`);
  log('background-list', { status: r.status, body: JSON.stringify(r.data).slice(0, 150) });
}

// 9. archive: check DELETE /session/{id}? no — check session list for time_archived semantics; use a throwaway session
{
  const tmp = await j('POST', '/session', { title: 'probe-oc-native-tmp' });
  const d = await j('DELETE', `/session/${tmp.data?.id}`);
  log('delete-session', { status: d.status });
}

// 10. share (handover/artifact)
{
  const r = await j('POST', `/session/${SID}/share`, {});
  log('share', { status: r.status, url: r.data?.url || JSON.stringify(r.data).slice(0, 120) });
}

// 11. question/permission endpoints exist: dry-check reply route with bogus id
{
  const q = await j('GET', '/question');
  const perm = await j('GET', '/api/permission/saved');
  log('question-permission-ep', { questionStatus: q.status, permStatus: perm.status, permBody: JSON.stringify(perm.data).slice(0, 100) });
}

// 12. compact + context + summarize
{
  const r = await j('POST', `/session/${SID}/summarize`, { providerID: 'zhipuai-coding-plan', modelID: 'glm-5.3-flash' });
  log('compact-summarize', { status: r.status, body: JSON.stringify(r.data).slice(0, 120) });
}

// 13. agent/skill/command listing (instructions, goal)
{
  const a = await j('GET', '/agent');
  log('agent-list-http', { status: a.status, names: (Array.isArray(a.data) ? a.data : []).map(x => x.name).slice(0, 12) });
  const sk = await j('GET', '/skill');
  log('skill-list-http', { status: sk.status, count: Array.isArray(sk.data) ? sk.data.length : JSON.stringify(sk.data).slice(0, 80) });
}

// 14. tui endpoints (handover-human: tui control from outside)
{
  const r = await j('POST', '/tui/append-prompt', { text: 'hello probe' });
  log('tui-append', { status: r.status, body: JSON.stringify(r.data).slice(0, 100) });
}

server.kill();
process.exit(0);
