/**
 * Where sessions come from. The viewer only knows the contract: the local service
 * (/api) is one source; a dropped file parsed in the page by the same adapters is another.
 */
import { adapterForFile, codexAdapter, parseText } from '@hub-trace/adapters';
import { isCompatible, summarize, type Overview, type Session, type SessionDoc, type SessionIndex, type SessionSummary, type StatsDoc } from '@hub-trace/contract';

export class ServiceError extends Error {}

async function getJson<T>(url: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, { cache: 'no-store' });
  } catch {
    throw new ServiceError('连不上本地服务');
  }
  if (!res.ok) throw new ServiceError(res.status === 404 ? '找不到这个会话' : '本地服务出错（' + res.status + '）');
  return (await res.json()) as T;
}

let indexEtag: string | null = null;
let indexCache: SessionIndex | null = null;

/** The session list. The service answers 304 while the index is unchanged, so the
 *  viewer's 8-second poll costs ~nothing instead of 1.7MB of JSON every time. */
export async function loadIndex(): Promise<SessionIndex> {
  let res: Response;
  try {
    res = await fetch('/api/sessions', {
      cache: 'no-store',
      ...(indexEtag ? { headers: { 'If-None-Match': indexEtag } } : {}),
    });
  } catch {
    throw new ServiceError('连不上本地服务');
  }
  if (res.status === 304 && indexCache) return indexCache;
  if (res.status === 304) return loadIndexFresh();
  if (res.ok) {
    const etag = res.headers.get('ETag');
    if (etag) indexEtag = etag;
    const idx = (await res.json()) as SessionIndex;
    if (!isCompatible(idx.contract)) throw new ServiceError('本地服务的数据契约版本 ' + idx.contract + ' 和查看器不一致，请重新构建');
    indexCache = idx;
    return idx;
  }
  return loadIndexFresh();
}

async function loadIndexFresh(): Promise<SessionIndex> {
  indexEtag = null;
  const res = await fetch('/api/sessions', { cache: 'no-store' });
  if (!res.ok) throw new ServiceError(res.status === 404 ? '找不到会话索引' : '本地服务出错（' + res.status + '）');
  const idx = (await res.json()) as SessionIndex;
  if (!isCompatible(idx.contract)) throw new ServiceError('本地服务的数据契约版本 ' + idx.contract + ' 和查看器不一致，请重新构建');
  indexCache = idx;
  return idx;
}

export async function loadSession(id: string): Promise<Session> {
  const doc = await getJson<SessionDoc>('/api/sessions/' + encodeURIComponent(id) + '?compact=1');
  return doc.session;
}

export const otelUrl = (id: string) => '/api/sessions/' + encodeURIComponent(id) + '/otel';

export function loadOverview(): Promise<Overview> {
  return getJson<Overview>('/api/overview');
}

export function loadStats(): Promise<StatsDoc> {
  return getJson<StatsDoc>('/api/stats');
}

/** Parse a dropped file in the page. Nothing is uploaded. */
export async function parseDropped(file: File): Promise<{ session: Session; summary: SessionSummary }> {
  const text = await file.text();
  const adapter = adapterForFile(file.name) || codexAdapter;
  const session = parseText(adapter, text, { path: file.name, size: file.size, mtimeMs: file.lastModified }, Date.now());
  return { session, summary: summarize(session) };
}
