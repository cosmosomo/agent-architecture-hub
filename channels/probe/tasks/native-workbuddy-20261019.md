# 任务书（WorkBuddy）：WorkBuddy 自己这一列，原生面上打“?”的格子查清楚

## 用户原话（逐字）

- “你是不是忘了委托其他生态的智能体干零散活了，workbuddy额度也不少现在”（10-19）
- “我们的总体目标就是，建立清晰的认知，所有的能力单元，注册表维护，打通闭环，然后稳步拓展……最终用所有方法打通尽可能多的能力单元，并且注册，接到我们的前端”
- “所有层都要把理论极限，我们的目标，我们的现状，然后记录现状的必要信息”

## 我的理解（总负责人 Claude；这是我的理解，不是用户的话）

功能矩阵 `channels/probe/CAPABILITY_MAP.md` 的“原生面”这一层，532 格只证实了 191 格。打“?”的格子意思是“接口可能存在、还没人测过”，不是“不支持”。你就是 WorkBuddy（腾讯 CodeBuddy 内核），对自己的命令行、ACP 桥、配置、本地数据库最熟。请把 WorkBuddy 这一列里原生面打“?”或空着的格子逐格查清：原生能做到吗，经哪个入口，证据是什么。

## 要回答的问题

能力单元表（`hub/data/capability-units.json`，每个单元有定义和判据）里，WorkBuddy 原生面还没证实的那些单元，各自在 WorkBuddy 原生（命令行 `codebuddy`、ACP 桥 `codebuddy --acp`、它自己的配置和本地记录）上能不能做到？做得到的，入口和用法是什么；做不到的，卡在哪。

## 已知事实

- 读 `channels/README.md` 的“立体认知”和“管线”两节，弄清“原生面”“位置”“依据”这几个词在我们这里的意思。
- 每格现状在 `channels/probe/CAPABILITY_MAP.md` 按单元的表里（WorkBuddy 那一行的“原生接口”一列）；证据记在黑板 `channels/probe/blackboard.jsonl`，原生面的路线编号是 `workbuddy/L0/...` 或 `workbuddy/L1a/<入口>`（附录“黑板里的路线编号”有说明）。
- 10-19 已知：WorkBuddy 经 ACP 报了 50 个斜杠命令（含 fork、goal、plan、autocompact、cost、background 等），但它的 headless 执行器没有提问界面绑定，向人提问经 ACP 做不到（`channels/probe/results/ask-user-acp-20261019.md`）。
- WorkBuddy 的本地记录：`workbuddy.db`（`session_usage.credit_json` 有逐笔额度扣费）、`~/.workbuddy` 下的会话文件。
- 档案卡：`channels/hosts/workbuddy.md`。

## 还不知道的

- 哪些斜杠命令能经 ACP 真用（发 `/goal ...` 这样的话作为一轮），哪些只在桌面端界面有效。
- 子智能体、后台任务（background）、分叉在原生上各自的行为和落盘位置。

## 怎样算做成

- 每个查过的单元一行结论（原生能 / 不能 / 部分），带你实际跑的命令或发的那句话、原始输出片段、WorkBuddy 版本、日期。
- 黑板每格一行（route = workbuddy/L1a/<入口> 或 workbuddy/L0/<入口>，capability = 单元名，by = workbuddy），时间用真实时间。
- 汇报写 `channels/probe/results/native-workbuddy-20261019.md`；交回前跑 `node hub/tools/agent_gateway.js tables` 并重出 `node channels/probe/scripts/build_coverage.js`，汇报里写清 WorkBuddy 原生面证实格数从多少到多少。
- 用派活单交回（deliver）。

## 规矩

照 `channels/probe/README.md` 第九节。只研究不改代码（`trace/`、`m/`、`hub/` 都不改）。在你自己的测试目录和 probe- 开头的会话里试，不动用户正在用的 WorkBuddy 会话和桌面端。不提交、不推送。
