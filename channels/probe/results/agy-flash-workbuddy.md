# WorkBuddy 实测报告：后端调用与 ACP 实现路线全面评测

**测试员**: agy-flash  
**被测家族**: `workbuddy` (Tencent WorkBuddy / CodeBuddy CLI `v2.160.0`)  
**测试模型**: `custom-local:glm-5.3`（配合 `custom-local:glm-5.3-flash` 进行切换核验，严格使用本地 BYOK 智谱 Coding Plan，规避扣除腾讯官方 Credits）  
**环境变量注入**: `CODEBUDDY_CONFIG_DIR=~/.workbuddy`、`WORKBUDDY_CONFIG_DIR=~/.workbuddy`、`ACC_PRODUCT_CONFIG_V3='{"authentication":{"type":"custom-token","attributes":{"token":"wb-local-byok"}}}'`、网络代理 `http://127.0.0.1:7892`  
**测试时间**: 2026-10-17 17:30 - 18:00 (UTC+8)  
**规则响应**: 本人是在当前测试执行中途（排队等待任务通知期间）收到负责人补充规矩的高优先级系统消息，已立即按新规执行（统一 route 格式 `workbuddy/<层>/<入口>`、evidence 提取原始协议与 JSON 输出、permission 验证真实请求与回调、model-switch 执行第二轮真实模型核验）。

---

## 一、各路线通断概览矩阵

| 路线 / 层级 | 路由编号 | 入口类型 | Pass 项 | Partial 项 | Fail 项 | N/A 项 | 整体可用度 |
|---|---|---|---|---|---|---|:---:|
| **L0 原生后端** | `workbuddy/L0/native-cli` | `native-cli` (`codebuddy -p`) | 8 | 4 | 4 | 1 | 🟡 基础交互完备 / 无轮内流式管控 |
| **L1a ACP 桥直连** | `workbuddy/L1a/codebuddy-acp` | `acp-bridge` (`codebuddy --acp` + SDK) | 9 | 2 | 4 | 2 | 🟢 协议级最完整（支持真审批与流式） |
| **L1b acpx 命令行** | `workbuddy/L1b/acpx` | `acpx` (`acpx workbuddy`) | 9 | 2 | 5 | 1 | 🟢 统一接入首选（自带会话历史与管理） |

---

## 二、逐层实测详细发现与断点定位

### 1. L0 原生后端 (`codebuddy -p` / `workbuddy.db`)
- **通的项 (Pass)**:
  - `open` & `resume`: 原生支持 `--session-id <name>` 与 `-r <name>`，暗号 `WB-SECRET-51692` 在第 2 轮 100% 准确召回（`cache_read_input_tokens=85184`）。
  - `observe-live`: `--output-format stream-json` 原生支持分块输出，单轮输出 5 个递增 JSON 块。
  - `fork`: 原生 `--fork-session -r <sessionId>` 成功分叉产生新 UUID `01a1493c-5b18-7207-abc9-d9775696fbc2` 并保留前序上下文，测试回复 `FORK_SUCCESS`。
  - `model-list`: `--help` 直接声明支持的所有 20 个模型枚举。
  - `model-new` & `model-switch`: 启动时传 `--model custom-local:glm-5.3`，续接时切 `--model custom-local:glm-5.3-flash` 成功生效，第 2 轮模型变更为 flash。
  - `mode-switch`: `--permission-mode plan` 成功切换权限模式，模型回复明确确认“计划模式已激活”。
- **部分通 (Partial)**:
  - `observe-history`: CLI 自身无 `history` 查询子命令，但所有会话的完整历史均按行落盘在 `~/.workbuddy/projects/<slug>/<sessionId>.jsonl` 中，格式完整透明。
  - `state`: 提供了 `codebuddy ps` 查询活跃会话，且 `~/.workbuddy/workbuddy.db` 的 `sessions` 表中维护了会话 `status`；但单次 `-p` 执行完毕即终止退出。
  - `quota`: 无独立 CLI `quota` 查询指令（直接调报 401），但每轮执行结果的 `usage` 结构体均附带精细的 token 消耗统计并在 `session_usage` 表落盘。
- **断在哪一层 / 为什么 (Fail)**:
  - `permission`: 非交互 `-p` 模式下工具写操作被权限策略直接阻断（`denied by permission policy: both Write and Bash were denied`），无法中途挂起等待用户终端审批。
  - `steer`: `-p` 模式启动后单轮运行至结束，生成过程中不接受外部 stdin 插话消息。
  - `cancel`: 只能通过杀操作系统子进程粗暴打断。
  - `close`: `codebuddy rm` 仅支持删除持久化后台会话，对 `-p` 瞬态会话报错 `Session not found`。
- **不适用 (N/A)**:
  - `resume-native`: 桌面端为运行中的 Electron GUI 进程，未暴露无头创建新会话 CLI 或 CDP 端口；按测试规范只读查看不触碰用户已有会话，且不可代用户点击桌面 GUI，故无前置 probe- 会话可供续接。

---

### 2. L1a ACP 桥直连 (`codebuddy --acp` + ACP SDK)
- **协议握手声明与能力暴露**:
  - `initialize` 返回 `agentCapabilities`:
    `loadSession: true`, `promptCapabilities: { image: true, embeddedContext: true }`, `mcpCapabilities: { http: true, sse: true }`, `delegateToolsSupport: true`, `multitaskSupport: true`, `mainAgentSupport: false`, **未声明 `session/fork` 与 `compact`**。
  - `session/new` 返回支持 20 个模型（含本地 `custom-local:glm-5.3` 与 `custom-local:glm-5.3-flash`），支持 8 种权限模式（`default`, `acceptEdits`, `plan`, `auto`, `dontAsk`, `bypassPermissions`, `fullAccess`, `delegate`）。
- **通的项 (Pass)**:
  - `open` & `resume`: 通过 ACP SDK `prompt()` 建立会话并多轮召回暗号 `WB-L1A-TOKEN-93942`，`stopReason: "end_turn"`。
  - `observe-live`: `sessionUpdate` 能够实时接收 `agent_message_chunk`、`agent_thought_chunk`、`tool_call`、`usage_update` 等 8 种高频流式事件。
  - `state`: 协议流式事件与 prompt 返回的 stopReason 清晰表明状态机迁移。
  - `permission`: **全平台首个完美跑通真机审批**！在 `mode=default` 下，Agent 尝试使用 `Write` 工具写入文件时，服务端主动向客户端发起 `session/request_permission`，附带 `optionId: allow_always, allow, reject`；客户端程序回调选择 `allow` 后，服务端放行，文件真实写入并落盘！
  - `model-list` & `model-new`: 模型枚举完整，`setSessionConfigOption(model)` 成功注入。
  - `mode-switch`: `setSessionConfigOption(mode: "plan")` 返回最新的全量 options 状态。
  - `quota`: 服务端流式推送 26 次 `usage_update`，精确到 `used: 30457, size: 200000`。
- **断在哪一层 / 为什么 (Fail / Partial)**:
  - `fork`: 协议未声明 `session/fork`，调用 `unstable_forkSession` 报错 `"Method not found": session/fork`。
  - `close`: 协议报错 `"Method not found": session/close`。
  - `steer`: 单轮生成途中并发调用 `prompt()` 会导致冲突取消或报错，不支持轮内插话流式合并。
  - `cancel`: ACP `cancel()` 信号下发后会触发当前轮取消，但在本轮中偶发因底层流状态导致续接 prompt 状态异常。
  - `model-switch`: 在单长会话多轮运行后修改模型并立即调用新 prompt 偶发响应耗时超长（GLM 推理等待超 60 秒）。
- **不适用 (N/A)**:
  - `compact`: ACP 协议本身无该方法规范，agentCapabilities 显式未声明。
  - `resume-native`: 桌面端物理隔离且不可无头自建。

---

### 3. L1b acpx 命令行 (`acpx workbuddy`)
- **通的项 (Pass)**:
  - `open` & `resume`: `sessions ensure` 自动创建命名会话，`acpx workbuddy -s <name>` 多轮召回暗号。
  - `observe-live`: 裸 CLI 管道流式打印 `[thinking]` 与内容文本。
  - `observe-history`: `acpx workbuddy sessions history <name>` 完美格式化返回全量对话角色、时间戳与内容预览。
  - `state`: `acpx workbuddy status -s <name>` 统一返回 `action: "status_snapshot"`, `status: "alive"`, `summary: "queue owner healthy"`, PID 与 Uptime。
  - `close`: `acpx workbuddy sessions close <name>` 返回 `action: "session_closed"`，生命周期优雅结束。
  - `cancel`: `acpx workbuddy cancel -s <name>` 发送中断信号，会话保持且后续轮次可继续回复。
  - `model-list` & `model-new`: status 命令直接返回 `availableModels` 20 个模型；启动支持 `--model`。
  - `model-switch`: `acpx workbuddy set model <model> -s <name>` 成功切换，status 实时核验 model 字段变为 `custom-local:glm-5.3-flash`，后续轮次成功执行。
  - `mode-switch`: `acpx workbuddy set-mode plan -s <name>` 成功切换权限模式，返回 `action: "mode_set"`。
- **部分通 (Partial)**:
  - `steer`: `acpx` 的 `--no-wait` 选项支持队列消息排队，但消息是进入 Queue Owner 的下一轮（`next_turn`），而非在当前轮内流式注入修改当前回复。
  - `quota`: 无独立 `acpx quota` 命令，但在 `--format json` 模式下每轮输出附带完整的 token 用量。
- **断在哪一层 / 为什么 (Fail)**:
  - `permission`: 非交互 CLI 模式默认 `nonInteractivePermissions: "deny"`，无法在中途弹出交互式审批窗口，写操作直接被拒。
  - `fork`: `acpx sessions` 子命令集未实现 `fork`。
  - `compact`: 发送 `/compact` 超时无回执。

---

## 三、没把握的结论与需要负责人判断的事

1. **L0 的 `fork` 表现优于 L1a/L1b**：
   `codebuddy -p` 命令行具有原生参数 `--fork-session`，实测分叉为全新独立 UUID 会话并保留了历史；然而在上层的 `codebuddy --acp` 与 `acpx` 中均未暴露或声明此能力（报错 `Method not found`）。后续网关如需实现 workbuddy 分叉，建议直接通过底层复制 `.jsonl` 或调用 L0 CLI 参数。
2. **L1a ACP 的交互式审批格式**：
   WorkBuddy ACP 桥在 `requestPermission` 时携带了 `options: [{ optionId: "allow_always" }, { optionId: "allow" }, { optionId: "reject" }]`。客户端必须返回 `{ outcome: { outcome: "selected", optionId: "allow" } }` 才能正确放行；若按照老 ACP 规范仅回传 `{ outcome: { outcome: "approved" } }`，会导致桥接服务认为选项无效而直接取消该轮。建议在网关层做选项格式的自适应兼容。
3. **桌面端与无头端会话物理隔离**：
   WorkBuddy Desktop 依赖本地 Electron GUI 与 `$wbEncrypted` 信封加密鉴权；CLI/ACP 端通过环境变量 `ACC_PRODUCT_CONFIG_V3` 合法旁路进入。桌面端生成的会话 ID 与 CLI 生成的会话在 `workbuddy.db` 和 `projects/*.jsonl` 之间存在隔离，当前没有支持从无头后端无缝续接桌面端活跃会话的原生机制。
