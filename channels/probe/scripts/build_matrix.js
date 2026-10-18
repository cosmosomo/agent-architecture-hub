// Builds channels/probe/MATRIX.md from channels/probe/blackboard.jsonl. Never edit MATRIX.md by hand.
// Usage: node channels/probe/scripts/build_matrix.js
const fs = require('fs');
const path = require('path');

const dir = path.resolve(__dirname, '..');
const { CAPS, LAYERS, readRows } = require('./blackboard_lib');
const MARK = { pass: '✅', fail: '❌', partial: '◐', 'n/a': '—', unverified: '❓' };
const { rows, bad } = readRows();

const clip = (s, n) => String(s ?? '').replace(/\s+/g, ' ').replace(/\|/g, '\\|').slice(0, n);
const families = [...new Set(rows.map((r) => r.family))].sort();
const out = [
  '# 实测矩阵（由黑板生成，勿手改）',
  '',
  `生成时间：${new Date().toISOString()}。来源：\`blackboard.jsonl\`，共 ${rows.length} 条${bad.length ? `；无法解析的行：${bad.join(', ')}` : ''}。重新生成：\`node channels/probe/scripts/build_matrix.js\`。`,
  '',
  '图例：✅ 通　❌ 断　◐ 部分通　— 不适用　❓ 未验证（只有声明或描述，没有原始输出）　⚠ 同一格有互相矛盾的记录（以最新一条显示）　空白＝还没测。格子里的数字是黑板行号。',
  '',
];

for (const fam of families) {
  const fr = rows.filter((r) => r.family === fam);
  const cols = [...new Map(fr.map((r) => [`${r.layer}|${r.route}`, r])).values()].sort(
    (a, b) => LAYERS.indexOf(a.layer) - LAYERS.indexOf(b.layer) || String(a.route).localeCompare(String(b.route)),
  );
  out.push(`## ${fam}`, '');
  out.push('列：', '');
  cols.forEach((c, i) => out.push(`- **C${i + 1}** ${c.layer} · ${c.surface || '?'} · ${clip(c.route, 140)}`));
  out.push('', `| 能力 | ${cols.map((_, i) => `C${i + 1}`).join(' | ')} |`, `|---|${cols.map(() => '---').join('|')}|`);
  const caps = [...CAPS, ...new Set(fr.map((r) => r.capability).filter((c) => !CAPS.includes(c)))];
  for (const cap of caps) {
    const cells = cols.map((c) => {
      const hits = fr.filter((r) => r.capability === cap && r.layer === c.layer && r.route === c.route);
      if (!hits.length) return '';
      const last = hits[hits.length - 1];
      const conflict = new Set(hits.map((h) => h.result)).size > 1 ? '⚠' : '';
      return `${MARK[last.result] || last.result}${conflict} ${last._line}`;
    });
    if (cells.some(Boolean)) out.push(`| ${cap} | ${cells.join(' | ')} |`);
  }
  const broken = fr.filter((r) => r.result === 'fail' || r.result === 'partial' || r.result === 'unverified');
  if (broken.length) {
    out.push('', '断点与条件：', '');
    for (const r of broken) {
      out.push(`- 行 ${r._line} · ${r.capability} · ${r.layer} ${clip(r.route, 60)} · ${MARK[r.result]} 条件：${clip(r.condition, 80)}。${clip(r.note, 160)}`);
    }
  }
  out.push('');
}

// Retest list: cells whose latest record is still unverified. Feed this section to the next verifier.
const latest = new Map();
for (const r of rows) latest.set(`${r.family}|${r.layer}|${r.route}|${r.capability}`, r);
const todo = [...latest.values()].filter((r) => r.result === 'unverified');
out.push('## 待复测（最新结论仍是“未验证”的格子）', '');
if (!todo.length) out.push('无。');
for (const fam of [...new Set(todo.map((r) => r.family))].sort()) {
  out.push(`- **${fam}**：${todo.filter((r) => r.family === fam).map((r) => `${r.route} · ${r.capability}（行 ${r._line}）`).join('；')}`);
}
out.push('');

fs.writeFileSync(path.join(dir, 'MATRIX.md'), out.join('\n'), 'utf8');
console.log(`MATRIX.md: ${families.length} families, ${rows.length} rows${bad.length ? `, ${bad.length} bad lines` : ''}`);
