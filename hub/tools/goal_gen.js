// Goals written from the test questions and the matrix gaps, so nobody hand-writes a goal file, and a task's
// acceptance is its test question: done means a tester ran the question and the blackboard says pass.
// User 10-20: “先做 1 和 2：测试题当验收标准、派活单模板化（从测试题和缺口自动生成派活）。”
// Used by agent_gateway.js (subcommands test and goal-gen); the data is hub/data/capability-tests.json,
// hub/data/capability-units.json and channels/probe/capability-matrix.json.
//
//   goal-gen test --agents doubao,zcode --units open,resume [--side] [--why ..]   test these units on these products
//   goal-gen gaps --kind untested [--agents ..] [--limit 5]       cells nobody has tested yet, that have a question
//   goal-gen gaps --kind build [--layer L2|L3] [--units ..] [--limit 3]   built at one layer, not the next: build, then test
//   goal-gen gaps --kind research                                  each researcher's boundary list
// Options: --tester zcode --tester-model glm-5.3-flash --dev codex --verify claude --go (submit; else print)
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const read = (rel) => JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
const tests = () => read('hub/data/capability-tests.json');
const units = () => read('hub/data/capability-units.json').units;
const matrix = () => read('channels/probe/capability-matrix.json');
/** Products whose host card says blocked_down (channels/hosts/<card>.md): no work goes to them. Names and aliases. */
function blocked() {
  const out = new Set();
  for (const r of read('hub/data/products.json').products) {
    let card = '';
    try {
      card = fs.readFileSync(path.join(ROOT, 'channels', 'hosts', r.hostCard || ''), 'utf8');
    } catch {}
    const front = card.split(/\n---/)[0] || '';
    const st = (/^status:\s*(.+)$/m.exec(front) || [])[1] || '';
    if (/blocked_down|auth_wall/.test(st)) for (const n of [r.id, ...(r.aliases || [])]) out.add(n);
  }
  return out;
}
const list = (v) => (typeof v === 'string' ? v.split(',').map((s) => s.trim()).filter(Boolean) : []);
const newToken = () => `T${new Date().toISOString().replace(/\D/g, '').slice(4, 10)}${Math.random().toString(36).slice(2, 4).toUpperCase()}`;
const USER_WORDS =
  '用户的原话（10-20）：“我其实感觉这种最简单的测试，不应该由你来，，其他智能体做实验，如实记录结果就行，你得围绕基本能力做一个通用测试题集合了，这样其他智能体也知道怎么测，后续也可以快速复用和检测。多一个功能多一个测试题”';

/** A side instance port per product, so testers of different products running at once do not collide. */
const sidePort = (agent) => 18910 + Math.max(0, ['claude', 'codex', 'antigravity', 'zcode', 'workbuddy', 'opencode', 'hermes', 'doubao'].indexOf(agent));

/** One test question filled in for one product, as lines; null when the unit has no question. */
function renderTest(unitId, agent, token = newToken()) {
  const T = tests();
  const u = units().find((x) => x.id === unitId);
  const t = T.tests[unitId];
  if (!u || !t) return null;
  const fill = (s) => String(s).replace(/\{session\}/g, `test-${agent}`).replace(/\{agent\}/g, agent).replace(/\{token\}/g, token);
  const out = [`# 测试题：${u.name}（${u.id}）· ${agent} · 暗号 ${token}`, '', `做什么：${fill(t.do)}`, `单元定义：${u.definition}；怎样算做到：${u.judge}`];
  if (t.center) out.push('', '经中心（记 L2）：', ...t.center.map((c) => '  ' + fill(c)));
  if (t.web) out.push('', '在网页（记 L3）：' + fill(t.web));
  if (t.native) out.push('', '原生入口（记 L0）：' + fill(t.native));
  out.push('', `通过：${fill(t.pass)}`);
  if (t.fail) out.push(`当心（遇到记 fail 或 partial）：${fill(t.fail)}`);
  if (t.auto) out.push(`自动测法：${fill(t.auto)}`);
  return { unit: u, test: t, token, pass: fill(t.pass), lines: out, record: fill(T.record).replace('<单元>', u.id) };
}

/** A tester task for one product over several units: the questions in full, accepted by the questions' pass lines. */
function testTask(agent, unitIds, o, extra = {}) {
  const qs = unitIds.map((u) => renderTest(u, agent)).filter(Boolean);
  if (!qs.length) return null;
  const T = tests();
  const goal = [
    USER_WORDS,
    '',
    `照下面 ${qs.length} 道测试题在 ${agent} 上实测，一道测完记一行黑板再做下一道。题目也可以自己打印：node hub/tools/agent_gateway.js test --unit <单元> --agent ${agent}。`,
    extra.why ? `\n为什么测这些：${extra.why}` : '',
    extra.side
      ? [
          '',
          '这次测的是刚改的中心代码，8899 还在跑旧代码，所以先起一个旁路实例再测（不要重启 8899）：',
          `  1. 另开一个终端：set HUB_BACKGROUND=0 && set HUB_DATA_DIR=%TEMP%\\hub-side-test && node --no-warnings=ExperimentalWarning trace/apps/cli/src/main.ts serve --port ${sidePort(agent)}`,
          `  2. 等 http://127.0.0.1:${sidePort(agent)}/api/gateway/goals 能打开。`,
          `  3. 题里每条 agent_gateway.js 命令前都设环境变量 HUB_DAEMON_URL=http://127.0.0.1:${sidePort(agent)}（Windows：set HUB_DAEMON_URL=http://127.0.0.1:${sidePort(agent)}），记黑板时 --route 用 <产品>/L2/side-${sidePort(agent)}。`,
          '  4. 测完关掉这个旁路实例。',
        ].join('\n')
      : '',
    '',
    '通用规矩：',
    ...T.howToTest.map((h) => '- ' + h),
    '',
    `记录：${qs[0].record.replace(qs[0].unit.id, '<单元>')}`,
    '',
    ...qs.flatMap((q) => [...q.lines, '']),
    '交回：每道题一行，写单元、结果（pass/partial/fail）、黑板行号（node hub/tools/agent_gateway.js bb find --family ' + agent + ' --since <开始时间> 可查）；没过的写断在哪一步、原样报错。说的行数要和黑板对得上。',
  ].filter((l) => l !== null);
  return {
    key: extra.key || `test-${agent}`,
    title: `测试 ${agent}：${qs.map((q) => q.unit.id).join('、')}`,
    channel: testerFor(o, agent),
    ...(o.testers.length > 1 ? (TESTER_MODEL[testerFor(o, agent)] ? { model: TESTER_MODEL[testerFor(o, agent)] } : {}) : o.testerModel ? { model: o.testerModel } : {}),
    session: `tester-${agent}`,
    verifyBy: `agent:${o.verify}`,
    ...(extra.dependsOn ? { dependsOn: extra.dependsOn } : {}),
    goal: goal.join('\n'),
    acceptance:
      `黑板上本轮对 ${agent} 的每道题都有一行（用 bb find --family ${agent} --since <派活时间> 核对，行数和交回说的一致），结论和题里的“通过”判据对得上：` +
      qs.map((q) => `${q.unit.id}：${q.pass}`).join('；'),
  };
}

/** Each tester product's cheap model. */
const TESTER_MODEL = { zcode: 'glm-5.3-flash', antigravity: 'flash', claude: 'haiku' };
/** The tester for one product: --tester a,b,c spreads products over a pool (10-20 every tester queued on ZCode's
 *  three slots), the same product always to the same tester so its tester-<product> session keeps its context. */
const testerFor = (o, agent) => {
  const pool = o.testers;
  const i = [...agent].reduce((n, ch) => n + ch.charCodeAt(0), 0) % pool.length;
  return pool[i];
};

/** Products whose quota is spent or under the reserve, from the center (/api/gateway/quota), with why. A named tester
 *  skips the center's automatic pick, so the pool itself has to leave them out (10-20: “agy现在的额度也不多了，尝试调度调度”). */
function quotaShort() {
  const out = new Map();
  try {
    const r = require('child_process').spawnSync('curl.exe', ['-s', '--noproxy', '*', '--max-time', '5', `${process.env.HUB_DAEMON_URL || 'http://127.0.0.1:8899'}/api/gateway/quota`], { encoding: 'utf8', timeout: 8000, windowsHide: true });
    const j = JSON.parse(r.stdout || '{}');
    for (const [id, p] of Object.entries(j.products || {})) {
      const t = p.tightest;
      if (p.cooldown) out.set(id, p.cooldown.why);
      else if (t && t.remaining < (j.reserve || 0.2)) out.set(id, `${t.group} ${t.label} 只剩 ${Math.round(t.remaining * 100)}%`);
    }
  } catch {}
  return out;
}

function options(args) {
  let testers = list(args.tester || 'zcode');
  const short = quotaShort();
  const roomy = testers.filter((t) => !short.has(t));
  if (roomy.length && roomy.length < testers.length) {
    for (const t of testers.filter((x) => short.has(x))) console.error(`（测试员 ${t} 额度不够，这次不派给它：${short.get(t)}）`);
    testers = roomy;
  }
  return {
    testers,
    tester: testers[0],
    testerModel: args['tester-model'] || TESTER_MODEL[testers[0]],
    dev: args.dev || 'codex',
    // Claude verifies unless its quota is short (10-20 night its relay wallet was empty and every check failed).
    verify: args.verify || (short.has('claude') ? testers[0] : 'claude'),
    limit: Number(args.limit || 5),
  };
}
const BUDGET = (n) => ({ maxDispatches: Math.max(4, n * 3), maxParallel: 3, maxRework: 1, maxStall: Math.max(4, n * 2), maxWallClockMs: 12 * 3600_000 });

function goalForTests(args) {
  const o = options(args);
  const agents = list(args.agents);
  const us = list(args.units);
  if (!agents.length || !us.length) throw new Error('goal-gen test --agents a,b --units u1,u2');
  const missing = us.filter((u) => !tests().tests[u]);
  if (missing.length) throw new Error(`这些单元还没有测试题：${missing.join('、')}（test --missing 看全部）`);
  const off = agents.filter((a) => blocked().has(a));
  if (off.length) throw new Error(`这些产品在宿主卡上标了暂停（blocked_down），先看卡上写的原因：${off.join('、')}`);
  // --side: the code under test is not in 8899 yet, so each tester starts a side instance; --why says what changed.
  const tasks = agents.map((a) => testTask(a, us, o, { side: Boolean(args.side), why: args.why }));
  return { title: `测试：${us.join('、')} × ${agents.join('、')}`, objective: '照测试题实测，结果照实记进黑板', acceptance: '每道题在黑板上有一行，结论对得上判据', budget: BUDGET(tasks.length), tasks };
}

/** Cells of the matrix per product, with the place they stop at. */
function cells() {
  const m = matrix();
  const out = [];
  for (const u of m.units) for (const p of m.products) if (u.cells[p]) out.push({ unit: u, product: p, c: u.cells[p] });
  return out;
}

/** Cells with a question and nothing recorded at any place (never tested), for the products pick lets through. */
const untestedCells = (pick) => cells().filter((x) => pick(x) && ['app', 'api', 'adapter', 'front'].every((L) => !x.c[L]) && tests().tests[x.unit.id]);

/** For `test --untested`: what a tester of this product (or of every product) can just go and test. */
function untested(agent) {
  const off = blocked();
  return untestedCells((x) => !off.has(x.product) && (!agent || x.product === agent)).map((x) => ({ product: x.product, unit: x.unit.id, name: x.unit.name }));
}

function goalForGaps(args) {
  const o = options(args);
  const kind = args.kind;
  const T = tests().tests;
  const onlyAgents = list(args.agents);
  const onlyUnits = list(args.units);
  const off = blocked();
  const pick = (x) => !off.has(x.product) && (!onlyAgents.length || onlyAgents.includes(x.product)) && (!onlyUnits.length || onlyUnits.includes(x.unit.id));
  if (kind === 'untested') {
    // Nothing recorded at any place, and a question exists: a tester can just go.
    const todo = untestedCells(pick);
    const by = {};
    for (const x of todo) (by[x.product] ||= []).push(x.unit.id);
    const tasks = Object.entries(by).map(([a, us]) => testTask(a, us.slice(0, o.limit), o, { why: '矩阵里这几格在任何位置都还没有记录（一次都没测过）。' }));
    if (!tasks.length) throw new Error('没有“没测过且有题”的格子（或题还没出：test --missing）');
    return { title: `补测没测过的格子：${tasks.map((t) => t.key.replace('test-', '')).join('、')}`, objective: '矩阵里一次都没测过的格子按测试题测一遍', acceptance: '每道题在黑板上有一行', budget: BUDGET(tasks.length), tasks };
  }
  if (kind === 'build') {
    // Proven at one layer, missing at the next: native → our backend (L2), or backend → the page (L3). One dev task per
    // unit, then a tester task per product that runs the unit's question at that layer: the test is the acceptance.
    const layerOf = (x) => (/前端/.test(x.c.gap) ? 'L3' : 'L2');
    const todo = cells().filter((x) => pick(x) && /^自己做：(接进适配器|做到前端)/.test(x.c.gap || '') && T[x.unit.id] && (!args.layer || layerOf(x) === args.layer));
    const by = {};
    for (const x of todo) (by[x.unit.id] ||= { unit: x.unit, layer: /前端/.test(x.c.gap) ? 'L3' : 'L2', products: [] }).products.push(x.product);
    const chosen = Object.values(by).sort((a, b) => b.products.length - a.products.length).slice(0, o.limit);
    if (!chosen.length) throw new Error('没有“自己做”且有测试题的格子');
    const tasks = [];
    for (const g of chosen) {
      const where = g.layer === 'L3' ? '网页 /m/（m/ 目录）' : '中心（trace/apps/cli/src/gateway）';
      const q = renderTest(g.unit.id, g.products[0]);
      tasks.push({
        key: `build-${g.unit.id}`,
        title: `开发：${g.unit.name}（${g.unit.id}）接到${g.layer === 'L3' ? '网页' : '中心'}，${g.products.join('、')}`,
        channel: o.dev,
        // One developer per layer: tasks on the same files (m/index.html) wait for each other, and keep one context.
        session: g.layer === 'L3' ? 'dev-web' : 'dev-center',
        verifyBy: 'auto',
        goal: [
          `能力单元「${g.unit.name}」（${g.unit.id}）：${g.unit.definition}；怎样算做到：${g.unit.judge}。`,
          `现状：${g.products.join('、')} 在上一层已经通了（矩阵 channels/probe/capability-matrix.json，详情 CAPABILITY_MAP.md 这一单元），还没接到${where}。`,
          `要做成：把它接到${where}，让下面这道测试题在${g.layer}能过。做完由测试员照题实测，测过才算完，所以交回前自己先照题跑一遍。`,
          '',
          ...q.lines,
          '',
          '交回：改了哪些文件、为什么这样接、自己照题跑的结果。不提交 git，负责人审过再提交。',
        ].join('\n'),
        acceptance: `测试员照 ${g.unit.id} 的测试题在 ${g.layer} 测过（下一个任务）`,
      });
      for (const p of g.products) {
        const t = testTask(p, [g.unit.id], o, { key: `test-${g.unit.id}-${p}`, dependsOn: [`build-${g.unit.id}`], side: g.layer === 'L2', why: `开发任务 build-${g.unit.id} 刚把它接到${g.layer === 'L3' ? '网页' : '中心'}，这次只测 ${g.layer} 这个位置。` });
        if (t) tasks.push(t);
      }
    }
    return { title: `开发并验收：${chosen.map((g) => g.unit.id).join('、')}`, objective: '把已通的能力接到下一层，测试员照题测过才算完', acceptance: '每个开发任务后面的测试任务都过了', budget: BUDGET(tasks.length), tasks };
  }
  if (kind === 'research') {
    const R = { argon: ['antigravity', 'research-frontier'], codex: ['codex', 'research-codex'], zcode: ['zcode', 'research-acp'] };
    const tasks = Object.entries(R).map(([who, [ch, s]]) => ({
      key: who,
      title: `${who}：按边界清单打破能力边界`,
      channel: ch,
      session: s,
      verifyBy: `agent:${o.verify}`,
      goal: `任务书：channels/research/continue-20261019.md（先读它）。边界清单：channels/research/briefs/${who}-边界.md（先重跑 node channels/probe/scripts/build_coverage.js 和 node channels/probe/scripts/build_briefs.mjs）。把清单里的格子往理论上限推，结论照测试题（node hub/tools/agent_gateway.js test --unit <单元> --agent <产品>）实测，用 bb add 记。交回写清打通了哪些格（附黑板行号）、卡住的断在哪、下一步打哪片。`,
      acceptance: '黑板有本轮新打通的实测行（交回写的行号用 bb find 核对得上），或写清断点；卷宗已更新',
    }));
    return { title: '研究员按边界清单打破能力边界', objective: '三片研究员把还没到理论上限的格子往上限推', acceptance: '每位都有新打通的格子或写清断点', budget: { maxDispatches: 12, maxParallel: 3, maxRework: 1, maxStall: 6, maxWallClockMs: 12 * 3600_000 }, tasks };
  }
  throw new Error('goal-gen gaps --kind untested|build|research');
}

function generate(args) {
  const sub = args._[1];
  if (sub === 'test') return goalForTests(args);
  if (sub === 'gaps') return goalForGaps(args);
  throw new Error('goal-gen test --agents .. --units .. | goal-gen gaps --kind untested|build|research');
}

module.exports = { renderTest, generate, untested };
