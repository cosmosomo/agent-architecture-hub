#!/usr/bin/env node
/**
 * check_case.js - validates a curated case file against SPEC.md §12.2.
 * Usage: node hub/tools/check_case.js hub/data/cases/<preset>.js
 * Exit code 1 when there are errors. Warnings do not fail.
 */
const path = require('path');
const { createContext, loadScripts } = require('./load.js');

const file = process.argv[2];
if (!file) { console.error('usage: node hub/tools/check_case.js <case file>'); process.exit(2); }
const rel = path.relative(path.join(__dirname, '..'), path.resolve(file)).replace(/\\/g, '/');
const ctx = loadScripts(createContext(), ['data/base.js', rel]);
const B = ctx.HUB.base;
const cases = ctx.HUB.cases || {};
const errors = [], warns = [];
const err = (m) => errors.push(m), warn = (m) => warns.push(m);

const TOOL_IDS = new Set();
Object.values(B.agents).forEach((a) => String(a.tools || '').split(',').map((s) => s.trim()).filter(Boolean)
  .forEach((t) => TOOL_IDS.add('ch_tool_' + t.toLowerCase().replace(/[^a-z0-9]/g, ''))));
const MODEL_CH = new Set(['ch_opus', 'ch_sonnet', 'ch_haiku', 'ch_fable']);

Object.keys(cases).forEach((pid) => {
  const c = cases[pid];
  const p = B.presets[pid];
  if (!p) { err(`${pid}: preset not found in base.js`); return; }
  const nodeIds = new Set(p.nodes.map((_, i) => 'n' + i));
  const indIds = new Set([...nodeIds, 'human', 'meta_maint']);
  const isInd = (x) => indIds.has(x);
  const at = (v, where) => { if (typeof v !== 'number' || v < 0 || v > 1) err(`${pid}: ${where}: at/dur must be 0..1, got ${v}`); };

  ['title', 'summary'].forEach((k) => { if (c[k] != null && typeof c[k] !== 'string') err(`${pid}: ${k} must be a string`); });
  if (!c.title) warn(`${pid}: no title`);

  // groups
  const groupIds = new Set();
  const seenMember = new Map();
  const walkGroups = (arr, level, parent) => {
    (arr || []).forEach((g) => {
      if (!g.id || !g.name) err(`${pid}: group needs id and name (${JSON.stringify(g).slice(0, 60)})`);
      if (groupIds.has(g.id)) err(`${pid}: duplicate group id ${g.id}`);
      groupIds.add(g.id);
      if (level > 2) err(`${pid}: group ${g.id} nested deeper than 2 levels`);
      (g.members || []).forEach((m) => {
        if (!isInd(m)) err(`${pid}: group ${g.id} member ${m} is not a node`);
        if (seenMember.has(m)) err(`${pid}: ${m} is in two groups (${seenMember.get(m)}, ${g.id})`);
        seenMember.set(m, g.id);
      });
      walkGroups(g.children, level + 1, g.id);
    });
  };
  walkGroups(c.groups, 1, null);
  if (c.groups) nodeIds.forEach((n) => { if (!seenMember.has(n)) warn(`${pid}: ${n} (${p.nodes[+n.slice(1)].d}) is in no group`); });

  // individuals
  Object.keys(c.individuals || {}).forEach((k) => {
    if (!isInd(k)) err(`${pid}: individuals.${k} is not a node`);
    (c.individuals[k].watches || []).forEach((w) => { if (!isInd(w) && !MODEL_CH.has(w) && !TOOL_IDS.has(w)) warn(`${pid}: individuals.${k}.watches ${w} unknown`); });
  });

  // docs
  const docIds = new Set(['d_goal', 'd_terms', 'd_map', 'd_role_human', 'd_role_meta_maint', ...[...nodeIds].map((n) => 'd_role_' + n)]);
  (c.docs || []).forEach((d) => {
    if (!d.id || !d.name) err(`${pid}: doc needs id and name`);
    if (!['consensus', 'private', 'map'].includes(d.layer)) err(`${pid}: doc ${d.id} layer must be consensus|private|map`);
    if (d.owner && !isInd(d.owner)) err(`${pid}: doc ${d.id} owner ${d.owner} is not a node`);
    if (d.audience !== 'all') (d.audience || []).forEach((a) => { if (!isInd(a)) err(`${pid}: doc ${d.id} audience ${a} is not a node`); });
    docIds.add(d.id);
  });

  (c.infoReads || []).forEach((t) => { if (!isInd(t[0]) || !isInd(t[1])) err(`${pid}: infoReads ${JSON.stringify(t)} has a bad node`); });
  (c.watches || []).forEach((t) => { if (!isInd(t[0]) || !isInd(t[1])) err(`${pid}: watches ${JSON.stringify(t)} has a bad node`); });

  // channels
  const chIds = new Set([...MODEL_CH, ...TOOL_IDS]);
  (c.channels || []).forEach((ch) => {
    if (!ch.id || !ch.name) err(`${pid}: channel needs id and name`);
    if (!['model', 'tool'].includes(ch.kind)) err(`${pid}: channel ${ch.id} kind must be model|tool`);
    (ch.users || []).forEach((u) => { if (!isInd(u)) err(`${pid}: channel ${ch.id} user ${u} is not a node`); });
    chIds.add(ch.id);
  });

  // process
  const stageIds = new Set(), gateIds = new Set();
  const never = new Set((c.scenario && c.scenario.neverDispatch) || []);
  if (c.process) {
    const stepIds = new Set();
    (c.process.stages || []).forEach((s) => {
      if (!s.id || !s.name) err(`${pid}: stage needs id and name`);
      if (stageIds.has(s.id)) err(`${pid}: duplicate stage ${s.id}`);
      stageIds.add(s.id);
      if (s.groupId && c.groups && !groupIds.has(s.groupId)) err(`${pid}: stage ${s.id} groupId ${s.groupId} not in groups`);
      if (!(s.steps || []).length) err(`${pid}: stage ${s.id} has no steps`);
      (s.steps || []).forEach((st) => {
        if (!st.id || !st.name) err(`${pid}: step needs id and name`);
        if (stepIds.has(st.id)) err(`${pid}: duplicate step ${st.id}`);
        stepIds.add(st.id);
        if (!(st.executors || []).length) err(`${pid}: step ${st.id} has no executors`);
        (st.executors || []).forEach((x) => {
          if (!isInd(x)) err(`${pid}: step ${st.id} executor ${x} is not a node`);
          if (never.has(x)) err(`${pid}: step ${st.id} executor ${x} is in neverDispatch`);
        });
      });
    });
    (c.process.gates || []).forEach((g) => {
      if (!g.id || !g.name) err(`${pid}: gate needs id and name`);
      gateIds.add(g.id);
      if (!stageIds.has(g.afterStage)) err(`${pid}: gate ${g.id} afterStage ${g.afterStage} unknown`);
      ['pass', 'fail'].forEach((k) => { if (g[k] && g[k] !== 'done' && !stageIds.has(g[k])) err(`${pid}: gate ${g.id} ${k} -> ${g[k]} unknown`); });
      if (!g.decider || !['rule', 'agent', 'human'].includes(g.decider.type)) err(`${pid}: gate ${g.id} decider.type must be rule|agent|human`);
      else if (g.decider.type !== 'rule' && g.decider.who && !isInd(g.decider.who)) err(`${pid}: gate ${g.id} decider.who ${g.decider.who} is not a node`);
      if (g.escalate && g.escalate !== 'human') err(`${pid}: gate ${g.id} escalate must be 'human' or null`);
    });
  }

  // scenario
  const sc = c.scenario || {};
  const caseIds = new Set();
  (sc.cases || []).forEach((k) => {
    if (!/^K\d+$/.test(k.id || '')) err(`${pid}: scenario case id must look like K1 (${k.id})`);
    if (caseIds.has(k.id)) err(`${pid}: duplicate scenario case ${k.id}`);
    caseIds.add(k.id);
    if (!k.name) warn(`${pid}: scenario case ${k.id} has no name`);
    if (k.rework && c.process && !gateIds.has(k.rework.gate)) err(`${pid}: ${k.id}.rework.gate ${k.rework.gate} unknown`);
    (k.missing || []).forEach((m) => {
      if (!isInd(m.ind)) err(`${pid}: ${k.id}.missing ind ${m.ind} is not a node`);
      if (!docIds.has(m.doc)) err(`${pid}: ${k.id}.missing doc ${m.doc} unknown`);
    });
    (k.inject || []).forEach((m) => {
      if (!isInd(m.to)) err(`${pid}: ${k.id}.inject to ${m.to} is not a node`);
      at(m.at, `${k.id}.inject`);
      if (!['instruction', 'feedback', 'context'].includes(m.kind)) err(`${pid}: ${k.id}.inject kind must be instruction|feedback|context`);
    });
    if (k.blockedAt && c.process && !gateIds.has(k.blockedAt) && !stageIds.has(k.blockedAt)) err(`${pid}: ${k.id}.blockedAt ${k.blockedAt} unknown`);
  });
  (sc.neverDispatch || []).forEach((n) => { if (!nodeIds.has(n)) err(`${pid}: neverDispatch ${n} is not a node`); });
  (sc.undeclared || []).forEach((t) => { if (!isInd(t[0]) || !isInd(t[1])) err(`${pid}: undeclared ${JSON.stringify(t)} has a bad node`); });
  (sc.outage || []).forEach((o) => {
    if (!chIds.has(o.channel)) err(`${pid}: outage channel ${o.channel} unknown (use ch_opus/ch_sonnet/ch_haiku/ch_fable, ch_tool_<name>, or a channel you declared)`);
    at(o.at, 'outage.at'); at(o.dur, 'outage.dur');
  });
  (sc.versionChanges || []).forEach((v) => { at(v.at, 'versionChanges.at'); if (!v.note) err(`${pid}: versionChanges needs a note`); });

  // decisions
  Object.keys(c.decisions || {}).forEach((k) => {
    if (!isInd(k)) err(`${pid}: decisions.${k} is not a node`);
    (c.decisions[k] || []).forEach((d, i) => {
      if (!d.title || !d.choice) err(`${pid}: decisions.${k}[${i}] needs title and choice`);
      if (d.action && !['deliver', 'request', 'yield', 'escalate', 'tool'].includes(d.action)) err(`${pid}: decisions.${k}[${i}].action invalid`);
    });
  });

  console.log(`${pid}: ${p.nodes.length} nodes, ${(c.groups || []).length} groups, ${stageIds.size} stages, ${gateIds.size} gates, ${caseIds.size} cases`);
});

warns.forEach((w) => console.log('WARN  ' + w));
errors.forEach((e) => console.log('ERROR ' + e));
console.log(errors.length ? `FAILED: ${errors.length} error(s)` : 'OK');
process.exit(errors.length ? 1 : 0);
