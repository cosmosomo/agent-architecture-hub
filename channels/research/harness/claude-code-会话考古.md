# Claude Code · 会话考古（harness 普查）

2026-10-20 · research-claude · 全量普查，数字可复跑：`node channels/probe/scripts/harness/census_codex_claude.mjs claude-code` → `claude-code-census.json`

## 关键信息

存储：`~/.claude/projects/<编码后的工作目录>/<uuid>.jsonl`（581 文件、351,265 行）+ 子智能体 `subagents/agent-<id>.jsonl` + 记忆文件 `memory/` + 配置 `settings.json` / `settings.local.json` / `keybindings.json` + 供应商切换 `.cc-switch/`。

### 转录（上下文装配 + 推理 + 工具系统）

| 顶层类型 | 条数 | harness 归属 |
|---|---|---|
| assistant | 119,230 | 模型响应：含 `message.model`、`message.content`（text/thinking/tool_use）、`message.usage`（input/cache_read/cache_creation/output tokens） |
| attachment | 74,010 | **上下文注入的主力**：见下表 attachment 子类型详细分布 |
| user | 64,073 | 用户消息：`message.content` 为字符串或 blocks（text/tool_result/image），工具结果嵌在 user 消息的 `tool_result` 块中 |
| last-prompt | 15,313 | 最后一条用户提示（用于恢复/显示） |
| atis-latch | 15,252 | 会话锁/同步标记 |
| custom-title | 14,104 | 用户自定义会话标题 |
| agent-name | 12,770 | 智能体名称（主/子） |
| mode | 11,444 | 模式切换记录（plan/auto/read 等） |
| queue-operation | 9,980 | **队列操作**：enqueue/dequeue/reorder/clear ——插话与排队的直接证据 |
| system | 5,973 | 系统元数据：见下表 subtype 分布 |
| file-history-delta | 3,094 | 文件历史增量（检查点/回退） |
| file-history-snapshot | 2,606 | 文件历史快照（检查点/回退） |
| pr-link | 1,461 | PR 关联链接 |
| frame-link | 531 | 界面帧关联 |
| cost-state | 405 | **预算记账**：`totalCostUSD`、`totalLinesAdded/Removed`、`modelUsage` 累计 |
| permission-mode | 323 | 权限模式变更（reads/all/plan 等） |
| relocated | 285 | 会话迁移记录 |
| ai-title | 218 | AI 自动生成标题 |
| bridge-session | 102 | 桥接会话标记 |
| isolation-latch | 36 | 隔离锁 |
| artifact-comment-monitor | 33 | 产物评论监控 |
| artifact-autoreact-ledger | 22 | 产物自动反应账本 |

**attachment 子类型**（74,010 条，上下文注入的完整谱系）：

| 子类型 | 条数 | harness 归属与时机 |
|---|---|---|
| total_tokens_reminder | 45,094 | **预算提醒**：上下文接近限制时注入，含 `totalTokens`、`remainingTokens`、`percentage` |
| deferred_tools_record | 5,658 | **工具延迟加载记录**：首轮注入精简工具集，后续按需展开（含 `tools` 列表） |
| environment | 3,525 | 环境快照：`cwd`、`shell`、`platform`、`env` 变量精选、`git` 状态 |
| silent_turn_reminder | 2,571 | 静默轮提醒：模型未产出可见输出时注入 |
| queued_command | 2,233 | **排队命令**：用户在模型忙碌时输入的命令，含 `prompt`、`timestamp` |
| edited_text_file | 1,806 | 编辑过的文本文件引用（含路径、内容片段） |
| output_style | 1,607 | 输出风格注入（含风格定义文本） |
| prompt_snapshot | 1,482 | 提示词快照（用于恢复/对比） |
| deferred_tools_delta | 972 | 工具集增量变更 |
| instructions | 929 | 指令注入（AGENTS.md 片段、自定义指令） |
| skill_listing | 889 | 技能清单注入（可用技能名称+描述） |
| date | 804 | 当前日期注入 |
| model | 779 | 模型信息注入（名称、版本） |
| session_context | 753 | 会话上下文摘要 |
| remote_session_change | 728 | 远程会话变更通知 |
| mcp_instructions_delta | 716 | MCP 指令增量 |
| agent_listing_delta | 677 | 智能体列表增量 |
| file | 469 | 文件引用注入 |
| hook_additional_context | 461 | **Hook 额外上下文**：PreToolUse/PostToolUse/SubagentStart/SubagentStop/Stop 等钩子注入的上下文 |
| hook_success | 393 | Hook 执行成功记录 |
| auto_mode | 362 | 自动模式状态 |
| credential_org | 334 | 凭证组织信息 |
| compact_file_reference | 225 | **压缩文件引用**：压缩后保留的文件引用列表 |
| thinking_drop | 111 | 思考内容丢弃标记 |
| task_reminder | 91 | 任务提醒 |
| task_status | 72 | 任务状态更新 |
| command_permissions | 66 | 命令权限配置 |
| nested_memory | 46 | 嵌套记忆引用 |
| read_truncation_notice | 45 | 读取截断提示 |
| invoked_skills | 29 | 已调用技能记录 |
| plan_mode_exit | 19 | 计划模式退出 |
| plan_mode | 18 | 计划模式进入 |
| budget_usd | 17 | USD 预算提醒 |
| diagnostics | 8 | 诊断信息 |
| date_change | 6 | 日期变更 |
| directory | 5 | 目录引用 |
| skill_mention | 3 | 技能提及触发的技能文本重注入（压缩后） |
| hook_system_message | 2 | Hook 系统消息 |
| output_style_instructions | 2 | 输出风格指令 |
| custom_silent_note | 1 | 自定义静默备注 |
| structured_output | 1 | 结构化输出模板 |
| thinking_stripped | 1 | 思考内容被剥离标记 |

**system 子类型**（5,973 条）：

| 子类型 | 条数 | 说明 |
|---|---|---|
| api_error | 2,907 | API 错误（超时、限流、网络），含 `retryInMs`、`retryAttempt`、`maxRetries` |
| stop_hook_summary | 2,666 | **Stop Hook 摘要**：会话结束时的钩子执行摘要 |
| compact_boundary | 151 | **压缩边界**：上下文压缩发生的分界标记 |
| turn_duration | 144 | 轮持续时间记录 |
| away_summary | 47 | 离开摘要（会话暂停时生成） |
| informational | 33 | 信息性系统消息 |
| local_command | 16 | 本地命令执行标记 |
| model_refusal_fallback | 6 | 模型拒绝回退 |
| model_refusal_no_fallback | 3 | 模型拒绝无回退 |

### 预算与压缩

- **total_tokens_reminder**（45,094 条）：最密集的预算信号，每轮/每次上下文装配都可能注入。
- **cost-state**（405 条）：会话级累计账本，含 USD 成本、行数增删、按模型的 token 用量分解。
- **compact_boundary**（151 条 system）+ **compact_file_reference**（225 条 attachment）：压缩发生的直接证据，标记压缩前后的边界与保留文件。
- **thinking_drop / thinking_stripped**：思考内容被压缩/剥离的标记。
- **deferred_tools_record / deferred_tools_delta**：工具集分批注入，减少首轮上下文占用。

### 组织（主循环 / 队列 / 插话 / 计划 / 模式 / 钩子 / 子智能体）

- **queue-operation**（9,980 条）：`operation: enqueue/dequeue/reorder/clear`，含 `content`（排队的用户输入）、`sessionId`、`timestamp`。这是**插话队列**的完整落盘。
- **mode**（11,444 条）：模式切换（`plan`/`auto`/`read` 等），含 `mode`、`previousMode`。
- **plan_mode / plan_mode_exit**（18/19 条 attachment）：计划模式进入/退出的显式标记。
- **hook_additional_context / hook_success**（461/393 条）：12+ 种 Hook 事件（SessionStart、UserPromptSubmit、PreToolUse、PostToolUse、SubagentStart、SubagentStop、Stop 等）注入的上下文与执行结果。
- **agent_listing_delta / agent-name**（677/12,770 条）：智能体列表变更与命名，子智能体 spawn 的落盘痕迹。
- **bridge-session / isolation-latch**（102/36 条）：跨会话桥接与隔离标记。

### 记忆与设置（会话之外）

- `~/.claude/settings.json` / `settings.local.json`：权限允许列表、Hook 配置、环境变量、模型偏好。
- `~/.claude/keybindings.json`：快捷键绑定。
- `~/AGENTS.md`：全局指令文档（级联加载到所有会话）。
- `~/.claude/projects/<project>/memory/`：项目级记忆文件（如 `E--program-GIT-Agent-multi` 有 44 个文件，`E--program-GIT-Agent-multi-Agent-Architecture-Hub` 有 2 个、`E--program-GIT-Jobs` 有 27 个）。
- `~/.cc-switch/`：供应商切换目录（不同渠道的凭证与配置隔离）。

### 会话里看不到的（留给抓请求/读源码）

- 系统提示词完整拼装顺序（`instructions`/`skill_listing`/`agent_listing_delta`/`mcp_instructions_delta` 只以片段形式落盘）。
- Hook 执行的完整 stdin/stdout（只记成功/失败与额外上下文）。
- 模型请求体原文（发给 Anthropic API 的 JSON，含完整 messages 数组、tools 定义、system prompt）。
- 压缩决策的启发式参数与阈值（只见 `compact_boundary` 结果）。
- 权限审批的具体决策过程（仅记 `permission-mode` 变更）。
- 子智能体内部完整上下文（子会话在单独文件，父会话只见 `agent` 工具调用与 `agent_listing_delta`）。

依据：条数=普查脚本实测可复跑（`census_codex_claude.mjs`）；各类型语义=样本直读+解析器 `trace/packages/adapters/src/claude-code/parse.ts` 字段映射+宿主卡 `channels/hosts/claude-code.md` 实测确认；"何时为何注入"为暂定判断，标推测处已注明。