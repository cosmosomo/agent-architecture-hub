# 任务书（丁）：增强 local-capability-hub 技能，让智能体学会借我们的系统调用其他智能体、查看其他智能体的会话

## 用户原话（逐字）

- 10-18 晚：“你派一个智能体把 /local-capability-hub 这个skill参考我们系统增强一下，让这个skill可以让agent学会如何借用我们的系统去学会调用其他智能体，查看其他智能体sessions。然后同步到电脑上所有的这个skill文件”
- 最终目标：“我们的最终目标就是网页可以和操作gui一样简单，像原生应用一样简单，然后可以做更多功能拓展，并且暴露可以被agent调用的接口实现多智能体协作”
- 清晰的标准：“清晰到什么程度呢？一眼没多少行的文档，就知道如何调用各家各层能力，如何维护，出bug如何处理。管线要非常清晰，没有什么冗杂的东西”

## 我的理解（总负责人 Claude；这是我的理解，不是用户的话）

这个技能装在本机各个智能体产品里（Claude、Codex、ZCode、WorkBuddy、OpenCode、Gemini、.agents、豆包），是它们了解“本机还有哪些能力”的入口。它现在的“跨 Agent 调用”一节只讲了用 agent_gateway.js 调起各家，没讲我们系统后来长出来的东西。要让任何一个只读了这个技能的智能体，能自己做到：看本机全部会话和某个会话的每一步；把一件事派给另一个产品的智能体并等它交回（或被叫醒）；在被派活时上报进度、交回结果；知道每个产品能做什么、走哪条路线。

清晰比全面重要：技能本身要短（用户的清晰标准），具体命令不要抄进技能，而是教智能体去问运行中的系统——`node hub/tools/agent_gateway.js tables`（四张表）、`GET http://127.0.0.1:8899/api/capabilities`。抄进去的东西会漂（我今天就因为凭记忆写命令写错过）。

## 要回答的问题

一个只读了这个技能、对我们系统一无所知的智能体，最少要知道哪几件事、按什么顺序，才能正确地：查看其他智能体的会话、调用（派活给）其他智能体、在被派活时交回？哪些写进技能正文，哪些让它去问系统。

## 已知事实

- 正本：`C:\Users\COLORFIRE\.cc-switch\skills\local-capability-hub`（SKILL.md 105 行，references/keys-and-endpoints.md，scripts/search_hub.js）。同步脚本：`hub/tools/sync_capability_skill.ps1`（以正本为源，复制到 11 个位置；会先删目标再复制）。
- 本机现有副本：.claude、.codex、.zcode、.workbuddy、.config/opencode、.gemini/config、.agents 下的 skills/local-capability-hub。前六个与正本一致；**`~/.agents/skills/local-capability-hub` 的 SKILL.md 和正本不一样，同步前先备份并比对，弄清它多了什么，不要直接覆盖丢掉。** 豆包的三个路径以脚本为准，存在才同步。
- 我们系统的入口（先读 `channels/README.md` 的“立体认知”和“管线”两节）：
  - 看会话：`GET /api/sessions?slim=1`（全部会话，含产品、入口、所有权、状态）、`GET /api/sessions/<编号>`（每一轮每一步）、`GET /api/search?q=`（全文搜）。
  - 调用别的智能体：`node hub/tools/agent_gateway.js run --agent <产品> --session <名> --file <任务> --async` 然后 `read` / `wait`；派活带回执和唤醒：`agent_gateway.js dispatch --to <产品> --to-session <名> --file <任务> [--wake-caller]`，被派的一方用 `deliver` / `report` / `yield` 交回或上报；`dispatches` 查派活单。
  - 四张表：`node hub/tools/agent_gateway.js tables`；网页 `http://127.0.0.1:8899/m/`（人用）。
- key：references/keys-and-endpoints.md 来自 `channels/_private/`，按用户决定可以给本机所有智能体读，但**不能进 Agent-Architecture-Hub 的公开仓库，也不能出现在你的报告、黑板里**。

## 还不知道的

- 各产品读技能的方式不同（有的只读 description 决定是否加载），description 怎么写才能在“要看别人会话、要派活”时被触发。
- 被派活的智能体怎么知道自己处在一张派活单里、该用哪个子命令交回——是写进技能，还是派活单本身带说明（看 gateway.ts 里 dispatchTask 发出去的提示词）。

## 怎样算真正做成

- 以真实用法验收：派一个**只装了这个技能**的新会话（用 ZCode 的 GLM-5.3-Flash，`node hub/tools/agent_gateway.js dispatch --to zcode --to-session probe-skill-learner-1018 ...`），任务只说一句“看看本机最近有哪些智能体在干活，挑一个 OpenCode 的会话告诉我它最后一轮做了什么；再派一个任务给 OpenCode 让它回复一个暗号并交回”。它不靠任何额外提示做成了，才算技能有效。把它的会话编号、派活单编号写进汇报。
- 同步：更新正本后跑同步（必要时改 `sync_capability_skill.ps1`），然后逐个副本比对 SKILL.md 的哈希都和正本一致（.agents 那份按你比对后的结论处理，结论写进汇报）。
- 汇报写 `channels/probe/results/skill-capability-hub-20261018.md`：改了什么、为什么这样写、验收会话的证据、每个副本的同步结果。交回前跑 `node hub/tools/agent_gateway.js tables`，证据一项要过。

## 规矩

照 `channels/probe/README.md` 第九节。全权限；不提交、不推送；改前备份（技能正本和 .agents 那份）。不要改 `trace/`、`m/`、`hub/data/`（它们有归属）。Claude 只用 haiku。不往人正在用的会话发消息。

## 补充：一键同步（10-18 晚）

补充要求（来自总负责人，任务书末尾已追加）。用户原话：

“这个skill得做一个一键同步的功能，识别冲突，处理，一键同步，做到skill里”

我的理解（不是用户的话）：同步要成为技能自带的能力，而不是一个只有我们知道的外部脚本。任何装了这个技能的智能体（或者人）跑一条命令，就能把正本同步到本机所有副本。要做到三件事：
1. 识别冲突：同步前比对每个副本和正本（以及上次同步时的版本），分清三种情况——副本没动（直接覆盖）、正本没动但副本被单独改过（冲突：副本有别人的修改）、两边都改过。~/.agents/skills 那份现在就是一个实例。
2. 处理：被单独改过的副本不能直接覆盖丢掉——先备份，把它多出来的内容列出来（差异），能合并的合并进正本（或提示人决定），处理方式写清楚。
3. 一键同步：一条命令完成比对、备份、合并或提示、复制、复核哈希，并打印每个位置的结果。

放在技能目录的 scripts/ 下（和 search_hub.js 同级），SKILL.md 里用两三行讲清怎么用。可以复用或替换 hub/tools/sync_capability_skill.ps1（现在它先删再复制，会丢掉副本上的修改）。key 文件照旧只在本机，不进公开仓库。验收时：先人为在一个副本上改一行，跑一键同步，要能识别出来、备份、给出处理结果；再跑一次应全部一致。写进你的汇报。

## 补充：副本和同步路径写进技能（10-18 晚）

补充要求（来自总负责人，任务书末尾已追加）。用户原话：

“【查清 local-capability-hub 技能的副本和同步脚本】的路径也是要记录到这个skill里 的”

我的理解（不是用户的话）：正本在哪、有哪些副本、用什么同步，要写进技能本身，读了技能的智能体就知道。建议做成一份数据（例如技能目录下 sync-targets.json：正本路径 + 每个副本路径 + 属于哪个产品），一键同步脚本照它运行，SKILL.md 里只用一两行指向它——和我们“四张表”一样，路径只登记一处，别处不抄。新装了一个产品，就在这份数据里加一行。

我已经查到的事实（供你核对，不要照抄）：
- 正本：C:\Users\COLORFIRE\.cc-switch\skills\local-capability-hub（SKILL.md、references/keys-and-endpoints.md、scripts/search_hub.js）
- 现有同步脚本：E:\program\GIT\Agent\multi\Agent-Architecture-Hub\hub\tools\sync_capability_skill.ps1（先删目标再复制，会丢副本上的修改）；它的目标清单：
  Agent-Architecture-Hub\channels\_private\local-capability-hub（私有，不进公开仓库）
  C:\Users\COLORFIRE\.claude\skills\local-capability-hub
  C:\Users\COLORFIRE\.codex\skills\local-capability-hub
  C:\Users\COLORFIRE\.zcode\skills\local-capability-hub
  C:\Users\COLORFIRE\.workbuddy\skills\local-capability-hub
  C:\Users\COLORFIRE\.config\opencode\skills\local-capability-hub
  C:\Users\COLORFIRE\.gemini\config\skills\local-capability-hub
  C:\Users\COLORFIRE\.agents\skills\local-capability-hub（SKILL.md 与正本不同，先备份比对）
  C:\Users\COLORFIRE\AppData\Local\DoubaoWork\User Data\Profile 3\.doubaowork\agent_mode\workspace\.user_skills\local-capability-hub
  C:\Users\COLORFIRE\AppData\Local\DoubaoWork\User Data\Default\.doubaowork\agent_mode\workspace\.user_skills\local-capability-hub
  C:\Users\COLORFIRE\AppData\Local\Doubao\User Data\Default\.doubao\agent_mode\workspace\.user_skills\local-capability-hub
- 本机实际存在的副本（我 10-18 晚 find 到的）：.claude、.codex、.gemini\config、.config\opencode、.zcode、.workbuddy、.agents 七处；豆包三处我没搜到，以你实查为准。是否还有别的产品（Antigravity 的 ~/.gemini/antigravity、Hermes、Factory/Droid）支持装技能、该不该加进来，请查明后写进汇报。
