# hub 后端与适配器代码架构缺陷与开源对照研究报告（2026-10-18）

## 核心结论（大白话，三五句话说透）

我们当前系统在后端与适配器层的最大架构缺陷，是**“本应独立成模块的适配器层根本不存在，而是作为一个 4640 行的单体巨石后天塞进了后端服务 `gateway.ts` 中”**，同时在 `hub/tools/agent_gateway.js`（1422 行）里维护了一份平行且逐渐漂移的副本，导致配置分裂、判据打架。整个控制链被死板地绑在“调用命令行拉起 `acpx` 一次性子进程”这一条最窄的单行道上，下层生态原生支持的轮内插话、无损打断、原生分叉和实时中途审批被完全阉割，反而在中枢层用“内存队列、事后正则伪造审批卡片、重新发催促提示词”捏造虚假的控制闭环。对照我们自己早就成型的《适配器模块设计_20260929》权威设计，现有代码在能力清单、七类接口面路由、七项核心语义规则（幂等、uncertain、unsupported、所有权探测）上全部缺位，读层与控层的会话身份彻底精神分裂。对照开源基线，`acpx` 运行时本身已经原生具备完备的会话生命周期、事件流回调和真中途审批，`xacpx` 已经跑通了 `/ssn` 原生会话接管与原子持久队列，`agent-hub` 早已验证了 Codex `app-server` 的原生插话、打断与分叉；我们应当坚决**“借用开源基线筑牢单会话地基，把力气集中在自己的全生态身份统一、四级送达降级链、唤醒看护、渠道治理和多智能体协作层”**。改造必须严格遵循“重构不重写、小步快跑、每步可测可回退”的原则，先止血合并双网关与纠正超时冲突，再借 `acpx` 运行时稳住 Baseline，继而照 `xacpx` 接管原生会话与持久队列，再自 `agent-hub` 移植原生驱动打通高级原语，最后由实测能力登记表收敛为低熵确定性系统。

---

## 〇、 研究背景与设计对照原点

### 1. 用户原话与指导思想
- **“认真阅读代码和开源项目，分析代码架构缺陷”**
- **“我们总共就三层，前端，后端和适配器，各家agent。”**
- **“我们系统能正常跑起来最重要，然后才是拓展，我们为了达到baseline不应该做那么多，而是在baseline的基础上做我们的东西”**
- **“不同的平台的agent之间也是不等价的，比如codex原生对话（人打开的页面），以及subagent和app-server的不一定等价”**

### 2. 对照原点与分析依据
- **认知入口**：`channels/README.md`（统一术语：新建会话、恢复会话、观察、打断、关闭会话、插话、答复审批、分叉、压缩上下文）；
- **已有缺陷评估**：`channels/EVALUATION_20261017.md`（七个根因 R1～R7、第十节补读修正、第十一节 P0 尾项修复）；
- **权威设计正本**：设计目录《适配器模块设计_20260929》（接口面与选路、语义规则、所有权模型、回执分阶段、投递与唤醒）；《核心设计总览_20261011》与《核心抽象_能力层与协作层_20261008》；
- **开源成熟基线**：
  1. `openclaw/acpx` 0.19.5 全局安装包：`C:\Users\COLORFIRE\AppData\Roaming\npm\node_modules\acpx\dist\runtime.d.ts`（可嵌入的 `acpx/runtime`）；
  2. `xacpx` 本机完整源码：`C:\Users\COLORFIRE\.gemini\antigravity\brain\8d0cc8e7-6589-4b6b-973d-9481b5502d96\scratch\oss-consoles\xacpx\`（`/ssn` 原生会话接管、`RuntimeQueueStore` 原子持久队列、`runtime-permission-policy` 审批策略、worker 进程隔离）；
  3. `agent-hub` 本机成熟底座：`E:\program\GIT\Agent\agent-hub\src\agent_hub\`（分支 `ap-integration`，已验证的 `codex_app.py`、`claude_app.py`、`acp.py`、`wake.py`）。

---

## 一、 后端与适配器代码结构图

### 1. 现状模块结构与调用拓扑（文字图）

```
[浏览器前端]
  ├─ Mode 1: 首页协作工作台 (/) ─── hub/js/obs/chat.js (60KB)
  └─ Mode 2: 独立极速控制台 (/console/) ─── console/console.js (112KB)
          │
          │ HTTP REST (/api/gateway/*, /api/sessions) + SSE (/api/gateway/stream)
          ▼
┌────────────────────────────────────────────────────────────────────────┐
│ 后端服务层 :8899 (trace/apps/cli/src/server.ts, 653 行)                   │
│   ├─ 静态路由与目录映射 (/trace/, /console/, /hub/, /concept/)          │
│   ├─ 会话查询路由 (/api/sessions) ─── 粗暴拼接 store.list() 与 extra   │
│   └─ 网关请求路由 (/api/gateway/send, approve, handoff, model, cwd...) │
└──────────────────┬─────────────────────────────────────────────────────┘
                   │
                   ▼ (直接方法调用，内存状态共享)
┌────────────────────────────────────────────────────────────────────────┐
│ 后端主动执行巨石中心 (trace/apps/cli/src/gateway.ts, 4641 行)            │
│ 内部混合了 8 大非正交职责：                                             │
│   [职责1] 静态渠道元数据硬编码 (CHANNEL_PROFILES, 122-310行)             │
│   [职责2] 元智能体巡检规则与大脑调度 (loadMetaAgents, patrolLoop, 748-1296行)│
│   [职责3] 外部会话日志扫描器 (Antigravity brain, WorkBuddy db, Hermes db)  │
│   [职责4] 内存会话与工作区解析 (resolveSessionCwd, 2266-2330行)         │
│   [职责5] 会话状态转换与合约适配器 (getAcpxSessionAsContract, 2466-2860行)│
│   [职责6] 纯内存排队与状态广播 (queues, activeRuns, SSE, 3286-3600行)   │
│   [职责7] Antigravity 专有 RPC 控制 (startAntigravityRun, 3715-3970行) │
│   [职责8] ACPX 命令行进程管理器与事后正则审批 (startRunInternal, 4227-4640行)│
└─────────┬──────────────────────────────────────────────────────────────┘
          │ (每次调用拉起全新一次性子进程)
          ├────────────────────────────────────────┬─────────────────────┐
          ▼                                        ▼                     ▼
┌───────────────────────────┐      ┌──────────────────────────┐   ┌──────────────┐
│ acpx CLI 一次性命令行进程 │      │ Antigravity 本机服务     │   │ 只读旁路解析 │
│ (子进程 stdio: spawn)     │      │ language_server.exe      │   │ trace/store  │
│   ├─ codex-acp            │      │   ├─ agentapi CLI        │   │ (被动扫文件) │
│   ├─ claude-agent-acp     │      │   └─ Connect-RPC (:port) │   └──────────────┘
│   ├─ zcode-acp-server     │      └──────────────────────────┘
│   ├─ codebuddy --acp      │
│   ├─ opencode acp         │
│   └─ hermes acp           │
└───────────────────────────┘

┌────────────────────────────────────────────────────────────────────────┐
│ 平行命令行网关 (hub/tools/agent_gateway.js, 1422 行)                    │
│   ├─ 重复的静态配置表 (AGENT_PROFILES, 支持 10 家，多 droid/gemini/doubao)│
│   ├─ 重复的环境清理与发现函数 (agentBaseEnv, claudeProviderEnv, LS发现) │
│   ├─ 模式1：守护进程在线时 ─── 调 :8899 /api/gateway/send 同步等待     │
│   └─ 模式2：守护进程离线时 ─── spawnSync('acpx') 独立阻塞执行 (无队列)  │
└────────────────────────────────────────────────────────────────────────┘
```

### 2. 核心模块与代码行数统计

| 模块文件路径 | 角色与定位 | 实际行数 | 真实承担的职责 | 架构健康度诊断 |
|---|---|---|---|---|
| `trace/apps/cli/src/server.ts` | 后端 HTTP/SSE 接入层 | 653 行 | 端口监听、静态资源托管、REST API 路由分发、会话列表合并、上下文压缩裁剪 | 🟡 较清晰，但会话合并逻辑掺杂了对会话 ID 前缀的猜测推断 |
| `trace/apps/cli/src/gateway.ts` | 主动执行与网关中心 | **4,641 行** | **本应属于适配器层的全部逻辑**（协议包装、进程启动、事件解析、状态推断）＋ **元智能体编排** ＋ **内存队列** ＋ **会话扫描** | 🔴 **严重巨石（God Object）**，违反单一职责原则，缺乏适配器分层 |
| `hub/tools/agent_gateway.js` | 命令行统一网关 | 1,422 行 | 命令行传参解析、配额查询（Yinzi/Codex/SearchPools）、BOARD 门禁检查、双模执行路由 | 🟡 定位为 CLI 门禁，但与 `gateway.ts` 存在大量重复代码且逻辑漂移 |
| `trace/apps/cli/src/store.ts` | 被动会话存储中心 | 260 行 | 扫描磁盘历史会话文件、维护内存索引、多目录聚合 | 🟢 职责单一纯粹，专职只读旁路 |
| `trace/packages/adapters/src/*` | 各种原生格式解析器 | 约 1,800 行 | 解析 Codex rollout JSONL、Claude projects JSONL、ZCode sqlite 等原生格式 | 🟢 只读解析良好，但只读状态机（`state.ts`）过于简陋 |
| `trace/packages/contract/src/types.ts` | 数据契约层 | 265 行 | 定义 Session, Turn, Step, SessionState, SessionSummary 等前后端契约 | 🟡 缺少 `surfaceType` 与所有权状态定义 |

---

## 二、 gateway.ts 与 agent_gateway.js 平行实现深度比对

系统内部目前存在两套平行的网关控制实现：一套是常驻后端的 `gateway.ts`，另一套是供命令行和脚本使用的 `hub/tools/agent_gateway.js`。二者表面上互为补充（CLI 优先尝试转发给后端），但在实际代码实现上存在严重的重复与行为脱节。

### 1. 400 余行高度重复的代码清单（证据确凿）

| 重复逻辑单元 | `gateway.ts` 位置 | `agent_gateway.js` 位置 | 重复内容与危害 |
|---|---|---|---|
| **环境变量清理 (`agentBaseEnv`)** | `gateway.ts:29-39` | `agent_gateway.js:269-275` | 逐行清理 `CLAUDECODE`, `CLAUDE_*`, `ANTHROPIC_*`。两处完全复制，未来若需清理新变量极易遗漏一处。 |
| **Claude 供应商配置读取 (`claudeProviderEnv`)** | `gateway.ts:41-51` | `agent_gateway.js:277-287` | 从 `~/.claude/settings.json` 提取 `env` 配置。两处完全一致。 |
| **Windows 命令行参数转义 (`quoteWinArg`)** | `gateway.ts:571-575` | `agent_gateway.js:318-322` | Windows cmd 参数加双引号处理。完全重复。 |
| **Antigravity LS 进程与端口发现 (`discoverAntigravityLs`)** | `gateway.ts:1317-1386` (70 行) | `agent_gateway.js:433-499` (67 行) | 使用 `wmic` / `powershell Get-CimInstance` 检索 `language_server_windows_x64.exe` 的命令行并提取 `--csrf_token` 和端口。逻辑完全同构。 |
| **Antigravity 项目 ID 解析 (`resolveAgyProjectId`)** | `gateway.ts:347-374` | `agent_gateway.js:501-532` | 将 Windows 盘符与路径哈希编码为 Antigravity workspace project ID。算法与正则完全同构。 |
| **Antigravity 会话空闲探测 (`agyConversationIdle`)** | `gateway.ts:3880-3893` | `agent_gateway.js:534-547` | 直连 `conversation_summaries.db` 校验 `status='IDLE' && not_fully_idle=0`。完全同构。 |
| **渠道配置表 (`CHANNEL_PROFILES` vs `AGENT_PROFILES`)** | `gateway.ts:122-310` | `agent_gateway.js:37-213` | 渠道 ID、适配器包名、环境变量注入规则（如 WorkBuddy 的 BYOK JSON 串）高度重合。 |

### 2. 关键行为不一致点（行为漂移）

| 维度 | `gateway.ts` (后端常驻网关) | `hub/tools/agent_gateway.js` (命令行网关) | 架构缺陷与实测后果 |
|---|---|---|---|
| **支持的渠道数量** | **仅 7 家** (`codex`, `claude`, `zcode`, `workbuddy`, `opencode`, `antigravity`, `hermes`) | **共 10 家** (多了 `droid`, `gemini`, `doubao-desktop`) | 前端控制台完全看不到 `droid` 和 `gemini` 的调度能力，命令行网关却声称支持 10 家（实测 `node agent_gateway.js targets` 返回 `count: 10`）。 |
| **默认模型不一致** | Antigravity 默认 **`pro`** (`gateway.ts:262`) | Antigravity 默认 **`flash`** (`agent_gateway.js:187`) | 同一个请求不传模型时，从控制台点发出去走贵且慢的 `pro`，从命令行发出去走便宜的 `flash`。 |
| **推荐模型列表漂移** | OpenCode 推荐 5 个模型 (`opencode/big-pickle`, `zhipuai-coding-plan/glm-5.3-flash` 等，`gateway.ts:236-241`) | OpenCode 仍停留在旧的 3 个模型 (`agent_gateway.js:121`) | 命令行网关未同步 10-18 最新可用的 `deepseek/deepseek-flash` 等模型。 |
| **Hermes 环境变量注入** | 注入 `HERMES_ACP_SKIP_CONFIGURED_MCP: '1'` 和 `PYTHONIOENCODING: 'utf-8'` (`gateway.ts:304`) | **漏注入** `HERMES_ACP_SKIP_CONFIGURED_MCP`，仅注入了 `PYTHONIOENCODING` 和 `PYTHONUTF8` (`agent_gateway.js:143`) | 命令行独立拉起 Hermes 时会错误加载外部配置的 MCP 服务导致干扰，后端服务启动则不会。 |
| **前置门禁检查 (Preflight Check)** | **完全无门禁检查**，直接拉起子进程 | 严格读取 `channels/BOARD.md` 的红黄绿灯与持有锁 (`agent_gateway.js:405-430`) | 后端无法拦截处于 🔴/🔒 锁死状态的渠道，容易引发并发冲突；而 CLI 却受门禁保护。 |
| **轮次成败判定 (Bug 修复脱节)** | 采用 10-18 最新的 `judgeAcpxTurn`，基于 `stopReason`（`end_turn` 为成功，过滤警告帧，`gateway.ts:4426`） | 独立运行时仍采用旧判据：`turnRes.exitCode === 0 && !parsed.error` (`agent_gateway.js:998`) | **重大脱节**：Hermes 在恢复会话时常报一条模型未配置警告，后端已能正确判定为成功，而 `agent_gateway.js` 独立运行时仍会误判为 `ok: false`！ |
| **运行模式与并发** | 异步非阻塞：基于 `child_process.spawn`，事件流通过 SSE 广播，维护内存任务队列 | 独立运行时为 **同步完全阻塞**：采用 `spawnSync`，阻塞整个 Node 进程达 120 秒，且无任何排队机制。 | 命令行在守护进程离线时是一个死板的阻塞脚本，不具备任何并发管理能力。 |

---

## 三、 六大核心运行机制散落点深度排查

按照用户要求，对**状态判定、排队、超时、重试、权限、会话身份**六大核心机制在现有代码库中的散落位置进行全面穿透排查：

### 1. 状态判定（State Judgment）—— 散落于 7 处

当前系统没有统一的状态机，而是由多个模块“各猜各的”：
1. **只读旁路粗暴推断**（`trace/packages/adapters/src/state.ts:29-56`）：通过分析历史轮次最后一步状态与文件 `mtime`。如果最后一步处于 `running` 且距离现在小于 30 分钟（`STALE_MS = 30 * 60 * 1000`），就一律判定为 `working`；如果进程早已死掉但未满 30 分钟，界面将持续显示虚假的“在生成回复”。
2. **ACP 轮次成败判据**（`trace/apps/cli/src/gateway.ts:4426-4449`）：`judgeAcpxTurn()`。基于进程退出后的 `stopReason`（`end_turn`, `max_tokens` 为完成；`cancelled` 有回复为完成，无回复为失败；`refusal` 为失败；有 `deniedTools` 报权限被拒）。
3. **Antigravity 专有运行探测**（`trace/apps/cli/src/gateway.ts:3844-3893`）：`isAgyTurnDone()` 与 `agyConversationIdle()`。通过轮询 `conversation_summaries.db` 的 `status` 是否为 `IDLE` 且 `not_fully_idle === 0` 来判定真空闲。
4. **ACP 会话快照解析**（`trace/apps/cli/src/gateway.ts:2331-2465`）：`listAcpxSessions()`。直接读取 `~/.acpx/sessions/*.json` 文件的 `status` 字段或最近 `updatedAt` 时间戳。
5. **WorkBuddy 桌面会话推断**（`trace/apps/cli/src/gateway.ts:1690-2000`）：`parseWorkbuddyJsonlSession()`。根据 JSONL 尾行是否有 `response` 字段来推断是 `idle` 还是 `working`。
6. **Hermes 会话状态查询**（`trace/apps/cli/src/gateway.ts:2001-2250`）：`loadHermesSessions()`。读取 Hermes 的 `state.db` SQLite 数据库记录。
7. **命令行网关退出判定**（`hub/tools/agent_gateway.js:324-375`）：`parseAcpxNdjson()`。通过标准流是否被挂上 `obj.error` 且子进程退出码是否为 0 粗暴判断。

### 2. 排队机制（Queuing）—— 散落于 3 处

1. **后端网关内存入队**（`trace/apps/cli/src/gateway.ts:3548-3560`）：当目标会话正处于 `running` 状态且模式为 `queue` 时，生成 `q_${Date.now()}` 并推入 `this.queues.get(key)` 内存数组中。
2. **后端网关内存出队排空**（`trace/apps/cli/src/gateway.ts:4209-4225`）：在 `finalizeRun()` 结束当前轮次时，执行 `q.shift()` 取出下一条并立即调用 `startRunInternal`。
   - **致命缺陷**：排队全部存放在 Node.js 进程内存中，**一旦服务重启或崩溃，用户排队发送的所有消息彻底消失**，无任何落盘与恢复重放机制；完全没有利用 `acpx` 官方的原生 Named Pipe 队列（`\\.\pipe\acpx-*.sock` 与 `--no-wait`）。
3. **命令行网关传参**（`hub/tools/agent_gateway.js:916`）：在连接后端时透传 `mode: args.mode === 'queue' ? 'queue' : 'send'`；在独立离线运行时完全不支持排队。

### 3. 超时机制（Timeout）—— 散落于 7 处，且存在严重逻辑冲突

1. **ACPX 单轮总超时常量**（`trace/apps/cli/src/gateway.ts:14`）：`const ACPX_TURN_TIMEOUT_SEC = Number(process.env.HUB_ACPX_TIMEOUT_SEC) > 0 ? Number(process.env.HUB_ACPX_TIMEOUT_SEC) : 3600;`（P0 改为 1 小时）。
2. **底层进程拉起传参**（`trace/apps/cli/src/gateway.ts:4354-4355`）：给 `acpx` CLI 子进程显式传递 `--timeout 3600`。
3. **同步等待超时硬编码（重大 Bug）**（`trace/apps/cli/src/gateway.ts:3286, 3587`）：
   ```typescript
   // gateway.ts:3587
   const doneRun = (await this.waitForRunCompletion(run.runId, params.timeoutMs || 120000)) || run;
   ```
   **冲突点**：底层 `acpx` 允许执行 3600 秒，但 `waitForRunCompletion` 的默认超时被硬编码为 **120000 毫秒（2 分钟）**！当任何一个耗时任务（如构建、跑长测试）执行超过 2 分钟，`waitForRunCompletion` 就会被 `setTimeout` 强制唤醒并返回仍处于 `status: 'running'` 的 `doneRun`。导致 `sendPrompt` 提前返回 `ok: false`，界面显示超时失败，而底层的智能体子进程仍在后台继续运行！
4. **Antigravity LS 发现超时**（`trace/apps/cli/src/gateway.ts:1349, 1365`）：探测进程超时 8 秒，RPC 握手超时 3 秒。
5. **ACPX Ensure 命令超时**（`trace/apps/cli/src/gateway.ts:3666`）：建立会话超时 8 秒。
6. **命令行网关运行超时**（`hub/tools/agent_gateway.js:895, 921`）：`timeoutSec = Number(args.timeout || 120)`，向守护进程请求传 `timeoutSec + 10`。
7. **只读旁路僵尸超时判定**（`trace/packages/adapters/src/state.ts:8`）：`STALE_MS = 30 * 60 * 1000`（30 分钟无写入判僵尸）。

### 4. 自动重试机制（Retry）—— 散落于 3 处

1. **断线中途重试拦截**（`trace/apps/cli/src/gateway.ts:4137-4206`）：在 `finalizeRun()` 内由 `meta_resumer` 监管。若判定为“中途断开（`brokeMidTurn = !run.stopReason && !run.setupFailed && !run.deniedTools?.length`）”，通过 `setTimeout` 延迟 `retryDelaySec` 秒后重新调用 `startRunInternal`。
   - **合成提示词修剪**：P0 修复后改为发送原提示词片段：`'上一轮在中途断开了，没有拿到回复。请接着完成原来的请求：' + (run.originalPrompt || opts.prompt).slice(0, 400)`，避免了提示词无线嵌套。
2. **配额错误自动切换模型**（`trace/apps/cli/src/gateway.ts:4150-4165`）：若错误信息匹配 `/(429|quota|rate[_\s-]?limit|overloaded|model_not_found)/i`，由 `meta_maint` 自动从 `recommendedModels` 中挑选下一个模型并更新会话模型。
3. **元智能体参数控制接口**（`trace/apps/cli/src/server.ts:314-350` 与 `gateway.ts:824-910`）：通过 `POST /api/gateway/meta-agents` 动态下发 `maxRetries` 与 `retryDelaySec`。

### 5. 权限与审批（Permissions & Approvals）—— 散落于 6 处，假闭环核心

1. **HTTP 请求权限字段解析**（`trace/apps/cli/src/server.ts:144-149`）：`parsePermissions` 统一解析 `permissions` 或 `permissionMode`，支持 `all`、`reads`、`deny`。
2. **审批处理 HTTP 路由**（`trace/apps/cli/src/server.ts:245-253`）：接收 `POST /api/gateway/approve`。
3. **工具类别正则分类器**（`trace/apps/cli/src/gateway.ts:498-549`）：`classifyTool()`。通过硬编码工具名和输入参数的正则判断是 `read`、`edit`、`shell`、`web` 还是 `mcp`。
4. **进程退出后的事后正则匹配（假审批病灶，`gateway.ts:4065-4093`）**：
   ```typescript
   // 进程跑完退出后才去匹配文本！
   const permRe = /(permission|denied|not allowed|read-only|refused|approval|未经授权|权限被拒|拒绝执行)/i;
   const blockedTool = run.tools.find(
     (t) => (t.status === 'error' && permRe.test(t.output || '')) || ...
   );
   if (blockedTool) {
     this.pendingApprovals.unshift(approvalItem); // 在前端造出一个审批卡片
   }
   ```
5. **事后伪造续跑（假闭环重发，`gateway.ts:3314-3360`）**：
   当用户在控制台点击“批准”时，`resolveApproval()` 并不是向挂起的进程回复许可，而是**重新向大模型发送一句合成提示词**：
   ```typescript
   const resumePrompt = `已批准你的权限请求（工具：${item.toolName}），现已开启全读写与命令执行权限 (--approve-all)，请继续完成刚才的操作...`;
   await this.sendPrompt({ ..., prompt: resumePrompt, permissions: 'all' });
   ```
6. **命令行网关参数映射**（`hub/tools/agent_gateway.js:966-971`）：将命令行参数映射为 `--approve-all` / `--approve-reads` / `--deny-all`。

### 6. 会话身份（Session Identity）—— 散落于 6 处，读控分裂之源

1. **会话列表合并层（粗暴拼接）**（`trace/apps/cli/src/server.ts:437-450`）：
   ```typescript
   const baseIdx = store.index(); // trace 从磁盘扫出来的原生会话（codex:<uuid>, claude-code:<uuid>）
   const extra = gateway.getExtraSummaries(existingIds); // gateway 扫出来的 ~/.acpx/sessions/*.json
   const combined = [...extra, ...baseIdx.sessions]; // 混排在一起输出给前端
   ```
2. **会话详情路由前缀猜解**（`trace/apps/cli/src/server.ts:522-535`）：通过 `rawId` 是否以 `new:`、`acpx:`、`antigravity:`、`workbuddy:`、`hermes:` 开头来决定是调 `gateway` 还是调 `store`。
3. **网关内部运行锁槽位**（`trace/apps/cli/src/gateway.ts:1297`）：`slotKey(channel, sessionName) => ${channel}:${sessionName}`，仅用渠道加简短名称作为运行键。
4. **原生会话发送消息静默降级（致命病灶）**（`trace/apps/cli/src/gateway.ts:3508-3526`）：
   ```typescript
   let sessionName = (params.sessionName || '').trim();
   const tsid = params.traceSessionId; // 前端传来的 codex:c69dd443-4ce4-4360-ba33-df621a64bc3e
   if (!sessionName && tsid) {
     const existing = this.listAcpxSessions().find(...); // 仅在 acpx 会话表里找！
     if (existing) sessionName = existing.sessionName;
   }
   if (!sessionName) {
     sessionName = `hub-${prof.id}`; // 找不到原生映射，强行降级为 hub-codex！
   }
   ```
   **后果**：用户在控制台点开一个原生 Codex 历史会话发送消息，网关由于在 `.acpx` 里找不到这个 UUID，直接降级为调用 `acpx codex -s hub-codex`，在底层新建了一个空会话，根本没有续上原对话！
5. **会话目录解析与继承**（`trace/apps/cli/src/gateway.ts:2255-2275`）：`existingSessionCwd` 与 `resolveSessionCwd`。
6. **命令行网关默认会话名**（`hub/tools/agent_gateway.js:894`）：`sessionName = args.session || 'gw-' + prof.id`。

---

## 四、 核心架构缺陷清单（核对、补充与修正）

本节对 `channels/EVALUATION_20261017.md` 中的根因 R1～R7 进行核对与深化，并提出新的根因 R8：

| 编号 | 缺陷现象与危害 | 代码具体位置（文件:行号） | 根因分类 | 证据与判定 |
|:---:|---|---|:---:|---|
| **D01** | **原生历史会话发消息被静默替换为空会话**：点击左栏原生扫描到的 Codex/Claude 会话发送消息，未调用原生恢复命令，而是新建了 `hub-<channel>` 会话。 | `trace/apps/cli/src/gateway.ts:3508-3526`<br>`trace/apps/cli/src/server.ts:437-495` | **R3（读控两套会话身份）** | 证据：代码中 `listAcpxSessions().find` 仅查 acpx 记录，原生会话命中失败后直接执行 `sessionName = 'hub-' + prof.id`。 |
| **D02** | **权限审批是事后正则匹配与全放行重发（假闭环）**：智能体在工具执行前未挂起，执行失败退出后网关用正则扫描 stdout，点击批准后以全放行重发一段提示词。 | `trace/apps/cli/src/gateway.ts:4065-4093`<br>`trace/apps/cli/src/gateway.ts:3314-3360` | **R2（控制只有一条路，其余原语用文字模拟）** | 证据：代码 `permRe.test(t.output)` 发生在 `finalizeRun` 之后，`resolveApproval` 显式重新调用 `sendPrompt(..., permissions: 'all')`。 |
| **D03** | **长耗时任务在 120 秒被提前误判失败**：底层 `acpx` 设了 3600 秒超时，但后端等待函数 `waitForRunCompletion` 硬编码了 120 秒超时。 | `trace/apps/cli/src/gateway.ts:3286`<br>`trace/apps/cli/src/gateway.ts:3587` | **R6（运行性质：超时冲突）** | 证据：代码 `params.timeoutMs || 120000` 导致执行满 2 分钟立即返回 `status: 'running'`, `ok: false`，但后台子进程仍在跑。 |
| **D04** | **排队仅在网关内存保存，服务重启全部丢失**：运行中发送的消息存入 `this.queues` 内存 Map，缺乏原子落盘与崩溃重放机制。 | `trace/apps/cli/src/gateway.ts:3548-3560`<br>`trace/apps/cli/src/gateway.ts:4209-4225` | **R6（运行性质：脆弱队列）** | 证据：代码无任何 `fs.writeFileSync` 队列持久化逻辑；重启服务后 `this.queues` 重新初始化为空 Map。 |
| **D05** | **后端与命令行网关双份实现代码重复且逻辑漂移**：`agent_gateway.js` 存在 400 余行与 `gateway.ts` 重复的代码，且未同步最新的 `judgeAcpxTurn` 判据。 | `hub/tools/agent_gateway.js:269-547`<br>`trace/apps/cli/src/gateway.ts:29-575` | **R4（前后端与网关约定散落）** | 证据：`agent_gateway.js:998` 仍用 `exitCode === 0 && !parsed.error`，Hermes 警告帧在 CLI 下报失败，在后端报成功。 |
| **D06** | **能力与模型配置在两处硬编码写死**：`gateway.ts` 与 `agent_gateway.js` 各自维护一套模型列表与开关，Antigravity 默认模型一处为 `pro` 一处为 `flash`。 | `trace/apps/cli/src/gateway.ts:122-310`<br>`hub/tools/agent_gateway.js:37-213` | **R1（没有能力登记，配置硬编码）** | 证据：两份配置文件中模型名、渠道数（7 vs 10）、推荐模型互不一致。 |
| **D07** | **只读旁路状态判定存在长达 30 分钟的僵尸窗口**：`detectState` 依靠文件 `mtime`，在进程死亡后仍持续返回 `working` 状态达 30 分钟。 | `trace/packages/adapters/src/state.ts:8, 44-46` | **R6（运行性质：状态判定不可靠）** | 证据：代码 `STALE_MS = 30 * 60 * 1000`，且缺乏对进程是否存活的探测。 |
| **D08** | **单体巨石过载：业务巡检与元智能体侵入底层通信网关**：`gateway.ts` 膨胀到 4641 行，混杂了元智能体巡检大脑、模型容灾切换等协作层逻辑。 | `trace/apps/cli/src/gateway.ts:580-1296`<br>`trace/apps/cli/src/gateway.ts:4150-4187` | **R8（新增：单体巨石与职责膨胀）** | 证据：网关类既要管子进程拉起，又要负责 `tickMetaPatrol` 定时巡检和 `invokeMetaBrainForIncident`。 |

---

## 五、 对照《适配器模块设计_20260929》的差距分析

设计目录中的《适配器模块设计_20260929》是本项目早就定稿的权威设计，现有代码与其相比，差距显而易见：

```
┌────────────────────────────────────────────────────────────────────────┐
│ 《适配器模块设计_20260929》权威规范要求                                  │
├──────────────────────────┬─────────────────────────────────────────────┤
│ 1. 结构划分              │ 能力清单 (CapabilityManifest) ＋ 7 类接口面 │
│ 2. 接口面路由            │ 官方优先、已验证优先；绝不悄悄降级语义      │
│ 3. 语义规则 (§3.3)       │ 幂等(request_id)、uncertain、unsupported、  │
│                          │ 只停自己启动的运行、不改用户全局配置        │
│ 4. 所有权模型 (§5)       │ 5态(owned_by_us, app, terminal, released...) │
│                          │ 推断所有权只能用来禁止写入，不能用来放行    │
│ 5. 投递与唤醒 (§7)       │ Deliver ≠ Wake；四级降级链；回执分阶段确认  │
└──────────────────────────┴─────────────────────────────────────────────┘
                                  │
                                  ▼ 现状代码严重倒退
┌────────────────────────────────────────────────────────────────────────┐
│ 现有代码实现现状 (`gateway.ts` + `agent_gateway.js`)                     │
├──────────────────────────┬─────────────────────────────────────────────┤
│ 1. 结构划分              │ 无适配器模块！4640行单体类包揽一切          │
│ 2. 接口面路由            │ 只有 acpx 命名会话一条路，其余接口全部放弃  │
│ 3. 语义规则              │ 无 request_id；静默降级严重（原生改新建）； │
│                          │ 直接改写 ~/.acpx 磁盘配置                   │
│ 4. 所有权模型            │ 完全无所有权概念！盲目写入，无视 7 分钟写锁 │
│ 5. 投递与唤醒            │ 唤醒机制完全缺失；纯靠阻塞等进程退出        │
└──────────────────────────┴─────────────────────────────────────────────┘
```

1. **接口面严重缺失**：
   规范设计了 7 类接口面（文件读取、一次性运行、流式运行、服务协议、队列投递、hooks、桥接打包）。而现有网关把所有渠道一律退化为“一次性命令行调用”，直接抛弃了 Codex 的 `app-server`（支持热插话/分叉）、Claude 的 `--input-format stream-json`（常驻流式输入）、Codex 桌面队列 `codex queue --thread` 等高级接口面。
2. **严重违反“绝不悄悄降级语义”的红线规则**：
   规范 §3.3 明确规定：“不支持就返回 `unsupported` 并写明原因，绝不悄悄降级成另一种语义。比如‘投递到原会话’失败后，不能自动变成‘新建一个会话’”。而当前 `gateway.ts:3525` 在找不到原生会话的 acpx 映射时，直接将会话名置为 `hub-${prof.id}`，静默新建空白会话，彻底背离了设计公理。
3. **所有权模型（Ownership）形同虚设**：
   规范 §5 定义了所有权 5 态，明确要求“推断出来的所有权只能用来禁止写入，不能用来放行”。当前代码在向会话投递前，完全没有探测 Codex 的 7 分钟排他锁、Antigravity 的 `presence/*.lock`，更没有判断用户终端是否正在输入，极易导致写入冲突。

---

## 六、 对照开源基线：借用方案与自研边界

用户特别强调：**“我们为了达到 baseline 不应该做那么多，而是在 baseline 的基础上做我们的东西”**。本节严格厘清三家开源基线的借鉴方案与我们必须自研的边界。

### 1. 三大开源基线能够直接替我们做的事（借用方案）

| 开源基线 | 源码与产物位置 | 现成成熟能力 | 我们如何接进来（具体做法） |
|---|---|---|---|
| **`acpx/runtime` (v0.19.5)** | `$(npm root -g)/acpx/dist/runtime.d.ts` | 1) `ensureSession({ sessionKey, agent, cwd, sessionOptions })` 规范化管理会话；<br>2) `startTurn({ handle, text, onPermissionRequest })` 产出结构化事件流；<br>3) 轮次成败三态（completed, cancelled, failed）自带权威 `stopReason`；<br>4) `onPermissionRequest` 真中途审批回调。 | **在 trace 后端引入 `acpx/runtime` 依赖**，建立 `AcpRuntimeDriver` 类，直接替代 `gateway.ts` 中基于 `child_process.spawn` 的手工进程管理与脆弱 NDJSON 文本切割。 |
| **`xacpx`** | `oss-consoles/xacpx/` | 1) `/ssn` 原生会话接管（`docs/native-sessions.md`）：列出本地原生会话，按原生 `sessionId` 挂载，生成逻辑别名 `<agent>-<id末8位>`；<br>2) `RuntimeQueueStore` 原子持久队列（`src/bridge/engine/runtime/runtime-queue.ts`）：临时文件 + fsync + 原子 rename + 回读校验，支持幂等去重（深度 20，崩溃重放）；<br>3) 进程隔离模型（`runtime-worker-manager.ts`）：工作进程崩溃不拖垮宿主。 | **移植 `RuntimeQueueStore` 替换 `gateway.ts` 的内存队列**；参考 `/ssn` 逻辑重构 `SessionIdentity`，当用户点击原生会话时，通过 `resumeSessionId` 接管，杜绝新建空会话。 |
| **`agent-hub` (`ap-integration`)** | `E:\program\GIT\Agent\agent-hub\src\agent_hub\` | 1) `codex_app.py`：完整的 Codex `app-server` 驱动（常驻守护进程，原生支持 `turn/steer` 轮内插话、`turn/interrupt` 无损打断、`thread/resume` 恢复、`thread/fork` 分叉、双向审批）；<br>2) `claude_app.py`：常驻 `stream-json` 长连接会话；<br>3) `wake.py`：统一事件叫醒器（增量送达，合并多次叫醒）。 | **在 P3b 阶段将 `codex_app.py` 移植为 TypeScript 模块**，作为 Codex 的高级协议驱动；引入 `wake.py` 的设计思路解决后台任务叫醒问题。 |

### 2. 我们必须自研的核心边界（开源基线做不到的事）

开源项目之所以不能直接代替我们的整个系统，是因为以下 6 个核心能力是多智能体协作中枢特有的，必须由我们自研：

1. **跨生态全谱系会话身份模型与所有权状态机**：
   - 开源 `acpx` 只认自己创建的命名会话；`xacpx` 虽有 `/ssn` 但仅支持部分 ACP 桥。我们拥有桌面端（CDP）、本地 RPC 服务（Antigravity Connect-RPC）、原生 CLI 记录等多源形态，必须自研统一的 `NativeRef = (channel, surfaceType, nativeId)` 与所有权五态判定。
2. **非 ACP 专属生态的原生驱动与插话**：
   - Antigravity 官方发行版没有公开的 ACP 桥，必须由我们自研 `language_server.exe agentapi` 与 Connect-RPC 的深度驱动（已验证通过 Connect-RPC 实现真正的轮内插话与分叉）。
3. **四级降级送达链与宿主唤醒看护**：
   - 实现了“轮内插话 > 原生队列 > 工具结果捎带 > 文件收件箱”四级平滑降级链；智能体主动让出后，由中枢托管等待并在后台任务完成或时间到达时自动唤醒（对应《核心抽象》§2.5）。
4. **能力渠道治理与模型切换层**：
   - 接入 CC Switch 供应商配置池，支持按单次调用覆盖供应商，实时监控中转站与官方渠道的用量水位、故障与熔断，动态回答协作决策中的“下一个是谁”。
5. **基于实测证据驱动的能力登记中心**：
   - 开源项目大多靠硬编码或静态声明，我们自研基于 `blackboard.jsonl` 实测矩阵自动生成 `capabilities.json`，做到前端界面控件渲染完全由低熵确定性证据驱动。
6. **多智能体协作编排层**：
   - 信息层、智能体层、渠道层的协作图谱与轨迹还原，五种基本协作形状（接力、分发、汇总、往返、共享）与“三个决定”自动化推进。

---

## 七、 改造顺序建议与分步验收标准（重构不重写）

坚决杜绝“推倒重来式重写”，坚持**“每步小、每步可测、每步可回退”**。

```
┌───────────────────────────────────────────────────────────────────────┐
│ 改造演进路线图                                                        │
├───────────────┬───────────────────────────────────────────────────────┤
│ 第 1 步 (P0+) │ 治标止血：合并双网关重复代码，修复 120s 超时截断重大 Bug│
│ 第 2 步 (P1)  │ 稳住 Baseline：嵌入 acpx 运行时，接入真中途审批与事件流 │
│ 第 3 步 (P2)  │ 统一身份：照 xacpx /ssn 接管原生会话，落盘持久化原子队列│
│ 第 4 步 (P3)  │ 超越 Baseline：自 agent-hub 移植 Codex/Claude 原生驱动 │
│ 第 5 步 (P4)  │ 治理闭环：实测能力登记表驱动前后端渲染，渠道只读纳管    │
└───────────────┴───────────────────────────────────────────────────────┘
```

### 第 1 步（P0+）：治标止血与双网关收敛
- **改造内容**：
  1. 抽出公共环境与工具函数模块（`agentBaseEnv`, `claudeProviderEnv`, `quoteWinArg`, `discoverAntigravityLs`），消除 `gateway.ts` 与 `agent_gateway.js` 之间的 400 行重复代码；
  2. 修复 `gateway.ts:3587` 中 `waitForRunCompletion` 的 120 秒硬编码超时，改为沿用调用方指定的 `timeoutMs` 或 `ACPX_TURN_TIMEOUT_SEC`（3600 秒）；
  3. 将 `agent_gateway.js` 独立运行时的退出判据同步为 `judgeAcpxTurn`，避免因警告帧导致假失败；
  4. 统一 `gateway.ts` 与 `agent_gateway.js` 的默认模型（Antigravity 统一为已验证的默认值）。
- **验收标准**：
  - 执行耗时 150 秒的长任务（如 `node hub/tools/agent_gateway.js run --agent codex --prompt "count to 150"`），后端不再在 120 秒提前返回失败，能完整等到执行完毕；
  - Hermes 恢复会话时，`agent_gateway.js` 独立运行不再因模型警告而返回 `ok: false`；
  - 语法检查与现存的 `probe/scripts/P0/verify_open_resume.js` 全数通过。

### 第 2 步（P1）：嵌入 acpx 运行时，实现真会话管理与真审批（稳固 Baseline）
- **改造内容**：
  1. 在 `trace/apps/cli` 引入 `acpx/runtime`（版本 `0.19.5`，与全局版本一致）；
  2. 新建 `trace/apps/cli/src/drivers/acp-runtime-driver.ts`，为 6 大 ACP 渠道提供统一的运行时适配，调用 `ensureSession` 与 `startTurn`；
  3. 接入 `onPermissionRequest` 运行时回调：当智能体触发文件修改或命令执行等风险工具时，捕获真实的 ACP JSON-RPC 请求，通过 SSE 推送给前端控制台等待用户拍板；
  4. 彻底删除 `gateway.ts` 中基于退出后文本正则匹配的假审批逻辑（`permRe.test`）与事后全放行重发逻辑。
- **验收标准**：
  - 启动受限权限会话（`permissions: 'reads'`），命令智能体创建文件；
  - 智能体子进程不退出，在工具调用前挂起；
  - 控制台弹出真实的待审批卡片，点击“批准”后工具放行且原对话继续，点击“拒绝”后工具返回被拒错误且智能体能继续思考；
  - WorkBuddy 不再因写记忆文件被拒而报 `cancelled`。

### 第 3 步（P2）：统一会话身份，借用 xacpx 实现原生接管与持久队列
- **改造内容**：
  1. 契约层扩展 `SessionSummary` 与 `Session`，显式引入 `surfaceType: 'acpx' | 'native-cli' | 'native-app' | 'native-rpc'`；
  2. 参考 `xacpx` 的 `/ssn` 原生会话挂载机制，当用户在左栏点击原生会话（如 `codex:<uuid>` 或 `claude-code:<uuid>`）发消息时，提取原生 `nativeId`，经 `resumeSessionId` 接入或原生命令接入，绝不降级为新建 `hub-<channel>` 会话；
  3. 移植 `xacpx` 的 `RuntimeQueueStore`（临时文件 + fsync + 原子 rename），将网关内存队列落盘持久化。
- **验收标准**：
  - 点击左侧列表中已有的原生 Codex 会话发送消息，智能体能够准确复述该原生会话历史中的暗号；
  - 会话磁盘目录 `~/.acpx/sessions/` 中不再生成无意义的割裂空会话；
  - 在任务执行中连续发送 3 条消息排队，重启 `:8899` 后端服务，队列中的消息不丢失，服务重启后能继续排空执行。

### 第 4 步（P3）：自 agent-hub 移植原生协议驱动（超越 Baseline）
- **改造内容**：
  1. 将 `agent_hub/codex_app.py` 移植为 TypeScript 模块 `CodexAppServerDriver`，建立与 `codex app-server` 的长连接；
  2. 接入 Codex 的 `turn/steer`（真正的轮内插话）、`turn/interrupt`（无损打断）、`thread/fork`（原生分叉）；
  3. 完善 Antigravity Connect-RPC 驱动，接通其轮内插话与分叉能力；
  4. 接入 `agent_hub/wake.py` 的叫醒器模型，实现后台长任务完成后的自动唤醒。
- **验收标准**：
  - 在 Codex 执行耗时任务过程中，调用插话接口，智能体在下一步立即纠偏回复；
  - 点击控制台的“分叉”按钮，产生原生派生的新 Thread ID，而不是伪造的文本复制；
  - 前端控制台对于支持插话的渠道开放“实时插话”按钮，对不支持的渠道优雅禁用。

### 第 5 步（P4）：实测能力登记表驱动与渠道治理（低熵闭环）
- **改造内容**：
  1. 网关与前端页面彻底废除硬编码的 `CHANNEL_PROFILES` 能力开关与模型表；
  2. 统一由脚本读取 `probe/blackboard.jsonl` 生成 `hub/data/capabilities.json`，网关与前端仅读取此真源；
  3. 只读接入 `cc-switch.db`，在启动时按单次调用安全加载供应商 Key，并实时展示渠道额度与健康状态灯。
- **验收标准**：
  - 前端页面彻底消除所有死按钮与名不副实的假闭环控件；
  - 渠道出现欠费或故障时，控制台能实时变灯并提示切换备用渠道；
  - 整套系统达到状态自洽、低熵透明的工业级水准。

---

## 附录：本报告依据的实测命令与原始证据片段

1. **命令行网关支持的目标渠道实测（`agent_gateway.js targets --json`）**：
   ```bash
   $env:HTTP_PROXY="http://127.0.0.1:7892"; $env:HTTPS_PROXY="http://127.0.0.1:7892"; node hub/tools/agent_gateway.js targets --json
   ```
   原始输出片段（验证其维护 10 家渠道，与 `gateway.ts` 的 7 家形成背离）：
   ```json
   {
     "ok": true,
     "count": 10,
     "targets": [
       { "id": "codex", "driver": "acpx", "adapter": "@agentclientprotocol/codex-acp", "boardStatus": "🟢 ok" },
       { "id": "claude", "driver": "acpx", "adapter": "@agentclientprotocol/claude-agent-acp", "boardStatus": "🟢 ok" },
       { "id": "zcode", "driver": "acpx", "adapter": "zcode-acp-server@0.69.3", "boardStatus": "🟢 ok" },
       { "id": "workbuddy", "driver": "acpx", "adapter": "codebuddy --acp (v2.160.0)", "boardStatus": "🟢 ok" },
       { "id": "opencode", "driver": "acpx", "adapter": "opencode acp (v1.18.33)", "boardStatus": "🟢 ok" },
       { "id": "hermes", "driver": "acpx", "adapter": "hermes acp (v0.21.1)", "boardStatus": "unknown" },
       { "id": "droid", "driver": "acpx", "adapter": "droid exec --output-format acp (v0.228.0)", "boardStatus": "🟢 ok" },
       { "id": "gemini", "driver": "acpx", "adapter": "gemini --acp (v0.62.0)", "boardStatus": "🟡 cooldown_degraded" },
       { "id": "antigravity", "driver": "agy-agentapi", "adapter": "language_server.exe agentapi + Connect-RPC", "boardStatus": "🟢 ok" },
       { "id": "doubao-desktop", "driver": "opencli-cdp", "adapter": "CDP:9225", "boardStatus": "🟡 cooldown_degraded" }
     ]
   }
   ```

2. **本地开源基线文件真实存在性核查**：
   - `acpx` 运行时类型定义：`C:\Users\COLORFIRE\AppData\Roaming\npm\node_modules\acpx\dist\runtime.d.ts`（经实测存在，共 858 行，明确导出 `createAcpRuntime`, `startTurn`, `onPermissionRequest` 等）；
   - `xacpx` 本机源码：`C:\Users\COLORFIRE\.gemini\antigravity\brain\8d0cc8e7-6589-4b6b-973d-9481b5502d96\scratch\oss-consoles\xacpx\`（经实测存在，包含完整 `src/bridge/engine/runtime/runtime-adapter.ts`、`runtime-queue.ts` 以及 `docs/native-sessions.md`）；
   - `agent-hub` 驱动源码：`E:\program\GIT\Agent\agent-hub\src\agent_hub\`（经实测存在，包含 `codex_app.py` 19KB、`claude_app.py` 13KB、`acp.py` 25KB、`wake.py` 5KB）。
