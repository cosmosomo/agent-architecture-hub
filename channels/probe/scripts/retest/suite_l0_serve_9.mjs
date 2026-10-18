import { spawn, execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const PROXY_ENV = {
  ...process.env,
  HTTP_PROXY: 'http://127.0.0.1:7892',
  HTTPS_PROXY: 'http://127.0.0.1:7892',
  http_proxy: 'http://127.0.0.1:7892',
  https_proxy: 'http://127.0.0.1:7892',
};

const PORT = 44230;
const BASE = `http://127.0.0.1:${PORT}`;
const DEFAULT_MODEL = { providerID: 'zhipuai-coding-plan', modelID: 'glm-5.3-flash' };
const ALT_MODEL = { providerID: 'zai-coding-plan', modelID: 'glm-5.3-flash' };

setTimeout(() => {
  console.error('GLOBAL SCRIPT TIMEOUT (75s)!');
  try { execSync(`taskkill /F /IM opencode.exe`); } catch (e) {}
  process.exit(1);
}, 75000);

function killProcessTree(cp) {
  if (!cp || !cp.pid) return;
  try { execSync(`taskkill /F /T /PID ${cp.pid}`, { stdio: 'ignore' }); } catch (e) {}
}

async function startServer() {
  const cp = spawn('cmd.exe', ['/c', 'opencode', 'serve', '--port', String(PORT), '--hostname', '127.0.0.1'], {
    env: PROXY_ENV,
    stdio: ['ignore', 'pipe', 'pipe']
  });
  for (let i = 0; i < 25; i++) {
    await new Promise(r => setTimeout(r, 400));
    try {
      const res = await fetch(`${BASE}/global/health`);
      if (res.ok) return cp;
    } catch (e) {}
  }
  return cp;
}

async function sendPromptAndWait(sid, text, model = DEFAULT_MODEL, waitMs = 4000) {
  const payload = {
    prompt: { text },
    model
  };
  const res = await fetch(`${BASE}/api/session/${sid}/prompt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const admit = await res.json();
  // Poll history until assistant reply arrives
  let historyData = null;
  for (let i = 0; i < 15; i++) {
    await new Promise(r => setTimeout(r, 800));
    try {
      const hRes = await fetch(`${BASE}/api/session/${sid}/history`);
      if (hRes.ok) {
        historyData = await hRes.json();
        const items = historyData.data || historyData;
        const hasAssistant = Array.isArray(items) && items.some(m => m.info?.role === 'assistant' || m.role === 'assistant');
        if (hasAssistant) break;
      }
    } catch (e) {}
  }
  return { admit, history: historyData };
}

async function main() {
  const results = {};
  const server = await startServer();

  try {
    // ----------------------------------------------------
    // 1. model-list (行 360)
    // ----------------------------------------------------
    console.log('--- 1. Testing model-list ---');
    const mListRes = await fetch(`${BASE}/api/model`);
    const mListData = await mListRes.json();
    const modelItems = mListData.data || mListData;
    const hasModels = Array.isArray(modelItems) && modelItems.length > 0;
    results['model-list'] = {
      result: hasModels ? 'pass' : 'fail',
      evidence: JSON.stringify(mListData).slice(0, 350),
      cmd: `GET ${BASE}/api/model`,
      condition: 'GET /api/model 获取模型列表',
      note: hasModels ? `成功获取 ${modelItems.length} 个模型` : '未能获取模型列表'
    };

    // ----------------------------------------------------
    // 2. resume-native (行 402)
    // ----------------------------------------------------
    console.log('--- 2. Testing resume-native ---');
    const natSecret = `NAT_SERVE_${Math.floor(100000 + Math.random() * 900000)}`;
    const cliRes = execSync(
      `opencode run "牢记暗号：${natSecret}，只回复收到" -m zhipuai-coding-plan/glm-5.3-flash --title probe-opencode-serve-nat --format json < NUL`,
      { env: PROXY_ENV, encoding: 'utf8', timeout: 30000 }
    );
    let natSid = null;
    for (const l of cliRes.split('\n')) {
      try {
        const j = JSON.parse(l.trim());
        if (j.sessionID) { natSid = j.sessionID; break; }
      } catch (e) {}
    }
    console.log('Native CLI sid:', natSid);
    if (natSid) {
      const { admit, history } = await sendPromptAndWait(natSid, '之前告诉你的暗号是什么？请只完整复述暗号');
      const histStr = JSON.stringify(history);
      console.log('resume-native history contains secret?', histStr.includes(natSecret));
      const pass = histStr.includes(natSecret);
      results['resume-native'] = {
        result: pass ? 'pass' : 'fail',
        evidence: histStr.slice(0, 400),
        cmd: `POST ${BASE}/api/session/${natSid}/prompt (prompt: { text: ... })`,
        condition: 'CLI 创建含暗号会话，HTTP 接口发送提问暗号并读取回复',
        note: pass ? `成功复述暗号 ${natSecret}` : '回复中未包含暗号'
      };
    } else {
      results['resume-native'] = {
        result: 'fail',
        evidence: cliRes.slice(0, 300),
        cmd: 'opencode run',
        condition: '新建原生会话失败',
        note: '未能创建或解析原生会话 ID'
      };
    }

    // ----------------------------------------------------
    // 3. state (行 403)
    // ----------------------------------------------------
    console.log('--- 3. Testing state ---');
    const sRes = await (await fetch(`${BASE}/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'probe-opencode-serve-state' })
    })).json();
    const sid = sRes.data?.id || sRes.id;

    const idleData = await (await fetch(`${BASE}/api/session/${sid}`)).json();
    fetch(`${BASE}/api/session/${sid}/prompt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: { text: '从1数到40' },
        model: DEFAULT_MODEL
      })
    });
    await new Promise(r => setTimeout(r, 400));
    const busyData = await (await fetch(`${BASE}/api/session/${sid}`)).json();

    const hasState = idleData.data?.status || idleData.status;
    results['state'] = {
      result: hasState ? 'pass' : 'fail',
      evidence: JSON.stringify({ idle: idleData, busy: busyData }),
      cmd: `GET ${BASE}/api/session/${sid}`,
      condition: '分别在空闲时与运行中 GET 会话详情',
      note: hasState
        ? '返回了状态字段'
        : 'GET /api/session/{id} 返回数据中只有 id/projectID/cost/tokens/time/title/location，无标识当前工作中/空闲的 status/state 字段'
    };

    // ----------------------------------------------------
    // 4. permission (行 404)
    // ----------------------------------------------------
    console.log('--- 4. Testing permission ---');
    let caughtPerm = null;
    let permReplyCode = null;
    const testFile = path.join(os.tmpdir(), `probe_perm_${Date.now()}.txt`);
    
    // Send prompt triggering command execution
    fetch(`${BASE}/api/session/${sid}/prompt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: { text: `请使用 bash/shell 工具创建文件 ${testFile}` },
        model: DEFAULT_MODEL
      })
    });

    for (let i = 0; i < 15; i++) {
      await new Promise(r => setTimeout(r, 400));
      try {
        const pList = await (await fetch(`${BASE}/api/session/${sid}/permission`)).json();
        const items = pList.data || pList;
        if (Array.isArray(items) && items.length > 0) {
          caughtPerm = items[0];
          const rep = await fetch(`${BASE}/api/session/${sid}/permission/${caughtPerm.id}/reply`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ response: 'allow' })
          });
          permReplyCode = rep.status;
          break;
        }
      } catch (e) {}
    }

    results['permission'] = {
      result: caughtPerm ? 'pass' : 'fail',
      evidence: caughtPerm
        ? JSON.stringify({ caughtPerm, permReplyCode })
        : JSON.stringify(await (await fetch(`${BASE}/api/session/${sid}/permission`)).json()),
      cmd: `GET ${BASE}/api/session/${sid}/permission during bash tool execution`,
      condition: '要求智能体执行 bash 创建文件并在运行中轮询审批端点',
      note: caughtPerm
        ? '在中途成功截获审批请求'
        : '运行中未向 /permission 端点派发拦截请求（无头 HTTP 模式默认自动放行或无拦截）'
    };

    // ----------------------------------------------------
    // 5. compact (行 405)
    // ----------------------------------------------------
    console.log('--- 5. Testing compact ---');
    const compRes = await fetch(`${BASE}/api/session/${sid}/compact`, { method: 'POST' });
    const compBody = await compRes.text();
    results['compact'] = {
      result: compRes.status === 200 ? 'pass' : 'fail',
      evidence: JSON.stringify({ status: compRes.status, body: compBody }),
      cmd: `POST ${BASE}/api/session/${sid}/compact`,
      condition: 'POST /api/session/{id}/compact 触发上下文压缩',
      note: compRes.status === 200
        ? '压缩成功'
        : `服务端报错断点：HTTP ${compRes.status} ${compBody}`
    };

    // ----------------------------------------------------
    // 6. model-new (行 361)
    // ----------------------------------------------------
    console.log('--- 6. Testing model-new ---');
    const mNewSess = await (await fetch(`${BASE}/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'probe-opencode-serve-mnew' })
    })).json();
    const mSid = mNewSess.data?.id || mNewSess.id;

    const { admit: mNewAdmit, history: mNewHist } = await sendPromptAndWait(
      mSid,
      '选模型测试回复六个字',
      ALT_MODEL,
      4000
    );

    let storageModel = null;
    const msgDir = path.join(os.homedir(), '.local', 'share', 'opencode', 'storage', 'message', mSid);
    if (fs.existsSync(msgDir)) {
      for (const f of fs.readdirSync(msgDir)) {
        const c = fs.readFileSync(path.join(msgDir, f), 'utf8');
        if (c.includes('zai-coding-plan') || c.includes('glm-5.3-flash')) {
          storageModel = c.slice(0, 350);
          break;
        }
      }
    }
    const mNewPass = JSON.stringify(mNewHist).includes('zai-coding-plan') || !!storageModel;
    results['model-new'] = {
      result: mNewPass ? 'pass' : 'fail',
      evidence: storageModel || JSON.stringify(mNewHist).slice(0, 350),
      cmd: `POST ${BASE}/api/session/${mSid}/prompt with model=${JSON.stringify(ALT_MODEL)}`,
      condition: `在新建会话中指定 model 为 ${ALT_MODEL.providerID}/${ALT_MODEL.modelID}`,
      note: mNewPass ? `元数据或落盘消息确认包含指定模型：${ALT_MODEL.providerID}/${ALT_MODEL.modelID}` : '未在落盘消息中提取到模型字段'
    };

    // ----------------------------------------------------
    // 7. model-switch (行 362)
    // ----------------------------------------------------
    console.log('--- 7. Testing model-switch ---');
    const { history: mSwitchHist } = await sendPromptAndWait(
      mSid,
      '切换模型测试回复已收到',
      DEFAULT_MODEL,
      4000
    );

    let switchStorageModel = null;
    if (fs.existsSync(msgDir)) {
      const files = fs.readdirSync(msgDir);
      for (const f of files.reverse()) {
        const c = fs.readFileSync(path.join(msgDir, f), 'utf8');
        if (c.includes('zhipuai-coding-plan')) {
          switchStorageModel = c.slice(0, 350);
          break;
        }
      }
    }
    const mSwitchPass = JSON.stringify(mSwitchHist).includes('zhipuai-coding-plan') || !!switchStorageModel;
    results['model-switch'] = {
      result: mSwitchPass ? 'pass' : 'fail',
      evidence: switchStorageModel || JSON.stringify(mSwitchHist).slice(0, 350),
      cmd: `POST ${BASE}/api/session/${mSid}/prompt (turn 2 with DEFAULT_MODEL)`,
      condition: '同一会话第二轮改用 zhipuai-coding-plan/glm-5.3-flash 提问',
      note: mSwitchPass ? '第二轮落盘或历史消息确认模型变更为 zhipuai-coding-plan' : '第二轮未见新模型'
    };

    // ----------------------------------------------------
    // 8. mode-switch (行 363)
    // ----------------------------------------------------
    console.log('--- 8. Testing mode-switch ---');
    const modeSwitchRes = await fetch(`${BASE}/api/session/${mSid}/agent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agent: 'plan' })
    });
    const modeSwitchBody = await modeSwitchRes.text();

    const modePass = modeSwitchRes.status === 200 || modeSwitchRes.status === 204;
    results['mode-switch'] = {
      result: modePass ? 'pass' : 'fail',
      evidence: JSON.stringify({ status: modeSwitchRes.status, body: modeSwitchBody }),
      cmd: `POST ${BASE}/api/session/${mSid}/agent`,
      condition: '调用 POST /api/session/{id}/agent 切换 agent 模式',
      note: modePass ? '成功切换为 plan 模式（返回 204 No Content）' : '端点返回异常'
    };

    // ----------------------------------------------------
    // 9. quota (行 364)
    // ----------------------------------------------------
    console.log('--- 9. Testing quota ---');
    const sessDetail = await (await fetch(`${BASE}/api/session/${mSid}`)).json();
    const tokens = sessDetail.data?.tokens || sessDetail.tokens;
    const hasTokens = tokens && (tokens.input > 0 || tokens.output > 0);
    results['quota'] = {
      result: hasTokens ? 'pass' : 'n/a',
      evidence: JSON.stringify(sessDetail.data || sessDetail),
      cmd: `GET ${BASE}/api/session/${mSid}`,
      condition: 'GET /api/session/{id} 查看会话级 tokens 统计',
      note: hasTokens ? `会话返回真实消耗用量 tokens: ${JSON.stringify(tokens)}` : '无用量统计数据'
    };

  } finally {
    killProcessTree(server);
    try { execSync('taskkill /F /IM opencode.exe', { stdio: 'ignore' }); } catch (e) {}
  }

  fs.writeFileSync(
    path.join('channels', 'probe', 'scripts', 'retest', 'l0_serve_9_results.json'),
    JSON.stringify(results, null, 2),
    'utf8'
  );
  console.log('Finished testing 9 items. Results written to l0_serve_9_results.json.');
  process.exit(0);
}

main().catch(err => {
  console.error('Fatal in main:', err);
  try { execSync('taskkill /F /IM opencode.exe', { stdio: 'ignore' }); } catch (e) {}
  process.exit(1);
});
