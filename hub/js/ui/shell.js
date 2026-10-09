/* HUB.shell: header, context bar, sidebar, stage switching, drawer, status bar, keyboard. */
(function () {
  'use strict';
  var HUB = (window.HUB = window.HUB || {});
  var U = HUB.util, h = U.h, L = U.LABELS;

  var els = {};
  var views = {};          // subject -> container
  var mounted = {};        // subject -> renderer mounted
  var shownSubject = null;
  var sbTab = 'cases';
  var caseQuery = '';
  var legendOpen = false;
  var sbCollapsed = false;

  var SIZE_LABELS = ['极简 · 2～3 人', '小型 · 4～5 人', '中型 · 6～8 人', '大型 · 9～11 人', '旗舰 · 12 人以上'];
  var DEPTHS = {
    org: [[1, '部门'], [2, '小组'], [3, '个体']],
    process: [[1, '阶段'], [2, '步骤']],
    exec: [[1, '决策'], [2, '调用']]
  };
  var LINE_CHIPS = [['task', '任务线', '--c-task'], ['info', '信息线', '--c-info'], ['watch', '监督线', '--c-watch'], ['channel', '渠道线', '--c-channel']];
  var OVERLAY_CHIPS = [['human', '人'], ['channels', '渠道节点'], ['delivery', '送达标记'], ['lanes', '执行路径']];

  function safe(label, fn) {
    try { return fn(); } catch (e) { console.error('[shell] ' + label, e); return null; }
  }
  function missing(el, what) { el.innerHTML = ''; el.appendChild(h('div', { class: 'mod-missing' }, what + '模块还没有载入。')); }
  function st() { return HUB.store.get(); }
  function model() { return HUB.model.current; }
  function an(s) { return HUB.model.an(s || st()); }

  /* ---------- build ---------- */
  function init(root) {
    root.innerHTML = '';
    root.removeAttribute('aria-busy');
    els.root = root;
    els.hd = h('header', { class: 'hd' });
    els.ctx = h('div', { class: 'ctx' });
    els.main = h('div', { class: 'main' });
    els.sb = h('aside', { class: 'sb', 'aria-label': '侧栏' });
    els.stage = h('section', { class: 'stage', 'aria-label': '视图' });
    els.dr = h('aside', { class: 'dr', 'aria-label': '详情' });
    els.drBody = h('div', { class: 'dr-body' });
    els.dr.appendChild(els.drBody);
    els.tl = h('div', { class: 'tl' });
    els.st = h('footer', { class: 'st' });
    els.main.append(els.sb, els.stage, els.dr);
    root.append(els.hd, els.ctx, els.main, els.tl, els.st);

    // sidebar skeleton (search input stays alive while typing)
    els.sbTabs = h('div', { class: 'sb-tabs', role: 'tablist' });
    els.sbSearch = h('input', { class: 'sb-search', type: 'search', placeholder: '搜索案例模板', 'aria-label': '搜索案例模板' });
    els.sbSearch.addEventListener('input', function () { caseQuery = els.sbSearch.value.trim(); renderSidebarBody(st()); });
    els.sbBody = h('div', { class: 'sb-body' });
    els.sb.append(els.sbTabs, els.sbBody);

    // stage skeleton
    els.panel = h('div', { class: 'stage-panel hidden' });
    els.legend = h('div', { class: 'legend-pop hidden' });
    els.tools = h('div', { class: 'stage-tools' },
      h('button', { class: 'btn', title: '适应窗口（F）', onClick: fit }, '适'),
      h('button', { class: 'btn', title: '图例', onClick: function () { legendOpen = !legendOpen; renderLegend(st()); } }, '例'));
    els.stage.append(els.panel, els.legend, els.tools);

    if (HUB.timeline && HUB.timeline.mount) safe('timeline.mount', function () { HUB.timeline.mount(els.tl); });
    else missing(els.tl, '时间线');

    document.addEventListener('keydown', onKey);
    document.addEventListener('click', function (e) {
      if (els.pop && !els.pop.contains(e.target) && !e.target.closest('[data-pop-anchor]')) closePop();
    });
    try { var th = localStorage.getItem('hub.theme'); if (th) document.documentElement.setAttribute('data-theme', th); } catch (e) { /* no storage */ }
  }

  /* ---------- update ---------- */
  function update(s, prev) {
    var m = model();
    if (!m) return;
    renderHeader(s);
    renderCtx(s);
    renderSidebar(s);
    renderStage(s, prev);
    renderDrawer(s);
    if (HUB.timeline && HUB.timeline.update) safe('timeline.update', function () { HUB.timeline.update(m, s); });
    renderStatus(s);
    renderLegend(s);
    document.title = m.presetName + ' · 协作观察台';
  }

  /* ---------- header ---------- */
  function renderHeader(s) {
    var m = model();
    var cur = HUB.views.current(s);
    els.hd.innerHTML = '';
    els.hd.appendChild(h('div', { class: 'hd-brand' }, '协作观察台', h('small', null, '多智能体协作的观察与调试')));
    var caseBtn = h('button', { class: 'hd-case', 'data-pop-anchor': '1', title: m.name + '（点击切换案例模板）', onClick: function (e) { e.stopPropagation(); openCasePop(caseBtn); } },
      h('span', { class: 'muted' }, '案例'), h('b', null, m.presetName), m.curated ? h('span', { class: 'tag cur' }, '精选') : null, h('span', { class: 'muted' }, '▾'));
    els.hd.appendChild(caseBtn);
    var seg = h('div', { class: 'seg', role: 'tablist', 'aria-label': '六种常用视图' });
    HUB.views.list().forEach(function (v) {
      seg.appendChild(h('button', {
        class: cur === v.id ? 'on' : '', role: 'tab', 'aria-selected': cur === v.id ? 'true' : 'false',
        title: v.name + '：' + v.question + '（快捷键 ' + v.num + '）',
        onClick: function () { HUB.views.go(v.id); }
      }, h('span', { class: 'num' }, String(v.num)), h('span', { class: 'lbl' }, v.short)));
    });
    var vw = h('div', { class: 'hd-views' }, seg);
    if (!cur) {
      vw.appendChild(h('span', { class: 'hd-custom', title: '当前观察状态不等于任何一个常用视图' }, '自定义'));
    }
    var mine = h('button', { class: 'btn ghost', 'data-pop-anchor': '1', title: '我的视图：把当前观察状态存下来', onClick: function (e) { e.stopPropagation(); openMinePop(mine); } }, '我的视图 ▾');
    vw.appendChild(mine);
    els.hd.appendChild(vw);
    els.hd.appendChild(h('div', { class: 'hd-spacer' }));
    var present = h('div', { class: 'seg', title: '呈现方式（G）' },
      h('button', { class: s.present === 'graph' ? 'on' : '', onClick: function () { HUB.store.set({ present: 'graph' }); } }, '图'),
      h('button', { class: s.present === 'panel' ? 'on' : '', onClick: function () { HUB.store.set({ present: 'panel' }); } }, '面板'));
    var compare = h('div', { class: 'seg', title: '对照方式：只看编排里的定义、两者对照、只看实际发生的事实' });
    [['def', '定义'], ['both', '对照'], ['fact', '事实']].forEach(function (c) {
      compare.appendChild(h('button', { class: s.compare === c[0] ? 'on' : '', onClick: function () { HUB.store.set({ compare: c[0] }); } }, c[1]));
    });
    els.hd.append(present, compare);
    var dark = document.documentElement.getAttribute('data-theme') === 'dark';
    els.hd.appendChild(h('button', { class: 'btn ghost', title: '切换浅色和深色', onClick: toggleTheme }, dark ? '浅色' : '深色'));
    els.hd.appendChild(h('button', { class: 'btn', title: '术语、六种视图、切换方式、快捷键（?）', onClick: function () { if (HUB.guide && HUB.guide.open) HUB.guide.open(); } }, '概念说明'));
  }

  function toggleTheme() {
    var dark = document.documentElement.getAttribute('data-theme') === 'dark';
    var next = dark ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem('hub.theme', next); } catch (e) { /* no storage */ }
    update(st(), st());
  }

  /* ---------- popovers ---------- */
  function closePop() { if (els.pop) { els.pop.remove(); els.pop = null; } }
  function placePop(pop, anchor) {
    var r = anchor.getBoundingClientRect();
    pop.style.left = Math.max(8, Math.min(r.left, window.innerWidth - 300)) + 'px';
    pop.style.top = (r.bottom + 4) + 'px';
    document.body.appendChild(pop);
    els.pop = pop;
  }
  function openCasePop(anchor) {
    closePop();
    var pop = h('div', { class: 'pop', role: 'listbox' });
    var cur = st().caseId;
    HUB.base.sizeGroups.forEach(function (g, gi) {
      pop.appendChild(h('div', { class: 'pop-h' }, SIZE_LABELS[gi] || ''));
      g.ids.forEach(function (id) {
        if (!HUB.base.presets[id]) return;
        var curated = !!(HUB.cases || {})[id];
        pop.appendChild(h('div', { class: 'pop-item', role: 'option', 'aria-selected': id === cur ? 'true' : 'false',
          onClick: function () { closePop(); if (id !== st().caseId) HUB.store.switchCase(id); } },
          h('span', { style: { flex: '1', 'font-weight': id === cur ? '600' : '400' } }, HUB.casedef.presetName(id)),
          curated ? h('span', { class: 'tag cur' }, '精选') : null,
          h('span', { class: 'muted' }, HUB.base.presets[id].nodes.length + ' 人')));
      });
    });
    placePop(pop, anchor);
  }
  function openMinePop(anchor) {
    closePop();
    var pop = h('div', { class: 'pop' });
    pop.appendChild(h('div', { class: 'pop-item', onClick: function () {
      var name = window.prompt('给这个视图起个名字', '我的视图');
      if (name == null) return;
      HUB.views.saveCurrent(name || undefined);
      closePop();
    } }, '把当前观察状态存为我的视图'));
    var mine = HUB.views.mine();
    if (mine.length) pop.appendChild(h('div', { class: 'pop-h' }, '已保存'));
    mine.forEach(function (v) {
      pop.appendChild(h('div', { class: 'pop-item' },
        h('span', { style: { flex: '1' }, onClick: function () { closePop(); HUB.views.goMine(v.id); } }, v.name),
        h('span', { class: 'muted' }, HUB.casedef.presetName(v.state.caseId)),
        h('button', { class: 'btn sm ghost', title: '删除', onClick: function (e) { e.stopPropagation(); HUB.views.removeMine(v.id); openMinePop(anchor); } }, '删')));
    });
    if (!mine.length) pop.appendChild(h('div', { class: 'pop-h' }, '还没有保存的视图'));
    placePop(pop, anchor);
  }

  /* ---------- context bar ---------- */
  function crumbs(s) {
    var m = model();
    var wrap = h('div', { class: 'crumbs' });
    var add = function (node, last) { wrap.appendChild(node); if (!last) wrap.appendChild(h('span', { class: 'gt' }, '›')); };
    add(h('a', { href: '#', title: '回到这个案例模板的全貌', onClick: function (e) { e.preventDefault(); HUB.store.set({ focus: null, selection: null }); } }, m.presetName));
    var vcur = HUB.views.current(s);
    var v = vcur ? HUB.views.get(vcur) : null;
    var parts = [];
    parts.push(h('span', null, (v ? v.name : '自定义') + '（' + L.subject[s.subject] + '）'));
    if (s.focus && s.focus.type === 'case') parts.push(h('a', { href: '#', onClick: function (e) { e.preventDefault(); HUB.store.set({ selection: { type: 'case', id: s.focus.id }, drawer: true }, { history: false }); } }, HUB.model.name('case', s.focus.id)));
    if (s.subject === 'exec') {
      var r = HUB.model.focusRun(s, m);
      if (r) {
        var c = r.caseId ? m.idx.case.get(r.caseId) : null;
        if (c) parts.push(h('a', { href: '#', onClick: function (e) { e.preventDefault(); HUB.store.set({ subject: 'org', focus: { type: 'case', id: c.id }, instanceId: c.id }); } }, c.id));
        parts.push(h('span', null, HUB.model.name('individual', r.individualId) + ' · ' + U.fmtClock(r.start)));
      }
    }
    if (s.selection) parts.push(h('span', { class: 'cur' }, HUB.model.name(s.selection.type, s.selection.id) || s.selection.id));
    parts.forEach(function (p, i) { add(p, i === parts.length - 1); });
    return wrap;
  }

  function renderCtx(s) {
    var m = model();
    els.ctx.innerHTML = '';
    els.ctx.appendChild(h('button', { class: 'btn ghost sm', disabled: !HUB.store.canBack(), title: '返回上一个观察状态（Alt+←）', onClick: HUB.store.back }, '←'));
    els.ctx.appendChild(h('button', { class: 'btn ghost sm', disabled: !HUB.store.canForward(), title: '前进（Alt+→）', onClick: HUB.store.forward }, '→'));
    els.ctx.appendChild(crumbs(s));
    els.ctx.appendChild(h('div', { class: 'hd-spacer' }));
    if (s.present === 'graph') {
      els.ctx.appendChild(h('span', { class: 'ctx-label' }, '粒度'));
      var seg = h('div', { class: 'seg', title: '展开到哪一层（[ 和 ]）' });
      DEPTHS[s.subject].forEach(function (d) {
        seg.appendChild(h('button', { class: s.depth[s.subject] === d[0] ? 'on' : '', onClick: function () { HUB.store.setDepth(s.subject, d[0]); } }, d[1]));
      });
      els.ctx.appendChild(seg);
      var ov = (s.expanded[s.subject] || []).length + (s.collapsed[s.subject] || []).length;
      if (ov) els.ctx.appendChild(h('span', { class: 'reset', title: '取消局部展开和折叠', onClick: function () { HUB.store.setDepth(s.subject, s.depth[s.subject]); } }, '局部调整 ' + ov + ' 处 · 还原'));
    }
    if (s.subject !== 'exec') {
      els.ctx.appendChild(h('div', { class: 'sep' }));
      els.ctx.appendChild(h('span', { class: 'ctx-label' }, '聚焦'));
      var sel = h('select', { 'aria-label': '聚焦一个案例实例', onChange: function (e) {
        var v = e.target.value;
        if (!v) HUB.store.set({ focus: null });
        else HUB.store.set({ focus: { type: 'case', id: v }, instanceId: v });
      } });
      sel.appendChild(h('option', { value: '' }, '不聚焦'));
      m.facts.cases.forEach(function (c) {
        var o = h('option', { value: c.id }, c.id + ' ' + c.name.replace(/^案例\s*\d+[：:]\s*/, '') + '（' + (L.caseStatus[c.status] || c.status) + '）');
        if (s.focus && s.focus.type === 'case' && s.focus.id === c.id) o.selected = true;
        sel.appendChild(o);
      });
      els.ctx.appendChild(sel);
    }
    if (s.subject === 'org' && s.present === 'graph') {
      els.ctx.appendChild(h('div', { class: 'sep' }));
      LINE_CHIPS.forEach(function (c) {
        var patch = {}; patch[c[0]] = !s.lines[c[0]];
        els.ctx.appendChild(h('button', { class: 'chip' + (s.lines[c[0]] ? ' on' : ''), style: { color: s.lines[c[0]] ? 'var(' + c[2] + ')' : '' }, title: '显示或隐藏' + c[1],
          onClick: function () { HUB.store.set({ lines: patch }); } }, h('span', { class: 'sw' }), h('span', { style: { color: 'var(--ink)' } }, c[1])));
      });
      els.ctx.appendChild(h('div', { class: 'sep' }));
      OVERLAY_CHIPS.forEach(function (c) {
        if (c[0] === 'lanes' && !(s.focus && s.focus.type === 'case')) return;
        var patch = {}; patch[c[0]] = !s.overlays[c[0]];
        var extra = c[0] === 'channels' && !s.overlays.channels ? { lines: { channel: true } } : {};
        els.ctx.appendChild(h('button', { class: 'chip' + (s.overlays[c[0]] ? ' on' : ''), title: '叠加层：' + c[1],
          onClick: function () { HUB.store.set(Object.assign({ overlays: patch }, extra)); } }, c[1]));
      });
    }
    els.ctx.appendChild(h('div', { class: 'sep' }));
    els.ctx.appendChild(h('button', { class: 'chip' + (sbCollapsed ? '' : ' on'), title: '显示或隐藏侧栏', onClick: function () { sbCollapsed = !sbCollapsed; layoutMain(s); } }, '侧栏'));
    els.ctx.appendChild(h('button', { class: 'chip' + (s.drawer ? ' on' : ''), title: '显示或隐藏详情抽屉', onClick: function () { HUB.store.set({ drawer: !s.drawer }, { history: false }); } }, '详情'));
  }

  /* ---------- sidebar ---------- */
  function renderSidebar(s) {
    els.sbTabs.innerHTML = '';
    [['cases', '案例模板'], ['tree', '结构'], ['health', '体检']].forEach(function (t) {
      els.sbTabs.appendChild(h('button', { class: sbTab === t[0] ? 'on' : '', role: 'tab', onClick: function () { sbTab = t[0]; renderSidebar(st()); } }, t[1]));
    });
    renderSidebarBody(s);
  }
  function renderSidebarBody(s) {
    var keep = els.sbBody.scrollTop;
    var sameTab = els.sbBody.getAttribute('data-tab') === sbTab;
    els.sbBody.innerHTML = '';
    els.sbBody.setAttribute('data-tab', sbTab);
    if (sbTab === 'cases') sbCases(s);
    else if (sbTab === 'tree') sbTree(s);
    else sbHealth(s);
    if (sameTab) els.sbBody.scrollTop = keep;
  }
  function sbCases(s) {
    els.sbBody.appendChild(els.sbSearch);
    var q = caseQuery.toLowerCase();
    HUB.base.sizeGroups.forEach(function (g, gi) {
      var items = g.ids.filter(function (id) {
        if (!HUB.base.presets[id]) return false;
        if (!q) return true;
        var p = HUB.base.presets[id];
        return (HUB.casedef.presetName(id) + p.nameEn + id + HUB.casedef.presetSummary(id)).toLowerCase().indexOf(q) >= 0;
      });
      if (!items.length) return;
      items.sort(function (a, b) { return (HUB.cases && HUB.cases[b] ? 1 : 0) - (HUB.cases && HUB.cases[a] ? 1 : 0); });
      els.sbBody.appendChild(h('div', { class: 'sb-h' }, SIZE_LABELS[gi] || ''));
      items.forEach(function (id) {
        var curated = !!(HUB.cases || {})[id];
        els.sbBody.appendChild(h('div', { class: 'sb-item' + (id === s.caseId ? ' on' : ''), title: HUB.casedef.presetSummary(id),
          onClick: function () { if (id !== st().caseId) HUB.store.switchCase(id); } },
          h('span', { class: 'nm' }, HUB.casedef.presetName(id)),
          curated ? h('span', { class: 'tag cur' }, '精选') : null,
          h('span', { class: 'meta' }, HUB.base.presets[id].nodes.length + ' 人')));
      });
    });
  }
  function selectItem(type, id) { HUB.store.set({ selection: { type: type, id: id }, drawer: true }, { history: false }); }
  function isSel(s, type, id) { return s.selection && s.selection.type === type && s.selection.id === id; }
  function sbTree(s) {
    var m = model(), a = an(s), body = els.sbBody;
    var wrap = h('div', { class: 'sb-tree' });
    body.appendChild(wrap);
    var item = function (lv, type, id, label, meta, extra) {
      var el = h('div', { class: 'sb-item' + (isSel(s, type, id) ? ' on' : ''), style: { '--lv': lv }, onClick: function () { selectItem(type, id); } });
      if (extra && extra.tw != null) el.appendChild(extra.tw); else el.appendChild(h('span', { class: 'tw' }));
      if (extra && extra.dot) el.appendChild(h('span', { class: 'dot ' + extra.dot }));
      el.appendChild(h('span', { class: 'nm' }, label));
      if (meta) el.appendChild(h('span', { class: 'meta' }, meta));
      wrap.appendChild(el);
      return el;
    };
    wrap.appendChild(h('div', { class: 'sb-h' }, '个体与分组'));
    m.def.individuals.filter(function (x) { return !x.groupId; }).forEach(function (x) {
      item(0, 'individual', x.id, x.name, x.kind === 'human' ? '人' : '元智能体', { dot: (a.indStats[x.id] || {}).status });
    });
    var walk = function (g, lv) {
      var open = HUB.store.isOpen('org', g.id, g.level, s);
      var gs = a.groupStats[g.id] || {};
      var tw = h('span', { class: 'tw', title: open ? '在图上折叠' : '在图上展开', onClick: function (e) { e.stopPropagation(); HUB.store.toggle('org', g.id, g.level); } }, open ? '▾' : '▸');
      item(lv, 'group', g.id, g.name, (gs.members || 0) + ' 人', { tw: tw });
      g.children.forEach(function (cid) { var c = m.idx.group.get(cid); if (c) walk(c, lv + 1); });
      g.members.forEach(function (id) {
        var x = m.idx.ind.get(id);
        var st2 = a.indStats[id] || {};
        item(lv + 1, 'individual', id, x.name, (x.model ? x.model : '') + (st2.runs ? ' · ' + st2.runs + ' 次' : ''), { dot: st2.status });
      });
    };
    m.def.groups.filter(function (g) { return !g.parentId; }).forEach(function (g) { walk(g, 0); });
    wrap.appendChild(h('div', { class: 'sb-h' }, '能力渠道'));
    m.def.channels.forEach(function (c) {
      var cs = a.channelStats[c.id] || {};
      item(0, 'channel', c.id, c.name, cs.status && cs.status !== 'ok' ? L.channelStatus[cs.status] : (cs.calls || 0) + ' 次调用', { dot: cs.status === 'ok' ? 'standby' : 'error' });
    });
    wrap.appendChild(h('div', { class: 'sb-h' }, '信息'));
    ['consensus', 'map', 'private'].forEach(function (layer) {
      var ds = m.def.docs.filter(function (d) { return d.layer === layer; });
      if (layer === 'private') ds = ds.filter(function (d) { return d.id.indexOf('d_role_') !== 0; });
      ds.forEach(function (d) { item(0, 'doc', d.id, d.name, L.docLayer[layer]); });
    });
    wrap.appendChild(h('div', { class: 'sb-h' }, '流程'));
    m.def.process.stages.forEach(function (sg) {
      item(0, 'stage', sg.id, sg.name, sg.steps.length + ' 步');
      m.def.process.gates.filter(function (g) { return g.afterStage === sg.id; }).forEach(function (g) {
        var gs = a.gateStats[g.id] || {};
        item(1, 'gate', g.id, '◇ ' + g.name, L.decider[g.decider.type] + (gs.fail ? ' · 打回 ' + gs.fail : ''));
      });
    });
    wrap.appendChild(h('div', { class: 'sb-h' }, '案例实例（模拟）'));
    m.facts.cases.forEach(function (c) {
      item(0, 'case', c.id, c.id + ' ' + c.name.replace(/^案例\s*\d+[：:]\s*/, ''), L.caseStatus[c.status] || c.status,
        { dot: c.status === 'done' ? 'working' : c.status === 'blocked' ? 'error' : 'waiting' });
    });
  }
  function sbHealth(s) {
    var a = an(s), body = els.sbBody;
    body.appendChild(h('div', { class: 'sb-h' }, '需要你处理的事'));
    if (!a.needsHuman.length) body.appendChild(h('div', { class: 'sb-item' }, h('span', { class: 'nm muted' }, '现在没有')));
    a.needsHuman.forEach(function (n) {
      body.appendChild(h('div', { class: 'sb-item', title: n.text, onClick: function () { if (n.target) selectItem(n.target.type, n.target.id); } },
        h('span', { class: 'sev high' }, n.kind === 'approval' ? '待批' : n.kind === 'escalation' ? '上报' : '待办'), h('span', { class: 'nm' }, n.text)));
    });
    body.appendChild(h('div', { class: 'sb-h' }, '架构体检'));
    if (!a.health.length) body.appendChild(h('div', { class: 'sb-item' }, h('span', { class: 'nm muted' }, '没有发现问题')));
    a.health.forEach(function (x) {
      body.appendChild(h('div', { class: 'sb-item', title: x.text, onClick: function () { onHealthClick(x); } },
        h('span', { class: 'sev ' + x.severity }, x.severity === 'high' ? '高' : x.severity === 'mid' ? '中' : '低'), h('span', { class: 'nm' }, x.text)));
    });
  }
  function onHealthClick(x) {
    var t = x.target || {};
    if (t.type === 'factonly') { HUB.store.set({ subject: 'org', present: 'graph', lines: { task: true }, compare: 'both', selection: { type: 'factonly', id: t.id }, drawer: true }); return; }
    if (t.type === 'relations') { HUB.views.go('v1'); HUB.store.set({ compare: 'both' }); return; }
    if (t.type) selectItem(t.type, t.id);
  }

  /* ---------- stage ---------- */
  function layoutMain(s) {
    els.main.classList.toggle('no-sb', sbCollapsed);
    els.main.classList.toggle('no-dr', !s.drawer);
    els.main.classList.toggle('show-dr', !!s.drawer);
  }
  function ensureView(subject) {
    if (views[subject]) return views[subject];
    var el = h('div', { class: 'stage-view hidden', 'data-subject': subject });
    els.stage.insertBefore(el, els.panel);
    views[subject] = el;
    return el;
  }
  function renderStage(s, prev) {
    var m = model();
    layoutMain(s);
    if (s.present === 'panel') {
      Object.keys(views).forEach(function (k) { views[k].classList.add('hidden'); });
      els.panel.classList.remove('hidden');
      els.tools.style.display = 'none';
      if (HUB.panels && HUB.panels.render) safe('panels.render', function () { HUB.panels.render(els.panel, m, s); });
      else missing(els.panel, '面板');
      shownSubject = null;
      return;
    }
    els.panel.classList.add('hidden');
    els.tools.style.display = '';
    var el = ensureView(s.subject);
    var r = HUB.render.get(s.subject);
    if (!r) { missing(el, L.subject[s.subject] + '视图'); el.classList.remove('hidden'); return; }
    if (!mounted[s.subject]) {
      safe('mount ' + s.subject, function () { r.mount(el); });
      mounted[s.subject] = true;
    }
    if (shownSubject !== s.subject) {
      Object.keys(views).forEach(function (k) { if (k !== s.subject) views[k].classList.add('hidden'); });
      el.classList.remove('hidden');
    }
    var switched = shownSubject !== s.subject;
    shownSubject = s.subject;
    safe('update ' + s.subject, function () { r.update(m, s, switched ? null : prev); });
  }
  function fit() {
    var r = HUB.render.get(st().subject);
    if (r && r.fit) safe('fit', function () { r.fit(); });
  }

  /* ---------- drawer, legend, status ---------- */
  function renderDrawer(s) {
    if (!s.drawer) return;
    if (HUB.details && HUB.details.render) safe('details.render', function () { HUB.details.render(els.drBody, model(), s); });
    else missing(els.drBody, '详情');
  }
  function renderLegend(s) {
    els.legend.classList.toggle('hidden', !legendOpen);
    if (!legendOpen) return;
    els.legend.innerHTML = '';
    if (HUB.guide && HUB.guide.legend) safe('legend', function () { HUB.guide.legend(els.legend, s); });
    else els.legend.textContent = '图例模块还没有载入。';
  }
  function renderStatus(s) {
    var m = model(), a = an(s), t = a.totals;
    els.st.innerHTML = '';
    var item = function (label, val) { els.st.appendChild(h('span', null, label + ' ', h('b', null, val))); };
    item('个体', t.individuals);
    item('任务线', t.relations);
    item('案例', t.cases);
    item('运行', t.runs);
    item('调用', t.calls);
    item('token', U.fmtNum(t.tokens));
    item('编排版本', m.def.version);
    item('时间', s.time == null ? '全部' : '截止 ' + U.fmtClock(s.time));
    els.st.appendChild(h('span', { class: 'tag sim' }, '事实为模拟数据'));
    els.st.appendChild(h('span', { class: 'hd-spacer' }));
    els.st.appendChild(h('span', null, '1～6 视图 · Alt+←/→ 返回前进 · G 图/面板 · [ ] 粒度 · F 适应窗口 · ? 说明'));
  }

  /* ---------- keyboard ---------- */
  function onKey(e) {
    var tag = (e.target && e.target.tagName) || '';
    if (/INPUT|TEXTAREA|SELECT/.test(tag) || (e.target && e.target.isContentEditable)) return;
    var s = st();
    if (e.altKey && e.key === 'ArrowLeft') { e.preventDefault(); HUB.store.back(); return; }
    if (e.altKey && e.key === 'ArrowRight') { e.preventDefault(); HUB.store.forward(); return; }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (/^[1-6]$/.test(e.key)) { HUB.views.go('v' + e.key); return; }
    if (e.key === 'g' || e.key === 'G') { HUB.store.set({ present: s.present === 'graph' ? 'panel' : 'graph' }); return; }
    if (e.key === '[') { HUB.store.setDepth(s.subject, s.depth[s.subject] - 1); return; }
    if (e.key === ']') { HUB.store.setDepth(s.subject, s.depth[s.subject] + 1); return; }
    if (e.key === 'f' || e.key === 'F') { fit(); return; }
    if (e.key === '?') { if (HUB.guide && HUB.guide.open) HUB.guide.open(); return; }
    if (e.key === 'Escape') {
      if (els.pop) { closePop(); return; }
      if (legendOpen) { legendOpen = false; renderLegend(s); return; }
      if (s.selection) HUB.store.set({ selection: null }, { history: false });
    }
  }

  HUB.shell = { init: init, update: update, fit: fit, els: els };
})();
