# OpenAI Codex (`0.159.2`) 渠道长期知识库总纲：核心基本能力抽象、信息源与认知评估

> **渠道标识**：`host.codex` ｜ **当前实测版本**：`codex-cli 0.159.2`（演进自 `0.118.0`） ｜ **最近实测核验**：`2026-10-14`
> **本目录定位**：Codex 宿主渠道在 `Agent-Architecture-Hub` 中的**长期维护知识库（唯一认知入口）**。
> **文档地图**：
> - **[README.md](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/channels/hosts/codex/README.md)（本文件）**：核心基本能力抽象（能力层 $\times$ 协作层映射）、信息源台账、基本使用逻辑、生态位、四大亮点与五大缺陷。
> - **[app-server.md](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/channels/hosts/codex/app-server.md)**：`codex app-server` 完整 JSON-RPC 2.0 协议、握手、170 个方法字典、逆向审批回调、83 种通知与常驻进程调用实战。
> - **[cli-commands.md](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/channels/hosts/codex/cli-commands.md)**：Codex CLI (`0.159.2`) 全 23 个子命令、152 个 Feature Flags、`exec`/`queue`/`agents`/`sandbox` 场景化用法与 `0.118.0 -> 0.159.2` 演进勘误。
> - **[config-and-pitfalls.md](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/channels/hosts/codex/config-and-pitfalls.md)**：`config.toml`、`hooks.json`、`AGENTS.md` 级联机制、ヘッドレス（Headless）环境隔离铁律与 `T-CDX-01..08` 实证故障台账。

---

## 一、两层认知框架与边界判据

依据 [基础能力推演_从基本能力到多智能体协作_20260929.md](file:///e:/program/GIT/Jobs/08_简历设计工作区/02_项目打磨与展示/智能体技术/多智能体协作/基础能力推演_从基本能力到多智能体协作_20260929.md) 与 [核心抽象_能力层与协作层_20261008.md](file:///e:/program/GIT/Jobs/08_简历设计工作区/02_项目打磨与展示/智能体技术/多智能体协作/核心抽象_能力层与协作层_20261008.md)，我们将智能体系统严格切分为两层：

1. **下层：能力层（基本能力——怎么驱动一个个体）**
   - **判据（知识什么时候过期？）**：只要在 Codex 升级版本（如 `0.118.0 -> 0.159.2`）、更换调用通道（`codex exec` vs `codex app-server` vs `codex queue`）、调整沙箱/钩子机制或切换上游网关（银子 `api.yinziapi.top` / 代理 `127.0.0.1:7892`）时才会过期的知识，全部属于**能力层**，沉淀在本目录中。
2. **上层：协作层（组织与调度——怎么让一群个体配合把事做成）**
   - 围绕 **信息（共识 / 私有 / 地图，渐进式披露）**、**个体（含个体嵌套子团队）**、**能力渠道（容量 / 限速 / 额度 / 状态位 / 专人维护）** 三个核心抽象，在每一步回答 **「下一个是谁？给他什么？停不停？」**，组合出 **接力、分发、汇总、往返、共享** 五种协作形状。

---

## 二、核心基本能力抽象（Codex 能力层完整映射）

### 2.1 两个核心对象：会话 (`Thread`) 与 轮 (`Turn`)

| 能力层抽象 | Codex 内部概念与持久化落点 | 热会话 vs 冷会话 / 轮内部结构 |
| :--- | :--- | :--- |
| **会话 (`Session` / `Thread`)** | - 唯一标识：`threadId`（UUID v7，如 `01a0f203-c4db-7d10-91a4-5aa2286239dc`）<br>- 轨迹文件：`~/.codex/sessions/YYYY/MM/DD/rollout-<timestamp>-<threadId>.jsonl`<br>- 状态索引：`~/.codex/state_5.sqlite`、`~/.codex/thread_history_1.sqlite` | - **热会话（热待命 `idle`）**：`codex app-server` 进程在内存中已加载该线程（可通过 `thread/loaded/list` 查到），或桌面端/TUI 仍持有单写者锁（活跃后保持约 7 分钟），发 `turn/start` 毫秒级响应。<br>- **冷会话（冷待命 `notLoaded`）**：进程已退出，只剩磁盘上的 `rollout-*.jsonl` 与 SQLite 记录；需先 `thread/resume` 或 `codex exec resume` 重新加载。 |
| **轮 (`Turn`)** | - 唯一标识：`turnId`（UUID）<br>- 生命周期：`turn/started` $\to$ 若干步（`item/started` / `item/completed`） $\to$ `turn/completed`<br>- 轮结束状态：`completed`（自然结束）、`interrupted`（被打断）、`failed`（出错可续） | 一轮内包含 **17 种定型步 (`ThreadItem`)**：<br>`userMessage`、`hookPrompt`、`reasoning`、`plan`、`commandExecution`、`fileChange`、`mcpToolCall`、`dynamicToolCall`、`collabAgentToolCall`、`subAgentActivity`、`webSearch`、`imageView`、`imageGeneration`、`sleep`、`enteredReviewMode`、`exitedReviewMode`、`agentMessage`、`contextCompaction`。 |

### 2.2 三种会话状态与待命双属性

在 `codex app-server` 的 `thread/status/changed` 通知与磁盘 `rollout-*.jsonl` 中，Codex 的会话状态精确对应能力层的三种状态：

```
                 开 (thread/start + turn/start 或 codex exec)
                         │
                         ▼
               ┌───────────────────┐
       ┌──────►│     执行中        │◄──────┐
       │       │  status: "active" │       │
       │       │  ├─ 工作中        │       │
       │       │  └─ 等回应*       │       │
       │       └─────────┬─────────┘       │
       │                 │                 │
  续 (turn/start         │ 轮结束          │ 回应 (回复 ServerRequest id)
   或 exec resume        │ (自然结束/打断/ │ 或 插话 (turn/steer)
   或 queue)             │  让出/出错)     │
       │                 ▼                 │
       │       ┌───────────────────┐       │
       └───────│      待命         │───────┘
               │  热: "idle"       │
               │  冷: "notLoaded"  │
               └─────────┬─────────┘
                         │ 关 (thread/archive | delete | close)
                         ▼
               ┌───────────────────┐
               │      关闭         │
               └───────────────────┘
```

- **执行中 (`status.type == "active"`)**：
  - **工作中**：`activeFlags == []`，正在流式推理或执行工具。
  - **等回应**：`activeFlags` 包含 `"waitingOnApproval"`（等待命令/补丁/权限审批）或 `"waitingOnUserInput"`（等待 `item/tool/requestUserInput` 回答）。
- **待命 (`status.type == "idle"` 热待命 / `"notLoaded"` 冷待命)**，必须同时记录两个属性：
  1. **怎么进来的**：`completed`（自然做完本轮）、`interrupted`（收到 `turn/interrupt` 被打断）、`Stop Hook / 乙路 yield`（主动让出）、`failed` / `"systemError"`（流断开或限流出错，会话仍在，可原位 `resume` 续跑）。
  2. **在等什么**：等下一轮任务输入、等审批决策、或等子智能体（`wait_agent`）完成。
- **关闭**：通过 `thread/archive`、`thread/delete` 或 `codex archive/delete` 归档/删除，不再续跑。

### 2.3 中心对个体的操作矩阵：「五必需 + 四可选 + 守卫」

Codex 提供三条驱动通道：**通道 A（`codex app-server` 热常驻，主通道）**、**通道 B（`codex exec` 单轮冷启动，备用隔离通道）**、**通道 C（`codex queue` 跨进程信箱，针对已被桌面/TUI 占锁的活跃会话）**。

| 类别 | 能力层原语 | 通道 A：`codex app-server` (热常驻 JSON-RPC) | 通道 B：`codex exec` (单轮冷进程 CLI) | 通道 C：`codex queue` + 磁盘直读 | 实测状态与工程边界 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **必需 1** | **开 (`Open`)** | `thread/start` + `turn/start`（支持 `ephemeral: true`） | `codex exec --json -m <model> -`（stdin 传 prompt） | — | ✅ 已验证（`0.159.2` 活体 RPC / CLI 实测） |
| **必需 2** | **续 (`Resume`)** | 已加载直接 `turn/start`；冷会话先 `thread/resume`（**必传完整绑定参数**）再 `turn/start` | `codex exec resume --json <sid> -` | `codex queue --thread <sid> -m <text>` | ✅ 已验证。若会话在桌面端打开（7 分钟写锁），`exec resume` 会报 `already has an active writer`，此时必须走 `codex queue`。 |
| **必需 3** | **观察 (`Observe`)** | 执行中听 `turn/*`、`item/*`、`thread/tokenUsage/updated` 通知；待命时调 `thread/read` + `thread/turns/list`（分页） | 执行中读 `--json` stdout 事件流；待命时按字节游标增量读 `rollout-*.jsonl` | 增量轮询 `rollout-*.jsonl` 中匹配的 `userMessage` $\to$ `task_complete` | ✅ 已验证（[`parse.ts:1-542`](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/trace/packages/adapters/src/codex/parse.ts#L1-L542)）。Codex 拥有六平台最丰富的本地 JSONL 遥测。 |
| **必需 4** | **打断 (`Interrupt`)** | `turn/interrupt`（`{threadId, turnId}`）——**只停当前轮，会话留在热待命** | 终止 `codex exec` 子进程树 | `codex agents` TUI 内 stop | ✅ 已验证。App-Server 的 `turn/interrupt` 是真正的无损轮级打断；而杀 `exec` 进程属于强行中断。 |
| **必需 5** | **关 (`Close`)** | `thread/unsubscribe` / `thread/archive` / `thread/delete`；关闭常驻池调 `process.terminate()` | 单轮进程随轮结束自然退出；归档用 `codex archive <sid>` | `codex archive <sid>` / `codex delete <sid>` | ✅ 已验证 |
| **可选 1** | **插话 (`Steer`)** | `turn/steer`（`{threadId, expectedTurnId, input}`）——**真·轮内实时插话**，不中断当前轮；另有 `thread/inject_items` | ❌ 不支持（单轮进程标准输入已关闭） | `codex queue`（排入下一轮，非轮内插话） | ✅ 已验证。`expectedTurnId` 防止插错轮次。 |
| **可选 2** | **回应 (`Respond`)** | 收到服务端带 `id` 的逆向请求 `item/*/requestApproval` 或 `item/tool/requestUserInput` 时，回传 `{"id": reqId, "result": ...}` | ❌ 不支持交互式回调（只能靠启动前 `-a never` 或 `--approve-for-me`） | — | ✅ 已验证 |
| **可选 3** | **分叉 (`Fork`)** | `thread/fork`（支持 `lastTurnId` / `beforeTurnId` 定点分叉）+ `turn/start`；另有 `thread/revert` 回滚 | `codex exec fork <sid> [PROMPT]`（或交互式 `codex fork`） | — | ✅ 已验证 |
| **可选 4** | **整理 (`Compact`)** | `thread/compact/start`（`{threadId}`），完成时触发 `thread/compacted` 通知与 `contextCompaction` 步 | 自动触发 `context_compacted`（配 `SessionStart` `compact` 钩子重注入工作包） | `codex migrate-rollouts`（迁移旧历史为分页存储） | ✅ 已验证 |
| **前置** | **守卫 (`Guards`)** | `thread/start` 传 `sandbox`、`approvalPolicy`、`approvalsReviewer: "guardian_subagent"` + `~/.codex/hooks.json`（`PreToolUse` / `Stop` 等 11 类事件） | `-s <mode> -a <policy>` + `hooks.json`（配 `[hooks.state]` SHA-256 信任哈希） | — | ✅ 已验证（`hooks.json` 在本机已挂载 `SessionStart`、`UserPromptSubmit`、`SubagentStart`、`Stop`） |

### 2.4 个体对中心的四个上行动作 × 甲乙两路

个体在跑的一轮中向中心表达结构化意图（**交付 `Deliver`、请求 `Request`、让出 `Yield`、上报 `Report`**），在 Codex 中同时支持两条路径：

1. **甲路（输出格式约定）**：
   - **原生 Schema 强约束**：`turn/start` 传入 `outputSchema: {...}` 或 `codex exec --output-schema <FILE> -o <OUT_FILE>`，由 OpenAI Responses API 强制模型最终一条 `agentMessage` 严格符合 JSON Schema。
   - **甲路防御技巧**：
     - 在火山方舟等兼容网关上，模型偶发将 JSON 写成 Python 字典字面量（单引号/`True`），中心解析层宜用 `json.loads` + `ast.literal_eval` 双解析兜底。
     - `codex exec -o <FILE>` 退出刷新时偶发漏掉末尾 1–4 个 `}`，中心读取时可做窄补齐校验。
2. **乙路（调用中心挂载的 MCP 工具）**：
   - 中心在 `thread/start` 的 `config`（或 `codex exec -c`）中动态挂载中心 MCP 服务，不污染全局 `config.toml`。
   - **乙路核心红线**：当会话设为免人工打扰（`approvalPolicy = "never"`）时，Codex 默认会**自动拒绝**所有需要审批的 MCP 工具调用！因此必须对中心 MCP 服务显式声明：
     `mcp_servers.<name>.default_tools_approval_mode = "approve"`（或 `"auto"`）。

### 2.5 最小组合积木：「做一轮 / 问答 (`ask`)」

能力层之上最核心的组合积木是 **`做一轮 / 问答 = 送进去（开/续/插话） + 等这一轮结束（观察状态） + 取出这一轮输出（观察内容）`**：
- **在 `codex app-server` 热常驻通道中**：发送 `turn/start` $\to$ 阻塞等待 `turn/completed` 通知（若超时则自动发 `turn/interrupt` 只停当前轮） $\to$ 从本轮收到的 `item/completed` 条目提取输出，并将 `thread/tokenUsage/updated` 的会话累计 `tokenUsage.total` 与上一轮累计相减，换算为本轮净增 Token（`input - cached`、`cached`、`output`）。
- **在 `codex exec` 单轮冷通道中**：记录运行前 `rollout-*.jsonl` 的文件字节大小 `cursor = stat.size` $\to$ 启动 `codex exec [resume] --json` 等待子进程结束 $\to$ 从字节偏移 `cursor` 起增量读取 `rollout-*.jsonl` 新增记录作为本轮输出。

---

## 三、基于认知框架的用法逻辑、生态位、亮点与缺陷评估

### 3.1 基本使用逻辑与生态位：「聪明但慢（引用核查 12/12 全真）」

在本机多宿主协作矩阵（`E:\program\sota\AGENTS.md:28-37`、`协作环境\INDEX.md:16-39`）中，Codex 的认知画像与生态位极其鲜明：

1. **生态位定性**：
   - 用户原话定性：**「会很慢；GPT 系列比较慢，但是比较聪明……如果要大量好 Token 的助力」**（`INDEX.md:34,165`）。
   - **实证支撑（第一轮 1,170 次运行 / 105 次成功运行审计，`调研评估与换模型_20261007.md:18-40`）**：
     - 产出 15 份视角主线、40 份子问题报告（730 KB，1,122 条独立引用）、128 份论文/仓库深析与 2,926 份原始证据文件。
     - **引用真实性 12/12（100% 全真，零幻觉）**：随机抽检跨度 1982–2026 年的 12 条文献与精确实验数字（如 Belkin 1982 ASK、arXiv:0906.4026 的 18% nDCG 增幅、DeepResearch Bench 等），标题、作者、DOI、正文数字全部真实存在。
     - **认知克制高分（4–5/5）**：只拿到摘要时严格标注「摘要级」，绝不脑补全文实验细节；拿到 MinerU 解析全文时精确引用章节号与页码。
2. **模型白名单铁律（仅允许 `gpt-6.1-sol` 与 `gpt-6-luna`，严禁 `gpt-5.6`）**：
   - **`gpt-6.1-sol`（主力重活）**：用于深度文献核验、复杂代码合成、架构审计及 AP-Vibe 全部 24 个执行位 + 5 个独立验收位（`C3`）+ `sota·A1` + `sota·S3`。
   - **`gpt-6-luna`（轻量机械/探针）**：用于中心默认轻量问答（`codex.py:15`）、沙箱权限矩阵冒烟探针与低成本结构化提取。
   - **严禁 `gpt-5.6` / `gpt-5.6-sol`**：旧 `2chat` 供应商卡片残留 `gpt-5.6` 配置，触发渠道红线阻断（`ccswitch.md:48,77`）。
3. **担任 `A1` 总调度时的认知纪律：「多委托、少通读」**：
   - 由于 Codex 有效上下文窗口较短、极易触发自动压缩（`context_compacted`），当 Codex 担任总调度（如 `sota·A1`）时，**严禁在主会话里通读大段长文或全量伙伴档案**；主会话只读增量心跳脚本（`sota_snapshot.py heartbeat`）与 1 页状态板，把深读、解析、核验全部委托给子执行位，并将核心状态外化到本地 Markdown 记忆文件（`AGENTS.md:30,66`）。

### 3.2 四大核心亮点（Highlights）

1. **亮点 1：原生个体嵌套与子团队原语 (`CollabAgentToolCall`) + 父子轨迹链条闭合**
   - 在能力层与协作层交界处，Codex 原生实现了「个体内部可是一个子团队（个体嵌套）」：内置 `spawn_agent`、`send_input`、`wait`/`wait_agent`、`followup_task`、`interrupt_agent`、`close_agent`、`resume_agent` 等 10 个子智能体工具（[`parse.ts:47,219-235`](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/trace/packages/adapters/src/codex/parse.ts#L47)）。
   - 父会话 JSONL 记录 `receiver_agents: [{ thread_id, agent_nickname }]`，子会话 JSONL 首行 `session_meta` 记录 `parent_thread_id` 与 `source.subagent.thread_spawn.parent_thread_id`（[`parse.ts:469-476`](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/trace/packages/adapters/src/codex/parse.ts#L469-L476)），使 `Agent-Architecture-Hub` 能够 100% 还原多波次子智能体派生树（本机已捕获 25 次 `spawn_agent`、40 次 `wait`）。
2. **亮点 2：`codex app-server` 常驻双向 JSON-RPC 2.0 控制面**
   - 一个常驻进程可同时托管多个会话（`Thread`），原生支持**轮内实时插话 (`turn/steer`)**、**无损轮级打断 (`turn/interrupt`)**、**按轮动态覆写模型/推理强度/沙箱 (`turn/start`)**、**逆向审批与提问回调 (`ServerRequest`)** 以及 **`codex app-server generate-ts` / `generate-json-schema` 自省导出契约**。
3. **亮点 3：`0.159.2` 新增 `codex queue`、`hooks.json` 生命周期钩子与 `goals` 目标追踪**
   - `codex queue --thread <id> -m <msg>` 解决了活跃会话单写者锁冲突下的跨进程投递；
   - `~/.codex/hooks.json` 支持 11 类生命周期事件（本机已实战跑通 `SessionStart`、`UserPromptSubmit`、`SubagentStart`、`Stop` 四大钩子，其中 `Stop` 钩子可通过返回 `{"decision": "block", "reason": "..."}` 拦截未闭环停机并强制追加收尾轮次！）；
   - `thread/goal/{set,get,clear}` 原生支持长程目标与 Token 预算绑定。
4. **亮点 4：六平台中最丰富的本地 JSONL 遥测 (`rollout-*.jsonl`)**
   - 唯一在本地会话 JSONL 的每个 `token_count` 事件中内嵌实时速率限制窗口（`rate_limits.primary` 5 小时窗口与 `secondary` 7 天窗口的 `used_percent`、`resets_at`）的平台；同时完整记录 `reasoning` 摘要、命令退出码、文件修改完整 `unified_diff` 与 `turn_context` 快照。

### 3.3 五大实证缺陷与事故模式（Defects & Failure Modes）

| 编号 | 缺陷名称 | 实证规模与定量证据 | 根因定界与认知框架下的规避方案 |
| :--- | :--- | :--- | :--- |
| **D1** | **上下文窗口短、频繁触发 `context_compacted` 失忆与工具回包膨胀** | 本机 1,229 个会话共触发 **218 次 `context_compacted`**；`sota` 第一轮中 AP 工具回包占全部工具输出字符的 **46%**（`ap_vibe_agents` 单次 8 万字符），导致单次运行重复读文件 **中位数 26 次**（规则文件重读 10 次），`sota·A1` 单线程累计消耗 **$1.08\times 10^8$ Input Tokens**（`P15`）。 | **规避**：① 信息层严格实行「渐进式披露」（`AGENTS.md` 只放地图，状态外化到本地文件）；② 精简 MCP 工具返回体积；③ 利用 `0.159.2` `SessionStart`（`matcher: "compact"`）钩子在压缩后自动重注入精简工作包。 |
| **D2** | **上游银子网关并发流断开 (`stream disconnected before completion`)** | 第一轮 **63 次跑超 5 分钟后失败的长运行中，49 次（77.8%）死于流断开**，白费 **2,368 分钟（39.5 小时）**；`10-02` 网络抖动期间无退避重试产生 **826 次秒败运行**（`P13`）。 | **根因**：① 直连 `api.yinziapi.top` 在 7–8 并发流下必断（`X01`/`X15`）；② AP 曾将重试次数覆写为 0（`P20`）；③ 断流后丢弃旧线程重开新会话导致重读 26 次文件。<br>**规避**：强制走 `HTTP_PROXY=http://127.0.0.1:7892` + 恢复 `request_max_retries=4, stream_max_retries=5` + 断流后原位 `codex exec resume <sid>` 续跑。 |
| **D3** | **Windows 下 `apply_patch` 工具高频报错** | 第一轮 103 个轨迹文件中出现 **约 165 次 `apply_patch` 调用失败**（报「需要 UTF-8 参数」「末行必须是 End Patch」「找不到要改的行」）。 | **根因**：Windows CRLF 换行符与多行中文字符在补丁上下文匹配中极脆弱。<br>**规避**：触发 `patch_failure_loop`（连续 $\ge 2$ 次失败）时立即停止重试 `apply_patch`，改用桌面命令/脚本按 UTF-8 原子写入。 |
| **D4** | **托管沙箱与配置隔离静默陷阱 (`P02` / `P06` / `P21` / `code_mode`)** | - `P06`：`--approve-for-me` 静默将 `-c sandbox_mode="danger-full-access"` 降级为 `read-only` + Guardian 自动审核超时；<br>- `P02`：漏带 `--direct-delivery-project` 导致 12 个并发实例跑空心跳 0 产出；<br>- `P21`：`--ignore-user-config` 屏蔽 `~/.codex/skills/`；<br>- `code_mode=true` 在无桌面桥接的 `exec` 中隐藏全部 Shell 与 MCP 工具。 | **规避**：① Headless 自动化显式传 `-s workspace-write -c approval_policy="never"`，禁用 `--approve-for-me`；② 强制传 `-c features={...,code_mode=false}`；③ 在项目 `AGENTS.md` 写明常用 `SKILL.md` 的绝对路径。 |
| **D5** | **内置 `web_search` 空返回率高 & 长流程二次自检松懈** | - 32 次 `B2` 调研运行中内置 `web_search` 仅调用 53 次，**至少 6 个子问题（18.8%）返回全空**；<br>- 第一轮严格独立验收首轮通过率仅 **9/24（37.5%）**（漏填「原文未涉及」、文件数算错等收尾细节）。 | **规避**：① 搜索主力走 `rate_gate.py` 学术脚本 + `anysearch` Skill 兜底；② 利用 `Stop` 钩子（`task_client.py`）或独立 `C3` 验收位对交付物做确定性脚本核验。 |

---

## 四、权威信息源台账（Information Sources）

> **维护纪律**：环境类事实永远以本机活体命令（`codex --version`、`codex help <subcmd>`、`codex app-server generate-ts`）与实测证据为准；每次 Codex 升级后必须运行 Schema 导出并与本目录对拍。

### 4.1 官方文档与源码源
1. **OpenAI Codex 官方仓库 (`codex-rs`)**：`https://github.com/openai/codex`
   - App-Server 实现与协议说明：`codex-rs/app-server/README.md`、`codex-rs/app-server-protocol/`
   - Headless 执行器：`codex-rs/exec/`
   - 核心运行时（沙箱、钩子、Rollout、`AGENTS.md` 发现）：`codex-rs/core/`
2. **OpenAI 官方开发者文档**：
   - CLI 手册：`https://developers.openai.com/codex/cli`
   - App-Server 协议文档：`https://developers.openai.com/codex/app-server`
   - 高级配置 (`config.toml`)：`https://developers.openai.com/codex/config-advanced`
   - 生命周期钩子 (`hooks.json`)：`https://developers.openai.com/codex/hooks`

### 4.2 本机二进制自省与现役代码/实测证据源（`codex-cli 0.159.2`）
1. **二进制自省导出契约命令**（权威度最高，100% 反映当前安装版本）：
   ```powershell
   codex app-server generate-ts --experimental --out <DIR>
   codex app-server generate-json-schema --experimental --out <DIR>
   codex features list
   ```
2. **本机现役架构与工具库**：
   - **`Agent-Architecture-Hub` (`e:\program\GIT\Agent\multi\Agent-Architecture-Hub`)**：
     - [`trace/packages/adapters/src/codex/parse.ts:1-542`](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/trace/packages/adapters/src/codex/parse.ts#L1-L542)：`codex/envelope` 与 `codex/legacy` 本地会话解析器及 4 层能力契约。
     - [`hub/js/sources/from-trace.js:112-196`](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/hub/js/sources/from-trace.js#L112-L196)：多波次 `spawn_agent` 子智能体树与协作事件还原。
   - **`codex-collab` (`C:\Users\COLORFIRE\.cc-switch\skills\codex-collab\scripts\codex-collab:1-5630`)**：
     - 共享 `app-server` 守护进程控制套接字（`app-server-control.sock`）、SQLite 启动文件锁与 `thread/goal/*` 调用实现。
   - **`opencli-poweruser` (`E:\program\GIT\media\opencli-poweruser`)**：
     - 渠道研发、探活阶梯与按需维护方法论基准（[channel-maintenance.md](file:///E:/program/GIT/media/opencli-poweruser/references/channel-maintenance.md)、[channel-probing.md](file:///E:/program/GIT/media/opencli-poweruser/references/channel-probing.md)）。
3. **本机理论与实证复盘档案**：
   - [基础能力推演_从基本能力到多智能体协作_20260929.md](file:///e:/program/GIT/Jobs/08_简历设计工作区/02_项目打磨与展示/智能体技术/多智能体协作/基础能力推演_从基本能力到多智能体协作_20260929.md)
   - [核心抽象_能力层与协作层_20261008.md](file:///e:/program/GIT/Jobs/08_简历设计工作区/02_项目打磨与展示/智能体技术/多智能体协作/核心抽象_能力层与协作层_20261008.md)
   - [能力核对_六平台与MCP渠道_v2.0_20261014.md](file:///E:/program/GIT/Jobs/08_简历设计工作区/02_项目打磨与展示/智能体技术/多智能体协作/能力核对_六平台与MCP渠道_v2.0_20261014.md)
   - [调研评估与换模型_20261007.md](file:///E:/program/sota/协作环境/调研评估与换模型_20261007.md)
   - [AP-Vibe底层问题记录.md](file:///E:/program/sota/协作环境/AP-Vibe底层问题记录.md)
   - [2026-10-02_模型上游与托管沙箱.md](file:///E:/program/sota/协作环境/实测记录/2026-10-02_模型上游与托管沙箱.md)
