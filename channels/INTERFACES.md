# 接口地图：前端控件 → 接口 → 网关 → 下层命令 → 能力

> **历史文档**（截至 10-18：控件 → 接口 → 命令的对照。接口以 `hub/data/actions.json` 为准（`agent_gateway.js tables check` 核对）；手机页 `/m/` 已是主页面。）

负责人（Claude）2026-10-17 读代码整理。本文是“定义”：控件和接口实际连到哪里。每条结论标来源：〔代码〕读代码得出（附文件:行号）；〔实测〕见 `probe/blackboard.jsonl` 行号。下层每项能力能不能做，以 `probe/MATRIX.md` 为准。入口文档见 [README.md](README.md)。

## 一、总的走向

```
/console/（console/console.js）  ┐
首页对话抽屉（hub/js/obs/chat.js）┘ → /api/gateway/* → server.ts → gateway.ts（AgentGatewayHub）
                                                                    ├ antigravity：language_server.exe agentapi（new-conversation / send-message）
                                                                    └ 其余六家：cmd.exe /c acpx --format json <权限> --timeout 180 --cwd <目录> [--model M] <家> prompt -s <会话名> -f -
命令行 hub/tools/agent_gateway.js → :8899 开着时转 /api/gateway/send；否则自己调 acpx（-f 文件）或 agentapi
```

只读旁路：`/api/sessions` = trace 读层（各家原生会话） + gateway.getExtraSummaries（acpx 会话、WorkBuddy 库、Antigravity brain、Hermes 库）拼在一起〔代码 server.ts:429〕。

**根本结构**：控制只有一条主路——acpx 的命名会话（Antigravity 例外）。下层实测能做的原生能力（Codex app-server 的插话、分叉、压缩上下文；Antigravity Connect-RPC 的分叉、打断；ZCode/Hermes/Claude ACP 桥的中途审批、接管原生会话）网关都没有接。

## 二、两个前端的约定不一致

| 项 | /console/ | 首页对话抽屉 |
|---|---|---|
| 权限字段 | 发 `permissionMode`（approve-all 等）〔console.js:1557〕，**后端读 `permissions`**〔server.ts:226〕→ 永远按 `all` 处理，下拉框无效 | 发 `permissions`〔chat.js:219〕，有效 |
| 指向哪个会话 | 只发 `sessionName`，原生会话取编号末段当名字〔console.js:413-421〕，不发 `traceSessionId` | 发 `traceSessionId`〔chat.js:432 等〕 |
| 切模型 | 只改页面状态，下次发送时带 `--model`〔console.js:2443〕 | 调 `/api/gateway/model`〔chat.js:426〕 |
| 切目录 | 只改页面状态，下次发送时带 `--cwd` | 调 `/api/gateway/cwd`〔chat.js:514〕 |
| 续跑 | 发一句固定提示“请直接从刚才中断…继续”〔console.js:2389〕 | 调 `/api/gateway/resume`〔chat.js:719〕，后端同样是发一句提示〔gateway.ts:3102〕 |

同一操作从两个页面点下去，结果不同。

## 三、控件逐条（/console/）

| 区域 | 控件 | 处理 → 接口 | 网关 → 下层 | 判断 |
|---|---|---|---|---|
| 输入栏 | 🚀 发送 / Enter | sendPromptNow → POST /send `{channel, sessionName, prompt, cwd, model, permissionMode}` | sendPrompt → startRunInternal → acpx prompt（六家）/ agentapi（AGY） | 对 acpx 会话：接通〔代码〕；**超时写死 180 秒**〔gateway.ts:4218〕，长任务会被杀；权限永远全放行（见第二节） |
| 输入栏 | ⏳ 加入排队 | 同上；后端若该会话在跑则进**网关内存队列**〔gateway.ts:3437〕 | 本轮结束后网关再发 | 排队到下一轮，不是插话；队列在内存，服务重启即丢〔代码〕 |
| 输入栏 | ⚡ 中断并立即发送 | 先 POST /cancel 再 POST /send〔console.js:1575〕 | acpx cancel / Connect-RPC Cancel | 是“打断+新一轮”，不是插话。Codex app-server、Antigravity 有真插话但未接〔矩阵〕→ 没接上 |
| 输入栏 | 模型下拉 nxCtlModel | 只改状态，发送时带 `--model` | acpx `--model` 对**已存在**的命名会话是否切换，未实测 | 待实测；模型列表在 console.js 头部写死 |
| 输入栏 | 权限下拉 nxCtlPerm | 只改状态，发送字段名错 | — | **假闭环**〔代码〕 |
| 输入栏 | 目录下拉 nxCtlCwd | 只改状态，发送时带 `--cwd` | acpx 会话目录在建会话时定，已有会话换 cwd 的效果未实测 | 待实测 |
| 输入栏 | @ 提及接力 / 以 `@家 指令` 开头发送 | executeCrossChannelHandoff → POST /handoff | handoffSession：取最近 3 轮文字拼成提示，发给目标家新会话〔gateway.ts:3292〕 | 是“带摘要新开”，不是分叉；下层原生分叉（Codex、Antigravity、ZCode/Hermes 桥）未接 → 没接上 |
| 输入栏 | / 快捷指令 | 插入斜杠文本 | 作为普通提示发给智能体 | 取决于该家是否认这个斜杠命令 |
| 对话头 | ⏹ 中止运行 | POST /cancel | acpx cancel（六家）/ CancelCascadeInvocation（AGY）〔gateway.ts:3530〕 | 下层打断多数通〔矩阵〕；L2 待实测 |
| 对话头 | 🔄 断点续跑 | 发固定提示 | 普通发送 | 名不副实：不是“接管原生会话”，也不是“出错可恢复” |
| 对话头 | ⇄ 跨渠道接力 / 🚀 立即接力 | 同 @ 提及 | 同上 | 同上 |
| 对话头 | 切换至默认模型（出错时出现） | 把模型改成默认再发 | 普通发送 | 默认模型写死在前端 |
| 横幅 | 审批条：允许一次/始终允许/拒绝 | POST /approve | resolveApproval：拒绝直接结束；允许 = 带 `--approve-all` 再发一句“请继续”〔gateway.ts:3195-3240〕；待审批项来自进程结束后对输出做正则〔gateway.ts:3960〕 | **假闭环**〔代码，L2-B 实测同〕；下层真审批（Codex app-server、Claude/ZCode/Hermes ACP 桥）未接 → 没接上 |
| 左栏 | 会话行（点击） | selectSession → GET /api/sessions/<id> | 读层或 acpx 会话转换 | 原生会话可看；**之后发消息会新建同名 acpx 会话，原会话没续上** → 接错路 |
| 左栏 | ＋新建会话 | POST /session/new | createNewSession：只在内存登记一个 `new-<家>-<名>`，首次发送才真建〔gateway.ts:2203〕 | 懒创建；页面马上显示“新会话”但下层还不存在 |
| 顶栏 | 值守胶囊 / 总监视图：⚡ 立即唤醒、💾 同步 | POST /meta-agents/patrol、/meta-agents | 四个元智能体；“自动批准”开启时把只读请求升级为全放行〔gateway.ts:3415〕 | 行为需逐个评估；自动升级权限只留日志 |
| 顶栏 | ↻ 刷新 | GET /state + /api/sessions | — | 读 |
| 全局 | 状态灯、运行条 | GET /stream（SSE） | broadcast(run_update 等) | Antigravity 已改为按会话索引判结束；acpx 系看 NDJSON |

重复入口（L3 核实，见 `probe/results/zcode-glm-L3.md`）：新建会话 /console/ 6 处、抽屉 3 处；取消共 5 处另有 2 个死按钮；巡检 5 处；接力 5 处；两页各有一套写死的模型表；续跑两套实现走两个接口。约 60 组控件，按“唯一真值入口”可收敛到约 10 组。

首页对话抽屉的控件与上表一一对应（发送、取消、切模型、切目录、续跑、接力、审批、值守），差别见第二节；另有展开思考、工具、子会话等纯查看控件。

## 四、接口逐条（server.ts → gateway.ts）

| 接口 | 网关方法 | 实际做什么 | 判断 |
|---|---|---|---|
| POST /api/gateway/send | sendPrompt :3364 | 选会话名（traceSessionId 只在 acpx 会话里找）→ 在跑则进内存队列，否则 startRunInternal | 见上；原生会话不会被续 |
| POST /api/gateway/cancel | cancelRun :3512 | acpx cancel；AGY 调 CancelCascadeInvocation | 下层多数通 |
| POST /api/gateway/resume | resumeInterruptedSession :3102 | 发一句续跑提示 | 名不副实 |
| POST /api/gateway/model | setSessionModel :2970 | 改 `~/.acpx/sessions/*.json` 的 current_model_id，再后台跑 `acpx set-model` | 在下层 set-model 实测有效的家（ZCode、WorkBuddy）可能真生效；改 json 本身不等于生效 |
| POST /api/gateway/cwd | setSessionCwd :2900 | 改 json 与网关内存 | 待实测 |
| POST /api/gateway/approve | resolveApproval :3195 | 见第三节 | 假闭环 |
| POST /api/gateway/handoff | handoffSession :3252 | 最近 3 轮文字 → 新会话 | 不是分叉 |
| POST /api/gateway/session/new | createNewSession :2203 | 内存占名 | 懒创建 |
| GET/POST /api/gateway/meta-agents(/patrol) | 元智能体 | 巡检、自动批准、自动续跑、维护 | 待评估 |
| POST /api/control | server.ts:359 | 往 `hub/cases/<案例>/` 追加 inbox.md、human_actions.jsonl，**不调用任何智能体，会写仓库** | 假闭环（L2-B 实测） |
| GET /api/gateway/state, /stream | getState, addSseClient | 读 | — |
| GET /api/sessions(/id) | store + gateway 拼合 | 读 | 读和控两套会话身份 |

## 五、缺陷

逐条缺陷与修复状态已并入 [EVALUATION_20261017.md](EVALUATION_20261017.md) 附录 A（原文照录）。
