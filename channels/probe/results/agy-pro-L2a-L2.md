# L2 网关层生命周期接口实测报告 (agy-pro-L2a)

- **测试员**：`agy-pro-L2a`
- **执行时间**：2026-10-17
- **测试端口**：`8931`（自启独立服务实例：`node --no-warnings=ExperimentalWarning trace/apps/cli/src/main.ts serve --port 8931`，实测完毕后已确认销毁释放）
- **会话命名**：统一使用 `probe-l2a-*` 前缀
- **测试范围**：会话生命周期核心接口，覆盖 7 大主力平台（`codex`、`claude`、`zcode`、`workbuddy`、`opencode`、`hermes`、`antigravity`）：
  1. `POST /api/gateway/send`（含首轮 open、多轮 resume、`traceSessionId` 指向原生会话的 resume-native、`mode=queue`、`mode=interrupt`）
  2. `POST /api/gateway/cancel`（打断活跃轮次）
  3. `POST /api/gateway/resume`（恢复中断/报错会话）
  4. `GET /api/gateway/state`（渠道与会话状态快照）
  5. `GET /api/gateway/stream`（SSE 流式事件与实时进度）
  6. `GET /api/sessions` 与 `GET /api/sessions/<id>`（跨平台会话识别与详情解析、原生 vs acpx 混淆核查）
  7. 专项核验 `HANDOFF.md` 第三节自评的 4 个核心论断

---

## 一、 对 HANDOFF.md 第三节自评的专项实证裁判

对照 `HANDOFF.md` 第三节的 4 个核心病灶说法，经过代码走读与 `8931` 端口实机请求，结论如下：

### 1. 点开原生会话发消息是否新建了 acpx 空会话？
- **实测结论：完全属实（判定：接错路 / 假闭环）**。
- **代码位置**：[trace/apps/cli/src/gateway.ts:3388-3406](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/trace/apps/cli/src/gateway.ts#L3388-L3406)、[trace/apps/cli/src/gateway.ts:4184-4225](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/trace/apps/cli/src/gateway.ts#L4184-L4225)
- **实测证据**（见 `channels/probe/scripts/L2/evidence_lifecycle_core.json`）：
  - 当前端省略 `sessionName` 仅传入原生会话 `traceSessionId`（如 `zcode:sess_2f9d76a9-...`、`codex:01a14366-...`、`claude-code:455376bf-...`）时，`gateway.ts:3395` 在 `this.listAcpxSessions()` 中搜索该 ID。
  - 由于 `listAcpxSessions` 仅读取 `~/.acpx/sessions/*.json`，根本匹配不到原生 Codex/Claude/ZCode 会话；
  - `sessionName` 被直接 fallback 赋为默认值 `hub-${prof.id}`（如 `hub-zcode`、`hub-codex`、`hub-claude`）；
  - 随后网关拉起 `acpx <agent> sessions ensure --name hub-<agent>` 和 `acpx prompt -s hub-<agent>`，在 `~/.acpx/sessions/` 下创建了一个全新割裂的 acpx 会话，**原生会话的历史上下文完全未被带入，造成严重接错路**。
  - **唯一例外**：`antigravity` 渠道在 [trace/apps/cli/src/gateway.ts:3636-3640](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/trace/apps/cli/src/gateway.ts#L3636-L3640) 中解析了 `traceSessionId.startsWith('antigravity:')`，提取 CID 后成功调用 `agentapi send-message <cid>`（initialMsgCount=168），在原生会话中完成续聊。

### 2. 审批是否是进程结束后用正则匹配出来的？
- **实测结论：完全属实（判定：假闭环）**。
- **代码位置**：[trace/apps/cli/src/gateway.ts:3960-3987](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/trace/apps/cli/src/gateway.ts#L3960-L3987)、[trace/apps/cli/src/gateway.ts:3226-3242](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/trace/apps/cli/src/gateway.ts#L3226-L3242)
- **实测证据**：
  - 真实的 ACP 协议中途审批应在工具调用期间收到 `session/request_permission` 并在客户端答复后由桥恢复工具执行；
  - `gateway.ts` 是在底层子进程已经彻底 `close` 退出后，在 `finalizeRun` 中执行正则：
    `const permRe = /(permission|denied|not allowed|read-only|refused|approval|未经授权|权限被拒|拒绝执行)/i;`
    扫描 `run.tools[].output` 及错误输出；匹配命中后向内存 `this.pendingApprovals` 插入一条记录；
  - 用户调用 `POST /api/gateway/approve` 批准后，网关只是合成一段文字提示词（`"已批准你的权限请求... 现已开启全读写与命令执行权限 (--approve-all)..."`）重新发起一轮全新的 `sendPrompt`。原进程早已退出死亡，毫无中途拦截与恢复能力。

### 3. 切模型是否只改了 .acpx 会话文件？
- **实测结论：基本属实，且对 Antigravity 完全无动作（判定：假闭环 / 部分通）**。
- **代码位置**：[trace/apps/cli/src/gateway.ts:3011-3058](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/trace/apps/cli/src/gateway.ts#L3011-L3058)
- **实测证据**：
  - 对 `antigravity`：代码第 3011 行显式判断 `if (prof.id !== 'antigravity')`，直接跳过了磁盘与 RPC，仅在网关内存 Map 改写了模型名，返回 `{ ok: true }`，属于纯假闭环。
  - 对其余 6 家：代码确实直接修改了磁盘文件 `~/.acpx/sessions/<id>.json` 的 `raw.acpx.current_model_id = model`；随后在后台异步执行 `spawn('acpx set-model ...')`。但由于 `setSessionModel` 并未等待该子进程结果，若会话尚未落盘或桥未支持 `set-model`，底层并不受控；且 MATRIX.md 多处证明 acpx 的 `set-model` 无法真正改变下层某些桥的真实执行模型。

### 4. “分叉”是否只是把文字拼成提示发给新会话？
- **实测结论：完全属实（判定：假闭环 / 接错路）**。
- **代码位置**：[trace/apps/cli/src/gateway.ts:3292-3330](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/trace/apps/cli/src/gateway.ts#L3292-L3330)
- **实测证据**（见 `evidence_lifecycle_core.json` 中 `handoffTest`）：
  - 网关不存在原生 fork 接口；控制台分叉实际调用 `/api/gateway/handoff`；
  - 该接口将源会话的最近 3 轮交互直接提取为纯文本：
    ```markdown
    【跨智能体协同接力 (Session Handoff): ZCode -> AGY】
    - 源会话: ZCode (probe-l2a-zcode-round)
    - 工作目录: E:\program\GIT\Agent\multi\Agent-Architecture-Hub
    - 最近 2 轮上下文摘要:
    - [第 1 轮] 用户指令: 请牢记暗号：SEC_ZCODE_131692，只回复两个字：收到。
      前序回复摘要: 收到
    - [第 2 轮] 用户指令: 上一轮我告诉你的暗号是什么？
      前序回复摘要: SEC_ZCODE_131692
    ---
    【接力执行指令】: HANDOFF_INSTRUCTION_TOKEN_123
    ```
    并直接在目标渠道调 `sendPrompt` 开新会话，**没有任何底层会话树克隆或快照恢复**。

---

## 二、 接口分项实测明细

### 1. `POST /api/gateway/send`（首轮 open 与 多轮续接 resume）

- **代码位置**：[trace/apps/cli/src/server.ts:217-238](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/trace/apps/cli/src/server.ts#L217-L238)、[trace/apps/cli/src/gateway.ts:3364-3510](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/trace/apps/cli/src/gateway.ts#L3364-L3510)、[trace/apps/cli/src/gateway.ts:4171-4277](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/trace/apps/cli/src/gateway.ts#L4171-L4277)
- **各家实际调用下层路线 (calls) 与判定 (verdict)**：

| 平台 | 下层调用路线 (`calls`) | 首轮新建 (`open`) | 多轮复述暗号 (`resume`) | 综合判定 (`verdict`) | 实测证据摘要 |
|---|---|---|---|---|---|
| **antigravity** | `antigravity/L0/agentapi` | ✅ `pass` | ✅ `pass` (复述暗号) | **接通** | 调 `agentapi new-conversation` 生成 CID `453751d8-...`，第 2 轮精准复述 `SEC_ANTIGRAVITY_338212` |
| **claude** | `claude/L1b/acpx` | ✅ `pass` | ✅ `pass` (复述暗号) | **接通** | 调 `acpx claude prompt`，落盘 `b87039ec-...json`，第 2 轮精准复述 `SEC_CLAUDE_277953` |
| **zcode** | `zcode/L1b/acpx` | ✅ `pass` | ✅ `pass` (复述暗号) | **接通** | 调 `acpx zcode prompt`，落盘 `e2be5095-...json`，第 2 轮精准复述 `SEC_ZCODE_131692` |
| **workbuddy** | `workbuddy/L1b/acpx` | ✅ `pass` | ✅ `pass` (复述暗号) | **接通** | 注入 BYOK 调 `acpx workbuddy prompt`，落盘 `562d9a6a-...json`，第 2 轮复述 `SEC_WORKBUDDY_569816` |
| **opencode** | `opencode/L1b/acpx` | ✅ `pass` | ✅ `pass` (复述暗号) | **接通** | 调 `acpx opencode prompt`，落盘 `df19c5e2-...json`，第 2 轮精准复述 `SEC_OPENCODE_242007` |
| **hermes** | `hermes/L1b/acpx` | ✅ `pass` | ✅ `pass` (会话持久) | **接通** | 调 `acpx hermes prompt`，首轮调用 memory 工具落盘，会话链持续 |
| **codex** | `codex/L1b/acpx` | ❌ `fail` | ❌ `fail` | **假闭环** | 传 `gpt-5.4-mini` 桥报错未宣告；传 `gpt-5.5` 上游返回 503 混池无可用渠道 |

- **关键机制发现**：
  1. **双步拉起模式**：对 6 大 acpx 平台，`gateway.ts:4184-4225` 先 spawn `acpx sessions ensure --name <name>` 确保会话就绪，再 spawn `acpx prompt -s <name> -f -` 并经标准输入灌入提示词。
  2. **模型过滤盲区**：如果传给 `sessions ensure` 的模型未被底层 ACP 桥宣告（如 `gpt-5.4-mini`），`ensure` 进程会退出码 1，随后的 `prompt` 报 `No acpx session found`。

---

### 2. `POST /api/gateway/send`（`traceSessionId` 指向原生会话的情况）

- **代码位置**：[trace/apps/cli/src/gateway.ts:3388-3406](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/trace/apps/cli/src/gateway.ts#L3388-L3406)
- **各家实际调用下层路线 (`calls`) 与判定 (`verdict`)**：
  - `antigravity`：`calls: antigravity/L0/agentapi`，**接通**。通过 `traceSessionId.startsWith('antigravity:')` 提取 CID，调用 `agentapi send-message <cid>`，原生历史无损继承。
  - `codex` / `claude` / `zcode` / `workbuddy` / `opencode` / `hermes`：`calls: <family>/L1b/acpx`，**接错路**。
- **实测证据**：
  - 输入 `zcode:sess_2f9d76a9-0152-48a2-9b09-7525811c9715` $\to$ 网关输出 `sessionName: "hub-zcode"` 并新建 acpx 会话；
  - 输入 `codex:01a14366-e657-7af2-8e24-4064d3a80609` $\to$ 网关输出 `sessionName: "hub-codex"` 并新建 acpx 会话；
  - 输入 `claude-code:455376bf-3926-4c9b-8324-e29d545a99fe` $\to$ 网关输出 `sessionName: "hub-claude"` 并新建 acpx 会话。
  - 说明原生会话与 acpx 会话在下发控制时处于完全割裂状态。

---

### 3. `POST /api/gateway/send`（`mode=queue` 与 `mode=interrupt`）

- **代码位置**：[trace/apps/cli/src/gateway.ts:3437-3465](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/trace/apps/cli/src/gateway.ts#L3437-L3465)、[trace/apps/cli/src/gateway.ts:4097-4113](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/trace/apps/cli/src/gateway.ts#L4097-L4113)
- **下层路线与判定**：
  - `mode=queue`：`calls: gateway/memory-queue`，**没接上（判定：partial）**。
    - 实测当活跃会话正在运行中，下发 `mode: "queue"`，网关返回 HTTP 200 `{ ok: true, status: 'queued', action: 'queued', queueLength: 1, queuePosition: 1 }`。
    - 该队列完全驻留在 Node.js 内存 Map `this.queues` 中，在前一轮 `finalizeRun` 结束时由 Node.js 提取并拉起新轮次。**并未下发底层 ACP 协议的 Windows 命名管道队列（`acpx --no-wait`），更不是同一轮内的实时插话（steer）**。
  - `mode=interrupt`：`calls: cancelRun + startRunInternal`，**接通（判定：pass）**。
    - 活跃会话运行中下发 `mode: "interrupt"`，网关首先触发 `cancelRun` 打断底层进程，随后立即启动新一轮 prompt，返回 `{ ok: true, status: 'running', action: 'started' }`。

---

### 4. `POST /api/gateway/cancel`（打断正在执行的轮次）

- **代码位置**：[trace/apps/cli/src/server.ts:299-307](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/trace/apps/cli/src/server.ts#L299-L307)、[trace/apps/cli/src/gateway.ts:3512-3584](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/trace/apps/cli/src/gateway.ts#L3512-L3584)
- **下层路线与判定**：
  - `antigravity`：`calls: antigravity/L0/connect-rpc`，**接通（判定：pass）**。
    - 网关向 LanguageServer 本地端口派发 HTTP Connect-RPC `CancelCascadeInvocation`，并强杀本地进程，运行状态记录为 `aborted`（durationMs: 99ms），会话在打断后仍可继续发送后续消息。
  - 其余 6 家：`calls: <family>/L1b/acpx`，**接通（判定：pass）**。
    - 网关调用 `acpx <agent> cancel -s <session>` 发送 ACP `session/cancel`，同时调用 `proc.kill()` 清理子进程，状态更新为 `aborted` 并广播 SSE。

---

### 5. `POST /api/gateway/resume`（恢复中断/报错的会话）

- **代码位置**：[trace/apps/cli/src/server.ts:348-357](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/trace/apps/cli/src/server.ts#L348-L357)、[trace/apps/cli/src/gateway.ts:3102-3165](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/trace/apps/cli/src/gateway.ts#L3102-L3165)
- **下层路线与判定**：`calls: POST /api/gateway/send`，**假闭环（判定：partial）**。
- **实测证据**：
  - 调用 `POST /api/gateway/resume` 传入中断的会话，网关读取最后一步报错或用户输入，合成一段新提示词：`"请从刚才中断的位置继续完成未尽任务..."`（或使用传入的 `customHint`），然后直接作为普通消息调用 `this.sendPrompt`；
  - 返回 `{ ok: true, action: "started", run: { prompt: "RESUME_HINT_TOKEN_999", resumedByMeta: "meta_resumer" } }`；
  - 本质是**纯上层提示词重新灌入**，根本没有调用任何底层各家原生断点重试命令（如 `codex exec resume <uuid>` 或 `claude --resume`）。

---

### 6. `GET /api/gateway/state`（网关状态识别）

- **代码位置**：[trace/apps/cli/src/server.ts:411-413](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/trace/apps/cli/src/server.ts#L411-L413)、[trace/apps/cli/src/gateway.ts:2827-2897](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/trace/apps/cli/src/gateway.ts#L2827-L2897)
- **下层路线与判定**：`calls: gateway/memory-state`，**没接上（判定：partial）**。
- **实测证据**（见 `evidence_sessions_state.json`）：
  - 接口返回全部 7 个渠道配置、231 个历史 acpx 会话，以及当前运行数 `activeRuns`；
  - 但是各渠道的状态 `status` **恒等于 `running.length > 0 ? 'working' : 'idle'`**；
  - 这种纯粹基于网关内存 activeRuns 的判定，**完全无法感知底层宿主原生的真实状态**（例如测试中 Claude Code 终端正在运行占用该会话时，`GET /api/gateway/state` 依然汇报该渠道为 `idle`；Antigravity 处于后台等待时亦无法感知）。

---

### 7. `GET /api/gateway/stream`（SSE 流式实时广播）

- **代码位置**：[trace/apps/cli/src/server.ts:417-420](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/trace/apps/cli/src/server.ts#L417-L420)、[trace/apps/cli/src/gateway.ts:3070-3099](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/trace/apps/cli/src/gateway.ts#L3070-L3099)
- **下层路线与判定**：`calls: gateway/sse-broadcast`，**接通（判定：pass）**。
- **实测证据**（见 `evidence_stream_sse.json`）：
  - 客户端建立 SSE 连接后，首帧即推送 `gateway_snapshot`；
  - 在执行任务生命周期中，完整捕捉到了：
    `gateway_snapshot` $\to$ `run_start` $\to$ `gateway_snapshot` $\to$ `run_update` $\to$ `run_done` $\to$ `gateway_snapshot`；
  - `run_update` 实时更新 `thoughts`、`text`、`tools`，与实际执行流的推进严格同步。

---

### 8. `GET /api/sessions` 与 `GET /api/sessions/<id>`（跨平台会话识别）

- **代码位置**：[trace/apps/cli/src/server.ts:429-574](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/trace/apps/cli/src/server.ts#L429-L574)、[trace/apps/cli/src/gateway.ts:2787-2798](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/trace/apps/cli/src/gateway.ts#L2787-L2798)
- **下层路线与判定**：`calls: trace/store.list + gateway/listAcpxSessions`，**接通但身份混淆（判定：partial）**。
- **实测证据**（见 `evidence_sessions_state.json`）：
  - `GET /api/sessions` 聚合返回 1185 个会话，按渠道统计包含 `zcode: 729`、`claude: 131`、`antigravity: 128`、`codex: 82`、`workbuddy: 59`、`hermes: 15`、`opencode: 5` 等；
  - **混淆缺陷**：列表将 `store` 从本地磁盘解析的原生会话（如 `codex:01a14366-...`、`claude-code:455376bf-...`、`zcode:sess_2f9d-...`）与网关包装的会话（`acpx:8d6d7642-...`、`workbuddy:...`）直接拼接在同一数组中，契约数据中缺少 `surfaceType` 字段，前端无法感知哪些能受控续聊、哪些是只读历史；
  - `GET /api/sessions/<id>` 对两套 ID 均可正确响应 HTTP 200，并解析返回完整的 `contract: "0.2"` 会话模型与轮次列表。

---

## 三、 测试产出清单与落盘证据

1. **结构化记录**：已向 `channels/probe/blackboard.jsonl` 追加 32 条标准格式测试记录（均包含 `calls`、`verdict` 字段与原始证据）。
2. **测试脚本**（存放于 `channels/probe/scripts/L2/`）：
   - `test_server_lifecycle.mjs`：8931 独立端口启停与 `/api/health` 检测；
   - `test_l2_sessions_and_state.mjs`：7 大渠道状态机与 1185 会话识别评测；
   - `test_l2_stream_sse.mjs`：SSE 长连接流式事件捕获与真实度评测；
   - `test_l2_send_all_channels.mjs`：全平台首轮新建与暗号复述端到端全链路实测；
   - `test_l2_send_codex.mjs`：Codex 渠道模型路由与 503 阻断实测；
   - `test_l2_lifecycle_core.mjs`：原生会话分发、Queue/Interrupt 模式、Cancel/Resume、切模型、Handoff 接力分叉评测；
   - `append_l2_blackboard.mjs`：黑板记录生成与追加脚本。
3. **原始数据文件**：
   - `evidence_sessions_state.json`
   - `evidence_stream_sse.json`
   - `evidence_send_all_channels.json`
   - `evidence_lifecycle_core.json`
4. **服务端口状态**：测试完毕后，进程已安全杀灭，`8931` 端口已验证完全释放，未残留后台僵尸进程。
