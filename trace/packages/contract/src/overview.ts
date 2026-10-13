/**
 * The overview aggregation behind /api/overview: which CLIs have sessions on this
 * machine, and which projects they worked in. Pure: summaries in, counts out, so
 * the page stays cheap over thousands of sessions and the aggregation is testable.
 * Lives in the contract because the CLI serves it and the viewer reads it (docs/ARCHITECTURE.md).
 */
import type { Iso, SessionSummary } from './index.ts';

export type RootInfo = { kind: string; label: string; dir: string; exists: boolean };

export type OverviewProject = {
  cwd: string;
  sessions: number;
  main: number;
  subagents: number;
  turns: number;
  toolCalls: number;
  toolErrors: number;
  costUsd?: number;
  firstAt?: Iso;
  lastAt?: Iso;
  /** Status of the most recently touched session, for the dot on the row. */
  lastStatus?: string;
  models: Record<string, number>;
};

export type OverviewSource = {
  kind: string;
  label: string;
  dir?: string;
  /** False: the source's home directory is not on this machine — it has no sessions because there is nothing to read. */
  exists?: boolean;
  sessions: number;
  main: number;
  subagents: number;
  working: number;
  failed: number;
  turns: number;
  toolCalls: number;
  toolErrors: number;
  costUsd?: number;
  tokensIn?: number;
  tokensOut?: number;
  firstAt?: Iso;
  lastAt?: Iso;
  models: { model: string; n: number }[];
  projects: OverviewProject[];
};

export type Overview = { contract: string; generatedAt: Iso; sources: OverviewSource[] };

const num = (v: number | undefined) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

export function overview(summaries: SessionSummary[], roots: RootInfo[], contract: string, now: () => number = Date.now): Overview {
  const byKind = new Map<string, SessionSummary[]>();
  for (const s of summaries) {
    const k = s.source.kind;
    const list = byKind.get(k);
    if (list) list.push(s);
    else byKind.set(k, [s]);
  }
  const kinds = new Set<string>([...byKind.keys(), ...roots.map((r) => r.kind)]);
  const sources: OverviewSource[] = [];
  for (const kind of kinds) {
    const root = roots.find((r) => r.kind === kind);
    const list = byKind.get(kind) || [];
    const acc: OverviewSource = {
      kind,
      label: root?.label || kind,
      ...(root ? { dir: root.dir, exists: root.exists } : {}),
      sessions: list.length,
      main: 0,
      subagents: 0,
      working: 0,
      failed: 0,
      turns: 0,
      toolCalls: 0,
      toolErrors: 0,
      models: [],
      projects: [],
    };
    let cost: number | undefined;
    let tokensIn: number | undefined;
    let tokensOut: number | undefined;
    const projects = new Map<string, OverviewProject>();
    const models = new Map<string, number>();
    for (const s of list) {
      if (s.agent.role === 'subagent') acc.subagents++;
      else acc.main++;
      if (s.state.status === 'working' || s.state.status === 'waiting') acc.working++;
      if (s.state.status === 'failed') acc.failed++;
      acc.turns += num(s.stats.turns);
      acc.toolCalls += num(s.stats.toolCalls);
      acc.toolErrors += num(s.stats.toolErrors);
      if (s.stats.costUsd !== undefined) cost = num(cost) + s.stats.costUsd;
      if (s.usage?.input !== undefined) tokensIn = num(tokensIn) + s.usage.input;
      if (s.usage?.output !== undefined) tokensOut = num(tokensOut) + s.usage.output;
      const model = s.agent.model || '（未知模型）';
      models.set(model, (models.get(model) || 0) + 1);
      if (!s.startedAt || acc.firstAt === undefined || s.startedAt < acc.firstAt) acc.firstAt = s.startedAt || acc.firstAt;
      if (s.updatedAt && (acc.lastAt === undefined || s.updatedAt > acc.lastAt)) acc.lastAt = s.updatedAt;

      const cwd = s.cwd || '（没有目录记录）';
      let p = projects.get(cwd);
      if (!p) {
        p = { cwd, sessions: 0, main: 0, subagents: 0, turns: 0, toolCalls: 0, toolErrors: 0, models: {} };
        projects.set(cwd, p);
      }
      p.sessions++;
      if (s.agent.role === 'subagent') p.subagents++;
      else p.main++;
      p.turns += num(s.stats.turns);
      p.toolCalls += num(s.stats.toolCalls);
      p.toolErrors += num(s.stats.toolErrors);
      if (s.stats.costUsd !== undefined) p.costUsd = num(p.costUsd) + s.stats.costUsd;
      if (s.startedAt && (p.firstAt === undefined || s.startedAt < p.firstAt)) p.firstAt = s.startedAt;
      if (s.updatedAt && (p.lastAt === undefined || s.updatedAt > p.lastAt)) {
        p.lastAt = s.updatedAt;
        p.lastStatus = s.state.status;
      }
      const pm = s.agent.model || '（未知模型）';
      p.models[pm] = (p.models[pm] || 0) + 1;
    }
    if (cost !== undefined) acc.costUsd = Math.round(cost * 1e4) / 1e4;
    if (tokensIn !== undefined) acc.tokensIn = tokensIn;
    if (tokensOut !== undefined) acc.tokensOut = tokensOut;
    acc.models = Array.from(models).map(([model, n]) => ({ model, n })).sort((a, b) => b.n - a.n);
    acc.projects = Array.from(projects.values()).sort((a, b) => (b.lastAt || '') < (a.lastAt || '') ? -1 : 1);
    sources.push(acc);
  }
  sources.sort((a, b) => b.sessions - a.sessions);
  return { contract, generatedAt: new Date(now()).toISOString(), sources };
}
