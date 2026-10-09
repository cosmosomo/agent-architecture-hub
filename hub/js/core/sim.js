/* HUB.sim: definition -> simulated facts. Deterministic: same preset, same facts. */
(function () {
  'use strict';
  var HUB = (window.HUB = window.HUB || {});
  var U = HUB.util;

  var MIN = 60 * 1000;
  var SPAN = 2 * 24 * 60 * MIN;          // two simulated days
  var CASE_WINDOW = 0.28 * SPAN;         // typical length of one case; inject.at is relative to it
  var RUN_MIN = { strategy: [8, 20], research: [15, 40], debate1: [10, 25], debate2: [10, 25], build: [25, 60], qa: [10, 25], hitl: [5, 12], meta: [10, 20] };

  /* ---------- decision templates (Chinese) ---------- */
  var T = {
    hub: [
      { title: '理解需求并拆解', trigger: '收到人的需求', alternatives: ['交给一个智能体从头做到尾', '按阶段拆给几个小组'], choice: '按阶段拆给几个小组', reason: '各阶段需要的专长不同，拆开能并行', impact: '生成各阶段的任务', action: 'tool', tags: ['意图理解', '获取信息'], calls: ['read:d_goal', 'read:d_map', 'model'] },
      { title: '确定分工和顺序', trigger: '拆解完成', alternatives: ['调研和构建同时开始', '先调研再构建'], choice: '先调研再构建', reason: '没有调研结论就动手，返工风险高', impact: '把任务派给下一阶段', action: 'deliver', tags: ['分析', '决策'], calls: ['model', 'write'] }
    ],
    strategy: [
      { title: '读需求和约束', trigger: '收到派发', alternatives: ['直接按经验拆', '先读完约束再拆'], choice: '先读完约束再拆', reason: '约束决定哪些方案根本不能选', impact: '形成拆解依据', action: 'tool', tags: ['获取信息'], calls: ['read:d_goal', 'read:own', 'model'] },
      { title: '形成结论', trigger: '信息基本齐全', alternatives: ['给一个方案', '给两个方案并写清取舍'], choice: '给两个方案并写清取舍', reason: '下游需要知道放弃了什么', impact: '结论写进共享文档', action: 'tool', tags: ['分析', '判断'], calls: ['model', 'read:repeat', 'model'] },
      { title: '交付给下游', trigger: '结论写完', alternatives: ['等全部确认再交', '先交主干，细节后补'], choice: '先交主干，细节后补', reason: '下游可以先开工', impact: '交接给下一阶段', action: 'deliver', tags: ['行动'], calls: ['write'] }
    ],
    research: [
      { title: '确定检索范围', trigger: '收到调研任务', alternatives: ['只查官方资料', '官方资料加社区讨论'], choice: '官方资料加社区讨论', reason: '社区里有真实的踩坑记录', impact: '列出检索关键词', action: 'tool', tags: ['意图理解', '获取信息'], calls: ['read:d_goal', 'search', 'search', 'model'] },
      { title: '筛选可信来源', trigger: '检索结果太多', alternatives: ['全部保留', '按可信度标准筛掉一半'], choice: '按可信度标准筛掉一半', reason: '低质量来源会误导后面的判断', impact: '保留下来的来源进入整理', action: 'tool', tags: ['分析'], calls: ['fetch', 'fetch', 'model'] },
      { title: '整理结论并交付', trigger: '来源整理完', alternatives: ['交原始材料', '交整理后的结论和出处'], choice: '交整理后的结论和出处', reason: '下游没有时间读原始材料', impact: '交接给下游', action: 'deliver', tags: ['行动'], calls: ['model', 'write'] }
    ],
    debate1: [
      { title: '提出立场', trigger: '收到辩题和调研结论', alternatives: ['支持主流方案', '提出替代方案'], choice: '提出替代方案', reason: '要让取舍摆在桌面上', impact: '立场写进辩论记录', action: 'tool', tags: ['获取信息', '分析'], calls: ['read:prev', 'read:d_goal', 'model'] },
      { title: '回应质疑', trigger: '收到其他专家的质疑', alternatives: ['坚持原立场', '吸收合理部分修改立场'], choice: '吸收合理部分修改立场', reason: '质疑点有数据支撑', impact: '更新立场', action: 'request', tags: ['判断'], calls: ['read:prev', 'model'] },
      { title: '给出结论', trigger: '辩论轮次结束', alternatives: ['弃权', '投出带理由的一票'], choice: '投出带理由的一票', reason: '综合者需要每个视角的明确结论', impact: '交给综合者', action: 'deliver', tags: ['决策', '行动'], calls: ['model', 'write'] }
    ],
    build: [
      { title: '读需求和约定', trigger: '收到构建任务', alternatives: ['边做边看', '先读完约定再动手'], choice: '先读完约定再动手', reason: '约定没读清，最容易返工', impact: '确定实现范围', action: 'tool', tags: ['获取信息'], calls: ['read:d_goal', 'read:own', 'read:repeat'] },
      { title: '实现并自测', trigger: '范围确定', alternatives: ['先写全部再测', '写一块测一块'], choice: '写一块测一块', reason: '问题能尽早暴露', impact: '代码和测试', action: 'tool', tags: ['行动'], calls: ['edit', 'bash', 'model', 'bash'] },
      { title: '提交交付', trigger: '自测通过', alternatives: ['等全部完成再交', '先交可用版本'], choice: '先交可用版本', reason: '验收可以先开始', impact: '交给验收', action: 'deliver', tags: ['行动'], calls: ['write', 'model'] }
    ],
    qa: [
      { title: '按清单检查', trigger: '收到交付', alternatives: ['抽查', '按清单逐条检查'], choice: '按清单逐条检查', reason: '漏检的代价比多花时间大', impact: '得到检查记录', action: 'tool', tags: ['获取信息', '分析'], calls: ['read:prev', 'grep', 'bash', 'model'] },
      { title: '给出检查结论', trigger: '检查完成', alternatives: ['只报严重问题', '全部问题分级上报'], choice: '全部问题分级上报', reason: '小问题累积起来也会出事', impact: '结论交给判断点', action: 'deliver', tags: ['判断', '行动'], calls: ['model', 'write'] }
    ],
    hitl: [
      { title: '整理决策选项', trigger: '上一阶段完成', alternatives: ['只给推荐方案', '给三个选项并写清代价'], choice: '给三个选项并写清代价', reason: '人要知道放弃的是什么', impact: '形成呈报材料', action: 'tool', tags: ['分析'], calls: ['read:prev', 'model', 'write'] },
      { title: '呈报给人', trigger: '材料整理完', alternatives: ['等人主动来看', '直接推送给人'], choice: '直接推送给人', reason: '这一关不能自动放行', impact: '等人拍板', action: 'escalate', tags: ['行动'], calls: ['model'] }
    ],
    meta: [
      { title: '确认故障', trigger: '渠道检查失败', alternatives: ['当作偶发忽略', '连续检查三次确认'], choice: '连续检查三次确认', reason: '避免误报，也避免漏报', impact: '确认渠道不可用', action: 'tool', tags: ['获取信息'], calls: ['bash', 'bash', 'read:own'] },
      { title: '生成维护任务', trigger: '故障已确认', alternatives: ['只记日志', '暂停派活并生成维护任务'], choice: '暂停派活并生成维护任务', reason: '继续派活只会制造更多失败', impact: '这条渠道暂停派活', action: 'tool', tags: ['决策', '行动'], calls: ['model', 'write'] },
      { title: '验证恢复', trigger: '额度恢复', alternatives: ['直接恢复派活', '先试一次再恢复'], choice: '先试一次再恢复', reason: '确认真的恢复了', impact: '恢复派活', action: 'deliver', tags: ['行动'], calls: ['bash', 'model'] }
    ],
    judge: [
      { title: '核对检查结论', trigger: '收到检查结论', alternatives: ['只看结论', '抽查原始记录'], choice: '抽查原始记录', reason: '结论可能漏写问题', impact: '形成判断依据', action: 'tool', tags: ['获取信息', '分析'], calls: ['read:prev', 'model'] },
      { title: '判定是否通过', trigger: '依据齐全', alternatives: ['通过', '打回'], choice: '通过', reason: '检查项全部满足', impact: '放行到下一阶段', action: 'deliver', tags: ['决策'], calls: ['model', 'write'] }
    ]
  };
  var REQUEST_TPL = { title: '向上游要缺的资料', trigger: '工作包里缺一份该有的文档', alternatives: ['凭经验先做', '先要资料再做'], choice: '先要资料再做', reason: '缺的是约束类资料，猜错代价大', impact: '等上游补送', action: 'request', tags: ['获取信息'], calls: ['model'] };
  var UNDECLARED_TPL = { title: '直接找人要资料', trigger: '交接里缺细节', alternatives: ['等正式交接', '直接找对方要'], choice: '直接找对方要', reason: '正式交接还要等很久', impact: '编排里没有这条线', action: 'request', tags: ['获取信息'], calls: ['model'] };

  function simulate(cd) {
    var def = cd.def;
    var O = cd.override || {};
    var SC = O.scenario || {};
    var R = U.rng('sim:' + cd.id);
    var ind = U.byId(def.individuals);
    var stages = def.process.stages;
    var stageMap = U.byId(stages);
    var gatesAfter = U.groupBy(def.process.gates, function (g) { return g.afterStage; });
    var hub = def.individuals.find(function (x) { return x.isHub; });
    var agents = def.individuals.filter(function (x) { return x.kind === 'agent'; });
    var taskRels = def.relations.filter(function (r) { return r.type === 'task'; });
    var relFromTo = {};
    taskRels.forEach(function (r) { var k = r.from + '>' + r.to; if (!relFromTo[k]) relFromTo[k] = r; });

    var F = {
      synthetic: true, span: { start: 0, end: SPAN },
      cases: [], tasks: [], runs: [], decisions: [], calls: [], handoffs: [], deliveries: [],
      gateEvents: [], channelEvents: [], versionEvents: [], actions: [], messages: []
    };
    var seq = { t: 0, u: 0, d: 0, c: 0, h: 0, v: 0, g: 0, e: 0 };
    var nid = function (k, p) { seq[k] += 1; return p + seq[k]; };

    /* ---------- scenario with defaults ---------- */
    var execSet = {};
    stages.forEach(function (s) { s.steps.forEach(function (st) { st.executors.forEach(function (x) { execSet[x] = (execSet[x] || 0) + 1; }); }); });
    var gateDeciders = {};
    def.process.gates.forEach(function (g) { if (g.decider && g.decider.who) gateDeciders[g.decider.who] = true; });

    var never = new Set(SC.neverDispatch || defaultNever());
    function defaultNever() {
      if (agents.length < 10) return [];
      var cands = [];
      stages.forEach(function (s) {
        s.steps.forEach(function (st) {
          if (st.executors.length < 3) return;
          st.executors.forEach(function (x) {
            var a = ind.get(x);
            if (a && !a.isHub && a.phase !== 'hitl' && a.agentId !== 'qa_manager' && !gateDeciders[x]) cands.push(x);
          });
        });
      });
      var k = agents.length >= 16 ? 2 : 1, out = [];
      var r2 = U.rng('never:' + cd.id);
      while (out.length < k && cands.length) out.push(cands.splice(Math.floor(r2() * cands.length), 1)[0]);
      return out;
    }

    var agentGate = def.process.gates.find(function (g) { return g.decider.type === 'agent'; }) || def.process.gates[def.process.gates.length - 1];
    var humanGate = def.process.gates.find(function (g) { return g.decider.type === 'human'; });
    var midExec = (function () {
      var s = stages[Math.min(stages.length - 1, Math.max(1, Math.floor(stages.length / 2)))];
      var list = s ? s.steps[0].executors.filter(function (x) { return !never.has(x) && !ind.get(x).isHub; }) : [];
      return list[0] || (agents[1] || agents[0] || {}).id;
    })();
    var specs = (SC.cases && SC.cases.length) ? SC.cases : [
      { id: 'K1', name: '案例 1：第一次完整运行', rework: agentGate ? { gate: agentGate.id, times: 1 } : null, missing: midExec ? [{ ind: midExec, doc: 'd_terms' }] : [] },
      { id: 'K2', name: '案例 2：同类需求，再跑一次' },
      { id: 'K3', name: '案例 3：正在进行的需求', blockedAt: humanGate ? humanGate.id : (agentGate ? agentGate.id : null),
        inject: midExec ? [{ at: 0.35, to: midExec, kind: 'instruction', text: '先交付核心部分，细节下一轮再补' }] : [] }
    ];
    var undeclared = SC.undeclared || defaultUndeclared();
    function defaultUndeclared() {
      var late = stages.slice(Math.floor(stages.length / 2));
      var early = stages.slice(0, Math.max(1, Math.floor(stages.length / 2)));
      for (var i = 0; i < late.length; i++) {
        var a = late[i].steps[0].executors.find(function (x) { return !never.has(x); });
        for (var j = 0; j < early.length; j++) {
          var b = early[j].steps[0].executors.find(function (x) { return !never.has(x) && !ind.get(x).isHub; });
          if (a && b && a !== b && !relFromTo[a + '>' + b] && !relFromTo[b + '>' + a]) return [[a, b, '直接找对方要资料']];
        }
      }
      return [];
    }
    var outages = SC.outage || (function () {
      var c = {};
      agents.forEach(function (x) { c[x.model] = (c[x.model] || 0) + 1; });
      var best = Object.keys(c).sort(function (a, b) { return c[b] - c[a]; })[0];
      return best ? [{ channel: 'ch_' + best, at: 0.55, dur: 0.05, kind: 'quota', note: '额度用完' }] : [];
    })();
    var reworkPlanned = specs.some(function (s) { return s.rework; });
    var versionChanges = SC.versionChanges || [{ at: 0.66, note: reworkPlanned ? '根据第一次返工，把验收要点加进构建组的工作包' : '调整资料地图的入口', by: 'human' }];

    /* ---------- versions ---------- */
    versionChanges.slice().sort(function (a, b) { return a.at - b.at; }).forEach(function (v, i) {
      var by = v.by && ind.get(v.by) ? ind.get(v.by).name : (v.by === 'human' || !v.by ? '人（用户）' : v.by);
      F.versionEvents.push({ id: nid('v', 've'), at: Math.round(v.at * SPAN), version: 'v' + (i + 2), note: v.note, by: by });
    });
    var versionAt = function (t) {
      var v = 'v1';
      F.versionEvents.forEach(function (e) { if (e.at <= t) v = e.version; });
      return v;
    };

    /* ---------- channel outages ---------- */
    var windows = outages.map(function (o) {
      var s = Math.round(o.at * SPAN), e = Math.round((o.at + o.dur) * SPAN);
      return { channel: o.channel, start: s, end: e, kind: o.kind || 'outage', note: o.note || (o.kind === 'quota' ? '额度用完' : '渠道中断') };
    });
    var outageAt = function (channelId, t0, t1) {
      return windows.find(function (w) { return w.channel === channelId && t0 < w.end && t1 > w.start; });
    };

    /* ---------- helpers ---------- */
    var addTask = function (o) {
      var t = { id: nid('t', 't'), caseId: o.caseId, parentId: o.parentId || null, name: o.name, stepId: o.stepId || null,
        assignee: o.assignee, status: o.status || 'done', created: o.created, started: o.started || null, done: o.done || null, visit: o.visit || 1 };
      F.tasks.push(t);
      return t;
    };
    var docName = function (id) { var d = def.docs.find(function (x) { return x.id === id; }); return d ? d.name : id; };
    var chFor = function (x, kind) {
      var want = { read: 'ch_tool_read', search: 'ch_tool_websearch', fetch: 'ch_tool_webfetch', write: 'ch_tool_write', edit: 'ch_tool_edit', bash: 'ch_tool_bash', grep: 'ch_tool_grep' }[kind];
      if (want && x.channels.indexOf(want) >= 0) return want;
      if (kind === 'read' && x.channels.indexOf('ch_tool_webfetch') >= 0) return 'ch_tool_webfetch';
      if ((kind === 'edit' || kind === 'write') && x.channels.indexOf('ch_tool_write') >= 0) return 'ch_tool_write';
      var tool = x.channels.find(function (c) { return c.indexOf('ch_tool_') === 0; });
      return tool || 'ch_' + (x.model || 'sonnet');
    };
    var templatesFor = function (x, role) {
      if (role === 'judge') return T.judge;
      if (x.kind === 'meta') return T.meta;
      if (x.isHub) return T.hub;
      return T[x.phase] || T.build;
    };

    /* ---------- one run ---------- */
    function doRun(task, x, start, kase, opts) {
      opts = opts || {};
      var phase = x.kind === 'meta' ? 'meta' : (x.phase || 'build');
      var range = opts.short ? [4, 12] : (RUN_MIN[phase] || [10, 30]);
      var dur = R.int(range[0], range[1]) * MIN;
      var modelCh = 'ch_' + (x.model || 'sonnet');
      var hit = x.kind === 'meta' ? null : outageAt(modelCh, start, start + dur);
      var outcome = 'deliver', end = start + dur;
      if (hit) {
        if (start >= hit.start) { end = start + R.int(2, 4) * MIN; outcome = 'failed'; }
        else { end = hit.start + R.int(0, 2) * MIN; outcome = 'interrupted'; }
      }
      if (opts.outcome && outcome === 'deliver') outcome = opts.outcome;
      var run = {
        id: nid('u', 'u'), taskId: task.id, caseId: kase ? kase.id : null, individualId: x.id, start: start, end: end,
        outcome: outcome, version: versionAt(start), model: x.model, tokens: 0,
        coverage: { indexed: 0, metaOnly: 0, truncated: 0 }
      };
      F.runs.push(run);
      // context delivered at run start (the work package)
      var missing = (opts.missing || []);
      x.docs.forEach(function (d) {
        var miss = missing.indexOf(d) >= 0;
        F.deliveries.push({ id: nid('e', 'dv'), runId: run.id, individualId: x.id, docId: d, kind: 'context', text: docName(d),
          at: start, status: miss ? 'missing' : 'delivered', confirmed: !miss, by: hub ? hub.id : 'human' });
      });
      genDecisions(run, x, opts, missing);
      return run;
    }

    function genDecisions(run, x, opts, missing) {
      var curated = (O.decisions || {})[x.id];
      var base = templatesFor(x, opts.role);
      var list = [];
      if (curated && curated.length && !opts.role) {
        list.push(base[0]);
        var k0 = (opts.visitIndex || 0) % curated.length;
        for (var i = 0; i < Math.min(2, curated.length); i++) {
          var c = curated[(k0 + i) % curated.length];
          list.push({ title: c.title, trigger: c.trigger || '', alternatives: c.alternatives || [], choice: c.choice, reason: c.reason || '',
            impact: c.impact || '', action: c.action || 'deliver', tags: c.action === 'deliver' ? ['决策', '行动'] : ['分析', '判断'],
            calls: c.action === 'deliver' ? ['model', 'write'] : c.action === 'tool' ? ['model', 'bash'] : ['model'], curated: true });
        }
      } else {
        list = base.slice();
      }
      if (missing && missing.length) list.splice(Math.max(1, list.length - 1), 0, REQUEST_TPL);
      if (opts.undeclared) list.splice(Math.max(1, list.length - 1), 0, UNDECLARED_TPL);
      if (opts.judgeResult === 'fail') {
        list = list.slice();
        var last = Object.assign({}, list[list.length - 1]);
        last.choice = '打回'; last.reason = '有检查项没有满足'; last.impact = '退回上一阶段返工'; last.action = 'escalate';
        list[list.length - 1] = last;
      }
      if (run.outcome === 'failed' || run.outcome === 'interrupted') list = list.slice(0, 1);

      var n = list.length, win = run.end - run.start;
      var readSoFar = [];
      var repeatReads = 0;
      list.forEach(function (tp, k) {
        var dStart = run.start + Math.floor(win * k / n), dEnd = run.start + Math.floor(win * (k + 1) / n);
        var dec = {
          id: nid('d', 'dc'), runId: run.id, idx: k, start: dStart, end: dEnd,
          action: tp.action, title: tp.title, trigger: tp.trigger, alternatives: (tp.alternatives || []).slice(),
          choice: tp.choice, reason: tp.reason, impact: tp.impact,
          outcome: 'confirmed', stageTags: (tp.tags || []).slice(), evidence: [], unsupported: [], curated: !!tp.curated
        };
        if (k === n - 1 && opts.overturned) dec.outcome = 'overturned';
        if (run.outcome === 'running') dec.outcome = 'pending';
        if (R.chance(0.12) && !tp.curated) dec.unsupported.push('reason');
        F.decisions.push(dec);
        // calls inside the decision window
        var kinds = (tp.calls || ['model']).slice();
        if (win > 30 * MIN && R.chance(0.35)) kinds.splice(1, 0, 'read:repeat');
        var durs = kinds.map(function (kd) { return kd === 'model' ? R.int(6, 45) * 1000 : kd === 'search' || kd === 'fetch' ? R.int(2, 9) * 1000 : R.int(1, 6) * 1000; });
        var total = U.sum(durs), room = Math.max(1000, (dEnd - dStart) * 0.8);
        var scale = total > room ? room / total : 1;
        var gap = Math.max(0, ((dEnd - dStart) - total * scale) / (kinds.length + 1));
        var t = dStart + gap * 0.5;
        var failed = run.outcome === 'failed' || run.outcome === 'interrupted';
        kinds.forEach(function (kd, ci) {
          var d = Math.max(400, Math.round(durs[ci] * scale));
          var kind = kd.split(':')[0], arg = kd.split(':')[1];
          var call = { id: nid('c', 'c'), runId: run.id, decisionId: dec.id, parentId: null, kind: kind === 'model' ? 'model' : 'tool',
            name: '', channelId: '', start: Math.round(t), end: Math.round(t + d), tokensIn: 0, tokensOut: 0, status: 'ok', repeat: false,
            input: '', output: '', context: null };
          if (kind === 'model') {
            call.channelId = 'ch_' + (x.model || 'sonnet');
            call.name = '模型调用：' + tp.title;
            var callIdx = F.calls.filter(function (c) { return c.runId === run.id && c.kind === 'model'; }).length;
            var ctx = { task: R.int(1200, 2600), consensus: R.int(700, 1800), tools: R.int(800, 2000) + callIdx * R.int(2500, 6000), dialog: R.int(400, 1400) + callIdx * 300 };
            call.context = ctx;
            call.tokensIn = ctx.task + ctx.consensus + ctx.tools + ctx.dialog;
            call.tokensOut = R.int(180, 1600);
            call.input = '系统提示、任务说明和 ' + Math.max(1, readSoFar.length) + ' 份读到的资料';
            call.output = tp.choice ? tp.title + '：' + tp.choice : tp.title;
          } else {
            var tool = kind === 'read' ? 'read' : kind;
            call.channelId = chFor(x, tool);
            if (kind === 'read') {
              var docId = arg === 'own' ? (x.docs.find(function (d) { return d.indexOf('d_role_') !== 0 && ['d_goal', 'd_terms', 'd_map'].indexOf(d) < 0; }) || x.docs[0])
                : arg === 'prev' ? null : arg === 'repeat' ? (readSoFar[0] || 'd_goal') : arg;
              if (arg === 'repeat' || (docId && readSoFar.indexOf(docId) >= 0)) { call.repeat = true; repeatReads++; }
              if (docId && missing && missing.indexOf(docId) >= 0) { call.status = 'error'; call.output = '没找到这份文档'; }
              call.name = '读取 ' + (arg === 'prev' ? '上游交付物' : docName(docId));
              call.input = arg === 'prev' ? '上游交付物' : docName(docId);
              if (call.status === 'ok') call.output = '读到 ' + R.int(3, 18) + ' 段';
              if (docId && readSoFar.indexOf(docId) < 0) readSoFar.push(docId);
              run.coverage.metaOnly += 1;
            } else if (kind === 'search') {
              call.name = '网页搜索'; call.input = tp.title + ' 相关关键词'; call.output = '返回 ' + R.int(6, 20) + ' 条结果';
            } else if (kind === 'fetch') {
              call.name = '抓取网页'; call.input = '候选来源'; call.output = '正文 ' + R.int(2, 9) + ' 千字'; run.coverage.truncated += R.chance(0.4) ? 1 : 0;
            } else if (kind === 'write') {
              call.name = '写入交付物'; call.input = tp.impact || '交付物'; call.output = '写入 1 个文件';
            } else if (kind === 'edit') {
              call.name = '修改代码'; call.input = '实现范围'; call.output = '改动 ' + R.int(2, 9) + ' 个文件';
            } else if (kind === 'bash') {
              call.name = '运行命令'; call.input = '测试或检查'; call.output = R.chance(0.8) ? '通过 ' + R.int(8, 60) + ' 项' : '失败 ' + R.int(1, 3) + ' 项，已重试';
              if (/失败/.test(call.output)) call.status = 'retry';
            } else if (kind === 'grep') {
              call.name = '内容搜索'; call.input = '检查项关键词'; call.output = '命中 ' + R.int(1, 30) + ' 处';
            }
            call.tokensIn = 0; call.tokensOut = 0;
          }
          var hitCall = outageAt(call.channelId, call.start, call.end);
          if (failed && ci === kinds.length - 1) { call.status = 'error'; call.output = '渠道不可用：' + ((hitCall && hitCall.note) || '中断'); }
          else if (hitCall && call.kind === 'model') { call.status = 'error'; call.output = '渠道不可用：' + hitCall.note; }
          F.calls.push(call);
          dec.evidence.push(call.id);
          run.tokens += call.tokensIn + call.tokensOut;
          run.coverage.indexed += 1;
          t += d + gap;
          if (failed && ci === 0 && kinds.length > 1) { /* failed runs stop early */ }
        });
      });
      run.coverage.repeatReads = repeatReads;
    }

    /* ---------- one case ---------- */
    var specCount = specs.length;
    var lastRunsOfStage = {};
    specs.forEach(function (spec, si) {
      var startAt = Math.round((0.02 + si * (0.7 / Math.max(1, specCount - 1 || 1)) * (specCount > 1 ? 1 : 0)) * SPAN);
      if (specCount === 1) startAt = Math.round(0.02 * SPAN);
      if (specCount > 1) startAt = Math.round((0.02 + si * (0.68 / (specCount - 1))) * SPAN);
      runCase(spec, si, startAt);
    });

    function runCase(spec, si, startAt) {
      var kase = { id: spec.id, name: spec.name || ('案例 ' + (si + 1)), start: startAt, end: null, status: 'running', path: [], waitingAt: null, rootTask: null };
      F.cases.push(kase);
      var t = startAt;
      var root = addTask({ caseId: kase.id, name: kase.name, assignee: hub ? hub.id : 'human', status: 'running', created: t, started: t });
      kase.rootTask = root.id;
      kase.path.push({ node: 'start', at: t });
      if (hub) F.handoffs.push({ id: nid('h', 'h'), caseId: kase.id, from: 'human', to: hub.id, fromTask: null, toTask: root.id, at: t,
        relationId: (relFromTo['human>' + hub.id] || {}).id || null, carried: ['d_goal'], missing: [], note: '提出需求' });
      var missingByInd = {};
      (spec.missing || []).forEach(function (m) { (missingByInd[m.ind] = missingByInd[m.ind] || []).push(m.doc); });
      var visits = {}, reworkCount = 0;
      var prevExecs = hub ? [hub.id] : ['human'];
      var prevTasks = {};
      prevTasks[prevExecs[0]] = root.id;
      var cur = stages.length ? stages[0].id : 'done';
      var guard = 0, stopped = false;
      var undeclaredDone = si !== 0;

      while (cur !== 'done' && guard++ < 40) {
        var st = stageMap.get(cur);
        if (!st) break;
        visits[cur] = (visits[cur] || 0) + 1;
        if (visits[cur] > 3) break;
        kase.path.push({ node: cur, at: t });
        if (spec.blockedAt === cur) { stopped = true; kase.waitingAt = cur; break; }
        var isRework = visits[cur] > 1;
        lastRunsOfStage[kase.id + cur] = [];
        for (var k = 0; k < st.steps.length; k++) {
          var step = st.steps[k];
          var execs = step.executors.filter(function (x) { return !never.has(x) && ind.has(x); });
          if (!execs.length) continue;
          var ends = [], tasksNow = {};
          execs.forEach(function (x) {
            var a = ind.get(x);
            var task = addTask({ caseId: kase.id, parentId: root.id, name: step.name + (isRework ? '（返工）' : ''), stepId: step.id,
              assignee: x, status: 'done', created: t, visit: visits[cur] });
            tasksNow[x] = task.id;
            // handoffs into this executor
            var froms = prevExecs.filter(function (p) { return relFromTo[p + '>' + x]; });
            if (!froms.length) {
              var anyIn = taskRels.find(function (r) { return r.to === x && r.sub !== 'report' && (r.from === 'human' || F.runs.some(function (u) { return u.caseId === kase.id && u.individualId === r.from; })); });
              if (anyIn) froms = [anyIn.from];
            }
            var s = t + R.int(1, 6) * MIN;
            froms.forEach(function (p) {
              var miss = (missingByInd[x] || []).slice();
              var carried = a.docs.filter(function (d) { return d.indexOf('d_role_') !== 0 && miss.indexOf(d) < 0; }).slice(0, 4);
              F.handoffs.push({ id: nid('h', 'h'), caseId: kase.id, from: p, to: x, fromTask: prevTasks[p] || null, toTask: task.id, at: s,
                relationId: relFromTo[p + '>' + x].id, carried: carried, missing: miss, note: '' });
            });
            var run = doRun(task, a, s, kase, { missing: missingByInd[x] || [], visitIndex: visits[cur] - 1 });
            var lastRun = run;
            if (run.outcome === 'failed' || run.outcome === 'interrupted') {
              var w = outageAt('ch_' + a.model, run.start, run.end + MIN) || windows[0];
              var s2 = (w ? w.end : run.end) + R.int(2, 6) * MIN;
              lastRun = doRun(task, a, s2, kase, { visitIndex: visits[cur] - 1 });
            }
            task.started = run.start; task.done = lastRun.end;
            ends.push(lastRun.end);
            lastRunsOfStage[kase.id + cur].push(lastRun.id);
            // the scripted "undeclared" handoff happens in the first case, from this executor
            if (!undeclaredDone) {
              undeclared.forEach(function (u) {
                if (u[0] !== x) return;
                F.handoffs.push({ id: nid('h', 'h'), caseId: kase.id, from: u[0], to: u[1], fromTask: task.id, toTask: null,
                  at: lastRun.start + Math.round((lastRun.end - lastRun.start) * 0.4), relationId: null, carried: [], missing: [], note: u[2] || '编排里没有这条线' });
                var extra = F.decisions.filter(function (d) { return d.runId === lastRun.id; })[0];
                if (extra) {
                  F.decisions.push({ id: nid('d', 'dc'), runId: lastRun.id, idx: 99, start: extra.end, end: extra.end + 2 * MIN,
                    action: 'request', title: '直接找' + (ind.get(u[1]) || {}).name + '要资料', trigger: u[2] || '交接里缺细节',
                    alternatives: UNDECLARED_TPL.alternatives.slice(), choice: UNDECLARED_TPL.choice, reason: UNDECLARED_TPL.reason,
                    impact: '编排里没有这条线', outcome: 'confirmed', stageTags: ['获取信息'], evidence: [], unsupported: ['reason'], curated: false });
                }
                undeclaredDone = true;
              });
            }
          });
          prevExecs = execs;
          prevTasks = tasksNow;
          t = Math.max.apply(null, ends) + R.int(2, 8) * MIN;
          if (t > SPAN * 0.985) { stopped = true; break; }
        }
        if (stopped) break;
        var gs = gatesAfter.get(cur) || [];
        var next = stages[st.order + 1] ? stages[st.order + 1].id : 'done';
        var moved = false;
        for (var gi = 0; gi < gs.length; gi++) {
          var g = gs[gi];
          kase.path.push({ node: g.id, at: t });
          if (spec.blockedAt === g.id) { stopped = true; kase.waitingAt = g.id; break; }
          var wait = g.decider.type === 'human' ? R.int(20, 80) * MIN : g.decider.type === 'agent' ? R.int(3, 10) * MIN : R.int(0, 2) * MIN;
          var fail = spec.rework && spec.rework.gate === g.id && reworkCount < (spec.rework.times || 1);
          var decider = g.decider.who && ind.get(g.decider.who);
          if (g.decider.type === 'agent' && decider && decider.kind === 'agent' && !never.has(decider.id)) {
            var jt = addTask({ caseId: kase.id, parentId: root.id, name: '判断：' + g.name, stepId: null, assignee: decider.id, status: 'done', created: t });
            var jr = doRun(jt, decider, t + MIN, kase, { role: 'judge', short: true, judgeResult: fail ? 'fail' : 'pass' });
            jt.started = jr.start; jt.done = jr.end;
            t = jr.end;
          } else {
            t += wait;
          }
          var queue = F.cases.filter(function (c) { return c.waitingAt === g.id; }).length;
          if (fail) {
            reworkCount++;
            F.gateEvents.push({ id: nid('g', 'ge'), caseId: kase.id, gateId: g.id, at: t, result: 'fail', by: decider ? decider.id : (g.decider.type === 'human' ? 'human' : 'rule'), queue: queue });
            var target = g.fail || cur;
            (lastRunsOfStage[kase.id + target] || lastRunsOfStage[kase.id + cur] || []).forEach(function (rid) {
              var ds = F.decisions.filter(function (d) { return d.runId === rid; });
              if (ds.length) ds[ds.length - 1].outcome = 'overturned';
              var rr = F.runs.find(function (u) { return u.id === rid; });
              var tk = rr && F.tasks.find(function (x) { return x.id === rr.taskId; });
              if (tk) tk.status = 'rework';
            });
            prevExecs = decider ? [decider.id] : prevExecs;
            cur = target;
            moved = true;
            break;
          }
          F.gateEvents.push({ id: nid('g', 'ge'), caseId: kase.id, gateId: g.id, at: t, result: 'pass', by: decider ? decider.id : (g.decider.type === 'human' ? 'human' : 'rule'), queue: queue });
          if (gi === gs.length - 1) { cur = g.pass || next; moved = true; }
        }
        if (stopped) break;
        if (!moved) cur = next;
        t += R.int(1, 5) * MIN;
      }

      if (stopped || cur !== 'done') {
        kase.status = kase.waitingAt ? 'blocked' : 'running';
        kase.end = null;
        root.status = 'running';
      } else {
        kase.path.push({ node: 'done', at: t });
        kase.end = t;
        kase.status = 'done';
        root.status = 'done';
        root.done = t;
        // report back to the hub
        taskRels.filter(function (r) { return r.sub === 'report'; }).forEach(function (r) {
          if (F.runs.some(function (u) { return u.caseId === kase.id && u.individualId === r.from; })) {
            F.handoffs.push({ id: nid('h', 'h'), caseId: kase.id, from: r.from, to: r.to, fromTask: null, toTask: root.id, at: t, relationId: r.id, carried: [], missing: [], note: '汇报' });
          }
        });
      }
      // instructions injected while this case runs (at is relative to the case window)
      (spec.inject || []).forEach(function (j) {
        var at = Math.round(kase.start + (j.at || 0.5) * CASE_WINDOW);
        var target = ind.get(j.to);
        if (!target) return;
        var covering = F.runs.find(function (u) { return u.individualId === j.to && u.start <= at && u.end >= at; });
        var nextRun = covering || F.runs.filter(function (u) { return u.individualId === j.to && u.start >= at; }).sort(function (a, b) { return a.start - b.start; })[0];
        F.deliveries.push({ id: nid('e', 'dv'), runId: nextRun ? nextRun.id : null, individualId: j.to, docId: null, kind: j.kind || 'instruction',
          text: j.text || '新指令', at: covering ? at : (nextRun ? nextRun.start : at), status: nextRun ? 'delivered' : 'pending',
          confirmed: !!covering, by: 'human' });
      });
    }

    /* ---------- maintenance runs for outages ---------- */
    var maint = ind.get('meta_maint');
    windows.forEach(function (w) {
      var chName = (def.channels.find(function (c) { return c.id === w.channel; }) || {}).name || w.channel;
      F.channelEvents.push({ id: nid('g', 'ce'), channelId: w.channel, at: w.start, kind: w.kind === 'quota' ? 'quota' : 'outage', note: w.note });
      F.channelEvents.push({ id: nid('g', 'ce'), channelId: w.channel, at: w.start + 3 * MIN, kind: 'maint_task', note: '渠道维护者生成维护任务，暂停在这条渠道上派活' });
      F.channelEvents.push({ id: nid('g', 'ce'), channelId: w.channel, at: w.end - 2 * MIN, kind: 'maint_done', note: '维护完成，试调用一次成功' });
      F.channelEvents.push({ id: nid('g', 'ce'), channelId: w.channel, at: w.end, kind: 'recover', note: '恢复派活' });
      if (maint) {
        var mt = addTask({ caseId: null, name: '维护：' + chName, assignee: maint.id, status: 'done', created: w.start + 3 * MIN });
        var mr = doRun(mt, maint, w.start + 3 * MIN, null, {});
        mr.end = Math.max(mr.end, w.end - MIN);
        mt.started = mr.start; mt.done = mr.end;
      }
    });

    F.runs.sort(function (a, b) { return a.start - b.start; });
    F.handoffs.sort(function (a, b) { return a.at - b.at; });
    F.deliveries.sort(function (a, b) { return a.at - b.at; });
    F.channelEvents.sort(function (a, b) { return a.at - b.at; });
    F.never = Array.from(never);
    return F;
  }

  HUB.sim = { simulate: simulate, SPAN: SPAN, MIN: MIN, CASE_WINDOW: CASE_WINDOW };
})();
