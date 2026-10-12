/**
 * Local HTTP service: the whole observatory behind one address, on 127.0.0.1 only.
 *   /api/...   the session index and sessions (contract JSON, or OTLP); a session with all its sub-agents
 *   /trace/    the Trace viewer (apps/viewer/dist)
 *   /          the observatory page (repo index.html)
 *   /hub/      its assets, with plain directory listings so the page finds cases and graphs by itself
 *              (the same listing a static server such as `python -m http.server` gives)
 * Everything is same-origin, so no CORS header is sent: other sites in the
 * browser cannot read the sessions. A Host check blocks DNS rebinding.
 */
import { createReadStream, existsSync, readdirSync, statSync } from 'node:fs';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { extname, join, resolve, sep } from 'node:path';
import { CONTRACT_VERSION, overview, type RootInfo, type Session, type SessionDoc, type SessionSummary } from '@hub-trace/contract';
import { sessionToOtlp } from '@hub-trace/otel';
import type { SearchIndex, SearchQuery } from './search.ts';
import type { SessionStore } from './store.ts';

export type ServeOptions = {
  store: SessionStore;
  /** Repo root: holds index.html (the observatory) and hub/. */
  repoRoot: string;
  /** Built viewer; served at /trace/ when it exists. */
  viewerDir: string;
  host?: string;
  port?: number;
  /** Rescan at most this often when the index is requested. */
  refreshMs?: number;
  /** Step search; kept in step with the store after every scan. */
  search?: SearchIndex;
};

const list = (v: string | null) => (v ? v.split(',').map((x) => x.trim()).filter(Boolean) : undefined);

/** A larger tree is cut, breadth first: the observatory still gets its top. */
const TREE_MAX = 600;

/** The session and the sessions it started, at any depth, breadth first; empty when the id is unknown. */
export function subtree(sessions: SessionSummary[], root: string, max = TREE_MAX): string[] {
  const kids = new Map<string, string[]>();
  for (const s of sessions) {
    const p = s.links.find((l) => l.rel === 'parent');
    if (p) (kids.get(p.id) || kids.set(p.id, []).get(p.id)!).push(s.id);
  }
  if (!sessions.some((s) => s.id === root)) return [];
  const out = [root], seen = new Set(out);
  for (let i = 0; i < out.length && out.length < max; i++) {
    for (const k of kids.get(out[i]) || []) if (out.length < max && !seen.has(k)) { seen.add(k); out.push(k); }
  }
  return out;
}

function searchQuery(p: URLSearchParams): SearchQuery {
  const role = p.get('role');
  return {
    q: p.get('q') || undefined,
    kinds: list(p.get('kind')),
    errors: p.get('errors') === '1',
    sessions: list(p.get('session')),
    cwd: p.get('cwd') || undefined,
    role: role === 'main' || role === 'subagent' ? role : undefined,
    since: p.get('since') || undefined,
    until: p.get('until') || undefined,
    limit: p.get('limit') ? Number(p.get('limit')) : undefined,
    offset: p.get('offset') ? Number(p.get('offset')) : undefined,
  };
}

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.map': 'application/json; charset=utf-8',
};

function send(res: ServerResponse, code: number, body: string, type = 'text/plain; charset=utf-8', extra: Record<string, string> = {}) {
  res.writeHead(code, { 'Content-Type': type, 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store', ...extra });
  res.end(body);
}

function json(res: ServerResponse, code: number, value: unknown, headers: Record<string, string> = {}) {
  send(res, code, JSON.stringify(value), 'application/json; charset=utf-8', headers);
}

/** A path of the given kind under `dir`, or null when it escapes `dir` or does not exist. */
function under(dir: string, rel: string, kind: 'isFile' | 'isDirectory'): string | null {
  const base = resolve(dir);
  const p = resolve(base, '.' + sep + rel);
  if (p !== base && !p.startsWith(base + sep)) return null;
  try {
    return statSync(p)[kind]() ? p : null;
  } catch {
    return null;
  }
}
const fileUnder = (dir: string, rel: string) => under(dir, rel, 'isFile');
const dirUnder = (dir: string, rel: string) => under(dir, rel, 'isDirectory');

const escHtml = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** A directory as a page of links, directories with a trailing slash; dotfiles stay out. */
function listing(dir: string, urlPath: string): string {
  const names = readdirSync(dir, { withFileTypes: true })
    .filter((e) => !e.name.startsWith('.'))
    .map((e) => e.name + (e.isDirectory() ? '/' : ''))
    .sort();
  const rows = names.map((n) => '<li><a href="' + escHtml(encodeURI(n)) + '">' + escHtml(n) + '</a></li>').join('\n');
  return '<!doctype html><meta charset="utf-8"><title>' + escHtml(urlPath) + '</title><h1>' + escHtml(urlPath) + '</h1><ul>\n' + rows + '\n</ul>\n';
}

function sendFile(res: ServerResponse, path: string, head: boolean) {
  res.writeHead(200, { 'Content-Type': TYPES[extname(path).toLowerCase()] || 'application/octet-stream', 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-cache' });
  if (head) { res.end(); return; }
  createReadStream(path).pipe(res);
}

export function createService(opts: ServeOptions): Server {
  const { store, repoRoot, viewerDir } = opts;
  const refreshMs = opts.refreshMs ?? 5000;
  const { search } = opts;
  /** Rescan if due, then let the search index catch up in the background. */
  const refresh = async () => {
    await store.refresh(refreshMs);
    if (search) search.sync(store.files(), (f) => store.parseSource(f)).catch(() => {});
  };
  let allowedHosts: Set<string> = new Set();

  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    try {
      if (!allowedHosts.has(String(req.headers.host || '').toLowerCase())) return send(res, 403, 'host not allowed');
      if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'read only');
      const url = new URL(req.url || '/', 'http://local');
      let path: string;
      try { path = decodeURIComponent(url.pathname); } catch { return send(res, 400, 'bad path'); }
      const head = req.method === 'HEAD';

      if (path === '/api/health') {
        return json(res, 200, { ok: true, contract: CONTRACT_VERSION, scanning: store.isScanning(), sessions: store.index().sessions.length, viewer: existsSync(join(viewerDir, 'index.html')), search: search ? search.status() : null, roots: store.roots.map((r) => ({ kind: r.adapter.kind, dir: r.dir, exists: existsSync(r.dir) })) });
      }
      if (path === '/api/overview') {
        const roots: RootInfo[] = store.roots.map((r) => ({ kind: r.adapter.kind, label: r.adapter.label, dir: r.dir, exists: existsSync(r.dir) }));
        return json(res, 200, overview(store.index().sessions, roots, CONTRACT_VERSION));
      }
      if (path === '/api/sessions') {
        // The viewer polls this every few seconds; without a 304 it re-parses 1.7MB each time.
        const etag = '"r' + store.revision() + '-' + store.index().sessions.length + '"';
        if (req.headers['if-none-match'] === etag) { res.writeHead(304, { ETag: etag }); return res.end(); }
        return json(res, 200, store.index(), { ETag: etag });
      }
      if (path === '/api/search') {
        if (!search) return json(res, 404, { error: 'search is off' });
        return json(res, 200, search.search(searchQuery(url.searchParams)));
      }
      if (path === '/api/stats') {
        if (!search) return json(res, 404, { error: 'search is off' });
        return json(res, 200, search.stats(CONTRACT_VERSION));
      }
      // a session and every sub-agent it started, at any depth: what the observatory draws as one org graph
      const t = /^\/api\/sessions\/([^/]+)\/tree$/.exec(path);
      if (t) {
        const ids = subtree(store.index().sessions, t[1], TREE_MAX);
        if (!ids.length) return json(res, 404, { error: 'no such session' });
        const sessions = (await Promise.all(ids.map((id) => store.session(id)))).filter((s): s is Session => Boolean(s));
        return json(res, 200, { contract: CONTRACT_VERSION, sessions, truncated: ids.length >= TREE_MAX });
      }
      const m = /^\/api\/sessions\/([^/]+)(\/otel)?$/.exec(path);
      if (m) {
        const session = await store.session(m[1]);
        if (!session) return json(res, 404, { error: 'no such session' });
        if (m[2]) return json(res, 200, sessionToOtlp(session));
        const doc: SessionDoc = { contract: CONTRACT_VERSION, session };
        return json(res, 200, doc);
      }
      if (path.startsWith('/api/')) return json(res, 404, { error: 'unknown endpoint' });

      if (path === '/trace') { res.writeHead(302, { Location: '/trace/' }); return res.end(); }
      if (path.startsWith('/trace/')) {
        const rel = path.slice('/trace/'.length);
        const file = (rel && fileUnder(viewerDir, rel)) || fileUnder(viewerDir, 'index.html');
        if (!file) return send(res, 404, 'viewer not built: run npm run build in trace/');
        return sendFile(res, file, head);
      }
      if (path === '/' || path === '/index.html') {
        const file = fileUnder(repoRoot, 'index.html');
        return file ? sendFile(res, file, head) : send(res, 404, 'not found');
      }
      if (path.startsWith('/hub/')) {
        const hubDir = join(repoRoot, 'hub'), rel = path.slice('/hub/'.length);
        const file = fileUnder(hubDir, rel);
        if (file) return sendFile(res, file, head);
        const dir = dirUnder(hubDir, rel);
        if (!dir) return send(res, 404, 'not found');
        if (!path.endsWith('/')) { res.writeHead(301, { Location: path + '/' }); return res.end(); }
        return send(res, 200, head ? '' : listing(dir, path), 'text/html; charset=utf-8');
      }
      return send(res, 404, 'not found');
    } catch (err) {
      return json(res, 500, { error: err instanceof Error ? err.message : String(err) });
    }
  });

  server.on('listening', () => {
    const addr = server.address();
    const port = typeof addr === 'object' && addr ? addr.port : opts.port;
    allowedHosts = new Set(['127.0.0.1:' + port, 'localhost:' + port, '[::1]:' + port]);
    // Warm up before the first request, then rescan on a timer: no request ever waits
    // for (or shares a thread with) a rescan any more. The cadence keeps the directory
    // cache warm, which is what makes the rescan itself cheap.
    refresh().catch(() => {});
    const timer = setInterval(() => { refresh().catch(() => {}); }, 15000);
    if (typeof timer.unref === 'function') timer.unref();
  });
  return server;
}

export function listen(server: Server, port: number, host = '127.0.0.1'): Promise<string> {
  return new Promise((ok, fail) => {
    server.once('error', fail);
    server.listen(port, host, () => {
      const addr = server.address();
      const p = typeof addr === 'object' && addr ? addr.port : port;
      ok('http://' + (host.includes(':') ? '[' + host + ']' : host) + ':' + p);
    });
  });
}
