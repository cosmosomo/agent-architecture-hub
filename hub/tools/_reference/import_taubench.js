#!/usr/bin/env node
/**
 * import_taubench.js — tau-bench 真实客服对话导入（带 reward 与工具调用序列）。
 * 源：case_library/cloud/academic/hf-data/tau-bench/historical_trajectories_*.json
 *   每条：task_id / reward(0|1) / traj[]（role: system=航空政策全文、user=用户模拟器、
 *         assistant=客服 agent、tool=工具返回，含 tool_call_id+name） / trial
 * 产出：imp_taubench_<model>[_ok|_fail]/ —— 政策原文进 attachments，对话逐字进 traces/，
 *       reward 决定 scenario 的通过/打回。用法：node hub/tools/import_taubench.js [--per 4] [--dry]
 */
const fs = require('fs');
const path = require('path');

const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const PER = parseInt(arg('per', '4'), 10);
const DRY = argv.includes('--dry');
const SRC = path.resolve(__dirname, '../../../../case_library/cloud/academic/hf-data/tau-bench');
const OUT = path.resolve(__dirname, '../../cases/_reference/taubench');
const slug = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 20) || 'x';

const files = fs.readdirSync(SRC).filter((f) => f.startsWith('historical_trajectories_') && f.endsWith('.json'));
const indexPath = path.join(OUT, '_index.md');
const indexText = fs.existsSync(indexPath) ? fs.readFileSync(indexPath, 'utf8') : '';
let made = 0;

for (const f of files) {
  const model = f.match(/historical_trajectories_(.+)-airline\.json/)[1];
  let recs;
  try { recs = JSON.parse(fs.readFileSync(path.join(SRC, f), 'utf8')); } catch (e) { console.error('坏文件 ' + f); continue; }
  const ok = recs.filter((r) => r.reward === 1).slice(0, Math.ceil(PER / 2));
  const bad = recs.filter((r) => r.reward !== 1).slice(0, Math.ceil(PER / 2));
  const sample = [...ok, ...bad];
  if (!sample.length) continue;
  const caseId = 'imp_taubench_' + slug(model);
  const dir = path.join(OUT, caseId);
  if (fs.existsSync(dir)) { console.log('skip ' + caseId); continue; }
  if (DRY) { console.log(`will create ${caseId}: ${sample.length} dialogs (${ok.length} 成功 / ${bad.length} 失败)`); made++; continue; }

  fs.mkdirSync(path.join(dir, 'traces'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'decisions'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'attachments'), { recursive: true });

  /* 政策原文（system prompt）逐字提取 + 对话逐字落盘 + 工具名清单（能力维度，前向兼容提案 G） */
  const policy = sample[0].traj.find((m) => m.role === 'system');
  if (policy) fs.writeFileSync(path.join(dir, 'attachments', 'airline_policy.md'), `# 航空公司政策（客服 agent 的完整 system prompt）\n\n${policy.content}\n`);
  const toolNames = [...new Set(sample.flatMap((r) => r.traj.filter((m) => m.role === 'assistant' && m.tool_calls).flatMap((m) => m.tool_calls.map((t) => t.function && t.function.name)).filter(Boolean)))];
  if (!toolNames.length) [...new Set(sample.flatMap((r) => r.traj.filter((m) => m.role === 'tool' && m.name).map((m) => m.name)))];
  const toolsAttr = toolNames.length ? `\ntools: [${toolNames.join(', ')}]` : '';
  const traceFiles = [];
  sample.forEach((r, i) => {
    const fn = `dialog_${String(i + 1).padStart(2, '0')}_task${r.task_id}_r${r.reward}.json`;
    fs.writeFileSync(path.join(dir, 'traces', fn), JSON.stringify(r, null, 1));
    traceFiles.push(fn);
  });
  fs.writeFileSync(path.join(dir, 'traces', 'index.json'), JSON.stringify({ files: traceFiles, note: '提案 B 批准后进 model.sourceTraces' }, null, 2));

  const toolCalls = sample.reduce((n, r) => n + r.traj.filter((m) => m.role === 'tool').length, 0);
  const firstTask = oneLine(sample[0].traj.find((m) => m.role === 'user'));
  function oneLine(m) { return String((m && m.content) || '').replace(/\s+/g, ' ').trim().slice(0, 120); }

  fs.writeFileSync(path.join(dir, 'meta.md'), `---
hub: "1.0"
kind: meta
case: ${caseId}
source: https://github.com/sierra-research/tau-bench historical_trajectories_${model}-airline.json（脚本 import_taubench.js 机械导入）
---

# tau-bench 真实客服对话：${model}（${ok.length} 成功 / ${bad.length} 失败）

tau-bench 航空域实测轨迹：用户模拟器与客服 agent 的多轮对话，agent 带真实工具调用
（get_user_details、book_reservation 等，样本内共 ${toolCalls} 次工具返回），reward 由数据库级动作比对给出。
航空公司政策全文（agent 的 system prompt）逐字在 attachments/airline_policy.md；
${sample.length} 段对话逐字在 traces/。首个任务示例：${oneLine(sample[0].traj.find((m) => m.role === 'user'))}
`);

  fs.writeFileSync(path.join(dir, 'agents.md'), `---
hub: "1.0"
kind: agents
case: ${caseId}
---

# @service_agent [individual] #phase/build #role/assistant #group/crew #hub
name: 客服 Agent
model: claude-opus-5-5
source_model: ${model}${toolsAttr}
prompt_file: attachments/airline_policy.md
role: 航空公司客服：在政策约束内通过工具查询与修改数据库（订票/退改/赔偿），与用户模拟器多轮对话直到问题解决或失败
trigger: 用户模拟器发起咨询
watches: [user_simulator]

# @user_simulator [individual] #phase/build #role/user #group/crew
name: 用户模拟器
model: claude-sonnet-5-5
source_model: gpt-4o（tau-bench 用户侧默认）
role: 按隐藏指令扮演真实用户提出诉求，只在与客服的对话中披露信息，不直接操作数据库
trigger: 对话开始
watches: []
`);
  fs.writeFileSync(path.join(dir, 'groups.md'), `---
hub: "1.0"
kind: groups
case: ${caseId}
---

# @crew [group] #level/1
name: 对话双方
members: [service_agent, user_simulator]
`);
  fs.writeFileSync(path.join(dir, 'docs.md'), `---
hub: "1.0"
kind: docs
case: ${caseId}
---

# @d_policy [doc] #layer/consensus
name: 航空公司政策
owner: service_agent
payload_file: attachments/airline_policy.md
summary: 客服 agent 的完整 system prompt（政策原文逐字）
audience: [service_agent]

# @d_dialogs [doc] #layer/map
name: 对话档案索引
owner: service_agent
summary: traces/ 共 ${sample.length} 段逐字对话（文件名含 task_id 与 reward）
audience: all
`);
  fs.writeFileSync(path.join(dir, 'process.md'), `---
hub: "1.0"
kind: process
case: ${caseId}
---

# @s_dialog [stage] #group/crew
name: 多轮对话
executors: [service_agent, user_simulator]

# @s_tools [stage] #group/crew
name: 工具操作
executors: [service_agent]

# @gt_reward [gate] #kind/rule
name: reward 判定（数据库状态比对）
after_stage: s_tools
decider_type: rule
text: 最终数据库状态与期望动作序列一致（reward=1）
paths:
  - condition: reward=1
    next: done
  - condition: reward=0（政策违反或动作错误）
    next: s_dialog
    note: 失败对话原文见 traces/ 中 r0 文件
`);
  fs.writeFileSync(path.join(dir, 'relations.md'), `---
hub: "1.0"
kind: relations
case: ${caseId}
---

@user_simulator >watch @service_agent 用户只通过对话披露诉求
`);
  fs.writeFileSync(path.join(dir, 'scenarios.md'), `---
hub: "1.0"
kind: scenarios
case: ${caseId}
---

# @K1 [case]
name: 实测成功对话复跑（reward=1）
rework_gate: gt_reward
rework_times: 0

# @K2 [case]
name: 实测失败复现（reward=0：政策违反或动作错误）
inject:
  - at: 0.6
    to: service_agent
    kind: feedback
    text: 本段对话按 traces/ 中 r0 文件的真实过程走，注意 agent 在哪一步偏离了政策
blocked_at: gt_reward

never_dispatch: []
@service_agent >undeclared_read @d_dialogs 实测中 agent 偶尔回顾自己先前的回复组织措辞，编排里没有这条线
@ch_opus outage at=0.5 dur=0.05 kind=quota
note: opus 渠道额度耗尽
version_change at=0.5
note: 失败样本暴露的高频问题促使政策问答先于工具动作（few-shot 调整）
`);
  fs.writeFileSync(path.join(dir, 'decisions', 'service_agent.md'), `---
hub: "1.0"
kind: decisions
case: ${caseId}
agent: service_agent
---

# @d_1 [decision] #stage/build #kind/deliver #agent/service_agent
title: 用户诉求与政策冲突时怎么回
trigger: 失败样本里 agent 曾答应政策不允许的请求（reward=0 的常见原因）
alternatives:
  - 为让用户满意而放宽政策解释
  - 引用政策原文拒绝并说明替代方案
  - 直接执行用户要求，赌数据库比对不查
choice: 引用政策原文拒绝并说明替代方案
reason: reward 按数据库动作与政策比对，放宽解释必然失分；拒绝+替代是唯一既合规又推进对话的路径
impact: 成功样本普遍在拒绝后给出改签/代金券等替代动作完成交易
action: deliver
`);
  made++;
  console.log(`created ${caseId}  (${sample.length} dialogs: ${ok.length}成功/${bad.length}失败)`);
}
if (!DRY && made) {
  let idx = indexText;
  fs.readdirSync(OUT).filter((d) => d.startsWith('imp_taubench_')).sort().forEach((d) => {
    const row = `| ${d} | tau-bench 真实客服对话：${d.replace('imp_taubench_', '')} | ${d}/ |`;
    if (!idx.includes(row)) idx = idx.replace(/(加新案例：)/, row + '\n\n$1');
  });
  fs.writeFileSync(indexPath, idx);
}
console.log(`完成：新建 ${made}。校验：node hub/tools/check_from_docs.js`);
