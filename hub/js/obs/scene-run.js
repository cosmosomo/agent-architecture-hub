/* ⑤⑥ scene: one run as a chain. Who handed the work over, the individual and its run, its decisions top to bottom,
   and who received the result. Depth 2 (or a single expanded decision) opens a decision into the calls behind it. */
(function () {
  'use strict';
  var HUB = (window.HUB = window.HUB || {});
  var U = HUB.util, L = U.LABELS;
  var esc = function (s) { return U.esc(s); };

  var NW = 112, NH = 116;
  var RW = 360, RH = 116;          // run head
  var DW = 420, DH = 96;           // decision card
  var CW = DW - 28, CH = 36, CG = 6, FT = 46, FP = 12;
  var GAPY = 30, INDENT = 64;

  function build(m, s, a, view) {
    var run = HUB.model.focusRun(s, m);
    if (!run) return { subject: 'exec', cards: [{ key: 'x:empty', kind: 'note', x: 0, y: 0, w: 360, h: 80, data: { text: '这个时间点之前还没有运行。拖动底部时间轴，或换一个个体。' } }], frames: [], links: [], bbox: { x: 0, y: 0, w: 360, h: 80 } };
    var idx = m.idx;
    var x = idx.ind.get(run.individualId);
    var task = idx.task.get(run.taskId);
    var decs = (idx.decsByRun.get(run.id) || []).filter(function (d) { return HUB.model.visible(d.start, s); }).sort(function (p, q) { return p.idx - q.idx; });
    var cards = [], frames = [], links = [];
    var indKey = 'i:' + run.individualId;
    var st = a.indStats[run.individualId] || {};
    var maxRuns = 1;
    m.def.individuals.forEach(function (y) { maxRuns = Math.max(maxRuns, (a.indStats[y.id] || {}).runs || 0); });
    var indCard = function (id, extra) {
      var y = idx.ind.get(id), sy = a.indStats[id] || {};
      return Object.assign({ key: 'i:' + id, kind: y.kind === 'agent' ? 'ind' : y.kind, w: NW, h: NH, sel: { type: 'individual', id: id }, anchor: [],
        data: { id: id, name: y.name, agentId: y.agentId, phase: y.phase, model: y.model, isHub: !!y.isHub, kind: y.kind, status: sy.status, runs: sy.runs || 0, maxRuns: maxRuns, delivery: null } }, extra || {});
    };

    /* who handed this task over, and to whom the result went */
    var hand = m.facts.handoffs.filter(function (h) { return HUB.model.visible(h.at, s); });
    var ins = hand.filter(function (h) { return h.toTask === run.taskId && h.to === run.individualId; });
    var outs = hand.filter(function (h) { return h.fromTask === run.taskId && h.from === run.individualId; });
    var upIds = U.uniq(ins.map(function (h) { return h.from; })).filter(function (id) { return id !== run.individualId && idx.ind.has(id); }).slice(0, 4);
    var downIds = U.uniq(outs.map(function (h) { return h.to; })).filter(function (id) { return id !== run.individualId && idx.ind.has(id); }).slice(0, 5);

    var y = 0;
    if (upIds.length) {
      upIds.forEach(function (id, i) { cards.push(indCard(id, { x: i * (NW + 24), y: 0 })); });
      y = NH + 70;
    }
    cards.push(indCard(run.individualId, { x: 0, y: y }));
    var dvs = (idx.deliveriesByRun.get(run.id) || []).filter(function (d) { return HUB.model.visible(d.at, s); });
    cards.push({ key: 'ru:' + run.id, kind: 'runhead', x: NW + 24, y: y, w: RW, h: RH, sel: { type: 'run', id: run.id }, anchor: [indKey],
      data: { id: run.id, task: task ? task.name : '', caseId: run.caseId, caseName: run.caseId ? (idx.case.get(run.caseId) || {}).name : '', start: run.start, end: run.end, outcome: run.outcome,
        version: run.version, tokens: run.tokens || 0, coverage: run.coverage || {}, decisions: decs.length,
        docs: dvs.filter(function (d) { return d.kind === 'context'; }).map(function (d) { return { name: d.text || HUB.model.name('doc', d.docId), ok: d.status === 'delivered' }; }),
        orders: dvs.filter(function (d) { return d.kind !== 'context'; }).map(function (d) { return { text: d.text, kind: d.kind, ok: d.status === 'delivered' }; }) } });
    upIds.forEach(function (id) {
      var n = ins.filter(function (h) { return h.from === id; });
      links.push({ key: 'rl:in:' + id, from: 'i:' + id, to: indKey, type: n.some(function (h) { return !h.relationId; }) ? 'factonly' : 'task', state: n.some(function (h) { return !h.relationId; }) ? 'factonly' : 'both',
        label: n.some(function (h) { return h.missing && h.missing.length; }) ? '缺资料' : '交给它', weight: 0.5, particles: 1, sel: { type: 'individual', id: id } });
    });
    links.push({ key: 'rl:head', from: indKey, to: 'ru:' + run.id, type: 'task', state: 'both', weight: 0.3, particles: 0, sel: { type: 'run', id: run.id } });

    /* the decisions */
    var openDec = function (d) { return HUB.store.isOpen('exec', d.id, 1, s); };
    y += RH + 46;
    var prev = 'ru:' + run.id;
    var ACTION_TYPE = { deliver: 'task', request: 'info', yield: 'watch', escalate: 'fail', tool: 'channel' };
    decs.forEach(function (d, i) {
      var calls = (idx.callsByDec.get(d.id) || []).filter(function (c) { return HUB.model.visible(c.start, s); });
      var data = { id: d.id, n: i + 1, title: d.title, trigger: d.trigger, choice: d.choice, reason: d.reason, impact: d.impact, action: d.action, outcome: d.outcome,
        unsupported: (d.unsupported || []).length > 0, calls: calls.length, dur: d.end - d.start, alternatives: (d.alternatives || []).length };
      var key;
      if (!openDec(d)) {
        key = 'd:' + d.id;
        cards.push({ key: key, kind: 'dec', x: INDENT, y: y, w: DW, h: DH, sel: { type: 'decision', id: d.id }, toggle: d.id, anchor: ['db:' + d.id, indKey], data: data });
        y += DH + GAPY;
      } else {
        key = 'db:' + d.id;
        var fh = FT + calls.length * CH + Math.max(0, calls.length - 1) * CG + FP;
        frames.push({ key: key, kind: 'decframe', x: INDENT, y: y, w: DW, h: Math.max(fh, 64), sel: { type: 'decision', id: d.id }, toggle: d.id, anchor: ['d:' + d.id, indKey], data: data });
        var cy = y + FT, span = Math.max(1, d.end - d.start);
        calls.forEach(function (c) {
          cards.push({ key: 'c:' + c.id, kind: 'call', x: INDENT + 14, y: cy, w: CW, h: CH, sel: { type: 'call', id: c.id }, anchor: ['d:' + d.id, 'db:' + d.id],
            data: { id: c.id, kind: c.kind, name: c.name, status: c.status, repeat: !!c.repeat, dur: c.end - c.start, tin: c.tokensIn, tout: c.tokensOut,
              ch: HUB.model.name('channel', c.channelId), a: (c.start - d.start) / span, b: (c.end - d.start) / span } });
          cy += CH + CG;
        });
        y += Math.max(fh, 64) + GAPY;
      }
      links.push({ key: 'rl:' + prev + '>' + key, from: prev, to: key, type: i === 0 ? 'task' : 'flow', state: 'both', weight: 0.25, particles: 0, sel: { type: 'decision', id: d.id } });
      prev = key;
    });

    /* where the result went */
    if (downIds.length) {
      y += 20;
      downIds.forEach(function (id, i) {
        cards.push(indCard(id, { x: INDENT + i * (NW + 24), y: y }));
        var n = outs.filter(function (h) { return h.to === id; });
        var last = decs.length ? decs[decs.length - 1] : null;
        links.push({ key: 'rl:out:' + id, from: prev, to: 'i:' + id, type: n.some(function (h) { return !h.relationId; }) ? 'factonly' : (last ? ACTION_TYPE[last.action] || 'task' : 'task'),
          state: n.some(function (h) { return !h.relationId; }) ? 'factonly' : 'both', label: n.some(function (h) { return h.missing && h.missing.length; }) ? '缺资料' : (L.action[last && last.action] || '交付'),
          weight: 0.5, particles: 1, sel: { type: 'individual', id: id } });
      });
    }

    var bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity;
    cards.concat(frames).forEach(function (o) { bx0 = Math.min(bx0, o.x); by0 = Math.min(by0, o.y); bx1 = Math.max(bx1, o.x + o.w); by1 = Math.max(by1, o.y + o.h); });
    return { subject: 'exec', cards: cards, frames: frames, links: links, bbox: { x: bx0, y: by0, w: bx1 - bx0, h: by1 - by0 }, run: run };
  }

  /* ---------- cards ---------- */
  var ACTION_CLS = { deliver: 'good', request: 'info', yield: 'warn', escalate: 'bad', tool: 'info' };
  var OUT_CLS = { deliver: 'good', request: 'info', yield: 'warn', escalate: 'warn', failed: 'bad', interrupted: 'bad', running: 'info' };
  function pill(t, c) { return '<span class="ob-pill ' + (c || '') + '">' + esc(t) + '</span>'; }

  HUB.obsCards.extra.runhead = function (c) {
    var d = c.data;
    var docs = d.docs.map(function (x) { return '<span class="ob-doc ' + (x.ok ? 'ok' : 'miss') + '" title="' + (x.ok ? '已送到' : '没送到') + '">' + esc(x.name) + '</span>'; }).join('');
    var orders = d.orders.map(function (x) { return '<span class="ob-doc ins" title="' + esc(L.deliveryKind[x.kind] || x.kind) + (x.ok ? '，已送达' : '，待送达') + '">' + esc(x.text) + '</span>'; }).join('');
    var cov = d.coverage;
    var html = '<div class="ob-rh-top"><span class="ob-rh-task">' + esc(d.task || '一次运行') + '</span>' + pill(L.outcome[d.outcome] || d.outcome, OUT_CLS[d.outcome]) + '</div>' +
      '<div class="ob-rh-meta">' + (d.caseId ? esc(d.caseId + ' ' + (d.caseName || '')) + ' · ' : '') + esc(U.fmtClock(d.start)) + ' · ' + esc(U.fmtDur(d.end - d.start)) + ' · ' + d.decisions + ' 个决策 · 版本 ' + esc(d.version || '-') + '</div>' +
      '<div class="ob-rh-docs"><span class="ob-rh-lbl">收到的资料</span>' + (docs || '<span class="ob-rh-none">无</span>') + orders + '</div>' +
      '<div class="ob-rh-meta">会话覆盖：读全 ' + (cov.indexed || 0) + ' · 只看元信息 ' + (cov.metaOnly || 0) + ' · 截断 ' + (cov.truncated || 0) + '</div>';
    return { cls: 'ob-card ob-runhead', html: html, sized: true, sig: JSON.stringify(d) };
  };
  HUB.obsCards.extra.dec = function (c) {
    var d = c.data;
    var flags = (d.outcome === 'overturned' ? '<span class="ob-flag ob-flag-err">后来被推翻</span>' : '') + (d.unsupported ? '<span class="ob-flag ob-flag-was">理由没有依据</span>' : '') + (d.outcome === 'pending' ? '<span class="ob-flag ob-flag-ins">进行中</span>' : '');
    var html = '<div class="ob-dec-n">' + d.n + '</div><div class="ob-dec-main"><div class="ob-dec-top"><span class="ob-dec-title">' + esc(d.title) + '</span>' + pill(L.action[d.action] || d.action, ACTION_CLS[d.action]) + '</div>' +
      '<div class="ob-dec-line">' + (d.trigger ? '<span class="ob-dec-k">因为</span>' + esc(d.trigger) + ' ' : '') + (d.choice ? '<span class="ob-dec-k">选了</span>' + esc(d.choice) : '') + '</div>' +
      '<div class="ob-dec-why">' + (d.reason ? esc(d.reason) : '') + '</div>' +
      '<div class="ob-dec-foot">' + (d.alternatives ? d.alternatives + ' 个备选 · ' : '') + d.calls + ' 次调用 · ' + esc(U.fmtDur(d.dur)) + (flags ? ' ' + flags : '') + '</div></div>' +
      (d.calls ? '<button class="ob-tog" type="button" data-toggle="' + esc(d.id) + '" title="展开看调用">+</button>' : '');
    return { cls: 'ob-card ob-dec ob-act-' + d.action + (d.outcome === 'overturned' ? ' ob-dec-over' : ''), html: html, sized: true, sig: JSON.stringify(d) };
  };
  HUB.obsCards.extraFrame.decframe = function (f) {
    var d = f.data;
    var html = '<div class="ob-fh ob-dec-fh" title="双击标题收起"><span class="ob-dec-n">' + d.n + '</span><span class="ob-fname">' + esc(d.title) + '</span>' +
      '<span class="ob-fmeta">' + esc(L.action[d.action] || d.action) + ' · ' + d.calls + ' 次调用 · ' + esc(U.fmtDur(d.dur)) + '</span>' +
      '<button class="ob-tog" type="button" data-toggle="' + esc(d.id) + '" title="收起调用">−</button></div>';
    return { cls: 'ob-fr-lv1 ob-fr-dec ob-act-' + d.action, html: html, style: { '--pc': '129, 140, 248' }, sig: JSON.stringify(d) };
  };
  HUB.obsCards.extra.call = function (c) {
    var d = c.data;
    var bad = d.status !== 'ok';
    var ic = d.kind === 'model' ? HUB.obsCards.ICON.model : HUB.obsCards.ICON.tool;
    var info = d.kind === 'model' ? U.fmtNum(d.tin) + ' 进 · ' + U.fmtNum(d.tout) + ' 出' : esc(String(d.ch).replace(/^(模型|工具)：/, ''));
    var html = '<span class="ob-call-ic">' + ic + '</span><span class="ob-call-name">' + esc(d.name || d.kind) + '</span>' +
      (d.repeat ? '<span class="ob-flag ob-flag-was">重复</span>' : '') + (bad ? '<span class="ob-flag ob-flag-err">' + esc(d.status === 'retry' ? '重试' : '出错') + '</span>' : '') +
      '<span class="ob-call-meta">' + info + ' · ' + esc(U.fmtDur(d.dur)) + '</span>' +
      '<span class="ob-call-bar"><i style="left:' + (100 * d.a).toFixed(1) + '%;width:' + Math.max(2, 100 * (d.b - d.a)).toFixed(1) + '%"></i></span>';
    return { cls: 'ob-card ob-call ob-call-' + d.kind + (bad ? ' ob-call-bad' : ''), html: html, sized: true, sig: JSON.stringify(d) };
  };
  HUB.obsCards.extra.note = function (c) {
    return { cls: 'ob-card ob-note-card', html: esc(c.data.text), sized: true, sig: c.data.text };
  };

  HUB.obsSceneRun = { build: build };
})();
