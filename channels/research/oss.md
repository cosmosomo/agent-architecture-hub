# 开源工作台对照卷宗

> **议题**：别人的多智能体工作台做到了什么  
> **研究员**：Argon（Antigravity pro）· research-oss  
> **最近更新**：2026-10-19 21:30

---

## 关键信息

- **开源多智能体工作台桌面与界面驱动对照**：
  开源方案（如 OpenRig、Superset、Camofox）在处理本地 GUI 与桌面操作时，普遍避开脆弱易抢焦点的 OS 物理鼠标模拟，优先采用 CDP（Chrome DevTools Protocol）调试通道或远程无头浏览器协议；这与我们本轮在 ZCode（:9240）、Antigravity（:9234）、豆包（:9225）通过原生 WebSocket CDP 直连完成零抢占静默读取 DOM 与无头截屏（黑板 1977-1981）的工程实践完全吻合。
- **开源多智能体工作台样本集与版本**：
  - **OpenRig**（`mvschwarz/openrig`，v0.6.10 / commit `e8f0ab34`，本地镜像 `C:\Users\COLORFIRE\hub-workspaces\ref-openrig`）：7 层架构（L1-L7），以 Node.js + TypeScript + SQLite 为核心，解耦了席位（Seat）、占用者任期（Occupant Tenure）和原生会话（Native Session）三层模型。依据：看到，[agy-pro-openrig-source-20261018.md](../probe/results/agy-pro-openrig-source-20261018.md)、[openrig-matrix-20261018.md](../probe/results/openrig-matrix-20261018.md)。
  - **Superset**（`superset-sh/superset`，GitHub 15.3k stars，2026 智能体 IDE）：主打轻量 Git Worktree 任务级强隔离，并行调度 10~100+ 智能体，内置 Diff 审查与 In-app 浏览器，解决多智能体写代码的文件锁与冲突。依据：看到，GitHub topics 与官网公开资料。
  - **Orchestrator.inc / Agent-Orchestrator**（`OrchestratorInc/agent-orchestrator`，支持 25+ harnesses）：以任务看板与闭环反馈（Closed Feedback Loop）为核心，将 PR/CI/审查失败自动转化为结构化上下文倒流回负责该工作的智能体席位。依据：看到，GitHub 仓库公开文档。
  - **LangGraph / AutoGen Studio**：以图状态机持久化与人在环打断（Interrupt / Checkpoint Time-travel）为核心。依据：看到，官方架构文档。

- **开源多智能体工作台最近做到的 8 大核心突破**：
  1. **席位任期与代际编号锁（Occupant Tenure + Generation UUID Guard）**：席位是逻辑角色，占用者任期单调递增发放唯一代际 UUID。向底层发信的最后一毫秒做同步比对断言，代际不符立即抛出 `guard_target_changed` 拒发，彻底杜绝网关重启/换人/重试时的“幽灵投递（Ghost Delivery）”与串话。依据：看到，OpenRig 源码 `seat-delivery-guard.ts:73`、`060_occupant_tenures.ts:21`。
  2. **审批态 Fail-Closed 拒发与四态送达回执**：当智能体处于 `PendingApproval` 工具审批等待时，普通输入强制 Fail-Closed 拒绝（返回 `target_needs_input`），杜绝误把新消息当成审批确认回车执行高危命令；送达回执明确拆分为 `delivered`（确证送达）、`rendered-unconfirmed`（底层写入成功但未确认首包）、`staged-not-consumed`（仅草稿）、`retained`（打字保护或审批暂存）。依据：看到，OpenRig 源码 `seat-delivery-guard.ts:117`、`transport.ts:28`。
  3. **任务队列持久化与阻塞唤醒梯子（Durable Queue & Wake Ladder）**：SQLite `queue_items` 表携带 `blocked_on`（跨智能体工单依赖）、`minting_generation_uuid`、`claimed_by_generation_uuid`；三类唤醒：定时唤醒（timer）、超时反压（watchdog）、依赖解挂（auto-unpark）。被依赖的子工单标记 `done` 时事件驱动唤醒上游，彻底替代脆弱的内存 Map 轮询。依据：看到，OpenRig 源码 `queue-repository.ts:1505`、`073_queue_transition_wakes.ts:9`、`watchdog-jobs-repository.ts:171`。
  4. **诚实五分法恢复判定与回滚至 0 会话（Rollback to Zero Session）**：区分 `resumed`、`fresh-primed`、`awaiting-decision`、`attention_required`、`failed`；恢复原会话失败时，立即杀掉刚刚拉起的空进程，保留 0 会话向操作员大声报警，转入 `awaiting-decision`，绝不静默新建空白会话冒充恢复（拒绝假恢复）。依据：看到，OpenRig 源码 `restore-orchestrator.ts:191`。
  5. **智能体中枢 MCP 协作工具集（乙路）**：对外暴露 18 个 MCP 工具（`rig_up`, `rig_ps`, `rig_send`, `rig_chatroom_send`, `rig_add` 等），使智能体能够自主编排、查席位、跨会话发信、提交队列产物，补齐“智能体调用中枢操作团队”的协作通道。依据：看到，OpenRig 源码 `packages/cli/src/mcp-server.ts:59-431`。
  6. **工作区 Git Worktree 强隔离机制**：每个子任务/并行智能体分配独立的 Git worktree，环境与端口独立，杜绝文件改写覆盖、脏工作区与 `git index.lock` 冲突。依据：看到，Superset `setup.local.sh`。
  7. **督工待处理流（Attention Feed）与决策置顶**：5 类事件分类器映射（`action-required`, `approval`, `shipped`, `progress`, `observation`），零静默丢弃；审批与决策卡片置顶，支持卡片直接单键 APPROVE 乐观回执与快捷 CHAT 抽屉追问。依据：看到，OpenRig 源码 `Feed.tsx:60`、`feed-classifier.ts:10`。
  8. **闭环反馈驱动（Closed Feedback Loop）**：智能体交付物自动触发代码检查、CI 运行、测试结果比对；失败时自动打包错误日志作为工单回打给负责该任务的席位，实现自愈闭环。依据：看到，Orchestrator.inc 架构说明。

- **和我们的能力矩阵（109 项能力单元）与现状（CAPABILITY_MAP.md）对照与差距**：
  - **会话恢复与接管（`resume` / `resume-native`）**：我们的实测矩阵在黑板行 830、859 标 ◐，原生会话与 acpx 槽位混淆，点原生会话发消息退化为新建空槽；而开源用原生 session ID 比对 + 诚实五分法，找不到就回滚至 0 报警，不搞假续。
  - **打断与插话（`cancel` / `steer`）**：我们的 `steer` 在黑板行 858 标 ❌（只是排队条“插队”，非真正的交互插话）；开源做到带代际锁的最后一毫秒比对同步注入，且人类在打字时支持暂存信箱（held-messages）。
  - **权限与审批（`permission` / `permission-scope`）**：我们的 `permission` 在黑板行 840、856 标 ❌（默认被静默升级为 all，审批横幅不可达）；开源做到审批态 Fail-Closed 拒发，必须由人类通过一键 Approve 或策略显式授权。
  - **协同唤醒与队列（`act-deliver` / `act-yield` / `wake-bg` / `wake-timer` / `wake-persist`）**：我们的后端队列之前多为内存 Map，重启即丢；开源通过 SQLite 不可变台账持久化队列与唤醒表，支持 `blocked_on` 跨智能体依赖触发自动解挂唤醒。
  - **团队协同通道（`peer-message` / `task-board` / `handoff`）**：我们的智能体间通信多由中枢脚本单向调度（甲路）；开源通过面向智能体的 MCP 工具集（乙路）让智能体具备自主查看队友状态、点对点发信、认领释放工单的能力。
  - **网页督工台（`ui-attention-feed` / `ui-live-indicator` / `ui-project-tabs`）**：我们的 Web 界面停留在多聊天窗口与文件树；开源已实现统一待处理流、图文证据网格（Proof Lightbox）、断网诚实降级状态条和渐进式终端预览截流。

## 经验

- **试过**：剖析 OpenRig 架构发现，其底层运行时虽然依赖 Unix tmux（L1），但其**控制机制的灵魂全部在 L2 领域层状态机、L3 路由、L4 MCP 工具与 L7 网页工作台**。这些核心完全是平台无关的 TypeScript 与 SQLite 逻辑，可以 100% 移植到我们的 Windows 原生后端（acpx / Connect-RPC / app-server / agentapi）。
- **试过**：分析多智能体并发串话根因，确认简单的 `channel:sessionName` 槽位必出串话事故。当会话因为崩溃重启或超时换人时，异步定时器或排队消息若没有“代际 UUID 锁”，就会将发给前任的信息灌给继任者。代际锁是多智能体系统的“内存安全基石”。
- **试过**：分析假恢复危害，确认不能在会话恢复失败时“静默建空会话”。假恢复会骗过人类和上层编排，智能体带着空上下文去执行接力任务必然导致执行灾难。宁可杀掉空进程向操作员报警（回滚至 0 会话），也绝不假装接上。
- **踩坑提醒**：十几个智能体同时跑终端流时，若无节制建立实时 WebSocket 连接，会导致前端 DOM 节点爆炸、浏览器直接卡死。必须借鉴 OpenRig 的渐进式预览设计：默认读静态快照文本，点击才连实时，且强限并发数（8~12个）。
- **交互跃迁**：多智能体协作必须从“聊天窗口思维”跃迁到“督工看板 + 待处理流思维”。用户不需要同时陪 10 个智能体聊天，而是需要一个决策置顶的待处理流：谁在等审批、谁卡住了、谁已交付一目了然。

## 还没解决的

- **问题 1：Windows 原生中枢网关落地代际编号与送达防误投（Occupant Tenure + Generation Guard）**
  - 卡点：目前中枢网关 `gateway.ts` 仍在使用内存键管理槽位，缺乏代际持久化表与发信前最后一毫秒的代际比对断言。
  - 下一步：在 SQLite 增加 `occupant_tenures` 表，改造发送接口在写入字符前加入代际断言，防止串话与幽灵投递。
- **问题 2：智能体中枢 MCP 协作工具集（乙路）落地**
  - 卡点：目前智能体只能作为被调用者执行指令，无法直接调 MCP 接口查询中枢其它席位或把任务交接给另一席位。
  - 下一步：按 OpenRig `mcp-server.ts` 的规格，在中枢优先实现 5 个核心 MCP 工具（`hub_send`、`hub_ps`、`hub_queue_push`、`hub_queue_close`、`hub_chatroom_broadcast`），打通智能体自主协作闭环。
- **问题 3：Git Worktree 工作区任务级自动隔离机制**
  - 卡点：当前多智能体并发执行代码修改任务时，均工作在单一工作区目录下，存在严重的 git 索引竞争与文件覆盖风险。
  - 下一步：调研并实现类似 Superset 的工作区 worktree 自动初始化驱动（每个工单切独立分支与独立端口）。
- **问题 4：Web 工作台从聊天形态向“待处理流（Attention Feed）”重构**
  - 卡点：目前 `web-console` 和 `web-chat-drawer` 代码耦合较重，缺乏事件分类器逻辑。
  - 下一步：移植 OpenRig 的 5 类事件分类器，优先在 Web 端实现审批与待办卡片置顶的一键 APPROVE 乐观回执面板。

## 出处

- 仓库报告：[openrig-matrix-20261018.md](../probe/results/openrig-matrix-20261018.md)（OpenRig 109 项能力单元逐层代码穿透审查与前后端各 5 大借鉴）
- 仓库报告：[agy-pro-openrig-source-20261018.md](../probe/results/agy-pro-openrig-source-20261018.md)（OpenRig 源码四块核心控制机制剖析）
- 仓库全景：[CAPABILITY_MAP.md](../probe/CAPABILITY_MAP.md)（功能矩阵：每个单元在各家、各位置上的理论上限与现状）
- 仓库矩阵：[MATRIX.md](../probe/MATRIX.md)（实测矩阵：黑板 2709 条证据生成的各单元状态）
- 黑板实测证据行（2026-10-19 批次）：
  - **黑板 1977-1981 行**：三大 Electron 桌面端（ZCode/Antigravity/Doubao）CDP 直连静默读取 DOM 与无头截屏（对应开源无头 CDP 驱动模式）
- 能力真源：`E:\program\GIT\Jobs\08_简历设计工作区\02_项目打磨与展示\智能体技术\多智能体协作\能力单元登记表_20261017.md`（109 项能力单元登记表）
- 开源项目：[mvschwarz/openrig](https://github.com/mvschwarz/openrig)（v0.6.10，commit `e8f0ab34` / `3001cc43`，本地镜像 `C:\Users\COLORFIRE\hub-workspaces\ref-openrig`）
- 开源项目：[superset-sh/superset](https://github.com/superset-sh/superset)（Agentic IDE，Git worktree 强隔离并行编排）
- 开源项目：[OrchestratorInc/agent-orchestrator](https://github.com/OrchestratorInc/agent-orchestrator)（跨 25+ coding harnesses，看板监督与 CI/PR 闭环反馈）
- 开源项目：[LangGraph](https://github.com/langchain-ai/langgraph) 与 [AutoGen Studio](https://github.com/microsoft/autogen)（状态机图编排、人在环断点回溯）
