/**
 * The analytics view (docs/ARCHITECTURE.md): one page of folds over everything the adapters
 * parsed — daily activity, tool and model rankings, project leaderboard. The layout and
 * the chart idioms (metric cards, ranked bars, calendar heatmap, trend bars) are adapted
 * from jerrywu001/jhlee0409's claude-code-history-viewer (MIT); the material language
 * (glass cards, gradient hairlines, pill badges, accent glows) is the observatory's,
 * shared through idiom.css.
 */
import type { LucideIcon } from 'lucide-react';
import { Activity, BarChart3, Bot, Cpu, Flame, Hash, MessageSquare, TrendingUp, Wrench } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { SessionSummary, StatsDoc } from '@hub-trace/contract';
import { loadStats, ServiceError } from './data.ts';
import { basename, KIND_LABEL, tokens, usd } from './format.ts';

type Props = {
  sessions: SessionSummary[];
};

const ACCENT = {
  brand: 'oklch(var(--agentprism-brand))',
  green: 'oklch(var(--agentprism-success))',
  amber: 'oklch(var(--agentprism-brand-secondary))',
  purple: 'oklch(var(--agentprism-pending))',
  cyan: 'oklch(var(--agentprism-badge-chain-foreground))',
  red: 'oklch(var(--agentprism-error))',
};

export function AnalyticsView({ sessions }: Props) {
  const [stats, setStats] = useState<StatsDoc | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stop = false;
    loadStats().then((d) => { if (!stop) setStats(d); }).catch((e) => { if (!stop) setError(e instanceof ServiceError ? e.message : String(e)); });
    return () => { stop = true; };
  }, []);

  const agg = useMemo(() => {
    let turns = 0, toolCalls = 0, toolErrors = 0, cost = 0, costSessions = 0, inTok = 0, outTok = 0, working = 0;
    const byKind = new Map<string, { sessions: number; turns: number }>();
    const byProject = new Map<string, { sessions: number; turns: number; tools: number; cost: number; last: string }>();
    for (const s of sessions) {
      turns += s.stats.turns;
      toolCalls += s.stats.toolCalls;
      toolErrors += s.stats.toolErrors;
      if (s.stats.costUsd !== undefined) { cost += s.stats.costUsd; costSessions++; }
      inTok += s.usage?.input ?? 0;
      outTok += s.usage?.output ?? 0;
      if (s.state.status === 'working' || s.state.status === 'waiting') working++;
      const k = byKind.get(s.source.kind) || { sessions: 0, turns: 0 };
      k.sessions++; k.turns += s.stats.turns; byKind.set(s.source.kind, k);
      if (s.cwd) {
        const p = byProject.get(s.cwd) || { sessions: 0, turns: 0, tools: 0, cost: 0, last: '' };
        p.sessions++; p.turns += s.stats.turns; p.tools += s.stats.toolCalls;
        p.cost += s.stats.costUsd ?? 0;
        if (s.updatedAt && s.updatedAt > p.last) p.last = s.updatedAt;
        byProject.set(s.cwd, p);
      }
    }
    return {
      turns, toolCalls, toolErrors, cost, costSessions, inTok, outTok, working,
      kinds: Array.from(byKind.entries()).sort((a, b) => b[1].sessions - a[1].sessions),
      projects: Array.from(byProject.entries()).sort((a, b) => b[1].turns - a[1].turns).slice(0, 8),
    };
  }, [sessions]);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-6xl space-y-4 p-4 pb-10">
        <div className="hi-card-head -mx-1 mb-1" style={{ '--hi-accent': ACCENT.brand } as React.CSSProperties}>
          <span className="hi-chip-ic"><BarChart3 className="size-3.5" /></span>
          <h1 className="hi-display text-sm font-bold">统计</h1>
          <span className="text-agentprism-secondary-foreground text-xs">{sessions.length + ' 个会话的全景：每天在做什么、哪些工具和模型最忙、哪个项目烧了最多的轮次'}</span>
        </div>

        {error && (
          <div className="hi-card hi-card-quiet text-agentprism-muted-foreground p-4 text-sm">
            <p>{error}。</p>
            <p>统计页需要检索索引（`npm run serve` 的本地服务）。</p>
          </div>
        )}

        <div className="grid grid-cols-[repeat(auto-fit,minmax(10.5rem,1fr))] gap-3">
          <Metric icon={Hash} label="会话" value={String(sessions.length)} sub={agg.working ? agg.working + ' 个还在跑' : '全部已结束'} accent={ACCENT.brand} />
          <Metric icon={MessageSquare} label="轮次" value={tokens(agg.turns)} sub={'平均 ' + Math.round(agg.turns / Math.max(sessions.length, 1)) + ' 轮/会话'} accent={ACCENT.purple} />
          <Metric icon={Wrench} label="工具调用" value={tokens(agg.toolCalls)} sub={agg.toolErrors ? tokens(agg.toolErrors) + ' 次出错' : '没有出错'} accent={ACCENT.amber} />
          <Metric icon={TrendingUp} label="输入 token" value={tokens(agg.inTok)} sub={'输出 ' + tokens(agg.outTok)} accent={ACCENT.green} />
          <Metric icon={Flame} label="成本" value={usd(agg.cost || undefined)} sub={agg.costSessions + ' 个会话有计费'} accent={ACCENT.red} />
          <Metric icon={Activity} label="索引步数" value={stats ? tokens(stats.steps) : '…'} sub={stats ? '检索层口径' : '读取中'} accent={ACCENT.cyan} />
        </div>

        {stats && (
          <>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Section title="日活跃（30 天）" icon={Activity} accent={ACCENT.green} sub={sumDays(stats, 30)}>
                <DailyTrend days={stats.days.slice(-30)} />
              </Section>
              <Section title="活动热力图（半年）" icon={Flame} accent={ACCENT.brand} sub={sumDays(stats, 183)}>
                <Heatmap days={stats.days} weeks={26} />
              </Section>
            </div>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Section title="最常用工具" icon={Wrench} accent={ACCENT.amber} sub={stats.tools.length + ' 种'}>
                <BarList rows={stats.tools.slice(0, 10).map((t) => ({ key: t.name, value: t.calls, sub: t.errors ? t.errors + ' 次出错' : undefined }))} accent={ACCENT.amber} />
              </Section>
              <Section title="模型调用" icon={Cpu} accent={ACCENT.purple} sub={stats.models.length + ' 个模型'}>
                <BarList rows={stats.models.slice(0, 10).map((m) => ({ key: m.name, value: m.calls }))} accent={ACCENT.purple} />
              </Section>
            </div>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Section title="来源" icon={Bot} accent={ACCENT.cyan} sub={agg.kinds.map(([k]) => KIND_LABEL[k] || k).join(' · ')}>
                <BarList rows={agg.kinds.map(([k, v]) => ({ key: KIND_LABEL[k] || k, value: v.sessions, sub: v.turns + ' 轮' }))} accent={ACCENT.cyan} />
              </Section>
              <Section title="项目榜（按轮次）" icon={BarChart3} accent={ACCENT.brand} sub={agg.projects.length + ' 个项目'}>
                <div className="space-y-1.5 p-2">
                  {agg.projects.map(([cwd, p], i) => (
                    <div key={cwd} className="hi-row flex items-center gap-3 px-2 py-1.5" title={cwd}>
                      <span className="hi-num w-5 text-right text-xs font-bold" style={{ color: i < 3 ? ACCENT.brand : undefined, opacity: i < 3 ? 1 : 0.55 }}>{i + 1}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="truncate text-xs font-medium">{basename(cwd)}</span>
                          <span className="hi-num shrink-0 text-xs font-semibold">{p.turns.toLocaleString()} 轮</span>
                        </div>
                        <div className="text-agentprism-secondary-foreground mt-0.5 text-[10px]">
                          {p.sessions + ' 会话 · ' + p.tools.toLocaleString() + ' 工具' + (p.cost > 0.01 ? ' · ' + usd(p.cost) : '')}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </Section>
            </div>
            <p className="text-agentprism-secondary-foreground px-1 text-[10px]">
              日活跃、热力图、工具与模型榜来自检索索引（每一步一条记录）；轮次、成本、token 与项目来自会话汇总。索引还在建立时这些数字会偏低，稍等再刷新。
            </p>
          </>
        )}
      </div>
    </div>
  );
}

function sumDays(stats: StatsDoc, n: number): string {
  const days = stats.days.slice(-n);
  const steps = days.reduce((a, d) => a + d.steps, 0);
  const active = days.filter((d) => d.steps > 0).length;
  return active + '/' + days.length + ' 天有活动 · ' + tokens(steps) + ' 步';
}

function Metric({ icon: Icon, label, value, sub, accent }: { icon: LucideIcon; label: string; value: string; sub: string; accent: string }) {
  return (
    <div className="hi-card flex flex-col gap-2 p-3.5">
      <span className="hi-chip-ic" style={{ '--hi-accent': accent } as React.CSSProperties}><Icon className="size-4" /></span>
      <div className="hi-num hi-metric-value" style={{ color: accent }}>{value}</div>
      <div className="hi-metric-label">{label}</div>
      <div className="border-agentprism-border text-agentprism-secondary-foreground border-t pt-2 text-[10px]">{sub}</div>
    </div>
  );
}

function Section({ title, icon: Icon, accent, sub, children }: { title: string; icon: LucideIcon; accent: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="hi-card" style={{ '--hi-accent': accent } as React.CSSProperties}>
      <div className="hi-card-head">
        <span className="hi-chip-ic"><Icon className="size-3.5" /></span>
        <span className="hi-card-title">{title}</span>
        {sub && <span className="hi-card-sub">{sub}</span>}
      </div>
      <div className="p-3">{children}</div>
    </div>
  );
}

function BarList({ rows, accent }: { rows: { key: string; value: number; sub?: string }[]; accent: string }) {
  const max = Math.max(...rows.map((r) => r.value), 1);
  const total = rows.reduce((a, r) => a + r.value, 0);
  if (!rows.length) return <div className="text-agentprism-secondary-foreground p-4 text-center text-xs">没有数据</div>;
  return (
    <div className="space-y-1.5 p-1">
      {rows.map((r) => (
        <div key={r.key} className="hi-row px-2 py-1.5" title={r.key}>
          <div className="flex items-baseline justify-between gap-2">
            <span className="truncate font-mono text-xs">{r.key}</span>
            <span className="hi-num shrink-0 text-xs font-semibold">{r.value.toLocaleString()}</span>
          </div>
          <div className="mt-1 flex items-center gap-2">
            <div className="hi-bar-track min-w-0 flex-1"><div className="hi-bar-fill" style={{ width: (r.value / max) * 100 + '%' }} /></div>
            <span className="hi-num w-24 shrink-0 text-right text-[10px] opacity-70">{r.sub || ((r.value / total) * 100).toFixed(1) + '%'}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

/** Compact 7-day-per-column activity bars; today highlighted (CCHV DailyTrendChart idiom). */
function DailyTrend({ days }: { days: StatsDoc['days'] }) {
  if (!days.length) return null;
  const max = Math.max(...days.map((d) => d.steps), 1);
  const today = new Date().toISOString().slice(0, 10);
  return (
    <div className="space-y-2 p-1">
      <div className="flex items-end gap-1.5" style={{ height: 88 }}>
        {days.map((d) => {
          const h = d.steps > 0 ? Math.max((d.steps / max) * 64, 3) : 2;
          const isToday = d.date === today;
          return (
            <div key={d.date} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1" title={d.date + '：' + d.steps + ' 步 / ' + d.sessions + ' 会话 / ' + d.toolCalls + ' 工具'}>
              <div
                className="w-full max-w-[18px] rounded-t"
                style={{ height: h, background: isToday ? 'oklch(var(--agentprism-success))' : d.steps > 0 ? 'color-mix(in oklab, oklch(var(--agentprism-success)) 55%, transparent)' : 'oklch(var(--agentprism-foreground) / 0.08)' }}
              />
              <span className="hi-num text-[10px]" style={{ color: isToday ? 'oklch(var(--agentprism-success))' : undefined, opacity: isToday ? 1 : 0.55 }}>{d.date.slice(8)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** GitHub-style contribution grid over the last N weeks (CCHV ActivityHeatmap, compacted). */
function Heatmap({ days, weeks }: { days: StatsDoc['days']; weeks: number }) {
  const byDate = useMemo(() => new Map(days.map((d) => [d.date, d])), [days]);
  const cells = useMemo(() => {
    const out: { date: string; steps: number }[] = [];
    const end = new Date();
    end.setHours(0, 0, 0, 0);
    const start = new Date(end);
    start.setDate(start.getDate() - (weeks * 7 - 1));
    start.setDate(start.getDate() - start.getDay());
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
      out.push({ date: key, steps: byDate.get(key)?.steps ?? 0 });
    }
    return out;
  }, [byDate, weeks]);
  const max = Math.max(...cells.map((c) => c.steps), 1);
  // Rows Mon..Sun, columns weeks; the grid flows column-major.
  const cols: typeof cells[] = [];
  for (let i = 0; i < cells.length; i += 7) cols.push(cells.slice(i, i + 7));
  return (
    <div className="overflow-x-auto p-1">
      <div className="flex gap-[3px]">
        {cols.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-[3px]">
            {week.map((c) => {
              const t = c.steps / max;
              return (
                <div
                  key={c.date}
                  className="hi-heat"
                  title={c.date + '：' + c.steps + ' 步'}
                  style={{ background: c.steps === 0 ? undefined : 'color-mix(in oklab, oklch(var(--agentprism-brand)) ' + Math.round(28 + t * 72) + '%, oklch(var(--agentprism-background)))' }}
                />
              );
            })}
          </div>
        ))}
      </div>
      <div className="text-agentprism-secondary-foreground mt-2 flex items-center gap-2 text-[10px]">
        <span>少</span>
        {[0.06, 0.3, 0.55, 0.8, 1].map((t) => (
          <div key={t} className="hi-heat" style={{ background: 'color-mix(in oklab, oklch(var(--agentprism-brand)) ' + Math.round(28 + t * 72) + '%, oklch(var(--agentprism-background)))' }} />
        ))}
        <span>多</span>
      </div>
    </div>
  );
}
