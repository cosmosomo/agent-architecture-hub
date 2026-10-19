#!/usr/bin/env node
// The "一群会话" board (trace/apps/cli/src/collab/taskboard.ts) on its own: a fake dispatcher, a temp data folder,
// no agents and no service. Checks the board's decisions — unblock, verify, rework, the stops, the budget.
//   node channels/probe/scripts/test_taskboard.mjs
// The same board inside the service, with real agents, is tested by verify.js (unit "goal").
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { TaskBoard } from '../../../trace/apps/cli/src/collab/taskboard.ts';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hub-taskboard-'));
const sent = []; // every dispatch the board asked for
const full = new Set(); // products the fake pick treats as full
const held = new Map(); // product → why the fake center holds it for now (holdFor)
let n = 0;
const board = new TaskBoard(
  {
    dispatch: async (p) => {
      const d = { id: `dsp_test_${++n}`, status: 'issued', ...p };
      sent.push(d);
      return { id: d.id, status: 'issued' };
    },
    // A fake of the center's pick (gateway/capacity.ts): the first candidate not left out and not full.
    pickChannel: (candidates, exclude = []) => {
      const pool = (candidates?.length ? candidates : ['zcode', 'opencode', 'hermes']).filter((c) => !exclude.includes(c) && !full.has(c));
      return pool.length ? { channel: pool[0], why: `${pool[0]} 空闲` } : { channel: null, why: `都满了或被排除：${[...full, ...exclude].join('、')}` };
    },
    holdFor: (c) => held.get(c) || null,
  },
  dir,
);
const tick = () => new Promise((r) => setTimeout(r, 5));
const deliver = async (d, reply) => {
  board.onDispatch({ id: d.id, status: 'completed', delivery: { at: new Date().toISOString(), summary: reply, reply, files: [] } });
  await tick();
};
const last = () => sent[sent.length - 1];
const results = [];
const check = (name, ok, evidence) => {
  results.push({ name, ok: Boolean(ok), evidence });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : '  ← ' + evidence}`);
};
const taskOf = (g, key) => board.tasksOf(board.getGoal(g.id)).find((t) => t.key === key);

// 1. dependencies and auto verification
{
  const g = board.createGoal({ title: '两步', objective: '先写再测', channel: 'zcode', verifyBy: 'auto', tasks: [{ key: 'a', title: '写' }, { key: 'b', title: '测', dependsOn: ['a'] }] });
  await tick();
  check('只有前置为空的任务先派', sent.length === 1 && taskOf(g, 'b').status === 'blocked', `sent=${sent.length} b=${taskOf(g, 'b').status}`);
  await deliver(last(), 'A 做完了，文件 x.ts');
  check('自动验收通过后下游解封并派出', taskOf(g, 'a').status === 'completed' && taskOf(g, 'b').status === 'dispatched', `a=${taskOf(g, 'a').status} b=${taskOf(g, 'b').status}`);
  check('下游拿到前置任务的交回', last().task.includes('A 做完了'), last().task.slice(0, 200));
  await deliver(last(), 'B 测过了');
  check('全部过验收后目标完成', board.getGoal(g.id).status === 'completed', board.getGoal(g.id).status);
}

// 2. a person's rework, then the same hand-back again stops the task and fuses the goal; retry resumes it
{
  const g = board.createGoal({ title: '返工', objective: '人验收', channel: 'opencode', tasks: [{ key: 'a', title: '写报告', acceptance: '要有数字' }] });
  await tick();
  await deliver(last(), '报告：一切正常');
  const t = taskOf(g, 'a');
  check('人验收时停在 verifying', t.status === 'verifying', t.status);
  board.taskAction(t.id, 'verify', { passed: false, note: '没有数字', rework: '补上具体数字' });
  await tick();
  check('打回后带着返工要求重派到同一会话', t.status === 'dispatched' && last().task.includes('补上具体数字') && last().toSessionName === t.sessionName, `${t.status} ${last().toSessionName}`);
  await deliver(last(), '报告：一切正常');
  board.taskAction(t.id, 'verify', { passed: false, note: '还是没有数字' });
  await tick();
  check('返工后原样交回 → 任务熔断', t.status === 'failed' && /几乎一样/.test(t.fuse || ''), `${t.status} ${t.fuse}`);
  check('任务熔断 → 目标 fused', board.getGoal(g.id).status === 'fused', board.getGoal(g.id).status);
  board.taskAction(t.id, 'reassign', { channel: 'zcode' });
  await tick();
  check('改派后目标恢复、换产品换会话重派', board.getGoal(g.id).status === 'running' && t.status === 'dispatched' && last().toChannel === 'zcode', `${board.getGoal(g.id).status} ${t.status} ${last().toChannel}/${last().toSessionName}`);
}

// 3. another agent verifies: FAIL with a reason → rework; then PASS
{
  const g = board.createGoal({ title: '互验', objective: '写一个函数', channel: 'zcode', verifyBy: 'agent:hermes', tasks: [{ key: 'f', title: '写 add 函数', acceptance: '要有测试' }] });
  await tick();
  await deliver(last(), 'function add(a,b){return a+b}');
  const t = taskOf(g, 'f');
  check('交回后派给验收智能体', last().toChannel === 'hermes' && last().toSessionName.endsWith('-verify') && t.verifierDispatchId === last().id, `${last().toChannel}/${last().toSessionName}`);
  await deliver(last(), 'FAIL\n没有测试，请补一个 add(1,2)===3 的测试');
  check('验收智能体 FAIL → 带理由返工', t.status === 'dispatched' && last().toChannel === 'zcode' && last().task.includes('add(1,2)===3'), `${t.status} ${last().task.slice(-120)}`);
  await deliver(last(), 'function add(a,b){return a+b}\ntest: add(1,2)===3 ok');
  await deliver(last(), 'PASS\n有测试了');
  check('验收智能体 PASS → 完成', t.status === 'completed' && t.verdict.by === 'agent:hermes', `${t.status} ${t.verdict?.by}`);
}

// 4. budget: one dispatch for two ready tasks
{
  const before = sent.length;
  const g = board.createGoal({ title: '预算', objective: '两件并行', channel: 'zcode', budget: { maxDispatches: 1, maxParallel: 2 }, tasks: [{ title: '甲' }, { title: '乙' }] });
  await tick();
  check('派活次数用完 → 只派一个并暂停', sent.length - before === 1 && board.getGoal(g.id).status === 'paused' && /用完/.test(board.getGoal(g.id).reason), `${sent.length - before} ${board.getGoal(g.id).status} ${board.getGoal(g.id).reason}`);
  board.goalAction(g.id, 'resume', { budget: { maxDispatches: 3 } });
  await tick();
  check('加预算恢复后派出剩下的', sent.length - before === 2 && board.getGoal(g.id).status === 'running', `${sent.length - before} ${board.getGoal(g.id).status}`);
}

// 5. a dependency cycle is refused
{
  let err = '';
  try {
    board.createGoal({ title: '环', objective: 'x', channel: 'zcode', tasks: [{ key: 'a', title: 'a', dependsOn: ['b'] }, { key: 'b', title: 'b', dependsOn: ['a'] }] });
  } catch (e) {
    err = e.message;
  }
  check('依赖成环被拒绝', /成环/.test(err), err);
}

// 6. a dispatch that fails twice stops the task
{
  const g = board.createGoal({ title: '失败', objective: 'x', channel: 'zcode', tasks: [{ title: '会失败的' }] });
  await tick();
  const t = board.tasksOf(board.getGoal(g.id))[0];
  board.onDispatch({ id: last().id, status: 'failed', error: '上游 503' });
  await tick();
  check('派活失败一次 → 重派', t.status === 'dispatched' && t.failedDispatches === 1, `${t.status} ${t.failedDispatches}`);
  board.onDispatch({ id: last().id, status: 'failed', error: '上游 503' });
  await tick();
  check('连续两次失败 → 任务熔断、目标 fused', t.status === 'failed' && board.getGoal(g.id).status === 'fused', `${t.status} ${board.getGoal(g.id).status}`);
}

// 6b. "auto": the center picks, waits when nobody is free, and a failure moves the task to another product
{
  full.add('zcode');
  full.add('opencode');
  full.add('hermes');
  const before = sent.length;
  const g = board.createGoal({ title: '自动选', objective: 'x', channel: 'auto', verifyBy: 'auto', tasks: [{ key: 'a', title: '谁空谁做' }] });
  await tick();
  const t = taskOf(g, 'a');
  check('auto 没人空 → 不派、记等待原因、不算派活', sent.length === before && t.status === 'queued' && /都满了/.test(t.waitingWhy || '') && board.getGoal(g.id).usage.dispatches === 0, `${sent.length - before} ${t.status} ${t.waitingWhy}`);
  await board.step();
  check('等待原因没变不重复记轨迹', t.history.filter((h) => h.action === 'waiting_for_channel').length === 1, t.history.map((h) => h.action).join(','));
  full.delete('opencode');
  await board.step();
  check('有人空了 → 选它、轨迹写明为什么', t.status === 'dispatched' && last().toChannel === 'opencode' && t.history.some((h) => h.action === 'channel_picked' && /空闲/.test(h.detail?.why)), `${t.status} ${last().toChannel}`);
  full.clear();
  board.onDispatch({ id: last().id, status: 'failed', error: '429 限流' });
  await tick();
  check('派活失败 → 排除这家、换另一家重派', t.status === 'dispatched' && last().toChannel === 'zcode' && t.auto.excluded.includes('opencode'), `${t.status} ${last().toChannel} ${JSON.stringify(t.auto)}`);
  await deliver(last(), '做完了');
  check('换家后交回、自动验收完成', t.status === 'completed' && t.channel === 'zcode', `${t.status} ${t.channel}`);
}

// 6c. reassign to "auto" with candidates
{
  const g = board.createGoal({ title: '改派自动', objective: 'x', channel: 'zcode', tasks: [{ key: 'a', title: '先给 zcode' }] });
  await tick();
  const t = taskOf(g, 'a');
  for (let i = 0; i < 2; i++) {
    board.onDispatch({ id: last().id, status: 'failed', error: '挂了' });
    await tick();
  }
  board.taskAction(t.id, 'reassign', { channel: 'auto', candidates: ['hermes'] });
  await tick();
  check('改派成 auto 按候选选人', t.status === 'dispatched' && last().toChannel === 'hermes' && t.auto?.candidates[0] === 'hermes', `${t.status} ${last().toChannel}`);
}

// 6d. a used-up quota is not the task's fault: it does not count toward stopping the task; a held product makes it wait
{
  const g = board.createGoal({ title: '额度', objective: 'x', channel: 'hermes', tasks: [{ key: 'a', title: '给 hermes' }] });
  await tick();
  const t = taskOf(g, 'a');
  held.set('hermes', 'Hermes：额度账号 智谱 Coding Plan 用完，06:02 恢复（ZCode 报的）');
  for (let i = 0; i < 3; i++) {
    board.onDispatch({ id: last().id, status: 'failed', error: '1308 已达到 5 小时的使用上限', failureKind: 'quota' });
    await tick();
  }
  check('额度失败不计入任务失败次数、任务不熔断', t.failedDispatches === 0 && t.status === 'queued' && board.getGoal(g.id).status === 'running', `${t.failedDispatches} ${t.status} ${board.getGoal(g.id).status}`);
  check('指定的产品暂停时任务等着、轨迹写原因', /额度账号/.test(t.waitingWhy || '') && t.history.some((h) => h.action === 'waiting_for_channel'), `${t.waitingWhy}`);
  const before = sent.length;
  held.delete('hermes');
  await board.step();
  check('恢复后派出', sent.length === before + 1 && t.status === 'dispatched' && !t.waitingWhy, `${sent.length - before} ${t.status}`);
}

// 7. the view: graph and trajectory
{
  const g = board.listGoals().find((x) => x.title === '两步');
  const v = board.view(g.id);
  check('图：两个任务、一条依赖边、下游深度 1', v.graph.edges.some((e) => e.type === 'depends_on') && v.graph.nodes.find((x) => x.key === 'b')?.depth === 1, JSON.stringify(v.graph.edges));
  check('轨迹按时间排、有派活和完成', v.trajectory.some((h) => h.action === 'dispatch_issued') && v.trajectory.some((h) => h.action === 'goal_completed'), v.trajectory.map((h) => h.action).join(','));
}

// 8. a fresh board reads everything back from disk
{
  const again = new TaskBoard({ dispatch: async () => ({ id: 'x', status: 'issued' }) }, dir);
  check('重启后从磁盘读回', again.listGoals().length === board.listGoals().length, `${again.listGoals().length} vs ${board.listGoals().length}`);
}

const bad = results.filter((r) => !r.ok);
console.log(`\n${results.length - bad.length}/${results.length} 过；数据在 ${dir}`);
process.exit(bad.length ? 1 : 0);
