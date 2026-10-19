/**
 * Claude Code session records (`~/.claude/projects/<encoded-path>/*.jsonl`) to the trace contract.
 *
 * Record shapes verified against a real ~/.claude/projects (field names, not content):
 * - user/assistant entries carry `message.content`: a string, or a list of typed blocks
 *   ({type:'text'}, {type:'thinking', thinking}, {type:'tool_use', id, name, input}).
 *   Tool results come back inside USER entries as {type:'tool_result', tool_use_id, content,
 *   is_error} blocks — there is no top-level tool_result record.
 * - meta records around them: custom-title (customTitle), ai-title (aiTitle), agent-name
 *   (agentName), cost-state (totalCostUSD, totalLinesAdded/Removed, modelUsage), permission-mode,
 *   attachment (queued_command carries a message the user typed while the agent was busy).
 * - forks copy earlier records in, so a file can hold several sessionIds; the file is still
 *   one session timeline. isSidechain entries are a different thread in the same file and are
 *   skipped (counted, not silent).
 *
 * Unknown record kinds are counted into `notes`, never dropped silently.
 * The turn/model/tool lifecycle lives in ../turns.ts; this file only maps records.
 */
import {
  CONTRACT_VERSION,
  sessionId,
  type AdapterCapabilities,
  type Iso,
  type ModelStep,
  type Session,
  type ToolFamily,
  type Usage,
} from '@hub-trace/contract';
import type { FinishOptions, LineParser, SourceFile } from '../types.ts';
import { clean, oneLine } from '../text.ts';
import { basename, titleFallback, TurnBuilder } from '../turns.ts';
import { detectState } from '../state.ts';

export const CLAUDE_KIND = 'claude-code';
export const CLAUDE_ADAPTER_VERSION = '0.2.5';

export const CLAUDE_CAPABILITIES: AdapterCapabilities = {
  observe_only: true,
  control_lifecycle: { start: true, resume: true, fork: true, stop: true },
  steer_in_turn: { in_turn: true, next_turn: true, inbox_file: true },
  coordinate_team: { spawn_subagent: true, peer_message: true, task_board: true },
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type J = any;

const AGENT_TOOLS = new Set(['Task', 'Agent', 'spawn_agent', 'send_message']);
const SHELL_TOOLS = new Set(['Bash', 'execute_bash', 'PowerShell']);
const PATCH_TOOLS = new Set(['str_replace', 'str_replace_editor', 'fs_write', 'Edit', 'Write', 'MultiEdit', 'NotebookEdit']);
const WEB_TOOLS = new Set(['WebFetch', 'WebSearch', 'web_search', 'WebSearchTool']);
const PLAN_TOOLS = new Set(['TodoWrite', 'ExitPlanMode', 'EnterWorktree', 'ExitWorktree']);
/** Client-injected wrappers, not words the user typed: shown as context, not as turn input. */
const CONTEXT_PREFIX = /^\s*<(command-name|command-message|command-args|local-command|task-notification|system-reminder|bash-input|bash-stdout)/;
/** Records that carry metadata only; counted so the parser stays honest without flooding notes. */
const KNOWN_META = new Set(['system', 'progress', 'queue-operation', 'file-history-snapshot', 'file-history-delta', 'last-prompt', 'atis-latch', 'mode', 'permission-mode', 'relocated', 'bridge-session', 'isolation-latch', 'summary',
  // Session links and watches the desktop app records (10-19): a pull request, a frame, an artifact being watched.
  'pr-link', 'frame-link', 'artifact-comment-monitor']);
/** Attachments the client injects around a turn (environment, snapshots, listings); context, not conversation.
 *  The full list comes from a census of a real ~/.claude/projects (2026-10). */
const KNOWN_ATTACHMENTS = new Set(['session_context', 'date', 'date_change', 'environment', 'prompt_snapshot', 'instructions', 'model', 'skill_listing', 'agent_listing_delta', 'total_tokens_reminder', 'remote_session_change', 'mcp_instructions_delta', 'auto_mode', 'deferred_tools_record', 'deferred_tools_delta', 'silent_turn_reminder', 'output_style', 'edited_text_file', 'hook_success', 'hook_additional_context', 'file', 'directory', 'compact_file_reference', 'task_reminder', 'task_status', 'thinking_drop', 'credential_org', 'read_truncation_notice', 'command_permissions', 'plan_mode', 'plan_mode_exit', 'budget_usd', 'nested_memory', 'thinking_stripped', 'output_style_instructions', 'diagnostics',
  // Skill text re-injected after a compaction, and the reminder added when a message names a skill (10-19).
  'invoked_skills', 'skill_mention']);

export function toolFamily(name: string): ToolFamily {
  if (PATCH_TOOLS.has(name)) return 'patch';
  if (PLAN_TOOLS.has(name)) return 'plan';
  if (AGENT_TOOLS.has(name)) return 'agent';
  if (SHELL_TOOLS.has(name)) return 'shell';
  if (name.startsWith('mcp__')) return 'mcp';
  if (WEB_TOOLS.has(name)) return 'web';
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
  return Object.keys(out).length ? out : undefined;
}

/** Text of a tool_result block's content: a string, or a list of text/image parts. */
function resultText(content: J, fallback: J): string {
  let out = '';
  if (typeof content === 'string') out = content;
  else if (Array.isArray(content)) {
    const parts: string[] = [];
    for (const c of content) {
      if (typeof c === 'string') { parts.push(c); continue; }
      if (c && typeof c === 'object' && typeof c.text === 'string') parts.push(c.text);
      else if (c && typeof c === 'object' && /image/i.test(String(c.type))) parts.push('[图片]');
    }
    out = parts.join('\n');
  }
  if (!out && fallback != null) {
    if (typeof fallback === 'string') out = fallback;
    else if (typeof fallback.stdout === 'string') out = fallback.stdout + (fallback.stderr ? '\n' + fallback.stderr : '');
    else if (typeof fallback === 'object') out = JSON.stringify(fallback);
  }
  return out;
}

function queuedPrompt(q: J): string {
  const p = q?.queuedCommand?.prompt ?? q?.prompt;
  if (typeof p === 'string') return p;
  if (Array.isArray(p)) return p.map((x: J) => (typeof x?.text === 'string' ? x.text : typeof x === 'string' ? x : '')).filter(Boolean).join('\n');
  return '';
}

export function createClaudeParser(file: SourceFile): LineParser {
  let records = 0;
  let skipped = 0;

  const B = new TurnBuilder({ userStartsTurn: true, turnForInferred: false });
  let firstRealUser = '';   // a queued message is real, but not what the session was about

  let sessionIdValue: string | undefined;
  let entrypoint: string | undefined;
  let cliVersion: string | undefined;
  let cwd: string | undefined;
  let customTitle = '';
  let aiTitle = '';
  let agentName = '';
  let cost: { usd?: number; linesAdded?: number; linesRemoved?: number } = {};
  let sessionUsage: Usage | undefined;
  let usageSum: Usage | undefined; // added up per model call until cost-state replaces it
  const agentToolCalls = new Set<string>();

  function onRecord(o: J) {
    B.stamp(typeof o.timestamp === 'string' ? o.timestamp : undefined);
    if (!sessionIdValue && typeof o.sessionId === 'string') sessionIdValue = o.sessionId;
    if (!entrypoint && typeof o.entrypoint === 'string') entrypoint = o.entrypoint;
    if (!cliVersion && typeof o.version === 'string') cliVersion = o.version;
    if (!cwd && typeof o.cwd === 'string') cwd = o.cwd;

    // a different thread inside the same file (sub-agent sidechain): another timeline, not ours
    if (o.isSidechain === true || o.isMeta === true) return;

    const at: Iso | undefined = typeof o.timestamp === 'string' ? o.timestamp : undefined;
    const type: string = o.type || 'unknown';

    try {
      switch (type) {
        case 'user': {
          const content = o.message?.content;
          if (Array.isArray(content)) {
            const texts: string[] = [];
            for (const b of content) {
              if (!b || typeof b !== 'object') continue;
              if (b.type === 'text' && typeof b.text === 'string') texts.push(b.text);
              else if (b.type === 'tool_result') {
                const isError = b.is_error === true || b.isError === true || o.toolUseResult?.is_error === true || o.toolUseResult?.type === 'error';
                B.addToolOutput({ callId: typeof b.tool_use_id === 'string' ? b.tool_use_id : undefined, output: resultText(b.content, o.toolUseResult), at, isError });
              } else if (b.type === 'image') texts.push('[图片]');
            }
            const text = texts.join('\n').trim();
            if (text) {
              const role = CONTEXT_PREFIX.test(text) ? 'context' : 'user';
              B.addMessage(role, text, at, o.uuid);
              if (role === 'user' && !text.startsWith('[排队] ') && !firstRealUser) firstRealUser = text;
            }
          } else if (typeof content === 'string' && content.trim()) {
            B.addMessage(CONTEXT_PREFIX.test(content) ? 'context' : 'user', content, at, o.uuid);
            if (!CONTEXT_PREFIX.test(content) && !firstRealUser) firstRealUser = content;
          }
          return;
        }

        case 'assistant': {
          const msg = o.message;
          if (!msg || typeof msg !== 'object') return;
          if (typeof msg.model === 'string') {
            B.settings = { ...B.settings, model: msg.model };
            if (B.model) B.model.model = msg.model;
          }
          const content = msg.content;
          if (Array.isArray(content)) {
            for (const b of content) {
              if (!b || typeof b !== 'object') continue;
              if (b.type === 'text' && b.text) {
                const m = B.ensureModel(at);
                m.text = m.text ? m.text + '\n\n' + clean(b.text) : clean(b.text);
              } else if (b.type === 'thinking' && typeof b.thinking === 'string' && b.thinking.trim()) {
                const m = B.ensureModel(at);
                m.reasoning = m.reasoning ? m.reasoning + '\n\n' + clean(b.thinking) : clean(b.thinking);
              } else if (b.type === 'tool_use' && b.name) {
                const tool = B.addToolCall({ callId: typeof b.id === 'string' ? b.id : undefined, name: b.name, family: toolFamily(b.name), input: JSON.stringify(b.input || {}), at });
                if (tool.family === 'agent') agentToolCalls.add(tool.id);
              }
            }
          } else if (typeof content === 'string' && content.trim()) {
            const m = B.ensureModel(at);
            m.text = clean(content);
          }
          const usage = usageOf(msg.usage);
          if (usage) {
            B.closeModel(at, usage);
            usageSum = addUsage(usageSum, usage);
          }
          return;
        }

        case 'attachment': {
          const a = o.attachment;
          if (a?.type === 'queued_command') {
            const text = queuedPrompt(a);
            if (text.trim()) B.addMessage('user', '[排队] ' + text, at, o.uuid);
          } else if (!KNOWN_ATTACHMENTS.has(String(a?.type))) B.note('attachment:' + String(a?.type));
          return;
        }

        case 'custom-title':
          if (!customTitle && typeof o.customTitle === 'string') customTitle = o.customTitle;
          return;
        case 'ai-title':
          if (!aiTitle && typeof o.aiTitle === 'string') aiTitle = o.aiTitle;
          return;
        case 'agent-name':
          if (!agentName && typeof o.agentName === 'string') agentName = o.agentName;
          return;

        case 'cost-state': {
          const usd = Number(o.totalCostUSD);
          if (Number.isFinite(usd) && usd > 0) cost.usd = usd;
          const la = Number(o.totalLinesAdded), lr = Number(o.totalLinesRemoved);
          if (Number.isFinite(la)) cost.linesAdded = la;
          if (Number.isFinite(lr)) cost.linesRemoved = lr;
          const mu = o.modelUsage;
          if (mu && typeof mu === 'object') {
            const sum: Usage = {};
            for (const k of Object.keys(mu)) {
              const v = mu[k] || {};
              sum.input = (sum.input || 0) + (Number(v.inputTokens) || 0);
              sum.output = (sum.output || 0) + (Number(v.outputTokens) || 0);
              sum.cachedInput = (sum.cachedInput || 0) + (Number(v.cacheReadTokens) || Number(v.cacheReadInputTokens) || 0);
              sum.cacheWrite = (sum.cacheWrite || 0) + (Number(v.cacheCreationInputTokens) || 0);
            }
            if (sum.input || sum.output) sessionUsage = sum;
          }
          return;
        }

        case 'permission-mode':
          if (typeof o.permissionMode === 'string') B.settings = { ...B.settings, approval: o.permissionMode };
          return;

        case 'summary':
          // the file starts with a summary of an earlier context: the same continuation a compaction is
          B.addEvent('compaction', at, '会话带着上一次的摘要继续');
          return;

        default:
          if (!KNOWN_META.has(type)) B.note('type:' + type);
      }
    } catch {
      B.note('parse-error:' + type);
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
      onRecord(o);
      records++;
    },

    finish(opts: FinishOptions): Session {
      B.finishPending();

      // The file name is the session's own id. A fork copies the parent's records in with the parent's sessionId,
      // so the first sessionId seen is the parent's, not this session's.
      const fileId = file.path ? basename(file.path).replace(/\.jsonl$/i, '') : '';
      const sourceId: string = (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(fileId) ? fileId : '') || sessionIdValue || fileId || 'unknown';
      const f = B.fold();
      if (!sessionUsage && usageSum) sessionUsage = usageSum;

      const startedAt = B.firstAt;
      const title = titleFallback([customTitle, aiTitle, agentName, firstRealUser || f.firstUser], cwd, startedAt, 'Claude Code');

      let originator: string | undefined;
      if (entrypoint === 'cli') originator = 'Claude CLI';
      else if (entrypoint === 'claude-vscode') originator = 'Claude VS Code';
      else if (entrypoint === 'claude-desktop') originator = 'Claude Desktop';
      else if (entrypoint) originator = oneLine(entrypoint, 40);

      const lastModel = [...B.turns].reverse().find((t) => t.settings?.model)?.settings?.model || B.settings.model;
      const session: Session = {
        id: sessionId(CLAUDE_KIND, sourceId),
        sourceId,
        source: {
          kind: CLAUDE_KIND,
          format: 'claude-code/jsonl',
          adapter: CLAUDE_KIND + '@' + CLAUDE_ADAPTER_VERSION,
          ...(cliVersion ? { version: cliVersion } : {}),
          ...(file.path ? { path: file.path } : {}),
          ...(file.size !== undefined ? { size: file.size } : {}),
          ...(file.mtimeMs !== undefined ? { mtimeMs: file.mtimeMs } : {}),
        },
        title,
        agent: {
          product: 'Claude Code',
          name: agentName || 'Claude Code',
          role: 'main',
          ...(originator ? { originator } : {}),
          ...(lastModel ? { model: lastModel } : {}),
        },
        ...(cwd ? { cwd } : {}),
        ...(startedAt ? { startedAt } : {}),
        ...(B.lastAt ? { updatedAt: B.lastAt } : {}),
        links: [],
        turns: B.turns,
        ...(sessionUsage ? { usage: sessionUsage } : {}),
        capabilities: CLAUDE_CAPABILITIES,
        state: { status: 'empty' },
        stats: {
          turns: B.turns.length,
          modelCalls: f.modelCalls,
          toolCalls: f.toolCalls,
          toolErrors: f.toolErrors,
          messages: f.messages,
          compactions: f.compactions,
          subagents: agentToolCalls.size,
          ...(f.durationTotal ? { durationMs: f.durationTotal } : {}),
          ...(cost.usd !== undefined ? { costUsd: cost.usd } : {}),
          ...(cost.linesAdded !== undefined ? { linesAdded: cost.linesAdded } : {}),
          ...(cost.linesRemoved !== undefined ? { linesRemoved: cost.linesRemoved } : {}),
          records,
          skipped,
        },
        notes: B.notes(),
      };
      session.state = detectState(session, { now: opts.now, mtimeMs: file.mtimeMs, staleMs: opts.staleMs, openTools: Array.from(B.openTools.values()) });
      return session;
    },
  };
}

function addUsage(a: Usage | undefined, b: Usage): Usage {
  const out: Usage = { ...a };
  for (const k of ['input', 'cachedInput', 'cacheWrite', 'output', 'reasoning'] as const) {
    if (typeof b[k] === 'number') out[k] = (out[k] || 0) + b[k];
  }
  return out;
}

export { CONTRACT_VERSION };
