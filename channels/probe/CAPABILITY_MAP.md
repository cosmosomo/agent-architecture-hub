# 功能矩阵：每个单元在各家、各位置上的理论上限与现状（由黑板、integration-map 和完整性检查生成，勿手改）

生成时间：2026-10-19T07:25:27.090Z。列按 `channels/README.md`“立体认知”里的位置排：桌面端界面（用户说的原生应用层：桌面应用给人看什么、让人操作什么）、原生接口（原生接口层：app-server、命令行、ACP 桥等暴露给程序的）、适配器与我们的后端（适配器层）、网页（前端交互层）。理论上限来自设计目录《能力单元与协作拓扑_完整性检查_20261018》4.2；桌面端界面这一列靠截图分析和代码分析取证，不是行为实测，标“有（截图/代码）”；现有格子来自一份调研，未逐格核。每做完一件事：追加黑板 → 动了后端或前端就登记 `hub/data/integration-map.json` → 重跑 `channels/probe/scripts/build_coverage.js`。

标记：✓ 有行为证据（后面是实现路径）；◐ 部分；? 未验证；✗ 不通；✗假 界面有、实际是别的办法模拟；有（截图/代码） 桌面端界面这一列靠截图或代码分析得出、不是行为实测（这批来自调研，未逐格核）；· 没有记录。

## 现在还缺什么（外层：按 README“立体认知”的轴把现在的差摆出来）

README“立体认知”说清了每一级由谁当宿主、我们在那一级该做什么，拿它对着现状一看就知道差在哪；这里只把数摆出来，供核对。一格 = 一个能力单元在一个产品。生成时间 2026-10-19T07:25:27.097Z；统计七个产品（claude、codex、antigravity、zcode、workbuddy、opencode、hermes），Gemini、Droid 的凭证和 key 有问题，另算。

**每一层：理论极限、我们的目标、现状、依据记在哪**（一格 = 一个能力单元在一个产品）

| 层 | 理论极限 | 我们的目标 | 现状 | 依据记在哪、记什么 |
|---|---|---|---|---|
| 理论 | 每个能力单元最多做到哪、卡在哪、最多补齐到哪一级 | 每个单元都推出来 | 76 / 82 个单元已推 | 设计目录《完整性检查》4.2：上限、靠什么、根本限制、最多补齐到 |
| 原生面 | 那一级循环开放的时机 × 通向它的入口 | 每格查清：原生能做，或要补齐到哪一级 | 7 / 574 格已证实 | 黑板 route = <产品>/L0 或 L1a/<入口>：命令、原始输出、产品版本、日期 |
| 适配路线 | 路线挂的那个原生面能给的 | 每个产品走能力最高的路线 | 实测通过的格：经 acpx 命令行 0、直连 ACP 桥（嵌入 acpx 运行时可达） 0、直连 app-server 0、直连 Connect-RPC ＋ agentapi 7、驱动原生命令行 0、直连 CDP 操作桌面端界面 0、经 OpenCLI 操作桌面端界面 0 | 黑板 route = <产品>/L1b/acpx 等 |
| 后端 | 原生面能给的，加上我们当宿主补齐的（两个会话之间、一群会话全由我们） | 全部能力单元；补齐写明搬到哪一级 | 278 / 574 格已接：实测通过 205、部分 18、补齐 46、实现了未测 9 | `hub/data/integration-map.json`：action、status、fillLevel；实测记黑板 route = <产品>/L2/server-api |
| 网页 | 后端已接的，加上人机交互单元 | 桌面端有的都有，再加我们独有的（待处理、协作图） | 127 / 574 格网页用得到；桌面端有、网页没有 0 项 | integration-map 的 frontend；实测记黑板 route = <产品>/L3/m |
| 命令行网关 | 后端的全部动作 | 全部动作 | 22 / 39 个动作有子命令 | `hub/data/actions.json` 的 cli；实测记黑板 route = <产品>/L2/agent_gateway |

**按尺度和位置看**（格数）

| 尺度 | 格数 | 原生面已证实 | 后端已接：实测通过、部分或补齐 | 后端已接：实现了未测 | 网页上用得到 |
|---|---|---|---|---|---|
| 一轮之内 | 70 | 1 | 30 | 0 | 36 |
| 一个会话 | 245 | 3 | 119 | 4 | 40 |
| 两个会话之间（我们当宿主） | 84 | 3 | 58 | 0 | 21 |
| 一群会话（我们当宿主） | 35 | 0 | 31 | 4 | 9 |
| 底座 | 98 | 0 | 31 | 1 | 21 |
| 高阶能力 | 42 | 0 | 0 | 0 | 0 |

**按产品看**（分母是能力单元总数；“网页对桌面端”的分母是这个产品桌面端有的人机交互单元）

| 产品 | 实际（任一位置实测） | 原生接口 | 我们的后端（只算通过） | 原生已证实的接进了多少 | 网页对桌面端 |
|---|---|---|---|---|---|
| claude | 35% | 0% | 35% | — | 没查 |
| codex | 40% | 0% | 40% | — | 没查 |
| antigravity | 34% | 9% | 30% | 57% | 没查 |
| zcode | 40% | 0% | 40% | — | 没查 |
| workbuddy | 34% | 0% | 34% | — | 没查 |
| opencode | 34% | 0% | 34% | — | 没查 |
| hermes | 35% | 0% | 35% | — | 没查 |

**自己做**（28 格：原生已证实而后端没接，或这一级本来就由我们当宿主；按涉及的家数排，列前十）

- 通知人（notify-user，两个会话之间）：claude、codex、antigravity、zcode、workbuddy、opencode、hermes
- 交给人接手（handover-human，两个会话之间）：claude、codex、antigravity、zcode、workbuddy、opencode、hermes
- 原生应用同步可见（app-sync，两个会话之间）：claude、codex、antigravity、zcode、workbuddy、opencode、hermes
- 智能体间发消息（peer-message，两个会话之间）：claude、codex、antigravity、workbuddy、hermes
- 注入·下一轮（inject-next，一轮之内）：antigravity
- 设定角色说明（instructions，一个会话）：antigravity

**后端只做了一部分**（64 格；还缺的写在 `hub/data/integration-map.json` 那一条的 note 里）

- 观察·实时（observe-live）：claude、codex、antigravity、zcode、workbuddy、opencode、hermes
- 目标与预算（goal）：claude、codex、antigravity、zcode、workbuddy、opencode、hermes
- 渠道健康与熔断（channel-health）：claude、codex、antigravity、zcode、workbuddy、opencode、hermes
- 交接（handoff）：claude、codex、antigravity、zcode、workbuddy、opencode、hermes
- 并发容量（capacity）：claude、codex、antigravity、zcode、workbuddy、opencode、hermes
- 循环熔断（loop-guard）：claude、codex、antigravity、zcode、workbuddy、opencode、hermes
- 回顾对话记录（recall-history）：claude、codex、antigravity、zcode、workbuddy、opencode、hermes
- 注入·下一轮（inject-next）：claude、codex、zcode、workbuddy、opencode、hermes
- 查额度（quota）：codex、antigravity、zcode、workbuddy、opencode、hermes
- 切模式（mode-switch）：claude、workbuddy、opencode

**补测**（9 格：后端已经实现，还没在这个产品上实测；按涉及的产品数排，列前十）

- 压缩上下文（compact）：claude、workbuddy、opencode、hermes
- 共享任务板（task-board）：claude、codex、antigravity、workbuddy
- 可用命令清单（cmd-list）：claude

**派研究**（268 格：这一级由各家当宿主，原生面和后端都没证实；按涉及的家数排，列前十，注明理论上限推了没有）

- 关闭会话（close，一个会话）：7 家；理论上限已推
- 注入·工具结果捎带（inject-tool，一轮之内）：7 家；理论上限已推
- 注入·收件箱（inject-inbox，一轮之内）：7 家；理论上限已推
- 注入·只入上下文（inject-silent，一轮之内）：7 家；理论上限已推
- 列模型（model-list，底座）：7 家；理论上限已推
- 按调用选渠道（channel-route，底座）：7 家；理论上限已推
- 守卫（guard，一个会话）：7 家；理论上限已推
- 定时唤醒（wake-timer，一个会话）：7 家；理论上限已推
- 人中途插话（human-steer，一轮之内）：7 家；理论上限已推
- 浏览器（browser，高阶能力）：7 家；理论上限已推

**桌面端有、网页还没做或没做全的人机交互单元**（按有它的家数排）

无

**认知本身还缺什么**

- 理论上限还没推的单元：回顾对话记录、操作电脑、联网搜索、深度调研、生成图片、生成办公文档
- 桌面端（人机交互）没有数据的家：claude、codex、antigravity、zcode、workbuddy、opencode、hermes
- 适配路线有实测的：经 OpenCLI 无；直连 CDP 无
- 没归到尺度的能力单元：无

## 七个矩阵的覆盖率（用户 10-18 定的结构；定义见 `channels/README.md`“立体认知”）

分母：人机交互单元 50 个（桌面端、网页两个矩阵）；能力单元（接口 ＋ 协作 ＋ 底座）82 个（其余五个矩阵）。“通过”只算有行为证据的；桌面端矩阵的“有”来自截图或代码分析。

### 桌面端人机交互与我们的 web 体验

| 产品 | 桌面端有（/人机交互单元） | 我们的网页做到（/人机交互单元） | 网页对桌面端的覆盖率 |
|---|---|---|---|
| claude | 没查 | 27（54%） | — |
| codex | 没查 | 26（52%） | — |
| antigravity | 没查 | 26（52%） | — |
| zcode | 没查 | 27（54%） | — |
| workbuddy | 没查 | 26（52%） | — |
| opencode | 没查 | 26（52%） | — |
| hermes | 没查 | 26（52%） | — |
| gemini | 没查 | 22（44%） | — |
| droid | 没查 | 22（44%） | — |

### 理论能力

82 个能力单元里 76 个已推出理论上限（完整性检查 4.2；逐个单元见下文各节“理论上限”）。按 README“立体认知”里“理论极限”一段，每个单元在每家理论上都至少能补齐到“新建会话 ＋ 文件”一级，所以理论覆盖率按档看：原生、换入口、宿主补齐、兜底。下面几个矩阵的分母都是全部能力单元，差额就是离理论上限的距离。

### 实际能力、原生接口与适配器

| 产品 | 实际（任一位置通过） | 原生接口合计 | 我们的适配器（现状） | 适配器对原生接口的接入率 |
|---|---|---|---|---|
| claude | 29（35%） | 0（0%） | 29（35%） | — |
| codex | 33（40%） | 0（0%） | 33（40%） | — |
| antigravity | 28（34%） | 7（9%） | 25（30%） | 57% |
| zcode | 33（40%） | 0（0%） | 33（40%） | — |
| workbuddy | 28（34%） | 0（0%） | 28（34%） | — |
| opencode | 28（34%） | 0（0%） | 28（34%） | — |
| hermes | 29（35%） | 0（0%） | 29（35%） | — |
| gemini | 4（5%） | 0（0%） | 4（5%） | — |
| droid | 4（5%） | 0（0%） | 4（5%） | — |

### 原生接口：逐个入口的覆盖率（通过的能力单元数 / 全部能力单元）

| 产品 | OpenCLI（操作桌面端界面） | app-server | Connect-RPC | agentapi | HTTP 服务（serve） | 命令行 | 本地库与会话文件 | 子智能体工具 | 其他原生入口 | ACP 桥 |
|---|---|---|---|---|---|---|---|---|---|---|
| antigravity | · | · | 1（1%） | 6（7%） | · | · | · | · | · | · |

### 不同适配路线的覆盖率（若由我们的适配器走这条路，能拿到多少；“现状”是已经接进来的）

| 产品 | 经 acpx 命令行 | 直连 ACP 桥（嵌入 acpx 运行时可达） | 直连 app-server | 直连 Connect-RPC ＋ agentapi | 驱动原生命令行 | 直连 CDP 操作桌面端界面 | 经 OpenCLI 操作桌面端界面 | 我们的后端（现状） |
|---|---|---|---|---|---|---|---|---|
| claude | · | · | · | · | · | · | · | 29（35%） |
| codex | · | · | · | · | · | · | · | 33（40%） |
| antigravity | · | · | · | 7（9%） | · | · | · | 25（30%） |
| zcode | · | · | · | · | · | · | · | 33（40%） |
| workbuddy | · | · | · | · | · | · | · | 28（34%） |
| opencode | · | · | · | · | · | · | · | 28（34%） |
| hermes | · | · | · | · | · | · | · | 29（35%） |
| gemini | · | · | · | · | · | · | · | 4（5%） |
| droid | · | · | · | · | · | · | · | 4（5%） |

## 总账：要做什么、派什么

| 产品 | 已到前端 | 自己做（上限已证实，没接进来） | 派出去研究（上限不清或要找别的路） |
|---|---|---|---|
| antigravity | 34 | 20 | 78 |
| codex | 30 | 29 | 73 |
| claude | 32 | 24 | 76 |
| zcode | 37 | 24 | 71 |
| workbuddy | 30 | 24 | 78 |
| opencode | 31 | 23 | 78 |
| hermes | 31 | 24 | 77 |
| gemini | 24 | 2 | 6 |
| droid | 24 | 2 | 6 |

理论上限：控制与观察类 76 / 82 个已推（完整性检查 4.2）；人机交互类 50 个的上限取决于它依赖的单元在原生接口和我们的后端能否拿到数据。没推的单元，“派研究”的第一步是负责人先推理论上限。

**自己做的清单（按单元，后面是哪几家）**：
- 接管原生会话（resume-native）：codex、claude、zcode、workbuddy
- 状态识别（state）：codex、claude、zcode、workbuddy、opencode、hermes
- 打断（cancel）：codex、claude、zcode、workbuddy、opencode、hermes
- 插话（注入）（steer）：codex
- 注入·下一轮（inject-next）：antigravity
- 目标与预算（goal）：antigravity
- 答复审批（permission）：codex、claude、workbuddy、hermes
- 分叉（fork）：codex
- 压缩上下文（compact）：codex
- 新建时选模型（model-new）：codex、claude、zcode、workbuddy、opencode、hermes
- 中途切模型（model-switch）：codex、claude、zcode、workbuddy、opencode、hermes
- 切模式（mode-switch）：codex、zcode、hermes
- 交付（act-deliver）：codex、claude、zcode、workbuddy、opencode、hermes、antigravity
- 请求（act-request）：codex、claude、zcode、workbuddy、opencode、hermes、antigravity
- 让出（act-yield）：codex、claude、zcode、workbuddy、opencode、hermes、antigravity
- 上报（act-report）：codex、claude、zcode、workbuddy、opencode、hermes、antigravity
- 等待可见（wait-visible）：codex、workbuddy、hermes、antigravity
- 后台任务唤醒（wake-bg）：codex、claude、zcode、workbuddy、opencode、hermes、antigravity
- 消息唤醒（wake-msg）：codex、claude、zcode、workbuddy、opencode、hermes、antigravity
- 卡住可发现（wake-stall）：codex、claude、zcode、workbuddy、opencode、hermes、antigravity
- 唤醒撑过重启（wake-persist）：codex、claude、zcode、workbuddy、opencode、hermes、antigravity
- 派子智能体（spawn-subagent）：codex、claude、workbuddy、opencode、hermes、antigravity
- 智能体间发消息（peer-message）：zcode、opencode
- 共享任务板（task-board）：opencode
- 向人提问（ask-user）：codex、claude、zcode
- 产出物发布（artifact）：codex、claude、zcode、workbuddy、opencode、hermes、antigravity、gemini、droid
- 设定角色说明（instructions）：claude、antigravity
- 指定工作目录（workspace）：codex、claude、zcode、workbuddy、opencode、hermes、antigravity
- 所有权识别（ownership）：codex、claude、zcode、workbuddy、opencode、hermes、antigravity、gemini、droid
- 回收（reclaim）：codex、claude、zcode、workbuddy、opencode、hermes、antigravity
- 可用命令清单（cmd-list）：zcode、workbuddy、opencode、hermes
- 读原生会话元数据（native-meta）：codex、claude、zcode、workbuddy、opencode、hermes、antigravity
- 全文检索（content-search）：codex、claude、zcode、workbuddy、opencode、hermes、antigravity
- 推理力度（reasoning-effort）：codex
- 列项目（list-projects）：codex、claude、zcode、workbuddy、opencode、hermes、antigravity

## 新建会话（open）

新建一个会话并给它第一份输入。怎样算支持：新会话完成一轮。类别：必需操作。

**理论上限**：任何智能体都能做到（靠 一轮开始前）。根本限制：恢复要有会话记录、而且这家能加载它；跨供应商恢复可能解不开加密的推理内容。原生做不到时最多补齐到：——。

| 产品 | 桌面端界面 | 原生接口 | 适配器与我们的后端 | 网页 | 差距与下一步 |
|---|---|---|---|---|---|
| antigravity | · | · | ✓ POST /api/gateway/send → startAntigravityRun：langu | ✓ /m/ v2（10-18 负责人重写）：新建后“正在拉起”等待层，每 1.5 秒查 /api/gat | 已到前端 |
| codex | · | · | ✓ POST /api/gateway/send（新会话名）→ gateway.sendPrompt → | ✓ /m/ v2（10-18 负责人重写）：新建后“正在拉起”等待层，每 1.5 秒查 /api/gat | 已到前端 |
| claude | · | · | ✓ POST /api/gateway/send（新会话名）→ gateway.sendPrompt → | ✓ /m/ v2（10-18 负责人重写）：新建后“正在拉起”等待层，每 1.5 秒查 /api/gat | 已到前端 |
| zcode | · | · | ✓ 命令行 hub/tools/agent_gateway.js run --agent <家> --s | ✓ /m/ v2（10-18 负责人重写）：新建后“正在拉起”等待层，每 1.5 秒查 /api/gat | 已到前端 |
| workbuddy | · | · | ✓ 命令行 hub/tools/agent_gateway.js run --agent <家> --s | ✓ /m/ v2（10-18 负责人重写）：新建后“正在拉起”等待层，每 1.5 秒查 /api/gat | 已到前端 |
| opencode | · | · | ✓ 命令行 hub/tools/agent_gateway.js run --agent <家> --s | ✓ /m/ v2（10-18 负责人重写）：新建后“正在拉起”等待层，每 1.5 秒查 /api/gat | 已到前端 |
| hermes | · | · | ✓ 命令行 hub/tools/agent_gateway.js run --agent <家> --s | ✓ /m/ v2（10-18 负责人重写）：新建后“正在拉起”等待层，每 1.5 秒查 /api/gat | 已到前端 |
| gemini | · | · | ? 命令行 hub/tools/agent_gateway.js | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| droid | · | · | ? 命令行 hub/tools/agent_gateway.js | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |

## 恢复会话（resume）

给待命的会话一份新输入，开始新的一轮（热待命或冷待命都算）。怎样算支持：第二轮回复引用了第一轮内容。类别：必需操作。

**理论上限**：任何智能体都能做到（靠 一轮开始前）。根本限制：恢复要有会话记录、而且这家能加载它；跨供应商恢复可能解不开加密的推理内容。原生做不到时最多补齐到：——。

| 产品 | 桌面端界面 | 原生接口 | 适配器与我们的后端 | 网页 | 差距与下一步 |
|---|---|---|---|---|---|
| antigravity | · | · | ✓ POST /api/gateway/send（已有会话名）→ codex app-server th | ✓ /m/ v2（10-18 负责人重写）：发话：/api/gateway/send 带 traceSe | 已到前端 |
| codex | · | · | ✓ POST /api/gateway/send（已有会话名）→ codex app-server th | ✓ /m/ v2（10-18 负责人重写）：发话：/api/gateway/send 带 traceSe | 已到前端 |
| claude | · | · | ✓ POST /api/gateway/send（已有会话名）→ codex app-server th | ✓ /m/ v2（10-18 负责人重写）：发话：/api/gateway/send 带 traceSe | 已到前端 |
| zcode | · | · | ✓ 常驻 ACP 桥：会话热着就直接 session/prompt；不在桥上就先 session/loa | ✓ /m/ v2（10-18 负责人重写）：发话：/api/gateway/send 带 traceSe | 已到前端 |
| workbuddy | · | · | ✓ 常驻 ACP 桥：会话热着就直接 session/prompt；不在桥上就先 session/loa | ✓ /m/ v2（10-18 负责人重写）：发话：/api/gateway/send 带 traceSe | 已到前端 |
| opencode | · | · | ✓ 常驻 ACP 桥：会话热着就直接 session/prompt；不在桥上就先 session/loa | ✓ /m/ v2（10-18 负责人重写）：发话：/api/gateway/send 带 traceSe | 已到前端 |
| hermes | · | · | ✓ 常驻 ACP 桥：会话热着就直接 session/prompt；不在桥上就先 session/loa | ✓ /m/ v2（10-18 负责人重写）：发话：/api/gateway/send 带 traceSe | 已到前端 |

## 接管原生会话（resume-native）

恢复一个不是中心新建的会话：人在桌面或终端打开的、别的程序新建的。怎样算支持：从中心恢复后回复引用原会话内容；人正占用时如何表现（锁、排队、拒绝）要记下。类别：必需操作（扩展）。

**理论上限**：人开的、别的程序开的会话，我们接着发话，记忆和编号都不变（靠 一轮开始前；平台的加载会话接口（ACP `session/load`、`--resume-session`、app-server `thread/resume`））。根本限制：会话正被别人的进程持有时只能经那个应用的通道；会话已归档、加密或存在服务器上时要平台放行。原生做不到时最多补齐到：读它的记录写成摘要，新建会话带上，代价：身份变了、原生记忆只剩摘要；人看到的是两个会话。

| 产品 | 桌面端界面 | 原生接口 | 适配器与我们的后端 | 网页 | 差距与下一步 |
|---|---|---|---|---|---|
| antigravity | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| codex | · | · | ✓ 会话身份统一为 <产品>:<原生编号>（gateway.canonicalSessionId，ZCo | · | 自己做：做到前端 |
| claude | · | · | ✓ 会话身份统一为 <产品>:<原生编号>（gateway.canonicalSessionId，ZCo | · | 自己做：做到前端 |
| zcode | · | · | ✓ 会话身份统一为 <产品>:<原生编号>（gateway.canonicalSessionId，ZCo | · | 自己做：做到前端 |
| workbuddy | · | · | ✓ gateway.startRunInternal：traceSessionId 是这一家自己的会话时 | · | 自己做：做到前端 |
| opencode | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| hermes | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |

## 观察·实时（observe-live）

一轮进行中看实时事件：文本、工具调用、用量、状态变化、结构化的步骤计划；也包括不接管进程、只跟随会话日志的被动观察（10-18 补）。怎样算支持：进行中拿到流式事件。类别：必需操作。

**理论上限**：每一步都看到（靠 宿主拿到的事件流）。根本限制：别人开着的会话只能读它落盘的东西；只在事件流里出现、不落盘的事件理论上看不到。原生做不到时最多补齐到：跟随会话文件，代价：有延迟，看不到不落盘的东西。

| 产品 | 桌面端界面 | 原生接口 | 适配器与我们的后端 | 网页 | 差距与下一步 |
|---|---|---|---|---|---|
| antigravity | · | · | ◐ GET /api/gateway/stream（SSE，ru | ? /m/（10-18 晚负责人接手）：同上 | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| codex | · | · | ◐ GET /api/gateway/stream（SSE，ru | ? /m/（10-18 晚负责人接手）：同上 | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| claude | · | · | ◐ GET /api/gateway/stream（SSE，ru | ? /m/（10-18 晚负责人接手）：同上 | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| zcode | · | · | ◐ GET /api/gateway/stream（SSE，ru | ✓ /m/（10-18 晚负责人接手）：会话详情经 SSE（/api/gateway/stream）逐段 | 已到前端 |
| workbuddy | · | · | ◐ GET /api/gateway/stream（SSE，ru | ? /m/（10-18 晚负责人接手）：同上 | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| opencode | · | · | ◐ GET /api/gateway/stream（SSE，ru | ? /m/（10-18 晚负责人接手）：同上 | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| hermes | · | · | ◐ GET /api/gateway/stream（SSE，ru | ? /m/（10-18 晚负责人接手）：同上 | 派研究：原生接口没证实，按理论上限找入口或补齐 |

## 观察·历史（observe-history）

读回会话的完整记录，包括不是中心开的会话。怎样算支持：读回全部轮次，丢弃为零。类别：必需操作。

**理论上限**：全部轮次（靠 会话记录）。根本限制：平台把会话存在服务器上、本地不留，就只能靠平台接口。原生做不到时最多补齐到：——。

| 产品 | 桌面端界面 | 原生接口 | 适配器与我们的后端 | 网页 | 差距与下一步 |
|---|---|---|---|---|---|
| antigravity | · | · | ✓ GET /api/sessions/<编号>?tail=N&compact=1（只读旁路读各家会话记 | ✓ /m/ v2（10-18 负责人重写）：详情：每轮全部步骤，加载更早 | 已到前端 |
| codex | · | · | ✓ GET /api/sessions/<编号>?tail=N&compact=1（只读旁路读各家会话记 | ✓ /m/ v2（10-18 负责人重写）：详情：每轮全部步骤，加载更早 | 已到前端 |
| claude | · | · | ✓ GET /api/sessions/<编号>?tail=N&compact=1（只读旁路读各家会话记 | ✓ /m/ v2（10-18 负责人重写）：详情：每轮全部步骤，加载更早 | 已到前端 |
| zcode | · | · | ✓ GET /api/sessions/<编号>?tail=N&compact=1（只读旁路读各家会话记 | ✓ /m/ v2（10-18 负责人重写）：详情：每轮全部步骤，加载更早 | 已到前端 |
| workbuddy | · | · | ✓ GET /api/sessions/<编号>?tail=N&compact=1（只读旁路读各家会话记 | ✓ /m/ v2（10-18 负责人重写）：详情：每轮全部步骤，加载更早 | 已到前端 |
| opencode | · | · | ✓ GET /api/sessions/<编号>?tail=N&compact=1（只读旁路读各家会话记 | ✓ /m/ v2（10-18 负责人重写）：详情：每轮全部步骤，加载更早 | 已到前端 |
| hermes | · | · | ✓ GET /api/sessions/<编号>?tail=N&compact=1（只读旁路读各家会话记 | ✓ /m/ v2（10-18 负责人重写）：详情：每轮全部步骤，加载更早 | 已到前端 |
| gemini | · | · | ✓ GET /api/sessions/<编号>?tail=N&compact=1（只读旁路读各家会话记 | ✓ /m/ v2（10-18 负责人重写）：详情：每轮全部步骤，加载更早 | 已到前端 |
| droid | · | · | ✓ GET /api/sessions/<编号>?tail=N&compact=1（只读旁路读各家会话记 | ✓ /m/ v2（10-18 负责人重写）：详情：每轮全部步骤，加载更早 | 已到前端 |

## 状态识别（state）

区分执行中（工作中、等回应）、待命（热、冷）、关闭、出错。怎样算支持：有可靠判据，不靠猜。类别：必需操作。

**理论上限**：准确区分工作中、等审批、待命、关闭（靠 事件流或平台状态接口）。根本限制：别人开着的会话只能推断。原生做不到时最多补齐到：看文件修改时间、锁文件，代价：推断会误判，只能用来禁止写入。

| 产品 | 桌面端界面 | 原生接口 | 适配器与我们的后端 | 网页 | 差距与下一步 |
|---|---|---|---|---|---|
| antigravity | · | · | ✓ GET /api/m/agy：读 Antigravity 会话索引 conversation_sum | ✓ /m/：列表卡片状态标签与筛选 | 已到前端 |
| codex | · | · | ✓ 命令行 agent_gateway.js read / wait --agent <家> --ses | · | 自己做：做到前端 |
| claude | · | · | ✓ 命令行 agent_gateway.js read / wait --agent <家> --ses | · | 自己做：做到前端 |
| zcode | · | · | ✓ 命令行 agent_gateway.js read / wait --agent <家> --ses | · | 自己做：做到前端 |
| workbuddy | · | · | ✓ 命令行 agent_gateway.js read / wait --agent <家> --ses | · | 自己做：做到前端 |
| opencode | · | · | ✓ 命令行 agent_gateway.js read / wait --agent <家> --ses | · | 自己做：做到前端 |
| hermes | · | · | ✓ 命令行 agent_gateway.js read / wait --agent <家> --ses | · | 自己做：做到前端 |

## 打断（cancel）

结束这一轮，保留会话。怎样算支持：那一轮停下，之后还能恢复。类别：必需操作。

**理论上限**：这一轮停下、会话还在（靠 步与步之间，或宿主发取消）。根本限制：别人开着的会话只能经那个应用的通道。原生做不到时最多补齐到：结束我们自己拉起的进程，代价：结束进程可能丢掉这一轮、甚至损坏会话记录。

| 产品 | 桌面端界面 | 原生接口 | 适配器与我们的后端 | 网页 | 差距与下一步 |
|---|---|---|---|---|---|
| antigravity | · | · | ✓ POST /api/gateway/cancel → gateway.cancelRun：Conne | ✓ /m/：打断（先确认） | 已到前端 |
| codex | · | · | ✓ POST /api/gateway/cancel → gateway.cancelRun：codex | · | 自己做：做到前端 |
| claude | · | · | ✓ POST /api/gateway/cancel → gateway.cancelRun：codex | · | 自己做：做到前端 |
| zcode | · | · | ✓ 常驻 ACP 桥：session/cancel 通知，session/prompt 随后以 stop | · | 自己做：做到前端 |
| workbuddy | · | · | ✓ 常驻 ACP 桥：session/cancel 通知，session/prompt 随后以 stop | · | 自己做：做到前端 |
| opencode | · | · | ✓ 常驻 ACP 桥：session/cancel 通知，session/prompt 随后以 stop | · | 自己做：做到前端 |
| hermes | · | · | ✓ 常驻 ACP 桥：session/cancel 通知，session/prompt 随后以 stop | · | 自己做：做到前端 |

## 关闭会话（close）

连会话一起结束，不再接收输入。怎样算支持：会话关闭。类别：必需操作。

**理论上限**：会话结束、不再接收输入、资源释放（靠 宿主的关闭接口；结束我们自己持有的进程）。根本限制：别人持有的会话只能经那个应用。原生做不到时最多补齐到：我们这边不再给它发话、标为已放手，代价：它的进程可能还在，只是我们不再用。

| 产品 | 桌面端界面 | 原生接口 | 适配器与我们的后端 | 网页 | 差距与下一步 |
|---|---|---|---|---|---|
| antigravity | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| codex | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| claude | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| zcode | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| workbuddy | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| opencode | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| hermes | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |

## 插话（注入）（steer）

往进行中的这一轮加一句，这一轮继续。怎样算支持：插入的话在本轮内体现。类别：可选操作。

**理论上限**：本轮下一步就看到（靠 步与步之间）。根本限制：循环不在步与步之间看外面，就不可能。原生做不到时最多补齐到：工具调用钩子里加话（下一次调工具时看到）＞ 中心工具的返回值里夹带 ＞ 排到下一轮 ＞ 收件箱，代价：越往后越慢；钩子和工具捎带要求它这一轮还会调工具。

| 产品 | 桌面端界面 | 原生接口 | 适配器与我们的后端 | 网页 | 差距与下一步 |
|---|---|---|---|---|---|
| antigravity | · | · | ✓ gateway.steerAntigravity：会话在跑时 agentapi send-messa | ✓ /m/：干活时在详情页发话（插进当前这一轮） | 已到前端 |
| codex | · | · | ✓ gateway.steerCodexRun：会话在跑时经 codex app-server 发送 t | ✗假 /console/：中断并插队 | 自己做：做到前端 |
| claude | · | · | · | ✗假 /console/：中断并插队 | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| zcode | · | · | · | ✗假 /console/：中断并插队 | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| workbuddy | · | · | · | ✗假 /console/：中断并插队 | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| opencode | · | · | · | ✗假 /console/：中断并插队 | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| hermes | · | · | · | ✗假 /console/：中断并插队 | 派研究：原生接口没证实，按理论上限找入口或补齐 |

## 注入·下一轮（inject-next）

一轮进行中送来的话排到下一轮执行。怎样算支持：本轮结束后自动作为下一轮输入。类别：可选操作（扩展）。

**理论上限**：进行中送来的话，在这一轮结束后自动作为下一轮输入（靠 一轮开始前）。根本限制：无根本限制：任何智能体都接受新一轮输入。原生做不到时最多补齐到：中心自己排队、等这一轮结束再发，代价：中心要常驻、队列要持久化，否则重启就丢。

| 产品 | 桌面端界面 | 原生接口 | 适配器与我们的后端 | 网页 | 差距与下一步 |
|---|---|---|---|---|---|
| antigravity | · | ✓ node channels/probe/scripts/antigravity/rpc.mjs Se | · | · | 自己做：接进适配器 |
| codex | · | · | ◐ gateway.sendPrompt：会话在跑时排进后端内存 | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| claude | · | · | ◐ gateway.sendPrompt：会话在跑时排进后端内存 | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| zcode | · | · | ◐ gateway.sendPrompt：会话在跑时排进后端内存 | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| workbuddy | · | · | ◐ gateway.sendPrompt：会话在跑时排进后端内存 | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| opencode | · | · | ◐ gateway.sendPrompt：会话在跑时排进后端内存 | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| hermes | · | · | ◐ gateway.sendPrompt：会话在跑时排进后端内存 | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |

## 注入·工具结果捎带（inject-tool）

智能体调用中心提供的 MCP 工具时，把待送的话夹在工具结果里一并返回。怎样算支持：智能体在本轮下一步里看到并照做；带请求编号可去重。类别：可选操作（扩展）。

**理论上限**：智能体下一次调用中心工具时就看到（靠 工具结果返回时）。根本限制：它这一轮不再调中心工具就送不到；要求它挂了中心的 MCP 工具。原生做不到时最多补齐到：排到下一轮，代价：慢；依赖它主动调工具。

| 产品 | 桌面端界面 | 原生接口 | 适配器与我们的后端 | 网页 | 差距与下一步 |
|---|---|---|---|---|---|
| antigravity | · | ◐ node channels/probe/scripts/an | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| codex | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| claude | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| zcode | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| workbuddy | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| opencode | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| hermes | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |

## 注入·收件箱（inject-inbox）

把话写进约定的文件，智能体在合适时读。怎样算支持：智能体下一次读文件时照做。类别：可选操作（扩展）。

**理论上限**：写进约定文件，它读到就照做（靠 它自己去读文件时）。根本限制：读不读、何时读由它决定，宿主无法强制。原生做不到时最多补齐到：每轮开头的说明里写明“先看收件箱”，代价：最慢、不保证被看到；任何能读文件的都能补齐到这一级。

| 产品 | 桌面端界面 | 原生接口 | 适配器与我们的后端 | 网页 | 差距与下一步 |
|---|---|---|---|---|---|
| antigravity | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| codex | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| claude | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| zcode | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| workbuddy | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| opencode | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| hermes | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |

## 注入·只入上下文（inject-silent）

把内容写进会话上下文，但不触发新的一轮推理。怎样算支持：下一轮的回复引用了注入的内容，注入时没有产生回复。类别：可选操作（扩展）。

**理论上限**：内容进上下文、不触发新一轮推理（靠 平台的“追加消息不推理”接口（如 Codex 的 inject））。根本限制：多数平台没有这种接口，送进去就会推理。原生做不到时最多补齐到：放进下一轮输入、写明“仅供参考，不必回复”，代价：会多耗一轮，智能体可能还是会回应。

| 产品 | 桌面端界面 | 原生接口 | 适配器与我们的后端 | 网页 | 差距与下一步 |
|---|---|---|---|---|---|
| antigravity | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| codex | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| claude | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| zcode | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| workbuddy | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| opencode | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| hermes | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |

## 目标与预算（goal）

给会话设定一个目标和预算，智能体持续推进到达成或预算用完。怎样算支持：会话按目标继续，预算到了停下。类别：可选操作（扩展）。

**理论上限**：智能体自己持续推进到目标达成或预算用完（靠 平台的目标或预算参数（Codex goal、最大轮数、token 上限））。根本限制：平台没有就只能由外部判断。原生做不到时最多补齐到：中心循环：每轮结束检查“达成没有、花了多少”，没达成就续一轮，超预算就停，代价：判断是否达成要额外一次评估；中心要常驻。

| 产品 | 桌面端界面 | 原生接口 | 适配器与我们的后端 | 网页 | 差距与下一步 |
|---|---|---|---|---|---|
| antigravity | · | ✓ node channels/probe/scripts/antigravity/run_agenta | ◐ 在“一群会话”这一级由中心给目标设预算：派活次数（含返工和验 | · | 自己做：接进适配器 |
| codex | · | · | ◐ 在“一群会话”这一级由中心给目标设预算：派活次数（含返工和验 | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| claude | · | · | ◐ 在“一群会话”这一级由中心给目标设预算：派活次数（含返工和验 | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| zcode | · | · | ◐ 在“一群会话”这一级由中心给目标设预算：派活次数（含返工和验 | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| workbuddy | · | · | ◐ 在“一群会话”这一级由中心给目标设预算：派活次数（含返工和验 | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| opencode | · | · | ◐ 在“一群会话”这一级由中心给目标设预算：派活次数（含返工和验 | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| hermes | · | · | ◐ 在“一群会话”这一级由中心给目标设预算：派活次数（含返工和验 | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |

## 答复审批（permission）

答复智能体在一轮中途提出的审批或问题，它接着做。怎样算支持：中途收到请求原文，答复后行为随之改变。类别：可选操作。

**理论上限**：一轮中途被问、答了它接着做（靠 请求审批时）。根本限制：智能体运行在“全放行”或自己拒绝的模式下，根本不会来问。原生做不到时最多补齐到：事先用守卫和权限作用域定死规则，代价：只能防，不能临场答复。

| 产品 | 桌面端界面 | 原生接口 | 适配器与我们的后端 | 网页 | 差距与下一步 |
|---|---|---|---|---|---|
| antigravity | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| codex | · | · | ✓ POST /api/gateway/approve → gateway.resolveApprova | · | 自己做：做到前端 |
| claude | · | · | ✓ POST /api/gateway/approve → gateway.resolveApprova | · | 自己做：做到前端 |
| zcode | · | · | ✓ POST /api/gateway/approve → gateway.resolveApprova | ✓ /m/（10-18 晚负责人接手）：待处理里的审批卡片：同意放行、驳回；如实标“补齐·会话级重跑” | 已到前端 |
| workbuddy | · | · | ✓ POST /api/gateway/approve → gateway.resolveApprova | · | 自己做：做到前端 |
| opencode | · | · | ? OpenCode 的 ACP 不报模式、写文件不来请求权限（ | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| hermes | · | · | ✓ POST /api/gateway/approve → gateway.resolveApprova | · | 自己做：做到前端 |

## 分叉（fork）

从会话（或其中某一步）复制出新会话，原会话不动。怎样算支持：新会话问得出原会话内容。类别：可选操作。

**理论上限**：从任意一步复制出新会话（靠 平台的分叉接口）。根本限制：会话状态存在平台服务器上、本地只有副本时，复制文件不一定能被加载。原生做不到时最多补齐到：复制会话文件、换个编号让它加载；再不行就新建会话并带上摘要，代价：后者丢掉原生记忆，只剩摘要。

| 产品 | 桌面端界面 | 原生接口 | 适配器与我们的后端 | 网页 | 差距与下一步 |
|---|---|---|---|---|---|
| antigravity | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| codex | · | · | ✓ session-control op=fork：Codex thread/fork，登记成新会话 n | ? /m/（10-18 深夜负责人）：会话页“更多 → 分叉”， | 自己做：做到前端 |
| claude | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| zcode | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| workbuddy | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| opencode | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| hermes | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |

## 压缩上下文（compact）

压缩会话记忆，腾出上下文。怎样算支持：上下文用量下降。类别：可选操作。

**理论上限**：原会话里压缩，编号不变（靠 平台的压缩命令）。根本限制：——。原生做不到时最多补齐到：自己写摘要，新建会话带上它，代价：新会话，原生记忆只剩摘要。

| 产品 | 桌面端界面 | 原生接口 | 适配器与我们的后端 | 网页 | 差距与下一步 |
|---|---|---|---|---|---|
| antigravity | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| codex | · | · | ✓ session-control op=compact：Codex thread/compact/st | ? /m/（10-18 深夜负责人）：会话页“更多 → 压缩上下 | 自己做：做到前端 |
| claude | · | · | ? session-control op=compact：发 / | ? /m/（10-18 深夜负责人）：会话页“更多 → 压缩上下 | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| zcode | · | · | ✓ session-control op=compact：Codex thread/compact/st | ✓ /m/（10-18 深夜负责人）：会话页“更多 → 压缩上下文” | 已到前端 |
| workbuddy | · | · | ? session-control op=compact：发 / | ? /m/（10-18 深夜负责人）：会话页“更多 → 压缩上下 | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| opencode | · | · | ? session-control op=compact：发 / | ? /m/（10-18 深夜负责人）：会话页“更多 → 压缩上下 | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| hermes | · | · | ? session-control op=compact：发 / | ? /m/（10-18 深夜负责人）：会话页“更多 → 压缩上下 | 派研究：原生接口没证实，按理论上限找入口或补齐 |

## 列模型（model-list）

拿到真实可用的模型列表。怎样算支持：列表与实际可用一致。类别：模型与模式（扩展）。

**理论上限**：拿到这家当前真实可用的模型（靠 平台的模型列表接口；ACP 握手里的可选模型）。根本限制：中转站和账号额度决定“可用”，列表接口可能列出用不了的。原生做不到时最多补齐到：本地配置文件里的模型表＋最近一次实际用到的模型，代价：不保证可用，要靠一次试调。

| 产品 | 桌面端界面 | 原生接口 | 适配器与我们的后端 | 网页 | 差距与下一步 |
|---|---|---|---|---|---|
| antigravity | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| codex | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| claude | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| zcode | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| workbuddy | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| opencode | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| hermes | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |

## 新建时选模型（model-new）

开会话时指定模型。怎样算支持：本地记录里这一轮的实际模型就是所选。类别：模型与模式（扩展）。

**理论上限**：新建会话就用指定模型（靠 新建会话的参数）。根本限制：平台忽略参数时做不到（10-17 实测 ZCode 原生命令行不认）。原生做不到时最多补齐到：新建后立即切模型；或改这家的默认模型配置，代价：后者影响全局，要用户同意。

| 产品 | 桌面端界面 | 原生接口 | 适配器与我们的后端 | 网页 | 差距与下一步 |
|---|---|---|---|---|---|
| antigravity | · | · | ✓ POST /api/gateway/send 带 model → codex app-server  | ✓ /m/：新任务的 flash / pro | 已到前端 |
| codex | · | · | ✓ POST /api/gateway/send 带 model → codex app-server  | · | 自己做：做到前端 |
| claude | · | · | ✓ POST /api/gateway/send 带 model → codex app-server  | · | 自己做：做到前端 |
| zcode | · | · | ✓ POST /api/gateway/send 带 model → codex app-server  | · | 自己做：做到前端 |
| workbuddy | · | · | ✓ POST /api/gateway/send 带 model → codex app-server  | · | 自己做：做到前端 |
| opencode | · | · | ✓ POST /api/gateway/send 带 model → codex app-server  | · | 自己做：做到前端 |
| hermes | · | · | ✓ POST /api/gateway/send 带 model → codex app-server  | · | 自己做：做到前端 |

## 中途切模型（model-switch）

会话中途换模型。怎样算支持：下一轮实际模型变了。类别：模型与模式（扩展）。

**理论上限**：下一轮换模型，会话不变（靠 平台的切模型接口）。根本限制：有的平台把模型绑在会话上。原生做不到时最多补齐到：分叉或新建会话时用新模型，代价：会话编号变了；跨供应商可能接不上。

| 产品 | 桌面端界面 | 原生接口 | 适配器与我们的后端 | 网页 | 差距与下一步 |
|---|---|---|---|---|---|
| antigravity | · | · | · | ◐ /m/ v2（10-18 负责人重写）：详情页“换模型”：下 | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| codex | · | · | ✓ POST /api/gateway/model 记下选择 → 下一句 acpx prompt --m | ◐ /m/ v2（10-18 负责人重写）：详情页“换模型”：下 | 自己做：做到前端 |
| claude | · | · | ✓ POST /api/gateway/model → claude 调 stream-json set | ◐ /m/ v2（10-18 负责人重写）：详情页“换模型”：下 | 自己做：做到前端 |
| zcode | · | · | ✓ 常驻 ACP 桥：会话热着立即 session/set_model（不认就 session/set_ | ◐ /m/ v2（10-18 负责人重写）：详情页“换模型”：下 | 自己做：做到前端 |
| workbuddy | · | · | ✓ 常驻 ACP 桥：会话热着立即 session/set_model（不认就 session/set_ | ◐ /m/ v2（10-18 负责人重写）：详情页“换模型”：下 | 自己做：做到前端 |
| opencode | · | · | ✓ 常驻 ACP 桥：会话热着立即 session/set_model（不认就 session/set_ | ◐ /m/ v2（10-18 负责人重写）：详情页“换模型”：下 | 自己做：做到前端 |
| hermes | · | · | ✓ 常驻 ACP 桥：会话热着立即 session/set_model（不认就 session/set_ | ◐ /m/ v2（10-18 负责人重写）：详情页“换模型”：下 | 自己做：做到前端 |

## 切模式（mode-switch）

新建时指定，或中途切换权限和工作模式（只读、计划、全放行等）（10-18 扩充定义）。怎样算支持：切换后行为随之改变。类别：模型与模式（扩展）。

**理论上限**：新建时或中途切权限和工作模式（靠 平台的模式接口（ACP `set_mode`、命令行参数））。根本限制：中途切要平台支持；模式只是平台的概念，外部无法替它执行。原生做不到时最多补齐到：新建时定死；或下一轮带着新参数恢复会话，代价：中途不能切；恢复会话会多一轮。

| 产品 | 桌面端界面 | 原生接口 | 适配器与我们的后端 | 网页 | 差距与下一步 |
|---|---|---|---|---|---|
| antigravity | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| codex | · | · | ✓ session-control op=mode：Codex 的协作模式 plan / default | ? /m/（10-18 深夜负责人）：会话页“更多 → 切模式” | 自己做：做到前端 |
| claude | · | · | ◐ 请求里的 permissions：reads / all / | ? /m/（10-18 深夜负责人）：会话页“更多 → 切模式” | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| zcode | · | · | ✓ session-control op=mode：常驻 ACP 桥 session/set_mode， | ? /m/（10-18 深夜负责人）：会话页“更多 → 切模式” | 自己做：做到前端 |
| workbuddy | · | · | ◐ 请求里的 permissions：reads / all / | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| opencode | · | · | ◐ 请求里的 permissions：reads / all / | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| hermes | · | · | ✓ session-control op=mode：常驻 ACP 桥 session/set_mode， | ? /m/（10-18 深夜负责人）：会话页“更多 → 切模式” | 自己做：做到前端 |

## 查额度（quota）

查整条渠道或账号池的剩余额度与窗口。怎样算支持：拿到剩余额度或窗口。类别：渠道级操作。

**理论上限**：剩余额度和窗口（靠 平台或供应商的额度接口）。根本限制：供应商没开放接口，就理论上拿不到余额。原生做不到时最多补齐到：本地累计用量 ＞ 被动的 403、429 信号，代价：只知道用了多少，不知道还剩多少。

| 产品 | 桌面端界面 | 原生接口 | 适配器与我们的后端 | 网页 | 差距与下一步 |
|---|---|---|---|---|---|
| antigravity | · | · | ◐ 命令行 agent_gateway.js quota（yin | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| codex | · | · | ◐ 命令行 agent_gateway.js quota（yin | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| claude | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| zcode | · | · | ◐ 产品表 quotaAccounts 写共用的额度账号（智谱  | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| workbuddy | · | · | ◐ 产品表 quotaAccounts 写共用的额度账号（智谱  | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| opencode | · | · | ◐ 产品表 quotaAccounts 写共用的额度账号（智谱  | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| hermes | · | · | ◐ 产品表 quotaAccounts 写共用的额度账号（智谱  | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |

## 按调用选渠道（channel-route）

只给这一次调用换中转或 key，全局配置不动。怎样算支持：请求确实走了指定渠道。类别：渠道级操作（扩展）。

**理论上限**：每次调用用指定的供应商（靠 单次覆盖参数）。根本限制：平台只读全局配置时做不到。原生做不到时最多补齐到：改全局配置（需要用户同意，会影响同一应用的所有会话），代价：影响面大，不能并发用不同渠道。

| 产品 | 桌面端界面 | 原生接口 | 适配器与我们的后端 | 网页 | 差距与下一步 |
|---|---|---|---|---|---|
| antigravity | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| codex | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| claude | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| zcode | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| workbuddy | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| opencode | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| hermes | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |

## 渠道健康与熔断（channel-health）

看到渠道可用性与最近失败类别，并能据此停用。怎样算支持：渠道出错时被标记并停止派活。类别：渠道级操作（扩展）。

**理论上限**：看到每条渠道可用性和最近失败类别，坏了自动停用（靠 中心自己记录的每次调用结果；供应商的状态接口）。根本限制：上游不报具体原因时只能看到现象（超时、5xx）。原生做不到时最多补齐到：中心按结果统计、连续失败就停用这条渠道，代价：判断有滞后；把偶发失败当坏渠道会误停。

| 产品 | 桌面端界面 | 原生接口 | 适配器与我们的后端 | 网页 | 差距与下一步 |
|---|---|---|---|---|---|
| antigravity | · | · | ◐ 每轮结束记到 channelFailures：连续 3 次失 | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| codex | · | · | ◐ 每轮结束记到 channelFailures：连续 3 次失 | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| claude | · | · | ◐ 每轮结束记到 channelFailures：连续 3 次失 | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| zcode | · | · | ◐ 每轮结束记到 channelFailures：连续 3 次失 | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| workbuddy | · | · | ◐ 每轮结束记到 channelFailures：连续 3 次失 | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| opencode | · | · | ◐ 每轮结束记到 channelFailures：连续 3 次失 | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| hermes | · | · | ◐ 每轮结束记到 channelFailures：连续 3 次失 | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |

## 守卫（guard）

开会话时带上的规则，到点自动生效（如工具调用前后的钩子、压缩后重新注入说明）。怎样算支持：规则在约定时机自动触发。类别：守卫。

**理论上限**：规则在每个检查点自动执行（调工具前后、压缩后）（靠 工具调用钩子；新建时的设置）。根本限制：没有钩子的平台无法在一轮中途执行规则。原生做不到时最多补齐到：中心在一轮结束时检查产出、违规就打回；靠系统提示词约束，代价：只能事后拦，不能事前防；提示词约束力弱。

| 产品 | 桌面端界面 | 原生接口 | 适配器与我们的后端 | 网页 | 差距与下一步 |
|---|---|---|---|---|---|
| antigravity | · | ✗ node channels/probe/scripts/an | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| codex | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| claude | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| zcode | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| workbuddy | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| opencode | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| hermes | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |

## 交付（act-deliver）

智能体交出产出，结束这一轮。怎样算支持：中心取到结构化产出。类别：智能体的动作。

**理论上限**：智能体明确交出产出、结束这一轮，外部能拿到产出和结束原因（靠 一轮结束、交回结果时）。根本限制：无根本限制。原生做不到时最多补齐到：——。

| 产品 | 桌面端界面 | 原生接口 | 适配器与我们的后端 | 网页 | 差距与下一步 |
|---|---|---|---|---|---|
| antigravity | · | ✓ node channels/probe/scripts/antigravity/run_agenta | ✓ 三条交回路：(1) 乙路 CLI `agent_gateway.js deliver --id <i | · | 自己做：做到前端 |
| codex | · | · | ✓ 三条交回路：(1) 乙路 CLI `agent_gateway.js deliver --id <i | · | 自己做：做到前端 |
| claude | · | · | ✓ 三条交回路：(1) 乙路 CLI `agent_gateway.js deliver --id <i | · | 自己做：做到前端 |
| zcode | · | · | ✓ 三条交回路：(1) 乙路 CLI `agent_gateway.js deliver --id <i | · | 自己做：做到前端 |
| workbuddy | · | · | ✓ 三条交回路：(1) 乙路 CLI `agent_gateway.js deliver --id <i | · | 自己做：做到前端 |
| opencode | · | · | ✓ 三条交回路：(1) 乙路 CLI `agent_gateway.js deliver --id <i | · | 自己做：做到前端 |
| hermes | · | · | ✓ 三条交回路：(1) 乙路 CLI `agent_gateway.js deliver --id <i | · | 自己做：做到前端 |

## 请求（act-request）

智能体要审批、资源或问别人。怎样算支持：中心收到请求并能答复。类别：智能体的动作。

**理论上限**：智能体要审批、资源或问别人时，外部收到结构化的请求（靠 请求审批时；它调用中心工具时）。根本限制：平台不把请求交给宿主时只能从文字里猜。原生做不到时最多补齐到：约定它调用中心的“请求”工具；或从回复文字里识别，代价：识别会漏会错。

| 产品 | 桌面端界面 | 原生接口 | 适配器与我们的后端 | 网页 | 差距与下一步 |
|---|---|---|---|---|---|
| antigravity | · | ✓ node channels/probe/scripts/antigravity/run_agenta | ✓ POST /api/gateway/collab-event (kind=request)：被派会话 | · | 自己做：做到前端 |
| codex | · | · | ✓ POST /api/gateway/collab-event (kind=request)：被派会话 | · | 自己做：做到前端 |
| claude | · | · | ✓ POST /api/gateway/collab-event (kind=request)：被派会话 | · | 自己做：做到前端 |
| zcode | · | · | ✓ POST /api/gateway/collab-event (kind=request)：被派会话 | · | 自己做：做到前端 |
| workbuddy | · | · | ✓ POST /api/gateway/collab-event (kind=request)：被派会话 | · | 自己做：做到前端 |
| opencode | · | · | ✓ POST /api/gateway/collab-event (kind=request)：被派会话 | · | 自己做：做到前端 |
| hermes | · | · | ✓ POST /api/gateway/collab-event (kind=request)：被派会话 | · | 自己做：做到前端 |

## 让出（act-yield）

智能体结束这一轮，写明在等什么。怎样算支持：中心读得到“在等什么”。类别：智能体的动作。

**理论上限**：结束这一轮并写明在等什么，外部读得到（靠 一轮结束时；平台的让出状态（Antigravity `not_fully_idle`））。根本限制：平台不记录“在等什么”就只能靠它自己写。原生做不到时最多补齐到：约定在回复里写“在等：…”或调用中心工具登记，代价：靠约定，智能体可能不照做。

| 产品 | 桌面端界面 | 原生接口 | 适配器与我们的后端 | 网页 | 差距与下一步 |
|---|---|---|---|---|---|
| antigravity | · | · | ✓ POST /api/gateway/collab-event（`agent_gateway.js y | · | 自己做：做到前端 |
| codex | · | · | ✓ POST /api/gateway/collab-event（`agent_gateway.js y | · | 自己做：做到前端 |
| claude | · | · | ✓ POST /api/gateway/collab-event（`agent_gateway.js y | · | 自己做：做到前端 |
| zcode | · | · | ✓ POST /api/gateway/collab-event（`agent_gateway.js y | · | 自己做：做到前端 |
| workbuddy | · | · | ✓ POST /api/gateway/collab-event（`agent_gateway.js y | · | 自己做：做到前端 |
| opencode | · | · | ✓ POST /api/gateway/collab-event（`agent_gateway.js y | · | 自己做：做到前端 |
| hermes | · | · | ✓ POST /api/gateway/collab-event（`agent_gateway.js y | · | 自己做：做到前端 |

## 上报（act-report）

智能体汇报进度或问题，自己继续。怎样算支持：中心收到且这一轮不中断。类别：智能体的动作。

**理论上限**：不结束这一轮，中途汇报进度或问题，外部实时收到（靠 事件流；它调用中心工具时）。根本限制：不调工具、不落盘的中途想法外部看不到。原生做不到时最多补齐到：跟随会话文件，从中间文字里读，代价：有延迟，分不清哪句是“上报”。

| 产品 | 桌面端界面 | 原生接口 | 适配器与我们的后端 | 网页 | 差距与下一步 |
|---|---|---|---|---|---|
| antigravity | · | ✓ node channels/probe/scripts/antigravity/run_agenta | ✓ POST /api/gateway/collab-event（`agent_gateway.js r | · | 自己做：做到前端 |
| codex | · | · | ✓ POST /api/gateway/collab-event（`agent_gateway.js r | · | 自己做：做到前端 |
| claude | · | · | ✓ POST /api/gateway/collab-event（`agent_gateway.js r | · | 自己做：做到前端 |
| zcode | · | · | ✓ POST /api/gateway/collab-event（`agent_gateway.js r | · | 自己做：做到前端 |
| workbuddy | · | · | ✓ POST /api/gateway/collab-event（`agent_gateway.js r | · | 自己做：做到前端 |
| opencode | · | · | ✓ POST /api/gateway/collab-event（`agent_gateway.js r | · | 自己做：做到前端 |
| hermes | · | · | ✓ POST /api/gateway/collab-event（`agent_gateway.js r | · | 自己做：做到前端 |

## 等待可见（wait-visible）

待命的两个属性外部可读：怎么进来的、在等什么。怎样算支持：中心读得到原因和在等什么。类别：待命的属性。

**理论上限**：待命的会话外部能读到“怎么进来的、在等什么”（靠 平台状态接口；会话记录）。根本限制：平台不记录就只能推断。原生做不到时最多补齐到：中心登记它让出时说的话；从记录推断，代价：推断会错，只能用来提示。

| 产品 | 桌面端界面 | 原生接口 | 适配器与我们的后端 | 网页 | 差距与下一步 |
|---|---|---|---|---|---|
| antigravity | · | · | ✓ GET /api/gateway/dispatches 返回 waitingEdges（谁派给谁、在 | · | 自己做：做到前端 |
| codex | · | · | ✓ GET /api/gateway/dispatches 返回 waitingEdges（谁派给谁、在 | · | 自己做：做到前端 |
| claude | · | · | ✓ GET /api/gateway/dispatches 返回 waitingEdges（谁派给谁、在 | ✓ /m/（10-18 晚负责人接手）：协作页：每张派活单的来去两端（链到会话）、任务、发出→送达→读到 | 已到前端 |
| zcode | · | · | ✓ GET /api/gateway/dispatches 返回 waitingEdges（谁派给谁、在 | ✓ /m/（10-18 晚负责人接手）：协作页：每张派活单的来去两端（链到会话）、任务、发出→送达→读到 | 已到前端 |
| workbuddy | · | · | ✓ GET /api/gateway/dispatches 返回 waitingEdges（谁派给谁、在 | · | 自己做：做到前端 |
| opencode | · | · | ✓ GET /api/gateway/dispatches 返回 waitingEdges（谁派给谁、在 | ✓ /m/（10-18 晚负责人接手）：协作页：每张派活单的来去两端（链到会话）、任务、发出→送达→读到 | 已到前端 |
| hermes | · | · | ✓ GET /api/gateway/dispatches 返回 waitingEdges（谁派给谁、在 | · | 自己做：做到前端 |

## 后台任务唤醒（wake-bg）

慢事放后台、先让出，结束后被叫醒并带着结果恢复会话。怎样算支持：不靠轮询被叫醒。类别：待命与唤醒（扩展）。

**理论上限**：慢事放后台、先让出，结束时带着结果恢复会话（靠 宿主托管后台任务）。根本限制：谁当宿主谁提供；宿主不在就没人叫醒。原生做不到时最多补齐到：中心当宿主：自己跑后台命令，结束后恢复会话并把结果送进去，代价：中心要常驻；后台命令要由中心执行。

| 产品 | 桌面端界面 | 原生接口 | 适配器与我们的后端 | 网页 | 差距与下一步 |
|---|---|---|---|---|---|
| antigravity | · | · | ✓ gateway.onRunFinalizedForDispatches + wakeCallerIf | · | 自己做：做到前端 |
| codex | · | · | ✓ gateway.onRunFinalizedForDispatches + wakeCallerIf | · | 自己做：做到前端 |
| claude | · | · | ✓ gateway.onRunFinalizedForDispatches + wakeCallerIf | · | 自己做：做到前端 |
| zcode | · | · | ✓ gateway.onRunFinalizedForDispatches + wakeCallerIf | · | 自己做：做到前端 |
| workbuddy | · | · | ✓ gateway.onRunFinalizedForDispatches + wakeCallerIf | · | 自己做：做到前端 |
| opencode | · | · | ✓ gateway.onRunFinalizedForDispatches + wakeCallerIf | · | 自己做：做到前端 |
| hermes | · | · | ✓ gateway.onRunFinalizedForDispatches + wakeCallerIf | · | 自己做：做到前端 |

## 定时唤醒（wake-timer）

约定时间或周期到点被叫醒。怎样算支持：到点自动恢复会话。类别：待命与唤醒（扩展）。

**理论上限**：约定时间或周期到点叫醒（靠 宿主的定时器）。根本限制：同上。原生做不到时最多补齐到：中心定时器到点恢复会话，代价：同上，且要持久化。

| 产品 | 桌面端界面 | 原生接口 | 适配器与我们的后端 | 网页 | 差距与下一步 |
|---|---|---|---|---|---|
| antigravity | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| codex | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| claude | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| zcode | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| workbuddy | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| opencode | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| hermes | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |

## 消息唤醒（wake-msg）

外部消息唤醒让出或待命中的会话。怎样算支持：消息一到会话就恢复。类别：待命与唤醒（扩展）。

**理论上限**：外部消息到了就叫醒让出或待命的会话（靠 一轮开始前（恢复会话）；步与步之间（运行中补充））。根本限制：无根本限制：任何会话都能被新一轮输入叫醒。原生做不到时最多补齐到：中心收到消息就恢复会话。

| 产品 | 桌面端界面 | 原生接口 | 适配器与我们的后端 | 网页 | 差距与下一步 |
|---|---|---|---|---|---|
| antigravity | · | · | ✓ 被派方调 deliver/yield 或同级消息送达时触发 processCallerWakes，若 | · | 自己做：做到前端 |
| codex | · | · | ✓ 被派方调 deliver/yield 或同级消息送达时触发 processCallerWakes，若 | · | 自己做：做到前端 |
| claude | · | · | ✓ 被派方调 deliver/yield 或同级消息送达时触发 processCallerWakes，若 | · | 自己做：做到前端 |
| zcode | · | · | ✓ 被派方调 deliver/yield 或同级消息送达时触发 processCallerWakes，若 | · | 自己做：做到前端 |
| workbuddy | · | · | ✓ 被派方调 deliver/yield 或同级消息送达时触发 processCallerWakes，若 | · | 自己做：做到前端 |
| opencode | · | · | ✓ 被派方调 deliver/yield 或同级消息送达时触发 processCallerWakes，若 | · | 自己做：做到前端 |
| hermes | · | · | ✓ 被派方调 deliver/yield 或同级消息送达时触发 processCallerWakes，若 | · | 自己做：做到前端 |

## 卡住可发现（wake-stall）

等的东西不来时有超时或能被外部发现。怎样算支持：卡住被标出，不永远挂着。类别：待命与唤醒（扩展）。

**理论上限**：等的东西不来、或一轮卡住时，外部能发现（靠 事件流超时；平台状态；会话文件修改时间）。根本限制：长命令和真卡住在外部看起来一样。原生做不到时最多补齐到：中心按“多久没动静”判卡住，结合进程是否还在，代价：会误判长任务为卡住。

| 产品 | 桌面端界面 | 原生接口 | 适配器与我们的后端 | 网页 | 差距与下一步 |
|---|---|---|---|---|---|
| antigravity | · | · | ✓ gateway.reconcileDispatches（巡检与启动恢复）：被派会话无活跃进程且超时未 | · | 自己做：做到前端 |
| codex | · | · | ✓ gateway.reconcileDispatches（巡检与启动恢复）：被派会话无活跃进程且超时未 | · | 自己做：做到前端 |
| claude | · | · | ✓ gateway.reconcileDispatches（巡检与启动恢复）：被派会话无活跃进程且超时未 | · | 自己做：做到前端 |
| zcode | · | · | ✓ gateway.reconcileDispatches（巡检与启动恢复）：被派会话无活跃进程且超时未 | · | 自己做：做到前端 |
| workbuddy | · | · | ✓ gateway.reconcileDispatches（巡检与启动恢复）：被派会话无活跃进程且超时未 | · | 自己做：做到前端 |
| opencode | · | · | ✓ gateway.reconcileDispatches（巡检与启动恢复）：被派会话无活跃进程且超时未 | · | 自己做：做到前端 |
| hermes | · | · | ✓ gateway.reconcileDispatches（巡检与启动恢复）：被派会话无活跃进程且超时未 | · | 自己做：做到前端 |

## 唤醒撑过重启（wake-persist）

保管等待的一方重启或关闭后，约好的唤醒还在。怎样算支持：重启后仍按时叫醒。类别：待命与唤醒（扩展）。

**理论上限**：等的东西一到就叫醒（靠 宿主保管等待）。根本限制：保管等待的宿主不在了，唤醒就没了。原生做不到时最多补齐到：由我们的中心当宿主，自己保管等待、到点恢复会话，代价：中心必须常驻且持久化。

| 产品 | 桌面端界面 | 原生接口 | 适配器与我们的后端 | 网页 | 差距与下一步 |
|---|---|---|---|---|---|
| antigravity | · | · | ✓ 派活单原子写盘 ~/.agent-hub/dispatches/<id>.json；8899 重启后 | · | 自己做：做到前端 |
| codex | · | · | ✓ 派活单原子写盘 ~/.agent-hub/dispatches/<id>.json；8899 重启后 | · | 自己做：做到前端 |
| claude | · | · | ✓ 派活单原子写盘 ~/.agent-hub/dispatches/<id>.json；8899 重启后 | · | 自己做：做到前端 |
| zcode | · | · | ✓ 派活单原子写盘 ~/.agent-hub/dispatches/<id>.json；8899 重启后 | · | 自己做：做到前端 |
| workbuddy | · | · | ✓ 派活单原子写盘 ~/.agent-hub/dispatches/<id>.json；8899 重启后 | · | 自己做：做到前端 |
| opencode | · | · | ✓ 派活单原子写盘 ~/.agent-hub/dispatches/<id>.json；8899 重启后 | · | 自己做：做到前端 |
| hermes | · | · | ✓ 派活单原子写盘 ~/.agent-hub/dispatches/<id>.json；8899 重启后 | · | 自己做：做到前端 |

## 派子智能体（spawn-subagent）

开出子智能体或子会话并拿回结果。怎样算支持：子会话可见且结果回到父会话。类别：团队协同（扩展）。

**理论上限**：开出子智能体、拿回结果，子会话可寻址（靠 平台的子智能体工具；或中心新建一个会话）。根本限制：子会话只在父进程内存里时外部看不到。原生做不到时最多补齐到：中心替它新建独立会话当“子智能体”，结果送回父会话，代价：父会话不知道这是它的子任务，要靠约定。

| 产品 | 桌面端界面 | 原生接口 | 适配器与我们的后端 | 网页 | 差距与下一步 |
|---|---|---|---|---|---|
| antigravity | · | · | ✓ POST /api/gateway/dispatch（agent_gateway.js dispat | ? /m/（10-18 晚负责人）：同上 | 自己做：做到前端 |
| codex | · | · | ✓ POST /api/gateway/dispatch（agent_gateway.js dispat | ? /m/（10-18 晚负责人）：同上 | 自己做：做到前端 |
| claude | · | · | ✓ POST /api/gateway/dispatch（agent_gateway.js dispat | ? /m/（10-18 晚负责人）：同上 | 自己做：做到前端 |
| zcode | · | · | ✓ POST /api/gateway/dispatch（agent_gateway.js dispat | ✓ /m/（10-18 晚负责人）：协作页“＋ 派活”（人派）和会话详情“派给别人”（从这个会话派，可勾 | 已到前端 |
| workbuddy | · | · | ✓ POST /api/gateway/dispatch（agent_gateway.js dispat | ? /m/（10-18 晚负责人）：同上 | 自己做：做到前端 |
| opencode | · | · | ✓ POST /api/gateway/dispatch（agent_gateway.js dispat | ? /m/（10-18 晚负责人）：同上 | 自己做：做到前端 |
| hermes | · | · | ✓ POST /api/gateway/dispatch（agent_gateway.js dispat | ? /m/（10-18 晚负责人）：同上 | 自己做：做到前端 |

## 智能体间发消息（peer-message）

一个会话给另一个会话发消息。怎样算支持：对方收到。类别：团队协同（扩展）。

**理论上限**：一个会话直接给另一个会话发消息，对方在合适时机收到（靠 平台的团队通信（Claude 团队、Codex `send_input`）；中心转发）。根本限制：跨家没有直接通道。原生做不到时最多补齐到：中心转发：读 A 的输出，作为输入发给 B，代价：有中心转发的延迟；发送方要约定格式。

| 产品 | 桌面端界面 | 原生接口 | 适配器与我们的后端 | 网页 | 差距与下一步 |
|---|---|---|---|---|---|
| antigravity | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| codex | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| claude | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| zcode | · | · | ✓ 智能体在终端里用 agent_gateway.js run --async + wait 给另一家派 | · | 自己做：做到前端 |
| workbuddy | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| opencode | · | · | ✓ 智能体在终端里用 agent_gateway.js run --async + wait 给另一家派 | · | 自己做：做到前端 |
| hermes | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |

## 交接（handoff）

把任务与上下文交给另一个会话继续，责任随之转移。怎样算支持：接手者从交接点继续。类别：团队协同（扩展）。

**理论上限**：任务和上下文完整转给另一个会话，责任随之转移（靠 平台的交接或分叉；中心）。根本限制：跨家没有原生交接；原生记忆带不走。原生做不到时最多补齐到：摘要＋关键文件，新建会话带上，代价：只带走摘要；这也是分叉、回退、压缩、切模型共同的兜底。

| 产品 | 桌面端界面 | 原生接口 | 适配器与我们的后端 | 网页 | 差距与下一步 |
|---|---|---|---|---|---|
| antigravity | · | · | ◐ POST /api/gateway/handoff：取最近几 | ✗假 /console/ 与首页抽屉：跨渠道接力、@提及接力（5 处） | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| codex | · | · | ◐ POST /api/gateway/handoff：取最近几 | ✗假 /console/ 与首页抽屉：跨渠道接力、@提及接力（5 处） | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| claude | · | · | ◐ POST /api/gateway/handoff：取最近几 | ✗假 /console/ 与首页抽屉：跨渠道接力、@提及接力（5 处） | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| zcode | · | · | ◐ POST /api/gateway/handoff：取最近几 | ✗假 /console/ 与首页抽屉：跨渠道接力、@提及接力（5 处） | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| workbuddy | · | · | ◐ POST /api/gateway/handoff：取最近几 | ✗假 /console/ 与首页抽屉：跨渠道接力、@提及接力（5 处） | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| opencode | · | · | ◐ POST /api/gateway/handoff：取最近几 | ✗假 /console/ 与首页抽屉：跨渠道接力、@提及接力（5 处） | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| hermes | · | · | ◐ POST /api/gateway/handoff：取最近几 | ✗假 /console/ 与首页抽屉：跨渠道接力、@提及接力（5 处） | 派研究：原生接口没证实，按理论上限找入口或补齐 |

## 共享任务板（task-board）

多个智能体读写同一份任务清单。怎样算支持：各方读到的是同一份。类别：团队协同（扩展）。

**理论上限**：多个智能体读写同一份任务清单，状态实时（靠 平台的任务工具（同一家内部）；共享文件）。根本限制：跨家没有共享任务工具。原生做不到时最多补齐到：中心提供任务板文件或中心工具，代价：并发写要中心加锁。

| 产品 | 桌面端界面 | 原生接口 | 适配器与我们的后端 | 网页 | 差距与下一步 |
|---|---|---|---|---|---|
| antigravity | · | · | ? POST /api/gateway/goals（agent_ | ? /m/（10-18 晚负责人）：协作页“目标”：＋ 目标（拆 | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| codex | · | · | ? POST /api/gateway/goals（agent_ | ? /m/（10-18 晚负责人）：协作页“目标”：＋ 目标（拆 | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| claude | · | · | ? POST /api/gateway/goals（agent_ | ? /m/（10-18 晚负责人）：协作页“目标”：＋ 目标（拆 | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| zcode | · | · | ✓ POST /api/gateway/goals（agent_gateway.js goal --fi | ✓ /m/（10-18 晚负责人）：协作页“目标”：＋ 目标（拆几件事、派给谁、要不要等上一件、谁验收、 | 已到前端 |
| workbuddy | · | · | ? POST /api/gateway/goals（agent_ | ? /m/（10-18 晚负责人）：协作页“目标”：＋ 目标（拆 | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| opencode | · | · | ✓ POST /api/gateway/goals（agent_gateway.js goal --fi | ? /m/（10-18 晚负责人）：协作页“目标”：＋ 目标（拆 | 自己做：做到前端 |
| hermes | · | · | ✓ POST /api/gateway/goals（agent_gateway.js goal --fi | ✓ /m/（10-18 晚负责人）：协作页“目标”：＋ 目标（拆几件事、派给谁、要不要等上一件、谁验收、 | 已到前端 |

## 向人提问（ask-user）

智能体中途向人提问并拿到回答。怎样算支持：问题到人，回答回到智能体。类别：人在环（扩展）。

**理论上限**：一轮中途问人、拿到回答继续（靠 平台的提问工具交给宿主（`ask_question`、AskUserQuestion））。根本限制：平台不把提问交给宿主时只能结束这一轮再问。原生做不到时最多补齐到：它在回复里提问、让出；人回答后恢复会话，代价：一轮被打断成两轮。

| 产品 | 桌面端界面 | 原生接口 | 适配器与我们的后端 | 网页 | 差距与下一步 |
|---|---|---|---|---|---|
| antigravity | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| codex | · | · | ✓ 智能体在一轮中途问人：问题挂成 pendingQuestions（/api/gateway/stat | · | 自己做：做到前端 |
| claude | · | · | ✓ 智能体在一轮中途问人：问题挂成 pendingQuestions（/api/gateway/stat | · | 自己做：做到前端 |
| zcode | · | · | ✓ 智能体在一轮中途问人：问题挂成 pendingQuestions（/api/gateway/stat | · | 自己做：做到前端 |
| workbuddy | · | · | ? 经 ACP 问不到：WorkBuddy 的 headless | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| opencode | · | · | ? 经 ACP 问不到：WorkBuddy 的 headless | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| hermes | · | · | ? 经 ACP 问不到：WorkBuddy 的 headless | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |

## 通知人（notify-user）

把消息推到人看得见的地方。怎样算支持：人在桌面或手机收到。类别：人在环（扩展）。

**理论上限**：消息推到人看得见的地方（手机、桌面通知）（靠 宿主的通知；中心推送）。根本限制：外部推送通道（https、企业微信等）要另外开通。原生做不到时最多补齐到：页面开着时提示、标题计数，代价：页面关着就收不到。

| 产品 | 桌面端界面 | 原生接口 | 适配器与我们的后端 | 网页 | 差距与下一步 |
|---|---|---|---|---|---|
| antigravity | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| codex | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| claude | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| zcode | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| workbuddy | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| opencode | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| hermes | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |

## 人中途插话（human-steer）

人在智能体自己的界面里，在一轮进行中插话。怎样算支持：智能体本轮内看到。类别：人在环（扩展）。

**理论上限**：人在智能体自己的界面里，一轮进行中插话（靠 步与步之间）。根本限制：同“插话”。原生做不到时最多补齐到：排到下一轮，代价：同“插话”的降级链。

| 产品 | 桌面端界面 | 原生接口 | 适配器与我们的后端 | 网页 | 差距与下一步 |
|---|---|---|---|---|---|
| antigravity | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| codex | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| claude | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| zcode | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| workbuddy | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| opencode | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| hermes | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |

## 产出物发布（artifact）

把文档、页面发布成人可打开的形式。怎样算支持：人能打开。类别：宿主环境（扩展）。

**理论上限**：产出（文档、页面、图）发布成人可打开的形式（靠 宿主的发布能力；文件）。根本限制：无根本限制：产出总落在文件里。原生做不到时最多补齐到：中心读会话写过的文件、在页面上打开，代价：只能看本机文件；分享给别人要另外发布。

| 产品 | 桌面端界面 | 原生接口 | 适配器与我们的后端 | 网页 | 差距与下一步 |
|---|---|---|---|---|---|
| antigravity | · | · | ✓ GET /api/sessions/<id>/files（会话工具参数和文字里提到的文件）；GET  | · | 自己做：做到前端 |
| codex | · | · | ✓ GET /api/sessions/<id>/files（会话工具参数和文字里提到的文件）；GET  | · | 自己做：做到前端 |
| claude | · | · | ✓ GET /api/sessions/<id>/files（会话工具参数和文字里提到的文件）；GET  | · | 自己做：做到前端 |
| zcode | · | · | ✓ GET /api/sessions/<id>/files（会话工具参数和文字里提到的文件）；GET  | · | 自己做：做到前端 |
| workbuddy | · | · | ✓ GET /api/sessions/<id>/files（会话工具参数和文字里提到的文件）；GET  | · | 自己做：做到前端 |
| opencode | · | · | ✓ GET /api/sessions/<id>/files（会话工具参数和文字里提到的文件）；GET  | · | 自己做：做到前端 |
| hermes | · | · | ✓ GET /api/sessions/<id>/files（会话工具参数和文字里提到的文件）；GET  | · | 自己做：做到前端 |
| gemini | · | · | ✓ GET /api/sessions/<id>/files（会话工具参数和文字里提到的文件）；GET  | · | 自己做：做到前端 |
| droid | · | · | ✓ GET /api/sessions/<id>/files（会话工具参数和文字里提到的文件）；GET  | · | 自己做：做到前端 |

## 浏览器（browser）

操作浏览器读写网页。怎样算支持：能读、能操作。类别：宿主环境（扩展）。

**理论上限**：智能体操作浏览器读写网页（靠 宿主或工具提供的浏览器）。根本限制：宿主不给浏览器就做不到。原生做不到时最多补齐到：中心挂一个浏览器工具（MCP），代价：要挂工具，见“挂接工具”。

| 产品 | 桌面端界面 | 原生接口 | 适配器与我们的后端 | 网页 | 差距与下一步 |
|---|---|---|---|---|---|
| antigravity | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| codex | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| claude | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| zcode | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| workbuddy | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| opencode | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| hermes | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |

## 终端（terminal）

执行命令并取回输出。怎样算支持：取回输出。类别：宿主环境（扩展）。

**理论上限**：执行命令并取回输出（靠 宿主的命令工具）。根本限制：权限模式不允许就不能。原生做不到时最多补齐到：——。

| 产品 | 桌面端界面 | 原生接口 | 适配器与我们的后端 | 网页 | 差距与下一步 |
|---|---|---|---|---|---|
| antigravity | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| codex | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| claude | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| zcode | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| workbuddy | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| opencode | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| hermes | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |

## 开发预览（dev-preview）

起本地服务并在预览里查看。怎样算支持：能看到页面。类别：宿主环境（扩展）。

**理论上限**：起本地服务并在预览里查看（靠 宿主的预览能力）。根本限制：宿主不提供预览窗口就只能自己开浏览器。原生做不到时最多补齐到：起服务后用浏览器工具或截图查看，代价：要浏览器工具。

| 产品 | 桌面端界面 | 原生接口 | 适配器与我们的后端 | 网页 | 差距与下一步 |
|---|---|---|---|---|---|
| antigravity | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| codex | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| claude | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| zcode | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| workbuddy | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| opencode | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| hermes | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |

## 挂接工具（mount-tools）

给会话挂上指定的工具和 MCP 服务（包括中心提供的工具），新建时挂上，或运行中增减。怎样算支持：会话里能调用挂上的工具，没挂的调不到。类别：新建时的配置（候选，10-18 推理补登）。

**理论上限**：新建时挂、运行中增减（靠 新建参数、MCP 工具变更通知）。根本限制：运行中增减要平台支持工具列表变更。原生做不到时最多补齐到：新建会话时挂好，代价：想加工具就得新开会话。

| 产品 | 桌面端界面 | 原生接口 | 适配器与我们的后端 | 网页 | 差距与下一步 |
|---|---|---|---|---|---|
| antigravity | · | ◐ cat ~/.gemini/config/mcp_confi | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| codex | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| claude | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| zcode | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| workbuddy | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| opencode | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| hermes | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |

## 设定角色说明（instructions）

给会话设定角色说明和做法（系统提示词）；新建后改不了。怎样算支持：回复体现了说明里的约束。类别：新建时的配置（候选，10-18 推理补登）。

**理论上限**：新建时设定（靠 新建会话的参数）。根本限制：新建以后改不了，这是系统提示词的性质，不是哪一家的缺陷。原生做不到时最多补齐到：工作目录里的说明文件 ＞ 写进第一轮输入 ＞ 中途用注入补充，代价：后几级的约束力变弱，可能被压缩掉。

| 产品 | 桌面端界面 | 原生接口 | 适配器与我们的后端 | 网页 | 差距与下一步 |
|---|---|---|---|---|---|
| antigravity | · | ✓ agentapi new-conversation --profile=... 或放置 GEMINI | · | · | 自己做：接进适配器 |
| codex | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| claude | · | · | ✓ gateway.startRunInternal：新建 Claude 会话时 acpx --appe | · | 自己做：做到前端 |
| zcode | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| workbuddy | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| opencode | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| hermes | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |

## 指定工作目录（workspace）

指定会话在哪个目录干活，或给它一个新的隔离目录。怎样算支持：智能体的文件操作落在指定目录。类别：新建时的配置（候选，10-18 推理补登）。

**理论上限**：指定会话在哪个目录干活，或给新的隔离目录（靠 新建会话的参数（cwd））。根本限制：有的平台把会话绑在启动目录。原生做不到时最多补齐到：在目标目录里启动它。

| 产品 | 桌面端界面 | 原生接口 | 适配器与我们的后端 | 网页 | 差距与下一步 |
|---|---|---|---|---|---|
| antigravity | · | ✓ agentapi get-conversation-metadata <cid> | ✓ 请求里的 cwd 或 __new__ → gateway.resolveSessionCwd（默认  | · | 自己做：做到前端 |
| codex | · | · | ✓ 请求里的 cwd 或 __new__ → gateway.resolveSessionCwd（默认  | · | 自己做：做到前端 |
| claude | · | · | ✓ 请求里的 cwd 或 __new__ → gateway.resolveSessionCwd（默认  | · | 自己做：做到前端 |
| zcode | · | · | ✓ 请求里的 cwd 或 __new__ → gateway.resolveSessionCwd（默认  | · | 自己做：做到前端 |
| workbuddy | · | · | ✓ 请求里的 cwd 或 __new__ → gateway.resolveSessionCwd（默认  | · | 自己做：做到前端 |
| opencode | · | · | ✓ 请求里的 cwd 或 __new__ → gateway.resolveSessionCwd（默认  | · | 自己做：做到前端 |
| hermes | · | · | ✓ 请求里的 cwd 或 __new__ → gateway.resolveSessionCwd（默认  | · | 自己做：做到前端 |

## 产出约定（output-contract）

规定这一轮产出要满足的格式（守卫的一种）。怎样算支持：交出的产出符合格式，不符合时被拦下或标出。类别：新建时的配置（候选，10-18 推理补登）。

**理论上限**：规定产出格式，不符合时被拦下（靠 守卫的检查点；结构化输出参数）。根本限制：平台没有结构化输出时只能事后检查。原生做不到时最多补齐到：中心在一轮结束时检查，不合格就打回重做，代价：多一轮。

| 产品 | 桌面端界面 | 原生接口 | 适配器与我们的后端 | 网页 | 差距与下一步 |
|---|---|---|---|---|---|
| antigravity | · | ◐ cat ~/.gemini/antigravity/buil | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| codex | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| claude | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| zcode | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| workbuddy | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| opencode | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| hermes | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |

## 只建不跑（open-idle）

建出会话、拿到编号，但不跑第一轮。怎样算支持：会话存在、编号可查、没有产生回复。类别：会话管理（候选，10-18 推理补登）。

**理论上限**：建出会话、拿到编号，不跑第一轮（靠 平台的新建接口（ACP `session/new`、`sessions ensure`））。根本限制：有的平台新建必须带第一句话（Antigravity `new-conversation`）。原生做不到时最多补齐到：第一句话发一个无害的说明，代价：多一轮、占一点额度。

| 产品 | 桌面端界面 | 原生接口 | 适配器与我们的后端 | 网页 | 差距与下一步 |
|---|---|---|---|---|---|
| antigravity | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| codex | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| claude | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| zcode | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| workbuddy | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| opencode | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| hermes | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |

## 命名与标注（label）

给会话起名、打标签，关联任务编号和运行编号。怎样算支持：按名字或标签查得到这个会话。类别：会话管理（候选，10-18 推理补登）。

**理论上限**：给会话起名、打标签，按名或标签查得到（靠 平台的命名字段（标题、name））。根本限制：平台不让改名时只能中心记。原生做不到时最多补齐到：中心登记名字和标签，代价：只有在中心里查得到。

| 产品 | 桌面端界面 | 原生接口 | 适配器与我们的后端 | 网页 | 差距与下一步 |
|---|---|---|---|---|---|
| antigravity | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| codex | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| claude | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| zcode | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| workbuddy | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| opencode | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| hermes | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |

## 所有权识别（ownership）

识别会话现在归谁：我们、应用、人在终端、已放手、不知道。怎样算支持：有可靠依据；推断只能用来禁止写入。类别：状态（候选，10-18 推理补登）。

**理论上限**：准确知道会话现在归谁（靠 平台的进程登记（如 `~/.claude/sessions`）、锁文件、宿主状态）。根本限制：别人的进程不报告时只能推断。原生做不到时最多补齐到：看进程登记、锁文件、修改时间推断，代价：推断只能用来禁止写入（《适配器模块设计》所有权五态）。

| 产品 | 桌面端界面 | 原生接口 | 适配器与我们的后端 | 网页 | 差距与下一步 |
|---|---|---|---|---|---|
| antigravity | · | · | ✓ server.buildPoint：按会话实时计算 entry（local-store/acpx/a | · | 自己做：做到前端 |
| codex | · | · | ✓ server.buildPoint：按会话实时计算 entry（local-store/acpx/a | · | 自己做：做到前端 |
| claude | · | · | ✓ server.buildPoint：按会话实时计算 entry（local-store/acpx/a | · | 自己做：做到前端 |
| zcode | · | · | ✓ server.buildPoint：按会话实时计算 entry（local-store/acpx/a | · | 自己做：做到前端 |
| workbuddy | · | · | ✓ server.buildPoint：按会话实时计算 entry（local-store/acpx/a | · | 自己做：做到前端 |
| opencode | · | · | ✓ server.buildPoint：按会话实时计算 entry（local-store/acpx/a | · | 自己做：做到前端 |
| hermes | · | · | ✓ server.buildPoint：按会话实时计算 entry（local-store/acpx/a | · | 自己做：做到前端 |
| gemini | · | · | ✓ server.buildPoint：按会话实时计算 entry（local-store/acpx/a | · | 自己做：做到前端 |
| droid | · | · | ✓ server.buildPoint：按会话实时计算 entry（local-store/acpx/a | · | 自己做：做到前端 |

## 列出会话（discover-sessions）

列出有哪些会话，包括别人开的和子会话。怎样算支持：列表和实际一致，不漏子会话。类别：观察（候选，10-18 推理补登）。

**理论上限**：本机所有会话（含别人开的、子会话）都列得出来，和实际一致（靠 平台的索引库、会话文件目录）。根本限制：记录文件被平台删掉的只剩索引（Codex 10-18 有 1157 条）。原生做不到时最多补齐到：读索引列出、标明“记录已不在”，代价：打不开内容。

| 产品 | 桌面端界面 | 原生接口 | 适配器与我们的后端 | 网页 | 差距与下一步 |
|---|---|---|---|---|---|
| antigravity | · | · | ✓ GET /api/sessions（只读旁路扫描本机各家会话，1000 多个）；GET /api/m | ✓ /m/ v2（10-18 负责人重写）：首页：本机全部会话（/api/sessions?slim=1 | 已到前端 |
| codex | · | · | ✓ GET /api/sessions（只读旁路扫描本机各家会话，1000 多个）；GET /api/m | ✓ /m/ v2（10-18 负责人重写）：首页：本机全部会话（/api/sessions?slim=1 | 已到前端 |
| claude | · | · | ✓ GET /api/sessions（只读旁路扫描本机各家会话，1000 多个）；GET /api/m | ✓ /m/ v2（10-18 负责人重写）：首页：本机全部会话（/api/sessions?slim=1 | 已到前端 |
| zcode | · | · | ✓ GET /api/sessions（只读旁路扫描本机各家会话，1000 多个）；GET /api/m | ✓ /m/ v2（10-18 负责人重写）：首页：本机全部会话（/api/sessions?slim=1 | 已到前端 |
| workbuddy | · | · | ✓ GET /api/sessions（只读旁路扫描本机各家会话，1000 多个）；GET /api/m | ✓ /m/ v2（10-18 负责人重写）：首页：本机全部会话（/api/sessions?slim=1 | 已到前端 |
| opencode | · | · | ✓ GET /api/sessions（只读旁路扫描本机各家会话，1000 多个）；GET /api/m | ✓ /m/ v2（10-18 负责人重写）：首页：本机全部会话（/api/sessions?slim=1 | 已到前端 |
| hermes | · | · | ✓ GET /api/sessions（只读旁路扫描本机各家会话，1000 多个）；GET /api/m | ✓ /m/ v2（10-18 负责人重写）：首页：本机全部会话（/api/sessions?slim=1 | 已到前端 |
| gemini | · | · | ✓ GET /api/sessions（只读旁路扫描本机各家会话，1000 多个）；GET /api/m | ✓ /m/ v2（10-18 负责人重写）：首页：本机全部会话（/api/sessions?slim=1 | 已到前端 |
| droid | · | · | ✓ GET /api/sessions（只读旁路扫描本机各家会话，1000 多个）；GET /api/m | ✓ /m/ v2（10-18 负责人重写）：首页：本机全部会话（/api/sessions?slim=1 | 已到前端 |

## 探测本机（probe-host）

查本机装了哪几家、版本、登录状态、协议版本，并读各家对自己能力的自述（A2A 的智能体名片、ACP 握手声明）。怎样算支持：结果和实际一致；版本写进每条能力标记。类别：渠道级操作（候选，10-18 推理补登）。

**理论上限**：知道装了哪几家、版本、登录状态、协议版本、能力自述（靠 命令行的版本和状态命令；ACP 握手；配置文件）。根本限制：登录状态有的只在应用内存里。原生做不到时最多补齐到：试调一次判断能不能用，代价：试调要花一次调用。

| 产品 | 桌面端界面 | 原生接口 | 适配器与我们的后端 | 网页 | 差距与下一步 |
|---|---|---|---|---|---|
| antigravity | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| codex | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| claude | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| zcode | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| workbuddy | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| opencode | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| hermes | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |

## 并发容量（capacity）

一家或一条渠道能同时跑几个、现在占了几个。怎样算支持：读得到上限和当前占用。类别：渠道级状态（候选，10-18 推理补登）。

**理论上限**：知道一家或一条渠道能同时跑几个、现在占了几个（靠 平台或供应商的限额接口）。根本限制：供应商不公开上限时只能试出来。原生做不到时最多补齐到：中心按 429 等信号自己估，代价：估值滞后。

| 产品 | 桌面端界面 | 原生接口 | 适配器与我们的后端 | 网页 | 差距与下一步 |
|---|---|---|---|---|---|
| antigravity | · | · | ◐ 中心自己数：每家在跑几轮（自己发的 activeRuns，加 | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| codex | · | · | ◐ 中心自己数：每家在跑几轮（自己发的 activeRuns，加 | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| claude | · | · | ◐ 中心自己数：每家在跑几轮（自己发的 activeRuns，加 | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| zcode | · | · | ◐ 中心自己数：每家在跑几轮（自己发的 activeRuns，加 | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| workbuddy | · | · | ◐ 中心自己数：每家在跑几轮（自己发的 activeRuns，加 | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| opencode | · | · | ◐ 中心自己数：每家在跑几轮（自己发的 activeRuns，加 | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| hermes | · | · | ◐ 中心自己数：每家在跑几轮（自己发的 activeRuns，加 | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |

## 回退到某一步（rewind）

让原会话就地退回到某一步，可选连文件改动一起退（分叉是复制，回退是就地改）。怎样算支持：退回后会话不记得之后的内容；选了连文件退时文件也恢复。类别：可选操作（候选，10-18 推理补登）。

**理论上限**：原会话就地退回（靠 平台的回滚接口或检查点）。根本限制：同上。原生做不到时最多补齐到：分叉到那一步再继续，把原会话放到一边，代价：会话编号变了。

| 产品 | 桌面端界面 | 原生接口 | 适配器与我们的后端 | 网页 | 差距与下一步 |
|---|---|---|---|---|---|
| antigravity | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| codex | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| claude | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| zcode | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| workbuddy | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| opencode | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| hermes | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |

## 归档与取回（archive）

把关闭的会话收起，需要时取回。怎样算支持：归档后不在活动列表，取回后能恢复会话。类别：会话管理（候选，10-18 推理补登）。

**理论上限**：关闭的会话收起，需要时取回继续（靠 平台的归档接口（Codex `archived`））。根本限制：取回要平台支持（Codex 10-18 对归档会话发话被拒，要先取消归档）。原生做不到时最多补齐到：中心只在自己的列表里隐藏，代价：平台里没真正归档。

| 产品 | 桌面端界面 | 原生接口 | 适配器与我们的后端 | 网页 | 差距与下一步 |
|---|---|---|---|---|---|
| antigravity | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| codex | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| claude | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| zcode | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| workbuddy | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| opencode | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| hermes | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |

## 删除会话（delete）

永久删除会话记录；每次都要人批准。怎样算支持：记录不复存在。类别：会话管理（候选，10-18 推理补登）。

**理论上限**：永久删除会话记录（靠 平台的删除接口；删文件）。根本限制：删除不可恢复，每次要人批准。原生做不到时最多补齐到：删本地记录文件，代价：平台索引可能残留。

| 产品 | 桌面端界面 | 原生接口 | 适配器与我们的后端 | 网页 | 差距与下一步 |
|---|---|---|---|---|---|
| antigravity | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| codex | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| claude | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| zcode | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| workbuddy | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| opencode | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| hermes | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |

## 交给人接手（handover-human）

把会话在它自己的应用里打开，人接着做。怎样算支持：人在原应用里看到并能继续这个会话。类别：人在环（候选，10-18 推理补登）。

**理论上限**：在它自己的应用里打开这个会话，人接着做（靠 应用的“打开会话”深链或命令（如 `claude --resume <编号>`））。根本限制：应用不支持按编号打开时做不到。原生做不到时最多补齐到：告诉人编号和打开方法，代价：要人自己操作。

| 产品 | 桌面端界面 | 原生接口 | 适配器与我们的后端 | 网页 | 差距与下一步 |
|---|---|---|---|---|---|
| antigravity | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| codex | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| claude | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| zcode | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| workbuddy | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| opencode | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| hermes | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |

## 回收（reclaim）

停掉某个实例、放手它的会话、把任务退回（拉起的反向）。怎样算支持：实例停下、会话放手、任务回到可派状态。类别：团队协同（候选，10-18 推理补登）。

**理论上限**：停掉某个实例、放手它的会话、把任务退回（靠 打断＋关闭＋中心台账）。根本限制：别人持有的会话只能放手，不能停。原生做不到时最多补齐到：中心标为已放手、任务退回队列，代价：进程可能还在跑。

| 产品 | 桌面端界面 | 原生接口 | 适配器与我们的后端 | 网页 | 差距与下一步 |
|---|---|---|---|---|---|
| antigravity | · | · | ✓ POST /api/gateway/collab-event（`agent_gateway.js r | · | 自己做：做到前端 |
| codex | · | · | ✓ POST /api/gateway/collab-event（`agent_gateway.js r | · | 自己做：做到前端 |
| claude | · | · | ✓ POST /api/gateway/collab-event（`agent_gateway.js r | · | 自己做：做到前端 |
| zcode | · | · | ✓ POST /api/gateway/collab-event（`agent_gateway.js r | · | 自己做：做到前端 |
| workbuddy | · | · | ✓ POST /api/gateway/collab-event（`agent_gateway.js r | · | 自己做：做到前端 |
| opencode | · | · | ✓ POST /api/gateway/collab-event（`agent_gateway.js r | · | 自己做：做到前端 |
| hermes | · | · | ✓ POST /api/gateway/collab-event（`agent_gateway.js r | · | 自己做：做到前端 |

## 可用命令清单（cmd-list）

读到智能体当前可用的斜杠命令（名称、说明、参数）。怎样算支持：读到的清单和实际可用的一致。类别：观察（候选，10-18 外部对照补登）。

**理论上限**：读到它当前可用的斜杠命令（靠 ACP `available_commands_update`；应用的命令目录）。根本限制：平台不广播就只能读配置目录。原生做不到时最多补齐到：读命令目录和技能目录，代价：和实际可用的可能不一致。

| 产品 | 桌面端界面 | 原生接口 | 适配器与我们的后端 | 网页 | 差距与下一步 |
|---|---|---|---|---|---|
| antigravity | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| codex | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| claude | · | · | ? session-control op=commands：常驻 | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| zcode | · | · | ✓ session-control op=commands：常驻 ACP 桥记下智能体在 session | · | 自己做：做到前端 |
| workbuddy | · | · | ✓ session-control op=commands：常驻 ACP 桥记下智能体在 session | · | 自己做：做到前端 |
| opencode | · | · | ✓ session-control op=commands：常驻 ACP 桥记下智能体在 session | · | 自己做：做到前端 |
| hermes | · | · | ✓ session-control op=commands：常驻 ACP 桥记下智能体在 session | · | 自己做：做到前端 |

## 借道采样（sampling）

工具或子智能体自己没有模型渠道时，反过来请宿主代它调用模型，计入宿主的账。怎样算支持：请求按宿主的渠道完成并记账。类别：渠道级操作（候选，10-18 外部对照补登）。

**理论上限**：工具或子智能体请宿主代它调模型（靠 MCP `sampling/createMessage`）。根本限制：宿主不实现采样就做不到。原生做不到时最多补齐到：工具自己带模型渠道，代价：要给工具单独配 key。

| 产品 | 桌面端界面 | 原生接口 | 适配器与我们的后端 | 网页 | 差距与下一步 |
|---|---|---|---|---|---|
| antigravity | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| codex | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| claude | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| zcode | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| workbuddy | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| opencode | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| hermes | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |

## 记忆开关（memory-mode）

指定会话读不读、写不写跨会话的长期记忆。怎样算支持：关掉写入后，会话结束时长期记忆没有变化。类别：新建时的配置（候选，10-18 外部对照补登）。

**理论上限**：指定读不读、写不写跨会话记忆（靠 新建会话的设置（设置源、记忆目录））。根本限制：平台把记忆和其他设置绑在一起时开关会连带别的（10-18：Claude 开用户设置会连带载入 agents）。原生做不到时最多补齐到：换工作目录或配置目录隔离，代价：隔离会连技能等一起隔掉。

| 产品 | 桌面端界面 | 原生接口 | 适配器与我们的后端 | 网页 | 差距与下一步 |
|---|---|---|---|---|---|
| antigravity | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| codex | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| claude | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| zcode | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| workbuddy | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| opencode | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| hermes | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |

## 循环熔断（loop-guard）

发现智能体反复做同一个失败动作时，先提醒它换思路，仍重复就打断这一轮，并记下“因循环停下”。怎样算支持：重复到设定次数时被拦下，状态里看得到原因。类别：守卫（候选，10-18 失败倒推补登）。

**理论上限**：发现反复做同一个失败动作就提醒、仍重复就打断（靠 工具调用钩子；事件流）。根本限制：没有钩子时只能看事件流事后发现。原生做不到时最多补齐到：中心看事件流，同一工具同一参数失败 N 次就打断，代价：要实时事件流；判断有误。

| 产品 | 桌面端界面 | 原生接口 | 适配器与我们的后端 | 网页 | 差距与下一步 |
|---|---|---|---|---|---|
| antigravity | · | ◐ node channels/probe/scripts/an | ◐ 中心在“一群会话”这一级熔断：返工后交回和上次几乎一样（相似 | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| codex | · | · | ◐ 中心在“一群会话”这一级熔断：返工后交回和上次几乎一样（相似 | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| claude | · | · | ◐ 中心在“一群会话”这一级熔断：返工后交回和上次几乎一样（相似 | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| zcode | · | · | ◐ 中心在“一群会话”这一级熔断：返工后交回和上次几乎一样（相似 | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| workbuddy | · | · | ◐ 中心在“一群会话”这一级熔断：返工后交回和上次几乎一样（相似 | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| opencode | · | · | ◐ 中心在“一群会话”这一级熔断：返工后交回和上次几乎一样（相似 | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| hermes | · | · | ◐ 中心在“一群会话”这一级熔断：返工后交回和上次几乎一样（相似 | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |

## 渠道租约（channel-lease）

调用有并发或频次上限的渠道前先拿租约，超出上限就排队，持有者崩溃后租约到时自动释放。怎样算支持：多个调用方同时来时按上限依次放行，不触发限流。类别：渠道级操作（候选，10-18 失败倒推补登）。

**理论上限**：调用有并发或频次上限的渠道前先拿租约，超限排队，持有者崩溃后自动释放（靠 中心（各家自己不做跨进程租约））。根本限制：绕过中心直接调的无法管住。原生做不到时最多补齐到：中心统一发起调用、持有租约，代价：只管得住经中心的调用。

| 产品 | 桌面端界面 | 原生接口 | 适配器与我们的后端 | 网页 | 差距与下一步 |
|---|---|---|---|---|---|
| antigravity | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| codex | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| claude | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| zcode | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| workbuddy | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| opencode | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| hermes | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |

## 宿主排空（host-drain）

让一个宿主（网关、守护进程）停止接新活、等在跑的轮次做完再退出，新活暂存。怎样算支持：排空期间在跑的轮次都正常结束，新活不丢。类别：宿主级操作（候选，10-18 失败倒推补登）。

**理论上限**：宿主停止接新活、等在跑的做完再退出，新活暂存（靠 中心（我们的服务）自己）。根本限制：别家的宿主只能经它们的接口。原生做不到时最多补齐到：中心停发新活、等在跑的轮次结束，代价：等待时间不可控。

| 产品 | 桌面端界面 | 原生接口 | 适配器与我们的后端 | 网页 | 差距与下一步 |
|---|---|---|---|---|---|
| antigravity | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| codex | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| claude | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| zcode | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| workbuddy | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| opencode | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| hermes | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |

## 权限作用域（permission-scope）

按目录分级给权限：智能体自己的数据目录总是放行，工作目录按模式，工作目录以外的敏感位置一律要审批。怎样算支持：只读模式下智能体能写自己的记忆文件，越界写入被拦下等审批。类别：守卫（候选，10-18 失败倒推补登）。

**理论上限**：按目录分级给权限：自己的数据目录放行、工作目录按模式、目录外要审批（靠 平台的权限规则（设置文件、ACP 审批回调））。根本限制：平台只有粗粒度模式时做不到按目录。原生做不到时最多补齐到：中心在审批回调里按路径判断，代价：需要能拿到审批回调（P3）。

| 产品 | 桌面端界面 | 原生接口 | 适配器与我们的后端 | 网页 | 差距与下一步 |
|---|---|---|---|---|---|
| antigravity | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| codex | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| claude | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| zcode | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| workbuddy | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| opencode | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| hermes | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |

## 读原生会话元数据（native-meta）

读各家应用自己记的会话元数据：应用里显示的名字、项目、置顶、分组、归档、未读、分支。怎样算支持：读出的和应用窗口里显示的一致。类别：观察（候选，10-18 体验反推补登）。

**理论上限**：读到各产品本地存储中记录的所有非加密元数据（原生标题、首尾时间戳、模型名称、token用量统计、置顶与归档状态）（靠 本地数据库或 JSON/JSONL 会话元数据文件（只读冷旁路，随时可读））。根本限制：平台未落盘字段（仅保留在内存运行时）外部无法读到；加密或专有二进制格式无法解析。原生做不到时最多补齐到：中心在首次加载与后续交互中建立元数据台账与缓存（根据会话内容反推标题、根据转录推算时间与统计），代价：中心维护额外存储；对原生应用外部独立产生的变更存在检测与轮询延迟。

| 产品 | 桌面端界面 | 原生接口 | 适配器与我们的后端 | 网页 | 差距与下一步 |
|---|---|---|---|---|---|
| antigravity | · | · | ✓ 会话列表和详情带原生的标题、工作目录、模型、起止时间、状态 | · | 自己做：做到前端 |
| codex | · | · | ✓ 会话列表和详情带原生的标题、工作目录、模型、起止时间、状态 | · | 自己做：做到前端 |
| claude | · | · | ✓ 会话列表和详情带原生的标题、工作目录、模型、起止时间、状态 | · | 自己做：做到前端 |
| zcode | · | · | ✓ 会话列表和详情带原生的标题、工作目录、模型、起止时间、状态 | · | 自己做：做到前端 |
| workbuddy | · | · | ✓ 会话列表和详情带原生的标题、工作目录、模型、起止时间、状态 | · | 自己做：做到前端 |
| opencode | · | · | ✓ 会话列表和详情带原生的标题、工作目录、模型、起止时间、状态 | · | 自己做：做到前端 |
| hermes | · | · | ✓ 会话列表和详情带原生的标题、工作目录、模型、起止时间、状态 | · | 自己做：做到前端 |

## 全文检索（content-search）

按内容在全部会话的每一步里找，返回会话、轮次和片段。怎样算支持：搜一个词，能找到它出现的会话和位置。类别：观察（候选，10-18 体验反推补登）。

**理论上限**：毫秒级跨全量历史会话（覆盖所有产品的 user/assistant 消息、思考过程、工具调用参数与结果）执行关键词或语义全文检索（靠 各产品落盘会话文件 ＋ 中心的后台离线/增量全文索引器（GET /api/search））。根本限制：未落盘的流式中间态搜不到；未同步到本机的云端会话搜不到。原生做不到时最多补齐到：中心统一扫描各产品本地存储构建倒排索引或正则扫描（跨产品搜索始终由中心当宿主），代价：建立索引消耗本地磁盘空间与后台算力；会话刚写入时存在短暂索引延迟。

| 产品 | 桌面端界面 | 原生接口 | 适配器与我们的后端 | 网页 | 差距与下一步 |
|---|---|---|---|---|---|
| antigravity | · | · | ✓ GET /api/search?q=（agent_gateway.js search）：SQLite | · | 自己做：做到前端 |
| codex | · | · | ✓ GET /api/search?q=（agent_gateway.js search）：SQLite | · | 自己做：做到前端 |
| claude | · | · | ✓ GET /api/search?q=（agent_gateway.js search）：SQLite | · | 自己做：做到前端 |
| zcode | · | · | ✓ GET /api/search?q=（agent_gateway.js search）：SQLite | · | 自己做：做到前端 |
| workbuddy | · | · | ✓ GET /api/search?q=（agent_gateway.js search）：SQLite | · | 自己做：做到前端 |
| opencode | · | · | ✓ GET /api/search?q=（agent_gateway.js search）：SQLite | · | 自己做：做到前端 |
| hermes | · | · | ✓ GET /api/search?q=（agent_gateway.js search）：SQLite | · | 自己做：做到前端 |

## 上下文占用（context-usage）

读出会话当前上下文用了多少、离上限还有多远。怎样算支持：数字和应用里显示的一致。类别：状态（候选，10-18 体验反推补登）。

**理论上限**：每一步/每一轮结束后精确掌握当前会话在模型上下文窗口中的占用量（已用 tokens、窗口上限、剩余比例、溢出风险）（靠 模型 API 响应头的 usage 字段、ACP 流式元数据、会话转录中的 tokens 记录）。根本限制：部分产品或模型 API 不透传 prompt_tokens；一轮执行中途流式生成时无法提前确定最终占用总量。原生做不到时最多补齐到：中心按该模型的 tokenizer（如 cl100k/tiktoken）对历史全量上下文与系统提示词进行本地离线分词估算，代价：本地分词计算消耗少量 CPU；估算值与服务端实际模板截断存在微小偏差（1%~5%）。

| 产品 | 桌面端界面 | 原生接口 | 适配器与我们的后端 | 网页 | 差距与下一步 |
|---|---|---|---|---|---|
| antigravity | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| codex | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| claude | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| zcode | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| workbuddy | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| opencode | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| hermes | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |

## 推理力度（reasoning-effort）

新建或中途设定模型的推理力度（思考深度）。怎样算支持：设了之后实际推理按这一档。类别：模型与模式（候选，10-18 体验反推补登）。

**理论上限**：新建会话或发起单轮请求时，按需精确指定当前轮的思考 token 预算或推理强度级别（low/medium/high）（靠 一轮开始前的请求参数构造点（模型 payload 中的 reasoning_effort 或 thinking budget 参数））。根本限制：非推理类模型架构不支持；部分客户端将推理预算硬编码在内部逻辑中，不开放外部参数接口。原生做不到时最多补齐到：在模型渠道映射中通过后缀子模型选择（如 o3-mini-high）；或在系统提示词中注入强约束显式引导深度思考，代价：提示词引导不如模型级 API 严格可控，且会占用部分输入与输出 token 预算。

| 产品 | 桌面端界面 | 原生接口 | 适配器与我们的后端 | 网页 | 差距与下一步 |
|---|---|---|---|---|---|
| antigravity | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| codex | · | · | ✓ session-control op=effort：Codex thread/settings/up | ? /m/（10-18 深夜负责人）：会话页“更多 → 推理力度 | 自己做：做到前端 |
| claude | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| zcode | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| workbuddy | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| opencode | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| hermes | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |

## 列项目（list-projects）

列出这一家应用登记的项目或工作区。怎样算支持：列表和应用里的项目一致。类别：观察（候选，10-18 体验反推补登）。

**理论上限**：实时呈现本机全部跨产品智能体关联的代码仓库与工作目录清单，精确关联并归集各项目下的所有历史会话与活跃状态（靠 中心会话扫描与聚合器（GET /api/sessions?slim=1，经 server.nativeProject 路径归一算法））。根本限制：会话若未记录有效 cwd、或仅在内存中临时运行未留盘，无法反向关联至具体项目。原生做不到时最多补齐到：中心扫描所有会话的 working directory 并向上追溯 Git 根目录，建立跨产品统一项目注册表，代价：首次多路径深度遍历与 Git 根检测有一过性 I/O 消耗（需结合中心项目缓存）。

| 产品 | 桌面端界面 | 原生接口 | 适配器与我们的后端 | 网页 | 差距与下一步 |
|---|---|---|---|---|---|
| antigravity | · | · | ✓ GET /api/sessions?slim=1 每个会话带 project（工作目录）；网页“项目 | · | 自己做：做到前端 |
| codex | · | · | ✓ GET /api/sessions?slim=1 每个会话带 project（工作目录）；网页“项目 | · | 自己做：做到前端 |
| claude | · | · | ✓ GET /api/sessions?slim=1 每个会话带 project（工作目录）；网页“项目 | · | 自己做：做到前端 |
| zcode | · | · | ✓ GET /api/sessions?slim=1 每个会话带 project（工作目录）；网页“项目 | · | 自己做：做到前端 |
| workbuddy | · | · | ✓ GET /api/sessions?slim=1 每个会话带 project（工作目录）；网页“项目 | · | 自己做：做到前端 |
| opencode | · | · | ✓ GET /api/sessions?slim=1 每个会话带 project（工作目录）；网页“项目 | · | 自己做：做到前端 |
| hermes | · | · | ✓ GET /api/sessions?slim=1 每个会话带 project（工作目录）；网页“项目 | · | 自己做：做到前端 |

## 列工作区文件（workspace-files）

列出会话工作目录里的文件，供引用。怎样算支持：列出的文件和目录里实际一致。类别：观察（候选，10-18 体验反推补登）。

**理论上限**：完整获取指定会话或项目工作目录下的文件树与结构，支持模式过滤与忽略规则，在安全沙箱内提供文件清单（靠 宿主本地文件系统接口（fs.readdir、git ls-files）或智能体工作区工具）。根本限制：远程容器内或无盘沙箱内运行、且未映射至本地文件系统的工作区，宿主外部无法直接枚举。原生做不到时最多补齐到：中心提供工作区安全枚举端点（带深度限制与路径边界白名单），或调用智能体内部的文件列表工具，代价：深度遍历大目录消耗磁盘 I/O；必须设立目录白名单以防任意路径遍历风险。

| 产品 | 桌面端界面 | 原生接口 | 适配器与我们的后端 | 网页 | 差距与下一步 |
|---|---|---|---|---|---|
| antigravity | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| codex | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| claude | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| zcode | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| workbuddy | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| opencode | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| hermes | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |

## 写回原生元数据（native-meta-write）

把改名、置顶、分组、归档写回应用自己的存储。怎样算支持：改完后应用窗口里看到同样的变化。类别：会话管理（候选，10-18 体验反推补登）。

**理论上限**：外部修改（重命名标题、打标签、置顶、归档）能够直接持久化写入各产品自己的原生存储，桌面应用刷新/重聚焦时原生同步可见（靠 原生 CLI/API 修改接口（如 Codex thread/name/set），或在会话静止非独占时的本地 SQLite/JSON 写入）。根本限制：原生应用持有独占文件锁、或仅在内存中缓存状态且不监听文件变更时，外部写入会被原生应用覆盖或需重启桌面端。原生做不到时最多补齐到：中心在自己的会话元数据注册表（如 server.ts bindings / titles）中覆盖别名与标签，优先向网页和网关呈现，代价：中心别名仅在中心界面生效，原生桌面端界面内依然显示原旧名称。

| 产品 | 桌面端界面 | 原生接口 | 适配器与我们的后端 | 网页 | 差距与下一步 |
|---|---|---|---|---|---|
| antigravity | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| codex | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| claude | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| zcode | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| workbuddy | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| opencode | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| hermes | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |

## 原生应用同步可见（app-sync）

外部对一个会话的发话和变化，在这一家自己的应用窗口里也看得到（反过来也一样）。怎样算支持：网页发一句，桌面端那个会话窗口里几秒内出现。类别：观察（候选，10-18 体验反推补登）。

**理论上限**：外部（中心/网页/命令行）发起的每一轮消息推进与工具产出，在原生桌面端应用窗口中实时、无闪烁同步渲染呈现（靠 各产品桌面端与其底层引擎通信的统一 IPC/RPC 协议通道（如 Codex app-server，Antigravity agentapi））。根本限制：桌面客户端被设计为独立运行、独占会话且不热重载本地存储（只在启动时加载）时，外部推进在桌面端无法实时反映。原生做不到时最多补齐到：人在桌面端通过切换会话/重选列表触发就地重载，或由中心借助 CDP/OpenCLI 向桌面端发送重聚焦刷新信号，代价：需操作或依赖桌面端前台窗口，可能与用户当前交互产生焦点冲突。

| 产品 | 桌面端界面 | 原生接口 | 适配器与我们的后端 | 网页 | 差距与下一步 |
|---|---|---|---|---|---|
| antigravity | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| codex | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| claude | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| zcode | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| workbuddy | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| opencode | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |
| hermes | · | · | · | · | 派研究：原生接口没证实，按理论上限找入口或补齐 |

## 按项目归集（project-view）

把各家的会话按项目（工作目录）归到一起看，不分是谁开的。怎样算支持：一个项目下列出所有家在这个目录里的会话，和本机实际一致。类别：人机交互·显示与导航（候选，10-18 用户要求补登）。

**理论上限**：人机交互单元，上限取决于它依赖的单元在原生接口和我们的后端能否拿到数据（用户 10-18 原话：“功能太少了，看不到对话的项目，好多电脑上的会话看不到，一次对话明明有很多可以读的东西也不让读，智能体不是一问一答，而是自主推进每轮都有产出！”“前端需要的功能也可以作为能力单元注册”）。

| 产品 | 桌面端界面 | 原生接口 | 适配器与我们的后端 | 网页 | 差距与下一步 |
|---|---|---|---|---|---|
| antigravity | · | · | ✓ server.nativeProject：Antigravity 会话的项目取它自己索引的 work | ✓ /m/ v2（10-18 负责人重写）：首页按项目（工作目录统一写法）归集 | 已到前端 |
| codex | · | · | ✓ server.nativeProject：Antigravity 会话的项目取它自己索引的 work | ✓ /m/ v2（10-18 负责人重写）：首页按项目（工作目录统一写法）归集 | 已到前端 |
| claude | · | · | ✓ server.nativeProject：Antigravity 会话的项目取它自己索引的 work | ✓ /m/ v2（10-18 负责人重写）：首页按项目（工作目录统一写法）归集 | 已到前端 |
| zcode | · | · | ✓ server.nativeProject：Antigravity 会话的项目取它自己索引的 work | ✓ /m/ v2（10-18 负责人重写）：首页按项目（工作目录统一写法）归集 | 已到前端 |
| workbuddy | · | · | ✓ server.nativeProject：Antigravity 会话的项目取它自己索引的 work | ✓ /m/ v2（10-18 负责人重写）：首页按项目（工作目录统一写法）归集 | 已到前端 |
| opencode | · | · | ✓ server.nativeProject：Antigravity 会话的项目取它自己索引的 work | ✓ /m/ v2（10-18 负责人重写）：首页按项目（工作目录统一写法）归集 | 已到前端 |
| hermes | · | · | ✓ server.nativeProject：Antigravity 会话的项目取它自己索引的 work | ✓ /m/ v2（10-18 负责人重写）：首页按项目（工作目录统一写法）归集 | 已到前端 |
| gemini | · | · | ✓ server.nativeProject：Antigravity 会话的项目取它自己索引的 work | ✓ /m/ v2（10-18 负责人重写）：首页按项目（工作目录统一写法）归集 | 已到前端 |
| droid | · | · | ✓ server.nativeProject：Antigravity 会话的项目取它自己索引的 work | ✓ /m/ v2（10-18 负责人重写）：首页按项目（工作目录统一写法）归集 | 已到前端 |

## 读一轮全过程（observe-steps）

读一轮里的每一步：思考、工具调用及其输入和结果、中间文字、改了哪些文件。怎样算支持：记录里有的步骤都能读到，不只给最后一句回复。类别：人机交互·显示与导航（候选，10-18 用户要求补登）。

**理论上限**：人机交互单元，上限取决于它依赖的单元在原生接口和我们的后端能否拿到数据（用户 10-18 原话：“功能太少了，看不到对话的项目，好多电脑上的会话看不到，一次对话明明有很多可以读的东西也不让读，智能体不是一问一答，而是自主推进每轮都有产出！”“前端需要的功能也可以作为能力单元注册”）。

| 产品 | 桌面端界面 | 原生接口 | 适配器与我们的后端 | 网页 | 差距与下一步 |
|---|---|---|---|---|---|
| antigravity | · | · | · | ✓ /m/ v2（10-18 负责人重写）：详情：思考、工具卡（输入/结果/成败/耗时）、文字；长段折叠 | 已到前端 |
| codex | · | · | · | ✓ /m/ v2（10-18 负责人重写）：详情：思考、工具卡（输入/结果/成败/耗时）、文字；长段折叠 | 已到前端 |
| claude | · | · | · | ✓ /m/ v2（10-18 负责人重写）：详情：思考、工具卡（输入/结果/成败/耗时）、文字；长段折叠 | 已到前端 |
| zcode | · | · | · | ✓ /m/ v2（10-18 负责人重写）：详情：思考、工具卡（输入/结果/成败/耗时）、文字；长段折叠 | 已到前端 |
| workbuddy | · | · | · | ✓ /m/ v2（10-18 负责人重写）：详情：思考、工具卡（输入/结果/成败/耗时）、文字；长段折叠 | 已到前端 |
| opencode | · | · | · | ✓ /m/ v2（10-18 负责人重写）：详情：思考、工具卡（输入/结果/成败/耗时）、文字；长段折叠 | 已到前端 |
| hermes | · | · | · | ✓ /m/ v2（10-18 负责人重写）：详情：思考、工具卡（输入/结果/成败/耗时）、文字；长段折叠 | 已到前端 |
| gemini | · | · | · | ✓ /m/ v2（10-18 负责人重写）：详情：思考、工具卡（输入/结果/成败/耗时）、文字；长段折叠 | 已到前端 |
| droid | · | · | · | ✓ /m/ v2（10-18 负责人重写）：详情：思考、工具卡（输入/结果/成败/耗时）、文字；长段折叠 | 已到前端 |

## 跟随自主推进（follow-progress）

智能体一轮里自己连续推进时，新的每一步出来就看得到，不必等这一轮结束。怎样算支持：在干活的会话每出一步，几秒内显示出来。类别：人机交互·显示与导航（候选，10-18 用户要求补登）。

**理论上限**：人机交互单元，上限取决于它依赖的单元在原生接口和我们的后端能否拿到数据（用户 10-18 原话：“功能太少了，看不到对话的项目，好多电脑上的会话看不到，一次对话明明有很多可以读的东西也不让读，智能体不是一问一答，而是自主推进每轮都有产出！”“前端需要的功能也可以作为能力单元注册”）。

| 产品 | 桌面端界面 | 原生接口 | 适配器与我们的后端 | 网页 | 差距与下一步 |
|---|---|---|---|---|---|
| antigravity | · | · | · | ✓ /m/ v2（10-18 负责人重写）：在干活时每 3 秒刷新最后一轮，保留展开状态 | 已到前端 |
| codex | · | · | · | ✓ /m/ v2（10-18 负责人重写）：在干活时每 3 秒刷新最后一轮，保留展开状态 | 已到前端 |
| claude | · | · | · | ✓ /m/ v2（10-18 负责人重写）：在干活时每 3 秒刷新最后一轮，保留展开状态 | 已到前端 |
| zcode | · | · | · | ✓ /m/ v2（10-18 负责人重写）：在干活时每 3 秒刷新最后一轮，保留展开状态 | 已到前端 |
| workbuddy | · | · | · | ✓ /m/ v2（10-18 负责人重写）：在干活时每 3 秒刷新最后一轮，保留展开状态 | 已到前端 |
| opencode | · | · | · | ✓ /m/ v2（10-18 负责人重写）：在干活时每 3 秒刷新最后一轮，保留展开状态 | 已到前端 |
| hermes | · | · | · | ✓ /m/ v2（10-18 负责人重写）：在干活时每 3 秒刷新最后一轮，保留展开状态 | 已到前端 |
| gemini | · | · | · | ✓ /m/ v2（10-18 负责人重写）：在干活时每 3 秒刷新最后一轮，保留展开状态 | 已到前端 |
| droid | · | · | · | ✓ /m/ v2（10-18 负责人重写）：在干活时每 3 秒刷新最后一轮，保留展开状态 | 已到前端 |

## 搜索会话（search-sessions）

按标题、内容、目录、家找会话。怎样算支持：输入关键词能找到对应会话。类别：人机交互·显示与导航（候选，10-18 用户要求补登）。

**理论上限**：人机交互单元，上限取决于它依赖的单元在原生接口和我们的后端能否拿到数据（用户 10-18 原话：“功能太少了，看不到对话的项目，好多电脑上的会话看不到，一次对话明明有很多可以读的东西也不让读，智能体不是一问一答，而是自主推进每轮都有产出！”“前端需要的功能也可以作为能力单元注册”）。

| 产品 | 桌面端界面 | 原生接口 | 适配器与我们的后端 | 网页 | 差距与下一步 |
|---|---|---|---|---|---|
| antigravity | · | · | ✓ GET /api/sessions?slim=1 后按标题、产品筛（网页搜索框、agent_gate | ✓ /m/ v2（10-18 负责人重写）：搜索框：标题本地过滤 + 全文搜索 /api/search（ | 已到前端 |
| codex | · | · | ✓ GET /api/sessions?slim=1 后按标题、产品筛（网页搜索框、agent_gate | ✓ /m/ v2（10-18 负责人重写）：搜索框：标题本地过滤 + 全文搜索 /api/search（ | 已到前端 |
| claude | · | · | ✓ GET /api/sessions?slim=1 后按标题、产品筛（网页搜索框、agent_gate | ✓ /m/ v2（10-18 负责人重写）：搜索框：标题本地过滤 + 全文搜索 /api/search（ | 已到前端 |
| zcode | · | · | ✓ GET /api/sessions?slim=1 后按标题、产品筛（网页搜索框、agent_gate | ✓ /m/ v2（10-18 负责人重写）：搜索框：标题本地过滤 + 全文搜索 /api/search（ | 已到前端 |
| workbuddy | · | · | ✓ GET /api/sessions?slim=1 后按标题、产品筛（网页搜索框、agent_gate | ✓ /m/ v2（10-18 负责人重写）：搜索框：标题本地过滤 + 全文搜索 /api/search（ | 已到前端 |
| opencode | · | · | ✓ GET /api/sessions?slim=1 后按标题、产品筛（网页搜索框、agent_gate | ✓ /m/ v2（10-18 负责人重写）：搜索框：标题本地过滤 + 全文搜索 /api/search（ | 已到前端 |
| hermes | · | · | ✓ GET /api/sessions?slim=1 后按标题、产品筛（网页搜索框、agent_gate | ✓ /m/ v2（10-18 负责人重写）：搜索框：标题本地过滤 + 全文搜索 /api/search（ | 已到前端 |
| gemini | · | · | · | ✓ /m/ v2（10-18 负责人重写）：搜索框：标题本地过滤 + 全文搜索 /api/search（ | 已到前端 |
| droid | · | · | · | ✓ /m/ v2（10-18 负责人重写）：搜索框：标题本地过滤 + 全文搜索 /api/search（ | 已到前端 |

## 发图与附件（attach）

给会话发话时带上图片或文件。怎样算支持：智能体的回复说明它读到了附件内容。类别：人机交互·显示与导航（候选，10-18 用户要求补登）。

**理论上限**：人机交互单元，上限取决于它依赖的单元在原生接口和我们的后端能否拿到数据（用户 10-18 要求页面能粘贴截图）。

| 产品 | 桌面端界面 | 原生接口 | 适配器与我们的后端 | 网页 | 差距与下一步 |
|---|---|---|---|---|---|
| antigravity | · | · | ✓ gateway.sendPrompt(images) → 存盘 + 文字附路径；startRunIn | ✓ /m/ v2（10-18 负责人重写）：输入框“图”按钮选图、直接粘贴截图，缩略图点一下去掉 | 已到前端 |
| codex | · | · | ✓ gateway.sendPrompt(images) → 存盘 + 文字附路径；startRunIn | ✓ /m/ v2（10-18 负责人重写）：输入框“图”按钮选图、直接粘贴截图，缩略图点一下去掉 | 已到前端 |
| claude | · | · | ✓ gateway.sendPrompt(images) → 存盘 + 文字附路径；startRunIn | ✓ /m/ v2（10-18 负责人重写）：输入框“图”按钮选图、直接粘贴截图，缩略图点一下去掉 | 已到前端 |
| zcode | · | · | ✓ gateway.sendPrompt(images) → 存盘 + 文字附路径；startRunIn | ✓ /m/ v2（10-18 负责人重写）：输入框“图”按钮选图、直接粘贴截图，缩略图点一下去掉 | 已到前端 |
| workbuddy | · | · | ✓ gateway.sendPrompt(images) → 存盘 + 文字附路径；startRunIn | ✓ /m/ v2（10-18 负责人重写）：输入框“图”按钮选图、直接粘贴截图，缩略图点一下去掉 | 已到前端 |
| opencode | · | · | ✓ gateway.sendPrompt(images) → 存盘 + 文字附路径；startRunIn | ✓ /m/ v2（10-18 负责人重写）：输入框“图”按钮选图、直接粘贴截图，缩略图点一下去掉 | 已到前端 |
| hermes | · | · | ✓ gateway.sendPrompt(images) → 存盘 + 文字附路径；startRunIn | ✓ /m/ v2（10-18 负责人重写）：输入框“图”按钮选图、直接粘贴截图，缩略图点一下去掉 | 已到前端 |

## 会话侧栏（ui-sidebar）

常驻列出会话：标题、哪一家、状态、更新时间，点开即看。怎样算支持：和本机实际会话一致，人开的、智能体开的都在。类别：人机交互·导航（候选，10-18 桌面端对照补登）。

**理论上限**：人机交互单元，上限取决于它依赖的单元在原生接口和我们的后端能否拿到数据（桌面端对照：Claude 桌面应用（负责人所在宿主，手上工具可证）；Codex、Antigravity、ZCode 桌面端待核；依赖：discover-sessions、state）。

| 产品 | 桌面端界面 | 原生接口 | 适配器与我们的后端 | 网页 | 差距与下一步 |
|---|---|---|---|---|---|
| antigravity | · | · | · | ✓ /m/ v2（10-18 负责人重写）：详情页“切换”抽屉：在干活的和最近看过的会话 | 已到前端 |
| codex | · | · | · | ✓ /m/ v2（10-18 负责人重写）：详情页“切换”抽屉：在干活的和最近看过的会话 | 已到前端 |
| claude | · | · | · | ✓ /m/ v2（10-18 负责人重写）：详情页“切换”抽屉：在干活的和最近看过的会话 | 已到前端 |
| zcode | · | · | · | ✓ /m/ v2（10-18 负责人重写）：详情页“切换”抽屉：在干活的和最近看过的会话 | 已到前端 |
| workbuddy | · | · | · | ✓ /m/ v2（10-18 负责人重写）：详情页“切换”抽屉：在干活的和最近看过的会话 | 已到前端 |
| opencode | · | · | · | ✓ /m/ v2（10-18 负责人重写）：详情页“切换”抽屉：在干活的和最近看过的会话 | 已到前端 |
| hermes | · | · | · | ✓ /m/ v2（10-18 负责人重写）：详情页“切换”抽屉：在干活的和最近看过的会话 | 已到前端 |
| gemini | · | · | · | ✓ /m/ v2（10-18 负责人重写）：详情页“切换”抽屉：在干活的和最近看过的会话 | 已到前端 |
| droid | · | · | · | ✓ /m/ v2（10-18 负责人重写）：详情页“切换”抽屉：在干活的和最近看过的会话 | 已到前端 |

## 筛选（ui-filter）

按家、状态、项目、时间筛会话。怎样算支持：筛出的结果和条件一致。类别：人机交互·导航（候选，10-18 桌面端对照补登）。

**理论上限**：人机交互单元，上限取决于它依赖的单元在原生接口和我们的后端能否拿到数据（桌面端对照：Claude 桌面应用（负责人所在宿主，手上工具可证）；Codex、Antigravity、ZCode 桌面端待核；依赖：discover-sessions、state）。

| 产品 | 桌面端界面 | 原生接口 | 适配器与我们的后端 | 网页 | 差距与下一步 |
|---|---|---|---|---|---|
| antigravity | · | · | · | ✓ /m/ v2（10-18 负责人重写）：项目页排序：最近更新、轮数最多、工具最多 | 已到前端 |
| codex | · | · | · | ✓ /m/ v2（10-18 负责人重写）：项目页排序：最近更新、轮数最多、工具最多 | 已到前端 |
| claude | · | · | · | ✓ /m/ v2（10-18 负责人重写）：项目页排序：最近更新、轮数最多、工具最多 | 已到前端 |
| zcode | · | · | · | ✓ /m/ v2（10-18 负责人重写）：项目页排序：最近更新、轮数最多、工具最多 | 已到前端 |
| workbuddy | · | · | · | ✓ /m/ v2（10-18 负责人重写）：项目页排序：最近更新、轮数最多、工具最多 | 已到前端 |
| opencode | · | · | · | ✓ /m/ v2（10-18 负责人重写）：项目页排序：最近更新、轮数最多、工具最多 | 已到前端 |
| hermes | · | · | · | ✓ /m/ v2（10-18 负责人重写）：项目页排序：最近更新、轮数最多、工具最多 | 已到前端 |
| gemini | · | · | · | ✓ /m/ v2（10-18 负责人重写）：项目页排序：最近更新、轮数最多、工具最多 | 已到前端 |
| droid | · | · | · | ✓ /m/ v2（10-18 负责人重写）：项目页排序：最近更新、轮数最多、工具最多 | 已到前端 |

## 置顶（ui-pin）

把常用会话固定在列表顶部。怎样算支持：置顶的会话始终在最上面，刷新后还在。类别：人机交互·导航（候选，10-18 桌面端对照补登）。

**理论上限**：人机交互单元，上限取决于它依赖的单元在原生接口和我们的后端能否拿到数据（桌面端对照：Claude 桌面应用（负责人所在宿主，手上工具可证）；Codex、Antigravity、ZCode 桌面端待核；依赖：label）。

| 产品 | 桌面端界面 | 原生接口 | 适配器与我们的后端 | 网页 | 差距与下一步 |
|---|---|---|---|---|---|
| antigravity | · | · | · | ✓ /m/ v2（10-18 负责人重写）：详情页置顶；项目页和项目列表置顶在前 | 已到前端 |
| codex | · | · | · | ✓ /m/ v2（10-18 负责人重写）：详情页置顶；项目页和项目列表置顶在前 | 已到前端 |
| claude | · | · | · | ✓ /m/ v2（10-18 负责人重写）：详情页置顶；项目页和项目列表置顶在前 | 已到前端 |
| zcode | · | · | · | ✓ /m/ v2（10-18 负责人重写）：详情页置顶；项目页和项目列表置顶在前 | 已到前端 |
| workbuddy | · | · | · | ✓ /m/ v2（10-18 负责人重写）：详情页置顶；项目页和项目列表置顶在前 | 已到前端 |
| opencode | · | · | · | ✓ /m/ v2（10-18 负责人重写）：详情页置顶；项目页和项目列表置顶在前 | 已到前端 |
| hermes | · | · | · | ✓ /m/ v2（10-18 负责人重写）：详情页置顶；项目页和项目列表置顶在前 | 已到前端 |
| gemini | · | · | · | ✓ /m/ v2（10-18 负责人重写）：详情页置顶；项目页和项目列表置顶在前 | 已到前端 |
| droid | · | · | · | ✓ /m/ v2（10-18 负责人重写）：详情页置顶；项目页和项目列表置顶在前 | 已到前端 |

## 新产出标记（ui-unread）

有新产出、在等人处理（审批、提问）、出错的会话标出来。怎样算支持：有新步骤或在等人时几秒内标出，看过后消失。类别：人机交互·导航（候选，10-18 桌面端对照补登）。

**理论上限**：人机交互单元，上限取决于它依赖的单元在原生接口和我们的后端能否拿到数据（桌面端对照：Claude 桌面应用（负责人所在宿主，手上工具可证）；Codex、Antigravity、ZCode 桌面端待核；依赖：state、follow-progress）。

| 产品 | 桌面端界面 | 原生接口 | 适配器与我们的后端 | 网页 | 差距与下一步 |
|---|---|---|---|---|---|
| antigravity | · | · | · | ✓ /m/ v2（10-18 负责人重写）：待处理里“干完了，你还没看”（本机记已看时间） | 已到前端 |
| codex | · | · | · | ✓ /m/ v2（10-18 负责人重写）：待处理里“干完了，你还没看”（本机记已看时间） | 已到前端 |
| claude | · | · | · | ✓ /m/ v2（10-18 负责人重写）：待处理里“干完了，你还没看”（本机记已看时间） | 已到前端 |
| zcode | · | · | · | ✓ /m/ v2（10-18 负责人重写）：待处理里“干完了，你还没看”（本机记已看时间） | 已到前端 |
| workbuddy | · | · | · | ✓ /m/ v2（10-18 负责人重写）：待处理里“干完了，你还没看”（本机记已看时间） | 已到前端 |
| opencode | · | · | · | ✓ /m/ v2（10-18 负责人重写）：待处理里“干完了，你还没看”（本机记已看时间） | 已到前端 |
| hermes | · | · | · | ✓ /m/ v2（10-18 负责人重写）：待处理里“干完了，你还没看”（本机记已看时间） | 已到前端 |
| gemini | · | · | · | ✓ /m/ v2（10-18 负责人重写）：待处理里“干完了，你还没看”（本机记已看时间） | 已到前端 |
| droid | · | · | · | ✓ /m/ v2（10-18 负责人重写）：待处理里“干完了，你还没看”（本机记已看时间） | 已到前端 |

## 运行总览（ui-running-overview）

一眼看到所有在干活、在等审批、出错的会话，跨家。怎样算支持：和各家实际状态一致。类别：人机交互·导航（候选，10-18 桌面端对照补登）。

**理论上限**：人机交互单元，上限取决于它依赖的单元在原生接口和我们的后端能否拿到数据（桌面端对照：Claude 桌面应用（负责人所在宿主，手上工具可证）；Codex、Antigravity、ZCode 桌面端待核；依赖：state、channel-health）。

| 产品 | 桌面端界面 | 原生接口 | 适配器与我们的后端 | 网页 | 差距与下一步 |
|---|---|---|---|---|---|
| antigravity | · | · | · | ✓ /m/ v2（10-18 负责人重写）：首页“正在干活” | 已到前端 |
| codex | · | · | · | ✓ /m/ v2（10-18 负责人重写）：首页“正在干活” | 已到前端 |
| claude | · | · | · | ✓ /m/ v2（10-18 负责人重写）：首页“正在干活” | 已到前端 |
| zcode | · | · | · | ✓ /m/ v2（10-18 负责人重写）：首页“正在干活” | 已到前端 |
| workbuddy | · | · | · | ✓ /m/ v2（10-18 负责人重写）：首页“正在干活” | 已到前端 |
| opencode | · | · | · | ✓ /m/ v2（10-18 负责人重写）：首页“正在干活” | 已到前端 |
| hermes | · | · | · | ✓ /m/ v2（10-18 负责人重写）：首页“正在干活” | 已到前端 |
| gemini | · | · | · | ✓ /m/ v2（10-18 负责人重写）：首页“正在干活” | 已到前端 |
| droid | · | · | · | ✓ /m/ v2（10-18 负责人重写）：首页“正在干活” | 已到前端 |

## 富文本显示（ui-markdown）

Markdown、代码块（高亮、可复制）、表格、链接、图片按格式显示。怎样算支持：智能体写的格式原样呈现，不是一坨纯文本。类别：人机交互·显示（候选，10-18 桌面端对照补登）。

**理论上限**：人机交互单元，上限取决于它依赖的单元在原生接口和我们的后端能否拿到数据（桌面端对照：Claude 桌面应用（负责人所在宿主，手上工具可证）；Codex、Antigravity、ZCode 桌面端待核；依赖：observe-history）。

| 产品 | 桌面端界面 | 原生接口 | 适配器与我们的后端 | 网页 | 差距与下一步 |
|---|---|---|---|---|---|
| antigravity | · | · | · | ✓ /m/ v2（10-18 负责人重写）：内置 Markdown（代码块可复制、表格、列表） | 已到前端 |
| codex | · | · | · | ✓ /m/ v2（10-18 负责人重写）：内置 Markdown（代码块可复制、表格、列表） | 已到前端 |
| claude | · | · | · | ✓ /m/ v2（10-18 负责人重写）：内置 Markdown（代码块可复制、表格、列表） | 已到前端 |
| zcode | · | · | · | ✓ /m/ v2（10-18 负责人重写）：内置 Markdown（代码块可复制、表格、列表） | 已到前端 |
| workbuddy | · | · | · | ✓ /m/ v2（10-18 负责人重写）：内置 Markdown（代码块可复制、表格、列表） | 已到前端 |
| opencode | · | · | · | ✓ /m/ v2（10-18 负责人重写）：内置 Markdown（代码块可复制、表格、列表） | 已到前端 |
| hermes | · | · | · | ✓ /m/ v2（10-18 负责人重写）：内置 Markdown（代码块可复制、表格、列表） | 已到前端 |
| gemini | · | · | · | ✓ /m/ v2（10-18 负责人重写）：内置 Markdown（代码块可复制、表格、列表） | 已到前端 |
| droid | · | · | · | ✓ /m/ v2（10-18 负责人重写）：内置 Markdown（代码块可复制、表格、列表） | 已到前端 |

## 思考过程显示（ui-thinking）

模型的思考内容可折叠显示。怎样算支持：记录里有思考的，能展开看到。类别：人机交互·显示（候选，10-18 桌面端对照补登）。

**理论上限**：人机交互单元，上限取决于它依赖的单元在原生接口和我们的后端能否拿到数据（桌面端对照：Claude 桌面应用（负责人所在宿主，手上工具可证）；Codex、Antigravity、ZCode 桌面端待核；依赖：observe-steps）。

| 产品 | 桌面端界面 | 原生接口 | 适配器与我们的后端 | 网页 | 差距与下一步 |
|---|---|---|---|---|---|
| antigravity | · | · | · | ✓ /m/ v2（10-18 负责人重写）：思考折叠 | 已到前端 |
| codex | · | · | · | ✓ /m/ v2（10-18 负责人重写）：思考折叠 | 已到前端 |
| claude | · | · | · | ✓ /m/ v2（10-18 负责人重写）：思考折叠 | 已到前端 |
| zcode | · | · | · | ✓ /m/ v2（10-18 负责人重写）：思考折叠 | 已到前端 |
| workbuddy | · | · | · | ✓ /m/ v2（10-18 负责人重写）：思考折叠 | 已到前端 |
| opencode | · | · | · | ✓ /m/ v2（10-18 负责人重写）：思考折叠 | 已到前端 |
| hermes | · | · | · | ✓ /m/ v2（10-18 负责人重写）：思考折叠 | 已到前端 |
| gemini | · | · | · | ✓ /m/ v2（10-18 负责人重写）：思考折叠 | 已到前端 |
| droid | · | · | · | ✓ /m/ v2（10-18 负责人重写）：思考折叠 | 已到前端 |

## 工具调用卡片（ui-tool-card）

每次工具调用一张卡：工具名、参数、结果、成败、耗时，可展开。怎样算支持：记录里每次调用都有卡，参数和结果能看全。类别：人机交互·显示（候选，10-18 桌面端对照补登）。

**理论上限**：人机交互单元，上限取决于它依赖的单元在原生接口和我们的后端能否拿到数据（桌面端对照：Claude 桌面应用（负责人所在宿主，手上工具可证）；Codex、Antigravity、ZCode 桌面端待核；依赖：observe-steps）。

| 产品 | 桌面端界面 | 原生接口 | 适配器与我们的后端 | 网页 | 差距与下一步 |
|---|---|---|---|---|---|
| antigravity | · | · | · | ✓ /m/ v2（10-18 负责人重写）：工具调用卡片 | 已到前端 |
| codex | · | · | · | ✓ /m/ v2（10-18 负责人重写）：工具调用卡片 | 已到前端 |
| claude | · | · | · | ✓ /m/ v2（10-18 负责人重写）：工具调用卡片 | 已到前端 |
| zcode | · | · | · | ✓ /m/ v2（10-18 负责人重写）：工具调用卡片 | 已到前端 |
| workbuddy | · | · | · | ✓ /m/ v2（10-18 负责人重写）：工具调用卡片 | 已到前端 |
| opencode | · | · | · | ✓ /m/ v2（10-18 负责人重写）：工具调用卡片 | 已到前端 |
| hermes | · | · | · | ✓ /m/ v2（10-18 负责人重写）：工具调用卡片 | 已到前端 |
| gemini | · | · | · | ✓ /m/ v2（10-18 负责人重写）：工具调用卡片 | 已到前端 |
| droid | · | · | · | ✓ /m/ v2（10-18 负责人重写）：工具调用卡片 | 已到前端 |

## 文件改动显示（ui-diff）

改了哪些文件、增删多少行，能看具体改动。怎样算支持：改动的文件和行数与实际一致。类别：人机交互·显示（候选，10-18 桌面端对照补登）。

**理论上限**：人机交互单元，上限取决于它依赖的单元在原生接口和我们的后端能否拿到数据（桌面端对照：Claude 桌面应用（负责人所在宿主，手上工具可证）；Codex、Antigravity、ZCode 桌面端待核；依赖：observe-steps、artifact）。

| 产品 | 桌面端界面 | 原生接口 | 适配器与我们的后端 | 网页 | 差距与下一步 |
|---|---|---|---|---|---|
| antigravity | · | · | · | ✓ /m/ v2（10-18 负责人重写）：改文件的工具（Edit、MultiEdit、Write、An | 已到前端 |
| codex | · | · | · | ✓ /m/ v2（10-18 负责人重写）：改文件的工具（Edit、MultiEdit、Write、An | 已到前端 |
| claude | · | · | · | ✓ /m/ v2（10-18 负责人重写）：改文件的工具（Edit、MultiEdit、Write、An | 已到前端 |
| zcode | · | · | · | ✓ /m/ v2（10-18 负责人重写）：改文件的工具（Edit、MultiEdit、Write、An | 已到前端 |
| workbuddy | · | · | · | ✓ /m/ v2（10-18 负责人重写）：改文件的工具（Edit、MultiEdit、Write、An | 已到前端 |
| opencode | · | · | · | ✓ /m/ v2（10-18 负责人重写）：改文件的工具（Edit、MultiEdit、Write、An | 已到前端 |
| hermes | · | · | · | ✓ /m/ v2（10-18 负责人重写）：改文件的工具（Edit、MultiEdit、Write、An | 已到前端 |
| gemini | · | · | · | ✓ /m/ v2（10-18 负责人重写）：改文件的工具（Edit、MultiEdit、Write、An | 已到前端 |
| droid | · | · | · | ✓ /m/ v2（10-18 负责人重写）：改文件的工具（Edit、MultiEdit、Write、An | 已到前端 |

## 命令输出显示（ui-terminal-output）

智能体跑的命令和输出按终端样式显示，长的可折叠。怎样算支持：命令和输出完整可读。类别：人机交互·显示（候选，10-18 桌面端对照补登）。

**理论上限**：人机交互单元，上限取决于它依赖的单元在原生接口和我们的后端能否拿到数据（桌面端对照：Claude 桌面应用（负责人所在宿主，手上工具可证）；Codex、Antigravity、ZCode 桌面端待核；依赖：observe-steps）。

| 产品 | 桌面端界面 | 原生接口 | 适配器与我们的后端 | 网页 | 差距与下一步 |
|---|---|---|---|---|---|
| antigravity | · | · | · | ✓ /m/ v2（10-18 负责人重写）：命令类工具卡片：命令和输出，长输出限高可滚动 | 已到前端 |
| codex | · | · | · | ✓ /m/ v2（10-18 负责人重写）：命令类工具卡片：命令和输出，长输出限高可滚动 | 已到前端 |
| claude | · | · | · | ✓ /m/ v2（10-18 负责人重写）：命令类工具卡片：命令和输出，长输出限高可滚动 | 已到前端 |
| zcode | · | · | · | ✓ /m/ v2（10-18 负责人重写）：命令类工具卡片：命令和输出，长输出限高可滚动 | 已到前端 |
| workbuddy | · | · | · | ✓ /m/ v2（10-18 负责人重写）：命令类工具卡片：命令和输出，长输出限高可滚动 | 已到前端 |
| opencode | · | · | · | ✓ /m/ v2（10-18 负责人重写）：命令类工具卡片：命令和输出，长输出限高可滚动 | 已到前端 |
| hermes | · | · | · | ✓ /m/ v2（10-18 负责人重写）：命令类工具卡片：命令和输出，长输出限高可滚动 | 已到前端 |
| gemini | · | · | · | ✓ /m/ v2（10-18 负责人重写）：命令类工具卡片：命令和输出，长输出限高可滚动 | 已到前端 |
| droid | · | · | · | ✓ /m/ v2（10-18 负责人重写）：命令类工具卡片：命令和输出，长输出限高可滚动 | 已到前端 |

## 子智能体显示（ui-subagent-view）

子智能体在做什么嵌套显示，可点进去看它自己的过程。怎样算支持：子智能体的步骤能看到，和父会话关联。类别：人机交互·显示（候选，10-18 桌面端对照补登）。

**理论上限**：发现、读、状态、送话、打断（靠 平台把子会话当成可寻址的会话）。根本限制：子会话只活在父进程内存里、不落盘也没有编号时，外部理论上看不到。原生做不到时最多补齐到：读父会话里记下的子任务结果，代价：只看得到结果，看不到过程，控制不了。

| 产品 | 桌面端界面 | 原生接口 | 适配器与我们的后端 | 网页 | 差距与下一步 |
|---|---|---|---|---|---|
| antigravity | · | · | · | ✓ /m/ v2（10-18 负责人重写）：列表只列主会话，卡片写子智能体个数；详情页列出子智能体，子会 | 已到前端 |
| codex | · | · | · | ✓ /m/ v2（10-18 负责人重写）：列表只列主会话，卡片写子智能体个数；详情页列出子智能体，子会 | 已到前端 |
| claude | · | · | · | ✓ /m/ v2（10-18 负责人重写）：列表只列主会话，卡片写子智能体个数；详情页列出子智能体，子会 | 已到前端 |
| zcode | · | · | · | ✓ /m/ v2（10-18 负责人重写）：列表只列主会话，卡片写子智能体个数；详情页列出子智能体，子会 | 已到前端 |
| workbuddy | · | · | · | ✓ /m/ v2（10-18 负责人重写）：列表只列主会话，卡片写子智能体个数；详情页列出子智能体，子会 | 已到前端 |
| opencode | · | · | · | ✓ /m/ v2（10-18 负责人重写）：列表只列主会话，卡片写子智能体个数；详情页列出子智能体，子会 | 已到前端 |
| hermes | · | · | · | ✓ /m/ v2（10-18 负责人重写）：列表只列主会话，卡片写子智能体个数；详情页列出子智能体，子会 | 已到前端 |
| gemini | · | · | · | ✓ /m/ v2（10-18 负责人重写）：列表只列主会话，卡片写子智能体个数；详情页列出子智能体，子会 | 已到前端 |
| droid | · | · | · | ✓ /m/ v2（10-18 负责人重写）：列表只列主会话，卡片写子智能体个数；详情页列出子智能体，子会 | 已到前端 |

## 计划与待办显示（ui-plan-view）

智能体的任务清单和每项进度。怎样算支持：清单内容和勾选状态与智能体一致。类别：人机交互·显示（候选，10-18 桌面端对照补登）。

**理论上限**：人机交互单元，上限取决于它依赖的单元在原生接口和我们的后端能否拿到数据（桌面端对照：Claude 桌面应用（负责人所在宿主，手上工具可证）；Codex、Antigravity、ZCode 桌面端待核；依赖：observe-steps）。

| 产品 | 桌面端界面 | 原生接口 | 适配器与我们的后端 | 网页 | 差距与下一步 |
|---|---|---|---|---|---|
| antigravity | · | · | · | ✓ /m/ v2（10-18 负责人重写）：工具卡片里的 TodoWrite / update_plan | 已到前端 |
| codex | · | · | · | ✓ /m/ v2（10-18 负责人重写）：工具卡片里的 TodoWrite / update_plan | 已到前端 |
| claude | · | · | · | ✓ /m/ v2（10-18 负责人重写）：工具卡片里的 TodoWrite / update_plan | 已到前端 |
| zcode | · | · | · | ✓ /m/ v2（10-18 负责人重写）：工具卡片里的 TodoWrite / update_plan | 已到前端 |
| workbuddy | · | · | · | ✓ /m/ v2（10-18 负责人重写）：工具卡片里的 TodoWrite / update_plan | 已到前端 |
| opencode | · | · | · | ✓ /m/ v2（10-18 负责人重写）：工具卡片里的 TodoWrite / update_plan | 已到前端 |
| hermes | · | · | · | ✓ /m/ v2（10-18 负责人重写）：工具卡片里的 TodoWrite / update_plan | 已到前端 |
| gemini | · | · | · | ✓ /m/ v2（10-18 负责人重写）：工具卡片里的 TodoWrite / update_plan | 已到前端 |
| droid | · | · | · | ✓ /m/ v2（10-18 负责人重写）：工具卡片里的 TodoWrite / update_plan | 已到前端 |

## 当前状态显示（ui-status-line）

此刻在思考、在跑哪个工具、在等审批、在等人回答，已用多久。怎样算支持：几秒内反映实际状态。类别：人机交互·显示（候选，10-18 桌面端对照补登）。

**理论上限**：人机交互单元，上限取决于它依赖的单元在原生接口和我们的后端能否拿到数据（桌面端对照：Claude 桌面应用（负责人所在宿主，手上工具可证）；Codex、Antigravity、ZCode 桌面端待核；依赖：state、follow-progress）。

| 产品 | 桌面端界面 | 原生接口 | 适配器与我们的后端 | 网页 | 差距与下一步 |
|---|---|---|---|---|---|
| antigravity | · | · | · | ✓ /m/ v2（10-18 负责人重写）：顶部状态行（Antigravity 读它自己的索引） | 已到前端 |
| codex | · | · | · | ✓ /m/ v2（10-18 负责人重写）：顶部状态行（Antigravity 读它自己的索引） | 已到前端 |
| claude | · | · | · | ✓ /m/ v2（10-18 负责人重写）：顶部状态行（Antigravity 读它自己的索引） | 已到前端 |
| zcode | · | · | · | ✓ /m/ v2（10-18 负责人重写）：顶部状态行（Antigravity 读它自己的索引） | 已到前端 |
| workbuddy | · | · | · | ✓ /m/ v2（10-18 负责人重写）：顶部状态行（Antigravity 读它自己的索引） | 已到前端 |
| opencode | · | · | · | ✓ /m/ v2（10-18 负责人重写）：顶部状态行（Antigravity 读它自己的索引） | 已到前端 |
| hermes | · | · | · | ✓ /m/ v2（10-18 负责人重写）：顶部状态行（Antigravity 读它自己的索引） | 已到前端 |
| gemini | · | · | · | ✓ /m/ v2（10-18 负责人重写）：顶部状态行（Antigravity 读它自己的索引） | 已到前端 |
| droid | · | · | · | ✓ /m/ v2（10-18 负责人重写）：顶部状态行（Antigravity 读它自己的索引） | 已到前端 |

## 用量显示（ui-usage）

上下文占用、token、费用、额度。怎样算支持：数字和各家记录一致。类别：人机交互·显示（候选，10-18 桌面端对照补登）。

**理论上限**：人机交互单元，上限取决于它依赖的单元在原生接口和我们的后端能否拿到数据（桌面端对照：Claude 桌面应用（负责人所在宿主，手上工具可证）；Codex、Antigravity、ZCode 桌面端待核；依赖：quota、observe-history）。

| 产品 | 桌面端界面 | 原生接口 | 适配器与我们的后端 | 网页 | 差距与下一步 |
|---|---|---|---|---|---|
| antigravity | · | · | · | ◐ /m/ v2（10-18 负责人重写）：状态行显示最近几轮输 | 派研究：这家桌面端有没有、数据在哪 |
| codex | · | · | · | ◐ /m/ v2（10-18 负责人重写）：状态行显示最近几轮输 | 派研究：这家桌面端有没有、数据在哪 |
| claude | · | · | · | ◐ /m/ v2（10-18 负责人重写）：状态行显示最近几轮输 | 派研究：这家桌面端有没有、数据在哪 |
| zcode | · | · | · | ◐ /m/ v2（10-18 负责人重写）：状态行显示最近几轮输 | 派研究：这家桌面端有没有、数据在哪 |
| workbuddy | · | · | · | ◐ /m/ v2（10-18 负责人重写）：状态行显示最近几轮输 | 派研究：这家桌面端有没有、数据在哪 |
| opencode | · | · | · | ◐ /m/ v2（10-18 负责人重写）：状态行显示最近几轮输 | 派研究：这家桌面端有没有、数据在哪 |
| hermes | · | · | · | ◐ /m/ v2（10-18 负责人重写）：状态行显示最近几轮输 | 派研究：这家桌面端有没有、数据在哪 |
| gemini | · | · | · | ◐ /m/ v2（10-18 负责人重写）：状态行显示最近几轮输 | 派研究：这家桌面端有没有、数据在哪 |
| droid | · | · | · | ◐ /m/ v2（10-18 负责人重写）：状态行显示最近几轮输 | 派研究：这家桌面端有没有、数据在哪 |

## 长会话浏览（ui-long-history）

早的轮次按需加载，能跳到某一轮。怎样算支持：几百轮的会话也能打开、能翻到最早。类别：人机交互·显示（候选，10-18 桌面端对照补登）。

**理论上限**：人机交互单元，上限取决于它依赖的单元在原生接口和我们的后端能否拿到数据（桌面端对照：Claude 桌面应用（负责人所在宿主，手上工具可证）；Codex、Antigravity、ZCode 桌面端待核；依赖：observe-history）。

| 产品 | 桌面端界面 | 原生接口 | 适配器与我们的后端 | 网页 | 差距与下一步 |
|---|---|---|---|---|---|
| antigravity | · | · | · | ✓ /m/ v2（10-18 负责人重写）：详情页默认最近 3 轮，“加载更早的轮次”分页 | 已到前端 |
| codex | · | · | · | ✓ /m/ v2（10-18 负责人重写）：详情页默认最近 3 轮，“加载更早的轮次”分页 | 已到前端 |
| claude | · | · | · | ✓ /m/ v2（10-18 负责人重写）：详情页默认最近 3 轮，“加载更早的轮次”分页 | 已到前端 |
| zcode | · | · | · | ✓ /m/ v2（10-18 负责人重写）：详情页默认最近 3 轮，“加载更早的轮次”分页 | 已到前端 |
| workbuddy | · | · | · | ✓ /m/ v2（10-18 负责人重写）：详情页默认最近 3 轮，“加载更早的轮次”分页 | 已到前端 |
| opencode | · | · | · | ✓ /m/ v2（10-18 负责人重写）：详情页默认最近 3 轮，“加载更早的轮次”分页 | 已到前端 |
| hermes | · | · | · | ✓ /m/ v2（10-18 负责人重写）：详情页默认最近 3 轮，“加载更早的轮次”分页 | 已到前端 |
| gemini | · | · | · | ✓ /m/ v2（10-18 负责人重写）：详情页默认最近 3 轮，“加载更早的轮次”分页 | 已到前端 |
| droid | · | · | · | ✓ /m/ v2（10-18 负责人重写）：详情页默认最近 3 轮，“加载更早的轮次”分页 | 已到前端 |

## 输入框（ui-composer）

多行输入，回车或按钮发送，没发出的草稿保留。怎样算支持：发出去的话智能体收到；切走再回来草稿还在。类别：人机交互·输入（候选，10-18 桌面端对照补登）。

**理论上限**：人机交互单元，上限取决于它依赖的单元在原生接口和我们的后端能否拿到数据（桌面端对照：Claude 桌面应用（负责人所在宿主，手上工具可证）；Codex、Antigravity、ZCode 桌面端待核；依赖：resume、steer）。

| 产品 | 桌面端界面 | 原生接口 | 适配器与我们的后端 | 网页 | 差距与下一步 |
|---|---|---|---|---|---|
| antigravity | · | · | · | ✓ /m/ v2（10-18 负责人重写）：底部输入框，草稿存本机 | 已到前端 |
| codex | · | · | · | ✓ /m/ v2（10-18 负责人重写）：底部输入框，草稿存本机 | 已到前端 |
| claude | · | · | · | ✓ /m/ v2（10-18 负责人重写）：底部输入框，草稿存本机 | 已到前端 |
| zcode | · | · | · | ✓ /m/ v2（10-18 负责人重写）：底部输入框，草稿存本机 | 已到前端 |
| workbuddy | · | · | · | ✓ /m/ v2（10-18 负责人重写）：底部输入框，草稿存本机 | 已到前端 |
| opencode | · | · | · | ✓ /m/ v2（10-18 负责人重写）：底部输入框，草稿存本机 | 已到前端 |
| hermes | · | · | · | ✓ /m/ v2（10-18 负责人重写）：底部输入框，草稿存本机 | 已到前端 |

## 引用文件或会话（ui-mention）

输入时引用项目里的文件或别的会话。怎样算支持：智能体读到了引用的内容。类别：人机交互·输入（候选，10-18 桌面端对照补登）。

**理论上限**：人机交互单元，上限取决于它依赖的单元在原生接口和我们的后端能否拿到数据（桌面端对照：Claude 桌面应用（负责人所在宿主，手上工具可证）；Codex、Antigravity、ZCode 桌面端待核；依赖：attach）。

| 产品 | 桌面端界面 | 原生接口 | 适配器与我们的后端 | 网页 | 差距与下一步 |
|---|---|---|---|---|---|
| antigravity | · | · | · | · | 派研究：这家桌面端有没有、数据在哪 |
| codex | · | · | · | · | 派研究：这家桌面端有没有、数据在哪 |
| claude | · | · | · | · | 派研究：这家桌面端有没有、数据在哪 |
| zcode | · | · | · | · | 派研究：这家桌面端有没有、数据在哪 |
| workbuddy | · | · | · | · | 派研究：这家桌面端有没有、数据在哪 |
| opencode | · | · | · | · | 派研究：这家桌面端有没有、数据在哪 |
| hermes | · | · | · | · | 派研究：这家桌面端有没有、数据在哪 |

## 命令菜单（ui-command-menu）

输入 / 弹出这一家可用的命令。怎样算支持：列出的命令和这一家实际可用的一致，选了能执行。类别：人机交互·输入（候选，10-18 桌面端对照补登）。

**理论上限**：人机交互单元，上限取决于它依赖的单元在原生接口和我们的后端能否拿到数据（桌面端对照：Claude 桌面应用（负责人所在宿主，手上工具可证）；Codex、Antigravity、ZCode 桌面端待核；依赖：cmd-list）。

| 产品 | 桌面端界面 | 原生接口 | 适配器与我们的后端 | 网页 | 差距与下一步 |
|---|---|---|---|---|---|
| antigravity | · | · | · | · | 派研究：这家桌面端有没有、数据在哪 |
| codex | · | · | · | · | 派研究：这家桌面端有没有、数据在哪 |
| claude | · | · | · | ? /m/（10-18 深夜负责人）：输入框以 / 开头时，弹出 | 派研究：这家桌面端有没有、数据在哪 |
| zcode | · | · | · | ? /m/（10-18 深夜负责人）：输入框以 / 开头时，弹出 | 派研究：这家桌面端有没有、数据在哪 |
| workbuddy | · | · | · | ? /m/（10-18 深夜负责人）：输入框以 / 开头时，弹出 | 派研究：这家桌面端有没有、数据在哪 |
| opencode | · | · | · | ? /m/（10-18 深夜负责人）：输入框以 / 开头时，弹出 | 派研究：这家桌面端有没有、数据在哪 |
| hermes | · | · | · | ? /m/（10-18 深夜负责人）：输入框以 / 开头时，弹出 | 派研究：这家桌面端有没有、数据在哪 |

## 模型与推理力度选择（ui-model-picker）

新建或中途选模型、推理力度。怎样算支持：选了之后实际用的就是它。类别：人机交互·输入（候选，10-18 桌面端对照补登）。

**理论上限**：人机交互单元，上限取决于它依赖的单元在原生接口和我们的后端能否拿到数据（桌面端对照：Claude 桌面应用（负责人所在宿主，手上工具可证）；Codex、Antigravity、ZCode 桌面端待核；依赖：model-list、model-new、model-switch）。

| 产品 | 桌面端界面 | 原生接口 | 适配器与我们的后端 | 网页 | 差距与下一步 |
|---|---|---|---|---|---|
| antigravity | · | · | · | ◐ /m/ v2（10-18 负责人重写）：新任务里选模型（后端 | 派研究：这家桌面端有没有、数据在哪 |
| codex | · | · | · | ◐ /m/ v2（10-18 负责人重写）：新任务里选模型（后端 | 派研究：这家桌面端有没有、数据在哪 |
| claude | · | · | · | ◐ /m/ v2（10-18 负责人重写）：新任务里选模型（后端 | 派研究：这家桌面端有没有、数据在哪 |
| zcode | · | · | · | ◐ /m/ v2（10-18 负责人重写）：新任务里选模型（后端 | 派研究：这家桌面端有没有、数据在哪 |
| workbuddy | · | · | · | ◐ /m/ v2（10-18 负责人重写）：新任务里选模型（后端 | 派研究：这家桌面端有没有、数据在哪 |
| opencode | · | · | · | ◐ /m/ v2（10-18 负责人重写）：新任务里选模型（后端 | 派研究：这家桌面端有没有、数据在哪 |
| hermes | · | · | · | ◐ /m/ v2（10-18 负责人重写）：新任务里选模型（后端 | 派研究：这家桌面端有没有、数据在哪 |

## 权限模式选择（ui-mode-picker）

选只读、自动、全放行等模式。怎样算支持：选了之后智能体按这个模式要不要审批。类别：人机交互·输入（候选，10-18 桌面端对照补登）。

**理论上限**：人机交互单元，上限取决于它依赖的单元在原生接口和我们的后端能否拿到数据（桌面端对照：Claude 桌面应用（负责人所在宿主，手上工具可证）；Codex、Antigravity、ZCode 桌面端待核；依赖：mode-switch、permission-scope）。

| 产品 | 桌面端界面 | 原生接口 | 适配器与我们的后端 | 网页 | 差距与下一步 |
|---|---|---|---|---|---|
| antigravity | · | · | · | ◐ /m/ v2（10-18 负责人重写）：新任务里选只读或全放 | 派研究：这家桌面端有没有、数据在哪 |
| codex | · | · | · | ◐ /m/ v2（10-18 负责人重写）：新任务里选只读或全放 | 派研究：这家桌面端有没有、数据在哪 |
| claude | · | · | · | ◐ /m/ v2（10-18 负责人重写）：新任务里选只读或全放 | 派研究：这家桌面端有没有、数据在哪 |
| zcode | · | · | · | ◐ /m/ v2（10-18 负责人重写）：新任务里选只读或全放 | 派研究：这家桌面端有没有、数据在哪 |
| workbuddy | · | · | · | ◐ /m/ v2（10-18 负责人重写）：新任务里选只读或全放 | 派研究：这家桌面端有没有、数据在哪 |
| opencode | · | · | · | ◐ /m/ v2（10-18 负责人重写）：新任务里选只读或全放 | 派研究：这家桌面端有没有、数据在哪 |
| hermes | · | · | · | ◐ /m/ v2（10-18 负责人重写）：新任务里选只读或全放 | 派研究：这家桌面端有没有、数据在哪 |

## 停止按钮（ui-stop）

干活时一键停下。怎样算支持：几秒内停下，状态显示已停。类别：人机交互·运行控制（候选，10-18 桌面端对照补登）。

**理论上限**：人机交互单元，上限取决于它依赖的单元在原生接口和我们的后端能否拿到数据（桌面端对照：Claude 桌面应用（负责人所在宿主，手上工具可证）；Codex、Antigravity、ZCode 桌面端待核；依赖：cancel）。

| 产品 | 桌面端界面 | 原生接口 | 适配器与我们的后端 | 网页 | 差距与下一步 |
|---|---|---|---|---|---|
| antigravity | · | · | · | ✓ /m/ v2（10-18 负责人重写）：停按钮（注册表里 cancel 可用才显示） | 已到前端 |
| codex | · | · | · | ✓ /m/ v2（10-18 负责人重写）：停按钮（注册表里 cancel 可用才显示） | 已到前端 |
| claude | · | · | · | ✓ /m/ v2（10-18 负责人重写）：停按钮（注册表里 cancel 可用才显示） | 已到前端 |
| zcode | · | · | · | ✓ /m/ v2（10-18 负责人重写）：停按钮（注册表里 cancel 可用才显示） | 已到前端 |
| workbuddy | · | · | · | ✓ /m/ v2（10-18 负责人重写）：停按钮（注册表里 cancel 可用才显示） | 已到前端 |
| opencode | · | · | · | ✓ /m/ v2（10-18 负责人重写）：停按钮（注册表里 cancel 可用才显示） | 已到前端 |
| hermes | · | · | · | ✓ /m/ v2（10-18 负责人重写）：停按钮（注册表里 cancel 可用才显示） | 已到前端 |

## 运行中发话（ui-queue-steer）

智能体干活时继续发话，显示是插进本轮还是排到下一轮。怎样算支持：话被收到，界面写明落在哪一级。类别：人机交互·运行控制（候选，10-18 桌面端对照补登）。

**理论上限**：人机交互单元，上限取决于它依赖的单元在原生接口和我们的后端能否拿到数据（桌面端对照：Claude 桌面应用（负责人所在宿主，手上工具可证）；Codex、Antigravity、ZCode 桌面端待核；依赖：steer、inject-next）。

| 产品 | 桌面端界面 | 原生接口 | 适配器与我们的后端 | 网页 | 差距与下一步 |
|---|---|---|---|---|---|
| antigravity | · | · | · | ✓ /m/ v2（10-18 负责人重写）：在干活时发话，提示插进本轮或排下一轮 | 已到前端 |
| codex | · | · | · | ✓ /m/ v2（10-18 负责人重写）：在干活时发话，提示插进本轮或排下一轮 | 已到前端 |
| claude | · | · | · | ✓ /m/ v2（10-18 负责人重写）：在干活时发话，提示插进本轮或排下一轮 | 已到前端 |
| zcode | · | · | · | ✓ /m/ v2（10-18 负责人重写）：在干活时发话，提示插进本轮或排下一轮 | 已到前端 |
| workbuddy | · | · | · | ✓ /m/ v2（10-18 负责人重写）：在干活时发话，提示插进本轮或排下一轮 | 已到前端 |
| opencode | · | · | · | ✓ /m/ v2（10-18 负责人重写）：在干活时发话，提示插进本轮或排下一轮 | 已到前端 |
| hermes | · | · | · | ✓ /m/ v2（10-18 负责人重写）：在干活时发话，提示插进本轮或排下一轮 | 已到前端 |

## 审批卡片（ui-approval）

智能体要权限时弹卡：允许一次、始终允许、拒绝。怎样算支持：点了之后这一轮按选择继续，不是事后重发。类别：人机交互·运行控制（候选，10-18 桌面端对照补登）。

**理论上限**：人机交互单元，上限取决于它依赖的单元在原生接口和我们的后端能否拿到数据（桌面端对照：Claude 桌面应用（负责人所在宿主，手上工具可证）；Codex、Antigravity、ZCode 桌面端待核；依赖：permission）。

| 产品 | 桌面端界面 | 原生接口 | 适配器与我们的后端 | 网页 | 差距与下一步 |
|---|---|---|---|---|---|
| antigravity | · | · | · | · | 派研究：这家桌面端有没有、数据在哪 |
| codex | · | · | · | ? /m/（10-18 深夜负责人）：同上 | 派研究：这家桌面端有没有、数据在哪 |
| claude | · | · | · | ? /m/（10-18 深夜负责人）：同上 | 派研究：这家桌面端有没有、数据在哪 |
| zcode | · | · | · | ✓ /m/（10-18 深夜负责人）：会话页审批卡：轮内审批写“这一轮停着等你批 / 批准，这一轮继续” | 已到前端 |
| workbuddy | · | · | · | ? /m/（10-18 深夜负责人）：同上 | 派研究：这家桌面端有没有、数据在哪 |
| opencode | · | · | · | · | 派研究：这家桌面端有没有、数据在哪 |
| hermes | · | · | · | ? /m/（10-18 深夜负责人）：同上 | 派研究：这家桌面端有没有、数据在哪 |

## 回答智能体提问（ui-question）

智能体问人时显示问题和选项，人选了它接着干。怎样算支持：回答送达，同一轮继续。类别：人机交互·运行控制（候选，10-18 桌面端对照补登）。

**理论上限**：人机交互单元，上限取决于它依赖的单元在原生接口和我们的后端能否拿到数据（桌面端对照：Claude 桌面应用（负责人所在宿主，手上工具可证）；Codex、Antigravity、ZCode 桌面端待核；依赖：ask-user）。

| 产品 | 桌面端界面 | 原生接口 | 适配器与我们的后端 | 网页 | 差距与下一步 |
|---|---|---|---|---|---|
| antigravity | · | · | · | · | 派研究：这家桌面端有没有、数据在哪 |
| codex | · | · | · | ? /m/（10-19 负责人）：同上 | 派研究：这家桌面端有没有、数据在哪 |
| claude | · | · | · | ✓ /m/（10-19 负责人）：会话页提问卡：服务状态里有这个会话在等回答的问题时，显示“智能体在等你 | 已到前端 |
| zcode | · | · | · | ? /m/（10-19 负责人）：同上 | 派研究：这家桌面端有没有、数据在哪 |
| workbuddy | · | · | · | · | 派研究：这家桌面端有没有、数据在哪 |
| opencode | · | · | · | · | 派研究：这家桌面端有没有、数据在哪 |
| hermes | · | · | · | · | 派研究：这家桌面端有没有、数据在哪 |

## 重试与编辑重发（ui-retry-edit）

重来这一轮，或改了上一句再发。怎样算支持：新的一轮按改后的话跑，旧的可回看。类别：人机交互·运行控制（候选，10-18 桌面端对照补登）。

**理论上限**：人机交互单元，上限取决于它依赖的单元在原生接口和我们的后端能否拿到数据（桌面端对照：Claude 桌面应用（负责人所在宿主，手上工具可证）；Codex、Antigravity、ZCode 桌面端待核；依赖：rewind、fork）。

| 产品 | 桌面端界面 | 原生接口 | 适配器与我们的后端 | 网页 | 差距与下一步 |
|---|---|---|---|---|---|
| antigravity | · | · | · | ? /m/（10-19 负责人）：每轮“改了再发”（填回输入框） | 派研究：这家桌面端有没有、数据在哪 |
| codex | · | · | · | ? /m/（10-19 负责人）：每轮“改了再发”（填回输入框） | 派研究：这家桌面端有没有、数据在哪 |
| claude | · | · | · | ? /m/（10-19 负责人）：每轮“改了再发”（填回输入框） | 派研究：这家桌面端有没有、数据在哪 |
| zcode | · | · | · | ? /m/（10-19 负责人）：每轮“改了再发”（填回输入框） | 派研究：这家桌面端有没有、数据在哪 |
| workbuddy | · | · | · | ? /m/（10-19 负责人）：每轮“改了再发”（填回输入框） | 派研究：这家桌面端有没有、数据在哪 |
| opencode | · | · | · | ? /m/（10-19 负责人）：每轮“改了再发”（填回输入框） | 派研究：这家桌面端有没有、数据在哪 |
| hermes | · | · | · | ? /m/（10-19 负责人）：每轮“改了再发”（填回输入框） | 派研究：这家桌面端有没有、数据在哪 |
| gemini | · | · | · | ? /m/（10-19 负责人）：每轮“改了再发”（填回输入框） | 派研究：这家桌面端有没有、数据在哪 |
| droid | · | · | · | ? /m/（10-19 负责人）：每轮“改了再发”（填回输入框） | 派研究：这家桌面端有没有、数据在哪 |

## 产出预览（ui-artifact-preview）

网页、图片、文档等产出在旁边打开看。怎样算支持：打开的就是智能体交出的那份。类别：人机交互·产出物（候选，10-18 桌面端对照补登）。

**理论上限**：人机交互单元，上限取决于它依赖的单元在原生接口和我们的后端能否拿到数据（桌面端对照：Claude 桌面应用（负责人所在宿主，手上工具可证）；Codex、Antigravity、ZCode 桌面端待核；依赖：artifact、dev-preview）。

| 产品 | 桌面端界面 | 原生接口 | 适配器与我们的后端 | 网页 | 差距与下一步 |
|---|---|---|---|---|---|
| antigravity | · | · | · | ✓ /m/ v2（10-18 负责人重写）：详情页“产出”：列出文件，点开看（Markdown 排版、图 | 已到前端 |
| codex | · | · | · | ✓ /m/ v2（10-18 负责人重写）：详情页“产出”：列出文件，点开看（Markdown 排版、图 | 已到前端 |
| claude | · | · | · | ✓ /m/ v2（10-18 负责人重写）：详情页“产出”：列出文件，点开看（Markdown 排版、图 | 已到前端 |
| zcode | · | · | · | ✓ /m/ v2（10-18 负责人重写）：详情页“产出”：列出文件，点开看（Markdown 排版、图 | 已到前端 |
| workbuddy | · | · | · | ✓ /m/ v2（10-18 负责人重写）：详情页“产出”：列出文件，点开看（Markdown 排版、图 | 已到前端 |
| opencode | · | · | · | ✓ /m/ v2（10-18 负责人重写）：详情页“产出”：列出文件，点开看（Markdown 排版、图 | 已到前端 |
| hermes | · | · | · | ✓ /m/ v2（10-18 负责人重写）：详情页“产出”：列出文件，点开看（Markdown 排版、图 | 已到前端 |
| gemini | · | · | · | ✓ /m/ v2（10-18 负责人重写）：详情页“产出”：列出文件，点开看（Markdown 排版、图 | 已到前端 |
| droid | · | · | · | ✓ /m/ v2（10-18 负责人重写）：详情页“产出”：列出文件，点开看（Markdown 排版、图 | 已到前端 |

## 复制与导出（ui-copy-export）

复制一条消息、导出整段对话。怎样算支持：复制和导出的内容完整。类别：人机交互·产出物（候选，10-18 桌面端对照补登）。

**理论上限**：人机交互单元，上限取决于它依赖的单元在原生接口和我们的后端能否拿到数据（桌面端对照：Claude 桌面应用（负责人所在宿主，手上工具可证）；Codex、Antigravity、ZCode 桌面端待核；依赖：observe-history）。

| 产品 | 桌面端界面 | 原生接口 | 适配器与我们的后端 | 网页 | 差距与下一步 |
|---|---|---|---|---|---|
| antigravity | · | · | · | ◐ /m/ v2（10-18 负责人重写）：智能体每段文字下“复 | 派研究：这家桌面端有没有、数据在哪 |
| codex | · | · | · | ◐ /m/ v2（10-18 负责人重写）：智能体每段文字下“复 | 派研究：这家桌面端有没有、数据在哪 |
| claude | · | · | · | ◐ /m/ v2（10-18 负责人重写）：智能体每段文字下“复 | 派研究：这家桌面端有没有、数据在哪 |
| zcode | · | · | · | ◐ /m/ v2（10-18 负责人重写）：智能体每段文字下“复 | 派研究：这家桌面端有没有、数据在哪 |
| workbuddy | · | · | · | ◐ /m/ v2（10-18 负责人重写）：智能体每段文字下“复 | 派研究：这家桌面端有没有、数据在哪 |
| opencode | · | · | · | ◐ /m/ v2（10-18 负责人重写）：智能体每段文字下“复 | 派研究：这家桌面端有没有、数据在哪 |
| hermes | · | · | · | ◐ /m/ v2（10-18 负责人重写）：智能体每段文字下“复 | 派研究：这家桌面端有没有、数据在哪 |
| gemini | · | · | · | ◐ /m/ v2（10-18 负责人重写）：智能体每段文字下“复 | 派研究：这家桌面端有没有、数据在哪 |
| droid | · | · | · | ◐ /m/ v2（10-18 负责人重写）：智能体每段文字下“复 | 派研究：这家桌面端有没有、数据在哪 |

## 通知（ui-notify）

完成、要审批、出错、提问时提醒人，手机上也收得到。怎样算支持：事件发生后很快收到提醒。类别：人机交互·通知（候选，10-18 桌面端对照补登）。

**理论上限**：消息推到人看得见的地方（手机、桌面通知）（靠 宿主的通知；中心推送）。根本限制：外部推送通道（https、企业微信等）要另外开通。原生做不到时最多补齐到：页面开着时提示、标题计数，代价：页面关着就收不到。

| 产品 | 桌面端界面 | 原生接口 | 适配器与我们的后端 | 网页 | 差距与下一步 |
|---|---|---|---|---|---|
| antigravity | · | · | · | ◐ /m/（10-19 负责人）：有新的“等你回答 / 等你批” | 派研究：这家桌面端有没有、数据在哪 |
| codex | · | · | · | ◐ /m/（10-19 负责人）：有新的“等你回答 / 等你批” | 派研究：这家桌面端有没有、数据在哪 |
| claude | · | · | · | ◐ /m/（10-19 负责人）：有新的“等你回答 / 等你批” | 派研究：这家桌面端有没有、数据在哪 |
| zcode | · | · | · | ◐ /m/（10-19 负责人）：有新的“等你回答 / 等你批” | 派研究：这家桌面端有没有、数据在哪 |
| workbuddy | · | · | · | ◐ /m/（10-19 负责人）：有新的“等你回答 / 等你批” | 派研究：这家桌面端有没有、数据在哪 |
| opencode | · | · | · | ◐ /m/（10-19 负责人）：有新的“等你回答 / 等你批” | 派研究：这家桌面端有没有、数据在哪 |
| hermes | · | · | · | ◐ /m/（10-19 负责人）：有新的“等你回答 / 等你批” | 派研究：这家桌面端有没有、数据在哪 |
| gemini | · | · | · | ◐ /m/（10-19 负责人）：有新的“等你回答 / 等你批” | 派研究：这家桌面端有没有、数据在哪 |
| droid | · | · | · | ◐ /m/（10-19 负责人）：有新的“等你回答 / 等你批” | 派研究：这家桌面端有没有、数据在哪 |

## 多端同一状态（ui-multidevice）

手机、网页、桌面看到同一个会话的同一进度。怎样算支持：一端发话，另一端几秒内看到。类别：人机交互·通知（候选，10-18 桌面端对照补登）。

**理论上限**：人机交互单元，上限取决于它依赖的单元在原生接口和我们的后端能否拿到数据（桌面端对照：Claude 桌面应用（负责人所在宿主，手上工具可证）；Codex、Antigravity、ZCode 桌面端待核；依赖：observe-live）。

| 产品 | 桌面端界面 | 原生接口 | 适配器与我们的后端 | 网页 | 差距与下一步 |
|---|---|---|---|---|---|
| antigravity | · | · | · | · | 派研究：这家桌面端有没有、数据在哪 |
| codex | · | · | · | · | 派研究：这家桌面端有没有、数据在哪 |
| claude | · | · | · | · | 派研究：这家桌面端有没有、数据在哪 |
| zcode | · | · | · | · | 派研究：这家桌面端有没有、数据在哪 |
| workbuddy | · | · | · | · | 派研究：这家桌面端有没有、数据在哪 |
| opencode | · | · | · | · | 派研究：这家桌面端有没有、数据在哪 |
| hermes | · | · | · | · | 派研究：这家桌面端有没有、数据在哪 |

## 外观（ui-theme）

深浅色跟随系统，字号适合手机。怎样算支持：手机上不用放大就能读。类别：人机交互·设置（候选，10-18 桌面端对照补登）。

**理论上限**：人机交互单元，上限取决于它依赖的单元在原生接口和我们的后端能否拿到数据（桌面端对照：Claude 桌面应用（负责人所在宿主，手上工具可证）；Codex、Antigravity、ZCode 桌面端待核；依赖：（无））。

| 产品 | 桌面端界面 | 原生接口 | 适配器与我们的后端 | 网页 | 差距与下一步 |
|---|---|---|---|---|---|
| antigravity | · | · | · | ✓ /m/ v2（10-18 负责人重写）：深浅色跟随系统 | 已到前端 |
| codex | · | · | · | ✓ /m/ v2（10-18 负责人重写）：深浅色跟随系统 | 已到前端 |
| claude | · | · | · | ✓ /m/ v2（10-18 负责人重写）：深浅色跟随系统 | 已到前端 |
| zcode | · | · | · | ✓ /m/ v2（10-18 负责人重写）：深浅色跟随系统 | 已到前端 |
| workbuddy | · | · | · | ✓ /m/ v2（10-18 负责人重写）：深浅色跟随系统 | 已到前端 |
| opencode | · | · | · | ✓ /m/ v2（10-18 负责人重写）：深浅色跟随系统 | 已到前端 |
| hermes | · | · | · | ✓ /m/ v2（10-18 负责人重写）：深浅色跟随系统 | 已到前端 |
| gemini | · | · | · | ✓ /m/ v2（10-18 负责人重写）：深浅色跟随系统 | 已到前端 |
| droid | · | · | · | ✓ /m/ v2（10-18 负责人重写）：深浅色跟随系统 | 已到前端 |

## 页面反馈（ui-feedback）

在页面上直接写意见、粘贴截图，留给维护的人。怎样算支持：提交后在 ~/.agent-hub/feedback 里看得到。类别：人机交互·设置（候选，10-18 桌面端对照补登）。

**理论上限**：人机交互单元，上限取决于它依赖的单元在原生接口和我们的后端能否拿到数据（桌面端对照：Claude 桌面应用（负责人所在宿主，手上工具可证）；Codex、Antigravity、ZCode 桌面端待核；依赖：（hub 自己的功能））。

| 产品 | 桌面端界面 | 原生接口 | 适配器与我们的后端 | 网页 | 差距与下一步 |
|---|---|---|---|---|---|
| antigravity | · | · | · | ✓ /m/ v2（10-18 负责人重写）：反馈：写字、粘贴或选图 | 已到前端 |
| codex | · | · | · | ✓ /m/ v2（10-18 负责人重写）：反馈：写字、粘贴或选图 | 已到前端 |
| claude | · | · | · | ✓ /m/ v2（10-18 负责人重写）：反馈：写字、粘贴或选图 | 已到前端 |
| zcode | · | · | · | ✓ /m/ v2（10-18 负责人重写）：反馈：写字、粘贴或选图 | 已到前端 |
| workbuddy | · | · | · | ✓ /m/ v2（10-18 负责人重写）：反馈：写字、粘贴或选图 | 已到前端 |
| opencode | · | · | · | ✓ /m/ v2（10-18 负责人重写）：反馈：写字、粘贴或选图 | 已到前端 |
| hermes | · | · | · | ✓ /m/ v2（10-18 负责人重写）：反馈：写字、粘贴或选图 | 已到前端 |
| gemini | · | · | · | ✓ /m/ v2（10-18 负责人重写）：反馈：写字、粘贴或选图 | 已到前端 |
| droid | · | · | · | ✓ /m/ v2（10-18 负责人重写）：反馈：写字、粘贴或选图 | 已到前端 |

## 待处理流（ui-attention-feed）

跨会话把事件归成要你处理、要你审批、已交付、在推进、旁观五类，要你决定的排最前；可划掉、可撤销。怎样算支持：每个事件都归到一类，没有悄悄丢掉的；要你决定的始终在最上面。类别：人机交互·导航（候选，10-18 开源对照补登）。

**理论上限**：人机交互单元，上限取决于它依赖的单元在原生接口和我们的后端能否拿到数据（开源对照：OpenRig 网页工作台（docs/as-built/ui/*.md，10-18 补读）；依赖：state、ask-user、permission、act-deliver、notify-user）。

| 产品 | 桌面端界面 | 原生接口 | 适配器与我们的后端 | 网页 | 差距与下一步 |
|---|---|---|---|---|---|
| antigravity | · | · | · | ✓ /m/ v2（10-18 负责人重写）：智能体自己开的（SDK 拉起且非 hub 跑）和 probe | 已到前端 |
| codex | · | · | · | ✓ /m/ v2（10-18 负责人重写）：智能体自己开的（SDK 拉起且非 hub 跑）和 probe | 已到前端 |
| claude | · | · | · | ✓ /m/ v2（10-18 负责人重写）：智能体自己开的（SDK 拉起且非 hub 跑）和 probe | 已到前端 |
| zcode | · | · | · | ✓ /m/ v2（10-18 负责人重写）：智能体自己开的（SDK 拉起且非 hub 跑）和 probe | 已到前端 |
| workbuddy | · | · | · | ✓ /m/ v2（10-18 负责人重写）：智能体自己开的（SDK 拉起且非 hub 跑）和 probe | 已到前端 |
| opencode | · | · | · | ✓ /m/ v2（10-18 负责人重写）：智能体自己开的（SDK 拉起且非 hub 跑）和 probe | 已到前端 |
| hermes | · | · | · | ✓ /m/ v2（10-18 负责人重写）：智能体自己开的（SDK 拉起且非 hub 跑）和 probe | 已到前端 |
| gemini | · | · | · | ✓ /m/ v2（10-18 负责人重写）：智能体自己开的（SDK 拉起且非 hub 跑）和 probe | 已到前端 |
| droid | · | · | · | ✓ /m/ v2（10-18 负责人重写）：智能体自己开的（SDK 拉起且非 hub 跑）和 probe | 已到前端 |

## 活动标记（ui-activity-ring）

每个会话卡片标出在干活、在等输入、卡住，以及上下文占用和 token。怎样算支持：标记和实际状态一致，几秒内变化。类别：人机交互·显示（候选，10-18 开源对照补登）。

**理论上限**：人机交互单元，上限取决于它依赖的单元在原生接口和我们的后端能否拿到数据（开源对照：OpenRig 网页工作台（docs/as-built/ui/*.md，10-18 补读）；依赖：state、wake-stall、observe-history）。

| 产品 | 桌面端界面 | 原生接口 | 适配器与我们的后端 | 网页 | 差距与下一步 |
|---|---|---|---|---|---|
| antigravity | · | · | · | · | 派研究：这家桌面端有没有、数据在哪 |
| codex | · | · | · | · | 派研究：这家桌面端有没有、数据在哪 |
| claude | · | · | · | · | 派研究：这家桌面端有没有、数据在哪 |
| zcode | · | · | · | · | 派研究：这家桌面端有没有、数据在哪 |
| workbuddy | · | · | · | · | 派研究：这家桌面端有没有、数据在哪 |
| opencode | · | · | · | · | 派研究：这家桌面端有没有、数据在哪 |
| hermes | · | · | · | · | 派研究：这家桌面端有没有、数据在哪 |

## 项目分栏（ui-project-tabs）

项目页按概览、进度、产出物、证据（截图视频）、队列分栏看。怎样算支持：每一栏的内容来自这个项目下的会话，和实际一致。类别：人机交互·显示（候选，10-18 开源对照补登）。

**理论上限**：人机交互单元，上限取决于它依赖的单元在原生接口和我们的后端能否拿到数据（开源对照：OpenRig 网页工作台（docs/as-built/ui/*.md，10-18 补读）；依赖：project-view、artifact、task-board）。

| 产品 | 桌面端界面 | 原生接口 | 适配器与我们的后端 | 网页 | 差距与下一步 |
|---|---|---|---|---|---|
| antigravity | · | · | · | · | 派研究：这家桌面端有没有、数据在哪 |
| codex | · | · | · | · | 派研究：这家桌面端有没有、数据在哪 |
| claude | · | · | · | · | 派研究：这家桌面端有没有、数据在哪 |
| zcode | · | · | · | · | 派研究：这家桌面端有没有、数据在哪 |
| workbuddy | · | · | · | · | 派研究：这家桌面端有没有、数据在哪 |
| opencode | · | · | · | · | 派研究：这家桌面端有没有、数据在哪 |
| hermes | · | · | · | · | 派研究：这家桌面端有没有、数据在哪 |

## 终端镜像预览（ui-terminal-preview）

先给智能体终端的静态镜像，点了才连实时，并限制同时连的数量。怎样算支持：镜像和终端实际内容一致，实时连接数不超过上限。类别：人机交互·显示（候选，10-18 开源对照补登）。

**理论上限**：执行命令并取回输出（靠 宿主的命令工具）。根本限制：权限模式不允许就不能。原生做不到时最多补齐到：——。

| 产品 | 桌面端界面 | 原生接口 | 适配器与我们的后端 | 网页 | 差距与下一步 |
|---|---|---|---|---|---|
| antigravity | · | · | · | · | 派研究：这家桌面端有没有、数据在哪 |
| codex | · | · | · | · | 派研究：这家桌面端有没有、数据在哪 |
| claude | · | · | · | · | 派研究：这家桌面端有没有、数据在哪 |
| zcode | · | · | · | · | 派研究：这家桌面端有没有、数据在哪 |
| workbuddy | · | · | · | · | 派研究：这家桌面端有没有、数据在哪 |
| opencode | · | · | · | · | 派研究：这家桌面端有没有、数据在哪 |
| hermes | · | · | · | · | 派研究：这家桌面端有没有、数据在哪 |

## 实时连接提示（ui-live-indicator）

实时更新断了就明确写出来，恢复后自动补齐。怎样算支持：断线几秒内出现提示，恢复后数据补全。类别：人机交互·显示（候选，10-18 开源对照补登）。

**理论上限**：人机交互单元，上限取决于它依赖的单元在原生接口和我们的后端能否拿到数据（开源对照：OpenRig 网页工作台（docs/as-built/ui/*.md，10-18 补读）；依赖：observe-live）。

| 产品 | 桌面端界面 | 原生接口 | 适配器与我们的后端 | 网页 | 差距与下一步 |
|---|---|---|---|---|---|
| antigravity | · | · | · | · | 派研究：这家桌面端有没有、数据在哪 |
| codex | · | · | · | · | 派研究：这家桌面端有没有、数据在哪 |
| claude | · | · | · | · | 派研究：这家桌面端有没有、数据在哪 |
| zcode | · | · | · | · | 派研究：这家桌面端有没有、数据在哪 |
| workbuddy | · | · | · | · | 派研究：这家桌面端有没有、数据在哪 |
| opencode | · | · | · | · | 派研究：这家桌面端有没有、数据在哪 |
| hermes | · | · | · | · | 派研究：这家桌面端有没有、数据在哪 |

## 待办看板（ui-todo-board）

智能体自己拆的任务清单按待办、进行中、完成显示，带优先级和顺序。怎样算支持：清单内容和状态与智能体记录一致。类别：人机交互·显示（候选，10-18 桌面端调研补登）。

**理论上限**：人机交互单元，上限取决于它依赖的单元在原生接口和我们的后端能否拿到数据（桌面端事实调研 channels/probe/results/hci-desktop-facts-20261018.md（Antigravity 10-18，负责人核过）：ZCode 本地库 todo 表 2351 条；WorkBuddy、）。

| 产品 | 桌面端界面 | 原生接口 | 适配器与我们的后端 | 网页 | 差距与下一步 |
|---|---|---|---|---|---|
| antigravity | · | · | · | ◐ /m/ v2（10-18 负责人重写）：同上（会话内计划清单 | 派研究：这家桌面端有没有、数据在哪 |
| codex | · | · | · | ◐ /m/ v2（10-18 负责人重写）：同上（会话内计划清单 | 派研究：这家桌面端有没有、数据在哪 |
| claude | · | · | · | ◐ /m/ v2（10-18 负责人重写）：同上（会话内计划清单 | 派研究：这家桌面端有没有、数据在哪 |
| zcode | · | · | · | ◐ /m/ v2（10-18 负责人重写）：同上（会话内计划清单 | 派研究：这家桌面端有没有、数据在哪 |
| workbuddy | · | · | · | ◐ /m/ v2（10-18 负责人重写）：同上（会话内计划清单 | 派研究：这家桌面端有没有、数据在哪 |
| opencode | · | · | · | ◐ /m/ v2（10-18 负责人重写）：同上（会话内计划清单 | 派研究：这家桌面端有没有、数据在哪 |
| hermes | · | · | · | ◐ /m/ v2（10-18 负责人重写）：同上（会话内计划清单 | 派研究：这家桌面端有没有、数据在哪 |
| gemini | · | · | · | ◐ /m/ v2（10-18 负责人重写）：同上（会话内计划清单 | 派研究：这家桌面端有没有、数据在哪 |
| droid | · | · | · | ◐ /m/ v2（10-18 负责人重写）：同上（会话内计划清单 | 派研究：这家桌面端有没有、数据在哪 |

## 自定义分组（ui-thread-sections）

人自己建分组，把会话归进去，不只按工作目录。怎样算支持：分组和组内会话刷新后还在。类别：人机交互·导航（候选，10-18 桌面端调研补登）。

**理论上限**：人机交互单元，上限取决于它依赖的单元在原生接口和我们的后端能否拿到数据（桌面端事实调研 channels/probe/results/hci-desktop-facts-20261018.md（Antigravity 10-18，负责人核过）：Codex state_5.sqlite thread_sectio）。

| 产品 | 桌面端界面 | 原生接口 | 适配器与我们的后端 | 网页 | 差距与下一步 |
|---|---|---|---|---|---|
| antigravity | · | · | · | · | 派研究：这家桌面端有没有、数据在哪 |
| codex | · | · | · | · | 派研究：这家桌面端有没有、数据在哪 |
| claude | · | · | · | · | 派研究：这家桌面端有没有、数据在哪 |
| zcode | · | · | · | · | 派研究：这家桌面端有没有、数据在哪 |
| workbuddy | · | · | · | · | 派研究：这家桌面端有没有、数据在哪 |
| opencode | · | · | · | · | 派研究：这家桌面端有没有、数据在哪 |
| hermes | · | · | · | · | 派研究：这家桌面端有没有、数据在哪 |

## 分支与提交标记（ui-git-badge）

会话卡片上写它在哪个分支、哪个提交上干活。怎样算支持：标记和会话记录的分支、提交一致。类别：人机交互·显示（候选，10-18 桌面端调研补登）。

**理论上限**：人机交互单元，上限取决于它依赖的单元在原生接口和我们的后端能否拿到数据（桌面端事实调研 channels/probe/results/hci-desktop-facts-20261018.md（Antigravity 10-18，负责人核过）：Codex threads.git_branch、git_sha；依）。

| 产品 | 桌面端界面 | 原生接口 | 适配器与我们的后端 | 网页 | 差距与下一步 |
|---|---|---|---|---|---|
| antigravity | · | · | · | · | 派研究：这家桌面端有没有、数据在哪 |
| codex | · | · | · | · | 派研究：这家桌面端有没有、数据在哪 |
| claude | · | · | · | · | 派研究：这家桌面端有没有、数据在哪 |
| zcode | · | · | · | · | 派研究：这家桌面端有没有、数据在哪 |
| workbuddy | · | · | · | · | 派研究：这家桌面端有没有、数据在哪 |
| opencode | · | · | · | · | 派研究：这家桌面端有没有、数据在哪 |
| hermes | · | · | · | · | 派研究：这家桌面端有没有、数据在哪 |

## 对话内交互组件（ui-generative-embed）

智能体在回复里放可操作的图表、表单等小组件，直接在对话里用。怎样算支持：组件能显示、能操作，和智能体给的一致。类别：人机交互·显示（候选，10-18 桌面端调研补登）。

**理论上限**：人机交互单元，上限取决于它依赖的单元在原生接口和我们的后端能否拿到数据（桌面端事实调研 channels/probe/results/hci-desktop-facts-20261018.md（Antigravity 10-18，负责人核过）：Antigravity generative_ui、agent-em）。

| 产品 | 桌面端界面 | 原生接口 | 适配器与我们的后端 | 网页 | 差距与下一步 |
|---|---|---|---|---|---|
| antigravity | · | · | · | · | 派研究：这家桌面端有没有、数据在哪 |
| codex | · | · | · | · | 派研究：这家桌面端有没有、数据在哪 |
| claude | · | · | · | · | 派研究：这家桌面端有没有、数据在哪 |
| zcode | · | · | · | · | 派研究：这家桌面端有没有、数据在哪 |
| workbuddy | · | · | · | · | 派研究：这家桌面端有没有、数据在哪 |
| opencode | · | · | · | · | 派研究：这家桌面端有没有、数据在哪 |
| hermes | · | · | · | · | 派研究：这家桌面端有没有、数据在哪 |

## 定时任务台（ui-automation-scheduler）

建、改、暂停周期定时任务，看每次执行记录。怎样算支持：到点自动跑，记录可查。类别：人机交互·运行控制（候选，10-18 桌面端调研补登）。

**理论上限**：人机交互单元，上限取决于它依赖的单元在原生接口和我们的后端能否拿到数据（桌面端事实调研 channels/probe/results/hci-desktop-facts-20261018.md（Antigravity 10-18，负责人核过）：WorkBuddy workbuddy.db automations）。

| 产品 | 桌面端界面 | 原生接口 | 适配器与我们的后端 | 网页 | 差距与下一步 |
|---|---|---|---|---|---|
| antigravity | · | · | · | · | 派研究：这家桌面端有没有、数据在哪 |
| codex | · | · | · | · | 派研究：这家桌面端有没有、数据在哪 |
| claude | · | · | · | · | 派研究：这家桌面端有没有、数据在哪 |
| zcode | · | · | · | · | 派研究：这家桌面端有没有、数据在哪 |
| workbuddy | · | · | · | · | 派研究：这家桌面端有没有、数据在哪 |
| opencode | · | · | · | · | 派研究：这家桌面端有没有、数据在哪 |
| hermes | · | · | · | · | 派研究：这家桌面端有没有、数据在哪 |

## 分享链接（ui-share-link）

一键生成会话的只读链接给别人看。怎样算支持：别人打开链接能看到这段会话。类别：人机交互·产出物（候选，10-18 桌面端调研补登）。

**理论上限**：人机交互单元，上限取决于它依赖的单元在原生接口和我们的后端能否拿到数据（桌面端事实调研 channels/probe/results/hci-desktop-facts-20261018.md（Antigravity 10-18，负责人核过）：ZCode session.share_url；依赖：observe）。

| 产品 | 桌面端界面 | 原生接口 | 适配器与我们的后端 | 网页 | 差距与下一步 |
|---|---|---|---|---|---|
| antigravity | · | · | · | · | 派研究：这家桌面端有没有、数据在哪 |
| codex | · | · | · | · | 派研究：这家桌面端有没有、数据在哪 |
| claude | · | · | · | · | 派研究：这家桌面端有没有、数据在哪 |
| zcode | · | · | · | · | 派研究：这家桌面端有没有、数据在哪 |
| workbuddy | · | · | · | · | 派研究：这家桌面端有没有、数据在哪 |
| opencode | · | · | · | · | 派研究：这家桌面端有没有、数据在哪 |
| hermes | · | · | · | · | 派研究：这家桌面端有没有、数据在哪 |

## 输入历史（ui-input-history）

在输入框里翻出以前发过的话再发。怎样算支持：翻出的内容和以前发的一致。类别：人机交互·输入（候选，10-18 桌面端调研补登）。

**理论上限**：人机交互单元，上限取决于它依赖的单元在原生接口和我们的后端能否拿到数据（桌面端事实调研 channels/probe/results/hci-desktop-facts-20261018.md（Antigravity 10-18，负责人核过）：ZCode input_history 表；依赖：ui-compos）。

| 产品 | 桌面端界面 | 原生接口 | 适配器与我们的后端 | 网页 | 差距与下一步 |
|---|---|---|---|---|---|
| antigravity | · | · | · | · | 派研究：这家桌面端有没有、数据在哪 |
| codex | · | · | · | · | 派研究：这家桌面端有没有、数据在哪 |
| claude | · | · | · | · | 派研究：这家桌面端有没有、数据在哪 |
| zcode | · | · | · | · | 派研究：这家桌面端有没有、数据在哪 |
| workbuddy | · | · | · | · | 派研究：这家桌面端有没有、数据在哪 |
| opencode | · | · | · | · | 派研究：这家桌面端有没有、数据在哪 |
| hermes | · | · | · | · | 派研究：这家桌面端有没有、数据在哪 |

## 扣费明细（ui-credit-ledger）

每一轮花了多少钱或积分。怎样算支持：数字和各家账本一致。类别：人机交互·显示（候选，10-18 桌面端调研补登）。

**理论上限**：人机交互单元，上限取决于它依赖的单元在原生接口和我们的后端能否拿到数据（桌面端事实调研 channels/probe/results/hci-desktop-facts-20261018.md（Antigravity 10-18，负责人核过）：WorkBuddy session_usage.credit_jso）。

| 产品 | 桌面端界面 | 原生接口 | 适配器与我们的后端 | 网页 | 差距与下一步 |
|---|---|---|---|---|---|
| antigravity | · | · | · | · | 派研究：这家桌面端有没有、数据在哪 |
| codex | · | · | · | · | 派研究：这家桌面端有没有、数据在哪 |
| claude | · | · | · | · | 派研究：这家桌面端有没有、数据在哪 |
| zcode | · | · | · | · | 派研究：这家桌面端有没有、数据在哪 |
| workbuddy | · | · | · | · | 派研究：这家桌面端有没有、数据在哪 |
| opencode | · | · | · | · | 派研究：这家桌面端有没有、数据在哪 |
| hermes | · | · | · | · | 派研究：这家桌面端有没有、数据在哪 |

## 剩余额度条（ui-quota-bar）

当前套餐还剩多少、窗口什么时候重置。怎样算支持：和各家额度接口一致。类别：人机交互·显示（候选，10-18 桌面端调研补登）。

**理论上限**：人机交互单元，上限取决于它依赖的单元在原生接口和我们的后端能否拿到数据（桌面端事实调研 channels/probe/results/hci-desktop-facts-20261018.md（Antigravity 10-18，负责人核过）：Antigravity RetrieveUserQuotaSumma）。

| 产品 | 桌面端界面 | 原生接口 | 适配器与我们的后端 | 网页 | 差距与下一步 |
|---|---|---|---|---|---|
| antigravity | · | · | · | · | 派研究：这家桌面端有没有、数据在哪 |
| codex | · | · | · | · | 派研究：这家桌面端有没有、数据在哪 |
| claude | · | · | · | · | 派研究：这家桌面端有没有、数据在哪 |
| zcode | · | · | · | · | 派研究：这家桌面端有没有、数据在哪 |
| workbuddy | · | · | · | · | 派研究：这家桌面端有没有、数据在哪 |
| opencode | · | · | · | · | 派研究：这家桌面端有没有、数据在哪 |
| hermes | · | · | · | · | 派研究：这家桌面端有没有、数据在哪 |

## 回顾对话记录（recall-history）

智能体在会话进行中翻回它和人过去的对话记录，包括已被压缩掉的部分和人的原话，按轮次、关键词或说话人取用。怎样算支持：智能体取回很早或已压缩的原话并据此回答，取回的内容和记录一致。类别：智能体的动作（候选，10-19 用户要求补登）。

**理论上限**：还没推（完整性检查 4.2 未覆盖）。

| 产品 | 桌面端界面 | 原生接口 | 适配器与我们的后端 | 网页 | 差距与下一步 |
|---|---|---|---|---|---|
| antigravity | · | · | ◐ agent_gateway.js recall --agen | · | 派研究：先推理论上限，再探查 |
| codex | · | · | ◐ agent_gateway.js recall --agen | · | 派研究：先推理论上限，再探查 |
| claude | · | · | ◐ agent_gateway.js recall --agen | · | 派研究：先推理论上限，再探查 |
| zcode | · | · | ◐ agent_gateway.js recall --agen | · | 派研究：先推理论上限，再探查 |
| workbuddy | · | · | ◐ agent_gateway.js recall --agen | · | 派研究：先推理论上限，再探查 |
| opencode | · | · | ◐ agent_gateway.js recall --agen | · | 派研究：先推理论上限，再探查 |
| hermes | · | · | ◐ agent_gateway.js recall --agen | · | 派研究：先推理论上限，再探查 |

## 操作电脑（computer-use）

按指令看屏幕、点击、输入，在桌面应用里完成一件事并交回结果。怎样算支持：指定一件桌面操作（例如在某个应用里打开某处、填一项），做完后结果可以由别人核对。类别：高阶能力（候选，10-19 用户要求补登）。

**理论上限**：还没推（完整性检查 4.2 未覆盖）。

| 产品 | 桌面端界面 | 原生接口 | 适配器与我们的后端 | 网页 | 差距与下一步 |
|---|---|---|---|---|---|
| antigravity | · | · | · | · | 派研究：先推理论上限，再探查 |
| codex | · | · | · | · | 派研究：先推理论上限，再探查 |
| claude | · | · | · | · | 派研究：先推理论上限，再探查 |
| zcode | · | · | · | · | 派研究：先推理论上限，再探查 |
| workbuddy | · | · | · | · | 派研究：先推理论上限，再探查 |
| opencode | · | · | · | · | 派研究：先推理论上限，再探查 |
| hermes | · | · | · | · | 派研究：先推理论上限，再探查 |

## 联网搜索（web-search）

按问题检索网页，返回带来源链接的结果。怎样算支持：返回的链接能打开，内容和结论对得上。类别：高阶能力（候选，10-19 用户要求补登）。

**理论上限**：还没推（完整性检查 4.2 未覆盖）。

| 产品 | 桌面端界面 | 原生接口 | 适配器与我们的后端 | 网页 | 差距与下一步 |
|---|---|---|---|---|---|
| antigravity | · | · | · | · | 派研究：先推理论上限，再探查 |
| codex | · | · | · | · | 派研究：先推理论上限，再探查 |
| claude | · | · | · | · | 派研究：先推理论上限，再探查 |
| zcode | · | · | · | · | 派研究：先推理论上限，再探查 |
| workbuddy | · | · | · | · | 派研究：先推理论上限，再探查 |
| opencode | · | · | · | · | 派研究：先推理论上限，再探查 |
| hermes | · | · | · | · | 派研究：先推理论上限，再探查 |

## 深度调研（deep-research）

多轮检索、阅读、比对后，写成带引用的报告。怎样算支持：报告里的引用可核对，问题的各个方面都有覆盖，结论有出处。类别：高阶能力（候选，10-19 用户要求补登）。

**理论上限**：还没推（完整性检查 4.2 未覆盖）。

| 产品 | 桌面端界面 | 原生接口 | 适配器与我们的后端 | 网页 | 差距与下一步 |
|---|---|---|---|---|---|
| antigravity | · | · | · | · | 派研究：先推理论上限，再探查 |
| codex | · | · | · | · | 派研究：先推理论上限，再探查 |
| claude | · | · | · | · | 派研究：先推理论上限，再探查 |
| zcode | · | · | · | · | 派研究：先推理论上限，再探查 |
| workbuddy | · | · | · | · | 派研究：先推理论上限，再探查 |
| opencode | · | · | · | · | 派研究：先推理论上限，再探查 |
| hermes | · | · | · | · | 派研究：先推理论上限，再探查 |

## 生成图片（image-gen）

按描述生成图片并存成文件。怎样算支持：图片文件存在，内容符合描述。类别：高阶能力（候选，10-19 用户要求补登）。

**理论上限**：还没推（完整性检查 4.2 未覆盖）。

| 产品 | 桌面端界面 | 原生接口 | 适配器与我们的后端 | 网页 | 差距与下一步 |
|---|---|---|---|---|---|
| antigravity | · | · | · | · | 派研究：先推理论上限，再探查 |
| codex | · | · | · | · | 派研究：先推理论上限，再探查 |
| claude | · | · | · | · | 派研究：先推理论上限，再探查 |
| zcode | · | · | · | · | 派研究：先推理论上限，再探查 |
| workbuddy | · | · | · | · | 派研究：先推理论上限，再探查 |
| opencode | · | · | · | · | 派研究：先推理论上限，再探查 |
| hermes | · | · | · | · | 派研究：先推理论上限，再探查 |

## 生成办公文档（office-docs）

生成或修改演示文稿、文档、表格文件。怎样算支持：文件能用对应软件打开，内容和格式符合要求。类别：高阶能力（候选，10-19 用户要求补登）。

**理论上限**：还没推（完整性检查 4.2 未覆盖）。

| 产品 | 桌面端界面 | 原生接口 | 适配器与我们的后端 | 网页 | 差距与下一步 |
|---|---|---|---|---|---|
| antigravity | · | · | · | · | 派研究：先推理论上限，再探查 |
| codex | · | · | · | · | 派研究：先推理论上限，再探查 |
| claude | · | · | · | · | 派研究：先推理论上限，再探查 |
| zcode | · | · | · | · | 派研究：先推理论上限，再探查 |
| workbuddy | · | · | · | · | 派研究：先推理论上限，再探查 |
| opencode | · | · | · | · | 派研究：先推理论上限，再探查 |
| hermes | · | · | · | · | 派研究：先推理论上限，再探查 |
