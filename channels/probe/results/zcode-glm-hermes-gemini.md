# 实测报告：hermes 与 gemini 的 L0/L1a/L1b 调用路线

- 测试员：zcode-glm（GLM-5.3-flash），2026-10-17
- 范围：hermes 三条路线 × 23 项能力、gemini 三条路线 × 23 项能力；黑板共追加 **138 条**（hermes 69、gemini 69），全部带本次调用的原始输出/数据库行。
- 规矩遵守：未改仓库已有文件、未动全局配置、未登录任何账号；命令行走代理 127.0.0.1:7892；第二轮起每条命令 `timeout 90`。测试会话名全部 `probe-` 前缀；被测方 hermes 用 custom:glm-5.3 / glm-5.2（同通道两个真模型），gemini 意图用 gemini-2.5-flash（未达）。

## 一、通断概览

### hermes（hermes-agent 0.21.x，桥即自带 acp_adapter，state.db 会话库三路共享）

| 能力 | L0 `hermes chat`（hermes/L0/cli） | L1a ACP 直连（hermes/L1a/acp-bridge） | L1b `acpx hermes`（hermes/L1b/acpx） |
|---|---|---|---|
| open / resume / observe-live / observe-history | pass | pass | pass |
| resume-native | pass（CLI 能续 acp 源会话） | pass（loadSession 能挂 CLI 会话，答出暗号） | **fail**（acpx 只能续自己名下记录，无挂接原生会话的入口） |
| state | partial（ended_at 判忙闲；外部硬杀后库里永远"working"） | partial（有流式通知、无显式状态原语） | pass（`acpx hermes status` 报 pid/running/model/uptime） |
| cancel | pass（只能外部杀进程树） | pass（但 prompt RPC 以 -32603 内部错误收场而非 stopReason=cancelled） | pass（`acpx hermes cancel`，会话存活可续） |
| close | n/a（无命令；oneshot 自动落 ended_at） | pass（closeSession） | pass（sessions close） |
| steer | fail（非 TTY stdin 完全不读） | **pass（中途插话 "Redirected the active turn"，本轮生效）** | fail（--no-wait 只是排队 [queued]，下一轮生效） |
| permission | fail（非交互连 --safe-mode 都直接放行，无审批门） | **pass（requestPermission 中途到达，allow_once 后继续执行）** | partial（中途请求到达但由 acpx 策略代答，默认 deny，人答不了） |
| fork | n/a | pass（unstable_forkSession，分叉带全上下文） | n/a（acpx 未暴露） |
| compact | n/a（/compact 被当普通文本） | n/a（ACP 1.8 无此方法） | n/a |
| model-list | partial（真实列表只在交互 picker 拉取的磁盘缓存里） | pass（session/new 声明 5 个 availableModels） | pass（流内同声明） |
| model-new | pass（-m+--provider，用量行证实） | **fail（newSession 无 model 位，_meta 被忽略）** | pass（--model 首轮生效，用量行证实） |
| model-switch | pass（续接 -m 换模型，session_model_usage 新行为证） | pass（扩展方法 session/set_model，glm-5.3→glm-5.2 用量行为证） | pass（--model 于既有会话，用量行为证） |
| mode-switch | n/a（模式只是启动 flag） | fail（setSessionMode 返回 {} 但 fork 读回仍 default，无任何通知） | pass（set-mode accept_edits 后写文件行为被放行） |
| quota | n/a（status 无额度段） | partial（仅上下文用量 usage_update） | partial（同左） |
| wake-bg / wake-timer / wake-msg / wait-visible / wake-stall / wake-persist | fail / **pass** / partial / partial / partial / partial | 全 n/a（协议无原语） | n/a / n/a / n/a / partial / n/a / n/a |

**hermes 亮点**：wake-timer 在 L0 是完整真通——`hermes cron create 2m` → gateway(PID 27336) 到点触发 → 自动新建 cron 会话回复"定时醒来"（state.db source='cron' 可查）；任务落盘 cron/jobs.json+executions.db，失败也落账（首次因创建时漏 --provider 失败，报错原文在黑板）。坑：cron create 不传 --provider 会快照成 provider:'custom' 然后无凭据失败——建任务必须带 provider。

### gemini（CLI 0.62.0，oauth-personal）

**三条路线全部不通，断点同一处：本机凭据。** oauth_creds.json expiry_date=1761505425112（2025-10-26，过期近一年），settings.json selectedType=oauth-personal，环境无 GEMINI_API_KEY/GOOGLE_API_KEY。

- L0：`gemini -p` 卡 "Opening authentication page in your browser. Do you want to continue? [Y/n]:"，不答则 90s 超时，答 n 则 `FatalCancellationError: Authentication cancelled by user.`（exit 55）。连 `--list-sessions` 这种纯本地操作也先过 auth 门。
- L1a：`gemini --acp` 起来后对 initialize 完全静默（stdout/stderr 全空，90s 无响应）。agentCapabilities 未知，23 项无从谈起。
- L1b：acpx 自己给出权威诊断："Gemini CLI ACP startup timed out before initialize completed…waiting on interactive OAuth… No GEMINI_API_KEY or GOOGLE_API_KEY was set for non-interactive auth."，sessions new 失败，prompt 报 NO_SESSION（exit 4）。
- 按任务书未尝试登录。gemini 的 69 条黑板记录中 fail 33 条（命令存在但被 auth 门挡），n/a 36 条（协议/命令层根本没有该项）。

## 二、值得负责人注意的发现

1. **同一能力三路不等价，hermes 是活例**：steer 在 L1a 直连是"本轮重定向"（真插话），到 L1b acpx 退化成"排队下一轮"；mode-switch 在 L1a 直连 setSessionMode 不生效、在 L1b acpx 的 set-mode 反而生效；permission 只有 L1a 能让人（客户端）中途应答。能力矩阵按"路线"填才成立，按"家"填会失真。
2. **模型真凭建议统一用 hermes 的 session_model_usage 表**：三个路线的 model-switch/model-new 都以"同会话新增另一模型的用量行"为准，接口返回和回复自述只作旁证。L1a 的 set_model 是 acpx 生态扩展方法（session/set_model），不在 ACP 1.8 schema 里，SDK 类型上没有——集成时要么走 acpx 要么自己发原始帧。
3. **L1a cancel 的坑**：桥打断生效、会话可用，但被取消的 prompt 调用会 reject `{"code":-32603,"data":{"details":"'NoneType' object has no attribute 'startswith'"}}`——调用方必须把 cancel 后的异常当正常路径处理。
4. **L0 状态识别的假象**：进程被硬杀后 hermes state.db 的 sessions.ended_at 仍为 NULL，库里看起来永远在跑；判"是否真在跑"要结合 gateway_state.json（但其 updated_at 也可能停更两天）/`hermes status` 的 Sessions Active。
5. **gemini 修复路径**：要么浏览器重登一次 OAuth，要么设置 GEMINI_API_KEY/GOOGLE_API_KEY（acpx 明示支持 API-key 非 interactive）。这是配置/凭据问题，不是能力缺失——修好后值得重测，尤其 L1a 的 modes/models 声明。

## 三、没把握的结论（如实声明）

- L1a mode-switch 记 fail 依据是 setSessionMode 后 fork 读回 default 且无 current_mode_update 通知；存在"fork 复制会重置模式"的可能，未用第三手段（行为放行测试）复核。
- L0 wake-msg 记 partial 未做端到端：本机 WhatsApp/WeCom/Mattermost 等平台插件已配置但任务书禁止往外发消息，"外部消息注入唤醒本地会话"只验证到 cron --deliver local 的语法层。
- wake-persist 各处均未重启宿主（任务书禁止），"重启后 cron 还在"只基于磁盘落盘证据。
- gemini L1a "initialize 无响应"是在管道 stdin 下测的；不排除 TTY 下行为不同（无 TTY 环境可测）。
- antigravity 家族同日另有 138 条黑板记录，非本次范围，未复核。

## 四、产物

- 黑板：channels/probe/blackboard.jsonl 追加 138 行（by=zcode-glm，family=hermes/gemini）
- 脚本：channels/probe/scripts/hermes/（probe_l1a_hermes.mjs、probe_l1a_p2.mjs、probe_l1a_p3.mjs、bb_hermes_l0.mjs、bb_hermes_l1a_l1b.mjs、peek_schema.mjs）、channels/probe/scripts/gemini/（probe_l1a_gemini.mjs、bb_gemini.mjs）
- 原始输出：channels/probe/scripts/tmp/zcode-glm/（hermes-l0/、hermes-l1b/、gemini-l0/、gemini-l1b/、各日志）
