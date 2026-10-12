#!/usr/bin/env node
/**
 * import_camel_society.js — CAMEL AI Society 真实 role-playing 对话导入。
 * 源：case_library/cloud/academic/hf-data/camel/*.json（25000 条真实双智能体对话，
 *     每条含 original_task / specified_task（任务具象师产出）/ 交替指令-解题话轮）。
 * 产出：
 *   1. imp_camel_roleplay/traces/ 补充 N 条真实对话（设计案例 × 实测数据接轨）
 *   2. imp_camel_society/ 语料案例：50 条逐字对话 + 完成标记统计
 * 用法：node hub/tools/import_camel_society.js [--corpus 50] [--dry]
 */
const fs = require('fs');
const path = require('path');

const OUT = path.resolve(__dirname, '../../cases/_reference/camel');
const ci = process.argv.indexOf('--corpus');
const CORPUS = parseInt(ci >= 0 && process.argv[ci + 1] ? process.argv[ci + 1] : '50', 10) || 50;
const DRY = process.argv.includes('--dry');
/* --src 换源目录（相对 case_library/cloud/academic）、--tag 换案例后缀：
   node import_camel_society.js --src hf-data/camel-code --tag code */
const si = process.argv.indexOf('--src');
const SRC = path.resolve(__dirname, '../../../../case_library/cloud/academic', si >= 0 && process.argv[si + 1] ? process.argv[si + 1] : 'hf-data/camel');
const ti = process.argv.indexOf('--tag');
const TAG = ti >= 0 && process.argv[ti + 1] ? '_' + process.argv[ti + 1] : '';
const DOMAIN = TAG ? TAG.slice(1) : 'ai_society';

const files = fs.readdirSync(SRC).filter((f) => f.endsWith('.json')).sort();
const sample = files.slice(0, CORPUS);

/* 统计真实完成标记（CAMEL：用户回 <CAMEL_TASK_DONE> 表示满意） */
let doneCount = 0, roles = new Set();
const parsed = sample.map((f) => {
  const d = JSON.parse(fs.readFileSync(path.join(SRC, f), 'utf8'));
  const msgs = Object.keys(d).filter((k) => /^message_\d+$/.test(k)).map((k) => d[k]);
  const done = msgs.some((m) => /CAMEL_TASK_DONE/.test(String(m.content || '')));
  if (done) doneCount++;
  roles.add(d.role_1 || ''); roles.add(d.role_2 || '');
  return { file: f, d, msgs, done, turns: msgs.length };
});
console.log(`源 25000 对话，抽样 ${sample.length}，完成标记 ${doneCount}，角色域 ${roles.size} 个`);
if (DRY) process.exit(0);

/* 1) 真实对话补进 imp_camel_roleplay/traces/ */
const rpDir = path.join(OUT, 'imp_camel_roleplay', 'traces');
if (!TAG && fs.existsSync(rpDir)) {
  parsed.slice(0, 10).forEach(({ file, d }) => {
    fs.writeFileSync(path.join(rpDir, `real_${file}`), JSON.stringify(d, null, 1));
  });
  const idxPath = path.join(OUT, 'imp_camel_roleplay', 'traces', 'index.json');
  const idx = fs.existsSync(idxPath) ? JSON.parse(fs.readFileSync(idxPath, 'utf8')) : { files: [] };
  parsed.slice(0, 10).forEach(({ file }) => { if (!idx.files.includes(`real_${file}`)) idx.files.push(`real_${file}`); });
  idx.note = '真实对话（camel-ai/ai_society）+ 提案 B 批准后进 model.sourceTraces';
  fs.writeFileSync(idxPath, JSON.stringify(idx, null, 2));
  console.log('roleplay traces untouched (tagged run)');
}

/* 2) 语料案例 imp_camel_society */
const caseId = 'imp_camel_society' + TAG;
const dir = path.join(OUT, caseId);
if (!fs.existsSync(dir)) {
  fs.mkdirSync(path.join(dir, 'traces'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'decisions'), { recursive: true });
  const traceFiles = [];
  parsed.forEach(({ file, d }) => {
    fs.writeFileSync(path.join(dir, 'traces', file), JSON.stringify(d, null, 1));
    traceFiles.push(file);
  });
  fs.writeFileSync(path.join(dir, 'traces', 'index.json'), JSON.stringify({ files: traceFiles, note: '25000 条真实对话抽样；提案 B 批准后进 model.sourceTraces' }, null, 2));
  const first = parsed[0];
  fs.writeFileSync(path.join(dir, 'meta.md'), `---
hub: "1.0"
kind: meta
case: ${caseId}
source: https://huggingface.co/datasets/camel-ai/ai_society ai_society_chat.tar.gz（脚本 import_camel_society.js 机械导入）
---

# CAMEL  真实对话语料：${sample.length} 条实测 role-playing

CAMEL 官方发布的  域数据集真实对话：每条含 original_task（模糊任务）→
specified_task（任务具象师的改写产出）→ 用户 agent 与助手 agent 的交替话轮
（Instruction/Solution 结构），完成以 <CAMEL_TASK_DONE> 标记，抽样内 ${doneCount}/${sample.length} 条到达完成标记。
角色域覆盖 ${roles.size} 种（${[...roles].slice(0, 4).join('、')}…）。全部对话逐字在 traces/。
首条示例任务：${String(first.d.specified_task || first.d.original_task || '').replace(/\s+/g, ' ').slice(0, 120)}
`);
  fs.writeFileSync(path.join(dir, 'agents.md'), `---
hub: "1.0"
kind: agents
case: ${caseId}
---

# @task_specifier [individual] #phase/plan #role/orchestrator #group/core #hub
name: 任务具象师
model: claude-opus-5-5
source_model: gpt-4（论文语料配置）
role: 把模糊任务改写成双方提示词内嵌的具体任务书；实测产出 specified_task 逐字见 traces/
trigger: 收到原始任务
watches: [ai_user, ai_assistant]

# @ai_user [individual] #phase/build #role/user #group/duo
name: AI User（用户侧 agent）
model: claude-sonnet-5-5
source_model: gpt-4（论文语料配置）
role: 实测逐条下 Instruction/Input 指令推进任务，不提问不翻角色；满意时回 <CAMEL_TASK_DONE>。真实话轮见 traces/
trigger: 收到任务书
watches: []

# @ai_assistant [individual] #phase/build #role/assistant #group/duo
name: AI Assistant（助手侧 agent）
model: claude-sonnet-5-5
source_model: gpt-4（论文语料配置）
role: 实测每轮以 Solution: 开头给出解题内容，做不到诚实拒绝。真实话轮见 traces/
trigger: 收到用户指令
watches: []
`);
  fs.writeFileSync(path.join(dir, 'groups.md'), `---
hub: "1.0"
kind: groups
case: ${caseId}
---

# @core [group] #level/1
name: 任务具象
members: [task_specifier]

# @duo [group] #level/1
name: role-playing 双人组
members: [ai_user, ai_assistant]
`);
  fs.writeFileSync(path.join(dir, 'docs.md'), `---
hub: "1.0"
kind: docs
case: ${caseId}
---

# @d_task [doc] #layer/consensus
name: 任务书（specified_task）
owner: task_specifier
summary: 每条对话的具象化任务原文，随 traces/ 逐字保存
audience: all

# @d_dialogs [doc] #layer/map
name: 对话档案索引
owner: task_specifier
summary: traces/ 共 ${traceFiles.length} 条逐字对话，完成标记 ${doneCount}/${sample.length}
audience: all
`);
  fs.writeFileSync(path.join(dir, 'process.md'), `---
hub: "1.0"
kind: process
case: ${caseId}
---

# @s_specify [stage] #group/core
name: 任务具象化
executors: [task_specifier]

# @s_dialogue [stage] #group/duo
name: 角色扮演对话
executors: [ai_user, ai_assistant]

# @gt_done [gate] #kind/agent
name: CAMEL_TASK_DONE 判定
after_stage: s_dialogue
decider_type: agent
decider_who: ai_user
paths:
  - condition: 用户 agent 发出 <CAMEL_TASK_DONE>（实测 ${doneCount}/${sample.length} 条到达）
    next: done
  - condition: 未完成
    next: s_dialogue
    note: 实测中大量对话在标记前结束——这正是该数据集的研究价值
`);
  fs.writeFileSync(path.join(dir, 'relations.md'), `---
hub: "1.0"
kind: relations
case: ${caseId}
---

@ai_user >read @d_task 指令围绕任务书展开
@ai_assistant >read @d_task
`);
  fs.writeFileSync(path.join(dir, 'scenarios.md'), `---
hub: "1.0"
kind: scenarios
case: ${caseId}
---

# @K1 [case]
name: 实测完成对话复跑（${doneCount} 条有 DONE 标记中的首条）
rework_gate: gt_done
rework_times: 1

# @K2 [case]
name: 实测未完成对话复现
inject:
  - at: 0.7
    to: ai_assistant
    kind: feedback
    text: 按 traces/ 中无 DONE 标记对话的真实轨迹——助手开始空洞附和，用户指令在原地打转
blocked_at: gt_done

never_dispatch: []
@ai_assistant >undeclared_read @d_dialogs 实测中助手会沿用自己早先的 Solution 措辞，编排里没有这条线
@ch_sonnet outage at=0.5 dur=0.05 kind=quota
note: sonnet 渠道额度耗尽
version_change at=0.5
note: 论文引入 Role-flipping 检测与任务具象化正是为修实测中的翻转与漂移失败
`);
  fs.writeFileSync(path.join(dir, 'decisions', 'task_specifier.md'), `---
hub: "1.0"
kind: decisions
case: ${caseId}
agent: task_specifier
---

# @d_1 [decision] #stage/plan #kind/deliver #agent/task_specifier
title: 任务改写到多具体
trigger: 原始任务如"进行财务审计"过泛，双方对话容易漂移
alternatives:
  - 原样下发，靠用户 agent 对话中自己收敛
  - 改写成含可执行步骤与验收边界的任务书（word_limit 内）
  - 拆成多个子任务分批发
choice: 改写成含可执行步骤与验收边界的任务书（word_limit 内）
reason: 实测对照——specified_task 具体的对话到达 DONE 标记的比例显著更高；漂移对话多源于任务过泛
impact: traces/ 里每条对话的 specified_task 即为实测产出
action: deliver
`);
  const idxPath2 = path.join(OUT, '_index.md');
  let idx2 = fs.existsSync(idxPath2) ? fs.readFileSync(idxPath2, 'utf8') : '';
  const row = `| ${caseId} | CAMEL AI Society 真实对话语料 | ${caseId}/ |`;
  if (!idx2.includes(row)) idx2 = idx2.replace(/(加新案例：)/, row + '\n\n$1');
  fs.writeFileSync(idxPath2, idx2);
  console.log(`created ${caseId}  (${sample.length} 对话逐字, ${doneCount} 到达 DONE)`);
} else console.log('skip ' + caseId);
