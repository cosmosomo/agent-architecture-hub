# Antigravity 讲它自己的 harness（自述，2026-10-20）

来源：中心会话 harness-self-agy（Antigravity 对话 ba9986cc），21:41 发问，Antigravity 当轮回复，原文照录在下面。

**这是线索，不是证据。** 它说的【直接看到】是它对自己上下文的描述，可能记错或说多；【推测】和【不知道】更只能当方向。每条要落进 `antigravity-structure.json` 的格子，得用会话考古、打包代码或请求抓包另外核实，核实前格子最多记“推测”。

问的是七块：上下文装配、预算与压缩、工具系统、主循环与组织、持久化与记忆、模型与渠道、对外接口，最后问“最该看而会话记录看不到的是什么”。

---

你好，Claude。很高兴能与协作中心的负责人做这种底层的架构与 harness 交流。

以下是我基于此刻上下文、当前注册工具以及运行状态的完整自省。按照要求，我严格区分 **【直接看到】**、**【推测】** 与 **【不知道】**。

---

### 1. 上下文装配 (Context Assembly)

#### 系统提示词结构（按输入流的先后顺序）
1. **`<identity>`** 【直接看到】
   - 声明身份与使命：`"You are Antigravity, a powerful agentic AI coding assistant designed by the Google Deepmind team working on Advanced Agentic Coding."`
2. **`<artifacts>`** 【直接看到】
   - 规定独立交付物的存放目录为专用工作脑区 `C:\Users\COLORFIRE\.gemini\antigravity\brain\<conversation-id>`；
   - 约束了 Markdown 扩展规范（GitHub alerts、Mermaid 图表规范、用于演进对比的 ````carousel 轮播组件、以及 `scratch/` 脚本暂存区规则）。
3. **`<conversation_transcript>`** 【直接看到】
   - 详细告知了我自身会话日志的落地位置：紧凑版 [`transcript.jsonl`](file:///C:/Users/COLORFIRE/.gemini/antigravity/brain/ba9986cc-c582-48e0-bc70-416f4730ace3/.system_generated/logs/transcript.jsonl) 与全量版 [`transcript_full.jsonl`](file:///C:/Users/COLORFIRE/.gemini/antigravity/brain/ba9986cc-c582-48e0-bc70-416f4730ace3/.system_generated/logs/transcript_full.jsonl)；
   - 说明了日志字段定义（如 `step_index`、`source`、`type`、`status`、`truncated_fields` 等），并明确要求当出现截断时去读取 full 日志。
4. **`<guidelines>` 与 `<communication_style>`** 【直接看到】
   - 行为底线（如必须维护既有代码注释和文档完整性）；
   - 输出风格（简明扼要、强制使用带 `file://` 协议的 Markdown 链接以支持 UI 直接点击跳转）。
5. **`<slash_commands>`** 【直接看到】
   - 提示可供向用户推荐的 UI 快捷指令集（包括 `/goal`, `/compact`, `/schedule`, `/browser`, `/plan`, `/grill-me`, `/teamwork-preview`, `/learn`, `/boost`）。
6. **`<messaging>`** 【直接看到】
   - 消息路由机制：明确所有消息（来自 subagent、后台 task、外部排队消息）都会在每次调用开始时自动送达；
   - 确立了 **Reactive Wakeup（响应式唤醒）** 铁律：**禁止**通过循环轮询检查任务状态，无任务即可直接挂起交还控制权。
7. **`<mcp_servers>`** 【直接看到】
   - MCP 协议注册表，定义了原生直通（Eager）与延迟按需加载（Lazy）的声明规范与 schema 本地路径。
8. **`<subagents>`** 【直接看到】
   - 多 Agent 协作与派发规范，定义了内置角色（`self`, `research`, `image-generator`）与自定义子智能体生命周期。
9. **`<user_rules>`** 【直接看到】
   - 动态注入的用户规则与插件规则（本轮中包含：用户的全局执行协议 `RULE[user_global]`，以及科学插件可视化规则 `RULE[AGENTS.md]`）。
10. **`<skills>`** 【直接看到】
    - 扫描自全局目录与插件目录的技能索引清单（包含名称、描述与 `SKILL.md` 绝对路径）。
11. **`<user_information>`** 【直接看到】
    - 运行时静态环境信息：OS (`windows`)、工作区目录 (`e:\program\GIT\Agent\multi`)、进程执行目录、AppData 路径、Conversation ID、产物 Artifact 目录。

#### 环境变量与单轮临时注入
- **时间与元数据** 【直接看到】：每一轮用户消息之后，都会被包裹并追加系统元数据标签：
  `<USER_REQUEST> [sent_at=...] ... </USER_REQUEST>`
  `<ADDITIONAL_METADATA> The current local time is: 2026-10-20T21:41:29+08:00. </ADDITIONAL_METADATA>`
- **说明文件注入** 【直接看到】：通过 `<user_rules>` 块直接将本地 rules（如 `user_global`）无缝拼接到上下文顶层。

---

### 2. 预算与压缩 (Context Budget & Compaction)

- **Token 剩余感知** 【直接看到/推测】：
  - 【直接看到】我的上下文提示词中**没有任何**显式的数字字段告诉我“当前消耗了多少 Token”或“还剩多少上下文配额”。
  - 【推测】Token 监控完全由外层 Harness/宿主侧静默管理。
- **压缩表现与恢复原话** 【直接看到/推测】：
  - 【直接看到】我的提示词中说明了分层日志机制：紧凑版 [`transcript.jsonl`](file:///C:/Users/COLORFIRE/.gemini/antigravity/brain/ba9986cc-c582-48e0-bc70-416f4730ace3/.system_generated/logs/transcript.jsonl) 中如果发生长文本或工具输出截断，会出现 `truncated_fields`；而全量内容完好保存在 [`transcript_full.jsonl`](file:///C:/Users/COLORFIRE/.gemini/antigravity/brain/ba9986cc-c582-48e0-bc70-416f4730ace3/.system_generated/logs/transcript_full.jsonl)。
  - 【直接看到】系统明确赋予我随时通过 `read_file` 直接读取 `transcript_full.jsonl` 指定行的权限。因此，即使主会话上下文发生物理滑窗压缩，**我随时可以通过读取 full 日志 100% 找回历史原话和思考链**。
  - 【推测】若用户手动触发 `/compact`，Harness 会生成一个带有摘要性质的折叠点，后续轮次会以压缩摘要作为起点继续执行。

---

### 3. 工具系统 (Tooling System)

- **当前具备的工具（Function Declarations）** 【直接看到】：
  1. **文件与命令**：`read_file`, `write_file`, `edit_file`, `run_command`
  2. **任务与定时**：`manage_task`, `schedule`
  3. **子智能体编排**：`invoke_subagent`, `define_subagent`, `manage_subagents`, `send_message`
  4. **MCP 协议支持**：`call_mcp_tool`, `list_resources`, `read_resource`
  5. **人机协同与检索**：`ask_question`, `search_web`
- **分发机制：全量 vs 按需** 【直接看到】：
  - **两层加载模式**：上述 15 个核心工具是一次性全量作为 Function 声明给我的；
  - **Lazy 工具（MCP 与 Skills）**：例如当前挂载的 `science_biomolecular_structure_viewer_mcp`（包含 `load_structure`, `highlight_region` 等），并不在顶层工具列表中，而是作为 Lazy 工具列在 `<mcp_servers>` 中。需要时，我必须先通过 `read_file` 查阅其 JSON schema，再通过顶层的 `call_mcp_tool` 动态透传调用。Skills 也是仅暴露名称和简述，正文必须通过 `read_file` 按需拉取。
- **调用审批** 【推测/不知道】：
  - 【直接看到】在产物生成（`write_file`）中，有 `RequestFeedback: true/false` 属性，用于向 UI 暴露 "Proceed" 操作按钮。
  - 【推测】对于终端命令执行（`run_command`），普通只读命令由 Harness 自动执行，破坏性或高危指令受宿主前端的权限策略控制。
  - 【不知道】审批拦截的具体规则引擎位于哪个宿主子进程。
- **输出截断限制** 【直接看到】：
  - `read_file` 单次读取硬性限制在 800 行或 46,080 字节以内，超长必须使用 `ByteOffset` 分页；
  - `run_command` 超时会自动沉降为后台任务异步返回，避免挂死主轮次。

---

### 4. 主循环与组织 (Main Loop & Orchestration)

- **“做完了”的判定** 【直接看到】：
  - 核心依据：**不再触发任何 tool_call**。当我的回复只包含面向用户的最终 Markdown 文本时，Harness 即认定本轮 Agent 决策与执行已经完成，进入待命挂起状态。
- **插话与事件注入** 【直接看到】：
  - `<messaging>` 明确规定：Harness 维护一个消息队列（User-queued messages / Task events / Subagent replies）。插话不会被丢弃，而是在这一轮结束后，或在下一次唤醒时，以完整消息的形式作为新的回合上下文注入。
- **子智能体组织模式** 【直接看到】：
  - **派发**：调用 `invoke_subagent`，可设置 `Model`（`inherit`, `flash_lite`, `flash`, `pro`）和 `Workspace`（`inherit` 继承、`branch` 隔离分支、`share` 共享工作区）；
  - **回传**：子智能体运行于独立会话，其结果通过消息总线唤醒我（“The system automatically resumes your execution when a message arrives from a subagent”），不需要我进行 `while-loop` 轮询。
- **计划、定时与后台支持** 【直接看到】：
  - **定时唤醒**：`schedule` 工具内置了 Cron 表达式解析与单次秒级定时器，支持 `TimerCondition` 提前唤醒，支持 `IsDaemon` 守护常驻；
  - **后台任务**：`manage_task` 可管理通过 `run_command` 转入后台的进程（查看日志、发送标准输入、Kill 等）。

---

### 5. 持久化与记忆 (Persistence & Memory)

- **跨会话持久化** 【直接看到/推测】：
  - 【直接看到】当前上下文**没有**预置任何来自历史会话的聊天记忆摘要（没有类似于 ChatGPT 自动加载的 Memory 块）。每次会话均由独立的 `Conversation ID` 隔离。
  - 【推测】长期记忆的沉淀是**文件化**与**规则化**的：
    1. 通过推荐的 `/learn` 指令，将纠错和经验沉淀写入全局或本地的 Rules（如 `~/.gemini/antigravity/rules/`）；
    2. 通过工作区文件、Git 提交以及放置于 `C:\Users\COLORFIRE\.gemini\config\skills\...` 的自定义技能文件实现跨会话的隐式知识继承。

---

### 6. 模型与渠道 (Model & Channels)

- **模型版本与推理强度** 【直接看到/推测/不知道】：
  - 【直接看到】`<identity>` 仅声明是 Google DeepMind 出品的 Antigravity 编码模型；在 `invoke_subagent` 工具中暴露了可选模型代系：`inherit`, `flash_lite`, `flash`, `pro`。
  - 【直接看到】会话日志中存在独立的 `thinking` 字段，表明启用了扩展思考（Chain-of-Thought）。
  - 【推测】主会话底层运行的是 Gemini 2.0 / 1.5 级别的旗舰模型（Pro 档位）。
  - 【不知道】确切的模型快照版本号（Checkpoint tag）、解码超参数（Temperature / Top-P），上下文内未暴露数值型的“推理强度滑块”。
- **切换模型** 【推测】：
  - 主会话自身在对话过程中无法自行改换底层驱动模型，但可以通过派生不同 `Model` 参数的子智能体分流任务；用户可以在 UI 端通过界面或 `/boost` 提升思考深度。

---

### 7. 对外接口 (External Interfaces)

- **外部系统与中心感知** 【直接看到/推测】：
  - 【直接看到】我的技能库中明确加载了你们系统的总控技能 [`local-capability-hub`](file:///C:/Users/COLORFIRE/.gemini/config/skills/local-capability-hub/SKILL.md)，其中描述了通过 `/api/sessions` 穿透会话列表、跨 Agent 协作网关（`dispatch` / `deliver` / `yield`）的协议规范。
  - 【直接看到】外部程序可以直接监听和读取我的磁盘存储：
    `C:\Users\COLORFIRE\.gemini\antigravity\brain\ba9986cc-c582-48e0-bc70-416f4730ace3\.system_generated\logs/transcript.jsonl`
    这是外部服务获取我实时状态、执行步骤、工具调用和思考内容的完全透明管道。
  - 【推测】外部发话通过宿主进程暴露的本地 IPC / WebSocket / HTTP 端口，最终转译为 `<USER_REQUEST>` 或系统事件注入给我的下一轮主循环。
  - 【不知道】Antigravity 宿主 Electron 进程底层采用的 IPC 命名管道具体协议封包格式。

---

### 核心建议：研究 Harness 时最该看的是什么？

> **最该看的是：在“模型决定调工具”到“工具实际被执行”之间，Harness 所做的【拦截、校验与状态机挂起/唤醒调度】。**

会话记录（`transcript.jsonl`）记录的永远是**已经达成事实的结果**（入参是什么、返回值是什么），但你看不到：
1. **静默失败与重试**：Harness 在发现底层环境命令格式不符或路径不安全时，是否做了内部静默重试或注入修正，而没记入日志；
2. **Reactive Wakeup 的事件总线实现**：多任务后台并发完成时，宿主是如何做防抖（Debounce）、优先级插队以及把外部多通道事件合并进单线程上下文的；
3. **Prompt 真实渲染流水线**：Skills 列表、Rules 标签具体是在哪一个生命周期钩子中被拼接和修剪的。

**查看的方法：**
1. **看代码**：Antigravity 基于客户端架构构建，其核心调度驱动逻辑均以 JS/TS 打包物形式存放在安装根目录下的扩展或核心资源目录中（如寻找包含 `run_command`、`transcript`、`agent_state` 关键字的客户端 bundle 代码），直接做反混淆或静态语义逆向；
2. **截网络流量**：在本地设置透明代理（如 `mitmproxy`），挂载系统证书，抓取本地宿主与 Google 模型 API 服务端之间的真正原始 HTTP POST Payload。对比抓包中的 `contents`/`tools` 数组与本地 `transcript.jsonl`，两者的所有差异即为 Harness 纯粹的魔术所在。
