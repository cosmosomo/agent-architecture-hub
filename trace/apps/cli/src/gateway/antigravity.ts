/**
 * Antigravity (route agentapi): its language server, its conversations on disk (brain), and one turn on it.
 * Mixed into AgentGatewayHub (gateway.ts); `this` is the hub.
 */
import type { AgentGatewayHub } from '../gateway.ts';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { Session, Step, Turn } from '@hub-trace/contract';
import type { ChannelProfile, LiveToolCall, ActiveRun, AcpxSessionInfo } from './types.ts';
import { agentBaseEnv, CHANNEL_PROFILES, normalizeAgyCliModel, resolveAgyProjectId } from './products.ts';
import { HOME, isSmokeTestPrompt, classifyTool, stripUserRequestTags, agyTitle, formatMessageTimingBanner, ensurePromptSentStamp } from './common.ts';

/** A tool call in a model step. Calls carry no id: theirs is `agy_<step_index>_<n>`. */
export type AgyCall = { id: string; name: string; args: Record<string, any> | null; input: string; output?: string; error: boolean; background: boolean };
export type AgyEntry =
  | { kind: 'user'; at: string; text: string }
  | { kind: 'model'; at: string; done: boolean; thinking: string; text: string; usage?: { input: number; cached: number; output: number }; calls: AgyCall[] }
  | { kind: 'event'; at: string; name: 'subagent' | 'note' | 'error'; text: string };

/**
 * The one reader of an Antigravity transcript (brain/<cid>/.system_generated/logs/transcript.jsonl): the session page
 * (parseAntigravityBrain), the live view of a running turn (syncFromAntigravityTranscript) and "is the turn over"
 * (isAgyTurnDone) all read through it, so a fix here reaches all three (10-19: three readers had drifted apart).
 * - USER_INPUT, and words sent from outside (`agentapi send-message` arrives as a SYSTEM_MESSAGE "[Message] … sender=system
 *   … content=<text>"), are a person's words. Antigravity's own notices also come from sender=system (a sub-agent that
 *   failed, "[Notice] … stopped"): those are events. sender=<conversation>/task-N is a background task reporting back.
 * - PLANNER_RESPONSE is one model step with its tool calls; the results follow as GENERIC records, one per call, in
 *   call order (status RUNNING: it went to the background).
 * - ERROR_MESSAGE is an error event; retries of one request ("API error (attempt 1…6)") fold into one.
 * - Each tool argument value is itself JSON ("\"E:\\\\program…\""), unwrapped once here.
 */
export function readAgyTranscript(lines: string[]): { entries: AgyEntry[]; firstAt: string; lastAt: string } {
  const entries: AgyEntry[] = [];
  let firstAt = '';
  let lastAt = '';
  let awaiting: AgyCall[] = [];
  const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
  for (const line of lines) {
    let o: any;
    try {
      o = JSON.parse(line);
    } catch {
      continue;
    }
    const at = String(o?.created_at || '');
    if (at) {
      if (!firstAt) firstAt = at;
      lastAt = at;
    }
    if (o.type === 'USER_INPUT') {
      entries.push({ kind: 'user', at, text: stripUserRequestTags(String(o.content || '')) });
    } else if (o.type === 'SYSTEM_MESSAGE') {
      const m = /\[Message\] timestamp=(\S+) sender=(\S+) priority=\S+ content=([\s\S]*?)\s*(?:<\/SYSTEM_MESSAGE>[\s\S]*)?$/.exec(String(o.content || ''));
      if (!m) continue;
      const sentAt = m[1];
      const sender = m[2];
      const text = m[3].trim();
      const timingBanner = formatMessageTimingBanner(sentAt, at, sender !== 'system' ? sender : undefined);
      if (/\/task-\d+$/.test(sender)) {
        entries.push({ kind: 'event', at, name: 'note', text: `后台任务回报 ${timingBanner}：` + text.slice(0, 200) });
      } else if (sender === 'system' && /^(\[Notice\]|The subagent .+ with id ")/.test(text)) {
        entries.push({ kind: 'event', at, name: text.startsWith('The subagent') ? 'subagent' : 'note', text: `${timingBanner}\n` + text.slice(0, 600) });
      } else {
        entries.push({ kind: 'user', at, text: `${timingBanner}\n${text}` });
      }
    } else if (o.type === 'PLANNER_RESPONSE') {
      const raw: any[] = Array.isArray(o.tool_calls) ? o.tool_calls : [];
      const calls = raw.map((tc, i) => agyCall(tc, `agy_${o.step_index ?? entries.length}_${i + 1}`, o.status === 'ERROR'));
      awaiting = [...calls];
      const input = Number(o.input_tokens || 0);
      const output = Number(o.output_tokens || 0);
      entries.push({
        kind: 'model',
        at,
        done: o.status === 'DONE',
        thinking: str(o.thinking),
        text: str(o.content),
        usage: input || output ? { input, cached: Number(o.cache_read_tokens || 0), output } : undefined,
        calls,
      });
    } else if (o.type === 'GENERIC' && o.source === 'MODEL') {
      const c = awaiting.shift();
      if (!c) continue;
      const out = typeof o.content === 'string' ? o.content : o.error ? String(o.error) : '';
      if (out) c.output = out;
      if (o.error || o.status === 'ERROR') c.error = true;
      c.background = o.status === 'RUNNING';
    } else if (o.type === 'ERROR_MESSAGE') {
      const text = String(o.error || o.content || '').trim();
      if (!text) continue;
      const prev = entries[entries.length - 1];
      const retry = /^API error \(attempt/;
      if (prev?.kind === 'event' && prev.name === 'error' && retry.test(prev.text) && retry.test(text)) {
        prev.text = text.slice(0, 600);
        prev.at = at || prev.at;
      } else {
        entries.push({ kind: 'event', at, name: 'error', text: text.slice(0, 600) });
      }
    }
  }
  return { entries, firstAt, lastAt };
}

function agyCall(tc: any, fallbackId: string, failed: boolean): AgyCall {
  let args: Record<string, any> | null = null;
  if (tc?.args && typeof tc.args === 'object') args = tc.args;
  else if (typeof tc?.args === 'string') {
    try {
      args = JSON.parse(tc.args);
    } catch {}
  }
  if (args) {
    const plain: Record<string, any> = {};
    for (const [k, v] of Object.entries(args)) {
      let x = v;
      if (typeof v === 'string' && /^(".*"|\[.*\]|\{.*\}|true|false|-?\d+(\.\d+)?)$/s.test(v)) {
        try {
          x = JSON.parse(v);
        } catch {}
      }
      plain[k] = x;
    }
    args = plain;
  }
  const output = typeof tc?.result === 'string' ? tc.result : typeof tc?.output === 'string' ? tc.output : tc?.result ? JSON.stringify(tc.result, null, 2) : undefined;
  return {
    id: String(tc?.id || fallbackId),
    name: String(tc?.name || 'tool'),
    args,
    input: args ? JSON.stringify(args, null, 2) : typeof tc?.args === 'string' ? tc.args : '',
    output,
    error: Boolean(tc?.error || failed),
    background: false,
  };
}

export const antigravityMethods = {
  loadAgySessionMap(this: AgentGatewayHub): Record<string, string> {
    try {
      if (existsSync(this.agyMapFile)) {
        return JSON.parse(readFileSync(this.agyMapFile, 'utf8'));
      }
    } catch {}
    return {};
  },

  saveAgySessionMap(this: AgentGatewayHub, map: Record<string, string>) {
    try {
      mkdirSync(join(HOME, '.acpx'), { recursive: true });
      writeFileSync(this.agyMapFile, JSON.stringify(map, null, 2), 'utf8');
    } catch {}
  },

  discoverAntigravityLs(this: AgentGatewayHub, force = false) {
    if (!force && this.agyLsCache && Date.now() - this.agyLsCache.at < 30_000) {
      return this.agyLsCache;
    }
    const bin = join(
      HOME,
      'AppData',
      'Local',
      'Programs',
      'antigravity',
      'resources',
      'bin',
      'language_server.exe',
    );
    if (!existsSync(bin)) {
      throw new Error(`未找到 Antigravity language_server.exe: ${bin}`);
    }
    const psScript = `
$procs = Get-CimInstance Win32_Process -Filter "Name LIKE 'language_server%.exe'"
foreach ($p in $procs) {
  if ($p.CommandLine -match '--csrf_token\\s+([a-f0-9-]+)') {
    $csrf = $matches[1]
    $pidVal = $p.ProcessId
    $conns = Get-NetTCPConnection -OwningProcess $pidVal -State Listen -ErrorAction SilentlyContinue
    foreach ($c in $conns) {
      Write-Output "FOUND|$pidVal|$csrf|$($c.LocalPort)"
    }
  }
}
`;
    const r = spawnSync('powershell.exe', ['-NoProfile', '-Command', psScript], {
      encoding: 'utf8',
      timeout: 8000,
      windowsHide: true,
    });
    const lines = String(r.stdout || '')
      .split(/\r?\n/)
      .filter((l) => l.startsWith('FOUND|'));
    if (!lines.length) {
      throw new Error('未检测到运行中的 Antigravity language_server.exe 进程，请确认 Antigravity 已启动');
    }
    // The LS listens on an HTTPS (gRPC) port and a plain-HTTP (Connect-RPC) port in no stable order;
    // agentapi needs the one that answers GET /healthz over plain HTTP.
    const found = lines.map((l) => l.split('|'));
    const hit =
      found.find(([, , , p]) => {
        const h = spawnSync('curl.exe', ['-s', '--max-time', '2', `http://127.0.0.1:${p}/healthz`], {
          encoding: 'utf8',
          timeout: 3000,
          windowsHide: true,
        });
        return /"status"\s*:\s*"ok"/.test(String(h.stdout || ''));
      }) || found[0];
    const [, , csrf, port] = hit;
    const address = `localhost:${port}`;
    this.agyLsCache = {
      at: Date.now(),
      bin,
      csrf,
      port,
      address,
      env: {
        ANTIGRAVITY_CLI_ALIAS: 'agy',
        ANTIGRAVITY_LS_ADDRESS: address,
        ANTIGRAVITY_CSRF_TOKEN: csrf,
      },
    };
    return this.agyLsCache;
  },

  /** Parse a single Antigravity `transcript.jsonl` into `AcpxSessionInfo` + `Session` contract (cached by mtimeMs). */
  parseAntigravityBrain(this: AgentGatewayHub,
    cid: string,
    transcriptPath: string,
    reverseNameMap: Map<string, string>,
  ): { info: AcpxSessionInfo; contract: Session } | null {
    try {
      const stat = statSync(transcriptPath);
      const cached = this.agySummaryCache.get(cid);
      const sessionName = reverseNameMap.get(cid) || `agy-${cid.slice(0, 8)}`;
      const slot = this.slotKey('antigravity', sessionName);
      const prof = CHANNEL_PROFILES.antigravity;
      const activeModel =
        this.selectedModels.get(slot) ||
        this.selectedModels.get('antigravity') ||
        prof.defaultModel;
      const isRunning = this.activeRuns.get(slot)?.status === 'running';

      if (cached && cached.mtimeMs === stat.mtimeMs) {
        cached.info.sessionName = sessionName;
        cached.info.currentModel = activeModel;
        cached.contract.agent.model = activeModel;
        cached.contract.state.status = isRunning ? 'working' : 'idle';
        return cached;
      }

      const content = readFileSync(transcriptPath, 'utf8');
      const lines = content.split(/\r?\n/).filter((l) => l.trim());
      const { entries, firstAt: firstCreatedAt, lastAt: lastCreatedAt } = readAgyTranscript(lines);
      const turns: Turn[] = [];
      let curSteps: Step[] = [];
      let curInput = '';
      let curOutput = '';
      let curStartedAt = '';
      let curEndedAt = '';
      let turnIdx = 0;
      let stepSeq = 0;
      let modelCalls = 0;
      // The last model step's size (input, read from cache, output): how full the context is; the window is not recorded.
      let context: { used: number; at?: string } | undefined;
      let toolCalls = 0;
      let toolErrors = 0;
      let subagents = 0;
      let detectedCwd = this.repoRoot;
      let lastInterrupted = false;
      let lastErrorText = '';
      const childLinks: { rel: 'child'; id: string; label?: string }[] = [];

      const flushTurn = () => {
        if (!curSteps.length) return;
        turnIdx++;
        turns.push({
          id: `t${turnIdx}`,
          index: turnIdx,
          status: 'completed',
          startedAt: curStartedAt || firstCreatedAt || new Date(stat.mtimeMs).toISOString(),
          endedAt: curEndedAt || lastCreatedAt || new Date(stat.mtimeMs).toISOString(),
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

      for (const e of entries) {
        const at = e.at || undefined;
        if (e.kind === 'user') {
          flushTurn();
          curStartedAt = e.at;
          curInput = e.text;
          if (/^Error:\s*The stream was interrupted/i.test(e.text)) {
            lastInterrupted = true;
            lastErrorText = e.text;
          }
          curSteps.push({ id: `s${++stepSeq}`, kind: 'message', role: 'user', text: e.text, at });
        } else if (e.kind === 'event') {
          if (e.name === 'error' && /stream was interrupted/i.test(e.text)) {
            lastInterrupted = true;
            lastErrorText = e.text;
          }
          curSteps.push({ id: `s${++stepSeq}`, kind: 'event', name: e.name, text: e.text, at });
        } else {
          curEndedAt = e.at || curEndedAt;
          if (e.text) {
            curOutput = e.text;
            lastInterrupted = false;
          }
          for (const c of e.calls) {
            if (typeof c.args?.Cwd === 'string') detectedCwd = c.args.Cwd;
            if (c.name === 'invoke_subagent') subagents++;
            if (c.error) toolErrors++;
          }
          toolCalls += e.calls.length;
          if (e.usage) {
            const used = (e.usage.input || 0) + (e.usage.cached || 0) + (e.usage.output || 0);
            if (used > 0) context = { used, ...(at ? { at } : {}) };
          }
          if (!e.thinking && !e.text && !e.calls.length) continue;
          modelCalls++;
          curSteps.push({
            id: `s${++stepSeq}`,
            kind: 'model',
            model: activeModel,
            at,
            reasoning: e.thinking || undefined,
            text: e.text || undefined,
            phase: e.calls.length ? 'commentary' : 'final',
            calls: e.calls.map((c) => c.id),
            usage: e.usage
              ? { input: e.usage.input, cachedInput: e.usage.cached || undefined, output: e.usage.output, total: e.usage.input + e.usage.output }
              : undefined,
          });
          for (const c of e.calls) {
            const cls = classifyTool(c.name, c.input);
            curSteps.push({
              id: c.id,
              kind: 'tool',
              name: c.name,
              family: cls.family,
              callId: c.id,
              input: c.input || undefined,
              output: c.output || undefined,
              status: c.error ? 'error' : 'ok',
              at,
              effects: [],
            });
          }
        }
      }
      flushTurn();

      const realTurns = turns.filter((t) => !isSmokeTestPrompt(t.input || ''));
      const finalTurns = (realTurns.length > 0 ? realTurns : turns).map((t, idx) => ({
        ...t,
        id: `t${idx + 1}`,
        index: idx + 1,
      }));

      const firstUserTurn = finalTurns.find(
        (t) => t.input && !t.input.startsWith('[上下文压缩检查点]') && !t.input.startsWith('Error:'),
      );
      const title =
        (firstUserTurn?.input || finalTurns[0]?.input || `Antigravity · ${sessionName}`)
          .replace(/\s+/g, ' ')
          .slice(0, 110);

      const traceSessionId = `antigravity:${cid}`;
      const createdAtIso = firstCreatedAt || new Date(stat.birthtimeMs || stat.mtimeMs).toISOString();
      const updatedAtIso = lastCreatedAt || new Date(stat.mtimeMs).toISOString();

      const info: AcpxSessionInfo = {
        acpxRecordId: `antigravity:${cid}`,
        acpSessionId: cid,
        sessionName,
        channel: 'antigravity',
        channelId: 'antigravity',
        cwd: detectedCwd,
        title,
        closed: false,
        pid: null,
        createdAt: createdAtIso,
        updatedAt: updatedAtIso,
        turnCount: finalTurns.length,
        traceSessionId,
        currentModel: activeModel,
        availableModels: Array.from(new Set([activeModel, ...prof.recommendedModels])),
        interrupted: lastInterrupted,
        lastError: lastErrorText || undefined,
      };

      const contract: Session = {
        id: traceSessionId,
        sourceId: cid,
        source: {
          kind: 'antigravity',
          format: 'antigravity/transcript-jsonl',
          adapter: 'antigravity-ls@1.0',
          path: transcriptPath,
          size: stat.size,
          mtimeMs: stat.mtimeMs,
        },
        title,
        agent: {
          product: prof.product,
          name: sessionName,
          role: 'main',
          model: activeModel,
          originator: 'antigravity',
        },
        cwd: detectedCwd,
        startedAt: createdAtIso,
        updatedAt: updatedAtIso,
        links: childLinks,
        turns: finalTurns,
        state: {
          status: isRunning ? 'working' : lastInterrupted ? 'failed' : 'idle',
          detail: lastInterrupted
            ? `流中断待续跑 (${sessionName})`
            : `Antigravity Brain: ${sessionName} (${cid.slice(0, 8)})`,
        },
        stats: {
          turns: finalTurns.length,
          modelCalls,
          toolCalls,
          toolErrors,
          messages: finalTurns.length,
          compactions: 0,
          subagents,
          ...(context ? { context } : {}),
          records: lines.length,
          skipped: 0,
        },
        notes: [],
      };

      const entry = { mtimeMs: stat.mtimeMs, info, contract };
      this.agySummaryCache.set(cid, entry);
      return entry;
    } catch {
      return null;
    }
  },

  /**
   * An Antigravity conversation whose transcript is gone (older versions did not keep one, 16 such on 2026-10-18)
   * but whose brain folder still holds what it produced: task.md, implementation_plan.md, walkthrough.md. Antigravity
   * still lists it, so we do too, honestly marked, showing those documents as its content.
   */
  parseAntigravityArtifactsOnly(this: AgentGatewayHub,
    cid: string,
    reverseNameMap: Map<string, string>,
  ): { info: AcpxSessionInfo; contract: Session } | null {
    const dir = join(this.agyBrainDir, cid);
    let names: string[] = [];
    try {
      names = readdirSync(dir).filter((n) => /\.md$/i.test(n));
    } catch {
      return null;
    }
    const order = ['task.md', 'implementation_plan.md', 'walkthrough.md'];
    names.sort((a, b) => (order.indexOf(a) + 1 || 9) - (order.indexOf(b) + 1 || 9));
    const docs = names
      .map((n) => {
        try {
          return { name: n, text: readFileSync(join(dir, n), 'utf8') };
        } catch {
          return null;
        }
      })
      .filter((d): d is { name: string; text: string } => Boolean(d && d.text.trim()));
    let row: { lm?: string; ws?: string; title?: string } = {};
    try {
      const db = new DatabaseSync(join(homedir(), '.gemini', 'antigravity', 'conversation_summaries.db'), { readOnly: true });
      try {
        row = (db.prepare('SELECT last_modified_time AS lm, workspace_uris AS ws, title FROM conversation_summaries WHERE conversation_id = ?').get(cid) as typeof row) || {};
      } finally {
        db.close();
      }
    } catch {}
    const at = row.lm ? new Date(String(row.lm).replace(' ', 'T').replace(/(\.\d{3})\d*/, '$1')).toISOString() : new Date(statSync(dir).mtimeMs).toISOString();
    let cwd = this.repoRoot;
    try {
      const uri = (JSON.parse(String(row.ws || '[]')) as string[])[0];
      if (uri) cwd = decodeURIComponent(uri.replace(/^file:\/\/\//, '')).replace(/\//g, '\\');
    } catch {}
    // Only conversations Antigravity itself still lists; an empty one is shown as empty rather than left out.
    if (!docs.length && !row.lm) return null;
    const heading = docs.map((d) => /^#+\s+(.+)$/m.exec(d.text)?.[1]).find(Boolean) || row.title || docs[0]?.name || '（没有留下内容的对话）';
    const sessionName = reverseNameMap.get(cid) || `agy-${cid.slice(0, 8)}`;
    const title = heading.replace(/\s+/g, ' ').slice(0, 110);
    const traceSessionId = `antigravity:${cid}`;
    const steps: Step[] = [
      { id: 's1', kind: 'event', name: 'note', text: docs.length ? '这个对话的记录文件已经不在了，下面是它留下的产出物' : '这个对话没有留下记录文件，也没有产出物', at },
      ...docs.map((d, i) => ({ id: `s${i + 2}`, kind: 'model' as const, at, text: `**${d.name}**\n\n${d.text.slice(0, 40000)}`, phase: 'final' as const, calls: [] })),
    ];
    const turn: Turn = { id: 't1', index: 1, status: 'completed', startedAt: at, endedAt: at, steps };
    const info: AcpxSessionInfo = {
      acpxRecordId: traceSessionId,
      acpSessionId: cid,
      sessionName,
      channel: 'antigravity',
      channelId: 'antigravity',
      cwd,
      title,
      closed: false,
      pid: null,
      createdAt: at,
      updatedAt: at,
      turnCount: 1,
      traceSessionId,
      currentModel: CHANNEL_PROFILES.antigravity.defaultModel,
      availableModels: CHANNEL_PROFILES.antigravity.recommendedModels,
    };
    const contract: Session = {
      id: traceSessionId,
      sourceId: cid,
      source: { kind: 'antigravity', format: 'antigravity/brain-artifacts', adapter: 'antigravity-ls@1.0', path: dir },
      title,
      agent: { product: 'Antigravity', name: sessionName, role: 'main', originator: 'antigravity' },
      cwd,
      startedAt: at,
      updatedAt: at,
      links: [],
      turns: [turn],
      state: { status: 'idle', detail: docs.length ? '只剩产出物，对话记录已不在' : '空对话' },
      stats: { turns: 1, modelCalls: 0, toolCalls: 0, toolErrors: 0, messages: 0, compactions: 0, subagents: 0, records: docs.length, skipped: 0 },
      notes: ['transcript missing; artifacts only'],
    };
    return { info, contract };
  },

  /** List all Antigravity sessions from `~/.gemini/antigravity/brain/<cid>/.system_generated/logs/transcript.jsonl`. */
  listAntigravitySessions(this: AgentGatewayHub): AcpxSessionInfo[] {
    if (this.agyListCache && Date.now() - this.agyListCache.at < 8_000) {
      return this.agyListCache.list;
    }
    if (!existsSync(this.agyBrainDir)) return [];
    const nameMap = this.loadAgySessionMap();
    const reverseNameMap = new Map<string, string>();
    for (const [sName, cid] of Object.entries(nameMap)) {
      if (cid) reverseNameMap.set(cid, sName);
    }

    const out: AcpxSessionInfo[] = [];
    try {
      for (const d of readdirSync(this.agyBrainDir, { withFileTypes: true })) {
        if (!d.isDirectory()) continue;
        const cid = d.name;
        const transcriptPath = join(this.agyBrainDir, cid, '.system_generated', 'logs', 'transcript.jsonl');
        if (!existsSync(transcriptPath)) {
          const docsOnly = this.parseAntigravityArtifactsOnly(cid, reverseNameMap);
          if (docsOnly) out.push(docsOnly.info);
          continue;
        }
        const parsed = this.parseAntigravityBrain(cid, transcriptPath, reverseNameMap);
        if (parsed && parsed.info.turnCount > 0) {
          out.push(parsed.info);
        }
      }
    } catch {}
    out.sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
    this.agyListCache = { at: Date.now(), list: out };
    return out;
  },

  /** Send a message into a running Antigravity conversation; false when it cannot be sent (caller queues). */
  steerAntigravity(this: AgentGatewayHub, sessionName: string, run: ActiveRun, prompt: string, cwd: string): boolean {
    try {
      const ls = this.discoverAntigravityLs();
      const cid =
        this.loadAgySessionMap()[sessionName] ||
        (run.traceSessionId?.startsWith('antigravity:') ? run.traceSessionId.slice('antigravity:'.length) : '');
      if (!cid) return false;
      const stampedPrompt = ensurePromptSentStamp(prompt);
      const child = spawn(ls.bin, ['agentapi', 'send-message', cid, stampedPrompt], {
        cwd,
        env: { ...agentBaseEnv(), ...ls.env, ANTIGRAVITY_PROJECT_ID: resolveAgyProjectId(cwd) },
        windowsHide: true,
        stdio: 'ignore',
      });
      child.on('error', () => {});
      (run.warnings ||= []).push('中途插话：' + prompt.slice(0, 80));
      this.broadcast('run_update', run);
      return true;
    } catch {
      return false;
    }
  },

  startAntigravityRun(this: AgentGatewayHub,
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
    const { prof, sessionName, cwd, prompt, model } = opts;
    const key = this.slotKey(prof.id, sessionName);
    let ls: ReturnType<AgentGatewayHub['discoverAntigravityLs']>;
    try {
      ls = this.discoverAntigravityLs();
    } catch (e: any) {
      run.status = 'failed';
      run.error = e?.message || '无法连接 Antigravity language_server.exe';
      this.finalizeRun(run, opts);
      return run;
    }

    const agyMap = this.loadAgySessionMap();
    let cid = agyMap[sessionName] || '';
    if (!cid && opts.traceSessionId?.startsWith('antigravity:')) {
      cid = opts.traceSessionId.slice('antigravity:'.length);
      agyMap[sessionName] = cid;
      this.saveAgySessionMap(agyMap);
    }

    const hasExistingBrain =
      Boolean(cid) &&
      existsSync(join(this.agyBrainDir, cid, '.system_generated', 'logs', 'transcript.jsonl'));

    const cliModel = normalizeAgyCliModel(model);
    const stampedPrompt = hasExistingBrain ? ensurePromptSentStamp(prompt) : prompt;
    const args = hasExistingBrain
      ? ['agentapi', 'send-message', cid, stampedPrompt]
      : ['agentapi', 'new-conversation', `--model=${cliModel}`, `--title=${agyTitle(sessionName, prompt)}`, prompt];

    const deliver = (args: string[]) => {
      const child = spawn(ls.bin, args, {
        cwd,
        env: { ...agentBaseEnv(), ...ls.env, ANTIGRAVITY_PROJECT_ID: resolveAgyProjectId(cwd) },
        windowsHide: true,
      });

      this.activeProcs.set(key, child);
      let stdoutBuf = '';
      let stderrBuf = '';

      child.stdout.on('data', (chunk: Buffer) => {
        stdoutBuf += chunk.toString('utf8');
        // Try extracting conversationId early if new-conversation outputs it
        if (!cid) {
          const m = /"conversationId"\s*:\s*"([0-9a-f-]{36})"/i.exec(stdoutBuf);
          if (m) {
            cid = m[1];
            agyMap[sessionName] = cid;
            this.saveAgySessionMap(agyMap);
            run.traceSessionId = `antigravity:${cid}`;
          }
        }
      });

      child.stderr.on('data', (chunk: Buffer) => {
        stderrBuf += chunk.toString('utf8');
      });

      child.on('close', (code) => {
        try {
          const parsed = JSON.parse(stdoutBuf.trim());
          const newCid = parsed?.response?.newConversation?.conversationId;
          if (newCid && !cid) {
            cid = newCid;
            agyMap[sessionName] = cid;
            this.saveAgySessionMap(agyMap);
          }
        } catch {}

        if (cid) {
          run.traceSessionId = `antigravity:${cid}`;
          this.syncFromAntigravityTranscript(run, cid);
        }

        if (run.status === 'cancelling' || run.status === 'aborted') {
          finish('aborted');
        } else if ((code !== 0 && !run.text) || !cid) {
          finish('failed', stderrBuf.trim() || stdoutBuf.trim() || `Antigravity 退出码 ${code}`);
        } else {
          delivered = true;
          deliveredAt = Date.now();
        }
      });
    };

    // agentapi only delivers the message and exits; the turn ends when the transcript shows a final
    // PLANNER_RESPONSE. So after a successful delivery keep polling until then (or cancel / 1h cap).
    let delivered = false;
    let finished = false;
    const deadline = Date.now() + 60 * 60_000;
    // send-message into a conversation that a shutdown cut off mid-turn says it delivered, but nothing ever
    // runs the message (10-20: dev-center-r3 after the reboot, three one-hour waits). So when the transcript
    // has not grown two minutes after delivery and the conversation is idle, carry on in a new conversation
    // once; if that one is silent too, fail now instead of waiting out the hour.
    let deliveredAt = 0;
    let carriedOn = false;
    const transcriptLines = (id: string) => {
      try {
        return readFileSync(join(this.agyBrainDir, id, '.system_generated', 'logs', 'transcript.jsonl'), 'utf8')
          .split(/\r?\n/)
          .filter((l) => l.trim()).length;
      } catch {
        return 0;
      }
    };
    const swallowed = () =>
      Date.now() - deliveredAt > 2 * 60_000 &&
      transcriptLines(cid) <= (run.initialMsgCount ?? 0) &&
      this.agyConversationIdle(cid) === true;
    const carryOn = () => {
      const oldCid = cid;
      carriedOn = true;
      delivered = false;
      cid = '';
      run.initialMsgCount = 0;
      (run.warnings ||= []).push(`原会话 ${oldCid.slice(0, 8)} 收下消息两分钟没动静（上次在回合中途被打断），改在新会话里发`);
      this.broadcast('run_update', run);
      const note =
        `（接续会话：原 Antigravity 会话 ${oldCid} 上次在回合中途被打断，收不到新消息，中心改在这个新会话里发。` +
        `需要之前的上下文时读 ${join(this.agyBrainDir, oldCid, '.system_generated', 'logs', 'transcript.jsonl')}。）\n\n`;
      deliver(['agentapi', 'new-conversation', `--model=${cliModel}`, `--title=${agyTitle(sessionName, prompt)}`, note + prompt]);
    };
    const finish = (status: 'completed' | 'failed' | 'aborted', error?: string) => {
      if (finished) return;
      finished = true;
      clearInterval(pollTimer);
      run.status = status;
      if (error) run.error = error;
      this.finalizeRun(run, opts);
    };
    const pollTimer = setInterval(() => {
      if (cid) {
        this.syncFromAntigravityTranscript(run, cid);
      }
      if (!delivered) return;
      if (run.status === 'cancelling' || run.status === 'aborted') finish('aborted');
      else if (this.isAgyTurnDone(run, cid)) finish('completed');
      else if (swallowed()) {
        if (hasExistingBrain && !carriedOn) carryOn();
        else finish('failed', 'Antigravity 收下消息两分钟后 transcript 仍没有动静，会话空闲（消息没有被执行）');
      } else if (Date.now() > deadline) finish('failed', 'Antigravity 一小时内没有在 transcript 里写出最终回复');
    }, 600);

    deliver(args);
    return run;
  },

  /**
   * The turn is over when the last PLANNER_RESPONSE written since the run began is DONE with no pending
   * tool calls, the conversation index says idle, and both have held for 5 s with no new transcript lines
   * (the index can read idle for a moment before a background task registers; seen 2026-10-17).
   */
  isAgyTurnDone(this: AgentGatewayHub, run: ActiveRun, cid: string): boolean {
    try {
      const transcriptPath = join(this.agyBrainDir, cid, '.system_generated', 'logs', 'transcript.jsonl');
      if (!existsSync(transcriptPath)) return false;
      const all = readFileSync(transcriptPath, 'utf8')
        .split(/\r?\n/)
        .filter((l) => l.trim());
      const models = readAgyTranscript(all.slice(run.initialMsgCount ?? 0)).entries.filter((e) => e.kind === 'model');
      const last = models[models.length - 1];
      const textDone = Boolean(last && last.done && !last.calls.length);
      // A text-only DONE step can also mean the agent yielded while a background command runs;
      // the conversation index says whether the cascade is really idle (null = index unreadable).
      const looksDone = textDone && this.agyConversationIdle(cid) !== false;
      const seen = this.agyDoneSince.get(run.runId);
      if (!looksDone || !seen || seen.lines !== all.length) {
        if (looksDone) this.agyDoneSince.set(run.runId, { at: Date.now(), lines: all.length });
        else this.agyDoneSince.delete(run.runId);
        return false;
      }
      if (Date.now() - seen.at < 5000) return false;
      this.agyDoneSince.delete(run.runId);
      return true;
    } catch {
      return false;
    }
  },

  agyConversationIdle(this: AgentGatewayHub, cid: string): boolean | null {
    try {
      const db = new DatabaseSync(join(HOME, '.gemini', 'antigravity', 'conversation_summaries.db'), { readOnly: true });
      const row = db
        .prepare('select status, not_fully_idle as busy from conversation_summaries where conversation_id = ?')
        .get(cid) as { status?: string; busy?: number } | undefined;
      db.close();
      if (!row) return null;
      return !Number(row.busy) && !String(row.status || '').endsWith('RUNNING');
    } catch {
      return null;
    }
  },

  syncFromAntigravityTranscript(this: AgentGatewayHub, run: ActiveRun, cid: string) {
    try {
      const transcriptPath = join(this.agyBrainDir, cid, '.system_generated', 'logs', 'transcript.jsonl');
      if (!existsSync(transcriptPath)) return;
      const lines = readFileSync(transcriptPath, 'utf8')
        .split(/\r?\n/)
        .filter((l) => l.trim());
      const minIdx = run.initialMsgCount ?? 0;
      if (lines.length <= minIdx) return;

      let thoughts = '';
      let text = '';
      let changed = false;
      for (const e of readAgyTranscript(lines.slice(minIdx)).entries) {
        if (e.kind !== 'model') continue;
        if (e.thinking) thoughts = e.thinking;
        if (e.text) text = e.text;
        for (const c of e.calls) {
          // Running until its result is written (or while it works in the background).
          const st: LiveToolCall['status'] = c.error ? 'error' : c.output && !c.background ? 'ok' : 'running';
          const ex = run.tools.find((x) => x.id === c.id);
          if (!ex) {
            const cls = classifyTool(c.name, c.input);
            run.tools.push({
              id: c.id,
              name: c.name,
              category: cls.category,
              icon: cls.icon,
              summary: cls.summary,
              status: st,
              input: c.input || undefined,
              output: c.output || undefined,
              startedAt: e.at || new Date().toISOString(),
            });
            changed = true;
          } else if (ex.status !== st || (c.output && ex.output !== c.output)) {
            ex.status = st;
            if (c.output) ex.output = c.output;
            changed = true;
          }
        }
      }

      if (thoughts && thoughts !== run.thoughts) {
        run.thoughts = thoughts;
        changed = true;
      }
      if (text && text !== run.text) {
        run.text = text;
        changed = true;
      }
      if (changed) {
        this.markRunSeenByDispatch(run);
        this.broadcast('run_update', run);
      }
    } catch {}
  },
};
