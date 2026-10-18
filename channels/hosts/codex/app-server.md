# `codex app-server` 完整协议与调用实战手册 (`codex-cli 0.159.2`)

> **适用版本**：验证于 `codex-cli 0.159.2` / `2026-10-14`
> **权威契约源**：`codex app-server generate-ts --experimental` 与 `codex app-server generate-json-schema --experimental`（共 **170 个客户端请求方法**：107 Stable + 63 Experimental；**10 个服务端逆向请求**；**83 个服务端通知**）。
> **实测验证基线**：本机 `codex app-server --listen stdio://` 活体 JSON-RPC 握手与只读探针实测（`2026-10-14`）。

---

## 一、为什么主通道必须用 `codex app-server`？

在我们的基本能力框架（[README.md §二](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/channels/hosts/codex/README.md)）中，单轮 CLI `codex exec` 每做一轮都要冷启动一个新进程，无法在轮内插话（`turn/steer`）、无法无损只停当前轮保留热会话（`turn/interrupt`）、也无法由中心动态拦截审批（`ServerRequest`）。

**`codex app-server` 的核心价值**：
1. **单常驻进程托管多会话 (`Thread`)**：一个 `codex app-server` 子进程可同时管理数十个会话，按会话独立绑定 `cwd`、`model`、`modelProvider`、`sandbox` 与中心 MCP 工具。
2. **完整的轮级生命周期控制 (`Turn`)**：原生支持 `turn/start`、`turn/steer`（轮内实时插话，带 `expectedTurnId` 防串轮）、`turn/interrupt`（只停当前轮，会话保持热待命 `idle`）与 `turn/settings/update`（轮内热切模型/推理强度）。
3. **双向逆向 RPC (`ServerRequest`)**：命令执行、文件补丁、权限扩展、向用户提问（`requestUserInput`）以及客户端动态注册工具（`DynamicToolSpec`）均通过带 `id` 的服务端请求下发给中心裁决。

---

## 二、传输模式、CLI 启动参数与握手协议

### 2.1 CLI 启动语法与子命令 (`codex app-server --help`)

```powershell
# 模式 1：私有常驻子进程（stdio JSONL，推荐中心适配器 CodexApp 使用）
codex app-server --listen stdio://

# 模式 2：WebSocket 服务端（支持外部桥接如 tap bridge 或远程控制）
codex app-server --listen ws://127.0.0.1:4501

# 模式 3：共享后台守护进程管理（~/.codex/app-server-control/app-server-control.sock）
codex app-server daemon <bootstrap|start|restart|update|enable-remote-control|disable-remote-control|stop|version>
codex app-server proxy [--sock <SOCKET_PATH>]

# 模式 4：契约自省导出（升级后必跑）
codex app-server generate-ts --experimental --out <DIR>
codex app-server generate-json-schema --experimental --out <DIR>
```

- **WebSocket 鉴权参数（当 `--listen ws://...` 开启鉴权时）**：
  `--ws-auth <capability-token|signed-bearer-token>`、`--ws-token-file <PATH>`、`--ws-token-sha256 <HEX>`、`--ws-shared-secret-file <PATH>`、`--ws-issuer <ISSUER>`、`--ws-audience <AUDIENCE>`、`--ws-max-clock-skew-seconds <SECONDS>`。

### 2.2 报文分帧与协议细节（Wire Quirks）
- **分帧格式**：基于换行符 `\n` 分隔的 UTF-8 JSON 行（JSONL）。
- **字段特征**：
  - 客户端发出的请求：`{"id": 1, "method": "...", "params": {...}}`（带不带 `"jsonrpc": "2.0"` 均兼容）。
  - 服务端返回的响应：`{"id": 1, "result": {...}}` 或 `{"id": 1, "error": {"code": ..., "message": "..."}}`（省略 `"jsonrpc": "2.0"`）。
  - 服务端发出的通知：`{"method": "...", "params": {...}, "emittedAtMs": 1791956485584}`（每条通知顶层均附带毫秒时间戳 `emittedAtMs`）。
  - **区分服务端响应、服务端逆向请求与服务端通知的判据**：
    1. `'method' not in message` $\to$ **服务端对客户端请求的响应**（按 `message['id']` 唤醒等待槽）；
    2. `'method' in message and 'id' in message` $\to$ **服务端向客户端发起的逆向请求 (`ServerRequest`)**（必须异步回传 `{"id": message["id"], "result": ...}`，切勿阻塞读取线程！）；
    3. `'method' in message and 'id' not in message` $\to$ **服务端单向通知 (`ServerNotification`)**。

### 2.3 必选两步握手协议 (`initialize` $\to$ `initialized`)

任何业务请求在完成以下两步握手前发送都会被服务端拒绝：

```json
// 1. 客户端发送 initialize 请求（开启 experimentalApi: true 解锁全部 170 个方法）
{"id": 1, "method": "initialize", "params": {
  "clientInfo": {"name": "agent-hub", "title": "Agent Architecture Hub", "version": "0.1.0"},
  "capabilities": {
    "experimentalApi": true,
    "optOutNotificationMethods": []
  }
}}

// 2. 服务端返回 InitializeResponse（实测耗时 ~150ms）
{"id": 1, "result": {
  "userAgent": "agent-hub/0.159.2 (Windows 10.0.26200; x86_64) unknown (agent-hub; 0.1.0)",
  "codexHome": "C:\\Users\\COLORFIRE\\.codex",
  "platformFamily": "windows",
  "platformOs": "windows"
}}

// 3. 客户端发送 initialized 通知（无 id）
{"method": "initialized"}
```

---

## 三、核心能力操作与 JSON-RPC 方法映射全表

### 3.1 会话生命周期 (`thread/*`) —— 对应「新建会话、恢复会话、观察、分叉、压缩上下文、关闭会话」

| 能力层动作 | JSON-RPC 方法名 | 稳定性 | 核心请求参数 (`params`) | 响应结构 (`result`) 与关键注意事项 |
| :--- | :--- | :--- | :--- | :--- |
| **新建会话** | `thread/start` | Stable | `{ cwd?, model?, modelProvider?, sandbox?: "read-only" \| "workspace-write" \| "danger-full-access", approvalPolicy?: "untrusted" \| "on-request" \| "never", approvalsReviewer?: "user" \| "guardian_subagent", ephemeral?: boolean, developerInstructions?: string, baseInstructions?: string, config?: Record<string, any>, historyMode?: "paginated" \| "legacy", dynamicTools?: DynamicToolSpec[] }` | 返回 `{ thread: Thread, model, modelProvider, cwd, approvalPolicy, sandbox, reasoningEffort, multiAgentMode }`。<br>💡 `ephemeral: true` 创建无磁盘文件的纯内存会话；`developerInstructions` 可无侵入注入角色提示词。 |
| **恢复会话（冷会话恢复加载）** | `thread/resume` | Stable | `{ threadId: string, excludeTurns?: boolean, cwd?, model?, modelProvider?, sandbox?, approvalPolicy?, approvalsReviewer?, developerInstructions?, config?, initialTurnsPage?: { limit?, sortDirection?, itemsView? } }` | 返回 `{ thread, ..., initialTurnsPage, turnsBackwardsCursor }`。<br>⚠️ **冷恢复铁律**：若 `threadId` 已在 `thread/loaded/list` 中，直接调 `turn/start` 即可；若不在内存中，调 `thread/resume` 时**必须重新传入 `model`、`modelProvider`、`sandbox`、`approvalPolicy` 与 `config`（含中心 MCP）**，否则 App-Server 会按全局 `config.toml` 重置该会话配置！ |
| **分叉（从历史轮次切分支）** | `thread/fork` | Stable | `{ threadId: string, lastTurnId?: string \| null, beforeTurnId?: string \| null, ephemeral?: boolean, excludeTurns?: boolean, deferGoalContinuation?: boolean, ...绑定参数 }` | 返回新分支的 `{ thread: Thread, ... }`，原会话不受影响。支持用 `lastTurnId` 或 `beforeTurnId` 从任意历史轮次定点分叉。 |
| **回滚（截断某轮之后历史）** | `thread/revert` | Stable | `{ threadId: string, beforeTurnId: string }` | 截断 `beforeTurnId` 及之后的持久化历史，触发 `thread/reverted` 通知。 |
| **观察（列会话列表）** | `thread/list` | Stable | `{ cursor?, limit?, sortKey?: "created_at" \| "updated_at" \| "recency_at", sortDirection?: "asc" \| "desc", archived?: boolean, cwd?, searchTerm?, parentThreadId?, ancestorThreadId? }` | 返回 `{ data: Thread[], nextCursor, backwardsCursor }`。支持按 `parentThreadId` / `ancestorThreadId` 查子智能体会话树！ |
| **观察（查已加载热会话）** | `thread/loaded/list` | Stable | `{ cursor?, limit? }` | 返回 `{ data: string[], nextCursor }`（当前驻留在内存中的 `threadId` 列表）。 |
| **观察（读单会话元数据）** | `thread/read` | Stable | `{ threadId: string, includeTurns?: boolean }` | 返回 `{ thread: Thread }`。<br>⚠️ `0.159.2` 新会话默认 `historyMode: "paginated"`，此时 `includeTurns` 已弃用，必须用下方 `thread/turns/list` 分页翻轮次！ |
| **观察（分页翻轮次）** | `thread/turns/list` | Stable | `{ threadId: string, cursor?: string \| null, limit?: number \| null, sortDirection?: "asc" \| "desc", itemsView?: "summary" \| "full" }` | 返回 `{ data: Turn[], nextCursor, backwardsCursor }`（注：`0.159.2` schema 中 `data` 直接是 `Array<Turn>`，兼容旧版时可同时检查 `result.data` 为 list 或 `result.data.items`）。 |
| **观察（分页翻轮内条目）** | `thread/items/list` | Stable | `{ threadId: string, turnId?: string \| null, cursor?, limit?, sortDirection? }` | 返回 `{ data: Array<{ turnId: string, item: ThreadItem }>, nextCursor, backwardsCursor }`。 |
| **压缩上下文（手动触发）** | `thread/compact/start` | Stable | `{ threadId: string }` | 立即启动上下文压缩，完成后收到 `thread/compacted` 通知。 |
| **注入上下文条目** | `thread/inject_items` | Stable | `{ threadId: string, items: Array<JsonValue> }` | 向指定会话直接注入上下文条目而不触发模型推理。 |
| **热改会话设置** | `thread/settings/update` | `[EXP]` | `{ threadId: string, cwd?, approvalPolicy?, approvalsReviewer?, sandboxPolicy?, model?, effort?, collaborationMode? }` | 动态修改已存在会话的模型、沙箱或审批策略。 |
| **设置会话记忆模式** | `thread/memoryMode/set` | `[EXP]` | `{ threadId: string, mode: "enabled" \| "disabled" }` | 对临时派发的子会话可设为 `"disabled"`，防止污染全局跨会话记忆库。 |
| **关闭会话（退订 / 归档 / 删除）** | `thread/unsubscribe`<br>`thread/archive`<br>`thread/unarchive`<br>`thread/delete` | Stable | `{ threadId: string }` | `unsubscribe` 卸载内存状态；`archive` 归档会话；`delete` 永久删除会话文件与索引。 |

---

### 3.2 轮次控制 (`turn/*` & `review/start`) —— 对应「发一轮、插话、打断、专项审查」

| 能力层动作 | JSON-RPC 方法名 | 稳定性 | 核心请求参数 (`params`) | 响应结构 (`result`) 与使用要点 |
| :--- | :--- | :--- | :--- | :--- |
| **发起一轮 (`Start Turn`)** | `turn/start` | Stable | `{ threadId: string, input: UserInput[], outputSchema?: JsonValue, cwd?, model?, effort?: "none" \| "minimal" \| "low" \| "medium" \| "high" \| "xhigh" \| "ultra", approvalPolicy?, approvalsReviewer?, sandboxPolicy?, summary?: "auto" \| "concise" \| "detailed" \| "none", additionalContext? }` | 返回 `{ turn: Turn }`（初始 `status: "inProgress"`）。<br>`input` 支持多种类型：`{"type": "text", "text": "..."}`、`{"type": "localImage", "path": "..."}`、`{"type": "skill", "name": "...", "path": "..."}`、`{"type": "mention", ...}`。<br>`outputSchema` 对应**甲路结构化交付**。 |
| **轮内插话 (`Steer In-Turn`)** | `turn/steer` | Stable | `{ threadId: string, expectedTurnId: string, input: UserInput[], additionalContext? }` | 返回 `{ turnId: string }`。<br>🔥 **核心亮点**：向正在运行的轮次实时追加用户指令，不打断已执行的工具链！必须传 `expectedTurnId`（与当前活跃轮 ID 一致，否则报错拒绝，防止在轮刚结束时误插）。 |
| **打断当前轮 (`Interrupt Turn`)** | `turn/interrupt` | Stable | `{ threadId: string, turnId: string }` | 返回 `{}`。随后服务端推送 `turn/completed`（`turn.status == "interrupted"`），会话完好保留在热待命状态。 |
| **轮内热更新设置** | `turn/settings/update` | `[EXP]` | `{ threadId: string, turnId: string, model?, effort?, approvalsReviewer?, summary?, serviceTier? }` | 在一轮运行途中动态调整后续步骤的模型或推理强度。 |
| **发起代码审查轮** | `review/start` | Stable | `{ threadId: string, target: { type: "uncommittedChanges" } \| { type: "baseBranch", branch: string } \| { type: "commit", sha: string, title?: string } \| { type: "custom", instructions: string }, delivery?: "inline" \| "detached" }` | 返回 `{ turn: Turn, reviewThreadId: string }`。`delivery: "detached"` 会自动分叉出一个独立的审查子线程！ |

---

### 3.3 目标追踪 (`thread/goal/*`) 与 队列管理 (`thread/queue/*`)

1. **会话级目标与预算控制（Stable，对应 `/goal` 与 `goals_1.sqlite`）**：
   - `thread/goal/set`：`{ threadId: string, objective?: string | null, status?: "active" | "paused" | "blocked" | "usageLimited" | "budgetLimited" | "complete" | null, tokenBudget?: number | null }` $\to$ `{ goal: ThreadGoal }`
   - `thread/goal/get`：`{ threadId: string }` $\to$ `{ goal: ThreadGoal | null }`
   - `thread/goal/clear`：`{ threadId: string }` $\to$ `{}`
   - 配套通知：`thread/goal/updated`、`thread/goal/cleared`。
2. **会话待办输入队列（`[EXP]`，对应 `queue_1.sqlite`）**：
   - `thread/queue/add`：`{ threadId, input: UserInput[], clientUserMessageId: string }` $\to$ `{ queuedSubmission }`
   - `thread/queue/list`：`{ threadId, cursor?, limit? }` $\to$ `{ data: QueuedSubmission[], nextCursor }`
   - `thread/queue/update` / `thread/queue/delete` / `thread/queue/reorder`
   - `thread/queue/start`：`{ threadId, queuedSubmissionId?: string | null }` $\to$ `{ turn: Turn }`（立即弹出队列项启动新一轮）
   - 配套通知：`thread/queue/changed`（`{ threadId }`）。

---

### 3.4 独立沙箱命令、文件系统、技能、钩子、MCP 与配置管理

| 域 | 方法清单 | 典型用途 |
| :--- | :--- | :--- |
| **沙箱内执行命令 (`command/*`, Stable)** | `command/exec`、`command/exec/write`、`command/exec/resize`、`command/exec/terminate` | 不消耗模型 Token，直接借用 Codex 的 Windows `mxc` / Linux Landlock 沙箱执行单条命令并拿回 `{ exitCode, stdout, stderr }`。 |
| **宿主进程与文件 (`process/*` `[EXP]`, `fs/*` Stable)** | `process/{spawn,writeStdin,resizePty,kill}`；`fs/{readFile,writeFile,createDirectory,getMetadata,readDirectory,remove,copy,watch,unwatch}` | 跨本地/远程环境统一读写文件、监听目录变更（触发 `fs/changed`）与管理终端进程。 |
| **钩子与技能 (`hooks/*`, `skills/*`, Stable)** | `hooks/list`（`{ cwds?: string[] }`）、`skills/list`（`{ cwds?: string[], forceReload?: boolean }`）、`skills/extraRoots/set`、`skills/config/write` | `hooks/list` 返回每个钩子的 `currentHash` 与 `trustStatus: "trusted" \| "untrusted"`，配合 `config/batchWrite` 自动完成钩子信任签名。 |
| **MCP 服务管理 (`mcpServer*`, Stable)** | `mcpServerStatus/list`、`config/mcpServer/reload`、`mcpServer/oauth/login`、`mcpServer/resource/read`、`mcpServer/tool/call` | 查询已挂载 MCP 服务健康度、热重载 MCP 配置或直接由中心代调某个 MCP 工具。 |
| **配置与模型探针 (`config/*`, `model/*`, Stable)** | `config/read`（`{ includeLayers?: boolean, cwd?: string }`）、`config/value/write`、`config/batchWrite`、`model/list`、`modelProvider/capabilities/read`、`experimentalFeature/list`、`experimentalFeature/enablement/set`、`permissionProfile/list` | 读取合并后的生效配置及每一项的来源文件 SHA-256、原子批量写 `config.toml`。 |

---

## 四、服务端逆向请求 (`ServerRequest`) —— 对应「请求 (`Request`) 与 回应 (`Respond`)」

当个体在运行中触发需要外部裁决的动作时，`codex app-server` 会向客户端发送一条**同时包含 `id` 和 `method`** 的 JSON-RPC 请求。客户端回复后，服务端广播 `serverRequest/resolved`（`{ threadId, requestId }`）。

| 逆向请求 `method` | 触发时机与参数摘要 (`params`) | 客户端回应 (`result`) 格式 |
| :--- | :--- | :--- |
| `item/commandExecution/requestApproval` | 沙箱外命令或受保护命令请求审批：`{ kind: "command" \| "stdin", threadId, turnId, itemId, command?, cwd?, reason?, proposedExecpolicyAmendment?, availableDecisions? }` | `{ "decision": "accept" \| "acceptForSession" \| "decline" \| "cancel" }`（或附带 `acceptWithExecpolicyAmendment`） |
| `item/fileChange/requestApproval` | 补丁修改受保护路径请求审批：`{ threadId, turnId, itemId, reason?, grantRoot? }` | `{ "decision": "accept" \| "acceptForSession" \| "decline" \| "cancel" }` |
| `item/permissions/requestApproval` | 模型调用 `request_permissions` 工具申请额外权限：`{ threadId, turnId, itemId, cwd, reason, permissions }` | `{ "permissions": {...}, "scope": "turn" \| "session", "strictAutoReview"?: boolean }` |
| `item/tool/requestUserInput` | 模型向用户/中心提出结构化选择题：`{ threadId, turnId, itemId, questions: [{ id, header, question, options }], isBlocking, autoResolutionMs }` | `{ "answers": { "<questionId>": { "answers": ["选项文本"] } } }` |
| `item/tool/call` | 模型调用客户端在 `thread/start.dynamicTools` 中动态注册的工具：`{ threadId, turnId, callId, tool, arguments }` | `{ "contentItems": [{ "type": "inputText", "text": "..." }], "success": true }` |
| `mcpServer/elicitation/request` | MCP 服务端请求表单/URL 授权：`{ threadId, turnId, serverName, mode, message, requestedSchema? }` | `{ "action": "accept" \| "decline" \| "cancel", "content": ... }` |
| `execCommandApproval` / `applyPatchApproval` | 旧版 v1 审批请求兼容接口 | `{ "decision": "approved" \| "denied" }` |

> **工程实现准则**：
> - 处理 `ServerRequest` 必须在独立线程或异步回调中发送响应，**绝不能在 stdout 读取循环里同步阻塞等待人工输入**，否则会导致整个 `app-server` 管道死锁。
> - 若中心运行在无人值守只读模式，收到 `requestApproval` 应立即回传 `{"decision": "decline"}` 并写入中心审计事件流。

---

## 五、服务端通知流 (`ServerNotification`) —— 对应「实时观察 (`Observe`)」

在一轮执行期间，中心只需监听以下关键通知即可完整掌握进展、流式输出、子智能体活动与额度消耗：

1. **会话状态与用量通知**：
   - `thread/status/changed`：`{ threadId, status: { type: "notLoaded" | "idle" | "systemError" | "active", activeFlags?: ["waitingOnApproval" | "waitingOnUserInput"] } }`
   - `thread/tokenUsage/updated`：`{ threadId, turnId, tokenUsage: { total: { totalTokens, inputTokens, cachedInputTokens, outputTokens, reasoningOutputTokens }, last: {...}, modelContextWindow: number } }`
   - `account/rateLimits/updated`：实时推送主/副速率限制窗口剩余百分比与重置时间。
2. **轮与钩子通知**：
   - `turn/started`：`{ threadId, turn: { id, status: "inProgress", items: [] } }`
   - `turn/completed`：`{ threadId, turn: { id, status: "completed" | "interrupted" | "failed", error?: { message, codexErrorInfo }, durationMs? } }`
   - `turn/plan/updated`：`{ threadId, turnId, explanation, plan: [{ step, status }] }`
   - `turn/diff/updated`：`{ threadId, turnId, diff }`（当前轮累计 Git 统一 diff）
   - `hook/started` / `hook/completed`：`{ threadId, turnId, run: HookRunSummary }`
3. **步级完成与流式增量通知**：
   - `item/started` / `item/completed`：`{ threadId, turnId, item: ThreadItem }`
   - 流式增量：`item/agentMessage/delta`、`item/reasoning/summaryTextDelta`、`item/commandExecution/outputDelta`、`item/fileChange/outputDelta`。
   - 异常与重试：`error`（`{ threadId, turnId, error: TurnError, willRetry: boolean }`——当上游流断开且 `willRetry: true` 时，Codex 正在内部自动重连，中心切勿误判为轮次失败！）。

---

## 六、标准调用范式（最小完备示例）

### 6.1 常驻适配器核心调用序列

```python
# 1. 启动进程并完成握手
proc = subprocess.Popen(
    ["codex", "app-server", "--listen", "stdio://"],
    stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=stderr_file,
    cwd=cwd, env=env,
)
client.request("initialize", {
    "clientInfo": {"name": "agent-architecture-hub", "version": "0.1.0"},
    "capabilities": {"experimentalApi": True},
})
client.send_notification("initialized")

# 2. 开新会话（绑定模型、供应商、沙箱与免审批中心 MCP 工具）
thread_id = client.request("thread/start", {
    "cwd": str(Path(cwd).resolve()),
    "model": "gpt-6.1-sol",
    "sandbox": "workspace-write",
    "approvalPolicy": "never",
    "config": {
        "mcp_servers.hub.command": "node",
        "mcp_servers.hub.args": ["hub-mcp-server.js"],
        "mcp_servers.hub.default_tools_approval_mode": "approve",  # 关键：防止 never 策略拒掉中心工具
    },
})["thread"]["id"]

# 3. 发起一轮（可选传入 outputSchema 走甲路结构化交付）
turn_id = client.request("turn/start", {
    "threadId": thread_id,
    "input": [{"type": "text", "text": "请核对当前目录结构并输出 JSON 摘要"}],
    "outputSchema": {"type": "object", "properties": {"summary": {"type": "string"}}, "required": ["summary"]},
})["turn"]["id"]

# 4. 轮内实时插话（可选）
client.request("turn/steer", {
    "threadId": thread_id,
    "expectedTurnId": turn_id,
    "input": [{"type": "text", "text": "补充要求：只统计 .ts 文件"}],
})

# 5. 无损打断当前轮但保留热会话（可选）
client.request("turn/interrupt", {"threadId": thread_id, "turnId": turn_id})
```

### 6.2 多进程共享 `CODEX_HOME` 时的 SQLite 锁防呆
- **现象**：同时启动多个 `codex app-server` 实例并指向同一个 `CODEX_HOME`（`~/.codex`）时，启动阶段初始化 `~/.codex/state_5.sqlite` 偶发报 `SQLITE_BUSY` / `SQLITE_LOCKED`。
- **标准解法**（参考 `codex-collab:1600-1712`）：在中心进程池中**全局只起一个常驻 `codex app-server` 实例复用多 `Thread`**；若确需起多个实例，将 `Popen` + `initialize` 握手包裹在主机级文件锁（如 `~/.codex/app-server-init.lock`）中串行化启动，失败时延迟 750ms 重试一次。
