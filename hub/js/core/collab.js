/* HUB.collab: what the collaboration-trajectory view (协作轨迹图) draws for one case instance: the nodes
   (individuals, or closed groups: the same representatives as the org views), the rails (task lines of the
   definition), the handoffs paired by direction with their basis, the recorded turns in order, and where the
   time cut is. docs/SPEC.md 7; 设计总览 9.4; 任务书 2 的事实边界.
   Rules:
   - only recorded facts are drawn as records: a model whose facts are simulated gives the definition only;
   - a handoff is drawn only on a recorded or protocol basis; adjacency alone is the order of the records,
     never a line;
   - the recorded order is the only time there is: positions are sequence numbers, never durations;
   - evaluations (failure labels, outcomes) are kept apart from the facts so the view can hide them as a layer.
   Pure: no DOM. hub/tools/check_collab.js runs every case through it. */
(function () {
  'use strict';
  var HUB = (window.HUB = window.HUB || {});
  var VB = { w: 1000, h: 600 };
  var COLORS = 6;                       // --oc-c1 .. --oc-c6 in css/collab.css
  var cache = new Map();                // the part that does not depend on the time cut
  var byCase = new WeakMap();           // facts.turns -> Map(caseId -> turns in order)

  /* where the records of a model come from:
     turns: a reader kept every recorded turn (real trajectories);
     runs:  real runs without the turn level (sessions of this machine): one record per run;
     none:  nothing recorded (simulated cases, a definition without facts). */
  function source(m) {
    var F = m && m.facts;
    if (!m || !F) return { kind: 'none', why: 'empty' };
    if (m.synthetic) return { kind: 'none', why: m.factSource && m.factSource.kind === 'error' ? 'error' : 'simulated' };
    if (Array.isArray(F.turns) && F.turns.length) return { kind: 'turns' };
    if (F.runs && F.runs.length) return { kind: 'runs' };
    return { kind: 'none', why: 'empty' };
  }

  function turnsOf(m, caseId) {
    var all = m.facts.turns;
    var map = byCase.get(all);
    if (!map) {
      map = new Map();
      all.forEach(function (t) { (map.get(t.caseId) || map.set(t.caseId, []).get(t.caseId)).push(t); });
      map.forEach(function (list) { list.sort(function (a, b) { return a.seq - b.seq; }); });
      byCase.set(all, map);
    }
    return map.get(caseId) || [];
  }

  function clip(s, n) { s = String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n) + '…' : s; }
  // the label on the chart: the name without a trailing note in brackets. Imported orchestrations put remarks there,
  // some of them evaluations ("本次失败的归因对象"), which must not show when the evaluation layer is off
  function shortName(s) { var t = String(s == null ? '' : s).replace(/\s*[（(][^（）()]*[）)]\s*$/, ''); return t || String(s || ''); }

  /* ---------- the layout: left to right from the person (or the first speaker) along rails and handoffs ----------
     Nodes nobody is linked to sit at a round table when there are no links at all (a group chat read in order),
     else in a row under the graph. A column holds at most six. Pure numbers in the 1000 x 600 box; the page
     stretches them to the room it has. Returns the shape: 'table' or 'graph'. */
  function layout(nodes, links, firstKey) {
    var byKey = {}, adj = {};
    nodes.forEach(function (n) { byKey[n.key] = n; adj[n.key] = {}; });
    links.forEach(function (l) { if (adj[l[0]] && adj[l[1]] && l[0] !== l[1]) { adj[l[0]][l[1]] = true; adj[l[1]][l[0]] = true; } });
    var linked = nodes.filter(function (n) { return Object.keys(adj[n.key]).length; });
    var loose = nodes.filter(function (n) { return !Object.keys(adj[n.key]).length; });
    var rank = function (n) { return (n.ghost ? 1e6 : 0) + (n.first < 1e9 ? n.first : 5e5) + n.order * 1e-3; };
    var maxRecs = Math.max.apply(null, [1].concat(nodes.map(function (n) { return n.recs; })));
    var radius = function (n, f) { return (n.ghost ? 21 : (n.glyph === 'hub' || n.type === 'group' ? 31 : 25) + 11 * Math.sqrt(n.recs / maxRecs)) * f; };

    if (!linked.length) {
      // no line to follow: a round table in order of first speaking
      loose.sort(function (a, b) { return rank(a) - rank(b); });
      var n0 = loose.length, f0 = n0 > 8 ? 0.72 : n0 > 5 ? 0.86 : 1;
      loose.forEach(function (n, j) {
        var a = Math.PI + j * 2 * Math.PI / Math.max(1, n0);
        n.x = n0 === 1 ? 500 : 500 + Math.cos(a) * (n0 === 2 ? 190 : 320);
        n.y = n0 === 1 ? 290 : 290 + Math.sin(a) * (n0 === 2 ? 0 : 175);
        n.r = radius(n, f0); n.layer = j;
      });
      return 'table';
    }
    var human = linked.find(function (n) { return n.glyph === 'human'; });
    var root = human || (firstKey && adj[firstKey] && Object.keys(adj[firstKey]).length ? byKey[firstKey] : null) || linked.slice().sort(function (a, b) { return rank(a) - rank(b); })[0];
    var layer = {}, queue = [root.key], L = 0;
    layer[root.key] = 0;
    // other connected parts follow after the main one, each from its own first node
    var rest = linked.slice().sort(function (a, b) { return rank(a) - rank(b); });
    for (;;) {
      while (queue.length) {
        var a1 = queue.shift();
        Object.keys(adj[a1]).forEach(function (b) { if (layer[b] == null) { layer[b] = layer[a1] + 1; queue.push(b); } });
      }
      L = Math.max.apply(null, Object.keys(layer).map(function (k) { return layer[k]; }));
      var next = rest.find(function (n) { return layer[n.key] == null; });
      if (!next) break;
      layer[next.key] = L + 1; queue.push(next.key);
    }
    var cols = [];
    for (var li = 0; li <= L; li++) {
      var col = linked.filter(function (n) { return layer[n.key] === li; }).sort(function (a, b) { return rank(a) - rank(b); });
      var shown = col.filter(function (n) { return !n.ghost; }), hid = col.filter(function (n) { return n.ghost; }), ordered = shown.slice();
      hid.forEach(function (n, j) { if (j % 2) ordered.push(n); else ordered.unshift(n); });   // members not in the record go to both ends
      for (var c0 = 0; c0 < ordered.length; c0 += 6) cols.push(ordered.slice(c0, c0 + 6));
    }
    // nodes nobody is linked to: rows of eight under the graph, which gives up room for them
    var per = 8, rows = Math.ceil(loose.length / per);
    var C = cols.length, x0 = 150, x1 = 850, top = 118, bot = rows ? Math.max(250, 440 - (rows - 1) * 60) : 470;
    var f = C > 7 ? 0.62 : C > 5 ? 0.78 : cols.some(function (c) { return c.length > 4; }) ? 0.86 : 1;
    cols.forEach(function (col, ci) {
      var x = C === 1 ? 500 : x0 + ci * (x1 - x0) / (C - 1), n = col.length;
      col.forEach(function (nd, j) {
        nd.x = x; nd.layer = ci;
        nd.y = n === 1 ? (top + bot) / 2 + 6 : n === 2 ? (top + bot) / 2 + 6 + (j ? 105 : -105) : top + j * (bot - top) / (n - 1);
        nd.r = radius(nd, f);
      });
    });
    loose.sort(function (a, b) { return rank(a) - rank(b); });
    loose.forEach(function (n, j) { n.x = 110 + (j % per) * 111; n.y = 548 - (rows - 1 - Math.floor(j / per)) * 66; n.r = radius(n, Math.min(f, 0.86)); n.layer = C + j; n.loose = true; });
    return 'graph';
  }

  /* ---------- everything that does not depend on the time cut ---------- */
  function buildStatic(m, s, inst, src) {
    var F = m.facts, def = m.def, idx = m.idx, L = HUB.util.LABELS;
    var repOf = function (id) { return HUB.orgRep ? HUB.orgRep(id, s, m) : 'i:' + id; };
    var real = src.kind !== 'none';

    /* records */
    var recs = [];
    if (src.kind === 'turns') {
      turnsOf(m, inst.id).forEach(function (t) {
        recs.push({ seq: t.seq, id: t.id, ind: t.individualId, kind: t.kind, text: t.text || '', to: t.to || null, runId: t.runId || null, at: t.at,
          tool: t.tool || null, calls: t.calls || null, sourceIndex: t.sourceIndex });
      });
    } else if (src.kind === 'runs') {
      (idx.runsByCase.get(inst.id) || []).slice().sort(function (a, b) { return a.start - b.start; }).forEach(function (r, i) {
        var task = idx.task.get(r.taskId);
        recs.push({ seq: i + 1, id: r.id, ind: r.individualId, kind: 'run', text: task ? task.name : '', to: null, runId: r.id, at: r.start, tool: null, calls: null, sourceIndex: null });
      });
    }
    var N = recs.length;
    recs.forEach(function (r) { r.node = repOf(r.ind); });
    // a run: consecutive records of one run; pos and len drive the ring around the speaker and the capsule in the full chart
    for (var i0 = 0; i0 < N;) {
      var j0 = i0;
      while (j0 + 1 < N && recs[j0 + 1].runId && recs[j0 + 1].runId === recs[i0].runId) j0++;
      for (var k0 = i0; k0 <= j0; k0++) { recs[k0].pos = k0 - i0 + 1; recs[k0].len = j0 - i0 + 1; recs[k0].first = i0 + 1; }
      i0 = j0 + 1;
    }

    /* handoffs of this instance: only the ones with a recorded or protocol basis */
    var hands = [], internal = 0, undrawn = 0;
    if (real) (idx.handoffsByCase.get(inst.id) || []).forEach(function (h) {
      var basis = h.basis || (src.kind === 'runs' ? 'explicit' : null);
      if (basis !== 'explicit' && basis !== 'protocol') { undrawn++; return; }
      var fk = repOf(h.from), tk = repOf(h.to);
      var sent = h.sentSeq, got = h.gotSeq;
      if (sent == null) {   // a source without record numbers (sessions of this machine): the nearest records around the handoff
        var before = recs.filter(function (r) { return r.ind === h.from && r.at <= h.at; });
        var after = recs.filter(function (r) { return r.ind === h.to && r.at >= h.at; });
        sent = before.length ? before[before.length - 1].seq : Math.max(1, recs.filter(function (r) { return r.at <= h.at; }).length);
        got = after.length ? after[0].seq : null;
        if (got != null && got < sent) sent = got;
      }
      if (fk === tk) { internal++; return; }   // inside one closed group
      hands.push({ id: h.id, from: fk, to: tk, fromInd: h.from, toInd: h.to, basis: basis, sent: sent, got: got == null ? null : got, relationId: h.relationId || null, key: fk + '>' + tk });
    });
    hands.sort(function (a, b) { return a.sent - b.sent; });
    var pairs = {}, pairList = [];
    hands.forEach(function (h) {
      var p = pairs[h.key];
      if (!p) { p = pairs[h.key] = { key: h.key, from: h.from, to: h.to, list: [], at: { explicit: [], protocol: [] }, declared: false, rels: [], undecl: [] }; pairList.push(p); }
      p.list.push(h); p.at[h.basis].push(h.sent);
      // between two closed groups some handoffs can be on a task line and some not: keep the ones that are not
      if (h.relationId) { p.declared = true; if (p.rels.indexOf(h.relationId) < 0) p.rels.push(h.relationId); } else p.undecl.push(h.sent);
    });

    /* rails: the task lines of the definition, between the same representatives */
    var showHuman = !(s.overlays && s.overlays.human === false);
    var rails = {}, railList = [];
    def.relations.forEach(function (r) {
      if (r.type !== 'task' || !idx.ind.has(r.from) || !idx.ind.has(r.to)) return;
      var fk = repOf(r.from), tk = repOf(r.to);
      if (fk === tk) return;
      var k = fk + '>' + tk, x = rails[k];
      if (!x) { x = rails[k] = { key: k, from: fk, to: tk, rels: [], used: false }; railList.push(x); }
      x.rels.push(r.id);
    });
    railList.forEach(function (x) { x.used = !!(pairs[x.key] && pairs[x.key].declared); });

    /* nodes */
    var cmpMode = s.compare === 'def' ? 'def' : s.compare === 'fact' ? 'fact' : 'both';
    var defOnly = !real || cmpMode === 'def';   // nothing recorded is drawn: the members and the task lines of the definition
    var want = {};   // key -> true
    if (!defOnly) {
      recs.forEach(function (r) { want[r.node] = true; });
      hands.forEach(function (h) { want[h.from] = true; want[h.to] = true; });
    }
    if (defOnly || cmpMode === 'both') {
      railList.forEach(function (x) { want[x.from] = true; want[x.to] = true; });
      // every agent of the definition, so the ones that are not in this record can be seen as such
      def.individuals.forEach(function (x) { if (x.kind === 'agent' && !x.factOnly) want[repOf(x.id)] = true; });
    }
    if (!Object.keys(want).length) def.individuals.forEach(function (x) { if (x.kind === 'agent') want[repOf(x.id)] = true; });
    var appear = {}, firstSeq = {}, handEnd = {};
    recs.forEach(function (r) { appear[r.node] = (appear[r.node] || 0) + 1; if (firstSeq[r.node] == null) firstSeq[r.node] = r.seq; });
    hands.forEach(function (h) { handEnd[h.from] = true; handEnd[h.to] = true; });
    var nodes = [], nodeByKey = {};
    Object.keys(want).forEach(function (key, order) {
      var id = key.slice(2), n;
      if (key.slice(0, 2) === 'g:') {
        var g = idx.group.get(id);
        if (!g) return;
        var mem = idx.membersDeep.get(id) || [];
        n = { key: key, type: 'group', id: id, name: shortName(g.name), full: g.name, glyph: 'group', members: mem.length, level: g.level, sel: { type: 'group', id: id } };
      } else {
        var x = idx.ind.get(id);
        if (!x) return;
        if (x.kind === 'human' && !showHuman && !appear[key]) return;
        n = { key: key, type: 'ind', id: id, name: shortName(x.name), full: x.name, glyph: x.kind === 'human' ? 'human' : x.kind === 'meta' ? 'meta' : x.isHub ? 'hub' : 'agent',
          members: 1, sel: { type: 'individual', id: id }, factOnly: !!x.factOnly };
      }
      n.recs = appear[key] || 0; n.first = firstSeq[key] == null ? 1e9 : firstSeq[key]; n.order = order;
      // defined, not in this record: no record of its own and no handoff to or from it. One that was handed something
      // and never spoke is in the record, with no records of its own
      n.ghost = real && !n.recs && !handEnd[key];
      nodes.push(n); nodeByKey[key] = n;
    });
    // colours: the person is amber; the others take the palette in order of first speaking; members not in the record are grey
    var ci = 0;
    nodes.slice().sort(function (a, b) { return a.first - b.first || a.order - b.order; }).forEach(function (n) {
      n.color = n.glyph === 'human' ? 'human' : n.ghost ? 'ghost' : !real ? 'def' : 'c' + (1 + (ci++ % COLORS));
    });
    var has = function (k) { return !!nodeByKey[k]; };
    var links = [];
    if (cmpMode !== 'fact' || !real) railList.forEach(function (x) { if (has(x.from) && has(x.to)) links.push([x.from, x.to]); });
    if (cmpMode !== 'def') pairList.forEach(function (p) { if (has(p.from) && has(p.to)) links.push([p.from, p.to]); });
    var shape = layout(nodes, links, recs.length ? recs[0].node : null);

    /* tool calls: a channel line, not a handoff. A request is a record that carries calls; a result is a record of kind tool */
    var tools = [], pending = {};
    recs.forEach(function (r) {
      if (r.calls && r.calls.length) { pending[r.ind] = r; r.toolReq = { name: r.calls.map(function (c) { return c.name; }).join('、'), resSeq: null }; }
      if (r.kind === 'tool') {
        var req = pending[r.ind] || null;
        var t = { seq: r.seq, reqSeq: req ? req.seq : null, ind: r.ind, node: r.node, name: req ? req.toolReq.name : (r.tool || '工具'), channel: r.tool || '工具',
          error: /^\s*error\b\s*[:：]/i.test(r.text) };
        if (req) { req.toolReq.resSeq = r.seq; pending[r.ind] = null; }
        r.toolRes = t; tools.push(t);
      }
    });
    var chan = null;
    if (tools.length || recs.some(function (r) { return r.toolReq; })) {
      var owner = nodeByKey[(recs.find(function (r) { return r.toolRes || r.toolReq; }) || {}).node];
      var names = [];
      recs.forEach(function (r) { if (r.kind === 'tool' && r.tool && names.indexOf(r.tool) < 0) names.push(r.tool); });
      if (owner) chan = { owner: owner.key, name: names.join('、') || '工具', x: owner.x, y: Math.max(64, owner.y - owner.r - 128), w: 168, h: 40 };
    }

    /* evaluations: after-the-fact judgements, never execution errors */
    var evals = [];
    if (real && inst.mistake) {
      var mk = inst.mistake, at = recs.find(function (r) { return r.sourceIndex === mk.turnIndex; });
      evals.push({ seq: at ? at.seq : null, ind: mk.individualId, node: at ? at.node : repOf(mk.individualId), reason: mk.reason || '', by: mk.source || '数据集', consistent: mk.consistent !== false,
        actualSpeaker: mk.actualSpeaker || null });
    }
    var result = real && inst.result ? { result: inst.result, note: inst.note || '' } : null;

    /* how many changes of speaker have no handoff behind them: order only */
    var gotAt = {};
    hands.forEach(function (h) { if (h.got != null) gotAt[h.got + '|' + h.to] = true; });
    var orderOnly = 0;
    for (var q = 1; q < N; q++) if (recs[q].node !== recs[q - 1].node && nodeByKey[recs[q].node] && nodeByKey[recs[q].node].glyph !== 'human' && !gotAt[recs[q].seq + '|' + recs[q].node]) orderOnly++;

    /* what can be said about the definition */
    var cmp = HUB.analysis.comparability(m);
    var match = [], declOnly = [], factOnly = [];
    railList.forEach(function (x) { if (has(x.from) && has(x.to)) (x.used ? match : declOnly).push(x.key); });
    pairList.forEach(function (p) { if (!p.declared) factOnly.push(p.key); });

    var st = { src: src, inst: inst, real: real, cmpMode: cmpMode, cmp: cmp, recs: recs, N: N, nodes: nodes, nodeByKey: nodeByKey, rails: railList, railByKey: rails,
      pairs: pairList, pairByKey: pairs, hands: hands, tools: tools, chan: chan, evals: evals, result: result,
      counts: { explicit: hands.filter(function (h) { return h.basis === 'explicit'; }).length, protocol: hands.filter(function (h) { return h.basis === 'protocol'; }).length,
        orderOnly: orderOnly, internal: internal, undrawn: undrawn, runs: recs.reduce(function (n, r) { return n + (r.runId && r.pos === 1 ? 1 : 0); }, 0) },
      match: match, declOnly: declOnly, factOnly: factOnly, vb: VB, shape: shape,
      absent: nodes.filter(function (n) { return n.ghost; }).map(function (n) { return n.name; }) };
    st.captions = captions(st, m, L);
    return st;
  }

  /* one sentence at the records worth stopping at; every sentence is computed from the facts */
  function captions(st, m, L) {
    var caps = {};
    // a Latin name inside a Chinese sentence gets a space on each side; tidy() takes the spare ones off again
    var tidy = function (t) { return t.replace(/ {2,}/g, ' ').replace(/ ([：；，。）])/g, '$1').replace(/([（：]) /g, '$1').trim(); };
    var add = function (seq, text, kind) { if (seq) (caps[seq] || (caps[seq] = [])).push({ text: tidy(text), kind: kind || 'fact' }); };
    var nm = function (k) { var n = st.nodeByKey[k] ? st.nodeByKey[k].name : k; return (/^[!-~]/.test(n) ? ' ' : '') + n + (/[!-~]$/.test(n) ? ' ' : ''); };
    var no = function (seq) { return '第 ' + seq + ' 条'; };
    if (!st.real || !st.N) return caps;
    add(1, no(1) + ' · ' + nm(st.recs[0].node) + '开场');
    var seen = {};
    st.hands.forEach(function (h) {
      var k = (seen[h.key] = (seen[h.key] || 0) + 1), tot = st.pairByKey[h.key].list.length;
      if (k === 1) add(h.sent, no(h.sent) + ' · ' + nm(h.from) + ' → ' + nm(h.to) + '：' + L.handoffBasis[h.basis] + '的第一次交接');
      else if (tot >= 10 && (k % 10 === 0 || k === tot)) add(h.sent, no(h.sent) + ' · ' + nm(h.from) + '第 ' + k + ' 次交给' + nm(h.to) + (k === tot ? '（这份记录里的最后一次）' : ''));
    });
    var byGot = {};
    st.hands.forEach(function (h) { if (h.got != null && h.got > h.sent) (byGot[h.got + '|' + h.to] || (byGot[h.got + '|' + h.to] = [])).push(h); });
    Object.keys(byGot).forEach(function (k) {
      var g = byGot[k];
      if (g.length > 1) add(g[0].got, '第 ' + g.map(function (h) { return h.sent; }).join('、') + ' 条发出的 ' + g.length + ' 次交接，都在' + no(g[0].got) + '被' + nm(g[0].to) + '接住；在这之前' + nm(g[0].to) + '没有发言');
    });
    st.hands.forEach(function (h) { if (h.got == null) add(h.sent, no(h.sent) + ' · ' + nm(h.from) + ' → ' + nm(h.to) + '：发出之后，' + nm(h.to) + '在这份记录里没有再发言'); });
    var firstTool = st.recs.find(function (r) { return r.toolReq || r.toolRes; });
    if (firstTool) add(firstTool.seq, no(firstTool.seq) + ' · 第一次工具调用：' + (firstTool.toolReq ? firstTool.toolReq.name : firstTool.toolRes.name) + '（渠道线，不是交接）');
    st.tools.forEach(function (t) { if (t.error) add(t.seq, no(t.seq) + ' · 工具返回的正文以 Error 开头：' + clip(st.recs[t.seq - 1].text, 80) + '。这是执行时报的错，属于事实'); });
    st.evals.forEach(function (e) {
      if (e.seq) add(e.seq, e.by + ' 标注' + no(e.seq) + '（' + shortName(HUB.model.name('individual', e.ind, m)) + '）是失误' + (e.consistent ? '' : '；这一条的发言者是' + (e.actualSpeaker || '别人') + '，与标注的个体不一致') +
        (e.reason ? '。标注原文：' + clip(e.reason, 150) : ''), 'eval');
    });
    add(st.N, no(st.N) + ' · 这份记录到此结束');
    if (st.result) add(st.N, '记录的结局：' + ({ success: '成功', failure: '失败', unfinished: '未完成' }[st.result.result] || st.result.result) + (st.result.note ? '（' + clip(st.result.note, 90) + '）' : ''), 'eval');
    return caps;
  }

  /* ---------- the time cut <-> the record it stops at ---------- */
  function cursorOf(st, time) {
    if (time == null) return st.N;
    var n = 0;
    while (n < st.N && st.recs[n].at <= time) n++;
    return n;
  }
  // the time that shows the first n records and nothing after them; null is "everything".
  // Records that share one instant (runs started together) cannot be cut apart: the cut goes after the whole group,
  // or before it when stepping back. Recorded turns never share an instant.
  function timeOf(st, n, back) {
    n = Math.max(0, Math.min(st.N, n));
    while (n > 0 && n < st.N && st.recs[n].at === st.recs[n - 1].at) n += back ? -1 : 1;
    if (!st.N || n >= st.N) return null;
    return n ? Math.max(st.recs[n - 1].at, st.recs[n].at - 1) : st.recs[0].at - 1;
  }

  function build(m, s) {
    var src = source(m);
    var inst = src.kind === 'none' ? null : HUB.model.instanceOf(s, m);
    if (src.kind !== 'none' && !inst) src = { kind: 'none', why: 'empty' };
    var sig = [m.id, m.rev, src.kind, inst ? inst.id : '-', s.compare, s.depth.org, (s.expanded.org || []).join(','), (s.collapsed.org || []).join(','),
      s.overlays && s.overlays.human === false ? 'nh' : ''].join('|');
    var st = cache.get(sig);
    if (!st) {
      if (cache.size > 40) cache.clear();
      st = buildStatic(m, s, inst, src);
      st.sig = sig;
      cache.set(sig, st);
    }
    return { st: st, cursor: cursorOf(st, s.time) };
  }

  HUB.collab = { build: build, source: source, cursorOf: cursorOf, timeOf: timeOf, VB: VB, turnsOf: turnsOf, shortName: shortName };
})();
