import { spawn } from 'node:child_process';
import readline from 'node:readline';

const CWD = 'E:\\program\\GIT\\Agent\\multi\\Agent-Architecture-Hub';
const ENV = {
  ...process.env,
  HTTP_PROXY: 'http://127.0.0.1:7892',
  HTTPS_PROXY: 'http://127.0.0.1:7892',
};

async function testApproval() {
  console.log('Testing approval with approvalPolicy: "untrusted" ...');
  const cp = spawn('codex', ['app-server', '--listen', 'stdio://'], {
    cwd: CWD,
    env: ENV,
    shell: true,
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  const rl = readline.createInterface({ input: cp.stdout });
  let reqId = 1;
  const pending = new Map();
  let approvalReceived = null;

  function request(method, params = {}) {
    const id = reqId++;
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      cp.stdin.write(JSON.stringify({ id, method, params }) + '\n');
    });
  }

  rl.on('line', (line) => {
    try {
      const msg = JSON.parse(line);
      if (msg.id !== undefined && !msg.method) {
        const p = pending.get(msg.id);
        if (p) {
          pending.delete(msg.id);
          if (msg.error) p.reject(msg.error);
          else p.resolve(msg.result);
        }
      } else if (msg.id !== undefined && msg.method) {
        console.log(`[REVERSE REQUEST] id=${msg.id} method=${msg.method}`, JSON.stringify(msg.params));
        approvalReceived = msg;
        // Approve it!
        console.log(`[APPROVAL] Replying with accept for id=${msg.id}`);
        cp.stdin.write(JSON.stringify({ id: msg.id, result: { decision: 'accept' } }) + '\n');
      } else if (msg.method) {
        if (msg.method === 'serverRequest/resolved') {
          console.log('[NOTIF] serverRequest/resolved:', JSON.stringify(msg.params));
        } else if (msg.method === 'thread/status/changed') {
          console.log('[NOTIF] status:', JSON.stringify(msg.params?.status));
        } else if (msg.method === 'turn/completed') {
          console.log('[NOTIF] turn/completed:', msg.params?.turn?.status);
        }
      }
    } catch (e) {}
  });

  await request('initialize', {
    clientInfo: { name: 'test-approval', version: '0.1.0' },
    capabilities: { experimentalApi: true },
  });
  cp.stdin.write(JSON.stringify({ method: 'initialized', params: {} }) + '\n');

  const tStart = await request('thread/start', {
    cwd: CWD,
    model: 'gpt-6.1-sol',
    sandbox: 'workspace-write',
    approvalPolicy: 'untrusted',
  });
  const threadId = tStart.thread?.id;
  console.log('Thread started:', threadId);

  const turn = await request('turn/start', {
    threadId,
    input: [{ type: 'text', text: '请使用 Bash 或 Cmd 运行命令：echo APPROVAL_TEST_KEY_4482' }],
  });
  const turnId = turn.turn?.id;
  console.log('Turn started:', turnId);

  // Wait 40 seconds
  await new Promise((r) => setTimeout(r, 40000));
  cp.kill();
  console.log('Approval received:', approvalReceived !== null);
}

testApproval().catch(console.error);
