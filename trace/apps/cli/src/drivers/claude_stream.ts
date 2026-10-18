import { spawn, type ChildProcess } from 'node:child_process';
import readline from 'node:readline';
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';

export interface ClaudeStreamDriverOptions {
  cwd?: string;
  claudeBinaryPath?: string;
  proxyUrl?: string;
  defaultModel?: string;
  settingSources?: string;
  permissionMode?: 'default' | 'acceptEdits' | 'auto' | 'bypassPermissions' | 'manual' | 'dontAsk' | 'plan';
  autoApprove?: boolean;
  onApprovalRequest?: (request: ClaudeCanUseToolRequest) => Promise<ClaudeApprovalDecision> | ClaudeApprovalDecision;
}

export interface ClaudeCanUseToolRequest {
  requestId: string;
  sessionId: string;
  toolName: string;
  displayName?: string;
  input: Record<string, any>;
  toolUseId: string;
  description?: string;
  permissionSuggestions?: any[];
  raw: any;
}

export type ClaudeApprovalDecision = 'allow' | 'deny';

export interface ClaudeTurnResult {
  sessionId: string;
  uuid?: string;
  status: 'completed' | 'interrupted' | 'failed';
  resultText: string;
  stopReason?: string | null;
  durationMs?: number;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    cacheReadTokens?: number;
    cacheWriteTokens?: number;
    totalCostUsd?: number;
  };
  permissionDenials?: any[];
  raw: any;
}

export interface SessionStartOptions {
  sessionId?: string;
  resumeSessionId?: string;
  fork?: boolean;
  prompt?: string;
  cwd?: string;
  model?: string;
}

/**
 * 获取经过清洗的环境变量：
 * 1. 注入 HTTP_PROXY / HTTPS_PROXY；
 * 2. 剥离可能污染子进程的 CLAUDECODE / CLAUDE_* / ANTHROPIC_*；
 * 3. 动态从 ~/.claude/settings.json 载入 ANTHROPIC_* 变量与 NO_PROXY。
 */
export function getClaudeSanitizedEnv(proxyUrl = 'http://127.0.0.1:7892'): NodeJS.ProcessEnv {
  const cleanEnv: NodeJS.ProcessEnv = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (!/^(CLAUDECODE$|CLAUDE_|ANTHROPIC_)/.test(k)) {
      cleanEnv[k] = v;
    }
  }
  cleanEnv.HTTP_PROXY = proxyUrl;
  cleanEnv.HTTPS_PROXY = proxyUrl;

  try {
    const settingsPath = path.join(os.homedir(), '.claude', 'settings.json');
    if (fs.existsSync(settingsPath)) {
      const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
      for (const [k, v] of Object.entries(settings?.env || {})) {
        if (/^ANTHROPIC_/.test(k) && typeof v === 'string') {
          cleanEnv[k] = v;
        }
        if (k === 'NO_PROXY' && typeof v === 'string') {
          cleanEnv[k] = v;
        }
      }
    }
  } catch {}

  return cleanEnv;
}

/**
 * 探测本机安装的 claude 二进制程序路径
 */
export function resolveClaudeExecutable(overridePath?: string): string {
  if (overridePath && fs.existsSync(overridePath)) {
    return overridePath;
  }
  // Windows npm 全局原生二进制常见位置
  const winNpmNative = path.join(os.homedir(), 'AppData', 'Roaming', 'npm', 'node_modules', '@anthropic-ai', 'claude-code', 'bin', 'claude.exe');
  if (process.platform === 'win32' && fs.existsSync(winNpmNative)) {
    return winNpmNative;
  }
  return 'claude';
}

/**
 * Claude 单会话常驻进程实例 (流式 JSON-RPC 管道)
 * 对应原生命令：claude -p --input-format stream-json --output-format stream-json
 */
export class ClaudeStreamSession extends EventEmitter {
  public sessionId: string;
  public parentSessionId: string | null = null;
  public isFork = false;
  private cp: ChildProcess | null = null;
  private rl: readline.Interface | null = null;
  private options: ClaudeStreamDriverOptions;
  private pendingControlRequests = new Map<string, { resolve: (res: any) => void; reject: (err: any) => void; timeout?: NodeJS.Timeout }>();
  private pendingTurns: Array<{ resolve: (res: ClaudeTurnResult) => void; reject: (err: any) => void; startedAt: number }> = [];
  private isAlive = false;
  /** The slash commands Claude Code lists in its system/init message (filled after the first turn). */
  public slashCommands: string[] = [];
  private currentTurnEvents: any[] = [];
  private cwd: string;

  constructor(sessionId: string, options: ClaudeStreamDriverOptions = {}) {
    super();
    this.sessionId = sessionId;
    this.options = {
      proxyUrl: 'http://127.0.0.1:7892',
      defaultModel: 'haiku',
      settingSources: 'project,local', // 隔离 user 设置源，杜绝 agents 关键词污染 (HELLO_CHECK)
      permissionMode: 'default',
      autoApprove: false,
      ...options,
    };
    this.cwd = this.options.cwd || process.cwd();
  }

  get running(): boolean {
    return this.isAlive;
  }

  get hasActiveTurn(): boolean {
    return this.pendingTurns.length > 0;
  }

  /**
   * 启动常驻子进程并完成握手
   */
  async start(mode: 'new' | 'resume' | 'fork' = 'new', parentId?: string): Promise<{ sessionId: string }> {
    if (this.cp) {
      throw new Error(`ClaudeStreamSession ${this.sessionId} is already running`);
    }

    const exe = resolveClaudeExecutable(this.options.claudeBinaryPath);
    const args = [
      '-p',
      '--output-format', 'stream-json',
      '--verbose',
      '--model', this.options.defaultModel || 'haiku',
      '--strict-mcp-config',
      '--setting-sources', this.options.settingSources || 'project,local',
      '--permission-prompts', 'host',
      '--permission-prompt-tool', 'stdio',
      '--input-format', 'stream-json',
    ];

    if (mode === 'new') {
      args.push('--session-id', this.sessionId);
    } else if (mode === 'resume') {
      args.push('--resume', this.sessionId);
    } else if (mode === 'fork') {
      this.isFork = true;
      this.parentSessionId = parentId || this.sessionId;
      args.push('--resume', this.parentSessionId, '--fork-session');
    }

    const env = getClaudeSanitizedEnv(this.options.proxyUrl);

    this.cp = spawn(exe, args, {
      cwd: this.cwd,
      env,
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    this.isAlive = true;

    this.rl = readline.createInterface({ input: this.cp.stdout!, crlfDelay: Infinity });
    this.rl.on('line', (line) => this.handleStdoutLine(line));

    this.cp.stderr?.on('data', (data) => {
      this.emit('stderr', data.toString());
    });

    this.cp.on('close', (code, signal) => {
      this.isAlive = false;
      this.emit('exit', { code, signal });
      this.cleanupPending(new Error(`Claude process exited with code ${code}`));
    });

    this.cp.on('error', (err) => {
      this.isAlive = false;
      this.emit('error', err);
      this.cleanupPending(err);
    });

    // 握手逻辑：新建会话发送 initialize 控制请求；恢复/分叉会话进程就绪即可接收输入（system.init 会在首个输入进入后由服务端推送）
    if (mode === 'new') {
      await this.sendControlRequest('init-' + crypto.randomUUID().slice(0, 8), 'initialize', {}, 45000);
    }

    return { sessionId: this.sessionId };
  }

  /**
   * 提交一轮用户输入
   * 若当前已有活跃轮，Claude Code 会自动排队并在当前轮结束后作为下一轮独立执行 (inject-next)
   */
  async submit(prompt: string, timeoutMs = 120000): Promise<ClaudeTurnResult> {
    if (!this.cp || !this.isAlive) {
      throw new Error(`ClaudeStreamSession ${this.sessionId} is not running`);
    }

    const startedAt = Date.now();
    const turnPromise = new Promise<ClaudeTurnResult>((resolve, reject) => {
      const timer = setTimeout(() => {
        const idx = this.pendingTurns.findIndex((t) => t.resolve === resolve);
        if (idx !== -1) {
          this.pendingTurns.splice(idx, 1);
          reject(new Error(`Turn timed out after ${timeoutMs}ms`));
        }
      }, timeoutMs);

      this.pendingTurns.push({
        resolve: (res) => {
          clearTimeout(timer);
          resolve(res);
        },
        reject: (err) => {
          clearTimeout(timer);
          reject(err);
        },
        startedAt,
      });
    });

    const userMsg = {
      type: 'user',
      message: {
        role: 'user',
        content: [{ type: 'text', text: prompt }],
      },
      parent_tool_use_id: null,
      session_id: 'default',
    };

    this.writeLine(userMsg);
    return turnPromise;
  }

  /**
   * 中途打断当前正在生成或执行工具的轮次 (interrupt)
   * Claude Code 会返回带 error_during_execution 的 result 事件，进程保留在热待命状态
   */
  async interrupt(): Promise<boolean> {
    if (!this.cp || !this.isAlive) return false;
    const reqId = 'int-' + crypto.randomUUID().slice(0, 8);
    try {
      await this.sendControlRequest(reqId, 'interrupt', {}, 10000);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 会话中途热切模型 (set_model 控制协议)
   */
  async switchModel(model: string): Promise<boolean> {
    const reqId = 'model-' + crypto.randomUUID().slice(0, 8);
    const resp = await this.sendControlRequest(reqId, 'set_model', { model }, 10000);
    return resp?.subtype === 'success';
  }

  /**
   * 会话中途切换权限模式 (set_permission_mode 控制协议)
   */
  async switchPermissionMode(mode: 'default' | 'acceptEdits' | 'auto' | 'bypassPermissions' | 'manual' | 'dontAsk' | 'plan'): Promise<boolean> {
    const reqId = 'perm-' + crypto.randomUUID().slice(0, 8);
    const resp = await this.sendControlRequest(reqId, 'set_permission_mode', { mode }, 10000);
    return resp?.subtype === 'success';
  }

  /**
   * 会话中途切换工作目录 (set_cwd 控制协议)
   */
  async setCwd(newCwd: string): Promise<boolean> {
    const reqId = 'cwd-' + crypto.randomUUID().slice(0, 8);
    const resp = await this.sendControlRequest(reqId, 'set_cwd', { cwd: newCwd }, 10000);
    if (resp?.subtype === 'success') {
      this.cwd = newCwd;
      return true;
    }
    return false;
  }

  /**
   * 会话重命名 (rename_session 控制协议)
   */
  async renameSession(title: string): Promise<boolean> {
    const reqId = 'rename-' + crypto.randomUUID().slice(0, 8);
    const resp = await this.sendControlRequest(reqId, 'rename_session', { title, source: 'host', session_id: this.sessionId }, 10000);
    return resp?.subtype === 'success';
  }

  /**
   * 查询当前会话可用模型目录 (list_models 控制协议)
   */
  async listModels(): Promise<any[]> {
    const reqId = 'list-models-' + crypto.randomUUID().slice(0, 8);
    const resp = await this.sendControlRequest(reqId, 'list_models', {}, 10000);
    return resp?.response?.models || [];
  }

  /**
   * 关闭会话进程
   */
  async close(): Promise<void> {
    if (!this.cp || !this.isAlive) return;
    try {
      this.cp.stdin?.end();
    } catch {}

    const exitPromise = new Promise<void>((resolve) => {
      if (!this.isAlive) return resolve();
      this.once('exit', () => resolve());
      setTimeout(() => {
        try {
          this.cp?.kill();
        } catch {}
        resolve();
      }, 5000);
    });

    await exitPromise;
    this.isAlive = false;
  }

  private writeLine(msg: any): void {
    if (!this.cp || !this.cp.stdin || !this.isAlive) return;
    this.cp.stdin.write(JSON.stringify(msg) + '\n');
  }

  private sendControlRequest(requestId: string, subtype: string, fields: Record<string, any> = {}, timeoutMs = 15000): Promise<any> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingControlRequests.delete(requestId);
        reject(new Error(`Control request ${requestId} (${subtype}) timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      this.pendingControlRequests.set(requestId, {
        resolve: (res) => {
          clearTimeout(timer);
          resolve(res);
        },
        reject: (err) => {
          clearTimeout(timer);
          reject(err);
        },
        timeout: timer,
      });

      this.writeLine({
        type: 'control_request',
        request_id: requestId,
        request: {
          subtype,
          ...fields,
        },
      });
    });
  }

  private handleStdoutLine(line: string): void {
    if (!line.trim()) return;
    let event: any;
    try {
      event = JSON.parse(line);
    } catch {
      this.emit('rawLine', line);
      return;
    }

    this.emit('event', event);

    // 1. 初始化事件捕获 (用于分叉新 session_id 提取)
    if (event.type === 'system' && event.subtype === 'init') {
      if (Array.isArray(event.slash_commands)) this.slashCommands = event.slash_commands.map(String);
      this.emit('systemInit', event);
      if (event.session_id && this.sessionId !== event.session_id) {
        this.sessionId = event.session_id;
        this.emit('sessionReassigned', { sessionId: this.sessionId, parentSessionId: this.parentSessionId });
      }
    }

    // 2. 控制应答分发
    if (event.type === 'control_response' && event.response?.request_id) {
      const handler = this.pendingControlRequests.get(event.response.request_id);
      if (handler) {
        this.pendingControlRequests.delete(event.response.request_id);
        handler.resolve(event.response);
      }
      return;
    }

    // 3. 拦截服务端审批请求 (can_use_tool)
    if (event.type === 'control_request' && event.request?.subtype === 'can_use_tool') {
      this.handleCanUseToolRequest(event);
      return;
    }

    // 4. 轮次事件收集与结果结算
    if (event.type === 'result') {
      const turnHandler = this.pendingTurns.shift();
      const rawUsage = event.usage || {};
      const result: ClaudeTurnResult = {
        sessionId: this.sessionId,
        uuid: event.uuid,
        status: event.is_error || event.subtype === 'error_during_execution' ? (event.stop_reason === null ? 'interrupted' : 'failed') : 'completed',
        resultText: event.result || '',
        stopReason: event.stop_reason,
        durationMs: event.duration_ms,
        usage: {
          inputTokens: rawUsage.input_tokens,
          outputTokens: rawUsage.output_tokens,
          cacheReadTokens: rawUsage.cache_read_input_tokens,
          cacheWriteTokens: rawUsage.cache_creation_input_tokens,
          totalCostUsd: event.total_cost_usd,
        },
        permissionDenials: event.permission_denials || [],
        raw: event,
      };

      if (turnHandler) {
        turnHandler.resolve(result);
      }
      this.emit('turnCompleted', result);
      this.currentTurnEvents = [];
    } else {
      this.currentTurnEvents.push(event);
    }
  }

  private async handleCanUseToolRequest(event: any): Promise<void> {
    const req: ClaudeCanUseToolRequest = {
      requestId: event.request_id,
      sessionId: this.sessionId,
      toolName: event.request.tool_name,
      displayName: event.request.display_name,
      input: event.request.input || {},
      toolUseId: event.request.tool_use_id,
      description: event.request.description,
      permissionSuggestions: event.request.permission_suggestions,
      raw: event,
    };

    this.emit('approvalRequest', req);

    let decision: ClaudeApprovalDecision = 'allow';
    if (this.options.onApprovalRequest) {
      try {
        decision = await this.options.onApprovalRequest(req);
      } catch (err) {
        decision = 'deny';
      }
    } else if (this.options.autoApprove) {
      decision = 'allow';
    } else {
      decision = 'allow'; // 默认放行测试
    }

    this.writeLine({
      type: 'control_response',
      response: {
        subtype: 'success',
        request_id: event.request_id,
        response: {
          behavior: decision,
        },
      },
    });

    this.emit('approvalResolved', { requestId: event.request_id, decision });
  }

  private cleanupPending(err: Error): void {
    for (const [, handler] of this.pendingControlRequests) {
      if (handler.timeout) clearTimeout(handler.timeout);
      handler.reject(err);
    }
    this.pendingControlRequests.clear();

    while (this.pendingTurns.length > 0) {
      const turn = this.pendingTurns.shift();
      turn?.reject(err);
    }
  }
}

/**
 * Claude Code 常驻流式驱动管理器 (ClaudeStreamDriver)
 *
 * 核心定位：
 * 1. 托管本地所有热 Claude 进程实例，提供统一的 open, resume, fork 生命周期管理；
 * 2. 具备热进程连续多轮推进（Hot Resume），避免单轮频繁冷启动；
 * 3. 支持轮内打断（interrupt 控制请求）保持热进程存活；
 * 4. 支持轮内中途换模型（set_model 控制请求）与权限模式动态切换（set_permission_mode）；
 * 5. 支持会话定点分叉（--fork-session），自动继承父级完整历史并在独立分支演化；
 * 6. 支持一轮内双向审批挂起与答复（--permission-prompt-tool stdio 下的 can_use_tool 控制协议）。
 */
export class ClaudeStreamDriver extends EventEmitter {
  private sessions = new Map<string, ClaudeStreamSession>();
  private defaultOptions: ClaudeStreamDriverOptions;

  constructor(options: ClaudeStreamDriverOptions = {}) {
    super();
    this.defaultOptions = {
      proxyUrl: 'http://127.0.0.1:7892',
      defaultModel: 'haiku',
      settingSources: 'project,local',
      ...options,
    };
  }

  /**
   * 新建常驻会话
   */
  async open(sessionId?: string, options: ClaudeStreamDriverOptions = {}): Promise<ClaudeStreamSession> {
    const id = sessionId || crypto.randomUUID();
    const session = new ClaudeStreamSession(id, { ...this.defaultOptions, ...options });
    
    session.on('event', (ev) => this.emit('sessionEvent', { sessionId: id, event: ev }));
    session.on('exit', () => this.sessions.delete(id));

    await session.start('new');
    this.sessions.set(id, session);
    return session;
  }

  /**
   * 恢复已有会话（若热进程在则复用，不在则冷恢复拉起）
   */
  async resume(sessionId: string, options: ClaudeStreamDriverOptions = {}): Promise<ClaudeStreamSession> {
    const existing = this.sessions.get(sessionId);
    if (existing && existing.running) {
      return existing;
    }

    const session = new ClaudeStreamSession(sessionId, { ...this.defaultOptions, ...options });
    session.on('event', (ev) => this.emit('sessionEvent', { sessionId, event: ev }));
    session.on('exit', () => this.sessions.delete(sessionId));

    await session.start('resume');
    this.sessions.set(sessionId, session);
    return session;
  }

  /**
   * 从父会话分叉出全新会话分支
   */
  async fork(parentSessionId: string, options: ClaudeStreamDriverOptions = {}): Promise<{ session: ClaudeStreamSession; getNewSessionId: () => string }> {
    const tempId = crypto.randomUUID();
    const session = new ClaudeStreamSession(tempId, { ...this.defaultOptions, ...options });

    session.on('sessionReassigned', (data) => {
      this.sessions.delete(tempId);
      this.sessions.set(data.sessionId, session);
    });

    session.on('event', (ev) => this.emit('sessionEvent', { sessionId: session.sessionId, event: ev }));
    session.on('exit', () => this.sessions.delete(session.sessionId));

    await session.start('fork', parentSessionId);
    this.sessions.set(tempId, session);

    return {
      session,
      getNewSessionId: () => session.sessionId,
    };
  }

  /**
   * 获取正在运行的会话实例
   */
  getSession(sessionId: string): ClaudeStreamSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * 获取所有活跃会话列表
   */
  listActiveSessions(): string[] {
    return Array.from(this.sessions.keys());
  }

  /**
   * 关闭所有活跃会话
   */
  async closeAll(): Promise<void> {
    const promises = Array.from(this.sessions.values()).map((s) => s.close());
    await Promise.all(promises);
    this.sessions.clear();
  }
}
