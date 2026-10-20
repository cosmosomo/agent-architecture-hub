# ACP 常驻桥 · 卷宗

议题：ZCode、WorkBuddy、OpenCode、Hermes 经 ACP 能做到哪一步，断在哪。研究员：ZCode · research-acp。
范围（briefs/zcode-现状.md）：这一片 77 单元 × 四家 × 四位置；边界清单 131 格（zcode-边界.md）。

## 10-20 凌晨（边界清单第二轮）：9 格 + 静默注入入口

黑板 2356–2364（research-acp）：

- **inject-silent@WB（2356，理论上限达成）**：`session/inject_history` 传 `{sessionId, messages:[{role,content}]}` 返回 `{injected:1}`，**瞬间返回零模型轮**（skipRun 构建），下一轮模型答出注入的静默暗号。这是 ACP 标准里没有的 WB 扩展方法——理论上限在 WB 有原生口。坑：参数键是 `messages` 不是 `items`；注入内容会被 WB 自动记忆当事实写进记忆文件，驱动要自行决定放不放行。
- **steer@WB（2357）**：`session/steer` 传 `{sessionId, contentBlocks:[{type:'text',text}]}` 返回 `{steered:true,ownerRequestId}`，插话在**同一个 session/prompt 调用内**被消费（模型照改：数到 5 + STEER-WB-OK）。上轮"参数形状待定"解决。
- **permission@WB/HM/OC（2363/2364/2360）**：三家适配位置全通——WB 真活闭环 3 帧应答、HM 编辑审批 allow 后同轮落盘、OC 越界写触发 external_directory ask（带 locations 请求原文）allow 后落盘（OC 的 allow_once 不粘第二帧）。
- **OC 四格（2358–2361）**：open-idle（session/new 零 chunk + session/list 可查）、model-switch（big-pickle→zhipuai-glm-5.3-flash，下一轮自报新 ID）、close（close 后 prompt 报 session not found）、permission 见上。
- **mode-switch@HM（2362，行为级）**：同会话 default 写文件 1 帧 edit 审批 → set_mode accept_edits 后 0 帧直接落盘，behaviorChanged=true。

仍未打：compact@WB/OC（判据要“用量下降”，需灌到阈值的大会话，留给额度宽裕窗口）、mount-tools@WB/OC、goal@四家行为级、OC steer（ACP 桥=排队，serve HTTP=插话，语义差异已记）。

## 10-19 晚（边界清单轮）：真活闭环与一批格子

**中心派真活、收回结果的闭环在四家全部打通**，另打通 fork×2、steer×1、inject-next×2、跨进程 resume×2。工具：新增驱动 `hub/tools/acp_resident_bridge.mjs`（task/fork/load/steer 四个子命令，可当库被 import；本片后续探针都从它走）。

### 关键信息（本轮新增）

- **真活闭环（act-deliver @适配，四家全通，实测）**：中心经常驻桥派一件真活（写指定产物文件、内容含暗号）→ 桥内审批/提问实时应答 → 收回产物并核验三行内容。WorkBuddy/ZCode 的暗号由**干活途中向人提问**得来（见下），OpenCode/Hermes 由中心指定。产物在 `channels/probe/scripts/output/closed-loop-2026-10-19/`，结果 JSON 同目录 loop-*.json。耗时 32–60s/件。
  - WorkBuddy（含提问，32s）：AskUserQuestion→allow→resolveInterruption，同轮采用答案。
  - ZCode（含提问，44s）：提问走 request_permission 选项式（苹果/香蕉/Skip）。
  - OpenCode（60s，无提问）、Hermes（33s，编辑审批 allow 后落盘）。
- **fork（实测）**：OpenCode **通**（新会话答出原会话暗号 FORK-UTQO，响应带 model/mode）；Hermes **通**（FORK-XCRO 答出，注意其跨会话长期记忆会掺入更早探针的旧暗号，严格归因需关记忆）；ZCode **语义不同**——`session/fork` 分的是**工作区检查点**（无检查点报 "No workspace checkpoint is available yet"，有检查点返回 forkedSessionId/targetCheckpointId），**对话历史不跟**，分叉会话自述"分叉点之前的对话不在我的上下文里"，按判据记不通，但正好是 rewind 的底座；WorkBuddy **桥无此方法**（Method not found，原生 fork 在 Web UI）。
- **steer / inject-next（实测，ACP 桥上发第二个 prompt 的三种语义）**：Hermes **本轮插话**（第二问立即返回 "Redirected the active turn"，第一轮改为数到 5 回"改为5-OK"）；WorkBuddy、OpenCode **排到下一轮**（第一轮完整跑完，插话独立成轮）。WorkBuddy 桥上 **`session/steer` 方法存在**（报 Invalid params 而非 Method not found，Web UI 协议同名方法，参数形状待定，可能是轮内插话正口）。对照：OpenCode serve HTTP 上同动作是轮内插话（native-opencode-20261019）——同一产品两种入口语义不同。
- **resume（实测，跨进程）**：ZCode **通**（进程 A 记暗号→关进程→进程 B `session/load` 同 id→答出暗号）；Hermes **通**（ACP 会话从 DB 恢复，日志 "Restored from DB (4 messages)"，模型准确复述上一进程的数数经过）。注意：`session/load` 必须带 `mcpServers: []`，否则 -32602。
- **resume-native 断点（Hermes）**：CLI 原生会话 id（`20261019_*` 格式）`session/load` 返回 **ok 但 history=0**，模型答"无上下文"——适配层 SessionManager 只认 ACP 键空间的会话，原生键能注册 provenance 却不带历史。要通需产品侧改（把原生会话映射进 ACP 键空间），已记边界。
- **OpenCode ACP 能力表副产品**：`loadSession:true` + sessionCapabilities{close,fork,list,resume}——close/fork/list/resume 四个方法面都有（close 正是边界清单里 zcode 缺的格子）。
- **WorkBuddy 认证坑（经验级）**：桥认证走桌面本地 BYOK（products.json env 的 `ACC_PRODUCT_CONFIG_V3` 静态 token），会间歇报 "Authentication required"（`~/.workbuddy/failover.json` 被改写的窗口），等几分钟重试即好；驱动曾因此连续失败 4 次、代码无辜。
- **驱动交付说明（给负责人过目）**：`hub/tools/acp_resident_bridge.mjs` 为本片新增，不改中心主体；它实现了常驻桥宿主侧的全部交互处理（审批放行、WB 三步提问流、ZCode 选项式提问、fs 读写委托、命令清单捕获），gateway.ts/acp_runtime.ts 接入网页端时可直接照抄这套处理逻辑。

### 本轮黑板行

research-acp 10-19 晚共 11 行：workbuddy ask-user pass、zcode act-deliver pass、opencode act-deliver pass、hermes act-deliver pass、opencode fork pass、hermes fork pass、zcode fork fail、workbuddy fork fail、hermes steer pass、workbuddy inject-next pass、opencode inject-next pass、zcode resume pass、hermes resume pass（以黑板实际为准）。

## 10-19 早（上一轮）：三家的同轮问答入口

**结论：三家都能在"智能体一轮里问人、人答回同一轮"，断点全都不在产品，在桥/宿主的接线。**WorkBuddy 新版 ACP 本身就通了；OpenCode 走 serve HTTP 通；Hermes 换宿主（gateway/SDK）通，只有 ACP 适配层还没接。

### 关键信息

- **WorkBuddy（ACP 直通，实测 pass）**：`codebuddy --acp` **2.168.2**（10-16 发布）上 AskUserQuestion 全流程通。时序：模型调 AskUserQuestion → 服务端发 `session/request_permission`（选项只有 allow_always/allow/reject，**问题内容在 `toolCall.rawInput.questions`**）→ 客户端回 allow → **客户端再主动调 extMethod `_codebuddy.ai/resolveInterruption`** `{sessionId, toolCallId, decision:"allow", answers:{<问题原文>:<答案>}}` → 返回 `{resolved:true}` → 同一轮采用答案（finalText"香蕉是个好选择…"，stopReason=end_turn）。answers 的 key 支持问题原文/`q_N`/问题 id，值可为字符串或数组。实测配置还在 initialize 声明了 `clientCapabilities._meta["codebuddy.ai"].question=true`（未 A/B 验证是否必需）。依据：试过，`channels/probe/scripts/probe_workbuddy_ask2_20261019.mjs` + `probe_wb_ask2_run4.log`；黑板 10-19 research-acp 行。
  - 对照：10-19 上午在 **2.160.0** 实测是 fail（`$.ui.ask` 未绑定 → deny）——见 ask-user-acp-20261019.md。**结论随版本翻转，引用时必须钉版本号。**
  - bundle 里另有 `_codebuddy.ai/question`（服务端带 schema.questions 问客户端、回 `{outcome:"submitted",answers:{q_0:…}}`）和 `_codebuddy.ai/sideQuestion`（/btw 侧问，fork 不扰主会话）的内嵌文档；但 `callAskUserQuestion` 在 headless bundle 无调用方，属死代码。依据：看到，dist/codebuddy-headless.js 2.168.2。
  - `interruption_request` sessionUpdate 通知实测从未出现——**客户端要看到 AskUserQuestion 的 tool_call/request_permission 后主动 resolve**，不能等通知。
- **OpenCode（serve HTTP 面，实测 pass）**：`opencode serve` 1.18.33 上 build agent 有 `question` 工具。流程：`POST /session/{sid}/prompt_async` → 轮询 `GET /question` 拿 pending（`que_…`，含 questions/选项，`tool.callID` 绑定当轮工具调用）→ `POST /question/{id}/reply` `{answers:[["香蕉"]]}` → 同一轮模型回复"你选择了：香蕉"。端点还有 `/question/{id}/reject`、`/api/session/{sid}/question[/...]`。依据：试过，`channels/probe/scripts/opencode/probe_ask_serve_20261019.mjs`。
  - 权限：内置默认 `question: deny` 在前、build agent 追加 `question: allow` 在后，**last-match-wins → allow 生效**（`opencode agent list` 可见两条；被 wholly-denied 的工具才会从模型工具箱剔除）。依据：看到，sst/opencode 源码与本机 agent list。
  - **修正**：native-opencode-20261019.md 记"headless build agent 没挂 question 工具"是误判——模型自述"没有工具"不可信，明确指令让它调工具后 pending 立刻出现。
  - ACP 桥上提问依旧不通（10-19 ask-user-acp-20261019.md：question 工具未桥接、声明 elicitation 会让 v1.18.33 桥崩溃，崩溃未复验）。
- **Hermes（换宿主通，ACP 适配层仍未接）**：
  - **SDK 宿主（实测 pass）**：给 `AIAgent` 注入 `clarify_callback` 后同轮问答通。clarify 批量形态 `questions=[{qid:"q0",question:"苹果还是香蕉？",choices:[…]}]`，宿主回 JSON `{"answers":{"q0":"香蕉"},"timed_out":false}`，模型同轮回"你选了香蕉 🍌 收到"。坑：**批量形态必须回 JSON dict，裸字符串被静默丢弃**（回调签名含 VAR_KEYWORD 即被当作支持 questions 批量）。依据：试过，`channels/probe/scripts/hermes/probe_sdk_clarify_20261019.py`。
  - **gateway 宿主（机制在，端到端未跑）**：`hermes gateway run` 的 run_turn_runner.py:1255 接了 `agent.clarify_callback` → `tools/clarify_gateway.py` 注册题卡、agent 线程阻塞在 `threading.Event`，平台适配器按钮或"下一条消息文本拦截"答题，答案回同轮；`clarify_timeout` 可配（非正数=无限等）。本机 `gateway_state.json` 的 `platforms:{}` 没配消息平台，所以只到"看到"级。
  - **ACP 适配层（断点确认）**：本地 0.21.x 与上游 master 的 `acp_adapter/server.py` 一致——`_TurnCallbacks` 只有 `approval_cb` + `edit_approval_requester`，clarify 无接线、无 env 开关（只有 `HERMES_ACP_SKIP_CONFIGURED_MCP`）。oneshot 明确禁问（回调返回"无人可用"哨兵）；CLI/TUI clarify 可用。依据：看到（源码），链接见出处。
- **ZCode（对照组，不变）**：ACP 桥原生同轮问答通（request_permission 选项化；声明 `elicitation.form` 还能走标准 elicitation/create）。见 ask-user-acp-20261019.md。
- **对中枢的接法建议（不动中心代码，交负责人）**：ZCode 照 3.1 方案直接接（识别带业务选项的 request_permission）；WorkBuddy 在 acp_runtime.ts 里加"AskUserQuestion 检测 → 自动 allow → 引导人答 → resolveInterruption(answers)"三步；OpenCode 若走 serve HTTP 驱动则 question/reply 现成可用（走 ACP 桥则依旧没有提问）；Hermes 要么等上游给 ACP 适配层补 clarify 接线，要么中枢自建宿主（SDK 级已证可行）。

## 经验（两轮合）

- **模型自述"我没有某工具"不可信**。OpenCode"没挂 question 工具"的误判就是这么来的；验证只有一条路：明确指令让它调工具，再看服务端帧/pending。
- **结论钉版本**。WorkBuddy 三天内 2.160.0 fail → 2.168.2 pass；探针报告、黑板行都要带版本。
- **先读内嵌文档再写探针**。codebuddy bundle 的字符串里有整段协议文档（unicode 转义），`node -e` 解码后能直接拿到 extMethod 名、参数、answers 形状，省了盲目试错。
- **探针先把原始帧落盘再打总结**。第一次 WorkBuddy 重测没存 chunk 文本，结论拿不到模型原话，被迫多跑一轮模型调用。
- **OpenCode 权限求值是 last-match-wins**：agent list 里 deny 在前、allow 在后 = allow 生效；读配置别只看有没有 deny。
- **Hermes 回调是"按能力分派"**：回调签名带 `questions`/VAR_KEYWORD 就走批量形态（要回 JSON），否则走单题形态（回字符串）。写宿主回调时两种都要备。
- **判 fork/记忆类格子要防长期记忆混淆**：hermes 的跨会话记忆会把别的会话的暗号也背出来（fork 验证时同时答出 QX-77、NATIVE-RESET-3355）；一次性随机暗号 + 关记忆重测才算铁。
- **同一个方法在不同入口语义可以不同**（OpenCode steer：serve HTTP=轮内插话，ACP 桥=排队）；换入口时不能照搬结论，要重测。
- **"Method not found" vs "Invalid params" 要分清**：前者方法不存在，后者方法在、参数形状不对——后者值得再挖参数（workbuddy session/steer 就是这么发现的）。
- 驱动开发先跑通最小 initialize/session/new 再加分支；分支没触发要先怀疑**参数没传进去**（本次 `opts.answer` 忘传导致分支静默跳过、白跑 3 轮）。

## 还没解决的

- WorkBuddy：`session/steer` 的参数形状（轮内插话正口？）；`question:true` 能力是否必需（未 A/B）；`interruption_request` 通知在什么客户端条件下才发；多题批量 answers、multiSelect 未测。
- OpenCode：elicitation 崩溃（v1.18.33）新版是否已修；`/api/session/{sid}/wait` 503；ACP 桥里 question 工具仍缺（提问只能走 serve HTTP）。
- Hermes：resume-native 的键空间映射（CLI 会话 id load 后 history=0）；gateway 题卡端到端（需配消息平台）；ACP 适配层补 clarify 的上游动向。
- ZCode：session/fork 只带工作区不带对话——若中心要"带记忆的分叉"，用 session/load 跨进程恢复替代已证可行；fork 带对话是否产品路线图内有，未知。
- 中枢侧：真活闭环已在 `hub/tools/acp_resident_bridge.mjs` 跑通，gateway.ts/acp_runtime.ts 尚未接入（交负责人）；WB 认证间歇失败的根因（failover 窗口）值得让 WorkBuddy 侧确认。

## 下一步（我排的序）

1. **把闭环推进到"中心网页可派"**：让负责人把 acp_resident_bridge 的处理逻辑并进 gateway/acp_runtime（我提供驱动与全部帧格式），网页派活到四家 + pendingQuestions 答题卡。
2. **WorkBuddy session/steer 参数形状**：拿到它 WB 就有轮内插话，补齐 steer 格。
3. **compact 格**（WB/OC 原生不通）：按"最多补齐到"由中心做摘要新会话（bottom 层已可用，属中心代码）。
4. **测回归**：闭环四件套（task/fork/steer/load）纳入每次版本后的回归脚本。

## 出处

- 驱动与结果：`hub/tools/acp_resident_bridge.mjs`；`channels/probe/scripts/output/loop-*.json`、`fork-*.json`、`steer-*.json`、`closed-loop-2026-10-19/*-loop.md`。
- 黑板：research-acp 10-19 晚 11 行（ask-user/act-deliver/fork/steer/inject-next/resume）。
- 探针临时件：/tmp/zc_fork3.mjs、/tmp/load3.mjs 的逻辑已并入驱动（fork/load 子命令）。
- 本机代码：`@tencent-ai/codebuddy-code` 2.168.2 dist/codebuddy-headless.js（ExtensionMethod 表、handleResolveInterruption、createModsSessionBindings、CHANGELOG.md 2.167.0–2.168.2）；opencode-ai 1.18.33（/doc、`opencode agent list`）；hermes-agent（安装版 C:\Users\COLORFIRE\AppData\Local\hermes\hermes-agent 与仓库 E:\program\GIT\Agent\hermes and vcp like\hermes-agent）gateway/run_turn_runner.py、tools/clarify_gateway.py、hermes_cli/oneshot.py。
- 外部：[OpenCode tools 文档](https://opencode.ai/docs/tools)、[permissions](https://opencode.ai/docs/permissions)、[server](https://opencode.ai/docs/server)；[sst/opencode](https://github.com/sst/opencode)（packages/opencode/src/question/index.ts、tool/question.ts；SDK 处理 question 的讨论 issue #19702）；[NousResearch/hermes-agent](https://github.com/NousResearch/hermes-agent)（acp_adapter/server.py master 版 `_TurnCallbacks` 无 clarify；[ACP 文档](https://github.com/NousResearch/hermes-agent/blob/main/website/docs/user-guide/features/acp.md)、issue #569）；[agentclientprotocol.com](https://agentclientprotocol.com/get-started/agents)（Hermes 在官方 ACP agents 列表）；社区走 serve API 答题的先例：opencode-mcp（opencode_ask/opencode_reply）、Spacebot。
