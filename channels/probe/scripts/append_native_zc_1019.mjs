// Append native-surface findings for ZCode to the probe blackboard (batch 1).
// One row per cell, real timestamps, evidence from probe-results.jsonl runs of
// channels/probe/scripts/native_zcode_1019.mjs on 2026-10-19 (ZCode CLI 0.16.9,
// zcode-acp-server 0.69.3). UTF-8 without BOM, append-only.
import fs from 'node:fs';

const BB = 'E:/program/GIT/Agent/multi/Agent-Architecture-Hub/channels/probe/blackboard.jsonl';
const VER = 'ZCode CLI 0.16.9 + zcode-acp-server 0.69.3';
const rows = [];
const row = (capability, layer, route, surface, result, condition, evidence, cmd, note) =>
  rows.push({ at: new Date().toISOString(), by: 'zcode', family: 'zcode', layer, route, surface, capability, result, condition, evidence, cmd, note });

// --- L1a（ACP 桥）实测，2026-10-19，脚本 native_zcode_1019.mjs ---
row('cmd-list', 'L1a', 'zcode/L1a/zcode-acp-server', 'acp-bridge', 'pass',
  'session/new 后 50/300/1000ms 三次推送 available_commands_update',
  '实测 19 条命令：11 原生（auto compact goal fork mode model thought quota resume mcp init）+ 8 个技能（$anysearch 等），各带说明与参数提示；其中 9 条已逐个发话实测且行为与清单一致（见 goal/quota/mode/model/thought/compact/resume 各行）',
  'node channels/probe/scripts/native_zcode_1019.mjs list', VER + '；10-17 的 pass 被审计降为 unverified，本行补行为证据');

row('goal', 'L1a', 'zcode/L1a/zcode-acp-server', 'acp-bridge', 'pass',
  '发 “/goal <目标>” 作为一轮；bridge 驱动 GoalLoopDriver（ADR-0022）',
  '“/goal 只回复 GOAL-OK 三个字然后结束” → 循环启动，worker 一轮真跑（回复 GOAL-OK，验证步输出 VERDICT: met，82s end_turn）；落盘 .zcode/scratch/goals/sess_fcaac0ad…/state.json = {objective, status:"complete", rounds:1, tickets:[done], endedReason:"all tickets done"} + verify.txt；/goal status→“⏸ saved state … resume to continue”，/goal stop→“⏹ 已停止并清除状态”，/auto status 同机制；另有 session/goal 扩展方法（action set/pause/resume/clear）',
  'node channels/probe/scripts/native_zcode_1019.mjs slash', VER);

row('quota', 'L1a', 'zcode/L1a/zcode-acp-server', 'acp-bridge', 'pass',
  '/quota 不走模型，桥直查 GLM 用量 API',
  '“/quota” 1.9s 返回卡片：GLM Coding Plan · Lite，5h █79%、MCP 3%（search-prime 0/web-reader 0/zread 3）；account/usage_stats 方法同源返回 {glm:{kind:"success",items:[token_5h usedPercent,MCP totalCount 100]}}',
  'node channels/probe/scripts/native_zcode_1019.mjs slash；node native_zcode_1019.mjs list（usage_stats）', VER);

row('reasoning-effort', 'L1a', 'zcode/L1a/zcode-acp-server', 'acp-bridge', 'pass',
  '/thought 作为一轮 或 session/setThoughtLevel 方法',
  '“/thought high” → “✓ thought = high”，并 rememberModelChoice 跨恢复保持；档位词表来自供应商 models[].reasoning.variants（默认 GLM-5.3 low|high|max）；桌面 automation 运行记录里也见 reasoningLevel:"max" 实际生效',
  'node channels/probe/scripts/native_zcode_1019.mjs slash', VER);

row('mode-switch', 'L1a', 'zcode/L1a/zcode-acp-server', 'acp-bridge', 'pass',
  '/mode <mode> 作为一轮；session/setMode / session/set_mode（spec 拼写）方法',
  '“/mode plan”→“✓ mode = plan”，“/mode build”→“✓ mode = build”（0.3–0.8s，不跑模型）；guarded 模式切换同路（见 permission-scope 行）；模式全集 plan|build|edit|guarded|yolo',
  'node channels/probe/scripts/native_zcode_1019.mjs slash', VER);

row('model-switch', 'L1a', 'zcode/L1a/zcode-acp-server', 'acp-bridge', 'pass',
  '/model <名> 作为一轮；session/setModel / session/set_config_option 方法',
  '“/model GLM-5.3-Flash” → “✓ 模型 = GLM-5.3-Flash”（applyModelSwitch + 记忆选择 + config_option_update 广播）；支持 供应商\\模型 写法换渠道（见 channel-route 行）',
  'node channels/probe/scripts/native_zcode_1019.mjs slash', VER);

row('compact', 'L1a', 'zcode/L1a/zcode-acp-server', 'acp-bridge', 'pass',
  '/compact 作为一轮；session/compact 扩展方法',
  '“/compact” → “✓ 已压缩对话上下文”（2.6s）；/compact <focus> 可带指示',
  'node channels/probe/scripts/native_zcode_1019.mjs slash', VER + '；slash /fork、/rewind 的行为见 fork/rewind 行');

row('open-idle', 'L1a', 'zcode/L1a/zcode-acp-server', 'acp-bridge', 'pass',
  'session/new 只建不跑；后端会话是懒物化，用一次扩展方法（如 setMode）落库',
  'session/new + session/setMode(build) → 后端会话 sess_fe9c1d8b… 出现在 session/list，projection={status:"idle", turnCount:0, totalTokenCount:0, contextWindow:200000}，零轮零回复；10-17 acpx sessions new 同判（L1b pass 在案）',
  'node channels/probe/scripts/native_zcode_1019.mjs modes', VER + '；补上 L1a 直连证据，10-17 审计降级行翻回');

row('permission-scope', 'L1a', 'zcode/L1a/zcode-acp-server', 'acp-bridge', 'pass',
  'session/setMode 切 guarded 后，请它写工作区以外目录',
  'guarded 模式下写 C:\\Users\\COLORFIRE\\hub-workspaces\\probe-zc-outside-1019\\outside.txt → Write 工具卡 kind:"edit" status:"pending" 挂起，客户端收到 session/request_permission，答 allow 后放行完成，文件落地，模型回复 DONE-WITH-PERMISSION；模式分五档（plan/build/edit/guarded/yolo），工作区内按模式、区外必审',
  'node channels/probe/scripts/native_zcode_1019.mjs modes', VER + '；10-17 审计降级行（缺拦截行为证据）翻回 pass');

row('context-usage', 'L1a', 'zcode/L1a/zcode-acp-server', 'acp-bridge', 'partial',
  '扩展方法返回值与会话事件里带上下文占用',
  'setMode 返回 projection.contextUsed + projection.contextWindow=200000（turnCount/totalTokenCount 同帧）；session/update 每轮推 usage_update；db turn_usage 表逐轮存 ttft/时长/状态。未与桌面端显示对数，判 partial',
  'node channels/probe/scripts/native_zcode_1019.mjs modes', VER);

row('discover-sessions', 'L1a', 'zcode/L1a/zcode-acp-server', 'acp-bridge', 'pass',
  'session/list 方法按 cwd 列会话',
  'session/list {cwd:probe 目录} → 1 条：{sessionId:"sess_fcaac0ad…", title:"/compact"}（first_input 标题）',
  'node channels/probe/scripts/native_zcode_1019.mjs list', VER);

row('fork', 'L1a', 'zcode/L1a/zcode-acp-server', 'acp-bridge', 'partial',
  '/fork 或 session/fork，目标 latestCheckpoint',
  '无 checkpoint 的纯对话会话上发 “/fork” → JSON-RPC error "Internal error"（6ms），session/fork 直调同样 Internal error；分叉依赖工作区 checkpoint（~/.zcode/v2/checkpoints/），10-18 有 checkpoint 时 fork pass 在案（zcode/L1a/acp-bridge）；db session.task_type="fork" 16 条、tasks-index forked_from_task_id 列在案',
  'node channels/probe/scripts/native_zcode_1019.mjs slash / list', VER + '；补条件边界：无 checkpoint 报 Internal error，建议桥改成友好报错');

row('wake-timer', 'L1a', 'zcode/L1a/zcode-acp-server', 'acp-bridge', 'partial',
  '无头 ACP 桥的定时工具开关',
  '后端 Cron* 四工具由客户端经 automation/* JSON-RPC 应答实现；桥默认 --disallowed-tools "CronCreate CronList CronUpdate CronDelete"，ZCODE_ENABLE_AUTOMATION_TOOLS=1 可放开但桥自身不实现 automation/*，需宿主（我们的后端）应答——接口在，缺宿主',
  '源码 backend/resolve.js:259-269 + handlers/（无 automation 处理器）', VER + '；宿主侧行为证据见 L0 desktop 行');

row('wake-timer', 'L0', 'zcode/L0/tasks-index', 'local-store', 'pass',
  '桌面应用当宿主：tasks-index.sqlite 的 automations/automation_runs',
  'automations 表 1 条在案（“每2小时手机工作台连接与功能测试”，cron "0 */2 * * *"，带 prompt/model/provider/mode/thought_level 列）；automation_runs 843 行，最新一跑 2026-10-19T04:00Z（trigger="schedule"，dispatch_status="dispatched"，拉起会话 sess_2f9d76a9…，runtime options reasoningLevel:"max"）——到点自动拉会话是真行为',
  'sqlite3 ~/.zcode/v2/tasks-index.sqlite "SELECT … FROM automation_runs ORDER BY rowid DESC LIMIT 1"', VER);

row('memory-mode', 'L0', 'zcode/L0/settings', 'local-store', 'partial',
  '~/.zcode/v2/setting.json 的 memoryEnabled 开关',
  'setting.json 当前 memoryEnabled:false（本机关着）；记忆落盘位置 ~/.zcode/cli/memories/projects/<项目hash>/memory/*.md（历史记忆文件在案，如 env-concurrency-cron.md）；CLI 提供 --memory-bench（--prompt 时强制抽取记忆）；关→开的拨动=改全局配置，按 probe 红线未做，判 partial',
  'type ~/.zcode/v2/setting.json | grep memory；ls ~/.zcode/cli/memories/projects', VER);

row('native-meta', 'L0', 'zcode/L0/sqlite', 'local-store', 'pass',
  'db.sqlite session 表 + tasks-index.sqlite tasks 表自带元数据',
  'session.title + title_source（first_input 691 / generated 115 / custom 27）+ time_title_updated；tasks 表有 pinned/archived/deleted/title_overridden/forked_from_task_id/searchable_text 列——应用里显示的名字、置顶、归档、未读都有落盘来源',
  'sqlite3 ~/.zcode/cli/db/db.sqlite "SELECT title_source,count(*) FROM session GROUP BY 1"', VER);

row('archive', 'L0', 'zcode/L0/sqlite', 'local-store', 'partial',
  'tasks-index 的 archived 列 + setting.json 的 taskAutoArchiveEnabled',
  'tasks.archived=1 共 2 条（桌面归档真实用过）、deleted=2；session.time_archived 列（当前 0 条）；setting.json taskAutoArchiveEnabled:false（默认关，days=7）；归档/取回操作只在桌面端有入口，外部无 API，判 partial',
  'sqlite3 ~/.zcode/v2/tasks-index.sqlite "SELECT sum(archived),sum(deleted) FROM tasks"', VER);

row('delete', 'L0', 'zcode/L0/sqlite', 'local-store', 'partial',
  'tasks-index tasks.deleted 列',
  'tasks.deleted=1 共 2 条：桌面端删过会话，删除是标记位（可回收）；CLI（app-server/commands/doctor/login/logout/plugins/skills/tui）与 ACP 方法面（fork/goal/compact/cancelBackgroundTask/setThoughtLevel/setModel/setMode/set_config_option）都没有删除方法；外部删=直接改库（危险，未做），判 partial',
  'zcode --help；sqlite3 tasks-index "SELECT count(*) FROM tasks WHERE deleted=1"', VER);

row('content-search', 'L0', 'zcode/L0/sqlite', 'local-store', 'partial',
  'message/part 表 data 列 LIKE 全库扫',
  "SELECT count(DISTINCT session_id) FROM part WHERE data LIKE '%GOAL-OK%' → 2（本次探针会话命中）；'VERDICT' 命中 1901 part——按内容能搜到会话和位置；无 FTS 索引（sqlite_master 无 fts 表）、产品自己无搜索 API，只能外部直读，判 partial",
  "sqlite3 db.sqlite \"SELECT … FROM part WHERE data LIKE '%GOAL-OK%'\"", VER);

row('terminal', 'L0', 'zcode/L0/sqlite', 'local-store', 'pass',
  'tool_usage 表逐工具计数',
  'Bash 25306 / Read 4225 / Write 3689 / Edit 3331 / TodoWrite 1927 / WebFetch 671 / Agent 508 / mcp__node_repl__js 168——执行命令并取回输出是日常主路径，每次调用落 tool_usage（时长/退出码/输出字节）',
  'sqlite3 db.sqlite "SELECT tool_name,count(*) FROM tool_usage GROUP BY 1 ORDER BY 2 DESC LIMIT 8"', VER);

row('task-board', 'L0', 'zcode/L0/sqlite-todo', 'local-store', 'partial',
  'db.sqlite todo 表（模型 TodoWrite 工具的存储）',
  'todo 表 2370 行（session_id/content/status/priority/position），外部可读写；但行按 session_id 隔离，是“每会话待办”不是跨会话共享板——跨会话共享任务板在 ZCode 原生没有，判 partial',
  'sqlite3 db.sqlite "SELECT count(*) FROM todo"', VER);

row('human-steer', 'L0', 'zcode/L0/sqlite', 'local-store', 'partial',
  'session_input 表 delivery="guide"（桌面端轮中引导）',
  "session_input 2142 行：startNow 1463 / queue 675 / guide 4；guide 行是运行中会话收到的真人插话（示例：'OPPO 社招攻坚进行到哪一步了？…立即收口汇报'，status=promoted）——桌面端人在轮中插话真实在用；无头 ACP 无对应入口（steer 方法已移除）",
  'sqlite3 db.sqlite "SELECT delivery,status,count(*) FROM session_input GROUP BY 1,2"', VER);

row('spawn-subagent', 'L0', 'zcode/L0/sqlite', 'local-store', 'pass',
  '子会话 task_type 与 Agent 工具用量',
  'session.task_type: subagent_child 633 / workflow_child 17 / fork 16 / interactive 166；parent_id 非空 667；tool_usage 里 Agent 工具 508 次——子智能体是一等会话（有独立行、可查、结果回父会话）',
  'sqlite3 db.sqlite "SELECT task_type,count(*) FROM session GROUP BY 1"', VER + '；落盘位置：cli/rollout/model-io-<sess>.jsonl + cli/agents/<sess>/ + db 三处');

fs.appendFileSync(BB, rows.map((r) => JSON.stringify(r)).join('\n') + '\n', 'utf8');
console.log('appended', rows.length, 'rows');
