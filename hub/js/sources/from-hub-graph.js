/* HUB.fromHubGraph: hub-graph JSON（docs/hub-graph-format.md §18.2）→ 统一模型。
   这是"任何来源接入可视化"的通用门票：JSON 描述 objects（个体/组/渠道/文档/案例/决策）
   与 relations（任务/信息/监督/渠道线），本适配器翻译成统一模型，页面零改动。

   规则（与格式规范一致）：
   - 只认统一模型的字段；objects 里不认识的 type 整个进不了 def，但其属性不报错
   - model 名归一（claude-opus-5-5 → opus），让渠道命名与其它来源一致
   - 不跑模拟器：JSON 描述的是事实，synthetic=false；cases/decisions 有就带，没有就空
   - view/panels 段忽略——观察状态归前端 store 管，格式不表达布局                        */
(function () {
  'use strict';
  var HUB = (window.HUB = window.HUB || {});

  function shortModel(m) {
    var r = /^claude-([a-z]+)-/.exec(m || '');
    return r ? r[1] : (m || null);
  }

  function model(doc) {
    var meta = (doc && doc.meta) || {};
    var individuals = [], groups = [], channels = [], docs = [];
    var facts = {
      synthetic: false, span: { start: 0, end: 0 },
      cases: [], tasks: [], runs: [], decisions: [], calls: [], handoffs: [], deliveries: [],
      gateEvents: [], channelEvents: [], versionEvents: [], actions: [], messages: []
    };
    var known = {};

    (doc.objects || []).forEach(function (o) {
      var a = (o && o.attributes) || {};
      var tags = (o && o.tags) || [];
      known[o.id] = true;
      var tagOf = function (ns) {
        var t = tags.find(function (x) { return x.indexOf(ns + '/') === 0; });
        return t ? t.slice(ns.length + 1) : null;
      };
      if (o.type === 'individual') {
        individuals.push({
          id: o.id, agentId: tagOf('role'), kind: 'agent', name: o.name || o.id,
          model: shortModel(a.model || tagOf('model')), phase: a.phase || tagOf('phase') || 'build',
          role: a.role || '', trigger: a.trigger || '', groupId: a.groupId || tagOf('group') || null,
          isHub: a.isHub === true || tags.indexOf('hub') >= 0, watches: [],
          tags: tags, attributes: a, natives: [], channels: [], docs: [], tools: [],
          x: 0, y: 0, host: null, enhanced: false
        });
      } else if (o.type === 'group') {
        groups.push({
          id: o.id, name: o.name || o.id, level: a.level || 1, parentId: a.parentId || null,
          order: groups.length, children: a.children || [], members: a.members || [], tags: tags
        });
      } else if (o.type === 'channel') {
        channels.push({
          id: o.id, kind: a.kind || 'tool', name: o.name || o.id, maintainer: 'meta_maint',
          capacity: a.capacity || '-', quota: a.quota || '-', limit: a.limit != null ? a.limit : null,
          users: a.users || [], tags: tags
        });
      } else if (o.type === 'doc') {
        docs.push({
          id: o.id, layer: a.layer || tagOf('layer') || 'private', name: o.name || o.id,
          owner: a.owner || null, summary: a.summary || '',
          audience: a.audience == null ? 'all' : a.audience, version: 'v1', tags: tags
        });
      } else if (o.type === 'case') {
        facts.cases.push({
          id: o.id, name: o.name || o.id, start: a.start || 0,
          end: a.end == null ? null : a.end, status: a.status || 'done',
          path: a.path || [], waitingAt: a.waitingAt || null, rootTask: null
        });
      } else if (o.type === 'decision') {
        facts.decisions.push({
          id: o.id, agentId: a.agentId || null, title: o.name || o.id, trigger: a.trigger || '',
          alternatives: a.alternatives || [], choice: a.choice || '', reason: a.reason || '',
          impact: a.impact || '', action: a.action || 'deliver'
        });
      }
      // run/call 等其余 type：规范允许出现，前端降级；事实层字段未定稿，暂不翻译
    });

    var indMap = {};
    individuals.forEach(function (x) { indMap[x.id] = x; });
    if (!indMap.human) {
      individuals.push({
        id: 'human', agentId: null, kind: 'human', name: '人（用户）', model: null, phase: null,
        groupId: null, role: '发起会话，在对话里给主智能体下指令', trigger: '自己决定',
        watches: [], docs: [], channels: [], natives: [], host: null, tools: [], x: 0, y: 0,
        isHub: false, enhanced: true, tags: []
      });
      indMap.human = individuals[individuals.length - 1];
    }
    var maint = {
      id: 'meta_maint', agentId: null, kind: 'meta', name: '渠道维护者', model: 'haiku', phase: null,
      groupId: null, role: '盯着渠道，出故障时生成维护任务并跟进恢复', trigger: '渠道检查失败',
      watches: [], docs: [], channels: [], natives: [], host: 'Claude Code', tools: [], x: 0, y: 0,
      isHub: false, enhanced: true, tags: []
    };
    if (channels.length) individuals.push(maint), (indMap.meta_maint = maint);

    var chMap = {};
    channels.forEach(function (c) {
      c.tier = c.kind === 'native' ? 'native' : 'shared';
      chMap[c.id] = c;
      c.users.forEach(function (u) { var x = indMap[u]; if (x && x.channels.indexOf(c.id) < 0) x.channels.push(c.id); });
    });
    if (channels.length) maint.watches = channels.map(function (c) { return c.id; });

    var rels = [], relKeys = {};
    var addRel = function (type, sub, from, to, label) {
      if (!from || !to || from === to) return;
      if (!indMap[from] && !chMap[from]) return;
      if (!indMap[to] && !chMap[to]) return;
      var key = type + ':' + sub + ':' + from + ':' + to;
      if (relKeys[key]) return;
      relKeys[key] = rels.push({ id: 'r' + rels.length, type: type, sub: sub, from: from, to: to, label: label || '' });
    };
    (doc.relations || []).forEach(function (r) {
      addRel(r.type || 'task', r.sub || '', r.from, r.to, r.label);
    });
    channels.forEach(function (c) {
      c.users.forEach(function (u) { addRel('channel', 'use', u, c.id, ''); });
      if (channels.length) addRel('channel', 'maintain', 'meta_maint', c.id, '');
    });
    rels.forEach(function (r) {
      if (r.type === 'watch') {
        var w = indMap[r.from];
        if (w && w.watches.indexOf(r.to) < 0) w.watches.push(r.to);
      }
    });
    docs.forEach(function (d) {
      var agentIds = individuals.filter(function (x) { return x.kind === 'agent'; }).map(function (x) { return x.id; });
      d.audience = d.audience === 'all' || d.audience == null ? agentIds
        : (Array.isArray(d.audience) ? d.audience : [d.audience]).filter(function (id) { return indMap[id]; });
      d.audience.forEach(function (id) { var x = indMap[id]; if (x && x.docs.indexOf(d.id) < 0) x.docs.push(d.id); });
    });

    // 时间轴需要非零时间范围：从案例/决策里取最大时刻，全无时间数据时给一个小时
    var tMax = 0;
    facts.cases.forEach(function (c) { tMax = Math.max(tMax, c.start || 0, c.end || 0); });
    facts.span = { start: 0, end: tMax || 3600 * 1000 };

    return {
      id: meta.id || doc.id || 'graph',
      name: meta.name || meta.id || 'hub-graph 案例',
      summary: meta.summary || '',
      synthetic: false,
      def: {
        version: 'v1',
        versions: [{ id: 'v1', at: 0, note: meta.producer ? '来自 ' + meta.producer : 'hub-graph JSON', by: '适配器' }],
        individuals: individuals, groups: groups, relations: rels, channels: channels, docs: docs,
        process: { stages: [], gates: [], flows: [] }
      },
      facts: facts, rev: 0, clock: null,
      source: { kind: 'hub-graph' }
    };
  }

  HUB.fromHubGraph = { model: model };

  /* ── 来源：hub/cases/ 下的 *.json 就是一个 hub-graph 案例（目录发现见 HUB.catalog）──────── */
  if (HUB.catalog && HUB.model && HUB.model.addSource) {
    HUB.catalog.recognize('graph',
      function (name, isDir) { return !isDir && /\.json$/.test(name) && name.charAt(0) !== '_'; },
      function (e) {
        return fetch(e.path).then(function (r) { return r.json(); }).then(function (d) { return (d.meta && d.meta.name) || e.id; });
      });
    HUB.model.addSource({
      id: 'graph',
      label: 'hub-graph JSON',
      owns: function (id) { var e = HUB.catalog.entry(id); return !!e && e.kind === 'graph'; },
      load: function (id) {
        return fetch(HUB.catalog.entry(id).path).then(function (r) {
          if (!r.ok) throw new Error('graph 案例未找到：' + id);
          return r.json();
        }).then(function (doc) {
          doc.meta = Object.assign({ id: id }, doc.meta || {});
          return model(doc);
        });
      }
    });
  }
})();
