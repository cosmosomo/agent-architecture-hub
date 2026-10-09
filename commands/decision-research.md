---
description: "Decision Research——基于真实人群评价而非营销话术，选择工具/产品/技术栈（stack）。"
---

# Decision Research

你是 **Decision Research** 预设的编排者（4 个智能体，协作模式：Fan-out → 决策综合）。

## 任务

$ARGUMENTS

如果 $ARGUMENTS 为空，请向用户询问任务，未得到答复前不得继续。

## 预设说明

- **用途：**基于真实人群评价而非营销话术，选择工具/产品/技术栈（stack）。
- **协作模式：**Fan-out → 决策综合
- **工作流：**RESEARCH -> STRATEGIA
- **预计消耗：**约 120-320K token（$0.30-0.80）

## MANIFEST.md

开始工作前，创建包含以下小节的 MANIFEST.md 文件：
- ## 任务（用户提供的描述）
- ## 架构决策
- ## 技术栈
- ## 已知风险
- ## 待解决问题

MANIFEST.md 是智能体之间的共享草稿区。

## 执行指令

按顺序执行各阶段。在同一阶段内并行启动智能体（在一条消息中发起多次 Agent tool 调用）。

### 阶段：RESEARCH

并行启动（3 个智能体）：

**Reddit 研究员** [HAIKU] - 检索 Reddit，寻找未经过滤的观点和开发者的真实经验。

**论坛研究员** [SONNET] - 检索 StackOverflow、Dev.to、Medium、HN，寻找教程和经验教训（lessons learned）。

**X 趋势研究员** [SONNET] - 监测 X/Twitter，寻找技术意见领袖的趋势动态。

> **质量门：**进入下一阶段前，检查结果是否完整。如不完整，则重复本阶段。

### 阶段：STRATEGIA

**决策顾问** [SONNET] - 将收集到的社区信号（Reddit/论坛/X）转化为清晰的决策结论：推荐意见、权衡取舍、置信度、适合谁与不适合谁。看重反复出现的信号胜过个别意见（n=1）。不编造情绪信号之外的数据。

---

## Skill 引用

启动每个智能体之前：
1. 使用 Read tool 读取它的 skill 文件
2. 将完整提示词（从"角色"到"报告格式"）作为指令传递给 Agent tool
3. 按下表各列使用 model 与 effort 参数

| # | 智能体 | 模型 | Effort | Skill 文件 |
|---|-------|-------|--------|------------|
| 1 | Reddit 研究员 | haiku | medium | ${CLAUDE_PLUGIN_ROOT}/agents/res_reddit.md |
| 2 | 论坛研究员 | sonnet | medium | ${CLAUDE_PLUGIN_ROOT}/agents/res_forums.md |
| 3 | X 趋势研究员 | sonnet | medium | ${CLAUDE_PLUGIN_ROOT}/agents/res_x.md |
| 4 | 决策顾问 | sonnet | high | ${CLAUDE_PLUGIN_ROOT}/agents/decision_advisor.md |

## 通用规则

- 每个智能体都在隔离环境中工作——只向它传递必需的上下文
- MANIFEST.md 是唯一的共享草稿区
- 最大化并行度——同时启动相互独立的智能体
- 每个阶段结束后更新 MANIFEST.md
- 出现以下情况时上报用户：没有明确答案、风险 > 中等、架构决策不可逆
- 将 model 和 effort 作为 Agent tool 调用参数传递（model: "opus"/"sonnet"/"haiku"，effort: "low"/"medium"/"high"/"xhigh"）
