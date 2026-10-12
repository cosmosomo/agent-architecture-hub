/* HUB.obs: the observatory.
   Puts the view buttons in the top bar, the floating controls on the canvas, the case / structure / health / session pages
   in the left sidebar and the details pane in the right one; wires the observation state to the scene renderer. */
(function () {
  'use strict';
  var HUB = (window.HUB = window.HUB || {});
  var U = HUB.util, L = U.LABELS;
  var h = U.h;

  var els = {};
  var cvA = null;
  var lastModelId = null, lastFitSig = '', lastSubject = null;
  var rzTimer = null;

  var DEPTHS = {
    org: [[1, '部门'], [2, '小组'], [3, '个体']],
    process: [[1, '阶段'], [2, '步骤']],
    exec: [[1, '决策'], [2, '调用']]
  };
  var LINE_CHIPS = [['task', '任务线', '--ob-task'], ['info', '信息线', '--ob-info'], ['watch', '监督线', '--ob-watch'], ['channel', '渠道线', '--ob-channel']];
  var OVERLAYS = [['human', '人'], ['delivery', '送达标记']];
  var VIEW_ICONS = {
    v1: '<circle cx="5" cy="6" r="2"/><circle cx="19" cy="6" r="2"/><circle cx="12" cy="18.5" r="2"/><circle cx="12" cy="10" r="1.7"/><path d="M7 6h10M6.2 7.8l4.6 9M17.8 7.8l-4.6 9M12 11.7v4.8"/>',
    v2: '<rect x="3" y="3.5" width="7.5" height="6.5" rx="1.5"/><rect x="13.5" y="3.5" width="7.5" height="6.5" rx="1.5"/><rect x="8.25" y="14" width="7.5" height="6.5" rx="1.5"/><path d="M6.75 10v2h10.5v-2M12 12v2"/>',
    v3: '<circle cx="4.5" cy="18.5" r="2"/><circle cx="19.5" cy="5.5" r="2"/><path d="M6.5 18.5c5 0 3-6.5 6-6.5s1-6.5 5-6.5"/>',
    v4: '<path d="M3 6.5h5.5l3 5.5-3 5.5H3l3-5.5z"/><path d="M13 6.5h5l3 5.5-3 5.5h-5l3-5.5z"/>',
    v5: '<path d="M12 2.8l3.2 3.2L12 9.2 8.8 6z"/><path d="M12 14.8l3.2 3.2-3.2 3.2-3.2-3.2z"/><path d="M12 9.2v5.6"/>',
    v6: '<path d="M4 5.5h7M7 9.5h10M10 13.5h6M6 17.5h12"/><path d="M4 3v18" opacity=".45"/>',
    vc: '<path d="M3 6h18M3 12h18M3 18h18" opacity=".4"/><path d="M5.5 6l4.5 6h4.5l4 6"/><circle cx="5.5" cy="6" r="1.5" fill="currentColor"/><circle cx="18.5" cy="18" r="1.5" fill="currentColor"/>'
  };

  function st() { return HUB.store.get(); }
  function model() { return HUB.model.current; }
  function safe(label, fn) { try { return fn(); } catch (e) { console.error('[obs] ' + label, e); return null; } }
  function icon(paths, size) { return '<svg viewBox="0 0 24 24" width="' + (size || 16) + '" height="' + (size || 16) + '" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' + paths + '</svg>'; }
  // the trajectory view (subject 'collab') draws the org's individuals and groups: its granularity is the org's
  function depthOf(s) { return s.subject === 'collab' ? 'org' : s.subject; }
  // the cut in words: the trajectory view counts the records of its instance, the other views read the model's clock
  function cutText(s) { return s.subject === 'collab' && HUB.obsCollab && HUB.obsCollab.cutLabel ? HUB.obsCollab.cutLabel(s, model()) : U.fmtClock(s.time); }

  /* ================= build ================= */
  function inject() {
    // top bar: the view buttons
    cvA = document.getElementById('cvA');
    els.tb = document.getElementById('tbMain');
    els.status = document.getElementById('statbar');

    // canvas: the layer and the floating controls
    HUB.obsStage.mount(document.getElementById('cvT'), { select: onSelect, toggle: onToggle, open: onOpen });
    els.crumbs = h('div', { class: 'ob-float ob-crumbs' });
    els.topctl = h('div', { class: 'ob-float ob-topctl' });
    els.ctrl = h('div', { class: 'ob-float ob-ctrl' });
    els.tl = h('div', { class: 'ob-tl' });
    els.strip = h('div', { class: 'ob-float ob-strip' });
    cvA.append(els.crumbs, els.topctl, els.strip, els.ctrl, els.tl);
    if (HUB.obsTimeline) safe('timeline.mount', function () { HUB.obsTimeline.mount(els.tl); });

    // left sidebar: one page per tab; the page is drawn when its tab is shown
    var tabs = HUB.shell.tabs;
    els.panPresets = tabs.add({ id: 'presets', label: '预设', title: '内置的样例团队：事实是模拟的' });
    els.panCases = tabs.add({ id: 'cases', label: '目录', cls: 'ob-pan', title: 'hub/cases 下找到的案例，按文件夹分层，可折叠' });
    els.panTree = tabs.add({ id: 'tree', label: '结构', cls: 'ob-pan' });
    els.panHealth = tabs.add({ id: 'health', label: '体检', cls: 'ob-pan' });
    els.panSessions = tabs.add({ id: 'sessions', label: '会话', cls: 'ob-pan', title: '本机真实的智能体会话' });
    tabs.onChange(renderSide);

    // right sidebar: the details pane
    var sr = document.getElementById('sR');
    els.sr = document.getElementById('obSr');
    // the subjects the stage cannot draw have a layer of their own over the canvas (a run's trace tree, the trajectory of a case)
    HUB.render.all().forEach(function (r) { if (r.layer) safe('layer.mount', function () { r.layer.mount({ canvas: cvA, side: sr, pane: els.sr }); }); });

    // a click on the empty canvas clears the selection (a drag that panned does not)
    cvA.addEventListener('click', function (e) {
      if (e.target.closest('.ob-float, .ob-tl, .zm-ctrl, .ob-card, .ob-fh, .ob-hit, .ob-tog, .ob-trace, .ob-collab')) return;
      if (!HUB.camera.wasDrag() && st().selection) HUB.store.set({ selection: null }, { history: false });
    });
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('click', function (e) { if (els.pop && !els.pop.contains(e.target) && !e.target.closest('[data-pop]')) closePop(); });
    // the canvas can start at zero size (a background tab, a collapsed pane); refit as soon as it has room
    var onResize = function () { clearTimeout(rzTimer); rzTimer = setTimeout(function () { renderAll(st(), st()); }, 160); };
    window.addEventListener('resize', onResize);
    if (window.ResizeObserver) new ResizeObserver(onResize).observe(cvA);
  }

  /* ================= render ================= */
  function renderAll(s, prev) {
    var m = model();
    if (!m || !els.tb) return;
    renderTop(s);
    renderCrumbs(s);
    renderTopCtl(s);
    renderCtrl(s);
    renderScene(s, prev);
    renderSide();
    renderPanel(s);
    if (HUB.obsTimeline) safe('timeline.update', function () { HUB.obsTimeline.update(m, s); });
    renderStatus(s);
    document.title = (m.presetName || m.name) + ' · Agent Architecture Hub';
  }

  function buildScene(m, s, a, view) {
    if (s.present === 'panel') return { subject: 'panel', cards: [], frames: [], links: [], bbox: { x: 0, y: 0, w: 10, h: 10 } };
    var r = HUB.render.get(s.subject);
    if (r && r.scene) return r.scene(m, s, a, view);
    return { subject: s.subject, cards: [], frames: [], links: [], bbox: { x: 0, y: 0, w: 10, h: 10 } };   // a layer draws this subject
  }

  function renderScene(s, prev) {
    var m = model();
    var a = HUB.model.an(s, m);
    var view = { w: cvA.clientWidth || 1200, h: cvA.clientHeight || 700 };
    var scene = safe('scene', function () { return buildScene(m, s, a, view); });
    if (!scene) return;
    var caseChanged = lastModelId !== m.id;
    lastModelId = m.id;
    if (caseChanged) HUB.obsStage.clear();
    HUB.obsStage.render(scene, { instant: caseChanged });
    HUB.obsStage.setSelection(s.selection);
    showPanelMode(s);
    renderStrip(scene, s);
    HUB.render.all().forEach(function (r) { if (r.layer) safe('layer.render', function () { r.layer.render(s, m); }); });
    var b = scene.bbox;
    var sig = [m.id, scene.subject, Math.round(b.x / 8), Math.round(b.y / 8), Math.round(b.w / 8), Math.round(b.h / 8), Math.round(view.w / 24), Math.round(view.h / 24)].join('|');
    if (sig !== lastFitSig || lastSubject !== scene.subject) {
      HUB.camera.fit(b, !caseChanged, fitPad());
      lastFitSig = sig;
    }
    lastSubject = scene.subject;
  }
  // keep the drawing clear of the floating controls: measure them instead of guessing
  function fitPad() {
    var cv = cvA.getBoundingClientRect();
    var top = 56, bottom = 120;
    [els.crumbs, els.topctl, els.strip].forEach(function (e) { if (e && e.offsetParent) top = Math.max(top, e.getBoundingClientRect().bottom - cv.top + 14); });
    [els.ctrl, els.tl].forEach(function (e) { if (e && e.offsetParent && e.style.display !== 'none') bottom = Math.max(bottom, cv.bottom - e.getBoundingClientRect().top + 14); });
    return { top: top, right: 36, bottom: bottom, left: 36 };
  }
  function fit(instant) { var sc = HUB.obsStage.scene; if (sc) HUB.camera.fit(sc.bbox, instant !== true, fitPad()); }

  function showPanelMode(s) {
    var panel = s.present === 'panel';
    if (!els.panelHost) {
      els.panelHost = h('div', { class: 'ob-panelhost' });
      // the canvas zooms on wheel and cancels the scroll; the panel sits inside the canvas, so keep its wheel to itself
      els.panelHost.addEventListener('wheel', function (e) { e.stopPropagation(); }, { passive: true });
      cvA.appendChild(els.panelHost);
    }
    els.panelHost.classList.toggle('on', panel);
    if (panel && HUB.panels && HUB.panels.render) safe('panels', function () { HUB.panels.render(els.panelHost, model(), s); });
  }

  /* ---------- top bar: the four views of the whole system ---------- */
  function renderTop(s) {
    var cur = HUB.views.current(s);
    els.tb.innerHTML = '';
    var row = h('div', { class: 'ob-views', role: 'tablist', 'aria-label': '四种常用视图' });
    HUB.views.list().forEach(function (v) {
      row.appendChild(h('button', {
        type: 'button', class: 'ob-vbtn' + (cur === v.id ? ' on' : ''), role: 'tab', 'aria-selected': cur === v.id ? 'true' : 'false',
        title: v.name + '：' + v.question + '（快捷键 ' + (v.key || v.num) + '）', onClick: function () { HUB.views.go(v.id); }
      }, h('span', { class: 'ob-vic', html: icon(VIEW_ICONS[v.id] || '', 16) }),
        h('span', { class: 'ob-vtx' }, h('span', { class: 'ob-vname' }, v.key ? null : h('span', { class: 'ob-vnum' }, v.num + ' '), v.short), h('span', { class: 'ob-vq' }, v.question))));
    });
    els.tb.appendChild(row);
    var m = model();
    if (m.factSource && m.factSource.kind === 'error') els.tb.appendChild(h('span', {
      class: 'ob-pill warn', title: HUB.model.factLabel(m)
    }, '真实轨迹读取失败'));
    // the decision chain is a drill-down opened from an individual or a session, not one of the views: say where we are and how to go back
    var tg = drill(s);
    if (tg) els.tb.appendChild(h('span', { class: 'ob-custom ob-drill', title: '从个体或会话打开的决策链；Esc 或“返回”回到原来的视图' },
      tg.label, h('a', { class: 'ob-a', onClick: function () { leaveChain(); } }, ' 返回')));
    else if (!cur) els.tb.appendChild(h('span', { class: 'ob-custom', title: '当前的观察状态不等于任何一个常用视图。可以存成“我的视图”' }, '自定义'));
    var mine = h('button', { type: 'button', class: 'btn ob-mine', 'data-pop': '1', title: '把当前观察状态存下来，或打开存过的', onClick: function (e) { e.stopPropagation(); openMine(mine); } }, '我的视图 ▾');
    els.tb.appendChild(mine);
    els.tb.appendChild(h('button', { type: 'button', class: 'btn ob-mine', title: '这是什么、图例、六种视图、键盘（?）', onClick: function () { if (HUB.obsGuide) HUB.obsGuide.open(); } }, '说明'));
  }

  /* ---------- canvas: the departments in a row, one line of summary on top of the org views ---------- */
  function renderStrip(scene, s) {
    var list = s.present !== 'panel' && scene.subject === 'org' && scene.strip && scene.strip.length > 1 ? scene.strip : [];
    els.strip.style.display = list.length ? '' : 'none';
    els.strip.innerHTML = '';
    list.forEach(function (g, i) {
      if (i) els.strip.appendChild(h('span', { class: 'ob-sa' }, '→'));
      els.strip.appendChild(h('button', {
        type: 'button', class: 'ob-sc', style: { '--pc': HUB.obsCards.phaseVar(g.phase) }, title: '选中“' + g.name + '”',
        onClick: function () { HUB.store.set({ selection: { type: 'group', id: g.id } }, { history: false }); }
      }, g.name, h('b', null, String(g.members))));
    });
  }

  /* ---------- canvas: breadcrumbs (top left) ---------- */
  // a long English question after the case kind ("Who&When 失败归因案例：How much did I save…") is not a name:
  // the crumb keeps the kind and the tail of the id; the whole title is in the tooltip and the right pane
  function crumbName(m) {
    var i = m.name.indexOf('：'), rest = i > 0 ? m.name.slice(i + 1) : '';
    if (i > 0 && rest.length > 24 && rest.replace(/[^A-Za-z]/g, '').length / rest.length > 0.5) return m.name.slice(0, i) + ' · ' + String(m.id).split('_').pop();
    return m.name.length > 44 ? m.name.slice(0, 44) + '…' : m.name;
  }
  function renderCrumbs(s) {
    var m = model();
    els.crumbs.innerHTML = '';
    els.crumbs.appendChild(h('button', { type: 'button', class: 'ob-ibtn', title: '返回上一个观察状态（Alt+←）', disabled: !HUB.store.canBack(), onClick: function () { HUB.store.back(); } }, '←'));
    els.crumbs.appendChild(h('button', { type: 'button', class: 'ob-ibtn', title: '前进（Alt+→）', disabled: !HUB.store.canForward(), onClick: function () { HUB.store.forward(); } }, '→'));
    var c = h('div', { class: 'ob-crumb' });
    var gt = function () { return h('span', { class: 'ob-gt' }, '›'); };
    c.appendChild(h('a', { title: m.name + (m.summary ? '\n' + m.summary : ''), onClick: function () { HUB.shell.tabs.show('presets'); } }, crumbName(m)));
    c.appendChild(gt());
    var cur = HUB.views.current(s);
    var v = cur ? HUB.views.get(cur) : null;
    c.appendChild(h('span', { class: 'ob-cur' }, v ? v.name : '自定义（' + L.subject[s.subject] + '）'));
    if (s.focus && s.focus.type === 'case') {
      var cs = m.idx.case.get(s.focus.id);
      c.appendChild(gt());
      c.appendChild(h('span', { title: cs ? cs.name : '' }, '案例 ' + s.focus.id));
    }
    var tg = drill(s);
    if (tg) { c.appendChild(gt()); c.appendChild(h('span', null, tg.crumb)); }
    if (s.time != null) { c.appendChild(gt()); c.appendChild(h('span', null, '截止 ' + cutText(s))); }
    els.crumbs.appendChild(c);
    // focus picker: which case instance to follow
    // the trajectory view always shows one instance of recorded facts: its picker lists every instance, has no "none",
    // and picking one shows it whole; with the evaluation layer off the names keep quiet about outcomes too
    var traj = s.subject === 'collab', shown = traj ? HUB.model.instanceOf(s, m) : null;
    var quiet = traj && s.overlays && s.overlays.evals === false;
    if (s.subject !== 'exec' && m.facts.cases.length && !(traj && m.synthetic)) {
      var sel = h('select', { class: 'ob-select', title: traj ? '看哪一个案例实例的记录' : '聚焦一个案例实例：只点亮它经过的个体和交接', onChange: function () {
        var v2 = sel.value;
        if (!v2) HUB.store.set({ focus: null });
        else if (traj) HUB.store.set({ focus: { type: 'case', id: v2 }, instanceId: v2, time: null, selection: null });
        else HUB.store.set({ focus: { type: 'case', id: v2 }, instanceId: v2, depth: { org: Math.max(2, s.depth.org) } });
      } });
      if (!traj) sel.appendChild(h('option', { value: '' }, '不聚焦'));
      m.facts.cases.forEach(function (k) {
        if (!traj && !HUB.model.visible(k.start, s)) return;
        var o = h('option', { value: k.id }, k.id + ' ' + (quiet ? HUB.collab.shortName(k.name) : k.name) + '（' + (L.caseStatus[k.status] || k.status) + '）');
        if (traj ? !!shown && shown.id === k.id : s.focus && s.focus.type === 'case' && s.focus.id === k.id) o.selected = true;
        sel.appendChild(o);
      });
      els.crumbs.appendChild(h('span', { class: 'ob-sep' }));
      els.crumbs.appendChild(sel);
    }
  }

  /* ---------- canvas: granularity, comparison, presentation (top right) ---------- */
  function renderTopCtl(s) {
    els.topctl.innerHTML = '';
    var ds = depthOf(s), d = DEPTHS[ds] || [];
    if (d.length && s.present !== 'panel') {
      els.topctl.appendChild(h('span', { class: 'ob-lbl' }, '粒度'));
      var seg = h('div', { class: 'ob-seg', title: '展开到哪一层（[ 和 ] 也行）' });
      d.forEach(function (x) {
        seg.appendChild(h('button', { type: 'button', class: s.depth[ds] === x[0] ? 'on' : '', onClick: function () { HUB.store.setDepth(ds, x[0]); } }, x[1]));
      });
      els.topctl.appendChild(seg);
      var n = (s.expanded[ds] || []).length + (s.collapsed[ds] || []).length;
      if (n) els.topctl.appendChild(h('span', { class: 'ob-reset', title: '有分组被单独展开或折叠；点这里回到统一粒度', onClick: function () { HUB.store.setDepth(ds, s.depth[ds]); } }, '局部 ' + n + ' 处 · 还原'));
      els.topctl.appendChild(h('span', { class: 'ob-sep' }));
    }
    els.topctl.appendChild(h('span', { class: 'ob-lbl' }, '对照'));
    var cmp = h('div', { class: 'ob-seg', title: '只看编排里的定义、两者对照、只看实际发生的事实' });
    [['def', '定义'], ['both', '对照'], ['fact', '事实']].forEach(function (x) {
      cmp.appendChild(h('button', { type: 'button', class: s.compare === x[0] ? 'on' : '', onClick: function () { HUB.store.set({ compare: x[0] }); } }, x[1]));
    });
    els.topctl.appendChild(cmp);
    els.topctl.appendChild(h('span', { class: 'ob-sep' }));
    var pr = h('div', { class: 'ob-seg', title: '图，或者同一组数据的面板（G）' });
    [['graph', '图'], ['panel', '面板']].forEach(function (x) {
      pr.appendChild(h('button', { type: 'button', class: s.present === x[0] ? 'on' : '', onClick: function () { HUB.store.set({ present: x[0] }); } }, x[1]));
    });
    els.topctl.appendChild(pr);
  }

  /* ---------- canvas: lines and overlays (bottom) ---------- */
  function renderCtrl(s) {
    els.ctrl.innerHTML = '';
    if (s.present === 'panel') { els.ctrl.style.display = 'none'; return; }
    els.ctrl.style.display = '';
    if (s.subject === 'org') {
      els.ctrl.appendChild(h('span', { class: 'ob-lbl' }, '线'));
      LINE_CHIPS.forEach(function (c) {
        var onNow = !!s.lines[c[0]];
        var chip = h('button', { type: 'button', class: 'ob-chip' + (onNow ? ' on' : ''), style: { '--cc': 'var(' + c[2] + ')' },
          title: (onNow ? '隐藏' : '显示') + c[1], onClick: function () {
            var patch = { lines: {} }; patch.lines[c[0]] = !onNow;
            HUB.store.set(patch);
          } }, h('span', { class: 'ob-sw' }), c[1]);
        els.ctrl.appendChild(chip);
      });
      els.ctrl.appendChild(h('span', { class: 'ob-sep' }));
      els.ctrl.appendChild(h('span', { class: 'ob-lbl' }, '叠加'));
      OVERLAYS.forEach(function (o) {
        if (o[0] === 'lanes' && !(s.focus && s.focus.type === 'case')) return;
        var onNow = s.overlays[o[0]] !== false && !!s.overlays[o[0]];
        els.ctrl.appendChild(h('button', { type: 'button', class: 'ob-chip' + (onNow ? ' on' : ''), onClick: function () {
          var patch = { overlays: {} }; patch.overlays[o[0]] = !onNow;
          HUB.store.set(patch);
        } }, o[1]));
      });
      els.ctrl.appendChild(h('span', { class: 'ob-sep' }));
    }
    if (HUB.obsTimeline && HUB.obsTimeline.replayButton) els.ctrl.appendChild(HUB.obsTimeline.replayButton(s));
    // auto-group button: only in org subject with a real-session model
    var m = model();
    if (s.subject === 'org' && m.source && m.source.kind === 'sessions') {
      var hasMerged = (s.merged || []).length > 0;
      els.ctrl.appendChild(h('button', { type: 'button', class: 'ob-chip' + (hasMerged ? ' on' : ''), title: hasMerged ? '展开所有聚合' : '自动按父子会话分组聚合', onClick: function () {
        if (hasMerged) { HUB.store.set({ merged: [] }); return; }
        HUB.store.set({ merged: suggestMerge(m) });
      } }, hasMerged ? '取消聚合' : '自动分组'));
    }
    els.ctrl.appendChild(h('button', { type: 'button', class: 'ob-ibtn', title: '适应窗口（F）', onClick: fit }, '适应窗口'));
  }

  /* ---------- left and right sidebars, status bar ---------- */
  // only the page that is showing is drawn
  function renderSide() {
    var s = st(), page = HUB.shell.tabs.current();
    if (page === 'presets') safe('side.presets', function () { HUB.obsPresets.render(els.panPresets); });
    else if (page === 'cases') safe('side.cases', function () { HUB.obsSide.cases(els.panCases); });
    else if (page === 'tree') safe('side.tree', function () { HUB.obsSide.tree(els.panTree, model(), s); });
    else if (page === 'health') safe('side.health', function () { HUB.obsSide.health(els.panHealth, model(), s); });
    else if (page === 'sessions') safe('side.sessions', function () { HUB.obsSessions.render(els.panSessions); });
  }
  function renderPanel(s) {
    if (HUB.obsPanel) safe('panel', function () { HUB.obsPanel.render(els.sr, model(), s); });
  }
  // the status bar: one item per number
  function renderStatus(s) {
    var m = model(), a = HUB.model.an(s, m), t = a.totals;
    var bar = els.status;
    bar.innerHTML = '';
    [['个体', t.individuals], ['任务线', t.relations], ['案例', t.cases], ['运行', t.runs], ['调用', U.fmtNum(t.calls)], ['token', U.fmtTokens(t.tokens)],
      ['首次通过', U.pct(t.firstPassRate)], ['返工率', U.pct(t.reworkRate)], ['编排版本', m.def.version], ['时间', s.time == null ? '全部' : '截止 ' + cutText(s)]].forEach(function (x) {
      bar.appendChild(h('div', { class: 'st' }, h('span', null, x[0] + ':'), h('span', { class: 'st-v' }, String(x[1]))));
    });
    var failed = m.factSource && m.factSource.kind === 'error';
    bar.appendChild(h('div', { class: 'st', style: { border: 'none' } }, h('span', { class: failed ? 'ob-pill warn' : 'ob-tag-sim' },
      failed ? HUB.model.factLabel(m) : m.synthetic ? '事实为模拟数据' : '事实为' + HUB.model.factLabel(m))));
  }

  // what the open decision chain is, in words for the top bar and the breadcrumbs
  function drill(s) {
    var t = HUB.obsTrace ? HUB.obsTrace.current(s, model()) : null;
    if (!t) return null;
    if (t.kind === 'run') {
      var who = HUB.model.name('individual', t.run.individualId);
      return { label: '决策链 · ' + who, crumb: who + ' 的一次运行' };
    }
    var title = t.session ? t.session.title : t.id;
    return { label: '本机会话 · ' + (title.length > 24 ? title.slice(0, 24) + '…' : title), crumb: '本机会话' };
  }

  // back from a decision chain to the view it was opened from
  function leaveChain() {
    if (HUB.store.canBack()) { HUB.store.back(); if (st().subject !== 'exec') return; }
    HUB.views.go('v2');
  }

  /* ================= stage callbacks ================= */
  function onSelect(sel) { HUB.store.set({ selection: sel }, { history: false }); }
  function onToggle(id) {
    var s = st(), m = model();
    if (s.subject === 'process') HUB.store.toggle('process', id, 1);
    else { var g = m.idx.group.get(id); if (g) HUB.store.toggle('org', g.id, g.level); }
  }
  /* ---------- suggest merge groups from a real-session model ----------
     For sessions source: group by parent-session waves (same parent + same spawn turn).
     For simulated: group by phase. Returns an array for s.merged.              */
  function suggestMerge(m) {
    if (!m || !m.def) return [];
    var result = [], seen = new Set();
    if (m.source && m.source.kind === 'sessions') {
      // group individuals that share the same parent+turn (i.e. same wave)
      var waveOf = new Map();
      m.def.individuals.forEach(function (x) {
        if (!x.groupId || x.kind !== 'agent' || x.id === 'human') return;
        var g = m.idx.group.get(x.groupId);
        if (g && g.members.length > 1) {
          var key = x.groupId;
          (waveOf.get(key) || waveOf.set(key, []).get(key)).push(x.id);
        }
      });
      var seq = 0;
      waveOf.forEach(function (ids, gid) {
        if (ids.length < 2) return;
        var g = m.idx.group.get(gid);
        result.push({ id: 'mg_auto_' + (++seq), memberIds: ids, name: g ? g.name : '聚合 ' + seq });
      });
    } else {
      // simulated: group by phase
      var byPhase = new Map();
      m.def.individuals.forEach(function (x) {
        if (x.kind !== 'agent' || x.id === 'human' || !x.phase) return;
        (byPhase.get(x.phase) || byPhase.set(x.phase, []).get(x.phase)).push(x.id);
      });
      var PHASE_ZH = { strategy: '策略', research: '研究', build: '开发', qa: '质检', hitl: '审批', planner: '规划', debate: '辩论' };
      var seq2 = 0;
      byPhase.forEach(function (ids, ph) {
        if (ids.length < 2) return;
        result.push({ id: 'mg_ph_' + (++seq2), memberIds: ids, name: (PHASE_ZH[ph] || ph) + '组' });
      });
    }
    return result;
  }

  function onOpen(obj) {
    if (obj.toggle) { onToggle(obj.toggle); return; }
    var sel = obj.sel;
    if (!sel) return;
    var s = st(), m = model();
    if (sel.type === 'individual') {
      var r = HUB.model.latestRunOf(sel.id, s, m);
      if (r) HUB.store.set({ subject: 'exec', depth: { exec: 1 }, expanded: { exec: [] }, collapsed: { exec: [] }, focus: { type: 'run', id: r.id }, selection: sel });
    } else if (sel.type === 'merged') {
      // click a merged placeholder: expand it (remove from merged list)
      HUB.store.set({ merged: (s.merged || []).filter(function (mg) { return mg.id !== sel.id; }) });
    } else if (sel.type === 'run') {
      HUB.store.set({ subject: 'exec', depth: { exec: 1 }, expanded: { exec: [] }, collapsed: { exec: [] }, focus: { type: 'run', id: sel.id }, selection: sel });
    } else if (sel.type === 'stage') {
      HUB.store.toggle('process', sel.id, 1);
    }
  }

  /* ================= popover: my views ================= */
  function closePop() { if (els.pop) { els.pop.remove(); els.pop = null; } }
  function openPop(anchor, build) {
    closePop();
    var pop = h('div', { class: 'ob-pop' });
    build(pop);
    document.body.appendChild(pop);
    var r = anchor.getBoundingClientRect();
    pop.style.top = (r.bottom + 6) + 'px';
    pop.style.left = Math.max(8, Math.min(window.innerWidth - pop.offsetWidth - 8, r.left)) + 'px';
    els.pop = pop;
  }
  function openMine(anchor) {
    openPop(anchor, function (pop) {
      pop.appendChild(h('div', { class: 'ob-pop-i', onClick: function () {
        var name = window.prompt('给当前视图起个名字', '');
        if (name === null) return;
        HUB.views.saveCurrent(name.trim());
        closePop();
        HUB.shell.toast('已存为我的视图');
      } }, '+ 把当前观察状态存下来'));
      var mine = HUB.views.mine();
      pop.appendChild(h('div', { class: 'ob-pop-h' }, mine.length ? '我的视图' : '还没有存过视图'));
      mine.forEach(function (v) {
        pop.appendChild(h('div', { class: 'ob-pop-i', onClick: function () { HUB.views.goMine(v.id); closePop(); } },
          h('span', null, v.name),
          h('span', { class: 'ob-x', title: '删除', onClick: function (e) { e.stopPropagation(); HUB.views.removeMine(v.id); openMine(anchor); } }, '×')));
      });
    });
  }

  /* ================= keyboard ================= */
  function onKey(e) {
    // typing inside the trace view's shadow root reaches us retargeted to its host; look at the real target
    var tg = (e.composedPath && e.composedPath()[0]) || e.target;
    if (tg && (tg.tagName === 'INPUT' || tg.tagName === 'TEXTAREA' || tg.tagName === 'SELECT' || tg.isContentEditable)) return;
    if (document.querySelector('.mo.show')) return;
    var k = e.key;
    var s = st();
    var handled = true;
    // the trajectory view has its own replay: space, the arrows, Home and End move its cursor
    if (s.subject === 'collab' && s.present !== 'panel' && HUB.obsCollab && HUB.obsCollab.key(e)) { e.preventDefault(); e.stopPropagation(); return; }
    if (/^[1-4]$/.test(k) && !e.ctrlKey && !e.metaKey && !e.altKey) HUB.views.go('v' + k);
    else if ((k === 't' || k === 'T') && !e.ctrlKey && !e.metaKey && !e.altKey && HUB.views.get('vc')) HUB.views.go('vc');
    else if (e.altKey && k === 'ArrowLeft') HUB.store.back();
    else if (e.altKey && k === 'ArrowRight') HUB.store.forward();
    else if (k === 'g' || k === 'G') HUB.store.set({ present: s.present === 'graph' ? 'panel' : 'graph' });
    else if (k === '[' || k === ']') {
      var ds = depthOf(s), d = DEPTHS[ds] || [];
      var cur = s.depth[ds] || 1;
      var nx = Math.max(1, Math.min(d.length, cur + (k === ']' ? 1 : -1)));
      if (nx !== cur) HUB.store.setDepth(ds, nx);
    }
    else if (k === 'f' || k === 'F') fit();
    else if (k === 'Escape') { if (els.pop) closePop(); else if (s.subject === 'exec') leaveChain(); else if (s.selection) HUB.store.set({ selection: null }, { history: false }); else if (s.focus && s.subject !== 'collab') HUB.store.set({ focus: null }); }
    else if (k === '?' || k === '/') HUB.obsGuide.open();
    else if (k === '=' || k === '+') HUB.camera.zoomBy(1.2);
    else if (k === '-') HUB.camera.zoomBy(1 / 1.2);
    else if (k === '0') fit();
    else if (k === ' ' && HUB.obsTimeline && HUB.obsTimeline.toggleReplay) HUB.obsTimeline.toggleReplay();
    else handled = false;
    if (handled) { e.preventDefault(); e.stopPropagation(); }
  }

  /* ================= start ================= */
  // a model that comes from a slow source (a session graph from the local service): load it, then show the state of the link
  function later(p) {
    HUB.model.load(p.caseId).then(function () {
      if (p.caseId !== st().caseId) HUB.store.switchCase(p.caseId);
      var rest = Object.assign({}, p);
      delete rest.caseId;
      HUB.store.set(rest);
    }).catch(function (e) { HUB.shell.toast('链接里的数据没打开：' + e.message); });
  }

  function start() {
    HUB.shell.start();
    // The cases on disk are found by walking hub/cases/ (HUB.catalog), which takes a moment; a link into
    // the shelved reference corpus opens the folders it needs. Start-up waits for that, then applies the link.
    var want = HUB.store.fromHash(location.hash || '').caseId;
    HUB.catalog.ready()
      .then(function () { return want && !HUB.base.presets[want] && !HUB.model.owns(want) ? HUB.catalog.find(want) : null; })
      .catch(function () {})
      .then(boot);
  }

  function boot() {
    var patch = HUB.store.fromHash(location.hash || '');
    var fromLink = !!patch.caseId;
    var pending = patch.caseId && !HUB.model.ready(patch.caseId) && HUB.model.owns(patch.caseId) ? Object.assign({}, patch) : null;
    if (!patch.caseId || !HUB.model.ready(patch.caseId)) patch.caseId = HUB.store.DEFAULT.caseId;
    HUB.store.init(patch);
    HUB.model.select(HUB.store.get().caseId);
    if (!patch.subject && !patch.depth) HUB.store.init(Object.assign({}, patch, HUB.views.get('v2').apply(HUB.store.get(), HUB.model.current)));
    inject();
    HUB.store.subscribe(function (s, prev) {
      if (!prev || s.caseId !== prev.caseId) HUB.model.select(s.caseId);
      renderAll(s, prev);
    });
    HUB.bus.on('model', function () { var s = st(); renderAll(s, s); });
    HUB.bus.on('catalog', function () { if (HUB.shell.tabs.current() === 'cases') renderSide(); });
    // a new theme: colours that were drawn into the cards, and the trace view's shadow DOM, take the new palette
    HUB.bus.on('theme', function () { renderAll(st(), st()); });
    // a pasted or edited link restores that observation state (our own writes use replaceState and fire nothing)
    window.addEventListener('hashchange', function () {
      if (location.hash === HUB.store.toHash(st())) return;
      var p = HUB.store.fromHash(location.hash);
      if (p.caseId && !HUB.model.ready(p.caseId)) { if (HUB.model.owns(p.caseId)) later(p); return; }
      if (p.caseId && p.caseId !== st().caseId) HUB.store.switchCase(p.caseId);
      delete p.caseId;
      HUB.store.set(p);
    });
    renderAll(st(), null);
    if (pending) later(pending);
  }

  // a click on a case in the sidebar.  A built-in sample team has no real facts, only simulated ones: it opens as the plain
  // definition, the way the sample page showed it; the comparison is one click away.
  function openCase(id) {
    HUB.store.switchCase(id);
    var m = model();
    HUB.store.set({ compare: m && m.source && m.source.kind === 'sim' ? 'def' : 'both' }, { history: false });
  }

  HUB.obs = { start: start, fit: fit, render: function () { renderAll(st(), st()); }, openCase: openCase };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
