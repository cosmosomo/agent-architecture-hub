// probe_ask_serve_20261019.mjs — research-acp (ZCode)
// 验证：OpenCode 1.18.33 `opencode serve` HTTP 面上，build agent 能否调 question 工具
// 向人提问、外部经 HTTP 答题、答案是否回到同一轮。
import { spawn, execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';

const PORT = 18934;
const BASE = `http://127.0.0.1:${PORT}`;
const MODEL = { providerID: 'zhipuai-coding-plan', modelID: 'glm-5.3-flash' };
const CWD = 'C:\\Users\\COLORFIRE\\AppData\\Local\\Temp\\opencode\\probe-oc-ask-1019';
mkdirSync(CWD, { recursive: true });

const out = {};
const log = (k, v) => { out[k] = v; writeFileSync(import.meta.dirname + '/probe_ask_serve_20261019_results.json', JSON.stringify(out, null, 2)); console.log(`[${k}]`, JSON.stringify(v).slice(0, 500)); };
const j = async (method, path, body) => {
  const res = await fetch(BASE + path, { method, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  let data; try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, data };
};

const server = spawn('cmd.exe', ['/c', 'opencode', 'serve', '--port', String(PORT), '--hostname', '127.0.0.1'], { cwd: CWD, stdio: ['ignore', 'ignore', 'pipe'] });
const CMD_PID = server.pid;
let stderr = '';
server.stderr.on('data', d => { stderr += d; });
const killTree = () => { try { execSync(`taskkill /PID ${CMD_PID} /T /F`, { stdio: 'ignore' }); } catch {} };
process.on('exit', killTree);

// wait for health
let up = false;
for (let i = 0; i < 30; i++) {
  await new Promise(r => setTimeout(r, 1000));
  try { const h = await j('GET', '/global/health'); if (h.status === 200) { up = true; break; } } catch {}
}
log('serve-up', { up });

// SSE listener for question events
const events = [];
const ac = new AbortController();
const sse = fetch(BASE + '/event', { signal: ac.signal }).then(r => {
  const reader = r.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  (async () => {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let idx;
      while ((idx = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, idx).trim(); buf = buf.slice(idx + 1);
        if (!line.startsWith('data:')) continue;
        try { events.push(JSON.parse(line.slice(5).trim())); } catch {}
      }
    }
  })().catch(() => {});
}).catch(() => {});

// 0. /doc question paths
{
  const d = await j('GET', '/doc');
  const paths = Object.keys(d.data?.paths || {}).filter(p => /question/i.test(p));
  log('doc-question-paths', paths.map(p => ({ path: p, methods: Object.keys(d.data.paths[p]) })));
}

// 1. create session
const s = await j('POST', '/session', { title: 'probe-oc-ask-1019' });
const SID = s.data?.id;
log('session', { status: s.status, id: SID });

// 2. ask the model to explicitly call the question tool
const p = await j('POST', `/session/${SID}/prompt_async`, {
  parts: [{ type: 'text', text: '请立即调用 question 工具（如果你有这个工具），问我一个问题："苹果还是香蕉？"，选项两个：苹果、香蕉。不要用文字问，必须用工具。' }],
  model: MODEL,
});
log('prompt-async', { status: p.status });

// 3. poll pending questions up to 90s
let pending = null;
for (let i = 0; i < 45; i++) {
  await new Promise(r => setTimeout(r, 2000));
  const q = await j('GET', '/question');
  const list = Array.isArray(q.data) ? q.data : (q.data?.questions || q.data?.pending || []);
  if (q.status === 200 && list.length > 0) { pending = { raw: q.data }; break; }
  const qEvents = events.filter(e => /question/i.test(e.type || ''));
  if (qEvents.length > 0) { pending = { fromEvent: qEvents }; break; }
}
log('pending', pending || { none: true, eventTypes: [...new Set(events.map(e => e.type))].slice(0, 40) });

// 4. answer via reply endpoint if pending found
if (pending) {
  const qid = pending.raw?.[0]?.id || pending.fromEvent?.[0]?.properties?.id || pending.fromEvent?.[0]?.id;
  if (qid) {
    const rep = await j('POST', `/question/${qid}/reply`, { answers: [['香蕉']] });
    log('reply', { status: rep.status, body: JSON.stringify(rep.data).slice(0, 200) });
  } else {
    log('reply', { skipped: 'no question id parsed', pending });
  }
}

// 5. wait for turn completion and check same-turn continuation
let finalText = '', toolParts = [];
for (let i = 0; i < 60; i++) {
  await new Promise(r => setTimeout(r, 2000));
  const msgs = await j('GET', `/session/${SID}/message`);
  const assistants = (msgs.data || []).filter(x => x.info?.role === 'assistant' && x.info?.time?.completed);
  if (assistants.length >= 1) {
    const last = assistants.slice(-1)[0];
    finalText = (last.parts || []).filter(pp => pp.type === 'text').map(pp => pp.text).join(' ');
    toolParts = (last.parts || []).filter(pp => pp.type === 'tool' || pp.tool).map(pp => ({ tool: pp.tool, state: pp.state?.status, title: pp.state?.title }));
    const qTool = JSON.stringify(last.parts || []).includes('"question"');
    if (qTool && finalText) { log('final', { text: String(finalText).slice(0, 400), toolParts }); break; }
    if (assistants.length >= 1 && i > 20 && finalText) { log('final-partial', { text: String(finalText).slice(0, 400), toolParts }); break; }
  }
  if (i === 59) log('final', { timeout: true, msgCount: (msgs.data || []).length });
}

ac.abort();
killTree();
process.exit(0);
