#!/usr/bin/env node
// Research briefs' appendix: for each researcher, the boundary of its area — only the cells still short of their
// theoretical limit ("派研究" in capability-matrix.json), each with where it stops now, the latest evidence of why
// (blackboard), the theoretical limit (CAPABILITY_MAP.md), and who already got through and how. Ordered so that
// units another product already reached come first: the route is known, copy it.
// User 10-19: “主要是指挥他们快速打破能力边界，得让他们看到边界在哪，理论极限是什么，然后去研究。”
//   node channels/probe/scripts/build_briefs.mjs   (after build_coverage.js)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const map = fs.readFileSync(path.join(ROOT, 'channels/probe/CAPABILITY_MAP.md'), 'utf8');
const matrix = JSON.parse(fs.readFileSync(path.join(ROOT, 'channels/probe/capability-matrix.json'), 'utf8'));
const units = JSON.parse(fs.readFileSync(path.join(ROOT, 'hub/data/capability-units.json'), 'utf8')).units;
const rows = fs
  .readFileSync(path.join(ROOT, 'channels/probe/blackboard.jsonl'), 'utf8')
  .split(/\r?\n/)
  .flatMap((l) => {
    try { return l.trim() ? [JSON.parse(l)] : []; } catch { return []; }
  });
const OUT = path.join(ROOT, 'channels/research/briefs');
fs.mkdirSync(OUT, { recursive: true });

// The theoretical-limit paragraph of each unit in CAPABILITY_MAP.md.
const limit = {};
for (const sec of map.split(/\n## /)) {
  const id = /（([\w-]+)）\s*\n/.exec(sec);
  const t = /\*\*理论上限\*\*：([^\n]+)/.exec(sec);
  if (id && t) limit[id[1]] = t[1].trim();
}
// The latest blackboard row that says a family falls short on a unit: why it stops there.
const lastShort = new Map();
for (const r of rows) {
  if (r.family && r.capability && r.result && r.result !== 'pass') lastShort.set(`${r.family}|${r.capability}`, r);
}
const W = { pass: '通', partial: '部分', unverified: '未证实', fail: '不通', desktop: '界面有', fake: '假' };
const PLACES = [['app', '桌面'], ['api', '原生'], ['adapter', '适配'], ['front', '网页']];
const ALL = ['antigravity', 'claude', 'codex', 'zcode', 'workbuddy', 'opencode', 'hermes'];
const short = (s, n) => {
  const t = String(s || '').replace(/\s+/g, ' ').trim();
  return t.length > n ? t.slice(0, n) + '…' : t;
};
const where = (c) => PLACES.map(([L, n]) => `${n}${W[c[L]] || '·'}`).join(' ');
const through = (c) => c.api === 'pass' || c.adapter === 'pass';
const research = (c) => c && String(c.gap || '').startsWith('派研究');

const RESEARCHERS = {
  argon: {
    title: '桌面与界面、Antigravity、高阶能力（打破能力单元边界）、开源对照',
    owns: (u, p) => u.hci || u.scale === '高阶能力' || p === 'antigravity',
  },
  codex: {
    title: 'Codex 与 Claude 两条驱动路线、底座（额度、鉴权、选渠道、健康）',
    owns: (u, p) => !u.hci && u.scale !== '高阶能力' && (p === 'codex' || p === 'claude'),
  },
  zcode: {
    title: 'ACP 常驻桥这一片（ZCode、WorkBuddy、OpenCode、Hermes），兼测试回归',
    owns: (u, p) => !u.hci && u.scale !== '高阶能力' && ['zcode', 'workbuddy', 'opencode', 'hermes'].includes(p),
  },
};

for (const [name, r] of Object.entries(RESEARCHERS)) {
  const items = [];
  for (const u of matrix.units) {
    const stuck = ALL.filter((p) => r.owns(u, p) && research(u.cells[p]));
    if (!stuck.length) continue;
    const done = ALL.filter((p) => u.cells[p] && through(u.cells[p]));
    const tier = done.length ? 0 : limit[u.id] ? 1 : 2;
    items.push({ u, stuck, done, tier });
  }
  items.sort((a, b) => a.tier - b.tier || b.stuck.length - a.stuck.length);
  const cells = items.reduce((n, x) => n + x.stuck.length, 0);
  const TIER = [
    '别家已经打通：路线已知，照着打',
    '没有一家打通，但理论上限推过：按上限找入口，原生没有就按“最多补齐到”去补',
    '理论上限还没推：先推上限再探查',
  ];
  const lines = [
    `# ${name} 的边界清单（自动生成，${matrix.generatedAt.slice(0, 10)}）`,
    '',
    `范围：${r.title}。还没到理论上限的格子共 ${cells} 个，分布在 ${items.length} 个单元。这些就是你这片的边界，你的活是把它往理论上限推。`,
    '',
    '每个单元写了：理论上限（能做到哪、靠什么、根本限制、原生做不到时最多补到哪）；哪几家已经打通、怎么做的；你负责的每家现在卡在哪（四个位置：桌面/原生/适配/网页），以及黑板上最近一条没通的证据。',
    '',
    '顺序是建议，不是规定：别家已打通的排前面（路线已知，最快），同一档里卡住的家数多的排前面。你自己判断先打哪片。',
    '',
    `生成：node channels/probe/scripts/build_briefs.mjs（数据来自 CAPABILITY_MAP.md、capability-matrix.json、blackboard.jsonl）。`,
    '',
  ];
  for (let t = 0; t < 3; t++) {
    const group = items.filter((x) => x.tier === t);
    if (!group.length) continue;
    lines.push(`## ${TIER[t]}（${group.length} 个单元）`, '');
    for (const { u, stuck, done } of group) {
      const def = units.find((x) => x.id === u.id) || {};
      lines.push(`### ${u.name}（${u.id}）· ${u.scale}${u.hci ? ' · 人机交互' : ''}`, '');
      lines.push(`- 怎样算做到：${def.judge || '—'}`);
      lines.push(`- 理论上限：${limit[u.id] || '还没推'}`);
      if (done.length) {
        lines.push(`- 已打通的：${done.map((p) => `${p}（${where(u.cells[p])}；${short(u.cells[p].how, 80) || '见黑板'}）`).join('；')}`);
      }
      lines.push('- 卡着的：');
      for (const p of stuck) {
        const ev = lastShort.get(`${p}|${u.id}`);
        const why = ev ? `；最近证据（${W[ev.result] || ev.result}，${ev.by || '?'}）：${short(ev.evidence, 160)}${ev.condition ? `；条件：${short(ev.condition, 80)}` : ''}` : '；黑板上没有这家这一格的记录';
        lines.push(`  - ${p}：${where(u.cells[p])}${why}`);
      }
      lines.push('');
    }
  }
  fs.writeFileSync(path.join(OUT, `${name}-边界.md`), lines.join('\n'));
  const old = path.join(OUT, `${name}-现状.md`);
  if (fs.existsSync(old)) fs.unlinkSync(old);
  console.log(name, items.length, 'units,', cells, 'cells;', [0, 1, 2].map((t) => items.filter((x) => x.tier === t).length).join('/'), 'by tier');
}
