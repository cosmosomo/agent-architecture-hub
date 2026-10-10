/**
 * hub-trace command line. Run from trace/: `npm run scan`, `npm run serve`, `npm run cli -- <command>`.
 *
 *   scan                         update the index; prints counts only
 *   list [--limit N] [--state S] list indexed sessions (titles included)
 *   show <id> [--otel] [--out F] one session as contract JSON (or OTLP)
 *   serve [--port P] [--host H]  local service: /api, /trace/ (viewer), / (observatory)
 *
 *   --root DIR    search DIR instead of the default homes (repeatable)
 *   --cache FILE  index cache file (default ~/.agent-hub/trace/index-v<contract>.json)
 */
import { writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ADAPTERS } from '@hub-trace/adapters';
import { CONTRACT_VERSION, type SessionStatus } from '@hub-trace/contract';
import { sessionToOtlp } from '@hub-trace/otel';
import { createService, listen } from './server.ts';
import { SessionStore, type Root } from './store.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const TRACE_DIR = resolve(HERE, '..', '..', '..');
const REPO_ROOT = resolve(TRACE_DIR, '..');

type Args = { cmd: string; pos: string[]; flags: Map<string, string[]> };

function parseArgs(argv: string[]): Args {
  const flags = new Map<string, string[]>();
  const pos: string[] = [];
  const bool = new Set(['otel']);
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

function storeFrom(a: Args): SessionStore {
  const dirs = a.flags.get('root');
  const roots: Root[] | undefined = dirs?.flatMap((d) => ADAPTERS.map((adapter) => ({ adapter, dir: resolve(d) })));
  return new SessionStore({ roots, cacheFile: flag(a, 'cache') });
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
    case 'serve': {
      await scan(store);
      const server = createService({ store, repoRoot: REPO_ROOT, viewerDir: join(TRACE_DIR, 'apps', 'viewer', 'dist') });
      const url = await listen(server, Number(flag(a, 'port') || 8790), flag(a, 'host') || '127.0.0.1');
      console.log('本地服务 ' + url + '/   观察台');
      console.log('         ' + url + '/trace/   Trace 查看器');
      console.log('按 Ctrl+C 停止');
      return;
    }
    default:
      console.log(['用法：node apps/cli/src/main.ts <scan|list|show|serve> [选项]', '  scan                     更新索引，只打印数量', '  list [--limit N] [--state S]', '  show <id> [--otel] [--out 文件]', '  serve [--port 8790] [--host 127.0.0.1]', '  --root 目录   换搜索目录（可多次）', '  --cache 文件  索引缓存文件'].join('\n'));
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
