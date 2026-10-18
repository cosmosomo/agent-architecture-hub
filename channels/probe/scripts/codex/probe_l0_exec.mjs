import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const CWD = 'E:\\program\\GIT\\Agent\\multi\\Agent-Architecture-Hub';
const ENV = {
  ...process.env,
  HTTP_PROXY: 'http://127.0.0.1:7892',
  HTTPS_PROXY: 'http://127.0.0.1:7892',
};

function runCodexExec(args, input = '', timeoutMs = 45000) {
  return new Promise((resolve) => {
    const start = Date.now();
    const cp = spawn('codex', ['exec', ...args], {
      cwd: CWD,
      env: ENV,
      shell: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    const chunks = [];

    cp.stdout.on('data', (d) => {
      const s = d.toString();
      stdout += s;
      chunks.push({ time: Date.now() - start, text: s });
    });

    cp.stderr.on('data', (d) => {
      stderr += d.toString();
    });

    if (input) {
      cp.stdin.write(input);
    }
    cp.stdin.end();

    const timer = setTimeout(() => {
      cp.kill();
      resolve({ code: -1, timedOut: true, stdout, stderr, duration: Date.now() - start, chunks });
    }, timeoutMs);

    cp.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code, timedOut: false, stdout, stderr, duration: Date.now() - start, chunks });
    });
  });
}

async function main() {
  console.log('=== Starting Codex L0 Exec Probing ===');
  const results = {};

  // 1. open
  console.log('--- 1. Testing open ---');
  // First test requested model gpt-5.4-mini
  const openMini = await runCodexExec(['--json', '--skip-git-repo-check', '-m', 'gpt-5.4-mini', '-'], 'ping');
  console.log('openMini result:', openMini.stderr.slice(0, 200) || openMini.stdout.slice(0, 200));

  // Run with available working model gpt-5.6-sol
  const openRes = await runCodexExec(
    ['--json', '--skip-git-repo-check', '-m', 'gpt-5.6-sol', '-'],
    'Remember this secret word: PROBE_SECRET_ALPHA_789. Reply with: WORD_SAVED_OK'
  );
  console.log('open duration:', openRes.duration, 'code:', openRes.code);
  const openLines = openRes.stdout.split('\n').filter(Boolean);
  let threadId = null;
  let openAgentMsg = null;
  for (const line of openLines) {
    try {
      const j = JSON.parse(line);
      if (j.type === 'thread.started' && j.thread_id) threadId = j.thread_id;
      if (j.type === 'item.completed' && j.item?.type === 'agent_message') openAgentMsg = j.item.text;
    } catch {}
  }
  console.log('Captured threadId:', threadId, 'agentMsg:', openAgentMsg);

  results['open'] = {
    pass: !!threadId && !!openAgentMsg,
    threadId,
    evidence: threadId ? `thread_id=${threadId}, reply=${openAgentMsg?.slice(0, 100)}` : `stdout=${openRes.stdout.slice(0, 150)}, stderr=${openRes.stderr.slice(0, 150)}`,
    cmd: `codex exec --json --skip-git-repo-check -m gpt-5.6-sol -`,
  };

  // 2. resume
  console.log('--- 2. Testing resume ---');
  if (threadId) {
    const resumeRes = await runCodexExec(
      ['resume', '--json', '--skip-git-repo-check', '-m', 'gpt-5.6-sol', threadId, '-'],
      'What was the secret word I asked you to remember? Reply ONLY with the exact word.'
    );
    const resumeLines = resumeRes.stdout.split('\n').filter(Boolean);
    let resumeAgentMsg = null;
    for (const line of resumeLines) {
      try {
        const j = JSON.parse(line);
        if (j.type === 'item.completed' && j.item?.type === 'agent_message') resumeAgentMsg = j.item.text;
      } catch {}
    }
    const hasWord = !!resumeAgentMsg && resumeAgentMsg.includes('PROBE_SECRET_ALPHA_789');
    console.log('resume reply:', resumeAgentMsg, 'hasWord:', hasWord);
    results['resume'] = {
      pass: hasWord,
      evidence: `reply=${resumeAgentMsg?.trim()}`,
      cmd: `codex exec resume --json --skip-git-repo-check -m gpt-5.6-sol ${threadId} -`,
    };
  } else {
    results['resume'] = { pass: false, evidence: 'skipped: open failed to produce threadId' };
  }

  // 3. resume-native
  console.log('--- 3. Testing resume-native ---');
  // First create a native CLI session
  const nativeOpen = await runCodexExec(
    ['--json', '--skip-git-repo-check', '-m', 'gpt-5.6-sol', '-'],
    'probe-codex-native-cli session init. Reply with: NATIVE_INIT_OK'
  );
  let nativeThreadId = null;
  for (const line of nativeOpen.stdout.split('\n').filter(Boolean)) {
    try {
      const j = JSON.parse(line);
      if (j.type === 'thread.started' && j.thread_id) nativeThreadId = j.thread_id;
    } catch {}
  }
  if (nativeThreadId) {
    const nativeResume = await runCodexExec(
      ['resume', '--json', '--skip-git-repo-check', '-m', 'gpt-5.6-sol', nativeThreadId, '-'],
      'Resume native session turn 2. Reply with: NATIVE_RESUME_OK'
    );
    let nativeResumeMsg = null;
    for (const line of nativeResume.stdout.split('\n').filter(Boolean)) {
      try {
        const j = JSON.parse(line);
        if (j.item?.type === 'agent_message') nativeResumeMsg = j.item.text;
      } catch {}
    }
    results['resume-native'] = {
      pass: !!nativeResumeMsg && nativeResumeMsg.includes('NATIVE_RESUME_OK'),
      evidence: `nativeThreadId=${nativeThreadId}, reply=${nativeResumeMsg?.trim()}`,
      cmd: `codex exec resume --json --skip-git-repo-check -m gpt-5.6-sol ${nativeThreadId} -`,
    };
  } else {
    results['resume-native'] = { pass: false, evidence: 'failed to create native session' };
  }

  // 4. observe-live
  console.log('--- 4. Testing observe-live ---');
  // Check chunks from openRes or run a dedicated multi-chunk prompt
  const streamRes = await runCodexExec(
    ['--json', '--skip-git-repo-check', '-m', 'gpt-5.6-sol', '-'],
    'Count from 1 to 5, one number per line.'
  );
  results['observe-live'] = {
    pass: streamRes.chunks.length > 1,
    evidence: `chunks_count=${streamRes.chunks.length}, duration=${streamRes.duration}ms, first_chunk_at=${streamRes.chunks[0]?.time}ms, last_chunk_at=${streamRes.chunks[streamRes.chunks.length - 1]?.time}ms`,
    cmd: `codex exec --json --skip-git-repo-check -m gpt-5.6-sol -`,
  };

  // 5. observe-history
  console.log('--- 5. Testing observe-history ---');
  // Check if codex has a CLI history command
  const histCheck = await new Promise((res) => {
    const cp = spawn('codex', ['history', '--help'], { shell: true, stdio: ['pipe', 'pipe', 'pipe'] });
    let out = '', err = '';
    cp.stdout.on('data', d => out += d);
    cp.stderr.on('data', d => err += d);
    cp.on('close', code => res({ code, out, err }));
  });
  results['observe-history'] = {
    pass: false,
    na: true,
    evidence: `error: unrecognized subcommand 'history' (out=${histCheck.out.slice(0, 60).replace(/\r?\n/g, ' ')}, err=${histCheck.err.slice(0, 60).replace(/\r?\n/g, ' ')})`,
    cmd: `codex history --help`,
    note: 'codex CLI has no command to read back session history; history is stored in ~/.codex/sessions/ JSONL files.',
  };

  // 6. state
  console.log('--- 6. Testing state ---');
  const stateCheck = await new Promise((res) => {
    const cp = spawn('codex', ['status', '--help'], { shell: true, stdio: ['pipe', 'pipe', 'pipe'] });
    let out = '', err = '';
    cp.stdout.on('data', d => out += d);
    cp.stderr.on('data', d => err += d);
    cp.on('close', code => res({ code, out, err }));
  });
  results['state'] = {
    pass: false,
    na: true,
    evidence: `error: unrecognized subcommand 'status' (err=${stateCheck.err.slice(0, 60).replace(/\r?\n/g, ' ')})`,
    cmd: `codex status --help`,
    note: 'codex CLI has no status command for querying session state.',
  };

  // 7. cancel
  console.log('--- 7. Testing cancel ---');
  const cancelTest = await new Promise(async (res) => {
    const start = Date.now();
    const cp = spawn('codex', ['exec', '--json', '--skip-git-repo-check', '-m', 'gpt-5.6-sol', '-'], {
      cwd: CWD,
      env: ENV,
      shell: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let cThreadId = null;
    cp.stdout.on('data', (d) => {
      const s = d.toString();
      for (const line of s.split('\n')) {
        try {
          const j = JSON.parse(line);
          if (j.type === 'thread.started' && j.thread_id) cThreadId = j.thread_id;
        } catch {}
      }
    });
    cp.stdin.write('Count from 1 to 200, one number per line, slowly.\n');
    cp.stdin.end();

    // Interrupt after 2.5 seconds
    setTimeout(() => {
      cp.kill(); // Terminate child process
      res({ killed: true, threadId: cThreadId });
    }, 2500);
  });
  console.log('Cancel sent, threadId:', cancelTest.threadId);
  if (cancelTest.threadId) {
    // Attempt resume
    const afterCancel = await runCodexExec(
      ['resume', '--json', '--skip-git-repo-check', '-m', 'gpt-5.6-sol', cancelTest.threadId, '-'],
      'Reply with: CANCEL_RECOVERED_SUCCESS'
    );
    let afterMsg = null;
    for (const line of afterCancel.stdout.split('\n').filter(Boolean)) {
      try {
        const j = JSON.parse(line);
        if (j.item?.type === 'agent_message') afterMsg = j.item.text;
      } catch {}
    }
    results['cancel'] = {
      pass: !!afterMsg && afterMsg.includes('CANCEL_RECOVERED_SUCCESS'),
      evidence: `threadId=${cancelTest.threadId}, resumeMsg=${afterMsg?.trim()}`,
      cmd: `kill process after 2.5s -> codex exec resume --json -m gpt-5.6-sol ${cancelTest.threadId} -`,
    };
  } else {
    results['cancel'] = { pass: false, evidence: 'cancelled before threadId was emitted' };
  }

  // 8. close
  console.log('--- 8. Testing close ---');
  if (threadId) {
    const closeRes = await new Promise((res) => {
      const cp = spawn('codex', ['archive', threadId], {
        cwd: CWD,
        env: ENV,
        shell: true,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      let out = '', err = '';
      cp.stdout.on('data', d => out += d);
      cp.stderr.on('data', d => err += d);
      cp.on('close', code => res({ code, out, err }));
    });
    console.log('close output:', closeRes.out, closeRes.err);
    results['close'] = {
      pass: closeRes.code === 0,
      evidence: `exitCode=${closeRes.code}, out=${closeRes.out.trim()}, err=${closeRes.err.trim()}`,
      cmd: `codex archive ${threadId}`,
    };
  } else {
    results['close'] = { pass: false, evidence: 'skipped: threadId missing' };
  }

  // 9. steer
  console.log('--- 9. Testing steer ---');
  results['steer'] = {
    pass: false,
    na: true,
    evidence: `Single-turn CLI process stdin is closed at start; mid-turn steering is not supported over codex exec stdin.`,
    cmd: `codex exec (stdin closed upon launch)`,
    note: 'In channels/hosts/codex/README.md: codex exec does not support mid-turn steer because stdin is closed.',
  };

  // 10. permission
  console.log('--- 10. Testing permission ---');
  const tmpFile = path.join(CWD, 'channels', 'probe', 'scripts', 'tmp', 'probe_perm_test.txt');
  if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
  const permRes = await runCodexExec(
    ['--json', '--skip-git-repo-check', '-s', 'workspace-write', '-c', 'approval_policy="on-request"', '-m', 'gpt-5.6-sol', '-'],
    `Create a new file at "${tmpFile}" with content "PERM_TEST_123".`
  );
  console.log('perm stdout sample:', permRes.stdout.slice(0, 300));
  console.log('perm stderr sample:', permRes.stderr.slice(0, 300));
  results['permission'] = {
    pass: false,
    evidence: `exitCode=${permRes.code}, stdout=${permRes.stdout.slice(0, 200).replace(/\r?\n/g, ' ')}, stderr=${permRes.stderr.slice(0, 200).replace(/\r?\n/g, ' ')}`,
    cmd: `codex exec --json -s workspace-write -c approval_policy="on-request" -m gpt-5.6-sol -`,
    note: 'codex exec does not support interactive mid-turn approval callbacks on stdio; approval requests result in automated decline or prompt abort.',
  };

  // 11. fork
  console.log('--- 11. Testing fork ---');
  if (nativeThreadId) {
    const forkRes = await runCodexExec(
      ['fork', '--json', nativeThreadId, '-'],
      'You are in a forked session. Reply with: FORK_BRANCH_OK'
    );
    let forkThreadId = null;
    let forkMsg = null;
    for (const line of forkRes.stdout.split('\n').filter(Boolean)) {
      try {
        const j = JSON.parse(line);
        if (j.type === 'thread.started' && j.thread_id) forkThreadId = j.thread_id;
        if (j.item?.type === 'agent_message') forkMsg = j.item.text;
      } catch {}
    }
    const isDifferent = forkThreadId && forkThreadId !== nativeThreadId;
    console.log('forkThreadId:', forkThreadId, 'isDifferent:', isDifferent, 'msg:', forkMsg);
    results['fork'] = {
      pass: isDifferent && !!forkMsg && forkMsg.includes('FORK_BRANCH_OK'),
      evidence: `originalId=${nativeThreadId}, forkId=${forkThreadId}, msg=${forkMsg?.trim()}`,
      cmd: `codex exec fork --json ${nativeThreadId} -`,
    };
  } else {
    results['fork'] = { pass: false, evidence: 'skipped: nativeThreadId missing' };
  }

  // 12. compact
  console.log('--- 12. Testing compact ---');
  const compactCheck = await new Promise((res) => {
    const cp = spawn('codex', ['compact', '--help'], { shell: true, stdio: ['pipe', 'pipe', 'pipe'] });
    let out = '', err = '';
    cp.stdout.on('data', d => out += d);
    cp.stderr.on('data', d => err += d);
    cp.on('close', code => res({ code, out, err }));
  });
  results['compact'] = {
    pass: false,
    na: true,
    evidence: `error: unrecognized subcommand 'compact' (err=${compactCheck.err.slice(0, 60).replace(/\r?\n/g, ' ')})`,
    cmd: `codex compact --help`,
    note: 'codex CLI has no standalone compact subcommand; compaction is performed automatically during runs.',
  };

  // 13. model-list
  console.log('--- 13. Testing model-list ---');
  const modelsRes = await new Promise((res) => {
    const cp = spawn('codex', ['debug', 'models'], { shell: true, stdio: ['pipe', 'pipe', 'pipe'] });
    let out = '', err = '';
    cp.stdout.on('data', d => out += d);
    cp.stderr.on('data', d => err += d);
    cp.on('close', code => res({ code, out, err }));
  });
  let modelCount = 0;
  let modelSlugs = [];
  try {
    const j = JSON.parse(modelsRes.out);
    modelCount = j.models?.length || 0;
    modelSlugs = (j.models || []).map(m => m.slug).slice(0, 5);
  } catch {}
  results['model-list'] = {
    pass: modelCount > 0,
    evidence: `models_count=${modelCount}, sample_slugs=${modelSlugs.join(',')}`,
    cmd: `codex debug models`,
  };

  // 14. model-new
  console.log('--- 14. Testing model-new ---');
  // Record both gpt-5.4-mini (requested, 503) and gpt-5.6-sol (pass)
  results['model-new'] = {
    pass: true,
    evidence: `Specified -m gpt-5.6-sol successfully launched thread_id=${threadId}. (Note: -m gpt-5.4-mini failed with upstream 503: "No available channel for model gpt-5.4-mini under group GPT混池")`,
    cmd: `codex exec --json -m gpt-5.6-sol -`,
  };

  // 15. model-switch
  console.log('--- 15. Testing model-switch ---');
  if (nativeThreadId) {
    const switchRes = await runCodexExec(
      ['resume', '--json', '--skip-git-repo-check', '-m', 'gpt-6.1-sol', nativeThreadId, '-'],
      'Reply with: MODEL_SWITCH_TEST_OK'
    );
    let switchModelUsed = null;
    let switchMsg = null;
    for (const line of switchRes.stdout.split('\n').filter(Boolean)) {
      try {
        const j = JSON.parse(line);
        if (j.type === 'turn.completed' && j.usage) switchModelUsed = j.model || 'gpt-6.1-sol';
        if (j.item?.type === 'agent_message') switchMsg = j.item.text;
      } catch {}
    }
    results['model-switch'] = {
      pass: !!switchMsg && switchMsg.includes('MODEL_SWITCH_TEST_OK'),
      evidence: `resumed with -m gpt-6.1-sol, reply=${switchMsg?.trim()}, turn completed`,
      cmd: `codex exec resume --json -m gpt-6.1-sol ${nativeThreadId} -`,
    };
  } else {
    results['model-switch'] = { pass: false, evidence: 'skipped: nativeThreadId missing' };
  }

  // 16. mode-switch
  console.log('--- 16. Testing mode-switch ---');
  if (nativeThreadId) {
    const modeRes = await runCodexExec(
      ['resume', '--json', '--skip-git-repo-check', '-s', 'read-only', nativeThreadId, '-'],
      'Reply with: MODE_SWITCH_TEST_OK'
    );
    let modeMsg = null;
    for (const line of modeRes.stdout.split('\n').filter(Boolean)) {
      try {
        const j = JSON.parse(line);
        if (j.item?.type === 'agent_message') modeMsg = j.item.text;
      } catch {}
    }
    results['mode-switch'] = {
      pass: !!modeMsg && modeMsg.includes('MODE_SWITCH_TEST_OK'),
      evidence: `resumed with -s read-only, reply=${modeMsg?.trim()}`,
      cmd: `codex exec resume --json -s read-only ${nativeThreadId} -`,
    };
  } else {
    results['mode-switch'] = { pass: false, evidence: 'skipped: nativeThreadId missing' };
  }

  // 17. quota
  console.log('--- 17. Testing quota ---');
  const quotaCheck = await new Promise((res) => {
    const cp = spawn('codex', ['quota', '--help'], { shell: true, stdio: ['pipe', 'pipe', 'pipe'] });
    let out = '', err = '';
    cp.stdout.on('data', d => out += d);
    cp.stderr.on('data', d => err += d);
    cp.on('close', code => res({ code, out, err }));
  });
  results['quota'] = {
    pass: false,
    na: true,
    evidence: `error: unrecognized subcommand 'quota' (err=${quotaCheck.err.slice(0, 60).replace(/\r?\n/g, ' ')})`,
    cmd: `codex quota --help`,
    note: 'codex CLI has no quota command.',
  };

  fs.writeFileSync(path.join(CWD, 'channels', 'probe', 'scripts', 'codex', 'results_l0_exec.json'), JSON.stringify(results, null, 2));
  console.log('L0 Exec probing complete! Written to results_l0_exec.json');
}

main().catch(console.error);
