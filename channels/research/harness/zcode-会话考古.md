# ZCode · 会话考古（harness 普查）

2026-10-20 · research-acp · 全量普查，数字可复跑：`node channels/probe/scripts/harness/census_harness.mjs zcode` → `zcode-census.json`

## 关键信息

存储：`~/.zcode/cli/db/db.sqlite`（391,486 行，24 表）+ `~/.zcode/v2/tasks-index.sqlite`（1,184 行）+ `~/.zcode/v2/sessions/<项目hash>/*.json`（20 个，全是 claude-import 导入件）。ZCode 是 SQLite 制，不是 JSONL 制；转录主表 `message`/`part` 的种类藏在 `data` JSON 里。

### 转录（上下文装配 + 工具系统）

| 表 | 行数 | 种类分布 | harness 归属 |
|---|---|---|---|
| message | 62,844 | assistant 53,304 / user 9,540 | 转录主表（每轮模型输出与用户输入） |
| part | 228,774 | tool 56,645 · step-start 51,616 · step-finish 50,771 · text 35,169 · reasoning 33,534 · timeline 886 · **compaction 94** · file 59 | 按部件拆开的一轮：工具调用与结果、步进边界（step-start/finish=主循环节拍）、推理流、**压缩事件** |

- **compaction part**（预算与压缩）：`{type:"compaction", auto:true, trigger:"auto", phase:"pre_request", compactReason:"context_limit", operationId:"cmp_…", attempt:3, maxAttempts:3, preCompactTokenCount:888803, timelineDisplay:"separator"}`。**在请求前自动触发、有操作号和重试计数，压缩失败也留痕**（样本里有一条因供应商内容拦截 1301 失败 3 次的记录）。时机：pre_request + context_limit。
- step-start/finish 数量≈50K：每步模型请求都有边界记录，是主循环节拍的直接证据。
- tool part 的 output 里偶见 `<system-reminder>` 文本（如大文件只读部分提示"Use Read with offset…"）——提示注入是**工具结果的包装**，不是独立记录种类。

### 组织（主循环/队列/插话/计划/检查点）

| 表 | 行数 | 字段/分布 | 归属 |
|---|---|---|---|
| session | 876 | | 会话登记 |
| session_input | 2,183 | kind: sendText 1,996 · backgroundNotification 183 · compact 3 · sendGoalCommand 1；**delivery: startNow 1,490 / queue 689 / guide 4**；status: promoted 2,096 / cancelled 70 / discarded 17 | 输入队列与插话的一等基础设施：每条人话都记"怎么进来的（delivery）→ 何时被提升（promoted_*、promoted_message_id）"；guide=运行中真人插话，queue=排队，backgroundNotification=后台唤醒 |
| session_entry | 10,401 | **runtime/workspace_checkpoint 7,937** · runtime/model_selection 866 · runtime/bash_shell_selection 788 · runtime/execution_state 781 · v4/command_fact 18 · target_completion_verification 6 · runtime/user_input_auto_resolution 5 | 会话级事件流水：**检查点/切模型/换 shell/执行状态**全在这；target_completion_verification=目标完成核验 |
| todo | 2,421 | content/status/priority/position | 计划列表（每会话持久化） |
| session_task_link | 17 | | 会话↔桌面任务关联 |
| input_history | 100 | text/kind/attachments | 跨会话输入历史（补全用） |
| workflow_definition/run/event/activity, dwf_* | 全 0 | | 工作流引擎表存在但本机未用 |

### 预算与可观测

- **turn_usage 2,603 行**：每轮一行的完整账本——`duration_ms、time_to_first_token_ms、model_request_count、model_retry_count、tool_call_count、tool_error_count、input/output/reasoning/cache_creation/cache_read/computed_total_tokens、context_exceeded、error_type/error_code、cancelled_by_user`。预算与压缩决策的原始数据全在这。
- model_usage / tool_usage：按模型、按工具的累计用量。

### 记忆与设置（会话之外）

- `~/.zcode/v2/setting.json`（含 memoryEnabled 等开关）、`~/.zcode/v2/checkpoints/`、`~/.zcode/AGENTS.md`、`~/.zcode/cli/memories/`（历史记忆 md）、`v2/acp-lazy-sessions.json`、`v2/agent-config/`、`v2/tasks-index.sqlite`（桌面任务库，tasks.archived/deleted 列）。

### 会话里看不到的（留给抓请求/读源码）

- 系统提示词全文不落库（part 里只有零散 system-reminder）；AGENTS.md/技能清单注入的具体拼装顺序；权限审批（permission 表 0 行——审批决策不落此库）；压缩后实际发给模型的消息序列。

依据：表结构与分布=普查脚本实测（可复跑）；compaction/session_input 字段语义=样本+字段名直读（session_input 的 delivery 三态与 10-19 session_input 表 2142 行的桌面证据一致）；"何时为何注入"为暂定判断，标推测处已注明。
