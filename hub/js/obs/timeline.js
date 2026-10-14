/* HUB.obsTimeline: the time strip at the bottom of the canvas, and replay.
   Case bars, an activity histogram and event marks over the simulated span; click or drag to cut time,
   the replay walks the cut through a case so the canvas shows who is working at each moment. */
(function () {
  'use strict';
  var HUB = (window.HUB = window.HUB || {});
  var U = HUB.util, L = U.LABELS, esc = U.esc;
  var SVGNS = 'http://www.w3.org/2000/svg';
  var T = { el: null, svg: null, head: null, drag: false, replay: null, w: 0 };
  var LEFT = 132, RIGHT = 14;

  function svg(t, a) { var e = document.createElementNS(SVGNS, t); if (a) Object.keys(a).forEach(function (k) { e.setAttribute(k, a[k]); }); return e; }

  function mount(el) {
    T.el = el;
    el.innerHTML = '';
    T.head = document.createElement('div');
    T.head.className = 'ob-tl-head';
    T.svg = svg('svg', { class: 'ob-tl-svg' });
    el.appendChild(T.head);
    el.appendChild(T.svg);
    T.svg.addEventListener('pointerdown', function (e) {
      if (e.target.closest('[data-case]')) return;
      T.drag = true;
      T.svg.setPointerCapture(e.pointerId);
      cut(e, false);
    });
    T.svg.addEventListener('pointermove', function (e) { if (T.drag) cut(e, false); });
    T.svg.addEventListener('pointerup', function (e) { if (T.drag) { T.drag = false; cut(e, true); } });
    T.svg.addEventListener('click', function (e) {
      var c = e.target.closest('[data-case]');
      if (!c) return;
      var s = HUB.store.get(), id = c.getAttribute('data-case');
      HUB.store.set({ focus: { type: 'case', id: id }, instanceId: id, subject: s.subject === 'exec' ? 'org' : s.subject, depth: { org: Math.max(2, s.depth.org) }, selection: { type: 'case', id: id } });
    });
  }

  function span(m) { return { a: m.facts.span.start || 0, b: m.facts.span.end }; }
  function tToX(t, m) { var sp = span(m); return LEFT + (t - sp.a) / (sp.b - sp.a) * (T.w - LEFT - RIGHT); }
  function xToT(x, m) { var sp = span(m); return sp.a + U.clamp((x - LEFT) / (T.w - LEFT - RIGHT), 0, 1) * (sp.b - sp.a); }
  function cut(e, commit) {
    var m = HUB.model.current, r = T.svg.getBoundingClientRect();
    var t = Math.round(xToT(e.clientX - r.left, m) / 60000) * 60000;
    if (e.clientX - r.left < LEFT) return;
    stopReplay();
    HUB.store.set({ time: t >= span(m).b - 60000 ? null : t }, { history: !!commit });
  }

  function update(m, s) {
    if (!T.el) return;
    if (s && s.subject === 'exec' && s.focus && s.focus.type === 'session') {
      T.el.style.display = 'none';
      return;
    }
    T.el.style.display = '';
    T.w = T.el.clientWidth || 800;
    var H = 58;
    T.svg.setAttribute('width', T.w);
    T.svg.setAttribute('height', H);
    T.svg.innerHTML = '';
    var F = m.facts, sp = span(m);
    // head: where we are in time
    T.head.innerHTML = '<span class="ob-tl-now">' + (s.time == null ? '全部时间' : '截止 ' + esc(U.fmtClock(s.time))) + '</span>' +
      (s.time != null ? '<a class="ob-a" data-tl="all">看全部</a>' : '') +
      (T.replay ? '<span class="ob-tl-rep">回放中 · ' + esc(T.replay.caseId || '全程') + '</span>' : '');
    var all = T.head.querySelector('[data-tl="all"]');
    if (all) all.onclick = function () { stopReplay(); HUB.store.set({ time: null }); };
    if (!(sp && sp.b > 0)) return; // 零跨度（空模型）不画刻度，避免 NaN 坐标
    // row labels
    [['案例', 12], ['活动', 32], ['事件', 50]].forEach(function (r) { T.svg.appendChild(svg('text', { x: 10, y: r[1] + 3, class: 'ob-tl-rl' })).textContent = r[0]; });
    // day and six-hour ticks
    for (var t = 0; t <= sp.b; t += 6 * 3600000) {
      var x = tToX(t, m);
      T.svg.appendChild(svg('line', { x1: x, x2: x, y1: 0, y2: H, class: t % U.DAY === 0 ? 'ob-tl-day' : 'ob-tl-tick' }));
      var lab = svg('text', { x: x + 3, y: 8, class: 'ob-tl-tt' });
      lab.textContent = U.fmtClock(t).replace(' ', ' ');
      if (x < T.w - 60) T.svg.appendChild(lab);
    }
    // cases as bars; the focused one is bright
    var focus = s.focus && s.focus.type === 'case' ? s.focus.id : null;
    F.cases.forEach(function (c, i) {
      var x1 = tToX(c.start, m), x2 = tToX(c.end || sp.b, m);
      var y = 6 + (i % 3) * 4;
      var bar = svg('rect', { x: x1, y: y, width: Math.max(3, x2 - x1), height: 5, rx: 2.5, 'data-case': c.id,
        class: 'ob-tl-case ob-tl-' + c.status + (focus === c.id ? ' on' : '') + (focus && focus !== c.id ? ' dim' : '') });
      var tt = svg('title'); tt.textContent = c.id + ' ' + c.name + '：' + (L.caseStatus[c.status] || c.status) + '（点一下聚焦）';
      bar.appendChild(tt);
      T.svg.appendChild(bar);
    });
    // activity: runs started per bucket
    var B = Math.max(24, Math.floor((T.w - LEFT - RIGHT) / 7));
    var buckets = new Array(B).fill(0), max = 1;
    F.runs.forEach(function (r) {
      if (focus && r.caseId !== focus) return;
      var k = Math.min(B - 1, Math.floor((r.start - sp.a) / (sp.b - sp.a) * B));
      buckets[k] += 1; max = Math.max(max, buckets[k]);
    });
    var bw = (T.w - LEFT - RIGHT) / B;
    buckets.forEach(function (v, k) {
      if (!v) return;
      var hh = 3 + 14 * v / max;
      T.svg.appendChild(svg('rect', { x: LEFT + k * bw + 0.5, y: 40 - hh, width: Math.max(1, bw - 1), height: hh, class: 'ob-tl-act' }));
    });
    // events: gate results, channel trouble, rule versions, the person's actions
    var mark = function (t, cls, tip) {
      var x = tToX(t, m);
      var d = svg('path', { d: 'M' + x + ' 45 l4 4 -4 4 -4 -4z', class: 'ob-tl-ev ' + cls });
      var tt = svg('title'); tt.textContent = U.fmtClock(t) + ' ' + tip; d.appendChild(tt);
      T.svg.appendChild(d);
    };
    F.gateEvents.forEach(function (g) {
      if (focus && g.caseId !== focus) return;
      if (g.result !== 'pass') mark(g.at, g.result === 'fail' ? 'fail' : 'esc', HUB.model.name('gate', g.gateId) + (g.result === 'fail' ? ' 打回' : ' 上报'));
    });
    F.channelEvents.forEach(function (e) { if (e.kind === 'outage' || e.kind === 'quota') mark(e.at, 'ch', HUB.model.name('channel', e.channelId) + '：' + (e.note || '故障')); });
    F.versionEvents.forEach(function (v) { mark(v.at, 'ver', '编排改为 ' + v.version + '：' + (v.note || '')); });
    (F.actions || []).forEach(function (act) { mark(act.at, 'act', '你的操作：' + (act.text || act.kind)); });
    // the cut
    if (s.time != null) {
      var cx = tToX(s.time, m);
      T.svg.appendChild(svg('rect', { x: cx, y: 0, width: Math.max(0, T.w - RIGHT - cx), height: H, class: 'ob-tl-future' }));
      T.svg.appendChild(svg('line', { x1: cx, x2: cx, y1: 0, y2: H, class: 'ob-tl-cut' }));
    }
  }

  /* ---------- replay: move the cut through a case (or the whole span) ---------- */
  function replay(caseId) {
    stopReplay();
    var m = HUB.model.current, s = HUB.store.get();
    caseId = caseId || (s.focus && s.focus.type === 'case' ? s.focus.id : null);
    var c = caseId ? m.idx.case.get(caseId) : null;
    var a = c ? c.start - 60000 : 0;
    var runs = c ? (m.idx.runsByCase.get(c.id) || []) : m.facts.runs;
    var b = c ? Math.max(c.end || 0, runs.reduce(function (x, r) { return Math.max(x, r.end); }, 0)) + 60000 : m.facts.span.end;
    if (c && !(s.focus && s.focus.id === c.id)) HUB.store.set({ focus: { type: 'case', id: c.id }, instanceId: c.id, subject: s.subject === 'exec' ? 'org' : s.subject, depth: { org: Math.max(2, s.depth.org) } });
    var DURATION = c ? 16000 : 30000;
    var t0 = performance.now(), lastPush = 0;
    T.replay = { caseId: caseId, stop: false };
    var step = function (now) {
      if (!T.replay || T.replay.stop) return;
      var p = Math.min(1, (now - t0) / DURATION);
      if (now - lastPush > 90 || p >= 1) {
        lastPush = now;
        HUB.store.set({ time: p >= 1 ? null : Math.round(a + (b - a) * p) }, { history: false });
      }
      if (p < 1) T.replay.raf = requestAnimationFrame(step);
      else { T.replay = null; HUB.store.set({ time: null }, { history: false }); }
    };
    T.replay.raf = requestAnimationFrame(step);
  }
  function stopReplay() {
    if (!T.replay) return;
    T.replay.stop = true;
    cancelAnimationFrame(T.replay.raf);
    T.replay = null;
  }
  function toggleReplay() { if (T.replay) { stopReplay(); HUB.obs.render(); } else replay(); }
  function replayButton(s) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'ob-ibtn' + (T.replay ? ' on' : '');
    var c = s.focus && s.focus.type === 'case' ? s.focus.id : null;
    b.title = T.replay ? '停止回放（空格）' : (c ? '按时间回放案例 ' + c + '：谁在什么时候干活、交接给了谁（空格）' : '按时间回放全部运行（空格）');
    b.textContent = T.replay ? '■ 停止回放' : '▶ 回放' + (c ? ' ' + c : '');
    b.onclick = toggleReplay;
    return b;
  }

  HUB.obsTimeline = { mount: mount, update: update, replay: replay, stop: stopReplay, toggleReplay: toggleReplay, replayButton: replayButton, playing: function () { return !!T.replay; } };
})();
