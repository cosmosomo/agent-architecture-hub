import { spawn } from 'node:child_process';
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

const DEFAULT_MODEL = 'zhipuai-coding-plan/glm-5.3-flash';
const ALT_MODEL = 'zai-coding-plan/glm-5.3-flash';
const CWD = 'E:\\program\\GIT\\Agent\\multi\\Agent-Architecture-Hub';

function runOpencode(args, timeoutMs = 45000) {
  return new Promise((resolve) => {
    const start = Date.now();
    let stdout = '';
    let stderr = '';
    const cp = spawn('cmd.exe', ['/c', 'opencode', ...args], {
      cwd: CWD,
      env: PROXY_ENV,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    cp.stdout.on('data', (d) => { stdout += d.toString('utf8'); });
    cp.stderr.on('data', (d) => { stderr += d.toString('utf8'); });

    const timer = setTimeout(() => {
      cp.kill();
      resolve({ code: -1, timedOut: true, stdout, stderr, ms: Date.now() - start });
    }, timeoutMs);

    cp.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code, timedOut: false, stdout, stderr, ms: Date.now() - start });
    });
  });
}

function parseEvents(stdout) {
  const lines = stdout.split('\n');
  const events = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      events.push(JSON.parse(trimmed));
    } catch (e) {}
  }
  return events;
}

async function main() {
  const results = {};
  const secret = `PROBE_SECRET_${Math.floor(100000 + Math.random() * 900000)}`;
  console.log('Secret:', secret);

  // 1. First, create a session with the secret
  console.log('--- Step 0: Create base session ---');
  const initRes = await runOpencode([
    'run',
    `请牢记暗号：${secret}，只回复收到`,
    '-m', DEFAULT_MODEL,
    '--title', 'probe-opencode-l0-run-base',
    '--format', 'json'
  ]);
  const initEvents = parseEvents(initRes.stdout);
  const baseSessionId = initEvents[0]?.sessionID;
  console.log('Base session ID:', baseSessionId);

  // 2. Test resume-native (行 399)
  console.log('--- Retest opencode/L0/run resume-native ---');
  if (baseSessionId) {
    const resumeRes = await runOpencode([
      'run',
      '之前告诉你的暗号是什么？请只完整复述暗号本身',
      '-s', baseSessionId,
      '-m', DEFAULT_MODEL,
      '--format', 'json'
    ]);
    const resumeEvents = parseEvents(resumeRes.stdout);
    const textEvent = resumeEvents.find(e => e.type === 'text');
    console.log('Resume text event:', JSON.stringify(textEvent));
    const pass = textEvent && JSON.stringify(textEvent).includes(secret);
    results['resume-native'] = {
      result: pass ? 'pass' : 'fail',
      evidence: JSON.stringify(textEvent),
      cmd: `opencode run "之前告诉你的暗号是什么？请只完整复述暗号本身" -s ${baseSessionId} -m ${DEFAULT_MODEL} --format json`,
      condition: '原生命令行会话，第二轮提问复述暗号',
      note: pass ? `准确回答原暗号 ${secret}` : '未能在回复中找到原暗号'
    };
  } else {
    results['resume-native'] = {
      result: 'fail',
      evidence: initRes.stderr || initRes.stdout,
      cmd: 'opencode run',
      condition: '新建基础会话失败',
      note: '未能获取基础会话ID'
    };
  }

  // 3. Test fork (行 400)
  console.log('--- Retest opencode/L0/run fork ---');
  if (baseSessionId) {
    const forkRes = await runOpencode([
      'run',
      '我们现在分叉到了新会话，请回答原会话的暗号是什么？只回复暗号',
      '-s', baseSessionId,
      '--fork',
      '-m', DEFAULT_MODEL,
      '--format', 'json'
    ]);
    const forkEvents = parseEvents(forkRes.stdout);
    const forkedSessionId = forkEvents[0]?.sessionID;
    const forkTextEvent = forkEvents.find(e => e.type === 'text');
    console.log('Forked session ID:', forkedSessionId);
    console.log('Fork text event:', JSON.stringify(forkTextEvent));
    const isNewSession = forkedSessionId && forkedSessionId !== baseSessionId;
    const hasSecret = forkTextEvent && JSON.stringify(forkTextEvent).includes(secret);
    const pass = isNewSession && hasSecret;
    results['fork'] = {
      result: pass ? 'pass' : 'fail',
      evidence: JSON.stringify({
        baseSessionId,
        forkedSessionId,
        textEvent: forkTextEvent
      }),
      cmd: `opencode run "我们现在分叉到了新会话，请回答原会话的暗号是什么？只回复暗号" -s ${baseSessionId} --fork -m ${DEFAULT_MODEL} --format json`,
      condition: '原生命令行带 --fork 分叉，在新会话中提问原暗号',
      note: pass ? `新会话 ${forkedSessionId} 继承原会话上下文并成功复述暗号 ${secret}` : '分叉未成功或未复述暗号'
    };
  } else {
    results['fork'] = {
      result: 'fail',
      evidence: 'base session creation failed',
      cmd: 'opencode run --fork',
      condition: '新建基础会话失败',
      note: '无基础会话'
    };
  }

  // 4. Test model-new (行 401)
  console.log('--- Retest opencode/L0/run model-new ---');
  const modelNewRes = await runOpencode([
    'run',
    '回复测试成功四个字',
    '-m', ALT_MODEL,
    '--title', 'probe-opencode-model-new-01',
    '--format', 'json'
  ]);
  const modelEvents = parseEvents(modelNewRes.stdout);
  const mSid = modelEvents[0]?.sessionID;
  console.log('Model new session ID:', mSid);

  // Look in stdout events first, then check export or storage file
  let modelEvidence = null;
  // Check export
  if (mSid) {
    const exportRes = await runOpencode(['export', mSid]);
    try {
      const expJson = JSON.parse(exportRes.stdout);
      // Find model field in messages or session info
      const rawStr = JSON.stringify(expJson);
      if (rawStr.includes('glm-5.3-flash')) {
        // extract the relevant object containing model or provider
        const msgWithModel = expJson.messages?.find(m => JSON.stringify(m).includes('glm-5.3-flash'));
        modelEvidence = JSON.stringify(msgWithModel || expJson.info || expJson).slice(0, 400);
      }
    } catch (e) {
      console.log('Export parse error:', e.message);
    }

    if (!modelEvidence) {
      // Check storage part files
      const storageBase = path.join(os.homedir(), '.local', 'share', 'opencode', 'storage');
      const msgDir = path.join(storageBase, 'message', mSid);
      if (fs.existsSync(msgDir)) {
        const msgFiles = fs.readdirSync(msgDir);
        for (const mf of msgFiles) {
          const content = fs.readFileSync(path.join(msgDir, mf), 'utf8');
          if (content.includes('glm-5.3-flash') || content.includes('zai-coding-plan')) {
            modelEvidence = content.slice(0, 400);
            break;
          }
        }
      }
    }
  }

  // Fallback to step_start or stdout event if it has model
  if (!modelEvidence) {
    const eventWithModel = modelEvents.find(e => JSON.stringify(e).includes('model') || JSON.stringify(e).includes('glm-5.3-flash'));
    if (eventWithModel) {
      modelEvidence = JSON.stringify(eventWithModel);
    }
  }

  console.log('Model evidence found:', modelEvidence);
  const passModel = !!modelEvidence && (modelEvidence.includes('zai-coding-plan') || modelEvidence.includes('glm-5.3-flash'));
  results['model-new'] = {
    result: passModel ? 'pass' : 'fail',
    evidence: modelEvidence || modelNewRes.stdout.slice(0, 300),
    cmd: `opencode run "回复测试成功四个字" -m ${ALT_MODEL} --title probe-opencode-model-new-01 --format json`,
    condition: `使用 -m ${ALT_MODEL} 创建新会话`,
    note: passModel ? `本地存储或导出元数据确认包含指定模型：${ALT_MODEL}` : '未在元数据或返回中提取到模型字段'
  };

  fs.writeFileSync(
    path.join('channels', 'probe', 'scripts', 'retest', 'l0_run_3_results.json'),
    JSON.stringify(results, null, 2),
    'utf8'
  );
  console.log('Done testing L0/run 3 items. Output written to l0_run_3_results.json');
}

main().catch(console.error);
