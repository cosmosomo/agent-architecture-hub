import type { Session, SessionSummary } from '@hub-trace/contract';
import cn from 'classnames';
import { STATUS_DOT, STATUS_LABEL, ago, basename, cut, duration, tokens, usageLine, when } from './format.ts';

type Props = {
  session: Session;
  /** Summaries by id, to name linked sessions. */
  known: Map<string, SessionSummary>;
  onOpen: (id: string) => void;
};

export function SessionHeader({ session: s, known, onOpen }: Props) {
  const parent = s.links.find((l) => l.rel === 'parent');
  const children = s.links.filter((l) => l.rel === 'child');
  const forked = s.links.find((l) => l.rel === 'forked-from');
  const limit = s.limits?.find((l) => l.name === 'primary');
  const facts: [string, string][] = [
    ['智能体', s.agent.product + (s.agent.role === 'subagent' ? ' 子智能体 ' + (s.agent.path || s.agent.name) : ' 主会话')],
    ['模型', [s.agent.model, s.agent.provider].filter(Boolean).join(' · ')],
    ['目录', s.cwd ? basename(s.cwd) : ''],
    ['开始', when(s.startedAt)],
    ['规模', s.stats.turns + ' 轮，模型调用 ' + s.stats.modelCalls + '，工具 ' + s.stats.toolCalls + (s.stats.toolErrors ? '（出错 ' + s.stats.toolErrors + '）' : '') + (s.stats.compactions ? '，压缩 ' + s.stats.compactions + ' 次' : '')],
    ['用时', duration(s.stats.durationMs)],
    ['token', usageLine(s.usage)],
    ['额度', limit ? '已用 ' + limit.usedPercent + '%' + (limit.windowMinutes ? '（' + Math.round(limit.windowMinutes / 60) + ' 小时窗口）' : '') : ''],
  ];
  const name = (id: string, fallback?: string) => cut(known.get(id)?.title || fallback || id, 40);
  return (
    <div className="border-agentprism-border shrink-0 space-y-2 border-b px-4 py-3">
      <div className="text-agentprism-foreground text-base font-semibold leading-snug" title={s.title}>{cut(s.title, 160)}</div>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="border-agentprism-border text-agentprism-foreground inline-flex items-center gap-1.5 rounded border px-1.5 py-0.5">
          <span className={cn('inline-block size-1.5 rounded-full', STATUS_DOT[s.state.status])} />
          {STATUS_LABEL[s.state.status]}
        </span>
        {s.state.detail && <span className="text-agentprism-muted-foreground">{s.state.detail}</span>}
        {s.updatedAt && <span className="text-agentprism-secondary-foreground">· 最后记录 {ago(s.updatedAt)}</span>}
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs sm:grid-cols-[auto_1fr_auto_1fr]">
        {facts.filter(([, v]) => v).map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-agentprism-secondary-foreground">{k}</dt>
            <dd className="text-agentprism-muted-foreground truncate" title={k === '目录' ? s.cwd : v}>{v}</dd>
          </div>
        ))}
      </dl>
      {(parent || forked || children.length > 0) && (
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
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
