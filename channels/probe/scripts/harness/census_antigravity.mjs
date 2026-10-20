/**
 * census_antigravity.mjs
 *
 * 全量普查本机 Google Antigravity 会话与 Harness 痕迹
 * 扫描范围：
 *   1. ~/.gemini/antigravity/brain/<cid>/.system_generated/logs/transcript.jsonl
 *   2. ~/.gemini/antigravity/brain/<cid>/.system_generated/ (messages, steps, tasks, subagents, click_feedback)
 *   3. ~/.gemini/antigravity/conversation_summaries.db
 *   4. ~/.gemini/antigravity/conversations/<cid>.db
 *   5. ~/.gemini/config/ (projects, skills, rules)
 *
 * 输出：
 *   channels/research/harness/antigravity-census.json
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { DatabaseSync } from 'node:sqlite';

const HOME = os.homedir();
const AGY_DIR = path.join(HOME, '.gemini', 'antigravity');
const BRAIN_DIR = path.join(AGY_DIR, 'brain');
const CONV_DIR = path.join(AGY_DIR, 'conversations');
const SUMMARIES_DB = path.join(AGY_DIR, 'conversation_summaries.db');
const SCRIPT_DIR = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const REPO_ROOT = path.resolve(SCRIPT_DIR, '../../../..');
const OUTPUT_FILE = path.join(REPO_ROOT, 'channels/research/harness/antigravity-census.json');

console.log('Starting full Antigravity harness census...');

const census = {
  meta: {
    product: 'Google Antigravity',
    harnessVersion: 'hub-2.23.1 (Connect-RPC + Cortex Planner + Task/Subagent System)',
    scanTime: new Date().toISOString(),
    totalBrainDirectories: 0,
    totalTranscriptFiles: 0,
    totalTranscriptLines: 0,
    totalConversationDbs: 0,
  },
  recordTypes: {},
  sources: {},
  toolCalls: {},
  subagents: {
    totalFiles: 0,
    stateCounts: {},
    typeNames: {},
    roles: {},
    sample: null,
  },
  tasks: {
    totalFiles: 0,
    sample: null,
  },
  steps: {
    totalStepOutputDirs: 0,
    sample: null,
  },
  messages: {
    totalFiles: 0,
    priorities: {},
    renderDetailsTitles: {},
    sample: null,
  },
  compaction: {
    totalCheckpointRecords: 0,
    sample: null,
  },
  longTermMemory: {
    totalConversationHistoryRecords: 0,
    sample: null,
  },
  databaseCensus: {
    summariesDb: {
      totalRows: 0,
      columns: [],
      statusDistribution: {},
      nestingDepthDistribution: {},
    },
    conversationDbs: {
      totalFiles: 0,
      sampleDbSchema: {},
    },
  },
  harnessClassification: {
    '上下文装配 (Context Assembly)': [
      'USER_INPUT',
      'CONVERSATION_HISTORY',
      'SYSTEM_MESSAGE[priority=HIGH]',
      'PreInvocation Hook injectionSteps'
    ],
    '预算与压缩 (Budget & Compaction)': [
      'CHECKPOINT (Resuming from a compaction)',
      'transcript.jsonl compact view vs transcript_full.jsonl',
      'input_tokens / cache_read_tokens / output_tokens usage tracking'
    ],
    '工具系统 (Tool System)': [
      'PLANNER_RESPONSE.tool_calls',
      'GENERIC (Tool output / execution return)',
      'steps/<step_index>/output.txt (spillover output)',
      '25+ built-in & MCP tools (view_file, run_command, manage_task, etc.)'
    ],
    '组织 (Organization: Loop/Subagents/Tasks/Hooks)': [
      'subagents/<subagentId>.json (subagent registry & alive state)',
      'messages/<msgId>.json (inter-agent & parent-child message envelope)',
      'tasks/task-<id>.log (background task manager & reactive wakeup)',
      'conversation_summaries.nesting_depth (up to depth 10)',
      'loopErrorModelMessage (loop guard breaker)'
    ],
    '记忆与持久化 (Memory & Persistence)': [
      'conversation_summaries.db (SQLite FTS5 + conversation metadata)',
      'conversations/<cid>.db (Per-conversation SQLite trajectory)',
      'presence/<cid>.lock (Process lock & concurrency lease)',
      'CHECKPOINT summary extraction'
    ],
    '可观测 (Observability)': [
      'PLANNER_RESPONSE.thinking (Chain-of-thought CoT)',
      'gen_metadata (Token latency, generation parameters)',
      'status DONE / ERROR / RUNNING',
      'ERROR_MESSAGE (API retries & interrupt reasons)'
    ]
  }
};

// 1. Scan Brain directories
if (fs.existsSync(BRAIN_DIR)) {
  const cids = fs.readdirSync(BRAIN_DIR);
  census.meta.totalBrainDirectories = cids.length;

  for (const cid of cids) {
    const sessionDir = path.join(BRAIN_DIR, cid);
    const sg = path.join(sessionDir, '.system_generated');
    if (!fs.existsSync(sg)) continue;

    // A. Transcript scan
    const tf = path.join(sg, 'logs', 'transcript.jsonl');
    if (fs.existsSync(tf)) {
      census.meta.totalTranscriptFiles++;
      const text = fs.readFileSync(tf, 'utf8');
      for (const line of text.split('\n')) {
        if (!line.trim()) continue;
        census.meta.totalTranscriptLines++;
        try {
          const rec = JSON.parse(line);
          const t = rec.type || 'UNKNOWN';
          const s = rec.source || 'UNKNOWN';

          census.sources[s] = (census.sources[s] || 0) + 1;

          if (!census.recordTypes[t]) {
            census.recordTypes[t] = {
              count: 0,
              fields: {},
              statuses: {},
              sample: null,
            };
          }
          const rt = census.recordTypes[t];
          rt.count++;
          if (rec.status) rt.statuses[rec.status] = (rt.statuses[rec.status] || 0) + 1;

          for (const k of Object.keys(rec)) {
            rt.fields[k] = (rt.fields[k] || 0) + 1;
          }

          if (!rt.sample) {
            // Desensitize sample
            const clone = { ...rec };
            if (typeof clone.content === 'string' && clone.content.length > 300) {
              clone.content = clone.content.slice(0, 300) + '... [truncated]';
            }
            if (typeof clone.thinking === 'string' && clone.thinking.length > 300) {
              clone.thinking = clone.thinking.slice(0, 300) + '... [truncated]';
            }
            rt.sample = clone;
          }

          // Tool calls tracking
          if (Array.isArray(rec.tool_calls)) {
            for (const tc of rec.tool_calls) {
              const name = tc.name || (tc.function && tc.function.name) || 'unknown';
              if (!census.toolCalls[name]) {
                census.toolCalls[name] = {
                  count: 0,
                  argKeys: {},
                  sampleArgs: null,
                };
              }
              const tcItem = census.toolCalls[name];
              tcItem.count++;
              const args = tc.args || (tc.function && tc.function.arguments);
              if (args && typeof args === 'object') {
                for (const ak of Object.keys(args)) {
                  tcItem.argKeys[ak] = (tcItem.argKeys[ak] || 0) + 1;
                }
                if (!tcItem.sampleArgs) tcItem.sampleArgs = Object.keys(args);
              }
            }
          }

          // Checkpoint
          if (t === 'CHECKPOINT' && !census.compaction.sample) {
            census.compaction.sample = {
              step_index: rec.step_index,
              status: rec.status,
              created_at: rec.created_at,
              truncated_fields: rec.truncated_fields,
              contentPreview: String(rec.content || '').slice(0, 500) + '...',
            };
          }
          if (t === 'CHECKPOINT') census.compaction.totalCheckpointRecords++;

          // Conversation history
          if (t === 'CONVERSATION_HISTORY' && !census.longTermMemory.sample) {
            census.longTermMemory.sample = {
              step_index: rec.step_index,
              created_at: rec.created_at,
              contentPreview: String(rec.content || '').slice(0, 500) + '...',
            };
          }
          if (t === 'CONVERSATION_HISTORY') census.longTermMemory.totalConversationHistoryRecords++;

        } catch {}
      }
    }

    // B. Subagents scan
    const subDir = path.join(sg, 'subagents');
    if (fs.existsSync(subDir)) {
      const files = fs.readdirSync(subDir);
      for (const f of files) {
        census.subagents.totalFiles++;
        try {
          const sub = JSON.parse(fs.readFileSync(path.join(subDir, f), 'utf8'));
          const st = sub.state || 'UNKNOWN';
          census.subagents.stateCounts[st] = (census.subagents.stateCounts[st] || 0) + 1;
          const tn = sub.subagentDescriptor?.typeName || 'UNKNOWN';
          census.subagents.typeNames[tn] = (census.subagents.typeNames[tn] || 0) + 1;
          const ro = sub.subagentDescriptor?.role || 'UNKNOWN';
          census.subagents.roles[ro] = (census.subagents.roles[ro] || 0) + 1;
          if (!census.subagents.sample) census.subagents.sample = sub;
        } catch {}
      }
    }

    // C. Tasks scan
    const tasksDir = path.join(sg, 'tasks');
    if (fs.existsSync(tasksDir)) {
      const files = fs.readdirSync(tasksDir);
      census.tasks.totalFiles += files.length;
      if (!census.tasks.sample && files.length > 0) {
        census.tasks.sample = {
          file: files[0],
          sizeBytes: fs.statSync(path.join(tasksDir, files[0])).size,
        };
      }
    }

    // D. Steps scan
    const stepsDir = path.join(sg, 'steps');
    if (fs.existsSync(stepsDir)) {
      const subDirs = fs.readdirSync(stepsDir);
      census.steps.totalStepOutputDirs += subDirs.length;
      if (!census.steps.sample && subDirs.length > 0) {
        census.steps.sample = {
          stepDir: subDirs[0],
          files: fs.readdirSync(path.join(stepsDir, subDirs[0])),
        };
      }
    }

    // E. Messages scan
    const msgsDir = path.join(sg, 'messages');
    if (fs.existsSync(msgsDir)) {
      const files = fs.readdirSync(msgsDir);
      for (const f of files) {
        census.messages.totalFiles++;
        try {
          const msg = JSON.parse(fs.readFileSync(path.join(msgsDir, f), 'utf8'));
          const pr = msg.priority || 'UNKNOWN';
          census.messages.priorities[pr] = (census.messages.priorities[pr] || 0) + 1;
          const rt = msg.renderDetails?.messageTitle || 'UNKNOWN';
          census.messages.renderDetailsTitles[rt] = (census.messages.renderDetailsTitles[rt] || 0) + 1;
          if (!census.messages.sample) {
            census.messages.sample = {
              id: msg.id,
              priority: msg.priority,
              renderDetails: msg.renderDetails,
              contentPreview: String(msg.content || '').slice(0, 150) + '...',
            };
          }
        } catch {}
      }
    }
  }
}

// 2. Scan SQLite conversation_summaries.db
if (fs.existsSync(SUMMARIES_DB)) {
  try {
    const db = new DatabaseSync(SUMMARIES_DB, { readOnly: true });
    census.databaseCensus.summariesDb.totalRows = db.prepare('SELECT count(1) as c FROM conversation_summaries').get().c;
    census.databaseCensus.summariesDb.columns = db.prepare('PRAGMA table_info(conversation_summaries)').all().map(c => c.name);

    const statuses = db.prepare('SELECT status, count(1) as c FROM conversation_summaries GROUP BY status').all();
    for (const r of statuses) {
      census.databaseCensus.summariesDb.statusDistribution[r.status] = r.c;
    }

    const depths = db.prepare('SELECT nesting_depth, count(1) as c FROM conversation_summaries GROUP BY nesting_depth').all();
    for (const r of depths) {
      census.databaseCensus.summariesDb.nestingDepthDistribution[r.nesting_depth] = r.c;
    }
    db.close();
  } catch (err) {
    console.error('Error reading summaries db:', err.message);
  }
}

// 3. Scan conversations/<cid>.db
if (fs.existsSync(CONV_DIR)) {
  const convFiles = fs.readdirSync(CONV_DIR);
  census.meta.totalConversationDbs = convFiles.length;
  census.databaseCensus.conversationDbs.totalFiles = convFiles.length;

  if (convFiles.length > 0) {
    try {
      const sampleDb = path.join(CONV_DIR, convFiles[0]);
      const db = new DatabaseSync(sampleDb, { readOnly: true });
      const tables = db.prepare('SELECT name FROM sqlite_master WHERE type=\x27table\x27').all();
      for (const t of tables) {
        const cols = db.prepare('PRAGMA table_info(' + t.name + ')').all().map(c => c.name);
        census.databaseCensus.conversationDbs.sampleDbSchema[t.name] = cols;
      }
      db.close();
    } catch (err) {
      console.error('Error reading conv db:', err.message);
    }
  }
}

fs.writeFileSync(OUTPUT_FILE, JSON.stringify(census, null, 2), 'utf8');
console.log('Antigravity census completed! Written to:', OUTPUT_FILE);
