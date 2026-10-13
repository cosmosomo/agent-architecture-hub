#!/usr/bin/env node
/**
 * check_shells.js - the acceptance check of "case documents -> what the page draws".
 * A parsed case can come out as a shell: a frame with nobody in it, a card without a face, a placeholder where a
 * number should be, a node with no line at all. This builds the scenes of every case and counts them.
 *
 *   errors (exit 1): an empty frame; a card without a name or an avatar; "undefined" / "NaN" / "[object" in a card;
 *                    no card at all in a case that has individuals
 *   warnings (counted, listed with --verbose): placeholder words in a card ("未采集", "补写的声明"); a node nothing
 *                    is connected to; an individual without a role; a case with no process or no groups
 *
 * Usage: node hub/tools/check_shells.js [--all] [--verbose] [caseId ...]
 *   --all also walks the shelved reference corpus (hub/cases/_reference); the report is then grouped by data set.
 */
const path = require('path');
const { createContext, loadScripts, pageScripts, fsFetch, findCases, HUB_DIR } = require('./load.js');

const ctx = createContext();
ctx.document = { documentElement: { getAttribute: () => null } };   // the cards read the theme from the page
loadScripts(ctx, pageScripts(['data/', 'js/core/', 'js/sources/', 'js/obs/avatar.js', 'js/obs/cards.js', 'js/obs/scene-', 'js/obs/panels.js']));
const HUB = ctx.HUB;

const only = process.argv.slice(2).filter((s) => !s.startsWith('-'));
const all = process.argv.includes('--all'), verbose = process.argv.includes('--verbose');
const PLACEHOLDERS = /未采集|补写的声明|待补|占位|TODO/;
const BAD_TEXT = /undefined|NaN|\[object|\bnull\b/;
const KINDS_WITH_FACE = new Set(['ind', 'human', 'meta']);

const groups = new Map();      // data set -> counters
const hard = [];
function bucket(name) {
  if (!groups.has(name)) groups.set(name, { cases: 0, errors: 0, empty: 0, faceless: 0, badText: 0, placeholder: 0, orphans: 0, noRole: 0, noProcess: 0, noGroups: 0, noCards: 0 });
  return groups.get(name);
}
const textOf = (html) => String(html || '').replace(/<[^>]*>/g, ' ').replace(/&[a-z]+;/g, ' ');

function checkScene(id, tag, m, sc, b, notes) {
  // 1. frames with nobody in them
  sc.frames.forEach((f) => {
    if (f.kind === 'chframe') return;
    const inside = sc.cards.some((c) => (c.anchor || []).indexOf(f.key) >= 0) || sc.frames.some((g) => g !== f && (g.anchor || []).indexOf(f.key) >= 0);
    if (!inside) { b.empty++; notes.push(tag + ' empty frame ' + f.key); }
  });
  // 2. every card has a name, a face and honest text
  sc.cards.forEach((c) => {
    let out;
    try { out = HUB.obsCards.card(c); } catch (e) { notes.push(tag + ' ' + c.key + ' threw ' + e.message); b.errors++; return; }
    const txt = textOf(out.html);
    if (BAD_TEXT.test(txt)) { b.badText++; notes.push(tag + ' ' + c.key + ' shows "' + (BAD_TEXT.exec(txt) || [''])[0] + '"'); }
    if (PLACEHOLDERS.test(txt)) { b.placeholder++; notes.push(tag + ' ' + c.key + ' placeholder ' + PLACEHOLDERS.exec(txt)[0]); }
    if (KINDS_WITH_FACE.has(c.kind)) {
      const d = c.data || {};
      const face = HUB.obsAvatar.svg(d.agentId, d.name, 20);
      if (!d.name || !String(d.name).trim() || !/<svg[\s\S]*<(path|circle|rect|ellipse|mask)/.test(face)) { b.faceless++; notes.push(tag + ' ' + c.key + ' has no name or no avatar'); }
    }
  });
  // 3. nodes nothing connects to (a person or the maintainer may stand alone)
  if (sc.links.length || sc.cards.length > 2) {
    const linked = new Set();
    sc.links.forEach((l) => { linked.add(l.from); linked.add(l.to); });
    sc.cards.forEach((c) => {
      if (c.kind === 'ind' && !linked.has(c.key) && (c.anchor || []).every((a) => !linked.has(a))) { b.orphans++; notes.push(tag + ' ' + c.key + ' has no line'); }
    });
  }
}

async function checkCase(dir, id, dataset) {
  const b = bucket(dataset);
  b.cases++;
  const notes = [];
  let m;
  try { m = await HUB.fromDocs.loadCase(fsFetch, dir, id); } catch (e) { b.errors++; hard.push(id + ': does not load - ' + e.message); return; }
  const d = m.def;
  m.rev = 0; m.idx = HUB.analysis.buildIdx(m.def, m.facts);
  HUB.store.init({ caseId: id });
  HUB.model.current = m;
  const base = HUB.store.get();
  const people = d.individuals.filter((x) => x.kind === 'agent');
  d.individuals.forEach((x) => { if (x.kind === 'agent' && !String(x.role || '').trim()) b.noRole++; });
  if (!d.process.stages.length) b.noProcess++;
  if (!d.groups.length) b.noGroups++;

  const states = [
    ['org d1', { subject: 'org', depth: { org: 1, process: 1, exec: 1 } }],
    ['org d2', { subject: 'org', depth: { org: 2, process: 1, exec: 1 } }],
    ['org d3', { subject: 'org', depth: { org: 3, process: 1, exec: 1 }, lines: { task: true, info: true, watch: true, channel: false } }],
    ['process d2', { subject: 'process', depth: { org: 1, process: 2, exec: 1 } }]
  ];
  let drawn = 0;
  for (const [tag, patch] of states) {
    const s = Object.assign({}, base, patch);
    try {
      const a = HUB.model.an(s, m);
      const sc = s.subject === 'org' ? HUB.obsSceneOrg.build(m, s, a, { w: 1300, h: 760 }) : HUB.obsSceneProcess.build(m, s, a, { w: 1300, h: 760 });
      drawn += sc.cards.length;
      checkScene(id, tag, m, sc, b, notes);
    } catch (e) { b.errors++; notes.push(tag + ' threw ' + String(e.stack).split('\n').slice(0, 2).join(' | ')); }
  }
  if (people.length && !drawn) { b.noCards++; notes.push('nothing is drawn although there are ' + people.length + ' agents'); }

  const bad = notes.filter((n) => /empty frame|has no name|shows "|threw|nothing is drawn/.test(n));
  if (bad.length) { b.errors += bad.length; hard.push(id + ': ' + bad.slice(0, 3).join('; ') + (bad.length > 3 ? ' (+' + (bad.length - 3) + ')' : '')); }
  if (verbose && notes.length) console.log(id + '\n  ' + notes.slice(0, 12).join('\n  '));
}

(async () => {
  const found = findCases(path.join(HUB_DIR, 'cases'), { shelved: all });
  for (const c of found) {
    if (only.length && !only.some((o) => c.id === o || c.id.startsWith(o))) continue;
    const rel = path.relative(path.join(HUB_DIR, 'cases'), c.dir).split(path.sep);
    const dataset = rel[0] === '_reference' ? 'reference/' + (rel[1] || '') : 'cases';
    await checkCase('hub/' + path.relative(HUB_DIR, c.dir).split(path.sep).join('/'), c.id, dataset);
  }
  const cols = ['cases', 'errors', 'empty', 'faceless', 'badText', 'noCards', 'placeholder', 'orphans', 'noRole', 'noProcess', 'noGroups'];
  console.log(['data set'.padEnd(26)].concat(cols.map((c) => c.padStart(12))).join(''));
  const total = Object.fromEntries(cols.map((c) => [c, 0]));
  Array.from(groups.keys()).sort().forEach((k) => {
    const g = groups.get(k);
    cols.forEach((c) => { total[c] += g[c]; });
    console.log(k.padEnd(26) + cols.map((c) => String(g[c]).padStart(12)).join(''));
  });
  console.log('total'.padEnd(26) + cols.map((c) => String(total[c]).padStart(12)).join(''));
  hard.slice(0, 40).forEach((h) => console.log('  ERROR: ' + h));
  if (hard.length > 40) console.log('  ... ' + (hard.length - 40) + ' more');
  if (hard.length) { console.log('FAILED: ' + hard.length + ' case(s) draw shells or fail to load'); process.exit(1); }
  console.log('OK: no empty frames, faceless cards or broken text in ' + total.cases + ' cases (warnings: ' + (total.placeholder + total.orphans) + ' placeholders/orphans, ' + total.noRole + ' agents without a role)');
})().catch((e) => { console.error(e); process.exit(1); });
