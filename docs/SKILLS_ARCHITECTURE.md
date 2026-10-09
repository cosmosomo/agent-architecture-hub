# Skill 架构 - 60 个可复用智能体

**事实来源：** `v41/AGENT_TEAMS_CONFIGURATOR_v41.html`（`AGENT_EDU_PL` 对象）

## 概述

60 个智能体被提取为 `~/.claude/skills/` 中的独立 skill 文件。每个智能体是一个自包含的 `.md` 文件，带 YAML frontmatter + 完整的操作提示词。skill 是全局的 - 它们在所有项目中都能工作，而不只是 Agent Architecture。

**重要：** skill 是参考文件（智能体提示词的唯一事实来源）。Claude Code 不会在会话开始时自动发现它们。命令（`~/.claude/commands/`）在编排团队时使用这些提示词。

## 文件结构

```
~/.claude/skills/                    # GLOBAL (all projects)

# Orchestration & Strategy (4)
  orchestrator.md                    # Strategy / opus
  synthesizer.md                     # Strategy / sonnet
  synthesizer_lean.md                # Strategy / opus
  decision_advisor.md                # Strategy / sonnet

# Planning (2)
  analyst.md                         # Planning / sonnet
  planner.md                         # Planning / sonnet

# Research (10)
  res_tech.md                        # Research / haiku
  res_ux.md                          # Research / haiku
  res_reddit.md                      # Research / haiku
  res_x.md                           # Research / sonnet
  res_github.md                      # Research / sonnet
  res_forums.md                      # Research / sonnet
  res_docs.md                        # Research / haiku
  res_critic.md                      # Research / sonnet
  res_extractor.md                   # Research / haiku
  recipe_scout.md                    # Research / sonnet

# Build (18)
  backend.md                         # Build / sonnet
  frontend.md                        # Build / sonnet
  feature.md                         # Build / sonnet
  designer.md                        # Build / sonnet
  integrator.md                      # Build / sonnet
  writer.md                          # Build / sonnet
  technical_writer.md                # Build / sonnet
  mobile_developer.md                # Build / sonnet
  db_architect.md                    # Build / sonnet
  observability_engineer.md          # Build / sonnet
  style_profiler.md                  # Build / sonnet
  voice_writer.md                    # Build / sonnet
  voice_qa.md                        # Build / haiku
  social_strategist.md               # Build / sonnet
  career_document_builder.md         # Build / sonnet
  interview_coach.md                 # Build / sonnet
  taste_recommender.md               # Build / sonnet
  recipe_filter.md                   # Build / haiku

# QA / Audit (5)
  qa_security.md                     # QA / haiku
  qa_quality.md                      # QA / haiku
  qa_perf.md                         # QA / haiku
  qa_manager.md                      # QA / sonnet
  accessibility_tester.md            # QA / sonnet

# Five Minds - adversarial debate (5)
  expert_pragmatist.md               # Debate / opus
  expert_innovator.md                # Debate / opus
  expert_analyst.md                  # Debate / opus
  expert_user.md                     # Debate / opus
  expert_devil.md                    # Debate / opus

# HITL (1)
  decision_presenter.md              # HITL / haiku

# Data & AI (6)
  ml_engineer.md                     # Data / sonnet
  data_engineer.md                   # Data / sonnet
  ai_engineer.md                     # Data / sonnet
  prompt_engineer.md                 # Data / sonnet
  statistician.md                    # Data / sonnet
  eda_analyst.md                     # Data / sonnet

# Infra / Ops (5)
  devops_engineer.md                 # Ops / sonnet
  cloud_architect.md                 # Ops / sonnet
  sre_engineer.md                    # Ops / sonnet
  kubernetes_specialist.md           # Ops / sonnet
  telemetry_surfer.md                # Ops / sonnet

# Product (3)
  product_manager.md                 # Product / sonnet
  ux_researcher.md                   # Product / sonnet
  gtm_strategist.md                  # Product / sonnet

# Compliance (1)
  control_mapper.md                  # Compliance / sonnet
```

共 60 个智能体：**42 个 Sonnet、11 个 Haiku、7 个 Opus**。

## skill 文件格式

```yaml
---
name: "Agent name from v41 tagline"
description: "Full mission statement from AGENT_EDU_PL.missionShort"
model: opus/sonnet/haiku
effort: low/medium/high/xhigh
phase: strategy/planning/research/build/qa/debate/hitl/data/ops/product/compliance
tools: [Read, Write, Edit, Bash, Grep, Glob, Agent, WebSearch, WebFetch]
bestFor:
  - "When to use this agent (from AGENT_EDU_PL.bestFor)"
worstFor:
  - "When NOT to use this agent (from AGENT_EDU_PL.worstFor)"
---

ROLE: [from missionShort - full mission statement]
INPUT: [from inputs - what the agent receives]
OUTPUT: [from outputs - what the agent produces]
RESPONSIBILITIES: [from does - numbered operational duties]
RULES: [from howItWorks - operational steps with descriptions]
WHAT YOU DO NOT DO: [from doesNotDo - explicit boundaries]
ANTI-PATTERNS: [from antiPatterns - named failure modes per agent]
REPORT FORMAT: [structured output template]
```

`effort` 是与 `model` 并列的第二个路由维度 - 映射与理由见
[`ROUTING_SYSTEM.md`](ROUTING_SYSTEM.md#effort-per-agent)。普通的
`node generate_skills.js` 运行绝不会覆盖它，只有 `--all` 才会重写，且即便如此也会保留
你本地文件中的既有值（确切合并逻辑见 `generate_skills.js`）- 它的设计意图是让每个用户
可以手动调优，而不必与重新生成器对抗。

### 包含字段（操作性 - 每个智能体约 1,000 token）

| 字段 | AGENT_EDU_PL 中的来源 | 用途 |
|-------|----------------------|---------|
| name | tagline（破折号之前） | 身份标识 |
| description | missionShort | 路由/发现 |
| model | stats[Model] | 成本路由 |
| bestFor/worstFor | bestFor/worstFor | 路由决策 |
| ROLE | missionShort | 智能体的使命 |
| INPUT/OUTPUT | inputs/outputs | 契约 |
| RESPONSIBILITIES | does | 操作职责 |
| RULES | howItWorks | 分步流程 |
| WHAT YOU DO NOT DO | doesNotDo | 边界 |
| ANTI-PATTERNS | antiPatterns | 失败预防 |

### 排除字段（教育性 - 为每个智能体节省 token）

| 字段 | 排除原因 |
|-------|-------------|
| tagline | UI 装饰 |
| whoIs | 百科用的人物设定描述 |
| analogy | 教育性比喻 |
| keyConcepts | 教学性定义 |
| glossary | 面向用户的词典 |
| learningQuote | 激励性文字 |
| realExample | 教育性叙事 |
| relatedAgents | 关系图可视化数据 |
| stats（非 model） | UI 指标展示 |

## 工作原理

1. **参考文件：** skill 是包含完整智能体提示词的 `.md` 文件 - 它们不会自动加载进上下文
2. **被命令使用：** 当预设命令（例如 `/deep-five-minds`）运行时，它会引用其智能体的 skill 提示词
3. **全局作用域：** `~/.claude/skills/` 中的 skill 在所有项目中都能工作
4. **单一事实来源：** 改一次提示词 - 所有用到该智能体的预设都会随之更新
5. **重新生成：** 运行 `node generate_skills.js` 从最新 HTML 创建缺失的 skill，或用 `--all` 做全量且保留 effort 值的重新同步

## 与预设（命令）的关系

```
~/.claude/skills/          = Individual agents (reusable building blocks, 60 files)
~/.claude/commands/        = Team presets (orchestration + skill references, 62 files, GLOBAL)
~/.claude/PRESET_CATALOG.md = Routing catalog (which preset for which task - hand-maintained, see ROUTING_SYSTEM.md)
~/.claude/CLAUDE.md         = Routing instructions (how to match tasks to presets)
```

命令编排智能体团队。skill 定义单个智能体。命令只包含编排逻辑（阶段、闸口、连接）和一张
skill 引用表 - 它们不重复智能体提示词。这就是单一事实来源设计：改一次 skill 文件 ->
所有用到该智能体的预设都会获得更新。

**跨项目复用：** 所有命令都位于 `~/.claude/commands/`（全局）。没有本地
`.claude/commands/` - 预设在所有项目中都能工作。

## 模型路由

| 层级 | 模型 | 用途 | 价格（每百万 token 输入/输出） |
|------|-------|---------|------|
| 旗舰 | Opus 5（也包括 4.8） | 编排者、5 位五心智（Five Minds）辩论专家、synthesis-lean | $5 / $25 |
| 主力 | Sonnet 5 | 构建智能体、QA 管理、规划者、大多数研究者 | $2 / $10 |
| 快速 | Haiku 4.5 | 研究扫描（技术、UX、Reddit、文档）、轻量 QA（安全、质量、性能）、HITL 呈现 | $1 / $5 |
| 高端（可用，默认未分配） | Fable 5.1 | - | $10 / $50 |

## 提示词结构

全部 60 个智能体遵循相同的 8 段结构，来源于 `AGENT_EDU_PL`：
- **ROLE** - 完整使命陈述（来自 missionShort）
- **INPUT** - 接收什么（来自 inputs）
- **OUTPUT** - 产出什么（来自 outputs）
- **RESPONSIBILITIES** - 编号的职责列表（来自 does）
- **RULES** - 操作步骤（来自 howItWorks）
- **WHAT YOU DO NOT DO** - 明确的边界（来自 doesNotDo）
- **ANTI-PATTERNS** - 每个智能体的具名失败模式（来自 antiPatterns）
- **REPORT FORMAT** - 结构化输出模板

## 重新生成脚本

项目根目录的两个脚本从最新 HTML 重新生成整个系统。两者都默认**只创建缺失的部分** -
完整操作说明和 `--all` 标志见 [`INSTALL.md`](../INSTALL.md)。

### generate_skills.js（智能体）

从 HTML 提取 `AGENT_EDU_PL`，并为尚无 skill 文件的智能体生成 skill 文件。

```bash
node generate_skills.js          # only missing skills
node generate_skills.js --all    # rewrite every skill file (keeps existing effort: values)
```

- 直接从 HTML 解析出 JavaScript 对象（花括号匹配+求值）
- 只过滤出单个智能体（跳过预设条目）
- 只提取操作字段（见上表）
- 从脚本内的 `AGENT_META` 配置映射 phase/tools
- 写入 `~/.claude/skills/`

### generate_commands.js（预设）

转换命令文件：剥离内联智能体提示词，替换为 skill 引用。

```bash
node generate_commands.js          # only missing commands
node generate_commands.js --all    # rewrite every command file (this resets agent/model choices)
```

- 从 HTML 解析 `PM`/`PR` 对象（带模型覆盖的预设智能体组合）
- 为每个命令文件：写入一张指向 `~/.claude/skills/` 的 `## REFERENCES TO SKILLS` 表
- 保留编排逻辑（阶段、闸口、连接、通用规则）
- 写入 `~/.claude/commands/`
- 最后打印覆盖率报告：没有命令的预设、没有 skill 的智能体、没有对应预设的命令

**规则：** 始终从最新版本的 HTML（`v41/`）重新生成。绝不要用旧命令文件或旧版本作为来源 -
每个脚本顶部的 `HTML_PATH` 之所以固定在 v41，正是出于这个原因。

## 添加新智能体

1. 将该智能体的定义加入 HTML（`AGENT_EDU_PL` 对象）
2. 将该智能体的 ID 连同 phase/tools 加入 `generate_skills.js` 的 `AGENT_META`
3. 运行 `node generate_skills.js` 生成 skill 文件
4. 将该智能体加入 HTML 中的预设（`PR` 对象）
5. 运行 `node generate_commands.js` 更新命令文件中的新 skill 引用
6. 若创建了新预设则更新 `PRESET_CATALOG.md`（见 [`ROUTING_SYSTEM.md`](ROUTING_SYSTEM.md)）
