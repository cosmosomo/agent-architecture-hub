/**
 * hub-trace command line. Run from trace/: `npm run scan`, `npm run serve`, `npm run cli -- <command>`.
 *
 *   scan                         update the index; prints counts only
 *   list [--limit N] [--state S] list indexed sessions (titles included)
 *   show <id> [--otel] [--out F] one session as contract JSON (or OTLP)
 *   serve [--port P] [--host H] [--open]  the whole observatory on one address (default 127.0.0.1:8899, the next free one when
 *                                a different program holds it): / page, /api, /trace/; --open opens the browser
 *   index                        build or update the step search index; prints counts only
 *
 *   --root DIR    search DIR instead of the default homes (repeatable)
 *   --cache FILE  index cache file (default ~/.agent-hub/trace/index-v<contract>.json)
 */
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { randomBytes } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ADAPTERS } from '@hub-trace/adapters';
import { CONTRACT_VERSION, type SessionStatus } from '@hub-trace/contract';
import { sessionToOtlp } from '@hub-trace/otel';
import { SearchIndex } from './search.ts';
import { createService, listen } from './server.ts';
import { SessionStore, type Root } from './store.ts';

/** The one address of the observatory: page, sessions API and Trace viewer. */
const DEFAULT_PORT = 8899;
const HERE = dirname(fileURLToPath(import.meta.url));
const TRACE_DIR = resolve(HERE, '..', '..', '..');
const REPO_ROOT = resolve(TRACE_DIR, '..');

type Args = { cmd: string; pos: string[]; flags: Map<string, string[]> };

function parseArgs(argv: string[]): Args {
  const flags = new Map<string, string[]>();
  const pos: string[] = [];
  const bool = new Set(['otel', 'open']);
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const val = bool.has(key) ? 'true' : argv[++i];
      if (val === undefined) throw new Error('--' + key + ' needs a value');
      flags.set(key, (flags.get(key) || []).concat(val));
    } else pos.push(a);
  }
  return { cmd: pos.shift() || 'help', pos, flags };
}

const flag = (a: Args, k: string) => a.flags.get(k)?.[0];

/** The search index lives next to the summary index. */
const sizeOf = (f: string) => { try { return (statSync(f).size / 1048576).toFixed(0) + ' MB'; } catch { return '?'; } };

const searchFile = (store: SessionStore) => join(dirname(store.cacheFile), 'search-v' + CONTRACT_VERSION + '.sqlite');

function storeFrom(a: Args): SessionStore {
  const dirs = a.flags.get('root');
  const roots: Root[] | undefined = dirs?.flatMap((d) => ADAPTERS.map((adapter) => ({ adapter, dir: resolve(d) })));
  return new SessionStore({ roots, cacheFile: flag(a, 'cache'), worker: a.cmd === 'serve' });
}

async function scan(store: SessionStore) {
  const report = await store.scan((done, total) => process.stderr.write('\r扫描 ' + done + '/' + total));
  process.stderr.write('\r');
  const idx = store.index();
  const by = new Map<string, number>();
  for (const s of idx.sessions) by.set(s.state.status, (by.get(s.state.status) || 0) + 1);
  const formats = new Map<string, number>();
  for (const s of idx.sessions) formats.set(s.source.format, (formats.get(s.source.format) || 0) + 1);
  console.log('文件 ' + report.files + '，本次解析 ' + report.parsed + '，沿用 ' + report.reused + '，失败 ' + report.failed + '，移除 ' + report.removed + '，用时 ' + (report.ms / 1000).toFixed(1) + ' 秒');
  console.log('会话 ' + idx.sessions.length + '；状态 ' + Array.from(by).map(([k, n]) => k + ' ' + n).join('、'));
  console.log('格式 ' + Array.from(formats).map(([k, n]) => k + ' ' + n).join('、'));
  const notes = new Map<string, number>();
  for (const s of idx.sessions) for (const n of s.notes) notes.set(n.replace(/ × \d+$/, ''), (notes.get(n.replace(/ × \d+$/, '')) || 0) + 1);
  if (notes.size) console.log('解析提示（出现在几个会话里）：' + Array.from(notes).sort((x, y) => y[1] - x[1]).slice(0, 12).map(([k, n]) => k + ' ' + n).join('；'));
  for (const e of report.errors) console.log('失败 ' + e.replace(/:.*/, '') + '：' + e.replace(/^[^:]*:[^:]*: ?/, ''));
  console.log('索引 ' + store.cacheFile);
}

async function main() {
  const a = parseArgs(process.argv.slice(2));
  const store = storeFrom(a);
  switch (a.cmd) {
    case 'scan':
      await scan(store);
      return;
    case 'list': {
      await store.scan();
      const limit = Number(flag(a, 'limit') || 30);
      const state = flag(a, 'state') as SessionStatus | undefined;
      const rows = store.index().sessions.filter((s) => !state || s.state.status === state).slice(0, limit);
      for (const s of rows) console.log([s.updatedAt?.slice(0, 16).replace('T', ' ') || '', s.state.status.padEnd(7), String(s.stats.turns).padStart(3) + ' 轮', s.agent.role === 'subagent' ? '子' : '主', s.id, s.title].join('  '));
      return;
    }
    case 'show': {
      const id = a.pos[0];
      if (!id) throw new Error('show needs a session id');
      await store.scan();
      const session = await store.session(id);
      if (!session) throw new Error('no such session: ' + id);
      const body = JSON.stringify(a.flags.has('otel') ? sessionToOtlp(session) : { contract: CONTRACT_VERSION, session }, null, 2);
      const out = flag(a, 'out');
      if (out) { writeFileSync(out, body); console.log('写入 ' + out); }
      else console.log(body);
      return;
    }
    case 'index': {
      await scan(store);
      const search = new SearchIndex(searchFile(store));
      const timer = setInterval(() => { const p = search.status(); process.stderr.write('\r索引 ' + p.done + '/' + p.total); }, 1000);
      const r = await search.sync(store.files(), (f) => store.parseSource(f)).finally(() => clearInterval(timer));
      clearInterval(timer);
      process.stderr.write('\r');
      console.log('检索索引：会话 ' + r.sessions + '，本次重建 ' + r.indexed + '，移除 ' + r.removed + '，失败 ' + r.failed + '，新写入 ' + r.steps + ' 步，用时 ' + (r.ms / 1000).toFixed(1) + ' 秒；共 ' + search.status().steps + ' 步');
      if (r.indexed > 20) { process.stderr.write('整理索引…'); search.optimize(); process.stderr.write('好了' + String.fromCharCode(10)); }
      console.log('存储 ' + sizeOf(search.file));
      search.close();
      return;
    }
    case 'serve': {
      // The page is up at once; sessions fill in while the first scan runs (the page polls the index).
      const search = new SearchIndex(searchFile(store), { worker: true });
      // --lan <address> (or HUB_LAN_HOST) also serves the page to other devices at that address, e.g. a phone
      // on EasyTier; every request from another machine then needs the access token kept in ~/.agent-hub/.
      const lanHost = (flag(a, 'lan') || process.env.HUB_LAN_HOST || '').trim() || undefined;
      const accessToken = lanHost ? lanAccessToken() : undefined;
      const server = createService({ store, search, repoRoot: REPO_ROOT, viewerDir: join(TRACE_DIR, 'apps', 'viewer', 'dist'), lanHost, accessToken });
      const host = flag(a, 'host') || (lanHost ? '0.0.0.0' : '127.0.0.1'), asked = flag(a, 'port');
      const first = Number(asked || DEFAULT_PORT), last = asked ? first : first + 20;
      let url = '';
      for (let port = first; ; port++) {
        try { url = await listen(server, port, host); break; }
        catch (e) { if ((e as NodeJS.ErrnoException).code !== 'EADDRINUSE' || port >= last) throw e; }
      }
      if (!asked && !url.endsWith(':' + DEFAULT_PORT)) console.log('端口 ' + DEFAULT_PORT + ' 被别的程序占着（多半是旧的静态文件服务），这次用 ' + url.replace(/^.*:/, '') + '。');
      console.log('观察台 ' + url + '/');
      console.log('Trace  ' + url + '/trace/');
      console.log('按 Ctrl+C 停止');
      if (flag(a, 'open')) {
        const [cmd, args] = process.platform === 'win32' ? ['cmd', ['/c', 'start', '', url + '/']] : process.platform === 'darwin' ? ['open', [url + '/']] : ['xdg-open', [url + '/']];
        spawn(cmd, args, { detached: true, stdio: 'ignore' }).on('error', () => {}).unref();
      }
      // A side instance (HUB_BACKGROUND=0) shares ~/.agent-hub/trace with 8899: it searches the index 8899 keeps
      // and does not rebuild it. Two writers on one file failed with “database is locked” all day (10-20).
      const sideInstance = process.env.HUB_BACKGROUND === '0';
      scan(store)
        .then(() => (sideInstance ? { indexed: 0, removed: 0, ms: 0 } : search.sync(store.files(), (f) => store.parseSource(f))))
        .then((r) => { if (r.indexed || r.removed) console.log('检索索引就绪：重建 ' + r.indexed + ' 个会话，用时 ' + (r.ms / 1000).toFixed(1) + ' 秒'); })
        .catch((err) => console.error('扫描出错：' + (err instanceof Error ? err.message : err)));
      return;
    }
    default:
      console.log(['用法：node apps/cli/src/main.ts <scan|list|show|serve> [选项]', '  scan                     更新索引，只打印数量', '  list [--limit N] [--state S]', '  show <id> [--otel] [--out 文件]', '  serve [--port 8899] [--host 127.0.0.1] [--open]', '  index                    建立或更新检索索引', '  --root 目录   换搜索目录（可多次）', '  --cache 文件  索引缓存文件'].join('\n'));
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  if ((err as NodeJS.ErrnoException)?.code === 'EADDRINUSE') console.error('端口被占用：可能是旧的静态服务还开着。关掉它，或换一个：npm start -- --port 8900');
  process.exit(1);
});

/** Token for requests from other devices: HUB_ACCESS_TOKEN, else one kept in ~/.agent-hub/lan-token (created once). */
function lanAccessToken(): string {
  const fromEnv = (process.env.HUB_ACCESS_TOKEN || '').trim();
  if (fromEnv) return fromEnv;
  const dir = join(homedir(), '.agent-hub');
  const file = join(dir, 'lan-token');
  try { const t = readFileSync(file, 'utf8').trim(); if (t) return t; } catch {}
  mkdirSync(dir, { recursive: true });
  const t = randomBytes(24).toString('base64url');
  writeFileSync(file, t + '\n', { mode: 0o600 });
  return t;
}
