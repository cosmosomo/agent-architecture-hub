---
channel_id: antigravity
name: Google Antigravity (AGY 2.0 App / IDE / CLI / SDK & Language Server RPC)
category: host
maintainer: S5
status: 🟢 ok
upgrade_status: ✅ synced
verified_version: "hub-2.23.0 (LS-ConnectRPC+agentapi)"
detected_version: "hub-2.23.1 (LS-ConnectRPC+agentapi, needs ANTIGRAVITY_PROJECT_ID)"
holder: shared
last_verified_at: "2026-10-17T16:30:00+08:00"
capabilities:
  observe_only: true
  external_session_read: true
  control_lifecycle: { start: true, resume: true, fork: true, stop: true }
  steer_in_turn: { in_turn: true, next_turn: true, inbox_file: true }
  coordinate_team: { spawn_subagent: true, peer_message: true, task_board: true }
---

# Google Antigravity (`antigravity` / `agy`) · 宿主能力与渠道维护档案卡

## 一、渠道身份、四大交互面与本机接入入口

- **产品全景（四大官方端面共享同一 Go 核心 `language_server.exe`）**：
  1. **Antigravity 2.0 Desktop App**（本机已装：`C:\Users\COLORFIRE\AppData\Local\Programs\antigravity\Antigravity.exe`，版本 `hub-2.23.0`，数据根目录 `C:\Users\COLORFIRE\.gemini\antigravity`）：Agent-first 多会话控制中心（支持 Sidecars、Subagents、Artifacts、Browser preview）。
  2. **Antigravity IDE**（数据目录 `~/.gemini/antigravity-ide`）：基于 VS Code 的编辑器形态（含 Tab Supercomplete、`Ctrl+I` 行内指令与侧边栏 Agent）。
  3. **Antigravity CLI (`agy`)**（安装命令：`irm https://antigravity.google/cli/install.ps1 | iex`，二进制落盘 `%LOCALAPPDATA%\agy\bin\agy.exe`，配置 `~/.gemini/antigravity-cli/settings.json`）：终端 TUI 形态，支持 `/agents`、`/boost`、`/teamwork-preview`、`/fork`（`/branch`）、`/resume`、`/rewind`、`/usage`（`/quota`）、`/credits`、`/remote-control` 以及 `agy plugin install/list/enable/disable`。
  4. **Antigravity Python SDK (`google-antigravity`)**（开源仓库：`https://github.com/google-antigravity/antigravity-sdk-python`）：三层架构（`Layer 1: Agent` → `Layer 2: Conversation` → `Layer 3: Connection / LocalConnectionStrategy`），支持 Gemini API Key、Vertex AI（`vertex=True`）及本地离线 `LiteRTAgentConfig`（`gemma-4-26B-A4B-it-gpu.litertlm`）。
- **本机订阅等级与账号状态（实测 `GetUserStatus`）**：
  - 登录账号：`cosmostxy2@gmail.com`（`Google AI Ultra` / `g1-ultra-tier` / `TEAMS_TIER_PRO`）
  - 套餐配额池：Gemini 模型组（5h 窗口 + Weekly 窗口）+ 第三方 Claude/GPT 模型组（5h 窗口 + Weekly 窗口）+ AI Credits（`availablePromptCredits: 500`、`availableFlowCredits: 100`）。
- **三大外部控制与读取入口（按优先级排序）**：
  1. **【首选 · 免 CDP 原生 RPC】`language_server.exe agentapi` + Connect-RPC JSON 接口**：
     - 路径：`C:\Users\COLORFIRE\AppData\Local\Programs\antigravity\resources\bin\language_server.exe`（或包装脚本 `C:\Users\COLORFIRE\.gemini\antigravity\bin\agentapi.bat` 及 Node SDK `C:\Users\COLORFIRE\.gemini\antigravity\lib\node_modules\sidecar_sdk\index.mjs`）。
     - **外部进程免环境变量自发现机制（2026-10-15 实测突破）**：从运行中的 `language_server.exe` 进程命令行提取 `--csrf_token <uuid>`，并枚举其监听的第二个本地 TCP 端口（如 `localhost:57173`），注入 `ANTIGRAVITY_LS_ADDRESS=localhost:<port>` 与 `ANTIGRAVITY_CSRF_TOKEN=<csrf>`，即可在任意外部进程（`agent_gateway.js`、Codex、Claude Code、ZCode）中 100% 原生调用 `agentapi` CLI 与 332 个 `LanguageServerService` Connect-RPC 接口！
  2. **【首选 · 地面真值直读】本地 SQLite 索引 + JSONL 轨迹**：
     - 全局会话数据库与 FTS5 全文检索库：`C:\Users\COLORFIRE\.gemini\antigravity\conversation_summaries.db`（含 `conversation_summaries` 表与 `conversations_fts` 虚表）。
     - 活跃会话锁文件：`C:\Users\COLORFIRE\.gemini\antigravity\presence\<conversation-id>.lock`。
     - 完整步骤级轨迹：`C:\Users\COLORFIRE\.gemini\antigravity\brain\<conversation-id>\.system_generated\logs\transcript.jsonl`（紧凑版）与 `transcript_full.jsonl`（未截断完整版）。
  3. **【备选 · 桌面 UI 注入】CDP `:9234`（`opencli antigravity`）**：
     - 仅在需要模拟桌面 UI 交互时使用；日常任务派发与会话恢复一律走 `language_server.exe agentapi` 原生接口。

---

## 二、独立能力矩阵（逐项核验记录）

| 能力维度 | 子能力项 | 支持度 | 精确命令 / 协议 / 字段依据 | 核验版本 & 证据 |
|---|---|---|---|---|
| **新建会话** | 原生 CLI / RPC 新建会话 | ✅ 原生完备 | `language_server.exe agentapi new-conversation [--model=<flash_lite\|flash\|pro>] [--title=<title>] [--profile=<profile>] <prompt>` 或 Connect-RPC `POST /exa.language_server_pb.LanguageServerService/StartCascade` | `hub-2.23.0` `〔实测:会话 03834523〕` |
| **续 / 插话（恢复或发消息）** | 跨会话/子代理投递消息并自动唤醒 | ✅ 原生完备 | `language_server.exe agentapi send-message [--title=<title>] <recipient_id> <content>` 或 Connect-RPC `/SendUserCascadeMessage`、`/SendAgentMessage`（实测触发 `cache_read_tokens: 18298` 完整命中上下文缓存） | `hub-2.23.0` `〔实测:step_index 2->3〕` |
| **观察状态与内容** | 元数据、SQLite 状态与 JSONL 轨迹 | ✅ 原生完备 | ① `language_server.exe agentapi get-conversation-metadata <cid>`<br>② `conversation_summaries.db` (`status`, `not_fully_idle`, `step_count`, `conversations_fts`)<br>③ `brain/<cid>/.system_generated/logs/transcript.jsonl` | `hub-2.23.0` `〔实测:48+会话〕` |
| **打断 / 停止** | 取消当前轮或强制停止子代理树 | ✅ 原生支持 | Connect-RPC `POST /exa.language_server_pb.LanguageServerService/CancelCascadeInvocation` 与 `/ForceStopCascadeTree` | `hub-2.23.0` `〔二进制符号与协议核验〕` |
| **分叉（Fork）** | 会话分支克隆 | ✅ 原生支持 | Connect-RPC `POST /exa.language_server_pb.LanguageServerService/ForkConversation`（或 CLI `/fork`、`/branch`） | `hub-2.23.0` `〔协议核验〕` |
| **查看额度与模型池** | 实时查询 5h/周窗口配额与 Credits | ✅ 原生完备 | Connect-RPC `POST /exa.language_server_pb.LanguageServerService/RetrieveUserQuotaSummary` + `/GetUserStatus` + `/GetCascadeModelConfigData`（Header: `x-codeium-csrf-token: <csrf>`, `Connect-Protocol-Version: 1`） | `hub-2.23.0` `〔实测:Gemini 5h 96.9%, 3P 5h 100%〕` |
| **子代理与多智能体编排** | `invoke_subagent` / `/boost` / `/teamwork-preview` | ✅ 原生完备 | 支持 `inherit` / `branch` (Git worktree) / `share` 三种工作区隔离，最大嵌套深度 10 层；支持 `.agents/agents/<name>.md` 自定义子代理与 `hooks.json` 六大生命周期钩子 | `hub-2.23.0` `〔实测:3并发研究子代理〕` |
| **桌面 CDP 注入（旧）** | CDP `9234` DOM 注入 | 🟡 退居备选 | `opencli antigravity send` 仅写 DOM 易假成功，现已由 `language_server.exe agentapi` 原生替代 | `CDP:9234` `〔历史踩坑保留〕` |

---

## 三、本机可用模型池与内部代号映射表（实测 `GetCascadeModelConfigData`）

| 界面显示名称 (`label`) | 模型 ID (`modelId`) | 内部枚举代号 (`modelOrAlias.model`) | `agentapi --model` 档位 | 配额池分组 | 备注 |
|---|---|---|---|---|---|
| **Gemini 4 Argon (High)** | `gemini-4-argon-high` | `MODEL_PLACEHOLDER_M417` | `pro` | Gemini Models (`gemini-5h` / `gemini-weekly`) | 旗舰深度推理，支持全模态（图片/音频/视频/PDF/Office） |
| **Gemini 4 Argon (Medium)** | `gemini-4-argon-medium` | `MODEL_PLACEHOLDER_M418` | 默认 (`defaultOverride`) | Gemini Models | 当前本机默认主力模型 |
| **Gemini 4 Argon (Low)** | `gemini-4-argon-low` | `MODEL_PLACEHOLDER_M419` | `flash` / 低延迟 | Gemini Models | 快速推理 |
| **Gemini 3.8 Flash (High)** | `gemini-3.8-flash-high` | `MODEL_PLACEHOLDER_M318` | `flash` | Gemini Models | 极速采集与大批量扫描 |
| **Gemini 3.8 Flash (Medium)** | `gemini-3.8-flash-medium` | `MODEL_PLACEHOLDER_M319` | `flash` | Gemini Models | 高速均衡 |
| **Gemini 3.8 Flash (Low)** | `gemini-3.8-flash-low` | `MODEL_PLACEHOLDER_M320` | `flash_lite` | Gemini Models | 轻量极速 |
| **Claude Opus 4.6 (Thinking)** | `claude-opus-4-6-thinking` | `MODEL_PLACEHOLDER_M26` | 面板指定 | Claude and GPT (`3p-5h` / `3p-weekly`) | 第三方旗舰（注：2026-11-02 起当前计划调整第三方模型策略，Opus 5.5 已上线） |
| **Claude Sonnet 4.6 (Thinking)** | `claude-sonnet-4-6` | `MODEL_PLACEHOLDER_M35` | 面板指定 | Claude and GPT | 第三方主力（Sonnet 5.5 已上线） |
| **GPT-OSS 120B (Medium)** | `gpt-oss-120b-medium` | `MODEL_OPENAI_GPT_OSS_120B_MEDIUM` | 面板指定 | Claude and GPT | 2026-11-02 下线 |

---

## 四、当前状态、安全参数与防呆红线

- **当前状态**：🟢 `ok`（已打通 `language_server.exe agentapi` + Connect-RPC 原生控制与查额链路，集成进 `hub/tools/agent_gateway.js`）
- **核心操作规矩**：
  1. **优先使用 `agent_gateway.js --agent antigravity` 或 `language_server.exe agentapi`**：新建会话用 `new-conversation`，恢复或跨会话通信用 `send-message`，彻底告别 `opencli antigravity send` 的 DOM 假成功问题；
  2. **地面真值闭环验真**：每次 `new-conversation` 或 `send-message` 后，通过 `brain/<cid>/.system_generated/logs/transcript.jsonl` 检查最新 `PLANNER_RESPONSE` 步的 `status === "DONE"`，即可拿到精确回复文本与 Token 消耗（`input_tokens`、`cache_read_tokens`、`output_tokens`）；
  3. **新建会话必须带项目编号（2.23.1 起）**：不带时 `new-conversation` 报 `project_id is required when providing project_env_config`；`send-message` 恢复不受影响。做法同 Sidecar SDK：环境变量 `ANTIGRAVITY_PROJECT_ID`。取值按工作目录匹配 `~/.gemini/config/projects/*.json` 的 `folderUri`（取最长的），匹配不上用 `outside-of-project`。两处网关已自动处理，也可手动设这个变量覆盖。
  4. **端口要探测，不能按顺序取**：`language_server.exe` 同时监听一个 HTTPS（gRPC）端口和一个纯 HTTP（Connect-RPC）端口，顺序不固定；`agentapi` 和 Connect-RPC 只能用后者。用 `GET http://127.0.0.1:<port>/healthz` 返回 `"status":"ok"` 的那个。用错端口时报 `error reading server preface: EOF`。
  5. **“送达”不等于“这一轮结束”**：`agentapi new-conversation` 和 `send-message` 都是送达即退出（0 秒）。这一轮结束的判据是：本轮新写入的最后一条 `PLANNER_RESPONSE` 为 `DONE` 且没有待执行的 `tool_calls`。恢复时消息以 `SYSTEM_MESSAGE` 步出现在 transcript 里，不是 `USER_INPUT`。**光看 transcript 不够**（2026-10-17 实测）：智能体把命令放到后台、先交一段文字再等通知时，也会写出“DONE 且无工具调用”的回复，而会话其实还在跑。可靠的判据是 `conversation_summaries.db` 里该会话 `status` 为 `CASCADE_RUN_STATUS_IDLE` 且 `not_fully_idle = 0`（运行中为 `CASCADE_RUN_STATUS_RUNNING` / `1`）。`presence/<cid>.lock` 在会话空闲后仍可能存在，不能单独用来判活。两处网关已改为“transcript 有最终回复 + 索引显示空闲”才算结束。
  6. **子代理死活判据**：结合 `conversation_summaries.db` 的 `not_fully_idle` / `status` 字段、`presence/<cid>.lock` 锁文件以及 `transcript.jsonl` 的最后修改时间（`mtime`）综合判活，不盲信旧 `.system_generated/subagents/*.json` 中的静态 `SUBAGENT_STATE_ALIVE`。

---

## 五、渠道升级与功能演进日志

- **2026-10-17 · 🟡 → 🟢 2.23.1 新建会话断开，已修复并实测**：
  - 现象：`agentapi new-conversation` 报 `project_id is required when providing project_env_config`；`send-message` 正常。换工作目录无效，是服务端要求。
  - 修复：`hub/tools/agent_gateway.js` 和 `trace/apps/cli/src/gateway.ts` 新建时按工作目录带 `ANTIGRAVITY_PROJECT_ID`；端口改为按 `/healthz` 探测（原来分别取最后一个、第一个，碰上 HTTPS 端口就失败）；:8899 服务原来在 `agentapi` 退出时就判“完成”，回复为空，改为等 transcript 里的最终回复。
  - 实测（flash_lite）：命令行新建 3 秒回复，命中 `multi` 项目；`outside-of-project` 新建可用；:8899 新建 + 一次读文件工具调用，等到最终回复；恢复同一会话上下文保留，服务热时 8.7 秒。
  - 遗留：:8899 服务刚启动的一两分钟里，Antigravity 回合要多等 50 秒到 4 分钟（AGY 侧 2 秒内已答完），原因是服务主线程被同步扫描占住，属于服务性能问题，没修。
- **2026-10-15 · 🟢 重大架构突破：打通 `language_server.exe agentapi` 与 Connect-RPC JSON 全生命周期控制**：
  - 逆向并实测验证了 `language_server.exe` 的进程级自发现协议（从 `Win32_Process.CommandLine` 提取 `--csrf_token` + 监听端口 `localhost:57173`）；
  - 实测打通 `new-conversation`（`新建会话`）、`send-message`（`恢复/插话`，验证 `cache_read_tokens: 18298`）、`get-conversation-metadata`（`观察`）以及 Connect-RPC `RetrieveUserQuotaSummary` / `GetUserStatus`（`查看额度`）；
  - 查明 `openclaw/acpx` 内置注册表将 `antigravity` 写死为 Google 内部 Blaze 产物 `agy_acp_server.exe`（外部发行版未附带），因此在 `hub/tools/agent_gateway.js` 中直接封装 `agy-agentapi` 原生驱动，实现与 `acpx` 完全一致的 JSON 输出契约。
- **2026-10-01 ~ 10-14 · 基线核验**：完成 `transcript.jsonl` 无侵入读取验证。

---

## 六、状态变化与故障/攻防时间线

- **2026-10-15 · 🟡 → 🟢 升级恢复**：以 `language_server.exe agentapi` 原生 gRPC/Connect-RPC 取代脆弱的 CDP `:9234` DOM 注入，消除 `send` 假成功隐患。
- **2026-10-01 · 🟡 发现 `opencli antigravity send` 假成功与 15 个僵尸子代理**：确立“读 `transcript.jsonl` 验真 + 按 `mtime` 判活”规矩。

---

## 七、维护者（S5）挂账与待办

- [x] 将 `antigravity` 原生 `agentapi` 驱动与 Connect-RPC 实时查额集成进 `hub/tools/agent_gateway.js`（`run / status / quota`）。
- [x] 完成本机四级存储结构、8 大内置系统 Skill、Sidecar SDK、官方插件市场（14+ 插件）与 7 大开源项目接入范式的源码级对标归档。
- [ ] 如需终端独立 TUI，可执行 `irm https://antigravity.google/cli/install.ps1 | iex` 安装独立 `agy.exe`。

---

## 八、本机全量资产解剖：四级目录、双 RPC 服务、内置 Skill 与官方插件库

### 8.1 双 Connect-RPC 进程架构（`language_server.exe` ↔ `Antigravity.exe`）
本机运行中的 `language_server.exe`（PID `8532`，完整启动参数含 14 个核心 Flag）揭示了 Antigravity 的**双向本地 RPC 架构**：
- **正向服务（Go `language_server.exe` 监听 `127.0.0.1:57173`）**：
  - 健康检查：`GET http://127.0.0.1:57173/healthz` → `{"instanceId":"0c3e13aa-e58b-4981-bf3e-10cddf547525","status":"ok"}`
  - Connect-RPC 服务：暴露 `/exa.language_server_pb.LanguageServerService/*` 共 **332 个方法**（校验 Header：`x-codeium-csrf-token: <csrf_token>` + `Connect-Protocol-Version: 1`），涵盖：
    - 会话控制：`StartCascade`、`SendUserCascadeMessage`、`SendAgentMessage`、`GetCascadeTrajectory`、`GetAllCascadeTrajectories`、`ForkConversation`、`CancelCascadeInvocation`、`ForceStopCascadeTree`
    - 账号与配额：`GetUserStatus`、`RetrieveUserQuotaSummary`、`GetCascadeModelConfigData`
    - 插件与定制项管理：`GetAllPlugins`、`JetboxWriteState`（写入 Base64 编码的 `"true"`/`"false"` 启停插件）、`DeletePlugin`、`InstallCustomization`、`RefreshCustomization`
- **反向桥接服务（Electron 主进程监听 `--host_bridge_url=http://127.0.0.1:57171`）**：
  - 由 `Antigravity.exe` 暴露 `/exa.host_bridge_pb.HostBridgeService/{GetOAuthToken, GetUpdateStatus, ApplyUpdate}`（凭 `--host_bridge_token` 鉴权），供 Go 语言服务端反向向 Electron 宿主拉取 Google OAuth 令牌与更新状态。

### 8.2 本机四级数据落盘全景（SQLite + Protobuf + JSONL）
| 路径 | 存储格式 | 作用与核心表 / 字段 |
|---|---|---|
| `C:\Users\COLORFIRE\.gemini\antigravity\conversation_summaries.db` | SQLite (FTS5) | 全局会话索引表 `conversation_summaries`（`id`, `title`, `status`, `not_fully_idle`, `step_count`, `updated_at`）及全文检索虚表 `conversations_fts` |
| `C:\Users\COLORFIRE\.gemini\antigravity\conversations\<uuid>.db` | SQLite (92 个库) | 单会话底层轨迹库，含 7 张表：`trajectory_meta`、`steps`（含 `idx`, `step_type`, `status`, `has_subtrajectory`, `permissions`, `task_details`, `render_info`, `step_payload`）、`gen_metadata`、`executor_metadata`、`parent_references`、`trajectory_metadata_blob`、`battle_mode_infos` |
| `C:\Users\COLORFIRE\.gemini\antigravity\brain\<uuid>\.system_generated\logs\` | JSONL | `transcript.jsonl`（紧凑版）与 `transcript_full.jsonl`（未截断完整版），每步包含 `step_index`, `type`, `status`, `input_tokens`, `cache_read_tokens`, `output_tokens`, `content`, `tool_calls` |
| `C:\Users\COLORFIRE\.gemini\antigravity\annotations\<uuid>.pbtxt` | Protobuf Text | 记录每个会话的 `last_user_view_time`（未读/已读状态真值） |
| `C:\Users\COLORFIRE\AppData\Roaming\Antigravity\User\globalStorage\state.vscdb` | SQLite (`ItemTable`) | Electron 全局状态库，包含 `antigravityAuthStatus`、`antigravityUnifiedStateSync.{modelPreferences, agentPreferences, modelCredits, oauthToken, trajectorySummaries, userStatus, sidebarWorkspaces}`、`jetskiStateSync.agentManagerInitState` 等 31 个核心键 |

### 8.3 本机隐藏的 8 大内置系统 Skill 与 Sidecar SDK
位于 `C:\Users\COLORFIRE\.gemini\antigravity\builtin\skills\` 与 `lib\node_modules\sidecar_sdk\`：
1. **`sidecar_sdk`（`index.mjs` + `preload.js`）**：向 Sidecar Webview 注入 `window.sidecar.agent.{sendMessage, startConversation, getConversationMetadata}` 与 `window.sidecar.ui.{toggleAuxPane, toggleConversation}`，底层直接调用 `ANTIGRAVITY_AGENTAPI_EXE`（即 `language_server.exe agentapi`）。
2. **`automation`（内置定时任务 Sidecar）**：揭示 `~/.gemini/config/sidecars/<id>/sidecar.json` 支持 `"builtin": "schedule"`，配置 `CRON_TZ=Asia/Shanghai <5字段cron>`、`prompt`、`workspace` 与 `agent_permissions.access_grants`，即可让 `language_server.exe` 在后台定时无人值守拉起新会话执行任务！
3. **`generative_ui`（对话内嵌交互式 HTML 组件）**：在回复中输出 `<agent-embed src="file:///<artifact_path>/widget.html"></agent-embed>` 即可在聊天气泡内直接渲染交互式 HTML/Canvas/Chart.js 组件，并自动注入宿主主题 CSS 变量与 `https://www.gstatic.com/antigravity/web/dev/tailwindcss.min.js`。
4. **`ui-plugin-navigation`（对话一键打开侧边栏面板胶囊）**：在回复中输出 `[面板名称](sidecar://<sidecar-id>/<view-path>)` 即可渲染一键切换右侧辅助面板的交互胶囊。
5. **`permissioned-github`（细粒度二进制能力授权）**：支持 `<binary>.<action>(<resource_json>)` 级授权表达式（如 `gh.create({"org":"...","repo":"...","issue":"*"})`）与 `ask_custom_permission`。
6. **`plugin` / `agy-customizations` / `migrate-workflows` / `antigravity_guide`**：覆盖 9 类定制资产（Rules / Skills / Workflows / Custom Agents / Sidecars / Plugins / MCP / Hooks / Permissions）的加载优先级与 `lsrpc` 管理接口。

### 8.4 官方插件市场缓存（`marketplace.json`）与本机已装插件
- **本机已装插件**（`C:\Users\COLORFIRE\.gemini\config\plugins\`，经 `GetAllPlugins` RPC 核验）：`docx` (`v1.0.0`)、`science` (`v1.2.4`，含 29 个生物医药/文献检索 Skill)。
- **官方市场缓存**（`C:\Users\COLORFIRE\.gemini\antigravity\cache\marketplaces\antigravity-plugins-official\marketplace.json`）：收录 Google 官方维护的 **17 款插件**（均可直接从 `https://www.gstatic.com/antigravity/plugins/<name>/<name>.zip` 下载或通过 `InstallCustomization` 安装）：`gcalendar`、`gdocs`、`gdrive`、`gsheets`、`gslides`、`android-cli-plugin`、`chrome-devtools-plugin`、`data-agent-kit-plugin`、`firebase`、`google-antigravity-sdk`、`google-developer-knowledge`、`google_maps_platform`、`modern-web-guidance-plugin`、`science`、`gemini-api`、`google-cloud-developer`、`flutter`。

---

## 九、开源生态对标：7 大开源项目如何接入 Antigravity（源码级剖析与避坑）

| 开源项目 | 接入范式 | 核心源码位置与调用机制 | 优势 / 亮点 | 缺陷 / Windows 踩坑实证 |
|---|---|---|---|---|
| **1. `@jackwener/opencli`**（本机已装 `clis/antigravity/*.js` 共 17 文件 27 命令） | **CDP `:9234` DOM 注入 + Anthropic `/v1/messages` 代理** | `send.js`、`read.js`、`serve.js`：通过 CDP 操控 Electron 渲染进程 DOM；`serve.js` 暴露 `http://localhost:8082/v1/messages` 让 Claude Code 把 Antigravity 当成免费 LLM 后端调用 | 提供 27 个 UI 子命令；`serve.js:249-273` 实现了真实物理鼠标点击（`Input.dispatchMouseEvent`）+ `Input.insertText` | **两大实测 Bug**：<br>① `send.js:19-34` 未做物理点击直接调 `execCommand('insertText')`，在 Lexical 编辑器未获真焦点时丢字却硬返回 `Sent successfully`（假成功根因！）；<br>② `storage.js:36` 硬编码 macOS 路径 `~/Library/Application Support/.../state.vscdb` 与 `/usr/bin/sqlite3`，在 Windows 上全部报错失败 |
| **2. `kevinArgueta96/open-agent-bridge`** | **Language Server Connect-RPC (`SendUserCascadeMessage`) + MCP 回传** | `src/client/antigravity-ls-client.ts:181-248`：扫描日志端口 → 调 `/GetAllCascadeTrajectories` 按目录匹配活跃 `cascadeId` → 调 `/SendUserCascadeMessage` (`messageOrigin: "MESSAGE_ORIGIN_SDK_EXECUTABLE"`) 注入消息 | 不依赖 UI 焦点与 DOM 选择器，可向后台任意已打开的会话直接推入新轮次 | `INTEGRATION_ANTIGRAVITY.md:105-125` 误以为 `SendAgentMessage` 是空操作（实测通过 `language_server.exe agentapi send-message` 可原生触发跨会话消息投递）；且回读依赖被调方主动调 MCP `reply` 工具 |
| **3. `RobertTLange/headless-cli` (`v0.6.1`)** | **独立 `agy` CLI 封装 + `transcript.jsonl` 地面真值解析** | `src/agents.ts:175-199`、`src/output.ts:140-146,296-348`：封装 `agy --model <m> -p <prompt> [--sandbox\|--dangerously-skip-permissions] [--conversation <id>]`，并从 `.gemini/antigravity/brain/<id>/transcript.jsonl` 提取 `planner_response` 与 Token 消耗 | 只读模式（`--sandbox`）与全自动模式（`--dangerously-skip-permissions`）映射清晰，且率先采用 `transcript.jsonl` 提取最终回复与缓存 Token | 强依赖独立安装的 `agy` CLI 二进制（`%LOCALAPPDATA%\agy\bin\agy.exe`），未利用本机已运行的 `language_server.exe agentapi` |
| **4. `osanoai/multicli` (`v1.5.41`)** | **MCP Tasks 异步任务封装 `agy --print`** | `src/utils/antigravityExecutor.ts:92-105`、`src/utils/cliDetector.ts:103-111`：调 `agy models` 动态发现模型，调 `agy --model <m> --print <prompt>` 执行，支持 MCP Experimental Tasks 异步轮询与客户端自调用过滤（`antigravity-cli-mcp-client`） | 实现了 MCP `ManagedTaskStore` 异步取消与 `taskkill /pid /T /F` 进程树清理；将旧 `Ask-Gemini` 设为 `Ask-Antigravity` 的兼容别名 | 无会话恢复（每次均为无状态 `--print` 单轮调用），同样依赖外部 `agy` CLI 二进制 |
| **5. `billythekidz/cli-agent-skills` & `teamnebula-ai/agent-bridge`** | **Windows ConPTY 交互注入 / `conversations/*.db` mtime 追踪** | `orchestrator_supervisor.py:262-335` 用 `pywinpty` 驱动 `agy --sandbox -i`；`agent-bridge` (`lib/agents.js:26-39`) 监控 `conversations/*.db` 的 `mtimeMs` 捕获新会话 UUID 并用 `agy --conversation <id> -p` 恢复 | 提供了无 RPC 时的终端 ConPTY 与 SQLite 文件时间戳兜底方案 | ConPTY 注入受 TUI 渲染时序影响（需 `0.15s` 延迟） |
| **6. `openclaw/acpx`** | **ACP 协议注册表 (`agy_acp_server`)** | `src/agent-registry.ts`：内置注册表映射 `antigravity: "agy_acp_server"` | 统一了 26 个 Agent 的 ACP 调用抽象 | **`agy_acp_server.exe` 是 Google 内部 Blaze 构建产物**（`language_server.exe` 符号中可见 `agy_acp_server.par`），公开发行版根本未附带该文件，导致直接调 `acpx antigravity` 报 `ENOENT` |
| **7. 本项目 `hub/tools/agent_gateway.js` (`agy-agentapi` 驱动)** | **原生 `language_server.exe agentapi` + Connect-RPC + `transcript.jsonl` 融合架构** | 自动从 `language_server.exe` 进程提取 `--csrf_token` 与监听端口（`57173`）→ 调 `agentapi new-conversation` (`新建会话`) / `send-message` (`恢复会话`) → 调 Connect-RPC `RetrieveUserQuotaSummary` (`查额`) → 读 `transcript.jsonl` (`真值闭环`) | **集齐所有开源方案之长**：免安装额外 CLI、免 CDP 焦点干扰、100% 命中上下文缓存（`cache_read_tokens`）、支持实时配额查询与全模态模型池 | 需保持 Antigravity 桌面端或 `language_server.exe` 在后台运行 |

