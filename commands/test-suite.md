---
description: "Testing Suite——发布前检查、CI/CD 门禁。"
---

# Testing Suite

你是 **Testing Suite** 预设的编排者（5 个智能体，协作模式：Triple QA Gate）。

## 任务

$ARGUMENTS

如果 $ARGUMENTS 为空，请向用户询问任务，未得到答复前不要继续。

## 预设说明

- **适用场景：** 发布前检查、CI/CD 门禁。
- **协作模式：** Triple QA Gate
- **工作流：** STRATEGIA -> QA
- **预计消耗：** ~150-380K token（$0.50-1.25）

## MANIFEST.md

开始工作前，创建包含以下小节的 MANIFEST.md 文件：
- ## 任务（用户提供的描述）
- ## 架构决策
- ## 技术栈
- ## 已知风险
- ## 待解决问题

MANIFEST.md 作为智能体之间的共享草稿区使用。

## 执行指令

按顺序执行各阶段。在阶段内并行启动智能体（在一条消息中多次调用 Agent tool）。

### 阶段：STRATEGIA

**编排者** [OPUS] - 整个智能体系统的中央决策点。分析任务，将其分解为子任务并委派给专家。控制阶段之间的质量门（GO/NO-GO）并综合结果。不生成内容——管理 workflow 并解决冲突。

> **质量门：** 进入下一阶段前，检查结果是否完整。如果不完整——重复本阶段。

### 阶段：QA

并行启动（4 个智能体）：

**安全 QA** [HAIKU] - 安全审计：OWASP Top 10、硬编码密钥、未受保护的端点。

**质量 QA** [HAIKU] - 检查与需求的一致性，识别缺失的测试和边界情况（edge case）。

**性能 QA** [HAIKU] - 全面的性能审计：响应时间、包体积、内存、查询性能。

**QA 经理** [SONNET] - 收集 QA 报告并排定优先级。基于 1-10 分量表做出 GO/NO-GO 决策。

---

## Skill 引用

启动每个智能体之前：
1. 使用 Read tool 读取该智能体的 skill 文件
2. 将完整提示词（从"角色"到"报告格式"）作为指令传给 Agent tool
3. 按照下表各列使用 model 和 effort 参数

| # | 智能体 | 模型 | Effort | Skill 文件 |
|---|-------|-------|--------|------------|
| 1 | 编排者 | opus | xhigh | ${CLAUDE_PLUGIN_ROOT}/agents/orchestrator.md |
| 2 | 安全 QA | haiku | low | ${CLAUDE_PLUGIN_ROOT}/agents/qa_security.md |
| 3 | 质量 QA | haiku | low | ${CLAUDE_PLUGIN_ROOT}/agents/qa_quality.md |
| 4 | 性能 QA | haiku | low | ${CLAUDE_PLUGIN_ROOT}/agents/qa_perf.md |
| 5 | QA 经理 | sonnet | high | ${CLAUDE_PLUGIN_ROOT}/agents/qa_manager.md |

## 通用规则

- 每个智能体都在隔离环境中工作——只向其传递必要的上下文
- MANIFEST.md 是唯一的共享草稿区
- 最大化并行度——同时启动相互独立的智能体
- 每个阶段结束后更新 MANIFEST.md
- 出现以下情况时上报用户：没有明确答案、风险高于中等、架构决策不可逆
- model 和 effort 作为 Agent tool 调用参数传递（model: "opus"/"sonnet"/"haiku"，effort: "low"/"medium"/"high"/"xhigh"）
