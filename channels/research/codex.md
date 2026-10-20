# Codex app-server 卷宗

## 关键信息

- **2026-10-20 试过：inject-next 经中心 L2 通过**。按测试题，`test-codex` 第一轮 `run_1792456110298_59xv` 完整逐行输出 1–100，00:28:41.455Z 正常结束；运行中 `--mode queue --async` 返回 `stopReason: queued`。中心自动启动 `run_1792456121618_cwpv`（00:28:41.618Z），回复 `T102000Q5`，同 thread、无错误、队列归零。黑板 **2268**，已用 `bb find` 核对。只确认 L2，不外推 L0、L3 或重启不丢队列。

- **原生目标元数据入口**：`thread/goal/set`、`thread/goal/get`、`thread/goal/clear` 读写会话级 objective、status、tokenBudget；状态包括 `active`、`paused`、`blocked`、`usageLimited`、`budgetLimited`、`complete`。本机 Codex 0.159.2 协议说明记载目标保存在 `goals_1.sqlite` 并发 `thread/goal/updated`。**看到**：[app-server 协议表](../hosts/codex/app-server.md#目标追踪)、[Codex 事实探查报告](../probe/results/agy-fact-codex-20261018.md)。
- **“有 goal”不等于自动持续完成目标**：现有实测审阅确认 `set/get` 成功，但未观察到多轮 token 消耗后自动切为 `budgetLimited` 并停止；跨进程恢复后自动续跑也未被证明。**看到**：[矩阵行 1403](../probe/MATRIX.md)、[矩阵行 1414](../probe/MATRIX.md)。
- **计划模式与提问原语**：app-server 有 `thread/settings/update.collaborationMode`、`turn/start.collaborationMode`，计划进展以 `turn/plan/updated` 通知；`item/tool/requestUserInput` 是带 `id` 的服务端反向请求，客户端需回传 `{ answers: { questionId: { answers: [...] } } }`。**看到**：[app-server 协议说明](../hosts/codex/app-server.md#服务端逆向请求-serverrequest)、[协议通知表](../hosts/codex/app-server.md#服务端通知流-servernotification)。
- **中心已有接入路径**：`run_codex.ts` 在会话模式为 plan 时传入 `collaborationMode`，并把 `requestUserInput` 交给 `askPerson`；`approvals.ts` 将问题放入 `pendingQuestions`、等待 `/api/gateway/answer`，再把 answer 回给同一轮。故原生提问能力已具备中心代码接入，不代表每个模型/提示下都会主动提问。**看到**：[Codex 运行接线](../../trace/apps/cli/src/gateway/run_codex.ts)、[统一提问状态与答复](../../trace/apps/cli/src/gateway/approvals.ts)、[HTTP answer 路由](../../trace/apps/cli/src/server.ts)。
- **能力边界**：thread goal 是会话级目标和预算状态，不是中心任务板的分步编排、派工、验证与唤醒系统；中心仍需负责长程循环、重启后调度和验收。**看到**：[app-server goal/queue 接口](../hosts/codex/app-server.md#目标追踪)、[先前 app-server 驱动报告](../probe/results/codex-app-driver-20261018.md)。
- **探针环境修正记录**：初次启动确因默认 profile/state 初始化失败而未进入 RPC；改用 OS 临时目录作为 `CODEX_HOME` 后，完整完成下面记录的元数据持久化子判据。初次失败是环境问题，不能当作 goal 接口不支持；临时目录路线已验证可用。
- **临时 CODEX_HOME 复测通过持久化子判据**：以 OS 临时目录作 `CODEX_HOME`，thread `01a15427-e6d0-7771-b4d1-c4ec062c1b8c` 上 `thread/goal/set(active, tokenBudget=17)` 后读回 objective/status/tokenBudget；关闭并重启 app-server、`thread/resume` 后读值一致，`thread/goal/clear` 后读回 null。`tokensUsed=0`，没有 `turn/start`，所以只证明目标元数据跨进程持久化，不证明目标自治执行或预算耗尽停止。中心黑板复核行：[1975](../probe/blackboard.jsonl)、[1976](../probe/blackboard.jsonl)；以后一条 `partial` 限定整格判定。**试过**：[probe_goal_persistence.mjs](../probe/scripts/codex/probe_goal_persistence.mjs)。

## 经验

- 排队验收须同时检查 queued 回执、第一轮完整输出、两轮时间和第二轮暗号，不能只凭第二轮能回复就判通过。2026-10-20 中心 CLI 已可运行真实模型轮，10-19 的沙箱网络断点不代表目前中心不可用。

- 评估“持续推进到达成”要拆开验证：goal 写入/读回、模型是否按 objective 行动、预算阈值是否触发状态变化、达到 complete 后是否停止、进程重启后是否续推。仅看到 RPC 成功不能判定自治循环闭环。**依据**：矩阵对 goal 与 wake-persist 的审阅缺口（上列 1403、1414）。
- 计划模式提问链路是双向 JSON-RPC：读取线程不能同步阻塞等待人答；收到 `item/tool/requestUserInput` 后将问题挂到中心状态，再用原 request id 回复，否则可能死锁或丢失同轮恢复。**看到**：[ServerRequest 工程准则](../hosts/codex/app-server.md#服务端逆向请求-serverrequest)、[中心问答 resolver](../../trace/apps/cli/src/gateway/approvals.ts)。
- 本轮网络搜索尝试（`node hub/tools/search_hub.js search 'Codex app-server thread goal set requestUserInput plan mode' --max 5`）返回 `{ok:false, provider:'anysearch', error:'All AnySearch keys failed'}`，未获得可引用的外网结果；AP-Vibe bootstrap 也因安装清单中的版本目录不存在而无法取回 context。故本卷宗对新增结论使用仓库协议/实现证据，不声称本轮完成官方网页复核。**试过**：以上命令及 bootstrap 调用结果。
- 共享黑板写入必须经中心 `bb add`；本轮已成功追加行 1975、1976。第一条记录 RPC 子判据通过，第二条明确限定整项为 partial；遇到旧的中心访问失败记录时，先重试受控写入链路，不能自行编辑 JSONL。
- 使用临时 CODEX_HOME 后，app-server 可完成 goal RPC，但启动阶段仍记录 WebSocket `wss://api.openai.com/v1/responses` 连接 `os error 10013`。这没有阻止本次元数据测试，但表示在当前沙箱内不能据此做真实模型轮或渠道健康判定。**试过**：`probe_goal_persistence.mjs` 的 app-server stderr。

## 还没解决的

- 下一步优先测 Claude inject-next 的真实运行中排队窗口，再验证 Codex 队列跨重启恢复。channel-health 本轮只有健康读取及容量排除证据（黑板 2270 partial），缺故障熔断闭环。

- 用隔离测试 thread 实测 `thread/goal/set` 的预算耗尽行为：设很小 tokenBudget，持续多轮，记录 `thread/goal/updated`、`thread/status/changed`、每轮 token usage 和最终状态；确认是否自动暂停/停止以及 `complete` 是否影响后续 turn。
- goal 持久化子判据已过；下一步需在获准的联网/模型执行环境设很小 tokenBudget，跑有限轮并观察 token usage、goal status、停止行为；不能仅凭本次 `tokensUsed=0` 通过完整 goal 单元。
- 实测 goal 与待办队列在 app-server 退出重启后的恢复语义：检查 goal 是否保留、活跃轮是否需要中心重新派发，禁止把持久化元数据误称为自动续跑。
- 真实用户流程测计划模式：切换 plan，观察模型是否触发 `item/tool/requestUserInput`，在网页 state 中看到 pending question，经 `/api/gateway/answer` 回答后核对同一个 thread/turn 继续并采用答案；同时确认取消、超时、多个问题的行为。
- 恢复官方网络资料：查阅 OpenAI Codex app-server 文档与 `openai/codex` 源码，记录版本/链接，核对 goal、budget、collaborationMode、requestUserInput 的稳定性和限制；当前仓库引用需与官方事实交叉验证。

## 出处

- 2026-10-20 已联网打开 [OpenAI Goals 官方指南](https://developers.openai.com/cookbook/examples/codex/using_goals_in_codex)：目标续推在空闲安全边界触发，plan-only 不触发，无工具调用的续推会被抑制。这是官方描述，尚不能替代本机预算停止实测。
- 本轮结果与可复测命令：[dsp_002706_j357 报告](../probe/reports/dsp_002706_j357.md)。

- 仓库入口与协议：[`channels/hosts/codex/app-server.md`](../hosts/codex/app-server.md)、[`channels/hosts/codex/README.md`](../hosts/codex/README.md)（其中列有官方文档 `https://developers.openai.com/codex/app-server` 与源码 `https://github.com/openai/codex`；本轮未成功联网打开）。
- 既有实验与审阅：[`channels/probe/results/codex-app-driver-20261018.md`](../probe/results/codex-app-driver-20261018.md)、[`channels/probe/results/agy-fact-codex-20261018.md`](../probe/results/agy-fact-codex-20261018.md)、[`channels/probe/MATRIX.md`](../probe/MATRIX.md)（Codex goal 行 1403、预算队列恢复行 1414）。
- 中心实现：[`trace/apps/cli/src/gateway/run_codex.ts`](../../trace/apps/cli/src/gateway/run_codex.ts)、[`trace/apps/cli/src/gateway/approvals.ts`](../../trace/apps/cli/src/gateway/approvals.ts)、[`trace/apps/cli/src/server.ts`](../../trace/apps/cli/src/server.ts)。
- 外网检索：本轮 `search_hub.js` 返回 All AnySearch keys failed；无新增外部出处。
