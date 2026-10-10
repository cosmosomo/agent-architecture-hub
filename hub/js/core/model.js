/* HUB.model: assembles definition + facts + indexes, caches analysis per time cut, applies page actions. */
(function () {
  'use strict';
  var HUB = (window.HUB = window.HUB || {});
  var U = HUB.util;

  var cache = new Map();
  var anCache = new Map();

  function build(caseId) {
    if (cache.has(caseId)) return cache.get(caseId);
    var cd = HUB.casedef.build(caseId);
    var facts = HUB.sim.simulate(cd);
    var m = {
      id: cd.id, name: cd.name, presetName: cd.presetName, summary: cd.summary, flowText: cd.flowText,
      category: cd.category, size: cd.size, curated: cd.curated, synthetic: true,
      def: cd.def, facts: facts, rev: 0
    };
    if (facts.versionEvents.length) {
      facts.versionEvents.forEach(function (v) { m.def.versions.push({ id: v.version, at: v.at, note: v.note, by: v.by }); });
      m.def.version = facts.versionEvents[facts.versionEvents.length - 1].version;
    }
    m.idx = HUB.analysis.buildIdx(m.def, m.facts);
    cache.set(caseId, m);
    return m;
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
    var m = build(caseId);
    HUB.model.current = m;
    return m;
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

  /* ---------- page actions ---------- */
  var REPLIES = [
    '收到。我会在当前这一步做完后按你的意思调整。',
    '明白。这条我先记进工作区，下一次运行开始时会读到。',
    '好的，我把它当作新的约束，已经同步给中枢智能体。'
  ];
  function perform(kind, payload) {
    var m = HUB.model.current;
    if (!m) return null;
    payload = payload || {};
    var F = m.facts;
    var st = HUB.store ? HUB.store.get() : {};
    var now = st.time != null ? st.time : F.span.end;
    var target = payload.target || null;
    var text = payload.text || '';
    var act = { id: U.uid('act'), at: now, kind: kind, target: target, text: text, status: 'recorded' };
    var targetInd = target && target.type === 'individual' ? m.idx.ind.get(target.id) : null;
    var runningRun = targetInd ? (m.idx.runsByInd.get(targetInd.id) || []).find(function (r) { return r.start <= now && r.end > now; }) : null;

    switch (kind) {
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
    HUB.bus.emit('model', { model: m, action: act });
    return act;
  }

  HUB.model = {
    current: null,
    build: build, select: select, an: an, perform: perform,
    visible: visible, instanceOf: instanceOf, latestRunOf: latestRunOf, focusRun: focusRun, name: name
  };
})();
