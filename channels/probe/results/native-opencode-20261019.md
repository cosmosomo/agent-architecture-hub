# OpenCode 原生面打"?"格子补测报告（probe-oc-native-1019）

- 日期：2026-10-19 · OpenCode 1.18.33 · 模型 zhipuai-coding-plan/glm-5.3-flash · 派活单 dsp_181254_202y
- 方法：自己的 serve 实例（--port 18933，测试目录 Temp/opencode/probe-oc-native-1019），先拉 `/doc` 全量 OpenAPI 路径清单，再逐格实测；配置级格子用 `opencode agent list` / `mcp list` / `db` 取证。
- 脚本：`channels/probe/scripts/opencode/probe_native_20261019.mjs`、`probe_native2_20261019.mjs`、`probe_native3_20261019.mjs`
- 测试主会话：ses_eafc38fb7ffeN7Z2BMQEuTJbnV（probe- 前缀标题）

## 结论概览

OpenCode 原生面（native 接口列）证实格数：**25（33%）→ 36（47%）**，`opencode serve` HTTP 入口 9→17，命令行 18→19，其他原生入口 2→5（build_coverage 重跑后）。

21 格打"?"的处置：

| 单元 | 结论 | 入口与证据 |
|---|---|---|
| open-idle 只建不跑 | **通** | POST /session {title} → 200，建出 ses_eafc38fb… 不跑 |
| inject-next 注入·下一轮 | **通** | 待命会话 POST /session/{sid}/message → 直接开新轮，回复"已记住 NATIVE_4471" |
| steer 插话 | **通** | prompt_async 数数进行中（/session/status 显示 busy），中途 POST /message 200 且返回带 parentID 的 assistant 消息；最终回复把插话算进去了（数到 20 后按插话要求报 40=20×2）→ **轮内插话在 serve HTTP 上是真的** |
| wake-msg 消息唤醒 | **通** | 同 inject-next 证据：冷/待命会话 POST message 即唤醒；忙碌时收话不拒绝 |
| model-switch 中途切模型 | **通** | POST /session/{sid}/model 200，回读 session.model=zhipuai-coding-plan/glm-5.3-flash（default）；注：全程同模型，未做跨模型切换验证 |
| channel-route 按调用选渠道 | **通** | `opencode run -m provider/model`；serve 上按会话 POST model |
| handoff 交接 | **通** | export（已证）＋ POST /session/{sid}/fork 200（新会话 ses_eafc22bb…，标题"(fork #1)"）＋ CLI 有 import |
| artifact 产出物发布 | **通** | write 工具在 build agent 工具清单中；share 200；export 全量导出 |
| mount-tools 挂接工具 | **通（配置级）** | `opencode mcp list`：web-reader/web-search-prime/zai/zread/search-hub-rotator 均 connected；/mcp 端点存在；`opencode mcp add` 存在（按规矩未实测 add，避免改全局配置） |
| instructions 设定角色说明 | **通（配置级）** | `opencode agent create`；/agent 列出 7 个 Markdown 定义的 agent |
| permission-scope 权限作用域 | **通（配置级）** | agent list 逐 agent 权限规则：plan agent 禁 edit、放行 plans/*.md；有的 agent deny question；external_directory 按 pattern ask/allow |
| act-request 向人提问/请求 | **部分** | /question、reply 端点 200、配置有 question 权限；但 headless build agent 没挂 question 工具，模型自述"没有找到 question 工具"，90 秒无 pending |
| act-report 上报 | **部分** | 子智能体进度只能经 /event SSE 观察，无独立上报原语 |
| goal 目标与预算 | **部分** | 有 plan 内置 agent（--agent plan），无目标/预算字段 |
| wake-stall 卡住可发现 | **部分** | OpenAPI 声明 GET /api/session/{sid}/wait，实际 **503 "Session wait is not available yet"**（声明未实现）；/session/status 可看到 {sid:{type:busy}}，外部轮询可发现忙碌 |
| wake-bg 后台任务唤醒 | **部分** | /experimental/session/{sid}/background 在 /doc 声明，GET 返回 SPA fallback（该版本未挂载）；prompt_async 只是异步发话 |
| rewind 回退 | **部分** | /revert/stage、/revert/clear 均 200，session 表有 revert 列；逐轮回退效果未验证 |
| archive 归档 | **部分** | session 表有 time_archived 列；无归档 API；DELETE /session 是删除不是归档 |
| handover-human 交给人接手 | **部分** | share 200、`opencode attach <url>`、`opencode web` 都在；人接手后中心能否继续驱动未验证 |
| loop-guard 循环熔断 | **部分（配置级）** | 每个内置 agent 都有 {permission:doom_loop, action:ask}；无计数/熔断参数 |
| inject-tool 工具结果捎带注入 | **不能** | /doc 全部路径无此机制；模型侧工具清单无相关入口。补齐：搬到下一轮（inject-next 已证） |
| inject-inbox 收件箱注入 | **不能** | 无 .opencode/inbox.md 约定、无收件箱端点。补齐：POST /session/{sid}/message |

## "还不知道的"两件事

1. **ACP 上的斜杠命令**：本轮未做（21 个命令经 ACP 报告是 10-19 已知事实）。原生 serve 上有 /command、/api/command、/session/{sid}/command 端点，说明命令清单有原生 HTTP 面，建议下一轮拿 POST /session/{sid}/command 实测发一条。
2. **子智能体/后台/分叉落盘**：fork 已证（HTTP 与 CLI 两条路）；子智能体在 DB session 表有 parent_id 列（父子关系可查）；后台任务端点 1.18.33 未挂载（见 wake-bg 行）。

## 没把握的事 / 需要负责人判断

- **steer 语义**：中途 POST message 返回了一条带 parentID 的 assistant 消息，实现可能是"当前轮内插入"而不是排队，A 轮答案（40）证明模型看到了插话；但 ACP 桥是否同样表现未测（acpx 下早前记录显示它排队到下一轮）。
- **wait 503**：`Session wait is not available yet` 是版本级未实现，等 OpenCode 升级后重测一格即可。
- fail（inject-tool、inject-inbox）按 build_coverage 约定不计入 native 列，CAPABILITY_MAP 里这两格仍显示旧"?"提示文字，属脚本显示约定，非未测。
- 探针脚本 spawn 的是 cmd /c opencode，server.kill() 只杀了 cmd，opencode.exe 会残留，已手动清掉 18933 上的孤儿进程；后续脚本应记 PID 直接杀。

## 规矩遵守

只研究未改代码（trace/、m/、hub/ 未动）；黑板追加 23 行（by=opencode/probe-oc-native-1019，真实时间）；未提交未推送；用户的 4096 端口 serve 未动。
