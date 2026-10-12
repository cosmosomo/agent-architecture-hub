#!/usr/bin/env node
/**
 * import_whowhen.js — Who&When 失败归因数据集（184 条 Magentic-One 系真实运行失败案例）
 * 导入为 hub 文档案例。每条含完整消息历史（history 逐字）、出错智能体、出错步骤、失败原因。
 *
 * 产出：imp_whowhen_<source>_<n>/ —— history 逐字进 traces/，失败归因 → scenario K 场景 + 决策。
 *
 * 用法：
 *   node hub/tools/import_whowhen.js --sample 4      # 每来源抽 4 条（默认）
 *   node hub/tools/import_whowhen.js --dry
 */
const fs = require('fs');
const path = require('path');

const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const has = (k) => argv.includes('--' + k);

const SRC = arg('src', path.resolve(__dirname, '../../../../case_library/cloud/academic/WhoAndWhen/Who&When'));
const OUT = arg('out', path.resolve(__dirname, '../../cases/_reference/whowhen'));
const SAMPLE = parseInt(arg('sample', '4'), 10);
const DRY = has('dry');

const oneLine = (s) => String(s || '').replace(/\s+/g, ' ').trim();
const slug = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 24) || 'agent';

if (!fs.existsSync(SRC)) { console.error('数据源不存在: ' + SRC); process.exit(2); }

const subdirs = fs.readdirSync(SRC).filter((d) => fs.statSync(path.join(SRC, d)).isDirectory()).sort();
const indexPath = path.join(OUT, '_index.md');
const indexText = fs.existsSync(indexPath) ? fs.readFileSync(indexPath, 'utf8') : '';
let made = 0, n = 0;

for (const sub of subdirs) {
  const files = fs.readdirSync(path.join(SRC, sub)).filter((f) => f.endsWith('.json')).sort((a, b) => parseInt(a) - parseInt(b)).slice(0, SAMPLE);
  for (const f of files) {
    n++;
    let j;
    try { j = JSON.parse(fs.readFileSync(path.join(SRC, sub, f), 'utf8')); } catch (e) { console.error('跳过坏文件 ' + f + ': ' + e.message); continue; }
    /* 内容哈希 id：全量导入不漂移、不重复 */
    const qid = String(j.question_ID || '').replace(/[^a-f0-9]/gi, '').slice(0, 8) || slug(oneLine(j.question)).slice(0, 8) + n;
    const caseId = `imp_whowhen_${sub === 'Hand-Crafted' ? 'hc' : 'ag'}_${qid}`;
    const dir = path.join(OUT, caseId);
    if (fs.existsSync(dir)) continue;   // 目录在即跳过；索引行由末尾追加逻辑去重
    if (DRY) { console.log(`will create ${caseId}  (${oneLine(j.question).slice(0, 50)}…)`); made++; continue; }

    fs.mkdirSync(path.join(dir, 'traces'), { recursive: true });
    fs.mkdirSync(path.join(dir, 'decisions'), { recursive: true });
    fs.mkdirSync(path.join(dir, 'attachments'), { recursive: true });

    /* traces/：消息历史逐字 */
    fs.writeFileSync(path.join(dir, 'traces', 'history.json'), JSON.stringify(j.history, null, 1));
    fs.writeFileSync(path.join(dir, 'traces', 'index.json'), JSON.stringify({ files: ['history.json'], note: '提案 B 批准后进 model.sourceTraces' }, null, 2));

    /* 算法生成源带 system_prompt 字典：逐字提取每个智能体的角色定义（无损） */
    const sp = (j.system_prompt && typeof j.system_prompt === 'object') ? j.system_prompt : null;
    const spBySlug = {};
    if (sp) {
      Object.entries(sp).forEach(([name, text]) => {
        const rid = slug(name);
        spBySlug[rid] = { name, text };
        fs.writeFileSync(path.join(dir, 'attachments', `agent_${rid}_prompt.md`), `# 原始 system prompt（${name}）\n\n${text}\n`);
      });
    }

    /* 失败归因要素 */
    const bad = slug(j.mistake_agent || 'orchestrator');
    const step = parseInt(j.mistake_step, 10) || 0;
    const reason = oneLine(j.mistake_reason || '');
    const totalMsgs = (j.history || []).length;
    const atFrac = totalMsgs ? Math.min(0.95, Math.max(0.1, step / totalMsgs)) : 0.5;

    fs.writeFileSync(path.join(dir, 'meta.md'), `---
hub: "1.0"
kind: meta
case: ${caseId}
source: https://github.com/ag2ai/Agents_Failure_Attribution Who&When/${sub}/${f}（脚本 import_whowhen.js 机械导入）
---

# Who&When 失败归因案例：${oneLine(j.question).slice(0, 60)}…

${sub} 来源的真实失败运行：任务「${oneLine(j.question)}」，标准答案「${oneLine(j.ground_truth)}」。
运行在 Magentic-One 系系统上失败，归因定位到第 ${step} 步的 ${j.mistake_agent}：${reason}。
完整消息历史（${totalMsgs} 条）逐字保存在 traces/history.json；本案例是该失败的结构视图。
`);

    /* agents：有 system_prompt 字典时用真实智能体名单，否则 Magentic-One 系默认角色 */
    let roles;
    if (sp && Object.keys(sp).length) {
      roles = Object.keys(sp).map(slug);
    } else {
      roles = ['orchestrator', 'websurfer', 'coder', 'terminal', 'filesurfer'];
    }
    if (!roles.includes(bad)) roles.push(bad);
    const hubRole = roles.includes('orchestrator') ? 'orchestrator' : roles[0];
    let ag = `---
hub: "1.0"
kind: agents
case: ${caseId}
---

# @${hubRole} [individual] #phase/plan #role/orchestrator #group/core #hub
name: ${sp ? Object.keys(sp).find((n) => slug(n) === hubRole) || hubRole : 'Orchestrator'}
model: claude-opus-5-5
source_model: gpt-4o
role: ${sp ? 'manager-worker 拓扑的调度中枢（Who&When 标注的 manager），角色定义见 attachments' : '维护任务账本并委派执行（Magentic-One 系实测系统）'}；本次运行的归因见案例摘要与 traces（不写进定义）
trigger: 人类提交任务
watches: [${roles.filter((r) => r !== hubRole).join(', ')}]

`;
    roles.filter((r) => r !== hubRole).forEach((r) => {
      ag += `# @${r} [individual] #phase/build #role/executor #group/team
name: ${spBySlug[r] ? spBySlug[r].name : r}
model: claude-sonnet-5-5
source_model: gpt-4o
${spBySlug[r] ? `prompt_file: attachments/agent_${r}_prompt.md\n` : ''}role: ${spBySlug[r] ? oneLine(spBySlug[r].text).slice(0, 180) : 'Magentic-One 系实测执行角色'}；实际行为见 traces/history.json（归因与失败原因在评价侧，不写进定义）
trigger: 收到编排者委派
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
name: 编排
members: [${hubRole}]

# @team [group] #level/1
name: 执行
members: [${roles.filter((r) => r !== 'orchestrator').join(', ')}]
`);
    fs.writeFileSync(path.join(dir, 'docs.md'), `---
hub: "1.0"
kind: docs
case: ${caseId}
---

# @d_task [doc] #layer/consensus
name: 任务与标准答案
owner: orchestrator
summary: 任务「${oneLine(j.question).slice(0, 100)}」；标准答案「${oneLine(j.ground_truth)}」
audience: all

# @d_history [doc] #layer/map
name: 实测消息历史
owner: orchestrator
payload_file: traces/history.json
summary: ${totalMsgs} 条消息逐字档案（提案 B 批准后进 model.sourceTraces）
audience: all
`);
    fs.writeFileSync(path.join(dir, 'process.md'), `---
hub: "1.0"
kind: process
case: ${caseId}
---

# @s_plan [stage] #group/core
name: 账本初始化与计划
executors: [${hubRole}]

# @s_exec [stage] #group/team
name: 委派执行循环
executors: [${roles.filter((r) => r !== hubRole).join(', ')}]

# @s_finish [stage] #group/core
name: 终答核对
executors: [${hubRole}]

# @gt_answer [gate] #kind/rule
name: 标准答案比对
after_stage: s_finish
decider_type: rule
text: 最终答案与 ground_truth「${oneLine(j.ground_truth)}」一致
paths:
  - condition: 答案正确
    next: done
  - condition: 答案错误（本次实测即如此）
    next: s_exec
    note: 回到执行循环定位出错步骤
`);
    fs.writeFileSync(path.join(dir, 'relations.md'), `---
hub: "1.0"
kind: relations
case: ${caseId}
---

@orchestrator >read @d_history 复盘逐条消息定位第 ${step} 步
`);

    fs.writeFileSync(path.join(dir, 'scenarios.md'), `---
hub: "1.0"
kind: scenarios
case: ${caseId}
---

# @K1 [case]
name: 实测失败复现：${bad} 第 ${step} 步
inject:
  - at: ${atFrac.toFixed(2)}
    to: ${bad}
    kind: feedback
    text: ${reason}
blocked_at: gt_answer

# @K2 [case]
name: 假设 ${bad} 第 ${step} 步做对了
rework_gate: gt_answer
rework_times: 1

never_dispatch: []
@${bad} >undeclared_read @d_history 实测中执行角色直接翻看历史消息，编排里没有这条线
@ch_sonnet outage at=0.6 dur=0.05 kind=quota
note: sonnet 渠道额度耗尽
version_change at=${atFrac.toFixed(2)}
note: 依据本次失败，编排者开始对 ${bad} 的关键动作要求二次确认
`);
    fs.writeFileSync(path.join(dir, 'decisions', hubRole + '.md'), `---
hub: "1.0"
kind: decisions
case: ${caseId}
agent: ${hubRole}
---

# @d_1 [decision] #stage/build #kind/escalate #agent/${hubRole}
title: ${bad} 在第 ${step} 步失误后如何处置
trigger: ${reason}
alternatives:
  - 只重派第 ${step} 步，相信后续步骤不受影响
  - 回滚到出错点之前的账本状态重新规划
  - 向人类呈报失败并请求新的任务边界
choice: 回滚到出错点之前的账本状态重新规划
reason: 失败发生在过程中间（第 ${step}/${totalMsgs} 步），其产出已被后续步骤消费，只重派一步无法清除污染
impact: 对应 Who&When 的归因结论——错误定位到具体智能体与具体步骤后，回滚比局部修补更可靠
action: escalate
`);

    made++;
    console.log(`created ${caseId}  (${sub}, 第${step}步 ${bad} 失误)`);
  }
}

if (!DRY && made) {
  let idx = indexText;
  fs.readdirSync(OUT).filter((d) => d.startsWith('imp_whowhen_')).sort().forEach((d) => {
    const row = `| ${d} | Who&When 失败归因：${d.replace('imp_whowhen_', '')} | ${d}/ |`;
    if (!idx.includes(row)) idx = idx.replace(/(加新案例：)/, row + '\n\n$1');
  });
  fs.writeFileSync(indexPath, idx);
}
console.log(`完成：新建 ${made}。校验：node hub/tools/check_from_docs.js`);
