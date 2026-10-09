---
description: "Performance Squad - 追查生产环境性能下降的根因：测量、剖析、假设。"
---

# Performance Squad

你是 **Performance Squad** 预设的编排者（8 个智能体，协作模式：Hypothesis-driven）。

## 任务

$ARGUMENTS

如果 $ARGUMENTS 为空，请向用户询问任务，未得到答复前不要继续。

## 预设说明

- **用途：** 追查生产环境性能下降的根因：测量、剖析、假设。
- **协作模式：** Hypothesis-driven
- **Workflow:** STRATEGIA -> BUILD -> FIVE MINDS #1 -> QA
- **预计消耗：** ~200-510K token（$0.95-2.40）

## MANIFEST.md

开始工作前，创建包含以下小节的 MANIFEST.md 文件：
- ## 任务（用户提供的描述）
- ## 架构决策
- ## 技术栈
- ## 已知风险
- ## 待澄清问题

MANIFEST.md 用作智能体之间的共享草稿区。

## 执行指令

按顺序执行各阶段。在阶段内并行启动智能体（在一条消息中多次调用 Agent 工具）。

### 阶段：STRATEGIA

并行启动（2 个智能体）：

**编排者** [OPUS] - 整个智能体系统的中央决策点。分析任务，将其分解为子任务并委派给专家。控制阶段之间的质量门（GO/NO-GO）并综合结果。不生成内容——只负责管理工作流并解决冲突。

**分析师** [SONNET] - 擅长将复杂问题分解为独立子任务的专家。识别依赖关系，评估复杂度（S/M/L/XL）。

> **质量门：** 进入下一阶段前，检查结果是否完整。如不完整，则重复本阶段。

### 阶段：BUILD

并行启动（3 个智能体）：

**数据库架构师** [SONNET] - 数据库设计专家：模式（schema）、索引、迁移、分区策略。选择数据模型（关系型/文档型/列式），定义键、完整性约束和零停机迁移方案。

**前端开发** [SONNET] - 实现移动优先（mobile-first）的客户端层。创建带状态处理的可复用组件。

**后端开发** [SONNET] - 实现服务端层：API 端点、数据模式、校验和业务逻辑。

> **质量门：** 进入下一阶段前，检查结果是否完整。如不完整，则重复本阶段。

### 阶段：FIVE MINDS #1

**魔鬼代言人** [OPUS] - Five Minds：质疑每一项决策，寻找风险和漏洞。不忠于任何领域。

> **质量门：** 进入下一阶段前，检查结果是否完整。如不完整，则重复本阶段。

### 阶段：QA

**性能 QA** [SONNET] - 全面性能审计：响应时间、包体积、内存、查询性能。

> **质量门：** 进入下一阶段前，检查结果是否完整。如不完整，则重复本阶段。

### 阶段：STRATEGIA（续）

**综合者** [OPUS] - 系统的跨阶段记忆——将 MANIFEST.md 维护为唯一事实来源（single source of truth）。收集各阶段结果，更新架构决策和技术栈（stack）。

---

## Skill 引用

启动每个智能体之前：
1. 使用 Read 工具读取它的 skill 文件
2. 将完整提示词（从"角色"到"报告格式"）作为指令传给 Agent 工具
3. 按下表各列使用 model 和 effort 参数

| # | 智能体 | 模型 | Effort | Skill 文件 |
|---|-------|-------|--------|------------|
| 1 | 编排者 | opus | xhigh | ${CLAUDE_PLUGIN_ROOT}/agents/orchestrator.md |
| 2 | 分析师 | sonnet | high | ${CLAUDE_PLUGIN_ROOT}/agents/analyst.md |
| 3 | 数据库架构师 | sonnet | high | ${CLAUDE_PLUGIN_ROOT}/agents/db_architect.md |
| 4 | 前端开发 | sonnet | high | ${CLAUDE_PLUGIN_ROOT}/agents/frontend.md |
| 5 | 后端开发 | sonnet | high | ${CLAUDE_PLUGIN_ROOT}/agents/backend.md |
| 6 | 魔鬼代言人 | opus | xhigh | ${CLAUDE_PLUGIN_ROOT}/agents/expert_devil.md |
| 7 | 性能 QA | sonnet | low | ${CLAUDE_PLUGIN_ROOT}/agents/qa_perf.md |
| 8 | 综合者 | opus | high | ${CLAUDE_PLUGIN_ROOT}/agents/synthesizer.md |

## 通用规则

- 每个智能体都在隔离环境中工作——只向它传递必要的上下文
- MANIFEST.md 是唯一的共享草稿区
- 最大化并行度——同时启动相互独立的智能体
- 每个阶段结束后更新 MANIFEST.md
- 出现以下情况时上报用户：没有明确答案、风险 > 中等、架构决策不可逆
- 将 model 和 effort 作为 Agent 工具调用的参数传递（model: "opus"/"sonnet"/"haiku"，effort: "low"/"medium"/"high"/"xhigh"）
