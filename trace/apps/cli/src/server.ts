/**
 * Local HTTP service: the whole observatory behind one address, on 127.0.0.1 only.
 *   /api/...   the session index and sessions (contract JSON, or OTLP); a session with all its sub-agents
 *   /trace/    the Trace viewer (apps/viewer/dist)
 *   /          the observatory page (repo index.html)
 *   /concept/  the concept board, a separate page (repo concept/index.html)
 *   /hub/      the observatory's assets, with plain directory listings so the page finds cases and graphs by itself
 *              (the same listing a static server such as `python -m http.server` gives)
 * Everything is same-origin, so no CORS header is sent: other sites in the
 * browser cannot read the sessions. A Host check blocks DNS rebinding.
 */
import { appendFileSync, createReadStream, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { listModels } from './gateway/models.ts';
import { extname, join, resolve, sep } from 'node:path';
import { homedir } from 'node:os';
import { DatabaseSync } from 'node:sqlite';
import { CONTRACT_VERSION, overview, type RootInfo, type Session, type SessionDoc, type SessionSummary } from '@hub-trace/contract';
import { sessionToOtlp } from '@hub-trace/otel';
import type { SearchIndex, SearchQuery } from './search.ts';
import type { SessionStore } from './store.ts';
import { AgentGatewayHub, CHANNEL_PROFILES } from './gateway.ts';



// Antigravity's own run state per conversation (conversation_summaries.db): the only reliable source, since its
// transcript does not say whether a turn is still running. Read at most every 2 s.
type AgyRow = { status: string; detail: string; title: string; parent: string; workspace: string };
let agyStateCache: { at: number; map: Map<string, AgyRow> } = { at: 0, map: new Map() };
function agyStates(): Map<string, AgyRow> {
  if (Date.now() - agyStateCache.at < 2000) return agyStateCache.map;
  const map = new Map<string, AgyRow>();
  try {
    const db = new DatabaseSync(join(homedir(), '.gemini', 'antigravity', 'conversation_summaries.db'), { readOnly: true });
    try {
      const rows = db.prepare('SELECT conversation_id AS id, status, not_fully_idle AS busy, killed, step_count AS steps, title, parent_conversation_id AS parent, workspace_uris AS ws FROM conversation_summaries').all() as Array<Record<string, unknown>>;
      for (const r of rows) {
        const running = String(r.status).endsWith('RUNNING');
        const status = r.killed ? 'aborted' : running ? 'working' : r.busy ? 'waiting' : 'idle';
        const detail = r.killed ? '已终止' : running ? `在干活（第 ${r.steps} 步）` : r.busy ? '让出了，在等后台任务' : `停了（共 ${r.steps} 步）`;
        // The title Antigravity shows in its own window, so the person recognises the conversation.
        let workspace = '';
        try {
          const uri = (JSON.parse(String(r.ws || '[]')) as string[])[0];
          if (uri) workspace = decodeURIComponent(uri.replace(/^file:\/\/\//, ''));
        } catch {}
        map.set(String(r.id), { status, detail, title: String(r.title || ''), parent: String(r.parent || ''), workspace });
      }
    } finally {
      db.close();
    }
  } catch {}
  agyStateCache = { at: Date.now(), map };
  return map;
}
// Claude Code registers every running session in ~/.claude/sessions/<pid>.json: its session id, busy or idle, and
// the name its window shows. A session with a live entry is what the entry says; an open turn with no live entry
// has lost its process, whatever the transcript last wrote. Read at most every 2 s.
type ClaudeLive = { status: string; name: string; named: boolean; cwd: string };
let claudeLiveCache: { at: number; map: Map<string, ClaudeLive> } = { at: 0, map: new Map() };
function claudeLive(): Map<string, ClaudeLive> {
  if (Date.now() - claudeLiveCache.at < 2000) return claudeLiveCache.map;
  const map = new Map<string, ClaudeLive>();
  const dir = join(homedir(), '.claude', 'sessions');
  let files: string[] = [];
  try { files = readdirSync(dir).filter((x) => x.endsWith('.json')); } catch {}
  for (const file of files) {
    try {
      const e = JSON.parse(readFileSync(join(dir, file), 'utf8'));
      if (!e?.sessionId || !e?.pid) continue;
      try { process.kill(Number(e.pid), 0); } catch { continue; }
      map.set(String(e.sessionId), { status: String(e.status || ''), name: String(e.name || ''), named: Boolean(e.name) && e.nameSource !== 'derived', cwd: projectKey(e.cwd) });
    } catch {}
  }
  claudeLiveCache = { at: Date.now(), map };
  return map;
}
function claudeState(id: string, fallback: any, cwd?: unknown) {
  const live = claudeLive().get(id.slice('claude-code:'.length));
  if (live) {
    if (live.status === 'busy') return { status: 'working', detail: '在干活（Claude 进程在跑）', since: fallback?.since };
    if (live.status === 'idle') return { status: 'idle', detail: '进程开着，在等下一句', since: fallback?.since };
    return fallback;
  }
  // A forked or resumed session writes under a new id while its registry entry keeps the old one, so a missing
  // entry alone proves nothing: call it dead only when the transcript has been still for 3 minutes and no live
  // Claude process works in the same folder.
  const still = Date.now() - (Date.parse(fallback?.since || '') || 0) > 3 * 60 * 1000;
  const sameFolder = [...claudeLive().values()].some((l) => l.cwd && l.cwd === projectKey(cwd));
  if (fallback?.status === 'working' && still && !sameFolder) return { status: 'stale', detail: '最后一轮没有写完，Claude 进程已经不在了', since: fallback?.since };
  return fallback;
}

// A turn this service ran itself: its run record says whether it is still going. Used while the hub run is live,
// or when the transcript has not moved since that run ended (a person may have carried on in the desktop app).
let hubRuns: () => Map<string, { status: string; detail: string; endedAt: string }> = () => new Map();
function liveState(id: string, fallback: any, cwd?: unknown) {
  if (id.startsWith('claude-code:')) fallback = claudeState(id, fallback, cwd);
  if (!id.startsWith('antigravity:')) {
    const h = hubRuns().get(id.split(':').pop() || '');
    if (!h) return fallback;
    const touched = Date.parse(fallback?.since || '') || 0;
    if (h.status === 'working' || ((fallback?.status === 'working' || fallback?.status === 'stale') && touched <= (Date.parse(h.endedAt) || 0) + 120000)) {
      return { status: h.status, detail: h.detail, since: h.endedAt || fallback?.since };
    }
    return fallback;
  }
  const a = agyStates().get(id.slice('antigravity:'.length));
  return a ? { status: a.status, detail: a.detail } : fallback;
}
// Antigravity's own index knows which conversations are sub-agents of which; its transcripts do not say.
function agyParent(id: string): string {
  if (!id.startsWith('antigravity:')) return '';
  const p = agyStates().get(id.slice('antigravity:'.length))?.parent;
  return p ? 'antigravity:' + p : '';
}
// The workspace Antigravity files the conversation under (what its own window groups by); tool working
// directories inside the conversation can point anywhere below it.
function nativeProject(id: string, fallback: unknown): string {
  const ws = id.startsWith('antigravity:') ? agyStates().get(id.slice('antigravity:'.length))?.workspace : '';
  return projectKey(ws || fallback);
}
function nativeTitle(id: string, fallback: string): string {
  if (id.startsWith('claude-code:')) {
    const live = claudeLive().get(id.slice('claude-code:'.length));
    return live?.named ? live.name : fallback;
  }
  if (!id.startsWith('antigravity:')) return fallback;
  return agyStates().get(id.slice('antigravity:'.length))?.title || fallback;
}

// Files a session names: arguments of its file tools and absolute paths written in its messages, newest first.
function sessionFiles(sess: any): string[] {
  const out: string[] = [];
  const add = (p: unknown) => {
    let v = typeof p === 'string' ? p.trim() : '';
    if (/^"/.test(v)) { try { v = JSON.parse(v); } catch {} }
    v = String(v).replace(/^\\\\\?\\/, '');
    if (/^[a-zA-Z]:[\\/]/.test(v) && /\.[a-z0-9]{1,6}$/i.test(v) && !out.includes(v)) out.push(v);
  };
  const KEYS = ['file_path', 'filePath', 'path', 'TargetFile', 'AbsolutePath', 'target_file'];
  for (const t of sess.turns || []) {
    for (const st of t.steps || []) {
      if (st.kind === 'tool' && st.input) {
        try { const o = JSON.parse(st.input); for (const k of KEYS) add(o?.[k]); } catch {}
      }
      const text = [st.text, st.kind === 'tool' ? '' : st.output].filter(Boolean).join('\n');
      for (const hit of String(text).match(/[A-Za-z]:[\\/][^\s"'`<>|*?()\]\[]+\.(?:md|html?|png|jpe?g|gif|webp|svg|txt|json|csv|pdf)/g) || []) add(hit);
    }
  }
  return out.reverse();
}

// One spelling per folder: families record cwd differently (Antigravity as a quoted, escaped, lower-case-drive string).
function projectKey(cwd: unknown): string {
  let p = String(cwd ?? '').trim();
  if (!p || p === 'undefined' || p === 'null') return '';
  if (p.startsWith('"') && p.endsWith('"')) {
    try { p = JSON.parse(p); } catch { p = p.slice(1, -1); }
  }
  p = p.replace(/\\\\/g, '\\').replace(/\//g, '\\').replace(/\\+$/, '');
  if (/^[a-z]:/.test(p)) p = p[0].toUpperCase() + p.slice(1);
  return p;
}

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
  /** Extra address the page is opened at from another device (e.g. the EasyTier address 10.126.126.1). */
  lanHost?: string;
  /** Required from every request that does not come from this machine; without it remote requests are refused. */
  accessToken?: string;
};

const LOOPBACK = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);
const TOKEN_COOKIE = 'hub_token';

function sameSecret(a: string, b: string): boolean {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

function cookieValue(header: string | undefined, name: string): string {
  for (const part of String(header || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return '';
}

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
  // Pages and their assets are small: read them at once. A stream waits for the libuv thread pool, which the
  // session scan and the search index keep busy; the phone page took 0.4–18 s to start arriving that way (10-18).
  const size = statSync(path).size;
  if (size <= 4 * 1024 * 1024) { res.end(readFileSync(path)); return; }
  createReadStream(path).pipe(res);
}

const FEEDBACK_ROOT = join(homedir(), '.agent-hub', 'feedback');

function readJsonBody(req: IncomingMessage, maxBytes = 256 * 1024): Promise<Record<string, any>> {
  return new Promise((ok, fail) => {
    const chunks: Buffer[] = [];
    let len = 0;
    req.on('data', (c: Buffer) => {
      len += c.length;
      if (len > maxBytes) { fail(new Error('payload too large')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      try { ok(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')); }
      catch (e) { fail(e); }
    });
    req.on('error', fail);
  });
}

/** Tool permission for a run. Anything not explicitly full access or deny is read-only. */
function parsePermissions(raw: unknown): 'all' | 'reads' | 'deny' {
  // The user runs every agent with full permissions (2026-10-18); read-only or deny only when asked for.
  const v = String(raw ?? '').toLowerCase();
  if (v === 'reads' || v === 'approve-reads' || v === 'read') return 'reads';
  if (v === 'deny' || v === 'deny-all') return 'deny';
  return 'all';
}

function truncStr(s: string | undefined, max: number): string | undefined {
  if (!s || s.length <= max) return s;
  return s.slice(0, max) + `\n… [已折叠后续 ${(s.length - max).toLocaleString()} 字符]`;
}

/**
 * Compact oversized historical step payloads for UI rendering (`?compact=1`) so
 * 300–1,150+ turn sessions transfer in <1.2 MB instead of 14–21 MB while preserving
 * all turns, user prompts, assistant replies, and step metadata.
 */
function compactSessionForUi(session: Session): Session {
  const totalTurns = session.turns.length;
  const recentThreshold = Math.max(0, totalTurns - 30);

  return {
    ...session,
    turns: session.turns.map((turn, idx) => {
      const isRecent = idx >= recentThreshold;
      const maxToolBody = isRecent ? 3200 : 260;
      const maxReasoning = isRecent ? 2400 : 220;
      const maxText = isRecent ? 16000 : 2400;

      return {
        ...turn,
        input: truncStr(turn.input, isRecent ? 8000 : 1200),
        output: truncStr(turn.output, isRecent ? 16000 : 2400),
        steps: turn.steps.map((step) => {
          if (step.kind === 'tool') {
            return {
              ...step,
              input: truncStr(step.input, maxToolBody),
              output: truncStr(step.output, maxToolBody),
            };
          }
          if (step.kind === 'model') {
            return {
              ...step,
              reasoning: truncStr(step.reasoning, maxReasoning),
              text: truncStr(step.text, maxText),
            };
          }
          if (step.kind === 'message') {
            return {
              ...step,
              text: truncStr(step.text, maxText) || '',
            };
          }
          return step;
        }),
      };
    }),
  };
}

export function createService(opts: ServeOptions): Server {
  const { store, repoRoot, viewerDir } = opts;
  const refreshMs = opts.refreshMs ?? 30000;
  const { search } = opts;
  const gateway = new AgentGatewayHub(repoRoot, store);
  hubRuns = () => gateway.hubRunStates();
  // Sessions the gateway lists from outside the store (Antigravity brain, WorkBuddy desktop, Hermes) go into the
  // search index too, as sources keyed by their update time and turn count; parsed by the gateway. The list is
  // taken at most every 5 minutes and kept on failure, so the index does not drop and rebuild them.
  let outsideSources: { at: number; list: any[] } = { at: 0, list: [] };
  const OUTSIDE = new Set(['antigravity', 'workbuddy', 'hermes']);
  const outsideFiles = (have: Set<string>) => {
    if (Date.now() - outsideSources.at > 300_000) {
      try {
        const list = gateway
          .listAcpxSessions()
          .filter((s) => OUTSIDE.has(s.channel) && s.traceSessionId && !have.has(s.traceSessionId))
          .map((s) => ({ id: s.traceSessionId, path: '', kind: 'gateway', adapter: 'gateway:' + s.channel, size: s.turnCount || 0, mtimeMs: Date.parse(s.updatedAt || s.createdAt || '') || 0, summary: { updatedAt: s.updatedAt } }));
        outsideSources = { at: Date.now(), list };
      } catch {}
    }
    return outsideSources.list;
  };
  /** Rescan if due, then let the search index catch up in the background. */
  const refresh = async () => {
    if (store.isScanning()) return;
    await store.refresh(refreshMs);
    // A side instance (HUB_BACKGROUND=0) reads the index 8899 keeps and never writes it (see main.ts serve).
    if (search && process.env.HUB_BACKGROUND !== '0') {
      const files = store.files();
      const all = [...files, ...outsideFiles(new Set(files.map((f) => f.id)))];
      search
        .sync(all, async (f) => {
          if (!f.adapter.startsWith('gateway:')) return store.parseSource(f);
          const session = await gateway.readSessionContract(f.id);
          if (!session) throw new Error(`Missing gateway session ${f.id}`);
          return session;
        })
        .catch((error) => console.error('[search-refresh]', error));
    }
  };
  let allowedHosts: Set<string> = new Set();

  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    try {
      if (!allowedHosts.has(String(req.headers.host || '').toLowerCase())) return send(res, 403, 'host not allowed');
      // The host check only stops DNS rebinding; anyone on the network can send any Host header. Requests
      // from another machine must carry the access token (once as ?token=, then as a cookie).
      // This machine and the EasyTier network the page is served to (same /24 as lanHost) are trusted, as the
      // user decided on 2026-10-18; only requests from any other network need the access token.
      const remote = String(req.socket.remoteAddress || '').replace(/^::ffff:/, '');
      const trustedLan = !!opts.lanHost && remote.split('.').slice(0, 3).join('.') === opts.lanHost.split('.').slice(0, 3).join('.');
      if (!LOOPBACK.has(remote) && !trustedLan) {
        const token = opts.accessToken || '';
        if (!token) return send(res, 403, 'remote access is off');
        const u = new URL(req.url || '/', 'http://local');
        const fromQuery = u.searchParams.get('token') || '';
        if (fromQuery && sameSecret(fromQuery, token)) {
          u.searchParams.delete('token');
          res.writeHead(302, {
            Location: u.pathname + (u.search || ''),
            'Set-Cookie': `${TOKEN_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=31536000`,
          });
          return res.end();
        }
        if (!sameSecret(cookieValue(req.headers.cookie, TOKEN_COOKIE), token)) return send(res, 401, 'access token required');
      }
      const url = new URL(req.url || '/', 'http://local');
      let path: string;
      try { path = decodeURIComponent(url.pathname); } catch { return send(res, 400, 'bad path'); }

      // Phones go to the phone page: the observatory and /console/ are desktop layouts (user 2026-10-18 opened the
      // old interface on the phone). ?desktop=1 keeps the desktop page.
      const isPhone = /Mobile|Android|iPhone|iPad/i.test(String(req.headers['user-agent'] || ''));
      if (isPhone && url.searchParams.get('desktop') !== '1' && (path === '/' || path === '/index.html' || path === '/console' || path === '/console/' || path === '/console/index.html' || path === '/control')) {
        res.writeHead(302, { Location: '/m/' });
        return res.end();
      }
      if (req.method === 'POST' && (path === '/api/gateway/send' || path === '/api/gateway/prompt')) {
        // Up to 20 MB: pasted screenshots travel in the same request.
        const body = await readJsonBody(req, 20 * 1024 * 1024);
        const result = await gateway.sendPrompt({
          channel: String(body.channel || body.agent || 'codex'),
          sessionName: body.sessionName || body.session ? String(body.sessionName || body.session) : undefined,
          traceSessionId: body.traceSessionId ? String(body.traceSessionId) : undefined,
          cwd: body.cwd ? String(body.cwd) : undefined,
          prompt: String(body.prompt || ''),
          model: body.model ? String(body.model) : undefined,
          // Default is full access (user, 2026-10-18); `permissionMode` is the older field name the /console/ page sent.
          permissions: parsePermissions(body.permissions ?? body.permissionMode),
          securityMode: body.securityMode,
          mode: body.mode === 'interrupt' || body.mode === 'queue' ? body.mode : 'send',
          source: body.source === 'cli' ? 'cli' : 'web',
          wait: Boolean(body.wait),
          timeoutMs: typeof body.timeoutMs === 'number' ? body.timeoutMs : undefined,
          images: Array.isArray(body.images) ? body.images.map(String) : undefined,
        });
        return json(res, 200, result);
      }

      // A person answers a question an agent asked mid-turn (pendingQuestions in /api/gateway/state).
      if (req.method === 'POST' && path === '/api/gateway/answer') {
        const body = await readJsonBody(req);
        try {
          return json(res, 200, gateway.answerQuestion({ id: String(body.id || ''), answers: body.answers && typeof body.answers === 'object' ? body.answers : undefined, answer: body.answer !== undefined ? String(body.answer) : undefined }));
        } catch (e: any) {
          return json(res, 400, { ok: false, error: e?.message || String(e) });
        }
      }

      if (req.method === 'POST' && path === '/api/gateway/approve') {
        const body = await readJsonBody(req);
        const result = await gateway.resolveApproval({
          id: String(body.id || ''),
          decision: body.decision === 'reject' ? 'reject' : 'approve',
          scope: body.scope ? (String(body.scope) as any) : undefined,
          customHint: body.customHint ? String(body.customHint) : undefined,
        });
        return json(res, 200, result);
      }

      if (req.method === 'POST' && path === '/api/gateway/request-approval') {
        const body = await readJsonBody(req);
        const q = {
          product: String(body.product || 'cli'),
          session: String(body.session || 'cli'),
          task: body.task ? String(body.task) : undefined,
          action: String(body.action || 'tool'),
          target: String(body.target || ''),
          cwd: String(body.cwd || repoRoot),
          mode: body.mode ? String(body.mode) : undefined,
          layer: body.layer ? String(body.layer) : 'L1',
        };
        const allowed = await gateway.securityCheck(q);
        return json(res, 200, { ok: true, allowed });
      }

      if (req.method === 'GET' && path === '/api/gateway/audit') {
        const file = join(homedir(), '.agent-hub', 'security-audit.jsonl');
        const tail = Number(url.searchParams.get('tail') || '50');
        const actionFilter = url.searchParams.get('action');
        const productFilter = url.searchParams.get('product');
        let lines: string[] = [];
        if (existsSync(file)) {
          lines = readFileSync(file, 'utf8').trim().split(/\r?\n/).filter(Boolean);
        }
        let records = lines.map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
        if (actionFilter) records = records.filter((r) => r.action === actionFilter);
        if (productFilter) records = records.filter((r) => r.product === productFilter);
        return json(res, 200, { ok: true, count: records.length, records: records.slice(-tail) });
      }

      if (req.method === 'POST' && path === '/api/gateway/handoff') {
        const body = await readJsonBody(req);
        const result = await gateway.handoffSession({
          fromChannel: String(body.fromChannel || 'codex'),
          fromSessionName: body.fromSessionName ? String(body.fromSessionName) : undefined,
          fromTraceId: body.fromTraceId ? String(body.fromTraceId) : undefined,
          toChannel: String(body.toChannel || 'zcode'),
          toModel: body.toModel ? String(body.toModel) : undefined,
          toSessionName: body.toSessionName ? String(body.toSessionName) : undefined,
          customInstruction: body.customInstruction ? String(body.customInstruction) : undefined,
          wait: Boolean(body.wait),
          timeoutMs: typeof body.timeoutMs === 'number' ? body.timeoutMs : undefined,
        });
        return json(res, 200, result);
      }

      if (req.method === 'POST' && path === '/api/gateway/dispatch') {
        const body = await readJsonBody(req);
        const result = await gateway.dispatchTask({
          kind:
            body.kind === 'peer-message' || body.kind === 'handoff'
              ? body.kind
              : 'spawn-subagent',
          fromChannel: body.fromChannel ? String(body.fromChannel) : undefined,
          fromSessionName: body.fromSessionName ? String(body.fromSessionName) : undefined,
          fromTraceId: body.fromTraceId ? String(body.fromTraceId) : undefined,
          toChannel: String(body.toChannel || body.channel || 'codex'),
          toSessionName: body.toSessionName || body.sessionName ? String(body.toSessionName || body.sessionName) : undefined,
          toTraceId: body.toTraceId ? String(body.toTraceId) : undefined,
          toModel: body.toModel || body.model ? String(body.toModel || body.model) : undefined,
          cwd: body.cwd ? String(body.cwd) : undefined,
          task: String(body.task || body.prompt || ''),
          contextDigest: body.contextDigest ? String(body.contextDigest) : undefined,
          parentDispatchId: body.parentDispatchId ? String(body.parentDispatchId) : undefined,
          wakeCaller: Boolean(body.wakeCaller),
          wait: Boolean(body.wait),
          timeoutMs: typeof body.timeoutMs === 'number' ? body.timeoutMs : undefined,
          rawPrompt: Boolean(body.rawPrompt),
        });
        return json(res, 200, result);
      }

      // The "一群会话" level: goals made of tasks (collab/taskboard.ts). Errors are the board's own words, as 400.
      if (req.method === 'POST' && path === '/api/gateway/goals') {
        const body = await readJsonBody(req);
        try {
          const goal = gateway.taskboard.createGoal({
            title: String(body.title || ''),
            objective: String(body.objective || ''),
            acceptance: body.acceptance ? String(body.acceptance) : undefined,
            channel: body.channel ? String(body.channel) : undefined,
            candidates: Array.isArray(body.candidates) ? body.candidates.map(String) : undefined,
            model: body.model ? String(body.model) : undefined,
            verifyBy: body.verifyBy ? String(body.verifyBy) as any : undefined,
            cwd: body.cwd ? String(body.cwd) : undefined,
            budget: body.budget && typeof body.budget === 'object' ? body.budget : undefined,
            tasks: Array.isArray(body.tasks) ? body.tasks : [],
          });
          return json(res, 200, { ok: true, goal });
        } catch (e: any) {
          return json(res, 400, { ok: false, error: e?.message || String(e) });
        }
      }
      // Shared records (blackboard, features, annotations): the center is the only writer (gateway/guard.ts).
      if (req.method === 'POST' && path === '/api/gateway/records') {
        const body = await readJsonBody(req, 4 * 1024 * 1024);
        const r = gateway.appendRecords(String(body.kind || ''), body.rows ?? body.row);
        return json(res, r.appended || r.ok ? 200 : 400, r);
      }
      if (req.method === 'POST' && path === '/api/gateway/goal-action') {
        const body = await readJsonBody(req);
        try {
          const goal = gateway.taskboard.goalAction(String(body.id || ''), String(body.action || ''), { budget: body.budget, reason: body.reason });
          return json(res, 200, { ok: true, goal });
        } catch (e: any) {
          return json(res, 400, { ok: false, error: e?.message || String(e) });
        }
      }
      if (req.method === 'POST' && path === '/api/gateway/task-action') {
        const body = await readJsonBody(req);
        try {
          const task = gateway.taskboard.taskAction(String(body.id || ''), String(body.action || ''), {
            passed: body.passed,
            note: body.note,
            rework: body.rework,
            channel: body.channel,
            model: body.model,
            reason: body.reason,
          });
          return json(res, 200, { ok: true, task });
        } catch (e: any) {
          return json(res, 400, { ok: false, error: e?.message || String(e) });
        }
      }

      if (req.method === 'POST' && path === '/api/gateway/collab-event') {
        const body = await readJsonBody(req);
        const result = await gateway.recordCollabEvent({
          id: body.id ? String(body.id) : undefined,
          channel: body.channel ? String(body.channel) : undefined,
          sessionName: body.sessionName ? String(body.sessionName) : undefined,
          kind:
            body.kind === 'report' ||
            body.kind === 'yield' ||
            body.kind === 'request' ||
            body.kind === 'reclaim' ||
            body.kind === 'answer'
              ? body.kind
              : 'deliver',
          summary: body.summary ? String(body.summary) : undefined,
          text: body.text ? String(body.text) : undefined,
          reply: body.reply ? String(body.reply) : undefined,
          waitingFor: body.waitingFor ? String(body.waitingFor) : undefined,
          files: Array.isArray(body.files) ? body.files.map(String) : undefined,
          via: body.via === 'web' ? 'web' : 'cli',
        });
        return json(res, 200, result);
      }

      if (req.method === 'POST' && path === '/api/gateway/session/new') {
        const body = await readJsonBody(req);
        const result = gateway.createNewSession({
          channel: String(body.channel || 'codex'),
          sessionName: body.sessionName ? String(body.sessionName) : undefined,
          cwd: body.cwd ? String(body.cwd) : undefined,
          model: body.model ? String(body.model) : undefined,
        });
        return json(res, 200, result);
      }

      if (req.method === 'POST' && path === '/api/gateway/model') {
        const body = await readJsonBody(req);
        const result = gateway.setSessionModel({
          channel: String(body.channel || 'codex'),
          sessionName: body.sessionName ? String(body.sessionName) : undefined,
          traceSessionId: body.traceSessionId ? String(body.traceSessionId) : undefined,
          model: String(body.model || ''),
        });
        return json(res, 200, result);
      }

      if (req.method === 'POST' && path === '/api/gateway/session-control') {
        const body = await readJsonBody(req);
        try {
          const result = await gateway.sessionControl({
            channel: String(body.channel || ''),
            sessionName: body.sessionName ? String(body.sessionName) : undefined,
            traceSessionId: body.traceSessionId ? String(body.traceSessionId) : undefined,
            op: String(body.op || ''),
            value: body.value !== undefined ? String(body.value) : undefined,
            newSessionName: body.newSessionName ? String(body.newSessionName) : undefined,
          });
          return json(res, 200, result);
        } catch (e: any) {
          return json(res, 400, { ok: false, error: e?.message || String(e) });
        }
      }

      if (req.method === 'POST' && path === '/api/gateway/cwd') {
        const body = await readJsonBody(req);
        const result = gateway.setSessionCwd({
          channel: String(body.channel || 'codex'),
          sessionName: body.sessionName ? String(body.sessionName) : undefined,
          traceSessionId: body.traceSessionId ? String(body.traceSessionId) : undefined,
          cwd: String(body.cwd || ''),
        });
        return json(res, 200, result);
      }

      if (req.method === 'POST' && path === '/api/gateway/cancel') {
        const body = await readJsonBody(req);
        const result = await gateway.cancelRun(
          String(body.channel || 'codex'),
          body.sessionName ? String(body.sessionName) : undefined,
          body.queuedId ? String(body.queuedId) : undefined,
        );
        return json(res, 200, result);
      }

      if (req.method === 'POST' && path === '/api/gateway/meta-agents') {
        const body = await readJsonBody(req);
        const result = gateway.updateMetaAgent({
          id: String(body.id || ''),
          applyToAll: typeof body.applyToAll === 'boolean' ? body.applyToAll : undefined,
          enabled: typeof body.enabled === 'boolean' ? body.enabled : undefined,
          policy: body.policy === 'all' || body.policy === 'safe_write' || body.policy === 'reads' ? body.policy : undefined,
          maxRetries: typeof body.maxRetries === 'number' ? body.maxRetries : undefined,
          retryDelaySec: typeof body.retryDelaySec === 'number' ? body.retryDelaySec : undefined,
          maxConsecutiveErrors: typeof body.maxConsecutiveErrors === 'number' ? body.maxConsecutiveErrors : undefined,
          engineMode: body.engineMode === 'agent_brain' || body.engineMode === 'local_rules' ? body.engineMode : undefined,
          brainChannel: body.brainChannel ? (String(body.brainChannel) as any) : undefined,
          brainModel: body.brainModel ? String(body.brainModel) : undefined,
          brainSessionName: body.brainSessionName ? String(body.brainSessionName) : undefined,
          patrolIntervalSec: typeof body.patrolIntervalSec === 'number' ? body.patrolIntervalSec : undefined,
          persona: typeof body.persona === 'string' ? body.persona : undefined,
        });
        return json(res, 200, result);
      }

      if (req.method === 'POST' && path === '/api/gateway/meta-agents/patrol') {
        const body = await readJsonBody(req);
        const result = await gateway.invokeMetaBrainForIncident({
          metaId: (body.metaId || body.agentId || 'meta_maint') as any,
          eventKind:
            body.eventKind === 'execution_failure' || body.eventKind === 'quota_or_model_error' || body.eventKind === 'loop_detected'
              ? body.eventKind
              : 'manual_patrol',
          targetChannel: String(body.targetChannel || body.channel || 'codex'),
          targetSessionName: String(body.targetSessionName || body.targetSession || body.sessionName || 'hub-codex'),
          summary: String(body.summary || body.errorSummary || '用户手动触发元智能体的诊断会话立即对当前会话与渠道做健康巡检与架构诊断'),
        });
        return json(res, 200, result);
      }

      if (req.method === 'POST' && path === '/api/gateway/resume') {
        const body = await readJsonBody(req);
        const result = await gateway.resumeInterruptedSession({
          channel: String(body.channel || 'codex'),
          sessionName: body.sessionName ? String(body.sessionName) : undefined,
          traceSessionId: body.traceSessionId ? String(body.traceSessionId) : undefined,
          customHint: body.customHint ? String(body.customHint) : undefined,
        });
        return json(res, 200, result);
      }

      if (req.method === 'POST' && path === '/api/control') {
        const body = await readJsonBody(req);
        const safeModel = String(body.modelId || 'default').replace(/[^a-zA-Z0-9_-]/g, '_');
        const kind = String(body.kind || 'interject');
        const payload = body.payload || {};
        const casesRoot = join(repoRoot, 'hub', 'cases');
        // Write back only into a case that exists; an unknown id used to create hub/cases/_control_log/<id>/
        // inside the repository (2026-10-17).
        const caseDir = dirUnder(casesRoot, safeModel);
        if (!caseDir) return json(res, 404, { ok: false, error: `没有这个案例：${safeModel}` });
        const tracesDir = join(caseDir, 'traces');
        mkdirSync(tracesDir, { recursive: true });
        const ts = new Date().toISOString();
        const writtenFiles: string[] = [];

        if (kind === 'add_relation') {
          const relFile = join(caseDir, 'relations.md');
          const line = `\n| \`${payload.from || 'human'}\` | \`${payload.to || 'agent'}\` | \`${payload.relType || 'task'}\` | ${payload.text || '人工新增协同交接线'} |\n<!-- Reverse-Control Writeback at ${ts} -->\n`;
          appendFileSync(relFile, line, 'utf8');
          writtenFiles.push('relations.md');
        } else if (kind === 'edit_rule') {
          const targetType = payload.target?.type || 'individual';
          const docName = targetType === 'gate' || targetType === 'step' ? 'process.md' : 'relations.md';
          const docFile = join(caseDir, docName);
          const line = `\n- **[${payload.target?.id || 'rule'}]** 人工修订规则（${ts}）：${payload.text || '补充门禁约束'}\n`;
          appendFileSync(docFile, line, 'utf8');
          writtenFiles.push(docName);
        } else {
          const indId = String(payload.target?.id || payload.to || 'orchestrator').replace(/[^a-zA-Z0-9_-]/g, '_');
          const inboxDir = join(caseDir, 'agents', indId);
          mkdirSync(inboxDir, { recursive: true });
          const inboxFile = join(inboxDir, 'inbox.md');
          const block = `\n## [★ 人工调控指令 · \`${kind}\` · ${ts}]\n- **目标个体**：\`${indId}\`\n- **关联实例**：\`${body.caseId || '-'}\`\n- **指令正文**：${payload.text || '请按人工拍板要求立即复核当前上下文并继续执行'}\n`;
          appendFileSync(inboxFile, block, 'utf8');
          writtenFiles.push(`agents/${indId}/inbox.md`);
        }

        const actionRecord = JSON.stringify({
          ts,
          modelId: safeModel,
          caseId: body.caseId || null,
          kind,
          target: payload.target || null,
          text: payload.text || '',
          action: body.action || null,
        }) + '\n';
        appendFileSync(join(tracesDir, 'human_actions.jsonl'), actionRecord, 'utf8');
        writtenFiles.push('traces/human_actions.jsonl');

        return json(res, 200, { ok: true, ts, writtenFiles });
      }

      if (req.method === 'POST' && path === '/api/m/feedback') {
        const body = await readJsonBody(req, 20 * 1024 * 1024);
        const text = String(body.text || '').slice(0, 20000);
        const images = Array.isArray(body.images) ? body.images.slice(0, 8) : [];
        if (!text.trim() && !images.length) return json(res, 400, { ok: false, error: '没有内容' });
        const now = new Date();
        const id = now.toISOString().replace(/[-:]/g, '').replace(/\..*/, '').replace('T', '-') + '-' + Math.random().toString(36).slice(2, 6);
        const dir = join(FEEDBACK_ROOT, id);
        mkdirSync(dir, { recursive: true });
        const files: string[] = [];
        images.forEach((d: unknown, i: number) => {
          const m = /^data:image\/(png|jpeg|jpg|webp|gif);base64,(.+)$/.exec(String(d || ''));
          if (!m) return;
          const name = 'img-' + (i + 1) + '.' + (m[1] === 'jpeg' ? 'jpg' : m[1]);
          writeFileSync(join(dir, name), Buffer.from(m[2], 'base64'));
          files.push(name);
        });
        const record = { id, at: now.toISOString(), text, page: String(body.page || ''), context: body.context || null, userAgent: String(req.headers['user-agent'] || ''), images: files, handled: false };
        writeFileSync(join(dir, 'feedback.json'), JSON.stringify(record, null, 2), 'utf8');
        return json(res, 200, { ok: true, id, images: files.length });
      }
      if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'read only');
      const head = req.method === 'HEAD';

      // The four tables, read per request from hub/data: units (from the register), products, actions, and unit →
      // action (integration-map.json). channels[product][unit] says how far that unit is wired in for that product
      // and which action does it, with the action's method and path filled in from the action table.
      if (path === '/api/capabilities') {
        const data = (f: string) => JSON.parse(readFileSync(join(repoRoot, 'hub', 'data', f), 'utf8'));
        const units = data('capability-units.json');
        const products = data('products.json');
        const actions = data('actions.json').actions as Array<Record<string, any>>;
        const integ = data('integration-map.json');
        const actionOf = (id: string) => actions.find((a) => a.id === id);
        const rank: Record<string, number> = { real: 4, partial: 3, fill: 2, built: 1, todo: 0 };
        const channels: Record<string, Record<string, unknown>> = {};
        for (const side of ['backend', 'frontend'] as const) {
          for (const [unit, entries] of Object.entries((integ[side] || {}) as Record<string, Array<Record<string, any>>>)) {
            for (const e of entries) {
              const ids = ([] as string[]).concat(e.action || []);
              const api = ids.map(actionOf).filter(Boolean).map((a) => ({ action: a!.id, method: a!.method, path: a!.path }));
              for (const ch of (e.channels || []) as string[]) {
                const slot = ((channels[ch] ||= {})[unit] ||= {}) as Record<string, any>;
                const cur = slot[side];
                if (!cur || (rank[e.status] ?? -1) > (rank[cur.status] ?? -1)) {
                  slot[side] = { status: e.status, fillLevel: e.fillLevel, api, how: e.how || `${e.page}：${e.control}`, note: e.note || '' };
                }
              }
            }
          }
        }
        // The page's controls, from frontend entries that carry `ui` (where, label, handler or call/op): one per unit,
        // on the products any of that unit's frontend entries list (todo excluded).
        const controls: Array<Record<string, unknown>> = [];
        for (const [unit, entries] of Object.entries((integ.frontend || {}) as Record<string, Array<Record<string, any>>>)) {
          const withUi = entries.find((e) => e.ui);
          if (!withUi) continue;
          const chans = new Set<string>();
          for (const e of entries) if (e.status !== 'todo') for (const c of e.channels || []) chans.add(c);
          controls.push({ unit, ...withUi.ui, channels: [...chans] });
        }
        return json(res, 200, {
          ok: true,
          updated: integ.updated,
          units: Array.isArray(units) ? units : units.units,
          products: products.products,
          routes: products.routes,
          actions,
          channels,
          controls,
        });
      }
      // One named session's turn for the command line: `agent_gateway.js read` and `wait` (waitMs > 0).
      if (path === '/api/gateway/run') {
        const channel = String(url.searchParams.get('channel') || ''), session = String(url.searchParams.get('session') || '');
        if (!channel || !session) return json(res, 400, { ok: false, error: 'channel and session required' });
        const waitMs = Math.min(Math.max(Number(url.searchParams.get('waitMs')) || 0, 0), 2 * 3600 * 1000);
        return json(res, 200, await gateway.sessionRun(channel, session, waitMs));
      }
      // Who would get a piece of work now: the center's pick among candidates (load, limit, breaker), with the reasons.
      if (path === '/api/gateway/pick') {
        const list = (k: string) => String(url.searchParams.get(k) || '').split(',').map((x) => x.trim()).filter(Boolean);
        return json(res, 200, { ok: true, ...gateway.pickChannel(list('candidates'), list('exclude')) });
      }
      if (path === '/api/gateway/state') {
        return json(res, 200, gateway.getState());
      }
      if (path === '/api/gateway/models') {
        return json(res, 200, await listModels(gateway, String(url.searchParams.get('channel') || ''), Boolean(url.searchParams.get('refresh'))));
      }
      // Each product's load, breaker, quota and why it cannot take work now (capacity.ts channelOverview).
      if (path === '/api/gateway/channels') {
        return json(res, 200, { ok: true, channels: gateway.channelOverview() });
      }
      // Each product's remaining quota (gateway/quota.ts); ?refresh=1 reads it again first.
      if (path === '/api/gateway/quota') {
        if (url.searchParams.get('refresh')) await gateway.refreshQuota().catch(() => {});
        return json(res, 200, { ok: true, ...gateway.quotaSnapshot() });
      }
      if (path === '/api/gateway/goals') {
        const id = url.searchParams.get('id');
        if (!id) return json(res, 200, { ok: true, goals: gateway.taskboard.listGoals() });
        const v = gateway.taskboard.view(String(id));
        return v ? json(res, 200, { ok: true, ...v }) : json(res, 404, { ok: false, error: `没有这个目标：${id}` });
      }
      if (path === '/api/gateway/dispatches') {
        const id = url.searchParams.get('id') ? String(url.searchParams.get('id')) : undefined;
        const channel = url.searchParams.get('channel') ? String(url.searchParams.get('channel')) : undefined;
        const sessionName = url.searchParams.get('session') ? String(url.searchParams.get('session')) : undefined;
        const status = url.searchParams.get('status') ? String(url.searchParams.get('status')) : undefined;
        const waitMs = url.searchParams.get('waitMs')
          ? Math.min(Math.max(Number(url.searchParams.get('waitMs')) || 0, 0), 2 * 3600 * 1000)
          : undefined;
        const result = await gateway.getDispatches({ id, channel, sessionName, status, waitMs });
        return json(res, result.ok === false ? 404 : 200, result);
      }
      if (path === '/api/gateway/meta-agents') {
        return json(res, 200, { ok: true, metaAgents: gateway.getMetaAgents(), logs: gateway.getMetaAgentLogs() });
      }
      if (path === '/api/gateway/stream') {
        gateway.addSseClient(res);
        return;
      }

      if (path === '/api/health') {
        return json(res, 200, { ok: true, contract: CONTRACT_VERSION, scanning: store.isScanning(), sessions: store.index().sessions.length, viewer: existsSync(join(viewerDir, 'index.html')), search: search ? search.status() : null, roots: store.roots.map((r) => ({ kind: r.adapter.kind, dir: r.dir, exists: existsSync(r.dir) })) });
      }
      if (path === '/api/overview') {
        const roots: RootInfo[] = store.roots.map((r) => ({ kind: r.adapter.kind, label: r.adapter.label, dir: r.dir, exists: existsSync(r.dir) }));
        return json(res, 200, overview(store.index().sessions, roots, CONTRACT_VERSION));
      }
      if (path === '/api/sessions') {
        const baseIdx = store.index();
        const existingIds = new Set(baseIdx.sessions.map((s) => s.id));
        const usesHomeRoots = store.roots.some((r) => r.dir.includes('.codex') || r.dir.includes('.claude') || r.dir.includes('.zcode'));
        const extra = usesHomeRoots ? await gateway.getExtraSummaries(existingIds) : [];
        const combined = (extra.length ? [...extra, ...baseIdx.sessions] : [...baseIdx.sessions]).sort((a, b) =>
          String(b.updatedAt || b.startedAt || '').localeCompare(String(a.updatedAt || a.startedAt || '')),
        );
        const qParam = (url.searchParams.get('q') || '').trim().toLowerCase();
        const chParam = (url.searchParams.get('channel') || '').trim().toLowerCase();
        const limitParam = url.searchParams.get('limit') ? Number(url.searchParams.get('limit')) : 0;
        const perChannelParam = url.searchParams.get('perChannel') ? Math.min(9, Math.max(1, Number(url.searchParams.get('perChannel')))) : 0;
        const syntheticRe = /PONG-|GATEWAY-|OK-SHARED-DAEMON|不要调用任何工具|Reply with exact token|请只回复|请用一句话汇报你的/i;
        const normCh = (s: any) => {
          const raw = String(s?.source?.kind || (s as any)?.channel || s?.agent?.originator || '').toLowerCase();
          if (raw === 'claude-code') return 'claude';
          if (raw === 'agy') return 'antigravity';
          return raw;
        };
        const bindings = gateway.sessionBindings();
        const runs = hubRuns();
        const buildPoint = (id: string, ch: string, fallbackName: string, stateStatus: string, isSubagent: boolean) => {
          const rawSid = id.split(':').pop() || id;
          const b = bindings.get(id) || bindings.get(rawSid);
          const h = runs.get(rawSid);
          const controlName = b?.sessionName || fallbackName || ('m-' + rawSid.replace(/[^\w-]/g, '').slice(0, 12));
          const entry: string = isSubagent
            ? 'subagent'
            : b?.fromAcpxStore
              ? CHANNEL_PROFILES[ch as keyof typeof CHANNEL_PROFILES]?.route || 'acpx'
              : 'local-store';
          const ownership: 'subagent' | 'hub-running' | 'external-active' | 'hub-idle' | 'unclaimed' = isSubagent
            ? 'subagent'
            : h?.status === 'working'
              ? 'hub-running'
              : stateStatus === 'working' || stateStatus === 'waiting'
                ? 'external-active'
                : b?.fromAcpxStore || h
                  ? 'hub-idle'
                  : 'unclaimed';
          const acpControllable = ['codex', 'claude', 'zcode', 'opencode', 'workbuddy'].includes(ch);
          const resumeCap =
            ownership === 'subagent'
              ? { enabled: false, status: 'blocked', mode: 'subagent-readonly', reason: '子智能体会话由父会话派生，仅可查看轨迹，不能作为顶层会话续写' }
              : !acpControllable && ch !== 'antigravity'
                ? { enabled: false, status: 'readonly', mode: 'none', reason: '该渠道当前仅接入本地历史读取或单轮模式' }
                : ownership === 'external-active'
                  ? {
                      enabled: true,
                      status: 'warning',
                      mode: b?.fromAcpxStore ? 'bound' : ch === 'antigravity' ? 'attach-cascade' : 'resume-native',
                      conflictWarning: '该会话正在外部桌面端或终端中活跃运行，直接发消息可能产生并发写冲突',
                    }
                  : ownership === 'hub-running'
                    ? ch === 'codex' || ch === 'antigravity'
                      ? { enabled: true, status: 'ready', mode: 'steer', note: '当前轮次运行中，发消息将直接插进当前这一轮 (steer)' }
                      : { enabled: true, status: 'ready', mode: 'queue-next', note: '当前轮次运行中，发消息将排入下一轮队列' }
                    : ownership === 'hub-idle'
                      ? { enabled: true, status: 'ready', mode: 'bound', note: `已绑定控制名 ${controlName}，发消息将直接沿原会话续写` }
                      : ch === 'antigravity'
                        ? { enabled: true, status: 'ready', mode: 'attach-cascade', note: '发消息将通过 Cascade 切换到该会话并续写' }
                        : { enabled: true, status: 'ready', mode: 'resume-native', note: '原生历史会话，发消息将自动原位接手，不分叉新会话' };
          const capabilities = {
            resume: resumeCap,
            steer:
              ch === 'codex' || ch === 'antigravity'
                ? {
                    enabled: true,
                    status: 'real',
                    mode: 'steer',
                    note: ch === 'codex' ? '常驻 app-server 轮内插话 (turn/steer)' : 'Cascade 轮内插话 (send-message)',
                  }
                : { enabled: false, status: 'fill', fillLevel: 'session', mode: 'inject-next', note: '当前走下一轮排队补齐（无轮内插话）' },
            cancel: { enabled: ownership === 'hub-running', status: ownership === 'hub-running' ? 'ready' : 'idle' },
            modelSwitch:
              ownership === 'subagent' || (!acpControllable)
                ? { enabled: false, status: 'readonly' }
                : {
                    enabled: true,
                    status: 'ready',
                    mode: ch === 'codex' ? 'app-server-settings' : ch === 'claude' ? 'stream-set-model' : b?.fromAcpxStore ? 'acpx-set-model' : 'on-next-send',
                  },
            permission:
              ch === 'codex' || ch === 'claude'
                ? {
                    enabled: true,
                    status: 'real',
                    mode: 'in-turn',
                    note:
                      ch === 'codex'
                        ? 'app-server 轮内挂起审批 (requestApproval → accept/decline)，同意后当前轮继续'
                        : 'stream-json 轮内挂起审批 (can_use_tool → allow/deny)，同意后当前轮继续',
                  }
                : acpControllable
                  ? { enabled: true, status: 'fill', fillLevel: 'session', mode: 'session-retry', note: '按轮次启动参数与拒批后重跑补齐' }
                  : { enabled: false, status: 'readonly' },
          };
          return { product: ch, entry, ownership, controlName, currentModel: b?.currentModel, capabilities };
        };
        const channelCounts: Record<string, number> = {};
        for (const s of combined) {
          const ch = normCh(s);
          if (ch) channelCounts[ch] = (channelCounts[ch] || 0) + 1;
        }
        let filtered = combined;
        if (chParam && chParam !== 'all') {
          filtered = filtered.filter((s) => normCh(s) === chParam);
        }
        if (qParam) {
          filtered = filtered.filter((s) => {
            const hay = `${s.title || ''} ${s.id || ''} ${s.cwd || ''} ${s.source?.kind || ''} ${s.agent?.model || ''}`.toLowerCase();
            return hay.includes(qParam);
          });
        }
        if (perChannelParam > 0) {
          const buckets: Record<string, number> = {};
          const picked: typeof filtered = [];
          for (const s of filtered) {
            const ch = normCh(s);
            if (!['codex', 'claude', 'zcode', 'workbuddy', 'opencode', 'antigravity', 'hermes', 'doubao-desktop'].includes(ch)) continue;
            const titleStr = String(s.title || '').trim();
            if (syntheticRe.test(titleStr)) continue;
            const count = buckets[ch] || 0;
            if (count >= perChannelParam) continue;
            buckets[ch] = count + 1;
            picked.push(
              titleStr.includes('芙芙')
                ? { ...s, title: titleStr.replace(/你是芙芙[，,]?\s*/g, '').replace(/芙芙/g, '元智能体') }
                : s,
            );
          }
          filtered = picked;
        } else if (limitParam > 0 && Number.isFinite(limitParam)) {
          filtered = filtered.slice(0, limitParam);
        }
        const slim = url.searchParams.get('slim') === '1';
        const etag = `"r${store.revision()}-t${gateway.titleRev}-${combined.length}-${chParam}-${qParam}-${limitParam}-${perChannelParam}-${slim}"`;
        if (req.headers['if-none-match'] === etag) { res.writeHead(304, { ETag: etag }); return res.end(); }
        // slim=1: what a list needs (the phone page lists all ~1500 sessions grouped by project), with the working
        // directory normalized into `project` so one folder is one project whichever family wrote it.
        if (slim) {
          const agyChildren = new Map<string, number>();
          for (const a of agyStates().values()) if (a.parent) agyChildren.set('antigravity:' + a.parent, (agyChildren.get('antigravity:' + a.parent) || 0) + 1);
          const sessions = filtered.map((s: any) => {
            const sid = String(s.id);
            const ch = normCh(s);
            const st = liveState(sid, s.state, s.cwd)?.status || '';
            const isSub = s.agent?.role === 'subagent' || Boolean(agyParent(sid));
            const pt = buildPoint(sid, ch, s.agent?.name || '', st, isSub);
            const dsp = gateway.sessionDispatchSummary(sid, ch, pt.controlName);
            return {
              id: s.id,
              channel: ch,
              name: pt.controlName,
              controlName: pt.controlName,
              entry: pt.entry,
              ownership: pt.ownership,
              // Who opened it (driver record): the page offers close and rename only on 'hub' (session-control checks too).
              origin: (bindings.get(sid) || bindings.get(sid.split(':').pop() || ''))?.origin,
              pointCapabilities: pt.capabilities,
              waitingFor: dsp?.waitingFor || undefined,
              dispatchLinks: dsp ? { out: dsp.dispatchedOut, in: dsp.dispatchedIn } : undefined,
              // A name given from the center (session-control rename) wins over the product's own title.
              title: ((bindings.get(sid) || bindings.get(sid.split(':').pop() || ''))?.customTitle || nativeTitle(sid, String(s.title || ''))).slice(0, 160),
              project: nativeProject(sid, s.cwd),
              model: s.agent?.model || pt.currentModel || '',
              updatedAt: s.updatedAt || s.startedAt || '',
              state: st,
              turns: s.stats?.turns || 0,
              toolCalls: s.stats?.toolCalls || 0,
              subagent: isSub || undefined,
              // Started by a program (an agent's test through the SDK) rather than a person or this hub.
              auto: (/^sdk/i.test(String(s.agent?.originator || '')) && !runs.has(sid.split(':').pop() || '')) || undefined,
              parent: (s.links || []).find((l: any) => l.rel === 'parent')?.id || agyParent(sid) || undefined,
              children: (s.links || []).filter((l: any) => l.rel === 'child').length || agyChildren.get(sid) || undefined,
            };
          });
          return json(res, 200, { ok: true, totalCount: combined.length, channelCounts, sessions }, { ETag: etag });
        }
        return json(res, 200, { ...baseIdx, totalCount: combined.length, channelCounts, sessions: filtered }, { ETag: etag });
      }
      if (path === '/api/search') {
        if (!search) return json(res, 404, { error: 'search is off' });
        return json(res, 200, await search.searchAsync(searchQuery(url.searchParams)));
      }
      if (path === '/api/stats') {
        if (!search) return json(res, 404, { error: 'search is off' });
        return json(res, 200, search.stats(CONTRACT_VERSION));
      }
      // a session and every sub-agent it started, at any depth: what the observatory draws as one org graph
      const t = /^\/api\/sessions\/([^/]+)\/tree$/.exec(path);
      if (t) {
        const rawRootId = t[1];
        const ids = subtree(store.index().sessions, rawRootId, TREE_MAX);
        if (!ids.length) {
          const gwSess = await gateway.readSessionContract(rawRootId);
          if (gwSess) {
            return json(res, 200, { contract: CONTRACT_VERSION, sessions: [gwSess], truncated: false });
          }
          return json(res, 404, { error: 'no such session' });
        }
        const sessions = (await Promise.all(ids.map((id) => store.session(id)))).filter((s): s is Session => Boolean(s));
        return json(res, 200, { contract: CONTRACT_VERSION, sessions, truncated: ids.length >= TREE_MAX });
      }
      // A file a session produced or used, for the phone page to open (reports, pages, pictures). Only paths the
      // session itself names (tool arguments, paths written in its text) or its own Antigravity folder: this does
      // not become a general file reader.
      const fm = /^\/api\/sessions\/([^/]+)\/file$/.exec(path);
      if (fm) {
        const sid = fm[1];
        const want = String(url.searchParams.get('path') || '');
        const sess = await gateway.readSessionContract(sid) || (await store.session(sid));
        if (!sess || !want) return json(res, 404, { ok: false, error: 'no such session or path' });
        const norm = (p: string) => p.replace(/\//g, '\\').replace(/^\\\\\?\\/, '').toLowerCase();
        const allowed = new Set(sessionFiles(sess).map(norm));
        const target = norm(want);
        const agyDir = sid.startsWith('antigravity:') ? norm(join(homedir(), '.gemini', 'antigravity', 'brain', sid.slice('antigravity:'.length))) : '';
        if (!allowed.has(target) && !(agyDir && target.startsWith(agyDir + '\\'))) return json(res, 403, { ok: false, error: '这个文件不是该会话写过或提到的' });
        let st;
        try { st = statSync(want); } catch { return json(res, 404, { ok: false, error: '文件不在了' }); }
        if (!st.isFile() || st.size > 5 * 1024 * 1024) return json(res, 413, { ok: false, error: '不是文件或超过 5MB' });
        return sendFile(res, want, head);
      }
      if (/^\/api\/sessions\/[^/]+\/files$/.test(path)) {
        const sid = path.split('/')[3];
        const sess = await gateway.readSessionContract(sid) || (await store.session(sid));
        if (!sess) return json(res, 404, { ok: false, error: 'no such session' });
        const files = sessionFiles(sess).filter((p) => { try { return statSync(p).isFile(); } catch { return false; } });
        return json(res, 200, { ok: true, files });
      }
      const m = /^\/api\/sessions\/([^/]+)(\/otel)?$/.exec(path);
      if (m) {
        const rawId = m[1];
        // File-only Doubao sessions never enter the execution gateway or its session discovery.
        const isDoubao = rawId.startsWith('doubao-desktop:');
        const acpxSess = isDoubao ? null : await gateway.readSessionContract(rawId);
        const storeSess =
          rawId.startsWith('new:') ||
          rawId.startsWith('acpx:') ||
          rawId.startsWith('antigravity:') ||
          rawId.startsWith('agy:') ||
          rawId.startsWith('workbuddy:') ||
          rawId.startsWith('hermes:')
            ? undefined
            : await store.session(rawId);
        const rawSession =
          acpxSess && (!storeSess || acpxSess.turns.length > storeSess.turns.length)
            ? { ...acpxSess, id: rawId }
            : storeSess
              ? {
                  ...storeSess,
                  agent: {
                    ...storeSess.agent,
                    name: storeSess.agent?.name || acpxSess?.agent?.name || '',
                    model: storeSess.agent?.model || acpxSess?.agent?.model,
                  },
                }
              : acpxSess;
        if (!rawSession) return json(res, 404, { error: 'no such session' });
        if (m[2]) return json(res, 200, sessionToOtlp(rawSession));
        (rawSession as any).state = liveState(String(rawSession.id), (rawSession as any).state, (rawSession as any).cwd);
        const sid = String(rawSession.id);
        const rawCh = String(rawSession.source?.kind || (rawSession as any)?.channel || rawSession.agent?.originator || '').toLowerCase();
        const ch = rawCh === 'claude-code' ? 'claude' : rawCh === 'agy' ? 'antigravity' : rawCh;
        const isSub = rawSession.agent?.role === 'subagent' || Boolean(agyParent(sid));
        const b = isDoubao ? undefined : gateway.sessionBindings().get(sid) || gateway.sessionBindings().get(sid.split(':').pop() || sid);
        const h = isDoubao ? undefined : hubRuns().get(sid.split(':').pop() || sid);
        const stStatus = (rawSession as any).state?.status || '';
        const controlName = b?.sessionName || rawSession.agent?.name || ('m-' + (sid.split(':').pop() || sid).replace(/[^\w-]/g, '').slice(0, 12));
        const entry: string = isSub
          ? 'subagent'
          : b?.fromAcpxStore
            ? CHANNEL_PROFILES[ch as keyof typeof CHANNEL_PROFILES]?.route || 'acpx'
            : 'local-store';
        const ownership: 'subagent' | 'hub-running' | 'external-active' | 'hub-idle' | 'unclaimed' = isSub
          ? 'subagent'
          : h?.status === 'working'
            ? 'hub-running'
            : stStatus === 'working' || stStatus === 'waiting'
              ? 'external-active'
              : b?.fromAcpxStore || h
                ? 'hub-idle'
                : 'unclaimed';
        const acpControllable = ['codex', 'claude', 'zcode', 'opencode', 'workbuddy'].includes(ch);
        const pointCapabilities = {
          resume:
            ownership === 'subagent'
              ? { enabled: false, status: 'blocked', mode: 'subagent-readonly', reason: '子智能体会话由父会话派生，仅可查看轨迹，不能作为顶层会话续写' }
              : !acpControllable && ch !== 'antigravity'
                ? { enabled: false, status: 'readonly', mode: 'none', reason: '该渠道当前仅接入本地历史读取或单轮模式' }
                : ownership === 'external-active'
                  ? {
                      enabled: true,
                      status: 'warning',
                      mode: b?.fromAcpxStore ? 'bound' : ch === 'antigravity' ? 'attach-cascade' : 'resume-native',
                      conflictWarning: '该会话正在外部桌面端或终端中活跃运行，直接发消息可能产生并发写冲突',
                    }
                  : ownership === 'hub-running'
                    ? ch === 'codex' || ch === 'antigravity'
                      ? { enabled: true, status: 'ready', mode: 'steer', note: '当前轮次运行中，发消息将直接插进当前这一轮 (steer)' }
                      : { enabled: true, status: 'ready', mode: 'queue-next', note: '当前轮次运行中，发消息将排入下一轮队列' }
                    : ownership === 'hub-idle'
                      ? { enabled: true, status: 'ready', mode: 'bound', note: `已绑定控制名 ${controlName}，发消息将直接沿原会话续写` }
                      : ch === 'antigravity'
                        ? { enabled: true, status: 'ready', mode: 'attach-cascade', note: '发消息将通过 Cascade 切换到该会话并续写' }
                        : { enabled: true, status: 'ready', mode: 'resume-native', note: '原生历史会话，发消息将自动原位接手，不分叉新会话' },
          steer:
            ch === 'codex' || ch === 'antigravity'
              ? {
                  enabled: true,
                  status: 'real',
                  mode: 'steer',
                  note: ch === 'codex' ? '常驻 app-server 轮内插话 (turn/steer)' : 'Cascade 轮内插话 (send-message)',
                }
              : { enabled: false, status: 'fill', fillLevel: 'session', mode: 'inject-next', note: '当前走下一轮排队补齐（无轮内插话）' },
          cancel: { enabled: ownership === 'hub-running', status: ownership === 'hub-running' ? 'ready' : 'idle' },
          modelSwitch:
            ownership === 'subagent' || !acpControllable
              ? { enabled: false, status: 'readonly' }
              : {
                  enabled: true,
                  status: 'ready',
                  mode: ch === 'codex' ? 'app-server-settings' : ch === 'claude' ? 'stream-set-model' : b?.fromAcpxStore ? 'acpx-set-model' : 'on-next-send',
                },
          permission:
            ch === 'codex' || ch === 'claude'
              ? {
                  enabled: true,
                  status: 'real',
                  mode: 'in-turn',
                  note:
                    ch === 'codex'
                      ? 'app-server 轮内挂起审批 (requestApproval → accept/decline)，同意后当前轮继续'
                      : 'stream-json 轮内挂起审批 (can_use_tool → allow/deny)，同意后当前轮继续',
                }
              : acpControllable
                ? { enabled: true, status: 'fill', fillLevel: 'session', mode: 'session-retry', note: '按轮次启动参数与拒批后重跑补齐' }
                : { enabled: false, status: 'readonly' },
        };
        if (rawSession.agent && !rawSession.agent.name && controlName) {
          rawSession.agent = { ...rawSession.agent, name: controlName };
        }
        const dsp = gateway.sessionDispatchSummary(sid, ch, controlName);
        (rawSession as any).controlName = controlName;
        (rawSession as any).entry = entry;
        (rawSession as any).ownership = ownership;
        (rawSession as any).point = { product: ch, entry, ownership, controlName };
        (rawSession as any).pointCapabilities = pointCapabilities;
        if (dsp?.waitingFor) (rawSession as any).waitingFor = dsp.waitingFor;
        if (dsp) (rawSession as any).dispatchLinks = { out: dsp.dispatchedOut, in: dsp.dispatchedIn };
        let session = url.searchParams.get('compact') === '1' ? compactSessionForUi(rawSession) : rawSession;
        const tailParam = url.searchParams.get('tail') ? Number(url.searchParams.get('tail')) : 0;
        const beforeParam = url.searchParams.get('before') ? Number(url.searchParams.get('before')) : 0;
        const limitParam = url.searchParams.get('limit') ? Number(url.searchParams.get('limit')) : 15;
        const totalTurns = session.turns.length;
        let pagination:
          | {
              totalTurns: number;
              hasOlder: boolean;
              olderBefore: number | null;
              returnedTurns: number;
            }
          | undefined;

        if (beforeParam > 0 && Number.isFinite(beforeParam)) {
          const endIdx = Math.max(0, Math.min(totalTurns, beforeParam));
          const startIdx = Math.max(0, endIdx - Math.max(1, limitParam));
          session = { ...session, turns: session.turns.slice(startIdx, endIdx) };
          pagination = {
            totalTurns,
            hasOlder: startIdx > 0,
            olderBefore: startIdx > 0 ? startIdx : null,
            returnedTurns: session.turns.length,
          };
        } else if (tailParam > 0 && Number.isFinite(tailParam) && totalTurns > tailParam) {
          const startIdx = Math.max(0, totalTurns - tailParam);
          session = { ...session, turns: session.turns.slice(startIdx) };
          pagination = {
            totalTurns,
            hasOlder: startIdx > 0,
            olderBefore: startIdx > 0 ? startIdx : null,
            returnedTurns: session.turns.length,
          };
        } else if (tailParam > 0) {
          pagination = {
            totalTurns,
            hasOlder: false,
            olderBefore: null,
            returnedTurns: totalTurns,
          };
        }

        const doc = { contract: CONTRACT_VERSION, session, ...(pagination ? { pagination } : {}) };
        return json(res, 200, doc);
      }
      // Feedback from the phone page (user 2026-10-18: paste a screenshot on the page, optimise from it later).
      // Kept outside the repo (it is public on GitHub and screenshots may show private things).
      const FEEDBACK_DIR = FEEDBACK_ROOT;
      if (path === '/api/m/feedback') {
        const items: unknown[] = [];
        if (existsSync(FEEDBACK_DIR)) {
          for (const name of readdirSync(FEEDBACK_DIR).sort().reverse().slice(0, 200)) {
            try { items.push(JSON.parse(readFileSync(join(FEEDBACK_DIR, name, 'feedback.json'), 'utf8'))); } catch {}
          }
        }
        return json(res, 200, { ok: true, items });
      }
      const fb = /^\/api\/m\/feedback\/([\w-]+)\/(img-\d+\.(?:png|jpg|webp|gif))$/.exec(path);
      if (fb) {
        const file = join(FEEDBACK_DIR, fb[1], fb[2]);
        return existsSync(file) ? sendFile(res, file, head) : send(res, 404, 'not found');
      }
      // A conversation just created still has last_modified_time 0001-01-01; sort it first, not last.
      // Antigravity conversations with their run state from its own index (the only reliable source: RUNNING is
      // working; IDLE with not_fully_idle=1 has yielded and is waiting on a background task; IDLE/0 is done).
      if (path === '/api/m/sessions') {
        const channel = String(url.searchParams.get('channel') || '');
        if (!channel) return json(res, 400, { ok: false, error: 'channel required' });
        const limit = Math.min(Number(url.searchParams.get('limit')) || 60, 200);
        return json(res, 200, { ok: true, channel, sessions: gateway.mobileSessions(channel, limit) });
      }
      if (path === '/api/m/agy') {
        const limit = Math.min(Number(url.searchParams.get('limit')) || 40, 200);
        let names: Record<string, string> = {};
        try {
          const map = JSON.parse(readFileSync(join(homedir(), '.acpx', 'agy-sessions.json'), 'utf8')) as Record<string, string>;
          for (const [name, cid] of Object.entries(map)) names[cid] = name;
        } catch {}
        const db = new DatabaseSync(join(homedir(), '.gemini', 'antigravity', 'conversation_summaries.db'), { readOnly: true });
        try {
          const rows = db
            .prepare(`SELECT conversation_id AS id, title, status, not_fully_idle AS busy, step_count AS steps, last_modified_time AS updatedAt, last_user_input_time AS lastInputAt, parent_conversation_id AS parentId, nesting_depth AS depth, killed FROM conversation_summaries ORDER BY CASE WHEN last_modified_time LIKE '0001%' AND IFNULL(last_user_input_time, '0001') LIKE '0001%' THEN '9999' ELSE MAX(last_modified_time, IFNULL(last_user_input_time, '')) END DESC LIMIT ?`)
            .all(limit) as Array<Record<string, unknown>>;
          const conversations = rows.map((r) => {
            const running = String(r.status).endsWith('RUNNING');
            const state = r.killed ? 'killed' : running ? 'working' : r.busy ? 'waiting' : 'idle';
            return { ...r, state, sessionName: names[String(r.id)] || '', traceSessionId: 'antigravity:' + r.id };
          });
          return json(res, 200, { ok: true, conversations });
        } finally {
          db.close();
        }
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
      if (path === '/m') { res.writeHead(302, { Location: '/m/' }); return res.end(); }
      if (path === '/m/' || path.startsWith('/m/')) {
        const file = fileUnder(join(repoRoot, 'm'), path === '/m/' ? 'index.html' : path.slice('/m/'.length));
        return file ? sendFile(res, file, head) : send(res, 404, 'not found');
      }
      if (path === '/console' || path === '/control') { res.writeHead(302, { Location: '/console/' }); return res.end(); }
      if (path === '/console/' || path === '/console/index.html') {
        const file = fileUnder(join(repoRoot, 'console'), 'index.html');
        return file ? sendFile(res, file, head) : send(res, 404, 'not found');
      }
      if (path.startsWith('/console/')) {
        const file = fileUnder(join(repoRoot, 'console'), path.slice('/console/'.length));
        return file ? sendFile(res, file, head) : send(res, 404, 'not found');
      }
      if (path === '/concept') { res.writeHead(302, { Location: '/concept/' }); return res.end(); }
      if (path === '/concept/' || path === '/concept/index.html') {
        const file = fileUnder(join(repoRoot, 'concept'), 'index.html');
        return file ? sendFile(res, file, head) : send(res, 404, 'not found');
      }
      if (path.startsWith('/concept/')) {
        const file = fileUnder(join(repoRoot, 'concept'), path.slice('/concept/'.length));
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
    if (opts.lanHost) allowedHosts.add(opts.lanHost.toLowerCase() + ':' + port);
    // Warm up before the first request, then rescan on a timer: no request ever waits
    // for (or shares a thread with) a rescan any more. The cadence keeps the directory
    // cache warm, which is what makes the rescan itself cheap.
    const warmup = setTimeout(() => { refresh().catch((error) => console.error('[session-refresh]', error)); }, 250);
    if (typeof warmup.unref === 'function') warmup.unref();
    const timer = setInterval(() => { refresh().catch((error) => console.error('[session-refresh]', error)); }, 60000);
    if (typeof timer.unref === 'function') timer.unref();
    server.once('close', () => {
      clearTimeout(warmup);
      clearInterval(timer);
      void gateway.sessionReader?.close().catch((error) => console.error('[session-reader-close]', error));
      void store.close().catch((error) => console.error('[store-close]', error));
    });
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
