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
  console.error('PART2 TIMEOUT (45s)!');
  saveResults();
  try { execSync('taskkill /F /IM opencode.exe', { stdio: 'ignore' }); } catch (e) {}
  process.exit(1);
}, 45000);

async function main() {
  console.log('=== Starting Part 2 for opencode/L1a/acp ===');

  const cp = spawn('cmd.exe', ['/c', 'opencode', 'acp'], {
    cwd: CWD,
    env: ENV,
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  const permissions = [];
  const updates = [];

  const clientHandler = {
    requestPermission: async (req) => {
      console.log('[L1a Permission Request]:', JSON.stringify(req));
      permissions.push(req);
      return { outcome: { outcome: 'approved' } };
    },
    sessionUpdate: async (notice) => {
      updates.push(notice);
    },
  };

  const stream = ndJsonStream(Writable.toWeb(cp.stdin), Readable.toWeb(cp.stdout));
  const connection = new ClientSideConnection(() => clientHandler, stream);

  try {
    await connection.initialize({
      protocolVersion: 1,
      clientCapabilities: {
        fs: { readTextFile: true, writeTextFile: true },
        terminal: true,
      },
      clientInfo: { name: 'probe-l1a-part2', version: '1.0.0' },
    });

    const newSess = await connection.newSession({ cwd: CWD, mcpServers: [] });
    const sid = newSess.sessionId;

    // 1. permission (行 374)
    console.log('--- 1. Testing permission ---');
    permissions.length = 0;
    const permPrompt = await connection.prompt({
      sessionId: sid,
      prompt: [{ type: 'text', text: '请使用 terminal 或 bash 工具执行命令：echo test_permission_l1a' }]
    });
    results['permission'] = {
      result: permissions.length > 0 ? 'pass' : 'fail',
      evidence: permissions.length > 0 ? JSON.stringify(permissions[0]) : JSON.stringify(permPrompt),
      cmd: 'clientHandler.requestPermission during prompt',
      condition: '要求智能体执行 bash 工具并观察 requestPermission 回调',
      note: permissions.length > 0 ? '在中途收到 requestPermission 请求原文' : '智能体未触发 requestPermission（桥层未派发或自动放行）'
    };
    saveResults();

    // 2. fork (行 375)
    console.log('--- 2. Testing fork ---');
    let forkRes = null;
    try {
      forkRes = await connection.unstable_forkSession({ sessionId: sid });
    } catch (e) {
      forkRes = { error: e.message };
    }
    const forkPass = forkRes && !forkRes.error && forkRes.sessionId;
    results['fork'] = {
      result: forkPass ? 'pass' : 'fail',
      evidence: JSON.stringify(forkRes),
      cmd: `connection.unstable_forkSession({ sessionId: '${sid}' })`,
      condition: '调用 ACP unstable_forkSession 分叉',
      note: forkPass ? `分叉成功，得到新会话 ${forkRes.sessionId}` : `分叉失败: ${forkRes?.error}`
    };
    saveResults();

    // 3. compact (行 376)
    console.log('--- 3. Testing compact ---');
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
      note: (compRes && !compRes.error) ? '整理成功' : `ACP 桥报错: ${compRes?.error}`
    };
    saveResults();

    // 4. model-switch (行 379)
    console.log('--- 4. Testing model-switch ---');
    let switchModRes = null;
    try {
      switchModRes = await connection.setSessionConfigOption({
        sessionId: sid,
        configId: 'model',
        value: 'zai-coding-plan/glm-5.3-flash'
      });
    } catch (e) {
      switchModRes = { error: e.message };
    }
    const switchModPass = switchModRes && !switchModRes.error;
    results['model-switch'] = {
      result: switchModPass ? 'pass' : 'fail',
      evidence: JSON.stringify(switchModRes),
      cmd: `connection.setSessionConfigOption({ sessionId: '${sid}', configId: 'model', value: 'zai-coding-plan/glm-5.3-flash' })`,
      condition: '通过 setSessionConfigOption 切换模型',
      note: switchModPass ? '成功切换模型配置' : `切换失败: ${switchModRes?.error}`
    };
    saveResults();

    // 5. mode-switch (行 380)
    console.log('--- 5. Testing mode-switch ---');
    let switchModeRes = null;
    try {
      switchModeRes = await connection.setSessionMode({
        sessionId: sid,
        mode: 'plan'
      });
    } catch (e) {
      switchModeRes = { error: e.message };
    }
    const switchModePass = switchModeRes && !switchModeRes.error;
    results['mode-switch'] = {
      result: switchModePass ? 'pass' : 'fail',
      evidence: JSON.stringify(switchModeRes),
      cmd: `connection.setSessionMode({ sessionId: '${sid}', mode: 'plan' })`,
      condition: '通过 setSessionMode 切换模式为 plan',
      note: switchModePass ? '成功切换模式为 plan' : `切换失败: ${switchModeRes?.error}`
    };
    saveResults();

    // 6. quota (行 381)
    console.log('--- 6. Testing quota ---');
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
      note: (quotaRes && !quotaRes.error) ? '获取到配额信息' : `ACP 桥未提供 quota 端点: ${quotaRes?.error}`
    };
    saveResults();

    // 7. close (行 372)
    console.log('--- 7. Testing close ---');
    let closeRes = null;
    try {
      if (typeof connection.closeSession === 'function') {
        closeRes = await connection.closeSession({ sessionId: sid });
      } else {
        closeRes = await connection.request('session/close', { sessionId: sid });
      }
    } catch (e) {
      closeRes = { error: e.message };
    }
    const closePass = closeRes && !closeRes.error;
    results['close'] = {
      result: closePass ? 'pass' : 'fail',
      evidence: JSON.stringify(closeRes),
      cmd: `connection.closeSession({ sessionId: '${sid}' })`,
      condition: '调用 closeSession 关闭会话',
      note: closePass ? '会话成功关闭' : `关闭会话失败: ${closeRes?.error}`
    };
    saveResults();

  } finally {
    try { execSync(`taskkill /F /T /PID ${cp.pid}`, { stdio: 'ignore' }); } catch (e) {}
    try { execSync('taskkill /F /IM opencode.exe', { stdio: 'ignore' }); } catch (e) {}
  }

  console.log('Part 2 finished!');
  saveResults();
  process.exit(0);
}

main().catch(err => {
  console.error('Part 2 error:', err);
  try { execSync('taskkill /F /IM opencode.exe', { stdio: 'ignore' }); } catch (e) {}
  process.exit(1);
});
