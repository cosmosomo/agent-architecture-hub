# 适配器研究目录

用户 10-19：“我们所有的适配器，不同路线都可以有专门的研究员。我们可以有专门的智能体研究目录，去研究这种适配器，因为其实大家都在做这样的工作。……这个议题值得单独研究哦，也就是刚刚的豆包打破之类的技术路线。通用的guiuse适配器技术什么的也是值得单独研究的。然后微信适配器就是重灾区，攻防对抗很激烈的。里面估计有大量技术可以借鉴。”

每个议题固定一位研究员：一家产品，加一个固定的会话名 `research-<议题>`。同一议题的后续活都派到这个会话，上下文一直接着用。研究一律先查网上（开源项目、官方文档、社区讨论），规矩见 `channels/probe/SOP_对话探查生态功能.md`；结论照单元判据实测过，才进黑板和矩阵。派活一律走任务板（`agent_gateway.js goal --file`），并指定另一家验收。

## 议题

| 议题 | 卷宗 | 要回答的问题 | 研究员 | 已有报告（channels/probe/results/） | 在跑 | 下一步 |
|---|---|---|---|---|---|---|
| ACP 常驻桥 | [acp.md](acp.md) | ZCode、WorkBuddy、OpenCode、Hermes 经 ACP 能做到哪一步，断在哪 | ZCode · research-acp | acp-runtime-20261018、ask-user-acp-20261019、native-zcode/opencode/hermes-20261019 | | WorkBuddy、OpenCode、Hermes 提问断在 ACP 这一层：查有没有别的入口 |
| Codex app-server | [codex.md](codex.md) | app-server 协议能给到的上限 | Codex · research-codex | codex-app-driver-20261018 | | 原生 thread/goal、计划模式提问 |
| Claude stream-json | [claude.md](claude.md) | stream-json 能给到的上限 | Claude（haiku）· research-claude | claude-stream-driver-20261018 | | 合成报错、压缩、子智能体在流里怎么出现 |
| Antigravity agentapi / Connect-RPC | [agy.md](agy.md) | 332 个方法里哪些能从外部真正用起来 | Antigravity · research-agy | agy-fact-antigravity-20261018、native-antigravity-20261019（核验后只有 7 格有证据） | 23 格补行为证据 | 等交回 |
| 界面路线：OpenCLI / CDP | [ui-route.md](ui-route.md) | 只能操作界面的产品怎么接，豆包怎么接 | Antigravity · research-ui-route | opencli-route-20261018 | 豆包接入（优先 opencli） | 等交回 |
| 通用 GUI 适配器 | [gui.md](gui.md) | 不占用用户屏幕地看、用任意桌面应用，技术路线有哪些，哪条能通用 | Codex · research-gui | | 不占屏幕读各家面板（Antigravity flash） | 开源与社区路线调研（见任务书 gui-adapter-20261019） |
| 微信适配器 | [wechat.md](wechat.md) | 攻防最激烈的接入：各种路线怎么做、怎么被封、哪些技术能借到别家 | 未定 | | | 还没派 |
| 打破能力单元边界 | [frontier.md](frontier.md) | 原生做不到的单元，适配器能补到哪一级 | Argon（Antigravity pro）· research-frontier | adapter-frontier-20261018、theory-limits-20261018 | | 按矩阵“派研究”的 192 格排队 |
| 底座渠道 | [base.md](base.md) | 按调用选渠道、额度、熔断、并发 | Codex · research-base | channel-base-20261018 | | 官方积分的无头鉴权（WorkBuddy） |
| 开源工作台对照 | [oss.md](oss.md) | 别人的多智能体工作台做到了什么 | Antigravity · research-oss | openrig-matrix-20261018、agy-pro-openrig-source-20261018 | | |

研究员一栏是这次排定的，以后谁接着做就改这一栏。表里的会话名还没有全部开出来，派第一件活时才会开。

## 卷宗怎么写

用户 10-19：“让它们去把经验和关键信息记录到这个目录里吧”。

每个议题一份卷宗 `channels/research/<卷宗>.md`，由这个议题的研究员维护。凡是这个议题上的活，交回之前都要更新卷宗；新的写在前面，旧的结论被推翻就改掉，并注明推翻它的证据。卷宗分四节：

1. **关键信息**：入口（命令、接口、文件位置）、版本、限制、结论。每条标依据：试过（带命令和结果，或黑板行号）、看到（带链接或文件）、推测。
2. **经验**：试过什么、踩过什么坑、怎么绕过去的；哪些办法不通、为什么。
3. **还没解决的**：问题本身、卡在哪、下一步打算怎么查。
4. **出处**：本仓库里的报告（`channels/probe/results/`）、黑板行、外部链接（开源项目、文档、社区讨论）。

写短：一条一件事，大白话；长的过程放报告里，卷宗只留结论和指针。
