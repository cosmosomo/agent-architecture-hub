/* HUB.obsAvatar: the icon and the colour of an individual.
   The page has hand-drawn icons for the agents it knows; everyone else (imported cases, real sessions, a new md case)
   gets a glyph in the same line style, picked from their name, and a colour that is stable for that name.
   This is the only place that asks the page for its icons (svgAgenta, KOLOR_IKONY_AGENTA, AD_MAP, cMap). */
(function () {
  'use strict';
  var HUB = (window.HUB = window.HUB || {});

  var PALETTE = ['#818CF8', '#34D399', '#22C4E6', '#FBBF24', '#F472B6', '#A78BFA', '#FB923C', '#60A5FA'];
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

  function key(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9一-龥]+/g, ''); }
  function host() { return typeof AD_MAP !== 'undefined' && typeof svgAgenta === 'function'; }
  /* does the page draw an icon for this agent id? */
  function has(agentId) { return !!agentId && host() && AD_MAP.has(agentId); }

  function color(agentId, name) {
    if (has(agentId) && typeof KOLOR_IKONY_AGENTA === 'function') return KOLOR_IKONY_AGENTA(agentId);
    return PALETTE[HUB.util.hashStr(key(name) || String(agentId || 'x')) % PALETTE.length];
  }
  /* the CSS colour class of the page's cards (c-cy, c-am, ...); an unknown agent is the muted one */
  function colorClass(agentId) {
    var d = has(agentId) ? AD_MAP.get(agentId) : null;
    return d && typeof cMap !== 'undefined' ? (cMap[d.color] || 'c-mu') : 'c-mu';
  }
  function svg(agentId, name, size) {
    if (has(agentId)) return svgAgenta(agentId, size);
    var k = key(name), hit = GLYPHS.filter(function (g) { return g[0].test(k); })[0];
    return '<svg viewBox="0 0 24 24" width="' + size + '" height="' + size + '" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (hit ? hit[1] : GENERIC) + '</svg>';
  }

  HUB.obsAvatar = { has: has, color: color, colorClass: colorClass, svg: svg };
})();
