# 各家智能体体系“分叉”（Fork）机制全景调研报告：身份、拓扑谱系与外部可控性

> **负责人核查（10-18 晚）**：核过 Claude 一节的根因：parse.ts 取第一条记录的 sessionId 当编号，分叉会话被认成父会话。已修（编号改以文件名为准），实测两条会话分开、状态正确。其余各家的字段未逐条核。

> **调研时间**：2026-10-18  
> **调研对象**：Claude（桌面应用 / CLI / acpx）、Codex（App-Server / CLI / VS Code）、Antigravity（Connect-RPC / AgentAPI / IDE）、ZCode（ACP Bridge / CLI / db.sqlite）、WorkBuddy（codebuddy CLI / 项目存储）、OpenCode（CLI / opencode.db）  
> **核心任务**：探明各家从某一轮分叉出新会话时，新会话编号分配、物理存储位置、父子关联字段、进程/状态登记同步，以及外部发起/识别/追溯/续发的可控性边界；为 Hub 的列表去重、判活与拓扑展示提供地面真值。

---

## 零、核心认知纠偏与全景对照

### 1. 负责人发现的 Claude 桌面“进程登记写旧编号、记录写新编号”真相查明

负责人原观察：“Claude 桌面应用里分叉出来的会话，进程登记 `~/.claude/sessions/<pid>.json` 写的是旧编号 `3f9b57d6`，记录却写进新编号 `455376bf` 的文件，导致按编号判断‘在不在跑’会误判。”

**现场真实文件逐行穿透实测结果（事实推翻了上述推测）**：
1. **父子身份真实归属**：
   - 父会话（原始被分叉的会话）：**`455376bf-3926-4c9b-8324-e29d545a99fe`**（标题为“HUB人机交互架构清晰化”，文件共 5492 行）。
   - 分叉出的子会话：**`3f9b57d6-23be-479a-9537-70e0ed2d86cc`**（标题为“HUB人机交互架构清晰化 (fork)”，文件共 10763 行）。
2. **进程登记文件真实内容**：
   - `~/.claude/sessions/46076.json` 真实内容：
     ```json
     {"pid":46076,"sessionId":"3f9b57d6-23be-479a-9537-70e0ed2d86cc","cwd":"E:\\program\\GIT\\Agent\\multi","startedAt":1792270004176,"entrypoint":"claude-desktop","hostSessionId":"local_3f9b57d6-23be-479a-9537-70e0ed2d86cc","name":"HUB人机交互架构清晰化 (fork)","status":"busy"}
     ```
     **进程登记里的 `sessionId` 明确写的就是新会话 `3f9b57d6`，且文件名也是 `3f9b57d6-....jsonl`！两者完全对得上！**
3. **导致“对不上”与“判活失效”的真实根因（Hub 解析器 Bug）**：
   - Claude 桌面在分叉时，将父会话前 4350 行历史记录**直接硬拷贝**到新文件 `3f9b57d6-....jsonl` 中，但**没有把前 4350 行每条记录内的 `sessionId` 字段全局改写为 `3f9b57d6`**，每行依然残留 `"sessionId":"455376bf-..."`；只有从第 4351 行（标题行）与第 4378 行（新分叉输入轮次）开始，才出现 `sessionId: 3f9b57d6`！
   - 我们 Hub 的解析器源码 `Agent-Architecture-Hub/trace/packages/adapters/src/claude-code/parse.ts` 第 130 行写着：
     ```ts
     if (!sessionIdValue && typeof o.sessionId === 'string') sessionIdValue = o.sessionId;
     ```
     **Hub 从文件的第 1 行直接读取了 `o.sessionId`**，导致 Hub 误将 `3f9b57d6-....jsonl` 这个物理文件命名为了 `claude-code:455376bf`！
   - 随之产生连锁反应：
     - 在 Hub 的 `server.ts:79` 中用 `claudeLive().get(id.slice('claude-code:'.length))` 查询活跃状态；
     - Hub 用算出的 `455376bf` 去查 `claudeLive()`，而 `~/.claude/sessions/46076.json` 登记的是 `3f9b57d6`；
     - 找不到对应 PID，Hub 判定该会话**“不在跑 / stale”**；同时由于两个物理文件都被赋予了 `455376bf`，在内存 Store 中发生了覆盖与重复！

---

### 2. 六大体系分叉机制全景对照矩阵

| 体系 / 渠道 | 原生分叉入口 | 分叉后会话 ID | 记录存储位置 | 父会话关联写在哪里 | 进程/状态登记怎么变 | 外部能否发起分叉 | 外部能否识别并找父 | 外部能否继续发话 |
|---|---|---|---|---|---|---|---|---|
| **Claude**<br>(Desktop) | 界面历史轮次菜单<br>“Fork / 分支” | 生成新 UUID<br>(`3f9b57d6-...`) | `~/.claude/projects/<ws>/`<br>`<newUuid>.jsonl` | **无显式字段**<br>通过分叉点 `parentUuid` 指向父轮 assistant 节点；标题追加 `(fork)`；前 N 行残留父 sessionId | `~/.claude/sessions/<pid>.json`<br>`sessionId` 切换为新 UUID，父会话无独立进程登记 | ❌ 桌面无外部接口<br>（CLI 可冷拷贝，ACP 可调 `unstable_forkSession`） | 🟡 能（启发式）：<br>对比前 N 行与末尾行 sessionId，或由 `parentUuid` 反查 | ✅ 能：<br>`claude --resume <newUuid> -p "..."` |
| **Codex**<br>(App-Server / CLI) | RPC `thread/fork`<br>CLI `codex exec fork` | 生成新 UUIDv7<br>(`01a1497b-...`) | `~/.codex/sessions/YYYY/MM/DD/`<br>`rollout-*.jsonl` | **显式第一方字段**<br>Rollout 首行 Line 1 `session_meta.payload.forked_from_id`；RPC 响应 `thread.forkedFromId` | App-Server 内存 Thread 状态机新增实例，状态为 `idle`；无独立 OS 进程文件 | ✅ 能：<br>RPC `thread/fork` 或 CLI `codex exec fork` | 🟢 100% 确定能：<br>读 Rollout 首行或调 RPC `thread/read` 直接拿 `forkedFromId` | ✅ 能：<br>RPC `turn/start` 或 CLI `codex exec resume` |
| **Antigravity**<br>(Connect-RPC / IDE) | Connect-RPC<br>`ForkConversation`<br>IDE 气泡回退/编辑 | 生成新 UUID<br>(`fb159766-...`) | `conversations/<id>.db`<br>`brain/<id>/transcript.jsonl`<br>`conversation_summaries.db` | **单会话库专属表**<br>`conversations/<newId>.db` 之 `parent_references` 表（Protobuf 编码源 CascadeId 与截断 stepIndex） | `language_server.exe` 常驻；`conversation_summaries.db` 插入新行，状态 `IDLE` | ✅ 能：<br>Connect-RPC `ForkConversation` 支持任意步截断 | 🟢 单会话能/汇总库不能：<br>读单会话 DB 的 `parent_references` 能拿到；汇总表留空 | ✅ 能：<br>`agentapi send-message <id>` 或 RPC `SendUserCascadeMessage` |
| **ZCode**<br>(ACP Bridge / db.sqlite) | ACP `session/fork`<br>TUI 命令 `/fork` | 生成新 UUID<br>(`sess_6ba5eca1-...`) | `~/.zcode/cli/db/db.sqlite`<br>（表 `session`, `message`, `part`） | **SQLite 核心外键**<br>`session.parent_id` 显式写入；`title` 自动前缀 `Fork of ...`；消息 `metadata.forkOrigin` | 写入 SQLite；经 ACP 桥可通过新进程 `session/load` 挂载 | ✅ 能：<br>ACP `session/fork` 或 SQLite 复制 | 🟢 100% 确定能：<br>查询 `SELECT parent_id FROM session WHERE id=?` | ✅ 能：<br>ACP `session/load` + `session/prompt` 或 `zcode run -s` |
| **WorkBuddy**<br>(CLI codebuddy) | 原生参数<br>`codebuddy --fork-session` | 生成新 UUID<br>(`01a14974-...`) | `~/.workbuddy/projects/<ws>/`<br>`<newUuid>.jsonl` | **流式转折标记**<br>前 N 行继承父消息与父 sessionId，第 N+1 行 `session-meta` 写入新 sessionId；首条新 user 消息 `parentId` 指向父节点 | 命令行即跑即退；带 `--bg` 时在后台守护；`codebuddy ps` 可查活跃会话 | ✅ 能：<br>`codebuddy -r <id> --fork-session -p "..."` | 🟡 能（启发式）：<br>读取 `session-meta` 之前历史轮次的 `sessionId` | ✅ 能：<br>`codebuddy -r <newUuid> -p "..."` |
| **OpenCode**<br>(CLI opencode run) | 原生参数<br>`opencode run --fork` | 生成新 ID<br>(`ses_<id>`) | `~/.local/share/opencode/`<br>`opencode.db` | **SQLite 核心外键**<br>`session.parent_id` 显式索引原会话 ID；前序消息完全克隆 | SQLite 表持久化；无常驻进程锁冲突 | ✅ 能：<br>`opencode run -s <origId> --fork "<prompt>"` | 🟢 100% 确定能：<br>查询 `SELECT parent_id FROM session WHERE id=?` | ✅ 能：<br>`opencode run -s <newId> "<prompt>"` |

---

## 一、Claude（桌面应用 / CLI / acpx）

### 1. 入口与分叉能力表现
- **桌面客户端（Claude Desktop）**：
  - 入口：在消息气泡悬停的上下文菜单中，支持“Fork / 分支 / 编辑重试”。点击后在当前轮次派生分支。
- **官方命令行（Claude CLI `claude`）**：
  - 原生无非交互 `--fork` 参数（只有 `--resume`、`--continue`）。
  - **实测通过文件级冷分叉（Cold Fork）**：复制 `projects/<cwd>/<uuid>.jsonl` 并全局正则替换内部 `sessionId`，使用 `claude --resume <newUuid>` 激活，新会话 100% 继承前文记忆且原文件零变更。
  - **⚠️ 编码与清理红线（2026-10-18 事故复盘）**：执行文件级冷分叉改写 `.jsonl` 时，**必须使用无 BOM 的 UTF-8 编码**（严禁使用 Windows PowerShell 5.1 `Set-Content -Encoding UTF8`，其写入的首字节 `EF BB BF` 会导致 `ClaudeDesktopContinuity` 等严格 JSONL 解析器报 `无效的 JSON 基元` 崩溃）；同时，探针测试构造的合成 UUID 会话（如 `b0000000-...`）在取证后必须删除，禁止残留在 `~/.claude/projects/` 中。
- **ACP 协议桥（`claude-agent-acp`）**：
  - 原生支持 ACP 扩展协议方法 `unstable_forkSession({ sessionId, cwd })`。

### 2. 分叉后身份、物理位置与父子关联写在哪里
- **新会话编号**：生成全新 UUID（实测样本：`3f9b57d6-23be-479a-9537-70e0ed2d86cc`）。
- **物理转写文件**：
  - 路径：`C:\Users\COLORFIRE\.claude\projects\E--program-GIT-Agent-multi\3f9b57d6-23be-479a-9537-70e0ed2d86cc.jsonl`
- **与父会话的关联线索（真实源码/数据行号）**：
  1. **父会话原始文件**：`455376bf-3926-4c9b-8324-e29d545a99fe.jsonl`，第 4349 行发起分叉提示词：
     > `455376bf-3926-4c9b-8324-e29d545a99fe.jsonl:4349`: `{"type":"queue-operation","operation":"enqueue","timestamp":"2026-10-17T17:10:06.245Z","sessionId":"455376bf-3926-4c9b-8324-e29d545a99fe","content":"框架对，把它写进第一份机制文档（理论、方法论与需求）的草稿，放草稿区给我看。"}`
  2. **分叉新文件首行**：
     > `3f9b57d6-23be-479a-9537-70e0ed2d86cc.jsonl:1`: `{"type":"queue-operation","operation":"enqueue","timestamp":"2026-10-17T08:03:13.435Z","sessionId":"455376bf-3926-4c9b-8324-e29d545a99fe","content":"你是HUB的人机交互架构清晰化和整理以及多智能体协同leader。先理解这个定位，不需要做什么"}`
     *（证据确凿：前 4350 行直接复制自父会话，每行 `sessionId` 依然保持父会话编号 `455376bf`！）*
  3. **分叉新文件转折点**：
     > `3f9b57d6-23be-479a-9537-70e0ed2d86cc.jsonl:4351`: `{"type":"custom-title","customTitle":"HUB人机交互架构清晰化","sessionId":"3f9b57d6-23be-479a-9537-70e0ed2d86cc"}`  
     > `3f9b57d6-23be-479a-9537-70e0ed2d86cc.jsonl:4378`: `{"parentUuid":"c192da4f-4507-4b33-85ac-7b10342d46c8","isSidechain":false,"promptId":"ed0f0c37-44d4-48bf-bcc5-35a1a45a3b08", ... "sessionId":"3f9b57d6-23be-479a-9537-70e0ed2d86cc", ...}`  
     *（证据确凿：从第 4351 行开始转为新会话 ID `3f9b57d6`，第 4378 行的 `parentUuid` 指向第 4348 行父会话的最后一条 system/assistant 节点！）*

### 3. 进程与状态登记
- **登记文件**：`~/.claude/sessions/46076.json`
  > `C:\Users\COLORFIRE\.claude\sessions\46076.json:1`: `{"pid":46076,"sessionId":"3f9b57d6-23be-479a-9537-70e0ed2d86cc","cwd":"E:\\program\\GIT\\Agent\\multi","startedAt":1792270004176,"procStart":"134367436034955162","version":"2.1.299","peerProtocol":1,"peerFeatures":["notify_idle","artifact_yield"],"kind":"interactive","entrypoint":"claude-desktop","hostSessionId":"local_3f9b57d6-23be-479a-9537-70e0ed2d86cc","pidDomain":"win32:desktop-1f758lv","messagingSocketPath":"\\\\.\\pipe\\LOCAL\\cc-msg-15ff66a0dba086d62ac63d4668e410b8","name":"HUB人机交互架构清晰化 (fork)","nameSince":1792270004176,"updatedAt":1792300684430,"status":"busy","statusUpdatedAt":1792300684430}`
- **行为规律**：
  - Claude Desktop 采用“当前窗口单活动会话”模型。分叉后，PID 46076 立即将 `sessionId` 改写为新会话 `3f9b57d6`，并将标题更名为带 `(fork)` 的新名称。
  - 父会话 `455376bf` 不再拥有运行中进程（退出活跃登记），在磁盘上作为历史静止会话存在。

### 4. 外部可控性与操作方式
1. **能否发起分叉**：
   - 桌面客户端无暴露外部 RPC 入口；
   - 命令行：不可通过原生 CLI 参数发起非交互分叉，但可通过文件复制后 `--resume` 达成；
   - ACP 桥：可直接调用 `unstable_forkSession({ sessionId, cwd })`（实测代码：`Agent-Architecture-Hub/channels/probe/scripts/retest/retest_claude_suite.mjs:110`）。
2. **能否识别并找到父会话**：
   - 能（启发式）：检查转写文件历史行的 `sessionId` 是否与当前文件 basename 不一致；或通过第一个新 user 消息的 `parentUuid` 反查所指向消息的 `sessionId`。
3. **能否对分叉会话继续发话**：
   - 100% 成立：`claude --resume 3f9b57d6-23be-479a-9537-70e0ed2d86cc -p "<prompt>"`。

### 5. 分叉与“子智能体”“恢复会话”的区分
- **恢复会话（Resume）**：在原 `.jsonl` 文件末尾继续追加记录，文件内的 `sessionId` 全程一致。
- **会话分叉（Fork）**：生成新的 `.jsonl` 文件，前 N 行保留父 `sessionId`，后半段切换为新 `sessionId`，且标题多带 `(fork)` 标记。
- **子智能体（Subagent）**：主会话 `.jsonl` 中仅保留 `Agent` 工具调用及摘要，子智能体轨迹被放置在独立子目录 `~/.claude/projects/<cwd>/<session>/subagents/agent-<agentId>.jsonl`，且主会话内部如果记录子智能体，其条目带有 `isSidechain: true`。

---

## 二、Codex（App-Server / CLI / VS Code）

### 1. 入口与分叉能力表现
- **App-Server（`codex/L0/app-server`）**：
  - JSON-RPC 2.0 原生方法：`thread/fork`，参数 `{ threadId: string }`。
- **命令行（`codex exec`）**：
  - 原生第一方命令：`codex exec fork <parentThreadId> - [options]`。
- **VS Code 插件**：
  - 基于 App-server `thread/fork`；并在 `review/start` 中提供 `delivery: "detached"` 原生分支审查线程。

### 2. 分叉后身份、物理位置与父子关联写在哪里
- **新会话编号**：生成全新 UUIDv7（实测样本：`01a1497b-a1b3-78e3-a52d-03a8fed956ed`）。
- **物理转写文件**：
  - 路径：`C:\Users\COLORFIRE\.codex\sessions\2026\10\17\rollout-2026-10-17T18-50-01-01a1497b-a1b3-78e3-a52d-03a8fed956ed.jsonl`
- **与父会话的关联线索（真实源码/数据行号）**：
  1. **Rollout 记录文件 Line 1 原文**：
     > `rollout-2026-10-17T18-50-01-01a1497b-a1b3-78e3-a52d-03a8fed956ed.jsonl:1`: `{"timestamp":"2026-10-17T10:50:02.001Z","ordinal":17,"type":"session_meta","payload":{"session_id":"01a1497b-a1b3-78e3-a52d-03a8fed956ed","id":"01a1497b-a1b3-78e3-a52d-03a8fed956ed","forked_from_id":"01a1497b-8654-7aa3-b350-426e2bfc4123","forked_from_ordinal_exclusive":17,"timestamp":"2026-10-17T10:50:02.001Z"}}`  
     *（证据确凿：首行元数据清晰写死 `forked_from_id` 与截断步数 `forked_from_ordinal_exclusive: 17`！）*
  2. **App-Server `thread/fork` 协议回包原文**：
     > `Agent-Architecture-Hub/channels/probe/scripts/retest/output/codex_appserver_fork.json:19`: `"forkedFromId": "01a1497b-8654-7aa3-b350-426e2bfc4123",`  
     > `Agent-Architecture-Hub/channels/probe/scripts/retest/output/codex_appserver_fork.json:20`: `"parentThreadId": null,`  
     *（证据确凿：Codex 架构规范将分叉归入 `forkedFromId`，而将 `parentThreadId` 显式置为 `null`，以示其不是受控子代理！）*
  3. **CLI `codex exec fork` 实测回包原文**：
     > `Agent-Architecture-Hub/channels/probe/scripts/retest/output/codex_l0_exec_fork.json:3`: `"parentThreadId": "01a14977-267c-7b02-8562-1fb5e602452d",`  
     > `Agent-Architecture-Hub/channels/probe/scripts/retest/output/codex_l0_exec_fork.json:4`: `"forkThreadId": "01a14977-6140-7be1-8839-d510f768b422",`  
     > `Agent-Architecture-Hub/channels/probe/scripts/retest/output/codex_l0_exec_fork.json:5`: `"forkReply": "PROBE_FORK_SECRET_8819",`  
     *（实测执行 `['fork', '--json', '--skip-git-repo-check', '-m', 'gpt-5.6-sol', parentThreadId, '-']`，新分支完美回忆出父会话暗号！）*

### 3. 进程与状态登记
- **App-Server**：单端口常驻后台进程，内存维护全局活跃会话表。分叉瞬间返回完整新 `thread` 结构，新会话状态为 `status: { type: "idle" }`。
- **本地数据库（`~/.codex/state_5.sqlite`）**：
  - `threads` 表插入新行 `01a1497b-a1b3-78e3-a52d-03a8fed956ed`，`source` 标为调用宿主（如 `vscode`），`originator` 标为调用来源（如 `retest-fork`）。
  - 注：`state_5.sqlite` 本身并未设置 `forked_from_id` 列，父子谱系由 Rollout 文件的 `session_meta` 持久化保障。

### 4. 外部可控性与操作方式
1. **能否发起分叉**：100% 支持，可经由 JSON-RPC 发送 `thread/fork`，或直接在终端调用 `codex exec fork <parentThreadId>`。
2. **能否识别并找到父会话**：100% 确定支持。读取 Rollout 文件第 1 行或调用 `thread/read` 均可直接提取 `forkedFromId`。
3. **能否对分叉会话继续发话**：100% 支持。向 App-Server 发送 `turn/start { threadId: forkedThreadId, input: [...] }`，或终端调用 `codex exec resume <forkedThreadId> -`。

### 5. 分叉与“子智能体”“恢复会话”的区分
- **恢复会话（Resume）**：同一个 `thread.id`，在原 Rollout 文件继续追加 `ordinal` 序号增加的 `response_item`。
- **分叉会话（Fork）**：生成全新 `thread.id`，Rollout 文件首行标记 `forked_from_id`，App-Server 返回 `forkedFromId = <parentId>` 且 `parentThreadId = null`。
- **子智能体（Subagent）**：
  - 在 `state_5.sqlite` 的 `threads` 表中，其 `source` 列显式被序列化为 JSON：
    > `state_5.sqlite:threads.source`: `{"subagent":{"thread_spawn":{"parent_thread_id":"019cff6d-c2e2-77e0-8e38-aefd9aa8eed0","depth":1,"agent_nickname":"Dirac","agent_role":"explorer"}}}`
  - 在 App-Server 中其 `parentThreadId` 字段填入父线程 ID，深度 `depth >= 1`，具有从属生命周期管理关系。

---

## 三、Antigravity（Connect-RPC / AgentAPI / IDE）

### 1. 入口与分叉能力表现
- **Connect-RPC 核心接口（`antigravity/L0/connect-rpc`）**：
  - 原生 HTTP/JSON Connect-RPC 方法：`/ForkConversation`。
  - 参数：`{ "sourceCascadeId": string, "forkAtStepIndex": number }`。
  - 特性：不仅能复制会话，而且支持通过 `forkAtStepIndex` 截断历史，从中间某一步切出新分支！
- **AgentAPI 命令行（CLI `language_server.exe agentapi`）**：
  - **无原生分叉命令**（仅 `get-conversation-metadata`, `new-conversation`, `send-message`）。
- **IDE 界面**：
  - 在对话气泡执行“重试上一句”或“修改已发送提示词”时，底层自动向 `language_server.exe` 下发 `ForkConversation`。

### 2. 分叉后身份、物理位置与父子关联写在哪里
- **新会话编号**：生成全新 UUID（实测样本：`fb159766-5624-427b-9b8d-ec62c6ec81e1`）。
- **物理文件位置**：
  - 单会话 SQLite 库：`C:\Users\COLORFIRE\.gemini\antigravity\conversations\fb159766-5624-427b-9b8d-ec62c6ec81e1.db`
  - 转写与工作区产物：`C:\Users\COLORFIRE\.gemini\antigravity\brain\fb159766-5624-427b-9b8d-ec62c6ec81e1\`
  - 全局汇总索引表：`C:\Users\COLORFIRE\.gemini\antigravity\conversation_summaries.db`
- **与父会话的关联线索（真实源码/数据行号）**：
  1. **单会话库 `parent_references` 表（Protobuf 编码）**：
     - 在 `conversations/fb159766-....db` 中有一张专门的 `parent_references` 表：
       > `conversations/fb159766-....db:parent_references`: `idx: 0, data length: 84 bytes`
     - 二进制解析结果：
       - Protobuf 字段 1（字符串）：`43ea30aa-0dc6-4bff-8133-63543d58d064`（父级 Trajectory ID）
       - Protobuf 字段 2（变长整数）：`1`（`forkAtStepIndex = 1`）
       - Protobuf 字段 6（字符串）：`67fa191b-ed51-4b51-9188-81a8eb004372`（**源父会话 `sourceCascadeId`**！）
  2. **全局汇总库 `conversation_summaries.db` 的表现**：
     > `conversation_summaries.db:conversation_summaries`: `fb159766-5624-427b-9b8d-ec62c6ec81e1|probe-hook-inject-1||0||CASCADE_RUN_STATUS_IDLE`
     - **极重要发现**：`parent_conversation_id` 为**空字符串**，`nesting_depth = 0`！
     - 架构含义：Antigravity 将 `ForkConversation` 产生的会话视为主线会话，全局索引中不将其标记为子会话；真正的父子引用被封装下沉至单会话私有 DB 中。
  3. **实测证据原文**：
     > `Agent-Architecture-Hub/channels/probe/scripts/antigravity/append_fork.mjs:13`: `ForkConversation {sourceCascadeId: "67fa191b-ed51-4b51-9188-81a8eb004372", forkAtStepIndex: 1} 成功生成 newCascadeId fb159766-5624-427b-9b8d-ec62c6ec81e1；向其发送 send-message 成功准确复述原会话 step 0 提示词`

### 3. 进程与状态登记
- 常驻守护进程 `language_server.exe` 统一调度，无单个会话的 OS 进程登记。
- 分叉后，`language_server` 自动向 `conversation_summaries.db` 写入该新会话行，状态即为 `CASCADE_RUN_STATUS_IDLE`，外部可立刻查询。
- 注：实测脱离 RPC 强行在外部复制 `conversations/<id>.db` 并手改 `conversation_summaries.db` 会被底层 SQLite 报 `database is locked` 锁死，必须通过 Connect-RPC 接口触发。

### 4. 外部可控性与操作方式
1. **能否发起分叉**：100% 支持，可向 Connect-RPC 端口 POST `/ForkConversation`。
2. **能否识别并找到父会话**：通过单会话库 `conversations/<id>.db` 读取 `parent_references` 表可 100% 还原源会话；但若仅读全局汇总表 `conversation_summaries.db` 则无法识别（其 `parent_conversation_id` 为空）。
3. **能否对分叉会话继续发话**：100% 支持。直接执行 `language_server.exe agentapi send-message <newCascadeId> "<prompt>"`，或调用 Connect-RPC `SendUserCascadeMessage`。

### 5. 分叉与“子智能体”“恢复会话”的区分
- **恢复会话（Resume）**：直接向已有 `conversation_id` 下发 `send-message`，在原库追加 step。
- **分叉会话（Fork）**：生成新 `conversation_id`，`nesting_depth = 0`，`parent_conversation_id = ""`，亲缘关系记录在私有 DB 的 `parent_references`。
- **子智能体（Subagent）**：由 `invoke_subagent` 派生，在 `conversation_summaries.db` 中显式填入 `parent_conversation_id`，且 `nesting_depth >= 1`，受 `ForceStopCascadeTree` 级联管控。

---

## 四、ZCode（ACP Bridge / CLI / db.sqlite）

### 1. 入口与分叉能力表现
- **ACP 协议桥（`zcode-acp-server`）**：
  - 原生提供 `session/fork` 请求（客户端 SDK 包装为 `unstable_forkSession`）。
  - 入参支持指定 `targetCheckpointId` 或 `targetMessageId`，实现检查点级别分叉。
- **原生终端 CLI / TUI**：
  - 交互界面输入 `/fork` 命令即可生成分支会话。
- **数据库级克隆（L0）**：
  - 支持直接在 `~/.zcode/cli/db/db.sqlite` 复制 `session`、`message`、`part` 记录打通。

### 2. 分叉后身份、物理位置与父子关联写在哪里
- **新会话编号**：生成全新会话 ID（实测样本：`sess_6ba5eca1-8f4e-4122-86cc-f4f855e9c3d1`）。
- **物理存储位置**：`C:\Users\COLORFIRE\.zcode\cli\db\db.sqlite`
- **与父会话的关联线索（真实源码/数据行号）**：
  1. **SQLite `session` 表结构与真实记录原文**：
     > `~/.zcode/cli/db/db.sqlite:session`: `sess_6ba5eca1-8f4e-4122-86cc-f4f855e9c3d1|Fork of 设置并确认暗号 ACP-L1A-999|sess_b154edac-439d-417b-be9d-6abb77ca18d4`  
     *（证据确凿：ZCode 在数据库设计上最为周密——`session` 表原生具有 `parent_id` 外键与索引 `session_parent_idx`；分叉后标题自动打上 `Fork of <父会话标题>`，`parent_id` 显式写入父会话 ID！）*
  2. **ACP 协议响应原文**：
     > `Agent-Architecture-Hub/channels/probe/scripts/l1a_tester_results.json:2128`: `"forkedSessionId": "sess_6ba5eca1-8f4e-4122-86cc-f4f855e9c3d1",`  
     > `Agent-Architecture-Hub/channels/probe/scripts/l1a_tester_results.json:2129`: `"parentSessionId": "sess_b154edac-439d-417b-be9d-6abb77ca18d4",`  
     > `Agent-Architecture-Hub/channels/probe/scripts/l1a_tester_results.json:2132`: `"response": "Forked session sess_6ba5eca1-8f4e-4122-86cc-f4f855e9c3d1 from checkpoint checkpoint_07071181-2ef2-4402-a02d-1142c6d03991: copied 11 messages and restored 1 file.",`
  3. **消息级溯源元数据原文**：
     > `Agent-Architecture-Hub/channels/probe/scripts/l1a_tester_results.json:2147`: `"forkOrigin": {`  
     > `Agent-Architecture-Hub/channels/probe/scripts/l1a_tester_results.json:2148`: `  "sessionId": "sess_b154edac-439d-417b-be9d-6abb77ca18d4",`  
     > `Agent-Architecture-Hub/channels/probe/scripts/l1a_tester_results.json:2149`: `  "messageId": "msg_mvc7hl91_84796dad-f27d-4658-95a7-ac717e9580d5"`  
     *（克隆出来的每一条历史消息，都在 metadata 中注入了精确的 `forkOrigin`，指示源消息 ID！）*

### 3. 进程与状态登记
- ZCode 以 SQLite 为唯一持久化中心。分叉后直接在库中写入新会话与克隆消息，无需单会话常驻守护进程。
- 外部进程只需启动新的 `zcode-acp-server` 并调用 `session/load { sessionId: forkedSessionId }`，即可立即将其复活挂载为活跃状态。

### 4. 外部可控性与操作方式
1. **能否发起分叉**：100% 支持，可直接调 ACP `session/fork`，或在数据库直接 INSERT。
2. **能否识别并找到父会话**：100% 确定支持。直接执行 `SELECT parent_id, title FROM session WHERE id = ?` 即可瞬间拿到父会话 ID，且标题带 `Fork of`。
3. **能否对分叉会话继续发话**：100% 经过活体验证（代码见 `Agent-Architecture-Hub/channels/probe/scripts/test_l1a_fork_check.mjs`）：在新桥进程中 `session/load` 后下发 prompt，智能体精准答出父会话暗号 `ACP-L1A-999`。

### 5. 分叉与“子智能体”“恢复会话”的区分
- **恢复会话（Resume）**：`session/load` 载入同一个 `sessionId`，继续发送 prompt，不产生新行。
- **分叉会话（Fork）**：生成新 `session` 行，`parent_id` 填入原会话 ID，标题前缀 `Fork of`，消息带有 `forkOrigin`。
- **子智能体（Subagent）**：在 `session` 表中其 `id` 通常形如 `sess_subagent_agent_<uuid>`，`parent_id` 指向派生它的主会话，且 `task_type` 字段可能标记为特定子任务。

---

## 五、WorkBuddy（CLI codebuddy / 项目存储）

### 1. 入口与分叉能力表现
- **官方命令行（`codebuddy`）**：
  - **原生第一方显式参数**：`--fork-session`。
  - 帮助文档原文：
    > `codebuddy --help`: `--fork-session  When resuming, create a new session ID instead of reusing the original (use with --resume or --continue)`
- **桌面 / Web UI**：
  - 支持在会话管理历史记录中选择任一节点分支派生。

### 2. 分叉后身份、物理位置与父子关联写在哪里
- **新会话编号**：生成全新 UUID（实测样本：`01a14974-d5ad-795f-b7da-125bbe9c36f2`）。
- **物理文件位置**：
  - 路径：`C:\Users\COLORFIRE\.workbuddy\projects\e-program-GIT-Agent-multi-Agent-Architecture-Hub\01a14974-d5ad-795f-b7da-125bbe9c36f2.jsonl`
- **与父会话的关联线索（真实源码/数据行号）**：
  1. **转写文件结构（机制同 Claude）**：
     - 文件前 7 行完整保留父会话的所有 user/assistant 消息，且每行内部的 `sessionId` 依然保持父会话 ID `probe-wb-l0-fork-parent-1792233738517`；
     - 第 8 行写入分界元数据 `session-meta`：
       > `01a14974-d5ad-795f-b7da-125bbe9c36f2.jsonl:8`: `{"type":"session-meta","id":"01a14974-d603-71cf-98c8-e6bba1808468","sessionId":"01a14974-d5ad-795f-b7da-125bbe9c36f2","timestamp":1792233756163,"meta":{"activeGoal":null}}`
     - 第 9 行写入新分叉分支的第一句 user 消息，其 `parentId` 精准指向父会话最后一条 assistant 消息 ID：
       > `01a14974-d5ad-795f-b7da-125bbe9c36f2.jsonl:9`: `{"type":"message","id":"01a14974-db36-7429-a5b8-29014e0ad757","parentId":"01a14974-b775-7d36-907f-c01c4f6af166","sessionId":"01a14974-d5ad-795f-b7da-125bbe9c36f2",...}`
  2. **实测回包与暗号复述原文**：
     > `Agent-Architecture-Hub/channels/probe/scripts/retest/wb_l0_retest_results.json:4`: `"parentSessionId": "probe-wb-l0-fork-parent-1792233738517",`  
     > `Agent-Architecture-Hub/channels/probe/scripts/retest/wb_l0_retest_results.json:6`: `"forkedSessionId": "01a14974-d5ad-795f-b7da-125bbe9c36f2",`  
     > `Agent-Architecture-Hub/channels/probe/scripts/retest/wb_l0_retest_results.json:7`: `"forkedReply": "WB-SECRET-58219",`  
     > `Agent-Architecture-Hub/channels/probe/scripts/retest/wb_l0_retest_results.json:99`: `"cmd": "codebuddy -r probe-wb-l0-fork-parent-1792233738517 --fork-session -p \"我们之前约定的暗号是什么？直接回答暗号，不要任何多余字。\" --model custom-local:glm-5.3 --output-format json"`

### 3. 进程与状态登记
- 命令行运行为短生命周期进程，跑完退出，状态自然落盘。
- 若使用 `--bg` 后台模式，可在 `codebuddy ps` 命令中查看到活跃任务列表；会话记录与状态完全以 `~/.workbuddy/projects/` 下的 `.jsonl` 为准。

### 4. 外部可控性与操作方式
1. **能否发起分叉**：100% 原生支持，直接调用 `codebuddy -r <parentSessionId> --fork-session -p "<prompt>"` 即可。
2. **能否识别并找到父会话**：能（启发式）。读取新 `.jsonl` 文件中 `session-meta` 之前历史记录行的 `sessionId` 即可获得父会话 ID。
3. **能否对分叉会话继续发话**：100% 支持，执行 `codebuddy -r <forkedSessionId> -p "<nextPrompt>"`。

---

## 六、OpenCode（CLI opencode run / opencode.db）

### 1. 入口与分叉能力表现
- **官方命令行（`opencode run`）**：
  - **原生第一方参数**：`--fork`。
  - 用法：`opencode run -s <origSessionId> --fork "<prompt>"`。
- **数据库级操作（L0）**：
  - 在 `~/.local/share/opencode/opencode.db` 的 `session`、`message`、`part` 表中复制节点并维护 `parent_id`。

### 2. 分叉后身份、物理位置与父子关联写在哪里
- **新会话编号**：生成全新 ID（格式形如 `ses_<nanoId>`）。
- **物理存储位置**：`C:\Users\COLORFIRE\.local\share\opencode\opencode.db`
- **与父会话的关联线索（真实源码/数据行号）**：
  1. **SQLite `session` 表结构**：
     > `opencode.db:session`: `CREATE TABLE session (id text PRIMARY KEY, project_id text NOT NULL, parent_id text, slug text NOT NULL, directory text NOT NULL, title text NOT NULL, ...)`
     - 包含索引：`CREATE INDEX session_parent_idx ON session (parent_id);`
  2. **实测原生 `--fork` 验证数据**：
     > `Agent-Architecture-Hub/channels/probe/scripts/tmp/agy-fact-opencode-hermes/test_opencode_native_fork.js:38`: `const cmd2 = opencode run "请回答我刚刚让你牢记的暗号是什么？请只回答暗号本身。" -s ${origId} --fork -m zhipuai-coding-plan/glm-5.3-flash < NUL;`  
     > `Agent-Architecture-Hub/channels/probe/scripts/tmp/agy-fact-opencode-hermes/test_opencode_native_fork.js:46`: `const forkedSessions = runSqlite("SELECT id, parent_id FROM session WHERE parent_id = '${origId}';");`  
     > `Agent-Architecture-Hub/channels/probe/scripts/tmp/agy-fact-opencode-hermes/test_opencode_native_fork.js:57`: `evidence: "stdout: ..., matchedSecret: true, db_parent_id: ${origId}"`  
     *（证据确凿：OpenCode 原生命令行下发 `--fork` 时，底层自动在 `session` 表创建新行并把 `parent_id` 填入原会话 ID，同时将前序所有 `message` 和 `part` 拷贝至新会话下！）*

### 3. 进程与状态登记
- 运行结束后退出，状态保存在 SQLite 数据库中。
- 不存在锁冲突，无独立 OS 进程登记文件。

### 4. 外部可控性与操作方式
1. **能否发起分叉**：100% 原生支持，执行 `opencode run -s <origId> --fork "<prompt>"`。
2. **能否识别并找到父会话**：100% 确定支持。直接在 SQLite 中执行 `SELECT parent_id FROM session WHERE id = ?` 即可。
3. **能否对分叉会话继续发话**：100% 支持，执行 `opencode run -s <forkedId> "<nextPrompt>"`。

---

## 七、对 Hub 的深刻含义与落地改造决议（全部标明为【判断】）

### 1. 列表怎么去重【判断】

- **【诊断与判断】当前 Hub 会话列表存在“同一会话分裂”与“分叉会话被吞噬”双重 Bug**：
  - **Bug 根因**：当前 Claude 解析器 `Agent-Architecture-Hub/trace/packages/adapters/src/claude-code/parse.ts` 第 130 行：
    ```ts
    if (!sessionIdValue && typeof o.sessionId === 'string') sessionIdValue = o.sessionId;
    ```
    对于分叉出来的文件（如 `3f9b57d6-....jsonl`），前 4350 行全部保留着父会话的 `sessionId: 455376bf`。解析器读取第 1 行便把 `sessionIdValue` 锁死为 `455376bf`。在第 277 行将 `sourceId` 定为 `455376bf`，最终生成的全局 ID 为 `claude-code:455376bf`。
    而磁盘上原本就有一个真实的 `455376bf-....jsonl`，它的全局 ID 也是 `claude-code:455376bf`！
    **结果**：在 Hub 的全局 Store 映射（`store.ts:byId`）中，分叉文件直接把父会话冲刷覆盖掉了！Hub 列表不仅没有显示出分叉会话，反而造成会话丢轮、状态错乱。
- **【改造决议（判断）】**：
  - **确立“文件物理名唯一真源（Basename Ground Truth）”原则**：
    对于基于 JSONL 文件存储的体系（Claude Code、WorkBuddy、Codex Rollout），会话的主键 `sourceId` **必须强制取文件的 Basename（去掉 `.jsonl` 扩展名）**，绝对不能取文件内部第一行出现的 `sessionId`！
    ```ts
    // 改造建议（parse.ts:277）：
    const fileBaseId = file.path ? basename(file.path).replace(/\.jsonl$/i, '') : undefined;
    const sourceId: string = fileBaseId || sessionIdValue || 'unknown';
    ```
  - 只要采纳此项改动：
    - 父会话文件 `455376bf-....jsonl` 生成 `claude-code:455376bf-...`；
    - 分叉文件 `3f9b57d6-....jsonl` 生成 `claude-code:3f9b57d6-...`；
    - 两者各自独立存在，互不覆盖，Hub 列表自然呈现为两条独立会话。

---

### 2. 状态怎么判（在不在跑 / 活跃度）【判断】

- **【诊断与判断】消除进程登记与转写文件“编号不一致”的误判**：
  - 负责人最初感受到的“进程登记写 3f9b57d6，记录写进 455376bf”是解析器将 `3f9b57d6` 文件错误命名为 `455376bf` 引起的倒错。
  - 真实世界中，Claude Desktop 在 `~/.claude/sessions/46076.json` 登记的正是分叉后的新 ID `3f9b57d6`。
  - **判断**：一旦我们在第 1 步把分叉会话的 `sourceId` 改正为文件名 `3f9b57d6`，那么在 `server.ts:79`：
    ```ts
    const live = claudeLive().get(id.slice('claude-code:'.length));
    ```
    用 `3f9b57d6` 去查 `claudeLive()`，将**立刻 100% 命中 PID 46076**！直接正确判出 `status: "busy"` / `"idle"`！
  - **父会话的状态判定（判断）**：
    父会话 `455376bf` 在桌面端切到分叉分支后，确实不再有活动进程（`claudeLive()` 查不到）。由于父会话已经落盘且停止写入，Hub 的回退逻辑 `detectState` 会正确将其标记为 `idle`（完成等待），绝不应因“分叉”而将其误判为异常中断。

---

### 3. 父子怎么显示（区分时间线分叉与层级子智能体）【判断】

- **【诊断与判断】必须在 Hub 拓扑模型中解耦“分叉（Fork）”与“子智能体（Subagent）”**：
  - **现状缺陷**：目前 Hub 在 `server.ts:758` 粗暴地将所有带有 parent 的关联统称为子智能体：
    ```ts
    subagent: s.agent?.role === 'subagent' || Boolean(agyParent(String(s.id))) || undefined,
    parent: (s.links || []).find((l: any) => l.rel === 'parent')?.id || agyParent(String(s.id)) || undefined,
    ```
    这导致如果把分叉会话也连上 parent，分叉会话就会被当成子智能体缩进显示，甚至被统计进 `subagents` 计数器，这在认知模型上是完全错误的。
  - **认知边界区分（判断）**：
    - **时间线分叉（Fork）**：是**并列主线会话**。它们是平行世界（Git 分支关系），拥有相同的角色和独立的生命周期，人可以在分叉上继续完整工作。
    - **子智能体（Subagent）**：是**层级委托会话**。它们通常由主 Agent 临时派出执行专项目标（深度 `>= 1`），有从属关系和汇报汇聚点，受主会话生命周期级联管辖。
  - **Hub 协议与展示层改造建议（判断）**：
    1. 在 `@hub-trace/contract` 的 `links` 结构中新增 `kind` 字段：
       - `links: [{ rel: 'parent', id: '...', kind: 'fork' }]`
       - `links: [{ rel: 'parent', id: '...', kind: 'subagent' }]`
    2. 各家适配器抽取逻辑：
       - **Codex**：读 `session_meta.payload.forked_from_id` 或 RPC `forkedFromId`，生成 `kind: 'fork'`；只有 `source.subagent` 或 `parentThreadId` 生成 `kind: 'subagent'`。
       - **ZCode**：读 `session.parent_id`，若标题含 `Fork of`，生成 `kind: 'fork'`；若 ID 含 `subagent`，生成 `kind: 'subagent'`。
       - **OpenCode**：读 `session.parent_id` 生成 `kind: 'fork'`。
       - **Antigravity**：`conversation_summaries.db` 中 `parent_conversation_id` 且 `depth >= 1` 为 `kind: 'subagent'`；单会话库 `parent_references` 为 `kind: 'fork'`。
       - **Claude / WorkBuddy**：当检测到文件前部历史块的 `sessionId` 与当前文件主键不同，且消息具有跨会话 `parentUuid` / `parentId` 时，建立 `kind: 'fork'` 连线。
    3. 前端 UI 展示：
       - `subagent` 维持现有树状缩进与微型气泡卡片；
       - `fork` 在会话列表或拓扑视图中显示为**分支徽标（Git Branch 图标）**，注明“分叉自 <父会话标题>”，点击可一键高亮父会话。

---

## 八、负责人重点关切总结（直接结论）

1. **哪几家分叉后身份能对上？**
   - **Codex、ZCode、OpenCode**：**100% 完美对上**。它们拥有第一方的 `forkedFromId` 或数据库 `parent_id` 列，会话 ID、文件/数据行、进程状态与父子关系全链路闭环，毫不含糊。
   - **Antigravity**：**单会话对得上，全局汇总对不上**。单会话 SQLite 库的 `parent_references` 表通过 Protobuf 完备记录了父 CascadeId 与截断步数；但全局汇总表 `conversation_summaries.db` 将 `parent_conversation_id` 留空（仅子智能体填入）。
2. **哪几家对不上（表面假象与本质）？**
   - **Claude Desktop & WorkBuddy**：**文件本身与进程登记其实对得上，是被 Hub 解析器误读后造成对不上**。
     - 它们的分叉机制是“复制历史文本流并在转折点引入新 ID”，前部历史记录未全局重写 `sessionId`。
     - 进程登记（如 Claude `46076.json`）登记的**完全就是新编号 `3f9b57d6`**。
     - 是因为 Hub 解析器贪婪抓取了文件第 1 行的旧 `sessionId`，把分叉文件强行当成了父会话，导致“查无此进程”、父子重叠。
3. **对 Hub 最要紧的一条改动：**
   - **立即将 `Agent-Architecture-Hub/trace/packages/adapters/src/claude-code/parse.ts:277`（及 WorkBuddy 相应解析逻辑）的会话主键提取策略改为：“以转写文件的 Basename（文件名）作为唯一真源 ID”**。
   - 只要改动这 1 行代码：
     1. Claude 桌面分叉出来的会话立刻拥有独立身份，不再与父会话碰撞覆盖；
     2. 瞬间 100% 对齐 `~/.claude/sessions/<pid>.json` 进程登记，在不在跑的判活误判立竿见影消除！
