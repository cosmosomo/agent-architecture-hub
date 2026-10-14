#!/usr/bin/env node
/**
 * check_local_sessions.js - End-to-end verifier for local session parsing across all 6 adapters
 * (Codex, Claude Code, OpenCode, Factory, Gemini, ZCode), 4-tier AdapterCapabilities,
 * .md document & 4-element delivery extraction, cross-session protocol handoffs,
 * HUB.obsSceneOrg.build, and HUB.collab.build.
 *
 * Usage: node --no-warnings=ExperimentalWarning hub/tools/check_local_sessions.js
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');
const { pathToFileURL } = require('url');
const { createContext, loadScripts, pageScripts } = require('./load.js');

const ROOT_DIR = path.resolve(__dirname, '..', '..');

async function main() {
  // Dynamically import ESM/TS modules from trace/
  const storeMod = await import(pathToFileURL(path.join(ROOT_DIR, 'trace/apps/cli/src/store.ts')).href);
  const adaptersMod = await import(pathToFileURL(path.join(ROOT_DIR, 'trace/packages/adapters/src/index.ts')).href);

  const home = os.homedir();
  const findAdapter = (k) => adaptersMod.ADAPTERS.find((a) => a.kind === k);
  // Verify every registered adapter exposes 4-tier capabilities
  for (const a of adaptersMod.ADAPTERS) {
    assert.ok(a.capabilities, `Adapter ${a.kind} missing capabilities`);
    assert.ok(
      typeof a.capabilities.observe_only === 'boolean' &&
      a.capabilities.control_lifecycle &&
      a.capabilities.steer_in_turn &&
      a.capabilities.coordinate_team,
      `Adapter ${a.kind} incomplete 4-tier capabilities`
    );
  }

  // Scan all Factory, Gemini, ZCode (JSON + SQLite), and recent Codex + Claude Code roots
  const codexRoot = path.join(home, '.codex/sessions/2026/04/07');
  const claudeBase = path.join(home, '.claude/projects');
  const claudeSub = fs.existsSync(claudeBase)
    ? fs.readdirSync(claudeBase, { withFileTypes: true }).filter((d) => d.isDirectory()).slice(0, 4).map((d) => ({
        adapter: findAdapter('claude-code'),
        dir: path.join(claudeBase, d.name),
      }))
    : [];
  const targetedRoots = [
    { adapter: findAdapter('factory'), dir: path.join(home, '.factory/sessions') },
    { adapter: findAdapter('gemini'), dir: path.join(home, '.gemini/tmp') },
    { adapter: adaptersMod.zcodeAdapter, dir: path.join(home, '.zcode/v2/sessions') },
    { adapter: adaptersMod.zcodeDbAdapter, dir: path.join(home, '.zcode/cli/db') },
    { adapter: findAdapter('codex'), dir: fs.existsSync(codexRoot) ? codexRoot : path.join(home, '.codex/sessions') },
    ...claudeSub,
  ];
  const tmpCache = path.join(os.tmpdir(), `hub-trace-Verify-${Date.now()}.json`);
  const store = new storeMod.SessionStore({ roots: targetedRoots, cacheFile: tmpCache });

  console.log('=== 1. Scanning Local Sessions Across All Platforms ===');
  const report = await store.scan();
  console.log(`Scan report: files=${report.files}, parsed=${report.parsed}, failed=${report.failed}, ms=${report.ms}`);
  assert.strictEqual(report.failed, 0, 'Expected 0 failed files during scan, got: ' + report.errors.join('; '));

  const idx = store.index();
  const byKind = {};
  for (const s of idx.sessions) {
    byKind[s.source.kind] = (byKind[s.source.kind] || 0) + 1;
  }
  console.log('Sessions indexed by source.kind:', byKind);

  // 2. Verify adapter-specific Step 2 fixes on real local sessions
  console.log('\n=== 2. Verifying Adapter Fixes (Factory, ZCode, Gemini, Capabilities) ===');
  let factoryTodos = 0;
  let factoryCompactions = 0;
  let zcodeCompactions = 0;
  let geminiChatsWithModel = 0;
  let badNotes = [];

  for (const sum of idx.sessions) {
    if (['factory', 'zcode', 'gemini'].includes(sum.source.kind)) {
      const full = await store.session(sum.id);
      if (!full) continue;
      assert.ok(full.capabilities, `Session ${full.id} missing capabilities`);
      for (const n of full.notes || []) {
        if (/^(type:todo_state|type:compaction_state|part:compaction|part:file)\b/.test(n)) {
          badNotes.push(`${full.id}: ${n}`);
        }
      }
      if (full.source.kind === 'factory') {
        factoryCompactions += full.stats.compactions || 0;
        for (const t of full.turns) {
          for (const st of t.steps) {
            if (st.kind === 'tool' && st.name === 'TodoWrite' && Array.isArray(st.todos) && st.todos.length) {
              factoryTodos += st.todos.length;
            }
          }
        }
      } else if (full.source.kind === 'zcode') {
        zcodeCompactions += full.stats.compactions || 0;
      } else if (full.source.kind === 'gemini') {
        if (full.stats.modelCalls > 0 && full.agent.model) geminiChatsWithModel++;
      }
    }
  }

  // Also verify geminiAdapter.parseBundle resolves .project_root into session.cwd
  const geminiAdapter = findAdapter('gemini');
  const realRootFile = path.join(home, '.gemini/tmp/agent-architecture-hub/.project_root');
  if (fs.existsSync(realRootFile)) {
    const members = geminiAdapter.bundleMembers(
      path.join(home, '.gemini/tmp/agent-architecture-hub/chats/session-test.json'),
      [realRootFile]
    );
    assert.ok(members.includes(realRootFile), 'geminiAdapter.bundleMembers should include .project_root');
    const bundledSession = geminiAdapter.parseBundle(
      { path: path.join(home, '.gemini/tmp/agent-architecture-hub/chats/session-test.json') },
      {
        files: members,
        read: (p) => (p === realRootFile ? fs.readFileSync(realRootFile, 'utf8') : JSON.stringify({ sessionId: 'test-1', messages: [] })),
      },
      { now: Date.now() }
    );
    assert.ok(bundledSession.cwd && bundledSession.cwd.length > 0, 'geminiAdapter.parseBundle should populate session.cwd from .project_root');
    console.log(`  - Gemini .project_root bundle resolution verified: cwd=${bundledSession.cwd}`);
  }

  console.log(`  - Factory TodoWrite items parsed: ${factoryTodos}, compactions: ${factoryCompactions}`);
  console.log(`  - ZCode compactions parsed: ${zcodeCompactions}`);
  console.log(`  - Gemini full chat sessions with model: ${geminiChatsWithModel}`);
  assert.strictEqual(badNotes.length, 0, 'Unrecognized notes still present: ' + badNotes.join(', '));
  if (byKind.factory) {
    assert.ok(factoryTodos > 0, 'Expected Factory todo_state items to be parsed into TodoWrite steps');
    assert.ok(factoryCompactions > 0, 'Expected Factory compaction_state to be parsed into compactions');
  }
  if (byKind.zcode) {
    assert.ok(zcodeCompactions > 0, 'Expected ZCode compaction parts to be parsed into compactions');
  }
  if (byKind.gemini) {
    assert.ok(geminiChatsWithModel > 0, 'Expected Gemini chats/session-*.json with modelCalls > 0 and agent.model');
  }

  // 3. Verify HUB.fromTrace.model, .md deliveries, cross-session handoffs, obsSceneOrg & collab
  console.log('\n=== 3. Verifying HUB.fromTrace.model, .md Deliveries, obsSceneOrg & collab ===');
  const ctx = loadScripts(createContext(), pageScripts([
    'data/', 'js/core/', 'js/sources/', 'js/obs/avatar.js', 'js/obs/cards.js', 'js/obs/scene-', 'js/obs/panels.js',
  ]));
  const HUB = ctx.HUB;

  // Find a parent session with subagents (e.g. codex or claude-code or zcode)
  const parentSum = idx.sessions.find((s) => s.links.some((l) => l.rel === 'child'));
  assert.ok(parentSum, 'Expected at least one parent session with child subagents on this machine');

  // Collect full session tree for parentSum
  const treeIds = new Set([parentSum.id]);
  const queue = [parentSum.id];
  while (queue.length) {
    const curId = queue.shift();
    const curSum = idx.sessions.find((s) => s.id === curId);
    if (!curSum) continue;
    for (const l of curSum.links) {
      if (l.rel === 'child' && !treeIds.has(l.id)) {
        treeIds.add(l.id);
        queue.push(l.id);
      }
    }
  }
  const treeSessions = [];
  for (const tid of treeIds) {
    const s = await store.session(tid);
    if (s) treeSessions.push(s);
  }

  // Also test a multi-session workspace with .md file reads/writes across sessions
  const sotaSessions = [];
  for (const sum of idx.sessions.filter((s) => s.cwd && /sota/i.test(s.cwd)).slice(0, 6)) {
    const full = await store.session(sum.id);
    if (full && full.turns.length) sotaSessions.push(full);
  }

  const testBundles = [
    { label: `Subagent Tree (${parentSum.id}, ${treeSessions.length} sessions)`, sessions: treeSessions, opts: { id: 'tree:' + parentSum.id } },
  ];
  if (sotaSessions.length >= 2) {
    testBundles.push({
      label: `Multi-Session Workspace (sota, ${sotaSessions.length} sessions)`,
      sessions: sotaSessions,
      opts: { id: 'tree:sota', name: 'sota 跨会话协作', singleCase: true },
    });
  }

  let totalDocs = 0;
  let totalDeliveries = 0;
  let totalProtocolHandoffs = 0;

  for (const b of testBundles) {
    const m = HUB.fromTrace.model(JSON.parse(JSON.stringify(b.sessions)), b.opts);
    m.idx = HUB.analysis.buildIdx(m.def, m.facts);
    m.cmp = HUB.analysis.comparability(m);
    HUB.model.current = m;
    HUB.store.init({ caseId: m.id });
    const baseState = HUB.store.get();

    assert.ok(m.capabilities, `${b.label}: model missing capabilities`);
    for (const ind of m.def.individuals) {
      if (ind.kind === 'agent') {
        assert.ok(ind.capabilities, `${b.label}: agent ${ind.id} missing capabilities`);
      }
    }
    for (const dv of m.facts.deliveries) {
      assert.ok(dv.from && dv.to && dv.docId && dv.status, `${b.label}: delivery ${dv.id} missing 4-element fields`);
    }

    totalDocs += m.def.docs.length;
    totalDeliveries += m.facts.deliveries.length;
    const protoHands = m.facts.handoffs.filter((h) => h.basis === 'protocol');
    totalProtocolHandoffs += protoHands.length;

    console.log(`  - ${b.label}: individuals=${m.def.individuals.length}, runs=${m.facts.runs.length}, docs=${m.def.docs.length}, deliveries=${m.facts.deliveries.length}, handoffs=${m.facts.handoffs.length} (protocol=${protoHands.length})`);

    // Verify obsSceneOrg and collab across compare=['both','fact','def'] and depth=[1,2,3]
    const k0 = m.facts.cases[0];
    for (const cmp of ['both', 'fact', 'def']) {
      for (const d of [1, 2, 3]) {
        const sOrg = Object.assign({}, baseState, {
          subject: 'org', compare: cmp, depth: { org: d, process: 1, exec: 1 },
          lines: { task: true, info: true, watch: true, channel: d === 3 },
          overlays: { human: true, channels: d === 3, delivery: true, lanes: true },
        });
        const an = HUB.model.an(sOrg, m);
        const sc = HUB.obsSceneOrg.build(m, sOrg, an, { w: 1300, h: 760 });
        for (const o of [...sc.cards, ...sc.frames]) {
          assert.ok([o.x, o.y, o.w, o.h].every(Number.isFinite), `${b.label} org ${cmp} d${d}: NaN geometry on ${o.key}`);
        }
        const sCollab = Object.assign({}, baseState, {
          subject: 'collab', compare: cmp, depth: { org: d, process: 1, exec: 1 },
          focus: { type: 'case', id: k0.id }, instanceId: k0.id, time: null,
        });
        const colOut = HUB.collab.build(m, sCollab);
        for (const n of colOut.st.nodes) {
          assert.ok([n.x, n.y, n.r].every(Number.isFinite), `${b.label} collab ${cmp} d${d}: NaN node ${n.key}`);
        }
      }
    }
  }

  console.log(`  - Total .md docs extracted: ${totalDocs}, 4-element deliveries: ${totalDeliveries}, protocol handoffs: ${totalProtocolHandoffs}`);
  assert.ok(totalDocs > 0 && totalDeliveries > 0, 'Expected real .md docs and 4-element deliveries to be extracted from local sessions');

  try { fs.unlinkSync(tmpCache); } catch {}
  console.log('\nall local session adapter, from-trace, obsSceneOrg, and collab checks passed');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
