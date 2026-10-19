# Antigravity 原生面：给“只看到接口”的格子补行为证据（10-19）

## 用户的原话

> “建立清晰的认知，所有的能力单元，注册表维护，打通闭环，然后稳步拓展……最终用所有方法打通尽可能多的能力单元，并且注册，接到我们的前端……可被编排”
>
> “我说的是你开发，然后测试交给zcode，argon负责研发（拓展适配器边界）”
>
> “能力单元矩阵要包括显示模块哦……纳入了你就会去测试”

## 这是我的理解

10-19 上午，一个 Antigravity 会话（probe-agy-native-1019）把 Antigravity 原生面 33 格里的 30 格报成“通”。负责人核验后，只有 7 格有一次实际调用的结果做证据，另外 23 格改判“未证实”。它们的依据只是二进制里的符号、请求结构、方法名，或者对机制的描述。核验说明在 `channels/probe/results/native-antigravity-20261019.md` 末尾“负责人核验”一节，黑板上每格都有一行更正。

这些线索有用，但“接口存在”不等于“能做到”。单元的判据在 `hub/data/capability-units.json` 的 `judge` 字段，比如 goal 要求的是“目标被持续推进、预算到了会停”，不是“有 goal_accumulator 这个符号”。

## 要回答的问题

这 23 格里，哪些在 Antigravity 上真能做到（照单元判据，有一次实际触发和它的结果），哪些做不到，哪些在什么条件下能做到？

## 已知

- 入口：`language_server.exe agentapi` 命令行；本机端口上的 Connect-RPC（332 个方法，`channels/probe/scripts/agy_rpc_methods.json` 有清单）；`~/.gemini/antigravity/` 下的会话记录和 `conversation_summaries.db`。中心怎么找到语言服务和端口，看 `trace/apps/cli/src/gateway/antigravity.ts` 的 `discoverAntigravityLs`。
- 已证实的 7 格（content-search、context-usage、list-projects、workspace-files、native-meta、native-meta-write、act-yield）不用重做。
- 23 格：goal、guard、loop-guard、inject-next、peer-message、handoff、host-drain、artifact、permission-scope、archive、act-deliver、act-report、task-board、mount-tools、instructions、workspace、output-contract、inject-tool、capacity、handover-human、app-sync、act-request、reclaim。

## 还不知道

- 哪些方法能从外部直接调、要什么参数、有没有副作用。
- 桌面端是否会同步显示外部做的改动（app-sync、handover-human 需要桌面端实际的观察证据）。

## 先查网上

用户 10-19 原话：“一定要记得，所有原生的生态的研究都要辅助网络调研来研究，不能闭门造车。因为很有可能开源的项目就已经做了这个功能了。也很有可能有社区讨论这个东西这些原生的生态，各家的产品都是很多很多人用的，所以一定有人研究。”

动手摸本机之前，先查：开源项目（GitHub 上有没有人做过同样的接入、自动化、逆向）、官方文档和更新日志、社区讨论（issue、论坛、博客、视频）。报告里带链接，写清借鉴了什么、哪些和本机实测对不上。搜索工具：`node hub/tools/search_hub.js search "<词>" --max 5`（可加 `--domains github.com`），正文提取：`node hub/tools/search_hub.js extract "<链接>"`；你自己的搜索工具也可以用。

## 怎样算做成

- 每查清一格，就往 `channels/probe/blackboard.jsonl` 追加一行：family antigravity，route `antigravity/L0/<入口>`，capability 为单元 id，result 填 pass / partial / fail，evidence 写实际调用和返回（或观察到的现象），cmd 写可复跑的命令。边查边写，不要等到最后。
- 查不通的照实写 fail 或 partial，写清断在哪、在什么条件下。拿局部成功报“通”不算做成。
- 最后交回：查清了哪几格（通 / 部分 / 不能各几格）、写了几行黑板、还剩哪些没查以及原因。

## 不能碰的

- 只在 `probe-` 开头的会话上测。用户正在用 Antigravity 桌面端做 PPT，不要对用户的会话发消息、改标题、强停或删除。
- 不杀桌面应用，不改全局配置和凭证；黑板、报告、回复里不写明文密钥。
- 研究为主，不改 `trace/`、`m/`、`hub/` 下的代码。
