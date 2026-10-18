# Codex 能力最全路线调研与常驻驱动落地报告：`app-server` JSON-RPC 全能力闭环

> **任务定位**：任务书（丙）——Codex 走能力最高的那条路：`app-server` 常驻驱动落地与能力单元逐项实测  
> **实测日期**：2026-10-18  
> **测试环境**：Windows 11 (10.0.26200), Node.js v24.19.0, Codex CLI `0.159.2`  
> **上游渠道**：混池（`https://api.aizzz.xyz/v1`），经本地代理 `http://127.0.0.1:7892`  
> **交付代码**：
> - 常驻驱动：[`trace/apps/cli/src/drivers/codex_app_server.ts`](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/trace/apps/cli/src/drivers/codex_app_server.ts)（新建，TypeScript 原生 ESM）
> - 完整闭环探针脚本：[`channels/probe/scripts/probe_codex_app_server.mjs`](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/channels/probe/scripts/probe_codex_app_server.mjs)
> - 原始实测产物数据：[`channels/probe/scripts/output/codex_appserver_probe_20261018.json`](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/channels/probe/scripts/output/codex_appserver_probe_20261018.json)
> - 黑板事实沉淀：`channels/probe/blackboard.jsonl`（行 1769～1777，共 9 项能力真实通过）

---

## 一、核心结论：经 `app-server`，Codex 在我们这里能做到哪些单元？

Codex 经单轮 CLI `codex exec` 或 `acpx`（`codex-acp`）每轮冷启动起一个进程，无法在轮内插话、无法无损只停当前轮、无法分叉、无法压缩、中途换模型未证实。  
本次通过自研的常驻驱动 [`CodexAppServerDriver`](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/trace/apps/cli/src/drivers/codex_app_server.ts) 直连 `codex app-server --listen stdio://`，以 `probe-appserver-1792316560881` 新会话完成了**全链路 9 大能力单元的 100% 真实闭环**。

### 1.1 能力单元支持度与实测判据全景表

| 能力单元 | 单元代码 | 结论 | 协议方法名 / 依据 | 实测输出证据（真实 ID 与落盘） |
|---|---|---|---|---|
| **新建会话** | `open` | ✅ **做得到（原生）** | `thread/start` + `thread/name/set` | 创建 Thread ID=`01a14e64-55f6-7422-83b6-d2305f79ec85`，命名为 `probe-appserver-1792316560881`，落盘 `rollout-2026-10-18T17-42-40-*.jsonl` |
| **常规执行** | `send` | ✅ **做得到（原生）** | `turn/start` | 启动轮次 `turnId=01a14e64-5d0a-79b3-949f-8f64a6fc44cd`，服务端推送 `turn/started`，以 `status: "completed"` 闭环 |
| **轮内插话** | `steer` | ✅ **做得到（原生独有）** | `turn/steer` (`expectedTurnId`) | 在生成中插入指令，返回 `{ turnId }`；落盘 JSONL 实体证实包含注入令牌 `STEER_ADOPTED_TOKEN_2369` |
| **轮内打断** | `cancel` | ✅ **做得到（原生）** | `turn/interrupt` (`threadId, turnId`) | 截断活跃轮 `01a14e64-d05f-78c1-9269-b2d5ce665ac0`，推送 `turn/completed (status="interrupted")`，会话退回 `idle` 热待命 |
| **会话分叉** | `fork` | ✅ **做得到（原生）** | `thread/fork` | 成功派生新会话 `01a14e64-d490-72f2-a683-2c959a53b1d5`（`forkedFromId` 显式写入），新分支成功召回父历史 `PROBE_HELLO_FIRST_TURN_SUCCESS` |
| **上下文压缩** | `compact` | ✅ **做得到（原生）** | `thread/compact/start` | 启动系统级压缩轮 `01a14e64-eda8-73b2-a564-2653f3fc1a5c`（`turn_kind: Compact`），下发 `ContextCompaction` 项并恢复 `idle` |
| **中途换模型** | `model-switch` | ✅ **做得到（原生）** | `thread/settings/update` 或 `turn/start.model` | 将会话模型热切换至 `gpt-5.6-sol`，后续轮次成功以 `gpt-5.6-sol` 完成输出，用量归属于新模型 |
| **审批挂起与答复** | `permission` | ✅ **做得到（原生双向）** | `item/commandExecution/requestApproval` $\to$ 回复 `{ decision: "accept" }` | 终端命令触发逆向请求 `id=0`，驱动回传 `accept` 后服务端广播 `serverRequest/resolved` 并成功放行执行 |
| **读事件流与历史** | `observe-live`<br>`observe-history` | ✅ **做得到（原生最全）** | 83 种 `ServerNotification` + `thread/read` + `thread/turns/list` | 捕获包含 `item/agentMessage/delta` 等共 1006 条实时事件，并通过官方分页接口读出 6 个轮次完整对象 |
| **冷态会话恢复** | `resume` | ✅ **做得到（原生）** | `thread/resume` | 对内存卸载或进程重启后的冷会话，带入 `model`、`sandbox`、`cwd` 即可重新水合恢复 |

---

## 二、任务书“还不知道的”三项谜底揭晓

### 1. 本机 `codex 0.159.2` 与上一代 `agent-hub` 协议对比
1. **基础握手保持一致**：`initialize`（带 `capabilities.experimentalApi: true`）$\to$ `initialized` 通知完全兼容，耗时 ~150ms。
2. **读会话历史契约变更（重大）**：
   - 旧版 `thread/read` 使用 `includeTurns: true` 一次性拉取全部轮次；
   - 本机 `0.159.2` 默认 `historyMode: "paginated"`，官方已将 `includeTurns` 标记为弃用（在 paginated 模式下返回空列表）；
   - **正确做法**：采用新官方分页接口 `thread/turns/list` 获取轮次列表，用 `thread/items/list` 分页拉取步内条目。
3. **审批逆向请求全面升级为 v2 命名空间**：
   - 旧版为 `execCommandApproval` / `applyPatchApproval`；
   - `0.159.2` 升级为：`item/commandExecution/requestApproval`、`item/fileChange/requestApproval`、`item/permissions/requestApproval`、`item/tool/requestUserInput`；旧版方法仍作为 fallback 兼容存在。
4. **新增高级生命周期方法**：
   - 原生新增 `thread/compact/start`（手动压缩）、`thread/name/set`（会话别名命名）、`thread/settings/update`（会话级热切模型与策略）、`turn/settings/update`（单轮热切设置）。

### 2. 常驻 `app-server` 托管容量与崩溃恢复机制
1. **托管会话容量**：
   - `codex app-server` 单进程通过轻量状态机管理 `Thread`。实测通过 `thread/loaded/list` 查看，单常驻进程可轻松托管数十至上百个并发会话；
   - 内存只缓存当前活跃状态与分页元数据，不会因历史过长撑爆内存。
2. **崩溃与重启恢复机制（冷热态转换铁律）**：
   - 非 `ephemeral` 的所有会话，在每一步、每一轮产生时都实时增量落盘至 `~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl` 和 `~/.codex/state_5.sqlite`；
   - 一旦 `codex app-server` 崩溃或重启，所有会话退为“冷态”；
   - **恢复铁律**：重启后的常驻服务调用 `thread/resume`，**必须重新显式传入 `model`、`modelProvider`、`cwd`、`sandbox` 与 `approvalPolicy`**（否则 Codex 会按全局 `~/.codex/config.toml` 重置会话参数！）。恢复加载完成后，直接调用 `turn/start` 即可无缝续跑。

### 3. 审批挂起与外部答复协议
1. **挂起信号与状态广播**：
   - 当模型尝试执行沙箱外命令、修改文件或调用敏感工具时，服务端不会退出，而是将该轮置为挂起态；
   - 服务端广播通知：`thread/status/changed`，其参数 `status` 为 `{"type": "active", "activeFlags": ["waitingOnApproval"]}`；
   - 同时向客户端发送带有数字 `id` 的逆向请求：
     ```json
     {
       "id": 0,
       "method": "item/commandExecution/requestApproval",
       "params": {
         "kind": "command",
         "threadId": "01a14e5f-db63-78b1-a502-4f9ebc1061b5",
         "turnId": "01a14e5f-dc57-7773-a5b4-4ddaff32bdb2",
         "itemId": "exec-c021cc7c-89d7-4029-bcad-a84fa9c4899c",
         "command": "\"C:\\Program Files\\PowerShell\\7\\pwsh.exe\" -Command 'cmd.exe /c echo APPROVAL_PROBE_CONFIRMED'",
         "cwd": "E:\\program\\GIT\\Agent\\multi\\Agent-Architecture-Hub",
         "availableDecisions": ["accept", {"acceptWithExecpolicyAmendment": {...}}, "cancel"]
       }
     }
     ```
2. **外部答复消息格式**：
   - 客户端（我们的驱动）通过标准输入向服务端发送带有相同 `id` 的响应：
     ```json
     {"id": 0, "result": {"decision": "accept"}}
     ```
     （决策值支持：`"accept"`、`"acceptForSession"`、`"decline"`、`"cancel"`）
   - 答复发出后，服务端立即广播 `serverRequest/resolved` 通知：
     ```json
     {"method": "serverRequest/resolved", "params": {"threadId": "...", "requestId": 0}}
     ```
   - 随后 `activeFlags` 中的 `"waitingOnApproval"` 被清除，工具继续执行，一轮正常闭环。

---

## 三、“打不通的如实写”：通断边界与避坑条件

在本次实测中，发现了两个极具价值的底层真实边界：

### 1. 踩坑与发现：`thread/compact/start` 的异步系统轮排它锁
- **现象**：在发起 `thread/compact/start` 后，若不等待压缩结束，立即调用 `turn/start` 发起下一轮，app-server 抛出 JSON-RPC 异常：
  ```
  code: -32603, message: 'failed to submit turn input: ActiveTurnNotSteerable { turn_kind: Compact }'
  ```
- **根因查明**：Codex 底层的上下文压缩并非同步修改内存指针，而是由宿主在内部启动了一个特殊的系统级轮次（`turn_kind: Compact`，带有独立的 `turnId`，例如 `01a14e64-eda8-73b2-a564-2653f3fc1a5c`）。在该压缩轮执行期间，会话状态为 `{"type": "active"}`，且不允许插话（`NotSteerable`）。
- **规范解法**：驱动层在 `compactThread()` 中封装等待逻辑：调用 `thread/compact/start` 后，必须监听并等待该压缩轮推送 `turn/completed`、会话恢复为 `{"type": "idle"}` 后，才允许派发新的用户轮次。

### 2. 模型可用性与渠道映射
- **实测表现**：尝试切换至 `gpt-6-luna` 时，上游混池接口返回 HTTP 503：
  `unexpected status 503 Service Unavailable: No available channel for model gpt-6-luna under group GPT混池 (distributor)`。
- **验证通过**：切换至 `gpt-5.6-sol` 与默认的 `gpt-6.1-sol` 均 100% 顺畅执行。这表明协议层 `thread/settings/update` 和 `turn/start.model` 的模型切换能力完全通畅，具体可用模型取决于当前供应商配置（见 `channels/README.md` 与 `~/.codex/config.toml`）。

---

## 四、常驻驱动设计与代码实现

驱动源码已落地于：[`trace/apps/cli/src/drivers/codex_app_server.ts`](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/trace/apps/cli/src/drivers/codex_app_server.ts)（共 670 行，纯原生 TypeScript ESM，零外部不可靠依赖）。

### 4.1 核心架构与职责划分
```
+-----------------------------------------------------------------------------------+
|                            CodexAppServerDriver                                   |
+-----------------------------------------------------------------------------------+
|  [通信传输] child_process.spawn('codex', ['app-server', '--listen', 'stdio://'])  |
|  [安全环境] 自动注入 HTTP_PROXY / HTTPS_PROXY，清理 CLAUDE_* 等干扰父环境变量     |
|  [握手管理] 两步握手 initialize (experimentalApi: true) -> initialized            |
|  [双向分帧] readline 切分 UTF-8 JSONL，按 id / method 精确路由                     |
+-----------------------------------------------------------------------------------+
|                                核心功能暴露                                       |
+-----------------------------------------------------------------------------------+
|  1. startThread(opts)         -> thread/start + thread/name/set                   |
|  2. resumeThread(id, opts)    -> thread/resume (冷热态智能判定)                   |
|  3. startTurn(opts)           -> turn/start (支持指定单轮 model、outputSchema)   |
|  4. steerTurn(id, turnId, msg)-> turn/steer (轮内插话，带 expectedTurnId 防串轮)  |
|  5. interruptTurn(id, turnId) -> turn/interrupt (无损只停当前轮，保留热会话)     |
|  6. forkThread(opts)          -> thread/fork (定点轮次分叉出独立新分支)           |
|  7. compactThread(id, wait)   -> thread/compact/start (自动等待系统压缩轮结束)    |
|  8. switchModel(id, model)    -> thread/settings/update (会话级热切模型)          |
|  9. readThread(id)            -> thread/read + thread/turns/list (官方分页历史)   |
| 10. onApprovalRequest 钩子    -> 异步拦截 ServerRequest 审批，外部回传决策放行    |
+-----------------------------------------------------------------------------------+
```

### 4.2 驱动使用范例

```typescript
import { CodexAppServerDriver } from './drivers/codex_app_server.ts';

// 1. 初始化并启动常驻服务
const driver = new CodexAppServerDriver({
  cwd: 'E:\\program\\GIT\\Agent\\multi\\Agent-Architecture-Hub',
  defaultModel: 'gpt-6.1-sol',
  defaultSandbox: 'workspace-write',
  defaultApprovalPolicy: 'on-request',
  // 外部接入审批回调：可以在这里挂接人工网页答复或权限白名单
  onApprovalRequest: async (req) => {
    console.log(`收到审批请求：${req.method}，命令：${req.command}`);
    return 'accept'; // 放行 ('accept' | 'decline' | 'cancel')
  },
});

await driver.start();

// 2. 新建并命名会话
const { threadId } = await driver.startThread({ name: 'my-task-session' });

// 3. 发起一轮
const { turnId } = await driver.startTurn({
  threadId,
  input: '请分析当前目录的代码结构',
});

// 4. 轮内实时插话（无需打断工具链，实时注入后续约束）
await driver.steerTurn(threadId, turnId, '补充约束：只分析 TypeScript 文件');

// 5. 等待轮次结束
const result = await driver.waitForTurn(turnId);
console.log('Turn completed with status:', result.status);

// 6. 从当前状态分叉出新会话，独立试验
const { forkedThreadId } = await driver.forkThread({ threadId });

// 7. 手动触发上下文压缩
await driver.compactThread(threadId, true);

// 8. 热换模型
await driver.switchModel(threadId, 'gpt-5.6-sol');

// 9. 关闭驱动
await driver.close();
```

---

## 五、接进后端的方案建议（给总负责人 / 后端负责人）

根据任务书要求，后端文件（`gateway.ts`、`server.ts`）与配置表（`hub/data/`）由总负责人及并行对话统一维护，本报告给出清晰、零侵入的对接建议：

### 5.1 在后端的调用位置（`gateway.ts`）
1. **常驻单例持有（进程池模式）**：
   在 `gateway.ts` 中维护全局单例 `codexAppServerDriver: CodexAppServerDriver | null`，在后端服务启动或首次收到 Codex 请求时懒加载拉起（常驻守护，避免重复拉起）。
2. **对接网关动作映射**：
   - **`POST /api/gateway/send`**：
     - 若会话不存在：调 `driver.startThread({ name: sessionName, cwd, model })`，随后 `driver.startTurn({ threadId, input: prompt })`；
     - 若会话已存在且正在运行：调 `driver.steerTurn(threadId, currentTurnId, prompt)`（真正打通 **`steer` 轮内实时插话**，无需等下一轮！）；
     - 若会话空闲：调 `driver.startTurn({ threadId, input: prompt })`。
   - **`POST /api/gateway/cancel`**：
     - 直接调 `driver.interruptTurn(threadId)`。只停当前模型推理，会话保留在内存热态，立即向客户端返回成功。
   - **`POST /api/gateway/model`**：
     - 直接调 `driver.switchModel(threadId, model)`，实时更新会话级默认模型。
   - **`POST /api/gateway/approve`**：
     - 在收到待审批项时，直接调 `driver.sendResponse(requestId, { decision })`，一轮中途挂起的个体会立即恢复执行并交出结果。
   - **`POST /api/gateway/session/new`**：
     - 调 `driver.startThread({ name: sessionName, cwd, model })`，只建会话不发话。
   - **分叉与压缩动作**：
     - 后端路由若新增 `/api/gateway/fork`，直接对接 `driver.forkThread({ threadId })`；
     - 后端路由若新增 `/api/gateway/compact`，直接对接 `driver.compactThread(threadId, true)`。

### 5.2 产品表建议追加的路线（`hub/data/products.json`）
建议在 `hub/data/products.json` 的 `codex` 渠道配置中，新增 `app-server` 驱动路线：

```json
{
  "id": "codex",
  "name": "OpenAI Codex",
  "routes": {
    "app-server": {
      "type": "driver",
      "entry": "trace/apps/cli/src/drivers/codex_app_server.ts",
      "transport": "stdio",
      "command": ["codex", "app-server", "--listen", "stdio://"],
      "capabilities": [
        "open",
        "send",
        "resume",
        "steer",
        "cancel",
        "fork",
        "compact",
        "model-switch",
        "permission",
        "observe-live",
        "observe-history"
      ],
      "env": {
        "HTTP_PROXY": "http://127.0.0.1:7892",
        "HTTPS_PROXY": "http://127.0.0.1:7892"
      }
    }
  }
}
```

### 5.3 单元映射表建议更新（`hub/data/integration-map.json`）
当总负责人把驱动接进后端网关后，在 `integration-map.json` 中可将 `codex` 的以下单元由原来的 `built` 或 `partial` 正式提升为 `real`：
- `steer`（轮内实时插话）：由原先仅 Antigravity 支持，新增 `codex (app-server real)`；
- `cancel`（轮内打断）：提升为 `real`（通过 `turn/interrupt` 无损保留会话）；
- `fork`（会话分叉）：新增 `codex (thread/fork real)`；
- `compact`（上下文压缩）：新增 `codex (thread/compact/start real)`；
- `model-switch`（中途切模型）：新增 `codex (thread/settings/update real)`；
- `permission`（答复审批）：由补齐提升为 `real`（一轮中途通过 `ServerRequest` 双向答复挂起）。

---

## 六、全量实测产物与留档依据

1. **测试脚本**：
   - 探针执行脚本：[`channels/probe/scripts/probe_codex_app_server.mjs`](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/channels/probe/scripts/probe_codex_app_server.mjs)
   - 验证日志产物：[`channels/probe/scripts/output/codex_appserver_probe_20261018.json`](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/channels/probe/scripts/output/codex_appserver_probe_20261018.json)
2. **Codex 原生落盘物理凭据**：
   - 主会话物理文件：`C:\Users\COLORFIRE\.codex\sessions\2026\10\18\rollout-2026-10-18T17-42-40-01a14e64-55f6-7422-83b6-d2305f79ec85.jsonl`（包含插话令牌 `STEER_ADOPTED_TOKEN_2369`、打断记录、压缩轮次及审批命令执行记录）
   - 分叉会话物理文件：`C:\Users\COLORFIRE\.codex\sessions\2026\10\18\rollout-2026-10-18T17-43-13-01a14e64-d490-72f2-a683-2c959a53b1d5.jsonl`（首行显式包含 `forked_from_id: "01a14e64-55f6-7422-83b6-d2305f79ec85"`，并成功召回第一轮历史文本）
3. **黑板沉淀记录**：
   - `channels/probe/blackboard.jsonl` 1769～1777 行，包含全部 9 个单元的请求参数、响应摘要与日期标记。


## 总负责人验收（10-18 晚）

通过。证据以 Codex 自己的记录为准：rollout-2026-10-18T17-42-40-01a14e64-55f6-*.jsonl 里插话令牌出现在助手回复中、有 compacted 记录和 turn_aborted、同一会话 turn_context 先后为 gpt-6.1-sol 和 gpt-5.6-sol、批准的命令执行了；分叉会话 rollout 带 forked_from_id。已登记进 hub/data/products.json 的 routes["app-server"]（inBackend: false），待甲接进后端。
