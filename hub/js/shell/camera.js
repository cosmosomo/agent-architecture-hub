/* HUB.camera: pan and zoom of the canvas.
   The world is one element that takes a translate+scale; the grid behind it follows, and the zoom label says where we are.
   Wheel zooms around the pointer, a drag on the background pans, fit() frames a bounding box in the free part of the view. */
(function () {
  'use strict';
  var HUB = (window.HUB = window.HUB || {});
  var K_MIN = 0.15, K_MAX = 3, STEP = 1.2;

  var area = null, world = null, grid = null, label = null, ignore = '';
  var view = { k: 1, x: 0, y: 0 };
  var raf = null, stop = null, listeners = [], gridSig = '', lastDrag = false;

  function reduced() { return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; }
  function clampK(k) { return Math.max(K_MIN, Math.min(K_MAX, k)); }

  function paint() {
    world.style.transform = 'translate(' + view.x + 'px,' + view.y + 'px) scale(' + view.k + ')';
    label.textContent = Math.round(view.k * 100) + '%';
    var s = Math.max(20, 40 * view.k), sig = s + '|' + (view.x % s) + '|' + (view.y % s);
    if (sig !== gridSig) { gridSig = sig; grid.style.backgroundSize = s + 'px ' + s + 'px'; grid.style.backgroundPosition = (view.x % s) + 'px ' + (view.y % s) + 'px'; }
    listeners.forEach(function (fn) { fn(view); });
  }
  // the mouse reports more often than the screen refreshes: one paint per frame
  function paintSoon() { if (raf !== null) return; raf = requestAnimationFrame(function () { raf = null; paint(); }); }

  function cancelMove() { if (stop) { stop(); stop = null; } }

  /* move to {k, x, y}; animated unless asked not to (or the user prefers no motion) */
  function go(to, animate) {
    cancelMove();
    to = { k: clampK(to.k), x: to.x, y: to.y };
    if (!animate || reduced()) { view = to; paint(); return; }
    var from = { k: view.k, x: view.x, y: view.y };
    stop = HUB.util.tween(520, function (p) {
      view = { k: from.k + (to.k - from.k) * p, x: from.x + (to.x - from.x) * p, y: from.y + (to.y - from.y) * p };
      paint();
    }, function () { stop = null; });
  }

  /* zoom by a factor, keeping the point (cx, cy) of the area where it is */
  function zoomAt(f, cx, cy) {
    var k = clampK(view.k * f), r = k / view.k;
    view = { k: k, x: cx - (cx - view.x) * r, y: cy - (cy - view.y) * r };
    paintSoon();
  }
  function zoomBy(f) { cancelMove(); zoomAt(f, area.clientWidth / 2, area.clientHeight / 2); }

  /* frame a bounding box of the world.  pad: {top, right, bottom, left}, screen pixels kept free for the floating controls */
  function fit(bbox, animate, pad) {
    if (!bbox || !(bbox.w > 0)) return;
    pad = pad || { top: 70, right: 40, bottom: 150, left: 40 };
    var cw = area.clientWidth, ch = area.clientHeight;
    if (!cw || !ch) return;
    var aw = Math.max(80, cw - pad.left - pad.right), ah = Math.max(80, ch - pad.top - pad.bottom);
    var k = Math.max(K_MIN, Math.min(1.15, aw / bbox.w, ah / bbox.h));
    go({ k: k, x: pad.left + aw / 2 - (bbox.x + bbox.w / 2) * k, y: pad.top + ah / 2 - (bbox.y + bbox.h / 2) * k }, animate);
  }

  /* screen point -> world point (for dragging things on the canvas) */
  function toWorld(clientX, clientY) {
    var r = area.getBoundingClientRect();
    return { x: (clientX - r.left - view.x) / view.k, y: (clientY - r.top - view.y) / view.k };
  }

  /* area: the canvas; worldEl: what moves; opts.ignore: a selector of the things on the canvas that keep their own mouse */
  function mount(areaEl, worldEl, opts) {
    area = areaEl; world = worldEl; ignore = (opts && opts.ignore) || '';
    grid = area.querySelector('.cv-grid');
    label = area.querySelector('.zm-lbl');
    area.addEventListener('wheel', function (e) {
      e.preventDefault(); cancelMove();
      var r = area.getBoundingClientRect();
      zoomAt(e.deltaY > 0 ? 0.92 : 1.08, e.clientX - r.left, e.clientY - r.top);
    }, { passive: false });
    var drag = null;
    area.addEventListener('mousedown', function (e) {
      if (e.button !== 0 && e.button !== 1) return;
      if (ignore && e.target.closest(ignore)) return;
      cancelMove();
      drag = { x: e.clientX, y: e.clientY, px: view.x, py: view.y, moved: false };
      e.preventDefault();
    });
    document.addEventListener('mousemove', function (e) {
      if (!drag) return;
      var dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true;
      view = { k: view.k, x: drag.px + dx, y: drag.py + dy };
      paintSoon();
    });
    // a drag that moved is not a click: whoever clears a selection on click asks wasDrag()
    document.addEventListener('mouseup', function () { if (drag) { lastDrag = drag.moved; drag = null; setTimeout(function () { lastDrag = false; }, 0); } });
    area.querySelector('[data-zoom="in"]').addEventListener('click', function () { zoomBy(STEP); });
    area.querySelector('[data-zoom="out"]').addEventListener('click', function () { zoomBy(1 / STEP); });
    area.querySelector('[data-zoom="reset"]').addEventListener('click', function () { go({ k: 1, x: 0, y: 0 }, true); });
    paint();
  }

  var api = {
    mount: mount, fit: fit, go: go, zoomBy: zoomBy, toWorld: toWorld, wasDrag: function () { return lastDrag; },
    get: function () { return { k: view.k, x: view.x, y: view.y }; },
    onChange: function (fn) { listeners.push(fn); }
  };
  HUB.camera = api;
})();
