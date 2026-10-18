/**
 * Session store: finds session files of every adapter, keeps a summary index on
 * disk, parses whole sessions on demand. The source files stay the only truth;
 * the index is a disposable cache (delete it and the next scan rebuilds it).
 */
import { createReadStream, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { DatabaseSync } from 'node:sqlite';
import { dirname, join, sep } from 'node:path';
import { createInterface } from 'node:readline';
import { ADAPTERS, type SourceAdapter } from '@hub-trace/adapters';
import { CONTRACT_VERSION, summarize, type Session, type SessionIndex, type SessionSummary } from '@hub-trace/contract';

export type Root = { adapter: SourceAdapter; dir: string };

export type StoreOptions = {
  /** Directories to search; default: every adapter's home roots. */
  roots?: Root[];
  /** Index cache file; default: ~/.agent-hub/trace/index-v<contract>.json (HUB_TRACE_HOME moves the folder). */
  cacheFile?: string;
  now?: () => number;
};

type Entry = { path: string; kind: string; adapter: string; size: number; mtimeMs: number; summary: SessionSummary };
export type SourceFile = { id: string; path: string; kind: string; adapter: string; size: number; mtimeMs: number; summary: SessionSummary };
type CacheFile = {
  contract: string;
  entries: Entry[];
  dbStamps?: Record<string, { size: number; mtimeMs: number; adapter: string }>;
};

export type ScanReport = { files: number; parsed: number; reused: number; failed: number; removed: number; ms: number; errors: string[] };

export function defaultCacheFile(): string {
  const dir = process.env.HUB_TRACE_HOME || join(homedir(), '.agent-hub', 'trace');
  return join(dir, 'index-v' + CONTRACT_VERSION + '.json');
}

export function defaultRoots(): Root[] {
  const home = homedir();
  return ADAPTERS.flatMap((adapter) => adapter.homeRoots.map((r) => ({ adapter, dir: join(home, r) })));
}

const SKIP_DIRS = new Set(['node_modules', '.git']);

/** Every file below a directory (bundle adapters assemble sessions out of many files). */
export function walkAll(dir: string): string[] {
  const out: string[] = [];
  const stack = [dir];
  while (stack.length) {
    const d = stack.pop()!;
    let entries;
    try {
      entries = readdirSync(d, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      const p = join(d, e.name);
      if (e.isDirectory()) { if (!SKIP_DIRS.has(e.name)) stack.push(p); }
      else if (e.isFile()) out.push(p);
    }
  }
  return out.sort((a, b) => (a < b ? -1 : 1));
}

export function findFiles(roots: Root[]): { adapter: SourceAdapter; path: string }[] {
  const out: { adapter: SourceAdapter; path: string }[] = [];
  for (const root of roots) {
    if (!existsSync(root.dir)) continue;
    const stack = [root.dir];
    while (stack.length) {
      const d = stack.pop()!;
      let entries;
      try {
        entries = readdirSync(d, { withFileTypes: true });
      } catch {
        continue;
      }
      for (const e of entries) {
        const p = join(d, e.name);
        if (e.isDirectory()) { if (!SKIP_DIRS.has(e.name)) stack.push(p); }
        else if (e.isFile() && root.adapter.matchFile(p)) out.push({ adapter: root.adapter, path: p });
      }
    }
  }
  return out.sort((a, b) => (a.path < b.path ? -1 : 1));
}

/** Parse one line-oriented file by streaming its lines through the adapter. */
export async function parseFile(adapter: SourceAdapter, path: string, now: number): Promise<Session> {
  return parsePath(adapter, path, now);
}

/** Parse a marker file; for bundle adapters `members` are the other files of the session. */
export async function parsePath(adapter: SourceAdapter, path: string, now: number, members?: string[]): Promise<Session> {
  const st = statSync(path);
  if (adapter.parseBundle && members) {
    const files = members.includes(path) ? members : [path, ...members];
    return adapter.parseBundle({ path, size: st.size, mtimeMs: st.mtimeMs }, {
      files,
      read: (p) => readFileSync(p, 'utf8'),
    }, { now });
  }
  const parser = adapter.createParser({ path, size: st.size, mtimeMs: st.mtimeMs });
  const rl = createInterface({ input: createReadStream(path, { encoding: 'utf8' }), crlfDelay: Infinity });
  for await (const line of rl) parser.push(line);
  return parser.finish({ now });
}

/** Total size and newest mtime of a bundle — the change signature the cache keys on. */
function bundleStat(members: string[]): { size: number; mtimeMs: number } {
  let size = 0;
  let mtimeMs = 0;
  for (const p of members) {
    try {
      const st = statSync(p);
      size += st.size;
      if (st.mtimeMs > mtimeMs) mtimeMs = st.mtimeMs;
    } catch {
      // A member that vanished between listing and stat is simply not counted.
    }
  }
  return { size, mtimeMs };
}

/** Child links from the children's side: a parent learns about every child that names it. */
function linkChildren(summaries: SessionSummary[]): SessionSummary[] {
  const byId = new Map(summaries.map((s) => [s.id, s]));
  const extra = new Map<string, { id: string; label?: string }[]>();
  for (const s of summaries) {
    for (const l of s.links) {
      if (l.rel !== 'parent' || !byId.has(l.id)) continue;
      const parent = byId.get(l.id)!;
      if (parent.links.some((x) => x.rel === 'child' && x.id === s.id)) continue;
      const list = extra.get(parent.id) || [];
      list.push({ id: s.id, label: s.agent.path || s.agent.name });
      extra.set(parent.id, list);
    }
  }
  return summaries.map((s) => {
    const add = extra.get(s.id);
    if (!add) return s;
    const links = s.links.concat(add.map((a) => ({ rel: 'child' as const, id: a.id, ...(a.label ? { label: a.label } : {}) })));
    return { ...s, links, stats: { ...s.stats, subagents: links.filter((l) => l.rel === 'child').length } };
  });
}

/** Sessions per synchronous read of a SQLite store; the adapters take the indexed per-session path up to 40. */
const SQLITE_BATCH = 4;
/** Source files above this size are re-parsed at most every BIG_REPARSE_MS (see doScan). */
const BIG_FILE = 16 * 1024 * 1024;
const BIG_REPARSE_MS = 120_000;

export class SessionStore {
  readonly roots: Root[];
  readonly cacheFile: string;
  private readonly now: () => number;
  private entries = new Map<string, Entry>();
  private byId = new Map<string, Entry>();
  /** When each big source file was last parsed. */
  private readonly parsedAt = new Map<string, number>();
  private loaded = false;
  private scanning: Promise<ScanReport> | null = null;
  private lastScan = 0;
  /** Bumped whenever a scan changed anything: the ETag of /api/sessions. */
  private rev = 0;
  private parsedCache = new Map<string, { size: number; mtimeMs: number; session: Session }>();
  /** Marker path → the files its bundle adapter assembles. Filled by scan, lazily recomputed on demand. */
  private membersByMarker = new Map<string, string[]>();
  /** Database sources: file → {size, mtime, adapter} of the last read. */
  private dbStamp = new Map<string, { size: number; mtimeMs: number; adapter: string }>();
  /** Database sources: file → virtual entry paths (file#sessionId). */
  private dbSessions = new Map<string, string[]>();
  /** Database sources: file → parsed sessions, for on-demand reads. */
  private sqliteParsed = new Map<string, Session[]>();

  private cachedIndex: { rev: number; count: number; idx: SessionIndex } | null = null;

  constructor(opts: StoreOptions = {}) {
    this.roots = opts.roots || defaultRoots();
    this.cacheFile = opts.cacheFile || defaultCacheFile();
    this.now = opts.now || Date.now;
  }

  private load() {
    if (this.loaded) return;
    this.loaded = true;
    if (!existsSync(this.cacheFile)) return;
    try {
      const c = JSON.parse(readFileSync(this.cacheFile, 'utf8')) as CacheFile;
      if (c.contract !== CONTRACT_VERSION || !Array.isArray(c.entries)) return;
      let strippedTurns = false;
      for (const e of c.entries) {
        if (e.summary && 'turns' in (e.summary as Record<string, unknown>)) {
          e.summary = summarize(e.summary as unknown as Session);
          strippedTurns = true;
        }
        this.entries.set(e.path, e);
        const hash = e.path.indexOf('#');
        if (hash > 0) {
          const dbPath = e.path.slice(0, hash);
          const prev = this.dbStamp.get(dbPath);
          if (!prev || e.mtimeMs >= prev.mtimeMs) {
            this.dbStamp.set(dbPath, { size: e.size, mtimeMs: e.mtimeMs, adapter: e.adapter });
          }
          let list = this.dbSessions.get(dbPath);
          if (!list) {
            list = [];
            this.dbSessions.set(dbPath, list);
          }
          list.push(e.path);
        }
      }
      if (c.dbStamps && typeof c.dbStamps === 'object') {
        for (const [dbPath, stamp] of Object.entries(c.dbStamps)) {
          if (stamp && typeof stamp.size === 'number' && typeof stamp.mtimeMs === 'number') {
            this.dbStamp.set(dbPath, stamp);
          }
        }
      }
      if (strippedTurns) this.save();
    } catch {
      // A broken cache is rebuilt by the next scan.
    }
  }

  private save() {
    mkdirSync(dirname(this.cacheFile), { recursive: true });
    const tmp = this.cacheFile + '.tmp';
    const body: CacheFile = {
      contract: CONTRACT_VERSION,
      entries: Array.from(this.entries.values()),
      dbStamps: Object.fromEntries(this.dbStamp.entries()),
    };
    writeFileSync(tmp, JSON.stringify(body));
    renameSync(tmp, this.cacheFile);
  }

  /** Incremental: only files that are new, changed, parsed by an older adapter, or still open get parsed. */
  scan(onProgress?: (done: number, total: number) => void): Promise<ScanReport> {
    if (this.scanning) return this.scanning;
    this.scanning = this.doScan(onProgress).finally(() => { this.scanning = null; });
    return this.scanning;
  }

  /** True while a scan is running: the index is still filling. */
  isScanning(): boolean {
    return this.scanning !== null;
  }

  /** Scan unless the last scan is younger than `maxAgeMs`. */
  async refresh(maxAgeMs: number): Promise<void> {
    if (this.now() - this.lastScan >= maxAgeMs) await this.scan();
  }

  /** Map every bundle adapter's marker file to the other files that make up its session. */
  private resolveBundles(files: { adapter: SourceAdapter; path: string }[]) {
    if (!files.some((f) => f.adapter.bundleMembers)) return;
    const allByRoot = new Map<string, string[]>();
    for (const root of this.roots) {
      if (!root.adapter.bundleMembers || !existsSync(root.dir)) continue;
      allByRoot.set(root.dir, walkAll(root.dir));
    }
    for (const f of files) {
      if (!f.adapter.bundleMembers) continue;
      const root = this.roots.find((r) => r.adapter === f.adapter && (f.path === r.dir || f.path.startsWith(r.dir + sep)));
      if (!root) continue;
      this.membersByMarker.set(f.path, root.adapter.bundleMembers!(f.path, allByRoot.get(root.dir) || []));
    }
  }

  /** Members for one marker, walking its root when this process has not run a scan yet. */
  private membersFor(adapter: SourceAdapter, marker: string): string[] | undefined {
    if (!adapter.bundleMembers) return undefined;
    const cached = this.membersByMarker.get(marker);
    if (cached) return cached;
    const root = this.roots.find((r) => r.adapter === adapter && (marker === r.dir || marker.startsWith(r.dir + sep)));
    if (!root || !existsSync(root.dir)) return [marker];
    const members = adapter.bundleMembers!(marker, walkAll(root.dir));
    this.membersByMarker.set(marker, members);
    return members;
  }

  private async doScan(onProgress?: (done: number, total: number) => void): Promise<ScanReport> {
    const t0 = Date.now();
    this.load();
    await new Promise((r) => setImmediate(r));
    const files = findFiles(this.roots);
    this.resolveBundles(files);
    const seen = new Set<string>();
    const report: ScanReport = { files: files.length, parsed: 0, reused: 0, failed: 0, removed: 0, ms: 0, errors: [] };
    let i = 0;
    let dbStampUpdated = false;
    let lastYield = Date.now();
    for (const f of files) {
      if (Date.now() - lastYield > 20) {
        await new Promise((r) => setImmediate(r));
        lastYield = Date.now();
      }
      seen.add(f.path);
      i++;
      const members = this.membersByMarker.get(f.path);
      let st;
      try {
        st = members ? bundleStat(members) : statSync(f.path);
      } catch {
        continue;
      }
      const adapterId = f.adapter.kind + '@' + f.adapter.version;
      // Database sources: one file holds every session; each becomes its own
      // virtual entry (path#sessionId) so the per-file cache and index stay as they are.
      if (f.adapter.parseSqlite) {
        const old = this.dbStamp.get(f.path);
        if (old && old.size === st.size && old.mtimeMs === st.mtimeMs && old.adapter === adapterId) {
          for (const p of this.dbSessions.get(f.path) || []) seen.add(p);
          report.reused++;
          continue;
        }
        try {
          const { sessions, allVirtuals } = await this.readSqliteSessionsIncremental(f.adapter, f.path, st, adapterId);
          for (const v of allVirtuals) seen.add(v);
          for (const s of sessions) {
            const virtual = f.path + '#' + s.sourceId;
            this.entries.set(virtual, { path: virtual, kind: f.adapter.kind, adapter: adapterId, size: st.size, mtimeMs: st.mtimeMs, summary: summarize(s) });
          }
          this.dbSessions.set(f.path, allVirtuals);
          this.dbStamp.set(f.path, { size: st.size, mtimeMs: st.mtimeMs, adapter: adapterId });
          dbStampUpdated = true;
          if (sessions.length > 0) report.parsed++;
          else report.reused++;
        } catch (err) {
          report.failed++;
          if (report.errors.length < 20) report.errors.push(f.path + ': ' + (err instanceof Error ? err.message : String(err)));
        }
        continue;
      }
      const old = this.entries.get(f.path);
      const open = old && (old.summary.state.status === 'working' || old.summary.state.status === 'waiting') && (this.now() - st.mtimeMs < 3600_000);
      if (old && old.size === st.size && old.mtimeMs === st.mtimeMs && old.adapter === adapterId && !open) {
        report.reused++;
        continue;
      }
      // A big file is re-read at most every BIG_REPARSE_MS: a live agent's own transcript (47 MB and growing, status
      // working) was re-parsed on every 30-second refresh and held the service for tens of seconds (full test 10-18).
      if (old && st.size > BIG_FILE && this.now() - (this.parsedAt.get(f.path) || 0) < BIG_REPARSE_MS) {
        report.reused++;
        continue;
      }
      try {
        const session = await parsePath(f.adapter, f.path, this.now(), members);
        this.parsedAt.set(f.path, this.now());
        this.entries.set(f.path, { path: f.path, kind: f.adapter.kind, adapter: adapterId, size: st.size, mtimeMs: st.mtimeMs, summary: summarize(session) });
        report.parsed++;
      } catch (err) {
        report.failed++;
        if (report.errors.length < 20) report.errors.push(f.path + ': ' + (err instanceof Error ? err.message : String(err)));
      }
      if (onProgress && i % 50 === 0) onProgress(i, files.length);
    }
    for (const p of Array.from(this.entries.keys())) {
      if (!seen.has(p)) { this.entries.delete(p); report.removed++; }
    }
    this.rebuildIds();
    if (report.parsed || report.removed) { this.rev++; this.cachedIndex = null; this.save(); }
    else if (dbStampUpdated) { this.save(); }
    this.lastScan = this.now();
    report.ms = Date.now() - t0;
    return report;
  }

  /** Incrementally scan a SQLite store: reuse unchanged session summaries and only parse sessions whose `time_updated` changed. */
  private async readSqliteSessionsIncremental(
    adapter: SourceAdapter,
    path: string,
    st: { size: number; mtimeMs: number },
    adapterId: string,
  ): Promise<{ sessions: Session[]; allVirtuals: string[] }> {
    const db = new DatabaseSync(path, { readOnly: true });
    try {
      let dirtyIds: Set<string> | undefined;
      const allVirtuals: string[] = [];
      try {
        const rows = db.prepare('SELECT id, time_updated FROM session').all() as { id?: string; time_updated?: number }[];
        dirtyIds = new Set<string>();
        for (const r of rows) {
          if (!r || typeof r.id !== 'string' || !r.id) continue;
          const virtual = path + '#' + r.id;
          allVirtuals.push(virtual);
          const existing = this.entries.get(virtual);
          const rowIso = typeof r.time_updated === 'number' && Number.isFinite(r.time_updated) && r.time_updated > 0 ? new Date(r.time_updated).toISOString() : undefined;
          const isOpen = existing && (existing.summary.state.status === 'working' || existing.summary.state.status === 'waiting') && (this.now() - (r.time_updated || st.mtimeMs) < 3600_000);
          if (existing && existing.adapter === adapterId && existing.summary.updatedAt === rowIso && !isOpen) {
            // Keep existing.size and existing.mtimeMs unchanged so SearchIndex.sync does not rebuild
            // all 783 unchanged SQLite sessions whenever one session in db.sqlite is touched.
          } else {
            dirtyIds.add(r.id);
          }
        }
      } catch {
        dirtyIds = undefined;
      }

      const source = { all: (sql: string, ...args: unknown[]) => db.prepare(sql).all(...(args as never[])) };
      const file = { path, size: st.size, mtimeMs: st.mtimeMs };
      let sessions: Session[];
      if (dirtyIds && dirtyIds.size > SQLITE_BATCH) {
        // A cold read of a store of 1 GB parsed everything in one synchronous call and held the event loop for ~23s
        // (zcode, 760 sessions, measured 2026-10-18). Parse in small batches and let pending requests run in between.
        sessions = [];
        const ids = Array.from(dirtyIds);
        for (let i = 0; i < ids.length; i += SQLITE_BATCH) {
          sessions.push(...adapter.parseSqlite!(file, source, { now: this.now(), onlySourceIds: new Set(ids.slice(i, i + SQLITE_BATCH)) }));
          await new Promise((r) => setImmediate(r));
        }
      } else {
        sessions = adapter.parseSqlite!(file, source, { now: this.now(), ...(dirtyIds ? { onlySourceIds: dirtyIds } : {}) });
      }

      if (!dirtyIds) {
        for (const s of sessions) allVirtuals.push(path + '#' + s.sourceId);
        this.sqliteParsed.set(path, sessions);
      } else if (sessions.length > 0) {
        const prev = this.sqliteParsed.get(path) || [];
        const byId = new Map(prev.map((s) => [s.id, s]));
        for (const s of sessions) byId.set(s.id, s);
        this.sqliteParsed.set(path, Array.from(byId.values()));
      }
      return { sessions, allVirtuals };
    } finally {
      db.close();
    }
  }

  /** Read a single session on-demand from a SQLite store without parsing all other sessions. */
  private readSingleSqliteSession(adapter: SourceAdapter, path: string, st: { size: number; mtimeMs: number }, sourceId: string): Session | undefined {
    const db = new DatabaseSync(path, { readOnly: true });
    try {
      const sessions = adapter.parseSqlite!(
        { path, size: st.size, mtimeMs: st.mtimeMs },
        { all: (sql: string, ...args: unknown[]) => db.prepare(sql).all(...(args as never[])) },
        { now: this.now(), onlySourceIds: new Set([sourceId]) },
      );
      const found = sessions[0];
      if (found) {
        const prev = this.sqliteParsed.get(path) || [];
        const idx = prev.findIndex((x) => x.id === found.id);
        if (idx >= 0) prev[idx] = found;
        else prev.push(found);
        this.sqliteParsed.set(path, prev);
      }
      return found;
    } finally {
      db.close();
    }
  }

  private rebuildIds() {
    this.byId.clear();
    for (const e of this.entries.values()) {
      const prev = this.byId.get(e.summary.id);
      // Prefer a richer copy (e.g. Gemini chats/session-*.json with modelCalls > 0 over user-echo-only logs.json),
      // or the newest copy when both have the same richness (e.g. sessions vs archived_sessions).
      const curRich = (e.summary.stats.modelCalls || 0) > 0 ? 1 : 0;
      const prevRich = prev && (prev.summary.stats.modelCalls || 0) > 0 ? 1 : 0;
      if (!prev || curRich > prevRich || (curRich === prevRich && e.mtimeMs > prev.mtimeMs)) {
        this.byId.set(e.summary.id, e);
      }
    }
  }

  revision(): number {
    return this.rev;
  }

  index(): SessionIndex {
    this.load();
    if (!this.byId.size && this.entries.size) this.rebuildIds();
    if (this.cachedIndex && this.cachedIndex.rev === this.rev && this.cachedIndex.count === this.byId.size) {
      return this.cachedIndex.idx;
    }
    const summaries = linkChildren(Array.from(this.byId.values()).map((e) => e.summary));
    summaries.sort((a, b) => ((b.updatedAt || '') < (a.updatedAt || '') ? -1 : 1));
    const idx: SessionIndex = { contract: CONTRACT_VERSION, generatedAt: new Date(this.now()).toISOString(), sessions: summaries };
    this.cachedIndex = { rev: this.rev, count: this.byId.size, idx };
    return idx;
  }

  /** The file behind each session (newest copy), for modules that re-read sources, e.g. the search index. */
  files(): SourceFile[] {
    this.load();
    if (!this.byId.size && this.entries.size) this.rebuildIds();
    return Array.from(this.byId.values()).map((e) => ({ id: e.summary.id, path: e.path, kind: e.kind, adapter: e.adapter, size: e.size, mtimeMs: e.mtimeMs, summary: e.summary }));
  }

  /** Parse one source file as it is now, without caching or linking. */
  parseSource(f: SourceFile): Promise<Session> {
    // Database sessions resolve from the parsed store, or selectively by sourceId.
    const hash = f.path.indexOf('#');
    if (hash > 0) {
      const real = f.path.slice(0, hash);
      const sourceId = f.path.slice(hash + 1);
      const fromDb = this.sqliteParsed.get(real)?.find((s) => s.id === f.id || s.sourceId === sourceId);
      if (fromDb) return Promise.resolve(fromDb);
      if (existsSync(real)) {
        const dbAdapter = ADAPTERS.find((a) => a.parseSqlite && a.matchFile(real));
        if (dbAdapter) {
          const st = statSync(real);
          const one = this.readSingleSqliteSession(dbAdapter, real, st, sourceId);
          if (one) return Promise.resolve(one);
        }
      }
    }
    const adapter = ADAPTERS.find((a) => a.kind === f.kind);
    if (!adapter) return Promise.reject(new Error('no adapter for ' + f.kind));
    return parsePath(adapter, f.path, this.now(), this.membersFor(adapter, f.path));
  }

  has(id: string): boolean {
    this.load();
    if (!this.byId.size && this.entries.size) this.rebuildIds();
    return this.byId.has(id);
  }

  /** Full session, parsed from its file now (cached while the file is unchanged). */
  async session(id: string): Promise<Session | undefined> {
    if (!this.has(id)) return undefined;
    const e = this.byId.get(id)!;
    const adapter = ADAPTERS.find((a) => a.kind === e.kind);
    if (!adapter) return undefined;
    const hash = e.path.indexOf('#');
    if (hash > 0) {
      const real = e.path.slice(0, hash);
      const sourceId = e.path.slice(hash + 1);
      if (existsSync(real)) {
        const st = statSync(real);
        const hit = this.parsedCache.get(id);
        if (hit && hit.size === st.size && hit.mtimeMs === st.mtimeMs) return hit.session;
        const dbAdapter = ADAPTERS.find((a) => a.parseSqlite && a.matchFile(real));
        const fromDb =
          (dbAdapter && this.readSingleSqliteSession(dbAdapter, real, st, sourceId)) ||
          this.sqliteParsed.get(real)?.find((s) => s.id === id);
        if (!fromDb) return undefined;
        const child = linkChildren([summarize(fromDb), ...this.index().sessions.filter((s) => s.links.some((l) => l.rel === 'parent' && l.id === id))])[0];
        fromDb.links = child.links;
        fromDb.stats = child.stats;
        this.parsedCache.set(id, { size: st.size, mtimeMs: st.mtimeMs, session: fromDb });
        if (this.parsedCache.size > 12) this.parsedCache.delete(this.parsedCache.keys().next().value!);
        return fromDb;
      }
      return undefined;
    }
    if (!existsSync(e.path)) return undefined;
    const st = statSync(e.path);
    const hit = this.parsedCache.get(id);
    if (hit && hit.size === st.size && hit.mtimeMs === st.mtimeMs) return hit.session;
    const session = await parsePath(adapter, e.path, this.now(), this.membersFor(adapter, e.path));
    const child = linkChildren([summarize(session), ...this.index().sessions.filter((s) => s.links.some((l) => l.rel === 'parent' && l.id === id))])[0];
    session.links = child.links;
    session.stats = child.stats;
    this.parsedCache.set(id, { size: st.size, mtimeMs: st.mtimeMs, session });
    if (this.parsedCache.size > 12) this.parsedCache.delete(this.parsedCache.keys().next().value!);
    return session;
  }
}
