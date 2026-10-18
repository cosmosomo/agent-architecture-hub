# 分层实测报告：ZCode 智能体家族（L0 原生后端 / L1a ACP 桥直连 / L1b acpx 命令行）

> **作者**：`antigravity-flash/probe-lead-zcode`  
> **时间**：`2026-10-17T17:36:00+08:00`  
> **测试环境**：Windows 11 / Node.js `v24.19.0` / Bun `1.4.2` / 代理 `http://127.0.0.1:7892`  
> **目标宿主**：ZCode `0.16.9`（底层 `E:\zcode\resources\glm\zcode.cjs`） / 桥接器 `zcode-acp-server@0.69.3` / 底座 `acpx@0.19.5`  
> **交付物**：黑板追加 51 条记录至 [`channels/probe/blackboard.jsonl`](file:///E:/program/GIT/Agent/multi/Agent-Architecture-Hub/channels/probe/blackboard.jsonl#L5-L55)，测试脚本归档于 [`channels/probe/scripts/`](file:///E:/program/GIT/Agent/multi/Agent-Architecture-Hub/channels/probe/scripts/)。

---

## 一、测试概要与通断矩阵

本次试点针对 ZCode 智能体生态完成了 **L0（原生后端）**、**L1a（ACP 桥直连）**、**L1b（acpx 命令行）** 三层在 17 项基本能力维度的逐项真机跑通测试。全部测试均采用最轻量的 Flash 模型（`builtin:bigmodel-coding-plan\GLM-5.3-Flash`），测试会话统一以 `probe-` 命名，严格遵循防误杀与省钱原则。

### 1.1 17 项基本能力实测通断矩阵

| 编号 | 能力项 | L0 原生后端 (`native-cli`) | L1a ACP 桥直连 (`acp-bridge`) | L1b acpx 命令行 (`acpx zcode`) | 核心断裂点 / 机制差异说明 |
|:---|:---|:---:|:---:|:---:|:---|
| **open** | 开（新建并完成首轮） | ✅ **pass** | ✅ **pass** | ✅ **pass** | L0 依赖 `ZCODE_MODEL` 环境变量；L1a/L1b 通过 `session/new` 秒级拉起 |
| **resume** | 续（自开会话跨轮记忆） | ✅ **pass** | ✅ **pass** | ✅ **pass** | 三层均实测验证暗号精准召回（命中缓存 `cacheReadTokens: 10432~11456`） |
| **resume-native** | 续原生桌面端会话 | ❌ **fail** | ❌ **fail** | ❌ **fail** | 桌面端与无头 CLI 隔离；acpx 报 `NO_SESSION`（断在注册表无外部会话映射） |
| **observe-live** | 观察·实时（流式输出） | ❌ **fail** | ✅ **pass** | ✅ **pass** | L0 `--json` 进程退出时才输出单块 JSON；L1a/L1b 实时输出 11 个 chunks |
| **observe-history** | 观察·历史（读取记录） | ❌ **fail** | ❌ **fail** | ✅ **pass** | **重大发现**：L1a 报 `Method not found: session/read`；L1b 由 acpx 本地账本补齐通 |
| **state** | 状态识别（存活/空闲） | ❌ **fail** | ✅ **pass** | ✅ **pass** | L0 无状态查询；L1a 实时推 `turnState`；L1b 返回 `alive` / `pid` / `lastPromptTime` |
| **cancel** | 打断（轮内安全打断） | 🟡 **partial** | ✅ **pass** | ✅ **pass** | L0 仅能 SIGINT 强杀进程；L1a/L1b 优雅软打断返回 `stopReason: cancelled` 会话可续 |
| **close** | 关（关闭会话） | ❌ **fail** | ❌ **fail** | 🟡 **partial** | L1a 报 `Method not found: session/close`；L1b 因跨进程身份校验拒绝杀 Queue Owner |
| **steer** | 插话（轮内流式注入） | ❌ **fail** | ❌ **fail** | 🟡 **partial** | ACP 协议不支持轮内打断插话；L1b 通过 `--no-wait` 实现 Named Pipe 队列排队插话 |
| **permission** | 回应（中途权限审批） | 🟡 **partial** | ✅ **pass** | ✅ **pass** | L0 仅支持启动静态 `--mode`；L1a 走 `requestPermission`；L1b 支持 `--approve-reads` |
| **fork** | 分叉（原生分叉） | ❌ **fail** | ❌ **fail** | ❌ **fail** | **假闭环**：L1a `initialize` 声明了 `fork: {}`，但调用抛出 `Internal error`；L1b 无子命令 |
| **compact** | 整理（上下文压缩） | ❌ **fail** | ✅ **pass** | ✅ **pass** | L1b 发送 `/compact`，token 从 21,086 降至 10,422（削减 50.5%），产出摘要 |
| **model-list** | 列模型（真实模型池） | ❌ **fail** | ✅ **pass** | ✅ **pass** | L1a/L1b 动态读取到 7 个真实模型（含智谱 Coding Plan、银子、火山方舟等） |
| **model-new** | 新建时选模型 | ✅ **pass** | ✅ **pass** | ✅ **pass** | L0 走 env；L1a 走 `setSessionConfigOption`；L1b 走 `--model` |
| **model-switch** | 中途切模型 | ✅ **pass** | ✅ **pass** | ✅ **pass** | L1a/L1b 在轮次间无感热切换模型（Flash -> GLM-5.3 成功） |
| **mode-switch** | 切权限模式 | ✅ **pass** | ✅ **pass** | ✅ **pass** | L1a 走 `setSessionMode`，L1b 走 `acpx zcode set-mode`，均成功切到 `plan` 模式 |
| **quota** | 查额度（水位监测） | 🟡 **partial** | 🟡 **partial** | 🟡 **partial** | 单会话流内推送 5h 窗口水位（`used/size: 1000000`）；渠道级靠本地 SQLite 账本聚合 |

---

## 二、关键发现与底层机制剖析

### 2.1 发现 1：L0 原生命令行断在“凭证握手”与“输出整块缓冲”
- **凭证握手阻断**：裸跑 `node zcode.cjs app-server --stdio` 时，ZCode 在 `session/create` 会反向向客户端发送 `session/requestRuntimePreferences`，在每次模型推理前反向发送 `interaction/requestProviderRuntimeHeaders`。普通客户端若不实现反向响应，请求将在 180s 后超时崩溃（`Captcha verification request timed out`）。
- **缓冲整块输出**：L0 CLI 的 `--json` 选项在整个生成完成前绝不向 stdout 输出任何字符，无法满足实时观测（`observe-live`）需求。

### 2.2 发现 2：L1a 声明能力的“假闭环”与 ACP 协议空白
- **Fork 假闭环**：`zcode-acp-server` 在 `initialize` 响应中明确声明支持 `sessionCapabilities: { fork: {} }`，但通过 ACP SDK 调用 `connection.unstable_forkSession({ sessionId })` 时，后端直接抛出 `JSON-RPC Error: Internal error`（见 [`l1a_results.json:210`](file:///E:/program/GIT/Agent/multi/Agent-Architecture-Hub/channels/probe/scripts/l1a_results.json#L210-L212)）。任务书要求重点防范的“声明了但实际不通”在此被精准捕获。
- **缺失 `session/read` 与 `session/close`**：ACP 桥直连调用 `session/read` 和 `session/close` 时均报 `Method not found`，说明标准 ACP 桥并未将底层 app-server 的历史读取与关闭 RPC 暴露给上层。

### 2.3 发现 3：L1b（acpx）的“能力补齐”与“防误杀机制”
- **能力补齐**：虽然 L1a 无法调用 `session/read`，但 `acpx` 凭借自身的本地账本与持久会话索引，完美实现了 `acpx zcode sessions history` 与 `read`，补齐了这一严重短板。
- **防误杀机制（Process Birth Identity）**：跨进程执行 `acpx zcode sessions close` 时，`acpx` 返回错误：`Cannot safely retire queue owner pid ...: its process birth identity is unverified. Its lease was retained.`。这表明在 Windows 下 `acpx` 对驻留守护进程有严格的安全归属校验，不会轻易被子进程篡杀，lease 保持 300s TTL 自然过期。
- **真实验证的上下文压缩（compact）**：向 `probe-l1b-full` 会话发送 `/compact 压缩上下文`，ZCode 自动启动后台压缩轮次，上下文用量从 21,086 骤降至 10,422，成功释放了 10,664 tokens，并在消息流中生成了压缩事件。

---

## 三、作为被委托者遇到的障碍（试点重点复盘）

作为受委托执行测试的研究员，在无预设环境直接进入测试时遭遇了 5 项核心障碍，这些障碍对后续自动化探测工具链设计具有重要参考价值：

1. **Node.js v24 的 `spawn EINVAL` 安全限制（CVE-2024-27980）**
   - **障碍现象**：在 Node.js `v24.19.0` 中，直接调用 `spawn("acpx.cmd", ...)` 会抛出 `Error: spawn EINVAL` 崩溃。
   - **根本原因**：Node 24 为了防御批处理注入，要求在 Windows 下调用 `.cmd` / `.bat` 时必须显式声明 `{ shell: true }`。
   - **解决方案**：在 spawn 选项中补齐 `shell: true`，或直接执行全局 `.js` 入口文件。

2. **ACP SDK 1.8.0 严格绑定 Web Streams API**
   - **障碍现象**：使用任务书指定的 SDK 路径引入 `ndJsonStream` 并传入 `cp.stdin` / `cp.stdout` 时，抛出 `TypeError: input.getReader is not a function`。
   - **根本原因**：`@agentclientprotocol/sdk` 的 `ndJsonStream` 仅接受标准 Web Streams（`ReadableStream` / `WritableStream`），而非 Node.js 原生 Stream。
   - **解决方案**：引入 `node:stream` 中的 `Readable.toWeb(cp.stdout)` 与 `Writable.toWeb(cp.stdin)` 进行桥接转换。

3. **`zcode-acp-server` 的入口文件与子命令陷阱**
   - **障碍现象**：直接运行 `node zcode-acp-server/dist/cli.js` 时，默认打开了终端 TUI（Martty TUI），导致管道挂起。
   - **根本原因**：该仓库统一了 TUI 与 ACP Server，若使用 node 直接拉起脚本，必须显式附加 `server` 子命令（`node dist/cli.js server`）。

4. **子进程环境变量覆盖导致 `spawn ENOENT`**
   - **障碍现象**：自定义 `env: { ...PROXY_ENV }` 时未完整合并 `process.env`，导致 Node 无法找到系统 `Path`，抛出 `spawn node ENOENT`。
   - **解决方案**：必须始终使用 `{ ...process.env, ...extraEnv }` 并优先使用 `process.execPath`。

5. **任务书规范与实际 SDK 协议的差异**
   - **任务书疑点**：任务书第 3.2 节列出的“关（close）”与“读历史（observe-history）”，在 ACP 协议 1.8.0 规范中并没有统一标准方法（SDK 未定义 `session/read`，`closeSession` 仅为客户端本地清除或报 Method not found）。这些能力是依赖 `acpx` 包装层实现的，在纯 L1a 协议层属于协议规范层面的空白。

---

## 四、对任务定义的反驳与建议

1. **反驳：L1a 的 `observe-history` 与 `close` 不能作为判断桥“坏了”的判据**
   - ACP 协议（截至 1.8.0）的核心定位是**“即时交互协议（Interactive Protocol）”**，其生命周期主要由客户端 UI 会话维持。历史回溯由客户端（如编辑器或 acpx）自行负责落盘存储。因此 L1a 报 `Method not found: session/read` 是符合 ACP 规范现状的，不应判为桥梁损坏，而应明确标记为“协议未涵盖”。
2. **建议：明确 `resume-native` 的真实业务边界**
   - 任务书要求的“续人在桌面端开的会话”，在 Electron 架构的客户端中，桌面 UI 与命令行/无头模式具有天然的数据沙箱隔离。建议区分“同入口续接”（CLI 续 CLI、桌面续桌面）与“跨入口接管”（通过注入 CDP/内存 Hook 接管桌面活跃窗口）。对于纯后端调用路线，强求无侵入接管桌面活动会话在工程上成本极高且容易踩中文件锁冲突。

---

## 五、结论与后续建议

- **生产调用推荐路径**：对于 ZCode，**L1b（`acpx zcode`）或在此之上的 L2（`agent_gateway.js`）是唯一在功能、稳定性、历史回溯与凭证安全上全面闭环的生产级调用路线**。
- **禁止单跑 L0 原生命令行**：L0 原生命令行缺少 Runtime Headers 解密响应支持，极易陷入 180s 握手超时。
- **黑板落盘确认**：已向 [`channels/probe/blackboard.jsonl`](file:///E:/program/GIT/Agent/multi/Agent-Architecture-Hub/channels/probe/blackboard.jsonl) 追加全部 51 条结构化测试记录，随时可供自动化看板与上层治理网关解析。
