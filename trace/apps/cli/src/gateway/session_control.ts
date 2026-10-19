/**
 * Operations on a session other than a turn (POST /api/gateway/session-control): mode, compact, fork, effort, commands.
 * Mixed into AgentGatewayHub (gateway.ts); `this` is the hub.
 */
import type { AgentGatewayHub } from '../gateway.ts';
import { appendFileSync } from 'node:fs';
import { resolveChannel } from './products.ts';

export const sessionControlMethods = {
  /** Switch the active model for a channel and/or named session (persisting to acpx session JSON & invoking `acpx <agent> set-model`). */
  /**
   * Operations on an existing session other than a turn, each sent to the product's own driver:
   *   mode    — ACP bridge: session/set_mode, then kept for the session (the per-turn permission mapping no longer
   *             overrides it); Claude: set_permission_mode on its live process
   *   compact — Codex: thread/compact/start; Claude and ACP agents: a "/compact" turn (their own command)
   *   fork    — Codex: thread/fork, recorded as a new session newSessionName that continues on its own
   *   effort  — Codex: reasoning effort for this session's turns (thread/settings/update now, turn/start after)
   *   commands — read: the slash commands the agent lists (ACP available_commands_update; Claude system/init)
   * A product that cannot do the operation gets an error that says so.
   */
  async sessionControl(this: AgentGatewayHub, params: {
    channel: string;
    sessionName?: string;
    traceSessionId?: string;
    op: string;
    value?: string;
    newSessionName?: string;
  }) {
    const prof = resolveChannel(params.channel);
    if (!prof) throw new Error(`未知渠道: ${params.channel}`);
    const sessionName = this.resolveBoundSessionName(prof, params.sessionName, params.traceSessionId);
    if (!sessionName) throw new Error('要指明会话（sessionName 或 traceSessionId）');
    const slot = this.slotKey(prof.id, sessionName);
    const rec = this.listAcpxSessions().find((s) => s.channel === prof.id && s.sessionName === sessionName && s.acpSessionId);
    const prefix = prof.traceKind + ':';
    const nativeId = rec?.acpSessionId || (params.traceSessionId?.startsWith(prefix) ? params.traceSessionId.slice(prefix.length) : '');
    const cwd = rec?.cwd || this.selectedCwds.get(slot) || this.repoRoot;
    const value = String(params.value || '').trim();
    const op = String(params.op || '');
    const done = (how: string, extra: Record<string, unknown> = {}) => {
      try {
        appendFileSync(this.eventsFile, JSON.stringify({ ts: new Date().toISOString(), kind: 'session_control', channel: prof.id, session: sessionName, op, value, how, ...extra }) + '\n', 'utf8');
      } catch {}
      return { ok: true, op, channel: prof.id, sessionName, value, how, ...extra };
    };

    if (op === 'mode') {
      if (!value) throw new Error('切模式要给 value（模式名）');
      if (prof.route === 'acp-resident') {
        if (!nativeId) throw new Error('这个会话还没在智能体那边建出来，先发一句话');
        const driver = await this.ensureAcpDriver(prof, cwd, sessionName);
        if (!driver.getSession(nativeId)) await driver.loadSession(nativeId, cwd);
        const modes = driver.getSession(nativeId)?.availableModes;
        if (modes && !modes.includes(value)) throw new Error(`${prof.label} 没有模式 ${value}，可选：${modes.join('、')}`);
        await driver.setSessionMode(nativeId, value);
        this.acpPinnedModes.set(nativeId, value);
        return done('session/set_mode', { modes });
      }
      if (prof.id === 'claude') {
        const live = nativeId ? this.claudeDriver?.getSession(nativeId) : undefined;
        if (!live?.running) throw new Error('Claude 会话没在常驻进程上（先发一句话让它起来）');
        const ok = await live.switchPermissionMode(value as any);
        if (!ok) throw new Error(`Claude 没接受模式 ${value}`);
        return done('set_permission_mode');
      }
      if (prof.id === 'codex') {
        // Codex's collaboration mode, sent with every later turn/start of this session.
        if (!['plan', 'default'].includes(value)) throw new Error('Codex 的模式只有 plan、default');
        this.codexModes.set(slot, value);
        return done('turn/start collaborationMode（之后每一轮）');
      }
      throw new Error(`${prof.label} 还不能中途切模式（权限随每一轮的 permissions 走）`);
    }

    if (op === 'compact') {
      if (prof.id === 'codex') {
        if (!nativeId) throw new Error('这个 Codex 会话还没有线程编号');
        if (this.activeRuns.get(slot)) throw new Error('这个会话正在跑一轮，等它结束再压缩');
        const driver = await this.ensureCodexDriver();
        const model = this.selectedModels.get(slot) || prof.defaultModel;
        await driver.resumeThread(nativeId, { cwd, model, sandbox: 'workspace-write', approvalPolicy: 'untrusted' });
        await driver.compactThread(nativeId, true, 180000);
        return done('thread/compact/start');
      }
      if (prof.id === 'claude' || prof.route === 'acp-resident') {
        const r: any = await this.sendPrompt({ channel: prof.id, sessionName, traceSessionId: params.traceSessionId, prompt: '/compact', source: 'web' });
        return done('/compact 作为一轮', { runId: r?.run?.runId || r?.runId });
      }
      throw new Error(`${prof.label} 还不能压缩上下文`);
    }

    if (op === 'fork') {
      if (prof.id !== 'codex') throw new Error(`${prof.label} 的分叉还没接（Codex 已接）`);
      if (!nativeId) throw new Error('这个 Codex 会话还没有线程编号');
      const driver = await this.ensureCodexDriver();
      const model = this.selectedModels.get(slot) || prof.defaultModel;
      await driver.resumeThread(nativeId, { cwd, model, sandbox: 'workspace-write', approvalPolicy: 'untrusted' }).catch(() => '');
      const forked = await driver.forkThread({ threadId: nativeId } as any);
      const newName = String(params.newSessionName || `${sessionName}-fork-${Date.now().toString(36).slice(-4)}`);
      this.saveDriverSessionRecord({ channel: 'codex', sessionName: newName, nativeId: forked.forkedThreadId, cwd, model, driverName: 'app-server' });
      return done('thread/fork', { newSessionName: newName, traceSessionId: `codex:${forked.forkedThreadId}` });
    }

    if (op === 'effort') {
      if (prof.id !== 'codex') throw new Error(`${prof.label} 的推理力度还没接（Codex 已接）`);
      const ok = ['none', 'minimal', 'low', 'medium', 'high', 'xhigh'];
      if (!ok.includes(value)) throw new Error(`推理力度只能是 ${ok.join('、')}`);
      this.codexEfforts.set(slot, value);
      if (nativeId && this.codexDriver) {
        const model = this.selectedModels.get(slot) || prof.defaultModel;
        await this.codexDriver.switchModel(nativeId, model, value as any).catch(() => {});
      }
      return done('thread/settings/update + turn/start effort');
    }

    if (op === 'commands') {
      // Read-only: the slash commands the agent itself lists for this session (not logged as an event).
      if (prof.route === 'acp-resident') {
        if (!nativeId) throw new Error('这个会话还没在智能体那边建出来，先发一句话');
        const driver = await this.ensureAcpDriver(prof, cwd, sessionName);
        if (!driver.getSession(nativeId)) await driver.loadSession(nativeId, cwd);
        // The agent announces its commands just after session/new or session/load.
        for (let i = 0; i < 15 && !driver.getCommands(nativeId).length; i++) await new Promise((r) => setTimeout(r, 200));
        return { ok: true, op, channel: prof.id, sessionName, how: 'available_commands_update', commands: driver.getCommands(nativeId) };
      }
      if (prof.id === 'claude') {
        const live = nativeId ? this.claudeDriver?.getSession(nativeId) : undefined;
        if (!live?.slashCommands?.length) throw new Error('Claude 的命令清单要会话在常驻进程上跑过一轮才有');
        return { ok: true, op, channel: prof.id, sessionName, how: 'system/init slash_commands', commands: live.slashCommands.map((name) => ({ name, description: '', hint: '' })) };
      }
      throw new Error(`${prof.label} 不报自己的命令清单`);
    }

    throw new Error(`没有这个会话操作：${op}（mode、compact、fork、effort、commands）`);
  },
};
