/**
 * Where step search comes from: the local service's /api/search. The viewer and the
 * observatory both go through here, so the request shape has one home.
 */
import type { SearchRequest, SearchResult } from '@hub-trace/contract';

export { MARK_CLOSE, MARK_OPEN } from './hits.ts';

export function toParams(q: SearchRequest): URLSearchParams {
  const p = new URLSearchParams();
  if (q.q) p.set('q', q.q);
  if (q.kinds?.length) p.set('kind', q.kinds.join(','));
  if (q.errors) p.set('errors', '1');
  if (q.sessions?.length) p.set('session', q.sessions.join(','));
  if (q.cwd) p.set('cwd', q.cwd);
  if (q.role) p.set('role', q.role);
  if (q.since) p.set('since', q.since);
  if (q.until) p.set('until', q.until);
  if (q.limit !== undefined) p.set('limit', String(q.limit));
  if (q.offset) p.set('offset', String(q.offset));
  return p;
}

export function fromParams(p: URLSearchParams): SearchRequest {
  const list = (k: string) => p.get(k)?.split(',').map((x) => x.trim()).filter(Boolean);
  const role = p.get('role');
  return {
    ...(p.get('q') ? { q: p.get('q')! } : {}),
    ...(list('kind') ? { kinds: list('kind')! } : {}),
    ...(p.get('errors') === '1' ? { errors: true } : {}),
    ...(list('session') ? { sessions: list('session')! } : {}),
    ...(p.get('cwd') ? { cwd: p.get('cwd')! } : {}),
    ...(role === 'main' || role === 'subagent' ? { role } : {}),
    ...(p.get('since') ? { since: p.get('since')! } : {}),
    ...(p.get('until') ? { until: p.get('until')! } : {}),
  };
}

export async function runSearch(q: SearchRequest, signal?: AbortSignal): Promise<SearchResult> {
  const res = await fetch('/api/search?' + toParams(q), { cache: 'no-store', ...(signal ? { signal } : {}) });
  if (!res.ok) throw new Error(res.status === 404 ? '本地服务没有开启检索' : '检索出错（' + res.status + '）');
  return (await res.json()) as SearchResult;
}
