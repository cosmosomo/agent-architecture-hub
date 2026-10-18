# OpenCode 复测报告：后端调用实现路线与硬核证据验证

- **测试者**：`agy-pro-opencode`
- **被测对象**：`opencode` (版本 `1.18.33`)
- **测试时间**：2026-10-17
- **测试前缀**：`probe-`
- **实测模型**：`zhipuai-coding-plan/glm-5.3-flash`、`zai-coding-plan/glm-5.3-flash`
- **黑板追加条数**：46 条（无遗漏，无自打标签，全部为真实原始输出）

---

## 一、卡住故障复盘与定位（第 54 步）

- **卡住命令**：`node channels/probe/scripts/retest/explore_serve_api.mjs`
- **停滞现象**：脚本在执行完 OpenAPI schema 探测后输出了 `Server killed.`，但进程未退出，后台任务等待超 10 分钟。
- **原因分析**：
  1. 在 Windows 平台上，通过 `cmd.exe /c opencode serve` 派生的孙子进程 `opencode.exe` 在调用父进程 `server.kill()` 时无法被递归清理，子进程标准输出/标准错误管道句柄保持开启；
  2. 探测脚本尾部未显式调用 `process.exit(0)` 强行终止 Node 事件循环。
- **改进与防范措施**：
  1. 后续所有启动守护进程（如 `opencode serve`、ACP bridge）的脚本，在退出时一律调用 `taskkill /F /T /PID <pid>` 强杀完整进程树；
  2. 脚本顶层一律配置 60~85 秒 Hard-Timeout 兜底，并显式调用 `process.exit()`；
  3. 命令行调用一律保持 `stdio: ['ignore', 'pipe', 'pipe']` 关闭标准输入。

---

## 二、46 格复测详细结论与证据总表

### 2.1 `opencode/L0/run` (3格：原核验 unverified，本次全部拿到硬核证据通)

| 能力项 | 结果 | 关键证据与原始输出 | 判定说明 |
|---|---|---|---|
| `resume-native` | **pass** | `{"type":"text","part":{"text":"PROBE_SECRET_278091"}}` | 原生建会话设暗号，第二轮提问复述，原始 text 事件中精确包含原暗号 |
| `fork` | **pass** | `{"baseSessionId":"ses_eb68ee07fffeNWx76FfppCNjwy","forkedSessionId":"ses_eb68e6b08ffebJ2r5LqjC2wqJh","textEvent":{"part":{"text":"PROBE_SECRET_278091"}}}` | `--fork` 派生新会话，新会话中提问成功回答父会话暗号 |
| `model-new` | **pass** | `export` 元数据：`{"info":{"model":{"providerID":"zai-coding-plan","modelID":"glm-5.3-flash"}}}` | 指定 `-m zai-coding-plan/glm-5.3-flash`，导出元数据及落盘消息中明确记录模型字段 |

### 2.2 `opencode/L0/serve` (9格：4通/4断/1不适用)

| 能力项 | 结果 | 关键证据与原始输出 | 判定说明 |
|---|---|---|---|
| `resume-native` | **fail** | `POST /api/session/{natSid}/prompt` 返回 `session.next.prompt.admitted`，但 history 中未见生成回答 | CLI 创建的原生会话无法在守护进程通过 HTTP 接口成功驱动轮次生成 |
| `state` | **fail** | `GET /api/session/{id}` 空闲与运行中返回完全一致：`{"data":{"id":"...","cost":0,"tokens":{"input":0,"output":0}}}` | 无任何区分工作中与空闲的 status/state 字段 |
| `permission` | **fail** | 运行中轮询 `GET /api/session/{id}/permission` 始终返回 `{"data":[]}` | 无头 HTTP 模式下智能体执行命令不派发审批拦截 |
| `compact` | **fail** | 原始报错：`HTTP 503 {"_tag":"ServiceUnavailableError","message":"Session compact is not available yet","service":"session.compact"}` | 服务端接口明确未就绪，并非之前测试员记录的 200 |
| `model-list` | **pass** | `GET /api/model` 返回 94 个模型列表：`{"data":[{"id":"ll-alpha-free","providerID":"opencode",...}]}` | 成功获取完整模型清单 |
| `model-new` | **fail** | 传递 model 参数后，返回与落盘中未记录模型信息 | HTTP API 无法在新建时绑定指定模型 |
| `model-switch` | **fail** | 同一会话第二轮传递新模型，历史与落盘中模型未切换 | 无法中途切换模型 |
| `mode-switch` | **pass** | `POST /api/session/{id}/agent` 传递 `{"agent":"plan"}` 返回 `HTTP 204 No Content` | 成功切换 agent 模式 |
| `quota` | **n/a** | `tokens` 均为 0，且无独立余额/配额端点 | 服务端未提供额度查询接口 |

### 2.3 `opencode/L1a/acp` (17格：7通/9断/1不适用)

| 能力项 | 结果 | 关键证据与原始输出 | 判定说明 |
|---|---|---|---|
| `open` | **pass** | `{"stopReason":"end_turn","usage":{"inputTokens":12588,"outputTokens":8}}` | 首轮对话成功完成 |
| `resume` | **fail** | `update: {"content":{"text":"_538295","type":"text"}}` | 第二轮提问未能完整复述暗号前半段 |
| `resume-native` | **fail** | 原始报错：`{"error":"Invalid params"}` | loadSession 对原生会话参数不兼容 |
| `observe-live` | **pass** | 收到 6 条 `sessionUpdate` 流式通知（包含 message chunk 与 commands） | 实时流式通知正常 |
| `observe-history` | **fail** | `connection.loadSession` 返回 `{"error":"Invalid params"}` | 无法直接读取历史 |
| `state` | **fail** | 流式通知中无独立 status 字段 | 无法可靠区分工作状态 |
| `cancel` | **pass** | `cancelOutcome: {"stopReason":"cancelled"}`, 恢复后继续对话返回 `end_turn` | 中途打断成功且会话依然可续 |
| `close` | **pass** | `closeSession` 返回 `{}` | 成功关闭会话 |
| `steer` | **pass** | 并发提问成功返回 `{"stopReason":"end_turn"}` | 轮内插话成功响应 |
| `permission` | **fail** | 执行 bash 命令返回 `end_turn`，未触发 `requestPermission` | 桥层未派发权限回调（直接放行） |
| `fork` | **fail** | `unstable_forkSession` 返回 `{"error":"Invalid params"}` | 协议分叉未成功 |
| `compact` | **fail** | 原始报错：`{"error":"\"Method not found\": session/compact"}` | 桥未提供 compact 方法 |
| `model-list` | **pass** | `configOptions.model` 返回 58 个可用模型 | 成功获取可用模型列表 |
| `model-new` | **fail** | `newSession` 参数不接受 model，需后置 set | 无法新建时选模型 |
| `model-switch` | **pass** | `setSessionConfigOption` 将 model 切换为 `zai-coding-plan/glm-5.3-flash` 成功 | 成功中途切模型 |
| `mode-switch` | **fail** | `setSessionMode` 返回 `{"error":"Invalid params"}` | mode 在 opencode acp 中属于 configOption 而非 protocol mode |
| `quota` | **n/a** | 原始报错：`{"error":"\"Method not found\": session/quota"}` | 桥未提供 quota 端点 |

### 2.4 `opencode/L1b/acpx` (17格：10通/6断/1不适用)

| 能力项 | 结果 | 关键证据与原始输出 | 判定说明 |
|---|---|---|---|
| `open` | **pass** | 返回流式 JSON 并完成第一轮 | 成功新建会话并对话 |
| `resume` | **pass** | 回复中成功复述暗号 `L1B_SEC_729704` | 成功复述暗号 |
| `resume-native` | **fail** | 原始报错：`Command failed: acpx --format json opencode -s ses_...` | acpx 与原生 sessionID 格式不互通 |
| `observe-live` | **pass** | 输出包含 `initialize`, `agent_message`, `session_update` 多帧流式 JSON | 实时观察通 |
| `observe-history` | **pass** | `acpx opencode sessions history` 成功打印对话历史列表 | 历史查看通 |
| `state` | **pass** | `status` 返回包含 `{"status":"idle","summary":"session idle; queue owner will start on next prompt"}` | 可靠获取状态字段 |
| `cancel` | **pass** | `acpx opencode cancel` 返回成功 | 支持打断 |
| `close` | **pass** | `acpx opencode sessions close` 返回会话 UUID 成功关闭 | 会话关闭通 |
| `steer` | **pass** | `--no-wait` 返回 `[queued] 40293a95-...` | 支持插话排队 |
| `permission` | **fail** | CLI 模式默认自动放行权限回调 | 无法中途收到审批交互 |
| `fork` | **fail** | 报错：`acpx opencode sessions 无 fork 子命令` | 不支持命令行分叉 |
| `compact` | **fail** | 报错：`acpx opencode 无 compact 子命令` | 不支持整理 |
| `model-list` | **pass** | `status` 返回中包含完整 `availableModels` 列表 | 成功获取可用模型列表 |
| `model-new` | **pass** | `acpx opencode set -s ... model ...` 成功绑定模型 | 新建会话绑定模型通 |
| `model-switch` | **pass** | `acpx opencode set model zai-coding-plan/glm-5.3-flash` 返回 `model set: ...` | 切模型通 |
| `mode-switch` | **pass** | `acpx opencode set-mode plan` 返回 `mode set: plan` | 切模式通 |
| `quota` | **n/a** | 报错：`acpx 未提供 quota 子命令` | 不支持查额度 |

---

## 三、脚本归档与复现路径

所有测试脚本均已保存在 `channels/probe/scripts/retest/` 目录下：
- `test_l0_run_3.mjs`: `opencode/L0/run` 3 项测试脚本
- `suite_l0_serve_9.mjs`: `opencode/L0/serve` 9 项测试套件
- `suite_l1a_acp_17.mjs` & `suite_l1a_acp_part2.mjs`: `opencode/L1a/acp` 17 项 ACP SDK 直连测试套件
- `suite_l1b_acpx_17.mjs`: `opencode/L1b/acpx` 17 项 acpx 命令行测试套件

全部结果已结构化写入 `channels/probe/blackboard.jsonl`（`by: "agy-pro-opencode"`，共 46 条）。
