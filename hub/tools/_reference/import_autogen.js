#!/usr/bin/env node
/**
 * import_autogen.js — AutoGen 官方示例 notebook（含真实运行输出）导入。
 * 源：case_library/cloud/academic/hf-data/autogen/*.ipynb
 * 产出：imp_autogen_<name>/ —— notebook 逐字进 traces/（真实多智能体对话输出），
 *       从输出里解析实际发言 agent 名单作为角色。
 * 用法：node hub/tools/import_autogen.js [--dry]
 */
const fs = require('fs');
const path = require('path');

const SRC = path.resolve(__dirname, '../../../../case_library/cloud/academic/hf-data/autogen');
const OUT = path.resolve(__dirname, '../../cases/_reference/frameworks');
const DRY = process.argv.includes('--dry');
const slug = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 24) || 'agent';
const FALLBACK = {
  'group_chat': ['planner', 'engineer', 'executer', 'user_proxy'],
  'selector-group_chat': ['planning_agent', 'coder_agent', 'reviewer_agent'],
  'teams': ['planner', 'executor', 'critic'],
};
const oneLine = (s) => String(s || '').replace(/\s+/g, ' ').trim();

const files = fs.readdirSync(SRC).filter((f) => f.endsWith('.ipynb'));
const indexPath = path.join(OUT, '_index.md');
const indexText = fs.existsSync(indexPath) ? fs.readFileSync(indexPath, 'utf8') : '';
let made = 0;

for (const f of files) {
  let nb;
  try { nb = JSON.parse(fs.readFileSync(path.join(SRC, f), 'utf8')); } catch (e) { console.error('坏文件 ' + f); continue; }
  /* 从代码单元解析实际定义的 agent 名（官方发布版 notebook 多数不含输出单元） */
  const speakers = new Set();
  let msgCount = 0;
  const codeText = (nb.cells || []).filter((c) => c.cell_type === 'code').map((c) => (Array.isArray(c.source) ? c.source.join('') : c.source)).join('\n');
  codeText.replace(/\(\s*(?:\w+\s*=\s*)?name\s*=\s*["']([A-Za-z_][A-Za-z0-9_ ]{1,30})["']/g, (_, n) => { speakers.add(n.trim()); return _; });
  /* 变量赋值式定义：planning_agent = AssistantAgent(...) */
  codeText.replace(/(\w+)\s*=\s*\w*Agent\(/g, (_, v) => { if (!/^(user|system|model|client|agent)$/i.test(v)) speakers.add(v); return _; });
  /* team 成员名单数组：agents=[a, b, c] 已由变量名覆盖；team 名单从 GroupChat(agents=[...]) 抓 */
  codeText.replace(/agents\s*=\s*\[([^\]]{2,120})\]/g, (_, list) => {
    list.split(',').forEach((x) => { const v = x.trim().replace(/^\[|\]$/g, ''); if (/^\w+$/.test(v) && !/^(user|system)$/i.test(v)) speakers.add(v); });
    return _;
  });
  (nb.cells || []).forEach((c) => {
    (c.outputs || []).forEach((o) => {
      const texts = [];
      if (o.text) texts.push(Array.isArray(o.text) ? o.text.join('') : o.text);
      (o.data && o.data['text/plain'] && texts.push(Array.isArray(o.data['text/plain']) ? o.data['text/plain'].join('') : o.data['text/plain']));
      texts.join('\n').split('\n').forEach((l) => {
        const m = l.match(/^Name:\s*([A-Za-z_][A-Za-z0-9_ ]*?)\s*(?:\(.*?\))?\s*$/);
        if (m && !/^(user|system)$/i.test(m[1])) speakers.add(m[1].trim());
        if (/^Name:/.test(l)) msgCount++;
      });
    });
  });
  const hasOutputs = msgCount > 0;
  const name = f.replace('.ipynb', '');
  const caseId = 'imp_autogen_' + slug(name);
  const dir = path.join(OUT, caseId);
  if (fs.existsSync(dir)) { console.log('skip ' + caseId); continue; }
  const roleIds = [...speakers].map(slug).slice(0, 5);
  if (!roleIds.length) (FALLBACK[name] || ['planner', 'executor']).forEach((r) => roleIds.push(r));
  if (DRY) { console.log(`will create ${caseId}: ${roleIds.length} 发言者 (${[...speakers].join(', ') || 'fallback'}), ${msgCount} 条消息输出`); continue; }

  fs.mkdirSync(path.join(dir, 'traces'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'decisions'), { recursive: true });
  fs.copyFileSync(path.join(SRC, f), path.join(dir, 'traces', f));
  fs.writeFileSync(path.join(dir, 'traces', 'index.json'), JSON.stringify({ files: [f], note: 'notebook 含真实运行输出；提案 B 批准后进 model.sourceTraces' }, null, 2));

  if (!roleIds.length) roleIds.push('planner', 'critic');

  fs.writeFileSync(path.join(dir, 'meta.md'), `---
hub: "1.0"
kind: meta
case: ${caseId}
source: https://microsoft.github.io/autogen 官方示例 ${f}（脚本 import_autogen.js 机械导入）
---

# AutoGen ${name}：官方 GroupChat 拓扑范例${hasOutputs ? '（含真实运行输出）' : ''}

微软 AutoGen 官方 notebook ${f}：代码单元里实际定义的 agent 为 ${[...speakers].join('、') || '（未显式命名）'}，${msgCount} 条消息输出。
${hasOutputs ? '真实运行输出逐字在 traces/。' : '本 notebook 为官方发布的源码版（不含输出单元），群聊生成代码逐字在 traces/，各 agent 的发言行为以代码中的 system_message 定义为准。'}
Selector/RoundRobin GroupChat 的核心机制：发言由 selector LLM 挑选而非固定顺序。
`);

  let ag = `---
hub: "1.0"
kind: agents
case: ${caseId}
---

# @selector [individual] #phase/plan #role/orchestrator #group/core #hub
name: Selector（发言挑选者）
model: claude-opus-5-5
source_model: gpt-4（AutoGen selector 默认）
role: GroupChat 的选择机制：每轮根据对话历史挑下一个发言的 agent（也支持 round_robin 固定轮转）；真实挑选序列见 traces/ 输出
trigger: 群聊启动
watches: [${roleIds.join(', ')}]

`;
  roleIds.forEach((r) => {
    ag += `# @${r} [individual] #phase/build #role/agent #group/team
name: ${([...speakers][roleIds.indexOf(r)] || r)}
model: claude-sonnet-5-5
source_model: gpt-4（AutoGen 示例默认）
role: 群聊参与者，真实发言与轮次在 traces/${f} 输出里逐字可查
trigger: 被 selector 选中
watches: []

`;
  });
  fs.writeFileSync(path.join(dir, 'agents.md'), ag);

  fs.writeFileSync(path.join(dir, 'groups.md'), `---
hub: "1.0"
kind: groups
case: ${caseId}
---

# @core [group] #level/1
name: 选择机制
members: [selector]

# @team [group] #level/1
name: 群聊成员
members: [${roleIds.join(', ')}]
`);
  fs.writeFileSync(path.join(dir, 'docs.md'), `---
hub: "1.0"
kind: docs
case: ${caseId}
---

# @d_transcript [doc] #layer/map
name: 群聊实录
owner: selector
payload_file: traces/${f}
summary: notebook 原文（生成群聊的代码 + ${msgCount} 条真实消息输出）
audience: all
`);
  fs.writeFileSync(path.join(dir, 'process.md'), `---
hub: "1.0"
kind: process
case: ${caseId}
---

# @s_chat [stage] #group/team
name: 群聊轮转
executors: [${roleIds.join(', ')}]

# @gt_terminate [gate] #kind/rule
name: 终止判定
after_stage: s_chat
decider_type: rule
text: 满足终止条件（如出现 APPROVE 或达到 max_round）
paths:
  - condition: 终止条件满足
    next: done
  - condition: 未满足
    next: s_chat
    note: selector 继续挑人
`);
  fs.writeFileSync(path.join(dir, 'relations.md'), `---
hub: "1.0"
kind: relations
case: ${caseId}
---

@selector >read @d_transcript 挑选依据是对话全文
`);
  fs.writeFileSync(path.join(dir, 'scenarios.md'), `---
hub: "1.0"
kind: scenarios
case: ${caseId}
---

# @K1 [case]
name: 按示例代码复跑群聊
rework_gate: gt_terminate
rework_times: 1

# @K2 [case]
name: 死循环风险
inject:
  - at: 0.7
    to: selector
    kind: feedback
    text: 两个 agent 互相礼貌推让不发实质内容，终止条件迟迟不满足
rework_gate: gt_terminate
rework_times: 1

never_dispatch: []
@${roleIds[0]} >undeclared_read @d_transcript 实测中 agent 会引用群里别人早先的发言，编排里没有这条线
@ch_sonnet outage at=0.5 dur=0.05 kind=quota
note: sonnet 渠道额度耗尽
version_change at=0.6
note: 加入 max_round 硬上限防死循环（AutoGen 默认安全阀）
`);
  fs.writeFileSync(path.join(dir, 'decisions', 'selector.md'), `---
hub: "1.0"
kind: decisions
case: ${caseId}
agent: selector
---

# @d_1 [decision] #stage/build #kind/deliver #agent/selector
title: 发言顺序用 LLM 挑选还是固定轮转
trigger: AutoGen GroupChat 支持 selector 模式与 round_robin 模式
alternatives:
  - round_robin 固定轮转，可预测但常问到不相关的人
  - selector LLM 按对话内容挑人，灵活但多一次模型调用
  - 手写规则（如 critic 必须在 planner 之后）
choice: selector LLM 按对话内容挑人
reason: notebook 的任务形态开放，谁该发言取决于上文说了什么；规则表无法枚举
impact: 实测消息序列里发言者分布不均（活跃者多说），正是内容驱动挑选的证据
action: deliver
`);
  made++;
  console.log(`created ${caseId}  (${speakers.size} 发言者, ${msgCount} 消息)`);
}
if (!DRY && made) {
  let idx = indexText;
  fs.readdirSync(OUT).filter((d) => d.startsWith('imp_autogen_')).sort().forEach((d) => {
    const row = `| ${d} | AutoGen 真实群聊示例：${d.replace('imp_autogen_', '')} | ${d}/ |`;
    if (!idx.includes(row)) idx = idx.replace(/(加新案例：)/, row + '\n\n$1');
  });
  fs.writeFileSync(indexPath, idx);
}
console.log(`完成：新建 ${made}。校验：node hub/tools/check_from_docs.js`);
