// Generates a retest prompt from the blackboard: every cell whose latest record is still "unverified".
// Usage: node gen_retest.js <writer-name> <out-file> <family> [<family>...] [--skip route|capability ...]
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const skipAt = args.indexOf('--skip');
const skip = skipAt >= 0 ? args.splice(skipAt).slice(1) : [];
const [writer, outFile, ...families] = args;
const dir = path.resolve(__dirname, '..');

const rows = fs
  .readFileSync(path.join(dir, 'blackboard.jsonl'), 'utf8')
  .split(/\r?\n/)
  .filter((l) => l.trim())
  .map((l, i) => ({ ...JSON.parse(l), _line: i + 1 }));
const canon = (r) => (/^[\w-]+\/L\w+\/\S+$/.test(r.route) ? r.route : `${r.family}/${r.layer}/${r.surface}`);
const latest = new Map();
for (const r of rows) latest.set(`${r.family}|${canon(r)}|${r.capability}`, { ...r, route: canon(r) });
const cells = [...latest.values()].filter(
  (r) => r.result === 'unverified' && families.includes(r.family) && !skip.includes(`${r.route}|${r.capability}`),
);

const ROOT = 'E:\\program\\GIT\\Agent\\multi\\Agent-Architecture-Hub';
const lines = [
  '你是复测员。下面每一格之前已有人测过，但证据不足，结论记成了“未验证”。你的任务是把这些格子逐一测到有原始证据为止，或者确认做不到。',
  '',
  `任务书（规矩、能力定义、黑板格式）：${ROOT}\\channels\\probe\\README.md，先读第 3.2、六、七、八节。架构与各家入口：${ROOT}\\channels\\README.md 的“立体认知”“链路”“各产品的入口”三节。各家的环境变量以 hub\\tools\\agent_gateway.js 里该家的 buildEnv 为准。`,
  '',
  '硬规矩（违反任何一条，这一格就不算数）：',
  '1. 证据必须是这次调用的原始输出片段：返回 JSON、报错原文、会话编号、日志或数据库行。不许写描述句，不许用脚本自己打的成功标签（如 FORK_OK）。',
  '2. 结论只看效果，不看接口返回“成功”：续接/分叉要在新会话里问出原会话里的暗号；整理要看到上下文用量下降；选模型/切模型要看到本地库、日志或返回元数据里这一轮实际用的模型；审批要在一轮中途收到审批请求原文，并记录答复后它做没做那件事；插话要看到插入的话在本轮内体现；状态要拿到区分“工作中/空闲”的字段原文。',
  '3. 每条命令、每个脚本都有超时（90 秒以内）；脚本先把已得到的结果写盘再等下一步。守护进程（app-server、serve 等）在脚本里自己起、用完自己关，不当普通命令放后台等它结束。从程序里调用命令行时关闭标准输入（opencode run 不关会永久阻塞）。',
  '4. 只操作你自己新建的 probe- 会话；不碰别的会话，不关、不重启任何桌面端，不改全局配置，不安装、不升级包。被测的一方用最便宜的可用模型。',
  '5. 做不到就如实记 fail 或 n/a，写清断在哪一步、报错原文；查不出原因写“原因未知”。',
  '',
  '要复测的格子（route · capability · 原记录行号 · 为什么之前不算数）：',
  '',
];
for (const fam of families) {
  const fc = cells.filter((c) => c.family === fam);
  if (!fc.length) continue;
  lines.push(`## ${fam}（${fc.length} 格）`, '');
  for (const c of fc) lines.push(`- ${c.route} · ${c.capability} · 行 ${c._line} · ${String(c.note || c.evidence).replace(/\s+/g, ' ').slice(0, 140)}`);
  lines.push('');
}
lines.push(
  '产出：',
  `1. 每格追加一行到 channels\\probe\\blackboard.jsonl（任务书第七节格式；by 写 "${writer}"；route 照上面写；condition 写清条件）。`,
  `2. 脚本放 channels\\probe\\scripts\\retest\\。`,
  `3. 报告：channels\\probe\\results\\${writer}-retest.md，按家列出每格的新结论和证据位置。`,
  '4. 最终回复不超过 20 行：每家通/断/仍未验证各几格，以及需要负责人判断的事。',
);
fs.writeFileSync(outFile, lines.join('\n'), 'utf8');
console.log(`${outFile}: ${cells.length} cells (${families.join(', ')})`);
