import fs from "node:fs";
import path from "node:path";

const CWD = "E:\\program\\GIT\\Agent\\multi\\Agent-Architecture-Hub";
const bbPath = path.join(CWD, "channels", "probe", "blackboard.jsonl");
const now = new Date().toISOString();

const records = [
  // --- Codex (9 格) ---
  {
    at: now,
    by: "agy-pro-codex-claude",
    family: "codex",
    layer: "L0",
    route: "codex/L0/exec",
    surface: "native-cli",
    capability: "fork",
    result: "pass",
    condition: "通过 codex exec --fork <parent_thread_id> 在新分叉线程中提问父会话暗号",
    evidence: "parent_thread=01a14977-267c-7b02-8562-1fb5e602452d, fork_thread=01a14977-6140-7be1-8839-d510f768b422; item.completed: {\"type\":\"agent_message\",\"text\":\"PROBE_FORK_SECRET_8819\"}",
    cmd: "node channels/probe/scripts/retest/retest_codex_l0_exec.mjs",
    note: "分叉线程独立生成并准确回答出父线程中注入的暗号 PROBE_FORK_SECRET_8819"
  },
  {
    at: now,
    by: "agy-pro-codex-claude",
    family: "codex",
    layer: "L0",
    route: "codex/L0/app-server",
    surface: "daemon",
    capability: "steer",
    result: "pass",
    condition: "长轮次生成进行中向 app-server 下发 turn/steer RPC",
    evidence: "turn_id=01a14982-6b1c-7ab0-8349-31f65c4e337d; turn/steer response: {\"turn_id\":\"01a14982-6b1c-7ab0-8349-31f65c4e337d\"}; turn/completed text: \"STEER_IN_TURN_VERIFIED_771\", status: \"completed\"",
    cmd: "node channels/probe/scripts/retest/test_appserver_steer.mjs",
    note: "插入的内容直接在当前正在执行的同一 turn 内部生成体现，且该轮以 completed 正常收尾"
  },
  {
    at: now,
    by: "agy-pro-codex-claude",
    family: "codex",
    layer: "L0",
    route: "codex/L0/app-server",
    surface: "daemon",
    capability: "fork",
    result: "pass",
    condition: "调用 app-server thread/fork RPC 分叉线程并在新线程中提问首轮暗号",
    evidence: "parent_thread=01a1497b-8654-7aa3-b350-426e2bfc4123, forked_thread=01a1497b-a1b3-78e3-a52d-03a8fed956ed; turn/completed text: \"APP_FORK_TOKEN_8829\", duration_ms=12086",
    cmd: "node channels/probe/scripts/retest/test_appserver_fork.mjs",
    note: "分叉线程继承了父线程上下文，并在第一轮提问中正确回答出暗号"
  },
  {
    at: now,
    by: "agy-pro-codex-claude",
    family: "codex",
    layer: "L0",
    route: "codex/L0/app-server",
    surface: "daemon",
    capability: "compact",
    result: "pass",
    condition: "注入上下文后调用 app-server thread/compact/start RPC",
    evidence: "thread_id=01a1497f-ee95-72b0-9fd5-05011617d168; compact_turn=01a14980-5306-7032-8231-d41d7c01136e; duration_ms=7865; event_msg: {\"type\":\"compacted\"}; item: {\"type\":\"ContextCompaction\"}; token_count: {\"last_token_usage\":4604}",
    cmd: "node channels/probe/scripts/retest/test_appserver_compact.mjs",
    note: "异步触发压缩轮次，产生 ContextCompaction 项并发出 compacted 状态，token 用量落至 4604"
  },
  {
    at: now,
    by: "agy-pro-codex-claude",
    family: "codex",
    layer: "L0",
    route: "codex/L0/app-server",
    surface: "daemon",
    capability: "model-switch",
    result: "pass",
    condition: "thread 首轮使用 gpt-5.6-sol，第二轮通过 turn/start 传入 model: gpt-5.5",
    evidence: "thread_id=01a1497c-0892-77e0-8512-98fd51df5dd1; rollout turn 1: {\"turn_id\":\"01a1497c-0c1b-7512-872f-5eaee36a3617\",\"model\":\"gpt-5.6-sol\"}; rollout turn 2: {\"turn_id\":\"01a1497c-4735-7c01-bf19-35c939ea9f13\",\"model\":\"gpt-5.5\"}",
    cmd: "node channels/probe/scripts/retest/test_appserver_model_switch.mjs",
    note: "落盘 rollout 日志的 turn_context 事件中真实记录了第二轮切换为 gpt-5.5"
  },
  {
    at: now,
    by: "agy-pro-codex-claude",
    family: "codex",
    layer: "L1a",
    route: "codex/L1a/codex-acp",
    surface: "acp-bridge",
    capability: "model-new",
    result: "pass",
    condition: "通过 codex-acp 建立新会话并执行 prompt",
    evidence: "session=01a14983-3461-7ca0-989b-baa3ef9c59d4; _meta.quota.model_usage=[{\"model\":\"gpt-6.1-sol\"}]; rollout-2026-10-17T18-58-17-01a14983-3461-7ca0-989b-baa3ef9c59d4.jsonl line 7 turn_context: {\"model\":\"gpt-6.1-sol\"}",
    cmd: "node channels/probe/scripts/retest/retest_codex_l1a_acp.mjs",
    note: "返回元数据 quota.model_usage 与底层 rollout 的 turn_context 双重证实首轮实际运行模型为 gpt-6.1-sol"
  },
  {
    at: now,
    by: "agy-pro-codex-claude",
    family: "codex",
    layer: "L1b",
    route: "codex/L1b/acpx",
    surface: "acpx",
    capability: "cancel",
    result: "pass",
    condition: "长轮次执行中通过 acpx codex cancel 中断，随后下发恢复 prompt",
    evidence: "cancel output: \"cancel requested\"; interrupted process exitCode=0; recovery prompt output: \"CANCEL_RECOVERED_OK\", recoveryExitCode=0",
    cmd: "node channels/probe/scripts/retest/retest_codex_l1b_acpx.mjs",
    note: "被打断的进程优雅退出（code 0），会话未被损坏，后续恢复轮次正常答复 CANCEL_RECOVERED_OK"
  },
  {
    at: now,
    by: "agy-pro-codex-claude",
    family: "codex",
    layer: "L1b",
    route: "codex/L1b/acpx",
    surface: "acpx",
    capability: "model-new",
    result: "pass",
    condition: "acpx codex sessions new 创建会话并执行首轮 prompt",
    evidence: "session=probe-codex-mswitch-1792235009384, thread_id=01a14988-2699-7242-9df3-c9e50f0abd9a; rollout line 7 turn_context: {\"turn_id\":\"01a14988-2d32-7171-9831-67b6be337b61\",\"model\":\"gpt-6.1-sol\"}; line 14 token_usage_record: {\"usage\":{\"total_tokens\":27597}}",
    cmd: "node channels/probe/scripts/retest/retest_codex_l1b_acpx.mjs",
    note: "底层实际用量日志 token_usage_record 与 turn_context 证实首轮真实模型为 gpt-6.1-sol"
  },
  {
    at: now,
    by: "agy-pro-codex-claude",
    family: "codex",
    layer: "L1b",
    route: "codex/L1b/acpx",
    surface: "acpx",
    capability: "model-switch",
    result: "pass",
    condition: "通过 acpx codex set model gpt-5.6-sol 切模型后下发第二轮 prompt",
    evidence: "set output: \"model set: gpt-5.6-sol\"; rollout line 24 turn_context: {\"turn_id\":\"01a14988-58ab-7373-b5d3-c8931a98d550\",\"model\":\"gpt-5.6-sol\"}; prompt 2 output: \"M2_OK\"",
    cmd: "node channels/probe/scripts/retest/retest_codex_l1b_acpx.mjs",
    note: "底层 rollout 日志第 24 行 turn_context 证实第二轮实际运行模型已从 gpt-6.1-sol 成功切为 gpt-5.6-sol"
  },

  // --- Claude (8 格) ---
  {
    at: now,
    by: "agy-pro-codex-claude",
    family: "claude",
    layer: "L0",
    route: "claude/L0/claude-cli",
    surface: "native-cli",
    capability: "steer",
    result: "fail",
    condition: "claude -p --input-format stream-json --output-format stream-json 管道输入连续两段 user message",
    evidence: "CLI 阻塞等待 EOF；收到双消息后顺序输出两次独立结果：result_index: 0, result_index: 1；上游返回报错：\"API Error: 403 智能路由预留额度失败: insufficient wallet quota (request id: 202610171117420099247978268d9d6UQGERCLf)\"",
    cmd: "node channels/probe/scripts/retest/retest_claude_suite.mjs",
    note: "CLI 非交互打印模式不支持轮内插话（表现为排队串行出两次结果）；同时受限于上游智能路由额度耗尽报错"
  },
  {
    at: now,
    by: "agy-pro-codex-claude",
    family: "claude",
    layer: "L1a",
    route: "claude/L1a/claude-agent-acp",
    surface: "acp-bridge",
    capability: "resume-native",
    result: "fail",
    condition: "通过 connection.loadSession 加载原生会话 e7bb63b1-f61a-47e9-b51a-e1842913067b 并下发 prompt 询问暗号",
    evidence: "loadSession 返回成功 (modes: plan)；但 prompt 阶段报错中断：RequestError: Authentication required (code: -32000)，上游 API 报错原文：\"API Error: 403 智能路由预留额度失败: insufficient wallet quota\"",
    cmd: "node channels/probe/scripts/retest/retest_claude_suite.mjs",
    note: "loadSession 协议层成功，但后序提问验证轮因上游额度耗尽断在首轮请求，无法问出暗号"
  },
  {
    at: now,
    by: "agy-pro-codex-claude",
    family: "claude",
    layer: "L1a",
    route: "claude/L1a/claude-agent-acp",
    surface: "acp-bridge",
    capability: "steer",
    result: "fail",
    condition: "活跃 turn 进行中下发并发 connection.prompt()",
    evidence: "桥端元数据声明能力仅为 _meta.claudeCode.promptQueueing=true；并发 prompt 会进入排队队列等第一轮结束才跑，无法在本轮内插入生效；且调用受阻于上游 403 额度不足",
    cmd: "node channels/probe/scripts/retest/retest_claude_suite.mjs",
    note: "claude-agent-acp 仅支持 promptQueueing（排队），不满足任务书轮内插话（steer）定义"
  },
  {
    at: now,
    by: "agy-pro-codex-claude",
    family: "claude",
    layer: "L1a",
    route: "claude/L1a/claude-agent-acp",
    surface: "acp-bridge",
    capability: "permission",
    result: "fail",
    condition: "模式置为 default (manual)，下发写文件 prompt 触发审批",
    evidence: "大模型生成阶段即报错：RequestError: Authentication required (code: -32000)，断在 LLM 调用前（上游 403 智能路由预留额度失败: insufficient wallet quota），未产生 tool_use，故未能触发 clientHandler.requestPermission",
    cmd: "node channels/probe/scripts/retest/retest_claude_suite.mjs",
    note: "无法在轮内收到审批请求原文，断在上游额度不足无法完成模型推理"
  },
  {
    at: now,
    by: "agy-pro-codex-claude",
    family: "claude",
    layer: "L1a",
    route: "claude/L1a/claude-agent-acp",
    surface: "acp-bridge",
    capability: "fork",
    result: "pass",
    condition: "调用 connection.unstable_forkSession({ sessionId: 'e7bb63b1-f61a-47e9-b51a-e1842913067b', cwd })",
    evidence: "RPC 返回: {\"sessionId\":\"cd7418a4-a806-40fb-a334-911d941ed5eb\"}; 本地落盘 transcript cd7418a4-a806-40fb-a334-911d941ed5eb.jsonl 共 66 行；Line 0: {\"role\":\"user\",\"content\":\"记住暗号 PROBE_L0_KAPPA_921，回复 ACK\"}; Line 31: {\"model\":\"claude-haiku-4-5\",\"id\":\"msg_011Cg7bNcO2pNbytBZK1CqKm\",\"type\":\"message\",\"role\":\"assistant\"}",
    cmd: "node channels/probe/scripts/retest/retest_claude_suite.mjs",
    note: "分叉 RPC 成功返回新 session_id，并在磁盘生成独立 jsonl 继承了父会话全部 66 行历史及暗号"
  },
  {
    at: now,
    by: "agy-pro-codex-claude",
    family: "claude",
    layer: "L1a",
    route: "claude/L1a/claude-agent-acp",
    surface: "acp-bridge",
    capability: "model-switch",
    result: "n/a",
    condition: "查询 configOptions.model 可选项并遵循用户红线",
    evidence: "configOptions.model.options: [{\"value\":\"default\"},{\"value\":\"opus\"},{\"value\":\"fable\"},{\"value\":\"sonnet\"},{\"value\":\"haiku\"}]；用户红线严禁使用 sonnet 和 opus，而 default/fable 为 opus 别名；传入任何其他档报 Invalid params (-32602)",
    cmd: "node channels/probe/scripts/retest/retest_claude_suite.mjs",
    note: "在不违反用户\"不许用 sonnet、opus\"且\"只在 haiku 和另一个最便宜档切\"的红线约束下，Claude 桥端不存在第二个合法便宜模型档位，无可行切模型路径；且后序生成受阻于 403 额度不足"
  },
  {
    at: now,
    by: "agy-pro-codex-claude",
    family: "claude",
    layer: "L1b",
    route: "claude/L1b/acpx",
    surface: "acpx",
    capability: "model-new",
    result: "fail",
    condition: "acpx claude sessions new -s probe-claude-l1b-mnew --model haiku 并下发 prompt",
    evidence: "acpx claude prompt 执行报错中断，原始 stderr: \"Failed to authenticate. API Error: 403 智能路由预留额度失败: insufficient wallet quota (request id: 202610171117420099247978268d9d6UQGERCLf)\"",
    cmd: "node channels/probe/scripts/retest/retest_claude_suite.mjs",
    note: "断在首轮请求，因上游额度耗尽无法完成一轮生成并取得实际用量/日志行"
  },
  {
    at: now,
    by: "agy-pro-codex-claude",
    family: "claude",
    layer: "L1b",
    route: "claude/L1b/acpx",
    surface: "acpx",
    capability: "model-switch",
    result: "n/a",
    condition: "通过 acpx claude set model 动态切模型",
    evidence: "模型选项受限于 [default, opus, fable, sonnet, haiku]，受用户红线约束不可切至 sonnet/opus 档，无其他合法便宜模型可用；且后续 prompt 同样受阻于 403 智能路由预留额度失败",
    cmd: "node channels/probe/scripts/retest/retest_claude_suite.mjs",
    note: "受用户红线与适配器模型枚举双重限制，无可用切模型目标；且上游额度耗尽无法验证运行时模型"
  }
];

const linesToAppend = records.map(r => JSON.stringify(r)).join("\n") + "\n";
fs.appendFileSync(bbPath, linesToAppend, "utf8");
console.log("Successfully appended " + records.length + " retest records to blackboard.jsonl!");
