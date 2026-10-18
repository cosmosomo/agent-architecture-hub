const fs = require('fs');
const path = require('path');

const at = new Date().toISOString();
const by = 'agy-e35a20ee-built-retest';

const rows = [
  // 1 & 2: open fail rows for gemini & droid
  {
    at,
    by,
    family: 'gemini',
    layer: 'L2',
    route: 'gemini/L2/agent_gateway',
    surface: 'cli',
    capability: 'open',
    result: 'fail',
    condition: '缺少 GEMINI_API_KEY / GOOGLE_API_KEY，且 OAuth 交互在非交互式 headless 模式下阻塞取消',
    evidence: '实测调用：未配 key 时执行 acpx/gemini 报 Startup timed out before initialize completed / FatalCancellationError: Authentication cancelled by user exit=55',
    cmd: "node hub/tools/agent_gateway.js run --agent gemini --session probe-gemini-test --prompt 'ping' --standalone"
  },
  {
    at,
    by,
    family: 'droid',
    layer: 'L2',
    route: 'droid/L2/agent_gateway',
    surface: 'cli',
    capability: 'open',
    result: 'fail',
    condition: '缺少 FACTORY_API_KEY 且 droid 未非交互认证',
    evidence: '实测调用：acpx --format json droid sessions ensure 超时，spawnSync cmd.exe ETIMEDOUT，非交互 headless 无法建会话',
    cmd: 'acpx --format json droid sessions ensure --name probe-droid-test'
  },

  // 3: steer for antigravity
  {
    at,
    by,
    family: 'antigravity',
    layer: 'L2',
    route: 'antigravity/L2/server-api',
    surface: 'agentapi',
    capability: 'steer',
    result: 'pass',
    condition: 'gateway.steerAntigravity (agentapi send-message)',
    evidence: '实测通过：运行 run_1792326688302_gs9k 轮内成功插入 3 条派活指令（中途插话: dsp_123151_e718, dsp_123219_mce9, dsp_123250_tw3w），并在同轮内合并回应并 completed',
    cmd: "POST /api/gateway/send (mode: 'send' on running run)"
  },

  // 4-9: observe-history (claude, hermes, workbuddy, codex, gemini, droid)
  {
    at,
    by,
    family: 'claude',
    layer: 'L2',
    route: 'claude/L2/server-api',
    surface: 'server-http',
    capability: 'observe-history',
    result: 'pass',
    condition: 'GET /api/sessions/claude-code:3f9b57d6-23be-479a-9537-70e0ed2d86cc?tail=3',
    evidence: '实测通过：返回 HTTP 200，完整 contract Session 结构，turns 准确解析，agent=Claude Code',
    cmd: 'GET http://127.0.0.1:8899/api/sessions/claude-code:3f9b57d6-23be-479a-9537-70e0ed2d86cc?tail=3'
  },
  {
    at,
    by,
    family: 'hermes',
    layer: 'L2',
    route: 'hermes/L2/server-api',
    surface: 'server-http',
    capability: 'observe-history',
    result: 'pass',
    condition: 'GET /api/sessions/hermes:5bf539d6-ea84-4d61-aed7-fda8e4295307?tail=3',
    evidence: '实测通过：返回 HTTP 200，完整 contract Session 结构，turns 准确解析，agent=Hermes Agent',
    cmd: 'GET http://127.0.0.1:8899/api/sessions/hermes:5bf539d6-ea84-4d61-aed7-fda8e4295307?tail=3'
  },
  {
    at,
    by,
    family: 'workbuddy',
    layer: 'L2',
    route: 'workbuddy/L2/server-api',
    surface: 'server-http',
    capability: 'observe-history',
    result: 'pass',
    condition: 'GET /api/sessions/workbuddy:01a14efe-f65f-7620-964f-4825f7ccade5?tail=3',
    evidence: '实测通过：返回 HTTP 200，完整 contract Session 结构，turns 准确解析，agent=WorkBuddy',
    cmd: 'GET http://127.0.0.1:8899/api/sessions/workbuddy:01a14efe-f65f-7620-964f-4825f7ccade5?tail=3'
  },
  {
    at,
    by,
    family: 'codex',
    layer: 'L2',
    route: 'codex/L2/server-api',
    surface: 'server-http',
    capability: 'observe-history',
    result: 'pass',
    condition: 'GET /api/sessions/codex:01a14f11-5b9a-7d72-a8c7-2cd0f7a5357c?tail=3',
    evidence: '实测通过：返回 HTTP 200，完整 contract Session 结构，turns 准确解析，agent=Codex',
    cmd: 'GET http://127.0.0.1:8899/api/sessions/codex:01a14f11-5b9a-7d72-a8c7-2cd0f7a5357c?tail=3'
  },
  {
    at,
    by,
    family: 'gemini',
    layer: 'L2',
    route: 'gemini/L2/server-api',
    surface: 'server-http',
    capability: 'observe-history',
    result: 'pass',
    condition: 'GET /api/sessions/gemini:59db7b29-7cab-4f91-83cb-a8776168e1ba?tail=3',
    evidence: '实测通过：返回 HTTP 200，完整 contract Session 结构，turns 准确解析，agent=Gemini CLI',
    cmd: 'GET http://127.0.0.1:8899/api/sessions/gemini:59db7b29-7cab-4f91-83cb-a8776168e1ba?tail=3'
  },
  {
    at,
    by,
    family: 'droid',
    layer: 'L2',
    route: 'droid/L2/server-api',
    surface: 'server-http',
    capability: 'observe-history',
    result: 'pass',
    condition: 'GET /api/sessions/factory:86963d32-b266-4667-88dc-4dc02acd53a6?tail=3',
    evidence: '实测通过：返回 HTTP 200，完整 contract Session 结构，turns 准确解析，agent=Factory',
    cmd: 'GET http://127.0.0.1:8899/api/sessions/factory:86963d32-b266-4667-88dc-4dc02acd53a6?tail=3'
  },

  // 10-12: discover-sessions (codex, gemini, droid)
  {
    at,
    by,
    family: 'codex',
    layer: 'L2',
    route: 'codex/L2/server-api',
    surface: 'server-http',
    capability: 'discover-sessions',
    result: 'pass',
    condition: 'GET /api/sessions?slim=1 (sessionStores 扫描)',
    evidence: '实测通过：返回 channelCounts.codex=139，成功扫描并归集 ~/.codex/sessions 历史会话，统一为 codex:<uuid> 结构',
    cmd: 'GET http://127.0.0.1:8899/api/sessions?slim=1'
  },
  {
    at,
    by,
    family: 'gemini',
    layer: 'L2',
    route: 'gemini/L2/server-api',
    surface: 'server-http',
    capability: 'discover-sessions',
    result: 'pass',
    condition: 'GET /api/sessions?slim=1 (sessionStores 扫描)',
    evidence: '实测通过：返回 channelCounts.gemini=16，成功扫描并归集 ~/.gemini/tmp 历史会话，统一为 gemini:<uuid> 结构',
    cmd: 'GET http://127.0.0.1:8899/api/sessions?slim=1'
  },
  {
    at,
    by,
    family: 'droid',
    layer: 'L2',
    route: 'droid/L2/server-api',
    surface: 'server-http',
    capability: 'discover-sessions',
    result: 'pass',
    condition: 'GET /api/sessions?slim=1 (sessionStores 扫描)',
    evidence: '实测通过：返回 channelCounts.factory=20，成功扫描并归集 ~/.factory/sessions 历史会话，统一为 factory:<uuid> 结构',
    cmd: 'GET http://127.0.0.1:8899/api/sessions?slim=1'
  },

  // 13-19: model-new (claude, zcode, opencode, hermes, workbuddy, codex, antigravity)
  {
    at,
    by,
    family: 'claude',
    layer: 'L2',
    route: 'claude/L2/server-api',
    surface: 'stream-json',
    capability: 'model-new',
    result: 'pass',
    condition: 'POST /api/gateway/send (model: haiku)',
    evidence: '实测通过：运行 run_1792327933372_vwj1 指定 model=haiku，会话 probe-claude-approve-368223 成功完成并写入 runs.jsonl',
    cmd: 'POST http://127.0.0.1:8899/api/gateway/send'
  },
  {
    at,
    by,
    family: 'zcode',
    layer: 'L2',
    route: 'zcode/L2/server-api',
    surface: 'acpx',
    capability: 'model-new',
    result: 'pass',
    condition: 'POST /api/gateway/send (model: GLM-5.3-Flash)',
    evidence: '实测通过：运行 run_1792327253566_ov2e 指定 model=builtin:bigmodel-coding-plan\\GLM-5.3-Flash，会话 meta-brain-supervisor 成功完成并写入 runs.jsonl',
    cmd: 'POST http://127.0.0.1:8899/api/gateway/send'
  },
  {
    at,
    by,
    family: 'opencode',
    layer: 'L2',
    route: 'opencode/L2/server-api',
    surface: 'acpx',
    capability: 'model-new',
    result: 'pass',
    condition: 'POST /api/gateway/send (model: opencode/big-pickle)',
    evidence: '实测通过：运行 run_1792326827440_6c9f 指定 model=opencode/big-pickle，会话 probe-collab-opencode-1018 成功完成并写入 runs.jsonl',
    cmd: 'POST http://127.0.0.1:8899/api/gateway/send'
  },
  {
    at,
    by,
    family: 'hermes',
    layer: 'L2',
    route: 'hermes/L2/server-api',
    surface: 'acpx',
    capability: 'model-new',
    result: 'pass',
    condition: 'POST /api/gateway/send (model: glm-5.2)',
    evidence: '实测通过：运行 run_1792326801347_qopm 指定 model=custom:zai-glm-5.2:glm-5.2，会话 probe-collab-hermes-1018 成功完成并写入 runs.jsonl',
    cmd: 'POST http://127.0.0.1:8899/api/gateway/send'
  },
  {
    at,
    by,
    family: 'workbuddy',
    layer: 'L2',
    route: 'workbuddy/L2/server-api',
    surface: 'acpx',
    capability: 'model-new',
    result: 'pass',
    condition: 'POST /api/gateway/send (model: glm-5.3)',
    evidence: '实测通过：运行 run_1792326685474_udq5 指定 model=custom-local:glm-5.3，会话 probe-collab-workbuddy-1018 成功完成并写入 runs.jsonl',
    cmd: 'POST http://127.0.0.1:8899/api/gateway/send'
  },
  {
    at,
    by,
    family: 'codex',
    layer: 'L2',
    route: 'codex/L2/server-api',
    surface: 'app-server',
    capability: 'model-new',
    result: 'pass',
    condition: 'POST /api/gateway/send (model: gpt-6.1-sol)',
    evidence: '实测通过：运行 run_1792327925174_ki9h 指定 model=gpt-6.1-sol，会话 probe-codex-approve-899236 成功完成并写入 runs.jsonl',
    cmd: 'POST http://127.0.0.1:8899/api/gateway/send'
  },
  {
    at,
    by,
    family: 'antigravity',
    layer: 'L2',
    route: 'antigravity/L2/server-api',
    surface: 'agentapi',
    capability: 'model-new',
    result: 'pass',
    condition: 'POST /api/gateway/send (model: pro)',
    evidence: '实测通过：运行 run_1792328534919_0t9z 指定 model=pro，会话 m-codex-app-driver 成功完成并写入 runs.jsonl',
    cmd: 'POST http://127.0.0.1:8899/api/gateway/send'
  },

  // 20-21: permission (codex, claude)
  {
    at,
    by,
    family: 'codex',
    layer: 'L2',
    route: 'codex/L2/server-api',
    surface: 'app-server',
    capability: 'permission',
    result: 'pass',
    condition: 'POST /api/gateway/approve (轮内拦截与批准)',
    evidence: '实测通过：运行 run_1792327899249_kuzv 设置 permissions=reads，触发 Bash 执行被 app-server 挂起产生待审批项，经 POST /api/gateway/approve 放行后同轮内完成执行并 completed',
    cmd: 'POST http://127.0.0.1:8899/api/gateway/approve'
  },
  {
    at,
    by,
    family: 'claude',
    layer: 'L2',
    route: 'claude/L2/server-api',
    surface: 'stream-json',
    capability: 'permission',
    result: 'pass',
    condition: 'POST /api/gateway/approve (轮内拦截与批准)',
    evidence: '实测通过：运行 run_1792327368520_mbga (haiku) 设置 permissions=reads，触发 Write 工具被 stream-json 挂起产生待审批项，经 POST /api/gateway/approve 放行后同轮内写入完成并 completed',
    cmd: 'POST http://127.0.0.1:8899/api/gateway/approve'
  },

  // 22-27: workspace (claude, opencode, hermes, workbuddy, codex, antigravity)
  {
    at,
    by,
    family: 'claude',
    layer: 'L2',
    route: 'claude/L2/server-api',
    surface: 'server-http',
    capability: 'workspace',
    result: 'pass',
    condition: 'POST /api/gateway/session/new (resolveSessionCwd)',
    evidence: '实测通过：默认自动在 ~/hub-workspaces/ 下新建独立目录，指定真实仓库路径时原样使用并保留',
    cmd: 'POST http://127.0.0.1:8899/api/gateway/session/new'
  },
  {
    at,
    by,
    family: 'opencode',
    layer: 'L2',
    route: 'opencode/L2/server-api',
    surface: 'server-http',
    capability: 'workspace',
    result: 'pass',
    condition: 'POST /api/gateway/session/new (resolveSessionCwd)',
    evidence: '实测通过：默认自动在 ~/hub-workspaces/ 下新建独立目录，指定真实仓库路径时原样使用并保留',
    cmd: 'POST http://127.0.0.1:8899/api/gateway/session/new'
  },
  {
    at,
    by,
    family: 'hermes',
    layer: 'L2',
    route: 'hermes/L2/server-api',
    surface: 'server-http',
    capability: 'workspace',
    result: 'pass',
    condition: 'POST /api/gateway/session/new (resolveSessionCwd)',
    evidence: '实测通过：默认自动在 ~/hub-workspaces/ 下新建独立目录，指定真实仓库路径时原样使用并保留',
    cmd: 'POST http://127.0.0.1:8899/api/gateway/session/new'
  },
  {
    at,
    by,
    family: 'workbuddy',
    layer: 'L2',
    route: 'workbuddy/L2/server-api',
    surface: 'server-http',
    capability: 'workspace',
    result: 'pass',
    condition: 'POST /api/gateway/session/new (resolveSessionCwd)',
    evidence: '实测通过：默认自动在 ~/hub-workspaces/ 下新建独立目录，指定真实仓库路径时原样使用并保留',
    cmd: 'POST http://127.0.0.1:8899/api/gateway/session/new'
  },
  {
    at,
    by,
    family: 'codex',
    layer: 'L2',
    route: 'codex/L2/server-api',
    surface: 'server-http',
    capability: 'workspace',
    result: 'pass',
    condition: 'POST /api/gateway/session/new (resolveSessionCwd)',
    evidence: '实测通过：默认自动在 ~/hub-workspaces/ 下新建独立目录，指定真实仓库路径时原样使用并保留',
    cmd: 'POST http://127.0.0.1:8899/api/gateway/session/new'
  },
  {
    at,
    by,
    family: 'antigravity',
    layer: 'L2',
    route: 'antigravity/L2/server-api',
    surface: 'server-http',
    capability: 'workspace',
    result: 'pass',
    condition: 'POST /api/gateway/session/new (resolveSessionCwd)',
    evidence: '实测通过：默认自动在 ~/hub-workspaces/ 下新建独立目录，指定真实仓库路径时原样使用并保留',
    cmd: 'POST http://127.0.0.1:8899/api/gateway/session/new'
  },

  // 28-29: peer-message (zcode, opencode)
  {
    at,
    by,
    family: 'zcode',
    layer: 'L2',
    route: 'zcode/L2/gateway-collab',
    surface: 'cli',
    capability: 'peer-message',
    result: 'pass',
    condition: 'agent_gateway.js dispatch (spawn-subagent/peer-message)',
    evidence: '实测通过：派活单 dsp_123115_uz0b 由 zcode 向 opencode 发起，被 opencode 完成后成功交回 receipt=returned 并 completed',
    cmd: 'POST http://127.0.0.1:8899/api/gateway/dispatch'
  },
  {
    at,
    by,
    family: 'opencode',
    layer: 'L2',
    route: 'opencode/L2/gateway-collab',
    surface: 'cli',
    capability: 'peer-message',
    result: 'pass',
    condition: 'agent_gateway.js dispatch (spawn-subagent/peer-message)',
    evidence: '实测通过：派活单 dsp_123138_t22d 由 opencode 向 zcode 发起，被 zcode 完成后成功交回 receipt=returned 并 completed',
    cmd: 'POST http://127.0.0.1:8899/api/gateway/dispatch'
  },

  // 30-37: project-view (claude, zcode, hermes, workbuddy, codex, antigravity, gemini, droid)
  {
    at,
    by,
    family: 'claude',
    layer: 'L2',
    route: 'claude/L2/server-api',
    surface: 'server-http',
    capability: 'project-view',
    result: 'pass',
    condition: 'GET /api/sessions?slim=1 (server.nativeProject)',
    evidence: '实测通过：会话 claude-code:3f9b57d6-23be-479a-9537-70e0ed2d86cc 成功归一提取项目路径 E:\\program\\GIT\\Agent\\multi',
    cmd: 'GET http://127.0.0.1:8899/api/sessions?slim=1'
  },
  {
    at,
    by,
    family: 'zcode',
    layer: 'L2',
    route: 'zcode/L2/server-api',
    surface: 'server-http',
    capability: 'project-view',
    result: 'pass',
    condition: 'GET /api/sessions?slim=1 (server.nativeProject)',
    evidence: '实测通过：会话 zcode:sess_3c744145-b9cf-460f-803c-672ecdba625c 成功归一提取项目路径 E:\\program\\GIT\\Agent\\multi\\Agent-Architecture-Hub',
    cmd: 'GET http://127.0.0.1:8899/api/sessions?slim=1'
  },
  {
    at,
    by,
    family: 'hermes',
    layer: 'L2',
    route: 'hermes/L2/server-api',
    surface: 'server-http',
    capability: 'project-view',
    result: 'pass',
    condition: 'GET /api/sessions?slim=1 (server.nativeProject)',
    evidence: '实测通过：会话 hermes:5bf539d6-ea84-4d61-aed7-fda8e4295307 成功归一提取项目路径 E:\\program\\GIT\\Agent\\multi\\Agent-Architecture-Hub',
    cmd: 'GET http://127.0.0.1:8899/api/sessions?slim=1'
  },
  {
    at,
    by,
    family: 'workbuddy',
    layer: 'L2',
    route: 'workbuddy/L2/server-api',
    surface: 'server-http',
    capability: 'project-view',
    result: 'pass',
    condition: 'GET /api/sessions?slim=1 (server.nativeProject)',
    evidence: '实测通过：会话 workbuddy:01a14efe-f65f-7620-964f-4825f7ccade5 成功归一提取项目路径 E:\\program\\GIT\\Agent\\multi\\Agent-Architecture-Hub',
    cmd: 'GET http://127.0.0.1:8899/api/sessions?slim=1'
  },
  {
    at,
    by,
    family: 'codex',
    layer: 'L2',
    route: 'codex/L2/server-api',
    surface: 'server-http',
    capability: 'project-view',
    result: 'pass',
    condition: 'GET /api/sessions?slim=1 (server.nativeProject)',
    evidence: '实测通过：会话 codex:01a14f11-5b9a-7d72-a8c7-2cd0f7a5357c 成功归一提取项目路径 E:\\program\\GIT\\Agent\\multi\\Agent-Architecture-Hub',
    cmd: 'GET http://127.0.0.1:8899/api/sessions?slim=1'
  },
  {
    at,
    by,
    family: 'antigravity',
    layer: 'L2',
    route: 'antigravity/L2/server-api',
    surface: 'server-http',
    capability: 'project-view',
    result: 'pass',
    condition: 'GET /api/sessions?slim=1 (server.nativeProject)',
    evidence: '实测通过：会话 antigravity:23c8480d-7376-47ec-9e38-61546658494d 成功从 workspace_uris 归一提取项目路径 E:\\program\\datascience\\MLSandbox\\mlagent',
    cmd: 'GET http://127.0.0.1:8899/api/sessions?slim=1'
  },
  {
    at,
    by,
    family: 'gemini',
    layer: 'L2',
    route: 'gemini/L2/server-api',
    surface: 'server-http',
    capability: 'project-view',
    result: 'pass',
    condition: 'GET /api/sessions?slim=1 (server.nativeProject)',
    evidence: '实测通过：会话 gemini:365cad6d-086e-40bd-ac88-40a2c8f5c070 成功归一提取项目路径 C:\\users\\colorfire',
    cmd: 'GET http://127.0.0.1:8899/api/sessions?slim=1'
  },
  {
    at,
    by,
    family: 'droid',
    layer: 'L2',
    route: 'droid/L2/server-api',
    surface: 'server-http',
    capability: 'project-view',
    result: 'pass',
    condition: 'GET /api/sessions?slim=1 (server.nativeProject)',
    evidence: '实测通过：会话 factory:86963d32-b266-4667-88dc-4dc02acd53a6 经 nativeProject 归一化解析',
    cmd: 'GET http://127.0.0.1:8899/api/sessions?slim=1'
  },

  // 38-46: artifact (claude, zcode, opencode, hermes, workbuddy, codex, antigravity, gemini, droid)
  {
    at,
    by,
    family: 'claude',
    layer: 'L2',
    route: 'claude/L2/server-api',
    surface: 'server-http',
    capability: 'artifact',
    result: 'pass',
    condition: 'GET /api/sessions/claude-code:3f9b57d6-23be-479a-9537-70e0ed2d86cc/files',
    evidence: '实测通过：返回 HTTP 200，提取会话内产生文件列表（186 个文件）',
    cmd: 'GET http://127.0.0.1:8899/api/sessions/claude-code:3f9b57d6-23be-479a-9537-70e0ed2d86cc/files'
  },
  {
    at,
    by,
    family: 'zcode',
    layer: 'L2',
    route: 'zcode/L2/server-api',
    surface: 'server-http',
    capability: 'artifact',
    result: 'pass',
    condition: 'GET /api/sessions/zcode:sess_3c744145-b9cf-460f-803c-672ecdba625c/files',
    evidence: '实测通过：返回 HTTP 200，提取会话内产生文件列表（4 个文件，含 gateway.ts）',
    cmd: 'GET http://127.0.0.1:8899/api/sessions/zcode:sess_3c744145-b9cf-460f-803c-672ecdba625c/files'
  },
  {
    at,
    by,
    family: 'opencode',
    layer: 'L2',
    route: 'opencode/L2/server-api',
    surface: 'server-http',
    capability: 'artifact',
    result: 'pass',
    condition: 'GET /api/sessions/opencode:ses_eb18219f0ffeNPmMRc3VQhlqXc/files',
    evidence: '实测通过：返回 HTTP 200，ok=true，files 结构完整',
    cmd: 'GET http://127.0.0.1:8899/api/sessions/opencode:ses_eb18219f0ffeNPmMRc3VQhlqXc/files'
  },
  {
    at,
    by,
    family: 'hermes',
    layer: 'L2',
    route: 'hermes/L2/server-api',
    surface: 'server-http',
    capability: 'artifact',
    result: 'pass',
    condition: 'GET /api/sessions/hermes:5bf539d6-ea84-4d61-aed7-fda8e4295307/files',
    evidence: '实测通过：返回 HTTP 200，ok=true，files 结构完整',
    cmd: 'GET http://127.0.0.1:8899/api/sessions/hermes:5bf539d6-ea84-4d61-aed7-fda8e4295307/files'
  },
  {
    at,
    by,
    family: 'workbuddy',
    layer: 'L2',
    route: 'workbuddy/L2/server-api',
    surface: 'server-http',
    capability: 'artifact',
    result: 'pass',
    condition: 'GET /api/sessions/workbuddy:01a14efe-f65f-7620-964f-4825f7ccade5/files',
    evidence: '实测通过：返回 HTTP 200，提取会话内产生文件列表（2 个文件，含 feedback_gateway_cli.md）',
    cmd: 'GET http://127.0.0.1:8899/api/sessions/workbuddy:01a14efe-f65f-7620-964f-4825f7ccade5/files'
  },
  {
    at,
    by,
    family: 'codex',
    layer: 'L2',
    route: 'codex/L2/server-api',
    surface: 'server-http',
    capability: 'artifact',
    result: 'pass',
    condition: 'GET /api/sessions/codex:01a14f11-5b9a-7d72-a8c7-2cd0f7a5357c/files',
    evidence: '实测通过：返回 HTTP 200，ok=true，files 结构完整',
    cmd: 'GET http://127.0.0.1:8899/api/sessions/codex:01a14f11-5b9a-7d72-a8c7-2cd0f7a5357c/files'
  },
  {
    at,
    by,
    family: 'antigravity',
    layer: 'L2',
    route: 'antigravity/L2/server-api',
    surface: 'server-http',
    capability: 'artifact',
    result: 'pass',
    condition: 'GET /api/sessions/antigravity:8d0cc8e7-6589-4b6b-973d-9481b5502d96/files',
    evidence: '实测通过：返回 HTTP 200，提取会话内产生文件列表（369 个文件），且读取会话外文件返回 HTTP 403 权限受控',
    cmd: 'GET http://127.0.0.1:8899/api/sessions/antigravity:8d0cc8e7-6589-4b6b-973d-9481b5502d96/files'
  },
  {
    at,
    by,
    family: 'gemini',
    layer: 'L2',
    route: 'gemini/L2/server-api',
    surface: 'server-http',
    capability: 'artifact',
    result: 'pass',
    condition: 'GET /api/sessions/gemini:59db7b29-7cab-4f91-83cb-a8776168e1ba/files',
    evidence: '实测通过：返回 HTTP 200，ok=true，files 结构完整',
    cmd: 'GET http://127.0.0.1:8899/api/sessions/gemini:59db7b29-7cab-4f91-83cb-a8776168e1ba/files'
  },
  {
    at,
    by,
    family: 'droid',
    layer: 'L2',
    route: 'droid/L2/server-api',
    surface: 'server-http',
    capability: 'artifact',
    result: 'pass',
    condition: 'GET /api/sessions/factory:86963d32-b266-4667-88dc-4dc02acd53a6/files',
    evidence: '实测通过：返回 HTTP 200，提取会话内产生文件列表（26 个文件，含 test_simple_catalog.py）',
    cmd: 'GET http://127.0.0.1:8899/api/sessions/factory:86963d32-b266-4667-88dc-4dc02acd53a6/files'
  },

  // 47-49: ownership (claude, zcode, antigravity)
  {
    at,
    by,
    family: 'claude',
    layer: 'L2',
    route: 'claude/L2/server-api',
    surface: 'server-http',
    capability: 'ownership',
    result: 'pass',
    condition: 'GET /api/sessions/claude-code:3f9b57d6-23be-479a-9537-70e0ed2d86cc (server.buildPoint)',
    evidence: '实测通过：返回 HTTP 200，entry=local-store, ownership=unclaimed, controlName=Claude Code，pointCapabilities 计算完整',
    cmd: 'GET http://127.0.0.1:8899/api/sessions/claude-code:3f9b57d6-23be-479a-9537-70e0ed2d86cc'
  },
  {
    at,
    by,
    family: 'zcode',
    layer: 'L2',
    route: 'zcode/L2/server-api',
    surface: 'server-http',
    capability: 'ownership',
    result: 'pass',
    condition: 'GET /api/sessions/zcode:sess_3c744145-b9cf-460f-803c-672ecdba625c (server.buildPoint)',
    evidence: '实测通过：返回 HTTP 200，entry=acpx, ownership=hub-idle, controlName=m-sess3c744145，pointCapabilities 计算完整',
    cmd: 'GET http://127.0.0.1:8899/api/sessions/zcode:sess_3c744145-b9cf-460f-803c-672ecdba625c'
  },
  {
    at,
    by,
    family: 'antigravity',
    layer: 'L2',
    route: 'antigravity/L2/server-api',
    surface: 'server-http',
    capability: 'ownership',
    result: 'pass',
    condition: 'GET /api/sessions/antigravity:44153cb7-1bcc-47b7-981e-eec529582e64 (server.buildPoint)',
    evidence: '实测通过：返回 HTTP 200，entry=agentapi, ownership=hub-running, controlName=m-44153cb71bcc，pointCapabilities 计算完整',
    cmd: 'GET http://127.0.0.1:8899/api/sessions/antigravity:44153cb7-1bcc-47b7-981e-eec529582e64'
  }
];

const targetFile = path.resolve('channels', 'probe', 'blackboard.jsonl');
const appendText = rows.map(r => JSON.stringify(r)).join('\n') + '\n';

// Explicitly use utf8 without BOM
fs.appendFileSync(targetFile, appendText, { encoding: 'utf8' });
console.log(`Successfully appended ${rows.length} rows to blackboard.jsonl`);
