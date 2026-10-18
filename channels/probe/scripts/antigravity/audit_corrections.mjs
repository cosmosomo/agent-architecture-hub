import fs from 'node:fs';
import path from 'node:path';

const BLACKBOARD = path.resolve('channels/probe/blackboard.jsonl');

const corrections = [
  {
    cap: 'spawn-subagent',
    route: 'antigravity/L0/connect-rpc',
    surface: 'daemon',
    note: '接口存在，缺行为证据：虽已验证父子索引关联与 ForceStopCascadeTree 杀树，但缺少子会话完成任务后产出真实回传父会话并被父会话引用的端到端回显'
  },
  {
    cap: 'workspace',
    route: 'antigravity/L0/agentapi+projects-config',
    surface: 'daemon',
    note: '接口存在，缺行为证据：元数据中虽存在 workspaceUris，但缺少智能体在指定独立工作区后，真实文件读写物理落盘在指定目录的原始回显'
  },
  {
    cap: 'instructions',
    route: 'antigravity/L0/customizations',
    surface: 'daemon',
    note: '接口存在，缺行为证据：系统虽支持 GEMINI.md/AGENTS.md 规则注入，但缺少新建会话指定专属角色说明后，模型回复严格受其约束且后续无法篡改的对照测试输出'
  },
  {
    cap: 'mount-tools',
    route: 'antigravity/L0/mcp+plugins',
    surface: 'daemon',
    note: '接口存在，缺行为证据：mcp_config.json 与 launchedMcpServers 元数据存在，但缺少挂接工具可成功调用、未挂接工具调用报错的原始执行对照'
  },
  {
    cap: 'inject-next',
    route: 'antigravity/L0/connect-rpc',
    surface: 'daemon',
    note: '接口存在，缺行为证据：二进制存在 MESSAGE_DELIVERY_STRATEGY_WHEN_IDLE 枚举，但缺少运行中送入消息、待当前轮结束后自动作为下轮输入触发推理的原始轨迹'
  },
  {
    cap: 'inject-tool',
    route: 'antigravity/L0/mcp',
    surface: 'daemon',
    note: '接口存在，缺行为证据：MCP 协议规范支持 ToolResult 携带上下文，但缺少在真实 ToolResult 中捎带指令并被下一步 PLANNER_RESPONSE 照做的原始输出'
  },
  {
    cap: 'inject-inbox',
    route: 'antigravity/L0/file-inbox',
    surface: 'daemon',
    note: '接口存在，缺行为证据：智能体具备 view_file 工具，但缺少外部写入收件箱文件后智能体主动巡检读取并改变行为的完整执行日志'
  },
  {
    cap: 'goal',
    route: 'antigravity/L0/hooks+slash',
    surface: 'daemon',
    note: '接口存在，缺行为证据：/goal 命令与 Stop 钩子规范存在，但缺少设定具体目标与预算后，智能体持续推进直到预算耗尽被拦下的原始回显'
  },
  {
    cap: 'channel-health',
    route: 'antigravity/L0/connect-rpc',
    surface: 'daemon',
    note: '接口存在，缺行为证据：/healthz 接口与配额查询可用，但缺少渠道网络异常或服务报错时系统自动标记不可用并停止派活的熔断日志'
  },
  {
    cap: 'channel-lease',
    route: 'antigravity/L0/presence-lock+gateway',
    surface: 'daemon',
    note: '接口存在，缺行为证据：presence 锁文件与 5h 平滑限流规则存在，但缺少多调用方并发请求时按上限排队并在持有者释放后放行的调度日志'
  },
  {
    cap: 'capacity',
    route: 'antigravity/L0/summaries-db',
    surface: 'daemon',
    note: '接口存在，缺行为证据：数据库可统计活跃会话槽位，但缺少并发数达到配额上限时新任务被硬性挂起或拒绝的运行证据'
  },
  {
    cap: 'host-drain',
    route: 'antigravity/L0/gateway+daemon',
    surface: 'daemon',
    note: '接口存在，缺行为证据：网关代码支持平稳退出，但缺少在跑轮次期间触发 drain、在跑任务全部完成且新请求被拦截暂存的原始输出'
  },
  {
    cap: 'memory-mode',
    route: 'antigravity/L0/slash-learn+conversations-db',
    surface: 'daemon',
    note: '接口存在，缺行为证据：底层单会话库文件物理隔离，但缺少新会话无法回忆上一会话专属秘密、显式 /learn 后新会话能读出的对照实验输出'
  },
  {
    cap: 'act-deliver',
    route: 'antigravity/L0/artifacts+transcript',
    surface: 'daemon',
    note: '接口存在，缺行为证据：write_to_file 带有 ArtifactMetadata，但缺少外部中心通过 API 收到结构化交付事件并提取产物的端到端原始回显'
  },
  {
    cap: 'act-request',
    route: 'antigravity/L0/ask_question+send_message',
    surface: 'daemon',
    note: '接口存在，缺行为证据：ask_question 与 send_message 工具存在，但缺少智能体主动发起审批/资源请求并由中心答复解挂的交互记录'
  },
  {
    cap: 'act-yield',
    route: 'antigravity/L0/summaries-db',
    surface: 'daemon',
    note: '接口存在，缺行为证据：后台长命令可进入 IDLE 待命，但缺少中心通过结构化接口读出其“正在等待什么”的标准字段输出'
  },
  {
    cap: 'act-report',
    route: 'antigravity/L0/transcript-stream',
    surface: 'daemon',
    note: '接口存在，缺行为证据：日志支持流式落盘，但缺少多步任务中外部监听器捕获到阶段性进展上报且当前轮次不中断的事件流输出'
  },
  {
    cap: 'ask-user',
    route: 'antigravity/L0/builtin-tool',
    surface: 'daemon',
    note: '接口存在，缺行为证据：ask_question 工具声明存在，但缺少在无头/CLI 环境下触发提问并在终端捕获人输入送回的原始日志'
  },
  {
    cap: 'notify-user',
    route: 'antigravity/L0/desktop-toast',
    surface: 'daemon',
    note: '接口存在，缺行为证据：宿主支持操作系统通知，但缺少程序触发桌面弹窗并在系统端捕获通知回执的原始数据'
  },
  {
    cap: 'human-steer',
    route: 'antigravity/L0/agentapi+desktop-input',
    surface: 'daemon',
    note: '接口存在，缺行为证据：agentapi send-message 支持插话，但缺少本次实测中在同一轮内插话后两步内改变输出的独立原始日志（前人日志不计入本次）'
  },
  {
    cap: 'handover-human',
    route: 'antigravity/L0/desktop-app',
    surface: 'daemon',
    note: '接口存在，缺行为证据：外部会话在桌面端侧边栏可见，但缺少人类在桌面端接手点击并继续交互的真实链路证据'
  },
  {
    cap: 'peer-message',
    route: 'antigravity/L0/send_message+rpc',
    surface: 'daemon',
    note: '接口存在，缺行为证据：SendAgentMessage 方法存在，但缺少会话 A 投递消息、会话 B 自动唤醒并回复的端到端调用链证据'
  },
  {
    cap: 'handoff',
    route: 'antigravity/L0/subagents+fork',
    surface: 'daemon',
    note: '接口存在，缺行为证据：invoke_subagent 与分叉方法存在，但缺少任务与上下文移交新会话后由接手者独立闭环的完整转写'
  },
  {
    cap: 'task-board',
    route: 'antigravity/L0/manage_task+board-file',
    surface: 'daemon',
    note: '接口存在，缺行为证据：manage_task 工具存在，但缺少多个会话同时读写同一份共享任务清单并达成状态共识的并发记录'
  },
  {
    cap: 'reclaim',
    route: 'antigravity/L0/force-stop+lock-release',
    surface: 'daemon',
    note: '接口存在，缺行为证据：ForceStopCascadeTree 可杀灭进程树，但缺少实例停下、会话锁放手、任务回到中心调度池重新派发的闭环回显'
  },
  {
    cap: 'artifact',
    route: 'antigravity/L0/artifacts-ui',
    surface: 'daemon',
    note: '接口存在，缺行为证据：write_to_file 规范支持发布产物，但缺少通过无头 API 触发发布并在人类端确认可打开交互的端到端回执'
  },
  {
    cap: 'browser',
    route: 'antigravity/L0/builtin-browser',
    surface: 'daemon',
    note: '接口存在，缺行为证据：内置搜索与正文提取工具存在，但缺少在测试会话中操作浏览器交互/渲染并取回 DOM 的行为日志'
  },
  {
    cap: 'terminal',
    route: 'antigravity/L0/run_command',
    surface: 'daemon',
    note: '接口存在，缺行为证据：此前仅为通用工具描述，缺少在被测宿主执行命令并捕获标准输出的专项独立证据（已通过补测打通）'
  },
  {
    cap: 'dev-preview',
    route: 'antigravity/L0/generative_ui+webview',
    surface: 'daemon',
    note: '接口存在，缺行为证据：generative_ui 规范存在，但缺少起本地服务并在独立预览容器内加载页面的控制台网络回执'
  },
  {
    cap: 'cmd-list',
    route: 'antigravity/L0/slash-commands',
    surface: 'daemon',
    note: '接口存在，缺行为证据：此前仅查阅 CLI 帮助文档，缺少通过服务端接口直接读取完整可用命令清单的原始输出（已通过补测打通）'
  },
  {
    cap: 'archive',
    route: 'antigravity/L0/metadata-hide',
    surface: 'daemon',
    note: '接口存在，缺行为证据：hideFromConversationList 字段存在，但缺少执行归档后主列表剔除、重新发消息后成功取回的状态机证据'
  },
  {
    cap: 'delete',
    route: 'antigravity/L0/sqlite-delete+rpc',
    surface: 'daemon',
    note: '接口存在，缺行为证据：此前仅为 SQL 操作假设，缺少调用宿主删除方法后再次读取报错的生命周期测试（已通过补测打通）'
  },
  {
    cap: 'loop-guard',
    route: 'antigravity/L0/loop-detector',
    surface: 'daemon',
    note: '接口存在，缺行为证据：二进制存在 loopErrorModelMessage 机制，但缺少构造重复失败行为触发模型警告或强制熔断的原始日志'
  },
  {
    cap: 'guard',
    route: 'antigravity/L0/hooks-json',
    surface: 'daemon',
    note: '接口存在，缺行为证据：hooks.json 钩子配置存在，但缺少在执行敏感工具时被 PreToolUse 真实拦截或改写参数的终端证据'
  },
  {
    cap: 'output-contract',
    route: 'antigravity/L0/rules+post-invocation-hook',
    surface: 'daemon',
    note: '接口存在，缺行为证据：GEMINI.md 规则存在，但缺少输出格式不合规时被 PostInvocation 钩子真正拦截并迫使模型重写的原始回显'
  },
  {
    cap: 'permission-scope',
    route: 'antigravity/L0/workspace-boundary',
    surface: 'daemon',
    note: '接口存在，缺行为证据：提示词规则包含目录限制，但缺少智能体尝试越界写文件被宿主安全沙箱硬拦截报错的原始终端输出'
  }
];

const passes = [
  {
    cap: 'delete',
    route: 'antigravity/L0/connect-rpc',
    surface: 'daemon',
    result: 'pass',
    condition: 'Antigravity 2.23.1, Connect-RPC DeleteCascadeTrajectory',
    evidence: 'StartCascade 创建 a3a505e1-... 后 GetCascadeTrajectory 200 返回正常轨迹；下发 DeleteCascadeTrajectory {"cascadeId":"a3a505e1-..."} 返回 200 {}；再次 GetCascadeTrajectory 报错: status 500 {"code":"unknown","message":"trajectory not found (error ID: 0ff37737f6374049a31b2d4164d347d9)"}，符合“删除后再读报错”判定标准',
    cmd: 'node channels/probe/scripts/antigravity/rpc.mjs DeleteCascadeTrajectory {"cascadeId":"<cid>"}',
    note: '10分钟内补测通过：原生 DeleteCascadeTrajectory 成功销毁会话轨迹，后续读接口明确报错 trajectory not found'
  },
  {
    cap: 'cmd-list',
    route: 'antigravity/L0/connect-rpc',
    surface: 'daemon',
    result: 'pass',
    condition: 'Antigravity 2.23.1, Connect-RPC GetSlashCommands',
    evidence: '调用 GetSlashCommands 传入 planModel MODEL_PLACEHOLDER_M198 返回 200 OK，输出完整可用命令与技能注册表 JSON（含 SLASH_COMMAND_TYPE_SKILL、modelFacingText、title、description、definitionPath），与实际挂接技能完全一致',
    cmd: 'node channels/probe/scripts/antigravity/rpc.mjs GetSlashCommands \'{"cascadeConfig":{"plannerConfig":{"planModel":"MODEL_PLACEHOLDER_M198"}}}\'',
    note: '10分钟内补测通过：通过 Connect-RPC 原生获取服务端完整斜杠命令与技能清单，输出内容结构化完备'
  },
  {
    cap: 'terminal',
    route: 'antigravity/L0/connect-rpc',
    surface: 'daemon',
    result: 'pass',
    condition: 'Antigravity 2.23.1, Connect-RPC RunCommand',
    evidence: '调用 RunCommand {"command": "echo PROBE_TERMINAL_TEST_123"} 返回 status 200 {"stdout":"PROBE_TERMINAL_TEST_123\\n"}，成功执行并取回标准输出',
    cmd: 'node channels/probe/scripts/antigravity/rpc.mjs RunCommand \'{"command": "echo PROBE_TERMINAL_TEST_123"}\'',
    note: '10分钟内补测通过：Connect-RPC 原生支持宿主终端命令同步执行并捕获取回输出'
  }
];

const linesToAppend = [];
const now = new Date().toISOString();

// 1. Append unverified for all 36 Category B
for (const c of corrections) {
  const row = {
    at: now,
    by: 'agy-fact-antigravity-audit',
    family: 'antigravity',
    layer: 'L0',
    route: c.route,
    surface: c.surface,
    capability: c.cap,
    result: 'unverified',
    condition: 'Antigravity 2.23.1 负责人复核：严格按行为证据标准重评',
    evidence: c.note,
    cmd: 'n/a',
    note: c.note
  };
  linesToAppend.push(JSON.stringify(row));
}

// 2. Append pass for the 3 retested items
for (const p of passes) {
  const row = {
    at: now,
    by: 'agy-fact-antigravity-audit',
    family: 'antigravity',
    layer: 'L0',
    route: p.route,
    surface: p.surface,
    capability: p.cap,
    result: p.result,
    condition: p.condition,
    evidence: p.evidence,
    cmd: p.cmd,
    note: p.note
  };
  linesToAppend.push(JSON.stringify(row));
}

fs.appendFileSync(BLACKBOARD, '\n' + linesToAppend.join('\n') + '\n', 'utf8');
console.log(`Successfully appended ${linesToAppend.length} audit lines to ${BLACKBOARD}`);
