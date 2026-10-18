import { spawn, type ChildProcess } from 'node:child_process';
import readline from 'node:readline';
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

export type AcpProduct = 'zcode' | 'workbuddy' | 'opencode' | 'hermes' | 'codex' | 'claude';

export interface AcpBridgeConfig {
  cmd: string;
  args: string[];
  env: NodeJS.ProcessEnv;
  defaultModel?: string;
  defaultMode?: string;
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
    kind: 'allow_once' | 'allow_always' | 'reject_once' | 'reject_always' | 'cancel' | string;
    name?: string;
  }>;
  raw: any;
}

export type AcpApprovalDecision = 'allow_once' | 'allow_always' | 'reject_once' | 'reject_always' | 'cancel';

export interface AcpDriverOptions {
  product: AcpProduct;
  cwd?: string;
  customBridge?: AcpBridgeConfig;
  autoApprove?: boolean;
  onApprovalRequest?: (req: AcpPermissionRequest) => Promise<AcpApprovalDecision> | AcpApprovalDecision;
}

export interface AcpTurnResult {
  sessionId: string;
  status: 'completed' | 'cancelled' | 'failed';
  stopReason?: string;
  text: string;
  durationMs: number;
  usage?: Record<string, any>;
  raw?: any;
}

/**
 * 根据 hub/data/products.json 和 ~/.acpx/config.json 自动推导指定 ACP 产品的运行参数
 */
export function resolveAcpBridgeConfig(product: AcpProduct, cwd = process.cwd()): AcpBridgeConfig {
  const home = os.homedir();
  const baseEnv: NodeJS.ProcessEnv = { ...process.env };

  // 读取 ~/.acpx/config.json
  const acpxCfgPath = path.join(home, '.acpx', 'config.json');
  const acpxCfg = fs.existsSync(acpxCfgPath) ? JSON.parse(fs.readFileSync(acpxCfgPath, 'utf8')) : {};

  switch (product) {
    case 'zcode':
      return {
        cmd: 'cmd.exe',
        args: ['/c', 'zcode-acp-server'],
        env: baseEnv,
        defaultModel: 'builtin:bigmodel-coding-plan\\GLM-5.3-Flash',
        defaultMode: 'yolo'
      };

    case 'workbuddy': {
      const wbEnv: NodeJS.ProcessEnv = {
        ...baseEnv,
        CODEBUDDY_CONFIG_DIR: path.join(home, '.workbuddy'),
        WORKBUDDY_CONFIG_DIR: path.join(home, '.workbuddy'),
        ACC_PRODUCT_CONFIG_V3: JSON.stringify({
          authentication: { type: 'custom-token', attributes: { token: 'wb-local-byok' } }
        })
      };
      return {
        cmd: 'cmd.exe',
        args: ['/c', 'codebuddy', '--acp'],
        env: wbEnv,
        defaultModel: 'custom-local:glm-5.3-flash',
        defaultMode: 'default'
      };
    }

    case 'opencode':
      return {
        cmd: 'cmd.exe',
        args: ['/c', 'opencode', 'acp'],
        env: {
          ...baseEnv,
          OPENCODE_DISABLE_AUTOUPDATE: '1',
          OPENCODE_DISABLE_LSP_DOWNLOAD: '1'
        },
        defaultModel: 'zhipuai-coding-plan/glm-5.3-flash',
        defaultMode: 'build'
      };

    case 'hermes': {
      const hermesArgv = acpxCfg.agents?.hermes?.argv;
      if (hermesArgv && hermesArgv.length > 0) {
        return {
          cmd: hermesArgv[0],
          args: hermesArgv.slice(1),
          env: {
            ...baseEnv,
            HERMES_ACP_SKIP_CONFIGURED_MCP: '1',
            PYTHONIOENCODING: 'utf-8',
            PYTHONUTF8: '1'
          },
          defaultModel: 'custom:glm-5.3',
          defaultMode: 'default'
        };
      }
      return {
        cmd: 'cmd.exe',
        args: ['/c', 'hermes', 'acp'],
        env: {
          ...baseEnv,
          HERMES_ACP_SKIP_CONFIGURED_MCP: '1',
          PYTHONIOENCODING: 'utf-8',
          PYTHONUTF8: '1'
        },
        defaultModel: 'custom:glm-5.3',
        defaultMode: 'default'
      };
    }

    default:
      throw new Error(`Unsupported ACP product: ${product}`);
  }
}

/**
 * 单个常驻 ACP 会话管理
 */
export class AcpResidentSession extends EventEmitter {
  public readonly sessionId: string;
  public readonly product: AcpProduct;
  public readonly driver: AcpResidentDriver;
  public currentMode?: string;
  public currentModel?: string;

  constructor(sessionId: string, product: AcpProduct, driver: AcpResidentDriver) {
    super();
    this.sessionId = sessionId;
    this.product = product;
    this.driver = driver;
  }

  /**
   * 提交本轮交互（流式或等待完成）
   */
  public async submit(prompt: string): Promise<AcpTurnResult> {
    return this.driver.promptTurn(this.sessionId, prompt);
  }

  /**
   * 轮内打断
   */
  public cancel(): void {
    this.driver.cancelTurn(this.sessionId);
  }

  /**
   * 切换权限/运行模式
   */
  public async setMode(modeId: string): Promise<void> {
    await this.driver.setSessionMode(this.sessionId, modeId);
    this.currentMode = modeId;
  }

  /**
   * 切换模型
   */
  public async setModel(modelId: string): Promise<void> {
    await this.driver.setSessionModel(this.sessionId, modelId);
    this.currentModel = modelId;
  }
}

/**
 * ACP 常驻驱动核心管理器（直接管理 ACP 桥进程与 JSON-RPC 2.0 协议流）
 */
export class AcpResidentDriver extends EventEmitter {
  public readonly product: AcpProduct;
  public readonly cwd: string;
  private readonly bridgeConfig: AcpBridgeConfig;
  private childProcess: ChildProcess | null = null;
  private reqId = 1;
  private pendingRequests = new Map<number, { method: string; res: (val: any) => void; rej: (err: any) => void; start: number }>();
  private activeTurns = new Map<string, { currentText: string; resolve: (res: AcpTurnResult) => void; start: number }>();
  private sessions = new Map<string, AcpResidentSession>();
  private onApprovalRequest?: (req: AcpPermissionRequest) => Promise<AcpApprovalDecision> | AcpApprovalDecision;
  private autoApprove: boolean;
  private initialized = false;

  constructor(options: AcpDriverOptions) {
    super();
    this.product = options.product;
    this.cwd = options.cwd || process.cwd();
    this.bridgeConfig = options.customBridge || resolveAcpBridgeConfig(this.product, this.cwd);
    this.onApprovalRequest = options.onApprovalRequest;
    this.autoApprove = options.autoApprove ?? true;
  }

  /**
   * 启动常驻桥接进程并完成 initialize 握手
   */
  public async start(): Promise<any> {
    if (this.childProcess) {
      return;
    }

    this.childProcess = spawn(this.bridgeConfig.cmd, this.bridgeConfig.args, {
      cwd: this.cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: this.bridgeConfig.env
    });

    const rl = readline.createInterface({ input: this.childProcess.stdout! });

    rl.on('line', (line) => {
      this.handleLine(line);
    });

    this.childProcess.stderr?.on('data', (data) => {
      this.emit('stderr', data.toString());
    });

    this.childProcess.on('exit', (code, signal) => {
      this.emit('exit', { code, signal });
      this.childProcess = null;
      this.initialized = false;
    });

    // 发起 initialize
    const initResult = await this.call('initialize', {
      protocolVersion: 1,
      clientInfo: { name: 'agent-hub-acp-resident', version: '2.0.0' },
      clientCapabilities: {
        fs: { readTextFile: true, writeTextFile: true },
        terminal: true
      }
    });

    this.initialized = true;
    return initResult;
  }

  /**
   * 新建 ACP 会话
   */
  public async createSession(options?: { name?: string; model?: string; mode?: string }): Promise<AcpResidentSession> {
    if (!this.initialized) {
      await this.start();
    }

    const res = await this.call('session/new', {
      cwd: this.cwd,
      mcpServers: []
    });

    const sessionId = res?.sessionId;
    if (!sessionId) {
      throw new Error(`Failed to create session on ${this.product}: ${JSON.stringify(res)}`);
    }

    const session = new AcpResidentSession(sessionId, this.product, this);

    // 默认或指定的模型/模式配置
    const targetModel = options?.model || this.bridgeConfig.defaultModel;
    if (targetModel) {
      try {
        await this.setSessionModel(sessionId, targetModel);
        session.currentModel = targetModel;
      } catch {}
    }

    const targetMode = options?.mode || this.bridgeConfig.defaultMode;
    if (targetMode) {
      try {
        await this.setSessionMode(sessionId, targetMode);
        session.currentMode = targetMode;
      } catch {}
    }

    this.sessions.set(sessionId, session);
    return session;
  }

  /**
   * 提交轮次 Prompt
   */
  public async promptTurn(sessionId: string, promptText: string): Promise<AcpTurnResult> {
    const turnStart = Date.now();
    return new Promise<AcpTurnResult>((resolve, reject) => {
      this.activeTurns.set(sessionId, {
        currentText: '',
        resolve,
        start: turnStart
      });

      this.call('session/prompt', {
        sessionId,
        prompt: [{ type: 'text', text: promptText }]
      }).then((resp) => {
        const turnState = this.activeTurns.get(sessionId);
        this.activeTurns.delete(sessionId);
        const durationMs = Date.now() - turnStart;
        resolve({
          sessionId,
          status: resp?.stopReason === 'cancelled' ? 'cancelled' : 'completed',
          stopReason: resp?.stopReason || 'end_turn',
          text: turnState ? turnState.currentText.trim() : '',
          durationMs,
          usage: resp?.usage,
          raw: resp
        });
      }).catch((err) => {
        this.activeTurns.delete(sessionId);
        reject(err);
      });
    });
  }

  /**
   * 轮内打断正在运行的会话
   */
  public cancelTurn(sessionId: string): void {
    this.notify('session/cancel', { sessionId });
  }

  /**
   * 切换会话模式（Guarded/Plan/Build/Yolo/Default 等）
   */
  public async setSessionMode(sessionId: string, modeId: string): Promise<void> {
    try {
      await this.call('session/set_mode', { sessionId, modeId });
    } catch {}

    try {
      await this.call('session/set_config_option', {
        sessionId,
        configId: 'mode',
        value: modeId
      });
    } catch {}
  }

  /**
   * 切换会话模型
   */
  public async setSessionModel(sessionId: string, modelId: string): Promise<void> {
    try {
      await this.call('session/set_model', { sessionId, modelId });
    } catch {}

    try {
      await this.call('session/set_config_option', {
        sessionId,
        configId: 'model',
        value: modelId
      });
    } catch {}
  }

  /**
   * 关闭底层桥接进程
   */
  public async close(): Promise<void> {
    if (this.childProcess) {
      this.childProcess.kill();
      this.childProcess = null;
      this.initialized = false;
    }
  }

  // ---- JSON-RPC 核心通信底层 ----

  private call(method: string, params: any): Promise<any> {
    const id = this.reqId++;
    return new Promise((res, rej) => {
      this.pendingRequests.set(id, { method, res, rej, start: Date.now() });
      const payload = { jsonrpc: '2.0', id, method, params };
      this.childProcess?.stdin?.write(JSON.stringify(payload) + '\n');
    });
  }

  private notify(method: string, params: any): void {
    const payload = { jsonrpc: '2.0', method, params };
    this.childProcess?.stdin?.write(JSON.stringify(payload) + '\n');
  }

  private respond(id: number | string, result: any): void {
    const payload = { jsonrpc: '2.0', id, result };
    this.childProcess?.stdin?.write(JSON.stringify(payload) + '\n');
  }

  private respondError(id: number | string, code: number, message: string): void {
    const payload = { jsonrpc: '2.0', id, error: { code, message } };
    this.childProcess?.stdin?.write(JSON.stringify(payload) + '\n');
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

    // 1. JSON-RPC 响应帧
    if (typeof msg.id === 'number' && this.pendingRequests.has(msg.id)) {
      const { res, rej } = this.pendingRequests.get(msg.id)!;
      this.pendingRequests.delete(msg.id);
      if (msg.error) {
        rej(new Error(msg.error.message || JSON.stringify(msg.error)));
      } else {
        res(msg.result);
      }
      return;
    }

    // 2. 服务端通知帧
    if (msg.method === 'session/update') {
      const sessionId = msg.params?.sessionId;
      const update = msg.params?.update;
      this.emit('sessionEvent', { sessionId, update, raw: msg });

      if (sessionId && this.activeTurns.has(sessionId)) {
        const turn = this.activeTurns.get(sessionId)!;
        if (update?.sessionUpdate === 'agent_message_chunk') {
          turn.currentText += update.content?.text || '';
        }
      }
      return;
    }

    // 3. 服务端逆向请求帧（一轮中途审批 & 客户端工具调用）
    if (typeof msg.id === 'number' && msg.method) {
      this.handleServerRequest(msg);
    }
  }

  private async handleServerRequest(msg: { id: number; method: string; params?: any }): Promise<void> {
    const { id, method, params } = msg;

    // 审批请求：session/request_permission
    if (method === 'session/request_permission') {
      const req: AcpPermissionRequest = {
        sessionId: params?.sessionId,
        toolCall: params?.toolCall || {},
        options: params?.options || [],
        raw: params
      };

      this.emit('permissionRequest', req);

      let decision: AcpApprovalDecision = 'allow_once';
      if (this.onApprovalRequest) {
        try {
          decision = await this.onApprovalRequest(req);
        } catch {
          decision = 'reject_once';
        }
      } else if (!this.autoApprove) {
        decision = 'reject_once';
      }

      // 匹配可用的 optionId
      const targetOption = req.options.find(o => o.kind === decision || o.optionId === decision) ||
        req.options.find(o => o.kind.startsWith('allow')) ||
        req.options[0];

      const optionId = targetOption ? targetOption.optionId : (decision.startsWith('allow') ? 'allow_once' : 'reject_once');

      this.respond(id, {
        outcome: {
          outcome: 'selected',
          optionId
        }
      });
      return;
    }

    // 客户端委托文件系统写入（当声明了 fs.writeTextFile 时 WorkBuddy 等会委托）
    if (method === 'fs/write_text_file') {
      const targetPath = params?.path;
      const content = params?.content;
      try {
        if (targetPath && typeof content === 'string') {
          const dir = path.dirname(targetPath);
          if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
          fs.writeFileSync(targetPath, content, 'utf8');
        }
        this.respond(id, {});
      } catch (err: any) {
        this.respondError(id, -32000, err.message);
      }
      return;
    }

    // 客户端委托文件系统读取
    if (method === 'fs/read_text_file') {
      const targetPath = params?.path;
      try {
        if (targetPath && fs.existsSync(targetPath)) {
          const content = fs.readFileSync(targetPath, 'utf8');
          this.respond(id, { content });
        } else {
          this.respondError(id, -32000, `File not found: ${targetPath}`);
        }
      } catch (err: any) {
        this.respondError(id, -32000, err.message);
      }
      return;
    }

    // 默认兜底
    this.respondError(id, -32601, `Method not implemented: ${method}`);
  }
}
