import { appendFact } from './append_fact.mjs';

appendFact({
  at: new Date().toISOString(),
  by: 'agy-fact-antigravity',
  family: 'antigravity',
  layer: 'L0',
  route: 'antigravity/L0/connect-rpc',
  surface: 'daemon',
  capability: 'fork',
  result: 'pass',
  condition: 'Antigravity 2.23.1, Connect-RPC ForkConversation',
  evidence: 'ForkConversation {sourceCascadeId: "67fa191b-ed51-4b51-9188-81a8eb004372", forkAtStepIndex: 1} 成功生成 newCascadeId fb159766-5624-427b-9b8d-ec62c6ec81e1；向其发送 send-message 成功准确复述原会话 step 0 提示词',
  cmd: 'node channels/probe/scripts/antigravity/rpc.mjs ForkConversation + agentapi send-message',
  note: '打通任意步原生会话分叉：Connect-RPC 支持 forkAtStepIndex 截断克隆；实测外部脱离 RPC 尝试文件级复制 conversations/<id>.db 并手改 conversation_summaries.db 会因 SQLite 锁(database is locked)被拒，证实必须由宿主 RPC 执行分叉以保证索引一致性'
});
