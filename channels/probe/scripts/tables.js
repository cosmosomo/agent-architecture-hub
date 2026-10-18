#!/usr/bin/env node
// The four tables of the pipeline (channels/README.md “管线”), printed from where they live, and checked against the
// code that is supposed to follow them. Products, actions and unit → action are data in hub/data; the fourth table,
// the current state, is generated into channels/probe/CAPABILITY_MAP.md by build_coverage.js.
//   node channels/probe/scripts/tables.js            print all three tables and the check
//   node channels/probe/scripts/tables.js check      only the check; exit 1 when something does not line up
// Also reachable as `node hub/tools/agent_gateway.js tables`.
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), 'utf8');
const data = (f) => JSON.parse(read('hub', 'data', f));

function load() {
  const products = data('products.json');
  const actions = data('actions.json').actions;
  const integ = data('integration-map.json');
  const unitsRaw = data('capability-units.json');
  const units = Array.isArray(unitsRaw) ? unitsRaw : unitsRaw.units;
  return { products, actions, integ, units };
}

// Every route the server answers, read from its source: literal paths and the /api/sessions/<id>/... patterns.
function serverRoutes() {
  const src = read('trace', 'apps', 'cli', 'src', 'server.ts');
  const out = new Map();
  const lines = src.split(/\r?\n/);
  lines.forEach((line, i) => {
    // Keyed by method and path: the same path can have a GET and a POST.
    const method = /'POST'/.test(line) ? 'POST' : 'GET';
    for (const m of line.matchAll(/path === '(\/api\/[^']+)'/g)) if (!out.has(method + ' ' + m[1])) out.set(method + ' ' + m[1], i);
    const re = /\/\^\\\/api\\\/sessions\\\/\(?\[\^\/\]\+\)?(?:\\\/([a-z]+))?/.exec(line);
    if (re) { const p = 'GET /api/sessions/<编号>' + (re[1] ? '/' + re[1] : ''); if (!out.has(p)) out.set(p, i); }
  });
  // Request fields: body.x / searchParams.get('x') between a route and the next one.
  const starts = [...out.values()].sort((a, b) => a - b);
  const fields = new Map();
  for (const [p, i] of out) {
    const next = starts.find((s) => s > i) ?? lines.length;
    const block = lines.slice(i, next).join('\n');
    const f = new Set([...block.matchAll(/body\.([a-zA-Z]+)/g)].map((m) => m[1]));
    for (const m of block.matchAll(/searchParams\.get\('([a-zA-Z]+)'\)/g)) f.add(m[1]);
    fields.set(p, [...f]);
  }
  return { routes: out, fields };
}

function adapterKinds() {
  const dir = path.join(ROOT, 'trace', 'packages', 'adapters', 'src');
  const kinds = new Set();
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (p.endsWith('.ts')) for (const m of fs.readFileSync(p, 'utf8').matchAll(/_KIND = '([a-z-]+)'/g)) kinds.add(m[1]);
    }
  };
  walk(dir);
  return kinds;
}

function check(t) {
  const problems = [];
  // Code marks are looked for in the backend and its drivers.
  const drivers = path.join(ROOT, 'trace', 'apps', 'cli', 'src', 'drivers');
  const gw = read('trace', 'apps', 'cli', 'src', 'gateway.ts') +
    (fs.existsSync(drivers) ? fs.readdirSync(drivers).map((f) => fs.readFileSync(path.join(drivers, f), 'utf8')).join('\n') : '');
  // Products: their route exists; each command still has its mark in the backend code; the host card exists.
  for (const [route, r] of Object.entries(t.products.routes)) {
    for (const [verb, v] of Object.entries(r.verbs)) if (v.codeMark && !gw.includes(v.codeMark)) problems.push(`产品表：路线 ${route} 的 ${verb} 在 gateway.ts 里找不到 ${v.codeMark}，命令可能变了`);
  }
  const kinds = adapterKinds();
  const backendRead = new Set(['antigravity', 'workbuddy', 'hermes']); // read through the backend, not a local adapter
  for (const p of t.products.products) {
    if (!t.products.routes[p.route]) problems.push(`产品表：${p.id} 的路线 ${p.route} 没有定义`);
    if (p.hostCard && !fs.existsSync(path.join(ROOT, 'channels', 'hosts', p.hostCard))) problems.push(`产品表：${p.id} 的档案卡 hosts/${p.hostCard} 不存在`);
    if (!p.hostCard) problems.push(`产品表：${p.id} 还没有档案卡`);
    if (p.readKind && !kinds.has(p.readKind) && !backendRead.has(p.readKind)) problems.push(`产品表：${p.id} 的读侧类型 ${p.readKind} 没有对应的适配器`);
  }
  // Actions: both ways against the server's routes.
  const { routes } = serverRoutes();
  const declared = new Set(t.actions.flatMap((a) => [a.path, ...(a.alias || [])].map((p) => a.method + ' ' + p)));
  for (const p of routes.keys()) if (!declared.has(p)) problems.push(`动作表：服务有接口 ${p}，表里没有`);
  for (const a of t.actions) if (!routes.has(a.method + ' ' + a.path)) problems.push(`动作表：${a.id}（${a.method} ${a.path}）服务里没有这个接口`);
  // Each action's command-line subcommand exists in the gateway.
  const cli = read('hub', 'tools', 'agent_gateway.js');
  for (const a of t.actions) for (const sub of String(a.cli || '').split('/').map((x) => x.trim()).filter(Boolean)) {
    if (!cli.includes(`sub === '${sub}'`)) problems.push(`动作表：${a.id} 写的网关子命令 ${sub} 在 agent_gateway.js 里没有`);
  }
  // Unit → action: actions exist, products exist, units exist.
  const ids = new Set(t.actions.map((a) => a.id));
  const prods = new Set(t.products.products.map((p) => p.id));
  const unitIds = new Set(t.units.map((u) => u.id));
  for (const side of ['backend', 'frontend']) {
    for (const [unit, es] of Object.entries(t.integ[side] || {})) {
      if (!unitIds.has(unit)) problems.push(`单元 → 动作：${side} 的 ${unit} 不在能力单元登记表里`);
      for (const e of es) {
        for (const id of [].concat(e.action || [])) if (!ids.has(id)) problems.push(`单元 → 动作：${unit} 引用了不存在的动作 ${id}`);
        for (const ch of e.channels || []) if (!prods.has(ch)) problems.push(`单元 → 动作：${unit} 写了不存在的产品 ${ch}`);
      }
    }
  }
  return problems;
}

function print(t) {
  const o = [];
  const P = t.products.products;
  o.push(`产品（${P.length} 个；hub/data/products.json）`);
  for (const p of P) o.push(`  ${p.id.padEnd(15)}${p.route.padEnd(9)}${(p.backend ? '后端' : '仅网关').padEnd(5)}默认 ${String(p.defaultModel || '-').padEnd(30)}会话记录 ${p.sessionStores.join('、') || '-'}`);
  o.push('', '路线上的每个动作实际执行的命令');
  for (const [route, r] of Object.entries(t.products.routes)) {
    o.push(`  ${route}：${r.does}`);
    for (const [verb, v] of Object.entries(r.verbs)) o.push(`    ${verb.padEnd(10)}${v.command}`);
  }
  const { fields } = serverRoutes();
  o.push('', `动作（${t.actions.length} 个；hub/data/actions.json，请求字段从 server.ts 抽出）`);
  for (const a of t.actions) o.push(`  ${a.id.padEnd(18)}${a.method.padEnd(5)}${a.path.padEnd(36)}${a.cli ? '［网关 ' + a.cli + '］' : ''}${a.does}${(fields.get(a.method + ' ' + a.path) || []).length ? '  〔' + fields.get(a.method + ' ' + a.path).join(' ') + '〕' : ''}`);
  const back = t.integ.backend || {};
  o.push('', `单元 → 动作（后端接了 ${Object.keys(back).length} 个单元；hub/data/integration-map.json）`);
  for (const [unit, es] of Object.entries(back)) {
    const name = (t.units.find((u) => u.id === unit) || {}).name || '';
    const parts = es.map((e) => `${[].concat(e.action || []).join('+') || '（无接口）'} ${e.status}${e.fillLevel ? '→' + e.fillLevel : ''}：${(e.channels || []).join(' ') || '-'}`);
    o.push(`  ${(unit + ' ' + name).padEnd(28)}${parts.join('；')}`);
  }
  o.push('', '现状（每一层的理论极限、目标、现状、依据）：probe/CAPABILITY_MAP.md 开头，node channels/probe/scripts/build_coverage.js 生成');
  return o.join('\n');
}

if (require.main === module) {
  const t = load();
  const problems = check(t);
  if (process.argv[2] !== 'check') console.log(print(t) + '\n');
  console.log(problems.length ? `核对：${problems.length} 处对不上\n` + problems.map((p) => '  - ' + p).join('\n') : '核对：四张表和代码全部对上');
  process.exit(process.argv[2] === 'check' && problems.length ? 1 : 0);
}
module.exports = { load, check, print };
