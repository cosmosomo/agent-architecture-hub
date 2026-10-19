/**
 * One turn on a resident ACP bridge (route acp-resident: ZCode, WorkBuddy, OpenCode, Hermes):
 * the bridge per product and folder, its permission asks, and its sessions.
 * Mixed into AgentGatewayHub (gateway.ts); `this` is the hub.
 */
import type { AgentGatewayHub } from '../gateway.ts';
import { AcpResidentDriver, resolveAcpBridgeCommand, type AcpApprovalDecision, type AcpPermissionRequest } from '../drivers/acp_runtime.ts';
import type { RunOpts, ChannelProfile, ActiveRun } from './types.ts';
import { agentBaseEnv } from './products.ts';
import { ACP_IDLE_MS, ACPX_TURN_TIMEOUT_SEC } from './common.ts';

export const acpRunMethods = {
  /**
   * One turn on the product's resident ACP bridge (route "acp-resident" in hub/data/products.json): the bridge
   * for this folder stays up between turns and a session, once loaded, stays hot. Its frames go through the
   * same parser as acpx's output (handleAcpFrame), so replies, thoughts, tools and refusals read the same way.
   * A session the bridge cannot load falls back to acpx for this turn.
   */
  startAcpResidentRun(this: AgentGatewayHub, run: ActiveRun, opts: RunOpts): ActiveRun {
    const { prof, sessionName, cwd, prompt, model } = opts;
    (async () => {
      let sid = '';
      let handedOff = false;
      try {
        const driver = await this.ensureAcpDriver(prof, cwd, sessionName);
        const rec = this.listAcpxSessions().find((s) => s.channel === prof.id && s.sessionName === sessionName && s.acpSessionId);
        const prefix = prof.traceKind + ':';
        sid = rec?.acpSessionId || (opts.traceSessionId?.startsWith(prefix) ? opts.traceSessionId.slice(prefix.length) : '');
        let info = sid ? driver.getSession(sid) : undefined;
        if (!info && sid) {
          try {
            info = await driver.loadSession(sid, cwd);
          } catch (e: any) {
            (run.warnings ||= []).push(`常驻桥载入会话失败，这一轮改走 acpx：${e?.message || e}`);
            handedOff = true;
            this.startAcpxRun(run, opts);
            return;
          }
        }
        if (!info) {
          info = await driver.createSession(cwd);
          sid = info.sessionId;
        }
        // Two hub sessions must never share one agent session (WorkBuddy handed out one id twice, 10-19).
        const other = this.activeAcpRunsBySession.get(sid);
        if (other && other.runId !== run.runId) throw new Error(`智能体给的会话 ${sid} 正被另一轮（${other.sessionName}）占着`);
        run.acpSessionId = sid;
        if (model && info.currentModel !== model) {
          try {
            await driver.setSessionModel(sid, model);
          } catch (e: any) {
            (run.warnings ||= []).push(`没换成模型 ${model}：${e?.message || e}`);
          }
        }
        // The model the agent says it is on, not only the one asked for.
        if (info.currentModel) run.model = info.currentModel;
        // Products whose own mode decides whether they ask before writing (ZCode) get the mode for this turn's permission.
        const mode = this.acpPinnedModes.get(sid) || prof.acpModes?.[opts.permissions];
        if (mode && info.currentMode !== mode) {
          try {
            await driver.setSessionMode(sid, mode);
          } catch (e: any) {
            (run.warnings ||= []).push(`没切到模式 ${mode}：${e?.message || e}`);
          }
        }
        const ownRecord = !rec || rec.acpxRecordId.startsWith('driver-');
        if (ownRecord) {
          this.saveDriverSessionRecord({ channel: prof.id, sessionName, nativeId: sid, cwd, model: run.model, driverName: 'acp-resident' });
        }
        run.traceSessionId = this.canonicalSessionId(prof.id, sid);
        this.activeAcpRunsBySession.set(sid, run);
        this.broadcast('run_update', run);

        const pics = this.promptImages.get(prompt);
        if (pics) this.promptImages.delete(prompt);
        let timer: ReturnType<typeof setTimeout> | undefined;
        const timeout = new Promise<never>((_, rej) => {
          timer = setTimeout(() => {
            driver.cancelTurn(sid);
            rej(new Error(`这一轮超过 ${ACPX_TURN_TIMEOUT_SEC} 秒没结束，已叫停`));
          }, ACPX_TURN_TIMEOUT_SEC * 1000);
        });
        const turn = driver.promptTurn(sid, pics ? [{ type: 'text', text: prompt }, ...pics] : prompt);
        const res = await Promise.race([turn, timeout]).finally(() => clearTimeout(timer));
        this.handleAcpFrame(run, { result: res.raw || { stopReason: res.stopReason } });
        if (!run.text.trim() && res.text) run.text = res.text;
        if ((run.status as string) === 'cancelling' || (run.status as string) === 'aborted') {
          run.status = 'aborted';
        } else {
          const outcome = this.judgeAcpxTurn(run, 0, '');
          run.status = outcome.status;
          if (outcome.error) run.error = outcome.error;
          // A turn that ended without a word or a tool did nothing; counting it done would hand back an empty reply.
          if (run.status === 'completed' && !run.text.trim() && !run.tools.length) {
            run.status = 'failed';
            run.error = `智能体这一轮什么都没回就结束了（stopReason ${res.stopReason || '?'}）`;
          }
        }
        if (ownRecord) {
          this.saveDriverSessionRecord({
            channel: prof.id,
            sessionName,
            nativeId: sid,
            cwd,
            model: run.model,
            driverName: 'acp-resident',
            prompt,
            reply: run.text,
          });
        }
      } catch (e: any) {
        if ((run.status as string) === 'cancelling' || (run.status as string) === 'aborted') {
          run.status = 'aborted';
        } else {
          run.status = 'failed';
          run.error = e?.message || String(e);
        }
      } finally {
        if (!handedOff) {
          if (sid && this.activeAcpRunsBySession.get(sid) === run) this.activeAcpRunsBySession.delete(sid);
          if (prof.id === 'hermes') this.hermesCache = null;
          if (this.activeRuns.get(this.slotKey(prof.id, sessionName))?.runId === run.runId) this.finalizeRun(run, opts);
        }
      }
    })();
    return run;
  },

  /** The resident bridge for this product, folder and hub session, started on first use; idle ones close after ACP_IDLE_MS. */
  async ensureAcpDriver(this: AgentGatewayHub, prof: ChannelProfile, cwd: string, sessionName: string): Promise<AcpResidentDriver> {
    // One bridge per hub session: WorkBuddy ended a second turn at once, empty, when two sessions shared its process (10-19).
    const key = `${prof.id}|${cwd.toLowerCase()}|${sessionName}`;
    let driver = this.acpDrivers.get(key);
    if (!driver) {
      const d = new AcpResidentDriver({
        product: prof.id,
        cwd,
        bridge: { ...resolveAcpBridgeCommand(prof.acpxAgent), env: { ...agentBaseEnv(), ...prof.buildEnv() } },
        onApprovalRequest: (req) => this.handleAcpApproval(prof, req),
      });
      d.on('frame', (msg: any) => {
        const r = this.activeAcpRunsBySession.get(msg?.params?.sessionId);
        if (r) this.handleAcpFrame(r, msg);
      });
      d.on('exit', () => {
        if (this.acpDrivers.get(key) === d) this.acpDrivers.delete(key);
      });
      this.acpDrivers.set(key, d);
      driver = d;
      if (!this.acpIdleTimer) {
        this.acpIdleTimer = setInterval(() => {
          for (const [k, x] of this.acpDrivers) {
            if (!x.busy && Date.now() - x.lastUsedAt > ACP_IDLE_MS) {
              this.acpDrivers.delete(k);
              x.close().catch(() => {});
            }
          }
        }, 60_000);
        this.acpIdleTimer.unref?.();
      }
    }
    try {
      await driver.start();
    } catch (e) {
      this.acpDrivers.delete(key);
      await driver.close().catch(() => {});
      throw e;
    }
    return driver;
  },

  /** The resident bridge that has this ACP session loaded, if any. */
  acpDriverOf(this: AgentGatewayHub, sid: string): AcpResidentDriver | undefined {
    for (const d of this.acpDrivers.values()) if (d.getSession(sid)) return d;
    return undefined;
  },

  /**
   * A permission ask from a resident ACP bridge. "all" allows, "deny" refuses; "reads" allows reading kinds
   * and holds anything else as an in-turn approval the person answers (the turn waits, as with Codex and Claude).
   */
  async handleAcpApproval(this: AgentGatewayHub, prof: ChannelProfile, req: AcpPermissionRequest): Promise<AcpApprovalDecision> {
    const run = this.activeAcpRunsBySession.get(req.sessionId);
    if (!run) return 'reject_once';
    // An agent's question that came as a permission ask (ZCode turns AskUserQuestion into one when the client offers
    // no form: the options are the answers, plus a skip). It goes to the person whatever the permissions, and the
    // chosen answer goes back as that option.
    const qs: any[] = Array.isArray(req.toolCall?.rawInput?.questions) ? req.toolCall.rawInput.questions : [];
    if (qs.length) {
      const answers = await this.askPerson(
        run,
        qs.map((q) => ({
          id: String(q.question),
          header: q.header,
          question: String(q.question),
          options: (q.options || []).map((o: any) => ({ label: String(o.label), description: o.description })),
          multiSelect: Boolean(q.multiSelect),
          choicesOnly: true,
        })),
      );
      const pick = answers ? Object.values(answers)[0]?.[0] : undefined;
      const opt = pick !== undefined ? req.options.find((o) => o.optionId === pick || o.name === pick) : undefined;
      return opt ? { optionId: opt.optionId } : 'reject_once';
    }
    const last = run.tools[run.tools.length - 1];
    const title = String(req.toolCall?.title || '').trim() || run.permissionAsk || (last ? last.name : '某个工具');
    const settle = (allow: boolean): AcpApprovalDecision => {
      run.permissionAsk = undefined;
      if (!allow) (run.deniedTools ||= []).push(title);
      return allow ? 'allow_once' : 'reject_once';
    };
    // Leaving plan mode is the plan itself waiting for a yes: it always goes to the person, whatever the permission.
    const planExit = String(req.toolCall?.kind || '') === 'switch_mode' || /exit plan mode/i.test(title);
    if (run.permissions === 'deny') return settle(false);
    if (run.permissions === 'all' && !planExit) return settle(true);
    if (!planExit && ['read', 'search', 'fetch', 'think'].includes(String(req.toolCall?.kind || ''))) return settle(true);

    const apprId = `appr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    this.pendingApprovals.unshift({
      id: apprId,
      runId: run.runId,
      channel: prof.id,
      sessionName: run.sessionName,
      traceSessionId: run.traceSessionId,
      cwd: run.cwd,
      model: run.model,
      prompt: run.prompt,
      toolName: title,
      toolInput: JSON.stringify(req.toolCall?.rawInput || req.toolCall || {}).slice(0, 600),
      reason: `${prof.label} 轮内请求：${title}。批准后这一轮继续`,
      createdAt: new Date().toISOString(),
      status: 'pending',
      inTurn: true,
      mode: 'in-turn',
    });
    if (this.pendingApprovals.length > 20) this.pendingApprovals.pop();
    run.waitingApprovalId = apprId;
    (run.warnings ||= []).push(`轮内等待审批: ${title}`);
    this.broadcast('run_update', run);
    this.broadcast('state', this.getState());
    return new Promise<AcpApprovalDecision>((resolve) => {
      this.liveApprovalResolvers.set(apprId, { runId: run.runId, channel: prof.id, resolve: (allow: boolean) => resolve(settle(allow)) });
    });
  },
};
