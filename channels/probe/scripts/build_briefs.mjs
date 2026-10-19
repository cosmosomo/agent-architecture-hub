#!/usr/bin/env node
// Research briefs' appendix: for each researcher, the units in its area with their definition, judge, theoretical
// limit (CAPABILITY_MAP.md) and where each product stands now (capability-matrix.json). Regenerate after build_coverage.
//   node channels/probe/scripts/build_briefs.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const map = fs.readFileSync(path.join(ROOT, 'channels/probe/CAPABILITY_MAP.md'), 'utf8');
const matrix = JSON.parse(fs.readFileSync(path.join(ROOT, 'channels/probe/capability-matrix.json'), 'utf8'));
const units = JSON.parse(fs.readFileSync(path.join(ROOT, 'hub/data/capability-units.json'), 'utf8')).units;
const OUT = path.join(ROOT, 'channels/research/briefs');
fs.mkdirSync(OUT, { recursive: true });

// The theoretical-limit paragraph of each unit in CAPABILITY_MAP.md.
const limit = {};
for (const sec of map.split(/\n## /)) {
  const id = /（([\w-]+)）\s*\n/.exec(sec);
  const t = /\*\*理论上限\*\*：([^\n]+)/.exec(sec);
  if (id && t) limit[id[1]] = t[1].trim();
}
const W = { pass: '通', partial: '部分', unverified: '未证实', fail: '不通', desktop: '界面有', fake: '假' };
const cell = (c) => ['app', 'api', 'adapter', 'front'].map((L) => W[c[L]] || '·').join('/');

const RESEARCHERS = {
  argon: {
    title: '桌面与界面、Antigravity、打破能力单元边界、开源对照',
    products: ['antigravity', 'claude', 'codex', 'zcode', 'workbuddy', 'opencode', 'hermes'],
    pick: (u) => u.scale === '高阶能力' || u.hci || u.id === 'app-sync' || u.id === 'handover-human' || matrix.products.some((p) => /派研究/.test(u.cells[p].gap)),
  },
  codex: {
    title: 'Codex 与 Claude 两条驱动路线、底座（额度、鉴权、选渠道、健康）',
    products: ['codex', 'claude'],
    pick: (u) => !u.hci && (u.scale === '底座' || ['codex', 'claude'].some((p) => u.cells[p].api !== 'pass' || u.cells[p].adapter !== 'pass')),
  },
  zcode: {
    title: 'ACP 常驻桥这一片（ZCode、WorkBuddy、OpenCode、Hermes），兼测试回归',
    products: ['zcode', 'workbuddy', 'opencode', 'hermes'],
    pick: (u) => !u.hci && ['zcode', 'workbuddy', 'opencode', 'hermes'].some((p) => u.cells[p].api !== 'pass' || u.cells[p].adapter !== 'pass'),
  },
};

for (const [name, r] of Object.entries(RESEARCHERS)) {
  const mine = matrix.units.filter(r.pick);
  const lines = [
    `# ${name} 的范围：现状和理论极限（自动生成，${matrix.generatedAt.slice(0, 10)}）`,
    '',
    `范围：${r.title}。共 ${mine.length} 个单元。每格四个位置依次是 桌面端界面/原生接口/适配器与后端/网页；· 是没有记录。`,
    `生成：node channels/probe/scripts/build_briefs.mjs（数据来自 channels/probe/CAPABILITY_MAP.md 和 capability-matrix.json）。`,
    '',
  ];
  for (const s of [...new Set(mine.map((u) => u.scale))]) {
    lines.push(`## ${s}`, '');
    for (const u of mine.filter((x) => x.scale === s)) {
      const def = units.find((x) => x.id === u.id) || {};
      lines.push(`### ${u.name}（${u.id}）`, '');
      lines.push(`- 做什么：${def.definition || '—'}；怎样算做到：${def.judge || '—'}`);
      lines.push(`- 理论上限：${limit[u.id] || '还没推'}`);
      lines.push(`- 现状：${r.products.map((p) => `${p} ${cell(u.cells[p])}`).join('；')}`);
      lines.push('');
    }
  }
  fs.writeFileSync(path.join(OUT, `${name}-现状.md`), lines.join('\n'));
  console.log(name, mine.length, 'units');
}
