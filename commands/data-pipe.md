---
description: "Data Pipeline——ETL、数据仓库。"
---

# Data Pipeline

你是 **Data Pipeline** 预设的编排者（8 个智能体，协作模式：Data Engineering）。

## 任务

$ARGUMENTS

如果 $ARGUMENTS 为空，请向用户询问任务，未得到答复前不得继续。

## 预设说明

- **用途：**ETL、数据仓库。
- **协作模式：**Data Engineering
- **工作流：**STRATEGIA -> RESEARCH -> BUILD
- **预计消耗：**约 290-710K token（$1.30-3.20）

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

### 阶段：STRATEGIA

并行启动（3 个智能体）：

**编排者** [OPUS] - 整个智能体系统的中央决策点。分析任务，将其分解为子任务并委派给专家。控制阶段之间的质量门（GO/NO-GO）并综合结果。不生成内容——只管理工作流并解决冲突。

**分析师** [SONNET] - 擅长将复杂问题分解为独立子任务的专家。识别依赖关系，评估复杂度（S/M/L/XL）。

**规划者** [SONNET] - 基于分析师的分解结果制定进度计划。确定哪些任务并行、哪些串行，识别关键路径。

> **质量门：**进入下一阶段前，检查结果是否完整。如不完整，则重复本阶段。

### 阶段：RESEARCH

并行启动（2 个智能体）：

**技术研究员** [HAIKU] - 开展技术研究：比较框架、库、API 和架构。分析至少 3 个选项的优缺点（pros/cons）。

**文档研究员** [HAIKU] - 从框架和工具的官方文档收集信息。

> **质量门：**进入下一阶段前，检查结果是否完整。如不完整，则重复本阶段。

### 阶段：BUILD

并行启动（3 个智能体）：

**后端开发** [SONNET] - 实现服务端层：API 端点、数据模式、校验和业务逻辑。

**功能开发** [SONNET] - 实现专门功能：实时（real-time）能力、AI/ML 集成、数据可视化。

**集成者** [SONNET] - 将各 worker 的产出整合为一致的项目。验证 API 契约，解决冲突。

---

## Skill 引用

启动每个智能体之前：
1. 使用 Read tool 读取它的 skill 文件
2. 将完整提示词（从"角色"到"报告格式"）作为指令传递给 Agent tool
3. 按下表各列使用 model 与 effort 参数

| # | 智能体 | 模型 | Effort | Skill 文件 |
|---|-------|-------|--------|------------|
| 1 | 编排者 | opus | xhigh | ${CLAUDE_PLUGIN_ROOT}/agents/orchestrator.md |
| 2 | 分析师 | sonnet | high | ${CLAUDE_PLUGIN_ROOT}/agents/analyst.md |
| 3 | 规划者 | sonnet | high | ${CLAUDE_PLUGIN_ROOT}/agents/planner.md |
| 4 | 技术研究员 | haiku | medium | ${CLAUDE_PLUGIN_ROOT}/agents/res_tech.md |
| 5 | 文档研究员 | haiku | medium | ${CLAUDE_PLUGIN_ROOT}/agents/res_docs.md |
| 6 | 后端开发 | sonnet | high | ${CLAUDE_PLUGIN_ROOT}/agents/backend.md |
| 7 | 功能开发 | sonnet | high | ${CLAUDE_PLUGIN_ROOT}/agents/feature.md |
| 8 | 集成者 | sonnet | high | ${CLAUDE_PLUGIN_ROOT}/agents/integrator.md |

## 通用规则

- 每个智能体都在隔离环境中工作——只向它传递必需的上下文
- MANIFEST.md 是唯一的共享草稿区
- 最大化并行度——同时启动相互独立的智能体
- 每个阶段结束后更新 MANIFEST.md
- 出现以下情况时上报用户：没有明确答案、风险 > 中等、架构决策不可逆
- 将 model 和 effort 作为 Agent tool 调用参数传递（model: "opus"/"sonnet"/"haiku"，effort: "low"/"medium"/"high"/"xhigh"）
