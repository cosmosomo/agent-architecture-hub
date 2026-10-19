/**
 * Sessions the backend lists and drives beside the store: WorkBuddy desktop, Hermes, acpx and driver records, their
 * folders and canonical ids, and which hub session name a page's session maps to.
 * Mixed into AgentGatewayHub (gateway.ts); `this` is the hub.
 */
import type { AgentGatewayHub } from '../gateway.ts';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { Session, SessionSummary, Step, Turn } from '@hub-trace/contract';
import type { ChannelId, ChannelProfile, ActiveRun, AcpxSessionInfo } from './types.ts';
import { CHANNEL_PROFILES, resolveChannel, detectChannelFromCommand } from './products.ts';
import { HOME, WORKSPACE_ROOT, NEW_CWD, isSmokeTestPrompt, classifyTool, stripWorkbuddyUserText } from './common.ts';

export const sessionMethods = {
  /** Parse a single WorkBuddy Desktop `.jsonl` session from `~/.workbuddy/projects/<project>/<id>.jsonl`. */
  parseWorkbuddyJsonlSession(this: AgentGatewayHub,
    sessionId: string,
    jsonlPath: string,
    dbMeta?: { title?: string; cwd?: string; createdAtMs?: number; updatedAtMs?: number },
  ): { info: AcpxSessionInfo; contract: Session } | null {
    try {
      const stat = statSync(jsonlPath);
      const cached = this.wbSummaryCache.get(sessionId);
      const prof = CHANNEL_PROFILES.workbuddy;
      const sessionName = `wb-${sessionId.slice(0, 8)}`;
      const slot = this.slotKey('workbuddy', sessionName);
      const activeModel = prof.defaultModel;
      const isRunning = this.activeRuns.get(slot)?.status === 'running';

      if (cached && cached.mtimeMs === stat.mtimeMs) {
        cached.contract.state.status = isRunning ? 'working' : 'idle';
        return cached;
      }

      const lines = readFileSync(jsonlPath, 'utf8')
        .split(/\r?\n/)
        .filter((l) => l.trim());
      const turns: Turn[] = [];
      let curSteps: Step[] = [];
      let curInput = '';
      let curOutput = '';
      let curStartedAt = '';
      let curEndedAt = '';
      let firstAt = '';
      let lastAt = '';
      let turnIdx = 0;
      let stepSeq = 0;
      let modelCalls = 0;
      let toolCalls = 0;
      let toolErrors = 0;
      let detectedCwd = dbMeta?.cwd || this.repoRoot;
      let reasoningBuf = '';
      let pendingTools: Step[] = [];
      let pendingCallIds: string[] = [];
      const toolStepByCallId = new Map<string, Step>();

      const flushModelAndTools = (text?: string, atIso?: string) => {
        if (!reasoningBuf && !text && !pendingTools.length) return;
        modelCalls++;
        stepSeq++;
        curSteps.push({
          id: `s${stepSeq}`,
          kind: 'model',
          model: activeModel,
          at: atIso || undefined,
          reasoning: reasoningBuf || undefined,
          text: text || undefined,
          phase: pendingTools.length && !text ? 'commentary' : 'final',
          calls: pendingCallIds,
        });
        curSteps.push(...pendingTools);
        reasoningBuf = '';
        pendingTools = [];
        pendingCallIds = [];
      };

      const flushTurn = () => {
        flushModelAndTools();
        if (!curSteps.length) return;
        turnIdx++;
        turns.push({
          id: `t${turnIdx}`,
          index: turnIdx,
          status: 'completed',
          startedAt: curStartedAt || firstAt || new Date(stat.mtimeMs).toISOString(),
          endedAt: curEndedAt || lastAt || new Date(stat.mtimeMs).toISOString(),
          input: curInput || undefined,
          output: curOutput || undefined,
          steps: curSteps,
        });
        curSteps = [];
        curInput = '';
        curOutput = '';
        curStartedAt = '';
        curEndedAt = '';
      };

      for (const line of lines) {
        try {
          const obj = JSON.parse(line);
          const tsNum = Number(obj.timestamp || 0);
          const atIso = tsNum > 0 ? new Date(tsNum).toISOString() : '';
          if (atIso) {
            if (!firstAt) firstAt = atIso;
            lastAt = atIso;
          }
          if (typeof obj.cwd === 'string' && obj.cwd.trim()) {
            detectedCwd = obj.cwd.trim();
          }

          if (obj.type === 'message' && obj.role === 'user') {
            flushTurn();
            curStartedAt = atIso;
            const rawTexts = (Array.isArray(obj.content) ? obj.content : [])
              .map((c: any) => String(c?.text || ''))
              .filter(Boolean)
              .join('\n');
            const cleanText = stripWorkbuddyUserText(rawTexts);
            curInput = cleanText;
            stepSeq++;
            curSteps.push({
              id: `s${stepSeq}`,
              kind: 'message',
              role: 'user',
              text: cleanText,
              at: atIso || undefined,
            });
          } else if (obj.type === 'reasoning') {
            if (pendingTools.length) flushModelAndTools(undefined, atIso);
            const rItems: any[] = Array.isArray(obj.rawContent)
              ? obj.rawContent
              : Array.isArray(obj.content)
              ? obj.content
              : [];
            const rText = rItems
              .map((c: any) => String(c?.text || ''))
              .filter(Boolean)
              .join('\n')
              .trim();
            if (rText) {
              reasoningBuf += (reasoningBuf ? '\n\n' : '') + rText;
            }
          } else if (obj.type === 'function_call') {
            const cid = String(obj.callId || obj.id || `wb_tc_${++stepSeq}`);
            const tName = String(obj.name || 'tool');
            const argStr =
              typeof obj.arguments === 'string'
                ? obj.arguments
                : obj.arguments
                ? JSON.stringify(obj.arguments, null, 2)
                : '';
            const cls = classifyTool(tName, argStr);
            toolCalls++;
            pendingCallIds.push(cid);
            const tStep: Step = {
              id: cid,
              kind: 'tool',
              name: tName,
              family: cls.family,
              callId: cid,
              input: argStr || undefined,
              status: 'ok',
              at: atIso || undefined,
              effects: [],
            };
            pendingTools.push(tStep);
            toolStepByCallId.set(cid, tStep);
          } else if (obj.type === 'function_call_result') {
            const cid = String(obj.callId || '');
            const existing = toolStepByCallId.get(cid);
            const outStr =
              typeof obj.output === 'string'
                ? obj.output
                : obj.output
                ? JSON.stringify(obj.output, null, 2)
                : '';
            const isErr = obj.status === 'error' || obj.status === 'failed';
            if (isErr) toolErrors++;
            if (existing && existing.kind === 'tool') {
              existing.output = outStr || undefined;
              existing.status = isErr ? 'error' : 'ok';
            }
          } else if (obj.type === 'message' && obj.role === 'assistant') {
            curEndedAt = atIso || curEndedAt;
            const outTexts = (Array.isArray(obj.content) ? obj.content : [])
              .map((c: any) => String(c?.text || ''))
              .filter(Boolean)
              .join('\n')
              .trim();
            if (outTexts) {
              curOutput = outTexts;
              flushModelAndTools(outTexts, atIso);
            }
          }
        } catch {}
      }
      flushTurn();

      if (turns.length === 0) return null;

      const createdAtIso =
        firstAt ||
        (dbMeta?.createdAtMs ? new Date(dbMeta.createdAtMs).toISOString() : new Date(stat.birthtimeMs || stat.mtimeMs).toISOString());
      const updatedAtIso =
        lastAt ||
        (dbMeta?.updatedAtMs ? new Date(dbMeta.updatedAtMs).toISOString() : new Date(stat.mtimeMs).toISOString());
      const rawTitle = dbMeta?.title || turns[0]?.input || `WorkBuddy · ${sessionName}`;
      const title = String(rawTitle).replace(/\s+/g, ' ').slice(0, 110);
      const traceSessionId = `workbuddy:${sessionId}`;

      const info: AcpxSessionInfo = {
        acpxRecordId: traceSessionId,
        acpSessionId: sessionId,
        sessionName,
        channel: 'workbuddy',
        channelId: 'workbuddy',
        cwd: detectedCwd,
        title,
        closed: false,
        pid: null,
        createdAt: createdAtIso,
        updatedAt: updatedAtIso,
        turnCount: turns.length,
        traceSessionId,
        currentModel: activeModel,
        availableModels: [...prof.recommendedModels],
      };

      const contract: Session = {
        id: traceSessionId,
        sourceId: sessionId,
        source: {
          kind: 'workbuddy',
          format: 'workbuddy/projects-jsonl',
          adapter: 'workbuddy-desktop@1.0',
          path: jsonlPath,
          size: stat.size,
          mtimeMs: stat.mtimeMs,
        },
        title,
        agent: {
          product: prof.product,
          name: sessionName,
          role: 'main',
          model: activeModel,
          originator: 'workbuddy',
        },
        cwd: detectedCwd,
        startedAt: createdAtIso,
        updatedAt: updatedAtIso,
        links: [],
        turns,
        state: {
          status: isRunning ? 'working' : 'idle',
          detail: `WorkBuddy 桌面会话: ${sessionName}`,
        },
        stats: {
          turns: turns.length,
          modelCalls,
          toolCalls,
          toolErrors,
          messages: turns.length,
          compactions: 0,
          subagents: 0,
          records: lines.length,
          skipped: 0,
        },
        notes: [],
      };

      const entry = { mtimeMs: stat.mtimeMs, info, contract };
      this.wbSummaryCache.set(sessionId, entry);
      return entry;
    } catch {
      return null;
    }
  },

  /** List all WorkBuddy Desktop sessions from `~/.workbuddy/projects/<project>/<id>.jsonl` + `~/.workbuddy/workbuddy.db`. */
  listWorkbuddyDesktopSessions(this: AgentGatewayHub, excludeAcpIds?: Set<string>): AcpxSessionInfo[] {
    if (!excludeAcpIds && this.wbListCache && Date.now() - this.wbListCache.at < 10_000) {
      return this.wbListCache.list;
    }
    const projectsDir = join(this.wbDir, 'projects');
    if (!existsSync(projectsDir)) return [];

    const dbMap = new Map<string, { title?: string; cwd?: string; createdAtMs?: number; updatedAtMs?: number }>();
    const dbPath = join(this.wbDir, 'workbuddy.db');
    if (existsSync(dbPath)) {
      try {
        const db = new DatabaseSync(dbPath, { readOnly: true });
        const rows = db
          .prepare('SELECT id, title, custom_title, cwd, created_at, updated_at FROM sessions WHERE deleted_at IS NULL')
          .all() as any[];
        for (const r of rows) {
          if (r?.id) {
            dbMap.set(String(r.id), {
              title: String(r.custom_title || r.title || '').trim() || undefined,
              cwd: String(r.cwd || '').trim() || undefined,
              createdAtMs: Number(r.created_at || 0) || undefined,
              updatedAtMs: Number(r.updated_at || 0) || undefined,
            });
          }
        }
        db.close();
      } catch {}
    }

    const out: AcpxSessionInfo[] = [];
    try {
      for (const proj of readdirSync(projectsDir, { withFileTypes: true })) {
        if (!proj.isDirectory()) continue;
        const pFull = join(projectsDir, proj.name);
        for (const f of readdirSync(pFull)) {
          if (!f.endsWith('.jsonl') || f.includes('.compact.')) continue;
          const sid = f.replace(/\.jsonl$/, '');
          const parsed = this.parseWorkbuddyJsonlSession(sid, join(pFull, f), dbMap.get(sid));
          if (excludeAcpIds?.has(sid)) continue;
          if (parsed && parsed.info.turnCount > 0) {
            out.push(parsed.info);
          }
        }
      }
    } catch {}
    out.sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
    if (!excludeAcpIds) {
      this.wbListCache = { at: Date.now(), list: out };
    }
    return out;
  },

  /** Load and cache Hermes sessions from `AppData/Local/hermes/state.db` and `profiles/eni/state.db`. */
  loadHermesSessions(this: AgentGatewayHub, force = false): Map<string, { info: AcpxSessionInfo; contract: Session }> {
    if (!force && this.hermesCache && Date.now() - this.hermesCache.at < 15_000) {
      return this.hermesCache.sessions;
    }
    const map = new Map<string, { info: AcpxSessionInfo; contract: Session }>();
    const prof = CHANNEL_PROFILES.hermes;
    const dbPaths = [
      join(this.hermesDir, 'state.db'),
      join(this.hermesDir, 'profiles', 'eni', 'state.db'),
    ].filter((p) => existsSync(p));

    for (const dbPath of dbPaths) {
      try {
        const dbStat = statSync(dbPath);
        const db = new DatabaseSync(dbPath, { readOnly: true });
        const sessRows = db
          .prepare('SELECT * FROM sessions WHERE COALESCE(message_count, 0) > 0 ORDER BY started_at DESC')
          .all() as any[];
        const msgStmt = db.prepare('SELECT * FROM messages WHERE session_id = ? ORDER BY timestamp ASC, id ASC');

        for (const sRow of sessRows) {
          const sid = String(sRow.id || '').trim();
          if (!sid || map.has(sid)) continue;
          const msgs = msgStmt.all(sid) as any[];
          if (!msgs.length) continue;

          let detectedCwd = String(sRow.cwd || '').trim() || this.repoRoot;
          if (!sRow.cwd && typeof sRow.model_config === 'string') {
            try {
              const mc = JSON.parse(sRow.model_config);
              if (typeof mc?.cwd === 'string' && mc.cwd.trim()) detectedCwd = mc.cwd.trim();
            } catch {}
          }

          const turns: Turn[] = [];
          let curSteps: Step[] = [];
          let curInput = '';
          let curOutput = '';
          let curStartedAt = '';
          let curEndedAt = '';
          let turnIdx = 0;
          let stepSeq = 0;
          let modelCalls = 0;
          let toolCalls = 0;
          let toolErrors = 0;
          const toolByCallId = new Map<string, Step>();

          const flushTurn = () => {
            if (!curSteps.length) return;
            turnIdx++;
            turns.push({
              id: `t${turnIdx}`,
              index: turnIdx,
              status: 'completed',
              startedAt: curStartedAt || new Date((Number(sRow.started_at) || Date.now() / 1000) * 1000).toISOString(),
              endedAt: curEndedAt || curStartedAt || new Date((Number(sRow.started_at) || Date.now() / 1000) * 1000).toISOString(),
              input: curInput || undefined,
              output: curOutput || undefined,
              steps: curSteps,
            });
            curSteps = [];
            curInput = '';
            curOutput = '';
            curStartedAt = '';
            curEndedAt = '';
          };

          for (const m of msgs) {
            const role = String(m.role || '');
            const atIso = m.timestamp ? new Date(Number(m.timestamp) * 1000).toISOString() : '';
            const contentStr = String(m.content || '').trim();

            if (role === 'user') {
              flushTurn();
              curStartedAt = atIso;
              curInput = contentStr;
              stepSeq++;
              curSteps.push({
                id: `s${stepSeq}`,
                kind: 'message',
                role: 'user',
                text: contentStr,
                at: atIso || undefined,
              });
            } else if (role === 'assistant') {
              curEndedAt = atIso || curEndedAt;
              const reasoningStr = String(m.reasoning || m.reasoning_content || '').trim();
              if (contentStr) curOutput = contentStr;

              let rawCalls: any[] = [];
              if (typeof m.tool_calls === 'string' && m.tool_calls.trim()) {
                try {
                  const parsed = JSON.parse(m.tool_calls);
                  if (Array.isArray(parsed)) rawCalls = parsed;
                } catch {}
              }

              const callIds: string[] = [];
              const tSteps: Step[] = [];
              for (let i = 0; i < rawCalls.length; i++) {
                const tc = rawCalls[i];
                const cid = String(tc?.call_id || tc?.id || `hm_tc_${stepSeq}_${i + 1}`);
                const fnName = String(tc?.function?.name || tc?.name || 'tool');
                const fnArgs =
                  typeof tc?.function?.arguments === 'string'
                    ? tc.function.arguments
                    : tc?.function?.arguments
                    ? JSON.stringify(tc.function.arguments, null, 2)
                    : '';
                const cls = classifyTool(fnName, fnArgs);
                toolCalls++;
                callIds.push(cid);
                const st: Step = {
                  id: cid,
                  kind: 'tool',
                  name: fnName,
                  family: cls.family,
                  callId: cid,
                  input: fnArgs || undefined,
                  status: 'ok',
                  at: atIso || undefined,
                  effects: [],
                };
                tSteps.push(st);
                toolByCallId.set(cid, st);
              }

              if (reasoningStr || contentStr || tSteps.length) {
                modelCalls++;
                stepSeq++;
                curSteps.push({
                  id: `s${stepSeq}`,
                  kind: 'model',
                  model: prof.defaultModel,
                  at: atIso || undefined,
                  reasoning: reasoningStr || undefined,
                  text: contentStr || undefined,
                  phase: tSteps.length ? 'commentary' : 'final',
                  calls: callIds,
                });
                curSteps.push(...tSteps);
              }
            } else if (role === 'tool') {
              const cid = String(m.tool_call_id || '');
              const target = toolByCallId.get(cid);
              let outText = contentStr;
              let isErr = false;
              if (contentStr.startsWith('{')) {
                try {
                  const p = JSON.parse(contentStr);
                  // The output field when it says something; a failed command often leaves it empty and puts
                  // the reason in error, which then is the result (10-19, display regression: 7 results shown empty).
                  if (typeof p.output === 'string' && p.output.trim()) outText = p.output;
                  else if (p.error) outText = typeof p.error === 'string' ? p.error : JSON.stringify(p.error);
                  if (p.error || (typeof p.exit_code === 'number' && p.exit_code !== 0)) isErr = true;
                } catch {}
              }
              if (isErr) toolErrors++;
              if (target && target.kind === 'tool') {
                target.output = outText || undefined;
                target.status = isErr ? 'error' : 'ok';
              }
            }
          }
          flushTurn();

          if (!turns.length) continue;
          const realTurns = turns.filter((t) => !isSmokeTestPrompt(t.input || ''));
          const finalTurns = (realTurns.length > 0 ? realTurns : turns).map((t, idx) => ({
            ...t,
            id: `t${idx + 1}`,
            index: idx + 1,
          }));

          const sessionName = `hermes-${sid.slice(0, 8)}`;
          const startedIso = sRow.started_at
            ? new Date(Number(sRow.started_at) * 1000).toISOString()
            : finalTurns[0]?.startedAt || new Date(dbStat.mtimeMs).toISOString();
          const updatedIso = sRow.last_activity_at
            ? new Date(Number(sRow.last_activity_at) * 1000).toISOString()
            : finalTurns[finalTurns.length - 1]?.endedAt || startedIso;
          const title = String(sRow.title || finalTurns[0]?.input || `Hermes · ${sessionName}`)
            .replace(/\s+/g, ' ')
            .slice(0, 110);
          const traceSessionId = `hermes:${sid}`;

          const info: AcpxSessionInfo = {
            acpxRecordId: traceSessionId,
            acpSessionId: sid,
            sessionName,
            channel: 'hermes',
            channelId: 'hermes',
            cwd: detectedCwd,
            title,
            closed: false,
            pid: null,
            createdAt: startedIso,
            updatedAt: updatedIso,
            turnCount: finalTurns.length,
            traceSessionId,
            currentModel: prof.defaultModel,
            availableModels: [...prof.recommendedModels],
          };

          const contract: Session = {
            id: traceSessionId,
            sourceId: sid,
            source: {
              kind: 'hermes',
              format: 'hermes/state-sqlite',
              adapter: 'hermes-acp@0.21.1',
              path: dbPath,
              size: dbStat.size,
              mtimeMs: dbStat.mtimeMs,
            },
            title,
            agent: {
              product: prof.product,
              name: sessionName,
              role: 'main',
              model: prof.defaultModel,
              originator: 'hermes',
            },
            cwd: detectedCwd,
            startedAt: startedIso,
            updatedAt: updatedIso,
            links: [],
            turns: finalTurns,
            state: {
              status: 'idle',
              detail: `Hermes 会话 (${sRow.source || 'cli'}): ${sessionName}`,
            },
            stats: {
              turns: finalTurns.length,
              modelCalls,
              toolCalls,
              toolErrors,
              messages: finalTurns.length,
              compactions: 0,
              subagents: 0,
              records: msgs.length,
              skipped: 0,
            },
            notes: [],
          };

          map.set(sid, { info, contract });
        }
        db.close();
      } catch {}
    }

    this.hermesCache = { at: Date.now(), sessions: map };
    return map;
  },

  /** The folder an existing session was created in. acpx finds a named session by its folder. */
  existingSessionCwd(this: AgentGatewayHub, prof: ChannelProfile, sessionName: string): string | undefined {
    const hit = this.listAcpxSessions()
      .filter((s) => s.channel === prof.id && s.sessionName === sessionName && s.cwd)
      .sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')))[0];
    return hit?.cwd && existsSync(hit.cwd) ? hit.cwd : undefined;
  },

  /**
   * Where a session runs. A real folder the user picked wins. Otherwise an existing session keeps its own
   * folder (even if a page sends NEW_CWD out of date), and a new session gets a new empty folder.
   */
  resolveSessionCwd(this: AgentGatewayHub, prof: ChannelProfile, sessionName: string, requested?: string): string {
    const want = String(requested || '').trim();
    if (want && want !== NEW_CWD && existsSync(want)) return resolve(want);
    const own = this.selectedCwds.get(this.slotKey(prof.id, sessionName)) || this.existingSessionCwd(prof, sessionName);
    if (own && own !== NEW_CWD && existsSync(own)) return own;
    const safeName = sessionName.replace(/[^\w.-]+/g, '-').slice(0, 40) || prof.id;
    const stamp = new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
    const dir = join(WORKSPACE_ROOT, `${prof.id}-${safeName}-${stamp}`);
    mkdirSync(dir, { recursive: true });
    return dir;
  },

  /** Explicitly register a brand-new session slot for a channel so UI + Backend stay in sync immediately. */
  createNewSession(this: AgentGatewayHub, params: { channel: string; sessionName?: string; cwd?: string; model?: string }) {
    const prof = resolveChannel(params.channel) || CHANNEL_PROFILES.codex;
    const now = new Date();
    const hhmmss = now.toTimeString().slice(0, 8).replace(/:/g, '');
    const sessionName = (params.sessionName || '').trim() || `${prof.id}-${hhmmss}`;
    const slot = this.slotKey(prof.id, sessionName);
    // A new session defaults to a new folder; picking a folder for one session no longer changes the
    // channel-wide default for the next one.
    const cwd = this.resolveSessionCwd(prof, sessionName, params.cwd);
    this.selectedCwds.set(slot, cwd);
    const traceSessionId = `new:${prof.id}:${sessionName}`;
    const isoNow = now.toISOString();
    const rawCandidate =
      (params.model || '').trim() ||
      this.selectedModels.get(slot) ||
      this.selectedModels.get(prof.id) ||
      prof.defaultModel;
    const chosenModel = prof.recommendedModels.includes(rawCandidate) ? rawCandidate : prof.defaultModel;
    this.selectedModels.set(slot, chosenModel);
    const info: AcpxSessionInfo = {
      acpxRecordId: `new-${prof.id}-${sessionName}`,
      acpSessionId: '',
      sessionName,
      channel: prof.id,
      channelId: prof.id,
      cwd,
      title: `新会话 · ${prof.label} (${sessionName})`,
      closed: false,
      pid: null,
      createdAt: isoNow,
      updatedAt: isoNow,
      turnCount: 0,
      traceSessionId,
      currentModel: chosenModel,
      availableModels: [...prof.recommendedModels],
      isDraft: true,
    };
    this.draftSessions.set(slot, info);
    this.broadcast('state', this.getState());
    return {
      ok: true,
      channel: prof.id,
      channelId: prof.id,
      sessionName,
      traceSessionId,
      currentModel: chosenModel,
      cwd,
      session: this.getAcpxSessionAsContract(traceSessionId),
    };
  },

  /** Resolve a ZCode ACP lazy placeholder UUID to its backend `sess_<uuid>` via `~/.zcode/v2/acp-lazy-sessions.json`. */
  resolveZcodeLazySid(this: AgentGatewayHub, acpId: string): string {
    if (!acpId || acpId.startsWith('sess_')) return acpId;
    const lazyPath = join(HOME, '.zcode', 'v2', 'acp-lazy-sessions.json');
    try {
      const st = statSync(lazyPath);
      if (!this.zcodeLazyCache || this.zcodeLazyCache.mtimeMs !== st.mtimeMs) {
        this.zcodeLazyCache = { mtimeMs: st.mtimeMs, map: JSON.parse(readFileSync(lazyPath, 'utf8')) };
      }
      const mapped = this.zcodeLazyCache.map?.[acpId]?.zcodeSid;
      if (mapped) return mapped;
    } catch {}
    return `sess_${acpId}`;
  },

  /** Canonical unified session ID (`<readKind>:<nativeId>`) shared by both Read and Control paths. */
  canonicalSessionId(this: AgentGatewayHub, channel: ChannelId, acpId: string, recId?: string): string {
    const prof = CHANNEL_PROFILES[channel] || CHANNEL_PROFILES.codex;
    const cleanAcp = String(acpId || '').trim();
    if (!cleanAcp) return recId ? `acpx:${recId}` : `${prof.traceKind}:unknown`;
    const nativeId = channel === 'zcode' ? this.resolveZcodeLazySid(cleanAcp) : cleanAcp;
    return `${prof.traceKind}:${nativeId}`;
  },

  /** Read all `~/.acpx/sessions/*.json` records + Antigravity Brain + WorkBuddy Desktop + Hermes SQLite sessions. */
  listAcpxSessions(this: AgentGatewayHub): AcpxSessionInfo[] {
    const out: AcpxSessionInfo[] = [];
    const seenSlots = new Set<string>();
    const seenAcpIds = new Set<string>();
    const byTraceId = new Map<string, number>();

    // 1. Antigravity Brain sessions
    for (const agyInfo of this.listAntigravitySessions()) {
      const slot = this.slotKey('antigravity', agyInfo.sessionName);
      seenSlots.add(slot);
      this.draftSessions.delete(slot);
      byTraceId.set(agyInfo.traceSessionId, out.length);
      out.push(agyInfo);
    }

    // Warm WorkBuddy native JSONL cache first so acpx WorkBuddy records inherit full native turns & cwd.
    const wbDesktopList = this.listWorkbuddyDesktopSessions();

    // 2. ~/.acpx/sessions/*.json records (unified to canonical <traceKind>:<nativeId>)
    if (existsSync(this.acpxDir)) {
      for (const f of readdirSync(this.acpxDir)) {
        if (!f.endsWith('.json')) continue;
        try {
          const fullJsonPath = join(this.acpxDir, f);
          const fStat = statSync(fullJsonPath);
          let cachedJson = this.acpxJsonCache.get(fullJsonPath);
          if (!cachedJson || cachedJson.mtimeMs !== fStat.mtimeMs) {
            cachedJson = { mtimeMs: fStat.mtimeMs, raw: JSON.parse(readFileSync(fullJsonPath, 'utf8')) };
            this.acpxJsonCache.set(fullJsonPath, cachedJson);
          }
          const raw = cachedJson.raw;
          if (!raw || raw.schema !== 'acpx.session.v1') continue;
          const channel = detectChannelFromCommand(raw.agent_command || '');
          const prof = CHANNEL_PROFILES[channel];
          const acpId = String(raw.acp_session_id || '');
          if (acpId) seenAcpIds.add(acpId);
          const recId = String(raw.acpx_record_id || f.replace(/\.json$/, ''));
          const sessionName = String(raw.name || `gw-${channel}`);

          const msgs: any[] = Array.isArray(raw.messages) ? raw.messages : [];
          const realUserPrompts: string[] = [];
          let totalUserTurns = 0;
          for (const m of msgs) {
            if (m?.User) {
              totalUserTurns++;
              const texts = (Array.isArray(m.User.content) ? m.User.content : [])
                .map((c: any) => c?.Text || '')
                .filter(Boolean)
                .join('\n')
                .trim();
              if (texts && !isSmokeTestPrompt(texts)) {
                realUserPrompts.push(texts);
              }
            }
          }

          // Skip pure CLI connectivity smoke-test sessions that have no real user messages
          if (totalUserTurns > 0 && realUserPrompts.length === 0 && /^poc(-|$)/i.test(sessionName)) {
            continue;
          }

          const firstText = (realUserPrompts[0] || raw.title || '').slice(0, 90);
          const traceSessionId = this.canonicalSessionId(channel, acpId, recId);

          const slot = this.slotKey(channel, sessionName);
          seenSlots.add(slot);
          this.draftSessions.delete(slot);

          let rawModel =
            this.selectedModels.get(slot) ||
            (typeof raw.acpx?.current_model_id === 'string' && raw.acpx.current_model_id.trim()) ||
            this.selectedModels.get(channel) ||
            prof.defaultModel;

          // Strictly heal any unverified model (e.g. WorkBuddy space-bunny -> custom-local:glm-5.3)
          if (!prof.recommendedModels.includes(rawModel)) {
            rawModel = prof.defaultModel;
            if (channel === 'workbuddy' && raw.acpx && raw.acpx.current_model_id !== rawModel) {
              try {
                raw.acpx.current_model_id = rawModel;
                writeFileSync(fullJsonPath, JSON.stringify(raw, null, 2), 'utf8');
              } catch {}
            }
          }
          const availableModels = [...prof.recommendedModels];

          const wbNative = channel === 'workbuddy' && acpId ? this.wbSummaryCache.get(acpId) : undefined;
          if (wbNative) {
            wbNative.info.sessionName = sessionName;
            wbNative.contract.agent.name = sessionName;
          }

          const item: AcpxSessionInfo = {
            acpxRecordId: recId,
            acpSessionId: channel === 'zcode' && acpId ? this.resolveZcodeLazySid(acpId) : acpId,
            sessionName,
            channel,
            channelId: channel,
            cwd: raw.cwd || wbNative?.info.cwd || this.repoRoot,
            title: firstText || wbNative?.info.title || `${prof.label} 会话 (${sessionName})`,
            closed: Boolean(raw.closed),
            pid: raw.pid ?? null,
            createdAt: raw.created_at || wbNative?.info.createdAt,
            updatedAt: raw.last_used_at || raw.updated_at || raw.created_at || wbNative?.info.updatedAt,
            turnCount: Math.max(realUserPrompts.length || totalUserTurns, wbNative?.info.turnCount || 0),
            traceSessionId,
            currentModel: rawModel,
            availableModels,
            fromAcpxStore: true,
          };

          const prevIdx = byTraceId.get(traceSessionId);
          if (prevIdx !== undefined) {
            if (String(item.updatedAt || '') >= String(out[prevIdx].updatedAt || '')) {
              out[prevIdx] = item;
            }
          } else {
            byTraceId.set(traceSessionId, out.length);
            out.push(item);
          }
        } catch {
          // Ignore malformed session files
        }
      }
    }

    // 3. WorkBuddy Desktop sessions (~/.workbuddy/projects/*/*.jsonl)
    for (const wbInfo of wbDesktopList) {
      if (seenAcpIds.has(wbInfo.acpSessionId) || byTraceId.has(wbInfo.traceSessionId)) continue;
      const slot = this.slotKey('workbuddy', wbInfo.sessionName);
      if (!seenSlots.has(slot)) {
        seenSlots.add(slot);
        byTraceId.set(wbInfo.traceSessionId, out.length);
        out.push(wbInfo);
      }
    }

    // 4. Hermes SQLite sessions (AppData/Local/hermes/state.db)
    for (const [sid, entry] of this.loadHermesSessions().entries()) {
      if (seenAcpIds.has(sid) || byTraceId.has(entry.info.traceSessionId)) continue;
      const slot = this.slotKey('hermes', entry.info.sessionName);
      if (!seenSlots.has(slot)) {
        seenSlots.add(slot);
        byTraceId.set(entry.info.traceSessionId, out.length);
        out.push(entry.info);
      }
    }

    // 5. Draft sessions
    for (const [slot, draft] of this.draftSessions.entries()) {
      if (!seenSlots.has(slot)) {
        const chosen = this.selectedModels.get(slot) || draft.currentModel;
        out.push(chosen ? { ...draft, currentModel: chosen } : draft);
      }
    }

    out.sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
    return out;
  },

  /** Synthesize a `@hub-trace/contract` Session from Antigravity Brain, WorkBuddy Desktop, Hermes SQLite, `~/.acpx/sessions/<id>.json`, or `new:<channel>:<name>`. */
  getAcpxSessionAsContract(this: AgentGatewayHub, idOrRecordId: string): Session | null {
    // 1. Antigravity Brain session
    if (
      idOrRecordId.startsWith('antigravity:') ||
      idOrRecordId.startsWith('agy:') ||
      existsSync(join(this.agyBrainDir, idOrRecordId, '.system_generated', 'logs', 'transcript.jsonl'))
    ) {
      const cid = idOrRecordId.replace(/^(antigravity|agy):/, '');
      const transcriptPath = join(this.agyBrainDir, cid, '.system_generated', 'logs', 'transcript.jsonl');
      if (existsSync(transcriptPath)) {
        const nameMap = this.loadAgySessionMap();
        const reverseNameMap = new Map<string, string>();
        for (const [sName, mappedCid] of Object.entries(nameMap)) {
          if (mappedCid) reverseNameMap.set(mappedCid, sName);
        }
        const parsed = this.parseAntigravityBrain(cid, transcriptPath, reverseNameMap);
        if (parsed) return parsed.contract;
      } else if (existsSync(join(this.agyBrainDir, cid))) {
        const docsOnly = this.parseAntigravityArtifactsOnly(cid, new Map());
        if (docsOnly) return docsOnly.contract;
      }
    }

    // 2. WorkBuddy Desktop session (workbuddy:<uuid>) — falls through to .acpx/sessions if native JSONL has 0 turns
    if (idOrRecordId.startsWith('workbuddy:')) {
      const sid = idOrRecordId.slice('workbuddy:'.length);
      let cached = this.wbSummaryCache.get(sid);
      if (!cached) {
        this.listWorkbuddyDesktopSessions();
        cached = this.wbSummaryCache.get(sid);
      }
      if (cached && cached.contract.turns.length > 0) return cached.contract;
    }

    // 3. Hermes SQLite session (hermes:<id>) — falls through to .acpx/sessions if not in state.db
    if (idOrRecordId.startsWith('hermes:')) {
      const sid = idOrRecordId.slice('hermes:'.length);
      const map = this.loadHermesSessions();
      const found = map.get(sid) || this.loadHermesSessions(true).get(sid);
      if (found && found.contract.turns.length > 0) return found.contract;
    }

    if (idOrRecordId.startsWith('new:')) {
      const parts = idOrRecordId.split(':');
      const chRaw = parts[1] || 'codex';
      const sName = parts.slice(2).join(':') || `${chRaw}-new`;
      const prof = resolveChannel(chRaw) || CHANNEL_PROFILES.codex;
      if (prof.id === 'antigravity') {
        const agyMap = this.loadAgySessionMap();
        const mappedCid = agyMap[sName];
        if (mappedCid) {
          const agySess = this.getAcpxSessionAsContract(`antigravity:${mappedCid}`);
          if (agySess && agySess.turns.length > 0) return agySess;
        }
      }
      if (existsSync(this.acpxDir)) {
        for (const f of readdirSync(this.acpxDir)) {
          if (!f.endsWith('.json')) continue;
          try {
            const r = JSON.parse(readFileSync(join(this.acpxDir, f), 'utf8'));
            if (r.name === sName && Array.isArray(r.messages) && r.messages.length > 0) {
              return this.getAcpxSessionAsContract(r.acpx_record_id || f.replace(/\.json$/, ''));
            }
          } catch {}
        }
      }
      const slot = this.slotKey(prof.id, sName);
      const draft = this.draftSessions.get(slot);
      const now = draft?.createdAt || new Date().toISOString();
      const isRunning = this.activeRuns.get(slot)?.status === 'running';
      const rawCand =
        this.selectedModels.get(slot) ||
        draft?.currentModel ||
        this.selectedModels.get(prof.id) ||
        prof.defaultModel;
      const activeModel = prof.recommendedModels.includes(rawCand) ? rawCand : prof.defaultModel;
      return {
        id: idOrRecordId,
        sourceId: sName,
        source: {
          kind: prof.traceKind,
          format: prof.id === 'antigravity' ? 'antigravity/transcript-jsonl' : 'acpx/session-v1',
          adapter: prof.id === 'antigravity' ? 'antigravity-ls@1.0' : 'acpx@0.19.5',
          path: join(this.acpxDir, `${sName}.json`),
          size: 0,
          mtimeMs: Date.now(),
        },
        title: `新会话 · ${prof.label} (${sName})`,
        agent: {
          product: prof.product,
          name: sName,
          role: 'main',
          model: activeModel,
          originator: prof.id,
        },
        cwd: draft?.cwd || this.repoRoot,
        startedAt: now,
        updatedAt: now,
        links: [],
        turns: [],
        state: {
          status: isRunning ? 'working' : 'idle',
          detail: `新建会话槽: ${sName}`,
        },
        stats: {
          turns: 0,
          modelCalls: 0,
          toolCalls: 0,
          toolErrors: 0,
          messages: 0,
          compactions: 0,
          subagents: 0,
          records: 0,
          skipped: 0,
        },
        notes: [],
      };
    }

    if (!existsSync(this.acpxDir)) return null;
    const cleanId = idOrRecordId.startsWith('acpx:')
      ? idOrRecordId.slice(5)
      : idOrRecordId.includes(':')
      ? idOrRecordId.split(':').slice(1).join(':')
      : idOrRecordId;
    let targetFile = join(this.acpxDir, `${cleanId}.json`);
    if (!existsSync(targetFile)) {
      for (const f of readdirSync(this.acpxDir)) {
        if (!f.endsWith('.json')) continue;
        try {
          const r = JSON.parse(readFileSync(join(this.acpxDir, f), 'utf8'));
          const rCh = detectChannelFromCommand(r.agent_command || '');
          const rRecId = String(r.acpx_record_id || f.replace(/\.json$/, ''));
          const rCanon = this.canonicalSessionId(rCh, String(r.acp_session_id || ''), rRecId);
          if (
            rCanon === idOrRecordId ||
            r.name === cleanId ||
            r.acp_session_id === cleanId ||
            r.acpx_record_id === cleanId
          ) {
            targetFile = join(this.acpxDir, f);
            break;
          }
        } catch {}
      }
    }
    if (!existsSync(targetFile)) return null;

    try {
      const raw = JSON.parse(readFileSync(targetFile, 'utf8'));
      const stat = statSync(targetFile);
      const channel = detectChannelFromCommand(raw.agent_command || '');
      const prof = CHANNEL_PROFILES[channel];
      const recId = String(raw.acpx_record_id || cleanId);
      const msgs: any[] = Array.isArray(raw.messages) ? raw.messages : [];
      const turns: Turn[] = [];
      let curSteps: Step[] = [];
      let curInput = '';
      let curOutput = '';
      let turnIdx = 0;
      let modelCalls = 0;
      let toolCalls = 0;
      let toolErrors = 0;
      let messageCount = 0;

      let streamTail = '';
      let streamRefusalError = '';
      const streamPath = raw.event_log?.active_path || targetFile.replace(/\.json$/, '.stream.ndjson');
      if (streamPath && existsSync(streamPath)) {
        try {
          const stStat = statSync(streamPath);
          if (stStat.size <= 512 * 1024) {
            streamTail = readFileSync(streamPath, 'utf8');
            for (const sLine of streamTail.split(/\r?\n/)) {
              if (!sLine.includes('"stopReason"') && !sLine.includes('"error"')) continue;
              try {
                const sObj = JSON.parse(sLine);
                const errMeta = sObj?.result?._meta?.['codebuddy.ai/errorMessage'];
                if (sObj?.result?.stopReason === 'refusal' || errMeta) {
                  streamRefusalError = String(errMeta || '模型拒绝响应或需客户端 OAuth 鉴权 (stopReason: refusal)');
                } else if (sObj?.error?.message) {
                  streamRefusalError = String(sObj.error.message);
                }
              } catch {}
            }
          }
        } catch {}
      }

      const slot = this.slotKey(channel, raw.name || `gw-${channel}`);
      const isRunning = this.activeRuns.get(slot)?.status === 'running';
      const rawCandModel =
        this.selectedModels.get(slot) ||
        (typeof raw.acpx?.current_model_id === 'string' && raw.acpx.current_model_id.trim()) ||
        this.selectedModels.get(channel) ||
        prof.defaultModel;
      const activeModel = prof.recommendedModels.includes(rawCandModel) ? rawCandModel : prof.defaultModel;

      let stepSeq = 0;
      const flushTurn = () => {
        if (!curSteps.length) return;
        turnIdx++;
        const hasAgentResponse = curSteps.some((s) => s.kind === 'model' || s.kind === 'tool');
        let turnStatus: Turn['status'] = 'completed';
        if (!hasAgentResponse && !isRunning) {
          turnStatus = 'failed';
          stepSeq++;
          const diagMsg =
            streamRefusalError ||
            `⚠️ 该轮未收到模型响应（原请求模型不可用或鉴权被拒，现已自动锁定可用模型 ${prof.defaultModel}）。`;
          curSteps.push({
            id: `s${stepSeq}`,
            kind: 'model',
            model: activeModel,
            text: diagMsg,
            phase: 'final',
            calls: [],
          });
          curOutput = diagMsg;
        }
        turns.push({
          id: `t${turnIdx}`,
          index: turnIdx,
          status: turnStatus,
          ...(turnStatus === 'failed' ? { error: curOutput || streamRefusalError || '渠道/模型调用异常' } : {}),
          startedAt: raw.created_at,
          endedAt: raw.last_used_at || raw.updated_at,
          input: curInput || undefined,
          output: curOutput || undefined,
          steps: curSteps,
        });
        curSteps = [];
        curInput = '';
        curOutput = '';
      };

      for (const m of msgs) {
        if (m?.User) {
          flushTurn();
          const texts = (Array.isArray(m.User.content) ? m.User.content : [])
            .map((c: any) => c?.Text || '')
            .filter(Boolean)
            .join('\n');
          curInput = texts;
          messageCount++;
          stepSeq++;
          curSteps.push({
            id: `s${stepSeq}`,
            kind: 'message',
            role: 'user',
            text: texts,
            at: raw.last_prompt_at || raw.created_at,
          });
        } else if (m?.Agent) {
          const contents: any[] = Array.isArray(m.Agent.content) ? m.Agent.content : [];
          const toolResults: Record<string, any> = m.Agent.tool_results || {};
          let reasoningBuf = '';
          let textBuf = '';
          let callIds: string[] = [];
          let pendingToolSteps: Step[] = [];

          const flushModelSegment = () => {
            if (!reasoningBuf && !textBuf && !pendingToolSteps.length) return;
            modelCalls++;
            stepSeq++;
            curSteps.push({
              id: `s${stepSeq}`,
              kind: 'model',
              model: activeModel,
              reasoning: reasoningBuf || undefined,
              text: textBuf || undefined,
              phase: pendingToolSteps.length ? 'commentary' : 'final',
              calls: callIds,
            });
            curSteps.push(...pendingToolSteps);
            reasoningBuf = '';
            textBuf = '';
            callIds = [];
            pendingToolSteps = [];
          };

          for (const item of contents) {
            if (item?.Thinking?.text) {
              if (pendingToolSteps.length) flushModelSegment();
              const t = String(item.Thinking.text).replace(/^Thinking…\s*/i, '').trim();
              if (t) reasoningBuf += (reasoningBuf ? '\n\n' : '') + t;
            } else if (typeof item?.Text === 'string' && item.Text.trim()) {
              if (pendingToolSteps.length) flushModelSegment();
              textBuf += (textBuf ? '\n\n' : '') + item.Text;
              curOutput = item.Text;
            } else if (item?.ToolUse) {
              const tu = item.ToolUse;
              const tid = String(tu.id || `tool_${++stepSeq}`);
              const tr = toolResults[tid];
              const inputStr =
                typeof tu.raw_input === 'string' && tu.raw_input
                  ? tu.raw_input
                  : tu.input
                  ? JSON.stringify(tu.input, null, 2)
                  : '';
              let outStr =
                typeof tr?.output === 'string'
                  ? tr.output
                  : typeof tr?.content?.Text === 'string'
                  ? tr.content.Text
                  : tr?.content
                  ? JSON.stringify(tr.content, null, 2)
                  : '';
              let isErr = Boolean(tr?.is_error);
              if (
                !isErr &&
                !outStr &&
                streamTail &&
                streamTail.includes(tid) &&
                (streamTail.includes('"PERMISSION_DENIED"') ||
                  streamTail.includes('"decision":"deny"') ||
                  streamTail.includes('"optionId":"reject"'))
              ) {
                isErr = true;
                outStr =
                  '⚠️ 权限被拦截 (PERMISSION_DENIED)：此前处于「只读安全 (reads)」模式，acpx 拒绝了命令/写入工具执行。现已默认开启「自动读写 (all)」。';
              }
              const cls = classifyTool(tu.name || 'tool', inputStr);
              toolCalls++;
              if (isErr) toolErrors++;
              callIds.push(tid);
              pendingToolSteps.push({
                id: tid,
                kind: 'tool',
                name: tu.name || 'tool',
                family: cls.family,
                callId: tid,
                input: inputStr || undefined,
                output: outStr || undefined,
                status: isErr ? 'error' : 'ok',
                effects: [],
              });
            }
          }

          flushModelSegment();
        }
      }
      flushTurn();

      // If this is a Hermes acpx session with 0 messages in acpx JSON (because hermes stores messages in state.db), merge from state.db!
      if (channel === 'hermes' && turns.length === 0 && raw.acp_session_id) {
        const hm = this.loadHermesSessions().get(String(raw.acp_session_id));
        if (hm && hm.contract.turns.length > 0) {
          turns.push(...hm.contract.turns);
          modelCalls = hm.contract.stats.modelCalls;
          toolCalls = hm.contract.stats.toolCalls;
          toolErrors = hm.contract.stats.toolErrors;
        }
      }

      const realTurns = turns.filter((t) => !isSmokeTestPrompt(t.input || ''));
      const finalTurns = (realTurns.length > 0 ? realTurns : turns).map((t, idx) => ({
        ...t,
        id: `t${idx + 1}`,
        index: idx + 1,
      }));

      const firstTitle =
        finalTurns[0]?.input?.slice(0, 120) ||
        raw.title ||
        `${prof.label} · ${raw.name || recId.slice(0, 8)}`;

      const canonicalId = this.canonicalSessionId(channel, String(raw.acp_session_id || ''), recId);
      const canonicalSourceId = canonicalId.split(':').slice(1).join(':') || recId;

      return {
        id: canonicalId,
        sourceId: canonicalSourceId,
        source: {
          kind: prof.traceKind,
          format: 'acpx/session-v1',
          adapter: 'acpx@0.19.5',
          path: targetFile,
          size: stat.size,
          mtimeMs: stat.mtimeMs,
        },
        title: firstTitle,
        agent: {
          product: prof.product,
          name: raw.name || prof.label,
          role: 'main',
          model: activeModel,
          originator: prof.id,
        },
        cwd: raw.cwd || this.repoRoot,
        startedAt: raw.created_at,
        updatedAt: raw.last_used_at || raw.updated_at || raw.created_at,
        links: [],
        turns: finalTurns,
        state: {
          status: isRunning ? 'working' : 'idle',
          detail: `acpx 命名会话: ${raw.name || recId.slice(0, 8)}`,
        },
        stats: {
          turns: finalTurns.length,
          modelCalls,
          toolCalls,
          toolErrors,
          messages: finalTurns.length,
          compactions: 0,
          subagents: 0,
          records: msgs.length,
          skipped: 0,
        },
        notes: [],
      };
    } catch {
      return null;
    }
  },

  /** Get synthetic summaries for `acpx` / WorkBuddy / Hermes / Antigravity sessions that aren't already in `SessionStore`. */
  getExtraSummaries(this: AgentGatewayHub, existingIds: Set<string>): SessionSummary[] {
    const extras: SessionSummary[] = [];
    const seen = new Set(existingIds);
    for (const info of this.listAcpxSessions()) {
      if (seen.has(info.traceSessionId)) continue;
      const full =
        this.getAcpxSessionAsContract(info.traceSessionId) ||
        this.getAcpxSessionAsContract(info.acpxRecordId);
      if (full && full.turns.length > 0) {
        const unifiedId = info.traceSessionId || full.id;
        if (seen.has(unifiedId)) continue;
        seen.add(unifiedId);
        const { turns: _t, ...summary } = full;
        extras.push({ ...summary, id: unifiedId });
      }
    }
    return extras;
  },

  listWorkspaceDirs(this: AgentGatewayHub, extraSessions?: AcpxSessionInfo[]): string[] {
    const seen = new Set<string>();
    const addDir = (p?: string) => {
      if (!p) return;
      const clean = resolve(String(p).trim());
      if (!seen.has(clean.toLowerCase()) && existsSync(clean)) {
        try {
          if (statSync(clean).isDirectory()) {
            seen.add(clean.toLowerCase());
            dirs.push(clean);
          }
        } catch {}
      }
    };
    const dirs: string[] = [];
    addDir(this.repoRoot);
    addDir(resolve(this.repoRoot, '..'));
    addDir('E:\\program\\GIT\\Agent\\agent-hub');
    addDir('E:\\program\\GIT\\Agent\\ap-vibe');
    addDir('E:\\program\\sota');
    for (const v of this.selectedCwds.values()) addDir(v);
    for (const s of (extraSessions || []).slice(0, 35)) {
      if (s?.cwd) addDir(s.cwd);
    }
    return dirs.slice(0, 14);
  },

  hubRunStates(this: AgentGatewayHub): Map<string, { status: string; detail: string; endedAt: string }> {
    if (Date.now() - this.hubRunCache.at < 2000) return this.hubRunCache.map;
    const map = new Map<string, { status: string; detail: string; endedAt: string }>();
    const bySlot = new Map<string, string[]>();
    for (const s of this.listAcpxSessions()) {
      const ids = [s.acpSessionId, String(s.traceSessionId || '').split(':').pop() || ''].filter(Boolean);
      bySlot.set(this.slotKey(s.channel, s.sessionName), ids);
    }
    const put = (r: ActiveRun, status: string, detail: string) => {
      const ids = new Set([...(bySlot.get(this.slotKey(r.channel, r.sessionName)) || []), String(r.traceSessionId || '').split(':').pop() || '']);
      for (const id of ids) if (id && !map.has(id)) map.set(id, { status, detail, endedAt: r.endedAt || '' });
    };
    for (const r of this.activeRuns.values()) if (r.status === 'running') put(r, 'working', '在干活（经 hub 发起）');
    const label: Record<string, [string, string]> = {
      completed: ['idle', '这一轮已完成'],
      aborted: ['aborted', '已被停下'],
      failed: ['failed', '出错停了'],
    };
    for (const r of this.recentRuns) {
      const l = label[r.status];
      if (l) put(r, l[0], l[1] + (r.error ? '：' + String(r.error).slice(0, 80) : ''));
    }
    this.hubRunCache = { at: Date.now(), map };
    return map;
  },

  sessionBindings(this: AgentGatewayHub): Map<string, { sessionName: string; fromAcpxStore: boolean; channel: ChannelId; currentModel?: string }> {
    if (Date.now() - this.bindingCache.at < 2000) return this.bindingCache.map;
    const map = new Map<string, { sessionName: string; fromAcpxStore: boolean; channel: ChannelId; currentModel?: string }>();
    for (const s of this.listAcpxSessions()) {
      const entry = {
        sessionName: s.sessionName,
        fromAcpxStore: Boolean(s.fromAcpxStore),
        channel: s.channel,
        currentModel: s.currentModel,
      };
      if (s.traceSessionId) map.set(s.traceSessionId, entry);
      if (s.acpSessionId && !map.has(s.acpSessionId)) map.set(s.acpSessionId, entry);
    }
    const agyMap = this.loadAgySessionMap();
    for (const [name, cid] of Object.entries(agyMap)) {
      if (cid) {
        map.set('antigravity:' + cid, { sessionName: name, fromAcpxStore: true, channel: 'antigravity' });
      }
    }
    this.bindingCache = { at: Date.now(), map };
    return map;
  },

  mobileSessions(this: AgentGatewayHub, channelRaw: string, limit = 60) {
    const prof = resolveChannel(channelRaw);
    if (!prof) return [];
    const rows = this.listAcpxSessions()
      .filter((s) => s.channel === prof.id && !s.closed)
      .sort((a, b) => String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || '')))
      .slice(0, limit);
    return rows.map((s) => {
      const key = this.slotKey(prof.id, s.sessionName);
      const active = this.activeRuns.get(key);
      const last = this.recentRuns.find((r) => r.channel === prof.id && r.sessionName === s.sessionName);
      const state = active && active.status === 'running' ? 'working' : last && last.status === 'failed' ? 'failed' : 'idle';
      return {
        id: s.acpSessionId || s.acpxRecordId,
        traceSessionId: s.traceSessionId,
        sessionName: s.sessionName,
        title: s.title || s.sessionName,
        state,
        error: state === 'failed' ? last?.error || s.lastError || '' : '',
        updatedAt: s.updatedAt || s.createdAt || '',
        turns: s.turnCount,
        model: s.currentModel || '',
        cwd: s.cwd,
        queued: (this.queues.get(key) || []).length,
      };
    });
  },

  /**
   * Resolve the acpx/antigravity control sessionName for a session: if `traceSessionId` (or a generic `m-<id>`
   * fallback name from the web page) already has a bound `.acpx/sessions` record (`fromAcpxStore`) or Antigravity
   * mapping, reuse that exact `sessionName` so sending/switching model on the web page never forks a second record.
   */
  resolveBoundSessionName(this: AgentGatewayHub, prof: ChannelProfile, rawSessionName?: string, traceSessionId?: string): string {
    const reqName = (rawSessionName || '').trim();
    const tsid = (traceSessionId || '').trim();
    if (tsid && tsid.startsWith('new:')) {
      return reqName || tsid.split(':').slice(2).join(':');
    }
    const all = this.listAcpxSessions();
    if (tsid) {
      const tail = tsid.split(':').slice(1).join(':');
      const bound = all.find(
        (s) =>
          s.channel === prof.id &&
          (s.fromAcpxStore || prof.id === 'antigravity') &&
          (s.traceSessionId === tsid || s.acpSessionId === tail || `acpx:${s.acpxRecordId}` === tsid),
      );
      if (bound) return bound.sessionName;
    }
    if (reqName) {
      const exact = all.find((s) => s.channel === prof.id && (s.fromAcpxStore || prof.id === 'antigravity') && s.sessionName === reqName);
      if (exact) return exact.sessionName;
      if (reqName.startsWith('m-')) {
        const byShort = all.find(
          (s) =>
            s.channel === prof.id &&
            (s.fromAcpxStore || prof.id === 'antigravity') &&
            'm-' + s.traceSessionId.split(':').pop()!.replace(/[^\w-]/g, '').slice(0, 12) === reqName,
        );
        if (byShort) return byShort.sessionName;
      }
      return reqName;
    }
    if (tsid) {
      const anyMatch = all.find(
        (s) =>
          s.traceSessionId === tsid ||
          s.acpSessionId === tsid.split(':').slice(1).join(':') ||
          `acpx:${s.acpxRecordId}` === tsid,
      );
      if (anyMatch) return anyMatch.sessionName;
    }
    return '';
  },

  getExistingMessageCount(this: AgentGatewayHub, channel: ChannelId, sessionName: string): number {
    try {
      const info = this.listAcpxSessions().find(
        (s) => s.channel === channel && s.sessionName === sessionName,
      );
      if (!info) return 0;
      if (channel === 'antigravity') {
        const cid = info.acpSessionId;
        const transcriptPath = join(this.agyBrainDir, cid, '.system_generated', 'logs', 'transcript.jsonl');
        if (!existsSync(transcriptPath)) return 0;
        return readFileSync(transcriptPath, 'utf8')
          .split(/\r?\n/)
          .filter((l) => l.trim()).length;
      }
      const file = join(this.acpxDir, `${info.acpxRecordId}.json`);
      if (!existsSync(file)) return 0;
      const raw = JSON.parse(readFileSync(file, 'utf8'));
      return Array.isArray(raw.messages) ? raw.messages.length : 0;
    } catch {
      return 0;
    }
  },
};
