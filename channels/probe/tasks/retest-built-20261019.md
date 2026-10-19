# 任务书（WorkBuddy）：把后端“实现了、还没实测”的格子测掉

## 用户原话（逐字）

- “你是不是忘了委托其他生态的智能体干零散活了，workbuddy额度也不少现在”（10-19）
- “我说的是你开发，然后测试交给zcode，argon负责研发（拓展适配器边界），可以吗”
- 清晰的标准：“一眼没多少行的文档，就知道如何调用各家各层能力，如何维护，出bug如何处理”

## 我的理解（总负责人 Claude；这是我的理解，不是用户的话）

“单元 → 动作”表（`hub/data/integration-map.json`）里有一批后端格子标着 built：代码写了、接口通了，但这个产品上没人真跑过。负责人在写新功能，这批补测交给你。你只测、不改代码；测出来的是事实，过了就是过了，没过要说清断在哪一层。

## 要回答的问题

下面这些格子，在 8899 服务上按真实用法跑，各自通不通？不通的断在哪（我们的接口、驱动、产品本身、上游模型渠道）？

- `mode-switch`（中途切模式）：claude
- `compact`（压缩上下文）：claude、workbuddy、opencode、hermes
- `cmd-list`（读智能体自己的命令清单）：claude
- `task-board`（一群会话：目标）：claude、workbuddy、codex、antigravity

## 已知事实

- 先读 `channels/README.md` 的“管线”一节：四张表、回归命令、四个专项脚本、后端各块在哪。表里每格的 how 字段写了它走哪个接口。
- 会话操作都走 `POST /api/gateway/session-control`（op：mode、compact、commands），命令行是 `node hub/tools/agent_gateway.js session-control --agent <产品> --session <会话名> --op <op> [--value ...]`。会话要先发过一句话才在智能体那边建出来。
- 目标：`node hub/tools/agent_gateway.js verify --product <产品> --unit task-board`。
- 现成脚本 `channels/probe/scripts/probe_session_control.js` 测过 ZCode、Hermes、Codex 的几项，可以参考它的写法扩展，但别改它，新脚本另起文件。
- Claude 只用 haiku（测切模式时也不换 opus）；Claude 的命令清单要会话在常驻进程上跑过一轮才有。
- 已知上游问题：Codex 只有 gpt-6.1-sol 可用；OpenCode 用 zhipuai-coding-plan/glm-5.3-flash。

## 怎样算做成

- 每个格子一行结论（过 / 没过），带能查到的编号（runId、目标编号、会话名）和实际输出；没过的写断在哪一层、为什么。
- 黑板每格一行（route = <产品>/L2/server-api，capability = 单元名，by = workbuddy），时间用真实时间。
- 汇报写 `channels/probe/results/retest-built-20261019.md`，先一段大白话结论再逐条证据；交回前跑 `node hub/tools/agent_gateway.js tables`。
- 用派活单交回（deliver），摘要写过了几格、没过几格。

## 规矩

照 `channels/probe/README.md` 第九节。只测不改代码（`trace/`、`m/`、`hub/` 都不改，`hub/data/` 也不改——登记由负责人做）。只用 verify-、probe- 开头的会话，不碰人正在用的会话。不提交、不推送。
