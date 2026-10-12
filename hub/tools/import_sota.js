#!/usr/bin/env node
/**
 * import_sota.js — 本地 SOTA 生产系统快照导入（自产多智能体系统的真实运行数据）。
 * 源：case_library/sota_cases/data/snapshot/
 *   agents.json 48 个智能体（完整 role 提示词、model、executor_kind、budget）
 *   runs.json 1170 条运行记录 / tasks.json 168 条任务 / trajectory_results.json 轨迹统计
 * 产出：imp_sota_prod/ —— 48 角色全部建模（role 逐字进 attachments + prompt_file 引用），
 *       四份数据文件逐字进 traces/。用法：node hub/tools/import_sota.js [--dry]
 */
const fs = require('fs');
const path = require('path');

const SRC = path.resolve(__dirname, '../../../sota_cases/data/snapshot');
const OUT = path.resolve(__dirname, '../cases_imported');
const DRY = process.argv.includes('--dry');
const caseId = 'imp_sota_prod';
const slug = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 30) || 'x';
const oneLine = (s) => String(s || '').replace(/\s+/g, ' ').trim();

const agents = JSON.parse(fs.readFileSync(path.join(SRC, 'agents.json'), 'utf8'));
const runs = JSON.parse(fs.readFileSync(path.join(SRC, 'runs.json'), 'utf8'));
const tasks = JSON.parse(fs.readFileSync(path.join(SRC, 'tasks.json'), 'utf8'));
const runList = Array.isArray(runs) ? runs : Object.values(runs);
const taskList = Array.isArray(tasks) ? tasks : Object.values(tasks);

const states = {};
runList.forEach((r) => { states[r.state] = (states[r.state] || 0) + 1; });
const kinds = {};
agents.forEach((a) => { kinds[a.executor_kind] = (kinds[a.executor_kind] || 0) + 1; });
const models = {};
agents.forEach((a) => { models[a.model] = (models[a.model] || 0) + 1; });
console.log(`agents ${agents.length}, runs ${runList.length} (${Object.entries(states).map(([s, n]) => `${s}:${n}`).join(' ')}), tasks ${taskList.length}`);
console.log('executor kinds:', JSON.stringify(kinds), 'models:', JSON.stringify(models));
if (DRY) process.exit(0);

const dir = path.join(OUT, caseId);
if (fs.existsSync(dir)) { console.log('skip ' + caseId); process.exit(0); }
fs.mkdirSync(path.join(dir, 'traces'), { recursive: true });
fs.mkdirSync(path.join(dir, 'decisions'), { recursive: true });
fs.mkdirSync(path.join(dir, 'attachments'), { recursive: true });

/* traces/：四份生产数据逐字 */
['agents.json', 'runs.json', 'tasks.json', 'trajectory_results.json'].forEach((f) => {
  fs.copyFileSync(path.join(SRC, f), path.join(dir, 'traces', f));
});
fs.writeFileSync(path.join(dir, 'traces', 'index.json'), JSON.stringify({
  files: ['agents.json', 'runs.json', 'tasks.json', 'trajectory_results.json'],
  note: '2026-10-07 生产快照逐字；提案 B 批准后进 model.sourceTraces',
}, null, 2));

/* attachments：每个智能体的 role 提示词逐字 */
agents.forEach((a, i) => {
  fs.writeFileSync(path.join(dir, 'attachments', `agent_${String(i + 1).padStart(2, '0')}_${slug(a.name)}.md`),
    `# 原始 role 定义（${a.name} / ${a.agent_id}）\n\n${a.role || ''}\n`);
});

/* meta.md */
fs.writeFileSync(path.join(dir, 'meta.md'), `---
hub: "1.0"
kind: meta
case: ${caseId}
source: E:\\program\\GIT\\Agent\\multi\\sota_cases\\data\\snapshot（2026-10-07 生产快照，脚本 import_sota.js 机械导入）
---

# SOTA 生产系统：同构执行位池 + 编排派发 + 黑板协作（实测快照）

本地生产系统的 2026-10-07 快照：${agents.length} 个智能体（执行器 ${Object.entries(kinds).map(([k, n]) => `${k}×${n}`).join('、')}，
模型 ${Object.entries(models).map(([m, n]) => `${m}×${n}`).join('、')}），
${runList.length} 条运行记录（状态分布 ${Object.entries(states).map(([s, n]) => `${s}:${n}`).join('、')}），${taskList.length} 条任务全生命周期。
协作模式：角色在任务文件里定义而非系统里定义——执行位同构，按需求文件（B1、C1、D、E、S1…）领取工作，
产物写共享黑板目录。这是本库唯一自产系统的实测数据。
每个智能体的完整 role 定义逐字在 attachments/，四份生产数据文件逐字在 traces/。
`);

/* agents.md：48 个全部建模 */
let ag = `---
hub: "1.0"
kind: agents
case: ${caseId}
---

`;
const leadLike = agents.find((a) => /编排|orchestr|指挥|统筹/i.test(a.name || a.role || ''));
agents.forEach((a, i) => {
  const isFirst = (leadLike && a.agent_id === leadLike.agent_id) || (!leadLike && i === 0);
  const tier = isFirst ? 'opus' : /审核|review|qa|质检/i.test(a.name || '') ? 'sonnet' : 'sonnet';
  ag += `# @a${String(i + 1).padStart(2, '0')} [individual] #phase/${isFirst ? 'plan' : 'build'} #role/${isFirst ? 'orchestrator' : 'executor'} #group/${isFirst ? 'command' : 'pool'}${isFirst ? ' #hub' : ''}
name: ${a.name}
model: claude-${tier}-5-5
source_model: ${a.model}
executor_kind: ${a.executor_kind}
prompt_file: attachments/agent_${String(i + 1).padStart(2, '0')}_${slug(a.name)}.md
role: ${oneLine(a.role).slice(0, 200)}
trigger: ${isFirst ? '人类发起 SOTA 轮次任务' : '任务文件派发后领取工作'}
watches: []

`;
});
fs.writeFileSync(path.join(dir, 'agents.md'), ag);

/* groups.md：指挥 + 执行位池 */
fs.writeFileSync(path.join(dir, 'groups.md'), `---
hub: "1.0"
kind: groups
case: ${caseId}
---

# @command [group] #level/1
name: 指挥位
members: [${leadLike ? 'a01' : 'a01'}]

# @pool [group] #level/1
name: 同构执行位池
members: [${agents.map((_, i) => `a${String(i + 1).padStart(2, '0')}`).filter((id) => id !== 'a01').join(', ')}]
`);

/* docs.md */
fs.writeFileSync(path.join(dir, 'docs.md'), `---
hub: "1.0"
kind: docs
case: ${caseId}
---

# @d_blackboard [doc] #layer/consensus
name: 黑板（共享产物目录）
owner: a01
summary: 执行位的产物只写需求允许的位置（E:\\program\\sota 黑板），本库快照不含产物本体
audience: all

# @d_runs [doc] #layer/map
name: 运行记录档案
owner: a01
payload_file: traces/runs.json
summary: ${runList.length} 条运行逐字档案（状态机、起止时间、exit_code、usage、任务关联）
audience: all

# @d_tasks [doc] #layer/map
name: 任务全生命周期
owner: a01
payload_file: traces/tasks.json
summary: ${taskList.length} 条任务逐字档案
audience: all

# @d_traj [doc] #layer/map
name: 轨迹结构统计
owner: a01
payload_file: traces/trajectory_results.json
summary: 成功运行的轨迹步骤分类统计（步骤分类/失败数/时长/上下文增长）
audience: all
`);

/* process.md：按真实状态机 */
fs.writeFileSync(path.join(dir, 'process.md'), `---
hub: "1.0"
kind: process
case: ${caseId}
---

# @s_dispatch [stage] #group/command
name: 任务派发
executors: [a01]

# @s_exec [stage] #group/pool
name: 执行位作业
executors: [${agents.slice(1, 7).map((_, i) => `a${String(i + 2).padStart(2, '0')}`).join(', ')}]

# @s_review [stage] #group/pool
name: 评审态（awaiting_review）
executors: [${agents.slice(1, 4).map((_, i) => `a${String(i + 2).padStart(2, '0')}`).join(', ')}]

# @gt_done [gate] #kind/rule
name: 完成判定
after_stage: s_review
decider_type: rule
text: 运行 exit_code=0 且通过评审（实测 ${states['finished'] || '—'} finished / ${states['failed'] || '0'} failed）
paths:
  - condition: 完成并交付黑板
    next: done
  - condition: 失败或被打回
    next: s_exec
    note: 重新领取或修改后重跑
`);

/* relations.md */
fs.writeFileSync(path.join(dir, 'relations.md'), `---
hub: "1.0"
kind: relations
case: ${caseId}
---

@a01 >read @d_runs 派发与回收
@a02 >read @d_blackboard 执行位只写需求允许的位置
`);

/* scenarios.md：从真实状态分布取材 */
fs.writeFileSync(path.join(dir, 'scenarios.md'), `---
hub: "1.0"
kind: scenarios
case: ${caseId}
---

# @K1 [case]
name: 实测主流路径复跑（finished ${states['finished'] || 0} 条）
rework_gate: gt_done
rework_times: 1

# @K2 [case]
name: 实测失败路径（failed ${states['failed'] || 0} 条）
inject:
  - at: 0.6
    to: a02
    kind: feedback
    text: 产物位置或格式不符合需求文件约定，评审态打回重做
rework_gate: gt_done
rework_times: 1

# @K3 [case]
name: 评审堆积
blocked_at: gt_done

never_dispatch: []
@a03 >undeclared_read @d_runs 实测中执行位会翻看运行记录对齐上轮产物，编排里没有这条线
@ch_sonnet outage at=0.5 dur=0.05 kind=quota
note: sonnet 渠道额度耗尽（实测对应银子渠道限流）
version_change at=0.5
note: 快照期内引入任务文件的角色定义模板（B1/C1/D/E/S 系列需求文件）
`);

/* decisions：预算与派发 */
fs.writeFileSync(path.join(dir, 'decisions', 'a01.md'), `---
hub: "1.0"
kind: decisions
case: ${caseId}
agent: a01
---

# @d_1 [decision] #stage/plan #kind/deliver #agent/a01
title: 角色定义放系统里还是任务里
trigger: ${agents.length} 个执行位同构，任务却需要异构角色
alternatives:
  - 每个任务定制专属 agent 实例
  - 同构执行位池，角色写在任务需求文件里
  - 固定几类角色复用
choice: 同构执行位池，角色写在任务需求文件里
reason: 执行位只认需求文件（B1/C1/D/E/S 系列），角色随任务灵活组合，系统层保持简单；实测 48 位全部同构运转
impact: 接近 Manus Wide Research 的同构哲学，但保留本地编排者做派发与回收
action: deliver

# @d_2 [decision] #stage/build #kind/yield #agent/a01
title: 产物写工作区副本还是黑板
trigger: 执行位把产物写进了 AP 工作区，评审层找不到
alternatives:
  - 接受工作区副本作为交付
  - 坚持只认黑板目录，打回重写
choice: 坚持只认黑板目录，打回重写
reason: role 定义里写明"产物直接写 E:\\program\\sota 黑板，AP 工作区里的副本不算交付"——交付契约必须唯一
impact: 失败运行中的一部分即由此打回，评审态保证了契约一致性
action: yield
`);

console.log(`created ${caseId}  (${agents.length} 角色, ${runList.length} runs 逐字)`);
