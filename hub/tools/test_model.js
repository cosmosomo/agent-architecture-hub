#!/usr/bin/env node
/**
 * test_model.js - builds every preset through casedef -> sim -> analysis and checks invariants.
 * Usage: node hub/tools/test_model.js [presetId]
 */
const { createContext, loadScripts, pageScripts } = require('./load.js');

const ctx = loadScripts(createContext(), pageScripts(['data/', 'js/core/', 'js/sources/']));
const HUB = ctx.HUB;
const only = process.argv[2];
const ids = only ? [only] : Object.keys(HUB.base.presets);
let failures = 0;
const rows = [];

ids.forEach((id) => {
  const errs = [];
  const e = (m) => errs.push(m);
  let m;
  try {
    const t0 = Date.now();
    m = HUB.model.build(id);
    const tBuild = Date.now() - t0;
    const t1 = Date.now();
    const an = HUB.analysis.analyze(m, null);
    const anMid = HUB.analysis.analyze(m, m.facts.span.end / 2);
    const tAn = Date.now() - t1;
    const d = m.def, F = m.facts, I = m.idx;
    const endIds = new Set([...d.individuals.map((x) => x.id), ...d.channels.map((c) => c.id)]);
    d.individuals.forEach((x) => { if (x.kind === 'agent' && !I.group.has(x.groupId)) e(`${x.id} has no valid group`); });
    d.relations.forEach((r) => { if (!endIds.has(r.from) || !endIds.has(r.to)) e(`relation ${r.id} ${r.from}->${r.to} has a bad end`); });
    d.groups.forEach((g) => { if (g.parentId && !I.group.has(g.parentId)) e(`group ${g.id} bad parent`); });
    const pnodes = new Set(['start', 'done', 'human', ...d.process.stages.map((s) => s.id), ...d.process.gates.map((g) => g.id)]);
    d.process.flows.forEach((f) => { if (!pnodes.has(f.from) || !pnodes.has(f.to)) e(`flow ${f.id} ${f.from}->${f.to} bad`); });
    d.process.stages.forEach((s) => s.steps.forEach((st) => st.executors.forEach((x) => { if (!I.ind.has(x)) e(`step ${st.id} bad executor ${x}`); })));
    F.runs.forEach((r) => {
      if (!I.task.has(r.taskId)) e(`run ${r.id} bad task`);
      if (!I.ind.has(r.individualId)) e(`run ${r.id} bad individual`);
      if (!(r.end >= r.start)) e(`run ${r.id} ends before it starts`);
    });
    F.decisions.forEach((x) => { if (!I.run.has(x.runId)) e(`decision ${x.id} bad run`); });
    F.calls.forEach((c) => {
      if (!I.dec.has(c.decisionId)) e(`call ${c.id} bad decision`);
      if (!endIds.has(c.channelId)) e(`call ${c.id} unknown channel ${c.channelId}`);
    });
    F.handoffs.forEach((h) => { if (!I.ind.has(h.from) || !I.ind.has(h.to)) e(`handoff ${h.id} bad ends`); });
    if (!F.cases.length) e('no cases');
    if (!F.runs.length) e('no runs');
    if (tBuild + tAn > 1500) e(`slow: build ${tBuild}ms analysis ${tAn}ms`);
    rows.push([id, d.individuals.length - 2, d.groups.length, d.relations.filter((r) => r.type === 'task').length,
      d.process.stages.length + '/' + d.process.gates.length, F.cases.map((c) => c.status[0]).join(''), F.runs.length, F.decisions.length, F.calls.length,
      an.neverDispatched.length, an.factOnly.length, Object.values(an.delivery).filter((x) => x.missing.length).length,
      Object.values(an.gateStats).reduce((s, g) => s + g.fail, 0), an.health.length, (tBuild + tAn) + 'ms', anMid.totals.runs]);
  } catch (err) {
    e('EXCEPTION ' + (err && err.stack ? err.stack.split('\n').slice(0, 3).join(' | ') : err));
  }
  if (errs.length) { failures++; console.log(`FAIL ${id}`); errs.slice(0, 8).forEach((x) => console.log('   ' + x)); }
});

const head = ['preset', 'ind', 'grp', 'task', 'st/gt', 'cases', 'runs', 'decs', 'calls', 'never', 'factOnly', 'missing', 'fails', 'health', 'time', 'runs@mid'];
const w = head.map((h, i) => Math.max(h.length, ...rows.map((r) => String(r[i]).length)));
console.log(head.map((h, i) => h.padEnd(w[i])).join(' '));
rows.forEach((r) => console.log(r.map((x, i) => String(x).padEnd(w[i])).join(' ')));
console.log(failures ? `FAILED: ${failures} preset(s)` : `OK: ${rows.length} presets`);
process.exit(failures ? 1 : 0);
