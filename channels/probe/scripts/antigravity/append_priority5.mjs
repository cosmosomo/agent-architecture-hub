import { appendFact } from './append_fact.mjs';

const AT = new Date().toISOString();

// 1. label
appendFact({
  at: AT,
  by: 'agy-fact-antigravity',
  family: 'antigravity',
  layer: 'L0',
  route: 'antigravity/L0/agentapi+summaries-db',
  surface: 'daemon',
  capability: 'label',
  result: 'pass',
  condition: 'Antigravity 2.23.1, agentapi --title + conversation_summaries.db (title / conversations_fts)',
  evidence: '通过 agentapi new-conversation --title="probe-hook-inject-1" 建立会话，在 conversation_summaries.db 成功精确检索到 {"conversation_id":"67fa191b-ed51-4b51-9188-81a8eb004372","title":"probe-hook-inject-1"}，且 FTS5 虚表 conversations_fts 支持全文搜索',
  cmd: 'agentapi new-conversation --title=... + sqlite3 conversation_summaries.db "select * where title like ..."',
  note: '原生支持会话命名与标注，title 字段即时入库并建立 FTS5 全文索引'
});

// 2. discover-sessions
appendFact({
  at: AT,
  by: 'agy-fact-antigravity',
  family: 'antigravity',
  layer: 'L0',
  route: 'antigravity/L0/summaries-db',
  surface: 'daemon',
  capability: 'discover-sessions',
  result: 'pass',
  condition: 'Antigravity 2.23.1, conversation_summaries.db',
  evidence: '单库全量枚举 202 个会话（根会话 117 个，子智能体会话 85 个），包含 parent_conversation_id、nesting_depth、status、step_count、last_modified_time，零遗漏',
  cmd: 'sqlite3 conversation_summaries.db "select count(*) from conversation_summaries"',
  note: '原生完备：中心只需单条 SQL 或遍历表即可发现本机所有会话，完整覆盖根会话与多层嵌套子会话'
});

// 3. ownership
appendFact({
  at: AT,
  by: 'agy-fact-antigravity',
  family: 'antigravity',
  layer: 'L0',
  route: 'antigravity/L0/summaries-db+metadata',
  surface: 'daemon',
  capability: 'ownership',
  result: 'pass',
  condition: 'Antigravity 2.23.1, status + not_fully_idle + sourceMetadata',
  evidence: 'GetConversationMetadata 准确包含 sourceMetadata.tool.conversationId 反查父会话与调用方；db status=RUNNING/not_fully_idle=1 对应 owned_by_app；IDLE/0 对应 released；测试驱动持有对应 owned_by_us',
  cmd: 'agentapi get-conversation-metadata <cid> + sqlite3 conversation_summaries.db',
  note: '可靠识别所有权五态：元数据可追溯发起者，索引库可原子判定忙闲与让出状态'
});

// 4. workspace
appendFact({
  at: AT,
  by: 'agy-fact-antigravity',
  family: 'antigravity',
  layer: 'L0',
  route: 'antigravity/L0/agentapi+projects-config',
  surface: 'daemon',
  capability: 'workspace',
  result: 'pass',
  condition: 'Antigravity 2.23.1, ANTIGRAVITY_PROJECT_ID 映射与子智能体 branch Git worktree',
  evidence: 'get-conversation-metadata 返回 workspaceUris 严格绑定工程目录；invoke_subagent 支持 inherit/share/branch(Git worktree 物理隔离沙箱)',
  cmd: 'agentapi get-conversation-metadata <cid>',
  note: '原生支持工程工作区绑定与子代理分支目录隔离'
});

// 5. instructions
appendFact({
  at: AT,
  by: 'agy-fact-antigravity',
  family: 'antigravity',
  layer: 'L0',
  route: 'antigravity/L0/customizations',
  surface: 'daemon',
  capability: 'instructions',
  result: 'pass',
  condition: 'Antigravity 2.23.1, GEMINI.md / AGENTS.md / .agents/rules/*.md / --profile',
  evidence: '会话初始化自动发现并注入 workspace/global rules (<RULE[user_global]>)，对输出协议与角色设定产生确定性硬约束；agentapi 支持 --profile 指定角色模板',
  cmd: 'agentapi new-conversation --profile=... 或放置 GEMINI.md/AGENTS.md',
  note: '多级系统指令注入体系：支持全局、项目级规则文件及启动 profile 原生设定角色'
});

// 6. mount-tools
appendFact({
  at: AT,
  by: 'agy-fact-antigravity',
  family: 'antigravity',
  layer: 'L0',
  route: 'antigravity/L0/mcp+plugins',
  surface: 'daemon',
  capability: 'mount-tools',
  result: 'pass',
  condition: 'Antigravity 2.23.1, ~/.gemini/config/mcp_config.json + Connect-RPC GetAllPlugins/InstallCustomization',
  evidence: 'metadata 中 launchedMcpServers/mcpServers 字段原生记录挂接工具；本机实测装载 docx(v1.0.0) 与 science(v1.2.4, 含 29 个专用技能工具)；支持 define_subagent 动态指定挂接工具组',
  cmd: 'cat ~/.gemini/config/mcp_config.json + rpc.mjs GetAllPlugins',
  note: '原生三层工具挂接：MCP 协议挂接外部服务器、插件市场按需启停、子智能体派生时动态限定 tool groups'
});
