/* HUB.panels: the Specification & Conformance Diff Ledger (对账表).
   Dynamically responds to state.compare ('def' = Blueprint Spec, 'both' = Design vs Reality Diff Ledger, 'fact' = Active Runtime Ledger).
   Zero duplication with right-sidebar drawers (待办 / 体检) or bottom status bar. */
(function () {
  'use strict';
  var HUB = (window.HUB = window.HUB || {});
  var U = HUB.util;
  var L = U.LABELS;

  var EVENT_KIND_ZH = {
    outage: '故障', quota: '额度', recover: '恢复', pause: '暂停', resume: '恢复派活',
    maint_task: '生成维护任务', maint_done: '维护完成'
  };
  var LINE_TYPE_ZH = {
    task: '任务派发', info: '信息同步', watch: '监督审计', channel: '能力调用', factonly: '越界交接'
  };

  /* ---------- module-local UI state (survives repaint via closures) ---------- */
  var rosterSearch = '';
  var rosterSort = { key: 'name', dir: 1 };
  var relFilter = 'all'; // 'all' | 'fact_only' | 'unused' | 'matched'
  var last = { el: null, model: null, state: null };

  /* ================= pure data preparation (no DOM) ================= */

  function modelLabel(idx, mid) {
    if (!mid) return '-';
    var ch = idx.ch.get('ch_' + mid);
    if (ch && ch.name) return ch.name.replace(/^模型[:：]\s*/, '');
    return mid;
  }

  function entityName(idx, id) {
    if (!id) return '-';
    if (idx.ind.has(id)) return idx.ind.get(id).name || id;
    if (idx.ch.has(id)) return (idx.ch.get(id).name || id).replace(/^(模型|工具)[:：]\s*/, '');
    if (idx.group.has(id)) return idx.group.get(id).name || id;
    if (idx.stage.has(id)) return idx.stage.get(id).name || id;
    return id;
  }

  function prepare(model, state) {
    var m = model, st = state;
    if (!m || !st) return null;
    var idx = m.idx, def = m.def, F = m.facts;
    var an = HUB.model.an(st, m);
    var vis = function (at) { return HUB.model.visible(at, st); };
    var compareMode = st.compare || 'both';

    var scopeGroup = null;
    if (st.selection && st.selection.type === 'group') scopeGroup = idx.group.get(st.selection.id) || null;
    var scopeIds = scopeGroup ? (idx.membersDeep.get(scopeGroup.id) || []) : null;
    var scopeSet = scopeIds ? new Set(scopeIds) : null;
    var inScope = function (id) { return !scopeSet || scopeSet.has(id); };

    var header = {
      caseName: m.name,
      timeText: st.time == null ? '全部时间' : ('截止 ' + U.fmtClock(st.time)),
      synthetic: !!m.synthetic,
      deliveryMeasured: HUB.model.measured(m, 'delivery'), channelMeasured: HUB.model.measured(m, 'channel'),
      ordinal: m.clock === 'ordinal', factLabel: HUB.model.factLabel(m), factError: m.factSource && m.factSource.kind === 'error',
      scope: scopeGroup ? { id: scopeGroup.id, name: scopeGroup.name } : null
    };

    /* 1. 系统总览 (kept for backward compatibility with _prepare consumers) */
    var t = an.totals;
    var overview = [
      { key: 'individuals', label: '个体数', value: U.fmtNum(t.individuals) },
      { key: 'relations', label: '任务线数', value: U.fmtNum(t.relations) },
      { key: 'cases', label: '案例数', value: U.fmtNum(t.cases) },
      { key: 'runs', label: '运行数', value: U.fmtNum(t.runs) },
      { key: 'calls', label: '调用数', value: U.fmtNum(t.calls) },
      { key: 'tokens', label: 'Token', value: U.fmtTokens(t.tokens) },
      { key: 'firstPassRate', label: '首次通过率', value: U.pct(t.firstPassRate) },
      { key: 'reworkRate', label: '返工率', value: U.pct(t.reworkRate) },
      { key: 'failedRuns', label: '失败运行数', value: U.fmtNum(t.failedRuns) }
    ];

    /* 2. 需要人处理的事 (kept in _prepare for compatibility; rendered in right-sidebar drawer) */
    var needsHuman = an.needsHuman.slice().sort(function (a, b) { return a.at - b.at; }).map(function (item) {
      return { id: item.id, kind: item.kind, text: item.text, atText: U.fmtClock(item.at), target: item.target, approvable: item.kind === 'approval' };
    });

    /* 3. 个体名册与规格对账 */
    var roster = def.individuals.filter(function (x) { return inScope(x.id); }).map(function (x) {
      var s = an.indStats[x.id] || { runs: 0, tokens: 0, status: 'never' };
      var dv = an.delivery[x.id];
      var missCnt = header.deliveryMeasured && dv ? dv.missing.length : 0;
      var watchesNames = (x.watches || []).map(function (w) { return entityName(idx, w); });
      var diffState = x.kind === 'human' ? 'human'
        : s.status === 'never' ? 'never'
        : s.status === 'error' ? 'error'
        : missCnt > 0 ? 'missing_doc'
        : 'matched';
      return {
        id: x.id, name: x.name, kind: x.kind,
        groupName: x.groupId ? ((idx.group.get(x.groupId) || {}).name || '-') : '-',
        modelLabel: modelLabel(idx, x.model),
        role: x.role || (x.kind === 'human' ? '人工审批与反向调控决策者' : '-'),
        trigger: x.trigger || (x.kind === 'human' ? '门禁待拍板或异常上报时介入' : '-'),
        watchesText: watchesNames.length ? watchesNames.join('、') : '-',
        toolsText: x.tools && x.tools.length ? x.tools.join('、') : '-',
        status: s.status, statusLabel: L.indStatus[s.status] || s.status,
        runs: s.runs, tokens: s.tokens,
        missing: header.deliveryMeasured && dv ? dv.missing.length : null,
        diffState: diffState
      };
    });

    /* 3b. 协作连线与越界交接对账表 (relations.md vs runtime handoffs) */
    var declaredRels = def.relations.filter(function (r) {
      if (r.type === 'channel' && r.sub === 'maintain') return false;
      if (r.type === 'channel') return false; // capability channels have their own dedicated subtable in Matrix ②
      return inScope(r.from) || inScope(r.to);
    }).map(function (r) {
      var rs = an.relStats[r.id] || { count: 0, first: null, last: null };
      var diffState = rs.count > 0 ? 'matched' : 'unused';
      return {
        id: r.id,
        isFactOnly: false,
        fromId: r.from,
        fromName: entityName(idx, r.from),
        toId: r.to,
        toName: entityName(idx, r.to),
        toIsChannel: idx.ch.has(r.to),
        type: r.type,
        typeLabel: LINE_TYPE_ZH[r.type] || L.lineType[r.type] || r.type,
        subLabel: L.relSub[r.sub] || r.sub || '-',
        contractText: r.note || r.label || ((L.lineType[r.type] || r.type) + ' · ' + (L.relSub[r.sub] || r.sub || '协同交接')),
        count: rs.count || 0,
        firstText: rs.first != null ? U.fmtClock(rs.first) : '-',
        lastText: rs.last != null ? U.fmtClock(rs.last) : '-',
        diffState: diffState
      };
    });

    var factOnlyRels = (an.factOnly || []).filter(function (fo) {
      return inScope(fo.from) || inScope(fo.to);
    }).map(function (fo) {
      var hands = (fo.handoffIds || []).map(function (hid) { return idx.handoff.get(hid); }).filter(Boolean);
      var firstAt = hands.length ? hands[0].at : null;
      var lastAt = hands.length ? hands[hands.length - 1].at : null;
      return {
        id: fo.id,
        isFactOnly: true,
        fromId: fo.from,
        fromName: entityName(idx, fo.from),
        toId: fo.to,
        toName: entityName(idx, fo.to),
        toIsChannel: false,
        type: 'factonly',
        typeLabel: '越界交接',
        subLabel: '编排外直连',
        contractText: fo.note || 'relations.md 未声明此连线，运行中直接发生了跨节点交接',
        count: fo.count || 0,
        firstText: firstAt != null ? U.fmtClock(firstAt) : '-',
        lastText: lastAt != null ? U.fmtClock(lastAt) : '-',
        diffState: 'fact_only'
      };
    });

    var relationsLedger = declaredRels.concat(factOnlyRels);

    /* 4. 任务与信息 */
    var taskCases = F.cases.filter(function (c) { return vis(c.start); }).map(function (c) {
      var tasks = (idx.tasksByCase.get(c.id) || []).filter(function (tk) { return vis(tk.created); });
      var rework = tasks.filter(function (tk) { return (tk.visit || 1) > 1 || tk.status === 'rework'; }).length;
      return {
        id: c.id, name: c.name, status: c.status, statusLabel: L.caseStatus[c.status] || c.status,
        taskCount: tasks.length, reworkCount: rework,
        startText: U.fmtClock(c.start), endText: c.end != null ? U.fmtClock(c.end) : '进行中'
      };
    });
    var taskDocs = def.docs.map(function (d) {
      var expected = d.audience.length;
      var received = d.audience.filter(function (indId) {
        var dv = an.delivery[indId];
        return dv && dv.received.indexOf(d.id) >= 0;
      }).length;
      var trustState = (!header.deliveryMeasured ? (F.cases.some(function (c) { return c.status === 'done'; }) ? 'verified' : 'unreviewed')
        : (received >= expected && expected > 0 ? 'verified' : 'unreviewed'));
      var audNames = (d.audience || []).map(function (id) { return entityName(idx, id); });
      return {
        id: d.id, layerLabel: L.docLayer[d.layer] || d.layer, name: d.name,
        ownerName: (idx.ind.get(d.owner) || {}).name || d.owner,
        expected: expected, received: received, trustState: trustState,
        summary: d.summary || d.note || '共享黑板与上下文基准文档',
        audienceText: audNames.length > 4 ? audNames.slice(0, 4).join('、') + ' 等 ' + audNames.length + ' 人' : (audNames.join('、') || '全员')
      };
    });

    /* 5. 四段送达情况 (1.该知道 -> 2.已送到 -> 3.已读 -> 4.已写) */
    var delivery = def.individuals.filter(function (x) { return x.kind !== 'human' && inScope(x.id); }).map(function (x) {
      var dv = an.delivery[x.id] || { expected: [], received: [], missing: [], missedEver: [], pending: 0 };
      var docName = function (id) { return (idx.doc.get(id) || {}).name || id; };
      var indRuns = F.runs.filter(function (r) { return r.individualId === x.id && vis(r.start); });
      var indTurns = (F.turns || []).filter(function (tr) { return tr.individualId === x.id; });
      var expCnt = header.deliveryMeasured ? dv.expected.length : Math.max(1, def.docs.length);
      var recCnt = header.deliveryMeasured ? dv.received.length : (indRuns.length || indTurns.length ? expCnt : 0);
      var readCnt = indRuns.length > 0 || indTurns.length > 0 ? Math.max(1, recCnt) : 0;
      var writeCnt = indTurns.filter(function (tr) { return tr.kind === 'say' || tr.kind === 'tool'; }).length || indRuns.filter(function (r) { return r.outcome === 'ok' || r.outcome === 'done'; }).length;
      var expectedDocNames = (dv.expected && dv.expected.length ? dv.expected : def.docs.map(function (d) { return d.id; })).map(docName);
      return {
        id: x.id, name: x.name,
        expectedCount: expCnt, receivedCount: recCnt, readCount: readCnt, writtenCount: writeCnt,
        expectedDocsText: expectedDocNames.length ? expectedDocNames.join('、') : '-',
        missing: dv.missing.map(function (id) { return { id: id, name: docName(id) }; }),
        missedEver: dv.missedEver.map(function (id) { return { id: id, name: docName(id) }; }),
        pending: dv.pending,
        active: indRuns.length > 0 || indTurns.length > 0
      };
    });

    /* 6. 能力渠道 */
    var channels = def.channels.map(function (ch) {
      var cs = an.channelStats[ch.id] || { calls: 0, errors: 0, status: 'ok' };
      return {
        id: ch.id, name: ch.name, kindLabel: ch.kind === 'model' ? '模型' : '工具',
        userCount: ch.users.length, calls: cs.calls, errors: cs.errors,
        status: cs.status, statusLabel: L.channelStatus[cs.status] || cs.status,
        capacity: ch.capacity || (ch.limit ? '并发上限 ' + ch.limit : '不限并发'),
        quota: ch.quota || '按需调用',
        maintainerName: (idx.ind.get(ch.maintainer) || {}).name || ch.maintainer || '-',
        action: cs.status === 'paused' ? 'resume_channel' : 'pause_channel',
        actionLabel: cs.status === 'paused' ? '恢复' : '暂停'
      };
    });

    /* 7. 架构体检 (kept in _prepare for compatibility) */
    var health = { high: [], mid: [], low: [] };
    an.health.forEach(function (h) { (health[h.severity] || (health[h.severity] = [])).push(h); });

    /* 8. 运行统计与流程门禁契约 */
    var runsCut = F.runs.filter(function (r) { return vis(r.start); });
    var sumTokens = U.sumTokens;
    var failCount = function (rs) { return rs.filter(function (r) { return r.outcome === 'failed' || r.outcome === 'interrupted'; }).length; };
    var byGroup;
    if (scopeGroup) {
      var memSet = new Set(idx.membersDeep.get(scopeGroup.id) || []);
      var rs0 = runsCut.filter(function (r) { return memSet.has(r.individualId); });
      byGroup = [{ id: scopeGroup.id, name: scopeGroup.name, runs: rs0.length, tokens: sumTokens(rs0), failedRuns: failCount(rs0) }];
    } else {
      var groupedIds = new Set();
      byGroup = def.groups.filter(function (g) { return g.level === 1; }).map(function (g) {
        var mem = idx.membersDeep.get(g.id) || [];
        mem.forEach(function (id) { groupedIds.add(id); });
        var memSet2 = new Set(mem);
        var rs = runsCut.filter(function (r) { return memSet2.has(r.individualId); });
        return { id: g.id, name: g.name, runs: rs.length, tokens: sumTokens(rs), failedRuns: failCount(rs) };
      });
      var restRuns = runsCut.filter(function (r) { return !groupedIds.has(r.individualId); });
      if (restRuns.length) byGroup.push({ id: '_rest', name: '未分组（人与渠道维护者）', runs: restRuns.length, tokens: sumTokens(restRuns), failedRuns: failCount(restRuns) });
    }
    var stepRows = [];
    def.process.stages.forEach(function (stage) {
      stage.steps.forEach(function (step) {
        if (scopeSet && !step.executors.some(function (e) { return scopeSet.has(e); })) return;
        var s = an.stepStats[step.id] || { tasks: 0, done: 0, rework: 0, avgDur: null };
        var execNames = (step.executors || []).map(function (e) { return entityName(idx, e); }).join('、') || '-';
        stepRows.push({
          id: step.id, stageId: stage.id, stageName: stage.name, name: step.name,
          executorsText: execNames, outputText: step.output || '阶段交付件',
          tasks: s.tasks, avgDurText: U.fmtDur(s.avgDur), rework: s.rework
        });
      });
    });
    var gateRows = def.process.gates.filter(function (g) {
      if (!scopeSet) return true;
      if (g.decider.who && scopeSet.has(g.decider.who)) return true;
      var stage = idx.stage.get(g.afterStage);
      return !!(stage && stage.steps.some(function (st2) { return st2.executors.some(function (e) { return scopeSet.has(e); }); }));
    }).map(function (g) {
      var s = an.gateStats[g.id] || { pass: 0, fail: 0, escalate: 0, queueNow: 0 };
      var whoLabel = g.decider.type === 'human' ? '人工拍板'
        : g.decider.type === 'rule' ? '规则门禁'
        : entityName(idx, g.decider.who);
      var passName = g.pass === 'done' ? '完成归档' : entityName(idx, g.pass);
      var failName = g.fail ? entityName(idx, g.fail) : '-';
      var escName = g.escalate ? '上报人工' : '-';
      return {
        id: g.id, name: g.name,
        afterStageName: entityName(idx, g.afterStage),
        deciderType: g.decider.type,
        deciderLabel: whoLabel,
        ruleText: g.decider.text || '满足阶段验收标准后放行',
        routeText: '通过→' + passName + (g.fail ? ' · 打回→' + failName : '') + (g.escalate ? ' · 上报→' + escName : ''),
        pass: s.pass, fail: s.fail, queueNow: s.queueNow, escalate: s.escalate
      };
    });

    /* 9. 维护情况 */
    var maintenance = F.channelEvents.filter(function (e) { return vis(e.at); }).slice()
      .sort(function (a, b) { return a.at - b.at; }).map(function (e) {
        var ch = idx.ch.get(e.channelId);
        return { id: e.id, atText: U.fmtClock(e.at), channelName: ch ? ch.name : e.channelId, kind: e.kind, kindLabel: EVENT_KIND_ZH[e.kind] || e.kind, note: e.note || '' };
      });

    /* 10. 对账总览指标 (Conformance KPIs) */
    var nonHumanRoster = roster.filter(function (r) { return r.kind !== 'human'; });
    var agentTotal = nonHumanRoster.length;
    var agentNever = nonHumanRoster.filter(function (r) { return r.status === 'never'; }).length;
    var agentActive = agentTotal - agentNever;
    var relDeclared = declaredRels.length;
    var relActive = declaredRels.filter(function (r) { return r.count > 0; }).length;
    var relUnused = relDeclared - relActive;
    var factOnlyCount = factOnlyRels.length;
    var factOnlyTotalRuns = U.sum(factOnlyRels, function (r) { return r.count; });
    var docFullCount = delivery.filter(function (d) { return d.missing.length === 0; }).length;
    var docTargetCount = delivery.length;

    var conformance = {
      agentTotal: agentTotal,
      agentActive: agentActive,
      agentNever: agentNever,
      relDeclared: relDeclared,
      relActive: relActive,
      relUnused: relUnused,
      factOnlyCount: factOnlyCount,
      factOnlyTotalRuns: factOnlyTotalRuns,
      docFullCount: docFullCount,
      docTargetCount: docTargetCount,
      diffTotal: agentNever + relUnused + factOnlyCount
    };

    return {
      compareMode: compareMode,
      conformance: conformance,
      relationsLedger: relationsLedger,
      header: header, overview: overview, needsHuman: needsHuman, roster: roster,
      tasksCard: { cases: taskCases, docs: taskDocs }, delivery: delivery, channels: channels,
      health: health, runStats: { byGroup: byGroup, steps: stepRows, gates: gateRows }, maintenance: maintenance
    };
  }

  /* ================= DOM building (4 Compare-Driven Specification & Diff Matrices) ================= */

  function card(slug, badgeText, badgeCls, title, desc, body) {
    return U.h('section', { class: 'pn-card', 'data-key': 'panel:' + slug },
      U.h('div', { class: 'pn-card-head' },
        U.h('div', { class: 'pn-card-title-row' },
          U.h('h3', { class: 'pn-card-title' }, title),
          badgeText ? U.h('span', { class: 'pn-mode-tag ' + (badgeCls || '') }, badgeText) : null),
        desc ? U.h('p', { class: 'pn-card-desc' }, desc) : null),
      U.h('div', { class: 'pn-card-body' }, body));
  }

  function tableOf(headers, rows) {
    return U.h('div', { class: 'pn-table-wrap' },
      U.h('table', { class: 'pn-table' },
        U.h('thead', null, U.h('tr', null, headers.map(function (x) { return U.h('th', null, x); }))),
        U.h('tbody', null, rows)));
  }

  function scopeSuffix(data) { return data.header.scope ? '（只看：' + data.header.scope.name + '）' : ''; }

  /* 矩阵 ①：协作连线与越界交接对账表 (Replaces duplicate 待办/体检 card) */
  function cardRelationsLedger(data) {
    var mode = data.compareMode;
    var allRows = data.relationsLedger;

    if (mode === 'def') {
      var defRows = allRows.filter(function (r) { return !r.isFactOnly; });
      var tbodyDef = defRows.length ? defRows.map(function (r) {
        return U.h('tr', { class: 'pn-row', 'data-key': 'rel:' + r.id, onClick: function () {
          HUB.store.set({ selection: { type: 'relation', id: r.id } }, { history: false });
        } },
          U.h('td', { class: 'pn-strong' }, r.fromName + ' → ' + r.toName),
          U.h('td', null, U.h('span', { class: 'pn-line-pill pn-lt-' + r.type }, r.typeLabel)),
          U.h('td', null, r.subLabel),
          U.h('td', { class: 'pn-wrap-cell' }, r.contractText),
          U.h('td', null,
            U.h('button', { class: 'pn-btn', type: 'button', onClick: function (e) {
              e.stopPropagation();
              HUB.store.set({ present: 'graph', selection: { type: 'relation', id: r.id } });
            } }, '看拓扑')));
      }) : [U.h('tr', null, U.h('td', { colspan: 5, class: 'pn-empty-cell' }, '编排文档未声明跨个体连线'))];

      return card('relations-ledger', '📐 静态契约规格', 'def',
        '① 协作连线与通信契约规格表（relations.md）',
        '展示编排文档声明的全部任务派发、信息同步与监督审计连线规则，叠加空白运行干扰。' + scopeSuffix(data),
        tableOf(['发起方 → 接收方', '连线类型', '动作子类型', '编排契约说明 (relations.md)', '画布联动'], tbodyDef));
    }

    if (mode === 'fact') {
      var activeRows = allRows.filter(function (r) { return r.count > 0; }).sort(function (a, b) { return b.count - a.count; });
      var hiddenUnused = allRows.filter(function (r) { return !r.isFactOnly && r.count === 0; }).length;
      var tbodyFact = activeRows.length ? activeRows.map(function (r) {
        var badge = r.isFactOnly
          ? U.h('span', { class: 'ob-pill warn' }, '🔥 编排外直连')
          : U.h('span', { class: 'pn-line-pill pn-lt-' + r.type }, r.typeLabel + ' · ' + r.subLabel);
        return U.h('tr', { class: 'pn-row', 'data-key': 'relfact:' + r.id, onClick: function () {
          HUB.store.set({ selection: { type: r.isFactOnly ? 'factonly' : 'relation', id: r.id } }, { history: false });
        } },
          U.h('td', { class: 'pn-strong' }, r.fromName + ' → ' + r.toName),
          U.h('td', null, badge),
          U.h('td', { class: 'pn-num pn-strong' }, U.fmtNum(r.count) + ' 次'),
          U.h('td', null, r.lastText),
          U.h('td', { class: 'pn-wrap-cell' }, r.contractText),
          U.h('td', null,
            U.h('button', { class: 'pn-btn', type: 'button', onClick: function (e) {
              e.stopPropagation();
              HUB.store.set({ present: 'graph', selection: { type: r.isFactOnly ? 'factonly' : 'relation', id: r.id } });
            } }, '看拓扑')));
      }) : [U.h('tr', null, U.h('td', { colspan: 6, class: 'pn-empty-cell' }, '当前时间范围内尚无实际交接记录'))];

      return card('relations-ledger', '⚡ 活跃实跑流水' + (hiddenUnused ? ' · 已滤除 ' + hiddenUnused + ' 条死线' : ''), 'fact',
        '① 实际发生的交接与调用流水账',
        '已自动隐藏 0 次触发的静态连线，仅列出当前时间点前真实发生过的交接路径与频次。' + scopeSuffix(data),
        tableOf(['发起方 → 接收方', '实际交接属性', '实跑次数', '最近发生', '交接依据 / 说明', '画布联动'], tbodyFact));
    }

    /* mode === 'both': Design vs Reality Conformance Ledger */
    var cntFactOnly = allRows.filter(function (r) { return r.diffState === 'fact_only'; }).length;
    var cntUnused = allRows.filter(function (r) { return r.diffState === 'unused'; }).length;
    var cntMatched = allRows.filter(function (r) { return r.diffState === 'matched'; }).length;

    var filterBar = U.h('div', { class: 'pn-filter-bar' },
      [
        ['all', '全部连线 (' + allRows.length + ')'],
        ['fact_only', '🔥 编排外越界 (' + cntFactOnly + ')'],
        ['unused', '⚠ 声明未触发 (' + cntUnused + ')'],
        ['matched', '✓ 按设计走通 (' + cntMatched + ')']
      ].map(function (f) {
        return U.h('button', {
          type: 'button',
          class: 'pn-filter-chip' + (relFilter === f[0] ? ' on' : ''),
          onClick: function () { relFilter = f[0]; repaint(); }
        }, f[1]);
      }));

    var rank = { fact_only: 0, unused: 1, matched: 2 };
    var filtered = allRows.filter(function (r) {
      return relFilter === 'all' || r.diffState === relFilter;
    }).slice().sort(function (a, b) {
      if (rank[a.diffState] !== rank[b.diffState]) return rank[a.diffState] - rank[b.diffState];
      return b.count - a.count;
    });

    var tbodyBoth = filtered.length ? filtered.map(function (r) {
      var statusPill = r.diffState === 'fact_only'
        ? U.h('span', { class: 'ob-pill bad' }, '🔥 编排外越界')
        : r.diffState === 'unused'
        ? U.h('span', { class: 'ob-pill warn' }, '⚠ 声明未触发')
        : U.h('span', { class: 'ob-pill good' }, '✓ 按设计走通');

      var actBtns = [];
      if (r.isFactOnly) {
        actBtns.push(U.h('button', {
          class: 'pn-btn pn-btn-accent',
          type: 'button',
          title: '将该越界交接一键生成 relations.md 补写 Diff 预览',
          onClick: function (e) {
            e.stopPropagation();
            if (HUB.obsPanel && HUB.obsPanel.openPreview) {
              HUB.obsPanel.openPreview('add_relation', {
                target: { type: 'individual', id: r.fromId },
                from: r.fromId,
                to: r.toId,
                relType: 'task',
                text: r.contractText || '补写实跑交接连线'
              });
              if (HUB.shell && HUB.shell.toast) HUB.shell.toast('已在右侧栏生成 relations.md 补写 Diff 预览');
            }
          }
        }, '+ 补写进编排'));
      }
      actBtns.push(U.h('button', {
        class: 'pn-btn',
        type: 'button',
        onClick: function (e) {
          e.stopPropagation();
          HUB.store.set({ present: 'graph', selection: { type: r.isFactOnly ? 'factonly' : 'relation', id: r.id } });
        }
      }, '看拓扑'));

      return U.h('tr', {
        class: 'pn-row' + (r.diffState === 'fact_only' ? ' pn-row-alert' : r.diffState === 'unused' ? ' pn-row-warn' : ''),
        'data-key': 'reldiff:' + r.id,
        onClick: function () {
          HUB.store.set({ selection: { type: r.isFactOnly ? 'factonly' : 'relation', id: r.id } }, { history: false });
        }
      },
        U.h('td', { class: 'pn-strong' }, r.fromName + ' → ' + r.toName),
        U.h('td', null, U.h('span', { class: 'pn-line-pill pn-lt-' + r.type }, r.typeLabel)),
        U.h('td', null, statusPill),
        U.h('td', { class: 'pn-num' }, U.fmtNum(r.count) + ' 次'),
        U.h('td', { class: 'pn-wrap-cell' }, r.contractText),
        U.h('td', null, U.h('div', { class: 'pn-row-actions' }, actBtns)));
    }) : [U.h('tr', null, U.h('td', { colspan: 6, class: 'pn-empty-cell' }, '当前筛选条件下没有连线记录'))];

    return card('relations-ledger', '⚖ 设计 vs 实跑对账', 'both',
      '① 协作连线与越界交接对账表',
      '逐条核对 relations.md 声明连线与真实交接记录：揪出“写了没走”的死线与“没写却私下交接”的越界连线，支持一键补写进编排。' + scopeSuffix(data),
      U.h('div', null, filterBar, tableOf(['发起方 → 接收方', '类型', '对账结论', '实跑次数', '契约说明 / 越界依据', '逆向调控'], tbodyBoth)));
  }

  /* 矩阵 ②：智能体编制规格与实绩对账表 (Roster + Channels) */
  function cardRosterAndChannels(data) {
    var mode = data.compareMode;
    var rows = data.roster.slice();
    var hiddenNeverCount = 0;

    if (mode === 'fact') {
      hiddenNeverCount = rows.filter(function (r) { return r.kind !== 'human' && r.status === 'never'; }).length;
      rows = rows.filter(function (r) { return r.kind !== 'human' && r.status !== 'never'; });
    }

    var q = rosterSearch.trim();
    if (q) {
      rows = rows.filter(function (r) {
        return r.name.indexOf(q) >= 0 || r.groupName.indexOf(q) >= 0 || r.role.indexOf(q) >= 0;
      });
    }

    var key = rosterSort.key, dir = rosterSort.dir;
    rows.sort(function (a, b) {
      var av = a[key], bv = b[key];
      if (typeof av === 'string' || typeof bv === 'string') return dir * String(av || '').localeCompare(String(bv || ''), 'zh');
      av = av == null ? 0 : av; bv = bv == null ? 0 : bv;
      return dir * (av - bv);
    });

    var searchBox = U.h('input', {
      class: 'pn-search', type: 'text', placeholder: '按个体名称、所属部门或职责关键词筛选…', value: rosterSearch,
      onInput: function (e) { rosterSearch = e.target.value; repaint(); }
    });

    if (mode === 'def') {
      var colsDef = [
        { key: 'name', label: '个体名称' },
        { key: 'groupName', label: '所属部门/小组' },
        { key: 'modelLabel', label: '模型配置' },
        { key: 'role', label: '职责契约 (role)' },
        { key: 'trigger', label: '触发条件 (trigger)' },
        { key: 'watchesText', label: '监督对象' }
      ];
      var headDef = U.h('tr', null, colsDef.map(function (c) {
        var marker = rosterSort.key === c.key ? (rosterSort.dir > 0 ? ' ▲' : ' ▼') : '';
        return U.h('th', { class: 'pn-th-sort', onClick: function () {
          if (rosterSort.key === c.key) rosterSort.dir = -rosterSort.dir; else { rosterSort.key = c.key; rosterSort.dir = 1; }
          repaint();
        } }, c.label + marker);
      }));
      var bodyDef = rows.length ? rows.map(function (r) {
        return U.h('tr', { class: 'pn-row', 'data-key': 'ind:' + r.id, onClick: function () {
          HUB.store.set({ selection: { type: 'individual', id: r.id } }, { history: false });
        } },
          U.h('td', { class: 'pn-strong' }, r.name),
          U.h('td', null, r.groupName),
          U.h('td', null, r.modelLabel),
          U.h('td', { class: 'pn-wrap-cell' }, r.role),
          U.h('td', { class: 'pn-wrap-cell' }, r.trigger),
          U.h('td', null, r.watchesText));
      }) : [U.h('tr', null, U.h('td', { colspan: 6, class: 'pn-empty-cell' }, '没有匹配的个体'))];

      var chRowsDef = data.channels.slice(0, 8).map(function (ch) {
        return U.h('tr', { 'data-key': 'ch:' + ch.id },
          U.h('td', { class: 'pn-strong' }, ch.name),
          U.h('td', null, ch.kindLabel),
          U.h('td', null, ch.capacity),
          U.h('td', null, ch.quota),
          U.h('td', { class: 'pn-num' }, U.fmtNum(ch.userCount) + ' 人'),
          U.h('td', null, ch.maintainerName));
      });

      return card('roster-channels', '📐 静态契约规格', 'def',
        '② 智能体职责规格与能力渠道契约表（agents.md / channels.md）',
        '纯看编排文档定义的团队角色分工、唤醒触发条件、监督关系以及共享模型/工具的并发配额约定。' + scopeSuffix(data),
        U.h('div', null,
          searchBox,
          U.h('div', { class: 'pn-table-wrap' }, U.h('table', { class: 'pn-table' }, U.h('thead', null, headDef), U.h('tbody', null, bodyDef))),
          U.h('h4', { class: 'pn-sub-title' }, '共享模型与工具渠道配额契约'),
          tableOf(['渠道名称', '类型', '并发容量约定', '配额上限', '授权使用者', '负责维护者'], chRowsDef)));
    }

    /* mode === 'both' or 'fact' */
    var cols = mode === 'both'
      ? [
          { key: 'name', label: '个体名称' },
          { key: 'groupName', label: '分组 / 模型' },
          { key: 'role', label: '职责契约摘要' },
          { key: 'status', label: '履职对账状态' },
          { key: 'runs', label: '运行数' },
          { key: 'tokens', label: 'Token' },
          { key: 'missing', label: '缺文档' },
          { key: 'id', label: '调控' }
        ]
      : [
          { key: 'name', label: '活跃个体' },
          { key: 'groupName', label: '分组' },
          { key: 'modelLabel', label: '模型' },
          { key: 'status', label: '当前状态' },
          { key: 'runs', label: '实际运行数' },
          { key: 'tokens', label: 'Token 消耗' },
          { key: 'missing', label: '缺文档' }
        ];

    var headRow = U.h('tr', null, cols.map(function (c) {
      var marker = rosterSort.key === c.key ? (rosterSort.dir > 0 ? ' ▲' : ' ▼') : '';
      return U.h('th', { class: 'pn-th-sort', onClick: function () {
        if (rosterSort.key === c.key) rosterSort.dir = -rosterSort.dir; else { rosterSort.key = c.key; rosterSort.dir = 1; }
        repaint();
      } }, c.label + marker);
    }));

    var bodyRows = rows.length ? rows.map(function (r) {
      var diffBadge;
      if (r.diffState === 'never') {
        diffBadge = U.h('span', { class: 'ob-pill warn' }, '⚠ 声明未派活');
      } else if (r.diffState === 'error') {
        diffBadge = U.h('span', { class: 'ob-pill bad' }, '❗ 运行报错');
      } else if (r.diffState === 'missing_doc') {
        diffBadge = U.h('span', { class: 'ob-pill warn' }, '❗ 漏收文档(' + r.missing + ')');
      } else if (r.diffState === 'human') {
        diffBadge = U.h('span', { class: 'ob-pill info' }, '👤 人工决策');
      } else {
        diffBadge = U.h('span', { class: 'ob-pill good' }, '✓ 正常履职 (' + r.statusLabel + ')');
      }

      if (mode === 'both') {
        return U.h('tr', {
          class: 'pn-row' + (r.diffState === 'never' ? ' pn-row-warn' : r.diffState === 'error' ? ' pn-row-alert' : ''),
          'data-key': 'ind:' + r.id,
          onClick: function () {
            HUB.store.set({ selection: { type: 'individual', id: r.id } }, { history: false });
          }
        },
          U.h('td', { class: 'pn-strong' }, r.name),
          U.h('td', null, r.groupName + ' · ' + r.modelLabel),
          U.h('td', { class: 'pn-wrap-cell', title: '触发条件：' + r.trigger }, r.role),
          U.h('td', null, diffBadge),
          U.h('td', { class: 'pn-num' }, U.fmtNum(r.runs)),
          U.h('td', { class: 'pn-num' }, U.fmtTokens(r.tokens)),
          U.h('td', { class: 'pn-num' + (r.missing > 0 ? ' pn-bad' : '') }, !data.header.deliveryMeasured ? '0' : r.missing == null ? '-' : U.fmtNum(r.missing)),
          U.h('td', null, r.kind === 'human' ? '-' : U.h('button', {
            class: 'pn-btn',
            type: 'button',
            onClick: function (e) {
              e.stopPropagation();
              if (HUB.obsPanel && HUB.obsPanel.openPreview) {
                var actKind = r.diffState === 'never' ? 'urge' : 'interject';
                var actText = r.diffState === 'never'
                  ? '编排已声明该角色但尚未触发，请检查前置触发条件并立即启动阶段任务'
                  : '请复核当前阶段产出并在共享黑板同步核验结论';
                HUB.obsPanel.openPreview(actKind, { target: { type: 'individual', id: r.id }, text: actText });
                if (HUB.shell && HUB.shell.toast) HUB.shell.toast('已在右侧栏生成信箱指令 Diff 预览');
              }
            }
          }, r.diffState === 'never' ? '⚡ 催办派活' : '★ 指令')));
      }

      return U.h('tr', { class: 'pn-row', 'data-key': 'ind:' + r.id, onClick: function () {
        HUB.store.set({ selection: { type: 'individual', id: r.id } }, { history: false });
      } },
        U.h('td', { class: 'pn-strong' }, r.name),
        U.h('td', null, r.groupName),
        U.h('td', null, r.modelLabel),
        U.h('td', null, U.h('span', { class: 'pn-dot', 'data-s': r.status }), r.statusLabel),
        U.h('td', { class: 'pn-num' }, U.fmtNum(r.runs)),
        U.h('td', { class: 'pn-num' }, U.fmtTokens(r.tokens)),
        U.h('td', { class: 'pn-num' + (r.missing > 0 ? ' pn-bad' : '') }, !data.header.deliveryMeasured ? '0' : r.missing == null ? '-' : U.fmtNum(r.missing)));
    }) : [U.h('tr', null, U.h('td', { colspan: cols.length, class: 'pn-empty-cell' }, '没有匹配的个体'))];

    var rosterTable = U.h('div', { class: 'pn-table-wrap' }, U.h('table', { class: 'pn-table' }, U.h('thead', null, headRow), U.h('tbody', null, bodyRows)));

    var chList = mode === 'fact' ? data.channels.filter(function (c) { return c.calls > 0 || c.status !== 'ok'; }) : data.channels;
    var chRows = chList.slice(0, 8).map(function (ch) {
      return U.h('tr', { 'data-key': 'ch:' + ch.id },
        U.h('td', { class: 'pn-strong' }, ch.name), U.h('td', null, ch.kindLabel),
        U.h('td', { class: 'pn-num' }, U.fmtNum(ch.userCount)), U.h('td', { class: 'pn-num' }, U.fmtNum(ch.calls)),
        U.h('td', null, U.h('span', { class: 'pn-ch-status', 'data-s': ch.status }, ch.statusLabel)),
        U.h('td', null, U.h('button', { class: 'pn-btn', type: 'button', onClick: function () {
          HUB.model.perform(ch.action, { target: { type: 'channel', id: ch.id } });
        } }, ch.actionLabel)));
    });

    return card('roster-channels',
      mode === 'both' ? '⚖ 设计 vs 实跑对账' : ('⚡ 活跃实跑负载' + (hiddenNeverCount ? ' · 已隐藏 ' + hiddenNeverCount + ' 名闲置个体' : '')),
      mode,
      mode === 'both' ? '② 智能体编制规格与实绩对账表' : '② 活跃智能体与能力渠道实跑负载表',
      (mode === 'both'
        ? '对照 agents.md 声明职责与真实运行记录：直接标出“声明了但从未派活”的闲置个体与漏收文档个体，支持一键催办。'
        : '已过滤未派活的闲置个体，仅展示实际参与运行的智能体吞吐与能力渠道调用负载。') + scopeSuffix(data),
      U.h('div', null,
        searchBox, rosterTable,
        U.h('h4', { class: 'pn-sub-title' }, '共享模型与工具渠道运行负载'),
        tableOf(['渠道名称', '类型', '使用者', '调用数', '状态', '调控'], chRows)));
  }

  /* 矩阵 ③：共享黑板契约与四段送达漏斗 (Delivery + Blackboard Trust) */
  function cardDeliveryAndTrust(data) {
    var mode = data.compareMode;

    if (mode === 'def') {
      var docSpecRows = data.tasksCard.docs.length ? data.tasksCard.docs.map(function (d) {
        return U.h('tr', { 'data-key': 'docspec:' + d.id },
          U.h('td', null, U.h('span', { class: 'ob-pill info' }, d.layerLabel)),
          U.h('td', { class: 'pn-strong' }, d.name),
          U.h('td', null, d.ownerName),
          U.h('td', { class: 'pn-wrap-cell' }, d.audienceText),
          U.h('td', { class: 'pn-wrap-cell' }, d.summary));
      }) : [U.h('tr', null, U.h('td', { colspan: 5, class: 'pn-empty-cell' }, '编排文档未声明共享黑板文档'))];

      var subRows = data.delivery.length ? data.delivery.map(function (x) {
        return U.h('tr', { 'data-key': 'dvdef:' + x.id },
          U.h('td', { class: 'pn-strong' }, x.name),
          U.h('td', { class: 'pn-num' }, U.fmtNum(x.expectedCount) + ' 份'),
          U.h('td', { class: 'pn-wrap-cell' }, x.expectedDocsText));
      }) : [U.h('tr', null, U.h('td', { colspan: 3, class: 'pn-empty-cell' }, '没有个体'))];

      return card('delivery-trust', '📐 静态契约规格', 'def',
        '③ 共享黑板文档与受众契约规格表（docs.md）',
        '展示编排文档定义的共享黑板层级（共识/私有/地图）、负责维护者及每个智能体“1.该知道”的应知上下文列表。' + scopeSuffix(data),
        U.h('div', null,
          tableOf(['黑板层级', '文档 / 黑板名称', '负责维护者', '声明受众范围 (audience)', '文档契约摘要'], docSpecRows),
          U.h('h4', { class: 'pn-sub-title' }, '各智能体应知上下文契约清单（1.该知道）'),
          tableOf(['个体名称', '应知文档数', '声明订阅的上下文文档'], subRows)));
    }

    var delivList = mode === 'fact' ? data.delivery.filter(function (x) { return x.active; }) : data.delivery;
    var rows = delivList.length ? delivList.map(function (x) {
      var missingEls = x.missing.length ? x.missing.map(function (d) {
        return U.h('span', { class: 'pn-tag pn-bad', 'data-key': 'missdoc:' + x.id + ':' + d.id },
          d.name,
          U.h('button', { class: 'pn-btn-mini', type: 'button', onClick: function () {
            HUB.model.perform('redeliver', { target: { type: 'individual', id: x.id }, docId: d.id });
          } }, '补送'));
      }) : [U.h('span', { class: 'pn-muted' }, '✓ 完整送达')];
      return U.h('tr', { class: x.missing.length ? 'pn-row-warn' : '', 'data-key': 'dv:' + x.id },
        U.h('td', { class: 'pn-strong' }, x.name),
        U.h('td', { class: 'pn-num' }, U.fmtNum(x.expectedCount)),
        U.h('td', { class: 'pn-num' }, U.fmtNum(x.receivedCount)),
        U.h('td', { class: 'pn-num' }, U.fmtNum(x.readCount)),
        U.h('td', { class: 'pn-num' }, U.fmtNum(x.writtenCount)),
        U.h('td', null, U.h('div', { class: 'pn-tags' }, missingEls)));
    }) : [U.h('tr', null, U.h('td', { colspan: 6, class: 'pn-empty-cell' }, '没有匹配的个体送达记录'))];

    var docRows = data.tasksCard.docs.map(function (d) {
      var trustBadge = d.trustState === 'verified'
        ? U.h('span', { class: 'ob-pill good' }, '✓ 已核验签发')
        : U.h('span', { class: 'ob-pill warn' }, '◌ 待审草稿');
      return U.h('tr', { 'data-key': 'doc:' + d.id },
        U.h('td', null, d.layerLabel), U.h('td', { class: 'pn-strong' }, d.name), U.h('td', null, d.ownerName),
        U.h('td', { class: 'pn-num' }, U.fmtNum(d.received) + ' / ' + U.fmtNum(d.expected)),
        U.h('td', null, trustBadge));
    });

    return card('delivery-trust',
      mode === 'both' ? '⚖ 设计 vs 实跑对账' : '⚡ 活跃实跑漏斗',
      mode,
      mode === 'both' ? '③ 共享黑板契约与四段送达漏斗对账表' : '③ 共享黑板实际读写与四段送达漏斗',
      '追踪每个个体“1.该知道 → 2.已送到 → 3.已读 → 4.已写”四段闭环，审计共享黑板文档是待审草稿还是已核验签发。' + scopeSuffix(data),
      U.h('div', null,
        tableOf(['个体', '1.该知道', '2.已送到', '3.已读', '4.已写', '送达对账与一键补送'], rows),
        U.h('h4', { class: 'pn-sub-title' }, '共享文档与黑板信任态审计（区分“写完未审”与“核验通过”）'),
        tableOf(['层级', '文档/黑板名称', '维护者', '送达覆盖', '信任态角标'], docRows)));
  }

  /* 矩阵 ④：流程阶段门禁对账与多案例横向比较表 (Process Gates + Cases) */
  function cardCasesAndRunStats(data) {
    var mode = data.compareMode;
    var rs = data.runStats;

    if (mode === 'def') {
      var stepDefRows = rs.steps.length ? rs.steps.map(function (s) {
        return U.h('tr', { class: 'pn-row', onClick: function () {
          HUB.store.set({ subject: 'process', present: 'graph', selection: { type: 'step', id: s.id } });
        } },
          U.h('td', null, s.stageName),
          U.h('td', { class: 'pn-strong' }, s.name),
          U.h('td', { class: 'pn-wrap-cell' }, s.executorsText),
          U.h('td', { class: 'pn-wrap-cell' }, s.outputText));
      }) : [U.h('tr', null, U.h('td', { colspan: 4, class: 'pn-empty-cell' }, '编排文档未定义流程步骤'))];

      var gateDefRows = rs.gates.length ? rs.gates.map(function (g) {
        return U.h('tr', { class: 'pn-row', onClick: function () {
          HUB.store.set({ subject: 'process', present: 'graph', selection: { type: 'gate', id: g.id } });
        } },
          U.h('td', { class: 'pn-strong' }, g.name),
          U.h('td', null, g.afterStageName),
          U.h('td', null, U.h('span', { class: 'ob-pill info' }, g.deciderLabel)),
          U.h('td', { class: 'pn-wrap-cell' }, g.routeText),
          U.h('td', { class: 'pn-wrap-cell' }, g.ruleText));
      }) : [U.h('tr', null, U.h('td', { colspan: 5, class: 'pn-empty-cell' }, '编排文档未定义门禁判断点'))];

      return card('cases-stats', '📐 静态契约规格', 'def',
        '④ 流程阶段分工与门禁裁决契约表（process.md）',
        '展示编排文档定义的阶段步骤分工、指派执行者、交付物规格以及每个门禁判断点（Gate）的通过/打回/上报路由准则。' + scopeSuffix(data),
        U.h('div', null,
          U.h('h4', { class: 'pn-sub-title', style: { marginTop: 0 } }, '流程阶段与步骤分工契约'),
          tableOf(['所属阶段', '步骤名称', '指派执行者 (executors)', '规定产出物 (output)'], stepDefRows),
          U.h('h4', { class: 'pn-sub-title' }, '门禁判断点裁决契约（Gates）'),
          tableOf(['判断点名称', '前置阶段', '把关裁决者', '分支出口路由', '门禁裁决准则'], gateDefRows)));
    }

    var t = data.tasksCard;
    var caseRows = t.cases.length ? t.cases.map(function (c) {
      var stCls = c.status === 'done' ? 'good' : c.status === 'blocked' ? 'bad' : 'info';
      return U.h('tr', { class: 'pn-row', 'data-key': 'case:' + c.id, onClick: function () {
        HUB.store.set({ focus: { type: 'case', id: c.id }, instanceId: c.id, subject: 'org', present: 'graph' });
      } },
        U.h('td', { class: 'pn-strong' }, c.id + ' ' + c.name),
        U.h('td', null, U.h('span', { class: 'ob-pill ' + stCls }, c.statusLabel)),
        U.h('td', { class: 'pn-num' }, U.fmtNum(c.taskCount)),
        U.h('td', { class: 'pn-num' + (c.reworkCount > 0 ? ' pn-bad' : '') }, U.fmtNum(c.reworkCount)),
        U.h('td', null, c.startText),
        U.h('td', null, U.h('div', { class: 'pn-row-actions' },
          U.h('button', { class: 'pn-btn', type: 'button', onClick: function (e) {
            e.stopPropagation();
            HUB.store.set({ focus: { type: 'case', id: c.id }, instanceId: c.id, subject: 'org', present: 'graph' });
          } }, '点亮拓扑'),
          !data.header.synthetic ? U.h('button', { class: 'pn-btn', type: 'button', onClick: function (e) {
            e.stopPropagation();
            HUB.store.set({ subject: 'collab', focus: { type: 'case', id: c.id }, instanceId: c.id, present: 'graph', time: null });
          } }, '看轨迹 T') : null)));
    }) : [U.h('tr', null, U.h('td', { colspan: 6, class: 'pn-empty-cell' }, '当前时间范围内没有案例实例'))];

    var stepList = mode === 'fact' ? rs.steps.filter(function (s) { return s.tasks > 0 || s.rework > 0; }) : rs.steps;
    var stepRows = stepList.length ? stepList.slice(0, 10).map(function (s) {
      return U.h('tr', null,
        U.h('td', null, s.stageName),
        U.h('td', { class: 'pn-strong' }, s.name),
        U.h('td', null, s.executorsText),
        U.h('td', { class: 'pn-num' }, U.fmtNum(s.tasks)),
        U.h('td', { class: 'pn-num' }, s.avgDurText),
        U.h('td', { class: 'pn-num' + (s.rework > 0 ? ' pn-bad' : '') }, U.fmtNum(s.rework)));
    }) : [U.h('tr', null, U.h('td', { colspan: 6, class: 'pn-empty-cell' }, '没有活跃的流程步骤记录'))];

    var gateRows = rs.gates.length ? rs.gates.map(function (g) {
      return U.h('tr', { class: g.queueNow > 0 || g.fail > 0 ? 'pn-row-warn' : '' },
        U.h('td', { class: 'pn-strong' }, g.name),
        U.h('td', null, g.deciderLabel),
        U.h('td', { class: 'pn-num' }, U.fmtNum(g.pass)),
        U.h('td', { class: 'pn-num' + (g.fail > 0 ? ' pn-bad' : '') }, U.fmtNum(g.fail)),
        U.h('td', { class: 'pn-num' }, U.fmtNum(g.queueNow)),
        U.h('td', { class: 'pn-num' }, U.fmtNum(g.escalate)));
    }) : [U.h('tr', null, U.h('td', { colspan: 6, class: 'pn-empty-cell' }, '没有判断点'))];

    return card('cases-stats',
      mode === 'both' ? '⚖ 设计 vs 实跑对账' : '⚡ 活跃实跑统计',
      mode,
      mode === 'both' ? '④ 流程阶段门禁对账与多案例横向比较表' : '④ 多案例实跑结局与阶段门禁吞吐统计',
      '横向对比各案例实例（K1/K2/K3…）的结局与返工次数，核对各流程步骤与门禁判断点的通过、打回与排队情况。' + scopeSuffix(data),
      U.h('div', null,
        tableOf(['案例实例', '结局状态', '任务数', '返工数', '开始', '画布联动'], caseRows),
        U.h('h4', { class: 'pn-sub-title' }, '按流程步骤对账'),
        tableOf(['阶段', '步骤', '声明执行者', '实跑任务数', data.header.ordinal ? '平均发言条数' : '平均时长', '返工数'], stepRows),
        U.h('h4', { class: 'pn-sub-title' }, '按门禁判断点（Gates）对账'),
        tableOf(['判断点', '把关裁决者', '通过', '打回', '当前排队', '上报'], gateRows)));
  }

  function buildHeader(data) {
    var h = data.header;
    var c = data.conformance;
    var mode = data.compareMode;

    var left = [
      U.h('span', { class: 'pn-tag-plain' }, h.caseName),
      U.h('span', { class: 'pn-tag-plain' }, h.timeText),
      U.h('span', { class: h.factError ? 'ob-pill warn' : 'pn-badge-sim' }, h.factLabel)
    ];
    if (h.scope) {
      left.push(U.h('span', { class: 'pn-scope-chip' }, '只看：' + h.scope.name + ' ',
        U.h('button', { class: 'pn-scope-x', type: 'button', onClick: function () {
          HUB.store.set({ selection: null }, { history: false });
        } }, '×')));
    }

    var lensSummaryText = mode === 'def'
      ? '📐 当前视角：蓝图定义（纯看 Markdown 编排静态契约规格，不混入运行态指标）'
      : mode === 'fact'
      ? '⚡ 当前视角：仅看实跑（已自动隐藏 0 次触发死线与未派活闲置个体）'
      : ('⚖ 当前视角：实况对照（设计声明 vs 真实运行逐项对账' + (c.diffTotal > 0 ? ' · 发现 ' + c.diffTotal + ' 处偏差' : ' · 零偏差') + '）');

    var lensSummary = U.h('div', { class: 'pn-mode-tag ' + mode }, lensSummaryText);

    var topRow = U.h('div', { class: 'pn-header' },
      U.h('div', { class: 'pn-header-left' }, left),
      lensSummary);

    var tiles = mode === 'def'
      ? [
          {
            title: '声明智能体编制',
            val: c.agentTotal + ' 名智能体',
            sub: '按 agents.md 声明的职责、触发条件与模型契约展示',
            cls: 'info'
          },
          {
            title: '声明协作连线数',
            val: c.relDeclared + ' 条连线',
            sub: '含任务派发、信息同步与监督审计契约 (relations.md)',
            cls: 'info'
          },
          {
            title: '声明共享黑板文档',
            val: data.tasksCard.docs.length + ' 份文档',
            sub: '含共识层、私有层与地图层受众契约 (docs.md)',
            cls: 'info'
          },
          {
            title: '声明流程阶段与门禁',
            val: data.runStats.steps.length + ' 步骤 / ' + data.runStats.gates.length + ' 门禁',
            sub: '按 process.md 声明的分工产出与门禁路由准则展示',
            cls: 'info'
          }
        ]
      : [
          {
            title: '个体履职对账 (Agents)',
            val: '实跑 ' + c.agentActive + ' / 声明 ' + c.agentTotal,
            sub: c.agentNever > 0 ? ('⚠ ' + c.agentNever + ' 名声明智能体未派活') : '✓ 声明智能体全员均已履职',
            cls: c.agentNever > 0 ? 'warn' : 'good'
          },
          {
            title: '连线触发对账 (Relations)',
            val: '走通 ' + c.relActive + ' / 声明 ' + c.relDeclared,
            sub: c.relUnused > 0 ? ('⚠ ' + c.relUnused + ' 条声明连线 0 次触发（死线）') : '✓ 声明连线全部走通',
            cls: c.relUnused > 0 ? 'warn' : 'good'
          },
          {
            title: '越界交接审计 (Fact-Only)',
            val: c.factOnlyCount + ' 处越界连线',
            sub: c.factOnlyCount > 0 ? ('🔥 发生 ' + c.factOnlyTotalRuns + ' 次未声明交接（可一键补写进编排）') : '✓ 零越界，全部在编排声明内流转',
            cls: c.factOnlyCount > 0 ? 'bad' : 'good'
          },
          {
            title: '黑板送达完整率 (Blackboard)',
            val: '完整 ' + c.docFullCount + ' / ' + c.docTargetCount + ' 人',
            sub: '四段闭环：1.该知道 → 2.已送到 → 3.已读 → 4.已写',
            cls: c.docFullCount < c.docTargetCount ? 'warn' : 'good'
          }
        ];

    var kpiBar = U.h('div', { class: 'pn-kpi-bar' }, tiles.map(function (t0) {
      return U.h('div', { class: 'pn-kpi-tile pn-kpi-' + t0.cls },
        U.h('div', { class: 'pn-kpi-title' }, t0.title),
        U.h('div', { class: 'pn-kpi-val' }, t0.val),
        U.h('div', { class: 'pn-kpi-sub' }, t0.sub));
    }));

    var wrap = U.h('div', { class: 'pn-banner-wrap' }, topRow, kpiBar);
    return wrap;
  }

  /* ================= mount / render ================= */

  function repaint() {
    if (last.el) render(last.el, last.model, last.state);
  }

  function render(el, model, state) {
    if (!el) return;
    last.el = el; last.model = model; last.state = state;
    var data = prepare(model, state);
    if (!data) { el.innerHTML = ''; return; }

    var scrollTop = el.scrollTop;
    var active = document.activeElement;
    var searchFocused = active && active.classList && active.classList.contains('pn-search');
    var caret = searchFocused ? [active.selectionStart, active.selectionEnd] : null;

    var frag = document.createDocumentFragment();
    frag.appendChild(buildHeader(data));
    frag.appendChild(U.h('div', { class: 'pn-grid' },
      cardRelationsLedger(data),
      cardRosterAndChannels(data),
      cardDeliveryAndTrust(data),
      cardCasesAndRunStats(data)));

    el.innerHTML = '';
    el.appendChild(U.h('div', { class: 'pn-root' }, frag));
    el.scrollTop = scrollTop;

    if (searchFocused) {
      var input = el.querySelector('.pn-search');
      if (input) {
        input.focus();
        if (caret) { try { input.setSelectionRange(caret[0], caret[1]); } catch (e) { /* ignore */ } }
      }
    }
  }

  HUB.panels = { render: render, _prepare: prepare };
})();
