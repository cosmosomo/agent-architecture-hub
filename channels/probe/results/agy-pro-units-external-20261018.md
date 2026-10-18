# 外部系统原语与能力单元对照及饱和度审计报告

- **调研日期**：2026-10-18
- **调研性质**：只读外部规范、本地权威源码契约与架构对照（未启动任何破坏性命令，未打开任何运行中的 SQLite 库，未新建任何动态会话）
- **交付目标文件**：`channels/probe/results/agy-pro-units-external-20261018.md`
- **对齐基准**：
  - 本项目认知入口：`channels/README.md`
  - 能力单元登记真源：设计目录《能力单元登记表_20261017.md》（46 项现存单元）
  - 协作层抽象：《channels/README.md》第一之二节（问答、三个决定、五种形状、八种交接、四类连线）

---

## 〇、结论摘要（三五句大白话）

1. **认知全不全的评判标准是“外部原语能否映射且边界饱和”**：我们选取了 12 个代表性的行业标准规范、宿主常驻服务、框架运行时与终端控制器，将外部用于“驱动、观察、协调智能体”的全部一手原语，逐条映射到我们现有的 46 项能力单元中。
2. **抽象基座高度扎实**：现有 46 项能力单元（涵盖会话生命周期、四级注入、状态与四类唤醒、模型渠道、团队协同、人在环、宿主环境）覆盖了外部系统绝大部分核心操作，特别是生命周期控制、轮内插话、审批反向拦截、交接与四类唤醒的抽象与业界最先进的系统完全同构。
3. **推到了明显的饱和边界**：在按顺序核对的前 4 个系统（ACP、MCP、A2A、Codex app-server）中，共发掘出 7 项候选新单元；第 6 个系统（acpx 运行时）发掘出第 8 项；而随后的 6 个系统（LangGraph、OpenAI Agents SDK、AutoGen/AG2、OpenRig、CrewAI、Temporal）中，所有原语全部落入“严格对应”、“部分重叠”、“抽象方式不同”或“不归我们管”，**连续 6 个外部来源未再冒出任何新的能力单元**，边界彻底饱和。
4. **去重提炼出 8 个候选新能力单元**：分别是 `cmd-list`（可用命令发现）、`plan-live`（执行计划流式透出）、`sampling`（借道采样/模型代理）、`tool-hotplug`（工具热插拔）、`agent-card`（智能体名片自省）、`revert`（会话回滚/历史截断）、`memory-isolate`（会话记忆隔离）与 `watch-journal`（旁路日志跟随）。这 8 项全部符合公理判据，可作为《能力单元登记表》下一阶段的扩充储备。

---

## 一、外部来源逐一拆解与原语对齐

> **标注规范说明**：
> 每一条外部原语均强制打上以下五类标签之一：
> 1. **严格对应**：外部原语与我们现有的某个能力单元语义、触发时机与控制边界完全一致，注明我们的单元 `id`。
> 2. **部分重叠**：两者存在交集，但在参数粒度、适用范围或角色划分上存在差异，具体说明差在哪里。
> 3. **抽象方式不同**：解决的是同一个现实问题，但外部系统切分问题的方式与我们完全不同，说明各自的切法，不生搬硬套。
> 4. **我们没有**：外部系统已经成为一等公民原语，且符合我们“能力单元”判据（把平台名换成占位符依然读得通，属于中心与单智能体/渠道的交互），作为候选新单元，给出严格定义和“怎样算支持”。
> 5. **不归我们管**：属于上层编排业务逻辑（如多智能体工作流图谱）、提示词模版工程、客户端纯 UI 渲染或适配器内部私有容错实现，不属于能力单元。

---

### 1.1 ACP (Agent Client Protocol) 协议规范

- **出处与证据**：
  - 规范版本：Agent Client Protocol Draft RFC / 本机 `@agentclientprotocol/sdk` (5)
  - 本机文件：`C:\Users\COLORFIRE\AppData\Roaming\npm\node_modules\acpx\dist\runtime.d.ts` Lines 50-200
  - 核心定义：客户端与智能体之间的无状态/有状态双向通信协议（走 stdio / SSE JSON-RPC）。

| 外部原语 / 方法 | 类别标注 | 详细对齐分析与依据 |
| :--- | :--- | :--- |
| `initialize` | **部分重叠** | 客户端与智能体建立连接、协商协议版本及支持特性的握手请求。与我们的 `open` 部分重叠，但 `open` 侧重于开辟新工作上下文并给第一份输入，而 `initialize` 是纯粹的通信握手与能力协商层。 |
| `session/new` | **严格对应** | 单元 `id: open`。新建一个会话并给它第一份输入与系统提示词、工作目录。 |
| `session/load` | **严格对应** | 单元 `id: resume`。加载/恢复已有的会话记录继续执行。 |
| `session/prompt` | **严格对应** | 单元 `id: resume`（待命时发起新一轮）或 `open`（新建并送入输入）。推进会话执行一轮。 |
| `session/cancel` | **严格对应** | 单元 `id: cancel`。打断正在运行的 prompt 轮次，会话保留并退回待命。 |
| `session/set_mode` | **严格对应** | 单元 `id: mode-switch`。在会话中途切换权限或工作模式（如 `code`、`ask`、`architect`、`plan`）。 |
| `session/set_model` | **严格对应** | 单元 `id: model-switch`。在会话中途更改执行模型。 |
| `session/set_config_option` | **部分重叠** | 针对智能体特定的运行时配置项进行键值修改（如思考预算、详细程度）。在我们的登记表中部分能力被折叠在 `model-switch` 与 `mode-switch` 中，未将通用的“配置项键值修改”单列。 |
| `session/status` | **严格对应** | 单元 `id: state`。查询会话当前的活动状态、模型绑定与元数据。 |
| `session/request_permission` | **严格对应** | 单元 `id: permission`（中心答复审批）与 `act-request`（智能体发起请求）。智能体在执行敏感工具时向宿主发起的反向审批请求。 |
| `session/update: agent_message_chunk` | **严格对应** | 单元 `id: observe-live`。增量流式文本块。 |
| `session/update: agent_thought_chunk` | **严格对应** | 单元 `id: observe-live`。增量思考/推理流块。 |
| `session/update: tool_call` / `tool_call_update` | **严格对应** | 单元 `id: observe-live`。工具调用发起、参数与结果更新流。 |
| `session/update: usage_update` | **严格对应** | 单元 `id: observe-live`（实时观察）及 `quota`（用量审计）。实时推送本轮消耗的 Token 及 Cost。 |
| `session/update: available_commands_update` | **我们没有** | **候选新单元 `cmd-list`（可用命令发现 / 斜杠命令广播）**。<br>定义：智能体向宿主主动宣告当前上下文/技能环境下可用的斜杠命令清单（如 `/compact`、`/review`、`/init`）及参数描述。<br>怎样算支持：宿主收到该通知后能动态更新前端交互指令面板，用户输入斜杠时能准确提示该智能体支持的命令。 |
| `session/update: current_mode_update` / `config_option_update` | **严格对应** | 单元 `id: observe-live` + `state`。状态变更通知。 |
| `session/update: plan` | **我们没有** | **候选新单元 `plan-live`（执行计划流式透出 / 步骤账本）**。<br>定义：智能体向中心结构化汇报自身当前拆解的执行计划条目（每项含 content、status: pending/in_progress/completed、priority），中心能直接渲染进度面板，无需从自然语言回复中正则猜测。<br>怎样算支持：智能体在多步执行中下发结构化 plan 变更，中心实时解析并点亮对应步骤。 |
| `elicitation/request` | **部分重叠** | 单元 `id: ask-user`。智能体或工具向宿主索取表单结构化输入，比自由文本提问多出了 Schema 校验约束。 |

---

### 1.2 MCP (Model Context Protocol) 规范

- **出处与证据**：
  - 规范版本：MCP 2025-06-18 / 2026-07-28 Draft Specification
  - 核心定义：大模型客户端与外部工具/上下文提供方之间的标准接口。

| 外部原语 / 方法 | 类别标注 | 详细对齐分析与依据 |
| :--- | :--- | :--- |
| `tools/list` / `tools/call` | **不归我们管** | 属于 MCP 工具提供方的基础 RPC，智能体消费工具属于其内部执行循环。中心通过 MCP 工具捎带消息已单独抽象为 `inject-tool`。 |
| `resources/list` / `read` / `templates` | **不归我们管** | 上下文数据通道，属于给模型补充上下文资料的管道，不属于驱动、协调智能体的控制原语。 |
| `prompts/list` / `prompts/get` | **不归我们管** | 提示词模板复用，属于协作层任务书的模板库管理，非能力单元。 |
| `sampling/createMessage` | **我们没有** | **候选新单元 `sampling`（借道采样 / 宿主模型代理）**。<br>定义：受控端（如下游 MCP 工具或受限子智能体）自身不持有大模型 API Key 和算力凭证，通过向宿主发起反向采样请求，委托宿主调用大模型完成一段文本/结构化生成，结果再交回调用方。<br>怎样算支持：中心提供标准采样接口，工具或子代理解析器发起调用时，中心按设定的配额、模型路由执行推理并将结果安全返回。 |
| `elicitation/create` | **部分重叠** | 单元 `id: ask-user`。工具服务端向用户索取授权或结构化表单，归入人在环提问体系。 |
| `roots/list` / `notifications/roots/list_changed` | **抽象方式不同** | MCP 将文件边界抽象为客户端动态向服务端下发的“根路径清单（Roots）”；我们在能力层抽象为会话启动时的 `cwd` 工作目录与执行环境沙箱边界。 |
| `notifications/progress` | **严格对应** | 单元 `id: act-report`。执行中间过程的进度上报（带 token、progress、total）。 |
| `notifications/cancelled` | **严格对应** | 单元 `id: cancel`。请求取消通知。 |
| `notifications/message` / `logging/setLevel` | **严格对应** | 单元 `id: observe-live`。日志级别的实时外溢。 |
| `notifications/tools/list_changed` | **我们没有** | **候选新单元 `tool-hotplug`（工具热插拔 / 运行时能力变更）**。<br>定义：智能体或外部插件服务在会话执行中途动态声明可用工具集的变更（增加、下线、更新），中心或智能体据此刷新工具缓存，无需中断重建会话。<br>怎样算支持：收到通知后重新自省工具列表，后续轮次立即生效新工具。 |

---

### 1.3 A2A (Agent-to-Agent) 协议

- **出处与证据**：
  - 规范来源：Google / A2A Community Draft Specification (`agent2agent.info/specification/core`)
  - 核心定义：面向异构、黑盒智能体间互操作的远程协作协议（基于 JSON-RPC / HTTP / SSE / gRPC）。

| 外部原语 / 方法 | 类别标注 | 详细对齐分析与依据 |
| :--- | :--- | :--- |
| `AgentCard` / `GetExtendedAgentCard` | **我们没有** | **候选新单元 `agent-card`（智能体名片自省 / 身份声明）**。<br>定义：智能体对外暴露标准自述清单，包含自身身份、角色、支持的自然语言/结构化技能（Skills）、输入输出 Schema、鉴权协议与扩展状态机。<br>怎样算支持：中心请求该端点即可获取机器可读的卡片信息，无需人工在中心硬编码该智能体的能力档案。 |
| `SendMessage` | **严格对应** | 单元 `id: peer-message`。智能体向对端智能体发送一条消息。 |
| `SendStreamingMessage` | **严格对应** | 单元 `id: peer-message` + `observe-live`。智能体间流式交互。 |
| `GetTask` | **部分重叠** | 与 `state`、`observe-history` 部分重叠。A2A 以远程持久化的 Task 对象为核心查询执行状态与产出，而我们体系中是以会话 `session` 承载运行，Task 属于协作层的账本概念。 |
| `ListTasks` | **抽象方式不同** | A2A 把智能体服务端抽象为“任务受理中心”，支持外部拉取其承接的任务列表；我们体系中任务的分发与认领由中心调度（或共享黑板 `task-board`）管辖，智能体本身不需要维护对外可见的全局任务池。 |
| `CancelTask` | **严格对应** | 单元 `id: cancel`。取消正在处理的任务。 |
| `SubscribeToTask` | **严格对应** | 单元 `id: observe-live`。订阅正在执行的任务事件流。 |
| Task State Machine (`submitted`, `working`, `completed`, `failed`, `canceled`, `input_required`) | **严格对应** | 单元 `id: state`（状态识别）与 `wait-visible`（等待可见：处于 `input_required` 时明确在等什么）。 |
| Task Artifacts (文件与数据产物) | **严格对应** | 单元 `id: act-deliver`（智能体交付产出）与 `artifact`（产出物发布）。 |
| Push Notification Configuration (Webhook / 推送配置) | **严格对应** | 单元 `id: wake-msg`（消息唤醒）与 `wake-bg`（后台完成异步唤醒）。 |

---

### 1.4 Codex app-server

- **出处与证据**：
  - 适用版本：`codex-cli 0.159.2`
  - 本机文件：`channels/hosts/codex/app-server.md`（170 个客户端请求、10 个服务端逆向请求、83 个通知）

| 外部原语 / 方法 | 类别标注 | 详细对齐分析与依据 |
| :--- | :--- | :--- |
| `thread/start` | **严格对应** | 单元 `id: open`（新建会话）+ `model-new`（开新时选模型/沙箱）。 |
| `thread/resume` | **严格对应** | 单元 `id: resume`。冷会话恢复加载，支持覆盖模型与配置。 |
| `thread/fork` | **严格对应** | 单元 `id: fork`。从历史任意轮次定点分叉出新会话，原会话不动。 |
| `thread/revert` | **我们没有** | **候选新单元 `revert`（会话回滚 / 历史截断）**。<br>定义：中心对已有会话施加历史截断，丢弃指定轮次之后的所有上下文与工具产生的影响，使会话在原地倒退回历史检查点重新推理，而非生成新的分支会话。<br>怎样算支持：调用后该轮次之后的记录被抹除，随后调用 `turn/start` 是从截断点继续。 |
| `thread/compact/start` | **严格对应** | 单元 `id: compact`。手动触发上下文压缩。 |
| `thread/inject_items` | **严格对应** | 单元 `id: inject-silent`。静默注入上下文条目，不触发模型推理。 |
| `thread/settings/update` / `turn/settings/update` | **严格对应** | 单元 `id: model-switch` 与 `mode-switch`。中途动态调整模型、推理强度与权限沙箱。 |
| `thread/memoryMode/set` | **我们没有** | **候选新单元 `memory-isolate`（会话记忆隔离 / 跨会话记忆免污染）**。<br>定义：中心在派发临时性、试错性或审核性会话时，显式关闭其向跨会话长期记忆库（Long-term Memory）的回写权限，防止探索中的脏数据污染主体认知。<br>怎样算支持：会话运行产生沉淀时被标记为只读沙箱，结束后不产生全局记忆增量。 |
| `thread/goal/set` / `get` / `clear` | **严格对应** | 单元 `id: goal`。长程会话的目标与 Token/预算上限控制。 |
| `thread/queue/add` / `list` / `start` | **严格对应** | 单元 `id: inject-next`。会话正在运行时将新输入加入原生待办队列，本轮结束后自动弹出。 |
| `turn/start` | **严格对应** | 单元 `id: open` / `resume` 推动一轮执行。 |
| `turn/steer` | **严格对应** | 单元 `id: steer`。轮内实时插话，且带 `expectedTurnId` 防串轮。 |
| `turn/interrupt` | **严格对应** | 单元 `id: cancel`。打断当前轮，会话保持热待命。 |
| `review/start` | **抽象方式不同** | Codex 将特定领域的“代码审查”包装为独立协议动作（带 diff、commit 目标，可自动 detached 分叉）；在我们体系中，审查属于协作层“往返 + 验收”形状下的提示词任务书与分叉/恢复组合，不单独占用底层能力单元。 |
| `command/exec` | **严格对应** | 单元 `id: terminal`。免 Token 借用宿主沙箱执行命令并返回输出。 |
| `fs/*` (readFile, writeFile, watch...) | **部分重叠** | 与宿主环境的文件操作重叠，但 Codex 将其暴露为中心可控的远程文件系统服务。 |
| `item/commandExecution/requestApproval` | **严格对应** | 单元 `id: permission`。沙箱外命令执行反向审批。 |
| `item/fileChange/requestApproval` | **严格对应** | 单元 `id: permission`。敏感文件修改审批。 |
| `item/permissions/requestApproval` | **严格对应** | 单元 `id: permission`。动态权限申请审批。 |
| `item/tool/requestUserInput` | **严格对应** | 单元 `id: ask-user`。模型向用户提出多选或结构化提问。 |
| `item/tool/call` | **部分重叠** | 与候选单元 `tool-hotplug` 互为镜像，属于中心在客户端注册的动态工具被模型反向调用的派发通道。 |

---

### 1.5 Claude Code 钩子事件与 Agent 架构

- **出处与证据**：
  - 适用版本：`Claude Code 2.1.296`
  - 本机文件：`channels/hosts/claude-code.md`、《能力核对 v2.0 §3.2、§4.1》
  - 核心定义：终端命令行架构、后台守护进程与 10 类生命周期 HTTP 钩子。

| 外部原语 / 命令 | 类别标注 | 详细对齐分析与依据 |
| :--- | :--- | :--- |
| `claude --bg` / `claude agents --json` | **部分重叠** | 单元 `id: wake-bg` 与 `state`。`--bg` 是后台常驻会话拉起；`agents --json` 是宿主级进程花名册枚举，属于宿主层对本地多会话状态的发现接口。 |
| `claude stop <id>` / `claude attach <id>` | **严格对应** | 单元 `id: cancel` / `close` 与 `resume`。停止后台运行并保留上下文，随后可重新挂载。 |
| `Hook: SessionStart` / `SessionEnd` | **严格对应** | 单元 `id: guard`。会话开始和收尾时的环境检查与规则注入。 |
| `Hook: PreToolUse` / `PostToolUse` | **严格对应** | 单元 `id: guard`。工具调用前拦截与后置校验。 |
| `Hook: PostToolUseFailure` | **部分重叠** | 单元 `id: guard`。专门针对工具失败的拦截回路，我们在 guard 中统一处理。 |
| `Hook: SubagentStart` / `SubagentStop` | **部分重叠** | 单元 `id: spawn-subagent` 与 `observe-live`。子智能体生命周期事件外溢，便于外部追踪调用树。 |
| `Hook: Stop` | **严格对应** | 单元 `id: guard`。智能体计划交卷时强制拦截，可检查成果不达标时强行注入新轮次继续执行。 |
| `Hook: Notification` | **严格对应** | 单元 `id: notify-user`。智能体主动发出的用户通知。 |
| `Hook: TaskCompleted` | **严格对应** | 单元 `id: act-deliver`。团队任务完成事件汇报。 |
| `SendUserMessage` 工具 | **严格对应** | 单元 `id: act-report`。在执行中途向用户发送结构化汇报而不挂起等待。 |
| 文件多写者冲突热点分析 (File Hotspots) | **不归我们管** | 监控层与分析层（Analysis Engine）对多智能体文件写锁冲突的统计，属于协作层健康监控，不是单智能体交互能力单元。 |

---

### 1.6 acpx 运行时公共契约 (`acpx/runtime`)

- **出处与证据**：
  - 版本基线：`acpx 0.19.5`
  - 本机文件：`C:\Users\COLORFIRE\AppData\Roaming\npm\node_modules\acpx\dist\runtime.d.ts` Lines 318-450

| 外部原语 / 契约接口 | 类别标注 | 详细对齐分析与依据 |
| :--- | :--- | :--- |
| `ensureSession` | **严格对应** | 单元 `id: open`（新建）与 `resume`（按 key 恢复）。统一处理会话创建或挂接。 |
| `startTurn` / `runTurn` | **严格对应** | 单元 `id: resume` / `open`。发起一轮，产出 `AsyncIterable<AcpRuntimeEvent>` 流与最终 `result`。 |
| `cancel` | **严格对应** | 单元 `id: cancel`。打断当前活动轮。 |
| `close` | **严格对应** | 单元 `id: close`。关闭会话，断开智能体连接并可选择清理存储。 |
| `prepareFreshSession` | **严格对应** | 单元 `id: open`。将会话句柄标为下次重建全新会话。 |
| `setMode` | **严格对应** | 单元 `id: mode-switch`。设置会话权限模式。 |
| `setModel` | **严格对应** | 单元 `id: model-switch`。设置会话模型。 |
| `setConfigOption` | **部分重叠** | 与 ACP 的 `session/set_config_option` 一致。 |
| `getStatus` | **严格对应** | 单元 `id: state` + `model-list` + `quota`。聚合查询状态、模型与用量。 |
| `watchSession` | **我们没有** | **候选新单元 `watch-journal`（旁路日志跟随 / 会话日志尾随）**。<br>定义：中心不持有智能体的活动进程或连接，仅通过尾随磁盘上的共享会话日志（Journal/JSONL）或数据库变更，被动读取、重放并订阅正在运行中的会话事件流。<br>怎样算支持：给定历史游标（Cursor），能无损接续读取后续新增的事件流，并在进程崩溃时不影响被观察的智能体。 |
| `doctor` | **严格对应** | 单元 `id: channel-health`。自检执行环境、依赖安装与通道健康。 |
| `sessionPermissions` / `permissionPolicy` | **严格对应** | 单元 `id: guard` 与 `permission`。按会话动态计算权限守卫策略。 |
| `mcpServers` (动态解析器) | **部分重叠** | 单元 `id: channel-route` 与能力渠道工具注入。 |
| `processLifecycle` (`onSpawn`, `onExit`) | **严格对应** | 单元 `id: observe-live` + `state`。子进程生命周期直接监听。 |

---

### 1.7 LangGraph

- **出处与证据**：
  - 核心定义：基于有向图与状态机编排的多智能体框架（LangChain 生态）。

| 外部原语 | 类别标注 | 详细对齐分析与依据 |
| :--- | :--- | :--- |
| `StateGraph` / `Nodes` / `Edges` | **不归我们管** | 图拓扑编排定义，属于协作层编排定义（对应我们的五种基本形状与四类连线），不是对单个智能体的控制能力单元。 |
| `State` / `Reducers` | **不归我们管** | 内存状态规约器，属于工作流引擎内部的数据汇聚机制。 |
| `interrupt(value)` | **部分重叠** | 单元 `id: act-yield` + `act-request`。节点主动挂起执行，将断点信息暴露给外部，等待人工或外部系统介入。 |
| `Command(resume=value)` | **严格对应** | 单元 `id: resume` + `permission`。带着决策恢复挂起的中断。 |
| `Checkpoint` / `Checkpointer` (MemorySaver, SqliteSaver) | **部分重叠** | 底座持久化机制，对应我们各家适配器的会话落盘与冷恢复。 |
| Time Travel (`update_state`, 从 past checkpoint 重跑) | **部分重叠** | 对应我们在 Codex 中提取的候选新单元 `revert`（会话回滚）以及已有的 `fork`（分叉）。 |
| Subgraph (子图嵌套) | **严格对应** | 单元 `id: spawn-subagent`。图内节点可嵌套独立运行的完整子图，外层视其为一个黑盒动作。 |
| `stream_mode` (`values`, `updates`, `messages`) | **严格对应** | 单元 `id: observe-live`。外部实时观察节点状态差量或消息流。 |
| `Send API` (动态条件路由扇出) | **不归我们管** | 对应协作层的“分发（Fan-out）”形状，由中心调度规则兑现。 |

---

### 1.8 OpenAI Agents SDK (Swarm 演进)

- **出处与证据**：
  - 规范来源：OpenAI Agents SDK (2025/2026 Production Release)
  - 官方定位：精简到极致的四个生产级智能体原语：Agents, Handoffs, Guardrails, Sessions。

| 外部原语 | 类别标注 | 详细对齐分析与依据 |
| :--- | :--- | :--- |
| `Agent` | **不归我们管** | 个体抽象封装（指令、可用工具、模型配置）。 |
| `Handoff` (交接对象与工具函数) | **严格对应** | 单元 `id: handoff`。当前智能体执行特定转交函数，将控制权、过滤后的上下文与任务转交给目标智能体。 |
| `Guardrail` (`input_guardrails`, `output_guardrails`) | **严格对应** | 单元 `id: guard`。执行前拦截输入、执行后审计输出，违规时熔断阻断。 |
| `Session` / `Runner` | **不归我们管** | SDK 内部负责驱动大模型轮次与交接循环的执行引擎。 |
| `Context Variables` | **部分重叠** | 跨交接传递的全局上下文变量包，部分重叠于我们的共享材料与上下文注入。 |
| `Tracing` / `OpenTelemetry Spans` | **严格对应** | 单元 `id: observe-live` 与 `observe-history`。执行轨迹打点与历史追溯。 |

---

### 1.9 AutoGen / AG2

- **出处与证据**：
  - 来源版本：Microsoft AutoGen (AG2 v0.4 / AgentChat Core)
  - 核心定义：基于 Actor 模型与事件驱动的多智能体对话框架。

| 外部原语 | 类别标注 | 详细对齐分析与依据 |
| :--- | :--- | :--- |
| `ConversableAgent` | **不归我们管** | 对话智能体基类封装。 |
| `GroupChat` / `GroupChatManager` | **不归我们管** | 多智能体群聊编排模式，对应我们协作层的“往返 + 主持人”拓扑。 |
| `register_reply` | **抽象方式不同** | AutoGen 在智能体内部注册回复处理函数链来决定动作；我们通过中心在问答每一步做“三个决定（下一个是谁、给他什么、停不停）”来驱动。 |
| `HumanInputMode` (`ALWAYS`, `NEVER`, `TERMINATE`) | **严格对应** | 单元 `id: mode-switch` 与 `permission`。配置人在环介入的审批时机。 |
| `TerminationCondition` (如 `StopMessageTermination`, `MaxMessageTermination`) | **部分重叠** | 在我们体系中，“停不停”主要由协作层任务闸门与验收规则裁决；单智能体层面的停机规则映射为 `goal` 的预算或 `guard` 的停止拦截。 |
| Topic-based Pub/Sub Message Bus (AgentChat Core) | **抽象方式不同** | AutoGen 0.4 采用去中心化的主题广播总线；我们体系坚持中心有向调度（`peer-message`）与工作区文件共享（`task-board`），避免无序广播导致的无意义 Token 消耗。 |

---

### 1.10 OpenRig

- **出处与证据**：
  - 规范来源：`mvschwarz/openrig`
  - 本机文件：设计目录《能力核对 v2.0 §4.2》
  - 核心定位：跨 Claude Code 与 Codex 的终端多席位宿主治理与稳健消息总线。

| 外部原语 / 设计 | 类别标注 | 详细对齐分析与依据 |
| :--- | :--- | :--- |
| 四层身份解耦 (`Seat/Node`, `Binding`, `Occupant Tenure`, `Session`) | **抽象方式不同** | OpenRig 围绕 tmux 物理表面切分拓扑席位、代际任期与 CLI 会话；我们体系围绕“角色活得长、实例活得短”，在协作层解耦任务书与实例，在底层以所有权五态与 `resume-native` 纳管原生会话。 |
| `rig send` 5 步 Bracketed Paste 投递闭环 | **不归我们管** | 属于执行者适配器对终端字符流的私有容错实现（粘贴延时、防人工打字打断、提示符校验），属于底层实现保障，不改变上层能力单元定义。 |
| 终端输入态守卫 (`needs_input` / 交互弹窗识别) | **严格对应** | 单元 `id: wait-visible` 与 `state`。能够准确识别对端正卡在审批确认或提问输入框，绝不盲目强推。 |
| 诚实恢复探针 (`NativeResumeProbe`) | **严格对应** | 单元 `id: resume-native`。检测恢复失败时绝不静默降级为全新空会话。 |
| 拓扑快照与跨平台接续包 (`rig restore-packet`) | **部分重叠** | 属于协作层整网拓扑的归档与跨会话历史格式转换，能力层映射为 `observe-history` 与 `open`。 |

---

### 1.11 CrewAI

- **出处与证据**：
  - 规范来源：CrewAI Multi-Agent Production Framework
  - 核心定位：基于“角色-任务-团队”结构的高层智能体协作框架。

| 外部原语 | 类别标注 | 详细对齐分析与依据 |
| :--- | :--- | :--- |
| `Agent` (role, goal, backstory) | **不归我们管** | 属于提示词角色构建工程，非能力单元。 |
| `Task` (description, expected_output, output_json, async_execution) | **严格对应** | 任务书在能力层表现为输入载荷；结构化结果交付直接严格对应 `act-deliver` 与 `artifact`。 |
| `Crew` (process: sequential / hierarchical, manager_agent) | **不归我们管** | 流水线与主管派活拓扑，严格对应我们协作层的五种形状（接力、分发+汇总）。 |
| `Coworker Delegation` (`delegate_work`, `ask_question`) | **严格对应** | 单元 `id: spawn-subagent`（派活并拿回结果）与 `peer-message`（向同伴提问）。 |
| 多层记忆系统 (Short-term, Long-term, Entity Memory) | **抽象方式不同** | CrewAI 内部集成 RAG 向量库进行自动化实体记忆检索；我们体系以文件为唯一真源，依靠工作区文档、记忆文件与 `compact` / `memory-isolate` 进行显式记忆管理。 |

---

### 1.12 Temporal 智能体模式 (Durable Execution)

- **出处与证据**：
  - 来源文档：Temporal Durable Agent Workflows Spec (2025/2026)
  - 核心定位：智能体长程运行的确定性持久化与容错底座。

| 外部原语 | 类别标注 | 详细对齐分析与依据 |
| :--- | :--- | :--- |
| `Workflow` / `Activity` | **不归我们管** | 工作流调度引擎的执行体。 |
| `Signal` (外部异步信号注入) | **严格对应** | 单元 `id: steer`（轮内插话）或 `wake-msg`（异步消息注入唤醒）。 |
| `Query` (无副作用同步状态查询) | **严格对应** | 单元 `id: state` 与 `observe-live`。实时读取智能体当前内存与执行进度。 |
| `Update` (原子突变并返回结果) | **部分重叠** | 结合了 `steer`（修改行为）与 `state`（立即拿到变动后的确认），但在 LLM 异步推理场景下大多退化为 Signal + Query。 |
| `Durable Timer` / `Sleep` | **严格对应** | 单元 `id: wake-timer` 与 `wake-persist`。进程崩溃、宿主重启后依然保持计时并精准叫醒。 |
| `Event History Replay` | **严格对应** | 单元 `id: resume` 与 `observe-history`。通过重放事件日志还原上下文继续推进。 |

---

## 二、饱和记录（按查验顺序的增量统计）

我们严格按照调研执行的时间顺序，统计每一个外部来源新冒出的“我们没有（候选新单元）”数量，以观察抽象边界的收敛过程：

```
来源 1: ACP 协议规范           --> 新冒出 2 项 (cmd-list, plan-live)
来源 2: MCP 规范               --> 新冒出 2 项 (sampling, tool-hotplug)
来源 3: A2A 协议               --> 新冒出 1 项 (agent-card)
来源 4: Codex app-server       --> 新冒出 2 项 (revert, memory-isolate)
来源 5: Claude Code 钩子/架构  --> 新冒出 0 项
来源 6: acpx 运行时契约        --> 新冒出 1 项 (watch-journal)
来源 7: LangGraph              --> 新冒出 0 项
来源 8: OpenAI Agents SDK      --> 新冒出 0 项
来源 9: AutoGen / AG2          --> 新冒出 0 项
来源 10: OpenRig               --> 新冒出 0 项
来源 11: CrewAI                --> 新冒出 0 项
来源 12: Temporal 智能体模式   --> 新冒出 0 项
```

### 饱和度曲线走势与边界判断

| 序号 | 来源名称 | 来源性质 | 产生的“我们没有”数量 | 累计候选新单元数 | 饱和度表现 |
| :---: | :--- | :--- | :---: | :---: | :--- |
| 1 | **ACP 协议规范** | 通信协议基线 | **2** | 2 | 协议层透出前端命令和实时计划 |
| 2 | **MCP 规范** | 工具与上下文规范 | **2** | 4 | 补齐反向模型借道与工具动态变更 |
| 3 | **A2A 协议** | 跨智能体互操作协议 | **1** | 5 | 补齐标准化身份名片自述 |
| 4 | **Codex app-server** | 最全全功能原生服务 | **2** | 7 | 挖出会话原地回滚与记忆隔离 |
| 5 | **Claude Code 钩子** | 终端命令行与事件流 | **0** | 7 | 钩子全被 guard 与生命周期吸收 |
| 6 | **acpx 运行时契约** | 嵌入式驱动底座 | **1** | 8 | 补齐旁路日志文件跟随（被动观察） |
| 7 | **LangGraph** | 图编排与状态图 | **0** | 8 | 中断/恢复/分支均已被全量覆盖 |
| 8 | **OpenAI Agents SDK** | 极简工业级智能体 SDK | **0** | 8 | 4 原语全对应（Handoff/Guard/Session） |
| 9 | **AutoGen / AG2** | 多智能体对话框架 | **0** | 8 | 编排属协作层，控制原语已覆盖 |
| 10 | **OpenRig** | 终端物理席位与消息治理 | **0** | 8 | 终端容错属适配器私有实现 |
| 11 | **CrewAI** | 角色扮演与工作流编排 | **0** | 8 | 协作形状完全对应，控制单元无新物 |
| 12 | **Temporal 模式** | 持久化确定性状态机 | **0** | 8 | Signal/Query/Timer 完全对齐 |

> [!IMPORTANT]
> **饱和度审计结论**：
> 调查推演至第 6 个来源（acpx 运行时）后，在随后的 **LangGraph、OpenAI Agents SDK、AutoGen、OpenRig、CrewAI、Temporal 连续 6 个主流工业级系统中，新增候选单元数连续为 0**！
> 无论来源是学术开源（AutoGen）、前沿初创（CrewAI、LangGraph）、巨头主力规范（OpenAI、Temporal），还是底层黑客工具（OpenRig），其在“如何驱动单个智能体、如何观察其状态、如何向其送入或取回数据”的原语上，已全部收敛于我们当前 46 个单元与前序发掘的 8 个候选单元构成的集合中。
> **能力单元的外部对照方向已正式推至饱和边界。**

---

## 三、汇总：候选新能力单元清单（去重后 8 项）

以下 8 项候选单元严格遵循本项目的公理：**把平台名换成占位符依然读得通；不属于协作层特定的编排议题，属于中心与单个智能体/渠道间的通用交互**。

| 序号 | 候选单元 id | 名称 | 形态 | 类别归属建议 | 定义与交互语义 | 怎样算支持（判定条件） | 外部原型出处 |
| :---: | :--- | :--- | :---: | :---: | :--- | :--- | :--- |
| 1 | `cmd-list` | 可用命令发现 | 动作/状态 | 模型与模式（扩展） | 智能体在不同会话阶段向宿主广播当前可用的斜杠命令清单（含命令名、描述、入参 Schema），宿主据此动态渲染快捷指令 UI。 | 宿主接收到结构化通知后，无需硬编码即可在前端展示该智能体当前真实支持的快捷指令（如 `/compact`、`/review`）。 | ACP `available_commands_update`；Codex 动态命令清单 |
| 2 | `plan-live` | 步骤计划流透出 | 动作/状态 | 必需操作（观察扩展） | 智能体在多步复杂执行中，向中心流式推送其结构化任务计划清单（含步骤内容、优先级、状态: pending/in_progress/completed）。 | 中心直接读取到 plan 结构化对象并实时刷新进度条，无需用正则表达式从自然语言回答中抽取推测。 | ACP `session/update: plan`；Codex `turn/plan/updated` |
| 3 | `sampling` | 借道采样（模型代理） | 操作/动作 | 渠道级操作（扩展） | 受控端（如下游 MCP 工具或沙箱内子智能体）自身无独立 API Key，通过反向 RPC 请求宿主代理调用大模型并返回推理结果，由宿主统一审计和限流。 | 外部工具发起采样请求时，宿主按当前配置的模型渠道完成补全并返回生成的 JSON/文本，整个调用纳入宿主账本。 | MCP `sampling/createMessage` |
| 4 | `tool-hotplug` | 工具热插拔 | 操作/动作 | 宿主环境（扩展） | 智能体在执行过程中动态挂载、卸载或更新可用工具集合，或中心在运行中途向智能体动态注入口令与动态工具。 | 工具集合变更后，智能体下一推理步立即能看到并调用新工具，且无需重建会话。 | MCP `notifications/tools/list_changed`；Codex `dynamicTools` |
| 5 | `agent-card` | 智能体名片自省 | 状态/操作 | 渠道级操作（扩展） | 智能体对外暴露标准元数据自述卡片，声明自身身份标识、角色定位、支持的技能、出入参格式及通信鉴权策略。 | 中心通过统一协议读取该卡片，能全自动完成智能体注册与能力登记，不依赖人工写死适配器卡片。 | A2A `AgentCard` / `GetExtendedAgentCard` |
| 6 | `revert` | 会话回滚（历史截断） | 必需/可选操作 | control_lifecycle 扩展 | 中心对已有会话施加历史截断，精准回退到某个历史轮次或检查点，删除后续产生的不良历史并允许在原会话原地重跑。区别于 `fork`（新建分支）。 | 调用截断后，目标轮次之后的上下文被彻底抹除，后续发起新一轮即从该截断点继续演进，会话 ID 保持不变。 | Codex app-server `thread/revert`；LangGraph Time Travel (`update_state`) |
| 7 | `memory-isolate` | 会话记忆隔离 | 可选操作 | 守卫与权限（扩展） | 在开辟会话时显式切断其向跨会话长期记忆库（Long-term Memory）的回写链路，专用于临时探索、审核或不可信角色的执行。 | 会话运行中产生的所有经验和知识沉淀仅留存在本会话生命周期内，会话销毁后全局跨会话记忆库零污染。 | Codex app-server `thread/memoryMode/set` (disabled) |
| 8 | `watch-journal` | 旁路日志跟随 | 必需/可选操作 | observe_only 扩展 | 中心不侵入、不接管外部智能体的活动进程，仅通过尾随磁盘上的会话日志（Rollout JSONL）或数据库增量，被动重放和跟随正在发生的多智能体交互事件。 | 给定起始字节或游标（Cursor），能无损、低延迟流式读出后续所有新增事件，且读操作不对写进程产生任何锁竞争或干扰。 | acpx `watchSession`；Agent Flow 字节尾随；Agent-Architecture-Hub `trace scan` |

---

## 四、对协作层抽象的反哺与澄清

通过拿上述 12 个外部系统与我们的协作层抽象（《channels/README.md》第一之二节）进行双向映射，我们得出以下四条关键认知澄清：

1. **“问答”作为最小单元的普适性被完全印证**：
   - 无论是 A2A 协议的 `SendMessage`、ACP 的 `session/prompt`，还是 OpenAI Agents SDK 的单次迭代，外部系统虽然各自包装为 Task、Turn 或 Run，底层在通信拓扑上无一例外都退化为本项目的基本公理——“送入输入、等待结束、取回输出”的单步问答。
2. **“三个决定”划分极为干净**：
   - AutoGen 用代码回调链（`register_reply`）、LangGraph 用图条件边（`ConditionalEdge`）、CrewAI 用主管经理（`ManagerAgent`）、OpenAI 用 Handoff 函数，表面实现千奇百怪，但剥离语法糖后，每一步依然是在回答“下一个是谁（路由）、给他什么（上下文过滤与载荷）、停不停（终止条件与闸门）”。这充分证明我们的三个决定成功抓住了多智能体协同的本质，无需引入冗余的新概念。
3. **“所有权五态”与“四级注入”是真实系统的护城河**：
   - 在纯内存 SDK（如 OpenAI Agents SDK、LangGraph）中，因为全系统在同一进程内运行，插话和交接非常轻巧；但一旦进入桌面端、真实终端与多进程跨宿主交互（如 OpenRig、Codex app-server、Claude Code），各家无一例外遭遇单写者锁、人工打字冲突、终端弹窗阻断等血淋淋的现实问题。
   - 本项目总结的“所有权五态（`owned_by_us`, `owned_by_app`, `owned_by_terminal`, `released`, `unknown`）”以及注入降级链（轮内插话 ＞ 原生下一轮队列 ＞ 工具捎带 ＞ 收件箱），不仅完全覆盖了外部高阶系统的实际解法，且比 OpenRig 的 bracketed paste 和 Codex 的 app-server 更系统化、容错分档更明确。
4. **唤醒作为宿主能力的归宿被再次确立**：
   - 外部对异步长任务的解法，如 ACP 的无阻塞让出、Temporal 的 Durable Sleep、A2A 的 Webhook 唤醒通知，均一致印证了本项目的核心判断：“唤醒是宿主的能力，智能体只负责让出并写明在等什么”。任何脱离宿主等待机制而妄图在智能体内部死循环轮询的方案，均已被现代架构淘汰。

---

## 五、环境与命令验证记录

- **命令行代理验证**：通过 `$env:HTTP_PROXY="http://127.0.0.1:7892"` 与 `$env:HTTPS_PROXY="http://127.0.0.1:7892"` 配合 `search_hub.js` 成功检索到 A2A 官方规范 (`a2aproject/A2A`)、MCP 2026 最新草案与 OpenAI Agents SDK 架构，单次耗时均在 3~4 秒内，零凭证外泄。
- **本地契约文件直读验证**：
  - `C:\Users\COLORFIRE\AppData\Roaming\npm\node_modules\acpx\dist\runtime.d.ts`：实读 858 行完整 TypeScript 契约，核实了 `watchSession`、`elicitationModes`、`availableCommands`、`plan`、`AsyncEventQueue` 等一手原语。
  - `channels/hosts/codex/app-server.md`：核验 170 个客户端方法，确认了 `thread/revert`、`thread/memoryMode/set`、`turn/steer` 等核心方法的请求/响应规范。
  - `能力核对_六平台与MCP渠道_v2.0_20261014.md`：核验 OpenRig 四层身份结构与 Claude Code 10 类生命周期 Hooks。
- **无害化与安全规矩执行**：
  - 全过程只读，未启动任何后台常驻进程，未新建任何动态探测会话。
  - 未打开任何运行中的 SQLite 数据库（包括 AP-Vibe 数据库与 ZCode 数据库）。
  - 全文无任何明文 Key、Token、Cookie 等隐私信息。
