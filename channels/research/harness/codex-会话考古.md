# Codex · 会话考古（harness 普查）

2026-10-20 · research-codex · 全量普查，数字可复跑：`node channels/probe/scripts/harness/census_codex_claude.mjs codex` → `codex-census.json`

## 关键信息

存储：`~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl`（171 文件、49,914 行，envelope 格式 `timestamp, type, payload`）+ `~/.codex/archived_sessions/`（2 文件 96 行，同格式归档）+ `~/.codex/state_5.sqlite` + `~/.codex/goals_1.sqlite`（目标元数据跨进程持久化）+ 配置 `config.toml` / `hooks.json` / `AGENTS.md` / `skills/`。

### 转录（上下文装配 + 推理 + 工具系统）

| 顶层类型 | 条数 | harness 归属 |
|---|---|---|
| response_item | 20,297 | 模型响应流：message(3,656) / function_call(3,601) / function_call_output(3,600) / reasoning(3,557) / custom_tool_call(2,855) / custom_tool_call_output(2,854) / agent_message(170) / additional_tools(4) |
| event_msg | 17,169 | 事件总线：item_completed(11,566) / token_count(3,788) / task_started(671) / task_complete(603) / thread_settings_applied(491) / turn_aborted(50) |
| token_usage_record | 3,499 | 每轮模型调用的 token 精细账本（input/cached/cache_write/output/reasoning/total） |
| function_call / function_call_output | 各 1,937 | 旧版工具调用记录（逐行配对） |
| reasoning | 1,150 | 独立推理记录（加密内容标记） |
| message | 803 | 开发者/系统消息（技能清单、AGENTS.md 注入等） |
| turn_context | 439 | 轮级上下文快照（cwd、workspace_roots、approval_policy、sandbox_policy、model、effort、current_date、timezone） |
| world_state | 285 | 全量环境状态注入（AGENTS.md 全文、技能目录、工作区文件树） |
| inter_agent_communication_metadata | 170 | 多智能体通信元数据（spawn_agent、send_message、wait_agent 等协调） |
| session_meta | 141 | 会话元数据头：creator、cwd、cli_version、model_provider、base_instructions、originator |
| compacted | 51 | **上下文压缩事件**（预算与压缩的直接证据） |
| retained_context | 2 | 压缩后保留的上下文引用 |

**item_completed 内部类型**（工具执行与副作用的落盘细粒度）：
- CommandExecution 3,959（含命令、cwd、exit_code、duration）
- Reasoning 3,494
- AgentMessage 1,993（子智能体间对话）
- FileChange 760（统一 diff 格式）
- UserMessage 716
- McpToolCall 271
- SubAgentActivity 151（启动/完成/交互、ref 指向子线程）
- Extension 131
- ContextCompaction 51（与 compacted 对应，含 message 字段）
- ImageView 26
- CollabAgentToolCall 14（spawn_agent 等协同工具的接收线程列表）

### 预算与压缩

- **token_count**（3,788 条 event_msg）：每轮结束推送的 `info.total_token_usage`、`last_token_usage`、`turn_token_usage`、`thread_token_usage`，同时携带 `rate_limits.primary/secondary.used_percent` 与 `resets_at` ——**预算监控的原始数据流**。
- **thread_settings_applied**（491 条）：模型、reasoning_effort、approval_policy、permission_profile.type、model_provider_id 变更落盘。
- **compacted / ContextCompaction**（各 51 条）：自动压缩在 `pre_request` 阶段触发（见 parser `addCompaction`），记录 `message`（压缩摘要文本）、操作时间。`response_item.additional_tools`（4 条）为压缩后注入模型的工具列表（开发者消息，非对话）。
- **turn_context**（439 条）：每轮开始时的上下文快照，含 `model_context_window: 475000`、`collaboration_mode_kind`。

### 组织（主循环 / 队列 / 插话 / 计划 / 多智能体）

- **task_started / task_complete / turn_aborted**（671 / 603 / 50）：轮的生命周期边界。`turn_id`/`root_turn_id` 关联、`time_to_first_token_ms`、`duration_ms`、`last_agent_message`、错误原因。
- **inter_agent_communication_metadata**（170 条）：内置工具 `spawn_agent`、`send_message`、`wait_agent`、`wait`、`list_agents`、`followup_task`、`interrupt_agent`、`close_agent`、`send_input`、`resume_agent` 的调用元数据（`receiver_thread_ids`、`agent_thread_id`、`agent_path`）。
- **response_item.agent_message**（170 条）：子智能体消息内容，含 `author`/`recipient`/`phase`。
- **SubAgentActivity**（151 条 item_completed）：子智能体 `started/completed/交互`，`ref` 指向子线程 sessionId。
- **CollabAgentToolCall**（14 条）：协同工具的 `receiver_thread_ids` 列表。
- **thread_goal_updated**（event_msg 内，数量未单独计数）：目标 `objective/status/tokenBudget` 变更通知。

### 记忆与设置（会话之外）

- `~/.codex/config.toml`：请求重试、流重试、idle 超时、代理等防断流参数。
- `~/.codex/hooks.json`：11 类生命周期事件契约（PreToolUse、PostToolUse、SessionStart、Stop 等）。
- `~/.codex/AGENTS.md`：级联加载的指令文档。
- `~/.codex/skills/`：技能目录（每技能一个 SKILL.md）。
- `state_5.sqlite`：会话状态、检查点（schema 需进一步读库）。
- `goals_1.sqlite`：thread goal 元数据持久化（跨进程恢复后 `thread/goal/get` 可读回）。

### 会话里看不到的（留给抓请求/读源码）

- 系统提示词全文（`base_instructions` 只在 session_meta 里出现一次，后续不再落盘）。
- 技能清单、AGENTS.md 的具体拼装顺序与注入时机（只在 message/developer 里见到片段）。
- 压缩后实际发给模型的消息序列（只看到 `compacted.message` 摘要，不见完整压缩后上下文）。
- 权限审批决策过程（仅见 `approval_policy` 变更，无审批记录）。
- 模型请求体原文（发给 OpenAI Responses API 的 JSON）。

依据：条数=普查脚本实测可复跑（`census_codex_claude.mjs`）；各类型语义=样本直读+解析器 `trace/packages/adapters/src/codex/parse.ts` 字段映射；"何时为何注入"为暂定判断，标推测处已注明。