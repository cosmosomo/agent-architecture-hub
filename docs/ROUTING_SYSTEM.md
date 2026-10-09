# 预设路由系统 - 自动选择智能体团队

**来源：** `Research/research-preset-routing/`（R1-R7 + SYNTHESIS.md）

## 概述

该系统将自然语言任务描述自动匹配到 62 个可用多智能体团队中最合适的预设。用户描述自己的需求 - Claude Code 提出合适的团队。

**状态：** `generate_catalog.js` 从另外两个生成器读取的同一份 HTML 构建 `~/.claude/PRESET_CATALOG.md` - 一行命令见 [`INSTALL.md`](../INSTALL.md#4-optional-auto-routing-from-a-task-description)。不过目录本身不会起任何作用：Claude Code 需要先在你自己的 `~/.claude/CLAUDE.md` 中加入下面的简短路由指令，才会去查询该目录。

### 路由片段 - 复制到你的 `~/.claude/CLAUDE.md`

```markdown
## Agent Architecture routing

When a task is complex enough to benefit from a multi-agent team (multi-step, needs research
from several sources, needs a build+QA cycle) - or the user explicitly asks for a preset/team -
read `~/.claude/PRESET_CATALOG.md`, match the task to the best preset by its "Use when" text,
and propose it by name before running it. For a simple one-step question or a single-file edit,
just answer directly - do not read the catalog.
```

保持这段文字简短（要点在于：在任务真正需要之前，它只消耗近乎为零的 token），并根据你日常使用预设的方式调整触发条件。

## 架构

```
User: "I need to audit security before deploy"
         |
         v
~/.claude/CLAUDE.md          <-- Routing instructions (~100 tok, always loaded)
         |
         v
~/.claude/PRESET_CATALOG.md  <-- 62 presets with descriptions (on-demand)
         |
         v
Claude Code: "I suggest /security-multi-vector (9 agents)..."
         |
         v (user confirms)
~/.claude/commands/security-multi-vector.md  <-- Team preset (GLOBAL, ~500-2,000 tok)
         |
         v (per agent)
~/.claude/skills/qa_security.md              <-- Agent prompt (~1,000 tok, on-demand)
```

## Token 预算

| 组件 | Token | 加载时机 |
|-----------|--------|-------------|
| 路由指令（CLAUDE.md） | ~100 | 始终加载 |
| 预设目录 | ~4,500 | 收到任务描述时（按需，随 62 个预设规模增长） |
| 命令文件（仅编排逻辑） | ~500-2,000 | 确认预设时（按需） |
| skill 文件（每个智能体，按需） | 每个 ~1,000 | 生成子智能体时 |
| **路由总成本** | **~5,100-6,600** | 每次路由事件 |
| **占上下文窗口比例** | **~0.5-0.66%** | 以 1M（Opus/Sonnet）计 |

## 子智能体并发限制

Claude Code 对子智能体并发设有上限：**同时最多运行 20 个子智能体、每会话最多 200 个、
最大嵌套深度 3**。

接近这些上限、可能需要分批执行（以较小批次而非一次性运行全部智能体）以避免限流的预设：
`/deep-five-minds`（27 个智能体）、`/deep-research-v2`（17 个智能体）、
`/deep-research-swarm-pro`（10 个智能体）在同时扇出的变体中。这些预设的编排者应将
研究/抽取扇出分组为每批不超过 20 个智能体。

## 每个智能体的 effort

在当前模型（Fable 5、Opus 4.7/4.8、Sonnet 5）上，手动 `thinking: {budget_tokens: N}` 已被
弃用，现在会返回 400 错误。它已被**自适应思考加 `effort` 参数**（`low` / `medium` /
`high` / `xhigh` / `max`）取代。`xhigh` 是编码/智能体工作的最佳取值，也是 Claude Code
中的默认级别。

每个 skill 的 frontmatter 中都在 `model` 之外携带一个 `effort` 字段。编排者在生成子智能体
时会同时传递两者（Agent/Task 工具支持 `effort` 参数）。覆盖全部 60 个智能体的项目级映射：

| Effort | 适用场景 | 示例智能体 |
|--------|------|-----------------|
| **xhigh** | 决策关键、对抗式推理、战略性综合 | 5 位辩论专家、orchestrator（编排者）、synthesizer_lean |
| **high** | 构建/编码/智能体工作、写作、轻量决策 | backend、frontend、designer、writer、voice_writer、decision_advisor |
| **medium** | 广度优先、工具驱动的研究 | res_forums、res_github、res_x、res_extractor、recipe_scout、style_profiler |
| **low** | 机械/低成本、结构化输出、校验器 | qa_security、qa_quality、res_reddit、decision_presenter、voice_qa、recipe_filter |

经验法则：
- 没有明确需求不要设置 `max` - 它成本高昂且鲜有必要。
- 模型和 effort 是两个独立维度。在编码/智能体任务上，`effort: xhigh` 的 Sonnet 5 通常
  可以替代 Opus（成本大约降低 40%-60%），但在纯分析/决策类工作上不行 - Opus 在那里仍然
  领先。
- 对于长时间的多智能体会话，还提供可选的 `task_budget`（整个智能体循环的硬性 token 上限，
  beta，最低 20K）。

来源：`Research/research-project-expansion-v33/research-recent/RR5_modele_koszty_najnowsze.md`
（3.1-3.3 节）、`Research/research-subagents-task-tool/research/R1_task_tool_api_spec.md`
（Task 工具与 frontmatter 中的 `effort` 参数）。

## 目录结构（PRESET_CATALOG.md）

1. **决策指南** - 意图到预设的映射（快速查找）
2. **62 个预设**按 4 个规模层级分组（完整清单见 README）：
   - Minimal 极简（2-3 个智能体，7 个预设）
   - Core 核心（4-6 个智能体，28 个预设）
   - Advanced 进阶（7-11 个智能体，20 个预设）
   - Enterprise / flagship 企业级/旗舰（12-27 个智能体，7 个预设）
3. **每个预设：**描述 + "Use when"（适用情形）+ "DO NOT use when"（不适用情形）+ "vs" 对比
4. **成本矩阵：**便宜 / 中等 / 昂贵 / 高级 / 旗舰
5. **升级树：**从简单到复杂的升级路径
6. **兜底方案：**从 60 个智能体目录自定义组装流水线

## 研究结论（要点）

- 这种规模的 62 预设系统加模型路由，尚无已知的公开同类产品
- 命令（而非 skill）才是预设的正确机制 - 惰性加载、零启动成本
- CLAUDE.md 路由指令应保持简短（远低于 1K token）- 细节由目录本身承载并按需加载
- 模型路由相比全 Opus 基线大约节省一半成本
- 子智能体隔离：每个子智能体拥有自己的上下文窗口（按每个分支的 MAX 用量估算，而非整个
  运行的 SUM 总和）
- 在这种规模下，上下文工程比提示词工程更重要

## 文件

- 研究报告：`Research/research-preset-routing/R1-R7*.md`
- 综合报告：`Research/research-preset-routing/SYNTHESIS.md`
- 目录：`~/.claude/PRESET_CATALOG.md`（经 `generate_catalog.js` 从 v41 生成）
- 路由：`~/.claude/CLAUDE.md`（Agent Architecture 部分）
- skill：`~/.claude/skills/*.md`（60 个智能体提示词，从 v41 生成）
- 命令：`~/.claude/commands/*.md`（62 个预设，GLOBAL 全局，引用 skill）
- 重新生成：`generate_skills.js`（skill）、`generate_commands.js`（命令）、`generate_catalog.js`（路由目录）- 全部来自同一份 HTML

## 事实来源（仅在更新 Agent Architecture 时）

创建新版本、添加智能体或重新生成 skill 时 - 最新版本的 HTML 是权威来源。若只是
在其他项目中使用预设，则不适用。

- **智能体定义：**HTML 中的 `AGENT_EDU_PL` 对象（每个智能体 17-18 个字段）
- **预设定义：**HTML 中的 `PRESET_EDU_PL` 对象
- **skill 文件：**经 `generate_skills.js` 生成的子集（仅操作字段）
- **命令文件：**仅编排逻辑（阶段、闸口、skill 引用），经 `generate_commands.js` 生成
- **当前版本：**v41（约 3.5 MB）
