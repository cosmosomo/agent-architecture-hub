import { appendFact } from './append_fact.mjs';

const AT = new Date().toISOString();

// 1. rewind
appendFact({
  at: AT,
  by: 'agy-fact-antigravity',
  family: 'antigravity',
  layer: 'L0',
  route: 'antigravity/L0/slash-rewind+fork',
  surface: 'daemon',
  capability: 'rewind',
  result: 'partial',
  condition: 'Antigravity 2.23.1, /rewind slash command + forkAtStepIndex',
  evidence: 'TUI 支持 /rewind 命令；RPC 可通过 ForkConversation {forkAtStepIndex: N} 截断回退至历史任一步；但底层单会话 SQLite 库不支持原会话原地无损删步并回滚磁盘文件',
  cmd: '/rewind or ForkConversation {forkAtStepIndex: N}',
  note: '最高通过分叉到指定步数实现逻辑回溯；原会话就地连带文件版本回退在无头接口下未开放'
});

// 2. archive
appendFact({
  at: AT,
  by: 'agy-fact-antigravity',
  family: 'antigravity',
  layer: 'L0',
  route: 'antigravity/L0/metadata-hide',
  surface: 'daemon',
  capability: 'archive',
  result: 'pass',
  condition: 'Antigravity 2.23.1, hideFromConversationList flag',
  evidence: '会话元数据原生支持 hideFromConversationList: true，归档后会话在客户端主列表隐藏，底层 conversations/<cid>.db 与 brain 完整保留，需要时通过 send-message <cid> 即可随时取回并恢复',
  cmd: 'get-conversation-metadata 返回 hideFromConversationList',
  note: '原生支持会话归档隐藏与即时唤醒取回'
});

// 3. delete
appendFact({
  at: AT,
  by: 'agy-fact-antigravity',
  family: 'antigravity',
  layer: 'L0',
  route: 'antigravity/L0/sqlite-delete+rpc',
  surface: 'daemon',
  capability: 'delete',
  result: 'pass',
  condition: 'Antigravity 2.23.1, language_server DeleteConversation RPC + sqlite cleanup',
  evidence: '支持从 conversation_summaries.db 删除索引记录并清理 conversations/<cid>.db 与 brain/<cid> 目录，删除后会话记录不复存在',
  cmd: 'DELETE FROM conversation_summaries WHERE conversation_id=?',
  note: '原生支持会话级数据物理删除与索引注销'
});

// 4. loop-guard
appendFact({
  at: AT,
  by: 'agy-fact-antigravity',
  family: 'antigravity',
  layer: 'L0',
  route: 'antigravity/L0/loop-detector',
  surface: 'daemon',
  capability: 'loop-guard',
  result: 'pass',
  condition: 'Antigravity 2.23.1, loopErrorModelMessage + max_steps heuristic',
  evidence: 'language_server 内置循环检测与启发式熔断机制（loopErrorModelMessage），当模型重复失败动作时自动注入警告并于超限时以 max_steps_exceeded 拦截轮次',
  cmd: 'strings language_server.exe | grep loopErrorModelMessage',
  note: '原生内置循环守卫与步骤重复熔断'
});

// 5. guard
appendFact({
  at: AT,
  by: 'agy-fact-antigravity',
  family: 'antigravity',
  layer: 'L0',
  route: 'antigravity/L0/hooks-json',
  surface: 'daemon',
  capability: 'guard',
  result: 'pass',
  condition: 'Antigravity 2.23.1, hooks.json lifecycle hooks',
  evidence: '完整支持 PreToolUse (matcher/deny/allow/overwrite)、PreInvocation (injectSteps)、PostInvocation (terminationBehavior)、Stop (continue/reason) 5 大生命周期守卫，在约定时机自动触发',
  cmd: 'cat .agents/hooks.json',
  note: '官方原生生命周期钩子系统，守卫与拦截功能齐备'
});

// 6. output-contract
appendFact({
  at: AT,
  by: 'agy-fact-antigravity',
  family: 'antigravity',
  layer: 'L0',
  route: 'antigravity/L0/rules+post-invocation-hook',
  surface: 'daemon',
  capability: 'output-contract',
  result: 'pass',
  condition: 'Antigravity 2.23.1, GEMINI.md Prompt Rules + PostInvocation validation',
  evidence: '开会话自动注入 GEMINI.md 全局输出契约规则（如 PURPOSE/TASK/MODE/EXPECTED/RULES 模板）；结合 PostInvocation 钩子对格式进行校验，不合规时 force_continue 要求重写',
  cmd: 'cat GEMINI.md + PostInvocation hook',
  note: '规则前置注入结合钩子后置校验，实现双层产出格式硬约束'
});

// 7. permission-scope
appendFact({
  at: AT,
  by: 'agy-fact-antigravity',
  family: 'antigravity',
  layer: 'L0',
  route: 'antigravity/L0/workspace-boundary',
  surface: 'daemon',
  capability: 'permission-scope',
  result: 'pass',
  condition: 'Antigravity 2.23.1, permissible workspace directory enforcement',
  evidence: '智能体写 brain/<cid>/scratch 自有数据目录全自动放行；越界写入工作区外敏感目录（如 Desktop）被硬性拦截报错: "I cannot create a file on the Desktop because it falls outside the permissible workspace directory"',
  cmd: 'agentapi new-conversation 尝试在 Desktop 写文件被拦截',
  note: '原生具备目录分级安全作用域：内部数据放行，越界敏感写操作自动硬拦截'
});
