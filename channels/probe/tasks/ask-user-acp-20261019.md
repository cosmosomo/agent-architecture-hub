# 任务书（Argon，研发线）：智能体向人提问，经 ACP 怎样出现、怎样在同一轮里答回去

## 用户原话（逐字）

- “我说的是你开发，然后测试交给zcode，argon负责研发（拓展适配器边界），可以吗”
- “我们的最终目标就是网页可以和操作gui一样简单，像原生应用一样简单，然后可以做更多功能拓展，并且暴露可以被agent调用的接口实现多智能体协作”
- “稳步推进吧”（10-19，对负责人列的后续计划：网页先补“回答智能体的提问、通知、重试和编辑重发”）

## 我的理解（总负责人 Claude；这是我的理解，不是用户的话）

“向人提问”（能力单元 ask-user，人机交互单元 ui-question）是桌面端七家都有、我们网页还没真正做到的交互：智能体在一轮中途问人一个问题，这一轮停住，人答了，答案回到同一轮，智能体接着做。负责人正在给 Codex（app-server 的 `item/tool/requestUserInput`）和 Claude（stream-json 里 `AskUserQuestion` 走 can_use_tool，答案经 `updatedInput` 带回）接这条路。ZCode、WorkBuddy、OpenCode、Hermes 走的是后端的常驻 ACP 桥（`trace/apps/cli/src/drivers/acp_runtime.ts`），它们的提问在 ACP 上以什么形式出现、我们怎样答回去，没人查过。

你 10-18 的报告（`channels/probe/results/adapter-frontier-20261018.md`）说七家都“原生具备”提问，但证据多是工具名和桌面端组件，不是“经我们这条路线真的问到、真的答回、同一轮继续”。这次要的是后者。

## 要回答的问题

ZCode、WorkBuddy、OpenCode、Hermes 四家，各自的“向人提问”经 ACP 桥（不是桌面端界面）出现时是什么样子：是 `session/request_permission`、某种 `session/update`、客户端请求、还是根本不经 ACP（只在它自己的界面上）？我们作为 ACP 客户端，怎样把人的答案送回去，让同一轮接着做？做不到的，断在哪、有没有别的入口（它的命令、配置、它自己的接口）。

## 已知事实

- 我们的 ACP 客户端：`drivers/acp_runtime.ts`。每个原始帧都 emit 'frame'；`session/request_permission` 已经接成轮内审批（`gateway.ts` 的 `handleAcpApproval`）；`fs/*` 两个客户端请求已实现，其余客户端请求回 -32601。initialize 里声明了 fs，没声明 terminal。
- 各家启动命令：`~/.acpx/config.json` 的 argv（OpenCode 是 `opencode acp`），环境变量在 `hub/data/products.json`。
- 各家通过 `available_commands_update` 报的命令（10-19 实测）：ZCode 有 auto、goal、fork、mode、model 等 19 个；Hermes 有 help、model、tools、context、reset、compress、steer、queue、version；WorkBuddy 50 个；OpenCode 21 个（多是技能）。
- 写一个只打开桥、发一轮、打印每一帧的小脚本，比经 8899 服务查更直接（参考 `channels/probe/scripts/probe_acp_runtime.mjs`，注意它是旧接口，驱动已重写）。

## 还不知道的

- 让智能体真的提问的说法：直接说“用你的提问工具问我一个二选一的问题”是否足够，还是要特定模式（如计划模式）。
- 有的家可能把提问做成工具调用后等它自己界面的回答，经 ACP 没有回答的入口。

## 怎样算做成

- 每家一行结论：经 ACP 能不能问到、能不能答回、同一轮是否继续；能的话写清帧的样子（脱敏后的原始 JSON 片段）和我们该回什么。
- 能答回的，用你自己的脚本真跑一遍：智能体问 → 你的脚本答 → 同一轮回复里用到了这个答案。
- 汇报写 `channels/probe/results/ask-user-acp-20261019.md`；黑板每家一行（route = <产品>/L1b/acp，capability = ask-user，带脚本输出里的会话编号）。交回前跑 `node hub/tools/agent_gateway.js tables`。

## 规矩

照 `channels/probe/README.md` 第九节。你只研发、不改代码（`trace/`、`m/`、`hub/` 都不改），需要后端改的写进汇报。只用 probe- 开头的会话，不碰人正在用的会话。黑板行时间用真实时间。不提交、不推送。
