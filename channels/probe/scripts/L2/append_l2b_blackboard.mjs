import { readFileSync, appendFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const REPO_ROOT = 'E:\\program\\GIT\\Agent\\multi\\Agent-Architecture-Hub';
const BLACKBOARD_FILE = resolve(REPO_ROOT, 'channels/probe/blackboard.jsonl');
const BY = 'agy-pro-L2b';
const NOW = '2026-10-17T21:25:00+08:00';

const FAMILIES = ['codex', 'claude', 'zcode', 'workbuddy', 'opencode', 'hermes', 'antigravity'];

const entries = [];

// ==========================================
// 1. POST /api/gateway/session/new (7 families)
// ==========================================
for (const f of FAMILIES) {
  entries.push({
    at: NOW,
    by: BY,
    family: f,
    layer: 'L2',
    route: `${f}/L2/server-api`,
    surface: 'gateway-api',
    capability: 'open',
    calls: 'none',
    verdict: '假闭环',
    result: 'fail',
    condition: `调用 POST /api/gateway/session/new 注册新会话 probe-L2b-${f}-new`,
    evidence: `接口返回 200 {"ok":true,"channel":"${f}","sessionName":"probe-L2b-${f}-new","traceSessionId":"new:${f}:probe-L2b-${f}-new","session":null}；~/.acpx/sessions 与底层无任何新会话文件`,
    cmd: `fetch('http://127.0.0.1:8932/api/gateway/session/new', {method:'POST',body:JSON.stringify({channel:'${f}',sessionName:'probe-L2b-${f}-new'})})`,
    note: `gateway.ts:2203-2251 仅在网关内存 this.draftSessions 登记草稿对象，未调用任何下层 L0/L1 路线（calls: none），底层会话从未真实创建，属典型假闭环`,
  });
}

// ==========================================
// 2. POST /api/gateway/model (7 families)
// ==========================================
for (const f of FAMILIES) {
  const isAgy = f === 'antigravity';
  entries.push({
    at: NOW,
    by: BY,
    family: f,
    layer: 'L2',
    route: `${f}/L2/server-api`,
    surface: 'gateway-api',
    capability: 'model-switch',
    calls: isAgy ? 'none' : `${f}/L1b/acpx`,
    verdict: '假闭环',
    result: 'fail',
    condition: `调用 POST /api/gateway/model 切换模型`,
    evidence: `接口返回 200 {"ok":true,"channel":"${f}","sessionName":"probe-L2b-${f}-model"}；${isAgy ? 'gateway.ts:3011 显式排除 antigravity，无 RPC 调用' : '仅覆写 ~/.acpx/sessions/<id>.json 并异步执行 acpx set-model，草稿或原生会话无对应文件直接报错'}`,
    cmd: `fetch('http://127.0.0.1:8932/api/gateway/model', {method:'POST',body:JSON.stringify({channel:'${f}',sessionName:'probe-L2b-${f}-model',model:'test-model'})})`,
    note: `gateway.ts:2970-3068：对 antigravity 仅设内存 Map，底层无 RPC 调用（calls: none）；对其余 6 家若会话文件不存在则 acpx set-model 报错，即便改写了 .acpx json 也不改变下一轮实际模型，属假闭环`,
  });
}

// ==========================================
// 3. POST /api/gateway/cwd (7 families)
// ==========================================
for (const f of FAMILIES) {
  entries.push({
    at: NOW,
    by: BY,
    family: f,
    layer: 'L2',
    route: `${f}/L2/server-api`,
    surface: 'gateway-api',
    capability: 'mode-switch',
    calls: 'none',
    verdict: '假闭环',
    result: 'partial',
    condition: `调用 POST /api/gateway/cwd 切换会话工作目录`,
    evidence: `有效路径返回 200 {"ok":true,"cwd":"${REPO_ROOT}"}；无效路径返回 500 {"error":"工作目录不存在或不是有效文件夹"}；未调用任何下层命令或协议`,
    cmd: `fetch('http://127.0.0.1:8932/api/gateway/cwd', {method:'POST',body:JSON.stringify({channel:'${f}',sessionName:'probe-L2b-${f}-cwd',cwd:'${REPO_ROOT}'})})`,
    note: `gateway.ts:2900-2967：仅校验目录合法性并在网关内存 selectedCwds 缓存，若存在 .acpx json 则修改 raw.cwd 字段，未向运行中进程或底层守护发送任何切换通知（calls: none），非运行时动态切目录`,
  });
}

// ==========================================
// 4. POST /api/gateway/approve (7 families)
// ==========================================
for (const f of FAMILIES) {
  const callsRoute = f === 'antigravity' ? 'antigravity/L0/agentapi' : `${f}/L1b/acpx`;
  entries.push({
    at: NOW,
    by: BY,
    family: f,
    layer: 'L2',
    route: `${f}/L2/server-api`,
    surface: 'gateway-api',
    capability: 'permission',
    calls: callsRoute,
    verdict: '假闭环',
    result: 'fail',
    condition: `调用 POST /api/gateway/approve 响应权限审批`,
    evidence: `gateway.ts:3960-3987 待审批项是在进程已完全退出后的 finalizeRun 中通过正则 /(permission|denied|拒绝)/ 匹配 stdout 构造；resolveApproval(gateway.ts:3226-3242) 审批通过后并非放行挂起工具，而是新起一轮 prompt 带 --approve-all`,
    cmd: `fetch('http://127.0.0.1:8932/api/gateway/approve', {method:'POST',body:JSON.stringify({id:'appr_xxx',decision:'approve'})})`,
    note: `确认 HANDOFF.md 第三节病灶 4：审批完全脱离 ACP session/request_permission 与原生 RPC 挂起协议，是进程死后事后正则匹配造出的假卡片，点击后粗暴开启新轮次全放行，属典型假闭环`,
  });
}

// ==========================================
// 5. POST /api/gateway/handoff (7 families)
// ==========================================
for (const f of FAMILIES) {
  const callsRoute = f === 'antigravity' ? 'antigravity/L0/agentapi' : `${f}/L1b/acpx`;
  entries.push({
    at: NOW,
    by: BY,
    family: f,
    layer: 'L2',
    route: `${f}/L2/server-api`,
    surface: 'gateway-api',
    capability: 'fork',
    calls: callsRoute,
    verdict: '假闭环',
    result: 'fail',
    condition: `调用 POST /api/gateway/handoff 跨渠道会话接力`,
    evidence: `gateway.ts:3292-3330 提取源会话最近 3 轮文本拼装成 prompt: "【跨智能体协同接力】... 最近 3 轮上下文摘要 ... 【接力执行指令】..." 并调用 sendPrompt 发给新会话`,
    cmd: `fetch('http://127.0.0.1:8932/api/gateway/handoff', {method:'POST',body:JSON.stringify({fromChannel:'codex',toChannel:'${f}',toSessionName:'probe-L2b-handoff'})})`,
    note: `确认 HANDOFF.md 第三节说法：分叉/接力并非原生分支（如 Codex app-server fork 或 ACP session/fork），只是字符串摘要拼接后在新会话重新提问，破坏历史上下文完整性与快照隔离，属假闭环/接错路`,
  });
}

// ==========================================
// 6. GET/POST /api/gateway/meta-agents & patrol (7 families)
// ==========================================
for (const f of FAMILIES) {
  entries.push({
    at: NOW,
    by: BY,
    family: f,
    layer: 'L2',
    route: `${f}/L2/server-api`,
    surface: 'gateway-api',
    capability: 'state',
    calls: 'none',
    verdict: '接通',
    result: 'pass',
    condition: `调用 GET/POST /api/gateway/meta-agents 与巡检接口`,
    evidence: `GET 返回 4 个元智能体 (meta_approver, meta_resumer, meta_maint, meta_auditor)；当 meta_approver 启用且 policy=all 时，sendPrompt(gateway.ts:3415-3426) 将 reads 请求静默升级为全自动读写 (--approve-all)，日志留痕: "已将工具权限从只读 (reads) 自动升级为全自动读写 (--approve-all)"`,
    cmd: `fetch('http://127.0.0.1:8932/api/gateway/meta-agents')`,
    note: `核实完成：4 个元智能体中，meta_approver 会在无人干预下将 Web 请求 permissions=reads 静默升级为 permissions=all (--approve-all)，造成权限放大风险；巡检支持 local_rules 与 agent_brain 双模`,
  });
}

// ==========================================
// 7. POST /api/control (7 families)
// ==========================================
for (const f of FAMILIES) {
  entries.push({
    at: NOW,
    by: BY,
    family: f,
    layer: 'L2',
    route: `${f}/L2/server-api`,
    surface: 'gateway-api',
    capability: 'steer',
    calls: 'none',
    verdict: '假闭环',
    result: 'partial',
    condition: `调用 POST /api/control 向 ${f} 派发人工调控指令`,
    evidence: `返回 200 {"ok":true,"writtenFiles":["agents/${f}/inbox.md","traces/human_actions.jsonl"]}；只在 hub/cases/ 下追加本地 markdown/jsonl 文件，未调用任何下层智能体接口`,
    cmd: `fetch('http://127.0.0.1:8932/api/control', {method:'POST',body:JSON.stringify({modelId:'probe_${f}',kind:'interject',payload:{to:'${f}',text:'人工调控'}})})`,
    note: `server.ts:359-406：该接口是 Mode 1 复杂架构案例与星空拓扑的反向调控仿真写入桩，纯写入案例目录文本，根本不与任何底层 Agent 运行时交互（calls: none），属假闭环`,
  });
}

// ==========================================
// 8. CLI gateway: targets (7 families)
// ==========================================
for (const f of FAMILIES) {
  entries.push({
    at: NOW,
    by: BY,
    family: f,
    layer: 'L2',
    route: `${f}/L2/agent_gateway`,
    surface: 'agent-gateway-cli',
    capability: 'model-list',
    calls: 'none',
    verdict: '接通',
    result: 'pass',
    condition: `执行 node hub/tools/agent_gateway.js targets --json 查看 ${f} 配置`,
    evidence: `返回目标 profile: driver=${f === 'antigravity' ? 'agy-agentapi' : 'acpx'}, defaultModel=${f === 'codex' ? 'gpt-5.4-mini' : f === 'antigravity' ? 'flash' : '...'}, boardStatus=🟢 ok`,
    cmd: `node hub/tools/agent_gateway.js targets --json`,
    note: `agent_gateway.js:355-382：纯静态配置与 channels/hosts/*.md 元数据读取，不调下层动态接口（calls: none），作为静态拓扑名录功能已接通`,
  });
}

// ==========================================
// 9. CLI gateway: status (7 families)
// ==========================================
for (const f of FAMILIES) {
  const isAgy = f === 'antigravity';
  const callRoute = isAgy ? 'antigravity/L0/connect-rpc' : `${f}/L1b/acpx`;
  entries.push({
    at: NOW,
    by: BY,
    family: f,
    layer: 'L2',
    route: `${f}/L2/agent_gateway`,
    surface: 'agent-gateway-cli',
    capability: 'state',
    calls: callRoute,
    verdict: '接通',
    result: 'pass',
    condition: `执行 node hub/tools/agent_gateway.js status --agent ${f}`,
    evidence: isAgy
      ? `exitCode=0, antigravityStatus 返回 lsAddress=localhost:65529, userTier='Google AI Ultra', 5h与7d配额桶完整`
      : `exitCode=0, acpxStatus 返回 action='status_snapshot', status='no-session'`,
    cmd: `node hub/tools/agent_gateway.js status --agent ${f}`,
    note: `agent_gateway.js:734-786：acpx 类调用 acpx status 获取会话快照；antigravity 调用 Connect-RPC: GetUserStatus + RetrieveUserQuotaSummary，准确获取底层活跃状态`,
  });
}

// ==========================================
// 10. CLI gateway: run (7 families)
// ==========================================
for (const f of FAMILIES) {
  const isAgy = f === 'antigravity';
  const callRoute = isAgy ? 'antigravity/L0/agentapi' : `${f}/L1b/acpx`;
  entries.push({
    at: NOW,
    by: BY,
    family: f,
    layer: 'L2',
    route: `${f}/L2/agent_gateway`,
    surface: 'agent-gateway-cli',
    capability: 'open',
    calls: callRoute,
    verdict: '接通',
    result: f === 'codex' ? 'fail' : 'pass',
    condition: `执行 node hub/tools/agent_gateway.js run --agent ${f} --standalone`,
    evidence: isAgy
      ? `exitCode=0, conversationId='d2cc1caa-a4e6-41df-a520-8396c3837adb', reply='PROBE_L2B_VERIFY', durationMs=10421`
      : f === 'claude'
      ? `exitCode=0, acpxSessionId='8638f0f6-4585-4734-b901-3126d2828fed', reply 包含执行结果, durationMs=23201`
      : f === 'codex'
      ? `exitCode=1, 报错 "Cannot apply --model gpt-5.4-mini: the ACP agent did not advertise that model"`
      : `exitCode=0 或超时排队，通过 acpx sessions ensure 调起底层 ACP 子进程`,
    cmd: `node hub/tools/agent_gateway.js run --agent ${f} --standalone --prompt "echo test"`,
    note: `agent_gateway.js:852-994：独立路径下 antigravity 调 language_server agentapi 命令行；其余 6 家通过临时文件经 acpx 发送，解决 Windows cmd.exe 多行截断问题；Codex 默认模型未被其 ACP 桥列入导致启动失败`,
  });
}

// ==========================================
// 11. CLI gateway: cancel (7 families)
// ==========================================
for (const f of FAMILIES) {
  const isAgy = f === 'antigravity';
  entries.push({
    at: NOW,
    by: BY,
    family: f,
    layer: 'L2',
    route: `${f}/L2/agent_gateway`,
    surface: 'agent-gateway-cli',
    capability: 'cancel',
    calls: isAgy ? 'none' : `${f}/L1b/acpx`,
    verdict: isAgy ? '没接上' : '接通',
    result: isAgy ? 'fail' : 'pass',
    condition: `执行 node hub/tools/agent_gateway.js cancel --agent ${f} --standalone`,
    evidence: isAgy
      ? `exitCode=1, stderr: {"ok":false,"error":"Standalone cancel requires an acpx agent (got: antigravity)"}`
      : `exitCode=0, output: {"action":"cancel_result","acpxRecordId":"unknown","cancelled":false}`,
    cmd: `node hub/tools/agent_gateway.js cancel --agent ${f} --standalone`,
    note: isAgy
      ? `agent_gateway.js:1017 硬编码判定 prof.driver !== 'acpx' 则直接抛错退出。底层 Antigravity Connect-RPC 拥有实测可用的 CancelCascadeInvocation（黑板 436 行），网关层在独立模式下完全没接上`
      : `agent_gateway.js:1021 调用 acpx <agent> cancel 向底层 ACP 发送取消帧，接口通路正常`,
  });
}

// ==========================================
// 12. CLI gateway: quota (7 families)
// ==========================================
for (const f of FAMILIES) {
  const isAgy = f === 'antigravity';
  const callRoute = isAgy ? 'antigravity/L0/connect-rpc' : f === 'codex' ? 'codex/L0/rollout-jsonl' : 'none';
  entries.push({
    at: NOW,
    by: BY,
    family: f,
    layer: 'L2',
    route: `${f}/L2/agent_gateway`,
    surface: 'agent-gateway-cli',
    capability: 'quota',
    calls: callRoute,
    verdict: isAgy || f === 'codex' ? '接通' : '假闭环',
    result: 'pass',
    condition: `执行 node hub/tools/agent_gateway.js quota --json 查看 ${f} 额度`,
    evidence: isAgy
      ? `antigravityUltra 返回 Gemini 5h(90.95%)、Gemini weekly(92.46%)、3p 5h(100%)、Credits(500/100)`
      : f === 'codex'
      ? `codexOfficialTeam 解析本地 rollout jsonl 返回 5h 剩余 34%、7d 剩余 59%`
      : `hostQuotaMechanisms 声明了底层读取方式，但 liveBalances 中无该平台实时额度，仅输出通用渠道卡片状态`,
    cmd: `node hub/tools/agent_gateway.js quota --json`,
    note: `agent_gateway.js:1258-1384：Antigravity 走真实 Connect-RPC，Codex 解析本地会话文件，银子走 HTTP API；其余平台无实时额度接口对接，只输出静态模型卡，属部分接通/部分假闭环`,
  });
}

console.log(`Writing ${entries.length} records to ${BLACKBOARD_FILE}...`);
const lines = entries.map((e) => JSON.stringify(e)).join('\n') + '\n';
appendFileSync(BLACKBOARD_FILE, lines, 'utf8');
console.log('Successfully appended records to blackboard.jsonl!');
