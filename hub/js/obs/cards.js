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
    var natives = (d.natives || []);
    var ribbon = natives.length ? '<span class="ob-native" title="' + esc('专属能力：' + natives.map(function (n) { return n.name + (n.host ? '（' + n.host + '自带）' : ''); }).join('；')) + '">★ ' + esc(natives[0].short) + (natives.length > 1 ? ' +' + (natives.length - 1) : '') + '</span>' : '';
    var host = d.host ? '<span class="ob-host" title="这个个体接入的是' + esc(d.host) + '">' + esc(d.host) + '</span>' : '';
    var title = d.name + (st ? '：' + (L.indStatus[st] || st) : '') + (d.runs != null ? '，运行 ' + d.runs + ' 次' : '') + '。双击打开它最近一次运行';
    var html = '<div class="nd-body" title="' + esc(title) + '">' +
      '<div class="nd-orb duo"' + (special ? ' style="color:' + ic + '"' : '') + '>' + (special ? ICON[d.kind] : agentIcon(d.agentId, 26)) + '</div>' +
      '<div class="nd-lbl" style="color:' + ic + '">' + esc(d.name) + '</div>' + badge +
      '<div class="nd-load"><div class="nd-load-bar" style="width:' + load + '%;background:' + lc + '"></div></div>' +
      '<div class="nd-sim-progress"><div class="nd-sim-progress-bar"></div></div>' +
      '</div>' + marks + (flags ? '<div class="ob-flags">' + flags + '</div>' : '') + runs + host + ribbon;
    if (natives.length) cls += ' ob-has-native';
    return { cls: cls, html: html, style: { '--ic': ic }, sig: JSON.stringify(d) };
  }

  /* ---------- a folded group: a stacked card with the members' icons ---------- */
  function dept(c) {
    var d = c.data;
    var shown = d.agents.slice(0, 7);
    var orbs = shown.map(function (a) {
      var col = agentColor(a.agentId);
      return '<span class="ob-mini ob-ms-' + (d.compare === 'def' ? 'none' : a.status || 'standby') + (a.native ? ' ob-mini-native' : '') + '" style="--ic:' + col + '" title="' + esc(HUB.model.name('individual', a.id) + (a.native ? '（有专属能力）' : '')) + '">' + agentIcon(a.agentId, 15) + '</span>';
    }).join('') + (d.agents.length > shown.length ? '<span class="ob-mini-more">+' + (d.agents.length - shown.length) + '</span>' : '');
    var stats = d.members + ' 人';
    if (d.runs != null) stats += d.cut ? ' · ' + d.working + ' 在做' : ' · 运行 ' + d.runs + ' 次';
    if (d.never) stats += ' · ' + d.never + ' 未派';
    if (d.natives) stats += ' · ★ 专属 ' + d.natives;
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

  /* ---------- a channel: status, load against its limit, who uses it ---------- */
  var CH_KIND = { model: '模型渠道', function: '功能渠道', tool: '工具', local: '基础能力', basic: '基础能力', native: '专属能力' };
  function channel(c) {
    var d = c.data;
    if (d.chKind === 'basic') {
      // one point for what every agent can do: no limit, no upkeep
      var tl = d.tools.join(' · ');
      return { cls: 'ob-card ob-ch ob-chk-basic', sized: true, sig: JSON.stringify(d),
        html: '<div class="ob-chc-head"><span class="ob-ch-ic" style="color:var(--t2)">' + ICON.tool + '</span><span class="ob-ch-name">基础能力</span><span class="ob-chc-kind">人人都有 · 不用维护</span></div>' +
          '<div class="ob-chc-tools" title="' + esc(d.tools.join('、')) + '">' + esc(tl) + (d.calls != null ? ' · ' + d.calls + ' 次' : '') + '</div>' };
    }
    var bad = d.status && d.status !== 'ok';
    var col = d.model ? 'var(--mc-' + d.model + ', var(--accent1))' : d.chKind === 'function' ? 'var(--accent3)' : 'var(--accent2)';
    var name = String(d.name).replace(/^(模型|工具)：/, '');
    var kind = CH_KIND[d.chKind] || '渠道';
    if (d.limit === 1) kind += ' · 独占';
    else if (d.limit) kind += ' · 并发 ' + d.limit;
    else kind += ' · 不限并发';
    // load: at a time cut the slots show who is in now; over the whole span they show the busiest moment
    var load = '';
    if (!d.def && d.limit) {
      var used = d.cut ? d.active : d.peak;
      var cells = '';
      if (d.limit <= 8) for (var i = 0; i < d.limit; i++) cells += '<i class="' + (i < used ? 'on' : '') + '"></i>';
      else cells = '<b style="width:' + Math.min(100, Math.round(100 * used / d.limit)) + '%"></b>';
      var txt = d.cut ? '在用 ' + d.active + '/' + d.limit + (d.waiting ? ' · 排队 ' + d.waiting : '')
        : '峰值 ' + d.peak + '/' + d.limit + (d.queued ? ' · 排过 ' + d.queued + ' 次队' : '');
      load = '<div class="ob-chc-load"><span class="ob-chc-cells' + (d.limit > 8 ? ' bar' : '') + (used >= d.limit ? ' full' : '') + '">' + cells + '</span><span class="ob-chc-txt">' + esc(txt) + '</span></div>';
    } else if (d.chKind === 'local') {
      load = '<div class="ob-chc-tools" title="' + esc(d.tools.join('、')) + '">' + esc(d.tools.join(' · ')) + '</div>';
    } else if (!d.def) {
      load = '<div class="ob-chc-load"><span class="ob-chc-txt">' + (d.cut ? '在用 ' + d.active : '峰值 ' + d.peak) + '</span></div>';
    }
    var avatars = d.agents.map(function (a) {
      var ac = a.kind === 'meta' ? '#22C4E6' : agentColor(a.agentId);
      return '<span class="ob-mini' + (a.on ? ' ob-ms-working' : ' ob-ms-none') + '" style="--ic:' + ac + '" title="' + esc(HUB.model.name('individual', a.id)) + (a.on ? '（正在用）' : '') + '">' + (a.agentId ? agentIcon(a.agentId, 13) : '') + '</span>';
    }).join('') + (d.users > d.agents.length ? '<span class="ob-mini-more">+' + (d.users - d.agents.length) + '</span>' : '');
    var html = '<div class="ob-chc-head"><span class="ob-ch-ic" style="color:' + col + '">' + (d.chKind === 'model' ? ICON.model : ICON.tool) + '</span>' +
      '<span class="ob-ch-name" title="' + esc(name) + '">' + esc(name) + '</span>' +
      (bad ? '<span class="ob-chs bad">' + esc(L.channelStatus[d.status] || d.status) + '</span>' : d.def ? '' : '<span class="ob-chs ok">正常</span>') + '</div>' +
      '<div class="ob-chc-kind">' + esc(kind) + '</div>' + load +
      '<div class="ob-chc-users"><span class="ob-chc-av">' + avatars + '</span><span class="ob-chc-n">' + d.users + ' 人在用' + (d.calls != null ? ' · ' + d.calls + ' 次调用' : '') + '</span></div>';
    var cls = 'ob-card ob-ch ob-chk-' + d.chKind + (bad ? ' ob-ch-bad' : '') + (!d.def && d.limit && (d.cut ? d.active >= d.limit || d.waiting : d.queued) ? ' ob-ch-full' : '');
    return { cls: cls, html: html, sized: true, sig: JSON.stringify(d) };
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

  // the capability layer: all channels and their maintainer; selecting it opens channel management in the side panel
  function chframe(f) {
    var d = f.data;
    var meta = d.n + ' 条渠道' + (d.def ? '' : (d.bad ? ' · ' + d.bad + ' 条有故障' : '') + (d.full ? ' · ' + d.full + ' 条满载' : '') + (d.queued ? ' · 累计排队 ' + d.queued + ' 次' : ''));
    var html = '<div class="ob-fh" title="能力层：模型渠道、功能渠道和本地工具。点标题打开渠道管理">' +
      '<span class="ob-fname">能力层 · 渠道</span><span class="ob-fmeta">' + esc(meta) + '</span></div>';
    return { cls: 'ob-fr-lv1 ob-fr-ch', html: html, style: { '--pc': '52, 211, 153' }, sig: JSON.stringify(d) };
  }

  // other subjects register their own card and frame kinds here (process stages, gates, decisions, ...)
  // a sentence on the canvas where a view has nothing to draw
  function note(c) { return { cls: 'ob-card ob-note-card', html: esc(c.data.text), sized: true, sig: c.data.text }; }

  HUB.obsCards = { card: card, frame: frame, extra: { note: note }, extraFrame: { chframe: chframe }, agentIcon: agentIcon, agentColor: agentColor, phaseVar: phaseVar, ICON: ICON, CH_KIND: CH_KIND };
})();
