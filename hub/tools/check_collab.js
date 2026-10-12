#!/usr/bin/env node
/**
 * check_collab.js - the collaboration-trajectory view (协作轨迹图) for every case: the data js/core/collab.js gives
 * the page, under the three comparisons, the three granularities and several time cuts.
 * Real trajectories (cases_imported/<id>/traces): the records are the source's turns in order; only handoffs with
 * a recorded or protocol basis are drawn, as many as the facts have; both ends of a handoff are records of its
 * sender and receiver; members not in the record are marked; adjacency never becomes a line.
 * Presets (simulated facts): the definition only, no records.
 * Runs without the record level (sessions of this machine are like that): one record a run. No such data is at hand
 * here, so a few presets stand in with their simulated mark taken off; that only proves the path, not a drawing.
 * Usage: node hub/tools/check_collab.js [--all] [caseId|prefix ...]   (--all adds the recorded traces of the shelved reference corpus)
 */
const fs = require('fs');
const path = require('path');
const { createContext, loadScripts, fsFetch, findCases, HUB_DIR } = require('./load.js');

const ctx = loadScripts(createContext(), ['data/base.js', 'data/zh.js',
  'js/core/util.js', 'js/core/store.js', 'js/sources/casedef.js', 'js/sources/sim.js', 'js/core/analysis.js', 'js/core/model.js', 'js/core/views.js',
  'js/sources/from-traces.js', 'js/sources/from-docs.js', 'js/core/collab.js']);
const HUB = ctx.HUB;
const fetchFn = fsFetch;
const only = process.argv.slice(2).filter((s) => !s.startsWith('-'));
// the recorded-trace cases live in the shelved reference corpus (not shipped): they are only checked with --all
const refRoot = path.join(HUB_DIR, 'cases', '_reference');
const traceCases = process.argv.includes('--all') && fs.existsSync(refRoot)
  ? findCases(refRoot, { shelved: true }).filter((c) => fs.existsSync(path.join(c.dir, 'traces', 'index.json'))) : [];
const dirOf = new Map(traceCases.map((c) => [c.id, 'hub/' + path.relative(HUB_DIR, c.dir).split(path.sep).join('/')]));
const traceIds = traceCases.map((c) => c.id)
  .filter((d) => HUB.fromTraces.readers.some((r) => r.match(d)))
  .filter((d) => !only.length || only.some((o) => d === o || d.startsWith(o)));
const presetIds = Object.keys(HUB.base.presets).filter((d) => !only.length || only.some((o) => d === o || d.startsWith(o)));

const fin = (v) => Number.isFinite(v);
function geometry(st, tag, errs) {
  st.nodes.forEach((n) => { if (![n.x, n.y, n.r].every(fin)) errs.push(tag + ' node ' + n.key + ' NaN'); });
  st.nodes.forEach((n) => { if (n.x < 0 || n.x > 1000 || n.y < 0 || n.y > 600) errs.push(tag + ' node ' + n.key + ' outside the box'); });
  if (st.shape !== 'table' && st.shape !== 'graph') errs.push(tag + ' layout without a shape');
  const keys = new Set(st.nodes.map((n) => n.key));
  if (new Set(st.nodes.map((n) => Math.round(n.x) + ',' + Math.round(n.y))).size !== st.nodes.length) errs.push(tag + ' two nodes at the same place');
  st.rails.forEach((r) => { if (st.cmpMode !== 'fact' && (!keys.has(r.from) || !keys.has(r.to))) errs.push(tag + ' task line end not drawn ' + r.key); });
  if (st.cmpMode === 'def') return;   // the definition alone: records and handoffs are not drawn
  st.pairs.forEach((p) => { if (!keys.has(p.from) || !keys.has(p.to)) errs.push(tag + ' handoff end not drawn ' + p.key); });
  st.recs.forEach((r) => { if (!keys.has(r.node)) errs.push(tag + ' record ' + r.seq + ' of a node that is not drawn'); });
  if (st.chan && !keys.has(st.chan.owner)) errs.push(tag + ' tool channel without its owner');
}

(async () => {
  let failures = 0;
  const tot = { cases: 0, instances: 0, records: 0, explicit: 0, protocol: 0, orderOnly: 0, level: {}, ms: 0, tools: 0, evals: 0 };
  for (const id of traceIds) {
    const errs = [];
    let m;
    try { m = await HUB.fromDocs.loadCase(fetchFn, dirOf.get(id), id); } catch (e) { console.log('FAIL ' + id + ' load threw ' + e.message); failures++; continue; }
    m.rev = 0;
    m.idx = HUB.analysis.buildIdx(m.def, m.facts);
    HUB.store.init({ caseId: id });
    HUB.util.setClock(m.clock);
    HUB.util.setCompare(HUB.analysis.comparability(m));
    const base = HUB.store.get();
    const f = m.facts;
    const src = HUB.collab.source(m);
    if (src.kind !== 'turns') errs.push('a real trajectory without the record level: ' + src.kind);
    const level = HUB.analysis.comparability(m).level;
    tot.level[level] = (tot.level[level] || 0) + 1;
    tot.cases++;
    const t0 = Date.now();
    // every instance when there are few, a spread of them when there are many
    const insts = f.cases.length <= 6 ? f.cases : [0, 1, Math.floor(f.cases.length / 2), f.cases.length - 1].map((i) => f.cases[i]);
    for (const k of insts) {
      const turns = (f.turns || []).filter((t) => t.caseId === k.id);
      const hands = f.handoffs.filter((h) => h.caseId === k.id);
      for (const cmp of ['both', 'fact', 'def']) for (const depth of [1, 2, 3]) {
        const s = Object.assign({}, base, { subject: 'collab', compare: cmp, depth: { org: depth, process: 1, exec: 1 }, focus: { type: 'case', id: k.id }, instanceId: k.id, time: null });
        const tag = k.id + ' ' + cmp + ' d' + depth;
        let out;
        try { out = HUB.collab.build(m, s); } catch (e) { errs.push(tag + ' threw ' + e.message); continue; }
        const st = out.st;
        geometry(st, tag, errs);
        if (st.N !== turns.length) errs.push(tag + ' records ' + st.N + ' != turns ' + turns.length);
        if (st.recs.some((r, i) => r.seq !== i + 1)) errs.push(tag + ' record seq not 1..n');
        if (out.cursor !== st.N) errs.push(tag + ' cursor not at the end with no time cut');
        const drawn = st.hands.length + st.counts.internal;
        if (drawn !== hands.length) errs.push(tag + ' handoffs drawn+inside ' + drawn + ' != facts ' + hands.length);
        if (st.hands.some((h) => h.basis !== 'explicit' && h.basis !== 'protocol')) errs.push(tag + ' a line without a recorded or protocol basis');
        if (st.counts.undrawn) errs.push(tag + ' handoffs left without a basis: ' + st.counts.undrawn);
        st.hands.forEach((h) => {
          const a = st.recs[h.sent - 1], b = h.got == null ? null : st.recs[h.got - 1];
          if (!a || a.node !== h.from) errs.push(tag + ' ' + h.id + ' not sent from a record of its sender');
          if (h.got != null && (!b || b.node !== h.to || h.got < h.sent)) errs.push(tag + ' ' + h.id + ' not received at a later record of its receiver');
        });
        // the definition alone shows the members of the definition, never an individual that only the record has
        if (cmp === 'def' && depth === 3 && st.nodes.some((n) => n.factOnly)) errs.push(tag + ' an individual outside the definition under "def"');
        // under "both" every agent of the definition is on the chart, in the record or not
        if (cmp === 'both' && depth === 3) m.def.individuals.forEach((x) => { if (x.kind === 'agent' && !x.factOnly && !st.nodeByKey['i:' + x.id]) errs.push(tag + ' defined agent ' + x.id + ' missing'); });
        if (depth === 3) {
          const exp = hands.filter((h) => h.basis === 'explicit').length, pro = hands.filter((h) => h.basis === 'protocol').length;
          if (st.counts.explicit !== exp || st.counts.protocol !== pro) errs.push(tag + ' basis counts differ from the facts');
          // "not in this record" is said of a member with no record of its own and no handoff to or from it, and of nobody else
          st.nodes.forEach((n) => {
            const spoke = turns.some((t) => 'i:' + t.individualId === n.key), handed = hands.some((h) => 'i:' + h.from === n.key || 'i:' + h.to === n.key);
            if (n.ghost !== (!spoke && !handed)) errs.push(tag + ' ' + n.key + ' wrong not-in-record mark');
            if (n.recs !== turns.filter((t) => 'i:' + t.individualId === n.key).length) errs.push(tag + ' ' + n.key + ' wrong number of records');
          });
          if (cmp === 'fact' && st.nodes.some((n) => n.ghost)) errs.push(tag + ' a member not in the record is drawn under "fact"');
        }
        if (level === 'none' && st.hands.length) errs.push(tag + ' lines in an order-only record');
        // the evaluation points at a record of this instance, when the source says which
        st.evals.forEach((e) => { if (e.seq != null && !st.recs[e.seq - 1]) errs.push(tag + ' evaluation outside the records'); });
        Object.keys(st.captions).forEach((q) => { if (!(q >= 1 && q <= st.N)) errs.push(tag + ' caption outside the records'); });
      }
      // time cuts: the cursor walks 0..N and back to "everything"
      const s0 = Object.assign({}, base, { subject: 'collab', depth: { org: 3, process: 1, exec: 1 }, focus: { type: 'case', id: k.id }, instanceId: k.id, time: null });
      const st0 = HUB.collab.build(m, s0).st;
      [0, 1, Math.floor(st0.N / 2), st0.N - 1, st0.N].filter((n, i, a) => n >= 0 && a.indexOf(n) === i).forEach((n) => {
        const t = HUB.collab.timeOf(st0, n);
        const c = HUB.collab.build(m, Object.assign({}, s0, { time: t })).cursor;
        if (c !== Math.min(n, st0.N)) errs.push(k.id + ' cursor ' + c + ' != ' + n + ' at time ' + t);
        if (t != null) { try { HUB.model.an(Object.assign({}, s0, { time: t }), m); } catch (e) { errs.push(k.id + ' analysis threw at the cut ' + t); } }
      });
      tot.instances++; tot.records += st0.N; tot.explicit += st0.counts.explicit; tot.protocol += st0.counts.protocol; tot.orderOnly += st0.counts.orderOnly;
      tot.tools += st0.tools.length; tot.evals += st0.evals.length;
    }
    tot.ms += Date.now() - t0;
    if (errs.length) { failures++; console.log('FAIL ' + id + '\n  ' + errs.slice(0, 6).join('\n  ')); }
  }

  // presets: simulated facts are never drawn as records; the definition alone must lay out
  let presets = 0;
  for (const id of presetIds) {
    const errs = [];
    let m;
    try { m = HUB.model.select(id); } catch (e) { continue; }   // owned by the docs source in the page; skipped here
    if (!m || !m.synthetic) continue;
    HUB.store.init({ caseId: id });
    const base = HUB.store.get();
    for (const cmp of ['both', 'fact', 'def']) for (const depth of [1, 2, 3]) {
      const s = Object.assign({}, base, { subject: 'collab', compare: cmp, depth: { org: depth, process: 1, exec: 1 }, time: m.facts.span.end * 0.4 });
      const tag = 'd' + depth + ' ' + cmp;
      let out;
      try { out = HUB.collab.build(m, s); } catch (e) { errs.push(tag + ' threw ' + e.message); continue; }
      const st = out.st;
      geometry(st, tag, errs);
      if (st.src.kind !== 'none' || st.real) errs.push(tag + ' simulated facts taken as recorded');
      if (st.N || st.hands.length || st.pairs.length || st.evals.length || st.result) errs.push(tag + ' simulated facts drawn as records');
      if (!st.nodes.length) errs.push(tag + ' nothing to draw');
      if (st.nodes.some((n) => n.ghost)) errs.push(tag + ' "not in this record" on a case without a record');
    }
    presets++;
    if (errs.length) { failures++; console.log('FAIL ' + id + '\n  ' + errs.slice(0, 6).join('\n  ')); }
  }

  // runs without the record level: one record a run, handoffs between the runs around them
  let runsKind = 0;
  for (const id of presetIds.slice(0, 8)) {
    const errs = [];
    let m0;
    try { m0 = HUB.model.select(id); } catch (e) { continue; }
    if (!m0 || !m0.synthetic || !m0.facts.runs.length) continue;
    const m = Object.assign({}, m0, { id: m0.id + '#runs', synthetic: false });
    HUB.store.init({ caseId: id });
    const base = HUB.store.get();
    for (const k of m.facts.cases) for (const cmp of ['both', 'fact', 'def']) for (const depth of [1, 3]) {
      const s = Object.assign({}, base, { subject: 'collab', compare: cmp, depth: { org: depth, process: 1, exec: 1 }, focus: { type: 'case', id: k.id }, instanceId: k.id, time: null });
      const tag = k.id + ' ' + cmp + ' d' + depth;
      let out;
      try { out = HUB.collab.build(m, s); } catch (e) { errs.push(tag + ' threw ' + e.message); continue; }
      const st = out.st, runs = m.facts.runs.filter((r) => r.caseId === k.id), hands = m.facts.handoffs.filter((h) => h.caseId === k.id);
      geometry(st, tag, errs);
      if (st.src.kind !== 'runs' || !st.real) errs.push(tag + ' not read as runs');
      if (st.N !== runs.length) errs.push(tag + ' records ' + st.N + ' != runs ' + runs.length);
      if (st.recs.some((r, i) => r.seq !== i + 1 || (i && r.at < st.recs[i - 1].at))) errs.push(tag + ' runs not in order');
      if (st.hands.length + st.counts.internal !== hands.length) errs.push(tag + ' handoffs ' + (st.hands.length + st.counts.internal) + ' != facts ' + hands.length);
      st.hands.forEach((h) => { if (!(h.sent >= 1 && h.sent <= st.N) || (h.got != null && (h.got < h.sent || h.got > st.N))) errs.push(tag + ' ' + h.id + ' ends outside the records'); });
      if (out.cursor !== st.N) errs.push(tag + ' cursor not at the end');
      // runs that start at one instant cannot be cut apart: stepping on goes past the whole group, stepping back goes before it
      for (let n = 0; n <= st.N; n++) {
        const fwd = HUB.collab.build(m, Object.assign({}, s, { time: HUB.collab.timeOf(st, n) })).cursor;
        const bwd = HUB.collab.build(m, Object.assign({}, s, { time: HUB.collab.timeOf(st, n, true) })).cursor;
        const same = (a, b) => a >= 1 && b >= 1 && st.recs[a - 1].at === st.recs[b - 1].at;
        if (fwd < n || (fwd > n && !same(fwd, n + 1))) errs.push(tag + ' cut after ' + n + ' shows ' + fwd);
        if (bwd > n || (bwd < n && !same(bwd + 1, n))) errs.push(tag + ' cut back to ' + n + ' shows ' + bwd);
        if (n < st.N && HUB.collab.build(m, Object.assign({}, s, { time: HUB.collab.timeOf(st, n + 1) })).cursor <= n) errs.push(tag + ' cannot step on from ' + n);
        if (n > 0 && HUB.collab.build(m, Object.assign({}, s, { time: HUB.collab.timeOf(st, n - 1, true) })).cursor >= n && fwd === n) errs.push(tag + ' cannot step back from ' + n);
      }
    }
    runsKind++;
    if (errs.length) { failures++; console.log('FAIL ' + id + ' (as runs)\n  ' + errs.slice(0, 6).join('\n  ')); }
  }

  console.log('real trajectories: ' + tot.cases + ' cases, ' + tot.instances + ' instances checked, ' + tot.records + ' records; handoffs drawn: explicit ' + tot.explicit +
    ', protocol ' + tot.protocol + '; changes of speaker left as order only: ' + tot.orderOnly + '; tool results ' + tot.tools + '; evaluations ' + tot.evals);
  console.log('what can be compared: ' + Object.keys(tot.level).map((k) => k + ' ' + tot.level[k]).join(', ') + '; ' + Math.round(tot.ms / Math.max(1, tot.cases)) + ' ms per case');
  console.log('presets with simulated facts: ' + presets + ' (definition only)');
  console.log('runs without the record level: ' + runsKind + ' stand-ins, one record a run');
  console.log(failures ? failures + ' case(s) failed' : 'all cases passed');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
