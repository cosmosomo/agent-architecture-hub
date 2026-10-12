/* HUB.analysis: definition + facts (+ a time cut) -> indexes and analysis results. */
(function () {
  'use strict';
  var HUB = (window.HUB = window.HUB || {});
  var U = HUB.util;

  function buildIdx(def, facts) {
    var idx = {
      ind: U.byId(def.individuals), group: U.byId(def.groups), rel: U.byId(def.relations), ch: U.byId(def.channels),
      doc: U.byId(def.docs), stage: U.byId(def.process.stages), gate: U.byId(def.process.gates), flow: U.byId(def.process.flows),
      step: new Map(), task: U.byId(facts.tasks), run: U.byId(facts.runs), dec: U.byId(facts.decisions), call: U.byId(facts.calls),
      case: U.byId(facts.cases), handoff: U.byId(facts.handoffs), delivery: U.byId(facts.deliveries),
      runsByInd: U.groupBy(facts.runs, function (r) { return r.individualId; }),
      runsByCase: U.groupBy(facts.runs, function (r) { return r.caseId; }),
      runsByTask: U.groupBy(facts.runs, function (r) { return r.taskId; }),
      tasksByCase: U.groupBy(facts.tasks, function (t) { return t.caseId; }),
      decsByRun: U.groupBy(facts.decisions, function (d) { return d.runId; }),
      callsByRun: U.groupBy(facts.calls, function (c) { return c.runId; }),
      callsByDec: U.groupBy(facts.calls, function (c) { return c.decisionId; }),
      handoffsByCase: U.groupBy(facts.handoffs, function (h) { return h.caseId; }),
      deliveriesByRun: U.groupBy(facts.deliveries, function (d) { return d.runId; }),
      relsByInd: new Map(),
      membersDeep: new Map(),
      stageOfStep: new Map()
    };
    def.process.stages.forEach(function (s) { s.steps.forEach(function (st) { idx.step.set(st.id, st); idx.stageOfStep.set(st.id, s.id); }); });
    def.relations.forEach(function (r) {
      [r.from, r.to].forEach(function (e) { if (!idx.relsByInd.has(e)) idx.relsByInd.set(e, []); idx.relsByInd.get(e).push(r); });
    });
    var deep = function (gid) {
      if (idx.membersDeep.has(gid)) return idx.membersDeep.get(gid);
      var g = idx.group.get(gid);
      var out = g ? g.members.slice() : [];
      if (g) g.children.forEach(function (c) { out = out.concat(deep(c)); });
      idx.membersDeep.set(gid, out);
      return out;
    };
    def.groups.forEach(function (g) { deep(g.id); });
    idx.groupOfInd = function (id) { var x = idx.ind.get(id); return x ? x.groupId : null; };
    idx.topGroupOf = function (gid) { var g = idx.group.get(gid); while (g && g.parentId) g = idx.group.get(g.parentId); return g ? g.id : null; };
    idx.ancestors = function (gid) { var out = [], g = idx.group.get(gid); while (g) { out.push(g.id); g = g.parentId ? idx.group.get(g.parentId) : null; } return out; };
    return idx;
  }

  function within(t, cut) { return cut == null || t <= cut; }

  /* 能不能对照：定义和事实各自从哪来，决定体检能下什么结论（设计总览 9.4；任务书 2 的事实边界）。
     full    两边都是自己的（模拟案例、本机会话）：可以说“设计了没用上”“编排里没有这条线”。
     written 事实是真实轨迹，定义是我们补写的编排：只说“这份记录里没有出现”“与补写的编排不一致”。
     none    真实轨迹里没有任何有依据的交接，只有发言先后：任务线不对照。 */
  function comparability(model) {
    var fs = model && model.factSource;
    if (!fs || fs.kind !== 'trace') return { level: 'full', written: false, orderOnly: false };
    var based = ((model.facts && model.facts.handoffs) || []).some(function (h) { return h.basis === 'explicit' || h.basis === 'protocol'; });
    return { level: based ? 'written' : 'none', written: true, orderOnly: !based };
  }

  function analyze(model, cut) {
    var def = model.def, F = model.facts, idx = model.idx;
    var runs = F.runs.filter(function (r) { return within(r.start, cut); });
    var handoffs = F.handoffs.filter(function (h) { return within(h.at, cut); });
    var calls = F.calls.filter(function (c) { return within(c.start, cut); });
    var gateEvents = F.gateEvents.filter(function (g) { return within(g.at, cut); });
    var chEvents = F.channelEvents.filter(function (e) { return within(e.at, cut); });
    var deliveries = F.deliveries.filter(function (d) { return within(d.at, cut); });
    var now = cut == null ? F.span.end : cut;

    /* relation stats */
    var relStats = {};
    def.relations.forEach(function (r) { relStats[r.id] = { count: 0, first: null, last: null }; });
    var bump = function (rid, at) {
      var s = relStats[rid];
      if (!s) return;
      s.count += 1;
      if (s.first == null || at < s.first) s.first = at;
      if (s.last == null || at > s.last) s.last = at;
    };
    var infoByPair = {};
    def.relations.forEach(function (r) { if (r.type === 'info') infoByPair[r.from + '>' + r.to] = r.id; });
    var factOnlyMap = {};
    handoffs.forEach(function (h) {
      if (h.relationId) {
        bump(h.relationId, h.at);
        var ir = infoByPair[h.from + '>' + h.to];
        if (ir) bump(ir, h.at);
      } else {
        var key = h.from + '>' + h.to;
        if (!factOnlyMap[key]) factOnlyMap[key] = { id: 'fo_' + h.from + '_' + h.to, type: 'task', from: h.from, to: h.to, count: 0, handoffIds: [], note: h.note || '' };
        factOnlyMap[key].count += 1;
        factOnlyMap[key].handoffIds.push(h.id);
      }
    });
    var runsByIndCut = U.groupBy(runs, function (r) { return r.individualId; });
    var callsByIndCh = {};
    calls.forEach(function (c) {
      var r = idx.run.get(c.runId);
      if (!r) return;
      var k = r.individualId + '>' + c.channelId;
      callsByIndCh[k] = callsByIndCh[k] || { n: 0, first: c.start, last: c.start };
      callsByIndCh[k].n += 1;
      callsByIndCh[k].last = c.start;
    });
    def.relations.forEach(function (r) {
      if (r.type === 'watch') {
        var wr = runsByIndCut.get(r.from) || [];
        if (r.from === 'human') wr = gateEvents.filter(function (g) { return g.by === 'human'; }).map(function (g) { return { start: g.at }; }).concat(handoffs.filter(function (h) { return h.from === 'human'; }).map(function (h) { return { start: h.at }; }));
        wr.forEach(function (x) { bump(r.id, x.start); });
      } else if (r.type === 'channel') {
        if (r.sub === 'use') {
          var u = callsByIndCh[r.from + '>' + r.to];
          if (u) { relStats[r.id] = { count: u.n, first: u.first, last: u.last }; }
        } else {
          chEvents.filter(function (e) { return e.channelId === r.to && e.kind === 'maint_task'; }).forEach(function (e) { bump(r.id, e.at); });
        }
      }
    });
    var factOnly = Object.keys(factOnlyMap).map(function (k) { return factOnlyMap[k]; });
    var unusedRelations = def.relations.filter(function (r) {
      if (r.type === 'channel' && r.sub === 'maintain') return false;
      return relStats[r.id].count === 0;
    }).map(function (r) { return r.id; });

    /* individuals */
    var indStats = {}, neverDispatched = [];
    def.individuals.forEach(function (x) {
      var rs = (runsByIndCut.get(x.id) || []).slice().sort(function (a, b) { return a.start - b.start; });
      var tasks = F.tasks.filter(function (t) { return t.assignee === x.id && within(t.created, cut); });
      var status;
      if (x.kind === 'human') status = 'standby';
      else if (!rs.length) status = 'never';
      else {
        var last = rs[rs.length - 1];
        if (last.start <= now && last.end > now) status = 'working';
        else if ((last.outcome === 'failed' || last.outcome === 'interrupted') && last.end <= now) status = 'error';
        else {
          var waitingCase = F.cases.find(function (c) {
            if (!c.waitingAt) return false;
            var g = idx.gate.get(c.waitingAt);
            return g && g.decider && g.decider.who === x.id;
          });
          status = waitingCase ? 'waiting' : 'standby';
        }
      }
      if (x.kind === 'human' && F.cases.some(function (c) { var g = c.waitingAt && idx.gate.get(c.waitingAt); return g && g.decider.type === 'human'; })) status = 'waiting';
      indStats[x.id] = { runs: rs.length, tasks: tasks.length, status: status, lastRunId: rs.length ? rs[rs.length - 1].id : null, tokens: U.sumTokens(rs) };
      if (status === 'never' && x.kind !== 'human') neverDispatched.push(x.id);
    });

    /* groups */
    var groupStats = {};
    def.groups.forEach(function (g) {
      var mem = idx.membersDeep.get(g.id) || [];
      var s = { members: mem.length, working: 0, waiting: 0, standby: 0, error: 0, never: 0, runs: 0 };
      mem.forEach(function (id) { var st = indStats[id]; if (!st) return; s[st.status] = (s[st.status] || 0) + 1; s.runs += st.runs; });
      groupStats[g.id] = s;
    });

    /* steps, gates, flows */
    var stepStats = {};
    def.process.stages.forEach(function (s) {
      s.steps.forEach(function (st) {
        var ts = F.tasks.filter(function (t) { return t.stepId === st.id && within(t.created, cut); });
        var durs = ts.filter(function (t) { return t.started != null && t.done != null; }).map(function (t) { return t.done - t.started; });
        stepStats[st.id] = { tasks: ts.length, done: ts.filter(function (t) { return t.status === 'done'; }).length,
          rework: ts.filter(function (t) { return (t.visit || 1) > 1 || t.status === 'rework'; }).length,
          avgDur: durs.length ? U.sum(durs) / durs.length : null };
      });
    });
    var gateStats = {};
    def.process.gates.forEach(function (g) {
      var ev = gateEvents.filter(function (e) { return e.gateId === g.id; });
      var waiting = F.cases.filter(function (c) { return c.waitingAt === g.id && within(c.start, cut); }).length;
      gateStats[g.id] = { pass: ev.filter(function (e) { return e.result === 'pass'; }).length, fail: ev.filter(function (e) { return e.result === 'fail'; }).length,
        escalate: ev.filter(function (e) { return e.result === 'escalate'; }).length, queueNow: waiting,
        queueMax: Math.max(waiting, ev.reduce(function (m, e) { return Math.max(m, e.queue || 0); }, 0)) };
    });
    var flowStats = {}, flowByPair = {};
    def.process.flows.forEach(function (f) { flowStats[f.id] = { count: 0 }; flowByPair[f.from + '>' + f.to] = f.id; });
    var factOnlyFlows = {};
    F.cases.forEach(function (c) {
      var p = c.path.filter(function (x) { return within(x.at, cut); });
      for (var i = 1; i < p.length; i++) {
        var k = p[i - 1].node + '>' + p[i].node;
        if (flowByPair[k]) flowStats[flowByPair[k]].count += 1;
        else if (p[i - 1].node !== p[i].node) { factOnlyFlows[k] = factOnlyFlows[k] || { from: p[i - 1].node, to: p[i].node, count: 0 }; factOnlyFlows[k].count += 1; }
      }
    });

    /* delivery */
    var delivery = {};
    def.individuals.forEach(function (x) {
      if (x.kind === 'human') return;
      var ds = deliveries.filter(function (d) { return d.individualId === x.id; });
      var received = U.uniq(ds.filter(function (d) { return d.kind === 'context' && d.status === 'delivered' && d.docId; }).map(function (d) { return d.docId; }));
      var missedEver = U.uniq(ds.filter(function (d) { return d.status === 'missing' && d.docId; }).map(function (d) { return d.docId; }));
      var lastRun = indStats[x.id].lastRunId;
      var lastMissing = U.uniq(ds.filter(function (d) { return d.runId === lastRun && d.status === 'missing' && d.docId; }).map(function (d) { return d.docId; }));
      var redelivered = ds.filter(function (d) { return d.kind === 'context' && d.status === 'delivered' && d.by === 'human'; }).map(function (d) { return d.docId; });
      delivery[x.id] = {
        expected: x.docs.slice(), received: received,
        missing: lastMissing.filter(function (d) { return redelivered.indexOf(d) < 0; }),
        missedEver: missedEver,
        pending: ds.filter(function (d) { return d.status === 'pending'; }).length,
        instructions: ds.filter(function (d) { return d.kind !== 'context'; }).length
      };
    });

    /* channels */
    var channelStats = {};
    def.channels.forEach(function (ch) {
      var cs = calls.filter(function (c) { return c.channelId === ch.id; });
      var ev = chEvents.filter(function (e) { return e.channelId === ch.id; });
      var status = 'ok', lastDown = null;
      ev.forEach(function (e) {
        if (e.kind === 'outage') { status = 'down'; lastDown = e; }
        else if (e.kind === 'quota') { status = 'degraded'; lastDown = e; }
        else if (e.kind === 'recover' || e.kind === 'resume') status = 'ok';
        else if (e.kind === 'pause') status = 'paused';
      });
      // load: model channels count runs, tool channels count calls; a run that had to wait for a slot counts as queued
      var load = (ch.kind === 'model' ? F.runs.filter(function (r) { return r.channelId === ch.id; }) : F.calls.filter(function (c) { return c.channelId === ch.id; }))
        .filter(function (x) { return within(x.start - (x.queued || 0), cut); });
      var activeNow = load.filter(function (x) { return x.start <= now && x.end > now; });
      var waitingNow = load.filter(function (x) { return x.queued && x.start - x.queued <= now && x.start > now; });
      var queuedRuns = load.filter(function (x) { return x.queued > 0; });
      var who = function (x) { if (x.individualId) return x.individualId; var r = idx.run.get(x.runId); return r ? r.individualId : null; };
      var evs = [];
      load.forEach(function (x) { if (within(x.start, cut)) { evs.push([x.start, 1]); evs.push([Math.min(x.end, now), -1]); } });
      evs.sort(function (a, b) { return a[0] - b[0] || a[1] - b[1]; });
      var c0 = 0, peak = 0;
      evs.forEach(function (p) { c0 += p[1]; if (c0 > peak) peak = c0; });
      var actInd = activeNow.map(who).filter(Boolean);
      channelStats[ch.id] = { calls: cs.length, errors: cs.filter(function (c) { return c.status === 'error'; }).length, status: status,
        incidents: ev.filter(function (e) { return e.kind === 'outage' || e.kind === 'quota'; }).length, lastIncident: lastDown ? lastDown.at : null,
        limit: ch.limit || null, users: (ch.users || []).length, active: activeNow.length, activeUsers: U.uniq(actInd),
        waiting: waitingNow.length, waitingUsers: U.uniq(waitingNow.map(who).filter(Boolean)),
        peak: peak, queued: queuedRuns.length, waitTotal: U.sum(queuedRuns, function (r) { return r.queued; }),
        tier: ch.tier, maxWidth: ch.kind === 'native' ? cs.reduce(function (mx, c) { return Math.max(mx, c.width || 0); }, 0) : null };
    });

    /* health check */
    var health = [], hid = 0;
    var addH = function (kind, severity, text, target) { hid += 1; health.push({ id: 'hc' + hid, kind: kind, severity: severity, text: text, target: target }); };
    var nm = function (id) { var x = idx.ind.get(id); return x ? x.name : id; };
    // 先判断能不能对照，再下结论：定义是补写的，或记录只有先后时，不说“设计了没用上”
    var cmp = comparability(model);
    neverDispatched.filter(function (id) { return idx.ind.get(id).kind === 'agent'; }).forEach(function (id) {
      if (cmp.level === 'full') addH('never_dispatched', 'high', nm(id) + '从没被派过活，设计了但没用上', { type: 'individual', id: id });
      else addH('never_dispatched', 'low', nm(id) + '：这份记录里没有出现（定义是我们补写的编排，不下“没用上”的结论）', { type: 'individual', id: id });
    });
    factOnly.forEach(function (f) {
      if (cmp.level === 'full') addH('fact_only', 'high', nm(f.from) + ' → ' + nm(f.to) + '：发生了 ' + f.count + ' 次，编排里没有这条线' + (f.note ? '（' + f.note + '）' : ''), { type: 'factonly', id: f.id });
      else addH('fact_only', 'mid', nm(f.from) + ' → ' + nm(f.to) + '：这份记录里有 ' + f.count + ' 次，补写的编排里没有这条线（与补写的编排不一致，不是对方系统偏离了设计）' +
        (f.note ? '（' + f.note + '）' : ''), { type: 'factonly', id: f.id });
    });
    var dn = function (d) { return (idx.doc.get(d) || {}).name || d; };
    Object.keys(delivery).forEach(function (id) {
      if (!HUB.model.measured(model, 'delivery')) return;
      var dv = delivery[id];
      if (dv.missing.length) {
        addH('missing_info', 'high', nm(id) + '最近一次运行没拿到：' + dv.missing.map(dn).join('、'), { type: 'individual', id: id });
      } else if (dv.missedEver.length) {
        var where = deliveries.filter(function (d) { return d.individualId === id && d.status === 'missing'; }).map(function (d) {
          var r = idx.run.get(d.runId); var c = r && r.caseId ? idx.case.get(r.caseId) : null; return c ? c.id : null;
        }).filter(Boolean);
        addH('missing_info', 'mid', nm(id) + (where.length ? '在' + U.uniq(where).join('、') : '') + '没拿到：' + dv.missedEver.map(dn).join('、') + '（后来补上了）', { type: 'individual', id: id });
      }
    });
    def.process.gates.forEach(function (g) {
      var s = gateStats[g.id];
      if (s.fail) addH('rework_loop', 'mid', '“' + g.name + '”打回过 ' + s.fail + ' 次', { type: 'gate', id: g.id });
      if (s.queueNow) addH('queue', 'mid', '“' + g.name + '”前有 ' + s.queueNow + ' 个案例在等', { type: 'gate', id: g.id });
    });
    def.channels.forEach(function (ch) {
      if (!HUB.model.measured(model, 'channel')) return;
      var s = channelStats[ch.id];
      if (s.status !== 'ok') addH('channel_down', 'high', ch.name + '：' + (HUB.util.LABELS.channelStatus[s.status] || s.status), { type: 'channel', id: ch.id });
      else if (s.incidents) addH('channel_down', 'low', ch.name + '：出过 ' + s.incidents + ' 次故障，已恢复', { type: 'channel', id: ch.id });
      if (s.queued) addH('channel_busy', s.waitTotal > 30 * 60000 ? 'mid' : 'low', ch.name + '：' + (s.limit === 1 ? '独占' : '并发上限 ' + s.limit) + '，' + s.queued + (ch.kind === 'model' ? ' 次运行' : ' 次调用') + '排队，共等了 ' + U.fmtDur(s.waitTotal), { type: 'channel', id: ch.id });
    });
    var unusedTask = unusedRelations.filter(function (rid) { var r = idx.rel.get(rid); return r.type === 'task'; });
    if (cmp.level === 'none') addH('unused_relation', 'low', '这份记录只有发言先后，没有交接的依据，不和任务线对照', { type: 'relations', id: 'unused' });
    else if (unusedTask.length) addH('unused_relation', cmp.level === 'full' ? 'mid' : 'low', unusedTask.length +
      (cmp.level === 'full' ? ' 条任务线设计了但从没走过' : ' 条补写的任务线在这份记录里没有对应的交接'), { type: 'relations', id: 'unused' });
    var sevOrder = { high: 0, mid: 1, low: 2 };
    health.sort(function (a, b) { return sevOrder[a.severity] - sevOrder[b.severity]; });

    /* needs human */
    var needsHuman = [];
    F.cases.forEach(function (c) {
      if (!c.waitingAt || !within(c.start, cut)) return;
      var g = idx.gate.get(c.waitingAt);
      if (g && g.decider.type === 'human') needsHuman.push({ id: 'nh_' + c.id, kind: 'approval', text: c.name + '：等你在“' + g.name + '”拍板', target: { type: 'gate', id: g.id }, at: c.path[c.path.length - 1].at, caseId: c.id });
      else if (g) needsHuman.push({ id: 'nh_' + c.id, kind: 'direction', text: c.name + '：停在“' + g.name + '”，可以催办或调整', target: { type: 'gate', id: g.id }, at: c.path[c.path.length - 1].at, caseId: c.id });
    });
    gateEvents.filter(function (e) { return e.result === 'escalate'; }).forEach(function (e) {
      needsHuman.push({ id: 'nh_' + e.id, kind: 'escalation', text: '“' + (idx.gate.get(e.gateId) || {}).name + '”上报给你', target: { type: 'gate', id: e.gateId }, at: e.at });
    });
    (F.actions || []).filter(function (a) { return a.status === 'pending' && within(a.at, cut); }).forEach(function (a) {
      needsHuman.push({ id: 'nh_' + a.id, kind: 'direction', text: '你的操作待送达：' + (a.text || a.kind), target: a.target, at: a.at });
    });

    /* totals */
    var judged = gateEvents.filter(function (e) { var g = idx.gate.get(e.gateId); return g && g.decider.type !== 'rule'; });
    var firstTry = {};
    judged.forEach(function (e) { var k = e.caseId + e.gateId; if (!(k in firstTry)) firstTry[k] = e.result === 'pass'; });
    var ft = Object.keys(firstTry);
    var totals = {
      individuals: def.individuals.filter(function (x) { return x.kind === 'agent'; }).length,
      relations: def.relations.filter(function (r) { return r.type === 'task'; }).length,
      cases: F.cases.filter(function (c) { return within(c.start, cut); }).length,
      runs: runs.length, calls: calls.length, tokens: U.sumTokens(runs),
      firstPassRate: ft.length ? ft.filter(function (k) { return firstTry[k]; }).length / ft.length : null,
      reworkRate: judged.length ? judged.filter(function (e) { return e.result === 'fail'; }).length / judged.length : null,
      failedRuns: runs.filter(function (r) { return r.outcome === 'failed' || r.outcome === 'interrupted'; }).length
    };

    return {
      t: cut, now: now, relStats: relStats, factOnly: factOnly, factOnlyFlows: Object.keys(factOnlyFlows).map(function (k) { return factOnlyFlows[k]; }),
      unusedRelations: unusedRelations, neverDispatched: neverDispatched, indStats: indStats, groupStats: groupStats,
      stepStats: stepStats, gateStats: gateStats, flowStats: flowStats, delivery: delivery, channelStats: channelStats,
      health: health, needsHuman: needsHuman, totals: totals, comparability: cmp
    };
  }

  HUB.analysis = { buildIdx: buildIdx, analyze: analyze, comparability: comparability };
})();
