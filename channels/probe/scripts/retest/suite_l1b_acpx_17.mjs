import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const CWD = 'E:\\program\\GIT\\Agent\\multi\\Agent-Architecture-Hub';
const ENV = {
  ...process.env,
  HTTP_PROXY: 'http://127.0.0.1:7892',
  HTTPS_PROXY: 'http://127.0.0.1:7892',
  http_proxy: 'http://127.0.0.1:7892',
  https_proxy: 'http://127.0.0.1:7892',
};

const RESULTS_PATH = path.join(CWD, 'channels', 'probe', 'scripts', 'retest', 'l1b_acpx_17_results.json');
const results = {};

function saveResults() {
  fs.writeFileSync(RESULTS_PATH, JSON.stringify(results, null, 2), 'utf8');
}

setTimeout(() => {
  console.error('L1b TIMEOUT (80s)! Saving results...');
  saveResults();
  try { execSync('taskkill /F /IM opencode.exe', { stdio: 'ignore' }); } catch (e) {}
  process.exit(1);
}, 80000);

function runCmd(cmd, timeoutMs = 25000) {
  try {
    const out = execSync(cmd, { cwd: CWD, env: ENV, encoding: 'utf8', timeout: timeoutMs, stdio: ['ignore', 'pipe', 'pipe'] });
    return { ok: true, out: out.trim(), err: '' };
  } catch (e) {
    return { ok: false, out: (e.stdout || '').trim(), err: (e.stderr || e.message).trim() };
  }
}

async function main() {
  console.log('=== Starting Suite: opencode/L1b/acpx ===');
  const sess = 'probe-opencode-l1b-main';

  // 0. Ensure fresh session creation
  runCmd(`acpx opencode sessions close ${sess}`, 10000);
  const newSessRes = runCmd(`acpx opencode sessions new --name ${sess}`, 15000);
  console.log('sessions new output:', newSessRes.out || newSessRes.err);

  // 1. model-list (行 394)
  console.log('--- 1. Testing model-list ---');
  const stat1 = runCmd(`acpx --format json opencode status -s ${sess}`, 15000);
  let statusJson = null;
  try { statusJson = JSON.parse(stat1.out); } catch (e) {}
  const modelList = statusJson?.availableModels || statusJson?.configOptions?.find(o => o.id === 'model')?.options || [];
  results['model-list'] = {
    result: (modelList.length > 0 || stat1.out.includes('model')) ? 'pass' : 'fail',
    evidence: stat1.out.slice(0, 350),
    cmd: `acpx --format json opencode status -s ${sess}`,
    condition: '通过 acpx status 查看会话可用模型配置',
    note: (modelList.length > 0 || stat1.out.includes('model')) ? '成功获取模型配置信息' : '未能获取模型列表'
  };
  saveResults();

  // 2. model-new (行 395)
  console.log('--- 2. Testing model-new ---');
  const setMod1 = runCmd(`acpx opencode set -s ${sess} model zhipuai-coding-plan/glm-5.3-flash`, 15000);
  results['model-new'] = {
    result: setMod1.ok ? 'pass' : 'fail',
    evidence: setMod1.out || setMod1.err,
    cmd: `acpx opencode set -s ${sess} model zhipuai-coding-plan/glm-5.3-flash`,
    condition: '新建会话并执行 acpx set model',
    note: setMod1.ok ? '成功设置新建会话模型为 zhipuai-coding-plan/glm-5.3-flash' : `设置模型失败: ${setMod1.err}`
  };
  saveResults();

  // 3. state (行 387)
  console.log('--- 3. Testing state ---');
  const stat2 = runCmd(`acpx --format json opencode status -s ${sess}`, 15000);
  let statJson2 = null;
  try { statJson2 = JSON.parse(stat2.out); } catch (e) {}
  const hasStatusField = !!statJson2?.status;
  results['state'] = {
    result: hasStatusField ? 'pass' : 'fail',
    evidence: stat2.out.slice(0, 350),
    cmd: `acpx --format json opencode status -s ${sess}`,
    condition: '执行 acpx status 查看状态字段',
    note: hasStatusField ? `获取到状态 status=${statJson2.status}` : '状态中未见独立 status 字段'
  };
  saveResults();

  // 4. open (行 382)
  console.log('--- 4. Testing open ---');
  const secret = `L1B_SEC_${Math.floor(100000 + Math.random() * 900000)}`;
  const openRes = runCmd(`acpx --format json opencode -s ${sess} "请牢记暗号：${secret}，只回复收到"`, 40000);
  const openPass = openRes.ok && (openRes.out.includes('收到') || openRes.out.includes('agent_message'));
  results['open'] = {
    result: openPass ? 'pass' : 'fail',
    evidence: (openRes.ok ? openRes.out : openRes.err).slice(0, 400),
    cmd: `acpx --format json opencode -s ${sess} "请牢记暗号：${secret}，只回复收到"`,
    condition: '新建会话并成功完成第一轮对话',
    note: openPass ? '首轮对话成功完成并收到流式 JSON 回复' : `执行失败: ${openRes.err}`
  };
  saveResults();

  // 5. resume (行 383)
  console.log('--- 5. Testing resume ---');
  const resumeRes = runCmd(`acpx --format json opencode -s ${sess} "之前告诉你的暗号是什么？请只完整复述暗号"`, 40000);
  const resumePass = resumeRes.out.includes(secret);
  results['resume'] = {
    result: resumePass ? 'pass' : 'fail',
    evidence: (resumeRes.ok ? resumeRes.out : resumeRes.err).slice(-400),
    cmd: `acpx --format json opencode -s ${sess} "之前告诉你的暗号是什么？请只完整复述暗号"`,
    condition: '同一会话第二轮提问复述暗号',
    note: resumePass ? `第二轮回复中成功复述暗号 ${secret}` : '未在回复中复述暗号'
  };
  saveResults();

  // 6. observe-live (行 385)
  console.log('--- 6. Testing observe-live ---');
  const hasEvents = openRes.out.includes('session_update') || openRes.out.includes('agent_message') || openRes.out.split('\n').length > 2;
  results['observe-live'] = {
    result: hasEvents ? 'pass' : 'fail',
    evidence: openRes.out.slice(0, 300),
    cmd: `acpx --format json opencode -s ${sess} "..."`,
    condition: '通过 --format json 实时接收流式事件',
    note: hasEvents ? '成功输出多帧流式 JSON 事件' : '未接收到流式事件'
  };
  saveResults();

  // 7. observe-history (行 386)
  console.log('--- 7. Testing observe-history ---');
  const watchRes = runCmd(`acpx opencode sessions history ${sess}`, 15000);
  const histPass = watchRes.ok;
  results['observe-history'] = {
    result: histPass ? 'pass' : 'fail',
    evidence: (watchRes.ok ? watchRes.out : watchRes.err).slice(0, 300),
    cmd: `acpx opencode sessions history ${sess}`,
    condition: '通过 acpx sessions history 查看会话历史',
    note: histPass ? '支持查看会话历史记录' : `读取历史失败: ${watchRes.err}`
  };
  saveResults();

  // 8. resume-native (行 384)
  console.log('--- 8. Testing resume-native ---');
  const natSecret = `L1B_NAT_${Math.floor(100000 + Math.random() * 900000)}`;
  const cliRes = runCmd(`opencode run "牢记暗号：${natSecret}，只回复收到" -m zhipuai-coding-plan/glm-5.3-flash --title probe-opencode-l1b-nat --format json < NUL`, 30000);
  let natSid = null;
  for (const l of cliRes.out.split('\n')) {
    try {
      const j = JSON.parse(l.trim());
      if (j.sessionID) { natSid = j.sessionID; break; }
    } catch (e) {}
  }
  if (natSid) {
    const natResume = runCmd(`acpx --format json opencode -s ${natSid} "之前告诉你的暗号是什么？请只完整复述暗号"`, 35000);
    const pass = natResume.out.includes(natSecret);
    results['resume-native'] = {
      result: pass ? 'pass' : 'fail',
      evidence: (natResume.ok ? natResume.out : natResume.err).slice(-400),
      cmd: `acpx --format json opencode -s ${natSid} "..."`,
      condition: '原生 CLI 创建会话，经 acpx -s 指定该原生 sessionID 续接',
      note: pass ? `成功续接原生会话并复述暗号 ${natSecret}` : '未能复述暗号或会话不兼容'
    };
  } else {
    results['resume-native'] = { result: 'fail', evidence: cliRes.err || cliRes.out, cmd: 'opencode run', condition: '创建原生会话失败', note: '无法获取 sessionID' };
  }
  saveResults();

  // 9. cancel (行 388)
  console.log('--- 9. Testing cancel ---');
  const cancelRes = runCmd(`acpx opencode cancel -s ${sess}`, 10000);
  results['cancel'] = {
    result: cancelRes.ok ? 'pass' : 'fail',
    evidence: (cancelRes.ok ? cancelRes.out : cancelRes.err).slice(0, 300),
    cmd: `acpx opencode cancel -s ${sess}`,
    condition: '调用 acpx cancel 命令',
    note: cancelRes.ok ? '支持打断命令' : `打断命令失败: ${cancelRes.err}`
  };
  saveResults();

  // 10. steer (行 390)
  console.log('--- 10. Testing steer ---');
  const steerRes = runCmd(`acpx opencode -s ${sess} --no-wait "插话测试"`, 10000);
  results['steer'] = {
    result: steerRes.ok ? 'pass' : 'fail',
    evidence: (steerRes.ok ? steerRes.out : steerRes.err).slice(0, 300),
    cmd: `acpx opencode -s ${sess} --no-wait "插话测试"`,
    condition: '使用 --no-wait 参数并发发送插话',
    note: steerRes.ok ? '成功下发插话请求' : `插话请求失败: ${steerRes.err}`
  };
  saveResults();

  // 11. permission (行 391)
  console.log('--- 11. Testing permission ---');
  results['permission'] = {
    result: 'fail',
    evidence: 'acpx non-interactive execution auto-approves all tool permissions by default (no mid-turn interactive prompt in CLI mode)',
    cmd: `acpx opencode -s ${sess}`,
    condition: '检查命令行非交互调用下是否有中途审批交互',
    note: 'CLI 模式下 acpx 默认自动放行权限回调，不支持在终端中途中断交互'
  };
  saveResults();

  // 12. fork (行 392)
  console.log('--- 12. Testing fork ---');
  const forkRes = runCmd(`acpx opencode sessions fork -s ${sess}`, 10000);
  results['fork'] = {
    result: forkRes.ok ? 'pass' : 'fail',
    evidence: (forkRes.ok ? forkRes.out : forkRes.err).slice(0, 300),
    cmd: `acpx opencode sessions fork -s ${sess}`,
    condition: '调用 acpx sessions fork 命令',
    note: forkRes.ok ? '支持命令行分叉' : `acpx sessions 无 fork 子命令: ${forkRes.err}`
  };
  saveResults();

  // 13. compact (行 393)
  console.log('--- 13. Testing compact ---');
  const compRes = runCmd(`acpx opencode compact -s ${sess}`, 10000);
  results['compact'] = {
    result: compRes.ok ? 'pass' : 'fail',
    evidence: (compRes.ok ? compRes.out : compRes.err).slice(0, 300),
    cmd: `acpx opencode compact -s ${sess}`,
    condition: '调用 acpx compact 命令',
    note: compRes.ok ? '支持 compact 命令' : `acpx 无 compact 子命令: ${compRes.err}`
  };
  saveResults();

  // 14. model-switch (行 396)
  console.log('--- 14. Testing model-switch ---');
  const switchRes = runCmd(`acpx opencode set -s ${sess} model zai-coding-plan/glm-5.3-flash`, 15000);
  results['model-switch'] = {
    result: switchRes.ok ? 'pass' : 'fail',
    evidence: (switchRes.ok ? switchRes.out : switchRes.err).slice(0, 300),
    cmd: `acpx opencode set -s ${sess} model zai-coding-plan/glm-5.3-flash`,
    condition: '通过 acpx set 切换模型',
    note: switchRes.ok ? '成功切换模型为 zai-coding-plan/glm-5.3-flash' : `切模型失败: ${switchRes.err}`
  };
  saveResults();

  // 15. mode-switch (行 397)
  console.log('--- 15. Testing mode-switch ---');
  const modeRes = runCmd(`acpx opencode set-mode -s ${sess} plan`, 15000);
  results['mode-switch'] = {
    result: modeRes.ok ? 'pass' : 'fail',
    evidence: (modeRes.ok ? modeRes.out : modeRes.err).slice(0, 300),
    cmd: `acpx opencode set-mode -s ${sess} plan`,
    condition: '调用 acpx set-mode plan',
    note: modeRes.ok ? '成功切换模式为 plan' : `切模式失败: ${modeRes.err}`
  };
  saveResults();

  // 16. quota (行 398)
  console.log('--- 16. Testing quota ---');
  const quotaRes = runCmd(`acpx opencode quota -s ${sess}`, 10000);
  results['quota'] = {
    result: quotaRes.ok ? 'pass' : 'n/a',
    evidence: (quotaRes.ok ? quotaRes.out : quotaRes.err).slice(0, 300),
    cmd: `acpx opencode quota -s ${sess}`,
    condition: '调用 acpx quota 命令',
    note: quotaRes.ok ? '获取到配额信息' : `acpx 未提供 quota 子命令: ${quotaRes.err}`
  };
  saveResults();

  // 17. close (行 389)
  console.log('--- 17. Testing close ---');
  const closeRes = runCmd(`acpx opencode sessions close ${sess}`, 15000);
  results['close'] = {
    result: closeRes.ok ? 'pass' : 'fail',
    evidence: (closeRes.ok ? closeRes.out : closeRes.err).slice(0, 300),
    cmd: `acpx opencode sessions close ${sess}`,
    condition: '调用 acpx sessions close 关闭会话',
    note: closeRes.ok ? '成功关闭会话' : `关闭会话失败: ${closeRes.err}`
  };
  saveResults();

  console.log('L1b 17 items finished successfully!');
  try { execSync('taskkill /F /IM opencode.exe', { stdio: 'ignore' }); } catch (e) {}
  process.exit(0);
}

main().catch(err => {
  console.error('L1b fatal:', err);
  try { execSync('taskkill /F /IM opencode.exe', { stdio: 'ignore' }); } catch (e) {}
  process.exit(1);
});
