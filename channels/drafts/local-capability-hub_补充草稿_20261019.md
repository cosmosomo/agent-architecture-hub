# local-capability-hub 要补的内容（草稿，10-19）

给用户看的说明，不进技能：

- 技能正本没动（`~/.cc-switch/skills/local-capability-hub/SKILL.md`）。下面三节加一份命令速查，是建议补进去的正文，格式照现有的 SKILL.md 写。
- 建议的位置：
  - “〇、铁律”放在现有“一、运行中系统与能力自省”前面，所有接入者第一眼就能看到；
  - “接入流程”和“分层阅读”紧跟在铁律后面；
  - 命令速查并进现有“三、跨 Agent 协作闭环”。
- 为什么要补：10-19 一个被派活的智能体把黑板整份重写，两千多行实测证据只剩 18 行。它在自己的工作目录里干活，读不到仓库里的规矩；能读到的只有派活单和这个技能。派活单已经加了铁律（`gateway/collab.ts`），这个技能还没有。
- 两件要你定：
  1. 技能描述第一行写着“30+ 把大模型明文 Key”，铁律第 4 条写的是“任何地方都不写明文密钥”。两者管的不是一回事：技能是你有意分发密钥，铁律管的是智能体往记录、报告里写密钥。要不要在铁律里写明这个区别，你定。
  2. 仓库根目录的 `AGENTS.md`，留着给在仓库里干活的智能体看，还是删掉、只留技能这一个入口。

---

## 〇、铁律（先读；做不到就停下来，在交回里说明）

1. **共享记录只能追加。** 黑板 `channels/probe/blackboard.jsonl`、功能登记 `features.jsonl`、注释 `annotations.jsonl` 只能往末尾加行：
   - 写黑板只用 `agent_gateway.js bb add`。它把记录交给中心，由中心盖时间、追加，智能体不碰文件。必填只有谁、哪家、哪个单元、证据四项；
   - 写功能登记、注释用 `feature`、`note`；
   - 自己写代码时只用追加模式。

   不许整份读出再写回，不许排序、去重、过滤，也不许改旧行。中心每分钟查一次，发现文件变短会自动恢复，并记下是谁、什么时候。
2. **署名写你自己**：产品 id，或派活单给你的会话名。不冒用别人（比如 `claude-lead`）。时间用当前时间。
3. **不删、不覆盖别人的文件。** 必须改共享文件时，先备份，只改自己负责的那一段。
4. **不打扰用户**：
   - 不对用户正在用的会话、窗口发消息，不动鼠标键盘，不杀应用；
   - 不改全局配置和账号凭证；
   - 记录、报告、回复里不写明文密钥。
5. **结论要有依据**，分三档：试过（带命令和结果）、看到（带链接或文件）、推测。推测不进黑板。
6. **研究先查网上**：开源项目、官方文档、社区讨论。搜索用 `search_hub.js`（第五节）。

## 接入流程：先认清你是从哪条路进来的

**A. 被中心派了活**：你的提示词开头是 `【跨会话派活单 · ID: dsp_…】`。
1. 读派活单里的铁律和协作说明；派活单写了任务书路径的，先读任务书。
2. 干活时，进度用 `report`，交回用 `deliver`，等外部条件用 `yield`（命令就在派活单里）。
3. 写实测记录用 `bb add`。如果是研究某个议题，交回前把经验和关键信息更新进这个议题的卷宗：`E:\program\GIT\Agent\multi\Agent-Architecture-Hub\channels\research\<卷宗>.md`，议题和卷宗对应关系见同目录的 `README.md`。
4. 要回看这个会话早先的对话，用 `recall`。

**B. 你在别处干活，想用中心**：看会话、派活给别家、查能力、写记录、联网搜索。
1. 先问系统，不背命令：`tables`、`state`、`targets`（第一节）。
2. 看别家：用 `sessions`、`session`、`search`、`recall`。
3. 派活：
   - 一组有先后、要验收的活，用 `goal --file`，走任务板，并指定另一家验收；
   - 单件活用 `dispatch`。

   派活时把铁律和任务书路径写进任务。
4. 写记录：用 `bb add`、`feature`、`note`。

**C. 你这家还没接进中心**：中心不能直接驱动你这家。
1. 用 `feature` 登记你这家的功能，写清是否独家、开放程度、实现路径。
2. 按 `channels\probe\SOP_对话探查生态功能.md` 走一遍。
3. 接入要改中心代码的，写清改哪里、为什么，交给负责人（Claude 会话）。

## 分层阅读：做到哪一步，读到哪一层

| 层 | 什么时候读 | 读什么（都在 `E:\program\GIT\Agent\multi\Agent-Architecture-Hub\` 下） |
|---|---|---|
| 1 | 每次 | 本技能的铁律和接入流程；你的派活单或任务书（`channels\probe\tasks\`） |
| 2 | 做研究、做测试 | 研究目录和卷宗 `channels\research\`；探查流程 `channels\probe\SOP_对话探查生态功能.md`；单元的定义和判据 `hub\data\capability-units.json`；现状 `channels\probe\CAPABILITY_MAP.md`（矩阵页由 `build_coverage.js` 生成） |
| 3 | 要改中心的代码或表 | `channels\README.md` 的“管线”一节；四张表 `hub\data\`；后端 `trace\apps\cli\src\gateway\` |

## 命令速查（补进第三节；前缀都是 `node e:\program\GIT\Agent\multi\Agent-Architecture-Hub\hub\tools\agent_gateway.js`）

```powershell
# 写一条实测记录（只追加，时间自动填）
... bb add --by <你> --family <产品> --capability <单元id> --result pass|partial|fail|unverified --route <产品>/<L0|L1a|L1b|L2|L3>/<入口> --evidence "<实际调用和返回>" [--cmd "<可复跑命令>"]

# 登记你这家的功能；给某项能力加注释（实现路径、成本、性能、标记）
... feature --agent <产品> --name <功能> --what <做什么> --entry <入口> --exclusive 独家|别家也有|不确定 --openness 开源|公开接口|只能界面|不开放 --evidence 试过|看到|推测 --how <实现路径>
... note --agent <产品> --on <单元id或功能名> [--how] [--cost] [--perf] [--tags 词,词] [--text] --evidence 试过|看到|推测

# 回看一个会话过去的对话（含已被压缩的部分）
... recall --agent <产品> --session <会话名> [--grep 关键词] [--last 5] [--who user|agent|all]

# 一组活走任务板（中心选人、另一家验收、失败换家、额度用完自动等）
... goal --file <目标.json>
... goals

# 现在谁有空、为什么
... pick [--candidates zcode,hermes]
```

每个子命令不带参数运行，会提示它要哪些参数。
