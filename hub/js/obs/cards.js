/* HUB.obsCards: HTML for every card and frame the observation layer draws.
   An individual is the original page's .nd card (same structure and classes); the rest follow the same look. */
(function () {
  'use strict';
  var HUB = (window.HUB = window.HUB || {});
  var L = HUB.util.LABELS;

  var esc = function (s) { return HUB.util.esc(s); };
  var has = function (name) { return typeof window[name] === 'function'; };
  var PH = { strategy: 'strategy', research: 'research', debate: 'debate', debate1: 'debate', debate2: 'debate', build: 'build', qa: 'qa', hitl: 'hitl' };
  var MODEL_CLS = { opus: 'b-op', sonnet: 'b-so', haiku: 'b-ha', fable: 'b-fa' };
  var ICON = {
    human: '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="7.5" r="3.6"/><path d="M4.5 20.5c.8-4 3.8-6.3 7.5-6.3s6.7 2.3 7.5 6.3"/></svg>',
    meta: '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a4 4 0 0 0-5.4 5.1L3.5 17.2a1.8 1.8 0 0 0 2.6 2.6l5.8-5.8a4 4 0 0 0 5.1-5.4l-2.4 2.4-2.3-.6-.6-2.3z"/></svg>',
    tool: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="7" width="17" height="12" rx="2"/><path d="M9 7V5.5a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 5.5V7"/></svg>',
    model: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/></svg>'
  };
  var KIND_COLOR = { human: '#FBBF24', meta: '#22C4E6' };

  function agentColor(agentId) { return has('KOLOR_IKONY_AGENTA') && agentId ? KOLOR_IKONY_AGENTA(agentId) : '#818CF8'; }
  function agentIcon(agentId, size) { return has('svgAgenta') && agentId ? svgAgenta(agentId, size) : ''; }
  function colorClass(agentId) {
    var d = typeof AD_MAP !== 'undefined' && agentId ? AD_MAP.get(agentId) : null;
    return d && typeof cMap !== 'undefined' ? (cMap[d.color] || 'c-mu') : 'c-mu';
  }
  function phaseVar(ph) { return PH[ph] ? 'var(--ph-' + PH[ph] + '-rgb)' : 'var(--accent-rgb)'; }

  /* ---------- an individual: the original .nd card plus our status and delivery marks ---------- */
  function individual(c) {
    var d = c.data;
    var special = d.kind === 'human' || d.kind === 'meta';
    var ic = special ? KIND_COLOR[d.kind] : agentColor(d.agentId);
    var st = d.status;
    var cls = 'nd ob-card ob-ind ' + (special ? 'ob-k-' + d.kind : colorClass(d.agentId) + (d.phase ? ' ph-' + d.phase : ''));
    if (st === 'working') cls += ' sim-active ob-st-working';
    else if (st) cls += ' ob-st-' + st;
    if (d.isHub) cls += ' ob-hub';
    var badge = special ? '<span class="nd-mdl ob-mdl-k">' + (d.kind === 'human' ? '人' : '维护') + '</span>'
      : '<span class="nd-mdl ' + (MODEL_CLS[d.model] || 'b-so') + '">' + esc(String(d.model || '').toUpperCase()) + '</span>';
    var load = d.runs == null ? 0 : Math.round(100 * Math.min(1, d.runs / Math.max(1, d.maxRuns)));
    var lc = st === 'error' ? 'var(--accent4)' : load >= 70 ? 'var(--accent3)' : 'var(--accent2)';
    var marks = '';
    if (d.isHub) marks += '<span class="ob-mark ob-mark-hub" title="中枢智能体：接需求、派活、汇总">中枢</span>';
    var dv = d.delivery;
    var flags = '';
    if (dv && dv.missing && dv.missing.length) flags += '<span class="ob-flag ob-flag-miss" title="最近一次运行没拿到 ' + dv.missing.length + ' 份资料">缺' + dv.missing.length + '</span>';
    else if (dv && dv.missedEver && dv.missedEver.length) flags += '<span class="ob-flag ob-flag-was" title="曾经没拿到，后来补上了">曾缺' + dv.missedEver.length + '</span>';
    if (dv && dv.instructions) flags += '<span class="ob-flag ob-flag-ins" title="收到的新指令和反馈">令' + dv.instructions + '</span>';
    if (st === 'error') flags += '<span class="ob-flag ob-flag-err" title="最近一次运行失败或被打断">错</span>';
    else if (st === 'waiting') flags += '<span class="ob-flag ob-flag-wait" title="有案例停在它负责的判断点上">等</span>';
    var runs = d.runs != null && !special ? '<span class="ob-runs" title="运行次数">' + d.runs + '</span>' : '';
    var title = d.name + (st ? '：' + (L.indStatus[st] || st) : '') + (d.runs != null ? '，运行 ' + d.runs + ' 次' : '') + '。双击打开它最近一次运行';
    var html = '<div class="nd-body" title="' + esc(title) + '">' +
      '<div class="nd-orb duo"' + (special ? ' style="color:' + ic + '"' : '') + '>' + (special ? ICON[d.kind] : agentIcon(d.agentId, 26)) + '</div>' +
      '<div class="nd-lbl" style="color:' + ic + '">' + esc(d.name) + '</div>' + badge +
      '<div class="nd-load"><div class="nd-load-bar" style="width:' + load + '%;background:' + lc + '"></div></div>' +
      '<div class="nd-sim-progress"><div class="nd-sim-progress-bar"></div></div>' +
      '</div>' + marks + (flags ? '<div class="ob-flags">' + flags + '</div>' : '') + runs;
    return { cls: cls, html: html, style: { '--ic': ic }, sig: JSON.stringify(d) };
  }

  /* ---------- a folded group: a stacked card with the members' icons ---------- */
  function dept(c) {
    var d = c.data;
    var shown = d.agents.slice(0, 7);
    var orbs = shown.map(function (a) {
      var col = agentColor(a.agentId);
      return '<span class="ob-mini ob-ms-' + (d.compare === 'def' ? 'none' : a.status || 'standby') + '" style="--ic:' + col + '" title="' + esc(HUB.model.name('individual', a.id)) + '">' + agentIcon(a.agentId, 15) + '</span>';
    }).join('') + (d.agents.length > shown.length ? '<span class="ob-mini-more">+' + (d.agents.length - shown.length) + '</span>' : '');
    var stats = d.members + ' 人';
    if (d.runs != null) stats += d.cut ? ' · ' + d.working + ' 在做' : ' · 运行 ' + d.runs + ' 次';
    if (d.never) stats += ' · ' + d.never + ' 未派';
    var bar = '';
    if (d.runs != null && d.members) {
      var cnt = { working: 0, waiting: 0, standby: 0, error: 0, never: 0 };
      d.agents.forEach(function (a) { cnt[a.status || 'standby'] = (cnt[a.status || 'standby'] || 0) + 1; });
      bar = '<div class="ob-dbar">' + ['working', 'waiting', 'standby', 'error', 'never'].map(function (k) {
        return cnt[k] ? '<i class="ob-sg-' + k + '" style="flex:' + cnt[k] + '"></i>' : '';
      }).join('') + '</div>';
    }
    var html = '<div class="ob-dept-body" title="' + esc(d.name + '：' + stats + '。双击展开') + '">' +
      '<div class="ob-dept-head"><span class="ob-dept-name">' + esc(d.name) + '</span><span class="ob-dept-lv">' + (d.level > 1 ? '小组' : '部门') + '</span></div>' +
      '<div class="ob-dept-orbs">' + orbs + '</div>' +
      '<div class="ob-dept-stats">' + esc(stats) + '</div>' + bar +
      '</div><button class="ob-tog" type="button" data-toggle="' + esc(d.id) + '" title="展开">+</button>';
    var cls = 'ob-card ob-dept' + (d.level > 1 ? ' ob-dept-sub' : '') + (d.never && d.never === d.members ? ' ob-st-never' : '');
    return { cls: cls, html: html, style: { '--pc': phaseVar(d.phase) }, sized: true, sig: JSON.stringify(d) };
  }

  /* ---------- a channel: a pill ---------- */
  function channel(c) {
    var d = c.data;
    var bad = d.status && d.status !== 'ok';
    var col = d.model ? 'var(--mc-' + d.model + ', var(--accent1))' : 'var(--accent2)';
    var html = '<span class="ob-ch-ic" style="color:' + col + '">' + (d.chKind === 'model' ? ICON.model : ICON.tool) + '</span>' +
      '<span class="ob-ch-name">' + esc(String(d.name).replace(/^(模型|工具)：/, '')) + '</span>' +
      (d.calls != null ? '<span class="ob-ch-n">' + d.calls + '</span>' : '') +
      (bad ? '<span class="ob-flag ob-flag-err">' + esc(L.channelStatus[d.status] || d.status) + '</span>' : '');
    return { cls: 'ob-card ob-ch' + (bad ? ' ob-ch-bad' : ''), html: html, sized: true, sig: JSON.stringify(d) };
  }

  function card(c) {
    switch (c.kind) {
      case 'dept': return dept(c);
      case 'channel': return channel(c);
      default:
        if (HUB.obsCards.extra[c.kind]) return HUB.obsCards.extra[c.kind](c);
        return individual(c);
    }
  }

  /* ---------- an open group: a translucent frame with a title band ---------- */
  function frame(f) {
    if (HUB.obsCards.extraFrame[f.kind]) return HUB.obsCards.extraFrame[f.kind](f);
    var d = f.data;
    var stats = d.members + ' 人';
    if (d.runs != null) stats += d.cut ? ' · ' + d.working + ' 在做' : ' · 运行 ' + d.runs + ' 次';
    if (d.never) stats += ' · ' + d.never + ' 未派';
    var html = '<div class="ob-fh" title="' + esc(d.name + '：' + stats + '。双击标题折叠') + '">' +
      '<span class="ob-fname">' + esc(d.name) + '</span><span class="ob-fmeta">' + esc(stats) + '</span>' +
      '<button class="ob-tog" type="button" data-toggle="' + esc(d.id) + '" title="折叠成一张卡">−</button></div>';
    return { cls: 'ob-fr-lv' + d.level, html: html, style: { '--pc': phaseVar(d.phase) }, sig: JSON.stringify(d) };
  }

  // other subjects register their own card and frame kinds here (process stages, gates, decisions, ...)
  HUB.obsCards = { card: card, frame: frame, extra: {}, extraFrame: {}, agentIcon: agentIcon, agentColor: agentColor, phaseVar: phaseVar, ICON: ICON };
})();
