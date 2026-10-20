#!/usr/bin/env node
// harness: the parts table and the per-product structure, the way capability units and the capability matrix work.
// - hub/data/harness-parts.json is generated from section 3 of the design document 《harness构造_理论框架》 (the one
//   source of the parts; never edit the JSON by hand).
// - channels/research/harness/<product>-structure.json is filled by the researchers: for each part, how this
//   product does it, the evidence and how well it is known. One file per product so researchers do not collide.
// - channels/research/harness/HARNESS_MAP.md is generated from both: product × part, how well each cell is known.
// User 10-20: “后面我们得做harness的标准化理论框架，推理认知结构，然后做成更多的 注册表和结构，可以填进去真实的各家harness结构”.
//   node channels/probe/scripts/build_harness.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const DESIGN = 'E:/program/GIT/Jobs/08_简历设计工作区/02_项目打磨与展示/智能体技术/多智能体协作/harness构造_理论框架_20261020.md';
const PARTS = path.join(ROOT, 'hub', 'data', 'harness-parts.json');
const DIR = path.join(ROOT, 'channels', 'research', 'harness');
const PRODUCTS = ['claude-code', 'codex', 'antigravity', 'zcode', 'workbuddy', 'opencode', 'hermes', 'doubao'];
// How well a cell is known, the same evidence words as the capability units: tried > seen > guessed > unknown.
const LEVELS = { 试过: 3, 看到: 2, 推测: 1, 未知: 0 };

// 1. Parts from the design document's section 3 table (rows: | 部分 | 编号 | 一句话 | 普查里见到的 |).
let parts;
if (fs.existsSync(DESIGN)) {
  const md = fs.readFileSync(DESIGN, 'utf8');
  const sec = md.slice(md.indexOf('## 3.'), md.indexOf('## 4.'));
  let group = '';
  parts = [];
  for (const line of sec.split(/\r?\n/)) {
    const m = /^\|\s*([^|]*?)\s*\|\s*([a-z][a-z0-9-]+)\s*\|\s*([^|]+?)\s*\|\s*([^|]*?)\s*\|$/.exec(line);
    if (!m) continue;
    if (m[1]) group = m[1];
    parts.push({ id: m[2], group, summary: m[3].replace(/^新增：/, ''), added: /^新增：/.test(m[3]), seenIn: m[4] });
  }
  fs.writeFileSync(PARTS, JSON.stringify({ generatedFrom: path.basename(DESIGN), generatedAt: new Date().toISOString(), parts }, null, 2) + '\n');
  console.log(`harness-parts.json: ${parts.length} parts from ${path.basename(DESIGN)}`);
} else {
  parts = JSON.parse(fs.readFileSync(PARTS, 'utf8')).parts;
  console.log(`design document not found; using the existing harness-parts.json (${parts.length} parts)`);
}

// 2. Per-product structure files: create an empty one for each product that has none, with every part listed.
fs.mkdirSync(DIR, { recursive: true });
for (const p of PRODUCTS) {
  const f = path.join(DIR, `${p}-structure.json`);
  if (fs.existsSync(f)) continue;
  const cells = Object.fromEntries(parts.map((x) => [x.id, { how: '', evidence: [], level: '未知' }]));
  fs.writeFileSync(f, JSON.stringify({ product: p, about: '每个构件：how 这家怎么做的；evidence 证据（会话记录种类与条数、代码或打包代码位置、请求样本、实测命令或黑板行号、外部链接）；level 试过 / 看到 / 推测 / 未知。', cells }, null, 2) + '\n');
}

// 3. The map: product × part.
const MARK = { 3: '■ 试过', 2: '◧ 看到', 1: '□ 推测', 0: '·' };
const data = Object.fromEntries(PRODUCTS.map((p) => {
  try { return [p, JSON.parse(fs.readFileSync(path.join(DIR, `${p}-structure.json`), 'utf8')).cells || {}]; } catch { return [p, {}]; }
}));
// 试过 means a command and its result, so a 试过 cell must cite a blackboard row of this product (10-20: of
// Antigravity's 27, most cited only census counts, two cited rows about something else). Those that do not are
// marked ■? and counted, so overclaiming shows for every product without anyone re-reading the files.
const BB = path.join(ROOT, 'channels', 'probe', 'blackboard.jsonl');
const bbRows = fs.existsSync(BB) ? fs.readFileSync(BB, 'utf8').split('\n') : [];
const FAMILY = { 'claude-code': 'claude' };
const backed = (p, c) =>
  (c.evidence || []).some((e) => {
    // Rows are cited as blackboard.jsonl:2388, or 黑板 2356/2357/2363, 黑板行 2290、2291.
    for (const m of String(e).matchAll(/(?:blackboard\.jsonl:|黑板行?\s*)(\d+(?:\s*[\/、,，]\s*\d+)*)/g)) {
      for (const n of m[1].split(/\s*[\/、,，]\s*/)) {
        try {
          if (JSON.parse(bbRows[Number(n) - 1]).family === (FAMILY[p] || p)) return true;
        } catch {}
      }
    }
    return false;
  });
const unbacked = Object.fromEntries(PRODUCTS.map((p) => [p, 0]));
const tried = Object.fromEntries(PRODUCTS.map((p) => [p, 0]));
const lines = [
  '# harness 结构总表（生成）',
  '',
  `生成：node channels/probe/scripts/build_harness.mjs（${new Date().toISOString().slice(0, 10)}）。构件来自设计目录《harness构造_理论框架》第 3 节；每格来自 \`<产品>-structure.json\`。■ 试过、◧ 看到、□ 推测、· 未知。`,
  '',
];
const count = Object.fromEntries(PRODUCTS.map((p) => [p, 0]));
let group = '';
lines.push(`| 构件 | ${PRODUCTS.join(' | ')} |`, `|---|${PRODUCTS.map(() => '---').join('|')}|`);
for (const x of parts) {
  if (x.group !== group) {
    group = x.group;
    lines.push(`| **${group}** |${PRODUCTS.map(() => ' ').join('|')}|`);
  }
  const row = PRODUCTS.map((p) => {
    const c = data[p][x.id];
    const lv = c ? LEVELS[c.level] ?? 0 : 0;
    if (lv >= 2) count[p]++;
    if (lv === 3) {
      tried[p]++;
      if (!backed(p, c)) {
        unbacked[p]++;
        return '■? 试过（没有对得上的实测行）';
      }
    }
    return MARK[lv];
  });
  lines.push(`| ${x.id} | ${row.join(' | ')} |`);
}
lines.push('', `看到及以上的格数：${PRODUCTS.map((p) => `${p} ${count[p]}/${parts.length}`).join('；')}`);
lines.push('', `标“试过”的格里，没有引到这家黑板实测行的（■?，要么补实测、要么降到看到）：${PRODUCTS.map((p) => `${p} ${unbacked[p]}/${tried[p]}`).join('；')}`);
fs.writeFileSync(path.join(DIR, 'HARNESS_MAP.md'), lines.join('\n') + '\n');
console.log('HARNESS_MAP.md:', PRODUCTS.map((p) => `${p} ${count[p]}`).join(' '));
