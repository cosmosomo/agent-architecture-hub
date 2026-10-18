const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const userProfile = process.env.USERPROFILE;
const opencodeDbPath = path.join(userProfile, '.local', 'share', 'opencode', 'opencode.db');

console.log('=== OPENCODE DB ===');
if (fs.existsSync(opencodeDbPath)) {
  const db = new DatabaseSync(opencodeDbPath, { open: true, readOnly: true });
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
  console.log('Tables:', tables.map(t => t.name).join(', '));
  tables.forEach(t => {
    const cols = db.prepare(`PRAGMA table_info(${t.name})`).all();
    console.log(`  Table ${t.name}:`, cols.map(c => c.name).join(', '));
    const count = db.prepare(`SELECT count(*) as c FROM ${t.name}`).get();
    console.log(`    count: ${count.c}`);
  });
} else {
  console.log('Not found:', opencodeDbPath);
}

// Check hermes db
console.log('\n=== HERMES DB / PATHS ===');
const hermesPaths = [
  path.join('E:', 'program', 'GIT', 'Agent', 'hermes and vcp like', 'hermes-agent', 'state.db'),
  path.join(userProfile, '.hermes', 'hermes.db'),
  path.join(userProfile, '.hermes', 'state.db'),
  path.join(userProfile, '.hermes', 'config.json'),
  path.join(userProfile, '.hermes', 'config.yaml'),
];
for (const p of hermesPaths) {
  if (fs.existsSync(p)) {
    console.log('Found:', p);
    if (p.endsWith('.db') || p.endsWith('.sqlite')) {
      try {
        const db = new DatabaseSync(p, { open: true, readOnly: true });
        const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
        console.log('  Tables:', tables.map(t => t.name).join(', '));
        tables.forEach(t => {
          const cols = db.prepare(`PRAGMA table_info(${t.name})`).all();
          console.log(`    Table ${t.name}:`, cols.map(c => c.name).join(', '));
          try {
            const count = db.prepare(`SELECT count(*) as c FROM ${t.name}`).get();
            console.log(`      count: ${count.c}`);
          } catch(e) {}
        });
      } catch (err) {
        console.log('  Error reading db:', err.message);
      }
    }
  }
}
