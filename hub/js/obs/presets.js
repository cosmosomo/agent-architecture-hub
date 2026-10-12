/* HUB.obsPresets: the "预设" page of the left sidebar — the built-in sample teams, by size, with a search box and the
   eight use-case categories as filters.  A click opens the team as the observed case (its facts are simulated). */
(function () {
  'use strict';
  var HUB = (window.HUB = window.HUB || {});
  var U = HUB.util, esc = U.esc;

  var SIZES = ['微型 (2-3)', '小型 (4-5)', '中型 (6-8)', '大型 (9-12)', '企业级 (13+)'];
  var CAT_ORDER = ['research', 'build', 'quality', 'content', 'strategy', 'ops', 'data', 'design'];
  var FEATURED = 'deep_five_minds';

  var state = { q: '', cats: new Set(), barOpen: true };
  try { state.barOpen = localStorage.getItem('hub.presetFilter') !== 'closed'; } catch (e) { /* storage blocked */ }
  var els = null;

  function name(id) { return HUB.casedef.presetName(id); }
  function catOf(id) { var i = HUB.icons.presets[id]; return i && i.cat; }
  // the colour of the left edge of a row: the phase most of the team works in
  function dominantPhase(id) {
    var n = {}, best = 'build', top = 0;
    HUB.base.presets[id].nodes.forEach(function (x) {
      var a = HUB.base.agents[x.d], p = a && a.phase;
      if (p && (n[p] = (n[p] || 0) + 1) > top) { top = n[p]; best = p; }
    });
    return best;
  }
  function matches(id) {
    if (state.cats.size && !state.cats.has(catOf(id))) return false;
    return !state.q || (name(id) + ' ' + HUB.casedef.presetSummary(id)).toLowerCase().indexOf(state.q) >= 0;
  }
  function mark(text) {
    var i = state.q ? text.toLowerCase().indexOf(state.q) : -1;
    return i < 0 ? esc(text) : esc(text.slice(0, i)) + '<mark>' + esc(text.slice(i, i + state.q.length)) + '</mark>' + esc(text.slice(i + state.q.length));
  }

  function filterBar() {
    var count = {}, total = 0;
    Object.keys(HUB.base.presets).forEach(function (id) { var c = catOf(id); count[c] = (count[c] || 0) + 1; total++; });
    var badge = function (n) { return '<b class="prcf-cnt">' + n + '</b>'; };
    var html = '<button class="prcf-chip' + (state.cats.size ? '' : ' on') + '" data-cat="">全部' + badge(total) + '</button>';
    CAT_ORDER.forEach(function (c) {
      var col = HUB.obsAvatar.categoryColor(c);
      html += '<button class="prcf-chip' + (state.cats.has(c) ? ' on' : '') + '" style="--ctc:' + col + '" data-cat="' + c + '" aria-pressed="' + state.cats.has(c) + '"><i style="background:' + col + '"></i>' + esc(HUB.icons.categories[c].name) + badge(count[c] || 0) + '</button>';
    });
    return html;
  }

  function list() {
    var html = '', shown = 0;
    HUB.base.sizeGroups.forEach(function (g, gi) {
      var ids = g.ids.filter(function (id) { return HUB.base.presets[id] && matches(id); });
      if (!ids.length) return;
      shown += ids.length;
      html += '<div class="pr-cat pc-' + gi + '">' + esc(SIZES[gi]) + '<span class="pr-cat-count">&middot; ' + ids.length + '</span></div>';
      ids.forEach(function (id) {
        var p = HUB.base.presets[id];
        html += '<div class="pr-item ph-' + dominantPhase(id) + (id === FEATURED ? ' tier-featured' : '') + (id === HUB.store.get().caseId ? ' on' : '') + '" tabindex="0" role="option" data-id="' + id + '">' +
          '<div class="pr-orb">' + HUB.obsAvatar.presetSvg(id, 18) + '</div>' +
          '<div class="pr-name"><span>' + mark(name(id)) + '</span></div>' +
          '<span class="pr-cnt" title="' + p.nodes.length + ' 个智能体">' + p.nodes.length + '</span></div>';
      });
    });
    if (!shown) html = '<div class="pa-empty"><div class="pae-tx">' + (state.q ? '没有匹配的预设：“' + esc(state.q) + '”' : '该分类下没有预设') + '</div>' +
      '<div class="pae-hint">' + (state.cats.size ? '请尝试清除分类筛选或搜索条件。' : '请尝试其他关键词。') + '</div></div>';
    return html;
  }

  function open(id) { HUB.obs.openCase(id); }

  function build(el) {
    el.innerHTML =
      '<div class="pa-search-wrap"><input class="pa-search" placeholder="&#128269; 搜索预设..." aria-label="搜索预设"><button type="button" class="pa-search-clear" aria-label="清除搜索" hidden>&#215;</button></div>' +
      '<button type="button" class="prcf-toggle" aria-expanded="true"><span class="prcf-tg-lbl">分类</span><span class="prcf-tg-dot" aria-hidden="true"></span><span class="prcf-chev" aria-hidden="true">&#9662;</span></button>' +
      '<div class="prcf-bar" role="group" aria-label="预设分类筛选"></div><div class="pr-list"></div>';
    els = { input: el.querySelector('.pa-search'), clear: el.querySelector('.pa-search-clear'), toggle: el.querySelector('.prcf-toggle'), bar: el.querySelector('.prcf-bar'), list: el.querySelector('.pr-list') };
    els.input.addEventListener('input', function () { state.q = els.input.value.trim().toLowerCase(); els.clear.hidden = !state.q; paint(); });
    els.clear.addEventListener('click', function () { els.input.value = ''; state.q = ''; els.clear.hidden = true; paint(); els.input.focus(); });
    els.toggle.addEventListener('click', function () {
      state.barOpen = !state.barOpen;
      try { localStorage.setItem('hub.presetFilter', state.barOpen ? 'open' : 'closed'); } catch (e) { /* storage blocked */ }
      paint();
    });
    els.bar.addEventListener('click', function (e) {
      var b = e.target.closest('[data-cat]');
      if (!b) return;
      var c = b.getAttribute('data-cat');
      if (!c) state.cats.clear(); else if (state.cats.has(c)) state.cats.delete(c); else state.cats.add(c);
      paint();
    });
    els.list.addEventListener('click', function (e) { var r = e.target.closest('.pr-item'); if (r) open(r.getAttribute('data-id')); });
    els.list.addEventListener('keydown', function (e) {
      var r = e.target.closest('.pr-item');
      if (r && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); open(r.getAttribute('data-id')); }
    });
  }

  function paint() {
    els.bar.innerHTML = filterBar();
    els.bar.style.display = state.barOpen ? '' : 'none';
    els.toggle.classList.toggle('collapsed', !state.barOpen);
    els.toggle.classList.toggle('has-filter', state.cats.size > 0);
    els.toggle.setAttribute('aria-expanded', state.barOpen ? 'true' : 'false');
    els.list.innerHTML = list();
  }

  function render(el) {
    if (!els) build(el);
    paint();
  }

  HUB.obsPresets = { render: render };
})();
