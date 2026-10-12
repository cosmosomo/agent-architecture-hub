#!/usr/bin/env node
/**
 * test_scenes.js - builds the observation scenes (org, process) for every preset and checks them:
 * finite geometry, links between drawn things, no two cards on top of each other, members inside their frames.
 * A run's detail is the trace view now; trace/packages/contract/test/hub-export.test.ts checks what it gets.
 * Usage: node hub/tools/test_scenes.js [presetId]
 */
const { createContext, loadScripts, pageScripts } = require('./load.js');

const ctx = loadScripts(createContext(), pageScripts(['data/', 'js/core/', 'js/sources/', 'js/obs/avatar.js', 'js/obs/cards.js', 'js/obs/scene-', 'js/obs/panels.js', 'js/obs/drag.js']));
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
  states.push(['org cut', Object.assign({}, base, { subject: 'org', depth: { org: 3, process: 1, exec: 1 }, time: m.facts.span.end * 0.35 })]);

  states.forEach(([tag, s]) => {
    let sc;
    try {
      const a = HUB.model.an(s, m);
      sc = s.subject === 'org' ? HUB.obsSceneOrg.build(m, s, a, { w: 1300, h: 760 }) : HUB.obsSceneProcess.build(m, s, a, { w: 1300, h: 760 });
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
// a hand-made move lies on top of the layout: the card and what sits in its frame move, nothing else does, the box stays
(function () {
  const id = 'security', m = HUB.model.select(id);
  HUB.store.init({ caseId: id });
  const s = Object.assign({}, HUB.store.get(), { subject: 'org', depth: { org: 3, process: 1, exec: 1 } });
  const sc = HUB.obsSceneOrg.build(m, s, HUB.model.an(s, m), { w: 1300, h: 760 });
  const frame = sc.frames.find((f) => f.kind === 'frame');
  const inside = sc.cards.filter((c) => (c.anchor || []).includes(frame.key));
  const outside = sc.cards.filter((c) => !(c.anchor || []).includes(frame.key) && c.key !== frame.key);
  HUB.obsDrag.put(id, 'org', frame.key, 40, 25);
  HUB.obsDrag.put(id, 'org', inside[0].key, 10, 0);
  const moved = HUB.obsDrag.apply(sc, id, 'org');
  const at = (o, k) => (o.cards.concat(o.frames)).find((x) => x.key === k);
  const errs = [];
  if (at(moved, frame.key).x !== frame.x + 40 || at(moved, frame.key).y !== frame.y + 25) errs.push('the frame did not move by its offset');
  inside.forEach((c, i) => { const want = c.x + 40 + (i === 0 ? 10 : 0); if (at(moved, c.key).x !== want) errs.push(c.key + ' did not follow its frame'); });
  outside.forEach((c) => { if (at(moved, c.key).x !== c.x || at(moved, c.key).y !== c.y) errs.push(c.key + ' moved but is not in the frame'); });
  if (moved.bbox !== sc.bbox) errs.push('a move changed the box the camera frames');
  if (at(sc, frame.key).x !== frame.x) errs.push('apply changed the scene it was given');
  HUB.obsDrag.put(id, 'org', frame.key, 0, 0); HUB.obsDrag.reset();
  if (HUB.obsDrag.count(id, 'org')) errs.push('reset left moves behind');
  if (errs.length) { failures += 1; console.log('FAIL drag\n  ' + errs.join('\n  ')); } else console.log('ok   drag');
})();
console.log(failures ? failures + ' preset(s) failed' : 'all presets passed');
process.exit(failures ? 1 : 0);
