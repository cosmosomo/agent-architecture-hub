/* HUB.obsTrace: Unified Execution & Agent Control Room Workbench.
   Combines HUB.obsChat (live conversation + xacpx tool cards + 5-channel acpx gateway)
   with window.HubTrace (trace/apps/viewer embedded span tree & details sidebar).
   Supports 3 view modes right inside #obTraceHost:
     - 'split' (default): ◫ 双栏同屏 (Left: Live Chat & Control Room | Right: Interactive Trace Tree)
     - 'chat':            💬 实况对话 (Full-width Chat & Control Room)
     - 'trace':           🌿 调用树   (Full-width Trace Tree) */
(function () {
  'use strict';
  var HUB = (window.HUB = window.HUB || {});
  var h = HUB.util.h;
  var esc = HUB.util.esc;
  var els = {}, handle = null, last = { key: '', data: null };
  var remote = {};   // session id -> { status: 'loading' | 'ok' | 'error', session, error }
  var treeShowAll = {}; // session id -> boolean
  var lastTreePropsKey = '';
  var viewMode = 'split'; // 'split' | 'chat' | 'trace'

  try {
    var savedMode = window.localStorage && localStorage.getItem('hub.trace.mode');
    if (savedMode === 'split' || savedMode === 'chat' || savedMode === 'trace') viewMode = savedMode;
  } catch (e) { /* ignore storage errors */ }

  function available() { return !!(window.HubTrace && window.HubTrace.mount); }

  function setViewMode(m) {
    if (m !== 'split' && m !== 'chat' && m !== 'trace') return;
    viewMode = m;
    try { if (window.localStorage) localStorage.setItem('hub.trace.mode', m); } catch (e) {}
    if (els.body && els.body.setAttribute) els.body.setAttribute('data-mode', viewMode);
    if (HUB.obs) HUB.obs.render();
  }

  /* canvas: the element the tree covers; side: the right sidebar; after: the summary pane the details go under */
  function mount(canvas, side, after) {
    els.host = h('div', { class: 'ob-tracehost ob-trace' });
    els.head = h('div', { class: 'cr-header' });
    els.body = h('div', { class: 'cr-body', 'data-mode': viewMode });
    els.chatPane = h('div', { class: 'cr-chat-pane' });
    els.crResizer = h('div', {
      class: 'cr-resizer',
      title: '左右拖拽调节「实况对话 ↔ 时序调用树」宽度比例（双击复位 58:42）'
    }, h('i', { class: 'rz-grip' }));
    els.tracePane = h('div', { class: 'cr-trace-pane' });
    els.traceSubhead = h('div', { class: 'cr-trace-subhead' });
    els.note = h('div', { class: 'ob-trace-note' });
    els.tree = h('div', { class: 'ob-trace-tree' });
    els.tracePane.append(els.traceSubhead, els.note, els.tree);
    els.body.append(els.chatPane, els.crResizer, els.tracePane);
    els.host.append(els.head, els.body);

    // the canvas zooms on wheel; the control room and trace scroll instead
    els.host.addEventListener('wheel', function (e) { e.stopPropagation(); }, { passive: true });
    els.host.addEventListener('click', onHostClick);
    els.host.addEventListener('change', onHostChange);
    canvas.appendChild(els.host);

    els.srResizer = h('div', {
      class: 'ws-rz-sr-v',
      title: '上下拖拽调节「会话摘要 ↕ 详情检视器」高度比例（双击复位）'
    }, h('i', { class: 'rz-grip' }));
    els.side = h('div', { class: 'ob-traceside ob-trace' });
    side.insertBefore(els.srResizer, after.nextSibling);
    side.insertBefore(els.side, els.srResizer.nextSibling);

    mountResizers(canvas, side);
  }

  function lsGet(key, fallback) {
    try {
      var v = window.localStorage && localStorage.getItem(key);
      var n = v != null ? Number(v) : NaN;
      return isFinite(n) && n > 0 ? n : fallback;
    } catch (e) { return fallback; }
  }
  function lsSet(key, val) {
    try { if (window.localStorage) localStorage.setItem(key, String(val)); } catch (e) {}
  }

  function mountResizers(canvas, side) {
    if (!canvas || !canvas.parentNode || typeof document === 'undefined' || !document.documentElement) return;
    var root = document.documentElement;
    var ws = canvas.parentNode;
    var sL = document.getElementById('sL');

    // Restore persisted column proportions
    var initSlW = lsGet('hub.layout.slW', 268);
    var initSrW = lsGet('hub.layout.srW', 356);
    var initChatPct = lsGet('hub.layout.crChatPct', 58);
    var initSrTopPct = lsGet('hub.layout.srTopPct', 48);
    root.style.setProperty('--sl-w', initSlW + 'px');
    root.style.setProperty('--sr-w', initSrW + 'px');
    if (els.body && els.body.style) els.body.style.setProperty('--cr-chat-pct', initChatPct + '%');
    if (side && side.style) side.style.setProperty('--sr-top-pct', initSrTopPct + '%');

    // Outer Left ↔ Center resizer
    var rzL = h('div', {
      class: 'ws-resizer ws-rz-l',
      title: '左右拖拽调节左栏（预设/目录/会话）宽度（双击复位 268px）'
    }, h('i', { class: 'rz-grip' }));
    if (sL && sL.parentNode === ws) {
      ws.insertBefore(rzL, canvas);
    }

    // Outer Center ↔ Right resizer
    var rzR = h('div', {
      class: 'ws-resizer ws-rz-r',
      title: '左右拖拽调节右栏（详情/编排调控）宽度（双击复位 356px）'
    }, h('i', { class: 'rz-grip' }));
    if (side && side.parentNode === ws) {
      ws.insertBefore(rzR, side);
    }

    function syncVisibility() {
      if (sL) rzL.classList.toggle('hidden', sL.classList.contains('collapsed'));
      if (side) rzR.classList.toggle('on', side.classList.contains('open') || side.classList.contains('ob-trace-open'));
    }
    syncVisibility();
    if (typeof MutationObserver !== 'undefined') {
      var mo = new MutationObserver(syncVisibility);
      if (sL) mo.observe(sL, { attributes: true, attributeFilter: ['class'] });
      if (side) mo.observe(side, { attributes: true, attributeFilter: ['class'] });
    }

    var tipEl = null;
    function showTip(x, y, text) {
      if (!tipEl) {
        tipEl = h('div', { class: 'rz-hud-tip' });
        document.body.appendChild(tipEl);
      }
      tipEl.textContent = text;
      tipEl.style.left = Math.max(70, Math.min(window.innerWidth - 70, x)) + 'px';
      tipEl.style.top = Math.max(40, y) + 'px';
      tipEl.style.display = 'block';
    }
    function hideTip() {
      if (tipEl) tipEl.style.display = 'none';
    }

    function bindDrag(handleEl, axis, onMove, onReset) {
      if (!handleEl || !handleEl.addEventListener) return;
      handleEl.addEventListener('dblclick', function (e) {
        e.preventDefault();
        e.stopPropagation();
        onReset();
      });
      handleEl.addEventListener('mousedown', function (e) {
        if (e.button !== 0) return;
        e.preventDefault();
        e.stopPropagation();
        handleEl.classList.add('dragging');
        document.body.classList.add(axis === 'y' ? 'is-resizing-row' : 'is-resizing-pane');
        var move = function (ev) {
          onMove(ev);
        };
        var up = function () {
          handleEl.classList.remove('dragging');
          document.body.classList.remove('is-resizing-pane', 'is-resizing-row');
          hideTip();
          window.removeEventListener('mousemove', move);
          window.removeEventListener('mouseup', up);
        };
        window.addEventListener('mousemove', move);
        window.addEventListener('mouseup', up);
      });
    }

    // 1. Drag Left Sidebar (--sl-w: 180px ~ 560px)
    bindDrag(rzL, 'x', function (ev) {
      var rect = ws.getBoundingClientRect();
      var w = Math.round(Math.max(180, Math.min(560, ev.clientX - rect.left)));
      root.style.setProperty('--sl-w', w + 'px');
      lsSet('hub.layout.slW', w);
      showTip(ev.clientX, ev.clientY, '左栏宽度 ' + w + 'px · 双击复位');
    }, function () {
      root.style.setProperty('--sl-w', '268px');
      lsSet('hub.layout.slW', 268);
      if (HUB.shell && HUB.shell.toast) HUB.shell.toast('已复位左栏宽度 (268px)');
    });

    // 2. Drag Control Room Chat ↔ Trace Tree (--cr-chat-pct: 28% ~ 78%)
    bindDrag(els.crResizer, 'x', function (ev) {
      if (!els.body) return;
      var rect = els.body.getBoundingClientRect();
      if (!rect.width) return;
      var pct = Math.round(Math.max(28, Math.min(78, ((ev.clientX - rect.left) / rect.width) * 100)));
      els.body.style.setProperty('--cr-chat-pct', pct + '%');
      lsSet('hub.layout.crChatPct', pct);
      showTip(ev.clientX, ev.clientY, '实况对话 ' + pct + '% : 调用树 ' + (100 - pct) + '% · 双击复位');
    }, function () {
      if (els.body) els.body.style.setProperty('--cr-chat-pct', '58%');
      lsSet('hub.layout.crChatPct', 58);
      if (HUB.shell && HUB.shell.toast) HUB.shell.toast('已复位控制室双栏比例 (58% : 42%)');
    });

    // 3. Drag Right Sidebar (--sr-w: 260px ~ 680px)
    bindDrag(rzR, 'x', function (ev) {
      var rect = ws.getBoundingClientRect();
      var w = Math.round(Math.max(260, Math.min(680, rect.right - ev.clientX)));
      root.style.setProperty('--sr-w', w + 'px');
      lsSet('hub.layout.srW', w);
      showTip(ev.clientX, ev.clientY, '右栏宽度 ' + w + 'px · 双击复位');
    }, function () {
      root.style.setProperty('--sr-w', '356px');
      lsSet('hub.layout.srW', 356);
      if (HUB.shell && HUB.shell.toast) HUB.shell.toast('已复位右栏宽度 (356px)');
    });

    // 4. Drag Right Sidebar Vertical Split (--sr-top-pct: 14% ~ 78%)
    bindDrag(els.srResizer, 'y', function (ev) {
      if (!side) return;
      var rect = side.getBoundingClientRect();
      if (!rect.height) return;
      var pct = Math.round(Math.max(14, Math.min(78, ((ev.clientY - rect.top) / rect.height) * 100)));
      side.style.setProperty('--sr-top-pct', pct + '%');
      lsSet('hub.layout.srTopPct', pct);
      showTip(ev.clientX, ev.clientY, '会话摘要 ' + pct + '% : 详情检视 ' + (100 - pct) + '%');
    }, function () {
      if (side) side.style.setProperty('--sr-top-pct', '48%');
      lsSet('hub.layout.srTopPct', 48);
      if (HUB.shell && HUB.shell.toast) HUB.shell.toast('已复位右栏上下比例 (48% : 52%)');
    });
  }

  function onHostClick(e) {
    var btn = e.target.closest('[data-trace-act]');
    if (!btn) return;
    var act = btn.getAttribute('data-trace-act');
    if (act === 'back') {
      e.preventDefault();
      var s = HUB.store.get();
      HUB.store.set({ subject: 'org', focus: s.focus && s.focus.type === 'case' ? s.focus : null, selection: null });
    } else if (act === 'mode') {
      e.preventDefault();
      setViewMode(btn.getAttribute('data-mode'));
    } else if (act === 'depth') {
      e.preventDefault();
      var lv = Number(btn.getAttribute('data-lv')) || 1;
      HUB.store.set({ depth: { exec: lv } });
    } else if (act === 'new-sess') {
      e.preventDefault();
      if (HUB.obsChat && HUB.obsChat.startNewSession) {
        HUB.obsChat.startNewSession();
      }
    } else if (act === 'reload-sess') {
      e.preventDefault();
      var sid = btn.getAttribute('data-id');
      if (sid) reloadSession(sid);
    } else if (act === 'tree-graph') {
      e.preventDefault();
      var tid = btn.getAttribute('data-id');
      if (tid && HUB.obsSessions && HUB.obsSessions.openTree) HUB.obsSessions.openTree(tid);
    } else if (act === 'toggle-tree-all') {
      e.preventDefault();
      var tsid = btn.getAttribute('data-id');
      if (tsid) {
        treeShowAll[tsid] = !treeShowAll[tsid];
        lastTreePropsKey = '';
        if (HUB.obs) HUB.obs.render();
      }
    } else if (act === 'focus-model') {
      e.preventDefault();
      if (viewMode === 'trace') setViewMode('split');
      setTimeout(function () {
        var msel = els.chatPane && els.chatPane.querySelector ? els.chatPane.querySelector('[data-cr-model-select]') : null;
        if (msel) {
          msel.focus();
          try { if (typeof msel.showPicker === 'function') msel.showPicker(); } catch (err) {}
        }
      }, 30);
    }
  }

  function onHostChange(e) {
    if (!e || !e.target || !HUB.obsChat) return;
    var hdrModel = e.target.closest('[data-trace-hdr-model]');
    if (hdrModel) {
      var chosenModel = hdrModel.value;
      var chId = hdrModel.getAttribute('data-ch') || '';
      var sessName = hdrModel.getAttribute('data-sess') || '';
      var traceId = hdrModel.getAttribute('data-trace-id') || '';
      if (chosenModel && HUB.obsChat.switchModel) {
        HUB.obsChat.switchModel(chId, sessName, traceId, chosenModel);
      }
      return;
    }
    var hdrCwd = e.target.closest('[data-trace-hdr-cwd]');
    if (hdrCwd) {
      var chosenCwd = hdrCwd.value;
      var chId2 = hdrCwd.getAttribute('data-ch') || '';
      var sessName2 = hdrCwd.getAttribute('data-sess') || '';
      var traceId2 = hdrCwd.getAttribute('data-trace-id') || '';
      if (chosenCwd && HUB.obsChat.switchCwd) {
        HUB.obsChat.switchCwd(chId2, sessName2, traceId2, chosenCwd);
      }
      return;
    }
  }

  // what the drill-down shows: a run of the model, or a session from this machine
  function target(s, m) {
    if (s.subject !== 'exec') return null;
    if (s.focus && s.focus.type === 'session') return { kind: 'session', id: s.focus.id };
    var r = HUB.model.focusRun(s, m);
    return r ? { kind: 'run', run: r } : null;
  }

  function makeDraftSession(id) {
    var parts = String(id || '').split(':');
    var chId = parts[1] || 'codex';
    var sessName = parts.slice(2).join(':') || (chId + '-main');
    var ch = HUB.obsChat && HUB.obsChat.CHANNELS
      ? (HUB.obsChat.CHANNELS.find(function (c) { return c.id === chId; }) || HUB.obsChat.CHANNELS[0])
      : { id: chId, label: chId.toUpperCase(), sourceKind: chId };
    var now = new Date().toISOString();
    return {
      contract: 'agent-trace/v0.2',
      id: id,
      source: { kind: ch.sourceKind || ch.id, rawId: sessName, path: '' },
      agent: { role: 'Solo', name: sessName, product: ch.label, originator: ch.id },
      title: '新会话 · ' + ch.label + ' (' + sessName + ')',
      startedAt: now,
      updatedAt: now,
      state: { status: 'empty', detail: '新创建的空白会话，等待发送首条指令' },
      links: [],
      stats: { turns: 0, modelCalls: 0, toolCalls: 0, toolErrors: 0, subagents: 0 },
      turns: []
    };
  }

  function load(id, silent) {
    if (!silent) {
      if (String(id || '').indexOf('new:') === 0) {
        remote[id] = { status: 'ok', session: makeDraftSession(id) };
      } else {
        remote[id] = { status: 'loading' };
      }
    }
    var done = function () { if (HUB.obs) HUB.obs.render(); };
    if (location.protocol !== 'http:' && location.protocol !== 'https:') {
      if (String(id || '').indexOf('new:') === 0) return;
      remote[id] = { status: 'error', error: '这个页面不是由观察台服务打开的，读不到本机会话。在仓库里运行 npm start，用它打印出来的地址打开。' };
      return;
    }
    fetch('/api/sessions/' + encodeURIComponent(id) + '?compact=1', { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error(r.status === 404 ? '本机没有这个会话' : '本地服务返回 ' + r.status); return r.json(); })
      .then(function (doc) { remote[id] = { status: 'ok', session: doc.session }; })
      .catch(function (e) { if (!silent || !remote[id] || remote[id].status !== 'ok') remote[id] = { status: 'error', error: '读不到这个会话：' + e.message }; })
      .then(done);
  }

  function reloadSession(id) {
    if (!id) return;
    load(id, true);
  }

  /* { session, layer, turn } for the target, or null while it loads; runs are cached per model revision and time cut */
  function data(t, s, m) {
    if (t.kind === 'run') {
      var key = m.id + '|' + m.rev + '|' + t.run.id + '|' + (s.time == null ? '' : s.time);
      if (last.key !== key) {
        var d = HUB.model.traceOf(m, t.run, s.time);
        // 当前嵌入组件只认识 note；仅转换展示副本，事实契约仍保留 annotation。
        if (d && d.session.turns.some(function (turn) { return turn.steps.some(function (step) { return step.name === 'annotation'; }); })) {
          d.session = Object.assign({}, d.session, { turns: d.session.turns.map(function (turn) {
            return Object.assign({}, turn, { steps: turn.steps.map(function (step) {
              return step.kind === 'event' && step.name === 'annotation' ? Object.assign({}, step, { name: 'note' }) : step;
            }) });
          }) });
        }
        last = { key: key, data: d };
      }
      return last.data;
    }
    if (!remote[t.id]) load(t.id, false);
    var r = remote[t.id];
    // a real session carries the decision records the case documents wrote for it, as its coarse-grained layer
    return r && r.status === 'ok' ? { session: r.session, layer: HUB.annotate.layerFor(m, r.session) } : null;
  }

  function note(text) {
    els.note.textContent = text;
    els.note.style.display = '';
    els.tree.style.display = 'none';
  }

  // 嵌入组件按时间戳计算耗时；顺序轨迹只隐藏这些读数，保留原文、树和选择行为。
  function measuredStyle(el, ordinal) {
    var root = el.shadowRoot;
    if (!root) return;
    var style = root.querySelector('style[data-hub-ordinal]');
    if (!style) {
      style = document.createElement('style');
      style.setAttribute('data-hub-ordinal', '');
      root.appendChild(style);
    }
    style.textContent = ordinal ?
      '.hub-trace span.bg-agentprism-secondary.h-4.min-w-20,' +
      '.hub-trace span.w-14.text-xs,' +
      '.hub-trace div.flex.flex-wrap.items-center.gap-2 > span.text-agentprism-muted-foreground.text-xs + span.bg-agentprism-badge-default,' +
      '.hub-trace div.flex.flex-wrap.items-center.gap-2 > span.text-agentprism-muted-foreground.text-xs { display:none !important; }' : '';
  }

  var TREE_TURN_WINDOW = 25;

  /* Window the session passed to the embedded React TreeView when turns > 30 so 300-1154 turn sessions render in <80ms */
  function windowedSessionForTree(session, selectedSpanId) {
    if (!session || !Array.isArray(session.turns)) return session;
    var total = session.turns.length;
    if (total <= 30 || treeShowAll[session.id]) return session;
    var startIdx = Math.max(0, total - TREE_TURN_WINDOW);
    var sliced = session.turns.slice(startIdx);
    if (selectedSpanId) {
      var inSliced = sliced.some(function (t) {
        return ('turn:' + t.id) === selectedSpanId || (t.steps && t.steps.some(function (st) { return st.id === selectedSpanId; }));
      });
      if (!inSliced) {
        var extraTurn = session.turns.find(function (t) {
          return ('turn:' + t.id) === selectedSpanId || (t.steps && t.steps.some(function (st) { return st.id === selectedSpanId; }));
        });
        if (extraTurn) sliced = [extraTurn].concat(sliced);
      }
    }
    return Object.assign({}, session, { turns: sliced });
  }

  function renderHeader(t, d, s, m) {
    if (!els.head) return;
    var sess = d && d.session ? d.session : null;
    var ch = HUB.obsChat ? HUB.obsChat.channelForSession(sess) : { id: 'codex', label: 'Agent', color: '#818CF8' };
    var liveRun = HUB.obsChat && sess ? HUB.obsChat.activeRunFor(sess, t.kind === 'session' ? t.id : '') : null;

    var title = '正在读取会话…';
    if (sess) {
      title = (t.kind === 'session' && HUB.obsSessions && HUB.obsSessions.titleOf && HUB.obsSessions.titleOf(t.id)) || sess.title || t.id;
    } else if (t.kind === 'run' && t.run) {
      title = HUB.model.name('individual', t.run.individualId) + ' 的运行记录';
    }
    if (title.length > 54) title = title.slice(0, 54) + '…';

    var stStatus = liveRun && liveRun.status === 'running' ? 'working' : (sess && sess.state ? sess.state.status : 'idle');
    var stText = liveRun && liveRun.status === 'running' ? '实况执行中' : stStatus === 'working' ? '运行中' : stStatus === 'failed' ? '有报错' : '就绪 / 可介入';
    var stCls = (liveRun && liveRun.status === 'running') || stStatus === 'working' ? 'working' : stStatus === 'failed' ? 'err' : 'idle';

    var stats = (sess && sess.stats) || { turns: 0, modelCalls: 0, toolCalls: 0, toolErrors: 0 };
    var traceIdStr = t.kind === 'session' ? t.id : '';
    var chatSt = HUB.obsChat && HUB.obsChat.getState ? HUB.obsChat.getState() : {};
    var sessNameStr = (chatSt && chatSt.selectedSessionName) || (sess && sess.agent && sess.agent.name) || ch.defaultSession || (ch.id + '-main');
    var activeCwd = (HUB.obsChat && HUB.obsChat.activeCwdFor ? HUB.obsChat.activeCwdFor(sess, traceIdStr) : '') || (sess && sess.cwd ? sess.cwd : '');
    var cwdList = (HUB.obsChat && HUB.obsChat.availableCwdsFor ? HUB.obsChat.availableCwdsFor(sess, traceIdStr) : (activeCwd ? [activeCwd] : []));
    var modelTag = (HUB.obsChat && HUB.obsChat.activeModelFor ? HUB.obsChat.activeModelFor(sess, traceIdStr) : '') ||
      (sess && sess.agent && sess.agent.model ? sess.agent.model : '');
    var modelList = (HUB.obsChat && HUB.obsChat.availableModelsFor ? HUB.obsChat.availableModelsFor(sess, traceIdStr) : (modelTag ? [modelTag] : []));
    var canSwitchM = HUB.obsChat && HUB.obsChat.canSwitchModelFor ? HUB.obsChat.canSwitchModelFor(sess, traceIdStr) : false;
    var caps = HUB.obsChat && HUB.obsChat.capabilitiesFor ? HUB.obsChat.capabilitiesFor(sess, traceIdStr) : { canCreateSession: true };
    var isDraftZero = String(traceIdStr || '').indexOf('new:') === 0 && (!stats || !stats.turns);
    var vLink = isDraftZero ? '' : viewerLink(s, m);
    var hasKids = sess && sess.links && sess.links.some(function (l) { return l.rel === 'child'; });
    var modelPillHtml = '';
    if (modelTag) {
      if (canSwitchM && modelList.length > 1) {
        var hdrModelOpts = modelList.map(function (mId) {
          return '<option value="' + esc(mId) + '"' + (mId === modelTag ? ' selected' : '') + '>' + esc(mId) + '</option>';
        }).join('');
        modelPillHtml =
          '<label class="cr-meta-pill cr-model-pill cr-hdr-select-pill" title="点击直接切换当前渠道/会话的模型">' +
            '<span>⚡</span>' +
            '<select class="cr-hdr-select" data-trace-hdr-model data-ch="' + esc(ch.id) + '" data-sess="' + esc(sessNameStr) + '" data-trace-id="' + esc(traceIdStr) + '">' +
              hdrModelOpts +
            '</select>' +
          '</label>';
      } else {
        modelPillHtml = '<span class="cr-meta-pill cr-model-static-pill" title="当前渠道/会话固定使用本机已验证可用模型">' + esc(modelTag) + '</span>';
      }
    }

    var cwdPillHtml = '';
    if (activeCwd && t.kind === 'session') {
      var hdrCwdOpts = cwdList.map(function (dir) {
        var base = dir === '__new__' ? '🆕 新目录（默认）' : String(dir).split(/[\\/]/).filter(Boolean).pop() || dir;
        var isSel = String(dir).toLowerCase() === String(activeCwd).toLowerCase();
        return '<option value="' + esc(dir) + '" title="' + esc(dir) + '"' + (isSel ? ' selected' : '') + '>' + esc(base) + '</option>';
      }).join('');
      hdrCwdOpts += '<option value="__custom__">✎ 自定义目录路径…</option>';
      cwdPillHtml =
        '<label class="cr-meta-pill cr-cwd-pill cr-hdr-select-pill" title="当前工作目录: ' + esc(activeCwd) + '（点击切换工作目录或输入自定义路径）">' +
          '<span>📁</span>' +
          '<select class="cr-hdr-select" data-trace-hdr-cwd data-ch="' + esc(ch.id) + '" data-sess="' + esc(sessNameStr) + '" data-trace-id="' + esc(traceIdStr) + '">' +
            hdrCwdOpts +
          '</select>' +
        '</label>';
    } else if (activeCwd) {
      var cwdBase = String(activeCwd).split(/[\\/]/).filter(Boolean).pop() || activeCwd;
      cwdPillHtml = '<span class="cr-meta-pill" title="' + esc(activeCwd) + '">📁 ' + esc(cwdBase) + '</span>';
    }

    els.head.innerHTML =
      '<div class="cr-hdr-left">' +
        '<button type="button" class="cr-back-btn" data-trace-act="back" title="返回协作拓扑画布 (快捷键 Esc)">← 画布</button>' +
        '<span class="cr-ch-badge" style="--ch-c:' + ch.color + '">' + esc(t.kind === 'run' ? '案例运行' : ch.label.toUpperCase()) + '</span>' +
        '<div class="cr-title-wrap">' +
          '<span class="cr-title" title="' + esc(sess ? sess.title : title) + '">' + esc(title) + '</span>' +
          '<div class="cr-sub-pills">' +
            '<span class="cr-st-pill ' + stCls + '"><i class="cr-st-dot"></i>' + esc(stText) + '</span>' +
            modelPillHtml +
            cwdPillHtml +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="cr-hdr-kpis">' +
        '<div class="cr-kpi"><b class="v">' + esc(stats.turns) + '</b><span>轮对话</span></div>' +
        '<div class="cr-kpi"><b class="v">' + esc(stats.modelCalls) + '</b><span>模型调用</span></div>' +
        '<div class="cr-kpi"><b class="v">' + esc(stats.toolCalls) + '</b><span>工具执行</span></div>' +
        (stats.toolErrors ? '<div class="cr-kpi err"><b class="v">✕ ' + esc(stats.toolErrors) + '</b><span>工具报错</span></div>' : '') +
      '</div>' +
      '<div class="cr-hdr-right">' +
        (caps.canCreateSession ? '<button type="button" class="cr-icon-btn" data-trace-act="new-sess" title="在当前渠道新建一个干净的独立会话">+ 新会话</button>' : '') +
        (t.kind === 'session' ? '<button type="button" class="cr-icon-btn" data-trace-act="reload-sess" data-id="' + esc(t.id) + '" title="立即刷新会话轨迹">↻ 刷新</button>' : '') +
        (hasKids && t.kind === 'session' ? '<button type="button" class="cr-icon-btn" data-trace-act="tree-graph" data-id="' + esc(t.id) + '" title="在主画布将该会话与子智能体画成协作拓扑图">☍ 协作图</button>' : '') +
        (vLink ? '<a class="cr-icon-btn" href="' + esc(vLink) + '" target="_blank" rel="noopener" title="在新标签页打开全屏 Trace 独立分析器">↗ 独立查看器</a>' : '') +
        '<div class="cr-modes" role="tablist" aria-label="控制室视图模式">' +
          '<button type="button" class="cr-mode-btn' + (viewMode === 'chat' ? ' on' : '') + '" data-trace-act="mode" data-mode="chat" title="全宽实况对话与工具卡片流">💬 实况对话</button>' +
          '<button type="button" class="cr-mode-btn' + (viewMode === 'split' ? ' on' : '') + '" data-trace-act="mode" data-mode="split" title="左栏实况对话与指令发送 + 右栏调用树联动">◫ 双栏同屏</button>' +
          '<button type="button" class="cr-mode-btn' + (viewMode === 'trace' ? ' on' : '') + '" data-trace-act="mode" data-mode="trace" title="全宽展开时序调用树与火焰耗时条">🌿 调用树</button>' +
        '</div>' +
      '</div>';

    if (els.traceSubhead) {
      var curDepth = (s.depth && s.depth.exec) || 1;
      var hasLayer = !!(d && d.layer && d.layer.segments && d.layer.segments.length);
      var totalTurns = sess && Array.isArray(sess.turns) ? sess.turns.length : 0;
      var isTreeAll = !!(sess && treeShowAll[sess.id]);
      var treeWinBtn = totalTurns > 30
        ? '<button type="button" class="cr-depth-pill' + (isTreeAll ? ' on' : '') + '" data-trace-act="toggle-tree-all" data-id="' + esc(sess.id) + '" title="长会话防卡死保护：默认在调用树中聚焦最近 ' + TREE_TURN_WINDOW + ' 轮">' +
            (isTreeAll ? '📜 已载入全部 ' + totalTurns + ' 轮 (只看最近几轮)' : '只看最近 ' + TREE_TURN_WINDOW + ' / ' + totalTurns + ' 轮 (展开全部)') +
          '</button>'
        : '';
      els.traceSubhead.innerHTML =
        '<div class="cr-tsub-left">' +
          '<span class="cr-tsub-title">🌿 时序调用树 (⑤⑥)</span>' +
          '<span class="cr-tsub-hint">点选任意节点 → 右栏即时检视完整 Input / Output 与原始属性</span>' +
        '</div>' +
        '<div class="cr-tsub-right">' +
          treeWinBtn +
          (hasLayer
            ? '<button type="button" class="cr-depth-pill' + (curDepth === 1 ? ' on' : '') + '" data-trace-act="depth" data-lv="1">⑤ 决策主干</button>' +
              '<button type="button" class="cr-depth-pill' + (curDepth >= 2 ? ' on' : '') + '" data-trace-act="depth" data-lv="2">⑥ 完整调用步骤</button>'
            : '<span class="cr-depth-tag">⑥ 完整调用步骤</span>') +
        '</div>';
    }
  }

  /* shows or hides the trace for the observation state; true while it covers the canvas */
  function render(s, m) {
    var t = target(s, m);
    var on = !!t && s.present !== 'panel';
    els.host.classList.toggle('on', on);
    els.host.classList.toggle('ob-trace-session', !!(on && t && t.kind === 'session'));
    if (!on) {
      els.side.classList.remove('on');
      els.side.parentNode.classList.remove('ob-trace-open');
      return false;
    }
    if (els.body && els.body.setAttribute) els.body.setAttribute('data-mode', viewMode);

    var d = data(t, s, m);
    var hasSteps = !!(d && d.session && d.session.turns && d.session.turns.some(function (x) { return x.steps && x.steps.length; }));
    els.side.classList.toggle('on', on && available() && hasSteps);
    els.side.parentNode.classList.toggle('ob-trace-open', on && available());

    renderHeader(t, d, s, m);

    // Render left/main Control Room Chat Pane
    if (HUB.obsChat && els.chatPane) {
      var curInfo = current(s, m);
      if (d && d.session && curInfo) curInfo.session = d.session;
      HUB.obsChat.render(els.chatPane, curInfo, s, m);
    }

    if (!available()) { note('Trace 组件没有加载（hub/vendor/hub-trace.js）。在 trace 目录运行 npm run build 生成它。'); return true; }
    if (!d) {
      var r = t.kind === 'session' ? remote[t.id] : null;
      note(r && r.status === 'error' ? r.error : t.kind === 'session' ? '读取会话…' : '这个时间点之前，它还没有运行。');
      return true;
    }
    if (!hasSteps) {
      note(t.kind === 'session' ? '当前为新创建的空白会话。在左侧输入第一条指令后，这里将实时生成调用树与耗时瀑布。' : '这次运行在这个时间点之前还没有留下任何一步。拖动底部时间轴往后看。');
      return true;
    }
    els.note.style.display = 'none';
    els.tree.style.display = '';
    var selSpan = s.selection && s.selection.type === 'span' ? s.selection.id : d.turn ? window.HubTrace.ids.turn(d.turn) : null;
    var treeSess = windowedSessionForTree(d.session, selSpan);
    var curTheme = document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
    var curDepth = s.depth.exec || 1;
    var propsKey = [
      treeSess.id,
      treeSess.turns.length,
      treeSess.updatedAt || '',
      d.layer && d.layer.segments ? d.layer.segments.length : 0,
      curDepth,
      curTheme,
      selSpan || ''
    ].join('|');
    var props = {
      session: treeSess, layer: d.layer, depth: curDepth,
      theme: curTheme,
      // a run of a real session opens at its own turn of that session
      selected: selSpan,
      onSelect: function (id) { HUB.store.set({ selection: { type: 'span', id: id } }, { history: false }); }
    };
    if (!handle) {
      handle = window.HubTrace.mount({ tree: els.tree, details: els.side }, props);
      lastTreePropsKey = propsKey;
    } else if (lastTreePropsKey !== propsKey) {
      handle.update(props);
      lastTreePropsKey = propsKey;
    }
    var ordinal = t.kind === 'run' && !HUB.model.measured(m, 'duration');
    measuredStyle(els.tree, ordinal);
    measuredStyle(els.side, ordinal);
    return true;
  }

  /* the same session at the same step in the Trace viewer: the session of a real run (or the session itself), and the step
     selected in the tree, else the turn the run stands for.  A simulated run is not a session on this machine: null. */
  function viewerLink(s, m) {
    var t = target(s, m), id = null, turn = null;
    if (!t) return null;
    if (t.kind === 'session') id = t.id;
    else {
      var ref = m.source && m.source.runs && m.source.runs[t.run.id];
      if (!ref) return null;
      id = ref.session; turn = ref.turn;
    }
    var span = s.selection && s.selection.type === 'span' ? s.selection.id : turn && available() ? window.HubTrace.ids.turn(turn) : null;
    var theme = document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
    return '/trace/#s=' + encodeURIComponent(id) + (span ? '&n=' + encodeURIComponent(span) : '') + '&theme=' + theme;
  }

  /* the session behind the drill-down, for the summary pane: the loaded one, or the converted run */
  function current(s, m) {
    var t = target(s, m);
    if (!t) return null;
    if (t.kind === 'run') {
      var d = data(t, s, m);
      return { kind: 'run', run: t.run, session: d ? d.session : null };
    }
    var r = remote[t.id] || {};
    return { kind: 'session', id: t.id, session: r.session || null, error: r.error || null, layer: r.session ? HUB.annotate.layerFor(m, r.session) : null };
  }

  HUB.obsTrace = {
    mount: mount,
    render: render,
    target: target,
    current: current,
    available: available,
    viewerLink: viewerLink,
    reloadSession: reloadSession,
    setViewMode: setViewMode
  };
  HUB.render.register('exec', { layer: { mount: function (ctx) { mount(ctx.canvas, ctx.side, ctx.pane); }, render: render } });
})();
