import type { SessionStatus, SessionSummary } from '@hub-trace/contract';
import cn from 'classnames';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useMemo, useState } from 'react';
import { KIND_LABEL, STATUS_DOT, STATUS_LABEL, STATUS_ORDER, ago, basename, cut, usd } from './format.ts';

type Props = {
  sessions: SessionSummary[];
  /** Sessions parsed from dropped files; shown first. */
  local: SessionSummary[];
  selectedId: string | null;
  onSelect: (id: string) => void;
};

const PAGE = 150;

function matches(s: SessionSummary, q: string): boolean {
  if (!q) return true;
  const hay = (s.title + ' ' + (s.cwd || '') + ' ' + s.id + ' ' + (s.agent.product || '') + ' ' + (s.agent.path || '') + ' ' + (s.agent.model || '')).toLowerCase();
  return q.split(/\s+/).every((w) => hay.includes(w));
}

export function SessionList({ sessions, local, selectedId, onSelect }: Props) {
  const [query, setQuery] = useState('');
  const [state, setState] = useState<SessionStatus | 'all'>('all');
  const [kind, setKind] = useState<string>('all');
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [limit, setLimit] = useState(PAGE);

  const { tops, kids, counts, kinds } = useMemo(() => {
    const byId = new Map(sessions.map((s) => [s.id, s]));
    const kids = new Map<string, SessionSummary[]>();
    const tops: SessionSummary[] = [];
    for (const s of sessions) {
      const parent = s.links.find((l) => l.rel === 'parent' && byId.has(l.id));
      if (parent) kids.set(parent.id, (kids.get(parent.id) || []).concat(s));
      else tops.push(s);
    }
    const counts = new Map<SessionStatus, number>();
    for (const s of sessions) counts.set(s.state.status, (counts.get(s.state.status) || 0) + 1);
    const kinds = new Map<string, number>();
    for (const s of sessions) kinds.set(s.source.kind, (kinds.get(s.source.kind) || 0) + 1);
    return { tops, kids, counts, kinds };
  }, [sessions]);

  const q = query.trim().toLowerCase();
  const filtering = Boolean(q) || state !== 'all' || kind !== 'all';
  const ok = (s: SessionSummary) => (state === 'all' || s.state.status === state) && (kind === 'all' || s.source.kind === kind) && matches(s, q);

  // A parent stays visible when one of its sub-agents matches; the selected session's parent opens itself.
  const parentOfSelected = selectedId ? sessions.find((s) => s.id === selectedId)?.links.find((l) => l.rel === 'parent')?.id : undefined;
  const rows: { s: SessionSummary; depth: number; childCount: number; dim?: boolean }[] = [];
  for (const s of tops) {
    const children = kids.get(s.id) || [];
    const hitKids = filtering ? children.filter(ok) : children;
    const selfOk = ok(s);
    if (!selfOk && !hitKids.length) continue;
    rows.push({ s, depth: 0, childCount: children.length, dim: !selfOk });
    if (filtering ? hitKids.length > 0 : open.has(s.id) || parentOfSelected === s.id) {
      for (const c of hitKids) rows.push({ s: c, depth: 1, childCount: 0 });
    }
  }
  const visible = rows.slice(0, limit);
  const toggle = (id: string) => setOpen((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-agentprism-border shrink-0 space-y-2 border-b p-3">
        <input
          className="border-agentprism-border bg-agentprism-muted text-agentprism-foreground placeholder:text-agentprism-secondary-foreground w-full rounded border px-2 py-1.5 text-sm outline-none focus:border-agentprism-brand"
          placeholder="搜索标题、目录、模型、编号"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setLimit(PAGE); }}
        />
        {kinds.size > 1 && (
          <div className="flex flex-wrap gap-1">
            <Chip active={kind === 'all'} onClick={() => setKind('all')} label={'全部来源 ' + sessions.length} />
            {Array.from(kinds).map(([k, n]) => (
              <Chip key={k} active={kind === k} onClick={() => { setKind(kind === k ? 'all' : k); setLimit(PAGE); }} label={(KIND_LABEL[k] || k) + ' ' + n} />
            ))}
          </div>
        )}
        <div className="flex flex-wrap gap-1">
          <Chip active={state === 'all'} onClick={() => setState('all')} label={'全部 ' + sessions.length} />
          {STATUS_ORDER.filter((k) => counts.get(k)).map((k) => (
            <Chip key={k} active={state === k} onClick={() => { setState(state === k ? 'all' : k); setLimit(PAGE); }} label={STATUS_LABEL[k] + ' ' + counts.get(k)} dot={STATUS_DOT[k]} />
          ))}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {local.length > 0 && (
          <div className="border-agentprism-border border-b">
            <div className="text-agentprism-secondary-foreground px-3 pt-2 text-xs">拖进来的文件（只在本页，不上传）</div>
            {local.map((s) => <Row key={s.id} s={s} depth={0} childCount={0} selected={s.id === selectedId} onSelect={onSelect} />)}
          </div>
        )}
        {visible.map((r) => (
          <Row key={r.s.id} s={r.s} depth={r.depth} childCount={r.childCount} dim={r.dim} selected={r.s.id === selectedId} onSelect={onSelect} expanded={filtering || open.has(r.s.id) || parentOfSelected === r.s.id} onToggle={r.childCount ? () => toggle(r.s.id) : undefined} />
        ))}
        {rows.length > limit && (
          <button className="text-agentprism-brand w-full py-3 text-sm hover:underline" onClick={() => setLimit(limit + PAGE)}>
            再显示 {Math.min(PAGE, rows.length - limit)} 条（共 {rows.length}）
          </button>
        )}
        {!rows.length && !local.length && <div className="text-agentprism-secondary-foreground p-4 text-sm">没有符合条件的会话。</div>}
      </div>
    </div>
  );
}

function Chip({ active, onClick, label, dot }: { active: boolean; onClick: () => void; label: string; dot?: string }) {
  return (
    <button
      className={cn('flex items-center gap-1 rounded border px-1.5 py-0.5 text-xs', active ? 'border-agentprism-brand text-agentprism-foreground bg-agentprism-secondary' : 'border-agentprism-border text-agentprism-muted-foreground hover:border-agentprism-border-strong')}
      onClick={onClick}
    >
      {dot && <span className={cn('inline-block size-1.5 rounded-full', dot)} />}
      {label}
    </button>
  );
}

function Row({ s, depth, childCount, dim, selected, onSelect, expanded, onToggle }: { s: SessionSummary; depth: number; childCount: number; dim?: boolean | undefined; selected: boolean; onSelect: (id: string) => void; expanded?: boolean; onToggle?: (() => void) | undefined }) {
  const meta = [
    KIND_LABEL[s.source.kind] || s.source.kind,
    s.agent.role === 'subagent' ? s.agent.path || s.agent.name : basename(s.cwd),
    s.agent.model,
    s.stats.costUsd !== undefined ? usd(s.stats.costUsd) : '',
    s.stats.turns + ' 轮',
    s.stats.toolCalls ? '工具 ' + s.stats.toolCalls + (s.stats.toolErrors ? '（错 ' + s.stats.toolErrors + '）' : '') : '',
  ].filter(Boolean);
  return (
    <div
      className={cn('group border-agentprism-border-subtle flex cursor-pointer gap-2 border-b border-l-2 py-2 pr-3', selected ? 'border-l-agentprism-brand bg-agentprism-secondary' : 'border-l-transparent hi-row', dim && 'opacity-60')}
      style={{ paddingLeft: 10 + depth * 16 }}
      onClick={() => onSelect(s.id)}
      title={s.title}
    >
      <span className={cn('mt-1.5 inline-block size-2 shrink-0 rounded-full', STATUS_DOT[s.state.status])} title={STATUS_LABEL[s.state.status]} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-agentprism-foreground min-w-0 flex-1 truncate text-sm">{cut(s.title, 80)}</span>
          <span className="text-agentprism-secondary-foreground shrink-0 text-xs">{ago(s.updatedAt)}</span>
        </div>
        <div className="text-agentprism-secondary-foreground mt-0.5 flex items-center gap-1.5 truncate text-xs">
          <span className="truncate">{meta.join(' · ')}</span>
          {childCount > 0 && onToggle && (
            <button className="text-agentprism-muted-foreground hover:text-agentprism-foreground flex shrink-0 items-center" onClick={(e) => { e.stopPropagation(); onToggle(); }}>
              {expanded ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}子智能体 {childCount}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
