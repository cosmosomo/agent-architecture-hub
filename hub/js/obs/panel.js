/* HUB.obsPanel: the right sidebar in observation mode. Details of whatever is selected, in the page's own
   .ds-* vocabulary, plus the actions the person can take from here (talk, interject, re-deliver, approve, ...). */
(function () {
  'use strict';
  var HUB = (window.HUB = window.HUB || {});
  var U = HUB.util, L = U.LABELS;
  var esc = U.esc;
  var host = null, last = null;

  var TYPE_ZH = { individual: '个体', group: '分组', relation: '一条定义的线', agg: '合并的线', factonly: '编排外的交接', channel: '能力渠道', channels: '能力层',
    gate: '判断点', stage: '阶段', step: '步骤', case: '案例实例', run: '一次运行', decision: '决策', call: '调用', doc: '资料', flow: '流转', turn: '一条记录' };
  var KIND_ZH = { approval: '等你拍板', escalation: '上报给你', direction: '可以调整' };
  var DEC_ACTION_CLS = { deliver: 'good', request: 'info', yield: 'warn', escalate: 'bad', tool: 'info' };

  function nm(type, id) { return esc(U.quietEval(HUB.model.name(type, id))); }
  function link(type, id, text) { return '<a class="ob-a" data-act="sel" data-type="' + type + '" data-id="' + esc(id) + '">' + (text != null ? text : nm(type, id)) + '</a>'; }
  function pill(text, cls) { return '<span class="ob-pill ' + (cls || '') + '">' + esc(text) + '</span>'; }
  function sec(title, body, extra) { return body ? '<div class="ds' + (extra ? ' ' + extra : '') + '"><div class="ds-l">' + esc(title) + '</div>' + body + '</div>' : ''; }
  function kv(rows) { return '<dl class="ob-kv">' + rows.filter(Boolean).map(function (r) { return '<dt>' + esc(r[0]) + '</dt><dd>' + r[1] + '</dd>'; }).join('') + '</dl>'; }
  function stats(items) { return '<div class="ob-stats">' + items.map(function (x) { return '<div class="ob-stat"><b>' + esc(x[1]) + '</b><span>' + esc(x[0]) + '</span></div>'; }).join('') + '</div>'; }
  function rowItem(attrs, name, meta, lead) { return '<div class="ob-row" ' + attrs + '>' + (lead || '') + '<span class="ob-nm">' + name + '</span>' + (meta ? '<span class="ob-meta">' + esc(meta) + '</span>' : '') + '</div>'; }
  function selAttrs(type, id) { return 'data-act="sel" data-type="' + type + '" data-id="' + esc(id) + '"'; }
  // everything an orchestration object carried that the panel does not show elsewhere (docs/hub-graph-format.md: keys the page
  // does not know go to the details, so nothing parsed stays invisible); *_file keys open the attached original
  var SHOWN = { name: 1, role: 1, trigger: 1, model: 1, watches: 1, session: 1, sessions: 1 };
  function rawFields(m, attrs, tags) {
    var base = m.source && m.source.base;
    var rows = Object.keys(attrs || {}).filter(function (k) { return !SHOWN[k]; }).map(function (k) {
      var v = attrs[k];
      if (/_file$/.test(k) && typeof v === 'string' && base) return [k, '<a class="ob-a" href="' + esc(base + v) + '" target="_blank" rel="noopener">' + esc(v) + ' ↗</a>'];
      var t = typeof v === 'string' ? v : JSON.stringify(v);
      return [k, t.length > 160 ? '<details><summary>' + esc(t.slice(0, 80)) + '…</summary>' + esc(t) + '</details>' : esc(t)];
    });
    if (tags && tags.length) rows.unshift(['标签', esc(tags.map(function (t) { return '#' + t; }).join(' '))]);
    return rows.length ? sec('原始字段（编排文件里写的全部内容）', kv(rows)) : '';
  }
  function statusCls(st) { return st === 'working' ? 'good' : st === 'error' ? 'bad' : st === 'waiting' ? 'warn' : st === 'never' ? '' : ''; }
  function basis(x) { return x.basis ? pill(L.handoffBasis[x.basis], 'info') : ''; }
  function comparison(m) { return m.factSource && m.factSource.kind === 'trace' ? '（对照的是我们补写的编排，不是对方系统的原始设计）' : ''; }
  // evaluations (failure labels, outcomes) are a layer of their own: with it off, the pane keeps quiet about them too
  function evalsOn(s) { return !(s && s.overlays && s.overlays.evals === false); }
  // a name without its trailing note in brackets (imported orchestrations put remarks there, some of them evaluations)
  function shortName(n) { return HUB.collab ? HUB.collab.shortName(n) : n; }

  function hero(o) {
    var ph = o.phase ? ' ph-' + o.phase : '';
    return '<div class="ds-hero-sticky' + ph + '"><div class="ds-hero-row">' +
      '<div class="ds-avatar-orb' + ph + '" style="width:40px;height:40px;flex-shrink:0;' + (o.color ? 'color:' + o.color : '') + '">' + (o.icon || '') + '</div>' +
      '<div class="ds-hero-meta"><div class="ds-avatar-name">' + esc(U.quietEval(o.name)) + '</div><div class="ds-avatar-role">' + esc(o.role || '') + '</div>' +
      (o.chips ? '<div class="ds-hero-chips">' + o.chips + '</div>' : '') + '</div></div></div>';
  }
  function chip(text, cls) { return '<span class="ds-chip-micro' + (cls ? ' ' + cls : '') + '">' + esc(text) + '</span>'; }
  function iconFor(ind) {
    if (!ind) return '';
    if (ind.kind === 'human' || ind.kind === 'meta') return HUB.obsCards.ICON[ind.kind];
    return HUB.obsCards.agentIcon(ind.agentId, 30);
  }
  var pendingPreview = null;
  var stepSearchQuery = '';

  function renderDiffBox(pv) {
    if (!pv) return '';
    var lines = String(pv.diff || '').split('\n').map(function (ln) {
      var cls = ln.indexOf('+') === 0 && ln.indexOf('+++') !== 0 ? 'ob-diff-add'
        : ln.indexOf('-') === 0 && ln.indexOf('---') !== 0 ? 'ob-diff-del'
        : ln.indexOf('@@') === 0 || ln.indexOf('---') === 0 || ln.indexOf('+++') === 0 ? 'ob-diff-meta' : '';
      return cls ? '<span class="' + cls + '">' + esc(ln) + '</span>' : esc(ln);
    }).join('\n');
    return '<div class="ob-diff">' +
      '<div class="ob-diff-hdr"><span>待确认写回预览 · ' + esc(pv.file || 'agents/inbox.md') + '</span><span>' + esc(pv.modeLabel || '先预览后落盘') + '</span></div>' +
      '<pre class="ob-diff-pre">' + lines + '</pre>' +
      '<div class="ob-acts" style="padding:7px 10px;border-top:1px solid rgba(245,158,11,.22);background:rgba(0,0,0,.14)">' +
        '<button class="btn btn-sim" type="button" data-act="confirm-ctrl">✓ 确认写入并注入轨迹</button>' +
        '<button class="btn" type="button" data-act="export-patch">⬇ 导出补丁</button>' +
        '<button class="btn btn-d" type="button" data-act="cancel-ctrl">取消</button>' +
      '</div></div>';
  }

  function actions(target, kinds) {
    var BTN = { talk: '对话', interject: '插话（新指令）', urge: '催办', reassign: '改派任务线', edit_rule: '修改编排规则', approve: '拍板放行', pause_channel: '暂停渠道', resume_channel: '恢复渠道', assign_maint: '指派维护' };
    var needsText = kinds.some(function (k) { return k === 'talk' || k === 'interject' || k === 'edit_rule' || k === 'reassign'; });
    var pvHtml = (pendingPreview && pendingPreview.target && pendingPreview.target.type === target.type && pendingPreview.target.id === target.id)
      ? renderDiffBox(pendingPreview) : '';
    return (needsText ? '<div class="ob-say"><input type="text" data-say placeholder="输入新指令、改派目标或新规则说明…" aria-label="调控指令或规则"></div>' : '') +
      '<div class="ob-acts" style="margin-top:6px">' + kinds.map(function (k) {
        return '<button class="btn' + (k === 'approve' ? ' btn-sim' : k === 'talk' || k === 'interject' ? ' btn-p' : '') + '" type="button" data-act="do" data-kind="' + k + '" data-type="' + target.type + '" data-id="' + esc(target.id) + '">' + BTN[k] + '</button>';
      }).join('') + '</div>' +
      pvHtml +
      '<div class="ob-note" style="margin-top:6px">遵循“先预览 Diff / 载荷，确认后再落盘”安全边界：确认后同步更新画布拓扑、协作轨迹图（★ 人工调控）及本地编排/信箱文件。</div>';
  }

  /* ================= focused right-sidebar drawers ("每类信息只有一个家") ================= */
  function drawerNeeds(m, s, a) {
    var nh = a.needsHuman.map(function (x) {
      var act = x.kind === 'approval' ? '<button class="btn btn-sim" type="button" data-act="do" data-kind="approve" data-type="gate" data-id="' + esc(x.target.id) + '" style="height:24px">放行</button>' : '';
      return '<div class="ob-row" ' + selAttrs(x.target.type, x.target.id) + '>' + pill(KIND_ZH[x.kind] || x.kind, x.kind === 'approval' ? 'warn' : 'info') +
        '<span class="ob-nm ob-wrap-text">' + esc(U.quietEval(x.text)) + '</span>' + act + '</div>';
    }).join('');
    var pvHtml = (pendingPreview && pendingPreview.target && pendingPreview.target.type === 'gate') ? renderDiffBox(pendingPreview) : '';
    return hero({ name: '需要人处理的事项', role: '拍板放行 · 异常上报 · 待送达人工指令（共 ' + a.needsHuman.length + ' 项）',
      icon: HUB.obsCards.ICON.human, color: 'var(--accent3)', chips: chip(s.time == null ? '全部时间' : '截止 ' + U.fmtClock(s.time)) }) +
      sec('待处理队列（点击定位画布对象）', nh ? '<div class="ob-list">' + nh + '</div>' : '<div class="ob-note">当前没有等待人工拍板或处理的阻塞事项。</div>') +
      pvHtml;
  }

  function drawerHealth(m, s, a) {
    var health = a.health.map(function (x) {
      return '<div class="ob-row" data-act="health" data-hid="' + x.id + '"><span class="ob-sev ' + x.severity + '">' + ({ high: '高', mid: '中', low: '低' })[x.severity] + '</span><span class="ob-nm ob-wrap-text">' + esc(U.quietEval(x.text)) + '</span></div>';
    }).join('');
    return hero({ name: '架构体检与偏差诊断', role: '编排声明 vs 真实运行事实对照（共 ' + a.health.length + ' 项）',
      icon: '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 12h4l3-7 4 14 3-7h4"/></svg>', color: 'var(--accent4)' }) +
      sec('发现的架构与投递偏差（点击在画布定位）', health ? '<div class="ob-list">' + health + '</div>' : '<div class="ob-note">未发现编排与实际运行偏差。</div>') +
      (m.rootSession ? sec('根会话（页内调用树）', '<div class="ob-row" style="cursor:default"><span class="ob-nm" title="' + esc(m.rootSession) + '">' + esc((HUB.obsSessions && HUB.obsSessions.titleOf(m.rootSession)) || m.rootSession) + '</span>' +
        '<button class="btn btn-a" type="button" data-act="session" data-id="' + esc(m.rootSession) + '" style="height:24px">在画布展开 ⑤⑥</button></div>') : '');
  }

  function drawerSearch(m, s) {
    var q = stepSearchQuery.trim().toLowerCase();
    var hits = [];
    (m.facts.turns || []).forEach(function (t) {
      var txt = (t.text || '') + ' ' + (t.individualId || '');
      if (!q || txt.toLowerCase().indexOf(q) >= 0) {
        hits.push({ kind: 'turn', id: t.id, badge: 'T · #' + t.seq, title: shortName(HUB.model.name('individual', t.individualId)) + '：' + (t.text || '').slice(0, 68), meta: t.caseId });
      }
    });
    (m.facts.decisions || []).forEach(function (d) {
      var txt = (d.title || '') + ' ' + (d.reason || '') + ' ' + (d.choice || '');
      if (!q || txt.toLowerCase().indexOf(q) >= 0) {
        hits.push({ kind: 'decision', id: d.id, runId: d.runId, badge: '⑤ 决策', title: d.title || d.choice || d.id, meta: U.fmtClock(d.start) });
      }
    });
    (m.facts.calls || []).forEach(function (c) {
      var txt = (c.name || '') + ' ' + (c.input || '') + ' ' + (c.output || '');
      if (!q || txt.toLowerCase().indexOf(q) >= 0) {
        hits.push({ kind: 'call', id: c.id, badge: '⑥ 调用', title: (c.name || c.kind) + ' · ' + (c.input || '').slice(0, 48), meta: c.status });
      }
    });
    var rows = hits.slice(0, 28).map(function (h0) {
      var attr = h0.kind === 'turn' ? selAttrs('turn', h0.id) : h0.kind === 'decision' ? 'data-act="run" data-id="' + esc(h0.runId) + '"' : selAttrs('call', h0.id);
      return rowItem(attr, esc(h0.title), h0.meta, pill(h0.badge, h0.kind === 'turn' ? 'info' : 'good'));
    }).join('');
    return hero({ name: '页内全局步骤与记录检索', role: '无需跳出页面 · 直接检索发言记录(T)、决策(⑤)与工具调用(⑥)',
      icon: '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>', color: 'var(--accent1)' }) +
      '<div class="ds"><div class="ob-say"><input type="search" data-step-search value="' + esc(stepSearchQuery) + '" placeholder="输入关键词过滤发言、工具名、报错或决策理由…" aria-label="检索步骤"></div></div>' +
      sec('匹配结果（' + hits.length + ' 条，显示前 28 条）', rows ? '<div class="ob-list">' + rows + '</div>' : '<div class="ob-note">没有匹配的记录或调用步骤。</div>');
  }

  var META_POLICY_OPTS = {
    meta_approver: [
      ['all', 'all · 全自动放行读写与命令'],
      ['reads', 'reads · 仅放行只读，改文件需确认'],
      ['ask', 'ask · 全部门禁交由人工拍板']
    ],
    meta_resumer: [
      ['auto_retry_3', 'auto_retry_3 · 断网/Bug 自动断点续跑(最多3次)'],
      ['auto_retry_1', 'auto_retry_1 · 断网/Bug 自动续跑 1 次'],
      ['manual_only', 'manual_only · 仅手动点击触发断点续跑']
    ],
    meta_maint: [
      ['auto_failover', 'auto_failover · 限流/异常自动切换备用模型'],
      ['notify_only', 'notify_only · 仅标记渠道告警，不自动切模型']
    ],
    meta_auditor: [
      ['loop_guard', 'loop_guard · 连续 3 次重复报错自动注入纠偏提示'],
      ['strict_2', 'strict_2 · 连续 2 次重复报错立即熔断纠偏']
    ]
  };

  function renderMetaFleetSection(onlyId) {
    if (HUB.obsChat && HUB.obsChat.ensureConnected) HUB.obsChat.ensureConnected();
    var chatSt = HUB.obsChat && HUB.obsChat.getState ? HUB.obsChat.getState() : {};
    var allMeta = (chatSt && chatSt.metaAgents) || (HUB.obsChat && HUB.obsChat.DEFAULT_META_AGENTS) || [];
    var list = onlyId ? allMeta.filter(function (ma) { return ma.id === onlyId; }) : allMeta;
    if (!list.length) return '';

    var lead = list[0] || allMeta[0] || {};
    var chList = (chatSt && chatSt.channels && chatSt.channels.length)
      ? chatSt.channels
      : ((HUB.obsChat && HUB.obsChat.CHANNELS) || []);
    var curBrainChId = lead.brainChannel || 'zcode';
    var curBrainCh = chList.find(function (c) { return c.id === curBrainChId; }) || chList[0] || { id: 'zcode', label: 'ZCode', models: ['builtin:bigmodel-coding-plan\\GLM-5.3-Flash'] };
    var brainModels = (curBrainCh.recommendedModels && curBrainCh.recommendedModels.length)
      ? curBrainCh.recommendedModels
      : (curBrainCh.models && curBrainCh.models.length ? curBrainCh.models : [curBrainCh.defaultModel || 'default']);
    var curBrainModel = brainModels.indexOf(lead.brainModel) >= 0 ? lead.brainModel : (brainModels[0] || curBrainCh.defaultModel || '');
    var curEngineMode = lead.engineMode || 'agent_brain';
    var curPatrolSec = lead.patrolIntervalSec || 30;
    var isThinking = allMeta.some(function (ma) { return ma.runtimeStatus === 'thinking'; });

    var chOptsHtml = chList.map(function (c) {
      return '<option value="' + esc(c.id) + '"' + (c.id === curBrainCh.id ? ' selected' : '') + '>' +
        esc(c.label + ' (' + (c.vendor || c.product || c.id) + ')') + '</option>';
    }).join('');

    var modelOptsHtml = brainModels.map(function (mId) {
      return '<option value="' + esc(mId) + '"' + (mId === curBrainModel ? ' selected' : '') + '>' + esc(mId) + '</option>';
    }).join('');

    var patrolOptsHtml = [15, 30, 60].map(function (secVal) {
      return '<option value="' + secVal + '"' + (Number(curPatrolSec) === secVal ? ' selected' : '') + '>' +
        '每 ' + secVal + ' 秒后台用规则巡检一次</option>';
    }).join('');

    var brainBoxHtml =
      '<div class="ob-meta-brain-box">' +
        '<div class="ob-meta-brain-hdr">' +
          '<div class="ob-meta-brain-title">' +
            '<span class="ob-meta-brain-orb">' + (isThinking ? '⚡' : '🧠') + '</span>' +
            '<div>' +
              '<b>元智能体的诊断会话</b>' +
              '<div class="ob-meta-brain-sub">架构：后台用不调模型的规则巡检，出异常时叫一个真实智能体会话来诊断</div>' +
            '</div>' +
          '</div>' +
          '<span class="ob-pill ' + (isThinking ? 'warn' : 'good') + '">' +
            (isThinking ? '● 正在思考诊断…' : '● 常驻值守中') +
          '</span>' +
        '</div>' +
        '<div class="ob-ctrl-form" style="margin-top:8px">' +
          '<div class="ob-ctrl-row">' +
            '<span>运行模式</span>' +
            '<select data-meta-engine-mode>' +
              '<option value="agent_brain"' + (curEngineMode === 'agent_brain' ? ' selected' : '') + '>出事时叫智能体诊断，平时用规则巡检</option>' +
              '<option value="local_rules"' + (curEngineMode === 'local_rules' ? ' selected' : '') + '>只用本地规则（不调模型）</option>' +
            '</select>' +
          '</div>' +
          (curEngineMode !== 'local_rules'
            ? '<div class="ob-ctrl-row">' +
                '<span>诊断用的产品</span>' +
                '<select data-meta-brain-ch>' + chOptsHtml + '</select>' +
              '</div>' +
              '<div class="ob-ctrl-row">' +
                '<span>诊断用的模型</span>' +
                '<select data-meta-brain-model>' + modelOptsHtml + '</select>' +
              '</div>'
            : '') +
          '<div class="ob-ctrl-row">' +
            '<span>巡检频率</span>' +
            '<select data-meta-patrol-sec>' + patrolOptsHtml + '</select>' +
          '</div>' +
        '</div>' +
        '<div class="ob-acts" style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap">' +
          '<button class="btn btn-p" type="button" data-act="meta-patrol-now" title="立即唤醒元智能体的诊断会话 (' + esc(curBrainCh.label + ' · ' + curBrainModel) + ') 对当前控制室会话与 7 大渠道健康态做一次实况巡检诊断">立即叫诊断会话巡检诊断</button>' +
          '<button class="btn" type="button" data-act="meta-open-brain" title="进入元智能体的诊断会话 (meta-brain-supervisor)，查看元智能体的真实思考链与 JSON 决策产出">👁️ 查看大脑实况会话 (' + esc(lead.brainSessionName || 'meta-brain-supervisor') + ')</button>' +
        '</div>' +
      '</div>';

    var cardsHtml = list.map(function (ma) {
      var pols = META_POLICY_OPTS[ma.id] || [[ma.policy || 'auto', ma.policy || '默认策略']];
      var optsHtml = pols.map(function (p) {
        return '<option value="' + esc(p[0]) + '"' + (ma.policy === p[0] ? ' selected' : '') + '>' + esc(p[1]) + '</option>';
      }).join('');
      var resumeBtn = ma.id === 'meta_resumer'
        ? '<button class="btn btn-sim" type="button" data-act="meta-resume-now" style="height:22px;font-size:10px;padding:0 8px" title="分析当前活动会话最后的中断/报错点，立即自动发包续跑">🔄 立即断点续跑</button>'
        : '';
      var jumpBtn = !onlyId
        ? '<button class="btn" type="button" data-act="sel" data-type="individual" data-id="' + esc(ma.id) + '" style="height:22px;font-size:10px;padding:0 7px">画布定位 ↗</button>'
        : '';
      return '<div class="ob-meta-card' + (ma.enabled ? ' is-on' : ' is-off') + '" style="--ma-c:' + esc(ma.color || '#22C4E6') + '">' +
        '<div class="ob-meta-top">' +
          '<div class="ob-meta-title">' +
            '<span class="ob-meta-ic">' + esc(ma.icon || '🛡️') + '</span>' +
            '<b>' + esc(ma.shortName || ma.name) + '</b>' +
            (ma.triggerCount > 0 ? '<span class="ob-pill info">已介入 ' + ma.triggerCount + ' 次</span>' : '') +
          '</div>' +
          '<div class="ob-meta-acts">' +
            resumeBtn +
            jumpBtn +
            '<button type="button" class="ob-meta-sw' + (ma.enabled ? ' on' : '') + '" data-act="meta-toggle" data-meta-id="' + esc(ma.id) + '" title="点击开启或关闭该元智能体（画布与控制室同步生效）">' +
              (ma.enabled ? '● 已开启' : '○ 已停用') +
            '</button>' +
          '</div>' +
        '</div>' +
        '<div class="ob-meta-desc">' + esc(ma.description || ma.role || '') + '</div>' +
        '<div class="ob-meta-pol">' +
          '<span>策略档位:</span>' +
          '<select data-meta-policy="' + esc(ma.id) + '">' + optsHtml + '</select>' +
        '</div>' +
        (ma.lastActionSummary ? '<div class="ob-meta-foot">最近状态：' + esc(ma.lastActionSummary) + '</div>' : '') +
      '</div>';
    }).join('');

    var logs = (chatSt && chatSt.metaAgentLogs) || [];
    if (onlyId) logs = logs.filter(function (lg) { return (lg.agentId || lg.metaId) === onlyId; });
    var logsHtml = logs.slice(0, 8).map(function (lg) {
      var nameTxt = lg.agentName || lg.metaName || lg.agentId || lg.metaId || '元智能体';
      var detailTxt = lg.detail || lg.summary || lg.action || '';
      var brainTag = lg.brainUsed
        ? pill('' + lg.brainUsed, 'good')
        : pill(nameTxt.replace(/^元智能体\s*·\s*/, ''), 'info');
      var jumpAttr = lg.brainTraceSessionId
        ? 'data-act="session" data-id="' + esc(lg.brainTraceSessionId) + '" title="点击打开元智能体的诊断会话此次诊断的会话轨迹"'
        : 'style="cursor:default"';
      return '<div class="ob-row" ' + jumpAttr + '>' +
        brainTag +
        '<span class="ob-nm ob-wrap-text">' + esc(detailTxt) + '</span>' +
      '</div>';
    }).join('');

    return brainBoxHtml +
      '<div class="ob-meta-grid" style="margin-top:8px">' + cardsHtml + '</div>' +
      (logsHtml ? '<div class="ds-l" style="margin-top:8px">最近的巡检与介入记录</div><div class="ob-list" style="margin-top:4px">' + logsHtml + '</div>' : '');
  }

  function drawerCtrl(m, s, a) {
    var spokeSet = new Set((m.facts.turns || []).map(function (t) { return t.speaker; }));
    var inds = m.def.individuals.filter(function (x) { return x.kind !== 'human'; }).slice().sort(function (x, y) {
      return (spokeSet.has(y.id) ? 1 : 0) - (spokeSet.has(x.id) ? 1 : 0);
    });
    var allInds = m.def.individuals;
    var optsFrom = allInds.map(function (x) { return '<option value="' + esc(x.id) + '">' + esc(shortName(x.name)) + '</option>'; }).join('');
    var optsTo = inds.map(function (x) { return '<option value="' + esc(x.id) + '">' + esc(shortName(x.name)) + '</option>'; }).join('');
    var formRel = '<div class="ob-ctrl-form">' +
      '<div class="ob-ctrl-row"><span>发出方</span><select data-ctrl-from>' + optsFrom + '</select></div>' +
      '<div class="ob-ctrl-row"><span>接收方</span><select data-ctrl-to>' + (inds.length > 1 ? '<option value="' + esc(inds[1].id) + '">' + esc(shortName(inds[1].name)) + '</option>' : '') + optsTo + '</select></div>' +
      '<div class="ob-ctrl-row"><span>线类型</span><select data-ctrl-reltype><option value="task">任务派发线 (task/dispatch)</option><option value="info">信息同步线 (info/sync)</option><option value="watch">监督审计线 (watch/audit)</option></select></div>' +
      '<div class="ob-ctrl-row"><span>交接规则</span><input type="text" data-ctrl-label placeholder="例如：核验通过后移交终审报告"></div>' +
      '<div class="ob-acts"><button class="btn btn-p" type="button" data-act="preview-rel">预览 relations.md Diff</button></div>' +
    '</div>';
    var formRuntime = '<div class="ob-ctrl-form">' +
      '<div class="ob-ctrl-row"><span>目标个体</span><select data-ctrl-target>' + optsTo + '</select></div>' +
      '<div class="ob-ctrl-row"><span>调控动作</span><select data-ctrl-kind><option value="interject">★ 注入新指令 (interject → inbox.md)</option><option value="urge">催办挂起任务 (urge → inbox.md)</option><option value="edit_rule">✎ 修订流程门禁规则 (edit_rule → process.md)</option></select></div>' +
      '<div class="ob-ctrl-row"><span>指令载荷</span><input type="text" data-ctrl-text placeholder="输入写入 agents/<id>/inbox.md 的指令…"></div>' +
      '<div class="ob-acts"><button class="btn btn-sim" type="button" data-act="preview-runtime">预览信箱/规则写入 Diff</button></div>' +
    '</div>';
    var actsLog = (m.facts.actions || []).slice().reverse().map(function (ac) {
      var stCls = ac.status === 'delivered' ? 'good' : ac.status === 'pending' ? 'warn' : 'info';
      var stLbl = ac.status === 'delivered' ? '已送达/落盘' : ac.status === 'pending' ? '待送达' : '已写回';
      return '<div class="ob-row" ' + (ac.target && ac.target.id ? selAttrs(ac.target.type, ac.target.id) : 'style="cursor:default"') + '>' +
        pill('★ ' + ac.kind, 'warn') +
        '<span class="ob-nm ob-wrap-text">' + esc(ac.text || ac.kind) + '</span>' +
        pill(stLbl, stCls) + '</div>';
    }).join('');
    var chatSt = HUB.obsChat && HUB.obsChat.getState ? HUB.obsChat.getState() : {};
    var enabledMetaCount = ((chatSt && chatSt.metaAgents) || []).filter(function (ma) { return ma.enabled; }).length || 4;
    return hero({ name: '反向调控与元智能体编排台', role: '4 个元智能体值守 · 设计态 Markdown 写回 + 运行态信箱指令注入',
      icon: '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M13 2L3 14h8l-1 8 10-12h-8l1-8z"/></svg>', color: 'var(--gold)',
      chips: chip('元智能体 ' + enabledMetaCount + '/4 启用') + chip('版本 ' + (m.def.version || 'v1')) + chip('已调控 ' + (m.facts.actions || []).length + ' 次') }) +
      (pendingPreview ? renderDiffBox(pendingPreview) : '') +
      sec('0. 元智能体（自动批准、断网续跑、渠道容灾、防死循环）', renderMetaFleetSection(null)) +
      sec('1. 设计态：增补/调整画布编排连接（写回 relations.md）', formRel) +
      sec('2. 运行态：向个体信箱注入新指令（写回 agents/<id>/inbox.md）', formRuntime) +
      sec('3. 本次会话已执行的人工调控记录', actsLog ? '<div class="ob-list">' + actsLog + '</div>' : '<div class="ob-note">尚未执行人工调控。在上方预览 Diff 后点击“确认写入并注入轨迹”，画布与协作轨迹图将立即点亮金色 ★ 人工调控节点。</div>');
  }

  /* ================= per type ================= */
  function overview(m, s, a) {
    if (s.drawer === 'needs') return drawerNeeds(m, s, a);
    if (s.drawer === 'health') return drawerHealth(m, s, a);
    if (s.drawer === 'search') return drawerSearch(m, s, a);
    return drawerCtrl(m, s, a);
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
    var metaCtrlSec = x.kind === 'meta' ? sec('元智能体开关与策略', renderMetaFleetSection(id)) : '';
    var info = kv([['职责', esc(x.role || '-')], ['什么时候动', esc(x.trigger || '-')], x.tools && x.tools.length ? ['工具', esc(x.tools.join('、'))] : null,
      x.watches && x.watches.length ? ['盯着', x.watches.map(function (w) { return link('individual', w); }).join('、')] : null]);
    var dv = a.delivery[id];
    var deliv = '';
    if (dv && !HUB.model.measured(m, 'delivery')) deliv = '<div class="ob-note">当前数据源未单独采集文档级送达回执（可在协作轨迹图查看外环四态推演）。</div>';
    else if (dv) {
      var miss = dv.missing.map(function (d) {
        return '<div class="ob-row" style="cursor:default">' + pill('没送到', 'bad') + '<span class="ob-nm">' + nm('doc', d) + '</span>' +
          '<button class="btn btn-a" type="button" data-act="do" data-kind="redeliver" data-type="individual" data-id="' + esc(id) + '" data-doc="' + esc(d) + '" style="height:24px">补送</button></div>';
      }).join('');
      var ever = dv.missedEver.filter(function (d) { return dv.missing.indexOf(d) < 0; }).map(function (d) { return pill(HUB.model.name('doc', d), 'warn'); }).join(' ');
      deliv = kv([['1.该知道', dv.expected.length + ' 份'], ['2.已送到', dv.received.length + ' 份'], ['人工指令', dv.instructions + ' 条' + (dv.pending ? '（' + dv.pending + ' 条待送达）' : '')]]) +
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
      return rowItem('data-act="run" data-id="' + r.id + '"', esc(t ? t.name : '运行'), (r.caseId || '') + ' · ' + U.fmtDur(r.end - r.start),
        pill(L.outcome[r.outcome] || r.outcome, cls) + (r.mark && evalsOn(s) ? pill('标注失误', 'warn') : ''));
    }).join('');
    var msgs = m.facts.messages.filter(function (mm) { return (mm.from === id || mm.to === id) && HUB.model.visible(mm.at, s); }).slice(-6).map(function (mm) {
      return '<div class="ob-msg' + (mm.from === 'human' ? ' me' : '') + '"><small>' + nm('individual', mm.from) + ' → ' + nm('individual', mm.to) + ' · ' + U.fmtClock(mm.at) + '</small>' + esc(mm.text) + '</div>';
    }).join('');
    var acts = x.kind === 'human' ? '' : actions({ type: 'individual', id: id }, x.kind === 'meta' ? ['talk', 'interject'] : ['talk', 'interject', 'urge', 'reassign', 'edit_rule']);
    var natBlock = (x.natives || []).map(function (cid) {
      var c = m.idx.ch.get(cid) || {};
      var cs = a.channelStats[cid] || {};
      return '<div class="ob-native-card"><div class="ob-native-h">★ 专属能力 · ' + esc(c.host || '') + ' 自带</div><div class="ob-native-n">' + esc(c.name || cid) + '</div>' +
        '<div class="ob-note">' + esc(c.note || '') + '</div>' +
        (s.compare === 'def' ? '' : '<div class="ob-native-s">用过 ' + (cs.calls || 0) + ' 次' +
          (!HUB.model.measured(m, 'channel') ? ' · 并发未采集' : cs.maxWidth ? ' · 最多同时 ' + cs.maxWidth + ' 个' : '') +
          (c.limit ? ' · 上限 ' + c.limit + ' 个' : '') + '</div>') + '</div>';
    }).join('');
    // the sessions the document says this individual ran as: its trace opens right in the center canvas (⑤⑥)
    var sess = x.sessions && x.sessions.length ? x.sessions : x.session ? [x.session] : [];
    if (sess.length && HUB.obsSessions) HUB.obsSessions.warm();
    var sessBlock = sess.length ? sec('会话（编排文档里标注的本机真实会话）', '<div class="ob-list">' + sess.map(function (sid) {
      var title = HUB.obsSessions && HUB.obsSessions.titleOf(sid);
      return '<div class="ob-row" style="cursor:default"><span class="ob-nm" title="' + esc(sid) + '">' + esc(title || sid) + '</span>' +
        '<button class="btn btn-a" type="button" data-act="session" data-id="' + esc(sid) + '" style="height:24px">在画布展开 ⑤⑥</button></div>';
    }).join('') + '</div>') : '';
    var lastRun = s.compare !== 'def' ? HUB.model.latestRunOf(id, s, m) : null;
    var openChain = lastRun ? '<div class="ds"><button class="btn btn-p" type="button" data-act="run" data-id="' + lastRun.id + '">在画布展开最近一次运行的决策链 ⑤⑥</button>'
      + '<div class="ob-note" style="margin-top:5px">直接内嵌在中央画布显示调用树，双击个体也能打开，Esc 返回。</div></div>' : '';
    return h + metaCtrlSec + (natBlock ? '<div class="ds">' + natBlock + '</div>' : '') + openChain + '<div class="ds">' + info + '</div>' + sessBlock + rawFields(m, x.attributes, x.tags) +
      (s.compare !== 'def' && x.kind !== 'human' ? sec('运行', stats([['运行', st.runs || 0], ['任务', st.tasks || 0], ['token', U.fmtTokens(st.tokens)]])) : '') +
      (s.compare !== 'def' ? sec('四段送达状态（该知道 → 已送到 → 已读 → 已写）', deliv) : '') +
      sec('线', relRows ? '<div class="ob-list">' + relRows + '</div>' : '') +
      (s.compare !== 'def' ? sec('最近的运行（点一下看决策链）', runs ? '<div class="ob-list">' + runs + '</div>' : '<div class="ob-note">' + (st.status === 'never' ? esc(U.cmpWord('neverNote')) : '这个时间点之前还没有运行。') + '</div>') : '') +
      sec('反向调控与对话（agents/' + esc(id) + '/inbox.md）', (msgs ? '<div class="ob-list">' + msgs + '</div>' : '') + acts);
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
    return h + (s.compare !== 'def' ? sec('概况', stats([['成员', gs.members || 0], ['运行', gs.runs || 0], [U.cmpWord('neverStat'), gs.never || 0]])) : '') +
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
      chips: s.compare === 'def' ? '' : chip(rs.count ? '发生 ' + rs.count + ' 次' : U.cmpWord('unusedChip')) });
    var rows = hand.slice(-8).reverse().map(function (x) {
      return rowItem('data-act="focus" data-id="' + esc(x.caseId) + '"', esc(x.caseId) + ' · ' + U.fmtClock(x.at),
        (!HUB.model.measured(m, 'delivery') ? '送达未采集' : x.missing && x.missing.length ? '缺 ' + x.missing.length + ' 份' : (x.note || '')), basis(x));
    }).join('');
    return h + '<div class="ds">' + kv([['从', link(m.idx.ch.has(r.from) ? 'channel' : 'individual', r.from)], ['到', link(m.idx.ch.has(r.to) ? 'channel' : 'individual', r.to)],
      ['说明', esc(r.note || r.label || '-')], rs.first != null ? ['第一次', U.fmtClock(rs.first)] : null, rs.last != null ? ['最近一次', U.fmtClock(rs.last)] : null]) + '</div>' +
      (s.compare !== 'def' ? sec('实际发生的交接', rows ? '<div class="ob-list">' + rows + '</div>' : '<div class="ob-note">' + esc(U.cmpWord('unusedNote')) + '</div>') : '') +
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
    var h = hero({ name: HUB.model.name('individual', f.from) + ' → ' + HUB.model.name('individual', f.to), role: '编排里没有这条线，实际发生了 ' + f.count + ' 次' + comparison(m),
      icon: '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3l9 16H3z"/><path d="M12 10v4M12 17v.5"/></svg>', color: '#F97316', chips: chip(U.cmpWord('factTag')) });
    var rows = hand.slice(-8).reverse().map(function (x) { return rowItem('data-act="focus" data-id="' + esc(x.caseId) + '"', esc(x.caseId) + ' · ' + U.fmtClock(x.at), x.note || '', basis(x)); }).join('');
    return h + '<div class="ds"><div class="ds-who">' + esc(f.note || U.cmpWord('factNote')) + '</div></div>' +
      sec('发生在', '<div class="ob-list">' + rows + '</div>') +
      sec('处理', actions({ type: 'individual', id: f.from }, ['edit_rule']));
  }

  function chKindLabel(c) {
    if (c.tier === 'native') return '专属能力 · ' + (c.host || '') + ' 自带 · 只属于 ' + HUB.model.name('individual', c.owner);
    var k = (HUB.obsCards.CH_KIND || {})[c.tier === 'basic' ? 'basic' : c.kind] || '渠道';
    return k + (c.limit === 1 ? ' · 独占' : c.limit ? ' · 并发上限 ' + c.limit : ' · 不限并发');
  }
  function chIcon(c) { return (c.kind === 'model' ? HUB.obsCards.ICON.model : HUB.obsCards.ICON.tool).replace(/16/g, '26'); }

  function channel(m, s, a, id) {
    if (id === '__local') return localTools(m, s, a);
    var c = m.idx.ch.get(id);
    if (!c) return '';
    var cs = a.channelStats[id] || {};
    var measured = HUB.model.measured(m, 'channel');
    var ev = m.facts.channelEvents.filter(function (e) { return e.channelId === id && HUB.model.visible(e.at, s); }).slice(-8).reverse();
    var h = hero({ name: c.name.replace(/^(模型|工具)：/, ''), role: chKindLabel(c) + (measured ? '' : '（补写的声明）') + ' · 维护者：' + HUB.model.name('individual', c.maintainer),
      icon: chIcon(c), color: c.kind === 'function' ? 'var(--accent3)' : 'var(--accent2)', chips: chip(measured ? L.channelStatus[cs.status] || '正常' : '健康未采集') + (c.limit === 1 ? chip(measured ? '不能并发' : '不能并发（补写的声明）') : '') });
    var people = function (ids) { return ids.length ? ids.map(function (u) { return link('individual', u); }).join('、') : '-'; };
    var unit = c.kind === 'model' ? '次运行' : '次调用';
    var load = s.compare === 'def' ? '' : sec(s.time == null ? '负载（整段时间）' : '负载（截止 ' + U.fmtClock(s.time) + '）',
      stats(c.limit ? [['此刻在用', cs.active + ' / ' + c.limit], ['此刻排队', cs.waiting || 0], ['峰值', (cs.peak || 0) + ' / ' + c.limit],
        ['排过队', (cs.queued || 0) + ' ' + unit], ['共等了', U.fmtDur(cs.waitTotal || 0)], ['调用', U.fmtNum(cs.calls || 0)]]
        : [['此刻在用', cs.active || 0], ['峰值', cs.peak || 0], ['调用', U.fmtNum(cs.calls || 0)]]) +
      '<div class="ds" style="margin-top:8px">' + kv([['正在用的', people(cs.activeUsers || [])], ['在排队的', people(cs.waitingUsers || [])]]) + '</div>');
    var rows = ev.map(function (e) { return '<div class="ob-row" style="cursor:default"><span class="ob-meta">' + U.fmtClock(e.at) + '</span><span class="ob-nm ob-wrap-text">' + esc(e.note || e.kind) + '</span></div>'; }).join('');
    if (!measured && s.compare !== 'def') load = sec('负载', stats([['峰值并发', '未采集'], ['排队', '未采集'], ['调用', U.fmtNum(cs.calls || 0)]]));
    var limitInput = '<div class="ob-say"><input type="number" min="1" max="64" data-limit value="' + (c.limit || '') + '" placeholder="不限" aria-label="并发上限" style="max-width:90px">' +
      '<button class="btn" type="button" data-act="limit" data-id="' + esc(id) + '">改并发上限</button></div>';
    return h + load +
      '<div class="ds">' + kv([['容量', esc(c.capacity || '-') + (measured ? '' : '（补写的声明）')], ['额度', esc(c.quota || '-') + (measured ? '' : '（补写的声明）')], ['谁能用', people(c.users || [])]]) + '</div>' +
      sec('故障和维护', !measured ? '<div class="ob-note">未采集</div>' : rows ? '<div class="ob-list">' + rows + '</div>' : '<div class="ob-note">没有故障和维护记录。</div>') +
      sec('管理', limitInput + actions({ type: 'channel', id: id }, [cs.status === 'paused' ? 'resume_channel' : 'pause_channel', 'assign_maint']).replace(/<div class="ob-say">[\s\S]*?<\/div>/, '')) +
      '<div class="ds"><a class="ob-a" data-act="sel" data-type="channels" data-id="all">看全部渠道</a></div>';
  }

  function localTools(m, s, a) {
    var locals = m.def.channels.filter(function (c) { return c.tier === 'basic'; });
    var rows = locals.map(function (c) {
      var cs = a.channelStats[c.id] || {};
      return rowItem('style="cursor:default"', esc(c.name.replace(/^工具：/, '')), (c.users || []).length + ' 人 · ' + (s.compare === 'def' ? '' : U.fmtNum(cs.calls || 0) + ' 次'));
    }).join('');
    return hero({ name: '基础能力', role: '读写文件、改文件、命令行、创建任务：每个智能体都能做，不用维护，所以合成一个点', icon: HUB.obsCards.ICON.tool.replace(/16/g, '26'), color: 'var(--accent2)' }) +
      sec('包括', '<div class="ob-list">' + rows + '</div>') +
      '<div class="ds"><a class="ob-a" data-act="sel" data-type="channels" data-id="all">看全部渠道</a></div>';
  }

  // channel management: every channel in one table, with what needs attention first
  function channels(m, s, a) {
    var measured = HUB.model.measured(m, 'channel');
    var list = m.def.channels.filter(function (c) { return c.tier === 'shared'; });
    var natives = m.def.channels.filter(function (c) { return c.tier === 'native'; });
    var score = function (c) { var cs = a.channelStats[c.id] || {}; return (cs.status !== 'ok' ? 100 : 0) + (cs.waiting || 0) * 10 + (cs.queued || 0); };
    list.sort(function (p, q) { return score(q) - score(p); });
    var rows = list.map(function (c) {
      var cs = a.channelStats[c.id] || {};
      var load = s.compare === 'def' ? (c.limit ? '上限 ' + c.limit : '不限') : c.limit ? (s.time == null ? '峰值 ' + cs.peak + '/' + c.limit : '在用 ' + cs.active + '/' + c.limit) + (cs.queued ? ' · 排队 ' + cs.queued : '') : '不限';
      var st = cs.status && cs.status !== 'ok' ? pill(L.channelStatus[cs.status] || cs.status, 'bad') : (cs.queued ? pill('有排队', 'warn') : pill('正常', 'good'));
      if (!measured) { load = (c.limit ? '上限 ' + c.limit : '不限') + '（补写的声明）'; st = pill('健康未采集'); }
      return '<div class="ob-row" ' + selAttrs('channel', c.id) + '>' + st + '<span class="ob-nm">' + esc(c.name.replace(/^(模型|工具)：/, '')) + '</span><span class="ob-meta">' + esc(load) + ' · ' + (c.users || []).length + ' 人</span></div>';
    }).join('');
    var t = list.length, bad = list.filter(function (c) { var st = (a.channelStats[c.id] || {}).status; return st && st !== 'ok'; }).length;
    var q = U.sum(list, function (c) { return (a.channelStats[c.id] || {}).queued || 0; });
    return hero({ name: '渠道管理', role: '分三层：共享渠道（模型、功能）、专属能力（挂在个体上）、基础能力（人人都有）', icon: HUB.obsCards.ICON.model.replace(/16/g, '26'), color: 'var(--accent2)' }) +
      (s.compare !== 'def' ? sec('概况', stats([['渠道', t], ['有故障', measured ? bad : '未采集'], ['累计排队', measured ? q : '未采集']])) : '') +
      sec('共享渠道（需要处理的在前）', '<div class="ob-list">' + rows + '</div>') +
      sec('专属能力（只属于某个个体，标在它的卡片上）', natives.length ? '<div class="ob-list">' + natives.map(function (c) {
        var cs = a.channelStats[c.id] || {};
        return '<div class="ob-row" ' + selAttrs('individual', c.owner) + '><span class="ob-pill warn">★ 专属</span><span class="ob-nm">' + esc(c.name) + '</span><span class="ob-meta">' + nm('individual', c.owner) + (s.compare === 'def' ? '' : ' · 用过 ' + (cs.calls || 0) + ' 次') + '</span></div>';
      }).join('') + '</div>' : '<div class="ob-note">这个团队里没有专属能力。</div>') +
      sec('基础能力', '<div class="ob-list">' + rowItem(selAttrs('channel', '__local'), '读写文件、改文件、命令行、创建任务……', '人人都有') + '</div>') +
      '<div class="ob-note">点一条看它的负载、谁在用、谁在等，以及暂停、恢复、指派维护、改并发上限。维护者：' + link('individual', 'meta_maint') + '。</div>';
  }

  function gate(m, s, a, id) {
    var g = m.idx.gate.get(id);
    if (!g) return '';
    var gs = a.gateStats[id] || {};
    var who = g.decider.type === 'human' ? '人' : g.decider.type === 'rule' ? '规则' : HUB.model.name('individual', g.decider.who);
    var waiting = m.facts.cases.filter(function (c) { return c.waitingAt === id; });
    var h = hero({ name: g.name, role: '判断点 · 由' + who + '判断', icon: '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3l9 9-9 9-9-9z"/></svg>', color: 'var(--accent3)' });
    var paths = (g.paths || []).map(function (p) {
      var to = !p.next ? '-' : p.next === 'done' ? '完成' : HUB.model.name('stage', p.next);
      return rowItem('style="cursor:default"', esc(p.condition || '-'), '→ ' + to + (p.note ? ' · ' + p.note : ''));
    }).join('');
    return h + '<div class="ds">' + kv([['谁来判断', esc(who)], ['怎么判断', esc(g.decider.text || '-')], ['通过后', esc(g.pass === 'done' ? '完成' : HUB.model.name('stage', g.pass))],
      ['打回到', esc(g.fail ? HUB.model.name('stage', g.fail) : '-')], ['上报给', g.escalate ? '人' : '-']]) + '</div>' +
      (paths ? sec('全部出路（编排里写的）', '<div class="ob-list">' + paths + '</div>') : '') +
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

  // the outcome a recorded run carries (from-traces.js); simulated cases have none
  var RESULT_ZH = { success: ['成功', 'good'], failure: ['失败', 'warn'], unfinished: ['未完成', 'info'] };

  function kase(m, s, a, id) {
    var c = m.idx.case.get(id);
    if (!c) return '';
    var tasks = (m.idx.tasksByCase.get(id) || []).filter(function (t) { return HUB.model.visible(t.created, s); });
    var runs = (m.idx.runsByCase.get(id) || []).filter(function (r) { return HUB.model.visible(r.start, s); });
    var path = c.path.filter(function (p) { return HUB.model.visible(p.at, s); }).map(function (p) {
      return p.node === 'start' ? '开始' : p.node === 'done' ? '完成' : m.idx.stage.has(p.node) ? HUB.model.name('stage', p.node) : m.idx.gate.has(p.node) ? '◇' + HUB.model.name('gate', p.node) : p.node;
    }).join(' → ');
    var focused = s.focus && s.focus.type === 'case' && s.focus.id === id;
    var res = evalsOn(s) ? RESULT_ZH[c.result] : null;
    var annotation = '';
    if (c.mistake && evalsOn(s)) {
      var mk = c.mistake, mr = (m.idx.runsByCase.get(id) || []).find(function (r) { return r.mark === 'mistake'; });
      var label = '数据集标注：失误在' + HUB.model.name('individual', mk.individualId);
      if (mk.consistent) label += '第 ' + (mk.turnIndex + 1) + ' 条';
      else {
        label += '，步号指向第 ' + (mk.turnIndex + 1) + ' 条，该条发言者是' + (mk.actualSpeaker || '未记录') + '，与标注不一致';
      }
      annotation = sec('数据集评价', '<div class="ob-note">' + (mr ? link('run', mr.id, esc(label)) : esc(label)) + '</div>');
    }
    var hands = (m.idx.handoffsByCase.get(id) || []).filter(function (x) { return HUB.model.visible(x.at, s); }).map(function (x) {
      var tr = x.toTask ? (m.idx.runsByTask.get(x.toTask) || [])[0] : null;   // the task handed over may not have run
      return rowItem(tr ? selAttrs('run', tr.id) : 'style="cursor:default"',
        nm('individual', x.from) + ' → ' + nm('individual', x.to), U.fmtClock(x.at), basis(x));
    }).join('');
    if (c.path.length > 14) path = path.split(' → ').slice(0, 8).concat(['…（共 ' + c.path.length + ' 段，中间省略）…'], path.split(' → ').slice(-4)).join(' → ');
    // recorded facts can be read record by record in the trajectory view: the way in sits on top, like the decision chain of an individual
    var traj = HUB.obsCollab && !m.synthetic && s.subject !== 'collab' ? '<div class="ds"><button class="btn btn-p" type="button" data-act="traj" data-id="' + id + '">看协作轨迹</button>' +
      '<div class="ob-note" style="margin-top:5px">按记录先后，一条一条看谁把什么交给谁；键盘 T 也行。</div></div>' : '';
    return hero({ name: c.id + ' ' + (evalsOn(s) ? c.name : shortName(c.name)), role: '案例实例 · ' + (res ? '记录的结局：' + res[0] : (L.caseStatus[c.status] || c.status)), icon: HUB.obsAvatar.presetSvg(m.id, 30), chips: chip(U.fmtClock(c.start) + ' 开始') }) + traj +
      sec('概况', stats([['任务', tasks.length], ['运行', runs.length], ['返工', tasks.filter(function (t) { return (t.visit || 1) > 1 || t.status === 'rework'; }).length]])) +
      sec('走过的路', '<div class="ob-note">' + esc(path) + '</div>') +
      (res && c.note ? sec('结局', '<div class="ob-note">' + pill(res[0], res[1]) + ' ' + esc(c.note) + '</div>') : '') +
      annotation + sec('事实交接', hands ? '<div class="ob-list">' + hands + '</div>' : '') +
      (c.waitingAt ? sec('卡在', '<div class="ob-list">' + rowItem(selAttrs('gate', c.waitingAt), nm('gate', c.waitingAt), '等待中') + '</div>') : '') +
      '<div class="ds ob-acts">' + (focused ? '' : '<button class="btn btn-p" type="button" data-act="focus" data-id="' + id + '">在图上点亮这个案例</button>') +
      (HUB.obsTimeline && s.subject !== 'collab' ? '<button class="btn btn-sim" type="button" data-act="replay" data-id="' + id + '">回放</button>' : '') +
      '</div>';
  }

  // one recorded turn of a real trajectory (协作轨迹图): its text, what it hands off and what it catches
  var TURN_KIND = { say: '发言', think: '思考', tool: '工具返回', context: '上下文' };
  function turn(m, s, a, id) {
    var t = (m.facts.turns || []).find(function (x) { return x.id === id; });
    if (!t) return '';
    var x = m.idx.ind.get(t.individualId), c = m.idx.case.get(t.caseId);
    var sn = function (iid) { return esc(shortName(HUB.model.name('individual', iid))); };
    var tid = function (seq) { return t.caseId + '.r' + seq; };
    var hs = m.idx.handoffsByCase.get(t.caseId) || [];
    var out = hs.filter(function (hh) { return hh.sentSeq === t.seq; }).map(function (hh) {
      return rowItem(hh.gotSeq != null && hh.gotSeq !== t.seq ? selAttrs('turn', tid(hh.gotSeq)) : 'style="cursor:default"', '交给 ' + sn(hh.to),
        hh.gotSeq == null ? '对方在这份记录里没有再发言' : '第 ' + hh.gotSeq + ' 条接住', basis(hh));
    }).join('');
    var got = hs.filter(function (hh) { return hh.gotSeq === t.seq && hh.sentSeq !== t.seq; }).map(function (hh) {
      return rowItem(selAttrs('turn', tid(hh.sentSeq)), '接住 ' + sn(hh.from) + ' 的交接', '第 ' + hh.sentSeq + ' 条发出', basis(hh));
    }).join('');
    var calls = (t.calls || []).map(function (cc) { return '<div class="ob-note" style="font-family:var(--mn);overflow-wrap:anywhere">' + esc(cc.name) + '(' + esc(cc.args || '') + ')</div>'; }).join('');
    var text = t.text || '', LIMIT = 6000;
    var body = text ? '<div class="ob-note" style="white-space:pre-wrap;overflow-wrap:anywhere;max-height:46vh;overflow:auto">' + esc(text.slice(0, LIMIT)) + '</div>' +
      (text.length > LIMIT ? '<div class="ob-note" style="margin-top:4px">原文共 ' + text.length + ' 字，这里显示前 ' + LIMIT + ' 字。</div>' : '') : '<div class="ob-note">这条记录没有文字。</div>';
    var mk = c && c.mistake, marked = !!mk && evalsOn(s) && mk.turnIndex === t.sourceIndex;
    var failed = t.kind === 'tool' && /^\s*error\b\s*[:：]/i.test(text);
    return hero({ name: '第 ' + t.seq + ' 条记录', role: (TURN_KIND[t.kind] || t.kind) + ' · ' + shortName(x ? x.name : t.individualId) + ' · 案例实例 ' + t.caseId, icon: iconFor(x),
      chips: (t.kind === 'tool' ? chip(failed ? '工具返回了错误（执行时的事实）' : '工具返回') : '') + (marked ? pill('数据集标注：失误在这一条', 'warn') : '') }) +
      sec('原文', body) +
      (calls ? sec('这一条发起的工具调用（渠道线，不是交接）', calls) : '') +
      sec('交接', out || got ? '<div class="ob-list">' + out + got + '</div>' : '<div class="ob-note">这一条没有发出、也没有接住有依据的交接；和前后的记录只是先后相邻，不算交接。</div>') +
      (marked && mk.reason ? sec('数据集评价', '<div class="ob-note">' + esc(mk.reason) + '</div>') : '') +
      '<div class="ds ob-acts">' + '<button class="btn" type="button" data-act="sel" data-type="individual" data-id="' + esc(t.individualId) + '">看这个个体</button>' +
      (t.runId ? '<button class="btn btn-p" type="button" data-act="run" data-id="' + esc(t.runId) + '">打开它那次运行的决策链</button>' : '') + '</div>';
  }

  function run(m, s, a, id) {
    var r = m.idx.run.get(id);
    if (!r) return '';
    var t = m.idx.task.get(r.taskId);
    var x = m.idx.ind.get(r.individualId);
    var decs = (m.idx.decsByRun.get(id) || []);
    var cov = r.coverage || {};
    var open = s.subject === 'exec' && s.focus && s.focus.id === id;
    return hero({ name: HUB.model.name('individual', r.individualId) + ' 的一次运行', role: (t ? t.name : '') + (r.caseId ? ' · ' + r.caseId : ''), icon: iconFor(x), phase: x && x.phase,
      chips: chip(L.outcome[r.outcome] || r.outcome) + chip(U.fmtDur(r.end - r.start)) + (r.mark && evalsOn(s) ? pill('标注失误', 'warn') : '') }) +
      '<div class="ds">' + kv([['开始', U.fmtClock(r.start)], ['结束', U.fmtClock(r.end)], ['编排版本', esc(r.version || '-')], ['token', U.fmtTokens(r.tokens)],
        ['会话覆盖', '读全 ' + (cov.indexed || 0) + ' · 只看元信息 ' + (cov.metaOnly || 0) + ' · 截断 ' + (cov.truncated || 0)]]) + '</div>' +
      (open ? '<div class="ob-note">中央画布已直接内嵌展开本次运行的决策链与调用树（⑤⑥）：顶部粒度选“决策”看每个决定，选“调用”展开到每一步；点击树节点在下方查看输入输出细节。</div>'
        : sec('决策（' + decs.length + '）', '<div class="ob-list">' + decs.map(function (d) {
          return rowItem(selAttrs('decision', d.id), esc(d.title), '', pill(L.action[d.action] || d.action, DEC_ACTION_CLS[d.action]));
        }).join('') + '</div>') + '<div class="ds"><button class="btn btn-p" type="button" data-act="run" data-id="' + id + '">在画布展开决策与调用树 ⑤⑥</button></div>');
  }

  // a session from this machine, opened from the session list (HUB.obsTrace loads it)
  var STATE_ZH = { working: '在做', waiting: '等待中', failed: '出错', aborted: '被打断', stale: '疑似已退出', idle: '空闲', empty: '空' };
  function session(t) {
    var x = t.session;
    if (!x) return '<div class="ob-note">' + esc(t.error || '读取会话…') + '</div>';
    var cleanName = (HUB.obsSessions && HUB.obsSessions.titleOf && HUB.obsSessions.titleOf(t.id)) || x.title;
    var ch = HUB.obsChat && HUB.obsChat.channelForSession ? HUB.obsChat.channelForSession(x) : { id: 'codex', defaultSession: 'codex-main' };
    var chatSt = HUB.obsChat && HUB.obsChat.getState ? HUB.obsChat.getState() : {};
    var sessNameStr = (chatSt && chatSt.selectedSessionName) || (x.agent && x.agent.name) || ch.defaultSession || (ch.id + '-main');
    var activeModel = (HUB.obsChat && HUB.obsChat.activeModelFor ? HUB.obsChat.activeModelFor(x, t.id) : '') || (x.agent && x.agent.model) || '-';
    var modelList = (HUB.obsChat && HUB.obsChat.availableModelsFor ? HUB.obsChat.availableModelsFor(x, t.id) : [activeModel]);
    var canSwitchM = HUB.obsChat && HUB.obsChat.canSwitchModelFor ? HUB.obsChat.canSwitchModelFor(x, t.id) : false;
    var activeCwd = (HUB.obsChat && HUB.obsChat.activeCwdFor ? HUB.obsChat.activeCwdFor(x, t.id) : '') || x.cwd || '-';
    var cwdList = (HUB.obsChat && HUB.obsChat.availableCwdsFor ? HUB.obsChat.availableCwdsFor(x, t.id) : [activeCwd]);

    var modelCellHtml = canSwitchM && modelList.length > 1
      ? '<select class="ob-inline-select" data-panel-sess-model data-ch="' + esc(ch.id) + '" data-sess="' + esc(sessNameStr) + '" data-trace-id="' + esc(t.id) + '">' +
          modelList.map(function (mId) {
            return '<option value="' + esc(mId) + '"' + (mId === activeModel ? ' selected' : '') + '>' + esc(mId) + '</option>';
          }).join('') +
        '</select>'
      : esc(activeModel);

    var cwdCellHtml = '<select class="ob-inline-select" data-panel-sess-cwd data-ch="' + esc(ch.id) + '" data-sess="' + esc(sessNameStr) + '" data-trace-id="' + esc(t.id) + '">' +
      cwdList.map(function (dir) {
        var isSel = String(dir).toLowerCase() === String(activeCwd).toLowerCase();
        return '<option value="' + esc(dir) + '"' + (isSel ? ' selected' : '') + '>' + esc(dir === '__new__' ? '🆕 新目录（默认）' : dir) + '</option>';
      }).join('') +
      '<option value="__custom__">✎ 输入自定义工作目录路径…</option>' +
    '</select>';

    return hero({ name: cleanName, role: x.agent.product + ' · ' + (x.agent.role === 'subagent' ? '子智能体 ' + (x.agent.path || x.agent.name) : '实况会话与调用检视'),
      icon: HUB.obsCards.ICON.model.replace(/16/g, '26'), color: 'var(--accent1)', chips: chip(STATE_ZH[x.state.status] || x.state.status) + chip(x.stats.turns + ' 轮') + chip(x.stats.toolCalls + ' 工具') }) +
      '<div class="ds" style="padding-top:6px;padding-bottom:6px">' + kv([['工作目录', cwdCellHtml], ['模型', modelCellHtml],
        ['更新', esc((x.updatedAt || '').replace('T', ' ').slice(0, 16)) + ' · ' + x.stats.modelCalls + ' 模型 / ' + x.stats.toolCalls + ' 工具' + (x.stats.toolErrors ? ' (✕' + x.stats.toolErrors + ')' : '')]]) + '</div>' +
      (t.layer && t.layer.problems.length ? '<div class="ds"><div class="ds-l">没对上的记录</div>' + t.layer.problems.map(function (p) { return '<div class="ob-row" style="cursor:default">' + pill('对不上', 'warn') + '<span class="ob-nm ob-wrap-text">' + esc(p) + '</span></div>'; }).join('') + '</div>' : '') +
      (x.links.some(function (l) { return l.rel === 'child'; }) ? '<div class="ds" style="padding-top:4px;padding-bottom:6px"><button class="btn btn-p" type="button" data-act="tree" data-id="' + esc(t.id) + '">☍ 把它和子智能体画成协作图</button></div>' : '');
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
      '<div class="ds">' + kv([['开始', U.fmtTime(c.start)], [m.clock === 'ordinal' ? '发言条数' : '用时', U.fmtDur(c.end - c.start)],
        c.kind === 'model' ? ['token', c.tokensIn == null && c.tokensOut == null ? '未记录' : U.fmtTokens(c.tokensIn) + ' 进 / ' + U.fmtTokens(c.tokensOut) + ' 出'] : null,
        ['输入', esc(c.input || '-')], ['输出', esc(c.output || '-')]]) + '</div>' +
      (ctx ? sec('上下文组成', stats([['任务', U.fmtNum(ctx.task)], ['共识', U.fmtNum(ctx.consensus)], ['工具结果', U.fmtNum(ctx.tools)]])) : '');
  }

  function overviewTail() { return '<div class="ds"><a class="ob-a" data-act="unfocus">取消聚焦，回到整个案例模板</a></div>'; }

  var BY_TYPE = { individual: individual, group: group, relation: relation, agg: agg, factonly: factonly, channel: channel, channels: channels, gate: gate, stage: stage, step: step, case: kase, run: run, decision: decision, call: call, turn: turn };

  function buildSrHead(s, sel, dr) {
    var curDr = s.drawer === 'needs' || s.drawer === 'health' || s.drawer === 'search' ? s.drawer : (dr ? null : 'ctrl');
    var tabs = [['ctrl', '编排与调控'], ['needs', '● 待办'], ['health', '▲ 体检'], ['search', '⌕ 检索']].map(function (t) {
      var isOn = !sel && curDr === t[0];
      return '<button type="button" class="ob-sr-tab' + (isOn ? ' on' : '') + '" data-act="drawer-tab" data-drawer="' + t[0] + '">' + t[1] + '</button>';
    }).join('');
    var left = sel
      ? '<span class="ds-l" style="margin:0;color:var(--accent1)">' + esc(TYPE_ZH[sel.type] || sel.type) + '详情</span>' +
        '<a class="ob-a" data-act="clear" style="margin-left:8px;font-size:10px">← 调控/抽屉</a>'
      : '<div class="ob-sr-tabs">' + tabs + '</div>';
    return '<div class="ob-sr-head">' + left + '<button type="button" class="ob-sr-close" data-act="close-sr" title="收起右侧栏（Esc）">× 收起</button></div>';
  }

  /* ================= render + events ================= */
  function render(el, m, s) {
    if (!el || !m) return;
    if (host !== el) { host = el; el.addEventListener('click', onClick); el.addEventListener('keydown', onKeydown); el.addEventListener('input', onInput); el.addEventListener('change', onChange); }
    var a = HUB.model.an(s, m);
    var sel = s.selection && s.selection.type !== 'span' ? s.selection : null;
    var dr = !sel && !s.drawer && HUB.obsTrace ? HUB.obsTrace.current(s, m) : null;
    var pvSig = pendingPreview ? (pendingPreview.kind + ':' + pendingPreview.diff.length) : '';
    var chatSt = HUB.obsChat && HUB.obsChat.getState ? HUB.obsChat.getState() : null;
    var metaSig = chatSt && chatSt.metaAgents ? chatSt.metaAgents.map(function (ma) {
      return [ma.id, ma.enabled ? 1 : 0, ma.policy, ma.triggerCount || 0, ma.brainChannel || '', ma.brainModel || '', ma.engineMode || '', ma.runtimeStatus || ''].join(':');
    }).join(',') : '';
    var sessSig = dr && dr.kind === 'session' && dr.session ? ((dr.session.cwd || '') + ':' + (dr.session.agent && dr.session.agent.model || '')) : '';
    var key = m.id + '|' + m.rev + '|' + (sel ? sel.type + ':' + sel.id : '-') + '|' + (s.drawer || '') + '|' + pvSig + '|' + metaSig + '|' + sessSig + '|' + stepSearchQuery + '|' + s.time + '|' + s.compare + '|' + s.subject + '|' + (s.focus ? s.focus.id : '') + '|' + (dr && dr.kind === 'session' ? !!dr.session + (dr.error || '') : '') + '|' + (evalsOn(s) ? '' : 'noeval');
    if (key === last) return;
    var keepScroll = last && last.split('|').slice(0, 4).join('|') === key.split('|').slice(0, 4).join('|') ? el.scrollTop : 0;
    var activeSearch = document.activeElement && document.activeElement.hasAttribute && document.activeElement.hasAttribute('data-step-search');
    last = key;
    var html = '';
    var fr = dr && dr.kind === 'run' ? dr.run : null;
    var fc = !sel && !dr && !s.drawer && s.focus && s.focus.type === 'case' ? s.focus.id : null;
    try { html = sel && BY_TYPE[sel.type] ? BY_TYPE[sel.type](m, s, a, sel.id) : dr && dr.kind === 'session' ? session(dr) : fr ? run(m, s, a, fr.id) : fc ? kase(m, s, a, fc) + overviewTail() : overview(m, s, a); }
    catch (e) { console.error('[obs.panel]', e); html = '<div class="sr-mt">这个对象的详情没画出来。</div>'; }
    if (sel && !html) html = overview(m, s, a);
    el.innerHTML = buildSrHead(s, sel, dr) + html;
    el.scrollTop = keepScroll;
    if (activeSearch) {
      var inp = el.querySelector('[data-step-search]');
      if (inp) { inp.focus(); try { inp.setSelectionRange(inp.value.length, inp.value.length); } catch (e2) {} }
    }
  }

  function onChange(e) {
    if (!e.target) return;
    if (e.target.matches('[data-meta-policy]')) {
      var metaId = e.target.getAttribute('data-meta-policy');
      var pol = e.target.value;
      if (metaId && pol && HUB.obsChat && HUB.obsChat.toggleMetaAgent) {
        var patch = { policy: pol };
        if (metaId === 'meta_resumer') {
          patch.maxRetries = pol === 'auto_retry_3' ? 3 : pol === 'auto_retry_1' ? 1 : 0;
        }
        HUB.obsChat.toggleMetaAgent(metaId, patch);
        last = null;
        render(host, HUB.model.current, HUB.store.get());
      }
      return;
    }
    if (e.target.matches('[data-meta-engine-mode]')) {
      if (HUB.obsChat && HUB.obsChat.updateMetaBrain) {
        HUB.obsChat.updateMetaBrain({ engineMode: e.target.value });
        last = null;
        render(host, HUB.model.current, HUB.store.get());
      }
      return;
    }
    if (e.target.matches('[data-meta-brain-ch]')) {
      if (HUB.obsChat && HUB.obsChat.updateMetaBrain) {
        HUB.obsChat.updateMetaBrain({ brainChannel: e.target.value, brainModel: '' });
        last = null;
        render(host, HUB.model.current, HUB.store.get());
      }
      return;
    }
    if (e.target.matches('[data-meta-brain-model]')) {
      if (HUB.obsChat && HUB.obsChat.updateMetaBrain) {
        HUB.obsChat.updateMetaBrain({ brainModel: e.target.value });
        last = null;
        render(host, HUB.model.current, HUB.store.get());
      }
      return;
    }
    if (e.target.matches('[data-meta-patrol-sec]')) {
      if (HUB.obsChat && HUB.obsChat.updateMetaBrain) {
        HUB.obsChat.updateMetaBrain({ patrolIntervalSec: Number(e.target.value) || 30 });
        last = null;
        render(host, HUB.model.current, HUB.store.get());
      }
      return;
    }
    if (e.target.matches('[data-panel-sess-model]')) {
      if (HUB.obsChat && HUB.obsChat.switchModel) {
        HUB.obsChat.switchModel(
          e.target.getAttribute('data-ch'),
          e.target.getAttribute('data-sess'),
          e.target.getAttribute('data-trace-id'),
          e.target.value
        );
        last = null;
        render(host, HUB.model.current, HUB.store.get());
      }
      return;
    }
    if (e.target.matches('[data-panel-sess-cwd]')) {
      if (HUB.obsChat && HUB.obsChat.switchCwd) {
        HUB.obsChat.switchCwd(
          e.target.getAttribute('data-ch'),
          e.target.getAttribute('data-sess'),
          e.target.getAttribute('data-trace-id'),
          e.target.value
        );
        last = null;
        render(host, HUB.model.current, HUB.store.get());
      }
      return;
    }
  }

  function onInput(e) {
    if (e.target && e.target.matches('[data-step-search]')) {
      stepSearchQuery = e.target.value || '';
      last = null;
      render(host, HUB.model.current, HUB.store.get());
    }
  }

  function onKeydown(e) {
    if (e.key === 'Enter' && e.target.matches('[data-say]')) {
      var b = host.querySelector('[data-act="do"][data-kind="interject"], [data-act="do"][data-kind="talk"], [data-act="do"][data-kind="edit_rule"]');
      if (b) b.click();
    }
  }
  function onClick(e) {
    var t = e.target.closest('[data-act]');
    if (!t || !host.contains(t)) return;
    var act = t.getAttribute('data-act');
    var s = HUB.store.get(), m = HUB.model.current;
    if (act === 'sel') HUB.store.set({ selection: { type: t.getAttribute('data-type'), id: t.getAttribute('data-id') } }, { history: false });
    else if (act === 'meta-toggle') {
      var metaId = t.getAttribute('data-meta-id');
      if (metaId && HUB.obsChat && HUB.obsChat.toggleMetaAgent) {
        HUB.obsChat.toggleMetaAgent(metaId);
        last = null; render(host, m, s);
      }
    }
    else if (act === 'meta-patrol-now') {
      if (HUB.obsChat && HUB.obsChat.triggerMetaPatrolNow) {
        HUB.obsChat.triggerMetaPatrolNow();
        last = null; render(host, m, s);
      }
    }
    else if (act === 'meta-open-brain') {
      if (HUB.obsChat && HUB.obsChat.openMetaBrainSession) {
        HUB.obsChat.openMetaBrainSession();
      }
    }
    else if (act === 'meta-resume-now') {
      if (HUB.obsChat && HUB.obsChat.resumeSession) {
        var st0 = HUB.obsChat.getState ? HUB.obsChat.getState() : {};
        var cur0 = HUB.obsTrace && HUB.obsTrace.current ? HUB.obsTrace.current(s, m) : null;
        var tid0 = (cur0 && cur0.id) || (s.focus && s.focus.type === 'session' ? s.focus.id : '');
        HUB.obsChat.resumeSession(st0.selectedChannel || 'codex', st0.selectedSessionName, tid0);
      }
    }
    else if (act === 'clear') HUB.store.set({ selection: null, drawer: s.drawer || 'ctrl' }, { history: false });
    else if (act === 'close-sr') { pendingPreview = null; HUB.store.set({ selection: null, drawer: null }, { history: false }); }
    else if (act === 'drawer-tab') { pendingPreview = null; HUB.store.set({ selection: null, drawer: t.getAttribute('data-drawer') }, { history: false }); }
    else if (act === 'unfocus') HUB.store.set({ focus: null, selection: null });
    else if (act === 'focus') HUB.store.set({ focus: { type: 'case', id: t.getAttribute('data-id') }, instanceId: t.getAttribute('data-id'), subject: s.subject === 'exec' ? 'org' : s.subject, present: 'graph',
      depth: { org: Math.max(2, s.depth.org) }, selection: { type: 'case', id: t.getAttribute('data-id') } });
    else if (act === 'run') HUB.store.set({ subject: 'exec', depth: { exec: 1 }, expanded: { exec: [] }, collapsed: { exec: [] }, focus: { type: 'run', id: t.getAttribute('data-id') }, selection: { type: 'run', id: t.getAttribute('data-id') }, present: 'graph' });
    else if (act === 'toggle') { var g = m.idx.group.get(t.getAttribute('data-id')); if (g) HUB.store.toggle('org', g.id, g.level); }
    else if (act === 'replay') { if (HUB.obsTimeline) HUB.obsTimeline.replay(t.getAttribute('data-id')); }
    else if (act === 'traj') HUB.store.set({ subject: 'collab', focus: { type: 'case', id: t.getAttribute('data-id') }, instanceId: t.getAttribute('data-id'), depth: { org: 3 }, present: 'graph', time: null, selection: null });
    else if (act === 'tree') { if (HUB.obsSessions) HUB.obsSessions.openTree(t.getAttribute('data-id')); }
    else if (act === 'session') HUB.store.set({ subject: 'exec', depth: { exec: 1 }, focus: { type: 'session', id: t.getAttribute('data-id') }, selection: null, present: 'graph' });
    else if (act === 'limit') {
      var li = host.querySelector('[data-limit]');
      var res2 = HUB.model.perform('set_limit', { target: { type: 'channel', id: t.getAttribute('data-id') }, text: li ? li.value.trim() : '' });
      if (res2) HUB.shell.toast('已记为编排改动');
    }
    else if (act === 'health') {
      var hc = HUB.model.an(s, m).health.find(function (x) { return x.id === t.getAttribute('data-hid'); });
      if (hc) HUB.obsPanel.followHealth(hc);
    } else if (act === 'preview-rel') {
      var fromEl = host.querySelector('[data-ctrl-from]'), toEl = host.querySelector('[data-ctrl-to]');
      var rtypeEl = host.querySelector('[data-ctrl-reltype]'), lblEl = host.querySelector('[data-ctrl-label]');
      var fromId = fromEl ? fromEl.value : '', toId = toEl ? toEl.value : '';
      var rtype = rtypeEl ? rtypeEl.value : 'task', lbl = lblEl && lblEl.value.trim() ? lblEl.value.trim() : '协同交接与结果核验';
      pendingPreview = HUB.model.previewControl('add_relation', { target: { type: 'individual', id: fromId }, from: fromId, to: toId, relType: rtype, text: lbl });
      last = null; render(host, m, s);
    } else if (act === 'preview-runtime') {
      var tgEl = host.querySelector('[data-ctrl-target]'), kEl = host.querySelector('[data-ctrl-kind]'), txEl = host.querySelector('[data-ctrl-text]');
      var tgId = tgEl ? tgEl.value : '', kVal = kEl ? kEl.value : 'interject';
      var txVal = txEl && txEl.value.trim() ? txEl.value.trim() : (kVal === 'urge' ? '请立即汇报当前步骤阻塞点并输出阶段结论' : '请优先复核共享黑板中的待审草稿并补充验证依据');
      pendingPreview = HUB.model.previewControl(kVal, { target: { type: 'individual', id: tgId }, text: txVal });
      last = null; render(host, m, s);
    } else if (act === 'confirm-ctrl') {
      if (!pendingPreview) return;
      var pv = pendingPreview;
      pendingPreview = null;
      var res3 = HUB.model.perform(pv.kind, pv.payload);
      last = null; render(host, m, s);
      if (res3) HUB.shell.toast('✓ 已写入编排/信箱并注入 ★ 人工调控轨迹');
    } else if (act === 'cancel-ctrl') {
      pendingPreview = null;
      last = null; render(host, m, s);
    } else if (act === 'export-patch') {
      if (!pendingPreview) return;
      var blob = new Blob([pendingPreview.diff || ''], { type: 'text/plain;charset=utf-8' });
      var url = URL.createObjectURL(blob);
      var a0 = document.createElement('a');
      a0.href = url; a0.download = (m.id || 'case') + '-control.patch';
      a0.click();
      URL.revokeObjectURL(url);
      HUB.shell.toast('已导出 Markdown 补丁文件');
    } else if (act === 'do') {
      var input = host.querySelector('[data-say]');
      var text = input ? input.value.trim() : '';
      var kind = t.getAttribute('data-kind');
      var target = { type: t.getAttribute('data-type'), id: t.getAttribute('data-id') };
      var docId = t.getAttribute('data-doc') || undefined;
      if ((kind === 'talk' || kind === 'interject') && !text) {
        text = kind === 'interject' ? '请复核上一步输出并在共享黑板登记核验结论' : '请汇报当前进展与下一步计划';
      }
      if (HUB.model.previewControl && (kind === 'interject' || kind === 'reassign' || kind === 'edit_rule' || kind === 'redeliver' || kind === 'approve' || kind === 'urge')) {
        pendingPreview = HUB.model.previewControl(kind, { target: target, text: text, docId: docId });
        last = null; render(host, m, s);
        return;
      }
      var res = HUB.model.perform(kind, { target: target, text: text, docId: docId });
      if (res) HUB.shell.toast(({ delivered: '已送达', pending: '已记下，等它下一次运行时送达', recorded: '已记录' })[res.status] || '已记录');
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

  function openPreview(kind, payload) {
    if (!HUB.model.previewControl) return;
    pendingPreview = HUB.model.previewControl(kind, payload);
    last = null;
    HUB.store.set({ selection: null, drawer: 'ctrl' }, { history: false });
  }

  HUB.obsPanel = { render: render, followHealth: followHealth, openPreview: openPreview };
})();
