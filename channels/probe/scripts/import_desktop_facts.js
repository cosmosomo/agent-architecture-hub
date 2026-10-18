// Imports the per-family tables of probe/results/hci-desktop-facts-20261018.md (Antigravity's survey of what each
// desktop app shows people and lets them do) into the blackboard as layer-1 (native app) facts. Layer 1 is
// evidenced by screenshot or code analysis (bundled front-end code, local store schemas), not by live tests (user,
// 2026-10-18). The survey was not checked cell by cell (the lead found two wrong conclusions elsewhere in it), so
// "有" is recorded as unverified with note "desktop-has", never as pass; "无" as fail. Append-only and idempotent: rows already
// imported (same condition marker) are skipped.
// Usage: node channels/probe/scripts/import_desktop_facts.js
const fs = require('fs');
const path = require('path');

const DIR = path.resolve(__dirname, '..');
const SRC = path.join(DIR, 'results', 'hci-desktop-facts-20261018.md');
const BB = path.join(DIR, 'blackboard.jsonl');
const MARK = '桌面端调研导入（hci-desktop-facts-20261018，未逐格核）';
const SECTIONS = [['### 1.2', 'codex'], ['### 2.2', 'antigravity'], ['### 3.2', 'zcode'], ['### 4.2', 'workbuddy']];

const md = fs.readFileSync(SRC, 'utf8');
const existing = new Set(
  fs.readFileSync(BB, 'utf8').split(/\r?\n/).filter(Boolean)
    .map((l) => { try { return JSON.parse(l); } catch { return null; } })
    .filter((r) => r && r.condition === MARK)
    .map((r) => r.family + '|' + r.capability),
);
const at = new Date().toISOString();
const out = [];
for (const [head, family] of SECTIONS) {
  const start = md.indexOf(head);
  if (start < 0) continue;
  const end = md.indexOf('\n### ', start + head.length);
  const block = md.slice(start, end < 0 ? undefined : end);
  for (const line of block.split(/\r?\n/)) {
    const c = line.split('|').slice(1, -1).map((x) => x.trim());
    if (c.length < 4) continue;
    const id = c[0].replace(/[*`]/g, '');
    if (!/^[a-z][\w-]*$/.test(id)) continue;
    const says = c[2].replace(/\*/g, '');
    const result = /^有/.test(says) ? 'unverified' : /^无/.test(says) ? 'fail' : /部分/.test(says) ? 'partial' : 'unverified';
    if (existing.has(family + '|' + id)) continue;
    out.push(JSON.stringify({
      at, by: 'claude-lead', family, layer: 'L0', route: `${family}/L0/desktop-app`, surface: 'desktop-app', capability: id, result,
      condition: MARK, evidence: c[3].slice(0, 400), cmd: '', note: /^有/.test(says) ? 'desktop-has' : says.slice(0, 40),
    }));
  }
}
if (out.length) fs.appendFileSync(BB, out.join('\n') + '\n');
console.log('imported', out.length, 'rows');
