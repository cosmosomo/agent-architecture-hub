# Codex 渠道分层实测报告（L0 / L1a / L1b）

- **测试者**：`agy-flash` (Antigravity Flash)
- **被测家族**：`codex`
- **执行时间**：`2026-10-17T18:25:00+08:00`
- **被测环境**：Windows 11, Node.js v24.19.0, 本地代理 `http://127.0.0.1:7892`
- **测试前缀**：`probe-codex-`
- **请求测试模型**：`gpt-5.4-mini`（实测因上游混池 503 无通道，降级到最便宜可用模型 `gpt-5.6-sol` 与 `gpt-6.1-sol` 进行协议全能力核验）
- **负责人通知接收点声明**：我在当前这一轮中途（在排查 ACP 桥与编写执行 L1a 脚本过程中收到系统高优先级消息）看到补充规矩的，并立即按新规矩执行补测（校准原始输出片段、审批双向交互、切模型二次确认与 `<家>/<层>/<入口>` 路线命名）。

---

## 一、各路线通断概览表

| 路线编号 | 路线标识 (`route`) | 入口 (`surface`) | 通断概览 (17 项能力) | 核心特征与表现 |
|---|---|---|---|---|
| **C1** | `codex/L0/exec` | `native-cli` | 9 通 / 2 断 / 6 不适用 | 单轮冷启动完备（开、续、原生续、分叉、归档关）；无法轮内插话；中途 kill 导致 Windows 写锁残留（active writer）；无反向审批 RPC。 |
| **C2** | `codex/L0/app-server` | `daemon` | 15 通 / 1 断 / 1 不适用 | **能力最完备路线**。全双向 JSON-RPC 2.0，真·轮内插话 (`turn/steer`)、无损打断 (`turn/interrupt`)、逆向审批回调 (`ServerRequest`)、分叉与整理全部实测跑通；仅查额度因缺少官方 OAuth 报 401/403 鉴权拒绝。 |
| **C3** | `codex/L1a/codex-acp` | `acp-bridge` | 7 通 / 2 断 / 8 不适用 | ACP 基础对话与流式更新通，单轮打断生效；但桥自身显式声明 `loadSession: false`, `forkSession: false`, `closeSession: false`；且工具权限审批未反向透传导致写文件死挂。 |
| **C4** | `codex/L1b/acpx` | `acp-bridge` | 9 通 / 2 断 / 6 不适用 | 命令行封装体验良好，状态、多轮历史、中途取消、模型切换均通过；但无法透传原生会话（`Internal error`），且退出时残留子进程 lease 警告。 |

---

## 二、逐路线详细实测记录与断点分析

### 2.1 路线 1：`codex/L0/exec` (原生 CLI 冷进程)
- **通过能力 (Pass)**：
  - `open`：指定 `-m gpt-5.6-sol` 成功启动冷进程并输出 JSONL，捕获首行 `thread.started` 与最终 `agent_message`。
  - `resume`：以 `codex exec resume <thread_id>` 传入第二轮提示词，成功复现第一轮注入的暗号 `PROBE_SECRET_ALPHA_789`。
  - `resume-native`：成功从冷状态续接由 CLI 自己开的 `probe-codex-native` 线程。
  - `observe-live`：`--json` 标准输出按行实时增量吐出，首块在 421ms 抵达，末块在 7224ms 抵达，共 5 块独立 chunk。
  - `close`：执行 `codex archive <thread_id>` 成功归档会话（`Archived session <id>.`）。
  - `fork`：执行 `codex exec fork <thread_id>` 产生全新的 `forkId` 并成功在新分支完成回复。
  - `model-list`：`codex debug models` 输出 11 个可用模型（含 `gpt-6-astra`, `gpt-6.1-sol`, `gpt-5.6-sol` 等）。
  - `model-new`：成功在启动时通过 `-m` 绑定生效模型。
  - `model-switch`：续接时传入新模型 `-m gpt-5.6-sol`，输出明确告警日志：`This session was recorded with model gpt-6.1-sol but is resuming with gpt-5.6-sol`，且用量正常结算。
  - `mode-switch`：续接时传入 `-s read-only`，成功切换沙箱模式并回复。
- **失败与断点 (Fail)**：
  - `cancel`：中途强杀 Windows CLI 进程时，外层 shell 终止但后台持久化进程未能立即释放 SQLite 锁；立即调用 `codex exec resume` 报 `thread-store conflict: thread ... already has an active writer (code -32600)`。
  - `permission`：在 `approval_policy="on-request"` 模式下让模型写文件，CLI 无法进行交互式逆向询问，底层直接报 `error=Exit code: 1 Output: Failed to write file` 并退出。
- **不适用 (N/A)**：
  - `observe-history` / `state` / `compact` / `quota`：顶层 CLI 根本没有 `history`, `status`, `compact`, `quota` 子命令（执行均报 `unrecognized subcommand`）。
  - `steer`：单轮 CLI 进程启动即关闭 stdin，无法在轮内注入新提示词。

### 2.2 路线 2：`codex/L0/app-server` (JSON-RPC 常驻守护进程)
- **通过能力 (Pass)**：
  - `open`：`thread/start` + `turn/start`，毫秒级响应，成功拿到 `threadId` 与 `turnId`。
  - `resume`：在已加载的内存会话中直接调 `turn/start`，准确召回暗号 `APPSERVER_CODE_DELTA_999`。
  - `resume-native`：对冷会话调用 `thread/resume`，成功重新绑定并载入内存。
  - `observe-live`：全程收到 30 条结构化通知（`warning`, `mcpServer/startupStatus/updated`, `thread/status/changed`, `turn/started`, `item/agentMessage/delta`, `thread/tokenUsage/updated`, `turn/completed`）。
  - `observe-history`：通过 `thread/read` 读元数据，`thread/turns/list` 分页拉取轮次。
  - `state`：精准捕获 `thread/status/changed` 的 `active -> idle` 状态机变更。
  - `cancel`：下发 `turn/interrupt`，服务端秒级推送 `turn/completed (status="interrupted")`，会话完好留在热待命，下一轮立即回复 `INTERRUPT_RECOVERED_OK`。
  - `close`：`thread/unsubscribe` 卸载内存，`thread/archive` 归档磁盘。
  - `steer`：**真·轮内实时插话**！在计数途中下发 `turn/steer`，服务端返回当前 `turnId` 并在本轮执行流中吸收指令。
  - `permission`：**真·双向逆向 RPC**！模型尝试写受保护文件时，服务端发送反向请求 `item/fileChange/requestApproval`（带 `id: 0`），客户端异步回传 `{"id": 0, "result": {"decision": "accept"}}`，模型随后放行继续写文件。
  - `fork`：`thread/fork` 原生分叉出全新独立 `threadId`。
  - `compact`：`thread/compact/start` 触发上下文压缩轮。
  - `model-list`：`model/list` 返回全部 8 个可用模型对象。
  - `model-new`：`thread/start { model }` 成功绑定初始模型。
  - `model-switch`：`turn/start { model: "gpt-6.1-sol" }` 在下一轮成功热切模型。
  - `mode-switch`：`thread/settings/update { sandboxPolicy: "readOnly" }` 成功动态修改沙箱。
- **失败与断点 (Fail)**：
  - `quota`：调用 `account/rateLimits/read` 报 `{"code":-32600,"message":"codex account authentication required to read rate limits"}`。第三方网关 Bearer Token 无法读取官方 OAuth 速率配额。

### 2.3 路线 3：`codex/L1a/codex-acp` (ACP 桥直连)
- **通过能力 (Pass)**：
  - `open`：`connection.prompt` 第 1 轮完成，返回 `stopReason: end_turn`。
  - `resume`：第 2 轮在同一 `sessionId` 下正确召回暗号 `ACP_WORD_ZETA_123`。
  - `observe-live`：收到 42 条 `sessionUpdate` 通知，持续推送流式 chunk。
  - `state`：通过 `sessionUpdate` 追踪会话生命周期。
  - `cancel`：`connection.cancel` 成功打断进行中的 prompt，返回 `stopReason: cancelled`，后续轮次恢复正常。
  - `model-list`：`session/new` 返回 15 个模型配置组合（如 `gpt-6.1-sol[high]`, `gpt-5.6-sol[low]` 等）。
  - `model-new`：`session/new` 返回 `currentModelId: "gpt-6.1-sol[high]"`。
  - `mode-switch`：`setSessionMode` 成功切换到 `read-only`。
- **失败与断点 (Fail)**：
  - `permission`：当要求写入文件时，`codex-acp` 桥未向客户端 handler 派发 `requestPermission` 回调，底层直接卡死挂起（超过 6 分钟不响应，导致测试超时被负责人提醒杀掉）。
  - `model-switch`（部分通）：`setSessionConfigOption` 修改 `model` 虽返回成功，但随后的返回元数据中未体现模型实际生效变更。
- **不适用 (N/A)**：
  - `resume-native` / `fork` / `close`：在 `initialize` 返回的 `agentCapabilities` 中，桥自身显式声明：
    `{"loadSession": false, "forkSession": false, "closeSession": false}`。
  - `observe-history` / `compact` / `quota`：ACP 协议未暴露相关方法。
  - `steer`：ACP SDK 的 `connection.prompt` 在前一轮未完成时会排队或拒绝并发调用。

### 2.4 路线 4：`codex/L1b/acpx` (acpx 命令行工具)
- **通过能力 (Pass)**：
  - `open`：`acpx codex sessions new` 后接 `acpx codex -s <name> "..."`，成功拉起会话并获得回复。
  - `resume`：多轮对话记忆连贯，历史记录完整保留。
  - `observe-live`：原生支持 `acpx codex sessions watch <name>` 旁路观察流式输出。
  - `observe-history`：`acpx codex sessions history` 完整打印出包含时间戳与角色的多轮记录。
  - `state`：`acpx --format json codex status` 准确输出当前状态（`status: "idle"`, `summary: "session idle; queue owner will start on next prompt"`）。
  - `cancel`：`acpx codex cancel -s <name>` 输出 `cancel requested`，当前轮退出，会话完好。
  - `model-list`：`status` 返回 `availableModels` 包含全部 8 个候选模型。
  - `model-new`：新建会话绑定默认模型 `gpt-6.1-sol`。
  - `model-switch`：`acpx codex set -s <name> model gpt-6.1-sol` 成功修改并随后生效。
  - `mode-switch`：`acpx codex set-mode -s <name> read-only` 成功切换。
- **失败与断点 (Fail)**：
  - `resume-native`：执行 `acpx codex sessions new --name probe-l1b-native --resume-session <native_uuid>` 报 `Failed to resume ACP session ...: Internal error`，无法跨边界接管原生会话。
  - `permission`：非交互式命令行无法在执行中途弹窗或接收回调，工具调用由底层策略静态放行或拒绝。
  - `close`（部分通）：调用 `acpx codex sessions close` 能移出会话表，但末尾报警告：`Queue-owner descendant cleanup is incomplete or unverified. Its lease was retained.`。
- **不适用 (N/A)**：
  - `steer`：`--no-wait` 仅为下一轮排队，并非轮内插话。
  - `fork` / `compact` / `quota`：`acpx` 无此子命令。

---

## 三、没把握的结论与待定事项

1. **`gpt-5.4-mini` 的渠道通道**：在任务要求中使用 `gpt-5.4-mini`，但实测本机配置的上游（`https://api.aizzz.xyz/v1/responses`）返回 503 `No available channel for model gpt-5.4-mini under group GPT混池`。目前必须使用 `gpt-5.6-sol` 或 `gpt-6.1-sol`。若后续上游渠道恢复或更换网关 Key，需重新核实 mini 的单价与限速。
2. **`codex app-server` 的常驻死挂现象 (Wake-Stall)**：在 Agent 环境中使用 `run_command`（WaitMsBeforeAsync=5000）直接运行 `codex app-server --listen stdio://` 时，因守护进程永远不会主动退出，导致 Agent 调度器被无限挂起（Task 157 挂了 15 分钟）。**定论**：测试 app-server 必须由外部脚本主动管理进程生命周期或使用显式超时退出。
3. **`codex-acp` 权限审批悬挂**：在 L1a 路线测试 `permission` 时，`codex-acp` 桥未触发 `requestPermission`，也没有向下报错，表现为静默死锁。由于该桥为外部 npm 包（`@agentclientprotocol/codex-acp 2.2.2`），内部逻辑将 Codex 的 `item/commandExecution/requestApproval` 转换到 ACP 协议的实现可能存在未处理分支。
