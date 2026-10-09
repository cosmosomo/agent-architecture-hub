/* HUB.obsStage: the observation layer inside the original canvas.
   Renders a scene (frames, cards, links) keyed by data-key, tweens everything from where it is to where it should be,
   and moves the camera through the original page's own pan/zoom (scale, panX, panY, zastTransf). */
(function () {
  'use strict';
  var HUB = (window.HUB = window.HUB || {});
  var DUR = 560;
  var SVGNS = 'http://www.w3.org/2000/svg';
  var LINK_COLORS = ['task', 'info', 'watch', 'channel', 'factonly', 'hl', 'flow', 'fail', 'esc', 'muted'];

  var S = {
    root: null, frameLayer: null, cardLayer: null, svg: null, gLinks: null, gParts: null,
    frames: new Map(), cards: new Map(), links: new Map(),
    scene: null, cancel: null, camCancel: null, handlers: {}, hoverKey: null, uid: 0, sel: null
  };

  function svgEl(t, at) { var e = document.createElementNS(SVGNS, t); if (at) Object.keys(at).forEach(function (k) { e.setAttribute(k, at[k]); }); return e; }
  function reduced() { return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; }

  /* ---------- mount ---------- */
  function mount(container, handlers) {
    S.handlers = handlers || {};
    var root = document.createElement('div');
    root.id = 'obsT';
    root.className = 'cv-transform ob-layer';
    root.style.transform = cvT.style.transform;
    S.frameLayer = document.createElement('div'); S.frameLayer.className = 'ob-frames';
    S.svg = svgEl('svg', { class: 'ob-svg', width: '1', height: '1' });
    var defs = svgEl('defs');
    LINK_COLORS.forEach(function (k) {
      var mk = svgEl('marker', { id: 'ob-arr-' + k, viewBox: '0 0 10 10', refX: '8.5', refY: '5', markerWidth: '7', markerHeight: '7', orient: 'auto-start-reverse', markerUnits: 'userSpaceOnUse' });
      mk.appendChild(svgEl('path', { d: 'M1 1.5 L9 5 L1 8.5 z', class: 'ob-mk ob-mk-' + k }));
      defs.appendChild(mk);
    });
    var glow = svgEl('filter', { id: 'ob-glow', x: '-50%', y: '-50%', width: '200%', height: '200%' });
    glow.appendChild(svgEl('feGaussianBlur', { stdDeviation: '2.5', result: 'b' }));
    var mg = svgEl('feMerge'); mg.appendChild(svgEl('feMergeNode', { in: 'b' })); mg.appendChild(svgEl('feMergeNode', { in: 'SourceGraphic' }));
    glow.appendChild(mg);
    defs.appendChild(glow);
    S.svg.appendChild(defs);
    S.gLinks = svgEl('g', { class: 'ob-links' });
    S.gParts = svgEl('g', { class: 'ob-parts' });
    S.svg.appendChild(S.gLinks);
    S.svg.appendChild(S.gParts);
    S.cardLayer = document.createElement('div'); S.cardLayer.className = 'ob-cards';
    root.appendChild(S.frameLayer);
    root.appendChild(S.svg);
    root.appendChild(S.cardLayer);
    container.appendChild(root);
    S.root = root;
    root.addEventListener('click', onClick);
    root.addEventListener('dblclick', onDbl);
    root.addEventListener('mouseover', onOver);
    root.addEventListener('mouseout', onOut);
    return root;
  }

  /* ---------- render ---------- */
  // opts.instant: no tween (first paint, different case)
  function render(scene, opts) {
    opts = opts || {};
    var instant = !!opts.instant || reduced();
    if (S.cancel) { S.cancel(); S.cancel = null; finishExits(); }
    var prevLive = liveSnapshot();
    var tracks = [];
    var seen = {};

    var anchorFrom = function (anchors) {
      for (var i = 0; i < (anchors || []).length; i++) { var g = prevLive.get(anchors[i]); if (g) return g; }
      return null;
    };
    var anchorTo = function (anchors) {
      for (var i = 0; i < (anchors || []).length; i++) {
        var k = anchors[i];
        var o = scene._byKey.get(k);
        if (o) return o;
      }
      return null;
    };
    scene._byKey = new Map();
    scene.cards.forEach(function (c) { scene._byKey.set(c.key, c); });
    scene.frames.forEach(function (f) { scene._byKey.set(f.key, f); });

    /* frames */
    scene.frames.forEach(function (f) {
      seen[f.key] = true;
      var rec = S.frames.get(f.key);
      if (!rec) {
        var el = document.createElement('div');
        el.setAttribute('data-key', f.key);
        S.frameLayer.appendChild(el);
        var from = anchorFrom(f.anchor);
        rec = { key: f.key, el: el, g: from ? { x: from.x, y: from.y, w: from.w, h: from.h, o: 0 } : { x: f.x, y: f.y, w: f.w, h: f.h, o: 0 } };
        S.frames.set(f.key, rec);
      }
      rec.exiting = false;
      rec.obj = f;
      paintFrame(rec, f);
      tracks.push({ rec: rec, kind: 'frame', a: copy(rec.g), b: { x: f.x, y: f.y, w: f.w, h: f.h, o: 1 } });
    });
    /* cards */
    scene.cards.forEach(function (c) {
      seen[c.key] = true;
      var rec = S.cards.get(c.key);
      if (!rec) {
        var el = document.createElement('div');
        el.setAttribute('data-key', c.key);
        S.cardLayer.appendChild(el);
        var from = anchorFrom(c.anchor);
        rec = { key: c.key, el: el, g: from ? { x: from.x + from.w / 2 - c.w / 2, y: from.y + from.h / 2 - c.h / 2, w: c.w, h: c.h, o: 0 } : { x: c.x, y: c.y, w: c.w, h: c.h, o: 0 } };
        S.cards.set(c.key, rec);
      }
      rec.exiting = false;
      rec.obj = c;
      paintCard(rec, c);
      tracks.push({ rec: rec, kind: 'card', a: copy(rec.g), b: { x: c.x, y: c.y, w: c.w, h: c.h, o: 1 } });
    });
    /* leaving */
    [S.frames, S.cards].forEach(function (map, mi) {
      map.forEach(function (rec, key) {
        if (seen[key]) return;
        var to = anchorTo(rec.obj && rec.obj.anchor);
        var g = rec.g;
        var b = to ? (mi === 0 ? { x: to.x, y: to.y, w: to.w, h: to.h, o: 0 } : { x: to.x + to.w / 2 - g.w / 2, y: to.y + to.h / 2 - g.h / 2, w: g.w, h: g.h, o: 0 })
          : { x: g.x, y: g.y, w: g.w, h: g.h, o: 0 };
        rec.exiting = true;
        rec.el.classList.add('ob-leaving');
        tracks.push({ rec: rec, kind: mi === 0 ? 'frame' : 'card', a: copy(g), b: b, exit: true });
      });
    });

    /* links */
    var keepL = {};
    scene.links.forEach(function (l) {
      keepL[l.key] = true;
      var rec = S.links.get(l.key);
      var isNew = !rec;
      if (!rec) {
        S.uid += 1;
        var g = svgEl('g', { 'data-lkey': l.key });
        var hit = svgEl('path', { class: 'ob-hit' });
        var p = svgEl('path', { class: 'ob-p', id: 'obp' + S.uid });
        var lab = svgEl('g', { class: 'ob-lab' });
        lab.appendChild(svgEl('rect', { rx: '7', ry: '7', height: '14' }));
        var tx = svgEl('text', { y: '10.5', 'text-anchor': 'middle' });
        lab.appendChild(tx);
        var title = svgEl('title');
        g.appendChild(hit); g.appendChild(p); g.appendChild(lab); g.appendChild(title);
        S.gLinks.appendChild(g);
        rec = { key: l.key, el: g, path: p, hit: hit, lab: lab, text: tx, title: title, pid: 'obp' + S.uid, parts: [] };
        S.links.set(l.key, rec);
      }
      rec.obj = l;
      paintLink(rec, l, isNew && !instant);
    });
    S.links.forEach(function (rec, key) {
      if (keepL[key]) return;
      rec.parts.forEach(function (c) { c.remove(); });
      rec.el.remove();
      S.links.delete(key);
    });
    laneLinks(scene.links);

    S.scene = scene;
    var frame = function (p) {
      tracks.forEach(function (t) {
        var g = lerp(t.a, t.b, p);
        t.rec.g = g;
        place(t.rec, t.kind, g);
      });
      drawLinks(p);
    };
    var done = function () {
      S.cancel = null;
      finishExits();
      S.links.forEach(function (rec) { rec.el.classList.remove('ob-entering'); });
      drawLinks(1);
    };
    if (instant) { frame(1); done(); }
    else S.cancel = tween(DUR, frame, done);
    applyDecor();
  }

  function finishExits() {
    [S.frames, S.cards].forEach(function (map) {
      map.forEach(function (rec, key) { if (rec.exiting) { rec.el.remove(); map.delete(key); } });
    });
  }
  function liveSnapshot() {
    var m = new Map();
    S.frames.forEach(function (rec, k) { if (!rec.exiting) m.set(k, rec.g); });
    S.cards.forEach(function (rec, k) { if (!rec.exiting) m.set(k, rec.g); });
    return m;
  }
  function copy(g) { return { x: g.x, y: g.y, w: g.w, h: g.h, o: g.o == null ? 1 : g.o }; }
  function lerp(a, b, p) { return { x: a.x + (b.x - a.x) * p, y: a.y + (b.y - a.y) * p, w: a.w + (b.w - a.w) * p, h: a.h + (b.h - a.h) * p, o: a.o + (b.o - a.o) * p }; }
  function place(rec, kind, g) {
    var st = rec.el.style;
    st.transform = 'translate(' + g.x.toFixed(1) + 'px,' + g.y.toFixed(1) + 'px)';
    if (kind === 'frame' || rec.sized) { st.width = g.w.toFixed(1) + 'px'; st.height = g.h.toFixed(1) + 'px'; }
    st.opacity = g.o < 0.999 ? g.o.toFixed(3) : '';
  }

  /* ---------- painting ---------- */
  function paintFrame(rec, f) {
    var out = HUB.obsCards.frame(f);
    if (rec.sig !== out.sig) { rec.el.innerHTML = out.html; rec.sig = out.sig; }
    rec.el.className = 'ob-frame ' + out.cls + (f.dim ? ' ob-dim' : '');
    if (out.style) Object.keys(out.style).forEach(function (k) { rec.el.style.setProperty(k, out.style[k]); });
  }
  function paintCard(rec, c) {
    var out = HUB.obsCards.card(c);
    if (rec.sig !== out.sig) { rec.el.innerHTML = out.html; rec.sig = out.sig; }
    rec.el.className = out.cls + (c.dim ? ' ob-dim' : '');
    rec.sized = !!out.sized;
    if (out.style) Object.keys(out.style).forEach(function (k) { rec.el.style.setProperty(k, out.style[k]); });
  }
  function paintLink(rec, l, entering) {
    var cls = 'ob-link ob-t-' + l.type + ' ob-s-' + l.state + (l.hl ? ' ob-hl' : '') + (l.dim ? ' ob-ldim' : '') + (entering ? ' ob-entering' : '');
    rec.el.setAttribute('class', cls);
    var w = l.state === 'def' ? 1.4 : l.state === 'defonly' ? 1.2 : 1.3 + 3.2 * (l.weight || 0);
    rec.path.setAttribute('stroke-width', w.toFixed(2));
    var mk = l.hl ? 'hl' : l.state === 'defonly' ? 'muted' : l.type;
    rec.path.setAttribute('marker-end', 'url(#ob-arr-' + mk + ')');
    rec.lab.style.display = l.label ? '' : 'none';
    if (l.label) {
      rec.text.textContent = l.label;
      var tw = Math.max(16, l.label.length * 6.4 + 10);
      var r = rec.lab.firstChild;
      r.setAttribute('width', tw.toFixed(0)); r.setAttribute('x', (-tw / 2).toFixed(0));
    }
    rec.title.textContent = l.tip || '';
    // particles: little packets travelling along links that really carried work
    var want = reduced() ? 0 : (l.particles || 0);
    while (rec.parts.length > want) rec.parts.pop().remove();
    while (rec.parts.length < want) {
      var i = rec.parts.length;
      var c = svgEl('circle', { r: l.hl ? '3.6' : '2.6', class: 'ob-pt ob-pt-' + (l.hl ? 'hl' : l.type) });
      var am = svgEl('animateMotion', { dur: (l.hl ? 1.6 : 2.8) + i * 0.9 + 's', repeatCount: 'indefinite', begin: (-i * 1.1) + 's' });
      var mp = svgEl('mpath');
      mp.setAttributeNS('http://www.w3.org/1999/xlink', 'href', '#' + rec.pid);
      mp.setAttribute('href', '#' + rec.pid);
      am.appendChild(mp);
      c.appendChild(am);
      S.gParts.appendChild(c);
      rec.parts.push(c);
    }
    rec.parts.forEach(function (c) {
      c.setAttribute('class', 'ob-pt ob-pt-' + (l.hl ? 'hl' : l.type));
      c.setAttribute('r', l.hl ? '3.6' : '2.6');
      if (l.hl) c.setAttribute('filter', 'url(#ob-glow)'); else c.removeAttribute('filter');
    });
  }

  // parallel links between the same two cards get separate lanes so they do not overlap
  function laneLinks(links) {
    var groups = {};
    links.forEach(function (l) {
      var k = l.from < l.to ? l.from + '~' + l.to : l.to + '~' + l.from;
      (groups[k] = groups[k] || []).push(l);
    });
    Object.keys(groups).forEach(function (k) {
      var g = groups[k];
      g.forEach(function (l, i) {
        var lane = i - (g.length - 1) / 2;
        // a reversed link sees the lane mirrored; flip so lanes stay apart on screen
        l._lane = l.from < l.to ? lane : -lane;
      });
    });
  }

  /* ---------- link geometry ---------- */
  function geomOf(key) {
    var r = S.cards.get(key) || S.frames.get(key);
    return r && !r.exiting ? r.g : null;
  }
  function drawLinks(p) {
    S.links.forEach(function (rec) {
      var l = rec.obj;
      var a = geomOf(l.from), b = geomOf(l.to);
      if (!a || !b) { rec.el.style.display = 'none'; return; }
      rec.el.style.display = '';
      var d = route(a, b, l._lane || 0, l.route);
      rec.path.setAttribute('d', d.path);
      rec.hit.setAttribute('d', d.path);
      if (l.label) rec.lab.setAttribute('transform', 'translate(' + d.mx.toFixed(1) + ',' + (d.my - 7).toFixed(1) + ')');
      if (rec.el.classList.contains('ob-entering')) rec.el.style.opacity = String(Math.min(1, p * 1.5));
      else rec.el.style.opacity = '';
    });
  }
  // A cubic curve between two boxes, leaving and entering through the sides that face each other.
  function route(a, b, lane, kind) {
    var ax = a.x + a.w / 2, ay = a.y + a.h / 2, bx = b.x + b.w / 2, by = b.y + b.h / 2;
    var dx = bx - ax, dy = by - ay;
    var off = lane * 12;
    var p0, p3, c1, c2, vertical;
    if (kind === 'loop-down') {
      // a return arc that dips under both boxes (used for "fail → back to an earlier stage")
      var low = Math.max(a.y + a.h, b.y + b.h) + 46 + Math.abs(off);
      p0 = { x: ax + off, y: a.y + a.h }; p3 = { x: bx - off, y: b.y + b.h };
      c1 = { x: p0.x, y: low }; c2 = { x: p3.x, y: low };
    } else if (kind === 'loop-up') {
      var high = Math.min(a.y, b.y) - 46 - Math.abs(off);
      p0 = { x: ax + off, y: a.y }; p3 = { x: bx - off, y: b.y };
      c1 = { x: p0.x, y: high }; c2 = { x: p3.x, y: high };
    } else {
      vertical = Math.abs(dy) > Math.abs(dx) * 0.55 && Math.abs(dy) > (a.h + b.h) / 2;
      if (vertical) {
        var down = dy > 0;
        p0 = { x: ax + off, y: down ? a.y + a.h : a.y };
        p3 = { x: bx + off, y: down ? b.y : b.y + b.h };
        var k = Math.max(28, Math.abs(p3.y - p0.y) * 0.45);
        c1 = { x: p0.x, y: p0.y + (down ? k : -k) };
        c2 = { x: p3.x, y: p3.y - (down ? k : -k) };
      } else {
        var right = dx > 0;
        p0 = { x: right ? a.x + a.w : a.x, y: ay + off };
        p3 = { x: right ? b.x : b.x + b.w, y: by + off };
        var k2 = Math.max(28, Math.abs(p3.x - p0.x) * 0.45);
        c1 = { x: p0.x + (right ? k2 : -k2), y: p0.y };
        c2 = { x: p3.x - (right ? k2 : -k2), y: p3.y };
      }
    }
    var f = function (v) { return v.toFixed(1); };
    var mx = (p0.x + 3 * c1.x + 3 * c2.x + p3.x) / 8, my = (p0.y + 3 * c1.y + 3 * c2.y + p3.y) / 8;
    return { path: 'M' + f(p0.x) + ',' + f(p0.y) + ' C' + f(c1.x) + ',' + f(c1.y) + ' ' + f(c2.x) + ',' + f(c2.y) + ' ' + f(p3.x) + ',' + f(p3.y), mx: mx, my: my };
  }

  /* ---------- decoration: selection and hover, without re-rendering ---------- */
  function setSelection(sel) { S.sel = sel; applyDecor(); }
  function sameSel(a, b) { return a && b && a.type === b.type && a.id === b.id; }
  function applyDecor() {
    var sel = S.sel;
    var selKeys = {};
    S.cards.forEach(function (rec, k) {
      var on = !!(sel && rec.obj && sameSel(rec.obj.sel, sel));
      rec.el.classList.toggle('sel', on);
      if (on) selKeys[k] = true;
    });
    S.frames.forEach(function (rec, k) {
      var on = !!(sel && rec.obj && sameSel(rec.obj.sel, sel));
      rec.el.classList.toggle('ob-fsel', on);
      if (on) selKeys[k] = true;
    });
    S.links.forEach(function (rec) {
      var l = rec.obj;
      var on = !!(sel && (sameSel(l.sel, sel) || selKeys[l.from] || selKeys[l.to] || (sel.type === 'relation' && l.rels && l.rels.indexOf(sel.id) >= 0)));
      rec.el.classList.toggle('ob-lsel', on);
    });
  }
  function setHover(key) {
    if (key === S.hoverKey) return;
    S.hoverKey = key;
    S.root.classList.toggle('ob-hovering', !!key);
    S.links.forEach(function (rec) {
      var l = rec.obj;
      rec.el.classList.toggle('ob-hot', !!key && (l.from === key || l.to === key));
    });
  }

  /* ---------- events ---------- */
  function hitObj(target) {
    var t = target.closest('[data-toggle]');
    if (t && S.root.contains(t)) return { toggle: t.getAttribute('data-toggle') };
    var c = target.closest('[data-key]');
    if (c && S.root.contains(c)) {
      var key = c.getAttribute('data-key');
      var rec = S.cards.get(key) || S.frames.get(key);
      return rec ? { key: key, obj: rec.obj } : null;
    }
    var l = target.closest('[data-lkey]');
    if (l) { var lr = S.links.get(l.getAttribute('data-lkey')); return lr ? { link: lr.obj } : null; }
    return null;
  }
  function onClick(e) {
    var h = hitObj(e.target);
    if (!h) return;
    e.stopPropagation();
    if (h.toggle) { if (S.handlers.toggle) S.handlers.toggle(h.toggle); return; }
    var obj = h.obj || h.link;
    if (obj && obj.sel && S.handlers.select) S.handlers.select(obj.sel, obj);
  }
  function onDbl(e) {
    var h = hitObj(e.target);
    if (!h || h.toggle) return;
    e.stopPropagation();
    if (h.obj && S.handlers.open) S.handlers.open(h.obj);
  }
  function onOver(e) {
    var c = e.target.closest('[data-key]');
    setHover(c && S.cards.has(c.getAttribute('data-key')) ? c.getAttribute('data-key') : null);
  }
  function onOut(e) {
    var to = e.relatedTarget;
    if (!to || !S.root.contains(to) || !to.closest('[data-key]')) setHover(null);
  }

  /* ---------- camera: the original page's scale / panX / panY ---------- */
  // pad: {top, right, bottom, left} screen pixels kept free for the floating controls
  function fit(bbox, animate, pad) {
    if (!bbox || !(bbox.w > 0)) return;
    pad = pad || { top: 70, right: 40, bottom: 150, left: 40 };
    var cw = cvA.clientWidth, ch = cvA.clientHeight;
    if (!cw || !ch) return;
    var aw = Math.max(80, cw - pad.left - pad.right), ah = Math.max(80, ch - pad.top - pad.bottom);
    var k = Math.max(0.15, Math.min(1.15, aw / bbox.w, ah / bbox.h));
    var tx = pad.left + aw / 2 - (bbox.x + bbox.w / 2) * k;
    var ty = pad.top + ah / 2 - (bbox.y + bbox.h / 2) * k;
    if (S.camCancel) { S.camCancel(); S.camCancel = null; }
    if (!animate || reduced()) { scale = k; panX = tx; panY = ty; zastTransf(); return; }
    var a = { k: scale || 1, x: panX, y: panY };
    S.camCancel = tween(520, function (p) {
      scale = a.k + (k - a.k) * p; panX = a.x + (tx - a.x) * p; panY = a.y + (ty - a.y) * p;
      zastTransf();
    }, function () { S.camCancel = null; });
  }

  function tween(ms, onFrame, onDone) {
    var t0 = null, id = null, stopped = false;
    var step = function (ts) {
      if (stopped) return;
      if (t0 == null) t0 = ts;
      var p = Math.min(1, (ts - t0) / ms);
      onFrame(p < 1 ? 1 - Math.pow(1 - p, 3) : 1);
      if (p < 1) id = requestAnimationFrame(step); else if (onDone) onDone();
    };
    id = requestAnimationFrame(step);
    // a hidden tab never runs frames; finish the move right away so nothing is left half-way
    var guard = setTimeout(function () { if (!stopped && t0 == null) { stopped = true; onFrame(1); if (onDone) onDone(); } }, ms + 400);
    return function () { stopped = true; clearTimeout(guard); if (id) cancelAnimationFrame(id); };
  }

  function clear() {
    if (S.cancel) { S.cancel(); S.cancel = null; }
    [S.frames, S.cards].forEach(function (map) { map.forEach(function (rec) { rec.el.remove(); }); map.clear(); });
    S.links.forEach(function (rec) { rec.parts.forEach(function (c) { c.remove(); }); rec.el.remove(); });
    S.links.clear();
    S.scene = null;
  }
  function show(on) { if (S.root) S.root.style.display = on ? '' : 'none'; }
  function cardEl(key) { var r = S.cards.get(key); return r ? r.el : null; }
  function cardGeom(key) { return geomOf(key); }

  HUB.obsStage = { mount: mount, render: render, fit: fit, clear: clear, show: show, setSelection: setSelection,
    cardEl: cardEl, cardGeom: cardGeom, tween: tween, route: route, get scene() { return S.scene; } };
})();
