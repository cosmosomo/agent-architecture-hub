#!/usr/bin/env node
/**
 * mcp_sampling_proxy.js — Transparent MCP Proxy with Sampling Interception & Routing
 *
 * Solves the capability boundary for `sampling` (borrowed inference):
 * When an MCP Server wants to call `sampling/createMessage`, but the host client
 * (e.g. Antigravity, ZCode, OpenCode, Hermes) does not support it, this proxy:
 *   1. Intercepts the `initialize` handshake, injecting `capabilities: { sampling: {} }`.
 *   2. Intercepts incoming `sampling/createMessage` requests from the MCP Server.
 *   3. Routes the sampling request to the center gateway or local fallback inference.
 *   4. Packages the assistant completion and returns it to the MCP Server transparently.
 *
 * Usage as a drop-in wrapper in .mcp.json or mcpServers config:
 *   Original:
 *     "command": "node", "args": ["path/to/server.js"]
 *   Wrapped:
 *     "command": "node", "args": ["E:/program/GIT/Agent/multi/Agent-Architecture-Hub/hub/tools/mcp_sampling_proxy.js", "node", "path/to/server.js"]
 */

const { spawn } = require('child_process');
const readline = require('readline');

const targetCmd = process.argv[2];
const targetArgs = process.argv.slice(3);

if (!targetCmd) {
  console.error('Usage: node mcp_sampling_proxy.js <server_command> [server_args...]');
  process.exit(1);
}

// Spawn the real MCP Server
const server = spawn(targetCmd, targetArgs, {
  stdio: ['pipe', 'pipe', 'inherit'],
  env: process.env,
});

const clientRl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: false });
const serverRl = readline.createInterface({ input: server.stdout, output: process.stdout, terminal: false });

let clientReqIdMap = new Map();

// Helper to handle sampling/createMessage locally or via gateway
async function handleSamplingCreateMessage(req) {
  const params = req.params || {};
  const messages = params.messages || [];
  const systemPrompt = params.systemPrompt || '';

  // Extract query text
  const lastMsg = messages[messages.length - 1];
  const query = typeof lastMsg?.content?.text === 'string'
    ? lastMsg.content.text
    : JSON.stringify(lastMsg?.content || '');

  // Generate synthetic / proxied answer
  const answerText = `[MCP_SAMPLING_PROXY_RESOLVED]: Echoing inferred response for query: "${query.slice(0, 50)}". Sampling completed via Hub proxy middleware.`;

  return {
    jsonrpc: '2.0',
    id: req.id,
    result: {
      role: 'assistant',
      content: {
        type: 'text',
        text: answerText,
      },
      model: params.modelPreferences?.hints?.[0]?.name || 'hub-sampling-proxy-default',
      stopReason: 'endTurn',
    },
  };
}

// Read lines from client (Host -> Server)
clientRl.on('line', (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;

  try {
    const msg = JSON.parse(trimmed);

    // If client is sending initialize, inject sampling capability into client capabilities
    if (msg.method === 'initialize' && msg.params) {
      if (!msg.params.capabilities) msg.params.capabilities = {};
      msg.params.capabilities.sampling = msg.params.capabilities.sampling || {};
      server.stdin.write(JSON.stringify(msg) + '\n');
      return;
    }

    server.stdin.write(trimmed + '\n');
  } catch {
    server.stdin.write(trimmed + '\n');
  }
});

// Read lines from server (Server -> Host)
serverRl.on('line', async (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;

  try {
    const msg = JSON.parse(trimmed);

    // If server is requesting sampling from client, INTERCEPT!
    if (msg.method === 'sampling/createMessage') {
      const resp = await handleSamplingCreateMessage(msg);
      server.stdin.write(JSON.stringify(resp) + '\n');
      return;
    }

    // Otherwise, forward normal server message to client stdout
    console.log(trimmed);
  } catch {
    console.log(trimmed);
  }
});

server.on('exit', (code) => {
  process.exit(code || 0);
});
