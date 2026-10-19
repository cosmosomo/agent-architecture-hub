/**
 * Between two sessions: dispatches (~/.agent-hub/dispatches/), their receipts, hand-backs, waking the caller, handoff.
 * Mixed into AgentGatewayHub (gateway.ts); `this` is the hub.
 */
import type { FailureKind } from './failure.ts';
import type { AgentGatewayHub } from '../gateway.ts';
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { ChannelId, ActiveRun, DispatchRecord } from './types.ts';
import { CHANNEL_PROFILES, resolveChannel } from './products.ts';
import { BACKGROUND, MAX_DISPATCH_DEPTH } from './common.ts';

export const collabMethods = {
  saveDispatch(this: AgentGatewayHub, d: DispatchRecord, broadcastUpdate = true) {
    d.updatedAt = new Date().toISOString();
    this.dispatches.set(d.id, d);
    try {
      mkdirSync(this.dispatchesDir, { recursive: true });
      const finalPath = join(this.dispatchesDir, `${d.id}.json`);
      const tmpPath = join(this.dispatchesDir, `${d.id}.json.tmp`);
      const content = JSON.stringify(d, null, 2);
      writeFileSync(tmpPath, content, 'utf8');
      try {
        renameSync(tmpPath, finalPath);
      } catch {
        writeFileSync(finalPath, content, 'utf8');
      }
    } catch {}
    if (broadcastUpdate) {
      this.broadcast('dispatch_update', d);
      this.broadcast('state', this.getState());
    }
    this.taskboard.onDispatch(d);
  },

  resolveDispatchWaiters(this: AgentGatewayHub, d: DispatchRecord) {
    const waiters = this.dispatchWaiters.get(d.id);
    if (waiters && waiters.length > 0) {
      this.dispatchWaiters.delete(d.id);
      for (const fn of waiters) {
        try {
          fn(d);
        } catch {}
      }
    }
  },

  loadDispatches(this: AgentGatewayHub) {
    try {
      if (!existsSync(this.dispatchesDir)) return;
      const files = readdirSync(this.dispatchesDir).filter((f) => f.endsWith('.json'));
      const loaded: DispatchRecord[] = [];
      for (const f of files) {
        try {
          const raw = JSON.parse(readFileSync(join(this.dispatchesDir, f), 'utf8')) as DispatchRecord;
          if (raw && raw.id && raw.to?.channel) {
            loaded.push(raw);
          }
        } catch {}
      }
      loaded.sort((a, b) => String(b.receipts?.issuedAt || '').localeCompare(String(a.receipts?.issuedAt || '')));
      for (const d of loaded) {
        this.dispatches.set(d.id, d);
      }
      setTimeout(() => {
        try {
          this.reconcileDispatches(true);
        } catch {}
      }, 1200);
    } catch {}
  },

  extractFilesFromText(this: AgentGatewayHub, text: string): string[] {
    const out = new Set<string>();
    const re = /(?:[A-Za-z]:[\\/][^\s"'`<>|()[\]{}，。；：！？]+|(?:channels|hub|trace)[\\/][^\s"'`<>|()[\]{}，。；：！？]+)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      out.add(m[0].replace(/[.,;:!?)]+$/, ''));
      if (out.size >= 12) break;
    }
    return Array.from(out);
  },

  /**
   * Reconcile in-flight dispatches and pending wakes (runs on `:8899` startup and periodic patrol):
   * - If a target session finished while `:8899` was restarting, harvests its latest turn output (`via: 'recovered'`).
   * - If a running dispatch has no active process and exceeded stall timeout, marks it `stalled` and wakes caller (`wake-stall`).
   * - If a dispatch has `wake.state === 'pending'` (or was interrupted in `'waking'`), resumes waking the caller (`wake-persist`).
   */
  reconcileDispatches(this: AgentGatewayHub, isStartup = false) {
    if (!BACKGROUND) return;
    const nowMs = Date.now();
    const nowIso = new Date(nowMs).toISOString();
    for (const d of this.dispatches.values()) {
      if (isStartup && d.wake.state === 'waking') {
        d.wake.state = 'pending';
        this.saveDispatch(d, false);
      }
      if (d.status === 'running' || d.status === 'issued') {
        const slot = this.slotKey(d.to.channel, d.to.sessionName);
        const liveRun = this.activeRuns.get(slot);
        if (liveRun && liveRun.status === 'running') continue;

        const issuedMs = Date.parse(d.receipts.issuedAt) || 0;
        if (!isStartup && nowMs - issuedMs < 5000) continue;

        // 1. Check recentRuns first
        const matchedRun = this.recentRuns.find(
          (r) =>
            (d.targetRunId && r.runId === d.targetRunId) ||
            (r.channel === d.to.channel &&
              r.sessionName === d.to.sessionName &&
              Date.parse(r.startedAt) >= issuedMs - 2000),
        );
        if (matchedRun && matchedRun.status !== 'running') {
          this.harvestRunIntoDispatch(d, matchedRun.text || '', matchedRun.error, matchedRun.status === 'failed', isStartup ? 'recovered' : 'turn-end', matchedRun.startedAt, matchedRun.traceSessionId, matchedRun.failureKind);
          continue;
        }

        // 2. Check target session's native/acpx transcript on disk
        const contract =
          (d.to.traceSessionId && this.getAcpxSessionAsContract(d.to.traceSessionId)) ||
          this.getAcpxSessionAsContract(d.to.sessionName);
        if (contract && contract.turns.length > 0) {
          const lastTurn = contract.turns[contract.turns.length - 1];
          const turnEndedMs = lastTurn.endedAt ? Date.parse(lastTurn.endedAt) : lastTurn.startedAt ? Date.parse(lastTurn.startedAt) : 0;
          if (lastTurn.output && (turnEndedMs >= issuedMs - 2000 || isStartup)) {
            if (!d.to.traceSessionId && contract.id) d.to.traceSessionId = contract.id;
            this.harvestRunIntoDispatch(
              d,
              lastTurn.output,
              lastTurn.error,
              lastTurn.status === 'failed',
              'recovered',
              lastTurn.startedAt || nowIso,
              contract.id,
            );
            continue;
          }
        }

        // 3. Stall detection (`wake-stall`): if no live run and > 10 minutes elapsed
        if (issuedMs > 0 && nowMs - issuedMs > 10 * 60 * 1000) {
          d.status = 'stalled';
          d.error = '目标会话超过 10 分钟无运行进程且未交回结果 (stalled)';
          d.receipt = 'returned';
          d.receipts.returnedAt = nowIso;
          d.delivery = {
            at: nowIso,
            via: 'recovered',
            summary: d.error,
            reply: '',
            files: [],
          };
          this.saveDispatch(d);
          this.resolveDispatchWaiters(d);
          this.wakeCallerIfNeeded(d);
        }
      } else if (d.wake.mode === 'auto-resume' && d.wake.state === 'pending' && d.from.channel && d.from.sessionName) {
        this.processCallerWakes(d.from.channel, d.from.sessionName).catch(() => {});
      }
    }
  },

  harvestRunIntoDispatch(this: AgentGatewayHub,
    d: DispatchRecord,
    rawText: string,
    rawErr: string | undefined,
    isFailed: boolean,
    fallbackVia: 'turn-end' | 'recovered',
    seenFallbackIso: string,
    traceSessionId?: string,
    failureKind?: FailureKind,
  ) {
    const nowIso = new Date().toISOString();
    if (traceSessionId && !traceSessionId.startsWith('new:')) {
      d.to.traceSessionId = traceSessionId;
    }
    if (!d.receipts.deliveredAt) d.receipts.deliveredAt = seenFallbackIso || nowIso;
    if (!d.receipts.seenAt && (rawText || !isFailed)) d.receipts.seenAt = seenFallbackIso || nowIso;
    if (d.receipt === 'returned' && d.delivery?.via === 'cli') {
      // Target already explicitly called `deliver` via CLI during the turn; just ensure wake & waiters fire
      this.saveDispatch(d);
      this.resolveDispatchWaiters(d);
      this.wakeCallerIfNeeded(d);
      return;
    }

    const text = String(rawText || '').trim();
    const files = this.extractFilesFromText(text);
    const yieldMatch = /【让出[:：]\s*([^】]+)】/.exec(text);
    const deliverMatch = /【交回[:：]?\s*([\s\S]*?)】|【交回】\s*([\s\S]*)$/.exec(text);

    if (yieldMatch) {
      d.status = 'yielded';
      d.waitingFor = yieldMatch[1].trim();
      d.receipt = 'returned';
      d.receipts.returnedAt = nowIso;
      d.delivery = {
        at: nowIso,
        via: 'structured-output',
        summary: `让出等待：${d.waitingFor}`,
        reply: text,
        files,
      };
    } else if (deliverMatch) {
      const extracted = (deliverMatch[1] || deliverMatch[2] || text).trim();
      d.status = isFailed && !text ? 'failed' : 'completed';
      d.waitingFor = undefined;
      d.receipt = 'returned';
      d.receipts.returnedAt = nowIso;
      d.delivery = {
        at: nowIso,
        via: 'structured-output',
        summary: extracted.slice(0, 300) || text.slice(0, 300),
        reply: text,
        files,
      };
    } else {
      // A failed turn is a failed dispatch even when it left text: the text may be the error itself (Claude's
      // "API Error: …", 10-19). Only an explicit hand-back (【交回】 above, or deliver from the CLI) beats a failure.
      d.status = isFailed ? 'failed' : 'completed';
      d.waitingFor = undefined;
      if (isFailed && rawErr) d.error = rawErr;
      if (isFailed) d.failureKind = failureKind;
      d.receipt = 'returned';
      d.receipts.returnedAt = nowIso;
      d.delivery = {
        at: nowIso,
        via: fallbackVia,
        summary: (text || rawErr || '目标轮次已结束').replace(/\s+/g, ' ').slice(0, 300),
        reply: text,
        files,
      };
    }

    this.saveDispatch(d);
    this.resolveDispatchWaiters(d);
    this.wakeCallerIfNeeded(d);
  },

  markRunSeenByDispatch(this: AgentGatewayHub, run: ActiveRun) {
    const nowIso = new Date().toISOString();
    for (const d of this.dispatches.values()) {
      if (d.status !== 'running' && d.status !== 'issued') continue;
      const matchById = d.targetRunId && d.targetRunId === run.runId;
      const matchBySlot = !d.targetRunId && d.to.channel === run.channel && d.to.sessionName === run.sessionName;
      if (!matchById && !matchBySlot) continue;
      let changed = false;
      if (!d.targetRunId) {
        d.targetRunId = run.runId;
        changed = true;
      }
      if (run.traceSessionId && !run.traceSessionId.startsWith('new:') && d.to.traceSessionId !== run.traceSessionId) {
        d.to.traceSessionId = run.traceSessionId;
        changed = true;
      }
      if (!d.receipts.deliveredAt) {
        d.receipts.deliveredAt = run.startedAt || nowIso;
        changed = true;
      }
      if (!d.receipts.seenAt) {
        d.receipts.seenAt = nowIso;
        if (d.receipt === 'issued' || d.receipt === 'delivered') {
          d.receipt = 'seen';
        }
        changed = true;
      }
      if (changed) {
        this.saveDispatch(d);
      }
    }
  },

  onRunFinalizedForDispatches(this: AgentGatewayHub, run: ActiveRun) {
    for (const d of this.dispatches.values()) {
      if (d.status !== 'running' && d.status !== 'issued') continue;
      const matchById = d.targetRunId && d.targetRunId === run.runId;
      const matchBySlot = d.to.channel === run.channel && d.to.sessionName === run.sessionName;
      if (!matchById && !matchBySlot) continue;
      const toolFiles: string[] = [];
      for (const t of run.tools || []) {
        if (t.input) {
          for (const f of this.extractFilesFromText(t.input)) toolFiles.push(f);
        }
      }
      this.harvestRunIntoDispatch(
        d,
        run.text || '',
        run.error,
        run.status === 'failed',
        'turn-end',
        run.startedAt,
        run.traceSessionId,
        run.failureKind,
      );
      if (d.delivery && toolFiles.length > 0) {
        d.delivery.files = Array.from(new Set([...d.delivery.files, ...toolFiles])).slice(0, 15);
        this.saveDispatch(d);
      }
    }

    // If the finished run was itself a caller session that had pending wakes waiting for its turn to end, wake it now!
    this.processCallerWakes(run.channel, run.sessionName).catch(() => {});
  },

  wakeCallerIfNeeded(this: AgentGatewayHub, d: DispatchRecord) {
    if (d.wake.mode !== 'auto-resume') return;
    if (!d.from.channel || !d.from.sessionName) return;
    if (d.wake.state === 'woken' || d.wake.state === 'waking') return;
    d.wake.state = 'pending';
    this.saveDispatch(d);
    this.processCallerWakes(d.from.channel, d.from.sessionName).catch(() => {});
  },

  async processCallerWakes(this: AgentGatewayHub, callerChannel: ChannelId, callerSessionName: string) {
    const callerKey = this.slotKey(callerChannel, callerSessionName);
    if (this.wakingCallers.has(callerKey)) return;
    // Wait until caller's own turn finishes before injecting the wake message (just like agent-hub wake.py)
    const activeCaller = this.activeRuns.get(callerKey);
    if (activeCaller && activeCaller.status === 'running') return;

    const pending = Array.from(this.dispatches.values()).filter(
      (d) =>
        d.from.channel === callerChannel &&
        d.from.sessionName === callerSessionName &&
        d.wake.mode === 'auto-resume' &&
        d.wake.state === 'pending',
    );
    if (pending.length === 0) return;

    this.wakingCallers.add(callerKey);
    try {
      for (const d of pending) {
        d.wake.state = 'waking';
        this.saveDispatch(d, false);
      }
      const lines: string[] = [
        `【跨会话协同回执唤醒 · 共 ${pending.length} 项派活已返回】`,
      ];
      for (const d of pending) {
        const statusLabel =
          d.status === 'completed'
            ? '已完成交回'
            : d.status === 'yielded'
            ? `已让出 (等待: ${d.waitingFor || '外部输入'})`
            : d.status === 'stalled'
            ? '超时停滞 (stalled)'
            : `异常结束 (${d.status})`;
        lines.push(
          `- 派活单 [${d.id}] -> ${d.to.channel}/${d.to.sessionName} (${statusLabel}, 通道: ${d.delivery?.via || 'turn-end'}):`,
        );
        lines.push(`  摘要: ${d.delivery?.summary || d.error || '(无摘要)'}`);
        if (d.delivery?.files?.length) {
          lines.push(`  产物文件: ${d.delivery.files.join(', ')}`);
        }
      }
      lines.push(`请根据上述交回结果继续完成你的后续工作。`);

      const wakeRes = await this.sendPrompt({
        channel: callerChannel,
        sessionName: callerSessionName,
        traceSessionId: pending[0].from.traceSessionId,
        prompt: lines.join('\n'),
        permissions: 'all',
        mode: 'send',
        source: 'cli',
      });
      const nowIso = new Date().toISOString();
      for (const d of pending) {
        d.wake.state = 'woken';
        d.wake.wokenRunId = wakeRes.run?.runId;
        d.wake.wokenAt = nowIso;
        this.saveDispatch(d);
      }
    } catch (err: any) {
      for (const d of pending) {
        d.wake.state = 'wake-failed';
        d.wake.error = err?.message || String(err);
        this.saveDispatch(d);
      }
    } finally {
      this.wakingCallers.delete(callerKey);
    }
  },

  waitForDispatch(this: AgentGatewayHub, id: string, timeoutMs = 120000): Promise<DispatchRecord | null> {
    const cur = this.dispatches.get(id);
    if (!cur) return Promise.resolve(null);
    if (cur.receipt === 'returned' || (cur.status !== 'issued' && cur.status !== 'running')) {
      return Promise.resolve(cur);
    }
    return new Promise((resolvePromise) => {
      const timer = setTimeout(() => {
        const list = this.dispatchWaiters.get(id) || [];
        this.dispatchWaiters.set(
          id,
          list.filter((fn) => fn !== onDone),
        );
        resolvePromise(this.dispatches.get(id) || null);
      }, Math.max(1000, timeoutMs));

      const onDone = (finished: DispatchRecord) => {
        clearTimeout(timer);
        resolvePromise(finished);
      };
      const existing = this.dispatchWaiters.get(id) || [];
      existing.push(onDone);
      this.dispatchWaiters.set(id, existing);
    });
  },

  /**
   * Dispatch a task between two sessions (`spawn-subagent` / `peer-message`), tracking the 4-stage receipt
   * (`issued` -> `delivered` -> `seen` -> `returned`) and optionally waking the caller session upon return.
   */
  async dispatchTask(this: AgentGatewayHub, params: {
    kind?: 'spawn-subagent' | 'peer-message' | 'handoff';
    fromChannel?: string;
    fromSessionName?: string;
    fromTraceId?: string;
    toChannel: string;
    toSessionName?: string;
    toTraceId?: string;
    toModel?: string;
    cwd?: string;
    task: string;
    contextDigest?: string;
    parentDispatchId?: string;
    wakeCaller?: boolean;
    wait?: boolean;
    timeoutMs?: number;
    rawPrompt?: boolean;
  }) {
    const toProf = resolveChannel(params.toChannel);
    if (!toProf) {
      throw new Error(`未知目标渠道: ${params.toChannel}`);
    }
    const task = String(params.task || '').trim();
    if (!task) {
      throw new Error('派活任务内容 (task) 不能为空');
    }

    const fromProf = params.fromChannel ? resolveChannel(params.fromChannel) : null;
    const fromSessionName = fromProf
      ? this.resolveBoundSessionName(fromProf, params.fromSessionName, params.fromTraceId) ||
        (params.fromSessionName || '').trim() ||
        undefined
      : (params.fromSessionName || '').trim() || undefined;

    // Compute delegation depth & prevent infinite delegation loops (borrowing agent-hub delegation.py MAX_DEPTH=3)
    let depth = 1;
    if (params.parentDispatchId && this.dispatches.has(params.parentDispatchId)) {
      depth = (this.dispatches.get(params.parentDispatchId)!.depth || 1) + 1;
    } else if (fromProf && fromSessionName) {
      const activeParent = Array.from(this.dispatches.values()).find(
        (d) => d.status === 'running' && d.to.channel === fromProf.id && d.to.sessionName === fromSessionName,
      );
      if (activeParent) {
        depth = (activeParent.depth || 1) + 1;
      }
    }
    if (depth > MAX_DISPATCH_DEPTH) {
      throw new Error(`派活深度超过上限 (${MAX_DISPATCH_DEPTH})，拒绝继续向下派生以防递归死循环`);
    }

    const stamp = new Date().toISOString().replace(/\D/g, '').slice(8, 14);
    const id = `dsp_${stamp}_${Math.random().toString(36).slice(2, 6)}`;
    const kind = params.kind || 'spawn-subagent';
    const boundToName = this.resolveBoundSessionName(toProf, params.toSessionName, params.toTraceId);
    const toSessionName = boundToName || (params.toSessionName || '').trim() || `sub-${toProf.id}-${stamp}`;
    const resolvedCwd =
      (params.cwd && existsSync(params.cwd) ? resolve(params.cwd) : '') ||
      this.selectedCwds.get(this.slotKey(toProf.id, toSessionName)) ||
      (fromProf && fromSessionName ? this.selectedCwds.get(this.slotKey(fromProf.id, fromSessionName)) : '') ||
      this.repoRoot;
    const toModel =
      params.toModel && toProf.recommendedModels.includes(params.toModel)
        ? params.toModel
        : this.selectedModels.get(this.slotKey(toProf.id, toSessionName)) ||
          this.selectedModels.get(toProf.id) ||
          toProf.defaultModel;

    const nowIso = new Date().toISOString();
    const wakeMode: DispatchRecord['wake']['mode'] =
      params.wakeCaller && fromProf && fromSessionName
        ? 'auto-resume'
        : params.wait
        ? 'wait-poll'
        : 'none';

    const record: DispatchRecord = {
      id,
      kind,
      status: 'issued',
      receipt: 'issued',
      receipts: {
        issuedAt: nowIso,
      },
      from: {
        channel: fromProf?.id,
        sessionName: fromSessionName,
        traceSessionId: params.fromTraceId,
      },
      to: {
        channel: toProf.id,
        sessionName: toSessionName,
        traceSessionId: params.toTraceId,
        model: toModel,
        cwd: resolvedCwd,
      },
      task,
      contextDigest: params.contextDigest ? String(params.contextDigest).trim() : undefined,
      depth,
      parentDispatchId: params.parentDispatchId,
      progressReports: [],
      requests: [],
      wake: {
        mode: wakeMode,
        state: 'none',
      },
      updatedAt: nowIso,
    };

    // Stage 1: issued (persisted before target invocation)
    this.saveDispatch(record);

    const gwToolPath = join(this.repoRoot, 'hub', 'tools', 'agent_gateway.js').replace(/\\/g, '/');
    // Agents' shells often lack node on PATH (ZCode's Git Bash, 2026-10-18), so the command names this node.
    const nodeBin = process.execPath.replace(/\\/g, '/');
    const fromLabel = fromProf ? `${fromProf.label} (${fromSessionName || 'caller'})` : '中心调度方';
    const fullPrompt = params.rawPrompt
      ? task
      : [
          `【跨会话派活单 · ID: ${id} · 类型: ${kind}】`,
          `- 派活来源: ${fromLabel}`,
          `- 目标座席: ${toProf.label} / ${toSessionName}`,
          record.contextDigest ? `- 上下文摘要: ${record.contextDigest}` : '',
          `---`,
          `【任务要求】`,
          task,
          `---`,
          `【回执与交回约定（任选其一，中心亦会在本轮结束时自动兜底采集回复）】`,
          `1. 命令行交回/汇报（若你有终端工具）：`,
          `   - 中途汇报进度（不打断当前轮）："${nodeBin}" "${gwToolPath}" report --id ${id} --text "进度说明"`,
          `   - 完成并交回："${nodeBin}" "${gwToolPath}" deliver --id ${id} --summary "一句话结论"`,
          `   - 阻塞并让出："${nodeBin}" "${gwToolPath}" yield --id ${id} --waiting-for "等待的输入或条件"`,
          `2. 结构化尾注交回（无需调工具）：在回复末尾写一行 \`【交回】一句话结论\` 或 \`【让出：等待什么】\`。`,
          // Unit recall-history: the center reads every session in full, so any agent can look back over its own.
          // Every dispatched agent sees these, whatever folder it works in (10-19: an agent rewrote the blackboard whole).
          `【铁律】共享记录只追加：写黑板只用 "${nodeBin}" "${gwToolPath}" bb add …，不把整个文件读出再写回、不排序去重、不改旧行；署名写你自己（${toProf.id} 或 ${toSessionName}），不冒用别人；不删、不覆盖别人的文件；不打扰用户的会话、窗口、鼠标键盘；不写明文密钥。全文：${join(this.repoRoot, 'AGENTS.md').replace(/\\/g, '/')}`,
          `【回顾这个会话过去的对话】（含已被压缩掉的部分）："${nodeBin}" "${gwToolPath}" recall --agent ${toProf.id} --session ${toSessionName} [--grep 关键词] [--last 5] [--who user|agent|all]`,
        ]
          .filter(Boolean)
          .join('\n');

    try {
      const sendRes = await this.sendPrompt({
        channel: toProf.id,
        sessionName: toSessionName,
        traceSessionId: params.toTraceId,
        cwd: resolvedCwd,
        model: toModel,
        prompt: fullPrompt,
        permissions: 'all',
        mode: 'send',
        source: 'cli',
        wait: false,
      });

      // Stage 2: delivered (target process/queue has accepted the prompt)
      const cur = this.dispatches.get(id) || record;
      if (!cur.receipts.deliveredAt) {
        cur.receipts.deliveredAt = new Date().toISOString();
      }
      if (cur.receipt === 'issued') {
        cur.receipt = 'delivered';
      }
      if (cur.status === 'issued') {
        cur.status = 'running';
      }
      if (sendRes.run?.runId) {
        cur.targetRunId = sendRes.run.runId;
      }
      if (sendRes.run?.traceSessionId && !sendRes.run.traceSessionId.startsWith('new:')) {
        cur.to.traceSessionId = sendRes.run.traceSessionId;
      }
      this.saveDispatch(cur);

      if (params.wait) {
        const finished = await this.waitForDispatch(id, params.timeoutMs || 180000);
        return {
          ok: true,
          dispatch: finished || this.dispatches.get(id) || cur,
        };
      }

      return {
        ok: true,
        dispatch: this.dispatches.get(id) || cur,
      };
    } catch (err: any) {
      record.status = 'failed';
      record.error = err?.message || String(err);
      record.receipt = 'returned';
      record.receipts.returnedAt = new Date().toISOString();
      this.saveDispatch(record);
      throw err;
    }
  },

  /**
   * Handle explicit collaboration actions (`deliver`, `report`, `yield`, `request`, `reclaim`)
   * from either the target session CLI (`agent_gateway.js`) or the web UI.
   */
  async recordCollabEvent(this: AgentGatewayHub, params: {
    id?: string;
    channel?: string;
    sessionName?: string;
    kind: 'deliver' | 'report' | 'yield' | 'request' | 'reclaim';
    summary?: string;
    text?: string;
    reply?: string;
    waitingFor?: string;
    files?: string[];
    via?: 'cli' | 'web';
  }) {
    let d: DispatchRecord | undefined;
    if (params.id) {
      d = this.dispatches.get(params.id);
    }
    if (!d && params.channel && params.sessionName) {
      const ch = resolveChannel(params.channel)?.id || params.channel;
      d = Array.from(this.dispatches.values()).find(
        (x) => (x.status === 'running' || x.status === 'issued' || x.status === 'yielded') && x.to.channel === ch && x.to.sessionName === params.sessionName,
      );
    }
    if (!d) {
      throw new Error(`未找到匹配的派活单: ${params.id || `${params.channel}/${params.sessionName}`}`);
    }

    const nowIso = new Date().toISOString();
    const via = params.via || 'cli';
    const msg = String(params.summary || params.text || params.waitingFor || '').trim();

    if (!d.receipts.deliveredAt) d.receipts.deliveredAt = nowIso;
    if (!d.receipts.seenAt) {
      d.receipts.seenAt = nowIso;
      if (d.receipt === 'issued' || d.receipt === 'delivered') d.receipt = 'seen';
    }

    if (params.kind === 'report') {
      d.progressReports.push({
        at: nowIso,
        text: msg || '执行中进度上报',
        via,
      });
      this.saveDispatch(d);
      return { ok: true, kind: 'report', dispatch: d };
    }

    if (params.kind === 'request') {
      d.requests = d.requests || [];
      d.requests.push({
        at: nowIso,
        text: msg || '请求补充信息或权限',
        status: 'pending',
      });
      d.waitingFor = msg || '等待补充信息';
      this.saveDispatch(d);
      return { ok: true, kind: 'request', dispatch: d };
    }

    if (params.kind === 'yield') {
      d.status = 'yielded';
      d.waitingFor = String(params.waitingFor || msg || '等待上游或外部输入').trim();
      d.receipt = 'returned';
      d.receipts.returnedAt = nowIso;
      d.delivery = {
        at: nowIso,
        via: 'cli',
        summary: `让出等待：${d.waitingFor}`,
        reply: String(params.reply || msg || d.waitingFor),
        files: Array.isArray(params.files) ? params.files : [],
      };
      this.saveDispatch(d);
      this.resolveDispatchWaiters(d);
      this.wakeCallerIfNeeded(d);
      return { ok: true, kind: 'yield', dispatch: d };
    }

    if (params.kind === 'deliver') {
      const files = Array.isArray(params.files) && params.files.length > 0 ? params.files : this.extractFilesFromText(msg + ' ' + (params.reply || ''));
      d.status = 'completed';
      d.waitingFor = undefined;
      d.receipt = 'returned';
      d.receipts.returnedAt = nowIso;
      d.delivery = {
        at: nowIso,
        via: 'cli',
        summary: (msg || params.reply || '已完成并交回').slice(0, 300),
        reply: String(params.reply || msg || ''),
        files,
      };
      this.saveDispatch(d);
      this.resolveDispatchWaiters(d);
      this.wakeCallerIfNeeded(d);
      return { ok: true, kind: 'deliver', dispatch: d };
    }

    if (params.kind === 'reclaim') {
      try {
        await this.cancelRun(d.to.channel, d.to.sessionName);
      } catch {}
      d.status = 'cancelled';
      d.waitingFor = undefined;
      d.error = msg || '派活方主动收回任务 (reclaim)';
      d.receipt = 'returned';
      d.receipts.returnedAt = nowIso;
      d.delivery = {
        at: nowIso,
        via: 'cli',
        summary: d.error,
        reply: '',
        files: [],
      };
      this.saveDispatch(d);
      this.resolveDispatchWaiters(d);
      return { ok: true, kind: 'reclaim', dispatch: d };
    }

    throw new Error(`未知协同动作类型: ${params.kind}`);
  },

  getDispatchesSummary(this: AgentGatewayHub) {
    const all = Array.from(this.dispatches.values()).sort((a, b) =>
      String(b.updatedAt || b.receipts.issuedAt).localeCompare(String(a.updatedAt || a.receipts.issuedAt)),
    );
    const waitingEdges = all
      .filter((d) => d.status === 'running' || d.status === 'issued' || d.status === 'yielded')
      .map((d) => ({
        dispatchId: d.id,
        kind: d.kind,
        fromChannel: d.from.channel || null,
        fromSession: d.from.sessionName || null,
        fromTraceId: d.from.traceSessionId || null,
        toChannel: d.to.channel,
        toSession: d.to.sessionName,
        toTraceId: d.to.traceSessionId || null,
        status: d.status,
        receipt: d.receipt,
        waitingFor:
          d.status === 'yielded'
            ? d.waitingFor || '被派方已让出，等待外部输入'
            : `等待 ${d.to.channel}/${d.to.sessionName} 执行完成`,
        updatedAt: d.updatedAt,
      }));
    return {
      summary: {
        total: all.length,
        running: all.filter((d) => d.status === 'running' || d.status === 'issued').length,
        yielded: all.filter((d) => d.status === 'yielded').length,
        completed: all.filter((d) => d.status === 'completed').length,
        failed: all.filter((d) => d.status === 'failed' || d.status === 'stalled' || d.status === 'cancelled').length,
      },
      waitingEdges,
      dispatches: all.slice(0, 60),
    };
  },

  async getDispatches(this: AgentGatewayHub, params?: {
    id?: string;
    channel?: string;
    sessionName?: string;
    status?: string;
    waitMs?: number;
  }) {
    this.reconcileDispatches(false);
    if (params?.id) {
      if (params.waitMs && params.waitMs > 0) {
        const waited = await this.waitForDispatch(params.id, params.waitMs);
        if (!waited) return { ok: false, error: `未找到派活单: ${params.id}` };
        return { ok: true, dispatch: waited };
      }
      const d = this.dispatches.get(params.id);
      if (!d) return { ok: false, error: `未找到派活单: ${params.id}` };
      return { ok: true, dispatch: d };
    }
    const base = this.getDispatchesSummary();
    let list = base.dispatches;
    if (params?.channel) {
      const ch = resolveChannel(params.channel)?.id || params.channel;
      list = list.filter((d) => d.to.channel === ch || d.from.channel === ch);
    }
    if (params?.sessionName) {
      const sn = params.sessionName.trim();
      list = list.filter((d) => d.to.sessionName === sn || d.from.sessionName === sn);
    }
    if (params?.status) {
      list = list.filter((d) => d.status === params.status);
    }
    return {
      ok: true,
      summary: base.summary,
      waitingEdges: base.waitingEdges,
      dispatches: list,
    };
  },

  sessionDispatchSummary(this: AgentGatewayHub, traceSessionId: string, channel: string, controlName: string) {
    const rawSid = traceSessionId.split(':').pop() || traceSessionId;
    const matchFrom = (d: DispatchRecord) =>
      (d.from.traceSessionId && (d.from.traceSessionId === traceSessionId || d.from.traceSessionId.endsWith(rawSid))) ||
      (d.from.channel === channel && d.from.sessionName === controlName);
    const matchTo = (d: DispatchRecord) =>
      (d.to.traceSessionId && (d.to.traceSessionId === traceSessionId || d.to.traceSessionId.endsWith(rawSid))) ||
      (d.to.channel === channel && d.to.sessionName === controlName);

    const outList: Array<Record<string, any>> = [];
    const inList: Array<Record<string, any>> = [];
    let waitingFor: { kind: 'subagent' | 'external'; target?: string; dispatchId: string; detail: string } | undefined;

    for (const d of this.dispatches.values()) {
      if (matchFrom(d)) {
        outList.push({
          id: d.id,
          kind: d.kind,
          toChannel: d.to.channel,
          toSession: d.to.sessionName,
          toTraceId: d.to.traceSessionId,
          status: d.status,
          receipt: d.receipt,
          receipts: d.receipts,
          summary: d.delivery?.summary || d.waitingFor || d.task.slice(0, 80),
          wakeState: d.wake.state,
          updatedAt: d.updatedAt,
        });
        if (!waitingFor && (d.status === 'running' || d.status === 'issued')) {
          waitingFor = {
            kind: 'subagent',
            target: `${d.to.channel}/${d.to.sessionName}`,
            dispatchId: d.id,
            detail: `等待被派会话 ${d.to.channel}/${d.to.sessionName} 交回 (${d.receipt})`,
          };
        }
      }
      if (matchTo(d)) {
        inList.push({
          id: d.id,
          kind: d.kind,
          fromChannel: d.from.channel,
          fromSession: d.from.sessionName,
          fromTraceId: d.from.traceSessionId,
          status: d.status,
          receipt: d.receipt,
          receipts: d.receipts,
          waitingFor: d.waitingFor,
          progressCount: d.progressReports.length,
          deliveryVia: d.delivery?.via,
          summary: d.delivery?.summary || d.task.slice(0, 80),
          updatedAt: d.updatedAt,
        });
        if (!waitingFor && d.status === 'yielded' && d.waitingFor) {
          waitingFor = {
            kind: 'external',
            target: d.from.sessionName ? `${d.from.channel}/${d.from.sessionName}` : undefined,
            dispatchId: d.id,
            detail: `已让出：等待 ${d.waitingFor}`,
          };
        }
      }
    }
    if (!outList.length && !inList.length && !waitingFor) return null;
    return {
      waitingFor,
      dispatchedOut: outList.length ? outList : undefined,
      dispatchedIn: inList.length ? inList : undefined,
    };
  },

  /** Cross-Channel Session Handoff: Transfer recent context & working directory from one Agent channel to another. */
  async handoffSession(this: AgentGatewayHub, params: {
    fromChannel: string;
    fromSessionName?: string;
    fromTraceId?: string;
    toChannel: string;
    toModel?: string;
    toSessionName?: string;
    customInstruction?: string;
    wait?: boolean;
    timeoutMs?: number;
  }) {
    const fromProf = resolveChannel(params.fromChannel) || CHANNEL_PROFILES.codex;
    const toProf = resolveChannel(params.toChannel);
    if (!toProf) {
      throw new Error(`未知目标接力渠道: ${params.toChannel}`);
    }

    let fromSessionName = (params.fromSessionName || '').trim();
    const fromTsid = params.fromTraceId;
    if (!fromSessionName && fromTsid) {
      const existing = this.listAcpxSessions().find(
        (s) =>
          s.traceSessionId === fromTsid ||
          s.acpSessionId === fromTsid.split(':').slice(1).join(':') ||
          `acpx:${s.acpxRecordId}` === fromTsid,
      );
      if (existing) fromSessionName = existing.sessionName;
    }
    if (!fromSessionName) fromSessionName = `hub-${fromProf.id}`;

    // SessionStore has no get(); its async session() reads a native session (this threw before 2026-10-18).
    const contract =
      (fromTsid ? this.getAcpxSessionAsContract(fromTsid) || (await this.store.session(fromTsid)) : null) ||
      this.getAcpxSessionAsContract(fromSessionName);

    const sourceCwd =
      contract?.cwd ||
      this.selectedCwds.get(this.slotKey(fromProf.id, fromSessionName)) ||
      this.selectedCwds.get(fromProf.id) ||
      this.repoRoot;

    const recentTurns = contract?.turns ? contract.turns.slice(-3) : [];
    const turnDigestLines: string[] = [];
    for (const t of recentTurns) {
      const uIn = (t.input || '').replace(/\s+/g, ' ').slice(0, 260);
      const aOut = (t.output || '').replace(/\s+/g, ' ').slice(0, 320);
      const errs = t.steps
        .filter((s) => s.kind === 'tool' && s.status === 'error')
        .map((s) => (s.kind === 'tool' ? `${s.name}: ${(s.output || '').slice(0, 120)}` : ''))
        .filter(Boolean);
      turnDigestLines.push(
        `- [第 ${t.index} 轮] 用户指令: ${uIn || '(无)'}` +
          (aOut ? `\n  前序回复摘要: ${aOut}` : '') +
          (errs.length ? `\n  遗留报错: ${errs.join(' | ')}` : ''),
      );
    }

    const hhmm = new Date().toTimeString().slice(0, 5).replace(':', '');
    const toSessionName =
      (params.toSessionName || '').trim() || `handoff-${fromProf.id}-to-${toProf.id}-${hhmm}`;
    const toModel =
      params.toModel && toProf.recommendedModels.includes(params.toModel)
        ? params.toModel
        : this.selectedModels.get(toProf.id) || toProf.defaultModel;

    const instruction =
      (params.customInstruction || '').trim() ||
      '请基于上述前序智能体会话的上下文与工作目录，接手并继续完成未尽任务（若前序存在报错请直接定位修复）。';

    const handoffPrompt = [
      `【跨智能体协同接力 (Session Handoff): ${fromProf.label} -> ${toProf.label}】`,
      `- 源会话: ${fromProf.label} (${fromSessionName})`,
      `- 工作目录: ${sourceCwd}`,
      turnDigestLines.length > 0
        ? `- 最近 ${recentTurns.length} 轮上下文摘要:\n${turnDigestLines.join('\n')}`
        : `- 前序会话暂无历史轮次记录`,
      `---`,
      `【接力执行指令】: ${instruction}`,
    ].join('\n');

    this.recordMetaAction(
      'meta_maint',
      toProf.id,
      toSessionName,
      '跨渠道会话接力 (Handoff)',
      `已将 ${fromProf.label} (${fromSessionName}) 的上下文与目录 (${sourceCwd}) 转交至 ${toProf.label} · ${toModel} (${toSessionName})`,
    );

    const stamp = new Date().toISOString().replace(/\D/g, '').slice(8, 14);
    const dispatchId = `dsp_${stamp}_${Math.random().toString(36).slice(2, 6)}`;
    const nowIso = new Date().toISOString();
    const handoffRecord: DispatchRecord = {
      id: dispatchId,
      kind: 'handoff',
      status: 'issued',
      receipt: 'issued',
      receipts: { issuedAt: nowIso },
      from: {
        channel: fromProf.id,
        sessionName: fromSessionName,
        traceSessionId: fromTsid || contract?.id,
      },
      to: {
        channel: toProf.id,
        sessionName: toSessionName,
        model: toModel,
        cwd: sourceCwd,
      },
      task: instruction,
      contextDigest: turnDigestLines.join('\n').slice(0, 600) || undefined,
      depth: 1,
      progressReports: [],
      requests: [],
      wake: { mode: 'none', state: 'none' },
      updatedAt: nowIso,
    };
    this.saveDispatch(handoffRecord);

    const sendRes = await this.sendPrompt({
      channel: toProf.id,
      sessionName: toSessionName,
      cwd: sourceCwd,
      model: toModel,
      prompt: handoffPrompt,
      permissions: 'all',
      mode: 'send',
      source: 'web',
      wait: params.wait,
      timeoutMs: params.timeoutMs,
    });

    const cur = this.dispatches.get(dispatchId) || handoffRecord;
    if (!cur.receipts.deliveredAt) cur.receipts.deliveredAt = new Date().toISOString();
    if (cur.receipt === 'issued') cur.receipt = 'delivered';
    if (cur.status === 'issued') cur.status = 'running';
    if (sendRes.run?.runId) cur.targetRunId = sendRes.run.runId;
    if (sendRes.run?.traceSessionId && !sendRes.run.traceSessionId.startsWith('new:')) {
      cur.to.traceSessionId = sendRes.run.traceSessionId;
    }
    this.saveDispatch(cur);

    return {
      ...sendRes,
      dispatchId,
      dispatch: this.dispatches.get(dispatchId) || cur,
      fromChannel: fromProf.id,
      fromSessionName,
      toChannel: toProf.id,
      toSessionName,
      toModel,
      cwd: sourceCwd,
      traceSessionId: sendRes.run?.traceSessionId || `new:${toProf.id}:${toSessionName}`,
    };
  },
};
