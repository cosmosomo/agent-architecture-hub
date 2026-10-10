/* HUB.casedef: one v41 preset (+ optional curated override) -> the definition layer. */
(function () {
  'use strict';
  var HUB = (window.HUB = window.HUB || {});
  var U = HUB.util;

  var PHASE_ORDER = ['strategy', 'research', 'debate1', 'build', 'debate2', 'qa', 'hitl'];
  var PHASE_ZH = { strategy: '战略', research: '调研', debate1: '五心智辩论', debate2: '五心智复议', build: '构建', qa: '质检', hitl: '人工把关' };
  var STEP_ZH = { strategy: '拆解与规划', research: '并行调研', debate1: '专家辩论', build: '构建实现', debate2: '专家复议', qa: '质量验收', hitl: '整理决策选项' };
  // concurrency limits: how many runs (model channels) or calls (tool channels) may use a channel at the same time
  var LIMIT = { opus: 2, sonnet: 4, haiku: 6, fable: 1 };
  var TOOL_LIMIT = { websearch: 4, webfetch: 4 };
  var CAPACITY = { opus: '并发 2', sonnet: '并发 4', haiku: '并发 6', fable: '并发 1' };
  // Function channels: outside capabilities with a session and an owner (a logged-in browser, an account),
  // usually exclusive. They are given to the agents whose work needs them.
  var FN_CHANNELS = {
    ch_fn_xhs: { name: 'OpenCLI · 小红书', capacity: '独占：一个登录的浏览器会话，不能并发', quota: '每小时约 60 次访问', limit: 1,
      agents: ['res_x', 'res_reddit', 'social_strategist'] },
    ch_fn_boss: { name: 'OpenCLI · BOSS直聘', capacity: '独占：一个登录的浏览器会话，不能并发', quota: '每小时约 40 次访问', limit: 1,
      agents: ['career_document_builder'] }
  };
  // Capabilities an agent brings with it (its host), registered to that individual only; they get no node in the shared layer.
  var NATIVE_FROM_TOOL = {
    Agent: { host: 'Claude Code', name: '派生子智能体并行执行', short: '派生子智能体', limit: 10,
      note: '宿主自带：在一次运行里派出多个子智能体同时干活，再把结果收回来' }
  };
  function limitFrom(cap) { var m = /并发\s*(\d+)/.exec(cap || ''); return m ? Number(m[1]) : null; }
  var QUOTA = { opus: '每日 800 万 token', sonnet: '每日 2000 万 token', haiku: '每日 5000 万 token', fable: '每日 300 万 token' };
  var MODEL_ZH = { opus: 'Opus', sonnet: 'Sonnet', haiku: 'Haiku', fable: 'Fable' };

  function zh() { return HUB.zh || {}; }
  function agentName(id) {
    var z = zh().agents && zh().agents[id];
    var a = HUB.base.agents[id];
    return (z && z.name) || (a && a.nameEn) || id;
  }
  function agentRole(id) {
    var z = zh().agents && zh().agents[id];
    var a = HUB.base.agents[id];
    return (z && z.role) || (a && a.roleEn) || '';
  }
  function phaseName(p) { return (zh().phases && zh().phases[p]) || PHASE_ZH[p] || p; }
  function toolName(t) { return (zh().tools && zh().tools[t]) || t; }
  function presetName(id) {
    var z = zh().presets && zh().presets[id];
    var p = HUB.base.presets[id];
    return (z && z.name) || (p && p.nameEn) || id;
  }
  function presetSummary(id) {
    var z = zh().presets && zh().presets[id];
    var p = HUB.base.presets[id];
    return (z && z.summary) || (p && p.descEn) || '';
  }
  function presetFlow(id) {
    var z = zh().presets && zh().presets[id];
    var p = HUB.base.presets[id];
    return (z && z.flow) || (p && p.flow) || '';
  }

  function build(presetId) {
    var B = HUB.base;
    var P = B.presets[presetId];
    if (!P) throw new Error('unknown preset ' + presetId);
    var O = (HUB.cases || {})[presetId] || null;
    var OI = (O && O.individuals) || {};

    /* ---------- individuals ---------- */
    var counts = {}, seen = {};
    P.nodes.forEach(function (n) { counts[n.d] = (counts[n.d] || 0) + 1; });
    var minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    P.nodes.forEach(function (n) { minX = Math.min(minX, n.x); maxX = Math.max(maxX, n.x); minY = Math.min(minY, n.y); maxY = Math.max(maxY, n.y); });
    var hubIndex = -1;
    var individuals = P.nodes.map(function (n, i) {
      var a = B.agents[n.d] || { phase: 'build', model: 'sonnet', tools: '' };
      seen[n.d] = (seen[n.d] || 0) + 1;
      var name = agentName(n.d) + (counts[n.d] > 1 ? ' #' + seen[n.d] : '');
      if (n.d === 'orchestrator' && hubIndex < 0) hubIndex = i;
      var ov = OI['n' + i] || {};
      return {
        id: 'n' + i, agentId: n.d, kind: 'agent', name: name,
        model: n.m || a.model || 'sonnet', phase: a.phase || 'build', groupId: null,
        role: ov.role || agentRole(n.d), trigger: ov.trigger || '', watches: (ov.watches || []).slice(),
        docs: [], channels: [], natives: [], host: 'Claude Code', tools: U.toolList(a.tools),
        x: n.x, y: n.y, isHub: false, enhanced: false
      };
    });
    if (hubIndex >= 0) individuals[hubIndex].isHub = true;
    var spanX = Math.max(200, maxX - minX);
    var human = {
      id: 'human', agentId: null, kind: 'human', name: '人（用户）', model: null, phase: null, groupId: null,
      role: (OI.human && OI.human.role) || '提出需求，在人工关拍板，随时通过中枢智能体或直接对个体下指令',
      trigger: '自己决定', watches: [], docs: [], channels: [], natives: [], host: null, tools: [],
      x: maxX + spanX * 0.18, y: minY, isHub: false, enhanced: true
    };
    var maint = {
      id: 'meta_maint', agentId: null, kind: 'meta', name: '渠道维护者', model: 'haiku', phase: null, groupId: null,
      role: (OI.meta_maint && OI.meta_maint.role) || '盯着模型和工具渠道，出故障时生成维护任务并跟进恢复',
      trigger: '渠道检查失败或额度告警', watches: [], docs: [], channels: [], natives: [], host: 'Claude Code', tools: ['Read', 'Bash'],
      x: maxX + spanX * 0.18, y: maxY, isHub: false, enhanced: true
    };
    individuals.push(human, maint);
    var indMap = U.byId(individuals);
    var nodeIds = individuals.filter(function (x) { return x.kind === 'agent'; }).map(function (x) { return x.id; });
    var resolveAud = function (aud) {
      if (aud === 'all' || aud == null) return nodeIds.slice();
      return (aud || []).filter(function (id) { return indMap.has(id); });
    };

    /* ---------- groups ---------- */
    var groups = [];
    if (O && O.groups && O.groups.length) {
      var walk = function (arr, level, parentId) {
        arr.forEach(function (g) {
          var grp = { id: g.id, name: g.name, level: level, parentId: parentId, order: 0, children: [], members: [] };
          (g.members || []).forEach(function (m) { if (indMap.has(m)) { grp.members.push(m); indMap.get(m).groupId = g.id; } });
          groups.push(grp);
          if (g.children && g.children.length) {
            walk(g.children, level + 1, g.id);
            grp.children = g.children.map(function (c) { return c.id; });
          }
        });
      };
      walk(O.groups, 1, null);
      var orphans = individuals.filter(function (x) { return x.kind === 'agent' && !x.groupId; });
      if (orphans.length) {
        var og = { id: 'g_other', name: '其他', level: 1, parentId: null, order: 0, children: [], members: [] };
        orphans.forEach(function (x) { og.members.push(x.id); x.groupId = og.id; });
        groups.push(og);
      }
    } else {
      PHASE_ORDER.forEach(function (ph) {
        var mem = individuals.filter(function (x) { return x.kind === 'agent' && x.phase === ph; });
        if (!mem.length) return;
        var g = { id: 'g_' + ph, name: phaseName(ph), level: 1, parentId: null, order: 0, children: [], members: [] };
        var byAgent = U.groupBy(mem, function (x) { return x.agentId; });
        byAgent.forEach(function (list, aid) {
          if (list.length >= 3 && list.length < mem.length) {
            var sg = { id: 'g_' + ph + '_' + aid, name: agentName(aid) + '组', level: 2, parentId: g.id, order: 0, children: [], members: [] };
            list.forEach(function (x) { sg.members.push(x.id); x.groupId = sg.id; });
            g.children.push(sg.id);
            groups.push(sg);
          } else {
            list.forEach(function (x) { g.members.push(x.id); x.groupId = g.id; });
          }
        });
        groups.push(g);
      });
    }
    var groupMap = U.byId(groups);
    var membersDeep = function (gid) {
      var g = groupMap.get(gid);
      if (!g) return [];
      var out = g.members.slice();
      g.children.forEach(function (c) { out = out.concat(membersDeep(c)); });
      return out;
    };
    groups.forEach(function (g) {
      var ys = membersDeep(g.id).map(function (id) { return indMap.get(id).y; });
      var xs = membersDeep(g.id).map(function (id) { return indMap.get(id).x; });
      g.order = (ys.length ? Math.min.apply(null, ys) : 9999) * 10000 + (xs.length ? Math.min.apply(null, xs) : 0);
    });
    groups.sort(function (a, b) { return a.order - b.order; });
    groups.forEach(function (g, i) { g.order = i; });

    /* ---------- channels ---------- */
    var channels = [], chMap = new Map();
    var addChannel = function (ch) { if (!chMap.has(ch.id)) { chMap.set(ch.id, ch); channels.push(ch); } return chMap.get(ch.id); };
    individuals.forEach(function (x) {
      if (x.model) {
        var mc = addChannel({ id: 'ch_' + x.model, kind: 'model', name: '模型：' + (MODEL_ZH[x.model] || x.model), maintainer: 'meta_maint',
          capacity: CAPACITY[x.model] || '-', quota: QUOTA[x.model] || '-', limit: LIMIT[x.model] || null, users: [] });
        mc.users.push(x.id); x.channels.push(mc.id);
      }
      x.tools.forEach(function (t) {
        if (NATIVE_FROM_TOOL[t]) return;   // a native capability, added below
        var tl = TOOL_LIMIT[String(t).toLowerCase().replace(/[^a-z]/g, '')] || null;
        var tc = addChannel({ id: U.toolChannelId(t), kind: tl ? 'function' : 'tool', name: '工具：' + toolName(t), maintainer: 'meta_maint',
          capacity: tl ? '并发 ' + tl : '不限', quota: '-', limit: tl, users: [] });
        if (tc.users.indexOf(x.id) < 0) tc.users.push(x.id);
        if (x.channels.indexOf(tc.id) < 0) x.channels.push(tc.id);
      });
      Object.keys(FN_CHANNELS).forEach(function (fid) {
        var f = FN_CHANNELS[fid];
        if (f.agents.indexOf(x.agentId) < 0) return;
        var fc = addChannel({ id: fid, kind: 'function', name: f.name, maintainer: 'meta_maint', capacity: f.capacity, quota: f.quota, limit: f.limit, users: [] });
        if (fc.users.indexOf(x.id) < 0) fc.users.push(x.id);
        if (x.channels.indexOf(fc.id) < 0) x.channels.push(fc.id);
      });
    });
    ((O && O.channels) || []).forEach(function (c) {
      var ch = addChannel({ id: c.id, kind: c.kind || 'function', name: c.name, maintainer: 'meta_maint', capacity: c.capacity || '-', quota: c.quota || '-',
        limit: c.limit != null ? c.limit : limitFrom(c.capacity), users: [] });
      (c.users || []).forEach(function (u) {
        if (!indMap.has(u)) return;
        if (ch.users.indexOf(u) < 0) ch.users.push(u);
        if (indMap.get(u).channels.indexOf(ch.id) < 0) indMap.get(u).channels.push(ch.id);
      });
    });
    // native capabilities: from a host tool (Claude Code's Agent) or declared by a curated case (e.g. an individual running on 豆包)
    var addNative = function (owner, n) {
      var x = indMap.get(owner);
      if (!x) return;
      var ch = addChannel({ id: n.id || 'ch_nat_' + owner, kind: 'native', owner: owner, host: n.host || 'Claude Code', name: n.name, short: n.short || n.name,
        note: n.note || '', maintainer: owner, capacity: n.limit ? '一次最多 ' + n.limit + ' 个' : '-', quota: '-', limit: n.limit || null, users: [owner] });
      if (n.host) x.host = n.host;
      if (x.natives.indexOf(ch.id) < 0) x.natives.push(ch.id);
      if (x.channels.indexOf(ch.id) < 0) x.channels.push(ch.id);
    };
    individuals.forEach(function (x) {
      x.tools.forEach(function (t) { if (NATIVE_FROM_TOOL[t]) addNative(x.id, Object.assign({ id: 'ch_nat_' + x.id + '_' + t.toLowerCase() }, NATIVE_FROM_TOOL[t])); });
    });
    ((O && O.native) || []).forEach(function (n) { addNative(n.owner, n); });
    // tiers: basic = what every agent can do with no upkeep; shared = models and function channels; native = one individual's own
    channels.forEach(function (c) { c.tier = c.kind === 'native' ? 'native' : c.kind === 'tool' && !c.limit ? 'basic' : 'shared'; });

    /* ---------- relations ---------- */
    var relations = [], relKeys = {};
    var addRel = function (type, sub, from, to, label) {
      var key = type + ':' + sub + ':' + from + ':' + to;
      if (relKeys[key] || !from || !to || from === to) return null;
      var r = { id: 'r' + relations.length, type: type, sub: sub, from: from, to: to, label: label || '' };
      relKeys[key] = r; relations.push(r);
      return r;
    };
    var hubId = hubIndex >= 0 ? 'n' + hubIndex : null;
    P.edges.forEach(function (e) {
      var a = 'n' + e[0], b = 'n' + e[1];
      if (!indMap.has(a) || !indMap.has(b)) return;
      var fromInd = indMap.get(a);
      var sub = e[2] === 'two' ? 'roundtrip' : e[2] === 'continuous' ? 'report'
        : (fromInd.isHub || fromInd.phase === 'hitl') ? 'dispatch' : 'deliver';
      addRel('task', sub, a, b);
    });
    relations.filter(function (r) { return r.type === 'task' && r.sub !== 'report'; }).forEach(function (r) {
      addRel('info', 'read', r.from, r.to, '读上游产出');
    });
    ((O && O.infoReads) || []).forEach(function (t) { addRel('info', 'read', t[0], t[1], t[2] || ''); });
    if (hubId) {
      addRel('watch', 'watch', 'human', hubId, '人通过中枢智能体下指令');
      relations.filter(function (r) { return r.type === 'task' && r.sub === 'report'; }).forEach(function (r) {
        addRel('watch', 'watch', hubId, r.from, '盯着回报');
      });
    }
    individuals.filter(function (x) { return x.agentId === 'qa_manager'; }).forEach(function (m) {
      individuals.filter(function (x) { return x.groupId === m.groupId && x.id !== m.id; }).forEach(function (x) { addRel('watch', 'watch', m.id, x.id, '收集并审核测试结论'); });
    });
    ((O && O.watches) || []).forEach(function (t) { addRel('watch', 'watch', t[0], t[1], t[2] || ''); });
    individuals.forEach(function (x) {
      (x.watches || []).forEach(function (w) { if (indMap.has(w)) addRel('watch', 'watch', x.id, w, ''); });
    });
    channels.forEach(function (ch) {
      ch.users.forEach(function (u) { addRel('channel', 'use', u, ch.id, ''); });
      addRel('channel', 'maintain', 'meta_maint', ch.id, '');
    });
    relations.forEach(function (r) {
      if (r.type === 'watch') {
        var w = indMap.get(r.from);
        if (w && w.watches.indexOf(r.to) < 0) w.watches.push(r.to);
      }
    });
    maint.watches = channels.map(function (c) { return c.id; });

    /* ---------- docs ---------- */
    var title = (O && O.title) || presetName(presetId);
    var summary = (O && O.summary) || presetSummary(presetId);
    var docs = [
      { id: 'd_goal', layer: 'consensus', name: '目标与约束', owner: 'human', summary: summary, audience: nodeIds.slice(), version: 'v1' },
      { id: 'd_terms', layer: 'consensus', name: '术语与约定', owner: hubId || 'human', summary: '本团队统一使用的说法、文件位置和交付格式', audience: nodeIds.slice(), version: 'v1' },
      { id: 'd_map', layer: 'map', name: '资料地图', owner: hubId || 'human', summary: '还想知道更多时去哪里找：规程、历史记录、各组产出的位置', audience: nodeIds.slice(), version: 'v1' }
    ];
    individuals.forEach(function (x) {
      if (x.kind === 'human') return;
      docs.push({ id: 'd_role_' + x.id, layer: 'private', name: x.name + '的职责说明', owner: x.id, summary: x.role, audience: [x.id], version: 'v1' });
    });
    ((O && O.docs) || []).forEach(function (d) {
      docs.push({ id: d.id, layer: d.layer, name: d.name, owner: d.owner || 'human', summary: d.summary || '', audience: resolveAud(d.audience), version: 'v1' });
    });
    docs.forEach(function (d) { d.audience.forEach(function (id) { var x = indMap.get(id); if (x && x.docs.indexOf(d.id) < 0) x.docs.push(d.id); }); });

    /* ---------- triggers (defaults) ---------- */
    individuals.forEach(function (x) {
      if (x.trigger) return;
      var ins = relations.filter(function (r) { return r.type === 'task' && r.to === x.id && r.sub !== 'report'; })
        .map(function (r) { return indMap.get(r.from).name; });
      x.trigger = ins.length ? '收到' + U.uniq(ins).slice(0, 2).join('、') + (ins.length > 2 ? '等' : '') + '的交接' : (x.isHub ? '人的需求' : '中枢智能体的派发');
    });

    /* ---------- process ---------- */
    var process = O && O.process && O.process.stages && O.process.stages.length
      ? curatedProcess(O.process, indMap)
      : defaultProcess(groups, individuals, indMap, relations, groupMap, membersDeep);

    // The need enters through the hub; without a hub the human hands it to the first stage directly.
    if (hubId) addRel('task', 'dispatch', 'human', hubId, '提出需求');
    else if (process.stages.length) process.stages[0].steps[0].executors.forEach(function (x) { addRel('task', 'dispatch', 'human', x, '提出需求'); });

    return {
      id: presetId,
      name: title,
      presetName: presetName(presetId),
      summary: summary,
      flowText: presetFlow(presetId),
      category: P.category,
      size: P.nodes.length,
      curated: !!O,
      override: O,
      def: {
        version: 'v1',
        versions: [{ id: 'v1', at: 0, note: '初始编排', by: hubId ? indMap.get(hubId).name : '人（用户）' }],
        individuals: individuals, groups: groups, relations: relations, channels: channels, docs: docs, process: process
      }
    };
  }

  function curatedProcess(OP, indMap) {
    var stages = OP.stages.map(function (s, i) {
      return {
        id: s.id, name: s.name, order: i, groupId: s.groupId || null,
        steps: (s.steps || []).map(function (st) {
          return { id: st.id, name: st.name, executors: (st.executors || []).filter(function (x) { return indMap.has(x); }) };
        })
      };
    });
    var gates = (OP.gates || []).map(function (g) {
      var dec = g.decider || { type: 'rule' };
      return {
        id: g.id, name: g.name, afterStage: g.afterStage,
        decider: { type: dec.type || 'rule', who: dec.who || (dec.type === 'human' ? 'human' : null), text: dec.text || '' },
        pass: g.pass || 'done', fail: g.fail || null, escalate: g.escalate || null
      };
    });
    return finishProcess(stages, gates);
  }

  function defaultProcess(groups, individuals, indMap, relations, groupMap, membersDeep) {
    var top = groups.filter(function (g) { return g.level === 1; });
    var phaseOf = function (g) {
      var m = membersDeep(g.id).map(function (id) { return indMap.get(id).phase; });
      var best = null, n = 0, c = {};
      m.forEach(function (p) { c[p] = (c[p] || 0) + 1; if (c[p] > n) { n = c[p]; best = p; } });
      return best;
    };
    var stages = [];
    top.forEach(function (g) {
      var ph = phaseOf(g);
      if (ph === 'hitl') return;
      stages.push({
        id: 's_' + g.id.replace(/^g_/, ''), name: g.name, order: 0, groupId: g.id, phase: ph,
        steps: [{ id: 'st_' + g.id.replace(/^g_/, ''), name: STEP_ZH[ph] || g.name, executors: membersDeep(g.id) }]
      });
    });
    stages.sort(function (a, b) { return PHASE_ORDER.indexOf(a.phase) - PHASE_ORDER.indexOf(b.phase); });
    stages.forEach(function (s, i) { s.order = i; });
    var stageOfInd = {};
    stages.forEach(function (s) { s.steps.forEach(function (st) { st.executors.forEach(function (x) { stageOfInd[x] = s.id; }); }); });

    var gates = [];
    // Human gates: every decision presenter sits between the stage before it and the stage after it.
    individuals.filter(function (x) { return x.phase === 'hitl' && x.kind === 'agent'; }).forEach(function (p) {
      var ins = relations.filter(function (r) { return r.type === 'task' && r.to === p.id; }).map(function (r) { return stageOfInd[r.from]; }).filter(Boolean);
      var outs = relations.filter(function (r) { return r.type === 'task' && r.from === p.id; }).map(function (r) { return stageOfInd[r.to]; }).filter(Boolean);
      var before = ins[0];
      var sbo = before ? stages.find(function (s) { return s.id === before; }) : null;
      // The gate must move forward: pick the earliest successor stage that comes after the stage before it.
      var fwd = sbo ? outs.map(function (id) { return stages.find(function (s) { return s.id === id; }); })
        .filter(function (s) { return s && s.order > sbo.order; }).sort(function (a, b) { return a.order - b.order; }) : [];
      var after = fwd.length ? fwd[0].id : (sbo && stages[sbo.order + 1] ? stages[sbo.order + 1].id : null);
      if (!before || !after || before === after) {
        // Fallback: attach the presenter to the first stage so it is not shown as unused.
        if (stages.length) stages[0].steps.push({ id: 'st_present_' + p.id, name: '整理决策选项', executors: [p.id] });
        return;
      }
      var sb = stages.find(function (s) { return s.id === before; });
      sb.steps.push({ id: 'st_present_' + p.id, name: '整理决策选项', executors: [p.id] });
      var sa = stages.find(function (s) { return s.id === after; });
      gates.push({
        id: 'gt_h_' + p.id, name: '人工关：' + sb.name + ' → ' + sa.name, afterStage: before,
        decider: { type: 'human', who: 'human', text: p.name + '整理选项，人拍板' },
        pass: after, fail: before, escalate: null
      });
    });
    var has = function (ph) { return stages.find(function (s) { return s.phase === ph; }); };
    var qa = has('qa'), buildSt = has('build'), research = has('research');
    if (qa) {
      var mgr = qa.steps[0].executors.map(function (id) { return indMap.get(id); }).find(function (x) { return x.agentId === 'qa_manager'; });
      var first = mgr || indMap.get(qa.steps[0].executors[0]);
      gates.push({
        id: 'gt_qa', name: '验收是否通过', afterStage: qa.id,
        decider: first ? { type: 'agent', who: first.id, text: first.name + '按验收清单判断' } : { type: 'rule', who: null, text: '全部检查项通过' },
        pass: 'done', fail: buildSt ? buildSt.id : (stages[Math.max(0, qa.order - 1)] || qa).id, escalate: 'human'
      });
    } else if (stages.length) {
      var last = stages[stages.length - 1];
      gates.push({ id: 'gt_final', name: '交付检查', afterStage: last.id, decider: { type: 'rule', who: null, text: '产出齐全、格式正确' }, pass: 'done', fail: last.id, escalate: null });
    }
    if (research && research.order < stages.length - 1 && !gates.some(function (g) { return g.afterStage === research.id; })) {
      gates.push({
        id: 'gt_research', name: '来源是否足够', afterStage: research.id,
        decider: { type: 'rule', who: null, text: '每个方向至少 3 个可信来源' },
        pass: stages[research.order + 1].id, fail: research.id, escalate: null
      });
    }
    return finishProcess(stages, gates);
  }

  // Flows: start -> stage -> (gate chain) -> next stage | done, plus fail loops and escalations.
  function finishProcess(stages, gates) {
    var flows = [], keys = {};
    var add = function (from, to, kind, label) {
      if (!from || !to) return;
      var k = from + '>' + to;
      if (keys[k]) return;
      keys[k] = true;
      flows.push({ id: 'f' + flows.length, from: from, to: to, kind: kind, label: label || '' });
    };
    if (stages.length) add('start', stages[0].id, 'normal');
    stages.forEach(function (s, i) {
      var gs = gates.filter(function (g) { return g.afterStage === s.id; });
      var next = stages[i + 1] ? stages[i + 1].id : 'done';
      if (!gs.length) { add(s.id, next, 'normal'); return; }
      add(s.id, gs[0].id, 'normal');
      gs.forEach(function (g, k) {
        var passTo = gs[k + 1] ? gs[k + 1].id : (g.pass || next);
        add(g.id, passTo, 'normal', '通过');
        if (g.fail && g.fail !== passTo) add(g.id, g.fail, 'loop', '打回');
        if (g.escalate) add(g.id, 'human', 'escalate', '上报');
      });
    });
    return { stages: stages, gates: gates, flows: flows };
  }

  HUB.casedef = {
    build: build,
    agentName: agentName, presetName: presetName, presetSummary: presetSummary, presetFlow: presetFlow,
    phaseName: phaseName, toolName: toolName, PHASE_ORDER: PHASE_ORDER
  };
})();
