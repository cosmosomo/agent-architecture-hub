// probe wb3: content-search over WorkBuddy session jsonl files (read-only)
const fs = require('fs');
const path = require('path');
const term = process.argv[2] || 'WB-SECRET';
const root = 'C:/Users/COLORFIRE/.workbuddy/projects';
const hits = [];
function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith('.jsonl')) scan(p);
  }
}
function scan(p) {
  const lines = fs.readFileSync(p, 'utf8').split('\n');
  lines.forEach((l, i) => {
    if (l.includes(term)) {
      let j = null; try { j = JSON.parse(l); } catch {}
      const text = j && j.content ? JSON.stringify(j.content).slice(0, 120) : l.slice(0, 120);
      hits.push(`${p}#L${i + 1} type=${j ? j.type : '?'} ${text}`);
    }
  });
}
walk(root);
console.log(hits.slice(0, 8).join('\n') || 'NO HITS');
console.log(`total hits: ${hits.length}`);
