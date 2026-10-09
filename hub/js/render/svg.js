/* HUB.svgkit: SVG stage with pan/zoom, arrow markers, path helpers and a frame tween. */
(function () {
  'use strict';
  var HUB = (window.HUB = window.HUB || {});
  var S = function (t, a) { return HUB.util.svg(t, a); };

  var MARKERS = [
    ['task', '--c-task'], ['info', '--c-info'], ['watch', '--c-watch'], ['channel', '--c-channel'],
    ['factonly', '--c-factonly'], ['hl', '--hl'], ['gate', '--c-gate'], ['muted', '--ink-3']
  ];

  /* createStage(container) -> { svg, defs, root, layers, pz } */
  function createStage(container, opts) {
    opts = opts || {};
    var svg = S('svg', { class: 'svgk-stage', width: '100%', height: '100%' });
    var defs = S('defs');
    MARKERS.forEach(function (m) {
      var mk = S('marker', { id: 'arr-' + m[0] + (opts.idSuffix || ''), viewBox: '0 0 10 10', refX: '9', refY: '5', markerWidth: '7', markerHeight: '7', orient: 'auto-start-reverse', markerUnits: 'userSpaceOnUse' });
      mk.appendChild(S('path', { d: 'M1 1 L9 5 L1 9 z', style: 'fill: var(' + m[1] + ')' }));
      defs.appendChild(mk);
    });
    svg.appendChild(defs);
    var bg = S('rect', { class: 'svgk-bg', x: '-100000', y: '-100000', width: '200000', height: '200000', fill: 'transparent' });
    var root = S('g', { class: 'svgk-root' });
    svg.appendChild(bg);
    svg.appendChild(root);
    var layers = {};
    ['groups', 'edges', 'nodes', 'labels', 'overlay'].forEach(function (k) { layers[k] = S('g', { class: 'svgk-' + k }); root.appendChild(layers[k]); });
    container.appendChild(svg);
    var pz = panzoom(svg, root, bg);
    return { svg: svg, defs: defs, root: root, bg: bg, layers: layers, pz: pz, markerSuffix: opts.idSuffix || '' };
  }

  function panzoom(svg, root, bg) {
    var tr = { x: 0, y: 0, k: 1 };
    var apply = function () { root.setAttribute('transform', 'translate(' + tr.x + ',' + tr.y + ') scale(' + tr.k + ')'); };
    var anim = null;
    var setT = function (t, animate) {
      if (anim) { cancelAnimationFrame(anim); anim = null; }
      if (!animate) { tr = { x: t.x, y: t.y, k: t.k }; apply(); return; }
      var from = { x: tr.x, y: tr.y, k: tr.k };
      tween(320, function (p) {
        tr = { x: from.x + (t.x - from.x) * p, y: from.y + (t.y - from.y) * p, k: from.k + (t.k - from.k) * p };
        apply();
      });
    };
    svg.addEventListener('wheel', function (e) {
      e.preventDefault();
      var r = svg.getBoundingClientRect();
      var mx = e.clientX - r.left, my = e.clientY - r.top;
      var f = Math.exp(-e.deltaY * 0.0015);
      var k = Math.max(0.15, Math.min(4, tr.k * f));
      f = k / tr.k;
      tr = { x: mx - (mx - tr.x) * f, y: my - (my - tr.y) * f, k: k };
      apply();
    }, { passive: false });
    // Drag the background (or any element with class svgk-pan, such as a group box) to pan.
    // The pointer is captured only once it really moves, so a plain click still reaches the element under it.
    var drag = null, suppressClick = false;
    svg.addEventListener('pointerdown', function (e) {
      if (e.button !== 0) return;
      var t = e.target;
      var isBg = t === svg || t === bg;
      if (!isBg && !(t.classList && t.classList.contains('svgk-pan'))) return;
      drag = { x: e.clientX, y: e.clientY, tx: tr.x, ty: tr.y, moved: false, id: e.pointerId, bg: isBg };
    });
    svg.addEventListener('pointermove', function (e) {
      if (!drag) return;
      if (!(e.buttons & 1)) { drag = null; svg.classList.remove('svgk-dragging'); return; }
      var dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (!drag.moved && Math.abs(dx) + Math.abs(dy) > 3) {
        drag.moved = true;
        try { svg.setPointerCapture(drag.id); } catch (err) { /* pointer already gone */ }
        svg.classList.add('svgk-dragging');
      }
      if (!drag.moved) return;
      tr = { x: drag.tx + dx, y: drag.ty + dy, k: tr.k };
      apply();
    });
    var end = function () {
      if (!drag) return;
      var d = drag;
      drag = null;
      svg.classList.remove('svgk-dragging');
      if (d.moved) { suppressClick = true; setTimeout(function () { suppressClick = false; }, 0); }
      else if (d.bg) svg.dispatchEvent(new CustomEvent('svgk-bgclick'));
    };
    svg.addEventListener('pointerup', end);
    svg.addEventListener('pointercancel', end);
    svg.addEventListener('click', function (e) { if (suppressClick) { suppressClick = false; e.stopPropagation(); } }, true);
    apply();
    return {
      get: function () { return { x: tr.x, y: tr.y, k: tr.k }; },
      set: setT,
      fit: function (box, pad, animate) {
        if (!box || !isFinite(box.x) || box.w <= 0 || box.h <= 0) return;
        pad = pad == null ? 40 : pad;
        var r = svg.getBoundingClientRect();
        var W = r.width || 800, H = r.height || 600;
        var k = Math.min((W - pad * 2) / box.w, (H - pad * 2) / box.h, 1.6);
        k = Math.max(0.15, k);
        setT({ k: k, x: W / 2 - (box.x + box.w / 2) * k, y: H / 2 - (box.y + box.h / 2) * k }, animate);
      },
      zoomBy: function (f) {
        var r = svg.getBoundingClientRect();
        var mx = r.width / 2, my = r.height / 2;
        var k = Math.max(0.15, Math.min(4, tr.k * f));
        f = k / tr.k;
        setT({ x: mx - (mx - tr.x) * f, y: my - (my - tr.y) * f, k: k }, true);
      },
      // screen point -> content point
      toContent: function (sx, sy) { return { x: (sx - tr.x) / tr.k, y: (sy - tr.y) / tr.k }; }
    };
  }

  /* tween(ms, onFrame(p 0..1), onDone) with ease-out; returns cancel() */
  function tween(ms, onFrame, onDone) {
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce || ms <= 0) { onFrame(1); if (onDone) onDone(); return function () {}; }
    var t0 = null, id = null, stopped = false;
    var step = function (ts) {
      if (stopped) return;
      if (t0 == null) t0 = ts;
      var p = Math.min(1, (ts - t0) / ms);
      var e = 1 - Math.pow(1 - p, 3);
      onFrame(e);
      if (p < 1) id = requestAnimationFrame(step); else if (onDone) onDone();
    };
    id = requestAnimationFrame(step);
    return function () { stopped = true; if (id) cancelAnimationFrame(id); };
  }

  /* Curved edge between two points, shortened to stop at node borders. */
  function edgePath(x1, y1, x2, y2, bend, r1, r2) {
    var dx = x2 - x1, dy = y2 - y1;
    var len = Math.sqrt(dx * dx + dy * dy) || 1;
    var ux = dx / len, uy = dy / len;
    var sx = x1 + ux * (r1 || 0), sy = y1 + uy * (r1 || 0);
    var ex = x2 - ux * (r2 || 0), ey = y2 - uy * (r2 || 0);
    var b = bend == null ? 0.12 : bend;
    var mx = (sx + ex) / 2 - uy * len * b, my = (sy + ey) / 2 + ux * len * b;
    return 'M' + r(sx) + ',' + r(sy) + ' Q' + r(mx) + ',' + r(my) + ' ' + r(ex) + ',' + r(ey);
  }
  function r(v) { return Math.round(v * 10) / 10; }

  /* Distance from rectangle centre to its border along a direction (for arrow ends). */
  function rectRadius(w, h, dx, dy) {
    var ax = Math.abs(dx), ay = Math.abs(dy);
    if (ax < 1e-6 && ay < 1e-6) return 0;
    var tx = ax > 1e-6 ? (w / 2) / ax : Infinity, ty = ay > 1e-6 ? (h / 2) / ay : Infinity;
    var t = Math.min(tx, ty);
    return t * Math.sqrt(dx * dx + dy * dy);
  }

  function strokeWidth(count, max) {
    if (!count) return 1.2;
    var m = Math.max(1, max || 1);
    return 1.2 + 3.8 * Math.log(1 + count) / Math.log(1 + m);
  }

  HUB.svgkit = { createStage: createStage, tween: tween, edgePath: edgePath, rectRadius: rectRadius, strokeWidth: strokeWidth };
})();
