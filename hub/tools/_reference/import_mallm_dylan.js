#!/usr/bin/env node
/**
 * import_mallm_dylan.js — MALLM 真实辩论轨迹 + DyLAN 动态智能体网络实验记录 导入。
 * 源：case_library/cloud/academic/hf-data/{debate-mallm, dylan}/
 * 产出：
 *   imp_debate_mallm  —— 3 persona 真实 7 轮辩论（含失败案例），轨迹逐字
 *   imp_dylan_dynamic —— 7 角色动态组网（null 轮 = 智能体剪枝证据），应答矩阵 + 影响力矩阵逐字
 * 用法：node hub/tools/import_mallm_dylan.js [--dry]
 */
const fs = require('fs');
const path = require('path');

const HF = path.resolve(__dirname, '../../../../case_library/cloud/academic/hf-data');
const OUT = path.resolve(__dirname, '../../cases/_reference/mallm');
const DRY = process.argv.includes('--dry');
const indexPath = path.join(OUT, '_index.md');
const indexText = fs.existsSync(indexPath) ? fs.readFileSync(indexPath, 'utf8') : '';
let made = 0;
const slug = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 24) || 'x';

function mkCase(caseId, files, metaDoc = {}) {
  const dir = path.join(OUT, caseId);
  if (fs.existsSync(dir)) { console.log('skip ' + caseId); return false; }
  if (DRY) { console.log('will create ' + caseId); return true; }
  fs.mkdirSync(path.join(dir, 'traces'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'decisions'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'attachments'), { recursive: true });
  (files || []).forEach(([src, dst]) => fs.copyFileSync(src, path.join(dir, 'traces', dst)));
  fs.writeFileSync(path.join(dir, 'meta.md'), metaDoc.meta);
  fs.writeFileSync(path.join(dir, 'agents.md'), metaDoc.agents);
  fs.writeFileSync(path.join(dir, 'groups.md'), metaDoc.groups);
  fs.writeFileSync(path.join(dir, 'docs.md'), metaDoc.docs);
  fs.writeFileSync(path.join(dir, 'process.md'), metaDoc.process);
  fs.writeFileSync(path.join(dir, 'relations.md'), metaDoc.relations);
  fs.writeFileSync(path.join(dir, 'scenarios.md'), metaDoc.scenarios);
  fs.writeFileSync(path.join(dir, 'decisions', metaDoc.decider + '.md'), metaDoc.decisions);
  const row = `| ${caseId} | ${metaDoc.title} | ${caseId}/ |`;
  if (!indexText.includes(row)) {
    let idx = fs.readFileSync(indexPath, 'utf8');
    idx = idx.replace(/(加新案例：)/, row + '\n\n$1');
    fs.writeFileSync(indexPath, idx);
  }
  console.log('created ' + caseId);
  return true;
}

/* ── 1) MALLM DEBATE ─────────────────────────────────────── */
const mallmDir = path.join(HF, 'debate-mallm');
if (fs.existsSync(mallmDir)) {
  const recs = fs.readFileSync(path.join(mallmDir, 'preview-first3-records.jsonl'), 'utf8').split('\n').filter(Boolean)
    .map((l) => { try { return JSON.parse(l); } catch (e) { return null; } }).filter(Boolean);
  if (recs.length) {
    const r0 = recs[0];
    const mem = r0.globalMemory || r0.memory || [];
    const speakerSet = new Set();
    mem.forEach((m) => speakerSet.add((m.role || m.speaker || 'agent') + ''));
    const fail = recs.filter((r) => r.decisionSuccess === false).length;
    mkCase('imp_debate_mallm', [[path.join(mallmDir, 'preview-first3-records.jsonl'), 'preview-first3-records.jsonl']], {
      title: 'MALLM 真实辩论轨迹：3 persona × 共识机制（含失败案例）',
      decider: 'judge',
      meta: `---
hub: "1.0"
kind: meta
case: imp_debate_mallm
source: https://huggingface.co/datasets/Multi-Agent-LLMs/DEBATE preview（脚本 import_mallm_dylan.js 机械导入）
---

# MALLM 真实辩论：多 persona 逐轮辩论 + 一致投票（实测含失败）

Multi-Agent-LLMs (MALLM) 框架的 DEBATE 范式真实运行：3 个 persona 智能体逐轮辩论
（globalMemory 累积 ${mem.length} 条消息，memory_ids 保留发言间的引用图），终轮按共识机制投票。
preview 抽取的 ${recs.length} 条完整轨迹中 ${fail} 条 decisionSuccess=false——真实失败样本。
全部记录逐字在 traces/。speaker 实测：${[...speakerSet].join('、')}。
`,
      agents: `---
hub: "1.0"
kind: agents
case: imp_debate_mallm
---

# @judge [individual] #phase/test #role/orchestrator #group/panel #hub
name: 共识裁判
model: claude-opus-5-5
source_model: llama-3.3-70b（实测）
role: 组织辩论轮次、每轮后检查共识机制（一致/多数/加权）是否达成，产出最终决策
trigger: 收到待决策问题
watches: [persona_a, persona_b, persona_c]

# @persona_a [individual] #phase/debate1 #role/critic #group/panel
name: Persona A（实测身份见 traces）
model: claude-sonnet-5-5
source_model: llama-3.3-70b
role: 持独立 persona 视角参与辩论：读 globalMemory 里同伴发言（memory_ids 引用），给出支持/反对论证
trigger: 辩论轮次开始
watches: []

# @persona_b [individual] #phase/debate1 #role/critic #group/panel
name: Persona B
model: claude-sonnet-5-5
source_model: llama-3.3-70b
role: 同上，第二视角
trigger: 辩论轮次开始
watches: []

# @persona_c [individual] #phase/debate1 #role/critic #group/panel
name: Persona C
model: claude-sonnet-5-5
source_model: llama-3.3-70b
role: 同上，第三视角
trigger: 辩论轮次开始
watches: []
`,
      groups: `---
hub: "1.0"
kind: groups
case: imp_debate_mallm
---

# @panel [group] #level/1
name: 辩论席
members: [judge, persona_a, persona_b, persona_c]
`,
      docs: `---
hub: "1.0"
kind: docs
case: imp_debate_mallm
---

# @d_memory [doc] #layer/consensus
name: globalMemory（辩论黑板）
owner: judge
summary: ${mem.length} 条消息逐字累积，memory_ids 保留引用图——辩论的共享记忆结构
audience: all

# @d_records [doc] #layer/map
name: 轨迹档案
owner: judge
summary: ${recs.length} 条完整辩论记录逐字在 traces/（含 decisionSuccess 与耗时 clockSeconds）
audience: all
`,
      process: `---
hub: "1.0"
kind: process
case: imp_debate_mallm
---

# @s_round [stage] #group/panel
name: 辩论轮（实测 7 轮）
executors: [persona_a, persona_b, persona_c]

# @gt_consensus [gate] #kind/agent
name: 共识达成判定
after_stage: s_round
decider_type: agent
decider_who: judge
paths:
  - condition: 共识机制判定通过（一致/多数投票）
    next: done
  - condition: 未达成
    next: s_round
    note: 实测 ${recs.length} 条中 ${fail} 条最终未通过（decisionSuccess=false）
`,
      relations: `---
hub: "1.0"
kind: relations
case: imp_debate_mallm
---

@persona_a >read @d_memory 发言前读共享记忆
@persona_b >read @d_memory
@persona_c >read @d_memory
`,
      scenarios: `---
hub: "1.0"
kind: scenarios
case: imp_debate_mallm
---

# @K1 [case]
name: 实测成功辩论复跑（decisionSuccess=true）
rework_gate: gt_consensus
rework_times: 1

# @K2 [case]
name: 实测失败复现（decisionSuccess=false）
inject:
  - at: 0.7
    to: judge
    kind: context
    text: 按 traces/ 中失败轨迹的真实过程——persona 各执一词，7 轮后仍未收敛
blocked_at: gt_consensus

never_dispatch: []
@persona_b >undeclared_read @d_records 实测中 persona 会回看历史轮次全文，编排里没有这条线
@ch_sonnet outage at=0.5 dur=0.05 kind=quota
note: sonnet 渠道额度耗尽
version_change at=0.5
note: 失败样本促使共识机制从"一致"放宽为"多数"（MALLM 的 4 机制 × 4 范式实验设计）
`,
      decisions: `---
hub: "1.0"
kind: decisions
case: imp_debate_mallm
agent: judge
---

# @d_1 [decision] #stage/test #kind/deliver #agent/judge
title: 共识标准选"一致"还是"多数"
trigger: 7 轮辩论后 persona 仍有分歧（实测失败案例的真实处境）
alternatives:
  - 坚持一致同意，继续加轮
  - 多数票决定，分歧记入报告
  - 加权投票（按 persona 先验可靠性）
choice: 多数票决定，分歧记入报告
reason: MALLM 的实验设计本身就是 4 种共识机制并行对比——一致机制在 3 persona 下最容易死锁
impact: 实测失败样本即"一致"机制下的产物；多数机制下同批对话可收敛
action: deliver
`,
    }) && made++;
  }
}

/* ── 2) DyLAN ────────────────────────────────────────────── */
const dylanDir = path.join(HF, 'dylan');
if (fs.existsSync(dylanDir)) {
  const mmluFiles = fs.readdirSync(dylanDir).filter((f) => /^mmlu_.*\.json$/.test(f));
  if (mmluFiles.length) {
    const d0 = JSON.parse(fs.readFileSync(path.join(dylanDir, mmluFiles[0]), 'utf8').trim().split('\n')[0]);
    const rounds = Object.keys(d0).filter((k) => /^round/i.test(k)).length || 3;
    const roles = new Set();
    JSON.stringify(d0).replace(/"(economist|doctor|lawyer|mathematician|psychologist|programmer|historian|math_teacher|dietitian|accountant|statistician|sociologist)"/g, (_, r) => { roles.add(r); return _; });
    mkCase('imp_dylan_dynamic', fs.readdirSync(dylanDir).map((f) => [path.join(dylanDir, f), f]), {
      title: 'DyLAN 动态智能体网络：7 角色分层辩论与剪枝实测',
      decider: 'orchestrator',
      meta: `---
hub: "1.0"
kind: meta
case: imp_dylan_dynamic
source: https://github.com/SALT-NLP/DyLAN 官方实验记录（脚本 import_mallm_dylan.js 机械导入）
---

# DyLAN：动态智能体网络的官方实测记录

DyLAN（Dynamic LLM-Agent Network）官方实验数据：MMLU 两科目 7 角色（economist/doctor/lawyer/
mathematician/psychologist/programmer 等）× ${rounds} 轮分层辩论的完整应答矩阵，HumanEval 8 角色编程样本，
以及 agent 影响力矩阵（20×21 txt）。核心机制是**动态剪枝**——按影响力得分每轮淘汰低贡献角色，
应答矩阵里的 null 轮即被剪枝的直接证据。全部记录逐字在 traces/。
`,
      agents: `---
hub: "1.0"
kind: agents
case: imp_dylan_dynamic
---

# @orchestrator [individual] #phase/plan #role/orchestrator #group/core #hub
name: DyLAN 编排者
model: claude-opus-5-5
source_model: gpt-3.5-turbo（实测）
role: 组建初始角色团队、驱动 ${rounds} 层辩论、按影响力矩阵逐层剪枝低贡献角色
trigger: 收到 MMLU/HumanEval 任务
watches: [${[...roles].slice(0, 4).map(slug).join(', ')}]

${[...roles].map((r) => `# @${slug(r)} [individual] #phase/build #role/specialist #group/team
name: ${r}
model: claude-sonnet-5-5
source_model: gpt-3.5-turbo（实测）
role: 领域专家角色参与分层辩论；每轮答案与 null（被剪枝）实测见 traces/ 应答矩阵
trigger: 被编排者选中该层
watches: []

`).join('')}`,
      groups: `---
hub: "1.0"
kind: groups
case: imp_dylan_dynamic
---

# @core [group] #level/1
name: 编排
members: [orchestrator]

# @team [group] #level/1
name: 专家池（可剪枝）
members: [${[...roles].map(slug).join(', ')}]
`,
      docs: `---
hub: "1.0"
kind: docs
case: imp_dylan_dynamic
---

# @d_matrix [doc] #layer/map
name: 应答矩阵与影响力
owner: orchestrator
payload_file: traces/${mmluFiles[0]}
summary: 7 角色 × ${rounds} 轮完整应答矩阵（含 null 剪枝轮）+ agent 影响力矩阵 txt
audience: all
`,
      process: `---
hub: "1.0"
kind: process
case: imp_dylan_dynamic
---

# @s_layer1 [stage] #group/team
name: 第 1 层全员作答
executors: [${[...roles].map(slug).join(', ')}]

# @s_prune [stage] #group/core
name: 影响力评估与剪枝
executors: [orchestrator]

# @s_layer2 [stage] #group/team
name: 第 ${rounds} 层存活角色辩论
executors: [${[...roles].map(slug).slice(0, 3).join(', ')}]

# @gt_majority [gate] #kind/rule
name: 多数票收敛
after_stage: s_layer2
decider_type: rule
text: 存活角色多数票一致即出答案
paths:
  - condition: 收敛
    next: done
  - condition: 未收敛且还有层
    next: s_layer2
    note: 继续剪枝推进
`,
      relations: `---
hub: "1.0"
kind: relations
case: imp_dylan_dynamic
---

@orchestrator >read @d_matrix 剪枝依据影响力矩阵
`,
      scenarios: `---
hub: "1.0"
kind: scenarios
case: imp_dylan_dynamic
---

# @K1 [case]
name: 实测正确路径复跑（官方判分记录在 traces）
rework_gate: gt_majority
rework_times: 1

# @K2 [case]
name: 过度剪枝：关键专家被提前淘汰
inject:
  - at: 0.5
    to: orchestrator
    kind: feedback
    text: 影响力得分把数学家剪掉了，但本题恰恰需要数学推理——null 轮在矩阵里可见
rework_gate: gt_majority
rework_times: 1

never_dispatch: []
@${slug([...roles][0] || 'economist')} >undeclared_read @d_matrix 实测中角色会参考他人历史答案，编排里没有这条线
@ch_sonnet outage at=0.5 dur=0.05 kind=quota
note: sonnet 渠道额度耗尽
version_change at=0.5
note: 剪枝策略从"每轮淘汰"放宽为"隔轮评估"（DyLAN 论文的消融方向）
`,
      decisions: `---
hub: "1.0"
kind: decisions
case: imp_dylan_dynamic
agent: orchestrator
---

# @d_1 [decision] #stage/build #kind/deliver #agent/orchestrator
title: 剪枝按影响力得分还是保留全队
trigger: ${rounds} 层辩论每层的计算成本随角色数线性增长
alternatives:
  - 保留全部 7 角色跑到最后，成本最高但无剪枝风险
  - 每层按影响力矩阵淘汰低分角色
  - 只保留 top-3 固定角色
choice: 每层按影响力矩阵淘汰低分角色
reason: 官方实测（traces/ 应答矩阵）显示剪枝后准确率不降反升——冗余角色反而引入噪声共识
impact: null 轮成为剪枝证据；K2 场景暴露了剪枝误伤领域专家的风险边界
action: deliver
`,
    }) && made++;
  }
}
console.log(`完成：新建 ${made}。校验：node hub/tools/check_from_docs.js`);
