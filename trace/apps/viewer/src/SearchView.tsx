/**
 * The retrieval layer: search every step of every session, filter by kind, see where
 * errors pile up, click a hit to open that step in the trace tree. Opened from the
 * viewer's own bar, or by another page that links here with a query already set
 * (e.g. the observatory's session list). The query lives in the address bar.
 */
import type { SearchHit, SearchRequest, SearchResult } from '@hub-trace/contract';
import cn from 'classnames';
import { X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ago, basename, cut, when } from './format.ts';
import { pieces } from './hits.ts';
import { runSearch } from './search-data.ts';

const PAGE = 50;

const KIND_LABEL: Record<string, string> = { model: '模型', messages: '消息' };
const SUB_LABEL: Record<string, string> = {
  user: '用户',
  agent: '智能体',
  developer: '开发者',
  context: '注入的上下文',
  shell: '命令',
  patch: '改文件',
  mcp: 'MCP',
  web: '搜索',
  agent_tool: '智能体',
  plan: '计划',
  image: '图片',
  other: '其他',
  compaction: '压缩',
  aborted: '被打断',
  error: '出错',
  goal: '目标',
  subagent: '子智能体',
  note: '备注',
};

/** 'tool:shell' -> '命令'; 'message:user' -> '用户'; 'model' -> '模型'. */
export function facetLabel(facet: string): string {
  const i = facet.indexOf(':');
  if (i < 0) return KIND_LABEL[facet] || facet;
  const sub = facet.slice(i + 1);
  const label = SUB_LABEL[sub] || sub;
  return facet.startsWith('tool:') ? '工具 · ' + label : facet.startsWith('event:') ? '事件 · ' + label : label;
}

type Props = {
  query: SearchRequest;
  onChange: (q: SearchRequest) => void;
  /** Open one hit in the trace tree. */
  onOpen: (hit: SearchHit) => void;
  /** Titles for the sessions in the hits; the session list already has them. */
  titles: Map<string, { title: string; cwd?: string | undefined; role: string }>;
  onClose: () => void;
};

export function SearchView({ query, onChange, onOpen, titles, onClose }: Props) {
  const [text, setText] = useState(query.q || '');
  const [result, setResult] = useState<SearchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [limit, setLimit] = useState(PAGE);
  const started = useRef(0);

  useEffect(() => setText(query.q || ''), [query.q]);

  // One request per settled query: typing waits a moment, changing a chip does not.
  const key = useMemo(() => JSON.stringify({ ...query, q: undefined }), [query]);
  useEffect(() => {
    started.current = Date.now();
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setBusy(true);
      try {
        const r = await runSearch({ ...query, limit }, ctrl.signal);
        setResult(r);
        setError(null);
      } catch (e) {
        if (!ctrl.signal.aborted) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!ctrl.signal.aborted) setBusy(false);
      }
    }, query.q ? 220 : 0);
    return () => { clearTimeout(t); ctrl.abort(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, query.q, limit]);

  const kinds = result ? Object.entries(result.facets.kinds).sort((a, b) => b[1] - a[1]) : [];
  const toggleKind = (k: string) => {
    const on = query.kinds || [];
    const next = on.includes(k) ? on.filter((x) => x !== k) : on.concat(k);
    onChange({ ...query, ...(next.length ? { kinds: next } : { kinds: undefined }) });
    setLimit(PAGE);
  };
  const group = (prefix: string) => kinds.filter(([k]) => k === prefix || k.startsWith(prefix + ':'));
  const named = (prefix: string) => group(prefix).filter(([k]) => k.includes(':'));

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-agentprism-border shrink-0 space-y-2 border-b p-3">
        <div className="flex items-center gap-2">
          <input
            autoFocus
            className="border-agentprism-border bg-agentprism-muted text-agentprism-foreground placeholder:text-agentprism-secondary-foreground min-w-0 flex-1 rounded border px-2 py-1.5 text-sm outline-none focus:border-agentprism-brand"
            placeholder="在全部会话的每一步里找：命令、文件、错误、说的话"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onChange({ ...query, q: text.trim() || undefined });
              if (e.key === 'Escape') onClose();
            }}
          />
          <button className="border-agentprism-border text-agentprism-muted-foreground hover:text-agentprism-foreground rounded border px-2 py-1 text-xs" onClick={() => onChange({ ...query, q: text.trim() || undefined })}>
            找
          </button>
          <button className="text-agentprism-muted-foreground hover:text-agentprism-foreground" onClick={onClose} title="回到会话">
            <X className="size-4" />
          </button>
        </div>

        {result && (
          <>
            <div className="flex flex-wrap items-center gap-1">
              <Chip active={!query.kinds?.length && !query.errors} onClick={() => { onChange({ ...query, kinds: undefined, errors: undefined }); setLimit(PAGE); }} label={'全部 ' + result.facets.all} />
              {named('message').length > 0 && <span className="text-agentprism-secondary-foreground pl-1 text-xs">消息</span>}
              {named('message').map(([k, n]) => <Chip key={k} active={query.kinds?.includes(k) || false} onClick={() => toggleKind(k)} label={facetLabel(k) + ' ' + n} />)}
              {group('model').length > 0 && <Chip active={query.kinds?.includes('model') || false} onClick={() => toggleKind('model')} label={'模型 ' + group('model')[0][1]} />}
              {group('tool').length > 0 && <span className="text-agentprism-secondary-foreground pl-1 text-xs">工具</span>}
              {named('tool').map(([k, n]) => <Chip key={k} active={query.kinds?.includes(k) || false} onClick={() => toggleKind(k)} label={facetLabel(k) + ' ' + n} />)}
              {named('event').length > 0 && <span className="text-agentprism-secondary-foreground pl-1 text-xs">事件</span>}
              {named('event').map(([k, n]) => <Chip key={k} active={query.kinds?.includes(k) || false} onClick={() => toggleKind(k)} label={facetLabel(k) + ' ' + n} />)}
              {result.facets.errors > 0 && <Chip active={query.errors || false} onClick={() => { onChange({ ...query, errors: query.errors ? undefined : true }); setLimit(PAGE); }} label={'出错 ' + result.facets.errors} tone="error" />}
            </div>
            <div className="text-agentprism-secondary-foreground flex flex-wrap items-center gap-3 text-xs">
              <span>{result.total} 条，涉及 {result.facets.sessions} 个会话{result.indexing.running ? ' · 索引还在建：' + result.indexing.done + '/' + result.indexing.total : ''} · {result.ms} 毫秒</span>
              {result.facets.cwd.length > 1 && (
                <span className="flex items-center gap-1">
                  目录
                  {result.facets.cwd.slice(0, 4).map((c) => (
                    <button
                      key={c.cwd}
                      className={cn('rounded border px-1', query.cwd === c.cwd ? 'border-agentprism-brand text-agentprism-foreground' : 'border-agentprism-border hover:border-agentprism-border-strong')}
                      onClick={() => onChange({ ...query, cwd: query.cwd === c.cwd ? undefined : c.cwd })}
                      title={c.cwd}
                    >
                      {basename(c.cwd) || c.cwd} {c.n}
                    </button>
                  ))}
                </span>
              )}
            </div>
          </>
        )}
        {error && <div className="text-agentprism-error text-xs">{error}</div>}
      </div>

      <div className={cn('min-h-0 flex-1 overflow-y-auto', busy && 'opacity-60')}>
        {result?.hits.map((h) => <HitRow key={h.session + '/' + h.turn + '/' + h.step} hit={h} info={titles.get(h.session)} onOpen={onOpen} />)}
        {result && result.hits.length === 0 && !error && (
          <div className="text-agentprism-secondary-foreground p-4 text-sm">
            {query.q || query.kinds?.length || query.errors ? '没有符合条件的步骤。' : '输入词开始找；不填词就按下面的筛选看全部步骤。'}
          </div>
        )}
        {result && result.total > result.hits.length && (
          <button className="text-agentprism-brand w-full py-3 text-sm hover:underline" onClick={() => setLimit(limit + PAGE)}>
            再看 {Math.min(PAGE, result.total - result.hits.length)} 条（共 {result.total}）
          </button>
        )}
      </div>
    </div>
  );
}

function Chip({ active, onClick, label, tone }: { active: boolean; onClick: () => void; label: string; tone?: 'error' }) {
  return (
    <button
      className={cn(
        'rounded border px-1.5 py-0.5 text-xs',
        active ? 'border-agentprism-brand bg-agentprism-secondary text-agentprism-foreground' : 'border-agentprism-border text-agentprism-muted-foreground hover:border-agentprism-border-strong',
        tone === 'error' && (active ? 'border-agentprism-error text-agentprism-error' : 'text-agentprism-error/80'),
      )}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function HitRow({ hit, info, onOpen }: { hit: SearchHit; info?: { title: string; cwd?: string | undefined; role: string } | undefined; onOpen: (h: SearchHit) => void }) {
  const when_ = hit.at ? when(hit.at) : '';
  return (
    <button className="border-agentprism-border-subtle hover:bg-agentprism-muted flex w-full cursor-pointer flex-col gap-1 border-b border-l-2 border-l-transparent py-2 pr-3 pl-3 text-left" onClick={() => onOpen(hit)} title={'第 ' + hit.turn + ' 轮 · ' + when_}>
      <div className="flex items-baseline gap-2">
        <span className="text-agentprism-muted-foreground shrink-0 rounded border border-agentprism-border px-1 text-xs">{facetLabel(hit.kind + (hit.sub ? ':' + hit.sub : ''))}</span>
        {hit.name && <span className="text-agentprism-secondary-foreground shrink-0 text-xs">{cut(hit.name, 24)}</span>}
        {hit.status === 'error' && <span className="text-agentprism-error shrink-0 text-xs">出错</span>}
        <span className="text-agentprism-secondary-foreground min-w-0 flex-1 truncate text-xs">{cut(info?.title || hit.session, 70)} · 第 {hit.turn} 轮</span>
        <span className="text-agentprism-secondary-foreground shrink-0 text-xs">{hit.at ? ago(hit.at) : ''}</span>
      </div>
      <div className="text-agentprism-foreground line-clamp-2 text-xs leading-relaxed">
        {pieces(hit.snippet).map((p, i) => (p.hit ? <mark key={i} className="bg-agentprism-brand/30 text-agentprism-foreground rounded-sm">{p.text}</mark> : <span key={i}>{p.text}</span>))}
      </div>
    </button>
  );
}
