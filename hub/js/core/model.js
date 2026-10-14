/* HUB.model: assembles definition + facts + indexes, caches analysis per time cut, applies page actions.
   Models come from sources: the simulator for the case templates, the local service for real sessions, and
   later others (another collaboration hub, an orchestration folder). A source says which model ids it owns and
   either builds a model at once or loads one; the views only ever see the model (docs/ARCHITECTURE.md). */
(function () {
  'use strict';
  var HUB = (window.HUB = window.HUB || {});
  var U = HUB.util;

  var cache = new Map();
  var anCache = new Map();
  var sources = [];

  /* src: { id, label, owns(id), build(id) -> model | load(id) -> Promise<model> } */
  function addSource(src) { sources = sources.filter(function (x) { return x.id !== src.id; }).concat([src]); }
  function sourceOf(id) { return sources.find(function (x) { return x.owns(id); }) || null; }

  // what every model gets from here, whatever made it: plan versions on the definition, the indexes
  function finish(m) {
    if (m.facts.versionEvents.length) {
      m.facts.versionEvents.forEach(function (v) { m.def.versions.push({ id: v.version, at: v.at, note: v.note, by: v.by }); });
      m.def.version = m.facts.versionEvents[m.facts.versionEvents.length - 1].version;
    }
    m.rev = m.rev || 0;
    m.idx = HUB.analysis.buildIdx(m.def, m.facts);
    m.cmp = HUB.analysis.comparability(m);   // what the health check may conclude (analysis.js)
    return m;
  }

  function build(caseId) {
    if (cache.has(caseId)) return cache.get(caseId);
    var src = sourceOf(caseId);
    if (!src || !src.build) throw new Error('model ' + caseId + ' is not loaded');
    var m = finish(src.build(caseId));
    cache.set(caseId, m);
    return m;
  }
  // for a source that takes time (a server): resolves once the model is in the cache
  function load(caseId) {
    if (cache.has(caseId)) return Promise.resolve(cache.get(caseId));
    var src = sourceOf(caseId);
    if (!src) return Promise.reject(new Error('没有能打开“' + caseId + '”的数据来源'));
    if (src.build) return Promise.resolve(build(caseId));
    return src.load(caseId).then(function (m) { m = finish(m); cache.set(caseId, m); return m; });
  }
  function ready(caseId) { var src = sourceOf(caseId); return cache.has(caseId) || !!(src && src.build); }

  addSource({
    id: 'sim', label: '模拟案例',
    owns: function (id) {
      if (!HUB.base || !HUB.base.presets[id]) return false;
      // an md case with the same id replaces the built-in preset (hub/cases/ is the source of truth)
      var docsSrc = sources.find(function (s) { return s.id === 'docs'; });
      if (docsSrc && docsSrc.owns(id)) return false;
      return true;
    },
    build: function (caseId) {
      var cd = HUB.casedef.build(caseId);
      return HUB.facts.provide({
        id: cd.id, name: cd.name, presetName: cd.presetName, summary: cd.summary, flowText: cd.flowText,
        category: cd.category, size: cd.size, synthetic: true,
        def: cd.def, rev: 0, clock: null, source: { kind: 'sim' }
      }, { id: cd.id });
    }
  });

  /* A run's detail in the trace contract: the source's own session when it has one (real sessions), else the
     run converted (simulated cases, with their decisions as the coarse layer). turn: the turn to show first. */
  function traceOf(m, run, cut) {
    var ref = m.source && m.source.runs && m.source.runs[run.id];
    if (ref) return { session: m.source.sessions.get(ref.session), layer: null, turn: ref.turn };
    return HUB.toTrace.fromRun(m, run, cut);
  }

  // where the facts of a model come from, in one short phrase for the status bar and the panels
  function factLabel(m) {
    var fs = m && m.factSource;
    if (fs && fs.kind === 'error') return '真实轨迹读取失败，下面显示的是模拟数据：' + fs.error;
    if (fs && fs.kind === 'trace') return '真实轨迹 · ' + fs.label + (fs.total > fs.files.length ? '（载入 ' + fs.files.length + '/' + fs.total + ' 个文件）' : '');
    return m && m.synthetic ? '模拟数据' : '本机真实会话';
  }

  function measured(m, quantity) {
    return !(m && m.factSource && m.factSource.kind === 'trace' && m.clock === 'ordinal' &&
      ['tokens', 'duration', 'delivery', 'channel'].indexOf(quantity) >= 0);
  }

  function an(state, model) {
    var m = model || HUB.model.current;
    if (!m) return null;
    var cut = state && state.time != null ? state.time : null;
    var key = m.id + '|' + m.rev + '|' + (cut == null ? 'all' : cut);
    if (!anCache.has(key)) {
      if (anCache.size > 60) anCache.clear();
      anCache.set(key, HUB.analysis.analyze(m, cut));
    }
    return anCache.get(key);
  }

  function select(caseId) {
    var src = sourceOf(caseId);
    if (cache.has(caseId)) {
      HUB.model.current = cache.get(caseId);
      return HUB.model.current;
    }
    if (src && src.load && !src.build) {
      // 异步来源（文档目录、hub-graph JSON、会话）：先保持当前模型，加载完成再换上并重画
      load(caseId).then(function (m) {
        if (!HUB.store.get || HUB.store.get().caseId !== caseId) return;
        HUB.model.current = m;
        HUB.bus.emit('model', { model: m });
      }).catch(function (e) { console.warn('model ' + caseId + ' 加载失败', e && e.message); });
      return HUB.model.current;
    }
    HUB.model.current = build(caseId);
    return HUB.model.current;
  }

  /* ---------- helpers other modules use ---------- */
  function visible(at, state) { return !state || state.time == null || at <= state.time; }
  function instanceOf(state, m) {
    m = m || HUB.model.current;
    if (!m) return null;
    if (state && state.instanceId && m.idx.case.has(state.instanceId)) return m.idx.case.get(state.instanceId);
    if (state && state.focus && state.focus.type === 'case' && m.idx.case.has(state.focus.id)) return m.idx.case.get(state.focus.id);
    return m.facts.cases[0] || null;
  }
  function latestRunOf(indId, state, m) {
    m = m || HUB.model.current;
    var rs = (m.idx.runsByInd.get(indId) || []).filter(function (r) { return visible(r.start, state); });
    if (state && state.focus && state.focus.type === 'case') {
      var inCase = rs.filter(function (r) { return r.caseId === state.focus.id; });
      if (inCase.length) rs = inCase;
    }
    return rs.length ? rs[rs.length - 1] : null;
  }
  // The run to show in the exec subject: focus run, else the latest run of the selected individual, else the busiest run of the case.
  function focusRun(state, m) {
    m = m || HUB.model.current;
    if (state.focus && state.focus.type === 'run' && m.idx.run.has(state.focus.id)) return m.idx.run.get(state.focus.id);
    if (state.selection && state.selection.type === 'individual') { var r = latestRunOf(state.selection.id, state, m); if (r) return r; }
    if (state.selection && state.selection.type === 'run' && m.idx.run.has(state.selection.id)) return m.idx.run.get(state.selection.id);
    var c = instanceOf(state, m);
    var rs = c ? (m.idx.runsByCase.get(c.id) || []) : m.facts.runs;
    var best = null;
    rs.forEach(function (x) { if (!best || (m.idx.decsByRun.get(x.id) || []).length > (m.idx.decsByRun.get(best.id) || []).length) best = x; });
    return best;
  }
  function name(type, id, m) {
    m = m || HUB.model.current;
    if (!m || id == null) return '';
    var x;
    switch (type) {
      case 'individual': x = m.idx.ind.get(id); return x ? x.name : id;
      case 'group': x = m.idx.group.get(id); return x ? x.name : id;
      case 'channel': x = m.idx.ch.get(id); return x ? x.name : id;
      case 'doc': x = m.idx.doc.get(id); return x ? x.name : id;
      case 'case': x = m.idx.case.get(id); return x ? x.name : id;
      case 'stage': x = m.idx.stage.get(id); return x ? x.name : id;
      case 'step': x = m.idx.step.get(id); return x ? x.name : id;
      case 'gate': x = m.idx.gate.get(id); return x ? x.name : id;
      case 'run': x = m.idx.run.get(id); return x ? (name('individual', x.individualId, m) + ' 的运行') : id;
      case 'decision': x = m.idx.dec.get(id); return x ? x.title : id;
      case 'call': x = m.idx.call.get(id); return x ? x.name : id;
      case 'task': x = m.idx.task.get(id); return x ? x.name : id;
      default: return String(id);
    }
  }

  /* ---------- page actions & reverse control ---------- */
  var REPLIES = [
    '收到。我会在当前这一步做完后按你的意思调整。',
    '明白。这条我先记进工作区，下一次运行开始时会读到。',
    '好的，我把它当作新的约束，已经同步给中枢智能体。'
  ];

  function previewControl(kind, payload) {
    var m = HUB.model.current;
    payload = payload || {};
    var target = payload.target || { type: 'individual', id: payload.from || 'human' };
    var text = payload.text || '';
    var ts = new Date().toISOString().slice(0, 19) + 'Z';
    var inst = m ? instanceOf(HUB.store ? HUB.store.get() : {}, m) : null;
    var caseId = inst ? inst.id : (m ? m.id : 'case_01');
    var file = 'traces/human_actions.jsonl';
    var modeLabel = '运行态 · 信箱与轨迹注入';
    var diff = '';

    if (kind === 'add_relation') {
      var fromId = payload.from || (target && target.id) || 'human';
      var toId = payload.to || '';
      var rtype = payload.relType || 'task';
      var fromNm = m ? name('individual', fromId, m) : fromId;
      var toNm = m ? name('individual', toId, m) : toId;
      file = 'relations.md';
      modeLabel = '设计态 · 编排文档写回';
      diff = [
        '--- a/' + file,
        '+++ b/' + file,
        '@@ -12,3 +12,5 @@',
        ' | 发出方 | 接收方 | 关系类型 | 交接与契约说明 |',
        ' | :--- | :--- | :--- | :--- |',
        '+| `' + fromId + '` (' + fromNm + ') | `' + toId + '` (' + toNm + ') | `' + rtype + '` | ' + (text || '人工新增协同交接线') + ' |',
        '+<!-- Reverse-Control Writeback at ' + ts + ' -->'
      ].join('\n');
    } else if (kind === 'edit_rule') {
      var tName = m && target ? name(target.type, target.id, m) : (target ? target.id : '');
      file = (target && (target.type === 'gate' || target.type === 'step')) ? 'process.md' : 'relations.md';
      modeLabel = '设计态 · 编排规则写回';
      diff = [
        '--- a/' + file,
        '+++ b/' + file,
        '@@ -18,2 +18,5 @@',
        ' ## 编排约束与拍板门禁',
        '+- **[' + tName + ' (`' + (target ? target.id : '') + '`)]** 人工修订规则：' + (text || '补充核验门禁约束'),
        '+  - 生效版本：`v' + (m ? m.def.versions.length + 1 : 2) + '` · 修订人：`human`'
      ].join('\n');
    } else {
      var indId = target && target.type === 'individual' ? target.id : (payload.to || 'orchestrator');
      var indNm = m && target ? name(target.type, target.id, m) : indId;
      file = target && target.type === 'individual' ? ('agents/' + indId + '/inbox.md') : 'traces/human_actions.jsonl';
      diff = [
        '--- a/' + file,
        '+++ b/' + file,
        '@@ -1,2 +1,9 @@',
        ' # Agent Control Inbox (`' + indId + '`)',
        '+',
        '+## [★ 人工调控指令 · `' + kind + '`]',
        '+- **目标对象**：' + indNm + ' (`' + indId + '`)',
        '+- **关联案例**：`' + caseId + '`',
        '+- **指令正文**：' + (text || '请按人工拍板要求立即复核当前上下文并继续执行'),
        '+- **轨迹注入**：同步写入 `traces/human_actions.jsonl` 并在协作轨迹图点亮 `★调控` 角标'
      ].join('\n');
    }
    return { kind: kind, payload: payload, target: target, file: file, modeLabel: modeLabel, diff: diff };
  }

  function perform(kind, payload) {
    var m = HUB.model.current;
    if (!m) return null;
    payload = payload || {};
    var F = m.facts;
    var st = HUB.store ? HUB.store.get() : {};
    var now = st.time != null ? st.time : F.span.end;
    var target = payload.target || null;
    var text = payload.text || '';
    var inst = instanceOf(st, m);
    var act = {
      id: U.uid('act'),
      at: now,
      kind: kind,
      target: target,
      targetId: payload.to || (target && target.id) || null,
      caseId: inst ? inst.id : null,
      text: text,
      status: 'recorded'
    };
    var targetInd = target && target.type === 'individual' ? m.idx.ind.get(target.id) : null;
    var runningRun = targetInd ? (m.idx.runsByInd.get(targetInd.id) || []).find(function (r) { return r.start <= now && r.end > now; }) : null;

    switch (kind) {
      case 'add_relation':
        var fromId = payload.from || (target && target.id) || 'human';
        var toId = payload.to || '';
        var rtype = payload.relType || 'task';
        if (fromId && toId && fromId !== toId) {
          var relId = U.uid('rel');
          m.def.relations.push({
            id: relId,
            type: rtype,
            from: fromId,
            to: toId,
            label: text || '协同交接',
            channelId: (m.def.channels[0] && m.def.channels[0].id) || null
          });
          var vr = 'v' + (m.def.versions.length + 1);
          var noteR = '新增编排关系：' + name('individual', fromId, m) + ' → ' + name('individual', toId, m) + '（' + (text || rtype) + '）';
          F.versionEvents.push({ id: U.uid('ve'), at: now, version: vr, note: noteR, by: '人（用户）' });
          m.def.versions.push({ id: vr, at: now, note: noteR, by: '人（用户）' });
          m.def.version = vr;
          act.text = noteR;
          act.targetId = toId;
          act.status = 'delivered';
        }
        break;
      case 'talk':
        F.messages.push({ id: U.uid('msg'), at: now, from: 'human', to: target.id, text: text });
        F.messages.push({ id: U.uid('msg'), at: now + 60000, from: target.id, to: 'human', text: REPLIES[F.messages.length % REPLIES.length] });
        act.status = 'delivered';
        break;
      case 'interject':
        F.deliveries.push({ id: U.uid('dv'), runId: runningRun ? runningRun.id : null, individualId: target.id, docId: null, kind: 'instruction',
          text: text || '新指令', at: now, status: runningRun ? 'delivered' : 'pending', confirmed: !!runningRun, by: 'human' });
        act.status = runningRun ? 'delivered' : 'pending';
        break;
      case 'redeliver':
        F.deliveries.push({ id: U.uid('dv'), runId: runningRun ? runningRun.id : null, individualId: target.id, docId: payload.docId || null, kind: 'context',
          text: (m.idx.doc.get(payload.docId) || {}).name || text || '补送资料', at: now, status: 'delivered', confirmed: !!runningRun, by: 'human' });
        act.status = 'delivered';
        break;
      case 'urge':
      case 'reassign':
        F.messages.push({ id: U.uid('msg'), at: now, from: 'human', to: (m.def.individuals.find(function (x) { return x.isHub; }) || { id: 'human' }).id,
          text: (kind === 'urge' ? '催办：' : '改派：') + name(target.type, target.id, m) + (text ? '。' + text : '') });
        act.status = 'delivered';
        break;
      case 'edit_rule':
        var v = 'v' + (m.def.versions.length + 1);
        var note = '人让中枢智能体修改“' + name(target.type, target.id, m) + '”' + (text ? '：' + text : '');
        F.versionEvents.push({ id: U.uid('ve'), at: now, version: v, note: note, by: '人（用户）' });
        m.def.versions.push({ id: v, at: now, note: note, by: '人（用户）' });
        m.def.version = v;
        act.status = 'delivered';
        break;
      case 'pause_channel':
      case 'resume_channel':
        F.channelEvents.push({ id: U.uid('ce'), channelId: target.id, at: now, kind: kind === 'pause_channel' ? 'pause' : 'resume',
          note: kind === 'pause_channel' ? '人暂停了这条渠道' : '人恢复了这条渠道' });
        break;
      case 'set_limit':
        var ch = m.idx.ch.get(target.id);
        var lim = parseInt(text, 10);
        lim = isFinite(lim) && lim > 0 ? lim : null;
        if (ch) {
          var old = ch.limit;
          ch.limit = lim;
          ch.capacity = lim ? (lim === 1 ? '独占' : '并发 ' + lim) : '不限';
          var v2 = 'v' + (m.def.versions.length + 1);
          var note2 = '“' + ch.name + '”并发上限 ' + (old || '不限') + ' → ' + (lim || '不限') + '（之后的运行按新上限排队）';
          F.versionEvents.push({ id: U.uid('ve'), at: now, version: v2, note: note2, by: '人（用户）' });
          m.def.versions.push({ id: v2, at: now, note: note2, by: '人（用户）' });
          m.def.version = v2;
          act.text = note2;
        }
        act.status = 'delivered';
        break;
      case 'assign_maint':
        F.channelEvents.push({ id: U.uid('ce'), channelId: target.id, at: now, kind: 'maint_task', note: '人指派渠道维护者检查' + (text ? '：' + text : '') });
        break;
      case 'approve':
        var c = F.cases.find(function (k) { return k.waitingAt && target && k.waitingAt === target.id; });
        if (c) {
          F.gateEvents.push({ id: U.uid('ge'), caseId: c.id, gateId: c.waitingAt, at: now, result: 'pass', by: 'human', queue: 0 });
          c.path.push({ node: c.waitingAt, at: now });
          c.waitingAt = null;
          c.status = 'running';
        }
        act.status = 'delivered';
        break;
      default:
        break;
    }
    F.actions.push(act);
    m.rev += 1;
    m.idx = HUB.analysis.buildIdx(m.def, m.facts);
    m.cmp = HUB.analysis.comparability(m);
    if (typeof window !== 'undefined' && window.fetch && window.location && /^https?:/.test(window.location.protocol)) {
      try {
        window.fetch('/api/control', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ modelId: m.id, caseId: act.caseId, kind: kind, payload: payload, action: act })
        }).catch(function () {});
      } catch (e) {}
    }
    HUB.bus.emit('model', { model: m, action: act });
    return act;
  }

  HUB.model = {
    current: null,
    build: build, load: load, ready: ready, owns: function (id) { return !!sourceOf(id); }, addSource: addSource,
    select: select, an: an, perform: perform, previewControl: previewControl, traceOf: traceOf,
    visible: visible, instanceOf: instanceOf, latestRunOf: latestRunOf, focusRun: focusRun, name: name, factLabel: factLabel, measured: measured
  };
})();
