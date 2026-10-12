/* HUB.toTrace: one run of the model -> a session in the trace contract (trace/packages/contract) plus its
   coarse-grained layer, the run's decisions (docs/SPEC.md 17.5). The run's detail is drawn by the trace view,
   so a simulated run and a parsed session look the same; the simulator is just the first producer of the layer.
   Pure: no DOM. trace/packages/contract/test/hub-export.test.ts checks the output against the contract. */
(function () {
  'use strict';
  var HUB = (window.HUB = window.HUB || {});

  // the simulated clock starts on day 1 at 09:00 (HUB.util.fmtClock); the date itself means nothing
  var BASE = new Date(2026, 9, 1, 9, 0, 0).getTime();
  var FAMILY = { read: 'other', grep: 'other', search: 'web', fetch: 'web', browser: 'web', write: 'patch', edit: 'patch', bash: 'shell', spawn: 'agent', service: 'mcp' };
  var TURN = { failed: 'failed', interrupted: 'aborted', running: 'running' };
  var STATE = { failed: 'failed', interrupted: 'aborted', running: 'working' };

  function iso(t) { return new Date(BASE + t).toISOString(); }
  function chName(m, id) { return HUB.model.name('channel', id, m).replace(/^(模型|工具)：/, ''); }

  function message(dv) {
    return { id: dv.id, kind: 'message', role: dv.kind === 'context' ? 'context' : 'user', at: iso(dv.at),
      text: dv.kind === 'context' ? '送达：' + (dv.text || dv.docId) : (dv.text || '新指令') };
  }
  function modelStep(m, c) {
    return { id: c.id, kind: 'model', at: iso(c.start), endAt: iso(c.end), model: chName(m, c.channelId), text: c.output || undefined, calls: [],
      usage: { input: c.tokensIn, output: c.tokensOut, total: c.tokensIn + c.tokensOut } };
  }
  function toolStep(c) {
    var effects = [];
    if (c.tool === 'spawn') effects.push({ kind: 'subagent', label: (c.width || 1) + ' 个子智能体', status: 'ok', durationMs: c.end - c.start });
    if (c.status === 'retry') effects.push({ kind: 'command', label: '先失败，重试后成功', status: 'error' });
    return { id: c.id, kind: 'tool', name: c.name || c.tool || '工具', family: FAMILY[c.tool] || 'other', at: iso(c.start), endAt: iso(c.end),
      durationMs: c.end - c.start, input: c.input || undefined, output: c.output || undefined, status: c.status === 'error' ? 'error' : 'ok', effects: effects };
  }

  /* cut: the observation time; what happened after it is left out, and a run still going at the cut is running */
  function fromRun(m, run, cut) {
    var idx = m.idx;
    var seen = function (t) { return cut == null || t <= cut; };
    var x = idx.ind.get(run.individualId) || {};
    var task = idx.task.get(run.taskId);
    var decs = (idx.decsByRun.get(run.id) || []).filter(function (d) { return seen(d.start); }).sort(function (p, q) { return p.start - q.start || p.idx - q.idx; });
    var dvs = (idx.deliveriesByRun.get(run.id) || []).filter(function (d) { return seen(d.at); });
    var missed = dvs.filter(function (d) { return d.status === 'missing'; }).map(function (d) { return d.text || d.docId; });
    var sent = dvs.filter(function (d) { return d.status === 'delivered'; });
    var steps = [], segments = [];

    // Each decision covers what reached the run while it was the current one, then its calls; so every
    // segment is a run of consecutive steps, as the contract requires.
    decs.forEach(function (d, k) {
      var next = decs[k + 1];
      var own = sent.filter(function (dv) { return (k === 0 || dv.at >= d.start) && (!next || dv.at < next.start); });
      var calls = (idx.callsByDec.get(d.id) || []).filter(function (c) { return seen(c.start); }).sort(function (p, q) { return p.start - q.start; });
      var items = own.map(function (dv) { return { at: dv.at, step: message(dv) }; });
      var lastModel = null;
      calls.forEach(function (c) {
        var st = c.kind === 'model' ? modelStep(m, c) : toolStep(c);
        if (c.kind === 'model') lastModel = st;
        else if (lastModel) lastModel.calls.push(st.id);
        items.push({ at: c.start, step: st });
      });
      // a decision the run left no call for (e.g. asking someone directly) still shows, as a note
      if (!items.length) items.push({ at: d.start, step: { id: d.id + '.note', kind: 'event', name: 'note', at: iso(d.start), text: d.title } });
      items.sort(function (p, q) { return p.at - q.at; });
      var ids = items.map(function (it) { steps.push(it.step); return it.step.id; });
      var flags = [];
      if ((d.unsupported || []).length) flags.push('unsupported');
      if (calls.some(function (c) { return c.repeat; })) flags.push('repeat-read');
      if (k === 0 && missed.length) flags.push('missing-docs');
      segments.push({ id: d.id, kind: 'decision', turn: run.id, steps: ids, title: d.title, action: d.action,
        trigger: d.trigger || undefined,
        read: calls.filter(function (c) { return c.tool === 'read' && c.status === 'ok'; }).map(function (c) { return c.input; }),
        missed: k === 0 ? missed : [],
        injected: own.filter(function (dv) { return dv.kind !== 'context'; }).map(function (dv) { return dv.text || '新指令'; }),
        alternatives: (d.alternatives || []).slice(), choice: d.choice || undefined, reason: d.reason || undefined, impact: d.impact || undefined,
        outcome: d.outcome, flags: flags });
    });

    var going = run.outcome === 'running' || (cut != null && cut < run.end);
    var end = going && cut != null ? Math.max(run.start, cut) : run.end;
    var models = steps.filter(function (s) { return s.kind === 'model'; });
    var tools = steps.filter(function (s) { return s.kind === 'tool'; });
    var turn = { id: run.id, index: 1, status: going ? 'running' : (TURN[run.outcome] || 'completed'), startedAt: iso(run.start), endedAt: going ? undefined : iso(run.end),
      durationMs: going ? undefined : run.end - run.start, input: task ? task.name : undefined,
      output: decs.length ? (decs[decs.length - 1].impact || decs[decs.length - 1].choice || undefined) : undefined, steps: steps, usage: { total: run.tokens || 0 } };
    var sourceId = m.id + '.' + run.id;
    var session = {
      id: 'hub-sim:' + sourceId, sourceId: sourceId,
      source: { kind: 'hub-sim', format: 'hub-sim/run', adapter: 'hub-observatory@1' },
      title: (task ? task.name : '一次运行') + ' · ' + (x.name || run.individualId),
      agent: { product: '模拟', name: x.name || run.individualId, role: 'main', model: chName(m, run.channelId) },
      startedAt: iso(run.start), updatedAt: iso(end), links: [], turns: [turn], usage: { total: run.tokens || 0 },
      state: { status: going ? 'working' : (STATE[run.outcome] || 'idle') },
      stats: { turns: 1, modelCalls: models.length, toolCalls: tools.length, toolErrors: tools.filter(function (s) { return s.status === 'error'; }).length,
        messages: steps.filter(function (s) { return s.kind === 'message'; }).length, compactions: 0,
        subagents: tools.filter(function (s) { return s.family === 'agent'; }).length, durationMs: end - run.start, records: steps.length, skipped: 0 },
      notes: ['模拟数据']
    };
    var layer = { version: '0.1', session: session.id, producer: { kind: 'simulator', name: 'hub-sim@1', at: iso(end) },
      basis: { steps: steps.length, updatedAt: session.updatedAt }, segments: segments };
    return { session: session, layer: layer };
  }

  HUB.toTrace = { fromRun: fromRun, iso: iso };
})();
