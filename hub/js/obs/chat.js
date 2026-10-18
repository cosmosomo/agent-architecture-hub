/* HUB.obsChat: Agent Control Room & Live Conversation Workbench.
   Unifies historical session turns, xacpx/acp-components style interactive tool cards,
   real-time SSE streaming from /api/gateway/*, Meta-Agent governance (Auto-Approve, Breakpoint Resume,
   Channel Failover, Loop Auditor), and multi-channel dispatch/queue/interrupt
   for the 6 primary channels (codex, claude, zcode, workbuddy, opencode, antigravity). */
(function () {
  'use strict';
  var HUB = (window.HUB = window.HUB || {});
  var U = HUB.util || {};
  /** Folder value meaning "start this session in a new empty folder"; the gateway creates it (2026-10-18). */
  var NEW_CWD = '__new__';
  var esc = U.esc || function (s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  };

  var CHANNELS = [
    {
      id: 'codex', label: 'Codex', vendor: 'OpenAI', color: '#10B981', sourceKind: 'codex', defaultSession: 'codex-main',
      defaultModel: 'gpt-6-luna',
      models: ['gpt-6-luna', 'gpt-6.1-sol'],
      capabilities: {
        canCreateSession: true, canSendPrompt: true, canCancelRun: true,
        canSwitchModelOnNew: true, canSwitchModelMidSession: false,
        canSetPermissionMode: true, canReadExternalSessions: true
      }
    },
    {
      id: 'claude', label: 'Claude', vendor: 'Anthropic', color: '#F59E0B', sourceKind: 'claude-code', defaultSession: 'claude-main',
      defaultModel: 'haiku',
      models: ['haiku', 'sonnet', 'opus'],
      capabilities: {
        canCreateSession: true, canSendPrompt: true, canCancelRun: true,
        canSwitchModelOnNew: true, canSwitchModelMidSession: true,
        canSetPermissionMode: true, canReadExternalSessions: true
      }
    },
    {
      id: 'zcode', label: 'ZCode', vendor: '智谱 GLM', color: '#818CF8', sourceKind: 'zcode', defaultSession: 'zcode-main',
      defaultModel: 'builtin:bigmodel-coding-plan\\GLM-5.3-Flash',
      models: [
        'builtin:bigmodel-coding-plan\\GLM-5.3-Flash',
        'builtin:bigmodel-coding-plan\\GLM-5.3',
        'new-provider-2\\ark-code-latest'
      ],
      capabilities: {
        canCreateSession: true, canSendPrompt: true, canCancelRun: true,
        canSwitchModelOnNew: true, canSwitchModelMidSession: true,
        canSetPermissionMode: false, canReadExternalSessions: true
      }
    },
    {
      id: 'workbuddy', label: 'WorkBuddy', vendor: 'CodeBuddy', color: '#06B6D4', sourceKind: 'workbuddy', defaultSession: 'workbuddy-main',
      defaultModel: 'custom-local:glm-5.3',
      models: ['custom-local:glm-5.3', 'custom-local:glm-5.3-flash'],
      capabilities: {
        canCreateSession: true, canSendPrompt: true, canCancelRun: true,
        canSwitchModelOnNew: true, canSwitchModelMidSession: true,
        canSetPermissionMode: true, canReadExternalSessions: true
      }
    },
    {
      id: 'opencode', label: 'OpenCode', vendor: 'OpenCode', color: '#A78BFA', sourceKind: 'opencode', defaultSession: 'opencode-main',
      defaultModel: 'opencode/big-pickle',
      models: [
        'opencode/big-pickle',
        'zhipuai-coding-plan/glm-5.3-flash',
        'zhipuai-coding-plan/glm-5.3',
        'zhipuai-coding-plan/glm-5.3-highspeed',
        'deepseek/deepseek-flash'
      ],
      capabilities: {
        canCreateSession: true, canSendPrompt: true, canCancelRun: true,
        canSwitchModelOnNew: true, canSwitchModelMidSession: true,
        canSetPermissionMode: true, canReadExternalSessions: true
      }
    },
    {
      id: 'antigravity', label: 'AGY', vendor: 'Google Antigravity', color: '#EC4899', sourceKind: 'antigravity', defaultSession: 'agy-main',
      defaultModel: 'pro',
      models: ['pro', 'flash', 'flash_lite'],
      capabilities: {
        canCreateSession: true, canSendPrompt: true, canCancelRun: true,
        canSwitchModelOnNew: true, canSwitchModelMidSession: false,
        canSetPermissionMode: false, canReadExternalSessions: true
      }
    },
    {
      id: 'hermes', label: 'Hermes', vendor: 'Nous Hermes', color: '#F97316', sourceKind: 'hermes', defaultSession: 'hermes-main',
      defaultModel: 'custom:glm-5.3',
      models: [
        'custom:glm-5.3',
        'custom:zai-glm-5.2:glm-5.2',
        'custom:codex-packycode:gpt-5.5',
        'custom:codex-aizzz:gpt-5.6-sol',
        'custom:aizzz-grok:grok-4.5'
      ],
      capabilities: {
        canCreateSession: true, canSendPrompt: true, canCancelRun: true,
        canSwitchModelOnNew: true, canSwitchModelMidSession: true,
        canSetPermissionMode: false, canReadExternalSessions: true
      }
    }
  ];

  var DEFAULT_META_AGENTS = [
    {
      id: 'meta_approver',
      name: '元智能体 · 自动批准督导',
      shortName: '自动批准',
      icon: '⚡',
      color: '#10B981',
      enabled: true,
      policy: 'all',
      maxRetries: 1,
      engineMode: 'agent_brain',
      brainChannel: 'zcode',
      brainModel: 'builtin:bigmodel-coding-plan\\GLM-5.3-Flash',
      brainSessionName: 'meta-brain-supervisor',
      patrolIntervalSec: 30,
      runtimeStatus: 'idle',
      role: '自动审批高信度文件读写、终端执行与子智能体派发，免去人工逐条点击确认',
      trigger: '工具请求权限或门禁待拍板时',
      triggerCount: 0,
      lastTriggeredAt: null,
      lastActionSummary: '待命（读写与命令全部自动放行）'
    },
    {
      id: 'meta_resumer',
      name: '元智能体 · 断网与Bug续跑',
      shortName: '断网/Bug续跑',
      icon: '🔄',
      color: '#06B6D4',
      enabled: true,
      policy: 'auto_retry_3',
      maxRetries: 3,
      engineMode: 'agent_brain',
      brainChannel: 'zcode',
      brainModel: 'builtin:bigmodel-coding-plan\\GLM-5.3-Flash',
      brainSessionName: 'meta-brain-supervisor',
      patrolIntervalSec: 30,
      runtimeStatus: 'idle',
      role: '实时监测断网、API 超时、进程崩溃与异常中断，唤醒元智能体的诊断会话分析断点并自动续跑',
      trigger: '心跳超时、网络断开或异常退出时',
      triggerCount: 0,
      lastTriggeredAt: null,
      lastActionSummary: '看着七个产品的连接和中断'
    },
    {
      id: 'meta_maint',
      name: '元智能体 · 渠道容灾',
      shortName: '渠道容灾',
      icon: '🛡️',
      color: '#F59E0B',
      enabled: true,
      policy: 'auto_failover',
      maxRetries: 2,
      engineMode: 'agent_brain',
      brainChannel: 'zcode',
      brainModel: 'builtin:bigmodel-coding-plan\\GLM-5.3-Flash',
      brainSessionName: 'meta-brain-supervisor',
      patrolIntervalSec: 30,
      runtimeStatus: 'idle',
      role: '后台定时巡检七个产品的并发、配额与限流，出事时叫指定的智能体诊断，并换到备用模型',
      trigger: '定时巡检、429 限流或模型拒绝响应时',
      triggerCount: 0,
      lastTriggeredAt: null,
      lastActionSummary: '后台定时巡检七个产品的负载与配额'
    },
    {
      id: 'meta_auditor',
      name: '元智能体 · 防死循环督导',
      shortName: '防死循环',
      icon: '🧭',
      color: '#A78BFA',
      enabled: true,
      policy: 'loop_guard',
      maxRetries: 2,
      engineMode: 'agent_brain',
      brainChannel: 'zcode',
      brainModel: 'builtin:bigmodel-coding-plan\\GLM-5.3-Flash',
      brainSessionName: 'meta-brain-supervisor',
      patrolIntervalSec: 30,
      runtimeStatus: 'idle',
      role: '检测连续重复工具调用或无效重试，唤醒元智能体的诊断会话注入纠偏提示词防止空转消耗 Token',
      trigger: '连续 3 次重复报错或轨迹停滞时',
      triggerCount: 0,
      lastTriggeredAt: null,
      lastActionSummary: '监测重复工具报错与死循环空转'
    }
  ];

  var DEFAULT_TURN_LIMIT = 18;

  var QUICK_PROMPTS = [
    { label: '自报家门', text: '请用一句话汇报你的渠道身份、当前模型和工作目录。' },
    { label: '📋 总结进展', text: '请简要总结当前会话已完成的工作、关键结论以及下一步建议。' },
    { label: '🩺 诊断问题', text: '请检查当前工作区最近的改动或报错，给出根因定位与修复建议。' },
    { label: '🔎 梳理架构', text: '请梳理当前目录的核心模块结构与关键入口文件。' }
  ];

  var state = {
    connected: false,
    channels: CHANNELS.map(function (c) { return Object.assign({ status: 'idle', sessionCount: 0 }, c); }),
    sessions: [],
    workspaceDirs: [
      'e:\\program\\GIT\\Agent\\multi\\Agent-Architecture-Hub',
      'e:\\program\\GIT\\Agent\\multi',
      'E:\\program\\GIT\\Agent\\agent-hub',
      'E:\\program\\sota'
    ],
    metaAgents: DEFAULT_META_AGENTS.map(function (m) { return Object.assign({}, m); }),
    metaAgentLogs: [],
    activeRuns: {},   // key -> LiveRunState
    queues: {},       // key -> QueuedPrompt[]
    selectedChannel: 'codex',
    selectedSessionName: '',
    selectedModels: {}, // slotKey or channelId -> model
    selectedCwds: {},   // slotKey or channelId -> cwd
    permissions: 'reads',
    draftText: '',
    autoFollow: true,
    visibleTurnLimit: DEFAULT_TURN_LIMIT,
    expandedCtx: {},       // turnId -> boolean
    expandedThink: {},     // stepId -> boolean
    expandedTools: {},     // groupKey -> boolean
    expandedTurnSteps: {}, // turnId -> 'open' | 'closed'
    lastSessionId: '',
    lastRenderKey: '',
    pendingSwitchTraceId: ''
  };

  var hostEl = null;
  var streamSource = null;
  var pollTimer = null;
  var boundHost = new WeakSet();

  function normalizeSessions(list) {
    if (!Array.isArray(list)) return [];
    return list.map(function (s) {
      return Object.assign({}, s, { channelId: s.channelId || s.channel || 'codex' });
    });
  }

  function normalizeChannels(list) {
    if (!Array.isArray(list) || !list.length) {
      return CHANNELS.map(function (c) { return Object.assign({ status: 'idle', sessionCount: 0 }, c); });
    }
    return CHANNELS.map(function (base) {
      var srv = list.find(function (x) { return x && (x.id === base.id || x.traceKind === base.sourceKind); }) || {};
      var verifiedModels = (Array.isArray(srv.recommendedModels) && srv.recommendedModels.length)
        ? srv.recommendedModels.slice()
        : (base.models || []).slice();
      return Object.assign({}, base, srv, {
        id: base.id,
        label: base.label,
        vendor: base.vendor,
        color: base.color,
        defaultModel: srv.defaultModel || base.defaultModel,
        models: verifiedModels,
        recommendedModels: verifiedModels,
        capabilities: Object.assign({}, base.capabilities || {}, srv.capabilities || {}),
        status: srv.status || 'idle',
        sessionCount: Array.isArray(srv.sessions) ? srv.sessions.length : (srv.sessionCount || 0)
      });
    });
  }

  function channelById(id) {
    var norm = String(id || '').toLowerCase();
    if (norm === 'claude-code') norm = 'claude';
    if (norm === 'agy') norm = 'antigravity';
    if (norm === 'codebuddy') norm = 'workbuddy';
    if (norm === 'hermes-agent') norm = 'hermes';
    return state.channels.find(function (c) { return c.id === norm || c.sourceKind === norm; }) ||
      CHANNELS.find(function (c) { return c.id === norm || c.sourceKind === norm; }) ||
      CHANNELS[0];
  }

  function channelForSession(session) {
    if (!session) return channelById(state.selectedChannel);
    var sid = String(session.id || '');
    if (sid.indexOf('new:') === 0) {
      var parts = sid.split(':');
      if (parts[1]) return channelById(parts[1]);
    }
    if (sid.indexOf('antigravity:') === 0 || sid.indexOf('agy:') === 0) return channelById('antigravity');
    if (sid.indexOf('workbuddy:') === 0) return channelById('workbuddy');
    if (sid.indexOf('hermes:') === 0) return channelById('hermes');
    var sk = String((session.source && session.source.kind) || '').toLowerCase();
    var prod = String((session.agent && session.agent.product) || '').toLowerCase();
    var orig = String((session.agent && session.agent.originator) || '').toLowerCase();
    if (sk === 'antigravity' || prod.indexOf('antigravity') >= 0 || orig === 'antigravity') return channelById('antigravity');
    if (sk === 'workbuddy' || prod.indexOf('workbuddy') >= 0 || orig === 'workbuddy') return channelById('workbuddy');
    if (sk === 'hermes' || prod.indexOf('hermes') >= 0 || orig === 'hermes') return channelById('hermes');
    if (sk === 'acpx') return channelById(prod || orig || state.selectedChannel);
    return channelById(sk || prod || orig || state.selectedChannel);
  }

  function slotKey(chId, sessName) {
    return chId + ':' + sessName;
  }

  /* Match a trace session (e.g. codex:01a139b6-... or new:workbuddy:wb-1) to its acpx session record if any */
  function matchAcpxRecord(session, targetId) {
    var sid = targetId || (session && session.id) || '';
    if (!sid) return null;
    if (sid.indexOf('new:') === 0) {
      var sp = sid.split(':');
      var nCh = sp[1] || '';
      var nName = sp.slice(2).join(':');
      return state.sessions.find(function (s) {
        return s.channelId === nCh && s.sessionName === nName;
      }) || null;
    }
    var rawId = sid.indexOf(':') >= 0 ? sid.split(':').slice(1).join(':') : sid;
    var found = state.sessions.find(function (s) {
      return s.traceSessionId === sid ||
        ('acpx:' + s.acpxRecordId) === sid ||
        s.acpxRecordId === sid ||
        s.acpxRecordId === rawId ||
        s.acpSessionId === rawId;
    });
    return found || null;
  }

  function availableModelsFor(session, targetId) {
    var ch = channelForSession(session);
    var gwCh = state.channels.find(function (x) { return x.id === ch.id; }) || ch;
    var verified = (Array.isArray(gwCh.recommendedModels) && gwCh.recommendedModels.length)
      ? gwCh.recommendedModels
      : (Array.isArray(gwCh.models) && gwCh.models.length ? gwCh.models : (ch.models || [ch.defaultModel]));
    var list = [];
    verified.forEach(function (m) {
      if (m && typeof m === 'string' && list.indexOf(m) < 0) list.push(m);
    });
    if (!list.length && ch.defaultModel) list.push(ch.defaultModel);
    return list;
  }

  function activeModelFor(session, targetId) {
    var ch = channelForSession(session);
    var gwCh = state.channels.find(function (x) { return x.id === ch.id; }) || ch;
    var verified = availableModelsFor(session, targetId);
    var rec = matchAcpxRecord(session, targetId);
    var sessName = state.selectedSessionName || (rec && rec.sessionName) || ch.defaultSession;
    var sk = slotKey(ch.id, sessName);
    var candidates = [
      state.selectedModels[sk],
      rec && rec.currentModel,
      state.selectedModels[ch.id],
      session && session.agent && session.agent.model,
      gwCh && gwCh.currentModel,
      gwCh && gwCh.defaultModel,
      ch.defaultModel
    ];
    for (var i = 0; i < candidates.length; i++) {
      var c = candidates[i];
      if (c && verified.indexOf(c) >= 0) return c;
    }
    return verified[0] || ch.defaultModel || 'default';
  }

  function capabilitiesFor(session, targetId) {
    var ch = channelForSession(session);
    var gwCh = state.channels.find(function (x) { return x.id === ch.id; }) || ch;
    var baseCaps = Object.assign({
      canCreateSession: true,
      canSendPrompt: true,
      canCancelRun: true,
      canSwitchModelOnNew: false,
      canSwitchModelMidSession: false,
      canSetPermissionMode: false,
      canReadExternalSessions: true
    }, ch.capabilities || {}, gwCh.capabilities || {});
    var models = availableModelsFor(session, targetId);
    var sid = String(targetId || (session && session.id) || '');
    var turns = (session && Array.isArray(session.turns)) ? session.turns : [];
    var isNewOrEmpty = sid.indexOf('new:') === 0 || turns.length === 0;
    var canSwitchModel = models.length > 1 && (isNewOrEmpty ? !!baseCaps.canSwitchModelOnNew : !!baseCaps.canSwitchModelMidSession);
    return Object.assign({}, baseCaps, {
      canSwitchModel: canSwitchModel,
      isNewOrEmpty: isNewOrEmpty
    });
  }

  function canSwitchModelFor(session, targetId) {
    return capabilitiesFor(session, targetId).canSwitchModel;
  }

  function switchModel(channelId, sessName, traceSessionId, newModel) {
    var model = String(newModel || '').trim();
    if (!model) return;
    var ch = channelById(channelId || state.selectedChannel);
    var sName = sessName || state.selectedSessionName || ch.defaultSession;
    var sk = slotKey(ch.id, sName);
    state.selectedModels[sk] = model;
    state.selectedModels[ch.id] = model;
    state.lastRenderKey = '';

    // Update local session record in-place so Header & Chat immediately reflect the new model
    var rec = state.sessions.find(function (s) { return s.channelId === ch.id && s.sessionName === sName; });
    if (rec) {
      rec.currentModel = model;
      if (Array.isArray(rec.availableModels) && rec.availableModels.indexOf(model) < 0) {
        rec.availableModels.unshift(model);
      }
    }
    if (HUB.obsTrace && HUB.obsTrace.current && HUB.store && HUB.model) {
      var cur = HUB.obsTrace.current(HUB.store.get(), HUB.model.current);
      if (cur && cur.session && cur.session.agent) {
        cur.session.agent.model = model;
      }
    }

    if (HUB.obsTrace && HUB.obsTrace.render && HUB.store && HUB.model) {
      HUB.obsTrace.render(HUB.store.get(), HUB.model.current);
    } else {
      refreshUI();
    }

    if (HUB.shell && HUB.shell.toast) {
      HUB.shell.toast('已将 ' + ch.label + ' (' + sName + ') 模型切换为: ' + model);
    }

    if (typeof window !== 'undefined' && window.fetch && location && (location.protocol === 'http:' || location.protocol === 'https:')) {
      fetch('/api/gateway/model', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel: ch.id,
          sessionName: sName,
          traceSessionId: traceSessionId || undefined,
          model: model
        })
      }).then(function () {
        fetchGatewayState();
      }).catch(function () {});
    }
  }

  function availableCwdsFor(session, targetId) {
    var list = [];
    var add = function (p) {
      var clean = String(p || '').trim();
      if (!clean) return;
      var norm = clean.toLowerCase();
      if (!list.some(function (x) { return x.toLowerCase() === norm; })) {
        list.push(clean);
      }
    };
    // '__new__' asks the gateway for a new empty folder; it is the default for a session that has none.
    add(NEW_CWD);
    if (session && session.cwd) add(session.cwd);
    var rec = matchAcpxRecord(session, targetId);
    if (rec && rec.cwd) add(rec.cwd);
    (state.workspaceDirs || []).forEach(add);
    Object.keys(state.selectedCwds || {}).forEach(function (k) { add(state.selectedCwds[k]); });
    return list;
  }

  function activeCwdFor(session, targetId) {
    var ch = channelForSession(session);
    var gwCh = state.channels.find(function (x) { return x.id === ch.id; }) || ch;
    var rec = matchAcpxRecord(session, targetId);
    var sessName = state.selectedSessionName || (rec && rec.sessionName) || ch.defaultSession;
    var sk = slotKey(ch.id, sessName);
    // A session keeps its own folder; a session without one gets a new folder. The channel's last folder
    // and the hub's own repository are no longer defaults (2026-10-18).
    var picked = state.selectedCwds[sk];
    if (picked && picked !== NEW_CWD) return picked;
    return (rec && rec.cwd) || (session && session.cwd) || NEW_CWD;
  }

  function switchCwd(channelId, sessName, traceSessionId, newCwd) {
    var cwd = String(newCwd || '').trim();
    if (!cwd) return;
    if (cwd === '__custom__') {
      var curCwd = activeCwdFor(null, traceSessionId);
      var input = typeof window !== 'undefined' && window.prompt
        ? window.prompt('请输入要切换的本机工作目录绝对路径（例如 E:\\program\\GIT\\Agent\\multi）：', curCwd)
        : '';
      if (!input || !input.trim()) {
        refreshUI();
        return;
      }
      cwd = input.trim();
    }
    var ch = channelById(channelId || state.selectedChannel);
    var sName = sessName || state.selectedSessionName || ch.defaultSession;
    var sk = slotKey(ch.id, sName);
    if (cwd === NEW_CWD) {
      // Nothing to tell the gateway yet: it makes the folder when this session first runs.
      state.selectedCwds[sk] = NEW_CWD;
      state.lastRenderKey = '';
      refreshUI();
      if (HUB.shell && HUB.shell.toast) HUB.shell.toast('📁 ' + ch.label + ' (' + sName + ') 将在一个新目录里开始');
      return;
    }
    state.selectedCwds[sk] = cwd;
    state.selectedCwds[ch.id] = cwd;
    if (state.workspaceDirs.indexOf(cwd) < 0) state.workspaceDirs.unshift(cwd);
    state.lastRenderKey = '';

    var rec = state.sessions.find(function (s) { return s.channelId === ch.id && s.sessionName === sName; });
    if (rec) rec.cwd = cwd;
    if (HUB.obsTrace && HUB.obsTrace.current && HUB.store && HUB.model) {
      var cur = HUB.obsTrace.current(HUB.store.get(), HUB.model.current);
      if (cur && cur.session) cur.session.cwd = cwd;
    }

    if (HUB.obsTrace && HUB.obsTrace.render && HUB.store && HUB.model) {
      HUB.obsTrace.render(HUB.store.get(), HUB.model.current);
    } else {
      refreshUI();
    }

    if (HUB.shell && HUB.shell.toast) {
      HUB.shell.toast('📁 已将 ' + ch.label + ' (' + sName + ') 工作目录切换为: ' + cwd);
    }

    if (typeof window !== 'undefined' && window.fetch && location && (location.protocol === 'http:' || location.protocol === 'https:')) {
      fetch('/api/gateway/cwd', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel: ch.id,
          sessionName: sName,
          traceSessionId: traceSessionId || undefined,
          cwd: cwd
        })
      })
        .then(function (r) { return r.json(); })
        .then(function (res) {
          if (res && !res.ok && res.error && HUB.shell && HUB.shell.toast) {
            HUB.shell.toast('✕ 工作目录切换失败: ' + res.error);
          }
          fetchGatewayState();
        })
        .catch(function () {});
    }
  }

  function activeRunFor(session, targetId) {
    var rec = matchAcpxRecord(session, targetId);
    var ch = channelForSession(session);
    var sessName = state.selectedSessionName || (rec && rec.sessionName) || ch.defaultSession;
    var k = slotKey(ch.id, sessName);
    if (state.activeRuns[k] && state.activeRuns[k].status === 'running') return state.activeRuns[k];
    var keys = Object.keys(state.activeRuns);
    for (var i = 0; i < keys.length; i++) {
      var r = state.activeRuns[keys[i]];
      if (r && r.status === 'running') {
        if (targetId && r.traceSessionId === targetId) return r;
        if (rec && r.sessionName === rec.sessionName && (r.channelId || r.channel) === rec.channelId) return r;
      }
    }
    return null;
  }

  function queueFor(session, targetId) {
    var rec = matchAcpxRecord(session, targetId);
    var ch = channelForSession(session);
    var sessName = state.selectedSessionName || (rec && rec.sessionName) || ch.defaultSession;
    var k = slotKey(ch.id, sessName);
    return state.queues[k] || [];
  }

  function normalizeMetaAgents(list) {
    if (!Array.isArray(list) || !list.length) {
      return DEFAULT_META_AGENTS.map(function (m) { return Object.assign({}, m); });
    }
    return DEFAULT_META_AGENTS.map(function (base) {
      var srv = list.find(function (x) { return x && x.id === base.id; }) || {};
      return Object.assign({}, base, srv);
    });
  }

  function isMetaEnabled(id) {
    var found = (state.metaAgents || []).find(function (m) { return m.id === id; });
    return found ? !!found.enabled : true;
  }

  function toggleMetaAgent(id, patch) {
    var idx = (state.metaAgents || []).findIndex(function (m) { return m.id === id; });
    if (idx < 0) return;
    var cur = state.metaAgents[idx];
    var nextPatch = patch && typeof patch === 'object' ? patch : { enabled: !cur.enabled };
    var next = Object.assign({}, cur, nextPatch);
    state.metaAgents[idx] = next;
    if (id === 'meta_approver') {
      state.permissions = (next.enabled && next.policy === 'all') ? 'all' : 'reads';
    }
    state.lastRenderKey = '';
    refreshUI();
    if (HUB.model && HUB.model.current) {
      HUB.model.current.rev = (HUB.model.current.rev || 0) + 1;
    }
    if (HUB.store && HUB.store.bump) {
      HUB.store.bump();
    }
    if (HUB.shell && HUB.shell.toast) {
      HUB.shell.toast(
        next.icon + ' ' + next.shortName + '：' +
        (next.enabled ? '已开启值守 (' + (next.policy || 'auto') + ')' : '已暂停值守')
      );
    }
    if (typeof window !== 'undefined' && window.fetch && location && (location.protocol === 'http:' || location.protocol === 'https:')) {
      fetch('/api/gateway/meta-agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Object.assign({ id: id }, nextPatch))
      }).then(function () {
        fetchGatewayState();
      }).catch(function () {});
    }
  }

  /* Update the shared Meta-Agent Supervisor Brain configuration (Agent channel + Model + Engine Mode + Patrol Interval) across all 4 meta-agents */
  function updateMetaBrain(patch) {
    if (!patch || typeof patch !== 'object') return;
    var nextPatch = Object.assign({ id: 'meta_maint', applyToAll: true }, patch);
    if (nextPatch.brainChannel && !nextPatch.brainModel) {
      var bCh = channelById(nextPatch.brainChannel);
      nextPatch.brainModel = bCh.defaultModel;
    }
    state.metaAgents = (state.metaAgents || []).map(function (ma) {
      return Object.assign({}, ma, nextPatch);
    });
    state.lastRenderKey = '';
    refreshUI();
    if (HUB.store && HUB.store.bump) HUB.store.bump();
    var first = state.metaAgents[0] || DEFAULT_META_AGENTS[2];
    var bChObj = channelById(first.brainChannel || 'zcode');
    if (HUB.shell && HUB.shell.toast) {
      HUB.shell.toast(
        '元智能体的诊断会话已更新：' +
        (first.engineMode === 'local_rules'
          ? '只用本地规则（不调模型）'
          : bChObj.label + ' · ' + (first.brainModel || bChObj.defaultModel))
      );
    }
    if (typeof window !== 'undefined' && window.fetch && location && (location.protocol === 'http:' || location.protocol === 'https:')) {
      fetch('/api/gateway/meta-agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nextPatch)
      }).then(function () {
        fetchGatewayState();
      }).catch(function () {});
    }
  }

  /* Immediately wake up the real Agent + Model brain to patrol and diagnose the current channel/session */
  function triggerMetaPatrolNow(customSummary) {
    var first = (state.metaAgents && state.metaAgents[0]) || DEFAULT_META_AGENTS[2];
    var bCh = channelById(first.brainChannel || 'zcode');
    var bModel = first.brainModel || bCh.defaultModel;
    var targetCh = state.selectedChannel || 'codex';
    var targetSess = state.selectedSessionName || ('hub-' + targetCh);
    state.metaAgents = (state.metaAgents || []).map(function (ma) {
      return Object.assign({}, ma, { runtimeStatus: 'thinking' });
    });
    state.lastRenderKey = '';
    refreshUI();
    if (HUB.store && HUB.store.bump) HUB.store.bump();
    if (HUB.shell && HUB.shell.toast) {
      HUB.shell.toast('正在唤醒元智能体的诊断会话 (' + bCh.label + ' · ' + bModel + ') 巡检诊断 ' + targetCh + ':' + targetSess + '…');
    }
    if (typeof window === 'undefined' || !window.fetch) return Promise.resolve();
    return fetch('/api/gateway/meta-agents/patrol', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agentId: 'meta_maint',
        eventKind: 'manual_patrol',
        targetChannel: targetCh,
        targetSession: targetSess,
        errorSummary: customSummary || ('请对当前控制室焦点会话 ' + targetCh + ':' + targetSess + ' 及七个产品的运行状态执行一次快速巡检诊断，并给出维护建议。')
      })
    })
      .then(function (r) { return r.json(); })
      .then(function (res) {
        fetchGatewayState();
        if (res && res.ok && HUB.shell && HUB.shell.toast) {
          HUB.shell.toast('✓ 元智能体的诊断会话巡检完毕 [' + (res.action || 'standby') + ']：' + (res.reason || '系统运行健康'));
        }
        return res;
      })
      .catch(function (err) {
        fetchGatewayState();
        if (HUB.shell && HUB.shell.toast) {
          HUB.shell.toast('✕ 元智能体的诊断会话巡检唤醒异常：' + err.message);
        }
      });
  }

  /* Open the dedicated brain coordination session (`meta-brain-supervisor`) in the Control Room */
  function openMetaBrainSession() {
    var first = (state.metaAgents && state.metaAgents[0]) || DEFAULT_META_AGENTS[2];
    var bCh = channelById(first.brainChannel || 'zcode');
    var bSessName = first.brainSessionName || 'meta-brain-supervisor';
    var existing = state.sessions.find(function (s) {
      return s.sessionName === bSessName || (s.channelId === bCh.id && s.sessionName.indexOf('meta-brain') === 0);
    });
    var traceId = (existing && existing.traceSessionId) || first.lastBrainSessionId || ('new:' + bCh.id + ':' + bSessName);
    state.selectedChannel = bCh.id;
    state.selectedSessionName = bSessName;
    state.lastSessionId = traceId;
    state.lastRenderKey = '';
    if (HUB.store) {
      HUB.store.set({ subject: 'exec', depth: { exec: 1 }, focus: { type: 'session', id: traceId }, selection: null, present: 'graph' });
    } else {
      refreshUI(true);
    }
    if (HUB.shell && HUB.shell.toast) {
      HUB.shell.toast('👁️ 已进入元智能体的诊断会话 (' + bCh.label + ' · ' + bSessName + ')');
    }
  }

  function resumeSession(channelId, sessName, traceSessionId, customReason) {
    var ch = channelById(channelId || state.selectedChannel);
    var sName = sessName || state.selectedSessionName || ch.defaultSession;
    if (HUB.shell && HUB.shell.toast) {
      HUB.shell.toast('🔄 正在调用【断网与Bug续跑元智能体】分析断点并恢复 ' + ch.label + ' (' + sName + ')…');
    }
    if (typeof window === 'undefined' || !window.fetch) return Promise.resolve();
    return fetch('/api/gateway/resume', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channel: ch.id,
        sessionName: sName,
        traceSessionId: traceSessionId || undefined,
        reason: customReason || 'Web 控制室手动触发断点续跑'
      })
    })
      .then(function (r) { return r.json(); })
      .then(function (res) {
        if (!res || !res.ok) throw new Error((res && res.error) || '断点续跑触发失败');
        if (HUB.shell && HUB.shell.toast) {
          HUB.shell.toast('✓ 断点续跑已启动：' + (res.resumedFrom || (ch.label + ':' + sName)));
        }
        fetchGatewayState();
        refreshUI(true);
        return res;
      })
      .catch(function (err) {
        if (HUB.shell && HUB.shell.toast) {
          HUB.shell.toast('✕ 断点续跑失败：' + err.message);
        }
      });
  }

  /* Cross-Channel Session Handoff: Transfer current session context & cwd to another Agent channel */
  function handoffSession(toChannelId, customInstruction) {
    if (!toChannelId) return Promise.resolve();
    var fromCh = channelById(state.selectedChannel);
    var toCh = channelById(toChannelId);
    var cur = HUB.obsTrace && HUB.obsTrace.current ? HUB.obsTrace.current(HUB.store.get(), HUB.model.current) : null;
    var sess = cur && cur.session ? cur.session : null;
    var fromTid = (cur && cur.id) || (sess && sess.id) || state.lastSessionId || '';
    var fromSessName = state.selectedSessionName || fromCh.defaultSession;
    if (HUB.shell && HUB.shell.toast) {
      HUB.shell.toast('↗ 正在将 ' + fromCh.label + ' (' + fromSessName + ') 上下文与工作目录转交至 ' + toCh.label + ' 接力执行…');
    }
    if (typeof window === 'undefined' || !window.fetch) return Promise.resolve();
    return fetch('/api/gateway/handoff', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fromChannel: fromCh.id,
        fromSessionName: fromSessName,
        fromTraceId: fromTid || undefined,
        toChannel: toCh.id,
        customInstruction: customInstruction || undefined,
        wait: false
      })
    })
      .then(function (r) { return r.json(); })
      .then(function (res) {
        if (!res || !res.ok) throw new Error((res && res.error) || '跨渠道转交失败');
        var newTraceId = res.traceSessionId || ('new:' + toCh.id + ':' + res.toSessionName);
        state.selectedChannel = toCh.id;
        state.selectedSessionName = res.toSessionName;
        state.lastSessionId = newTraceId;
        state.lastRenderKey = '';
        if (HUB.store) {
          HUB.store.set({ subject: 'exec', depth: { exec: 1 }, focus: { type: 'session', id: newTraceId }, selection: null, present: 'graph' });
        }
        fetchGatewayState();
        refreshUI(true);
        if (HUB.shell && HUB.shell.toast) {
          HUB.shell.toast('✓ 已由 ' + toCh.label + ' (' + res.toSessionName + ') 接手并开始执行！');
        }
        return res;
      })
      .catch(function (err) {
        if (HUB.shell && HUB.shell.toast) {
          HUB.shell.toast('✕ 跨渠道接力失败：' + err.message);
        }
      });
  }

  /* Interactive Approval Gate: Approve or reject a pending tool/permission request */
  function resolveApprovalDecision(approvalId, decision) {
    if (!approvalId) return Promise.resolve();
    if (typeof window === 'undefined' || !window.fetch) return Promise.resolve();
    return fetch('/api/gateway/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: approvalId, decision: decision })
    })
      .then(function (r) { return r.json(); })
      .then(function (res) {
        if (!res || !res.ok) throw new Error((res && res.error) || '审批操作失败');
        if (HUB.shell && HUB.shell.toast) {
          HUB.shell.toast(decision === 'approve' ? '已批准权限并自动续跑！' : '✕ 已驳回该工具权限请求');
        }
        fetchGatewayState();
        refreshUI(true);
        return res;
      })
      .catch(function (err) {
        if (HUB.shell && HUB.shell.toast) {
          HUB.shell.toast('✕ 审批处理失败：' + err.message);
        }
      });
  }

  /* Connect to /api/gateway/state and /api/gateway/stream */
  function ensureGatewayConnected() {
    if (typeof window === 'undefined' || !window.fetch) return;
    if (!location || (location.protocol !== 'http:' && location.protocol !== 'https:')) return;
    if (!pollTimer) {
      fetchGatewayState();
      pollTimer = setInterval(fetchGatewayState, 12000);
    }
    if (!streamSource && typeof window.EventSource === 'function') {
      try {
        streamSource = new window.EventSource('/api/gateway/stream');
        streamSource.onopen = function () { state.connected = true; };
        streamSource.onerror = function () { state.connected = false; };
        streamSource.onmessage = function (e) {
          try {
            var ev = JSON.parse(e.data);
            handleGatewayEvent(ev);
          } catch (err) { /* ignore malformed event */ }
        };
      } catch (err) { /* SSE unavailable */ }
    }
  }

  function fetchGatewayState() {
    if (typeof window === 'undefined' || !window.fetch) return Promise.resolve();
    if (!location || (location.protocol !== 'http:' && location.protocol !== 'https:')) return Promise.resolve();
    return fetch('/api/gateway/state', { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
      .then(function (doc) {
        state.connected = true;
        if (Array.isArray(doc.channels)) state.channels = normalizeChannels(doc.channels);
        if (Array.isArray(doc.workspaceDirs) && doc.workspaceDirs.length) state.workspaceDirs = doc.workspaceDirs;
        if (Array.isArray(doc.acpxSessions || doc.sessions)) state.sessions = normalizeSessions(doc.acpxSessions || doc.sessions);
        if (Array.isArray(doc.pendingApprovals)) state.pendingApprovals = doc.pendingApprovals;
        if (Array.isArray(doc.externalAnomalies)) state.externalAnomalies = doc.externalAnomalies;
        if (Array.isArray(doc.metaAgents)) {
          state.metaAgents = normalizeMetaAgents(doc.metaAgents);
          var approver = state.metaAgents.find(function (m) { return m.id === 'meta_approver'; });
          if (approver) {
            state.permissions = (approver.enabled && approver.policy === 'all') ? 'all' : 'reads';
          }
        }
        if (Array.isArray(doc.metaAgentLogs)) state.metaAgentLogs = doc.metaAgentLogs;
        if (doc.queues && typeof doc.queues === 'object') state.queues = doc.queues;
        var nextRuns = {};
        (doc.activeRuns || []).forEach(function (r) {
          var chId = r.channelId || r.channel;
          nextRuns[slotKey(chId, r.sessionName)] = Object.assign({}, r, { channelId: chId });
        });
        state.activeRuns = nextRuns;
        refreshUI();
      })
      .catch(function () { state.connected = false; });
  }

  function handleGatewayEvent(ev) {
    if (!ev || !ev.type) return;
    if (ev.type === 'gateway_snapshot') {
      if (Array.isArray(ev.channels)) state.channels = normalizeChannels(ev.channels);
      if (Array.isArray(ev.workspaceDirs) && ev.workspaceDirs.length) state.workspaceDirs = ev.workspaceDirs;
      if (Array.isArray(ev.acpxSessions || ev.sessions)) state.sessions = normalizeSessions(ev.acpxSessions || ev.sessions);
      if (Array.isArray(ev.pendingApprovals)) state.pendingApprovals = ev.pendingApprovals;
      if (Array.isArray(ev.externalAnomalies)) state.externalAnomalies = ev.externalAnomalies;
      if (Array.isArray(ev.metaAgents)) state.metaAgents = normalizeMetaAgents(ev.metaAgents);
      if (Array.isArray(ev.metaAgentLogs)) state.metaAgentLogs = ev.metaAgentLogs;
      if (ev.queues) state.queues = ev.queues;
      var map = {};
      (ev.activeRuns || []).forEach(function (r) {
        var chId = r.channelId || r.channel;
        map[slotKey(chId, r.sessionName)] = Object.assign({}, r, { channelId: chId });
      });
      state.activeRuns = map;
      refreshUI();
      return;
    }
    var logItem = ev.entry || ev.log;
    if (ev.type === 'meta_agent_action' && logItem) {
      state.metaAgentLogs = [logItem].concat((state.metaAgentLogs || []).slice(0, 39));
      if (Array.isArray(ev.metaAgents)) {
        state.metaAgents = normalizeMetaAgents(ev.metaAgents);
      } else if (ev.metaAgent) {
        var mIdx = (state.metaAgents || []).findIndex(function (m) { return m.id === ev.metaAgent.id; });
        if (mIdx >= 0) state.metaAgents[mIdx] = Object.assign({}, state.metaAgents[mIdx], ev.metaAgent);
      }
      if (HUB.shell && HUB.shell.toast && logItem.action !== 'auto_approve') {
        HUB.shell.toast('' + (logItem.agentName || logItem.metaName || '元智能体') + '：' + (logItem.detail || logItem.summary || '已自动介入处理'));
      }
      state.lastRenderKey = '';
      refreshUI();
      if (HUB.store && HUB.store.bump) HUB.store.bump();
      return;
    }
    var k = ev.channelId && ev.sessionName ? slotKey(ev.channelId, ev.sessionName) : '';
    if (ev.type === 'run_start' && ev.run) {
      var rCh = ev.run.channelId || ev.run.channel;
      state.activeRuns[slotKey(rCh, ev.run.sessionName)] = Object.assign({}, ev.run, { channelId: rCh });
      refreshUI(true);
    } else if (ev.type === 'run_update' && ev.run) {
      var uCh = ev.run.channelId || ev.run.channel;
      state.activeRuns[slotKey(uCh, ev.run.sessionName)] = Object.assign({}, ev.run, { channelId: uCh });
      refreshLiveTurnOnly();
    } else if (ev.type === 'thought_delta' && k && state.activeRuns[k]) {
      state.activeRuns[k].thoughts = ev.thoughts || ((state.activeRuns[k].thoughts || '') + (ev.delta || ''));
      refreshLiveTurnOnly();
    } else if (ev.type === 'text_delta' && k && state.activeRuns[k]) {
      state.activeRuns[k].text = ev.text || ((state.activeRuns[k].text || '') + (ev.delta || ''));
      refreshLiveTurnOnly();
    } else if (ev.type === 'tool_update' && k && state.activeRuns[k] && ev.tool) {
      var tools = state.activeRuns[k].tools || [];
      var idx = tools.findIndex(function (t) { return t.id === ev.tool.id; });
      if (idx >= 0) tools[idx] = ev.tool;
      else tools.push(ev.tool);
      state.activeRuns[k].tools = tools;
      refreshLiveTurnOnly();
    } else if (ev.type === 'session_sync') {
      if (ev.traceSessionId && HUB.obsTrace && HUB.obsTrace.reloadSession) {
        if (state.pendingSwitchTraceId && (state.pendingSwitchTraceId === ev.sessionName || state.pendingSwitchTraceId === ev.channelId)) {
          state.pendingSwitchTraceId = '';
          HUB.store.set({ subject: 'exec', depth: { exec: 2 }, focus: { type: 'session', id: ev.traceSessionId }, selection: null, present: 'graph' });
        } else {
          HUB.obsTrace.reloadSession(ev.traceSessionId);
        }
      }
    } else if (ev.type === 'run_done' && ev.run) {
      var dCh = ev.run.channelId || ev.run.channel;
      var rk = slotKey(dCh, ev.run.sessionName);
      state.activeRuns[rk] = Object.assign({}, ev.run, { channelId: dCh });
      fetchGatewayState().then(function () {
        var tid = ev.run.traceSessionId;
        if (!tid || String(tid).indexOf('new:') === 0) {
          var srec = state.sessions.find(function (s) { return s.channelId === dCh && s.sessionName === ev.run.sessionName && String(s.traceSessionId || '').indexOf('new:') !== 0; });
          if (srec) tid = srec.traceSessionId;
        }
        if (tid && HUB.obsTrace && HUB.obsTrace.reloadSession) {
          var cur = HUB.store && HUB.store.get ? HUB.store.get() : null;
          if (!cur || !cur.focus || cur.focus.id !== tid) {
            state.lastSessionId = tid;
            HUB.store.set({ subject: 'exec', depth: { exec: 2 }, focus: { type: 'session', id: tid }, selection: null, present: 'graph' });
          } else {
            HUB.obsTrace.reloadSession(tid);
          }
        }
        if (HUB.obsSessions && HUB.obsSessions.reload) {
          HUB.obsSessions.reload();
        }
        setTimeout(function () {
          if (state.activeRuns[rk] && state.activeRuns[rk].runId === ev.run.runId) {
            delete state.activeRuns[rk];
            refreshUI();
            if (tid && HUB.obsTrace && HUB.obsTrace.reloadSession) {
              HUB.obsTrace.reloadSession(tid);
            }
          }
        }, 700);
      });
    } else if (ev.type === 'queue_update' && k) {
      state.queues[k] = ev.queue || [];
      refreshUI();
    }
  }

  /* Format markdown-lite safely: input is first HTML-escaped, then code blocks, inline code, bold, and lists are styled */
  function formatMessageText(raw) {
    var txt = String(raw || '').trim();
    if (!txt) return '<span class="cr-empty-txt">（无文本输出）</span>';
    var safe = esc(txt);
    var blocks = [];
    safe = safe.replace(/```([a-zA-Z0-9_-]*)\r?\n([\s\S]*?)```/g, function (_, lang, code) {
      var idx = blocks.length;
      blocks.push(
        '<div class="cr-code-wrap">' +
          (lang ? '<div class="cr-code-lang">' + lang + '</div>' : '') +
          '<pre class="cr-code"><code>' + code.replace(/\n$/, '') + '</code></pre>' +
        '</div>'
      );
      return '\x00CODEBLOCK_' + idx + '\x00';
    });
    safe = safe.replace(/`([^`\n]{1,120})`/g, '<code class="cr-icode">$1</code>');
    safe = safe.replace(/\*\*([^*\n]{1,120})\*\*/g, '<strong>$1</strong>');
    var lines = safe.split(/\r?\n/);
    var htmlLines = lines.map(function (ln) {
      if (/^\s*[-*]\s+/.test(ln)) {
        return '<div class="cr-li"><span class="cr-li-dot">•</span><span>' + ln.replace(/^\s*[-*]\s+/, '') + '</span></div>';
      }
      if (/^\s*\d+\.\s+/.test(ln)) {
        var m = /^\s*(\d+\.)\s+(.*)$/.exec(ln);
        return '<div class="cr-li"><span class="cr-li-num">' + m[1] + '</span><span>' + m[2] + '</span></div>';
      }
      if (/^#{1,3}\s+/.test(ln)) {
        return '<div class="cr-h">' + ln.replace(/^#{1,3}\s+/, '') + '</div>';
      }
      return ln;
    });
    var joined = htmlLines.join('\n');
    joined = joined.replace(/\x00CODEBLOCK_(\d+)\x00/g, function (_, i) { return blocks[Number(i)] || ''; });
    return joined;
  }

  function toolMeta(name, target, input) {
    var n = String(name || 'tool').toLowerCase();
    var icon = '🔧', badge = '工具';
    if (n.indexOf('read') >= 0 || n.indexOf('view') >= 0 || n.indexOf('cat') >= 0) { icon = '📖'; badge = '读取'; }
    else if (n.indexOf('edit') >= 0 || n.indexOf('write') >= 0 || n.indexOf('patch') >= 0 || n.indexOf('replace') >= 0) { icon = '✏️'; badge = '修改'; }
    else if (n.indexOf('bash') >= 0 || n.indexOf('exec') >= 0 || n.indexOf('shell') >= 0 || n.indexOf('cmd') >= 0 || n.indexOf('command') >= 0 || n.indexOf('terminal') >= 0) { icon = '💻'; badge = '终端'; }
    else if (n.indexOf('search') >= 0 || n.indexOf('grep') >= 0 || n.indexOf('glob') >= 0 || n.indexOf('find') >= 0 || n.indexOf('web') >= 0) { icon = '🔍'; badge = '检索'; }
    else if (n.indexOf('agent') >= 0 || n.indexOf('task') >= 0 || n.indexOf('delegate') >= 0 || n.indexOf('subagent') >= 0) { icon = '🤖'; badge = '子智能体'; }
    else if (n.indexOf('plan') >= 0 || n.indexOf('todo') >= 0) { icon = '📋'; badge = '规划'; }
    var summary = String(target || '').trim();
    if (!summary && input) {
      var first = String(input).trim().split(/\r?\n/)[0] || '';
      if (first.indexOf('{') === 0) {
        try {
          var parsed = JSON.parse(input);
          summary = parsed.cmd || parsed.command || parsed.file_path || parsed.path || parsed.pattern || parsed.query || first;
        } catch (e) { summary = first; }
      } else {
        summary = first;
      }
    }
    if (summary.length > 88) summary = summary.slice(0, 88) + '…';
    return { icon: icon, badge: badge, summary: summary };
  }

  function isSystemInjection(step) {
    if (!step || step.kind !== 'message') return false;
    if (step.role === 'developer' || step.role === 'context' || step.role === 'system') return true;
    var txt = String(step.text || '').trim();
    if (/^<(environment_context|permissions instructions|collaboration_mode|app-context|system-reminder|user_instructions)/i.test(txt)) return true;
    if (/^#\s*AGENTS\.md\b/i.test(txt)) return true;
    return false;
  }

  function fmtDurMs(startIso, endIso) {
    if (!startIso || !endIso) return '';
    var ms = Date.parse(endIso) - Date.parse(startIso);
    if (!isFinite(ms) || ms < 0) return '';
    if (ms < 1000) return ms + 'ms';
    return (ms / 1000).toFixed(1) + 's';
  }

  function fmtTimeShort(iso) {
    if (!iso) return '';
    var m = /T(\d{2}:\d{2}:\d{2})/.exec(String(iso));
    return m ? m[1] : String(iso).slice(0, 16);
  }

  /* Render a single Turn from session.turns (with claude-web style 1-line folded execution summary for completed turns) */
  function renderTurn(turn, tIdx, session, selectedSpanId, totalTurns) {
    var steps = (turn && turn.steps) || [];
    if (!steps.length) return '';
    var sysSteps = [];
    var userSteps = [];
    var agentSteps = [];

    steps.forEach(function (st) {
      if (isSystemInjection(st)) sysSteps.push(st);
      else if (st.kind === 'message' && st.role === 'user') userSteps.push(st);
      else agentSteps.push(st);
    });

    var ch = channelForSession(session);
    var out = [];
    var turnKey = turn.id || ('t-' + tIdx);

    // 1. System / Developer context injection pill (collapsed by default)
    if (sysSteps.length) {
      var isCtxOpen = !!state.expandedCtx[turnKey];
      out.push(
        '<div class="cr-sys-bar">' +
          '<button type="button" class="cr-sys-btn" data-act="toggle-ctx" data-turn="' + esc(turnKey) + '">' +
            '<span class="cr-sys-ic">📎</span>' +
            '<span>已折叠 ' + sysSteps.length + ' 条系统/环境上下文注入</span>' +
            '<span class="cr-sys-caret">' + (isCtxOpen ? '▾ 收起' : '▸ 展开查看') + '</span>' +
          '</button>' +
          (isCtxOpen ? '<div class="cr-sys-list">' + sysSteps.map(function (st) {
            var sel = selectedSpanId === st.id ? ' is-sel' : '';
            var preview = String(st.text || '').trim().slice(0, 220);
            return '<div class="cr-sys-item' + sel + '" data-act="select-span" data-span="' + esc(st.id) + '">' +
              '<span class="cr-sys-role">' + esc(st.role === 'developer' ? '开发者指令' : '环境上下文') + '</span>' +
              '<span class="cr-sys-txt">' + esc(preview) + (String(st.text || '').length > 220 ? '…' : '') + '</span>' +
              '<span class="cr-span-jump">定位 ⑤⑥ →</span>' +
            '</div>';
          }).join('') + '</div>' : '') +
        '</div>'
      );
    }

    // 2. User Prompt Card(s)
    userSteps.forEach(function (ust) {
      var isSel = selectedSpanId === ust.id ? ' is-sel' : '';
      out.push(
        '<div class="cr-msg-row cr-msg-user' + isSel + '" data-act="select-span" data-span="' + esc(ust.id) + '">' +
          '<div class="cr-msg-bubble user">' +
            '<div class="cr-msg-head">' +
              '<span class="cr-role-badge user">👤 人类 / 调度指令</span>' +
              '<span class="cr-turn-tag">#' + (tIdx + 1) + '</span>' +
              (ust.startedAt || ust.at ? '<span class="cr-msg-time">' + esc(fmtTimeShort(ust.startedAt || ust.at)) + '</span>' : '') +
              '<span class="cr-span-jump" title="在右侧调用树与详情栏定位此消息">定位节点 ↗</span>' +
            '</div>' +
            '<div class="cr-msg-body">' + formatMessageText(ust.text) + '</div>' +
          '</div>' +
        '</div>'
      );
    });

    // 3. Agent Execution & Response Group
    if (agentSteps.length) {
      var modelName = '';
      for (var i = 0; i < agentSteps.length; i++) {
        if (agentSteps[i].model) { modelName = agentSteps[i].model; break; }
      }
      if (!modelName && session && session.agent && session.agent.model) modelName = session.agent.model;
      var dur = fmtDurMs(turn.startedAt, turn.endedAt);

      // Classify intermediate process steps vs final reply (claude-web / acp-components pattern)
      var finalReplyStep = null;
      for (var rIdx = agentSteps.length - 1; rIdx >= 0; rIdx--) {
        var rst = agentSteps[rIdx];
        if ((rst.kind === 'model' || rst.kind === 'message') && String(rst.text || '').trim()) {
          finalReplyStep = rst;
          break;
        }
      }

      var thinkCount = 0, readCount = 0, editCount = 0, shellCount = 0, searchCount = 0, otherToolCount = 0, errCount = 0;
      var editedFiles = [];
      agentSteps.forEach(function (ast) {
        if (ast.kind === 'thinking' || (ast.kind === 'model' && String(ast.reasoning || '').trim())) thinkCount++;
        if (ast.kind === 'tool') {
          var tm = toolMeta(ast.name, ast.target, ast.input);
          if (ast.status === 'error') errCount++;
          if (tm.badge === '读取') readCount++;
          else if (tm.badge === '修改') {
            editCount++;
            var f = tm.summary.replace(/^(Edit|Write|Patch)\s+/i, '').trim();
            var base = f.split(/[\\/]/).pop();
            if (base && editedFiles.indexOf(base) < 0 && editedFiles.length < 6) editedFiles.push(base);
          }
          else if (tm.badge === '终端') shellCount++;
          else if (tm.badge === '检索') searchCount++;
          else otherToolCount++;
        }
      });

      var processStepCount = thinkCount + readCount + editCount + shellCount + searchCount + otherToolCount;
      var isLatestTurn = (tIdx === (totalTurns || 1) - 1);
      var userPref = state.expandedTurnSteps[turnKey];
      // Default: fold intermediate process steps on historical turns (or turns with >6 steps) when a final reply exists
      var isProcOpen = userPref === 'open'
        ? true
        : userPref === 'closed'
        ? false
        : (!finalReplyStep || errCount > 0 || (isLatestTurn && processStepCount <= 6));

      var procParts = [];
      var replyParts = [];
      var toolCards = [];
      var toolGroupSeq = 0;
      var flushTools = function () {
        if (!toolCards.length) return;
        var gKey = turnKey + '-tg-' + (toolGroupSeq++);
        var isExpanded = !!state.expandedTools[gKey];
        if (toolCards.length > 3 && !isExpanded) {
          var headCards = toolCards.slice(0, 2);
          var tailCard = toolCards[toolCards.length - 1];
          var hiddenCount = toolCards.length - 3;
          procParts.push(
            '<div class="cr-tools-grid">' +
              headCards.join('') +
              '<button type="button" class="cr-tools-more" data-act="toggle-tools" data-group="' + esc(gKey) + '">' +
                '<span>🔧 已折叠中间 ' + hiddenCount + ' 次连续工具调用（共 ' + toolCards.length + ' 次）</span>' +
                '<span class="cr-sys-caret">▸ 展开全部</span>' +
              '</button>' +
              tailCard +
            '</div>'
          );
        } else {
          procParts.push(
            '<div class="cr-tools-grid">' +
              toolCards.join('') +
              (toolCards.length > 3 ? '<button type="button" class="cr-tools-more" data-act="toggle-tools" data-group="' + esc(gKey) + '"><span>🔧 收起连续工具调用（共 ' + toolCards.length + ' 次）</span><span class="cr-sys-caret">▾ 收起</span></button>' : '') +
            '</div>'
          );
        }
        toolCards = [];
      };

      // Only build intermediate step DOM cards when isProcOpen is true (massive speed boost for long sessions!)
      agentSteps.forEach(function (ast) {
        var isSel = selectedSpanId === ast.id ? ' is-sel' : '';
        if (ast.kind === 'model') {
          if (isProcOpen) {
            flushTools();
            var mReasoning = String(ast.reasoning || '').trim();
            if (mReasoning) {
              var mThOpen = !!state.expandedThink[ast.id];
              var mFirst = (mReasoning.split(/\r?\n/)[0] || '思考推理').replace(/^\*\*|\*\*$/g, '');
              if (mFirst.length > 68) mFirst = mFirst.slice(0, 68) + '…';
              procParts.push(
                '<div class="cr-think-card' + isSel + '">' +
                  '<div class="cr-think-head" data-act="toggle-think" data-step="' + esc(ast.id) + '">' +
                    '<span class="cr-think-ic">💭</span>' +
                    '<span class="cr-think-title">' + esc(mFirst || '模型内部思考') + '</span>' +
                    '<span class="cr-think-len">' + mReasoning.length + ' 字</span>' +
                    '<button type="button" class="cr-mini-link" data-act="select-span" data-span="' + esc(ast.id) + '">看详情</button>' +
                    '<span class="cr-think-caret">' + (mThOpen ? '▾' : '▸') + '</span>' +
                  '</div>' +
                  (mThOpen ? '<div class="cr-think-body" data-act="select-span" data-span="' + esc(ast.id) + '">' + esc(mReasoning) + '</div>' : '') +
                '</div>'
              );
            }
          }
          var mText = String(ast.text || '').trim();
          if (mText) {
            var cardHtml =
              '<div class="cr-assistant-msg' + isSel + '" data-act="select-span" data-span="' + esc(ast.id) + '">' +
                '<div class="cr-msg-body">' + formatMessageText(mText) + '</div>' +
              '</div>';
            if (ast === finalReplyStep) replyParts.push(cardHtml);
            else if (isProcOpen) procParts.push(cardHtml);
          }
        } else if (ast.kind === 'thinking') {
          if (!isProcOpen) return;
          flushTools();
          var thOpen = !!state.expandedThink[ast.id];
          var thText = String(ast.text || ast.summary || '').trim();
          var firstLine = (thText.split(/\r?\n/)[0] || '思考推理').replace(/^\*\*|\*\*$/g, '');
          if (firstLine.length > 68) firstLine = firstLine.slice(0, 68) + '…';
          procParts.push(
            '<div class="cr-think-card' + isSel + '">' +
              '<div class="cr-think-head" data-act="toggle-think" data-step="' + esc(ast.id) + '">' +
                '<span class="cr-think-ic">💭</span>' +
                '<span class="cr-think-title">' + esc(firstLine || '模型内部思考') + '</span>' +
                (thText ? '<span class="cr-think-len">' + thText.length + ' 字</span>' : '') +
                '<button type="button" class="cr-mini-link" data-act="select-span" data-span="' + esc(ast.id) + '">看详情</button>' +
                '<span class="cr-think-caret">' + (thOpen ? '▾' : '▸') + '</span>' +
              '</div>' +
              (thOpen && thText ? '<div class="cr-think-body" data-act="select-span" data-span="' + esc(ast.id) + '">' + esc(thText) + '</div>' : '') +
            '</div>'
          );
        } else if (ast.kind === 'tool') {
          if (!isProcOpen) return;
          var tm = toolMeta(ast.name, ast.target, ast.input);
          var stCls = ast.status === 'error' ? 'err' : 'ok';
          var stepDur = fmtDurMs(ast.startedAt, ast.endedAt);
          var errHint = (ast.status === 'error' && ast.output && String(ast.output).indexOf('⚠️') === 0)
            ? '<div class="cr-event-pill err" data-act="select-span" data-span="' + esc(ast.id) + '"><span>' + esc(ast.output) + '</span></div>'
            : '';
          toolCards.push(
            '<div class="cr-tool-card ' + stCls + isSel + '" data-act="select-span" data-span="' + esc(ast.id) + '" title="点击在右侧查看该工具的完整输入参数与返回输出">' +
              '<span class="cr-tool-ic">' + tm.icon + '</span>' +
              '<span class="cr-tool-badge">' + esc(tm.badge) + '</span>' +
              '<span class="cr-tool-name">' + esc(ast.name || 'tool') + '</span>' +
              (tm.summary ? '<code class="cr-tool-target">' + esc(tm.summary) + '</code>' : '') +
              '<span class="cr-tool-right">' +
                (stepDur ? '<span class="cr-tool-dur">' + esc(stepDur) + '</span>' : '') +
                '<span class="cr-tool-st ' + stCls + '">' + (ast.status === 'error' ? '✕ 拦截/报错' : '✓') + '</span>' +
              '</span>' +
            '</div>' + errHint
          );
        } else if (ast.kind === 'subagent') {
          if (!isProcOpen) return;
          flushTools();
          procParts.push(
            '<div class="cr-subagent-card' + isSel + '" data-act="select-span" data-span="' + esc(ast.id) + '">' +
              '<div class="cr-sub-head">' +
                '<span class="cr-sub-ic">🤖</span>' +
                '<b>派生子智能体 · ' + esc(ast.agent || ast.name || 'Subagent') + '</b>' +
                (ast.childSessionId ? '<button type="button" class="cr-sub-jump" data-act="open-child-session" data-id="' + esc(ast.childSessionId) + '">进入子会话 ↗</button>' : '') +
              '</div>' +
              (ast.task ? '<div class="cr-sub-task">' + esc(String(ast.task).slice(0, 180)) + '</div>' : '') +
            '</div>'
          );
        } else if (ast.kind === 'message') {
          if (isProcOpen) flushTools();
          var msgHtml =
            '<div class="cr-assistant-msg' + isSel + '" data-act="select-span" data-span="' + esc(ast.id) + '">' +
              '<div class="cr-msg-body">' + formatMessageText(ast.text) + '</div>' +
            '</div>';
          if (ast === finalReplyStep) replyParts.push(msgHtml);
          else if (isProcOpen) procParts.push(msgHtml);
        } else if (ast.kind === 'event' && ast.name !== 'turn_end') {
          if (!isProcOpen) return;
          flushTools();
          if (ast.text || ast.name === 'note' || ast.name === 'annotation' || ast.status === 'error') {
            procParts.push(
              '<div class="cr-event-pill' + (ast.status === 'error' ? ' err' : '') + isSel + '" data-act="select-span" data-span="' + esc(ast.id) + '">' +
                '<span>' + (ast.status === 'error' ? '⚠️ 异常事件' : '📌 ' + esc(ast.name || '事件')) + '</span>' +
                (ast.text ? '<span>· ' + esc(String(ast.text).slice(0, 140)) + '</span>' : '') +
              '</div>'
            );
          }
        }
      });
      if (isProcOpen) flushTools();

      // Build 1-line summary bar when there are intermediate thinking/tool steps
      var procSummaryHtml = '';
      if (processStepCount > 0) {
        var badges = [];
        if (thinkCount) badges.push('<span class="cr-pchip">💭 思考 ' + thinkCount + '</span>');
        if (readCount) badges.push('<span class="cr-pchip">📖 读取 ' + readCount + '</span>');
        if (searchCount) badges.push('<span class="cr-pchip">🔍 检索 ' + searchCount + '</span>');
        if (shellCount) badges.push('<span class="cr-pchip">💻 命令 ' + shellCount + '</span>');
        if (editCount) badges.push('<span class="cr-pchip edit">✏️ 修改 ' + editCount + '</span>');
        if (otherToolCount) badges.push('<span class="cr-pchip">🔧 工具 ' + otherToolCount + '</span>');
        if (errCount) badges.push('<span class="cr-pchip err">✕ 报错 ' + errCount + '</span>');
        procSummaryHtml =
          '<button type="button" class="cr-proc-bar' + (isProcOpen ? ' open' : '') + '" data-act="toggle-turn-proc" data-turn="' + esc(turnKey) + '" title="点击展开或折叠本轮的内部思考与工具调用明细">' +
            '<span class="cr-proc-lbl">执行轨迹</span>' +
            '<span class="cr-proc-badges">' + badges.join('') + '</span>' +
            '<span class="cr-proc-caret">' + (isProcOpen ? '▾ 收起明细' : '▸ 展开 ' + processStepCount + ' 步详情') + '</span>' +
          '</button>';
      }

      var filesFooterHtml = editedFiles.length
        ? '<div class="cr-files-bar"><span class="cr-files-lbl">📝 本轮涉及文件:</span>' +
            editedFiles.map(function (f) { return '<code class="cr-file-chip">' + esc(f) + '</code>'; }).join('') +
          '</div>'
        : '';

      var retryFailedHtml = '';
      if (turn.status === 'failed' && userSteps.length) {
        var lastUserPrompt = String(userSteps[userSteps.length - 1].text || '').trim();
        if (lastUserPrompt) {
          retryFailedHtml =
            '<div class="cr-turn-err-bar">' +
              '<span class="cr-turn-err-txt">⚠️ 本轮调用因渠道/模型异常未完成产出</span>' +
              '<button type="button" class="cr-turn-retry-btn" data-act="retry-turn-prompt" data-prompt="' + esc(lastUserPrompt) + '" title="使用当前已验证可用模型重新发送本轮指令">🔄 用可用模型重试本轮</button>' +
            '</div>';
        }
      }

      if (procSummaryHtml || procParts.length || replyParts.length || retryFailedHtml) {
        out.push(
          '<div class="cr-msg-row cr-msg-agent">' +
            '<div class="cr-msg-bubble agent' + (turn.status === 'failed' ? ' is-failed' : '') + '" style="--ch-c:' + ch.color + '">' +
              '<div class="cr-msg-head">' +
                '<span class="cr-role-badge agent" style="border-color:' + ch.color + '55;color:' + ch.color + '">● ' + esc(ch.label) + '</span>' +
                (modelName ? '<span class="cr-model-tag">' + esc(modelName) + '</span>' : '') +
                (dur ? '<span class="cr-msg-time">⏱ ' + esc(dur) + '</span>' : '') +
                (turn.status === 'failed' ? '<span class="cr-pchip err">✕ 调用异常</span>' : '') +
                '<span class="cr-turn-tag">#' + (tIdx + 1) + '</span>' +
              '</div>' +
              '<div class="cr-agent-flow">' +
                procSummaryHtml +
                (isProcOpen && procParts.length ? '<div class="cr-proc-steps">' + procParts.join('') + '</div>' : '') +
                replyParts.join('') +
                retryFailedHtml +
                filesFooterHtml +
              '</div>' +
            '</div>' +
          '</div>'
        );
      }
    }

    return out.join('');
  }

  /* Render active live streaming turn if an acpx run is in progress */
  function renderLiveTurn(run) {
    if (!run || (run.status !== 'running' && !run.text && !run.thoughts && !(run.tools && run.tools.length))) return '';
    var ch = channelById(run.channelId);
    var elapsedSec = Math.max(0, Math.round((Date.now() - Date.parse(run.startedAt || '')) / 1000));
    var toolsHtml = (run.tools || []).map(function (t) {
      var stCls = t.status === 'failed' ? 'err' : t.status === 'completed' ? 'ok' : 'running';
      return '<div class="cr-tool-card ' + stCls + '">' +
        '<span class="cr-tool-ic">' + esc(t.icon || '🔧') + '</span>' +
        '<span class="cr-tool-name">' + esc(t.title || t.kind || 'tool') + '</span>' +
        (t.input ? '<code class="cr-tool-target">' + esc(String(t.input).slice(0, 72)) + '</code>' : '') +
        '<span class="cr-tool-right"><span class="cr-tool-st ' + stCls + '">' +
          (t.status === 'running' ? '● 执行中…' : t.status === 'failed' ? '✕ 失败' : '✓ 完成') +
        '</span></span>' +
      '</div>';
    }).join('');

    return (
      '<div class="cr-live-wrap">' +
        '<div class="cr-msg-row cr-msg-user">' +
          '<div class="cr-msg-bubble user">' +
            '<div class="cr-msg-head">' +
              '<span class="cr-role-badge user">👤 实况指令（' + (run.source === 'cli' ? 'CLI 端发起' : 'Web 控制室') + '）</span>' +
              '<span class="cr-msg-time">刚刚</span>' +
            '</div>' +
            '<div class="cr-msg-body">' + formatMessageText(run.prompt) + '</div>' +
          '</div>' +
        '</div>' +
        '<div class="cr-msg-row cr-msg-agent">' +
          '<div class="cr-msg-bubble agent cr-live-bubble" style="--ch-c:' + ch.color + '">' +
            '<div class="cr-msg-head">' +
              '<span class="cr-live-pulse"></span>' +
              '<span class="cr-role-badge agent" style="border-color:' + ch.color + ';color:' + ch.color + '">' + esc(ch.label) + ' · 正在实况执行</span>' +
              '<span class="cr-model-tag">会话: ' + esc(run.sessionName) + '</span>' +
              (isFinite(elapsedSec) ? '<span class="cr-msg-time">' + elapsedSec + 's</span>' : '') +
              '<button type="button" class="cr-stop-mini" data-act="gw-cancel" data-ch="' + esc(run.channelId) + '" data-sess="' + esc(run.sessionName) + '">⏹ 紧急停止</button>' +
            '</div>' +
            '<div class="cr-agent-flow">' +
              (run.thoughts ? '<div class="cr-think-card"><div class="cr-think-head"><span class="cr-think-ic">💭</span><span class="cr-think-title">实况思考流…</span></div><div class="cr-think-body">' + esc(run.thoughts) + '</div></div>' : '') +
              (toolsHtml ? '<div class="cr-tools-grid">' + toolsHtml + '</div>' : '') +
              (run.text
                ? '<div class="cr-assistant-msg"><div class="cr-msg-body">' + formatMessageText(run.text) + '<span class="cr-cursor">▍</span></div></div>'
                : '<div class="cr-live-wait"><span class="cr-spinner"></span> 正在等待 ' + esc(ch.label) + ' 流式响应与工具执行…</div>') +
              (run.error ? '<div class="cr-event-pill err">⚠️ ' + esc(run.error) + '</div>' : '') +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>'
    );
  }

  function refreshLiveTurnOnly() {
    if (!hostEl) return;
    var liveContainer = hostEl.querySelector('[data-cr-live-slot]');
    if (!liveContainer) return;
    var cur = HUB.obsTrace && HUB.obsTrace.current ? HUB.obsTrace.current(HUB.store.get(), HUB.model.current) : null;
    var sess = cur && cur.session ? cur.session : null;
    var tid = cur && cur.id ? cur.id : '';
    var run = activeRunFor(sess, tid);
    liveContainer.innerHTML = renderLiveTurn(run);
    if (state.autoFollow) {
      var streamEl = hostEl.querySelector('.cr-stream');
      if (streamEl) streamEl.scrollTop = streamEl.scrollHeight;
    }
  }

  function refreshUI(scrollToBottom) {
    if (!hostEl || !HUB.obsTrace) return;
    var s = HUB.store && HUB.store.get ? HUB.store.get() : null;
    var m = HUB.model ? HUB.model.current : null;
    if (!s || s.subject !== 'exec') return;
    var cur = HUB.obsTrace.current(s, m);
    render(hostEl, cur, s, m, scrollToBottom);
  }

  /* Main render entry called by HUB.obsTrace */
  function render(el, traceTarget, s, m, forceScrollBottom) {
    if (!el) return;
    hostEl = el;
    ensureGatewayConnected();
    bindEvents(el);

    var session = traceTarget && traceTarget.session ? traceTarget.session : null;
    var targetId = (traceTarget && traceTarget.id) || (session && session.id) || '';
    var selectedSpanId = s && s.selection && s.selection.type === 'span' ? s.selection.id : '';

    // Synchronize channel & session name whenever targetId changes or session finishes loading
    if (targetId && targetId !== state.lastSessionId) {
      state.lastSessionId = targetId;
      state.lastSyncedSessionObjId = '';
      state.visibleTurnLimit = DEFAULT_TURN_LIMIT;
      state.lastRenderKey = '';
      if (targetId.indexOf('new:') === 0) {
        var np = targetId.split(':');
        var nCh = channelById(np[1] || state.selectedChannel);
        state.selectedChannel = nCh.id;
        state.selectedSessionName = np.slice(2).join(':') || nCh.defaultSession;
      } else {
        var preRec = matchAcpxRecord(session, targetId);
        if (preRec) {
          state.selectedChannel = preRec.channelId;
          state.selectedSessionName = preRec.sessionName;
        } else {
          var pref = String(targetId.split(':')[0] || '').toLowerCase();
          var guessId = pref === 'claude-code' ? 'claude' : pref;
          var chGuess = CHANNELS.find(function (c) { return c.id === guessId; });
          if (chGuess) {
            state.selectedChannel = chGuess.id;
            state.selectedSessionName = chGuess.defaultSession;
          }
        }
      }
    }
    if (session && state.lastSyncedSessionObjId !== (session.id || targetId) && targetId.indexOf('new:') !== 0) {
      state.lastSyncedSessionObjId = session.id || targetId;
      var ch0 = channelForSession(session);
      state.selectedChannel = ch0.id;
      var matched = matchAcpxRecord(session, targetId);
      var agentSessName = (session.agent && session.agent.name && session.agent.name !== ch0.id) ? session.agent.name : '';
      state.selectedSessionName = (matched && matched.sessionName) || agentSessName || ch0.defaultSession;
      state.lastRenderKey = '';
    }

    var activeCh = channelById(state.selectedChannel);
    var rec = matchAcpxRecord(session, targetId);
    if (rec && rec.sessionName && targetId && targetId.indexOf('new:') !== 0 && state.selectedSessionName !== rec.sessionName) {
      state.selectedSessionName = rec.sessionName;
    }
    var activeSessName = state.selectedSessionName || (rec && rec.sessionName) || (session && session.agent && session.agent.name) || activeCh.defaultSession;
    var activeModel = activeModelFor(session, targetId);
    var activeCwd = activeCwdFor(session, targetId);
    var modelList = availableModelsFor(session, targetId);
    var liveRun = activeRunFor(session, targetId);
    var queue = queueFor(session, targetId);
    var turns = (session && session.turns) || [];
    var totalTurns = turns.length;

    // Fast path: if only selectedSpanId changed and the selected span is already in the rendered DOM, toggle .is-sel in <1ms without rebuilding DOM!
    var metaSig = (state.metaAgents || []).map(function (ma) {
      return [ma.id, ma.enabled ? 1 : 0, ma.triggerCount || 0, ma.brainChannel || '', ma.brainModel || '', ma.engineMode || '', ma.runtimeStatus || ''].join(':');
    }).join(',');
    var renderKey = [
      targetId,
      totalTurns,
      session && session.updatedAt ? session.updatedAt : '',
      activeCh.id,
      activeSessName,
      activeModel,
      activeCwd,
      state.permissions,
      state.visibleTurnLimit,
      liveRun ? (liveRun.runId + ':' + liveRun.status) : 'idle',
      queue.length,
      state.sessions.length,
      metaSig
    ].join('|');

    if (!forceScrollBottom && state.lastRenderKey === renderKey && el.querySelector && el.querySelector('.cr-stream')) {
      var prevSels = el.querySelectorAll('.is-sel');
      for (var psi = 0; psi < prevSels.length; psi++) prevSels[psi].classList.remove('is-sel');
      if (selectedSpanId) {
        var matchNodes = el.querySelectorAll('[data-span]');
        for (var mni = 0; mni < matchNodes.length; mni++) {
          if (matchNodes[mni].getAttribute('data-span') === selectedSpanId) {
            matchNodes[mni].classList.add('is-sel');
          }
        }
      }
      return;
    }
    state.lastRenderKey = renderKey;

    // Preserve active textarea state before updating DOM
    var existingInput = el.querySelector && el.querySelector('[data-cr-input]');
    var hadFocus = existingInput && document.activeElement === existingInput;
    var selStart = existingInput ? existingInput.selectionStart : null;
    if (existingInput) state.draftText = existingInput.value;

    var prevStream = el.querySelector && el.querySelector('.cr-stream');
    var prevScroll = prevStream ? prevStream.scrollTop : 0;
    var wasNearBottom = !prevStream || (prevStream.scrollHeight - prevStream.scrollTop - prevStream.clientHeight < 90);

    // Turn Windowing for long sessions (e.g. 169 / 333 / 1154 turns)
    var startIdx = totalTurns > state.visibleTurnLimit ? (totalTurns - state.visibleTurnLimit) : 0;
    var hiddenTurnsCount = startIdx;
    var windowBarHtml = '';
    if (hiddenTurnsCount > 0) {
      windowBarHtml =
        '<div class="cr-win-bar">' +
          '<div class="cr-win-info">' +
            '<span class="cr-win-badge">最近几轮</span>' +
            '<span>共 <b>' + totalTurns + '</b> 轮对话 · 已折叠较早的 <b>' + hiddenTurnsCount + '</b> 轮，当前渲染最近 <b>' + (totalTurns - startIdx) + '</b> 轮</span>' +
          '</div>' +
          '<div class="cr-win-acts">' +
            '<button type="button" class="cr-win-btn" data-act="load-more-turns" data-step="25">↑ 再加载 25 轮</button>' +
            (hiddenTurnsCount > 25 ? '<button type="button" class="cr-win-btn" data-act="load-more-turns" data-step="100">↑↑ 再加载 100 轮</button>' : '') +
            '<button type="button" class="cr-win-btn ghost" data-act="load-all-turns">展开全部 (' + totalTurns + ' 轮)</button>' +
          '</div>' +
        '</div>';
    }

    var visibleTurns = startIdx > 0 ? turns.slice(startIdx) : turns;
    var turnsHtml = visibleTurns.map(function (t, idx) {
      return renderTurn(t, startIdx + idx, session, selectedSpanId, totalTurns);
    }).filter(Boolean).join('');

    var isNewDraft = String(targetId || '').indexOf('new:') === 0;
    if (!turnsHtml && !liveRun) {
      var bridgeHint = activeCh.id === 'antigravity'
        ? '直接通过本机 <code>Antigravity LanguageServer (Connect-RPC + Brain Transcript)</code> 唤醒 <b>AGY</b>'
        : '直接通过共享 <code>acpx</code> 网关唤醒 <b>' + esc(activeCh.label) + '</b>';
      turnsHtml =
        '<div class="cr-empty-state">' +
          '<div class="cr-empty-orb" style="color:' + activeCh.color + '">' + (isNewDraft ? '＋' : '💬') + '</div>' +
          '<div class="cr-empty-title">' +
            (isNewDraft
              ? '已创建 ' + esc(activeCh.label) + ' 全新会话槽（' + esc(activeSessName) + '）'
              : '智能体实况控制室已就绪（' + esc(activeCh.label) + ' · ' + esc(activeSessName) + '）') +
          '</div>' +
          '<div class="cr-empty-sub">在下方输入指令，' + bridgeHint + '（模型 <code>' + esc(activeModel) + '</code> · 目录 <code>' + esc(activeCwd) + '</code> · 会话槽 <code>' + esc(activeSessName) + '</code>），并由元智能体实时守护。</div>' +
        '</div>';
    }

    // Channel selector strip in composer (7 channels)
    var channelPills = CHANNELS.map(function (c) {
      var gwCh = state.channels.find(function (x) { return x.id === c.id; }) || c;
      var isRunning = gwCh.status === 'running' || gwCh.status === 'working';
      var isOn = c.id === activeCh.id;
      return '<button type="button" class="cr-ch-pill' + (isOn ? ' on' : '') + (isRunning ? ' running' : '') + '" ' +
        'data-act="select-ch" data-ch="' + esc(c.id) + '" style="--ch-c:' + c.color + '" ' +
        'title="切换或打开 ' + esc(c.label) + ' (' + esc(c.vendor) + ') 实况会话">' +
        '<span class="cr-ch-dot ' + (isRunning ? 'running' : 'idle') + '"></span>' +
        '<span>' + esc(c.label) + '</span>' +
        (isRunning ? '<span class="cr-ch-live">运行中</span>' : '') +
      '</button>';
    }).join('');

    // Session selector options for the active channel
    var chSessions = state.sessions.filter(function (x) { return x.channelId === activeCh.id; });
    var hasDefault = chSessions.some(function (x) { return x.sessionName === activeSessName; });
    var sessOpts = [];
    if (!hasDefault && activeSessName) {
      var fallbackTraceId = targetId || ('new:' + activeCh.id + ':' + activeSessName);
      sessOpts.push('<option value="' + esc(activeSessName) + '" data-trace-id="' + esc(fallbackTraceId) + '" selected>' + esc(activeSessName) + ' (当前会话)</option>');
    }
    chSessions.forEach(function (xs) {
      var sel = xs.sessionName === activeSessName ? ' selected' : '';
      var optTraceId = xs.traceSessionId || ('new:' + activeCh.id + ':' + xs.sessionName);
      sessOpts.push('<option value="' + esc(xs.sessionName) + '" data-trace-id="' + esc(optTraceId) + '"' + sel + '>' +
        esc(xs.sessionName) + ' · ' + esc((xs.title || '').slice(0, 22)) + '</option>');
    });

    // Strict Capability Gating: Only render controls that actually work on this channel/session
    var caps = capabilitiesFor(session, targetId);
    var canSwitchM = canSwitchModelFor(session, targetId);
    var modelControlHtml = '';
    if (canSwitchM) {
      var modelOpts = modelList.map(function (mId) {
        var isSel = mId === activeModel ? ' selected' : '';
        return '<option value="' + esc(mId) + '"' + isSel + '>' + esc(mId) + '</option>';
      });
      modelControlHtml =
        '<label class="cr-sess-pick cr-model-pick" title="选择或切换当前渠道已实机验证可用的大模型">' +
          '<span>模型:</span>' +
          '<select data-cr-model-select>' + modelOpts.join('') + '</select>' +
        '</label>';
    } else if (activeModel) {
      modelControlHtml =
        '<span class="cr-sess-pick cr-model-static" title="当前渠道/会话固定使用本机已验证可用模型（不支持中途热切其他模型）">' +
          '<span>模型:</span>' +
          '<b>' + esc(activeModel) + '</b>' +
        '</span>';
    }

    // Meta-Agent Guard Bar (Supervisor Brain badge + 4 selectable Meta-Agents + Patrol / Brain Session / Config actions)
    var leadMeta = (state.metaAgents && state.metaAgents[0]) || DEFAULT_META_AGENTS[2];
    var brainCh = channelById(leadMeta.brainChannel || 'zcode');
    var brainModelShort = String(leadMeta.brainModel || brainCh.defaultModel || '').split(/[\\/:]/).pop() || (leadMeta.brainModel || brainCh.defaultModel);
    var isBrainThinking = (state.metaAgents || []).some(function (ma) { return ma.runtimeStatus === 'thinking'; });
    var brainLabel = leadMeta.engineMode === 'local_rules'
      ? '本地规则'
      : (brainCh.label + ' · ' + brainModelShort);

    var metaPillsHtml = (state.metaAgents || DEFAULT_META_AGENTS).map(function (ma) {
      var onCls = ma.enabled ? ' on' : ' off';
      var cntBadge = ma.triggerCount > 0 ? '<span class="cr-meta-cnt">' + ma.triggerCount + '</span>' : '';
      return '<button type="button" class="cr-meta-pill' + onCls + '" data-act="toggle-meta" data-meta-id="' + esc(ma.id) + '" style="--ma-c:' + esc(ma.color || '#22C4E6') + '" title="' + esc(ma.name + '（' + (ma.enabled ? '已开启' : '已关闭') + '）\n大脑引擎：' + brainLabel + '\n职责：' + ma.role + '\n最近状态：' + (ma.lastActionSummary || '待命') + '\n点击切换启停') + '">' +
        '<span class="cr-meta-ic">' + esc(ma.icon || '🛡️') + '</span>' +
        '<span class="cr-meta-nm">' + esc(ma.shortName || ma.name) + '</span>' +
        '<span class="cr-meta-st">' + (ma.enabled ? 'ON' : 'OFF') + '</span>' +
        cntBadge +
      '</button>';
    }).join('');

    var lastTurn = turns.length ? turns[turns.length - 1] : null;
    var hasInterrupted = !!(
      (session && session.state && (session.state.status === 'failed' || session.state.status === 'aborted' || session.state.status === 'stale')) ||
      (lastTurn && (lastTurn.status === 'failed' || lastTurn.status === 'aborted' || lastTurn.status === 'interrupted'))
    );

    var handoffOpts = ['<option value="">↗ 转交其他 Agent 接力…</option>'].concat(
      CHANNELS.filter(function (c) { return c.id !== activeCh.id; }).map(function (c) {
        return '<option value="' + esc(c.id) + '">↗ 转交 ' + esc(c.label) + ' 接手继续</option>';
      })
    ).join('');

    var extAnoms = (state.externalAnomalies || []).filter(function (a) {
      return a && a.traceSessionId !== targetId;
    });
    var extAnomBtnHtml = extAnoms.length > 0
      ? '<button type="button" class="cr-resume-btn warn" data-act="gw-takeover-anomaly" data-ch="' + esc(extAnoms[0].channel) + '" data-sess="' + esc(extAnoms[0].sessionName) + '" data-trace-id="' + esc(extAnoms[0].traceSessionId) + '" title="元智能体后台 0-Token 巡检发现会话 ' + esc(extAnoms[0].sessionName) + ' 存在未恢复异常：' + esc(extAnoms[0].lastError) + '（点击一键切换并接管）">🚨 巡检发现异常 (' + esc(extAnoms[0].sessionName) + ') · 一键接管</button>'
      : '';

    var metaBarHtml =
      '<div class="cr-meta-bar">' +
        '<div class="cr-meta-top-row">' +
          '<button type="button" class="cr-meta-brain-pill' + (isBrainThinking ? ' thinking' : '') + '" data-act="open-meta-drawer" title="点击在右侧栏更换元智能体所调用的诊断用的产品 与模型（当前：' + esc(brainLabel) + '，后台每 ' + esc(leadMeta.patrolIntervalSec || 30) + 's 零Token巡检 + 异常事件叫诊断会话）">' +
            '<span class="cr-meta-brain-dot"></span>' +
            '<span>元智能体的诊断会话: <b>' + esc(brainLabel) + '</b></span>' +
            '<span class="cr-meta-brain-st">' + (isBrainThinking ? '巡检思考中…' : '值守中 ▾') + '</span>' +
          '</button>' +
          '<div class="cr-meta-acts">' +
            (hasInterrupted
              ? '<button type="button" class="cr-resume-btn warn" data-act="gw-resume" title="调用【断网与Bug续跑元智能体】分析当前会话最后的断点/报错上下文，自动发包续跑">🔄 检测到中断 · 立即续跑</button>'
              : '') +
            extAnomBtnHtml +
            '<select class="cr-meta-cfg-btn" data-cr-handoff-select title="将当前会话最近 3 轮上下文与工作目录一键转交给另一个 Agent 渠道接力完成">' + handoffOpts + '</select>' +
            '<button type="button" class="cr-meta-cfg-btn" data-act="meta-patrol" title="立即唤醒元智能体的诊断会话 (' + esc(brainLabel) + ') 对当前会话与渠道执行一次实况诊断">唤醒巡检</button>' +
            '<button type="button" class="cr-meta-cfg-btn" data-act="open-meta-brain" title="进入元智能体的诊断会话 (meta-brain-supervisor)，查看元智能体真实的思考与决策记录">👁️ 诊断会话</button>' +
            '<button type="button" class="cr-meta-cfg-btn" data-act="open-meta-drawer" title="在右侧【编排与调控】面板更换元智能体的诊断会话 Agent/模型、巡检周期与触发日志">⚙ 换诊断模型/日志</button>' +
          '</div>' +
        '</div>' +
        '<div class="cr-meta-pills">' + metaPillsHtml + '</div>' +
      '</div>';

    // Multi-Run Live Strip: Show all concurrently running sessions across all 7 channels (including CLI/MCP runs!)
    var allRunningList = Object.keys(state.activeRuns || {}).map(function (k) {
      return state.activeRuns[k];
    }).filter(function (r) { return r && r.status === 'running'; });

    var liveRunsStripHtml = allRunningList.length > 0 ? (
      '<div class="cr-live-strip">' +
        '<span class="cr-live-strip-lbl">🛰️ 实况并行盯盘 (' + allRunningList.length + ')：</span>' +
        allRunningList.map(function (r) {
          var rCh = channelById(r.channelId || r.channel);
          var isCurrent = (r.channelId || r.channel) === activeCh.id && r.sessionName === activeSessName;
          var srcBadge = r.source === 'cli' ? '🤖 机器/MCP' : '👤 Web';
          var stepCnt = (r.tools && r.tools.length) || 0;
          return '<div class="cr-live-strip-item' + (isCurrent ? ' current' : '') + '" style="--ch-c:' + rCh.color + '">' +
            '<button type="button" class="cr-live-strip-jump" data-act="gw-focus-run" data-ch="' + esc(rCh.id) + '" data-sess="' + esc(r.sessionName) + '" data-trace-id="' + esc(r.traceSessionId || '') + '" title="点击切入该实况运行会话观察或干预">' +
              '<span class="cr-ch-dot running"></span>' +
              '<b>' + esc(rCh.label) + '</b> · <code>' + esc(r.sessionName) + '</code> ' +
              '<span class="cr-live-strip-meta">[' + srcBadge + (stepCnt ? ' · ' + stepCnt + ' 步工具' : '') + ']</span>' +
            '</button>' +
            '<button type="button" class="cr-live-strip-stop" data-act="gw-cancel" data-ch="' + esc(rCh.id) + '" data-sess="' + esc(r.sessionName) + '" title="中断该运行">⏹</button>' +
          '</div>';
        }).join('') +
      '</div>'
    ) : '';

    // Interactive Approval Gate Banner if any pending tool/permission approvals exist
    var pendingApprs = (state.pendingApprovals || []).filter(function (a) { return a && a.status === 'pending'; });
    var approvalsHtml = pendingApprs.length > 0 ? (
      '<div class="cr-queue-banner cr-approval-banner">' +
        '<div class="cr-queue-hdr"><span>待拍板权限门禁（' + pendingApprs.length + ' 项）</span><span>批准后打开读写权限接着跑</span></div>' +
        pendingApprs.map(function (ap) {
          var apCh = channelById(ap.channel);
          return '<div class="cr-queue-item">' +
            '<span class="cr-queue-idx">🔒 ' + esc(apCh.label + ':' + ap.sessionName) + '</span>' +
            '<span class="cr-queue-txt">请求执行 <b>' + esc(ap.toolName) + '</b> — ' + esc((ap.reason || '').slice(0, 90)) + '</span>' +
            '<button type="button" class="cr-q-btn" data-act="gw-approve-decision" data-id="' + esc(ap.id) + '" data-decision="approve">批准并续跑</button>' +
            '<button type="button" class="cr-q-btn" data-act="gw-approve-decision" data-id="' + esc(ap.id) + '" data-decision="reject" style="opacity:0.8">✕ 驳回</button>' +
          '</div>';
        }).join('') +
      '</div>'
    ) : '';

    // Queue banner if items are queued
    var queueHtml = queue.length ? (
      '<div class="cr-queue-banner">' +
        '<div class="cr-queue-hdr"><span>📥 排队等待执行（' + queue.length + ' 条）</span><span>当前轮次结束后自动依序送达</span></div>' +
        queue.map(function (q, qi) {
          return '<div class="cr-queue-item">' +
            '<span class="cr-queue-idx">#' + (qi + 1) + '</span>' +
            '<span class="cr-queue-txt">' + esc(q.prompt) + '</span>' +
            '<button type="button" class="cr-q-btn" data-act="gw-promote-interrupt" data-ch="' + esc(q.channelId) + '" data-sess="' + esc(q.sessionName) + '" data-prompt="' + esc(q.prompt) + '">立即插队</button>' +
          '</div>';
        }).join('') +
      '</div>'
    ) : '';

    var quickChipsBarHtml = (totalTurns === 0 && !liveRun)
      ? '<div class="cr-qp-bar">' + QUICK_PROMPTS.map(function (qp) {
          return '<button type="button" class="cr-qp-chip" data-act="quick-prompt" data-text="' + esc(qp.text) + '">' + esc(qp.label) + '</button>';
        }).join('') + '</div>'
      : '';

    var isBusy = !!(liveRun && liveRun.status === 'running');
    var actionBtnsHtml = isBusy
      ? '<button type="button" class="cr-send-btn queue" data-act="gw-send" data-mode="queue" title="不打断当前执行，排入本会话下一轮自动执行">📥 排队下一轮</button>' +
        (caps.canCancelRun ? '<button type="button" class="cr-send-btn interrupt" data-act="gw-send" data-mode="interrupt" title="立即中断当前运行并优先执行本条新指令">中断并插队</button>' : '') +
        (caps.canCancelRun ? '<button type="button" class="cr-send-btn stop" data-act="gw-cancel" data-ch="' + esc(activeCh.id) + '" data-sess="' + esc(activeSessName) + '">⏹ 停止</button>' : '')
      : '<button type="button" class="cr-send-btn primary" data-act="gw-send" data-mode="send" style="--ch-c:' + activeCh.color + '">发送</button>';

    el.innerHTML =
      liveRunsStripHtml +
      '<div class="cr-stream">' +
        windowBarHtml +
        turnsHtml +
        '<div data-cr-live-slot>' + renderLiveTurn(liveRun) + '</div>' +
      '</div>' +
      approvalsHtml +
      queueHtml +
      '<div class="cr-composer">' +
        '<div class="cr-comp-top">' +
          '<div class="cr-ch-bar">' + channelPills + '</div>' +
          '<div class="cr-comp-meta">' +
            modelControlHtml +
            '<label class="cr-sess-pick" title="选择或切换会话槽位">' +
              '<span>会话槽:</span>' +
              '<select data-cr-sess-select>' + sessOpts.join('') + '</select>' +
            '</label>' +
            (caps.canCreateSession ? '<button type="button" class="cr-new-sess-btn" data-act="new-sess" title="在当前渠道新建一个干净的独立会话槽位">+ 新会话</button>' : '') +
            (caps.canSetPermissionMode
              ? '<button type="button" class="cr-perm-btn ' + (state.permissions === 'all' ? 'all' : 'reads') + '" data-act="toggle-perm" title="切换工具执行审批策略（与【自动批准督导】元智能体联动）">' +
                  (state.permissions === 'all' ? '自动读写 (all)' : '只读安全 (reads)') +
                '</button>'
              : '') +
          '</div>' +
        '</div>' +
        metaBarHtml +
        quickChipsBarHtml +
        '<div class="cr-comp-row">' +
          '<textarea class="cr-input" data-cr-input rows="2" placeholder="向 ' + esc(activeCh.label) + ' [' + esc(activeModel) + '] (' + esc(activeSessName) + ') 发送实况指令（Enter 发送，Shift+Enter 换行）…">' + esc(state.draftText) + '</textarea>' +
          '<div class="cr-comp-acts">' + actionBtnsHtml + '</div>' +
        '</div>' +
      '</div>';

    var nextStream = el.querySelector && el.querySelector('.cr-stream');
    if (nextStream) {
      if (forceScrollBottom || wasNearBottom) nextStream.scrollTop = nextStream.scrollHeight;
      else nextStream.scrollTop = prevScroll;
    }

    if (hadFocus) {
      var nextInput = el.querySelector && el.querySelector('[data-cr-input]');
      if (nextInput) {
        nextInput.focus();
        try { if (selStart != null) nextInput.setSelectionRange(selStart, selStart); } catch (e) {}
      }
    }
  }

  /* Create a brand-new session slot on both frontend and backend, clearing old session state */
  function startNewSession(channelId, customName) {
    var ch = channelById(channelId || state.selectedChannel);
    var now = new Date();
    var hhmmss = now.toTimeString().slice(0, 8).replace(/:/g, '');
    var sessName = customName || (ch.id + '-' + hhmmss.slice(0, 4));
    // Ensure uniqueness against existing sessions in this channel
    var exists = state.sessions.some(function (s) { return s.channelId === ch.id && s.sessionName === sessName; });
    if (exists && !customName) {
      sessName = ch.id + '-' + hhmmss;
    }
    var draftTraceId = 'new:' + ch.id + ':' + sessName;
    var activeModel = state.selectedModels[ch.id] || ch.defaultModel;
    var activeCwd = state.selectedCwds[ch.id] || (state.workspaceDirs && state.workspaceDirs[0]) || 'e:\\program\\GIT\\Agent\\multi\\Agent-Architecture-Hub';

    state.selectedChannel = ch.id;
    state.selectedSessionName = sessName;
    state.selectedModels[slotKey(ch.id, sessName)] = activeModel;
    state.selectedCwds[slotKey(ch.id, sessName)] = activeCwd;
    state.lastSessionId = draftTraceId;
    state.visibleTurnLimit = DEFAULT_TURN_LIMIT;
    state.lastRenderKey = '';
    state.draftText = '';

    // Optimistically insert draft record into state.sessions so dropdowns & header immediately see it
    var already = state.sessions.some(function (s) { return s.channelId === ch.id && s.sessionName === sessName; });
    if (!already) {
      state.sessions.unshift({
        acpxRecordId: 'draft-' + ch.id + '-' + sessName,
        acpSessionId: '',
        sessionName: sessName,
        channelId: ch.id,
        channelLabel: ch.label,
        traceSessionId: draftTraceId,
        currentModel: activeModel,
        availableModels: ch.models ? ch.models.slice() : [activeModel],
        cwd: activeCwd,
        updatedAt: now.toISOString(),
        closed: false,
        pid: null,
        title: '新会话 · ' + ch.label + ' (' + sessName + ')',
        turnsCount: 0,
        lastPreview: ''
      });
    }

    // Switch HUB.store focus to the new draft session so Header, Chat, Trace Tree, and Right Sidebar all reset cleanly
    if (HUB.store) {
      HUB.store.set({
        subject: 'exec',
        depth: { exec: 1 },
        focus: { type: 'session', id: draftTraceId },
        selection: null,
        present: 'graph'
      });
    } else {
      refreshUI(true);
    }

    // Register on backend /api/gateway/session/new
    if (typeof window !== 'undefined' && window.fetch && location && (location.protocol === 'http:' || location.protocol === 'https:')) {
      fetch('/api/gateway/session/new', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel: ch.id, sessionName: sessName, model: activeModel, cwd: activeCwd })
      })
        .then(function (r) { return r.json(); })
        .then(function (res) {
          if (res && res.ok && res.record) {
            var realTraceId = res.record.traceSessionId || draftTraceId;
            if (HUB.obsTrace && HUB.obsTrace.reloadSession) {
              HUB.obsTrace.reloadSession(realTraceId);
            }
          }
          fetchGatewayState();
        })
        .catch(function () {});
    }

    if (HUB.shell && HUB.shell.toast) {
      HUB.shell.toast('已新建 ' + ch.label + ' 独立会话槽: ' + sessName);
    }

    setTimeout(function () {
      var inp = hostEl && hostEl.querySelector ? hostEl.querySelector('[data-cr-input]') : null;
      if (inp) {
        inp.value = '';
        inp.focus();
      }
    }, 30);
  }

  function submitPrompt(mode) {
    var inp = hostEl && hostEl.querySelector ? hostEl.querySelector('[data-cr-input]') : null;
    var text = inp ? inp.value.trim() : state.draftText.trim();
    if (!text) {
      if (HUB.shell && HUB.shell.toast) HUB.shell.toast('请输入要发送给智能体的指令内容');
      return;
    }
    var cur = HUB.obsTrace && HUB.obsTrace.current ? HUB.obsTrace.current(HUB.store.get(), HUB.model.current) : null;
    var sess = cur && cur.session ? cur.session : null;
    var tid = (cur && cur.id) || (sess && sess.id) || '';
    var ch = channelById(state.selectedChannel);
    var rec = matchAcpxRecord(sess, tid);
    var sessName = state.selectedSessionName || (rec && rec.sessionName) || ch.defaultSession;
    var model = activeModelFor(sess, tid);
    var cwd = activeCwdFor(sess, tid);

    state.draftText = '';
    if (inp) inp.value = '';
    state.pendingSwitchTraceId = sessName;
    state.lastRenderKey = '';

    // Optimistic live state before SSE arrives
    var k = slotKey(ch.id, sessName);
    if (mode !== 'queue' || !state.activeRuns[k]) {
      state.activeRuns[k] = {
        runId: 'pending-' + Date.now(),
        channelId: ch.id,
        sessionName: sessName,
        traceSessionId: tid,
        model: model,
        cwd: cwd,
        prompt: text,
        startedAt: new Date().toISOString(),
        status: 'running',
        thoughts: '',
        text: '',
        tools: [],
        source: 'web'
      };
      refreshUI(true);
    }

    fetch('/api/gateway/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channel: ch.id,
        sessionName: sessName,
        traceSessionId: tid || undefined,
        model: model,
        cwd: cwd,
        prompt: text,
        permissions: state.permissions,
        mode: mode || 'send',
        source: 'web'
      })
    })
      .then(function (r) { return r.json(); })
      .then(function (res) {
        if (!res.ok) throw new Error(res.error || '发送失败');
        if (res.action === 'queued') {
          if (HUB.shell && HUB.shell.toast) HUB.shell.toast('📥 已排入 ' + ch.label + ' 队列（第 ' + res.queueLength + ' 位）');
        } else {
          if (HUB.shell && HUB.shell.toast) HUB.shell.toast('已发送至 ' + ch.label + ' [' + model + '] (' + sessName + ')，等它回复…');
        }
        fetchGatewayState();
      })
      .catch(function (err) {
        delete state.activeRuns[k];
        state.lastRenderKey = '';
        refreshUI();
        if (HUB.shell && HUB.shell.toast) HUB.shell.toast('✕ 发送失败：' + err.message);
      });
  }

  function bindEvents(el) {
    if (!el || !el.addEventListener || boundHost.has(el)) return;
    boundHost.add(el);

    el.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-act]');
      if (!btn) return;
      var act = btn.getAttribute('data-act');

      if (act === 'select-span') {
        e.stopPropagation();
        var spanId = btn.getAttribute('data-span');
        if (spanId && HUB.store) {
          HUB.store.set({ selection: { type: 'span', id: spanId } }, { history: false });
        }
      } else if (act === 'toggle-ctx') {
        e.stopPropagation();
        var tk = btn.getAttribute('data-turn');
        state.expandedCtx[tk] = !state.expandedCtx[tk];
        state.lastRenderKey = '';
        refreshUI();
      } else if (act === 'toggle-think') {
        e.stopPropagation();
        var sk = btn.getAttribute('data-step');
        state.expandedThink[sk] = !state.expandedThink[sk];
        state.lastRenderKey = '';
        refreshUI();
      } else if (act === 'toggle-tools') {
        e.stopPropagation();
        var gk = btn.getAttribute('data-group');
        state.expandedTools[gk] = !state.expandedTools[gk];
        state.lastRenderKey = '';
        refreshUI();
      } else if (act === 'toggle-turn-proc') {
        e.stopPropagation();
        var ptk = btn.getAttribute('data-turn');
        var isCurrentlyOpen = btn.classList.contains('open');
        state.expandedTurnSteps[ptk] = isCurrentlyOpen ? 'closed' : 'open';
        state.lastRenderKey = '';
        refreshUI();
      } else if (act === 'load-more-turns') {
        e.stopPropagation();
        var step = Number(btn.getAttribute('data-step')) || 25;
        state.visibleTurnLimit = (state.visibleTurnLimit || DEFAULT_TURN_LIMIT) + step;
        state.lastRenderKey = '';
        refreshUI();
      } else if (act === 'load-all-turns') {
        e.stopPropagation();
        state.visibleTurnLimit = 999999;
        state.lastRenderKey = '';
        refreshUI();
      } else if (act === 'open-child-session') {
        e.stopPropagation();
        var cid = btn.getAttribute('data-id');
        if (cid && HUB.store) {
          HUB.store.set({ subject: 'exec', depth: { exec: 1 }, focus: { type: 'session', id: cid }, selection: null, present: 'graph' });
        }
      } else if (act === 'select-ch') {
        e.stopPropagation();
        var chId = btn.getAttribute('data-ch');
        openChannelControlRoom(chId);
      } else if (act === 'toggle-meta') {
        e.stopPropagation();
        var metaId = btn.getAttribute('data-meta-id');
        if (metaId) toggleMetaAgent(metaId);
      } else if (act === 'meta-patrol') {
        e.stopPropagation();
        triggerMetaPatrolNow();
      } else if (act === 'open-meta-brain') {
        e.stopPropagation();
        openMetaBrainSession();
      } else if (act === 'gw-resume') {
        e.stopPropagation();
        var cur0 = HUB.obsTrace && HUB.obsTrace.current ? HUB.obsTrace.current(HUB.store.get(), HUB.model.current) : null;
        var sess0 = cur0 && cur0.session ? cur0.session : null;
        var tid0 = (cur0 && cur0.id) || (sess0 && sess0.id) || '';
        resumeSession(state.selectedChannel, state.selectedSessionName, tid0);
      } else if (act === 'open-meta-drawer') {
        e.stopPropagation();
        if (HUB.store) {
          HUB.store.set({ selection: null, drawer: 'ctrl' }, { history: false });
        }
      } else if (act === 'toggle-perm') {
        e.stopPropagation();
        state.permissions = state.permissions === 'all' ? 'reads' : 'all';
        toggleMetaAgent('meta_approver', { enabled: state.permissions === 'all', policy: state.permissions === 'all' ? 'all' : 'reads' });
      } else if (act === 'new-sess') {
        e.stopPropagation();
        startNewSession(state.selectedChannel);
      } else if (act === 'quick-prompt') {
        e.stopPropagation();
        var qtxt = btn.getAttribute('data-text') || '';
        state.draftText = qtxt;
        var inp2 = el.querySelector('[data-cr-input]');
        if (inp2) { inp2.value = qtxt; inp2.focus(); }
      } else if (act === 'retry-turn-prompt') {
        e.stopPropagation();
        var rtxt = btn.getAttribute('data-prompt') || '';
        if (rtxt) {
          state.draftText = rtxt;
          var inpRetry = el.querySelector('[data-cr-input]');
          if (inpRetry) inpRetry.value = rtxt;
          submitPrompt('send');
        }
      } else if (act === 'gw-send') {
        e.stopPropagation();
        submitPrompt(btn.getAttribute('data-mode') || 'send');
      } else if (act === 'gw-promote-interrupt') {
        e.stopPropagation();
        state.draftText = btn.getAttribute('data-prompt') || '';
        submitPrompt('interrupt');
      } else if (act === 'gw-cancel') {
        e.stopPropagation();
        var cCh = btn.getAttribute('data-ch') || state.selectedChannel;
        var cSess = btn.getAttribute('data-sess') || state.selectedSessionName;
        fetch('/api/gateway/cancel', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ channel: cCh, sessionName: cSess })
        }).then(function () {
          if (HUB.shell && HUB.shell.toast) HUB.shell.toast('⏹ 已发送中断信号');
          fetchGatewayState();
        });
      } else if (act === 'gw-focus-run' || act === 'gw-takeover-anomaly') {
        e.stopPropagation();
        var fCh = btn.getAttribute('data-ch') || state.selectedChannel;
        var fSess = btn.getAttribute('data-sess') || '';
        var fTraceId = btn.getAttribute('data-trace-id') || ('new:' + fCh + ':' + fSess);
        state.selectedChannel = fCh;
        if (fSess) state.selectedSessionName = fSess;
        state.lastSessionId = fTraceId;
        state.lastRenderKey = '';
        if (HUB.store) {
          HUB.store.set({ subject: 'exec', depth: { exec: 1 }, focus: { type: 'session', id: fTraceId }, selection: null, present: 'graph' });
        } else {
          refreshUI(true);
        }
        if (act === 'gw-takeover-anomaly') {
          resumeSession(fCh, fSess, fTraceId, '元智能体巡检发现外部异常，人工一键接管续跑');
        }
      } else if (act === 'gw-approve-decision') {
        e.stopPropagation();
        var apId = btn.getAttribute('data-id') || '';
        var apDec = btn.getAttribute('data-decision') || 'approve';
        resolveApprovalDecision(apId, apDec);
      }
    });

    el.addEventListener('change', function (e) {
      var handoffSel = e.target.closest('[data-cr-handoff-select]');
      if (handoffSel) {
        var toChId = handoffSel.value;
        handoffSel.value = '';
        if (toChId) {
          handoffSession(toChId);
        }
        return;
      }

      var modelSel = e.target.closest('[data-cr-model-select]');
      if (modelSel) {
        var chosen = modelSel.value;
        var cur = HUB.obsTrace && HUB.obsTrace.current ? HUB.obsTrace.current(HUB.store.get(), HUB.model.current) : null;
        var sess = cur && cur.session ? cur.session : null;
        var tid = (cur && cur.id) || (sess && sess.id) || '';
        if (chosen) {
          switchModel(state.selectedChannel, state.selectedSessionName, tid, chosen);
        }
        return;
      }

      var sel = e.target.closest('[data-cr-sess-select]');
      if (!sel) return;
      state.selectedSessionName = sel.value;
      var opt = sel.options[sel.selectedIndex];
      var traceId = opt ? opt.getAttribute('data-trace-id') : '';
      if (!traceId) {
        traceId = 'new:' + state.selectedChannel + ':' + sel.value;
      }
      state.lastSessionId = traceId;
      state.visibleTurnLimit = DEFAULT_TURN_LIMIT;
      state.lastRenderKey = '';
      if (HUB.store) {
        HUB.store.set({ subject: 'exec', depth: { exec: 1 }, focus: { type: 'session', id: traceId }, selection: null, present: 'graph' });
      } else {
        refreshUI();
      }
    });

    el.addEventListener('input', function (e) {
      var inp = e.target.closest('[data-cr-input]');
      if (inp) state.draftText = inp.value;
    });

    el.addEventListener('keydown', function (e) {
      var inp = e.target.closest('[data-cr-input]');
      if (!inp) return;
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
        e.preventDefault();
        var cur = HUB.obsTrace && HUB.obsTrace.current ? HUB.obsTrace.current(HUB.store.get(), HUB.model.current) : null;
        var run = activeRunFor(cur && cur.session, cur && cur.id);
        submitPrompt(run && run.status === 'running' ? 'queue' : 'send');
      }
    });
  }

  /* Open the Control Room directly for one of the 7 channels (from Sessions sidebar or composer pills) */
  function pickBestChannelSession(chId) {
    var list = state.sessions.filter(function (s) { return s.channelId === chId; });
    if (!list.length) return null;
    var withTurns = list.find(function (s) {
      return (s.turnCount || 0) > 0 && String(s.traceSessionId || '').indexOf('new:') !== 0;
    });
    return withTurns || list[0];
  }

  function openChannelControlRoom(channelId, preferredMode) {
    var ch = channelById(channelId);
    state.selectedChannel = ch.id;
    state.visibleTurnLimit = DEFAULT_TURN_LIMIT;
    state.lastRenderKey = '';
    if (preferredMode && HUB.obsTrace && HUB.obsTrace.setViewMode) {
      HUB.obsTrace.setViewMode(preferredMode);
    }
    var match = pickBestChannelSession(ch.id);
    if (match && match.traceSessionId) {
      state.selectedSessionName = match.sessionName;
      state.lastSessionId = match.traceSessionId;
      if (HUB.store) {
        HUB.store.set({ subject: 'exec', depth: { exec: 1 }, focus: { type: 'session', id: match.traceSessionId }, selection: null, present: 'graph' });
      }
    } else {
      fetchGatewayState().then(function () {
        var m2 = pickBestChannelSession(ch.id);
        if (m2 && m2.traceSessionId && HUB.store) {
          state.selectedSessionName = m2.sessionName;
          state.lastSessionId = m2.traceSessionId;
          HUB.store.set({ subject: 'exec', depth: { exec: 1 }, focus: { type: 'session', id: m2.traceSessionId }, selection: null, present: 'graph' });
        } else {
          startNewSession(ch.id, ch.defaultSession);
        }
      });
    }
  }

  HUB.obsChat = {
    CHANNELS: CHANNELS,
    DEFAULT_META_AGENTS: DEFAULT_META_AGENTS,
    render: render,
    openChannel: openChannelControlRoom,
    startNewSession: startNewSession,
    channelForSession: channelForSession,
    activeRunFor: activeRunFor,
    activeModelFor: activeModelFor,
    availableModelsFor: availableModelsFor,
    availableCwdsFor: availableCwdsFor,
    activeCwdFor: activeCwdFor,
    capabilitiesFor: capabilitiesFor,
    canSwitchModelFor: canSwitchModelFor,
    switchModel: switchModel,
    switchCwd: switchCwd,
    isMetaEnabled: isMetaEnabled,
    toggleMetaAgent: toggleMetaAgent,
    updateMetaBrain: updateMetaBrain,
    triggerMetaPatrolNow: triggerMetaPatrolNow,
    openMetaBrainSession: openMetaBrainSession,
    resumeSession: resumeSession,
    handoffSession: handoffSession,
    resolveApprovalDecision: resolveApprovalDecision,
    ensureConnected: ensureGatewayConnected,
    getState: function () { return state; }
  };
})();
