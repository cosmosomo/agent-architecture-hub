/* HUB.fromDocs: hub/cases/ 目录里的 Markdown 文档 → 统一模型（hub/SPEC.md §5）
   格式规范见 hub/docs/hub-graph-format.md §18.6

   解析规则：
   - frontmatter hub:"1.0" 是命名空间标识，缺失则跳过
   - # @id [type] #tag1 #tag2  → 开始一个对象定义
   - key: value 行是属性（直到下一个 # 标题）
   - 纯段落文字是人读的注释，跳过
   - decisions/ 里每个文件是一个智能体的决策列表

   用法（浏览器里用 fetch 读文件，Node 里用 fs）：
     HUB.fromDocs.load(fetch, baseUrl).then(model => HUB.model.addSource(...))
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

  /** "key: value" 行解析成属性，值里的 [a, b] 解析成数组 */
  function parseAttr(line) {
    var i = line.indexOf(':');
    if (i < 0 || line.startsWith('#') || line.startsWith('-')) return null;
    var k = line.slice(0, i).trim();
    var v = line.slice(i + 1).trim();
    if (!k) return null;
    // 数组形式 [a, b, c]
    if (v.startsWith('[') && v.endsWith(']')) {
      v = v.slice(1, -1).split(',').map(function (x) { return x.trim(); }).filter(Boolean);
    }
    return { key: k, value: v };
  }

  /** 把一个文档 body 解析成 [{id, type, tags, attributes}] 的列表 */
  function parseObjects(body) {
    var lines = body.split('\n');
    var objects = [];
    var cur = null;
    lines.forEach(function (line) {
      line = line.trimEnd();
      if (line.startsWith('#') && line.includes('@')) {
        if (cur) objects.push(cur);
        var h = parseHeading(line);
        if (!h) return;
        cur = { id: h.id, type: h.type, tags: h.tags, attributes: {} };
        return;
      }
      if (!cur) return;
      if (!line || line.startsWith('---') || line.startsWith('<!--')) return;
      var a = parseAttr(line);
      if (a) cur.attributes[a.key] = a.value;
    });
    if (cur) objects.push(cur);
    return objects;
  }

  /* ── 各 kind 的翻译器 ────────────────────────────────────── */

  /** agents.md → def.individuals（部分字段）+ 返回 id→object 映射供后续用 */
  function loadAgents(body) {
    var objects = parseObjects(body);
    return objects.map(function (o) {
      var a = o.attributes;
      var phase = (o.tags.find(function (t) { return t.startsWith('phase/'); }) || '').slice(6) || 'build';
      var role = (o.tags.find(function (t) { return t.startsWith('role/'); }) || '').slice(5) || null;
      var model = a.model || (o.tags.find(function (t) { return t.startsWith('model/'); }) || '').slice(6) || null;
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
        host: null, enhanced: false,
      };
    });
  }

  /** groups.md → def.groups */
  function loadGroups(body) {
    var objects = parseObjects(body);
    return objects.map(function (o, i) {
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

  /** process.md → def.process {stages, gates} */
  function loadProcess(body) {
    var objects = parseObjects(body);
    var stages = [], gates = [];
    objects.forEach(function (o) {
      var a = o.attributes;
      if (o.type === 'stage') {
        var groupTag = (o.tags.find(function (t) { return t.startsWith('group/'); }) || '').slice(6);
        stages.push({
          id: o.id,
          name: a.name || o.id,
          groupId: groupTag || null,
          steps: [],   // steps 用 YAML list 格式，暂留空，后续可扩展
          tags: o.tags,
        });
      } else if (o.type === 'gate') {
        gates.push({
          id: o.id,
          name: a.name || o.id,
          afterStage: a.after_stage || null,
          decider: {
            type: a.decider_type || 'rule',
            who: a.decider_who || null,
            text: a.decider_text || '',
          },
          pass: a.pass || 'done',
          fail: a.fail || null,
          escalate: a.escalate || null,
          tags: o.tags,
        });
      }
    });
    return { stages: stages, gates: gates, flows: [] };
  }

  /** relations.md → infoReads 和 watches 列表（从 @from >rel @to 格式解析） */
  function loadRelations(body) {
    var infoReads = [], watches = [];
    body.split('\n').forEach(function (line) {
      line = line.trim();
      // @from >read @to  或  @from >watch @to
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

  /* ── 统一模型的组装 ──────────────────────────────────────── */

  /** 把从文档读到的零散数据组装成 HUB.casedef 能接受的格式 */
  function assemble(parts, caseId) {
    var individuals = parts.agents || [];
    var groups = parts.groups || [];
    var docs = parts.docs || [];
    var process = parts.process || { stages: [], gates: [], flows: [] };
    var relations = parts.relations || { infoReads: [], watches: [] };
    var decisions = parts.decisions || [];

    // 把 watches 字段翻译成 def.relations 里的 watch 类型
    var defRelations = [];
    var relIdx = 0;
    var addRel = function (type, sub, from, to, label) {
      defRelations.push({ id: 'r' + (++relIdx), type: type, sub: sub, from: from, to: to, label: label || '' });
    };
    individuals.forEach(function (x) {
      (x.watches || []).forEach(function (wid) { addRel('watch', 'watch', x.id, wid, ''); });
    });
    relations.infoReads.forEach(function (r) { addRel('info', 'read', r[0], r[1], r[2]); });
    relations.watches.forEach(function (r) { addRel('watch', 'watch', r[0], r[1], r[2]); });
    // 任务线从流程的派发关系里推断（简化：按 process stages executors 生成）
    // 完整版由 casedef.js 的逻辑接管，这里只做最基础的结构翻译

    // 人类个体（固定）
    var human = {
      id: 'human', agentId: null, kind: 'human', name: '人（用户）', model: null, phase: null,
      groupId: null, role: '发起会话，在对话里给主智能体下指令', trigger: '自己决定',
      watches: [], docs: [], channels: [], natives: [], host: null, tools: [], x: -100, y: 0,
      isHub: false, enhanced: true, tags: [],
    };
    individuals.push(human);

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
        relations: defRelations,
        channels: [],
        docs: docs,
        process: process,
      },
      facts: { synthetic: true, span: { start: 0, end: 0 }, cases: [], tasks: [], runs: [], decisions: decisions, calls: [], handoffs: [], deliveries: [], gateEvents: [], channelEvents: [], versionEvents: [], actions: [], messages: [] },
      rev: 0,
      source: { kind: 'docs', caseId: caseId },
    };
  }

  /* ── 主入口 ─────────────────────────────────────────────── */

  /**
   * 从 hub/cases/<caseId>/ 目录读取所有文档，组装成统一模型。
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

    var files = ['meta.md', 'agents.md', 'groups.md', 'docs.md', 'process.md', 'relations.md', 'scenarios.md'];
    return Promise.all(files.map(get)).then(function (texts) {
      var parts = {};

      // meta
      var metaParsed = parseFrontmatter(texts[0]);
      parts.meta = metaParsed.meta || {};
      // 从 body 里读 title / summary
      var titleMatch = texts[0].match(/^#\s+(.+)$/m);
      if (titleMatch) parts.meta.title = titleMatch[1].trim();
      var sumMatch = texts[0].match(/^#\s+.+\n+([^#\n].+)/m);
      if (sumMatch) parts.meta.summary = sumMatch[1].trim();

      parts.agents    = loadAgents(parseFrontmatter(texts[1]).body);
      parts.groups    = loadGroups(parseFrontmatter(texts[2]).body);
      parts.docs      = loadDocs(parseFrontmatter(texts[3]).body);
      parts.process   = loadProcess(parseFrontmatter(texts[4]).body);
      parts.relations = loadRelations(parseFrontmatter(texts[5]).body);
      // scenarios 暂解析为原始文本，后续扩展
      parts.scenarios = texts[6];

      // decisions/ 里的文件（按 agents 里有 decisions 字段或目录扫描）
      var agentIds = parts.agents.filter(function (a) { return a.kind === 'agent'; }).map(function (a) { return a.id; });
      return Promise.all(agentIds.map(function (aid) {
        return get('decisions/' + aid + '.md').then(function (text) {
          if (!text) return [];
          return loadDecisions(parseFrontmatter(text).body, aid);
        });
      })).then(function (allDecisions) {
        parts.decisions = [].concat.apply([], allDecisions);
        return assemble(parts, caseId);
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
        if (!m || m[1].trim() === 'id' || m[1].trim() === '---') return;
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
  };
})();
