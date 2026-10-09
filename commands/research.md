---
description: "Research Swarm——尽职调查、技术栈选型。"
---

# Research Swarm

你是 **Research Swarm** 预设的编排者（9 个智能体，协作模式：Fan-out → Critique）。

## 任务

$ARGUMENTS

如果 $ARGUMENTS 为空，请向用户询问任务，未得到答复前不要继续。

## 预设说明

- **用途：**尽职调查、技术栈选型。
- **协作模式：**Fan-out → Critique
- **工作流：**STRATEGIA -> RESEARCH -> FIVE MINDS #1
- **预计消耗：**约 260-660K token（$0.80-2.05）

## MANIFEST.md

开始工作前，创建包含以下小节的 MANIFEST.md 文件：
- ## 任务（用户提供的描述）
- ## 架构决策
- ## 技术栈
- ## 已知风险
- ## 开放问题

MANIFEST.md 是智能体之间的共享草稿区。

## 执行指令

按顺序执行各阶段。在同一阶段内并行运行智能体（在同一条消息中多次调用 Agent tool）。

### 阶段：STRATEGIA

**编排者** [OPUS]——整个智能体系统的中央决策点。分析任务，将其分解为子任务并委派给各专家。控制各阶段之间的质量门（GO/NO-GO），并综合结果。不生成内容——负责管理工作流并解决冲突。

> **质量门：**进入下一阶段前，检查结果是否完整。如不完整——重复本阶段。

### 阶段：RESEARCH

并行运行（6 个智能体）：

**技术研究员** [HAIKU]——开展技术调研：对比框架、库、API 与架构。分析至少 3 个选项并给出优缺点（pros/cons）。

**Reddit 研究员** [HAIKU]——检索 Reddit，寻找未经过滤的观点和开发者的真实经验。

**GitHub 研究员** [SONNET]——检索与项目相似的开源仓库。分析架构、技术栈（stack）与 README。

**论坛研究员** [SONNET]——检索 StackOverflow、Dev.to、Medium、HN，寻找教程与经验教训（lessons learned）。

**文档研究员** [HAIKU]——从框架和工具的官方文档收集信息。

**X 趋势研究员** [SONNET]——监测 X/Twitter，捕捉技术意见领袖的趋势动态。

> **质量门：**进入下一阶段前，检查结果是否完整。如不完整——重复本阶段。

### 阶段：FIVE MINDS #1

**研究评审员** [SONNET]——对各研究员的结果进行验证，查找矛盾、偏差（bias）和遗漏。评估信息来源的可信度。

> **质量门：**进入下一阶段前，检查结果是否完整。如不完整——重复本阶段。

### 阶段：STRATEGIA（续）

**综合者** [SONNET]——系统的跨阶段记忆——将 MANIFEST.md 维护为唯一事实来源（single source of truth）。收集各阶段的结果，更新架构决策与技术栈（stack）。

---

## Skill 引用

启动每个智能体之前：
1. 使用 Read tool 读取其 skill 文件
2. 将完整提示词（从"角色"到"报告格式"）作为指令传递给 Agent tool
3. 按照下方各列设置模型与 effort 参数

| # | 智能体 | 模型 | Effort | Skill 文件 |
|---|-------|-------|--------|------------|
| 1 | 编排者 | opus | xhigh | ${CLAUDE_PLUGIN_ROOT}/agents/orchestrator.md |
| 2 | 技术研究员 | haiku | medium | ${CLAUDE_PLUGIN_ROOT}/agents/res_tech.md |
| 3 | Reddit 研究员 | haiku | medium | ${CLAUDE_PLUGIN_ROOT}/agents/res_reddit.md |
| 4 | GitHub 研究员 | sonnet | medium | ${CLAUDE_PLUGIN_ROOT}/agents/res_github.md |
| 5 | 论坛研究员 | sonnet | medium | ${CLAUDE_PLUGIN_ROOT}/agents/res_forums.md |
| 6 | 文档研究员 | haiku | medium | ${CLAUDE_PLUGIN_ROOT}/agents/res_docs.md |
| 7 | X 趋势研究员 | sonnet | medium | ${CLAUDE_PLUGIN_ROOT}/agents/res_x.md |
| 8 | 研究评审员 | sonnet | high | ${CLAUDE_PLUGIN_ROOT}/agents/res_critic.md |
| 9 | 综合者 | sonnet | high | ${CLAUDE_PLUGIN_ROOT}/agents/synthesizer.md |

## 通用规则

- 每个智能体都在隔离环境中工作——只向其传递必需的上下文
- MANIFEST.md 是唯一的共享草稿区
- 最大化并行度——同时运行相互独立的智能体
- 每个阶段结束后更新 MANIFEST.md
- 出现以下情况时上报用户：没有明确答案、风险高于中等、架构决策不可逆
- 将模型与 effort 作为 Agent tool 调用参数传递（model: "opus"/"sonnet"/"haiku"，effort: "low"/"medium"/"high"/"xhigh"）
