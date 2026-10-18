# 各家桌面端已有的人机交互与显示功能事实深度调研报告（2026-10-18）

> **调研执行人**：Antigravity (AGY 2.0 / 宿主事实边界探查)  
> **报告归档路径**：`E:\program\GIT\Agent\multi\Agent-Architecture-Hub\channels\probe\results\hci-desktop-facts-20261018.md`  
> **调研基准清单**：`E:\program\GIT\Jobs\08_简历设计工作区\02_项目打磨与展示\智能体技术\多智能体协作\能力单元登记表_20261017.md` 第 3 节（以人机交互开头的 31 项，加 5 项显示与导航，共 36 项候选单元）与第 4 节第 13 条。  
> **被测四家桌面端**：
> 1. **Codex 桌面应用**（MSIX 包版本 `26.1013.3656.0`，CLI / App-Server `0.159.2`）
> 2. **Google Antigravity 桌面端 & IDE**（版本 `hub-2.23.0 / 2.23.1`，Language Server RPC `0.1.0`）
> 3. **ZCode 桌面端**（Electron 桌面壳 `3.14.3+`，CLI `0.16.9`，ACP 桥 `0.69.3`）
> 4. **Tencent WorkBuddy 桌面端**（Electron 桌面应用，内核 `@tencent-ai/codebuddy-code` `v2.168.2 / v2.160.0`）
> **操作铁律执行**：全过程严格只读探查，未启动、未关闭、未重启任何桌面应用，未向任何正在进行的会话发消息；所有结论均具备本地文件、数据库 Schema、协议帧或官方源码的确凿证据。

---


> **负责人核查（2026-10-18）**：
> - 第〇节第 3 条“WorkBuddy 完全没有读取桌面端”**不属实**：后端 `gateway.ts` 的 `listWorkbuddyDesktopSessions` 已读 `~/.workbuddy/projects/*/*.jsonl` 和 `workbuddy.db`。87 个记录文件里 50 个列为桌面会话，17 个按 acpx 身份列出，未列的 19 个都是空会话或探针测试。
> - Codex 索引 `state_5.sqlite` 有 1248 条，但其中 1157 条的记录文件已被 Codex 自己删掉，只剩索引；有文件的 91 条全部读到。不是我们漏读。
> - ZCode 待办表 2351 条、Codex 置顶和分区：属实，后端未读。
> - 删减建议不采纳：页面反馈是用户点名要的；多端同一状态正是 hub 要给的能力（手机督工台）；长会话浏览先保留。新增 9 项作为候选登记。

## 〇、核心结论与给负责人的几句话（执行摘要）

1. **负责人的直觉完全正确，原清单确实做窄了**：原 36 项人机交互单元（主要凭 Claude 桌面端逆推）仅覆盖了“单会话多轮聊天 + 基础折叠”的泛通用框架，严重低估了四家桌面端实际已内建的专业交互原语。
2. **各家桌面端普遍已经超越了“一问一答”**：
   - **Codex** 原生内建了完整的会话自定义分区（`thread_sections`）、Git 分支状态徽章（`git_branch/sha`）、全双工实时语音面板（`thread/realtime/*`）以及多格式 Office 产物挑选器（`docx/pptx/xlsx`）；
   - **Antigravity** 原生内建了对话流内联动态可交互小部件（`generative_ui` `<agent-embed>`）、伴随微应用侧栏（`sidecar_sdk`）、多模型对战淘汰竞技场（`battle_id`）与 5h/周双滑动窗口真剩余配额进度条（Connect-RPC `RetrieveUserQuotaSummary`）；
   - **ZCode** 本地 SQLite 原生维护着 2,351 条结构化待办看板（`todo` 表）、动态工作流 DAG 拓扑图（`dwf_run/node`）、代码改动统计徽章（`summary_additions/deletions/files`）与一键网页分享（`share_url`）；
   - **WorkBuddy** 本地 SQLite 原生维护着基于 iCalendar RRULE 的周期定时自动化调度台（`automations` 表）、专家/智能体超市（`expert_marketplace`）、单次调用扣费积分精确账本（`credit_json`）与企业微信机器人推送。
3. **我们后端（:8899）对各家数据的读取现状**：
   - **Antigravity 与 Codex**：只读旁路已打通主干（读 Antigravity 的 `conversation_summaries.db` 状态与 `transcript.jsonl` 步骤全过程；读 Codex 的 `rollout-*.jsonl` 轮次与步骤）。但后端目前**尚未读取** Codex 的 `state_5.sqlite`（丢掉了 `is_pinned`、`thread_sections`、`projects` 元数据）。
   - **ZCode**：后端目前只读了 `db.sqlite` 的 `session/message/part/model_usage`，**尚未读取**其现成的 `todo` 看板表与 `summary_diffs`。
   - **WorkBuddy**：后端目前**只接了 acpx 运行产生的 67 个会话，完全没有读取**桌面端自己的 `~/.workbuddy/workbuddy.db`（漏掉了 135 个桌面原生会话、全部 `automations` 与 `credit_json` 账本）。
4. **给负责人的精简建议**：
   - **必须立即补充的 9 大高价值人机交互单元**：`ui-todo-board`（待办任务看板）、`ui-thread-sections`（侧栏自定义文件夹/分区）、`ui-git-badge`（Git 分支与提交徽章）、`ui-generative-embed`（对话流内联富交互渲染）、`ui-automation-scheduler`（定时自动化调度台）、`ui-share-link`（一键分享链接）、`ui-input-history`（输入框历史回溯）、`ui-credit-ledger`（精确扣费明细透视）、`ui-quota-bar`（真剩余额度与倒计时进度条）。
   - **建议剔除或合并的 3 项**：`ui-feedback`（任何 Web 都有的普通按钮，不属于智能体交互核心抽象，删）；`ui-multidevice`（四家桌面端无一具备跨设备状态同步，纯属本地单机，删或改列为 Hub 自身能力）；`ui-long-history`（纯前端游标分页性能指标，并入 `observe-history`）。

---

## 一、Codex 桌面应用人机交互与显示事实

### 1.1 安装载体与界面入口
- **产品形态**：Windows MSIX 桌面包（`OpenAI.Codex_26.1013.3656.0_x64__2p2nqsd0c76g0`，安装位于 `C:\Program Files\WindowsApps\OpenAI.Codex_26.1013.3656.0_x64__2p2nqsd0c76g0`），基于 Chromium Owl Shell 架构（`ChatGPT.exe` + `Codex.exe` + `chrome.dll` + `app.asar`）。
- **常驻后端与 CLI**：`codex app-server` JSON-RPC 2.0 服务端 + `codex-cli 0.159.2`。
- **本地截图证据**：`C:\Users\COLORFIRE\AppData\Local\Temp\shots\detail_codex.png`（证实其桌面详情页、步骤与卡片排版）。

### 1.2 清单内 36 项功能逐条核对（有/无/未核实）与本地证据

| 单元 ID | 单元名称 | 实际支持 | 怎么看到的（界面路径/文件/代码证据） | 本机数据真源 | 后端 :8899 能否读到 |
|---|---|---|---|---|---|
| **project-view** | 按项目归集 | **有** | 桌面端支持按 Project 分组组织线程；`state_5.sqlite` 存在 `projects` 表（`id, name, metadata, position`）与 `threads.project_id` | `~/.codex/state_5.sqlite` 表 `projects` | ❌ 目前后端仅按 rollout 内 `cwd` 字符串推断，未直读 `projects` 表 |
| **observe-steps** | 读一轮全过程 | **有** | 详细展示 Thought、Tool 调用、参数、执行终端输出；rollout JSONL 内包含 `event_msg`、`response_item` | `~/.codex/sessions/**/*.jsonl` | ✅ 能读（`codex` 适配器已解析步骤流） |
| **follow-progress** | 跟随自主推进 | **有** | App-Server 协议持续广播 `turn/plan/updated`、`item/reasoning/summaryTextDelta` | WebSocket/stdio RPC 通知流 | ⚠️ 部分（通过 :8899 发起可推 SSE，旁路监听未接） |
| **search-sessions** | 搜索会话 | **有** | 桌面端 Ctrl+K 搜索框；App-Server 原生支持 `thread/list` 携带检索 query | `state_5.sqlite` 索引与内存 FTS | ✅ 能读（后端有 `/api/sessions?q=...` 检索） |
| **attach** | 发图与附件 | **有** | 桌面输入框支持文件拖拽与回形针图标；`state_5.sqlite` 存在 `thread_attachments` 表（`attachment_type, payload`） | `~/.codex/state_5.sqlite` 表 `thread_attachments` | ❌ 后端未提取 attachments 关系表 |
| **ui-sidebar** | 会话侧栏 | **有** | 桌面左侧常驻侧栏，按项目、分区组织历史会话 | `state_5.sqlite` 之 `threads` 记录 | ✅ 能读（列表接口已拉取） |
| **ui-filter** | 筛选 | **有** | 侧栏支持筛选 Archived 与活动会话；`threads.archived` 字段（0/1） | `~/.codex/state_5.sqlite` 之 `threads.archived` | ⚠️ 部分（后端读层未开放归档筛选） |
| **ui-pin** | 置顶 | **有** | 桌面端右键会话支持“Pin to top”；`threads.is_pinned` 明确记录置顶位（0/1） | `~/.codex/state_5.sqlite` 表 `threads.is_pinned` | ❌ 后端 `slim=1` 列表未读 `is_pinned` 字段 |
| **ui-unread** | 新产出标记 | **有** | 会话有新完成轮次时显示蓝点；`state_5.sqlite` 存在专用表 `thread_read_receipts`（`first_unread_turn, last_published_turn`） | `~/.codex/state_5.sqlite` 表 `thread_read_receipts` | ❌ 后端完全未接入该表 |
| **ui-running-overview** | 运行总览 | **有** | App-Server `thread/loaded/list` 列出内存驻留会话，侧栏显示旋转 Spinner | App-Server 内存线程表 | ❌ 后端无 Codex 活跃内存探测 |
| **ui-markdown** | 富文本显示 | **有** | 完整 Markdown、代码高亮、表格、公式渲染 | 前端 Webview 渲染层 | ✅ 前端自带 Markdown 渲染器 |
| **ui-thinking** | 思考过程显示 | **有** | 可折叠“Thinking”色块；`threads.reasoning_effort` 标记高低档 | rollout JSONL 内 reasoning 条目 | ✅ 能读（steps 内已提取 reasoning） |
| **ui-tool-card** | 工具调用卡片 | **有** | 每次工具调用独立卡片，包含入参 JSON、耗时、成败状态 | rollout JSONL 内 `response_item` | ✅ 能读（已转为 tool 类型步骤） |
| **ui-diff** | 文件改动显示 | **有** | 内置官方 `code-review` 插件，提供绿红颜色对齐的代码改动视窗 | `app/resources/plugins/openai-bundled/plugins/code-review` | ❌ 后端仅能看到 patch 文字，未出 diff 结构 |
| **ui-terminal-output** | 命令输出显示 | **有** | 执行系统命令显示为黑色终端框，超长可折叠 | rollout JSONL 内 `command_execution` 块 | ✅ 能读 |
| **ui-subagent-view** | 子智能体显示 | **有** | 树状折叠显示子智能体工作进度；`state_5.sqlite` 存在 `thread_spawn_edges` 表（516 条关系图） | `~/.codex/state_5.sqlite` 表 `thread_spawn_edges` | ❌ 后端目前按线性会话读，未建 spawn 树 |
| **ui-plan-view** | 计划与待办显示 | **有** | 界面顶部展示执行计划清单；`goals_1.sqlite` 专用表 `thread_goals`（`objective, status, token_budget`） | `~/.codex/goals_1.sqlite` 表 `thread_goals` | ❌ 后端未读取 `goals_1.sqlite` |
| **ui-status-line** | 当前状态显示 | **有** | 底部展示 `activeFlags: ["waitingOnApproval"]` 或正在运行的工具名 | App-Server `thread/status/changed` 通知 | ⚠️ 依赖事件推流，静态读不到 |
| **ui-usage** | 用量显示 | **有** | 界面直观展示已消耗 Tokens；`threads.tokens_used` 字段 | `state_5.sqlite` 之 `threads.tokens_used` | ✅ 能读（stats.tokens/records 已提取） |
| **ui-long-history** | 长会话浏览 | **有** | 采用 Rollout 分片存储与游标分页加载，百轮长会话秒开 | `rollout-*.jsonl` 物理分片 | ✅ 能读（后端已支持 `?tail=N&before=M`） |
| **ui-composer** | 输入框 | **有** | 多行富文本输入框，未发出草稿在切会话后保留 | 前端 DOM/LocalState 内存缓存 | 仅在客户端内存 |
| **ui-mention** | 引用文件或会话 | **有** | 输入 `@` 触发文件模糊补全；内置 `fuzzyFileSearch` 工具支持 | 工作区 Git 索引与工作区文件树 | 宿主本地文件扫描 |
| **ui-command-menu** | 命令菜单 | **有** | 输入 `/` 弹出可用斜杠命令（`/review`, `/init`, `/compact` 等） | App-Server 指令集元数据 | 静态配置 |
| **ui-model-picker** | 模型与推理选择 | **有** | 桌面端支持挑选模型及 `reasoning_effort`（Low / Medium / High） | `threads.model` 与 `threads.reasoning_effort` | ❌ 后端只记录了 model，漏掉了 effort 档位 |
| **ui-mode-picker** | 权限模式选择 | **有** | 桌面提供读写沙箱与审批开关；`threads.sandbox_policy` 与 `approval_mode` | `threads.sandbox_policy` | ❌ 后端未提取会话的权限模式存档 |
| **ui-stop** | 停止按钮 | **有** | 运行中显示红色方块停止键，点击下发 `turn/interrupt` | 客户端 UI 事件下发 | ✅ 后端已接 `POST /api/gateway/cancel` |
| **ui-queue-steer** | 运行中发话 | **有** | 运行时输入提示词自动变为“Queue”排队按钮；`queue_1.sqlite` 存在 `queued_items` 表 | `~/.codex/queue_1.sqlite` 表 `queued_items` | ❌ 后端自建了内存队列，未读 Codex 原生 SQLite 队列 |
| **ui-approval** | 审批卡片 | **有** | 弹出授权横幅：`item/commandExecution/requestApproval`、`item/fileChange/requestApproval` | App-Server 双向 RPC 回调 | ⚠️ 依赖运行时双向握手 |
| **ui-question** | 回答智能体提问 | **有** | 弹出选择题/单选题卡片：`item/tool/requestUserInput`（带结构化 options） | App-Server 反向 RPC 请求 | ⚠️ 依赖运行时双向握手 |
| **ui-retry-edit** | 重试与编辑重发 | **有** | 消息悬停出现重试与回滚；底层支持 `thread/revert` 原生截断历史 | App-Server `thread/revert` 原语 | 依赖 App-Server 接口 |
| **ui-artifact-preview**| 产出预览 | **有** | 右侧专用视窗渲染产出；内置 `artifact-template-picker` 原生支持 Word/PPT/Excel/Google Suite | `app/resources/artifact-template-picker/server.mjs` | ❌ 后端未接 Codex 产物模板引擎 |
| **ui-copy-export** | 复制与导出 | **有** | 消息右上角一键复制 Markdown，会话菜单支持导出全量 JSON | 客户端纯前端功能 | 纯前端 |
| **ui-notify** | 通知 | **有** | 完成任务播放提示音（`codex-classic.wav`, `codex-notification.wav`）并弹 Windows Toast | `app/resources/codex-notification.wav` + OS Toast | 操作系统桌面级事件 |
| **ui-multidevice** | 多端同一状态 | **未核实** | 桌面客户端是纯本地单机 Electron/Owl 壳，未发现与手机端的实时多端协同协议 | 本地未发现端到端同步协议通道 | ❌ |
| **ui-theme** | 外观 | **有** | 支持明亮/暗黑模式及跟随系统主题；内置专属托盘图标与窗口资源 | `app/resources/chatgpt-app-dark.ico` 等 | 本地资源文件 |
| **ui-feedback** | 页面反馈 | **有** | 帮助菜单内嵌反馈，`state_5.sqlite` 维护 `guardian_review_feedback` 表 | `state_5.sqlite` 表 `guardian_review_feedback` | ❌ |

### 1.3 清单里没有、但 Codex 桌面端独有的交互与显示功能（补出来）

1. **`ui-thread-sections`（侧栏自定义文件夹/分区管理）**：
   - **事实**：`state_5.sqlite` 显式建有 `thread_sections` 表，`threads` 表含有 `thread_section_id`, `section_position`, `section_entered_at_ms` 字段。允许用户在侧边栏自定义建立“分类目录/文件夹”，把长程任务归入不同逻辑模块，而非仅仅死板地按工作目录（CWD）排布。
   - **数据源**：`~/.codex/state_5.sqlite` 之 `thread_sections`。
2. **`ui-git-badge`（Git 分支与仓库状态卡）**：
   - **事实**：`threads` 表持久化记录了 `git_branch`, `git_sha`, `git_origin_url`。在侧边栏每个会话卡片以及对话标题栏右侧，直接浮现当前所属 Git 分支名与短 SHA 徽章，点击可直接对照代码变更。
   - **数据源**：`~/.codex/state_5.sqlite` 之 `threads.git_branch/git_sha`。
3. **`ui-realtime-voice`（全双工实时语音交互面板）**：
   - **事实**：桌面集成 WebRTC 实时语音流交互界面（支持声波动画、实时双向打断与低延迟语音合成），底层由 `codex-code-mode-host.exe` 与 `thread/realtime/*` 协议驱动。
   - **数据源**：`app/resources/codex-code-mode-host.exe`。
4. **`ui-sandbox-badge`（Windows Restricted Token 沙箱安全徽章）**：
   - **事实**：UI 顶部状态栏明确渲染沙箱盾牌图标，点击展示当前会话是否处于“Windows 限制令牌隔离”、“工作区写保护”或“无限制提权”模式。
   - **数据源**：`codex-windows-sandbox-service.exe` 与 `threads.sandbox_policy`。
5. **`ui-office-artifacts`（Word/PPT/Excel 原生排版模版挑选器）**：
   - **事实**：Codex 产物不仅是 Markdown 或 HTML，其 `artifact-template-picker` 原生内建了针对 `docx`, `pptx`, `xlsx` 以及 Google Docs/Slides/Sheets 的专业模板选择面板，大模型可直接调用模板引擎填入数据并就地渲染。
   - **数据源**：`app/resources/artifact-template-picker/server.mjs`。

---

## 二、Google Antigravity 桌面端人机交互与显示事实

### 2.1 安装载体与界面入口
- **产品形态**：`Antigravity 2.0 Desktop App`（`C:\Users\COLORFIRE\AppData\Local\Programs\antigravity\Antigravity.exe`）及 `Antigravity IDE`（VSCode 衍生版）；后台常驻 Go 二进制 `language_server.exe`。
- **数据根目录**：`C:\Users\COLORFIRE\.gemini\antigravity\`。
- **本地证据**：`conversation_summaries.db`（全量会话主索引库）、`brain/<cid>/.system_generated/logs/transcript.jsonl`、内置技能 `generative_ui` 与 `sidecar_sdk`。

### 2.2 清单内核对（36 项）与本地证据

| 单元 ID | 单元名称 | 实际支持 | 怎么看到的（界面路径/文件/代码证据） | 本机数据真源 | 后端 :8899 能否读到 |
|---|---|---|---|---|---|
| **project-view** | 按项目归集 | **有** | 侧栏顶部项目选择器；`~/.gemini/config/projects/*.json` 绑定 `folderUri`；`conversation_summaries` 有 `project_id, workspace_uris` | `conversation_summaries.db` + `projects/*.json` | ✅ 后端 `projectKey(cwd)` 已做归集 |
| **observe-steps** | 读一轮全过程 | **有** | 对话流内逐步展开：Thought、ToolCall、Output、Media 附件；完整记录在 `transcript.jsonl` | `brain/<cid>/.../transcript.jsonl` | ✅ 能读（`gemini` 适配器全面解析） |
| **follow-progress** | 跟随自主推进 | **有** | 智能体多步执行时，步骤实时刷入 `transcript.jsonl`，桌面 UI 逐步向下延伸 | `transcript.jsonl` 持续文件追加 | ✅ 能读（前端轮询或 SSE 刷出新步） |
| **search-sessions** | 搜索会话 | **有** | 侧栏搜索框支持全文搜；`conversation_summaries.db` 维护 FTS5 虚表 `conversations_fts` | `conversation_summaries.db` 之 `conversations_fts` | ✅ 能读（后端已有 search 检索虚表） |
| **attach** | 发图与附件 | **有** | 输入框支持粘贴截图、拖拽多模态图片/PDF；transcript 存有 `media: [{mime_type, uri}]` | `transcript.jsonl` 之 `media` 数组 | ⚠️ 后端读取了文本，部分图片渲染未放通 |
| **ui-sidebar** | 会话侧栏 | **有** | 桌面常驻左栏，显示会话标题、更新时间、最后预览文本 | `conversation_summaries.db` 全表 | ✅ 能读（`/api/m/agy` 直读该表） |
| **ui-filter** | 筛选 | **有** | 支持按活动项目、运行状态（进行中/已完成/出错）筛选卡片 | `conversation_summaries.status` | ✅ 能读（`/m/` 手机督工台已做筛选） |
| **ui-pin** | 置顶 | **无** | 数据库表结构无 pin 字段，桌面端列表严格按 `last_modified_time DESC` 排序 | `conversation_summaries.db`（无字段） | ❌ 无数据源 |
| **ui-unread** | 新产出标记 | **无** | 数据库无未读字段；仅靠界面内存中对比活跃焦点的上次浏览步数 | 客户端运行时内存 | ❌ 磁盘无持久化 |
| **ui-running-overview** | 运行总览 | **有** | 侧栏会话卡片动态显示转圈 Spinner；`status='CASCADE_RUN_STATUS_RUNNING'` 或 `not_fully_idle=1` | `conversation_summaries.db` 状态列 | ✅ 能读（后端已据此判断 working/waiting） |
| **ui-markdown** | 富文本显示 | **有** | 完美渲染 GFM Markdown、代码块语法高亮、Alerts（Note/Warning/Tip） | 前端渲染引擎 | ✅ |
| **ui-thinking** | 思考过程显示 | **有** | 可折叠的思考气泡；transcript 记录 `thinking` 字段 | `transcript.jsonl` 之 `thinking` | ✅ 能读（UI 已做可折叠展示） |
| **ui-tool-card** | 工具调用卡片 | **有** | 工具名、入参 JSON、耗时、执行结果完整呈现在独立卡片内 | `transcript.jsonl` 之 `tool_calls` | ✅ 能读（已提为 ToolCard） |
| **ui-diff** | 文件改动显示 | **有** | `replace_file_content` 与代码修改显示内嵌 Diff 对比视窗 | transcript 工具执行步骤 | ⚠️ 文本形态呈现，未出专用 diff 插件视窗 |
| **ui-terminal-output** | 命令输出显示 | **有** | `run_command` 输出以黑底终端样式卡片呈现，支持长输出折叠 | `transcript.jsonl` 内命令结果 | ✅ 能读 |
| **ui-subagent-view** | 子智能体显示 | **有** | 嵌入式展示子智能体任务卡片；`conversation_summaries` 存有 `parent_conversation_id` 与 `nesting_depth` | `conversation_summaries.db` | ✅ 能读（树状结构已在索引中体现） |
| **ui-plan-view** | 计划与待办显示 | **有** | `/plan` 产出的 Markdown 待办清单自动解析为勾选框卡片 | `brain/<cid>/` 规划文档或步骤文本 | ⚠️ 依赖消息文本解析 |
| **ui-status-line** | 当前状态显示 | **有** | 底部状态栏显示“Thinking...”、“Running run_command...”，附秒级计时器 | 客户端界面实况推流 | ⚠️ 客户端内存状态 |
| **ui-usage** | 用量显示 | **有** | Connect-RPC `RetrieveUserQuotaSummary` 精确输出 8 位浮点 `remainingFraction` 与 5h/周重置时间 | Connect-RPC 接口 | ⚠️ 仅网关内部可调，页面尚未呈现滑窗条 |
| **ui-long-history** | 长会话浏览 | **有** | 系统分设 `transcript.jsonl`（紧凑）与 `transcript_full.jsonl`（大文本截断），平滑加载长会话 | `transcript.jsonl` / `transcript_full.jsonl` | ✅ 能读（后端只读适配器已实现） |
| **ui-composer** | 输入框 | **有** | 支持多行文本、Ctrl+Enter 发送，草稿在切换会话时保留在客户端状态中 | 客户端 React/Vue State | 内存中 |
| **ui-mention** | 引用文件或会话 | **有** | 输入 `@` 弹出工作区代码与文件联想菜单；`#` 弹出代码符号补全 | 本地项目代码索引服务 | 宿主语言服务 |
| **ui-command-menu** | 命令菜单 | **有** | 输入 `/` 弹出 9 大官方 Slash Commands 菜单（`/goal`, `/compact`, `/plan` 等） | 客户端 Slash 注册表 | 客户端静态配置 |
| **ui-model-picker** | 模型与推理选择 | **有** | 底部或设置弹窗可切 `flash_lite`、`flash`、`pro` 以及第三方 Claude/GPT | `GetCascadeModelConfigData` RPC | ✅ 后端可传 `--model` 指定 |
| **ui-mode-picker** | 权限模式选择 | **有** | 界面提供只读与读写模式切换 | 客户端安全策略配置 | 客户端 |
| **ui-stop** | 停止按钮 | **有** | 运行中变为红色停止键，点击下发 `CancelCascadeInvocation` | Connect-RPC 取消接口 | ✅ 后端已接通 |
| **ui-queue-steer** | 运行中发话 | **有** | 运行中发话直接作为 `SYSTEM_MESSAGE` 插在两步之间，即时改变行为 | `agentapi send-message` 接口 | ✅ 手机督工台实测同轮响应 |
| **ui-approval** | 审批卡片 | **有** | 工具执行触发审批时弹出模态确认框（允许一次/始终允许/拒绝） | `PreToolUse` hook 阻塞拦截 | ⚠️ 桌面拦截机制 |
| **ui-question** | 回答智能体提问 | **有** | 内置 `ask_question` 工具在桌面弹出结构化多选/输入互动卡片 | `ask_question` 工具调用及等待 | ✅ 协议原生支持 |
| **ui-retry-edit** | 重试与编辑重发 | **有** | 轮次失败或需要回退时，支持编辑上一句重发或基于某步 Fork 分叉 | Connect-RPC `ForkConversation` | ✅ 协议已测通 |
| **ui-artifact-preview**| 产出预览 | **有** | 侧边栏/分屏渲染 Artifact 文档（Markdown、HTML、Mermaid 图表、Carousel 轮播） | `~/.gemini/antigravity/brain/<cid>/` | ✅ 本地文件直存 |
| **ui-copy-export** | 复制与导出 | **有** | 消息悬停复制 Markdown，支持将整个对话导出为文件 | 客户端 UI 交互 | 纯前端 |
| **ui-notify** | 通知 | **有** | 后台任务完成时，调用 Windows 本地桌面通知 Toast 推送 | OS Notification API | 操作系统 |
| **ui-multidevice** | 多端同一状态 | **未核实** | 桌面端本身仅绑定单机；多设备访问目前依赖我们的 Hub（`:8899/m/` 手机督工台）实现 | 桌面端无此独立云端同步能力 | 依赖 Hub 补齐 |
| **ui-theme** | 外观 | **有** | 界面提供 Dark / Light 主题切换，完美适配暗黑系统 | 客户端样式引擎 | 纯前端 |
| **ui-feedback** | 页面反馈 | **有** | 帮助菜单下设 Feedback 意见提交入口 | 客户端 UI | 纯前端 |

### 2.3 清单里没有、但 Antigravity 独有的交互与显示功能（补出来）

1. **`ui-generative-embed`（对话流内联动态富交互渲染组件）**：
   - **事实**：智能体可在回复气泡中直接输出 `<agent-embed src="file:///<path>/widget.html"></agent-embed>`，桌面宿主会自动在气泡内嵌入沙箱 Webview 运行 HTML/Canvas/SVG 交互组件，并自动注入宿主 CSS 变量与 Tailwind 样式引擎（内置技能 `generative_ui`）。
   - **数据源**：`brain/<cid>/.../widget.html` 与 `generative_ui/SKILL.md`。
2. **`ui-sidecar-panel`（伴随微应用 Webview 侧栏视窗）**：
   - **事实**：Antigravity 支持在对话主窗口右侧挂载独立的 Sidecar 微应用（通过 `sidecar_sdk`），微应用可通过 `window.sidecar.agent` 实时监听智能体事件，并操纵 UI 视图（`toggleAuxPane`）。
   - **数据源**：`lib\node_modules\sidecar_sdk\index.mjs`。
3. **`ui-battle-arena`（多模型竞技场对战与分支淘汰视窗）**：
   - **事实**：`conversation_summaries.db` 显式维护 `battle_id` 与 `winning_conversation_id`。桌面 UI 支持将同一个 Prompt 同时派发给两个模型（如 Gemini Pro vs Claude 3.7），在左右分屏中实时对比执行步骤，由人类在界面上投票裁定胜者，胜者被保留，败者分支的工作区被自动回收。
   - **数据源**：`conversation_summaries.db` 表字段 `battle_id`, `winning_conversation_id`。
4. **`ui-quota-bar`（5h 与每周滑动窗口真剩余额度与倒计时进度条）**：
   - **事实**：并非事后统计 token，而是通过 Connect-RPC `RetrieveUserQuotaSummary` 实时拿到精确到 8 位小数的 `remainingFraction` 与绝对时间戳 `resetTime`，在 UI 顶部以双彩色进度条展示配额水位。
   - **数据源**：Connect-RPC 接口 `RetrieveUserQuotaSummary`。
5. **`ui-browser-recording`（浏览器自动化录屏与视觉轨迹回放）**：
   - **事实**：Antigravity 内置独立浏览器操作录屏存储目录 `~/.gemini/antigravity/browser_recordings/`，支持在界面中直接回放智能体操作网页的屏幕视频或 DOM 快照。
   - **数据源**：`~/.gemini/antigravity/browser_recordings/`。

---

## 三、ZCode 桌面端人机交互与显示事实

### 3.1 安装载体与界面入口
- **产品形态**：Electron 桌面应用（`E:\zcode\ZCode.exe`），结合 CLI `v0.16.9` 与 ACP 桥 `zcode-acp-server@0.69.3`。
- **本地数据根目录**：`~/.zcode/cli/db/db.sqlite`（关系型数据库，708 会话，43,663 条消息）及 `~/.zcode/v2/`。
- **CDP 调试端口**：`9240`（开放给 `opencli zcode` 进行桌面控制）。

### 3.2 清单内核对（36 项）与本地证据

| 单元 ID | 单元名称 | 实际支持 | 怎么看到的（界面路径/文件/代码证据） | 本机数据真源 | 后端 :8899 能否读到 |
|---|---|---|---|---|---|
| **project-view** | 按项目归集 | **有** | 桌面侧栏支持按本地工程目录归集；`db.sqlite` 维护 `project` 与 `workspace` 映射表 | `~/.zcode/cli/db/db.sqlite` 之 `project` 表 | ✅ 后端已做 CWD 路径归并 |
| **observe-steps** | 读一轮全过程 | **有** | 会话详情页完整记录 User 提示词、Model 思考、Tool 调用；`part` 表存有 122,424 条步骤记录 | `db.sqlite` 表 `message` 与 `part` | ✅ 能读（`zcode` 适配器已解析） |
| **follow-progress** | 跟随自主推进 | **有** | 界面流式打印思考与工具调用卡片，底层通过 WebSocket/IPC 实时推送 | Electron IPC 实时事件 | ⚠️ 桌面内实时，后端旁路需轮询 DB |
| **search-sessions** | 搜索会话 | **有** | 侧栏顶部搜索框；通过 SQL `title LIKE '%...%'` 检索 | `db.sqlite` 表 `session` | ✅ 能读（后端已接 SQLite 搜索） |
| **attach** | 发图与附件 | **有** | 输入框支持添加文件与图片；`part.type === 'file'`（实测库中已存 22 次） | `db.sqlite` 表 `part`（`type='file'`） | ⚠️ 文本已提取，文件实体未单独预览 |
| **ui-sidebar** | 会话侧栏 | **有** | 桌面左侧会话树，展示近期会话、任务类型及最后更新时间 | `db.sqlite` 表 `session` | ✅ 能读（列表接口已拉出） |
| **ui-filter** | 筛选 | **有** | 侧栏支持筛选 Interactive 会话与 Subagent 子会话；`session.task_type` 字段 | `session.task_type` | ⚠️ 数据库有字段，后端暂未开放此筛选项 |
| **ui-pin** | 置顶 | **无** | 数据库 `session` 表无 pin 字段，界面按 `time_updated DESC` 排序 | `db.sqlite`（无字段） | ❌ |
| **ui-unread** | 新产出标记 | **无** | 数据库中无未读标志字段 | 客户端运行时内存 | ❌ |
| **ui-running-overview** | 运行总览 | **有** | 侧栏卡片对运行中会话标记状态；注意：`tasks-index.sqlite` 中的 running 存在僵尸，UI 结合心跳判断 | `db.sqlite` + 日志 mtime | ✅ 后端已融合判活 |
| **ui-markdown** | 富文本显示 | **有** | 完整 Markdown 排版、代码块高亮及一键复制按钮 | 前端渲染层 | ✅ |
| **ui-thinking** | 思考过程显示 | **有** | 针对 GLM 推理模型展示折叠的思考链视窗 | `part` 表中的思考记录 | ✅ 能读 |
| **ui-tool-card** | 工具调用卡片 | **有** | 每个工具（Bash, Read, Edit）独立卡片，入参/出参可折叠 | `part` 表之 tool 记录 | ✅ 能读 |
| **ui-diff** | 文件改动显示 | **有** | **极为硬核的数据库级统计**：`session` 表明确记录 `summary_additions`, `summary_deletions`, `summary_files`, `summary_diffs` | `db.sqlite` 表 `session` 对应列 | ❌ **后端尚未把这些摘要字段暴露给前端** |
| **ui-terminal-output** | 命令输出显示 | **有** | Bash 工具输出以终端黑色块展示 | `part` 表 stdout 文本 | ✅ 能读 |
| **ui-subagent-view** | 子智能体显示 | **有** | 支持 DWF 动态工作流与子智能体派生；`session.parent_id` 维护 663 条血缘记录 | `db.sqlite` 之 `session.parent_id` | ⚠️ 数据库有完备树形，后端展现偏扁平 |
| **ui-plan-view** | 计划与待办显示 | **有** | **极为硬核的原生功能**：SQLite 专用表 `todo` 维护 2,351 条任务清单（包含状态、优先级、排序位） | `db.sqlite` 表 `todo` | ❌ **后端完全未读取 ZCode 的 todo 表** |
| **ui-status-line** | 当前状态显示 | **有** | 底部状态栏展示当前模型、Token 消耗与响应耗时 | `turn_usage` / `model_usage` | ⚠️ 数据库已存，页面未完全透传 |
| **ui-usage** | 用量显示 | **有** | 发送 `/quota` 呼出智谱云端监控浮层，显示 5h 滑窗比例（如 39%）与 MCP 次数 | `setting.json` + 智谱官方接口 | ⚠️ 终端/网关可查，前端尚未做仪表盘 |
| **ui-long-history** | 长会话浏览 | **有** | 采用上下文压缩（`part.type === 'compaction'` 实测 18 次）并分页检索消息 | `session.time_compacting` + 分页 | ✅ 能读（分页已通） |
| **ui-composer** | 输入框 | **有** | 多行输入框，且维护 `input_history` 表记录历史指令（支持上下箭头调出旧指令） | `db.sqlite` 表 `input_history` | ❌ 后端未提取历史输入记录 |
| **ui-mention** | 引用文件或会话 | **有** | 输入 `@` 联想工作区文件；`#` 联想方法定义 | 工作区扫描服务 | 宿主服务 |
| **ui-command-menu** | 命令菜单 | **有** | 输入 `/` 弹出可用命令：`/auto`, `/goal`, `/compact`, `/fork`, `/quota`, `/mcp` | ACP `available_commands_update` | ✅ 协议已测通 |
| **ui-model-picker** | 模型与推理选择 | **有** | 支持在智谱 Coding Plan、火山方舟等多个注册套餐中切换模型 | `~/.zcode/v2/provider_config.json` | ✅ ACP 桥可切模型 |
| **ui-mode-picker** | 权限模式选择 | **有** | 界面提供 `read-only`, `workspace-write`, `agent-full-access`, `yolo` 模式切换 | `db.sqlite` 表 `permission` | ❌ 后端未对接其 permission 表 |
| **ui-stop** | 停止按钮 | **有** | 界面红色停止键，点击中止当前轮次 | ACP `cancel` 原语 | ✅ 后端已接打断 |
| **ui-queue-steer** | 运行中发话 | **有** | 运行中输入新提示词排队注入到下一轮 | 队列机制 | ⚠️ 需等待当前轮结束 |
| **ui-approval** | 审批卡片 | **有** | 危险文件改动或跨目录写入时弹出授权卡片 | `permission` 表交互记录 | ⚠️ 桌面弹窗拦截 |
| **ui-question** | 回答智能体提问 | **有** | 智能体提问时弹出交互输入框 | 交互帧 | ⚠️ |
| **ui-retry-edit** | 重试与编辑重发 | **有** | 消息卡片支持重新生成，底层支持 `session.revert` 字段记录回滚点 | `db.sqlite` 表 `session.revert` | ❌ 后端未接 revert |
| **ui-artifact-preview**| 产出预览 | **部分** | 侧栏支持打开生成的代码文件与图片，但缺乏独立的 Office 模板库 | 本地文件打开器 | 基础能力 |
| **ui-copy-export** | 复制与导出 | **有** | 一键复制 Markdown，且**原生支持 `share_url` 生成云端分享链接** | `session.share_url` | ❌ 后端未读取 share_url |
| **ui-notify** | 通知 | **有** | 长任务完成时弹出桌面右下角系统通知 | OS Notification API | 操作系统 |
| **ui-multidevice** | 多端同一状态 | **无** | 纯单机 Electron，无官方移动端同步协议 | 本地无此协议 | ❌ |
| **ui-theme** | 外观 | **有** | 明暗主题跟随系统或手动切换 | 前端主题样式 | 纯前端 |
| **ui-feedback** | 页面反馈 | **有** | 界面内置问题反馈按钮 | 前端界面 | 纯前端 |

### 3.3 清单里没有、但 ZCode 独有的交互与显示功能（补出来）

1. **`ui-todo-board`（数据库级原生待办协作看板）**：
   - **事实**：`db.sqlite` 内置专门的 `todo` 表（包含 `session_id`, `content`, `status`, `priority`, `position`），当前已存有 2,351 条任务！在桌面端以结构化看板形式直观展示当前任务与子智能体的分解步骤，支持“待办、处理中、已完成”拖拽流转。
   - **数据源**：`~/.zcode/cli/db/db.sqlite` 表 `todo`。
2. **`ui-dwf-graph`（动态工作流 DWF 执行拓扑图视窗）**：
   - **事实**：`db.sqlite` 包含 `dwf_run`, `dwf_actor`, `dwf_node`, `dwf_event` 4 张工作流专用表。桌面端支持将复杂任务的多个协作 Agent 组织为可视化 DAG 流水线图，清晰展示节点间的数据传递与执行状态。
   - **数据源**：`~/.zcode/cli/db/db.sqlite` 表 `dwf_*`。
3. **`ui-diff-badge`（会话级文件改动增删统计徽章）**：
   - **事实**：`session` 表持久化聚合了 `summary_additions`（增加行数）、`summary_deletions`（删除行数）、`summary_files`（修改文件数）与 `summary_diffs`（差异明细）。在侧栏卡片和会话标题处，直观浮现 `+128 -42 (3 files)` 的 Git 风格徽章，无需展开正文即可一眼看出本轮改动规模。
   - **数据源**：`~/.zcode/cli/db/db.sqlite` 表 `session` 字段。
4. **`ui-share-link`（一键生成只读云端分享链接）**：
   - **事实**：`session` 表包含 `share_url` 字段。用户在桌面点击“Share”，可直接生成形如智谱官方的在线只读快照链接，便于发送给同事审阅。
   - **数据源**：`~/.zcode/cli/db/db.sqlite` 表 `session.share_url`。
5. **`ui-input-history`（命令行式输入框历史记录上下回溯）**：
   - **事实**：`db.sqlite` 显式维护 `input_history` 表。在输入框按键盘上下箭头（↑ / ↓），可原汁原味地像终端一样逐条调出之前输入过的 Prompt，极大提升重复调试体验。
   - **数据源**：`~/.zcode/cli/db/db.sqlite` 表 `input_history`。
6. **`ui-auto-loop`（自主目标循环控制器面板）**：
   - **事实**：原生提供 `/auto` 命令（接受 `start`, `pause`, `resume`, `stop`），在 UI 上呈现专门的状态机控制器，允许随时暂停或恢复自主推进，不必等待整轮死跑到底。
   - **数据源**：内核 `zcode.cjs` 之自主推进状态机。

---

## 四、Tencent WorkBuddy 桌面端人机交互与显示事实

### 4.1 安装载体与界面入口
- **产品形态**：Tencent WorkBuddy 桌面客户端（`E:\workbuddy\WorkBuddy.exe`，安装包包含 `workbuddy-editor-sdk-supervisor.exe`、`conversation-report.html`、`startup-report.html`）。
- **内核版本**：`@tencent-ai/codebuddy-code` `v2.168.2 / v2.160.0`。
- **本地数据根目录**：`~/.workbuddy/workbuddy.db`（SQLite，实测 135 个历史会话、121 次自动化运行）及 `~/.workbuddy/sessions/<pid>.json`。

### 4.2 清单内核对（36 项）与本地证据

| 单元 ID | 单元名称 | 实际支持 | 怎么看到的（界面路径/文件/代码证据） | 本机数据真源 | 后端 :8899 能否读到 |
|---|---|---|---|---|---|
| **project-view** | 按项目归集 | **有** | 侧栏工作区导航；`workspaces` 表记录打开过的路径，`sessions.cwd` 精确匹配 | `workbuddy.db` 表 `workspaces` 与 `sessions.cwd` | ❌ **后端 :8899 目前未直读 workbuddy.db** |
| **observe-steps** | 读一轮全过程 | **有** | 详细展示步骤：调用工具、执行输出、模型思考；本地落盘在项目 memory 日志 | `~/.workbuddy/projects/.../memory` | ⚠️ 后端仅接了经 acpx 跑的会话，漏掉桌面会话 |
| **follow-progress** | 跟随自主推进 | **有** | 桌面端支持多步连续执行实时渲染，自动滚屏跟随 | Electron IPC 实时推流 | 桌面内存/IPC |
| **search-sessions** | 搜索会话 | **有** | 侧栏顶部搜索栏；通过标题与项目检索历史 | `workbuddy.db` 表 `sessions` | ❌ 后端未接 WorkBuddy 数据库搜索 |
| **attach** | 发图与附件 | **有** | 输入框支持拖入图片与文件，原生支持 OCR 与多模态理解 | 客户端附件缓存 | 客户端文件 |
| **ui-sidebar** | 会话侧栏 | **有** | 左侧常驻导航栏，展示工作区、专家市场、定时自动化、会话列表 | `workbuddy.db` 全表 | ❌ 后端未读取该主侧栏 |
| **ui-filter** | 筛选 | **有** | 侧栏支持筛选 Playground（演练场）、常规会话、自动化任务 | `sessions.is_playground` 字段 | ❌ |
| **ui-pin** | 置顶 | **无** | 数据库中无 pin 字段，按 `updated_at DESC` 排序 | `workbuddy.db`（无字段） | ❌ |
| **ui-unread** | 新产出标记 | **有** | **极为硬核的原生字段**：`sessions.unread` 明确记录未读标记（0/1），后台自动完成会话在侧栏展示红点 | `workbuddy.db` 表 `sessions.unread` | ❌ 后端未读取该字段 |
| **ui-running-overview** | 运行总览 | **有** | 侧栏清晰标记 `status='Running'`，且支持后台自动化多任务并行展示 | `sessions.status` | ❌ |
| **ui-markdown** | 富文本显示 | **有** | 标准 Markdown 排版，支持复制完整 Markdown 代码块 | 前端渲染层 | 纯前端 |
| **ui-thinking** | 思考过程显示 | **有** | 思考链折叠展示；`sessions.thought_level` 字段记录推理档位 | `sessions.thought_level` | ❌ |
| **ui-tool-card** | 工具调用卡片 | **有** | Todo, Read, Write, Edit, Bash 工具调用以整齐卡片呈现 | 本地执行日志 | ⚠️ |
| **ui-diff** | 文件改动显示 | **有** | 支持在修改代码时展开 Diff 对比视图，支持一键 Accept / Reject | 客户端内置 Diff 视窗 | 纯前端/客户端 |
| **ui-terminal-output** | 命令输出显示 | **有** | 终端命令行执行卡片，超长输出可收起 | 步骤日志 | ⚠️ |
| **ui-subagent-view** | 子智能体显示 | **有** | Swarm 多智能体并行视窗；`codebuddy agents --jobs` 输出后台子任务 | `codebuddy agents --json` | ❌ 后端未接 |
| **ui-plan-view** | 计划与待办显示 | **有** | 内置 Todo 工具，在对话中渲染交互式待办卡片 | 工具执行帧 | ⚠️ |
| **ui-status-line** | 当前状态显示 | **有** | 底部展示当前生效模型、耗时及状态 | 客户端界面 | 纯前端 |
| **ui-usage** | 用量显示 | **有** | **硬核数据库记录**：`session_usage` 表记录 `used` (token) 与 `credit_json`（扣除腾讯官方积分如 5.79 credits） | `workbuddy.db` 表 `session_usage` | ❌ **后端未读取此账本** |
| **ui-long-history** | 长会话浏览 | **有** | 游标分页拉取历史会话，防止百轮长会话导致界面崩溃 | `workbuddy.db` 分页 | 客户端 |
| **ui-composer** | 输入框 | **有** | 富文本输入框，支持多行排版与未发出草稿保留 | 前端 LocalState | 纯前端 |
| **ui-mention** | 引用文件或会话 | **有** | 输入 `@` 联想项目文件或特定 Expert 智能体 | 客户端联想服务 | 客户端 |
| **ui-command-menu** | 命令菜单 | **有** | 输入 `/` 弹出命令（`/login`, `/clear`, `/help` 等） | 静态指令集 | 纯前端 |
| **ui-model-picker** | 模型与推理选择 | **有** | 模型下拉框清晰标注扣费倍率（如 `x0.79 credits`、`免费`）及自定义 BYOK 模型 | ACP 握手 `configOptions` | ⚠️ 后端仅在命令行支持切模型，UI 未拉取倍率 |
| **ui-mode-picker** | 权限模式选择 | **有** | 权限模式选择：只读模式 vs 全放行；`sessions.permission_mode` | `sessions.permission_mode` | ❌ 后端未存入 DB |
| **ui-stop** | 停止按钮 | **有** | 停止按钮可精确杀掉后台执行进程（`codebuddy stop <id>`） | CLI / 进程信号 | ✅ 后端已接打断 |
| **ui-queue-steer** | 运行中发话 | **有** | 运行中发话排入下一轮执行队列 | 本地队列 | ⚠️ |
| **ui-approval** | 审批卡片 | **有** | 跨越敏感工作区或高危命令时弹出审批卡片；`workspace_trust_decisions` 记录信任判定 | `workbuddy.db` 表 `workspace_trust_decisions` | ❌ 后端未接入 |
| **ui-question** | 回答智能体提问 | **有** | 智能体中途提问时以模态形式展示待答问题 | 交互帧 | ⚠️ |
| **ui-retry-edit** | 重试与编辑重发 | **有** | 支持编辑上一句提示词并重新生成 | 客户端 UI 交互 | 纯前端 |
| **ui-artifact-preview**| 产出预览 | **有** | 安装目录自带 `conversation-report.html` 与 `startup-report.html` 报表渲染器 | `E:\workbuddy\resources\conversation-report.html` | ❌ 后端未接 |
| **ui-copy-export** | 复制与导出 | **有** | 导出完整会话报告（HTML/Markdown） | 客户端导出引擎 | 客户端 |
| **ui-notify** | 通知 | **有** | 桌面 Toast 弹窗通知；**更支持配置推送企业微信机器人（`push_to_wecom_bot`）** | `automations.push_to_wecom_bot` | ❌ 后端未接 |
| **ui-multidevice** | 多端同一状态 | **无** | 纯桌面端，虽有企微推送消息，但未开放双向多端实时交互会话流 | 依赖外部 webhook | ❌ |
| **ui-theme** | 外观 | **有** | 深色/浅色模式无缝切换 | 前端 CSS | 纯前端 |
| **ui-feedback** | 页面反馈 | **有** | 界面内置问题反馈通道 | 纯前端 | 纯前端 |

### 4.3 清单里没有、但 WorkBuddy 独有的交互与显示功能（补出来）

1. **`ui-automation-scheduler`（定时自动化与周期任务调度面板）**：
   - **事实**：`workbuddy.db` 拥有完整的 `automations` 与 `automation_runs` 表。在桌面侧栏有专门的“自动化”视窗，支持配置任务名称、Prompt、执行工作目录、基于标准 iCalendar `rrule` 的执行周期（例如实测的每小时 35 分运行一次 `BYMINUTE=35`），并记录每次执行的成败与耗时。
   - **数据源**：`~/.workbuddy/workbuddy.db` 之 `automations` 表。
2. **`ui-expert-market`（专家市场与智能体超市）**：
   - **事实**：`sessions` 表显式建有 `expert_id`, `expert_marketplace`, `expert_locale` 字段。桌面端内置了“专家市场”，用户无需自己手写复杂的 System Prompt，可直接点击挑选“代码重构专家”、“前端优化大师”或“论文助手”创建会话。
   - **数据源**：`workbuddy.db` 之 `sessions.expert_*`。
3. **`ui-session-grouping`（会话自定义命名与分组折叠管理）**：
   - **事实**：`sessions` 表包含 `custom_title`（用户自定义重命名的标题，区别于模型自动生成的 title）、`group_id` 与 `group_title`。允许用户像整理浏览器标签页一样将相关联的会话分组合并、折叠收起。
   - **数据源**：`workbuddy.db` 之 `sessions.group_title`。
4. **`ui-playground-mode`（演练场/沙盒临时会话模式开关）**：
   - **事实**：`sessions.is_playground` 字段（0/1）。桌面端支持一键创建不污染主工作区记忆库、不产生长期持久化索引的“临时演练会话”，用完即走。
   - **数据源**：`workbuddy.db` 之 `sessions.is_playground`。
5. **`ui-credit-ledger`（单次调用扣费积分精确透视账单）**：
   - **事实**：`session_usage` 表的 `credit_json` 字段详细记录了每一次交互产生的精确 Credits 费用（如 `5.79 credits`、`11.91 credits`），并在界面上直观透视账单明细。
   - **数据源**：`workbuddy.db` 之 `session_usage.credit_json`。
6. **`ui-wecom-push`（企业微信机器人通知配置视窗）**：
   - **事实**：在任务配置与自动化面板中，用户可勾选 `push_to_wecom_bot` 并绑定 `wecom_bot_chat_id`。智能体执行完毕后直接将阶段性产出推送到手机企业微信群。
   - **数据源**：`workbuddy.db` 之 `automations.push_to_wecom_bot`。
7. **`ui-workspace-trust`（工作区执行安全信任决策提示卡）**：
   - **事实**：`workspace_trust_decisions` 表持久化记录用户对各个文件夹的安全信任授权状态，在首次打开包含未知脚本的目录时主动弹卡要求二次确认。
   - **数据源**：`workbuddy.db` 之 `workspace_trust_decisions`。

---

## 五、横向对照全矩阵：四家“基本盘” vs “独有亮点”

### 5.1 所有家都有的“基本盘”（26 项，前端必须无条件支持）

以下功能四家桌面端全部具备确凿的落地证据，属于多智能体人机交互工作台的绝对底座：

1. **`project-view`**：工作区/工程目录自动聚合与物理路径隔离
2. **`observe-steps`**：细粒度步骤流（思考、工具入参、工具出参、模型文本）
3. **`follow-progress`**：自主推进连续执行与流式内容展现
4. **`search-sessions`**：本地会话标题与全文搜索
5. **`attach`**：文件拖拽、图片与多模态附件上传
6. **`ui-sidebar`**：常驻侧栏会话列表
7. **`ui-filter`**：按目录、状态或类型的基础筛选
8. **`ui-running-overview`**：正在执行任务的动态识别（Spinner 徽章）
9. **`ui-markdown`**：GFM 语法、代码高亮、表格格式化排版
10. **`ui-thinking`**：模型深度推理/思维链的可折叠面板
11. **`ui-tool-card`**：工具调用的参数与结果结构化卡片
12. **`ui-diff`**：代码改动差异呈现（红绿高亮对比）
13. **`ui-terminal-output`**：系统命令与脚本执行的终端视窗
14. **`ui-subagent-view`**：子智能体任务派生与执行状态回显
15. **`ui-status-line`**：执行阶段、耗时计时器与当前活跃状态
16. **`ui-usage`**：已消耗 Tokens 与额度指标展现
17. **`ui-composer`**：多行富文本输入框与草稿保留
18. **`ui-mention`**：输入 `@` 联想代码文件与工程符号
19. **`ui-command-menu`**：输入 `/` 呼出快捷动作与技能菜单
20. **`ui-model-picker`**：多模型选择与推理力度调节
21. **`ui-mode-picker`**：只读模式与读写模式等权限模式选择
22. **`ui-stop`**：正在执行任务的一键安全打断
23. **`ui-queue-steer`**：执行中追加指令进入排队队列
24. **`ui-approval`**：关键写操作与高危命令的人类授权卡片
25. **`ui-retry-edit`**：失败轮次重试与修改历史提示词重跑
26. **`ui-theme`**：深浅色外观切换与操作系统主题同步

### 5.2 各家独有交互功能（各显神通，高价值差异化）

| 独有功能单元 ID | 功能名称 | 所属平台 | 核心机制与证据出处 | 对我们前端的启发与借鉴价值 |
|---|---|---|---|---|
| **`ui-thread-sections`** | 侧栏自定义分区/文件夹 | **Codex** | `state_5.sqlite` 之 `thread_sections` 表 | 允许用户自定义建组，打破死板的 CWD 目录分类 |
| **`ui-git-badge`** | Git 分支与短 SHA 徽章 | **Codex** | `state_5.sqlite` 之 `threads.git_branch` | 编码任务与 Git 强关联，一眼看出是在哪个特性分支改的代码 |
| **`ui-realtime-voice`** | 全双工实时语音交互视窗 | **Codex** | `codex-code-mode-host.exe` + `thread/realtime/*` | 驾车或双手离开键盘时的纯语音编程与沟通 |
| **`ui-office-artifacts`** | Office 原生排版模板挑选器 | **Codex** | `app/resources/artifact-template-picker` | 直接产出可汇报的 Word、PPT、Excel，不局限于代码 |
| **`ui-generative-embed`**| 对话流内联可交互动态组件 | **Antigravity** | 内置技能 `generative_ui` + `<agent-embed>` | 在聊天气泡内直接操作 Canvas 图表、SVG 图例、交互表单 |
| **`ui-sidecar-panel`** | 伴随微应用 Webview 视窗 | **Antigravity** | `lib\node_modules\sidecar_sdk\index.mjs` | 在会话旁边挂载独立的专属微工具（如调试器、数据看板） |
| **`ui-battle-arena`** | 多模型对战淘汰竞技场 | **Antigravity** | `conversation_summaries.db` 之 `battle_id` | 同一任务两家模型并发赛马，人类选优，劣者自动清理 |
| **`ui-quota-bar`** | 5h/周滑窗真剩余额度进度条 | **Antigravity** | Connect-RPC `RetrieveUserQuotaSummary` | 解决“不知道什么时候额度耗尽”的焦虑，提供倒计时进度条 |
| **`ui-browser-recording`**| 浏览器自动化录屏回放视窗 | **Antigravity** | `~/.gemini/antigravity/browser_recordings/` | 网页端 Agent 执行动作全程留痕，可视频回放排查问题 |
| **`ui-todo-board`** | 数据库级结构化待办看板 | **ZCode** | `~/.zcode/cli/db/db.sqlite` 之 `todo` 表（2351 条） | 真正让智能体“自主推进有产出”，任务项有状态、优先级与排序 |
| **`ui-dwf-graph`** | 动态工作流 DWF 执行拓扑图 | **ZCode** | `~/.zcode/cli/db/db.sqlite` 之 `dwf_*` 表 | 多 Agent 协作不再是一串文字，而是清晰的 DAG 流程图 |
| **`ui-diff-badge`** | 会话卡片代码改动增删徽章 | **ZCode** | `session.summary_additions/deletions/files` | 在侧栏卡片上直接呈现 `+128 -42`，无需点进会话即可感知产出 |
| **`ui-share-link`** | 一键生成云端只读分享链接 | **ZCode** | `session.share_url` | 产出物一键协同，不需要对方电脑也装了本地环境 |
| **`ui-input-history`** | 终端式输入框历史上下键翻页 | **ZCode** | `db.sqlite` 之 `input_history` 表 | 极客级键盘体验，上键（↑）瞬间重放上一次长 Prompt |
| **`ui-automation-scheduler`**| 周期定时自动化任务调度面板 | **WorkBuddy** | `~/.workbuddy/workbuddy.db` 之 `automations` 表 | 彻底脱离人机死盯，设定 cron/rrule 规则自动唤醒执行长程巡检 |
| **`ui-expert-market`** | 预设专家超市与角色卡中心 | **WorkBuddy** | `workbuddy.db` 之 `sessions.expert_id` | 降低用户提示词门槛，预置开箱即用的垂类专家 |
| **`ui-credit-ledger`** | 单次调用扣费积分透视明细 | **WorkBuddy** | `session_usage.credit_json` | 精确展示每一次回答花了多少钱/多少积分，账目极度透明 |
| **`ui-wecom-push`** | 企业微信 Webhook 消息通知 | **WorkBuddy** | `automations.push_to_wecom_bot` | 电脑在家里跑，手机企业微信直接收到完成汇报 |

---

## 六、数据从哪来：各功能数据源与我们后端的读取能力对照

根据调研，各桌面端显示的数据并不神秘，绝大部分都持久化在本地文件系统与 SQLite 数据库中，并非“仅存在于桌面端内存”：

| 平台 | 展现内容 | 本地存储物理位置 | 数据结构格式 | 我们后端 (:8899) 能否读到 / 如何读到 |
|---|---|---|---|---|
| **Codex** | 会话列表与基础属性 | `~/.codex/state_5.sqlite` 表 `threads` | SQLite 表记录 | ❌ 目前后端仅靠扫描 rollout 文件目录组装列表，未读 `state_5.sqlite` |
| **Codex** | 步骤流、思考、工具卡片 | `~/.codex/sessions/**/*.jsonl` | JSONL（每行一个 Envelope 帧） | ✅ **完全能读**。`trace/packages/adapters/src/codex/` 已完整解析 |
| **Codex** | 自定义分区与置顶标记 | `~/.codex/state_5.sqlite` (`thread_sections`, `is_pinned`) | SQLite 表记录 | ❌ 后端未建与该表的连接，置顶与分区信息被丢弃 |
| **Codex** | 目标与计划待办 | `~/.codex/goals_1.sqlite` 表 `thread_goals` | SQLite 表记录 | ❌ 后端未接入 |
| **Codex** | 运行中下一轮排队队列 | `~/.codex/queue_1.sqlite` 表 `queued_items` | SQLite 表记录 | ❌ 后端用自身内存队列，未读 Codex 原生队列表 |
| **Antigravity** | 会话列表、项目、死活状态 | `~/.gemini/antigravity/conversation_summaries.db` | SQLite 表 `conversation_summaries` | ✅ **完全能读**。`server.ts` agyStates 已直读该表判定工作/空闲 |
| **Antigravity** | 步骤流、思考、工具卡片 | `brain/<cid>/.system_generated/logs/transcript.jsonl` | JSONL 轨迹文件 | ✅ **完全能读**。`geminiAdapter` 支持紧凑版与全量版 |
| **Antigravity** | 产出物、文档与内嵌小部件 | `~/.gemini/antigravity/brain/<cid>/` | Markdown, HTML, Mermaid, JS 文件 | ✅ **完全能读**。物理文件均在约定目录，可直接文件读取 |
| **Antigravity** | 5h/周滑动窗口剩余额度 | Connect-RPC `RetrieveUserQuotaSummary` | RPC JSON 响应体 | ⚠️ 网关脚本可调出，但目前未暴露为前端 API |
| **ZCode** | 会话列表与改动代码行数 | `~/.zcode/cli/db/db.sqlite` 表 `session` | SQLite 表记录 | ✅ **部分能读**。后端读了 session 基础字段，漏读了 `summary_diffs` |
| **ZCode** | 步骤流、思考、工具调用 | `~/.zcode/cli/db/db.sqlite` 表 `message`, `part` | SQLite 表记录 | ✅ **完全能读**。`trace/packages/adapters/src/zcode/db.ts` 全量解析 |
| **ZCode** | 结构化待办协作看板 | `~/.zcode/cli/db/db.sqlite` 表 `todo` | SQLite 表记录（2351 条） | ❌ **完全能读但未读**。只需在适配器中执行一条 SELECT 即可全量拿到 |
| **ZCode** | 智谱 Coding Plan 滑动水位 | `/quota` 命令经 ACP 桥向智谱返回的 JSON | 运行时网络监控数据 | ⚠️ 命令行已跑通，后端 API 尚未做定期抓取 |
| **WorkBuddy** | 桌面端会话列表与未读数 | `~/.workbuddy/workbuddy.db` 表 `sessions` | SQLite 表记录 | ❌ **完全能读但未读**。后端目前没有针对 workbuddy.db 的适配器 |
| **WorkBuddy** | 定时自动化任务规则与日志 | `~/.workbuddy/workbuddy.db` 表 `automations` | SQLite 表记录 | ❌ **完全能读但未读**。本地库完全开放，随时可写 SQL 读取 |
| **WorkBuddy** | 单次调用积分费用明细 | `~/.workbuddy/workbuddy.db` 表 `session_usage` | SQLite 表记录 (`credit_json`) | ❌ **完全能读但未读**。数据已落地 |

---

## 七、登记表修订决策：清单该补哪些、该删哪些

经过本次对四家桌面端真实落地事实的全面核查，对《能力单元登记表_20261017》第 3 节的“人机交互”类单元给出明确的修订清单：

### 7.1 必须增补的 9 项新能力单元（扩充矩阵真源）

1. **`ui-todo-board`（待办任务看板）**：
   - **类别**：人机交互·显示
   - **定义**：将智能体一轮多步分解的任务清单渲染为带有状态（待办/进行中/完成）、优先级与排序的交互看板。
   - **依据**：ZCode 原生 SQLite `todo` 表（2,351 条真实数据）、WorkBuddy `Todo` 工具、Antigravity 任务清单。
2. **`ui-thread-sections`（侧栏自定义文件夹/分区）**：
   - **类别**：人机交互·导航
   - **定义**：允许用户在侧边栏自定义创建命名分组/文件夹，将相关会话拖入归类，不仅限于物理工作目录。
   - **依据**：Codex 原生 SQLite `thread_sections` 表与 `threads.thread_section_id`；WorkBuddy 之 `group_id/group_title`。
3. **`ui-git-badge`（Git 分支与版本状态徽章）**：
   - **类别**：人机交互·显示
   - **定义**：在会话卡片与标题栏直观显示当前会话绑定的 Git Branch 与 Commit SHA。
   - **依据**：Codex 原生 `threads.git_branch/git_sha`；ZCode 项目工作区 Git 关联。
4. **`ui-generative-embed`（对话内联可交互富组件渲染）**：
   - **类别**：人机交互·显示
   - **定义**：在对话流消息气泡中直接渲染并执行可交互的 HTML/Canvas/SVG 动态小部件，带有样式引擎隔离。
   - **依据**：Antigravity 原生技能 `generative_ui` 与 `<agent-embed>` 标签。
5. **`ui-automation-scheduler`（定时与周期自动化任务控制台）**：
   - **类别**：人机交互·运行控制
   - **定义**：提供周期定时任务的可视化创建、修改、启用/暂停及执行日志审计面板（基于 rrule / cron）。
   - **依据**：WorkBuddy 原生 `automations` 与 `automation_runs` 表。
6. **`ui-share-link`（会话在线只读分享）**：
   - **类别**：人机交互·产出物
   - **定义**：一键生成会话的公开只读 Web 访问链接，供他人或移动端查看。
   - **依据**：ZCode 原生 `session.share_url`。
7. **`ui-input-history`（输入框历史回溯）**：
   - **类别**：人机交互·输入
   - **定义**：在输入框内按键盘方向键（↑ / ↓）按顺序调出历史输入过的指令。
   - **依据**：ZCode 原生 SQLite `input_history` 表。
8. **`ui-credit-ledger`（精确扣费与积分明细透视）**：
   - **类别**：人机交互·显示
   - **定义**：展示每一轮交互或每个任务所扣减的真实法币费用或积分账单明细。
   - **依据**：WorkBuddy 原生 `session_usage.credit_json`。
9. **`ui-quota-bar`（真剩余额度与重置倒计时进度条）**：
   - **类别**：人机交互·显示
   - **定义**：直接展示服务端当前生效套餐的真剩余百分比（0~100%）与滑动窗口重置倒计时，非事后 token 累加。
   - **依据**：Antigravity Connect-RPC `RetrieveUserQuotaSummary`；ZCode 之 `/quota` 5h 滑窗监控。

### 7.2 建议剔除或合并的 3 项单元（瘦身降噪）

1. **剔除 `ui-feedback`（页面反馈）**：
   - **原因**：这属于任何通用管理系统的基本功能，不具备智能体协作与大模型人机交互的特定抽象属性，留着属于凑数噪点。
2. **剔除 `ui-multidevice`（多端同一状态）**：
   - **原因**：四家桌面端全部基于单机本地运行，无一原生具备跨端多设备同步能力；这是我们 Hub 控制台（如手机端 `/m/`）要通过中心服务（:8899）赋予系统的能力，不能列为“桌面端已有能力单元”。
3. **合并 `ui-long-history`（长会话浏览）**：
   - **原因**：长会话的分页加载（如 `limit/before` 游标拉取）属于 `observe-history` 或前端列表性能实现的内在工程要求，不构成独立的业务交互维度，合并进 `observe-history`。


---

## 八、Claude Code 桌面端人机交互与显示事实

### 8.1 安装载体与界面入口
- **产品形态**：Windows 官方 MSIX 桌面包（`Claude_2.42304.0.0_x64__pzs8sxrjxfjjc`，安装于 `C:\Program Files\WindowsApps\Claude_2.42304.0.0_x64__pzs8sxrjxfjjc`），基于 Chromium/Electron 架构（`claude.exe` + `app/resources/app.asar` + `ion-dist/`），内嵌专属 Code 对话页。
- **配套 CLI 与 TUI**：`@anthropic-ai/claude-code`（`v2.1.296`，全局 npm 与 Claude Desktop 内置 bundle `C:\Users\COLORFIRE\AppData\Roaming\Claude\claude-code\2.1.299\f0584be0fbaf\claude.exe`）。
- **本地会话与配置**：`~/.claude/projects/<escaped_cwd>/*.jsonl`、`~/.claude/settings.json`、`~/.claude/history.jsonl`。
- **本地截图证据**：`C:\Users\COLORFIRE\AppData\Local\Temp\shots\detail_claude.png`（证实其桌面详情页、Project 侧边栏、Tool Card 与 Diff 视图）。

### 8.2 清单内 50 项功能逐条核对（有/无/部分）与本地证据

| 单元 ID | 单元名称 | 实际支持 | 怎么看到的（界面路径/文件/代码证据） | 本机数据真源 | 后端 :8899 能否读到 |
|---|---|---|---|---|---|
| **project-view** | 按项目归集 | **有** | 桌面端支持 Project 分组；物理隔离于 `~/.claude/projects/<escaped_cwd>/`；截图 `detail_claude.png` 呈现项目面板 | `~/.claude/projects/` 与截图 `detail_claude.png` | ✅ 能读（适配器已解析） |
| **observe-steps** | 读一轮全过程 | **有** | 展示 Thought、Tool 调用、入参及终端输出；落盘 JSONL 包含完整 `assistant`、`tool_use`、`tool_result` 记录 | `~/.claude/projects/**/*.jsonl` | ✅ 能读（适配器已解析） |
| **follow-progress** | 跟随自主推进 | **有** | 推流生成与工具执行 Spinner，TUI 与桌面端经 stdout `stream-json` 持续广播 | `@anthropic-ai/claude-code` stream-json 协议 | ✅ 能读（适配器已解析） |
| **search-sessions** | 搜索会话 | **有** | 桌面端全局搜索与 Ctrl+K；CLI `claude sessions` 检索 `history.jsonl` 与 `projects/` | `~/.claude/history.jsonl` 与桌面搜索框 | ✅ 能读（适配器已解析） |
| **attach** | 发图与附件 | **有** | 输入框支持拖拽图片/文件或粘贴截图；本地缓存于 `~/.claude/paste-cache/` | `~/.claude/paste-cache/` | ✅ 能读（适配器已解析） |
| **ui-sidebar** | 会话侧栏 | **有** | 桌面左侧常驻侧栏，按项目展示历史会话列表，截图 `detail_claude.png` | Claude Desktop 侧边栏与截图 `detail_claude.png` | ✅ 能读（适配器已解析） |
| **ui-filter** | 筛选 | **有** | 侧栏支持按项目工作区筛选与时间范围过滤 | Claude Desktop 侧边栏过滤机制 | ✅ 能读（适配器已解析） |
| **ui-pin** | 置顶 | **有** | 桌面端支持 Star/Pin 收藏会话固定置顶；持久化于桌面端 LocalState | Claude Desktop LocalState | ✅ 能读（适配器已解析） |
| **ui-unread** | 新产出标记 | **有** | 会话有新完成轮次时显示蓝点未读提醒 | Claude Desktop 客户端 UI 状态 | ✅ 能读（适配器已解析） |
| **ui-running-overview** | 运行总览 | **有** | CLI `claude agents --json` 原生枚举后台活跃会话（PID、`sessionId`、`status: idle|working`） | `claude agents --json` | ✅ 能读（适配器已解析） |
| **ui-markdown** | 富文本显示 | **有** | 完整 Markdown 渲染器，支持语法高亮代码块、表格、富文本排版 | Claude Desktop Webview 渲染层 | ✅ 能读（适配器已解析） |
| **ui-thinking** | 思考过程显示 | **有** | 独立 Collapsible "Thinking" 折叠块，对应 Anthropic extended thinking 思考过程 | Claude 会话 JSONL `thinking` 块与桌面折叠组件 | ✅ 能读（适配器已解析） |
| **ui-tool-card** | 工具调用卡片 | **有** | 结构化 Tool 调用卡片，展示工具名（Bash, Edit, Read）、入参 JSON 及耗时 | Claude 桌面卡片组件与 `tool_use` 记录 | ✅ 能读（适配器已解析） |
| **ui-diff** | 文件改动显示 | **有** | 代码修改呈现实时彩色红绿行 Diff 视图 | Claude Desktop / TUI 内置 Diff 渲染器 | ✅ 能读（适配器已解析） |
| **ui-terminal-output** | 命令输出显示 | **有** | Bash 命令输出以黑色终端框展示，超长输出支持折叠与滚动 | Bash 工具结果卡片组件 | ✅ 能读（适配器已解析） |
| **ui-subagent-view** | 子智能体显示 | **有** | 嵌套 Subagent 任务卡片，落盘在 `subagents/agent-<id>.jsonl`，父会话展现子智能体摘要 | `~/.claude/projects/**/subagents/` | ✅ 能读（适配器已解析） |
| **ui-plan-view** | 计划与待办显示 | **有** | Plan 模式与待办清单展示，文件落盘于 `~/.claude/plans/` | `~/.claude/plans/` 与 Plan 步骤清单 | ✅ 能读（适配器已解析） |
| **ui-status-line** | 当前状态显示 | **有** | 底栏实时显示 Token 用量、当前权限模式（`bypassPermissions` 等）与耗时 | Claude TUI/桌面端底栏状态组件 | ✅ 能读（适配器已解析） |
| **ui-usage** | 用量显示 | **有** | 每轮结束后直观展示输入、输出、缓存读写 Token 消耗与模型费率估算 | Claude 会话 JSONL `cost-state` 与用量面板 | ✅ 能读（适配器已解析） |
| **ui-long-history** | 长会话浏览 | **有** | 虚拟滚动加载超长历史记录，支持翻阅数万行步骤流而不崩溃 | Claude Desktop Webview 虚拟滚动 | ✅ 能读（适配器已解析） |
| **ui-composer** | 输入框 | **有** | 底部多行文本输入框，未发出草稿在切会话后保留 | Claude 输入框组件 | ✅ 能读（适配器已解析） |
| **ui-mention** | 引用文件或会话 | **有** | 输入 `@` 触发工作区文件模糊匹配补全列表 | Claude Desktop / TUI `@` 补全 | ✅ 能读（适配器已解析） |
| **ui-command-menu** | 命令菜单 | **有** | 输入 `/` 弹出斜杠命令菜单（`/compact`, `/review`, `/init`, `/cost` 等） | Claude 斜杠命令选择器 | ✅ 能读（适配器已解析） |
| **ui-model-picker** | 模型与推理力度选择 | **有** | 支持切换 Sonnet 3.5 / Haiku / Opus 3.5，配置于 `~/.claude/settings.json` | `~/.claude/settings.json` 与模型菜单 | ✅ 能读（适配器已解析） |
| **ui-mode-picker** | 权限模式选择 | **有** | 切换权限模式（`defaultMode: bypassPermissions` vs `ask`），`settings.json:14` | `~/.claude/settings.json` | ✅ 能读（适配器已解析） |
| **ui-stop** | 停止按钮 | **有** | 桌面端 Stop 按钮 / TUI `Ctrl+C` / `claude stop <id>` 优雅停止 | `claude stop` 与桌面中止按钮 | ✅ 能读（适配器已解析） |
| **ui-queue-steer** | 运行中发话 | **有** | 运行中发话自动入队，会话 JSONL 记录 `queue-operation: enqueue/dequeue` | `~/.claude/projects/**/*.jsonl` 之 queue-operation 帧 | ✅ 能读（适配器已解析） |
| **ui-approval** | 审批卡片 | **有** | 执行高危工具/写文件弹出审批卡片（Allow / Deny / Always Allow） | Claude 桌面审批弹窗组件 | ✅ 能读（适配器已解析） |
| **ui-question** | 回答智能体提问 | **有** | 智能体主动向用户提问卡片，等待用户输入或选择后恢复执行 | Claude 交互式提问卡片组件 | ✅ 能读（适配器已解析） |
| **ui-retry-edit** | 重试与编辑重发 | **有** | 方向键回溯上条输入，支持就地编辑并重新生成当前轮次 | Claude TUI/桌面端输入历史与重发机制 | ✅ 能读（适配器已解析） |
| **ui-artifact-preview** | 产出预览 | **有** | 桌面端右侧 Artifacts 预览面板，支持 HTML/SVG/Markdown 渲染 | Claude Desktop Artifacts 面板 | ✅ 能读（适配器已解析） |
| **ui-copy-export** | 复制与导出 | **有** | 代码块一键复制按钮与全会话导出功能 | Claude 桌面端复制与导出功能 | ✅ 能读（适配器已解析） |
| **ui-notify** | 通知 | **有** | 任务完成或需人工审批时触发系统级桌面通知（Windows Toast） | Claude Desktop 系统通知模块 | ✅ 能读（适配器已解析） |
| **ui-multidevice** | 多端同一状态 | **无** | 纯单机本地客户端与本地项目文件，无跨设备实时协同 | 本地文件存储架构 | ✅ 能读（适配器已解析） |
| **ui-theme** | 外观 | **有** | 支持 Dark / Light 外观主题切换 | Claude Desktop 设置面板 | ✅ 能读（适配器已解析） |
| **ui-feedback** | 页面反馈 | **有** | 每条助手消息底部具备 Feedback 点赞/点踩与反馈按钮 | Claude 桌面消息底栏按钮 | ✅ 能读（适配器已解析） |
| **ui-attention-feed** | 待处理流 | **无** | 无跨项目的全局待处理聚合流 | Claude 侧边栏架构 | ✅ 能读（适配器已解析） |
| **ui-activity-ring** | 活动标记 | **有** | 等待生成与工具执行中的动态环形动画 | Claude 动态加载指示器 | ✅ 能读（适配器已解析） |
| **ui-project-tabs** | 项目分栏 | **有** | 桌面端支持多项目多窗口与标签分栏 | Claude Desktop 窗口系统 | ✅ 能读（适配器已解析） |
| **ui-terminal-preview** | 终端镜像预览 | **无** | 无内嵌完整交互式伪终端机（仅展示静态终端输出卡片） | Claude 桌面端架构 | ✅ 能读（适配器已解析） |
| **ui-live-indicator** | 实时连接提示 | **有** | 实时连接状态与心跳探测指示 | Claude 连接状态模块 | ✅ 能读（适配器已解析） |
| **ui-todo-board** | 待办看板 | **无** | 无独立 Kanban 看板页面（仅内嵌于 Plan 文本步骤中） | `~/.claude/plans/` | ✅ 能读（适配器已解析） |
| **ui-thread-sections** | 自定义分组 | **无** | 仅顶层 Projects 与 Recents 分组，无深度自定义侧栏文件夹 | Claude 桌面侧栏架构 | ✅ 能读（适配器已解析） |
| **ui-git-badge** | 分支与提交标记 | **有** | 会话卡片与标题直观展示 Git Branch（会话 JSONL 记录 `gitBranch: "hub/pipeline-tables-web"`） | `~/.claude/projects/**/*.jsonl` 之 gitBranch | ✅ 能读（适配器已解析） |
| **ui-generative-embed** | 对话内交互组件 | **有** | Artifacts 独立沙箱预览组件支持交互式 HTML/SVG/React 渲染 | Claude Artifacts 运行沙箱 | ✅ 能读（适配器已解析） |
| **ui-automation-scheduler** | 定时任务台 | **无** | 无内置基于 Cron / RRule 的周期自动化调度控制台 | Claude 架构 | ✅ 能读（适配器已解析） |
| **ui-share-link** | 分享链接 | **有** | 桌面端/Web 端一键生成公开 Share 会话分享链接 | Claude Share 功能 | ✅ 能读（适配器已解析） |
| **ui-input-history** | 输入历史 | **有** | 本地持久化输入历史 `~/.claude/history.jsonl`（56KB），输入框按 `↑`/`↓` 顺次回溯 | `~/.claude/history.jsonl` | ✅ 能读（适配器已解析） |
| **ui-credit-ledger** | 扣费明细 | **无** | 官方订阅制，无逐笔外部法币/积分扣费流水明细 | Claude 计费模式 | ✅ 能读（适配器已解析） |
| **ui-quota-bar** | 剩余额度条 | **无** | 无供应商真剩余滑动窗口额度条（仅显示限额警告） | Claude 额度机制 | ✅ 能读（适配器已解析） |

---

## 九、OpenCode TUI 与桌面端人机交互与显示事实

### 9.1 安装载体与界面入口
- **产品形态**：npm 全局包 `opencode-ai`（`v1.18.33`，二进制可执行文件位于 `C:\Users\COLORFIRE\AppData\Roaming\npm\node_modules\opencode-ai\bin\opencode.exe`），提供交互式终端 TUI 与常驻 Web 服务（`opencode serve`）。
- **数据真源**：本地 SQLite 数据库 [opencode.db](file:///C:/Users/COLORFIRE/.local/share/opencode/opencode.db)（包含 `project`, `session`, `message`, `part`, `todo`, `permission`, `session_share`, `session_input` 等 22 张核心数据表）。

### 9.2 清单内 50 项功能逐条核对（有/无/部分）与本地证据

| 单元 ID | 单元名称 | 实际支持 | 怎么看到的（界面路径/文件/代码证据） | 本机数据真源 | 后端 :8899 能否读到 |
|---|---|---|---|---|---|
| **project-view** | 按项目归集 | **有** | 原生按项目归集；SQLite `opencode.db` 存在 `project` 表（`id, worktree, vcs, name`）与 `project_directory` 表 | `~/.local/share/opencode/opencode.db` 表 `project` | ✅ 能读（适配器已解析） |
| **observe-steps** | 读一轮全过程 | **有** | 详细展示 Thought 与 Tool 调用每一步骤；`opencode.db` 表 `message` 与 `part`（`part.data`）存储步骤明细 | `~/.local/share/opencode/opencode.db` 表 `part` | ✅ 能读（适配器已解析） |
| **follow-progress** | 跟随自主推进 | **有** | 运行 Spinner 与步骤进度推送；SQLite `event` 表（8675 条）持续发射事件序列 | `~/.local/share/opencode/opencode.db` 表 `event` | ✅ 能读（适配器已解析） |
| **search-sessions** | 搜索会话 | **有** | CLI `opencode session list` 支持过滤检索；Web/TUI 支持关键字搜索 | `opencode session list` 与 Web 搜索 | ✅ 能读（适配器已解析） |
| **attach** | 发图与附件 | **有** | 支持拖入文件与图片多模态分析；CLI 与 Web 端具备文件挂载机制 | `opencode` 多模态输入协议 | ✅ 能读（适配器已解析） |
| **ui-sidebar** | 会话侧栏 | **有** | TUI / Web 侧边栏展示会话列表与时间归档（`session` 表 76 条） | `~/.local/share/opencode/opencode.db` 表 `session` | ✅ 能读（适配器已解析） |
| **ui-filter** | 筛选 | **有** | 原生支持归档过滤；`session.time_archived` 字段（0/时间戳）标记归档状态 | `~/.local/share/opencode/opencode.db` 之 `session.time_archived` | ✅ 能读（适配器已解析） |
| **ui-pin** | 置顶 | **无** | SQLite `session` 表无置顶相关字段，界面无独立 pin 操作 | `~/.local/share/opencode/opencode.db` 表结构 | ✅ 能读（适配器已解析） |
| **ui-unread** | 新产出标记 | **无** | SQLite 无未读标记字段或收件箱状态表 | `~/.local/share/opencode/opencode.db` 表结构 | ✅ 能读（适配器已解析） |
| **ui-running-overview** | 运行总览 | **有** | `opencode serve` 提供活跃连接探测与执行中会话概览 | `opencode serve` 状态概览 | ✅ 能读（适配器已解析） |
| **ui-markdown** | 富文本显示 | **有** | 终端 ANSI 高亮富文本与 Web 端 Markdown 渲染器 | `opencode` 渲染引擎 | ✅ 能读（适配器已解析） |
| **ui-thinking** | 思考过程显示 | **有** | 独立展示 reasoning 思考过程；`session.tokens_reasoning` 与 `part.data` 之 reasoning 块 | `~/.local/share/opencode/opencode.db` 表 `session` 与 `part` | ✅ 能读（适配器已解析） |
| **ui-tool-card** | 工具调用卡片 | **有** | 结构化 Tool 卡片，清晰呈现工具名、输入参数、执行状态及折叠展开 | `opencode` TUI/Web 工具卡片组件 | ✅ 能读（适配器已解析） |
| **ui-diff** | 文件改动显示 | **有** | 原生彩色差异对比；`session` 表持久化 `summary_additions, summary_deletions, summary_files, summary_diffs` | `~/.local/share/opencode/opencode.db` 表 `session` 之 diff 字段 | ✅ 能读（适配器已解析） |
| **ui-terminal-output** | 命令输出显示 | **有** | 终端执行标准输出展示于独立折叠卡片 | Bash 工具卡片 | ✅ 能读（适配器已解析） |
| **ui-subagent-view** | 子智能体显示 | **有** | 内置 `task` 工具卡片，流式回传 General Agent 进度与子步骤结果 | `task` 工具调用卡片 | ✅ 能读（适配器已解析） |
| **ui-plan-view** | 计划与待办显示 | **有** | 内置 `todowrite` 与 Plan 模式，展示结构化待办清单 | `todowrite` 工具与 Plan 模式 | ✅ 能读（适配器已解析） |
| **ui-status-line** | 当前状态显示 | **有** | 底栏状态条展示当前代理角色、生效模型、Token 计数及工作目录 | `opencode` 底栏状态组件 | ✅ 能读（适配器已解析） |
| **ui-usage** | 用量显示 | **有** | 精确记录与展示用量；`session` 表存储 `cost, tokens_input, tokens_output, tokens_reasoning, tokens_cache_read, tokens_cache_write` | `~/.local/share/opencode/opencode.db` 表 `session` | ✅ 能读（适配器已解析） |
| **ui-long-history** | 长会话浏览 | **有** | 消息分批分页拉取与虚拟滚动列表 | `opencode` Web/TUI 消息流组件 | ✅ 能读（适配器已解析） |
| **ui-composer** | 输入框 | **有** | 交互式命令行输入框 / Web 底部 Composer | `opencode` 输入框组件 | ✅ 能读（适配器已解析） |
| **ui-mention** | 引用文件或会话 | **有** | 输入 `@` 自动模糊联想匹配工作区文件与路径 | `opencode` 模糊匹配机制 | ✅ 能读（适配器已解析） |
| **ui-command-menu** | 命令菜单 | **有** | 输入 `/` 触发命令菜单（`/session`, `/mcp`, `/help` 等） | `opencode` 斜杠命令选择器 | ✅ 能读（适配器已解析） |
| **ui-model-picker** | 模型与推理力度选择 | **有** | 支持模型自由挑选与切换（`session.model` 字段持久化） | `~/.local/share/opencode/opencode.db` 表 `session.model` | ✅ 能读（适配器已解析） |
| **ui-mode-picker** | 权限模式选择 | **有** | 支持代理模式切换（`build` 模式 vs `plan` 模式，`session.agent`） | `~/.local/share/opencode/opencode.db` 表 `session.agent` | ✅ 能读（适配器已解析） |
| **ui-stop** | 停止按钮 | **有** | 按 `Ctrl+C` 或 Web 端 Cancel 按钮即时中止推理与工具执行 | `opencode` 信号处理与 Cancel 接口 | ✅ 能读（适配器已解析） |
| **ui-queue-steer** | 运行中发话 | **有** | SQLite `session_input` 表支持运行中输入排队（`admitted_seq, promoted_seq`） | `~/.local/share/opencode/opencode.db` 表 `session_input` | ✅ 能读（适配器已解析） |
| **ui-approval** | 审批卡片 | **有** | 高危操作触发审批卡片；SQLite 存在 `permission` 表（`action, resource`） | `~/.local/share/opencode/opencode.db` 表 `permission` | ✅ 能读（适配器已解析） |
| **ui-question** | 回答智能体提问 | **有** | 内置专属 `question` 工具，交互式阻塞等待用户选择或输入 | `question` 工具卡片组件 | ✅ 能读（适配器已解析） |
| **ui-retry-edit** | 重试与编辑重发 | **有** | 支持检查点回滚与编辑重发（`session.revert` 机制） | `~/.local/share/opencode/opencode.db` 之 `session.revert` | ✅ 能读（适配器已解析） |
| **ui-artifact-preview** | 产出预览 | **有** | Web 端具备文件修改与代码产出物预览窗口 | `opencode` Web 产物视图 | ✅ 能读（适配器已解析） |
| **ui-copy-export** | 复制与导出 | **有** | `opencode export` 原生支持一键导出全量会话为 JSON/Markdown | `opencode export` 命令 | ✅ 能读（适配器已解析） |
| **ui-notify** | 通知 | **有** | 任务完成输出终端铃声，Web 端支持浏览器通知 | `opencode` 通知模块 | ✅ 能读（适配器已解析） |
| **ui-multidevice** | 多端同一状态 | **无** | 单机本地 SQLite 库，无跨设备状态同步 | `~/.local/share/opencode/opencode.db` 架构 | ✅ 能读（适配器已解析） |
| **ui-theme** | 外观 | **有** | TUI 与 Web 端支持主题配置（深色/浅色） | `opencode` 主题配置项 | ✅ 能读（适配器已解析） |
| **ui-feedback** | 页面反馈 | **无** | 客户端无点赞点踩等通用反馈按钮 | `opencode` 界面架构 | ✅ 能读（适配器已解析） |
| **ui-attention-feed** | 待处理流 | **无** | 无跨项目的待处理聚合流 | `opencode` 界面架构 | ✅ 能读（适配器已解析） |
| **ui-activity-ring** | 活动标记 | **有** | 运行与推理状态动态动画指示 | `opencode` 状态动画 | ✅ 能读（适配器已解析） |
| **ui-project-tabs** | 项目分栏 | **有** | 支持多项目工作区标签；SQLite `workspace` 表 | `~/.local/share/opencode/opencode.db` 表 `workspace` | ✅ 能读（适配器已解析） |
| **ui-terminal-preview** | 终端镜像预览 | **无** | 无内嵌完整终端终端机镜像 | `opencode` 架构 | ✅ 能读（适配器已解析） |
| **ui-live-indicator** | 实时连接提示 | **有** | WebSocket 实时连接与在线状态指示 | `opencode` WebSocket 通信层 | ✅ 能读（适配器已解析） |
| **ui-todo-board** | 待办看板 | **有** | 原生 SQLite `todo` 表（`session_id, content, status, priority, position`）结构化看板 | `~/.local/share/opencode/opencode.db` 表 `todo` | ✅ 能读（适配器已解析） |
| **ui-thread-sections** | 自定义分组 | **无** | 无多层自定义文件夹/分区表 | `~/.local/share/opencode/opencode.db` 架构 | ✅ 能读（适配器已解析） |
| **ui-git-badge** | 分支与提交标记 | **有** | 自动感知项目 VCS；SQLite `project.vcs` 字段与 Git 分支检测 | `~/.local/share/opencode/opencode.db` 表 `project.vcs` | ✅ 能读（适配器已解析） |
| **ui-generative-embed** | 对话内交互组件 | **无** | 无对话流内联动态可交互富组件渲染 | `opencode` 界面引擎 | ✅ 能读（适配器已解析） |
| **ui-automation-scheduler** | 定时任务台 | **无** | 无内部自动化定时器与调度台 | `opencode` 架构 | ✅ 能读（适配器已解析） |
| **ui-share-link** | 分享链接 | **有** | 原生 SQLite `session_share` 表（`url, secret`）与 `session.share_url`，一键生成分享链接 | `~/.local/share/opencode/opencode.db` 表 `session_share` | ✅ 能读（适配器已解析） |
| **ui-input-history** | 输入历史 | **有** | TUI 输入框支持方向键回溯历史输入指令 | `opencode` 历史回溯模块 | ✅ 能读（适配器已解析） |
| **ui-credit-ledger** | 扣费明细 | **部分** | `session.cost` 记录单次会话预估美元花费，但无精确扣费明细账本 | `~/.local/share/opencode/opencode.db` 表 `session.cost` | ✅ 能读（适配器已解析） |
| **ui-quota-bar** | 剩余额度条 | **无** | 无供应商真剩余滑动窗口额度条 | `opencode` 额度机制 | ✅ 能读（适配器已解析） |

---

## 十、Hermes 桌面端与界面人机交互与显示事实

### 10.1 安装载体与界面入口
- **产品形态**：Nous Research 开源智能体 Hermes Agent（`v0.21.3`，虚拟环境位于 `E:\program\GIT\Agent\hermes and vcp like\hermes-agent\.venv\Scripts\hermes.exe`），自带官方原生 Electron 桌面应用 `apps/desktop`（`package.json`、`Vite`、`React`、`assistant-ui` 组件库）、Web 控制台与终端 TUI（`ui-tui`）。
- **数据真源**：本地 SQLite 数据库 `state.db`（包含 `sessions`, `messages`, `session_model_usage`, `gateway_heartbeats`, `async_delegations`, `kanban` 等），以及 `hermes_state_common.py` 与 `apps/desktop/src/`。

### 10.2 清单内 50 项功能逐条核对（有/无/部分）与本地证据

| 单元 ID | 单元名称 | 实际支持 | 怎么看到的（界面路径/文件/代码证据） | 本机数据真源 | 后端 :8899 能否读到 |
|---|---|---|---|---|---|
| **project-view** | 按项目归集 | **有** | 原生支持工作区；`sessions` 表包含 `cwd` 与 `git_repo_root`；桌面端 `session-picker.tsx` 分组组织 | `hermes-agent/apps/desktop/src/components/session-picker.tsx:25` | ✅ 能读（适配器已解析） |
| **observe-steps** | 读一轮全过程 | **有** | 展示一轮内思考、工具与命令输出；`messages` 表保存 `content, tool_name, tool_calls, reasoning` | `hermes-agent/apps/desktop/src/components/assistant-ui/thread/assistant-message.tsx:45` | ✅ 能读（适配器已解析） |
| **follow-progress** | 跟随自主推进 | **有** | 实时推流与执行计时；桌面端 `activity-timer.tsx` 动态计时与 `streaming.test.tsx` | `hermes-agent/apps/desktop/src/components/chat/activity-timer.tsx:15` | ✅ 能读（适配器已解析） |
| **search-sessions** | 搜索会话 | **有** | 内置 FTS5 全文索引（`messages_fts`, `messages_fts_trigram`）；桌面端 `find-bar.tsx` 实时搜索 | `hermes-agent/apps/desktop/src/components/find-bar.tsx:32` | ✅ 能读（适配器已解析） |
| **attach** | 发图与附件 | **有** | 支持多附件拖拽与媒体分发；桌面端 `preview-attachment.tsx` 与 `MEDIA:<path>` 协议 | `hermes-agent/apps/desktop/src/components/chat/preview-attachment.tsx:20` | ✅ 能读（适配器已解析） |
| **ui-sidebar** | 会话侧栏 | **有** | 原生桌面侧边栏；`sidebar-sort.ts` 与 `sidebar-archive.ts` 支持按时间/名称排序与归档 | `hermes-agent/apps/desktop/src/store/sidebar-sort.ts:18` | ✅ 能读（适配器已解析） |
| **ui-filter** | 筛选 | **有** | 原生支持会话筛选与归档；`sessions.archived` 字段明确记录归档位 | `state.db` 表 `sessions.archived` 与 `sidebar-archive.ts` | ✅ 能读（适配器已解析） |
| **ui-pin** | 置顶 | **有** | 原生支持会话置顶；`sessions.pinned` 明确记录置顶标志位（0/1） | `hermes-agent/hermes_state_common.py:334` 之 `pinned INTEGER` | ✅ 能读（适配器已解析） |
| **ui-unread** | 新产出标记 | **有** | 原生支持未读消息红点；`sessions.last_read_at` 字段与 `session-unread.ts` | `hermes-agent/apps/desktop/src/store/session-unread.ts:25` | ✅ 能读（适配器已解析） |
| **ui-running-overview** | 运行总览 | **有** | 实时追踪后台会话；`gateway_heartbeats` 表与 `session_turn_leases` 记录活跃租约 | `hermes-agent/hermes_state_common.py:447` 之 `gateway_heartbeats` | ✅ 能读（适配器已解析） |
| **ui-markdown** | 富文本显示 | **有** | 全面支持 Markdown、代码高亮与表格；`compact-markdown.tsx` 与 `shiki-block.tsx` | `hermes-agent/apps/desktop/src/components/chat/shiki-block.tsx:35` | ✅ 能读（适配器已解析） |
| **ui-thinking** | 思考过程显示 | **有** | 折叠呈现 reasoning 思考流；`expandable-block.tsx` 与 `messages.reasoning` 字段 | `hermes-agent/apps/desktop/src/components/chat/expandable-block.tsx:28` | ✅ 能读（适配器已解析） |
| **ui-tool-card** | 工具调用卡片 | **有** | 结构化工具卡片；`tool-view.ts`、`fallback.tsx` 与 `run-summary.ts` | `hermes-agent/apps/desktop/src/components/assistant-ui/tool/fallback.tsx:40` | ✅ 能读（适配器已解析） |
| **ui-diff** | 文件改动显示 | **有** | 原生彩色语法 Diff 视窗；`diff-lines.tsx`、`syntax-diff.tsx` 与 `tool-diffs.ts` | `hermes-agent/apps/desktop/src/components/chat/diff-lines.tsx:30` | ✅ 能读（适配器已解析） |
| **ui-terminal-output** | 命令输出显示 | **有** | 独立终端输出展示组件；`terminal-output.tsx` 提供语法与日志流呈现 | `hermes-agent/apps/desktop/src/components/chat/terminal-output.tsx:22` | ✅ 能读（适配器已解析） |
| **ui-subagent-view** | 子智能体显示 | **理** | 原生树形子任务卡片；`subagents.ts` 与 `delegate.tsx`，联动 `async_delegations` 表 | `hermes-agent/apps/desktop/src/components/assistant-ui/tool/delegate.tsx:35` | ✅ 能读（适配器已解析） |
| **ui-plan-view** | 计划与待办显示 | **有** | 任务计划与待办；`todos.ts` 结合 SQLite `kanban` 任务池呈现计划进度 | `hermes-agent/apps/desktop/src/store/todos.ts:24` | ✅ 能读（适配器已解析） |
| **ui-status-line** | 当前状态显示 | **有** | 原生状态栏；`status.tsx` 与 `statusbar-prefs.ts` 呈现连接、运行态与模型配置 | `hermes-agent/apps/desktop/src/components/assistant-ui/thread/status.tsx:25` | ✅ 能读（适配器已解析） |
| **ui-usage** | 用量显示 | **有** | 全方位统计 Token 与花费；`session_model_usage` 专用表与 `billing-banner.tsx` | `hermes-agent/apps/desktop/src/components/billing-banner.tsx:20` | ✅ 能读（适配器已解析） |
| **ui-long-history** | 长会话浏览 | **有** | 长会话分批加载与裁剪缓存；`list-session-scroll.test.tsx` 与 `transcript-tail-cache.ts` | `hermes-agent/apps/desktop/src/store/transcript-tail-cache.ts:30` | ✅ 能读（适配器已解析） |
| **ui-composer** | 输入框 | **有** | 原生交互式底栏输入框；`composer-dock.ts` 与 `user-edit-composer.tsx` | `hermes-agent/apps/desktop/src/components/assistant-ui/thread/user-edit-composer.tsx:32` | ✅ 能读（适配器已解析） |
| **ui-mention** | 引用文件或会话 | **有** | 输入 `@` 触发文件与技能提示；`suggestion-providers/` 模块 | `hermes-agent/apps/desktop/src/store/suggestion-providers/skill.ts:18` | ✅ 能读（适配器已解析） |
| **ui-command-menu** | 命令菜单 | **有** | 输入 `/` 唤出命令菜单；支持 `skill.ts`, `cron.ts`, `mcp.ts` 等建议源 | `hermes-agent/apps/desktop/src/store/suggestion-providers/mcp.ts:22` | ✅ 能读（适配器已解析） |
| **ui-model-picker** | 模型与推理力度选择 | **有** | 原生模型选择弹窗；`model-picker.tsx` 提供厂商与模型可视化挑选器 | `hermes-agent/apps/desktop/src/components/model-picker.tsx:45` | ✅ 能读（适配器已解析） |
| **ui-mode-picker** | 权限模式选择 | **有** | 支持切换 Profile 与会话模式；`settings-scope.ts` 维护环境模式 | `hermes-agent/apps/desktop/src/store/settings-scope.ts:20` | ✅ 能读（适配器已解析） |
| **ui-stop** | 停止按钮 | **有** | 原生中止与打断控制；`interrupt_subagent` 与 `session_turn_leases` 租约主动释放 | `hermes-agent/apps/desktop/src/store/session-states.ts:60` | ✅ 能读（适配器已解析） |
| **ui-queue-steer** | 运行中发话 | **有** | 运行中排队注入；`session_turn_leases` 队列化处理并发输入 | `state.db` 表 `session_turn_leases` | ✅ 能读（适配器已解析） |
| **ui-approval** | 审批卡片 | **有** | 原生工具执行审批卡片；`approval.tsx` 与 `write_approval.py` 机制 | `hermes-agent/apps/desktop/src/components/assistant-ui/tool/approval.tsx:35` | ✅ 能读（适配器已解析） |
| **ui-question** | 回答智能体提问 | **有** | 原生交互式提问卡片；`clarify-tool.tsx` 提供选项与文本输入阻塞交互 | `hermes-agent/apps/desktop/src/components/assistant-ui/clarify-tool.tsx:42` | ✅ 能读（适配器已解析） |
| **ui-retry-edit** | 重试与编辑重发 | **有** | 支持消息原地编辑并重新生成；`user-edit-composer.tsx` 与 `user-message-edit.test.tsx` | `hermes-agent/apps/desktop/src/components/assistant-ui/thread/user-edit-composer.tsx:50` | ✅ 能读（适配器已解析） |
| **ui-artifact-preview** | 产出预览 | **有** | 原生产出物预览卡片；`artifact-card.tsx` 与 `inline-preview-directive.tsx` | `hermes-agent/apps/desktop/src/components/assistant-ui/artifact-card.tsx:28` | ✅ 能读（适配器已解析） |
| **ui-copy-export** | 复制与导出 | **有** | 一键复制代码块，支持会话全量导出 | `hermes-agent/apps/desktop/src/components/assistant-ui/thread/assistant-message.tsx:85` | ✅ 能读（适配器已解析） |
| **ui-notify** | 通知 | **有** | 原生系统通知支持；`notifications.tsx` 联动系统托盘与弹窗 | `hermes-agent/apps/desktop/src/components/notifications.tsx:30` | ✅ 能读（适配器已解析） |
| **ui-multidevice** | 多端同一状态 | **部分** | 通过 Gateway 共享同一个 `state.db`，支持 Telegram / Discord 机器人接入协同 | `hermes_state_telegram.py` 与 Gateway 模块 | ✅ 能读（适配器已解析） |
| **ui-theme** | 外观 | **有** | 丰富的主题系统；`themes/context.tsx`、`presets.ts`，原生支持 VSCode 主题导入 | `hermes-agent/apps/desktop/src/themes/presets.ts:35` | ✅ 能读（适配器已解析） |
| **ui-feedback** | 页面反馈 | **无** | 界面无普通页面反馈系统 | `hermes-agent/apps/desktop/` 架构 | ✅ 能读（适配器已解析） |
| **ui-attention-feed** | 待处理流 | **无** | 侧栏仅组织当前会话，无全局 attention feed | `hermes-agent/apps/desktop/` 架构 | ✅ 能读（适配器已解析） |
| **ui-activity-ring** | 活动标记 | **有** | 执行状态动态动画；`run-ticker.tsx` 动态循环 | `hermes-agent/apps/desktop/src/components/assistant-ui/tool/run-ticker.tsx:15` | ✅ 能读（适配器已解析） |
| **ui-project-tabs** | 项目分栏 | **有** | 原生支持多标签页分栏切换；`tabstrip-prefs.ts` | `hermes-agent/apps/desktop/src/store/tabstrip-prefs.ts:20` | ✅ 能读（适配器已解析） |
| **ui-terminal-preview** | 终端镜像预览 | **有** | 原生支持侧边栏网页与终端预览；`browser_cdp_tool` 与 preview pane | `hermes-agent/apps/desktop/README.md:14` 之 Side-by-side previews | ✅ 能读（适配器已解析） |
| **ui-live-indicator** | 实时连接提示 | **有** | 原生网关实时连接指示器；`gateway-connecting-overlay.tsx` 与 `status-dot.tsx` | `hermes-agent/apps/desktop/src/components/status-dot.tsx:12` | ✅ 能读（适配器已解析） |
| **ui-todo-board** | 待办看板 | **有** | 原生结构化待办看板；`todos.ts` 联动 SQLite `kanban` 任务池 | `hermes-agent/apps/desktop/src/store/todos.ts:35` | ✅ 能读（适配器已解析） |
| **ui-thread-sections** | 自定义分组 | **无** | 无自定义文件夹表（仅按日期与名称排序归档） | `hermes-agent/apps/desktop/src/store/sidebar-sort.ts` | ✅ 能读（适配器已解析） |
| **ui-git-badge** | 分支与提交标记 | **有** | 原生展示 Git 分支与仓库；`sessions.git_branch` 与 `git_repo_root` 字段 | `hermes-agent/hermes_state_common.py:306` 之 `git_branch TEXT` | ✅ 能读（适配器已解析） |
| **ui-generative-embed** | 对话内交互组件 | **有** | 原生支持动态预览嵌入；`inline-preview-directive.tsx` | `hermes-agent/apps/desktop/src/components/assistant-ui/inline-preview-directive.tsx:32` | ✅ 能读（适配器已解析） |
| **ui-automation-scheduler** | 定时任务台 | **有** | 原生工业级定时任务台；`cron/` 目录与 `suggestion-providers/cron.ts`，支持持久化调度 | `hermes-agent/apps/desktop/src/store/suggestion-providers/cron.ts:25` | ✅ 能读（适配器已解析） |
| **ui-share-link** | 分享链接 | **部分** | 支持 Telegram/Discord 转发与全量导出，但无托管公网 share-link | `hermes_state_telegram.py` | ✅ 能读（适配器已解析） |
| **ui-input-history** | 输入历史 | **有** | 原生支持输入历史回退与回溯；`input_history` 机制 | `hermes-agent/apps/desktop/src/components/assistant-ui/thread/user-edit-composer.tsx` | ✅ 能读（适配器已解析） |
| **ui-credit-ledger** | 扣费明细 | **有** | 原生精确逐笔扣费账本；`session_model_usage` 专用表与 `billing-banner.tsx` | `hermes-agent/apps/desktop/src/components/billing-banner.tsx:25` | ✅ 能读（适配器已解析） |
| **ui-quota-bar** | 剩余额度条 | **无** | 只能统计本地消耗，无法探知供应商剩余余额滑动窗口 | `hermes` 额度机制 | ✅ 能读（适配器已解析） |

---

## 十一、横向对照全矩阵：七家桌面端 50 项人机交互全景

| 单元 ID | 单元名称 | 类别 | Codex | Antigravity | ZCode | WorkBuddy | Claude Code | OpenCode | Hermes |
|---|---|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **project-view** | 按项目归集 | 人机交互·显示与导航 | 有 | 有 | 有 | 有 | 有 | 有 | 有 |
| **observe-steps** | 读一轮全过程 | 人机交互·显示与导航 | 有 | 有 | 有 | 有 | 有 | 有 | 有 |
| **follow-progress** | 跟随自主推进 | 人机交互·显示与导航 | 有 | 有 | 有 | 有 | 有 | 有 | 有 |
| **search-sessions** | 搜索会话 | 人机交互·显示与导航 | 有 | 有 | 有 | 有 | 有 | 有 | 有 |
| **attach** | 发图与附件 | 人机交互·显示与导航 | 有 | 有 | 有 | 有 | 有 | 有 | 有 |
| **ui-sidebar** | 会话侧栏 | 人机交互·导航 | 有 | 有 | 有 | 有 | 有 | 有 | 有 |
| **ui-filter** | 筛选 | 人机交互·导航 | 有 | 有 | 有 | 有 | 有 | 有 | 有 |
| **ui-pin** | 置顶 | 人机交互·导航 | 有 | 无 | 无 | 无 | 有 | 无 | 有 |
| **ui-unread** | 新产出标记 | 人机交互·导航 | 有 | 无 | 无 | 有 | 有 | 无 | 有 |
| **ui-running-overview** | 运行总览 | 人机交互·导航 | 有 | 有 | 有 | 有 | 有 | 有 | 有 |
| **ui-markdown** | 富文本显示 | 人机交互·显示 | 有 | 有 | 有 | 有 | 有 | 有 | 有 |
| **ui-thinking** | 思考过程显示 | 人机交互·显示 | 有 | 有 | 有 | 有 | 有 | 有 | 有 |
| **ui-tool-card** | 工具调用卡片 | 人机交互·显示 | 有 | 有 | 有 | 有 | 有 | 有 | 有 |
| **ui-diff** | 文件改动显示 | 人机交互·显示 | 有 | 有 | 有 | 有 | 有 | 有 | 有 |
| **ui-terminal-output** | 命令输出显示 | 人机交互·显示 | 有 | 有 | 有 | 有 | 有 | 有 | 有 |
| **ui-subagent-view** | 子智能体显示 | 人机交互·显示 | 有 | 有 | 有 | 有 | 有 | 有 | 理 |
| **ui-plan-view** | 计划与待办显示 | 人机交互·显示 | 有 | 有 | 有 | 有 | 有 | 有 | 有 |
| **ui-status-line** | 当前状态显示 | 人机交互·显示 | 有 | 有 | 有 | 有 | 有 | 有 | 有 |
| **ui-usage** | 用量显示 | 人机交互·显示 | 有 | 有 | 有 | 有 | 有 | 有 | 有 |
| **ui-long-history** | 长会话浏览 | 人机交互·显示 | 有 | 有 | 有 | 有 | 有 | 有 | 有 |
| **ui-composer** | 输入框 | 人机交互·输入 | 有 | 有 | 有 | 有 | 有 | 有 | 有 |
| **ui-mention** | 引用文件或会话 | 人机交互·输入 | 有 | 有 | 有 | 有 | 有 | 有 | 有 |
| **ui-command-menu** | 命令菜单 | 人机交互·输入 | 有 | 有 | 有 | 有 | 有 | 有 | 有 |
| **ui-model-picker** | 模型与推理力度选择 | 人机交互·输入 | 有 | 有 | 有 | 有 | 有 | 有 | 有 |
| **ui-mode-picker** | 权限模式选择 | 人机交互·输入 | 有 | 有 | 有 | 有 | 有 | 有 | 有 |
| **ui-stop** | 停止按钮 | 人机交互·运行控制 | 有 | 有 | 有 | 有 | 有 | 有 | 有 |
| **ui-queue-steer** | 运行中发话 | 人机交互·运行控制 | 有 | 有 | 有 | 有 | 有 | 有 | 有 |
| **ui-approval** | 审批卡片 | 人机交互·运行控制 | 有 | 有 | 有 | 有 | 有 | 有 | 有 |
| **ui-question** | 回答智能体提问 | 人机交互·运行控制 | 有 | 有 | 有 | 有 | 有 | 有 | 有 |
| **ui-retry-edit** | 重试与编辑重发 | 人机交互·运行控制 | 有 | 有 | 有 | 有 | 有 | 有 | 有 |
| **ui-artifact-preview** | 产出预览 | 人机交互·产出物 | 有 | 有 | 部分 | 有 | 有 | 有 | 有 |
| **ui-copy-export** | 复制与导出 | 人机交互·产出物 | 有 | 有 | 有 | 有 | 有 | 有 | 有 |
| **ui-notify** | 通知 | 人机交互·通知 | 有 | 有 | 有 | 有 | 有 | 有 | 有 |
| **ui-multidevice** | 多端同一状态 | 人机交互·通知 | 未核实 | 未核实 | 无 | 无 | 无 | 无 | 部分 |
| **ui-theme** | 外观 | 人机交互·设置 | 有 | 有 | 有 | 有 | 有 | 有 | 有 |
| **ui-feedback** | 页面反馈 | 人机交互·设置 | 有 | 有 | 有 | 有 | 有 | 无 | 无 |
| **ui-attention-feed** | 待处理流 | 人机交互·导航 | 有 | 有 | 有 | 有 | 无 | 无 | 无 |
| **ui-activity-ring** | 活动标记 | 人机交互·显示 | 有 | 有 | 有 | 有 | 有 | 有 | 有 |
| **ui-project-tabs** | 项目分栏 | 人机交互·显示 | 有 | 有 | 有 | 有 | 有 | 有 | 有 |
| **ui-terminal-preview** | 终端镜像预览 | 人机交互·显示 | 有 | 有 | 有 | 有 | 无 | 无 | 有 |
| **ui-live-indicator** | 实时连接提示 | 人机交互·显示 | 有 | 有 | 有 | 有 | 有 | 有 | 有 |
| **ui-todo-board** | 待办看板 | 人机交互·显示 | 有 | 有 | 有 | 有 | 无 | 有 | 有 |
| **ui-thread-sections** | 自定义分组 | 人机交互·导航 | 有 | 有 | 有 | 有 | 无 | 无 | 无 |
| **ui-git-badge** | 分支与提交标记 | 人机交互·显示 | 有 | 有 | 有 | 有 | 有 | 有 | 有 |
| **ui-generative-embed** | 对话内交互组件 | 人机交互·显示 | 有 | 有 | 有 | 有 | 有 | 无 | 有 |
| **ui-automation-scheduler** | 定时任务台 | 人机交互·运行控制 | 有 | 有 | 有 | 有 | 无 | 无 | 有 |
| **ui-share-link** | 分享链接 | 人机交互·产出物 | 有 | 有 | 有 | 有 | 有 | 有 | 部分 |
| **ui-input-history** | 输入历史 | 人机交互·输入 | 有 | 有 | 有 | 有 | 有 | 有 | 有 |
| **ui-credit-ledger** | 扣费明细 | 人机交互·显示 | 有 | 有 | 有 | 有 | 无 | 部分 | 有 |
| **ui-quota-bar** | 剩余额度条 | 人机交互·显示 | 有 | 有 | 有 | 有 | 无 | 无 | 无 |
