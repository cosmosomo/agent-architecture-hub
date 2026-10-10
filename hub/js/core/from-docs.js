/* HUB.fromDocs: hub/cases/ 目录里的 Markdown 文档 → 统一模型（hub/SPEC.md §5）
   格式规范见 hub/docs/hub-graph-format.md §18.6

   解析规则：
   - frontmatter hub:"1.0" 是命名空间标识，缺失则跳过该文件
   - # @id [type] #tag1 #tag2  → 开始一个对象定义
   - key: value 行是属性（直到下一个 # 标题）
   - key: 后跟缩进的 "- " 列表 → 数组属性；列表项是纯文本或 key: value 映射，
     映射项的续行（更深缩进的 key: value）并入该项
   - 纯段落文字是人读的注释，跳过
   - decisions/ 里每个文件是一个智能体的决策列表
   - scenarios.md 的 [case] 对象与特殊情况指令 → sim 的 scenario 覆盖

   def 组装完交给 HUB.sim.simulate({id, def, override}) 生成事实层——
   和 v41 精编案例（hub/data/cases/*.js）走同一条流水线。

   用法（浏览器里用 fetch 读文件，Node 里用 fs）：
     HUB.fromDocs.loadCase(fetch, baseUrl).then(model => ...)
   纯函数，不碰 DOM，不认识任何前端组件。                                      */
(function () {
  'use strict';
  var HUB = (window.HUB = window.HUB || {});

  /* ── 基础工具 ────────────────────────────────────────────── */

  /** 解析 YAML frontmatter，返回 {meta, body}；无 frontmatter 返回 {meta: null, body: src} */
  function parseFrontmatter(src) {
    var m = src.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
    if (!m) return { meta: null, body: src };
    var meta = {};
    m[1].split('\n').forEach(function (line) {
      var i = line.indexOf(':');
      if (i < 0) return;
      var k = line.slice(0, i).trim();
      var v = line.slice(i + 1).trim().replace(/^["']|["']$/g, '');
      meta[k] = v;
    });
    return { meta: meta, body: m[2] };
  }

  /** 从 "# @id [type] #tag1 #tag2" 解析出 {id, type, tags} */
  function parseHeading(line) {
    var m = line.match(/^#+\s+@(\S+)(?:\s+\[([^\]]+)\])?(.*)$/);
    if (!m) return null;
    var id = m[1];
    var type = m[2] || 'unknown';
    var tagStr = m[3] || '';
    var tags = (tagStr.match(/#([\w/.-]+)/g) || []).map(function (t) { return t.slice(1); });
    return { id: id, type: type, tags: tags };
  }

  /** "key: value" 行解析成属性；值里的 [a, b] 解析成数组 */
  function parseAttr(line) {
    var i = line.indexOf(':');
    if (i < 0 || line.startsWith('#') || line.startsWith('-')) return null;
    var k = line.slice(0, i).trim();
    var v = line.slice(i + 1).trim();
    if (!k) return null;
    return { key: k, value: coerceVal(v) };
  }

  /** 值归一化：[a, b, c] → 数组，其余原样 */
  function coerceVal(v) {
    if (v.startsWith('[') && v.endsWith(']')) {
      return v.slice(1, -1).split(',').map(function (x) { return x.trim(); }).filter(Boolean);
    }
    return v;
  }

  /** 列表项：纯文本 → 字符串；含 "key:" → 映射（逗号分隔的多对 key: value 也支持） */
  function parseListItem(raw) {
    var s = raw.trim();
    if (!/^[\w_]+\s*:/.test(s)) return s;
    var parts = s.split(',');
    var allPairs = parts.every(function (p) { return /^[\w_]+\s*:/.test(p.trim()); });
    var obj = {};
    if (allPairs) {
      parts.forEach(function (p) {
        var kv = p.trim().match(/^([\w_]+)\s*:\s*(.*)$/);
        obj[kv[1]] = coerceVal(kv[2].trim());
      });
    } else {
      var m = s.match(/^([\w_]+)\s*:\s*(.*)$/);
      obj[m[1]] = coerceVal(m[2].trim());
    }
    return obj;
  }

  /** 把一个文档 body 解析成 [{id, type, tags, attributes}] 的列表；attributes 支持多行列表 */
  function parseObjects(body) {
    var lines = body.split('\n');
    var objects = [];
    var cur = null, listKey = null, itemIndent = -1;
    lines.forEach(function (raw) {
      var line = raw.replace(/\s+$/, '');
      var t = line.trim();
      if (t.startsWith('#')) {
        if (t.includes('@')) {
          var h = parseHeading(t);
          if (h) {
            if (cur) objects.push(cur);
            cur = { id: h.id, type: h.type, tags: h.tags, attributes: {} };
            listKey = null; itemIndent = -1;
          }
        }
        return;   // 普通小节标题：保持当前对象继续收属性
      }
      if (!cur) return;
      if (!t || t.startsWith('---') || t.startsWith('<!--')) return;
      var lm = line.match(/^(\s*)-\s+(.*)$/);
      if (lm && listKey) {
        itemIndent = lm[1].length;
        var arr = cur.attributes[listKey];
        if (!Array.isArray(arr)) arr = cur.attributes[listKey] = [];
        arr.push(parseListItem(lm[2]));
        return;
      }
      var cm = line.match(/^(\s+)([\w_]+)\s*:\s*(.*)$/);
      if (cm && listKey && itemIndent >= 0 && cm[1].length > itemIndent) {
        var list = cur.attributes[listKey];
        var last = list && list[list.length - 1];
        if (last && typeof last === 'object') { last[cm[2]] = coerceVal(cm[3].trim()); return; }
      }
      var a = parseAttr(t);
      if (a) {
        cur.attributes[a.key] = a.value;
        listKey = a.value === '' ? a.key : null;
        if (listKey) itemIndent = -1;
      } else {
        listKey = null; itemIndent = -1;
      }
    });
    if (cur) objects.push(cur);
    return objects;
  }

  /* ── 各 kind 的翻译器 ────────────────────────────────────── */

  /** claude-opus-5-5 → opus：和渠道命名（ch_opus）、casedef 的模型表对齐 */
  function shortModel(m) {
    var r = /^claude-([a-z]+)-/.exec(m || '');
    return r ? r[1] : (m || null);
  }
  var PHASE_MAP = { debate: 'debate1' };   // 文档标签 → casedef/sim 的 phase 名

  /** agents.md → def.individuals（部分字段）+ 返回 id→object 映射供后续用 */
  function loadAgents(body) {
    var objects = parseObjects(body);
    return objects.map(function (o) {
      var a = o.attributes;
      var phase = (o.tags.find(function (t) { return t.startsWith('phase/'); }) || '').slice(6) || 'build';
      if (PHASE_MAP[phase]) phase = PHASE_MAP[phase];
      var role = (o.tags.find(function (t) { return t.startsWith('role/'); }) || '').slice(5) || null;
      var model = shortModel(a.model || (o.tags.find(function (t) { return t.startsWith('model/'); }) || '').slice(6) || null);
      var groupTag = (o.tags.find(function (t) { return t.startsWith('group/'); }) || '').slice(6) || null;
      return {
        id: o.id,
        agentId: role || phase,
        kind: o.type === 'individual' ? 'agent' : o.type,
        name: a.name || o.id,
        model: model,
        phase: phase,
        role: a.role || '',
        trigger: a.trigger || '',
        groupId: groupTag || null,
        isHub: o.tags.indexOf('hub') >= 0,
        watches: Array.isArray(a.watches) ? a.watches : (a.watches ? [a.watches] : []),
        tags: o.tags,
        attributes: a,
        natives: [],
        channels: [],
        docs: [],
        tools: [],
        x: 0, y: 0,
        host: 'Claude Code', enhanced: false,
      };
    });
  }

  /** groups.md → def.groups（parent/children 双向写法都接受，统一成一层列表） */
  function loadGroups(body) {
    var objects = parseObjects(body);
    var groups = objects.map(function (o, i) {
      var a = o.attributes;
      var level = parseInt((o.tags.find(function (t) { return t.startsWith('level/'); }) || 'level/1').slice(6)) || 1;
      return {
        id: o.id,
        name: a.name || o.id,
        level: level,
        parentId: a.parent || null,
        order: i,
        children: Array.isArray(a.children) ? a.children : (a.children ? [a.children] : []),
        members: Array.isArray(a.members) ? a.members : (a.members ? [a.members] : []),
        tags: o.tags,
      };
    });
    var byId = {};
    groups.forEach(function (g) { byId[g.id] = g; });
    groups.forEach(function (g) {
      g.children.forEach(function (c) {
        if (byId[c]) byId[c].parentId = g.id;
      });
      if (g.parentId && byId[g.parentId] && byId[g.parentId].children.indexOf(g.id) < 0) {
        byId[g.parentId].children.push(g.id);
      }
    });
    return groups;
  }

  /** docs.md → def docs 列表 */
  function loadDocs(body) {
    var objects = parseObjects(body);
    return objects.map(function (o) {
      var a = o.attributes;
      var layer = (o.tags.find(function (t) { return t.startsWith('layer/'); }) || 'layer/private').slice(6);
      return {
        id: o.id,
        name: a.name || o.id,
        layer: layer,
        owner: a.owner || null,
        summary: a.summary || '',
        audience: Array.isArray(a.audience) ? a.audience : (a.audience === 'all' ? 'all' : [a.audience].filter(Boolean)),
        tags: o.tags,
      };
    });
  }

  /** 从一个对象块的原始文本里提取 paths 列表（兼容旧解析；新解析直接给 a.paths） */
  function parsePaths(block) {
    var lines = block.split('\n');
    var inPaths = false;
    var paths = [];
    var cur = null;
    lines.forEach(function (line) {
      var trimmed = line.trimEnd();
      if (/^paths\s*:/.test(trimmed.trimStart())) { inPaths = true; return; }
      if (!inPaths) return;
      if (/^\s+-\s+/.test(trimmed)) {
        if (cur) paths.push(cur);
        cur = {};
        var rest = trimmed.replace(/^\s+-\s+/, '');
        var m = rest.match(/^condition\s*:\s*(.*)/);
        if (m) cur.condition = m[1].trim();
        return;
      }
      if (!cur) return;
      if (/^\S/.test(trimmed) && trimmed.indexOf(':') > 0 && !/^\s*-/.test(trimmed)) {
        if (cur) { paths.push(cur); cur = null; }
        inPaths = false;
        return;
      }
      var fm = trimmed.trimStart().match(/^(condition|next|note)\s*:\s*(.*)/);
      if (fm) cur[fm[1]] = fm[2].trim();
    });
    if (cur) paths.push(cur);
    return paths;
  }

  /** steps 列表项归一 */
  function normStep(st) {
    if (typeof st === 'string') return { id: null, name: st, executors: [] };
    return {
      id: st.id || null,
      name: st.name || st.id || '',
      executors: Array.isArray(st.executors) ? st.executors : (st.executors ? [st.executors] : []),
    };
  }

  /** process.md → def.process {stages, gates, flows}；flows 由 casedef.finishProcess 统一生成 */
  function loadProcess(body) {
    var objects = parseObjects(body);

    // 把 body 按对象标题切片，供 parsePaths 兼容旧写法
    var lines = body.split('\n');
    var slices = {};
    var curId = null, curLines = [];
    lines.forEach(function (line) {
      if (line.startsWith('#') && line.includes('@')) {
        var h = parseHeading(line);
        if (h) {
          if (curId) slices[curId] = curLines.join('\n');
          curId = h.id; curLines = [line];
          return;
        }
      }
      if (curId) curLines.push(line);
    });
    if (curId) slices[curId] = curLines.join('\n');

    var stages = [], gates = [];
    objects.forEach(function (o) {
      var a = o.attributes;
      if (o.type === 'stage') {
        var groupTag = (o.tags.find(function (t) { return t.startsWith('group/'); }) || '').slice(6);
        var steps = (Array.isArray(a.steps) ? a.steps : []).map(normStep);
        // 扁平写法：stage 直接给 executors，不拆 steps → 合成一个步骤
        var flatExec = Array.isArray(a.executors) ? a.executors : (a.executors ? [a.executors] : []);
        if (!steps.length && flatExec.length) {
          steps.push({ id: 'st_' + o.id, name: a.name || o.id, executors: flatExec });
        }
        stages.push({
          id: o.id,
          name: a.name || o.id,
          groupId: groupTag || null,
          steps: steps,
          tags: o.tags,
        });
      } else if (o.type === 'gate') {
        var deciderType = a.decider_type || 'rule';
        var rawPaths = Array.isArray(a.paths) ? a.paths : parsePaths(slices[o.id] || '');
        gates.push({
          id: o.id,
          name: a.name || o.id,
          afterStage: a.after_stage || null,
          decider: {
            type: deciderType,
            who: a.decider_who || (deciderType === 'human' ? 'human' : null),
            text: a.decider_text || '',
          },
          pass: a.pass || (rawPaths[0] && rawPaths[0].next) || 'done',
          fail: a.fail || (rawPaths.find(function (p) { return p.next && p.next !== (a.pass || ''); }) || {}).next || null,
          paths: rawPaths,
          escalate: a.escalate || (deciderType === 'human' ? 'human' : null),
          tags: o.tags,
        });
      }
    });
    stages.forEach(function (s, i) { s.order = i; });   // sim 的案例行走按 order 找下一阶段
    return HUB.casedef.finishProcess(stages, gates);
  }

  /** relations.md → infoReads 和 watches 列表（从 @from >rel @to 格式解析） */
  function loadRelations(body) {
    var infoReads = [], watches = [];
    body.split('\n').forEach(function (line) {
      line = line.trim();
      var m = line.match(/^@(\S+)\s+>(read|watch)\s+@(\S+)\s*(.*)/);
      if (!m) return;
      var from = m[1], rel = m[2], to = m[3], note = m[4].trim();
      if (rel === 'read') infoReads.push([from, to, note]);
      else if (rel === 'watch') watches.push([from, to, note]);
    });
    return { infoReads: infoReads, watches: watches };
  }

  /** decisions/<agent>.md → decisions 列表 */
  function loadDecisions(body, agentId) {
    var objects = parseObjects(body);
    return objects.map(function (o) {
      var a = o.attributes;
      var stage = (o.tags.find(function (t) { return t.startsWith('stage/'); }) || '').slice(6);
      var kind = (o.tags.find(function (t) { return t.startsWith('kind/'); }) || '').slice(5);
      return {
        id: o.id,
        agentId: agentId,
        title: a.title || o.id,
        trigger: a.trigger || '',
        alternatives: Array.isArray(a.alternatives) ? a.alternatives : [],
        choice: a.choice || '',
        reason: a.reason || '',
        impact: a.impact || '',
        action: a.action || kind || 'deliver',
        stage: stage,
        tags: o.tags,
      };
    });
  }

  /** scenarios.md → sim 的 scenario 覆盖（cases/neverDispatch/undeclared/outage/versionChanges） */
  function loadScenarios(body) {
    var cases = parseObjects(body).filter(function (o) { return o.type === 'case'; }).map(function (o) {
      var a = o.attributes;
      return {
        id: o.id,
        name: a.name || o.id,
        rework: a.rework_gate ? { gate: a.rework_gate, times: parseInt(a.rework_times, 10) || 1 } : null,
        missing: (Array.isArray(a.missing) ? a.missing : []).map(function (mi) {
          return { ind: mi.ind, doc: mi.doc, note: mi.note || '' };
        }),
        blockedAt: a.blocked_at || null,
        inject: (Array.isArray(a.inject) ? a.inject : []).map(function (inj) {
          return { at: parseFloat(inj.at) || 0, to: inj.to || null, kind: inj.kind || 'instruction', text: inj.text || '' };
        }),
      };
    });
    var neverDispatch = [], undeclared = [], outage = [], versionChanges = [];
    var lines = body.split('\n');
    var kvPairs = function (s) {
      var out = [];
      s.trim().split(/\s+/).forEach(function (tok) {
        var kv = tok.split('=');
        if (kv.length === 2) out.push([kv[0], kv[1]]);
      });
      return out;
    };
    var num = function (v) { var n = parseFloat(v); return isNaN(n) ? v : n; };
    var followingNote = function (i) {
      for (var j = i + 1; j < Math.min(lines.length, i + 3); j++) {
        var m = lines[j].trim().match(/^note\s*:\s*(.*)$/);
        if (m) return m[1].trim();
      }
      return '';
    };
    var m;
    lines.forEach(function (raw, i) {
      var t = raw.trim();
      if ((m = t.match(/^never_dispatch\s*:\s*(.+)$/))) {
        var v = m[1].trim();
        if (v.startsWith('[') && v.endsWith(']')) v = v.slice(1, -1);
        neverDispatch = v.split(',').map(function (x) { return x.trim(); }).filter(Boolean);
      } else if ((m = t.match(/^@(\S+)\s+>undeclared_read\s+@(\S+)\s*(.*)$/))) {
        undeclared.push([m[1], m[2], m[3].trim()]);
      } else if ((m = t.match(/^@(\S+)\s+outage\s+(.+)$/))) {
        var o = { channel: m[1], note: followingNote(i) };
        kvPairs(m[2]).forEach(function (p) { o[p[0]] = num(p[1]); });
        outage.push(o);
      } else if ((m = t.match(/^version_change\s+(.+)$/))) {
        var vc = { note: followingNote(i) };
        kvPairs(m[1]).forEach(function (p) { vc[p[0]] = num(p[1]); });
        versionChanges.push(vc);
      }
    });
    return { cases: cases, neverDispatch: neverDispatch, undeclared: undeclared, outage: outage, versionChanges: versionChanges };
  }

  /* ── 统一模型的组装 ─────────────────────────────────────── */

  /** 把从文档读到的零散数据组装成统一模型的 def，事实层由 HUB.sim.simulate 生成 */
  function assemble(parts, caseId) {
    var individuals = parts.agents || [];
    var groups = parts.groups || [];
    var docs = parts.docs || [];
    var process = parts.process || { stages: [], gates: [], flows: [] };
    var relations = parts.relations || { infoReads: [], watches: [] };

    var indMap = {};
    individuals.forEach(function (x) { indMap[x.id] = x; });

    /* groups.md 的成员关系最权威：内层组覆盖 group/ 标签推断的 groupId */
    var gMap = {};
    groups.forEach(function (g) { gMap[g.id] = g; });
    groups.forEach(function (g) {
      g.members.forEach(function (mid) {
        var x = indMap[mid];
        if (!x) return;
        var cur = x.groupId && gMap[x.groupId];
        if (!cur || (g.level || 1) >= (cur.level || 1)) x.groupId = g.id;
      });
    });

    /* 模型渠道（与 casedef 同一套命名和常量，scenarios 的 @ch_opus 才能对上） */
    var CD = HUB.casedef || {};
    var channels = [], chIdx = {};
    var addChannel = function (c) { if (!chIdx[c.id]) { chIdx[c.id] = c; channels.push(c); } return chIdx[c.id]; };
    individuals.forEach(function (x) {
      if (!x.model) return;
      var c = addChannel({
        id: 'ch_' + x.model, kind: 'model',
        name: '模型：' + ((CD.MODEL_ZH || {})[x.model] || x.model),
        maintainer: 'meta_maint',
        capacity: (CD.CAPACITY || {})[x.model] || '-',
        quota: (CD.QUOTA || {})[x.model] || '-',
        limit: (CD.LIMIT || {})[x.model] || null,
        users: [],
      });
      c.users.push(x.id);
      x.channels.push(c.id);
    });
    channels.forEach(function (c) { c.tier = 'shared'; });

    /* 人与渠道维护者（和 casedef 的固定个体一致） */
    var human = {
      id: 'human', agentId: null, kind: 'human', name: '人（用户）', model: null, phase: null,
      groupId: null, role: '发起会话，在对话里给主智能体下指令', trigger: '自己决定',
      watches: [], docs: [], channels: [], natives: [], host: null, tools: [], x: 0, y: 0,
      isHub: false, enhanced: true, tags: [],
    };
    var maint = {
      id: 'meta_maint', agentId: null, kind: 'meta', name: '渠道维护者', model: 'haiku', phase: null,
      groupId: null, role: '盯着模型和工具渠道，出故障时生成维护任务并跟进恢复', trigger: '渠道检查失败或额度告警',
      watches: [], docs: [], channels: [], natives: [], host: 'Claude Code', tools: [], x: 0, y: 0,
      isHub: false, enhanced: true, tags: [],
    };
    individuals.push(human, maint);
    indMap[human.id] = human; indMap[maint.id] = maint;
    var nodeIds = individuals.filter(function (x) { return x.kind === 'agent'; }).map(function (x) { return x.id; });

    /* 关系（dedupe：type:sub:from:to 唯一，agents 的 watches 和 relations.md 双写只留一条） */
    var rels = [], relKeys = {};
    var addRel = function (type, sub, from, to, label) {
      if (!from || !to || from === to) return;
      if (!indMap[from] && !chIdx[from]) return;
      if (!indMap[to] && !chIdx[to]) return;
      var key = type + ':' + sub + ':' + from + ':' + to;
      if (relKeys[key]) { if (label && !relKeys[key].label) relKeys[key].label = label; return; }
      var r = { id: 'r' + rels.length, type: type, sub: sub, from: from, to: to, label: label || '' };
      relKeys[key] = r; rels.push(r);
    };
    var hub = individuals.find(function (x) { return x.isHub; }) || null;

    /* 任务线：从流程的派发关系推断（§18.6：按 process stages 的 executors 生成） */
    if (hub) addRel('task', 'dispatch', 'human', hub.id, '提出需求');
    else if (process.stages.length && process.stages[0].steps.length) {
      process.stages[0].steps[0].executors.forEach(function (x) { addRel('task', 'dispatch', 'human', x, '提出需求'); });
    }
    var executorsOf = function (stage) {
      var out = [];
      (stage.steps || []).forEach(function (st) { out = out.concat(st.executors || []); });
      return out;
    };
    for (var i = 0; i + 1 < process.stages.length; i++) {
      var froms = executorsOf(process.stages[i]).slice(-3);   // 收尾的执行者交棒
      var tos = executorsOf(process.stages[i + 1]).slice(0, 3); // 下一阶段的接棒者
      froms.forEach(function (f) {
        tos.forEach(function (tt) {
          var fx = indMap[f];
          var sub = fx && (fx.isHub || fx.phase === 'hitl') ? 'dispatch' : 'deliver';
          addRel('task', sub, f, tt, '');
        });
      });
    }

    /* 信息线与监督线（去重后合并） */
    relations.infoReads.forEach(function (r) { addRel('info', 'read', r[0], r[1], r[2]); });
    relations.watches.forEach(function (r) { addRel('watch', 'watch', r[0], r[1], r[2]); });
    individuals.forEach(function (x) {
      (x.watches || []).forEach(function (w) { if (indMap[w]) addRel('watch', 'watch', x.id, w, ''); });
    });
    if (hub) addRel('watch', 'watch', 'human', hub.id, '人通过中枢智能体下指令');

    /* 渠道线 */
    channels.forEach(function (ch) {
      ch.users.forEach(function (u) { addRel('channel', 'use', u, ch.id, ''); });
      addRel('channel', 'maintain', 'meta_maint', ch.id, '');
    });
    maint.watches = channels.map(function (c) { return c.id; });

    /* 监督关系回填到个体（视图和 analysis 都会读 watches 字段） */
    rels.forEach(function (r) {
      if (r.type === 'watch') {
        var w = indMap[r.from];
        if (w && w.watches.indexOf(r.to) < 0) w.watches.push(r.to);
      }
    });

    /* 文档受众展开 */
    docs.forEach(function (d) {
      d.version = 'v1';
      d.audience = d.audience === 'all' || d.audience == null ? nodeIds.slice()
        : (Array.isArray(d.audience) ? d.audience : [d.audience]).filter(function (id) { return indMap[id]; });
      d.audience.forEach(function (id) { var x = indMap[id]; if (x && x.docs.indexOf(d.id) < 0) x.docs.push(d.id); });
    });

    return {
      id: caseId,
      name: parts.meta && parts.meta.title || caseId,
      summary: parts.meta && parts.meta.summary || '',
      synthetic: true,
      def: {
        version: 'v1',
        versions: [{ id: 'v1', at: 0, note: '从文档解析', by: '解析' }],
        individuals: individuals,
        groups: groups,
        relations: rels,
        channels: channels,
        docs: docs,
        process: process,
      },
      source: { kind: 'docs', caseId: caseId },
    };
  }

  /* ── 主入口 ─────────────────────────────────────────────── */

  /** meta.md body 里的 yaml 块声明了各文件名；缺失时用默认名 */
  var DEFAULT_FILES = { agents_file: 'agents.md', groups_file: 'groups.md', docs_file: 'docs.md', process_file: 'process.md', relations_file: 'relations.md', scenarios_file: 'scenarios.md' };

  /**
   * 从 hub/cases/<caseId>/ 目录读取所有文档，组装成统一模型（def + 模拟 facts）。
   * @param {function} fetchFn  fetch(url) → Promise<string>，调用方提供（浏览器用 fetch，Node 用 fs）
   * @param {string} baseUrl    hub/cases/<caseId>/ 的基础路径
   * @param {string} caseId     案例 id
   * @returns {Promise<object>} 统一模型（可直接传给 addSource 的 build/load 函数）
   */
  function loadCase(fetchFn, baseUrl, caseId) {
    var base = baseUrl.replace(/\/$/, '') + '/';
    var get = function (path) {
      return fetchFn(base + path).then(function (res) {
        return typeof res === 'string' ? res : (res.ok ? res.text() : Promise.resolve(''));
      }).catch(function () { return ''; });
    };
    var hubChecked = function (text) {
      // frontmatter 里的 hub:"1.0" 是命名空间标识，缺失则跳过该文件
      if (!text) return '';
      var fm = parseFrontmatter(text);
      return fm.meta && fm.meta.hub ? fm.body : '';
    };

    return get('meta.md').then(function (metaText) {
      var files = Object.assign({}, DEFAULT_FILES);
      var ym = metaText.match(/```yaml\r?\n([\s\S]*?)```/);
      if (ym) {
        ym[1].split('\n').forEach(function (line) {
          var i = line.indexOf(':');
          if (i < 0) return;
          files[line.slice(0, i).trim()] = line.slice(i + 1).trim();
        });
      }
      return Promise.all(Object.keys(DEFAULT_FILES).map(function (k) { return get(files[k]); })).then(function (texts) {
        var parts = {};

        var metaParsed = parseFrontmatter(metaText);
        parts.meta = metaParsed.meta || {};
        var titleMatch = metaText.match(/^#\s+(.+)$/m);
        if (titleMatch) parts.meta.title = titleMatch[1].trim();
        var sumMatch = metaText.match(/^#\s+.+\n+([^#\n].+)/m);
        if (sumMatch) parts.meta.summary = sumMatch[1].trim();

        parts.agents    = loadAgents(hubChecked(texts[0]));
        parts.groups    = loadGroups(hubChecked(texts[1]));
        parts.docs      = loadDocs(hubChecked(texts[2]));
        parts.process   = loadProcess(hubChecked(texts[3]));
        parts.relations = loadRelations(hubChecked(texts[4]));
        parts.scenarios = loadScenarios(hubChecked(texts[5]));

        // decisions/ 里的文件（按 agents 里实际存在的个体逐个探测）
        var agentIds = parts.agents.filter(function (a) { return a.kind === 'agent'; }).map(function (a) { return a.id; });
        return Promise.all(agentIds.map(function (aid) {
          return get('decisions/' + aid + '.md').then(function (text) {
            return loadDecisions(hubChecked(text), aid);
          });
        })).then(function (allDecisions) {
          parts.decisions = [].concat.apply([], allDecisions);
          var model = assemble(parts, caseId);
          // 事实层：和 v41 精编案例同一条模拟流水线，scenario/decisions 作为覆盖
          if (HUB.sim && HUB.sim.simulate) {
            var decByAgent = {};
            parts.decisions.forEach(function (d) { (decByAgent[d.agentId] = decByAgent[d.agentId] || []).push(d); });
            model.facts = HUB.sim.simulate({ id: caseId, def: model.def, override: { scenario: parts.scenarios, decisions: decByAgent } });
          } else {
            model.facts = { synthetic: true, span: { start: 0, end: 0 }, cases: [], tasks: [], runs: [], decisions: parts.decisions, calls: [], handoffs: [], deliveries: [], gateEvents: [], channelEvents: [], versionEvents: [], actions: [], messages: [] };
          }
          return model;
        });
      });
    });
  }

  /**
   * 读取 hub/cases/_index.md，返回 [{id, title, dir}] 列表
   */
  function loadIndex(fetchFn, indexUrl) {
    return fetchFn(indexUrl).then(function (res) {
      var text = typeof res === 'string' ? res : '';
      var rows = [];
      text.split('\n').forEach(function (line) {
        // 表格行：| id | 标题 | 目录 |
        var m = line.match(/^\|\s*([^|]+)\s*\|\s*([^|]+)\s*\|\s*([^|]+)\s*\|/);
        if (!m || m[1].trim() === 'id' || /^-+$/.test(m[1].trim())) return;
        rows.push({ id: m[1].trim(), title: m[2].trim(), dir: m[3].trim() });
      });
      return rows;
    }).catch(function () { return []; });
  }

  HUB.fromDocs = {
    loadCase: loadCase,
    loadIndex: loadIndex,
    // 低级工具，供测试和脚本用
    parseFrontmatter: parseFrontmatter,
    parseHeading: parseHeading,
    parseObjects: parseObjects,
    loadAgents: loadAgents,
    loadGroups: loadGroups,
    loadDocs: loadDocs,
    loadProcess: loadProcess,
    loadRelations: loadRelations,
    loadDecisions: loadDecisions,
    loadScenarios: loadScenarios,
  };

  /* ── 自动注册 docs source（当 HUB.model 已就绪时）────────── */
  if (HUB.model && HUB.model.addSource) {
    // 计算 hub/cases/ 相对于当前页面的路径
    var CASES_BASE = (function () {
      var p = (typeof location !== 'undefined' ? location.pathname : '') || '';
      // observatory.html 在 hub/dist/，需要向上两级
      if (p.indexOf('/hub/dist/') >= 0 || p.indexOf('%2Fhub%2Fdist%2F') >= 0) return '../../hub/cases/';
      return 'hub/cases/';
    })();

    function fetchText(url) {
      return fetch(url).then(function (r) { return r.ok ? r.text() : ''; }).catch(function () { return ''; });
    }

    var docsCaseIds = null;   // null=未加载, string[]=已加载

    function ensureIndex() {
      if (docsCaseIds !== null) return Promise.resolve(docsCaseIds);
      return loadIndex(fetchText, CASES_BASE + '_index.md').then(function (rows) {
        docsCaseIds = rows.map(function (r) { return r.id; });
        return docsCaseIds;
      });
    }

    HUB.model.addSource({
      id: 'docs',
      label: '文档案例',
      owns: function (id) { return !!(docsCaseIds && docsCaseIds.indexOf(id) >= 0); },
      load: function (caseId) {
        return ensureIndex().then(function (ids) {
          if (ids.indexOf(caseId) < 0) return Promise.reject(new Error('docs 案例未找到：' + caseId));
          return loadCase(fetchText, CASES_BASE + caseId + '/', caseId);
        });
      },
    });

    // 预加载索引，让 owns() 能在 hash-restore 时同步返回
    ensureIndex();
  }
})();
