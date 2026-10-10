/* HUB.views: the registry of view presets (①..⑥ and user-saved views). */
(function () {
  'use strict';
  var HUB = (window.HUB = window.HUB || {});
  var list = [];
  var KEY = 'hub.myviews.v1';

  function register(v) { list = list.filter(function (x) { return x.id !== v.id; }); list.push(v); list.sort(function (a, b) { return (a.num || 99) - (b.num || 99); }); }
  function get(id) { return list.find(function (x) { return x.id === id; }) || null; }
  function current(state) {
    for (var i = 0; i < list.length; i++) { if (list[i].test && list[i].test(state)) return list[i].id; }
    return null;
  }
  function go(id) {
    var v = get(id);
    if (!v) return;
    var st = HUB.store.get();
    HUB.store.set(v.apply(st, HUB.model.current));
  }
  var noOverrides = function (s, subject) { return !(s.expanded[subject] || []).length && !(s.collapsed[subject] || []).length; };
  var caseFocus = function (st, m) {
    var c = HUB.model.instanceOf(st, m);
    return c ? { type: 'case', id: c.id } : null;
  };
  // Only the four views of the whole system are registered here. ⑤⑥ (one run's decisions and calls) are a drill-down:
  // they open in the side panel from an individual (selection {type:'run'}), not from the top bar (user decision 10-10).
  register({
    id: 'v1', num: 1, name: '完整协作图', short: '完整协作', question: '看清所有个体和关系', subject: 'org',
    apply: function () { return { subject: 'org', depth: { org: 3 }, expanded: { org: [] }, collapsed: { org: [] }, focus: null, present: 'graph' }; },
    test: function (s) { return s.subject === 'org' && !s.focus && s.depth.org === 3 && noOverrides(s, 'org'); }
  });
  register({
    id: 'v2', num: 2, name: '部门架构图', short: '部门架构', question: '看清组织和分工', subject: 'org',
    apply: function () { return { subject: 'org', depth: { org: 1 }, expanded: { org: [] }, collapsed: { org: [] }, focus: null, present: 'graph' }; },
    test: function (s) { return s.subject === 'org' && !s.focus && s.depth.org === 1 && noOverrides(s, 'org'); }
  });
  register({
    id: 'v3', num: 3, name: '单案例路由图', short: '单案例路由', question: '看清一次协作实际怎么发生', subject: 'org',
    apply: function (st, m) {
      var f = caseFocus(st, m);
      return { subject: 'org', focus: f, instanceId: f ? f.id : st.instanceId, depth: { org: Math.max(2, st.depth.org) }, present: 'graph' };
    },
    test: function (s) { return s.subject === 'org' && s.focus && s.focus.type === 'case'; }
  });
  register({
    id: 'v4', num: 4, name: '业务流程图', short: '业务流程', question: '看清系统按什么规则运转', subject: 'process',
    apply: function (st) {
      return { subject: 'process', focus: st.focus && st.focus.type === 'case' ? st.focus : null, present: 'graph' };
    },
    test: function (s) { return s.subject === 'process'; }
  });

  /* ---------- user views ---------- */
  function loadMine() {
    try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (e) { return []; }
  }
  function saveMine(arr) { try { localStorage.setItem(KEY, JSON.stringify(arr)); } catch (e) { /* storage blocked */ } }
  function saveCurrent(label) {
    var st = HUB.store.get();
    var snap = JSON.parse(JSON.stringify(st));
    delete snap.selection;
    var mine = loadMine();
    var item = { id: 'my' + Date.now(), name: label || ('我的视图 ' + (mine.length + 1)), state: snap };
    mine.push(item);
    saveMine(mine);
    return item;
  }
  function removeMine(id) { saveMine(loadMine().filter(function (x) { return x.id !== id; })); }
  function goMine(id) {
    var item = loadMine().find(function (x) { return x.id === id; });
    if (!item) return;
    if (item.state.caseId !== HUB.store.get().caseId) HUB.store.switchCase(item.state.caseId);
    HUB.store.set(item.state);
  }

  HUB.views = { register: register, list: function () { return list.slice(); }, get: get, current: current, go: go,
    mine: loadMine, saveCurrent: saveCurrent, removeMine: removeMine, goMine: goMine };

  /* Renderer registry: one renderer per subject ('org' | 'process' | 'exec'). */
  HUB.render = HUB.render || {
    _r: {},
    register: function (subject, renderer) { this._r[subject] = renderer; },
    get: function (subject) { return this._r[subject] || null; }
  };

  /* Which node stands for an individual in the org subject: the outermost closed group above it, else itself. */
  HUB.orgRep = function (indId, state, model) {
    var m = model || HUB.model.current;
    var x = m.idx.ind.get(indId);
    if (!x || !x.groupId) return 'i:' + indId;
    var chain = m.idx.ancestors(x.groupId).slice().reverse(); // top-level first
    for (var i = 0; i < chain.length; i++) {
      var g = m.idx.group.get(chain[i]);
      if (!HUB.store.isOpen('org', g.id, g.level, state)) return 'g:' + g.id;
    }
    return 'i:' + indId;
  };
})();
