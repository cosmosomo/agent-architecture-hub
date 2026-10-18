import { appendFact } from './append_fact.mjs';

const AT = new Date().toISOString();

// 1. channel-route
appendFact({
  at: AT,
  by: 'agy-fact-antigravity',
  family: 'antigravity',
  layer: 'L0',
  route: 'antigravity/L0/agentapi+connect-rpc',
  surface: 'daemon',
  capability: 'channel-route',
  result: 'partial',
  condition: 'Antigravity 2.23.1, --model / planModel',
  evidence: '支持在启动会话和发送消息时按调用单次覆盖 modelTier (flash/pro/flash_lite) 与 planModel；但鉴权完全绑定本机唯一的 Google 账号/OAuth 登录态，不支持单次热换第三方中转站 API Key',
  cmd: 'agentapi new-conversation --model=pro/flash + rpc.mjs StartCascade',
  note: '支持单次按需选模型档位；不支持单次换供应商凭证/中转Key（绑定官方OAuth）'
});

// 2. channel-health
appendFact({
  at: AT,
  by: 'agy-fact-antigravity',
  family: 'antigravity',
  layer: 'L0',
  route: 'antigravity/L0/connect-rpc',
  surface: 'daemon',
  capability: 'channel-health',
  result: 'pass',
  condition: 'Antigravity 2.23.1, GET /healthz + RetrieveUserQuotaSummary',
  evidence: 'GET /healthz 200 返回 {"instanceId":"...","status":"ok"}；RetrieveUserQuotaSummary 实时输出 5h 及周窗口 remainingFraction，额度用尽时及时返回熔断信号',
  cmd: 'curl http://127.0.0.1:<port>/healthz + rpc.mjs RetrieveUserQuotaSummary',
  note: '原生具备服务健康检查探针与配额枯竭前置熔断指示'
});

// 3. channel-lease
appendFact({
  at: AT,
  by: 'agy-fact-antigravity',
  family: 'antigravity',
  layer: 'L0',
  route: 'antigravity/L0/presence-lock+gateway',
  surface: 'daemon',
  capability: 'channel-lease',
  result: 'pass',
  condition: 'Antigravity 2.23.1, presence/*.lock + 5h sliding window smoothing',
  evidence: '活跃会话占用时创建 presence/<cid>.lock 锁；官方配额策略明确通过 5-hour limit smooths out aggregate demand 抑制并发打爆，网关结合锁实现租约排队依次放行',
  cmd: 'ls ~/.gemini/antigravity/presence/ + RetrieveUserQuotaSummary description',
  note: '锁文件配合平台滑动窗口配额，支持租约化排队并发调度'
});

// 4. capacity
appendFact({
  at: AT,
  by: 'agy-fact-antigravity',
  family: 'antigravity',
  layer: 'L0',
  route: 'antigravity/L0/summaries-db',
  surface: 'daemon',
  capability: 'capacity',
  result: 'pass',
  condition: 'Antigravity 2.23.1, conversation_summaries.db',
  evidence: '通过 select count(*) from conversation_summaries where status="CASCADE_RUN_STATUS_RUNNING" or not_fully_idle=1 实时读取当前并发占用槽位数；上限受 5h 配额池与最大 10 层嵌套约束',
  cmd: 'sqlite3 conversation_summaries.db "select count(*) where status=RUNNING or not_fully_idle=1"',
  note: '原生读出当前并发占用，支持容量动态感知'
});

// 5. probe-host
appendFact({
  at: AT,
  by: 'agy-fact-antigravity',
  family: 'antigravity',
  layer: 'L0',
  route: 'antigravity/L0/process+rpc',
  surface: 'daemon',
  capability: 'probe-host',
  result: 'pass',
  condition: 'Antigravity 2.23.1, Win32_Process + GetUserStatus + GetCascadeModelConfigData',
  evidence: '自动探测二进制路径与 CSRF Token、HTTP 端口；GetUserStatus 返回登录账号 cosmostxy2@gmail.com 与 Ultra 订阅；GetCascadeModelConfigData 输出 9 个可用模型与其支持的 MIME 全模态名片',
  cmd: 'agent_gateway.js discoverAntigravityLs() + rpc.mjs GetUserStatus',
  note: '原生打通宿主探针：版本、端口、鉴权凭证、账号状态与模型能力自述全量获取'
});

// 6. host-drain
appendFact({
  at: AT,
  by: 'agy-fact-antigravity',
  family: 'antigravity',
  layer: 'L0',
  route: 'antigravity/L0/gateway+daemon',
  surface: 'daemon',
  capability: 'host-drain',
  result: 'pass',
  condition: 'Antigravity 2.23.1, gateway finalizeRun + language_server Exit signal',
  evidence: '网关守护支持在停止接新活后等待活跃会话 finalizeRun 正常写盘与退出；language_server 二进制内建平稳退出与连接排空流程',
  cmd: 'node agent_gateway.js + rpc.mjs Exit',
  note: '支持守护进程排空退出，避免在跑轮次被粗暴腰斩'
});

// 7. sampling
appendFact({
  at: AT,
  by: 'agy-fact-antigravity',
  family: 'antigravity',
  layer: 'L0',
  route: 'antigravity/L0/mcp-client',
  surface: 'daemon',
  capability: 'sampling',
  result: 'fail',
  condition: 'Antigravity 2.23.1, MCP Client Implementation',
  evidence: 'language_server 仅实现了 MCP 工具调用 (tools/list_changed) 与 roots 资源通知，二进制中无 sampling/createMessage 处理逻辑；MCP 工具无法反向请求宿主代为调用模型',
  cmd: 'strings language_server.exe | grep "sampling/createMessage"',
  note: '做不到：宿主未开放 MCP 反向借道采样端口'
});

// 8. memory-mode
appendFact({
  at: AT,
  by: 'agy-fact-antigravity',
  family: 'antigravity',
  layer: 'L0',
  route: 'antigravity/L0/slash-learn+conversations-db',
  surface: 'daemon',
  capability: 'memory-mode',
  result: 'pass',
  condition: 'Antigravity 2.23.1, /learn command + conversations/<id>.db isolation',
  evidence: '普通会话执行历史严格物理隔离在 conversations/<cid>.db，默认不跨会话沉淀；仅在用户显式触发 /learn 时才抽取写入长期记忆库；原生支持记忆隔离',
  cmd: 'ls ~/.gemini/antigravity/conversations/ + /learn documentation',
  note: '默认记忆隔离，仅通过显式命令向跨会话长期记忆持久化'
});
