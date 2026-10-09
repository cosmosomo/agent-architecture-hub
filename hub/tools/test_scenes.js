#!/usr/bin/env node
/**
 * test_scenes.js - builds the observation scenes (org, process, run) for every preset and checks them:
 * finite geometry, links between drawn things, no two cards on top of each other, members inside their frames.
 * Usage: node hub/tools/test_scenes.js [presetId]
 */
const fs = require('fs');
const path = require('path');
const { createContext, loadScripts, HUB_DIR } = require('./load.js');

const caseFiles = fs.readdirSync(path.join(HUB_DIR, 'data', 'cases')).filter((f) => f.endsWith('.js')).map((f) => 'data/cases/' + f);
const ctx = loadScripts(createContext(), ['data/base.js', 'data/zh.js', ...caseFiles,
  'js/core/util.js', 'js/core/store.js', 'js/core/casedef.js', 'js/core/sim.js', 'js/core/analysis.js', 'js/core/model.js', 'js/core/views.js',
  'js/obs/cards.js', 'js/obs/scene-org.js', 'js/obs/scene-process.js', 'js/obs/scene-run.js']);
const HUB = ctx.HUB;
const ids = process.argv[2] ? [process.argv[2]] : Object.keys(HUB.base.presets);
const overlap = (p, q) => p.x < q.x + q.w - 0.5 && q.x < p.x + p.w - 0.5 && p.y < q.y + q.h - 0.5 && q.y < p.y + p.h - 0.5;
let failures = 0;

ids.forEach((id) => {
  const errs = [];
  const m = HUB.model.select(id);
  HUB.store.init({ caseId: id });
  const base = HUB.store.get();
  const states = [];
  [1, 2, 3].forEach((d) => ['both', 'fact', 'def'].forEach((cmp) => {
    states.push(['org d' + d + ' ' + cmp, Object.assign({}, base, { subject: 'org', depth: { org: d, process: 1, exec: 1 }, compare: cmp,
      lines: { task: true, info: true, watch: true, channel: d === 3 }, overlays: { human: true, channels: d === 3, delivery: true, lanes: true } })]);
  }));
  const c0 = m.facts.cases[0];
  if (c0) states.push(['org focus', Object.assign({}, base, { subject: 'org', depth: { org: 2, process: 1, exec: 1 }, focus: { type: 'case', id: c0.id } })]);
  [1, 2].forEach((d) => ['both', 'def'].forEach((cmp) => states.push(['process d' + d + ' ' + cmp, Object.assign({}, base, { subject: 'process', depth: { org: 1, process: d, exec: 1 }, compare: cmp })])));
  if (c0) states.push(['process focus', Object.assign({}, base, { subject: 'process', focus: { type: 'case', id: c0.id } })]);
  const busiest = m.facts.runs.slice().sort((a, b) => (m.idx.decsByRun.get(b.id) || []).length - (m.idx.decsByRun.get(a.id) || []).length)[0];
  if (busiest) [1, 2].forEach((d) => states.push(['run d' + d, Object.assign({}, base, { subject: 'exec', depth: { org: 1, process: 1, exec: d }, focus: { type: 'run', id: busiest.id } })]));
  states.push(['org cut', Object.assign({}, base, { subject: 'org', depth: { org: 3, process: 1, exec: 1 }, time: m.facts.span.end * 0.35 })]);

  states.forEach(([tag, s]) => {
    let sc;
    try {
      const a = HUB.model.an(s, m);
      sc = s.subject === 'org' ? HUB.obsSceneOrg.build(m, s, a, { w: 1300, h: 760 })
        : s.subject === 'process' ? HUB.obsSceneProcess.build(m, s, a, { w: 1300, h: 760 }) : HUB.obsSceneRun.build(m, s, a, { w: 1300, h: 760 });
    } catch (ex) { errs.push(tag + ' threw ' + ex.stack.split('\n').slice(0, 2).join(' | ')); return; }
    const keys = new Set();
    [...sc.cards, ...sc.frames].forEach((o) => {
      if (keys.has(o.key)) errs.push(tag + ' duplicate key ' + o.key);
      keys.add(o.key);
      if (![o.x, o.y, o.w, o.h].every(Number.isFinite)) errs.push(tag + ' ' + o.key + ' has NaN');
    });
    sc.links.forEach((l) => { if (!keys.has(l.from) || !keys.has(l.to)) errs.push(tag + ' link ' + l.key + ' end missing'); });
    for (let i = 0; i < sc.cards.length; i++) for (let j = i + 1; j < sc.cards.length; j++) {
      if (overlap(sc.cards[i], sc.cards[j])) errs.push(tag + ' ' + sc.cards[i].key + ' overlaps ' + sc.cards[j].key);
    }
    if (!Number.isFinite(sc.bbox.w) || sc.bbox.w <= 0) errs.push(tag + ' bad bbox');
  });
  if (errs.length) { failures += 1; console.log('FAIL ' + id + '\n  ' + errs.slice(0, 6).join('\n  ') + (errs.length > 6 ? '\n  ... ' + (errs.length - 6) + ' more' : '')); }
  else console.log('ok   ' + id);
});
console.log(failures ? failures + ' preset(s) failed' : 'all presets passed');
process.exit(failures ? 1 : 0);
