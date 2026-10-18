// Watch Antigravity conversations until all are idle (status from conversation_summaries.db) or a deadline passes.
// Usage: node watch_agy.js <maxSeconds> <session-name-or-cid>...
const { DatabaseSync } = require('node:sqlite');
const fs = require('fs');
const os = require('os');
const path = require('path');

const [maxSec, ...names] = process.argv.slice(2);
const map = JSON.parse(fs.readFileSync(path.join(os.homedir(), '.acpx', 'agy-sessions.json'), 'utf8'));
const cids = names.map((n) => map[n] || n);
const dbPath = path.join(os.homedir(), '.gemini', 'antigravity', 'conversation_summaries.db');
const deadline = Date.now() + Number(maxSec || 2880) * 1000;
const last = {};

function poll() {
  const db = new DatabaseSync(dbPath, { readOnly: true });
  const rows = cids.map((c) =>
    db.prepare('select title, status, not_fully_idle as busy, step_count as steps from conversation_summaries where conversation_id = ?').get(c) || { title: c, status: 'MISSING', busy: 0, steps: 0 },
  );
  db.close();
  for (const r of rows) {
    const s = `${r.status.replace('CASCADE_RUN_STATUS_', '')}/${r.busy}`;
    if (last[r.title] !== s) console.log(new Date().toISOString().slice(11, 19), r.title, s, 'steps=' + r.steps);
    last[r.title] = s;
  }
  return rows;
}

// IDLE with not_fully_idle=1 means "yielded, waiting on its own background task". If that lasts
// STALL_MS without a new step, the background task is probably hung: count the session as stopped.
const STALL_MS = 10 * 60_000;
const seen = {};
const stopped = (r) => {
  const s = seen[r.title] || (seen[r.title] = { steps: -1, at: Date.now() });
  if (s.steps !== r.steps) Object.assign(s, { steps: r.steps, at: Date.now() });
  if (r.status.endsWith('RUNNING')) return false;
  if (!Number(r.busy)) return true;
  return Date.now() - s.at > STALL_MS;
};

(function loop() {
  const rows = poll();
  const done = rows.map(stopped);
  if (done.every(Boolean)) {
    const stalled = rows.filter((r) => Number(r.busy)).map((r) => r.title);
    return console.log('ALL STOPPED' + (stalled.length ? `; yielded >10min with no new step (probably hung): ${stalled.join(', ')}` : ''));
  }
  if (Date.now() > deadline) return console.log('DEADLINE; still busy:', rows.filter((r) => Number(r.busy)).map((r) => r.title).join(', '));
  setTimeout(loop, 30000);
})();
