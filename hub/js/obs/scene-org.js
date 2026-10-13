/* ①②③ scene: departments, individuals and the four kinds of lines, laid out in the original canvas's card grid.
   Pure: (model, state, analysis, view) -> scene. No DOM, so node can test it. */
(function () {
  'use strict';
  var HUB = (window.HUB = window.HUB || {});
  var U = HUB.util;

  // the original page's card is 112 x 116 on a 136 x 160 grid
  var NW = 112, NH = 116, GX = 24, GY = 34;
  var DW = 236, DH = 116;            // folded department card
  var SW = 236, SH = 116;            // folded sub-team card
  var FP = 16, FT = 34;              // frame padding and title band
  var SP = 12, ST = 28;              // sub-frame padding and title band
  var COLS_MIN = 4, COLS_MAX = 8;    // cards in a row inside a department: four, and more when the canvas is wide
  var BLOCKGAP = 72, ROWGAP = 96;
  var CHW = 188, CHH = 104;        // a channel card in the capability layer

  /* how far along the flow each individual sits (longest path from the human, back edges ignored) */
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

  // position of each individual in the business process: index of the first stage it works in, or just after the stage whose gate it judges
  function processPositions(m) {
    var pos = {}, sIdx = {};
    m.def.process.stages.forEach(function (st, i) {
      sIdx[st.id] = i;
      st.steps.forEach(function (stp) { (stp.executors || []).forEach(function (e) { if (pos[e] == null || pos[e] > i) pos[e] = i; }); });
    });
    m.def.process.gates.forEach(function (g) {
      var who = g.decider && g.decider.who;
      if (!who || sIdx[g.afterStage] == null) return;
      var p = sIdx[g.afterStage] + 0.5;
      if (pos[who] == null || pos[who] > p) pos[who] = p;
    });
    return pos;
  }

  // flow-pack items (each {w, h}) into rows no wider than maxW; returns placed items and the block size
  function pack(items, maxW, gapX, gapY) {
    var rows = [], cur = [], cw = 0;
    items.forEach(function (it) {
      if (cur.length && cw + gapX + it.w > maxW) { rows.push(cur); cur = []; cw = 0; }
      cw += (cur.length ? gapX : 0) + it.w;
      cur.push(it);
    });
    if (cur.length) rows.push(cur);
    var y = 0, W = 0;
    rows.forEach(function (r) {
      var rh = Math.max.apply(null, r.map(function (it) { return it.h; }));
      var x = 0;
      r.forEach(function (it) { it.px = x; it.py = y + (rh - it.h) / 2; x += it.w + gapX; });
      W = Math.max(W, x - gapX);
      y += rh + gapY;
    });
    return { w: W, h: Math.max(0, y - gapY) };
  }

  /* items in flow order (each {w, h, r}): one row per tier, the rows centred on the widest.  A tier is the items of the same
     rank, so parallel workers sit side by side and the next step sits under them; when there are more tiers than
     MAXTIERS the neighbouring pair that stays smallest is merged, so a long chain does not become a tall column. */
  var MAXTIERS = 4;
  function tierPack(items, cols, gapX, gapY) {
    var rows = [];
    items.forEach(function (it) {
      var last = rows[rows.length - 1];
      if (last && last.r === it.r && last.items.length < cols) last.items.push(it); else rows.push({ r: it.r, items: [it] });
    });
    while (rows.length > MAXTIERS) {
      var at = -1, size = Infinity;
      for (var i = 0; i < rows.length - 1; i++) {
        var n = rows[i].items.length + rows[i + 1].items.length;
        if (n <= cols && n < size) { at = i; size = n; }
      }
      if (at < 0) break;
      rows.splice(at, 2, { r: rows[at].r, items: rows[at].items.concat(rows[at + 1].items) });
    }
    var widths = rows.map(function (r) { return U.sum(r.items, function (it) { return it.w; }) + (r.items.length - 1) * gapX; });
    var W = Math.max.apply(null, widths), y = 0;
    rows.forEach(function (r, i) {
      var rh = Math.max.apply(null, r.items.map(function (it) { return it.h; })), x = (W - widths[i]) / 2;
      r.items.forEach(function (it) { it.px = x; it.py = y + (rh - it.h) / 2; x += it.w + gapX; });
      y += rh + gapY;
    });
    return { w: W, h: Math.max(0, y - gapY) };
  }

  function dominantPhase(ids, idx) {
    var c = {};
    ids.forEach(function (id) { var x = idx.ind.get(id); if (x && x.phase) c[x.phase] = (c[x.phase] || 0) + 1; });
    var best = null;
    Object.keys(c).forEach(function (k) { if (!best || c[k] > c[best]) best = k; });
    return best;
  }

  function build(m, s, a, view) {
    view = view || { w: 1300, h: 760 };
    var COLS = Math.max(COLS_MIN, Math.min(COLS_MAX, Math.floor((view.w - 120) / ((NW + GX) * 1.3))));
    var idx = m.idx, def = m.def;
    var rk = computeRanks(m);
    var open = function (g) { return HUB.store.isOpen('org', g.id, g.level, s); };
    var hidden = function (id) { return s.compare === 'fact' && a.indStats[id] && a.indStats[id].status === 'never'; };
    var shown = function (ids) { return ids.filter(function (id) { return idx.ind.has(id) && !hidden(id); }); };   // a group may name someone not defined
    var order = function (ids) {
      return ids.slice().sort(function (p, q) {
        var d = (rk[p] || 0) - (rk[q] || 0);
        return d || (idx.ind.get(p).x || 0) - (idx.ind.get(q).x || 0);
      });
    };
    // departments read in business order: where their members first appear in the process (a stage, or a gate they judge),
    // and only then by position in the handoff graph
    var pos = processPositions(m);
    var groupRank = function (g) {
      var mem = idx.membersDeep.get(g.id) || [];
      if (!mem.length) return 999;
      var ps = mem.map(function (id) { return pos[id]; }).filter(function (v) { return v != null; });
      var rs = mem.map(function (id) { return rk[id] || 0; }).sort(function (p, q) { return p - q; });
      var graph = rs[Math.floor((rs.length - 1) / 2)] + rs[0] * 0.01;
      return (ps.length ? Math.min.apply(null, ps) : 50) * 100 + graph;
    };
    var maxRuns = 1;
    def.individuals.forEach(function (x) { maxRuns = Math.max(maxRuns, (a.indStats[x.id] || {}).runs || 0); });

    var cards = [], frames = [];
    // owner: the group whose frame the card is drawn in (someone listed in two groups is drawn once, in the first)
    var indCard = function (id, owner) {
      var x = idx.ind.get(id), st = a.indStats[id] || {}, own = owner || x.groupId;
      return { key: 'i:' + id, kind: x.kind === 'agent' ? 'ind' : x.kind, w: NW, h: NH, sel: { type: 'individual', id: id },
        anchor: own ? HUB.obsSceneOrg.anchorsOf(own, idx) : [],
        data: { id: id, name: x.name, agentId: x.agentId, phase: x.phase, model: x.model, isHub: !!x.isHub, kind: x.kind,
          status: s.compare === 'def' ? null : st.status, runs: s.compare === 'def' ? null : st.runs || 0, maxRuns: maxRuns,
          host: x.host && x.host !== 'Claude Code' ? x.host : null,
          natives: (x.natives || []).map(function (cid) { var c = idx.ch.get(cid) || {}; return { id: cid, name: c.name, short: c.short || c.name, host: c.host }; }),
          delivery: s.overlays.delivery && s.compare !== 'def' && HUB.model.measured(m, 'delivery') ? a.delivery[id] || null : null } };
    };
    var groupCard = function (G, w, h) {
      var mem = idx.membersDeep.get(G.id) || [];
      var gs = a.groupStats[G.id] || {};
      return { key: 'g:' + G.id, kind: 'dept', w: w, h: h, sel: { type: 'group', id: G.id }, toggle: G.id,
        anchor: (G.parentId ? HUB.obsSceneOrg.anchorsOf(G.parentId, idx) : []).concat(['b:' + G.id]),
        data: { id: G.id, name: G.name, level: G.level, phase: dominantPhase(mem, idx),
          agents: order(mem).map(function (id) { var x = idx.ind.get(id); return { id: id, name: x.name, agentId: x.agentId, status: (a.indStats[id] || {}).status, native: (x.natives || []).length > 0 }; }),
          natives: U.sum(mem, function (id) { return (idx.ind.get(id).natives || []).length; }),
          members: gs.members || 0, runs: s.compare === 'def' ? null : gs.runs || 0, never: s.compare === 'def' ? 0 : gs.never || 0,
          working: s.compare === 'def' ? 0 : gs.working || 0, cut: s.time != null, compare: s.compare } };
    };
    var frameOf = function (G, w, h, level) {
      var mem = idx.membersDeep.get(G.id) || [];
      var gs = a.groupStats[G.id] || {};
      return { key: 'b:' + G.id, kind: 'frame', level: level, w: w, h: h, sel: { type: 'group', id: G.id }, toggle: G.id,
        anchor: (G.parentId ? HUB.obsSceneOrg.anchorsOf(G.parentId, idx) : []).concat(['g:' + G.id]),
        data: { id: G.id, name: G.name, level: level, phase: dominantPhase(mem, idx), members: gs.members || 0,
          runs: s.compare === 'def' ? null : gs.runs || 0, never: s.compare === 'def' ? 0 : gs.never || 0,
          working: s.compare === 'def' ? 0 : gs.working || 0, cut: s.time != null } };
    };

    /* ---------- quick-aggregate: replace merged groups with a single placeholder card ----------
       s.merged = [{id, memberIds, name}]; view-only, stored in state not in def/facts.
       All relations to/from any memberIds are redirected to the placeholder key 'mg:<id>'.    */
    var mergedMap = new Map();   // individual id -> merged item
    (s.merged || []).forEach(function (mg) {
      mg.memberIds.forEach(function (mid) { if (idx.ind.has(mid)) mergedMap.set(mid, mg); });
    });
    var isMerged = function (id) { return mergedMap.has(id); };
    var mgCard = function (mg) {
      var count = mg.memberIds.filter(function (id) { return idx.ind.has(id); }).length;
      var phases = mg.memberIds.map(function (id) { var x = idx.ind.get(id); return x && x.phase; }).filter(Boolean);
      var ph = dominantPhase(mg.memberIds.filter(function (id) { return idx.ind.has(id); }), idx);
      var statuses = mg.memberIds.map(function (id) { return (a.indStats[id] || {}).status; });
      var working = statuses.filter(function (st) { return st === 'working'; }).length;
      return { key: 'mg:' + mg.id, kind: 'merged', w: NW, h: NH,
        sel: { type: 'merged', id: mg.id },
        anchor: [],
        data: { id: mg.id, name: mg.name, count: count, phase: ph, working: working,
          memberIds: mg.memberIds, compare: s.compare } };
    };

    /* one block per department, laid out in local coordinates */
    var tops = def.groups.filter(function (g) { return !g.parentId; }).sort(function (g1, g2) {
      var d = groupRank(g1) - groupRank(g2);
      return d !== 0 ? d : g1.order - g2.order;
    });
    var blocks = [];
    // someone listed in two groups is drawn once, in the first block that takes them; a block left with nothing to draw is not drawn
    var claimed = new Set();
    var fresh = function (ids) { return ids.filter(function (id) { return !claimed.has(id); }); };
    tops.forEach(function (G) {
      if (!shown(idx.membersDeep.get(G.id) || []).length) return;
      if (!open(G)) { blocks.push({ w: DW, h: DH, cards: [Object.assign(groupCard(G, DW, DH), { x: 0, y: 0 })], frames: [] }); return; }
      var items = [];
      G.children.forEach(function (cid) {
        var SG = idx.group.get(cid);
        if (!SG) return;
        var mem = order(fresh(shown(idx.membersDeep.get(SG.id) || [])));
        if (!mem.length) return;
        mem.forEach(function (id) { claimed.add(id); });
        if (open(SG)) {
          var inner = mem.map(function (id) { return { id: id, w: NW, h: NH }; });
          var lay = pack(inner, Math.min(3, inner.length) * (NW + GX) - GX, GX, GY);
          items.push({ kind: 'sub', g: SG, inner: inner, w: lay.w + SP * 2, h: lay.h + ST + SP, r: rk[mem[0]] || 0 });
        } else items.push({ kind: 'subfold', g: SG, w: SW, h: SH, r: rk[mem[0]] || 0 });
      });
      order(fresh(shown(G.members))).forEach(function (id) {
        claimed.add(id);
        if (isMerged(id)) {
          // if any member of this group is merged, inject the placeholder once per unique merged group
          var mg = mergedMap.get(id);
          if (!items.some(function (it) { return it.kind === 'merged' && it.mg.id === mg.id; }))
            items.push({ kind: 'merged', mg: mg, w: NW, h: NH, r: rk[mg.memberIds[0]] || 0 });
        } else {
          items.push({ kind: 'ind', id: id, w: NW, h: NH, r: rk[id] || 0 });
        }
      });
      if (!items.length) return;
      items.sort(function (p, q) { return p.r - q.r; });
      var lay2 = tierPack(items, COLS, GX, GY);
      var bw = lay2.w + FP * 2, bh = lay2.h + FT + FP;
      var bl = { w: bw, h: bh, cards: [], frames: [Object.assign(frameOf(G, bw, bh, 1), { x: 0, y: 0 })] };
      items.forEach(function (it) {
        var ox = FP + it.px, oy = FT + it.py;
        if (it.kind === 'ind') bl.cards.push(Object.assign(indCard(it.id, G.id), { x: ox, y: oy }));
        else if (it.kind === 'merged') bl.cards.push(Object.assign(mgCard(it.mg), { x: ox, y: oy }));
        else if (it.kind === 'subfold') bl.cards.push(Object.assign(groupCard(it.g, SW, SH), { x: ox, y: oy }));
        else {
          bl.frames.push(Object.assign(frameOf(it.g, it.w, it.h, 2), { x: ox, y: oy }));
          it.inner.forEach(function (c) { bl.cards.push(Object.assign(indCard(c.id, it.g.id), { x: ox + SP + c.px, y: oy + ST + c.py })); });
        }
      });
      blocks.push(bl);
    });

    /* the person on the left; the maintainer lives with the channels it maintains */
    var showHuman = s.overlays.human !== false && idx.ind.has('human');
    var maint = idx.ind.get('meta_maint');
    var peopleW = showHuman ? NW : 0;
    var x0 = peopleW ? peopleW + BLOCKGAP : 0;

    /* the capability layer: every channel is a unit of the main graph (status, users, load against its limit),
       framed together with the maintainer that keeps them running */
    var defOnly = s.compare === 'def';
    var chCard = function (c) {
      var cs = a.channelStats[c.id] || {};
      var users = (c.users || []).filter(function (u) { return idx.ind.has(u) && !hidden(u); });
      return { key: 'c:' + c.id, kind: 'channel', w: CHW, h: CHH, sel: { type: 'channel', id: c.id }, anchor: ['b:__channels'],
        data: { id: c.id, name: c.name, chKind: c.kind, model: c.kind === 'model' ? c.id.replace(/^ch_/, '') : null, def: defOnly,
          unmeasured: !HUB.model.measured(m, 'channel'),
          status: defOnly ? 'ok' : cs.status || 'ok', limit: c.limit || null, users: users.length,
          agents: users.slice(0, 6).map(function (u) { var y = idx.ind.get(u); return { id: u, name: y.name, agentId: y.agentId, kind: y.kind, on: !defOnly && (cs.activeUsers || []).indexOf(u) >= 0 }; }),
          active: defOnly ? 0 : cs.active || 0, waiting: defOnly ? 0 : cs.waiting || 0, peak: defOnly ? 0 : cs.peak || 0,
          queued: defOnly ? 0 : cs.queued || 0, wait: defOnly ? 0 : cs.waitTotal || 0, calls: defOnly ? null : cs.calls || 0, cut: s.time != null } };
    };
    var KIND_ORDER = { model: 0, function: 1, tool: 2 };
    var isLocal = function (c) { return c.tier === 'basic'; };
    // the capability layer is the layered tool systems (everyone's basics, the shared functions); a model is a property of the
    // individual (its badge and its details), not a card, and the maintainer only appears when there is something to maintain
    var chs = def.channels.filter(function (c) { return c.tier === 'shared' && c.kind !== 'model'; }).sort(function (p, q) { return (KIND_ORDER[p.kind] || 1) - (KIND_ORDER[q.kind] || 1); });
    var locals = def.channels.filter(isLocal);
    var chItems = (maint && chs.length ? [indCard('meta_maint')] : []).concat(chs.map(chCard));
    if (locals.length) {
      var lusers = U.uniq([].concat.apply([], locals.map(function (c) { return c.users || []; }))).filter(function (u) { return idx.ind.has(u) && !hidden(u); });
      chItems.push({ key: 'c:__local', kind: 'channel', w: CHW, h: 58, sel: { type: 'channel', id: '__local' }, anchor: ['b:__channels'],
        data: { id: '__local', name: '基础能力', chKind: 'basic', def: defOnly, status: 'ok', limit: null, users: lusers.length,
          tools: locals.map(function (c) { return c.name.replace(/^工具：/, ''); }),
          agents: lusers.slice(0, 6).map(function (u) { var y = idx.ind.get(u); return { id: u, name: y.name, agentId: y.agentId, kind: y.kind, on: false }; }),
          active: 0, waiting: 0, peak: 0, queued: 0, wait: 0, cut: s.time != null,
          calls: defOnly ? null : U.sum(locals, function (c) { return (a.channelStats[c.id] || {}).calls || 0; }) } });
    }
    /* rows of departments: try 1..n rows, keep the widest arrangement whose scale is close to the best */
    var arrange = function (nRows) {
      var per = Math.max(1, Math.ceil(blocks.length / nRows)), rows = [];
      for (var i = 0; i < blocks.length; i += per) rows.push(blocks.slice(i, i + per));
      var W = 0, H = 0;
      rows.forEach(function (r) {
        W = Math.max(W, U.sum(r, function (b) { return b.w; }) + (r.length - 1) * BLOCKGAP);
        H += Math.max.apply(null, r.map(function (b) { return b.h; }));
      });
      H = Math.max(H + Math.max(0, rows.length - 1) * ROWGAP, peopleW ? NH * 2 + GY : 0);
      W += x0;
      // the capability layer sits under the graph, as wide as it is: count its height too
      if (chItems.length) H += ROWGAP + FT + FP + pack(chItems.map(function (it) { return { w: it.w, h: it.h }; }), Math.max(W - x0, CHW + FP * 2) - FP * 2, GX, GY).h;
      return { rows: rows, W: W, H: H, k: Math.min(1, (view.w - 80) / Math.max(1, W), (view.h - 180) / Math.max(1, H)) };
    };
    var cands = [];
    for (var nr = 1; nr <= Math.max(1, blocks.length); nr++) {
      var cand = arrange(nr);
      if (!cands.length || cand.rows.length !== cands[cands.length - 1].rows.length) cands.push(cand);
    }
    var kBest = Math.max.apply(null, cands.map(function (c) { return c.k; }));
    var best = cands.find(function (c) { return c.k >= kBest * 0.9; }) || cands[0];
    var ytop = 0, mids = [];
    best.rows.forEach(function (r) {
      var rh = Math.max.apply(null, r.map(function (b) { return b.h; }));
      var rw = U.sum(r, function (b) { return b.w; }) + (r.length - 1) * BLOCKGAP;
      var xx = x0 + Math.max(0, (best.W - x0 - rw) / 2);
      r.forEach(function (b) {
        var oy = ytop + (rh - b.h) / 2;
        b.frames.forEach(function (f) { f.x += xx; f.y += oy; frames.push(f); });
        b.cards.forEach(function (c) { c.x += xx; c.y += oy; cards.push(c); });
        xx += b.w + BLOCKGAP;
      });
      mids.push(ytop + rh / 2);
      ytop += rh + ROWGAP;
    });
    var firstMid = mids.length ? mids[0] : NH / 2;
    if (showHuman) cards.push(Object.assign(indCard('human'), { x: 0, y: firstMid - NH / 2 }));

    var maxY = 0;
    cards.forEach(function (c) { maxY = Math.max(maxY, c.y + c.h); });
    frames.forEach(function (f) { maxY = Math.max(maxY, f.y + f.h); });
    if (chItems.length) {
    var contentW = Math.max(best.W - x0, CHW + FP * 2);   // as wide as the graph above it, so the layer sits under it and not off to one side
    var chLay = pack(chItems, contentW - FP * 2, GX, GY);
    var fw = chLay.w + FP * 2, fh = chLay.h + FT + FP;
    var fx = x0 + Math.max(0, (contentW - fw) / 2), fy = maxY + ROWGAP;
    var bad = chs.filter(function (c) { var st = (a.channelStats[c.id] || {}).status; return !defOnly && st && st !== 'ok'; }).length;
    var full = chs.filter(function (c) { var cs = a.channelStats[c.id] || {}; return !defOnly && c.limit && (cs.waiting || cs.active >= c.limit); }).length;
    frames.push({ key: 'b:__channels', kind: 'chframe', x: fx, y: fy, w: fw, h: fh, sel: { type: 'channels', id: 'all' }, anchor: [],
      data: { n: chItems.filter(function (it) { return it.kind === 'channel'; }).length, bad: bad, full: full, def: defOnly, unmeasured: !HUB.model.measured(m, 'channel'),
        queued: defOnly ? 0 : U.sum(chs, function (c) { return (a.channelStats[c.id] || {}).queued || 0; }) } });
    chItems.forEach(function (it) { it.x = fx + FP + it.px; it.y = fy + FT + it.py; if (it.key === 'i:meta_maint') it.anchor = ['b:__channels']; cards.push(it); });
    }

    var cardByKey = new Map(cards.map(function (c) { return [c.key, c]; }));

    /* which drawn card stands for an individual or a channel */
    var rep = function (id) {
      // if this individual has been merged into a placeholder, redirect to it
      if (mergedMap.has(id)) return 'mg:' + mergedMap.get(id).id;
      if (idx.ch.has(id)) {
        if (cardByKey.has('c:' + id)) return 'c:' + id;
        var cc = idx.ch.get(id);
        if (cc.tier === 'native') return rep(cc.owner);   // a native capability is drawn on its owner
        return cardByKey.has('c:__local') && cc.tier === 'basic' ? 'c:__local' : null;
      }
      var x = idx.ind.get(id);
      if (!x) return null;
      if (!x.groupId) return cardByKey.has('i:' + id) ? 'i:' + id : null;
      var k = HUB.orgRep(id, s, m);
      return cardByKey.has(k) ? k : null;
    };

    /* links: definitions aggregated between drawn cards, plus fact-only handoffs */
    var lines = s.lines;
    var showType = function (t) { return !!lines[t]; };
    // usage lines are many; besides the 渠道线 switch, they appear for the channel or individual being looked at
    var selCh = s.selection && s.selection.type === 'channel' ? s.selection.id : null;
    var selInd = s.selection && s.selection.type === 'individual' ? s.selection.id : null;
    var wanted = function (r) {
      if (showType(r.type)) return true;
      if (r.type !== 'channel') return false;
      if (selInd && r.from === selInd) return true;
      if (!selCh) return false;
      return selCh === '__local' ? rep(r.to) === 'c:__local' : r.to === selCh;
    };
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
      if (!wanted(r)) return;
      var rf = rep(r.from), rt = rep(r.to);
      if (!rf || !rt || rf === rt) return;
      var k = rf + '|' + rt + '|' + r.type;
      var g = aggs.get(k);
      if (!g) { g = { key: k, from: rf, to: rt, type: r.type, rels: [], ids: [], count: 0, unused: 0, subs: {} }; aggs.set(k, g); }
      var c = (a.relStats[r.id] || {}).count || 0;
      g.rels.push(r.id); g.count += c; if (!c) g.unused += 1; g.subs[r.sub] = true;
    });
    if (lines.task) {
      a.factOnly.forEach(function (f) {
        var rf = rep(f.from), rt = rep(f.to);
        if (!rf || !rt || rf === rt) return;
        var k = rf + '|' + rt + '|factonly';
        var g = aggs.get(k);
        if (!g) { g = { key: k, from: rf, to: rt, type: 'factonly', rels: [], ids: [], count: 0, unused: 0, subs: {} }; aggs.set(k, g); }
        g.ids.push(f.id); g.count += f.count;
      });
    }
    var maxCount = 1;
    aggs.forEach(function (g) { maxCount = Math.max(maxCount, g.count); });
    var links = [];
    aggs.forEach(function (g) {
      if (s.compare === 'fact' && !g.count) return;
      if (s.compare === 'def' && g.type === 'factonly') return;
      var state = g.type === 'factonly' ? 'factonly' : s.compare === 'def' ? 'def' : g.count ? 'both' : 'defonly';
      var focus = focusCount[g.key] || 0;
      var label = '';
      if (focusCase && focus) label = String(focus);
      else if (g.type === 'factonly') label = U.cmpWord('factTag') + ' ' + g.count;
      else if (s.compare !== 'def' && g.rels.length > 1 && g.count) label = String(g.count);
      links.push({ key: g.key, from: g.from, to: g.to, type: g.type, state: state, count: g.count, unused: g.unused,
        rels: g.rels, ids: g.ids, subs: Object.keys(g.subs), focus: focus, label: label,
        weight: s.compare === 'def' ? 0.35 : Math.log(1 + (focusCase ? focus : g.count)) / Math.log(1 + (focusCase ? 6 : maxCount)),
        particles: s.compare === 'def' || state === 'defonly' ? 0 : focusCase ? (focus ? 2 : 0) : g.count >= 6 ? 2 : g.count ? 1 : 0,
        sel: g.type === 'factonly' ? { type: 'factonly', id: g.ids[0] } : g.rels.length === 1 ? { type: 'relation', id: g.rels[0] } : { type: 'agg', id: g.from + '|' + g.to } });
    });

    /* ③ the focused case: what it touched stays bright, everything else dims */
    var involved = null;
    if (focusCase) {
      involved = {};
      (idx.runsByCase.get(focusCase) || []).forEach(function (r) {
        if (!HUB.model.visible(r.start, s)) return;
        var k = rep(r.individualId);
        if (k) involved[k] = true;
        if (r.channelId) involved['c:' + r.channelId] = true;
        (idx.callsByRun.get(r.id) || []).forEach(function (c) { if (HUB.model.visible(c.start, s)) { var ck = rep(c.channelId); if (ck) involved[ck] = true; } });
      });
      involved['b:__channels'] = true;
      (idx.handoffsByCase.get(focusCase) || []).forEach(function (hf) { if (hf.from === 'human' && cardByKey.has('i:human')) involved['i:human'] = true; });
      frames.forEach(function (f) {
        var mem = idx.membersDeep.get(f.data.id) || [];
        if (mem.some(function (id) { return involved['i:' + id]; })) involved[f.key] = true;
      });
      cards.forEach(function (c) { c.dim = !involved[c.key]; });
      frames.forEach(function (f) { f.dim = !involved[f.key]; });
      links.forEach(function (l) { l.dim = !l.focus; l.hl = !!l.focus; });
    }

    var bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity;
    cards.concat(frames).forEach(function (o) { bx0 = Math.min(bx0, o.x); by0 = Math.min(by0, o.y); bx1 = Math.max(bx1, o.x + o.w); by1 = Math.max(by1, o.y + o.h); });
    var bbox = isFinite(bx0) ? { x: bx0, y: by0, w: bx1 - bx0, h: by1 - by0 } : { x: 0, y: 0, w: 400, h: 200 };
    // the departments in business order, with their sizes: the one-line summary the canvas shows on top
    var strip = tops.map(function (G) {
      var mem = shown(idx.membersDeep.get(G.id) || []);
      return mem.length ? { id: G.id, name: G.name, members: mem.length, phase: dominantPhase(mem, idx) } : null;
    }).filter(Boolean);
    return { subject: 'org', cards: cards, frames: frames, links: links, bbox: bbox, rows: best.rows.length, involved: involved, strip: strip };
  }

  // the keys a member card can come from or go to: its own group's card/frame first, then the outer ones
  function anchorsOf(groupId, idx) {
    var out = [];
    idx.ancestors(groupId).forEach(function (gid) { out.push('g:' + gid); out.push('b:' + gid); });
    return out;
  }

  HUB.obsSceneOrg = { build: build, anchorsOf: anchorsOf, computeRanks: computeRanks, CARD: { w: NW, h: NH } };
  HUB.render.register('org', { scene: build });
})();
