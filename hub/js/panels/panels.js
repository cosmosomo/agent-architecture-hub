/* HUB.panels: the panel presentation. Same observation state as numbers, lists, and statuses — no drawing. */
(function () {
  'use strict';
  var HUB = (window.HUB = window.HUB || {});
  var U = HUB.util;
  var L = U.LABELS;

  /* Chinese labels for channelEvents.kind. Not covered by HUB.util.LABELS; spelled out by the spec for this card. */
  var EVENT_KIND_ZH = {
    outage: '故障', quota: '额度', recover: '恢复', pause: '暂停', resume: '恢复派活',
    maint_task: '生成维护任务', maint_done: '维护完成'
  };
  var SEV_ZH = { high: '高', mid: '中', low: '低' };
  var SEV_ORDER = ['high', 'mid', 'low'];

  /* ---------- module-local UI state (not part of HUB.store; survives repaint via closures) ---------- */
  var rosterSearch = '';
  var rosterSort = { key: 'name', dir: 1 };
  var last = { el: null, model: null, state: null };

  /* ================= pure data preparation (no DOM) ================= */

  function modelLabel(idx, mid) {
    if (!mid) return '-';
    var ch = idx.ch.get('ch_' + mid);
    if (ch && ch.name) return ch.name.replace(/^模型[:：]\s*/, '');
    return mid;
  }

  function prepare(model, state) {
    var m = model, st = state;
    if (!m || !st) return null;
    var idx = m.idx, def = m.def, F = m.facts;
    var an = HUB.model.an(st, m);
    var vis = function (at) { return HUB.model.visible(at, st); };

    var scopeGroup = null;
    if (st.selection && st.selection.type === 'group') scopeGroup = idx.group.get(st.selection.id) || null;
    var scopeIds = scopeGroup ? (idx.membersDeep.get(scopeGroup.id) || []) : null;
    var scopeSet = scopeIds ? new Set(scopeIds) : null;
    var inScope = function (id) { return !scopeSet || scopeSet.has(id); };

    var header = {
      caseName: m.name,
      timeText: st.time == null ? '全部时间' : ('截止 ' + U.fmtClock(st.time)),
      synthetic: !!m.synthetic,
      scope: scopeGroup ? { id: scopeGroup.id, name: scopeGroup.name } : null
    };

    /* 1. 系统总览 */
    var t = an.totals;
    var overview = [
      { key: 'individuals', label: '个体数', value: U.fmtNum(t.individuals) },
      { key: 'relations', label: '任务线数', value: U.fmtNum(t.relations) },
      { key: 'cases', label: '案例数', value: U.fmtNum(t.cases) },
      { key: 'runs', label: '运行数', value: U.fmtNum(t.runs) },
      { key: 'calls', label: '调用数', value: U.fmtNum(t.calls) },
      { key: 'tokens', label: 'Token', value: U.fmtNum(t.tokens) },
      { key: 'firstPassRate', label: '首次通过率', value: U.pct(t.firstPassRate) },
      { key: 'reworkRate', label: '返工率', value: U.pct(t.reworkRate) },
      { key: 'failedRuns', label: '失败运行数', value: U.fmtNum(t.failedRuns) }
    ];

    /* 2. 需要人处理的事 */
    var needsHuman = an.needsHuman.slice().sort(function (a, b) { return a.at - b.at; }).map(function (item) {
      return { id: item.id, kind: item.kind, text: item.text, atText: U.fmtClock(item.at), target: item.target, approvable: item.kind === 'approval' };
    });

    /* 3. 个体名册 */
    var roster = def.individuals.filter(function (x) { return inScope(x.id); }).map(function (x) {
      var s = an.indStats[x.id] || { runs: 0, tokens: 0, status: 'never' };
      var dv = an.delivery[x.id];
      return {
        id: x.id, name: x.name,
        groupName: x.groupId ? ((idx.group.get(x.groupId) || {}).name || '-') : '-',
        modelLabel: modelLabel(idx, x.model),
        status: s.status, statusLabel: L.indStatus[s.status] || s.status,
        runs: s.runs, tokens: s.tokens,
        missing: dv ? dv.missing.length : null
      };
    });

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
      return {
        id: d.id, layerLabel: L.docLayer[d.layer] || d.layer, name: d.name,
        ownerName: (idx.ind.get(d.owner) || {}).name || d.owner,
        expected: expected, received: received
      };
    });

    /* 5. 送达情况 */
    var delivery = def.individuals.filter(function (x) { return x.kind !== 'human' && inScope(x.id); }).map(function (x) {
      var dv = an.delivery[x.id] || { expected: [], received: [], missing: [], missedEver: [], pending: 0 };
      var docName = function (id) { return (idx.doc.get(id) || {}).name || id; };
      return {
        id: x.id, name: x.name,
        expectedCount: dv.expected.length, receivedCount: dv.received.length,
        missing: dv.missing.map(function (id) { return { id: id, name: docName(id) }; }),
        missedEver: dv.missedEver.map(function (id) { return { id: id, name: docName(id) }; }),
        pending: dv.pending
      };
    });

    /* 6. 能力渠道 */
    var channels = def.channels.map(function (ch) {
      var cs = an.channelStats[ch.id] || { calls: 0, errors: 0, status: 'ok' };
      return {
        id: ch.id, name: ch.name, kindLabel: ch.kind === 'model' ? '模型' : '工具',
        userCount: ch.users.length, calls: cs.calls, errors: cs.errors,
        status: cs.status, statusLabel: L.channelStatus[cs.status] || cs.status,
        capacity: ch.capacity, quota: ch.quota,
        maintainerName: (idx.ind.get(ch.maintainer) || {}).name || ch.maintainer,
        action: cs.status === 'paused' ? 'resume_channel' : 'pause_channel',
        actionLabel: cs.status === 'paused' ? '恢复' : '暂停'
      };
    });

    /* 7. 架构体检 */
    var health = { high: [], mid: [], low: [] };
    an.health.forEach(function (h) { (health[h.severity] || (health[h.severity] = [])).push(h); });

    /* 8. 运行统计 */
    var runsCut = F.runs.filter(function (r) { return vis(r.start); });
    var sumTokens = function (rs) { return U.sum(rs, function (r) { return r.tokens || 0; }); };
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
        stepRows.push({ id: step.id, stageName: stage.name, name: step.name, tasks: s.tasks, avgDurText: U.fmtDur(s.avgDur), rework: s.rework });
      });
    });
    var gateRows = def.process.gates.filter(function (g) {
      if (!scopeSet) return true;
      if (g.decider.who && scopeSet.has(g.decider.who)) return true;
      var stage = idx.stage.get(g.afterStage);
      return !!(stage && stage.steps.some(function (st2) { return st2.executors.some(function (e) { return scopeSet.has(e); }); }));
    }).map(function (g) {
      var s = an.gateStats[g.id] || { pass: 0, fail: 0, escalate: 0, queueNow: 0 };
      return { id: g.id, name: g.name, pass: s.pass, fail: s.fail, queueNow: s.queueNow, escalate: s.escalate };
    });

    /* 9. 维护情况 */
    var maintenance = F.channelEvents.filter(function (e) { return vis(e.at); }).slice()
      .sort(function (a, b) { return a.at - b.at; }).map(function (e) {
        var ch = idx.ch.get(e.channelId);
        return { id: e.id, atText: U.fmtClock(e.at), channelName: ch ? ch.name : e.channelId, kind: e.kind, kindLabel: EVENT_KIND_ZH[e.kind] || e.kind, note: e.note || '' };
      });

    return {
      header: header, overview: overview, needsHuman: needsHuman, roster: roster,
      tasksCard: { cases: taskCases, docs: taskDocs }, delivery: delivery, channels: channels,
      health: health, runStats: { byGroup: byGroup, steps: stepRows, gates: gateRows }, maintenance: maintenance
    };
  }

  /* ================= DOM building ================= */

  function card(slug, title, desc, body) {
    return U.h('section', { class: 'pn-card', 'data-key': 'panel:' + slug },
      U.h('div', { class: 'pn-card-head' },
        U.h('h3', { class: 'pn-card-title' }, title),
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

  function cardOverview(data) {
    var items = data.overview.map(function (it) {
      return U.h('div', { class: 'pn-stat', 'data-key': 'stat:' + it.key },
        U.h('div', { class: 'pn-stat-val' }, it.value),
        U.h('div', { class: 'pn-stat-label' }, it.label));
    });
    return card('overview', '系统总览', '当前时间范围内的整体规模与质量。', U.h('div', { class: 'pn-stats' }, items));
  }

  function cardNeedsHuman(data) {
    var list = data.needsHuman;
    var body;
    if (!list.length) {
      body = U.h('p', { class: 'pn-empty' }, '现在没有需要你处理的事');
    } else {
      body = U.h('div', { class: 'pn-list' }, list.map(function (item) {
        var btns = [];
        if (item.approvable) {
          btns.push(U.h('button', { class: 'pn-btn', type: 'button', onClick: function () {
            HUB.model.perform('approve', { target: item.target });
          } }, '放行'));
        }
        btns.push(U.h('button', { class: 'pn-btn pn-btn-ghost', type: 'button', onClick: function () {
          HUB.store.set({ selection: item.target, drawer: true }, { history: false });
        } }, '查看'));
        return U.h('div', { class: 'pn-row pn-nh-row', 'data-key': 'nh:' + item.id },
          U.h('div', { class: 'pn-nh-text' }, U.h('span', { class: 'pn-nh-time' }, item.atText), ' ', item.text),
          U.h('div', { class: 'pn-row-actions' }, btns));
      }));
    }
    return card('needs-human', '需要人处理的事', '等你拍板、上报给你、或操作还没送达的事项。', body);
  }

  function cardRoster(data) {
    var rows = data.roster.slice();
    var q = rosterSearch.trim();
    if (q) rows = rows.filter(function (r) { return r.name.indexOf(q) >= 0; });
    var key = rosterSort.key, dir = rosterSort.dir;
    rows.sort(function (a, b) {
      var av = a[key], bv = b[key];
      if (typeof av === 'string' || typeof bv === 'string') return dir * String(av || '').localeCompare(String(bv || ''), 'zh');
      av = av == null ? -Infinity : av; bv = bv == null ? -Infinity : bv;
      return dir * (av - bv);
    });

    var cols = [
      { key: 'name', label: '名称' }, { key: 'groupName', label: '分组' }, { key: 'modelLabel', label: '模型' },
      { key: 'status', label: '状态' }, { key: 'runs', label: '运行数' }, { key: 'tokens', label: 'token' }, { key: 'missing', label: '缺的信息数' }
    ];
    var headRow = U.h('tr', null, cols.map(function (c) {
      var marker = rosterSort.key === c.key ? (rosterSort.dir > 0 ? ' ▲' : ' ▼') : '';
      return U.h('th', { class: 'pn-th-sort', onClick: function () {
        if (rosterSort.key === c.key) rosterSort.dir = -rosterSort.dir; else { rosterSort.key = c.key; rosterSort.dir = 1; }
        repaint();
      } }, c.label + marker);
    }));

    var bodyRows = rows.length ? rows.map(function (r) {
      return U.h('tr', { class: 'pn-row', 'data-key': 'ind:' + r.id, onClick: function () {
        HUB.store.set({ selection: { type: 'individual', id: r.id }, drawer: true }, { history: false });
      } },
        U.h('td', null, r.name),
        U.h('td', null, r.groupName),
        U.h('td', null, r.modelLabel),
        U.h('td', null, U.h('span', { class: 'pn-dot', 'data-s': r.status }), r.statusLabel),
        U.h('td', { class: 'pn-num' }, U.fmtNum(r.runs)),
        U.h('td', { class: 'pn-num' }, U.fmtNum(r.tokens)),
        U.h('td', { class: 'pn-num' + (r.missing > 0 ? ' pn-bad' : '') }, r.missing == null ? '-' : U.fmtNum(r.missing)));
    }) : [U.h('tr', null, U.h('td', { colspan: 7, class: 'pn-empty-cell' }, '没有匹配的个体'))];

    var searchBox = U.h('input', {
      class: 'pn-search', type: 'text', placeholder: '按名称搜索', value: rosterSearch,
      onInput: function (e) { rosterSearch = e.target.value; repaint(); }
    });
    var table = U.h('div', { class: 'pn-table-wrap' }, U.h('table', { class: 'pn-table' }, U.h('thead', null, headRow), U.h('tbody', null, bodyRows)));
    return card('roster', '个体名册', '所有个体的状态、工作量与信息完整度。' + scopeSuffix(data), U.h('div', null, searchBox, table));
  }

  function cardTasks(data) {
    var t = data.tasksCard;
    var caseRows = t.cases.length ? t.cases.map(function (c) {
      return U.h('tr', { class: 'pn-row', 'data-key': 'case:' + c.id, onClick: function () {
        HUB.store.set({ focus: { type: 'case', id: c.id }, instanceId: c.id, subject: 'org', present: 'graph' });
      } },
        U.h('td', null, c.name), U.h('td', null, c.statusLabel),
        U.h('td', { class: 'pn-num' }, U.fmtNum(c.taskCount)), U.h('td', { class: 'pn-num' }, U.fmtNum(c.reworkCount)),
        U.h('td', null, c.startText), U.h('td', null, c.endText));
    }) : [U.h('tr', null, U.h('td', { colspan: 6, class: 'pn-empty-cell' }, '这个时间范围内还没有案例实例'))];
    var docRows = t.docs.map(function (d) {
      return U.h('tr', { 'data-key': 'doc:' + d.id },
        U.h('td', null, d.layerLabel), U.h('td', null, d.name), U.h('td', null, d.ownerName),
        U.h('td', { class: 'pn-num' }, U.fmtNum(d.expected)), U.h('td', { class: 'pn-num' }, U.fmtNum(d.received)));
    });
    return card('tasks', '任务与信息', '每个案例实例的完成情况，以及文档在团队里的送达广度。', U.h('div', null,
      tableOf(['名称', '状态', '任务数', '返工任务数', '开始时间', '结束时间'], caseRows),
      U.h('h4', { class: 'pn-sub-title' }, '文档'),
      tableOf(['层', '名称', '负责人', '应收到人数', '实际收到人数'], docRows)));
  }

  function cardDelivery(data) {
    var rows = data.delivery.length ? data.delivery.map(function (x) {
      var missingEls = x.missing.length ? x.missing.map(function (d) {
        return U.h('span', { class: 'pn-tag pn-bad', 'data-key': 'missdoc:' + x.id + ':' + d.id },
          d.name,
          U.h('button', { class: 'pn-btn-mini', type: 'button', onClick: function () {
            HUB.model.perform('redeliver', { target: { type: 'individual', id: x.id }, docId: d.id });
          } }, '补送'));
      }) : [U.h('span', { class: 'pn-muted' }, '无')];
      var everEls = x.missedEver.length ? x.missedEver.map(function (d) {
        return U.h('span', { class: 'pn-tag pn-muted' }, d.name);
      }) : [U.h('span', { class: 'pn-muted' }, '无')];
      return U.h('tr', { 'data-key': 'dv:' + x.id },
        U.h('td', null, x.name),
        U.h('td', { class: 'pn-num' }, U.fmtNum(x.expectedCount) + ' / ' + U.fmtNum(x.receivedCount)),
        U.h('td', null, U.h('div', { class: 'pn-tags' }, missingEls)),
        U.h('td', null, U.h('div', { class: 'pn-tags' }, everEls)),
        U.h('td', { class: 'pn-num' }, U.fmtNum(x.pending)));
    }) : [U.h('tr', null, U.h('td', { colspan: 5, class: 'pn-empty-cell' }, '没有个体'))];
    return card('delivery', '送达情况', '每个个体该知道的信息是否真的送到了。' + scopeSuffix(data),
      tableOf(['个体', '该知道/收到', '缺哪些', '历史上缺过', '待送达指令'], rows));
  }

  function cardChannels(data) {
    var rows = data.channels.map(function (ch) {
      return U.h('tr', { 'data-key': 'ch:' + ch.id },
        U.h('td', null, ch.name), U.h('td', null, ch.kindLabel),
        U.h('td', { class: 'pn-num' }, U.fmtNum(ch.userCount)), U.h('td', { class: 'pn-num' }, U.fmtNum(ch.calls)),
        U.h('td', { class: 'pn-num' }, U.fmtNum(ch.errors)),
        U.h('td', null, U.h('span', { class: 'pn-ch-status', 'data-s': ch.status }, ch.statusLabel)),
        U.h('td', null, ch.capacity), U.h('td', null, ch.quota), U.h('td', null, ch.maintainerName),
        U.h('td', null, U.h('button', { class: 'pn-btn', type: 'button', onClick: function () {
          HUB.model.perform(ch.action, { target: { type: 'channel', id: ch.id } });
        } }, ch.actionLabel)));
    });
    return card('channels', '能力渠道', '模型与工具渠道的使用、健康状况与维护者。',
      tableOf(['名称', '类型', '使用者', '调用数', '出错数', '状态', '容量', '额度', '维护者', '操作'], rows));
  }

  function handleHealthClick(h) {
    if (h.kind === 'fact_only') { HUB.views.go('v1'); HUB.store.set({ lines: { task: true } }); return; }
    if (h.kind === 'unused_relation') { HUB.views.go('v1'); HUB.store.set({ compare: 'both' }); return; }
    var tg = h.target;
    if (tg && (tg.type === 'individual' || tg.type === 'gate' || tg.type === 'channel')) {
      HUB.store.set({ selection: tg, drawer: true }, { history: false });
    }
  }

  function cardHealth(data) {
    var secs = SEV_ORDER.map(function (sev) {
      var items = data.health[sev] || [];
      if (!items.length) return null;
      return U.h('div', { class: 'pn-health-group' },
        U.h('div', { class: 'pn-health-sev' }, SEV_ZH[sev] + '（' + items.length + '）'),
        U.h('div', { class: 'pn-list' }, items.map(function (h) {
          var tag = h.kind === 'fact_only' ? U.h('span', { class: 'pn-tag-factonly' }, '未声明') : null;
          return U.h('div', { class: 'pn-row pn-health-row', 'data-key': 'health:' + h.id, onClick: function () { handleHealthClick(h); } }, tag, h.text);
        })));
    }).filter(Boolean);
    return card('health', '架构体检', '设计和实际运行之间的差异，以及潜在的问题。', secs.length ? secs : U.h('p', { class: 'pn-empty' }, '没有发现问题'));
  }

  function cardRunStats(data) {
    var rs = data.runStats;
    var groupRows = rs.byGroup.map(function (g) {
      return U.h('tr', null, U.h('td', null, g.name), U.h('td', { class: 'pn-num' }, U.fmtNum(g.runs)),
        U.h('td', { class: 'pn-num' }, U.fmtNum(g.tokens)), U.h('td', { class: 'pn-num' }, U.fmtNum(g.failedRuns)));
    });
    var stepRows = rs.steps.length ? rs.steps.map(function (s) {
      return U.h('tr', null, U.h('td', null, s.stageName), U.h('td', null, s.name),
        U.h('td', { class: 'pn-num' }, U.fmtNum(s.tasks)), U.h('td', { class: 'pn-num' }, s.avgDurText), U.h('td', { class: 'pn-num' }, U.fmtNum(s.rework)));
    }) : [U.h('tr', null, U.h('td', { colspan: 5, class: 'pn-empty-cell' }, '没有步骤'))];
    var gateRows = rs.gates.length ? rs.gates.map(function (g) {
      return U.h('tr', null, U.h('td', null, g.name), U.h('td', { class: 'pn-num' }, U.fmtNum(g.pass)),
        U.h('td', { class: 'pn-num' }, U.fmtNum(g.fail)), U.h('td', { class: 'pn-num' }, U.fmtNum(g.queueNow)), U.h('td', { class: 'pn-num' }, U.fmtNum(g.escalate)));
    }) : [U.h('tr', null, U.h('td', { colspan: 5, class: 'pn-empty-cell' }, '没有判断点'))];
    return card('run-stats', '运行统计', '按分组、流程步骤、判断点汇总的运行与质量数据。' + scopeSuffix(data), U.h('div', null,
      tableOf(['分组', '运行数', 'token', '失败运行数'], groupRows),
      U.h('h4', { class: 'pn-sub-title' }, '按步骤'),
      tableOf(['阶段', '步骤', '任务数', '平均时长', '返工数'], stepRows),
      U.h('h4', { class: 'pn-sub-title' }, '按判断点'),
      tableOf(['判断点', '通过', '打回', '排队', '上报'], gateRows)));
  }

  function cardMaintenance(data) {
    var rows = data.maintenance;
    var body = rows.length ? tableOf(['时间', '渠道', '事件', '说明'], rows.map(function (e) {
      return U.h('tr', { 'data-key': 'ce:' + e.id }, U.h('td', null, e.atText), U.h('td', null, e.channelName), U.h('td', null, e.kindLabel), U.h('td', null, e.note));
    })) : U.h('p', { class: 'pn-empty' }, '目前没有渠道维护记录');
    return card('maintenance', '维护情况', '渠道故障、额度、维护任务与恢复记录，按时间顺序。', body);
  }

  function buildHeader(data) {
    var h = data.header;
    var left = [U.h('span', { class: 'pn-tag-plain' }, h.caseName), U.h('span', { class: 'pn-tag-plain' }, h.timeText)];
    if (h.synthetic) left.push(U.h('span', { class: 'pn-badge-sim' }, '模拟数据'));
    var row = U.h('div', { class: 'pn-header' }, U.h('div', { class: 'pn-header-left' }, left));
    if (h.scope) {
      row.appendChild(U.h('span', { class: 'pn-scope-chip' }, '只看：' + h.scope.name + ' ',
        U.h('button', { class: 'pn-scope-x', type: 'button', onClick: function () {
          HUB.store.set({ selection: null }, { history: false });
        } }, '×')));
    }
    return row;
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
      cardOverview(data), cardNeedsHuman(data), cardRoster(data), cardTasks(data),
      cardDelivery(data), cardChannels(data), cardHealth(data), cardRunStats(data), cardMaintenance(data)));

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
