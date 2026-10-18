# L3 控件清单 · zcode-glm-L3（2026-10-17）

范围：`/console/`（console/index.html + console.js）与首页对话抽屉（hub/js/obs/chat.js + hub/js/obs/sessions.js，挂在 index.html:108/109，由 trace.js `renderHeader` 渲染会话头）。
接口一律打到统一服务 `:8899`（server.ts）；下层路线：6 家走 `acpx`（`<家>/L1b/acpx`），antigravity 走 `language_server.exe agentapi + Connect-RPC`（`antigravity/L0/agentapi+connect-rpc`）；只读列表走被动解析旁路（`adapters/<家>/`，不经 L1）。
verdict 四档：接通 / 没接上 / 假闭环 / 接错路。〔实测〕= 本次在 :8933 用与前端相同的请求体验证过（证据见 `zcode-glm-L3.md` 与 `scripts/tmp/zcode-glm-L3-live2.log`）。

## 表 1 · /console/（console.js）

| 区域 | 文字 | id/选择器 | 处理函数（文件:行） | 接口（方法+路径+关键参数） | calls | verdict | 重复的同类控件 |
|---|---|---|---|---|---|---|---|
| 顶栏 | 收起/展开左栏 | `#nxLeftToggle` | console.js:2465 | 无（本地折叠） | 本地 | 真动作(本地) | Ctrl+B 快捷键同功能 |
| 顶栏 | 🌌架构拓扑 Hub | `#nxHubLink` | console.js:645 updateModeLinks | 导航 `../[#session=]` | 本地 | 真动作(导航) | — |
| 顶栏 | 实况对话台/协作看板/护航总管 三个 Tab | `.nx-view-tab[data-view]` | console.js:2040 switchView（点击绑定 2218） | 无（本地渲染，数据来自 state） | 本地 | 真动作(本地) | 命令面板 view:* 同功能 |
| 顶栏 | 连接状态胶囊 | `#nxConnPill` | console.js:655 renderTopStatus | 只读显示 | — | 纯显示 | — |
| 顶栏 | 快速指令… (Ctrl+K) | `#nxCmdBtn` | console.js:2060 openCommandPalette | 无（本地面板） | 本地 | 真动作(本地) | — |
| 顶栏 | ☀ 主题 / 右栏折叠 | `#nxThemeBtn` `#nxRightToggle` | console.js:2478/2471 | 无 | 本地 | 真动作(本地) | — |
| 实况条 | ⚠️待审批药丸 | `[data-jump-session]` | **无任何 click 处理**（渲染在 console.js:714，bindEvents 2213-2431 无此分支） | 无 | 无 | **假闭环（死按钮）** | 审批横幅（可用的审批入口） |
| 实况条 | 运行中药丸 | `[data-jump-run]` | **无任何 click 处理**（渲染在 console.js:724） | 无 | 无 | **假闭环（死按钮）** | 对话头中止运行 |
| 命令面板 | +新建会话 / 巡检 / 切视图 / 主题 / sess:* | `[data-cmd-pick]` | console.js:2340-2357 | 同对应控件：session/new、meta-agents/patrol 等 | 同左 | 同对应控件 | 与各原控件全部重复 |
| 左栏 | 渠道胶囊 ×7+全部 | `[data-ch-filter]` | console.js:2235 | 无（本地过滤；胶囊上🔴⚠️健康灯只读） | 本地 | 真动作(本地) | 输入栏渠道下拉 `#nxCtlChannel`（语义还不同：这个是过滤、那个是发送目标） |
| 左栏 | ＋新建会话 | `#nxNewSessionBtn` | console.js:1589 createNewSessionPrompt | POST `/api/gateway/session/new` {channel,sessionName,cwd,model} | gateway.createNewSession(gateway.ts:2203)：**只写内存 draftSessions，不落 acpx** | **假闭环〔轻〕〔实测〕**：toast「已创建」，实际首轮 send 才建会话（实测 :8933 前后 acpx 文件 58→58，首轮 send 后才出现记录） | 空态新建、项目＋、看板新建、命令面板、/new —— console 共 6 处 |
| 左栏 | 会话筛选框 | `#nxSessionFilter` | console.js:2501 | 无 | 本地 | 真动作(本地) | 档案搜索 |
| 左栏 | 会话行 | `.nx-sess-row[data-sess-id]` | console.js:965 selectSession | GET `/api/sessions/<id>?compact=1&tail=15`（+IndexedDB 缓存） | 只读旁路 adapters | 接通 | 档案行、看板卡片、命令面板 sess:* |
| 左栏 | 项目折叠 / 项目＋ | `[data-proj-toggle]` `[data-proj-new]` | console.js:2256/2249 | 折叠本地；＋→POST session/new | 同新建 | 折叠本地；＋同上 | 同新建 |
| 左栏 | 📂历史档案库 | `#nxArchiveToggle` `#nxArchiveSearch` | console.js:918 loadArchiveSessions | GET `/api/sessions?limit=40&q=` | 只读旁路 | 接通 | — |
| 对话头 | ⏹中止运行 | `[data-act=cancel-run]` | console.js:2375 | POST `/api/gateway/cancel` {channel,sessionName} | acpx cancel（gateway.ts:3557 spawnSync）/ AGY Connect-RPC CancelCascadeInvocation（3531-3551） | **接通〔实测 T4〕**（run aborted、底层停、会话可续） | 输入栏「中断并立即发送」、实况条死药丸 |
| 对话头 | 🔄断点续跑 | `[data-act=resume-session]` | console.js:2389 → sendPromptNow('请直接从刚才中断…') | POST `/api/gateway/send`（固定提示词，重发上一任务） | `<家>/L1b/acpx`（-s 槽位续接） | 半真：**acpx 槽位接通〔实测 T1b 暗号复述〕；点开的原生会话（trace 里的 `codex:<uuid>` 等）解析不到 acpx 记录 → 落到 `hub-<ch>` 空槽，假续** | /resume 快捷词（同函数）；chat 抽屉走另一接口 /api/gateway/resume |
| 对话头 | ⇄跨渠道接力 | `[data-act=open-handoff]` | console.js:2397 | 无（打开右抽屉） | 本地 | 真动作(本地) | @提及直接发、/handoff、右抽屉执行钮 |
| 审批横幅 | ✓批准 / ✕拒绝 | `[data-approve-id]` | console.js:2294 | POST `/api/gateway/approve` {id,decision} | gateway.resolveApproval(gateway.ts:3195)：拒绝=标记；**批准=把提示词重发一遍并带 --approve-all**（3226-3241）。审批项来源=**轮次结束后**对输出做正则 `/(permission\|denied\|…\|拒绝执行)/i`（finalizeRun 3960-3987） | **假闭环〔实测 T5〕**：不是轮中挂起审批；且默认配置下 meta_approver 把权限静默升级为 all（3414-3426），横幅根本不会出现 | 看板「待审批」卡片的批准/拒绝；chat 抽屉审批横幅 |
| 消息流 | ↑加载更早 15 轮 | `[data-act=load-older]` | console.js:2368 | GET `/api/sessions/<id>?before=N&limit=15` | 只读旁路 | 接通 | — |
| 消息流 | 轨迹/步骤折叠 | `[data-trace-toggle]` `[data-step-toggle]` | console.js:2278/2286 | 无 | 本地 | 真动作(本地) | — |
| 消息流 | 切换至默认推荐模型并重试 | `[data-act=retry-default-model]` | console.js:2391 → sendPromptNow(原文) | POST `/api/gateway/send`（body.model=defaultModel） | acpx --model | 间接（同发送；模型生效程度见表 2 模型下拉） | chat「用可用模型重试本轮」 |
| 队列条 | 撤回编辑 | `[data-queue-recall]` | console.js:2310 | POST `/api/gateway/cancel` {channel,sessionName,queuedId} | gateway.cancelRun(queuedId)：从**内存队列**移除（3518-3523） | 接通（队列是本进程内存，重启即失） | chat「立即插队」（语义不同） |
| 输入栏 | 渠道下拉 | `#nxCtlChannel` | console.js:2437（渲染 1315） | 无（本地；切换后重置默认模型，作为 send.channel） | 本地 | 真动作(本地) | 左栏渠道胶囊（**语义不一致**：胶囊=过滤器，下拉=发送目标） |
| 输入栏 | 模型下拉 | `#nxCtlModel`（显示条件 `(midSwitch‖onNew)&&models>1`，console.js:1320） | console.js:2443（渲染 1325） | 无独立接口；存 S.composer.model，随 send.body.model 下发 → 每轮 `acpx … --model`（gateway.ts:4190/4222） | `<家>/L1b/acpx` | **分家判定见表 2**；zcode〔实测 T2〕配置级接通、下一轮实际模型无 L0 证据 | chat 抽屉两处模型下拉（头+composer） |
| 输入栏 | 权限下拉（approve-all/approve-reads/deny-all） | `#nxCtlPerm`（显示条件 caps.canSetPermissionMode，console.js:1332） | console.js:2445（渲染 1334） | send 时作为 **`permissionMode`** 字段发出（console.js:1551-1558）；服务端只读 **`permissions`**（server.ts:226-231）→ **字段被整个忽略，恒为 all → `--approve-all`** | `<家>/L1b/acpx` | **假闭环〔实测 T5b〕：deny-all 下写文件照样创建**。对显示它的 4 家（codex/claude/workbuddy/opencode）全部无效 | chat 权限按钮（那个是真通的，走停用督导） |
| 输入栏 | CWD 下拉 | `#nxCtlCwd` | console.js:2447（渲染 1342） | 随 send.body.cwd 下发（sendPrompt 校验目录存在，gateway.ts:3410） | `<家>/L1b/acpx`（spawn cwd） | 接通 | chat 会话头 CWD 下拉（走 /api/gateway/cwd） |
| 输入栏 | @ 提及接力 | `[data-act=insert-mention]` + 发送时正则 `^@ch` | console.js:2411/1527 → executeCrossChannelHandoff 1632 | POST `/api/gateway/handoff` {fromChannel,fromSessionName,fromTraceId,toChannel,toModel,toSessionName,customInstruction} | gateway.handoffSession(3252)：取最近 3 轮、输入截 260 字/输出截 320 字摘要，发往目标渠道新槽位 | 接通〔代码路径闭环〕；UI 语「无缝移交/上下文打包」夸大（只有 3 轮截断摘要） | 对话头开抽屉、/handoff、右抽屉执行钮 |
| 输入栏 | / 快捷指令菜单 | `[data-act=insert-slash]` + SLASH_COMMANDS(console.js:63) | console.js:2418/1459 applyAcItem | /handoff→开抽屉；/patrol→POST meta-agents/patrol；/resume→POST send 固定提示词；/new→POST session/new；/board /supervisor→本地 | 同各控件 | 同各控件 | 与原控件全部重复 |
| 输入栏 | ⚡中断并立即发送 | `[data-act=interrupt-send]` | console.js:2365 → sendPromptNow(null,true) 1576 | 先 POST `/api/gateway/cancel`，250ms 后 POST `/api/gateway/send` | acpx cancel + acpx prompt | 接通 | chat「中断并插队」（同一两步，文案不同） |
| 输入栏 | 🚀发送指令 / ⏳加入排队 | `[data-act=send-prompt]` | console.js:2364 → sendPromptNow 1505 | POST `/api/gateway/send` {channel,sessionName,prompt,cwd,model,permissionMode✗} | 6 家 `<家>/L1b/acpx`（ensure+prompt，gateway.ts:4184-4238）；AGY `antigravity/L0/agentapi`（3647-3651） | **接通〔实测 T1〕** | chat 发送按钮（字段正确版） |
| 右抽屉 | ⇄/🔧/📊 三个 Tab | `.nx-sr-tab` | console.js:2224 | 无 | 本地 | 真动作(本地) | — |
| 右抽屉 | 目标渠道/模型/指令 + 🚀立即接力 | `#nxHandoffCh` `#nxHandoffModel` `#nxHandoffPrompt` `[data-act=exec-handoff]` | console.js:2402 → executeCrossChannelHandoff | POST `/api/gateway/handoff`（toModel 不在 recommendedModels 时被静默换回，gateway.ts:3311-3314） | 同接力 | 接通（同上，摘要级） | @提及、对话头、/handoff |
| 右抽屉 | 工具与变更 / 遥测与CLI | （渲染） | console.js:1994/2022 | 无 | 本地 | 纯显示 | — |
| 看板 | ↻刷新状态 / ＋新建任务会话 | `[data-act=refresh-all]` `[data-act=new-session]` | console.js:2367/2366 | GET state+sessions；POST session/new | 只读旁路；内存 draft | 接通 / 假闭环(轻)同新建 | 新建共 6 处 |
| 看板 | 卡片点击 | `[data-board-open]` | console.js:2271 | GET `/api/sessions/<id>` | 只读旁路 | 接通 | 会话行 |
| 看板 | 待审批卡片 批准/拒绝 | `[data-approve-id]` | console.js:2294 | 同审批横幅 | 同上 | 同上（假闭环） | 审批横幅、chat 横幅 |
| 护航 | ↻刷新指标 / ⚡立即唤醒总管巡检 | `[data-act=refresh-all]` `[data-act=sup-patrol]` | console.js:2367/2425 → triggerSupervisorPatrol 1898 | POST `/api/gateway/meta-agents/patrol` {agentId:'meta_maint'(写死),eventKind:'manual_patrol',targetChannel,targetSession} | gateway.invokeMetaBrainForIncident(1027)：真实拉起大脑渠道会话发巡检 prompt | 接通（花一次真实模型调用） | /patrol、命令面板、chat「唤醒巡检」、sessions.js「巡检」 |
| 护航 | 总管渠道/模型/周期 + 💾同步配置 | `#nxSupChannel` `#nxSupModel` `#nxSupInterval` `[data-act=sup-save]` | console.js:2427 → saveSupervisorConfig 1921 | POST `/api/gateway/meta-agents` {id:'meta_resumer',applyToAll:true,brainChannel,brainModel,patrolIntervalSec} | gateway.updateMetaAgent(772)；周期被巡检定时器消费（gateway.ts:903/916） | 接通（内存配置；重启即失） | chat 元智能体 pills（同接口） |

## 表 2 · 首页对话抽屉（chat.js + sessions.js + trace.js 会话头）

| 区域 | 文字 | id/选择器 | 处理函数（文件:行） | 接口 | calls | verdict | 重复的同类控件 |
|---|---|---|---|---|---|---|---|
| 会话头(trace.js:427) | 模型下拉（canSwitch 才渲染，否则静态 pill） | `[data-trace-hdr-model]`（trace.js:468） | trace.js:282 → chat.switchModel（chat.js:390） | POST `/api/gateway/model` {channel,sessionName,traceSessionId,model} | gateway.setSessionModel(2970)：改内存 + 改写 `~/.acpx/sessions/*.json` current_model_id + fire `acpx <agent> set-model`（3036-3057）；AGY 跳过 acpx 只改内存 | **分家判定见下表 3**；zcode〔实测 T2〕：JSON 已改、下轮 --model 已传，「下一轮实际模型」无 L0 证据 → 配置级部分通 | composer `[data-cr-model-select]`（同函数，纯重复） |
| 会话头 | CWD 下拉（含 ✎自定义路径） | `[data-trace-hdr-cwd]`（trace.js:488） | trace.js:293 → chat.switchCwd（chat.js:474） | POST `/api/gateway/cwd` {channel,sessionName,cwd} | gateway.setSessionCwd(2900)：改内存 + 改写 acpx record cwd（2943-2956）；下轮 spawn 生效 | 接通（代码闭环；console 侧经 send.body.cwd 同效） | console `#nxCtlCwd` |
| 会话头 | +新会话 / ↻刷新 / ☍协作图 / ↗独立查看器 / 视图模式×3 | `[data-trace-act=…]`（trace.js:517-525） | trace.js → startNewSession / GET tree / 链接 / 本地 | POST session/new；GET `/api/sessions/<id>/tree` | 同左 | 刷新/协作图/查看器接通；新会话=假闭环(轻)同表1 | 新会话在抽屉内共 3 处（头、composer、sessions 卡） |
| composer | 7 渠道 pills | `.cr-ch-pill[data-act=select-ch]`（chat.js:1610） | chat.js:2059 → openChannelControlRoom(2218) | 无（本地 focus；无历史会话时自动 startNewSession→POST session/new） | 本地/内存 draft | 真动作(本地) | sessions.js 渠道启动卡（同一函数，纯重复） |
| composer | 模型下拉 | `[data-cr-model-select]`（chat.js:1646） | chat.js:2161 → switchModel | 同会话头模型下拉 | 同上 | 同上（**同一功能第 2 处**） | 会话头下拉 |
| composer | 会话槽下拉 | `[data-cr-sess-select]`（chat.js:1802） | chat.js:2173 | 无（本地 focus 切换） | 本地 | 真动作(本地) | — |
| composer | +新会话 | `[data-act=new-sess]`（chat.js:1804） | chat.js:2088 → startNewSession(1836) | POST `/api/gateway/session/new` | 内存 draft | 假闭环(轻) | 抽屉内共 3 处 + console 6 处 |
| composer | ⚡自动读写/🛡️只读安全 切换 | `[data-act=toggle-perm]`（chat.js:1806，仅 canSetPermissionMode 的 codex/claude/workbuddy/opencode 渲染） | chat.js:2084 → toggleMetaAgent('meta_approver') | POST `/api/gateway/meta-agents` {id,enabled,policy} + 本地 state.permissions；send 时 body.permissions 正确（chat.js:1979） | gateway.sendPrompt(3413-3426) → `--approve-all/--approve-reads/--deny-all` 静态启动旗标（4176-4181） | **接通（借「停用自动批准督导」实现）**；注意直接 API 带 permissions:'reads' 而督导开启时会被静默升级回 all〔实测 T5a：reads 却 CREATED〕；zcode/hermes/AGY 正确隐藏 | console 权限下拉（那个字段名错、全无效） |
| 元智能体条 | 🧠大脑 pill / 👁️脑会话 / ⚙换脑日志 | `[data-act=open-meta-drawer]` `[data-act=open-meta-brain]`（chat.js:1698/1710） | chat.js:2079/2070 → openMetaBrainSession(690) | 无/本地 focus `meta-brain-supervisor` | 本地 | 真动作(本地) | sessions.js 同款两枚 |
| 元智能体条 | 🔄检测到中断·立即续跑 | `[data-act=gw-resume]`（chat.js:1705） | chat.js:2073 → resumeSession(712) | POST `/api/gateway/resume` {channel,sessionName,traceSessionId,reason} | gateway.resumeInterruptedSession(3102)：读最后一轮组「断点提示词」→ sendPrompt | 半真：acpx 槽位接通；原生会话→`hub-<ch>` 空槽假续（同 console 断点续跑） | console「断点续跑」（**同目的两套实现两个接口**） |
| 元智能体条 | 🚨巡检发现异常·一键接管 | `[data-act=gw-takeover-anomaly]`（chat.js:1692） | chat.js:2125 → focus + resumeSession | 同上 | 同上 | 同上 | — |
| 元智能体条 | ↗转交其他 Agent 接力 下拉 | `[data-cr-handoff-select]`（chat.js:1708） | chat.js:2151 → handoffSession(747) | POST `/api/gateway/handoff` {…,wait:false} | 同接力（3 轮摘要） | 接通（摘要级） | console 接力 4 处 |
| 元智能体条 | 🧠唤醒巡检 | `[data-act=meta-patrol]`（chat.js:1709） | chat.js:2067 → triggerMetaPatrolNow(646) | POST `/api/gateway/meta-agents/patrol` | 真实拉大脑会话 | 接通 | sessions.js「巡检」、console 3 处 |
| 元智能体条 | 4×元智能体 ON/OFF pills | `[data-act=toggle-meta]`（chat.js:1668） | chat.js:2063 → toggleMetaAgent(575) | POST `/api/gateway/meta-agents` {id,enabled} | updateMetaAgent；被 sendPrompt(3414)/巡检定时器(903) 消费 | 接通 | 护航页配置（同接口） |
| composer | 快捷词 ×4（自报家门/总结/诊断/梳理） | `[data-act=quick-prompt]`（chat.js:1774） | chat.js:2091 | 无（填充输入框） | 本地 | 真动作(本地) | — |
| composer | 输入框 + 🚀发送指令 | `[data-cr-input]` `[data-act=gw-send data-mode=send]`（chat.js:1784） | chat.js:2106 → submitPrompt(1927) | POST `/api/gateway/send` {channel,sessionName,traceSessionId,model,cwd,prompt,**permissions**,mode,source:'web'} | 6 家 acpx ensure+prompt；AGY agentapi（new-conversation 带 `--model=tier`，3647-3651） | **接通〔实测 T1/T3〕**（字段比 console 多且正确） | console 发送（permissionMode 字段错） |
| composer | 📥排队下一轮（运行中） | `[data-act=gw-send data-mode=queue]`（chat.js:1781） | chat.js:2106 | POST send {mode:'queue'} | gateway 内存队列（3442-3464） | 接通（内存队列） | console「加入排队」 |
| composer | ⚡中断并插队（运行中） | `[data-act=gw-send data-mode=interrupt]`（chat.js:1782） | chat.js:2106 | POST send {mode:'interrupt'} | sendPrompt:3439 → cancelRun + 新轮 | 接通（真动作）；**文案「插队/插话」名不副实：是打断+重发，不是轮内插话**（ACP 无轮内插话，MATRIX zcode L1a 行 97） | 排队条「立即插队」、console「中断并立即发送」 |
| composer | ⏹停止 | `[data-act=gw-cancel]`（chat.js:1783） | chat.js:2113 | POST `/api/gateway/cancel` | acpx cancel / AGY Connect-RPC | **接通〔实测 T4〕** | 实况条 ⏹、实况轮「紧急停止」（chat.js:1417，共 3 处） |
| 实况条 | 运行药丸 跳转 / ⏹ | `[data-act=gw-focus-run]` / `[data-act=gw-cancel]`（chat.js:1731/1736） | chat.js:2125/2113 | 无 / POST cancel | 本地 / 同上 | 跳接通；⏹接通（重复第 2 处） | — |
| 实况轮 | ⏹紧急停止 | `.cr-stop-mini[data-act=gw-cancel]`（chat.js:1417） | 同上 | 同上 | 同上 | 接通（重复第 3 处） | — |
| 审批横幅 | ⚡批准并续跑 / ✕驳回 | `[data-act=gw-approve-decision]`（chat.js:1752） | chat.js:2142 → resolveApprovalDecision(797) | POST `/api/gateway/approve` {id,decision} | resolveApproval(3195)：批准=重发提示词 --approve-all | **假闭环**（同 console：事后正则产生、批准=新轮重发；默认配置下不可达） | console 横幅+看板卡片 |
| 排队条 | ⚡立即插队 | `[data-act=gw-promote-interrupt]`（chat.js:1767） | chat.js:2109 → submitPrompt('interrupt') | POST send {mode:'interrupt'} | cancel+新轮 | 同「中断并插队」（名为插队，实为打断重发） | composer 中断并插队 |
| 消息流 | 失败轮 🔄用可用模型重试本轮 | `[data-act=retry-turn-prompt]`（chat.js:1350） | chat.js:2097 → submitPrompt('send') | POST send | 同发送 | 间接真动作 | console 重试钮 |
| 消息流 | 窗口/折叠/子会话跳转/选中定位 等 | `load-more-turns` `load-all-turns` `toggle-*` `open-child-session` `select-span`（chat.js:2011-2057） | chat.js 各分支 | GET 会话（经 obsTrace） | 只读旁路 | 接通/本地 | — |
| sessions.js 左栏 | 7 渠道启动卡 | `.ob-cr-btn[data-act=open-ch]`（sessions.js:241） | sessions.js:121 → openChannelControlRoom | 无（本地）/必要时 POST session/new | 同上 | 真动作(本地) | composer 渠道 pills（同一函数） |
| sessions.js 左栏 | ＋新会话 | `[data-act=new-cr-sess]`（sessions.js:236） | sessions.js:128 → startNewSession | POST session/new | 内存 draft | 假闭环(轻) | 抽屉第 3 处 |
| sessions.js 左栏 | 🧠巡检 / 👁️脑会话 / ⚙换脑 | `[data-act=meta-patrol]` `[data-act=meta-brain-sess]` `[data-act=meta-config]`（sessions.js:264-266） | sessions.js:140/154/147 → chat 同名函数 | POST patrol / 本地 | 同上 | 接通 / 本地 | chat 元智能体条同款（重复） |
| sessions.js 左栏 | 会话行 / 错误pill / 子智能体 / ☍画成协作图 | `[data-act=open/err/kids/tree]`（sessions.js:113-170） | sessions.js 各分支 / openTree(40) | GET `/api/sessions`、GET `/api/sessions/<id>/tree`；Ctrl 点→/trace/ | 只读旁路 | 接通 | console 会话行 |
| sessions.js 左栏 | 档案折叠/状态筛选/搜索/页内检索/more/reload + 3 个 /trace/ 外链 | `toggle-archive` `filter` `[data-sess-q]` `inpage-search` `more` `reload` | sessions.js:135-173 | GET `/api/sessions`（15s 缓存）/本地 | 只读旁路 | 接通 | console 档案箱 |

## 表 3 · 「模型下拉」与「权限控件」分家判定（对做不到的渠道是否也显示）

能力真值取自 `probe/MATRIX.md`（下层实测行号）；显示真值来自两套前端的 gating 条件与 gateway.ts:81-271 渠道 Profile。

| 家 | 下层能否切模型（L1b/acpx 或 agentapi） | console 模型下拉 | chat 模型下拉（现有会话） | 判定 |
|---|---|---|---|---|
| codex | ✅ 677 | 显示（onNew=true） | **隐藏**（gateway mid=false） | console 接通；chat **没接上**（能做却不给入口，靠每轮 --model 其实可切） |
| claude | ❓ 219（未验证） | 显示 | 显示 | **假闭环嫌疑**：两处都显示未验证能力 |
| zcode | ✅⚠ 553 | 显示 | 显示 | 配置级接通〔实测 T2〕；下一轮实际模型无 L0 证据 → 部分通 |
| workbuddy | ✅⚠ 552 | 显示 | 显示 | 接通（带下层核验保留） |
| opencode | ❌345(L0 已证无效) / ❓738 | 显示 | 显示 | **假闭环**：下层做不到/未证实，两端照常显示 |
| hermes | ✅ 591 | 显示 | **隐藏**（gateway mid=false，chat.js:100 同） | console 接通；chat **没接上**（漏掉真能力） |
| antigravity | 新建 ✅420（--model tier）；中途 ❌421/444 | **不显示**（onNew=false+单模型，console.js:49） | 新会话显示 tier 下拉、中途隐藏（chat.js:83） | chat 接通（新会话 tier 真实）；console **没接上**（连真能力都没有入口）；中途两家都正确隐藏 |

| 权限控件 | 显示的渠道 | 实际效果 | 判定 |
|---|---|---|---|
| console `#nxCtlPerm` 下拉 | codex/claude/workbuddy/opencode（gateway caps.canSetPermissionMode=true 才渲染） | 字段名 `permissionMode` 被服务端忽略（server.ts:226 只读 `permissions`）→ 恒 `--approve-all`〔实测 T5b：deny-all 照样建文件〕 | **接错路 → 对 4 家全部假闭环**；zcode/hermes/AGY 正确隐藏 |
| chat `toggle-perm` 按钮 | 同上 4 家 | 发 `permissions` 正确 + 停用 meta_approver；但 ACP 下权限仍是**启动旗标**非轮中审批〔实测 T5a：督导默认开启时 reads 被静默升级为 all〕 | 接通（实现靠停督导）；审批横幅本身仍是事后假闭环 |

## 重复入口汇总（核实 HANDOFF 病灶 1「前端拥挤、重复入口」→ **属实**）

| 功能 | console 位置数 | chat 抽屉位置数 | 汇合点 |
|---|---|---|---|
| 新建会话 | 6（顶栏、空态、项目＋、看板、命令面板、/new） | 3（会话头、composer、sessions 卡） | POST /api/gateway/session/new（内存 draft） |
| 模型选择 | 1（composer）+ 4 处纯显示 | 2（会话头+composer） | chat 两处同调 switchModel；console 与 chat 又各一套硬编码模型表 |
| 渠道切换 | 2（左栏胶囊=过滤、composer 下拉=发送目标，**语义还不一致**） | 2（sessions 启动卡、composer pills，同函数） | openChannelControlRoom / channelFilter |
| 取消/停止 | 2（对话头、中断并立即发送）+2 个死药丸 | 3（composer 停止、实况条 ⏹、紧急停止）+插队间接 | POST /api/gateway/cancel |
| 跨渠道接力 | 4（对话头开抽屉、@提及、/handoff、右抽屉执行） | 1（转交下拉） | POST /api/gateway/handoff |
| 巡检 | 3（命令面板、护航页、/patrol） | 2（chat 元智能体条、sessions 卡） | POST /api/gateway/meta-agents/patrol |
| 审批 | 2（横幅、看板卡片） | 1（横幅） | POST /api/gateway/approve（假闭环） |
| 续跑 | 1（断点续跑，直接重发固定提示词） | 2（立即续跑、一键接管，走 /api/gateway/resume） | **同目的两套实现两个接口** |
