/* HUB.obsSide: the extra tabs of the left sidebar. "目录" is the cases on disk as folders; "结构" is the definition as a
   tree; "体检" lists what needs a person and what the health check found. Clicking an entry selects it on the canvas. */
(function () {
  'use strict';
  var HUB = (window.HUB = window.HUB || {});
  var U = HUB.util, L = U.LABELS, esc = U.esc;
  var bound = new WeakSet();

  function bind(el) {
    if (bound.has(el)) return;
    bound.add(el);
    el.addEventListener('click', function (e) {
      var t = e.target.closest('[data-act]');
      if (!t) return;
      var act = t.getAttribute('data-act'), s = HUB.store.get(), m = HUB.model.current;
      if (act === 'tw') { e.stopPropagation(); var g = m.idx.group.get(t.getAttribute('data-id')); if (g) HUB.store.toggle('org', g.id, g.level); return; }
      if (act === 'sel') {
        var sel = { type: t.getAttribute('data-type'), id: t.getAttribute('data-id') };
        var patch = { selection: sel };
        // a process object is easier to see in the process view, a case in its own route view
        if ((sel.type === 'stage' || sel.type === 'gate' || sel.type === 'step') && s.subject !== 'process') patch.subject = 'process';
        // the trajectory view draws individuals and groups too: selecting one there stays there
        if ((sel.type === 'individual' || sel.type === 'group' || sel.type === 'channel') && s.subject !== 'org' && !(s.subject === 'collab' && sel.type !== 'channel')) patch.subject = 'org';
        if (sel.type === 'channel') { patch.overlays = { channels: true }; patch.lines = { channel: true }; }
        if (patch.subject) HUB.store.set(patch); else HUB.store.set(patch, { history: false });
      } else if (act === 'case') {
        // in the trajectory view a case instance is what the view shows: picking another one stays there and shows it whole
        if (s.subject === 'collab') HUB.store.set({ focus: { type: 'case', id: t.getAttribute('data-id') }, instanceId: t.getAttribute('data-id'), time: null, selection: { type: 'case', id: t.getAttribute('data-id') }, present: 'graph' });
        else HUB.store.set({ focus: { type: 'case', id: t.getAttribute('data-id') }, instanceId: t.getAttribute('data-id'), subject: 'org', depth: { org: Math.max(2, s.depth.org) },
          selection: { type: 'case', id: t.getAttribute('data-id') }, present: 'graph' });
      } else if (act === 'health') {
        var hc = HUB.model.an(s, m).health.find(function (x) { return x.id === t.getAttribute('data-id'); });
        if (hc && HUB.obsPanel) HUB.obsPanel.followHealth(hc);
      } else if (act === 'need') {
        HUB.store.set({ selection: { type: t.getAttribute('data-type'), id: t.getAttribute('data-id') } }, { history: false });
      } else if (act === 'dir') {
        toggleDir(el, t.getAttribute('data-path'));
      } else if (act === 'opencase') {
        HUB.obs.openCase(t.getAttribute('data-id'));
      }
    });
  }

  /* ---------- "目录": the cases found on disk, as the folders they sit in ---------- */
  var KIND_MARK = { md: '文', graph: '{ }' };
  var dirsOpen = (function () { try { return new Set(JSON.parse(localStorage.getItem('hub.dirs') || '[]')); } catch (e) { return new Set(); } })();
  function toggleDir(el, path) {
    if (dirsOpen.has(path)) dirsOpen.delete(path); else dirsOpen.add(path);
    try { localStorage.setItem('hub.dirs', JSON.stringify(Array.from(dirsOpen))); } catch (e) { /* storage blocked */ }
    var node = HUB.catalog.node(path);
    cases(el);
    // a shelved folder is read only now that someone opened it
    if (node && dirsOpen.has(path) && !node.loaded) HUB.catalog.open(node).then(function () { cases(el); });
  }
  function caseRows(node, lv, cur, out) {
    var pad = 'padding-left:' + (14 + lv * 14) + 'px';
    node.entries.forEach(function (e) {
      out.push('<div class="ob-si' + (e.id === cur ? ' on' : '') + '" data-act="opencase" data-id="' + esc(e.id) + '" style="' + pad + '" title="' + esc(e.id) + '">' +
        '<span class="ob-tw">' + (KIND_MARK[e.kind] || '·') + '</span><span class="ob-nm">' + esc(e.title) + '</span></div>');
    });
    node.groups.forEach(function (g) {
      var open = dirsOpen.has(g.path);
      out.push('<div class="ob-si" data-act="dir" data-path="' + esc(g.path) + '" style="' + pad + '" title="' + esc(g.path) + '">' +
        '<span class="ob-tw">' + (open ? '▾' : '▸') + '</span><b class="ob-nm">' + esc(g.name.replace(/^_+/, '')) + '</b>' +
        (g.loaded ? '<span class="ob-meta">' + HUB.catalog.count(g) + '</span>' : '') + '</div>');
      if (!open) return;
      if (g.loaded) caseRows(g, lv + 1, cur, out);
      else out.push('<div class="ob-si" style="cursor:default;padding-left:' + (14 + (lv + 1) * 14) + 'px"><span class="ob-nm" style="color:var(--t3)">读取中…</span></div>');
    });
  }
  function cases(el) {
    bind(el);
    var root = HUB.catalog.root(), out = [];
    out.push('<div class="ob-sh">本地案例 · hub/cases</div>');
    if (!root.loaded) out.push('<div class="ob-si" style="cursor:default"><span class="ob-nm" style="color:var(--t3)">读取中…</span></div>');
    else if (!root.entries.length && !root.groups.length) out.push('<div class="ob-si ob-wrap-text" style="cursor:default;color:var(--t3);font-size:10.5px">hub/cases 里还没有案例，或这个页面不是由本地服务打开的（npm start）。</div>');
    else caseRows(root, 0, HUB.store.get().caseId, out);
    out.push('<div class="ob-sh">怎么读</div><div class="ob-si ob-wrap-text" style="cursor:default;color:var(--t3);font-size:10.5px">这里列的是 hub/cases 下找到的案例：放进去就出现，不用登记。文件夹可以折叠；以下划线开头的文件夹（如 _reference，大模型整理的参考语料）默认收起，点开才去读。</div>');
    var keep = el.scrollTop;
    el.innerHTML = out.join('');
    el.scrollTop = keep;
  }
  function isSel(s, type, id) { return s.selection && s.selection.type === type && s.selection.id === id; }
  function item(s, type, id, name, meta, lv, lead) {
    return '<div class="ob-si' + (isSel(s, type, id) ? ' on' : '') + '" style="padding-left:' + (14 + (lv || 0) * 14) + 'px" data-act="sel" data-type="' + type + '" data-id="' + esc(id) + '">' +
      (lead || '') + '<span class="ob-nm">' + esc(U.quietEval(name)) + '</span>' + (meta ? '<span class="ob-meta">' + esc(meta) + '</span>' : '') + '</div>';
  }

  function tree(el, m, s) {
    bind(el);
    var a = HUB.model.an(s, m);
    var keep = el.scrollTop;
    var out = [];
    var ind = function (id, lv) {
      var x = m.idx.ind.get(id), st = a.indStats[id] || {};
      return item(s, 'individual', id, x.name, s.compare === 'def' ? (x.model || '') : (L.indStatus[st.status] || '') + ' · ' + (st.runs || 0), lv, '<span class="ob-tw"></span><span class="ob-dot ' + (s.compare === 'def' ? '' : st.status || '') + '"></span>');
    };
    out.push('<div class="ob-sh">个体与分组</div>');
    m.def.individuals.filter(function (x) { return !x.groupId; }).forEach(function (x) { out.push(ind(x.id, 0)); });
    var walk = function (g, lv) {
      var open = HUB.store.isOpen('org', g.id, g.level, s);
      var gs = a.groupStats[g.id] || {};
      out.push('<div class="ob-si' + (isSel(s, 'group', g.id) ? ' on' : '') + '" style="padding-left:' + (14 + lv * 14) + 'px" data-act="sel" data-type="group" data-id="' + esc(g.id) + '">' +
        '<span class="ob-tw" data-act="tw" data-id="' + esc(g.id) + '" title="在图上' + (open ? '折叠' : '展开') + '">' + (open ? '▾' : '▸') + '</span><b class="ob-nm">' + esc(g.name) + '</b><span class="ob-meta">' + (gs.members || 0) + ' 人</span></div>');
      if (!open) return;
      g.children.forEach(function (cid) { var c = m.idx.group.get(cid); if (c) walk(c, lv + 1); });
      g.members.forEach(function (id) { out.push(ind(id, lv + 1)); });
    };
    m.def.groups.filter(function (g) { return !g.parentId; }).forEach(function (g) { walk(g, 0); });

    out.push('<div class="ob-sh">能力渠道</div>');
    m.def.channels.forEach(function (c) {
      var cs = a.channelStats[c.id] || {};
      out.push(item(s, 'channel', c.id, c.name.replace(/^(模型|工具)：/, ''), s.compare === 'def' ? (c.kind === 'model' ? '模型' : '工具') : (L.channelStatus[cs.status] || '') + ' · ' + (cs.calls || 0), 0,
        '<span class="ob-tw"></span><span class="ob-dot ' + (cs.status && cs.status !== 'ok' ? 'error' : '') + '"></span>'));
    });

    out.push('<div class="ob-sh">流程</div>');
    m.def.process.stages.forEach(function (st) {
      out.push(item(s, 'stage', st.id, st.name, st.steps.length + ' 步', 0, '<span class="ob-tw">▪</span>'));
      m.def.process.gates.filter(function (g) { return g.afterStage === st.id; }).forEach(function (g) {
        var who = g.decider.type === 'human' ? '人' : g.decider.type === 'rule' ? '规则' : HUB.model.name('individual', g.decider.who);
        out.push(item(s, 'gate', g.id, '◇ ' + g.name, who + '判断', 1));
      });
    });

    out.push('<div class="ob-sh">资料（文字编排）</div>');
    m.def.docs.filter(function (d) { return d.layer !== 'private' || !/^d_role_/.test(d.id); }).forEach(function (d) {
      var meta = '<span class="ob-meta">' + esc(L.docLayer[d.layer] || d.layer) + ' · ' + d.audience.length + ' 人</span>';
      // a document with a local path opens in the asset workbench's reader
      if (d.path) out.push('<a class="ob-si" href="' + esc('http://localhost:8890/?open=' + encodeURIComponent(d.path.replace(/\\/g, '/'))) + '" target="_blank" rel="noopener" title="' + esc((d.summary ? d.summary + '\n' : '') + '在工作台打开：' + d.path) + '"><span class="ob-tw"></span><span class="ob-nm">' + esc(d.name) + ' ↗</span>' + meta + '</a>');
      else out.push('<div class="ob-si" style="cursor:default" title="' + esc(d.summary || '') + '"><span class="ob-tw"></span><span class="ob-nm">' + esc(d.name) + '</span>' + meta + '</div>');
    });

    out.push('<div class="ob-sh">案例实例</div>');
    m.facts.cases.filter(function (c) { return HUB.model.visible(c.start, s); }).forEach(function (c) {
      var on = s.focus && s.focus.type === 'case' && s.focus.id === c.id;
      out.push('<div class="ob-si' + (on ? ' on' : '') + '" data-act="case" data-id="' + c.id + '"><span class="ob-tw"></span><span class="ob-nm"><b>' + c.id + '</b> ' + esc(U.quietEval(c.name)) + '</span><span class="ob-meta">' + esc(L.caseStatus[c.status] || c.status) + '</span></div>');
    });
    el.innerHTML = out.join('');
    el.scrollTop = keep;
  }

  function health(el, m, s) {
    bind(el);
    var a = HUB.model.an(s, m);
    var keep = el.scrollTop;
    var out = [];
    out.push('<div class="ob-sh">需要人处理（' + a.needsHuman.length + '）</div>');
    if (!a.needsHuman.length) out.push('<div class="ob-si" style="cursor:default"><span class="ob-nm" style="color:var(--t3)">现在没有</span></div>');
    a.needsHuman.forEach(function (x) {
      out.push('<div class="ob-si" data-act="need" data-type="' + x.target.type + '" data-id="' + esc(x.target.id) + '"><span class="ob-sev mid">' + ({ approval: '拍板', escalation: '上报', direction: '调整' })[x.kind] + '</span><span class="ob-nm ob-wrap-text">' + esc(U.quietEval(x.text)) + '</span></div>');
    });
    out.push('<div class="ob-sh">架构体检（' + a.health.length + '）</div>');
    a.health.forEach(function (x) {
      out.push('<div class="ob-si" data-act="health" data-id="' + x.id + '"><span class="ob-sev ' + x.severity + '">' + ({ high: '高', mid: '中', low: '低' })[x.severity] + '</span><span class="ob-nm ob-wrap-text">' + esc(U.quietEval(x.text)) + '</span></div>');
    });
    out.push('<div class="ob-sh">怎么读</div><div class="ob-si ob-wrap-text" style="cursor:default;color:var(--t3);font-size:10.5px">' + esc(U.cmpWord('healthHow')) + '</div>');
    el.innerHTML = out.join('');
    el.scrollTop = keep;
  }

  HUB.obsSide = { tree: tree, health: health, cases: cases };
})();
