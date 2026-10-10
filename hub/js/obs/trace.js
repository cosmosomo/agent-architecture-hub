/* HUB.obsTrace: the detail of one run, drawn by the trace view (trace/apps/viewer, built into
   hub/vendor/hub-trace.js as window.HubTrace). Opened from an individual or a run (HUB.model.traceOf: the real
   session behind it, or the simulated run converted), or from the session list, a session read from the local
   service. The tree fills the
   centre of the canvas; the selected step's details sit in the right sidebar under the summary; Esc goes back.
   The observation state stays the source of truth: the granularity is depth.exec, the selected step is
   selection {type: 'span'}, the open session is focus {type: 'session'}. */
(function () {
  'use strict';
  var HUB = (window.HUB = window.HUB || {});
  var h = HUB.util.h;
  var els = {}, handle = null, last = { key: '', data: null };
  var remote = {};   // session id -> { status: 'loading' | 'ok' | 'error', session, error }

  function available() { return !!(window.HubTrace && window.HubTrace.mount); }

  /* canvas: the element the tree covers; side: the right sidebar; after: the summary pane the details go under */
  function mount(canvas, side, after) {
    els.host = h('div', { class: 'ob-tracehost ob-trace ob-only' });
    els.note = h('div', { class: 'ob-trace-note' });
    els.tree = h('div', { class: 'ob-trace-tree' });
    els.host.append(els.note, els.tree);
    // the page zooms the canvas on wheel; the tree scrolls instead
    els.host.addEventListener('wheel', function (e) { e.stopPropagation(); }, { passive: true });
    canvas.appendChild(els.host);
    els.side = h('div', { class: 'ob-traceside ob-trace ob-only' });
    side.insertBefore(els.side, after.nextSibling);
  }

  // what the drill-down shows: a run of the model, or a session from this machine
  function target(s, m) {
    if (s.subject !== 'exec') return null;
    if (s.focus && s.focus.type === 'session') return { kind: 'session', id: s.focus.id };
    var r = HUB.model.focusRun(s, m);
    return r ? { kind: 'run', run: r } : null;
  }

  function load(id) {
    remote[id] = { status: 'loading' };
    var done = function () { if (HUB.obs) HUB.obs.render(); };
    if (location.protocol !== 'http:' && location.protocol !== 'https:') {
      remote[id] = { status: 'error', error: '这个页面是直接用文件打开的，读不到本机会话。在 trace 目录运行 npm run serve，再打开 http://127.0.0.1:8790/。' };
      return;
    }
    fetch('/api/sessions/' + encodeURIComponent(id), { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error(r.status === 404 ? '本机没有这个会话' : '本地服务返回 ' + r.status); return r.json(); })
      .then(function (doc) { remote[id] = { status: 'ok', session: doc.session }; })
      .catch(function (e) { remote[id] = { status: 'error', error: '读不到这个会话：' + e.message }; })
      .then(done);
  }

  /* { session, layer, turn } for the target, or null while it loads; runs are cached per model revision and time cut */
  function data(t, s, m) {
    if (t.kind === 'run') {
      var key = m.id + '|' + m.rev + '|' + t.run.id + '|' + (s.time == null ? '' : s.time);
      if (last.key !== key) last = { key: key, data: HUB.model.traceOf(m, t.run, s.time) };
      return last.data;
    }
    if (!remote[t.id]) load(t.id);
    var r = remote[t.id];
    return r && r.status === 'ok' ? { session: r.session, layer: null } : null;
  }

  function note(text) {
    els.note.textContent = text;
    els.note.style.display = '';
    els.tree.style.display = 'none';
  }

  /* shows or hides the trace for the observation state; true while it covers the canvas */
  function render(s, m) {
    var t = target(s, m);
    var on = !!t && s.present !== 'panel';
    els.host.classList.toggle('on', on);
    els.side.classList.toggle('on', on && available());
    els.side.parentNode.classList.toggle('ob-trace-open', on && available());
    if (!on) return false;
    if (!available()) { note('Trace 组件没有加载（hub/vendor/hub-trace.js）。在 trace 目录运行 npm run build 生成它。'); return true; }
    var d = data(t, s, m);
    if (!d) {
      var r = t.kind === 'session' ? remote[t.id] : null;
      note(r && r.status === 'error' ? r.error : t.kind === 'session' ? '读取会话…' : '这个时间点之前，它还没有运行。');
      return true;
    }
    if (!d.session.turns.some(function (x) { return x.steps.length; })) {
      note(t.kind === 'session' ? '这个会话还没有任何记录。' : '这次运行在这个时间点之前还没有留下任何一步。拖动底部时间轴往后看。');
      return true;
    }
    els.note.style.display = 'none';
    els.tree.style.display = '';
    var props = {
      session: d.session, layer: d.layer, depth: s.depth.exec || 1,
      theme: document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark',
      // a run of a real session opens at its own turn of that session
      selected: s.selection && s.selection.type === 'span' ? s.selection.id : d.turn ? window.HubTrace.ids.turn(d.turn) : null,
      onSelect: function (id) { HUB.store.set({ selection: { type: 'span', id: id } }, { history: false }); }
    };
    if (handle) handle.update(props);
    else handle = window.HubTrace.mount({ tree: els.tree, details: els.side }, props);
    return true;
  }

  /* the session behind the drill-down, for the summary pane: the loaded one, or the converted run */
  function current(s, m) {
    var t = target(s, m);
    if (!t) return null;
    if (t.kind === 'run') return { kind: 'run', run: t.run };
    var r = remote[t.id] || {};
    return { kind: 'session', id: t.id, session: r.session || null, error: r.error || null };
  }

  HUB.obsTrace = { mount: mount, render: render, target: target, current: current, available: available };
})();
