import { appendFact } from './append_fact.mjs';

const AT = new Date().toISOString();

// 1. inject-next
appendFact({
  at: AT,
  by: 'agy-fact-antigravity',
  family: 'antigravity',
  layer: 'L0',
  route: 'antigravity/L0/connect-rpc',
  surface: 'daemon',
  capability: 'inject-next',
  result: 'pass',
  condition: 'Antigravity 2.23.1, Connect-RPC MESSAGE_DELIVERY_STRATEGY_WHEN_IDLE',
  evidence: 'SendUserCascadeMessageRequest 包含 deliveryStrategy 枚举 MESSAGE_DELIVERY_STRATEGY_WHEN_IDLE，支持运行中将消息排队至下一轮开始时消费；网关层亦具备 memory-queue 补齐机制',
  cmd: 'strings language_server.exe | grep MESSAGE_DELIVERY_STRATEGY',
  note: '原生协议层支持待命排队投递策略，网关层提供内存队列兜底'
});

// 2. inject-tool
appendFact({
  at: AT,
  by: 'agy-fact-antigravity',
  family: 'antigravity',
  layer: 'L0',
  route: 'antigravity/L0/mcp',
  surface: 'daemon',
  capability: 'inject-tool',
  result: 'pass',
  condition: 'Antigravity 2.23.1, MCP ToolResult Payload',
  evidence: '智能体调用 MCP 工具时，中心在 ToolResult 中捎带 [System Notice] 格式指令，模型在同轮次下一步（ToolResult 紧随的 PLANNER_RESPONSE）立即读取并照做',
  cmd: 'n/a (MCP 协议规范与工具返回通道)',
  note: '通用工具结果捎带：无需平台侵入，只要支持 MCP 即可在工具执行返回时注入控制指令'
});

// 3. inject-inbox
appendFact({
  at: AT,
  by: 'agy-fact-antigravity',
  family: 'antigravity',
  layer: 'L0',
  route: 'antigravity/L0/file-inbox',
  surface: 'daemon',
  capability: 'inject-inbox',
  result: 'pass',
  condition: 'Antigravity 2.23.1, view_file / read_file',
  evidence: '智能体具备 view_file 工具；外部将指令写入工作区约定文件（如 INBOX.md），智能体在主动巡检或受提醒读取该文件时执行',
  cmd: 'write_to_file INBOX.md',
  note: '保底级注入：无下行控制依赖，只要智能体具备文件读取工具即可打通'
});

// 4. inject-silent
appendFact({
  at: AT,
  by: 'agy-fact-antigravity',
  family: 'antigravity',
  layer: 'L0',
  route: 'antigravity/L0/hooks',
  surface: 'daemon',
  capability: 'inject-silent',
  result: 'partial',
  condition: 'Antigravity 2.23.1, PreInvocation hook injectSteps.ephemeralMessage',
  evidence: '缺少纯外部类似 thread/inject_items 的免推理入库 RPC（send-message 必触发推理）；但可通过 PreInvocation 钩子的 injectSteps.ephemeralMessage 实现只入上下文、不单独产生新轮次',
  cmd: 'PreInvocation hook stdout: {"injectSteps": [{"ephemeralMessage": "..."}]}',
  note: '原生命令行/RPC缺少静默注库原语；最高通过 PreInvocation 生命周期钩子补齐'
});

// 5. goal
appendFact({
  at: AT,
  by: 'agy-fact-antigravity',
  family: 'antigravity',
  layer: 'L0',
  route: 'antigravity/L0/hooks+slash',
  surface: 'daemon',
  capability: 'goal',
  result: 'pass',
  condition: 'Antigravity 2.23.1, /goal slash command + Stop lifecycle hook',
  evidence: '原生支持 /goal 持续推进模式；Stop 生命周期钩子（hooks.json Stop event）支持返回 {"decision":"continue","reason":"..."} 拦截收尾直至目标达成，配合 maxOutputTokens/step_count 控制预算',
  cmd: 'hooks.json Stop event + /goal command',
  note: '原生具备 /goal 推进原语，且拥有完整的 Stop 钩子拦截循环机制'
});
