/* HUB.fromTrace: sessions in the trace contract (trace/packages/contract) -> the observatory's unified model
   (docs/ARCHITECTURE.md), so a real multi-agent run is drawn by the same org views as the simulated cases. It is the
   other direction of HUB.toTrace. Sessions carry no orchestration, so the definitions are read off the facts:
   - every session is an individual; a session nobody started is the hub the person talks to;
   - sub-agents started in the same turn of their parent form a group, one dispatch, nested under the group of
     the agent that started them; this is the default coarse grain of a real run;
   - who started whom is a dispatch line, the answer coming back a delivery line;
   - each model is a channel, an MCP server a shared channel, shell, file edits and search are basic
     capabilities, and starting sub-agents is the starter's own (native) capability.
   Each turn is a run with its task; each model or tool step is a call. Times count from the first session's
   start, which becomes the model's clock. Pure: no DOM, tested from trace/packages/contract/test. */
(function () {
  'use strict';
  var HUB = (window.HUB = window.HUB || {});
  var U = HUB.util;

  // the designer's agent icons, picked from what a sub-agent is called; a hub session gets the orchestrator
  var ICONS = [[/review|audit|check|verif|critic|qa|test/i, 'qa_quality'], [/research|explor|search|investig|scan|survey/i, 'res_tech'],
    [/plan|design|architect/i, 'planner'], [/doc|writ/i, 'writer'], [/front|ui\b/i, 'frontend'], [/back|api|server/i, 'backend']];
  var TOOLS = { shell: '命令行', patch: '改文件', web: '搜索', plan: '计划', image: '图片', agent: '和其他智能体通信', other: '其他工具' };
  var OUTCOME = { completed: 'deliver', failed: 'failed', aborted: 'interrupted', running: 'running' };

  function ms(iso) { var t = Date.parse(iso || ''); return isFinite(t) ? t : null; }
  function cut(s, n) { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n) + '…' : s; }
  function iconFor(s, hub) {
    if (hub) return 'orchestrator';
    var name = (s.agent.path || '') + ' ' + (s.agent.nickname || '') + ' ' + (s.agent.name || '');
    for (var i = 0; i < ICONS.length; i++) if (ICONS[i][0].test(name)) return ICONS[i][1];
    return 'feature';
  }
  function slug(s) { return String(s).toLowerCase().replace(/[^a-z0-9.\-]+/g, '_'); }

  function normMdPath(raw) {
    if (!raw || typeof raw !== 'string') return null;
    var s = raw.trim().replace(/^["'`({\[]+|["'`.,;:\])}]+$/g, '').replace(/\\/g, '/');
    if (!/\.md$/i.test(s) || s.indexOf('://') >= 0) return null;
    return s;
  }

  function extractMdOps(st) {
    if (!st || st.kind !== 'tool') return [];
    var out = [], seen = {};
    var add = function (rawPath, op) {
      var p = normMdPath(rawPath);
      if (!p) return;
      var base = p.split('/').filter(Boolean).pop() || p;
      if (!/^[A-Za-z0-9_.\-\u4e00-\u9fa5]+\.md$/i.test(base)) return;
      var key = op + ':' + base.toLowerCase();
      if (seen[key]) return;
      seen[key] = true;
      out.push({ path: p, baseName: base, op: op });
    };
    var name = String(st.name || '');
    var defaultOp = /write|edit|patch|replace|create| notebook/i.test(name) ? 'write'
      : /read|view/i.test(name) ? 'read' : null;

    (st.effects || []).forEach(function (e) {
      if (e && e.kind === 'file' && e.ref) {
        add(e.ref, e.verb === 'read' ? 'read' : 'write');
      }
    });

    var inp = typeof st.input === 'string' ? st.input : '';
    if (inp) {
      try {
        var obj = JSON.parse(inp);
        if (obj && typeof obj === 'object') {
          ['file_path', 'path', 'TargetFile', 'AbsolutePath', 'filePath', 'target_file', 'notebook_path'].forEach(function (k) {
            if (typeof obj[k] === 'string') add(obj[k], defaultOp || 'read');
          });
          if (typeof obj.patch === 'string') {
            var pm = obj.patch.match(/\*\*\*\s+(?:Update|Add)\s+File:\s*([^\r\n]+?\.md)/gi) || [];
            pm.forEach(function (line) { add(line.replace(/^\*\*\*\s+(?:Update|Add)\s+File:\s*/i, ''), 'write'); });
          }
          var cmdStr = typeof obj.command === 'string' ? obj.command : typeof obj.cmd === 'string' ? obj.cmd : '';
          if (cmdStr) inp = cmdStr;
        }
      } catch (_) {}

      var patchMatches = inp.match(/\*\*\*\s+(?:Update|Add)\s+File:\s*([^\r\n]+?\.md)/gi) || [];
      patchMatches.forEach(function (line) { add(line.replace(/^\*\*\*\s+(?:Update|Add)\s+File:\s*/i, ''), 'write'); });

      var shellOp = defaultOp;
      if (!shellOp && st.family === 'shell') {
        shellOp = /set-content|out-file|add-content|tee\b|cat\s+<<|>\s*[^\s]*\.md/i.test(inp) ? 'write'
          : /cat\b|get-content\b|gc\b|type\b|head\b|tail\b|sed\b/i.test(inp) ? 'read' : null;
      }
      if (shellOp) {
        var re = /([A-Za-z]:[\\/][^\s"'<>|*?`]+?\.md|(?:[A-Za-z0-9_.\-\u4e00-\u9fa5]+[\\/])+[^\s"'<>|*?`]+?\.md|[A-Za-z0-9_.\-\u4e00-\u9fa5]+?\.md)(?=$|[\s"'`:,;)\]}])/gi;
        var m;
        while ((m = re.exec(inp)) !== null) add(m[1], shellOp);
      }
    }
    return out;
  }

  /* sessions: a main session and the sessions it started (any depth), or several such trees.
     opts: { id, name, summary, singleCase } of the model. */
  function model(sessions, opts) {
    opts = opts || {};
    var byId = new Map(sessions.map(function (s) { return [s.id, s]; }));
    var parentOf = function (s) {
      var l = (s.links || []).find(function (x) { return x.rel === 'parent' && byId.has(x.id); });
      return l ? l.id : null;
    };
    var list = sessions.slice().sort(function (a, b) { return (ms(a.startedAt) || 0) - (ms(b.startedAt) || 0) || (a.id < b.id ? -1 : 1); });
    var base = Infinity;
    list.forEach(function (s) { var t = ms(s.startedAt); if (t == null) t = ms(s.updatedAt); if (t != null) base = Math.min(base, t); });
    if (!isFinite(base)) base = 0;
    var rel = function (iso, fallback) { var t = ms(iso); return t == null ? fallback : t - base; };

    /* ---------- who started whom, and in which turn ---------- */
    var ind = new Map(), kids = new Map(), spawnTurn = new Map(), depth = new Map();
    list.forEach(function (s, i) { ind.set(s.id, 'a' + i); });
    list.forEach(function (s) {
      var p = parentOf(s);
      if (!p) return;
      (kids.get(p) || kids.set(p, []).get(p)).push(s.id);
      var parent = byId.get(p), start = ms(s.startedAt), found = null;
      parent.turns.forEach(function (t) {
        t.steps.forEach(function (st) {
          if (found) return;
          var refs = (st.agents || []).concat((st.effects || []).map(function (e) { return e.ref; }), st.ref ? [st.ref] : []);
          if (refs.indexOf(s.id) >= 0) found = t;
        });
      });
      // no step names the child: the parent's turn that was open when it started
      if (!found && start != null) found = parent.turns.filter(function (t) { var a = ms(t.startedAt); return a != null && a <= start; }).pop() || null;
      spawnTurn.set(s.id, found ? found.index : 0);
    });
    var depthOf = function (id) {
      if (depth.has(id)) return depth.get(id);
      var p = parentOf(byId.get(id)), d = p ? depthOf(p) + 1 : 0;
      depth.set(id, d);
      return d;
    };

    /* ---------- individuals ---------- */
    var roots = list.filter(function (s) { return !parentOf(s); });
    var names = {}, individuals = [], indMap = new Map();
    list.forEach(function (s, i) {
      var hub = !parentOf(s);
      var nm = hub ? (roots.length > 1 ? cut(s.title, 14) : '主智能体') : (s.agent.nickname || (s.agent.path || '').split('/').filter(Boolean).pop() || '子智能体');
      names[nm] = (names[nm] || 0) + 1;
      var agentId = iconFor(s, hub);
      var x = {
        id: ind.get(s.id), agentId: agentId, kind: 'agent', name: nm, model: s.agent.model || null,
        phase: (HUB.base && HUB.base.agents[agentId] || {}).phase || 'build', groupId: null,
        role: cut(s.title, 80), trigger: hub ? '人发来的消息' : '',
        watches: [], docs: [], channels: [], natives: [], host: s.agent.product, tools: [],
        capabilities: s.capabilities || null,
        x: i * 10, y: depthOf(s.id) * 100, isHub: hub, enhanced: false, session: s.id
      };
      individuals.push(x);
      indMap.set(x.id, x);
    });
    // the same nickname twice reads as two different agents
    var seen = {};
    individuals.forEach(function (x) { if (names[x.name] > 1) { seen[x.name] = (seen[x.name] || 0) + 1; x.name += ' #' + seen[x.name]; } });
    individuals.forEach(function (x) {
      var s = byId.get(x.session), p = parentOf(s);
      if (p) x.trigger = '由' + indMap.get(ind.get(p)).name + '在第 ' + spawnTurn.get(s.id) + ' 轮派出';
    });
    var human = { id: 'human', agentId: null, kind: 'human', name: '人（用户）', model: null, phase: null, groupId: null,
      role: '发起会话，在对话里给主智能体下指令', trigger: '自己决定', watches: [], docs: [], channels: [], natives: [], host: null, tools: [],
      x: -100, y: 0, isHub: false, enhanced: true };
    individuals.push(human);
    indMap.set('human', human);
    var rootIds = roots.map(function (s) { return ind.get(s.id); });
    var metaDefs = [
      { id: 'meta_approver', name: '元智能体 · 自动批准督导', role: '自动审批高信度文件读写、终端命令与子智能体派发，免去人工逐条点击确认', trigger: '工具请求权限或门禁待拍板时', watches: rootIds.slice() },
      { id: 'meta_resumer', name: '元智能体 · 断网与Bug续跑', role: '实时监测断网、API 超时、进程崩溃与异常中断，自动携带断点上下文发起续跑', trigger: '心跳超时、网络断开或异常退出时', watches: rootIds.slice() },
      { id: 'meta_maint', name: '元智能体 · 渠道与模型容灾', role: '监控 6 大渠道并发、配额与限流，拥塞或报错时自动热切换备用模型', trigger: '渠道满载、429 限流或需要扩容时', watches: [] },
      { id: 'meta_auditor', name: '元智能体 · 防死循环督导', role: '检测连续重复工具调用或无效重试，自动注入纠偏提示词防止空转消耗 Token', trigger: '连续重复报错或轨迹停滞时', watches: rootIds.slice() }
    ];
    metaDefs.forEach(function (md, mi) {
      var mObj = { id: md.id, agentId: null, kind: 'meta', name: md.name, model: 'haiku', phase: null, groupId: null,
        role: md.role, trigger: md.trigger, watches: md.watches, docs: [], channels: [], natives: [], host: null, tools: [],
        x: -100 + mi * 40, y: 200, isHub: false, enhanced: true };
      individuals.push(mObj);
      indMap.set(md.id, mObj);
    });

    /* ---------- groups: each hub with its waves of sub-agents ---------- */
    var groups = [], groupMap = new Map();
    var addGroup = function (g) { groups.push(g); groupMap.set(g.id, g); return g; };
    var waves = function (sid, parentGroup) {
      var byTurn = U.groupBy(kids.get(sid) || [], function (k) { return spawnTurn.get(k); });
      var turnsSorted = Array.from(byTurn.keys()).sort(function (a, b) { return a - b; });
      turnsSorted.forEach(function (ti) {
        var members = byTurn.get(ti);
        var owner = indMap.get(ind.get(sid));
        var g = addGroup({ id: 'g_' + ind.get(sid) + '_t' + ti, name: owner.name + (ti ? ' 第 ' + ti + ' 轮' : '') + '派出的 ' + members.length + ' 个',
          level: parentGroup.level + 1, parentId: parentGroup.id, order: 0, children: [], members: [] });
        parentGroup.children.push(g.id);
        members.forEach(function (k) {
          var x = indMap.get(ind.get(k));
          x.groupId = g.id;
          g.members.push(x.id);
          if (kids.has(k) && g.level < 3) waves(k, g);
        });
      });
    };
    roots.forEach(function (s) {
      var x = indMap.get(ind.get(s.id));
      var g = addGroup({ id: 'g_' + x.id, name: roots.length > 1 ? cut(s.title, 18) : '主智能体和它派出的子智能体', level: 1, parentId: null, order: 0, children: [], members: [x.id] });
      x.groupId = g.id;
      waves(s.id, g);
    });
    // deeper than three levels folds into the third
    individuals.forEach(function (x) {
      if (x.groupId || x.kind !== 'agent') return;
      for (var p = parentOf(byId.get(x.session)); p; p = parentOf(byId.get(p))) {
        var px = indMap.get(ind.get(p));
        if (px.groupId) { x.groupId = px.groupId; groupMap.get(px.groupId).members.push(x.id); break; }
      }
    });
    groups.forEach(function (g, i) { g.order = i; });

    /* ---------- channels ---------- */
    var channels = [], chMap = new Map();
    var addChannel = function (c) { if (!chMap.has(c.id)) { c.users = []; chMap.set(c.id, c); channels.push(c); } return chMap.get(c.id); };
    var use = function (x, c) {
      if (c.users.indexOf(x.id) < 0) c.users.push(x.id);
      if (x.channels.indexOf(c.id) < 0) x.channels.push(c.id);
    };
    var modelCh = function (name) {
      return addChannel({ id: 'ch_' + slug(name || '模型'), kind: 'model', name: '模型：' + (name || '未知'), maintainer: null, capacity: '-', quota: '-', limit: null });
    };
    var toolCh = function (st) {
      if (st.family === 'mcp') {
        var server = String(st.name || '').split(/__|\./).filter(Boolean)[st.name && st.name.indexOf('mcp__') === 0 ? 1 : 0] || 'mcp';
        return addChannel({ id: 'ch_mcp_' + slug(server), kind: 'function', name: 'MCP：' + server, maintainer: null, capacity: '-', quota: '-', limit: null });
      }
      var f = TOOLS[st.family] ? st.family : 'other';
      return addChannel({ id: 'ch_tool_' + f, kind: 'tool', name: '工具：' + TOOLS[f], maintainer: null, capacity: '不限', quota: '-', limit: null });
    };

    /* ---------- facts & markdown document deliveries ---------- */
    var F = { synthetic: false, span: { start: 0, end: 0 }, cases: [], tasks: [], runs: [], decisions: [], calls: [], handoffs: [], deliveries: [],
      gateEvents: [], channelEvents: [], versionEvents: [], actions: [], messages: [] };
    var runRef = {}, taskOfTurn = new Map(), caseOf = new Map();
    var docs = [], docMap = new Map(), lastWriter = new Map(), pendingCrossReads = [];

    if (opts.singleCase && roots.length > 1) {
      var k0 = { id: 'k1', name: cut(opts.name || roots[0].title, 40), start: rel(roots[0].startedAt, 0), end: 0, status: 'done', path: [], waitingAt: null };
      F.cases.push(k0);
      list.forEach(function (s) { caseOf.set(s.id, k0); });
    } else {
      roots.forEach(function (s, i) {
        var k = { id: 'k' + (i + 1), name: cut(s.title, 40), start: rel(s.startedAt, 0), end: 0, status: 'done', path: [], waitingAt: null };
        F.cases.push(k);
        var mark = function (id) { caseOf.set(id, k); (kids.get(id) || []).forEach(mark); };
        mark(s.id);
      });
    }

    list.forEach(function (s) {
      var x = indMap.get(ind.get(s.id)), k = caseOf.get(s.id);
      var sStart = rel(s.startedAt, rel(s.updatedAt, 0));
      if (s.agent.model) use(x, modelCh(s.agent.model));
      s.turns.forEach(function (t) {
        var start = rel(t.startedAt, sStart), lastAt = start;
        t.steps.forEach(function (st) { lastAt = Math.max(lastAt, rel(st.endAt, rel(st.at, lastAt))); });
        var end = rel(t.endedAt, lastAt);
        if (t.status === 'running') end = Math.max(end, rel(s.updatedAt, end));
        var task = { id: 't_' + x.id + '_' + t.index, caseId: k.id, parentId: null, name: cut(t.input || s.title, 40), stepId: null, assignee: x.id,
          status: t.status === 'running' ? 'running' : 'done', created: start, started: start, done: t.status === 'running' ? null : end, visit: 1 };
        var mName = (t.settings && t.settings.model) || s.agent.model;
        var mc = modelCh(mName);
        use(x, mc);
        var run = { id: 'u_' + x.id + '_' + t.index, taskId: task.id, caseId: k.id, individualId: x.id, start: start, end: Math.max(end, start),
          outcome: OUTCOME[t.status] || 'deliver', version: 'v1', model: mName || null, tokens: (t.usage && t.usage.total) || 0, channelId: mc.id, queued: 0,
          coverage: { indexed: t.steps.length, metaOnly: 0, truncated: 0 } };
        F.tasks.push(task);
        F.runs.push(run);
        taskOfTurn.set(s.id + '#' + t.index, task.id);
        runRef[run.id] = { session: s.id, turn: t.id };
        k.end = Math.max(k.end, run.end);
        if (t.status === 'running') k.status = 'running';
        t.steps.forEach(function (st) {
          if (st.kind !== 'model' && st.kind !== 'tool') return;
          var a = rel(st.at, start), b = rel(st.endAt, a + (st.durationMs || 0));
          var ch = st.kind === 'model' ? modelCh(st.model || mName) : toolCh(st);
          // managing sub-agents is the own capability of an agent that did start some; waiting on or messaging others is basic
          if (st.kind === 'tool' && st.family === 'agent' && kids.has(s.id)) {
            var nat = addChannel({ id: 'ch_nat_' + x.id, kind: 'native', owner: x.id, host: s.agent.product, name: '派生子智能体', short: '派生子智能体',
              note: '', maintainer: x.id, capacity: '-', quota: '-', limit: null });
            if (x.natives.indexOf(nat.id) < 0) x.natives.push(nat.id);
            ch = nat;
          }
          use(x, ch);
          var u = st.usage || {};
          F.calls.push({ id: x.id + '.' + st.id, runId: run.id, decisionId: null, parentId: null, kind: st.kind, tool: st.kind === 'tool' ? st.family : null,
            name: st.kind === 'model' ? (st.model || mName || '模型') : st.name, channelId: ch.id, start: a, end: Math.max(a, b),
            tokensIn: u.input || 0, tokensOut: u.output || 0, status: st.kind === 'tool' && st.status === 'error' ? 'error' : 'ok', repeat: false,
            input: cut(st.input || '', 240), output: cut(st.output || st.text || '', 240), context: null });

          if (st.kind === 'tool') {
            var mdOps = extractMdOps(st);
            mdOps.forEach(function (mOp) {
              var docId = 'doc_' + slug(mOp.baseName);
              var doc = docMap.get(docId);
              if (!doc) {
                var layer = /AGENTS\.md|CLAUDE\.md|GEMINI\.md|INDEX\.md|BOARD\.md/i.test(mOp.baseName) ? 'global'
                  : /任务书|task|spec|plan|readme/i.test(mOp.baseName) ? 'role' : 'case';
                doc = { id: docId, name: mOp.baseName, path: mOp.path, layer: layer, owner: x.id, summary: mOp.path, version: 'v1', audience: [], tags: ['layer/' + layer] };
                docMap.set(docId, doc);
                docs.push(doc);
              }
              if (mOp.op === 'write') doc.owner = x.id;
              if (doc.audience.indexOf(x.id) < 0) doc.audience.push(x.id);
              if (x.docs.indexOf(docId) < 0) x.docs.push(docId);

              var prevW = lastWriter.get(docId);
              var fromWho = mOp.op === 'read' && prevW ? prevW.indId : (mOp.op === 'write' ? x.id : 'human');
              F.deliveries.push({
                id: 'dv' + (F.deliveries.length + 1),
                runId: run.id,
                caseId: k.id,
                individualId: x.id,
                from: fromWho,
                to: x.id,
                by: fromWho,
                docId: docId,
                kind: 'context',
                op: mOp.op,
                status: st.status === 'error' ? 'missing' : 'delivered',
                at: a,
                text: (mOp.op === 'write' ? '写入 ' : '读取 ') + mOp.baseName
              });

              if (mOp.op === 'write' && st.status !== 'error') {
                lastWriter.set(docId, { indId: x.id, taskId: task.id, runStart: run.start, at: Math.max(a, b), caseId: k.id, docId: docId, baseName: mOp.baseName });
              } else if (mOp.op === 'read' && prevW && prevW.indId !== x.id && prevW.caseId === k.id) {
                pendingCrossReads.push({
                  k: k, from: prevW.indId, to: x.id, fromTask: prevW.taskId, toTask: task.id,
                  at: Math.max(prevW.runStart, run.start), docId: docId, baseName: mOp.baseName, isError: st.status === 'error'
                });
              }
            });
          }
        });
      });
      F.span.end = Math.max(F.span.end, rel(s.updatedAt, 0));
    });
    F.runs.forEach(function (r) { F.span.end = Math.max(F.span.end, r.end); });
    channels.forEach(function (c) { c.tier = c.kind === 'native' ? 'native' : c.kind === 'tool' && !c.limit ? 'basic' : 'shared'; });

    /* ---------- relations and the handoffs that used them ---------- */
    var relations = [], relKeys = {};
    var addRel = function (type, sub, from, to, label) {
      var key = type + ':' + sub + ':' + from + ':' + to;
      if (relKeys[key] || from === to) return relKeys[key] || null;
      var r = { id: 'r' + relations.length, type: type, sub: sub, from: from, to: to, label: label || '' };
      relKeys[key] = r; relations.push(r);
      return r;
    };
    var hand = function (k, from, to, fromTask, toTask, at, r, basis, carried, missing, note) {
      F.handoffs.push({
        id: 'h' + (F.handoffs.length + 1), caseId: k.id, from: from, to: to, fromTask: fromTask, toTask: toTask,
        at: at, basis: basis || 'explicit', relationId: r ? r.id : null, carried: carried || [], missing: missing || [],
        ...(note ? { note: note } : {})
      });
    };
    roots.forEach(function (s) {
      var x = indMap.get(ind.get(s.id)), k = caseOf.get(s.id);
      var down = addRel('task', 'dispatch', 'human', x.id, '在对话里下指令'), up = addRel('task', 'deliver', x.id, 'human', '回答');
      addRel('watch', 'watch', 'human', x.id, '人通过主智能体下指令');
      s.turns.forEach(function (t) {
        var tid = taskOfTurn.get(s.id + '#' + t.index), r = F.runs.find(function (u) { return u.taskId === tid; });
        hand(k, 'human', x.id, null, tid, r.start, down, 'explicit');
        if (t.status !== 'running') hand(k, x.id, 'human', tid, null, r.end, up, 'explicit');
      });
    });
    list.forEach(function (s) {
      var p = parentOf(s);
      if (!p) return;
      var x = indMap.get(ind.get(s.id)), px = indMap.get(ind.get(p)), k = caseOf.get(s.id);
      var down = addRel('task', 'dispatch', px.id, x.id, '派出'), up = addRel('task', 'deliver', x.id, px.id, '交回结果');
      var from = taskOfTurn.get(p + '#' + spawnTurn.get(s.id)) || null;
      var first = s.turns.length ? taskOfTurn.get(s.id + '#' + s.turns[0].index) : null;
      var lastT = s.turns.length ? s.turns[s.turns.length - 1] : null;
      hand(k, px.id, x.id, from, first, rel(s.startedAt, 0), down, 'explicit');
      if (lastT && lastT.status !== 'running') hand(k, x.id, px.id, taskOfTurn.get(s.id + '#' + lastT.index), from, rel(lastT.endedAt, rel(s.updatedAt, 0)), up, 'explicit');
    });
    var seenRelay = {};
    pendingCrossReads.forEach(function (cr) {
      var rKey = cr.from + '>' + cr.to + ':' + cr.docId + ':' + cr.toTask;
      if (seenRelay[rKey]) return;
      seenRelay[rKey] = true;
      var pr = addRel('task', 'deliver', cr.from, cr.to, '文档交接：' + cr.baseName);
      addRel('info', 'read', cr.from, cr.to, '读取 ' + cr.baseName);
      hand(cr.k, cr.from, cr.to, cr.fromTask, cr.toTask, cr.at, pr, 'protocol', [cr.docId], cr.isError ? [cr.docId] : [], '通过 ' + cr.baseName + ' 交接');
    });
    relations.filter(function (r) { return r.type === 'task' && r.sub !== 'report'; }).forEach(function (r) { addRel('info', 'read', r.from, r.to, '读上游产出'); });
    individuals.forEach(function (x) { x.channels.forEach(function (cid) { addRel('channel', 'use', x.id, cid); }); });
    individuals.filter(function (x) { return x.kind === 'meta'; }).forEach(function (mx) {
      (mx.watches || []).forEach(function (wid) { addRel('watch', 'watch', mx.id, wid, mx.name + '守护'); });
    });
    channels.filter(function (c) { return c.kind !== 'native'; }).forEach(function (c) {
      if (!c.maintainer) c.maintainer = 'meta_maint';
      addRel('channel', 'maintain', 'meta_maint', c.id, '维护');
    });

    var def = { version: 'v1', versions: [{ id: 'v1', at: 0, note: '从本机会话解析', by: '解析' }], individuals: individuals, groups: groups,
      relations: relations, channels: channels, docs: docs, process: { stages: [], gates: [], flows: [] } };
    var name = opts.name || (roots[0] ? cut(roots[0].title, 24) : '本机会话');
    return {
      id: opts.id || 'sessions', name: name, presetName: name, summary: opts.summary || (list.length + ' 个会话，其中 ' + (list.length - roots.length) + ' 个子智能体'),
      flowText: '', category: 'sessions', size: list.length, curated: false, synthetic: false,
      capabilities: (roots[0] && roots[0].capabilities) || (list[0] && list[0].capabilities) || null,
      def: def, facts: F, rev: 0, clock: base,
      source: { kind: 'sessions', sessions: byId, runs: runRef }
    };
  }

  HUB.fromTrace = { model: model };

  /* The local service as a source of models: 'tree:<session id>' is that session and every sub-agent it started,
     drawn by the org views like a case. The service is the one that serves this page, so the address is relative. */
  if (HUB.model && HUB.model.addSource) {
    HUB.model.addSource({
      id: 'sessions', label: '本机会话',
      owns: function (id) { return /^tree:/.test(id); },
      load: function (id) {
        return fetch('/api/sessions/' + encodeURIComponent(id.slice(5)) + '/tree', { cache: 'no-store' })
          .then(function (r) { if (!r.ok) throw new Error(r.status === 404 ? '本机没有这个会话' : '本地服务返回 ' + r.status); return r.json(); })
          .then(function (doc) {
            if (!doc.sessions || !doc.sessions.length) throw new Error('这条会话现在读不到（可能正在写入），稍后再试');
            return model(doc.sessions, { id: id });
          });
      }
    });
  }
})();
