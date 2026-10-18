// Generates hub/data/capability-units.json from section 3 of the capability-unit register
// (能力单元登记表, the source of truth in the design-doc directory). Never edit the JSON by hand.
// Usage: node channels/probe/scripts/build_units.js [path-to-register.md]
const fs = require('fs');
const path = require('path');

const DEFAULT_SRC =
  'E:\\program\\GIT\\Jobs\\08_简历设计工作区\\02_项目打磨与展示\\智能体技术\\多智能体协作\\能力单元登记表_20261017.md';
const src = process.argv[2] || DEFAULT_SRC;
const OUT = path.resolve(__dirname, '..', '..', '..', 'hub', 'data', 'capability-units.json');

const md = fs.readFileSync(src, 'utf8');
const start = md.indexOf('## 3. 单元清单');
const end = md.indexOf('\n## ', start + 1);
if (start < 0) throw new Error('section 3 not found in ' + src);
const rows = md
  .slice(start, end < 0 ? undefined : end)
  .split(/\r?\n/)
  .filter((l) => /^\|\s*[a-z][\w-]*\s*\|/.test(l))
  // The table's own header row ("| id | 名称 | …") also starts with a lower-case word.
  .filter((l) => !/^\|\s*id\s*\|/.test(l));
const units = rows.map((l) => {
  const c = l.split('|').slice(1, -1).map((s) => s.trim());
  const [id, name, category, bitmap, definition, judge, source] = c;
  return { id, name, category, bitmap: bitmap || null, definition, judge, source };
});
const ids = new Set();
for (const u of units) {
  if (ids.has(u.id)) throw new Error('duplicate id ' + u.id);
  ids.add(u.id);
}

fs.writeFileSync(
  OUT,
  JSON.stringify({ generatedFrom: path.basename(src), generatedAt: new Date().toISOString(), units }, null, 1) + '\n',
  'utf8',
);
console.log(`${path.relative(process.cwd(), OUT)}: ${units.length} units`);
