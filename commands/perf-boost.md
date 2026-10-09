---
description: "Performance Boost - API 优化、Core Web Vitals。"
---

# Performance Boost

你是 **Performance Boost** 预设的编排者（4 个智能体，协作模式：Measure-Fix Cycle）。

## 任务

$ARGUMENTS

如果 $ARGUMENTS 为空，请向用户询问任务，未得到答复前不要继续。

## 预设说明

- **用途：** API 优化、Core Web Vitals。
- **协作模式：** Measure-Fix Cycle
- **Workflow:** STRATEGIA -> BUILD -> QA
- **预计消耗：** ~160-390K token（$0.65-1.55）

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

**分析师** [SONNET] - 擅长将复杂问题分解为独立子任务的专家。识别依赖关系，评估复杂度（S/M/L/XL）。

> **质量门：** 进入下一阶段前，检查结果是否完整。如不完整，则重复本阶段。

### 阶段：BUILD

**后端开发** [SONNET] - 实现服务端层：API 端点、数据模式、校验和业务逻辑。

> **质量门：** 进入下一阶段前，检查结果是否完整。如不完整，则重复本阶段。

### 阶段：QA

**性能 QA** [HAIKU] - 全面性能审计：响应时间、包体积、内存、查询性能。

> **质量门：** 进入下一阶段前，检查结果是否完整。如不完整，则重复本阶段。

### 阶段：BUILD（续）

**集成者** [SONNET] - 将各 worker 的工作整合为连贯的项目。验证 API 契约，解决冲突。

---

## Skill 引用

启动每个智能体之前：
1. 使用 Read 工具读取它的 skill 文件
2. 将完整提示词（从"角色"到"报告格式"）作为指令传给 Agent 工具
3. 按下表各列使用 model 和 effort 参数

| # | 智能体 | 模型 | Effort | Skill 文件 |
|---|-------|-------|--------|------------|
| 1 | 分析师 | sonnet | high | ${CLAUDE_PLUGIN_ROOT}/agents/analyst.md |
| 2 | 后端开发 | sonnet | high | ${CLAUDE_PLUGIN_ROOT}/agents/backend.md |
| 3 | 性能 QA | haiku | low | ${CLAUDE_PLUGIN_ROOT}/agents/qa_perf.md |
| 4 | 集成者 | sonnet | high | ${CLAUDE_PLUGIN_ROOT}/agents/integrator.md |

## 通用规则

- 每个智能体都在隔离环境中工作——只向它传递必要的上下文
- MANIFEST.md 是唯一的共享草稿区
- 最大化并行度——同时启动相互独立的智能体
- 每个阶段结束后更新 MANIFEST.md
- 出现以下情况时上报用户：没有明确答案、风险 > 中等、架构决策不可逆
- 将 model 和 effort 作为 Agent 工具调用的参数传递（model: "opus"/"sonnet"/"haiku"，effort: "low"/"medium"/"high"/"xhigh"）
