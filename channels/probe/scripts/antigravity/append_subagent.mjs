import { appendFact } from './append_fact.mjs';

appendFact({
  at: new Date().toISOString(),
  by: 'agy-fact-antigravity',
  family: 'antigravity',
  layer: 'L0',
  route: 'antigravity/L0/connect-rpc',
  surface: 'daemon',
  capability: 'spawn-subagent',
  result: 'pass',
  condition: 'Antigravity 2.23.1, SQLite + Connect-RPC ForceStopCascadeTree/CancelCascadeInvocation',
  evidence: '①发现: conversation_summaries.db 查询到 parent_conversation_id 级联映射与 nesting_depth=1 记录；②读取: brain/<cid>/transcript.jsonl 完整读出 38 步轨迹；③打断: ForceStopCascadeTree 传入 conversationId 返回 stoppedConversationIds: ["c31abca1-d0e7-43e7-934c-485c24823cba"]',
  cmd: 'sqlite3 conversation_summaries.db + cat brain/<cid>/transcript.jsonl + rpc.mjs ForceStopCascadeTree',
  note: '打通子智能体三要素全闭环：外部可索引发现(parent_id/nesting_depth可溯源)、外部可无侵入读轨迹(真值JSONL)、外部可原语级整树打断(ForceStopCascadeTree返回终止子树列表)'
});
