#!/usr/bin/env node
/**
 * import_acb.js — AgentCollabBench 任务批量导入为 hub 文档案例（无损附件版）。
 *
 * 只写新目录 + 追加 cases_imported/_index.md 行，不改解析器、不碰已有案例。
 * 无损保留：每个 agent 的原始 system_prompt 逐字存 attachments/ 并以 prompt_file: 引用
 * （PROPOSAL_lossless_adapter.md 提案 A 批准后自动逐字进模型）；
 * 完整任务 JSON 存 attachments/task.json。
 *
 * 用法：
 *   node hub/tools/import_acb.js                          # 每拓扑抽 2 个任务（默认）
 *   node hub/tools/import_acb.js --sample 5               # 每拓扑抽 5 个
 *   node hub/tools/import_acb.js --topology star          # 只导指定拓扑
 *   node hub/tools/import_acb.js --dry                    # 只打印计划不写文件
 */
const fs = require('fs');
const path = require('path');

const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const has = (k) => argv.includes('--' + k);

const SRC = arg('src', path.resolve(__dirname, '../../../../case_library/cloud/academic/AgentCollabBench/tasks'));
const OUT = arg('out', path.resolve(__dirname, '../../cases/_reference/agentcollabbench'));
const SAMPLE = parseInt(arg('sample', '2'), 10);
const TOPO = arg('topology', null);
const DRY = has('dry');

const TOPO_SHORT = { linear_chain: 'lin', fully_connected: 'full', custom_graph: 'graph', converging_dag: 'dag', branching_tree: 'tree' };
const oneLine = (s) => String(s || '').replace(/\s+/g, ' ').trim();
const slug = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 28) || 'agent';

if (!fs.existsSync(SRC)) { console.error('任务目录不存在: ' + SRC); process.exit(2); }

const files = fs.readdirSync(SRC).filter((f) => f.endsWith('.json')).sort();
const byTopo = {};
const ordinal = {};   // task_id → 拓扑内确定性序号（跨运行稳定）
const parsed = [];
for (const f of files) {
  try {
    const j = JSON.parse(fs.readFileSync(path.join(SRC, f), 'utf8'));
    const t = (j.topology && j.topology.type) || 'unknown';
    if (TOPO && t !== TOPO) continue;
    parsed.push({ file: f, j, topo: t });
    (byTopo[t] = byTopo[t] || []).push(j); ordinal[j.task_id] = byTopo[t].length;
  } catch (e) { console.error('跳过坏文件 ' + f + ': ' + e.message); }
}
const chosen = [];
for (const [topo, list] of Object.entries(byTopo).sort()) {
  list.slice(0, SAMPLE).forEach((j) => chosen.push({ j, topo }));
}
console.log(`源 ${files.length} 任务，选中 ${chosen.length} 个（每拓扑 ${SAMPLE}）` + (DRY ? ' [dry]' : ''));

const indexPath = path.join(OUT, '_index.md');
const indexText = fs.existsSync(indexPath) ? fs.readFileSync(indexPath, 'utf8') : '';
let made = 0, skipped = 0;
const indexRows = [];

for (const { j, topo } of chosen) {
  const short = TOPO_SHORT[topo] || slug(topo).slice(0, 5);
  const caseId = `imp_acb_${short}_${String(ordinal[j.task_id]).padStart(3, '0')}`;
  indexRows.push(`| ${caseId} | AgentCollabBench ${topo}·${j.domain} | ${caseId}/ |`);
  const dir = path.join(OUT, caseId.split('_')[2], caseId);
  if (fs.existsSync(dir)) { skipped++; continue; }   // 目录在即跳过；索引行由末尾追加逻辑去重
  if (DRY) { console.log(`will create ${caseId}  (${j.task_id}, ${topo})`); made++; continue; }

  const agents = (j.topology && j.topology.agents) || [];
  const edges = (j.topology && j.topology.edges) || [];
  const order = (j.topology && j.topology.speaking_order) || agents.map((a) => a.agent_id);
  const byId = {};
  const mc = j.injections && Object.values(j.injections).find((x) => x && x.multi_constraint);
  agents.forEach((a) => { byId[a.agent_id] = a; });

  const aid = (raw) => 'a' + String(raw).replace(/^A/i, '') + '_' + slug(byId[raw] && byId[raw].role);
  const modelFor = (i) => (i === 0 ? 'claude-opus-5-5' : 'claude-sonnet-5-5');

  fs.mkdirSync(path.join(dir, 'attachments'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'decisions'), { recursive: true });

  /* attachments：任务 JSON 与各 agent 提示词逐字落盘 */
  fs.writeFileSync(path.join(dir, 'attachments', 'task.json'), JSON.stringify(j, null, 2));
  agents.forEach((a) => {
    fs.writeFileSync(path.join(dir, 'attachments', `agent_${a.agent_id}_prompt.md`),
      `# 原始 system prompt（${a.agent_id} / ${a.role}）\n\n${a.system_prompt || ''}\n`);
  });

  /* meta.md */
  fs.writeFileSync(path.join(dir, 'meta.md'), `---
hub: "1.0"
kind: meta
case: ${caseId}
source: https://github.com/aritra741/AgentCollabBench tasks/${j.task_id}.json（脚本 import_acb.js 机械导入）
---

# AgentCollabBench ${topo}：${j.domain} 任务 ${j.task_id}

${oneLine(j.description)}

拓扑 ${topo}，${agents.length} 个智能体按 speaking_order 依次发言，期望 ${j.expected_turns} 轮。
所有 system_prompt、约束注入、ground_truth 均逐字保存在 attachments/ 下，本文档案例是结构视图，不含改写。
`);

  /* agents.md */
  let ag = `---
hub: "1.0"
kind: agents
case: ${caseId}
---

`;
  agents.forEach((a, i) => {
    const isFirst = (order[0] || a.agent_id) === a.agent_id;
    ag += `# @${aid(a.agent_id)} [individual] #phase/${i === 0 ? 'plan' : i === agents.length - 1 ? 'test' : 'build'} #role/${slug(a.role) || 'agent'} #group/${/orchestrat|lead|manager|coordinat/i.test(a.role) ? 'command' : 'team'}${isFirst ? ' #hub' : ''}
name: ${a.agent_id} ${a.role}
model: ${modelFor(i)}
source_model: 由评估运行器配置
prompt_file: attachments/agent_${a.agent_id}_prompt.md
role: ${oneLine(a.system_prompt)}
trigger: ${i === 0 ? '评估运行器启动任务' : `收到 ${oneLine((a.receives_from || []).join('、')) || '上游'} 的产出`}
watches: [${(a.receives_from || []).map(aid).join(', ')}]

`;
  });
  fs.writeFileSync(path.join(dir, 'agents.md'), ag);

  /* groups.md */
  const cmd = agents.filter((a) => /orchestrat|lead|manager|coordinat/i.test(a.role)).map((a) => aid(a.agent_id));
  const team = agents.filter((a) => !/orchestrat|lead|manager|coordinat/i.test(a.role)).map((a) => aid(a.agent_id));
  let gr = `---
hub: "1.0"
kind: groups
case: ${caseId}
---

`;
  if (cmd.length) gr += `# @command [group] #level/1
name: 指挥
members: [${cmd.join(', ')}]

`;
  if (team.length) gr += `# @team [group] #level/1
name: 执行
members: [${team.join(', ')}]
`;
  fs.writeFileSync(path.join(dir, 'groups.md'), gr);

  /* docs.md */
  let doc = `---
hub: "1.0"
kind: docs
case: ${caseId}
---

# @d_task [doc] #layer/consensus
name: 任务定义（原文）
owner: ${aid(order[0] || 'A1')}
payload_file: attachments/task.json
summary: 完整任务 JSON 逐字副本：描述、拓扑、注入、ground_truth、评分细则
audience: all

`;
  agents.forEach((a) => {
    doc += `# @d_out_${a.agent_id} [doc] #layer/consensus
name: ${a.role} 产出
owner: ${aid(a.agent_id)}
summary: ${a.role} 在发言轮次里产出的工作结果
audience: all

`;
  });
  fs.writeFileSync(path.join(dir, 'docs.md'), doc);

  /* process.md：speaking_order 平铺为阶段 + 终局规则关卡 */
  let pr = `---
hub: "1.0"
kind: process
case: ${caseId}
---

`;
  order.forEach((id, i) => {
    const a = byId[id] || { role: id };
    pr += `# @s_${aid(id)} [stage] #group/${/orchestrat|lead|manager|coordinat/i.test(a.role) ? 'command' : 'team'}
name: ${i + 1}. ${a.role}
executors: [${aid(id)}]

`;
  });
  /* 多约束任务加中途"约束传播检查"关卡（tracer 机制的结构化显式化） */
  const mcGate = mc ? `
# @gt_propagate [gate] #kind/agent
name: 约束传播检查（tracer ${mc.constraints ? mc.constraints.map((c) => c.tracer_id).join('/') : ''}）
after_stage: s_${aid(order[Math.min(1, order.length - 1)])}
decider_type: agent
decider_who: ${aid(order[Math.min(1, order.length - 1)])}
paths:
  - condition: 两条约束在产出中逐字存活
    next: s_${aid(order[2] || order[order.length - 1])}
  - condition: 约束被改写、弱化或遗漏
    next: s_${aid(order[Math.min(1, order.length - 1)])}
    note: 修正传播副本后重发

` : '';
  pr += mcGate;
  pr += `# @gt_final [gate] #kind/rule
name: ground_truth 判定
after_stage: s_${aid(order[order.length - 1] || 'A1')}
decider_type: rule
text: ${oneLine((j.ground_truth && j.ground_truth.quality_rubric) || '满足 correct_outcome')}
paths:
  - condition: ${oneLine((j.ground_truth && j.ground_truth.correct_outcome) || '结果符合 ground_truth')}
    next: done
  - condition: 存在约束违反或结论错误
    next: s_${aid(order[order.length - 1] || 'A1')}
    note: 按审计意见返工最后阶段
`;
  fs.writeFileSync(path.join(dir, 'process.md'), pr);

  /* relations.md：拓扑边 → 读线 */
  let rel = `---
hub: "1.0"
kind: relations
case: ${caseId}
---

`;
  edges.forEach(([from, to]) => {
    rel += `@${aid(to)} >read @d_out_${from} 拓扑边 ${from}→${to}（${topo}）
`;
  });
  fs.writeFileSync(path.join(dir, 'relations.md'), rel);

  /* scenarios.md */
  let sc = `---
hub: "1.0"
kind: scenarios
case: ${caseId}
---

# @K1 [case]
name: 基准执行
rework_gate: gt_final
rework_times: 1

`;
  if (mc && mc.conflict_scenario) {
    sc += `# @K2 [case]
name: 约束保真失败：${oneLine(mc.conflict_scenario).slice(0, 60)}
inject:
  - at: 0.5
    to: ${aid(order[Math.min(1, order.length - 1)])}
    kind: context
    text: tracer 约束 ${mc.constraints ? mc.constraints.map((c) => c.tracer_id).join('/') : ''} 在传递中被弱化
rework_gate: gt_final
rework_times: 1

# @K3 [case]
name: 终局检出违规
blocked_at: gt_final

`;
  } else {
    sc += `# @K2 [case]
name: 中途指令注入
inject:
  - at: 0.5
    to: ${aid(order[Math.min(1, order.length - 1)])}
    kind: instruction
    text: 任务中途补充约束，检验已传递信息是否被正确吸收
rework_gate: gt_final
rework_times: 1

# @K3 [case]
name: 终局检出不合格
blocked_at: gt_final

`;
  }
  sc += `never_dispatch: []
@ch_sonnet outage at=0.6 dur=0.05 kind=quota
note: sonnet 渠道额度耗尽
version_change at=0.5
note: 评估运行器在第 ${Math.max(2, Math.round((j.expected_turns || 24) / 2))} 轮注入中期检查
`;
  fs.writeFileSync(path.join(dir, 'scenarios.md'), sc);

  /* decisions：多约束任务从路由选项机械生成，否则从 correct_outcome 生成 */
  const decider = agents.length >= 2 ? aid(order[order.length - 2]) : aid(order[0]);
  let de = `---
hub: "1.0"
kind: decisions
case: ${caseId}
agent: ${decider}
---

# @d_1 [decision] #stage/build #kind/deliver #agent/${decider}
title: ${mc ? '在互相冲突的候选中选路' : oneLine(j.description).slice(0, 40) + ' 的关键取舍'}
trigger: ${mc ? '成本上限与延迟偏好同时生效，候选里不存在双最优' : '任务存在多个可行方向，ground_truth 指定了正确结局'}
alternatives:
`;
  if (mc && Array.isArray(mc.routing_options)) {
    mc.routing_options.forEach((o) => {
      de += `  - ${o.name}（$${o.cost_per_call_usd}/次，${o.latency_ms}ms）\n`;
    });
  } else {
    de += `  - 按 ${oneLine((j.ground_truth && j.ground_truth.correct_outcome) || '任务描述')} 推进
  - 选择与描述相反的路径
  - 中止并请求澄清
`;
  }
  de += `choice: ${oneLine((j.ground_truth && j.ground_truth.correct_outcome) || '按任务描述推进').slice(0, 160)}
reason: ${mc ? '唯一同时满足全部 tracer 约束的候选；选了别的意味着某条约束在传递中已经丢失' : 'ground_truth 与 quality_rubric 的明确要求'}
impact: ${j.expected_turns ? `预期 ${j.expected_turns} 轮内完成，` : ''}审计层按 quality_rubric 打分
action: deliver
`;
  fs.writeFileSync(path.join(dir, 'decisions', decider + '.md'), de);

  /* 审计/收尾角色的第二份决策：从 quality_rubric 生成（放行 / 打回 / 代改的取舍） */
  const auditor = aid(order[order.length - 1]);
  if (auditor !== decider) {
    fs.writeFileSync(path.join(dir, 'decisions', auditor + '.md'), `---
hub: "1.0"
kind: decisions
case: ${caseId}
agent: ${auditor}
---

# @d_2 [decision] #stage/test #kind/escalate #agent/${auditor}
title: ${mc ? '发现约束违规时如何处置' : '产出未达 quality_rubric 标准时如何处置'}
trigger: ${mc ? '核对 tracer 约束时发现实现层选了违反约束的候选' : '按 quality_rubric 核对发现产出不达标'}
alternatives:
  - 有保留放行，在报告里注明瑕疵
  - 判定不合格，打回上一阶段重新选择
  - 代为修正后直接通过
choice: 判定不合格，打回上一阶段重新选择
reason: 评分细则（${oneLine((j.ground_truth && j.ground_truth.quality_rubric) || 'rubric').slice(0, 80)}）里正确路径与推理可追溯占大头，放行即失分；代改则抹掉了归因信息
impact: 违规方案退回重选，冲突解决推理链留在审计报告里
action: escalate
`);
  }

  made++;
  console.log(`created ${caseId}  (${j.task_id}, ${topo}, ${agents.length} agents)`);
}

if (!DRY && made) {
  let idx = indexText;
  for (const row of indexRows) if (!idx.includes(row)) idx = idx.replace(/(加新案例：)/, row + '\n\n$1');
  fs.writeFileSync(indexPath, idx);
}
console.log(`完成：新建 ${made}，跳过 ${skipped}。校验：node hub/tools/check_from_docs.js`);
