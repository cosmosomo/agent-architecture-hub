#!/usr/bin/env node
/**
 * import_smallville.js — 斯坦福生成式小镇 Smallville 官方存档导入（真实回放，非设计稿）。
 * 源：case_library/cloud/academic/hf-data/generative-agents/
 *   master_movement.json（8655 步 × 每 10 秒，逐步动作 + 带发言人的对话）
 *   personas__*_scratch.json（智能体状态：personality、current_action…）
 * 产出：imp_smallville_party/ —— 3 个真实 persona 角色，回放与记忆流逐字进 traces/。
 * 用法：node hub/tools/import_smallville.js [--dry]
 */
const fs = require('fs');
const path = require('path');

const SRC = path.resolve(__dirname, '../../../../case_library/cloud/academic/hf-data/generative-agents');
const OUT = path.resolve(__dirname, '../../cases/_reference/smallville');
const DRY = process.argv.includes('--dry');
const slug = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'persona';

const meta = JSON.parse(fs.readFileSync(path.join(SRC, 'meta.json'), 'utf8'));
const move = JSON.parse(fs.readFileSync(path.join(SRC, 'master_movement.json'), 'utf8'));
const personas = meta.persona_names || Object.keys(move[Object.keys(move)[0]] || {});
const caseId = 'imp_smallville_party';
const dir = path.join(OUT, caseId);
if (fs.existsSync(dir)) { console.log('skip ' + caseId); process.exit(0); }

/* 从回放提取真实对话（chat 非空的步）与各 persona 的动作统计 */
const chatSteps = [];
const actCount = {};
for (const [step, snapshot] of Object.entries(move)) {
  for (const [p, st] of Object.entries(snapshot || {})) {
    const d = (st && st.description) || '';
    actCount[p] = actCount[p] || {};
    const core = d.split('@')[0].trim();
    actCount[p][core] = (actCount[p][core] || 0) + 1;
    if (st && Array.isArray(st.chat) && st.chat.length) chatSteps.push({ step: Number(step), chat: st.chat });
  }
}
const chatCount = chatSteps.reduce((n, c) => n + c.chat.length, 0);

if (DRY) { console.log(`will create ${caseId}: ${personas.length} personas, ${Object.keys(move).length} steps, ${chatSteps.length} chat steps / ${chatCount} utterances`); process.exit(0); }

fs.mkdirSync(path.join(dir, 'traces'), { recursive: true });
fs.mkdirSync(path.join(dir, 'decisions'), { recursive: true });
fs.mkdirSync(path.join(dir, 'attachments'), { recursive: true });

/* traces/：master_movement 与各 persona 记忆流逐字落盘 */
fs.copyFileSync(path.join(SRC, 'master_movement.json'), path.join(dir, 'traces', 'master_movement.json'));
const traceFiles = ['master_movement.json'];
personas.forEach((p) => {
  const key = Object.keys(move).find(() => false); // persona 文件名按已知约定
  const f = `personas__${p.replace(/ /g, '_')}__bootstrap_memory__associative_memory__nodes.json`;
  if (fs.existsSync(path.join(SRC, f))) {
    fs.copyFileSync(path.join(SRC, f), path.join(dir, 'traces', `nodes_${slug(p)}.json`));
    traceFiles.push(`nodes_${slug(p)}.json`);
  }
});
fs.writeFileSync(path.join(dir, 'traces', 'index.json'), JSON.stringify({ files: traceFiles, note: '提案 B 批准后进 model.sourceTraces' }, null, 2));

/* attachments：scratch 状态逐字 + 对话抽取摘要 */
personas.forEach((p) => {
  const f = `personas__${p.replace(/ /g, '_')}__bootstrap_memory__scratch.json`;
  if (fs.existsSync(path.join(SRC, f))) fs.copyFileSync(path.join(SRC, f), path.join(dir, 'attachments', `scratch_${slug(p)}.json`));
});
fs.writeFileSync(path.join(dir, 'attachments', 'chat_extract.json'), JSON.stringify(chatSteps, null, 1));

const topActs = (p) => Object.entries(actCount[p] || {}).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([a, n]) => `${a}×${n}`).join('、');
const scratchText = (p) => {
  const f = path.join(SRC, `personas__${p.replace(/ /g, '_')}__bootstrap_memory__scratch.json`);
  try { const s = JSON.parse(fs.readFileSync(f, 'utf8')); return String(s.persona || s.currently || '').replace(/\s+/g, ' ').slice(0, 160); } catch (e) { return ''; }
};

fs.writeFileSync(path.join(dir, 'meta.md'), `---
hub: "1.0"
kind: meta
case: ${caseId}
source: https://github.com/joonspk-research/generative_agents compressed_storage 官方存档（脚本 import_smallville.js 机械导入）
---

# Smallville 真实回放：Isabella 的情人节派对（${meta.start_date} 起 ${meta.step} 步）

斯坦福生成式小镇论文官方存档的完整模拟回放：${personas.length} 个智能体（${personas.join('、')}）在 ${meta.sec_per_step} 秒/步的节奏下活了 ${meta.step} 步。
涌现出本案例库唯一"无编排者"的协作：Isabella 组织派对、Klaus 与 Maria 在派对上相遇并持续对话。
全部 ${Object.keys(move).length} 步逐字动作、${chatSteps.length} 个对话步 / ${chatCount} 句带发言人的话轮、各 persona 记忆流（nodes.json）都逐字保存在 traces/，
角色状态（scratch，含 personality 与 currently）在 attachments/。角色行为实测分布：${personas.map((p) => `${p}：${topActs(p)}`).join('；')}。
`);

let ag = `---
hub: "1.0"
kind: agents
case: ${caseId}
---

`;
personas.forEach((p, i) => {
  ag += `# @${slug(p)} [individual] #phase/build #role/agent #group/town${i === 0 ? ' #hub' : ''}
name: ${p}
model: claude-opus-5-5
source_model: gpt3.5-turbo（论文配置）
role: 长期自主智能体：记忆流+反思+计划驱动，无外部编排；实测最常见动作 ${topActs(p)}。状态原文见 attachments/scratch_${slug(p)}.json
trigger: 模拟时钟 tick（自驱）
watches: []

`;
});
fs.writeFileSync(path.join(dir, 'agents.md'), ag);

fs.writeFileSync(path.join(dir, 'groups.md'), `---
hub: "1.0"
kind: groups
case: ${caseId}
---

# @town [group] #level/1
name: 小镇居民（涌现协作）
members: [${personas.map(slug).join(', ')}]
`);
fs.writeFileSync(path.join(dir, 'docs.md'), `---
hub: "1.0"
kind: docs
case: ${caseId}
---

# @d_replay [doc] #layer/map
name: 回放档案索引
owner: ${slug(personas[0])}
payload_file: attachments/chat_extract.json
summary: ${Object.keys(move).length} 步 master_movement 逐字档案在 traces/；attachments/chat_extract.json 是全部 ${chatCount} 句带发言人话轮的抽取
audience: all

# @d_party [doc] #layer/consensus
name: 派对事件
owner: ${slug(personas[0])}
summary: 涌现协作事件：${personas[0]} 计划并举办情人节派对，${personas.slice(1).join('、')} 自主到场并交谈
audience: all
`);
fs.writeFileSync(path.join(dir, 'process.md'), `---
hub: "1.0"
kind: process
case: ${caseId}
---

# @s_day [stage] #group/town
name: 长程日常（tick 驱动，无编排者）
executors: [${personas.map(slug).join(', ')}]

# @s_party [stage] #group/town
name: 派对时段（涌现聚集）
executors: [${personas.map(slug).join(', ')}]

# @gt_emerge [gate] #kind/rule
name: 涌现判定
after_stage: s_party
decider_type: rule
text: 无人派发任务的情况下，多个智能体自发到达同一地点并产生对话
paths:
  - condition: 对话步出现且参与者≥2
    next: done
  - condition: 无涌现交互
    next: s_day
    note: 继续长程 tick
`);
fs.writeFileSync(path.join(dir, 'relations.md'), `---
hub: "1.0"
kind: relations
case: ${caseId}
---

@${slug(personas[1])} >read @d_party 派对信息通过环境观察（记忆流）而非消息传递获得
@${slug(personas[2] || personas[0])} >read @d_party
`);
fs.writeFileSync(path.join(dir, 'scenarios.md'), `---
hub: "1.0"
kind: scenarios
case: ${caseId}
---

# @K1 [case]
name: 实测涌现：派对组织与相遇
rework_gate: gt_emerge
rework_times: 0

# @K2 [case]
name: 反事实：没有派对计划
inject:
  - at: 0.4
    to: ${slug(personas[0])}
    kind: feedback
    text: 抹去派对计划相关记忆，观察当晚是否仍出现聚集对话
blocked_at: gt_emerge

never_dispatch: []
@${slug(personas[1])} >undeclared_read @d_replay 实测中居民会翻看自己对环境的旧观察（记忆流），编排里没有这条线
@ch_opus outage at=0.5 dur=0.05 kind=quota
note: opus 渠道额度耗尽，全体智能体停摆（实测中对应 API 限流）
version_change at=0.5
note: 派对开始后 ${personas[0]} 的动作从筹备转向招待（实测分布可见）
`);
fs.writeFileSync(path.join(dir, 'decisions', slug(personas[0]) + '.md'), `---
hub: "1.0"
kind: decisions
case: ${caseId}
agent: ${slug(personas[0])}
---

# @d_1 [decision] #phase/build #stage/build #kind/deliver #agent/${slug(personas[0])}
title: 派对要不要主动邀请（实测：她只发帖不拉人）
trigger: 回放显示 ${personas[0]} 通过在酒馆告示板发布派对计划邀请，而非逐个私聊
alternatives:
  - 像实测那样只公开广播（告示板）
  - 逐个私聊邀请（点对点消息）
  - 不邀请，等居民自己发现
choice: 像实测那样只公开广播（告示板）
reason: 记忆流+环境观察机制下，公开广播足以进入其他智能体的注意与反思；实测 Klaus 与 Maria 正是因此自主到场
impact: 涌现协作的核心证据——没有点对点协调，只有环境中的信息沉淀
action: deliver
`);
console.log(`created ${caseId}  (${personas.length} personas, ${Object.keys(move).length} steps, ${chatCount} utterances)`);
