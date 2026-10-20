// Self-check of the running system, layer by layer: the center (8899), each product, the task board, the data.
// It only reads; what is wrong comes with what to do about it. The boot script (hub_boot.ps1) runs it after it
// starts the center, so the last result is always in ~/.agent-hub/selfcheck.json for the page and other agents.
// User 10-20: “然后系统可以有一些自检功能，然后做成开机自启吧”.
//
//   node hub/tools/selfcheck.js            the check, one line each; exit 1 when something is broken
//   node hub/tools/selfcheck.js --json     the same as JSON
//   node hub/tools/selfcheck.js --full     also runs check_channels.js (the products' CLI fingerprints)
// HUB_DAEMON_URL picks another center (a side instance), as agent_gateway.js does.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const HUB_HOME = path.join(os.homedir(), '.agent-hub');
const BASE = (process.env.HUB_DAEMON_URL || 'http://127.0.0.1:8899').replace(/\/$/, '');
const PORT = Number(new URL(BASE).port || 8899);
const args = process.argv.slice(2);

const results = [];
/** ok: fine; warn: works, but someone should look; fail: broken. */
const add = (layer, name, level, detail, fix) => results.push({ layer, name, level, detail, fix: level === 'ok' ? undefined : fix });

async function get(url, timeoutMs = 5000) {
  const t0 = Date.now();
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    const text = await r.text();
    let body = null;
    try {
      body = JSON.parse(text);
    } catch {}
    return { status: r.status, body, ms: Date.now() - t0 };
  } catch (e) {
    return { status: 0, error: e.name === 'TimeoutError' ? `${timeoutMs / 1000} 秒没回` : e.cause?.code || e.message, ms: Date.now() - t0 };
  }
}
const ps = (script) => String(spawnSync('powershell.exe', ['-NoProfile', '-Command', script], { encoding: 'utf8', timeout: 15000, windowsHide: true }).stdout || '').trim();
const ago = (ms) => (ms < 3600_000 ? `${Math.round(ms / 60_000)} 分钟` : `${(ms / 3600_000).toFixed(1)} 小时`);
const hhmm = (d) => new Date(d).toLocaleTimeString('zh-CN', { hour12: false, hour: '2-digit', minute: '2-digit' });
/** How many files with this extension under dir changed after a time (node_modules and dot folders skipped). */
function changedSince(dir, ext, since) {
  let n = 0;
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (p.endsWith(ext) && fs.statSync(p).mtimeMs > since) n++;
    }
  };
  try {
    walk(dir);
  } catch {}
  return n;
}

async function center() {
  const L = '中心';
  const h = await get(`${BASE}/api/health`);
  if (h.status !== 200) {
    add(L, '8899 在不在', 'fail', `${BASE}/api/health 打不开：${h.error || 'HTTP ' + h.status}`, '起中心：powershell -File hub/tools/hub_boot.ps1（已在跑但卡住时加 -Restart，它会等手上的活跑完再重启）');
    return null;
  }
  add(L, '8899 在不在', 'ok', `在，/api/health ${h.ms} 毫秒，索引 ${h.body?.sessions ?? '?'} 个会话${h.body?.scanning ? '，正在扫描' : ''}`);
  const s = await get(`${BASE}/api/gateway/state`, 10000);
  if (s.status !== 200) add(L, '主线程', 'fail', `/api/gateway/state 打不开：${s.error || 'HTTP ' + s.status}`, '主线程可能卡住：先取栈（node --inspect 的 stack 采样）再重启');
  else add(L, '主线程', s.ms > 3000 ? 'warn' : 'ok', `/api/gateway/state ${s.ms} 毫秒`, '超过 3 秒说明主线程有重活，查 hub-8899.err.log 和最近改动');

  // The code it runs: started before the latest change to the center's source means a restart is due.
  if (PORT === 8899 || !process.env.HUB_DAEMON_URL) {
    const out = ps(`$p=(Get-NetTCPConnection -LocalPort ${PORT} -State Listen -ErrorAction SilentlyContinue).OwningProcess|select -First 1; if($p){$c=Get-CimInstance Win32_Process -Filter "ProcessId=$p"; "$p|$($c.CreationDate.ToString('o'))"}`);
    const [pid, started] = out.split('|');
    if (started) {
      const at = Date.parse(started);
      const n = changedSince(path.join(ROOT, 'trace'), '.ts', at);
      add(L, '跑的代码新不新', n ? 'warn' : 'ok', n ? `进程 ${pid} 在 ${hhmm(at)} 启动，之后 trace 里改过 ${n} 个 .ts 文件，没有载入` : `进程 ${pid} 在 ${hhmm(at)} 启动，之后中心代码没改过`, '空闲时重启：powershell -File hub/tools/hub_boot.ps1 -Restart');
      const err = path.join(HUB_HOME, `hub-${PORT}.err.log`);
      if (fs.existsSync(err) && fs.statSync(err).mtimeMs > at) {
        // Only what this process wrote (hub_boot.ps1 marks each start), by kind: stack frames out, ids and numbers
        // folded, so a thousand of one error reads as one line.
        const all = fs.readFileSync(err, 'utf8');
        const since = all.lastIndexOf('==== 启动 ');
        const kinds = {};
        for (const l of (since >= 0 ? all.slice(all.indexOf('\n', since) + 1) : all).split(/\r?\n/)) {
          if (!l.trim() || /^\s+at /.test(l)) continue;
          const k = l.replace(/[0-9a-f]{8}-[0-9a-f-]{27}/g, '<id>').replace(/\d+/g, 'N').slice(0, 120);
          kinds[k] = (kinds[k] || 0) + 1;
        }
        const top = Object.entries(kinds).sort((x, y) => y[1] - x[1]).slice(0, 3).map(([k, v]) => `${v} 次「${k}」`);
        if (!top.length) add(L, '错误日志', 'ok', '这次启动后错误日志没有新内容');
        else add(L, '错误日志', 'warn', `${since >= 0 ? '这次启动后' : '（没有启动标记，数的是整个文件）'}${path.basename(err)} 里：${top.join('；')}`, `看 ${err}`);
      } else add(L, '错误日志', 'ok', '启动后错误日志没有新内容');
    }
  }

  // EasyTier: the address other devices use (the user, 10-20: “先只用 EasyTier，不开放普通局域网”).
  const lanFile = path.join(HUB_HOME, 'lan-host');
  if (fs.existsSync(lanFile)) {
    const lan = fs.readFileSync(lanFile, 'utf8').trim();
    const r = await get(`http://${lan}:${PORT}/api/health`, 4000);
    // From this machine the address counts as another device, so 401 (no token) still proves it answers.
    if (r.status) add(L, 'EasyTier 地址', 'ok', `${lan}:${PORT} 能连上（HTTP ${r.status}）`);
    else add(L, 'EasyTier 地址', 'warn', `${lan}:${PORT} 连不上：${r.error}`, 'EasyTier 没起或没连上：打开 EasyTier 看网卡；本机 127.0.0.1 不受影响');
  }
  return s.body;
}

function blockedProducts() {
  const out = new Set();
  try {
    for (const r of JSON.parse(fs.readFileSync(path.join(ROOT, 'hub', 'data', 'products.json'), 'utf8')).products) {
      let card = '';
      try {
        card = fs.readFileSync(path.join(ROOT, 'channels', 'hosts', r.hostCard || ''), 'utf8');
      } catch {}
      const st = (/^status:\s*(.+)$/m.exec(card.split(/\n---/)[0] || '') || [])[1] || '';
      if (/blocked_down|auth_wall/.test(st)) for (const n of [r.id, ...(r.aliases || [])]) out.add(n);
    }
  } catch {}
  return out;
}

async function products(state) {
  const L = '各家';
  const blocked = blockedProducts();
  for (const c of state.channels || []) {
    const h = c.health || {};
    if (blocked.has(c.id) || blocked.has(c.id.replace(/-desktop$/, ''))) {
      add(L, c.label || c.id, 'ok', '主机卡标着停用，不派活');
      continue;
    }
    const last = h.lastError ? `；最近一次失败：${String(h.lastError).slice(0, 120)}` : '';
    const tally = `开过 ${h.started || 0} 轮，交付 ${h.delivered || 0}，失败 ${h.failed || 0}`;
    if (h.state === 'open') add(L, c.label || c.id, 'fail', `断路器打开（连续失败 ${h.consecutiveFailures}）${last}`, '看最近一次失败的原因；额度类等重置，其余在这家的驱动里查');
    else if ((h.consecutiveFailures || 0) >= 2) add(L, c.label || c.id, 'warn', `连续失败 ${h.consecutiveFailures} 次，${tally}${last}`, '看最近一次失败的原因');
    else if (/out of credits|额度|上限|quota|余额/i.test(h.lastError || '') && h.failed > h.delivered) add(L, c.label || c.id, 'warn', `${tally}${last}`, '额度用完：等重置或换渠道');
    else add(L, c.label || c.id, 'ok', `${c.status === 'idle' ? '空闲' : c.status}，${tally}`);
  }
  // Antigravity runs through its desktop language server; without it every turn fails at once.
  const ls = ps(`$p=Get-CimInstance Win32_Process -Filter "Name LIKE 'language_server%.exe'"|select -First 1; if($p){$p.ProcessId}`);
  add(L, 'Antigravity 语言服务', ls ? 'ok' : 'warn', ls ? `在跑（进程 ${ls}）` : '没在跑：Antigravity 的活都会失败', '打开 Antigravity 桌面端');
}

async function board(state) {
  const L = '任务板';
  const g = await get(`${BASE}/api/gateway/goals`);
  const goals = g.body?.goals || [];
  const by = {};
  for (const x of goals) by[x.status] = (by[x.status] || 0) + 1;
  add(L, '目标', 'ok', Object.entries(by).map(([k, v]) => `${k} ${v}`).join('，') || '没有目标');
  const active = Object.values(state.activeRuns || {});
  const runIds = new Set(active.map((r) => r.runId));
  for (const x of goals.filter((x) => x.status === 'running')) {
    const v = (await get(`${BASE}/api/gateway/goals?id=${encodeURIComponent(x.id)}`)).body || {};
    for (const t of v.tasks || []) {
      if (t.status === 'running' && t.runId && !runIds.has(t.runId) && Date.now() - Date.parse(t.updatedAt || t.startedAt || 0) > 10 * 60_000)
        add(L, `任务 ${t.id}`, 'warn', `「${(t.title || '').slice(0, 40)}」标着在跑，但它的轮次 ${t.runId} 已不在中心手上（${ago(Date.now() - Date.parse(t.updatedAt || 0))}没动）`, `node hub/tools/agent_gateway.js read --session ${t.sessionName || t.session || '<会话>'} 看它停在哪；必要时 task-action 重派`);
    }
  }
  for (const r of active) {
    const age = Date.now() - Date.parse(r.startedAt || 0);
    if (r.status === 'running' && age > 60 * 60_000) add(L, `轮次 ${r.runId}`, 'warn', `${r.channel}/${r.sessionName} 已跑 ${ago(age)}`, `node hub/tools/agent_gateway.js read --agent ${r.channel} --session ${r.sessionName}`);
  }
  const ask = (state.pendingApprovals || []).length + (state.pendingQuestions || []).length;
  add(L, '等人处理的', ask ? 'warn' : 'ok', ask ? `${(state.pendingApprovals || []).length} 个审批、${(state.pendingQuestions || []).length} 个提问等着` : '没有', '在网页的审批队列里处理');
  for (const [k, q] of Object.entries(state.queues || {})) {
    const items = Array.isArray(q) ? q : [];
    if (items.length && !active.some((r) => `${r.channel}:${r.sessionName}` === k || r.key === k)) add(L, `队列 ${k}`, 'warn', `排着 ${items.length} 条，但这个会话没有在跑的轮次`, '队列可能卡住：看这个会话最后一轮为什么没接着跑');
  }
}

function data() {
  const L = '数据';
  const dir = path.join(ROOT, 'hub', 'data');
  const bad = [];
  let n = 0;
  for (const f of fs.readdirSync(dir).filter((f) => f.endsWith('.json'))) {
    n++;
    try {
      JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    } catch (e) {
      bad.push(`${f}（${e.message.slice(0, 60)}）`);
    }
  }
  add(L, 'hub/data 的表', bad.length ? 'fail' : 'ok', bad.length ? `读不了：${bad.join('、')}` : `${n} 张表都能读`, '用 git diff 看最近谁改坏的，改回或修好');
  try {
    const units = JSON.parse(fs.readFileSync(path.join(dir, 'capability-units.json'), 'utf8')).units.map((u) => u.id);
    const tests = JSON.parse(fs.readFileSync(path.join(dir, 'capability-tests.json'), 'utf8'));
    const tested = new Set(Object.keys(tests.tests || {}));
    const missing = units.filter((u) => !tested.has(u));
    add(L, '测试题覆盖', missing.length ? 'warn' : 'ok', missing.length ? `${missing.length}/${units.length} 个能力单元还没有测试题：${missing.slice(0, 8).join('、')}${missing.length > 8 ? '…' : ''}` : `${units.length} 个能力单元都有测试题`, '多一个功能多一道题：在 hub/data/capability-tests.json 补');
  } catch (e) {
    add(L, '测试题覆盖', 'warn', `没算出来：${e.message.slice(0, 80)}`, '看 capability-units.json 和 capability-tests.json 的结构');
  }
  // Logs that only grow.
  const big = [];
  for (const f of fs.existsSync(HUB_HOME) ? fs.readdirSync(HUB_HOME) : []) {
    try {
      const st = fs.statSync(path.join(HUB_HOME, f));
      if (st.isFile() && st.size > 200 * 1024 * 1024) big.push(`${f} ${(st.size / 1024 / 1024).toFixed(0)} MB`);
    } catch {}
  }
  add(L, '日志大小', big.length ? 'warn' : 'ok', big.length ? `超过 200 MB：${big.join('、')}` : '~/.agent-hub 下没有超过 200 MB 的文件', '归档或截断（删除前先问用户）');
  const free = ps(`Get-PSDrive -PSProvider FileSystem | ? { $_.Name -in 'C','E' } | % { "$($_.Name)=$([math]::Round($_.Free/1GB,1))" }`);
  const low = free.split(/\s+/).filter((x) => Number(x.split('=')[1]) < 5);
  add(L, '磁盘', low.length ? 'warn' : 'ok', `剩余 GB：${free.replace(/\s+/g, '，')}`, '磁盘不到 5 GB：清理缓存或日志');
}

function autostart() {
  const L = '自启';
  const link = path.join(process.env.APPDATA || '', 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup', 'agent-hub-8899.vbs');
  add(L, '开机自启', fs.existsSync(link) ? 'ok' : 'warn', fs.existsSync(link) ? `已登记：${link}` : '没登记，重启后要手动起中心', '登记：powershell -File hub/tools/hub_boot.ps1 -Install');
  const boot = path.join(HUB_HOME, 'boot.log');
  if (fs.existsSync(boot)) {
    const last = fs.readFileSync(boot, 'utf8').split(/\r?\n/).filter((l) => l.trim()).slice(-1)[0] || '';
    add(L, '上次启动', /失败|error/i.test(last) ? 'warn' : 'ok', last.slice(0, 160), `看 ${boot}`);
  }
}

function full() {
  const r = spawnSync(process.execPath, [path.join(__dirname, 'check_channels.js')], { cwd: ROOT, encoding: 'utf8', timeout: 180000 });
  const tail = String(r.stdout || '').trim().split(/\r?\n/).slice(-3).join(' / ');
  add('各家', 'CLI 指纹（check_channels）', r.status === 0 ? 'ok' : 'warn', tail.slice(0, 200) || String(r.stderr || '').slice(0, 200), 'node hub/tools/check_channels.js 看全文');
}

(async () => {
  const state = await center();
  if (state) {
    await products(state);
    await board(state);
  }
  data();
  autostart();
  if (args.includes('--full')) full();

  const worst = results.some((r) => r.level === 'fail') ? 'fail' : results.some((r) => r.level === 'warn') ? 'warn' : 'ok';
  const report = { at: new Date().toISOString(), center: BASE, worst, results };
  try {
    if (!process.env.HUB_DAEMON_URL) fs.writeFileSync(path.join(HUB_HOME, 'selfcheck.json'), JSON.stringify(report, null, 2) + '\n');
  } catch {}
  if (args.includes('--json')) console.log(JSON.stringify(report, null, 2));
  else {
    const mark = { ok: '✓', warn: '!', fail: '✗' };
    let layer = '';
    for (const r of results) {
      if (r.layer !== layer) console.log(`\n${(layer = r.layer)}`);
      console.log(`  ${mark[r.level]} ${r.name}：${r.detail}`);
      if (r.fix) console.log(`      → ${r.fix}`);
    }
    const n = (lv) => results.filter((r) => r.level === lv).length;
    console.log(`\n自检 ${hhmm(Date.now())}：${n('ok')} 项正常，${n('warn')} 项要看，${n('fail')} 项坏了。`);
  }
  process.exit(worst === 'fail' ? 1 : 0);
})();
