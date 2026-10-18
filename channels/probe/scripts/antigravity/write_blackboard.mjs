// Append antigravity probe results (6 routes x 23 capabilities) to channels/probe/blackboard.jsonl.
// Evidence is raw output captured during the 2026-10-17 session. No credentials (csrf) included.
import fs from 'node:fs';

const AT = `2026-10-17T18:50:00+08:00`;
const BY = `zcode-glm`;
const FAMILY = `antigravity`;
const CID_MAIN = `01882f10-3cd3-4001-a688-1722b3da0438`;
const CID_LONG = `78322fe8-ab4f-4a86-baf3-7d8c7ee3dbf4`;
const CID_FORK = `d8f214e2-d2f1-40a8-90d7-051a2b540676`;
const S = `channels/probe/scripts/antigravity/`;

const rec = (layer, route, surface, capability, result, condition, evidence, cmd, note = ``) =>
  ({ at: AT, by: BY, family: FAMILY, layer, route, surface, capability, result, condition, evidence, cmd, note });

const rows = [];

// ---------- Route 1: L0 agentapi ----------
const R1 = [`L0`, `antigravity/L0/agentapi`, `native-cli`];
rows.push(
  rec(...R1, `open`, `pass`, `agentapi new-conversation --model=flash_lite（2.23.1 需 env ANTIGRAVITY_PROJECT_ID，取 outside-of-project）；送达即返回，本轮 PLANNER_RESPONSE "OK"`,
    `{"exit":0,"durationMs":186,"stdout":{"response":{"newConversation":{"prompt":"Please remember this word: cobalt-heron-42...","conversationId":"` + CID_MAIN + `"}}}}  转写: {"step_index":1,"type":"PLANNER_RESPONSE","status":"DONE","output_tokens":1,"content":"OK"}`,
    S + `run_agentapi.mjs --timeout 25000 new-conversation --model=flash_lite --title=probe-antigravity-main "<prompt>"（env: ANTIGRAVITY_LS_ADDRESS/CSRF_TOKEN/PROJECT_ID）`),
  rec(...R1, `resume`, `pass`, `对 agentapi 自开轮次（会话 ` + CID_MAIN + `）第二轮提问，回复含第一轮记忆词`,
    `send-message exit 0 (153ms) → {"step_index":2,"type":"SYSTEM_MESSAGE"} → {"step_index":3,"type":"PLANNER_RESPONSE","status":"DONE","input_tokens":2377,"output_tokens":8,"content":"cobalt-heron-42"}`,
    S + `run_agentapi.mjs send-message ` + CID_MAIN + ` "What word did I ask you to remember...?"`),
  rec(...R1, `resume-native`, `partial`, `桌面人开的会话无法测（规矩禁触桌面 UI/他人会话）。用桌面同款 RPC StartCascade 开的会话是空壳：agentapi send-message 返回送达成功但 step_count 恒 0、永不出轮次`,
    `{"exit":0,"stdout":{"response":{"sendMessage":{"recipientId":"e9c244e4-7015-42fc-998c-c364771b02ff","content":"Please remember this word: native-orka-77..."}}}} 而库行: {"status":"CASCADE_RUN_STATUS_IDLE","not_fully_idle":0,"step_count":0}`,
    S + `run_agentapi.mjs send-message e9c244e4-7015-42fc-998c-c364771b02ff "<prompt>"`, `壳会话任何后端路线都跑不动；RPC 方向续 agentapi 会话是通的（见 connect-rpc 行）`),
  rec(...R1, `observe-live`, `n/a`, `CLI 是送达即退出（fire-and-forget），无流式/跟随子命令`,
    `agentapi --help → "Available Commands: get-conversation-metadata / new-conversation / send-message"（仅 3 个）`,
    S + `run_agentapi.mjs --timeout 15000 --help`),
  rec(...R1, `observe-history`, `pass`, `get-conversation-metadata 返回全量元数据（createdAt/staticConfig/commandExecutionPolicy 等）`,
    `{"response":{"conversationMetadata":{"metadata":{"createdAt":"2026-10-17T10:09:40.914Z","initializationStateId":"8f2dd29b-...","staticConfig":{"codingAgent":{"googleMode":true,"agenticMode":false},"commandExecutionPolicy":"eager",...}}}}}`,
    S + `run_agentapi.mjs get-conversation-metadata ` + CID_MAIN),
  rec(...R1, `state`, `n/a`, `CLI 各输出（metadata/new/send）都不含运行状态字段；状态识别要走 summaries-db 路线`,
    `metadata 键: workspaces,createdAt,initializationStateId,parentConversationId,rootConversationId,subagentSpec,staticConfig（无 status/not_fully_idle）`,
    S + `run_agentapi.mjs get-conversation-metadata <cid>`),
  rec(...R1, `cancel`, `n/a`, `命令面无打断子命令；打断只能走 Connect-RPC CancelCascadeInvocation`,
    `agentapi --help 仅 get-conversation-metadata / new-conversation / send-message`,
    S + `run_agentapi.mjs --help`),
  rec(...R1, `close`, `n/a`, `命令面无关闭/删除子命令`, `agentapi --help 仅 3 个子命令`, S + `run_agentapi.mjs --help`),
  rec(...R1, `steer`, `pass`, `让出等待期（not_fully_idle=1）插话，同一逻辑轮内被处理：插话回复先于原任务完成回复`,
    `t+16.8s step=18 SYSTEM_MESSAGE(插话送达) → t+24.3s step=23 PLANNER_RESPONSE DONE tokens=4115/8 :: "STEER_IN_TURN_OK" → t+44.2s step=25 :: "DONE"(ping 完成才到)`,
    S + `run_agentapi.mjs send-message ` + CID_LONG + ` "STEER MID-TURN: abandon the ping command right now..."`),
  rec(...R1, `permission`, `fail`, `agentapi 开的会话命令执行策略恒为 eager（自动放行）；--profile=review/ask/always-ask 三档全部被忽略；工作区外写操作直接拒绝而非发起审批`,
    `三个会话 metadata 均为 "commandExecutionPolicy": "eager"；拒答原文: "I cannot create a file on the Desktop as requested because it falls outside the permissible workspace directory."`,
    S + `run_agentapi.mjs new-conversation --profile=review|ask|always-ask ... 然后 get-conversation-metadata 对比`, `后端路线无法进入"等审批"状态，审批应答 RPC（HandleCascadeUserInteraction/ResolveOutstandingSteps）无从验证`),
  rec(...R1, `fork`, `n/a`, `命令面无 fork 子命令；ForkConversation 走 RPC`, `agentapi --help 仅 3 个子命令`, S + `run_agentapi.mjs --help`),
  rec(...R1, `compact`, `n/a`, `命令面无整理/压缩子命令（3 个子命令里没有）`, `agentapi --help 输出`, S + `run_agentapi.mjs --help`),
  rec(...R1, `model-list`, `n/a`, `CLI 无列模型子命令；模型列表走 RPC GetCascadeModelConfigData`, `agentapi --help 仅 3 个子命令`, S + `run_agentapi.mjs --help`),
  rec(...R1, `model-new`, `pass`, `--model=flash_lite 真实生效：轨迹 RPC 回读该会话实际模型档与响应模型`,
    `GetCascadeTrajectory 字段: "modelTier":"MODEL_TIER_FLASH_LITE", "responseModel":"gemini-3.5-flash-lite", "modelName":"gemini-3.5-flash-lite"（注意 flash_lite 内部代号是 MODEL_PLACEHOLDER_M198，档案卡写 M320 已过时）`,
    S + `run_agentapi.mjs new-conversation --model=flash_lite ... + ` + S + `rpc.mjs GetCascadeTrajectory {"cascadeId":"<cid>"}`),
  rec(...R1, `model-switch`, `fail`, `CLI 无切模型子命令；其他路线也无（SetCascadeModelConfigData 404、332 方法表无 Set*Model*），会话中切模型后端做不到`,
    `SetCascadeModelConfigData → "status: 404 / 404 page not found"`,
    S + `rpc.mjs SetCascadeModelConfigData {"conversationId":"<cid>","modelOrAlias":{"model":"MODEL_PLACEHOLDER_M318"}}`, `桌面端有模型下拉，说明该能力只存在于桌面私有通道`),
  rec(...R1, `mode-switch`, `fail`, `--profile 三档全被忽略（策略恒 eager）；无改模式子命令`,
    `new-conversation --profile=review|ask|always-ask 三会话 metadata 均 "commandExecutionPolicy": "eager"、"agenticMode": false`,
    S + `run_agentapi.mjs new-conversation --profile=<p> ...`),
  rec(...R1, `quota`, `n/a`, `CLI 无查额度子命令；走 RPC`, `agentapi --help 仅 3 个子命令`, S + `run_agentapi.mjs --help`),
  rec(...R1, `wake-bg`, `pass`, `flash_lite 自主把慢命令放后台、让出、被完成通知叫醒后带着结果继续`,
    `step=6 GENERIC :: "Tool is running as a background task with task id: ` + CID_LONG + `/task-6 Task Description: powershel..."; step=11 PLANNER_RESPONSE :: "I have started the PowerShell command in the background and am waiting for it to finish."; 之后 task 完成通知唤醒 → step=25 :: "DONE"`,
    S + `run_agentapi.mjs send-message ` + CID_LONG + ` "Run this exact command... ping -n 46 127.0.0.1..."`),
  rec(...R1, `wake-timer`, `pass`, `智能体有 Timer 工具且未被禁用，等待期间自发定时自醒检查后台任务；平台另有 cron 型 automation sidecar（配置在盘）`,
    `step=10 GENERIC :: "task id: .../task-10 Task Description: Timer: 4"; step=16 :: "Timer: 5"; step=30 :: "Timer: 6"；sidecar 配盘: {"trigger":{"type":"schedule","schedule":{"cron":"CRON_TZ=Asia/Shanghai 0 */8 * * *"}}}`,
    `transcript.jsonl of ` + CID_LONG + ` + ~/.gemini/config/sidecars/our-journal-patrol/sidecar.json`),
  rec(...R1, `wake-msg`, `pass`, `外部消息能唤醒空闲与让出中的会话（多次复现：resume/steer/peer 消息全部即时起轮）`,
    `IDLE 会话 send-message 后 1-3s 内 db 翻 RUNNING；跨会话 RPC 版见 connect-rpc 行`,
    S + `run_agentapi.mjs send-message <cid> "<msg>"`),
  rec(...R1, `wait-visible`, `n/a`, `CLI 自身无观察口；让出可见性由 summaries-db（not_fully_idle）与 transcript（GENERIC 后台任务步）承载`,
    `见 L0/summaries-db 与 L0/transcript 两行`,
    S + `watch.mjs <cid>`),
  rec(...R1, `wake-stall`, `partial`, `等不来时智能体用 Timer 周期自醒（有界轮询），外部可用 ForceStopCascadeTree 解卡且会话存活；但被等任务本身无硬超时（无法构造永不来事件：flash_lite 拒绝执行）`,
    `ForceStopCascadeTree → {"status":200,"body":{"stoppedConversationIds":["` + CID_LONG + `"]}} 6s 后 not_fully_idle 1→0；之后 step=47 :: "RECOVERED_AFTER_FORCESTOP"；拒绝原文: "I will not run that command."`,
    S + `rpc.mjs ForceStopCascadeTree {"conversationId":"<cid>"} + 后续 send-message`),
  rec(...R1, `wake-persist`, `partial`, `定时唤醒以配置文件持久（重启后由 LS 重载，构造上存活）；进行中的后台等待驻留 language_server.exe 进程内（task id 仅存 transcript），宿主重启即失；按规矩不能重启桌面验证`,
    `盘上配置: ~/.gemini/config/sidecars/our-journal-patrol/sidecar.json trigger={"type":"schedule","schedule":{"cron":"CRON_TZ=Asia/Shanghai 0 */8 * * *"}}；无对应磁盘队列`,
    `ls ~/.gemini/config/sidecars/*/`, `重启验证被规矩禁止，构造推断需标为假设`)
);

// ---------- Route 2: L0 connect-rpc ----------
const R2 = [`L0`, `antigravity/L0/connect-rpc`, `daemon-rpc`];
rows.push(
  rec(...R2, `open`, `partial`, `StartCascade(source=CORTEX_TRAJECTORY_SOURCE_CASCADE_CLIENT) 200 建出会话（db 可见）但轮次从不执行：prompt 字段被忽略、step_count 恒 0；缺桌面私有的完整请求形态`,
    `{"status":200,"body":{"cascadeId":"bd4e8117-7024-482c-a490-5857bf3a0c9b"}} 之后库行 {"status":"CASCADE_RUN_STATUS_IDLE","not_fully_idle":0,"step_count":0}；加 workspaceUris 一样 step_count=0`,
    S + `rpc.mjs StartCascade {"prompt":"...","title":"probe-antigravity-native","source":"CORTEX_TRAJECTORY_SOURCE_CASCADE_CLIENT"}`, `400 错误链: 首次 "CortexTrajectorySource is unspecified"`),
  rec(...R2, `resume`, `pass`, `SendUserCascadeMessage 对已有会话注入用户消息，新轮次执行且回复正确`,
    `{"status":200,"body":"{}"} → watch: step=4 type=PLANNER_RESPONSE status=DONE input_tokens=20731 output_tokens=8 :: "cobalt-heron-42"`,
    S + `rpc.mjs SendUserCascadeMessage {"cascadeId":"` + CID_MAIN + `","message":"What word...","messageOrigin":"MESSAGE_ORIGIN_SDK_EXECUTABLE"}`),
  rec(...R2, `resume-native`, `pass`, `RPC 路线续 agentapi 开的原生会话成功（问答命中第一轮记忆词）；反向（续 RPC 壳会话）不通见 agentapi 行`,
    `同上 resume 证据（会话 ` + CID_MAIN + ` 由 agentapi new-conversation 创建，经 SendUserCascadeMessage 续）`,
    S + `rpc.mjs SendUserCascadeMessage {"cascadeId":"<agentapi 开的 cid>",...}`),
  rec(...R2, `observe-live`, `partial`, `阻塞式等待原语可用（会话全闲即返回）；流式方法在 332 方法表中存在但未做流式观察实测`,
    `WaitForConversationFullyIdle {"conversationId":"<cid>","timeoutSeconds":5} → status 200 {}`,
    S + `rpc.mjs WaitForConversationFullyIdle {"conversationId":"<cid>","timeoutSeconds":5}`, `方法表尚有 StreamCascadeSummariesReactiveUpdates/StreamAgentStateUpdates 未实测`),
  rec(...R2, `observe-history`, `pass`, `GetCascadeTrajectory 返回全步级轨迹（含 executionId/statusTransitions/model 字段）`,
    `{"status":200,"body":{"trajectory":{"trajectoryId":"bcec8d91-...","cascadeId":"` + CID_MAIN + `","trajectoryType":"CORTEX_TRAJECTORY_TYPE_CASCADE","steps":[{"type":"CORTEX_STEP_TYPE_USER_INPUT","status":"CORTEX_STEP_STATUS_DONE","metadata":{...}}]}}}`,
    S + `rpc.mjs GetCascadeTrajectory {"cascadeId":"<cid>"}（注意参数是 cascadeId，用 conversationId 报 "conversation id is required"）`),
  rec(...R2, `state`, `partial`, `步级状态完备（CORTEX_STEP_STATUS_*、statusTransitions），有阻塞等待原语；会话级 RUNNING/IDLE 真值只在 summaries-db，RPC 元数据不含`,
    `GetCascadeTrajectory: "status":"CORTEX_STEP_STATUS_DONE","internalMetadata":{"statusTransitions":[{"updatedStatus":"CORTEX_STEP_STATUS_DONE","timestamp":"..."}]}`,
    S + `rpc.mjs GetCascadeTrajectory + WaitForConversationFullyIdle`),
  rec(...R2, `cancel`, `pass`, `executor 运行中 CancelCascadeInvocation 200，轮次中止、会话存活可续；让出期调用则报"executor 未运行"（语义清晰不误伤）`,
    `{"status":200,"body":"{}"}；让出期: {"code":"unknown","message":"executor is not currently running (error ID: d6b8eb75f0b64e299b336f6867820fe0)"}；中止后 step=37 PLANNER_RESPONSE :: "STILL_ALIVE_AFTER_CANCEL"`,
    S + `rpc.mjs CancelCascadeInvocation {"cascadeId":"` + CID_LONG + `"}（发慢任务 3s 内调用）`),
  rec(...R2, `close`, `partial`, `DeleteConversation 二进制有符号但未注册 HTTP 服务（404）；DeleteCascadeTrajectory 可用：200 且库行+brain 目录同删，属硬删除`,
    `DeleteConversation → "status: 404 / 404 page not found"；DeleteCascadeTrajectory {"cascadeId":"a523bf10-..."} → 200 {}，随后库查无此行、brain/ 无此目录`,
    S + `rpc.mjs DeleteCascadeTrajectory {"cascadeId":"<cid>"}`, `无优雅关闭/归档接口`),
  rec(...R2, `steer`, `pass`, `SendUserCascadeMessage/SendAgentMessage 是 agentapi send-message 的同一 LS 入口，插话即注入 SYSTEM_MESSAGE 步；本路线实测以 agentapi 侧 STEER_IN_TURN_OK 为准`,
    `SendUserCascadeMessage 200 {} + agentapi 侧 t+24.3s "STEER_IN_TURN_OK" 先于 t+44.2s "DONE"`,
    S + `rpc.mjs SendUserCascadeMessage ...`),
  rec(...R2, `permission`, `fail`, `审批应答方法存在（HandleCascadeUserInteraction、ResolveOutstandingSteps 在 332 方法表）但后端无法制造待审批状态：SetOrVerifyStaticConfig 501 弃用、无策略设置方法、eager 自动放行、越界操作走拒绝而非审批`,
    `{"status":501,"body":{"code":"unimplemented","message":"unimplemented: SetOrVerifyStaticConfig is deprecated and unimplemented (error ID: 522da97fcf244df58e8e35c6eb88581e)"}}`,
    S + `rpc.mjs SetOrVerifyStaticConfig {"cascadeId":"<cid>","staticConfig":{"commandExecutionPolicy":"ask"}}`, `应答半边 unverified：造不出审批请求`),
  rec(...R2, `fork`, `pass`, `ForkConversation 原生分叉成功：新会话继承全量步历史并可直接续跑`,
    `{"status":200,"body":{"newCascadeId":"` + CID_FORK + `","forkedAtStepIndex":3,"newProjectId":"outside-of-project"}}；分叉会话提问 → {"step_index":6,"type":"PLANNER_RESPONSE","status":"DONE","content":"cobalt-heron-42"}`,
    S + `rpc.mjs ForkConversation {"sourceCascadeId":"` + CID_MAIN + `","forkAtStepIndex":3}`, `参数名两次试错: conversationId→"source_cascade_id is required"；stepIndex/forkStepIndex 均被忽略→"at step 0 ... user message" 错误`),
  rec(...R2, `compact`, `n/a`, `332 个服务方法中无 Compact*/Compress*/Summariz* 会话整理方法`, `grep -E "Compact|Compress|Summariz" 于 language_server.exe 抽取的 LanguageServerService/ 全方法表，无命中`,
    `grep -aoE "LanguageServerService/[A-Za-z]+" language_server.exe | sort -u`),
  rec(...R2, `model-list`, `pass`, `GetCascadeModelConfigData 返回真实模型池（9 个，含 label/modelId/内部枚举/配额余量/推荐标记/默认档）`,
    `{"status":200,"body":{"clientModelConfigs":[{"label":"Gemini 4 Argon (Medium)","modelOrAlias":{"model":"MODEL_PLACEHOLDER_M418"},...,"modelId":"gemini-4-argon-medium"},...9 个...],"clientModelSorts":[...],"defaultOverrideModelConfig":{"modelOrAlias":{"model":"MODEL_PLACEHOLDER_M418"}}}}`,
    S + `rpc.mjs GetCascadeModelConfigData {}`),
  rec(...R2, `model-new`, `n/a`, `RPC 路线新建只能建出空壳（轮次不执行），无法验证新建时选模型是否生效；该能力经 agentapi --model 已验 pass`,
    `StartCascade 200 后 step_count 恒 0，无任何轮次可读模型`, S + `rpc.mjs StartCascade ...`),
  rec(...R2, `model-switch`, `fail`, `SetCascadeModelConfigData 符号存在但 404（未挂服务）；332 方法表中模型相关仅 Get*；中途切模型后端无接口`,
    `{"status":404,"body":"404 page not found"}（POST /exa.language_server_pb.LanguageServerService/SetCascadeModelConfigData）`,
    S + `rpc.mjs SetCascadeModelConfigData {"conversationId":"<cid>","modelOrAlias":{"model":"MODEL_PLACEHOLDER_M318"}}`),
  rec(...R2, `mode-switch`, `fail`, `无会话级模式 RPC（BattleMode 是另一功能）；唯一的静态配置写口 SetOrVerifyStaticConfig 501 弃用`,
    `{"status":501,"body":{"code":"unimplemented","message":"unimplemented: SetOrVerifyStaticConfig is deprecated and unimplemented..."}}；方法表 grep "mode" 仅 BattleMode/GetStatus 类`,
    S + `rpc.mjs SetOrVerifyStaticConfig ...`),
  rec(...R2, `quota`, `pass`, `RetrieveUserQuotaSummary + GetUserStatus 双双 200，实时窗口余量与套餐信息`,
    `{"response":{"groups":[{"displayName":"Gemini Models","buckets":[{"bucketId":"gemini-5h","remainingFraction":0.84307194,"resetTime":"2026-10-17T10:00:03Z"},{"bucketId":"gemini-weekly","remainingFraction":0.94355416,...}]},...]}}；GetUserStatus: "teamsTier":"TEAMS_TIER_PRO","planName":"Pro"`,
    S + `rpc.mjs RetrieveUserQuotaSummary {} / GetUserStatus {}`),
  rec(...R2, `wake-bg`, `pass`, `同一 LS 执行体：RPC 可触发同样行为（SendUserCascadeMessage 实证能驱动轮次），且 ForceStopCascadeTree 提供后台树解卡；行为原始证据见 agentapi/transcript 行`,
    `ForceStopCascadeTree {"conversationId":...} → {"status":200,"body":{"stoppedConversationIds":["` + CID_LONG + `"]}}`,
    S + `rpc.mjs SendUserCascadeMessage / ForceStopCascadeTree`),
  rec(...R2, `wake-timer`, `pass`, `同上执行体等价：智能体 Timer 工具自醒 + 平台 cron sidecar 配盘持久（证据见 agentapi 行）`,
    `transcript task-10/16/30 "Timer: 4/5/6"；sidecar.json cron "0 */8 * * *"`, `同 agentapi 行`),
  rec(...R2, `wake-msg`, `pass`, `SendAgentMessage（agent 域消息，跨会话投递）200，空闲会话被唤醒并处理内容`,
    `{"status":200,"body":"{}"} → step=48 SYSTEM_MESSAGE → step=49 PLANNER_RESPONSE DONE :: "AGENT_MSG_RECEIVED"（db step_count 48→50）`,
    S + `rpc.mjs SendAgentMessage {"recipient":"<cid>","content":"..."}`, `字段两次试错原文: "content is required"、"recipient is required"`),
  rec(...R2, `wait-visible`, `pass`, `RPC+db 组合可外部观察让出：WaitForConversationFullyIdle 阻塞直至全闲；库 not_fully_idle 与步级状态可读`,
    `WaitForConversationFullyIdle → 200 {}（全闲即返回）；让出期 db {"status":"CASCADE_RUN_STATUS_IDLE","not_fully_idle":1}`,
    S + `rpc.mjs WaitForConversationFullyIdle ...`),
  rec(...R2, `wake-stall`, `partial`, `外部解卡完备（ForceStopCascadeTree 实测，6s 内 not_fully_idle 1→0 且会话存活）；被等事件无内建超时，构造不了永不来事件（flash_lite 拒绝），该半边 unverified`,
    `同 agentapi wake-stall 行证据`, S + `rpc.mjs ForceStopCascadeTree ...`),
  rec(...R2, `wake-persist`, `partial`, `同 agentapi 行：定时类配置盘上持久、进行中等待驻留进程内存；重启验证被规矩禁止`,
    `~/.gemini/config/sidecars/our-journal-patrol/sidecar.json`, `同 agentapi 行`)
);

// ---------- Route 3: L0 summaries-db ----------
const R3 = [`L0`, `antigravity/L0/summaries-db`, `sqlite-index`];
const dbBasis = `只读索引库（node:sqlite readOnly），无写入/控制接口；列: conversation_id,title,preview,step_count,last_modified_time,workspace_uris,status,source,project_id,agent_name,parent_conversation_id,nesting_depth,battle_id,winning_conversation_id,not_fully_idle,killed,last_user_input_time,last_user_input_step_index,app_data_dir,raw_summary,group_id`;
const naDb = (cap, why) => rec(...R3, cap, `n/a`, why || `控制类能力不适用`, dbBasis, `node -e "new DatabaseSync(.../conversation_summaries.db,{readOnly:true})"`);
rows.push(
  naDb(`open`, `库行随会话创建出现，但库本身无控制接口`),
  naDb(`resume`), naDb(`resume-native`),
  rec(...R3, `observe-live`, `pass`, `回合进行中 1s 内可见状态翻转，实时性足够做外部观察`,
    `watch 输出: [t+1.1s] db: {"status":"CASCADE_RUN_STATUS_RUNNING","not_fully_idle":1,"step_count":3} → 轮毕 [t+2.1s] {"status":"CASCADE_RUN_STATUS_IDLE","not_fully_idle":0,"step_count":4}`,
    S + `watch.mjs <cid>（内部轮询该库）`),
  rec(...R3, `observe-history`, `partial`, `索引有 step_count/preview/raw_summary 但无全量内容；全量要靠 transcript/conversations db`, `列定义见上；raw_summary 未逐字验读`, `node:sqlite 查询`),
  rec(...R3, `state`, `pass`, `status+not_fully_idle 组合可区分：RUNNING=工作中、IDLE+busy=1=让出等待、IDLE+busy=0=真闲可续；卡死态可由长时 RUNNING 发现`,
    `{"status":"CASCADE_RUN_STATUS_IDLE","not_fully_idle":1}（让出期 t+15s 采样）与 {"status":"CASCADE_RUN_STATUS_IDLE","not_fully_idle":0}（全闲）；RUNNING 样本见 observe-live 行`,
    S + `watch.mjs <cid>`),
  naDb(`cancel`), naDb(`close`), naDb(`steer`), naDb(`permission`),
  naDb(`fork`, `库有 parent_conversation_id/winning_conversation_id 列可观察分叉关系，但无控制接口`),
  naDb(`compact`), naDb(`model-list`), naDb(`model-new`), naDb(`model-switch`), naDb(`mode-switch`), naDb(`quota`),
  naDb(`wake-bg`, `行为类能力：库只能看到 not_fully_idle 侧写，无控制/事件接口`),
  naDb(`wake-timer`, `定时任务配置不在本库（在 ~/.gemini/config/sidecars/），库无相关行`),
  naDb(`wake-msg`, `无事件/控制接口`),
  rec(...R3, `wait-visible`, `pass`, `让出状态在库中显式可见（IDLE+not_fully_idle=1），是外部判断"在等什么"的第一入口（配合 transcript 后台任务步）`,
    `{"status":"CASCADE_RUN_STATUS_IDLE","not_fully_idle":1,"step_count":44}（120s ping 让出期采样）`, S + `watch.mjs <cid>`),
  rec(...R3, `wake-stall`, `partial`, `卡住可由长时 busy=1 被外部发现并配合 ForceStop 解除；库内无超时字段`, `busy=1 持续期间采样见 wait-visible 行`, `只读轮询`),
  rec(...R3, `wake-persist`, `partial`, `会话行落盘持久（重启后行仍在）；not_fully_idle 由 LS 进程维护，崩溃/重启后的陈旧值行为未验（不能重启桌面）`, `库文件 ~/.gemini/antigravity/conversation_summaries.db`, `只读打开验证`)
);

// ---------- Route 4: L0 transcript ----------
const R4 = [`L0`, `antigravity/L0/transcript`, `jsonl-file`];
const trBasis = `只读 JSONL 文件，无控制接口；路径 ~/.gemini/antigravity/brain/<cid>/.system_generated/logs/transcript.jsonl（紧凑版）与 transcript_full.jsonl（完整版）`;
const naTr = (cap) => rec(...R4, cap, `n/a`, `控制类能力不适用`, trBasis, `fs.readFileSync 逐行 JSON.parse`);
rows.push(
  naTr(`open`), naTr(`resume`), naTr(`resume-native`),
  rec(...R4, `observe-live`, `pass`, `步级事件落盘延迟 ~1s，中途可读到 GENERIC 后台任务步与增量 PLANNER_RESPONSE`,
    `watch 输出（起 15s 内）: step=6 GENERIC status=RUNNING :: "Tool is running as a background task with task id: ` + CID_LONG + `/task-6..."（文件增量捕获）`,
    S + `watch.mjs <cid>`),
  rec(...R4, `observe-history`, `pass`, `全步回读：type/status/tokens(input,cache_read,output)/content 完整`,
    `{"step_index":1,"source":"MODEL","type":"PLANNER_RESPONSE","status":"DONE","input_tokens":20617,"cache_read_tokens":0,"output_tokens":1,"content":"OK"}`,
    `fs.readFileSync brain/<cid>/.../transcript.jsonl`),
  rec(...R4, `state`, `partial`, `单独用 transcript 判结束会误判：让出等后台时也会写 DONE 且无 tool_calls 的回复；必须联 summaries-db`,
    `step=11 DONE :: "I have started the PowerShell command in the background and am waiting..." 与 step=21 :: "I am still waiting for the ping command to finish."——都是 DONE 无 tool_calls，而会话实际仍在等（db not_fully_idle=1）`,
    `对照 transcript 与 db`, `此坑与 hosts/antigravity.md 第四节第 5 条一致，本轮实测复现`),
  naTr(`cancel`), naTr(`close`),
  rec(...R4, `steer`, `pass`, `插话以 SYSTEM_MESSAGE 步落盘，且回复顺序证明本轮内生效`,
    `step=18 SYSTEM_MESSAGE(插话) → step=23 "STEER_IN_TURN_OK"(t+24.3s) → step=25 "DONE"(t+44.2s，原任务完成)`, `fs 读 transcript`),
  rec(...R4, `permission`, `fail`, `全程未出现任何审批/permissions 步：eager 策略下工具直行，越界操作只有拒绝文本`,
    `step=3 PLANNER_RESPONSE :: "I cannot create a file on the Desktop..."（无审批步）`, `fs 读 transcript`),
  naTr(`fork`), naTr(`compact`),
  rec(...R4, `model-list`, `n/a`, `步字段无模型名（keys: step_index,source,type,status,created_at,input_tokens,cache_read_tokens,output_tokens,content）`, `transcript_full.jsonl 键集`, `fs 读`),
  rec(...R4, `model-new`, `partial`, `transcript 只能证 source=MODEL，模型名不在步字段；模型真值在 GetCascadeTrajectory（RPC 路线）`,
    `"source":"MODEL" 存在、model 字段缺失`, `fs 读 + rpc.mjs GetCascadeTrajectory`),
  naTr(`model-switch`), naTr(`mode-switch`), naTr(`quota`),
  rec(...R4, `wake-bg`, `pass`, `后台任务全生命周期步级可见（task id、Task Description、状态、Log 路径）`,
    `step=6 GENERIC RUNNING :: "task id: ` + CID_LONG + `/task-6 Task Description: powershel"；step=8 GENERIC DONE :: "Task: .../task-6 Status: RUNNING Log: C:\\Users\\..."`,
    `fs 读 transcript`),
  rec(...R4, `wake-timer`, `pass`, `Timer 任务步可见（自发与被动设置皆留痕）`, `step=10 :: "Task Description: Timer: 4"；step=16 :: "Timer: 5"；step=30 :: "Timer: 6"`, `fs 读 transcript`),
  rec(...R4, `wake-msg`, `pass`, `外部注入消息以 SYSTEM_MESSAGE 步落盘并可对时序`,
    `step=2/12/18/22/24/35/36/38/44 均为 SYSTEM_MESSAGE :: "The following is a <SYSTEM_MESSAGE> not actually sent by the user..."`, `fs 读 transcript`),
  rec(...R4, `wait-visible`, `pass`, `让出与所等之物直接可读（后台任务步+状态文本）`,
    `step=14 :: "task id: .../task-14 Task Description: ping -n"；step=17 :: "I am running the ping command and waiting for it to complete."`, `fs 读 transcript`),
  rec(...R4, `wake-stall`, `partial`, `Timer 步序列证明有界自醒（4/5/6 分钟逐次）；无硬超时步；解卡靠外部 RPC`,
    `Timer: 4 → Timer: 5 → Timer: 6 递进 + 期间 "I am still waiting..." 复述`, `fs 读 transcript`),
  naTr(`wake-persist`)
);

// ---------- Route 5: L1a acp-bridge ----------
const R5 = [`L1a`, `antigravity/L1a/agy-acp`, `acp-bridge`];
const l1aEv = `spawn agy_acp_server.exe ENOENT: {"code":"ENOENT","message":"spawn agy_acp_server.exe ENOENT","path":"agy_acp_server.exe"}；acpx 注册表写死 win32 argv=["agy_acp_server.exe"]；安装目录 resources/bin 仅 language_server.exe+webm_encoder.exe；initialize 因此不可达（无 agentCapabilities/modes/models 声明可录）`;
const l1aCmd = `node ` + S + `l1a_sdk_init.mjs（@agentclientprotocol/sdk 1.8.0：spawn → initialize → session/new → 逐项调用）；存在性核查: ls resources/bin + find -iname "*acp*" 全空 + acpx/dist/agent-registry-kHdpsK9F.js antigravity 项`;
for (const cap of [`open`, `resume`, `resume-native`, `observe-live`, `observe-history`, `state`, `cancel`, `close`, `steer`, `permission`, `fork`, `compact`, `model-list`, `model-new`, `model-switch`, `mode-switch`, `quota`, `wake-bg`, `wake-timer`, `wake-msg`, `wait-visible`, `wake-stall`, `wake-persist`]) {
  rows.push(rec(...R5, cap, `fail`, `无公开 ACP 桥：SDK 起桥即失败，协议会话根本建立不起来`, l1aEv, l1aCmd));
}
// ---------- Route 6: L1b acpx ----------
const R6 = [`L1b`, `antigravity/L1b/acpx`, `acpx`];
const l1bEv = `{"jsonrpc":"2.0","id":null,"error":{"code":-32603,"message":"Failed to spawn agent command: agy_acp_server.exe. The agent process could not start because a required executable... was not found...","data":{"acpxCode":"RUNTIME","detailCode":"AGENT_SPAWN_ENOENT","origin":"cli","sessionId":"unknown"}}}`;
const l1bCmd = `acpx --format json antigravity sessions new --name probe-antigravity-l1b → AGENT_SPAWN_ENOENT；acpx --format json antigravity -s probe-antigravity-l1b "..." → NO_SESSION（先报无会话，建会话即报 spawn ENOENT，两层都复现；未产生任何 acpx 会话记录）`;
for (const cap of [`open`, `resume`, `resume-native`, `observe-live`, `observe-history`, `state`, `cancel`, `close`, `steer`, `permission`, `fork`, `compact`, `model-list`, `model-new`, `model-switch`, `mode-switch`, `quota`, `wake-bg`, `wake-timer`, `wake-msg`, `wait-visible`, `wake-stall`, `wake-persist`]) {
  rows.push(rec(...R6, cap, `fail`, `acpx antigravity 起不动：spawn 找不到程序（预期内的 ENOENT）`, l1bEv, l1bCmd));
}

let out = ``;
for (const r of rows) out += JSON.stringify(r) + `\n`;
fs.appendFileSync(new URL(`../../blackboard.jsonl`, import.meta.url), out);
console.log(`appended`, rows.length, `records`);
