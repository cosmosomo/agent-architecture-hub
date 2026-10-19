# ZCode 自报能力清单 — 2026-10-19

**产品 ID**：`zcode`
**报告者**：ZCode（goal-mvewvj-zcode，GLM-5.3-Flash）——我就是 zcode 本尊在跑这份自报
**运行环境**：ZCode CLI 0.16.9 + Electron 桌面壳（`E:\zcode\ZCode.exe`）+ ACP 桥 zcode-acp-server 0.69.3（全局 node_modules 补丁版）；本会话由中心网关经 ACP 无头驱动
**证据来源**：① 本会话第一手（我的工具面、技能面当场可见，部分当场试过）；② 同日前一位 zcode 研究者的逐格实测（`results/native-zcode-20261019.md`，黑板 +39 行 by=zcode）；③ 网络调研（下方链接）

## 网络调研（先查了网，再摸本机）

- 官方站与文档：[zcode.z.ai](https://zcode.z.ai)（定位「GLM-5.3 官方 Harness / 新一代氛围编程工具」）、[文档首页](https://zcode.z.ai/en/docs/welcome)、[Browser Automation 文档](https://zcode.z.ai/en/docs/browser-use)、[Plugin 文档](https://zcode.z.ai/en/docs/plugin)、[配置文档](https://zcode.z.ai/cn/docs/configuration)、[FAQ](https://zcode.z.ai/en/docs/qa)
- 社区：[flaviocopes 评测](https://flaviocopes.com/zcode)（提到权限模式、automations、API）、[知乎教程](https://zhuanlan.zhihu.com/p/2056333146908632728)、[博客园上手实录](https://www.cnblogs.com/youring2/p/21143184)
- **网上与本机对得上的**：文档说 browser-use 插件带两个技能——本机看到的正是 `control-browser` 和 `web-gui-tester` 两个；评测提到的 automations——本机 tasks-index.sqlite 里有 automation_runs 843 行真实 cron 触发（前研究者实测）。
- **对不上的/注意的**：官网下载页按平台分发桌面安装包（本机是 `E:\zcode\ZCode.exe` + 内置 `zcode.cjs`），Git Bash 的 PATH 里没有 `zcode` 命令——CLI 是桌面壳内嵌的 node 入口，不是独立安装的命令行；开源项目里没搜到 ZCode 本体的逆向/复刻（核心闭源，插件才是 MIT/Apache）。

---

## 第一部分：矩阵里已有的能力单元（原生能做的）

矩阵 133 个单元里，前一位研究者 10-19 对 zcode 原生面逐格实测，黑板落了 **39 行：pass 15、partial 22、fail 2**；原生接口 pass 格从 22 升到 33（43%）。下表按证据档列出关键格，逐格细节见 `native-zcode-20261019.md`。

| 单元 | 入口 / 接口 | 依据 | 说明 |
|---|---|---|---|
| **goal** | CLI `/goal <目标>`、ACP `session/goal` | 试过 | 桥驱动目标循环真跑（82s，worker 回复+验证步 VERDICT: met），state 落盘 `.zcode/scratch/goals/<sid>/state.json`；`/goal status\|pause\|resume\|stop`、`/auto` 同机制 |
| **wake-timer** | 桌面 automations 控制台；会话内 CronCreate/List/Update/Delete | 试过 | 桌面宿主实证：automations 1 条在跑（cron `0 */2 * * *`）+ automation_runs **843 行**真实触发；无头侧 CronCreate 可调但后端校验「会话须属定时任务」才放行创建 |
| **terminal** | 会话内 Bash 工具 | 试过 | 本报告所有本机命令都是它跑的；前研究者查 tool_usage 表：Bash 25,306 次调用，逐次落时长/退出码/输出字节 |
| **spawn-subagent** | 会话内 Agent 工具 | 看到 | 多类型子智能体（Explore / general-purpose / visual-judge 等），支持后台运行、SendMessage 续聊既有子智能体；子会话落库 `task_type=subagent_child`（633 个），parent_id 指父 |
| **mode-switch** | `/mode plan\|build` | 试过 | 「✓ mode = plan/build」0.3s 返回；plan 模式对应会话内 EnterPlanMode/ExitPlanMode 工具 |
| **model-switch / model-list** | `/model GLM-5.3-Flash`、`/model` | 试过 | 「✓ 模型 = …」；跨恢复记忆（rememberModelChoice） |
| **reasoning-effort** | `/thought low\|high\|max`、ACP `session/setThoughtLevel` | 试过 | 跨恢复记忆；automation 运行记录里见 `reasoningLevel:"max"` 真生效 |
| **compact** | `/compact` | 试过 | 「✓ 已压缩对话上下文」2.6s；另有自动压缩 |
| **quota** | `/quota`、ACP `account/usage_stats` | 试过 | GLM Coding Plan 卡片（5h 窗口 79%、MCP 3%、按服务计数） |
| **cmd-list** | ACP `available_commands_update` | 试过 | session/new 后推送 **19 条**命令菜单，逐条实测对得上 |
| **mount-tools** | session/new `mcpServers`（stdio/HTTP）、`/mcp` | 试过 | 探针 MCP `mcp__probe-tools__echo` 真调用返回原文；坑：args 反斜杠被吞要用正斜杠，缺 env 报 -32602 |
| **rewind** | `/rewind latest`、checkpoint | 试过 | 静默把文件恢复到 checkpoint（文件消失→复原），checkpoint 落 `~/.zcode/v2/checkpoints/`，db session.revert 9 条历史 |
| **permission-scope** | guarded 模式审批流 | 试过 | 工作区外写挂起（Write kind:edit pending）→批准→放行落盘 |
| **open-idle** | ACP `session/new` | 试过 | 懒占位，零轮零回复，projection{status:idle} |
| **fork**（有边界） | ACP `session/fork`、`/fork` | 试过 | 有 checkpoint 时可用（initialize 声明 fork 能力，10-18 pass 在案）；无 checkpoint 的纯对话会话报 Internal error |
| **native-meta** | `cli/db/db.sqlite`（tasks、session 表） | 看到 | 标题三源（first_input/generated/custom）、pinned/archived/deleted/forked_from_task_id |
| **context-usage** | ACP projection + `usage_update` | 看到 | contextUsed/contextWindow(200000) + usage_update{used,size} + turn_usage 逐轮表 |
| **ask-user** | 会话内 AskUserQuestion 工具（选择题+Other 自由输入，可带 preview 对比） | 看到 | 本会话工具面在场 |
| **task-board**（会话内） | TodoWrite/TodoRead 工具 | 看到 | todo 表 2,370 行落库；但按 session_id 隔离，不是跨会话共享板 |
| **human-steer** | 桌面端轮中引导 | 看到 | session_input delivery=guide 4 行真人插话样本；无头无入口 |
| **memory-mode** | 记忆落 `cli/memories/projects/<hash>/memory/*.md`，CLI `--memory-bench` | 看到 | 本机 memoryEnabled:false（关着）；拨开关=改全局配置按红线未动 |
| **content-search** | SQLite 直读 LIKE 全库扫 | 看到 | 命中实测（'GOAL-OK' 2 会话）；无 FTS、产品无搜索 API |
| **archive / delete / label** | 桌面端操作，落 tasks 表 | 看到 | archived=2、deleted=2；入口只在桌面 |
| **inject-next** | 运行中发第二问 | 试过 | 是**取消抢占**不是排队（第一轮 stopReason=cancelled）；排队原生只在桌面（delivery=queue 675 行） |
| **open / resume / state / cancel / observe-history** | ACP 桥（`zcode-acp-server`） | 试过 | 中心网关经桥驱动本会话即是活证；resume 假 id 报「⚠ 找不到会话」（参数真解析） |
| **notify-user** | 桥内置 WeCom 推送（corpId/agentId/secret+免打扰窗+watchdog） | 看到 | 本机未配置，静默降级 |

## 第二部分：清单外的新能力（矩阵外或本家特色）

| 能力名 | 做什么 | 入口 / 接口 | 依据 |
|---|---|---|---|
| **Computer Use ★** | 自动化桌面应用：鼠标、键盘、UI 元素控制 | 官方插件 `computer-use` 0.5.14（MCP，宿主是 ZCode.exe 自己）；会话内 `node_repl` 工具明确限定「Browser Use and Computer Use only」 | 看到：plugin.json 实读（"automate desktop apps with mouse, keyboard, and UI element control"，Z.ai 署名，MIT）；本会话 node_repl 工具说明在场 |
| **Browser Use** | 内置浏览器自动化：开页、导航、点按、填表、截图、录 WebM、验证 web 页与本地 dev 目标 | CLI `--browser-use`（headless）+ `--browser-executable` + 内嵌浏览器视口；官方插件 `browser-use`；[官方文档](https://zcode.z.ai/en/docs/browser-use) | 看到：插件清单 + 本会话两个技能（control-browser / web-gui-tester）+ 前研究者确认配置面在（实跑未做，省额度） |
| **android-emulator** | Android 开发工作流与模拟器自动化 | 官方插件 0.1.0（MCP + skills + commands） | 看到：plugin.json 实读 |
| **ios-simulator** | iOS 模拟器自动化 | 官方插件 0.1.0（MCP + skills + commands） | 看到：同上；需 macOS，本 Windows 机上无用武之地 |
| **image-search** | 官方搜图 MCP，找插图/参考配图 | HTTP MCP `${ZCODE_BASE_URL}/api/v1/mcp/server/image_search`（JWT） | 看到：plugin.json 实读 |
| **内置联网搜索与网页提取** | WebSearch 搜索 + WebFetch 取页问答 + web_reader 正文提取 | 会话内工具；`hub/tools/search_hub.js` 是中心侧的同源封装 | 试过：本报告两轮联网搜索真返回（找到官方文档与评测） |
| **跨会话上下文读取** | 智能体读当前/历史会话的存档上下文（含被压缩掉的部分），按主题检索，可下载历史附件 | 会话内 ReadSessionContext 工具 | 看到：本会话工具面在场 |
| **飞书/Lark 通道回复** | 在授权的飞书群里追加回复、@人（信任引用+候选确认机制） | 会话内 ReplyToChannel 工具 | 看到：本会话工具面在场 |
| **visual-judge 视觉验收子智能体** | 四家文档插件各带一个视觉验收 agent：渲染成 PNG 后逐页判 JSON verdict（过/挂+证据），只读 | `Agent(subagent_type=documents:visual-judge\|pdf:visual-judge\|…) ` | 看到：本会话 agent 类型表在场 |
| **office 文档技能套件** | docx/pptx/xlsx/pdf 的创建、改版、转图、抽取 | 官方插件 documents / pdf / presentations / spreadsheets（带脚本） | 看到：插件缓存在盘，许可 MIT/Apache |
| **视觉理解 MCP** | 图像/视频分析、截图 OCR、UI diff 对比、UI 转 code/spec | zai-mcp-server MCP（GLM 视觉模型） | 看到：本会话 MCP 工具面在场 |
| **zread GitHub 读取** | 读任意 GitHub 仓库的结构、文件全文、文档/issue 检索 | zread MCP | 看到：本会话 MCP 工具面在场 |
| **技能与插件创建工具** | skill-creator（写/迭代 SKILL.md）、plugin-creator（做插件+本地测试市场） | 官方插件，也走 `/` 技能调用 | 看到：本会话技能表在场；插件缓存 16 个官方插件 |
| **AGENTS.md 分层指令** | 用户级 `~/.zcode/AGENTS.md` + 工作区 AGENTS.md 自动注入上下文 | 文件约定 | 试过：本会话两份都被注入（我能看到全文） |
| **长任务自主循环** | `/goal` + `/auto` + automations 三件套构成「长跑+定时+自主验收」 | CLI/桌面/ACP | 试过：goal 真跑 + automation 843 次（前研究者） |

## 第三部分：确定做不到 / 不开放的（写明理由）

| 单元/能力 | 结论 | 理由 |
|---|---|---|
| **sampling**（反向借模型） | ✗ fail | initialize 声明无 sampling 能力，全部实测无一次反向借模型——ZCode 自带渠道，借道采样不存在（前研究者实测） |
| **output-contract**（产出格式契约） | ✗ fail | CLI 与 ACP 方法面都没有契约参数（`--json` 是输出格式不是契约），只能写进提示词/AGENTS.md |
| **steer**（本轮插话原语） | ✗ | `session/steer` 已在 0.16 移除；桌面 guide 是人侧功能，无头无入口 |
| **inject-silent**（只入上下文不出声） | ✗ | 无原语 |
| **close**（关闭会话方法） | ✗ | 无对应 ACP 方法 |
| **无头下的 TUI 命令** | ✗ | `/new /help /plugins /login /logout /locale /expert /effort` 在 ACP 模式返回「需要 ZCode TUI」；`/workflows` 门禁关 |
| **无头自建定时任务** | ✗（有条件） | CronCreate 可调但后端校验「会话须属定时任务」才放创建——外部宿主要自实现 `automation/*` 端点 |
| **CLI 核心开源** | 不开放 | 本体闭源、按平台分发（官方下载站+内置模型套餐）；插件层 MIT/Apache-2.0，MCP/ACP 接口公开 |
| **app-sync / handover-human** | 未验 | opencli zcode send/open 源码在（10-17 有人呼出成功过），但要抢桌面焦点，按「不打扰用户」红线未重测——需用户配合 |

## 统计摘要

- **矩阵内**：前研究者 10-19 实测落黑板 39 行（pass 15 / partial 22 / fail 2），原生 pass 格 33/76（43%）；本自报叠加本会话第一手工具面确认。
- **清单外新能力**：15 项（Computer Use、Browser Use、android-emulator、ios-simulator、image-search、内置联网搜索、跨会话上下文、飞书通道、visual-judge、office 套件、视觉理解 MCP、zread、技能/插件创建、AGENTS.md 分层、长任务三件套）。
- **独家判断**：computer-use、goal 循环、定时 automations、android-emulator、跨会话上下文读取、飞书通道回复、visual-judge 形态；browser-use 与 Antigravity 内置浏览器同类（别家也有）。

## 交回

登记 22 条 feature（features 表）、3 条 note；其中独家 7 条；开放程度：公开接口 20 条、开源 2 条。
【交回】ZCode 自报完成：矩阵内 39 格有实测记录（pass 15），清单外新增 15 项（computer-use/browser-use/移动模拟器/定时自动化等），独家 7 条，接口面以公开接口为主（MCP/ACP/CLI），CLI 核心闭源、插件层 MIT/Apache 开源。
