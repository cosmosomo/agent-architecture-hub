import { spawn } from 'node:child_process';
import readline from 'node:readline';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const cwd = 'E:\\program\\GIT\\Agent\\multi\\Agent-Architecture-Hub';
const codex = 'C:\\Users\\COLORFIRE\\AppData\\Roaming\\npm\\node_modules\\@openai\\codex\\node_modules\\@openai\\codex-win32-x64\\vendor\\x86_64-pc-windows-msvc\\bin\\codex.exe';

class AppServer {
  constructor() {
    this.nextId = 1;
    this.pending = new Map();
  }

  async start(codeHome) {
    this.child = spawn(codex, ['app-server', '--listen', 'stdio://'], {
      cwd,
      env: {
        ...process.env,
        CODEX_HOME: codeHome,
        HTTP_PROXY: 'http://127.0.0.1:7892',
        HTTPS_PROXY: 'http://127.0.0.1:7892',
      },
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    });
    this.child.stderr.on('data', (chunk) => process.stderr.write(chunk));
    this.child.on('error', (error) => {
      for (const request of this.pending.values()) request.reject(error);
      this.pending.clear();
    });
    this.lines = readline.createInterface({ input: this.child.stdout });
    this.lines.on('line', (line) => this.onLine(line));
    await this.request('initialize', {
      clientInfo: { name: 'codex-goal-persistence-probe', title: 'Goal persistence probe', version: '1.0.0' },
      capabilities: { experimentalApi: true, optOutNotificationMethods: [] },
    });
    this.notify('initialized');
  }

  onLine(line) {
    let message;
    try {
      message = JSON.parse(line);
    } catch (error) {
      console.error('Invalid app-server JSON frame:', line, error);
      return;
    }
    if (message.method && message.id !== undefined) {
      this.child.stdin.write(`${JSON.stringify({ id: message.id, error: { code: -32601, message: 'Probe does not handle reverse requests' } })}\n`);
      return;
    }
    if (message.id === undefined) return;
    const pending = this.pending.get(message.id);
    if (!pending) return;
    this.pending.delete(message.id);
    if (message.error) pending.reject(new Error(JSON.stringify(message.error)));
    else pending.resolve(message.result);
  }

  request(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`${method} timed out`));
      }, 15000);
      this.pending.set(id, {
        resolve: (value) => { clearTimeout(timer); resolve(value); },
        reject: (error) => { clearTimeout(timer); reject(error); },
      });
      this.child.stdin.write(`${JSON.stringify({ id, method, params })}\n`);
    });
  }

  notify(method) {
    this.child.stdin.write(`${JSON.stringify({ method, params: {} })}\n`);
  }

  async close() {
    if (!this.child) return;
    const child = this.child;
    const exited = new Promise((resolve) => child.once('exit', resolve));
    this.lines.close();
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGTERM');
    let timer;
    await Promise.race([
      exited,
      new Promise((resolve) => {
        timer = setTimeout(() => {
          if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
          resolve();
        }, 5000);
      }),
    ]);
    clearTimeout(timer);
    this.child = null;
  }
}

async function main() {
  const objective = `Persistence probe ${Date.now()}`;
  const codeHome = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-goal-home-'));
  let threadId;
  let server;
  try {
    server = new AppServer();
    await server.start(codeHome);
    const started = await server.request('thread/start', { cwd, ephemeral: false });
    threadId = started.thread.id;
    const setResult = await server.request('thread/goal/set', {
      threadId,
      objective,
      status: 'active',
      tokenBudget: 17,
    });
    const firstRead = await server.request('thread/goal/get', { threadId });
    await server.close();

    server = new AppServer();
    await server.start(codeHome);
    await server.request('thread/resume', { threadId, cwd });
    const resumedRead = await server.request('thread/goal/get', { threadId });
    const persisted = resumedRead.goal?.objective === objective && resumedRead.goal?.tokenBudget === 17;
    await server.request('thread/goal/clear', { threadId });
    const clearedRead = await server.request('thread/goal/get', { threadId });

    const result = {
      threadId,
      codeHome,
      setResult,
      firstRead: firstRead.goal,
      resumedRead: resumedRead.goal,
      persisted,
      clearVerified: clearedRead.goal === null,
      turnsStarted: false,
      cleanup: 'temporary CODEX_HOME removed after app-server shutdown',
    };
    console.log(JSON.stringify(result, null, 2));
    if (!persisted || !result.clearVerified) process.exitCode = 1;
  } catch (error) {
    console.error('Goal persistence probe failed:', error);
    process.exitCode = 1;
  } finally {
    if (server) await server.close();
    fs.rmSync(codeHome, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error('Fatal probe error:', error);
  process.exitCode = 1;
});
