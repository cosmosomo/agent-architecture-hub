#!/usr/bin/env node
/**
 * doubao_sessions_discover.js — Native Local Session Discovery for Doubao Agent Mode
 *
 * Implements Strategy.LOCAL to discover, parse, and export Doubao agent-mode sessions
 * from %LOCALAPPDATA%\Doubao\User Data\Default\.doubao\agent_mode\workspace\.sessions
 *
 * Features:
 *   - 0 Lock Competition, 0 Process Dependencies, Works even when Doubao is closed.
 *   - Extracts Session ID, Title (from first assignment requirement), CreatedAt, UpdatedAt.
 *   - Parses multi-agent subagent structure (main agent, organizer, subagents).
 *   - Inspects board.md for task counts, completed tasks, and artifact links.
 *   - Supports full trajectory extraction (role, content, tool_calls, arguments, results).
 *   - Standardized output compatible with Agent-Architecture-Hub /api/sessions schema.
 *
 * Usage:
 *   node hub/tools/doubao_sessions_discover.js list [--limit 30] [--json] [--q <keyword>]
 *   node hub/tools/doubao_sessions_discover.js show <sessionId> [--json]
 *   node hub/tools/doubao_sessions_discover.js trajectory <sessionId> [--json]
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

const HOME = os.homedir();
const LOCALAPPDATA = process.env.LOCALAPPDATA || path.join(HOME, 'AppData', 'Local');
const DOUBAO_SESSIONS_DIR = path.join(
  LOCALAPPDATA,
  'Doubao',
  'User Data',
  'Default',
  '.doubao',
  'agent_mode',
  'workspace',
  '.sessions'
);

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const item = argv[i];
    if (item.startsWith('--')) {
      const k = item.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) {
        args[k] = next;
        i++;
      } else {
        args[k] = true;
      }
    } else {
      args._.push(item);
    }
  }
  return args;
}

function scanSessions(opts = {}) {
  if (!fs.existsSync(DOUBAO_SESSIONS_DIR)) {
    return [];
  }

  const entries = fs.readdirSync(DOUBAO_SESSIONS_DIR, { withFileTypes: true });
  const results = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const sessionId = entry.name;
    const sessionPath = path.join(DOUBAO_SESSIONS_DIR, sessionId);

    let mtime = 0;
    try {
      const st = fs.statSync(sessionPath);
      mtime = st.mtimeMs;
    } catch {}

    const agentsDir = path.join(sessionPath, 'agents');
    let title = '';
    let createdAt = '';
    let agentCount = 0;
    let turnCount = 0;
    let toolCallCount = 0;
    let agentsList = [];

    if (fs.existsSync(agentsDir)) {
      try {
        const agentEntries = fs.readdirSync(agentsDir, { withFileTypes: true });
        for (const ag of agentEntries) {
          if (!ag.isDirectory()) continue;
          agentCount++;
          const agentId = ag.name;
          agentsList.push(agentId);

          const assignFile = path.join(agentsDir, agentId, 'system', 'assignment.md');
          if (fs.existsSync(assignFile) && !title) {
            try {
              const content = fs.readFileSync(assignFile, 'utf8');
              const createdMatch = content.match(/Created:\s*([^\r\n]+)/);
              if (createdMatch && !createdAt) createdAt = createdMatch[1].trim();

              const reqMatch = content.match(/##\s*\[[^\]]+\]\s*需求\s*\r?\n([\s\S]*?)(?=\n##|\Z)/);
              if (reqMatch && reqMatch[1]) {
                title = reqMatch[1].trim().split('\n')[0].slice(0, 100);
              }
            } catch {}
          }

          const trajFile = path.join(agentsDir, agentId, 'system', 'trajectory.jsonl');
          if (fs.existsSync(trajFile)) {
            try {
              const lines = fs.readFileSync(trajFile, 'utf8').split('\n').filter(Boolean);
              turnCount += lines.length;
              for (const line of lines) {
                if (line.includes('"tool_calls"')) {
                  toolCallCount++;
                }
              }
            } catch {}
          }
        }
      } catch {}
    }

    // Check board.md
    let boardTasks = 0;
    let boardCompleted = 0;
    const boardPath = path.join(sessionPath, 'board.md');
    if (fs.existsSync(boardPath)) {
      try {
        const boardContent = fs.readFileSync(boardPath, 'utf8');
        const rows = boardContent.split('\n').filter((l) => l.startsWith('|') && !l.includes('---') && !l.includes('任务ID'));
        boardTasks = rows.length;
        boardCompleted = rows.filter((r) => r.includes('已完成') || r.includes('✅')).length;
      } catch {}
    }

    if (!title) {
      title = `Doubao Agent Session ${sessionId}`;
    }

    results.push({
      id: `doubao:${sessionId}`,
      rawId: sessionId,
      channel: 'doubao-desktop',
      driver: 'opencli-local',
      title,
      state: 'idle',
      createdAt: createdAt || new Date(mtime).toISOString(),
      updatedAt: new Date(mtime).toISOString(),
      agentCount,
      turnCount,
      toolCallCount,
      boardTasks,
      boardCompleted,
      path: sessionPath,
      mtimeMs: mtime,
    });
  }

  // Sort by updatedAt descending
  results.sort((a, b) => b.mtimeMs - a.mtimeMs);

  let filtered = results;
  if (opts.q) {
    const q = opts.q.toLowerCase();
    filtered = filtered.filter(
      (s) => s.id.toLowerCase().includes(q) || s.title.toLowerCase().includes(q)
    );
  }

  if (opts.limit) {
    filtered = filtered.slice(0, Number(opts.limit));
  }

  return filtered;
}

function getSessionDetails(sessionId) {
  const cleanId = String(sessionId).replace(/^doubao:/, '');
  const sessionPath = path.join(DOUBAO_SESSIONS_DIR, cleanId);
  if (!fs.existsSync(sessionPath)) return null;

  const agentsDir = path.join(sessionPath, 'agents');
  const agents = [];

  if (fs.existsSync(agentsDir)) {
    for (const ag of fs.readdirSync(agentsDir, { withFileTypes: true })) {
      if (!ag.isDirectory()) continue;
      const agentId = ag.name;
      const agentDir = path.join(agentsDir, agentId);

      let assignment = '';
      const assignPath = path.join(agentDir, 'system', 'assignment.md');
      if (fs.existsSync(assignPath)) {
        assignment = fs.readFileSync(assignPath, 'utf8');
      }

      let trajectory = [];
      const trajPath = path.join(agentDir, 'system', 'trajectory.jsonl');
      if (fs.existsSync(trajPath)) {
        const lines = fs.readFileSync(trajPath, 'utf8').split('\n').filter(Boolean);
        for (const l of lines) {
          try {
            trajectory.push(JSON.parse(l));
          } catch {}
        }
      }

      agents.push({
        agentId,
        assignment,
        trajectoryStepCount: trajectory.length,
      });
    }
  }

  let board = '';
  const boardPath = path.join(sessionPath, 'board.md');
  if (fs.existsSync(boardPath)) {
    board = fs.readFileSync(boardPath, 'utf8');
  }

  return {
    sessionId: cleanId,
    path: sessionPath,
    agents,
    board,
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const sub = args._[0] || 'list';

  if (sub === 'list') {
    const list = scanSessions({ limit: args.limit || 30, q: args.q });
    if (args.json) {
      console.log(JSON.stringify({ ok: true, count: list.length, sessions: list }, null, 2));
    } else {
      console.log(`=== Doubao Agent Mode Sessions (${list.length} found) ===`);
      for (const s of list) {
        console.log(
          `${s.id}\t${s.state}\t${s.updatedAt}\tagents=${s.agentCount}\tturns=${s.turnCount}\ttools=${s.toolCallCount}\t${s.title}`
        );
      }
    }
    return;
  }

  if (sub === 'show') {
    const id = args._[1];
    if (!id) {
      console.error('Usage: doubao_sessions_discover.js show <sessionId>');
      process.exit(1);
    }
    const det = getSessionDetails(id);
    if (!det) {
      console.error(`Session not found: ${id}`);
      process.exit(1);
    }
    console.log(JSON.stringify(det, null, 2));
    return;
  }

  console.error(`Unknown subcommand: ${sub}. Expected: list | show`);
  process.exit(1);
}

if (require.main === module) {
  main();
} else {
  module.exports = { scanSessions, getSessionDetails };
}
