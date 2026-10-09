/* HUB.obsPanel: the right sidebar in observation mode. Details of whatever is selected, in the page's own
   .ds-* vocabulary, plus the actions the person can take from here (talk, interject, re-deliver, approve, ...). */
(function () {
  'use strict';
  var HUB = (window.HUB = window.HUB || {});
  var U = HUB.util, L = U.LABELS;
  var esc = U.esc;
  var host = null, last = null;

  var TYPE_ZH = { individual: '个体', group: '分组', relation: '一条定义的线', agg: '合并的线', factonly: '编排外的交接', channel: '能力渠道',
    gate: '判断点', stage: '阶段', step: '步骤', case: '案例实例', run: '一次运行', decision: '决策', call: '调用', doc: '资料', flow: '流转' };
  var KIND_ZH = { approval: '等你拍板', escalation: '上报给你', direction: '可以调整' };
  var DEC_ACTION_CLS = { deliver: 'good', request: 'info', yield: 'warn', escalate: 'bad', tool: 'info' };

  function nm(type, id) { return esc(HUB.model.name(type, id)); }
  function link(type, id, text) { return '<a class="ob-a" data-act="sel" data-type="' + type + '" data-id="' + esc(id) + '">' + (text != null ? text : nm(type, id)) + '</a>'; }
  function pill(text, cls) { return '<span class="ob-pill ' + (cls || '') + '">' + esc(text) + '</span>'; }
  function sec(title, body, extra) { return body ? '<div class="ds' + (extra ? ' ' + extra : '') + '"><div class="ds-l">' + esc(title) + '</div>' + body + '</div>' : ''; }
  function kv(rows) { return '<dl class="ob-kv">' + rows.filter(Boolean).map(function (r) { return '<dt>' + esc(r[0]) + '</dt><dd>' + r[1] + '</dd>'; }).join('') + '</dl>'; }
  function stats(items) { return '<div class="ob-stats">' + items.map(function (x) { return '<div class="ob-stat"><b>' + esc(x[1]) + '</b><span>' + esc(x[0]) + '</span></div>'; }).join('') + '</div>'; }
  function rowItem(attrs, name, meta, lead) { return '<div class="ob-row" ' + attrs + '>' + (lead || '') + '<span class="ob-nm">' + name + '</span>' + (meta ? '<span class="ob-meta">' + meta + '</span>' : '') + '</div>'; }
  function selAttrs(type, id) { return 'data-act="sel" data-type="' + type + '" data-id="' + esc(id) + '"'; }
  function statusCls(st) { return st === 'working' ? 'good' : st === 'error' ? 'bad' : st === 'waiting' ? 'warn' : st === 'never' ? '' : ''; }

  function hero(o) {
    var ph = o.phase ? ' ph-' + o.phase : '';
    return '<div class="ds-hero-sticky' + ph + '"><div class="ds-hero-row">' +
      '<div class="ds-avatar-orb' + ph + '" style="width:40px;height:40px;flex-shrink:0;' + (o.color ? 'color:' + o.color : '') + '">' + (o.icon || '') + '</div>' +
      '<div class="ds-hero-meta"><div class="ds-avatar-name">' + esc(o.name) + '</div><div class="ds-avatar-role">' + esc(o.role || '') + '</div>' +
      (o.chips ? '<div class="ds-hero-chips">' + o.chips + '</div>' : '') + '</div></div></div>';
  }
  function chip(text, cls) { return '<span class="ds-chip-micro' + (cls ? ' ' + cls : '') + '">' + esc(text) + '</span>'; }
  function iconFor(ind) {
    if (!ind) return '';
    if (ind.kind === 'human' || ind.kind === 'meta') return HUB.obsCards.ICON[ind.kind];
    return HUB.obsCards.agentIcon(ind.agentId, 30);
  }
  function actions(target, kinds) {
    var BTN = { talk: '对话', interject: '插话（新指令）', urge: '催办', reassign: '改派', edit_rule: '交给中枢改规则', approve: '放行', pause_channel: '暂停这条渠道', resume_channel: '恢复', assign_maint: '指派维护' };
    var needsText = kinds.some(function (k) { return k === 'talk' || k === 'interject' || k === 'edit_rule' || k === 'reassign'; });
    return (needsText ? '<div class="ob-say"><input type="text" data-say placeholder="写下要说的话或新的要求…" aria-label="要说的话"></div>' : '') +
      '<div class="ob-acts" style="margin-top:6px">' + kinds.map(function (k) {
        return '<button class="btn' + (k === 'approve' ? ' btn-sim' : k === 'talk' || k === 'interject' ? ' btn-p' : '') + '" type="button" data-act="do" data-kind="' + k + '" data-type="' + target.type + '" data-id="' + esc(target.id) + '">' + BTN[k] + '</button>';
      }).join('') + '</div>' +
      '<div class="ob-note" style="margin-top:6px">操作会记成一条事实，送达后图上和时间轴上都看得到。现在连的是模拟数据，回复也是模拟的。</div>';
  }

  /* ================= per type ================= */
  function overview(m, s, a) {
    var t = a.totals;
    var h = hero({ name: m.name, role: m.presetName + ' · ' + (m.flowText || ''), icon: typeof svgPresetu === 'function' ? svgPresetu(m.id, 30) : '',
      chips: (m.curated ? chip('精选案例', 'm-op') : '') + chip(s.time == null ? '全部时间' : '截止 ' + U.fmtClock(s.time)) + chip('模拟数据') });
    var intro = '<div class="ds"><div class="ds-who">' + esc(m.summary || '') + '</div></div>';
    var nh = a.needsHuman.map(function (x) {
      var act = x.kind === 'approval' ? '<button class="btn btn-sim" type="button" data-act="do" data-kind="approve" data-type="gate" data-id="' + esc(x.target.id) + '" style="height:24px">放行</button>' : '';
      return '<div class="ob-row" ' + selAttrs(x.target.type, x.target.id) + '>' + pill(KIND_ZH[x.kind] || x.kind, x.kind === 'approval' ? 'warn' : 'info') +
        '<span class="ob-nm ob-wrap-text">' + esc(x.text) + '</span>' + act + '</div>';
    }).join('');
    var cases = m.facts.cases.filter(function (c) { return HUB.model.visible(c.start, s); }).map(function (c) {
      var cls = c.status === 'done' ? 'good' : c.status === 'blocked' ? 'warn' : 'info';
      return rowItem('data-act="focus" data-id="' + c.id + '"', '<b>' + c.id + '</b> ' + esc(c.name), U.fmtClock(c.start), pill(L.caseStatus[c.status] || c.status, cls));
    }).join('');
    var health = a.health.slice(0, 6).map(function (x) {
      return '<div class="ob-row" data-act="health" data-hid="' + x.id + '"><span class="ob-sev ' + x.severity + '">' + ({ high: '高', mid: '中', low: '低' })[x.severity] + '</span><span class="ob-nm ob-wrap-text">' + esc(x.text) + '</span></div>';
    }).join('');
    var versions = (m.def.versions || []).slice().reverse().slice(0, 4).map(function (v) {
      return '<div class="ob-row" style="cursor:default">' + pill(v.id, 'info') + '<span class="ob-nm ob-wrap-text">' + esc(v.note || '') + '</span><span class="ob-meta">' + U.fmtClock(v.at) + '</span></div>';
    }).join('');
    return h + intro +
      sec('需要人处理的事', nh ? '<div class="ob-list">' + nh + '</div>' : '<div class="ob-note">现在没有等你处理的事。</div>') +
      sec('概况', stats([['个体', t.individuals], ['任务线', t.relations], ['案例', t.cases], ['运行', t.runs], ['调用', U.fmtNum(t.calls)], ['token', U.fmtNum(t.tokens)],
        ['首次通过', U.pct(t.firstPassRate)], ['返工率', U.pct(t.reworkRate)], ['失败运行', t.failedRuns]])) +
      sec('案例实例（点一下聚焦它）', cases ? '<div class="ob-list">' + cases + '</div>' : '') +
      sec('架构体检', health ? '<div class="ob-list">' + health + '</div>' : '<div class="ob-note">没有发现问题。</div>') +
      sec('编排版本', versions ? '<div class="ob-list">' + versions + '</div>' : '') +
      sec('怎么看', '<div class="ob-note">顶栏六个按钮是六种常用视图，键盘 1～6 也行。单击任何卡片或线看详情；双击部门展开、再双击标题折叠；双击个体进入它最近一次运行的决策链。右上角切换粒度和对照方式，下方开关各类线。</div>');
  }

  function individual(m, s, a, id) {
    var x = m.idx.ind.get(id);
    if (!x) return '';
    var st = a.indStats[id] || {};
    var g = x.groupId ? m.idx.group.get(x.groupId) : null;
    var role = (g ? g.name + ' · ' : '') + (x.kind === 'agent' ? (x.model ? x.model.charAt(0).toUpperCase() + x.model.slice(1) : '') : x.kind === 'human' ? '人' : '元智能体');
    var mc = x.model ? 'm-' + (x.model === 'opus' ? 'op' : x.model === 'sonnet' ? 'so' : x.model === 'haiku' ? 'ha' : 'fa') : '';
    var h = hero({ name: x.name, role: role, icon: iconFor(x), phase: x.phase, color: x.kind === 'human' ? '#FBBF24' : x.kind === 'meta' ? '#22C4E6' : '',
      chips: chip(L.indStatus[st.status] || '待命', '') + (x.model ? chip(x.model.toUpperCase(), mc) : '') + (x.isHub ? chip('中枢智能体', 'm-so') : '') + (x.enhanced ? chip('增强', 'm-ha') : '') });
    var info = kv([['职责', esc(x.role || '-')], ['什么时候动', esc(x.trigger || '-')], x.tools && x.tools.length ? ['工具', esc(x.tools.join('、'))] : null,
      x.watches && x.watches.length ? ['盯着', x.watches.map(function (w) { return link('individual', w); }).join('、')] : null]);
    var dv = a.delivery[id];
    var deliv = '';
    if (dv) {
      var miss = dv.missing.map(function (d) {
        return '<div class="ob-row" style="cursor:default">' + pill('没送到', 'bad') + '<span class="ob-nm">' + nm('doc', d) + '</span>' +
          '<button class="btn btn-a" type="button" data-act="do" data-kind="redeliver" data-type="individual" data-id="' + esc(id) + '" data-doc="' + esc(d) + '" style="height:24px">补送</button></div>';
      }).join('');
      var ever = dv.missedEver.filter(function (d) { return dv.missing.indexOf(d) < 0; }).map(function (d) { return pill(HUB.model.name('doc', d), 'warn'); }).join(' ');
      deliv = kv([['该知道', dv.expected.length + ' 份'], ['已送到', dv.received.length + ' 份'], ['新指令', dv.instructions + ' 条' + (dv.pending ? '（' + dv.pending + ' 条待送达）' : '')]]) +
        (miss ? '<div class="ob-list" style="margin-top:6px">' + miss + '</div>' : '') +
        (ever ? '<div class="ob-note" style="margin-top:6px">曾经没拿到，后来补上：' + ever + '</div>' : '');
    }
    var rels = (m.idx.relsByInd.get(id) || []).filter(function (r) { return r.type !== 'channel'; });
    var relRows = rels.slice(0, 14).map(function (r) {
      var other = r.from === id ? r.to : r.from;
      var dir = r.from === id ? '→' : '←';
      var c = (a.relStats[r.id] || {}).count || 0;
      return rowItem(selAttrs('relation', r.id), dir + ' ' + nm(m.idx.ch.has(other) ? 'channel' : 'individual', other), (L.relSub[r.sub] || r.sub) + (s.compare === 'def' ? '' : ' · ' + c + ' 次'),
        '<span class="ob-sw-dot ob-t-' + r.type + '"></span>');
    }).join('');
    var runs = (m.idx.runsByInd.get(id) || []).filter(function (r) { return HUB.model.visible(r.start, s); }).slice(-6).reverse().map(function (r) {
      var t = m.idx.task.get(r.taskId);
      var cls = r.outcome === 'failed' || r.outcome === 'interrupted' ? 'bad' : r.outcome === 'escalate' ? 'warn' : 'good';
      return rowItem('data-act="run" data-id="' + r.id + '"', esc(t ? t.name : '运行'), (r.caseId || '') + ' · ' + U.fmtDur(r.end - r.start), pill(L.outcome[r.outcome] || r.outcome, cls));
    }).join('');
    var msgs = m.facts.messages.filter(function (mm) { return (mm.from === id || mm.to === id) && HUB.model.visible(mm.at, s); }).slice(-6).map(function (mm) {
      return '<div class="ob-msg' + (mm.from === 'human' ? ' me' : '') + '"><small>' + nm('individual', mm.from) + ' → ' + nm('individual', mm.to) + ' · ' + U.fmtClock(mm.at) + '</small>' + esc(mm.text) + '</div>';
    }).join('');
    var acts = x.kind === 'human' ? '' : actions({ type: 'individual', id: id }, x.kind === 'meta' ? ['talk', 'interject'] : ['talk', 'interject', 'urge', 'reassign', 'edit_rule']);
    return h + '<div class="ds">' + info + '</div>' +
      (s.compare !== 'def' && x.kind !== 'human' ? sec('运行', stats([['运行', st.runs || 0], ['任务', st.tasks || 0], ['token', U.fmtNum(st.tokens || 0)]])) : '') +
      (s.compare !== 'def' ? sec('送达：它该知道的有没有真的到它手里', deliv) : '') +
      sec('线', relRows ? '<div class="ob-list">' + relRows + '</div>' : '') +
      (s.compare !== 'def' ? sec('最近的运行（点一下看决策链）', runs ? '<div class="ob-list">' + runs + '</div>' : '<div class="ob-note">' + (st.status === 'never' ? '从没被派过活：编排里有它，实际没用上。' : '这个时间点之前还没有运行。') + '</div>') : '') +
      sec('和它说话', (msgs ? '<div class="ob-list">' + msgs + '</div>' : '') + acts);
  }

  function group(m, s, a, id) {
    var g = m.idx.group.get(id);
    if (!g) return '';
    var gs = a.groupStats[id] || {};
    var mem = m.idx.membersDeep.get(id) || [];
    var open = HUB.store.isOpen('org', g.id, g.level, s);
    var h = hero({ name: g.name, role: (g.level > 1 ? '小组' : '部门') + ' · ' + mem.length + ' 人', icon: '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="3" y="4" width="8" height="7" rx="1.5"/><rect x="13" y="4" width="8" height="7" rx="1.5"/><rect x="8" y="14" width="8" height="7" rx="1.5"/></svg>', color: 'var(--accent1)' });
    var rows = mem.map(function (mid) {
      var st = (a.indStats[mid] || {}).status;
      return rowItem(selAttrs('individual', mid), nm('individual', mid), s.compare === 'def' ? '' : (L.indStatus[st] || '') + ' · ' + ((a.indStats[mid] || {}).runs || 0) + ' 次', '<span class="ob-dot ' + (st || '') + '"></span>');
    }).join('');
    return h + (s.compare !== 'def' ? sec('概况', stats([['成员', gs.members || 0], ['运行', gs.runs || 0], ['从没派出', gs.never || 0]])) : '') +
      sec('成员', '<div class="ob-list">' + rows + '</div>') +
      '<div class="ds"><button class="btn btn-p" type="button" data-act="toggle" data-id="' + esc(id) + '">' + (open ? '折叠成一张卡' : '展开看成员') + '</button></div>';
  }

  function relation(m, s, a, id) {
    var r = m.idx.rel.get(id);
    if (!r) return '';
    var rs = a.relStats[id] || {};
    var hand = m.facts.handoffs.filter(function (x) { return x.relationId === id && HUB.model.visible(x.at, s); });
    var h = hero({ name: HUB.model.name(m.idx.ch.has(r.from) ? 'channel' : 'individual', r.from) + ' → ' + HUB.model.name(m.idx.ch.has(r.to) ? 'channel' : 'individual', r.to),
      role: (L.lineType[r.type] || r.type) + ' · ' + (L.relSub[r.sub] || r.sub), icon: '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 12h14M13 6l6 6-6 6"/></svg>', color: 'var(--accent1)',
      chips: s.compare === 'def' ? '' : chip(rs.count ? '发生 ' + rs.count + ' 次' : '设计了没发生') });
    var rows = hand.slice(-8).reverse().map(function (x) {
      return rowItem('data-act="focus" data-id="' + esc(x.caseId) + '"', esc(x.caseId) + ' · ' + U.fmtClock(x.at), x.missing && x.missing.length ? '缺 ' + x.missing.length + ' 份' : (x.note || ''));
    }).join('');
    return h + '<div class="ds">' + kv([['从', link(m.idx.ch.has(r.from) ? 'channel' : 'individual', r.from)], ['到', link(m.idx.ch.has(r.to) ? 'channel' : 'individual', r.to)],
      ['说明', esc(r.note || r.label || '-')], rs.first != null ? ['第一次', U.fmtClock(rs.first)] : null, rs.last != null ? ['最近一次', U.fmtClock(rs.last)] : null]) + '</div>' +
      (s.compare !== 'def' ? sec('实际发生的交接', rows ? '<div class="ob-list">' + rows + '</div>' : '<div class="ob-note">编排里有这条线，但到现在一次也没走过。</div>') : '') +
      sec('调整', actions({ type: 'relation', id: id }, ['edit_rule']));
  }

  function agg(m, s, a, id) {
    var parts = id.split('|');
    var keyName = function (k) { var t = k.slice(0, 2), x = k.slice(2); return t === 'g:' ? HUB.model.name('group', x) : t === 'c:' ? HUB.model.name('channel', x) : HUB.model.name('individual', x); };
    var scene = HUB.obsStage.scene;
    var ls = scene ? scene.links.filter(function (l) { return l.from === parts[0] && l.to === parts[1]; }) : [];
    var rows = [];
    ls.forEach(function (l) { (l.rels || []).forEach(function (rid) { var r = m.idx.rel.get(rid); var c = (a.relStats[rid] || {}).count || 0;
      rows.push(rowItem(selAttrs('relation', rid), nm('individual', r.from) + ' → ' + nm(m.idx.ch.has(r.to) ? 'channel' : 'individual', r.to), (L.relSub[r.sub] || r.sub) + (s.compare === 'def' ? '' : ' · ' + c + ' 次'), '<span class="ob-sw-dot ob-t-' + r.type + '"></span>')); }); });
    var h = hero({ name: keyName(parts[0]) + ' → ' + keyName(parts[1]), role: '合并后的线：' + rows.length + ' 条定义', icon: '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 8h12M4 16h12M14 4l5 4-5 4M14 12l5 4-5 4"/></svg>', color: 'var(--accent1)' });
    return h + sec('里面的每一条（点开看）', rows.length ? '<div class="ob-list">' + rows.join('') + '</div>' : '');
  }

  function factonly(m, s, a, id) {
    var f = a.factOnly.find(function (x) { return x.id === id; });
    if (!f) return '<div class="sr-mt">这条编排外的交接在当前时间点之前还没发生。</div>';
    var hand = f.handoffIds.map(function (hid) { return m.idx.handoff.get(hid); }).filter(Boolean);
    var h = hero({ name: HUB.model.name('individual', f.from) + ' → ' + HUB.model.name('individual', f.to), role: '编排里没有这条线，实际发生了 ' + f.count + ' 次',
      icon: '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3l9 16H3z"/><path d="M12 10v4M12 17v.5"/></svg>', color: '#F97316', chips: chip('未声明') });
    var rows = hand.slice(-8).reverse().map(function (x) { return rowItem('data-act="focus" data-id="' + esc(x.caseId) + '"', esc(x.caseId) + ' · ' + U.fmtClock(x.at), esc(x.note || '')); }).join('');
    return h + '<div class="ds"><div class="ds-who">' + esc(f.note || '这类交接没写进编排：可能是编排漏了，也可能是个体自己找的捷径。') + '</div></div>' +
      sec('发生在', '<div class="ob-list">' + rows + '</div>') +
      sec('处理', actions({ type: 'individual', id: f.from }, ['edit_rule']));
  }

  function channel(m, s, a, id) {
    var c = m.idx.ch.get(id);
    if (!c) return '';
    var cs = a.channelStats[id] || {};
    var ev = m.facts.channelEvents.filter(function (e) { return e.channelId === id && HUB.model.visible(e.at, s); }).slice(-8).reverse();
    var h = hero({ name: c.name, role: (c.kind === 'model' ? '模型渠道' : '工具渠道') + ' · 维护者：' + HUB.model.name('individual', c.maintainer),
      icon: c.kind === 'model' ? HUB.obsCards.ICON.model.replace(/16/g, '26') : HUB.obsCards.ICON.tool.replace(/16/g, '26'), color: 'var(--accent2)', chips: chip(L.channelStatus[cs.status] || '正常') });
    var users = (c.users || []).map(function (u) { return link('individual', u); }).join('、');
    var rows = ev.map(function (e) { return '<div class="ob-row" style="cursor:default"><span class="ob-meta">' + U.fmtClock(e.at) + '</span><span class="ob-nm ob-wrap-text">' + esc(e.note || e.kind) + '</span></div>'; }).join('');
    return h + sec('概况', stats([['调用', U.fmtNum(cs.calls || 0)], ['出错', cs.errors || 0], ['故障', cs.incidents || 0]])) +
      '<div class="ds">' + kv([['容量', esc(c.capacity || '-')], ['额度', esc(c.quota || '-')], ['谁在用', users || '-']]) + '</div>' +
      sec('维护记录', rows ? '<div class="ob-list">' + rows + '</div>' : '<div class="ob-note">没有故障和维护记录。</div>') +
      sec('操作', actions({ type: 'channel', id: id }, [cs.status === 'paused' ? 'resume_channel' : 'pause_channel', 'assign_maint']));
  }

  function gate(m, s, a, id) {
    var g = m.idx.gate.get(id);
    if (!g) return '';
    var gs = a.gateStats[id] || {};
    var who = g.decider.type === 'human' ? '人' : g.decider.type === 'rule' ? '规则' : HUB.model.name('individual', g.decider.who);
    var waiting = m.facts.cases.filter(function (c) { return c.waitingAt === id; });
    var h = hero({ name: g.name, role: '判断点 · 由' + who + '判断', icon: '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3l9 9-9 9-9-9z"/></svg>', color: 'var(--accent3)' });
    return h + '<div class="ds">' + kv([['谁来判断', esc(who)], ['怎么判断', esc(g.decider.text || '-')], ['通过后', esc(g.pass === 'done' ? '完成' : HUB.model.name('stage', g.pass))],
      ['打回到', esc(g.fail ? HUB.model.name('stage', g.fail) : '-')], ['上报给', g.escalate ? '人' : '-']]) + '</div>' +
      (s.compare !== 'def' ? sec('结果', stats([['通过', gs.pass || 0], ['打回', gs.fail || 0], ['上报', gs.escalate || 0]])) : '') +
      (waiting.length ? sec('正在这里等的案例', '<div class="ob-list">' + waiting.map(function (c) { return rowItem('data-act="focus" data-id="' + c.id + '"', c.id + ' ' + esc(c.name), '等待中'); }).join('') + '</div>' +
        (g.decider.type === 'human' ? actions({ type: 'gate', id: id }, ['approve']) : '')) : '');
  }

  function stage(m, s, a, id) {
    var st = m.idx.stage.get(id);
    if (!st) return '';
    var rows = st.steps.map(function (x) {
      var ss = a.stepStats[x.id] || {};
      return rowItem(selAttrs('step', x.id), esc(x.name), x.executors.map(function (e) { return HUB.model.name('individual', e); }).join('、') + (s.compare === 'def' ? '' : ' · ' + (ss.tasks || 0) + ' 个任务'));
    }).join('');
    return hero({ name: st.name, role: '阶段 · ' + st.steps.length + ' 个步骤', icon: HUB.obsCards.ICON.tool.replace(/16/g, '26'), color: 'var(--accent1)' }) + sec('步骤', '<div class="ob-list">' + rows + '</div>');
  }
  function step(m, s, a, id) {
    var x = m.idx.step.get(id);
    if (!x) return '';
    var ss = a.stepStats[id] || {};
    return hero({ name: x.name, role: '步骤 · ' + HUB.model.name('stage', m.idx.stageOfStep.get(id)), icon: HUB.obsCards.ICON.tool.replace(/16/g, '26'), color: 'var(--accent1)' }) +
      '<div class="ds">' + kv([['谁来做', x.executors.map(function (e) { return link('individual', e); }).join('、')], ['产出', esc(x.output || '-')]]) + '</div>' +
      (s.compare !== 'def' ? sec('统计', stats([['任务', ss.tasks || 0], ['完成', ss.done || 0], ['返工', ss.rework || 0]])) : '');
  }

  function kase(m, s, a, id) {
    var c = m.idx.case.get(id);
    if (!c) return '';
    var tasks = (m.idx.tasksByCase.get(id) || []).filter(function (t) { return HUB.model.visible(t.created, s); });
    var runs = (m.idx.runsByCase.get(id) || []).filter(function (r) { return HUB.model.visible(r.start, s); });
    var path = c.path.filter(function (p) { return HUB.model.visible(p.at, s); }).map(function (p) {
      return p.node === 'start' ? '开始' : p.node === 'done' ? '完成' : m.idx.stage.has(p.node) ? HUB.model.name('stage', p.node) : m.idx.gate.has(p.node) ? '◇' + HUB.model.name('gate', p.node) : p.node;
    }).join(' → ');
    var focused = s.focus && s.focus.type === 'case' && s.focus.id === id;
    return hero({ name: c.id + ' ' + c.name, role: '案例实例 · ' + (L.caseStatus[c.status] || c.status), icon: typeof svgPresetu === 'function' ? svgPresetu(m.id, 30) : '', chips: chip(U.fmtClock(c.start) + ' 开始') }) +
      sec('概况', stats([['任务', tasks.length], ['运行', runs.length], ['返工', tasks.filter(function (t) { return (t.visit || 1) > 1 || t.status === 'rework'; }).length]])) +
      sec('走过的路', '<div class="ob-note">' + esc(path) + '</div>') +
      (c.waitingAt ? sec('卡在', '<div class="ob-list">' + rowItem(selAttrs('gate', c.waitingAt), nm('gate', c.waitingAt), '等待中') + '</div>') : '') +
      '<div class="ds ob-acts">' + (focused ? '' : '<button class="btn btn-p" type="button" data-act="focus" data-id="' + id + '">在图上点亮这个案例</button>') +
      (HUB.obsTimeline ? '<button class="btn btn-sim" type="button" data-act="replay" data-id="' + id + '">回放</button>' : '') + '</div>';
  }

  function run(m, s, a, id) {
    var r = m.idx.run.get(id);
    if (!r) return '';
    var t = m.idx.task.get(r.taskId);
    var x = m.idx.ind.get(r.individualId);
    var decs = (m.idx.decsByRun.get(id) || []);
    var cov = r.coverage || {};
    return hero({ name: HUB.model.name('individual', r.individualId) + ' 的一次运行', role: (t ? t.name : '') + (r.caseId ? ' · ' + r.caseId : ''), icon: iconFor(x), phase: x && x.phase,
      chips: chip(L.outcome[r.outcome] || r.outcome) + chip(U.fmtDur(r.end - r.start)) }) +
      '<div class="ds">' + kv([['开始', U.fmtClock(r.start)], ['结束', U.fmtClock(r.end)], ['编排版本', esc(r.version || '-')], ['token', U.fmtNum(r.tokens || 0)],
        ['会话覆盖', '读全 ' + (cov.indexed || 0) + ' · 只看元信息 ' + (cov.metaOnly || 0) + ' · 截断 ' + (cov.truncated || 0)]]) + '</div>' +
      sec('决策（' + decs.length + '）', '<div class="ob-list">' + decs.map(function (d) {
        return rowItem(selAttrs('decision', d.id), esc(d.title), '', pill(L.action[d.action] || d.action, DEC_ACTION_CLS[d.action]));
      }).join('') + '</div>') +
      (s.subject !== 'exec' || !(s.focus && s.focus.id === id) ? '<div class="ds"><button class="btn btn-p" type="button" data-act="run" data-id="' + id + '">打开决策链</button></div>' : '');
  }

  function decision(m, s, a, id) {
    var d = m.idx.dec.get(id);
    if (!d) return '';
    var calls = m.idx.callsByDec.get(id) || [];
    var alt = (d.alternatives || []).map(function (x) { return pill(x, x === d.choice ? 'good' : ''); }).join(' ');
    return hero({ name: d.title, role: '决策 · ' + HUB.model.name('run', d.runId), icon: '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3l8 9-8 9-8-9z"/></svg>', color: 'var(--accent1)',
      chips: chip(L.action[d.action] || d.action) + (d.outcome === 'overturned' ? chip('后来被推翻') : '') + (d.unsupported && d.unsupported.length ? chip('理由没有依据') : '') }) +
      '<div class="ds">' + kv([['起因', esc(d.trigger || '-')], ['备选', alt || '-'], ['选了', esc(d.choice || '-')], ['理由', esc(d.reason || '-')], ['影响', esc(d.impact || '-')],
        ['时间', U.fmtClock(d.start) + ' · ' + U.fmtDur(d.end - d.start)]]) + '</div>' +
      sec('调用（' + calls.length + '）', '<div class="ob-list">' + calls.map(function (c) {
        return rowItem(selAttrs('call', c.id), esc(c.name || c.kind), U.fmtDur(c.end - c.start) + (c.status !== 'ok' ? ' · ' + c.status : ''), pill(c.kind === 'model' ? '模型' : '工具', c.kind === 'model' ? 'info' : ''));
      }).join('') + '</div>');
  }

  function call(m, s, a, id) {
    var c = m.idx.call.get(id);
    if (!c) return '';
    var ctx = c.context;
    return hero({ name: c.name || c.kind, role: (c.kind === 'model' ? '模型调用' : '工具调用') + ' · ' + HUB.model.name('channel', c.channelId), icon: c.kind === 'model' ? HUB.obsCards.ICON.model.replace(/16/g, '26') : HUB.obsCards.ICON.tool.replace(/16/g, '26'), color: 'var(--accent2)',
      chips: chip(c.status === 'ok' ? '成功' : c.status) + (c.repeat ? chip('重复读取') : '') }) +
      '<div class="ds">' + kv([['开始', U.fmtTime(c.start)], ['用时', U.fmtDur(c.end - c.start)], c.kind === 'model' ? ['token', U.fmtNum(c.tokensIn) + ' 进 / ' + U.fmtNum(c.tokensOut) + ' 出'] : null,
        ['输入', esc(c.input || '-')], ['输出', esc(c.output || '-')]]) + '</div>' +
      (ctx ? sec('上下文组成', stats([['任务', U.fmtNum(ctx.task)], ['共识', U.fmtNum(ctx.consensus)], ['工具结果', U.fmtNum(ctx.tools)]])) : '');
  }

  var BY_TYPE = { individual: individual, group: group, relation: relation, agg: agg, factonly: factonly, channel: channel, gate: gate, stage: stage, step: step, case: kase, run: run, decision: decision, call: call };

  /* ================= render + events ================= */
  function render(el, m, s) {
    if (!el || !m) return;
    if (host !== el) { host = el; el.addEventListener('click', onClick); el.addEventListener('keydown', onKeydown); }
    var a = HUB.model.an(s, m);
    var sel = s.selection;
    var key = m.id + '|' + m.rev + '|' + (sel ? sel.type + ':' + sel.id : '-') + '|' + s.time + '|' + s.compare + '|' + s.subject + '|' + (s.focus ? s.focus.id : '');
    if (key === last) return;
    var keepScroll = last && last.split('|').slice(0, 3).join('|') === key.split('|').slice(0, 3).join('|') ? el.scrollTop : 0;
    last = key;
    var html = '';
    try { html = sel && BY_TYPE[sel.type] ? BY_TYPE[sel.type](m, s, a, sel.id) : overview(m, s, a); }
    catch (e) { console.error('[obs.panel]', e); html = '<div class="sr-mt">这个对象的详情没画出来。</div>'; }
    if (sel && !html) html = overview(m, s, a);
    var back = sel ? '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><span class="ds-l" style="margin:0">' + esc(TYPE_ZH[sel.type] || sel.type) + '</span><a class="ob-a" data-act="clear">回到案例概况</a></div>' : '';
    el.innerHTML = back + html;
    el.scrollTop = keepScroll;
  }

  function onKeydown(e) {
    if (e.key === 'Enter' && e.target.matches('[data-say]')) {
      var b = host.querySelector('[data-act="do"][data-kind="talk"], [data-act="do"][data-kind="edit_rule"]');
      if (b) b.click();
    }
  }
  function onClick(e) {
    var t = e.target.closest('[data-act]');
    if (!t || !host.contains(t)) return;
    var act = t.getAttribute('data-act');
    var s = HUB.store.get(), m = HUB.model.current;
    if (act === 'sel') HUB.store.set({ selection: { type: t.getAttribute('data-type'), id: t.getAttribute('data-id') } }, { history: false });
    else if (act === 'clear') HUB.store.set({ selection: null }, { history: false });
    else if (act === 'focus') HUB.store.set({ focus: { type: 'case', id: t.getAttribute('data-id') }, instanceId: t.getAttribute('data-id'), subject: s.subject === 'exec' ? 'org' : s.subject, present: 'graph',
      depth: { org: Math.max(2, s.depth.org) }, selection: { type: 'case', id: t.getAttribute('data-id') } });
    else if (act === 'run') HUB.store.set({ subject: 'exec', depth: { exec: 1 }, expanded: { exec: [] }, collapsed: { exec: [] }, focus: { type: 'run', id: t.getAttribute('data-id') }, selection: { type: 'run', id: t.getAttribute('data-id') }, present: 'graph' });
    else if (act === 'toggle') { var g = m.idx.group.get(t.getAttribute('data-id')); if (g) HUB.store.toggle('org', g.id, g.level); }
    else if (act === 'replay') { if (HUB.obsTimeline) HUB.obsTimeline.replay(t.getAttribute('data-id')); }
    else if (act === 'health') {
      var hc = HUB.model.an(s, m).health.find(function (x) { return x.id === t.getAttribute('data-hid'); });
      if (hc) HUB.obsPanel.followHealth(hc);
    } else if (act === 'do') {
      var input = host.querySelector('[data-say]');
      var text = input ? input.value.trim() : '';
      var kind = t.getAttribute('data-kind');
      if ((kind === 'talk' || kind === 'interject') && !text) { if (input) { input.focus(); input.placeholder = '先写下要说的话'; } return; }
      var res = HUB.model.perform(kind, { target: { type: t.getAttribute('data-type'), id: t.getAttribute('data-id') }, text: text, docId: t.getAttribute('data-doc') || undefined });
      if (res && typeof pokazToast === 'function') pokazToast(({ delivered: '已送达', pending: '已记下，等它下一次运行时送达', recorded: '已记录' })[res.status] || '已记录');
    }
  }

  // a health item leads to the place where the problem can be seen
  function followHealth(hc) {
    var tg = hc.target || {};
    if (hc.kind === 'fact_only') HUB.store.set({ subject: 'org', present: 'graph', focus: null, depth: { org: 3 }, expanded: { org: [] }, collapsed: { org: [] }, lines: { task: true }, compare: 'both', selection: tg });
    else if (hc.kind === 'unused_relation') HUB.store.set({ subject: 'org', present: 'graph', focus: null, depth: { org: 3 }, expanded: { org: [] }, collapsed: { org: [] }, compare: 'both', selection: null });
    else if (tg.type === 'gate') HUB.store.set({ subject: 'process', present: 'graph', selection: tg });
    else if (tg.type) HUB.store.set({ selection: tg }, { history: false });
  }

  HUB.obsPanel = { render: render, followHealth: followHealth };
})();
