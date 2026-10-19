# Codex app-server 卷宗

## 关键信息

- **原生目标元数据入口**：`thread/goal/set`、`thread/goal/get`、`thread/goal/clear` 读写会话级 objective、status、tokenBudget；状态包括 `active`、`paused`、`blocked`、`usageLimited`、`budgetLimited`、`complete`。本机 Codex 0.159.2 协议说明记载目标保存在 `goals_1.sqlite` 并发 `thread/goal/updated`。**看到**：[app-server 协议表](../hosts/codex/app-server.md#目标追踪)、[Codex 事实探查报告](../probe/results/agy-fact-codex-20261018.md)。
- **“有 goal”不等于自动持续完成目标**：现有实测审阅确认 `set/get` 成功，但未观察到多轮 token 消耗后自动切为 `budgetLimited` 并停止；跨进程恢复后自动续跑也未被证明。**看到**：[矩阵行 1403](../probe/MATRIX.md)、[矩阵行 1414](../probe/MATRIX.md)。
- **计划模式与提问原语**：app-server 有 `thread/settings/update.collaborationMode`、`turn/start.collaborationMode`，计划进展以 `turn/plan/updated` 通知；`item/tool/requestUserInput` 是带 `id` 的服务端反向请求，客户端需回传 `{ answers: { questionId: { answers: [...] } } }`。**看到**：[app-server 协议说明](../hosts/codex/app-server.md#服务端逆向请求-serverrequest)、[协议通知表](../hosts/codex/app-server.md#服务端通知流-servernotification)。
- **中心已有接入路径**：`run_codex.ts` 在会话模式为 plan 时传入 `collaborationMode`，并把 `requestUserInput` 交给 `askPerson`；`approvals.ts` 将问题放入 `pendingQuestions`、等待 `/api/gateway/answer`，再把 answer 回给同一轮。故原生提问能力已具备中心代码接入，不代表每个模型/提示下都会主动提问。**看到**：[Codex 运行接线](../../trace/apps/cli/src/gateway/run_codex.ts)、[统一提问状态与答复](../../trace/apps/cli/src/gateway/approvals.ts)、[HTTP answer 路由](../../trace/apps/cli/src/server.ts)。
- **能力边界**：thread goal 是会话级目标和预算状态，不是中心任务板的分步编排、派工、验证与唤醒系统；中心仍需负责长程循环、重启后调度和验收。**看到**：[app-server goal/queue 接口](../hosts/codex/app-server.md#目标追踪)、[先前 app-server 驱动报告](../probe/results/codex-app-driver-20261018.md)。

## 经验

- 评估“持续推进到达成”要拆开验证：goal 写入/读回、模型是否按 objective 行动、预算阈值是否触发状态变化、达到 complete 后是否停止、进程重启后是否续推。仅看到 RPC 成功不能判定自治循环闭环。**依据**：矩阵对 goal 与 wake-persist 的审阅缺口（上列 1403、1414）。
- 计划模式提问链路是双向 JSON-RPC：读取线程不能同步阻塞等待人答；收到 `item/tool/requestUserInput` 后将问题挂到中心状态，再用原 request id 回复，否则可能死锁或丢失同轮恢复。**看到**：[ServerRequest 工程准则](../hosts/codex/app-server.md#服务端逆向请求-serverrequest)、[中心问答 resolver](../../trace/apps/cli/src/gateway/approvals.ts)。
- 本轮网络搜索尝试（`node hub/tools/search_hub.js search 'Codex app-server thread goal set requestUserInput plan mode' --max 5`）返回 `{ok:false, provider:'anysearch', error:'All AnySearch keys failed'}`，未获得可引用的外网结果；AP-Vibe bootstrap 也因安装清单中的版本目录不存在而无法取回 context。故本卷宗对新增结论使用仓库协议/实现证据，不声称本轮完成官方网页复核。**试过**：以上命令及 bootstrap 调用结果。

## 还没解决的

- 用隔离测试 thread 实测 `thread/goal/set` 的预算耗尽行为：设很小 tokenBudget，持续多轮，记录 `thread/goal/updated`、`thread/status/changed`、每轮 token usage 和最终状态；确认是否自动暂停/停止以及 `complete` 是否影响后续 turn。
- 实测 goal 与待办队列在 app-server 退出重启后的恢复语义：检查 goal 是否保留、活跃轮是否需要中心重新派发，禁止把持久化元数据误称为自动续跑。
- 真实用户流程测计划模式：切换 plan，观察模型是否触发 `item/tool/requestUserInput`，在网页 state 中看到 pending question，经 `/api/gateway/answer` 回答后核对同一个 thread/turn 继续并采用答案；同时确认取消、超时、多个问题的行为。
- 恢复官方网络资料：查阅 OpenAI Codex app-server 文档与 `openai/codex` 源码，记录版本/链接，核对 goal、budget、collaborationMode、requestUserInput 的稳定性和限制；当前仓库引用需与官方事实交叉验证。

## 出处

- 仓库入口与协议：[`channels/hosts/codex/app-server.md`](../hosts/codex/app-server.md)、[`channels/hosts/codex/README.md`](../hosts/codex/README.md)（其中列有官方文档 `https://developers.openai.com/codex/app-server` 与源码 `https://github.com/openai/codex`；本轮未成功联网打开）。
- 既有实验与审阅：[`channels/probe/results/codex-app-driver-20261018.md`](../probe/results/codex-app-driver-20261018.md)、[`channels/probe/results/agy-fact-codex-20261018.md`](../probe/results/agy-fact-codex-20261018.md)、[`channels/probe/MATRIX.md`](../probe/MATRIX.md)（Codex goal 行 1403、预算队列恢复行 1414）。
- 中心实现：[`trace/apps/cli/src/gateway/run_codex.ts`](../../trace/apps/cli/src/gateway/run_codex.ts)、[`trace/apps/cli/src/gateway/approvals.ts`](../../trace/apps/cli/src/gateway/approvals.ts)、[`trace/apps/cli/src/server.ts`](../../trace/apps/cli/src/server.ts)。
- 外网检索：本轮 `search_hub.js` 返回 All AnySearch keys failed；无新增外部出处。
