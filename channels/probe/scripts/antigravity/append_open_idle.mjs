import { appendFact } from './append_fact.mjs';

appendFact({
  at: new Date().toISOString(),
  by: 'agy-fact-antigravity',
  family: 'antigravity',
  layer: 'L0',
  route: 'antigravity/L0/connect-rpc',
  surface: 'daemon',
  capability: 'open-idle',
  result: 'pass',
  condition: 'Antigravity 2.23.1, Connect-RPC StartCascade',
  evidence: '调用 StartCascade {source: "CORTEX_TRAJECTORY_SOURCE_AGENT_API"} 返回 cascadeId e695ed7a-8387-42f9-81cf-c0f569842af2；conversation_summaries.db 查到 status=CASCADE_RUN_STATUS_IDLE, not_fully_idle=0, step_count=0，未产生任何回复',
  cmd: 'node channels/probe/scripts/antigravity/rpc.mjs StartCascade',
  note: '打通只建不跑：成功拿到会话编号，会话在索引库真实注册，零token消耗且无回复。彻底推翻前人“壳会话跑不动”推断（实因首轮需在 SendUserCascadeMessage 携带 planModel）'
});

appendFact({
  at: new Date().toISOString(),
  by: 'agy-fact-antigravity',
  family: 'antigravity',
  layer: 'L0',
  route: 'antigravity/L0/connect-rpc',
  surface: 'daemon',
  capability: 'open',
  result: 'pass',
  condition: 'Antigravity 2.23.1, Connect-RPC StartCascade + SendUserCascadeMessage (planModel: MODEL_PLACEHOLDER_M198 flash_lite)',
  evidence: 'SendUserCascadeMessage 传入 prompt "Please reply with exactly: PROBE_START_CASCADE_SUCCESS_999"，GetCascadeTrajectory 查验输出 PLANNER_RESPONSE DONE: "PROBE_START_CASCADE_SUCCESS_999"',
  cmd: 'node channels/probe/scripts/antigravity/rpc.mjs SendUserCascadeMessage',
  note: '打通 Connect-RPC 两阶段原生建会话与首轮驱动，无需 agentapi 进程包装，原生端到端闭环'
});
