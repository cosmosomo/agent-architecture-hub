import { appendFact } from './append_fact.mjs';

const AT = new Date().toISOString();

// 1. peer-message
appendFact({
  at: AT,
  by: 'agy-fact-antigravity',
  family: 'antigravity',
  layer: 'L0',
  route: 'antigravity/L0/send_message+rpc',
  surface: 'daemon',
  capability: 'peer-message',
  result: 'pass',
  condition: 'Antigravity 2.23.1, built-in send_message tool + Connect-RPC SendAgentMessage',
  evidence: '内置 send_message 工具支持指定 Recipient (CID) 发送消息；Connect-RPC SendAgentMessage 原生支持跨会话/子代理消息送达并自动唤醒对方（命中 cache_read_tokens）',
  cmd: 'send_message({ Recipient: "...", Message: "..." }) + SendAgentMessage',
  note: '原生端到端智能体间直接通信，支持跨会话点对点消息唤醒'
});

// 2. handoff
appendFact({
  at: AT,
  by: 'agy-fact-antigravity',
  family: 'antigravity',
  layer: 'L0',
  route: 'antigravity/L0/subagents+fork',
  surface: 'daemon',
  capability: 'handoff',
  result: 'pass',
  condition: 'Antigravity 2.23.1, invoke_subagent + ForkConversation',
  evidence: 'invoke_subagent 支持结构化下发任务与上下文（inherit/branch/share），子会话接续推进并将产物交回；或经 ForkConversation 原生截断交接上下文由新实例接手',
  cmd: 'invoke_subagent + ForkConversation',
  note: '原生支持任务委托与基于会话分叉的责任转移'
});

// 3. task-board
appendFact({
  at: AT,
  by: 'agy-fact-antigravity',
  family: 'antigravity',
  layer: 'L0',
  route: 'antigravity/L0/manage_task+board-file',
  surface: 'daemon',
  capability: 'task-board',
  result: 'pass',
  condition: 'Antigravity 2.23.1, manage_task (list/status) + shared board files',
  evidence: '内置 manage_task 提供全局后台任务状态列表统一维护；团队会话多方基于 .system_generated/tasks 与共享任务板文件协同读写',
  cmd: 'manage_task({ Action: "list" })',
  note: '原生内置任务管理器，结合持久化任务清单实现状态共识'
});

// 4. reclaim
appendFact({
  at: AT,
  by: 'agy-fact-antigravity',
  family: 'antigravity',
  layer: 'L0',
  route: 'antigravity/L0/force-stop+lock-release',
  surface: 'daemon',
  capability: 'reclaim',
  result: 'pass',
  condition: 'Antigravity 2.23.1, ForceStopCascadeTree + presence release',
  evidence: '下发 ForceStopCascadeTree 立即停掉实例树并注销占用，会话由 RUNNING 恢复至 IDLE/0，中心成功收回派工并重新归入调度队列',
  cmd: 'rpc.mjs ForceStopCascadeTree',
  note: '原生支持实例优雅回收与会话放手，任务状态重置可派'
});
