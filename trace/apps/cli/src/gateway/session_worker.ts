import { parentPort, workerData } from 'node:worker_threads';
import { statSync } from 'node:fs';
import type { Session, SessionSummary } from '@hub-trace/contract';
import { summarize } from '@hub-trace/contract';
import { AgentGatewayHub } from '../gateway.ts';
import { SessionStore } from '../store.ts';

const hub = new AgentGatewayHub(workerData.repoRoot, new SessionStore({ cacheFile: workerData.cacheFile }));
const cache = new Map<string, { stamp: string; session: Session }>();
const summaries = new Map<string, { stamp: string; summary: SessionSummary }>();
function stamp(path: string) {
  const stat = statSync(path);
  let value = `${path}:${stat.size}:${stat.mtimeMs}`;
  if (/\.(db|sqlite)$/i.test(path)) {
    try { const wal = statSync(path + '-wal'); value += `:${wal.size}:${wal.mtimeMs}`; } catch (error: any) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
  return value;
}
function contract(id: string) {
  const previous = cache.get(id);
  if (previous?.session.source.path && previous.stamp === stamp(previous.session.source.path)) return previous.session;
  const session = hub.getAcpxSessionAsContract(id);
  if (session?.source.path) {
    const signature = stamp(session.source.path);
    cache.set(id, { stamp: signature, session });
    summaries.set(id, { stamp: signature, summary: summarize(session) });
    if (cache.size > 128) cache.delete(cache.keys().next().value!);
    if (summaries.size > 2048) summaries.delete(summaries.keys().next().value!);
  }
  return session;
}
function summary(id: string) {
  const previous = summaries.get(id);
  if (previous?.summary.source.path && previous.stamp === stamp(previous.summary.source.path)) return previous.summary;
  const session = contract(id);
  return session ? summarize(session) : null;
}
let queue = Promise.resolve();
parentPort!.on('message', ({ id, method, args }) => {
  queue = queue.then(async () => {
    const started = performance.now();
    try {
      let value;
      if (method === 'list') {
        const list = hub.listAcpxSessions();
        const recent = list.filter((s) => Date.now() - Date.parse(s.updatedAt || '') < 30 * 60_000)
          .map((s) => summary(s.traceSessionId)).filter((s): s is SessionSummary => Boolean(s));
        value = { list, recent };
      } else if (method === 'contract') value = contract(args[0]);
      else if (method === 'summaries') {
        const existing = new Set(args[0]);
        value = hub.listAcpxSessions().filter((s) => !existing.has(s.traceSessionId)).map((s) => summary(s.traceSessionId))
          .filter((s): s is SessionSummary => Boolean(s?.stats.turns));
      } else throw new Error(`Unknown gateway read operation ${method}`);
      parentPort!.postMessage({ id, value });
    } catch (error) {
      parentPort!.postMessage({ id, error: error instanceof Error ? error.stack : String(error) });
    } finally {
      console.log(`[session-read-worker] ${method} ${(performance.now() - started).toFixed(1)}ms`);
    }
  });
});
