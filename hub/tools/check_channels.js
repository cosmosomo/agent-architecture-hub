#!/usr/bin/env node
/**
 * check_channels.js - Verifies the Local Channel & Capability Maintenance Workbench
 * under Agent-Architecture-Hub/channels/ and probes live local CLI / client fingerprints
 * against snapshots/fingerprint-baseline.json and the 21 channel cards.
 *
 * Security red lines enforced:
 * - Never reads or prints any API key values from _private/凭证.md, .env, or cc-switch.db
 * - Never opens running AP-Vibe 8876 SQLite directly
 * - Never kills or restarts user desktop apps (Doubao / ZCode / AntiGravity)
 *
 * Usage: node hub/tools/check_channels.js
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execSync } = require('child_process');

const ROOT_DIR = path.resolve(__dirname, '..', '..');
const CHANNELS_DIR = path.join(ROOT_DIR, 'channels');

const REQUIRED_SECTIONS = [
  '## 一、',
  '## 二、',
  '## 三、',
  '## 四、',
  '## 五、',
];

const VALID_STATUS_RE = /\b(ok|cooldown_degraded|blocked_down|auth_wall|upgrade_pending)\b/;
const VALID_MAINTAINERS = new Set(['S5', 'S6', 'S3']);

function parseFrontmatter(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  if (!m) return null;
  const meta = {};
  for (const line of m[1].split(/\r?\n/)) {
    if (/^\s+/.test(line)) continue;
    const idx = line.indexOf(':');
    if (idx <= 0) continue;
    const key = line.slice(0, idx).trim();
    const val = line.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
    meta[key] = val;
  }
  meta.hasCapabilities = /\ncapabilities:\r?\n/.test(m[1]);
  return meta;
}

function safeExec(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 5000 }).trim();
  } catch {
    return null;
  }
}

function main() {
  const errors = [];
  const warnings = [];

  // 1. Check workbench core files
  const boardPath = path.join(CHANNELS_DIR, 'BOARD.md');
  const baselinePath = path.join(CHANNELS_DIR, 'snapshots', 'fingerprint-baseline.json');
  const eventsPath = path.join(CHANNELS_DIR, 'events.jsonl');

  for (const p of [boardPath, baselinePath, eventsPath]) {
    if (!fs.existsSync(p)) errors.push('Missing core workbench file: ' + path.relative(ROOT_DIR, p));
  }

  let baseline = {};
  if (fs.existsSync(baselinePath)) {
    try {
      baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
    } catch (e) {
      errors.push('Invalid JSON in fingerprint-baseline.json: ' + e.message);
    }
  }

  if (fs.existsSync(eventsPath)) {
    const lines = fs.readFileSync(eventsPath, 'utf8').split(/\r?\n/).filter(Boolean);
    lines.forEach((line, i) => {
      try {
        const ev = JSON.parse(line);
        if (!ev.at || !ev.channel || !ev.kind || !ev.maintainer) {
          errors.push(`events.jsonl line ${i + 1} missing required fields (at, channel, kind, maintainer)`);
        }
      } catch (e) {
        errors.push(`events.jsonl line ${i + 1} invalid JSON: ${e.message}`);
      }
    });
  }

  // 2. Scan all 21 channel cards across hosts/, models/, tools-sites/
  const groups = [
    { dir: 'hosts', expectedCount: 10 },
    { dir: 'models', expectedCount: 5 },
    { dir: 'tools-sites', expectedCount: 6 },
  ];

  const cards = [];
  for (const g of groups) {
    const dirPath = path.join(CHANNELS_DIR, g.dir);
    if (!fs.existsSync(dirPath)) {
      errors.push('Missing directory: channels/' + g.dir);
      continue;
    }
    const files = fs.readdirSync(dirPath).filter((f) => f.endsWith('.md')).sort();
    if (files.length !== g.expectedCount) {
      errors.push(`channels/${g.dir} expected ${g.expectedCount} cards, found ${files.length}`);
    }
    for (const f of files) {
      const full = path.join(dirPath, f);
      const text = fs.readFileSync(full, 'utf8');
      const fm = parseFrontmatter(text);
      const rel = `channels/${g.dir}/${f}`;
      if (!fm) {
        errors.push(`${rel}: missing YAML frontmatter`);
        continue;
      }
      for (const req of ['channel_id', 'category', 'name', 'status', 'maintainer', 'verified_version', 'detected_version']) {
        if (!fm[req]) errors.push(`${rel}: missing frontmatter field '${req}'`);
      }
      if (!fm.hasCapabilities) {
        errors.push(`${rel}: missing capabilities block in frontmatter`);
      }
      if (fm.status && !VALID_STATUS_RE.test(fm.status)) {
        errors.push(`${rel}: invalid status '${fm.status}'`);
      }
      if (fm.maintainer && !VALID_MAINTAINERS.has(fm.maintainer)) {
        errors.push(`${rel}: invalid maintainer '${fm.maintainer}'`);
      }
      for (const sec of REQUIRED_SECTIONS) {
        if (!text.includes(sec)) {
          errors.push(`${rel}: missing mandatory section '${sec}'`);
        }
      }
      if (fm.deep_docs_dir) {
        const deepDir = path.resolve(dirPath, fm.deep_docs_dir);
        const deepReadme = path.join(deepDir, 'README.md');
        if (!fs.existsSync(deepReadme)) {
          errors.push(`${rel}: declared deep_docs_dir '${fm.deep_docs_dir}' missing README.md`);
        } else {
          const mdFiles = fs.readdirSync(deepDir).filter((x) => x.endsWith('.md'));
          fm.deepDocsCount = mdFiles.length;
        }
      }
      cards.push({ rel, group: g.dir, meta: fm });
    }
  }

  // 3. Check upgrade tickets in channels/upgrades/
  const upgradesDir = path.join(CHANNELS_DIR, 'upgrades');
  const upgradeFiles = fs.existsSync(upgradesDir)
    ? fs.readdirSync(upgradesDir).filter((f) => f.endsWith('.md')).sort()
    : [];
  if (upgradeFiles.length < 4) {
    errors.push(`channels/upgrades expected at least 4 files (template + 3 active tickets), found ${upgradeFiles.length}`);
  }

  // 4. Live local probe against baseline (non-destructive, read-only)
  const home = os.homedir();
  const probes = [];

  // Probe Doubao Desktop fingerprint
  const doubaoLocalState = path.join(home, 'AppData', 'Local', 'Doubao', 'User Data', 'Local State');
  if (fs.existsSync(doubaoLocalState)) {
    try {
      const raw = fs.readFileSync(doubaoLocalState, 'utf8');
      const m = raw.match(/"variations_seed_version"\s*:\s*"([^"]+)"/);
      const seedVer = m ? m[1] : 'unknown';
      const baseVer = baseline.hosts && baseline.hosts['doubao-desktop'] && baseline.hosts['doubao-desktop'].client_version;
      probes.push({
        channel: 'doubao-desktop',
        probe: `client_version=${seedVer}`,
        match: !baseVer || seedVer === baseVer ? 'MATCH (no external session sync yet)' : `CHANGED (was ${baseVer} -> trigger WATCH_doubao-desktop_external_sessions)`,
      });
    } catch {
      probes.push({ channel: 'doubao-desktop', probe: 'Local State unreadable', match: 'SKIP' });
    }
  }

  // Probe CLI versions
  const cliProbes = [
    { id: 'codex', cmd: 'codex --version' },
    { id: 'claude-code', cmd: 'claude --version' },
    { id: 'gemini-cli', cmd: 'gemini --version' },
    { id: 'opencode', cmd: 'opencode --version' },
    { id: 'factory-droid', cmd: 'droid --version' },
  ];
  for (const p of cliProbes) {
    const out = safeExec(p.cmd);
    if (out) {
      const card = cards.find((c) => c.meta.channel_id === p.id);
      const verified = card && card.meta.verified_version;
      const detected = card && card.meta.detected_version;
      const status = verified && !out.includes(verified)
        ? `DELTA_TRACKED (verified=${verified}, live=${out}, card_detected=${detected || '-'})`
        : `SYNCED (${out})`;
      probes.push({ channel: p.id, probe: out, match: status });
    }
  }

  // Summary output
  const byStatus = {};
  const byMaint = {};
  for (const c of cards) {
    byStatus[c.meta.status] = (byStatus[c.meta.status] || 0) + 1;
    byMaint[c.meta.maintainer] = (byMaint[c.meta.maintainer] || 0) + 1;
  }

  console.log('=== Channel & Capability Maintenance Workbench Check ===');
  console.log(`Cards verified: ${cards.length} (hosts: 10, models: 5, tools-sites: 6)`);
  console.log(`Status distribution: ${Object.entries(byStatus).map(([k, v]) => `${k}=${v}`).join(', ')}`);
  console.log(`Maintainer distribution: ${Object.entries(byMaint).map(([k, v]) => `${k}=${v}`).join(', ')}`);
  console.log(`Upgrade & watch tickets: ${upgradeFiles.length} (${upgradeFiles.join(', ')})`);
  console.log('\nLive Fingerprint Probes:');
  for (const pr of probes) {
    console.log(`  - [${pr.channel}] ${pr.probe} -> ${pr.match}`);
  }

  if (warnings.length) {
    console.log('\nWarnings:\n  ' + warnings.join('\n  '));
  }
  if (errors.length) {
    console.error('\nFAIL:\n  ' + errors.join('\n  '));
    process.exit(1);
  }
  console.log('\nall channel cards, event logs, and upgrade tickets passed');
}

main();
