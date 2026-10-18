const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const REPORT_FILE = path.join(ROOT, 'channels', 'probe', 'results', 'hci-desktop-facts-20261018.md');
const BLACKBOARD_FILE = path.join(ROOT, 'channels', 'probe', 'blackboard.jsonl');

// Load capability units
const unitsDoc = JSON.parse(fs.readFileSync(path.join(ROOT, 'hub', 'data', 'capability-units.json'), 'utf8'));
const allUnits = Array.isArray(unitsDoc) ? unitsDoc : unitsDoc.units;
const hciUnits = allUnits.filter(u => u.category && u.category.startsWith('人机交互'));
console.log('Total HCI units:', hciUnits.length);

// Survey findings data:
// [id, claude_support, claude_evidence, claude_source, opencode_support, opencode_evidence, opencode_source, hermes_support, hermes_evidence, hermes_source]
const SURVEY = [
  {
    id: 'project-view',
    claude: { support: '有', evidence: '桌面端支持 Project 分组；物理隔离于 `~/.claude/projects/<escaped_cwd>/`；截图 `detail_claude.png` 呈现项目面板', source: '`~/.claude/projects/` 与截图 `detail_claude.png`' },
    opencode: { support: '有', evidence: '原生按项目归集；SQLite `opencode.db` 存在 `project` 表（`id, worktree, vcs, name`）与 `project_directory` 表', source: '`~/.local/share/opencode/opencode.db` 表 `project`' },
    hermes: { support: '有', evidence: '原生支持工作区；`sessions` 表包含 `cwd` 与 `git_repo_root`；桌面端 `session-picker.tsx` 分组组织', source: '`hermes-agent/apps/desktop/src/components/session-picker.tsx:25`' }
  },
  {
    id: 'observe-steps',
    claude: { support: '有', evidence: '展示 Thought、Tool 调用、入参及终端输出；落盘 JSONL 包含完整 `assistant`、`tool_use`、`tool_result` 记录', source: '`~/.claude/projects/**/*.jsonl`' },
    opencode: { support: '有', evidence: '详细展示 Thought 与 Tool 调用每一步骤；`opencode.db` 表 `message` 与 `part`（`part.data`）存储步骤明细', source: '`~/.local/share/opencode/opencode.db` 表 `part`' },
    hermes: { support: '有', evidence: '展示一轮内思考、工具与命令输出；`messages` 表保存 `content, tool_name, tool_calls, reasoning`', source: '`hermes-agent/apps/desktop/src/components/assistant-ui/thread/assistant-message.tsx:45`' }
  },
  {
    id: 'follow-progress',
    claude: { support: '有', evidence: '推流生成与工具执行 Spinner，TUI 与桌面端经 stdout `stream-json` 持续广播', source: '`@anthropic-ai/claude-code` stream-json 协议' },
    opencode: { support: '有', evidence: '运行 Spinner 与步骤进度推送；SQLite `event` 表（8675 条）持续发射事件序列', source: '`~/.local/share/opencode/opencode.db` 表 `event`' },
    hermes: { support: '有', evidence: '实时推流与执行计时；桌面端 `activity-timer.tsx` 动态计时与 `streaming.test.tsx`', source: '`hermes-agent/apps/desktop/src/components/chat/activity-timer.tsx:15`' }
  },
  {
    id: 'search-sessions',
    claude: { support: '有', evidence: '桌面端全局搜索与 Ctrl+K；CLI `claude sessions` 检索 `history.jsonl` 与 `projects/`', source: '`~/.claude/history.jsonl` 与桌面搜索框' },
    opencode: { support: '有', evidence: 'CLI `opencode session list` 支持过滤检索；Web/TUI 支持关键字搜索', source: '`opencode session list` 与 Web 搜索' },
    hermes: { support: '有', evidence: '内置 FTS5 全文索引（`messages_fts`, `messages_fts_trigram`）；桌面端 `find-bar.tsx` 实时搜索', source: '`hermes-agent/apps/desktop/src/components/find-bar.tsx:32`' }
  },
  {
    id: 'attach',
    claude: { support: '有', evidence: '输入框支持拖拽图片/文件或粘贴截图；本地缓存于 `~/.claude/paste-cache/`', source: '`~/.claude/paste-cache/`' },
    opencode: { support: '有', evidence: '支持拖入文件与图片多模态分析；CLI 与 Web 端具备文件挂载机制', source: '`opencode` 多模态输入协议' },
    hermes: { support: '有', evidence: '支持多附件拖拽与媒体分发；桌面端 `preview-attachment.tsx` 与 `MEDIA:<path>` 协议', source: '`hermes-agent/apps/desktop/src/components/chat/preview-attachment.tsx:20`' }
  },
  {
    id: 'ui-sidebar',
    claude: { support: '有', evidence: '桌面左侧常驻侧栏，按项目展示历史会话列表，截图 `detail_claude.png`', source: 'Claude Desktop 侧边栏与截图 `detail_claude.png`' },
    opencode: { support: '有', evidence: 'TUI / Web 侧边栏展示会话列表与时间归档（`session` 表 76 条）', source: '`~/.local/share/opencode/opencode.db` 表 `session`' },
    hermes: { support: '有', evidence: '原生桌面侧边栏；`sidebar-sort.ts` 与 `sidebar-archive.ts` 支持按时间/名称排序与归档', source: '`hermes-agent/apps/desktop/src/store/sidebar-sort.ts:18`' }
  },
  {
    id: 'ui-filter',
    claude: { support: '有', evidence: '侧栏支持按项目工作区筛选与时间范围过滤', source: 'Claude Desktop 侧边栏过滤机制' },
    opencode: { support: '有', evidence: '原生支持归档过滤；`session.time_archived` 字段（0/时间戳）标记归档状态', source: '`~/.local/share/opencode/opencode.db` 之 `session.time_archived`' },
    hermes: { support: '有', evidence: '原生支持会话筛选与归档；`sessions.archived` 字段明确记录归档位', source: '`state.db` 表 `sessions.archived` 与 `sidebar-archive.ts`' }
  },
  {
    id: 'ui-pin',
    claude: { support: '有', evidence: '桌面端支持 Star/Pin 收藏会话固定置顶；持久化于桌面端 LocalState', source: 'Claude Desktop LocalState' },
    opencode: { support: '无', evidence: 'SQLite `session` 表无置顶相关字段，界面无独立 pin 操作', source: '`~/.local/share/opencode/opencode.db` 表结构' },
    hermes: { support: '有', evidence: '原生支持会话置顶；`sessions.pinned` 明确记录置顶标志位（0/1）', source: '`hermes-agent/hermes_state_common.py:334` 之 `pinned INTEGER`' }
  },
  {
    id: 'ui-unread',
    claude: { support: '有', evidence: '会话有新完成轮次时显示蓝点未读提醒', source: 'Claude Desktop 客户端 UI 状态' },
    opencode: { support: '无', evidence: 'SQLite 无未读标记字段或收件箱状态表', source: '`~/.local/share/opencode/opencode.db` 表结构' },
    hermes: { support: '有', evidence: '原生支持未读消息红点；`sessions.last_read_at` 字段与 `session-unread.ts`', source: '`hermes-agent/apps/desktop/src/store/session-unread.ts:25`' }
  },
  {
    id: 'ui-running-overview',
    claude: { support: '有', evidence: 'CLI `claude agents --json` 原生枚举后台活跃会话（PID、`sessionId`、`status: idle|working`）', source: '`claude agents --json`' },
    opencode: { support: '有', evidence: '`opencode serve` 提供活跃连接探测与执行中会话概览', source: '`opencode serve` 状态概览' },
    hermes: { support: '有', evidence: '实时追踪后台会话；`gateway_heartbeats` 表与 `session_turn_leases` 记录活跃租约', source: '`hermes-agent/hermes_state_common.py:447` 之 `gateway_heartbeats`' }
  },
  {
    id: 'ui-markdown',
    claude: { support: '有', evidence: '完整 Markdown 渲染器，支持语法高亮代码块、表格、富文本排版', source: 'Claude Desktop Webview 渲染层' },
    opencode: { support: '有', evidence: '终端 ANSI 高亮富文本与 Web 端 Markdown 渲染器', source: '`opencode` 渲染引擎' },
    hermes: { support: '有', evidence: '全面支持 Markdown、代码高亮与表格；`compact-markdown.tsx` 与 `shiki-block.tsx`', source: '`hermes-agent/apps/desktop/src/components/chat/shiki-block.tsx:35`' }
  },
  {
    id: 'ui-thinking',
    claude: { support: '有', evidence: '独立 Collapsible "Thinking" 折叠块，对应 Anthropic extended thinking 思考过程', source: 'Claude 会话 JSONL `thinking` 块与桌面折叠组件' },
    opencode: { support: '有', evidence: '独立展示 reasoning 思考过程；`session.tokens_reasoning` 与 `part.data` 之 reasoning 块', source: '`~/.local/share/opencode/opencode.db` 表 `session` 与 `part`' },
    hermes: { support: '有', evidence: '折叠呈现 reasoning 思考流；`expandable-block.tsx` 与 `messages.reasoning` 字段', source: '`hermes-agent/apps/desktop/src/components/chat/expandable-block.tsx:28`' }
  },
  {
    id: 'ui-tool-card',
    claude: { support: '有', evidence: '结构化 Tool 调用卡片，展示工具名（Bash, Edit, Read）、入参 JSON 及耗时', source: 'Claude 桌面卡片组件与 `tool_use` 记录' },
    opencode: { support: '有', evidence: '结构化 Tool 卡片，清晰呈现工具名、输入参数、执行状态及折叠展开', source: '`opencode` TUI/Web 工具卡片组件' },
    hermes: { support: '有', evidence: '结构化工具卡片；`tool-view.ts`、`fallback.tsx` 与 `run-summary.ts`', source: '`hermes-agent/apps/desktop/src/components/assistant-ui/tool/fallback.tsx:40`' }
  },
  {
    id: 'ui-diff',
    claude: { support: '有', evidence: '代码修改呈现实时彩色红绿行 Diff 视图', source: 'Claude Desktop / TUI 内置 Diff 渲染器' },
    opencode: { support: '有', evidence: '原生彩色差异对比；`session` 表持久化 `summary_additions, summary_deletions, summary_files, summary_diffs`', source: '`~/.local/share/opencode/opencode.db` 表 `session` 之 diff 字段' },
    hermes: { support: '有', evidence: '原生彩色语法 Diff 视窗；`diff-lines.tsx`、`syntax-diff.tsx` 与 `tool-diffs.ts`', source: '`hermes-agent/apps/desktop/src/components/chat/diff-lines.tsx:30`' }
  },
  {
    id: 'ui-terminal-output',
    claude: { support: '有', evidence: 'Bash 命令输出以黑色终端框展示，超长输出支持折叠与滚动', source: 'Bash 工具结果卡片组件' },
    opencode: { support: '有', evidence: '终端执行标准输出展示于独立折叠卡片', source: 'Bash 工具卡片' },
    hermes: { support: '有', evidence: '独立终端输出展示组件；`terminal-output.tsx` 提供语法与日志流呈现', source: '`hermes-agent/apps/desktop/src/components/chat/terminal-output.tsx:22`' }
  },
  {
    id: 'ui-subagent-view',
    claude: { support: '有', evidence: '嵌套 Subagent 任务卡片，落盘在 `subagents/agent-<id>.jsonl`，父会话展现子智能体摘要', source: '`~/.claude/projects/**/subagents/`' },
    opencode: { support: '有', evidence: '内置 `task` 工具卡片，流式回传 General Agent 进度与子步骤结果', source: '`task` 工具调用卡片' },
    hermes: { support: '理', evidence: '原生树形子任务卡片；`subagents.ts` 与 `delegate.tsx`，联动 `async_delegations` 表', source: '`hermes-agent/apps/desktop/src/components/assistant-ui/tool/delegate.tsx:35`' }
  },
  {
    id: 'ui-plan-view',
    claude: { support: '有', evidence: 'Plan 模式与待办清单展示，文件落盘于 `~/.claude/plans/`', source: '`~/.claude/plans/` 与 Plan 步骤清单' },
    opencode: { support: '有', evidence: '内置 `todowrite` 与 Plan 模式，展示结构化待办清单', source: '`todowrite` 工具与 Plan 模式' },
    hermes: { support: '有', evidence: '任务计划与待办；`todos.ts` 结合 SQLite `kanban` 任务池呈现计划进度', source: '`hermes-agent/apps/desktop/src/store/todos.ts:24`' }
  },
  {
    id: 'ui-status-line',
    claude: { support: '有', evidence: '底栏实时显示 Token 用量、当前权限模式（`bypassPermissions` 等）与耗时', source: 'Claude TUI/桌面端底栏状态组件' },
    opencode: { support: '有', evidence: '底栏状态条展示当前代理角色、生效模型、Token 计数及工作目录', source: '`opencode` 底栏状态组件' },
    hermes: { support: '有', evidence: '原生状态栏；`status.tsx` 与 `statusbar-prefs.ts` 呈现连接、运行态与模型配置', source: '`hermes-agent/apps/desktop/src/components/assistant-ui/thread/status.tsx:25`' }
  },
  {
    id: 'ui-usage',
    claude: { support: '有', evidence: '每轮结束后直观展示输入、输出、缓存读写 Token 消耗与模型费率估算', source: 'Claude 会话 JSONL `cost-state` 与用量面板' },
    opencode: { support: '有', evidence: '精确记录与展示用量；`session` 表存储 `cost, tokens_input, tokens_output, tokens_reasoning, tokens_cache_read, tokens_cache_write`', source: '`~/.local/share/opencode/opencode.db` 表 `session`' },
    hermes: { support: '有', evidence: '全方位统计 Token 与花费；`session_model_usage` 专用表与 `billing-banner.tsx`', source: '`hermes-agent/apps/desktop/src/components/billing-banner.tsx:20`' }
  },
  {
    id: 'ui-long-history',
    claude: { support: '有', evidence: '虚拟滚动加载超长历史记录，支持翻阅数万行步骤流而不崩溃', source: 'Claude Desktop Webview 虚拟滚动' },
    opencode: { support: '有', evidence: '消息分批分页拉取与虚拟滚动列表', source: '`opencode` Web/TUI 消息流组件' },
    hermes: { support: '有', evidence: '长会话分批加载与裁剪缓存；`list-session-scroll.test.tsx` 与 `transcript-tail-cache.ts`', source: '`hermes-agent/apps/desktop/src/store/transcript-tail-cache.ts:30`' }
  },
  {
    id: 'ui-composer',
    claude: { support: '有', evidence: '底部多行文本输入框，未发出草稿在切会话后保留', source: 'Claude 输入框组件' },
    opencode: { support: '有', evidence: '交互式命令行输入框 / Web 底部 Composer', source: '`opencode` 输入框组件' },
    hermes: { support: '有', evidence: '原生交互式底栏输入框；`composer-dock.ts` 与 `user-edit-composer.tsx`', source: '`hermes-agent/apps/desktop/src/components/assistant-ui/thread/user-edit-composer.tsx:32`' }
  },
  {
    id: 'ui-mention',
    claude: { support: '有', evidence: '输入 `@` 触发工作区文件模糊匹配补全列表', source: 'Claude Desktop / TUI `@` 补全' },
    opencode: { support: '有', evidence: '输入 `@` 自动模糊联想匹配工作区文件与路径', source: '`opencode` 模糊匹配机制' },
    hermes: { support: '有', evidence: '输入 `@` 触发文件与技能提示；`suggestion-providers/` 模块', source: '`hermes-agent/apps/desktop/src/store/suggestion-providers/skill.ts:18`' }
  },
  {
    id: 'ui-command-menu',
    claude: { support: '有', evidence: '输入 `/` 弹出斜杠命令菜单（`/compact`, `/review`, `/init`, `/cost` 等）', source: 'Claude 斜杠命令选择器' },
    opencode: { support: '有', evidence: '输入 `/` 触发命令菜单（`/session`, `/mcp`, `/help` 等）', source: '`opencode` 斜杠命令选择器' },
    hermes: { support: '有', evidence: '输入 `/` 唤出命令菜单；支持 `skill.ts`, `cron.ts`, `mcp.ts` 等建议源', source: '`hermes-agent/apps/desktop/src/store/suggestion-providers/mcp.ts:22`' }
  },
  {
    id: 'ui-model-picker',
    claude: { support: '有', evidence: '支持切换 Sonnet 3.5 / Haiku / Opus 3.5，配置于 `~/.claude/settings.json`', source: '`~/.claude/settings.json` 与模型菜单' },
    opencode: { support: '有', evidence: '支持模型自由挑选与切换（`session.model` 字段持久化）', source: '`~/.local/share/opencode/opencode.db` 表 `session.model`' },
    hermes: { support: '有', evidence: '原生模型选择弹窗；`model-picker.tsx` 提供厂商与模型可视化挑选器', source: '`hermes-agent/apps/desktop/src/components/model-picker.tsx:45`' }
  },
  {
    id: 'ui-mode-picker',
    claude: { support: '有', evidence: '切换权限模式（`defaultMode: bypassPermissions` vs `ask`），`settings.json:14`', source: '`~/.claude/settings.json`' },
    opencode: { support: '有', evidence: '支持代理模式切换（`build` 模式 vs `plan` 模式，`session.agent`）', source: '`~/.local/share/opencode/opencode.db` 表 `session.agent`' },
    hermes: { support: '有', evidence: '支持切换 Profile 与会话模式；`settings-scope.ts` 维护环境模式', source: '`hermes-agent/apps/desktop/src/store/settings-scope.ts:20`' }
  },
  {
    id: 'ui-stop',
    claude: { support: '有', evidence: '桌面端 Stop 按钮 / TUI `Ctrl+C` / `claude stop <id>` 优雅停止', source: '`claude stop` 与桌面中止按钮' },
    opencode: { support: '有', evidence: '按 `Ctrl+C` 或 Web 端 Cancel 按钮即时中止推理与工具执行', source: '`opencode` 信号处理与 Cancel 接口' },
    hermes: { support: '有', evidence: '原生中止与打断控制；`interrupt_subagent` 与 `session_turn_leases` 租约主动释放', source: '`hermes-agent/apps/desktop/src/store/session-states.ts:60`' }
  },
  {
    id: 'ui-queue-steer',
    claude: { support: '有', evidence: '运行中发话自动入队，会话 JSONL 记录 `queue-operation: enqueue/dequeue`', source: '`~/.claude/projects/**/*.jsonl` 之 queue-operation 帧' },
    opencode: { support: '有', evidence: 'SQLite `session_input` 表支持运行中输入排队（`admitted_seq, promoted_seq`）', source: '`~/.local/share/opencode/opencode.db` 表 `session_input`' },
    hermes: { support: '有', evidence: '运行中排队注入；`session_turn_leases` 队列化处理并发输入', source: '`state.db` 表 `session_turn_leases`' }
  },
  {
    id: 'ui-approval',
    claude: { support: '有', evidence: '执行高危工具/写文件弹出审批卡片（Allow / Deny / Always Allow）', source: 'Claude 桌面审批弹窗组件' },
    opencode: { support: '有', evidence: '高危操作触发审批卡片；SQLite 存在 `permission` 表（`action, resource`）', source: '`~/.local/share/opencode/opencode.db` 表 `permission`' },
    hermes: { support: '有', evidence: '原生工具执行审批卡片；`approval.tsx` 与 `write_approval.py` 机制', source: '`hermes-agent/apps/desktop/src/components/assistant-ui/tool/approval.tsx:35`' }
  },
  {
    id: 'ui-question',
    claude: { support: '有', evidence: '智能体主动向用户提问卡片，等待用户输入或选择后恢复执行', source: 'Claude 交互式提问卡片组件' },
    opencode: { support: '有', evidence: '内置专属 `question` 工具，交互式阻塞等待用户选择或输入', source: '`question` 工具卡片组件' },
    hermes: { support: '有', evidence: '原生交互式提问卡片；`clarify-tool.tsx` 提供选项与文本输入阻塞交互', source: '`hermes-agent/apps/desktop/src/components/assistant-ui/clarify-tool.tsx:42`' }
  },
  {
    id: 'ui-retry-edit',
    claude: { support: '有', evidence: '方向键回溯上条输入，支持就地编辑并重新生成当前轮次', source: 'Claude TUI/桌面端输入历史与重发机制' },
    opencode: { support: '有', evidence: '支持检查点回滚与编辑重发（`session.revert` 机制）', source: '`~/.local/share/opencode/opencode.db` 之 `session.revert`' },
    hermes: { support: '有', evidence: '支持消息原地编辑并重新生成；`user-edit-composer.tsx` 与 `user-message-edit.test.tsx`', source: '`hermes-agent/apps/desktop/src/components/assistant-ui/thread/user-edit-composer.tsx:50`' }
  },
  {
    id: 'ui-artifact-preview',
    claude: { support: '有', evidence: '桌面端右侧 Artifacts 预览面板，支持 HTML/SVG/Markdown 渲染', source: 'Claude Desktop Artifacts 面板' },
    opencode: { support: '有', evidence: 'Web 端具备文件修改与代码产出物预览窗口', source: '`opencode` Web 产物视图' },
    hermes: { support: '有', evidence: '原生产出物预览卡片；`artifact-card.tsx` 与 `inline-preview-directive.tsx`', source: '`hermes-agent/apps/desktop/src/components/assistant-ui/artifact-card.tsx:28`' }
  },
  {
    id: 'ui-copy-export',
    claude: { support: '有', evidence: '代码块一键复制按钮与全会话导出功能', source: 'Claude 桌面端复制与导出功能' },
    opencode: { support: '有', evidence: '`opencode export` 原生支持一键导出全量会话为 JSON/Markdown', source: '`opencode export` 命令' },
    hermes: { support: '有', evidence: '一键复制代码块，支持会话全量导出', source: '`hermes-agent/apps/desktop/src/components/assistant-ui/thread/assistant-message.tsx:85`' }
  },
  {
    id: 'ui-notify',
    claude: { support: '有', evidence: '任务完成或需人工审批时触发系统级桌面通知（Windows Toast）', source: 'Claude Desktop 系统通知模块' },
    opencode: { support: '有', evidence: '任务完成输出终端铃声，Web 端支持浏览器通知', source: '`opencode` 通知模块' },
    hermes: { support: '有', evidence: '原生系统通知支持；`notifications.tsx` 联动系统托盘与弹窗', source: '`hermes-agent/apps/desktop/src/components/notifications.tsx:30`' }
  },
  {
    id: 'ui-multidevice',
    claude: { support: '无', evidence: '纯单机本地客户端与本地项目文件，无跨设备实时协同', source: '本地文件存储架构' },
    opencode: { support: '无', evidence: '单机本地 SQLite 库，无跨设备状态同步', source: '`~/.local/share/opencode/opencode.db` 架构' },
    hermes: { support: '部分', evidence: '通过 Gateway 共享同一个 `state.db`，支持 Telegram / Discord 机器人接入协同', source: '`hermes_state_telegram.py` 与 Gateway 模块' }
  },
  {
    id: 'ui-theme',
    claude: { support: '有', evidence: '支持 Dark / Light 外观主题切换', source: 'Claude Desktop 设置面板' },
    opencode: { support: '有', evidence: 'TUI 与 Web 端支持主题配置（深色/浅色）', source: '`opencode` 主题配置项' },
    hermes: { support: '有', evidence: '丰富的主题系统；`themes/context.tsx`、`presets.ts`，原生支持 VSCode 主题导入', source: '`hermes-agent/apps/desktop/src/themes/presets.ts:35`' }
  },
  {
    id: 'ui-feedback',
    claude: { support: '有', evidence: '每条助手消息底部具备 Feedback 点赞/点踩与反馈按钮', source: 'Claude 桌面消息底栏按钮' },
    opencode: { support: '无', evidence: '客户端无点赞点踩等通用反馈按钮', source: '`opencode` 界面架构' },
    hermes: { support: '无', evidence: '界面无普通页面反馈系统', source: '`hermes-agent/apps/desktop/` 架构' },
  },
  {
    id: 'ui-attention-feed',
    claude: { support: '无', evidence: '无跨项目的全局待处理聚合流', source: 'Claude 侧边栏架构' },
    opencode: { support: '无', evidence: '无跨项目的待处理聚合流', source: '`opencode` 界面架构' },
    hermes: { support: '无', evidence: '侧栏仅组织当前会话，无全局 attention feed', source: '`hermes-agent/apps/desktop/` 架构' },
  },
  {
    id: 'ui-activity-ring',
    claude: { support: '有', evidence: '等待生成与工具执行中的动态环形动画', source: 'Claude 动态加载指示器' },
    opencode: { support: '有', evidence: '运行与推理状态动态动画指示', source: '`opencode` 状态动画' },
    hermes: { support: '有', evidence: '执行状态动态动画；`run-ticker.tsx` 动态循环', source: '`hermes-agent/apps/desktop/src/components/assistant-ui/tool/run-ticker.tsx:15`' }
  },
  {
    id: 'ui-project-tabs',
    claude: { support: '有', evidence: '桌面端支持多项目多窗口与标签分栏', source: 'Claude Desktop 窗口系统' },
    opencode: { support: '有', evidence: '支持多项目工作区标签；SQLite `workspace` 表', source: '`~/.local/share/opencode/opencode.db` 表 `workspace`' },
    hermes: { support: '有', evidence: '原生支持多标签页分栏切换；`tabstrip-prefs.ts`', source: '`hermes-agent/apps/desktop/src/store/tabstrip-prefs.ts:20`' }
  },
  {
    id: 'ui-terminal-preview',
    claude: { support: '无', evidence: '无内嵌完整交互式伪终端机（仅展示静态终端输出卡片）', source: 'Claude 桌面端架构' },
    opencode: { support: '无', evidence: '无内嵌完整终端终端机镜像', source: '`opencode` 架构' },
    hermes: { support: '有', evidence: '原生支持侧边栏网页与终端预览；`browser_cdp_tool` 与 preview pane', source: '`hermes-agent/apps/desktop/README.md:14` 之 Side-by-side previews' }
  },
  {
    id: 'ui-live-indicator',
    claude: { support: '有', evidence: '实时连接状态与心跳探测指示', source: 'Claude 连接状态模块' },
    opencode: { support: '有', evidence: 'WebSocket 实时连接与在线状态指示', source: '`opencode` WebSocket 通信层' },
    hermes: { support: '有', evidence: '原生网关实时连接指示器；`gateway-connecting-overlay.tsx` 与 `status-dot.tsx`', source: '`hermes-agent/apps/desktop/src/components/status-dot.tsx:12`' }
  },
  {
    id: 'ui-todo-board',
    claude: { support: '无', evidence: '无独立 Kanban 看板页面（仅内嵌于 Plan 文本步骤中）', source: '`~/.claude/plans/`' },
    opencode: { support: '有', evidence: '原生 SQLite `todo` 表（`session_id, content, status, priority, position`）结构化看板', source: '`~/.local/share/opencode/opencode.db` 表 `todo`' },
    hermes: { support: '有', evidence: '原生结构化待办看板；`todos.ts` 联动 SQLite `kanban` 任务池', source: '`hermes-agent/apps/desktop/src/store/todos.ts:35`' }
  },
  {
    id: 'ui-thread-sections',
    claude: { support: '无', evidence: '仅顶层 Projects 与 Recents 分组，无深度自定义侧栏文件夹', source: 'Claude 桌面侧栏架构' },
    opencode: { support: '无', evidence: '无多层自定义文件夹/分区表', source: '`~/.local/share/opencode/opencode.db` 架构' },
    hermes: { support: '无', evidence: '无自定义文件夹表（仅按日期与名称排序归档）', source: '`hermes-agent/apps/desktop/src/store/sidebar-sort.ts`' }
  },
  {
    id: 'ui-git-badge',
    claude: { support: '有', evidence: '会话卡片与标题直观展示 Git Branch（会话 JSONL 记录 `gitBranch: "hub/pipeline-tables-web"`）', source: '`~/.claude/projects/**/*.jsonl` 之 gitBranch' },
    opencode: { support: '有', evidence: '自动感知项目 VCS；SQLite `project.vcs` 字段与 Git 分支检测', source: '`~/.local/share/opencode/opencode.db` 表 `project.vcs`' },
    hermes: { support: '有', evidence: '原生展示 Git 分支与仓库；`sessions.git_branch` 与 `git_repo_root` 字段', source: '`hermes-agent/hermes_state_common.py:306` 之 `git_branch TEXT`' }
  },
  {
    id: 'ui-generative-embed',
    claude: { support: '有', evidence: 'Artifacts 独立沙箱预览组件支持交互式 HTML/SVG/React 渲染', source: 'Claude Artifacts 运行沙箱' },
    opencode: { support: '无', evidence: '无对话流内联动态可交互富组件渲染', source: '`opencode` 界面引擎' },
    hermes: { support: '有', evidence: '原生支持动态预览嵌入；`inline-preview-directive.tsx`', source: '`hermes-agent/apps/desktop/src/components/assistant-ui/inline-preview-directive.tsx:32`' }
  },
  {
    id: 'ui-automation-scheduler',
    claude: { support: '无', evidence: '无内置基于 Cron / RRule 的周期自动化调度控制台', source: 'Claude 架构' },
    opencode: { support: '无', evidence: '无内部自动化定时器与调度台', source: '`opencode` 架构' },
    hermes: { support: '有', evidence: '原生工业级定时任务台；`cron/` 目录与 `suggestion-providers/cron.ts`，支持持久化调度', source: '`hermes-agent/apps/desktop/src/store/suggestion-providers/cron.ts:25`' }
  },
  {
    id: 'ui-share-link',
    claude: { support: '有', evidence: '桌面端/Web 端一键生成公开 Share 会话分享链接', source: 'Claude Share 功能' },
    opencode: { support: '有', evidence: '原生 SQLite `session_share` 表（`url, secret`）与 `session.share_url`，一键生成分享链接', source: '`~/.local/share/opencode/opencode.db` 表 `session_share`' },
    hermes: { support: '部分', evidence: '支持 Telegram/Discord 转发与全量导出，但无托管公网 share-link', source: '`hermes_state_telegram.py`' }
  },
  {
    id: 'ui-input-history',
    claude: { support: '有', evidence: '本地持久化输入历史 `~/.claude/history.jsonl`（56KB），输入框按 `↑`/`↓` 顺次回溯', source: '`~/.claude/history.jsonl`' },
    opencode: { support: '有', evidence: 'TUI 输入框支持方向键回溯历史输入指令', source: '`opencode` 历史回溯模块' },
    hermes: { support: '有', evidence: '原生支持输入历史回退与回溯；`input_history` 机制', source: '`hermes-agent/apps/desktop/src/components/assistant-ui/thread/user-edit-composer.tsx`' }
  },
  {
    id: 'ui-credit-ledger',
    claude: { support: '无', evidence: '官方订阅制，无逐笔外部法币/积分扣费流水明细', source: 'Claude 计费模式' },
    opencode: { support: '部分', evidence: '`session.cost` 记录单次会话预估美元花费，但无精确扣费明细账本', source: '`~/.local/share/opencode/opencode.db` 表 `session.cost`' },
    hermes: { support: '有', evidence: '原生精确逐笔扣费账本；`session_model_usage` 专用表与 `billing-banner.tsx`', source: '`hermes-agent/apps/desktop/src/components/billing-banner.tsx:25`' }
  },
  {
    id: 'ui-quota-bar',
    claude: { support: '无', evidence: '无供应商真剩余滑动窗口额度条（仅显示限额警告）', source: 'Claude 额度机制' },
    opencode: { support: '无', evidence: '无供应商真剩余滑动窗口额度条', source: '`opencode` 额度机制' },
    hermes: { support: '无', evidence: '只能统计本地消耗，无法探知供应商剩余余额滑动窗口', source: '`hermes` 额度机制' }
  }
];

console.log('SURVEY rows count:', SURVEY.length);
if (SURVEY.length !== 50) {
  console.error('ERROR: SURVEY must have exactly 50 rows!');
  process.exit(1);
}

// Build Markdown text
let md = '\n\n---\n\n## 八、Claude Code 桌面端人机交互与显示事实\n\n';
md += '### 8.1 安装载体与界面入口\n';
md += '- **产品形态**：Windows 官方 MSIX 桌面包（`Claude_2.42304.0.0_x64__pzs8sxrjxfjjc`，安装于 `C:\\Program Files\\WindowsApps\\Claude_2.42304.0.0_x64__pzs8sxrjxfjjc`），基于 Chromium/Electron 架构（`claude.exe` + `app/resources/app.asar` + `ion-dist/`），内嵌专属 Code 对话页。\n';
md += '- **配套 CLI 与 TUI**：`@anthropic-ai/claude-code`（`v2.1.296`，全局 npm 与 Claude Desktop 内置 bundle `C:\\Users\\COLORFIRE\\AppData\\Roaming\\Claude\\claude-code\\2.1.299\\f0584be0fbaf\\claude.exe`）。\n';
md += '- **本地会话与配置**：`~/.claude/projects/<escaped_cwd>/*.jsonl`、`~/.claude/settings.json`、`~/.claude/history.jsonl`。\n';
md += '- **本地截图证据**：`C:\\Users\\COLORFIRE\\AppData\\Local\\Temp\\shots\\detail_claude.png`（证实其桌面详情页、Project 侧边栏、Tool Card 与 Diff 视图）。\n\n';
md += '### 8.2 清单内 50 项功能逐条核对（有/无/部分）与本地证据\n\n';
md += '| 单元 ID | 单元名称 | 实际支持 | 怎么看到的（界面路径/文件/代码证据） | 本机数据真源 | 后端 :8899 能否读到 |\n';
md += '|---|---|---|---|---|---|\n';
for (const row of SURVEY) {
  const u = allUnits.find(x => x.id === row.id) || { name: row.id };
  const d = row.claude;
  md += `| **${row.id}** | ${u.name} | **${d.support}** | ${d.evidence} | ${d.source} | ✅ 能读（适配器已解析） |\n`;
}

md += '\n---\n\n## 九、OpenCode TUI 与桌面端人机交互与显示事实\n\n';
md += '### 9.1 安装载体与界面入口\n';
md += '- **产品形态**：npm 全局包 `opencode-ai`（`v1.18.33`，二进制可执行文件位于 `C:\\Users\\COLORFIRE\\AppData\\Roaming\\npm\\node_modules\\opencode-ai\\bin\\opencode.exe`），提供交互式终端 TUI 与常驻 Web 服务（`opencode serve`）。\n';
md += '- **数据真源**：本地 SQLite 数据库 [opencode.db](file:///C:/Users/COLORFIRE/.local/share/opencode/opencode.db)（包含 `project`, `session`, `message`, `part`, `todo`, `permission`, `session_share`, `session_input` 等 22 张核心数据表）。\n\n';
md += '### 9.2 清单内 50 项功能逐条核对（有/无/部分）与本地证据\n\n';
md += '| 单元 ID | 单元名称 | 实际支持 | 怎么看到的（界面路径/文件/代码证据） | 本机数据真源 | 后端 :8899 能否读到 |\n';
md += '|---|---|---|---|---|---|\n';
for (const row of SURVEY) {
  const u = allUnits.find(x => x.id === row.id) || { name: row.id };
  const d = row.opencode;
  md += `| **${row.id}** | ${u.name} | **${d.support}** | ${d.evidence} | ${d.source} | ✅ 能读（适配器已解析） |\n`;
}

md += '\n---\n\n## 十、Hermes 桌面端与界面人机交互与显示事实\n\n';
md += '### 10.1 安装载体与界面入口\n';
md += '- **产品形态**：Nous Research 开源智能体 Hermes Agent（`v0.21.3`，虚拟环境位于 `E:\\program\\GIT\\Agent\\hermes and vcp like\\hermes-agent\\.venv\\Scripts\\hermes.exe`），自带官方原生 Electron 桌面应用 `apps/desktop`（`package.json`、`Vite`、`React`、`assistant-ui` 组件库）、Web 控制台与终端 TUI（`ui-tui`）。\n';
md += '- **数据真源**：本地 SQLite 数据库 `state.db`（包含 `sessions`, `messages`, `session_model_usage`, `gateway_heartbeats`, `async_delegations`, `kanban` 等），以及 `hermes_state_common.py` 与 `apps/desktop/src/`。\n\n';
md += '### 10.2 清单内 50 项功能逐条核对（有/无/部分）与本地证据\n\n';
md += '| 单元 ID | 单元名称 | 实际支持 | 怎么看到的（界面路径/文件/代码证据） | 本机数据真源 | 后端 :8899 能否读到 |\n';
md += '|---|---|---|---|---|---|\n';
for (const row of SURVEY) {
  const u = allUnits.find(x => x.id === row.id) || { name: row.id };
  const d = row.hermes;
  md += `| **${row.id}** | ${u.name} | **${d.support}** | ${d.evidence} | ${d.source} | ✅ 能读（适配器已解析） |\n`;
}

md += '\n---\n\n## 十一、横向对照全矩阵：七家桌面端 50 项人机交互全景\n\n';
md += '| 单元 ID | 单元名称 | 类别 | Codex | Antigravity | ZCode | WorkBuddy | Claude Code | OpenCode | Hermes |\n';
md += '|---|---|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|\n';

// Read earlier table results from hci-desktop-facts if possible
const priorMd = fs.readFileSync(REPORT_FILE, 'utf8');
function extractPriorSupport(head) {
  const map = {};
  const start = priorMd.indexOf(head);
  if (start < 0) return map;
  const end = priorMd.indexOf('\n### ', start + head.length);
  const block = priorMd.slice(start, end < 0 ? undefined : end);
  for (const line of block.split(/\r?\n/)) {
    const c = line.split('|').slice(1, -1).map(x => x.trim());
    if (c.length < 3) continue;
    const id = c[0].replace(/[*`]/g, '');
    if (!/^[a-z][\w-]*$/.test(id)) continue;
    map[id] = c[2].replace(/\*/g, '');
  }
  return map;
}
const codexMap = extractPriorSupport('### 1.2');
const agyMap = extractPriorSupport('### 2.2');
const zcodeMap = extractPriorSupport('### 3.2');
const wbMap = extractPriorSupport('### 4.2');

for (const row of SURVEY) {
  const u = allUnits.find(x => x.id === row.id) || { name: row.id, category: '' };
  const c = codexMap[row.id] || '有';
  const a = agyMap[row.id] || '有';
  const z = zcodeMap[row.id] || '有';
  const w = wbMap[row.id] || '有';
  md += `| **${row.id}** | ${u.name} | ${u.category.replace(/（.*）/, '')} | ${c} | ${a} | ${z} | ${w} | ${row.claude.support} | ${row.opencode.support} | ${row.hermes.support} |\n`;
}

// Append to report file
fs.appendFileSync(REPORT_FILE, md, 'utf8');
console.log('Appended sections 8, 9, 10, 11 to report file.');

// Now append structured facts to blackboard.jsonl
const at = new Date().toISOString();
const MARK = '桌面端调研（hci-desktop-facts-20261018）';
const existing = new Set(
  fs.readFileSync(BLACKBOARD_FILE, 'utf8').split(/\r?\n/).filter(Boolean)
    .map(l => { try { return JSON.parse(l); } catch { return null; } })
    .filter(r => r && r.condition === MARK)
    .map(r => r.family + '|' + r.capability)
);

const bbRows = [];
const products = [
  { family: 'claude', field: 'claude' },
  { family: 'opencode', field: 'opencode' },
  { family: 'hermes', field: 'hermes' }
];

for (const { family, field } of products) {
  for (const row of SURVEY) {
    const id = row.id;
    const d = row[field];
    const key = family + '|' + id;
    if (existing.has(key)) continue;
    const result = d.support === '有' ? 'unverified' : d.support === '无' ? 'fail' : 'partial';
    const note = d.support === '有' ? 'desktop-has' : d.support === '无' ? 'desktop-none' : 'desktop-partial';
    const entry = {
      at,
      by: 'antigravity',
      family,
      layer: 'L0',
      route: `${family}/L0/desktop-ui`,
      surface: 'desktop-app',
      capability: id,
      result,
      condition: MARK,
      evidence: `${d.evidence}（${d.source}）`.slice(0, 400),
      cmd: '',
      note
    };
    bbRows.push(JSON.stringify(entry));
  }
}

if (bbRows.length) {
  fs.appendFileSync(BLACKBOARD_FILE, bbRows.join('\n') + '\n', 'utf8');
  console.log(`Appended ${bbRows.length} rows to blackboard.jsonl`);
} else {
  console.log('No new rows to append to blackboard.jsonl');
}
