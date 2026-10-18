import { spawn, type ChildProcess } from 'node:child_process';
import readline from 'node:readline';
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

export function resolveCodexExecutable(): { bin: string; useShell: boolean } {
  if (process.platform === 'win32') {
    const npmRoot = path.join(os.homedir(), 'AppData', 'Roaming', 'npm', 'node_modules');
    const candidates = [
      path.join(npmRoot, '@openai', 'codex', 'node_modules', '@openai', 'codex-win32-x64', 'vendor', 'x86_64-pc-windows-msvc', 'bin', 'codex.exe'),
      path.join(npmRoot, '@openai', 'codex-win32-x64', 'vendor', 'x86_64-pc-windows-msvc', 'bin', 'codex.exe'),
      path.join(npmRoot, '@openai', 'codex', 'vendor', 'x86_64-pc-windows-msvc', 'bin', 'codex.exe'),
    ];
    for (const c of candidates) {
      if (fs.existsSync(c)) return { bin: c, useShell: false };
    }
  }
  return { bin: 'codex', useShell: process.platform === 'win32' };
}

export interface CodexAppServerOptions {
  cwd?: string;
  command?: string[];
  proxyUrl?: string;
  defaultModel?: string;
  defaultSandbox?: 'read-only' | 'workspace-write' | 'danger-full-access';
  defaultApprovalPolicy?: 'untrusted' | 'on-request' | 'never';
  autoApprove?: boolean;
  onApprovalRequest?: (request: ServerApprovalRequest) => Promise<ApprovalDecision> | ApprovalDecision;
  onUserInputRequest?: (request: ServerUserInputRequest) => Promise<Record<string, { answers: string[] }>> | Record<string, { answers: string[] }>;
}

export interface UserInputItem {
  type: 'text' | 'localImage' | 'skill' | 'mention';
  text?: string;
  path?: string;
  name?: string;
  [key: string]: any;
}

export type ApprovalDecision = 'accept' | 'acceptForSession' | 'decline' | 'cancel';

export interface ServerApprovalRequest {
  id: number | string;
  method: string;
  kind?: string;
  threadId: string;
  turnId?: string;
  itemId?: string;
  command?: string;
  cwd?: string;
  reason?: string;
  availableDecisions?: string[];
  raw: any;
}

export interface ServerUserInputRequest {
  id: number | string;
  threadId: string;
  turnId?: string;
  itemId?: string;
  questions: Array<{
    id: string;
    header?: string;
    question: string;
    options: Array<{ id: string; label: string; description?: string }>;
  }>;
  raw: any;
}

export interface ThreadStartOptions {
  cwd?: string;
  model?: string;
  modelProvider?: string;
  sandbox?: 'read-only' | 'workspace-write' | 'danger-full-access';
  approvalPolicy?: 'untrusted' | 'on-request' | 'never';
  approvalsReviewer?: 'user' | 'auto_review' | 'guardian_subagent';
  developerInstructions?: string;
  ephemeral?: boolean;
  config?: Record<string, any>;
  name?: string;
}

export interface TurnStartOptions {
  threadId: string;
  input: string | UserInputItem[];
  model?: string;
  effort?: 'none' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh' | 'ultra';
  outputSchema?: Record<string, any>;
  cwd?: string;
  /** Experimental collaboration mode; "plan" offers the request_user_input tool (Codex asking the person). */
  collaborationMode?: { mode: 'plan' | 'default'; settings: { model: string; reasoning_effort: string | null; developer_instructions: string | null } };
}

export interface ThreadForkOptions {
  threadId: string;
  lastTurnId?: string | null;
  beforeTurnId?: string | null;
  ephemeral?: boolean;
}

export interface TurnStatusResult {
  turnId: string;
  threadId: string;
  status: 'completed' | 'interrupted' | 'failed' | 'inProgress';
  error?: { message: string; codexErrorInfo?: any };
  durationMs?: number;
}

/**
 * Codex App Server 常驻驱动 (JSON-RPC 2.0 stdio 管道)
 *
 * 核心定位：
 * 1. 单常驻进程复用托管多会话（Thread），避免 codex exec 每轮冷启动；
 * 2. 具备轮内插话（turn/steer）、轮内打断（turn/interrupt）、上下文压缩（thread/compact/start）；
 * 3. 原生支持从任意历史轮次定点分叉（thread/fork）；
 * 4. 具备双向逆向 RPC 支持：外部拦截与应答 ServerRequest 审批（requestApproval）与提问（requestUserInput）；
 * 5. 全量事件流广播（turn/started, item/agentMessage/delta, item/completed, turn/completed, thread/status/changed 等）。
 */
export class CodexAppServerDriver extends EventEmitter {
  private cp: ChildProcess | null = null;
  private rl: readline.Interface | null = null;
  private reqId = 1;
  private pendingRequests = new Map<number | string, { resolve: (res: any) => void; reject: (err: any) => void; timeoutTimer?: NodeJS.Timeout }>();
  private loadedThreadIds = new Set<string>();
  private activeTurns = new Map<string, string>(); // threadId -> turnId
  private options: CodexAppServerOptions;
  private isInitialized = false;

  constructor(options: CodexAppServerOptions = {}) {
    super();
    this.options = {
      proxyUrl: 'http://127.0.0.1:7892',
      defaultSandbox: 'workspace-write',
      defaultApprovalPolicy: 'on-request',
      autoApprove: false,
      ...options,
    };
  }

  /**
   * 启动 codex app-server 子进程并完成握手 (initialize -> initialized)
   */
  async start(): Promise<{ userAgent: string; codexHome: string }> {
    if (this.cp) {
      throw new Error('CodexAppServerDriver is already running');
    }

    const env: NodeJS.ProcessEnv = {
      ...process.env,
      HTTP_PROXY: this.options.proxyUrl,
      HTTPS_PROXY: this.options.proxyUrl,
    };

    // 剔除可能干扰 Codex 的父进程环境变量
    delete env.CLAUDECODE;
    delete env.CLAUDE_CODE_ENTRY;

    const resolved = resolveCodexExecutable();
    const command = this.options.command || [resolved.bin, 'app-server', '--listen', 'stdio://'];
    const [bin, ...args] = command;

    this.cp = spawn(bin, args, {
      cwd: this.options.cwd || process.cwd(),
      env,
      shell: this.options.command ? process.platform === 'win32' : resolved.useShell,
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    this.rl = readline.createInterface({ input: this.cp.stdout! });
    this.rl.on('line', (line) => this.handleStdoutLine(line));

    this.cp.stderr?.on('data', (data) => {
      const errStr = data.toString();
      this.emit('stderr', errStr);
    });

    this.cp.on('exit', (code, signal) => {
      this.isInitialized = false;
      this.emit('exit', { code, signal });
      this.cleanupPending(new Error(`codex app-server exited with code ${code} signal ${signal}`));
    });

    this.cp.on('error', (err) => {
      this.emit('error', err);
      this.cleanupPending(err);
    });

    // 完成必选两步握手协议
    const initRes = await this.request('initialize', {
      clientInfo: {
        name: 'agent-architecture-hub',
        title: 'Agent Architecture Hub Driver',
        version: '0.2.0',
      },
      capabilities: {
        experimentalApi: true,
        optOutNotificationMethods: [],
      },
    });

    this.sendNotification('initialized', {});
    this.isInitialized = true;
    return initRes;
  }

  /**
   * 底层发送 JSON-RPC 请求并等待结果
   */
  request<T = any>(method: string, params: Record<string, any> = {}, timeoutMs = 120000): Promise<T> {
    if (!this.cp || !this.cp.stdin) {
      return Promise.reject(new Error('App-server process is not running'));
    }

    const id = this.reqId++;
    return new Promise<T>((resolve, reject) => {
      const timer = timeoutMs > 0 ? setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`RPC request '${method}' timed out after ${timeoutMs}ms (id=${id})`));
      }, timeoutMs) : undefined;

      this.pendingRequests.set(id, {
        resolve: (val) => {
          if (timer) clearTimeout(timer);
          resolve(val);
        },
        reject: (err) => {
          if (timer) clearTimeout(timer);
          reject(err);
        },
        timeoutTimer: timer,
      });

      const payload = JSON.stringify({ id, method, params }) + '\n';
      this.cp!.stdin!.write(payload, 'utf8');
    });
  }

  /**
   * 底层发送无 ID 的单向通知
   */
  sendNotification(method: string, params: Record<string, any> = {}): void {
    if (!this.cp || !this.cp.stdin) return;
    const payload = JSON.stringify({ method, params }) + '\n';
    this.cp.stdin.write(payload, 'utf8');
  }

  /**
   * 回应服务端发起的逆向请求 (ServerRequest)
   */
  sendResponse(id: number | string, result: any): void {
    if (!this.cp || !this.cp.stdin) return;
    const payload = JSON.stringify({ id, result }) + '\n';
    this.cp.stdin.write(payload, 'utf8');
  }

  sendError(id: number | string, error: { code: number; message: string; data?: any }): void {
    if (!this.cp || !this.cp.stdin) return;
    const payload = JSON.stringify({ id, error }) + '\n';
    this.cp.stdin.write(payload, 'utf8');
  }

  /**
   * 报文分发处理器
   */
  private handleStdoutLine(line: string): void {
    if (!line.trim()) return;
    let msg: any;
    try {
      msg = JSON.parse(line);
    } catch {
      return;
    }

    // 1. 服务端对客户端请求的响应：有 id，无 method
    if (msg.id !== undefined && !msg.method) {
      const pending = this.pendingRequests.get(msg.id);
      if (pending) {
        this.pendingRequests.delete(msg.id);
        if (msg.error) {
          pending.reject(msg.error);
        } else {
          pending.resolve(msg.result);
        }
      }
      return;
    }

    // 2. 服务端逆向请求 (ServerRequest)：有 id，有 method
    if (msg.id !== undefined && msg.method) {
      this.handleServerRequest(msg);
      return;
    }

    // 3. 服务端单向通知 (ServerNotification)：无 id，有 method
    if (msg.method && msg.id === undefined) {
      this.handleServerNotification(msg);
      return;
    }
  }

  /**
   * 处理服务端发来的审批与回调请求
   */
  private async handleServerRequest(msg: { id: number | string; method: string; params: any }): Promise<void> {
    const { id, method, params } = msg;

    // 审批类请求：命令执行审批、文件变更审批、权限审批
    if (
      method === 'item/commandExecution/requestApproval' ||
      method === 'item/fileChange/requestApproval' ||
      method === 'item/permissions/requestApproval' ||
      method === 'execCommandApproval' ||
      method === 'applyPatchApproval'
    ) {
      const approvalReq: ServerApprovalRequest = {
        id,
        method,
        kind: params?.kind,
        threadId: params?.threadId,
        turnId: params?.turnId,
        itemId: params?.itemId,
        command: params?.command,
        cwd: params?.cwd,
        reason: params?.reason,
        availableDecisions: params?.availableDecisions,
        raw: params,
      };

      this.emit('approval:requested', approvalReq);

      if (this.options.onApprovalRequest) {
        try {
          const decision = await this.options.onApprovalRequest(approvalReq);
          this.sendResponse(id, { decision });
          return;
        } catch (e: any) {
          this.sendResponse(id, { decision: 'decline' });
          return;
        }
      }

      if (this.options.autoApprove) {
        this.sendResponse(id, { decision: 'accept' });
        return;
      }

      // 默认安全拒绝，防止进程 hang 死
      this.sendResponse(id, { decision: 'decline' });
      return;
    }

    // 用户提问类逆向请求 (item/tool/requestUserInput)
    if (method === 'item/tool/requestUserInput') {
      const inputReq: ServerUserInputRequest = {
        id,
        threadId: params?.threadId,
        turnId: params?.turnId,
        itemId: params?.itemId,
        questions: params?.questions || [],
        raw: params,
      };

      this.emit('userInput:requested', inputReq);

      if (this.options.onUserInputRequest) {
        try {
          const answers = await this.options.onUserInputRequest(inputReq);
          this.sendResponse(id, { answers });
          return;
        } catch {
          this.sendError(id, { code: -32000, message: 'User input declined or cancelled' });
          return;
        }
      }

      this.sendError(id, { code: -32000, message: 'No handler configured for user input request' });
      return;
    }

    // 其它请求兜底
    this.emit('serverRequest:unhandled', msg);
    this.sendError(id, { code: -32601, message: `Method '${method}' not implemented by client driver` });
  }

  /**
   * 处理服务端通知流
   */
  private handleServerNotification(msg: { method: string; params: any; emittedAtMs?: number }): void {
    const { method, params } = msg;

    if (method === 'turn/started') {
      const turnId = params?.turn?.id;
      const threadId = params?.threadId;
      if (threadId && turnId) this.activeTurns.set(threadId, turnId);
    } else if (method === 'turn/completed') {
      const threadId = params?.threadId;
      if (threadId) this.activeTurns.delete(threadId);
    } else if (method === 'thread/status/changed') {
      const statusType = params?.status?.type;
      if (statusType === 'idle' || statusType === 'notLoaded') {
        const threadId = params?.threadId;
        if (threadId) this.activeTurns.delete(threadId);
      }
    }

    // 抛出泛型通知和具体命名通知
    this.emit('notification', msg);
    if (method === 'error') {
      this.emit('serverError', params);
    } else {
      this.emit(method, params);
    }
  }

  // ==========================================
  // 能力单元实现 (Capability Units)
  // ==========================================

  /**
   * 单元 1：新建会话 (open)
   * 对应 RPC: thread/start (+ thread/name/set 可选)
   */
  async startThread(opts: ThreadStartOptions = {}): Promise<{ threadId: string; thread: any }> {
    const params: Record<string, any> = {
      cwd: opts.cwd || this.options.cwd || process.cwd(),
      model: opts.model || this.options.defaultModel,
      sandbox: opts.sandbox || this.options.defaultSandbox,
      approvalPolicy: opts.approvalPolicy || this.options.defaultApprovalPolicy,
      ephemeral: opts.ephemeral || false,
      historyMode: 'paginated',
    };

    if (opts.modelProvider) params.modelProvider = opts.modelProvider;
    if (opts.approvalsReviewer) params.approvalsReviewer = opts.approvalsReviewer;
    if (opts.developerInstructions) params.developerInstructions = opts.developerInstructions;
    if (opts.config) params.config = opts.config;

    const res = await this.request('thread/start', params);
    const threadId = res.thread?.id;
    this.loadedThreadIds.add(threadId);

    if (opts.name) {
      await this.request('thread/name/set', { threadId, name: opts.name }).catch(() => {});
    }

    return { threadId, thread: res.thread };
  }

  /**
   * 单元 2：恢复会话 (resume)
   * 对应 RPC: thread/resume (冷态恢复) 或直接使用已加载的热态会话
   */
  async resumeThread(threadId: string, opts: Partial<ThreadStartOptions> = {}): Promise<string> {
    const loadedList = await this.listLoadedThreads();
    if (!loadedList.includes(threadId)) {
      const params: Record<string, any> = {
        threadId,
        excludeTurns: true,
        cwd: opts.cwd || this.options.cwd || process.cwd(),
        model: opts.model || this.options.defaultModel,
        sandbox: opts.sandbox || this.options.defaultSandbox,
        approvalPolicy: opts.approvalPolicy || this.options.defaultApprovalPolicy,
      };
      if (opts.modelProvider) params.modelProvider = opts.modelProvider;
      if (opts.developerInstructions) params.developerInstructions = opts.developerInstructions;
      if (opts.config) params.config = opts.config;

      await this.request('thread/resume', params);
      this.loadedThreadIds.add(threadId);
    }
    return threadId;
  }

  /**
   * 单元 3：发起一轮 (send / turn/start)
   * 对应 RPC: turn/start
   */
  async startTurn(opts: TurnStartOptions): Promise<{ turnId: string; turn: any }> {
    const inputItems: UserInputItem[] = typeof opts.input === 'string'
      ? [{ type: 'text', text: opts.input }]
      : opts.input;

    const params: Record<string, any> = {
      threadId: opts.threadId,
      input: inputItems,
    };

    if (opts.model) params.model = opts.model;
    if (opts.effort) params.effort = opts.effort;
    if (opts.outputSchema) params.outputSchema = opts.outputSchema;
    if (opts.cwd) params.cwd = opts.cwd;
    if (opts.collaborationMode) params.collaborationMode = opts.collaborationMode;

    const res = await this.request('turn/start', params);
    const turnId = res.turn?.id;
    this.activeTurns.set(opts.threadId, turnId);
    return { turnId, turn: res.turn };
  }

  /**
   * 单元 4：轮内插话 (steer)
   * 对应 RPC: turn/steer
   * 注意：必须传入当前正在进行的活跃轮 ID (expectedTurnId)
   */
  async steerTurn(threadId: string, expectedTurnId: string, input: string | UserInputItem[]): Promise<{ turnId: string }> {
    const inputItems: UserInputItem[] = typeof input === 'string'
      ? [{ type: 'text', text: input }]
      : input;

    const res = await this.request('turn/steer', {
      threadId,
      expectedTurnId,
      input: inputItems,
    });
    return res;
  }

  /**
   * 单元 5：轮内打断 (cancel / interrupt)
   * 对应 RPC: turn/interrupt
   */
  async interruptTurn(threadId: string, turnId?: string): Promise<void> {
    const targetTurnId = turnId || this.activeTurns.get(threadId);
    if (!targetTurnId) {
      throw new Error(`No active turn to interrupt for thread ${threadId}`);
    }
    await this.request('turn/interrupt', {
      threadId,
      turnId: targetTurnId,
    });
  }

  /**
   * 单元 6：会话分叉 (fork)
   * 对应 RPC: thread/fork
   */
  async forkThread(opts: ThreadForkOptions): Promise<{ forkedThreadId: string; thread: any }> {
    const params: Record<string, any> = {
      threadId: opts.threadId,
      ephemeral: opts.ephemeral || false,
    };
    if (opts.lastTurnId) params.lastTurnId = opts.lastTurnId;
    if (opts.beforeTurnId) params.beforeTurnId = opts.beforeTurnId;

    const res = await this.request('thread/fork', params);
    const forkedThreadId = res.thread?.id;
    this.loadedThreadIds.add(forkedThreadId);
    return { forkedThreadId, thread: res.thread };
  }

  /**
   * 单元 7：上下文压缩 (compact)
   * 对应 RPC: thread/compact/start
   * 关键规范：压缩会在后台启动一个系统级轮次 (turn_kind: Compact)，本方法默认等待压缩轮执行完毕，避免立即发下一轮抛出 ActiveTurnNotSteerable 错误。
   */
  async compactThread(threadId: string, waitToFinish = true, timeoutMs = 60000): Promise<{ turnId?: string }> {
    let compactTurnId: string | undefined;

    const turnStartedPromise = waitToFinish ? new Promise<string>((resolve) => {
      const onStarted = (params: any) => {
        if (params?.turn?.id) {
          compactTurnId = params.turn.id;
          this.off('turn/started', onStarted);
          resolve(params.turn.id);
        }
      };
      this.on('turn/started', onStarted);
    }) : Promise.resolve('');

    await this.request('thread/compact/start', { threadId });

    if (waitToFinish) {
      const turnId = await Promise.race([
        turnStartedPromise,
        new Promise<string>((_, reject) => setTimeout(() => reject(new Error('Timeout waiting for compact turn start')), 10000)),
      ]).catch(() => undefined);

      if (turnId) {
        await this.waitForTurn(turnId, timeoutMs);
      }
    }

    return { turnId: compactTurnId };
  }

  /**
   * 单元 8：会话级/中途切换模型 (model-switch)
   * 对应 RPC: thread/settings/update 或 turn/settings/update
   */
  async switchModel(threadId: string, model: string, effort?: 'none' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh' | 'ultra'): Promise<void> {
    const params: Record<string, any> = { threadId, model };
    if (effort) params.effort = effort;
    await this.request('thread/settings/update', params);
  }

  async switchTurnModel(threadId: string, turnId: string, model: string, effort?: string): Promise<void> {
    const params: Record<string, any> = { threadId, turnId, model };
    if (effort) params.effort = effort;
    await this.request('turn/settings/update', params);
  }

  /**
   * 单元 9：等待某轮结束 (wait)
   */
  waitForTurn(turnId: string, timeoutMs = 120000): Promise<TurnStatusResult> {
    const startTime = Date.now();
    return new Promise((resolve, reject) => {
      const onCompleted = (params: any) => {
        if (params?.turn?.id === turnId) {
          cleanup();
          resolve({
            turnId,
            threadId: params.threadId,
            status: params.turn.status,
            error: params.turn.error,
            durationMs: params.turn.durationMs,
          });
        }
      };

      const timer = setTimeout(() => {
        cleanup();
        reject(new Error(`Timeout waiting for turn ${turnId} after ${timeoutMs}ms`));
      }, timeoutMs);

      const cleanup = () => {
        clearTimeout(timer);
        this.off('turn/completed', onCompleted);
      };

      this.on('turn/completed', onCompleted);
    });
  }

  /**
   * 单元 10：读取会话与轮次 (read)
   * 对应 RPC: thread/read + thread/turns/list
   */
  async readThread(threadId: string): Promise<any> {
    const meta = await this.request('thread/read', { threadId });
    const turns = await this.listTurns(threadId);
    return {
      ...meta.thread,
      turns,
    };
  }

  async listTurns(threadId: string, limit = 50, cursor?: string | null): Promise<any[]> {
    const res = await this.request('thread/turns/list', { threadId, limit, cursor });
    if (Array.isArray(res.data)) return res.data;
    if (Array.isArray(res.data?.items)) return res.data.items;
    return [];
  }

  async listLoadedThreads(): Promise<string[]> {
    const res = await this.request('thread/loaded/list', {});
    return res.data || [];
  }

  async listModels(): Promise<any[]> {
    const res = await this.request('model/list', {});
    return res.data || [];
  }

  /**
   * 关闭常驻驱动
   */
  async close(): Promise<void> {
    this.isInitialized = false;
    this.cleanupPending(new Error('CodexAppServerDriver closed'));
    if (this.cp) {
      this.cp.kill();
      this.cp = null;
    }
    if (this.rl) {
      this.rl.close();
      this.rl = null;
    }
  }

  private cleanupPending(err: Error): void {
    for (const [id, req] of this.pendingRequests.entries()) {
      if (req.timeoutTimer) clearTimeout(req.timeoutTimer);
      req.reject(err);
    }
    this.pendingRequests.clear();
  }
}
