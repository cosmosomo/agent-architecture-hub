// Shared reading of channels/probe/blackboard.jsonl: parse rows, normalise route ids, latest record per cell.
const fs = require('fs');
const path = require('path');

const BLACKBOARD = path.resolve(__dirname, '..', 'blackboard.jsonl');

// Capability units come from the register (能力单元登记表, design-doc directory) via build_units.js;
// new units are added there, not here.
const UNITS = JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', '..', '..', 'hub', 'data', 'capability-units.json'), 'utf8')).units;
const CAPS = UNITS.map((u) => u.id);
const LAYERS = ['L0', 'L1a', 'L1b', 'L2', 'L3'];

// Canonical route ids are `<family>/<layer>/<entry>` (channels/README.md §三). Older free-text routes map here.
const ALIAS = {
  'language_server agentapi + ~/.gemini/antigravity/conversation_summaries.db': 'antigravity/L0/summaries-db',
  '~/.gemini/antigravity/conversation_summaries.db': 'antigravity/L0/summaries-db',
  'brain/<cid>/.system_generated/logs/transcript.jsonl 推断': 'antigravity/L0/transcript',
  '~/.gemini/antigravity/presence/<cid>.lock': 'antigravity/L0/presence-lock',
};
// Route labels a tester got wrong, fixed by blackboard line number (the line itself is never edited).
const ROUTE_FIX = {
  228: 'antigravity/L0/agentapi', // agy-flash wrote its own wake-stall under the Codex route it was testing
};
// Otherwise fall back to `<family>/<layer>/<surface>`, so one free-text command per row does not become one column per row.
const canon = (r) =>
  /^[\w-]+\/L\w+\/\S+$/.test(r.route)
    ? r.route
    : ALIAS[r.route] || (r.family && r.layer && r.surface ? `${r.family}/${r.layer}/${r.surface}` : r.route);

/** All rows with normalised `route` and `_line` (1-based), plus the numbers of lines that did not parse. */
function readRows() {
  const rows = [];
  const bad = [];
  fs.readFileSync(BLACKBOARD, 'utf8')
    .split(/\r?\n/)
    .forEach((line, i) => {
      if (!line.trim()) return;
      try {
        const r = JSON.parse(line);
        rows.push({ ...r, route: ROUTE_FIX[i + 1] || canon(r), _line: i + 1 });
      } catch {
        bad.push(i + 1);
      }
    });
  return { rows, bad };
}

/** Map `family|route|capability` → the latest row for that cell. */
function latestByCell(rows) {
  const m = new Map();
  for (const r of rows) m.set(`${r.family}|${r.route}|${r.capability}`, r);
  return m;
}

module.exports = { BLACKBOARD, UNITS, CAPS, LAYERS, readRows, latestByCell };
