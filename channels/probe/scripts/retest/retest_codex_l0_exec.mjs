import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const CWD = 'E:\\program\\GIT\\Agent\\multi\\Agent-Architecture-Hub';
const OUT_DIR = path.join(CWD, 'channels', 'probe', 'scripts', 'retest', 'output');
fs.mkdirSync(OUT_DIR, { recursive: true });

const ENV = {
  ...process.env,
  HTTP_PROXY: 'http://127.0.0.1:7892',
  HTTPS_PROXY: 'http://127.0.0.1:7892',
};

function runCodexExec(args, input = '', timeoutMs = 60000) {
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
    const events = [];

    cp.stdout.on('data', (d) => {
      const s = d.toString();
      stdout += s;
      for (const line of s.split('\n')) {
        const trimmed = line.trim();
        if (trimmed) {
          try {
            events.push(JSON.parse(trimmed));
          } catch {}
        }
      }
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
      resolve({ code: -1, timedOut: true, stdout, stderr, events, duration: Date.now() - start });
    }, timeoutMs);

    cp.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code, timedOut: false, stdout, stderr, events, duration: Date.now() - start });
    });
  });
}

async function main() {
  console.log('=== [Retest 1] codex/L0/exec fork ===');
  const secret = 'PROBE_FORK_SECRET_8819';

  // 1. Create parent session
  console.log('1. Starting parent session...');
  const parentRes = await runCodexExec(
    ['--json', '--skip-git-repo-check', '-m', 'gpt-5.6-sol', '-'],
    `Remember secret code: ${secret}. Reply with: SAVED.`
  );

  let parentThreadId = null;
  let parentReply = null;
  for (const ev of parentRes.events) {
    if (ev.type === 'thread.started' && ev.thread_id) parentThreadId = ev.thread_id;
    if (ev.type === 'item.completed' && ev.item?.type === 'agent_message') parentReply = ev.item.text;
  }

  console.log('Parent threadId:', parentThreadId, 'reply:', parentReply?.trim());
  if (!parentThreadId) {
    console.error('Failed to get parent threadId:', parentRes.stderr);
    fs.writeFileSync(path.join(OUT_DIR, 'codex_l0_exec_fork.json'), JSON.stringify({ error: 'parent failed', parentRes }, null, 2));
    process.exit(1);
  }

  // 2. Fork from parent session
  console.log('2. Forking parent session...');
  const forkRes = await runCodexExec(
    ['fork', '--json', '--skip-git-repo-check', '-m', 'gpt-5.6-sol', parentThreadId, '-'],
    'What was the secret code in our previous conversation? Reply ONLY with the exact code.'
  );

  let forkThreadId = null;
  let forkReply = null;
  let forkCompletedItem = null;
  for (const ev of forkRes.events) {
    if (ev.type === 'thread.started' && ev.thread_id) forkThreadId = ev.thread_id;
    if (ev.type === 'item.completed' && ev.item?.type === 'agent_message') {
      forkReply = ev.item.text;
      forkCompletedItem = ev;
    }
  }

  console.log('Fork threadId:', forkThreadId, 'reply:', forkReply?.trim());

  const isDifferentThread = forkThreadId && forkThreadId !== parentThreadId;
  const recalledSecret = forkReply && forkReply.includes(secret);

  const result = {
    pass: isDifferentThread && recalledSecret,
    parentThreadId,
    forkThreadId,
    forkReply: forkReply?.trim(),
    rawCompletedEvent: forkCompletedItem,
    exitCode: forkRes.code,
  };

  fs.writeFileSync(path.join(OUT_DIR, 'codex_l0_exec_fork.json'), JSON.stringify(result, null, 2));
  console.log('Result saved:', JSON.stringify(result, null, 2));
}

main().catch(console.error);
