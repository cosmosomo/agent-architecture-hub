# 会话考古：Google Antigravity Harness 全量普查与架构还原

> **产品**：Google Antigravity (AGY 2.0 / Connect-RPC + Cortex Planner + Subagent System)  
> **研究员**：Argon（Antigravity pro）· 固化会话 `research-frontier`  
> **普查时间**：2026-10-20  
> **普查工具**：`channels/probe/scripts/harness/census_antigravity.mjs`（全量无抽样，可复跑核验）  
> **机器可读数据**：`channels/research/harness/antigravity-census.json`  

---

## 一、关键信息

### 1.1 全量普查总账与数字（可复跑核验）

基于对本机 `~/.gemini/antigravity/` 的无抽样全量扫描，共普查 **342 个 Brain 目录**、**324 个活跃转录文件**（共计 **79,675 行转录记录**）、**341 行全局数据库索引**及 **347 个单会话 SQLite 数据库**：

| 指标维度 | 普查数量 | 物理落盘位置 | 统计含义 |
|---|---|---|---|
| **会话目录总数** | 342 | `~/.gemini/antigravity/brain/<cid>/` | 本机创建过的全部会话物理容器 |
| **转录轨迹文件** | 324 | `brain/<cid>/.system_generated/logs/transcript.jsonl` | 具备结构化逐步增量落盘日志的会话 |
| **转录总记录行数** | 79,675 | `transcript.jsonl` | 模型交互、系统事件、工具调用全生命周期记录 |
| **全局会话索引库** | 341 行 | `~/.gemini/antigravity/conversation_summaries.db` | 全局状态、未空闲标记、FTS5 全文搜索索引 |
| **单会话独立数据库** | 347 个 | `~/.gemini/antigravity/conversations/<cid>.db` | 包含每步 step 详情与 token/延迟元数据 |
| **消息信封文件** | 5,081 个 | `brain/<cid>/.system_generated/messages/<mid>.json` | 智能体间消息、系统高优先级通知与派活单 |
| **步骤输出溢出目录** | 21,538 个 | `brain/<cid>/.system_generated/steps/<step>/output.txt` | 工具输出超过内联阈值时的大文本溢出落盘 |
| **后台任务日志文件** | 3,461 个 | `brain/<cid>/.system_generated/tasks/task-<id>.log` | 长命令后台运行时的 stdout/stderr 物理流 |
| **子智能体登记文件** | 113 个 | `brain/<cid>/.system_generated/subagents/<cid>.json` | 子智能体类型、角色与存活状态登记 |
| **压缩检查点 (Checkpoint)** | 394 次 | `transcript.jsonl` (type: `CHECKPOINT`) | 上下文超限触发 Compaction 后的记忆断点 |
| **跨会话历史召回记录** | 3 次 | `transcript.jsonl` (type: `CONVERSATION_HISTORY`) | 会话启动时跨会话记忆主动注入 |

---

### 1.2 记录种类、字段清单与 Harness 时机映射

在 79,675 行转录中，Antigravity 共有 **13 种记录类型（`type`）** 与 **3 种来源（`source`）**。其中现代架构以 `PLANNER_RESPONSE`（33,689 次）与 `GENERIC`（38,236 次）为主轴，早期版本曾有专用工具记录类型（`RUN_COMMAND`、`VIEW_FILE` 等）：

#### 1. 转录记录类型全景分布表

| 记录类型 (`type`) | 发生频次 | 主要来源 (`source`) | 核心字段 (`fields`) | 属于 Harness 哪个部分 | 注入时机与时序逻辑 |
|---|---|---|---|---|---|
| `PLANNER_RESPONSE` | 33,689 | `MODEL` (100%) | `step_index`, `content`, `thinking`, `tool_calls`, `input_tokens`, `output_tokens`, `cache_read_tokens`, `status`, `created_at` | **组织 (思考规划) + 工具调用 + 可观测** | 模型单步生成完成时。包含 CoT 思维链（`thinking`）、发起的工具调用契约，以及本步 Token 精确用量。 |
| `GENERIC` | 38,236 | `MODEL` (100%) | `step_index`, `content`, `status`, `created_at`, `error`, `truncated_fields` | **工具系统 (工具返回与执行结果)** | 紧随 `PLANNER_RESPONSE` 工具调用后，由本地执行引擎回填工具输出。状态为 `DONE`、`ERROR` 或 `RUNNING`（转后台）。 |
| `SYSTEM_MESSAGE` | 4,196 | `SYSTEM` (100%) | `step_index`, `content`, `status`, `created_at` | **组织 (反应式事件总线) + 上下文装配** | ① 外部 `agentapi send-message` 注入；② 后台 `task-N` 执行完毕唤醒；③ 定时器 `schedule` 到期；④ 子智能体完成通知。 |
| `ERROR_MESSAGE` | 1,695 | `SYSTEM` (100%) | `step_index`, `content`, `error`, `status`, `created_at` | **可观测 (异常流与重试)** | 底层模型调用断流（如 `The stream was interrupted`）、网络超时或认证失败时注入，附带重试指数折叠。 |
| `USER_INPUT` | 1,330 | `USER_EXPLICIT` (100%) | `step_index`, `content`, `status`, `created_at` | **上下文装配 (用户主提示词)** | 用户在界面或终端显式发送的首轮或中途交互提示词。 |
| `CHECKPOINT` | 394 | `SYSTEM` (100%) | `step_index`, `content`, `status`, `created_at`, `truncated_fields` | **预算与压缩 (Compaction 记忆收缩)** | 当会话历史接近上下文窗口阈值（~150k-200k tokens）时触发，清空历史原始细节，回填包含用户请求队列、阶段成果与产物的结构化摘要。 |
| `RUN_COMMAND` | 56 | `MODEL` (100%) | `step_index`, `command_line`, `content`, `status` | **工具系统 (早期命令调用)** | 早期 Antigravity 版本的专用命令执行记录，现已被 `PLANNER_RESPONSE` + `GENERIC` 取代。 |
| `VIEW_FILE` | 39 | `MODEL` (100%) | `step_index`, `file_path`, `content`, `status` | **工具系统 (早期读文件)** | 早期专用读文件记录，现已统一抽象为工具。 |
| `CODE_ACTION` | 27 | `MODEL` (100%) | `step_index`, `content`, `status` | **工具系统 (早期代码操作)** | 早期编辑代码的独立动作类型。 |
| `LIST_DIRECTORY` | 8 | `MODEL` (100%) | `step_index`, `path`, `content`, `status` | **工具系统 (早期列目录)** | 早期列目录操作。 |
| `CONVERSATION_HISTORY` | 3 | `SYSTEM` (100%) | `step_index`, `content`, `status`, `created_at` | **记忆与持久化 (跨会话冷历史召回)** | 新会话初始化首步，由 Harness 从 `conversation_summaries.db` 提取前序会话的标题、目标与决策链概要并注入。 |
| `SEARCH_WEB` / `READ_URL_CONTENT` | 各 1 | `MODEL` (100%) | `step_index`, `query`, `url`, `content` | **工具系统 (早期网络检索)** | 早期原生网页抓取记录。 |

---

### 1.3 核心记录样本与脱敏剖析

#### 样本 1：压缩检查点 (`CHECKPOINT` · 预算与压缩核心机制)
- **时机**：上下文膨胀至触发水位，Harness 启动 Compaction，将前序多轮历史压缩为单条摘要：
```json
{
  "step_index": 65,
  "source": "SYSTEM",
  "type": "CHECKPOINT",
  "status": "DONE",
  "created_at": "2026-10-19T18:30:16Z",
  "truncated_fields": ["content"],
  "content": "# Resuming from a compaction\n\nYou are continuing work on the task described above, but you have lost access to the full conversation history, and need to resume work efficiently using the progress summary below:\n\n# User Requests\nThe following were user requests from the truncated conversation in chronological order:\n1. [用户历史第一阶段原始诉求...]\n2. [用户历史第二阶段追问...]\n\n# Previous Session Summary:\n<summary>\n### 1. Task Overview\n### 2. Progress\n### 3. Key Findings & Decisions\n### 4. Active Context\n### 5. Next Steps\n### 6. Commitments & Constraints\n</summary>\n\nYou have the 1 following artifacts written to the artifacts directory:\n[ARTIFACT: media_...]\n\n# Conversation Logs\nStart with the compact transcript; if a step has truncated_fields, read only that specific line in transcript_full.jsonl"
}
```
> **考古发现**：Antigravity 的 Compaction 绝非简单的丢弃，而是**结构化再生**：保留全部用户请求列表（确保目标不偏移）＋ 六段式进度摘要 ＋ 产物快照索引 ＋ 文件指针回填。

#### 样本 2：跨会话历史召回 (`CONVERSATION_HISTORY` · 跨会话长期记忆)
- **时机**：新会话创建时的第 1 步注入：
```json
{
  "step_index": 1,
  "source": "SYSTEM",
  "type": "CONVERSATION_HISTORY",
  "status": "DONE",
  "created_at": "2026-08-15T12:15:38Z",
  "content": "# Conversation History\nHere are the conversation IDs, titles, and summaries of your most recent 1 conversations, in reverse chronological order:\n\n<conversation_summaries>\n## Conversation 8a2a9f46-...: Refactoring and Cleanup\n- Created: 2025-12-31T02:59:33Z\n- Last modified: 2025-12-31T22:32:11Z\n\n### USER Objective:\n[前序会话的目标结构化解析与提取...]\n</conversation_summaries>"
}
```

#### 样本 3：子智能体登记 (`subagents/<cid>.json` · 组织与生命周期)
- **时机**：父智能体调用 `invoke_subagent` 时，Harness 在磁盘落盘原子状态机：
```json
{
  "conversationId": "9f1007d4-f46a-49b8-98e5-87fb51be5849",
  "subagentDescriptor": {
    "typeName": "self",
    "role": "Independent Reviewer"
  },
  "state": "SUBAGENT_STATE_ALIVE",
  "spawnStepIndex": 114
}
```
> **普查统计**：全机共 113 个子智能体登记，存活态 `ALIVE` 53 个，终止态 `KILLED` 60 个；类型包含 `self`（68 个，继承父级全工具）、`research`（44 个，只读检索）、`probe_instructions_verifier`（1 个，专有校验）。

#### 样本 4：消息信封与事件总线 (`messages/<mid>.json` · 跨会话/后台唤醒)
- **时机**：任务完成、定时器触发或外部网关派发时：
```json
{
  "id": "9e41390e-56e9-46f6-b4e5-87ff1a772841",
  "recipient": "00097d15-73ea-4a5c-bf07-674140053c0b",
  "sender": "8ac99608-1992-40f9-9ce0-4acedd088db7",
  "priority": "MESSAGE_PRIORITY_HIGH",
  "timestamp": "2026-10-17T16:59:12.451220500Z",
  "renderDetails": {
    "messageTitle": "Message from Parent Agent"
  },
  "content": "[协同数据载荷...]"
}
```
> **普查统计**：全机 5,081 个消息中，`MESSAGE_PRIORITY_HIGH` 占 4,272 个（84%），绝大多数为后台任务完成通知（如 `Execute full PPTX build finished`、`cron trigger`）与父子智能体协作（`Message from Parent Agent`、`Message from External Agent`）。

---

### 1.4 工具系统调用全景与频率排行（Top 15）

在 33,689 次模型响应中，共触发工具调用 **38,000+ 次**，呈现出显著的代码驱动与任务管线特征：

| 排名 | 工具名称 (`name`) | 调用频次 | 典型入参 (`arguments`) | 归属 Harness 职能 |
|---|---|---|---|---|
| 1 | `view_file` | 16,092 | `filePath`, `startLine`, `endLine` | 文件只读精准检索（分块阅读） |
| 2 | `run_command` | 12,648 | `CommandLine`, `WaitMsBeforeAsync`, `toolSummary` | 终端执行与后台化控制 |
| 3 | `manage_task` | 2,442 | `Action`, `TaskId`, `Input` | 异步后台任务生命周期管控（状态轮询与输入投递） |
| 4 | `write_to_file` | 2,244 | `filePath`, `content` | 产物与代码全量持久化写入 |
| 5 | `replace_file_content` | 2,149 | `filePath`, `oldStr`, `newStr` | 确定性精确差分补丁编辑 |
| 6 | `read_file` | 545 | `Path`, `StartLine`, `EndLine`, `ByteOffset` | 规范化文件读取（含字节偏移） |
| 7 | `schedule` | 405 | `CronExpression`, `DurationSeconds`, `Prompt` | 响应式定时器与后台 Cron 任务注册 |
| 8 | `search_web` | 389 | `query`, `domain` | 开放互联网检索 |
| 9 | `list_dir` | 299 | `dirPath`, `recursive`, `depth` | 文件系统树枚举 |
| 10 | `send_message` | 209 | `Recipient`, `Message` | 智能体点对点消息投递（协同中枢） |
| 11 | `grep_search` | 175 | `query`, `path`, `caseSensitive` | 代码文本正则搜索 |
| 12 | `read_url_content` | 156 | `url` | 网页抓取与正文净化提取 |
| 13 | `manage_subagents` | 150 | `Action`, `ConversationIds` | 子智能体集群批量列出或清理 |
| 14 | `find_by_name` | 145 | `fileName`, `dirPath` | 文件名索引搜索 |
| 15 | `write_file` | 139 | `Path`, `Content`, `ArtifactMetadata` | 结构化 Artifact 快照发布 |

---

### 1.5 会话外相关落盘数据库与全局状态

Antigravity 的 Harness 在会话目录之外，维护了完整的 SQLite 关系数据库与 FTS5 索引体系：

1. **全局数据库 `conversation_summaries.db` (341 行)**：
   - `conversation_summaries` 主表：维护全局 21 个字段，核心包括 `status`（338 个 `CASCADE_RUN_STATUS_IDLE`，3 个 `RUNNING`）、`not_fully_idle`（空闲判据）、`nesting_depth`（嵌套深度分布：0 级 228 个，1 级 111 个，2 级 2 个）、`parent_conversation_id`（树状协同血缘）、`workspace_uris`、`step_count`。
   - `conversations_fts` 虚表（868 行分块）：按 100 步一个 chunk 对 `user_body` 与 `agent_body` 建立全文倒排索引，包含 `user_step_byte_offsets` 与 `agent_step_byte_offsets` 字节级定位。
2. **单会话私有数据库 `conversations/<cid>.db` (347 个文件)**：
   - 每个会话配备独立的 SQLite 数据库，包含 7 张内部表：
     - `trajectory_meta`：级联类型与源标识；
     - `steps`：记录每步的 `step_type`、`permissions`、`render_info`、`step_payload`；
     - `gen_metadata`：记录模型推理延迟、精确 token 分布及序列化二进制 blob；
     - `executor_metadata`、`parent_references`、`battle_mode_infos`。
3. **活跃会话排他锁 `presence/<cid>.lock`**：
   - 进程级别的互斥文件锁，防止多个 LS 实例同时写入同一会话。

---

## 二、经验

1. **Compaction 是两段式落盘与文件指针引用的典范**：
   - Antigravity 处理超长上下文并非简单粗暴的截断，而是通过生成 `CHECKPOINT` 记录，将用户所有历史输入保留为列表（防止任务目标漂移），中间过程收拢为带 Mermaid 图与状态标定的 Summary，同时生成指针告知模型：“完整上下文仍在 `transcript_full.jsonl` 中，可通过查看文件特定行召回细节”。这种将**上下文压缩与文件存储体系联动**的机制是极高阶的 Harness 设计。
2. **三态判据解决了异步长任务的空闲假象**：
   - 单纯看 `transcript.jsonl` 中最新步为 `PLANNER_RESPONSE status=DONE` 容易误判会话已结束。实际中智能体常调用 `run_command` 将长命令置入后台（生成 `task-N`），此时回复一句“正在后台执行”，若仅看 transcript 会误以为结束。Harness 在 `conversation_summaries.db` 中引入 `not_fully_idle=1` 字段，只有当无活跃后台任务且无未消费定时器时才置为 `0`，彻底解决了分布式调度的判空难题。
3. **大工具输出溢出机制保障了转录轻量性**：
   - 当终端命令输出或文件读取超过 32KB 时，Harness 会在转录中打标 `truncated_fields: ["content"]`，并将原始输出写入 `.system_generated/steps/<step>/output.txt`。全机普查发现该目录存在 **21,538 个** 溢出目录，避免了单一 `transcript.jsonl` 快速膨胀导致的内存崩溃。
4. **反应式唤醒彻底摒弃了死循环轮询**：
   - 全机 5,081 个消息信封和 3,461 个任务日志表明，Antigravity 的事件驱动完全由语言服务内部的 EventBus 承载。模型交出控制权后进程进入挂起状态（0-CPU/0-Token），任务完成时由系统注入带优先级的 `SYSTEM_MESSAGE` 唤醒模型，保证了多任务自治的高效性。

---

## 三、还没解决的（留待以后抓包与源码分析）

1. **首轮完整 System Prompt 与 Tools Schema 的内存级合成**：
   - 现象：在 `transcript.jsonl` 中，会话第 1 步通常直接是 `USER_INPUT`，而包含了庞大角色定义、内置工具规范与环境约定的 System Prompt 并未作为显式行落盘。
   - 推测：System Prompt 是在 Go 语言服务调用模型 API（Connect-RPC / Gemini API）时，由 `system_instruction` 模板在内存中动态组装并附加在请求体前部，并未持久化在 transcript 中。
   - 验证手段：需在语言服务发出的 HTTP/Connect-RPC 请求层抓包（如通过反向代理），截获未经剪裁的原始 Wire-level payload。
2. **`ask_question` 前端交互流解挂协议**：
   - 现象：`act-request` 单元中，无头调用 `HandleCascadeUserInteraction` 报错 500 `input not registered for step 2`。
   - 推测：桌面端在渲染选择题卡片时，不仅更新了状态，还在本地内存注册了交互流客户端监听器；无头环境缺乏该握手流。
3. **早期专有动作到现代统一 Tool Call 的版本演进拐点**：
   - 普查发现了 56 条 `RUN_COMMAND`、39 条 `VIEW_FILE` 等早期专用记录。需比对历史版本更新日志，标定由硬编码 Step 迁移至通用 Cortex Tool Call 的精确架构代际。

---

## 四、出处与证据

1. **黑板实测证据行（`channels/probe/blackboard.jsonl`，经 `bb find` 核实）**：
   - **行 2383**：`antigravity/harness-census` pass `antigravity/L0/brain+summaries`（全量扫描本机 Antigravity 342 个 Brain 会话目录与 324 个转录文件，共普查 79,675 行记录、113 个子智能体、3,461 个后台任务、5,081 个消息信封与 21,538 个步骤溢出目录）
2. **普查执行脚本**：
   - [census_antigravity.mjs](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/channels/probe/scripts/harness/census_antigravity.mjs)
3. **全量普查机器可读数据**：
   - [antigravity-census.json](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/channels/research/harness/antigravity-census.json)
4. **本机文件系统证据**：
   - 会话容器：`C:\Users\COLORFIRE\.gemini\antigravity\brain\`
   - 全局索引：`C:\Users\COLORFIRE\.gemini\antigravity\conversation_summaries.db`
   - 私有数据库：`C:\Users\COLORFIRE\.gemini\antigravity\conversations\`
5. **解析器源码与契约定义**：
   - [antigravity.ts:35-98](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/trace/apps/cli/src/gateway/antigravity.ts#L35-L98)：转录解析器地面真值
   - [products.ts](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/trace/apps/cli/src/gateway/products.ts)：渠道环境配置与模型代号映射
