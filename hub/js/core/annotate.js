/* HUB.annotate: the case documents' decision records, as the coarse-grained layer of a real session.
   A decision written in decisions/<agent>.md can say where in a session it happened (turn, steps).  The parser keeps those
   as model.annotations; this turns the ones that belong to a loaded session into an annotation set of the trace contract
   (trace/packages/contract: AnnotationSet), which the Trace view draws over the parsed turns and steps: the decision chain
   on top, the session's own steps as its evidence underneath.  Nothing is guessed: a record whose turn or steps are not in
   the session, or that overlaps another, is left out and reported.
   Pure: no DOM.  hub/tools/check_from_docs.js tests it. */
(function () {
  'use strict';
  var HUB = (window.HUB = window.HUB || {});

  function stepCount(session) { return session.turns.reduce(function (n, t) { return n + t.steps.length; }, 0); }

  /* the layer for one session of the model, or null when no record points at it.  layer.problems: what could not be placed. */
  function layerFor(model, session) {
    var items = ((model && model.annotations) || []).filter(function (a) { return a.session === session.id; });
    if (!items.length) return null;
    var taken = {}, problems = [], placed = [];
    items.forEach(function (a) {
      var turn = session.turns.filter(function (t) { return t.index === a.turn; })[0] || session.turns[a.turn - 1];
      if (!turn) { problems.push(a.id + '：会话里没有第 ' + a.turn + ' 轮'); return; }
      var ids = [], bad = null;
      a.steps.forEach(function (n) { var st = turn.steps[n - 1]; if (st) ids.push(st.id); else bad = n; });
      if (bad != null) { problems.push(a.id + '：第 ' + a.turn + ' 轮没有第 ' + bad + ' 步（这一轮共 ' + turn.steps.length + ' 步）'); return; }
      var pos = a.steps.slice().sort(function (p, q) { return p - q; });
      if (pos.some(function (n, i) { return i && n !== pos[i - 1] + 1; })) { problems.push(a.id + '：步骤不连续'); return; }
      if (ids.some(function (id) { return taken[id]; })) { problems.push(a.id + '：和别的记录占了同一步'); return; }
      ids.forEach(function (id) { taken[id] = true; });
      var d = a.decision;
      placed.push({ at: turn.index * 100000 + pos[0], seg: {
        id: 'doc:' + a.id, kind: 'decision', turn: turn.id, steps: ids, title: d.title, action: d.action,
        trigger: d.trigger || undefined, alternatives: (d.alternatives || []).slice(), choice: d.choice || undefined,
        reason: d.reason || undefined, impact: d.impact || undefined, flags: [] } });
    });
    placed.sort(function (p, q) { return p.at - q.at; });
    return { version: '0.1', session: session.id, producer: { kind: 'human', name: 'case:' + model.id, at: session.updatedAt || session.startedAt },
      basis: { steps: stepCount(session), updatedAt: session.updatedAt }, segments: placed.map(function (p) { return p.seg; }),
      problems: problems, total: items.length };
  }

  HUB.annotate = { layerFor: layerFor };
})();
