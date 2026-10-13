#!/usr/bin/env node
/**
 * check_escape.js - a case document is untrusted text.  This feeds the parser a case whose names, ids, roles, triggers, document
 * titles and gate texts are HTML, draws the scenes and renders the details pane and the sidebar pages for it, and fails when any
 * of the produced markup contains a tag the document wrote (an opening <img> or <script>).  The page's Content-Security-Policy
 * would stop such a script anyway; this keeps the markup itself clean.
 * Usage: node hub/tools/check_escape.js
 */
const { createContext, loadScripts, pageScripts } = require('./load.js');

const ctx = createContext();
// the few browser objects the panes touch while building strings
ctx.document = { documentElement: { getAttribute: () => null }, querySelector: () => null, getElementById: () => null, addEventListener() {},
  createElement: () => ({ classList: { add() {}, remove() {}, toggle() {} }, style: {}, addEventListener() {}, setAttribute() {}, appendChild() {} }) };
ctx.localStorage = { getItem: () => null, setItem() {} };
ctx.location = { hash: '', protocol: 'http:' };
loadScripts(ctx, pageScripts(['data/', 'js/core/', 'js/sources/', 'js/obs/avatar.js', 'js/obs/cards.js', 'js/obs/scene-', 'js/obs/panels.js', 'js/obs/panel.js', 'js/obs/presets.js', 'js/obs/side.js', 'js/obs/trace.js']));
const HUB = ctx.HUB;

const EVIL = '"><img src=x onerror=alert(1)><script>alert(2)</script>';
const ID = '"><img/src=x/onerror=alert(3)>';                      // an id has no spaces, so it breaks out another way
const A = 'a' + ID, B = 'b' + ID, G = 'g' + ID, S = 's' + ID, GT = 'gt' + ID, D1 = 'd1' + ID;
const head = (kind) => '---\nhub: "1.0"\nkind: ' + kind + '\ncase: evil\n---\n\n';
const files = {
  'meta.md': '---\nhub: "1.0"\nkind: meta\ncase: evil\nsession: codex:abc\n---\n\n# ' + EVIL + '\n\n' + EVIL + '\n',
  'agents.md': head('agents') + '# @' + A + ' [individual] #phase/build #hub\nname: ' + EVIL + '\nrole: ' + EVIL + '\ntrigger: ' + EVIL + '\nextra: ' + EVIL + '\nsession: codex:abc\nwatches: [' + B + ']\n\n' +
    '# @' + B + ' [individual] #phase/qa\nname: B' + EVIL + '\n',
  'groups.md': head('groups') + '# @' + G + ' [group] #level/1\nname: ' + EVIL + '\nmembers: [' + A + ', ' + B + ']\n',
  'docs.md': head('docs') + '# @' + D1 + ' [doc] #layer/consensus\nname: ' + EVIL + '\nsummary: ' + EVIL + '\naudience: all\n',
  'process.md': head('process') + '# @' + S + ' [stage] #group/' + G + '\nname: ' + EVIL + '\nexecutors: [' + A + ']\n\n' +
    '# @' + GT + ' [gate]\nname: ' + EVIL + '\nafter_stage: ' + S + '\ndecider_type: agent\ndecider_who: ' + B + '\ndecider_text: ' + EVIL + '\npass: done\nfail: ' + S + '\n',
  'relations.md': head('relations') + '- ' + A + ' read ' + B + ' ' + EVIL + '\n'
};

const raw = /<img\b|<script\b/i;
const host = () => ({ innerHTML: '', scrollTop: 0, addEventListener() {}, querySelector: () => null, querySelectorAll: () => [], classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, appendChild() {} });
let bad = 0, pieces = 0;
const flag = (where, html) => { pieces++; if (raw.test(html)) { bad++; const i = html.search(raw); console.log('UNESCAPED  ' + where + ': ' + html.slice(Math.max(0, i - 70), i + 30).replace(/\s+/g, ' ')); } };

(async () => {
  const m = await HUB.fromDocs.loadCase((p) => Promise.resolve(files[p.replace(/^.*\//, '')] || ''), 'virtual/evil', 'evil');
  m.rev = 0; m.idx = HUB.analysis.buildIdx(m.def, m.facts);
  HUB.store.init({ caseId: 'evil' }); HUB.model.current = m;
  const base = HUB.store.get();

  // the drawing: every card and frame of the four scene states
  [['org d1', { subject: 'org', depth: { org: 1, process: 1, exec: 1 } }], ['org d2', { subject: 'org', depth: { org: 2, process: 1, exec: 1 } }],
    ['org d3', { subject: 'org', depth: { org: 3, process: 1, exec: 1 } }], ['process', { subject: 'process', depth: { org: 1, process: 2, exec: 1 } }]].forEach(([tag, patch]) => {
    const s = Object.assign({}, base, patch), a = HUB.model.an(s, m);
    const sc = s.subject === 'org' ? HUB.obsSceneOrg.build(m, s, a, { w: 1300, h: 760 }) : HUB.obsSceneProcess.build(m, s, a, { w: 1300, h: 760 });
    sc.cards.forEach((c) => flag(tag + ' card ' + c.key, HUB.obsCards.card(c).html));
    sc.frames.forEach((f) => flag(tag + ' frame ' + f.key, HUB.obsCards.frame(f).html));
  });

  // the details pane for each kind of object, and the sidebar pages
  const sels = [null, { type: 'individual', id: A }, { type: 'individual', id: B }, { type: 'group', id: G }, { type: 'stage', id: S }, { type: 'gate', id: GT }, { type: 'channels', id: 'all' }];
  m.def.relations.slice(0, 3).forEach((r) => sels.push({ type: 'relation', id: r.id }));
  m.def.channels.slice(0, 2).forEach((c) => sels.push({ type: 'channel', id: c.id }));
  sels.forEach((sel) => { const el = host(); HUB.obsPanel.render(el, m, Object.assign({}, base, { selection: sel })); flag('details ' + JSON.stringify(sel), el.innerHTML); });
  const t = host(); HUB.obsSide.tree(t, m, base); flag('structure page', t.innerHTML);
  const h = host(); HUB.obsSide.health(h, m, base); flag('health page', h.innerHTML);

  if (bad) { console.log('FAILED: ' + bad + ' of ' + pieces + ' pieces of markup contain a tag the document wrote'); process.exit(1); }
  console.log('OK: ' + pieces + ' pieces of markup from a hostile case, none with a tag of its own');
})().catch((e) => { console.error(e); process.exit(1); });
