/* HUB.store: the observation state, its history, and the link in the address bar. */
(function () {
  'use strict';
  var HUB = (window.HUB = window.HUB || {});

  var DEFAULT = {
    caseId: 'deep_five_minds',
    instanceId: null,
    subject: 'org',
    depth: { org: 1, process: 1, exec: 1 },
    expanded: { org: [], process: [], exec: [] },
    collapsed: { org: [], process: [], exec: [] },
    focus: null,
    time: null,
    compare: 'both',
    lines: { task: true, info: false, watch: true, channel: false },
    overlays: { human: true, channels: false, delivery: false, lanes: true, evals: true },   /* evals: after-the-fact judgements (failure labels, outcomes), a layer apart from the facts */
    present: 'graph',
    selection: null,
    drawer: true,
    merged: []   /* quick-aggregate: [{id, memberIds, name}]; view-only, never touches def/facts */
  };
  var MERGE_KEYS = ['depth', 'expanded', 'collapsed', 'lines', 'overlays'];
  var MAX_DEPTH = { org: 3, process: 2, exec: 2 };

  function clone(x) { return JSON.parse(JSON.stringify(x)); }
  function same(a, b) { return JSON.stringify(a) === JSON.stringify(b); }

  function merge(base, patch) {
    var next = clone(base);
    Object.keys(patch || {}).forEach(function (k) {
      var v = patch[k];
      if (MERGE_KEYS.indexOf(k) >= 0 && v && typeof v === 'object') {
        next[k] = Object.assign({}, next[k], clone(v));
      } else {
        next[k] = v === undefined ? next[k] : clone(v);
      }
    });
    ['org', 'process', 'exec'].forEach(function (s) {
      next.depth[s] = Math.max(1, Math.min(MAX_DEPTH[s], next.depth[s] || 1));
    });
    return next;
  }

  var state = clone(DEFAULT);
  var past = [], future = [];
  var subs = [];

  function notify(prev) {
    subs.slice().forEach(function (fn) {
      try { fn(state, prev); } catch (e) { console.error('[HUB.store] subscriber failed', e); }
    });
    HUB.bus && HUB.bus.emit('state', { state: state, prev: prev });
    writeHash();
  }

  function set(patch, opts) {
    opts = opts || {};
    var next = merge(state, patch);
    if (same(next, state)) return state;
    var prev = state;
    if (opts.history !== false) {
      past.push(prev);
      if (past.length > 200) past.shift();
      future = [];
    }
    state = next;
    notify(prev);
    return state;
  }

  function back() {
    if (!past.length) return;
    var prev = state;
    future.push(state);
    state = past.pop();
    notify(prev);
  }
  function forward() {
    if (!future.length) return;
    var prev = state;
    past.push(state);
    state = future.pop();
    notify(prev);
  }

  function isOpen(subject, id, level, st) {
    var s = st || state;
    var openByDepth = level < s.depth[subject];
    var ex = s.expanded[subject] || [], co = s.collapsed[subject] || [];
    return (openByDepth || ex.indexOf(id) >= 0) && co.indexOf(id) < 0;
  }
  function toggle(subject, id, level) {
    var open = isOpen(subject, id, level);
    var ex = (state.expanded[subject] || []).filter(function (x) { return x !== id; });
    var co = (state.collapsed[subject] || []).filter(function (x) { return x !== id; });
    var byDepth = level < state.depth[subject];
    if (open) { if (byDepth) co.push(id); }
    else if (!byDepth) ex.push(id);
    var pe = {}, pc = {};
    pe[subject] = ex; pc[subject] = co;
    set({ expanded: pe, collapsed: pc });
  }
  // Global granularity change clears the per-object overrides for that subject.
  function setDepth(subject, d) {
    var dp = {}, ex = {}, co = {};
    dp[subject] = d; ex[subject] = []; co[subject] = [];
    set({ depth: dp, expanded: ex, collapsed: co });
  }
  function switchCase(caseId) {
    set({
      caseId: caseId, instanceId: null, focus: null, selection: null, time: null,
      expanded: { org: [], process: [], exec: [] }, collapsed: { org: [], process: [], exec: [] },
      subject: state.subject === 'exec' ? 'org' : state.subject
    });
  }

  /* ---------- address bar ---------- */
  function toHash(s) {
    var p = new URLSearchParams();
    p.set('c', s.caseId);
    if (s.instanceId) p.set('i', s.instanceId);
    p.set('s', s.subject);
    p.set('d', [s.depth.org, s.depth.process, s.depth.exec].join('.'));
    var ex = [], co = [];
    ['org', 'process', 'exec'].forEach(function (k) {
      if ((s.expanded[k] || []).length) ex.push(k + ':' + s.expanded[k].join(','));
      if ((s.collapsed[k] || []).length) co.push(k + ':' + s.collapsed[k].join(','));
    });
    if (ex.length) p.set('e', ex.join(';'));
    if (co.length) p.set('x', co.join(';'));
    if (s.focus) p.set('f', s.focus.type + ':' + s.focus.id);
    if (s.time != null) p.set('t', String(Math.round(s.time)));
    if (s.compare !== 'both') p.set('m', s.compare);
    p.set('l', Object.keys(s.lines).filter(function (k) { return s.lines[k]; }).join(','));
    // the evaluation layer is on unless a link says "noeval", so links written before it existed read the same
    p.set('o', Object.keys(s.overlays).filter(function (k) { return k !== 'evals' && s.overlays[k]; }).concat(s.overlays.evals === false ? ['noeval'] : []).join(','));
    if (s.present !== 'graph') p.set('p', s.present);
    if (s.selection) p.set('sel', s.selection.type + ':' + s.selection.id);
    if (s.merged && s.merged.length) p.set('mg', s.merged.map(function (mg) { return mg.id + ':' + mg.name.replace(/[|:;]/g, ' ') + '|' + mg.memberIds.join(','); }).join(';'));
    return '#' + p.toString();
  }
  function fromHash(hash) {
    var out = {};
    if (!hash || hash.length < 2) return out;
    var p = new URLSearchParams(hash.slice(1));
    if (p.get('c')) out.caseId = p.get('c');
    if (p.get('i')) out.instanceId = p.get('i');
    if (p.get('s')) out.subject = p.get('s');
    if (p.get('d')) { var d = p.get('d').split('.').map(Number); out.depth = { org: d[0] || 1, process: d[1] || 1, exec: d[2] || 1 }; }
    var parseSets = function (v) {
      var r = { org: [], process: [], exec: [] };
      (v || '').split(';').filter(Boolean).forEach(function (part) {
        var i = part.indexOf(':');
        if (i > 0) r[part.slice(0, i)] = part.slice(i + 1).split(',').filter(Boolean);
      });
      return r;
    };
    if (p.get('e')) out.expanded = parseSets(p.get('e'));
    if (p.get('x')) out.collapsed = parseSets(p.get('x'));
    if (p.get('f')) { var f = p.get('f').split(':'); out.focus = { type: f[0], id: f.slice(1).join(':') }; }
    if (p.get('t')) out.time = Number(p.get('t'));
    if (p.get('m')) out.compare = p.get('m');
    if (p.has('l')) {
      var l = p.get('l').split(',');
      out.lines = { task: l.indexOf('task') >= 0, info: l.indexOf('info') >= 0, watch: l.indexOf('watch') >= 0, channel: l.indexOf('channel') >= 0 };
    }
    if (p.has('o')) {
      var o = p.get('o').split(',');
      out.overlays = { human: o.indexOf('human') >= 0, channels: o.indexOf('channels') >= 0, delivery: o.indexOf('delivery') >= 0, lanes: o.indexOf('lanes') >= 0, evals: o.indexOf('noeval') < 0 };
    }
    if (p.get('p')) out.present = p.get('p');
    if (p.get('sel')) { var s2 = p.get('sel').split(':'); out.selection = { type: s2[0], id: s2.slice(1).join(':') }; }
    if (p.get('mg')) {
      out.merged = p.get('mg').split(';').filter(Boolean).map(function (seg) {
        var bar = seg.indexOf('|');
        if (bar < 0) return null;
        var head = seg.slice(0, bar), ids = seg.slice(bar + 1).split(',').filter(Boolean);
        var colon = head.indexOf(':');
        return colon < 0 ? null : { id: head.slice(0, colon), name: head.slice(colon + 1), memberIds: ids };
      }).filter(Boolean);
    }
    return out;
  }
  var hashTimer = null;
  function writeHash() {
    if (typeof location === 'undefined' || typeof history === 'undefined') return;
    clearTimeout(hashTimer);
    hashTimer = setTimeout(function () {
      try { history.replaceState(null, '', toHash(state)); } catch (e) { /* file:// in some browsers */ }
    }, 120);
  }

  HUB.store = {
    DEFAULT: DEFAULT,
    get: function () { return state; },
    set: set,
    back: back,
    forward: forward,
    canBack: function () { return past.length > 0; },
    canForward: function () { return future.length > 0; },
    subscribe: function (fn) { subs.push(fn); return function () { subs = subs.filter(function (f) { return f !== fn; }); }; },
    isOpen: isOpen,
    toggle: toggle,
    setDepth: setDepth,
    switchCase: switchCase,
    toHash: toHash,
    fromHash: fromHash,
    init: function (patch) { state = merge(DEFAULT, patch || {}); past = []; future = []; },
    MAX_DEPTH: MAX_DEPTH
  };
})();
