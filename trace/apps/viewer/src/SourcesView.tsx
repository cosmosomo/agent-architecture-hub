/**
 * The sources & projects page: which CLIs have sessions on this machine, and which
 * projects they worked in. One section per source (Codex, Claude Code, ...), a model
 * distribution, and the project table sorted by last activity. Clicking a project
 * opens the step search scoped to that working directory. Data: /api/overview.
 */
import type { Overview, OverviewSource } from '@hub-trace/contract';
import { KIND_LABEL, STATUS_DOT, STATUS_LABEL, ago, basename, tokens, usd } from './format.ts';
import { FolderOpen, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { loadOverview, ServiceError } from './data.ts';

type Props = { onClose: () => void };

const WINDOWS: [string, number][] = [['全部', 0], ['今天', 24], ['7 天', 24 * 7], ['30 天', 24 * 30]];

export function SourcesView({ onClose }: Props) {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [win, setWin] = useState(0); // hours; 0 = all time

  useEffect(() => {
    let stop = false;
    loadOverview()
      .then((d) => { if (!stop) { setData(d); setError(null); } })
      .catch((e) => { if (!stop) setError(e instanceof ServiceError ? e.message : String(e)); });
    const t = setInterval(() => { loadOverview().then((d) => { if (!stop) setData(d); }).catch(() => {}); }, 15000);
    return () => { stop = true; clearInterval(t); };
  }, []);

  const cut = win ? Date.now() - win * 3600 * 1000 : 0;

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-4xl space-y-5 p-6">
        <div className="flex items-center gap-3">
          <FolderOpen className="text-agentprism-brand size-4" />
          <h1 className="text-base font-semibold">来源与项目</h1>
          <span className="text-agentprism-secondary-foreground text-xs">哪些 CLI 在这台机器上有会话记录、各在哪些项目里干活</span>
          <span className="flex-1" />
          <div className="flex gap-1">
            {WINDOWS.map(([label, hours]) => (
              <button
                key={label}
                className={'rounded border px-2 py-0.5 text-xs ' + (win === hours ? 'border-agentprism-brand bg-agentprism-secondary text-agentprism-foreground' : 'border-agentprism-border text-agentprism-muted-foreground hover:border-agentprism-border-strong')}
                onClick={() => setWin(hours)}
                title={hours ? '只看 ' + label + '内有活动的项目' : '全部时间'}
              >
                {label}
              </button>
            ))}
          </div>
          <button className="text-agentprism-muted-foreground hover:text-agentprism-foreground" onClick={onClose} title="回到会话列表"><X className="size-4" /></button>
        </div>

        {error && (
          <div className="text-agentprism-muted-foreground space-y-2 p-4 text-sm">
            <p>{error}。</p>
            <p>在 <code className="bg-agentprism-secondary rounded px-1">trace</code> 目录运行 <code className="bg-agentprism-secondary rounded px-1">npm run serve</code>，再打开 http://127.0.0.1:8790/trace/ 。</p>
          </div>
        )}
        {data && data.sources.map((s) => <SourceCard key={s.kind} s={s} cut={cut} />)}
        {data && !data.sources.length && <div className="text-agentprism-secondary-foreground p-4 text-sm">还没有发现任何会话记录。</div>}
      </div>
    </div>
  );
}

function SourceCard({ s, cut }: { s: OverviewSource; cut: number }) {
  const inWindow = useMemo(
    () => (cut ? s.projects.filter((p) => p.lastAt && Date.parse(p.lastAt) >= cut) : s.projects),
    [s.projects, cut],
  );
  const topModels = s.models.slice(0, 4);
  const maxModel = topModels[0]?.n || 1;
  const meta = [
    s.main + ' 主' + (s.subagents ? ' / ' + s.subagents + ' 子' : ''),
    s.working ? s.working + ' 个进行中' : '',
    s.turns ? s.turns + ' 轮' : '',
    s.toolCalls ? '工具 ' + s.toolCalls + (s.toolErrors ? '（错 ' + s.toolErrors + '）' : '') : '',
    s.tokensIn !== undefined || s.tokensOut !== undefined ? 'token 入 ' + tokens(s.tokensIn) + ' / 出 ' + tokens(s.tokensOut) : '',
    s.costUsd !== undefined ? '成本 ' + usd(s.costUsd) : '',
  ].filter(Boolean);

  return (
    <section className="hi-card" style={{ '--hi-accent': 'oklch(var(--agentprism-brand))' } as React.CSSProperties}>
      <header className="hi-card-head">
        <span className="hi-chip-ic"><FolderOpen className="size-3.5" /></span>
        <h2 className="hi-card-title">{s.label}</h2>
        {s.exists !== false && <span className="hi-pill">{s.sessions + ' 个会话'}</span>}
        {s.exists === false && <span className="border-agentprism-border text-agentprism-muted-foreground rounded border px-1.5 py-0.5 text-xs">目录不存在</span>}
        {s.dir && <span className="text-agentprism-secondary-foreground truncate text-xs" title={s.dir}>{s.dir}</span>}
        <span className="hi-card-sub">{s.lastAt ? '最后活动 ' + ago(s.lastAt) : ''}</span>
      </header>

      {s.exists === false ? (
        <div className="text-agentprism-secondary-foreground px-4 py-3 text-xs">这个 CLI 在这台机器上还没有记录（上面的目录不存在）。等它跑过，这里会自己出现。</div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2 text-xs">
            <span className="text-agentprism-secondary-foreground">{meta.join(' · ')}</span>
          </div>
          {topModels.length > 0 && (
            <div className="space-y-1 px-4 pb-2">
              {topModels.map((m) => (
                <div key={m.model} className="flex items-center gap-2 text-xs">
                  <span className="text-agentprism-secondary-foreground w-44 truncate" title={m.model}>{m.model}</span>
                  <span className="hi-bar-track min-w-0 flex-1"><span className="hi-bar-fill block" style={{ width: Math.max(3, Math.round((100 * m.n) / maxModel)) + '%' }} /></span>
                  <span className="text-agentprism-secondary-foreground w-[4.5rem] shrink-0 whitespace-nowrap text-right">{m.n} 个会话</span>
                </div>
              ))}
            </div>
          )}
          <table className="w-full text-xs">
            <thead>
              <tr className="text-agentprism-secondary-foreground border-agentprism-border border-t text-left">
                <th className="px-4 py-1.5 font-normal">项目（工作目录）</th>
                <th className="whitespace-nowrap px-2 py-1.5 text-right font-normal">会话</th>
                <th className="whitespace-nowrap px-2 py-1.5 text-right font-normal">轮次</th>
                {s.costUsd !== undefined && <th className="whitespace-nowrap px-2 py-1.5 text-right font-normal">成本</th>}
                <th className="px-4 py-1.5 text-right font-normal">最后活动</th>
              </tr>
            </thead>
            <tbody>
              {inWindow.map((p) => {
                const first = p.cwd.split(/[\\/]/).filter(Boolean).slice(-1)[0] || p.cwd;
                const models = Object.entries(p.models).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([m]) => m).join(' · ');
                return (
                  <tr
                    key={p.cwd}
                    className="border-agentprism-border-subtle hover:bg-agentprism-muted cursor-pointer border-t"
                    title={p.cwd + '\n模型：' + (models || '—') + '\n点击检索这个目录里的每一步'}
                    onClick={() => { location.hash = 'view=search&cwd=' + encodeURIComponent(p.cwd); }}
                  >
                    <td className="px-4 py-1.5">
                      <span className="text-agentprism-foreground">{first}</span>
                      <span className="text-agentprism-secondary-foreground ml-2" >{p.cwd.length > 60 ? '…' + p.cwd.slice(-46) : p.cwd !== first ? p.cwd : ''}</span>
                    </td>
                    <td className="text-agentprism-secondary-foreground whitespace-nowrap px-2 py-1.5 text-right">{p.sessions}{p.subagents ? <span className="text-agentprism-muted-foreground">（{p.subagents} 子）</span> : ''}</td>
                    <td className="text-agentprism-secondary-foreground px-2 py-1.5 text-right">{p.turns}</td>
                    {s.costUsd !== undefined && <td className="text-agentprism-secondary-foreground whitespace-nowrap px-2 py-1.5 text-right">{p.costUsd !== undefined ? usd(p.costUsd) : '—'}</td>}
                    <td className="px-4 py-1.5 text-right">
                      <span className="inline-flex items-center justify-end gap-1.5">
                        {p.lastStatus && <span className={'inline-block size-1.5 rounded-full ' + (STATUS_DOT[p.lastStatus as keyof typeof STATUS_DOT] || '')} title={STATUS_LABEL[p.lastStatus as keyof typeof STATUS_LABEL] || p.lastStatus} />}
                        <span className="text-agentprism-secondary-foreground">{p.lastAt ? ago(p.lastAt) : ''}</span>
                      </span>
                    </td>
                  </tr>
                );
              })}
              {!inWindow.length && (
                <tr className="border-agentprism-border-subtle border-t"><td colSpan={5} className="text-agentprism-secondary-foreground px-4 py-3">这个时间窗内没有活跃项目。</td></tr>
              )}
            </tbody>
          </table>
        </>
      )}
    </section>
  );
}
