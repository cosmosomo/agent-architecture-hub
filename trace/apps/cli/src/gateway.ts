/**
 * The backend's gateway: one AgentGatewayHub that every page and the command-line gateway talk to (through server.ts).
 * This file keeps the class itself — its fields, sending and stopping a turn (sendPrompt, cancelRun), routing a turn by
 * the product table's route (startRunInternal), finishing a turn (finalizeRun), state and settings. Each other block
 * is a file in gateway/ whose functions take `this` as the hub and are mixed into the class at the end of this file
 * (see the table "后端各块在哪" in channels/README.md). No member is marked private: the blocks live in other files and
 * read the hub's fields; what server.ts calls is the hub's outward face.
 */
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import type { ServerResponse } from 'node:http';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { Session } from '@hub-trace/contract';
import { CodexAppServerDriver } from './drivers/codex_app_server.ts';
import { ClaudeStreamDriver } from './drivers/claude_stream.ts';
import { TaskBoard, type DispatchView } from './collab/taskboard.ts';
import { AcpResidentDriver, resolveAcpBridgeCommand } from './drivers/acp_runtime.ts';
import type { SessionStore } from './store.ts';

import type { RunOpts, ChannelId, MetaAgentId, MetaAgentConfig, MetaAgentLogEntry, ChannelCapabilities, ChannelProfile, QueuedPrompt, ActiveRun, AcpxSessionInfo, PendingQuestion, PendingApproval, ExternalSessionAnomaly, DispatchRecord } from './gateway/types.ts';
import { agentBaseEnv, ACPX_CLI, CHANNEL_PROFILES, resolveChannel, detectChannelFromCommand } from './gateway/products.ts';
import { HOME, ACPX_TURN_TIMEOUT_SEC, BACKGROUND, quoteWinArg } from './gateway/common.ts';
import { acpRunMethods } from './gateway/run_acp.ts';
import { approvalMethods } from './gateway/approvals.ts';
import { sessionControlMethods } from './gateway/session_control.ts';
import { codexRunMethods } from './gateway/run_codex.ts';
import { claudeRunMethods } from './gateway/run_claude.ts';
import { acpxRunMethods } from './gateway/run_acpx.ts';
import { antigravityMethods } from './gateway/antigravity.ts';
import { sessionMethods } from './gateway/sessions.ts';
import { collabMethods } from './gateway/collab.ts';
import { metaMethods } from './gateway/meta.ts';
import { capacityMethods, loadQuotaCooldowns } from './gateway/capacity.ts';
import { classifyFailure } from './gateway/failure.ts';

// Everything above the class lives in gateway/: types, products, common. Re-exported for the callers.
export type { ChannelId, MetaAgentId, MetaAgentConfig, MetaAgentLogEntry, ChannelCapabilities, ChannelProfile, LiveToolCall, QueuedPrompt, ActiveRun, AcpxSessionInfo, PendingQuestion, PendingApproval, ExternalSessionAnomaly, DispatchReceiptState, DispatchStatus, DispatchRecord } from './gateway/types.ts';
export { CHANNEL_PROFILES, resolveChannel, detectChannelFromCommand, normalizeAgyCliModel, resolveAgyProjectId } from './gateway/products.ts';
export { NEW_CWD, DEFAULT_SUPERVISOR_PERSONA, DEFAULT_META_AGENTS } from './gateway/common.ts';

export class AgentGatewayHub {
  readonly repoRoot: string;
  readonly store: SessionStore;
  readonly acpxDir = join(HOME, '.acpx', 'sessions');
  readonly agyMapFile = join(HOME, '.acpx', 'agy-sessions.json');
  readonly agyBrainDir = join(HOME, '.gemini', 'antigravity', 'brain');
  readonly wbDir = join(HOME, '.workbuddy');
  readonly hermesDir = join(HOME, 'AppData', 'Local', 'hermes');
  readonly metaAgentsFile = join(HOME, '.acpx', 'hub-meta-agents.json');
  readonly dispatchesDir = join(HOME, '.agent-hub', 'dispatches');
  /**
   * The "一群会话" level (collab/taskboard.ts): goals made of tasks. It dispatches through dispatchTask below and
   * hears back from saveDispatch; the page and agent_gateway.js reach it under /api/gateway/goals and /tasks.
   */
  readonly taskboard = new TaskBoard({
    dispatch: async (p) => (await this.dispatchTask({ kind: 'spawn-subagent', ...p })).dispatch as DispatchView,
    pickChannel: (candidates, exclude) => this.pickChannel(candidates, exclude),
    holdFor: (channel) => this.holdFor(channel),
    changed: (g) => this.broadcast('goal_update', { id: g.id, status: g.status, reason: g.reason }),
  });
  readonly eventsFile: string;
  readonly clients = new Set<ServerResponse>();
  readonly activeRuns = new Map<string, ActiveRun>();
  readonly activeProcs = new Map<string, ChildProcess>();
  readonly queues = new Map<string, QueuedPrompt[]>();
  readonly draftSessions = new Map<string, AcpxSessionInfo>();
  readonly selectedModels = new Map<string, string>();
  readonly selectedCwds = new Map<string, string>();
  readonly channelFailures = new Map<
    ChannelId,
    {
      started: number;
      delivered: number;
      failed: number;
      consecutiveFailures: number;
      state: 'closed' | 'open' | 'probing';
      openedAt?: string;
      lastAt: number;
      lastError?: string;
    }
  >();
  /** Quota accounts used up, until the provider's reset time (gateway/capacity.ts; kept in quota-cooldowns.json). */
  readonly quotaCooldowns = loadQuotaCooldowns();
  readonly recentRuns: ActiveRun[] = [];
  /** Image blocks waiting for the acpx prompt whose text is the key (set in sendPrompt, taken in startRunInternal). */
  readonly promptImages = new Map<string, Array<{ type: 'image'; mimeType: string; data: string }>>();
  readonly runWaiters = new Map<string, Array<(r: ActiveRun) => void>>();
  readonly dispatches = new Map<string, DispatchRecord>();
  readonly dispatchWaiters = new Map<string, Array<(d: DispatchRecord) => void>>();
  readonly wakingCallers = new Set<string>();
  readonly pendingApprovals: PendingApproval[] = [];
  readonly pendingQuestions: PendingQuestion[] = [];
  readonly liveQuestionResolvers = new Map<string, { runId: string; resolve: (answers: Record<string, string[]> | null) => void }>();
  readonly liveApprovalResolvers = new Map<
    string,
    { runId: string; channel: ChannelId; resolve: (allow: boolean) => void }
  >();
  codexDriver: CodexAppServerDriver | null = null;
  codexDriverStarting: Promise<CodexAppServerDriver> | null = null;
  claudeDriver: ClaudeStreamDriver | null = null;
  readonly activeCodexRunsByThread = new Map<string, ActiveRun>();
  readonly activeClaudeRunsBySession = new Map<string, ActiveRun>();
  /** Resident ACP bridges, one per "<product>|<folder>", and which run is on which ACP session right now. */
  readonly acpDrivers = new Map<string, AcpResidentDriver>();
  readonly activeAcpRunsBySession = new Map<string, ActiveRun>();
  acpIdleTimer: ReturnType<typeof setInterval> | null = null;
  /** A mode the person set on an ACP session (session-control mode); it wins over the per-turn permission mapping. */
  readonly acpPinnedModes = new Map<string, string>();
  /** Codex reasoning effort per session slot (session-control effort); turns default to low. */
  readonly codexEfforts = new Map<string, string>();
  /** Codex collaboration mode per session slot (session-control mode: plan / default). */
  readonly codexModes = new Map<string, string>();
  externalAnomalies: ExternalSessionAnomaly[] = [];
  readonly metaAgents = new Map<MetaAgentId, MetaAgentConfig>();
  readonly metaAgentLogs: MetaAgentLogEntry[] = [];
  patrolTimer: ReturnType<typeof setInterval> | null = null;
  lastPatrolTickMs = 0;
  patrolListCache: { at: number; list: AcpxSessionInfo[] } | null = null;
  agyListCache: { at: number; list: AcpxSessionInfo[] } | null = null;
  wbListCache: { at: number; list: AcpxSessionInfo[] } | null = null;
  readonly acpxJsonCache = new Map<string, { mtimeMs: number; raw: any }>();
  patrolTicksCount = 0;
  readonly healedIncidents = new Set<string>();
  readonly agySummaryCache = new Map<
    string,
    { mtimeMs: number; info: AcpxSessionInfo; contract: Session }
  >();
  readonly wbSummaryCache = new Map<
    string,
    { mtimeMs: number; info: AcpxSessionInfo; contract: Session }
  >();
  hermesCache: {
    at: number;
    sessions: Map<string, { info: AcpxSessionInfo; contract: Session }>;
  } | null = null;
  agyLsCache: {
    at: number;
    bin: string;
    csrf: string;
    port: string;
    address: string;
    env: Record<string, string>;
  } | null = null;

  constructor(repoRoot: string, store: SessionStore) {
    this.repoRoot = repoRoot;
    this.store = store;
    this.eventsFile = join(repoRoot, 'channels', 'events.jsonl');
    this.loadMetaAgents();
    this.loadRecentRuns();
    this.loadDispatches();
    if (!BACKGROUND) return;
    this.startMetaPatrolLoop();
    // Dispatches that ended while the service was down, then the board's own steps (budget, stall, unblock).
    for (const d of this.dispatches.values()) this.taskboard.onDispatch(d);
    setInterval(() => void this.taskboard.step(), 15_000).unref?.();
    void this.taskboard.step();
  }

  // Finished runs go to ~/.agent-hub/runs.jsonl so `agent_gateway.js read`/`wait` and the pages still have the
  // last result of a session after this service restarts. Tool calls are kept as names and status only.
  readonly runsFile = join(homedir(), '.agent-hub', 'runs.jsonl');

  rememberRun(run: ActiveRun) {
    this.recentRuns.unshift(run);
    if (this.recentRuns.length > 200) this.recentRuns.pop();
    try {
      mkdirSync(join(homedir(), '.agent-hub'), { recursive: true });
      const tools = (run.tools || []).map((t) => ({ ...t, input: undefined, output: undefined }));
      appendFileSync(this.runsFile, JSON.stringify({ ...run, tools }) + '\n', 'utf8');
    } catch {}
  }

  loadRecentRuns() {
    try {
      const lines = readFileSync(this.runsFile, 'utf8').split(/\r?\n/).filter(Boolean).slice(-200);
      for (const line of lines.reverse()) {
        try {
          this.recentRuns.push(JSON.parse(line) as ActiveRun);
        } catch {}
      }
    } catch {}
  }

  slotKey(channel: ChannelId, sessionName: string): string {
    return `${channel}:${sessionName}`;
  }

  zcodeLazyCache: { mtimeMs: number; map: Record<string, { zcodeSid?: string; cwd?: string }> } | null = null;

  /**
   * Sessions of one channel that the hub manages, with the state the phone page shows:
   * working (a run is going), failed (the last run failed), idle. ACP channels have no in-turn steer, so a
   * message sent while working waits for the next turn (queued counts them).
   */
  /** The run of one named session as the command line sees it: the active turn, else the latest finished one.
   *  With waitMs, a running turn is waited on first. Runs live in memory, so after a restart only the session
   *  record (traceSessionId) is left and the caller reads the transcript instead. */
  public async sessionRun(channelRaw: string, sessionName: string, waitMs = 0) {
    const prof = resolveChannel(channelRaw);
    if (!prof) return { ok: false, error: `未知渠道: ${channelRaw}` };
    const key = this.slotKey(prof.id, sessionName);
    let run: ActiveRun | null | undefined = this.activeRuns.get(key);
    if (run && run.status === 'running' && waitMs > 0) run = (await this.waitForRunCompletion(run.runId, waitMs)) || run;
    if (!run || run.status === 'completed' || run.status === 'failed' || run.status === 'aborted') {
      run = this.recentRuns.find((r) => r.channel === prof.id && r.sessionName === sessionName) || run;
    }
    const record = this.listAcpxSessions().find((s) => s.channel === prof.id && s.sessionName === sessionName);
    const agyId = prof.id === 'antigravity' ? this.loadAgySessionMap()[sessionName] : '';
    // Antigravity keeps its own run state, which survives our restarts: RUNNING is working, the rest is done.
    let agyState = '';
    if (agyId) {
      try {
        const db = new DatabaseSync(join(homedir(), '.gemini', 'antigravity', 'conversation_summaries.db'), { readOnly: true });
        try {
          const deadline = Date.now() + waitMs;
          for (;;) {
            const r = db.prepare('SELECT status, killed, not_fully_idle AS busy FROM conversation_summaries WHERE conversation_id = ?').get(agyId) as { status?: string; killed?: number; busy?: number } | undefined;
            // "waiting": it yielded and waits on its own background task; the work is not done yet.
            agyState = !r ? '' : r.killed ? 'aborted' : String(r.status).endsWith('RUNNING') ? 'running' : r.busy ? 'waiting' : 'completed';
            if ((agyState !== 'running' && agyState !== 'waiting') || run?.status === 'running' || Date.now() >= deadline) break;
            await new Promise((ok) => setTimeout(ok, 3000));
          }
        } finally {
          db.close();
        }
      } catch {}
    }
    if (agyId && run && run.status !== 'running') {
      if (agyState === 'running' || agyState === 'waiting') {
        run = null;
      } else {
        try {
          const tPath = join(this.agyBrainDir, agyId, '.system_generated', 'logs', 'transcript.jsonl');
          const tMtime = statSync(tPath).mtimeMs;
          const runEndMs = Date.parse(run.endedAt || run.startedAt) || 0;
          if (tMtime > runEndMs + 2000) {
            run = null;
          }
        } catch {}
      }
    }
    return {
      agyState: agyState || undefined,
      ok: true,
      channel: prof.id,
      sessionName,
      known: Boolean(run || record || agyId),
      traceSessionId: run?.traceSessionId || record?.traceSessionId || (agyId ? 'antigravity:' + agyId : null),
      queued: (this.queues.get(key) || []).length,
      run: run
        ? {
            runId: run.runId, status: run.status, startedAt: run.startedAt, endedAt: run.endedAt || null,
            durationMs: run.durationMs || Date.now() - Date.parse(run.startedAt), model: run.model, cwd: run.cwd,
            permissions: run.permissions, prompt: run.originalPrompt || run.prompt, reply: run.text || '',
            toolCallsCount: (run.tools || []).length, deniedTools: run.deniedTools || [], error: run.error || null,
          }
        : null,
    };
  }

  /**
   * What this service knows about sessions it ran itself, keyed by the agent's own session id (the part after
   * "<kind>:" in any trace id that names it). A transcript cannot tell a finished-but-unmarked turn from a live
   * one for 30 minutes; the run record can. Rebuilt at most every 2 s.
   */
  hubRunCache: { at: number; map: Map<string, { status: string; detail: string; endedAt: string }> } = { at: 0, map: new Map() };

  bindingCache: {
    at: number;
    map: Map<string, { sessionName: string; fromAcpxStore: boolean; channel: ChannelId; currentModel?: string }>;
  } = { at: 0, map: new Map() };

  public getState() {
    const acpxSessions = this.listAcpxSessions();
    const workspaceDirs = this.listWorkspaceDirs(acpxSessions);
    const channels = Object.values(CHANNEL_PROFILES).map((p) => {
      const chSessions = acpxSessions.filter((s) => s.channel === p.id);
      const running = Array.from(this.activeRuns.values()).filter(
        (r) => r.channel === p.id && r.status === 'running',
      );
      let queuedCount = 0;
      for (const [k, q] of this.queues.entries()) {
        if (k.startsWith(p.id + ':')) queuedCount += q.length;
      }
      const rawCandidate =
        this.selectedModels.get(p.id) ||
        chSessions[0]?.currentModel ||
        p.defaultModel;
      const chCurrentModel = p.recommendedModels.includes(rawCandidate) ? rawCandidate : p.defaultModel;
      const chCurrentCwd =
        this.selectedCwds.get(p.id) ||
        chSessions[0]?.cwd ||
        this.repoRoot;

      const health = this.channelFailures.get(p.id) || {
        started: chSessions.reduce((acc, s) => acc + (s.turnCount > 0 ? 1 : 0), 0),
        delivered: chSessions.reduce((acc, s) => acc + (s.turnCount > 0 ? 1 : 0), 0),
        failed: 0,
        consecutiveFailures: 0,
        state: 'closed' as const,
        lastAt: 0,
      };

      return {
        id: p.id,
        label: p.label,
        product: p.product,
        traceKind: p.traceKind,
        defaultModel: p.defaultModel,
        currentModel: chCurrentModel,
        currentCwd: chCurrentCwd,
        recommendedModels: [...p.recommendedModels],
        modes: p.modes || [],
        capabilities: this.registryCapabilities(p),
        capabilityEvidence: this.capabilityRegistry()?.families?.[p.id]?.gateway ?? null,
        accent: p.accent,
        badge: p.badge,
        notes: p.notes,
        status: running.length > 0 ? 'working' : 'idle',
        activeRuns: running.length,
        maxConcurrent: p.maxConcurrent,
        queuedCount,
        health,
        sessions: chSessions,
      };
    });

    const queuesObj: Record<string, QueuedPrompt[]> = {};
    for (const [k, q] of this.queues.entries()) {
      if (q.length) queuesObj[k] = q;
    }

    return {
      ok: true,
      channels,
      workspaceDirs,
      activeRuns: Array.from(this.activeRuns.values()),
      recentRuns: this.recentRuns.slice(0, 15),
      queues: queuesObj,
      acpxSessions,
      pendingApprovals: this.pendingApprovals.filter((a) => a.status === 'pending'),
      pendingQuestions: this.pendingQuestions.filter((q) => q.status === 'pending'),
      externalAnomalies: this.externalAnomalies,
      metaAgents: this.getMetaAgents(),
      metaAgentLogs: this.getMetaAgentLogs(),
      dispatches: this.getDispatchesSummary(),
    };
  }

  /** Switch the working directory (`cwd`) for a channel and/or named session. */
  public setSessionCwd(params: {
    channel: string;
    sessionName?: string;
    traceSessionId?: string;
    cwd: string;
  }) {
    const prof = resolveChannel(params.channel);
    if (!prof) {
      throw new Error(`未知渠道: ${params.channel}`);
    }
    const rawCwd = String(params.cwd || '').trim();
    if (!rawCwd) {
      throw new Error('工作目录路径不能为空');
    }
    const resolvedCwd = resolve(rawCwd);
    if (!existsSync(resolvedCwd) || !statSync(resolvedCwd).isDirectory()) {
      throw new Error(`工作目录不存在或不是有效文件夹: ${resolvedCwd}`);
    }

    const sessionName = this.resolveBoundSessionName(prof, params.sessionName, params.traceSessionId);

    this.selectedCwds.set(prof.id, resolvedCwd);
    if (sessionName) {
      const slot = this.slotKey(prof.id, sessionName);
      this.selectedCwds.set(slot, resolvedCwd);
      const draft = this.draftSessions.get(slot);
      if (draft) {
        draft.cwd = resolvedCwd;
      }
      if (prof.id !== 'antigravity' && existsSync(this.acpxDir)) {
        for (const f of readdirSync(this.acpxDir)) {
          if (!f.endsWith('.json')) continue;
          const fullPath = join(this.acpxDir, f);
          try {
            const raw = JSON.parse(readFileSync(fullPath, 'utf8'));
            if (raw && raw.name === sessionName && detectChannelFromCommand(raw.agent_command || '') === prof.id) {
              raw.cwd = resolvedCwd;
              writeFileSync(fullPath, JSON.stringify(raw, null, 2), 'utf8');
              break;
            }
          } catch {}
        }
      }
    }

    this.broadcast('state', this.getState());
    return {
      ok: true,
      channel: prof.id,
      sessionName: sessionName || null,
      cwd: resolvedCwd,
      workspaceDirs: this.listWorkspaceDirs(),
    };
  }

  public setSessionModel(params: {
    channel: string;
    sessionName?: string;
    traceSessionId?: string;
    model: string;
  }) {
    const prof = resolveChannel(params.channel);
    if (!prof) {
      throw new Error(`未知渠道: ${params.channel}`);
    }
    const model = String(params.model || '').trim();
    if (!model) {
      throw new Error('模型名称不能为空');
    }

    const sessionName = this.resolveBoundSessionName(prof, params.sessionName, params.traceSessionId);

    // With a session, the choice is that session's; without one, it is the product's default for new sessions.
    if (!sessionName) this.selectedModels.set(prof.id, model);
    if (sessionName) {
      const slot = this.slotKey(prof.id, sessionName);
      this.selectedModels.set(slot, model);
      const draft = this.draftSessions.get(slot);
      if (draft) {
        draft.currentModel = model;
        draft.availableModels = Array.from(new Set([model, ...(draft.availableModels || prof.recommendedModels)]));
      }

      if (prof.id !== 'antigravity') {
        let sessionCwd = this.selectedCwds.get(slot) || this.selectedCwds.get(prof.id) || this.repoRoot;
        // Persist into ~/.acpx/sessions/<id>.json if the session exists on disk
        if (existsSync(this.acpxDir)) {
          for (const f of readdirSync(this.acpxDir)) {
            if (!f.endsWith('.json')) continue;
            const fullPath = join(this.acpxDir, f);
            try {
              const raw = JSON.parse(readFileSync(fullPath, 'utf8'));
              if (raw && raw.name === sessionName && detectChannelFromCommand(raw.agent_command || '') === prof.id) {
                if (typeof raw.cwd === 'string' && raw.cwd.trim()) {
                  sessionCwd = raw.cwd.trim();
                }
                raw.acpx = raw.acpx || {};
                raw.acpx.current_model_id = model;
                if (Array.isArray(raw.acpx.available_models) && !raw.acpx.available_models.includes(model)) {
                  raw.acpx.available_models.unshift(model);
                }
                writeFileSync(fullPath, JSON.stringify(raw, null, 2), 'utf8');
                break;
              }
            } catch {}
          }
        }

        if (prof.id === 'codex') {
          const bound = this.listAcpxSessions().find((s) => s.channel === 'codex' && s.sessionName === sessionName && s.acpSessionId);
          const tid = bound?.acpSessionId || (params.traceSessionId?.startsWith('codex:') ? params.traceSessionId.slice(6) : '');
          if (tid && this.codexDriver) {
            this.codexDriver.switchModel(tid, model).catch(() => {});
          }
        } else if (prof.id === 'claude') {
          const bound = this.listAcpxSessions().find((s) => s.channel === 'claude' && s.sessionName === sessionName && s.acpSessionId);
          const sid =
            bound?.acpSessionId ||
            (params.traceSessionId?.startsWith('claude-code:') ? params.traceSessionId.slice(12) : '');
          if (sid && this.claudeDriver) {
            const liveSess = this.claudeDriver.getSession(sid);
            if (liveSess?.running) {
              liveSess.switchModel(model).catch(() => {});
            }
          }
        } else if (prof.route === 'acp-resident') {
          // A hot session switches now; otherwise the next turn loads it and applies the model recorded above.
          const bound = this.listAcpxSessions().find((s) => s.channel === prof.id && s.sessionName === sessionName && s.acpSessionId);
          const sid = bound?.acpSessionId || '';
          const d = sid ? this.acpDriverOf(sid) : undefined;
          if (d) d.setSessionModel(sid, model).catch(() => {});
        } else {
          // Fire `acpx --cwd <sessionCwd> <agent> set-model <model> -s <sessionName>` asynchronously so live ACP daemon updates too
          try {
            const env = { ...agentBaseEnv(), ...prof.buildEnv() };
            const setArgs = ['--format', 'json', '--cwd', sessionCwd, prof.acpxAgent, 'set-model', model, '-s', sessionName];
            const setCmd = ['acpx', ...setArgs.map(quoteWinArg)].join(' ');
            const p = spawn(
              existsSync(ACPX_CLI) ? process.execPath : 'cmd.exe',
              existsSync(ACPX_CLI) ? [ACPX_CLI, ...setArgs] : ['/d', '/s', '/c', setCmd],
              {
                cwd: sessionCwd,
                env,
                stdio: ['ignore', 'pipe', 'pipe'], // acpx waits for EOF on an open stdin pipe
                windowsHide: true,
              },
            );
            p.on('error', () => {});
          } catch {}
        }
      }
    }

    this.broadcast('state', this.getState());
    return {
      ok: true,
      channel: prof.id,
      sessionName: sessionName || null,
      model,
    };
  }

  capRegistryCache: { mtimeMs: number; data: any } | null = null;

  /** hub/data/capabilities.json, generated from the probe blackboard (channels/probe/scripts/build_capabilities.js). */
  capabilityRegistry(): any | null {
    const file = join(this.repoRoot, 'hub', 'data', 'capabilities.json');
    try {
      const st = statSync(file);
      if (!this.capRegistryCache || this.capRegistryCache.mtimeMs !== st.mtimeMs) {
        this.capRegistryCache = { mtimeMs: st.mtimeMs, data: JSON.parse(readFileSync(file, 'utf8')) };
      }
      return this.capRegistryCache.data;
    } catch {
      return null;
    }
  }

  /**
   * Capability flags the pages render from. A flag is turned off only when the registry shows the
   * gateway path as tested and broken (fail / n/a); passing, partial and untested stay on. Without a
   * registry the hand-written profile flags are used, as before.
   */
  registryCapabilities(p: ChannelProfile): ChannelCapabilities {
    const g = this.capabilityRegistry()?.families?.[p.id]?.gateway;
    if (!g) return p.capabilities;
    const ok = (cap: string, fallback: boolean) => {
      const st = g[cap]?.state;
      return st ? st !== 'fail' && st !== 'n/a' : fallback;
    };
    const c = p.capabilities;
    return {
      canCreateSession: ok('open', c.canCreateSession),
      canSendPrompt: ok('open', c.canSendPrompt),
      canCancelRun: ok('cancel', c.canCancelRun),
      canSwitchModelOnNew: ok('model-new', c.canSwitchModelOnNew),
      canSwitchModelMidSession: ok('model-switch', c.canSwitchModelMidSession),
      canSetPermissionMode: ok('mode-switch', c.canSetPermissionMode),
      canReadExternalSessions: c.canReadExternalSessions,
    };
  }

  public addSseClient(res: ServerResponse) {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Content-Type-Options': 'nosniff',
    });
    res.write(`data: ${JSON.stringify({ type: 'gateway_snapshot', ...this.getState() })}\n\n`);
    this.clients.add(res);
    res.on('close', () => {
      this.clients.delete(res);
    });
  }

  broadcast(event: string, payload: unknown) {
    const envelope =
      event === 'state'
        ? { type: 'gateway_snapshot', ...(payload as Record<string, unknown>) }
        : event === 'meta_agent_action'
        ? { type: 'meta_agent_action', entry: payload, metaAgents: this.getMetaAgents() }
        : event === 'dispatch_update'
        ? { type: 'dispatch_update', dispatch: payload, dispatches: this.getDispatchesSummary() }
        : { type: event, run: payload };
    const msg = `data: ${JSON.stringify(envelope)}\n\n`;
    for (const client of this.clients) {
      try {
        client.write(msg);
      } catch {
        this.clients.delete(client);
      }
    }
  }

  public waitForRunCompletion(runId: string, timeoutMs = ACPX_TURN_TIMEOUT_SEC * 1000): Promise<ActiveRun | null> {
    const recent = this.recentRuns.find((r) => r.runId === runId);
    if (recent && recent.status !== 'running') {
      return Promise.resolve(recent);
    }
    return new Promise((resolvePromise) => {
      const timer = setTimeout(() => {
        const list = this.runWaiters.get(runId) || [];
        this.runWaiters.set(
          runId,
          list.filter((fn) => fn !== onDone),
        );
        const cur = Array.from(this.activeRuns.values()).find((r) => r.runId === runId) || null;
        resolvePromise(cur);
      }, Math.max(2000, timeoutMs));

      const onDone = (finishedRun: ActiveRun) => {
        clearTimeout(timer);
        resolvePromise(finishedRun);
      };

      const existing = this.runWaiters.get(runId) || [];
      existing.push(onDone);
      this.runWaiters.set(runId, existing);
    });
  }

  public async sendPrompt(params: {
    channel: string;
    sessionName?: string;
    traceSessionId?: string;
    cwd?: string;
    prompt: string;
    model?: string;
    permissions?: 'all' | 'reads' | 'deny';
    mode?: 'send' | 'queue' | 'interrupt';
    source?: 'web' | 'cli';
    retryCount?: number;
    resumedByMeta?: string;
    wait?: boolean;
    timeoutMs?: number;
    /** Pictures sent with the words (data: URLs, e.g. a pasted phone screenshot). */
    images?: string[];
  }) {
    const prof = resolveChannel(params.channel);
    if (!prof) {
      throw new Error(`未知渠道: ${params.channel}`);
    }
    let prompt = String(params.prompt || '').trim();
    const images = (params.images || []).filter((d) => /^data:image\/[\w.+-]+;base64,/.test(String(d))).slice(0, 8);
    if (!prompt && !images.length) {
      throw new Error('消息内容不能为空');
    }
    if (images.length) {
      // Saved to disk and named in the words, so every agent can open them with its file tools (Antigravity's
      // send-message takes text only); acpx agents also get them as ACP image blocks (startRunInternal).
      const dir = join(HOME, '.agent-hub', 'uploads', new Date().toISOString().replace(/\D/g, '').slice(0, 14) + '-' + Math.random().toString(36).slice(2, 6));
      mkdirSync(dir, { recursive: true });
      const blocks: Array<{ type: 'image'; mimeType: string; data: string }> = [];
      const paths = images.map((d, i) => {
        const m = /^data:(image\/[\w.+-]+);base64,(.*)$/s.exec(d)!;
        const ext = m[1].split('/')[1].replace('jpeg', 'jpg').replace(/[^a-z0-9]/gi, '');
        const file = join(dir, `img-${i + 1}.${ext}`);
        writeFileSync(file, Buffer.from(m[2], 'base64'));
        blocks.push({ type: 'image', mimeType: m[1], data: m[2] });
        return file;
      });
      prompt = (prompt || '请看图。') + `\n\n（附图 ${paths.length} 张，已存到：\n${paths.join('\n')}\n如果你看不到图片内容，请用读文件或查看图片的工具打开这些文件。）`;
      this.promptImages.set(prompt, blocks);
    }

    // Resolve sessionName from traceSessionId or bound acpx record if provided
    const sessionName = this.resolveBoundSessionName(prof, params.sessionName, params.traceSessionId) || `hub-${prof.id}`;

    const key = this.slotKey(prof.id, sessionName);
    const cwd = this.resolveSessionCwd(prof, sessionName, params.cwd);
    this.selectedCwds.set(key, cwd);
    // Read-only unless the caller asked for more; no meta-agent may widen it silently (2026-10-17 decision).
    const permissions = params.permissions || 'all';
    const source = params.source || 'web';
    const mode = params.mode || 'send';
    // An existing session keeps the model it runs on (its own record) unless one is chosen: the in-memory choice
    // is lost on restart, and falling back to the family default silently switched sessions (seen 2026-10-18).
    const model =
      (params.model || '').trim() ||
      this.selectedModels.get(key) ||
      this.listAcpxSessions().find((s) => s.channel === prof.id && s.sessionName === sessionName)?.currentModel ||
      this.selectedModels.get(prof.id) ||
      prof.defaultModel;
    // Only this session's choice is remembered: writing it to the product too made every later new session of the
    // product inherit it (OpenCode after one session switched to a blocked free model, full test 10-18).
    this.selectedModels.set(key, model);

    const existingRun = this.activeRuns.get(key);
    if (existingRun && existingRun.status === 'running') {
      // Antigravity reads a message sent to a running conversation within the turn (measured 2026-10-17:
      // inserted at step 18, answered at step 23). Queueing it until the turn ends threw that away.
      if (mode !== 'interrupt' && mode !== 'queue' && prof.id === 'antigravity' && this.steerAntigravity(sessionName, existingRun, prompt, cwd)) {
        return { ok: true, status: 'running', action: 'steered', channel: prof.id, sessionName, runId: existingRun.runId };
      }
      // Codex app-server supports real in-turn steer via turn/steer RPC with expectedTurnId
      if (mode !== 'interrupt' && mode !== 'queue' && prof.id === 'codex') {
        const steered = await this.steerCodexRun(existingRun, prompt);
        if (steered) {
          return { ok: true, status: 'running', action: 'steered', channel: prof.id, sessionName, runId: existingRun.runId };
        }
      }
      if (mode === 'interrupt') {
        await this.cancelRun(prof.id, sessionName);
      } else {
        const q = this.queues.get(key) || [];
        const item: QueuedPrompt = {
          id: 'q_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
          prompt,
          model,
          permissions,
          source,
          enqueuedAt: new Date().toISOString(),
        };
        q.push(item);
        this.queues.set(key, q);
        this.broadcast('state', this.getState());
        return {
          ok: true,
          status: 'queued',
          action: 'queued',
          queueLength: q.length,
          channel: prof.id,
          sessionName,
          queuePosition: q.length,
          queuedItem: item,
        };
      }
    }

    const run = this.startRunInternal({
      prof,
      sessionName,
      traceSessionId: params.traceSessionId,
      cwd,
      prompt,
      model,
      permissions,
      source,
      retryCount: params.retryCount || 0,
      resumedByMeta: params.resumedByMeta,
    });

    if (params.wait) {
      const doneRun = (await this.waitForRunCompletion(run.runId, params.timeoutMs || ACPX_TURN_TIMEOUT_SEC * 1000)) || run;
      return {
        ok: doneRun.status === 'completed' && !doneRun.error,
        status: doneRun.status,
        action: 'completed',
        runId: doneRun.runId,
        channel: prof.id,
        sessionName,
        traceSessionId: doneRun.traceSessionId,
        model: doneRun.model,
        cwd: doneRun.cwd,
        reply: doneRun.text || '',
        thoughts: doneRun.thoughts || '',
        tools: doneRun.tools || [],
        durationMs: doneRun.durationMs || Date.now() - Date.parse(doneRun.startedAt),
        error: doneRun.error || null,
        run: doneRun,
      };
    }

    return {
      ok: true,
      status: 'running',
      action: 'started',
      runId: run.runId,
      channel: prof.id,
      sessionName,
      run,
    };
  }

  public async cancelRun(channelRaw: string, sessionName?: string, queuedId?: string) {
    const prof = resolveChannel(channelRaw);
    if (!prof) throw new Error(`未知渠道: ${channelRaw}`);
    const sName = this.resolveBoundSessionName(prof, sessionName) || sessionName || `hub-${prof.id}`;
    const key = this.slotKey(prof.id, sName);

    if (queuedId) {
      const q = (this.queues.get(key) || []).filter((x) => x.id !== queuedId);
      this.queues.set(key, q);
      this.broadcast('state', this.getState());
      return { ok: true, removedQueuedId: queuedId };
    }

    const run = this.activeRuns.get(key);
    if (run && run.status === 'running') {
      run.status = 'cancelling';
      this.broadcast('run_update', run);
    }

    // Decline any pending in-turn approval for this run before interrupting
    if (run) {
      for (const [apprId, entry] of this.liveApprovalResolvers.entries()) {
        if (entry.runId === run.runId) {
          this.liveApprovalResolvers.delete(apprId);
          const item = this.pendingApprovals.find((a) => a.id === apprId);
          if (item && item.status === 'pending') item.status = 'rejected';
          try {
            entry.resolve(false);
          } catch {}
        }
      }
      for (const [qid, entry] of this.liveQuestionResolvers.entries()) {
        if (entry.runId === run.runId) {
          this.liveQuestionResolvers.delete(qid);
          const q = this.pendingQuestions.find((x) => x.id === qid);
          if (q && q.status === 'pending') q.status = 'cancelled';
          try {
            entry.resolve(null);
          } catch {}
        }
      }
      run.waitingQuestionId = undefined;
      run.waitingApprovalId = undefined;
    }

    if (prof.id === 'antigravity') {
      try {
        const ls = this.discoverAntigravityLs();
        const agyMap = this.loadAgySessionMap();
        const cid =
          agyMap[sName] ||
          (run?.traceSessionId?.startsWith('antigravity:') ? run.traceSessionId.slice(12) : '');
        if (cid && ls.port && ls.csrf) {
          await fetch(
            `http://127.0.0.1:${ls.port}/exa.language_server_pb.LanguageServerService/CancelCascadeInvocation`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Connect-Protocol-Version': '1',
                'x-codeium-csrf-token': ls.csrf,
              },
              body: JSON.stringify({ cascadeId: cid }),
            },
          ).catch(() => {});
        }
      } catch {}
    } else if (prof.id === 'codex') {
      try {
        const tid =
          run?.codexThreadId ||
          (run?.traceSessionId?.startsWith('codex:') ? run.traceSessionId.slice('codex:'.length) : '');
        if (tid && this.codexDriver) {
          await this.codexDriver.interruptTurn(tid, run?.codexTurnId).catch(() => {});
        }
      } catch {}
    } else if (prof.id === 'claude') {
      try {
        const sid =
          run?.claudeSessionId ||
          (run?.traceSessionId?.startsWith('claude-code:') ? run.traceSessionId.slice('claude-code:'.length) : '');
        if (sid && this.claudeDriver) {
          await this.claudeDriver.getSession(sid)?.interrupt().catch(() => {});
        }
      } catch {}
    } else if (run?.acpSessionId && this.acpDriverOf(run.acpSessionId)) {
      this.acpDriverOf(run.acpSessionId)!.cancelTurn(run.acpSessionId);
    } else {
      // Invoke acpx cancel
      try {
        const env = { ...agentBaseEnv(), ...prof.buildEnv() };
        spawnSync(
          'cmd.exe',
          ['/d', '/s', '/c', `acpx --format json ${prof.acpxAgent} cancel -s ${quoteWinArg(sName)}`],
          { cwd: this.repoRoot, env, timeout: 8000, windowsHide: true },
        );
      } catch {}
    }

    const proc = this.activeProcs.get(key);
    if (proc && !proc.killed) {
      try {
        proc.kill();
      } catch {}
    }

    if (run) {
      run.status = 'aborted';
      run.endedAt = new Date().toISOString();
      run.durationMs = Date.now() - Date.parse(run.startedAt);
      this.activeRuns.delete(key);
      this.activeProcs.delete(key);
      if (run.codexThreadId) this.activeCodexRunsByThread.delete(run.codexThreadId);
      if (run.claudeSessionId) this.activeClaudeRunsBySession.delete(run.claudeSessionId);
      if (run.acpSessionId) this.activeAcpRunsBySession.delete(run.acpSessionId);
      this.rememberRun(run);
      this.broadcast('run_done', run);
      this.broadcast('state', this.getState());
    }

    return { ok: true, channel: prof.id, sessionName: sName };
  }

  /** runId → when the turn first looked done, and the transcript length at that moment. */
  readonly agyDoneSince = new Map<string, { at: number; lines: number }>();

  finalizeRun(
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
  ) {
    const { prof, sessionName, cwd, model } = opts;
    const key = this.slotKey(prof.id, sessionName);

    this.activeProcs.delete(key);
    this.activeRuns.delete(key);
    if (run.codexThreadId) this.activeCodexRunsByThread.delete(run.codexThreadId);
    if (run.claudeSessionId) this.activeClaudeRunsBySession.delete(run.claudeSessionId);

    // Clean up any unresolved live in-turn approvals for this run
    for (const [apprId, entry] of this.liveApprovalResolvers.entries()) {
      if (entry.runId === run.runId) {
        this.liveApprovalResolvers.delete(apprId);
        const item = this.pendingApprovals.find((a) => a.id === apprId);
        if (item && item.status === 'pending') item.status = 'rejected';
        try {
          entry.resolve(false);
        } catch {}
      }
    }
    run.waitingApprovalId = undefined;

    for (const t of run.tools) {
      if (t.status === 'running') t.status = run.status === 'failed' ? 'error' : 'ok';
    }

    run.endedAt = new Date().toISOString();
    run.durationMs = Date.now() - Date.parse(run.startedAt);
    if (run.status === 'failed') run.failureKind = classifyFailure(run);

    // Find updated traceSessionId
    const linked = this.listAcpxSessions().find(
      (s) => s.channel === prof.id && s.sessionName === sessionName,
    );
    if (linked) {
      run.traceSessionId = linked.traceSessionId;
    }

    this.rememberRun(run);
    try {
      this.onRunFinalizedForDispatches(run);
    } catch {}

    // The product's breaker and its quota account (gateway/capacity.ts).
    this.recordTurnHealth(prof, run);

    // Append governance event to channels/events.jsonl
    try {
      mkdirSync(join(this.repoRoot, 'channels'), { recursive: true });
      appendFileSync(
        this.eventsFile,
        JSON.stringify({
          ts: run.endedAt,
          kind: 'gateway_turn',
          source: run.source,
          channel: run.channel,
          session: run.sessionName,
          traceSessionId: run.traceSessionId,
          status: run.status,
          durationMs: run.durationMs,
          promptPreview: run.prompt.slice(0, 80),
        }) + '\n',
        'utf8',
      );
    } catch {}

    this.draftSessions.delete(key);

    // Detect if any tool call or turn output was blocked due to read-only / denied permissions
    // (Skip post-turn fill for codex & claude since they use real in-turn approval via app-server / stream-json)
    const permRe = /(permission|denied|not allowed|read-only|refused|approval|未经授权|权限被拒|拒绝执行)/i;
    const blockedTool = run.tools.find(
      (t) =>
        (t.status === 'error' && permRe.test(t.output || '')) ||
        (opts.permissions !== 'all' && (t.category === 'edit' || t.category === 'shell') && t.status === 'error'),
    );
    if (
      prof.id !== 'codex' &&
      prof.id !== 'claude' &&
      !sessionName.startsWith('meta-brain') &&
      (blockedTool || (opts.permissions !== 'all' && permRe.test(run.error || run.text || '')))
    ) {
      const approvalItem: PendingApproval = {
        id: `appr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        runId: run.runId,
        channel: prof.id,
        sessionName,
        traceSessionId: run.traceSessionId,
        cwd,
        model,
        prompt: opts.prompt,
        toolName: blockedTool ? blockedTool.summary || blockedTool.name : '写入/终端工具请求',
        toolInput: blockedTool?.input,
        reason: blockedTool?.output || run.error || `当前会话处于 ${opts.permissions} 权限门禁下，操作等待批准`,
        createdAt: new Date().toISOString(),
        status: 'pending',
        inTurn: false,
        mode: 'session-retry',
      };
      this.pendingApprovals.unshift(approvalItem);
      if (this.pendingApprovals.length > 20) this.pendingApprovals.pop();
    }

    // Resolve any synchronous CLI/MCP waiters waiting on this runId
    const waiters = this.runWaiters.get(run.runId);
    if (waiters && waiters.length > 0) {
      this.runWaiters.delete(run.runId);
      for (const fn of waiters) {
        try {
          fn(run);
        } catch {}
      }
    }

    this.broadcast('run_done', run);
    this.broadcast('state', this.getState());

    // Refresh SessionStore asynchronously in background so SSE run_done is never delayed
    this.store.refresh(0).catch(() => {});

    // Check Meta-Agents for Loop Guard / Model Failover / Auto-Resume on failure (skip for brain sessions themselves!)
    const isBrainSession = sessionName.startsWith('meta-brain');
    const errTools = run.tools.filter((t) => t.status === 'error');
    const auditor = this.metaAgents.get('meta_auditor');
    if (!isBrainSession && auditor?.enabled && errTools.length >= (auditor.maxConsecutiveErrors || 3)) {
      this.recordMetaAction(
        'meta_auditor',
        prof.id,
        sessionName,
        '死循环预警',
        `检测到单轮连续 ${errTools.length} 次工具调用报错，已触发元智能体的诊断会话审计`,
        { eventKind: 'loop_detected' },
      );
      if (auditor.engineMode !== 'local_rules') {
        this.invokeMetaBrainForIncident({
          metaId: 'meta_auditor',
          eventKind: 'loop_detected',
          targetChannel: prof.id,
          targetSessionName: sessionName,
          summary: `单轮连续 ${errTools.length} 次工具调用报错`,
          errorDetail: errTools.map((t) => `${t.name}: ${(t.output || '').slice(0, 120)}`).join(' | '),
        }).catch(() => {});
      }
    }

    const resumer = this.metaAgents.get('meta_resumer');
    const maint = this.metaAgents.get('meta_maint');
    const retryCount = run.retryCount || 0;
    const maxRetries = resumer?.maxRetries ?? 2;

    // Retry only what another try can fix (gateway/failure.ts): the connection dropped, the turn broke before its
    // result, or the model's upstream channel is down (then on another model). A quota is the account's cooldown's
    // business (capacity.ts); a timeout, a refusal, a refused tool or a failed setup would only repeat.
    const retryable = run.failureKind === 'network' || run.failureKind === 'broken' || run.failureKind === 'upstream';
    // A turn a dispatch was waiting on has already been settled into that dispatch; its owner (the caller, or the
    // task board) decides whether to try again and where. A retry here would run unseen and hold the session.
    const ownedByDispatch = [...this.dispatches.values()].some((d) => d.targetRunId === run.runId);
    if (!isBrainSession && run.status === 'failed' && retryable && !ownedByDispatch && resumer?.enabled && retryCount < maxRetries) {
      let nextModel = model;
      const errMsg = String(run.error || '');
      if (maint?.enabled && run.failureKind === 'upstream') {
        const candidates = prof.recommendedModels.filter((m) => m !== model);
        if (candidates.length > 0) {
          nextModel = candidates[0];
          this.selectedModels.set(key, nextModel);
          this.recordMetaAction(
            'meta_maint',
            prof.id,
            sessionName,
            '模型容灾切换',
            `检测到配额/模型异常 (${errMsg.slice(0, 50)})，自动从 ${model} 切换至备选模型 ${nextModel}`,
            { eventKind: 'quota_or_model_error' },
          );
        }
      }

      const delayMs = (resumer.retryDelaySec || 2) * 1000;
      this.recordMetaAction(
        'meta_resumer',
        prof.id,
        sessionName,
        `断网/Bug自动续跑 (#${retryCount + 1})`,
        `检测到异常中断 (${errMsg.slice(0, 60) || '进程非零退出'})，唤醒元智能体的诊断会话诊断并在 ${resumer.retryDelaySec || 2}s 后自动续跑`,
        { eventKind: 'execution_failure' },
      );

      // Wake up Supervisor Meta-Agent brain in parallel if configured
      if (resumer.engineMode !== 'local_rules') {
        this.invokeMetaBrainForIncident({
          metaId: 'meta_resumer',
          eventKind: run.failureKind === 'upstream' ? 'quota_or_model_error' : 'execution_failure',
          targetChannel: prof.id,
          targetSessionName: sessionName,
          summary: errMsg || '进程非零退出',
        }).catch(() => {});
      }

      setTimeout(() => {
        if (this.activeRuns.get(key)?.status === 'running') return;
        this.startRunInternal({
          prof,
          sessionName,
          traceSessionId: run.traceSessionId,
          cwd,
          // Quote the user's original words, not the previous retry prompt (retries used to nest).
          prompt: `上一轮在中途断开了，没有拿到回复。请接着完成原来的请求：${(run.originalPrompt || opts.prompt).slice(0, 400)}`,
          model: nextModel,
          permissions: opts.permissions,
          source: opts.source,
          retryCount: retryCount + 1,
          resumedByMeta: 'meta_resumer',
          originalPrompt: run.originalPrompt || opts.prompt,
        });
      }, delayMs);
      return;
    }

    // Dequeue next prompt if any
    const q = this.queues.get(key) || [];
    if (q.length > 0) {
      const next = q.shift()!;
      this.queues.set(key, q);
      this.startRunInternal({
        prof,
        sessionName,
        traceSessionId: run.traceSessionId,
        cwd,
        prompt: next.prompt,
        model: next.model || model,
        permissions: next.permissions,
        source: next.source,
      });
    }
  }

  saveDriverSessionRecord(params: {
    channel: ChannelId;
    sessionName: string;
    nativeId: string;
    cwd: string;
    model: string;
    driverName: 'app-server' | 'stream-json' | 'acp-resident';
    prompt?: string;
    reply?: string;
  }) {
    try {
      mkdirSync(this.acpxDir, { recursive: true });
      const safeName = params.sessionName.replace(/[^a-zA-Z0-9._-]/g, '_');
      const recordId = `driver-${params.channel}-${safeName}`;
      const filePath = join(this.acpxDir, `${recordId}.json`);
      const now = new Date().toISOString();
      let existing: any = null;
      if (existsSync(filePath)) {
        try {
          existing = JSON.parse(readFileSync(filePath, 'utf8'));
        } catch {}
      }
      const messages: any[] = Array.isArray(existing?.messages) ? existing.messages : [];
      if (params.prompt) {
        messages.push({ User: { content: [{ Text: params.prompt }] } });
      }
      if (params.reply) {
        messages.push({ Agent: { content: [{ Text: params.reply }], tool_results: {} } });
      }
      const record = {
        schema: 'acpx.session.v1',
        acpx_record_id: recordId,
        acp_session_id: params.nativeId,
        // acpx reads this to start the agent and listAcpxSessions to tell the product: for a resident ACP session it is
        // the same bridge command acpx would use.
        agent_command:
          params.driverName === 'acp-resident'
            ? (({ cmd, args }) => [cmd, ...args].join(' '))(resolveAcpBridgeCommand(CHANNEL_PROFILES[params.channel]?.acpxAgent || params.channel))
            : params.channel === 'codex'
            ? 'codex app-server'
            : 'claude --input-format stream-json',
        cwd: params.cwd,
        name: params.sessionName,
        created_at: existing?.created_at || now,
        last_used_at: now,
        last_seq: messages.length,
        event_count: messages.length,
        messages,
        acpx: {
          ...(existing?.acpx || {}),
          current_model_id: params.model,
          driver: params.driverName,
        },
      };
      writeFileSync(filePath, JSON.stringify(record, null, 2), 'utf8');
    } catch {}
  }

  startRunInternal(opts: RunOpts): ActiveRun {
    const { prof, sessionName, cwd, prompt, model, permissions, source } = opts;
    const key = this.slotKey(prof.id, sessionName);
    const runId = `run_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const startedAt = new Date().toISOString();
    const initialMsgCount = this.getExistingMessageCount(prof.id, sessionName);

    const startHealth = this.channelFailures.get(prof.id) || {
      started: 0,
      delivered: 0,
      failed: 0,
      consecutiveFailures: 0,
      state: 'closed' as const,
      lastAt: Date.now(),
    };
    startHealth.started += 1;
    startHealth.lastAt = Date.now();
    if (startHealth.state === 'open') startHealth.state = 'probing';
    this.channelFailures.set(prof.id, startHealth);

    const run: ActiveRun = {
      runId,
      channel: prof.id,
      channelId: prof.id,
      sessionName,
      traceSessionId: opts.traceSessionId,
      cwd,
      model,
      permissions,
      source,
      prompt,
      status: 'running',
      startedAt,
      thoughts: '',
      text: '',
      tools: [],
      initialMsgCount,
      retryCount: opts.retryCount || 0,
      resumedByMeta: opts.resumedByMeta,
      originalPrompt: opts.originalPrompt || prompt,
    };

    this.activeRuns.set(key, run);
    this.broadcast('run_start', run);
    this.broadcast('state', this.getState());

    if (prof.id === 'antigravity') {
      return this.startAntigravityRun(run, opts);
    }
    if (prof.id === 'codex') {
      return this.startCodexAppServerRun(run, opts);
    }
    if (prof.id === 'claude') {
      return this.startClaudeStreamRun(run, opts);
    }
    if (prof.route === 'acp-resident') {
      return this.startAcpResidentRun(run, opts);
    }
    return this.startAcpxRun(run, opts);
  }
}

// acpRunMethods: gateway/run_acp.ts
type AcpRunMethods = typeof acpRunMethods;
export interface AgentGatewayHub extends AcpRunMethods {}
Object.assign(AgentGatewayHub.prototype, acpRunMethods);

// approvalMethods: gateway/approvals.ts
type ApprovalMethods = typeof approvalMethods;
export interface AgentGatewayHub extends ApprovalMethods {}
Object.assign(AgentGatewayHub.prototype, approvalMethods);

// sessionControlMethods: gateway/session_control.ts
type SessionControlMethods = typeof sessionControlMethods;
export interface AgentGatewayHub extends SessionControlMethods {}
Object.assign(AgentGatewayHub.prototype, sessionControlMethods);

// codexRunMethods: gateway/run_codex.ts
type CodexRunMethods = typeof codexRunMethods;
export interface AgentGatewayHub extends CodexRunMethods {}
Object.assign(AgentGatewayHub.prototype, codexRunMethods);

// claudeRunMethods: gateway/run_claude.ts
type ClaudeRunMethods = typeof claudeRunMethods;
export interface AgentGatewayHub extends ClaudeRunMethods {}
Object.assign(AgentGatewayHub.prototype, claudeRunMethods);

// acpxRunMethods: gateway/run_acpx.ts
type AcpxRunMethods = typeof acpxRunMethods;
export interface AgentGatewayHub extends AcpxRunMethods {}
Object.assign(AgentGatewayHub.prototype, acpxRunMethods);

// antigravityMethods: gateway/antigravity.ts
type AntigravityMethods = typeof antigravityMethods;
export interface AgentGatewayHub extends AntigravityMethods {}
Object.assign(AgentGatewayHub.prototype, antigravityMethods);

// sessionMethods: gateway/sessions.ts
type SessionMethods = typeof sessionMethods;
export interface AgentGatewayHub extends SessionMethods {}
Object.assign(AgentGatewayHub.prototype, sessionMethods);

// collabMethods: gateway/collab.ts
type CollabMethods = typeof collabMethods;
export interface AgentGatewayHub extends CollabMethods {}
Object.assign(AgentGatewayHub.prototype, collabMethods);

// metaMethods: gateway/meta.ts
type MetaMethods = typeof metaMethods;
export interface AgentGatewayHub extends MetaMethods {}
Object.assign(AgentGatewayHub.prototype, metaMethods);

// capacityMethods: gateway/capacity.ts
type CapacityMethods = typeof capacityMethods;
export interface AgentGatewayHub extends CapacityMethods {}
Object.assign(AgentGatewayHub.prototype, capacityMethods);
