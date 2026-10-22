import { appendFact } from './append_fact.mjs';

const AT = new Date().toISOString();

export const twelveFacts = [
  {
    at: AT,
    by: 'antigravity',
    family: 'antigravity',
    layer: 'L0',
    route: 'antigravity/L0/agentapi+projects',
    surface: 'daemon',
    capability: 'workspace',
    result: 'pass',
    condition: 'Antigravity 2.23.1 指定项目工作区 e:/program/GIT/Agent/multi (project a22912fa)',
    cmd: 'node channels/probe/scripts/antigravity/run_agentapi.mjs new-conversation --title=probe-workspace-check',
    evidence: '会话 648484a8-e6e8-4ed9-88d0-a891215f4243 中模型调用 write_to_file 成功落盘 e:/program/GIT/Agent/multi/channels/probe/tmp/probe_workspace_check.txt，内容确为 WORKSPACE_TEST_OK',
    note: '绑定 ANTIGRAVITY_PROJECT_ID 后智能体文件操作精准落盘在指定工作区目录'
  },
  {
    at: AT,
    by: 'antigravity',
    family: 'antigravity',
    layer: 'L0',
    route: 'antigravity/L0/agentapi+rules',
    surface: 'daemon',
    capability: 'instructions',
    result: 'pass',
    condition: 'Antigravity 2.23.1 角色说明/指令约束 (model: flash_lite & subagent)',
    cmd: 'node channels/probe/scripts/antigravity/run_agentapi.mjs new-conversation --title=probe-instructions-check',
    evidence: '会话 a5d1cc9c-2f80-49e0-aa31-81dd53dac265 设定前缀约束，PLANNER_RESPONSE step=1 精确输出 \"[INSTRUCTION_CHECK_PASSED] 2 + 2 = 4.\"；子代理 probe_instructions_verifier 经 define_subagent 注入 system_prompt 约束，输出确为 \"INSTRUCTIONS_CONSTRAINT_OBEYED\"',
    note: '指令中的格式与角色行为约束被模型严格体现并在回复首句生效'
  },
  {
    at: AT,
    by: 'antigravity',
    family: 'antigravity',
    layer: 'L0',
    route: 'antigravity/L0/mcp+customizations',
    surface: 'daemon',
    capability: 'mount-tools',
    result: 'pass',
    condition: 'Antigravity 2.23.1 MCP 动态挂接与权限门禁',
    cmd: 'call_mcp_tool science_biomolecular_structure_viewer_mcp/get_state vs unmounted_fake_server',
    evidence: '实测调用已挂接 MCP 工具 get_state 成功返回 {\"version\":0,\"state\":{\"id\":null}}；调用未挂接工具 unmounted_fake_server/fake_tool 触发权限门禁拦截报错 \"tool fake_tool is not enabled for server unmounted_fake_server\"',
    note: '会话中挂接的工具正常执行，未挂接的工具被硬拦截无法调用'
  },
  {
    at: AT,
    by: 'antigravity',
    family: 'antigravity',
    layer: 'L0',
    route: 'antigravity/L0/artifact+rpc',
    surface: 'daemon',
    capability: 'act-deliver',
    result: 'pass',
    condition: 'Antigravity 2.23.1 write_to_file ArtifactMetadata + Connect-RPC GetArtifactSnapshots',
    cmd: 'node channels/probe/scripts/antigravity/rpc.mjs GetArtifactSnapshots {\"cascadeId\":\"ca5c32fc-c3f6-4b4f-bc70-793b59d9d223\"}',
    evidence: '智能体调用 write_to_file 交付 probe_deliver_artifact.md 并附带 ArtifactMetadata；中心通过 Connect-RPC GetArtifactSnapshots 成功获取 HTTP 200 结构化产出列表（含 summary、updatedAt、userFacing 与 content）',
    note: '中心可通过 Connect-RPC 原生获取带元数据的结构化产出物快照'
  },
  {
    at: AT,
    by: 'antigravity',
    family: 'antigravity',
    layer: 'L0',
    route: 'antigravity/L0/cortex-schema',
    surface: 'daemon',
    capability: 'output-contract',
    result: 'pass',
    condition: 'Antigravity 2.23.1 工具调用 Schema 校验与产出格式合约',
    cmd: 'write_to_file schema validation & GetArtifactSnapshots verification',
    evidence: '实测参数不满足工具契约时被 Cortex schema 拦截报错 invalid_args；产出物写盘区分 ArtifactMetadata（缺失时 GetArtifactSnapshots 无 artifactMetadata 字段）；提示词要求 strict JSON 时模型严格输出符合结构的 JSON',
    note: '交出的产出符合契约格式，参数不符合时被底层模式校验拦截'
  },
  {
    at: AT,
    by: 'antigravity',
    family: 'antigravity',
    layer: 'L0',
    route: 'antigravity/L0/ask_question+rpc',
    surface: 'daemon',
    capability: 'act-request',
    result: 'partial',
    condition: 'Antigravity 2.23.1 ask_question 挂起与 Connect-RPC HandleCascadeUserInteraction',
    cmd: 'node channels/probe/scripts/antigravity/rpc.mjs HandleCascadeUserInteraction',
    evidence: '会话 b398e97e-e791-4c0e-90e5-8c38958b0ed3 调 ask_question 成功挂起（CORTEX_STEP_TYPE_ASK_QUESTION WAITING）；GetCascadeTrajectory 可读 options 结构；但外部无头 RPC 答复返回 500 \"input not registered for step 2\"（缺少交互流客户端注册）',
    note: '智能体能发起结构化请求并挂起等待，但外部无头直调 RPC 解挂受阻于无流客户端监听'
  },
  {
    at: AT,
    by: 'antigravity',
    family: 'antigravity',
    layer: 'L0',
    route: 'antigravity/L0/transcript-stream',
    surface: 'daemon',
    capability: 'act-report',
    result: 'pass',
    condition: 'Antigravity 2.23.1 多步执行流式落盘与 run_command 上报',
    cmd: 'transcript.jsonl 增量读取与 agent_gateway.js report',
    evidence: '会话 648484a8-e6e8-4ed9-88d0-a891215f4243 中 step 1（PLANNER_RESPONSE）与 step 2（GENERIC）在 06:19:59Z 与 06:20:01Z 实时落盘，中心在轮次进行中可实时读取中间进展而不打断执行；智能体亦可运行命令上报',
    note: '阶段性步骤实时落盘，中心可中途感知执行进度且轮次不中断'
  },
  {
    at: AT,
    by: 'antigravity',
    family: 'antigravity',
    layer: 'L0',
    route: 'antigravity/L0/connect-rpc',
    surface: 'daemon',
    capability: 'inject-next',
    result: 'pass',
    condition: 'Antigravity 2.23.1 SendUserCascadeMessage MESSAGE_DELIVERY_STRATEGY_WHEN_IDLE',
    cmd: 'node channels/probe/scripts/antigravity/rpc.mjs SendUserCascadeMessage {\"cascadeId\":\"...\",\"deliveryStrategy\":\"MESSAGE_DELIVERY_STRATEGY_WHEN_IDLE\"}',
    evidence: '会话 bb75cb2b-9bd2-4d53-bf64-a7c57884bb80 第一轮进行时注入排队消息，首轮返回 ROUND_1_DONE 后，下一轮自动被调度消费并输出 ROUND_2_DONE（transcript step 0/1/2 闭环）',
    note: '消息投递策略 MESSAGE_DELIVERY_STRATEGY_WHEN_IDLE 原生支持首轮结束后自动作为下一轮输入'
  },
  {
    at: AT,
    by: 'antigravity',
    family: 'antigravity',
    layer: 'L0',
    route: 'antigravity/L0/mcp+tool-result',
    surface: 'daemon',
    capability: 'inject-tool',
    result: 'partial',
    condition: 'Antigravity 2.23.1 工具结果捎带与防间接提示注入防御',
    cmd: 'node channels/probe/scripts/antigravity/run_agentapi.mjs new-conversation --title=probe-inject-tool-check',
    evidence: '会话 71366b92-8ab0-40ca-8367-36f22bb46c44 工具返回夹带 [SYSTEM_INJECT:REQ_999]，模型在同轮下一步（step 3）立即读取并分析，但安全守卫判定工具内容为不可信数据，明确拒绝盲从执行注入指令；数据可见但不能随意越权',
    note: '智能体同轮下一步确能感知工具结果，但平台防间接注入机制会阻止任意外部伪装指令的生效'
  },
  {
    at: AT,
    by: 'antigravity',
    family: 'antigravity',
    layer: 'L0',
    route: 'antigravity/L0/cortex-loop-guard',
    surface: 'daemon',
    capability: 'loop-guard',
    result: 'pass',
    condition: 'Antigravity 2.23.1 Cortex 规划器循环熔断机制',
    cmd: 'node channels/probe/scripts/antigravity/run_agentapi.mjs new-conversation --title=probe-loop-guard-test',
    evidence: '会话 f63ee965-e5d1-4fc7-bd2f-af02e44e3600 要求重复执行 exit 1 直至成功；模型在 step 6 成功识别死循环风险，主动熔断拒绝重复执行并在回复与 thinking 中明确说明死循环原因（\"repeating it in a loop... would result in an infinite loop\"）',
    note: '规划器与模型内置循环探测与熔断机制，遭遇反复失败时自动终止并报告原因'
  },
  {
    at: AT,
    by: 'antigravity',
    family: 'antigravity',
    layer: 'L0',
    route: 'antigravity/L0/cortex-goal',
    surface: 'daemon',
    capability: 'goal',
    result: 'pass',
    condition: 'Antigravity 2.23.1 /goal 推进与 goal_stop_hook 收尾',
    cmd: 'node channels/probe/scripts/antigravity/run_agentapi.mjs new-conversation --title=probe-goal-run \"/goal ...\"',
    evidence: '会话 ba5be321-e558-44f8-ac5c-3a21aaf2471b 输入 /goal 命令推进任务，Cortex goal_accumulator 驱动工具写盘 probe_goal_result.txt，达成后 goal_stop_hook 放行收尾，状态置 CASCADE_RUN_STATUS_IDLE (step_count=4)',
    note: '原生 /goal 模式驱动目标持续执行，达成后停止钩子正常关闭轮次'
  },
  {
    at: AT,
    by: 'antigravity',
    family: 'antigravity',
    layer: 'L0',
    route: 'antigravity/L0/hooks-json',
    surface: 'daemon',
    capability: 'guard',
    result: 'pass',
    condition: 'Antigravity 2.23.1 规则守卫与生命周期钩子引擎 (PreToolUse/Stop)',
    cmd: 'GetCascadeTrajectory step metadata preToolHookResults verification',
    evidence: '会话 b398e97e-e791-4c0e-90e5-8c38958b0ed3 中每次工具执行前均自动经过 PreToolUse 守卫裁决（metadata 记录 preToolHookResults: [{\"decision\":\"allow\"}]）；二进制完整包含 hooks.json 5 大生命周期事件定义',
    note: '工具执行与轮次生命周期受到 PreToolUse/StopHook 自动拦截与裁决守卫'
  }
];

for (const fact of twelveFacts) {
  appendFact(fact);
}
console.log('Appended all 12 facts to blackboard.jsonl successfully.');
