# antigravity 全路线实测报告（by zcode-glm / GLM，2026-10-17）

环境：hub-2.23.1 桌面端在跑，`language_server.exe` PID 34452、HTTP(Connect-RPC) 端口经 `/healthz` 探测；被测模型 flash_lite；所有会话为本人新建的 `probe-antigravity-*`（桌面 5 个 probe-lead-* 与其他会话未触碰）。黑板共追加 138 条（6 条路线 × 23 项），脚本在 `channels/probe/scripts/antigravity/`。

## 〇、关于"上一轮中断"的核实（2026-10-17 第二次进场）

负责人反馈上一轮"回复停在半截"。本轮进场核实：**上一轮工作在磁盘上是完整的**——黑板 138 条（含 cancel/quota/fork/model-switch/open-StartCascade/resume-native 全部点名项）已在 `blackboard.jsonl`（全部可解析，无凭证泄漏），报告与脚本均已存在。我这边没有未完成的半截步骤；推测负责人看到的截断是长输出（一次 watch 打了整段 transcript 约 50 行）造成的显示截断，而非实际中断。因此本轮**未重复追加任何黑板记录**（避免污染一格一条的矩阵），只做了两件事：

1. 脚本超时统一改为 90 秒（`run_agentapi.mjs` 默认 90000ms、`rpc.mjs` curl `--max-time 90`、`watch.mjs` 默认 90s）。
2. 按要求复测 resume-native 双向与 StartCascade（90 秒超时）：
   - 方向 A（RPC `SendUserCascadeMessage` 续 agentapi 开的原生会话）：**pass 复确认**——`{"status":200,"body":"{}"}` → step=4 `PLANNER_RESPONSE :: "cobalt-heron-42"`（与已录 pass 证据一致）。
   - 方向 B（agentapi `send-message` 续 StartCascade 新壳 `7cad1530-…`）：**partial 复确认**——送达返回 200/160ms，90 秒 watch 全程 `step_count=0`、状态恒 IDLE，轮次从不执行。已录 partial 的证据与结论成立，黑板无需改。
   - 顺带排查：`sidecar_sdk/index.mjs`（225 行）只包 agentapi CLI（`new-conversation`/HTTP `/_sidecar/new-conversation`），没有 StartCascade 直接调用，无字段线索；壳请求形态仍未解。测后壳已用 `DeleteCascadeTrajectory` 清除（db 行 + brain 目录均空）。

## 一、通断概览（断在哪一层）

| 路线 | 结论 | 断点 |
|---|---|---|
| `antigravity/L0/agentapi` | **主干通**。open/resume/steer/model-new/wake-bg/wake-timer/wake-msg 全 pass；resume-native partial；permission/model-switch/mode-switch fail；observe-live、cancel、close、fork、quota 等 CLI 无此子命令 → n/a（走 RPC） | CLI 只有 3 个子命令（get-conversation-metadata / new-conversation / send-message），控制面薄是设计如此，不是故障 |
| `antigravity/L0/connect-rpc` | **能力最全的一层**。resume/resume-native/cancel/fork/model-list/quota/wake-msg/wait-visible pass；open partial（StartCascade 只建壳不执行）；close partial（DeleteConversation 404，DeleteCascadeTrajectory 硬删可用）；permission/model-switch/mode-switch fail；compact n/a | `SetCascadeModelConfigData` 与 `DeleteConversation` 二进制里有符号但未注册 HTTP 服务（404）；`SetOrVerifyStaticConfig` 501 弃用 |
| `antigravity/L0/summaries-db` | 观察层 pass：observe-live/state/wait-visible pass；17 项 n/a（只读索引无控制接口） | — |
| `antigravity/L0/transcript` | 观察层 pass：observe-live/observe-history/steer/wake 组 pass；state partial（见下坑） | — |
| `antigravity/L1a/agy-acp` | **全 23 项 fail**：`spawn agy_acp_server.exe ENOENT`，桥二进制不存在，initialize 不可达 | acpx 注册表写死 `agy_acp_server.exe`，发行版未附带（resources/bin 仅 language_server.exe、webm_encoder.exe） |
| `antigravity/L1b/acpx` | **全 23 项 fail**：`AGENT_SPAWN_ENOENT`（原文在黑板） | 同上；未产生任何 acpx 会话记录 |

## 二、关键实测事实（都有原始证据在黑板）

1. **resume**：第二轮准确答出 `cobalt-heron-42`（agentapi 与 SendUserCascadeMessage 两条路都验过）。续接消息以 SYSTEM_MESSAGE 步进入 transcript。
2. **steer 是真·本轮内生效**：让出等待期（not_fully_idle=1）插话，`STEER_IN_TURN_OK`（t+24.3s）先于原任务完成回复 `DONE`（t+44.2s）落盘。
3. **cancel**：executor 运行中 `CancelCascadeInvocation` 200 即停，之后会话正常续（`STILL_ALIVE_AFTER_CANCEL`）。让出期调用会报 `executor is not currently running`——此时要停后台树得用 `ForceStopCascadeTree`（200，`stoppedConversationIds`，6 秒内 not_fully_idle 1→0，会话随后正常回复 `RECOVERED_AFTER_FORCESTOP`）。
4. **fork**：`ForkConversation {"sourceCascadeId","forkAtStepIndex"}` 200；分叉会话带着克隆历史直接答出记忆词（step 6）。参数名试错成本高：`conversationId`→`source_cascade_id is required`，`stepIndex` 被静默忽略。
5. **wake 组是 antigravity 的强项**：flash_lite 自发把慢命令放后台（`<cid>/task-N`）、让出（db 显示 IDLE+not_fully_idle=1，外部可见）、用 **Timer 工具**自设 4/5/6 分钟周期自醒检查；完成通知到达后被叫醒带结果继续。`SendAgentMessage`（跨会话 agent 消息）200 后空闲会话被唤醒作答 `AGENT_MSG_RECEIVED`。
6. **permission 断在"造不出审批"**：后端开的会话 `commandExecutionPolicy` 恒 `eager`；`--profile=review|ask|always-ask` 三档全被忽略；越界写操作直接拒绝（"falls outside the permissible workspace directory"）而非发起审批。应答口（`HandleCascadeUserInteraction`/`ResolveOutstandingSteps`）在方法表里存在但无从触发 → 应答半边 unverified。
7. **model-switch / mode-switch 后端无接口**：332 个服务方法里模型相关只有 Get*；`SetCascadeModelConfigData` 404。桌面端有模型下拉，说明这两个能力走桌面私有通道。**model-new 是通的**：`--model=flash_lite` 的轨迹回读 `modelTier=MODEL_TIER_FLASH_LITE`、`responseModel=gemini-3.5-flash-lite`。
8. **compact n/a**：332 个方法 + agentapi 3 个子命令里都没有会话整理类接口。
9. **close 只有硬删**：`DeleteCascadeTrajectory` 删库行 + brain 目录（实测两个废壳删净）；无优雅关闭。
10. **state 的坑（已复现）**：transcript 出现"DONE 且无 tool_calls"时智能体可能只是在等后台任务（step 11/21），必须联 `summaries-db` 的 `not_fully_idle` 才是真值——与 hosts/antigravity.md 第四节第 5 条一致。

## 三、没把握的结论

- **StartCascade 空壳**：桌面同款建会话 RPC 只建出 step_count=0 的壳，prompt 字段被静默忽略。我试了 prompt/title/source/workspaceUris 组合，未能逆向出可执行请求形态。**桌面到底用什么字段把首轮 prompt 带进去，未解**。因此"续人手在桌面开的会话"只能推断（agentapi send-message 对正常会话从未失手），不能拿壳会话当反例。
- **wake-stall 的"永挂"半边**：flash_lite 拒绝执行人为的永不结束任务（"I will not run that command."），只能证它有界自醒（Timer 递进）+ 外部可解卡，证不了平台侧有无硬超时。
- **wake-persist**：定时唤醒配盘（sidecar cron）构造上可活过重启；进行中后台等待驻留 LS 进程内存——不能重启桌面验证，是构造推断不是实测。
- **watch 首轮有个假 DONE 误报**（fork 会话验证时 watch 提前退出，转写实际 6 行、答案正确）：我的 watch.mjs 判据在"转写已有旧 DONE 行 + db 瞬时 idle"时会提前收工，复用脚本的人注意。

## 四、对任务定义的反驳/建议

1. **L0 内部应再分层**：antigravity 的 L0 实际是三条独立面（agentapi CLI / Connect-RPC / 落盘三件套），能力差异极大（如 quota 只有 RPC 有、state 只有 db 有）。"L0 通/断"一句话会掩盖真值，黑板已按 4 条 route 分开记。
2. **resume-native 对 antigravity 应拆成两个方向**：RPC 续 agentapi 会话（通）与 agentapi 续桌面会话（只能间接推断，受"不碰桌面"限制）。任务书把它当单一格子，各家记录时建议注明方向。
3. **能力矩阵应加一列"控制面在哪个面"**：antigravity 的 cancel/fork/quota 只在 RPC、state 只在 db、模型选择只在创建时——"在哪层通"之外，"同一层里哪个入口通"同样重要（332 个 RPC 方法本身也有 404 的）。
4. flash_lite 档位对"为测试而设的计时器/永挂任务"会拒绝执行（指令服从性弱），测 wake 组建议用较长真实命令（ping -n 46~120 实测可用）而不是抽象任务描述。
