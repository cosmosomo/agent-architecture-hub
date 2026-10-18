/* ============================================================================
 * NEXUS CONSOLE · Mode 2 Ultra-Light Control Workbench (console/console.js)
 * Zero Canvas / Zero Starfield / IndexedDB Tail Cache / Cursor Pagination
 * ============================================================================ */
(function () {
  'use strict';

  var DEFAULT_CHANNELS = [
    {
      id: 'codex', label: 'Codex', short: 'CX', color: '#10B981',
      defaultModel: 'gpt-6-luna',
      verifiedModels: ['gpt-6-luna', 'gpt-6.1-sol'],
      capabilities: { canCreateSession: true, canSendPrompt: true, canCancelRun: true, canSwitchModelOnNew: true, canSwitchModelMidSession: true, canSetPermissionMode: true, canResumeSession: true }
    },
    {
      id: 'claude', label: 'Claude', short: 'CL', color: '#F59E0B',
      defaultModel: 'haiku',
      verifiedModels: ['haiku', 'sonnet', 'opus'],
      capabilities: { canCreateSession: true, canSendPrompt: true, canCancelRun: true, canSwitchModelOnNew: true, canSwitchModelMidSession: true, canSetPermissionMode: true, canResumeSession: true }
    },
    {
      id: 'zcode', label: 'ZCode', short: 'ZC', color: '#3B82F6',
      defaultModel: 'GLM-5-Turbo',
      verifiedModels: ['GLM-5.1', 'GLM-5-Turbo', 'GLM-4.5-Air'],
      capabilities: { canCreateSession: true, canSendPrompt: true, canCancelRun: true, canSwitchModelOnNew: true, canSwitchModelMidSession: true, canSetPermissionMode: true, canResumeSession: true }
    },
    {
      id: 'workbuddy', label: 'WorkBuddy', short: 'WB', color: '#EC4899',
      defaultModel: 'glm-5-turbo',
      verifiedModels: ['glm-5-turbo', 'deepseek-v3.2', 'kimi-k2.5', 'minimax-m2.7', 'hunyuan-2.0-instruct'],
      capabilities: { canCreateSession: true, canSendPrompt: true, canCancelRun: true, canSwitchModelOnNew: true, canSwitchModelMidSession: true, canSetPermissionMode: true, canResumeSession: true }
    },
    {
      id: 'opencode', label: 'OpenCode', short: 'OC', color: '#06B6D4',
      // As advertised by `opencode acp` on 2026-10-18; the old volcengine-plan/* default is no longer offered.
      defaultModel: 'opencode/big-pickle',
      verifiedModels: [
        'opencode/big-pickle', 'zhipuai-coding-plan/glm-5.3-flash',
        'zhipuai-coding-plan/glm-5.3', 'zhipuai-coding-plan/glm-5.3-highspeed',
        'deepseek/deepseek-flash'
      ],
      capabilities: { canCreateSession: true, canSendPrompt: true, canCancelRun: true, canSwitchModelOnNew: true, canSwitchModelMidSession: true, canSetPermissionMode: true, canResumeSession: true }
    },
    {
      id: 'antigravity', label: 'AGY', short: 'AG', color: '#8B5CF6',
      defaultModel: 'agy-chat-Sub2API',
      verifiedModels: ['agy-chat-Sub2API'],
      capabilities: { canCreateSession: true, canSendPrompt: true, canCancelRun: false, canSwitchModelOnNew: false, canSwitchModelMidSession: false, canSetPermissionMode: false, canResumeSession: true }
    },
    {
      id: 'hermes', label: 'Hermes', short: 'HM', color: '#F97316',
      defaultModel: 'custom:glm-5.1',
      verifiedModels: [
        'custom:glm-5.1', 'custom:glm-5-turbo', 'custom:glm-4.5-air',
        'custom:gpt-5.4', 'custom:gpt-5.3-codex', 'custom:claude-sonnet-4-6',
        'custom:claude-opus-4-6', 'custom:gemini-3.1-pro-preview', 'custom:gemini-3-flash'
      ],
      capabilities: { canCreateSession: true, canSendPrompt: true, canCancelRun: true, canSwitchModelOnNew: true, canSwitchModelMidSession: true, canSetPermissionMode: true, canResumeSession: true }
    }
  ];

  var SLASH_COMMANDS = [
    { cmd: '/handoff', label: '跨渠道一键接力', desc: '将当前会话上下文打包接力至指定渠道' },
    { cmd: '/patrol', label: '立即执行元智能体巡检', desc: '触发总管大脑巡检所有僵死与异常会话' },
    { cmd: '/resume', label: '断点续跑当前会话', desc: '发送黄金恢复提示词继续未完成的步骤' },
    { cmd: '/new', label: '在当前渠道新建会话', desc: '创建独立命名会话并自动切换' },
    { cmd: '/board', label: '切换至协作看板视图', desc: '打开 4 列实时任务流转与会话看板' },
    { cmd: '/supervisor', label: '切换至护航总管与健康度', desc: '查看 7 渠道断路器与元智能体配置' }
  ];

  // Application State
  var S = {
    connected: false,
    view: 'chat',            // 'chat' | 'board' | 'supervisor'
    srTab: 'handoff',        // 'handoff' | 'tools' | 'telemetry'
    channelFilter: 'all',    // 'all' | channelId
    sessionFilter: '',
    activeChannel: localStorage.getItem('nx.channel') || 'zcode',
    activeSessionId: null,
    activeSessionDetail: null,
    sessionPagination: {},   // sessionId -> { totalTurns, hasOlder, olderBefore }
    loadingOlder: false,
    sessions: [],
    gwSessions: [],
    sampledSessions: [],
    channelDiskCounts: {},
    collapsedProjects: {},   // projKey -> boolean
    archivedCount: 0,
    archiveOpen: false,
    archiveLoaded: false,
    archiveQuery: '',
    archiveItems: [],
    gw: {
      channels: DEFAULT_CHANNELS,
      runs: [],
      queues: {},
      channelHealth: {},
      sessionModels: {},
      sessionCwds: {},
      pendingPermissions: [],
      metaAgents: [],
      metaRuntime: { logs: [], activePatrols: {}, resolvedSessions: {} },
      cwds: ['E:\\program\\GIT\\Agent\\multi\\Agent-Architecture-Hub', 'E:\\program\\GIT\\Agent\\multi']
    },
    composer: {
      model: '',
      cwd: 'E:\\program\\GIT\\Agent\\multi\\Agent-Architecture-Hub',
      permissionMode: 'approve-reads',
      handoffTarget: 'codex'
    },
    expandedTraces: {},      // traceKey -> boolean
    expandedToolSteps: {},   // stepKey -> boolean
    acMode: null,            // null | 'mention' | 'slash'
    acItems: [],
    acIndex: 0
  };

  // ==========================================================================
  // 1. IndexedDB Session Tail Cache (Adapted from xacpx session-tail-cache.ts)
  // ==========================================================================
  var TailCache = (function () {
    var DB_NAME = 'nx_console_cache_v1';
    var STORE = 'session_tails';
    var dbPromise = null;

    function openDb() {
      if (dbPromise) return dbPromise;
      dbPromise = new Promise(function (resolve) {
        if (typeof indexedDB === 'undefined') return resolve(null);
        try {
          var req = indexedDB.open(DB_NAME, 1);
          req.onupgradeneeded = function () {
            var db = req.result;
            if (!db.objectStoreNames.contains(STORE)) {
              db.createObjectStore(STORE, { keyPath: 'id' });
            }
          };
          req.onsuccess = function () { resolve(req.result); };
          req.onerror = function () { resolve(null); };
        } catch (e) {
          resolve(null);
        }
      });
      return dbPromise;
    }

    function get(sessionId) {
      return openDb().then(function (db) {
        if (!db || !sessionId) return null;
        return new Promise(function (resolve) {
          try {
            var tx = db.transaction(STORE, 'readonly');
            var req = tx.objectStore(STORE).get(sessionId);
            req.onsuccess = function () { resolve(req.result || null); };
            req.onerror = function () { resolve(null); };
          } catch (e) { resolve(null); }
        });
      });
    }

    function put(sessionObj, pagination) {
      if (!sessionObj || !sessionObj.id) return Promise.resolve();
      return openDb().then(function (db) {
        if (!db) return;
        try {
          var copy = Object.assign({}, sessionObj);
          if (Array.isArray(copy.turns) && copy.turns.length > 10) {
            copy.turns = copy.turns.slice(-10);
          }
          var tx = db.transaction(STORE, 'readwrite');
          tx.objectStore(STORE).put({
            id: copy.id,
            updatedAt: Date.now(),
            session: copy,
            pagination: pagination || null
          });
        } catch (e) {}
      });
    }

    return { get: get, put: put };
  })();

  // ==========================================================================
  // 2. Utility & Formatting Helpers
  // ==========================================================================
  function esc(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function toast(msg) {
    var el = document.getElementById('nxToast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { el.classList.remove('show'); }, 2800);
  }

  function getSessionChannel(sess) {
    if (!sess) return S.activeChannel || 'zcode';
    var raw = sess.channel || sess.channelId || (sess.source && sess.source.kind) || (sess.agent && sess.agent.originator) || '';
    var ch = String(raw).toLowerCase();
    if (ch === 'claude-code') return 'claude';
    if (ch === 'agy') return 'antigravity';
    return ch || S.activeChannel || 'zcode';
  }

  function cleanCwd(p) {
    return String(p || '').replace(/^"+|"+$/g, '').replace(/\\\\/g, '\\').replace(/[\\/]+$/, '');
  }

  function sanitizeTitle(raw) {
    return String(raw || '')
      .replace(/你是芙芙[，,]?\s*/g, '')
      .replace(/芙芙/g, '护航总管')
      .trim();
  }

  function getProjectDirInfo(s) {
    var raw = cleanCwd(s && s.cwd);
    if (!raw && s && s.title) {
      var m = String(s.title).match(/([a-zA-Z]:\\[\\\S]+?)(?:[\s"”】]|$)/);
      if (m) raw = cleanCwd(m[1]);
    }
    if (!raw) {
      return {
        key: '__default_workspace__',
        name: '默认工作区',
        shortDir: '未指定项目目录',
        rawCwd: 'E:\\program\\GIT\\Agent\\multi\\Agent-Architecture-Hub'
      };
    }
    var slash = raw.replace(/\\/g, '/');
    var key = slash.toLowerCase();
    var parts = slash.split('/').filter(Boolean);
    var name = parts[parts.length - 1] || raw;
    var shortDir = parts.length <= 2 ? slash : ('…/' + parts.slice(-2).join('/'));
    return {
      key: key,
      name: name,
      shortDir: shortDir,
      rawCwd: raw
    };
  }

  function normalizeSessionItem(s) {
    if (!s) return null;
    var ch = getSessionChannel(s);
    var id = s.traceSessionId || s.id || s.acpxRecordId || '';
    var logical = s.sessionName || s.logicalName || (s.agent && s.agent.name) || '';
    if (!logical) {
      var t = String(s.title || '');
      var idx = t.indexOf(':');
      logical = (idx > 0 && idx < 20) ? t.slice(idx + 1).trim() : (id.split(':').pop() || 'hub');
    }
    var model = s.currentModel || s.model || (s.agent && s.agent.model) || '';
    var turnsCount = s.turnCount != null ? s.turnCount : (s.stats && s.stats.turns != null ? s.stats.turns : (Array.isArray(s.turns) ? s.turns.length : 0));
    var cleanTitle = sanitizeTitle(s.title || (ch + ':' + logical));
    return {
      id: id,
      channel: ch,
      logicalName: logical,
      title: cleanTitle,
      cwd: cleanCwd(s.cwd),
      model: model,
      turnCount: turnsCount,
      startedAt: s.startedAt || s.createdAt || s.updatedAt,
      updatedAt: s.updatedAt || s.createdAt || s.startedAt,
      interrupted: Boolean(s.interrupted),
      closed: Boolean(s.closed),
      status: (s.state && s.state.status) || s.status || 'idle',
      stats: s.stats || { turns: turnsCount }
    };
  }

  function isSyntheticTitle(titleStr) {
    var t = String(titleStr || '').trim();
    if (!t) return false;
    var syntheticRe = /^(请只回复|Reply with exact token|用一句话说明你的角色|请用一句话汇报你的|只回复\s*OK|自我介绍$|Write a haiku|Reply with just:\s*OK)/i;
    return syntheticRe.test(t) || /PONG-|GATEWAY-|OK-SHARED-DAEMON|Do not call any tools|不要调用任何工具/i.test(t);
  }

  function rebuildMergedSessions() {
    var combined = [].concat(S.gwSessions || [], S.sampledSessions || []);
    combined.sort(function (a, b) {
      return String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''));
    });
    var seen = {};
    var perChannelCount = {};
    var MAX_PER_CHANNEL = 8; // Strict < 10 per channel
    var out = [];

    for (var i = 0; i < combined.length; i++) {
      var s = combined[i];
      if (!s || !s.id || s.id.indexOf('new:') === 0 || seen[s.id]) continue;
      if (isSyntheticTitle(s.title) && s.id !== S.activeSessionId) continue;
      var ch = getSessionChannel(s);
      var cnt = perChannelCount[ch] || 0;
      if (cnt >= MAX_PER_CHANNEL && s.id !== S.activeSessionId && !isSessionRunning(s)) continue;
      seen[s.id] = true;
      perChannelCount[ch] = cnt + 1;
      out.push(s);
    }
    S.sessions = out;
  }

  function normalizeGatewayState(gwRaw) {
    if (!gwRaw) return;
    var rawChs = Array.isArray(gwRaw.channels) && gwRaw.channels.length ? gwRaw.channels : DEFAULT_CHANNELS;
    var healthMap = Object.assign({}, gwRaw.channelHealth || {});

    var normChs = rawChs.map(function (c) {
      var def = DEFAULT_CHANNELS.find(function (d) { return d.id === c.id; }) || DEFAULT_CHANNELS[0];
      var h = c.health || healthMap[c.id] || { started: 0, delivered: 0, failed: 0, consecutiveFailures: 0, state: 'closed' };
      healthMap[c.id] = h;
      var models = (Array.isArray(c.verifiedModels) && c.verifiedModels.length)
        ? c.verifiedModels
        : ((Array.isArray(c.recommendedModels) && c.recommendedModels.length) ? c.recommendedModels : def.verifiedModels);
      return Object.assign({}, def, c, {
        color: c.color || c.accent || def.color,
        short: c.short || def.short || String(c.id).slice(0, 2).toUpperCase(),
        defaultModel: c.currentModel || c.defaultModel || def.defaultModel,
        verifiedModels: models,
        capabilities: Object.assign({}, def.capabilities, c.capabilities || {}),
        health: h
      });
    });

    var rawRuns = gwRaw.activeRuns || gwRaw.runs || [];
    var normRuns = rawRuns.map(function (r) {
      return Object.assign({}, r, {
        status: r.status || 'running',
        sessionId: r.traceSessionId || r.sessionId || '',
        startedAt: typeof r.startedAt === 'number' ? r.startedAt : (Date.parse(r.startedAt || '') || Date.now()),
        promptPreview: r.promptPreview || r.prompt || '',
        assistantText: r.assistantText || r.outputPreview || ''
      });
    });

    S.gw.channels = normChs;
    S.gw.channelHealth = healthMap;
    S.gw.runs = normRuns;
    S.gw.queues = gwRaw.queues || {};
    S.gw.pendingPermissions = gwRaw.pendingApprovals || gwRaw.pendingPermissions || [];
    S.gw.cwds = (Array.isArray(gwRaw.workspaceDirs) && gwRaw.workspaceDirs.length) ? gwRaw.workspaceDirs : S.gw.cwds;
    S.gw.metaAgents = Array.isArray(gwRaw.metaAgents) ? gwRaw.metaAgents : S.gw.metaAgents;
    S.gw.metaRuntime = {
      logs: Array.isArray(gwRaw.metaAgentLogs) ? gwRaw.metaAgentLogs : ((gwRaw.metaRuntime && gwRaw.metaRuntime.logs) || [])
    };

    if (Array.isArray(gwRaw.acpxSessions)) {
      var list = [];
      for (var i = 0; i < gwRaw.acpxSessions.length; i++) {
        var ns = normalizeSessionItem(gwRaw.acpxSessions[i]);
        if (ns && ns.id && ns.id.indexOf('new:') !== 0) {
          list.push(ns);
        }
      }
      S.gwSessions = list;
      rebuildMergedSessions();
    }
  }

  function getChannelMeta(chId) {
    var id = String(chId || '').toLowerCase();
    if (id === 'claude-code') id = 'claude';
    if (id === 'agy') id = 'antigravity';
    var list = (S.gw && Array.isArray(S.gw.channels) && S.gw.channels.length) ? S.gw.channels : DEFAULT_CHANNELS;
    for (var i = 0; i < list.length; i++) {
      if (String(list[i].id).toLowerCase() === id) return list[i];
    }
    for (var j = 0; j < DEFAULT_CHANNELS.length; j++) {
      if (DEFAULT_CHANNELS[j].id === id) return DEFAULT_CHANNELS[j];
    }
    return list[0] || DEFAULT_CHANNELS[0];
  }

  function getCaps(chId) {
    var m = getChannelMeta(chId);
    return (m && m.capabilities) || {
      canCreateSession: true, canSendPrompt: true, canCancelRun: true,
      canSwitchModelOnNew: true, canSwitchModelMidSession: true,
      canSetPermissionMode: true, canResumeSession: true
    };
  }

  function relTime(isoOrMs) {
    if (!isoOrMs) return '';
    var ts = typeof isoOrMs === 'number' ? isoOrMs : Date.parse(isoOrMs);
    if (!Number.isFinite(ts)) return '';
    var diff = Math.max(0, Math.floor((Date.now() - ts) / 1000));
    if (diff < 10) return '刚刚';
    if (diff < 60) return diff + '秒前';
    if (diff < 3600) return Math.floor(diff / 60) + '分前';
    if (diff < 86400) return Math.floor(diff / 3600) + '小时前';
    return Math.floor(diff / 86400) + '天前';
  }

  /** Folder value meaning "start this session in a new empty folder"; the gateway creates it (2026-10-18). */
  var NEW_CWD = '__new__';

  function cwdLabel(p) {
    return p === NEW_CWD ? '🆕 新目录（默认）' : '📁 ' + esc(shortPath(p));
  }

  function shortPath(p) {
    if (!p) return '';
    var s = cleanCwd(p).replace(/\\/g, '/');
    var parts = s.split('/').filter(Boolean);
    if (parts.length <= 2) return s;
    return '…/' + parts.slice(-2).join('/');
  }

  function getSessionLogicalName(sess) {
    if (!sess) return 'hub';
    if (sess.logicalName) return sess.logicalName;
    if (sess.sessionName) return sess.sessionName;
    if (sess.agent && sess.agent.name) return sess.agent.name;
    var title = String(sess.title || '');
    var idx = title.indexOf(':');
    if (idx > 0 && idx < 20) return title.slice(idx + 1).trim() || 'hub';
    return (sess.id ? String(sess.id).split(':').pop() : 'hub') || 'hub';
  }

  function isSessionRunning(sess) {
    if (!sess) return false;
    var ch = getSessionChannel(sess);
    var name = getSessionLogicalName(sess);
    var runs = (S.gw && S.gw.runs) || [];
    for (var i = 0; i < runs.length; i++) {
      var r = runs[i];
      if (r.status === 'running' && (r.sessionId === sess.id || (r.channel === ch && r.sessionName === name))) {
        return true;
      }
    }
    return false;
  }

  function getActiveRunForSession(sess) {
    if (!sess) return null;
    var ch = getSessionChannel(sess);
    var name = getSessionLogicalName(sess);
    var runs = (S.gw && S.gw.runs) || [];
    for (var i = 0; i < runs.length; i++) {
      var r = runs[i];
      if (r.status === 'running' && (r.sessionId === sess.id || (r.channel === ch && r.sessionName === name))) {
        return r;
      }
    }
    return null;
  }

  function getQueuesForSession(sess) {
    if (!sess || !S.gw || !S.gw.queues) return [];
    var ch = getSessionChannel(sess);
    var name = getSessionLogicalName(sess);
    return S.gw.queues[ch + ':' + name] || [];
  }

  function renderMarkdownLite(text) {
    var raw = String(text || '');
    if (!raw.trim()) return '';
    var blocks = [];
    var fenced = raw.replace(/```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g, function (_, lang, code) {
      var idx = blocks.length;
      blocks.push('<pre><code>' + esc(code.replace(/\n$/, '')) + '</code></pre>');
      return '\u0000CODEBLOCK_' + idx + '\u0000';
    });
    var html = esc(fenced)
      .replace(/`([^`\n]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br>');
    html = html.replace(/\u0000CODEBLOCK_(\d+)\u0000/g, function (_, idx) {
      return blocks[Number(idx)] || '';
    });
    return html;
  }

  // ==========================================================================
  // 3. Tool Summary & Turn Trace Tally (Adapted from xacpx tool-summary.ts)
  // ==========================================================================
  function classifyToolStep(tc) {
    var name = String(tc.toolName || tc.name || 'tool');
    var lower = name.toLowerCase();
    var family = String(tc.family || (tc.kind !== 'tool' ? tc.kind : '') || '').toLowerCase();
    var rawArgsObj = tc.args != null ? tc.args : (tc.input != null ? tc.input : {});
    var argsStr = typeof rawArgsObj === 'string' ? rawArgsObj : JSON.stringify(rawArgsObj || {});
    var outStr = typeof tc.output === 'string' ? tc.output : (tc.result ? JSON.stringify(tc.result) : '');

    var cat = 'other';
    var verb = '调用';
    if (/read|view_file|view|cat|open_file|get_file/.test(lower) || family === 'read') {
      cat = 'read'; verb = '读取';
    } else if (/edit|write_to_file|replace_file_content|multi_replace|write|patch|create_file/.test(lower) || family === 'edit' || family === 'write') {
      cat = 'write'; verb = '编辑';
    } else if (/bash|exec|run_command|run|shell|command|terminal|powershell|cmd/.test(lower) || family === 'shell' || family === 'execute' || family === 'command') {
      cat = 'command'; verb = '命令';
    } else if (/grep|search|glob|find|list_dir/.test(lower) || family === 'search') {
      cat = 'search'; verb = '检索';
    }

    var summary = '';
    var extBadge = '';
    try {
      var parsed = typeof rawArgsObj === 'object' && rawArgsObj ? rawArgsObj : JSON.parse(argsStr);
      summary = parsed.file_path || parsed.path || parsed.TargetFile || parsed.AbsolutePath ||
                parsed.CommandLine || parsed.command || parsed.cmd || parsed.pattern || parsed.query || parsed.Url || parsed.toolSummary || '';
    } catch (e) {}
    if (!summary) {
      var m = argsStr.match(/"(?:file_path|path|TargetFile|AbsolutePath|CommandLine|command|query|Url)"\s*:\s*"([^"]+)"/);
      if (m) summary = m[1];
    }
    summary = cleanCwd(summary) || name;

    if (cat === 'read' || cat === 'write') {
      var clean = String(summary).replace(/\\/g, '/').split('/').pop() || '';
      var dot = clean.lastIndexOf('.');
      if (dot > 0 && dot < clean.length - 1) {
        extBadge = clean.slice(dot + 1).toUpperCase().slice(0, 5);
      }
      summary = shortPath(summary);
    } else if (cat === 'command') {
      extBadge = 'SH';
    } else if (cat === 'search') {
      extBadge = 'FIND';
    }

    var addLines = 0;
    var delLines = 0;
    if (cat === 'write') {
      var comb = argsStr + '\n' + outStr;
      var plusMatches = comb.match(/^\+[^+]/gm);
      var minusMatches = comb.match(/^-[^-]/gm);
      if (plusMatches) addLines = plusMatches.length;
      if (minusMatches) delLines = minusMatches.length;
      if (!addLines && /ReplacementContent|CodeContent/.test(argsStr)) {
        addLines = Math.max(1, (argsStr.match(/\\n/g) || []).length);
      }
    }

    var failed = tc.status === 'failed' || tc.status === 'error' || Boolean(tc.error);
    var running = tc.status === 'running' || tc.status === 'in_progress' || tc.status === 'pending';

    return {
      cat: cat,
      verb: verb,
      name: name,
      extBadge: extBadge,
      summary: String(summary).slice(0, 96),
      addLines: addLines,
      delLines: delLines,
      durationMs: tc.durationMs || 0,
      failed: failed,
      running: running,
      rawArgs: argsStr,
      rawOut: outStr || (tc.error ? String(tc.error) : '')
    };
  }

  function extractTurnNormalized(turn) {
    var steps = Array.isArray(turn.steps) ? turn.steps : [];
    var userText = turn.userText || turn.input || '';
    var assistantText = turn.assistantText || turn.output || '';
    var toolSteps = Array.isArray(turn.toolCalls) ? turn.toolCalls.slice() : [];
    var reasoning = Array.isArray(turn.reasoning) ? turn.reasoning.slice() : (turn.thinking ? [turn.thinking] : []);
    var turnModel = turn.model || '';

    for (var i = 0; i < steps.length; i++) {
      var st = steps[i];
      if (!st) continue;
      if (st.kind === 'message') {
        if (st.role === 'user' && !userText && st.text) userText = st.text;
        if (st.role === 'assistant' && st.text) assistantText = st.text;
      } else if (st.kind === 'model') {
        if (st.model && !turnModel) turnModel = st.model;
        if (st.reasoning) reasoning.push(st.reasoning);
        if (st.text && !assistantText) assistantText = st.text;
      } else if (st.kind === 'tool') {
        toolSteps.push(st);
      }
    }

    var durationMs = turn.durationMs || 0;
    if (!durationMs && turn.startedAt && turn.endedAt) {
      var d = Date.parse(turn.endedAt) - Date.parse(turn.startedAt);
      if (Number.isFinite(d) && d > 0) durationMs = d;
    }

    return {
      userText: userText,
      assistantText: assistantText,
      toolSteps: toolSteps,
      reasoning: reasoning,
      model: turnModel,
      durationMs: durationMs,
      error: turn.error || (turn.status === 'failed' || turn.status === 'error' ? '该轮执行状态异常' : '')
    };
  }

  function buildTurnTally(turn, isRunningTurn) {
    var norm = extractTurnNormalized(turn);
    var tcs = norm.toolSteps;
    var reasoning = norm.reasoning;
    var counts = { read: 0, write: 0, command: 0, search: 0, other: 0, failed: 0 };
    var classified = [];

    for (var i = 0; i < tcs.length; i++) {
      var info = classifyToolStep(tcs[i]);
      classified.push(info);
      counts[info.cat] = (counts[info.cat] || 0) + 1;
      if (info.failed) counts.failed++;
    }

    var parts = [];
    if (norm.durationMs) {
      parts.push('⚡ 耗时 ' + (norm.durationMs / 1000).toFixed(1) + 's');
    } else if (isRunningTurn) {
      parts.push('⚡ 正在执行');
    }
    if (counts.read) parts.push('读取 ' + counts.read + ' 次');
    if (counts.write) parts.push('编辑 ' + counts.write + ' 次');
    if (counts.command) parts.push('命令 ' + counts.command + ' 次');
    if (counts.search) parts.push('检索 ' + counts.search + ' 次');
    if (counts.other) parts.push('调用 ' + counts.other + ' 次');
    if (reasoning.length) parts.push('思考 ' + reasoning.length + ' 段');
    if (!parts.length && (tcs.length || reasoning.length)) {
      parts.push('执行 ' + tcs.length + ' 步');
    }

    return {
      hasProcess: tcs.length > 0 || reasoning.length > 0,
      summaryText: parts.join(' · '),
      failedCount: counts.failed,
      classifiedTools: classified,
      reasoningList: reasoning,
      userText: norm.userText,
      assistantText: norm.assistantText,
      model: norm.model,
      error: norm.error
    };
  }

  // ==========================================================================
  // 4. Topbar, Dual-Mode Link & Multi-Run Live Strip
  // ==========================================================================
  function updateModeLinks() {
    var link = document.getElementById('nxHubLink');
    if (!link) return;
    if (S.activeSessionId) {
      link.setAttribute('href', '../#session=' + encodeURIComponent(S.activeSessionId));
    } else {
      link.setAttribute('href', '../');
    }
  }

  function renderTopStatus() {
    var dot = document.getElementById('nxConnDot');
    var txt = document.getElementById('nxConnText');
    var runs = (S.gw && S.gw.runs) || [];
    var runningCount = runs.filter(function (r) { return r.status === 'running'; }).length;
    if (dot) dot.classList.toggle('offline', !S.connected);
    if (txt) {
      if (!S.connected) {
        txt.textContent = '网关离线 (:8899)';
      } else if (runningCount > 0) {
        txt.textContent = '7 渠道在线 · ' + runningCount + ' 并发运行中';
      } else {
        txt.textContent = '7 渠道就绪 · :8899';
      }
    }

    var boardBadge = document.getElementById('nxBoardBadge');
    if (boardBadge) {
      var totalActive = S.sessions.length;
      boardBadge.textContent = String(totalActive);
      boardBadge.hidden = totalActive === 0;
    }

    var alertBadge = document.getElementById('nxAlertBadge');
    if (alertBadge) {
      var alertCount = countNeedsAttention();
      alertBadge.textContent = String(alertCount);
      alertBadge.hidden = alertCount === 0;
    }
  }

  function countNeedsAttention() {
    var count = 0;
    var perms = (S.gw && S.gw.pendingPermissions) || [];
    count += perms.length;
    var health = (S.gw && S.gw.channelHealth) || {};
    Object.keys(health).forEach(function (k) {
      if (health[k] && (health[k].state === 'open' || health[k].consecutiveFailures > 0)) count++;
    });
    return count;
  }

  function renderLiveStrip() {
    var strip = document.getElementById('nxLiveStrip');
    if (!strip) return;
    var runs = ((S.gw && S.gw.runs) || []).filter(function (r) { return r.status === 'running'; });
    var perms = (S.gw && S.gw.pendingPermissions) || [];

    if (!runs.length && !perms.length) {
      strip.hidden = true;
      strip.innerHTML = '';
      return;
    }

    strip.hidden = false;
    var html = '<span class="nx-section-lbl" style="margin-right:4px;">⚡ 实况并发:</span>';

    for (var i = 0; i < perms.length; i++) {
      var p = perms[i];
      html += '<button type="button" class="nx-live-pill approval" data-jump-session="' + esc(p.sessionId || '') + '">' +
        '<span>⚠️ 待审批 · ' + esc(p.channel) + ':' + esc(p.sessionName) + '</span>' +
        '<span style="color:var(--nx-warn);font-family:var(--nx-font-mono);">' + esc(p.toolName || 'tool') + '</span>' +
        '</button>';
    }

    for (var j = 0; j < runs.length; j++) {
      var r = runs[j];
      var chMeta = getChannelMeta(r.channel);
      var elapsed = Math.max(1, Math.floor((Date.now() - (r.startedAt || Date.now())) / 1000));
      html += '<button type="button" class="nx-live-pill running" data-jump-run="' + esc(r.channel + ':' + r.sessionName) + '">' +
        '<span class="nx-ch-dot" style="background:' + esc(chMeta.color) + '"></span>' +
        '<span>' + esc(chMeta.label) + ':' + esc(r.sessionName) + '</span>' +
        '<span style="color:var(--nx-run);font-family:var(--nx-font-mono);">' + elapsed + 's</span>' +
        '</button>';
    }
    strip.innerHTML = html;
  }

  // ==========================================================================
  // 5. Left Sidebar: 7-Channel Matrix + Session Tree + On-Demand Archive
  // ==========================================================================
  function renderChannelGrid() {
    var grid = document.getElementById('nxChannelGrid');
    if (!grid) return;

    var counts = { all: S.sessions.length };
    for (var i = 0; i < S.sessions.length; i++) {
      var ch = getSessionChannel(S.sessions[i]);
      counts[ch] = (counts[ch] || 0) + 1;
    }

    var channels = (S.gw && S.gw.channels && S.gw.channels.length) ? S.gw.channels : DEFAULT_CHANNELS;
    var html = '<button type="button" class="nx-ch-chip ' + (S.channelFilter === 'all' ? 'active' : '') + '" data-ch-filter="all">' +
      '<span class="nx-ch-chip-left"><span class="nx-ch-dot" style="background:var(--nx-accent)"></span><span class="nx-ch-name">全部渠道</span></span>' +
      '<span class="nx-ch-count">' + (counts.all || 0) + '</span>' +
      '</button>';

    for (var j = 0; j < channels.length; j++) {
      var c = channels[j];
      var health = (S.gw && S.gw.channelHealth && S.gw.channelHealth[c.id]) || null;
      var dotColor = c.color || '#6366F1';
      var stateTag = '';
      if (health && health.state === 'open') {
        stateTag = '🔴';
      } else if (health && health.consecutiveFailures > 0) {
        stateTag = '⚠️';
      }
      var isAct = S.channelFilter === c.id;
      html += '<button type="button" class="nx-ch-chip ' + (isAct ? 'active' : '') + '" data-ch-filter="' + esc(c.id) + '" title="' + esc(c.label + ' · 默认模型: ' + (c.defaultModel || '')) + '">' +
        '<span class="nx-ch-chip-left">' +
          '<span class="nx-ch-dot" style="background:' + esc(dotColor) + '"></span>' +
          '<span class="nx-ch-name">' + esc(c.label) + (stateTag ? ' ' + stateTag : '') + '</span>' +
        '</span>' +
        '<span class="nx-ch-count">' + (counts[c.id] || 0) + '</span>' +
      '</button>';
    }
    grid.innerHTML = html;
  }

  function renderSessionTree() {
    var tree = document.getElementById('nxSessionTree');
    if (!tree) return;

    var q = S.sessionFilter.trim().toLowerCase();
    var filtered = S.sessions.filter(function (s) {
      var ch = getSessionChannel(s);
      if (S.channelFilter !== 'all' && ch !== S.channelFilter) return false;
      if (!q) return true;
      var hay = (s.title || '') + ' ' + (s.id || '') + ' ' + ch + ' ' + (s.cwd || '') + ' ' + (s.model || '');
      return hay.toLowerCase().indexOf(q) !== -1;
    });

    if (!filtered.length) {
      tree.innerHTML = '<div style="padding:24px 12px;text-align:center;color:var(--nx-fg-muted);font-size:12px;">' +
        '暂无匹配的活跃受管会话<br><button type="button" class="nx-mini-btn primary" style="margin-top:10px;" data-act="new-session">+ 立即新建会话</button>' +
      '</div>';
      return;
    }

    // Read/display a bounded subset < 10 (max 8 sessions) while preserving project diversity & active session
    var MAX_VIEW_ITEMS = 8;
    var displayList = filtered;
    if (!q && filtered.length > MAX_VIEW_ITEMS) {
      var picked = [];
      var pickedIds = {};
      var seenProj = {};
      // 1) Always keep active session if present in filtered
      for (var a = 0; a < filtered.length; a++) {
        if (filtered[a].id === S.activeSessionId) {
          picked.push(filtered[a]);
          pickedIds[filtered[a].id] = true;
          seenProj[getProjectDirInfo(filtered[a]).key] = true;
          break;
        }
      }
      // 2) Pick latest session from each distinct project folder first
      for (var p = 0; p < filtered.length && picked.length < MAX_VIEW_ITEMS; p++) {
        var cand = filtered[p];
        var pInfo = getProjectDirInfo(cand);
        if (!pickedIds[cand.id] && !seenProj[pInfo.key]) {
          picked.push(cand);
          pickedIds[cand.id] = true;
          seenProj[pInfo.key] = true;
        }
      }
      // 3) Fill remaining slots up to MAX_VIEW_ITEMS (8 < 10) by recency
      for (var r = 0; r < filtered.length && picked.length < MAX_VIEW_ITEMS; r++) {
        var rest = filtered[r];
        if (!pickedIds[rest.id]) {
          picked.push(rest);
          pickedIds[rest.id] = true;
        }
      }
      displayList = picked;
    }

    // Group by Project Directory (cwd)
    var groupsMap = {};
    var groupsOrder = [];
    for (var i = 0; i < displayList.length; i++) {
      var s = displayList[i];
      var proj = getProjectDirInfo(s);
      if (!groupsMap[proj.key]) {
        groupsMap[proj.key] = {
          key: proj.key,
          name: proj.name,
          shortDir: proj.shortDir,
          rawCwd: proj.rawCwd,
          items: []
        };
        groupsOrder.push(groupsMap[proj.key]);
      }
      groupsMap[proj.key].items.push(s);
    }

    var chLabel = S.channelFilter === 'all' ? '全部渠道' : getChannelMeta(S.channelFilter).label;
    var html = '<div class="nx-tree-group">' +
      '<div class="nx-tree-group-hdr">' +
        '<span>📂 按项目目录 (' + groupsOrder.length + ' 个项目)</span>' +
        '<span style="font-family:var(--nx-font-mono);font-size:10px;">' + esc(chLabel) + ' · ' + displayList.length + ' 条 (&lt;10)</span>' +
      '</div>';

    for (var g = 0; g < groupsOrder.length; g++) {
      var grp = groupsOrder[g];
      var collapsed = Boolean(S.collapsedProjects[grp.key]);
      html += '<div class="nx-proj-group">' +
        '<div class="nx-proj-hdr" data-proj-toggle="' + esc(grp.key) + '" title="点击折叠/展开项目目录: ' + esc(grp.rawCwd) + '">' +
          '<div class="nx-proj-hdr-left">' +
            '<span class="nx-proj-arrow">' + (collapsed ? '▸' : '▾') + '</span>' +
            '<span>📁</span>' +
            '<span class="nx-proj-name">' + esc(grp.name) + '</span>' +
            '<span class="nx-proj-path">' + esc(grp.shortDir) + '</span>' +
          '</div>' +
          '<div class="nx-proj-hdr-right">' +
            '<span class="nx-sess-badge">' + grp.items.length + '</span>' +
            '<button type="button" class="nx-proj-new" data-proj-new="' + esc(grp.rawCwd) + '" title="在项目 [' + esc(grp.name) + '] 下新建会话">+</button>' +
          '</div>' +
        '</div>';

      if (!collapsed) {
        html += '<div class="nx-proj-body">';
        for (var j = 0; j < grp.items.length; j++) {
          var item = grp.items[j];
          var ch = getSessionChannel(item);
          var chMeta = getChannelMeta(ch);
          var isAct = item.id === S.activeSessionId;
          var running = isSessionRunning(item);
          var logical = getSessionLogicalName(item);
          var modelName = (S.gw.sessionModels && S.gw.sessionModels[chMeta.id + ':' + logical]) || item.model || chMeta.defaultModel || '';
          var turnsCount = item.turnCount != null ? item.turnCount : (item.stats && item.stats.turns != null ? item.stats.turns : 0);

          html += '<div class="nx-sess-row ' + (isAct ? 'active' : '') + '" data-sess-id="' + esc(item.id) + '">' +
            '<div class="nx-sess-top">' +
              '<span class="nx-sess-title">' +
                '<span class="nx-ch-dot" style="display:inline-block;margin-right:6px;background:' + esc(chMeta.color) + '"></span>' +
                esc(item.title || (chMeta.id + ':' + logical)) +
              '</span>' +
              (running
                ? '<span class="nx-sess-badge" style="background:var(--nx-run-soft);color:var(--nx-run);">● 运行中</span>'
                : '<span style="font-size:10px;color:var(--nx-fg-muted);">' + esc(relTime(item.updatedAt || item.startedAt)) + '</span>') +
            '</div>' +
            '<div class="nx-sess-meta">' +
              '<span class="nx-sess-badge">' + esc(chMeta.label) + '</span>' +
              (modelName ? '<span class="nx-sess-badge">' + esc(String(modelName).split('/').pop().replace(/^builtin:[^\\]+\\/i, '')) + '</span>' : '') +
              '<span>' + turnsCount + ' 轮</span>' +
            '</div>' +
          '</div>';
        }
        html += '</div>';
      }
      html += '</div>';
    }

    html += '</div>';
    tree.innerHTML = html;

    var toggle = document.getElementById('nxArchiveToggle');
    if (toggle && S.archivedCount > 0) {
      var firstSpan = toggle.querySelector('span');
      if (firstSpan) firstSpan.textContent = '📂 按需检索本机历史档案库 (' + S.archivedCount + ')';
    }
  }

  function loadArchiveSessions(query) {
    var listEl = document.getElementById('nxArchiveList');
    if (listEl) listEl.innerHTML = '<div style="padding:10px;color:var(--nx-fg-muted);font-size:11.5px;">正在检索本机历史档案…</div>';
    var url = '/api/sessions?limit=40' + (query ? '&q=' + encodeURIComponent(query) : '');
    fetch(url)
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data && data.totalCount != null) S.archivedCount = data.totalCount;
        var all = (data && data.sessions) || [];
        S.archiveItems = all.map(normalizeSessionItem).filter(Boolean);
        S.archiveLoaded = true;
        renderArchiveList();
        renderSessionTree();
      })
      .catch(function () {
        if (listEl) listEl.innerHTML = '<div style="padding:10px;color:var(--nx-danger);font-size:11.5px;">检索失败</div>';
      });
  }

  function renderArchiveList() {
    var listEl = document.getElementById('nxArchiveList');
    if (!listEl) return;
    if (!S.archiveItems.length) {
      listEl.innerHTML = '<div style="padding:10px;color:var(--nx-fg-muted);font-size:11.5px;">无匹配外部历史会话</div>';
      return;
    }
    var html = '';
    for (var i = 0; i < S.archiveItems.length; i++) {
      var s = S.archiveItems[i];
      var chMeta = getChannelMeta(getSessionChannel(s));
      html += '<div class="nx-sess-row ' + (s.id === S.activeSessionId ? 'active' : '') + '" data-sess-id="' + esc(s.id) + '">' +
        '<div class="nx-sess-top">' +
          '<span class="nx-sess-title">' + esc(s.title || s.id) + '</span>' +
          '<span class="nx-sess-badge">' + esc(chMeta.short) + '</span>' +
        '</div>' +
        '<div class="nx-sess-meta">' +
          '<span>' + esc(shortPath(s.cwd || '')) + '</span>' +
          '<span>' + esc(relTime(s.updatedAt || s.startedAt)) + '</span>' +
        '</div>' +
      '</div>';
    }
    listEl.innerHTML = html;
  }

  // ==========================================================================
  // 6. Center View 1: Conversation Workbench (Header + Stream + Composer)
  // ==========================================================================
  function selectSession(sessionId) {
    if (!sessionId) return;
    S.activeSessionId = sessionId;
    localStorage.setItem('nx.activeSessionId', sessionId);
    updateModeLinks();

    var summary = null;
    for (var i = 0; i < S.sessions.length; i++) {
      if (S.sessions[i].id === sessionId) { summary = S.sessions[i]; break; }
    }
    if (!summary) {
      for (var j = 0; j < S.archiveItems.length; j++) {
        if (S.archiveItems[j].id === sessionId) { summary = S.archiveItems[j]; break; }
      }
    }
    if (summary) {
      var ch = getSessionChannel(summary);
      if (ch) {
        S.activeChannel = ch;
        localStorage.setItem('nx.channel', ch);
      }
      var logical = getSessionLogicalName(summary);
      var chMeta = getChannelMeta(ch);
      S.composer.model = (S.gw.sessionModels && S.gw.sessionModels[ch + ':' + logical]) || summary.model || chMeta.defaultModel || '';
      S.composer.cwd = (S.gw.sessionCwds && S.gw.sessionCwds[ch + ':' + logical]) || cleanCwd(summary.cwd) || S.composer.cwd;
    }

    renderSessionTree();
    renderChatHeader();
    renderComposerToolbar();
    restoreDraftForActiveSession();

    // 1) Stale-While-Revalidate: Instant render from IndexedDB TailCache
    TailCache.get(sessionId).then(function (cached) {
      if (cached && cached.session && S.activeSessionId === sessionId && (!S.activeSessionDetail || S.activeSessionDetail.id !== sessionId)) {
        S.activeSessionDetail = cached.session;
        if (cached.pagination) S.sessionPagination[sessionId] = cached.pagination;
        renderChatHeader();
        renderChatStream(true);
        renderRightDrawer();
      }
    });

    // 2) Fetch fresh tail=15 from server
    fetchSessionDetail(sessionId, { tail: 15 });
  }

  function fetchSessionDetail(sessionId, opts) {
    opts = opts || {};
    var qs = '?compact=1';
    if (opts.before != null) {
      qs += '&before=' + encodeURIComponent(opts.before) + '&limit=' + encodeURIComponent(opts.limit || 15);
    } else {
      qs += '&tail=' + encodeURIComponent(opts.tail || 15);
    }

    return fetch('/api/sessions/' + encodeURIComponent(sessionId) + qs)
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        if (!data || !data.session) return;
        if (S.activeSessionId !== sessionId) return;

        if (opts.before != null && S.activeSessionDetail && Array.isArray(S.activeSessionDetail.turns)) {
          var olderTurns = data.session.turns || [];
          S.activeSessionDetail.turns = olderTurns.concat(S.activeSessionDetail.turns);
          S.sessionPagination[sessionId] = data.pagination || { hasOlder: false, olderBefore: null };
          S.loadingOlder = false;
          renderChatStream(false);
        } else {
          S.activeSessionDetail = data.session;
          S.sessionPagination[sessionId] = data.pagination || { hasOlder: false, olderBefore: null };
          TailCache.put(data.session, data.pagination);
          renderChatHeader();
          renderChatStream(true);
          renderComposerToolbar();
          renderRightDrawer();
        }
      })
      .catch(function () {
        S.loadingOlder = false;
      });
  }

  function renderChatHeader() {
    var hdr = document.getElementById('nxChatHeader');
    if (!hdr) return;
    var sess = S.activeSessionDetail || S.sessions.find(function (s) { return s.id === S.activeSessionId; });
    if (!sess) {
      var chMeta0 = getChannelMeta(S.activeChannel);
      hdr.innerHTML = '<div class="nx-ch-hdr-left">' +
        '<span class="nx-ch-dot" style="background:' + esc(chMeta0.color) + '"></span>' +
        '<span class="nx-ch-hdr-title">' + esc(chMeta0.label) + ' · 待命工作台</span>' +
        '<span class="nx-ctx-chip">可直接输入指令或新建会话</span>' +
      '</div>';
      return;
    }

    var ch = getSessionChannel(sess);
    var chMeta = getChannelMeta(ch);
    var caps = getCaps(ch);
    var logical = getSessionLogicalName(sess);
    var running = isSessionRunning(sess);
    var modelName = (S.gw.sessionModels && S.gw.sessionModels[ch + ':' + logical]) || sess.model || (sess.agent && sess.agent.model) || chMeta.defaultModel || '';
    var cwdPath = cleanCwd((S.gw.sessionCwds && S.gw.sessionCwds[ch + ':' + logical]) || sess.cwd || S.composer.cwd);
    var pag = S.sessionPagination[sess.id] || {};
    var totalTurns = pag.totalTurns != null ? pag.totalTurns : (Array.isArray(sess.turns) ? sess.turns.length : (sess.stats && sess.stats.turns) || 0);

    var html = '<div class="nx-ch-hdr-left">' +
      '<span class="nx-ch-dot" style="background:' + esc(chMeta.color) + '"></span>' +
      '<span class="nx-ch-hdr-title" title="' + esc(sess.id) + '">' + esc(sess.title || (ch + ':' + logical)) + '</span>' +
      '<span class="nx-ctx-chip">' + esc(chMeta.label) + '</span>' +
      (modelName ? '<span class="nx-ctx-chip">🧠 ' + esc(String(modelName).replace(/^builtin:[^\\]+\\/i, '')) + '</span>' : '') +
      (cwdPath ? '<span class="nx-ctx-chip" title="' + esc(cwdPath) + '">📁 ' + esc(shortPath(cwdPath)) + '</span>' : '') +
      '<span class="nx-ctx-chip">' + totalTurns + ' 轮对话</span>' +
    '</div>' +
    '<div class="nx-ch-hdr-actions">';

    if (running && caps.canCancelRun) {
      html += '<button type="button" class="nx-mini-btn danger" data-act="cancel-run">⏹ 中止运行</button>';
    } else if (!running && caps.canResumeSession && totalTurns > 0) {
      html += '<button type="button" class="nx-mini-btn" data-act="resume-session" title="下发断点续跑提示词">🔄 断点续跑</button>';
    }
    html += '<button type="button" class="nx-mini-btn" data-act="open-handoff" title="将当前会话上下文一键接力到其他渠道">⇄ 跨渠道接力</button>' +
      '</div>';

    hdr.innerHTML = html;
  }

  function renderApprovalBanner() {
    var banner = document.getElementById('nxApprovalBanner');
    if (!banner) return;
    var perms = (S.gw && S.gw.pendingPermissions) || [];
    if (!perms.length) {
      banner.hidden = true;
      banner.innerHTML = '';
      return;
    }
    var p = perms[0];
    banner.hidden = false;
    banner.innerHTML = '<div>' +
      '<strong style="color:var(--nx-warn);">⚠️ 权限审批请求 (' + esc(p.channel + ':' + p.sessionName) + ')</strong>' +
      '<span style="margin-left:8px;font-family:var(--nx-font-mono);font-size:11.5px;">' + esc(p.toolName || p.reason || 'tool') + ': ' + esc(String(p.argsSummary || p.promptPreview || '').slice(0, 100)) + '</span>' +
    '</div>' +
    '<div style="display:flex;gap:6px;">' +
      '<button type="button" class="nx-mini-btn primary" data-approve-id="' + esc(p.id) + '" data-approve-dec="approve">✓ 批准放行</button>' +
      '<button type="button" class="nx-mini-btn danger" data-approve-id="' + esc(p.id) + '" data-approve-dec="reject">✕ 拒绝拦截</button>' +
    '</div>';
  }

  function renderChatStream(scrollToBottom) {
    var stream = document.getElementById('nxChatStream');
    if (!stream) return;
    renderApprovalBanner();

    var sess = S.activeSessionDetail;
    if (!sess) {
      stream.innerHTML = '<div style="margin:auto;text-align:center;max-width:460px;padding:32px;color:var(--nx-fg-muted);">' +
        '<div style="font-size:28px;margin-bottom:8px;">⚡</div>' +
        '<div style="font-size:14px;font-weight:700;color:var(--nx-fg);margin-bottom:6px;">NEXUS 极速控制台已就绪</div>' +
        '<div style="font-size:12px;line-height:1.6;">零画布与仿真开销 · IndexedDB 毫秒级会话恢复 · 单行折叠工具链轨迹 · 7 大本机能力渠道实时调度。请从左侧选择会话或直接在下方发送指令。</div>' +
      '</div>';
      return;
    }

    var ch = getSessionChannel(sess);
    var chMeta = getChannelMeta(ch);
    var runningRun = getActiveRunForSession(sess);
    var turns = Array.isArray(sess.turns) ? sess.turns : [];
    var pag = S.sessionPagination[sess.id] || {};
    var html = '';

    // Incremental Cursor Pagination Button at top
    if (pag.hasOlder && pag.olderBefore != null) {
      html += '<button type="button" class="nx-older-bar" data-act="load-older" ' + (S.loadingOlder ? 'disabled' : '') + '>' +
        (S.loadingOlder
          ? '<span>⏳ 正在加载更早历史轮次…</span>'
          : '<span>↑ 加载更早的 15 轮对话 (还有 ' + pag.olderBefore + ' 轮历史)</span>') +
      '</button>';
    }

    for (var i = 0; i < turns.length; i++) {
      var t = turns[i];
      var turnIndex = t.index != null ? t.index : i;
      var traceKey = sess.id + ':turn:' + turnIndex;
      var isLastTurn = (i === turns.length - 1);
      var isTurnRunning = Boolean(runningRun && isLastTurn);
      var tally = buildTurnTally(t, isTurnRunning);
      var isTraceOpen = S.expandedTraces[traceKey] != null ? S.expandedTraces[traceKey] : (tally.failedCount > 0);
      var uText = tally.userText;
      var aText = tally.assistantText;
      var tModel = tally.model || sess.model || (sess.agent && sess.agent.model) || '';

      html += '<article class="nx-turn" data-turn-idx="' + turnIndex + '">';

      // 1) User Prompt Bubble
      if (uText) {
        html += '<div class="nx-user-row">' +
          '<div class="nx-user-bubble">' + esc(uText) + '</div>' +
        '</div>';
      }

      // 2) Agent Response & Compact Turn Trace Card
      var hasError = Boolean(tally.error) || tally.failedCount > 0;
      var isEmptySilentTurn = !isTurnRunning && !aText && !tally.hasProcess && !tally.error;

      html += '<div class="nx-agent-row ' + (isTurnRunning ? 'running' : (hasError || isEmptySilentTurn ? 'failed' : '')) + '">' +
        '<div class="nx-agent-head">' +
          '<div class="nx-agent-id">' +
            '<span class="nx-ch-dot" style="background:' + esc(chMeta.color) + '"></span>' +
            '<span>' + esc(chMeta.label) + '</span>' +
            (tModel ? '<span class="nx-sess-badge">' + esc(String(tModel).replace(/^builtin:[^\\]+\\/i, '')) + '</span>' : '') +
          '</div>' +
          '<span style="font-size:10.5px;color:var(--nx-fg-muted);">#' + (turnIndex + 1) + (t.startedAt ? ' · ' + esc(relTime(t.startedAt)) : '') + '</span>' +
        '</div>';

      // Collapsible Process Trace Header (xacpx TurnParts style)
      if (tally.hasProcess) {
        html += '<button type="button" class="nx-trace-tally" data-trace-toggle="' + esc(traceKey) + '">' +
          '<span>' + (isTraceOpen ? '▾' : '▸') + '</span>' +
          '<span class="' + (isTurnRunning ? 'nx-shimmer' : '') + '">' + esc(tally.summaryText) + '</span>' +
          (tally.failedCount > 0 ? '<span class="nx-trace-tally-fail">· ⚠ 失败 ' + tally.failedCount + ' 步</span>' : '') +
        '</button>';

        if (isTraceOpen) {
          html += '<div class="nx-trace-steps">';
          for (var cIdx = 0; cIdx < tally.classifiedTools.length; cIdx++) {
            var step = tally.classifiedTools[cIdx];
            var stepKey = traceKey + ':step:' + cIdx;
            var stepOpen = Boolean(S.expandedToolSteps[stepKey]);
            html += '<div class="nx-tool-step">' +
              '<button type="button" class="nx-tool-line" data-step-toggle="' + esc(stepKey) + '">' +
                '<span>' + (step.failed ? '❌' : (step.running ? '⏳' : '✓')) + '</span>' +
                '<span class="nx-tool-verb">' + esc(step.verb) + '</span>' +
                (step.extBadge ? '<span class="nx-tool-ext">' + esc(step.extBadge) + '</span>' : '') +
                '<span class="nx-tool-summary">' + esc(step.summary) + '</span>' +
                '<span class="nx-tool-right">' +
                  (step.addLines ? '<span class="nx-diff-add">+' + step.addLines + '</span>' : '') +
                  (step.delLines ? '<span class="nx-diff-del">−' + step.delLines + '</span>' : '') +
                  (step.durationMs ? '<span>' + (step.durationMs / 1000).toFixed(1) + 's</span>' : '') +
                '</span>' +
              '</button>' +
              (stepOpen
                ? '<div class="nx-tool-detail">' +
                    '<div><strong>参数:</strong> ' + esc(step.rawArgs || '{}') + '</div>' +
                    (step.rawOut ? '<div style="margin-top:4px;"><strong>输出:</strong> ' + esc(String(step.rawOut).slice(0, 1200)) + '</div>' : '') +
                  '</div>'
                : '') +
            '</div>';
          }
          if (tally.reasoningList.length) {
            var latestReasoning = String(tally.reasoningList[tally.reasoningList.length - 1] || '').slice(0, 420);
            if (latestReasoning) {
              html += '<div class="nx-reasoning-box">💭 <strong>思考摘要 (' + tally.reasoningList.length + ' 段):</strong> ' + esc(latestReasoning) + '</div>';
            }
          }
          html += '</div>';
        }
      }

      // Assistant Reply Body or Diagnostic Card
      if (aText) {
        html += '<div class="nx-reply-body ' + (isTurnRunning ? 'streaming' : '') + '">' + renderMarkdownLite(aText) + '</div>';
      } else if (isTurnRunning) {
        var streamBuf = (runningRun && runningRun.assistantText) ? runningRun.assistantText : '';
        if (streamBuf) {
          html += '<div class="nx-reply-body streaming">' + renderMarkdownLite(streamBuf) + '</div>';
        } else {
          html += '<div class="nx-reply-body streaming"><span class="nx-shimmer">正在思考与调度工具链…</span></div>';
        }
      } else if (tally.error || isEmptySilentTurn) {
        var errMsg = tally.error || '当前模型未返回有效输出（0 模型文本 / 0 工具调用），可能由于模型不可用或拒绝服务。';
        html += '<div style="padding:10px 12px;border-radius:8px;background:var(--nx-danger-soft);border:1px solid rgba(239,68,68,0.4);color:var(--nx-danger);font-size:12px;display:flex;align-items:center;justify-content:space-between;gap:10px;">' +
          '<span>⚠️ ' + esc(errMsg) + '</span>' +
          '<button type="button" class="nx-mini-btn" data-act="retry-default-model" data-retry-prompt="' + esc(uText || '继续') + '">切换至默认推荐模型并重试</button>' +
        '</div>';
      }

      html += '</div></article>';
    }

    if (runningRun && (!turns.length || extractTurnNormalized(turns[turns.length - 1]).userText !== runningRun.promptPreview)) {
      html += '<article class="nx-turn">' +
        '<div class="nx-user-row"><div class="nx-user-bubble">' + esc(runningRun.promptPreview || '执行中…') + '</div></div>' +
        '<div class="nx-agent-row running">' +
          '<div class="nx-agent-head"><div class="nx-agent-id"><span class="nx-ch-dot" style="background:' + esc(chMeta.color) + '"></span><span>' + esc(chMeta.label) + ' · 实时流</span></div></div>' +
          '<div class="nx-reply-body streaming">' + (runningRun.assistantText ? renderMarkdownLite(runningRun.assistantText) : '<span class="nx-shimmer">正在启动渠道进程并流式响应…</span>') + '</div>' +
        '</div>' +
      '</article>';
    }

    stream.innerHTML = html;
    if (scrollToBottom) {
      stream.scrollTop = stream.scrollHeight;
    }
  }

  // ==========================================================================
  // 7. Docked Composer: QueueStrip + Capability-Gated Controls + Autocomplete
  // ==========================================================================
  function renderQueueStrip() {
    var strip = document.getElementById('nxQueueStrip');
    if (!strip) return;
    var sess = S.activeSessionDetail || S.sessions.find(function (s) { return s.id === S.activeSessionId; });
    var qList = getQueuesForSession(sess);
    if (!qList.length) {
      strip.hidden = true;
      strip.innerHTML = '';
      return;
    }
    var ch = getSessionChannel(sess);
    var logical = getSessionLogicalName(sess);

    strip.hidden = false;
    var html = '<div style="font-size:10.5px;font-weight:700;color:var(--nx-warn);display:flex;justify-content:space-between;">' +
      '<span>⏳ 队列待发指令 (' + qList.length + ' 条将在当前轮次完成后自动顺延执行)</span>' +
    '</div>';
    for (var i = 0; i < qList.length; i++) {
      var item = qList[i];
      html += '<div class="nx-queue-item">' +
        '<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;">' + (i + 1) + '. ' + esc(item.promptPreview || '') + '</span>' +
        '<div style="display:flex;gap:5px;flex-shrink:0;">' +
          '<button type="button" class="nx-mini-btn" data-queue-recall="' + esc(item.id) + '" data-queue-ch="' + esc(ch) + '" data-queue-sess="' + esc(logical) + '" data-queue-text="' + esc(item.promptPreview || '') + '">撤回编辑</button>' +
        '</div>' +
      '</div>';
    }
    strip.innerHTML = html;
  }

  function renderComposerToolbar() {
    var top = document.getElementById('nxComposerToolbar');
    var foot = document.getElementById('nxComposerFoot');
    if (!top || !foot) return;

    var sess = S.activeSessionDetail || S.sessions.find(function (s) { return s.id === S.activeSessionId; });
    var ch = getSessionChannel(sess);
    var chMeta = getChannelMeta(ch);
    var caps = getCaps(ch);
    var logical = sess ? getSessionLogicalName(sess) : 'hub';
    var models = Array.isArray(chMeta.verifiedModels) && chMeta.verifiedModels.length ? chMeta.verifiedModels : [chMeta.defaultModel || 'default'];
    var curModel = (S.gw.sessionModels && S.gw.sessionModels[ch + ':' + logical]) || S.composer.model || (sess && (sess.model || (sess.agent && sess.agent.model))) || chMeta.defaultModel || models[0];
    // A session without a folder of its own starts in a new folder ('__new__'); the hub's own repository
    // is no longer the fallback (2026-10-18).
    var curCwd = cleanCwd((S.gw.sessionCwds && S.gw.sessionCwds[ch + ':' + logical]) || S.composer.cwd || (sess && sess.cwd) || NEW_CWD);
    var running = isSessionRunning(sess);

    var channels = (S.gw && S.gw.channels && S.gw.channels.length) ? S.gw.channels : DEFAULT_CHANNELS;
    var chOpts = '';
    for (var i = 0; i < channels.length; i++) {
      var c = channels[i];
      chOpts += '<option value="' + esc(c.id) + '" ' + (c.id === ch ? 'selected' : '') + '>' + esc(c.label) + '</option>';
    }

    var htmlTop = '<div class="nx-ctl-group">' +
      '<label style="font-size:11px;color:var(--nx-fg-muted);font-weight:700;">渠道:</label>' +
      '<select class="nx-select" id="nxCtlChannel" title="选择执行渠道">' + chOpts + '</select>';

    // Strict Capability Gating: Only show model selector if channel supports switching & has >1 model
    if ((caps.canSwitchModelMidSession || caps.canSwitchModelOnNew) && models.length > 1) {
      var mOpts = '';
      for (var m = 0; m < models.length; m++) {
        mOpts += '<option value="' + esc(models[m]) + '" ' + (models[m] === curModel ? 'selected' : '') + '>' + esc(models[m]) + '</option>';
      }
      htmlTop += '<label style="font-size:11px;color:var(--nx-fg-muted);font-weight:700;margin-left:4px;">模型:</label>' +
        '<select class="nx-select" id="nxCtlModel" title="切换已验证可用模型">' + mOpts + '</select>';
    } else {
      htmlTop += '<span class="nx-ctx-chip" title="该渠道固定使用已验证模型">🧠 ' + esc(curModel) + '</span>';
    }

    // Strict Capability Gating: Only show permission selector if channel supports permission mode
    if (caps.canSetPermissionMode) {
      var pm = S.composer.permissionMode || 'approve-reads';
      htmlTop += '<select class="nx-select" id="nxCtlPerm" title="工具调用权限策略">' +
        '<option value="approve-all" ' + (pm === 'approve-all' ? 'selected' : '') + '>⚡ 自动批准全部 (approve-all)</option>' +
        '<option value="approve-reads" ' + (pm === 'approve-reads' ? 'selected' : '') + '>🛡️ 仅自动批准读取 (approve-reads)</option>' +
        '<option value="deny-all" ' + (pm === 'deny-all' ? 'selected' : '') + '>🔒 严格拦截工具 (deny-all)</option>' +
      '</select>';
    }

    // CWD Selector
    var cwds = (S.gw && Array.isArray(S.gw.cwds) && S.gw.cwds.length) ? S.gw.cwds : [curCwd];
    if (cwds.indexOf(curCwd) === -1 && curCwd) cwds = [curCwd].concat(cwds);
    if (cwds.indexOf(NEW_CWD) === -1) cwds = [NEW_CWD].concat(cwds);
    var cwdOpts = '';
    for (var w = 0; w < cwds.length; w++) {
      cwdOpts += '<option value="' + esc(cwds[w]) + '" ' + (cwds[w] === curCwd ? 'selected' : '') + '>' + cwdLabel(cwds[w]) + '</option>';
    }
    htmlTop += '<select class="nx-select" id="nxCtlCwd" title="会话工作目录 (CWD)">' + cwdOpts + '</select>' +
      '</div>';

    htmlTop += '<div class="nx-ctl-group">' +
      '<button type="button" class="nx-mini-btn" data-act="insert-mention" title="输入 @ 跨渠道接力">@ 提及接力</button>' +
      '<button type="button" class="nx-mini-btn" data-act="insert-slash" title="输入 / 呼出快捷指令">/ 快捷指令</button>' +
    '</div>';

    top.innerHTML = htmlTop;

    var footHtml = '<div style="font-size:11px;color:var(--nx-fg-muted);display:flex;align-items:center;gap:10px;">' +
      '<span>会话槽: <strong style="color:var(--nx-fg-secondary);font-family:var(--nx-font-mono);">' + esc(ch + ':' + logical) + '</strong></span>' +
      '<span>Enter 下发 · Shift+Enter 换行</span>' +
    '</div>' +
    '<div style="display:flex;align-items:center;gap:8px;">';

    if (running) {
      if (caps.canCancelRun) {
        footHtml += '<button type="button" class="nx-mini-btn danger" data-act="interrupt-send" title="中止当前运行并立即发送框内指令">⚡ 中断并立即发送</button>';
      }
      footHtml += '<button type="button" class="nx-mini-btn primary" data-act="send-prompt">⏳ 加入排队队列 (Enter)</button>';
    } else {
      footHtml += '<button type="button" class="nx-mini-btn primary" data-act="send-prompt" style="padding:5px 14px;">🚀 发送指令 (Enter)</button>';
    }
    footHtml += '</div>';
    foot.innerHTML = footHtml;

    renderQueueStrip();
  }

  function saveDraftForActiveSession() {
    var ta = document.getElementById('nxPromptInput');
    if (!ta) return;
    var key = 'nx.draft.' + (S.activeSessionId || S.activeChannel || 'default');
    try {
      if (ta.value) localStorage.setItem(key, ta.value);
      else localStorage.removeItem(key);
    } catch (e) {}
  }

  function restoreDraftForActiveSession() {
    var ta = document.getElementById('nxPromptInput');
    if (!ta) return;
    var key = 'nx.draft.' + (S.activeSessionId || S.activeChannel || 'default');
    try {
      ta.value = localStorage.getItem(key) || '';
    } catch (e) {}
  }

  function checkAutocomplete() {
    var ta = document.getElementById('nxPromptInput');
    var pop = document.getElementById('nxAcPopover');
    if (!ta || !pop) return;
    var val = ta.value;
    var trimmed = val.trimLeft();

    if (trimmed.indexOf('/') === 0 && trimmed.indexOf(' ') === -1) {
      var q = trimmed.slice(1).toLowerCase();
      S.acMode = 'slash';
      S.acItems = SLASH_COMMANDS.filter(function (c) {
        return c.cmd.slice(1).indexOf(q) !== -1 || c.label.toLowerCase().indexOf(q) !== -1;
      });
      S.acIndex = 0;
      renderAcPopover();
      return;
    }

    var atMatch = val.match(/(?:^|\s)@([a-zA-Z0-9_-]*)$/);
    if (atMatch) {
      var mq = (atMatch[1] || '').toLowerCase();
      var channels = (S.gw && S.gw.channels && S.gw.channels.length) ? S.gw.channels : DEFAULT_CHANNELS;
      S.acMode = 'mention';
      S.acItems = channels.filter(function (c) {
        return c.id.indexOf(mq) !== -1 || c.label.toLowerCase().indexOf(mq) !== -1;
      }).map(function (c) {
        return {
          cmd: '@' + c.id,
          channelId: c.id,
          label: '接力至 ' + c.label + ' (' + (c.defaultModel || '') + ')',
          desc: '携带当前会话上下文摘要并在 ' + c.label + ' 中执行后续指令'
        };
      });
      S.acIndex = 0;
      renderAcPopover();
      return;
    }

    S.acMode = null;
    S.acItems = [];
    pop.hidden = true;
  }

  function renderAcPopover() {
    var pop = document.getElementById('nxAcPopover');
    if (!pop) return;
    if (!S.acMode || !S.acItems.length) {
      pop.hidden = true;
      return;
    }
    pop.hidden = false;
    var html = '';
    for (var i = 0; i < S.acItems.length; i++) {
      var it = S.acItems[i];
      html += '<div class="nx-ac-item ' + (i === S.acIndex ? 'active' : '') + '" data-ac-idx="' + i + '">' +
        '<div><strong style="color:var(--nx-accent);font-family:var(--nx-font-mono);">' + esc(it.cmd) + '</strong> <span style="margin-left:6px;font-weight:600;">' + esc(it.label) + '</span></div>' +
        '<span style="font-size:11px;color:var(--nx-fg-muted);">' + esc(it.desc) + '</span>' +
      '</div>';
    }
    pop.innerHTML = html;
  }

  function applyAcItem(idx) {
    var item = S.acItems[idx];
    var ta = document.getElementById('nxPromptInput');
    var pop = document.getElementById('nxAcPopover');
    if (!item || !ta) return;
    if (pop) pop.hidden = true;
    S.acMode = null;

    if (item.cmd === '/board') {
      ta.value = '';
      switchView('board');
      return;
    }
    if (item.cmd === '/supervisor') {
      ta.value = '';
      switchView('supervisor');
      return;
    }
    if (item.cmd === '/patrol') {
      ta.value = '';
      triggerSupervisorPatrol();
      return;
    }
    if (item.cmd === '/new') {
      ta.value = '';
      createNewSessionPrompt();
      return;
    }
    if (item.cmd === '/resume') {
      ta.value = '请直接从刚才中断或未完成的步骤继续执行，不要重复已完成的工作。';
      sendPromptNow();
      return;
    }
    if (item.cmd === '/handoff') {
      ta.value = '';
      S.srTab = 'handoff';
      renderRightDrawer();
      toast('已在右侧抽屉打开跨渠道接力面板');
      return;
    }
    if (item.channelId) {
      ta.value = ta.value.replace(/(?:^|\s)@([a-zA-Z0-9_-]*)$/, '@' + item.channelId + ' ');
      ta.focus();
    }
  }

  function sendPromptNow(overrideText, forceInterrupt) {
    var ta = document.getElementById('nxPromptInput');
    var text = overrideText != null ? String(overrideText).trim() : (ta ? ta.value.trim() : '');
    if (!text) {
      toast('请输入要发送的指令');
      return;
    }

    var sess = S.activeSessionDetail || S.sessions.find(function (s) { return s.id === S.activeSessionId; });
    var chSel = document.getElementById('nxCtlChannel');
    var modelSel = document.getElementById('nxCtlModel');
    var permSel = document.getElementById('nxCtlPerm');
    var cwdSel = document.getElementById('nxCtlCwd');

    var ch = (chSel && chSel.value) || String((sess && (sess.channel || sess.source)) || S.activeChannel).toLowerCase();
    var chMeta = getChannelMeta(ch);
    var logical = (sess && String(sess.channel || sess.source).toLowerCase() === ch) ? getSessionLogicalName(sess) : 'hub';
    var model = (modelSel && modelSel.value) || S.composer.model || chMeta.defaultModel || '';
    var perm = (permSel && permSel.value) || S.composer.permissionMode || 'approve-reads';
    var cwd = (cwdSel && cwdSel.value) || S.composer.cwd || 'E:\\program\\GIT\\Agent\\multi\\Agent-Architecture-Hub';

    // Check if user started with @channel for instant cross-channel handoff
    var mentionMatch = text.match(/^@([a-zA-Z0-9_-]+)\s+([\s\S]+)$/);
    if (mentionMatch) {
      var targetCh = mentionMatch[1].toLowerCase();
      var handoffInstruction = mentionMatch[2].trim();
      var targetMeta = getChannelMeta(targetCh);
      if (targetMeta && targetMeta.id === targetCh) {
        if (ta && overrideText == null) {
          ta.value = '';
          saveDraftForActiveSession();
        }
        executeCrossChannelHandoff(targetCh, targetMeta.defaultModel, handoffInstruction);
        return;
      }
    }

    var doSend = function () {
      if (ta && overrideText == null) {
        ta.value = '';
        saveDraftForActiveSession();
      }
      toast('正在向 ' + chMeta.label + ':' + logical + ' 下发指令…');
      fetch('/api/gateway/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel: ch,
          sessionName: logical,
          prompt: text,
          cwd: cwd,
          model: model,
          permissions: perm
        })
      })
        .then(function (r) { return r.json(); })
        .then(function (res) {
          if (res && res.error) {
            toast('发送失败: ' + res.error);
          } else if (res && res.status === 'queued') {
            toast('已加入会话队列 (第 ' + (res.position || 1) + ' 位)');
          } else {
            toast('✓ 指令已下发至 ' + chMeta.label);
          }
          refreshGatewayAndSessions();
        })
        .catch(function (err) {
          toast('网络异常: ' + (err && err.message ? err.message : '无法连接 :8899'));
        });
    };

    if (forceInterrupt && sess && isSessionRunning(sess)) {
      fetch('/api/gateway/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel: ch, sessionName: logical })
      }).finally(function () {
        setTimeout(doSend, 250);
      });
    } else {
      doSend();
    }
  }

  function createNewSessionPrompt(overrideCwd) {
    var chMeta = getChannelMeta(S.activeChannel);
    var defaultName = 'task-' + Math.floor(1000 + Math.random() * 9000);
    // A new session starts in a new folder unless a caller passes one; the folder can be changed afterwards.
    var targetCwd = cleanCwd(overrideCwd || NEW_CWD);
    var projLabel = targetCwd === NEW_CWD ? '新目录' : shortPath(targetCwd);
    var name = window.prompt('在渠道 [' + chMeta.label + '] · 项目目录 [' + projLabel + '] 下新建会话名称：', defaultName);
    if (!name || !name.trim()) return;
    var cleanName = name.trim().replace(/\s+/g, '-');

    var modelSel = document.getElementById('nxCtlModel');
    var model = (modelSel && modelSel.value) || chMeta.defaultModel || '';
    var cwd = targetCwd;
    S.composer.cwd = cwd;

    toast('正在创建会话 ' + chMeta.label + ':' + cleanName + '…');
    fetch('/api/gateway/session/new', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channel: chMeta.id,
        sessionName: cleanName,
        cwd: cwd,
        model: model
      })
    })
      .then(function (r) { return r.json(); })
      .then(function (res) {
        if (res && res.error) {
          toast('创建失败: ' + res.error);
          return;
        }
        toast('✓ 已创建 ' + chMeta.label + ':' + cleanName);
        refreshGatewayAndSessions(function () {
          var found = S.sessions.find(function (s) {
            return String(s.channel || s.source).toLowerCase() === chMeta.id &&
              (getSessionLogicalName(s) === cleanName || (s.title || '').indexOf(cleanName) !== -1);
          });
          if (found) selectSession(found.id);
        });
      })
      .catch(function () { toast('创建会话请求失败'); });
  }

  function executeCrossChannelHandoff(targetChannel, targetModel, extraInstruction) {
    var sess = S.activeSessionDetail || S.sessions.find(function (s) { return s.id === S.activeSessionId; });
    var fromCh = getSessionChannel(sess);
    var fromName = sess ? getSessionLogicalName(sess) : 'hub';
    var targetMeta = getChannelMeta(targetChannel);
    var sessionName = 'handoff-' + Math.floor(100 + Math.random() * 900);

    toast('⇄ 正在将任务上下文打包接力至 ' + targetMeta.label + '…');
    fetch('/api/gateway/handoff', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fromChannel: fromCh,
        fromSessionName: fromName,
        fromTraceId: sess ? sess.id : undefined,
        toChannel: targetMeta.id,
        toModel: targetModel || targetMeta.defaultModel,
        toSessionName: sessionName,
        customInstruction: extraInstruction || '请基于上述上下文直接接管并继续推进任务。'
      })
    })
      .then(function (r) { return r.json(); })
      .then(function () {
        toast('✓ 已接力至 ' + targetMeta.label + ':' + sessionName);
        S.activeChannel = targetMeta.id;
        refreshGatewayAndSessions();
      })
      .catch(function () { toast('跨渠道接力请求失败'); });
  }

  // ==========================================================================
  // 8. Center View 2: 4-Column Kanban Task & Session Board (AgentBoard pattern)
  // ==========================================================================
  function renderBoardView() {
    var hdr = document.getElementById('nxBoardHeader');
    var colsEl = document.getElementById('nxBoardColumns');
    if (!hdr || !colsEl) return;

    var perms = (S.gw && S.gw.pendingPermissions) || [];

    hdr.innerHTML = '<div>' +
      '<div style="font-size:14px;font-weight:800;">📋 多智能体实时任务与会话流转看板</div>' +
      '<div style="font-size:11.5px;color:var(--nx-fg-muted);">按实时运行态自动分列：实况运行中 · 待审批/排队阻塞 · 就绪受管工作台 · 已完成归档</div>' +
    '</div>' +
    '<div style="display:flex;gap:8px;">' +
      '<button type="button" class="nx-mini-btn" data-act="refresh-all">↻ 刷新状态</button>' +
      '<button type="button" class="nx-mini-btn primary" data-act="new-session">+ 新建任务会话</button>' +
    '</div>';

    var colRunning = [];
    var colAttention = [];
    var colActive = [];
    var colCompleted = [];

    for (var pIdx = 0; pIdx < perms.length; pIdx++) {
      colAttention.push({ type: 'perm', perm: perms[pIdx] });
    }

    for (var i = 0; i < S.sessions.length; i++) {
      var s = S.sessions[i];
      var running = isSessionRunning(s);
      var qList = getQueuesForSession(s);
      var ageMs = Date.now() - (Date.parse(s.updatedAt || s.startedAt || '') || Date.now());
      if (running) {
        colRunning.push(s);
      } else if (qList.length > 0 || s.interrupted || s.status === 'failed' || s.status === 'error') {
        colAttention.push({ type: 'session', session: s, queuedCount: qList.length });
      } else if (ageMs < 12 * 3600 * 1000) {
        colActive.push(s);
      } else {
        colCompleted.push(s);
      }
    }

    function renderCardForSession(s, extraTag) {
      var ch = getSessionChannel(s);
      var chMeta = getChannelMeta(ch);
      var logical = getSessionLogicalName(s);
      var running = isSessionRunning(s);
      var turnsCount = s.turnCount != null ? s.turnCount : (s.stats && s.stats.turns != null ? s.stats.turns : 0);
      var modelName = (S.gw.sessionModels && S.gw.sessionModels[chMeta.id + ':' + logical]) || s.model || chMeta.defaultModel || '';
      return '<div class="nx-task-card" data-board-open="' + esc(s.id) + '" style="cursor:pointer;">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;gap:6px;">' +
          '<span style="font-weight:700;font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' +
            '<span class="nx-ch-dot" style="display:inline-block;margin-right:5px;background:' + esc(chMeta.color) + '"></span>' +
            esc(s.title || (chMeta.id + ':' + logical)) +
          '</span>' +
          '<span class="nx-sess-badge">' + esc(chMeta.label) + '</span>' +
        '</div>' +
        (s.cwd ? '<div style="font-size:11px;color:var(--nx-fg-muted);font-family:var(--nx-font-mono);">📁 ' + esc(shortPath(s.cwd)) + '</div>' : '') +
        '<div style="display:flex;align-items:center;justify-content:space-between;font-size:10.5px;color:var(--nx-fg-muted);margin-top:2px;">' +
          '<span>' + esc(String(modelName).split('/').pop().replace(/^builtin:[^\\]+\\/i, '')) + ' · ' + turnsCount + ' 轮</span>' +
          '<span>' + (extraTag || (running ? '⚡ 运行中' : esc(relTime(s.updatedAt || s.startedAt)))) + '</span>' +
        '</div>' +
      '</div>';
    }

    var columnsSpec = [
      { title: '⚡ 实况执行中', badge: colRunning.length, color: 'var(--nx-run)', html: colRunning.map(function (s) { return renderCardForSession(s, '⚡ 实时流'); }).join('') },
      {
        title: '⚠️ 待审批 / 排队 / 异常', badge: colAttention.length, color: 'var(--nx-warn)',
        html: colAttention.map(function (item) {
          if (item.type === 'perm') {
            var p = item.perm;
            return '<div class="nx-task-card" style="border-color:var(--nx-warn);">' +
              '<div style="font-weight:700;color:var(--nx-warn);">⚠️ 待审批: ' + esc(p.channel + ':' + p.sessionName) + '</div>' +
              '<div style="font-family:var(--nx-font-mono);font-size:11px;">' + esc(p.toolName || p.reason || 'tool') + '</div>' +
              '<div style="display:flex;gap:6px;margin-top:4px;">' +
                '<button type="button" class="nx-mini-btn primary" data-approve-id="' + esc(p.id) + '" data-approve-dec="approve">批准</button>' +
                '<button type="button" class="nx-mini-btn danger" data-approve-id="' + esc(p.id) + '" data-approve-dec="reject">拒绝</button>' +
              '</div>' +
            '</div>';
          }
          return renderCardForSession(item.session, item.queuedCount ? ('⏳ 排队 ' + item.queuedCount) : '⚠ 待续跑');
        }).join('')
      },
      { title: '🟢 活跃受管会话', badge: colActive.length, color: 'var(--nx-accent)', html: colActive.map(function (s) { return renderCardForSession(s); }).join('') },
      { title: '📦 近期已完成', badge: colCompleted.length, color: 'var(--nx-fg-muted)', html: colCompleted.map(function (s) { return renderCardForSession(s); }).join('') }
    ];

    colsEl.innerHTML = columnsSpec.map(function (c) {
      return '<div class="nx-board-col">' +
        '<div class="nx-board-col-hdr">' +
          '<span style="color:' + c.color + '">● ' + esc(c.title) + '</span>' +
          '<span class="nx-sess-badge">' + c.badge + '</span>' +
        '</div>' +
        '<div class="nx-board-col-body thin-scroll">' +
          (c.html || '<div style="padding:20px;text-align:center;color:var(--nx-fg-muted);font-size:11.5px;">暂无卡片</div>') +
        '</div>' +
      '</div>';
    }).join('');
  }

  // ==========================================================================
  // 9. Center View 3: Meta-Agent Supervisor & 7-Channel Circuit-Breaker Health
  // ==========================================================================
  function renderSupervisorView() {
    var box = document.getElementById('nxSupContainer');
    if (!box) return;

    var metaAgents = (S.gw && S.gw.metaAgents) || [];
    var sup = metaAgents.find(function (m) { return m.id === 'meta_resumer'; }) || metaAgents[0] || {
      id: 'meta_resumer',
      name: '元智能体护航总管',
      brainChannel: 'zcode',
      brainModel: 'GLM-5-Turbo',
      enabled: true,
      patrolIntervalSec: 15
    };
    var curBrainCh = sup.brainChannel || sup.channel || 'zcode';
    var curBrainMod = String(sup.brainModel || sup.model || 'GLM-5-Turbo').replace(/^builtin:[^\\]+\\/i, '');

    var runtime = (S.gw && S.gw.metaRuntime) || { logs: [] };
    var logs = Array.isArray(runtime.logs) ? runtime.logs.slice(0, 25) : [];
    var channels = (S.gw && S.gw.channels && S.gw.channels.length) ? S.gw.channels : DEFAULT_CHANNELS;
    var healthMap = (S.gw && S.gw.channelHealth) || {};

    var chOpts = channels.map(function (c) {
      return '<option value="' + esc(c.id) + '" ' + (c.id === curBrainCh ? 'selected' : '') + '>' + esc(c.label) + '</option>';
    }).join('');
    var supChMeta = getChannelMeta(curBrainCh);
    var supModels = (supChMeta && supChMeta.verifiedModels && supChMeta.verifiedModels.length) ? supChMeta.verifiedModels.slice() : [curBrainMod];
    if (supModels.indexOf(curBrainMod) === -1 && curBrainMod) supModels.unshift(curBrainMod);
    var modelOpts = supModels.map(function (m) {
      return '<option value="' + esc(m) + '" ' + (m === curBrainMod ? 'selected' : '') + '>' + esc(m) + '</option>';
    }).join('');

    var html = '';

    // Card 1: 7-Channel Circuit-Breaker & Delivery Matrix
    html += '<div class="nx-sup-card">' +
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">' +
        '<div>' +
          '<div style="font-size:14px;font-weight:800;">🔌 7 大本机能力渠道 · 断路器与投递健康度矩阵</div>' +
          '<div style="font-size:11.5px;color:var(--nx-fg-muted);">实时追踪各渠道启动次数 (Started)、成功投递 (Delivered)、失败次数与断路器状态 (Closed / Probing / Open)</div>' +
        '</div>' +
        '<button type="button" class="nx-mini-btn" data-act="refresh-all">↻ 刷新指标</button>' +
      '</div>' +
      '<div class="nx-sup-grid">';

    for (var i = 0; i < channels.length; i++) {
      var c = channels[i];
      var h = healthMap[c.id] || c.health || { state: 'closed', started: 0, delivered: 0, failed: 0, consecutiveFailures: 0, lastError: null };
      var badgeColor = h.state === 'open' ? 'var(--nx-danger)' : (h.consecutiveFailures > 0 ? 'var(--nx-warn)' : 'var(--nx-run)');
      var badgeText = h.state === 'open' ? 'OPEN (熔断冷却)' : (h.consecutiveFailures > 0 ? 'WARN (波动)' : 'CLOSED (健康)');
      html += '<div class="nx-health-card">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;">' +
          '<span style="font-weight:700;font-size:12.5px;"><span class="nx-ch-dot" style="display:inline-block;margin-right:6px;background:' + esc(c.color) + '"></span>' + esc(c.label) + '</span>' +
          '<span style="font-size:10px;font-weight:700;color:' + badgeColor + ';font-family:var(--nx-font-mono);">● ' + badgeText + '</span>' +
        '</div>' +
        '<div style="display:flex;gap:12px;font-size:11px;color:var(--nx-fg-secondary);font-family:var(--nx-font-mono);margin-top:4px;">' +
          '<span>启动: <b>' + (h.started || 0) + '</b></span>' +
          '<span style="color:var(--nx-run);">成功: <b>' + (h.delivered || 0) + '</b></span>' +
          '<span style="color:' + ((h.failed || 0) > 0 ? 'var(--nx-danger)' : 'var(--nx-fg-muted)') + ';">失败: <b>' + (h.failed || 0) + '</b></span>' +
        '</div>' +
        '<div style="font-size:10.5px;color:var(--nx-fg-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' +
          (h.lastError ? ('最近异常: ' + esc(h.lastError)) : ('默认大脑: ' + esc(c.defaultModel || ''))) +
        '</div>' +
      '</div>';
    }
    html += '</div></div>';

    // Card 2: Meta-Agent Supervisor Brain Configuration & 4 Guard Modules
    html += '<div class="nx-sup-card">' +
      '<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:12px;">' +
        '<div>' +
          '<div style="font-size:14px;font-weight:800;">🛡️ 元智能体护航总管大脑 (Meta-Brain Supervisor)</div>' +
          '<div style="font-size:11.5px;color:var(--nx-fg-muted);">常驻后台定期巡检或由特殊事件触发，自动调用指定 Agent+模型大脑诊断僵死会话、批准安全操作与断点续跑</div>' +
        '</div>' +
        '<div style="display:flex;gap:8px;">' +
          '<button type="button" class="nx-mini-btn primary" data-act="sup-patrol">⚡ 立即唤醒总管巡检</button>' +
          '<button type="button" class="nx-mini-btn" data-act="sup-save">💾 同步总管大脑配置</button>' +
        '</div>' +
      '</div>' +
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;padding:12px;border-radius:9px;background:var(--nx-surface-2);border:1px solid var(--nx-border);">' +
        '<div>' +
          '<label style="font-size:11px;color:var(--nx-fg-muted);display:block;margin-bottom:4px;">总管宿主渠道 (Brain Channel)</label>' +
          '<select class="nx-select" id="nxSupChannel" style="width:100%;max-width:none;">' + chOpts + '</select>' +
        '</div>' +
        '<div>' +
          '<label style="font-size:11px;color:var(--nx-fg-muted);display:block;margin-bottom:4px;">总管推理模型 (Brain Model)</label>' +
          '<select class="nx-select" id="nxSupModel" style="width:100%;max-width:none;">' + modelOpts + '</select>' +
        '</div>' +
        '<div>' +
          '<label style="font-size:11px;color:var(--nx-fg-muted);display:block;margin-bottom:4px;">后台巡检周期 (秒)</label>' +
          '<input type="number" class="nx-select" id="nxSupInterval" value="' + esc(sup.patrolIntervalSec || 15) + '" min="10" max="600" style="width:100%;max-width:none;">' +
        '</div>' +
      '</div>' +
      '<div class="nx-sup-grid" style="margin-top:12px;">' +
        metaAgents.map(function (m) {
          return '<div class="nx-health-card">' +
            '<div style="display:flex;align-items:center;justify-content:space-between;">' +
              '<span style="font-weight:700;font-size:12px;">' + esc(m.badge || '🛡️') + ' · ' + esc(m.name) + '</span>' +
              '<span class="nx-sess-badge">已触发 ' + (m.triggersCount || 0) + ' 次</span>' +
            '</div>' +
            '<div style="font-size:11px;color:var(--nx-fg-muted);line-height:1.45;">' + esc(m.description || '') + '</div>' +
          '</div>';
        }).join('') +
      '</div>' +
    '</div>';

    // Card 3: Live Supervisor Patrol & Event Trigger Log Stream
    html += '<div class="nx-sup-card">' +
      '<div style="font-size:13px;font-weight:800;margin-bottom:10px;">📜 护航总管实时决策与干预日志 (' + logs.length + ')</div>' +
      '<div style="display:flex;flex-direction:column;gap:6px;max-height:320px;overflow-y:auto;" class="thin-scroll">';

    if (!logs.length) {
      html += '<div style="padding:16px;text-align:center;color:var(--nx-fg-muted);font-size:12px;">暂无巡检异常记录，点击右上角「⚡ 立即唤醒总管巡检」可立即触发元智能体大脑扫描。</div>';
    } else {
      for (var l = 0; l < logs.length; l++) {
        var entry = logs[l];
        html += '<div style="padding:8px 10px;border-radius:7px;background:var(--nx-surface-2);border:1px solid var(--nx-border);font-size:11.5px;display:flex;justify-content:space-between;gap:10px;">' +
          '<div>' +
            '<span class="nx-sess-badge" style="margin-right:6px;">' + esc(entry.action || entry.metaName || 'PATROL') + '</span>' +
            '<strong>' + esc((entry.channel ? entry.channel + ':' : '') + (entry.sessionName || entry.targetSession || '')) + '</strong> ' +
            '<span style="color:var(--nx-fg-secondary);margin-left:4px;">' + esc(entry.detail || entry.summary || entry.message || '') + '</span>' +
          '</div>' +
          '<span style="color:var(--nx-fg-muted);font-family:var(--nx-font-mono);flex-shrink:0;">' + esc(relTime(entry.at || entry.ts || entry.timestamp)) + '</span>' +
        '</div>';
      }
    }
    html += '</div></div>';

    box.innerHTML = html;
  }

  function triggerSupervisorPatrol() {
    var sess = S.activeSessionDetail || S.sessions.find(function (s) { return s.id === S.activeSessionId; });
    var ch = getSessionChannel(sess);
    var logical = sess ? getSessionLogicalName(sess) : 'hub-codex';
    toast('🛡️ 正在唤醒元智能体总管大脑执行巡检…');
    fetch('/api/gateway/meta-agents/patrol', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agentId: 'meta_maint',
        eventKind: 'manual_patrol',
        targetChannel: ch,
        targetSession: logical
      })
    })
      .then(function (r) { return r.json(); })
      .then(function () {
        toast('✓ 元智能体巡检已触发');
        refreshGatewayAndSessions();
      })
      .catch(function () { toast('巡检触发失败'); });
  }

  function saveSupervisorConfig() {
    var chEl = document.getElementById('nxSupChannel');
    var modEl = document.getElementById('nxSupModel');
    var intEl = document.getElementById('nxSupInterval');

    var payload = {
      id: 'meta_resumer',
      applyToAll: true,
      enabled: true,
      brainChannel: chEl ? chEl.value : 'zcode',
      brainModel: modEl ? modEl.value : 'GLM-5-Turbo',
      patrolIntervalSec: intEl ? Number(intEl.value) : 15
    };

    fetch('/api/gateway/meta-agents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(function (r) { return r.json(); })
      .then(function () {
        toast('✓ 已同步所有督导单元的总管大脑配置');
        refreshGatewayAndSessions();
      })
      .catch(function () { toast('保存失败'); });
  }

  // ==========================================================================
  // 10. Right Resizable Inspector Drawer (Handoff | Tools | Telemetry)
  // ==========================================================================
  function renderRightDrawer() {
    var body = document.getElementById('nxSrBody');
    if (!body) return;

    var sess = S.activeSessionDetail || S.sessions.find(function (s) { return s.id === S.activeSessionId; });
    var ch = getSessionChannel(sess);
    var chMeta = getChannelMeta(ch);
    var logical = sess ? getSessionLogicalName(sess) : 'hub';

    if (S.srTab === 'handoff') {
      var channels = (S.gw && S.gw.channels && S.gw.channels.length) ? S.gw.channels : DEFAULT_CHANNELS;
      var targetCh = S.composer.handoffTarget || (ch === 'codex' ? 'zcode' : 'codex');
      var targetMeta = getChannelMeta(targetCh);
      var targetModels = (targetMeta && targetMeta.verifiedModels) || [targetMeta.defaultModel];

      body.innerHTML = '<div style="display:flex;flex-direction:column;gap:10px;">' +
        '<div style="font-size:12.5px;font-weight:800;">⇄ 跨渠道上下文一键接力</div>' +
        '<div style="font-size:11.5px;color:var(--nx-fg-muted);line-height:1.5;">将当前会话最近核心上下文与结论自动打包，无缝移交至另一本机 Agent 渠道继续执行。</div>' +
        '<div>' +
          '<label style="font-size:11px;color:var(--nx-fg-muted);display:block;margin-bottom:4px;">目标接力渠道</label>' +
          '<select class="nx-select" id="nxHandoffCh" style="width:100%;max-width:none;">' +
            channels.map(function (c) {
              return '<option value="' + esc(c.id) + '" ' + (c.id === targetCh ? 'selected' : '') + '>' + esc(c.label) + '</option>';
            }).join('') +
          '</select>' +
        '</div>' +
        '<div>' +
          '<label style="font-size:11px;color:var(--nx-fg-muted);display:block;margin-bottom:4px;">目标渠道模型</label>' +
          '<select class="nx-select" id="nxHandoffModel" style="width:100%;max-width:none;">' +
            targetModels.map(function (m) {
              return '<option value="' + esc(m) + '">' + esc(m) + '</option>';
            }).join('') +
          '</select>' +
        '</div>' +
        '<div>' +
          '<label style="font-size:11px;color:var(--nx-fg-muted);display:block;margin-bottom:4px;">附加接力指令</label>' +
          '<textarea id="nxHandoffPrompt" rows="4" style="width:100%;padding:8px;border-radius:7px;border:1px solid var(--nx-border-strong);background:var(--nx-bg);color:var(--nx-fg);font-size:12px;" placeholder="请基于上述上下文继续完成代码实现与验证…"></textarea>' +
        '</div>' +
        '<button type="button" class="nx-mini-btn primary" data-act="exec-handoff" style="justify-content:center;padding:7px 12px;">🚀 立即打包并跨渠道接力</button>' +
      '</div>';
      return;
    }

    if (S.srTab === 'tools') {
      var turns = (sess && Array.isArray(sess.turns)) ? sess.turns : [];
      var allTools = [];
      for (var i = Math.max(0, turns.length - 10); i < turns.length; i++) {
        var norm = extractTurnNormalized(turns[i]);
        for (var j = 0; j < norm.toolSteps.length; j++) {
          allTools.push(classifyToolStep(norm.toolSteps[j]));
        }
      }
      if (!allTools.length) {
        body.innerHTML = '<div style="padding:20px;text-align:center;color:var(--nx-fg-muted);font-size:12px;">当前会话最近轮次暂无工具调用记录</div>';
        return;
      }
      var listHtml = '<div style="font-size:12px;font-weight:700;margin-bottom:4px;">最近工具与文件操作 (' + allTools.length + ')</div>';
      for (var k = allTools.length - 1; k >= 0; k--) {
        var st = allTools[k];
        listHtml += '<div style="padding:6px 8px;border-radius:7px;background:var(--nx-surface-2);border:1px solid var(--nx-border);font-size:11px;display:flex;align-items:center;justify-content:space-between;gap:6px;">' +
          '<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"><b>' + esc(st.verb) + '</b> ' + esc(st.summary) + '</span>' +
          '<span style="font-family:var(--nx-font-mono);flex-shrink:0;">' +
            (st.addLines ? '<span class="nx-diff-add">+' + st.addLines + '</span> ' : '') +
            (st.delLines ? '<span class="nx-diff-del">−' + st.delLines + '</span>' : '') +
          '</span>' +
        '</div>';
      }
      body.innerHTML = listHtml;
      return;
    }

    var cliCmd = 'acpx ' + ch + ' -s ' + logical + ' --cwd "' + S.composer.cwd + '" "你的指令"';
    body.innerHTML = '<div style="display:flex;flex-direction:column;gap:10px;font-size:11.5px;">' +
      '<div style="font-size:12.5px;font-weight:800;">📊 会话遥测与原生 CLI 对照</div>' +
      '<div style="padding:9px;border-radius:8px;background:var(--nx-surface-2);border:1px solid var(--nx-border);">' +
        '<div><b>会话 ID:</b> <span style="font-family:var(--nx-font-mono);">' + esc((sess && sess.id) || '未选择') + '</span></div>' +
        '<div style="margin-top:4px;"><b>所属渠道:</b> ' + esc(chMeta.label) + ' (' + esc(ch) + ')</div>' +
        '<div style="margin-top:4px;"><b>逻辑槽位:</b> <span style="font-family:var(--nx-font-mono);">' + esc(logical) + '</span></div>' +
      '</div>' +
      '<div>' +
        '<div style="font-weight:700;margin-bottom:4px;">等价终端 CLI 命令:</div>' +
        '<pre style="padding:8px;border-radius:7px;background:var(--nx-bg);border:1px solid var(--nx-border-strong);font-family:var(--nx-font-mono);font-size:11px;white-space:pre-wrap;word-break:break-all;margin:0;">' + esc(cliCmd) + '</pre>' +
      '</div>' +
    '</div>';
  }

  // ==========================================================================
  // 11. Command Palette (Ctrl+K) & View Switcher
  // ==========================================================================
  function switchView(viewName) {
    S.view = viewName;
    var tabs = document.querySelectorAll('.nx-view-tab');
    for (var i = 0; i < tabs.length; i++) {
      var t = tabs[i];
      var isAct = t.getAttribute('data-view') === viewName;
      t.classList.toggle('active', isAct);
      t.setAttribute('aria-selected', isAct ? 'true' : 'false');
    }
    var panes = document.querySelectorAll('.nx-view-pane');
    for (var j = 0; j < panes.length; j++) {
      var p = panes[j];
      var match = p.getAttribute('data-pane') === viewName;
      p.classList.toggle('active', match);
      p.hidden = !match;
    }
    if (viewName === 'board') renderBoardView();
    if (viewName === 'supervisor') renderSupervisorView();
  }

  function openCommandPalette() {
    var modal = document.getElementById('nxCmdModal');
    var input = document.getElementById('nxCmdInput');
    if (!modal || !input) return;
    modal.hidden = false;
    input.value = '';
    renderCommandList('');
    setTimeout(function () { input.focus(); }, 20);
  }

  function closeCommandPalette() {
    var modal = document.getElementById('nxCmdModal');
    if (modal) modal.hidden = true;
  }

  function renderCommandList(query) {
    var listEl = document.getElementById('nxCmdList');
    if (!listEl) return;
    var q = String(query || '').trim().toLowerCase();

    var items = [
      { id: 'act:new', title: '+ 在当前渠道新建独立命名会话', tag: '动作' },
      { id: 'view:chat', title: '💬 切换至：实况对话台', tag: '视图' },
      { id: 'view:board', title: '📋 切换至：4 列协作看板', tag: '视图' },
      { id: 'view:supervisor', title: '🛡️ 切换至：护航总管与 7 渠道断路器健康度', tag: '视图' },
      { id: 'act:patrol', title: '⚡ 立即触发元智能体总管全量巡检', tag: '护航' },
      { id: 'act:theme', title: '☀ 切换深色 / 浅色高对比度主题', tag: '外观' },
      { id: 'act:hub', title: '🌌 切换至模式一：60 智能体架构拓扑 Hub', tag: '模式切换' }
    ];

    for (var i = 0; i < S.sessions.length; i++) {
      var s = S.sessions[i];
      items.push({
        id: 'sess:' + s.id,
        title: '会话 · ' + (s.title || s.id),
        tag: getSessionChannel(s).toUpperCase()
      });
    }

    var filtered = items.filter(function (it) {
      return !q || it.title.toLowerCase().indexOf(q) !== -1 || it.tag.toLowerCase().indexOf(q) !== -1;
    }).slice(0, 18);

    listEl.innerHTML = filtered.map(function (it) {
      return '<div class="nx-cmd-row" data-cmd-pick="' + esc(it.id) + '">' +
        '<span>' + esc(it.title) + '</span>' +
        '<span class="nx-sess-badge">' + esc(it.tag) + '</span>' +
      '</div>';
    }).join('');
  }

  // ==========================================================================
  // 12. Gateway Sync, SSE Stream & Event Delegation
  // ==========================================================================
  function refreshGatewayAndSessions(cb) {
    var reqs = [
      fetch('/api/gateway/state').then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }),
      fetch('/api/sessions?perChannel=8').then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; })
    ];

    Promise.all(reqs).then(function (res) {
      var gwState = res[0];
      var sessMeta = res[1];

      if (sessMeta) {
        if (sessMeta.totalCount != null) S.archivedCount = sessMeta.totalCount;
        if (sessMeta.channelCounts) S.channelDiskCounts = sessMeta.channelCounts;
        if (Array.isArray(sessMeta.sessions)) {
          S.sampledSessions = sessMeta.sessions.map(normalizeSessionItem).filter(Boolean);
        }
      }

      if (gwState) {
        S.connected = true;
        normalizeGatewayState(gwState);
      } else {
        S.connected = false;
        rebuildMergedSessions();
      }

      if (!S.activeSessionId && S.sessions.length) {
        var hashMatch = location.hash.match(/session=([^&]+)/);
        var saved = (hashMatch && decodeURIComponent(hashMatch[1])) || localStorage.getItem('nx.activeSessionId');
        var target = S.sessions.find(function (s) { return s.id === saved; }) || S.sessions[0];
        if (target) {
          selectSession(target.id);
        }
      } else if (S.activeSessionId) {
        fetchSessionDetail(S.activeSessionId, { tail: 15 });
      }

      renderTopStatus();
      renderLiveStrip();
      renderChannelGrid();
      renderSessionTree();
      renderChatHeader();
      renderComposerToolbar();
      if (S.view === 'board') renderBoardView();
      if (S.view === 'supervisor') renderSupervisorView();
      if (typeof cb === 'function') cb();
    });
  }

  function connectSSE() {
    if (typeof EventSource === 'undefined') return;
    var es = new EventSource('/api/gateway/stream');
    es.onopen = function () {
      S.connected = true;
      renderTopStatus();
    };
    es.onerror = function () {
      S.connected = false;
      renderTopStatus();
    };
    es.onmessage = function (ev) {
      try {
        var data = JSON.parse(ev.data);
        if (!data) return;
        if (data.type === 'state' && data.state) {
          S.connected = true;
          normalizeGatewayState(data.state);
          renderTopStatus();
          renderLiveStrip();
          renderChannelGrid();
          renderSessionTree();
          renderQueueStrip();
          renderApprovalBanner();
          if (S.view === 'board') renderBoardView();
          if (S.view === 'supervisor') renderSupervisorView();
        } else if (data.type === 'delta' || data.type === 'turn_complete' || data.type === 'run_finished') {
          if (S.activeSessionId) {
            fetchSessionDetail(S.activeSessionId, { tail: 15 });
          }
          if (data.type === 'run_finished') {
            refreshGatewayAndSessions();
          }
        }
      } catch (e) {}
    };
  }

  function toggleTheme() {
    var htmlEl = document.documentElement;
    var isLight = htmlEl.getAttribute('data-theme') === 'light';
    if (isLight) {
      htmlEl.removeAttribute('data-theme');
      localStorage.setItem('hub.theme', 'dark');
    } else {
      htmlEl.setAttribute('data-theme', 'light');
      localStorage.setItem('hub.theme', 'light');
    }
  }

  function bindEvents() {
    document.addEventListener('click', function (e) {
      var target = e.target;
      if (!target || !target.closest) return;

      var viewTab = target.closest('.nx-view-tab');
      if (viewTab) {
        switchView(viewTab.getAttribute('data-view'));
        return;
      }

      var srTab = target.closest('.nx-sr-tab');
      if (srTab) {
        S.srTab = srTab.getAttribute('data-srtab') || 'handoff';
        var allSr = document.querySelectorAll('.nx-sr-tab');
        for (var i = 0; i < allSr.length; i++) {
          allSr[i].classList.toggle('active', allSr[i] === srTab);
        }
        renderRightDrawer();
        return;
      }

      var chChip = target.closest('[data-ch-filter]');
      if (chChip) {
        var f = chChip.getAttribute('data-ch-filter');
        S.channelFilter = f;
        if (f !== 'all') {
          S.activeChannel = f;
          localStorage.setItem('nx.channel', f);
          renderComposerToolbar();
        }
        renderChannelGrid();
        renderSessionTree();
        return;
      }

      var projNew = target.closest('[data-proj-new]');
      if (projNew) {
        e.stopPropagation();
        createNewSessionPrompt(projNew.getAttribute('data-proj-new'));
        return;
      }

      var projToggle = target.closest('[data-proj-toggle]');
      if (projToggle) {
        var pk = projToggle.getAttribute('data-proj-toggle');
        S.collapsedProjects[pk] = !S.collapsedProjects[pk];
        renderSessionTree();
        return;
      }

      // Live-strip pills: jump to the session that is waiting for approval / running (they had no handler).
      var jumpPill = target.closest('[data-jump-session],[data-jump-run]');
      if (jumpPill) {
        var jumpId = jumpPill.getAttribute('data-jump-session');
        var jumpRun = jumpPill.getAttribute('data-jump-run');
        if (!jumpId && jumpRun) {
          for (var ji = 0; ji < S.sessions.length; ji++) {
            var js = S.sessions[ji];
            if (getSessionChannel(js) + ':' + getSessionLogicalName(js) === jumpRun) { jumpId = js.id; break; }
          }
        }
        if (jumpId) {
          selectSession(jumpId);
          if (S.view !== 'chat') switchView('chat');
        } else {
          toast('没有找到对应的会话');
        }
        return;
      }

      var sessRow = target.closest('[data-sess-id]');
      if (sessRow) {
        selectSession(sessRow.getAttribute('data-sess-id'));
        if (S.view !== 'chat') switchView('chat');
        return;
      }

      var boardCard = target.closest('[data-board-open]');
      if (boardCard) {
        selectSession(boardCard.getAttribute('data-board-open'));
        switchView('chat');
        return;
      }

      var traceToggle = target.closest('[data-trace-toggle]');
      if (traceToggle) {
        var tk = traceToggle.getAttribute('data-trace-toggle');
        S.expandedTraces[tk] = !S.expandedTraces[tk];
        renderChatStream(false);
        return;
      }

      var stepToggle = target.closest('[data-step-toggle]');
      if (stepToggle) {
        var sk = stepToggle.getAttribute('data-step-toggle');
        S.expandedToolSteps[sk] = !S.expandedToolSteps[sk];
        renderChatStream(false);
        return;
      }

      var approveBtn = target.closest('[data-approve-id]');
      if (approveBtn) {
        var pid = approveBtn.getAttribute('data-approve-id');
        var dec = approveBtn.getAttribute('data-approve-dec');
        fetch('/api/gateway/approve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: pid, decision: (dec === 'reject' || dec === 'deny') ? 'reject' : 'approve' })
        }).then(function () {
          toast('✓ 已处理权限审批');
          refreshGatewayAndSessions();
        });
        return;
      }

      // Queue Recall Button
      var qRecall = target.closest('[data-queue-recall]');
      if (qRecall) {
        var qId = qRecall.getAttribute('data-queue-recall');
        var qCh = qRecall.getAttribute('data-queue-ch');
        var qSess = qRecall.getAttribute('data-queue-sess');
        var qText = qRecall.getAttribute('data-queue-text') || '';
        fetch('/api/gateway/cancel', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ channel: qCh, sessionName: qSess, queuedId: qId })
        }).then(function () {
          var ta = document.getElementById('nxPromptInput');
          if (ta) {
            ta.value = qText;
            ta.focus();
          }
          toast('已撤回排队指令至输入框');
          refreshGatewayAndSessions();
        });
        return;
      }

      // Autocomplete Item Click
      var acItem = target.closest('[data-ac-idx]');
      if (acItem) {
        applyAcItem(Number(acItem.getAttribute('data-ac-idx')));
        return;
      }

      // Command Palette Pick
      var cmdPick = target.closest('[data-cmd-pick]');
      if (cmdPick) {
        var cid = cmdPick.getAttribute('data-cmd-pick');
        closeCommandPalette();
        if (cid === 'act:new') createNewSessionPrompt();
        else if (cid === 'view:chat') switchView('chat');
        else if (cid === 'view:board') switchView('board');
        else if (cid === 'view:supervisor') switchView('supervisor');
        else if (cid === 'act:patrol') triggerSupervisorPatrol();
        else if (cid === 'act:theme') toggleTheme();
        else if (cid === 'act:hub') {
          var link = document.getElementById('nxHubLink');
          if (link) location.href = link.getAttribute('href') || '../';
        } else if (cid && cid.indexOf('sess:') === 0) {
          selectSession(cid.slice(5));
          switchView('chat');
        }
        return;
      }

      // Named Actions (data-act)
      var actBtn = target.closest('[data-act]');
      if (actBtn) {
        var act = actBtn.getAttribute('data-act');
        if (act === 'send-prompt') sendPromptNow();
        else if (act === 'interrupt-send') sendPromptNow(null, true);
        else if (act === 'new-session') createNewSessionPrompt();
        else if (act === 'refresh-all') refreshGatewayAndSessions(function () { toast('✓ 状态已同步'); });
        else if (act === 'load-older') {
          var pag = S.sessionPagination[S.activeSessionId];
          if (pag && pag.hasOlder && pag.olderBefore != null && !S.loadingOlder) {
            S.loadingOlder = true;
            renderChatStream(false);
            fetchSessionDetail(S.activeSessionId, { before: pag.olderBefore, limit: 15 });
          }
        } else if (act === 'cancel-run') {
          var sess = S.activeSessionDetail || S.sessions.find(function (s) { return s.id === S.activeSessionId; });
          if (sess) {
            var ch = String(sess.channel || sess.source || S.activeChannel).toLowerCase();
            var logical = getSessionLogicalName(sess);
            fetch('/api/gateway/cancel', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ channel: ch, sessionName: logical })
            }).then(function () {
              toast('⏹ 已发送中止信号');
              refreshGatewayAndSessions();
            });
          }
        } else if (act === 'resume-session') {
          sendPromptNow('请直接从刚才中断或未完成的步骤继续执行，不要重复已完成的工作。');
        } else if (act === 'retry-default-model') {
          var retryPrompt = actBtn.getAttribute('data-retry-prompt') || '继续';
          var chMeta = getChannelMeta(S.activeChannel);
          S.composer.model = chMeta.defaultModel;
          renderComposerToolbar();
          sendPromptNow(retryPrompt);
        } else if (act === 'open-handoff') {
          var sr = document.getElementById('nxSidebarR');
          if (sr) sr.classList.remove('collapsed');
          S.srTab = 'handoff';
          renderRightDrawer();
        } else if (act === 'exec-handoff') {
          var hCh = document.getElementById('nxHandoffCh');
          var hMod = document.getElementById('nxHandoffModel');
          var hPr = document.getElementById('nxHandoffPrompt');
          executeCrossChannelHandoff(
            hCh ? hCh.value : 'codex',
            hMod ? hMod.value : '',
            hPr ? hPr.value : ''
          );
        } else if (act === 'insert-mention') {
          var ta1 = document.getElementById('nxPromptInput');
          if (ta1) {
            ta1.value = (ta1.value ? ta1.value + ' @' : '@');
            ta1.focus();
            checkAutocomplete();
          }
        } else if (act === 'insert-slash') {
          var ta2 = document.getElementById('nxPromptInput');
          if (ta2) {
            ta2.value = '/';
            ta2.focus();
            checkAutocomplete();
          }
        } else if (act === 'sup-patrol') {
          triggerSupervisorPatrol();
        } else if (act === 'sup-save') {
          saveSupervisorConfig();
        }
      }
    });

    // Change Delegation for Selects
    document.addEventListener('change', function (e) {
      var t = e.target;
      if (!t) return;
      if (t.id === 'nxCtlChannel') {
        S.activeChannel = t.value;
        localStorage.setItem('nx.channel', t.value);
        var meta = getChannelMeta(t.value);
        S.composer.model = meta.defaultModel || '';
        renderComposerToolbar();
      } else if (t.id === 'nxCtlModel') {
        S.composer.model = t.value;
      } else if (t.id === 'nxCtlPerm') {
        S.composer.permissionMode = t.value;
      } else if (t.id === 'nxCtlCwd') {
        S.composer.cwd = t.value;
      } else if (t.id === 'nxHandoffCh') {
        S.composer.handoffTarget = t.value;
        renderRightDrawer();
      } else if (t.id === 'nxSupChannel') {
        var supMeta = getChannelMeta(t.value);
        var modSel = document.getElementById('nxSupModel');
        if (modSel && supMeta && Array.isArray(supMeta.verifiedModels)) {
          modSel.innerHTML = supMeta.verifiedModels.map(function (m) {
            return '<option value="' + esc(m) + '">' + esc(m) + '</option>';
          }).join('');
        }
      }
    });

    // Topbar Icon Buttons
    var leftToggle = document.getElementById('nxLeftToggle');
    if (leftToggle) {
      leftToggle.addEventListener('click', function () {
        var sb = document.getElementById('nxSidebarL');
        if (sb) sb.classList.toggle('collapsed');
      });
    }
    var rightToggle = document.getElementById('nxRightToggle');
    if (rightToggle) {
      rightToggle.addEventListener('click', function () {
        var sr = document.getElementById('nxSidebarR');
        if (sr) sr.classList.toggle('collapsed');
      });
    }
    var themeBtn = document.getElementById('nxThemeBtn');
    if (themeBtn) themeBtn.addEventListener('click', toggleTheme);

    var newSessBtn = document.getElementById('nxNewSessionBtn');
    if (newSessBtn) newSessBtn.addEventListener('click', createNewSessionPrompt);

    var cmdBtn = document.getElementById('nxCmdBtn');
    if (cmdBtn) cmdBtn.addEventListener('click', openCommandPalette);

    var cmdModal = document.getElementById('nxCmdModal');
    if (cmdModal) {
      cmdModal.addEventListener('click', function (e) {
        if (e.target === cmdModal) closeCommandPalette();
      });
    }
    var cmdInput = document.getElementById('nxCmdInput');
    if (cmdInput) {
      cmdInput.addEventListener('input', function () {
        renderCommandList(cmdInput.value);
      });
    }

    // Sidebar Session Filter & On-Demand Archive
    var sessFilter = document.getElementById('nxSessionFilter');
    if (sessFilter) {
      sessFilter.addEventListener('input', function () {
        S.sessionFilter = sessFilter.value;
        renderSessionTree();
      });
    }
    var archToggle = document.getElementById('nxArchiveToggle');
    if (archToggle) {
      archToggle.addEventListener('click', function () {
        S.archiveOpen = !S.archiveOpen;
        var body = document.getElementById('nxArchiveBody');
        var arrow = document.getElementById('nxArchiveArrow');
        if (body) body.hidden = !S.archiveOpen;
        if (arrow) arrow.textContent = S.archiveOpen ? '▾' : '▸';
        if (S.archiveOpen && !S.archiveLoaded) {
          loadArchiveSessions('');
        }
      });
    }
    var archSearch = document.getElementById('nxArchiveSearch');
    if (archSearch) {
      var archTimer = null;
      archSearch.addEventListener('input', function () {
        clearTimeout(archTimer);
        archTimer = setTimeout(function () {
          loadArchiveSessions(archSearch.value.trim());
        }, 260);
      });
    }

    // Prompt Input Keydown & Autocomplete
    var promptInput = document.getElementById('nxPromptInput');
    if (promptInput) {
      promptInput.addEventListener('input', function () {
        saveDraftForActiveSession();
        checkAutocomplete();
      });
      promptInput.addEventListener('keydown', function (e) {
        if (S.acMode && S.acItems.length) {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            S.acIndex = (S.acIndex + 1) % S.acItems.length;
            renderAcPopover();
            return;
          }
          if (e.key === 'ArrowUp') {
            e.preventDefault();
            S.acIndex = (S.acIndex - 1 + S.acItems.length) % S.acItems.length;
            renderAcPopover();
            return;
          }
          if (e.key === 'Tab' || (e.key === 'Enter' && !e.shiftKey)) {
            e.preventDefault();
            applyAcItem(S.acIndex);
            return;
          }
          if (e.key === 'Escape') {
            S.acMode = null;
            var pop = document.getElementById('nxAcPopover');
            if (pop) pop.hidden = true;
            return;
          }
        }
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          sendPromptNow();
        }
      });
    }

    // Global Keyboard Shortcuts (Ctrl+K, Ctrl+B, Escape)
    document.addEventListener('keydown', function (e) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        openCommandPalette();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        var sb = document.getElementById('nxSidebarL');
        if (sb) sb.classList.toggle('collapsed');
      } else if (e.key === 'Escape') {
        closeCommandPalette();
      }
    });

    // Composer Vertical Drag Resize
    var compResize = document.getElementById('nxComposerResize');
    if (compResize && promptInput) {
      compResize.addEventListener('mousedown', function (ev) {
        ev.preventDefault();
        var startY = ev.clientY;
        var startH = promptInput.offsetHeight;
        function onMove(mv) {
          var nextH = Math.max(54, Math.min(340, startH + (startY - mv.clientY)));
          promptInput.style.height = nextH + 'px';
        }
        function onUp() {
          window.removeEventListener('mousemove', onMove);
          window.removeEventListener('mouseup', onUp);
        }
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
      });
    }

    // Right Drawer Horizontal Drag Resize
    var srResize = document.getElementById('nxSrResize');
    var srEl = document.getElementById('nxSidebarR');
    if (srResize && srEl) {
      srResize.addEventListener('mousedown', function (ev) {
        ev.preventDefault();
        var startX = ev.clientX;
        var startW = srEl.offsetWidth;
        function onMove(mv) {
          var nextW = Math.max(250, Math.min(560, startW + (startX - mv.clientX)));
          srEl.style.width = nextW + 'px';
        }
        function onUp() {
          window.removeEventListener('mousemove', onMove);
          window.removeEventListener('mouseup', onUp);
        }
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
      });
    }
  }

  // Initialize Console Application
  function init() {
    bindEvents();
    renderChannelGrid();
    renderSessionTree();
    renderChatHeader();
    renderChatStream(false);
    renderComposerToolbar();
    renderRightDrawer();
    refreshGatewayAndSessions();
    connectSSE();
    setInterval(function () {
      refreshGatewayAndSessions();
    }, 8000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
