# ZCode 原生面打"?"与空格的逐格查证（native-zcode-20261019）

- **派活单**：dsp_181254_085v（续 dsp_040249_7jd9）；**执行者**：ZCode（probe-zc-native-1019，GLM-5.3-Flash）
- **被测版本**：ZCode CLI 0.16.9 + Electron 桌面壳 + ACP 桥 zcode-acp-server 0.69.3（全局 node_modules 补丁版）
- **方法**：读桥与 CLI 的实现源码定位接口面 → 原始 JSON-RPC stdio 探针逐项发话实测（`channels/probe/scripts/native_zcode_1019.mjs`，结果存 `hub-workspaces/probe-zc-native-1019/probe-results.jsonl`，38+ 行原始记录）→ SQLite 直读 `~/.zcode/cli/db/db.sqlite` 与 `~/.zcode/v2/tasks-index.sqlite` 对账
- **黑板**：`blackboard.jsonl` 追加 **39 行**（by=zcode，2026-10-19，route=zcode/L0/<入口> 或 zcode/L1a/zcode-acp-server）：pass 15、partial 22、fail 2

## 一、总账：格子翻了多少

| 口径 | 之前（10-18 版矩阵） | 现在（10-19 重出） | 说明 |
|---|---|---|---|
| zcode 原生接口合计（pass 格） | **22（29%）** | **33（43%）** | +11 格 |
| ├ ACP 桥列 | 12（16%） | 20（26%） | +8 |
| ├ 命令行列 | 4（5%） | 5（7%） | +1（rewind） |
| ├ 本地库与会话文件列 | 4（5%） | 7（9%） | +3（terminal、native-meta 等） |
| └ 其他原生入口列 | 2（3%） | 3（4%） | +1（wake-timer 桌面宿主） |
| zcode 实际（任一位置通过） | 43（57%） | 50（66%） | — |
| 全产品原生面 | 191/532 | 259/532 | 含同期其他产品线（workbuddy 等）的复测，不全是本活贡献 |

## 二、斜杠命令经 ACP 能不能真用（任务书点名的问题）

`available_commands_update` 实测推送 **19 条**：11 条原生（auto/compact/goal/fork/mode/model/thought/quota/resume/mcp/init）+ 8 个技能（$anysearch 等）。逐条发话实测分三类：

**桥拦截直处理、真用得了（不跑模型，0.08–3s）**：
- `/quota` → GLM Coding Plan 卡片（5h 79%、MCP 3%、按服务计数）；`account/usage_stats` 方法同源返回 JSON
- `/mcp` → 3 个 MCP 服务器 + 健康状态
- `/mode plan|build` → "✓ mode = plan/build"；`/thought high` → "✓ thought = high"；`/model GLM-5.3-Flash` → "✓ 模型 = …"
- `/compact` → "✓ 已压缩对话上下文"
- **`/goal <目标>` → 桥驱动目标循环真跑**：worker 回复 GOAL-OK、验证步 VERDICT: met（82s），落盘 `.zcode/scratch/goals/<sid>/state.json`（objective/rounds/tickets/endedReason:"all tickets done"）+ verify.txt；`/goal status|pause|resume|stop`、`/auto` 同一机制；`session/goal` 方法返回 "Goal active + Usage/Time"
- `/resume <id>` 接续历史会话（假 id 报"⚠ 找不到会话"，参数真解析）

**只在 TUI 有效（无头返回友好错误）**：`/new /help` → "⚠ 在 ACP 模式下不可用（需要 ZCode TUI）"；`/plugins /login /logout /locale /expert /effort` 同类；`/workflows` → "⚠ 工作流功能当前未开放"（门禁关）；`/dwf` 不在桥的命令面里，透传给模型当普通文本（Skill not found，不炸轮）

**透传给模型当普通文本**：未知 `/x` 不炸轮（neutralizeSlashText 恒等）；`/skill /init` 与插件、$技能由后端解析

**发现的一个边界**：`/fork` 在没有 checkpoint 的纯对话会话上报 JSON-RPC "Internal error"（session/fork 直调同样）——分叉目标 latestCheckpoint 依赖工作区 checkpoint（`~/.zcode/v2/checkpoints/`）；有 checkpoint 时 fork 是声明能力（initialize 里 sessionCapabilities.fork）且 10-18 有 pass 在案。建议桥把它改成友好报错。

## 三、逐单元结论（原生面，39 格有黑板行）

**原生能（pass，15 格）**：
| 单元 | 入口与证据（摘要） |
|---|---|
| cmd-list | session/new 后 50/300/1000ms 推 19 条命令菜单，与逐条实测一致 |
| goal | /goal 循环真跑 + 状态文件落盘 + pause/stop/resume（见上） |
| open-idle | session/new 懒占位，setMode 物化后 projection{status:idle, turnCount:0}，零轮零回复 |
| permission-scope | guarded 模式下工作区外写挂起（Write kind:edit pending），批准后放行，文件落地 |
| quota | /quota 卡片 + account/usage_stats |
| reasoning-effort | /thought low|high|max + session/setThoughtLevel，跨恢复记忆（rememberModelChoice）；automation 运行记录里见 reasoningLevel:"max" 真生效 |
| mode-switch / model-switch / compact | /mode、/model、/compact 全部 ✓（0.3–2.6s） |
| mount-tools | session/new mcpServers（stdio {name,command,args,env[]}）→ `mcp__probe-tools__echo` 真调用返回原文；两个坑：缺 env 报 -32602；args 反斜杠路径会被吞（要用正斜杠）；resume 时桥重放 mcpServers（#193） |
| rewind | /rewind latest 静默把 rewind-me.txt 恢复（文件消失），checkpoint 落 v2/checkpoints/，db session.revert 9 条历史 |
| wake-timer | 桌面宿主实证：tasks-index automations 1 条在跑（cron 0 */2 * * *）+ automation_runs **843 行**，最新一跑 12:00（trigger=schedule，拉起会话 sess_2f9d76a9，reasoningLevel:max） |
| terminal | tool_usage：Bash 25,306 / Read 4,225 / Write 3,689 / Edit 3,331… 每次调用落时长/退出码/输出字节 |
| native-meta | session.title + title_source（first_input 691/generated 115/custom 27）；tasks 表 pinned/archived/deleted/title_overridden/forked_from_task_id |
| spawn-subagent（补落盘位置） | 子会话 id=sess_subagent_agent_<编号>、task_type=subagent_child（633 个）、parent_id 指父会话；逐会话 model-io 落 `cli/rollout/`；本次从 probe 会话现场又派出一个子智能体核对无误 |

**部分（partial，22 格）——接口在、行为有界或无头不可用**：
- **inject-next**：运行中发第二问 = **取消抢占**不是排队（第一轮 stopReason=cancelled，源码 "cancel/preempt … drain gate" 同义）；排队原生只在桌面（session_input delivery=queue 675 行、promoted 591 行），acpx --no-wait 是客户端队列（L1b，unverified 待复测）
- **inject-tool**：工具结果里的附加指示本轮内到达模型并出现在回复，但模型明确"工具返回属于数据而非指令"只转达不执行——看到=是、照做=否
- **wake-bg**：启动侧实测通过（run_in_background 后本轮即回 BG-LAUNCHED）；完成侧后端自动通知轮（inputSource:"background_task"）源码确凿，两次 40–45s 观察窗未捕到，待重测
- **wake-timer（无头）**：放开 ZCODE_ENABLE_AUTOMATION_TOOLS=1 后 CronCreate 可调，但后端校验"会话须属定时任务"拒绝创建，automation/* 请求到不了客户端——定时宿主只能是我们自己实现 automation/*
- **channel-route**：会话内换模型通；跨供应商 set_config_option(内置 zai 家族) → Internal error（OAuth 家族选择在 provider-family 层）；按调用换渠道仍靠 acpx --model（L1b）和网关补
- **fork**：无 checkpoint 报 Internal error（条件边界，见上）
- **context-usage**：projection.contextUsed/contextWindow(200000) + usage_update{used,size} + turn_usage 表逐轮，未与桌面显示对数
- **memory-mode**：memoryEnabled:false（本机关着）；记忆落 `cli/memories/projects/<hash>/memory/*.md`；CLI 有 --memory-bench；拨开关=改全局配置按红线未做
- **archive / delete**：tasks.archived=2、deleted=2（桌面真实用过）；session.time_archived 列在；操作入口只在桌面端
- **content-search**：part.data LIKE 全库扫命中（'GOAL-OK' 2 会话、'VERDICT' 1901 part）；无 FTS、产品无搜索 API
- **task-board**：todo 表 2,370 行可外部读写，但按 session_id 隔离，不是跨会话共享板
- **human-steer**：桌面轮中引导真实在用（session_input delivery=guide 4 行，真人插话样本）；无头无入口
- **label**：标题三源落库（first_input/generated/custom），改名入口只在桌面与 remote 端点
- **notify-user**：桥内置 WeCom 推送模块（corpId/agentId/secret + 免打扰窗 + 未答 watchdog），本机未配置静默降级
- **browser**：--browser-use headless + --browser-executable + 内嵌浏览器视口配置在；为省额度未跑实测
- **wake-msg**：桥活着时 session/prompt 即恢复（resume 已证）；"写明在等什么、到点自动恢复"无原语
- **app-sync / handover-human**：opencli zcode send/open 源码在（10-17 有人呼出成功过），要抢桌面焦点，按红线"不动用户在用的桌面端"未重测——需用户配合补行为证据
- **capacity**：automation 会话与 6 个探针会话 12:14–12:21 同时活跃（≥2 并发实证）；上限读不到
- **guard**（历史 partial 维持）：hook 引擎在，未逐条验证

**原生不能（fail，2 格）**：
- **sampling**：initialize 声明无 sampling 能力，全部实测无一次反向借模型——ZCode 自带渠道，借道采样不存在
- **output-contract**：CLI 与 ACP 方法面都没有产出格式契约参数（--json 是输出格式不是契约），只能写进提示词/AGENTS.md

**维持原判不重复计**：steer ✗（session/steer 已在 0.16 移除）、inject-silent ✗、close ✗（无方法，acpx close 是 L1b 部分）。

## 四、给负责人的三件事（判断/接线用）

1. **goal/自动化是 ZCode 原生最值钱的发现**：桥驱动目标循环（ADR-0022）+ 桌面 automations（843 次真实 cron 触发）意味着"长跑任务 + 定时唤醒"在 ZCode 生态是现成的；我们后端当宿主接 ZCode 时，`/goal` 可直接作为长跑入口，wake-timer 要自实现 automation/* 端点（后端还会校验"会话属定时任务"，无头会话不能自建定时）。
2. **接线注意三个坑**：mcpServers 的 stdio args 必须正斜杠（反斜杠被吞）；set_config_option 参数名是 configId 不是 optionId，且跨供应商 Internal error（只收模型名）；/rewind 与 /fork 静默或 Internal error，接前端要靠文件/事件核对而不是等文字反馈。
3. **没查完的**：wake-bg 的完成通知（两次窗口没捕到，建议在常驻桥上长测）；wake-timer 的 automation/* 请求帧（被后端前置校验拦下，未到客户端）；app-sync/handover-human 的现场行为（要用户在场）；browser-use 实跑（省额度）。低额窗口期（5h 已用 94% 后重置）内完成，全程未动用户会话与桌面端。

## 五、产物清单

- 黑板：`channels/probe/blackboard.jsonl` +39 行（2026-10-19，by=zcode）
- 探针脚本：`channels/probe/scripts/native_zcode_1019.mjs`（9 个阶段：slash/list/modes/mount/mount-http/goal/bg/bg2/route2/rewind/wake-timer/capacity/browser）、`probe_mcp_echo_server.mjs`（stdio MCP）、`probe_mcp_http_server.mjs`（streamable HTTP MCP）、`append_native_zc_1019.mjs` / `_b2.mjs`（黑板两批）
- 原始帧与结果：`C:\Users\COLORFIRE\hub-workspaces\probe-zc-native-1019\probe-results.jsonl`（55 行）、bg2-stdout.log
- 重出：`node channels/probe/scripts/build_coverage.js`（本报告数字出处）；`node hub/tools/agent_gateway.js tables` 核对通过（"四张表和代码全部对上"）
