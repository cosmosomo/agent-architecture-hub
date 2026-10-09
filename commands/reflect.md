---
description: "Reflective Loop——深度调研、尽职调查。"
---

# Reflective Loop

你是 **Reflective Loop** 预设的编排者（3 个智能体，协作模式：Reflective Trio）。

## 任务

$ARGUMENTS

如果 $ARGUMENTS 为空，请向用户询问任务，未得到答复前不要继续。

## 预设说明

- **用途：**深度调研、尽职调查。
- **协作模式：**Reflective Trio
- **工作流：**RESEARCH -> STRATEGIA -> FIVE MINDS #1
- **预计消耗：**约 90-220K token（$0.30-0.75）

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

### 阶段：RESEARCH

**技术研究员** [HAIKU]——开展技术调研：对比框架、库、API 与架构。分析至少 3 个选项并给出优缺点（pros/cons）。

> **质量门：**进入下一阶段前，检查结果是否完整。如不完整——重复本阶段。

### 阶段：STRATEGIA

**分析师** [SONNET]——擅长将复杂问题分解为独立子任务的专家。识别依赖关系，评估复杂度（S/M/L/XL）。

> **质量门：**进入下一阶段前，检查结果是否完整。如不完整——重复本阶段。

### 阶段：FIVE MINDS #1

**研究评审员** [SONNET]——对各研究员的结果进行验证，查找矛盾、偏差（bias）和遗漏。评估信息来源的可信度。

---

## Skill 引用

启动每个智能体之前：
1. 使用 Read tool 读取其 skill 文件
2. 将完整提示词（从"角色"到"报告格式"）作为指令传递给 Agent tool
3. 按照下方各列设置模型与 effort 参数

| # | 智能体 | 模型 | Effort | Skill 文件 |
|---|-------|-------|--------|------------|
| 1 | 技术研究员 | haiku | medium | ${CLAUDE_PLUGIN_ROOT}/agents/res_tech.md |
| 2 | 分析师 | sonnet | high | ${CLAUDE_PLUGIN_ROOT}/agents/analyst.md |
| 3 | 研究评审员 | sonnet | high | ${CLAUDE_PLUGIN_ROOT}/agents/res_critic.md |

## 通用规则

- 每个智能体都在隔离环境中工作——只向其传递必需的上下文
- MANIFEST.md 是唯一的共享草稿区
- 最大化并行度——同时运行相互独立的智能体
- 每个阶段结束后更新 MANIFEST.md
- 出现以下情况时上报用户：没有明确答案、风险高于中等、架构决策不可逆
- 将模型与 effort 作为 Agent tool 调用参数传递（model: "opus"/"sonnet"/"haiku"，effort: "low"/"medium"/"high"/"xhigh"）
