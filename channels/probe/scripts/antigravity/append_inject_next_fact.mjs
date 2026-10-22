import fs from 'node:fs';
import path from 'node:path';

const record = {
  at: new Date().toISOString(),
  by: 'antigravity',
  family: 'antigravity',
  layer: 'L0',
  route: 'antigravity/L0/connect-rpc',
  surface: 'daemon',
  capability: 'inject-next',
  result: 'pass',
  condition: '首轮运行 6s powershell 命令期间调 SendUserCascadeMessage with MESSAGE_DELIVERY_STRATEGY_WHEN_IDLE',
  evidence: "会话 4fc25e9e-6bb4-467c-a944-bcdad100921a 在 CASCADE_RUN_STATUS_RUNNING(not_fully_idle=1) 期间注入，RPC 立即返回 200 {} 入队；首轮命令未被打断执行完毕产出 FINISHED_TURN_1；语言服务在首轮完全平稳进入 IDLE 后自动提升队列消息为独立第二轮 Step 4 USER_INPUT，自动唤醒执行次轮 Step 5 产出 '999 * 111 = 110889. TOKEN_WHEN_IDLE_PASS'；对照组 NEXT_INVOCATION 则在当前轮下一模型步就地插话回复",
  cmd: 'node channels/probe/scripts/antigravity/test_inject_next_delivery.mjs',
  note: '【行为级闭环证据】彻底证实 Antigravity 原生支持基于 MESSAGE_DELIVERY_STRATEGY_WHEN_IDLE 的跨轮排队注入（inject-next）；两轮边界清晰无损执行'
};

const bbPath = path.resolve('channels/probe/blackboard.jsonl');
fs.appendFileSync(bbPath, JSON.stringify(record) + '\n', { encoding: 'utf8' });
console.log('Appended inject-next behavioral pass record to blackboard.jsonl');
