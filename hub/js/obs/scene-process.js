/* ④ scene: the business process. Stages and gates left to right, fail loops underneath, escalations up to the person.
   Pure layout plus the card builders for stages, steps, gates and terminals. */
(function () {
  'use strict';
  var HUB = (window.HUB = window.HUB || {});
  var U = HUB.util, L = U.LABELS;
  var esc = function (s) { return U.esc(s); };

  var SW = 228, SH = 132;          // folded stage card
  var STW = 204, STH = 78;         // step card inside an open stage
  var GW = 124, GH = 104;          // gate card (a diamond inside)
  var TW = 76, TH = 44;            // start / done
  var HW = 112, HH = 116;          // the person, same card as in the org view
  var GAP = 58, ROWGAP = 120, FP = 14, FT = 34, SG = 10;

  function build(m, s, a, view) {
    view = view || { w: 1300, h: 760 };
    var P = m.def.process, idx = m.idx;
    // real sessions carry facts but no written process; say so instead of drawing just start and end
    if (!P.stages.length) {
      return { subject: 'process', frames: [], links: [], bbox: { x: 0, y: 0, w: 440, h: 96 },
        cards: [{ key: 'x:noprocess', kind: 'note', x: 0, y: 0, w: 440, h: 96, data: { text: '这个来源没有写下业务流程：本机会话只有发生过的事实。流程要从编排文档里读出来，或者从多次运行里归纳出来。先用 ①②③ 看谁派了谁、各自做了什么。' } }] };
    }
    var cards = [], frames = [], links = [];
    var focusCase = s.focus && s.focus.type === 'case' ? m.idx.case.get(s.focus.id) : null;
    var visits = {};
    if (focusCase) focusCase.path.forEach(function (p) { if (HUB.model.visible(p.at, s)) visits[p.node] = (visits[p.node] || 0) + 1; });
    var open = function (st) { return HUB.store.isOpen('process', st.id, 1, s); };
    var phaseOfStage = function (st) {
      var c = {};
      st.steps.forEach(function (x) { x.executors.forEach(function (e) { var i = idx.ind.get(e); if (i && i.phase) c[i.phase] = (c[i.phase] || 0) + 1; }); });
      var best = null; Object.keys(c).forEach(function (k) { if (!best || c[k] > c[best]) best = k; });
      return st.phase || best;
    };

    /* the sequence of blocks: start, stages with their gates, done */
    var seq = [];
    seq.push({ key: 'p:start', kind: 'term', w: TW, h: TH, data: { label: '开始' }, node: 'start' });
    P.stages.forEach(function (st) {
      var ph = phaseOfStage(st);
      var sts = st.steps.map(function (x) { return a.stepStats[x.id] || {}; });
      var sum = function (k) { return U.sum(sts, function (x) { return x[k] || 0; }); };
      var execs = U.uniq([].concat.apply([], st.steps.map(function (x) { return x.executors; })));
      var base = { id: st.id, name: st.name, phase: ph, steps: st.steps.length, compare: s.compare,
        tasks: s.compare === 'def' ? null : sum('tasks'), rework: s.compare === 'def' ? 0 : sum('rework'),
        agents: execs.map(function (e) { var x = idx.ind.get(e); return { id: e, agentId: x ? x.agentId : null, kind: x ? x.kind : 'agent' }; }),
        visits: visits[st.id] || 0 };
      if (!open(st)) {
        seq.push({ key: 's:' + st.id, kind: 'stage', w: SW, h: SH, sel: { type: 'stage', id: st.id }, toggle: st.id, anchor: ['sb:' + st.id], data: base, node: st.id });
      } else {
        var inner = st.steps.map(function (x) {
          var ss = a.stepStats[x.id] || {};
          return { key: 'st:' + x.id, kind: 'step', w: STW, h: STH, sel: { type: 'step', id: x.id }, anchor: ['s:' + st.id, 'sb:' + st.id],
            data: { id: x.id, name: x.name, phase: ph, compare: s.compare, tasks: s.compare === 'def' ? null : ss.tasks || 0, rework: s.compare === 'def' ? 0 : ss.rework || 0,
              avg: s.compare === 'def' ? null : ss.avgDur, agents: x.executors.map(function (e) { var i = idx.ind.get(e); return { id: e, agentId: i ? i.agentId : null }; }) } };
        });
        var h = FT + inner.length * STH + Math.max(0, inner.length - 1) * SG + FP;
        seq.push({ key: 'sb:' + st.id, kind: 'stageframe', frame: true, w: STW + FP * 2, h: Math.max(SH, h), sel: { type: 'stage', id: st.id }, toggle: st.id, anchor: ['s:' + st.id],
          data: base, inner: inner, node: st.id });
      }
      P.gates.filter(function (g) { return g.afterStage === st.id; }).forEach(function (g) {
        var gs = a.gateStats[g.id] || {};
        var who = g.decider.type === 'human' ? '人' : g.decider.type === 'rule' ? '规则' : HUB.model.name('individual', g.decider.who);
        var wx = g.decider.type === 'agent' ? idx.ind.get(g.decider.who) : null;
        seq.push({ key: 'g:' + g.id, kind: 'gate', w: GW, h: GH, sel: { type: 'gate', id: g.id }, anchor: [], node: g.id,
          data: { id: g.id, name: g.name, who: who, whoType: g.decider.type, agentId: wx ? wx.agentId : null, compare: s.compare,
            pass: gs.pass || 0, fail: gs.fail || 0, escalate: gs.escalate || 0, queue: s.compare === 'def' ? 0 : gs.queueNow || 0, visits: visits[g.id] || 0 } });
      });
    });
    seq.push({ key: 'p:done', kind: 'term', w: TW, h: TH, data: { label: '完成', done: true }, node: 'done' });

    /* rows: like the org view, wrap the pipeline so it keeps a readable scale */
    var showHuman = s.overlays.human !== false;
    var leftW = showHuman ? HW + GAP : 0;
    var arrange = function (nRows) {
      var per = Math.ceil(seq.length / nRows), rows = [];
      for (var i = 0; i < seq.length; i += per) rows.push(seq.slice(i, i + per));
      var W = 0, H = 0;
      rows.forEach(function (r) { W = Math.max(W, U.sum(r, function (b) { return b.w; }) + (r.length - 1) * GAP); H += Math.max.apply(null, r.map(function (b) { return b.h; })); });
      H += (rows.length - 1) * ROWGAP + (showHuman ? 0 : 0);
      W += leftW;
      return { rows: rows, W: W, H: H, k: Math.min(1, (view.w - 80) / W, (view.h - 200) / Math.max(1, H)) };
    };
    var cands = [];
    for (var nr = 1; nr <= Math.min(4, seq.length); nr++) { var c = arrange(nr); if (!cands.length || c.rows.length !== cands[cands.length - 1].rows.length) cands.push(c); }
    var kBest = Math.max.apply(null, cands.map(function (c) { return c.k; }));
    var best = cands.find(function (c) { return c.k >= kBest * 0.9; }) || cands[0];
    var y = 0, firstMid = 0;
    best.rows.forEach(function (r, ri) {
      var rh = Math.max.apply(null, r.map(function (b) { return b.h; }));
      var x = leftW;
      if (ri === 0) firstMid = rh / 2;
      r.forEach(function (b) {
        var bx = x, by = y + (rh - b.h) / 2;
        if (b.frame) {
          frames.push({ key: b.key, kind: 'stageframe', x: bx, y: by, w: b.w, h: b.h, sel: b.sel, toggle: b.toggle, anchor: b.anchor, data: b.data });
          var iy = by + FT;
          b.inner.forEach(function (it) { it.x = bx + FP; it.y = iy; iy += STH + SG; cards.push(it); });
        } else {
          cards.push({ key: b.key, kind: b.kind, x: bx, y: by, w: b.w, h: b.h, sel: b.sel, toggle: b.toggle, anchor: b.anchor, data: b.data });
        }
        b.px = bx; b.py = by;
        x += b.w + GAP;
      });
      y += rh + ROWGAP;
    });
    if (showHuman) {
      var hx = idx.ind.get('human');
      cards.push({ key: 'i:human', kind: 'human', x: 0, y: firstMid - HH / 2, w: HW, h: HH, sel: { type: 'individual', id: 'human' }, anchor: [],
        data: { id: 'human', name: hx ? hx.name : '人', kind: 'human', status: s.compare === 'def' ? null : (a.indStats.human || {}).status, runs: null } });
    }

    /* flows */
    var keyOf = function (node) {
      if (node === 'start') return 'p:start';
      if (node === 'done') return 'p:done';
      if (node === 'human') return showHuman ? 'i:human' : null;
      if (idx.gate.has(node)) return 'g:' + node;
      var st = idx.stage.get(node);
      if (st) return open(st) ? 'sb:' + node : 's:' + node;
      return null;
    };
    var maxFlow = 1;
    P.flows.forEach(function (f) { maxFlow = Math.max(maxFlow, (a.flowStats[f.id] || {}).count || 0); });
    var seenPair = {};
    if (showHuman) links.push({ key: 'pf:human>start', from: 'i:human', to: 'p:start', type: 'flow', state: s.compare === 'def' ? 'def' : 'both', label: '提需求', weight: 0.3, particles: 0, sel: { type: 'individual', id: 'human' } });
    P.flows.forEach(function (f) {
      var from = keyOf(f.from), to = keyOf(f.to);
      if (!from || !to || from === to) return;
      var cnt = (a.flowStats[f.id] || {}).count || 0;
      if (s.compare === 'fact' && !cnt) return;
      var type = f.kind === 'loop' ? 'fail' : f.kind === 'escalate' ? 'esc' : 'flow';
      var hl = focusCase ? visits[f.from] && visits[f.to] && pathHas(focusCase, f.from, f.to, s) : false;
      seenPair[f.from + '>' + f.to] = true;
      links.push({ key: 'pf:' + f.id, from: from, to: to, type: type, state: s.compare === 'def' ? 'def' : cnt ? 'both' : 'defonly', count: cnt,
        label: (f.label ? f.label : '') + (s.compare !== 'def' && cnt ? (f.label ? ' ' : '') + cnt : ''),
        weight: s.compare === 'def' ? 0.3 : Math.log(1 + cnt) / Math.log(1 + maxFlow), particles: s.compare === 'def' || !cnt ? 0 : focusCase ? (hl ? 2 : 0) : 1,
        route: f.kind === 'loop' ? 'loop-down' : f.kind === 'escalate' ? 'loop-up' : null, hl: !!hl, dim: !!focusCase && !hl,
        sel: { type: 'flow', id: f.id } });
    });
    if (s.compare !== 'def') {
      a.factOnlyFlows.forEach(function (f, i) {
        var from = keyOf(f.from), to = keyOf(f.to);
        if (!from || !to || from === to || seenPair[f.from + '>' + f.to]) return;
        links.push({ key: 'pfo:' + f.from + '>' + f.to, from: from, to: to, type: 'factonly', state: 'factonly', count: f.count, label: '未声明 ' + f.count,
          weight: 0.4, particles: 1, route: 'loop-up', sel: { type: 'flow', id: 'fo' + i } });
      });
    }
    if (focusCase) {
      cards.forEach(function (c) {
        var node = c.key === 'i:human' ? 'human' : c.key === 'p:start' ? 'start' : c.key === 'p:done' ? 'done' : c.key.replace(/^(s|g|st):/, '');
        if (c.kind === 'step') node = idx.stageOfStep.get(c.data.id);
        c.dim = !visits[node] && !(node === 'human' && focusCase.waitingAt);
      });
      frames.forEach(function (f) { f.dim = !visits[f.data.id]; });
    }

    var bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity;
    cards.concat(frames).forEach(function (o) { bx0 = Math.min(bx0, o.x); by0 = Math.min(by0, o.y); bx1 = Math.max(bx1, o.x + o.w); by1 = Math.max(by1, o.y + o.h); });
    // leave room for the loops underneath and the escalations above
    return { subject: 'process', cards: cards, frames: frames, links: links, bbox: { x: bx0, y: by0 - 50, w: bx1 - bx0, h: by1 - by0 + 110 }, rows: best.rows.length };
  }

  // did the case actually step from a to b (adjacent in its path)?
  function pathHas(c, a, b, s) {
    var p = c.path.filter(function (x) { return HUB.model.visible(x.at, s); });
    for (var i = 1; i < p.length; i++) if (p[i - 1].node === a && p[i].node === b) return true;
    return false;
  }

  /* ---------- cards ---------- */
  var PH = { strategy: 'strategy', research: 'research', debate: 'debate', debate1: 'debate', debate2: 'debate', build: 'build', qa: 'qa', hitl: 'hitl' };
  function pv(ph) { return PH[ph] ? 'var(--ph-' + PH[ph] + '-rgb)' : 'var(--accent-rgb)'; }
  function orbs(list, n) {
    var shown = list.slice(0, n);
    return shown.map(function (x) {
      var col = x.kind === 'human' ? '#FBBF24' : HUB.obsCards.agentColor(x.agentId);
      return '<span class="ob-mini ob-ms-none" style="--ic:' + col + '" title="' + esc(HUB.model.name('individual', x.id)) + '">' + (x.agentId ? HUB.obsCards.agentIcon(x.agentId, 15) : '') + '</span>';
    }).join('') + (list.length > n ? '<span class="ob-mini-more">+' + (list.length - n) + '</span>' : '');
  }
  HUB.obsCards.extra.stage = function (c) {
    var d = c.data;
    var st = d.tasks == null ? d.steps + ' 个步骤' : d.steps + ' 步 · ' + d.tasks + ' 个任务' + (d.rework ? ' · 返工 ' + d.rework : '');
    var html = '<div class="ob-stage-body"><div class="ob-stage-head"><span class="ob-stage-name">' + esc(d.name) + '</span>' + (d.visits > 1 ? '<span class="ob-flag ob-flag-was">第 ' + d.visits + ' 次</span>' : '') + '</div>' +
      '<div class="ob-dept-orbs">' + orbs(d.agents, 6) + '</div><div class="ob-dept-stats">' + esc(st) + '</div></div>' +
      '<button class="ob-tog" type="button" data-toggle="' + esc(d.id) + '" title="展开看步骤">+</button>';
    return { cls: 'ob-card ob-stage' + (d.rework ? ' ob-has-rework' : ''), html: html, style: { '--pc': pv(d.phase) }, sized: true, sig: JSON.stringify(d) };
  };
  HUB.obsCards.extra.step = function (c) {
    var d = c.data;
    var st = d.tasks == null ? d.agents.length + ' 人负责' : d.tasks + ' 个任务' + (d.avg != null ? ' · 平均 ' + U.fmtDur(d.avg) : '') + (d.rework ? ' · 返工 ' + d.rework : '');
    var html = '<div class="ob-step-name">' + esc(d.name) + '</div><div class="ob-dept-orbs">' + orbs(d.agents, 5) + '</div><div class="ob-dept-stats">' + esc(st) + '</div>';
    return { cls: 'ob-card ob-step', html: html, style: { '--pc': pv(d.phase) }, sized: true, sig: JSON.stringify(d) };
  };
  HUB.obsCards.extra.gate = function (c) {
    var d = c.data;
    var whoIc = d.whoType === 'human' ? HUB.obsCards.ICON.human.replace(/26/g, '15') : d.agentId ? HUB.obsCards.agentIcon(d.agentId, 15) : '<b style="font-family:var(--mn);font-size:9px">规</b>';
    var res = d.compare === 'def' ? '' : '<div class="ob-gate-res"><span class="ok">' + d.pass + '</span><span class="no">' + d.fail + '</span>' + (d.escalate ? '<span class="up">' + d.escalate + '</span>' : '') + '</div>';
    var html = '<div class="ob-gate-dia"></div><div class="ob-gate-in"><span class="ob-gate-who" title="由' + esc(d.who) + '判断">' + whoIc + '</span>' +
      '<div class="ob-gate-name">' + esc(d.name) + '</div>' + res + '</div>' + (d.queue ? '<span class="ob-flag ob-flag-wait ob-gate-q">' + d.queue + ' 在等</span>' : '');
    return { cls: 'ob-card ob-gate ob-gw-' + d.whoType + (d.queue ? ' ob-gate-waiting' : ''), html: html, sized: true, sig: JSON.stringify(d) };
  };
  HUB.obsCards.extra.term = function (c) {
    return { cls: 'ob-card ob-term' + (c.data.done ? ' ob-term-done' : ''), html: '<span>' + esc(c.data.label) + '</span>', sized: true, sig: c.data.label };
  };
  HUB.obsCards.extraFrame.stageframe = function (f) {
    var d = f.data;
    var st = d.tasks == null ? d.steps + ' 个步骤' : d.steps + ' 步 · ' + d.tasks + ' 个任务';
    var html = '<div class="ob-fh" title="' + esc(d.name + '：' + st + '。双击标题折叠') + '"><span class="ob-fname">' + esc(d.name) + '</span><span class="ob-fmeta">' + esc(st) + '</span>' +
      '<button class="ob-tog" type="button" data-toggle="' + esc(d.id) + '" title="折叠">−</button></div>';
    return { cls: 'ob-fr-lv1 ob-fr-stage', html: html, style: { '--pc': pv(d.phase) }, sig: JSON.stringify(d) };
  };

  HUB.obsSceneProcess = { build: build };
})();
