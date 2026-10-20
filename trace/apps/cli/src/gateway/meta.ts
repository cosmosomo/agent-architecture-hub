/**
 * Meta-agents: their settings (~/.acpx/hub-meta-agents.json), the background patrol, and the diagnosing session they call
 * for an incident.
 * Mixed into AgentGatewayHub (gateway.ts); `this` is the hub.
 */
import type { AgentGatewayHub } from '../gateway.ts';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ToolStep } from '@hub-trace/contract';
import type { ChannelId, MetaAgentId, MetaAgentConfig, MetaAgentLogEntry, ChannelProfile, ExternalSessionAnomaly } from './types.ts';
import { CHANNEL_PROFILES, resolveChannel } from './products.ts';
import { HOME, DEFAULT_SUPERVISOR_PERSONA, DEFAULT_META_AGENTS } from './common.ts';

export const metaMethods = {
  loadMetaAgents(this: AgentGatewayHub) {
    for (const [id, def] of Object.entries(DEFAULT_META_AGENTS) as [MetaAgentId, MetaAgentConfig][]) {
      this.metaAgents.set(id, { ...def });
    }
    try {
      if (existsSync(this.metaAgentsFile)) {
        const raw = JSON.parse(readFileSync(this.metaAgentsFile, 'utf8'));
        if (raw && typeof raw === 'object') {
          for (const [id, cfg] of Object.entries(raw.agents || raw)) {
            if (id in DEFAULT_META_AGENTS && cfg && typeof cfg === 'object') {
              const base = this.metaAgents.get(id as MetaAgentId)!;
              const merged: MetaAgentConfig = {
                ...base,
                ...(cfg as Partial<MetaAgentConfig>),
                id: id as MetaAgentId,
                runtimeStatus: 'standby',
              };
              const bCh = resolveChannel(merged.brainChannel || 'zcode') || CHANNEL_PROFILES.zcode;
              merged.brainChannel = bCh.id;
              if (!merged.brainModel || !bCh.recommendedModels.includes(merged.brainModel)) {
                merged.brainModel = bCh.defaultModel;
              }
              if (!merged.brainSessionName || merged.brainSessionName === 'meta-brain-fufu') {
                merged.brainSessionName = 'meta-brain-supervisor';
              }
              if (!merged.engineMode) merged.engineMode = 'agent_brain';
              if (!merged.patrolIntervalSec) merged.patrolIntervalSec = 15;
              // Name, description and persona are the product's own text, not settings a person changes: they
              // always come from the code, so a rename (the 10-18 wording cleanup) is not undone by the saved file.
              merged.name = base.name;
              merged.description = base.description;
              merged.persona = base.persona || DEFAULT_SUPERVISOR_PERSONA;
              if (merged.lastAction && merged.lastAction.includes('芙芙')) {
                merged.lastAction = merged.lastAction.replace(/芙芙大脑/g, '元智能体的诊断会话').replace(/芙芙/g, '元智能体');
              }
              this.metaAgents.set(id as MetaAgentId, merged);
            }
          }
          if (Array.isArray(raw.logs)) {
            this.metaAgentLogs.push(
              ...raw.logs.slice(0, 40).map((lg: MetaAgentLogEntry) => ({
                ...lg,
                detail: String(lg.detail || '').replace(/芙芙大脑/g, '元智能体的诊断会话').replace(/芙芙/g, '元智能体'),
              })),
            );
          }
          this.saveMetaAgents();
        }
      }
    } catch {}
  },

  saveMetaAgents(this: AgentGatewayHub) {
    try {
      mkdirSync(join(HOME, '.acpx'), { recursive: true });
      const agentsObj: Record<string, MetaAgentConfig> = {};
      for (const [id, cfg] of this.metaAgents.entries()) {
        agentsObj[id] = cfg;
      }
      writeFileSync(
        this.metaAgentsFile,
        JSON.stringify({ agents: agentsObj, logs: this.metaAgentLogs.slice(0, 40) }, null, 2),
        'utf8',
      );
    } catch {}
  },

  getMetaAgents(this: AgentGatewayHub): MetaAgentConfig[] {
    return Array.from(this.metaAgents.values());
  },

  getMetaAgentLogs(this: AgentGatewayHub): MetaAgentLogEntry[] {
    return this.metaAgentLogs.slice(0, 30);
  },

  updateMetaAgent(this: AgentGatewayHub, params: {
    id?: string;
    applyToAll?: boolean;
    enabled?: boolean;
    policy?: 'all' | 'safe_write' | 'reads';
    maxRetries?: number;
    retryDelaySec?: number;
    maxConsecutiveErrors?: number;
    engineMode?: 'agent_brain' | 'local_rules';
    brainChannel?: string;
    brainModel?: string;
    brainSessionName?: string;
    patrolIntervalSec?: number;
    persona?: string;
  }) {
    const targetIds: MetaAgentId[] =
      params.applyToAll || !params.id || params.id === 'all'
        ? (['meta_approver', 'meta_resumer', 'meta_maint', 'meta_auditor'] as MetaAgentId[])
        : [params.id as MetaAgentId];

    let resolvedBrainChannel: ChannelProfile | null = null;
    if (params.brainChannel) {
      resolvedBrainChannel = resolveChannel(params.brainChannel);
    }

    for (const id of targetIds) {
      const existing = this.metaAgents.get(id);
      if (!existing) continue;
      if (typeof params.enabled === 'boolean' && !params.applyToAll) existing.enabled = params.enabled;
      if (params.policy && id === 'meta_approver') existing.policy = params.policy;
      if (typeof params.maxRetries === 'number') existing.maxRetries = Math.max(0, Math.min(5, params.maxRetries));
      if (typeof params.retryDelaySec === 'number') {
        existing.retryDelaySec = Math.max(1, Math.min(30, params.retryDelaySec));
      }
      if (typeof params.maxConsecutiveErrors === 'number') {
        existing.maxConsecutiveErrors = Math.max(1, Math.min(10, params.maxConsecutiveErrors));
      }
      if (params.engineMode === 'agent_brain' || params.engineMode === 'local_rules') {
        existing.engineMode = params.engineMode;
      }
      if (resolvedBrainChannel) {
        existing.brainChannel = resolvedBrainChannel.id;
        if (!params.brainModel || !resolvedBrainChannel.recommendedModels.includes(params.brainModel)) {
          existing.brainModel = resolvedBrainChannel.defaultModel;
        }
      }
      if (params.brainModel) {
        const chProf = resolveChannel(existing.brainChannel || 'zcode') || CHANNEL_PROFILES.zcode;
        if (chProf.recommendedModels.includes(params.brainModel)) {
          existing.brainModel = params.brainModel;
        }
      }
      if (params.brainSessionName && params.brainSessionName.trim()) {
        existing.brainSessionName = params.brainSessionName.trim();
      }
      if (typeof params.patrolIntervalSec === 'number') {
        existing.patrolIntervalSec = Math.max(5, Math.min(300, params.patrolIntervalSec));
      }
      if (typeof params.persona === 'string' && params.persona.trim()) {
        existing.persona = params.persona.trim().slice(0, 1200);
      }
      this.metaAgents.set(id, existing);
    }

    if (resolvedBrainChannel || params.brainModel || params.engineMode) {
      const sample = this.metaAgents.get(targetIds[0])!;
      this.recordMetaAction(
        targetIds[0],
        sample.brainChannel || 'zcode',
        sample.brainSessionName || 'meta-brain-supervisor',
        '切换元智能体的诊断会话配置',
        `诊断会话设为 ${CHANNEL_PROFILES[sample.brainChannel || 'zcode'].label} · ${sample.brainModel} (${
          sample.engineMode === 'local_rules' ? '只用本地规则' : '出事时叫智能体诊断，平时用规则'
        })`,
      );
    } else {
      this.saveMetaAgents();
      this.broadcast('state', this.getState());
    }

    return {
      ok: true,
      metaAgent: this.metaAgents.get(targetIds[0]),
      metaAgents: this.getMetaAgents(),
      logs: this.getMetaAgentLogs(),
    };
  },

  recordMetaAction(this: AgentGatewayHub,
    metaId: MetaAgentId,
    channel: ChannelId,
    sessionName: string,
    action: string,
    detail: string,
    extra?: { brainUsed?: string; brainTraceSessionId?: string; eventKind?: string },
  ) {
    const cfg = this.metaAgents.get(metaId);
    const now = new Date().toISOString();
    if (cfg) {
      cfg.triggersCount = (cfg.triggersCount || 0) + 1;
      cfg.lastTriggeredAt = now;
      cfg.lastAction = `${action}: ${detail}`.slice(0, 140);
      if (extra?.brainTraceSessionId) {
        cfg.lastBrainSessionId = extra.brainTraceSessionId;
      }
      this.metaAgents.set(metaId, cfg);
    }
    const entry: MetaAgentLogEntry = {
      id: `mlog_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      metaId,
      metaName: cfg?.name || metaId,
      channel,
      sessionName,
      action,
      detail,
      brainUsed:
        extra?.brainUsed ||
        (cfg ? `${CHANNEL_PROFILES[cfg.brainChannel || 'zcode']?.label || cfg.brainChannel} · ${cfg.brainModel}` : undefined),
      brainTraceSessionId: extra?.brainTraceSessionId || cfg?.lastBrainSessionId,
      eventKind: extra?.eventKind,
      at: now,
    };
    this.metaAgentLogs.unshift(entry);
    if (this.metaAgentLogs.length > 50) this.metaAgentLogs.pop();
    this.saveMetaAgents();
    this.broadcast('meta_agent_action', entry);
  },

  /** Background patrol: rules only, no model calls; a model is called only for an incident. */
  startMetaPatrolLoop(this: AgentGatewayHub) {
    if (this.patrolTimer) clearInterval(this.patrolTimer);
    this.patrolTimer = setInterval(() => {
      void this.tickMetaPatrol().catch((error) => console.error('[meta-patrol]', error));
    }, 5000);
    if (typeof this.patrolTimer.unref === 'function') {
      this.patrolTimer.unref();
    }
  },

  async tickMetaPatrol(this: AgentGatewayHub) {
    const nowMs = Date.now();
    const resumer = this.metaAgents.get('meta_resumer');
    const intervalMs = Math.max(5, resumer?.patrolIntervalSec || 15) * 1000;
    if (nowMs - this.lastPatrolTickMs < intervalMs) return;
    this.lastPatrolTickMs = nowMs;
    this.patrolTicksCount++;
    const nowIso = new Date(nowMs).toISOString();

    for (const [id, ma] of this.metaAgents.entries()) {
      ma.lastPatrolAt = nowIso;
      if (!ma.runtimeStatus || ma.runtimeStatus === 'patrolling') {
        ma.runtimeStatus = 'standby';
      }
      this.metaAgents.set(id, ma);
    }

    // 1. Watchdog check for stalled active runs (only substantive progress counts, not stderr noise)
    const auditor = this.metaAgents.get('meta_auditor');
    if (auditor?.enabled) {
      for (const [slot, run] of this.activeRuns.entries()) {
        if (run.status !== 'running') continue;
        if (run.sessionName.startsWith('meta-brain')) continue;
        const elapsedSec = Math.round((nowMs - Date.parse(run.startedAt)) / 1000);
        const errTools = run.tools.filter((t) => t.status === 'error');
        if (errTools.length >= (auditor.maxConsecutiveErrors || 3)) {
          const incKey = `loop:${run.runId}:${errTools.length}`;
          if (!this.healedIncidents.has(incKey)) {
            this.healedIncidents.add(incKey);
            this.recordMetaAction(
              'meta_auditor',
              run.channel,
              run.sessionName,
              '看门狗死循环拦截',
              `巡检发现运行 ${run.runId} 连续 ${errTools.length} 次工具报错，触发防死循环督导`,
              { eventKind: 'loop_detected' },
            );
          }
        } else if (elapsedSec > 240 && !run.text && !run.thoughts && run.tools.length === 0) {
          const incKey = `stall:${run.runId}`;
          if (!this.healedIncidents.has(incKey)) {
            this.healedIncidents.add(incKey);
            this.recordMetaAction(
              'meta_auditor',
              run.channel,
              run.sessionName,
              '僵死进程巡检告警',
              `会话 ${run.sessionName} 已逾 ${elapsedSec}s 无实质进展（排除 stderr 噪音），已标记看门狗重点监控`,
              { eventKind: 'stalled_run' },
            );
          }
        }
      }
    }

    // 2. Scan recent sessions (including external WorkBuddy Desktop / AGY / Hermes / ACPX sessions) for anomalies
    if (resumer?.enabled) {
      try {
        const recentWindowMs = 60 * 60 * 1000; // last 60 minutes
        const detected: ExternalSessionAnomaly[] = [];
        // The patrol only looks at the 18 most recent sessions; listing every session (all Antigravity transcripts,
        // the ZCode store, WorkBuddy files) held the event loop ~0.5 s each 15 s tick (profiled 10-18), so the list is
        // reused for a minute. The API still lists fresh.
        if (!this.patrolListCache || nowMs - this.patrolListCache.at > 60_000) {
          const list = this.sessionReader ? await this.sessionReader.refresh() : this.listAcpxSessions();
          this.patrolListCache = { at: nowMs, list: list.slice(0, 18) };
        }
        for (const s of this.patrolListCache.list) {
          if (s.sessionName.startsWith('meta-brain')) continue;
          const slot = this.slotKey(s.channel, s.sessionName);
          if (this.activeRuns.get(slot)?.status === 'running') continue;
          const updMs = s.updatedAt ? Date.parse(s.updatedAt) : 0;
          if (!updMs || nowMs - updMs > recentWindowMs) continue;
          if (s.interrupted || s.lastError) {
            detected.push({
              id: `anom_${s.traceSessionId}`,
              channel: s.channel,
              sessionName: s.sessionName,
              traceSessionId: s.traceSessionId,
              title: s.title || s.sessionName,
              cwd: s.cwd || this.repoRoot,
              updatedAt: s.updatedAt || nowIso,
              toolErrors: 1,
              lastError: s.lastError || '最近一轮异常中断或未产出有效回复',
            });
            continue;
          }
          const contract = await this.readSessionContract(s.traceSessionId);
          if (!contract || contract.turns.length === 0) continue;
          const lastTurn = contract.turns[contract.turns.length - 1];
          const errStep = lastTurn.steps.find((st) => st.kind === 'tool' && st.status === 'error');
          if (lastTurn.status === 'failed' || lastTurn.status === 'aborted' || errStep) {
            const errMsg =
              errStep && errStep.kind === 'tool'
                ? `${errStep.name}: ${(errStep.output || '执行失败').slice(0, 100)}`
                : contract.state.detail || '会话存在未恢复的工具报错';
            detected.push({
              id: `anom_${s.traceSessionId}`,
              channel: s.channel,
              sessionName: s.sessionName,
              traceSessionId: s.traceSessionId,
              title: s.title || s.sessionName,
              cwd: s.cwd || this.repoRoot,
              updatedAt: s.updatedAt || nowIso,
              toolErrors: contract.stats.toolErrors || 1,
              lastError: errMsg,
            });
          }
          if (detected.length >= 5) break;
        }
        this.externalAnomalies = detected;
      } catch (error) { console.error('[meta-patrol] session read failed', error); }
    }

    try {
      this.reconcileDispatches(false);
    } catch {}
  },

  /**
   * Event-driven Meta-Agent Supervisor Brain invocation:
   * - Wakes up the configured `brainChannel` + `brainModel` in a dedicated coordination session (`meta-brain-supervisor`)
   * - Feeds structured incident telemetry, parses JSON verdict (`retry | switch_model | approve | hold`)
   * - Seamlessly falls back to deterministic local rules if brain is busy or in `local_rules` mode.
   */
  async invokeMetaBrainForIncident(this: AgentGatewayHub, params: {
    metaId?: MetaAgentId;
    eventKind: 'execution_failure' | 'quota_or_model_error' | 'loop_detected' | 'manual_patrol';
    targetChannel: string;
    targetSessionName?: string;
    targetTraceId?: string;
    summary: string;
    errorDetail?: string;
    executeDecision?: boolean;
  }) {
    const metaId: MetaAgentId = params.metaId || 'meta_resumer';
    const ma = this.metaAgents.get(metaId) || this.metaAgents.get('meta_resumer')!;
    const targetProf = resolveChannel(params.targetChannel) || CHANNEL_PROFILES.codex;
    const targetSessionName = (params.targetSessionName || '').trim() || `hub-${targetProf.id}`;
    const brainProf = resolveChannel(ma.brainChannel || 'zcode') || CHANNEL_PROFILES.zcode;
    const brainModel =
      ma.brainModel && brainProf.recommendedModels.includes(ma.brainModel)
        ? ma.brainModel
        : brainProf.defaultModel;
    const brainSessionName = (ma.brainSessionName || 'meta-brain-supervisor').trim();
    const brainSlot = this.slotKey(brainProf.id, brainSessionName);

    // Gather target session telemetry
    const targetContract =
      (params.targetTraceId && this.getAcpxSessionAsContract(params.targetTraceId)) ||
      this.getAcpxSessionAsContract(targetSessionName);
    const lastTurn =
      targetContract && targetContract.turns.length > 0
        ? targetContract.turns[targetContract.turns.length - 1]
        : null;
    const lastInput = (lastTurn?.input || '').slice(0, 180);
    const lastErr =
      params.errorDetail ||
      lastTurn?.error ||
      lastTurn?.steps
        ?.filter((s): s is ToolStep => s.kind === 'tool' && s.status === 'error')
        .map((s) => `${s.name}: ${(s.output || '').slice(0, 100)}`)
        .join('; ') ||
      '无报错（常规健康巡检）';

    // Deterministic Fallback check: if engineMode is local_rules or brain slot is already busy
    const existingBrainRun = this.activeRuns.get(brainSlot);
    if (ma.engineMode === 'local_rules' || (existingBrainRun && existingBrainRun.status === 'running')) {
      const fbReason =
        ma.engineMode === 'local_rules'
          ? '当前配置为只用本地规则，不调模型'
          : `元智能体的诊断会话 (${brainProf.label}) 当前正在处理其他案件，这次改用本地规则判断`;
      ma.runtimeStatus = 'fallback';
      this.metaAgents.set(metaId, ma);
      this.recordMetaAction(
        metaId,
        targetProf.id,
        targetSessionName,
        '确定性规则底座兜底',
        `${fbReason} · 目标状态: ${params.summary.slice(0, 70)}`,
        {
          brainUsed: `本地规则底座 (Fallback)`,
          eventKind: params.eventKind,
        },
      );
      ma.runtimeStatus = 'standby';
      this.metaAgents.set(metaId, ma);
      this.broadcast('state', this.getState());
      return {
        ok: true,
        mode: 'local_fallback',
        brainChannel: brainProf.id,
        brainModel,
        brainSessionName,
        decision: { action: 'retry', reason: fbReason },
      };
    }

    // Wake up the real Agent + Model Brain!
    ma.runtimeStatus = 'thinking';
    this.metaAgents.set(metaId, ma);
    this.broadcast('state', this.getState());

    const activeChannelsSummary = Object.values(CHANNEL_PROFILES)
      .map((p) => {
        const fail = this.channelFailures.get(p.id);
        return `${p.label}(模型:${this.selectedModels.get(p.id) || p.defaultModel}${
          fail?.failed ? `, 近期异常:${fail.failed}次` : ', 健康'
        })`;
      })
      .join('；');

    const coordinationPrompt = [
      `【元智能体 · 出事时的诊断】`,
      `人设与职责：${ma.persona || DEFAULT_SUPERVISOR_PERSONA}`,
      `触发督导席位：${ma.name} (${ma.id}) · 事件类型：${params.eventKind}`,
      `目标渠道与会话：${targetProf.label} / ${targetSessionName} (当前模型: ${
        this.selectedModels.get(this.slotKey(targetProf.id, targetSessionName)) || targetProf.defaultModel
      }，可选备选模型: ${targetProf.recommendedModels.join(', ')})`,
      `最近用户指令：${lastInput || '（暂无或刚新建）'}`,
      `事件摘要与现场诊断：${params.summary} | 详细异常：${lastErr}`,
      `七个产品现在的状态：${activeChannelsSummary}`,
      ``,
      `注意：本次为【只读协调裁决运行（coordination_only）】，严禁调用任何修改项目文件的工具，严禁长篇大论。`,
      `请直接用 2~3 句简短清晰的话汇报你的巡检判断，并在末尾紧跟一行 JSON 裁决（不要其他代码块）：`,
      `{"action":"retry|switch_model|approve|standby","targetModel":"若需切换模型填备选模型否则留空","reason":"一句话原因","hint":"若需注入续跑提示词填此处否则留空"}`,
    ].join('\n');

    this.recordMetaAction(
      metaId,
      targetProf.id,
      targetSessionName,
      `唤醒元智能体的诊断会话 (${brainProf.label})`,
      `事件 [${params.eventKind}] 唤醒 ${brainProf.label} · ${brainModel} (会话: ${brainSessionName}) 进行协调裁决`,
      {
        brainUsed: `${brainProf.label} · ${brainModel}`,
        eventKind: params.eventKind,
      },
    );

    const brainRun = this.startRunInternal({
      prof: brainProf,
      sessionName: brainSessionName,
      cwd: this.repoRoot,
      prompt: coordinationPrompt,
      model: brainModel,
      permissions: 'reads',
      source: 'web',
      resumedByMeta: metaId,
    });

    // Attach completion listener to parse the brain's verdict when `brainRun` completes
    const checkDoneTimer = setInterval(() => {
      const live = this.activeRuns.get(brainSlot);
      if (live && live.runId === brainRun.runId && live.status === 'running') return;
      clearInterval(checkDoneTimer);

      const currentMa = this.metaAgents.get(metaId) || ma;
      currentMa.runtimeStatus = 'standby';
      if (brainRun.traceSessionId) {
        currentMa.lastBrainSessionId = brainRun.traceSessionId;
      }
      this.metaAgents.set(metaId, currentMa);

      const outText = String(brainRun.text || '').trim();
      let parsedDecision: { action?: string; targetModel?: string; reason?: string; hint?: string } | null = null;
      const jsonMatch = /\{[\s\S]*?"action"\s*:\s*"[^"]+"[\s\S]*?\}/.exec(outText);
      if (jsonMatch) {
        try {
          parsedDecision = JSON.parse(jsonMatch[0]);
        } catch {}
      }

      if (outText) {
        const cleanSummary = outText
          .replace(/\{[\s\S]*?"action"[\s\S]*?\}/g, '')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 140);
        const actionLabel = parsedDecision?.action ? `裁决: ${parsedDecision.action}` : '巡检完毕';
        this.recordMetaAction(
          metaId,
          targetProf.id,
          targetSessionName,
          `元智能体的诊断会话${actionLabel}`,
          cleanSummary || parsedDecision?.reason || outText.slice(0, 120),
          {
            brainUsed: `${brainProf.label} · ${brainModel}`,
            brainTraceSessionId: brainRun.traceSessionId,
            eventKind: params.eventKind,
          },
        );

        if (params.executeDecision && parsedDecision) {
          if (
            parsedDecision.action === 'switch_model' &&
            parsedDecision.targetModel &&
            targetProf.recommendedModels.includes(parsedDecision.targetModel)
          ) {
            this.setSessionModel({
              channel: targetProf.id,
              sessionName: targetSessionName,
              traceSessionId: params.targetTraceId,
              model: parsedDecision.targetModel,
            });
          }
          if (parsedDecision.action === 'retry' || parsedDecision.action === 'switch_model') {
            this.resumeInterruptedSession({
              channel: targetProf.id,
              sessionName: targetSessionName,
              traceSessionId: params.targetTraceId,
              customHint: parsedDecision.hint || undefined,
            }).catch(() => {});
          }
        }
      } else {
        this.recordMetaAction(
          metaId,
          targetProf.id,
          targetSessionName,
          '诊断超时，改用本地规则',
          `诊断会话 (${brainProf.label} · ${brainModel}) 未返回结构化裁决，已由本地确定性规则底座接管`,
          {
            brainUsed: `本地规则兜底 (${brainProf.label})`,
            brainTraceSessionId: brainRun.traceSessionId,
            eventKind: params.eventKind,
          },
        );
      }
      this.broadcast('state', this.getState());
    }, 700);

    return {
      ok: true,
      mode: 'agent_brain',
      runId: brainRun.runId,
      brainChannel: brainProf.id,
      brainModel,
      brainSessionName,
      brainTraceSessionId: brainRun.traceSessionId || `new:${brainProf.id}:${brainSessionName}`,
    };
  },

  /** Resume an interrupted, disconnected, or errored session (either triggered by user 1-click or `meta_resumer`). */
  async resumeInterruptedSession(this: AgentGatewayHub, params: {
    channel: string;
    sessionName?: string;
    traceSessionId?: string;
    customHint?: string;
  }) {
    const prof = resolveChannel(params.channel) || CHANNEL_PROFILES.codex;
    let sessionName = (params.sessionName || '').trim();
    const tsid = params.traceSessionId;
    if (!sessionName && tsid) {
      const existing = this.listAcpxSessions().find(
        (s) =>
          s.traceSessionId === tsid ||
          s.acpSessionId === tsid.split(':').slice(1).join(':') ||
          `acpx:${s.acpxRecordId}` === tsid,
      );
      if (existing) sessionName = existing.sessionName;
    }
    if (!sessionName) sessionName = `hub-${prof.id}`;

    const contract = tsid
      ? this.getAcpxSessionAsContract(tsid) || this.getAcpxSessionAsContract(sessionName)
      : this.getAcpxSessionAsContract(sessionName);

    let lastInput = '';
    let lastErrorStep = '';
    if (contract && contract.turns.length > 0) {
      const lastTurn = contract.turns[contract.turns.length - 1];
      lastInput = (lastTurn.input || '').slice(0, 240);
      for (const st of lastTurn.steps) {
        if (st.kind === 'tool' && st.status === 'error') {
          lastErrorStep = `${st.name}: ${(st.output || '').slice(0, 140)}`;
        }
      }
    }

    const hint = (params.customHint || '').trim();
    const resumePrompt = hint
      ? hint
      : lastErrorStep
      ? `请从刚才中断或报错的步骤继续执行并完成任务（上一轮报错工具：${lastErrorStep}；现已开启自动读写权限）。`
      : lastInput && !lastInput.startsWith('Error:')
      ? `请从刚才中断的位置继续完成未尽任务（原任务摘要：${lastInput}）。`
      : 'Error: The stream was interrupted. Please continue the task you were working on.';

    this.recordMetaAction(
      'meta_resumer',
      prof.id,
      sessionName,
      '断点续跑注入',
      `自动注入断点上下文并续跑 (${resumePrompt.slice(0, 60)})`,
    );

    return this.sendPrompt({
      channel: prof.id,
      sessionName,
      traceSessionId: tsid,
      prompt: resumePrompt,
      permissions: 'all',
      mode: 'send',
      source: 'web',
      resumedByMeta: 'meta_resumer',
    });
  },
};
