#!/usr/bin/env node
/**
 * test_org.js - runs the org view layout (views ①②③) for every preset and checks it.
 * Usage: node hub/tools/test_org.js [presetId]
 */
const fs = require('fs');
const path = require('path');
const { createContext, loadScripts, HUB_DIR } = require('./load.js');

const caseFiles = fs.readdirSync(path.join(HUB_DIR, 'data', 'cases')).filter((f) => f.endsWith('.js')).map((f) => 'data/cases/' + f);
const ctx = loadScripts(createContext(), ['data/base.js', 'data/zh.js', ...caseFiles,
  'js/core/util.js', 'js/core/store.js', 'js/core/casedef.js', 'js/core/sim.js', 'js/core/analysis.js', 'js/core/model.js', 'js/core/views.js',
  'js/render/svg.js', 'js/views/org.js']);
const HUB = ctx.HUB;
const only = process.argv[2];
const ids = only ? [only] : Object.keys(HUB.base.presets);
let failures = 0;

const overlap = (p, q) => Math.abs(p.x - q.x) * 2 < p.w + q.w - 0.5 && Math.abs(p.y - q.y) * 2 < p.h + q.h - 0.5;

ids.forEach((id) => {
  const errs = [];
  const m = HUB.model.select(id);
  HUB.store.init({ caseId: id });
  const base = HUB.store.get();
  const variants = [];
  [1, 2, 3].forEach((d) => ['both', 'fact', 'def'].forEach((cmp) => [false, true].forEach((ch) => {
    variants.push(Object.assign({}, base, { depth: { org: d, process: 1, exec: 1 }, compare: cmp,
      lines: { task: true, info: true, watch: true, channel: ch }, overlays: { human: true, channels: ch, delivery: true, lanes: true } }));
  })));
  const c0 = m.facts.cases[0];
  if (c0) variants.push(Object.assign({}, base, { depth: { org: 2, process: 1, exec: 1 }, focus: { type: 'case', id: c0.id } }));
  variants.push(Object.assign({}, base, { depth: { org: 2, process: 1, exec: 1 }, time: m.facts.span.end * 0.4 }));
  let t = 0, maxNodes = 0, maxEdges = 0;
  variants.forEach((s, vi) => {
    const tag = `#${vi} d${s.depth.org} ${s.compare}${s.overlays.channels ? ' ch' : ''}${s.focus ? ' focus' : ''}${s.time != null ? ' cut' : ''}`;
    let lay;
    try {
      const t0 = Date.now();
      const a = HUB.model.an(s, m);
      lay = HUB.orgView._layout(m, s, a);
      t = Math.max(t, Date.now() - t0);
    } catch (ex) { errs.push(`${tag} threw ${ex.stack.split('\n').slice(0, 3).join(' | ')}`); return; }
    maxNodes = Math.max(maxNodes, lay.nodes.size);
    maxEdges = Math.max(maxEdges, lay.edges.length);
    const nodes = [...lay.nodes.values()];
    nodes.forEach((n) => { if (![n.x, n.y, n.w, n.h].every(Number.isFinite)) errs.push(`${tag} ${n.key} has NaN`); });
    lay.edges.forEach((e) => { if (!lay.nodes.has(e.from) || !lay.nodes.has(e.to)) errs.push(`${tag} edge ${e.key} has a missing end`); });
    for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
      if (overlap(nodes[i], nodes[j])) errs.push(`${tag} ${nodes[i].key} overlaps ${nodes[j].key}`);
    }
    // every visible individual inside its innermost drawn box
    nodes.filter((n) => n.key.startsWith('i:')).forEach((n) => {
      const x = m.idx.ind.get(n.id);
      if (!x.groupId) return;
      const b = lay.boxes.get('b:' + x.groupId) || lay.boxes.get('b:' + m.idx.topGroupOf(x.groupId));
      if (!b) { errs.push(`${tag} ${n.key} shown but no box`); return; }
      if (n.x - n.w / 2 < b.x - 0.5 || n.x + n.w / 2 > b.x + b.w + 0.5 || n.y - n.h / 2 < b.y - 0.5 || n.y + n.h / 2 > b.y + b.h + 0.5) errs.push(`${tag} ${n.key} outside ${b.key}`);
    });
    // folded departments: every agent is represented
    if (s.compare !== 'fact') m.def.individuals.filter((x) => x.kind === 'agent').forEach((x) => { if (!lay.repPos[x.id]) errs.push(`${tag} ${x.id} has no representative`); });
    if (s.depth.org === 1 && s.compare === 'both' && nodes.some((n) => n.key.startsWith('i:n'))) errs.push(`${tag} depth 1 still shows agents`);
    const bb = lay.bbox;
    nodes.forEach((n) => { if (n.x - n.w / 2 < bb.x - 1 || n.x + n.w / 2 > bb.x + bb.w + 1) errs.push(`${tag} ${n.key} outside bbox`); });
  });
  if (errs.length) { failures += 1; console.log(`FAIL ${id}\n  ` + errs.slice(0, 8).join('\n  ') + (errs.length > 8 ? `\n  ... ${errs.length - 8} more` : '')); }
  else console.log(`ok   ${id.padEnd(26)} nodes<=${String(maxNodes).padStart(3)} edges<=${String(maxEdges).padStart(3)} ${t}ms`);
});
console.log(failures ? `${failures} preset(s) failed` : 'all presets passed');
process.exit(failures ? 1 : 0);
