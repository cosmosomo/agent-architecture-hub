#!/usr/bin/env node
/**
 * check_from_docs.js - parses every hub/cases/<id>/ Markdown case through from-docs
 * and checks the assembled model against SPEC.md §18.6: steps parsed, task lines
 * inferred, watch lines deduped, scenarios reaching the sim facts (cases/runs/
 * decisions), decisions keeping their alternatives.
 * Usage: node hub/tools/check_from_docs.js [--all] [caseId ...]   (--all also walks the shelved reference corpus)
 * Exit code 1 when there are errors. Warnings do not fail.
 */
const path = require('path');
const { createContext, loadScripts, pageScripts, fsFetch, findCases, HUB_DIR } = require('./load.js');

const ctx = loadScripts(createContext(), pageScripts(['data/', 'js/core/', 'js/sources/']));
const HUB = ctx.HUB;

const errors = [], warns = [];
const err = (m) => errors.push(m), warn = (m) => warns.push(m);

const fs = require('fs');
const fetchFn = fsFetch;

// 可选 argv 过滤：node check_from_docs.js [caseId ...] 只校验指定的案例；--all 连收起来的参考语料一起查
const only = process.argv.slice(2).filter((s) => !s.startsWith('-'));
const all = process.argv.includes('--all');

async function checkCase(dir, id) {
  const m = await HUB.fromDocs.loadCase(fetchFn, dir, id);

  const d = m.def, f = m.facts;
  const tag = `${id}:`;
  if (!d.individuals.length) err(`${tag} no individuals`);
  if (!d.individuals.some((x) => x.id === 'human')) err(`${tag} missing fixed human node`);
  if (!d.individuals.some((x) => x.id === 'meta_maint')) err(`${tag} missing meta_maint`);
  const steps = d.process.stages.reduce((n, s) => n + s.steps.length, 0);
  if (!steps) err(`${tag} process stages have no steps (executors lost)`);
  if (!d.process.flows.length) err(`${tag} process has no flows`);
  const task = d.relations.filter((r) => r.type === 'task').length;
  if (!task) err(`${tag} no task lines inferred from stages`);
  const seen = new Set();
  d.relations.filter((r) => r.type === 'watch').forEach((r) => {
    const k = r.from + '>' + r.to;
    if (seen.has(k)) err(`${tag} duplicate watch line ${k} (watches double-written)`);
    seen.add(k);
  });
  if (!d.channels.length) err(`${tag} no model channels built`);
  d.channels.forEach((c) => {
    if (!/^ch_(opus|sonnet|haiku|fable)$/.test(c.id)) warn(`${tag} non-standard channel id ${c.id}`);
  });
  if (!f.cases.length) err(`${tag} facts.cases empty (scenarios not wired)`);
  if (!f.runs.length) err(`${tag} facts.runs empty`);
  if (!f.decisions.length) err(`${tag} facts.decisions empty`);
  const withAlt = f.decisions.filter((x) => x.alternatives && x.alternatives.length).length;
  if (!withAlt) err(`${tag} no decision kept its alternatives (multi-line lists lost)`);
  if (!f.versionEvents.length) warn(`${tag} no version events`);
  if (!f.gateEvents.length) warn(`${tag} no gate events (no case walked a gate)`);

  console.log(
    `${id.padEnd(22)} ind ${String(d.individuals.length).padStart(2)}  groups ${String(d.groups.length).padStart(2)}  ` +
    `steps ${String(steps).padStart(2)}  task ${String(task).padStart(2)}  watch ${String(seen.size).padStart(2)}  ` +
    `cases ${String(f.cases.length).padStart(2)}  runs ${String(f.runs.length).padStart(3)}  ` +
    `calls ${String(f.calls.length).padStart(3)}  decisions ${String(f.decisions.length).padStart(2)}(${withAlt}含候选)  ` +
    `gateEv ${f.gateEvents.length}`
  );
}

(async () => {
  let total = 0;
  const found = findCases(path.join(HUB_DIR, 'cases'), { shelved: all });
  if (!found.length) err('hub/cases: no cases found');
  for (const c of found) {
    if (only.length && !only.includes(c.id)) continue;
    total++;
    await checkCase('hub/' + path.relative(HUB_DIR, c.dir).split(path.sep).join('/'), c.id);
  }

  warns.forEach((w) => console.log('  warn: ' + w));
  errors.forEach((e) => console.log('  ERROR: ' + e));
  if (errors.length) { console.log(`FAILED: ${errors.length} errors`); process.exit(1); }
  console.log(`OK: ${total} docs cases`);
})().catch((e) => { console.error(e); process.exit(1); });
