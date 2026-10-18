/**
 * One turn on Claude Code's resident stream-json process (route stream-json): the driver and its tool permission asks.
 * Mixed into AgentGatewayHub (gateway.ts); `this` is the hub.
 */
import type { AgentGatewayHub } from '../gateway.ts';
import crypto from 'node:crypto';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { ClaudeStreamDriver, type ClaudeApprovalDecision, type ClaudeCanUseToolRequest, type ClaudeStreamSession } from '../drivers/claude_stream.ts';
import type { ChannelProfile, ActiveRun, PendingApproval } from './types.ts';
import { HOME, ACPX_TURN_TIMEOUT_SEC, classifyTool } from './common.ts';

export const claudeRunMethods = {
  hasClaudeTranscriptOnDisk(this: AgentGatewayHub, sessionId: string): boolean {
    if (!sessionId) return false;
    try {
      const projectsDir = join(HOME, '.claude', 'projects');
      if (!existsSync(projectsDir)) return false;
      for (const dir of readdirSync(projectsDir, { withFileTypes: true })) {
        if (!dir.isDirectory()) continue;
        if (existsSync(join(projectsDir, dir.name, `${sessionId}.jsonl`))) {
          return true;
        }
      }
    } catch {}
    return false;
  },

  ensureClaudeDriver(this: AgentGatewayHub): ClaudeStreamDriver {
    if (this.claudeDriver) return this.claudeDriver;
    const driver = new ClaudeStreamDriver({
      cwd: this.repoRoot,
      proxyUrl: 'http://127.0.0.1:7892',
      defaultModel: 'haiku',
      settingSources: 'project,local',
      permissionMode: 'default',
      autoApprove: false,
      onApprovalRequest: (req) => this.handleClaudeApproval(req),
    });

    driver.on('sessionEvent', ({ sessionId, event }: { sessionId: string; event: any }) => {
      const r = this.activeClaudeRunsBySession.get(sessionId);
      if (!r || !event) return;

      if (event.type === 'assistant' && Array.isArray(event.message?.content)) {
        let changed = false;
        for (const block of event.message.content) {
          if (block.type === 'thinking' && typeof block.thinking === 'string' && block.thinking.trim()) {
            r.thoughts = block.thinking.trim();
            changed = true;
          } else if (block.type === 'text' && typeof block.text === 'string' && block.text.trim()) {
            r.text = block.text;
            changed = true;
          } else if (block.type === 'tool_use') {
            const tid = String(block.id || `claude_tool_${r.tools.length + 1}`);
            const tName = String(block.name || 'tool');
            const inStr = block.input ? JSON.stringify(block.input) : '';
            const cls = classifyTool(tName, inStr);
            if (!r.tools.some((x) => x.id === tid)) {
              r.tools.push({
                id: tid,
                name: tName,
                category: cls.category,
                icon: cls.icon,
                summary: cls.summary,
                status: 'running',
                input: inStr || undefined,
                startedAt: new Date().toISOString(),
              });
              changed = true;
            }
          }
        }
        if (changed) {
          this.markRunSeenByDispatch(r);
          this.broadcast('run_update', r);
        }
      } else if (event.type === 'user' && Array.isArray(event.message?.content)) {
        let changed = false;
        for (const block of event.message.content) {
          if (block.type === 'tool_result' && block.tool_use_id) {
            const ex = r.tools.find((x) => x.id === String(block.tool_use_id));
            if (ex) {
              ex.status = block.is_error ? 'error' : 'ok';
              const outStr =
                typeof block.content === 'string'
                  ? block.content
                  : JSON.stringify(block.content || '').slice(0, 1200);
              if (outStr) ex.output = outStr;
              changed = true;
            }
          }
        }
        if (changed) {
          this.markRunSeenByDispatch(r);
          this.broadcast('run_update', r);
        }
      }
    });

    this.claudeDriver = driver;
    return driver;
  },

  async handleClaudeApproval(this: AgentGatewayHub, req: ClaudeCanUseToolRequest): Promise<ClaudeApprovalDecision> {
    const run = this.activeClaudeRunsBySession.get(req.sessionId);
    if (!run) return 'deny';
    // Claude's own question tool: the person answers, and the answers ride back in updatedInput.answers, keyed by
    // the question text (how Claude Code's AskUserQuestion takes them).
    if (req.toolName === 'AskUserQuestion') {
      const qs: any[] = Array.isArray(req.input?.questions) ? req.input.questions : [];
      const answers = await this.askPerson(
        run,
        qs.map((q) => ({
          id: String(q.question),
          header: q.header,
          question: String(q.question),
          options: (q.options || []).map((o: any) => ({ label: String(o.label), description: o.description })),
          multiSelect: Boolean(q.multiSelect),
        })),
      );
      if (!answers) return 'deny';
      return {
        behavior: 'allow',
        updatedInput: { ...req.input, answers: Object.fromEntries(qs.map((q) => [String(q.question), (answers[String(q.question)] || []).join(', ')])) },
      };
    }
    if (run.permissions === 'all') return 'allow';
    if (run.permissions === 'deny') return 'deny';

    // Under 'reads', auto-allow purely read-only tools and intercept write/edit/shell tools in-turn
    if (/^(Read|Glob|Grep|LS|WebFetch|WebSearch)$/i.test(req.toolName || '')) {
      return 'allow';
    }

    const apprId = `appr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const toolName = req.displayName || req.toolName || 'can_use_tool';
    const toolInput = JSON.stringify(req.input || {}).slice(0, 600);

    const approvalItem: PendingApproval = {
      id: apprId,
      runId: run.runId,
      channel: 'claude',
      sessionName: run.sessionName,
      traceSessionId: run.traceSessionId,
      cwd: run.cwd,
      model: run.model,
      prompt: run.prompt,
      toolName,
      toolInput,
      reason: req.description || `Claude 轮内请求调用受控工具 ${toolName}（批准后当前轮继续执行）`,
      createdAt: new Date().toISOString(),
      status: 'pending',
      inTurn: true,
      mode: 'in-turn',
    };

    this.pendingApprovals.unshift(approvalItem);
    if (this.pendingApprovals.length > 20) this.pendingApprovals.pop();
    run.waitingApprovalId = apprId;
    (run.warnings ||= []).push(`轮内等待审批: ${toolName}`);
    this.broadcast('run_update', run);
    this.broadcast('state', this.getState());

    return new Promise<'allow' | 'deny'>((resolve) => {
      this.liveApprovalResolvers.set(apprId, {
        runId: run.runId,
        channel: 'claude',
        resolve: (allow: boolean) => resolve(allow ? 'allow' : 'deny'),
      });
    });
  },

  startClaudeStreamRun(this: AgentGatewayHub,
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
    (async () => {
      let sessionId = '';
      try {
        const driver = this.ensureClaudeDriver();
        const existingRec = this.listAcpxSessions().find(
          (s) => s.channel === 'claude' && s.sessionName === sessionName,
        );
        let candidateId = existingRec?.acpSessionId || '';
        if (!candidateId && opts.traceSessionId) {
          candidateId = opts.traceSessionId.startsWith('claude-code:')
            ? opts.traceSessionId.slice('claude-code:'.length)
            : /^[0-9a-f-]{36}$/i.test(opts.traceSessionId)
            ? opts.traceSessionId
            : '';
        }
        sessionId = candidateId || crypto.randomUUID();
        run.claudeSessionId = sessionId;
        run.traceSessionId = `claude-code:${sessionId}`;
        this.activeClaudeRunsBySession.set(sessionId, run);
        this.saveDriverSessionRecord({
          channel: 'claude',
          sessionName,
          nativeId: sessionId,
          cwd,
          model,
          driverName: 'stream-json',
        });
        this.broadcast('run_update', run);

        const hotSession = driver.getSession(sessionId);
        let session: ClaudeStreamSession;
        if (hotSession && hotSession.running) {
          session = hotSession;
        } else if (this.hasClaudeTranscriptOnDisk(sessionId)) {
          session = await driver.resume(sessionId, { cwd, defaultModel: model });
        } else {
          session = await driver.open(sessionId, { cwd, defaultModel: model });
        }

        const res = await session.submit(prompt, ACPX_TURN_TIMEOUT_SEC * 1000);
        if (res.resultText && !run.text.trim()) {
          run.text = res.resultText;
        }
        if ((run.status as string) === 'cancelling' || (run.status as string) === 'aborted' || res.status === 'interrupted') {
          run.status = 'aborted';
        } else if (res.status === 'failed') {
          run.status = 'failed';
          run.error = res.resultText || 'Claude turn failed';
        } else {
          run.status = 'completed';
        }

        this.saveDriverSessionRecord({
          channel: 'claude',
          sessionName,
          nativeId: sessionId,
          cwd,
          model,
          driverName: 'stream-json',
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
        if (sessionId) this.activeClaudeRunsBySession.delete(sessionId);
        if (this.activeRuns.get(this.slotKey('claude', sessionName))?.runId === run.runId) {
          this.finalizeRun(run, opts);
        }
      }
    })();
    return run;
  },
};
