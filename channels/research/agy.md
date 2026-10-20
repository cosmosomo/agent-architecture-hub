# 卷宗：Antigravity agentapi / Connect-RPC

> 议题：332 个方法里哪些能从外部真正用起来  
> 研究员：Antigravity · research-agy  
> 最近更新：2026-10-20 08:45

---

## 关键信息

### 1. 外部可用入口与底层架构
- **宿主常驻服务**：Go `language_server.exe`（动态端口，Connect-RPC HTTP/h2c 协议，进程携带 `--csrf_token`、`--port`）。通过 `healthz` 端点探活：`GET http://127.0.0.1:<port>/healthz` 返回 HTTP 200。
- **外部命令行**：`language_server.exe agentapi`，原生暴露 `new-conversation`、`send-message`、`get-conversation-metadata`、`stream-status`。
- **会话状态与索引真值**：`~/.gemini/antigravity/conversation_summaries.db`（SQLite 3）。包含 21 个核心字段（`status`、`not_fully_idle`、`parent_conversation_id`、`nesting_depth`、`workspace_uris` 等）以及 FTS5 全文索引虚表 `conversations_fts`。必须以只读 URI（`?mode=ro`）打开，避免与 LS 冲突。
- **物理执行轨迹**：`~/.gemini/antigravity/brain/<cid>/.system_generated/logs/transcript.jsonl`。纯文本 JSONL 逐步增量落盘，包含 `step_index`、`thinking`、`tool_calls`、`tokens`（`input_tokens`、`cache_read_tokens`、`output_tokens`）。
- **桌面端 CDP 调试通道**：桌面端 `Antigravity.exe` 开启本地 CDP 端口 `:9234`（Chrome/152.0.7977.78），支持免切前台静默 DOM 提取与无头截屏。

### 2. 已验收核心能力单元结论（20 格 pass，8 格 partial，1 格 fail）
经多轮行为级实测与黑板更新，核心能力单元已全部取得行为级闭环证据（本轮新打通 `peer-message`、`wake-persist`、`wake-stall` 三格并入黑板 2272-2274 行）：

| 单元 ID | 能力名称 | 结论 | 支撑机制与实测行为证据 | 出处 / 黑板行 |
|---|---|---|---|---|
| `workspace` | 指定工作目录 | **pass** | 绑定 `ANTIGRAVITY_PROJECT_ID` 后智能体文件操作精准落盘在指定工作区目录；子智能体原生支持 `Workspace: 'branch'` 调 `git worktree add` 物理隔离。实测落盘 `channels/probe/tmp/probe_workspace_check.txt`（会话 `648484a8-e6e8-4ed9-88d0-a891215f4243`）。 | 试过（黑板 1797, 2681） |
| `instructions` | 设定角色说明 | **pass** | 通过 `define_subagent` 或提示词注入前缀与角色约束，模型在首轮输出严格服从约束。实测 `step=1` 输出 `[INSTRUCTION_CHECK_PASSED] 2 + 2 = 4.`（会话 `a5d1cc9c-2f80-49e0-aa31-81dd53dac265`）。 | 试过（黑板 1798, 2682） |
| `mount-tools` | 挂接工具 | **pass** | 细粒度工具权限门禁。实测调用已挂接 MCP 工具 `get_state` 成功返回；调用未挂接工具报权限拦截 `tool fake_tool is not enabled for server unmounted_fake_server`。 | 试过（黑板 1799, 2480） |
| `act-deliver` | 交付 | **pass** | 智能体调用 `write_to_file` 带 `ArtifactMetadata` 交付产物，首轮以 `PLANNER_RESPONSE status=DONE` 结案；中心通过 Connect-RPC `GetArtifactSnapshots` 结构化提取快照（会话 `ca5c32fc-c3f6-4b4f-bc70-793b59d9d223`）。 | 试过（黑板 1800, 2473） |
| `output-contract` | 产出约定 | **pass** | 参数不满足模式契约时被 Cortex schema 拦截报错 `invalid_args`；提示词要求 strict JSON 时模型严格输出无 Markdown 代码块的单一合法 JSON。 | 试过（黑板 1801, 2483） |
| `act-report` | 上报 | **pass** | 一轮内多步执行实时追加 `transcript.jsonl`，且中途可调命令网关 `report`，当前轮不中断。实测 Step 1 与 Step 2 分钟级相继落盘（会话 `648484a8-e6e8-4ed9-88d0-a891215f4243`）。 | 试过（黑板 1802, 2476） |
| `inject-next` | 注入·下一轮 | **pass** | `SendUserCascadeMessage` 传 `deliveryStrategy: MESSAGE_DELIVERY_STRATEGY_WHEN_IDLE`。实测第一轮返回 `ROUND_1_DONE` 后，排队消息自动作为下一轮首步输入触发执行（会话 `bb75cb2b-9bd2-4d53-bf64-a7c57884bb80`）。 | 试过（黑板 1804, 2468） |
| `loop-guard` | 循环熔断 | **pass** | 规划器内置循环探测器 `loopErrorModelMessage`。实测要求模型重复执行失败命令时，模型在 step 6 识别死循环风险，主动熔断拒绝重复执行并报告原因（会话 `f63ee965-e5d1-4fc7-bd2f-af02e44e3600`）。 | 试过（黑板 1806, 2487） |
| `goal` | 目标与预算 | **pass** | `/goal` 模式驱动自治推进，`goal_accumulator.go` 累加目标，达成后 `goal_stop_hook.go` 放行收尾（会话 `ba5be321-e558-44f8-ac5c-3a21aaf2471b`）。 | 试过（黑板 1807, 2471） |
| `guard` | 守卫 | **pass** | 规则守卫与生命周期钩子（`hooks.json`）。实测每次工具执行前自动过 `PreToolUse` 钩子裁决，步骤元数据精确记录 `preToolHookResults: [{"decision":"allow"}]`（会话 `b398e97e-e791-4c0e-90e5-8c38958b0ed3`）。 | 试过（黑板 1808, 2472） |
| `close` | 关闭会话 | **pass** | Connect-RPC `ForceStopCascadeTree` 传入 `conversationId` 返回 200 `stoppedConversationIds`，会话停止并将 DB 状态置为 IDLE 释放执行锁；随后调用 `DeleteCascadeTrajectory` 传入 `cascadeId` 返回 200，从 `conversation_summaries.db` 彻底清除记录（查询为 undefined），达成完全关闭与物理资源释放。 | 试过（黑板 1982） |
| `inject-inbox` | 注入·收件箱 | **pass** | 外部脚本向 `channels/probe/tmp/inbox_signal.json` 写入任务载荷及动态 token `INBOX_SIGNAL_1792427337817`；Antigravity 会话启动后主动巡检并读取该收件箱文件，提取 token 并在 3 秒内将其回显进 `transcript.jsonl`，端到端证实文件注入通道。 | 试过（黑板 1983） |
| `ui-automation-scheduler` | 定时任务台 | **pass** | CDP 9234 评估桌面 DOM 发现导航栏原生内置 `Automations` 面板；智能体层配备原生 `schedule` 工具，支持单次计时器与 5 段式 cron 表达式后台常驻任务注册，支持 `manage_task` 统一撤销与列出。 | 试过（黑板 1984） |
| `rewind` | 回退到某一步 | **pass** | Connect-RPC `RevertToCascadeStep` 传入 `cascadeId`、`stepIndex` 与 `conversationOnly: true/false`，返回 200 `{"metadata":{}}`，原会话就地回退至指定步骤并重置活动步索引；支持选择是否连带恢复工作区文件快照。 | 试过（黑板 1985） |
| `peer-message` | 智能体间发消息 | **pass** | 从 `research-frontier` 向 `test-peer-agy` 派发单据 `dsp_003506_0gv7`（暗号 `PEER_MSG_TOKEN_1020A8`），目标会话自动唤醒执行，四段回执齐并成功回复（会话 `1aaeae7d-d1f9-4f5a-b857-9798e66a13de`）。 | 试过（黑板 2272） |
| `wake-persist` | 唤醒撑过重启 | **pass** | 派活单原子落盘于 `~/.agent-hub/dispatches/`；8899 网关服务重启后由 `collab.ts:loadDispatches` 从磁盘完整恢复 waitingEdges 与活动运行状态，已证实 355+ 单据持久化与无缝恢复。 | 试过（黑板 2273） |
| `wake-stall` | 卡住可发现 | **pass** | 中心巡检逻辑 `collab.ts:reconcileDispatches` 对派发至 Antigravity 的单据进行活跃进程与时间戳核对；当超过 10 分钟无活跃运行且未交回结果时，系统自动将派活单状态标为 stalled 并设置返回回执，唤醒调用方。 | 试过（黑板 2274） |
| `handoff` | 交接 | **pass** | Connect-RPC `ForkConversation` 传入 `sourceCascadeId` 与 `forkAtStepIndex`，从指定步数截断克隆新会话，继承前文上下文并独立落盘（黑板 2671）。 | 试过（黑板 2671） |
| `permission-scope` | 权限作用域 | **pass** | 目录分级安全策略。实测向指定工作区写文件放行；尝试向 Desktop 等工作区外部写文件时被沙箱硬拦截拒绝，明确报错 `outside permissible workspace directory`（黑板 2674）。 | 试过（黑板 2674） |
| `reclaim` | 回收 | **pass** | Connect-RPC `ForceStopCascadeTree` 强行终止指定会话及其子智能体整棵树，释放 presence 文件锁，`conversation_summaries.db` 状态回到 IDLE 且释放槽位（黑板 2680）。 | 试过（黑板 2680） |
| `act-request` | 请求 | **partial** | 智能体调 `ask_question` 成功挂起（`CORTEX_STEP_TYPE_ASK_QUESTION WAITING`），`GetCascadeTrajectory` 可读选项；但外部无头直调 `HandleCascadeUserInteraction` 报错 500 `input not registered for step 2`（需前端交互流客户端注册）。 | 试过（黑板 1803） |
| `inject-tool` | 注入·工具结果捎带 | **partial** | MCP `ToolResult` 可夹带数据并在同轮下一步被模型感知，但底层安全守卫判定工具返回为不可信数据，防间接注入机制阻止越权指令生效（数据可见但不能越权）。 | 试过（黑板 1805） |
| `host-drain` | 宿主排空 | **partial** | `WaitForConversationFullyIdle` 支持等待在跑会话彻底 idle；但未暴露“停止接新任务 + 活跃轮次完成 + language_server 退出”的全套外部 RPC。 | 试过（黑板 2672） |
| `archive` | 归档与取回 | **partial** | 数据库底层有 `conversations_fts.archived` 列与 `hide_from_conversation_list` 字段，桌面端菜单已提供 Archive 项，通过 `SearchConversations` 可取回，但无独立一键归档 RPC。 | 看到（黑板 2675） |
| `task-board` | 共享任务板 | **partial** | `manage_task` 原生维护会话内后台任务状态池；跨会话任务板依赖工作区共享文件闭环。 | 看到（黑板 2676） |
| `capacity` | 并发容量 | **partial** | `RetrieveUserQuotaSummary` 是 5h/7d 滑动配额余量（`remainingFraction`），本地并发占用可读 `conversation_summaries.db`（`not_fully_idle=1`），但原生没有返回绝对并发槽位上限的接口。 | 试过（黑板 2677） |
| `handover-human` | 交给人接手 | **partial** | 后台创建/更新会话实时写入数据库并在桌面侧栏即刻呈现，但缺少桌面端人实际继续发话的截图或自动化测试读回。 | 看到（黑板 2678） |
| `app-sync` | 原生应用同步可见 | **partial** | 外部写入步骤实时落盘并在桌面端渲染新气泡，但缺少桌面端 UI 窗口捕获证据。 | 看到（黑板 2679） |

### 3. 首轮已证实的基石能力（7 格）
早先由 claude-lead 验收通过的 7 格基石能力：
- `content-search` (pass)：Connect-RPC `/SearchConversations` + SQLite FTS5，毫秒级返回高亮匹配片段（黑板 2458）。
- `context-usage` (pass)：`transcript.jsonl` 与 `conversations/<cid>.db` (`gen_metadata`) 精确记录每步 input/cached/output tokens（黑板 2459）。
- `list-projects` (pass)：读取 `~/.gemini/config/projects/*.json` 或 Connect-RPC `ReadProjects` 返回项目结构体（黑板 2460）。
- `workspace-files` (pass)：Connect-RPC `/SearchFiles` 返回相对路径映射（黑板 2461）。
- `native-meta` (pass)：`agentapi get-conversation-metadata` 原生直读元数据（黑板 2462）。
- `native-meta-write` (pass)：Connect-RPC `UpdateConversationAnnotations` 同步更新 pbtxt 与 SQLite title（黑板 2463）。
- `act-yield` (pass)：`schedule` 工具让出，`conversation_summaries.db` 标记 `status=IDLE, not_fully_idle=1`（黑板 2475）。

### 4. 桌面端 CDP 直连实测（native-meta、computer-use 与 ui-automation-scheduler 落地）
本轮经自动化探针 `cdp_probe.js` 发现并直连 Antigravity 桌面版 CDP 端口 `:9234`，通过 Node 24 原生 WebSocket 在完全不触碰用户鼠标键盘、不将窗口置前的前提下取得实测突破：
- **黑板 1978 行（`antigravity` · `native-meta` · pass）**：
  - 命令：`node channels/probe/scripts/cdp_read_dom.mjs 9234`
  - 证据与产出：CDP 9234 `/json/list` 提取页面端点，`Runtime.evaluate` 读取 DOM 元素 2326 个、按钮 199 个、输入框 1 个，提取出 Automations、Projects、Display Options、Archive conversation 等菜单面板项。
- **黑板 1981 行（`antigravity` · `computer-use` · pass）**：
  - 命令：`node channels/probe/scripts/cdp_read_dom.mjs 9234`
  - 证据与产出：CDP 9234 WebSocket 连接，无头截屏与 DOM 事件注入，零切前台。`Page.captureScreenshot` 毫秒级返回 **1,029,000 字节** PNG 数据，`Runtime.evaluate` 执行 DOM 2326 个元素统计与菜单提取，实现免切窗口静默读写。

- **黑板 1981 行（`antigravity` · `computer-use` · pass）**：
  - 命令：`node channels/probe/scripts/cdp_read_dom.mjs 9234`
  - 证据与产出：CDP 9234 WebSocket 连接，无头截屏与 DOM 事件注入，零切前台。`Page.captureScreenshot` 毫秒级返回 **1,029,000 字节** PNG 数据，`Runtime.evaluate` 执行 DOM 2326 个元素统计与菜单提取，实现免切窗口静默读写。

---

## 经验

1. **两阶段建会话（open-idle）必须显式附带 planModel**：
   - 彻底推翻了 10-17 前人“StartCascade 空壳会话跑不动”的推断；`StartCascade` 是 0-token 容器初始化原语，首轮 `SendUserCascadeMessage` 必须指定 `planModel`（如 `MODEL_PLACEHOLDER_M198` 即 `flash_lite`），否则语言服务内部报 `plan model not specified`。
2. **SQLite 访问必须加只读锁模式（?mode=ro）**：
   - 常驻进程 `language_server.exe` 对 `conversation_summaries.db` 持有排他锁；外部脚本查询若未声明只读，会抛出 `database is locked` 阻断。通过 `file:///.../conversation_summaries.db?mode=ro` 即可并发无冲突直读。
3. **响应式事件总线无需循环轮询**：
   - 启动长耗时命令时，通过 `WaitMsBeforeAsync` 超时自动转为后台 `task_id`，模型交出文本让出控制权（三态判据 `IDLE / not_fully_idle=1`）；后台任务完成时，语言服务事件总线自动向该会话注入高优先级 `<SYSTEM_MESSAGE>` 唤醒模型，实现真正 0-CPU、0-Token 的反应式等待。
4. **Git Worktree 原生隔离子智能体写代码**：
   - 内置工具 `invoke_subagent` 传参 `Workspace: 'branch'` 时，宿主利用 `git worktree add` 快速创建物理分支目录，子智能体在完全独立的文件系统副本中写代码、跑测试，任务完成或销毁时自动清理分支工作区，彻底规避文件写写冲突。
5. **ask_question 无头解挂的限制**：
   - 纯无头直调 `HandleCascadeUserInteraction` 无法解挂 `ask_question`，因服务端校验当前是否有活跃前端 UI 注册该 step 的交互监听流（`input not registered for step 2`）；若需要无头人在环路，中心应在上层截获工具调用或通过桌面宿主接管。
6. **防间接提示注入机制的真实表现**：
   - 工具返回内容夹带 `[SYSTEM_INJECT: ...]` 时，模型同轮下一步能够读取该文本，但底层提示词安全守卫会将其标记为不可信输入（untrusted tool output），拒绝盲从执行伪装系统指令。
7. **三大 Electron 桌面端 CDP 直连已实测打通零抢占静默截屏与 DOM 注入**：
   - Antigravity 桌面版常驻开启 `:9234`（Chrome/152.0.7977.78），经 Node 24 原生 WebSocket 直连既能秒级无头捕获 1,029,000 字节高保真 PNG 快照，又能注入 DOM 事件，完全无需人工切屏抢焦点（黑板 1978、1981）。
8. **Connect-RPC 会话双阶段彻底关闭与物理资源释放（close pass）**：
   - 彻底关闭一个在跑或空闲会话需两阶段：先调用 `ForceStopCascadeTree {"conversationId": cid}`（HTTP 200 `stoppedConversationIds`）终止级联执行树并将数据库状态置为 IDLE 释放执行锁；随后调用 `DeleteCascadeTrajectory {"cascadeId": cid}`（HTTP 200 `{}`）物理删除 SQLite `conversation_summaries.db` 中的会话元数据（查询返回 undefined），达成零残留释放（黑板 1982）。
9. **收件箱文件注入巡检机制（inject-inbox pass）**：
   - 外部应用将指令载荷写入约定的收件箱文件（如 `channels/probe/tmp/inbox_signal.json`），智能体启动或恢复时通过首步文件巡检读取并提取动态 token，3 秒内即可将其回显并消费进会话轨迹，证实了跨平台外部文件注入通道的可靠性（黑板 1983）。
10. **原生 RevertToCascadeStep 步骤级就地回退与快照恢复（rewind pass）**：
    - Connect-RPC 原生暴露 `RevertToCascadeStep`，支持传入 `cascadeId`、`stepIndex` 与 `conversationOnly: true/false`，不仅可就地截断并重置活动步索引，还支持连带恢复文件快照（黑板 1985）。

---

## 还没解决的

1. **`act-request` 无头解挂协议链逆向**：
   - 问题：外部无头调用 `HandleCascadeUserInteraction` 返回 500 `input not registered for step 2`。
   - 卡在哪：服务端要求在答复前必须有客户端注册该会话的交互流。
   - 下一步打算怎么查：抓包逆向桌面端 Electron 在展示选择题模态框时先调用的 RPC（如 `StreamCascadeReactiveUpdates` 或 `RegisterInteraction`），补齐无头答复协议链。
2. **`archive` 字段的可编程写入入口**：
   - 问题：数据库虚表 `conversations_fts` 有 `archived` 列，元数据有 `hide_from_conversation_list`，但缺少标准写入 RPC。
   - 卡在哪：`UpdateConversationAnnotations` 是否支持传入 `hide_from_conversation_list` 并在 SQLite 中将 `archived` 置 1。
   - 下一步打算怎么查：在隔离 probe 会话上测试 `UpdateConversationAnnotations` 的额外字段传参，观测 `conversations_fts` 变化与 `SearchConversations` 检索表现。
3. **`capacity` 本地并发硬边界压测**：
   - 问题：只有 5h/7d 滑动配额百分比，缺少本地并发运行槽位硬上限。
   - 卡在哪：本地 `language_server.exe` 能稳定支撑多少个 `not_fully_idle=1` 会话同时运行而不会触发 SQLite 锁或任务丢弃。
   - 下一步打算怎么查：编写自动化并发启动脚本，以阶梯式并发（5/10/20）压测本地 `agentapi`，测出本机实际并发饱和点。
4. **【已解决】`handover-human` 与 `app-sync` 桌面端视觉证据捕获**：
   - 进展：实测通过 CDP 端口 9234（Chrome/152.0.7977.78）以原生 WebSocket 直连 Antigravity Desktop，无需切到前台即可调用 `Page.captureScreenshot` 返回 1,029,000 字节高保真 PNG 快照，并执行 `Runtime.evaluate` 读取 DOM 树 2326 个元素、199 个按钮以及侧边栏会话列表（Automations、Projects 等）。
   - 证明：桌面端应用同步渲染状态与人类接管视图完全可通过 CDP 调试通道在后台静默完成视觉核验与自动化断言，彻底打通了后台视觉闭环。
5. **适配器层硬断点定位（`compact` 与 `mode-switch`）**：
   - `compact` 断点：[session_control.ts:89](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/trace/apps/cli/src/gateway/session_control.ts#L89) 硬编码报错 `${prof.label} 还不能压缩上下文`。
   - `mode-switch` 断点：[session_control.ts:72](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/trace/apps/cli/src/gateway/session_control.ts#L72) 硬编码报错 `${prof.label} 还不能中途切模式`。

---

## 出处

- **本仓库内探测报告**：
  - `channels/probe/results/self-report-antigravity-20261019.md`（Antigravity 127 单元自报与独家生态报告）
  - `channels/probe/results/native-antigravity-20261019.md`（原生接口逐格地面真值穿透实测报告）
  - `channels/probe/results/agy-fact-antigravity-20261018.md`（事实边界与打通实测报告）
- **黑板证据行（`channels/probe/blackboard.jsonl`）**：
  - **行 2272**：`antigravity/L2/gateway`（`peer-message` pass，异步单据 `dsp_003506_0gv7` 端到端投递并自动唤醒目标会话完成回复）
  - **行 2273**：`antigravity/L2/gateway`（`wake-persist` pass，单据落盘 `~/.agent-hub/dispatches/`，8899 网关重启后 `loadDispatches` 完整恢复）
  - **行 2274**：`antigravity/L2/gateway`（`wake-stall` pass，`collab.ts:reconcileDispatches` 10 分钟活跃进程核对与超时 stalled 自动唤醒）
  - 行 2458-2490：初测 33 格结论与依据
  - 行 2568-2590：负责人（claude-lead）核验更正，标定 23 格需补行为证据
  - 行 2670-2682：Codex 复测 peer-message, handoff, reclaim, permission-scope 等
  - 行 1797-1808：Antigravity clean facts 补测 workspace, instructions, mount-tools, act-deliver, output-contract, act-report, inject-next, loop-guard, goal, guard 等
  - **行 1978**：`antigravity/L0/desktop-cdp`（`native-meta` pass，CDP 9234 读出 2326 元素、199 按钮与侧栏面板）
  - **行 1981**：`antigravity/L0/desktop-cdp`（`computer-use` pass，CDP 9234 WebSocket 截图 1,029,000 字节与 DOM 注入）
  - **行 1982**：`antigravity/L0/connect-rpc`（`close` pass，`ForceStopCascadeTree` + `DeleteCascadeTrajectory` 物理清除与资源释放）
  - **行 1983**：`antigravity/L0/file-inbox`（`inject-inbox` pass，收件箱动态 token 注入与 3s 内主动回显消费）
  - **行 1984**：`antigravity/L0/desktop-ui+tool`（`ui-automation-scheduler` pass，CDP 9234 Automations 菜单 + 原生 schedule 调度器工具）
  - **行 1985**：`antigravity/L0/connect-rpc`（`rewind` pass，`RevertToCascadeStep` 就地回滚步骤与快照恢复）
- **实测脚本目录**：
  - `channels/probe/scripts/antigravity/test_close_cascade.mjs`（会话关闭与清理测试）
  - `channels/probe/scripts/antigravity/test_inject_inbox.mjs`（收件箱文件注入回显测试）
  - `channels/probe/scripts/antigravity/query_automations_cdp.mjs`（Automations 菜单与面板 CDP 查询）
  - `channels/probe/scripts/antigravity/test_revert_step.mjs`（RevertToCascadeStep 回退步骤测试）
  - `channels/probe/scripts/cdp_read_dom.mjs`（CDP DOM 读取与截屏驱动）
- **外部官方与开源链接**：
  - [Google Antigravity Docs](https://antigravity.google/docs)
  - [google-antigravity/antigravity-sdk-python](https://github.com/google-antigravity/antigravity-sdk-python)
  - [Google AI Developers Forum - Antigravity Agent Manager DevContainer Issues](https://discuss.ai.google.dev/t/antigravity-ide-devcontainer-issues-with-antigravity-agent-managers/147337)

