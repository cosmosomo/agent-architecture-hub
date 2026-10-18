import type { Session, SessionSummary } from '@hub-trace/contract';
import cn from 'classnames';
import { STATUS_DOT, STATUS_LABEL, ago, basename, cut, duration, tokens, usageLine, usd, when } from './format.ts';

type Props = {
  session: Session;
  /** Summaries by id, to name linked sessions. */
  known: Map<string, SessionSummary>;
  onOpen: (id: string) => void;
  /** The same session (and the step selected here) in the observatory, drawn with the sub-agents it started. */
  observatoryHref: string;
};

export function SessionHeader({ session: s, known, onOpen, observatoryHref }: Props) {
  const parent = s.links.find((l) => l.rel === 'parent');
  const children = s.links.filter((l) => l.rel === 'child');
  const forked = s.links.find((l) => l.rel === 'forked-from');
  const limit = s.limits?.find((l) => l.name === 'primary');
  const name = (id: string, fallback?: string) => cut(known.get(id)?.title || fallback || id, 40);
  const kpis: { label: string; value: string; sub?: string; tone?: string }[] = [
    {
      label: '执行规模',
      value: `${s.stats.turns} 轮`,
      sub: `模型 ${s.stats.modelCalls} · 工具 ${s.stats.toolCalls}`,
    },
    {
      label: '总耗时',
      value: duration(s.stats.durationMs) || '—',
      sub: s.startedAt ? when(s.startedAt) : '—',
    },
    {
      label: 'Token 用量',
      value: s.usage?.total ? tokens(s.usage.total) : '—',
      sub: usageLine(s.usage) || '未记录明细',
    },
    {
      label: s.stats.toolErrors ? '工具异常' : '花费 / 变更',
      value: s.stats.toolErrors
        ? `${s.stats.toolErrors} 处报错`
        : s.stats.costUsd !== undefined
        ? usd(s.stats.costUsd)
        : s.stats.linesAdded !== undefined
        ? `+${s.stats.linesAdded}/−${s.stats.linesRemoved ?? 0}`
        : '0 错误',
      sub: limit ? `额度已用 ${limit.usedPercent}%` : s.cwd ? basename(s.cwd) : '状态正常',
      tone: s.stats.toolErrors ? 'text-agentprism-error' : undefined,
    },
  ];
  return (
    <div className="hi-card-head !flex-col !items-stretch gap-2.5 !px-4 !py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-agentprism-foreground truncate text-[15px] font-bold leading-snug" title={s.title}>
            {cut(s.title, 160)}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
            <span className="hi-pill">
              <span className={cn('inline-block size-1.5 rounded-full', STATUS_DOT[s.state.status])} />
              {STATUS_LABEL[s.state.status]}
            </span>
            <span className="border-agentprism-border bg-agentprism-secondary/60 text-agentprism-muted-foreground rounded-md border px-2 py-0.5 font-mono text-[11px]">
              {s.agent.product}
              {s.agent.model ? ` · ${s.agent.model}` : ''}
            </span>
            {s.cwd && (
              <span className="border-agentprism-border bg-agentprism-secondary/40 text-agentprism-secondary-foreground rounded-md border px-2 py-0.5 font-mono text-[11px]" title={s.cwd}>
                📁 {basename(s.cwd)}
              </span>
            )}
            {s.updatedAt && <span className="text-agentprism-secondary-foreground text-[11px]">· {ago(s.updatedAt)}</span>}
          </div>
        </div>
        <a
          className="hi-navbtn on shrink-0 !h-7 !px-2.5"
          href={observatoryHref}
          title="在观察台里打开：实时对话监控 + 协作拓扑"
        >
          在观察台打开 ↗
        </a>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className="hi-card-quiet border-agentprism-border/70 rounded-lg border px-2.5 py-1.5">
            <div className="hi-metric-label !text-[9.5px]">{k.label}</div>
            <div className={cn('hi-num mt-0.5 text-sm font-bold', k.tone || 'text-agentprism-foreground')}>{k.value}</div>
            {k.sub && <div className="text-agentprism-secondary-foreground truncate text-[10.5px]">{k.sub}</div>}
          </div>
        ))}
      </div>

      {(parent || forked || children.length > 0) && (
        <div className="flex flex-wrap items-center gap-1.5 pt-0.5 text-xs">
          {parent && <LinkChip label={'父会话 · ' + name(parent.id)} onClick={() => onOpen(parent.id)} disabled={!known.has(parent.id)} />}
          {forked && <LinkChip label={'分叉自 · ' + name(forked.id)} onClick={() => onOpen(forked.id)} disabled={!known.has(forked.id)} />}
          {children.length > 0 && <span className="text-agentprism-secondary-foreground">子智能体</span>}
          {children.slice(0, 24).map((c) => (
            <LinkChip key={c.id} label={c.label || name(c.id)} onClick={() => onOpen(c.id)} disabled={!known.has(c.id)} />
          ))}
          {children.length > 24 && <span className="text-agentprism-secondary-foreground">等 {children.length} 个</span>}
        </div>
      )}
      {s.usage?.total !== undefined && <span className="sr-only">合计 {tokens(s.usage.total)} token</span>}
    </div>
  );
}

function LinkChip({ label, onClick, disabled }: { label: string; onClick: () => void; disabled: boolean }) {
  return (
    <button
      className={cn('rounded border px-1.5 py-0.5', disabled ? 'border-agentprism-border-subtle text-agentprism-secondary-foreground cursor-default' : 'border-agentprism-border text-agentprism-muted-foreground hover:border-agentprism-brand hover:text-agentprism-foreground')}
      onClick={disabled ? undefined : onClick}
      title={disabled ? '这个会话不在本机索引里' : '打开'}
    >
      {label}
    </button>
  );
}
