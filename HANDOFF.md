# Agent-Architecture-Hub 交接与认知锚点文档 (HANDOFF.md)

> **2026-10-18 认知同步声明**：
> 本文档最初作为交接索引发起本轮系统性探针摸底与架构纠偏；经 2026-10-17 至 2026-10-18 多智能体全量实测（`channels/probe/blackboard.jsonl` 1,559 条记录）、119 项能力单元登记、根因审计（`R1–R8`）与 `P0` / 手机督工台（`/m/` v2）落地后，**[`channels/README.md`](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/channels/README.md) 已成为任何接手智能体的第一认知总入口**。本文档已与 2026-10-18 最新架构事实、术语铁律及 `P3` 演进路线完全对齐。

---

## 一、 用户原始需求原话（逐字保留）

> **核心交接诉求（原话 1）**：
> 「我想把这个工作台做一个 Handoff 文档。我觉得你现在的页面设计，包括很多按键的冗余程度，以及后端真实能做到那个能力的范围，其实你没有做得很好。因为其实现在后端也有很多能力，我感觉你也是没有充分考虑如何把后端与前端进行衔接，以及后端的 ACP 协议很多东西没有进行检查。
>
> 我觉得你得做一个 Handoff 文档，然后我会用更聪明的智能体去仔细研究一下我们现在这个系统到底好不好，差在哪里。我觉得现在前端的页面设计得非常拥挤，而且很多有幻觉的设计方案，就是有些东西不一定能打通闭环，但是他还是做上去了，只是通过想象觉得这样做会好，而且其实这么做也并不好，而且开源项目的精髓没有完全借鉴。
>
> 我打算让你做一个 Handoff 文档，里面索引我们做的项目的主要文件以及参考的文档，以及参考的开源项目的链接，这些都很重要。然后一定要保证上下文更加精简一点吧，就是最核心的和没那么核心的要分层次去列举依据，然后让那个聪明的智能体可以只看需要看的东西。
>
> 差不多就这样，给我做一个 Handoff 文档，或者说在我们之前那些设计文档里面把它改造成 Handoff 的职能，你认真思考一下这个需求。然后有一个关键区分点，就是不同的平台的agent之间也是不等价的，比如codex原生对话（人打开的页面），以及subagent和app-server的不一定等价，功能也不同，也需要细致区分。然后就是渠道能不能切换模型之类的能力矩阵，也是值得研究的东西，这些在我们的系统都不够确定，不够低熵。然后我指的范围主要是页面的对话模块，从对话到后台agentsession识别，状态识别，到acp协议，就是控制台到不同agent生态的完整系统。」

> **双模式定位背景（原话 2）**：
> 「后续计划，控制端也就是控制台，可以低负担使用，性能流畅。所以可能要和主页面解耦做性能优化以及只保留必要的负载（比如说不加载复杂协作流程图渲染和可视化什么的）……总之是两个模式，其中之一是我们的 hub，需要复杂协作的时候用，现在第二个模式就是，接入借壳上市然后做个简单的页面改造美化就行，主要是得看不出来是原项目，然后【优点在前端：它们本身就是纯粹的控制台页面，不带架构拓扑图、不带星空和仿真引擎，所以极其轻快。短板在后端底座：它们的后端只支持标准 Linux/macOS 下的原生 acpx 或单一 claude/codex CLI，完全跑不通你这台 Windows 上的 7 大主力渠道与特色机制】是傲慢的，我们可能还有 bug，人家也可能比我们成熟得多，只是渠道不完全覆盖针对我们的渠道而已。」

---

## 二、 四段链路与三类数据分离（2026-10-18 最新架构认知）

### 1. 端到端四段链路（严禁使用无修饰的“层/适配器/恢复”）
```
前端（/m/ 手机督工台 v2、/console/ 桌面控制台、/ 主工作台聊天抽屉）
  ↓ HTTP REST (/api/sessions, /api/capabilities, /api/search, /api/gateway/*) + SSE (/api/events)
后端（trace/apps/cli/src/server.ts + gateway.ts + store.ts + search.ts，常驻 :8899）
  ↓ 进程内嵌入 acpx/runtime（P3 目标）+ 原生驱动（agent-hub codex_app/claude_app/AGY RPC，P3b 目标）
各家智能体入口（原生 GUI/TUI、原生持久化服务 app-server/Connect-RPC、各家 ACP 桥、CLI 单轮、子智能体）
  ↓ 环境变量 / 配置文件 / cc-switch 路由
底层能力渠道（OpenAI 兼容网关、Anthropic 兼容网关、智谱 Coding Plan、自定义中转站等）
```

### 2. 三类数据严格分离（见 [`channels/README.md`](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/channels/README.md) §二）
1. **定义（人工维护，定义“是什么”）**：
   - [`channels/README.md`](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/channels/README.md)：跨智能体调用认知总入口（含 14 道自检题、协作拓扑、9 类入口形态、所有权五态、渠道配置铁律）。
   - [`能力单元登记表_20261017.md`](file:///E:/program/GIT/Jobs/08_简历设计工作区/02_项目打磨与展示/智能体技术/多智能体协作/能力单元登记表_20261017.md) $\to$ [`hub/data/capability-units.json`](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/hub/data/capability-units.json)：**119 个能力单元唯一真源**（操作、动作、状态、待命与唤醒、配置、渠道、宿主、人机交互）。
   - [`hub/data/integration-map.json`](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/hub/data/integration-map.json)：我们前后端对 119 个能力单元的真实接入状态（`real` / `partial` / `fake` / `todo`），通过 `GET /api/capabilities` 暴露给前端做条件渲染。
2. **事实（探针只追加写入，记录“测出来是什么”）**：
   - [`channels/probe/blackboard.jsonl`](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/channels/probe/blackboard.jsonl)（1,559 行实测记录，每条含执行命令与原始输出证据）。
3. **分析（脚本从事实+定义自动生成，严禁手改）**：
   - [`channels/probe/CAPABILITY_MAP.md`](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/channels/probe/CAPABILITY_MAP.md)：按能力单元组织的跨平台/跨入口真值表 + 我们前后端的落差对照。
   - [`channels/probe/COVERAGE.md`](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/channels/probe/COVERAGE.md)：9 家智能体 $\times$ 各入口形态 $\times$ 50 核心能力单元的探测覆盖率。
   - [`channels/probe/MATRIX.md`](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/channels/probe/MATRIX.md)：探针汇总矩阵。

---

## 三、 分层索引（按 P0 $\to$ P1 $\to$ P2 精简上下文）

### 1. 【P0 必读核心层】第一优先级（读完即可建立完整最新认知）

| 序号 | 文件路径 | 核心内容 |
| :--- | :--- | :--- |
| **1** | [`channels/README.md`](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/channels/README.md) (`L1-L511`) | **第一总入口**：14 道认知自检题、协作拓扑、9 类入口形态、所有权五态、渠道与默认模型铁律、状态判定与唤醒归属。 |
| **2** | [`channels/EVALUATION_20261017.md`](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/channels/EVALUATION_20261017.md) (`L1-L439`) | **全面体检报告**：8 大根因（`R1–R8`）、桌面端 76 个控件真伪盘点（34% 假闭环）、`P0` + `P0-tail` 已落地修复、`P0–P5` 演进路线。 |
| **3** | [`channels/P3_任务定义_20261018.md`](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/channels/P3_任务定义_20261018.md) (`L1-L98`) | **当前下一阶段主任务（P3）**：用进程内嵌入 `acpx/runtime` 替代 `gateway.ts` 每次 `spawn('acpx', ...)`，并规划 `P3b` 移植 `agent-hub` 原生驱动。 |
| **4** | [`能力单元登记表_20261017.md`](file:///E:/program/GIT/Jobs/08_简历设计工作区/02_项目打磨与展示/智能体技术/多智能体协作/能力单元登记表_20261017.md) (`L1-L214`)<br>[`能力单元与协作拓扑_完整性检查_20261018.md`](file:///E:/program/GIT/Jobs/08_简历设计工作区/02_项目打磨与展示/智能体技术/多智能体协作/能力单元与协作拓扑_完整性检查_20261018.md) (`L1-L377`) | **理论上限 vs 事实边界**：119 个能力单元定义、注入五级降级链（`steer > Hook > inject-next > inject-tool > inject-inbox`）、子智能体三分法、上下文传递五模式。 |
| **5** | [`channels/probe/CAPABILITY_MAP.md`](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/channels/probe/CAPABILITY_MAP.md) (`L1-L522`) | **低熵能力地图**：每个能力单元在 9 家智能体各入口上的真实支持情况，以及与我们前后端接入状态的逐项对比。 |
| **6** | [`m/index.html`](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/m/index.html) (`L1-L632`)<br>[`trace/apps/cli/src/server.ts`](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/trace/apps/cli/src/server.ts)<br>[`trace/apps/cli/src/gateway.ts`](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/trace/apps/cli/src/gateway.ts) | **前后端核心实现**：已重写上线的手机督工台 `/m/` v2（含待处理流、项目分组、完整步骤折叠、全文搜索、基于 `/api/capabilities` 的条件渲染）及已完成 `P0` 修复的后端服务。 |

### 2. 【P1 专项深潜层】第二优先级（按专题查阅）

| 专项主题 | 文件路径 | 说明 |
| :--- | :--- | :--- |
| **设计工作区顶层文档** | [`核心设计总览_20261016.md`](file:///E:/program/GIT/Jobs/08_简历设计工作区/02_项目打磨与展示/智能体技术/多智能体协作/核心设计总览_20261016.md)<br>[`基础能力推演_从基本能力到多智能体协作_20260929.md`](file:///E:/program/GIT/Jobs/08_简历设计工作区/02_项目打磨与展示/智能体技术/多智能体协作/基础能力推演_从基本能力到多智能体协作_20260929.md)<br>[`核心抽象_能力层与协作层_20261008.md`](file:///E:/program/GIT/Jobs/08_简历设计工作区/02_项目打磨与展示/智能体技术/多智能体协作/核心抽象_能力层与协作层_20261008.md)<br>[`术语表.md`](file:///E:/program/GIT/Jobs/08_简历设计工作区/02_项目打磨与展示/智能体技术/多智能体协作/术语表.md) | 架构设计第一性原理：控制链是可选增强而非前提、文件是唯一真相、三级集成阶梯、严格命名规范。 |
| **外部标杆对照（OpenRig & 4 大桌面端）** | [`外部对照_OpenRig_评估与借鉴_20261018.md`](file:///E:/program/GIT/Jobs/08_简历设计工作区/02_项目打磨与展示/智能体技术/多智能体协作/外部对照_OpenRig_评估与借鉴_20261018.md)<br>[`channels/probe/results/openrig-matrix-20261018.md`](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/channels/probe/results/openrig-matrix-20261018.md)<br>[`channels/probe/results/hci-desktop-facts-20261018.md`](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/channels/probe/results/hci-desktop-facts-20261018.md) | OpenRig 的席位代际锁（`Seat → Occupant Tenure`）、五态诚实恢复、四态投递回执、待处理流（Attention Feed），以及 Codex/AGY/ZCode/WorkBuddy 四个桌面端的 SQLite 真相。 |
| **各家宿主实测手册** | [`channels/hosts/codex/README.md`](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/channels/hosts/codex/README.md) 及同目录 4 篇专卷<br>[`channels/hosts/claude-code.md`](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/channels/hosts/claude-code.md)<br>[`channels/hosts/zcode.md`](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/channels/hosts/zcode.md)<br>[`channels/hosts/workbuddy.md`](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/channels/hosts/workbuddy.md)<br>[`channels/hosts/antigravity.md`](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/channels/hosts/antigravity.md)<br>[`channels/hosts/opencode.md`](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/channels/hosts/opencode.md) | 各平台命令行、原生持久化服务、ACP 桥、会话存储与踩坑细节。 |
| **探针专题实测报告** | [`channels/probe/results/`](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/channels/probe/results/) 下 20+ 份报告（含 `agy-pro-subagent-entries-20261018.md`、`agy-connectrpc-methods-20261017.md`、`codex-queue-7min-lock-20261017.md` 等） | 针对子智能体入口、Connect-RPC 102 个方法、Codex 7 分钟锁与 `codex queue`、ZCode 幽灵模型的实证报告。 |

### 3. 【P2 本机开源与参考底座源码】（修正版真实路径）

| 参考项目 | 本机真实路径 | 核心借鉴价值 |
| :--- | :--- | :--- |
| **1. `openclaw/acpx`** (`v0.5.3`) | `C:\Users\COLORFIRE\AppData\Roaming\npm\node_modules\acpx\dist\`<br>• `runtime.js` (`createAcpRuntime`)<br>• `session-runtime.js`<br>• `acp-client.js`<br>• `queue-ipc.js` | **ACP Runtime 内嵌核心**：`acpx/runtime` 导出 `ensureSession`、`startTurn`/`runTurn`、`cancel`、`close`、`setModel`、`setMode` 及中途 `onPermissionRequest` 回调。 |
| **2. `xacpx`** | `C:\Users\COLORFIRE\.gemini\antigravity\brain\8d0cc8e7-6589-4b6b-973d-9481b5502d96\scratch\oss-consoles\xacpx\`<br>• `src/bridge/engine/runtime-adapter.ts`<br>• `src/bridge/engine/runtime-capability.ts`<br>• `src/bridge/engine/runtime-queue.ts`<br>• `src/bridge/engine/runtime-permission.ts`<br>• `src/bridge/later-command.ts` | **进程内嵌入 `acpx/runtime` 的标准范式**（注：此前旧版文档误写为不存在的 `session-tail-cache.ts`/`src/acp-client.ts`，已勘误）：展示如何用 `runtime-adapter.ts` 嵌入 `acpx/runtime`、用 `runtime-permission.ts` 做中途挂起审批、用 `later-command.ts` 做持久唤醒队列。 |
| **3. `agent-hub` (`ap-vibe`)** | `E:\program\GIT\Agent\agent-hub\src\agent_hub\`<br>• `codex_app.py`<br>• `claude_app.py`<br>• `agy.py`<br>• `wake.py` | **本机最成熟的原生协议驱动底座**：已跑通 `codex app-server`（含 `turn/steer`、`turn/interrupt`、`thread/resume`、`thread/fork`）、Claude `stream-json` 常驻进程、AGY Connect-RPC 与宿主级 `wake.py` 唤醒引擎（`P3b` 直接移植源）。 |
| **4. `openrig`** | `E:\program\GIT\Agent\openrig\`<br>• `packages/daemon/src/`<br>• `packages/ui/src/` | **席位代际模型与多智能体督工 UI 标杆**：`Occupant Tenure` 代际锁、五态诚实恢复、四态投递回执（含人类打字保护）、`Attention Feed` 待处理流。 |
