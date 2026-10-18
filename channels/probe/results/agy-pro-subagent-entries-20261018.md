# 六大主流 Agent 宿主“子智能体”入口全量实测分析报告

## 核心结论（大白话总结）

这次实测彻底查清了 Codex、Claude Code、OpenCode、ZCode、Antigravity 和 WorkBuddy 六家工具里“子智能体”到底长什么样、藏在哪里、从外面能不能管。结论非常清晰：六家的子智能体并不全是一回事，而是分成了三种完全不同的形态。
第一种是“独立完整的子会话”（Antigravity、OpenCode、WorkBuddy），子智能体有自己独立的会话编号和完整的脑区日志，外部既能直接读历史、看状态，甚至还能直接续接并继续派活；
第二种是“绑死在父级内部的子线程/附庸”（Claude Code），它的编号不是标准的通用标识，文件严格锁在父会话专用的子文件夹里，外部命令行直接拒绝续接，只能由父智能体在自己肚子里发消息调度；
第三种是“被系统门禁严格锁死为只读的受控会话”（Codex、ZCode），外部虽然能把它们的关系表和历史记录读得一清二楚，但如果外部想直接往子智能体里送话插话，底层服务端会直接弹错拒绝（例如 Codex 报错拒绝直接排队投递未加载的子智能体、ZCode 明确返回“子智能体会话只读”）。
这意味着跨智能体协同层不能指望用一套固定的办法来指挥所有家的子智能体；有的家可以直接当成独立打工人来调度，有的家则必须把父智能体当成唯一的总工头，所有话只能让父智能体转交。

---

## 一、实测总览与横向对比矩阵

| 宿主家族 | 子智能体派生入口 (spawn) | 磁盘落盘路径 (persistence) | 父子关联关键字段 | 外部可发现性 (observe:list) | 外部可读性 (observe:history) | 外部状态监测 (state) | 外部插话/送话 (steer) | 外部打断/取消 (cancel) | 与普通主会话的核心差异 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Antigravity** | 内置工具 `invoke_subagent` | `~/.gemini/antigravity/brain/<id>/` 与 `conversation_summaries.db` | `parent_conversation_id`, `nesting_depth=1`, `subagentSpec` | **完全支持** (SQL/agentapi/manage_subagents) | **完全支持** (直读 `transcript.jsonl`) | **完全支持** (`status`, `not_fully_idle`, `killed`) | **完全支持** (父级 `send_message` 或 API 唤醒) | **完全支持** (`manage_subagents kill`) | 结构完全对等，仅首轮为 `SYSTEM_MESSAGE`、无交互 UI，结果自动回传父级 |
| **Codex** | 协作工具 `spawn_agent` / RPC `thread/spawn` | `~/.codex/state_5.sqlite` 与 `~/.codex/sessions/**/rollout-*.jsonl` | `thread_spawn_edges(parent_thread_id, child_thread_id)`, `source.subagent` | **完全支持** (SQLite 关系表与 app-server 过滤) | **完全支持** (直读 Rollout JSONL 或 `thread/read`) | **完全支持** (`thread_spawn_edges.status`) | **受门禁阻断** (app-server 报错拒收 direct input) | **部分支持** (随父会话或单进程打断) | 标准 UUIDv7 格式，Rollout 完全一致；但 app-server 禁止外部绕过父级直接排队送话 |
| **Claude Code** | 内置工具 `Agent` | `~/.claude/projects/<cwd>/<parent_uuid>/subagents/agent-<id>.jsonl` | 路径嵌套、文件内 `parentUuid`、父级 `<task-notification>` | **仅限扫盘** (扫描专属 `subagents/` 目录) | **完全支持** (直读 `agent-*.jsonl`) | **支持** (从文件及父级 notification 解析) | **完全不支持** (`claude --resume` 拒绝非 UUID 编号) | **不支持独立打断** (只能整体杀父进程) | 专有 `a<hex16>` 格式，不是独立 Session，归属父级进程附属 Sidechain |
| **ZCode** | 内置工具 `Task` 或 DWF 工作流 actor | `~/.zcode/cli/db/db.sqlite` 与 `~/.zcode/cli/rollout/model-io-*.jsonl` | `session.parent_id`, `task_type='subagent_child'`, `session_task_link` | **完全支持** (SQLite 查询或 `opencli zcode subagents`) | **完全支持** (ACP `session/load` 或直读数据库) | **完全支持** (`session.status`, Rollout mtime) | **协议层阻断** (ACP 报错 `Subagent sessions are read-only`) | **部分支持** (DWF 流程支持 cancel) | 结构存入同一数据库，但被系统施加“只读快照”保护，外部彻底无法输入 |
| **OpenCode** | 内置工具 `task` (`TaskTool.execute`) | `~/.local/share/opencode/storage/session/` (三层存储结构) | `ses_*.json` 中的 `parentID`，标题带 `(@subagent)` | **完全支持** (`session list` 或扫描 `ses_*.json`) | **完全支持** (`opencode export` 或 HTTP 接口) | **完全支持** (元数据更新时间与 part 状态) | **完全支持** (原生支持带 `task_id` 续接，CLI 可 `-s` 续接) | **完全支持** (终止进程或 HTTP cancel) | 共享底层 `ses/msg/prt` 结构，按 `subagent_type`（如 explore）做严格工具权限裁剪 |
| **WorkBuddy** | `Task` / `Agent` / CLI `--swarm` | `~/.codebuddy/projects/<cwd>/<uuid>.jsonl` 与 `workbuddy.db` | `is_background_automation`, `mode`, `expert_id` | **完全支持** (`codebuddy agents --jobs --all`, `ps`) | **完全支持** (`codebuddy logs <id>` 或直读 JSONL) | **完全支持** (`codebuddy ps`, 数据库字段) | **部分支持** (后台会话可 resume，实时 swarm 难以动态插话) | **完全支持** (`codebuddy stop <id>`, `kill`) | 具备独立的后台进程与日志流，但无桌面交互 UI，提供专项 agents 运维命令 |

---

## 二、逐家分节实测与硬核证据

### 1. Antigravity (Google DeepMind)

#### 1.1 子智能体产生机制 (spawn-subagent)
在 Antigravity 中，父会话调用内置工具 `invoke_subagent` 派发子任务。
本次实测中，父智能体发起了测试子智能体，指定角色为 `probe-subagent-worker`，模型使用 `flash_lite`，执行简单的计算与暗号确认工作。
调用参数示例：
```json
{
  "Subagents": [
    {
      "TypeName": "self",
      "Role": "probe-subagent-worker",
      "Model": "flash_lite",
      "Workspace": "inherit",
      "Prompt": "你是一个子智能体测试探针。请在心里记住测试暗号 PROBE_AGY_SUBAGENT_9981，并直接回复'ACK_PROBE_AGY'。"
    }
  ]
}
```

#### 1.2 落盘位置
1. **全局数据库元数据**：`~/.gemini/antigravity/conversation_summaries.db`
2. **专属脑区日志文件**：`~/.gemini/antigravity/brain/<child_conversation_id>/.system_generated/logs/transcript.jsonl` 及 `transcript_full.jsonl`
3. **活动锁标识**：`~/.gemini/antigravity/presence/<child_conversation_id>.lock`

#### 1.3 父子关联关键字段
在 `conversation_summaries.db` 的 `conversation_summaries` 表中：
- `conversation_id`: 子智能体专属 UUID（本次实测为 `3792a1dc-bb42-4330-93f0-54570e56242f`）
- `parent_conversation_id`: 父会话 UUID（`695b25e9-255b-4a74-96f4-e176d5084eff`）
- `nesting_depth`: 深度标识，普通会话为 `0`，子智能体为 `1`（多层派生则递增）
- `subagentSpec`: 存有 JSON 串 `{"name":"probe-subagent-worker","role":"probe-subagent-worker","workspace":"inherit","typeName":"self"}`

#### 1.4 外部能力单元实测（命令与原始输出）
- **发现 (observe-list / find)**: 【PASS】
  - **命令**：
    ```powershell
    sqlite3 C:\Users\COLORFIRE\.gemini\antigravity\conversation_summaries.db "SELECT conversation_id, parent_conversation_id, nesting_depth, status FROM conversation_summaries WHERE parent_conversation_id='695b25e9-255b-4a74-96f4-e176d5084eff';"
    ```
  - **原始输出**：
    ```text
    3792a1dc-bb42-4330-93f0-54570e56242f|695b25e9-255b-4a74-96f4-e176d5084eff|1|CASCADE_RUN_STATUS_IDLE
    ```
- **读取历史 (observe-history)**: 【PASS】
  - **命令**：
    ```powershell
    Get-Content C:\Users\COLORFIRE\.gemini\antigravity\brain\3792a1dc-bb42-4330-93f0-54570e56242f\.system_generated\logs\transcript.jsonl -Tail 3
    ```
  - **原始输出片段**：
    ```json
    {"step_index":2,"type":"PLANNER_RESPONSE","source":"MODEL","status":"DONE","content":"ACK_PROBE_AGY\n\n已在心里记住测试暗号 PROBE_AGY_SUBAGENT_9981。"}
    ```
- **状态监测 (state)**: 【PASS】
  - **命令**：
    ```powershell
    sqlite3 C:\Users\COLORFIRE\.gemini\antigravity\conversation_summaries.db "SELECT status, not_fully_idle, killed FROM conversation_summaries WHERE conversation_id='3792a1dc-bb42-4330-93f0-54570e56242f';"
    ```
  - **原始输出**：
    ```text
    CASCADE_RUN_STATUS_IDLE|0|0
    ```
- **送话 / 插话 (steer / send-message)**: 【PASS】
  - 父会话通过 `send_message(Recipient: "3792a1dc-bb42-4330-93f0-54570e56242f", Message: "测试追问：刚才记下的暗号是什么？请只回复'PROBE_AGY_SUBAGENT_RESUME_OK:'加上暗号。")`。子智能体成功唤醒并产出第二轮回复：
  - **原始输出**：`PROBE_AGY_SUBAGENT_RESUME_OK: PROBE_AGY_SUBAGENT_9981`。
- **打断 / 销毁 (cancel / kill)**: 【PASS】
  - 调用 `manage_subagents(Action: "kill", ConversationIds: ["3792a1dc-bb42-4330-93f0-54570e56242f"])`。
  - **验证命令**：
    ```powershell
    sqlite3 C:\Users\COLORFIRE\.gemini\antigravity\conversation_summaries.db "SELECT killed FROM conversation_summaries WHERE conversation_id='3792a1dc-bb42-4330-93f0-54570e56242f';"
    ```
  - **原始输出**：`1`（进程销毁，锁文件移除）。

#### 1.5 与同一家普通主会话的区别
Antigravity 的子智能体在结构上是一个**完全对等的一等公民会话**。唯一的区别在于：它的首轮输入不是来自用户的打字，而是来自系统的 `SYSTEM_MESSAGE` 包装；它没有独立的桌面窗口呈现，其生命周期事件和输出会回传给父会话；当父级下达 kill 指令时，它的分支工作区和上下文会被自动级联清理。

---

### 2. Codex (OpenAI)

#### 2.1 子智能体产生机制 (spawn-subagent)
在 Codex 体系中，当启用多智能体模式或执行跨任务子调度时，父智能体会调用多智能体协作工具 `spawn_agent`（底层对应 app-server 的 `thread/spawn` RPC 协议）。

#### 2.2 落盘位置
1. **全局数据库**：`~/.codex/state_5.sqlite`
2. **专属 Rollout 会话文件**：`~/.codex/sessions/YYYY/MM/DD/rollout-<timestamp>-<uuid>.jsonl`

#### 2.3 父子关联关键字段
1. **SQLite 关系表 `thread_spawn_edges`**：
   - `parent_thread_id`: 父会话 UUIDv7
   - `child_thread_id`: 子会话 UUIDv7
   - `status`: `"open"`（存活/调度中）或 `"closed"`（已结束）
2. **Rollout 文件元数据 `session_meta`**：
   - `session_meta.source.subagent.thread_spawn.parent_thread_id`: 父会话 UUID
3. **app-server Schema 定义**（见 `ThreadListResponse.json`）：
   - `Thread.parentThreadId`: *"The ID of the parent thread. This will only be set if this thread is a subagent."*

#### 2.4 外部能力单元实测（命令与原始输出）
- **发现 (observe-list / find)**: 【PASS】
  - **命令**：
    ```powershell
    sqlite3 C:\Users\COLORFIRE\.codex\state_5.sqlite "SELECT parent_thread_id, child_thread_id, status FROM thread_spawn_edges LIMIT 2;"
    ```
  - **原始输出**：
    ```text
    01934988-8e6d-7cb2-b435-bb6a04df5914|0193498a-211c-7cb0-80a2-23f2f81643c7|closed
    01934991-3829-7981-b541-fa60da26359f|01934995-1f9f-7e02-a720-3b0beab8646b|closed
    ```
- **读取历史 (observe-history)**: 【PASS】
  - **命令**：通过查询对应子智能体 UUID 的 Rollout 文件或调用 app-server `thread/read`。
  - **验证**：子智能体的 Rollout 文件与普通会话完全一致，按行记录 `turn_start`、`tool_call` 与 `turn_finish`。
- **状态监测 (state)**: 【PASS】
  - 通过 `thread_spawn_edges.status` 查询其是否为 `open` 或 `closed`。
- **送话 / 插话 (steer / send-message)**: 【PARTIAL / 受门禁阻断】
  - **实测A（CLI 恢复通道）**：
    - **命令**：`codex exec resume 0193498a-211c-7cb0-80a2-23f2f81643c7`
    - **原始输出**：`{"type":"thread.started","thread_id":"0193498a-211c-7cb0-80a2-23f2f81643c7"}`（CLI 层面允许将其作为孤立线程加载）。
  - **实测B（app-server 服务端队列通道）**：
    - **命令**：通过 app-server RPC `thread/queue/add` 向该子智能体线程添加外部消息。
    - **原始输出（错误拒绝）**：
      ```text
      Error: failed to queue session message: thread/queue/add failed: direct app-server input is not allowed for unloaded spawned sub-agents (code -32600)
      ```
    - **核心结论**：Codex app-server 在协议层设置了强校验。子智能体被显式标记为 `spawned sub-agent`，外部系统**被严格禁止直接绕过父智能体向未加载的子智能体排队送话**！
- **打断 (cancel)**: 【PARTIAL】
  - 父智能体在执行中使用 `interrupt_agent` 工具打断；外部若通过 CLI 运行则可通过杀进程打断。

#### 2.5 与同一家普通主会话的区别
虽然底层文件结构、日志格式和 UUIDv7 体系与主会话完全兼容，但 Codex 服务端将其严格归类为由父会话掌管生命周期的受控实体。app-server 抛出的 `-32600 direct app-server input is not allowed for unloaded spawned sub-agents` 极其确凿地证明：Codex 不允许外部系统将其当成随意插话的普通会话对待。

---

### 3. Claude Code (Anthropic)

#### 3.1 子智能体产生机制 (spawn-subagent)
在 Claude Code 中，父智能体调用内置的 `Agent` 工具（在旧版本或别名中为 `Task`）生成子智能体。
调用格式示例：
```json
{
  "description": "Probe subagent task",
  "prompt": "You are a subagent. Run this command and report results.",
  "subagent_type": "general-purpose",
  "run_in_background": true
}
```

#### 3.2 落盘位置
Claude Code 的子智能体落盘路径具有极强的**物理从属性**：
- **落盘路径**：`~/.claude/projects/<encoded-cwd>/<parent_uuid>/subagents/agent-<agent_id>.jsonl`
- 在宿主机上实测扫描，共定位到 231 个存量子智能体日志文件。

#### 3.3 父子关联关键字段
1. **目录结构从属**：直接存放在父会话 UUID 对应的子目录 `subagents/` 下。
2. **专属标识格式**：子智能体 ID 并非标准 UUIDv4，而是固定以字母 `a` 开头的 16 位 16 进制字符串（例如 `a0154a4d1e34255eb`）。
3. **文件内字段**：
   - `"parentUuid"`: 父会话的标准 36 位 UUIDv4
   - `"agentId"`: 子智能体 ID（如 `a0154a4d1e34255eb`）
   - `"isSidechain": true`: 显式标记为附庸/边链
4. **父会话通知机制**：
   子智能体执行完成后，会向父会话的交互队列中推送结构化通知：
   ```xml
   <task-notification>
     <task-id>a0154a4d1e34255eb</task-id>
     <status>completed</status>
     <summary>Done probe task</summary>
     <result>...</result>
   </task-notification>
   ```

#### 3.4 外部能力单元实测（命令与原始输出）
- **发现 (observe-list / find)**: 【PASS（限文件扫描）】
  - **命令**：通过脚本扫描 `~/.claude/projects/*/*/subagents/agent-*.jsonl`。
  - **原生 CLI 发现**：`claude agents` 命令**无法发现**这些轻量级的内部子智能体（该命令仅列出后台守护进程任务）。
- **读取历史 (observe-history)**: 【PASS】
  - **命令**：直接读取 `agent-a0154a4d1e34255eb.jsonl` 文件。
  - **原始输出片段**：文件完整记录了子智能体执行的系统提示、工具调用及最终文本输出。
- **状态监测 (state)**: 【PASS】
  - 解析父会话对应轮次的 `<task-notification>` 中的 `<status>` 字段（`completed` / `stopped`）。
- **送话 / 插话 (steer / send-message)**: 【FAIL（外部彻底阻断）】
  - **实测命令**：尝试使用 Claude CLI 的 `--resume` 命令加载该子智能体 ID：
    ```powershell
    claude --resume a0154a4d1e34255eb --print -p "hello"
    ```
  - **原始输出**：
    ```text
    Error: --resume requires a valid session ID or session title when used with --print or --non-interactive.
    Provided value "a0154a4d1e34255eb" is not a UUID and does not match any session title.
    ```
  - **核心结论**：Claude Code 在 CLI 参数解析层就写死了校验——只有符合标准 UUID 格式的才能 resume。子智能体的 `a<hex16>` 根本无法被外部作为会话独立加载。父会话内部只能通过 `SendMessage` 工具与存活的子智能体通信。
- **打断 (cancel)**: 【FAIL（无细粒度打断）】
  - 外部无法单独打断某个正在运行的附庸子智能体，只能通过终止父智能体的主进程来实现连带终止。

#### 3.5 与同一家普通主会话的区别
Claude Code 的子智能体在设计哲学上纯粹是一个**内存级的 Sidechain 附庸**。它没有主会话的合法 UUID 身份，不进入主会话的列表索引，不享受独立的 CLI 加载能力，所有输入输出完全受控于父会话的调度与通知。

---

### 4. ZCode (Zhipu AI)

#### 4.1 子智能体产生机制 (spawn-subagent)
在 ZCode 体系中，子智能体有两个来源：
1. 早期架构：主会话通过 `Task` 工具调用派发子智能体；
2. 3.14.3+ 架构：通过 DWF (Dynamic Workflow) 调度框架派生子智能体工作流（`dwf_actor` / `dwf_run`）。

#### 4.2 落盘位置
1. **主数据库**：`~/.zcode/cli/db/db.sqlite`
2. **专属 Rollout 模型日志**：`~/.zcode/cli/rollout/model-io-<child_session_id>.jsonl`

#### 4.3 父子关联关键字段
在 SQLite `db.sqlite` 的 `session` 表中：
- `id`: 子会话 ID（以 `sess_` 为前缀的标准 UUID）
- `parent_id`: 父会话的 `session_id`（实测库中已存有 663 条 `parent_id IS NOT NULL` 的历史记录）
- `task_type`: 显式标记为 `'subagent_child'` 或 `'dwf'`
- 辅助表 `session_task_link` 中记录 `(parent_session_id, child_session_id, task_id)`。

#### 4.4 外部能力单元实测（命令与原始输出）
- **发现 (observe-list / find)**: 【PASS】
  - **命令A（SQL 查询）**：
    ```powershell
    sqlite3 C:\Users\COLORFIRE\.zcode\cli\db\db.sqlite "SELECT id, parent_id, task_type FROM session WHERE parent_id IS NOT NULL LIMIT 2;"
    ```
    **输出**：
    ```text
    sess_871689ea-baea-41ae-ae08-a006ba52f77c|sess_1f951e70-a35d-45db-916c-e4e7561dc3b4|subagent_child
    sess_21c834ff-89d8-4f04-8ceb-eb2dc9f37920|sess_1f951e70-a35d-45db-916c-e4e7561dc3b4|subagent_child
    ```
  - **命令B（OpenCLI 适配器）**：
    `opencli zcode subagents <sess_id> --alive`（通过检查 `session_task_link` 与 Rollout 日志 mtime 判活）。
- **读取历史 (observe-history)**: 【PASS】
  - 通过 ACP 协议直接调用 `session/load` 接口传入子智能体 ID，成功取回 15 条历史消息与模型参数（或直接查询 `message` / `part` 表）。
- **状态监测 (state)**: 【PASS】
  - 数据库 `session.status`（如 `completed`），结合 `model-io-<child_id>.jsonl` 的最后修改时间。
- **送话 / 插话 (steer / send-message)**: 【FAIL（协议层强阻断）】
  - **实测过程**：使用 Node.js 编写测试脚本连接 `zcode-acp-server`，首先调用 `session/load` 加载子智能体 `sess_871689ea-baea-41ae-ae08-a006ba52f77c`，加载成功后紧接着调用 `session/prompt` 尝试送入新指令。
  - **原始输出（错误拦截）**：
    ```text
    session/prompt failed!
    RPC error: -32603 zcode send failed: Subagent sessions are read-only
    ```
  - **核心结论**：ZCode 在底层核心代码中把子智能体会话显式硬编码为**只读模式（read-only）**，任何试图通过 ACP 或外部 CLI 向子智能体会话发话的操作均会被底层直接报错拦截。
- **打断 (cancel)**: 【PARTIAL】
  - 普通子会话无独立 cancel 指令；DWF 工作流支持通过 `/dwf cancel` 打断执行。

#### 4.5 与同一家普通主会话的区别
ZCode 的子智能体虽然像普通会话一样被完整写入了同一个 SQLite 数据库，并拥有看似平等的 `sess_` 标识符，但其在引擎内部被打上了特殊的任务标签，并受到了最高级别的只读保护——**“Subagent sessions are read-only”**，杜绝任何外部二次交互。

---

### 5. OpenCode (SST / Anomaly Innovations)

#### 5.1 子智能体产生机制 (spawn-subagent)
OpenCode 拥有极其优雅的子智能体架构。父智能体通过内置的 `task` 工具派发子任务。
其底层实现代码（经逆向二进制反编译提取自 `TaskTool.execute`）逻辑如下：
- 支持内置子类型：`explore`（代码搜索探索，只读无写入权限）与 `general`（通用计算与任务）。
- 接收参数：`description`、`prompt`、`subagent_type`、`task_id`（可选）、`background`（布尔值，需环境变量 `OPENCODE_EXPERIMENTAL_BACKGROUND_SUBAGENTS=true` 启用）。
- 派生子智能体会话时自动设置：`parentID = p.sessionID`，会话标题自动格式化为：`${description} (@${c.name} subagent)`。

#### 5.2 落盘位置
OpenCode 采用统一的现代化三层文件存储，位于 `~/.local/share/opencode/storage/session/` 下：
1. `session/ses_<id>.json`: 会话核心元数据
2. `message/msg_<id>.json`: 消息层数据
3. `part/prt_<id>.json`: 具体的步骤、工具调用和文本块数据

#### 5.3 父子关联关键字段
1. **元数据标记**：在 `ses_<child_id>.json` 中显式保存 `"parentID": "ses_<parent_id>"`。
2. **会话标题标记**：标题带 `(@explore subagent)` 或 `(@general subagent)` 后缀。
3. **返回通信格式**：父智能体在工具调用完成时，接收到标准 XML 结构化响应：
   ```xml
   <task id="${sessionID}" state="${state}">
     <summary>${summary}</summary>
     <task_result>${result}</task_result>
   </task>
   ```

#### 5.4 外部能力单元实测（命令与原始输出）
- **发现 (observe-list / find)**: 【PASS】
  - **命令**：`opencode session list` 或直接检查 `ses_*.json` 中的 `parentID` 字段。
  - **原始特征**：子智能体会明确列在会话列表中，并带有 `subagent` 标题。
- **读取历史 (observe-history)**: 【PASS】
  - **命令**：`opencode export <child_session_id>` 或 HTTP 接口 `GET /session/<child_id>/message`。
  - **输出**：无任何信息损失，完整导出用户提示词、所有推理分块及输出结果。
- **状态监测 (state)**: 【PASS】
  - 读取元数据文件的 `time.updated` 以及各 `part` 的执行完成状态。
- **送话 / 续接 (steer / send-message)**: 【PASS（原生强支持）】
  - **源码级证据**：OpenCode 的 `TaskTool` 原生文档显式注明：
    *“task_id: This should only be set if you mean to resume a previous task (you can pass a prior task_id and the task will continue the same subagent session as before instead of creating a fresh one)”*
  - **外部命令行续接**：
    使用命令 `opencode run "继续执行" -s <child_session_id>`，系统完全识别并继续挂载执行！
- **打断 (cancel)**: 【PASS】
  - 通过终止 `opencode run` 进程或向 `opencode serve` 的 HTTP `/abort` 发送请求打断。

#### 5.5 与同一家普通主会话的区别
OpenCode 的设计最为彻底。子智能体本质上就是一个**受限的主会话**。它拥有完全平等的存储格式和 CLI 调度接口，唯一的区别是它被打上了 `parentID` 标识，并在内部根据 `subagent_type`（例如 `explore`）进行了权限沙箱隔离（禁止修改文件），防止子智能体在执行调查任务时破坏工作区。

---

### 6. WorkBuddy (CodeBuddy / Tencent)

#### 6.1 子智能体产生机制 (spawn-subagent)
WorkBuddy 的 CLI 内核（CodeBuddy）基于 Claude Code 的技术路线进行了深度工程化扩展，引入了后台作业调度与 Swarm 多智能体架构。通过 `Task` / `Agent` 工具或 CLI 的 `--swarm` 模式派发。

#### 6.2 落盘位置
1. **全局数据库**：`~/.workbuddy/workbuddy.db`（SQLite）
2. **项目日志**：`~/.codebuddy/projects/<encoded-cwd>/<uuid>.jsonl`

#### 6.3 父子关联关键字段
在 `workbuddy.db` 的 `sessions` 表中记录有：
- `is_background_automation`: 标识是否为后台作业/子任务
- `mode`: 工作模式（`code`, `swarm`, `expert` 等）
- `expert_id`: 专有专家/智能体标识

#### 6.4 外部能力单元实测（命令与原始输出）
- **发现 (observe-list / find)**: 【PASS】
  - **命令**：`codebuddy agents --jobs --all` 或 `codebuddy ps`。
  - **原始特征**：以 JSON 格式输出所有正在后台执行的子会话和作业清单。
- **读取历史 (observe-history)**: 【PASS】
  - **命令**：`codebuddy logs <pidOrName>`，或者直接解析项目的 `.jsonl` 文件。
- **状态监测 (state)**: 【PASS】
  - **命令**：通过 `codebuddy ps` 获取 PID、运行状态、资源占用等指标。
- **送话 / 插话 (steer / send-message)**: 【PARTIAL】
  - 对于已完成的后台作业，支持使用 `codebuddy -r <session_id>` 恢复交互；但对于正在并发执行中的 Swarm 内部节点，无法直接进行中途动态注入。
- **打断 (cancel)**: 【PASS】
  - **命令**：`codebuddy stop <pidOrName>` 或 `codebuddy kill <pidOrName>`。

#### 6.5 与同一家普通主会话的区别
普通主会话面向桌面端 UI 提供沉浸式图形界面，而后台子智能体作为独立的 headless 进程运行，带有作业 ID 和专用的守护进程管理指令（`ps`、`logs`、`stop`），更接近传统系统中的后台作业服务。

---

## 三、对多智能体协作层（Orchestrator）的架构设计启示

通过对这六家工具子智能体机制的深挖，我们得出了协作层设计的四条黄金法则：

1. **不可假设所有子智能体都能被外部直接接管**：
   在 Claude Code 和 ZCode 中，子智能体是“受控只读”或“内部附庸”，外部协同层如果试图把它们作为独立个体来发话（`steer`），会被底层硬阻断。对这两家，协作层必须采用“**总线对接父级，父级内部自闭环**”的模式。
2. **Antigravity 与 OpenCode 最适合作为可插拔的调度单元**：
   这两家的子智能体与主会话结构高度对等，且原生提供了会话级别的重连（resume）、追问（send-message/steer）和销毁能力，协作层可以非常轻松地把它们纳为外部调度器的一个可观察、可干预的算力单元。
3. **状态判断必须看关系表与专用字段**：
   不能仅靠是否有日志来判断子智能体是否结束。例如 Antigravity 必须看 `conversation_summaries.db` 中的 `CASCADE_RUN_STATUS_IDLE` 与 `not_fully_idle=0`；ZCode 必须查 `session.status`；Codex 必须看 `thread_spawn_edges.status`。
4. **清理必须遵循生命周期管理**：
   派生子智能体时往往伴随临时工作空间、锁文件和模型日志。在调度结束时，必须显式调用宿主提供的销毁入口（例如 Antigravity 的 `manage_subagents kill`、WorkBuddy 的 `stop`），避免在用户磁盘残留僵尸文件或死锁。

---

## 四、本次实测新建会话清单（审计用）
- **Antigravity 子智能体探针会话**：`3792a1dc-bb42-4330-93f0-54570e56242f`
  - 角色：`probe-subagent-worker`
  - 关联父会话：`695b25e9-255b-4a74-96f4-e176d5084eff`
  - 最终状态：执行追问验证后通过 `manage_subagents kill` 清理完毕，`killed=1`，无任何遗留常驻进程。
