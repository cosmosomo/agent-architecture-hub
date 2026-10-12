/* HUB.obsAvatar: the icon and the colour of an individual, and the icon of a sample team.
   The built-in agents and teams have hand-drawn pictograms (hub/data/icons.js). Everyone else (imported cases, real
   sessions, a new md case) gets a glyph in the same line style, picked from their name, and a colour that is stable
   for that name. */
(function () {
  'use strict';
  var HUB = (window.HUB = window.HUB || {});

  var PALETTE = ['#818CF8', '#34D399', '#22C4E6', '#FBBF24', '#F472B6', '#A78BFA', '#FB923C', '#60A5FA'];
  // the card's colour class from the colour key of an agent definition
  var CARD_CLASS = { am: 'c-am', cy: 'c-cy', bl: 'c-bl', mu: 'c-mu', ro: 'c-ro', vi: 'c-vi', teal: 'c-cy', red: 'c-ro', purple: 'c-vi' };
  // first match wins; the name is lower-cased and has its separators dropped
  var GLYPHS = [
    [/orchestrat|manager|lead|coordinat|supervis|boss|chief|hub/, '<path d="M4 17h16M5 17L3.5 7.5 8.5 11 12 5l3.5 6 5-3.5L19 17"/>'],
    [/search|research|surf|brows|web|retriev|scout|crawl|explor|investig/, '<circle cx="10.5" cy="10.5" r="6"/><path d="M15 15l5.5 5.5"/>'],
    [/verif|valid|review|check|critic|audit|quality|judge|qa|test|inspect/, '<path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z"/><path d="M8.5 12l2.5 2.5L15.5 9.5"/>'],
    [/cod|dev|program|engineer|implement|terminal|shell|computer|script|build/, '<path d="M8 7l-5 5 5 5M16 7l5 5-5 5M13.5 5l-3 14"/>'],
    [/data|analy|statist|math|arithmetic|calc|number|metric|progress|finance|econom/, '<path d="M5 20V11M12 20V4M19 20v-6"/>'],
    [/writ|doc|report|summar|synthes|edit|author|content|text|note|draft|journal/, '<path d="M4 20l1-4L16 5l3 3L8 19z"/><path d="M14 7l3 3"/>'],
    [/plan|route|strateg|architect|design|schedul|task|decompos|problemsolv|solver/, '<circle cx="6" cy="6" r="2"/><circle cx="18" cy="9" r="2"/><circle cx="9" cy="18" r="2"/><path d="M8 6.5l8 2M17 11l-6 6M7.5 8l1 8"/>'],
    [/memory|knowledge|librar|database|store|index|archive|cache/, '<ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v12c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 12c0 1.7 3.1 3 7 3s7-1.3 7-3"/>'],
    [/tool|api|function|service|channel|plugin|mcp|file/, '<path d="M9 3v5M15 3v5M7 8h10v4a5 5 0 01-10 0zM12 17v4"/>'],
    [/user|human|client|customer|person/, '<circle cx="12" cy="7.5" r="3.6"/><path d="M4.5 20.5c.8-4 3.8-6.3 7.5-6.3s6.7 2.3 7.5 6.3"/>']
  ];
  var GENERIC = '<path d="M12 3l7.5 4.3v8.4L12 20l-7.5-4.3V7.3z"/><circle cx="12" cy="11.5" r="2.2"/>';
  var uid = 0;

  function key(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9一-龥]+/g, ''); }
  function theme() { return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark'; }
  function agent(id) { return (id && HUB.icons && HUB.icons.agents[id]) || null; }
  /* does the built-in set have a pictogram for this agent id? */
  function has(agentId) { return !!agent(agentId); }

  function color(agentId, name) {
    var e = agent(agentId), I = HUB.icons, mo = theme();
    if (e && e.cat && I.catColors[e.cat]) return I.catColors[e.cat][mo];
    if (e && I.agentColors[mo][agentId]) return I.agentColors[mo][agentId];
    return PALETTE[HUB.util.hashStr(key(name) || String(agentId || 'x')) % PALETTE.length];
  }
  /* the CSS colour class of the page's cards (c-cy, c-am, ...); an unknown agent is the muted one */
  function colorClass(agentId) { var e = agent(agentId); return (e && CARD_CLASS[e.color]) || 'c-mu'; }

  /* filled shapes are drawn through a mask so that the cut-outs are transparent on any background */
  function draw(inner, solid, c, size, strokeWidth, cls, solidCls) {
    if (solid) {
      var mid = 'avm' + (uid++);
      return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" class="' + cls + ' ' + solidCls + '" style="color:' + c + '" aria-hidden="true">' +
        '<mask id="' + mid + '" maskUnits="userSpaceOnUse" x="0" y="0" width="24" height="24">' + inner + '</mask><rect width="24" height="24" fill="' + c + '" mask="url(#' + mid + ')"/></svg>';
    }
    return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="' + c + '" stroke-width="' + strokeWidth + '" stroke-linecap="round" stroke-linejoin="round" class="' + cls + '" style="color:' + c + '" aria-hidden="true">' + inner + '</svg>';
  }
  function svg(agentId, name, size) {
    var e = agent(agentId);
    if (e) return draw(e.svg, e.solid, color(agentId, name), size, 1.6, 'ag-svg', 'ag-solid');
    var k = key(name), hit = GLYPHS.filter(function (g) { return g[0].test(k); })[0];
    return '<svg viewBox="0 0 24 24" width="' + size + '" height="' + size + '" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (hit ? hit[1] : GENERIC) + '</svg>';
  }

  /* the icon of a sample team: its colour is its category's */
  function presetColor(id) {
    var I = HUB.icons, e = I.presets[id], cat = e && e.cat && I.categories[e.cat];
    return cat ? cat[theme()] : (I.presetColors[theme()][id] || '#818CF8');
  }
  function categoryColor(cat) { var c = HUB.icons.categories[cat]; return c ? c[theme()] : '#818CF8'; }
  function presetSvg(id, size) {
    var e = HUB.icons && HUB.icons.presets[id];
    return e ? draw(e.svg, e.solid, presetColor(id), size, 2, 'pr-svg', 'pr-solid') : '';
  }

  HUB.obsAvatar = { has: has, color: color, colorClass: colorClass, svg: svg, presetSvg: presetSvg, presetColor: presetColor, categoryColor: categoryColor };
})();
