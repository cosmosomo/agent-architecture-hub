#!/usr/bin/env node
// Goals written from test questions and matrix gaps (hub/tools/goal_gen.js), checked without submitting anything.
//   node channels/probe/scripts/test_goal_gen.mjs
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { generate, renderTest } = require('../../../hub/tools/goal_gen.js');

const results = [];
const check = (name, ok, evidence) => {
  results.push(ok);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : '  ← ' + evidence}`);
};
const args = (s) => {
  const a = { _: [] };
  const t = s.split(' ');
  for (let i = 0; i < t.length; i++) {
    if (t[i].startsWith('--')) a[t[i].slice(2)] = t[i + 1] && !t[i + 1].startsWith('--') ? t[++i] : true;
    else a._.push(t[i]);
  }
  return a;
};

{
  const q = renderTest('resume', 'zcode', 'TOK1');
  check('出题：占位都填上了', q && !/\{(agent|token|session)\}/.test(q.lines.join('\n') + q.record) && q.lines.join('\n').includes('TOK1') && q.lines.join('\n').includes('test-zcode'), q && q.lines.join(' ').slice(0, 200));
}
{
  const g = generate(args('goal-gen test --agents doubao,zcode --units open,resume'));
  check('测试目标：每家一个任务，派给测试员、固定会话', g.tasks.length === 2 && g.tasks.every((t) => t.channel === 'zcode' && t.session === `tester-${t.key.replace('test-', '')}` && t.verifyBy === 'agent:claude'), JSON.stringify(g.tasks.map((t) => [t.key, t.channel, t.session])));
  check('测试目标：验收就是题里的“通过”，并要求用 bb find 核对', g.tasks.every((t) => /open：/.test(t.acceptance) && /resume：/.test(t.acceptance) && /bb find/.test(t.acceptance)), g.tasks[0].acceptance.slice(0, 200));
  check('测试目标：任务说明带着用户原话和完整题目', /用户的原话/.test(g.tasks[0].goal) && /恢复会话|resume/.test(g.tasks[0].goal) && /记录：/.test(g.tasks[0].goal), g.tasks[0].goal.slice(0, 200));
}
{
  let err = '';
  try {
    generate(args('goal-gen test --agents zcode --units no-such-unit'));
  } catch (e) {
    err = e.message;
  }
  check('没有题的单元被拒绝', /还没有测试题/.test(err), err);
}
{
  const g = generate(args('goal-gen gaps --kind build --limit 1'));
  const dev = g.tasks.find((t) => t.key.startsWith('build-'));
  const tests = g.tasks.filter((t) => t.key.startsWith('test-'));
  check('开发目标：一个开发任务，后面每家一个依赖它的测试任务', dev && tests.length >= 1 && tests.every((t) => t.dependsOn?.includes(dev.key)), JSON.stringify(g.tasks.map((t) => [t.key, t.dependsOn])));
  check('开发目标：开发说明里带着验收用的测试题', dev && /测试题/.test(dev.goal) && /通过：/.test(dev.goal), dev && dev.goal.slice(0, 200));
}
{
  const g = generate(args('goal-gen gaps --kind research'));
  check('研究目标：三片研究员回到各自的主会话', g.tasks.map((t) => `${t.channel}/${t.session}`).join(',') === 'antigravity/research-frontier,codex/research-codex,zcode/research-acp', g.tasks.map((t) => `${t.channel}/${t.session}`).join(','));
}

console.log(`\n${results.filter(Boolean).length}/${results.length} 过`);
process.exit(results.every(Boolean) ? 0 : 1);
