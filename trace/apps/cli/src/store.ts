/**
 * Session store: finds session files of every adapter, keeps a summary index on
 * disk, parses whole sessions on demand. The source files stay the only truth;
 * the index is a disposable cache (delete it and the next scan rebuilds it).
 */
import { createReadStream, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
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
type CacheFile = { contract: string; entries: Entry[] };

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

/** Parse one file by streaming its lines through the adapter. */
export async function parseFile(adapter: SourceAdapter, path: string, now: number): Promise<Session> {
  const st = statSync(path);
  const parser = adapter.createParser({ path, size: st.size, mtimeMs: st.mtimeMs });
  const rl = createInterface({ input: createReadStream(path, { encoding: 'utf8' }), crlfDelay: Infinity });
  for await (const line of rl) parser.push(line);
  return parser.finish({ now });
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

export class SessionStore {
  readonly roots: Root[];
  readonly cacheFile: string;
  private readonly now: () => number;
  private entries = new Map<string, Entry>();
  private byId = new Map<string, Entry>();
  private loaded = false;
  private scanning: Promise<ScanReport> | null = null;
  private lastScan = 0;
  private parsedCache = new Map<string, { size: number; mtimeMs: number; session: Session }>();

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
      for (const e of c.entries) this.entries.set(e.path, e);
    } catch {
      // A broken cache is rebuilt by the next scan.
    }
  }

  private save() {
    mkdirSync(dirname(this.cacheFile), { recursive: true });
    const tmp = this.cacheFile + '.tmp';
    const body: CacheFile = { contract: CONTRACT_VERSION, entries: Array.from(this.entries.values()) };
    writeFileSync(tmp, JSON.stringify(body));
    renameSync(tmp, this.cacheFile);
  }

  /** Incremental: only files that are new, changed, parsed by an older adapter, or still open get parsed. */
  scan(onProgress?: (done: number, total: number) => void): Promise<ScanReport> {
    if (this.scanning) return this.scanning;
    this.scanning = this.doScan(onProgress).finally(() => { this.scanning = null; });
    return this.scanning;
  }

  /** Scan unless the last scan is younger than `maxAgeMs`. */
  async refresh(maxAgeMs: number): Promise<void> {
    if (this.now() - this.lastScan >= maxAgeMs) await this.scan();
  }

  private async doScan(onProgress?: (done: number, total: number) => void): Promise<ScanReport> {
    const t0 = Date.now();
    this.load();
    const files = findFiles(this.roots);
    const seen = new Set<string>();
    const report: ScanReport = { files: files.length, parsed: 0, reused: 0, failed: 0, removed: 0, ms: 0, errors: [] };
    let i = 0;
    for (const f of files) {
      seen.add(f.path);
      i++;
      let st;
      try {
        st = statSync(f.path);
      } catch {
        continue;
      }
      const old = this.entries.get(f.path);
      const adapterId = f.adapter.kind + '@' + f.adapter.version;
      const open = old && (old.summary.state.status === 'working' || old.summary.state.status === 'waiting');
      if (old && old.size === st.size && old.mtimeMs === st.mtimeMs && old.adapter === adapterId && !open) {
        report.reused++;
        continue;
      }
      try {
        const session = await parseFile(f.adapter, f.path, this.now());
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
    if (report.parsed || report.removed) this.save();
    this.lastScan = this.now();
    report.ms = Date.now() - t0;
    return report;
  }

  private rebuildIds() {
    this.byId.clear();
    for (const e of this.entries.values()) {
      const prev = this.byId.get(e.summary.id);
      // The same session can appear twice (e.g. sessions and archived_sessions): keep the newest copy.
      if (!prev || e.mtimeMs > prev.mtimeMs) this.byId.set(e.summary.id, e);
    }
  }

  index(): SessionIndex {
    this.load();
    if (!this.byId.size && this.entries.size) this.rebuildIds();
    const summaries = linkChildren(Array.from(this.byId.values()).map((e) => e.summary));
    summaries.sort((a, b) => ((b.updatedAt || '') < (a.updatedAt || '') ? -1 : 1));
    return { contract: CONTRACT_VERSION, generatedAt: new Date(this.now()).toISOString(), sessions: summaries };
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
    if (!adapter || !existsSync(e.path)) return undefined;
    const st = statSync(e.path);
    const hit = this.parsedCache.get(id);
    if (hit && hit.size === st.size && hit.mtimeMs === st.mtimeMs) return hit.session;
    const session = await parseFile(adapter, e.path, this.now());
    const child = linkChildren([summarize(session), ...this.index().sessions.filter((s) => s.links.some((l) => l.rel === 'parent' && l.id === id))])[0];
    session.links = child.links;
    session.stats = child.stats;
    this.parsedCache.set(id, { size: st.size, mtimeMs: st.mtimeMs, session });
    if (this.parsedCache.size > 12) this.parsedCache.delete(this.parsedCache.keys().next().value!);
    return session;
  }
}
