import { spawn, execSync } from 'node:child_process';
import { Readable, Writable } from 'node:stream';
import path from 'node:path';
import fs from 'node:fs';

const CWD = 'E:\\program\\GIT\\Agent\\multi\\Agent-Architecture-Hub';
const ENV = {
  ...process.env,
  HTTP_PROXY: 'http://127.0.0.1:7892',
  HTTPS_PROXY: 'http://127.0.0.1:7892',
  http_proxy: 'http://127.0.0.1:7892',
  https_proxy: 'http://127.0.0.1:7892',
};

const sdkPath = path.join(process.env.APPDATA, 'npm', 'node_modules', 'acpx', 'node_modules', '@agentclientprotocol', 'sdk');
const { ClientSideConnection, ndJsonStream } = await import(`file:///${sdkPath.replace(/\\/g, '/')}/dist/acp.js`);

const RESULTS_PATH = path.join('channels', 'probe', 'scripts', 'retest', 'l1a_acp_17_results.json');
const results = fs.existsSync(RESULTS_PATH) ? JSON.parse(fs.readFileSync(RESULTS_PATH, 'utf8')) : {};

function saveResults() {
  fs.writeFileSync(RESULTS_PATH, JSON.stringify(results, null, 2), 'utf8');
}

setTimeout(() => {
  console.error('GLOBAL SCRIPT TIMEOUT (80s)!');
  saveResults();
  try { execSync('taskkill /F /IM opencode.exe', { stdio: 'ignore' }); } catch (e) {}
  process.exit(1);
}, 80000);

async function main() {
  console.log('=== Starting Suite: opencode/L1a/acp ===');

  const cp = spawn('cmd.exe', ['/c', 'opencode', 'acp'], {
    cwd: CWD,
    env: ENV,
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  const updates = [];
  const permissions = [];

  const clientHandler = {
    requestPermission: async (req) => {
      console.log('[L1a Permission Request]:', JSON.stringify(req));
      permissions.push(req);
      return { outcome: { outcome: 'approved' } };
    },
    sessionUpdate: async (notice) => {
      updates.push({ time: Date.now(), notice });
    },
  };

  const stream = ndJsonStream(Writable.toWeb(cp.stdin), Readable.toWeb(cp.stdout));
  const connection = new ClientSideConnection(() => clientHandler, stream);

  try {
    // 0. Initialize
    console.log('--- 0. Initialize ---');
    const initRes = await connection.initialize({
      protocolVersion: 1,
      clientCapabilities: {
        fs: { readTextFile: true, writeTextFile: true },
        terminal: true,
      },
      clientInfo: { name: 'probe-l1a', version: '1.0.0' },
    });

    // 1. model-list (行 377)
    console.log('--- 1. Testing model-list ---');
    const newSessionRes = await connection.newSession({ cwd: CWD, mcpServers: [] });
    const sid = newSessionRes.sessionId;
    const modelOpt = newSessionRes.configOptions?.find(o => o.id === 'model' || o.category === 'model');
    const models = modelOpt?.options || [];
    results['model-list'] = {
      result: models.length > 0 ? 'pass' : 'fail',
      evidence: JSON.stringify(modelOpt).slice(0, 350),
      cmd: 'connection.newSession() configOptions.model',
      condition: '查看 newSession 返回的 configOptions 中的可用模型列表',
      note: models.length > 0 ? `成功获取 ${models.length} 个可用模型` : '未能获取模型列表'
    };
    saveResults();

    // 2. model-new (行 378)
    console.log('--- 2. Testing model-new ---');
    let setModelRes = null;
    try {
      setModelRes = await connection.setConfigOption({
        sessionId: sid,
        configId: 'model',
        value: 'zhipuai-coding-plan/glm-5.3-flash'
      });
    } catch (e) {
      setModelRes = { error: e.message };
    }
    results['model-new'] = {
      result: !setModelRes.error ? 'pass' : 'fail',
      evidence: JSON.stringify(setModelRes),
      cmd: "connection.setConfigOption({ configId: 'model', value: 'zhipuai-coding-plan/glm-5.3-flash' })",
      condition: '新建会话并设置 model 为 zhipuai-coding-plan/glm-5.3-flash',
      note: !setModelRes.error ? '成功设置新建会话模型' : `设置模型失败: ${setModelRes.error}`
    };
    saveResults();

    // 3. open (行 365)
    console.log('--- 3. Testing open ---');
    const secret = `L1A_SEC_${Math.floor(100000 + Math.random() * 900000)}`;
    const openPromptRes = await connection.prompt({
      sessionId: sid,
      prompt: [{ type: 'text', text: `请牢记暗号：${secret}，并只回复：收到` }]
    });
    results['open'] = {
      result: openPromptRes.stopReason === 'end_turn' ? 'pass' : 'fail',
      evidence: JSON.stringify(openPromptRes),
      cmd: `connection.prompt({ sessionId: '${sid}', prompt: '请牢记暗号...' })`,
      condition: '新建会话并成功完成第一轮对话',
      note: openPromptRes.stopReason === 'end_turn' ? '第一轮成功完成 (end_turn)' : '对话未正常结束'
    };
    saveResults();

    // 4. resume (行 366)
    console.log('--- 4. Testing resume ---');
    await connection.prompt({
      sessionId: sid,
      prompt: [{ type: 'text', text: '之前告诉你的暗号是什么？请只完整复述暗号' }]
    });
    const lastUpdates = updates.filter(u => u.notice.sessionId === sid);
    const updateText = JSON.stringify(lastUpdates);
    const resumePass = updateText.includes(secret);
    results['resume'] = {
      result: resumePass ? 'pass' : 'fail',
      evidence: updateText.slice(-400),
      cmd: `connection.prompt({ sessionId: '${sid}', prompt: '之前告诉你的暗号是什么？' })`,
      condition: '同一会话第二轮提问复述暗号',
      note: resumePass ? `第二轮回复中成功复述暗号 ${secret}` : '回复中未见暗号'
    };
    saveResults();

    // 5. observe-live (行 368)
    console.log('--- 5. Testing observe-live ---');
    results['observe-live'] = {
      result: updates.length > 0 ? 'pass' : 'fail',
      evidence: JSON.stringify(updates[0]?.notice || {}).slice(0, 300),
      cmd: 'clientHandler.sessionUpdate',
      condition: '在一轮生成过程中流式接收 sessionUpdate',
      note: updates.length > 0 ? `共收到 ${updates.length} 条 sessionUpdate 流式事件` : '未收到流式通知'
    };
    saveResults();

    // 6. observe-history (行 369)
    console.log('--- 6. Testing observe-history ---');
    let loadRes = null;
    try {
      loadRes = await connection.loadSession({ sessionId: sid });
    } catch (e) {
      loadRes = { error: e.message };
    }
    results['observe-history'] = {
      result: !loadRes.error ? 'pass' : 'fail',
      evidence: JSON.stringify(loadRes).slice(0, 350),
      cmd: `connection.loadSession({ sessionId: '${sid}' })`,
      condition: '调用 loadSession 读取会话历史状态',
      note: !loadRes.error ? '成功读取会话状态' : `读取失败: ${loadRes.error}`
    };
    saveResults();

    // 7. resume-native (行 367)
    console.log('--- 7. Testing resume-native ---');
    const natSecret = `L1A_NAT_${Math.floor(100000 + Math.random() * 900000)}`;
    const cliRes = execSync(
      `opencode run "牢记暗号：${natSecret}，只回复收到" -m zhipuai-coding-plan/glm-5.3-flash --title probe-opencode-l1a-nat --format json < NUL`,
      { env: ENV, encoding: 'utf8', timeout: 30000 }
    );
    let natSid = null;
    for (const l of cliRes.split('\n')) {
      try {
        const j = JSON.parse(l.trim());
        if (j.sessionID) { natSid = j.sessionID; break; }
      } catch (e) {}
    }
    if (natSid) {
      try {
        await connection.loadSession({ sessionId: natSid });
        await connection.setConfigOption({ sessionId: natSid, configId: 'model', value: 'zhipuai-coding-plan/glm-5.3-flash' });
        updates.length = 0;
        await connection.prompt({
          sessionId: natSid,
          prompt: [{ type: 'text', text: '之前告诉你的暗号是什么？请只完整复述暗号' }]
        });
        const natUpText = JSON.stringify(updates);
        const pass = natUpText.includes(natSecret);
        results['resume-native'] = {
          result: pass ? 'pass' : 'fail',
          evidence: natUpText.slice(-400),
          cmd: `connection.loadSession + prompt on native session ${natSid}`,
          condition: '用 CLI 创建含暗号会话，通过 ACP 桥 loadSession 并提问复述暗号',
          note: pass ? `成功复述暗号 ${natSecret}` : '回复中未见暗号'
        };
      } catch (e) {
        results['resume-native'] = {
          result: 'fail',
          evidence: JSON.stringify({ error: e.message }),
          cmd: `connection.loadSession({ sessionId: '${natSid}' })`,
          condition: 'loadSession 失败',
          note: `错误: ${e.message}`
        };
      }
    } else {
      results['resume-native'] = { result: 'fail', evidence: 'CLI failed', cmd: 'opencode run', condition: '无法创建原生会话', note: 'CLI 失败' };
    }
    saveResults();

    // 8. state (行 370)
    console.log('--- 8. Testing state ---');
    const stateNotices = updates.filter(u => JSON.stringify(u).includes('status') || JSON.stringify(u).includes('state'));
    results['state'] = {
      result: stateNotices.length > 0 ? 'pass' : 'fail',
      evidence: JSON.stringify(stateNotices[0] || updates[0] || {}).slice(0, 300),
      cmd: 'ACP sessionUpdate notices',
      condition: '检查 ACP 流式通知中是否区分工作状态',
      note: stateNotices.length > 0 ? '流式通知中包含状态更新' : 'ACP 未广播独立 status 字段'
    };
    saveResults();

    // 9. cancel (行 371)
    console.log('--- 9. Testing cancel ---');
    const cancelPrompt = connection.prompt({
      sessionId: sid,
      prompt: [{ type: 'text', text: '从1数到200' }]
    });
    await new Promise(r => setTimeout(r, 600));
    let cancelRes = null;
    try {
      cancelRes = await connection.cancel({ sessionId: sid });
    } catch (e) {
      cancelRes = { error: e.message };
    }
    const cancelOutcome = await cancelPrompt;
    const postCancel = await connection.prompt({
      sessionId: sid,
      prompt: [{ type: 'text', text: '打断后恢复，回复正常' }]
    });
    const cancelPass = postCancel.stopReason === 'end_turn';
    results['cancel'] = {
      result: cancelPass ? 'pass' : 'fail',
      evidence: JSON.stringify({ cancelOutcome, cancelRes, postCancel }),
      cmd: `connection.cancel({ sessionId: '${sid}' })`,
      condition: '在一轮生成中途 cancel，并在之后继续对话',
      note: cancelPass ? '打断成功且会话依然可续' : '打断失败或会话不可用'
    };
    saveResults();

    // 10. steer (行 373)
    console.log('--- 10. Testing steer ---');
    let steerRes = null;
    const slowPrompt = connection.prompt({
      sessionId: sid,
      prompt: [{ type: 'text', text: '从1数到50' }]
    });
    await new Promise(r => setTimeout(r, 300));
    try {
      steerRes = await connection.prompt({
        sessionId: sid,
        prompt: [{ type: 'text', text: '插话回复OK' }]
      });
    } catch (e) {
      steerRes = { error: e.message };
    }
    // Cancel the slow prompt immediately so it doesn't block the suite
    try { await connection.cancel({ sessionId: sid }); } catch (e) {}
    await slowPrompt.catch(() => {});
    results['steer'] = {
      result: (steerRes && !steerRes.error) ? 'pass' : 'fail',
      evidence: JSON.stringify(steerRes),
      cmd: 'connection.prompt concurrently during turn',
      condition: '在当前轮执行中并发下发 prompt',
      note: (steerRes && !steerRes.error) ? '插话成功' : `并发请求报错或被排队阻塞: ${steerRes?.error}`
    };
    saveResults();

    // 11. permission (行 374)
    console.log('--- 11. Testing permission ---');
    permissions.length = 0;
    const permPrompt = await connection.prompt({
      sessionId: sid,
      prompt: [{ type: 'text', text: '请使用 terminal 或 bash 工具执行命令：echo test_l1a_permission' }]
    });
    results['permission'] = {
      result: permissions.length > 0 ? 'pass' : 'fail',
      evidence: permissions.length > 0 ? JSON.stringify(permissions[0]) : JSON.stringify(permPrompt),
      cmd: 'clientHandler.requestPermission during prompt',
      condition: '要求智能体执行 terminal/bash 命令触发权限回调',
      note: permissions.length > 0 ? '在中途收到 requestPermission 请求原文' : '智能体未触发 requestPermission 回调'
    };
    saveResults();

    // 12. fork (行 375)
    console.log('--- 12. Testing fork ---');
    let forkRes = null;
    try {
      forkRes = await connection.request('session/fork', { sessionId: sid });
    } catch (e) {
      forkRes = { error: e.message };
    }
    results['fork'] = {
      result: (forkRes && !forkRes.error) ? 'pass' : 'fail',
      evidence: JSON.stringify(forkRes),
      cmd: 'connection.request("session/fork")',
      condition: '调用 ACP 协议 session/fork 端点',
      note: (forkRes && !forkRes.error) ? '支持原生分叉' : `未提供或报错: ${forkRes?.error}`
    };
    saveResults();

    // 13. compact (行 376)
    console.log('--- 13. Testing compact ---');
    let compRes = null;
    try {
      compRes = await connection.request('session/compact', { sessionId: sid });
    } catch (e) {
      compRes = { error: e.message };
    }
    results['compact'] = {
      result: (compRes && !compRes.error) ? 'pass' : 'fail',
      evidence: JSON.stringify(compRes),
      cmd: 'connection.request("session/compact")',
      condition: '调用 ACP 协议 session/compact',
      note: (compRes && !compRes.error) ? '整理成功' : `ACP 桥未提供 compact 端点: ${compRes?.error}`
    };
    saveResults();

    // 14. model-switch (行 379)
    console.log('--- 14. Testing model-switch ---');
    let switchModRes = null;
    try {
      switchModRes = await connection.setConfigOption({
        sessionId: sid,
        configId: 'model',
        value: 'zai-coding-plan/glm-5.3-flash'
      });
    } catch (e) {
      switchModRes = { error: e.message };
    }
    results['model-switch'] = {
      result: !switchModRes.error ? 'pass' : 'fail',
      evidence: JSON.stringify(switchModRes),
      cmd: "connection.setConfigOption({ configId: 'model', value: 'zai-coding-plan/glm-5.3-flash' })",
      condition: '同一会话中途通过 setConfigOption 切换为 zai 模型',
      note: !switchModRes.error ? '成功中途切换模型配置' : `切换失败: ${switchModRes.error}`
    };
    saveResults();

    // 15. mode-switch (行 380)
    console.log('--- 15. Testing mode-switch ---');
    let switchModeRes = null;
    try {
      switchModeRes = await connection.setConfigOption({
        sessionId: sid,
        configId: 'mode',
        value: 'plan'
      });
    } catch (e) {
      switchModeRes = { error: e.message };
    }
    results['mode-switch'] = {
      result: !switchModeRes.error ? 'pass' : 'fail',
      evidence: JSON.stringify(switchModeRes),
      cmd: "connection.setConfigOption({ configId: 'mode', value: 'plan' })",
      condition: '通过 setConfigOption 切换为 plan 模式',
      note: !switchModeRes.error ? '成功切换为 plan 模式' : `切换模式失败: ${switchModeRes.error}`
    };
    saveResults();

    // 16. quota (行 381)
    console.log('--- 16. Testing quota ---');
    let quotaRes = null;
    try {
      quotaRes = await connection.request('session/quota', { sessionId: sid });
    } catch (e) {
      quotaRes = { error: e.message };
    }
    results['quota'] = {
      result: (quotaRes && !quotaRes.error) ? 'pass' : 'n/a',
      evidence: JSON.stringify(quotaRes),
      cmd: 'connection.request("session/quota")',
      condition: '调用 session/quota',
      note: (quotaRes && !quotaRes.error) ? '获取到配额信息' : `ACP 协议未定义 quota 端点: ${quotaRes?.error}`
    };
    saveResults();

    // 17. close (行 372)
    console.log('--- 17. Testing close ---');
    let closeRes = null;
    try {
      closeRes = await connection.request('session/close', { sessionId: sid });
    } catch (e) {
      closeRes = { error: e.message };
    }
    results['close'] = {
      result: (closeRes && !closeRes.error) ? 'pass' : 'fail',
      evidence: JSON.stringify(closeRes),
      cmd: `connection.request("session/close", { sessionId: '${sid}' })`,
      condition: '关闭会话',
      note: (closeRes && !closeRes.error) ? '会话成功关闭' : `关闭会话失败: ${closeRes?.error}`
    };
    saveResults();

  } finally {
    try { execSync(`taskkill /F /T /PID ${cp.pid}`, { stdio: 'ignore' }); } catch (e) {}
    try { execSync('taskkill /F /IM opencode.exe', { stdio: 'ignore' }); } catch (e) {}
  }

  console.log('L1a all 17 items finished successfully!');
  saveResults();
  process.exit(0);
}

main().catch(err => {
  console.error('L1a fatal:', err);
  try { execSync('taskkill /F /IM opencode.exe', { stdio: 'ignore' }); } catch (e) {}
  process.exit(1);
});
