/* HUB.obsCollab: the collaboration-trajectory view (协作轨迹图) over the canvas. hub/SPEC.md 7 and 8.
   One case instance: who hands what to whom, in the recorded order. A star map on top (the same nodes as the org
   views: individuals, or closed groups), the full chart of the records underneath, which is also the time axis.
   The observation state stays the source of truth: the instance is focus/instanceId, the cursor is state.time,
   the comparison is state.compare, the granularity is depth.org, the evaluation layer is overlays.evals,
   a selected record is selection {type: 'turn'}.
   How it draws (设计总览 9.4; 任务书 2 的事实边界):
   - a handoff written in the record is a solid wedge and a solid light; one that follows from the source's protocol is
     a dotted line and a hollow light; a change of speaker with neither is the order in the full chart, never a line;
   - the only time is the order of the records: one beat a record; speed and spacing mean nothing else;
   - evaluations (failure labels, outcomes) are a layer that can be switched off; an error a tool returned is a fact;
   - simulated facts are not drawn here: such a case shows its definition only.
   The data comes from js/core/collab.js in a 1000 x 600 box; here it is stretched to the room the stage has. */
(function () {
  'use strict';
  var HUB = (window.HUB = window.HUB || {});
  var U = HUB.util, h = U.h, esc = U.esc, L = U.LABELS;
  var NS = 'http://www.w3.org/2000/svg';
  var REDUCE = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var BEAT = 950;   // ms a record at 1x: the pace of the replay, not a measured duration
  var KIND = { say: '发言', think: '思考', tool: '工具返回', context: '上下文', run: '一次运行' };
  var RESULT = { success: '成功', failure: '失败', unfinished: '未完成' };

  var els = {};
  var V = { on: false, st: null, cursor: 0, base: '', size: '', fw: 0, playing: false, speed: 1, story: false, timer: null, stepAnim: false,
    evalOn: true, legend: false, m: null, s: null, k: 1, vw: 1000, vh: 600, nodes: [], nk: {}, chan: null };
  var G = {}, NODE = {}, EDGE = {}, COLD = [];
  var FX = { parts: [], blooms: [], inflight: {}, raf: 0 };
  var SC = { labelW: 172, padR: 18, laneH: 24, top: 6, axisH: 26 };

  function sv(tag, attrs, parent) {
    var e = document.createElementNS(NS, tag);
    if (attrs) Object.keys(attrs).forEach(function (k) { if (attrs[k] != null) e.setAttribute(k, attrs[k]); });
    if (parent) parent.appendChild(e);
    return e;
  }
  function squash(s) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); }
  function clip(s, n) { s = squash(s); return s.length > n ? s.slice(0, n) + '…' : s; }
  function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
  function ease(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }
  function f1(v) { return String(Math.round(v * 10) / 10); }
  function pt(p) { return f1(p.x) + ',' + f1(p.y); }
  function upper(arr, v) { var lo = 0, hi = arr.length; while (lo < hi) { var mid = (lo + hi) >> 1; if (arr[mid] <= v) lo = mid + 1; else hi = mid; } return lo; }
  function nm(key) { var n = V.st.nodeByKey[key]; return n ? n.name : key; }
  function showFacts() { return V.st.real && V.st.cmpMode !== 'def'; }
  function showRails() { return !V.st.real || V.st.cmpMode !== 'fact'; }
  function compareOn() { return V.st.real && V.st.cmpMode === 'both'; }
  function canReplay() { return !!(V.st && V.st.real && V.st.N && V.st.cmpMode !== 'def'); }
  // the colour of a node: by identity when facts show; members not in the record are grey; a definition alone is one quiet colour
  function colOf(key) {
    var p = V.st.nodeByKey[key];
    if (!p) return 'def';
    if (!showFacts()) return p.glyph === 'human' ? 'human' : 'def';
    return p.ghost ? 'ghost' : p.color;
  }

  /* ================= mount ================= */
  function mount(canvas) {
    if (els.host) return;
    els.host = h('div', { class: 'ob-collab ob-only' });
    els.head = h('div', { class: 'obc-head obc-glass' });
    els.stage = h('div', { class: 'obc-stage' });
    els.svg = sv('svg', { class: 'obc-svg', role: 'img', 'aria-label': '协作轨迹图' }, els.stage);
    els.note = h('div', { class: 'obc-note' });
    els.bubble = h('div', { class: 'obc-bubble obc-glass' });
    els.caption = h('div', { class: 'obc-caption' });
    els.legend = h('div', { class: 'obc-legend obc-glass' });
    els.legend.style.display = 'none';
    els.stage.append(els.note, els.bubble, els.caption, els.legend);
    els.bar = h('div', { class: 'obc-bar' });
    els.score = sv('svg', { class: 'obc-score', role: 'img', 'aria-label': '按记录先后排开的全图' });
    els.scorewrap = h('div', { class: 'obc-scorewrap' }, els.score);
    els.foot = h('div', { class: 'obc-foot obc-glass' }, els.bar, els.scorewrap);
    els.host.append(els.head, els.stage, els.foot);
    // the page zooms the canvas on wheel; here the wheel belongs to the view
    els.host.addEventListener('wheel', function (e) { e.stopPropagation(); }, { passive: true });
    canvas.appendChild(els.host);
    els.tip = h('div', { class: 'obc-tip' });
    document.body.appendChild(els.tip);
    document.addEventListener('mousemove', function (e) { if (els.tip.classList.contains('show')) tipMove(e); });
    // a click on the empty stage clears the selection, as on the canvas of the other views
    els.svg.addEventListener('click', function (e) { if (e.target === els.svg && V.s && V.s.selection) HUB.store.set({ selection: null }, { history: false }); });

    var drag = false;
    els.score.addEventListener('pointerdown', function (e) {
      if (!canReplay()) return;
      drag = true; els.score.setPointerCapture(e.pointerId); pause();
      go(scoreAt(e), false);
    });
    els.score.addEventListener('pointermove', function (e) {
      if (!canReplay()) return;
      var n = scoreAt(e);
      if (drag) { if (n !== V.cursor) go(n, false); return; }
      var r = n ? V.st.recs[n - 1] : null;
      if (r) tipShow(e, '<span class="m">第 ' + n + ' 条 · ' + esc(KIND[r.kind] || r.kind) + '</span><br><b>' + esc(nm(r.node)) + '</b> ' + esc(clip(recText(r), 140)));
      else tipHide();
    });
    els.score.addEventListener('pointerup', function (e) {
      if (!drag) return;
      drag = false;
      var n = scoreAt(e), r = n ? V.st.recs[n - 1] : null;
      // a click on a record selects it: its text and its handoffs show in the right sidebar
      HUB.store.set({ time: HUB.collab.timeOf(V.st, n), selection: !r ? null : V.st.src.kind === 'turns' ? { type: 'turn', id: r.id } : r.runId ? { type: 'run', id: r.runId } : null });
    });
    els.score.addEventListener('pointerleave', function () { if (!drag) tipHide(); });
    els.score.addEventListener('dblclick', function (e) {
      if (!canReplay()) return;
      var n = scoreAt(e), r = n ? V.st.recs[n - 1] : null;
      if (r && r.runId) openRun(r.runId);
    });
  }

  /* ================= render (called on every change of the observation state) ================= */
  function render(s, m) {
    if (!els.host) return false;
    var on = s.subject === 'collab' && s.present !== 'panel';
    els.host.classList.toggle('on', on);
    document.body.classList.toggle('ob-collab-on', on);
    if (!on) { if (V.on) { V.on = false; pause(); clearFx(); tipHide(); V.base = ''; V.size = ''; } return false; }
    // one replay at a time: the time strip's replay stops when this view takes over the cut
    if (!V.on && HUB.obsTimeline && HUB.obsTimeline.playing && HUB.obsTimeline.playing()) HUB.obsTimeline.stop();
    var wasOn = V.on;
    V.on = true; V.m = m; V.s = s;
    placeHost();
    var out = HUB.collab.build(m, s), st = out.st, prev = V.cursor, instId = st.inst ? st.inst.id : '';
    V.st = st; V.cursor = out.cursor; V.evalOn = !(s.overlays && s.overlays.evals === false);
    // an instance opens as the whole picture, with nobody speaking; the last record speaks once the cursor has moved
    if (!wasOn || instId !== V.instId) V.quiet = true; else if (V.cursor !== prev) V.quiet = false;
    V.instId = instId;
    if (V.playing && !canReplay()) { V.playing = false; clearTimeout(V.timer); }
    // what stays while the cursor moves is rebuilt only when the instance, the comparison, the granularity or the room changes
    var base = st.sig + '|' + V.evalOn;
    var fresh = base !== V.base;
    if (fresh) { V.base = base; renderHead(); renderLegend(); renderBar(); }
    var fw = els.foot.clientWidth + 'x' + (els.host.clientHeight < 380 ? 'low' : 'ok');
    if (fresh || fw !== V.fw) { V.fw = fw; renderScore(); }
    var size = els.stage.clientWidth + 'x' + els.stage.clientHeight;
    var rebuilt = fresh || size !== V.size;
    if (rebuilt) { V.size = size; clearFx(); renderStage(); }
    var animate = !rebuilt && V.stepAnim && V.cursor > prev;
    V.stepAnim = false;
    if (!animate) clearFx();
    updateStage();
    updateBar();
    if (animate && showFacts() && !REDUCE) launchStep(prev);
    return true;
  }

  // under the floating controls of the canvas, which wrap to two lines when the canvas is narrow: measured, not guessed
  function placeHost() {
    var cv = els.host.parentNode, box = cv.getBoundingClientRect(), top = 58;
    Array.prototype.forEach.call(cv.querySelectorAll('.ob-crumbs, .ob-topctl'), function (e) { if (e.offsetParent) top = Math.max(top, Math.round(e.getBoundingClientRect().bottom - box.top) + 8); });
    if (top !== V.top) { V.top = top; els.host.style.top = top + 'px'; }
  }
  // the record the stage is speaking for: none in the opening overview, none when only the definition shows
  function speaking() { return V.cursor && showFacts() && !(V.quiet && V.s.time == null) ? V.st.recs[V.cursor - 1] : null; }

  /* ================= geometry ================= */
  function towards(p, x, y, r) { var dx = x - p.x, dy = y - p.y, d = Math.sqrt(dx * dx + dy * dy) || 1; return { x: p.x + dx / d * r, y: p.y + dy / d * r }; }
  function geom(a, b, lane) {
    var dx = b.x - a.x, dy = b.y - a.y, d = Math.sqrt(dx * dx + dy * dy) || 1, nx = -dy / d, ny = dx / d;
    // one above the other: bow wider, so the line clears the name under the upper one
    var bend = (Math.abs(dx) < Math.abs(dy) * 0.4 ? Math.max(66, d * 0.3) : Math.max(30, d * 0.14)) + (lane || 0) * 18;
    var c = { x: (a.x + b.x) / 2 + nx * bend, y: (a.y + b.y) / 2 + ny * bend };
    return { s: towards(a, c.x, c.y, a.r + 7), c: c, e: towards(b, c.x, c.y, b.r + 9), nx: nx, ny: ny };
  }
  function qpt(g, t) { var u = 1 - t; return { x: u * u * g.s.x + 2 * u * t * g.c.x + t * t * g.e.x, y: u * u * g.s.y + 2 * u * t * g.c.y + t * t * g.e.y }; }
  function qtan(g, t) { var x = 2 * (1 - t) * (g.c.x - g.s.x) + 2 * t * (g.e.x - g.c.x), y = 2 * (1 - t) * (g.c.y - g.s.y) + 2 * t * (g.e.y - g.c.y), d = Math.sqrt(x * x + y * y) || 1; return { x: x / d, y: y / d }; }
  function qpath(g, off) {
    var o = off || 0, n0 = qtan(g, 0), n1 = qtan(g, 1), n5 = qtan(g, 0.5);
    var s = { x: g.s.x - n0.y * o, y: g.s.y + n0.x * o }, c = { x: g.c.x - n5.y * o, y: g.c.y + n5.x * o }, e = { x: g.e.x - n1.y * o, y: g.e.y + n1.x * o };
    return 'M' + pt(s) + 'Q' + pt(c) + ' ' + pt(e);
  }
  // a wedge: wide at the sender, narrow at the receiver; reads faster than an arrow head
  function taper(g, w0, w1) {
    var K = 30, a = [], b = [];
    for (var i = 0; i <= K; i++) {
      var t = i / K, p = qpt(g, t), tg = qtan(g, t), w = (w0 + (w1 - w0) * t) / 2;
      a.push({ x: p.x - tg.y * w, y: p.y + tg.x * w }); b.push({ x: p.x + tg.y * w, y: p.y - tg.x * w });
    }
    return 'M' + a.map(pt).join('L') + 'L' + b.reverse().map(pt).join('L') + 'Z';
  }
  // a dotted line whose dots shrink toward the receiver
  function dotsAlong(g, w0, w1, gap) {
    var out = [], K = 90, acc = gap * 0.5, prev = qpt(g, 0);
    for (var i = 1; i <= K; i++) {
      var t = i / K, p = qpt(g, t);
      acc += Math.sqrt((p.x - prev.x) * (p.x - prev.x) + (p.y - prev.y) * (p.y - prev.y)); prev = p;
      if (acc >= gap) { acc = 0; out.push({ x: p.x, y: p.y, r: Math.max(1.5, (w0 + (w1 - w0) * t) / 2 * 1.1) }); }
    }
    return out;
  }

  /* the room the stage has: the nodes keep their size and their labels stay readable; the positions stretch.
     A column of nodes and a row of columns say how much room is needed; with less, everything shrinks together.
     A tall column on a low stage zigzags instead, so that a canvas of any shape keeps the text large enough to read. */
  var SP = 124, SPZ = 66, DX = 62;   // between neighbours of a column; the same when the column zigzags; how far it zigzags
  function measure() {
    var st = V.st, W = els.stage.clientWidth || 900, Hh = els.stage.clientHeight || 420, n = st.nodes.length;
    var table = st.shape === 'table', cols = {}, xs = [], ys = [], nLoose = 0;
    st.nodes.forEach(function (p) {
      xs.push(p.x); ys.push(p.y);
      if (p.loose) { nLoose++; return; }
      var c = Math.round(p.x); (cols[c] || (cols[c] = [])).push(p.key);
    });
    var keys = Object.keys(cols), nCols = Math.max(1, keys.length), maxCol = Math.max.apply(null, [1].concat(keys.map(function (c) { return cols[c].length; })));
    var rowsLoose = Math.ceil(nLoose / 8), roomLoose = rowsLoose ? 118 + (rowsLoose - 1) * 76 : 0;
    var padT = els.note.offsetHeight ? els.note.offsetHeight + 12 : 8;   // px kept free for the note on top
    var padB = canReplay() ? 40 : 10;                                   // and for one line of caption at the bottom
    var room = Math.max(120, Hh - padT - padB), zig = false, needH, needW;
    var dense = n > 12, sp = dense ? 98 : SP, pitch = dense ? 112 : 170;   // a crowd is drawn smaller by the data: it can stand closer
    if (table) { needH = 300 + n * 14; needW = 420 + n * 60; }
    else {
      needH = 132 + (maxCol - 1) * sp + roomLoose;
      if (maxCol >= 3 && room / needH < 0.8) { zig = true; needH = 132 + (maxCol - 1) * SPZ + roomLoose; }
      needW = Math.max(250 + (nCols - 1) * pitch + (zig ? nCols * DX * 2 : 0), nLoose ? 250 + (Math.min(8, nLoose) - 1) * 112 : 0);
    }
    // a definition alone with more columns than the stage can show legibly: the stage scrolls sideways
    // (with facts on it the bubble and the captions need the whole picture in view, so it shrinks instead)
    var wide = !showFacts() && W / needW < 0.72 ? Math.ceil(needW * 0.72) : 0;
    els.stage.classList.toggle('wide', !!wide);
    els.svg.style.width = wide ? wide + 'px' : '';
    if (wide) W = wide;
    var k = clamp(Math.min(room / needH, W / needW), 0.5, 1.2);
    V.k = k; V.vw = W / k; V.vh = Hh / k;
    V.small = Hh < 360;   // a low stage: the bubble and the captions keep short
    els.stage.classList.toggle('small', V.small);
    var x0 = Math.min.apply(null, xs.concat(1e9)), x1 = Math.max.apply(null, xs.concat(-1e9)), y0 = Math.min.apply(null, ys.concat(1e9)), y1 = Math.max.apply(null, ys.concat(-1e9));
    var left = 118 + (zig ? DX : 0), right = V.vw - 118 - (zig ? DX : 0), top = padT / k + 56, bot = V.vh - padB / k - 78;
    if (bot < top + 30) bot = top + 30;
    // a small team does not spread over the whole stage: neighbours stay within reach of each other
    var spanX = x1 > x0 ? Math.min(right - left, table ? 280 + n * 80 : Math.max((nCols - 1) * (zig ? 440 + 2 * DX : 440), nLoose ? (Math.min(8, nLoose) - 1) * 150 : 0)) : 0;
    var spanY = y1 > y0 ? Math.min(bot - top, table ? 170 + n * 46 : (maxCol - 1) * (zig ? SPZ + 30 : 200) + roomLoose) : 0;
    var cx = (left + right) / 2, cy = (top + bot) / 2;
    V.nk = {};
    V.nodes = st.nodes.map(function (p0) {
      var p = Object.create(p0);
      p.x = spanX ? cx + ((p0.x - x0) / (x1 - x0) - 0.5) * spanX : cx;
      p.y = spanY ? cy + ((p0.y - y0) / (y1 - y0) - 0.5) * spanY : cy;
      V.nk[p.key] = p;
      return p;
    });
    if (zig) keys.forEach(function (c) {
      if (cols[c].length < 3) return;
      cols[c].map(function (key) { return V.nk[key]; }).sort(function (a, b) { return a.y - b.y; }).forEach(function (p, j) { p.x += j % 2 ? DX : -DX; });
    });
  }

  /* ================= the stage: what stays while the cursor moves ================= */
  var ICON = {
    human: 'M0,-6.5a3.2,3.2 0 1,0 0.01,0M-6,6.5c0.8-4.2 3-6 6-6s5.2,1.8 6,6',
    hub: 'M0,-6L0,0M0,0L-5.5,4.2M0,0L5.5,4.2M-1.6,-6a1.6,1.6 0 1,0 3.2,0a1.6,1.6 0 1,0 -3.2,0M-7.1,4.2a1.6,1.6 0 1,0 3.2,0a1.6,1.6 0 1,0 -3.2,0M3.9,4.2a1.6,1.6 0 1,0 3.2,0a1.6,1.6 0 1,0 -3.2,0',
    agent: 'M0,-5.5L5.5,0L0,5.5L-5.5,0Z',
    meta: 'M3.8,-5.2a3.4,3.4 0 0,0 -4.4,4.4L-5.4,4L-4,5.4L0.8,0.6a3.4,3.4 0 0,0 4.4,-4.4L3.4,-2L2,-3.4Z',
    group: 'M-5.5,-5.5h4.4v4.4h-4.4zM1.1,-5.5h4.4v4.4h-4.4zM-2.2,1.1h4.4v4.4h-4.4z'
  };

  function renderStage() {
    var svg = els.svg;
    measure();
    svg.setAttribute('viewBox', '0 0 ' + f1(V.vw) + ' ' + f1(V.vh));
    svg.innerHTML = '';
    NODE = {}; EDGE = {};
    var defs = sv('defs', null, svg);
    var html = '<filter id="obc-glow" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="5"/></filter>' +
      '<filter id="obc-soft" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="2.2"/></filter>';
    ['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'human', 'ghost', 'def'].forEach(function (c) {
      html += '<radialGradient id="obc-ng-' + c + '" cx="38%" cy="32%" r="75%"><stop offset="0" style="stop-color:var(--oc-' + c + ');stop-opacity:.55"/><stop offset=".55" style="stop-color:var(--oc-' + c + ');stop-opacity:.16"/><stop offset="1" style="stop-color:var(--oc-pit);stop-opacity:.92"/></radialGradient>' +
        '<radialGradient id="obc-hl-' + c + '"><stop offset=".45" style="stop-color:var(--oc-' + c + ');stop-opacity:.42"/><stop offset="1" style="stop-color:var(--oc-' + c + ');stop-opacity:0"/></radialGradient>';
    });
    defs.innerHTML = html;
    ['rails', 'edges', 'chan', 'nodes', 'docks', 'fx', 'tags', 'flags'].forEach(function (k) { G[k] = sv('g', { class: 'obc-L-' + k }, svg); });
    V.seqs = {};   // the records of each node, to count how many the cursor has passed
    V.st.recs.forEach(function (r) { (V.seqs[r.node] || (V.seqs[r.node] = [])).push(r.seq); });
    drawRails(); drawChannel(); drawNodes();
  }

  function drawRails() {
    var st = V.st;
    COLD = [];
    if (!showRails()) return;
    var tagged = {}, judged = compareOn() && st.cmp.level !== 'none';
    st.rails.forEach(function (d) {
      var a = V.nk[d.from], b = V.nk[d.to];
      if (!a || !b) return;
      var g = geom(a, b, 0);
      var grp = sv('g', { class: 'obc-rail' + (judged ? (d.used ? ' warm' : ' cold') : ''), 'data-key': d.key }, G.rails);
      sv('path', { class: 'hit', d: qpath(g, 0) }, grp);
      sv('path', { d: qpath(g, 1.8) }, grp); sv('path', { d: qpath(g, -1.8) }, grp);
      var mid = qpt(g, 0.5), tg = qtan(g, 0.5), z = 4.5;
      sv('path', { class: 'chev', d: 'M' + pt({ x: mid.x + tg.x * z, y: mid.y + tg.y * z }) + 'L' + pt({ x: mid.x - tg.x * z - tg.y * z, y: mid.y - tg.y * z + tg.x * z }) + 'L' + pt({ x: mid.x - tg.x * z + tg.y * z, y: mid.y - tg.y * z - tg.x * z }) + 'Z' }, grp);
      grp.addEventListener('mouseenter', function (e) { tipShow(e, '<b>' + esc(a.name) + ' → ' + esc(b.name) + '</b><br>' + (st.cmp.written ? '补写的编排里的任务线' : '编排里的任务线') +
        (judged ? '<br><span class="m">' + (d.used ? '这份记录里有对应的交接' : esc(st.cmp.written ? '这份记录里没有对应的交接' : U.cmpWord('unusedNote'))) + '</span>' : '')); });
      grp.addEventListener('mouseleave', tipHide);
      grp.addEventListener('click', function () { selectLine(d.key); });
      // a task line nothing was handed along gets a tag, once for the pair; when one of its ends is not in the record
      // at all, that end already says so
      var pk = [d.from, d.to].sort().join('|');
      if (judged && !d.used && !tagged[pk] && !a.ghost && !b.ghost) { tagged[pk] = true; COLD.push({ g: g, key: d.key }); }
    });
  }

  // the tool channel of the instance: a box near its owner, where it covers no node and stays inside
  function drawChannel() {
    var st = V.st, ch = st.chan;
    V.chan = null;
    if (!ch || !showFacts()) return;
    var o = V.nk[ch.owner];
    if (!o) return;
    var w = 168, hh = 40, best = null;
    [[0, -(o.r + 78)], [-(o.r + 132), -(o.r + 34)], [o.r + 132, -(o.r + 34)], [-(o.r + 132), o.r + 64], [o.r + 132, o.r + 64], [0, o.r + 96]].forEach(function (d, i) {
      var c = { x: o.x + d[0], y: o.y + d[1], cost: i };
      if (c.x - w / 2 < 6 || c.x + w / 2 > V.vw - 6 || c.y - hh / 2 < 6 || c.y + hh / 2 > V.vh - 6) c.cost += 1000;
      V.nodes.forEach(function (n) { if (n !== o && Math.abs(n.x - c.x) < w / 2 + n.r + 14 && Math.abs(n.y - c.y) < hh / 2 + n.r + 34) c.cost += 100; });
      if (!best || c.cost < best.cost) best = c;
    });
    var grp = sv('g', { class: 'obc-chan' }, G.chan);
    var a = towards(o, best.x, best.y, o.r + 6);
    sv('path', { class: 'cl', d: 'M' + pt(a) + 'L' + pt(best) }, grp);
    sv('rect', { class: 'body', x: f1(best.x - w / 2), y: f1(best.y - hh / 2), width: w, height: hh, rx: 9 }, grp);
    var t1 = sv('text', { x: f1(best.x), y: f1(best.y - 3), 'text-anchor': 'middle' }, grp); t1.textContent = '能力渠道 · ' + clip(ch.name, 14);
    var label = sv('text', { class: 'sub', x: f1(best.x), y: f1(best.y + 11), 'text-anchor': 'middle' }, grp);
    grp.addEventListener('mouseenter', function (e) { tipShow(e, '<b>能力渠道：' + esc(ch.name) + '</b><br>工具调用是渠道线上的事实，不是智能体之间的交接。这份记录里有 ' + st.tools.length + ' 次工具返回。'); });
    grp.addEventListener('mouseleave', tipHide);
    V.chan = { owner: ch.owner, x: best.x, y: best.y, w: w, h: hh, a: a, label: label };
  }

  function drawNodes() {
    var defOnly = !showFacts();
    V.nodes.forEach(function (p) {
      var col = colOf(p.key), ghost = col === 'ghost';
      var grp = sv('g', { class: 'obc-node obc-c-' + col + (ghost ? ' ghost' : ''), transform: 'translate(' + f1(p.x) + ',' + f1(p.y) + ')', 'data-key': p.key }, G.nodes);
      sv('circle', { class: 'halo', r: f1(p.r + 22), fill: 'url(#obc-hl-' + col + ')' }, grp);
      var ring = sv('g', { class: 'runring' }, grp);
      var r = p.r, body;
      if (p.glyph === 'hub') {
        var pts = [];
        for (var k = 0; k < 6; k++) { var a = Math.PI / 180 * (60 * k - 90); pts.push(f1(Math.cos(a) * r * 1.08) + ',' + f1(Math.sin(a) * r * 1.08)); }
        body = sv('polygon', { class: 'body', points: pts.join(' ') }, grp);
      } else if (p.type === 'group') {
        body = sv('rect', { class: 'body', x: f1(-r * 0.92), y: f1(-r * 0.92), width: f1(r * 1.84), height: f1(r * 1.84), rx: f1(r * 0.34) }, grp);
      } else body = sv('circle', { class: 'body', r: f1(r) }, grp);
      body.setAttribute('fill', 'url(#obc-ng-' + col + ')');
      if (!ghost) sv('circle', { class: 'orbit', r: f1(r * (p.glyph === 'hub' ? 1.08 : p.type === 'group' ? 1.2 : 1) + 5) }, grp);
      sv('path', { class: 'icon', d: ICON[p.glyph] || ICON.agent, transform: 'scale(' + f1(clamp(r / 22, 0.8, 1.6)) + ')' }, grp);
      var lab = sv('text', { class: 'nlabel', y: f1(r + 21), 'text-anchor': 'middle' }, grp); lab.textContent = clip(p.name, 16);
      var sub = sv('text', { class: 'nsub', y: f1(r + 35), 'text-anchor': 'middle' }, grp);
      sub.textContent = ghost ? '这份记录里没有出现' : defOnly ? (p.type === 'group' ? p.members + ' 人' : '') : (p.type === 'group' ? p.members + ' 人 · ' : '') + p.recs + ' 条';
      grp.addEventListener('mouseenter', function (e) { tipShow(e, nodeTip(p, ghost, defOnly)); });
      grp.addEventListener('mouseleave', tipHide);
      grp.addEventListener('click', function () { var cur = V.s.selection; HUB.store.set({ selection: cur && cur.type === p.sel.type && cur.id === p.sel.id ? null : p.sel }, { history: false }); });
      grp.addEventListener('dblclick', function () {
        if (p.type === 'group') { HUB.store.toggle('org', p.id, p.level); return; }
        if (!showFacts() || ghost) return;
        var run = HUB.model.latestRunOf(p.id, Object.assign({}, V.s, { focus: { type: 'case', id: V.st.inst.id } }), V.m);
        if (run) openRun(run.id, p.sel);
      });
      NODE[p.key] = { g: grp, ring: ring, sub: sub, p: p, col: col };
    });
  }

  function nodeTip(p, ghost, defOnly) {
    var what = p.type === 'group' ? '分组 · ' + p.members + ' 人' : p.glyph === 'human' ? '人' : p.glyph === 'hub' ? '中枢智能体' : p.glyph === 'meta' ? '维护者' : '个体';
    var head = '<b>' + esc(V.evalOn ? (p.full || p.name) : p.name) + '</b> <span class="m">' + what + '</span>';
    var fact = defOnly ? '' : '<br>' + (ghost ? '这份记录里没有出现' : p.recs ? '这份记录里 ' + p.recs + ' 条记录' : '这份记录里没有它自己的记录，只作为交接的一端出现');
    var gap = !defOnly && !ghost && p.glyph !== 'human' && !HUB.model.measured(V.m, 'tokens') ? '<br><span class="m">token、用时：未采集</span>' : '';
    var how = p.type === 'group' ? '单击看详情，双击展开这个分组' : !defOnly && !ghost && p.glyph !== 'human' ? '单击看详情，双击进它最近一次运行的决策链' : '单击看详情';
    return head + fact + gap + '<br><span class="m">' + how + '</span>';
  }

  /* ================= the stage: what follows the cursor ================= */
  function updateStage() {
    var st = V.st, s = V.cursor, tau = Math.max(3, st.N / 22);
    G.edges.innerHTML = ''; G.tags.innerHTML = ''; G.flags.innerHTML = '';
    EDGE = {};
    var LBL = [];
    if (showFacts()) st.pairs.forEach(function (pair) {
      var a = V.nk[pair.from], b = V.nk[pair.to];
      if (!a || !b) return;
      var both = pair.at.explicit.length && pair.at.protocol.length;
      ['explicit', 'protocol'].forEach(function (basis) {
        var arr = pair.at[basis];
        if (!arr.length) return;
        var n = upper(arr, s);
        if (!n) return;
        var g = geom(a, b, both && basis === 'protocol' ? 1 : 0);
        var glow = Math.exp(-(s - arr[n - 1]) / tau), fo = compareOn() && !pair.declared;
        var w0 = clamp(2.4 + 2.5 * Math.sqrt(n), 3.2, 19), w1 = 1.3;
        var grp = sv('g', { class: 'obc-edge ' + basis + (fo ? ' fo' : ''), 'data-key': pair.key, opacity: f1(0.5 + 0.5 * glow) }, G.edges);
        if (basis === 'explicit') {
          sv('path', { class: 'aura', d: taper(g, w0 + 6, w1 + 2), opacity: f1(0.18 + 0.32 * glow), filter: 'url(#obc-glow)' }, grp);
          sv('path', { class: 'band', d: taper(g, w0, w1) }, grp);
        } else {
          sv('path', { class: 'hit', d: qpath(g, 0) }, grp);
          dotsAlong(g, w0 * 0.9, w1, 10).forEach(function (d) { sv('circle', { class: 'band', cx: f1(d.x), cy: f1(d.y), r: f1(d.r) }, grp); });
        }
        if (!REDUCE && glow > 0.3) sv('path', { class: 'flow', d: qpath(g, 0) }, grp);
        // one tag for the pair, on the first of its lines: everything outside the definition, or the part of it that is
        var first = basis === (upper(pair.at.explicit, s) ? 'explicit' : 'protocol');
        var part = compareOn() && pair.declared ? upper(pair.undecl, s) : 0;
        if (fo && first) LBL.push({ kind: 'fo', g: g, w0: w0, text: U.cmpWord('factTag') + ' · ×' + (upper(pair.at.explicit, s) + upper(pair.at.protocol, s)), key: pair.key });
        else if (n >= 2) LBL.push({ kind: 'count', g: g, w0: w0, n: n, key: pair.key, fo: fo });
        if (part && first) LBL.push({ kind: 'fo', g: g, w0: w0, text: '其中 ×' + part + ' ' + U.cmpWord('factTag'), key: pair.key });
        grp.addEventListener('mouseenter', function (e) { tipShow(e, edgeTip(pair, basis, n)); });
        grp.addEventListener('mouseleave', tipHide);
        grp.addEventListener('click', function () { selectLine(pair.key); });
        EDGE[pair.key + '|' + basis] = { grp: grp, g: g };
      });
    });
    // who is speaking, and where it is inside its run
    var r = speaking();
    Object.keys(NODE).forEach(function (k) {
      var n = NODE[k];
      n.g.classList.toggle('active', !!(r && r.node === k));
      n.ring.innerHTML = '';
      if (!showFacts() || n.col === 'ghost') return;
      // part way through the record: how many of its records have been reached; a member that has not spoken yet waits dimmed
      var all = V.seqs[k] || [], done = upper(all, s);
      n.sub.textContent = (n.p.type === 'group' ? n.p.members + ' 人 · ' : '') + (s < st.N ? done + ' / ' + all.length + ' 条' : all.length + ' 条');
      n.g.classList.toggle('later', !done);
    });
    if (r && NODE[r.node] && r.len > 1) drawRunRing(NODE[r.node], r);
    renderDocks();
    if (V.chan) {
      var lastT = null;
      for (var q = Math.min(s, st.N) - 1; q >= 0 && !lastT; q--) if (st.recs[q].toolReq || st.recs[q].toolRes) lastT = st.recs[q];
      V.chan.label.textContent = !lastT ? '（还没有调用）' : '最近：' + clip(lastT.toolReq ? lastT.toolReq.name : lastT.toolRes.name, 20) + (lastT.toolRes && lastT.toolRes.error ? ' · 返回错误' : '');
    }
    // labels: each finds a place on its curve that sits on nothing else
    var obs = [], pts = [];
    Object.keys(NODE).forEach(function (k) { var p = NODE[k].p, hw = Math.max(p.r + 6, 60); obs.push({ key: k, x: p.x - hw, y: p.y - p.r - 6, w: hw * 2, h: 2 * p.r + 46 }); });
    if (V.chan) obs.push({ x: V.chan.x - V.chan.w / 2 - 4, y: V.chan.y - V.chan.h / 2 - 4, w: V.chan.w + 8, h: V.chan.h + 8 });
    Object.keys(EDGE).forEach(function (k) { for (var i = 1; i < 20; i++) pts.push(qpt(EDGE[k].g, i / 20)); });
    if (V.evalOn && showFacts()) st.evals.forEach(function (e) { if (e.seq != null && e.seq <= s && V.nk[e.node]) obs.push(drawFlag(V.nk[e.node], '失误标注 · 第 ' + e.seq + ' 条', obs)); });
    COLD.forEach(function (c) { placeAlong(function (p) { return tagPill(p, st.cmp.written ? '记录里没有对应的交接' : U.cmpWord('unusedChip'), 'cold'); }, c.g, [0.5, 0.62, 0.38, 0.74, 0.26], [13, -13], obs, pts); });
    LBL.filter(function (l) { return l.kind === 'fo'; }).forEach(function (l) {
      placeAlong(function (p) { var el = tagPill(p, l.text, 'fo'); el.classList.add('elab'); el.setAttribute('data-key', l.key); return el; },
        l.g, [0.5, 0.4, 0.6, 0.3, 0.7], [l.w0 / 2 + 16, -(l.w0 / 2 + 16)], obs, pts);
    });
    LBL.filter(function (l) { return l.kind === 'count'; }).forEach(function (l) {
      placeAlong(function (p) { var t = sv('text', { class: 'elabel elab' + (l.fo ? ' fo' : ''), x: f1(p.x), y: f1(p.y + 4), 'text-anchor': 'middle', 'data-key': l.key }, G.tags); t.textContent = '×' + l.n; return t; },
        l.g, [0.5, 0.42, 0.58, 0.34, 0.66], [l.w0 / 2 + 12, -(l.w0 / 2 + 12)], obs, pts);
    });
    applySelection();
    updateCaption(); updateBubble(); updateScoreHead();
  }

  function placeAlong(make, g, ts, offs, obs, pts) {
    var best = null;
    for (var i = 0; i < ts.length; i++) {
      for (var j = 0; j < offs.length; j++) {
        var at = qpt(g, ts[i]), el = make({ x: at.x + g.nx * offs[j], y: at.y + g.ny * offs[j] }), bb = el.getBBox(), cost = 0;
        if (bb.x < 2 || bb.y < 2 || bb.x + bb.width > V.vw - 2 || bb.y + bb.height > V.vh - 2) cost += 60;
        obs.forEach(function (o) { if (bb.x < o.x + o.w && bb.x + bb.width > o.x && bb.y < o.y + o.h && bb.y + bb.height > o.y) cost += 100; });
        pts.forEach(function (q) { if (q.x > bb.x && q.x < bb.x + bb.width && q.y > bb.y && q.y < bb.y + bb.height) cost += 2; });
        if (!best || cost < best.cost) { if (best) best.el.remove(); best = { el: el, cost: cost, bb: bb }; } else el.remove();
        if (!cost) break;
      }
      if (best && !best.cost) break;
    }
    obs.push({ x: best.bb.x - 3, y: best.bb.y - 3, w: best.bb.width + 6, h: best.bb.height + 6 });
    return best.el;
  }
  function tagPill(p, text, cls) {
    var grp = sv('g', { class: 'obc-tag ' + cls }, G.tags);
    var rect = sv('rect', { rx: 9, ry: 9 }, grp);
    var t = sv('text', { x: f1(p.x), y: f1(p.y + 3.6), 'text-anchor': 'middle' }, grp);
    t.textContent = text;
    var bb = t.getBBox();
    rect.setAttribute('x', f1(bb.x - 8)); rect.setAttribute('y', f1(bb.y - 3)); rect.setAttribute('width', f1(bb.width + 16)); rect.setAttribute('height', f1(bb.height + 6));
    return grp;
  }
  function edgeTip(pair, basis, n) {
    var st = V.st, arr = pair.at[basis];
    var decl = pair.declared ? (st.cmp.written ? '补写的编排里有这条任务线' : '编排里有这条任务线') : (st.cmp.written ? '补写的编排里没有这条任务线' : '编排里没有这条任务线');
    if (pair.declared && pair.undecl.length) decl += '；其中 ' + pair.undecl.length + ' 次的两个个体之间' + (st.cmp.written ? '补写的编排里没有任务线' : '编排里没有任务线');
    return '<b>' + esc(nm(pair.from)) + ' → ' + esc(nm(pair.to)) + '</b><br>' + esc(L.handoffBasis[basis]) + '：到第 ' + V.cursor + ' 条为止 ' + n + ' 次（全程 ' + arr.length + ' 次）' +
      '<br><span class="m">发出于第 ' + arr.slice(0, n).slice(-8).join('、') + (n > 8 ? ' 条（最近 8 次）' : ' 条') + '</span><br><span class="m">' + decl + '</span>';
  }
  function drawRunRing(n, r) {
    var R0 = n.p.r + 8, Ln = r.len, gap = Math.min(0.22, 1.6 / Ln), seg = (Math.PI * 2) / Ln;
    for (var i = 0; i < Ln; i++) {
      var a0 = -Math.PI / 2 + i * seg + gap / 2, a1 = a0 + seg - gap;
      sv('path', { class: i < r.pos ? 'done' : 'todo', d: 'M' + f1(Math.cos(a0) * R0) + ',' + f1(Math.sin(a0) * R0) + 'A' + f1(R0) + ',' + f1(R0) + ' 0 0 1 ' + f1(Math.cos(a1) * R0) + ',' + f1(Math.sin(a1) * R0),
        opacity: i === r.pos - 1 ? 1 : 0.7 }, n.ring);
    }
  }
  // the flag of a failure label: on the side of the node where it covers no other node or name and stays inside
  function drawFlag(p, text, obs) {
    var prefer = p.x > V.vw * 0.6 ? -1 : 1, best = null;
    [prefer, -prefer].forEach(function (side, i) {
      var tx = p.x + side * p.r * 0.55, ty = p.y - p.r * 0.75;
      var grp = sv('g', { class: 'obc-flag', transform: 'translate(' + f1(tx) + ',' + f1(ty) + ')' }, G.flags);
      sv('line', { x1: 0, y1: 0, x2: 0, y2: -30 }, grp);
      sv('path', { d: 'M0,-30L' + 17 * side + ',-24.5L0,-19Z' }, grp);
      var t = sv('text', { x: 22 * side, y: -21, 'text-anchor': side > 0 ? 'start' : 'end' }, grp); t.textContent = text;
      var bb = grp.getBBox(), rect = { x: bb.x + tx - 3, y: bb.y + ty - 3, w: bb.width + 6, h: bb.height + 6 }, cost = i;
      if (rect.x < 2 || rect.x + rect.w > V.vw - 2 || rect.y < 2) cost += 40;
      (obs || []).forEach(function (o) { if (o.key !== p.key && rect.x < o.x + o.w && rect.x + rect.w > o.x && rect.y < o.y + o.h && rect.y + rect.h > o.y) cost += 10; });
      if (!best || cost < best.cost) { if (best) best.grp.remove(); best = { grp: grp, rect: rect, cost: cost }; } else grp.remove();
    });
    return best.rect;
  }
  // a light that was sent and is not caught yet stays at the receiver's edge; it is caught when the receiver speaks
  function renderDocks() {
    var st = V.st, s = V.cursor, byTarget = {};
    G.docks.innerHTML = '';
    if (!showFacts()) return;
    st.hands.forEach(function (x) {
      if (!(x.sent <= s && (x.got == null || x.got > s)) || FX.inflight[x.id]) return;
      (byTarget[x.to] || (byTarget[x.to] = [])).push(x);
    });
    Object.keys(byTarget).forEach(function (to) {
      byTarget[to].slice(-6).forEach(function (x, k, shown) {
        var e = EDGE[x.key + '|' + x.basis];
        if (!e) return;
        var g = e.g, tg = qtan(g, 1), off = (k - (shown.length - 1) / 2) * 9;
        var p = { x: g.e.x - tg.y * off, y: g.e.y + tg.x * off };
        var grp = sv('g', { class: 'obc-dock obc-c-' + colOf(x.from) + (x.got == null ? ' never' : '') }, G.docks);
        sv('circle', { class: 'halo', cx: f1(p.x), cy: f1(p.y), r: 6.5, filter: 'url(#obc-soft)' }, grp);
        sv('circle', { class: x.basis === 'explicit' ? 'core' : 'core hollow', cx: f1(p.x), cy: f1(p.y), r: 3.5 }, grp);
        grp.addEventListener('mouseenter', function (ev) { tipShow(ev, '<b>已发出，' + esc(nm(x.to)) + (x.got == null ? '在这份记录里没有再发言' : '还没有发言') + '</b><br>第 ' + x.sent + ' 条发出' +
          (x.got == null ? '' : '；' + esc(nm(x.to)) + '在第 ' + x.got + ' 条发言时接住') + '。<br><span class="m">按记录先后说，不表示等了多久</span>'); });
        grp.addEventListener('mouseleave', tipHide);
      });
    });
  }

  /* ================= lights in flight ================= */
  function clearFx() {
    FX.parts.forEach(function (p) { p.grp.remove(); }); FX.blooms.forEach(function (b) { b.el.remove(); });
    FX.parts = []; FX.blooms = []; FX.inflight = {};
  }
  function kick() { if (!FX.raf) FX.raf = requestAnimationFrame(frame); }
  function frame(now) {
    FX.raf = 0;
    for (var i = FX.parts.length - 1; i >= 0; i--) {
      var p = FX.parts[i], u = (now - p.t0) / p.dur;
      if (u < 0) continue;
      if (u >= 1) { p.grp.remove(); FX.parts.splice(i, 1); p.end(); continue; }
      p.update(u);
    }
    for (var j = FX.blooms.length - 1; j >= 0; j--) {
      var b = FX.blooms[j], v = (now - b.t0) / b.dur;
      if (v >= 1) { b.el.remove(); FX.blooms.splice(j, 1); continue; }
      b.el.setAttribute('r', f1(b.r0 + 4 + 30 * ease(v))); b.el.setAttribute('opacity', f1(0.9 * (1 - v)));
    }
    if (V.on && (FX.parts.length || FX.blooms.length)) kick();
  }
  // the step that just happened (one record; several when runs started together): catch what arrives, send what is handed off
  function launchStep(prev) {
    var st = V.st, s = V.cursor, beat = BEAT / V.speed;
    st.hands.forEach(function (x) { if (x.got > prev && x.got <= s && x.sent <= prev) bloom(V.nk[x.to]); });
    st.hands.forEach(function (x) { if (x.sent > prev && x.sent <= s) launchHandoff(x, x.got === x.sent ? 0 : beat * 0.28, beat * 0.5); });
    var r = st.recs[s - 1];
    if (r && V.chan && r.node === V.chan.owner) { if (r.toolReq) launchTool(r, false, beat * 0.15, beat * 0.45); if (r.toolRes) launchTool(r, true, 0, beat * 0.4); }
    renderDocks();
    kick();
  }
  function launchHandoff(x, delay, dur) {
    var e = EDGE[x.key + '|' + x.basis];
    if (!e) return;
    var g = e.g, st = V.st, solid = x.basis === 'explicit';
    var grp = sv('g', { class: 'obc-part obc-c-' + colOf(x.from), opacity: 0 }, G.fx);
    var tail = [];
    for (var k = 7; k >= 1; k--) tail.push(sv('circle', { class: 'tail', r: f1((solid ? 3.6 : 2.2) * (1 - k / 9)), opacity: f1(0.6 * (1 - k / 8)) }, grp));
    var halo = sv('circle', { class: 'halo', r: 11, filter: 'url(#obc-glow)' }, grp);
    var head = sv('circle', { class: solid ? 'core' : 'core hollow', r: solid ? 4.4 : 4.8 }, grp);
    var src = st.recs[x.sent - 1];
    var label = sv('text', { class: 'plabel', 'text-anchor': 'middle' }, grp);
    label.textContent = src ? clip(recText(src), 26) : '';
    FX.inflight[x.id] = true;
    FX.parts.push({ grp: grp, t0: performance.now() + delay, dur: dur,
      update: function (u) {
        var e2 = ease(u), p = qpt(g, e2);
        head.setAttribute('cx', f1(p.x)); head.setAttribute('cy', f1(p.y)); halo.setAttribute('cx', f1(p.x)); halo.setAttribute('cy', f1(p.y));
        tail.forEach(function (c, i) { var q = qpt(g, Math.max(0, e2 - (tail.length - i) * 0.03)); c.setAttribute('cx', f1(q.x)); c.setAttribute('cy', f1(q.y)); });
        label.setAttribute('x', f1(p.x + g.nx * 16)); label.setAttribute('y', f1(p.y + g.ny * 16 + 3));
        grp.setAttribute('opacity', f1(Math.min(1, u * 6, (1 - u) * 8 + 0.2)));
      },
      end: function () { delete FX.inflight[x.id]; if (x.got != null && x.got <= V.cursor) bloom(V.nk[x.to]); renderDocks(); } });
  }
  function launchTool(r, back, delay, dur) {
    var ch = V.chan, a = ch.a, b = { x: ch.x, y: ch.y }, from = back ? b : a, to = back ? a : b, err = back && r.toolRes.error;
    var grp = sv('g', { class: 'obc-part tool' + (err ? ' err' : ''), opacity: 0 }, G.fx);
    var halo = sv('circle', { class: 'halo', r: 8, filter: 'url(#obc-glow)' }, grp);
    var head = err ? sv('path', { class: 'core', d: 'M0,-5.5L5,3.5L-5,3.5Z' }, grp) : sv('circle', { class: 'core', r: 3.4 }, grp);
    FX.parts.push({ grp: grp, t0: performance.now() + delay, dur: dur,
      update: function (u) {
        var e2 = ease(u), x = from.x + (to.x - from.x) * e2, y = from.y + (to.y - from.y) * e2;
        halo.setAttribute('cx', f1(x)); halo.setAttribute('cy', f1(y));
        if (err) head.setAttribute('transform', 'translate(' + f1(x) + ',' + f1(y) + ')'); else { head.setAttribute('cx', f1(x)); head.setAttribute('cy', f1(y)); }
        grp.setAttribute('opacity', f1(Math.min(1, u * 6, (1 - u) * 8 + 0.2)));
      }, end: function () {} });
  }
  function bloom(p) {
    if (!p || !NODE[p.key] || REDUCE) return;
    var c = sv('circle', { class: 'obc-bloom obc-c-' + NODE[p.key].col, cx: f1(p.x), cy: f1(p.y), r: f1(p.r) }, G.fx);
    FX.blooms.push({ el: c, t0: performance.now(), dur: 820, r0: p.r });
    kick();
  }

  /* ================= what floats over the stage ================= */
  function recText(r) {
    if (r.calls && r.calls.length) return '调用 ' + r.calls.map(function (c) { return c.name + '(' + (c.args || '') + ')'; }).join(' ; ');
    return r.text || '';
  }
  function updateBubble() {
    var b = els.bubble, r = speaking();
    if (!r || !NODE[r.node]) { b.classList.remove('show'); return; }
    var p = NODE[r.node].p, cls = '', txt;
    var len = V.small ? 64 : 120;
    if (r.toolReq) { cls = ' tool'; txt = clip(recText(r), len); }
    else if (r.toolRes) { cls = r.toolRes.error ? ' err' : ' tool'; txt = (r.toolRes.error ? '返回错误 · ' : '返回 · ') + clip(r.text, len - 10); }
    else txt = clip(r.text, len) || '（这条记录没有文字）';
    b.className = 'obc-bubble obc-glass' + cls;
    // inside a closed group, say which member is speaking
    var x = p.type === 'group' ? V.m.idx.ind.get(r.ind) : null;
    var who = x ? HUB.collab.shortName(x.name) + ' · ' : '';
    b.innerHTML = '<div class="role"><b>' + esc(p.name) + '</b><span class="rr">' + esc(who + (KIND[r.kind] || r.kind)) + '</span><span class="rn">第 ' + r.seq + ' 条</span></div><div class="txt">' + esc(txt) + '</div>';
    placeBubble(b, p);
    requestAnimationFrame(function () { b.classList.add('show'); });
  }
  // around the speaker, the place that covers the least: other nodes, lines, labels, the note and the captions
  function placeBubble(b, p) {
    var W = els.stage.clientWidth, Hh = els.stage.clientHeight, s0 = els.stage.getBoundingClientRect(), k = V.k;
    var sc = { x: p.x * k, y: p.y * k }, rr = p.r * k, bw = b.offsetWidth || 280, bh = b.offsetHeight || 70;
    var obs = [], pts = [];
    Object.keys(NODE).forEach(function (key) {
      var q = NODE[key].p, r2 = q.r * k, hw = Math.max(r2 + 8, 52 * k);   // the body, and the two lines of label under it
      if (q !== p) obs.push({ x: q.x * k - hw, y: q.y * k - r2 - 8, w: 2 * hw, h: 2 * r2 + 44 * k + 12, wgt: 60 });
    });
    [els.caption, els.note, els.legend].forEach(function (e) {
      if (!e || !e.offsetWidth) return;
      var r = e.getBoundingClientRect();
      obs.push({ x: r.left - s0.left - 8, y: r.top - s0.top - 8, w: r.width + 16, h: r.height + 16, wgt: 90 });
    });
    Object.keys(EDGE).forEach(function (key) { for (var i = 1; i < 16; i++) { var q = qpt(EDGE[key].g, i / 16); pts.push({ x: q.x * k, y: q.y * k }); } });
    var rects = function (sel, wgt, pad) { Array.prototype.forEach.call(els.svg.querySelectorAll(sel), function (t) { var r = t.getBoundingClientRect(); obs.push({ x: r.left - s0.left - pad, y: r.top - s0.top - pad, w: r.width + 2 * pad, h: r.height + 2 * pad, wgt: wgt }); }); };
    rects('.obc-tag, .elabel, .obc-chan', 45, 6); rects('.obc-flag', 150, 8);
    var best = null;
    [14, 64].forEach(function (gap, gi) {
      for (var j = 0; j < 12; j++) {
        // the whole box stays outside a circle around the speaker: its centre goes out by the reach plus its own half-extent that way
        var a = j * Math.PI / 6, ca = Math.cos(a), sa = Math.sin(a), reach = rr * 1.1 + gap + (sa > 0.3 ? 44 * k : 0);
        var out = reach + Math.abs(ca) * bw / 2 + Math.abs(sa) * bh / 2;
        var cx = sc.x + ca * out - bw / 2, cy = sc.y + sa * out - bh / 2;
        var x = clamp(cx, 10, W - bw - 10), y = clamp(cy, 10, Hh - bh - 10);
        var cost = gi * 6 + (Math.abs(sa) > 0.9 ? 0 : 1.5) + (Math.abs(x - cx) + Math.abs(y - cy)) * 0.08;
        if (x < sc.x + rr && x + bw > sc.x - rr && y < sc.y + rr && y + bh > sc.y - rr) cost += 400;   // pushed back onto the speaker by the edge of the stage
        obs.forEach(function (o) { if (x < o.x + o.w && x + bw > o.x && y < o.y + o.h && y + bh > o.y) cost += o.wgt; });
        pts.forEach(function (q) { if (q.x > x - 6 && q.x < x + bw + 6 && q.y > y - 6 && q.y < y + bh + 6) cost += 7; });
        if (!best || cost < best.cost) best = { x: x, y: y, cost: cost };
      }
    });
    b.style.left = best.x + 'px'; b.style.top = best.y + 'px';
  }
  function capsAt(n) { return ((V.st.captions || {})[n] || []).filter(function (c) { return c.kind !== 'eval' || V.evalOn; }); }
  function updateCaption() {
    var caps = speaking() ? capsAt(V.cursor) : [];
    if (V.small) caps = caps.slice(-1);
    els.caption.innerHTML = caps.map(function (c) { return '<div class="' + c.kind + '" title="' + esc(c.text) + '">' + esc(c.text) + '</div>'; }).join('');
  }

  // the strip above the stage: which instance this is, what kind of facts, and (as its own layer) the evaluation;
  // and the note that says what the chart can and cannot show
  function renderHead() {
    var st = V.st, m = V.m, inst = st.inst, hd = els.head;
    hd.innerHTML = '';
    if (st.real) {
      var name = V.evalOn ? inst.name : HUB.collab.shortName(inst.name);
      hd.appendChild(h('span', { class: 'obc-hk' }, '一次协作'));
      hd.appendChild(h('b', { class: 'obc-ht', title: inst.id + ' ' + name }, inst.id + ' ' + clip(name, 30)));
      var first = st.recs.find(function (r) { return r.kind === 'say' && r.text; }) || st.recs[0];
      hd.appendChild(h('span', { class: 'obc-hq', title: first && first.text ? '第 ' + first.seq + ' 条 · ' + nm(first.node) + '：' + clip(first.text, 500) : '' }, first && first.text ? '“' + clip(first.text, 160) + '”' : ''));
      hd.appendChild(h('span', { class: 'ob-pill info', title: HUB.model.factLabel(m) }, '事实：' + (m.factSource && m.factSource.kind === 'trace' ? '真实轨迹' : clip(HUB.model.factLabel(m), 20))));
      if (st.cmp.written) hd.appendChild(h('span', { class: 'ob-pill', title: '分工和任务线是我们按来源的说明补写的，不是对方系统原有的设计' }, '定义：我们补写的编排'));
    } else {
      hd.appendChild(h('span', { class: 'obc-hk' }, '只有定义'));
      hd.appendChild(h('b', { class: 'obc-ht' }, clip(m.presetName || m.name, 40)));
      hd.appendChild(h('span', { class: 'obc-hq' }, ''));
      hd.appendChild(h('span', { class: 'ob-pill warn' }, st.src.why === 'empty' ? '没有记录' : '事实是模拟数据：这里不画'));
    }
    var res = st.result;
    if (V.evalOn && showFacts() && (res || st.evals.length)) {
      hd.appendChild(h('button', { type: 'button', class: 'obc-eval ' + (!res ? 'bad' : res.result === 'success' ? 'good' : res.result === 'failure' ? 'bad' : 'mid'),
        title: '评价是事后的判断，和执行事实分开；下方的“评价”开关可以把它整层关掉。' + (res && res.note ? '记录的说明：' + clip(res.note, 240) + '。' : '') + '点一下在右栏看这个案例实例',
        onClick: function () { HUB.store.set({ selection: { type: 'case', id: inst.id } }, { history: false }); } },
        h('span', { class: 'k' }, '评价'), (res ? '记录的结局：' + (RESULT[res.result] || res.result) : '') + (st.evals.length ? (res ? ' · ' : '') + '失误标注 ' + st.evals.length + ' 处' : '')));
    }
    var note = '';
    if (!st.real) note = st.src.why === 'error' ? '真实轨迹读取失败，这个案例现在只有模拟数据。协作轨迹图不画模拟出来的事实，下面只是编排里的任务线。' :
      st.src.why === 'simulated' ? '这个案例的事实是模拟数据，不是真实记录。协作轨迹图不画模拟出来的事实，下面只是编排里的任务线；模拟的走法在 ③ 单案例路由图里看（那里标着“模拟数据”）。' :
        '这个案例还没有任何记录，下面只是编排里的任务线。';
    else if (st.cmpMode === 'def') note = '只看定义：' + (st.cmp.written ? '我们补写的编排里的任务线，不是来源系统原有的设计。' : '编排里的任务线。');
    else if (st.cmp.level === 'none') note = '这份记录只有发言先后，没有交接的依据：不连线，也不和任务线对照。先后在下方的全图里。';
    else if (st.src.kind === 'runs') note = '本机会话没有逐条发言这一层：一次运行一格，交接按会话里记录的派生与返回。';
    else if (st.cmpMode === 'both' && st.cmp.written) note = '对照的是我们补写的编排：只说与它一致或不一致，不说来源系统偏离了设计。';
    els.note.textContent = note;
    els.note.title = note;
    els.note.style.display = note ? '' : 'none';
    if (!st.real && st.src.why === 'simulated') els.note.appendChild(h('a', { class: 'ob-a', onClick: function () { HUB.views.go('v3'); } }, ' 去 ③'));
  }

  /* ================= the bar and the full chart ================= */
  function ibtn(title, path, fn, cls) {
    return h('button', { type: 'button', class: 'ob-ibtn obc-ib' + (cls ? ' ' + cls : ''), title: title, 'aria-label': title, onClick: fn,
      html: '<svg viewBox="0 0 16 16" width="13" height="13"><path d="' + path + '"/></svg>' });
  }
  function chipBtn(label, on, title, fn) { return h('button', { type: 'button', class: 'ob-chip' + (on ? ' on' : ''), title: title, onClick: fn }, label); }
  function legendBtn() { return chipBtn('图例', V.legend, '这张图怎么看', function () { V.legend = !V.legend; els.legend.style.display = V.legend ? '' : 'none'; renderBar(); updateBar(); updateBubble(); }); }
  // built when something other than the cursor changes: a control that is rebuilt under the pointer loses its click
  function renderBar() {
    var st = V.st, bar = els.bar;
    bar.innerHTML = '';
    els.pos = null;
    if (!canReplay()) {
      bar.appendChild(h('span', { class: 'obc-barnote left' }, !st.real ? (st.src.why === 'empty' ? '这个案例还没有记录，所以没有回放和全图。' : '事实是模拟数据，这里不画，所以没有回放和全图。') : !st.N ? '这个案例实例没有记录。' : '只看定义：记录和回放收起来了，切到“对照”或“事实”再看。'));
      bar.appendChild(legendBtn());
      return;
    }
    bar.appendChild(ibtn('回到开头（Home）', 'M3 3v10M13 3 6 8l7 5z', function () { pause(); go(0, true); }));
    bar.appendChild(ibtn('上一条（←）', 'M11 3 4.5 8 11 13z', function () { pause(); go(V.cursor - 1, false, true); }));
    bar.appendChild(ibtn(V.playing ? '暂停（空格）' : '播放（空格）', V.playing ? 'M4 3h3v10H4zM9 3h3v10H9z' : 'M5 3v10l8-5z', toggle, 'play' + (V.playing ? ' on' : '')));
    bar.appendChild(ibtn('下一条（→）', 'M5 3 11.5 8 5 13z', function () { pause(); step(); }));
    bar.appendChild(ibtn('到结尾，看全貌（End）', 'M13 3v10M3 3l7 5-7 5z', function () { pause(); go(st.N, true); }));
    var seg = h('div', { class: 'ob-seg', title: '回放的快慢。只是播放速度，不是记录里的时间' });
    [0.5, 1, 2, 4].forEach(function (v) { seg.appendChild(h('button', { type: 'button', class: V.speed === v ? 'on' : '', onClick: function () { V.speed = v; renderBar(); updateBar(); } }, v + '×')); });
    bar.appendChild(seg);
    els.pos = h('span', { class: 'obc-pos' });
    bar.appendChild(els.pos);
    bar.appendChild(h('span', { class: 'ob-sep' }));
    if (st.evals.length || st.result) bar.appendChild(chipBtn('评价', V.evalOn, '评价是事后的判断（失误标注、结局），和执行事实分开；可以整层关掉', function () { HUB.store.set({ overlays: { evals: !V.evalOn } }); }));
    bar.appendChild(chipBtn('讲解', V.story, '播放时在关键记录停一下，配一句由数据算出来的说明', function () { V.story = !V.story; if (V.story && !V.playing) play(); else { renderBar(); updateBar(); } }));
    bar.appendChild(legendBtn());
    bar.appendChild(h('span', { class: 'obc-barnote' }, st.src.kind === 'turns' ? '一拍一条记录 · 只有先后，没有时间 · 节拍不代表时长、等待或并发' : '一拍一次运行 · 按先后排，节拍和间隔不代表时长'));
  }
  function updateBar() {
    if (els.pos) els.pos.innerHTML = (V.st.src.kind === 'turns' ? '第 <b>' + V.cursor + '</b> / ' + V.st.N + ' 条' : '第 <b>' + V.cursor + '</b> / ' + V.st.N + ' 次运行');
  }

  function scoreLanes() { return V.st.nodes.slice().sort(function (a, b) { return (a.layer - b.layer) || (a.y - b.y); }); }
  function sx(r) { return SC.labelW + (r - 1) * SC.cell; }
  function renderScore() {
    var st = V.st, svgS = els.score, W = els.foot.clientWidth || 800;
    svgS.innerHTML = '';
    SC.ph = null;
    // nothing to replay, or a canvas too low to hold both: the full chart gives way and the bar stays
    if (!canReplay() || (els.host.clientHeight && els.host.clientHeight < 380)) { els.scorewrap.style.display = 'none'; return; }
    els.scorewrap.style.display = '';
    var lanes = scoreLanes().filter(function (p) { return !p.ghost || st.cmpMode !== 'fact' || st.hands.some(function (x) { return x.from === p.key || x.to === p.key; }); });
    SC.laneH = clamp(Math.round(clamp((els.host.clientHeight || 640) * 0.17, 84, 150) / Math.max(1, lanes.length)), 17, 30);
    var N = st.N, H = SC.top + lanes.length * SC.laneH + SC.axisH;
    SC.W = W; SC.H = H; SC.cell = (W - SC.labelW - SC.padR) / N;
    svgS.setAttribute('viewBox', '0 0 ' + W + ' ' + H); svgS.setAttribute('width', W); svgS.setAttribute('height', H);
    var laneY = {};
    lanes.forEach(function (p, i) { laneY[p.key] = SC.top + i * SC.laneH + SC.laneH / 2; });
    SC.laneY = laneY;
    var g = sv('g', { class: 'marks' }, svgS), cw = SC.cell;
    lanes.forEach(function (p, i) {
      sv('rect', { class: 'lane' + (i % 2 ? ' alt' : ''), x: SC.labelW - 6, y: SC.top + i * SC.laneH + 1, width: W - SC.labelW - SC.padR + 12, height: SC.laneH - 2, rx: 4 }, g);
      var t = sv('text', { x: 14, y: f1(laneY[p.key] + 4), class: 'obc-c-' + colOf(p.key) }, g);
      var t1 = sv('tspan', { class: 'lname' + (p.ghost ? ' ghost' : '') }, t); t1.textContent = clip(p.name, 12);
      var t2 = sv('tspan', { class: 'lsub', dx: 6 }, t); t2.textContent = p.ghost ? '没有出现' : p.type === 'group' ? p.members + ' 人' : '';
    });
    // runs: the records of one run in a capsule
    st.recs.forEach(function (r) {
      var y = laneY[r.node];
      if (y == null || r.pos !== 1 || r.len < 2) return;
      sv('rect', { class: 'run obc-c-' + colOf(r.node), x: f1(sx(r.seq) + 0.3), y: f1(y - 8), width: f1(r.len * cw - 0.6), height: 16, rx: 5 }, g);
    });
    var sentBy = {};
    st.hands.forEach(function (x) { if (x.basis === 'explicit') sentBy[x.sent] = true; });
    st.recs.forEach(function (r) {
      var y = laneY[r.node];
      if (y == null) return;
      var w = clamp(cw - 1.4, 1.3, 20);
      sv('rect', { class: 'rec obc-c-' + colOf(r.node) + (r.kind === 'think' || r.kind === 'context' ? ' quiet' : sentBy[r.seq] ? ' sent' : ''), x: f1(sx(r.seq) + (cw - w) / 2), y: f1(y - 5), width: f1(w), height: 10, rx: f1(Math.min(2.5, w / 2)) }, g);
      if (r.toolRes && r.toolRes.error) sv('path', { class: 'terr', d: 'M' + f1(sx(r.seq) + cw / 2) + ',' + f1(y - 13) + 'l4,7h-8z' }, g);
      else if (r.toolReq || r.toolRes) sv('circle', { class: 'tool', cx: f1(sx(r.seq) + cw / 2), cy: f1(y - 8.5), r: 2 }, g);
    });
    // handoffs: from the record that sends to the record that catches
    st.hands.forEach(function (x) {
      var y1 = laneY[x.from], y2 = laneY[x.to];
      if (y1 == null || y2 == null) return;
      var dn = y2 > y1 ? 1 : -1, x1 = sx(x.sent) + cw / 2, x2 = x.got != null && x.got > x.sent ? sx(x.got) + cw / 2 : x1 + Math.min(6, cw / 3);
      var fo = compareOn() && !x.relationId;
      sv('line', { class: 'hand ' + x.basis + (fo ? ' fo' : '') + (x.got == null ? ' never' : ''), x1: f1(x1), y1: f1(y1 + 5.5 * dn), x2: f1(x2), y2: f1(y2 - 5.5 * dn) }, g);
      if (x.got == null) sv('circle', { class: 'hand-end' + (fo ? ' fo' : ''), cx: f1(x2), cy: f1(y2 - 5.5 * dn), r: 2.4 }, g);
    });
    if (V.evalOn) st.evals.forEach(function (e) {
      var rec = e.seq != null ? st.recs[e.seq - 1] : null, y = rec ? laneY[rec.node] : null;
      if (y == null) return;
      var xx = sx(e.seq) + cw / 2;
      sv('line', { class: 'eflag', x1: f1(xx), y1: f1(y + 6), x2: f1(xx), y2: f1(y - 11) }, g);
      sv('path', { class: 'eflag', d: 'M' + f1(xx) + ',' + f1(y - 11) + 'l8,2.6l-8,2.6z' }, g);
    });
    var ax = sv('g', { class: 'axis' }, svgS), yA = SC.top + lanes.length * SC.laneH + 4;
    var stepK = [1, 2, 5, 10, 20, 50, 100, 200, 500].filter(function (v) { return v * cw >= 34; })[0] || 1000;
    for (var n = 1; n <= N; n++) if (n === 1 || n % stepK === 0 || (n === N && (N % stepK) * cw >= 30)) {
      sv('line', { x1: f1(sx(n) + cw / 2), x2: f1(sx(n) + cw / 2), y1: yA, y2: yA + 4 }, ax);
      var tt = sv('text', { x: f1(sx(n) + cw / 2), y: yA + 15, 'text-anchor': 'middle' }, ax); tt.textContent = n;
    }
    var ttl = sv('text', { class: 'ttl', x: 14, y: yA + 15 }, ax); ttl.textContent = st.src.kind === 'turns' ? '记录序号（不是时间）' : '运行先后（不是时长）';
    SC.sel = sv('rect', { class: 'selrec', height: 18, rx: 4, visibility: 'hidden' }, svgS);
    SC.fut = sv('rect', { class: 'fut', y: SC.top, height: lanes.length * SC.laneH }, svgS);
    SC.ph = sv('g', { class: 'ph' }, svgS);
    sv('line', { class: 'glow', y1: SC.top, y2: yA }, SC.ph); sv('line', { y1: SC.top, y2: yA }, SC.ph);
    SC.phRect = sv('rect', { y: yA + 4, height: 15, rx: 4 }, SC.ph); SC.phText = sv('text', { y: yA + 15, 'text-anchor': 'middle' }, SC.ph);
  }
  function updateScoreHead() {
    if (!SC.ph) return;
    var st = V.st, s = V.cursor, cw = SC.cell, xx = s ? sx(s) + cw / 2 : SC.labelW - 3;
    Array.prototype.forEach.call(SC.ph.querySelectorAll('line'), function (l) { l.setAttribute('x1', f1(xx)); l.setAttribute('x2', f1(xx)); });
    var label = s ? '第 ' + s + (st.src.kind === 'turns' ? ' 条' : ' 次') : '开始前', w = label.length * 7 + 12, rx = clamp(xx - w / 2, SC.labelW - 6, SC.W - SC.padR - w + 6);
    SC.phRect.setAttribute('x', f1(rx)); SC.phRect.setAttribute('width', f1(w));
    SC.phText.setAttribute('x', f1(rx + w / 2)); SC.phText.textContent = label;
    var fx = s ? sx(s) + cw : SC.labelW - 6;
    SC.fut.setAttribute('x', f1(fx)); SC.fut.setAttribute('width', f1(Math.max(0, SC.W - SC.padR + 6 - fx)));
    // the selected record
    var sel = V.s.selection, sr = null;
    if (sel && sel.type === 'turn') sr = st.recs.find(function (r) { return r.id === sel.id; });
    if (sr && SC.laneY[sr.node] != null) { SC.sel.setAttribute('x', f1(sx(sr.seq) - 1)); SC.sel.setAttribute('y', f1(SC.laneY[sr.node] - 9)); SC.sel.setAttribute('width', f1(cw + 2)); SC.sel.setAttribute('visibility', 'visible'); }
    else SC.sel.setAttribute('visibility', 'hidden');
  }
  function scoreAt(e) {
    var r = els.score.getBoundingClientRect(), x = (e.clientX - r.left) * (SC.W / (r.width || SC.W));
    return clamp(Math.floor((x - SC.labelW) / SC.cell) + 1, 0, V.st.N);
  }

  /* ================= legend ================= */
  function renderLegend() {
    var st = V.st, w = st.cmp.written;
    var row = function (svgInner, text) { return '<div class="row"><svg viewBox="0 0 58 20" width="58" height="20">' + svgInner + '</svg><div>' + text + '</div></div>'; };
    els.legend.innerHTML = '<h4>这张图怎么看</h4>' +
      row('<path class="lg-task" d="M2 6.5 L48 9.4 L48 10.6 L2 13.5Z"/><circle class="lg-core" cx="50" cy="10" r="3.6"/>', '<b>' + esc(L.handoffBasis.explicit) + '</b>的交接：实线楔形、实心光。宽的一端是发出者，越宽次数越多') +
      row('<circle class="lg-task" cx="4" cy="10" r="3"/><circle class="lg-task" cx="13" cy="10" r="2.5"/><circle class="lg-task" cx="22" cy="10" r="2"/><circle class="lg-task" cx="31" cy="10" r="1.6"/><circle class="lg-task" cx="40" cy="10" r="1.2"/><circle class="lg-hollow" cx="50" cy="10" r="3.8"/>', '<b>' + esc(L.handoffBasis.protocol) + '</b>的交接：点线、空心光。点由大到小指向接收者') +
      row('<line class="lg-none" x1="2" y1="10" x2="54" y2="10"/>', '<b>' + esc(L.handoffBasis.adjacent) + '</b>：不算交接，不连线，只在下方全图里看顺序' + (st.real ? '（这个实例 ' + st.counts.orderOnly + ' 处）' : '')) +
      row('<path class="lg-rail" d="M2 8.2 Q28 4 54 8.2"/><path class="lg-rail" d="M2 11.8 Q28 7.6 54 11.8"/>', '<b>' + (w ? '补写的编排里的任务线' : '编排里的任务线') + '</b>：双细线，像轨道。看“定义”或“对照”时显示') +
      row('<path class="lg-fo" d="M2 6.5 L48 9.4 L48 10.6 L2 13.5Z"/>', '对照：这份记录里有，' + (w ? '补写的编排里没有' : '编排里没有（未声明）')) +
      row('<path class="lg-cold" d="M2 10 L54 10"/>', '对照：' + (w ? '补写的编排里有，这份记录里没有出现' : '编排里有，没有发生')) +
      row('<circle class="lg-ghost" cx="29" cy="10" r="7.5"/>', '虚线圈：定义里有、<b>这份记录里没有出现</b>的成员') +
      row('<circle class="lg-chan" cx="16" cy="10" r="3.4"/><path class="lg-err" d="M38 4 44 14 32 14Z"/>', '绿：<b>工具调用</b>（渠道线，不是交接）；红三角：工具返回了错误，是执行时的事实') +
      row('<line class="lg-eval" x1="22" y1="18" x2="22" y2="3"/><path class="lg-evalf" d="M22 3 34 7 22 11Z"/>', '<b>评价</b>：事后的判断（失误标注、结局），可以整层关掉') +
      row('<circle class="lg-halo" cx="29" cy="10" r="6"/><circle class="lg-core" cx="29" cy="10" r="3"/>', '停在接收者边上的光：已发出，接收者还没有发言；它发言时被接住') +
      '<div class="foot">一拍一条记录。数据只有先后，没有时间：节拍、光点的速度都不代表时长、等待或并发。线越亮，表示越是最近几条记录里用过。</div>';
  }

  /* ================= selection ================= */
  function selectLine(key) {
    var st = V.st, rail = st.railByKey[key], pair = st.pairByKey[key], cur = V.s.selection, sel = null;
    if (pair && showFacts() && !pair.declared) sel = { type: 'factonly', id: 'fo_' + pair.list[0].fromInd + '_' + pair.list[0].toInd };
    else if (pair && showFacts() && pair.rels.length) sel = { type: 'relation', id: pair.rels[0] };
    else if (rail) sel = { type: 'relation', id: rail.rels[0] };
    if (!sel) return;
    HUB.store.set({ selection: cur && cur.type === sel.type && cur.id === sel.id ? null : sel }, { history: false });
  }
  function applySelection() {
    var st = V.st, sel = V.s.selection, keys = null, nodes = null;
    if (sel && (sel.type === 'individual' || sel.type === 'group')) {
      var nk = sel.type === 'group' ? 'g:' + sel.id : HUB.orgRep(sel.id, V.s, V.m);
      if (st.nodeByKey[nk]) {
        nodes = {}; nodes[nk] = true; keys = {};
        st.rails.concat(st.pairs).forEach(function (x) { if (x.from === nk || x.to === nk) { keys[x.key] = true; nodes[x.from] = true; nodes[x.to] = true; } });
      }
    } else if (sel && (sel.type === 'relation' || sel.type === 'factonly')) {
      keys = {}; nodes = {};
      st.rails.forEach(function (x) { if (sel.type === 'relation' && x.rels.indexOf(sel.id) >= 0) { keys[x.key] = true; nodes[x.from] = true; nodes[x.to] = true; } });
      st.pairs.forEach(function (x) {
        var hit = sel.type === 'relation' ? x.rels.indexOf(sel.id) >= 0 : x.list.some(function (hh) { return 'fo_' + hh.fromInd + '_' + hh.toInd === sel.id; });
        if (hit) { keys[x.key] = true; nodes[x.from] = true; nodes[x.to] = true; }
      });
      if (!Object.keys(keys).length) keys = nodes = null;
    }
    var one = nodes && sel && (sel.type === 'individual' || sel.type === 'group') ? (sel.type === 'group' ? 'g:' + sel.id : HUB.orgRep(sel.id, V.s, V.m)) : null;
    Array.prototype.forEach.call(els.svg.querySelectorAll('.obc-edge, .obc-rail, .elab'), function (e) { e.classList.toggle('dim', !!keys && !keys[e.getAttribute('data-key')]); });
    Array.prototype.forEach.call(els.svg.querySelectorAll('.obc-node'), function (n) {
      var k = n.getAttribute('data-key');
      n.classList.toggle('dim', !!nodes && !nodes[k]);
      n.classList.toggle('sel', !!one && one === k);
    });
  }
  function openRun(runId, sel) {
    pause();
    HUB.store.set({ subject: 'exec', depth: { exec: 1 }, expanded: { exec: [] }, collapsed: { exec: [] }, focus: { type: 'run', id: runId }, selection: sel || { type: 'run', id: runId } });
  }

  /* ================= replay ================= */
  function go(n, history, back) { var st = V.st; HUB.store.set({ time: HUB.collab.timeOf(st, clamp(n, 0, st.N), back) }, { history: history !== false }); }
  function step() { if (V.cursor >= V.st.N) return; V.stepAnim = true; go(V.cursor + 1, false); V.stepAnim = false; }
  function play() {
    if (!canReplay()) return;
    if (V.cursor >= V.st.N) go(0, false);
    V.playing = true; renderBar(); updateBar(); schedule(140);
  }
  function pause() { var was = V.playing; V.playing = false; clearTimeout(V.timer); if (was && V.on && V.st) { renderBar(); updateBar(); } }
  function toggle() { if (V.playing) pause(); else play(); }
  function schedule(ms) {
    clearTimeout(V.timer);
    V.timer = setTimeout(function () {
      if (!V.playing) return;
      if (!V.on || !document.body.classList.contains('obs-on') || V.cursor >= V.st.N) { pause(); return; }
      step();
      var caps = capsAt(V.cursor);
      schedule(BEAT / V.speed + (V.story && caps.length ? 2400 + 900 * (caps.length - 1) : 0));
    }, ms);
  }
  // keys of the view; true when the key was used. Space is always this view's: with nothing to replay it does nothing,
  // rather than start the replay of the time strip underneath
  function key(e) {
    if (!V.on || e.altKey || e.ctrlKey || e.metaKey) return false;
    if (!canReplay()) return e.key === ' ';
    var k = e.key;
    if (k === ' ') toggle();
    else if (k === 'ArrowRight') { pause(); step(); }
    else if (k === 'ArrowLeft') { pause(); go(V.cursor - 1, false, true); }
    else if (k === 'Home') { pause(); go(0, true); }
    else if (k === 'End') { pause(); go(V.st.N, true); }
    else return false;
    return true;
  }
  // the cut in the words of this view: the number of the record inside the instance, not the model's running count
  function cutLabel(s, m) {
    var out = HUB.collab.build(m, s), st = out.st;
    if (!st.real || st.src.kind !== 'turns') return U.fmtClock(s.time);
    return (out.cursor ? '第 ' + out.cursor + ' 条' : '开始前') + (m.facts.cases.length > 1 ? '（本实例）' : '');
  }

  /* ================= tooltip ================= */
  function tipShow(e, html) { els.tip.innerHTML = html; els.tip.classList.add('show'); tipMove(e); }
  function tipMove(e) { var t = els.tip, w = t.offsetWidth, hh = t.offsetHeight; t.style.left = clamp(e.clientX + 14, 8, window.innerWidth - w - 8) + 'px'; t.style.top = clamp(e.clientY + 14, 8, window.innerHeight - hh - 8) + 'px'; }
  function tipHide() { if (els.tip) els.tip.classList.remove('show'); }

  HUB.obsCollab = { mount: mount, render: render, key: key, play: play, pause: pause, cutLabel: cutLabel, isOn: function () { return V.on; },
    state: function () { return { cursor: V.cursor, playing: V.playing, n: V.st ? V.st.N : 0, k: V.k, vw: V.vw, vh: V.vh }; } };
})();
