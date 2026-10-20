import { spawn, type ChildProcess } from 'node:child_process';
import readline from 'node:readline';
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

/**
 * A resident connection to one product's ACP bridge (JSON-RPC 2.0 over stdio), instead of one acpx process per
 * turn. One bridge process per (product, working folder); it holds any number of sessions.
 *
 * What it does not decide: which command starts the bridge and with what environment (the caller passes them,
 * read from ~/.acpx/config.json and hub/data/products.json), which model a session uses, how a permission ask is
 * answered (the caller's onApprovalRequest). Every notification and server request is re-emitted as 'frame', so
 * the caller parses the stream exactly as it parses acpx's `--format json` output.
 */

export interface AcpBridgeConfig {
  cmd: string;
  args: string[];
  env: NodeJS.ProcessEnv;
}

export interface AcpPermissionRequest {
  sessionId: string;
  toolCall: {
    toolCallId?: string;
    title?: string;
    kind?: string;
    rawInput?: Record<string, any>;
    content?: any[];
    status?: string;
    locations?: Array<{ path: string }>;
    _meta?: Record<string, any>;
  };
  options: Array<{
    optionId: string;
    kind: 'allow_once' | 'allow_always' | 'reject_once' | 'reject_always' | string;
    name?: string;
  }>;
  raw: any;
}

/** A kind of option to pick, or one option by id (an agent's question that came as a permission ask: the options are its answers). */
export type AcpApprovalDecision = 'allow_once' | 'allow_always' | 'reject_once' | 'reject_always' | 'cancel' | { optionId: string };

export interface AcpDriverOptions {
  /** Product id, only for messages. */
  product: string;
  cwd: string;
  bridge: AcpBridgeConfig;
  onApprovalRequest?: (req: AcpPermissionRequest) => Promise<AcpApprovalDecision> | AcpApprovalDecision;
}

export interface AcpTurnResult {
  sessionId: string;
  status: 'completed' | 'cancelled' | 'failed';
  stopReason?: string;
  text: string;
  durationMs: number;
  raw?: any;
}

/** What the agent said about a session when it was created or loaded. */
export interface AcpSessionInfo {
  sessionId: string;
  currentModel?: string;
  availableModels?: string[];
  configOptions?: any[];
  currentMode?: string;
  availableModes?: string[];
}

/**
 * The bridge command for an acpx agent name: the argv acpx itself uses (~/.acpx/config.json agents.<name>.argv),
 * else `<name> acp` (OpenCode). A bare command name goes through cmd.exe so .cmd shims resolve on Windows.
 */
export function resolveAcpBridgeCommand(acpxAgent: string): { cmd: string; args: string[] } {
  let argv: string[] = [acpxAgent, 'acp'];
  try {
    const cfg = JSON.parse(fs.readFileSync(path.join(os.homedir(), '.acpx', 'config.json'), 'utf8'));
    const a = cfg?.agents?.[acpxAgent]?.argv;
    if (Array.isArray(a) && a.length) argv = a.map(String);
  } catch {}
  if (process.platform === 'win32' && !path.isAbsolute(argv[0])) {
    return { cmd: 'cmd.exe', args: ['/d', '/s', '/c', ...argv] };
  }
  return { cmd: argv[0], args: argv.slice(1) };
}

export class AcpResidentDriver extends EventEmitter {
  public readonly product: string;
  public readonly cwd: string;
  /** Last time a turn started or ended here; the caller closes idle bridges. */
  public lastUsedAt = Date.now();
  public agentCapabilities: any = null;
  private readonly bridge: AcpBridgeConfig;
  private childProcess: ChildProcess | null = null;
  private starting: Promise<void> | null = null;
  private reqId = 1;
  private pendingRequests = new Map<number, { method: string; res: (val: any) => void; rej: (err: any) => void }>();
  private activeTurns = new Map<string, { text: string }>();
  private sessions = new Map<string, AcpSessionInfo>();
  /** Slash commands each session announced (available_commands_update); kept apart because they can arrive before session/new answers. */
  private commands = new Map<string, Array<{ name: string; description: string; hint: string }>>();
  private onApprovalRequest?: AcpDriverOptions['onApprovalRequest'];
  private stderrTail = '';
  /**
   * session/new and session/load go one at a time on a bridge: two session/new sent together to WorkBuddy came back
   * with the same session id (10-19), and two hub sessions then shared one agent session.
   */
  private sessionQueue: Promise<unknown> = Promise.resolve();
  private serial<T>(fn: () => Promise<T>): Promise<T> {
    const next = this.sessionQueue.then(fn, fn);
    this.sessionQueue = next.catch(() => undefined);
    return next;
  }

  constructor(options: AcpDriverOptions) {
    super();
    this.product = options.product;
    this.cwd = options.cwd;
    this.bridge = options.bridge;
    this.onApprovalRequest = options.onApprovalRequest;
  }

  get alive(): boolean {
    return Boolean(this.childProcess) && !this.starting;
  }

  get busy(): boolean {
    return this.activeTurns.size > 0;
  }

  /** Start the bridge and finish the initialize handshake (once). */
  public start(): Promise<void> {
    if (this.childProcess && !this.starting) return Promise.resolve();
    if (this.starting) return this.starting;
    this.starting = (async () => {
      const cp = spawn(this.bridge.cmd, this.bridge.args, {
        cwd: this.cwd,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: this.bridge.env,
        windowsHide: true,
      });
      this.childProcess = cp;
      readline.createInterface({ input: cp.stdout! }).on('line', (line) => this.handleLine(line));
      cp.stderr?.on('data', (d) => {
        this.stderrTail = (this.stderrTail + d.toString()).slice(-2000);
        this.emit('stderr', d.toString());
      });
      cp.on('error', (err) => this.shutdown(`桥进程起不来：${err.message}`));
      cp.on('exit', (code, signal) => {
        this.shutdown(`桥进程退出（code=${code}${signal ? ' signal=' + signal : ''}）${this.stderrTail ? '：' + this.stderrTail.trim().slice(-300) : ''}`);
        this.emit('exit', { code, signal });
      });
      const init = await this.call('initialize', {
        protocolVersion: 1,
        clientInfo: { name: 'agent-hub-acp-resident', version: '2.0.0' },
        // fs is answered below; terminal/* is not, so it is not offered (the agent then runs commands itself).
        clientCapabilities: { fs: { readTextFile: true, writeTextFile: true }, terminal: false },
      });
      this.agentCapabilities = init?.agentCapabilities || null;
    })().finally(() => {
      this.starting = null;
    });
    return this.starting;
  }

  public getSession(sessionId: string): AcpSessionInfo | undefined {
    return this.sessions.get(sessionId);
  }

  public getCommands(sessionId: string): Array<{ name: string; description: string; hint: string }> {
    return this.commands.get(sessionId) || [];
  }

  /** session/new in the given folder. */
  public async createSession(cwd: string): Promise<AcpSessionInfo> {
    await this.start();
    const res = await this.serial(() => this.call('session/new', { cwd, mcpServers: [] }));
    if (!res?.sessionId) throw new Error(`${this.product} session/new 没给会话编号：${JSON.stringify(res).slice(0, 200)}`);
    return this.remember(res.sessionId, res);
  }

  /** session/load an existing session (the agent replays its history as session/update, which nobody listens to yet). */
  public async loadSession(sessionId: string, cwd: string): Promise<AcpSessionInfo> {
    await this.start();
    if (this.agentCapabilities && this.agentCapabilities.loadSession === false) {
      throw new Error(`${this.product} 不支持 session/load`);
    }
    const res = await this.serial(() => this.call('session/load', { sessionId, cwd, mcpServers: [] }));
    return this.remember(sessionId, res || {});
  }

  /** One turn. Resolves when the agent answers session/prompt; text is what streamed as agent_message_chunk. */
  public async promptTurn(sessionId: string, prompt: string | any[]): Promise<AcpTurnResult> {
    const started = Date.now();
    this.lastUsedAt = started;
    this.activeTurns.set(sessionId, { text: '' });
    try {
      const resp = await this.call('session/prompt', {
        sessionId,
        prompt: typeof prompt === 'string' ? [{ type: 'text', text: prompt }] : prompt,
      });
      const text = this.activeTurns.get(sessionId)?.text || '';
      return {
        sessionId,
        status: resp?.stopReason === 'cancelled' ? 'cancelled' : 'completed',
        stopReason: resp?.stopReason || 'end_turn',
        text: text.trim(),
        durationMs: Date.now() - started,
        raw: resp,
      };
    } finally {
      this.activeTurns.delete(sessionId);
      this.lastUsedAt = Date.now();
    }
  }

  /** Interrupt the running turn (a notification; session/prompt then answers with stopReason "cancelled"). */
  public cancelTurn(sessionId: string): void {
    this.notify('session/cancel', { sessionId });
  }

  /** session/set_mode, else the config-option form. Throws when the agent takes neither. */
  public async setSessionMode(sessionId: string, modeId: string): Promise<void> {
    await this.setEither(sessionId, 'session/set_mode', { sessionId, modeId }, 'mode', modeId);
    const s = this.sessions.get(sessionId);
    if (s) s.currentMode = modeId;
  }

  /** session/set_model, else the config-option form. Throws when the agent takes neither. */
  public async setSessionModel(sessionId: string, modelId: string): Promise<void> {
    await this.setEither(sessionId, 'session/set_model', { sessionId, modelId }, 'model', modelId);
    const s = this.sessions.get(sessionId);
    if (s) s.currentModel = modelId;
  }

  public async close(): Promise<void> {
    const cp = this.childProcess;
    this.shutdown('关闭');
    if (cp && !cp.killed) {
      if (process.platform === 'win32' && cp.pid) {
        try {
          await new Promise<void>((resolve, reject) => {
            const killer = spawn('taskkill', ['/pid', String(cp.pid), '/t', '/f'], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'], timeout: 5000 });
            let stderr = '';
            killer.stderr?.on('data', (data) => { stderr += data.toString(); });
            killer.on('error', reject);
            killer.on('close', (code) => code === 0 ? resolve() : reject(new Error(`Closing ${this.product} bridge ${cp.pid} failed (${code}): ${stderr.trim()}`)));
          });
        } finally {
          // Descendants may inherit pipes; the closed driver must release its local handles too.
          cp.stdin?.destroy();
          cp.stdout?.destroy();
          cp.stderr?.destroy();
          cp.unref();
        }
      } else {
        cp.kill();
      }
    }
  }

  // ---- JSON-RPC ----

  private async setEither(sessionId: string, method: string, params: any, configId: string, value: string) {
    let first: any;
    try {
      await this.call(method, params);
      return;
    } catch (e) {
      first = e;
    }
    try {
      await this.call('session/set_config_option', { sessionId, configId, value });
    } catch (e: any) {
      throw new Error(`${this.product} 不接受 ${method}（${first?.message || first}）也不接受 set_config_option（${e?.message || e}）`);
    }
  }

  private remember(sessionId: string, res: any): AcpSessionInfo {
    const info: AcpSessionInfo = {
      sessionId,
      configOptions: res?.configOptions,
      currentModel: res?.models?.currentModelId,
      availableModels: Array.isArray(res?.models?.availableModels)
        ? res.models.availableModels.map((m: any) => String(m.modelId || m.id || m))
        : undefined,
      currentMode: res?.modes?.currentModeId,
      availableModes: Array.isArray(res?.modes?.availableModes)
        ? res.modes.availableModes.map((m: any) => String(m.id || m.modeId || m))
        : undefined,
    };
    this.sessions.set(sessionId, info);
    return info;
  }

  /** The bridge is gone: fail whatever was waiting on it. */
  private shutdown(reason: string) {
    this.childProcess = null;
    this.sessions.clear();
    for (const [id, p] of this.pendingRequests) {
      this.pendingRequests.delete(id);
      p.rej(new Error(`${this.product} ${p.method} 没有回音：${reason}`));
    }
  }

  private call(method: string, params: any): Promise<any> {
    const id = this.reqId++;
    return new Promise((res, rej) => {
      const stdin = this.childProcess?.stdin;
      if (!stdin || stdin.destroyed) {
        rej(new Error(`${this.product} 桥进程不在`));
        return;
      }
      this.pendingRequests.set(id, { method, res, rej });
      stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
    });
  }

  private write(payload: any): void {
    const stdin = this.childProcess?.stdin;
    if (stdin && !stdin.destroyed) stdin.write(JSON.stringify(payload) + '\n');
  }

  private notify(method: string, params: any): void {
    this.write({ jsonrpc: '2.0', method, params });
  }

  private handleLine(line: string): void {
    const trimmed = line.trim();
    if (!trimmed) return;
    let msg: any;
    try {
      msg = JSON.parse(trimmed);
    } catch {
      return;
    }

    // A response to one of our requests.
    if (msg.id !== undefined && msg.method === undefined) {
      const p = this.pendingRequests.get(msg.id);
      if (!p) return;
      this.pendingRequests.delete(msg.id);
      if (msg.error) {
        const details = msg.error.data?.details ? `（${String(msg.error.data.details).slice(0, 200)}）` : '';
        p.rej(new Error((msg.error.message || JSON.stringify(msg.error)) + details));
      } else {
        p.res(msg.result);
      }
      return;
    }

    this.emit('frame', msg);

    if (msg.method === 'session/update') {
      const sid = msg.params?.sessionId;
      const u = msg.params?.update;
      const turn = sid ? this.activeTurns.get(sid) : undefined;
      if (turn && u?.sessionUpdate === 'agent_message_chunk') turn.text += u.content?.text || '';
      if (sid && u?.sessionUpdate === 'available_commands_update' && Array.isArray(u.availableCommands)) {
        this.commands.set(
          sid,
          u.availableCommands.map((c: any) => ({ name: String(c.name), description: c.description ? String(c.description) : '', hint: c.input?.hint ? String(c.input.hint) : '' })),
        );
      }
      if (sid && u?.sessionUpdate === 'current_mode_update') {
        const s = this.sessions.get(sid);
        if (s) s.currentMode = u.currentModeId || u.modeId || s.currentMode;
      }
      return;
    }

    if (msg.id !== undefined && msg.method) this.handleServerRequest(msg);
  }

  private async handleServerRequest(msg: { id: number | string; method: string; params?: any }): Promise<void> {
    const { id, method, params } = msg;

    if (method === 'session/request_permission') {
      const req: AcpPermissionRequest = {
        sessionId: params?.sessionId,
        toolCall: params?.toolCall || {},
        options: params?.options || [],
        raw: params,
      };
      let decision: AcpApprovalDecision = 'reject_once';
      try {
        decision = this.onApprovalRequest ? await this.onApprovalRequest(req) : 'reject_once';
      } catch {}
      if (decision === 'cancel') {
        this.write({ jsonrpc: '2.0', id, result: { outcome: { outcome: 'cancelled' } } });
        return;
      }
      if (typeof decision === 'object') {
        this.write({ jsonrpc: '2.0', id, result: { outcome: { outcome: 'selected', optionId: decision.optionId } } });
        return;
      }
      const allow = decision.startsWith('allow');
      const opt =
        req.options.find((o) => o.kind === decision || o.optionId === decision) ||
        req.options.find((o) => String(o.kind).startsWith(allow ? 'allow' : 'reject'));
      if (!opt) {
        this.write({ jsonrpc: '2.0', id, result: { outcome: { outcome: 'cancelled' } } });
        return;
      }
      this.write({ jsonrpc: '2.0', id, result: { outcome: { outcome: 'selected', optionId: opt.optionId } } });
      return;
    }

    // The agent asks the client to write or read a file (offered in initialize; WorkBuddy uses it after an approval).
    if (method === 'fs/write_text_file') {
      try {
        if (params?.path && typeof params.content === 'string') {
          fs.mkdirSync(path.dirname(params.path), { recursive: true });
          fs.writeFileSync(params.path, params.content, 'utf8');
        }
        this.write({ jsonrpc: '2.0', id, result: {} });
      } catch (err: any) {
        this.write({ jsonrpc: '2.0', id, error: { code: -32000, message: err.message } });
      }
      return;
    }
    if (method === 'fs/read_text_file') {
      try {
        let content = fs.readFileSync(params?.path, 'utf8');
        if (params?.line || params?.limit) {
          const lines = content.split('\n');
          const from = Math.max(0, (params.line || 1) - 1);
          content = lines.slice(from, params.limit ? from + params.limit : undefined).join('\n');
        }
        this.write({ jsonrpc: '2.0', id, result: { content } });
      } catch (err: any) {
        this.write({ jsonrpc: '2.0', id, error: { code: -32000, message: err.message } });
      }
      return;
    }

    this.write({ jsonrpc: '2.0', id, error: { code: -32601, message: `Method not implemented: ${method}` } });
  }
}
