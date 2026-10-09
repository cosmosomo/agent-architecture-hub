/* ①②③ The org subject: individuals and their groups, four kinds of lines, fold/unfold, case focus and the case lanes. */
(function () {
  'use strict';
  var HUB = (window.HUB = window.HUB || {});
  var U = HUB.util, L = U.LABELS;

  var NW = 140, NH = 46, GP = 12, GT = 28, GY = 10, COLGAP = 92, FW = 184, FH = 66;
  var SUBP = 8, SUBT = 24, FSW = 156, FSH = 52, HW = 124, HH = 42, CHW = 132, CHH = 34;
  var MAXH = 7 * (NH + GY), ROWGAP = 84;
  var BEND = { task: 0.1, info: 0.24, watch: -0.16, channel: 0.05, factonly: 0.32 };
  var DUR = 360;

  /* ---------- ranks: how far along the flow each individual sits ---------- */
  function computeRanks(m) {
    var out = {};
    m.def.relations.forEach(function (r) {
      if (r.type !== 'task' || r.sub === 'report') return;
      (out[r.from] = out[r.from] || []).push(r.to);
    });
    var color = {}, back = {};
    var dfs = function (u) {
      color[u] = 1;
      (out[u] || []).forEach(function (v) {
        if (color[v] === 1) back[u + '>' + v] = true;
        else if (!color[v]) dfs(v);
      });
      color[u] = 2;
    };
    dfs('human');
    m.def.individuals.forEach(function (x) { if (!color[x.id]) dfs(x.id); });
    var indeg = {}, rank = {};
    m.def.individuals.forEach(function (x) { indeg[x.id] = 0; rank[x.id] = 0; });
    Object.keys(out).forEach(function (u) { out[u].forEach(function (v) { if (!back[u + '>' + v] && v in indeg) indeg[v] += 1; }); });
    var q = Object.keys(indeg).filter(function (k) { return indeg[k] === 0; });
    while (q.length) {
      var u = q.shift();
      (out[u] || []).forEach(function (v) {
        if (back[u + '>' + v] || !(v in indeg)) return;
        rank[v] = Math.max(rank[v], rank[u] + 1);
        indeg[v] -= 1;
        if (indeg[v] === 0) q.push(v);
      });
    }
    return rank;
  }

  /* ---------- layout (pure) ---------- */
  // view = {w, h} of the drawing area: departments wrap into rows so the drawing keeps a readable scale.
  function layout(m, s, a, view) {
    view = view || { w: 1300, h: 700 };
    var idx = m.idx, def = m.def;
    var rk = computeRanks(m);
    var open = function (g) { return HUB.store.isOpen('org', g.id, g.level, s); };
    var indOrder = function (ids) {
      return ids.slice().sort(function (p, q) {
        var a1 = rk[p] || 0, b1 = rk[q] || 0;
        if (a1 !== b1) return a1 - b1;
        return (idx.ind.get(p).x || 0) - (idx.ind.get(q).x || 0);
      });
    };
    var groupRank = function (g) {
      var mem = idx.membersDeep.get(g.id) || [];
      if (!mem.length) return 999;
      var rs = mem.map(function (id) { return rk[id] || 0; }).sort(function (p, q) { return p - q; });
      return rs[Math.floor((rs.length - 1) / 2)] + rs[0] * 0.01;
    };
    var tops = def.groups.filter(function (g) { return !g.parentId; }).sort(function (g1, g2) {
      var d = groupRank(g1) - groupRank(g2);
      return d !== 0 ? d : g1.order - g2.order;
    });

    var nodes = new Map(), boxes = new Map(), repPos = {};
    var put = function (n) { nodes.set(n.key, n); };
    // compare='fact' draws only what happened: individuals never dispatched are left out
    var hidden = function (id) { return s.compare === 'fact' && a.indStats[id] && a.indStats[id].status === 'never'; };
    var shown = function (ids) { return ids.filter(function (id) { return !hidden(id); }); };

    /* one block per department, in local coordinates (origin at the block's top-left) */
    var blocks = [];
    tops.forEach(function (G) {
      if (!shown(idx.membersDeep.get(G.id) || []).length) return;
      if (!open(G)) {
        blocks.push({ w: FW, h: FH, nodes: [{ key: 'g:' + G.id, kind: 'fold', id: G.id, level: 1, x: FW / 2, y: FH / 2, w: FW, h: FH }], boxes: [] });
        return;
      }
      var bl = { nodes: [], boxes: [] };
      // items: direct members and sub-groups, ordered along the flow
      var items = [];
      G.children.forEach(function (cid) {
        var SG = idx.group.get(cid);
        if (!SG) return;
        var mem = indOrder(shown(idx.membersDeep.get(SG.id) || []));
        if (!mem.length) return;
        if (open(SG)) items.push({ kind: 'sub', g: SG, mem: mem, w: NW + SUBP * 2, h: SUBT + mem.length * NH + Math.max(0, mem.length - 1) * GY + SUBP, r: rk[mem[0]] || 0 });
        else items.push({ kind: 'subfold', g: SG, mem: mem, w: FSW, h: FSH, r: rk[mem[0]] || 0 });
      });
      indOrder(shown(G.members)).forEach(function (id) { items.push({ kind: 'ind', id: id, w: NW, h: NH, r: rk[id] || 0 }); });
      items.sort(function (p, q) { return p.r - q.r; });
      // stack into sub-columns no taller than MAXH
      var cols = [[]], hcur = 0;
      items.forEach(function (it) {
        if (cols[cols.length - 1].length && hcur + it.h > MAXH) { cols.push([]); hcur = 0; }
        cols[cols.length - 1].push(it);
        hcur += it.h + GY;
      });
      var colW = cols.map(function (c) { return Math.max.apply(null, c.map(function (it) { return it.w; })); });
      var colH = cols.map(function (c) { return U.sum(c, function (it) { return it.h; }) + Math.max(0, c.length - 1) * GY; });
      var cw = U.sum(colW) + Math.max(0, cols.length - 1) * 16;
      var ch = Math.max.apply(null, colH);
      var bw = cw + GP * 2, bh = GT + ch + GP;
      bl.w = bw; bl.h = bh;
      bl.boxes.push({ key: 'b:' + G.id, id: G.id, level: 1, x: 0, y: 0, w: bw, h: bh });
      var cx = GP;
      cols.forEach(function (c, ci) {
        var yy = GT;
        c.forEach(function (it) {
          var ix = cx + (colW[ci] - it.w) / 2;
          if (it.kind === 'ind') bl.nodes.push({ key: 'i:' + it.id, kind: idx.ind.get(it.id).kind, id: it.id, x: ix + NW / 2, y: yy + NH / 2, w: NW, h: NH });
          else if (it.kind === 'subfold') bl.nodes.push({ key: 'g:' + it.g.id, kind: 'fold', id: it.g.id, level: 2, x: ix + FSW / 2, y: yy + FSH / 2, w: FSW, h: FSH });
          else {
            bl.boxes.push({ key: 'b:' + it.g.id, id: it.g.id, level: 2, x: ix, y: yy, w: it.w, h: it.h });
            var sy = yy + SUBT;
            it.mem.forEach(function (id) {
              bl.nodes.push({ key: 'i:' + id, kind: idx.ind.get(id).kind, id: id, x: ix + SUBP + NW / 2, y: sy + NH / 2, w: NW, h: NH });
              sy += NH + GY;
            });
          }
          yy += it.h + GY;
        });
        cx += colW[ci] + 16;
      });
      blocks.push(bl);
    });

    /* people column on the left: the human, and the maintainer when the channels row is hidden */
    var showHuman = s.overlays.human !== false && idx.ind.has('human');
    var maint = idx.ind.get('meta_maint');
    var showCh = !!s.overlays.channels;
    var maintLeft = !!maint && !showCh;
    var peopleW = Math.max(showHuman ? HW : 0, maintLeft ? NW : 0);
    var x0 = peopleW ? peopleW + COLGAP : 0;

    /* rows: try 1..n rows and keep the widest arrangement whose scale is close to the best one */
    var arrange = function (nRows) {
      var per = Math.max(1, Math.ceil(blocks.length / nRows)), rows = [];
      for (var i = 0; i < blocks.length; i += per) rows.push(blocks.slice(i, i + per));
      var W = 0, H = 0;
      rows.forEach(function (r) {
        W = Math.max(W, U.sum(r, function (b) { return b.w; }) + (r.length - 1) * COLGAP);
        H += Math.max.apply(null, r.map(function (b) { return b.h; }));
      });
      H = Math.max(H + Math.max(0, rows.length - 1) * ROWGAP, peopleW ? FH * 1.6 + HH : 0);
      W += x0;
      return { rows: rows, W: W, H: H, k: Math.min(1, (view.w - 96) / Math.max(1, W), (view.h - 96) / Math.max(1, H)) };
    };
    var cands = [];
    for (var nr = 1; nr <= Math.max(1, blocks.length); nr++) {
      var cand = arrange(nr);
      if (!cands.length || cand.rows.length !== cands[cands.length - 1].rows.length) cands.push(cand);
    }
    var kBest = Math.max.apply(null, cands.map(function (c) { return c.k; }));
    var best = cands.find(function (c) { return c.k >= kBest * 0.92; }) || cands[0];
    var ytop = 0, mids = [];
    best.rows.forEach(function (r) {
      var rh = Math.max.apply(null, r.map(function (b) { return b.h; }));
      var xx = x0;
      r.forEach(function (b) {
        var oy = ytop + (rh - b.h) / 2;
        b.nodes.forEach(function (n) { n.x += xx; n.y += oy; put(n); });
        b.boxes.forEach(function (bx) { bx.x += xx; bx.y += oy; boxes.set(bx.key, bx); });
        xx += b.w + COLGAP;
      });
      mids.push(ytop + rh / 2);
      ytop += rh + ROWGAP;
    });
    var firstMid = mids.length ? mids[0] : 0, lastMid = mids.length ? mids[mids.length - 1] : 0;
    var oneRow = mids.length < 2;
    if (showHuman) put({ key: 'i:human', kind: 'human', id: 'human', x: peopleW / 2, y: oneRow ? firstMid - FH * 0.8 : firstMid, w: HW, h: HH });
    if (maintLeft) put({ key: 'i:meta_maint', kind: 'meta', id: 'meta_maint', x: peopleW / 2, y: oneRow ? lastMid + FH * 0.8 : lastMid, w: NW, h: NH });

    /* channels: rows of pills under everything, the maintainer first */
    if (showCh) {
      var maxY = 0;
      nodes.forEach(function (n) { maxY = Math.max(maxY, n.y + n.h / 2); });
      boxes.forEach(function (b) { maxY = Math.max(maxY, b.y + b.h); });
      var chs = def.channels.slice().sort(function (p, q) { return p.kind === q.kind ? 0 : p.kind === 'model' ? -1 : 1; });
      var pills = (maint ? [{ key: 'i:meta_maint', kind: 'meta', id: 'meta_maint', w: NW, h: NH }] : [])
        .concat(chs.map(function (c) { return { key: 'c:' + c.id, kind: 'channel', id: c.id, w: CHW, h: CHH }; }));
      var step = CHW + 18, contentW = Math.max(best.W - x0, step * 4);
      var perRow = Math.max(4, Math.floor((contentW + 18) / step));
      var y = maxY + 84;
      for (var pi = 0; pi < pills.length; pi += perRow) {
        var prow = pills.slice(pi, pi + perRow);
        var sx = x0 + Math.max(0, (contentW - (prow.length * step - 18)) / 2);
        prow.forEach(function (it, j) { it.x = sx + j * step + CHW / 2; it.y = y + NH / 2; put(it); });
        y += NH + 16;
      }
    }

    // representative of each individual / channel
    var rep = function (id) {
      if (idx.ch.has(id)) return nodes.has('c:' + id) ? 'c:' + id : null;
      var x0 = idx.ind.get(id);
      if (!x0) return null;
      if (!x0.groupId) return nodes.has('i:' + id) ? 'i:' + id : null;
      var k = HUB.orgRep(id, s, m);
      return nodes.has(k) ? k : null;
    };
    def.individuals.forEach(function (x0) { var k = rep(x0.id); if (k) repPos[x0.id] = k; });

    /* ---------- edges ---------- */
    var lines = s.lines;
    var showType = function (t) { return t === 'channel' ? lines.channel && showCh : !!lines[t]; };
    var focusCase = s.focus && s.focus.type === 'case' ? s.focus.id : null;
    var focusCount = {};
    if (focusCase) {
      (idx.handoffsByCase.get(focusCase) || []).forEach(function (hf) {
        if (!HUB.model.visible(hf.at, s)) return;
        var rf = rep(hf.from), rt = rep(hf.to);
        if (!rf || !rt || rf === rt) return;
        var k = rf + '|' + rt + '|' + (hf.relationId ? 'task' : 'factonly');
        focusCount[k] = (focusCount[k] || 0) + 1;
      });
    }
    var aggs = new Map();
    def.relations.forEach(function (r) {
      if (!showType(r.type)) return;
      var rf = rep(r.from), rt = rep(r.to);
      if (!rf || !rt || rf === rt) return;
      var k = rf + '|' + rt + '|' + r.type;
      var g = aggs.get(k);
      if (!g) { g = { key: k, from: rf, to: rt, type: r.type, rels: [], count: 0, used: 0, unused: 0, subs: {} }; aggs.set(k, g); }
      var c = (a.relStats[r.id] || {}).count || 0;
      g.rels.push(r.id); g.count += c; if (c) g.used += 1; else g.unused += 1; g.subs[r.sub] = true;
    });
    if (lines.task) {
      a.factOnly.forEach(function (f) {
        var rf = rep(f.from), rt = rep(f.to);
        if (!rf || !rt || rf === rt) return;
        var k = rf + '|' + rt + '|factonly';
        var g = aggs.get(k);
        if (!g) { g = { key: k, from: rf, to: rt, type: 'factonly', rels: [], ids: [], count: 0, used: 1, unused: 0, subs: {} }; aggs.set(k, g); }
        g.ids.push(f.id); g.count += f.count;
      });
    }
    var maxCount = 1;
    aggs.forEach(function (g) { maxCount = Math.max(maxCount, g.count); g.focus = focusCount[g.key] || 0; });
    var edges = [];
    aggs.forEach(function (g) {
      if (s.compare === 'fact' && !g.count) return;
      if (s.compare === 'def' && g.type === 'factonly') return;
      edges.push(g);
    });

    // involvement for the focused case
    var involved = null;
    if (focusCase) {
      involved = {};
      (idx.runsByCase.get(focusCase) || []).forEach(function (r) {
        if (!HUB.model.visible(r.start, s)) return;
        var k = rep(r.individualId);
        if (k) involved[k] = true;
        if (k && k.indexOf('i:') === 0) involved['i:' + r.individualId] = true;
      });
      (idx.handoffsByCase.get(focusCase) || []).forEach(function (hf) {
        if (hf.from === 'human' && nodes.has('i:human')) involved['i:human'] = true;
      });
      // open boxes count as involved when a member is
      boxes.forEach(function (b) {
        var mem = idx.membersDeep.get(b.id) || [];
        if (mem.some(function (id) { return involved['i:' + id] || involved[rep(id)]; })) involved[b.key] = true;
      });
    }

    var bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity;
    nodes.forEach(function (n) { bx0 = Math.min(bx0, n.x - n.w / 2); bx1 = Math.max(bx1, n.x + n.w / 2); by0 = Math.min(by0, n.y - n.h / 2); by1 = Math.max(by1, n.y + n.h / 2); });
    boxes.forEach(function (b) { bx0 = Math.min(bx0, b.x); bx1 = Math.max(bx1, b.x + b.w); by0 = Math.min(by0, b.y); by1 = Math.max(by1, b.y + b.h); });
    var bbox = isFinite(bx0) ? { x: bx0, y: by0 - 16, w: Math.max(200, bx1 - bx0), h: Math.max(120, by1 - by0 + 32) } : { x: 0, y: 0, w: 400, h: 200 };
    return { nodes: nodes, boxes: boxes, edges: edges, maxCount: maxCount, rep: rep, repPos: repPos, involved: involved, bbox: bbox, rows: best.rows.length };
  }

  /* ---------- renderer ---------- */
  var R = {
    root: null, stage: null, wrap: null, lanes: null,
    cur: { nodes: new Map(), boxes: new Map() },
    els: { nodes: new Map(), boxes: new Map(), edges: new Map() },
    lay: null, cancel: null, lastKey: '', hoverKey: null, modelId: null
  };

  R.mount = function (el) {
    R.root = el;
    el.classList.add('og-root');
    R.wrap = U.h('div', { class: 'og-graph' });
    el.appendChild(R.wrap);
    R.stage = HUB.svgkit.createStage(R.wrap, { idSuffix: '-og' });
    R.lanes = U.h('div', { class: 'og-lanes hidden' });
    el.appendChild(R.lanes);
    var svg = R.stage.svg;
    svg.addEventListener('click', onClick);
    svg.addEventListener('dblclick', onDbl);
    svg.addEventListener('mouseover', onOver);
    svg.addEventListener('mouseout', onOut);
    svg.addEventListener('svgk-bgclick', function () {
      if (HUB.store.get().selection) HUB.store.set({ selection: null }, { history: false });
    });
  };
  R.unmount = function () { if (R.cancel) R.cancel(); };
  R.fit = function (animate) {
    if (!R.lay) return;
    HUB.svgkit && R.stage.pz.fit(R.lay.bbox, 48, animate !== false);
  };

  R.update = function (m, s, prev) {
    var a = HUB.model.an(s, m);
    renderLanes(m, s, a);   // first: the lanes take their height from the drawing area
    var view = { w: R.wrap.clientWidth || 1300, h: R.wrap.clientHeight || 700 };
    var lay = layout(m, s, a, view);
    var structKey = [m.id, m.rev, s.depth.org, (s.expanded.org || []).join(','), (s.collapsed.org || []).join(','),
      JSON.stringify(s.lines), JSON.stringify(s.overlays), s.compare, s.focus ? s.focus.type + s.focus.id : '', s.time, lay.rows].join('#');
    var modelChanged = R.modelId !== m.id;
    var structural = structKey !== R.lastKey;
    var prevLay = R.lay;
    var viewSig = Math.round(view.w / 24) + 'x' + Math.round(view.h / 24);
    var viewChanged = R.viewSig !== viewSig;
    R.lay = lay;
    R.lastKey = structKey;
    R.modelId = m.id;
    R.viewSig = viewSig;
    R.root.classList.toggle('og-focus', !!lay.involved);
    if (modelChanged) clearAll();
    if (structural || !prevLay) animateTo(m, s, a, lay, modelChanged || !prevLay);
    else paintStatic(m, s, a, lay);
    // refit when the drawing's extent or the room for it changed; a user's own zoom survives everything else
    var b0 = prevLay && prevLay.bbox, b1 = lay.bbox;
    var extentChanged = !b0 || Math.abs(b0.w - b1.w) > 4 || Math.abs(b0.h - b1.h) > 4 || Math.abs(b0.x - b1.x) > 4 || Math.abs(b0.y - b1.y) > 4;
    if (modelChanged || !prev || extentChanged || viewChanged) setTimeout(function () { R.fit(!modelChanged); }, modelChanged ? 0 : 20);
  };

  // A different case reuses node ids (n0, n1, ...), so drop every element instead of patching stale names.
  function clearAll() {
    if (R.cancel) { R.cancel(); R.cancel = null; }
    ['nodes', 'boxes', 'edges'].forEach(function (k) { R.els[k].forEach(function (el) { el.remove(); }); R.els[k] = new Map(); });
    R.cur = { nodes: new Map(), boxes: new Map() };
    R.hoverKey = null;
  }

  /* --- element builders --- */
  function S(t, at) { return U.svg(t, at); }
  function trunc(txt, n) { txt = String(txt || ''); return txt.length > n ? txt.slice(0, n - 1) + '…' : txt; }

  function buildNode(n, m) {
    var g = S('g', { class: 'og-n og-k-' + n.kind, 'data-key': n.key });
    // a folded group reads as a stack of cards
    if (n.kind === 'fold') g.appendChild(S('rect', { class: 'og-stack', x: 4, y: 4, rx: 6, ry: 6, width: n.w, height: n.h }));
    var rr = n.kind === 'channel' ? n.h / 2 : 6;
    g.appendChild(S('rect', { class: 'og-r', rx: rr, ry: rr, width: n.w, height: n.h }));
    if (n.kind === 'fold') {
      var G = m.idx.group.get(n.id);
      g.appendChild(S('text', { class: 'og-t1', x: 12, y: 20, text: trunc(G ? G.name : n.id, 12) }));
      g.appendChild(S('text', { class: 'og-t2 og-meta', x: 12, y: 38 }));
      g.appendChild(S('g', { class: 'og-bar', transform: 'translate(12,' + (n.h - 14) + ')' }));
      var tg = S('g', { class: 'og-tog', 'data-toggle': n.id, transform: 'translate(' + (n.w - 22) + ',6)' });
      tg.appendChild(S('rect', { width: 16, height: 16, rx: 3 }));
      tg.appendChild(S('text', { x: 8, y: 12.5, 'text-anchor': 'middle', text: '+' }));
      tg.appendChild(S('title', { text: '展开（双击节点也可以）' }));
      g.appendChild(tg);
    } else if (n.kind === 'channel') {
      var c = m.idx.ch.get(n.id);
      g.appendChild(S('text', { class: 'og-t2', x: 10, y: 21, text: trunc(c ? c.name : n.id, 11) }));
    } else {
      var x = m.idx.ind.get(n.id);
      g.appendChild(S('circle', { class: 'og-dot', cx: 12, cy: 15, r: 4 }));
      g.appendChild(S('text', { class: 'og-t1', x: 22, y: 19, text: trunc(x ? x.name : n.id, n.kind === 'human' ? 9 : 8) }));
      g.appendChild(S('text', { class: 'og-t2 og-meta', x: 12, y: 36 }));
      if (x && x.isHub) g.appendChild(S('text', { class: 'og-tag', x: n.w - 8, y: 14, 'text-anchor': 'end', text: '中枢' }));
      if (x && x.kind === 'meta') g.appendChild(S('text', { class: 'og-tag', x: n.w - 8, y: 14, 'text-anchor': 'end', text: '元' }));
      g.appendChild(S('g', { class: 'og-badges' }));
    }
    g.appendChild(S('title'));
    return g;
  }
  function buildBox(b, m) {
    var G = m.idx.group.get(b.id);
    var g = S('g', { class: 'og-box og-lv' + b.level, 'data-key': b.key });
    g.appendChild(S('rect', { class: 'og-br svgk-pan', rx: 8, ry: 8 }));
    g.appendChild(S('text', { class: 'og-bt', x: 10, y: 18, text: G ? G.name : b.id }));
    g.appendChild(S('text', { class: 'og-bm', y: 18 }));
    var tg = S('g', { class: 'og-tog', 'data-toggle': b.id });
    tg.appendChild(S('rect', { width: 16, height: 16, rx: 3 }));
    tg.appendChild(S('text', { x: 8, y: 12.5, 'text-anchor': 'middle', text: '−' }));
    tg.appendChild(S('title', { text: '折叠成一个节点（双击标题也可以）' }));
    g.appendChild(tg);
    return g;
  }
  function buildEdge(e) {
    var g = S('g', { class: 'og-e og-t-' + e.type, 'data-ekey': e.key });
    g.appendChild(S('path', { class: 'og-hit' }));
    g.appendChild(S('path', { class: 'og-p' }));
    var lab = S('g', { class: 'og-lab' });
    lab.appendChild(S('rect', { rx: 8, ry: 8, height: 16 }));
    lab.appendChild(S('text', { y: 12, 'text-anchor': 'middle' }));
    g.appendChild(lab);
    g.appendChild(S('title'));
    return g;
  }

  /* --- painting --- */
  function nodeState(n, a, s) {
    if (n.kind === 'fold') {
      var gs = a.groupStats[n.id] || {};
      return gs.members && gs.never === gs.members ? 'never' : (gs.error ? 'error' : gs.working ? 'working' : gs.waiting ? 'waiting' : 'standby');
    }
    if (n.kind === 'channel') {
      var cs = a.channelStats[n.id] || {};
      return cs.status === 'ok' ? 'standby' : 'error';
    }
    var st = a.indStats[n.id];
    return st ? st.status : 'standby';
  }
  function decorate(el, n, m, a, s, lay) {
    var st = nodeState(n, a, s);
    var ind = n.kind !== 'fold' && n.kind !== 'channel' ? m.idx.ind.get(n.id) : null;
    var cls = 'og-n og-k-' + n.kind + (ind && ind.isHub ? ' og-hub' : '') + (s.compare !== 'def' ? ' og-s-' + st : '');
    if (lay.involved) cls += lay.involved[n.key] ? ' og-in' : ' og-out';
    if (isSelected(n, s)) cls += ' og-sel';
    el.setAttribute('class', cls);
    var title = el.querySelector(':scope > title');
    var meta = el.querySelector('.og-meta');
    if (n.kind === 'fold') {
      var gs = a.groupStats[n.id] || {};
      if (meta) meta.textContent = groupStatsText(gs, s);
      var bar = el.querySelector('.og-bar');
      if (bar) {
        bar.innerHTML = '';
        if (s.compare !== 'def' && gs.members) {
          var w = n.w - 24, xx = 0;
          ['working', 'waiting', 'standby', 'error', 'never'].forEach(function (k) {
            var v = gs[k] || 0;
            if (!v) return;
            var ww = w * v / gs.members;
            bar.appendChild(S('rect', { class: 'og-seg og-sg-' + k, x: xx, y: 0, width: Math.max(1, ww - 1), height: 4 }));
            xx += ww;
          });
        }
      }
      if (title) title.textContent = (m.idx.group.get(n.id) || {}).name + '：双击展开';
    } else if (n.kind === 'channel') {
      var cs = a.channelStats[n.id] || {};
      if (title) title.textContent = (m.idx.ch.get(n.id) || {}).name + '：' + (L.channelStatus[cs.status] || '') + '，' + (cs.calls || 0) + ' 次调用';
    } else {
      var x = m.idx.ind.get(n.id), sti = a.indStats[n.id] || {};
      if (meta) {
        if (n.kind === 'human') meta.textContent = '提需求 · 拍板';
        else if (s.compare === 'def') meta.textContent = trunc(x.role, 10);
        else meta.textContent = (x.model ? x.model.charAt(0).toUpperCase() + x.model.slice(1) + ' · ' : '') + (sti.runs || 0) + ' 次运行';
      }
      var bd = el.querySelector('.og-badges');
      if (bd) {
        bd.innerHTML = '';
        var dv = a.delivery[n.id];
        if (s.overlays.delivery && dv && s.compare !== 'def') {
          var bx = n.w - 4;
          if (dv.missing.length) { bx -= 34; bd.appendChild(S('rect', { class: 'og-bad og-bad-miss', x: bx, y: -8, width: 34, height: 15, rx: 3 })); bd.appendChild(S('text', { class: 'og-badt', x: bx + 17, y: 3, 'text-anchor': 'middle', text: '缺 ' + dv.missing.length })); }
          else if (dv.missedEver.length) { bx -= 40; bd.appendChild(S('rect', { class: 'og-bad og-bad-was', x: bx, y: -8, width: 40, height: 15, rx: 3 })); bd.appendChild(S('text', { class: 'og-badt', x: bx + 20, y: 3, 'text-anchor': 'middle', text: '曾缺 ' + dv.missedEver.length })); }
          if (dv.instructions) { bx -= 44; bd.appendChild(S('rect', { class: 'og-bad og-bad-ins', x: bx, y: -8, width: 42, height: 15, rx: 3 })); bd.appendChild(S('text', { class: 'og-badt', x: bx + 21, y: 3, 'text-anchor': 'middle', text: '指令 ' + dv.instructions })); }
        }
      }
      if (title) title.textContent = (x ? x.name + '：' + (L.indStatus[sti.status] || '') + '。' + (x.role || '') : n.id) + '（双击打开最近一次运行）';
    }
  }
  // "5 人 · 运行 37 次 · 2 未派"; with a time cut the people at work matter more than totals
  function groupStatsText(gs, s) {
    var t = (gs.members || 0) + ' 人';
    if (s.compare === 'def') return t;
    t += s.time != null ? ' · ' + (gs.working || 0) + ' 在做' : ' · 运行 ' + (gs.runs || 0) + ' 次';
    if (gs.never) t += ' · ' + gs.never + ' 未派';
    return t;
  }
  function isSelected(n, s) {
    var sel = s.selection;
    if (!sel) return false;
    if (sel.type === 'individual') return n.key === 'i:' + sel.id;
    if (sel.type === 'group') return n.key === 'g:' + sel.id || n.key === 'b:' + sel.id;
    if (sel.type === 'channel') return n.key === 'c:' + sel.id;
    return false;
  }
  function decorateBox(el, b, m, a, s, lay) {
    var cls = 'og-box og-lv' + b.level;
    if (lay.involved) cls += lay.involved[b.key] ? ' og-in' : ' og-out';
    if (isSelected(b, s)) cls += ' og-sel';
    var gs = a.groupStats[b.id] || {};
    if (gs.members && gs.never === gs.members && s.compare !== 'def') cls += ' og-s-never';
    el.setAttribute('class', cls);
    var bm = el.querySelector('.og-bm');
    var bt = el.querySelector('.og-bt');
    var G = m.idx.group.get(b.id) || { name: b.id };
    var stats = groupStatsText(gs, s);
    var room = b.w - 38;   // keep clear of the fold button
    var measure = function (t) { try { return t.getComputedTextLength(); } catch (e) { return t.textContent.length * 12; } };
    bt.textContent = G.name;
    var tw = measure(bt);
    for (var n = G.name.length - 1; tw > room && n > 1; n--) { bt.textContent = G.name.slice(0, n) + '…'; tw = measure(bt); }
    bm.textContent = stats;
    bm.setAttribute('x', 18 + tw);
    bm.style.display = 18 + tw + measure(bm) > room + 10 ? 'none' : '';
    var tt = el.querySelector(':scope > title') || el.appendChild(S('title'));
    tt.textContent = G.name + '：' + stats + '。双击标题折叠';
  }
  function edgeSel(e, s) {
    var sel = s.selection;
    if (!sel) return false;
    if (sel.type === 'agg') return sel.id === e.from + '|' + e.to && e.type !== 'factonly';
    if (sel.type === 'relation') return e.rels.indexOf(sel.id) >= 0;
    if (sel.type === 'factonly') return e.type === 'factonly' && (e.ids || []).indexOf(sel.id) >= 0;
    if (sel.type === 'individual' || sel.type === 'group' || sel.type === 'channel') {
      var k = (sel.type === 'individual' ? 'i:' : sel.type === 'group' ? 'g:' : 'c:') + sel.id;
      return e.from === k || e.to === k;
    }
    return false;
  }
  function decorateEdge(el, e, s, lay) {
    var cls = 'og-e og-t-' + e.type;
    if (s.compare === 'both' && !e.count && e.type !== 'factonly') cls += ' og-defonly';
    if (lay.involved) cls += e.focus ? ' og-hl' : ' og-out';
    if (edgeSel(e, s)) cls += ' og-esel';
    el.setAttribute('class', cls);
    var p = el.querySelector('.og-p');
    var w = s.compare === 'def' ? 1.4 : HUB.svgkit.strokeWidth(lay.involved && e.focus ? e.focus : e.count, lay.involved ? 6 : lay.maxCount);
    p.setAttribute('stroke-width', e.count || s.compare === 'def' ? w.toFixed(2) : 1.2);
    var mk = lay.involved && e.focus ? 'hl' : (e.type === 'factonly' ? 'factonly' : (s.compare === 'both' && !e.count ? 'muted' : e.type));
    p.setAttribute('marker-end', 'url(#arr-' + mk + '-og)');
    var lab = el.querySelector('.og-lab');
    var txt = '';
    if (lay.involved && e.focus) txt = String(e.focus);
    else if (e.type === 'factonly') txt = '未声明 ' + e.count;
    else if (s.compare !== 'def' && e.rels.length > 1 && e.count) txt = String(e.count);
    lab.style.display = txt ? '' : 'none';
    if (txt) {
      lab.querySelector('text').textContent = txt;
      var tw = Math.max(18, txt.length * 7 + 10);
      var r = lab.querySelector('rect');
      r.setAttribute('width', tw); r.setAttribute('x', -tw / 2);
      lab.querySelector('text').setAttribute('x', 0);
    }
    var tt = el.querySelector(':scope > title');
    var subs = Object.keys(e.subs || {}).map(function (k) { return L.relSub[k] || k; }).join('、');
    tt.textContent = (e.type === 'factonly' ? '编排里没有这条线，实际发生了 ' + e.count + ' 次'
      : (L.lineType[e.type] || e.type) + (subs ? '（' + subs + '）' : '') + '：' + e.rels.length + ' 条定义，' + (s.compare === 'def' ? '' : '发生 ' + e.count + ' 次' + (e.unused ? '，其中 ' + e.unused + ' 条没发生过' : '')));
  }

  function posOf(map, key) { return map.get(key); }
  function edgeD(e, P) {
    var a1 = P(e.from), b1 = P(e.to);
    if (!a1 || !b1) return null;
    var dx = b1.x - a1.x, dy = b1.y - a1.y;
    var r1 = HUB.svgkit.rectRadius(a1.w, a1.h, dx, dy) + 2, r2 = HUB.svgkit.rectRadius(b1.w, b1.h, dx, dy) + 6;
    return { d: HUB.svgkit.edgePath(a1.x, a1.y, b1.x, b1.y, BEND[e.type] || 0.1, r1, r2), mx: (a1.x + b1.x) / 2 - dy * (BEND[e.type] || 0.1) * 0.5, my: (a1.y + b1.y) / 2 + dx * (BEND[e.type] || 0.1) * 0.5 };
  }

  function animateTo(m, s, a, lay, instant) {
    if (R.cancel) { R.cancel(); R.cancel = null; }
    var L1 = R.stage.layers;
    var from = R.cur.nodes, fromB = R.cur.boxes;
    // where a key appears from / disappears to
    var groupKeyOf = function (key) {
      if (key.indexOf('i:') === 0) { var x = m.idx.ind.get(key.slice(2)); return x && x.groupId ? x.groupId : null; }
      if (key.indexOf('g:') === 0 || key.indexOf('b:') === 0) { var g = m.idx.group.get(key.slice(2)); return g ? g.id : null; }
      return null;
    };
    var anchorIn = function (map, key) {
      var gid = groupKeyOf(key);
      var chain = gid ? m.idx.ancestors(gid) : [];
      for (var i = 0; i < chain.length; i++) {
        var k1 = 'g:' + chain[i], k2 = 'b:' + chain[i];
        if (map.has(k1) && k1 !== key) return map.get(k1);
        if (map.has(k2) && k2 !== key) return map.get(k2);
      }
      return null;
    };
    var boxCenter = function (b) { return b ? { x: b.x + b.w / 2, y: b.y + b.h / 2, w: b.w, h: b.h } : null; };
    var tracks = [];   // {key, el, a:{x,y,w,h,o}, b:{...}, remove, kind:'node'|'box'}
    var seen = {};
    lay.nodes.forEach(function (n) {
      seen[n.key] = true;
      var el = R.els.nodes.get(n.key);
      if (!el) { el = buildNode(n, m); L1.nodes.appendChild(el); R.els.nodes.set(n.key, el); }
      decorate(el, n, m, a, s, lay);
      var start = from.get(n.key);
      if (!start) {
        var anc = anchorIn(from, n.key) || boxCenter(anchorIn(fromB, n.key));
        start = anc ? { x: anc.x, y: anc.y, w: n.w, h: n.h, o: 0 } : { x: n.x, y: n.y, w: n.w, h: n.h, o: 0 };
      }
      tracks.push({ key: n.key, el: el, kind: 'node', a: { x: start.x, y: start.y, w: n.w, h: n.h, o: start.o == null ? 1 : start.o }, b: { x: n.x, y: n.y, w: n.w, h: n.h, o: 1 } });
    });
    from.forEach(function (n, key) {
      if (seen[key]) return;
      var el = R.els.nodes.get(key);
      if (!el) return;
      var to = anchorIn(lay.nodes, key) || boxCenter(anchorIn(lay.boxes, key)) || n;
      tracks.push({ key: key, el: el, kind: 'node', remove: true, a: { x: n.x, y: n.y, w: n.w, h: n.h, o: n.o == null ? 1 : n.o }, b: { x: to.x, y: to.y, w: n.w, h: n.h, o: 0 } });
    });
    var seenB = {};
    lay.boxes.forEach(function (b) {
      seenB[b.key] = true;
      var el = R.els.boxes.get(b.key);
      if (!el) { el = buildBox(b, m); L1.groups.appendChild(el); R.els.boxes.set(b.key, el); }
      decorateBox(el, b, m, a, s, lay);
      var st = fromB.get(b.key);
      if (!st) {
        var fn = from.get('g:' + b.id);
        st = fn ? { x: fn.x - fn.w / 2, y: fn.y - fn.h / 2, w: fn.w, h: fn.h, o: 0 } : { x: b.x, y: b.y, w: b.w, h: b.h, o: 0 };
      }
      tracks.push({ key: b.key, el: el, kind: 'box', a: { x: st.x, y: st.y, w: st.w, h: st.h, o: st.o == null ? 1 : st.o }, b: { x: b.x, y: b.y, w: b.w, h: b.h, o: 1 } });
    });
    fromB.forEach(function (b, key) {
      if (seenB[key]) return;
      var el = R.els.boxes.get(key);
      if (!el) return;
      var fn = lay.nodes.get('g:' + b.id);
      var to = fn ? { x: fn.x - fn.w / 2, y: fn.y - fn.h / 2, w: fn.w, h: fn.h } : b;
      tracks.push({ key: key, el: el, kind: 'box', remove: true, a: { x: b.x, y: b.y, w: b.w, h: b.h, o: 1 }, b: { x: to.x, y: to.y, w: to.w, h: to.h, o: 0 } });
    });

    // edges: rebuild the set, keep elements by key
    var keepE = {};
    lay.edges.forEach(function (e) {
      keepE[e.key] = true;
      var el = R.els.edges.get(e.key);
      var isNew = !el;
      if (!el) { el = buildEdge(e); L1.edges.appendChild(el); R.els.edges.set(e.key, el); }
      el.__edge = e;
      decorateEdge(el, e, s, lay);
      el.style.opacity = isNew && !instant ? '0' : '';
      el.__new = isNew;
    });
    R.els.edges.forEach(function (el, key) { if (!keepE[key]) { el.remove(); R.els.edges.delete(key); } });

    var live = { nodes: new Map(), boxes: new Map() };
    var frame = function (p) {
      tracks.forEach(function (t) {
        var x = t.a.x + (t.b.x - t.a.x) * p, y = t.a.y + (t.b.y - t.a.y) * p;
        var w = t.a.w + (t.b.w - t.a.w) * p, hh = t.a.h + (t.b.h - t.a.h) * p, o = t.a.o + (t.b.o - t.a.o) * p;
        if (t.kind === 'node') {
          t.el.setAttribute('transform', 'translate(' + (x - w / 2).toFixed(1) + ',' + (y - hh / 2).toFixed(1) + ')');
          t.el.style.opacity = o < 0.999 ? o.toFixed(3) : '';
          if (!t.remove) live.nodes.set(t.key, { x: x, y: y, w: w, h: hh });
        } else {
          t.el.setAttribute('transform', 'translate(' + x.toFixed(1) + ',' + y.toFixed(1) + ')');
          var r = t.el.querySelector('.og-br');
          r.setAttribute('width', Math.max(10, w).toFixed(1)); r.setAttribute('height', Math.max(10, hh).toFixed(1));
          var tg = t.el.querySelector('.og-tog');
          if (tg) tg.setAttribute('transform', 'translate(' + (w - 22).toFixed(1) + ',5)');
          t.el.style.opacity = o < 0.999 ? o.toFixed(3) : '';
        }
      });
      var P = function (k) { return live.nodes.get(k); };
      R.els.edges.forEach(function (el) {
        var e = el.__edge;
        var g = edgeD(e, P);
        if (!g) { el.style.display = 'none'; return; }
        el.style.display = '';
        el.querySelector('.og-p').setAttribute('d', g.d);
        el.querySelector('.og-hit').setAttribute('d', g.d);
        el.querySelector('.og-lab').setAttribute('transform', 'translate(' + g.mx.toFixed(1) + ',' + (g.my - 8).toFixed(1) + ')');
        if (el.__new && !instant) el.style.opacity = String(Math.min(1, p * 1.4));
      });
    };
    var done = function () {
      tracks.forEach(function (t) {
        if (t.remove) {
          t.el.remove();
          if (t.kind === 'node') R.els.nodes.delete(t.key); else R.els.boxes.delete(t.key);
        }
      });
      R.els.edges.forEach(function (el) { el.style.opacity = ''; el.__new = false; });
      R.cur = { nodes: new Map(lay.nodes), boxes: new Map(lay.boxes) };
      R.cancel = null;
    };
    if (instant) { frame(1); done(); }
    else R.cancel = HUB.svgkit.tween(DUR, frame, done);
    R.cur = { nodes: new Map(lay.nodes), boxes: new Map(lay.boxes) };
  }

  function paintStatic(m, s, a, lay) {
    lay.nodes.forEach(function (n) { var el = R.els.nodes.get(n.key); if (el) decorate(el, n, m, a, s, lay); });
    lay.boxes.forEach(function (b) { var el = R.els.boxes.get(b.key); if (el) decorateBox(el, b, m, a, s, lay); });
    lay.edges.forEach(function (e) { var el = R.els.edges.get(e.key); if (el) { el.__edge = e; decorateEdge(el, e, s, lay); } });
  }

  /* --- interaction --- */
  function keyToSel(key) {
    var t = key.slice(0, 2), id = key.slice(2);
    if (t === 'i:') return { type: 'individual', id: id };
    if (t === 'g:' || t === 'b:') return { type: 'group', id: id };
    if (t === 'c:') return { type: 'channel', id: id };
    return null;
  }
  function onClick(e) {
    var tg = e.target.closest('[data-toggle]');
    if (tg) { e.stopPropagation(); var G = HUB.model.current.idx.group.get(tg.getAttribute('data-toggle')); if (G) HUB.store.toggle('org', G.id, G.level); return; }
    var n = e.target.closest('[data-key]');
    if (n) { var sel = keyToSel(n.getAttribute('data-key')); if (sel) HUB.store.set({ selection: sel, drawer: true }, { history: false }); return; }
    var ed = e.target.closest('[data-ekey]');
    if (ed && ed.__edge) {
      var x = ed.__edge;
      var sel2 = x.type === 'factonly' ? { type: 'factonly', id: x.ids[0] } : x.rels.length === 1 ? { type: 'relation', id: x.rels[0] } : { type: 'agg', id: x.from + '|' + x.to };
      HUB.store.set({ selection: sel2, drawer: true }, { history: false });
    }
  }
  function onDbl(e) {
    var n = e.target.closest('[data-key]');
    if (!n) return;
    var key = n.getAttribute('data-key');
    var m = HUB.model.current;
    if (key.indexOf('g:') === 0 || key.indexOf('b:') === 0) {
      var G = m.idx.group.get(key.slice(2));
      if (G) HUB.store.toggle('org', G.id, G.level);
      return;
    }
    if (key.indexOf('i:') === 0) {
      var r = HUB.model.latestRunOf(key.slice(2), HUB.store.get(), m);
      if (r) HUB.store.set({ subject: 'exec', depth: { exec: 1 }, expanded: { exec: [] }, collapsed: { exec: [] }, focus: { type: 'run', id: r.id }, selection: { type: 'individual', id: key.slice(2) } });
    }
  }
  function onOver(e) {
    var n = e.target.closest('[data-key]');
    var key = n ? n.getAttribute('data-key') : null;
    if (key === R.hoverKey) return;
    setHover(key);
  }
  function onOut(e) {
    if (!e.relatedTarget || !R.stage.svg.contains(e.relatedTarget) || !e.relatedTarget.closest('[data-key]')) setHover(null);
  }
  function setHover(key) {
    R.hoverKey = key;
    var svg = R.stage.svg;
    svg.classList.toggle('og-hovering', !!key);
    R.els.edges.forEach(function (el) {
      var x = el.__edge;
      el.classList.toggle('og-hot', !!key && x && (x.from === key || x.to === key));
    });
  }

  /* --- case lanes (③) --- */
  function renderLanes(m, s, a) {
    var on = s.focus && s.focus.type === 'case' && s.overlays.lanes;
    R.lanes.classList.toggle('hidden', !on);
    R.root.classList.toggle('og-with-lanes', !!on);
    if (!on) { R.lanes.innerHTML = ''; return; }
    var keepScroll = R.lanes.scrollTop;
    var c = m.idx.case.get(s.focus.id);
    if (!c) { R.lanes.innerHTML = ''; return; }
    var runs = (m.idx.runsByCase.get(c.id) || []).slice().sort(function (p, q) { return p.start - q.start; });
    var hand = (m.idx.handoffsByCase.get(c.id) || []).slice();
    var gates = m.facts.gateEvents.filter(function (g) { return g.caseId === c.id; });
    var order = [];
    if (hand.some(function (x) { return x.from === 'human'; })) order.push('human');
    runs.forEach(function (r) { if (order.indexOf(r.individualId) < 0) order.push(r.individualId); });
    var t0 = c.start, t1 = Math.max(c.end || 0, runs.length ? Math.max.apply(null, runs.map(function (r) { return r.end; })) : t0 + 1, gates.length ? Math.max.apply(null, gates.map(function (g) { return g.at; })) : 0);
    var pad = (t1 - t0) * 0.02 || 60000;
    t0 -= pad; t1 += pad;
    var LW = 132, RH = 22, TOP = 26;
    var W = Math.max(400, R.lanes.clientWidth || 800) - 24, H = TOP + order.length * RH + 10;
    var X = function (t) { return LW + (t - t0) / (t1 - t0) * (W - LW - 10); };
    var Y = function (id) { return TOP + order.indexOf(id) * RH + RH / 2; };
    R.lanes.innerHTML = '';
    var head = U.h('div', { class: 'og-lh' },
      U.h('b', null, '执行路径：' + c.name), U.h('span', { class: 'muted' }, '  ' + U.fmtClock(c.start) + ' 起 · ' + (L.caseStatus[c.status] || c.status) + (c.waitingAt ? ' · 停在 ' + HUB.model.name('gate', c.waitingAt) : '')),
      U.h('span', { class: 'tag sim' }, '模拟数据'),
      U.h('span', { style: { flex: '1' } }),
      U.h('span', { class: 'muted' }, '点运行条进入它的决策链'),
      U.h('button', { class: 'btn sm ghost', title: '收起执行路径', onClick: function () { HUB.store.set({ overlays: { lanes: false } }); } }, '收起'));
    R.lanes.appendChild(head);
    var body = U.h('div', { class: 'og-lb' });
    R.lanes.appendChild(body);
    var svg = S('svg', { width: W, height: H, class: 'og-lsvg' });
    var defs = S('defs');
    ['task', 'factonly'].forEach(function (k) {
      var mk = S('marker', { id: 'ol-arr-' + k, viewBox: '0 0 10 10', refX: '9', refY: '5', markerWidth: '6', markerHeight: '6', orient: 'auto' });
      mk.appendChild(S('path', { d: 'M1 1 L9 5 L1 9 z', style: 'fill: var(--c-' + k + ')' }));
      defs.appendChild(mk);
    });
    svg.appendChild(defs);
    order.forEach(function (id, i) {
      var y = TOP + i * RH;
      svg.appendChild(S('rect', { class: 'og-lrow' + (i % 2 ? ' odd' : ''), x: 0, y: y, width: W, height: RH }));
      var t = S('text', { class: 'og-lname', x: 8, y: y + 15, text: trunc(HUB.model.name('individual', id), 9) });
      t.addEventListener('click', function () { HUB.store.set({ selection: { type: 'individual', id: id }, drawer: true }, { history: false }); });
      svg.appendChild(t);
    });
    // ticks
    for (var k = 0; k <= 4; k++) {
      var tt = t0 + (t1 - t0) * k / 4;
      svg.appendChild(S('line', { class: 'og-ltick', x1: X(tt), x2: X(tt), y1: TOP - 4, y2: H }));
      svg.appendChild(S('text', { class: 'og-ltt', x: X(tt), y: 14, 'text-anchor': k === 0 ? 'start' : k === 4 ? 'end' : 'middle', text: U.fmtClock(tt).replace('第', '').replace('天 ', '日 ') }));
    }
    gates.forEach(function (g) {
      var gx = X(g.at);
      var gl = S('line', { class: 'og-lgate ' + (g.result === 'fail' ? 'fail' : 'pass'), x1: gx, x2: gx, y1: TOP, y2: H });
      svg.appendChild(gl);
      var gt = S('text', { class: 'og-lgt ' + (g.result === 'fail' ? 'fail' : 'pass'), x: gx + 3, y: TOP + 9, text: (g.result === 'fail' ? '打回 ' : '通过 ') + trunc(HUB.model.name('gate', g.gateId), 8) });
      gt.addEventListener('click', function () { HUB.store.set({ selection: { type: 'gate', id: g.gateId }, drawer: true }, { history: false }); });
      svg.appendChild(gt);
    });
    runs.forEach(function (r) {
      var task = m.idx.task.get(r.taskId);
      var y = Y(r.individualId);
      var cls = 'og-lrun ' + (r.outcome === 'failed' || r.outcome === 'interrupted' ? 'err' : task && ((task.visit || 1) > 1 || task.status === 'rework') ? 'rework' : r.outcome === 'escalate' ? 'esc' : 'ok');
      if (!HUB.model.visible(r.start, s)) cls += ' later';
      if (s.selection && s.selection.type === 'run' && s.selection.id === r.id) cls += ' sel';
      var rect = S('rect', { class: cls, x: X(r.start), y: y - 6, width: Math.max(3, X(r.end) - X(r.start)), height: 12, rx: 2 });
      rect.appendChild(S('title', { text: HUB.model.name('individual', r.individualId) + '：' + (task ? task.name : '') + '，' + U.fmtDur(r.end - r.start) + '，' + (L.outcome[r.outcome] || r.outcome) + '（点击打开决策链）' }));
      rect.addEventListener('click', function () {
        HUB.store.set({ subject: 'exec', depth: { exec: 1 }, expanded: { exec: [] }, collapsed: { exec: [] }, focus: { type: 'run', id: r.id }, selection: { type: 'run', id: r.id } });
      });
      svg.appendChild(rect);
    });
    hand.forEach(function (hf) {
      if (order.indexOf(hf.from) < 0 || order.indexOf(hf.to) < 0) return;
      var x = X(hf.at), y1 = Y(hf.from), y2 = Y(hf.to);
      if (y1 === y2) return;
      var k2 = hf.relationId ? 'task' : 'factonly';
      var ln = S('line', { class: 'og-lhand ' + k2, x1: x, x2: x, y1: y1 + (y2 > y1 ? 6 : -6), y2: y2 + (y2 > y1 ? -7 : 7), 'marker-end': 'url(#ol-arr-' + k2 + ')' });
      ln.appendChild(S('title', { text: HUB.model.name('individual', hf.from) + ' → ' + HUB.model.name('individual', hf.to) + (hf.relationId ? '' : '（编排里没有这条线）') + (hf.missing && hf.missing.length ? '；缺：' + hf.missing.map(function (d) { return HUB.model.name('doc', d); }).join('、') : '') }));
      svg.appendChild(ln);
    });
    if (s.time != null && s.time < t1) {
      svg.appendChild(S('rect', { class: 'og-lfuture', x: Math.max(LW, X(s.time)), y: TOP, width: Math.max(0, W - Math.max(LW, X(s.time))), height: H - TOP }));
    }
    body.appendChild(svg);
    R.lanes.scrollTop = keepScroll;
  }

  HUB.render.register('org', R);
  HUB.orgView = { _layout: layout, _ranks: computeRanks };
})();
