const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const BB = path.join(ROOT, 'channels', 'probe', 'blackboard.jsonl');
const rows = fs.readFileSync(BB, 'utf8').split('\n').filter(Boolean)
  .map(l => { try { return JSON.parse(l); } catch { return null; } })
  .filter(Boolean);

const caps = ['ask-user', 'human-steer', 'browser', 'channel-health'];

for (const c of caps) {
  const matches = rows.filter(r => r.capability === c);
  console.log('=== ' + c + ' (total: ' + matches.length + ') ===');
  matches.forEach(r => {
    console.log('  [' + r.family + '] ' + r.layer + ' (' + r.route + ') -> ' + r.result + ' | ' + (r.note || '') + ' | ' + (r.evidence || '').slice(0, 60));
  });
}
