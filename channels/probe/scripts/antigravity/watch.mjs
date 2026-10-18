// Watch a conversation until idle: poll transcript.jsonl for new steps and print
// them as they appear (observe-live), plus the conversation_summaries.db state row
// (state). Usage: node watch.mjs <conversationId> [timeoutSec=90] [--quiet-tail]
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const cid = process.argv[2];
const timeoutSec = Number(process.argv[3] || 90);
const HOME = process.env.USERPROFILE;
const tPath = path.join(HOME, '.gemini', 'antigravity', 'brain', cid, '.system_generated', 'logs', 'transcript.jsonl');
const dbPath = path.join(HOME, '.gemini', 'antigravity', 'conversation_summaries.db');

const dbRow = () => {
  try {
    const db = new DatabaseSync(dbPath, { readOnly: true });
    const row = db.prepare('select conversation_id, status, not_fully_idle, step_count from conversation_summaries where conversation_id = ?').get(cid);
    db.close();
    return row;
  } catch (e) { return { error: String(e.message) }; }
};

let seen = 0;
const t0 = Date.now();
let lastDbPrint = '';
while (Date.now() - t0 < timeoutSec * 1000) {
  let lines = [];
  try { lines = fs.readFileSync(tPath, 'utf8').trim().split(/\r?\n/).filter(Boolean); } catch {}
  for (let i = seen; i < lines.length; i++) {
    let s = null; try { s = JSON.parse(lines[i]); } catch {}
    if (!s) continue;
    const content = String(s.content ?? '').replace(/\s+/g, ' ').slice(0, 160);
    console.log(`[t+${((Date.now() - t0) / 1000).toFixed(1)}s] step=${s.step_index} type=${s.type} status=${s.status} model=${s.model ?? s.model_id ?? '?'} tokens=${s.input_tokens ?? '?'}/${s.output_tokens ?? '?'} tool_calls=${(s.tool_calls || []).length} :: ${content}`);
  }
  seen = lines.length;
  const row = dbRow();
  const sig = JSON.stringify(row);
  if (sig !== lastDbPrint) { console.log(`[t+${((Date.now() - t0) / 1000).toFixed(1)}s] db: ${sig}`); lastDbPrint = sig; }
  const last = lines.length ? JSON.parse(lines[lines.length - 1]) : null;
  if (
    last && last.type === 'PLANNER_RESPONSE' && last.status === 'DONE' &&
    (!last.tool_calls || last.tool_calls.length === 0) && row && Number(row.not_fully_idle) === 0 &&
    !String(row.status).endsWith('RUNNING')
  ) { console.log('WATCH_DONE_IDLE'); process.exit(0); }
  spawnSync('powershell.exe', ['-NoProfile', '-Command', 'Start-Sleep -Milliseconds 800'], { windowsHide: true });
}
console.log('WATCH_TIMEOUT');
process.exit(1);
