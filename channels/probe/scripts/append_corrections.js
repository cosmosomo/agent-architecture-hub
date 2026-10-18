// Appends lead verification corrections to the blackboard. Each correction names the original line.
// Usage: node append_corrections.js <corrections.json>
// corrections.json: [{ "line": 178, "result": "unverified", "why": "..." }, ...]
const fs = require('fs');
const path = require('path');

const bbPath = path.resolve(__dirname, '..', 'blackboard.jsonl');
const lines = fs.readFileSync(bbPath, 'utf8').split(/\r?\n/);
const fixes = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const at = new Date().toISOString();
const out = fixes.map((f) => {
  const orig = JSON.parse(lines[f.line - 1]);
  return JSON.stringify({
    at,
    by: 'claude-lead(核验)',
    family: orig.family,
    layer: orig.layer,
    route: orig.route,
    surface: orig.surface,
    capability: orig.capability,
    result: f.result,
    condition: `核验第 ${f.line} 行（原结论 ${orig.result}）`,
    evidence: `原证据：${String(orig.evidence).slice(0, 160)}`,
    cmd: orig.cmd || '',
    note: f.why,
  });
});
fs.appendFileSync(bbPath, out.join('\n') + '\n');
console.log(`appended ${out.length} corrections`);
