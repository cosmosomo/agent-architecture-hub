#!/usr/bin/env node
/**
 * agent_gateway.js — Unified Cross-Agent Execution Gateway for Agent-Architecture-Hub
 *
 * Architecture:
 *   - Primary execution substrate: `openclaw/acpx` (v0.19.5+) over Agent Client Protocol (ACP)
 *     covering `codex`, `claude`, `zcode`, `workbuddy`, `opencode`, `droid`, `gemini`.
 *   - Secondary desktop UI substrate: `opencli` (CDP) for `antigravity` (:9234) and `doubao-desktop` (:9225).
 *   - Governance & Pre-flight layer: `channels/BOARD.md` + `channels/hosts/*.md`
 *     (enforces status lights 🟢/🟡/🔴/🔒, holder locks, proxy injection, and model red lines).
 *
 * Security Red Lines:
 *   - Never reads or echoes raw API keys from `_private/凭证.md`, `.env`, `cc-switch.db`, or `models.json`.
 *   - Never kills or restarts user desktop apps (`Doubao`, `ZCode`, `Antigravity`).
 *
 * Usage:
 *   node hub/tools/agent_gateway.js targets [--json]
 *   node hub/tools/agent_gateway.js status --agent <id> [--session <name>]
 *   node hub/tools/agent_gateway.js run --agent <id> [--session <name>] [--model <m>] [--permissions read|all|deny] [--prompt <text> | --file <path>]
 *   node hub/tools/agent_gateway.js cancel --agent <id> [--session <name>]
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, spawnSync } = require('child_process');

const ROOT_DIR = path.resolve(__dirname, '..', '..');
const CHANNELS_DIR = path.join(ROOT_DIR, 'channels');
const HOSTS_DIR = path.join(CHANNELS_DIR, 'hosts');
const HOME = os.homedir();

/**
 * The products come from the product table, hub/data/products.json: the one list of products, shared with the
 * backend (trace/apps/cli/src/gateway.ts). Every alias there resolves to its product here. Only Claude's provider
 * variables stay code (claudeProviderEnv, read at launch).
 */
const PRODUCT_TABLE = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'hub', 'data', 'products.json'), 'utf8'));
const DRIVER_OF_ROUTE = { acpx: 'acpx', agentapi: 'agy-agentapi', opencli: 'opencli-cdp' };
const AGENT_PROFILES = {};
for (const p of PRODUCT_TABLE.products) {
  const env = () => {
    const out = Object.fromEntries(Object.entries(p.env || {}).map(([k, v]) => [k, v.split('{HOME}').join(HOME)]));
    return p.envFrom === 'claude-settings' ? { ...out, ...claudeProviderEnv() } : out;
  };
  AGENT_PROFILES[p.id] = {
    id: p.id,
    name: p.name,
    acpxAgent: p.acpxAgent,
    hostCard: p.hostCard,
    driver: DRIVER_OF_ROUTE[p.route] || p.route,
    adapterPackage: p.adapter,
    cdpPort: p.cdpPort,
    defaultModel: p.defaultModel,
    recommendedModels: p.models || [],
    forbiddenModels: p.forbiddenModels || [],
    buildEnv: env,
    injectedEnvKeys: [...Object.keys(p.env || {}), ...(p.envFrom === 'claude-settings' ? ['ANTHROPIC_* (from ~/.claude/settings.json)'] : [])],
    notes: p.notes,
  };
  for (const a of p.aliases || []) AGENT_PROFILES[a] = { aliasOf: p.id };
}

function resolveProfile(agentName) {
  if (!agentName) return null;
  const key = String(agentName).trim().toLowerCase();
  const entry = AGENT_PROFILES[key];
  if (!entry) return null;
  if (entry.aliasOf) return AGENT_PROFILES[entry.aliasOf];
  return entry;
}

function readHostCardMeta(cardFile) {
  if (!cardFile) return null;
  const full = path.join(HOSTS_DIR, cardFile);
  if (!fs.existsSync(full)) return null;
  const text = fs.readFileSync(full, 'utf8');
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  if (!m) return null;
  const meta = {};
  for (const line of m[1].split(/\r?\n/)) {
    if (/^\s+/.test(line)) continue;
    const idx = line.indexOf(':');
    if (idx <= 0) continue;
    const k = line.slice(0, idx).trim();
    const v = line.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
    meta[k] = v;
  }
  return meta;
}

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const tok = argv[i];
    if (tok.startsWith('--')) {
      const key = tok.slice(2);
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith('--')) {
        args[key] = next;
        i++;
      } else {
        args[key] = true;
      }
    } else {
      args._.push(tok);
    }
  }
  return args;
}

// acpx --format json prints every session/update frame; a long agent turn easily passes Node's
// default 1 MB maxBuffer, at which point spawnSync kills acpx mid-turn (seen 2026-10-17 at ~1.07 MB).
const MAX_OUTPUT_BYTES = 512 * 1024 * 1024;

// Variables a Claude host (Claude Code, the desktop app) puts into processes it starts. Passed on, a Claude
// launched from here fails to log in ("Authentication required"); removed for every agent (2026-10-18).
const HOST_ENV = /^(CLAUDECODE$|CLAUDE_|ANTHROPIC_)/;
function agentBaseEnv() {
  const env = {};
  for (const [k, v] of Object.entries(process.env)) if (!HOST_ENV.test(k)) env[k] = v;
  return env;
}

// Claude Code's relay address and token live in ~/.claude/settings.json; read at launch, given to this one
// process only, never written or logged.
function claudeProviderEnv() {
  const env = { HTTP_PROXY: 'http://127.0.0.1:7892', HTTPS_PROXY: 'http://127.0.0.1:7892' };
  if (process.env.HUB_CLAUDE_USER_SETTINGS === '1') return { ...env, ACPX_CLAUDE_INCLUDE_USER_SETTINGS: '1' };
  try {
    const settings = JSON.parse(fs.readFileSync(path.join(os.homedir(), '.claude', 'settings.json'), 'utf8'));
    for (const [k, v] of Object.entries((settings && settings.env) || {})) {
      if (/^ANTHROPIC_/.test(k) && typeof v === 'string') env[k] = v;
    }
  } catch {}
  return env;
}

// Same rule as judgeAcpxTurn in trace/apps/cli/src/gateway.ts: the turn's stopReason decides, and other
// error frames are only warnings (Hermes reports one on resume while still answering correctly).
function standaloneTurnOk(exitCode, parsed) {
  const stop = parsed.stopReason;
  // Codex prints an upstream 5xx as its reply after its own retries and still ends with end_turn.
  if (/^\s*unexpected status \d{3}/i.test(String(parsed.reply || ''))) return false;
  if (stop === 'end_turn' || stop === 'max_tokens' || stop === 'max_turn_requests') return true;
  if (stop === 'cancelled') return Boolean(parsed.reply && String(parsed.reply).trim());
  if (stop === 'refusal') return false;
  return exitCode === 0 && !parsed.error;
}

function runCommandSync(cmd, cmdArgs, extraEnv, timeoutMs = 120000) {
  const isWin = process.platform === 'win32';
  const env = { ...agentBaseEnv(), ...extraEnv };
  const startedAt = Date.now();
  const res = isWin
    ? spawnSync('cmd.exe', ['/d', '/s', '/c', [cmd, ...cmdArgs.map(quoteWinArg)].join(' ')], {
        cwd: ROOT_DIR,
        env,
        encoding: 'utf8',
        timeout: timeoutMs,
        maxBuffer: MAX_OUTPUT_BYTES,
        windowsHide: true,
      })
    : spawnSync(cmd, cmdArgs, {
        cwd: ROOT_DIR,
        env,
        encoding: 'utf8',
        timeout: timeoutMs,
        maxBuffer: MAX_OUTPUT_BYTES,
      });
  return {
    exitCode: res.status ?? 1,
    stdout: (res.stdout || '').trim(),
    stderr: (res.stderr || '').trim(),
    error: res.error ? res.error.message : null,
    durationMs: Date.now() - startedAt,
  };
}

function quoteWinArg(a) {
  const s = String(a);
  if (!/[\s"&|<>^()]/.test(s)) return s;
  return '"' + s.replace(/"/g, '\\"') + '"';
}

function parseAcpxNdjson(stdout, stderr) {
  const events = [];
  const textChunks = [];
  let stopReason = null;
  let usage = null;
  let acpxSessionId = null;
  let acpxRecordId = null;
  let errorObj = null;

  for (const line of stdout.split(/\r?\n/).filter(Boolean)) {
    try {
      const obj = JSON.parse(line);
      events.push(obj);
      if (obj.action === 'session_ensured' || obj.acpxSessionId) {
        acpxSessionId = obj.acpxSessionId || acpxSessionId;
        acpxRecordId = obj.acpxRecordId || acpxRecordId;
      }
      if (obj.method === 'session/update' && obj.params && obj.params.update) {
        const u = obj.params.update;
        if (u.sessionUpdate === 'agent_message_chunk' && u.content && u.content.type === 'text') {
          textChunks.push(u.content.text || '');
        }
        if (u.sessionUpdate === 'usage_update') {
          usage = { used: u.used, size: u.size };
        }
      }
      if (obj.result && obj.result.stopReason) {
        stopReason = obj.result.stopReason;
        if (obj.result._meta && obj.result._meta.usage) {
          usage = obj.result._meta.usage;
        }
      }
      if (obj.error) {
        errorObj = obj.error;
      }
    } catch {
      // Non-JSON line
      textChunks.push(line);
    }
  }
  return {
    reply: textChunks.join('').trim(),
    stopReason,
    usage,
    acpxSessionId,
    acpxRecordId,
    error: errorObj,
    stderrInfo: stderr || null,
    eventCount: events.length,
  };
}

function cmdTargets(args) {
  const rows = [];
  for (const [k, prof] of Object.entries(AGENT_PROFILES)) {
    if (prof.aliasOf) continue;
    const card = readHostCardMeta(prof.hostCard) || {};
    rows.push({
      id: prof.id,
      driver: prof.driver,
      adapter: prof.adapterPackage || `CDP:${prof.cdpPort}`,
      boardStatus: card.status || 'unknown',
      holder: card.holder || 'shared',
      verifiedVersion: card.verified_version || '-',
      defaultModel: prof.defaultModel || '-',
      injectedEnvKeys: prof.injectedEnvKeys,
      notes: prof.notes,
    });
  }
  if (args.json) {
    console.log(JSON.stringify({ ok: true, count: rows.length, targets: rows }, null, 2));
    return;
  }
  console.log('=== Agent-Architecture-Hub Unified Agent Gateway Targets ===');
  for (const r of rows) {
    console.log(
      `  - [${r.id.padEnd(14)}] driver=${r.driver.padEnd(11)} status=${r.boardStatus.padEnd(20)} holder=${r.holder.padEnd(11)} model=${r.defaultModel}`
    );
  }
}

function preflightCheck(prof, args) {
  const card = readHostCardMeta(prof.hostCard) || {};
  const status = card.status || '';
  if (status.includes('blocked_down') || status.includes('auth_wall')) {
    return {
      ok: false,
      code: 'CHANNEL_BLOCKED',
      message: `Target agent '${prof.id}' is marked '${status}' in channels/hosts/${prof.hostCard}. Refusing execution per BOARD.md red lines.`,
    };
  }
  if (card.holder === 'user-active' && !args['allow-user-active']) {
    return {
      ok: false,
      code: 'USER_ACTIVE_LOCK',
      message: `Target agent '${prof.id}' has holder='user-active' in channels/hosts/${prof.hostCard}. Pass --allow-user-active only when explicitly authorized by the user.`,
    };
  }
  const model = args.model || prof.defaultModel;
  if (model && prof.forbiddenModels.some((bad) => String(model).toLowerCase().includes(bad.toLowerCase()))) {
    return {
      ok: false,
      code: 'FORBIDDEN_MODEL',
      message: `Model '${model}' is forbidden for agent '${prof.id}' per channels/BOARD.md red lines.`,
    };
  }
  return { ok: true, card, model };
}

function discoverAntigravityLs() {
  const lsBin = path.join(
    process.env.LOCALAPPDATA || path.join(HOME, 'AppData', 'Local'),
    'Programs',
    'antigravity',
    'resources',
    'bin',
    'language_server.exe'
  );
  if (process.env.ANTIGRAVITY_LS_ADDRESS && process.env.ANTIGRAVITY_CSRF_TOKEN) {
    const portMatch = String(process.env.ANTIGRAVITY_LS_ADDRESS).match(/:(\d+)$/);
    return {
      ok: true,
      lsBin,
      address: process.env.ANTIGRAVITY_LS_ADDRESS,
      port: portMatch ? Number(portMatch[1]) : null,
      csrfToken: process.env.ANTIGRAVITY_CSRF_TOKEN,
    };
  }
  const psScript =
    "$p = Get-CimInstance Win32_Process -Filter \"Name = 'language_server.exe'\" | Select-Object -First 1; " +
    'if (-not $p) { exit 1 }; ' +
    "$csrf = [regex]::Match($p.CommandLine, '--csrf_token\\s+([a-f0-9-]+)').Groups[1].Value; " +
    '$ports = (Get-NetTCPConnection -OwningProcess $p.ProcessId -State Listen -ErrorAction SilentlyContinue).LocalPort | Sort-Object -Unique; ' +
    'Write-Output ("$($p.ProcessId)|$csrf|" + ($ports -join ","))';
  const res = spawnSync('powershell.exe', ['-NoProfile', '-Command', psScript], {
    encoding: 'utf8',
    timeout: 6000,
    windowsHide: true,
  });
  if (res.status !== 0 || !res.stdout.trim()) {
    return { ok: false, lsBin, error: 'language_server.exe process not found' };
  }
  const [pidStr, csrfToken, portsStr] = res.stdout.trim().split('|');
  const ports = (portsStr || '')
    .split(',')
    .map((x) => Number(x.trim()))
    .filter(Boolean);
  // The LS listens on an HTTPS (gRPC) port and a plain-HTTP (Connect-RPC) port; order is not stable,
  // so pick the one that answers GET /healthz over plain HTTP.
  const httpPort =
    ports.find((p) => {
      const h = spawnSync('curl.exe', ['-s', '--max-time', '2', `http://127.0.0.1:${p}/healthz`], {
        encoding: 'utf8',
        timeout: 3000,
        windowsHide: true,
      });
      return /"status"\s*:\s*"ok"/.test(h.stdout || '');
    }) || null;
  if (!csrfToken || !httpPort) {
    return { ok: false, lsBin, error: 'Failed to parse CSRF token or listening port from language_server.exe' };
  }
  return {
    ok: true,
    pid: Number(pidStr),
    lsBin,
    address: `localhost:${httpPort}`,
    port: httpPort,
    csrfToken,
  };
}

/**
 * Since AGY 2.23.1 `agentapi new-conversation` fails with "project_id is required" unless
 * ANTIGRAVITY_PROJECT_ID is set (the sidecar SDK passes it the same way). Pick the registered
 * project in ~/.gemini/config/projects whose folder contains cwd (longest match), else
 * "outside-of-project".
 */
function resolveAntigravityProjectId(cwd) {
  if (process.env.ANTIGRAVITY_PROJECT_ID) return process.env.ANTIGRAVITY_PROJECT_ID;
  const norm = (p) => p.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
  const target = norm(path.resolve(cwd));
  const dir = path.join(HOME, '.gemini', 'config', 'projects');
  let best = { id: 'outside-of-project', len: 0 };
  let files = [];
  try {
    files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
  } catch {}
  for (const f of files) {
    let proj;
    try {
      proj = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    } catch {
      continue;
    }
    for (const r of (proj.projectResources && proj.projectResources.resources) || []) {
      const uri = r.folderUri || (r.gitFolder && r.gitFolder.folderUri);
      if (!uri) continue;
      const folder = norm(decodeURIComponent(uri.replace(/^file:\/\/\//, '')));
      if ((target === folder || target.startsWith(folder + '/')) && folder.length > best.len) {
        best = { id: proj.id, len: folder.length };
      }
    }
  }
  return best.id;
}

/**
 * true/false from ~/.gemini/antigravity/conversation_summaries.db (status + not_fully_idle);
 * null when the index cannot be read, so callers fall back to the transcript alone.
 */
function agyConversationIdle(cid) {
  try {
    const { DatabaseSync } = require('node:sqlite');
    const db = new DatabaseSync(path.join(HOME, '.gemini', 'antigravity', 'conversation_summaries.db'), { readOnly: true });
    const row = db
      .prepare('select status, not_fully_idle as busy from conversation_summaries where conversation_id = ?')
      .get(cid);
    db.close();
    if (!row) return null;
    return !Number(row.busy) && !String(row.status).endsWith('RUNNING');
  } catch {
    return null;
  }
}

function callAntigravityConnectRpc(lsInfo, method, bodyObj = {}) {
  if (!lsInfo || !lsInfo.ok || !lsInfo.port) return null;
  const res = spawnSync(
    'curl.exe',
    [
      '-s',
      '--max-time',
      '5',
      '-X',
      'POST',
      '-H',
      `x-codeium-csrf-token: ${lsInfo.csrfToken}`,
      '-H',
      'Connect-Protocol-Version: 1',
      '-H',
      'Content-Type: application/json',
      '-d',
      JSON.stringify(bodyObj),
      `http://127.0.0.1:${lsInfo.port}/exa.language_server_pb.LanguageServerService/${method}`,
    ],
    { encoding: 'utf8', timeout: 7000, windowsHide: true }
  );
  if (res.status !== 0 || !res.stdout) return null;
  try {
    return JSON.parse(res.stdout.trim());
  } catch {
    return null;
  }
}

function queryAntigravityLiveQuota() {
  const ls = discoverAntigravityLs();
  if (!ls.ok) return { ok: false, error: ls.error };
  const userStatusResp = callAntigravityConnectRpc(ls, 'GetUserStatus', {});
  const quotaResp = callAntigravityConnectRpc(ls, 'RetrieveUserQuotaSummary', {});
  const us = userStatusResp && userStatusResp.userStatus;
  const groups = (quotaResp && quotaResp.response && quotaResp.response.groups) || [];
  const buckets = {};
  for (const g of groups) {
    for (const b of g.buckets || []) {
      buckets[b.bucketId] = {
        remainingPct: Number(((b.remainingFraction ?? 0) * 100).toFixed(2)),
        resetTime: b.resetTime || null,
        window: b.window,
      };
    }
  }
  return {
    ok: true,
    lsAddress: ls.address,
    pid: ls.pid,
    email: us ? us.email : null,
    userTier: us && us.userTier ? us.userTier.name : null,
    userTierId: us && us.userTier ? us.userTier.id : null,
    planName: us && us.planStatus && us.planStatus.planInfo ? us.planStatus.planInfo.planName : null,
    availablePromptCredits: us && us.planStatus ? us.planStatus.availablePromptCredits : null,
    availableFlowCredits: us && us.planStatus ? us.planStatus.availableFlowCredits : null,
    buckets,
  };
}

function runAntigravityAgentApi(prof, gate, args, promptText) {
  const ls = discoverAntigravityLs();
  if (!ls.ok) {
    console.error(JSON.stringify({ ok: false, agent: prof.id, error: ls.error }, null, 2));
    process.exit(1);
  }
  const env = {
    ANTIGRAVITY_LS_ADDRESS: ls.address,
    ANTIGRAVITY_CSRF_TOKEN: ls.csrfToken,
    ANTIGRAVITY_PROJECT_ID: resolveAntigravityProjectId(args.cwd || ROOT_DIR),
  };
  const sessionMapPath = path.join(HOME, '.acpx', 'agy-sessions.json');
  let sessionMap = {};
  if (fs.existsSync(sessionMapPath)) {
    try {
      sessionMap = JSON.parse(fs.readFileSync(sessionMapPath, 'utf8'));
    } catch {}
  }
  const sessionArg = args.session || 'gw-antigravity';
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sessionArg);
  let targetCid = isUuid ? sessionArg : sessionMap[sessionArg] || null;
  const startedAt = Date.now();
  const modelTier = ['flash_lite', 'flash', 'pro'].includes(gate.model) ? gate.model : 'flash';

  let beforeLines = 0;
  const getTranscriptPath = (cid) =>
    path.join(HOME, '.gemini', 'antigravity', 'brain', cid, '.system_generated', 'logs', 'transcript.jsonl');

  if (targetCid && fs.existsSync(getTranscriptPath(targetCid))) {
    beforeLines = fs.readFileSync(getTranscriptPath(targetCid), 'utf8').trim().split(/\r?\n/).filter(Boolean).length;
    const sendRes = spawnSync(ls.lsBin, ['agentapi', 'send-message', targetCid, promptText], {
      cwd: ROOT_DIR,
      env: { ...agentBaseEnv(), ...env },
      encoding: 'utf8',
      timeout: 15000,
      windowsHide: true,
    });
    if (sendRes.status !== 0) {
      targetCid = null; // Fallback to new-conversation if send-message fails
    }
  } else {
    targetCid = null;
  }

  if (!targetCid) {
    const newRes = spawnSync(
      ls.lsBin,
      ['agentapi', 'new-conversation', `--model=${modelTier}`, `--title=${sessionArg}`, promptText],
      {
        cwd: ROOT_DIR,
        env: { ...agentBaseEnv(), ...env },
        encoding: 'utf8',
        timeout: 20000,
        windowsHide: true,
      }
    );
    if (newRes.status !== 0) {
      console.error(
        JSON.stringify(
          { ok: false, agent: prof.id, error: (newRes.stderr || newRes.stdout || 'agentapi new-conversation failed').trim() },
          null,
          2
        )
      );
      process.exit(1);
    }
    try {
      const parsed = JSON.parse(newRes.stdout.trim());
      targetCid =
        parsed && parsed.response && parsed.response.newConversation
          ? parsed.response.newConversation.conversationId
          : null;
    } catch {}
    if (!targetCid) {
      console.error(JSON.stringify({ ok: false, agent: prof.id, error: 'Failed to parse conversationId from agentapi output', raw: newRes.stdout }, null, 2));
      process.exit(1);
    }
    if (!isUuid) {
      sessionMap[sessionArg] = targetCid;
      fs.mkdirSync(path.dirname(sessionMapPath), { recursive: true });
      fs.writeFileSync(sessionMapPath, JSON.stringify(sessionMap, null, 2), 'utf8');
    }
  }

  // Poll transcript.jsonl for new PLANNER_RESPONSE with status === 'DONE'
  const timeoutMs = Number(args.timeout || 90) * 1000;
  const tPath = getTranscriptPath(targetCid);
  let replyStep = null;
  // The index can read IDLE for a moment between the final text and the background task being
  // registered (seen 2026-10-17), so "done" must hold, with no new transcript lines, for IDLE_HOLD_MS.
  const IDLE_HOLD_MS = 5000;
  let doneSince = 0;
  let doneAtLines = -1;
  while (Date.now() - startedAt < timeoutMs) {
    if (fs.existsSync(tPath)) {
      const lines = fs.readFileSync(tPath, 'utf8').trim().split(/\r?\n/).filter(Boolean);
      const newSteps = lines.slice(beforeLines).map((l) => {
        try {
          return JSON.parse(l);
        } catch {
          return null;
        }
      }).filter(Boolean);
      const plannerDone = newSteps.filter(
        (s) => s.type === 'PLANNER_RESPONSE' && s.status === 'DONE' && (!s.tool_calls || s.tool_calls.length === 0)
      );
      // A text-only DONE response is not enough: the agent may have put a command in the background and
      // yielded while it waits. The conversation index says whether the cascade is really idle.
      const looksDone = plannerDone.length > 0 && agyConversationIdle(targetCid) !== false;
      if (!looksDone || lines.length !== doneAtLines) {
        doneSince = looksDone ? Date.now() : 0;
        doneAtLines = looksDone ? lines.length : -1;
      } else if (Date.now() - doneSince >= IDLE_HOLD_MS) {
        replyStep = plannerDone[plannerDone.length - 1];
        break;
      }
    }
    spawnSync('powershell.exe', ['-NoProfile', '-Command', 'Start-Sleep -Milliseconds 600'], { windowsHide: true });
  }

  const output = {
    ok: Boolean(replyStep),
    agent: prof.id,
    driver: prof.driver,
    session: sessionArg,
    conversationId: targetCid,
    lsAddress: ls.address,
    projectId: env.ANTIGRAVITY_PROJECT_ID,
    model: modelTier,
    stopReason: replyStep ? 'end_turn' : 'timeout',
    reply: replyStep ? replyStep.content : null,
    usage: replyStep
      ? {
          inputTokens: replyStep.input_tokens || 0,
          cacheReadTokens: replyStep.cache_read_tokens || 0,
          outputTokens: replyStep.output_tokens || 0,
        }
      : null,
    durationMs: Date.now() - startedAt,
    error: replyStep ? null : { message: `Timed out waiting for PLANNER_RESPONSE in ${tPath}` },
  };
  console.log(JSON.stringify(output, null, 2));
  process.exit(output.ok ? 0 : 1);
}

function cmdStatus(args) {
  const prof = resolveProfile(args.agent || args._[1]);
  if (!prof) {
    console.error(JSON.stringify({ ok: false, error: `Unknown agent: ${args.agent || args._[1]}` }));
    process.exit(1);
  }
  const card = readHostCardMeta(prof.hostCard) || {};
  if (prof.driver === 'acpx') {
    const acpxArgs = ['--format', 'json', prof.acpxAgent, 'status'];
    if (args.session) acpxArgs.push('-s', args.session);
    const res = runCommandSync('acpx', acpxArgs, prof.buildEnv(), 15000);
    let parsed = null;
    try {
      parsed = JSON.parse(res.stdout.split(/\r?\n/).filter(Boolean).pop() || '{}');
    } catch {
      parsed = { raw: res.stdout };
    }
    console.log(
      JSON.stringify(
        {
          ok: res.exitCode === 0,
          agent: prof.id,
          driver: prof.driver,
          boardStatus: card.status,
          holder: card.holder,
          defaultModel: prof.defaultModel,
          injectedEnvKeys: prof.injectedEnvKeys,
          acpxStatus: parsed,
        },
        null,
        2
      )
    );
    process.exit(res.exitCode);
  } else if (prof.driver === 'agy-agentapi') {
    const live = queryAntigravityLiveQuota();
    console.log(
      JSON.stringify(
        {
          ok: live.ok,
          agent: prof.id,
          driver: prof.driver,
          boardStatus: card.status,
          holder: card.holder,
          defaultModel: prof.defaultModel,
          antigravityStatus: live,
        },
        null,
        2
      )
    );
    process.exit(live.ok ? 0 : 1);
  } else {
    const cliTarget = prof.id === 'doubao-desktop' ? 'doubao' : prof.id;
    const res = runCommandSync('opencli', [cliTarget, 'status'], {}, 10000);
    console.log(
      JSON.stringify(
        {
          ok: res.exitCode === 0,
          agent: prof.id,
          driver: prof.driver,
          boardStatus: card.status,
          holder: card.holder,
          stdout: res.stdout,
          stderr: res.stderr,
        },
        null,
        2
      )
    );
    process.exit(res.exitCode);
  }
}

const DAEMON_BASE = process.env.HUB_DAEMON_URL || 'http://127.0.0.1:8899';
const SHARED_DAEMON_CHANNELS = new Set([
  'codex',
  'claude',
  'zcode',
  'workbuddy',
  'opencode',
  'antigravity',
  'hermes',
]);

function callSharedDaemon(apiPath, method = 'GET', bodyObj = null, timeoutSec = 130) {
  try {
    const curlArgs = [
      '-s',
      // The service is local; an agent's shell may carry a proxy that cannot or should not reach it.
      '--noproxy',
      '*',
      '--max-time',
      String(timeoutSec),
      '-X',
      method,
      '-H',
      'Content-Type: application/json',
    ];
    if (bodyObj !== null) {
      curlArgs.push('--data-binary', '@-');
    }
    curlArgs.push(`${DAEMON_BASE}${apiPath}`);
    const res = spawnSync('curl.exe', curlArgs, {
      input: bodyObj !== null ? JSON.stringify(bodyObj) : undefined,
      encoding: 'utf8',
      timeout: (timeoutSec + 5) * 1000,
      windowsHide: true,
      // The session list is several MB; the default 1 MB cut it off and the parse failed.
      maxBuffer: 256 * 1024 * 1024,
    });
    if (res.status !== 0 || !res.stdout || !res.stdout.trim()) return null;
    return JSON.parse(res.stdout.trim());
  } catch {
    return null;
  }
}

function isDaemonPortOpen() {
  // A TCP connect answers at once either way (curl on Windows retries a refused port until its timeout).
  const u = new URL(DAEMON_BASE);
  const probe = `const s=require('net').connect({host:${JSON.stringify(u.hostname)},port:${Number(u.port) || 80}});s.on('connect',()=>process.exit(0));s.on('error',()=>process.exit(1));setTimeout(()=>process.exit(1),4000)`;
  return spawnSync(process.execPath, ['-e', probe], { windowsHide: true, timeout: 6000 }).status === 0;
}

function isSharedDaemonOnline(timeoutSec = 5) {
  const health = callSharedDaemon('/api/health', 'GET', null, timeoutSec);
  return Boolean(health && health.ok);
}

// One implementation of "run a turn": the 8899 service (trace/apps/cli/src/gateway.ts). When it is not running,
// start it (with --lan when ~/.agent-hub/lan-host is set) instead of driving the agent from here; --standalone keeps the old direct path.
function ensureSharedDaemon() {
  if (isSharedDaemonOnline()) return true;
  // Something listens on the port but did not answer in time: the service is busy (it stalls for tens of seconds
  // while it rescans sessions after a restart). Wait for it; starting a second one only fails on the port.
  if (isDaemonPortOpen()) {
    for (let i = 0; i < 6; i++) if (isSharedDaemonOnline(15)) return true;
    return false;
  }
  if (process.env.HUB_NO_AUTOSTART === '1' || process.env.HUB_DAEMON_URL) return false;
  const logDir = path.join(os.homedir(), '.agent-hub');
  fs.mkdirSync(logDir, { recursive: true });
  const out = fs.openSync(path.join(logDir, 'hub-8899.log'), 'a');
  const err = fs.openSync(path.join(logDir, 'hub-8899.err.log'), 'a');
  // The phone page reaches the service over EasyTier; ~/.agent-hub/lan-host names that address (10.126.126.1).
  let lanHost = process.env.HUB_LAN_HOST || '';
  try {
    lanHost = lanHost || fs.readFileSync(path.join(logDir, 'lan-host'), 'utf8').trim();
  } catch {}
  const serveArgs = ['--no-warnings=ExperimentalWarning', path.join(ROOT_DIR, 'trace', 'apps', 'cli', 'src', 'main.ts'), 'serve', '--port', '8899'];
  if (lanHost) serveArgs.push('--lan', lanHost);
  const child = spawn(
    process.execPath,
    serveArgs,
    { cwd: ROOT_DIR, detached: true, stdio: ['ignore', out, err], windowsHide: true },
  );
  child.unref();
  for (let i = 0; i < 60; i++) {
    spawnSync(process.execPath, ['-e', 'setTimeout(()=>{},1000)']);
    if (isSharedDaemonOnline()) return true;
  }
  return false;
}

function cmdRun(args) {
  const prof = resolveProfile(args.agent);
  if (!prof) {
    console.error(JSON.stringify({ ok: false, error: `Unknown agent: ${args.agent}` }));
    process.exit(1);
  }
  const gate = preflightCheck(prof, args);
  if (!gate.ok) {
    console.error(JSON.stringify(gate, null, 2));
    process.exit(2);
  }

  let promptText = args.prompt || '';
  if (args.file) {
    promptText = fs.readFileSync(path.resolve(ROOT_DIR, args.file), 'utf8');
  }
  if (!promptText) {
    console.error(JSON.stringify({ ok: false, error: 'Missing --prompt <text> or --file <path>' }));
    process.exit(1);
  }

  const sessionName = args.session || `gw-${prof.id}`;
  const timeoutSec = Number(args.timeout || 120);
  // The user runs every agent with full permissions (2026-10-18); reads/deny only when asked for.
  const permMode = args.permissions === 'reads' ? 'reads' : args.permissions === 'deny' ? 'deny' : 'all';

  // Primary Path: Route through the shared :8899 AgentGatewayHub daemon so Web UI & CLI share the exact same live session & activeRuns!
  if (!args.standalone && SHARED_DAEMON_CHANNELS.has(prof.id) && ensureSharedDaemon()) {
    const startedAt = Date.now();
    const daemonRes = callSharedDaemon(
      '/api/gateway/send',
      'POST',
      {
        channel: prof.id,
        sessionName,
        // --trace <traceKind>:<id> takes over a session the agent wrote on its own (desktop app, its own CLI).
        traceSessionId: args.trace || undefined,
        cwd: args.cwd || ROOT_DIR,
        prompt: promptText,
        // Only a model asked for: otherwise the service keeps the session's own model (a default here switched it).
        model: args.model ? gate.model : undefined,
        permissions: permMode,
        mode: args.mode === 'interrupt' ? 'interrupt' : args.mode === 'queue' ? 'queue' : 'send',
        source: 'cli',
        wait: !args.async,
        timeoutMs: timeoutSec * 1000,
      },
      timeoutSec + 10
    );

    if (daemonRes) {
      // The daemon keeps the turn going after our wait runs out: report that, not a failure.
      const stillRunning = daemonRes.status === 'running' || daemonRes.status === 'cancelling' || daemonRes.status === 'queued';
      const output = {
        ok: Boolean(daemonRes.ok) || stillRunning,
        running: stillRunning || undefined,
        next: stillRunning
          ? `still running in the 8899 daemon; get the result with: node hub/tools/agent_gateway.js wait --agent ${prof.id} --session ${daemonRes.sessionName || sessionName}`
          : undefined,
        gatewayMode: 'shared-daemon:8899',
        action: stillRunning ? 'running' : daemonRes.action || daemonRes.status,
        agent: prof.id,
        driver: prof.driver,
        session: daemonRes.sessionName || sessionName,
        traceSessionId: daemonRes.traceSessionId || (daemonRes.run && daemonRes.run.traceSessionId) || null,
        runId: daemonRes.runId || null,
        model: daemonRes.model || gate.model,
        cwd: daemonRes.cwd || args.cwd || ROOT_DIR,
        permissions: permMode,
        stopReason: daemonRes.status === 'completed' ? 'end_turn' : daemonRes.status,
        reply: daemonRes.reply ?? (daemonRes.run && daemonRes.run.text) ?? null,
        thoughts: daemonRes.thoughts || undefined,
        toolCallsCount: Array.isArray(daemonRes.tools) ? daemonRes.tools.length : 0,
        durationMs: daemonRes.durationMs || Date.now() - startedAt,
        error: daemonRes.error ? { message: String(daemonRes.error) } : null,
      };
      console.log(JSON.stringify(output, null, 2));
      // --async asked only for the turn to start, so a running turn is its success; exit 3 is "waited and not done yet".
      process.exit(stillRunning && !args.async ? 3 : output.ok ? 0 : 1);
    }
    // The daemon took the request and then the connection dropped (restart, curl timeout). The turn may well be
    // running there; running it again here would send the same prompt twice (seen 2026-10-18).
    console.log(JSON.stringify({
      ok: false, running: 'unknown', agent: prof.id, session: sessionName, gatewayMode: 'shared-daemon:8899',
      error: 'lost the connection to the 8899 daemon after sending; not re-sending',
      next: `check with: node hub/tools/agent_gateway.js read --agent ${prof.id} --session ${sessionName}`,
    }, null, 2));
    process.exit(3);
  }

  // Fallback Path: Direct standalone execution when :8899 daemon is offline
  if (prof.driver === 'agy-agentapi') {
    return runAntigravityAgentApi(prof, gate, args, promptText);
  }

  if (prof.driver !== 'acpx') {
    console.error(
      JSON.stringify({
        ok: false,
        code: 'DESKTOP_UI_ONLY',
        message: `Agent '${prof.id}' uses '${prof.driver}'. Use 'opencli ${prof.id === 'doubao-desktop' ? 'doubao' : prof.id}' with desktop SOP verification.`,
      })
    );
    process.exit(2);
  }

  const env = prof.buildEnv();
  const permFlag =
    args.permissions === 'reads'
      ? '--approve-reads'
      : args.permissions === 'deny'
      ? '--deny-all'
      : '--approve-all';

  // 1. Ensure named session exists
  const ensureRes = runCommandSync(
    'acpx',
    ['--format', 'json', prof.acpxAgent, 'sessions', 'ensure', '--name', sessionName],
    env,
    30000
  );

  // 2. Run prompt turn
  const runArgs = ['--format', 'json', permFlag, '--timeout', String(timeoutSec)];
  if (gate.model) {
    runArgs.push('--model', gate.model);
  }
  // Pass the prompt through a file: on Windows runCommandSync goes through `cmd.exe /c`, which cuts a
  // multi-line argument at the first newline (seen 2026-10-17: the agent only received line 1).
  const promptFile = path.join(os.tmpdir(), `acpx-prompt-${process.pid}-${Date.now()}.txt`);
  fs.writeFileSync(promptFile, promptText, 'utf8');
  runArgs.push(prof.acpxAgent, '-s', sessionName, '-f', promptFile);
  const turnRes = runCommandSync('acpx', runArgs, env, (timeoutSec + 15) * 1000);
  try {
    fs.unlinkSync(promptFile);
  } catch {}
  const parsed = parseAcpxNdjson(`${ensureRes.stdout}\n${turnRes.stdout}`, turnRes.stderr);

  const output = {
    ok: standaloneTurnOk(turnRes.exitCode, parsed),
    gatewayMode: 'standalone-fallback',
    agent: prof.id,
    driver: prof.driver,
    session: sessionName,
    acpxSessionId: parsed.acpxSessionId,
    acpxRecordId: parsed.acpxRecordId,
    model: gate.model,
    permissions: permFlag,
    stopReason: parsed.stopReason,
    reply: parsed.reply,
    usage: parsed.usage,
    durationMs: turnRes.durationMs,
    error: turnRes.exitCode !== 0 ? parsed.error || { message: turnRes.stderr || turnRes.stdout } : null,
  };
  console.log(JSON.stringify(output, null, 2));
  process.exit(output.ok ? 0 : 1);
}

function cmdCancel(args) {
  const prof = resolveProfile(args.agent);
  if (!prof) {
    console.error(JSON.stringify({ ok: false, error: `Unknown agent: ${args.agent}` }));
    process.exit(1);
  }
  if (!args.standalone && SHARED_DAEMON_CHANNELS.has(prof.id) && ensureSharedDaemon()) {
    const res = callSharedDaemon(
      '/api/gateway/cancel',
      'POST',
      {
        channel: prof.id,
        sessionName: args.session || `gw-${prof.id}`,
      },
      10
    );
    if (res) {
      console.log(JSON.stringify({ ...res, gatewayMode: 'shared-daemon:8899' }, null, 2));
      process.exit(res.ok ? 0 : 1);
    }
  }
  if (prof.driver !== 'acpx') {
    console.error(JSON.stringify({ ok: false, error: `Standalone cancel requires an acpx agent (got: ${args.agent})` }));
    process.exit(1);
  }
  const acpxArgs = ['--format', 'json', prof.acpxAgent, 'cancel'];
  if (args.session) acpxArgs.push('-s', args.session);
  const res = runCommandSync('acpx', acpxArgs, prof.buildEnv(), 15000);
  console.log(res.stdout || JSON.stringify({ ok: res.exitCode === 0, stderr: res.stderr }));
  process.exit(res.exitCode);
}

function cmdHandoff(args) {
  const fromProf = resolveProfile(args.from || args.agent || 'codex');
  const toProf = resolveProfile(args.to || 'zcode');
  if (!fromProf || !toProf) {
    console.error(JSON.stringify({ ok: false, error: 'Specify valid --from <channel> and --to <channel>' }));
    process.exit(1);
  }
  const timeoutSec = Number(args.timeout || 120);
  const res = callSharedDaemon(
    '/api/gateway/handoff',
    'POST',
    {
      fromChannel: fromProf.id,
      fromSessionName: args['from-session'] || args.session,
      fromTraceId: args['trace-id'],
      toChannel: toProf.id,
      toModel: args.model,
      toSessionName: args['to-session'],
      customInstruction: args.prompt,
      wait: !args.async,
      timeoutMs: timeoutSec * 1000,
    },
    timeoutSec + 10
  );
  if (!res) {
    console.error(JSON.stringify({ ok: false, error: 'Shared daemon http://127.0.0.1:8899 is not reachable' }));
    process.exit(1);
  }
  console.log(JSON.stringify(res, null, 2));
  process.exit(res.ok ? 0 : 1);
}

function cmdPatrol(args) {
  const prof = resolveProfile(args.agent || 'codex') || AGENT_PROFILES.codex;
  const res = callSharedDaemon(
    '/api/gateway/meta-agents/patrol',
    'POST',
    {
      agentId: args['meta-id'] || 'meta_maint',
      eventKind: args.event || 'manual_patrol',
      targetChannel: prof.id,
      targetSession: args.session || `hub-${prof.id}`,
      errorSummary: args.prompt || args.summary || `CLI 请求元智能体的诊断会话对 ${prof.id} 执行健康巡检与架构诊断`,
    },
    60
  );
  if (!res) {
    console.error(JSON.stringify({ ok: false, error: 'Shared daemon http://127.0.0.1:8899 is not reachable' }));
    process.exit(1);
  }
  console.log(JSON.stringify(res, null, 2));
  process.exit(res.ok ? 0 : 1);
}

function queryYinziLiveBalance() {
  const vaultPath = path.join(CHANNELS_DIR, '_private', 'sites.local.json');
  if (!fs.existsSync(vaultPath)) return null;
  try {
    const vault = JSON.parse(fs.readFileSync(vaultPath, 'utf8'));
    const yz = vault.yinziapi;
    if (!yz || !yz.access_token) return null;
    const res = spawnSync(
      'curl.exe',
      [
        '-s',
        '--max-time',
        '8',
        '-H',
        `Authorization: Bearer ${yz.access_token}`,
        '-H',
        `New-Api-User: ${yz.user_id || '21'}`,
        `${yz.base_url}/api/user/self`,
      ],
      { encoding: 'utf8', timeout: 10000, windowsHide: true }
    );
    if (res.status !== 0 || !res.stdout) return null;
    const parsed = JSON.parse(res.stdout.trim());
    if (!parsed || !parsed.data) return null;
    const u = parsed.data;
    const unit = yz.quota_per_unit || 500000;
    const remQ = Number(u.quota || 0);
    const usedQ = Number(u.used_quota || 0);
    const totQ = remQ + usedQ;
    return {
      station: 'yinzi-api (yinziapi.top)',
      username: u.username,
      userId: u.id,
      remainingYuan: Number((remQ / unit).toFixed(2)),
      usedYuan: Number((usedQ / unit).toFixed(2)),
      totalYuan: Number((totQ / unit).toFixed(2)),
      requestCount: u.request_count || 0,
      configuredTokensCount: Array.isArray(yz.tokens) ? yz.tokens.length : 0,
      alertLevel: remQ / unit < 5 ? '🟡 LOW_BALANCE (<5 CNY)' : '🟢 OK',
    };
  } catch (e) {
    return { error: e.message };
  }
}

function queryCodexLatestRateLimits() {
  const sessionsRoot = path.join(HOME, '.codex', 'sessions');
  if (!fs.existsSync(sessionsRoot)) return null;
  try {
    // Find latest JSONL file recursively in ~/.codex/sessions
    const years = fs.readdirSync(sessionsRoot).sort().reverse();
    for (const y of years) {
      const yDir = path.join(sessionsRoot, y);
      if (!fs.statSync(yDir).isDirectory()) continue;
      const months = fs.readdirSync(yDir).sort().reverse();
      for (const m of months) {
        const mDir = path.join(yDir, m);
        if (!fs.statSync(mDir).isDirectory()) continue;
        const days = fs.readdirSync(mDir).sort().reverse();
        for (const d of days) {
          const dDir = path.join(mDir, d);
          if (!fs.statSync(dDir).isDirectory()) continue;
          const files = fs
            .readdirSync(dDir)
            .filter((f) => f.endsWith('.jsonl'))
            .map((f) => ({ f, mtime: fs.statSync(path.join(dDir, f)).mtimeMs }))
            .sort((a, b) => b.mtime - a.mtime);
          for (const item of files.slice(0, 3)) {
            const content = fs.readFileSync(path.join(dDir, item.f), 'utf8');
            const lines = content.trim().split(/\r?\n/).reverse();
            for (const line of lines) {
              if (!line.includes('"rate_limits"')) continue;
              const obj = JSON.parse(line);
              const rl = obj.payload && obj.payload.rate_limits;
              if (rl && rl.primary) {
                return {
                  sourceFile: item.f,
                  planType: rl.plan_type || 'team',
                  primary5hUsedPct: rl.primary.used_percent,
                  primary5hRemainingPct: 100 - (rl.primary.used_percent || 0),
                  primary5hResetsAt: rl.primary.resets_at
                    ? new Date(rl.primary.resets_at * 1000).toISOString()
                    : null,
                  weekly7dUsedPct: rl.secondary ? rl.secondary.used_percent : null,
                  weekly7dRemainingPct: rl.secondary ? 100 - (rl.secondary.used_percent || 0) : null,
                  weekly7dResetsAt:
                    rl.secondary && rl.secondary.resets_at
                      ? new Date(rl.secondary.resets_at * 1000).toISOString()
                      : null,
                };
              }
            }
          }
        }
      }
    }
  } catch {
    return null;
  }
  return null;
}

function querySearchPoolsLiveQuota() {
  const vaultPath = path.join(CHANNELS_DIR, '_private', 'sites.local.json');
  if (!fs.existsSync(vaultPath)) return null;
  try {
    const vault = JSON.parse(fs.readFileSync(vaultPath, 'utf8'));
    const out = {};
    if (vault.serpapi && Array.isArray(vault.serpapi.keys) && vault.serpapi.keys.length > 0) {
      const primary = vault.serpapi.keys[0];
      const res = spawnSync(
        'curl.exe',
        ['-s', '--max-time', '6', '-x', 'http://127.0.0.1:7892', `https://serpapi.com/account.json?api_key=${primary.key}`],
        { encoding: 'utf8', timeout: 8000, windowsHide: true }
      );
      let pLeft = null;
      if (res.status === 0 && res.stdout) {
        try {
          const d = JSON.parse(res.stdout.trim());
          pLeft = d.total_searches_left ?? d.plan_searches_left ?? null;
        } catch {}
      }
      out.serpapi = {
        keysCount: vault.serpapi.keys.length,
        monthlyPoolTotal: vault.serpapi.keys.length * (vault.serpapi.monthly_quota_per_key || 250),
        primaryName: primary.name,
        primaryRemaining: pLeft,
      };
    }
    if (vault.tavily && Array.isArray(vault.tavily.keys) && vault.tavily.keys.length > 0) {
      const primary = vault.tavily.keys[0];
      const res = spawnSync(
        'curl.exe',
        ['-s', '--max-time', '6', '-x', 'http://127.0.0.1:7892', '-H', `Authorization: Bearer ${primary.key}`, 'https://api.tavily.com/usage'],
        { encoding: 'utf8', timeout: 8000, windowsHide: true }
      );
      let pLeft = null;
      if (res.status === 0 && res.stdout) {
        try {
          const d = JSON.parse(res.stdout.trim());
          if (d.account && typeof d.account.plan_usage === 'number') {
            pLeft = (d.account.plan_limit || 1000) - d.account.plan_usage;
          }
        } catch {}
      }
      out.tavily = {
        keysCount: vault.tavily.keys.length,
        monthlyPoolTotal: vault.tavily.keys.length * (vault.tavily.monthly_quota_per_key || 1000),
        primaryName: primary.name,
        primaryRemaining: pLeft,
      };
    }
    if (vault.deepseek && vault.deepseek.api_key) {
      const res = spawnSync(
        'curl.exe',
        ['-s', '--max-time', '6', '-H', `Authorization: Bearer ${vault.deepseek.api_key}`, 'https://api.deepseek.com/user/balance'],
        { encoding: 'utf8', timeout: 8000, windowsHide: true }
      );
      if (res.status === 0 && res.stdout) {
        try {
          const d = JSON.parse(res.stdout.trim());
          const info = (d.balance_infos && d.balance_infos[0]) || {};
          out.deepseek = {
            available: Boolean(d.is_available),
            currency: info.currency || 'CNY',
            totalBalance: info.total_balance || '0.00',
          };
        } catch {}
      }
    }
    return out;
  } catch {
    return null;
  }
}

function cmdQuota(args) {
  const modelsDir = path.join(CHANNELS_DIR, 'models');
  const modelCards = [];
  if (fs.existsSync(modelsDir)) {
    for (const f of fs.readdirSync(modelsDir).filter((x) => x.endsWith('.md')).sort()) {
      const text = fs.readFileSync(path.join(modelsDir, f), 'utf8');
      const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
      const meta = {};
      if (m) {
        for (const line of m[1].split(/\r?\n/)) {
          if (/^\s+/.test(line)) continue;
          const idx = line.indexOf(':');
          if (idx > 0) meta[line.slice(0, idx).trim()] = line.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
        }
      }
      modelCards.push({
        channelId: meta.channel_id || f.replace(/\.md$/, ''),
        name: meta.name || f,
        status: meta.status || 'unknown',
        holder: meta.holder || 'shared',
        lastVerifiedAt: meta.last_verified_at || '-',
      });
    }
  }

  // Aggregate recent acpx session token watermarks from ~/.acpx/sessions/*.json
  const acpxSessionsDir = path.join(HOME, '.acpx', 'sessions');
  const activeSessions = [];
  if (fs.existsSync(acpxSessionsDir)) {
    for (const f of fs.readdirSync(acpxSessionsDir).filter((x) => x.endsWith('.json'))) {
      try {
        const rec = JSON.parse(fs.readFileSync(path.join(acpxSessionsDir, f), 'utf8'));
        if (!rec.closed && rec.cwd && path.resolve(rec.cwd).toLowerCase() === ROOT_DIR.toLowerCase()) {
          activeSessions.push({
            name: rec.name || '(default)',
            agentCommand: rec.agent_command,
            sessionId: rec.session_id,
            lastUsedAt: rec.last_used_at,
          });
        }
      } catch {
        // ignore unreadable record
      }
    }
  }

  const yinziLive = queryYinziLiveBalance();
  const codexRateLimits = queryCodexLatestRateLimits();
  const antigravityLive = queryAntigravityLiveQuota();
  const searchPools = querySearchPoolsLiveQuota();

  const report = {
    ok: true,
    checkedAt: new Date().toISOString(),
    liveBalances: {
      yinziApi: yinziLive,
      codexOfficialTeam: codexRateLimits,
      antigravityUltra: antigravityLive,
      searchPools,
    },
    modelChannels: modelCards,
    hostQuotaMechanisms: [
      { id: 'antigravity', tier: 'tier-1-rpc', method: 'language_server.exe Connect-RPC: RetrieveUserQuotaSummary + GetUserStatus' },
      { id: 'codex', tier: 'tier-1-rpc', method: 'codex app-server: account/rateLimits/read + thread/tokenUsage/updated' },
      { id: 'claude', tier: 'tier-1-cmd', method: 'acpx claude /usage + .claude/projects/**/*.jsonl cost-state' },
      { id: 'zcode', tier: 'tier-2-ledger', method: '~/.zcode/v2/db.sqlite (model_usage) + ACP _meta.zcode.usage' },
      { id: 'workbuddy', tier: 'tier-2-dual', method: '~/.workbuddy/workbuddy.db (Credits) + custom-local:glm-5.3 (Zhipu Coding Plan)' },
      { id: 'opencode', tier: 'tier-3-window', method: 'ACP session/update usage_update + step-finish tokens' },
    ],
    activeWorkspaceAcpxSessions: activeSessions,
  };

  if (args.json) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }
  console.log('=== 1. Live Station Balances & Subscription Windows ===');
  if (yinziLive && !yinziLive.error) {
    console.log(
      `  - [yinzi-api]         ${yinziLive.alertLevel} | Remaining: ¥${yinziLive.remainingYuan} CNY | Used: ¥${yinziLive.usedYuan} / ¥${yinziLive.totalYuan} CNY | Requests: ${yinziLive.requestCount} | Keys: ${yinziLive.configuredTokensCount}`
    );
  } else {
    console.log(`  - [yinzi-api]         (live query unavailable: ${yinziLive ? yinziLive.error : 'no vault'})`);
  }
  if (codexRateLimits) {
    console.log(
      `  - [openai-official]   🟢 Plan=${codexRateLimits.planType} | 5h Window Remaining: ${codexRateLimits.primary5hRemainingPct}% (used ${codexRateLimits.primary5hUsedPct}%) | 7d Weekly Remaining: ${codexRateLimits.weekly7dRemainingPct}% (used ${codexRateLimits.weekly7dUsedPct}%)`
    );
  }
  if (antigravityLive && antigravityLive.ok) {
    const b = antigravityLive.buckets || {};
    const g5h = b['gemini-5h'] ? `${b['gemini-5h'].remainingPct}%` : '?';
    const gWk = b['gemini-weekly'] ? `${b['gemini-weekly'].remainingPct}%` : '?';
    const c5h = b['3p-5h'] ? `${b['3p-5h'].remainingPct}%` : '?';
    const cWk = b['3p-weekly'] ? `${b['3p-weekly'].remainingPct}%` : '?';
    console.log(
      `  - [antigravity-ultra] 🟢 Tier=${antigravityLive.userTier || 'Pro'} | Gemini(5h: ${g5h}, 7d: ${gWk}) | Claude/GPT(5h: ${c5h}, 7d: ${cWk}) | Credits(Prompt: ${antigravityLive.availablePromptCredits}, Flow: ${antigravityLive.availableFlowCredits})`
    );
  }
  if (searchPools && searchPools.deepseek) {
    const ds = searchPools.deepseek;
    console.log(
      `  - [deepseek-official] ${ds.available ? '🟢 OK' : '🔴 DOWN'} | Remaining: ¥${ds.totalBalance} ${ds.currency}`
    );
  }
  if (searchPools && searchPools.serpapi) {
    const sp = searchPools.serpapi;
    console.log(
      `  - [serpapi-pool]      🟢 OK | Keys: ${sp.keysCount} (Pool: ${sp.monthlyPoolTotal}/mo) | Primary [${sp.primaryName}] Remaining: ${sp.primaryRemaining ?? '?'}/250`
    );
  }
  if (searchPools && searchPools.tavily) {
    const tv = searchPools.tavily;
    console.log(
      `  - [tavily-pool]       🟢 OK | Keys: ${tv.keysCount} (Pool: ${tv.monthlyPoolTotal}/mo) | Primary [${tv.primaryName}] Remaining: ${tv.primaryRemaining ?? '?'}/1000`
    );
  }
  console.log('\n=== 2. Model Channels Quota & Status Watermarks (from channels/models/*.md) ===');
  for (const mc of modelCards) {
    console.log(`  - [${mc.channelId.padEnd(18)}] status=${mc.status.padEnd(22)} holder=${mc.holder.padEnd(10)} (${mc.name})`);
  }
  console.log('\n=== 3. Host Quota Inspection Mechanisms ===');
  for (const h of report.hostQuotaMechanisms) {
    console.log(`  - [${h.id.padEnd(11)}] ${h.tier.padEnd(14)} -> ${h.method}`);
  }
  console.log(`\nActive acpx sessions in workspace: ${activeSessions.length}`);
}

// read / wait: the result of a named session's turn, from the 8899 daemon (which owns turns sent through it).
// wait blocks until the turn ends or --timeout (seconds, default 600) passes; exit 3 means still running.
// When the daemon no longer has the run in memory (restarted), the session transcript's last turn is read instead.
function cmdReadWait(args, waitMode) {
  const prof = resolveProfile(args.agent);
  if (!prof || !args.session) {
    console.error(JSON.stringify({ ok: false, error: 'Usage: read|wait --agent <agent> --session <name> [--timeout <sec>]' }));
    process.exit(1);
  }
  if (!ensureSharedDaemon()) {
    console.error(JSON.stringify({ ok: false, error: 'the 8899 daemon is not running and could not be started; read and wait need it' }));
    process.exit(2);
  }
  const timeoutSec = waitMode ? Number(args.timeout || 600) : 0;
  const q = `channel=${encodeURIComponent(prof.id)}&session=${encodeURIComponent(args.session)}&waitMs=${timeoutSec * 1000}`;
  const res = callSharedDaemon(`/api/gateway/run?${q}`, 'GET', null, timeoutSec + 15);
  if (!res || !res.ok) {
    console.error(JSON.stringify({ ok: false, error: (res && res.error) || 'no answer from the daemon' }));
    process.exit(1);
  }
  const out = { ok: true, agent: prof.id, session: res.sessionName, traceSessionId: res.traceSessionId, queued: res.queued };
  if (res.run) {
    Object.assign(out, res.run, { source: 'daemon-run' });
    out.ok = res.run.status !== 'failed' && res.run.status !== 'aborted';
  } else if (res.traceSessionId) {
    const t = callSharedDaemon(`/api/sessions/${encodeURIComponent(res.traceSessionId)}?tail=1&compact=1`, 'GET', null, 30);
    const turn = t && t.session && Array.isArray(t.session.turns) ? t.session.turns[t.session.turns.length - 1] : null;
    Object.assign(out, {
      status: res.agyState || (turn && turn.status) || 'unknown',
      source: 'transcript',
      turnIndex: turn ? turn.index : null,
      prompt: turn ? String(turn.input || '').slice(0, 300) : null,
      reply: turn ? turn.output || '' : null,
      steps: turn && Array.isArray(turn.steps) ? turn.steps.length : null,
    });
  } else {
    Object.assign(out, { ok: false, status: 'unknown', error: 'no such session in the daemon' });
  }
  console.log(JSON.stringify(out, null, 2));
  process.exit(out.status === 'running' || out.status === 'cancelling' || out.status === 'waiting' ? 3 : out.ok ? 0 : 1);
}

function cmdDispatch(args) {
  if (!ensureSharedDaemon()) {
    console.error(JSON.stringify({ ok: false, error: 'the 8899 daemon is not running and could not be started' }));
    process.exit(2);
  }
  const toRaw = args.to || args['to-channel'] || args.agent;
  const toProf = resolveProfile(toRaw);
  if (!toProf) {
    console.error(JSON.stringify({ ok: false, error: `Unknown target agent/channel: ${toRaw}. Pass --to <channel>` }));
    process.exit(1);
  }
  const fromRaw = args.from || args['from-channel'];
  const fromProf = fromRaw ? resolveProfile(fromRaw) : null;
  const task = args.task || args.prompt || (args.file ? fs.readFileSync(path.resolve(args.file), 'utf8') : '');
  if (!String(task || '').trim()) {
    console.error(JSON.stringify({ ok: false, error: 'Missing --task or --prompt for dispatch' }));
    process.exit(1);
  }
  const isAsync = Boolean(args.async || args['no-wait']);
  const wait = !isAsync && Boolean(args.wait !== false && !args.async);
  const timeoutSec = Number(args.timeout || 180);
  const body = {
    kind: args.kind === 'peer-message' || args.kind === 'handoff' ? args.kind : 'spawn-subagent',
    fromChannel: fromProf ? fromProf.id : undefined,
    fromSessionName: args['from-session'] || undefined,
    fromTraceId: args['from-trace-id'] || undefined,
    toChannel: toProf.id,
    toSessionName: args['to-session'] || args.session || undefined,
    toTraceId: args['to-trace-id'] || undefined,
    toModel: args.model || args['to-model'] || undefined,
    cwd: args.cwd || undefined,
    task: String(task).trim(),
    contextDigest: args.context || args['context-digest'] || undefined,
    parentDispatchId: args.parent || args['parent-id'] || undefined,
    wakeCaller: Boolean(args.wake || args['wake-caller'] || (fromProf && args['from-session'])),
    wait,
    timeoutMs: timeoutSec * 1000,
    rawPrompt: Boolean(args.raw),
  };
  const res = callSharedDaemon('/api/gateway/dispatch', 'POST', body, wait ? timeoutSec + 15 : 30);
  if (!res || !res.ok) {
    console.error(JSON.stringify({ ok: false, error: (res && res.error) || 'dispatch failed' }));
    process.exit(1);
  }
  console.log(JSON.stringify(res, null, 2));
  process.exit(0);
}

function cmdDispatches(args, forceWait) {
  if (!ensureSharedDaemon()) {
    console.error(JSON.stringify({ ok: false, error: 'the 8899 daemon is not running and could not be started' }));
    process.exit(2);
  }
  const qs = [];
  const id = args.id || args._[1];
  if (id) qs.push(`id=${encodeURIComponent(id)}`);
  if (args.channel || args.agent) {
    const p = resolveProfile(args.channel || args.agent);
    qs.push(`channel=${encodeURIComponent(p ? p.id : args.channel || args.agent)}`);
  }
  if (args.session) qs.push(`session=${encodeURIComponent(args.session)}`);
  if (args.status) qs.push(`status=${encodeURIComponent(args.status)}`);
  const waitSec = forceWait || args.wait ? Number(args.timeout || args.wait || 120) : 0;
  if (waitSec > 0) qs.push(`waitMs=${waitSec * 1000}`);
  const qStr = qs.length ? `?${qs.join('&')}` : '';
  const res = callSharedDaemon(`/api/gateway/dispatches${qStr}`, 'GET', null, waitSec > 0 ? waitSec + 15 : 20);
  if (!res || !res.ok) {
    console.error(JSON.stringify({ ok: false, error: (res && res.error) || 'failed to query dispatches' }));
    process.exit(1);
  }
  console.log(JSON.stringify(res, null, 2));
  process.exit(0);
}

// The "一群会话" level (goals made of tasks; trace/apps/cli/src/collab/taskboard.ts):
//   goals [--id <目标>]                                       list, or one goal with its tasks, graph and trajectory
//   goal --file <goal.json>                                   start a goal: {title, objective, channel?, verifyBy?, budget?, tasks:[{key,title,acceptance,dependsOn,channel}]}
//   goal-action --id <目标> --action pause|resume|cancel [--max-dispatches N]
//   task-action --id <任务> --action verify|retry|reassign|cancel [--passed] [--note ..] [--rework ..] [--channel ..] [--model ..]
function cmdGoal(args, sub) {
  if (!ensureSharedDaemon()) {
    console.error(JSON.stringify({ ok: false, error: 'the 8899 daemon is not running and could not be started' }));
    process.exit(2);
  }
  let res;
  if (sub === 'goals') {
    const id = args.id || args._[1];
    res = callSharedDaemon(`/api/gateway/goals${id ? `?id=${encodeURIComponent(id)}` : ''}`, 'GET', null, 20);
  } else if (sub === 'goal') {
    if (!args.file) {
      console.error(JSON.stringify({ ok: false, error: 'goal needs --file <goal.json>' }));
      process.exit(2);
    }
    res = callSharedDaemon('/api/gateway/goals', 'POST', JSON.parse(fs.readFileSync(args.file, 'utf8')), 60);
  } else {
    const body = { id: args.id || args._[1], action: args.action };
    if (sub === 'goal-action' && args['max-dispatches']) body.budget = { maxDispatches: Number(args['max-dispatches']) };
    if (sub === 'task-action') {
      if (args.passed !== undefined) body.passed = args.passed !== 'false';
      for (const k of ['note', 'rework', 'channel', 'model', 'reason']) if (args[k] !== undefined) body[k] = String(args[k]);
    }
    res = callSharedDaemon(`/api/gateway/${sub}`, 'POST', body, 60);
  }
  if (!res || !res.ok) {
    console.error(JSON.stringify({ ok: false, error: (res && res.error) || `${sub} failed` }));
    process.exit(1);
  }
  console.log(JSON.stringify(res, null, 2));
  process.exit(0);
}

// feature: a product registers what it has, especially what only it has (用户 10-19：“问对方有什么独家生态，然后写到
// 面板里或者自己主动注册功能……独家功能和闭源程度”). Appends to channels/probe/features.jsonl; the matrix page shows it.
//   feature --agent X --name <功能名> --what <做什么> --entry <入口> --exclusive 独家|别家也有|不确定
//           --openness 开源|公开接口|只能界面|不开放 --evidence 试过|看到|推测 [--how <实现路径>] [--note <说明>]
//   feature --list [--agent X]
// --how is the way it is done, e.g. for browser automation: 浏览器调试接口（CDP）、视觉识别（截图）、DOM 解析、无障碍树、
// 系统级鼠标键盘、官方接口、命令行 (用户 10-19：“能力的实现路径也得说啊”).
const FEATURE_VALUES = { exclusive: ['独家', '别家也有', '不确定'], openness: ['开源', '公开接口', '只能界面', '不开放'], evidence: ['试过', '看到', '推测'] };
function cmdFeature(args) {
  const file = path.join(ROOT_DIR, 'channels', 'probe', 'features.jsonl');
  const prof = args.agent || args.channel ? resolveProfile(args.agent || args.channel) : null;
  const product = prof ? prof.id : args.agent || args.channel;
  if (args.list) {
    let rows = [];
    try {
      rows = fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(Boolean).map((l) => JSON.parse(l));
    } catch {}
    for (const r of rows.filter((r) => !product || r.product === product)) console.log(`${r.product}\t${r.name}\t${r.exclusive}\t${r.openness}\t${r.evidence}\t${r.what}`);
    process.exit(0);
  }
  const bad = [];
  if (!product) bad.push('--agent');
  for (const k of ['name', 'what', 'entry']) if (!String(args[k] || '').trim()) bad.push('--' + k);
  for (const [k, ok] of Object.entries(FEATURE_VALUES)) if (!ok.includes(args[k])) bad.push(`--${k} ${ok.join('|')}`);
  if (bad.length) {
    console.error(JSON.stringify({ ok: false, error: '缺少或填错：' + bad.join('，') }));
    process.exit(1);
  }
  const row = { at: new Date().toISOString(), product, name: String(args.name).trim(), what: String(args.what).trim(), entry: String(args.entry).trim(), exclusive: args.exclusive, openness: args.openness, evidence: args.evidence, how: args.how ? String(args.how).trim() : undefined, note: args.note ? String(args.note).trim() : undefined, by: args.by || product };
  fs.appendFileSync(file, JSON.stringify(row) + '\n');
  console.log(JSON.stringify({ ok: true, registered: row }));
  process.exit(0);
}

// note: a remark on one capability of one product — a registered unit (its id) or a feature (its name): what it costs,
// how fast or steady it is, and free tags (用户 10-19：“各项能力都可以加注释，比如成本评估，性能评估，特征标记什么的”).
// Appends to channels/probe/annotations.jsonl; the matrix page shows the latest remark per product and capability.
//   note --agent X --on <单元 id 或功能名> [--how <实现路径>] [--cost <成本>] [--perf <性能>] [--tags 词,词] [--text <说明>]
//        --evidence 试过|看到|推测
function cmdNote(args) {
  const prof = args.agent || args.channel ? resolveProfile(args.agent || args.channel) : null;
  const product = prof ? prof.id : args.agent || args.channel;
  const on = String(args.on || '').trim();
  const tags = String(args.tags || '').split(/[,，、]/).map((t) => t.trim()).filter(Boolean);
  const bad = [];
  if (!product) bad.push('--agent');
  if (!on) bad.push('--on');
  if (!args.how && !args.cost && !args.perf && !tags.length && !args.text) bad.push('--how / --cost / --perf / --tags / --text 至少一项');
  if (!FEATURE_VALUES.evidence.includes(args.evidence)) bad.push('--evidence 试过|看到|推测');
  if (bad.length) {
    console.error(JSON.stringify({ ok: false, error: '缺少或填错：' + bad.join('，') }));
    process.exit(1);
  }
  const row = { at: new Date().toISOString(), product, on, how: args.how ? String(args.how) : undefined, cost: args.cost ? String(args.cost) : undefined, perf: args.perf ? String(args.perf) : undefined, tags: tags.length ? tags : undefined, text: args.text ? String(args.text) : undefined, evidence: args.evidence, by: args.by || product };
  fs.appendFileSync(path.join(ROOT_DIR, 'channels', 'probe', 'annotations.jsonl'), JSON.stringify(row) + '\n');
  console.log(JSON.stringify({ ok: true, noted: row }));
  process.exit(0);
}

// recall: look back over a session's past conversation (unit recall-history, 回顾对话记录). Some products let the
// agent read its own long history (Claude desktop); for the rest the center offers it from the record it already
// reads in full (probe_display.mjs checks that reading against the raw records).
//   recall --id <会话编号> | --agent X --session <中心里的会话名>
//          [--who user|agent|all] [--grep 词] [--turns 3-10] [--last 5] [--max 600，0 = 全文]
// One block per turn: turn number and time, then the person's words (and with --who agent|all, the agent's reply).
function cmdRecall(args) {
  if (!ensureSharedDaemon()) {
    console.error(JSON.stringify({ ok: false, error: 'the 8899 daemon is not running and could not be started' }));
    process.exit(2);
  }
  let id = args.id || args._[1];
  if (!id && args.session) {
    const prof = resolveProfile(args.agent || args.channel);
    const list = callSharedDaemon('/api/sessions?slim=1', 'GET', null, 90);
    const hit = ((list && list.sessions) || []).find((s) => (!prof || s.channel === prof.id) && (s.controlName === args.session || s.name === args.session));
    if (!hit) {
      console.error(JSON.stringify({ ok: false, error: `没找到会话 ${args.session}；用 sessions --agent ${args.agent || 'X'} 查编号，再 recall --id <编号>` }));
      process.exit(1);
    }
    id = hit.id;
  }
  if (!id) {
    console.error(JSON.stringify({ ok: false, error: 'recall --id <会话编号>，或 --agent X --session <会话名>' }));
    process.exit(1);
  }
  const res = callSharedDaemon(`/api/sessions/${encodeURIComponent(id)}`, 'GET', null, 120);
  const s = res && res.session;
  if (!s) {
    console.error(JSON.stringify({ ok: false, error: (res && res.error) || `读不到会话 ${id}` }));
    process.exit(1);
  }
  const who = ['user', 'agent', 'all'].includes(args.who) ? args.who : 'user';
  const grep = String(args.grep || '').toLowerCase();
  // Pasted documents make a person's message thousands of characters long: show the start unless asked for all.
  const max = args.max === undefined ? 600 : Number(args.max);
  const cut = (t) => (max > 0 && t.length > max ? `${t.slice(0, max)}…（共 ${t.length} 字，--max 0 看全文）` : t);
  let turns = s.turns || [];
  const range = /^(\d+)-(\d+)$/.exec(String(args.turns || ''));
  if (range) turns = turns.filter((t) => t.index >= Number(range[1]) && t.index <= Number(range[2]));
  if (args.last) turns = turns.slice(-Number(args.last));
  const out = [];
  for (const t of turns) {
    const said = (t.steps || []).filter((x) => x.kind === 'message' && x.role === 'user').map((x) => String(x.text || '').trim()).filter(Boolean);
    const reply = String(t.output || '').trim();
    const parts = [];
    if (who !== 'agent') for (const w of said) parts.push(`人：${w}`);
    if (who !== 'user' && reply) parts.push(`智能体：${reply}`);
    if (!parts.length || (grep && !parts.some((p) => p.toLowerCase().includes(grep)))) continue;
    out.push(`── 第 ${t.index} 轮 · ${String(t.startedAt || '').replace('T', ' ').slice(0, 16)}\n${parts.map(cut).join('\n')}`);
  }
  console.log(`${s.title || id}（${id}，共 ${(s.turns || []).length} 轮）${out.length ? '' : '\n没有符合条件的记录'}`);
  if (out.length) console.log(out.join('\n\n'));
  process.exit(0);
}

// Thin commands over the service's other actions (hub/data/actions.json names the endpoint of each):
//   sessions [--agent X] [--q 文字] [--limit 30]          sessions on this machine, newest first (one line each)
//   session --id <会话编号> [--tail 5]                     one session: turns and steps
//   search --q <文字>                                      full-text search over all sessions
//   state                                                  the service: products, running turns, pending approvals
//   approve --id <审批编号> [--reject]                      answer an approval (the turn waiting on it continues)
//   answer --id <问题编号> --text <答案>                  answer a question an agent asked mid-turn (or --answers JSON by question id)
//   model --agent X --session <名> --model <模型>           switch a session's model
//   session-control --agent X --session <名> --op mode|compact|fork|effort [--value ..] [--new-session <名>]
function cmdApi(args, sub) {
  if (!ensureSharedDaemon()) {
    console.error(JSON.stringify({ ok: false, error: 'the 8899 daemon is not running and could not be started' }));
    process.exit(2);
  }
  const agentId = () => {
    const p = resolveProfile(args.agent || args.channel);
    return p ? p.id : args.agent || args.channel;
  };
  let res;
  if (sub === 'sessions') {
    res = callSharedDaemon('/api/sessions?slim=1', 'GET', null, 90);
    if (res && Array.isArray(res.sessions)) {
      const q = String(args.q || '').toLowerCase();
      const ch = args.agent || args.channel ? agentId() : '';
      const rows = res.sessions
        .filter((s) => (!ch || s.channel === ch) && (!q || String(s.title || s.name || '').toLowerCase().includes(q)))
        .slice(0, Number(args.limit) || 30)
        // The slim list gives state as a string ("working"); the full one as { status }.
        .map((s) => `${s.id}\t${s.channel}\t${(typeof s.state === 'string' ? s.state : s.state && s.state.status) || s.status || ''}\t${s.updatedAt || ''}\t${String(s.title || s.name || '').replace(/\s+/g, ' ').slice(0, 60)}`);
      console.log(rows.join('\n'));
      process.exit(0);
    }
  } else if (sub === 'session') {
    const id = args.id || args._[1];
    res = callSharedDaemon(`/api/sessions/${encodeURIComponent(id)}${args.tail ? `?tail=${Number(args.tail)}` : ''}`, 'GET', null, 90);
  } else if (sub === 'search') {
    res = callSharedDaemon(`/api/search?q=${encodeURIComponent(args.q || args._[1] || '')}`, 'GET', null, 60);
  } else if (sub === 'pick') {
    // pick [--candidates zcode,hermes] [--exclude codex]: who the center would give a piece of work to now, and why
    const qs = [args.candidates ? `candidates=${encodeURIComponent(args.candidates)}` : '', args.exclude ? `exclude=${encodeURIComponent(args.exclude)}` : ''].filter(Boolean).join('&');
    res = callSharedDaemon(`/api/gateway/pick${qs ? '?' + qs : ''}`, 'GET', null, 20);
  } else if (sub === 'state') {
    res = callSharedDaemon('/api/gateway/state', 'GET', null, 30);
  } else if (sub === 'approve') {
    res = callSharedDaemon('/api/gateway/approve', 'POST', { id: args.id || args._[1], decision: args.reject ? 'reject' : 'approve' }, 30);
  } else if (sub === 'answer') {
    // answer --id q_... --text "选 B"   (one answer for every question), or --answers '{"<question id>":"..."}'
    res = callSharedDaemon('/api/gateway/answer', 'POST', { id: args.id || args._[1], answer: args.text, answers: args.answers ? JSON.parse(args.answers) : undefined }, 30);
  } else if (sub === 'model') {
    res = callSharedDaemon('/api/gateway/model', 'POST', { channel: agentId(), sessionName: args.session, model: args.model }, 30);
  } else if (sub === 'session-control') {
    res = callSharedDaemon('/api/gateway/session-control', 'POST', { channel: agentId(), sessionName: args.session, op: args.op, value: args.value, newSessionName: args['new-session'] }, 240);
  }
  if (!res || res.ok === false) {
    console.error(JSON.stringify({ ok: false, error: (res && res.error) || `${sub} failed` }));
    process.exit(1);
  }
  console.log(JSON.stringify(res, null, 2));
  process.exit(0);
}

function cmdCollabEvent(args, kind) {
  if (!ensureSharedDaemon()) {
    console.error(JSON.stringify({ ok: false, error: 'the 8899 daemon is not running and could not be started' }));
    process.exit(2);
  }
  const id = args.id || args._[1];
  const prof = args.agent || args.channel ? resolveProfile(args.agent || args.channel) : null;
  const files = args.files
    ? String(args.files)
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean)
    : undefined;
  const body = {
    id: id || undefined,
    channel: prof ? prof.id : args.channel || undefined,
    sessionName: args.session || undefined,
    kind,
    summary: args.summary || args.text || args.message || undefined,
    text: args.text || args.summary || args.message || undefined,
    reply: args.reply || undefined,
    waitingFor: args['waiting-for'] || args.waiting || args.text || undefined,
    files,
    via: 'cli',
  };
  const res = callSharedDaemon('/api/gateway/collab-event', 'POST', body, 25);
  if (!res || !res.ok) {
    console.error(JSON.stringify({ ok: false, error: (res && res.error) || `collab-event (${kind}) failed` }));
    process.exit(1);
  }
  console.log(JSON.stringify(res, null, 2));
  process.exit(0);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const sub = args._[0] || 'targets';
  if (sub === 'targets' || sub === 'list') return cmdTargets(args);
  if (sub === 'status') return cmdStatus(args);
  if (sub === 'quota' || sub === 'balance') return cmdQuota(args);
  if (sub === 'run' || sub === 'exec') return cmdRun(args);
  if (sub === 'cancel') return cmdCancel(args);
  if (sub === 'read') return cmdReadWait(args, false);
  if (sub === 'wait') return cmdReadWait(args, true);
  if (sub === 'handoff') return cmdHandoff(args);
  if (sub === 'dispatch') return cmdDispatch(args);
  if (sub === 'dispatches') return cmdDispatches(args, false);
  if (sub === 'dispatch-wait') return cmdDispatches(args, true);
  if (sub === 'goals' || sub === 'goal' || sub === 'goal-action' || sub === 'task-action') return cmdGoal(args, sub);
  if (sub === 'recall') return cmdRecall(args);
  if (sub === 'feature') return cmdFeature(args);
  if (sub === 'note') return cmdNote(args);
  if (['sessions', 'session', 'search', 'state', 'pick', 'approve', 'answer', 'model', 'session-control'].includes(sub)) return cmdApi(args, sub);
  if (sub === 'deliver') return cmdCollabEvent(args, 'deliver');
  if (sub === 'report') return cmdCollabEvent(args, 'report');
  if (sub === 'yield') return cmdCollabEvent(args, 'yield');
  if (sub === 'reclaim') return cmdCollabEvent(args, 'reclaim');
  if (sub === 'patrol') return cmdPatrol(args);
  // The four tables of the pipeline (channels/README.md 管线): products, actions, unit → action, checked against the code.
  // One command to test the backend for real, unit by unit, following the four tables (channels/probe/scripts/verify.js).
  if (sub === 'verify') {
    const r = spawnSync(process.execPath, [path.join(ROOT_DIR, 'channels', 'probe', 'scripts', 'verify.js'), ...process.argv.slice(3)], { stdio: 'inherit' });
    process.exit(r.status || 0);
  }
  if (sub === 'tables') {
    const t = require(path.join(ROOT_DIR, 'channels', 'probe', 'scripts', 'tables.js'));
    const tb = t.load();
    const problems = t.check(tb);
    console.log(t.print(tb) + '\n');
    console.log(problems.length ? `核对：${problems.length} 处对不上\n` + problems.map((x) => '  - ' + x).join('\n') : '核对：四张表和代码全部对上');
    return;
  }
  console.error(`Unknown subcommand: ${sub}. Expected: targets | status | quota | run | read | wait | cancel | handoff | dispatch | dispatches | dispatch-wait | deliver | report | yield | reclaim | patrol | tables`);
  process.exit(1);
}

main();
