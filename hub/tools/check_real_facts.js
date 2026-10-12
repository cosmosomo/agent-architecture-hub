#!/usr/bin/env node
/**
 * check_real_facts.js - every docs case whose traces/ a reader in js/core/from-traces.js knows: parse it with the
 * real facts, analyse it, and build the org and process scenes, the way the page does. Prints how much of the
 * recording landed on the written orchestration: speakers matched, handoffs on a declared task line, fact-only
 * lines, the case path laid on the declared process. Errors: a throw, empty facts, NaN geometry, a broken link.
 * Usage: node hub/tools/check_real_facts.js [caseId|prefix ...]
 */
const fs = require('fs');
const path = require('path');
const { createContext, loadScripts, HUB_DIR } = require('./load.js');

const ctx = loadScripts(createContext(), ['data/base.js', 'data/zh.js',
  'js/core/util.js', 'js/core/store.js', 'js/core/casedef.js', 'js/core/sim.js', 'js/core/analysis.js', 'js/core/model.js', 'js/core/views.js',
  'js/core/from-traces.js', 'js/core/from-docs.js', 'js/obs/cards.js', 'js/obs/scene-org.js', 'js/obs/scene-process.js', 'js/panels/panels.js']);
const HUB = ctx.HUB;
const fetchFn = (u) => {
  const p = path.join(HUB_DIR, u.replace(/^hub\//, ''));
  return Promise.resolve(fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '');
};

const only = process.argv.slice(2);
const root = path.join(HUB_DIR, 'cases_imported');
const ids = fs.readdirSync(root).filter((d) => fs.existsSync(path.join(root, d, 'traces', 'index.json')))
  .filter((d) => HUB.fromTraces.readers.some((r) => r.match(d)))
  .filter((d) => !only.length || only.some((o) => d === o || d.startsWith(o)));

// 直接比对原始文件，避免用 reader 自己的输出作为逐字保真的判据。
function records(reader, d) {
  const txt = (v) => typeof v === 'string' ? v : v == null ? '' : JSON.stringify(v);
  if (reader === 'whowhen') return d.map((x) => txt(x.content));
  if (reader === 'taubench') return d.traj.map((x) => txt(x.content));
  const out = d.specified_task ? [txt(d.specified_task)] : [];
  for (let i = 1; d['message_' + i]; i++) out.push(txt(d['message_' + i].content));
  return out;
}
function counts(handoffs) {
  return ['explicit', 'protocol', 'adjacent'].map((b) => b + '=' + handoffs.filter((h) => h.basis === b).length).join(' ');
}

(async () => {
  let failures = 0;
  const tot = { cases: 0, real: 0, episodes: 0, runs: 0, hand: 0, handDecl: 0, added: 0, steps: 0, stepsOnPath: 0, ms: 0 };
  const byReader = {};
  let tauPrinted = false;
  for (const id of ids) {
    const errs = [];
    let m;
    try { m = await HUB.fromDocs.loadCase(fetchFn, 'hub/cases_imported/' + id, id); } catch (e) { console.log('FAIL ' + id + ' load threw ' + e.message); failures++; continue; }
    tot.cases++;
    const fs0 = m.factSource || {};
    if (fs0.kind !== 'trace') { errs.push('facts stayed simulated' + (fs0.error ? ' (' + fs0.error + ')' : '')); }
    const f = m.facts;
    if (!f.runs.length || !f.cases.length) errs.push('no runs or cases');
    // 记录：每个案例实例的发言按来源顺序排成 1..n；人说的话也在序列里
    const turnsByCase = new Map();
    (f.turns || []).forEach((t) => { (turnsByCase.get(t.caseId) || turnsByCase.set(t.caseId, []).get(t.caseId)).push(t); });
    if (!Array.isArray(f.turns) || !f.turns.length) errs.push('no recorded turns (facts.turns)');
    f.cases.forEach((k) => {
      const ts = turnsByCase.get(k.id) || [];
      if (!ts.length) errs.push(k.id + ' has no turns');
      if (ts.some((t, i) => t.seq !== i + 1)) errs.push(k.id + ' turn seq not 1..n');
      if (ts.some((t) => !m.def.individuals.some((x) => x.id === t.individualId))) errs.push(k.id + ' turn of an unknown individual');
    });
    f.handoffs.forEach((h) => {
      // 用户 10-12 决定：只凭相邻发言的换人一律不生成交接，补写的编排里有没有这条任务线都一样
      if (!['explicit', 'protocol'].includes(h.basis)) errs.push(h.id + ' handoff without a recorded or protocol basis (' + h.basis + ')');
      const ts = turnsByCase.get(h.caseId) || [];
      const sent = ts[h.sentSeq - 1], got = h.gotSeq == null ? null : ts[h.gotSeq - 1];
      if (!sent || sent.individualId !== h.from) errs.push(h.id + ' is not sent from a turn of ' + h.from);
      if (h.gotSeq != null && (!got || got.individualId !== h.to || h.gotSeq <= h.sentSeq)) errs.push(h.id + ' is not received at a later turn of ' + h.to);
      if (h.basis === 'protocol' && h.gotSeq == null) errs.push(h.id + ' protocol handoff without a receiving turn');
    });
    f.runs.forEach((r) => {
      if (r.outcome === 'failed') errs.push(r.id + ' annotation became execution failure');
      if (r.tokens !== null) errs.push(r.id + ' tokens not null');
      if (r.coverage.truncated !== 0) errs.push(r.id + ' body truncated');
    });
    f.calls.forEach((c) => {
      if (c.status === 'error') errs.push(c.id + ' annotation became call error');
      if (c.tokensIn !== null || c.tokensOut !== null) errs.push(c.id + ' call tokens not null');
    });
    if (fs0.kind === 'trace') fs0.files.forEach((nm, ei) => {
      const raw = fs.readFileSync(path.join(root, id, 'traces', nm), 'utf8');
      const d = JSON.parse(raw);
      const original = records(fs0.reader, d);
      const k = f.cases[ei];
      const steps = f.runs.filter((r) => r.caseId === k.id).flatMap((r) => {
        const tr = HUB.model.traceOf(m, r, null);
        const turn = tr.session.turns.find((t) => t.id === tr.turn);
        if (turn.status !== 'completed' || turn.durationMs !== null || tr.session.state.status === 'failed' || tr.session.usage) errs.push(r.id + ' invalid trace state/usage');
        if (r.coverage.indexed !== turn.steps.filter((s) => s.kind !== 'event' && !(s.kind === 'message' && s.role === 'agent')).length) errs.push(r.id + ' invalid indexed coverage');
        return turn.steps;
      });
      steps.forEach((s) => {
        if (!Number.isInteger(s.sourceIndex)) errs.push(s.id + ' missing sourceIndex');
        if (s.kind === 'tool' && s.status === 'error' || s.kind === 'event' && s.name === 'error') errs.push(s.id + ' annotation became step error');
      });
      [0, original.length - 1].forEach((i) => {
        const step = steps.find((s) => s.sourceIndex === i && s.kind !== 'event');
        if (!step || (step.kind === 'tool' ? step.output : step.text) !== original[i]) errs.push(nm + ' body mismatch at sourceIndex ' + i);
      });
      if (k.mistake) {
        const mk = k.mistake;
        const rawSpeaker = d[mk.turnIndex] && (d[mk.turnIndex].name || d[mk.turnIndex].role.replace(/\s*\(.+\)\s*$/, ''));
        const x = m.def.individuals.find((x) => x.id === mk.individualId);
        const normalized = (s) => String(s || '').replace(/[（(][^）)]*[）)]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '');
        const speaker = normalized(rawSpeaker) === 'assistant' && !m.def.individuals.some((x) => normalized(x.id) === 'assistant') ? 'coder' : normalized(rawSpeaker);
        const matches = speaker === normalized(x.id) || speaker === normalized(x.name) ||
          [x.id, x.name].some((n) => normalized(n).length >= 4 && speaker.endsWith(normalized(n)));
        if (mk.consistent !== matches) errs.push(k.id + ' incorrect mistake consistency');
        const marked = f.runs.filter((r) => r.caseId === k.id && r.mark === 'mistake');
        if (marked.length !== (mk.consistent ? 1 : 0)) errs.push(k.id + ' incorrect mistake mark count');
        const annotations = steps.filter((s) => s.kind === 'event' && s.name === 'annotation');
        if (annotations.length !== (mk.consistent ? 1 : 0)) errs.push(k.id + ' incorrect annotation count');
      }
    });
    m.rev = 0;
    m.idx = HUB.analysis.buildIdx(m.def, m.facts);
    HUB.store.init({ caseId: id });
    HUB.util.setClock(m.clock);
    const base = HUB.store.get();
    const panel = HUB.panels._prepare(m, base);
    if (panel.overview.find((x) => x.key === 'tokens').value !== '未记录') errs.push('token total shown as number');
    if (HUB.model.an(base, m).totals.tokens !== null) errs.push('unrecorded tokens summed to zero');
    if (['tokens', 'duration', 'delivery', 'channel'].some((q) => HUB.model.measured(m, q))) errs.push('unmeasured quantity labeled measured');
    if (HUB.util.fmtDur(59000) !== '1 条') errs.push('ordinal duration shown as time');
    const t0 = Date.now();
    const states = [
      ['org d1', { subject: 'org', depth: { org: 1, process: 1, exec: 1 } }],
      ['org d3', { subject: 'org', depth: { org: 3, process: 1, exec: 1 }, lines: { task: true, info: true, watch: true, channel: true }, overlays: { human: true, channels: true, delivery: true, lanes: true } }],
      ['org focus', { subject: 'org', depth: { org: 3, process: 1, exec: 1 }, focus: f.cases[0] ? { type: 'case', id: f.cases[0].id } : null }],
      ['process', { subject: 'process', depth: { org: 1, process: 2, exec: 1 } }],
      ['process focus', { subject: 'process', focus: f.cases[0] ? { type: 'case', id: f.cases[0].id } : null }],
      ['org cut', { subject: 'org', depth: { org: 3, process: 1, exec: 1 }, time: f.span.end * 0.4 }],
    ];
    for (const [tag, patch] of states) {
      const s = Object.assign({}, base, patch);
      try {
        const a = HUB.model.an(s, m);
        const sc = s.subject === 'org' ? HUB.obsSceneOrg.build(m, s, a, { w: 1300, h: 760 }) : HUB.obsSceneProcess.build(m, s, a, { w: 1300, h: 760 });
        const keys = new Set([...sc.cards, ...sc.frames].map((o) => o.key));
        [...sc.cards, ...sc.frames].forEach((o) => { if (![o.x, o.y, o.w, o.h].every(Number.isFinite)) errs.push(tag + ' ' + o.key + ' NaN'); });
        sc.links.forEach((l) => { if (!keys.has(l.from) || !keys.has(l.to)) errs.push(tag + ' link ' + l.key + ' end missing'); });
      } catch (e) { errs.push(tag + ' threw ' + e.stack.split('\n').slice(0, 2).join(' | ')); }
    }
    // a run opens as its recorded session
    const r0 = f.runs[0];
    if (r0) {
      const tr = HUB.model.traceOf(m, r0, null);
      if (!tr || !tr.session || !tr.session.turns.some((t) => t.id === tr.turn)) errs.push('run ' + r0.id + ' does not open its recorded turn');
    }
    tot.ms += Date.now() - t0;

    if (fs0.kind === 'trace') {
      tot.real++;
      const rd = (byReader[fs0.reader] = byReader[fs0.reader] || { cases: 0, episodes: 0, runs: 0, hand: 0, handDecl: 0, added: 0,
        explicit: 0, protocol: 0, adjacent: 0, consistent: 0, inconsistent: 0 });
      const hand = f.handoffs.length, decl = f.handoffs.filter((h) => h.relationId).length;
      const declSteps = new Set(m.def.process.stages.map((s) => s.id));
      rd.cases++; rd.episodes += fs0.episodes; rd.runs += f.runs.length; rd.hand += hand; rd.handDecl += decl; rd.added += fs0.added.length;
      f.handoffs.forEach((h) => { rd[h.basis]++; });
      f.cases.filter((k) => k.mistake).forEach((k) => { rd[k.mistake.consistent ? 'consistent' : 'inconsistent']++; });
      tot.episodes += fs0.episodes; tot.runs += f.runs.length; tot.hand += hand; tot.handDecl += decl; tot.added += fs0.added.length;
      tot.steps += f.cases.length; tot.stepsOnPath += f.cases.filter((k) => k.path.some((p) => declSteps.has(p.node))).length;
    }
    if (id === 'imp_whowhen_hc_08cae58d') {
      console.log(id + ': ' + counts(f.handoffs));
      const mk = f.cases[0].mistake;
      console.log('mistake individual=' + mk.individualId + ' sourceIndex=' + mk.turnIndex + ' consistent=' + mk.consistent);
      console.log('explicit dispatch WebSurfer=' + f.handoffs.filter((h) => h.basis === 'explicit' && h.to === 'websurfer').length +
        ' Assistant=' + f.handoffs.filter((h) => h.basis === 'explicit' && h.to === 'coder').length);
      if (f.handoffs.filter((h) => h.basis === 'explicit' && h.to === 'websurfer').length !== 29 ||
        f.handoffs.filter((h) => h.basis === 'explicit' && h.to === 'coder').length !== 1 ||
        mk.individualId !== 'websurfer' || mk.turnIndex !== 4) errs.push('recorded dispatch/mistake mismatch');
    }
    if (fs0.reader === 'taubench' && !tauPrinted) {
      const success = f.cases.filter((k) => k.result === 'success').length;
      const failure = f.cases.filter((k) => k.result === 'failure').length;
      console.log(id + ': loaded success=' + success + ' failure=' + failure + ' files=' + fs0.files.length + '/' + fs0.total);
      if (!success || !failure) errs.push('tau sample lacks success or failure');
      tauPrinted = true;
    }
    if (errs.length) { failures++; console.log('FAIL ' + id + '\n  ' + errs.slice(0, 5).join('\n  ')); }
  }
  console.log('\nreader      cases  episodes   runs  handoffs  on declared line  speakers not in orchestration');
  Object.entries(byReader).forEach(([k, r]) => console.log(
    `${k.padEnd(10)} ${String(r.cases).padStart(6)} ${String(r.episodes).padStart(9)} ${String(r.runs).padStart(6)} ${String(r.hand).padStart(9)} ${String(r.handDecl).padStart(9)} (${Math.round(100 * r.handDecl / Math.max(1, r.hand))}%) ${String(r.added).padStart(10)}`));
  Object.entries(byReader).forEach(([k, r]) => console.log(`${k}: explicit=${r.explicit} protocol=${r.protocol} adjacent=${r.adjacent}; mistake consistent=${r.consistent} inconsistent=${r.inconsistent}`));
  console.log(`\n${tot.real}/${tot.cases} cases on recorded facts; episodes with a path over the declared process: ${tot.stepsOnPath}/${tot.steps}; ` +
    `analysis+scenes ${Math.round(tot.ms / Math.max(1, tot.cases))} ms per case (6 states)`);
  console.log(failures ? failures + ' case(s) failed' : 'all cases passed');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
