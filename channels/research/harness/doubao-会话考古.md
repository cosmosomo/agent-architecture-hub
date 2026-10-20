# 会话考古：豆包 Desktop 智能体模式 Harness 全量普查与架构还原

> **产品**：豆包 Desktop (Doubao / 智能体模式 · 本地工作与协同 Agent 模式)  
> **研究员**：Argon（Antigravity pro）· 固化会话 `research-frontier`  
> **普查时间**：2026-10-20  
> **普查工具**：`channels/probe/scripts/harness/census_doubao.mjs`（全量无抽样，只读扫描，不碰进程）  
> **机器可读数据**：`channels/research/harness/doubao-census.json`  

---

## 一、关键信息

### 1.1 全量普查总账与数字（可复跑核验）

基于对本机 `%LOCALAPPDATA%\Doubao\User Data\Default\.doubao\agent_mode\workspace\` 的无抽样全量扫描，共普查 **71 个独立会话**、**299 个多智能体执行者**、**289 个轨迹文件**（共计 **4,651 行交互轨迹**），以及任务看板、外溢工具输出与后台任务队列：

| 指标维度 | 普查数量 | 物理落盘位置 | 统计含义 |
|---|---|---|---|
| **智能体模式会话数** | 71 | `.doubao/agent_mode/workspace/.sessions/<id>/` | 本机运行过的完整复杂工作流会话 |
| **智能体实例总数** | 299 | `.sessions/<id>/agents/<agentId>/` | 包含主智能体、组织者与特化工作者 |
| **轨迹文件总数** | 289 | `.sessions/<id>/agents/<agentId>/system/trajectory.jsonl` | 具备结构化逐步增量落盘日志的智能体轨迹 |
| **轨迹记录总行数** | 4,651 | `system/trajectory.jsonl` | 模型推理、用户需求与工具调用的总交互行 |
| **共享任务看板** | 71 个 | `.sessions/<id>/board.md` | 每个会话一个全局共享任务卡与产物跟踪板 |
| **会话长期记忆文件** | 72 个 | `.sessions/<id>/memory/MEMORY.md` | 会话级沉淀的偏好与上下文记忆 |
| **系统指令与需求记录** | 299 个 | `agents/<agentId>/system/assignment.md` | 记录角色指派、父级委托与用户追加需求 |
| **工具结果溢出文件** | 61 个 | `agents/<agentId>/system/tool-results/*.txt` | 当工具返回数据过大时，落地独立的原始文件 |
| **后台轮询监控状态机** | 47 个 | `agents/<agentId>/poll-monitors/` | 包含 `scripts/` 与 `states/` 异步任务监控器 |
| **后台任务执行队列** | 8 个会话 | `workspace/conversation/<id>/background_history_task/` | 包含 `index.json`, `.history.lock`, `outputs/` |
| **内置平台技能库** | 10 个 | `workspace/.skills/` | 包含 `computer-use-automation`, `browser-use` 等 |
| **用户自定义技能库** | 7 个 | `workspace/.user_skills/` | 本地自配特化技能目录 |

---

### 1.2 多智能体层级架构与前缀拓扑 (Multi-Agent Hierarchy)

普查揭示，豆包智能体模式并非单智能体运行，而是严格的**三级树状协同架构**，通过智能体 ID 前缀进行清晰的职责分工：

| 前缀代码 | 角色定位 | 普查数量 | 占比 | 职责范围与 Harness 作用 |
|---|---|---|---|---|
| `m_` | **Main Agent (主智能体)** | 71 | 23.7% | **面向用户的交互门户**。每个会话必定存在且仅存在 1 个（71/71 = 100%）。负责理解用户原始目标、向用户汇报最终成果、调度组织者。 |
| `o_` | **Organizer Agent (组织者/规划者)** | 35 | 11.7% | **任务拆解与子流程编排者**。负责将高阶目标拆分为多阶段子任务，维护全局 `board.md` 看板，派发执行工作者。 |
| `s_` | **Subagent / Worker (执行工作者)** | 193 | 64.6% | **特化任务终端执行者**。负责具体的文件写入、网络调研、Python 脚本处理、数据清洗与局部产物构建。 |

> **架构结论**：平均每个会话包含 **4.21 个智能体**（1 个 Main + 0.5 个 Organizer + 2.7 个 Worker）。复杂调研任务最高分发超过 10 个特化子智能体协同。

---

### 1.3 轨迹记录种类与字段清单 (`trajectory.jsonl`)

在 4,651 行转录中，豆包采用符合 OpenAI Chat Completion 标准的 `role` 三态分层：

| 角色分类 (`role`) | 发生频次 | 包含字段 (`fields`) | 属于 Harness 哪个部分 | 注入时机与时序逻辑 |
|---|---|---|---|---|
| `tool` | 2,269 | `role`, `content`, `tool_call_id`, `image_link_list` | **工具系统 (工具返回与执行结果)** | 工具执行完成后，由宿主 Harness 将标准输出或错误回填给模型；支持多模态截图（`image_link_list`）直传。 |
| `assistant` | 1,682 | `role`, `content`, `tool_calls`, `reasoning_content` | **组织 (思考规划) + 工具调用 + 可观测** | 模型单步生成时产生。当调用工具时附带 `tool_calls`（含 `id`, `type`, `function.name`, `function.arguments`）；支持深度思考链（`reasoning_content`）。 |
| `user` | 700 | `role`, `content`, `image_link_list` | **上下文装配 (需求与任务指令)** | 由主会话透传的用户需求、父级智能体指派的子任务描述，或系统注入的重试提醒。 |

---

### 1.4 工具系统调用全景与频率排行（Top 20）

在 1,682 次助手步中，共触发工具调用 **2,400+ 次**，完整覆盖多智能体协作、代码执行与任务管理：

| 排名 | 工具名称 (`function.name`) | 调用频次 | 典型入参 (`arguments`) | 归属 Harness 职能 |
|---|---|---|---|---|
| 1 | `TaskOutput` | 398 | `content`, `artifacts`, `status` | 结构化任务交付收工（收束子智能体上下文） |
| 2 | `Write` | 369 | `file_path`, `content` | 本地文件全量持久化写入 |
| 3 | `PowerShell` | 360 | `command` | 宿主本地命令行执行引擎 |
| 4 | `create_agent` | 203 | `agent_type`, `instruction`, `task_id` | **派生子智能体原语**（动态扩展 Worker 节点） |
| 5 | `wait_agent` | 177 | `agent_ids`, `timeout` | **子智能体栅栏同步原语**（Join 等待多节点回传） |
| 6 | `Read` | 127 | `file_path`, `offset`, `limit` | 本地文件分块安全读取 |
| 7 | `Edit` | 99 | `file_path`, `pattern`, `replacement` | 本地文件精准模式替换与补丁 |
| 8 | `web.fetch` | 84 | `url`, `render_js` | 外部网页深度抓取与 JS 渲染提取 |
| 9 | `general_search` | 78 | `query`, `search_type` | 全网通用信息与研报检索 |
| 10 | `send_message` | 70 | `target_agent_id`, `message` | **智能体间点对点通信消息原语** |
| 11 | `TodoWrite` | 70 | `todos`, `status` | 智能体个人待办项（Checklist）动态维护 |
| 12 | `task_create` | 52 | `task_name`, `assignee` | 向全局 `board.md` 任务板追加新任务项 |
| 13 | `task_update` | 43 | `task_id`, `status`, `artifact_url` | 动态流转 `board.md` 任务状态（`running` → `completed`） |
| 14 | `Wait` | 33 | `duration_seconds` | 异步状态机主动让出与时间等待 |
| 15 | `Glob` | 31 | `pattern`, `path` | 文件系统通配符遍历 |
| 16 | `Grep` | 22 | `pattern`, `path` | 跨文件内容正则检索 |
| 17 | `present_files` | 13 | `file_paths` | 向桌面 UI 交付产物卡片供用户预览下载 |
| 18 | `Bash` | 10 | `command` | POSIX 兼容环境终端执行 |
| 19 | `manage_preference`| 6 | `action`, `preference_key`, `value` | **跨会话用户偏好与长期记忆存取** |
| 20 | `computer_use_tool`| 6 | `action`, `coordinate`, `text` | 电脑操作与 GUI 界面多模态模拟点击 |

---

### 1.5 会话外关键机制：任务板、记忆与后台任务队列

豆包在文件系统层面实现了高内聚的解耦设计：

1. **共享任务看板 `board.md` (71 个)**：
   - 格式：标准 Markdown 表格，字段包括 `任务ID`、`标题`、`Organizer`、`状态`、`产物路径`、`产物链接`。
   - 机制：由 Organizer 智能体通过 `task_create` 初始化，执行子智能体完工后通过 `task_update` 填入真实落盘文件路径与链接，各智能体均通过读取 `board.md` 达成任务共识。
2. **混合记忆库与偏好持久化**：
   - 会话级包含 `memory/MEMORY.md`；
   - 普查在 `system/tool-results/search_memory_*.txt` 中确证其具备 `mode=hybrid` 混合搜索模式（`[任务记录-task_history] 共 5 条结果 (mode=hybrid)`），支持关键词倒排与向量混合召回前序任务经验；
   - 模型通过 `manage_preference` 工具显式固化跨会话长期记忆。
3. **后台任务管理队列 (`background_history_task`)**：
   - 在 8 个具有超长执行历史的会话中，发现独立的任务队列目录；
   - 包含文件锁 `.history.lock`、任务清单 `index.json`（记录每个后台命令如 `Invoke-WebRequest`、`run_mineru.ps1` 及其发起时间）与独立输出池 `outputs/<uuid>.output`，防止前台界面挂起。
4. **两套独立持久化存储分立**：
   - **普通聊天模式**：存储在 Chromium LevelDB（`saman_shell_db_storage` 与 `saman_shell_persistent_storage_v1`），以 `.ldb` 二进制块存放；
   - **智能体工作模式**：完全由 `.doubao/agent_mode/workspace/` 目录下的纯文件系统（Markdown + JSONL）驱动，无进程级文件独占锁，天然具备零损耗离线可观测性。

---

## 二、经验

1. **“文件系统即总线”的多智能体编排设计极为健壮**：
   - 豆包智能体模式没有采用复杂的内存 RPC 管道，而是将智能体树（`m_`, `o_`, `s_`）、任务板（`board.md`）、任务说明（`assignment.md`）、通信（`socket/`）和轨迹（`trajectory.jsonl`）全部平铺为本地标准文件。这种设计使得外部适配器与观察台在**不触碰进程、不抢占前台窗口**的情况下即可实现 100% 状态还原与离线审计。
2. **工具大输出溢出隔离是防止长程任务崩溃的关键**：
   - 普查发现 61 个 `system/tool-results/*.txt` 文件，当 PowerShell 或爬虫抓取回成百上千行的长内容时，Harness 将全量文本写入该目录，仅在轨迹中保留摘要或局部切片。这防止了智能体单次工具调用吞噬整屏上下文。
3. **前缀 ID 编码角色拓扑是最高效的血缘管理**：
   - 通过 `m_`（Main）、`o_`（Organizer）、`s_`（Subagent）的前缀命名规范，不仅人类在排查目录时一目了然，智能体在相互发送消息（`send_message`）与等待（`wait_agent`）时也能直接通过 ID 判定对方角色权限，规避了循环代理死锁。
4. **双实例冲突防范**：
   - 尽管本地文件系统是无锁的，但运行中的豆包进程会通过 C++ 组件与云端 SSE 保持长连接；外部绝对不要启动同账号的第二后台实例去抢占登录态（曾导致前台报 `sandbox_environment_not_ready`），而应采用纯静态文件扫描或免抢占只读 CDP 接入。

---

## 三、还没解决的（留待以后抓包与动态逆向）

1. **System Prompt 的静态注入源头**：
   - `assignment.md` 中记录的是用户输入与高阶任务说明，而模型实际接收到的“你是一个拥有以下工具的智能体...”等底座 System Prompt 位于打包资源文件或云端下发中。
2. **LevelDB 普通聊天记录的纯离线解析工具链**：
   - 智能体模式的数据已 100% 攻克，但普通模式的 `saman_shell_db_storage` 仍为 Snappy 压缩的 LevelDB，需要独立编写 LevelDB 只读提取脚本以覆盖普通聊天的历史数据。
3. **`socket/findings.jsonl` 与 `briefing.md` 的动态触发条件**：
   - 普查发现大部分会话的 `socket/` 目录为空，仅在极其复杂的特定跨会话协同场景才会激活；需进一步构造复杂多节点任务探测该通道的触发临界点。

---

## 四、出处与证据

1. **黑板实测证据行（`channels/probe/blackboard.jsonl`，经 `bb find` 核实）**：
   - **行 2384**：`doubao/harness-census` pass `doubao/L0/agent_mode_workspace`（全量扫描本机豆包智能体模式工作区 71 个会话目录与 299 个智能体节点、289 个轨迹文件与 4,651 行记录、71 个 board.md 看板、72 个 memory 与 8 个后台任务队列）
2. **普查执行脚本**：
   - [census_doubao.mjs](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/channels/probe/scripts/harness/census_doubao.mjs)
3. **全量普查机器可读数据**：
   - [doubao-census.json](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/channels/research/harness/doubao-census.json)
4. **本机文件系统证据**：
   - 智能体工作区根目录：`C:\Users\COLORFIRE\AppData\Local\Doubao\User Data\Default\.doubao\agent_mode\workspace\.sessions\`
   - 技能库：`.doubao\agent_mode\workspace\.skills\`
   - 后台任务队列：`.doubao\agent_mode\workspace\conversation\`
5. **适配器源码参考**：
   - [trace/packages/adapters/src/doubao/index.ts:1-118](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/trace/packages/adapters/src/doubao/index.ts#L1-L118)：官方适配器解析实现
   - [doubao-desktop.md:1-78](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/channels/hosts/doubao-desktop.md#L1-L78)：豆包宿主档案卡
