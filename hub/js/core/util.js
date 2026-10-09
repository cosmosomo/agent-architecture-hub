/* HUB.util and HUB.bus: small helpers shared by every module. */
(function () {
  'use strict';
  var HUB = (window.HUB = window.HUB || {});

  var ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return ESC[c]; }); }

  // h('div', {class: 'x', onClick: fn, 'data-key': 'k'}, child, 'text', [more])
  function h(tag, attrs) {
    var el = document.createElement(tag);
    applyAttrs(el, attrs);
    for (var i = 2; i < arguments.length; i++) append(el, arguments[i]);
    return el;
  }
  function applyAttrs(el, attrs) {
    if (!attrs) return;
    Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v == null || v === false) return;
      if (k.slice(0, 2) === 'on' && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k === 'style' && typeof v === 'object') Object.keys(v).forEach(function (s) { el.style.setProperty(s, v[s]); });
      else if (k === 'html') el.innerHTML = v;
      else if (k === 'text') el.textContent = v;
      else el.setAttribute(k, v === true ? '' : v);
    });
  }
  function append(el, c) {
    if (c == null || c === false) return;
    if (Array.isArray(c)) { c.forEach(function (x) { append(el, x); }); return; }
    el.appendChild(c.nodeType ? c : document.createTextNode(String(c)));
  }

  var SVGNS = 'http://www.w3.org/2000/svg';
  function svg(tag, attrs) {
    var el = document.createElementNS(SVGNS, tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v == null || v === false) return;
      if (k === 'text') el.textContent = v;
      else el.setAttribute(k, v);
    });
    return el;
  }

  // Simulated clock: ms since the start of the simulated span -> "第1天 09:42".
  var DAY = 24 * 3600 * 1000, START_HOUR = 9;
  function fmtClock(t) {
    if (t == null || isNaN(t)) return '-';
    var abs = t + START_HOUR * 3600 * 1000;
    var d = Math.floor(abs / DAY) + 1;
    var m = Math.floor((abs % DAY) / 60000);
    return '第' + d + '天 ' + pad2(Math.floor(m / 60)) + ':' + pad2(m % 60);
  }
  function fmtTime(t) {
    if (t == null || isNaN(t)) return '-';
    var abs = t + START_HOUR * 3600 * 1000;
    var s = Math.floor((abs % DAY) / 1000);
    return pad2(Math.floor(s / 3600)) + ':' + pad2(Math.floor(s / 60) % 60) + ':' + pad2(s % 60);
  }
  function pad2(n) { return n < 10 ? '0' + n : '' + n; }
  function fmtDur(ms) {
    if (ms == null || isNaN(ms)) return '-';
    if (ms < 1000) return Math.round(ms) + '毫秒';
    var s = Math.round(ms / 1000);
    if (s < 60) return s + '秒';
    var m = Math.floor(s / 60);
    if (m < 60) return m + '分' + (s % 60 ? pad2(s % 60) + '秒' : '');
    var hh = Math.floor(m / 60);
    return hh + '小时' + (m % 60 ? pad2(m % 60) + '分' : '');
  }
  function fmtNum(n) {
    if (n == null || isNaN(n)) return '-';
    if (Math.abs(n) >= 10000) return (n / 10000).toFixed(n >= 100000 ? 0 : 1) + '万';
    return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }
  function pct(x) { return x == null || isNaN(x) ? '-' : Math.round(x * 100) + '%'; }

  // Deterministic PRNG (mulberry32) seeded from a string.
  function hashStr(s) {
    var h1 = 1779033703 ^ s.length;
    for (var i = 0; i < s.length; i++) { h1 = Math.imul(h1 ^ s.charCodeAt(i), 3432918353); h1 = (h1 << 13) | (h1 >>> 19); }
    return (h1 >>> 0) || 1;
  }
  function rng(seed) {
    var a = typeof seed === 'number' ? seed >>> 0 : hashStr(String(seed));
    var r = function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    r.int = function (lo, hi) { return lo + Math.floor(r() * (hi - lo + 1)); };
    r.pick = function (arr) { return arr[Math.floor(r() * arr.length)]; };
    r.chance = function (p) { return r() < p; };
    return r;
  }

  function byId(arr) { var m = new Map(); (arr || []).forEach(function (x) { m.set(x.id, x); }); return m; }
  function groupBy(arr, fn) {
    var m = new Map();
    (arr || []).forEach(function (x) { var k = fn(x); if (!m.has(k)) m.set(k, []); m.get(k).push(x); });
    return m;
  }
  function clamp(x, lo, hi) { return Math.max(lo, Math.min(hi, x)); }
  function sum(arr, fn) { var s = 0; (arr || []).forEach(function (x) { s += fn ? fn(x) : x; }); return s; }
  function uniq(arr) { return Array.from(new Set(arr)); }
  var _uid = 0;
  function uid(prefix) { _uid += 1; return (prefix || 'u') + _uid; }

  // Canonical tool names: "Read/Write (MANIFEST.md)" -> ["Read", "Write"].
  function toolList(str) {
    var out = [];
    String(str || '').split(',').forEach(function (s) {
      s.replace(/\(.*?\)/g, '').split('/').forEach(function (t) { t = t.trim(); if (t && out.indexOf(t) < 0) out.push(t); });
    });
    return out;
  }
  function toolChannelId(t) { return 'ch_tool_' + String(t).toLowerCase().replace(/[^a-z0-9]/g, ''); }

  var LABELS = {
    subject: { org: '组织', process: '流程', exec: '执行' },
    compare: { def: '定义', fact: '事实', both: '对照' },
    lineType: { task: '任务线', info: '信息线', watch: '监督线', channel: '渠道线' },
    relSub: { dispatch: '派发', deliver: '交付', roundtrip: '往返', report: '汇报', read: '读产出', watch: '盯着', use: '使用', maintain: '维护' },
    indStatus: { working: '在做', waiting: '在等', standby: '待命', error: '出错', never: '从没派出过' },
    outcome: { deliver: '交付', request: '请求', yield: '让出', escalate: '上报', failed: '失败', interrupted: '被打断', running: '进行中' },
    action: { deliver: '交付', request: '请求', yield: '让出', escalate: '上报', tool: '关键调用' },
    decider: { rule: '规则', agent: '智能体', human: '人' },
    docLayer: { consensus: '共识', private: '私有', map: '地图' },
    caseStatus: { done: '已完成', running: '进行中', blocked: '卡住' },
    taskStatus: { done: '完成', rework: '返工', failed: '失败', running: '进行中', waiting: '等待', open: '未开始' },
    gateResult: { pass: '通过', fail: '打回', escalate: '上报给人' },
    channelStatus: { ok: '正常', degraded: '降级', down: '中断', paused: '已暂停' },
    deliveryStatus: { delivered: '已送达', missing: '没送到', pending: '待送达' },
    deliveryKind: { context: '上下文', instruction: '新指令', feedback: '反馈' }
  };

  var listeners = new Map();
  HUB.bus = {
    on: function (evt, fn) { if (!listeners.has(evt)) listeners.set(evt, []); listeners.get(evt).push(fn); return function () { HUB.bus.off(evt, fn); }; },
    off: function (evt, fn) { var a = listeners.get(evt); if (a) listeners.set(evt, a.filter(function (f) { return f !== fn; })); },
    emit: function (evt, payload) { (listeners.get(evt) || []).slice().forEach(function (fn) { try { fn(payload); } catch (e) { console.error('[HUB.bus] ' + evt, e); } }); }
  };

  HUB.util = {
    esc: esc, h: h, svg: svg, fmtClock: fmtClock, fmtTime: fmtTime, fmtDur: fmtDur, fmtNum: fmtNum, pct: pct,
    rng: rng, hashStr: hashStr, byId: byId, groupBy: groupBy, clamp: clamp, sum: sum, uniq: uniq, uid: uid,
    toolList: toolList, toolChannelId: toolChannelId, LABELS: LABELS, DAY: DAY
  };
})();
