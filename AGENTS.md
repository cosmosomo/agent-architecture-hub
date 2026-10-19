# 在这个仓库里干活的智能体：先读这一页

智能体接入中心有三条路，这一页只管第三条：
- 被中心派活的智能体，在自己的工作目录里干活，看的是派活单里的“铁律”和协作说明；
- 别处的智能体要用中心（看会话、派活、写记录、搜索），靠的是技能 `local-capability-hub`，它的正本在 `~/.cc-switch/skills/local-capability-hub`，用 `sync_skill.js` 同步到各家；
- 在这个仓库里干活的智能体，读这一页。

不管智能体读没读这些，中心都会守着共享记录（`trace/apps/cli/src/gateway/guard.ts`）：每 10 分钟留一次快照，文件一旦变短，就自动恢复并记一条事件。

## 铁律（做不到就停下来，在交回里说明）

1. **共享记录只能追加。** `channels/probe/blackboard.jsonl`（黑板）、`channels/probe/features.jsonl`、`channels/probe/annotations.jsonl` 只能往末尾加行：
   - 写黑板用 `node hub/tools/agent_gateway.js bb add …`。命令把记录交给中心，由中心盖时间、往末尾加，智能体自己不碰文件。必填只有四项：谁写的（`--by`）、哪家（`--family`）、哪个单元（`--capability`）、证据（`--evidence`）；结果不填就记成“未证实”；
   - 其余两份用 `agent_gateway.js feature`、`note` 写；
   - 不要自己写代码去打开这些文件；一次要写很多行，就把它们以 `{"kind":"blackboard","rows":[…]}` 的形式发到中心的 `POST http://127.0.0.1:8899/api/gateway/records`。

   不许把整个文件读出来再写回去，不许排序、去重、过滤，也不许改旧行。10-19 有一个智能体把黑板整份重写了，两千多行实测证据只剩 18 行。
2. **署名写你自己**：产品 id，或者派活单里给你的会话名。不冒用别人的名字（比如 `claude-lead`）。时间用当前时间，不编造。
3. **不删、不覆盖别人的文件。** 必须改共享文件时，先备份，只改自己负责的那一段。
4. **不打扰用户**：
   - 不对用户正在用的会话、窗口发消息，不动用户的鼠标键盘，不杀应用；
   - 不改全局配置和账号凭证；
   - 任何地方都不写明文密钥。
5. **结论要有依据**，分三档：试过（带命令和结果）、看到（带链接或文件）、推测。推测不进黑板。
6. **研究先查网上**：开源项目、官方文档、社区讨论。不闭门造车。

## 分层读：做到哪一步，读到哪一层

| 层 | 什么时候读 | 读什么 |
|---|---|---|
| 1 | 每次都读 | 本页，加上你的派活单或任务书（`channels/probe/tasks/`） |
| 2 | 做研究、做测试 | 研究目录和你议题的卷宗 `channels/research/`；探查流程 `channels/probe/SOP_对话探查生态功能.md`；能力单元的定义和判据 `hub/data/capability-units.json`；现状 `channels/probe/CAPABILITY_MAP.md` |
| 3 | 要改中心的代码或表 | `channels/README.md` 的“管线”一节、四张表（`hub/data/`）、`trace/apps/cli/src/gateway/` |

## 常用命令（`node hub/tools/agent_gateway.js <子命令>`）

| 要做什么 | 子命令 |
|---|---|
| 交回、汇报进度、让出等待（派活单里有编号） | `deliver`、`report`、`yield` |
| 写一条实测记录 | `bb add` |
| 登记你这家的功能，或者给某项能力加注释 | `feature`、`note` |
| 回看一个会话过去的对话 | `recall` |
| 看会话、搜索、看中心状态 | `sessions`、`session`、`search`、`state` |
| 联网搜索、提取网页正文 | `node hub/tools/search_hub.js search "<词>"`、`… extract "<链接>"` |

每个子命令不带参数运行，会提示它要哪些参数。
