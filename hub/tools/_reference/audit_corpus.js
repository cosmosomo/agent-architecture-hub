#!/usr/bin/env node
/**
 * audit_corpus.js — 案例库质量审计：全量扫描导入案例的规模与覆盖分布，
 * 找出薄弱案例（角色过少 / 无关卡 / 无决策 / 无 trace 附件），指导后续增强。
 * 用法：node hub/tools/_reference/audit_corpus.js
 */
const fs = require('fs');
const path = require('path');

const { findCases } = require('../load.js');
const BASE = path.resolve(__dirname, '../../cases/_reference');
const dirs = findCases(BASE, { shelved: true }).sort((a, b) => (a.id < b.id ? -1 : 1));

const stats = { agents: {}, stages: {}, gates: {}, decisions: {}, hasTraces: 0, hasPromptFiles: 0, hasPayload: 0 };
const weak = [];
let n = 0;

for (const c of dirs) {
  const d = c.id, dir = c.dir;
  n++;
  const rd = (f) => (fs.existsSync(path.join(dir, f)) ? fs.readFileSync(path.join(dir, f), 'utf8') : '');
  if (!rd('agents.md') || !rd('process.md')) { weak.push(d + ': 文件不全（转换中？）'); continue; }
  const ag = rd('agents.md');
  const pr = rd('process.md');
  const dcDir = path.join(dir, 'decisions');
  const dc = fs.existsSync(dcDir) ? fs.readdirSync(dcDir).filter((f) => f.endsWith('.md')) : [];
  const dcText = dc.map((f) => fs.readFileSync(path.join(dcDir, f), 'utf8')).join('');
  const hasTraces = fs.existsSync(path.join(dir, 'traces'));
  const hasPrompt = /prompt_file:/.test(ag);
  const hasPayload = /payload_file:/.test(rd('docs.md'));

  const nAgents = (ag.match(/^\# @/gm) || []).length;
  const nStages = (pr.match(/\[stage\]/g) || []).length;
  const nGates = (pr.match(/\[gate\]/g) || []).length;
  const nDec = (dcText.match(/^\# @/gm) || []).length;

  stats.agents[nAgents] = (stats.agents[nAgents] || 0) + 1;
  stats.stages[nStages] = (stats.stages[nStages] || 0) + 1;
  stats.gates[nGates] = (stats.gates[nGates] || 0) + 1;
  stats.decisions[nDec] = (stats.decisions[nDec] || 0) + 1;
  if (hasTraces) stats.hasTraces++;
  if (hasPrompt) stats.hasPromptFiles++;
  if (hasPayload) stats.hasPayload++;

  const problems = [];
  if (nAgents < 3) problems.push(`仅${nAgents}角色`);
  if (nGates === 0) problems.push('无关卡');
  if (nDec < 2) problems.push(`仅${nDec}决策`);
  if (!hasTraces && !hasPrompt && !hasPayload) problems.push('无任何逐字档案');
  if (problems.length) weak.push(`${d}: ${problems.join('、')}`);
}

const dist = (m) => Object.entries(m).sort((a, b) => a[0] - b[0]).map(([k, v]) => `${k}:${v}`).join('  ');
console.log(`案例总数 ${n}`);
console.log('角色数分布   ', dist(stats.agents));
console.log('阶段数分布   ', dist(stats.stages));
console.log('关卡数分布   ', dist(stats.gates));
console.log('决策文件分布 ', dist(stats.decisions));
console.log(`有 traces/ 的案例 ${stats.hasTraces}；有 prompt_file 的 ${stats.hasPromptFiles}；有 payload_file 的 ${stats.hasPayload}`);
console.log(`\n薄弱案例 ${weak.length} 个：`);
weak.slice(0, 30).forEach((w) => console.log('  ' + w));
if (weak.length > 30) console.log(`  …（其余 ${weak.length - 30} 个略）`);
