// (COVERAGE.md is no longer written; CAPABILITY_MAP.md replaces it, with “现在还缺什么” at its top.) Builds per-layer cells from the blackboard: for every family, how far each capability unit reaches, layer by
// layer (native entry, ACP bridge, acpx, our backend, our front end). Never edit COVERAGE.md by hand.
// Usage: node channels/probe/scripts/build_coverage.js
const fs = require('fs');
const path = require('path');

const DIR = path.resolve(__dirname, '..');
const rows = fs
  .readFileSync(path.join(DIR, 'blackboard.jsonl'), 'utf8')
  .split(/\r?\n/)
  .filter((l) => l.trim())
  .map((l) => {
    try { return JSON.parse(l); } catch { return null; }
  })
  .filter(Boolean);
const unitsDoc = JSON.parse(fs.readFileSync(path.join(DIR, '..', '..', 'hub', 'data', 'capability-units.json'), 'utf8'));
const units = Array.isArray(unitsDoc) ? unitsDoc : unitsDoc.units;

const LAYERS = [
  ['L0', '原生入口'],
  ['L1a', 'ACP 桥'],
  ['L1b', 'acpx'],
  ['L2', '我们的后端'],
  ['L3', '我们的前端'],
];
const FAMILIES = ['antigravity', 'codex', 'claude', 'zcode', 'workbuddy', 'opencode', 'hermes', 'gemini', 'droid'];
const RANK = { pass: 4, partial: 3, unverified: 2, fail: 1 };
const MARK = { pass: '✓', partial: '◐', unverified: '?', fail: '✗' };

function layerOf(r) {
  const m = /^[^/]+\/(L0|L1a|L1b|L2|L3)\//.exec(String(r.route || ''));
  if (m) return m[1];
  return LAYERS.some(([k]) => k === r.layer) ? r.layer : null;
}

// latest result per (family, route, capability); routes inside one layer are then merged by best result
const latest = new Map();
for (const r of rows) {
  const layer = layerOf(r);
  if (!layer || !r.family || !r.capability) continue;
  const result = String(r.result || '').toLowerCase();
  if (!RANK[result]) continue;
  latest.set(`${r.family}|${r.route || layer}|${r.capability}`, { family: r.family, layer, capability: r.capability, result });
}
const cell = new Map(); // family|layer|capability -> best result
for (const v of latest.values()) {
  const k = `${v.family}|${v.layer}|${v.capability}`;
  const cur = cell.get(k);
  if (!cur || RANK[v.result] > RANK[cur]) cell.set(k, v.result);
}

const out = [];
out.push('# 能力单元覆盖表（由黑板生成，勿手改）');
out.push('');
out.push(`生成时间：${new Date().toISOString()}。来源：\`blackboard.jsonl\`（${rows.length} 行）、\`hub/data/capability-units.json\`（${units.length} 个单元，其中标“候选”的待用户确认）。生成脚本：\`scripts/build_coverage.js\`。`);
out.push('');
out.push('每一格取这一层里所有入口中最好的那条最新结果：✓ 通过（有行为证据）、◐ 部分、? 未验证（多为只证明了接口存在）、✗ 不通、· 没测过。层：原生入口（各家自己的命令行、守护进程、桌面应用）→ ACP 桥 → acpx → 我们的后端 → 我们的前端。我们的后端和前端两层，代表“已经接进 hub、用户能用”。');
out.push('');
out.push('## 一、总览：每家每一层覆盖多少个单元');
out.push('');
out.push('| 产品 | 层 | 通过 | 部分 | 未验证 | 不通 | 没测过 |');
out.push('|---|---|---|---|---|---|---|');
const summary = {};
for (const f of FAMILIES) {
  summary[f] = {};
  for (const [lk, ln] of LAYERS) {
    const c = { pass: 0, partial: 0, unverified: 0, fail: 0, none: 0 };
    for (const u of units) c[cell.get(`${f}|${lk}|${u.id}`) || 'none']++;
    summary[f][lk] = c;
    if (c.none === units.length) continue;
    out.push(`| ${f} | ${ln} | ${c.pass} | ${c.partial} | ${c.unverified} | ${c.fail} | ${c.none} |`);
  }
  const any = { pass: 0 };
  for (const u of units) if (LAYERS.some(([lk]) => cell.get(`${f}|${lk}|${u.id}`) === 'pass')) any.pass++;
  out.push(`| ${f} | **任一层通过** | **${any.pass}** |  |  |  |  |`);
}
out.push('');
out.push('## 二、按家逐个单元');
for (const f of FAMILIES) {
  const used = LAYERS.filter(([lk]) => summary[f][lk].none < units.length);
  if (!used.length) {
    out.push('', `### ${f}`, '', '没有任何记录。');
    continue;
  }
  out.push('', `### ${f}`, '', '| 单元 | 名称 | 类别 | ' + used.map(([, ln]) => ln).join(' | ') + ' |', '|---|---|---|' + used.map(() => '---|').join(''));
  for (const u of units) {
    const marks = used.map(([lk]) => MARK[cell.get(`${f}|${lk}|${u.id}`)] || '·');
    if (marks.every((m) => m === '·')) continue;
    out.push(`| ${u.id} | ${u.name} | ${String(u.category).replace(/（.*?）/g, '')} | ${marks.join(' | ')} |`);
  }
  const untouched = units.filter((u) => used.every(([lk]) => !cell.get(`${f}|${lk}|${u.id}`)));
  if (untouched.length) out.push('', `没测过的单元（${untouched.length}）：${untouched.map((u) => u.name).join('、')}。`);
}

// ---------------------------------------------------------------------------------------------------------------
// CAPABILITY_MAP.md — the function matrix along the positions of channels/README.md “立体认知” (2026-10-18); in the user's words:
//   1 native app (what the desktop app shows people and lets them do)
//   2 native interface (app-server, CLI, ACP bridge, Connect-RPC, local stores: what programs can do)
//   3 adapter (acpx + our backend)          4 our front end
// For every unit: its theoretical limit (completeness check §4.2, else "not reasoned yet"), and per family the four
// layers plus the gap: build it ourselves (limit proven, not wired in) or send out for research (limit unknown).
const integ = JSON.parse(fs.readFileSync(path.join(DIR, '..', '..', 'hub', 'data', 'integration-map.json'), 'utf8'));
const DESIGN = 'E:\\program\\GIT\\Jobs\\08_简历设计工作区\\02_项目打磨与展示\\智能体技术\\多智能体协作\\能力单元与协作拓扑_完整性检查_20261018.md';
const short = (t, n = 70) => String(t || '').replace(/\s+/g, ' ').replace(/\|/g, '/').trim().slice(0, n);
const isDesktop = (route) => /desktop|webview|artifacts-ui|toast/i.test(String(route || ''));
const isHci = (u) => /^人机交互/.test(String(u.category || ''));

// Theoretical limits by unit, from the table in §4.2 of the completeness check (rows name units in Chinese).
const theory = new Map();
try {
  const md = fs.readFileSync(DESIGN, 'utf8');
  const sec = md.slice(md.indexOf('### 4.2'), md.indexOf('### 4.3'));
  for (const line of sec.split(/\r?\n/)) {
    const c = line.split('|').slice(1, -1).map((x) => x.trim());
    if (c.length < 6 || /^-+$/.test(c[0]) || c[0] === '单元') continue;
    for (const tok of c[0].split('、')) {
      for (const u of units) {
        const nm = String(u.name).replace(/（.*?）/g, '');
        if (nm === tok || nm.startsWith(tok) || (tok.length >= 2 && tok.startsWith(nm))) {
          if (!theory.has(u.id)) theory.set(u.id, { limit: c[1], via: c[2], wall: c[3], fallback: c[4], cost: c[5] });
        }
      }
    }
  }
} catch {}

// Facts per family, unit and layer: best result, and the record that proves it.
const L4 = ['app', 'api', 'adapter', 'front'];
const LNAME = { app: '1 原生应用', api: '2 原生接口', adapter: '3 适配器', front: '4 前端' };
function layer4(r) {
  const l = layerOf(r);
  if (l === 'L0') return isDesktop(r.route) || r.surface === 'desktop-app' ? 'app' : 'api';
  if (l === 'L1a') return 'api';
  if (l === 'L1b' || l === 'L2') return 'adapter';
  if (l === 'L3') return 'front';
  return null;
}
const fact = new Map(); // family|unit|layer -> {result, row}
const latest4 = new Map();
for (const r of rows) {
  const L = layer4(r);
  const res = String(r.result || '').toLowerCase();
  if (!L || !r.family || !r.capability || !RANK[res]) continue;
  latest4.set(`${r.family}|${r.route}|${r.capability}|${L}`, { L, res, r });
}
for (const v of latest4.values()) {
  const k = `${v.r.family}|${v.r.capability}|${v.L}`;
  const cur = fact.get(k);
  if (!cur || RANK[v.res] > RANK[cur.res]) fact.set(k, { res: v.res, r: v.r });
}
// A web verdict probe_display.mjs carried over from a failed backend check (the page shows what the backend reads)
// lapses once a later run of the same check on the backend is newer: the reason for it is gone.
for (const [k, v] of fact) {
  const [fam, unit, L] = k.split('|');
  if (L !== 'front' || v.r.by !== 'probe_display.mjs') continue;
  const back = latest4.get(`${fam}|${fam}/L2/server-api|${unit}|adapter`);
  if (back && back.r.by === 'probe_display.mjs' && String(back.r.at) > String(v.r.at)) fact.delete(k);
}
// built: implemented, not yet tested; fill: done one level up (README “立体认知”: 理论极限).
const INTEG = { real: 'pass', partial: 'partial', fill: 'partial', built: 'unverified', todo: 'unverified', fake: 'fail' };
function integCell(side, unit, fam) {
  const es = ((integ[side] || {})[unit] || []).filter((e) => (e.channels || []).includes(fam));
  const best = ['real', 'partial', 'fill', 'built'].map((st) => es.find((e) => e.status === st)).find(Boolean) || es[0];
  return best ? { res: INTEG[best.status] || 'unverified', how: best.how || best.path || `${best.page}：${best.control}`, fake: best.status === 'fake' } : null;
}
function cellOf(fam, unit, L) {
  // On the backend, what the page uses is the service's own route: its latest test is the one that can pull a
  // declaration down, not the best result over every route.
  const served = L === 'adapter' && latest4.get(`${fam}|${fam}/L2/server-api|${unit}|adapter`);
  const f = served || fact.get(`${fam}|${unit}|${L}`);
  if (L === 'adapter' || L === 'front') {
    const i = integCell(L === 'adapter' ? 'backend' : 'frontend', unit, fam);
    // A test beats a declaration when it says less (10-19: Antigravity's reading was declared real, a regression
    // against the raw records failed it) or when it confirms something only declared built.
    if (i && f && (RANK[f.res] < RANK[i.res] || (i.res === 'unverified' && f.res === 'pass'))) {
      return { res: f.res, how: f.r.evidence || i.how };
    }
    if (i) return i;
  }
  if (!f) return null;
  const how = f.r.cmd && String(f.r.cmd).trim().length > 3 ? f.r.cmd : f.r.evidence;
  return { res: f.res, how, desktopSays: f.r.note === 'desktop-has' };
}
function mark(c) {
  if (!c) return '·';
  if (c.desktopSays) return '有（截图/代码）';
  if (c.fake) return '✗假 ' + short(c.how, 40);
  if (c.res === 'pass') return '✓ ' + short(c.how, 50);
  return MARK[c.res] + (c.how ? ' ' + short(c.how, 30) : '');
}
const ok = (c) => c && (c.res === 'pass' || c.desktopSays);
// The gap for one family on one unit, as the next action.
function gap(u, fam, cs) {
  if (ok(cs.front) && cs.front.res === 'pass') return '已到前端';
  if (isHci(u)) {
    if (ok(cs.adapter)) return '自己做：前端照着做';
    return ok(cs.app) || ok(cs.api) ? '自己做：后端先供数据，再做前端' : '派研究：这家桌面端有没有、数据在哪';
  }
  if (ok(cs.adapter)) return '自己做：做到前端';
  if (ok(cs.api)) return '自己做：接进适配器';
  if (theory.has(u.id)) return '派研究：原生接口没证实，按理论上限找入口或补齐';
  return '派研究：先推理论上限，再探查';
}

const famsFor = (u) => FAMILIES.filter((f) => L4.some((L) => cellOf(f, u.id, L)) || ['claude', 'codex', 'antigravity', 'zcode', 'workbuddy', 'opencode', 'hermes'].includes(f));
const todo = { build: {}, research: {}, done: {} };
const lines = [];
for (const u of units) {
  const t = theory.get(u.id);
  lines.push('', `## ${u.name}（${u.id}）`, '', `${u.definition}。怎样算支持：${u.judge}。类别：${u.category}。`);
  lines.push('', t
    ? `**理论上限**：${t.limit}（靠 ${t.via}）。根本限制：${t.wall}。原生做不到时最多补齐到：${t.fallback}${t.cost && t.cost !== '——' ? `，代价：${t.cost}` : ''}。`
    : isHci(u) ? `**理论上限**：人机交互单元，上限取决于它依赖的单元在原生接口和我们的后端能否拿到数据（${short(u.source, 120)}）。` : '**理论上限**：还没推（完整性检查 4.2 未覆盖）。');
  lines.push('', '| 产品 | 桌面端界面 | 原生接口 | 适配器与我们的后端 | 网页 | 差距与下一步 |', '|---|---|---|---|---|---|');
  for (const f of famsFor(u)) {
    const cs = {};
    for (const L of L4) cs[L] = cellOf(f, u.id, L);
    const g = gap(u, f, cs);
    const bucket = g.startsWith('已到') ? 'done' : g.startsWith('自己做') ? 'build' : 'research';
    (todo[bucket][f] ||= []).push(u.id);
    lines.push(`| ${f} | ${mark(cs.app)} | ${mark(cs.api)} | ${mark(cs.adapter)} | ${mark(cs.front)} | ${g} |`);
  }
}
// ---- The seven matrices the user named (2026-10-18), as coverage figures ----------------------------------------
// 1 desktop HCI, 2 our web experience, 3 theoretical, 4 actual, 5 native interfaces, 6 our adapter,
// 7 adapter routes. Capability units (interface + collaboration) are the denominator for 3–7; HCI units for 1–2.
const capUnits = units.filter((u) => !isHci(u));
const hciUnits = units.filter((u) => isHci(u));
const FAM7 = ['claude', 'codex', 'antigravity', 'zcode', 'workbuddy', 'opencode', 'hermes', 'gemini', 'droid'];
// Latest result per family | route | unit; a route is "<layer>/<entry>".
const lastBy = new Map();
for (const r of rows) {
  let m = /^([^/]+)\/(L0|L1a|L1b|L2|L3)\/([^/]+)/.exec(String(r.route || ''));
  // Early testers wrote the command itself into `route` and the layer into `layer`; fall back to those.
  if (!m && r.family && LAYERS.some(([k]) => k === r.layer)) m = [null, r.family, r.layer, String(r.surface || 'other')];
  const res = String(r.result || '').toLowerCase();
  if (!m || !RANK[res] || !r.capability) continue;
  lastBy.set(`${m[1]}|${m[2]}/${m[3]}|${r.capability}`, { fam: m[1], layer: m[2], entry: m[3], unit: r.capability, res, r });
}
// Native entries grouped into kinds; adapter routes are what an adapter of ours could drive.
function nativeKind(entry) {
  if (/desktop|webview|artifacts-ui|toast/.test(entry)) return null; // layer 1
  if (/opencli|cdp/i.test(entry)) return 'OpenCLI（操作桌面端界面）';
  if (/^app-server/.test(entry)) return 'app-server';
  if (/connect-rpc|rpc/.test(entry)) return 'Connect-RPC';
  if (/^agentapi/.test(entry)) return 'agentapi';
  if (/^serve/.test(entry)) return 'HTTP 服务（serve）';
  if (/subagent/.test(entry)) return '子智能体工具';
  if (/sqlite|transcript|summaries|settings|inbox|logs|artifacts|board-file|conversations-db|agents-md|metadata/.test(entry)) return '本地库与会话文件';
  if (/cli|^run$|^exec$|opencli|code-session/.test(entry)) return '命令行';
  return '其他原生入口';
}
const passSet = (pred) => {
  const s = new Map();
  for (const v of lastBy.values()) if (v.res === 'pass' && pred(v)) (s.get(v.fam) || s.set(v.fam, new Set()).get(v.fam)).add(v.unit);
  return s;
};
const capIds = new Set(capUnits.map((u) => u.id));
const hciIds = new Set(hciUnits.map((u) => u.id));
const pct = (n, d) => (d ? Math.round((100 * n) / d) + '%' : '—');
const cnt = (set, ids) => (set ? [...set].filter((x) => ids.has(x)).length : 0);
const native = passSet((v) => (v.layer === 'L0' && nativeKind(v.entry)) || v.layer === 'L1a');
const desktop = new Map();
for (const v of lastBy.values()) if (v.layer === 'L0' && !nativeKind(v.entry) && (v.res === 'pass' || v.r.note === 'desktop-has')) (desktop.get(v.fam) || desktop.set(v.fam, new Set()).get(v.fam)).add(v.unit);
const adapterNow = new Map();
for (const f of FAM7) {
  const s = new Set();
  for (const u of units) {
    const c = integCell('backend', u.id, f);
    if (c && c.res === 'pass') s.add(u.id);
    const fb = fact.get(`${f}|${u.id}|adapter`);
    if (fb && fb.res === 'pass') s.add(u.id);
  }
  adapterNow.set(f, s);
}
const webNow = new Map();
for (const f of FAM7) {
  const s = new Set();
  for (const u of units) { const c = integCell('frontend', u.id, f); if (c && c.res === 'pass') s.add(u.id); }
  webNow.set(f, s);
}
const sec7 = [];
sec7.push('## 七个矩阵的覆盖率（用户 10-18 定的结构；定义见 `channels/README.md`“立体认知”）', '');
sec7.push(`分母：人机交互单元 ${hciUnits.length} 个（桌面端、网页两个矩阵）；能力单元（接口 ＋ 协作 ＋ 底座）${capUnits.length} 个（其余五个矩阵）。“通过”只算有行为证据的；桌面端矩阵的“有”来自截图或代码分析。`, '');
sec7.push('### 桌面端人机交互与我们的 web 体验', '', '| 产品 | 桌面端有（/人机交互单元） | 我们的网页做到（/人机交互单元） | 网页对桌面端的覆盖率 |', '|---|---|---|---|');
for (const f of FAM7) {
  const d = desktop.get(f), w = webNow.get(f);
  const dn = cnt(d, hciIds), wn = cnt(w, hciIds);
  const both = d ? [...d].filter((x) => hciIds.has(x) && w && w.has(x)).length : 0;
  sec7.push(`| ${f} | ${dn ? dn + '（' + pct(dn, hciIds.size) + '）' : '没查'} | ${wn}（${pct(wn, hciIds.size)}） | ${dn ? pct(both, dn) : '—'} |`);
}
const theoryDone = capUnits.filter((u) => theory.has(u.id)).length;
sec7.push('', '### 理论能力', '', `${capUnits.length} 个能力单元里 ${theoryDone} 个已推出理论上限（完整性检查 4.2；逐个单元见下文各节“理论上限”）。按 README“立体认知”里“理论极限”一段，每个单元在每家理论上都至少能补齐到“新建会话 ＋ 文件”一级，所以理论覆盖率按档看：原生、换入口、宿主补齐、兜底。下面几个矩阵的分母都是全部能力单元，差额就是离理论上限的距离。`);
sec7.push('', '### 实际能力、原生接口与适配器', '', '| 产品 | 实际（任一位置通过） | 原生接口合计 | 我们的适配器（现状） | 适配器对原生接口的接入率 |', '|---|---|---|---|---|');
for (const f of FAM7) {
  const n = native.get(f), a = adapterNow.get(f);
  const all = new Set([...(n || []), ...(a || [])]);
  const nn = cnt(n, capIds), an = cnt(a, capIds), alln = cnt(all, capIds);
  const wired = n ? [...n].filter((x) => capIds.has(x) && a.has(x)).length : 0;
  sec7.push(`| ${f} | ${alln}（${pct(alln, capIds.size)}） | ${nn}（${pct(nn, capIds.size)}） | ${an}（${pct(an, capIds.size)}） | ${nn ? pct(wired, nn) : '—'} |`);
}
sec7.push('', '### 原生接口：逐个入口的覆盖率（通过的能力单元数 / 全部能力单元）', '');
const KINDS = ['OpenCLI（操作桌面端界面）', 'app-server', 'Connect-RPC', 'agentapi', 'HTTP 服务（serve）', '命令行', '本地库与会话文件', '子智能体工具', '其他原生入口', 'ACP 桥'];
sec7.push('| 产品 | ' + KINDS.join(' | ') + ' |', '|---|' + KINDS.map(() => '---|').join(''));
for (const f of FAM7) {
  const cells = KINDS.map((k) => {
    const s = passSet((v) => v.fam === f && (k === 'ACP 桥' ? v.layer === 'L1a' : v.layer === 'L0' && nativeKind(v.entry) === k)).get(f);
    const n = cnt(s, capIds);
    return n ? `${n}（${pct(n, capIds.size)}）` : '·';
  });
  if (cells.every((c) => c === '·')) continue;
  sec7.push(`| ${f} | ${cells.join(' | ')} |`);
}
sec7.push('', '### 不同适配路线的覆盖率（若由我们的适配器走这条路，能拿到多少；“现状”是已经接进来的）', '');
const ROUTES = [
  ['经 acpx 命令行', (v) => v.layer === 'L1b'],
  ['直连 ACP 桥（嵌入 acpx 运行时可达）', (v) => v.layer === 'L1a'],
  ['直连 app-server', (v) => v.layer === 'L0' && nativeKind(v.entry) === 'app-server'],
  ['直连 Connect-RPC ＋ agentapi', (v) => v.layer === 'L0' && (nativeKind(v.entry) === 'Connect-RPC' || nativeKind(v.entry) === 'agentapi')],
  ['驱动原生命令行', (v) => v.layer === 'L0' && nativeKind(v.entry) === '命令行'],
  ['直连 CDP 操作桌面端界面', (v) => v.layer === 'L0' && /cdp/i.test(String(v.entry || ''))],
  ['经 OpenCLI 操作桌面端界面', (v) => v.layer === 'L0' && nativeKind(v.entry) === 'OpenCLI（操作桌面端界面）'],
];
sec7.push('| 产品 | ' + ROUTES.map((r) => r[0]).join(' | ') + ' | 我们的后端（现状） |', '|---|' + ROUTES.map(() => '---|').join('') + '---|');
for (const f of FAM7) {
  const cells = ROUTES.map(([, pred]) => { const n = cnt(passSet((v) => v.fam === f && pred(v)).get(f), capIds); return n ? `${n}（${pct(n, capIds.size)}）` : '·'; });
  const an = cnt(adapterNow.get(f), capIds);
  sec7.push(`| ${f} | ${cells.join(' | ')} | ${an}（${pct(an, capIds.size)}） |`);
}
sec7.push('');

const map = [];
map.push('# 功能矩阵：每个单元在各家、各位置上的理论上限与现状（由黑板、integration-map 和完整性检查生成，勿手改）');
map.push('');
map.push(`生成时间：${new Date().toISOString()}。列按 \`channels/README.md\`“立体认知”里的位置排：桌面端界面（用户说的原生应用层：桌面应用给人看什么、让人操作什么）、原生接口（原生接口层：app-server、命令行、ACP 桥等暴露给程序的）、适配器与我们的后端（适配器层）、网页（前端交互层）。理论上限来自设计目录《能力单元与协作拓扑_完整性检查_20261018》4.2；桌面端界面这一列靠截图分析和代码分析取证，不是行为实测，标“有（截图/代码）”；现有格子来自一份调研，未逐格核。每做完一件事：追加黑板 → 动了后端或前端就登记 \`hub/data/integration-map.json\` → 重跑 \`channels/probe/scripts/build_coverage.js\`。`);
map.push('');
map.push('标记：✓ 有行为证据（后面是实现路径）；◐ 部分；? 未验证；✗ 不通；✗假 界面有、实际是别的办法模拟；有（截图/代码） 桌面端界面这一列靠截图或代码分析得出、不是行为实测（这批来自调研，未逐格核）；· 没有记录。');
map.push('');
map.push(...sec7);
map.push('## 总账：要做什么、派什么');
map.push('');
map.push('| 产品 | 已到前端 | 自己做（上限已证实，没接进来） | 派出去研究（上限不清或要找别的路） |');
map.push('|---|---|---|---|');
for (const f of FAMILIES) {
  const n = (b) => (todo[b][f] || []).length;
  if (!n('done') && !n('build') && !n('research')) continue;
  map.push(`| ${f} | ${n('done')} | ${n('build')} | ${n('research')} |`);
}
map.push('');
const ctl = units.filter((u) => !isHci(u));
map.push(`理论上限：控制与观察类 ${ctl.filter((u) => theory.has(u.id)).length} / ${ctl.length} 个已推（完整性检查 4.2）；人机交互类 ${units.length - ctl.length} 个的上限取决于它依赖的单元在原生接口和我们的后端能否拿到数据。没推的单元，“派研究”的第一步是负责人先推理论上限。`);
map.push('');
map.push('**自己做的清单（按单元，后面是哪几家）**：');
const byUnit = {};
for (const [f, ids] of Object.entries(todo.build)) for (const id of ids) (byUnit[id] ||= []).push(f);
for (const u of units) if (byUnit[u.id]) map.push(`- ${u.name}（${u.id}）：${byUnit[u.id].join('、')}`);
map.push(...lines);

// ---------------------------------------------------------------------------------------------------------------
// “现在还缺什么”, written at the top of CAPABILITY_MAP.md. It is outer: README “立体认知” (the center) already says who
// hosts each scale and so what we must do there, which makes the gaps visible at a glance; this part only lays the
// numbers out to check against, cut the same way (scale × position, then family). README is not written by this script.
const GF = ['claude', 'codex', 'antigravity', 'zcode', 'workbuddy', 'opencode', 'hermes'];
// Scale of each capability unit (README “立体认知”: “尺度”, “能力单元在这个空间里的位置”). Human-facing units take the scale of what they show.
const SCALE = {
  '一轮之内': 'observe-live observe-steps follow-progress steer inject-next inject-tool inject-inbox inject-silent cancel permission ask-user human-steer attach',
  '一个会话': 'open open-idle resume resume-native fork rewind compact model-new model-switch mode-switch reasoning-effort close archive delete label native-meta native-meta-write context-usage observe-history state wait-visible wake-bg wake-timer wake-msg wake-stall wake-persist workspace instructions mount-tools memory-mode output-contract guard permission-scope goal',
  '两个会话之间': 'spawn-subagent peer-message handoff reclaim ownership act-deliver act-request act-yield act-report notify-user handover-human app-sync',
  '一群会话': 'discover-sessions content-search list-projects task-board loop-guard',
  '底座': 'model-list quota channel-route channel-health capacity channel-lease sampling probe-host host-drain terminal browser artifact dev-preview cmd-list workspace-files',
};
// Scales no family holds across families, so we are the host there (README “立体认知”: “每一级由谁当宿主”). A gap at
// these scales is ours to build whether or not some family exposes the unit.
const OURS = new Set(['两个会话之间', '一群会话']);
const scaleOf = {};
for (const [s, ids] of Object.entries(SCALE)) for (const id of ids.split(' ')) scaleOf[id] = s;
const depsOf = (u) => ((/依赖：([^|]*)/.exec(String(u.source || '')) || [])[1] || '').split(/[、,，\s]+/).filter((x) => /^[a-z][\w-]*$/.test(x));
// A capability unit is on the web for a family when the web does it directly or through a human-facing unit built on it.
function onWeb(f, id) {
  const w = webNow.get(f) || new Set();
  if (w.has(id)) return true;
  return hciUnits.some((h) => w.has(h.id) && depsOf(h).includes(id));
}
const has = (m, f, id) => Boolean(m.get(f) && m.get(f).has(id));
// Backend cells marked partial count as wired (e.g. the next-turn queue, where our backend is the host); they are also
// listed apart, since what they still lack is in the note of their integration-map entry.
const adapterPart = new Map();
for (const f of GF) {
  const s = new Set();
  for (const u of capUnits) {
    const c = integCell('backend', u.id, f), fb = fact.get(`${f}|${u.id}|adapter`);
    if ((c && c.res === 'partial') || (fb && fb.res === 'partial')) s.add(u.id);
  }
  adapterPart.set(f, s);
}
const byScale = {};
const build = {}, research = {}, partial = {}, retest = {};
// Implemented in the backend but not yet tested on this product: counted as wired, listed as “补测”.
const isBuilt = (f, id) => ((integ.backend || {})[id] || []).some((e) => e.status === 'built' && (e.channels || []).includes(f));
for (const u of capUnits) {
  const s = scaleOf[u.id] || '未归尺度';
  const b = (byScale[s] ||= { units: 0, native: 0, backend: 0, built: 0, web: 0 });
  b.units++;
  for (const f of GF) {
    const n = has(native, f, u.id), full = has(adapterNow, f, u.id), part = has(adapterPart, f, u.id);
    if (n) b.native++;
    if (full || part) b.backend++;
    if (onWeb(f, u.id)) b.web++;
    if (part && !full) (partial[u.id] ||= []).push(f);
    if (full || part) continue;
    if (isBuilt(f, u.id)) { b.built++; (retest[u.id] ||= []).push(f); continue; }
    if (n || OURS.has(s)) (build[u.id] ||= []).push(f);
    else (research[u.id] ||= []).push(f);
  }
}
const deskMiss = {};
for (const h of hciUnits) for (const f of GF) if (has(desktop, f, h.id) && !has(webNow, f, h.id)) (deskMiss[h.id] ||= []).push(f);
const nameOf = (id) => (units.find((u) => u.id === id) || {}).name || id;
const top = (obj, n) => Object.entries(obj).sort((a, b) => b[1].length - a[1].length).slice(0, n);
const cells = (obj) => Object.values(obj).reduce((k, fs2) => k + fs2.length, 0);
const gl = [];
gl.push('## 现在还缺什么（外层：按 README“立体认知”的轴把现在的差摆出来）', '');
gl.push(`README“立体认知”说清了每一级由谁当宿主、我们在那一级该做什么，拿它对着现状一看就知道差在哪；这里只把数摆出来，供核对。一格 = 一个能力单元在一个产品。生成时间 ${new Date().toISOString()}；统计七个产品（${GF.join('、')}），Gemini、Droid 的凭证和 key 有问题，另算。`, '');
// Every layer: its theoretical limit, our target, where it stands, and where the evidence is kept (README “管线”).
{
  const capN = capUnits.length * GF.length;
  // Same counting as the scale table below: tested (registry real or a backend-layer pass on the blackboard),
  // partial or filled, implemented but untested.
  const status = {};
  for (const u of capUnits) for (const f of GF) {
    const es = ((integ.backend || {})[u.id] || []).filter((e) => (e.channels || []).includes(f));
    const best = has(adapterNow, f, u.id) ? 'real'
      : has(adapterPart, f, u.id) ? (es.some((e) => e.status === 'fill') ? 'fill' : 'partial')
      : isBuilt(f, u.id) ? 'built' : null;
    if (best) status[best] = (status[best] || 0) + 1;
  }
  const wired = Object.values(status).reduce((a, b) => a + b, 0);
  const nativeN = capUnits.reduce((k, u) => k + GF.filter((f) => has(native, f, u.id)).length, 0);
  const webN = capUnits.reduce((k, u) => k + GF.filter((f) => onWeb(f, u.id)).length, 0);
  const routeN = ROUTES.map(([name, pred]) => `${name} ${GF.reduce((k, f) => k + cnt(passSet((v) => v.fam === f && pred(v)).get(f), capIds), 0)}`).join('、');
  const acts = JSON.parse(fs.readFileSync(path.join(DIR, '..', '..', 'hub', 'data', 'actions.json'), 'utf8')).actions;
  gl.push('**每一层：理论极限、我们的目标、现状、依据记在哪**（一格 = 一个能力单元在一个产品）', '');
  gl.push('| 层 | 理论极限 | 我们的目标 | 现状 | 依据记在哪、记什么 |', '|---|---|---|---|---|');
  gl.push(`| 理论 | 每个能力单元最多做到哪、卡在哪、最多补齐到哪一级 | 每个单元都推出来 | ${capUnits.filter((u) => theory.has(u.id)).length} / ${capUnits.length} 个单元已推 | 设计目录《完整性检查》4.2：上限、靠什么、根本限制、最多补齐到 |`);
  gl.push(`| 原生面 | 那一级循环开放的时机 × 通向它的入口 | 每格查清：原生能做，或要补齐到哪一级 | ${nativeN} / ${capN} 格已证实 | 黑板 route = <产品>/L0 或 L1a/<入口>：命令、原始输出、产品版本、日期 |`);
  gl.push(`| 适配路线 | 路线挂的那个原生面能给的 | 每个产品走能力最高的路线 | 实测通过的格：${routeN} | 黑板 route = <产品>/L1b/acpx 等 |`);
  gl.push(`| 后端 | 原生面能给的，加上我们当宿主补齐的（两个会话之间、一群会话全由我们） | 全部能力单元；补齐写明搬到哪一级 | ${wired} / ${capN} 格已接：实测通过 ${status.real || 0}、部分 ${status.partial || 0}、补齐 ${status.fill || 0}、实现了未测 ${status.built || 0} | \`hub/data/integration-map.json\`：action、status、fillLevel；实测记黑板 route = <产品>/L2/server-api |`);
  gl.push(`| 网页 | 后端已接的，加上人机交互单元 | 桌面端有的都有，再加我们独有的（待处理、协作图） | ${webN} / ${capN} 格网页用得到；桌面端有、网页没有 ${Object.keys(deskMiss).length} 项 | integration-map 的 frontend；实测记黑板 route = <产品>/L3/m |`);
  gl.push(`| 命令行网关 | 后端的全部动作 | 全部动作 | ${acts.filter((a) => a.cli).length} / ${acts.length} 个动作有子命令 | \`hub/data/actions.json\` 的 cli；实测记黑板 route = <产品>/L2/agent_gateway |`, '');
}
gl.push('**按尺度和位置看**（格数）', '');
gl.push('| 尺度 | 格数 | 原生面已证实 | 后端已接：实测通过、部分或补齐 | 后端已接：实现了未测 | 网页上用得到 |', '|---|---|---|---|---|---|');
for (const s of [...Object.keys(SCALE), '未归尺度']) {
  const b = byScale[s];
  if (b) gl.push(`| ${s}${OURS.has(s) ? '（我们当宿主）' : ''} | ${b.units * GF.length} | ${b.native} | ${b.backend} | ${b.built} | ${b.web} |`);
}
gl.push('', '**按产品看**（分母是能力单元总数；“网页对桌面端”的分母是这个产品桌面端有的人机交互单元）', '');
gl.push('| 产品 | 实际（任一位置实测） | 原生接口 | 我们的后端（只算通过） | 原生已证实的接进了多少 | 网页对桌面端 |', '|---|---|---|---|---|---|');
for (const f of GF) {
  const n = native.get(f) || new Set(), a = adapterNow.get(f) || new Set(), d = desktop.get(f), w = webNow.get(f) || new Set();
  const nn = [...n].filter((x) => capIds.has(x)).length, an = [...a].filter((x) => capIds.has(x)).length;
  const all = new Set([...n, ...a].filter((x) => capIds.has(x))).size;
  const wired = [...n].filter((x) => capIds.has(x) && a.has(x)).length;
  const dn = d ? [...d].filter((x) => hciIds.has(x)).length : 0, both = d ? [...d].filter((x) => hciIds.has(x) && w.has(x)).length : 0;
  gl.push(`| ${f} | ${pct(all, capIds.size)} | ${pct(nn, capIds.size)} | ${pct(an, capIds.size)} | ${nn ? pct(wired, nn) : '—'} | ${dn ? pct(both, dn) : '没查'} |`);
}
gl.push('', `**自己做**（${cells(build)} 格：原生已证实而后端没接，或这一级本来就由我们当宿主；按涉及的家数排，列前十）`, '');
for (const [id, fs2] of top(build, 10)) gl.push(`- ${nameOf(id)}（${id}，${scaleOf[id] || '未归尺度'}）：${fs2.join('、')}`);
gl.push('', `**后端只做了一部分**（${cells(partial)} 格；还缺的写在 \`hub/data/integration-map.json\` 那一条的 note 里）`, '');
for (const [id, fs2] of top(partial, 10)) gl.push(`- ${nameOf(id)}（${id}）：${fs2.join('、')}`);
gl.push('', `**补测**（${cells(retest)} 格：后端已经实现，还没在这个产品上实测；按涉及的产品数排，列前十）`, '');
for (const [id, fs2] of top(retest, 10)) gl.push(`- ${nameOf(id)}（${id}）：${fs2.join('、')}`);
gl.push('', `**派研究**（${cells(research)} 格：这一级由各家当宿主，原生面和后端都没证实；按涉及的家数排，列前十，注明理论上限推了没有）`, '');
for (const [id, fs2] of top(research, 10)) gl.push(`- ${nameOf(id)}（${id}，${scaleOf[id] || '未归尺度'}）：${fs2.length} 家；理论上限${theory.has(id) ? '已推' : '还没推'}`);
gl.push('', '**桌面端有、网页还没做或没做全的人机交互单元**（按有它的家数排）', '');
gl.push(top(deskMiss, 12).map(([id, fs2]) => `${nameOf(id)}（${fs2.length} 家）`).join('、') || '无');
const noTheory = capUnits.filter((u) => !theory.has(u.id)).map((u) => u.name);
const noDesk = GF.filter((f) => !(desktop.get(f) && [...desktop.get(f)].some((x) => hciIds.has(x))));
const viaRoute = (re) => GF.map((f) => [f, [...(passSet((v) => v.fam === f && v.layer === 'L0' && re.test(String(v.entry || '') + ' ' + nativeKind(v.entry))).get(f) || [])].length]).filter((x) => x[1]);
const ocli = viaRoute(/OpenCLI/), cdp = viaRoute(/cdp/i);
const routeText = (xs) => xs.map(([f, n]) => f + ' ' + n + ' 格').join('、') || '无';
gl.push('', '**认知本身还缺什么**', '');
gl.push(`- 理论上限还没推的单元：${noTheory.join('、') || '无'}`);
gl.push(`- 桌面端（人机交互）没有数据的家：${noDesk.join('、') || '无'}`);
gl.push(`- 适配路线有实测的：经 OpenCLI ${routeText(ocli)}；直连 CDP ${routeText(cdp)}`);
gl.push(`- 没归到尺度的能力单元：${capUnits.filter((u) => !scaleOf[u.id]).map((u) => u.id).join('、') || '无'}`);
gl.push('');
// Gaps go right after the title, the generation note and the legend (map[0..5]), before the seven matrices.
map.splice(6, 0, ...gl);
fs.writeFileSync(path.join(DIR, 'CAPABILITY_MAP.md'), map.join('\n') + '\n', 'utf8');
console.log('CAPABILITY_MAP.md:', units.length, 'units;', theory.size, 'with theoretical limits; gaps at the top');

// The same cells as data, for pages that draw the matrix: per unit and product, each place's state
// (pass / partial / unverified / fail / desktop = seen in the desktop app only / fake) and the gap.
const state = (c) => (!c ? null : c.desktopSays ? 'desktop' : c.fake ? 'fake' : c.res);
const PROD7 = ['claude', 'codex', 'antigravity', 'zcode', 'workbuddy', 'opencode', 'hermes'];
const matrix = {
  generatedAt: new Date().toISOString(),
  products: PROD7,
  places: L4,
  scales: [...Object.keys(SCALE), '未归尺度'],
  units: units.map((u) => ({
    id: u.id,
    name: u.name,
    hci: isHci(u),
    candidate: /候选/.test(String(u.category || '')),
    scale: isHci(u) ? '人机交互' : scaleOf[u.id] || '未归尺度',
    theory: theory.has(u.id),
    cells: Object.fromEntries(
      PROD7.map((f) => {
        const cs = {};
        for (const L of L4) cs[L] = cellOf(f, u.id, L);
        return [f, { ...Object.fromEntries(L4.map((L) => [L, state(cs[L])])), how: short((cs.front || cs.adapter || cs.api || cs.app || {}).how, 60), gap: gap(u, f, cs) }];
      }),
    ),
  })),
};
fs.writeFileSync(path.join(DIR, 'capability-matrix.json'), JSON.stringify(matrix) + '\n', 'utf8');
