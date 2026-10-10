/**
 * Local HTTP service. Serves, on 127.0.0.1 only:
 *   /api/...   the session index and sessions (contract JSON, or OTLP)
 *   /trace/    the Trace viewer (apps/viewer/dist)
 *   /          the observatory page (repo index.html) and /hub/ its assets
 * Everything is same-origin, so no CORS header is sent: other sites in the
 * browser cannot read the sessions. A Host check blocks DNS rebinding.
 */
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { extname, join, resolve, sep } from 'node:path';
import { CONTRACT_VERSION, type SessionDoc } from '@hub-trace/contract';
import { sessionToOtlp } from '@hub-trace/otel';
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
};

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

function send(res: ServerResponse, code: number, body: string, type = 'text/plain; charset=utf-8') {
  res.writeHead(code, { 'Content-Type': type, 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store' });
  res.end(body);
}

function json(res: ServerResponse, code: number, value: unknown) {
  send(res, code, JSON.stringify(value), 'application/json; charset=utf-8');
}

/** A file under `dir`, or null when the path escapes it or does not exist. */
function fileUnder(dir: string, rel: string): string | null {
  const base = resolve(dir);
  const p = resolve(base, '.' + sep + rel);
  if (p !== base && !p.startsWith(base + sep)) return null;
  try {
    return statSync(p).isFile() ? p : null;
  } catch {
    return null;
  }
}

function sendFile(res: ServerResponse, path: string, head: boolean) {
  res.writeHead(200, { 'Content-Type': TYPES[extname(path).toLowerCase()] || 'application/octet-stream', 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-cache' });
  if (head) { res.end(); return; }
  createReadStream(path).pipe(res);
}

export function createService(opts: ServeOptions): Server {
  const { store, repoRoot, viewerDir } = opts;
  const refreshMs = opts.refreshMs ?? 5000;
  let allowedHosts: Set<string> = new Set();

  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    try {
      if (!allowedHosts.has(String(req.headers.host || '').toLowerCase())) return send(res, 403, 'host not allowed');
      if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'read only');
      const url = new URL(req.url || '/', 'http://local');
      const path = decodeURIComponent(url.pathname);
      const head = req.method === 'HEAD';

      if (path === '/api/health') {
        return json(res, 200, { ok: true, contract: CONTRACT_VERSION, sessions: store.index().sessions.length, viewer: existsSync(join(viewerDir, 'index.html')), roots: store.roots.map((r) => ({ kind: r.adapter.kind, dir: r.dir, exists: existsSync(r.dir) })) });
      }
      if (path === '/api/sessions') {
        await store.refresh(refreshMs);
        return json(res, 200, store.index());
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
        const file = fileUnder(join(repoRoot, 'hub'), path.slice('/hub/'.length));
        return file ? sendFile(res, file, head) : send(res, 404, 'not found');
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
