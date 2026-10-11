import { filterSpansRecursively, flattenSpans } from '@evilmartians/agent-prism-data';
import type { TraceSpan } from '@evilmartians/agent-prism-types';
import type { SearchHit, SearchRequest, Session, SessionSummary } from '@hub-trace/contract';
import { FolderOpen, BarChart3, Moon, Search, Sun } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { CollapseAllButton } from './components/agent-prism/CollapseAllButton';
import { DetailsView } from './components/agent-prism/DetailsView/DetailsView';
import { ExpandAllButton } from './components/agent-prism/ExpandAllButton';
import { TreeView } from './components/agent-prism/TreeView';
import { ServiceError, loadIndex, loadSession, otelUrl, parseDropped } from './data.ts';
import { AnalyticsView } from './AnalyticsView.tsx';
import { cut, KIND_LABEL } from './format.ts';
import { SessionHeader } from './SessionHeader.tsx';
import { SourcesView } from './SourcesView.tsx';
import { fromParams } from './search-data.ts';
import { SearchView } from './SearchView.tsx';
import { SessionList } from './SessionList.tsx';
import { initialExpanded, parentsOf, toSpans } from './toSpans.ts';

const POLL_MS = 8000;

function readHash(): { s: string | null; n: string | null; search: SearchRequest | null; sources: boolean; analytics: boolean } {
  const p = new URLSearchParams(location.hash.slice(1));
  const search = p.get('view') === 'search' ? fromParams(p) : null;
  return { s: p.get('s'), n: p.get('n'), search, sources: p.get('view') === 'sources', analytics: p.get('view') === 'analytics' };
}
function writeHash(s: string | null, n: string | null, search: SearchRequest | null, sources: boolean, analytics: boolean) {
  const p = new URLSearchParams();
  if (sources) p.set('view', 'sources');
  else if (analytics) p.set('view', 'analytics');
  else if (search) {
    p.set('view', 'search');
    for (const [k, v] of fromSearch(search)) p.set(k, v);
  }
  if (s) p.set('s', s);
  if (n) p.set('n', n);
  const h = p.toString();
  if (h !== location.hash.slice(1)) history.replaceState(null, '', h ? '#' + h : location.pathname + location.search);
}

/** The search request as hash parameters, minus the ones that are not part of it. */
function fromSearch(q: SearchRequest): [string, string][] {
  const out: [string, string][] = [];
  if (q.q) out.push(['q', q.q]);
  if (q.kinds?.length) out.push(['kind', q.kinds.join(',')]);
  if (q.errors) out.push(['errors', '1']);
  if (q.sessions?.length) out.push(['session', q.sessions.join(',')]);
  if (q.cwd) out.push(['cwd', q.cwd]);
  if (q.role) out.push(['role', q.role]);
  if (q.since) out.push(['since', q.since]);
  if (q.until) out.push(['until', q.until]);
  return out;
}

export function App() {
  const [index, setIndex] = useState<SessionSummary[]>([]);
  const [indexError, setIndexError] = useState<string | null>(null);
  const [loadedIndex, setLoadedIndex] = useState(false);
  const [local, setLocal] = useState<Map<string, Session>>(new Map());
  const [selectedId, setSelectedId] = useState<string | null>(() => readHash().s);
  const [session, setSession] = useState<Session | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [spanId, setSpanId] = useState<string | null>(() => readHash().n);
  const [expanded, setExpanded] = useState<string[]>([]);
  const [treeQuery, setTreeQuery] = useState('');
  const [dragging, setDragging] = useState(false);
  const [theme, setTheme] = useState(() => document.documentElement.getAttribute('data-theme') || 'dark');
  const [search, setSearch] = useState<SearchRequest | null>(() => readHash().search);
  const [sources, setSources] = useState(() => readHash().sources);
  const [analytics, setAnalytics] = useState(() => readHash().analytics);
  const loadedKey = useRef<string>('');

  const known = useMemo(() => {
    const m = new Map(index.map((s) => [s.id, s]));
    for (const [id, s] of local) m.set(id, s);
    return m;
  }, [index, local]);

  // Index: first load, then poll while the tab is visible so live sessions update.
  useEffect(() => {
    let stop = false;
    const tick = async () => {
      if (document.hidden) return;
      try {
        const idx = await loadIndex();
        if (!stop) { setIndex(idx.sessions); setIndexError(null); }
      } catch (e) {
        if (!stop) setIndexError(e instanceof ServiceError ? e.message : String(e));
      } finally {
        if (!stop) setLoadedIndex(true);
      }
    };
    tick();
    const t = setInterval(tick, POLL_MS);
    const onVis = () => { if (!document.hidden) tick(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { stop = true; clearInterval(t); document.removeEventListener('visibilitychange', onVis); };
  }, []);

  // Session: load on selection, reload when its summary says the source changed.
  const summary = selectedId ? known.get(selectedId) : undefined;
  const version = summary ? (summary.updatedAt || '') + '|' + (summary.source.size || 0) : '';
  useEffect(() => {
    if (!selectedId) { setSession(null); return; }
    const key = selectedId + '|' + version;
    if (loadedKey.current === key) return;
    const fresh = !loadedKey.current.startsWith(selectedId + '|');
    loadedKey.current = key;
    const localSession = local.get(selectedId);
    if (localSession) { setSession(localSession); setSessionError(null); if (fresh) setExpanded(initialExpanded(localSession)); return; }
    let stop = false;
    loadSession(selectedId)
      .then((s) => { if (stop) return; setSession(s); setSessionError(null); if (fresh) setExpanded(initialExpanded(s)); })
      .catch((e) => { if (!stop) { setSessionError(e instanceof Error ? e.message : String(e)); loadedKey.current = ''; } });
    return () => { stop = true; };
  }, [selectedId, version, local]);

  const spans = useMemo(() => (session ? toSpans(session) : []), [session]);
  const allSpans = useMemo(() => flattenSpans(spans), [spans]);
  const shown = useMemo(() => (treeQuery.trim() ? filterSpansRecursively(spans, treeQuery.trim()) : spans), [spans, treeQuery]);
  const selectedSpan = useMemo(() => allSpans.find((x) => x.id === spanId) || spans[0], [allSpans, spanId, spans]);
  const parents = useMemo(() => parentsOf(spans), [spans]);

  // A selected span is always visible: open every span on its path.
  useEffect(() => {
    if (!spanId || !parents.has(spanId)) return;
    const path: string[] = [];
    for (let p = parents.get(spanId); p; p = parents.get(p)) path.push(p);
    setExpanded((prev) => (path.every((id) => prev.includes(id)) ? prev : Array.from(new Set([...prev, ...path]))));
  }, [spanId, parents]);

  useEffect(() => { writeHash(selectedId, spanId, search, sources, analytics); }, [selectedId, spanId, search, sources, analytics]);
  useEffect(() => {
    const onHash = () => { const h = readHash(); setSelectedId(h.s); setSpanId(h.n); setSearch(h.search); setSources(h.sources); setAnalytics(h.analytics); };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const open = useCallback((id: string) => { setSelectedId(id); setSpanId(null); setTreeQuery(''); }, []);

  const openHit = useCallback((h: SearchHit) => {
    setSearch(null);
    setSelectedId(h.session);
    setSpanId(h.step);
    setTreeQuery('');
  }, []);

  const toggleTheme = () => {
    const next = theme === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem('hub-trace-theme', next); } catch { /* private mode */ }
    setTheme(next);
  };

  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const files = Array.from(e.dataTransfer.files).filter((f) => /\.jsonl$/i.test(f.name));
    let last: string | null = null;
    for (const f of files) {
      try {
        const { session: s } = await parseDropped(f);
        setLocal((prev) => new Map(prev).set(s.id, s));
        last = s.id;
      } catch (err) {
        setSessionError('解析 ' + f.name + ' 失败：' + (err instanceof Error ? err.message : String(err)));
      }
    }
    if (last) open(last);
  };

  const kindNames = useMemo(() => {
    const seen = new Set<string>();
    for (const s of index) seen.add(s.source.kind);
    return Array.from(seen).map((k) => KIND_LABEL[k] || k);
  }, [index]);

  const titles = useMemo(() => {
    const m = new Map<string, { title: string; cwd?: string | undefined; role: string }>();
    for (const [id, s] of known) m.set(id, { title: s.title, cwd: s.cwd, role: s.agent.role });
    return m;
  }, [known]);

  const childActions = (span: TraceSpan) => {
    const raw = span.raw[0];
    if (!raw || !session) return null;
    let agents: string[] = [];
    try {
      const step = JSON.parse(raw);
      if (Array.isArray(step.agents)) agents = step.agents;
      else if (step.kind === 'subagent' && typeof step.ref === 'string') agents = [step.ref];
      else if (step.kind === 'event' && typeof step.ref === 'string') agents = [step.ref];
    } catch { return null; }
    const ids = agents.filter((a) => known.has(a));
    if (!ids.length) return null;
    return (
      <div className="flex flex-wrap gap-1">
        {ids.map((id) => (
          <button key={id} className="border-agentprism-border text-agentprism-muted-foreground hover:border-agentprism-brand rounded border px-1.5 py-0.5 text-xs" onClick={() => open(id)}>
            打开 {cut(known.get(id)?.agent.path || known.get(id)?.title, 24)}
          </button>
        ))}
      </div>
    );
  };

  return (
    <div
      className="bg-agentprism-background text-agentprism-foreground flex h-screen flex-col font-sans"
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={(e) => { if (e.currentTarget === e.target) setDragging(false); }}
      onDrop={onDrop}
    >
      <header className="border-agentprism-border flex h-11 shrink-0 items-center gap-3 border-b px-4">
        <span className="text-sm font-semibold">Trace 查看器</span>
        <span className="text-agentprism-secondary-foreground text-xs">{'本机会话 ' + index.length + ' 个' + (kindNames.length ? ' · ' + kindNames.join(' + ') : '')}</span>
        <span className="flex-1" />
        <button
          className={'hi-navbtn' + (sources ? ' on' : '')}
          onClick={() => { setSources(!sources); setAnalytics(false); }}
          title="哪些 CLI 有会话、各在哪些项目里干活"
        >
          <span className="flex items-center gap-1"><FolderOpen className="size-3.5" />来源</span>
        </button>
        <button
          className={'hi-navbtn' + (analytics ? ' on' : '')}
          onClick={() => { setAnalytics(!analytics); setSources(false); }}
          title="全部会话的折页：日活跃、工具、模型、项目"
        >
          <span className="flex items-center gap-1"><BarChart3 className="size-3.5" />统计</span>
        </button>
        <button
          className={'hi-navbtn' + (search ? ' on' : '')}
          onClick={() => setSearch(search ? null : {})}
          title="在全部会话的每一步里找：命令、文件、错误、说的话"
        >
          <span className="flex items-center gap-1"><Search className="size-3.5" />检索</span>
        </button>
        <a className="text-agentprism-muted-foreground hover:text-agentprism-foreground text-xs" href="/" title="同一个本地服务上的观察台">观察台</a>
        <button className="text-agentprism-muted-foreground hover:text-agentprism-foreground" onClick={toggleTheme} title={theme === 'light' ? '换成深色' : '换成浅色'}>
          {theme === 'light' ? <Moon className="size-4" /> : <Sun className="size-4" />}
        </button>
      </header>

      {sources ? (
        <SourcesView onClose={() => setSources(false)} />
      ) : analytics ? (
        <AnalyticsView sessions={index} onClose={() => setAnalytics(false)} />
      ) : (
      <PanelGroup direction="horizontal" autoSaveId="hub-trace-layout" className="min-h-0 flex-1">
        <Panel defaultSize={24} minSize={16} className="border-agentprism-border border-r">
          {search ? (
            <SearchView query={search} onChange={setSearch} onOpen={openHit} titles={titles} onClose={() => setSearch(null)} />
          ) : indexError && !index.length ? (
            <div className="text-agentprism-muted-foreground space-y-2 p-4 text-sm">
              <p>{indexError}。</p>
              <p>在 trace 目录运行 <code className="bg-agentprism-secondary rounded px-1">npm run serve</code>，再打开 http://127.0.0.1:8790/trace/。</p>
              <p>也可以把会话文件（.jsonl）拖进这个页面直接看，文件只在本页解析，不上传。</p>
            </div>
          ) : !loadedIndex ? (
            <div className="text-agentprism-secondary-foreground p-4 text-sm">读取会话列表…</div>
          ) : (
            <SessionList sessions={index} local={Array.from(local.values())} selectedId={selectedId} onSelect={open} />
          )}
        </Panel>
        <PanelResizeHandle className="hover:bg-agentprism-brand w-1 transition-colors" />
        <Panel defaultSize={44} minSize={25}>
          {search ? (
            <div className="text-agentprism-secondary-foreground p-6 text-sm">
              左边每一条都能打开到它所在的步骤：树会展开到那一轮，右边显示这一步的输入输出、思考和属性。
            </div>
          ) : session && session.id === selectedId ? (
            <div className="flex h-full min-h-0 flex-col">
              <SessionHeader session={session} known={known} onOpen={open} />
              <div className="flex shrink-0 items-center gap-2 px-4 py-2">
                <input
                  className="border-agentprism-border bg-agentprism-muted placeholder:text-agentprism-secondary-foreground min-w-0 flex-1 rounded border px-2 py-1 text-xs outline-none focus:border-agentprism-brand"
                  placeholder="在这个会话里搜索"
                  value={treeQuery}
                  onChange={(e) => setTreeQuery(e.target.value)}
                />
                <ExpandAllButton onExpandAll={() => setExpanded(allSpans.map((x) => x.id))} title="全部展开" />
                <CollapseAllButton onCollapseAll={() => setExpanded([])} title="全部收起" />
                {!local.has(session.id) && (
                  <a className="text-agentprism-muted-foreground hover:text-agentprism-foreground text-xs" href={otelUrl(session.id)} download={session.sourceId + '.otel.json'} title="下载 OpenTelemetry 格式，可导入其他追踪工具">导出 OTel</a>
                )}
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto pb-6">
                <TreeView
                  spans={shown}
                  expandedSpansIds={treeQuery.trim() ? allSpans.map((x) => x.id) : expanded}
                  onExpandSpansIdsChange={(ids) => setExpanded([...ids])}
                  onSpanSelect={(x) => setSpanId(x.id)}
                  selectedSpan={selectedSpan}
                />
              </div>
            </div>
          ) : (
            <div className="text-agentprism-secondary-foreground p-6 text-sm">
              {sessionError || (selectedId ? '读取会话…' : '在左边选一个会话。')}
            </div>
          )}
        </Panel>
        <PanelResizeHandle className="hover:bg-agentprism-brand w-1 transition-colors" />
        <Panel defaultSize={32} minSize={20}>
          {search ? (
            <div className="text-agentprism-secondary-foreground p-6 text-sm">
              筛选说明：类型和“出错”只留下要看的步骤，上面的次数是这个词在这些会话里各有多少步（不受类型筛选影响）。点目录能只看那个工作目录的会话。
            </div>
          ) : session && selectedSpan ? (
            <DetailsView key={session.id} className="h-full rounded-none border-0" data={selectedSpan} allSpans={spans} headerActions={(d) => childActions(d as TraceSpan)} />
          ) : (
            <div className="text-agentprism-secondary-foreground p-6 text-sm">选中树里的一项，这里显示输入输出、思考和属性。</div>
          )}
        </Panel>
      </PanelGroup>
      )}

      {dragging && (
        <div className="bg-agentprism-background/80 border-agentprism-brand pointer-events-none fixed inset-3 flex items-center justify-center rounded border-2 border-dashed text-sm">
          松开即可在本页解析会话文件，不会上传
        </div>
      )}
    </div>
  );
}
