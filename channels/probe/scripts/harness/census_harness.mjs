#!/usr/bin/env node
// census_harness.mjs — harness 会话考古·全量普查（research-acp / zcode，2026-10-20）
// 只读：不改任何会话文件、不起停任何进程。数字可复跑：node census_harness.mjs [product...]
// 产出：channels/research/harness/<产品>-census.json
// 脱敏：样本字符串截断到 80 字符；键名含 key/token/secret/authorization/password 的值替换为 [REDACTED]。
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const HOME = os.homedir();
const OUT = path.resolve(import.meta.dirname, '../../../research/harness');
fs.mkdirSync(OUT, { recursive: true });
const STR_MAX = 80;
const SECRET = /key|token|secret|authorization|password|credential/i;

function sanitize(v, depth = 0) {
  if (v === null || v === undefined) return v;
  if (typeof v === 'string') return v.length > STR_MAX ? v.slice(0, STR_MAX) + `…(${v.length})` : v;
  if (typeof v !== 'object') return v;
  if (depth > 3) return '[depth]';
  if (Array.isArray(v)) return v.slice(0, 5).map((x) => sanitize(x, depth + 1));
  const o = {};
  for (const [k, val] of Object.entries(v)) o[k] = SECRET.test(k) ? '[REDACTED]' : sanitize(val, depth + 1);
  return o;
}
function parseMaybeJson(s) { try { return JSON.parse(s); } catch { return null; } }

// ---- SQLite 库普查 ----
function censusSqlite(p, opts = {}) {
  const db = new DatabaseSync(p, { readOnly: true });
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '%_fts_%' AND name NOT LIKE '%_fts' ORDER BY name").all().map((r) => r.name);
  const out = [];
  for (const t of tables) {
    let rows = 0, columns = [];
    try {
      rows = db.prepare(`SELECT COUNT(*) n FROM "${t}"`).get().n;
      columns = db.prepare(`PRAGMA table_info("${t}")`).all().map((c) => c.name);
    } catch (e) { out.push({ table: t, error: e.message }); continue; }
    if (rows === 0) { out.push({ table: t, rows: 0, columns }); continue; }
    const entry = { table: t, rows, columns };
    // 类型分布：对消息/部件类表按 type/role/kind 分组
    for (const k of ['type', 'role', 'kind', 'delivery']) {
      if (!columns.includes(k)) continue;
      try {
        entry[`${k}Counts`] = db.prepare(`SELECT "${k}" v, COUNT(*) n FROM "${t}" GROUP BY "${k}" ORDER BY n DESC LIMIT 40`).all().map((r) => [r.v, r.n]);
      } catch {}
      break;
    }
    // data JSON 大字段的内层 type 分布（zcode message/part）
    if (opts.dataJsonTypes?.includes(t) && columns.includes('data')) {
      const counts = {};
      let bad = 0;
      for (const r of db.prepare(`SELECT data FROM "${t}"`).iterate()) {
        const j = parseMaybeJson(r.data);
        const ty = j?.type ?? j?.role ?? '(none)';
        counts[ty] = (counts[ty] || 0) + 1;
        if (!j) bad++;
      }
      entry.dataTypeCounts = Object.fromEntries(Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 60));
      if (bad) entry.dataUnparsable = bad;
    }
    // 样本：rowid 最小的一行（确定性）
    if (opts.samples !== false && rows > 0) {
      try {
        const row = db.prepare(`SELECT * FROM "${t}" ORDER BY rowid ASC LIMIT 1`).get();
        entry.sample = sanitize(row);
      } catch {}
    }
    out.push(entry);
  }
  db.close();
  return { kind: 'sqlite', path: p, tables: out };
}

// ---- JSONL 目录普查（按行 type 计数）----
function censusJsonlDir(dir, { typeKey = 'type', depth = 1 } = {}) {
  const res = { kind: 'jsonl-dir', path: dir, files: 0, lines: 0, typeCounts: {}, unparsable: 0, sample: null };
  if (!fs.existsSync(dir)) return { ...res, missing: true };
  const walk = (d, lvl) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) { if (lvl < depth) walk(p, lvl + 1); continue; }
      if (!e.name.endsWith('.jsonl')) continue;
      res.files++;
      const content = fs.readFileSync(p, 'utf8');
      for (const line of content.split(/\r?\n/)) {
        if (!line.trim()) continue;
        res.lines++;
        const j = parseMaybeJson(line);
        const ty = j?.[typeKey] ?? j?.role ?? '(none)';
        res.typeCounts[ty] = (res.typeCounts[ty] || 0) + 1;
        if (!j) res.unparsable++;
        if (!res.sample && j) res.sample = sanitize(j);
      }
    }
  };
  walk(dir, 0);
  res.typeCounts = Object.fromEntries(Object.entries(res.typeCounts).sort((a, b) => b[1] - a[1]).slice(0, 60));
  return res;
}

// ---- JSON 单文件目录普查（每文件一条记录，如 opencode legacy storage）----
function censusJsonFiles(root, { typeKey = 'type' } = {}) {
  const res = { kind: 'json-files', path: root, files: 0, typeCounts: {}, sample: null, missing: !fs.existsSync(root) };
  if (!fs.existsSync(root)) return res;
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) { walk(p); continue; }
      if (!e.name.endsWith('.json')) continue;
      res.files++;
      const j = parseMaybeJson(fs.readFileSync(p, 'utf8'));
      const ty = j?.[typeKey] ?? j?.role ?? '(none)';
      res.typeCounts[ty] = (res.typeCounts[ty] || 0) + 1;
      if (!res.sample && j) res.sample = sanitize(j);
    }
  };
  walk(root);
  res.typeCounts = Object.fromEntries(Object.entries(res.typeCounts).sort((a, b) => b[1] - a[1]).slice(0, 60));
  return res;
}

// ---- 文件型工件（记忆/设置/检查点）----
function fileList(paths) {
  const out = [];
  for (const p of paths) {
    if (!fs.existsSync(p)) continue;
    const st = fs.statSync(p);
    if (st.isDirectory()) {
      const walk = (d, lvl) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const q = path.join(d, e.name); if (e.isDirectory()) walk(q, lvl + 1); else out.push({ file: q, bytes: fs.statSync(q).size }); } };
      walk(p, 0);
    } else out.push({ file: p, bytes: st.size });
  }
  return out;
}

// ---- 四家 ----
function zcode() {
  const dbp = path.join(HOME, '.zcode', 'cli', 'db', 'db.sqlite');
  return {
    product: 'zcode',
    stores: [
      censusSqlite(dbp, { dataJsonTypes: ['message', 'part'] }),
      censusSqlite(path.join(HOME, '.zcode', 'v2', 'tasks-index.sqlite'), { samples: true }),
    ],
    jsonStores: [
      censusJsonFiles(path.join(HOME, '.zcode', 'v2', 'sessions')),
    ],
    artifacts: fileList([
      path.join(HOME, '.zcode', 'v2', 'setting.json'),
      path.join(HOME, '.zcode', 'v2', 'checkpoints'),
      path.join(HOME, '.zcode', 'AGENTS.md'),
      path.join(HOME, '.zcode', 'cli', 'memories'),
      path.join(HOME, '.zcode', 'v2', 'acp-lazy-sessions.json'),
      path.join(HOME, '.zcode', 'v2', 'agent-config'),
    ]),
  };
}
function workbuddy() {
  return {
    product: 'workbuddy',
    stores: [
      censusSqlite(path.join(HOME, '.workbuddy', 'workbuddy.db')),
    ],
    jsonStores: [
      censusJsonlDir(path.join(HOME, '.workbuddy', 'projects'), { typeKey: 'type', depth: 2 }),
      censusJsonlDir(path.join(HOME, '.workbuddy', 'audit-log')),
      censusJsonFiles(path.join(HOME, '.workbuddy', 'sessions')),
    ],
    artifacts: fileList([
      path.join(HOME, '.workbuddy', 'MEMORY.md'),
      path.join(HOME, '.workbuddy', 'USER.md'),
      path.join(HOME, '.workbuddy', 'SOUL.md'),
      path.join(HOME, '.workbuddy', 'IDENTITY.md'),
      path.join(HOME, '.workbuddy', 'BOOTSTRAP.md'),
      path.join(HOME, '.workbuddy', 'memory'),
      path.join(HOME, '.workbuddy', 'buddy-snapshots'),
      path.join(HOME, '.workbuddy', 'audit-log'),
    ]),
  };
}
function opencode() {
  const dbp = path.join(HOME, '.local', 'share', 'opencode', 'opencode.db');
  const storage = path.join(HOME, '.local', 'share', 'opencode', 'storage');
  return {
    product: 'opencode',
    stores: [censusSqlite(dbp, { dataJsonTypes: [] })],
    jsonStores: [
      censusJsonFiles(path.join(storage, 'session')),
      censusJsonFiles(path.join(storage, 'message')),
      censusJsonFiles(path.join(storage, 'part')),
      censusJsonFiles(path.join(storage, 'session_diff')),
    ],
    artifacts: fileList([
      path.join(HOME, '.config', 'opencode', 'opencode.json'),
      path.join(HOME, 'AGENTS.md'),
      path.join(HOME, '.local', 'share', 'opencode', 'snapshot'),
    ]),
  };
}
function hermes() {
  const base = path.join(HOME, 'AppData', 'Local', 'hermes');
  return {
    product: 'hermes',
    stores: [
      censusSqlite(path.join(base, 'state.db')),
      censusSqlite(path.join(base, 'shared-state.db'), { samples: false }),
      censusSqlite(path.join(base, 'projects.db'), { samples: false }),
      censusSqlite(path.join(base, 'kanban.db'), { samples: false }),
    ],
    jsonStores: [
      censusJsonFiles(path.join(base, 'sessions')),
      censusJsonFiles(path.join(base, 'cron')),
      censusJsonFiles(path.join(base, 'state-snapshots')),
    ],
    artifacts: fileList([
      path.join(base, 'memories'),
      path.join(base, 'SOUL.md'),
      path.join(base, 'config.yaml'),
      path.join(base, 'state-snapshots'),
      path.join(base, 'checkpoints'),
    ]),
  };
}

const all = { zcode, workbuddy, opencode, hermes };
const picks = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(all);
for (const p of picks) {
  if (!all[p]) { console.error('unknown product', p); continue; }
  const census = all[p]();
  const outPath = path.join(OUT, `${p}-census.json`);
  fs.writeFileSync(outPath, JSON.stringify(census, null, 1));
  const totals = census.stores.map((s) => `${path.basename(s.path)}:${s.tables?.reduce((a, t) => a + (t.rows || 0), 0) ?? '?'} rows`).join(' ');
  console.log(`${p} -> ${outPath}`);
  console.log('  ', totals);
}
