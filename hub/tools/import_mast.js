#!/usr/bin/env node
/**
 * import_mast.js — MAST-clean 真实轨迹按框架分组导入为 hub 文档案例。
 *
 * 数据源：case_library/cloud/academic/hf-data/mascope/MAST-clean.jsonl（851 条真实多智能体执行轨迹，
 * 含任务、框架、拓扑类别、LLM、逐字轨迹全文、14 类协作失败标注）。
 *
 * 产出（每个框架一个案例）：imp_mast_<framework>/
 *   - 参与者从轨迹日志的 "FROM: X" 实际解析（解析失败回退框架默认角色）
 *   - 轨迹原文逐字进 traces/（PROPOSAL_lossless_adapter.md 提案 B 批准后经 index.json 进模型）
 *   - 失败标注 → scenarios 的 K 场景（标注码保留原文）
 *
 * 用法：
 *   node hub/tools/import_mast.js                     # 每框架抽 4 条，最多 6 个框架
 *   node hub/tools/import_mast.js --per 8 --frameworks MetaGPT,ChatDev
 *   node hub/tools/import_mast.js --dry
 */
const fs = require('fs');
const path = require('path');

const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const has = (k) => argv.includes('--' + k);

const SRC = arg('src', path.resolve(__dirname, '../../../case_library/cloud/academic/hf-data/mascope/MAST-clean.jsonl'));
const OUT = arg('out', path.resolve(__dirname, '../cases_imported'));
const PER = parseInt(arg('per', '4'), 10);
const FRAMES = arg('frameworks', null);
const MAXF = parseInt(arg('max-frameworks', '6'), 10);
const TAG = arg('tag', '');      // 案例前缀标识源：--tag lg → imp_mastlg_<frame>；默认空 → imp_mast_<frame>
const DRY = has('dry');

/* MAST 失败分类码 → 中文标签（MAST: A Taxonomy of Failure Modes in Multi-Agent Systems） */
const MAST = {
  '1.1': '任务说明不完整', '1.2': '任务说明不可行', '1.3': '任务说明有歧义', '1.4': '任务说明自相矛盾', '1.5': '缺少任务说明',
  '2.1': '互相矛盾的目标', '2.2': '信息未共享', '2.3': '忽略了其他智能体的输入', '2.4': '推理/行动脱离上下文', '2.5': '重复动作', '2.6': '角色越界',
  '3.1': '过早停止', '3.2': '验证不充分', '3.3': '错误/不完整验证',
};

const DEFAULT_ROLES = {
  MetaGPT: ['product_manager', 'architect', 'engineer', 'qa'],
  ChatDev: ['ceo', 'cto', 'programmer', 'tester'],
  Magentic: ['orchestrator', 'websurfer', 'coder', 'terminal'],
  MagenticOne: ['orchestrator', 'websurfer', 'coder', 'terminal'],
  AutoGen: ['planner', 'assistant_1', 'assistant_2', 'executor'],
  LangGraph: ['supervisor', 'worker_1', 'worker_2'],
  CAMEL: ['task_specifier', 'ai_user', 'ai_assistant'],
};

const oneLine = (s) => String(s || '').replace(/\s+/g, ' ').trim();
const slug = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 24) || 'agent';

if (!fs.existsSync(SRC)) { console.error('数据源不存在: ' + SRC); process.exit(2); }

/* 读全量，按框架分桶 */
const records = fs.readFileSync(SRC, 'utf8').split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch (e) { return null; } }).filter(Boolean);
const byFrame = {};
records.forEach((r) => { const f = slug(r.framework || 'unknown'); (byFrame[f] = byFrame[f] || []).push(r); });
const frames = Object.keys(byFrame).sort().slice(0, MAXF);
console.log(`源 ${records.length} 条轨迹，${Object.keys(byFrame).length} 个框架，取前 ${frames.length} 个：${frames.join(', ')}`);

const indexPath = path.join(OUT, '_index.md');
const indexText = fs.existsSync(indexPath) ? fs.readFileSync(indexPath, 'utf8') : '';
let made = 0;

for (const frame of frames) {
  if (FRAMES && !FRAMES.split(',').map((x) => slug(x)).includes(frame)) continue;
  const caseId = 'imp_mast' + (TAG ? '_' + TAG : '') + '_' + frame;
  const dir = path.join(OUT, caseId);
  const existingTraces = fs.existsSync(path.join(dir, 'traces'))
    ? fs.readdirSync(path.join(dir, 'traces')).filter((f) => f.endsWith('.json') && f !== 'index.json').length
    : 0;
  if (indexText.includes('| ' + caseId + ' ') && existingTraces >= PER) { console.log('skip ' + caseId); continue; }
  const sample = byFrame[frame].slice(0, PER);
  if (!sample.length) { console.log('skip ' + caseId + ' (no records)'); continue; }
  const meta0 = sample[0];

  /* 参与者：优先从轨迹日志实际解析 FROM 名字 */
  const fromNames = new Set();
  sample.forEach((r) => {
    const m = String(r.trajectory || '').matchAll(/FROM:\s*([A-Za-z][A-Za-z0-9_ .-]{1,40})/g);
    for (const x of m) { const n = x[1].trim(); if (n && !/^(Human|user|<all>|System)$/i.test(n)) fromNames.add(n); }
  });
  let roleIds = [...fromNames].slice(0, 6).map(slug);
  let rolesSrc = '从轨迹日志 FROM 字段实际解析';
  if (roleIds.length < 2) { roleIds = DEFAULT_ROLES[meta0.framework] || ['planner', 'worker_1', 'reviewer']; rolesSrc = '框架默认角色（日志解析不足）'; }
  if (roleIds.length < 2) roleIds.push('executor');

  /* 注码统计（该框架样本内出现过哪些失败类别） */
  const codeCount = {};
  sample.forEach((r) => Object.entries(r.mast_annotation || {}).forEach(([c, v]) => { if (v) codeCount[c] = (codeCount[c] || 0) + 1; }));
  const topCodes = Object.entries(codeCount).sort((a, b) => b[1] - a[1]);

  if (DRY) { console.log(`will create ${caseId}  (${sample.length} 条轨迹, 角色: ${roleIds.join('/')})`); made++; continue; }

  fs.mkdirSync(path.join(dir, 'traces'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'decisions'), { recursive: true });

  /* traces/：记录原文逐字落盘 + index.json */
  const traceFiles = [];
  sample.forEach((r, i) => {
    const fn = `trace_${String(i + 1).padStart(2, '0')}.json`;
    fs.writeFileSync(path.join(dir, 'traces', fn), JSON.stringify(r, null, 1));
    traceFiles.push(fn);
  });
  fs.writeFileSync(path.join(dir, 'traces', 'index.json'), JSON.stringify({ files: traceFiles, note: '提案 B 批准后由 from-docs 装载进 model.sourceTraces' }, null, 2));

  /* meta.md */
  const topoSet = [...new Set(sample.map((r) => r.guo_topology).filter(Boolean))];
  const llmSet = [...new Set(sample.map((r) => r.llm_name).filter(Boolean))];
  fs.writeFileSync(path.join(dir, 'meta.md'), `---
hub: "1.0"
kind: meta
case: ${caseId}
source: https://huggingface.co/datasets/mascope/mascope-bench MAST-clean 子集（脚本 import_mast.js 机械导入）
---

# MAST 真实轨迹语料：${meta0.framework}（${sample.length} 条实测执行）

来自 MAST/MAScope 数据集的 ${meta0.framework} 框架真实运行轨迹：benchmark ${[...new Set(sample.map((r) => r.benchmark_name))].join('、')}，
基础模型 ${llmSet.join('、')}，拓扑类别 ${topoSet.join('、')}。每条轨迹含逐字通信日志（FROM/TO/ACTION/CONTENT）、
任务与 14 类协作失败标注（MAST taxonomy）。参与者角色${rolesSrc}。
轨迹原文全部保存在 traces/ 目录，本文档案例的结构视图只做导航，不做改写。
标注汇总：${topCodes.length ? topCodes.map(([c, n]) => `${c}(${MAST[c] || '未知'})×${n}`).join('，') : '样本内无失败标注'}
`);

  /* agents.md */
  let ag = `---
hub: "1.0"
kind: agents
case: ${caseId}
---

# @hub_agent [individual] #phase/plan #role/orchestrator #group/core #hub
name: ${meta0.framework} 主控
model: claude-opus-5-5
source_model: ${llmSet[0] || '未知'}
role: 该框架在实测运行中的主控/入口角色，接收任务并驱动协作；轨迹里的具体行为见 traces/ 原文
trigger: benchmark 任务下发
watches: [${roleIds.join(', ')}]

`;
  roleIds.forEach((rid, i) => {
    ag += `# @${rid} [individual] #phase/build #role/executor #group/team
name: ${[...fromNames][i] || rid}
model: claude-sonnet-5-5
source_model: ${llmSet[0] || '未知'}
role: 实测运行中的参与者（${rolesSrc}），其真实发言、工具调用与错误都在 traces/trace_*.json 里逐字保留
trigger: 被主控或流程调度
watches: []

`;
  });
  fs.writeFileSync(path.join(dir, 'agents.md'), ag);

  /* groups.md */
  fs.writeFileSync(path.join(dir, 'groups.md'), `---
hub: "1.0"
kind: groups
case: ${caseId}
---

# @core [group] #level/1
name: 主控
members: [hub_agent]

# @team [group] #level/1
name: 参与者（实测）
members: [${roleIds.join(', ')}]
`);

  /* docs.md */
  fs.writeFileSync(path.join(dir, 'docs.md'), `---
hub: "1.0"
kind: docs
case: ${caseId}
---

# @d_task [doc] #layer/consensus
name: benchmark 任务
owner: hub_agent
summary: ${oneLine(meta0.task_description).slice(0, 120) || meta0.task_id || 'benchmark 任务描述'}
audience: all

# @d_traces [doc] #layer/map
name: 实测轨迹索引
owner: hub_agent
summary: traces/ 目录共 ${traceFiles.length} 条逐字轨迹（${traceFiles.join('、')}），含通信日志与失败标注；提案 B 批准后进 model.sourceTraces
audience: all
`);

  /* process.md：按拓扑类别给通用阶段 */
  const topo = meta0.guo_topology || '';
  const stages = /central|shared|pool/i.test(topo)
    ? [['s_share', '共享消息池协作'], ['s_work', '并行执行'], ['s_finish', '收尾']]
    : /layer| hierarch/i.test(topo)
      ? [['s_plan', '规划'], ['s_delegate', '逐层委派'], ['s_finish', '收尾']]
      : [['s_plan', '规划'], ['s_work', '执行'], ['s_verify', '验证与收尾']];
  fs.writeFileSync(path.join(dir, 'process.md'), `---
hub: "1.0"
kind: process
case: ${caseId}
---

${stages.map(([id, name]) => `# @${id} [stage] #group/${id === 's_plan' ? 'core' : 'team'}
name: ${name}（拓扑类别：${topo}）
executors: [${id === 's_plan' ? 'hub_agent' : roleIds.slice(0, 3).join(', ') || 'hub_agent'}]

`).join('')}# @gt_mast [gate] #kind/rule
name: MAST 标注判定
after_stage: ${stages[stages.length - 1][0]}
decider_type: rule
text: 本条轨迹的 mast_annotation 全零（无协作失败）视为通过
paths:
  - condition: 标注全零，任务按 benchmark 判定成功
    next: done
  - condition: 存在失败标注（2.x 信息未共享/忽略输入等）
    next: s_work
    note: 失败归因见 traces/ 原文与标注
`);

  /* relations.md */
  fs.writeFileSync(path.join(dir, 'relations.md'), `---
hub: "1.0"
kind: relations
case: ${caseId}
---

${roleIds.map((r) => `@hub_agent >watch @${r} 实测调度关系见轨迹原文`).join('\n')}
@hub_agent >read @d_traces 复盘时逐条核对轨迹
`);

  /* scenarios.md：K1 取标注全零的记录，K2/K3 取有标注的 */
  const clean = sample.find((r) => Object.values(r.mast_annotation || {}).every((v) => !v)) || sample[0];
  const bad = sample.filter((r) => Object.values(r.mast_annotation || {}).some((v) => v)).slice(0, 2);
  const codesOf = (r) => Object.entries(r.mast_annotation || {}).filter(([, v]) => v).map(([c]) => `${c} ${MAST[c] || ''}`.trim()).join('、');
  fs.writeFileSync(path.join(dir, 'scenarios.md'), `---
hub: "1.0"
kind: scenarios
case: ${caseId}
---

# @K1 [case]
name: 实测复跑（轨迹 trace_01：${codesOf(clean) || '无失败标注'}）
rework_gate: gt_mast
rework_times: 1

${bad.map((r, i) => `# @K${i + 2} [case]
name: 实测失败复现（${r.trace_id || 'trace'}：${codesOf(r) || '有标注'}）
inject:
  - at: 0.55
    to: ${roleIds[0] || 'hub_agent'}
    kind: context
    text: 按 MAST 标注 ${codesOf(r)} 注入同类协作失败，对照 trace_0${i + 2} 的真实发生过程
rework_gate: gt_mast
rework_times: 1

`).join('') || ''}never_dispatch: []
@${roleIds[0] || 'hub_agent'} >undeclared_read @d_traces 实测中参与者直接翻看了历史轨迹，编排里没有这条线
@ch_sonnet outage at=0.6 dur=0.05 kind=quota
note: sonnet 渠道额度耗尽
version_change at=0.5
note: 依据 ${topCodes.length ? topCodes[0][0] : '2.2'} 类失败的出现频率，主控开始要求每轮结束互相同步关键结论
`);

  /* decisions：从最高频失败码生成复盘决策 */
  const code0 = topCodes[0] ? topCodes[0][0] : '2.2';
  fs.writeFileSync(path.join(dir, 'decisions', 'hub_agent.md'), `---
hub: "1.0"
kind: decisions
case: ${caseId}
agent: hub_agent
---

# @d_1 [decision] #stage/build #kind/deliver #agent/hub_agent
title: 针对 ${code0}（${MAST[code0] || '协作失败'}）的流程改进
trigger: 实测轨迹里 ${code0} 类失败出现 ${topCodes[0] ? topCodes[0][1] : 1} 次（MAST 标注）
alternatives:
  - 在每阶段出口加显式核对步骤（信息/输入确认）
  - 缩短委派链，减少传递层数
  - 维持现状，靠最终验证兜底
choice: 在每阶段出口加显式核对步骤（信息/输入确认）
reason: ${MAST[code0] || '该类失败'}属过程性缺陷，出口核对比事后兜底更能阻断传播；依据 traces/ 里失败发生的实际位置
impact: 对应 version_change 引入的同步要求；重跑后以 MAST 标注是否清零检验
action: deliver
`);

  made++;
  console.log(`created ${caseId}  (${sample.length} 条轨迹, 角色: ${roleIds.join('/')})`);
}

if (!DRY && made) {
  let idx = indexText;
  for (const frame of frames) {
    const caseId = 'imp_mast' + (TAG ? '_' + TAG : '') + '_' + frame;
    const sample = byFrame[frame][0];
    const row = `| ${caseId} | MAST${TAG ? '·' + TAG.toUpperCase() : ''} 真实轨迹语料：${sample.framework} | ${caseId}/ |`;
    if (fs.existsSync(path.join(OUT, caseId)) && !idx.includes(row)) idx = idx.replace(/(加新案例：)/, row + '\n\n$1');
  }
  fs.writeFileSync(indexPath, idx);
}
console.log(`完成：新建 ${made}。校验：node hub/tools/check_from_docs.js`);
