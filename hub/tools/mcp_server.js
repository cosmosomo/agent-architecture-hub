#!/usr/bin/env node
/**
 * mcp_server.js — Model Context Protocol (MCP) Stdio Server for Agent-Architecture-Hub
 *
 * Connects any MCP-capable host (Claude Code, Codex, ZCode, WorkBuddy, Hermes, Antigravity, Cursor)
 * to the shared `:8899` Agent Control Room daemon (`http://127.0.0.1:8899`), ensuring humans in the
 * Web UI and external Agents operate on the exact same sessions, queues, approvals, and Meta-Agent Brain.
 *
 * Usage (MCP stdio config):
 *   command: "node"
 *   args: ["e:/program/GIT/Agent/multi/Agent-Architecture-Hub/hub/tools/mcp_server.js"]
 */
const readline = require('readline');

const DAEMON_BASE = process.env.HUB_DAEMON_URL || 'http://127.0.0.1:8899';

const TOOLS = [
  {
    name: 'hub_list_agents',
    description:
      'List all 7 live Agent channels in Agent-Architecture-Hub (codex, claude, zcode, workbuddy, opencode, antigravity, hermes), including their current running status, verified models, active runs, pending approvals, external session anomalies, and Meta-Agent Supervisor Brain state.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'hub_send_prompt',
    description:
      'Send a prompt to a target Agent channel and named session through the shared :8899 Control Room daemon. Visible in real-time in the Web Control Room and supervised by the Meta-Agent Brain.',
    inputSchema: {
      type: 'object',
      properties: {
        channel: {
          type: 'string',
          description: 'Target agent channel ID: codex | claude | zcode | workbuddy | opencode | antigravity | hermes',
        },
        sessionName: {
          type: 'string',
          description: 'Named session slot (e.g., "hub-zcode", "backend-fix"). Defaults to "hub-<channel>".',
        },
        prompt: {
          type: 'string',
          description: 'Instruction or message to send to the target Agent.',
        },
        model: {
          type: 'string',
          description: 'Optional verified model ID for the target channel.',
        },
        cwd: {
          type: 'string',
          description: 'Optional working directory path.',
        },
        permissions: {
          type: 'string',
          enum: ['all', 'reads', 'deny'],
          description: 'Tool permission policy (default: all).',
        },
        mode: {
          type: 'string',
          enum: ['send', 'queue', 'interrupt'],
          description: 'How to handle if target session is already running (queue or interrupt).',
        },
        wait: {
          type: 'boolean',
          description: 'If true (default), waits for the turn to complete and returns the full reply and tool trace.',
        },
      },
      required: ['channel', 'prompt'],
    },
  },
  {
    name: 'hub_read_session',
    description:
      'Read the conversation turns, reasoning thoughts, tool calls, and current status of any session in the Hub.',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: {
          type: 'string',
          description: 'Trace session ID (e.g., "acpx:...", "workbuddy:...", "hermes:...", "antigravity:...") or sessionName.',
        },
      },
      required: ['sessionId'],
    },
  },
  {
    name: 'hub_handoff_session',
    description:
      'Transfer recent conversation context and working directory from one Agent channel/session to another Agent channel for seamless multi-agent relay.',
    inputSchema: {
      type: 'object',
      properties: {
        fromChannel: { type: 'string', description: 'Source channel ID (e.g., codex).' },
        fromSessionName: { type: 'string', description: 'Source session name.' },
        toChannel: { type: 'string', description: 'Target channel ID (e.g., zcode, hermes, workbuddy).' },
        toModel: { type: 'string', description: 'Optional target model ID.' },
        customInstruction: { type: 'string', description: 'Handoff instruction for the receiving agent.' },
        wait: { type: 'boolean', description: 'Wait for the receiving agent to finish its first relay turn (default: true).' },
      },
      required: ['fromChannel', 'toChannel'],
    },
  },
  {
    name: 'hub_resume_session',
    description:
      'Trigger breakpoint self-healing resume on an interrupted or errored session.',
    inputSchema: {
      type: 'object',
      properties: {
        channel: { type: 'string', description: 'Channel ID.' },
        sessionName: { type: 'string', description: 'Session name.' },
        customHint: { type: 'string', description: 'Optional recovery hint.' },
      },
      required: ['channel'],
    },
  },
  {
    name: 'hub_meta_patrol',
    description:
      'Wake up the Meta-Agent Supervisor Brain (meta-brain-supervisor) to inspect and diagnose a channel/session and return a structured JSON verdict.',
    inputSchema: {
      type: 'object',
      properties: {
        targetChannel: { type: 'string', description: 'Channel to inspect (default: codex).' },
        targetSession: { type: 'string', description: 'Session name to inspect.' },
        errorSummary: { type: 'string', description: 'Description of the anomaly or inspection focus.' },
      },
    },
  },
];

async function callDaemon(apiPath, method = 'GET', body = null) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body !== null) opts.body = JSON.stringify(body);
  const res = await fetch(`${DAEMON_BASE}${apiPath}`, opts);
  return await res.json();
}

async function handleToolCall(name, args = {}) {
  if (name === 'hub_list_agents') {
    const state = await callDaemon('/api/gateway/state', 'GET');
    return {
      ok: true,
      channels: (state.channels || []).map((c) => ({
        id: c.id,
        label: c.label,
        status: c.status,
        currentModel: c.currentModel,
        recommendedModels: c.recommendedModels,
        currentCwd: c.currentCwd,
        activeRuns: c.activeRuns,
        queuedCount: c.queuedCount,
      })),
      activeRuns: state.activeRuns || [],
      pendingApprovals: state.pendingApprovals || [],
      externalAnomalies: state.externalAnomalies || [],
      metaAgents: state.metaAgents || [],
    };
  }
  if (name === 'hub_send_prompt') {
    return await callDaemon('/api/gateway/send', 'POST', {
      channel: args.channel,
      sessionName: args.sessionName,
      prompt: args.prompt,
      model: args.model,
      cwd: args.cwd,
      permissions: args.permissions || 'all',
      mode: args.mode || 'send',
      source: 'cli',
      wait: args.wait !== false,
    });
  }
  if (name === 'hub_read_session') {
    const sid = String(args.sessionId || '').trim();
    const state = await callDaemon('/api/gateway/state', 'GET');
    const matched = (state.acpxSessions || []).find(
      (s) => s.traceSessionId === sid || s.sessionName === sid || s.acpxRecordId === sid
    );
    const traceId = matched ? matched.traceSessionId : sid;
    return await callDaemon(`/api/trace/sessions/${encodeURIComponent(traceId)}`, 'GET');
  }
  if (name === 'hub_handoff_session') {
    return await callDaemon('/api/gateway/handoff', 'POST', {
      fromChannel: args.fromChannel,
      fromSessionName: args.fromSessionName,
      toChannel: args.toChannel,
      toModel: args.toModel,
      customInstruction: args.customInstruction,
      wait: args.wait !== false,
    });
  }
  if (name === 'hub_resume_session') {
    return await callDaemon('/api/gateway/resume', 'POST', {
      channel: args.channel,
      sessionName: args.sessionName,
      customHint: args.customHint,
    });
  }
  if (name === 'hub_meta_patrol') {
    return await callDaemon('/api/gateway/meta-agents/patrol', 'POST', {
      targetChannel: args.targetChannel || 'codex',
      targetSession: args.targetSession || 'hub-codex',
      errorSummary: args.errorSummary || 'MCP client requested Meta-Agent Supervisor inspection',
    });
  }
  throw new Error(`Unknown MCP tool: ${name}`);
}

function sendJsonRpc(msg) {
  process.stdout.write(JSON.stringify(msg) + '\n');
}

const rl = readline.createInterface({ input: process.stdin, terminal: false });
rl.on('line', async (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;
  let req;
  try {
    req = JSON.parse(trimmed);
  } catch {
    return;
  }
  const { id, method, params } = req;
  if (id === undefined) return; // Notification

  try {
    if (method === 'initialize') {
      sendJsonRpc({
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion: '2024-11-05',
          capabilities: { tools: {} },
          serverInfo: {
            name: 'agent-architecture-hub-control-room',
            version: '1.0.0',
          },
        },
      });
    } else if (method === 'tools/list') {
      sendJsonRpc({
        jsonrpc: '2.0',
        id,
        result: { tools: TOOLS },
      });
    } else if (method === 'tools/call') {
      const res = await handleToolCall(params?.name, params?.arguments || {});
      sendJsonRpc({
        jsonrpc: '2.0',
        id,
        result: {
          content: [{ type: 'text', text: JSON.stringify(res, null, 2) }],
        },
      });
    } else if (method === 'ping') {
      sendJsonRpc({ jsonrpc: '2.0', id, result: {} });
    } else {
      sendJsonRpc({
        jsonrpc: '2.0',
        id,
        error: { code: -32601, message: `Method not found: ${method}` },
      });
    }
  } catch (err) {
    sendJsonRpc({
      jsonrpc: '2.0',
      id,
      result: {
        isError: true,
        content: [{ type: 'text', text: JSON.stringify({ ok: false, error: err.message }) }],
      },
    });
  }
});
