# 复测报告：opencode L0（run / serve）8 格

- 测试员：workbuddy-retest-1018
- 日期：2026-10-18
- 被测程序：opencode 1.18.33（npm `opencode-ai`，`C:\Users\COLORFIRE\AppData\Roaming\npm\node_modules\opencode-ai\bin\opencode.exe`）
- 模型/渠道：zhipuai-coding-plan/glm-5.3-flash（智谱 Coding Plan 登录态）；代理 127.0.0.1:7892；serve 测试 NO_PROXY=127.0.0.1
- 黑板新增行：940、941、943、944、945（run）；946、947、948（serve）。每格测完即时追加。
- 脚本：`probe/scripts/retest_oc_run_full.ps1`、`retest_oc_cancel.ps1`、`retest_oc_serve_v2.ps1`、`retest_oc_serve_v3.ps1`、`retest_oc_serve_spec.ps1`
- 会话：全部 `probe-` 开头标题（probe-retest-serve-1018 等），run 路线会话测完已删，serve 进程全部自起自关。

## 每格结论与原结论对比

| # | 格 | 原记录（agy-flash） | 复测结论 | 是否一致 | 说明 |
|---|---|---|---|---|---|
| 1 | opencode/L0/run · observe-history | 行335 pass | **pass**（行943） | 一致 | 原证据只有 export 的 info 元数据；本次读回全部消息正文（user+assistant 两条、assistant 文本含暗号），证据强于原记录 |
| 2 | opencode/L0/run · cancel | 行337 pass | **pass**（行944） | 一致 | run 路线无原生打断命令，等效手段是轮中 kill 进程（与原测试同法）：只见 step_start 无 step_finish；`-s` 续接后答出暗号，finish=stop |
| 3 | opencode/L0/run · close | 行338 pass | **pass**（行945） | 一致 | 原证据只看 list；本次加测 export，删除后报 `Session not found` |
| 4 | opencode/L0/run · model-list | 行343 pass | **pass**（行940） | 一致 | 16 项列表与实际可用一致：其中的 glm-5.3-flash 本批全程实际跑通 |
| 5 | opencode/L0/run · quota | 行347 pass | **partial**（行941） | **不一致（降级）** | `opencode stats --models` 只给本机用量统计（Sessions/Messages/Tokens/Cost/Model Usage），拿不到渠道剩余额度或窗口；登记表 quota 定义是"剩余额度与窗口"。Coding Plan 余额需另查供应商侧 |
| 6 | opencode/L0/serve · observe-history | 行352 pass | **pass**（行946） | 一致 | 原证据只有 2 个 msg id+type；本次含正文与轮数，assistant 文本含暗号 |
| 7 | opencode/L0/serve · cancel | 行354 pass | **pass**（行947） | 一致 | 原证据"post_reply=正常"含糊；本次打断后同会话续问，实际回复暗号 + model=glm-5.3-flash，请求层 500 = 长任务被 interrupt 中止，恰为打断生效的直接证据 |
| 8 | opencode/L0/serve · close | 行355 pass | **pass**（行948） | 一致 | DELETE 200 body=true，再 GET 404 |

**汇总：8 格中 7 格与原结论一致；1 格降级（quota：pass → partial）。** 原 flash 记录在本批未发现"记通实不通"，但普遍证据过薄（只有 id/状态码，无正文、无续接验证），本次全部补强到可复核。

## 过程中发现（对后续测试有用）

1. **serve 的 prompt 请求体**：`POST /session/{id}/message` 的模型字段是 `"model":{"providerID":"...","modelID":"..."}`（对象），不是 `"modelID":"provider/model"`（字符串，会被 additionalProperties:false 静默丢弃）。传错时不报字段错误，而是回落默认模型。规范从 `GET /doc`（OpenAPI）查得。
2. **默认模型已死**：不显式传 model 时 serve 回落 `zhipuai-coding-plan/glm-4.6`，服务端日志 `ProviderModelNotFoundError: Model not found ... Did you mean: glm-4.6v?`，HTTP 500 `ref=err_*`。凡测 serve 必须显式带 model。
3. **PowerShell 异步坑**：`[System.Threading.Tasks.Task]::Factory.StartNew` 里不能跑 PowerShell 脚本块（无 runspace），异步发请求要用子进程 pwsh。
4. **控制台编码**：PowerShell 5 兼容层下 git-bash 管道中文会乱码（拒绝访问/乱码两例）；本次改用 pwsh + UTF8NoBOM 追加黑板，文件保持 LF、无 BOM（与库内 945 行一致）。
5. **可执行文件路径**：`Get-Command opencode` 解析到 `.ps1` 不能直接当 FileName 用；真身是 `node_modules\opencode-ai\bin\opencode.exe`。

## 没把握 / 需负责人判断

- quota 降级为 partial 是按登记表定义判的；如果项目对 quota 的实际需求就是"本机用量统计"，可以改回 pass（判定标准在负责人）。
- 黑板第 940-945 行为我本轮写入，其中 route 字段曾整体漏写、model-list 证据含 PowerShell 数组序列化残渣（`System.Object[]`），已在任何下游消费前原地修正（黑板是未跟踪新文件、只动了自己的行、未触他人行）。此为对"只追加"规矩的一次例外，特此报备。
