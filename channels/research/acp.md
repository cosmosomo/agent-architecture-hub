# ACP 常驻桥 · 卷宗

议题：ZCode、WorkBuddy、OpenCode、Hermes 经 ACP 能做到哪一步，断在哪。研究员：ZCode · research-acp。

## 10-19 这一步：三家"不能问人"有没有别的入口

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

### 经验

- **模型自述"我没有某工具"不可信**。OpenCode"没挂 question 工具"的误判就是这么来的；验证只有一条路：明确指令让它调工具，再看服务端帧/pending。
- **结论钉版本**。WorkBuddy 三天内 2.160.0 fail → 2.168.2 pass；探针报告、黑板行都要带版本。
- **先读内嵌文档再写探针**。codebuddy bundle 的字符串里有整段协议文档（unicode 转义），`node -e` 解码后能直接拿到 extMethod 名、参数、answers 形状，省了盲目试错。
- **探针先把原始帧落盘再打总结**。第一次 WorkBuddy 重测没存 chunk 文本，结论拿不到模型原话，被迫多跑一轮模型调用。
- **OpenCode 权限求值是 last-match-wins**：agent list 里 deny 在前、allow 在后 = allow 生效；读配置别只看有没有 deny。
- **Hermes 回调是"按能力分派"**：回调签名带 `questions`/VAR_KEYWORD 就走批量形态（要回 JSON），否则走单题形态（回字符串）。写宿主回调时两种都要备。
- 静态 grep 定位 + 一次决定性实测，比多轮盲跑省额度：WorkBuddy 三次失败重跑里，前两次都缺"补发 resolveInterruption"这步。

### 还没解决的

- WorkBuddy：`question:true` 能力是否必需（未 A/B）；`interruption_request` 通知在什么客户端条件下才发；多题批量 answers、multiSelect 答题未测。
- OpenCode：elicitation 崩溃（v1.18.33）新版是否已修；question 工具在 ACP 桥里是否仍缺；`/api/session/{sid}/wait` 503 等版本级缺口（见 native 报告）。
- Hermes：gateway 题卡端到端（需配一个消息平台或 TUI 答卡）；ACP 适配层补 clarify 的上游动向（NousResearch/hermes-agent 开源，可提 issue/PR 建议）。
- 中枢侧：三条路都没接进 acp_runtime.ts / gateway（中心代码，交负责人）。

### 出处

- 本仓报告：channels/probe/results/ 下 ask-user-acp-20261019.md（四家 ACP 提问基线）、acp-runtime-20261018.md（常驻桥）、native-opencode-20261019.md、native-hermes-20261019.md。
- 本次探针：channels/probe/scripts/probe_workbuddy_ask2_20261019.mjs（+probe_wb_ask2_run4.log）、channels/probe/scripts/opencode/probe_ask_serve_20261019.mjs（+probe_ask_serve_20261019_results.json）、channels/probe/scripts/hermes/probe_sdk_clarify_20261019.py；黑板 10-19 research-acp 三行（workbuddy/opencode/hermes · ask-user · pass）。
- 本机代码：`@tencent-ai/codebuddy-code` 2.168.2 dist/codebuddy-headless.js（ExtensionMethod 表、handleResolveInterruption、createModsSessionBindings、CHANGELOG.md 2.167.0–2.168.2）；opencode-ai 1.18.33（/doc、`opencode agent list`）；hermes-agent（安装版 C:\Users\COLORFIRE\AppData\Local\hermes\hermes-agent 与仓库 E:\program\GIT\Agent\hermes and vcp like\hermes-agent）gateway/run_turn_runner.py、tools/clarify_gateway.py、hermes_cli/oneshot.py。
- 外部：[OpenCode tools 文档](https://opencode.ai/docs/tools)、[permissions](https://opencode.ai/docs/permissions)、[server](https://opencode.ai/docs/server)；[sst/opencode](https://github.com/sst/opencode)（packages/opencode/src/question/index.ts、tool/question.ts；SDK 处理 question 的讨论 issue #19702）；[NousResearch/hermes-agent](https://github.com/NousResearch/hermes-agent)（acp_adapter/server.py master 版 `_TurnCallbacks` 无 clarify；[ACP 文档](https://github.com/NousResearch/hermes-agent/blob/main/website/docs/user-guide/features/acp.md)、issue #569）；[agentclientprotocol.com](https://agentclientprotocol.com/get-started/agents)（Hermes 在官方 ACP agents 列表）；社区走 serve API 答题的先例：opencode-mcp（opencode_ask/opencode_reply）、Spacebot。
