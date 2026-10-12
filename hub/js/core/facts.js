/* HUB.facts: where the facts of a model come from.
   A source builds the definition (what the collaboration is written to be). The facts (what happened) are a second,
   separate axis, and this module is where it plugs in. Two kinds of provider:
   - the baseline: always there; gives the facts when nothing better is known (the simulator, sources/sim.js);
   - recorded providers: replace them with a record that comes with the case (a traces/ folder; later a session log
     or a workspace), when they apply.
   A source never decides this itself: once its definition is built it calls HUB.facts.provide(model, ctx).
   ctx: { id, override } for the baseline; { get, parts } for recorded ones (read a file of the case, what the md parsed). */
(function () {
  'use strict';
  var HUB = (window.HUB = window.HUB || {});
  var baseline = null, recorded = [];

  /* a provider is { id, baseline: true, provide(model, ctx) -> facts }
     or { id, applies(model, ctx) -> bool, provide(model, ctx) -> model | Promise<model> } */
  function register(p) {
    if (p.baseline) baseline = p;
    else recorded = recorded.filter(function (x) { return x.id !== p.id; }).concat([p]);
  }
  function empty() {
    return { synthetic: true, span: { start: 0, end: 0 }, cases: [], tasks: [], runs: [], decisions: [], calls: [], handoffs: [], deliveries: [],
      gateEvents: [], channelEvents: [], versionEvents: [], actions: [], messages: [] };
  }

  /* the model with its facts: at once when only the baseline applies, else a promise */
  function provide(model, ctx) {
    ctx = ctx || {};
    model.facts = baseline ? baseline.provide(model, ctx) : empty();
    return recorded.filter(function (p) { return p.applies(model, ctx); }).reduce(function (cur, p) {
      return cur && cur.then ? cur.then(function (m) { return p.provide(m, ctx); }) : p.provide(cur, ctx);
    }, model);
  }

  HUB.facts = { register: register, provide: provide };
})();
