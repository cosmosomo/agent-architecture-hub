/**
 * Search index over the steps of every session: the retrieval layer (docs/ARCHITECTURE.md).
 * One SQLite file next to the summary index, built from the source files and safe to
 * delete. Each step keeps a shortened text in an FTS5 trigram table, so Chinese and
 * code substrings both match; filters and facets run on plain columns.
 * Sync is incremental: only sessions whose file changed are parsed again.
 */
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import type { DayStats, ModelStat, SearchHit, SearchRequest, SearchResult, Session, StatsDoc, Step, ToolStat } from '@hub-trace/contract';
import type { SourceFile } from './store.ts';

/** Bump when what gets indexed changes: every session is indexed again. */
const INDEX_VERSION = '3';

/** A search request; the shared shape lives in the contract. */
export type SearchQuery = SearchRequest;

export type { SearchHit, SearchResult };

export type SyncReport = { sessions: number; indexed: number; removed: number; failed: number; steps: number; ms: number };

const MARK_OPEN = '\u0001';
const MARK_CLOSE = '\u0002';
const cut = (s: string | undefined, n: number) => (!s ? '' : s.length > n ? s.slice(0, n) : s);

function facetOf(s: Step): string {
  switch (s.kind) {
    case 'message': return 'message:' + s.role;
    case 'model': return 'model';
    case 'tool': return 'tool:' + s.family;
    case 'event': return 'event:' + s.name;
  }
}

/** The text a step is found by. Injected context is long and repeats in every session, so only its start counts. */
function bodyOf(s: Step): string {
  switch (s.kind) {
    case 'message':
      return (s.from ? s.from + ' → ' + (s.to || '') + '\n' : '') + cut(s.text, s.role === 'user' || s.role === 'agent' ? 1500 : 200);
    case 'model':
      return [cut(s.text, 1000), cut(s.reasoning, 600)].filter(Boolean).join('\n');
    case 'tool':
      return [s.name, cut(s.input, 400), cut(s.output, s.status === 'error' ? 800 : 300), ...s.effects.map((e) => cut(e.label, 160))].filter(Boolean).join('\n');
    case 'event':
      return cut(s.text, 500);
  }
}

function statusOf(s: Step): string {
  if (s.kind === 'tool') return s.status;
  if (s.kind === 'event' && s.name === 'error') return 'error';
  return '';
}

export class SearchIndex {
  readonly file: string;
  private db: DatabaseSync;
  private progress = { done: 0, total: 0, running: false };
  private syncing: Promise<SyncReport> | null = null;
  /** Answer cache: the same query is the same fold of the same index until a sync changes it. */
  private results = new Map<string, SearchResult>();

  constructor(file: string) {
    this.file = file;
    if (file !== ':memory:') mkdirSync(dirname(file), { recursive: true });
    this.db = new DatabaseSync(file);
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA synchronous = NORMAL;
      CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT);
      CREATE TABLE IF NOT EXISTS files (session TEXT PRIMARY KEY, size INTEGER, mtime REAL, adapter TEXT, cwd TEXT, role TEXT);
      CREATE INDEX IF NOT EXISTS files_cwd ON files (cwd);      CREATE TABLE IF NOT EXISTS steps (id INTEGER PRIMARY KEY, session TEXT, turn INTEGER, step TEXT, kind TEXT, facet TEXT, name TEXT, status TEXT, at TEXT);
      CREATE INDEX IF NOT EXISTS steps_session ON steps (session);
      CREATE INDEX IF NOT EXISTS steps_at ON steps (at);
      CREATE INDEX IF NOT EXISTS steps_facet ON steps (facet);
      CREATE INDEX IF NOT EXISTS steps_status ON steps (status);
      CREATE VIRTUAL TABLE IF NOT EXISTS steps_fts USING fts5 (body, tokenize = 'trigram');
    `);
    const v = this.db.prepare("SELECT v FROM meta WHERE k = 'version'").get() as { v: string } | undefined;
    if (v?.v !== INDEX_VERSION) {
      this.db.exec('DELETE FROM files; DELETE FROM steps; DELETE FROM steps_fts;');
      this.db.prepare("INSERT OR REPLACE INTO meta (k, v) VALUES ('version', ?)").run(INDEX_VERSION);
    }
  }

  close() {
    this.db.close();
  }

  /** Merge the full-text segments and compact; the file gets smaller and reads faster. Run after a bulk rebuild. */
  optimize() {
    this.db.exec("INSERT INTO steps_fts (steps_fts) VALUES ('optimize')");
    this.db.exec('VACUUM');
  }

  /** Bring the index in line with the store's files. Newest sessions first, so they are searchable soonest. */
  sync(files: SourceFile[], parse: (f: SourceFile) => Promise<Session>): Promise<SyncReport> {
    if (this.syncing) return this.syncing;
    this.syncing = this.doSync(files, parse).finally(() => { this.syncing = null; this.progress.running = false; });
    return this.syncing;
  }

  private async doSync(files: SourceFile[], parse: (f: SourceFile) => Promise<Session>): Promise<SyncReport> {
    const t0 = Date.now();
    const known = new Map<string, { size: number; mtime: number; adapter: string }>();
    for (const r of this.db.prepare('SELECT session, size, mtime, adapter FROM files').all() as { session: string; size: number; mtime: number; adapter: string }[]) known.set(r.session, r);
    const live = new Set(files.map((f) => f.id));
    const report: SyncReport = { sessions: files.length, indexed: 0, removed: 0, failed: 0, steps: 0, ms: 0 };
    for (const id of known.keys()) {
      if (!live.has(id)) { this.remove(id); report.removed++; }
    }
    const todo = files
      .filter((f) => { const k = known.get(f.id); return !k || k.size !== f.size || k.mtime !== f.mtimeMs || k.adapter !== f.adapter; })
      .sort((a, b) => ((b.summary.updatedAt || '') < (a.summary.updatedAt || '') ? -1 : 1));
    this.progress = { done: files.length - todo.length, total: files.length, running: todo.length > 0 };
    // Parsing and inserting are mostly synchronous, so `await parse` alone never lets the event loop run:
    // a rebuild of ~800 sessions held HTTP requests for ~2 minutes after startup (seen 2026-10-18).
    // Yield to pending I/O every ~30ms of work, also inside one session: a single big session
    // takes seconds to insert (measured 3s for 12k steps), so yielding between sessions is not enough.
    let lastYield = Date.now();
    const tick = async () => {
      if (Date.now() - lastYield > 30) {
        await new Promise((r) => setImmediate(r));
        lastYield = Date.now();
      }
    };
    for (const f of todo) {
      await tick();
      try {
        report.steps += await this.put(f, await parse(f), tick);
        report.indexed++;
      } catch {
        report.failed++;
      }
      this.progress.done++;
    }
    if (report.indexed || report.removed) this.results.clear();
    // A big sync is a rebuild (or first run): refresh the planner's statistics, it picks
    // the wrong side of the steps/files join without them (measured 712ms vs 139ms).
    if (report.indexed > 300) this.db.exec('ANALYZE');
    report.ms = Date.now() - t0;
    return report;
  }

  private remove(id: string) {
    this.db.prepare('DELETE FROM steps_fts WHERE rowid IN (SELECT id FROM steps WHERE session = ?)').run(id);
    this.db.prepare('DELETE FROM steps WHERE session = ?').run(id);
    this.db.prepare('DELETE FROM files WHERE session = ?').run(id);
  }

  private async put(f: SourceFile, s: Session, tick: () => Promise<void>): Promise<number> {
    const step = this.db.prepare('INSERT INTO steps (session, turn, step, kind, facet, name, status, at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    const fts = this.db.prepare('INSERT INTO steps_fts (rowid, body) VALUES (?, ?)');
    let n = 0;
    this.db.exec('BEGIN');
    try {
      this.remove(f.id);
      for (const t of s.turns) {
        for (const st of t.steps) {
          const r = step.run(f.id, t.index, st.id, st.kind, facetOf(st), st.kind === 'tool' ? st.name : st.kind === 'model' ? st.model || null : null, statusOf(st), st.at || t.startedAt || null);
          fts.run(r.lastInsertRowid, bodyOf(st));
          n++;
          await tick();
        }
      }
      this.db.prepare('INSERT INTO files (session, size, mtime, adapter, cwd, role) VALUES (?, ?, ?, ?, ?, ?)').run(f.id, f.size, f.mtimeMs, f.adapter, s.cwd || '', s.agent.role);
      this.db.exec('COMMIT');
    } catch (err) {
      this.db.exec('ROLLBACK');
      throw err;
    }
    return n;
  }

  search(q: SearchQuery): SearchResult {
    const cacheKey = JSON.stringify([q.q, q.kinds, q.errors, q.sessions, q.cwd, q.role, q.since, q.until, q.limit, q.offset]);
    const cached = this.results.get(cacheKey);
    if (cached) return cached;
    const t0 = Date.now();
    const terms = (q.q || '').trim().split(/\s+/).filter(Boolean);
    const long = terms.filter((t) => [...t].length >= 3);
    const short = terms.filter((t) => [...t].length < 3);

    // Conditions shared by hits and facets.
    const where: string[] = [];
    const args: SQLInputValue[] = [];
    if (long.length) {
      where.push('s.id IN (SELECT rowid FROM steps_fts WHERE steps_fts MATCH ?)');
      args.push(long.map((t) => '"' + t.replace(/"/g, '""') + '"').join(' '));
    }
    for (const t of short) {
      where.push("s.id IN (SELECT rowid FROM steps_fts WHERE body LIKE ? ESCAPE '\\')");
      args.push('%' + t.replace(/[\\%_]/g, (c) => '\\' + c) + '%');
    }
    if (q.sessions?.length) { where.push('s.session IN (' + q.sessions.map(() => '?').join(',') + ')'); args.push(...q.sessions); }
    if (q.cwd) { where.push('f.cwd = ?'); args.push(q.cwd); }
    if (q.role) { where.push('f.role = ?'); args.push(q.role); }
    if (q.since) { where.push('s.at >= ?'); args.push(q.since); }
    if (q.until) { where.push('s.at < ?'); args.push(q.until); }

    // Kind and error filters narrow the hits but not the facets, so the chips keep showing what else is there.
    const narrow: string[] = [];
    const nargs: SQLInputValue[] = [];
    if (q.kinds?.length) {
      narrow.push('(' + q.kinds.map((k) => (k.includes(':') ? 's.facet = ?' : 's.kind = ?')).join(' OR ') + ')');
      nargs.push(...q.kinds);
    }
    if (q.errors) narrow.push("s.status = 'error'");

    // files only joins in when its filters are on: the facet counts over every step
    // otherwise pay for a join they never read (261k steps made that a second per query).
    const from = q.cwd || q.role ? 'FROM steps s JOIN files f ON f.session = s.session' : 'FROM steps s';
    const w = (extra: string[]) => (where.length || extra.length ? ' WHERE ' + where.concat(extra).join(' AND ') : '');
    const limit = Math.min(Math.max(q.limit ?? 50, 1), 500);
    const offset = Math.max(q.offset ?? 0, 0);

    const total = (this.db.prepare('SELECT count(*) n ' + from + w(narrow)).get(...args, ...nargs) as { n: number }).n;
    const all = (this.db.prepare('SELECT count(*) n ' + from + w([])).get(...args) as { n: number }).n;
    const rows = this.db.prepare('SELECT s.id, s.session, s.turn, s.step, s.kind, s.facet, s.name, s.status, s.at, x.body ' + from + ' JOIN steps_fts x ON x.rowid = s.id' + w(narrow) + ' ORDER BY s.at DESC, s.id DESC LIMIT ? OFFSET ?')
      .all(...args, ...nargs, limit, offset) as { session: string; turn: number; step: string; kind: Step['kind']; facet: string; name: string | null; status: string; at: string | null; body: string }[];

    const kinds: Record<string, number> = {};
    for (const r of this.db.prepare('SELECT s.facet, count(*) n ' + from + w([]) + ' GROUP BY s.facet').all(...args) as { facet: string; n: number }[]) kinds[r.facet] = r.n;
    const errors = (this.db.prepare('SELECT count(*) n ' + from + w(["s.status = 'error'"])).get(...args) as { n: number }).n;
    const sessions = (this.db.prepare('SELECT count(DISTINCT s.session) n ' + from + w(narrow)).get(...args, ...nargs) as { n: number }).n;
    // The cwd facet from the steps side walks all 261k rows through a join; driven from
    // files (1.5k sessions), each count is a covering-index lookup. Only without search
    // conditions: a correlated FTS subquery would replay per session (32s measured).
    const cwd = where.length || q.cwd || q.role
      ? this.db.prepare('SELECT f.cwd cwd, count(*) n FROM steps s JOIN files f ON f.session = s.session' + w(narrow) + ' GROUP BY f.cwd ORDER BY n DESC LIMIT 12').all(...args, ...nargs) as { cwd: string; n: number }[]
      : this.db.prepare('SELECT cwd, sum(n) n FROM (SELECT f.cwd cwd, (SELECT count(*) FROM steps s WHERE s.session = f.session' + (narrow.length ? ' AND ' + narrow.join(' AND ') : '') + ') n FROM files f) GROUP BY cwd ORDER BY n DESC LIMIT 12').all() as { cwd: string; n: number }[];

    const result: SearchResult = {
      total,
      hits: rows.map((r) => ({
        session: r.session,
        turn: r.turn,
        step: r.step,
        kind: r.kind,
        sub: r.facet.includes(':') ? r.facet.slice(r.facet.indexOf(':') + 1) : '',
        ...(r.name ? { name: r.name } : {}),
        ...(r.status ? { status: r.status } : {}),
        ...(r.at ? { at: r.at } : {}),
        snippet: snippet(r.body, terms),
      })),
      facets: { all, kinds, errors, sessions, cwd },
      indexing: { ...this.progress },
      ms: Date.now() - t0,
    };
    if (this.results.size > 200) this.results.delete(this.results.keys().next().value!);
    this.results.set(cacheKey, result);
    return result;
  }

  status() {
    return { ...this.progress, steps: (this.db.prepare('SELECT count(*) n FROM steps').get() as { n: number }).n };
  }

  /** The analytics fold (17.8): daily activity, tool and model rankings, straight out of the index. */
  stats(contract: string): StatsDoc {
    const days = new Map<string, DayStats>();
    for (const r of this.db.prepare(
      "SELECT substr(at, 1, 10) d, kind, count(*) n, count(DISTINCT session) s FROM steps WHERE at IS NOT NULL GROUP BY d, kind",
    ).all() as { d: string; kind: string; n: number; s: number }[]) {
      let day = days.get(r.d);
      if (!day) { day = { date: r.d, steps: 0, messages: 0, toolCalls: 0, modelCalls: 0, sessions: 0 }; days.set(r.d, day); }
      day.steps += r.n;
      day.sessions = Math.max(day.sessions, r.s);
      if (r.kind === 'message') day.messages += r.n;
      else if (r.kind === 'tool') day.toolCalls += r.n;
      else if (r.kind === 'model') day.modelCalls += r.n;
    }
    const tools = (this.db.prepare(
      "SELECT name, count(*) calls, sum(status = 'error') errors FROM steps WHERE kind = 'tool' AND name IS NOT NULL GROUP BY name ORDER BY calls DESC LIMIT 14",
    ).all() as { name: string; calls: number; errors: number | null }[]).map<ToolStat>((r) => ({ name: r.name, calls: r.calls, errors: r.errors || 0 }));
    const models = (this.db.prepare(
      "SELECT name, count(*) calls FROM steps WHERE kind = 'model' AND name IS NOT NULL GROUP BY name ORDER BY calls DESC LIMIT 14",
    ).all() as { name: string; calls: number }[]).map<ModelStat>((r) => ({ name: r.name, calls: r.calls }));
    const toolErrors = (this.db.prepare("SELECT count(*) n FROM steps WHERE status = 'error'").get() as { n: number }).n;
    return {
      contract,
      generatedAt: new Date().toISOString(),
      days: Array.from(days.values()).sort((a, b) => (a.date < b.date ? -1 : 1)),
      tools,
      models,
      steps: (this.db.prepare('SELECT count(*) n FROM steps').get() as { n: number }).n,
      toolErrors,
    };
  }
}

/** A window of the body around the first match, with every match marked. Case-insensitive. */
export function snippet(body: string, terms: string[], width = 140): string {
  const text = body.replace(/\s+/g, ' ').trim();
  if (!terms.length) return text.slice(0, width);
  const lower = text.toLowerCase();
  const first = Math.min(...terms.map((t) => { const i = lower.indexOf(t.toLowerCase()); return i < 0 ? Infinity : i; }));
  const start = first === Infinity ? 0 : Math.max(0, first - Math.floor(width / 3));
  let win = text.slice(start, start + width);
  for (const t of [...terms].sort((a, b) => b.length - a.length)) {
    const re = new RegExp(t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    win = win.replace(re, (m) => MARK_OPEN + m + MARK_CLOSE);
  }
  // Nested marks from overlapping terms collapse to one level.
  win = win.replace(/\u0001+/g, MARK_OPEN).replace(/\u0002+/g, MARK_CLOSE);
  return (start > 0 ? '…' : '') + win + (start + width < text.length ? '…' : '');
}
