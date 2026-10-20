/**
 * One turn on Codex's resident app-server (route app-server): the driver, its approvals and questions, steering.
 * Mixed into AgentGatewayHub (gateway.ts); `this` is the hub.
 */
import type { AgentGatewayHub } from '../gateway.ts';
import { CodexAppServerDriver, type ApprovalDecision, type ServerApprovalRequest } from '../drivers/codex_app_server.ts';
import type { ChannelProfile, ActiveRun, PendingApproval } from './types.ts';
import { ACPX_TURN_TIMEOUT_SEC, classifyTool } from './common.ts';
import { toolRequest } from './security.ts';

export const codexRunMethods = {
  async ensureCodexDriver(this: AgentGatewayHub): Promise<CodexAppServerDriver> {
    if (this.codexDriver) return this.codexDriver;
    if (this.codexDriverStarting) return this.codexDriverStarting;

    this.codexDriverStarting = (async () => {
      const driver = new CodexAppServerDriver({
        cwd: this.repoRoot,
        proxyUrl: 'http://127.0.0.1:7892',
        defaultSandbox: 'workspace-write',
        defaultApprovalPolicy: 'untrusted',
        autoApprove: false,
        onApprovalRequest: (req) => this.handleCodexApproval(req),
        // Codex asking the person (item/tool/requestUserInput): answers go back by question id, as option labels or text.
        onUserInputRequest: async (req) => {
          const run = this.activeCodexRunsByThread.get(req.threadId);
          if (!run) throw new Error('no run for this thread');
          const answers = await this.askPerson(
            run,
            (req.questions || []).map((q) => ({
              id: String(q.id),
              header: q.header,
              question: String(q.question || ''),
              options: (q.options || []).map((o) => ({ label: String(o.label), description: o.description })),
            })),
          );
          if (!answers) throw new Error('cancelled');
          return Object.fromEntries(Object.entries(answers).map(([k, v]) => [k, { answers: v }]));
        },
      });

      driver.on('exit', () => {
        if (this.codexDriver === driver) {
          this.codexDriver = null;
        }
      });

      driver.on('notification', (msg: { method: string; params: any }) => {
        const method = msg?.method;
        const p = msg?.params || {};
        const tid = p?.threadId || p?.turn?.threadId;
        if (!tid) return;
        const r = this.activeCodexRunsByThread.get(tid);
        if (!r) return;

        if (method === 'turn/started' && p?.turn?.id) {
          r.codexTurnId = p.turn.id;
          this.broadcast('run_update', r);
        } else if (method === 'item/agentMessage/delta' && typeof p.delta === 'string') {
          r.text += p.delta;
          this.markRunSeenByDispatch(r);
          this.broadcast('run_update', r);
        } else if (
          (method === 'item/reasoning/summaryTextDelta' || method === 'item/reasoning/textDelta') &&
          typeof p.delta === 'string'
        ) {
          r.thoughts += p.delta;
          this.markRunSeenByDispatch(r);
          this.broadcast('run_update', r);
        } else if (method === 'item/started' && p.item) {
          const item = p.item;
          if (item.type === 'commandExecution' || item.type === 'fileChange' || item.type === 'mcpToolCall') {
            const itemId = String(item.id || `codex_item_${r.tools.length + 1}`);
            const tName =
              item.type === 'commandExecution'
                ? 'Bash'
                : item.type === 'fileChange'
                ? 'FileChange'
                : String(item.tool || item.name || 'mcp');
            const inStr =
              typeof item.command === 'string'
                ? item.command
                : Array.isArray(item.command)
                ? item.command.join(' ')
                : JSON.stringify(item.changes || item.arguments || {}).slice(0, 400);
            const cls = classifyTool(tName, inStr);
            if (!r.tools.some((x) => x.id === itemId)) {
              r.tools.push({
                id: itemId,
                name: tName,
                category: cls.category,
                icon: cls.icon,
                summary: cls.summary,
                status: 'running',
                input: inStr || undefined,
                startedAt: new Date().toISOString(),
              });
              this.markRunSeenByDispatch(r);
              this.broadcast('run_update', r);
            }
          }
        } else if (method === 'item/completed' && p.item) {
          const item = p.item;
          if (item.type === 'agentMessage' && typeof item.text === 'string' && item.text.trim()) {
            if (!r.text) {
              r.text = item.text;
            } else if (!r.text.includes(item.text.trim())) {
              r.text = `${r.text}\n${item.text}`;
            }
            this.markRunSeenByDispatch(r);
            this.broadcast('run_update', r);
          } else if (item.id) {
            const ex = r.tools.find((x) => x.id === String(item.id));
            if (ex) {
              ex.status =
                (typeof item.exitCode === 'number' && item.exitCode !== 0) ||
                item.status === 'failed' ||
                item.status === 'declined'
                  ? 'error'
                  : 'ok';
              const out = item.aggregatedOutput || item.output || '';
              if (typeof out === 'string' && out) ex.output = out.slice(0, 1200);
              this.markRunSeenByDispatch(r);
              this.broadcast('run_update', r);
            }
          }
        }
      });

      await driver.start();
      this.codexDriver = driver;
      return driver;
    })().finally(() => {
      this.codexDriverStarting = null;
    });

    return this.codexDriverStarting;
  },

  async handleCodexApproval(this: AgentGatewayHub, req: ServerApprovalRequest): Promise<ApprovalDecision> {
    const run = this.activeCodexRunsByThread.get(req.threadId);
    if (!run) return 'decline';

    const rawCmd: unknown = req.command;
    const cmdText = typeof rawCmd === 'string' ? rawCmd : Array.isArray(rawCmd) ? rawCmd.join(' ') : '';
    const isCommand = req.method === 'item/commandExecution/requestApproval' || req.method === 'execCommandApproval';
    const isFile = req.method === 'item/fileChange/requestApproval' || req.method === 'applyPatchApproval';
    const toolName = isCommand ? 'Bash' : isFile ? 'FileChange' : req.method;
    const input = isCommand ? { command: cmdText } : ((req as any).changes || (req as any).raw || req);

    const q = toolRequest(run, toolName, input, req.method);
    const allow = await this.securityCheck(q, run);
    return allow ? 'accept' : 'decline';
  },

  async steerCodexRun(this: AgentGatewayHub, run: ActiveRun, prompt: string): Promise<boolean> {
    try {
      const deadline = Date.now() + 5000;
      while (run.status === 'running' && (!run.codexThreadId || !run.codexTurnId) && Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 80));
      }
      if (run.status !== 'running' || !run.codexThreadId || !run.codexTurnId || !this.codexDriver) {
        return false;
      }
      await this.codexDriver.steerTurn(run.codexThreadId, run.codexTurnId, prompt);
      (run.steeredPrompts ||= []).push(prompt);
      (run.warnings ||= []).push('中途插话 (turn/steer)：' + prompt.slice(0, 80));
      this.markRunSeenByDispatch(run);
      this.broadcast('run_update', run);
      return true;
    } catch {
      return false;
    }
  },

  startCodexAppServerRun(this: AgentGatewayHub,
    run: ActiveRun,
    opts: {
      prof: ChannelProfile;
      sessionName: string;
      traceSessionId?: string;
      cwd: string;
      prompt: string;
      model: string;
      permissions: 'all' | 'reads' | 'deny';
      source: 'web' | 'cli';
    },
  ): ActiveRun {
    const { sessionName, cwd, prompt, model } = opts;
    // Full permissions (the user's rule since 10-18, permissions 'all') include the network inside the workspace
    // sandbox: a developer agent has to reach the local service it builds against (10-20, dev-web yielded for want
    // of it). Reads and deny keep the sandbox closed.
    const netConfig = run.securityMode !== 'readonly' ? { config: { 'sandbox_workspace_write.network_access': true } } : {};
    (async () => {
      let threadId = '';
      try {
        const driver = await this.ensureCodexDriver();
        const existingRec = this.listAcpxSessions().find(
          (s) => s.channel === 'codex' && s.sessionName === sessionName,
        );
        let candidateId = existingRec?.acpSessionId || '';
        if (!candidateId && opts.traceSessionId) {
          candidateId = opts.traceSessionId.startsWith('codex:')
            ? opts.traceSessionId.slice('codex:'.length)
            : /^[0-9a-f-]{36}$/i.test(opts.traceSessionId)
            ? opts.traceSessionId
            : '';
        }

        if (candidateId) {
          try {
            threadId = await driver.resumeThread(candidateId, {
              cwd,
              model,
              sandbox: 'workspace-write',
              approvalPolicy: 'untrusted',
              ...netConfig,
            });
          } catch {
            threadId = '';
          }
        }
        if (!threadId) {
          const started = await driver.startThread({
            cwd,
            model,
            sandbox: 'workspace-write',
            approvalPolicy: 'untrusted',
            ...netConfig,
            name: sessionName,
          });
          threadId = started.threadId;
        }

        run.codexThreadId = threadId;
        run.traceSessionId = `codex:${threadId}`;
        this.activeCodexRunsByThread.set(threadId, run);
        this.saveDriverSessionRecord({
          channel: 'codex',
          sessionName,
          nativeId: threadId,
          cwd,
          model,
          driverName: 'app-server',
        });
        this.broadcast('run_update', run);

        const turnRes = await driver.startTurn({
          threadId,
          input: prompt,
          model,
          effort: (this.codexEfforts.get(this.slotKey('codex', sessionName)) as any) || 'low',
          cwd,
          // Only after a mode was set with session-control (plan offers Codex's request_user_input tool).
          ...(this.codexModes.get(this.slotKey('codex', sessionName))
            ? {
                collaborationMode: {
                  mode: this.codexModes.get(this.slotKey('codex', sessionName)) as 'plan' | 'default',
                  settings: { model, reasoning_effort: this.codexEfforts.get(this.slotKey('codex', sessionName)) || 'low', developer_instructions: null },
                },
              }
            : {}),
        });
        run.codexTurnId = turnRes.turnId;
        this.broadcast('run_update', run);

        const done = await driver.waitForTurn(turnRes.turnId, ACPX_TURN_TIMEOUT_SEC * 1000);
        if ((run.status as string) === 'cancelling' || (run.status as string) === 'aborted') {
          run.status = 'aborted';
        } else if (done.status === 'interrupted') {
          run.status = 'aborted';
        } else if (done.status === 'failed') {
          run.status = 'failed';
          run.error = done.error?.message || 'Codex turn failed';
        } else {
          run.status = 'completed';
        }

        if (!run.text.trim()) {
          try {
            const threadData = await driver.readThread(threadId);
            const turns = Array.isArray(threadData?.turns) ? threadData.turns : [];
            const lastTurn = turns.find((t: any) => t?.id === turnRes.turnId) || turns[turns.length - 1];
            const items = Array.isArray(lastTurn?.items) ? lastTurn.items : [];
            const texts = items
              .filter((it: any) => it?.type === 'agentMessage' && typeof it.text === 'string')
              .map((it: any) => it.text);
            if (texts.length > 0) run.text = texts.join('\n');
          } catch {}
        }

        this.saveDriverSessionRecord({
          channel: 'codex',
          sessionName,
          nativeId: threadId,
          cwd,
          model,
          driverName: 'app-server',
          prompt,
          reply: run.text,
        });
      } catch (e: any) {
        if ((run.status as string) !== 'aborted' && (run.status as string) !== 'cancelling') {
          run.status = 'failed';
          run.error = e?.message || String(e);
        } else {
          run.status = 'aborted';
        }
      } finally {
        if (threadId) this.activeCodexRunsByThread.delete(threadId);
        if (this.activeRuns.get(this.slotKey('codex', sessionName))?.runId === run.runId) {
          this.finalizeRun(run, opts);
        }
      }
    })();
    return run;
  },
};
