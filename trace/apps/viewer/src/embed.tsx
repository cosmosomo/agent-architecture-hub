/**
 * The trace view as a part of another page (the observatory, docs/ARCHITECTURE.md). Built by
 * vite.embed.config.ts into one classic script that sets `window.HubTrace`, so a page without a
 * build step can load it, even from a file. Each part renders inside a shadow root: the page's CSS
 * and ours never meet. The tree and the details of the selected span go into two elements the host
 * gives, so the host decides the layout (the observatory: tree in the centre, details in the side
 * panel). Input is the contract only: a session and, optionally, one coarse-grained layer.
 */
import { filterSpansRecursively, flattenSpans } from '@evilmartians/agent-prism-data';
import type { AnnotationSet, Session } from '@hub-trace/contract';
import { StrictMode, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { CollapseAllButton } from './components/agent-prism/CollapseAllButton';
import { DetailsView } from './components/agent-prism/DetailsView/DetailsView';
import { ExpandAllButton } from './components/agent-prism/ExpandAllButton';
import { TreeView } from './components/agent-prism/TreeView';
import css from './embed.css?inline';
import { SESSION_SPAN_ID, expandedForDepth, parentsOf, segmentSpanId, toSpans, turnSpanId } from './toSpans.ts';

export const version = '1';

/** Span ids, so a host can point at a turn, a segment or a step without knowing how the tree names them. */
export const ids = {
  session: SESSION_SPAN_ID,
  turn: (turnId: string) => turnSpanId({ id: turnId }),
  segment: (segmentId: string) => segmentSpanId({ id: segmentId }),
  step: (stepId: string) => stepId,
};

export type EmbedProps = {
  session: Session;
  layer?: AnnotationSet | null;
  theme?: 'light' | 'dark';
  /** 1: the segments of every turn (decisions), 2: their steps. */
  depth?: number;
  /** Selected span id. The host keeps it, e.g. in its address bar; without one the first span is shown. */
  selected?: string | null;
  onSelect?: (spanId: string) => void;
};

export type EmbedTargets = { tree: HTMLElement; details?: HTMLElement | null };

/** A styled box inside the element's shadow root, created once per element. */
function box(host: HTMLElement): HTMLElement {
  const root = host.shadowRoot || host.attachShadow({ mode: 'open' });
  const old = root.querySelector<HTMLElement>(':scope > .hub-trace');
  if (old) return old;
  const style = document.createElement('style');
  style.textContent = css;
  const div = document.createElement('div');
  div.className = 'hub-trace';
  root.append(style, div);
  return div;
}

function isSystemContextSpan(s: { type: string; attributes?: readonly { key: string; value: { stringValue?: string } }[] }): boolean {
  if (s.type !== 'event') return false;
  const role = s.attributes?.find((a) => a.key === 'role')?.value?.stringValue;
  return role === 'developer' || role === 'context';
}

function pruneSpans(
  list: ReturnType<typeof toSpans>,
  hideSys: boolean,
  catFilter: 'all' | 'llm' | 'tool' | 'error',
): { spans: ReturnType<typeof toSpans>; sysCount: number } {
  let sysCount = 0;
  const walk = (items: ReturnType<typeof toSpans>): ReturnType<typeof toSpans> => {
    const out: ReturnType<typeof toSpans> = [];
    for (const item of items) {
      if (isSystemContextSpan(item)) {
        sysCount++;
        if (hideSys) continue;
      }
      const nextChildren = item.children?.length ? walk(item.children) : [];
      if (catFilter !== 'all' && item.type !== 'agent_invocation' && item.type !== 'chain_operation') {
        const matchSelf =
          (catFilter === 'llm' && item.type === 'llm_call') ||
          (catFilter === 'tool' && (item.type === 'tool_execution' || item.type === 'retrieval' || item.type === 'create_agent')) ||
          (catFilter === 'error' && item.status === 'error');
        if (!matchSelf && nextChildren.length === 0) continue;
      }
      out.push({ ...item, children: nextChildren });
    }
    return out;
  };
  return { spans: walk(list), sysCount };
}

function Embedded({ props, detailsBox }: { props: EmbedProps; detailsBox: HTMLElement | null }) {
  const { session, layer = null, depth = 1, selected = null, onSelect } = props;
  const rawSpans = useMemo(() => toSpans(session, layer), [session, layer]);
  const [hideSys, setHideSys] = useState(true);
  const [catFilter, setCatFilter] = useState<'all' | 'llm' | 'tool' | 'error'>('all');
  const { spans, sysCount } = useMemo(() => pruneSpans(rawSpans, hideSys, catFilter), [rawSpans, hideSys, catFilter]);
  const all = useMemo(() => flattenSpans(spans), [spans]);
  const parents = useMemo(() => parentsOf(spans), [spans]);
  const [expanded, setExpanded] = useState<string[]>(() => expandedForDepth(session, layer, depth));
  const [query, setQuery] = useState('');

  // Another run or another granularity starts from that granularity; single toggles last until then.
  useEffect(() => setExpanded(expandedForDepth(session, layer, depth)), [session.id, layer, depth]);
  // The selected span is always visible: open every span on its path.
  useEffect(() => {
    if (!selected || !parents.has(selected)) return;
    const path: string[] = [];
    for (let p = parents.get(selected); p; p = parents.get(p)) path.push(p);
    setExpanded((prev) => (path.every((id) => prev.includes(id)) ? prev : Array.from(new Set([...prev, ...path]))));
  }, [selected, parents]);

  const q = query.trim();
  const shown = useMemo(() => (q ? filterSpansRecursively(spans, q) : spans), [spans, q]);
  const allRaw = useMemo(() => flattenSpans(rawSpans), [rawSpans]);
  const current = allRaw.find((x) => x.id === selected) || all.find((x) => x.id === selected) || spans[0];
  const details = current ? (
    <DetailsView key={session.id} className="h-full rounded-none border-0" data={current} allSpans={rawSpans} />
  ) : (
    <div className="text-agentprism-secondary-foreground p-4 text-sm">选中树里的一项，这里显示输入输出、思考和属性。</div>
  );

  return (
    <>
      <div className="border-agentprism-border/70 bg-agentprism-secondary/35 flex shrink-0 flex-wrap items-center gap-2 border-b px-3.5 py-2">
        <input
          className="border-agentprism-border bg-agentprism-background/80 placeholder:text-agentprism-secondary-foreground min-w-[140px] flex-1 rounded-lg border px-2.5 py-1 text-xs outline-none transition-colors focus:border-agentprism-brand"
          placeholder="搜索步骤、命令、文件或思考…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="hi-segment">
          {([
            ['all', '全部'],
            ['llm', '⚡ 模型'],
            ['tool', '🔧 工具'],
            ['error', '✕ 报错'],
          ] as const).map(([k, lbl]) => (
            <button
              key={k}
              type="button"
              className={'hi-navbtn !h-6 !px-2 !text-[11px]' + (catFilter === k ? ' on' : '')}
              onClick={() => setCatFilter(k)}
            >
              {lbl}
            </button>
          ))}
        </div>
        {sysCount > 0 && (
          <button
            type="button"
            className={'hi-navbtn !h-6 !px-2 !text-[11px] border ' + (hideSys ? 'border-agentprism-border text-agentprism-secondary-foreground' : 'on')}
            onClick={() => setHideSys(!hideSys)}
            title="折叠或展开 <app-context> / AGENTS.md 等系统级注入上下文"
          >
            {hideSys ? `📎 已折叠 ${sysCount} 条系统注入` : `📎 隐藏系统注入 (${sysCount})`}
          </button>
        )}
        <ExpandAllButton onExpandAll={() => setExpanded(all.map((x) => x.id))} title="全部展开" />
        <CollapseAllButton onCollapseAll={() => setExpanded([])} title="全部收起" />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto pb-6 pt-1">
        {q && shown.length === 0 ? (
          <div className="text-agentprism-secondary-foreground px-4 py-3 text-xs">没有匹配「{q}」的结果</div>
        ) : (
          <TreeView
            spans={shown}
            expandedSpansIds={q || catFilter !== 'all' ? all.map((x) => x.id) : expanded}
            onExpandSpansIdsChange={(ids) => setExpanded([...ids])}
            onSpanSelect={(x) => onSelect?.(x.id)}
            selectedSpan={current}
          />
        )}
      </div>
      {detailsBox ? createPortal(details, detailsBox) : <div className="border-agentprism-border h-1/2 min-h-0 shrink-0 border-t">{details}</div>}
    </>
  );
}

/** Draws the trace into the host's elements. Call `update` with changed props; `unmount` clears both elements. */
export function mount(targets: EmbedTargets, initial: EmbedProps) {
  const treeBox = box(targets.tree);
  const detailsBox = targets.details ? box(targets.details) : null;
  const root = createRoot(treeBox);
  let props = initial;
  const render = () => {
    const theme = props.theme || 'dark';
    treeBox.dataset.theme = theme;
    if (detailsBox) detailsBox.dataset.theme = theme;
    root.render(
      <StrictMode>
        <Embedded props={props} detailsBox={detailsBox} />
      </StrictMode>,
    );
  };
  render();
  return {
    update(next: Partial<EmbedProps>) {
      props = { ...props, ...next };
      render();
    },
    unmount() {
      root.unmount();
      treeBox.replaceChildren();
      detailsBox?.replaceChildren();
    },
  };
}
