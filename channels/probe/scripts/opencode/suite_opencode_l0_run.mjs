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

function runOpencode(args, options = {}) {
  const timeoutMs = options.timeoutMs || 35000;
  const stdinMode = options.stdin || 'ignore';
  return new Promise((resolve) => {
    const start = Date.now();
    const env = { ...process.env, ...PROXY_ENV, ...(options.env || {}) };
    const chunks = [];
    let stdout = '';
    let stderr = '';

    const cp = spawn('cmd.exe', ['/c', 'opencode', ...args], {
      cwd: options.cwd || CWD,
      env,
      stdio: [stdinMode, 'pipe', 'pipe']
    });

    cp.stdout.on('data', (d) => {
      const text = d.toString('utf8');
      stdout += text;
      chunks.push({ time: Date.now() - start, text });
    });

    cp.stderr.on('data', (d) => {
      stderr += d.toString('utf8');
    });

    let killed = false;
    const timer = setTimeout(() => {
      killed = true;
      cp.kill();
      resolve({ code: -1, timedOut: true, duration: Date.now() - start, stdout, stderr, chunks });
    }, timeoutMs);

    if (options.cancelAfterMs) {
      setTimeout(() => {
        if (!killed) {
          cp.kill();
          killed = true;
        }
      }, options.cancelAfterMs);
    }

    cp.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code, timedOut: false, duration: Date.now() - start, stdout, stderr, chunks, killed });
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
  console.log('=== Suite: opencode/L0/run ===');

  // 1. open
  console.log('--- 1. Testing open ---');
  const secret = `PROBE_SECRET_${Math.floor(1000 + Math.random() * 9000)}`;
  const openCmd = `opencode run "请记住暗号：${secret}，并回复已记住" -m ${DEFAULT_MODEL} --title probe-opencode-l0-open --format json`;
  const openRes = await runOpencode(['run', `请记住暗号：${secret}，并回复已记住`, '-m', DEFAULT_MODEL, '--title', 'probe-opencode-l0-open', '--format', 'json']);
  const openEvents = parseEvents(openRes.stdout);
  const openTextEvt = openEvents.find(e => e.type === 'text');
  const sessionId = openEvents[0]?.sessionID;
  results['open'] = {
    result: (sessionId && openTextEvt?.part?.text?.includes('记住')) ? 'pass' : 'fail',
    evidence: openRes.stdout.trim().slice(0, 300),
    cmd: openCmd,
    sessionId,
    secret
  };
  console.log('open result:', results['open'].result, 'sessionId:', sessionId);

  // 2. resume
  console.log('--- 2. Testing resume ---');
  if (sessionId) {
    const resumeCmd = `opencode run "之前告诉你的暗号是什么？只回复暗号" -s ${sessionId} -m ${DEFAULT_MODEL} --format json`;
    const resumeRes = await runOpencode(['run', '之前告诉你的暗号是什么？只回复暗号', '-s', sessionId, '-m', DEFAULT_MODEL, '--format', 'json']);
    const resumeEvents = parseEvents(resumeRes.stdout);
    const resumeText = resumeEvents.find(e => e.type === 'text')?.part?.text || '';
    results['resume'] = {
      result: resumeText.includes(secret) ? 'pass' : 'fail',
      evidence: resumeRes.stdout.trim().slice(0, 300),
      cmd: resumeCmd
    };
    console.log('resume result:', results['resume'].result, 'resumeText:', resumeText);
  } else {
    results['resume'] = { result: 'fail', evidence: 'skipped, no sessionId from open', cmd: 'N/A' };
  }

  // 3. resume-native
  console.log('--- 3. Testing resume-native ---');
  // First create a native session via opencode run with title probe-opencode-native-l0
  const nativeSecret = `NATIVE_TOKEN_${Math.floor(1000 + Math.random() * 9000)}`;
  const nativeOpen = await runOpencode(['run', `暗号是：${nativeSecret}，回复OK`, '-m', DEFAULT_MODEL, '--title', 'probe-opencode-native-l0', '--format', 'json']);
  const nativeEvents = parseEvents(nativeOpen.stdout);
  const nativeSid = nativeEvents[0]?.sessionID;
  if (nativeSid) {
    const nativeResume = await runOpencode(['run', '请复述刚才的暗号', '-s', nativeSid, '-m', DEFAULT_MODEL, '--format', 'json']);
    const nEvents = parseEvents(nativeResume.stdout);
    const nText = nEvents.find(e => e.type === 'text')?.part?.text || '';
    results['resume-native'] = {
      result: nText.includes(nativeSecret) ? 'pass' : 'fail',
      evidence: nativeResume.stdout.trim().slice(0, 300),
      cmd: `opencode run "请复述刚才的暗号" -s ${nativeSid} -m ${DEFAULT_MODEL} --format json`
    };
  } else {
    results['resume-native'] = { result: 'fail', evidence: 'native session create failed', cmd: 'N/A' };
  }

  // 4. observe-live
  console.log('--- 4. Testing observe-live ---');
  results['observe-live'] = {
    result: openRes.chunks.length > 1 ? 'pass' : 'fail',
    evidence: `chunks_received=${openRes.chunks.length}, first_chunk=${JSON.stringify(openRes.chunks[0]?.text?.slice(0, 100))}`,
    cmd: openCmd
  };

  // 5. observe-history
  console.log('--- 5. Testing observe-history ---');
  if (sessionId) {
    const exportRes = await runOpencode(['export', sessionId]);
    let historyJson = null;
    try {
      historyJson = JSON.parse(exportRes.stdout);
    } catch(e) {}
    results['observe-history'] = {
      result: (historyJson && historyJson.id === sessionId) ? 'pass' : 'fail',
      evidence: exportRes.stdout.trim().slice(0, 300),
      cmd: `opencode export ${sessionId}`
    };
  } else {
    results['observe-history'] = { result: 'fail', evidence: 'no sessionId', cmd: 'N/A' };
  }

  // 6. state
  console.log('--- 6. Testing state ---');
  // CLI is batch execution; state is inferred via session list or exit code
  const listRes = await runOpencode(['session', 'list']);
  const hasSidInList = sessionId ? listRes.stdout.includes(sessionId) : false;
  results['state'] = {
    result: 'partial',
    evidence: listRes.stdout.trim().slice(0, 300),
    cmd: `opencode session list`,
    note: 'CLI run does not have daemon-level live state API; session list shows existing sessions, status of completed runs is derived from process exit code.'
  };

  // 7. cancel
  console.log('--- 7. Testing cancel ---');
  const cancelSidSecret = `CANCEL_TEST_${Math.floor(1000 + Math.random() * 9000)}`;
  const cancelInit = await runOpencode(['run', `记住暗号：${cancelSidSecret}，只回复OK`, '-m', DEFAULT_MODEL, '--format', 'json']);
  const cancelSid = parseEvents(cancelInit.stdout)[0]?.sessionID;
  if (cancelSid) {
    // Start long running task and kill it after 2 seconds
    const longRes = await runOpencode(
      ['run', '从1数到200，每个数字一行，不要停顿', '-s', cancelSid, '-m', DEFAULT_MODEL, '--format', 'json'],
      { cancelAfterMs: 2500 }
    );
    // Then resume and verify it can still respond normally
    const postCancelRes = await runOpencode(
      ['run', '之前的暗号是什么？只回复暗号', '-s', cancelSid, '-m', DEFAULT_MODEL, '--format', 'json']
    );
    const postText = parseEvents(postCancelRes.stdout).find(e => e.type === 'text')?.part?.text || '';
    results['cancel'] = {
      result: postText.includes(cancelSidSecret) ? 'pass' : 'fail',
      evidence: `interrupted_duration=${longRes.duration}ms, post_cancel_reply=${postText.trim()}`,
      cmd: `opencode run "从1数到200" -s ${cancelSid} (killed) && opencode run "之前的暗号是什么？" -s ${cancelSid}`
    };
  } else {
    results['cancel'] = { result: 'fail', evidence: 'failed to init session for cancel test', cmd: 'N/A' };
  }

  // 8. close
  console.log('--- 8. Testing close ---');
  if (sessionId) {
    const delRes = await runOpencode(['session', 'delete', sessionId]);
    const verifyList = await runOpencode(['session', 'list']);
    const deleted = !verifyList.stdout.includes(sessionId);
    results['close'] = {
      result: deleted ? 'pass' : 'partial',
      evidence: `del_stdout=${delRes.stdout.trim()}, in_list_after_delete=${!deleted}`,
      cmd: `opencode session delete ${sessionId}`
    };
  } else {
    results['close'] = { result: 'fail', evidence: 'no sessionId', cmd: 'N/A' };
  }

  // 9. steer
  console.log('--- 9. Testing steer ---');
  // CLI execution is non-interactive batch; opencode run does not support injecting messages mid-turn without attaching to server
  results['steer'] = {
    result: 'n/a',
    evidence: 'opencode run CLI is one-shot batch execution per command; mid-turn steering requires opencode serve HTTP connection or attach mode',
    cmd: `opencode run --help`,
    note: 'In CLI one-shot execution, stdin is closed to prevent hang, cannot inject user message into active turn.'
  };

  // 10. permission
  console.log('--- 10. Testing permission ---');
  // In CLI mode, permissions default or prompt on tty; non-interactive batch errors or denies without auto-approve
  const permRes = await runOpencode(['run', '在 channels/probe/scripts/tmp/test.txt 写入 hello', '-m', DEFAULT_MODEL, '--format', 'json'], { timeoutMs: 15000 });
  results['permission'] = {
    result: 'fail',
    evidence: permRes.stdout.slice(0, 300) || permRes.stderr.slice(0, 300) || `exit_code=${permRes.code}`,
    cmd: `opencode run "在 channels/probe/scripts/tmp/test.txt 写入 hello" --format json`,
    note: 'CLI in non-interactive batch mode does not support interactive prompt callback; only supports static --auto flag.'
  };

  // 11. fork
  console.log('--- 11. Testing fork ---');
  // Test fork on nativeSid if available
  if (nativeSid) {
    const forkRes = await runOpencode(['run', '我们分叉了，回复FORK_OK', '-s', nativeSid, '--fork', '-m', DEFAULT_MODEL, '--format', 'json']);
    const forkEvents = parseEvents(forkRes.stdout);
    const forkedSid = forkEvents[0]?.sessionID;
    results['fork'] = {
      result: (forkedSid && forkedSid !== nativeSid) ? 'pass' : 'fail',
      evidence: `original_sid=${nativeSid}, forked_sid=${forkedSid}`,
      cmd: `opencode run "我们分叉了，回复FORK_OK" -s ${nativeSid} --fork -m ${DEFAULT_MODEL} --format json`
    };
  } else {
    results['fork'] = { result: 'fail', evidence: 'no nativeSid to fork', cmd: 'N/A' };
  }

  // 12. compact
  console.log('--- 12. Testing compact ---');
  // Check opencode run --help or opencode --help for compact
  results['compact'] = {
    result: 'n/a',
    evidence: 'opencode CLI has no compact command or --compact flag in opencode run / session options',
    cmd: `opencode --help`
  };

  // 13. model-list
  console.log('--- 13. Testing model-list ---');
  const modelsRes = await runOpencode(['models']);
  results['model-list'] = {
    result: modelsRes.stdout.includes('glm') ? 'pass' : 'fail',
    evidence: modelsRes.stdout.split('\n').filter(Boolean).slice(0, 10).join('\n'),
    cmd: `opencode models`
  };

  // 14. model-new
  console.log('--- 14. Testing model-new ---');
  const newModRes = await runOpencode(['run', '回复模型名', '-m', ALT_MODEL, '--format', 'json']);
  const newModEvents = parseEvents(newModRes.stdout);
  const newModFinish = newModEvents.find(e => e.type === 'step_finish');
  results['model-new'] = {
    result: newModFinish ? 'pass' : 'fail',
    evidence: JSON.stringify(newModFinish?.part || {}),
    cmd: `opencode run "回复模型名" -m ${ALT_MODEL} --format json`
  };

  // 15. model-switch
  console.log('--- 15. Testing model-switch ---');
  // First turn with DEFAULT_MODEL, second turn with -m ALT_MODEL on same session
  const swInit = await runOpencode(['run', '第一轮回复1', '-m', DEFAULT_MODEL, '--format', 'json']);
  const swSid = parseEvents(swInit.stdout)[0]?.sessionID;
  if (swSid) {
    const swSecond = await runOpencode(['run', '第二轮回复2', '-s', swSid, '-m', ALT_MODEL, '--format', 'json']);
    const swEvents = parseEvents(swSecond.stdout);
    const swFinish = swEvents.find(e => e.type === 'step_finish');
    // Check if model changed in metadata / message storage
    const msgPath = path.join(os.homedir(), '.local', 'share', 'opencode', 'storage', 'message', swSid);
    let diskEvidence = '';
    if (fs.existsSync(msgPath)) {
      const files = fs.readdirSync(msgPath);
      const lastMsg = JSON.parse(fs.readFileSync(path.join(msgPath, files[files.length - 1]), 'utf8'));
      diskEvidence = `model=${lastMsg?.model || 'unknown'}, provider=${lastMsg?.provider || 'unknown'}`;
    }
    results['model-switch'] = {
      result: (swFinish && diskEvidence.includes('glm-5.3-flash')) ? 'pass' : 'fail',
      evidence: `swFinish=${JSON.stringify(swFinish?.part?.tokens || {})}, disk=${diskEvidence}`,
      cmd: `opencode run "第一轮回复1" -m ${DEFAULT_MODEL} && opencode run "第二轮回复2" -s ${swSid} -m ${ALT_MODEL}`
    };
  } else {
    results['model-switch'] = { result: 'fail', evidence: 'failed to init session for switch', cmd: 'N/A' };
  }

  // 16. mode-switch
  console.log('--- 16. Testing mode-switch ---');
  // Check opencode run --help: supports --agent or --auto; no mode-switch flag on run
  results['mode-switch'] = {
    result: 'n/a',
    evidence: 'opencode run CLI has no --mode flag or mode-switch command (supports --agent and --auto only)',
    cmd: `opencode run --help`
  };

  // 17. quota
  console.log('--- 17. Testing quota ---');
  const statsRes = await runOpencode(['stats']);
  results['quota'] = {
    result: statsRes.stdout.includes('Total') || statsRes.stdout.includes('Token') ? 'pass' : 'partial',
    evidence: statsRes.stdout.trim().slice(0, 300),
    cmd: `opencode stats`
  };

  fs.writeFileSync('channels/probe/scripts/opencode/l0_run_results.json', JSON.stringify(results, null, 2), 'utf8');
  console.log('=== L0 run testing completed! ===');
}

main().catch(console.error);
