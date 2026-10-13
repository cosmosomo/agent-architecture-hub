#!/usr/bin/env node
/**
 * check_from_docs.js - parses every hub/cases/<id>/ Markdown case through from-docs
 * and checks the assembled model against the format in docs/hub-graph-format.md: steps parsed, task lines
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

// session annotations: an individual's document may name the local sessions it ran as
async function checkSessionAnnotations() {
  const files = {
    'meta.md': '---\nhub: "1.0"\nkind: meta\ncase: ann\nsession: codex:root-1\n---\n\n# Annotated\n\nA case whose agents name their sessions.\n',
    'decisions/one.md': '---\nhub: "1.0"\nkind: decisions\ncase: ann\n---\n\n' +
      '# @d1 [decision]\ntitle: Read first\ntrigger: a task arrived\nalternatives: [just do it, read first]\nchoice: read first\nreason: avoids rework\naction: tool\nturn: 1\nsteps: 1-2\n\n' +
      '# @d2 [decision]\ntitle: Out of range\nturn: 9\nsteps: 1\n\n' +
      '# @d3 [decision]\ntitle: Overlaps d1\nturn: 1\nsteps: 2-3\n\n' +
      '# @d4 [decision]\ntitle: Not consecutive\nturn: 1\nsteps: [4, 6]\n\n' +
      '# @d5 [decision]\ntitle: Fine\nturn: 1\nsteps: 5\n\n' +
      '# @d6 [decision]\ntitle: A plain simulated decision\ntrigger: x\n',
    'agents.md': '---\nhub: "1.0"\nkind: agents\ncase: ann\n---\n\n' +
      '# @one [individual] #phase/build\nname: One\nsession: codex:019a-b\n\n' +
      '# @two [individual] #phase/qa\nname: Two\nsessions: [claude-code:x1, opencode:ses_2, claude-code:x1, not a session]\n\n' +
      '# @three [individual] #phase/qa\nname: Three\nsession: nonsense\n'
  };
  const serve = (p) => {
    const rel = p.replace(/^virtual\/ann\//, '');
    if (rel === '') return '<a href="decisions/">decisions/</a>';
    if (rel === 'decisions/') return '<a href="one.md">one.md</a>';
    return files[rel] || '';
  };
  const m = await HUB.fromDocs.loadCase((p) => Promise.resolve(serve(p)), 'virtual/ann', 'ann');
  const by = Object.fromEntries(m.def.individuals.map((x) => [x.id, x]));
  if (JSON.stringify(by.one.sessions) !== '["codex:019a-b"]' || by.one.session !== 'codex:019a-b') err('ann: session: not read');
  if (JSON.stringify(by.two.sessions) !== '["claude-code:x1","opencode:ses_2"]') err('ann: sessions: [...] not read as a deduplicated list of ids (' + JSON.stringify(by.two.sessions) + ')');
  if (by.three.sessions.length || by.three.session !== null) err('ann: something that is not a session id was taken for one');
  // the diary: records that point into the root session become the coarse layer of that session, the rest are reported
  if (m.rootSession !== 'codex:root-1') err('ann: the root session was not read');
  if (m.annotations.length !== 5) err('ann: ' + m.annotations.length + ' records point into a session, expected 5');
  if (m.annotations.some((a) => a.session !== 'codex:root-1')) err('ann: a record did not default to the root session');
  const steps = (n) => Array.from({ length: n }, (_, i) => ({ id: 's' + (i + 1) }));
  const session = { id: 'codex:root-1', startedAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T01:00:00Z', turns: [{ id: 't1', index: 1, steps: steps(6) }] };
  const layer = HUB.annotate.layerFor(m, session);
  if (!layer || layer.segments.map((g) => g.id).join() !== 'doc:d1,doc:d5') err('ann: wrong segments ' + (layer && layer.segments.map((g) => g.id)));
  else if (JSON.stringify(layer.segments[0].steps) !== '["s1","s2"]' || layer.segments[0].choice !== 'read first') err('ann: segment content lost');
  if (!layer || layer.problems.length !== 3 || layer.total !== 5) err('ann: expected 3 problems of 5, got ' + (layer && layer.problems.length) + ' of ' + (layer && layer.total));
  if (m.facts.decisions.some((d) => /Read first|Out of range/.test(d.title))) err('ann: a recorded decision leaked into the simulated run');
  if (HUB.annotate.layerFor(m, { id: 'other:1', turns: [] }) !== null) err('ann: a layer for a session nothing points at');
  // without a root session nothing is accepted
  files['meta.md'] = files['meta.md'].replace('session: codex:root-1\n', '');
  const bare = await HUB.fromDocs.loadCase((p) => Promise.resolve(serve(p)), 'virtual/ann', 'ann');
  if (bare.annotations.length || !bare.annotationProblems.length) err('ann: records were accepted without a root session');
  console.log('session annotations: ok');
}

(async () => {
  await checkSessionAnnotations();
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
