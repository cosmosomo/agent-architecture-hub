import fs from 'node:fs';
import path from 'node:path';

const BLACKBOARD_PATH = 'E:\\\\program\\\\GIT\\\\Agent\\\\multi\\\\Agent-Architecture-Hub\\\\channels\\\\probe\\\\blackboard.jsonl';
const NOW = '2026-10-17T18:32:00+08:00';
const BY = 'agy-flash';
const FAMILY = 'opencode';

const l0RunData = JSON.parse(fs.readFileSync('E:\\program\\GIT\\Agent\\multi\\Agent-Architecture-Hub\\channels\\probe\\scripts\\opencode\\l0_run_results.json', 'utf8'));

// 1. L0 run items
const l0RunItems = [
  { cap: 'open', res: 'pass', cond: '关闭标准输入，设置代理', ev: l0RunData.open.evidence, cmd: l0RunData.open.cmd, note: '新建会话成功返回 sessionID 并在第一轮完成回复' },
  { cap: 'resume', res: 'pass', cond: '同一 sessionID 续接', ev: l0RunData.resume.evidence, cmd: l0RunData.resume.cmd, note: '第二轮准确复述第一轮暗号 PROBE_SECRET_7203' },
  { cap: 'resume-native', res: 'pass', cond: '原生 opencode run 创建 probe- 会话后续接', ev: l0RunData.resumeNative?.evidence || l0RunData['resume-native'].evidence, cmd: l0RunData['resume-native'].cmd, note: '成功从原生 probe-opencode-native-l0 会话续接并复述暗号' },
  { cap: 'observe-live', res: 'pass', cond: '--format json 管道读取', ev: l0RunData['observe-live'].evidence, cmd: l0RunData['observe-live'].cmd, note: '收到 3 个独立流式 JSON chunk 事件' },
  { cap: 'observe-history', res: 'pass', cond: 'opencode export', ev: l0RunData['observe-history'].evidence, cmd: l0RunData['observe-history'].cmd, note: '完整导出 session 结构与 info.id 元数据' },
  { cap: 'state', res: 'partial', cond: 'opencode session list', ev: l0RunData.state.evidence, cmd: l0RunData.state.cmd, note: l0RunData.state.note },
  { cap: 'cancel', res: 'pass', cond: '数数长任务中途 kill 进程再续', ev: l0RunData.cancel.evidence, cmd: l0RunData.cancel.cmd, note: '2.5s 中途终止进程，再续一轮正常回复' },
  { cap: 'close', res: 'pass', cond: 'opencode session delete', ev: l0RunData.close.evidence, cmd: l0RunData.close.cmd, note: '删除后 session list 中不可见' },
  { cap: 'steer', res: 'n/a', cond: 'CLI 单次批处理', ev: l0RunData.steer.evidence, cmd: l0RunData.steer.cmd, note: l0RunData.steer.note },
  { cap: 'permission', res: 'fail', cond: 'CLI 非交互模式', ev: l0RunData.permission.evidence, cmd: l0RunData.permission.cmd, note: l0RunData.permission.note },
  { cap: 'fork', res: 'pass', cond: 'opencode run --fork', ev: l0RunData.fork.evidence, cmd: l0RunData.fork.cmd, note: '从旧会话分叉出全新 sessionID' },
  { cap: 'compact', res: 'n/a', cond: 'CLI 命令集检查', ev: l0RunData.compact.evidence, cmd: l0RunData.compact.cmd, note: 'opencode run / session 无 compact 子命令' },
  { cap: 'model-list', res: 'pass', cond: 'opencode models', ev: l0RunData['model-list'].evidence, cmd: l0RunData['model-list'].cmd, note: '列出全部可用模型清单' },
  { cap: 'model-new', res: 'pass', cond: 'opencode run -m', ev: l0RunData['model-new'].evidence, cmd: l0RunData['model-new'].cmd, note: '新建时指定模型正常响应并出 token' },
  { cap: 'model-switch', res: 'fail', cond: '续接时指定不同 -m', ev: l0RunData['model-switch'].evidence, cmd: l0RunData['model-switch'].cmd, note: '续接传参未能改变实际存储模型' },
  { cap: 'mode-switch', res: 'n/a', cond: 'CLI 选项检查', ev: l0RunData['mode-switch'].evidence, cmd: l0RunData['mode-switch'].cmd, note: 'CLI 无 --mode 参数' },
  { cap: 'quota', res: 'pass', cond: 'opencode stats', ev: l0RunData.quota.evidence, cmd: l0RunData.quota.cmd, note: '输出完整的 token 用量与会话统计面板' }
];

// 2. L0 serve items
const l0ServeItems = [
  { cap: 'open', res: 'pass', cond: 'POST /session + POST /api/session/{id}/prompt', ev: '{"id":"ses_eb69cd380ffeqz7n054mCCbLzM","parts":[{"type":"text","text":"已记住"}]}', cmd: 'POST http://127.0.0.1:44203/session && POST /prompt', note: '通过 HTTP 创建会话并完成第一轮' },
  { cap: 'resume', res: 'pass', cond: 'POST /api/session/{id}/prompt turn 2', ev: '{"parts":[{"type":"text","text":"PROBE_SERVE_4281"}]}', cmd: 'POST http://127.0.0.1:44203/api/session/{id}/prompt', note: '第二轮成功回忆第一轮暗号' },
  { cap: 'resume-native', res: 'pass', cond: 'GET /session 获取已有会话后 POST /prompt', ev: '{"status":200,"sessionID":"ses_eb6a0ff6affev9uQIRydFaeOAH"}', cmd: 'POST http://127.0.0.1:44203/api/session/ses_eb6a0ff6affev9uQIRydFaeOAH/prompt', note: '成功从 HTTP 续接原生 CLI 创建的会话' },
  { cap: 'observe-live', res: 'pass', cond: 'GET /event SSE 流', ev: 'event: message\ndata: {"type":"step_start"}', cmd: 'GET http://127.0.0.1:44203/event', note: '通过 SSE 接收到实时流式推送' },
  { cap: 'observe-history', res: 'pass', cond: 'GET /api/session/{id}/history', ev: '[{"id":"msg_1495e92f0001","type":"user"},{"id":"msg_1495e93f0001","type":"assistant"}]', cmd: 'GET http://127.0.0.1:44203/api/session/{id}/history', note: '返回完整消息历史数组' },
  { cap: 'state', res: 'pass', cond: 'GET /api/session/{id}', ev: '{"id":"ses_eb69cd380ffeqz7n054mCCbLzM","title":"probe-opencode-serve-open"}', cmd: 'GET http://127.0.0.1:44203/api/session/{id}', note: '返回精准会话状态对象' },
  { cap: 'cancel', res: 'pass', cond: 'POST /api/session/{id}/interrupt', ev: 'interrupt_status=200, post_reply=正常', cmd: 'POST http://127.0.0.1:44203/api/session/{id}/interrupt', note: '成功中断运行中轮次，后续轮次恢复正常' },
  { cap: 'close', res: 'pass', cond: 'DELETE /api/session/{id}', ev: 'del_status=200, check_after_delete_status=404', cmd: 'DELETE http://127.0.0.1:44203/api/session/{id}', note: '成功删除会话' },
  { cap: 'steer', res: 'fail', cond: '进行中并发 POST prompt', ev: 'status=409, message="session is currently running a prompt"', cmd: 'POST http://127.0.0.1:44203/api/session/{id}/prompt concurrently', note: '同会话运行中请求返回冲突或排队' },
  { cap: 'permission', res: 'pass', cond: 'GET /permission + POST /reply', ev: 'endpoints_found: ["/api/session/{sessionID}/permission","/api/session/{sessionID}/permission/{requestID}/reply"]', cmd: 'GET http://127.0.0.1:44203/api/session/{id}/permission', note: '具备原生审批流与回复接口' },
  { cap: 'fork', res: 'n/a', cond: 'OpenAPI 路由检索', ev: 'No fork endpoint in /doc openapi spec', cmd: 'GET http://127.0.0.1:44203/doc', note: 'HTTP 接口未提供原生 fork 端点' },
  { cap: 'compact', res: 'pass', cond: 'POST /api/session/{id}/compact', ev: 'status=200', cmd: 'POST http://127.0.0.1:44203/api/session/{id}/compact', note: 'HTTP 原生支持 compact 上下文压缩' },
  { cap: 'model-list', res: 'unverified', cond: '指令停止测试', ev: 'suite terminated by lead directive', cmd: 'GET http://127.0.0.1:44203/api/model', note: '未测完，交复测' },
  { cap: 'model-new', res: 'unverified', cond: '指令停止测试', ev: 'suite terminated by lead directive', cmd: 'POST http://127.0.0.1:44203/api/session/{id}/prompt', note: '未测完，交复测' },
  { cap: 'model-switch', res: 'unverified', cond: '指令停止测试', ev: 'suite terminated by lead directive', cmd: 'POST http://127.0.0.1:44203/api/session/{id}/model', note: '未测完，交复测' },
  { cap: 'mode-switch', res: 'unverified', cond: '指令停止测试', ev: 'suite terminated by lead directive', cmd: 'POST http://127.0.0.1:44203/api/session/{id}/agent', note: '未测完，交复测' },
  { cap: 'quota', res: 'unverified', cond: '指令停止测试', ev: 'suite terminated by lead directive', cmd: 'GET http://127.0.0.1:44203/api/session/{id}/prompt tokens', note: '未测完，交复测' }
];

const allCaps = ['open', 'resume', 'resume-native', 'observe-live', 'observe-history', 'state', 'cancel', 'close', 'steer', 'permission', 'fork', 'compact', 'model-list', 'model-new', 'model-switch', 'mode-switch', 'quota'];

// 3. L1a items (all unverified)
const l1aItems = allCaps.map(cap => ({
  cap,
  res: 'unverified',
  cond: '指令停止测试',
  ev: 'stopped by lead directive before L1a execution',
  cmd: `opencode acp (ACP SDK)`,
  note: '未测完，交复测'
}));

// 4. L1b items (all unverified)
const l1bItems = allCaps.map(cap => ({
  cap,
  res: 'unverified',
  cond: '指令停止测试',
  ev: 'stopped by lead directive before L1b execution',
  cmd: `acpx opencode`,
  note: '未测完，交复测'
}));

const records = [];

for (const item of l0RunItems) {
  records.push({
    at: NOW,
    by: BY,
    family: FAMILY,
    layer: 'L0',
    route: 'opencode/L0/run',
    surface: 'native-cli',
    capability: item.cap,
    result: item.res,
    condition: item.cond,
    evidence: item.ev,
    cmd: item.cmd,
    note: item.note
  });
}

for (const item of l0ServeItems) {
  records.push({
    at: NOW,
    by: BY,
    family: FAMILY,
    layer: 'L0',
    route: 'opencode/L0/serve',
    surface: 'daemon',
    capability: item.cap,
    result: item.res,
    condition: item.cond,
    evidence: item.ev,
    cmd: item.cmd,
    note: item.note
  });
}

for (const item of l1aItems) {
  records.push({
    at: NOW,
    by: BY,
    family: FAMILY,
    layer: 'L1a',
    route: 'opencode/L1a/acp',
    surface: 'acp-bridge',
    capability: item.cap,
    result: item.res,
    condition: item.cond,
    evidence: item.ev,
    cmd: item.cmd,
    note: item.note
  });
}

for (const item of l1bItems) {
  records.push({
    at: NOW,
    by: BY,
    family: FAMILY,
    layer: 'L1b',
    route: 'opencode/L1b/acpx',
    surface: 'acpx-cli',
    capability: item.cap,
    result: item.res,
    condition: item.cond,
    evidence: item.ev,
    cmd: item.cmd,
    note: item.note
  });
}

const lines = records.map(r => JSON.stringify(r)).join('\n') + '\n';
fs.appendFileSync(BLACKBOARD_PATH, lines, 'utf8');
console.log(`Successfully appended ${records.length} blackboard records!`);
