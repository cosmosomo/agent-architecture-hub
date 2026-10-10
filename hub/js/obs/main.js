/* HUB.obs: the observation mode of the original page.
   Adds the mode switch and the six view buttons to the top bar, floating controls to the canvas, two tabs to the
   left sidebar and a details pane to the right sidebar; wires the observation state to the scene renderer. */
(function () {
  'use strict';
  var HUB = (window.HUB = window.HUB || {});
  var U = HUB.util, L = U.LABELS;
  var h = U.h;

  var els = {};
  var on = false;
  var lastModelId = null, lastFitSig = '', lastSubject = null, syncing = false;
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
    v6: '<path d="M4 5.5h7M7 9.5h10M10 13.5h6M6 17.5h12"/><path d="M4 3v18" opacity=".45"/>'
  };

  function st() { return HUB.store.get(); }
  function model() { return HUB.model.current; }
  function safe(label, fn) { try { return fn(); } catch (e) { console.error('[obs] ' + label, e); return null; } }
  function icon(paths, size) { return '<svg viewBox="0 0 24 24" width="' + (size || 16) + '" height="' + (size || 16) + '" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' + paths + '</svg>'; }

  /* ================= build ================= */
  function inject() {
    // top bar: mode switch after the brand, the view buttons where the problem box sits
    var brand = document.querySelector('.tb-brand');
    els.mode = h('div', { class: 'ob-mode', role: 'tablist', 'aria-label': '模式' },
      h('button', { type: 'button', 'data-mode': 'obs', title: '协作观察：用六种视图看一个团队怎么协作', onClick: function () { setMode(true); } }, '观察'),
      h('button', { type: 'button', 'data-mode': 'design', title: '原来的团队设计器', onClick: function () { setMode(false); } }, '设计'));
    brand.parentNode.insertBefore(els.mode, brand.nextSibling);
    var prob = document.querySelector('.tb-problem');
    els.tb = h('div', { class: 'tb-problem ob-tb ob-only' });
    prob.parentNode.insertBefore(els.tb, prob.nextSibling);

    // canvas: the layer and the floating controls
    var cont = document.querySelector('#cvA .cv-container');
    HUB.obsStage.mount(cont, { select: onSelect, toggle: onToggle, open: onOpen });
    els.crumbs = h('div', { class: 'ob-float ob-crumbs ob-only' });
    els.topctl = h('div', { class: 'ob-float ob-topctl ob-only' });
    els.ctrl = h('div', { class: 'ob-float ob-ctrl cv-ctrl ob-only' });
    els.tl = h('div', { class: 'ob-tl ob-only' });
    cvA.append(els.crumbs, els.topctl, els.ctrl, els.tl);
    if (HUB.obsTimeline) safe('timeline.mount', function () { HUB.obsTimeline.mount(els.tl); });

    // left sidebar: two more tabs that reuse the page's own tab switching
    var tabs = document.querySelector('.sl-tabs');
    var allTabs = tabs.querySelectorAll('.sl-tab');
    if (allTabs[0]) allTabs[0].setAttribute('data-ob-hide', '1');
    if (allTabs[2]) allTabs[2].setAttribute('data-ob-hide', '1');
    els.tabTree = h('button', { class: 'sl-tab ob-only', role: 'tab', 'aria-selected': 'false', onClick: function () { zmienTab('obtree', els.tabTree); renderSide(); } }, '结构');
    els.tabHealth = h('button', { class: 'sl-tab ob-only', role: 'tab', 'aria-selected': 'false', onClick: function () { zmienTab('obhealth', els.tabHealth); renderSide(); } }, '体检');
    els.tabSessions = h('button', { class: 'sl-tab ob-only', role: 'tab', 'aria-selected': 'false', title: '本机真实的智能体会话', onClick: function () { zmienTab('obsessions', els.tabSessions); renderSide(); } }, '会话');
    tabs.append(els.tabTree, els.tabHealth, els.tabSessions);
    var pans = document.querySelector('.sl-panels');
    els.panTree = h('div', { class: 'sl-pan ob-pan', id: 'panObtree' });
    els.panHealth = h('div', { class: 'sl-pan ob-pan', id: 'panObhealth' });
    els.panSessions = h('div', { class: 'sl-pan ob-pan', id: 'panObsessions' });
    pans.append(els.panTree, els.panHealth, els.panSessions);

    // right sidebar: our details pane in front of the page's own
    var sr = G('sR');
    els.sr = h('div', { id: 'obSr', class: 'ob-only' });
    sr.insertBefore(els.sr, sr.firstChild);
    // a run's detail: the trace tree over the canvas, the selected step's details under our pane
    if (HUB.obsTrace) HUB.obsTrace.mount(cvA, sr, els.sr);

    // canvas mouse: in observation mode a drag on the background pans and a click clears the selection
    var down = null;
    cvA.addEventListener('mousedown', function (e) {
      if (!on || e.button !== 0) return;
      if (e.target.closest('.ob-float, .ob-tl, .zm-ctrl, .ob-card, .ob-fh, .ob-hit, .ob-tog, .ob-trace')) return;
      down = { x: e.clientX, y: e.clientY };
      isPan = true; panSt = { x: e.clientX, y: e.clientY, px: panX, py: panY };
      e.preventDefault(); e.stopImmediatePropagation();
    }, true);
    cvA.addEventListener('click', function (e) {
      if (!on) return;
      if (e.target.closest('.ob-float, .ob-tl, .zm-ctrl, .ob-card, .ob-fh, .ob-hit, .ob-tog, .ob-trace')) return;
      e.stopImmediatePropagation();
      var moved = down && (Math.abs(e.clientX - down.x) + Math.abs(e.clientY - down.y) > 4);
      down = null;
      if (!moved && st().selection) HUB.store.set({ selection: null }, { history: false });
    }, true);
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('click', function (e) { if (els.pop && !els.pop.contains(e.target) && !e.target.closest('[data-pop]')) closePop(); });
    // the canvas can start at zero size (a background tab, a collapsed pane); refit as soon as it has room
    var onResize = function () { clearTimeout(rzTimer); rzTimer = setTimeout(function () { if (on) renderAll(st(), st()); }, 160); };
    window.addEventListener('resize', onResize);
    if (window.ResizeObserver) new ResizeObserver(onResize).observe(cvA);
  }

  /* ================= mode ================= */
  // keepCase: the observed case stays (start-up from a link); otherwise switching from the designer follows its preset
  function setMode(obs, keepCase) {
    on = !!obs;
    document.body.classList.toggle('obs-on', on);
    els.mode.querySelectorAll('button').forEach(function (b) { b.classList.toggle('on', (b.getAttribute('data-mode') === 'obs') === on); });
    HUB.obsStage.show(on);
    try { localStorage.setItem('hub.mode', on ? 'obs' : 'design'); } catch (e) { /* storage blocked */ }
    if (on) {
      // the hidden editor tabs must not stay selected
      var tabs = document.querySelectorAll('.sl-tabs .sl-tab');
      var active = document.querySelector('.sl-tabs .sl-tab.on');
      if (!active || active.hasAttribute('data-ob-hide')) zmienTab('pr', tabs[1]);
      G('heroOverlay').classList.remove('show');
      if (!keepCase && typeof actPr !== 'undefined' && actPr && actPr !== st().caseId && HUB.base.presets[actPr]) HUB.store.switchCase(actPr);
      lastFitSig = '';
      renderAll(st(), null);
    } else {
      // back to the designer: the canvas shows the same team the observer was looking at (when it is a designer template)
      if (!HUB.base.presets[st().caseId]) { dopasujWidok(); }
      else if (typeof actPr === 'undefined' || actPr !== st().caseId) { syncing = true; ladujPreset(st().caseId); syncing = false; }
      else { dopasujWidok(); if (actPr) pokazInfoPr(actPr); }
    }
  }

  // called by the page's ladujPreset (a one-line hook in index.html)
  function onPreset(pid) {
    if (syncing || !on || !HUB.base.presets[pid]) return;
    if (pid !== st().caseId) HUB.store.switchCase(pid);
  }

  /* ================= render ================= */
  function renderAll(s, prev) {
    if (!on) return;
    var m = model();
    if (!m) return;
    // the designer underneath follows the observed template; real sessions have no template to load
    if (typeof actPr !== 'undefined' && actPr !== s.caseId && HUB.base.presets[s.caseId]) { syncing = true; safe('ladujPreset', function () { ladujPreset(s.caseId); }); syncing = false; }
    renderTop(s);
    renderCrumbs(s);
    renderTopCtl(s);
    renderCtrl(s);
    renderScene(s, prev);
    renderSide();
    renderPanel(s);
    if (HUB.obsTimeline) safe('timeline.update', function () { HUB.obsTimeline.update(m, s); });
    renderStatus(s);
    document.title = m.presetName + ' · 协作观察';
  }

  function buildScene(m, s, a, view) {
    if (s.present === 'panel') return { subject: 'panel', cards: [], frames: [], links: [], bbox: { x: 0, y: 0, w: 10, h: 10 } };
    if (s.subject === 'process' && HUB.obsSceneProcess) return HUB.obsSceneProcess.build(m, s, a, view);
    if (s.subject === 'org') return HUB.obsSceneOrg.build(m, s, a, view);
    // exec: a run's detail is the trace view over the canvas (HUB.obsTrace), not a scene
    return { subject: s.subject, cards: [], frames: [], links: [], bbox: { x: 0, y: 0, w: 10, h: 10 } };
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
    if (HUB.obsTrace) safe('trace', function () { HUB.obsTrace.render(s, m); });
    var b = scene.bbox;
    var sig = [m.id, scene.subject, Math.round(b.x / 8), Math.round(b.y / 8), Math.round(b.w / 8), Math.round(b.h / 8), Math.round(view.w / 24), Math.round(view.h / 24)].join('|');
    if (sig !== lastFitSig || lastSubject !== scene.subject) {
      HUB.obsStage.fit(b, !caseChanged, fitPad());
      lastFitSig = sig;
    }
    lastSubject = scene.subject;
  }
  // keep the drawing clear of the floating controls: measure them instead of guessing
  function fitPad() {
    var cv = cvA.getBoundingClientRect();
    var top = 56, bottom = 120;
    [els.crumbs, els.topctl].forEach(function (e) { if (e && e.offsetParent) top = Math.max(top, e.getBoundingClientRect().bottom - cv.top + 14); });
    [els.ctrl, els.tl].forEach(function (e) { if (e && e.offsetParent && e.style.display !== 'none') bottom = Math.max(bottom, cv.bottom - e.getBoundingClientRect().top + 14); });
    return { top: top, right: 36, bottom: bottom, left: 36 };
  }
  function fit(instant) { var sc = HUB.obsStage.scene; if (sc) HUB.obsStage.fit(sc.bbox, instant !== true, fitPad()); }

  function showPanelMode(s) {
    var panel = s.present === 'panel';
    if (!els.panelHost) {
      els.panelHost = h('div', { class: 'ob-panelhost ob-only' });
      // the page zooms the canvas on wheel and cancels the scroll; the panel sits inside the canvas, so keep its wheel to itself
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
        title: v.name + '：' + v.question + '（快捷键 ' + v.num + '）', onClick: function () { HUB.views.go(v.id); }
      }, h('span', { class: 'ob-vic', html: icon(VIEW_ICONS[v.id] || '', 16) }),
        h('span', { class: 'ob-vtx' }, h('span', { class: 'ob-vname' }, h('span', { class: 'ob-vnum' }, v.num + ' '), v.short), h('span', { class: 'ob-vq' }, v.question))));
    });
    els.tb.appendChild(row);
    // the decision chain is a drill-down opened from an individual or a session, not one of the views: say where we are and how to go back
    var tg = drill(s);
    if (tg) els.tb.appendChild(h('span', { class: 'ob-custom ob-drill', title: '从个体或会话打开的决策链；Esc 或“返回”回到原来的视图' },
      tg.label, h('a', { class: 'ob-a', onClick: function () { leaveChain(); } }, ' 返回')));
    else if (!cur) els.tb.appendChild(h('span', { class: 'ob-custom', title: '当前的观察状态不等于任何一个常用视图。可以存成“我的视图”' }, '自定义'));
    var mine = h('button', { type: 'button', class: 'btn ob-mine', 'data-pop': '1', title: '把当前观察状态存下来，或打开存过的', onClick: function (e) { e.stopPropagation(); openMine(mine); } }, '我的视图 ▾');
    els.tb.appendChild(mine);
    els.tb.appendChild(h('button', { type: 'button', class: 'btn ob-mine', title: '这是什么、图例、六种视图、键盘（?）', onClick: function () { if (HUB.obsGuide) HUB.obsGuide.open(); } }, '说明'));
  }

  /* ---------- canvas: breadcrumbs (top left) ---------- */
  function renderCrumbs(s) {
    var m = model();
    els.crumbs.innerHTML = '';
    els.crumbs.appendChild(h('button', { type: 'button', class: 'ob-ibtn', title: '返回上一个观察状态（Alt+←）', disabled: !HUB.store.canBack(), onClick: function () { HUB.store.back(); } }, '←'));
    els.crumbs.appendChild(h('button', { type: 'button', class: 'ob-ibtn', title: '前进（Alt+→）', disabled: !HUB.store.canForward(), onClick: function () { HUB.store.forward(); } }, '→'));
    var c = h('div', { class: 'ob-crumb' });
    var gt = function () { return h('span', { class: 'ob-gt' }, '›'); };
    c.appendChild(h('a', { title: m.summary || '', onClick: function () { zmienTab('pr', document.querySelectorAll('.sl-tabs .sl-tab')[1]); } }, m.name));
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
    if (s.time != null) { c.appendChild(gt()); c.appendChild(h('span', null, '截止 ' + U.fmtClock(s.time))); }
    els.crumbs.appendChild(c);
    // focus picker: which case instance to follow
    if (s.subject !== 'exec' && m.facts.cases.length) {
      var sel = h('select', { class: 'ob-select', title: '聚焦一个案例实例：只点亮它经过的个体和交接', onChange: function () {
        var v2 = sel.value;
        if (!v2) HUB.store.set({ focus: null });
        else HUB.store.set({ focus: { type: 'case', id: v2 }, instanceId: v2, depth: { org: Math.max(2, s.depth.org) } });
      } });
      sel.appendChild(h('option', { value: '' }, '不聚焦'));
      m.facts.cases.forEach(function (k) {
        if (!HUB.model.visible(k.start, s)) return;
        var o = h('option', { value: k.id }, k.id + ' ' + k.name + '（' + (L.caseStatus[k.status] || k.status) + '）');
        if (s.focus && s.focus.type === 'case' && s.focus.id === k.id) o.selected = true;
        sel.appendChild(o);
      });
      els.crumbs.appendChild(h('span', { class: 'ob-sep' }));
      els.crumbs.appendChild(sel);
    }
  }

  /* ---------- canvas: granularity, comparison, presentation (top right) ---------- */
  function renderTopCtl(s) {
    els.topctl.innerHTML = '';
    var d = DEPTHS[s.subject] || [];
    if (d.length && s.present !== 'panel') {
      els.topctl.appendChild(h('span', { class: 'ob-lbl' }, '粒度'));
      var seg = h('div', { class: 'ob-seg', title: '展开到哪一层（[ 和 ] 也行）' });
      d.forEach(function (x) {
        seg.appendChild(h('button', { type: 'button', class: s.depth[s.subject] === x[0] ? 'on' : '', onClick: function () { HUB.store.setDepth(s.subject, x[0]); } }, x[1]));
      });
      els.topctl.appendChild(seg);
      var n = (s.expanded[s.subject] || []).length + (s.collapsed[s.subject] || []).length;
      if (n) els.topctl.appendChild(h('span', { class: 'ob-reset', title: '有分组被单独展开或折叠；点这里回到统一粒度', onClick: function () { HUB.store.setDepth(s.subject, s.depth[s.subject]); } }, '局部 ' + n + ' 处 · 还原'));
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
  function renderSide() {
    if (!HUB.obsSide) return;
    var s = st();
    if (els.panTree.classList.contains('on')) safe('side.tree', function () { HUB.obsSide.tree(els.panTree, model(), s); });
    if (els.panHealth.classList.contains('on')) safe('side.health', function () { HUB.obsSide.health(els.panHealth, model(), s); });
    if (els.panSessions.classList.contains('on') && HUB.obsSessions) safe('side.sessions', function () { HUB.obsSessions.render(els.panSessions); });
  }
  function renderPanel(s) {
    if (HUB.obsPanel) safe('panel', function () { HUB.obsPanel.render(els.sr, model(), s); });
  }
  // one .st item per number, in the page's own status bar; the editor's items hide in observation mode
  function renderStatus(s) {
    var m = model(), a = HUB.model.an(s, m), t = a.totals;
    var bar = document.querySelector('.statbar');
    bar.querySelectorAll('.ob-st').forEach(function (n) { n.remove(); });
    [['个体', t.individuals], ['任务线', t.relations], ['案例', t.cases], ['运行', t.runs], ['调用', U.fmtNum(t.calls)], ['token', U.fmtNum(t.tokens)],
      ['首次通过', U.pct(t.firstPassRate)], ['返工率', U.pct(t.reworkRate)], ['编排版本', m.def.version], ['时间', s.time == null ? '全部' : '截止 ' + U.fmtClock(s.time)]].forEach(function (x) {
      bar.appendChild(h('div', { class: 'st ob-st' }, h('span', null, x[0] + ':'), h('span', { class: 'st-v' }, String(x[1]))));
    });
    bar.appendChild(h('div', { class: 'st ob-st', style: { border: 'none' } }, h('span', { class: 'ob-tag-sim' }, m.synthetic ? '事实为模拟数据' : '本机真实会话')));
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
        pokazToast('已存为我的视图');
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
    if (!on) return;
    // typing inside the trace view's shadow root reaches us retargeted to its host; look at the real target
    var tg = (e.composedPath && e.composedPath()[0]) || e.target;
    if (tg && (tg.tagName === 'INPUT' || tg.tagName === 'TEXTAREA' || tg.tagName === 'SELECT' || tg.isContentEditable)) return;
    if (document.querySelector('.mo.show') || (G('wzOverlay') && G('wzOverlay').classList.contains('show')) || (G('hkOverlay') && G('hkOverlay').classList.contains('show')) || (typeof learnOpen !== 'undefined' && learnOpen)) return;
    var k = e.key;
    var s = st();
    var handled = true;
    if (/^[1-4]$/.test(k) && !e.ctrlKey && !e.metaKey && !e.altKey) HUB.views.go('v' + k);
    else if (e.altKey && k === 'ArrowLeft') HUB.store.back();
    else if (e.altKey && k === 'ArrowRight') HUB.store.forward();
    else if (k === 'g' || k === 'G') HUB.store.set({ present: s.present === 'graph' ? 'panel' : 'graph' });
    else if (k === '[' || k === ']') {
      var d = DEPTHS[s.subject] || [];
      var cur = s.depth[s.subject] || 1;
      var nx = Math.max(1, Math.min(d.length, cur + (k === ']' ? 1 : -1)));
      if (nx !== cur) HUB.store.setDepth(s.subject, nx);
    }
    else if (k === 'f' || k === 'F') fit();
    else if (k === 'Escape') { if (els.pop) closePop(); else if (s.subject === 'exec') leaveChain(); else if (s.selection) HUB.store.set({ selection: null }, { history: false }); else if (s.focus) HUB.store.set({ focus: null }); }
    else if (k === '?' || k === '/') { if (HUB.obsGuide) HUB.obsGuide.open(); else pokazSkroty(); }
    else if (k === '=' || k === '+' || k === '-' || k === '0') handled = false;   // the page's own zoom keys
    else if (k === ' ' && HUB.obsTimeline && HUB.obsTimeline.toggleReplay) HUB.obsTimeline.toggleReplay();
    else if (['Delete', 'Backspace', 'c', 'l', 'd', 'e', 'k', 'p', ' '].indexOf(k) >= 0 || (e.ctrlKey && k === 'a')) handled = true;   // editor keys do nothing here
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
    }).catch(function (e) { if (typeof pokazToast === 'function') pokazToast('链接里的数据没打开：' + e.message); });
  }

  function start() {
    // 本地案例（hub/cases/ 目录、hub/graph/*.json）的发现是异步的：链接里的新案例要等
    // owns() 就绪才能判定，预设列表也要等发现完成才能注入小节。先等扫描再应用启动状态。
    Promise.all([
      HUB.fromDocs && HUB.fromDocs.ready ? HUB.fromDocs.ready() : Promise.resolve(),
      HUB.fromHubGraph && HUB.fromHubGraph.ready ? HUB.fromHubGraph.ready() : Promise.resolve()
    ]).catch(function () {}).then(boot);
  }

  function boot() {
    var patch = HUB.store.fromHash(location.hash || '');
    var fromLink = !!patch.caseId;
    var pending = patch.caseId && !HUB.model.ready(patch.caseId) && HUB.model.owns(patch.caseId) ? Object.assign({}, patch) : null;
    if (!patch.caseId || !HUB.model.ready(patch.caseId)) patch.caseId = (typeof actPr !== 'undefined' && actPr && HUB.base.presets[actPr]) ? actPr : HUB.store.DEFAULT.caseId;
    HUB.store.init(patch);
    HUB.model.select(HUB.store.get().caseId);
    if (!patch.subject && !patch.depth) HUB.store.init(Object.assign({}, patch, HUB.views.get('v2').apply(HUB.store.get(), HUB.model.current)));
    inject();
    HUB.store.subscribe(function (s, prev) {
      if (!prev || s.caseId !== prev.caseId) HUB.model.select(s.caseId);
      renderAll(s, prev);
    });
    HUB.bus.on('model', function () { var s = st(); renderAll(s, s); });
    // re-render the trace component when the page theme changes so its shadow DOM picks up the new palette
    new MutationObserver(function () { if (HUB.obsTrace && HUB.obsTrace.available()) { var s = st(); HUB.obsTrace.render(s, HUB.model.current); } })
      .observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    // a pasted or edited link restores that observation state (our own writes use replaceState and fire nothing)
    window.addEventListener('hashchange', function () {
      if (location.hash === HUB.store.toHash(st())) return;
      var p = HUB.store.fromHash(location.hash);
      if (!on) setMode(true, true);
      if (p.caseId && !HUB.model.ready(p.caseId)) { if (HUB.model.owns(p.caseId)) later(p); return; }
      if (p.caseId && p.caseId !== st().caseId) HUB.store.switchCase(p.caseId);
      delete p.caseId;
      HUB.store.set(p);
    });
    var mode = 'obs';
    try { mode = localStorage.getItem('hub.mode') || 'obs'; } catch (e) { /* storage blocked */ }
    setMode(fromLink || mode !== 'design', true);
    if (pending) later(pending);
    // 预设列表的首次渲染发生在 hub 脚本加载之前，本地案例小节要靠这里补一次重画
    if (typeof rPresety === 'function') rPresety();
  }

  /* ---------- 本地自动解析的案例（hub/cases/ 与 hub/graph/）----------
     不在 62 个预设里的案例进不了设计器的预设列表（rPresety 只画 base.presets），
     这里把发现到的本地案例作为独立小节注入列表；点击直接进观察模式。
     boot() 在扫描完成后会重画一次 rPresety，本函数只负责出 HTML。 */
  function localCases(q, noCat) {
    if (!noCat) return '';   // 分类筛选生效时不混入：本地案例没有预设分类
    var docs = (HUB.fromDocs && HUB.fromDocs.caseList()) || [];
    var graph = (HUB.fromHubGraph && HUB.fromHubGraph.cases) || [];
    var items = [];
    docs.forEach(function (r) { if (!HUB.base.presets[r.id]) items.push({ id: r.id, title: r.title, src: 'md' }); });
    graph.forEach(function (id) {
      if (!HUB.base.presets[id] && !docs.some(function (r) { return r.id === id; })) items.push({ id: id, title: id, src: 'json' });
    });
    if (!items.length) return '';
    if (q) {
      var s = q.toLowerCase();
      items = items.filter(function (x) { return (x.title + ' ' + x.id).toLowerCase().indexOf(s) >= 0; });
      if (!items.length) return '';
    }
    var h = '<div class="pr-cat">本地自动解析 · hub/cases 与 hub/graph<span class="pr-cat-count">&middot; ' + items.length + '</span></div>';
    items.forEach(function (x) {
      h += '<div class="pr-item ph-build" tabindex="0" role="option" title="' + x.id + '"'
        + ' onclick="HUB.obs.openCase(\'' + x.id + '\')"'
        + ' onkeydown="if(event.key===\'Enter\'||event.key===\' \'){event.preventDefault();HUB.obs.openCase(\'' + x.id + '\')}">'
        + '<div class="pr-orb">' + (x.src === 'md' ? '文' : '{ }') + '</div>'
        + '<div class="pr-name"><span>' + x.title + '</span></div>'
        + '<span class="pr-cnt" title="来源">' + x.src + '</span></div>';
    });
    return h;
  }
  function openCase(id) {
    if (!on) setMode(true, true);
    HUB.store.switchCase(id);
  }

  HUB.obs = { start: start, onPreset: onPreset, setMode: setMode, isOn: function () { return on; }, fit: fit, render: function () { renderAll(st(), st()); }, localCases: localCases, openCase: openCase };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
