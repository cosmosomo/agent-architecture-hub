/* HUB.obsSessions: the "会话" tab of the left sidebar. Lists the real agent sessions on this machine
   (trace module, docs/ARCHITECTURE.md) and opens one in the canvas (HUB.obsTrace). The list comes from the local
   service (`npm start`), which is also what serves this page: same origin, so no CORS. If the page was not
   opened from it, the tab says how to start it. */
(function () {
  'use strict';
  var HUB = (window.HUB = window.HUB || {});
  var esc = HUB.util.esc;
  var STATUS = { working: '在做', waiting: '等待中', failed: '出错', aborted: '被打断', stale: '疑似已退出', idle: '空闲', empty: '空' };
  var DOT = { working: 'working', waiting: 'waiting', failed: 'error', aborted: 'waiting', stale: 'never', idle: '', empty: 'never' };
  var ORDER = ['working', 'waiting', 'failed', 'aborted', 'stale', 'idle', 'empty'];
  var KIND = { codex: 'Codex', 'claude-code': 'Claude', opencode: 'OpenCode', zcode: 'ZCode', factory: 'Factory', gemini: 'Gemini CLI' };
  var PAGE = 80;
  var cache = null, error = null, loading = false, loadedAt = 0, filter = 'all', limit = PAGE, open = {};
  var bound = new WeakSet();

  function ago(iso) {
    var ms = Date.now() - Date.parse(iso || '');
    if (!isFinite(ms)) return '';
    var min = Math.round(ms / 60000);
    if (min < 1) return '刚刚';
    if (min < 60) return min + ' 分钟前';
    var h = Math.round(min / 60);
    if (h < 24) return h + ' 小时前';
    var d = Math.round(h / 24);
    return d < 31 ? d + ' 天前' : String(iso).slice(0, 10);
  }
  function base(p) { var a = String(p || '').split(/[\\/]/).filter(Boolean); return a[a.length - 1] || ''; }
  function search(kind, id) {
    var h = '#view=search';
    if (kind) h += '&kind=' + encodeURIComponent(kind);
    if (id) h += '&session=' + encodeURIComponent(id);
    return '/trace/' + h + '&theme=' + (document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark');
  }
  function viewer(id) { return '/trace/#s=' + encodeURIComponent(id) + '&theme=' + (document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark'); }

  function toast(t) { HUB.shell.toast(t); }
  /* draw a session and its sub-agents as the org graph: one group per dispatch, opened one level */
  function openTree(sid) {
    var id = 'tree:' + sid;
    if (!HUB.model.ready(id)) toast('正在读取这个会话和它派出的子智能体…');
    HUB.model.load(id).then(function () {
      HUB.store.switchCase(id);
      HUB.store.set({ subject: 'org', depth: { org: 2 }, expanded: { org: [] }, collapsed: { org: [] }, focus: null, present: 'graph' });
    }).catch(function (e) { toast('没打开：' + e.message); });
  }

  function load(el, force) {
    if (loading || (!force && cache && Date.now() - loadedAt < 15000)) return;
    loading = true;
    fetch('/api/sessions', { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
      .then(function (idx) { cache = idx.sessions || []; error = null; })
      .catch(function () { error = 'down'; })
      .then(function () { loading = false; loadedAt = Date.now(); if (el.classList.contains('on')) render(el); });
  }

  function bind(el) {
    if (bound.has(el)) return;
    bound.add(el);
    el.addEventListener('click', function (e) {
      var t = e.target.closest('[data-act]');
      if (!t) return;
      var act = t.getAttribute('data-act');
      // a plain click opens the session's trace in the canvas; Ctrl or middle click keeps the link's new tab
      if (act === 'open') {
        if (e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        HUB.store.set({ subject: 'exec', depth: { exec: 1 }, focus: { type: 'session', id: t.getAttribute('data-id') }, selection: null, present: 'graph' });
      }
      else if (act === 'filter') { filter = t.getAttribute('data-v'); limit = PAGE; render(el); }
      else if (act === 'kids') { e.preventDefault(); e.stopPropagation(); var id = t.getAttribute('data-id'); open[id] = !open[id]; render(el); }
      else if (act === 'tree') { e.preventDefault(); e.stopPropagation(); openTree(t.getAttribute('data-id')); }
      else if (act === 'more') { limit += PAGE; render(el); }
      else if (act === 'reload') { load(el, true); render(el); }
    });
  }

  function row(s, lv, kids) {
    var meta = [KIND[s.source.kind] || s.source.kind, s.agent.role === 'subagent' ? (s.agent.path || s.agent.name) : base(s.cwd), s.stats.turns + ' 轮', ago(s.updatedAt)].filter(Boolean).join(' · ');
    return '<a class="ob-si ob-sess" data-act="open" data-id="' + esc(s.id) + '" style="padding-left:' + (14 + lv * 14) + 'px" href="' + viewer(s.id) + '" target="_blank" rel="noopener" title="' + esc(s.title + '\n' + (STATUS[s.state.status] || '') + (s.state.detail ? '：' + s.state.detail : '') + '\n点一下在中间打开它的决策链；按住 Ctrl 点，在新标签页打开独立查看器') + '">' +
      '<span class="ob-dot ' + (DOT[s.state.status] || '') + '"></span>' +
      '<span class="ob-sess-b"><span class="ob-nm">' + esc(s.title) + '</span>' +
      '<span class="ob-meta">' + esc(meta) +
      (s.stats.toolErrors ? ' <a data-act="ext" href="' + search('', s.id) + '&errors=1" target="_blank" rel="noopener" title="在这个会话里看出错的那几步" style="color:var(--warn,#d08)">错 ' + s.stats.toolErrors + '</a>' : '') +
      (kids ? ' <b data-act="kids" data-id="' + esc(s.id) + '" title="展开或收起子智能体">' + (open[s.id] ? '▾' : '▸') + ' 子智能体 ' + kids + '</b>' +
        ' <b data-act="tree" data-id="' + esc(s.id) + '" title="把它和它派出的子智能体画成协作图：一次派出的算一组">画成协作图</b>' : '') +
      '</span></span></a>';
  }

  function render(el) {
    bind(el);
    load(el, false);
    var out = [];
    var kinds = {};
    (cache || []).forEach(function (s) { kinds[s.source.kind] = (kinds[s.source.kind] || 0) + 1; });
    out.push('<div class="ob-sh">本机会话 · ' + (Object.keys(kinds).map(function (k) { return KIND[k] || k; }).join(' + ') || '—') + '</div>');
    if (error === 'down') {
      out.push('<div class="ob-si ob-wrap-text" style="cursor:default;color:var(--t3);font-size:10.5px">没有会话：连不上本地服务。' +
        '在仓库根目录运行 <code>npm start</code>，再打开 <code>http://127.0.0.1:8899/</code>：观察台、会话接口和 Trace 查看器是同一个本地服务，只监听本机。</div>');
      out.push('<div class="ob-si" data-act="reload"><span class="ob-nm" style="color:var(--accent1)">重试</span></div>');
      el.innerHTML = out.join('');
      return;
    }
    if (!cache) {
      out.push('<div class="ob-si" style="cursor:default"><span class="ob-nm" style="color:var(--t3)">读取中…</span></div>');
      el.innerHTML = out.join('');
      return;
    }
    var byId = {}, kids = {}, counts = {};
    cache.forEach(function (s) { byId[s.id] = s; counts[s.state.status] = (counts[s.state.status] || 0) + 1; });
    var tops = cache.filter(function (s) {
      var p = s.links.filter(function (l) { return l.rel === 'parent' && byId[l.id]; })[0];
      if (p) { (kids[p.id] = kids[p.id] || []).push(s); return false; }
      return true;
    });
    var chips = ['<span class="ob-chip' + (filter === 'all' ? ' on' : '') + '" data-act="filter" data-v="all">全部 ' + cache.length + '</span>'];
    ORDER.forEach(function (k) { if (counts[k]) chips.push('<span class="ob-chip' + (filter === k ? ' on' : '') + '" data-act="filter" data-v="' + k + '">' + STATUS[k] + ' ' + counts[k] + '</span>'); });
    out.push('<div class="ob-chips" style="padding:2px 14px 6px;display:flex;flex-wrap:wrap;gap:4px">' + chips.join('') + '</div>');
    out.push('<a class="ob-si" style="text-decoration:none" href="/trace/" target="_blank" rel="noopener"><span class="ob-nm" style="color:var(--accent1)">打开 Trace 查看器 ↗</span><span class="ob-meta">按会话看调用树</span></a>');
    out.push('<a class="ob-si" style="text-decoration:none" href="/trace/#view=sources" target="_blank" rel="noopener"><span class="ob-nm" style="color:var(--accent1)">来源与项目 ↗</span><span class="ob-meta">哪些 CLI 有会话、各在哪些项目里干活</span></a>');
    out.push('<a class="ob-si" style="text-decoration:none" href="/trace/#view=analytics" target="_blank" rel="noopener"><span class="ob-nm" style="color:var(--accent1)">统计 ↗</span><span class="ob-meta">日活跃、最忙的工具和模型、项目榜</span></a>');
    out.push('<a class="ob-si" style="text-decoration:none" href="' + search('') + '" target="_blank" rel="noopener"><span class="ob-nm" style="color:var(--accent1)">在全部会话里检索 ↗</span><span class="ob-meta">找命令、文件、错误、说过的话</span></a>');
    var ok = function (s) { return filter === 'all' || s.state.status === filter; };
    var rows = [];
    tops.forEach(function (s) {
      var ks = kids[s.id] || [];
      var hit = ks.filter(ok);
      if (!ok(s) && !hit.length) return;
      rows.push(row(s, 0, ks.length));
      if (open[s.id] || (filter !== 'all' && hit.length)) (filter === 'all' ? ks : hit).forEach(function (k) { rows.push(row(k, 1, 0)); });
    });
    out = out.concat(rows.slice(0, limit));
    if (rows.length > limit) out.push('<div class="ob-si" data-act="more"><span class="ob-nm" style="color:var(--accent1)">再显示 ' + Math.min(PAGE, rows.length - limit) + ' 条（共 ' + rows.length + '）</span></div>');
    if (!rows.length) out.push('<div class="ob-si" style="cursor:default"><span class="ob-nm" style="color:var(--t3)">没有这种状态的会话</span></div>');
    out.push('<div class="ob-sh">怎么读</div><div class="ob-si ob-wrap-text" style="cursor:default;color:var(--t3);font-size:10.5px">这里是本机智能体会话的实时状态（约 15 秒刷新）：Codex 读 ~/.codex/sessions，Claude Code 读 ~/.claude/projects。“疑似已退出”指进行中的一轮很久没有新记录。点一条，在中间打开它的决策链：每一轮的模型调用、工具调用和子智能体；Esc 回到原来的图。按住 Ctrl 点，在新标签页打开独立查看器。</div>');
    var keep = el.scrollTop;
    el.innerHTML = out.join('');
    el.scrollTop = keep;
  }

  // the title of a session the index knows (null until the index has been read); warm() reads it once, then repaints
  function titleOf(id) {
    var s = cache && cache.find(function (x) { return x.id === id; });
    return s ? s.title : null;
  }
  function warm() {
    if (cache || loading || error) return;
    loading = true;
    fetch('/api/sessions', { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
      .then(function (idx) { cache = idx.sessions || []; loadedAt = Date.now(); })
      .catch(function () { error = 'down'; })
      .then(function () { loading = false; if (cache && HUB.obs) HUB.obs.render(); });
  }

  HUB.obsSessions = { render: render, openTree: openTree, titleOf: titleOf, warm: warm };
})();
