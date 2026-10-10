/**
 * Claude Code session records (`~/.claude/projects/<encoded-path>/*.jsonl`) to the trace contract.
 *
 * Format: Each line is a JSON object with uuid, parentUuid, sessionId, timestamp, type, message,
 * toolUse, toolUseResult, isSidechain, entrypoint, cwd. The entrypoint field identifies the source:
 * - "cli" - Claude Code CLI
 * - "claude-vscode" - VS Code extension
 * - "claude-desktop" - Desktop app
 *
 * Filters: isSidechain=true and isMeta=true messages are excluded.
 * System message types (progress, queue-operation, file-history-snapshot, system) are metadata only.
 */
import {
  CONTRACT_VERSION,
  sessionId,
  type Effect,
  type EventStep,
  type Iso,
  type MessageStep,
  type ModelStep,
  type Session,
  type SessionLink,
  type Step,
  type ToolFamily,
  type ToolStep,
  type Turn,
  type TurnSettings,
  type Usage,
} from '@hub-trace/contract';
import type { FinishOptions, LineParser, SourceFile } from '../types.ts';
import { LIMITS, clean, isoFromEpoch, msBetween, oneLine, partsText } from '../text.ts';

export const CLAUDE_KIND = 'claude-code';
export const CLAUDE_ADAPTER_VERSION = '0.1.0';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type J = any;

const SYSTEM_MESSAGE_TYPES = new Set(['summary', 'progress', 'queue-operation', 'file-history-snapshot', 'system', 'ai-title', 'custom-title']);
const AGENT_TOOLS = new Set(['spawn_agent', 'send_message', 'Agent']);
const SHELL_TOOLS = new Set(['execute_bash', 'PowerShell', 'Bash']);

export function toolFamily(name: string): ToolFamily {
  if (name === 'str_replace' || name === 'fs_write') return 'patch';
  if (name === 'EnterWorktree' || name === 'ExitWorktree') return 'plan';
  if (AGENT_TOOLS.has(name)) return 'agent';
  if (SHELL_TOOLS.has(name)) return 'shell';
  if (name.startsWith('mcp__')) return 'mcp';
  if (name === 'WebFetch' || name === 'web_search') return 'web';
  return 'other';
}

function usageOf(u: J): Usage | undefined {
  if (!u || typeof u !== 'object') return undefined;
  const out: Usage = {};
  const put = (k: keyof Usage, v: unknown) => { if (typeof v === 'number' && Number.isFinite(v)) out[k] = v; };
  put('input', u.input_tokens || u.inputTokens);
  put('cachedInput', u.cache_read_input_tokens || u.cacheReadInputTokens || u.cached_input_tokens);
  put('cacheWrite', u.cache_creation_input_tokens || u.cacheCreationInputTokens);
  put('output', u.output_tokens || u.outputTokens);
  put('reasoning', u.reasoning_tokens || u.reasoningTokens);
  put('total', u.total_tokens);
  return Object.keys(out).length ? out : undefined;
}

function durationMs(d: J): number | undefined {
  return typeof d === 'number' ? d : undefined;
}

function basename(p: string): string {
  const parts = p.split(/[\\/]/);
  return parts[parts.length - 1] || p;
}

export function createClaudeParser(file: SourceFile): LineParser {
  let records = 0;
  let skipped = 0;
  let firstAt: Iso | undefined;
  let lastAt: Iso | undefined;
  const unknown = new Map<string, number>();

  const turns: Turn[] = [];
  let cur: Turn | null = null;
  let model: ModelStep | null = null;
  const openTools = new Map<string, ToolStep>();
  let lastTool: ToolStep | null = null;
  let lastInputAt: Iso | undefined;
  let settings: TurnSettings = {};
  let sessionUsage: Usage | undefined;
  let entrypoint: string | undefined;
  let cwd: string | undefined;
  let sessionIdValue: string | undefined;
  const children = new Map<string, string>();
  const usedIds = new Set<string>();
  let seq = 0;

  const note = (k: string) => unknown.set(k, (unknown.get(k) || 0) + 1);
  const uid = (base: string | undefined, prefix: string): string => {
    let id = base && typeof base === 'string' ? base : prefix + ++seq;
    if (usedIds.has(id)) id = id + '#' + ++seq;
    usedIds.add(id);
    return id;
  };
  const stamp = (at: Iso | undefined) => {
    if (!at) return;
    if (!firstAt || at < firstAt) firstAt = at;
    if (!lastAt || at > lastAt) lastAt = at;
  };

  function openTurn(id: string | undefined, at: Iso | undefined): Turn {
    const t: Turn = {
      id: id || 't' + (turns.length + 1),
      index: turns.length + 1,
      status: 'running',
      startedAt: at,
      steps: [],
      settings: { ...settings },
    };
    turns.push(t);
    cur = t;
    lastInputAt = at;
    return t;
  }

  function turnFor(at: Iso | undefined): Turn {
    if (cur) return cur;
    return openTurn(undefined, at);
  }

  function push(t: Turn, s: Step) {
    t.steps.push(s);
    if (s.at && (!t.startedAt || s.at < t.startedAt)) t.startedAt = s.at;
  }

  function ensureModel(at: Iso | undefined): ModelStep {
    if (model) return model;
    const t = turnFor(at);
    model = { kind: 'model', id: uid(undefined, 'm'), at: lastInputAt || at, calls: [] };
    if (t.settings?.model) model.model = t.settings.model;
    push(t, model);
    return model;
  }

  function closeModel(at: Iso | undefined, usage?: Usage) {
    if (!model) return;
    if (at) model.endAt = at;
    if (usage && !model.usage) model.usage = usage;
    model = null;
  }

  function closeTool(tool: ToolStep, at: Iso | undefined) {
    if (at) tool.endAt = at;
    if (tool.durationMs === undefined) tool.durationMs = msBetween(tool.at, at);
    if (tool.callId) openTools.delete(tool.callId);
    if (lastTool === tool) {
      const rest = Array.from(openTools.values());
      lastTool = rest.length ? rest[rest.length - 1] : null;
    }
  }

  function settle(tool: ToolStep) {
    if (tool.effects.some((e) => e.status === 'error')) tool.status = 'error';
    else tool.status = 'ok';
  }

  function closeTurn(t: Turn, at: Iso | undefined, status: Turn['status'], error?: string) {
    if (model && t.steps.includes(model)) closeModel(at);
    for (const tool of Array.from(openTools.values())) {
      if (!t.steps.includes(tool)) continue;
      if (status === 'completed') { settle(tool); tool.output = tool.output || '（无输出记录）'; }
      else { tool.status = 'error'; tool.output = tool.output || '（未完成）'; }
      closeTool(tool, at);
    }
    t.status = status;
    if (error) t.error = error;
    if (at) t.endedAt = at;
    if (t.durationMs === undefined) t.durationMs = msBetween(t.startedAt, t.endedAt);
    if (cur === t) cur = null;
  }

  function addMessage(role: MessageStep['role'], text: string, at: Iso | undefined, id?: string) {
    if (role === 'user' && cur && cur.steps.some((s) => s.kind === 'model')) {
      closeTurn(cur, lastAt, 'completed');
    }
    const t = turnFor(at);
    const m: MessageStep = { kind: 'message', id: uid(id, 'msg'), at, role, text: clean(text) };
    push(t, m);
    if (role === 'user' && !t.input) t.input = oneLine(text, 400);
    lastInputAt = at;
  }

  function addToolCall(callId: string | undefined, name: string, input: string | undefined, at: Iso | undefined) {
    const m = ensureModel(at);
    const tool: ToolStep = {
      kind: 'tool',
      id: uid(callId ? 'tool:' + callId : undefined, 'tool'),
      at,
      name,
      family: toolFamily(name),
      status: 'pending',
      effects: [],
    };
    if (callId) tool.callId = callId;
    if (input !== undefined) tool.input = clean(input, LIMITS.io);
    m.calls.push(tool.id);
    push(turnFor(at), tool);
    if (callId) openTools.set(callId, tool);
    lastTool = tool;
  }

  function addToolOutput(callId: string | undefined, output: string, at: Iso | undefined, isError: boolean) {
    closeModel(undefined);
    let tool = callId ? openTools.get(callId) : lastTool;
    if (!tool) {
      tool = { kind: 'tool', id: uid(callId ? 'tool:' + callId + ':out' : undefined, 'tool'), at, name: 'unknown', family: 'other', status: 'pending', effects: [] };
      if (callId) tool.callId = callId;
      push(turnFor(at), tool);
    }
    tool.output = clean(output, LIMITS.io);
    tool.status = isError ? 'error' : 'ok';
    closeTool(tool, at);
    lastInputAt = at;
  }

  function onRecord(o: J, idx: number) {
    stamp(o.timestamp);

    // Track session metadata
    if (!sessionIdValue && o.sessionId) sessionIdValue = o.sessionId;
    if (!entrypoint && o.entrypoint) entrypoint = o.entrypoint;
    if (!cwd && o.cwd) cwd = o.cwd;

    // Filter out sidechain and meta messages
    if (o.isSidechain === true || o.isMeta === true) return;

    // Filter out system message types
    if (SYSTEM_MESSAGE_TYPES.has(o.type)) return;

    const at: Iso | undefined = o.timestamp;
    const type: string = o.type || 'unknown';

    try {
      switch (type) {
        case 'user': {
          const msg = o.message;
          if (msg && msg.content) {
            const text = partsText(msg.content);
            if (text.trim()) addMessage('user', text, at, o.uuid);
          }
          break;
        }

        case 'assistant': {
          const msg = o.message;
          if (msg && msg.content) {
            const content = msg.content;
            if (Array.isArray(content)) {
              for (const part of content) {
                if (part.type === 'text' && part.text) {
                  const m = ensureModel(at);
                  if (!m.text) m.text = '';
                  m.text += clean(part.text);
                } else if (part.type === 'tool_use' && part.name) {
                  addToolCall(part.id, part.name, JSON.stringify(part.input || {}), at);
                }
              }
            } else if (typeof content === 'string') {
              const m = ensureModel(at);
              m.text = clean(content);
            }

            if (msg.model) {
              settings.model = msg.model;
              if (model) model.model = msg.model;
            }
            if (msg.usage) {
              const usage = usageOf(msg.usage);
              if (usage) closeModel(at, usage);
            }
          }
          break;
        }

        case 'tool_result': {
          if (o.toolUseResult) {
            const result = o.toolUseResult;
            const text = partsText(result.content || result);
            const isError = result.isError === true || result.type === 'error';
            addToolOutput(result.tool_use_id, text, at, isError);
          }
          break;
        }

        default:
          note('type:' + type);
      }
    } catch (e) {
      note('parse-error:' + type);
    }
  }

  return {
    push(line: string) {
      if (!line || !line.trim()) return;
      let o: J;
      try {
        o = JSON.parse(line);
      } catch {
        skipped++;
        records++;
        return;
      }
      onRecord(o, records);
      records++;
    },

    finish(opts: FinishOptions): Session {
      if (model) closeModel(lastAt);
      for (const tool of Array.from(openTools.values())) {
        const t = turns.find((x) => x.steps.includes(tool));
        if (t && t.status === 'running') continue;
        settle(tool);
        closeTool(tool, tool.at);
      }

      const sourceId: string = sessionIdValue || (file.path ? basename(file.path).replace(/\.jsonl$/i, '') : 'unknown');
      const links: SessionLink[] = [];
      for (const [id, label] of children) links.push({ rel: 'child', id, label: oneLine(label, 80) });

      let firstUser = '';
      let messages = 0;
      let modelCalls = 0;
      let toolCalls = 0;
      let toolErrors = 0;
      let durationTotal = 0;
      for (const t of turns) {
        if (t.durationMs) durationTotal += t.durationMs;
        for (const s of t.steps) {
          if (s.kind === 'message') {
            messages++;
            if (s.role === 'user' && !firstUser) firstUser = s.text;
          } else if (s.kind === 'model') modelCalls++;
          else if (s.kind === 'tool') { toolCalls++; if (s.status === 'error') toolErrors++; }
        }
        if (!t.output) {
          const finals = t.steps.filter((s): s is ModelStep => s.kind === 'model' && Boolean(s.text));
          const f = finals[finals.length - 1];
          if (f?.text && t.status !== 'running') t.output = oneLine(f.text, 400);
        }
      }

      const startedAt = firstAt;
      let title = oneLine(firstUser, 80);
      if (!title) title = (cwd ? basename(cwd) : 'Claude Code') + (startedAt ? ' · ' + startedAt.slice(0, 16).replace('T', ' ') : '');

      // Normalize entrypoint to product name
      let originator: string | undefined;
      if (entrypoint === 'cli') originator = 'Claude CLI';
      else if (entrypoint === 'claude-vscode') originator = 'Claude VS Code';
      else if (entrypoint === 'claude-desktop') originator = 'Claude Desktop';

      const lastModel = [...turns].reverse().find((t) => t.settings?.model)?.settings?.model;
      const session: Session = {
        id: sessionId(CLAUDE_KIND, sourceId),
        sourceId,
        source: {
          kind: CLAUDE_KIND,
          format: 'claude-code/jsonl',
          adapter: CLAUDE_KIND + '@' + CLAUDE_ADAPTER_VERSION,
          ...(file.path ? { path: file.path } : {}),
          ...(file.size !== undefined ? { size: file.size } : {}),
          ...(file.mtimeMs !== undefined ? { mtimeMs: file.mtimeMs } : {}),
        },
        title,
        agent: {
          product: 'Claude Code',
          name: 'Claude Code',
          role: 'main',
          ...(originator ? { originator } : {}),
          ...(lastModel ? { model: lastModel } : {}),
        },
        ...(cwd ? { cwd } : {}),
        ...(startedAt ? { startedAt } : {}),
        ...(lastAt ? { updatedAt: lastAt } : {}),
        links,
        turns,
        ...(sessionUsage ? { usage: sessionUsage } : {}),
        state: { status: 'empty' },
        stats: {
          turns: turns.length,
          modelCalls,
          toolCalls,
          toolErrors,
          messages,
          compactions: 0,
          subagents: children.size,
          ...(durationTotal ? { durationMs: durationTotal } : {}),
          records,
          skipped,
        },
        notes: Array.from(unknown.entries()).sort((a, b) => b[1] - a[1]).map(([k, n]) => '未识别 ' + k + ' × ' + n),
      };

      // Simple state detection
      if (turns.length === 0) {
        session.state = { status: 'empty' };
      } else {
        const last = turns[turns.length - 1];
        if (last.status === 'running') {
          const stale = opts.now - (file.mtimeMs || Date.now());
          session.state = { status: stale > 300000 ? 'stale' : 'working', since: last.startedAt };
        } else if (last.status === 'completed') {
          session.state = { status: 'idle', since: last.endedAt };
        } else if (last.status === 'aborted') {
          session.state = { status: 'aborted', since: last.endedAt };
        } else {
          session.state = { status: 'failed', since: last.endedAt, detail: last.error };
        }
      }

      return session;
    },
  };
}

export { CONTRACT_VERSION };
