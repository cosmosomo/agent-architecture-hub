/**
 * The "一群会话" level: a goal is a set of tasks with dependencies, a budget and a way to verify each task. The
 * center hosts it (channels/README.md, "每一级由谁当宿主"): every step it decides who is next, what they get and
 * whether to stop.
 *
 *   goal ─1:N─ task ─1:N─ dispatch (the gateway's own, ~/.agent-hub/dispatches/)
 *
 * - who is next: the task's channel (or the goal's), on a session of its own that keeps its context across rework;
 *   a channel of "auto" lets the center pick (deps.pickChannel: health and load), and a failed dispatch picks again
 *   leaving out the product that failed;
 * - what they get: the goal, the task, its acceptance, what the tasks it depends on handed back, the rework note;
 * - stop or not: the verdict (a person, a verifier agent, or "auto"), the rework limit, a rework that hands back
 *   the same thing again, a goal that keeps dispatching without finishing anything, and the goal's budget.
 *
 * The board never starts a run itself: it calls deps.dispatch (the gateway's dispatchTask) and learns how a
 * dispatch went from onDispatch (called whenever the gateway saves one). Files: ~/.agent-hub/goals/<id>.json and
 * ~/.agent-hub/tasks/<id>.json (HUB_DATA_DIR moves both, for tests).
 */

import { mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export type TaskStatus = 'blocked' | 'queued' | 'dispatched' | 'verifying' | 'completed' | 'failed' | 'cancelled';
export type GoalStatus = 'running' | 'paused' | 'fused' | 'completed' | 'cancelled';
/** 'human' waits for a person; 'auto' passes any non-empty hand-back; 'agent:<channel>' asks another agent. */
export type VerifyBy = 'human' | 'auto' | `agent:${string}`;

export interface TaskRecord {
  id: string;
  goalId: string;
  /** Short name inside the goal, used by dependsOn. */
  key: string;
  title: string;
  goal: string;
  acceptance: string;
  status: TaskStatus;
  dependsOn: string[];
  /** The product it runs on; for an "auto" task, '' until the center picks one. */
  channel: string;
  /** Set when the task's channel was "auto": the products the center may pick from (empty: any it drives) and
   *  those left out because a dispatch to them failed. */
  auto?: { candidates: string[]; excluded: string[] };
  /** Why an "auto" task is still waiting for a product, as the pick last said. */
  waitingWhy?: string;
  model?: string;
  verifyBy: VerifyBy;
  /** The session this task runs on; kept across rework so the worker keeps its context. Named after the task's line
   *  of work (its `session`, else the key its author gave it), not the goal, so the next goal on the same line reuses the session and its
   *  context; one goal per session was 200 sessions for 250 dispatches by 10-19. A task with no key of its own
   *  (t1, t2…) still gets a session of its goal: those keys say nothing about the work. */
  sessionName: string;
  /** Raised on every dispatch; a hand-back from an older dispatch is ignored. */
  epoch: number;
  activeDispatchId: string | null;
  verifierDispatchId: string | null;
  dispatchHistory: string[];
  reworkCount: number;
  failedDispatches: number;
  delivery: { at: string; summary: string; reply: string; files: string[] } | null;
  /** Earlier hand-backs, newest last, to notice a rework that changes nothing. */
  previousReplies: string[];
  verdict: { at: string; passed: boolean; note: string; by: string; rework?: string } | null;
  /** Why the task stopped, when it is failed. */
  fuse?: string;
  history: Array<{ at: string; action: string; detail?: any }>;
  createdAt: string;
  updatedAt: string;
}

export interface GoalBudget {
  /** Dispatches the whole goal may use (worker and verifier). */
  maxDispatches: number;
  /** Tasks running at once. */
  maxParallel: number;
  /** Rework rounds per task before it is stopped. */
  maxRework: number;
  /** Dispatches in a row with no task completed before the goal is stopped as stalled. */
  maxStall: number;
  /** Wall-clock limit for the goal, from creation. */
  maxWallClockMs: number;
}

export interface GoalRecord {
  id: string;
  title: string;
  objective: string;
  acceptance: string;
  status: GoalStatus;
  /** Why it is paused, fused, or cancelled. */
  reason?: string;
  taskIds: string[];
  cwd?: string;
  budget: GoalBudget;
  usage: { dispatches: number; sinceLastCompletion: number };
  history: Array<{ at: string; action: string; detail?: any }>;
  createdAt: string;
  updatedAt: string;
}

export interface CreateGoalParams {
  title: string;
  objective: string;
  acceptance?: string;
  /** Default channel, model and verification for tasks that do not name their own. "auto": the center picks. */
  channel?: string;
  /** For "auto": the products it may pick from (empty: any it drives). */
  candidates?: string[];
  model?: string;
  verifyBy?: VerifyBy;
  cwd?: string;
  budget?: Partial<GoalBudget>;
  tasks: Array<{
    key?: string;
    title: string;
    goal?: string;
    acceptance?: string;
    dependsOn?: string[];
    channel?: string;
    candidates?: string[];
    model?: string;
    verifyBy?: VerifyBy;
    /** A fixed session to work on, e.g. a researcher's research-<topic> (channels/research/README.md): its context
     *  carries over from one goal to the next. Without it each task gets a session of its own. */
    session?: string;
  }>;
}

export interface DispatchView {
  id: string;
  status: string;
  delivery?: { at: string; summary: string; reply: string; files: string[] };
  error?: string;
  /** Why the turn failed (gateway/failure.ts): 'quota' is the account's, not the task's. */
  failureKind?: string;
}

export interface TaskBoardDeps {
  dispatch: (p: { toChannel: string; toSessionName: string; toModel?: string; cwd?: string; task: string }) => Promise<DispatchView>;
  /** Told after every change (goal or task), for the page. */
  changed?: (goal: GoalRecord) => void;
  /** The center's pick of a product among candidates (gateway/capacity.ts); used by tasks whose channel is "auto". */
  pickChannel?: (candidates?: string[], exclude?: string[]) => { channel: string | null; why: string };
  /** Why a product cannot take work right now, when that will pass by itself (quota cooldown, breaker, full); else null. */
  holdFor?: (channel: string) => string | null;
  /** A turn is running in this session now (anyone's: a page, another agent). */
  sessionBusy?: (channel: string, sessionName: string) => boolean;
}

const DEFAULT_BUDGET: GoalBudget = { maxDispatches: 20, maxParallel: 2, maxRework: 2, maxStall: 6, maxWallClockMs: 4 * 3600_000 };
const SAME_REPLY = 0.9;
const now = () => new Date().toISOString();
const shortId = (p: string) => `${p}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

/** Character-bigram Jaccard similarity: how much two hand-backs say the same thing. */
export function similarity(a: string, b: string): number {
  const grams = (s: string) => {
    const t = s.replace(/\s+/g, ' ').trim();
    const g = new Set<string>();
    for (let i = 0; i < t.length - 1; i++) g.add(t.slice(i, i + 2));
    return g;
  };
  const A = grams(a);
  const B = grams(b);
  if (!A.size && !B.size) return 1;
  let both = 0;
  for (const x of A) if (B.has(x)) both++;
  return both / (A.size + B.size - both);
}

export class TaskBoard {
  private readonly goalsDir: string;
  private readonly tasksDir: string;
  private readonly goals = new Map<string, GoalRecord>();
  private readonly tasks = new Map<string, TaskRecord>();
  private stepping = false;
  /** Tasks whose check is being dispatched right now (startVerify awaits the dispatch). */
  private readonly verifyStarting = new Set<string>();
  private readonly deps: TaskBoardDeps;

  constructor(deps: TaskBoardDeps, dataDir = process.env.HUB_DATA_DIR || join(homedir(), '.agent-hub')) {
    this.deps = deps;
    this.goalsDir = join(dataDir, 'goals');
    this.tasksDir = join(dataDir, 'tasks');
    for (const [dir, map] of [[this.goalsDir, this.goals], [this.tasksDir, this.tasks]] as const) {
      mkdirSync(dir, { recursive: true });
      for (const f of readdirSync(dir)) {
        if (!f.endsWith('.json')) continue;
        try {
          const r = JSON.parse(readFileSync(join(dir, f), 'utf8'));
          if (r?.id) (map as Map<string, any>).set(r.id, r);
        } catch {}
      }
    }
  }

  // ---- reading ----

  listGoals(): Array<GoalRecord & { counts: Record<string, number> }> {
    return [...this.goals.values()]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((g) => {
        const counts: Record<string, number> = {};
        for (const t of this.tasksOf(g)) counts[t.status] = (counts[t.status] || 0) + 1;
        return { ...g, counts };
      });
  }

  getGoal(id: string): GoalRecord | undefined {
    return this.goals.get(id);
  }

  getTask(id: string): TaskRecord | undefined {
    return this.tasks.get(id);
  }

  tasksOf(g: GoalRecord): TaskRecord[] {
    return g.taskIds.map((id) => this.tasks.get(id)).filter(Boolean) as TaskRecord[];
  }

  /**
   * The goal as a graph: tasks and the sessions they ran on as nodes; "depends_on" and "runs_on" as edges; and
   * the trajectory, every step of the goal and its tasks in time order.
   */
  view(id: string) {
    const goal = this.goals.get(id);
    if (!goal) return null;
    const tasks = this.tasksOf(goal);
    const byKey = new Map(tasks.map((t) => [t.key, t]));
    const nodes = [
      ...tasks.map((t) => ({ id: t.id, type: 'task', key: t.key, title: t.title, status: t.status, depth: this.depth(t, byKey) })),
      ...[...new Set(tasks.filter((t) => t.channel).map((t) => `${t.channel}/${t.sessionName}`))].map((s) => ({ id: s, type: 'session' })),
    ];
    const edges = [
      ...tasks.flatMap((t) => t.dependsOn.map((k) => ({ from: byKey.get(k)?.id || k, to: t.id, type: 'depends_on' }))),
      ...tasks.filter((t) => t.epoch > 0).map((t) => ({ from: t.id, to: `${t.channel}/${t.sessionName}`, type: 'runs_on', epoch: t.epoch })),
    ];
    const trajectory = [
      ...goal.history.map((h) => ({ ...h, scope: 'goal' })),
      ...tasks.flatMap((t) => t.history.map((h) => ({ ...h, scope: t.key, taskId: t.id }))),
    ].sort((a, b) => a.at.localeCompare(b.at));
    return { goal, tasks, graph: { nodes, edges }, trajectory };
  }

  private depth(t: TaskRecord, byKey: Map<string, TaskRecord>, seen = new Set<string>()): number {
    if (seen.has(t.key)) return 0;
    seen.add(t.key);
    let d = 0;
    for (const k of t.dependsOn) {
      const up = byKey.get(k);
      if (up) d = Math.max(d, 1 + this.depth(up, byKey, seen));
    }
    return d;
  }

  // ---- the person's actions ----

  createGoal(p: CreateGoalParams): GoalRecord {
    if (!p.title?.trim() || !p.objective?.trim()) throw new Error('目标要有标题和要做成什么（title、objective）');
    if (!Array.isArray(p.tasks) || !p.tasks.length) throw new Error('目标至少要有一个任务（tasks）');
    const id = shortId('goal');
    const keys = p.tasks.map((t, i) => (t.key || `t${i + 1}`).trim());
    if (new Set(keys).size !== keys.length) throw new Error(`任务的 key 重复：${keys.join(', ')}`);
    for (const [i, t] of p.tasks.entries()) {
      for (const k of t.dependsOn || []) if (!keys.includes(k)) throw new Error(`任务 ${keys[i]} 依赖的 ${k} 不在这个目标里`);
      if (!(t.channel || p.channel)) throw new Error(`任务 ${keys[i]} 没说派给哪个产品（channel）`);
    }
    this.assertAcyclic(p.tasks.map((t, i) => ({ key: keys[i], dependsOn: t.dependsOn || [] })));

    const at = now();
    const goal: GoalRecord = {
      id,
      title: p.title.trim(),
      objective: p.objective.trim(),
      acceptance: (p.acceptance || '').trim(),
      status: 'running',
      taskIds: [],
      cwd: p.cwd,
      budget: { ...DEFAULT_BUDGET, ...(p.budget || {}) },
      usage: { dispatches: 0, sinceLastCompletion: 0 },
      history: [{ at, action: 'goal_created', detail: { tasks: keys } }],
      createdAt: at,
      updatedAt: at,
    };
    for (const [i, t] of p.tasks.entries()) {
      const ch = (t.channel || p.channel)!;
      const task: TaskRecord = {
        id: shortId('tsk'),
        goalId: id,
        key: keys[i],
        title: t.title.trim(),
        goal: (t.goal || t.title).trim(),
        acceptance: (t.acceptance || '').trim(),
        status: (t.dependsOn || []).length ? 'blocked' : 'queued',
        dependsOn: t.dependsOn || [],
        channel: ch === 'auto' ? '' : ch,
        ...(ch === 'auto' ? { auto: { candidates: t.candidates || p.candidates || [], excluded: [] } } : {}),
        model: t.model || p.model,
        verifyBy: t.verifyBy || p.verifyBy || 'human',
        sessionName: (t.session || (t.key ? keys[i] : `goal-${id.slice(5)}-${keys[i]}`)).replace(/[^a-zA-Z0-9._-]/g, '_'),
        epoch: 0,
        activeDispatchId: null,
        verifierDispatchId: null,
        dispatchHistory: [],
        reworkCount: 0,
        failedDispatches: 0,
        delivery: null,
        previousReplies: [],
        verdict: null,
        history: [{ at, action: 'task_created' }],
        createdAt: at,
        updatedAt: at,
      };
      goal.taskIds.push(task.id);
      this.saveTask(task);
    }
    this.saveGoal(goal);
    void this.step();
    return goal;
  }

  /** pause | resume | cancel. Resume may raise the budget (a paused goal usually ran out of it). */
  goalAction(id: string, action: string, body: { budget?: Partial<GoalBudget>; reason?: string } = {}): GoalRecord {
    const g = this.mustGoal(id);
    if (action === 'pause') {
      if (g.status !== 'running') throw new Error(`目标是 ${g.status}，不能暂停`);
      this.setGoal(g, 'paused', body.reason || '人暂停');
    } else if (action === 'resume') {
      if (g.status === 'completed' || g.status === 'cancelled') throw new Error(`目标已经 ${g.status}`);
      if (body.budget) g.budget = { ...g.budget, ...body.budget };
      g.usage.sinceLastCompletion = 0;
      this.setGoal(g, 'running', '人恢复', body.budget ? { budget: g.budget } : undefined);
    } else if (action === 'cancel') {
      for (const t of this.tasksOf(g)) if (!['completed', 'cancelled'].includes(t.status)) this.setTask(t, 'cancelled', 'cancelled_with_goal');
      this.setGoal(g, 'cancelled', body.reason || '人取消');
    } else {
      throw new Error(`目标没有这个动作：${action}（pause、resume、cancel）`);
    }
    void this.step();
    return g;
  }

  /**
   * verify {passed, note, rework?} | retry | reassign {channel ("auto" too), candidates?, model?} | cancel. Retry and
   * reassign put a stopped task back in the queue (and a fused goal back to running).
   */
  taskAction(id: string, action: string, body: any = {}): TaskRecord {
    const t = this.mustTask(id);
    const g = this.mustGoal(t.goalId);
    if (action === 'verify') {
      if (t.status !== 'verifying') throw new Error(`任务是 ${t.status}，没有等验收的交回`);
      this.verdict(t, Boolean(body.passed), String(body.note || ''), String(body.by || 'human'), body.rework ? String(body.rework) : undefined);
    } else if (action === 'retry' || action === 'reassign') {
      if (!['failed', 'cancelled', 'queued', 'verifying'].includes(t.status)) throw new Error(`任务是 ${t.status}，不能重来`);
      if (action === 'reassign') {
        if (!body.channel) throw new Error('改派要说派给哪个产品（channel）');
        const ch = String(body.channel);
        t.channel = ch === 'auto' ? '' : ch;
        t.auto = ch === 'auto' ? { candidates: Array.isArray(body.candidates) ? body.candidates.map(String) : t.auto?.candidates || [], excluded: [] } : undefined;
        t.waitingWhy = undefined;
        t.model = body.model ? String(body.model) : undefined;
        t.sessionName = `${t.sessionName.replace(/-r\d+$/, '')}-r${t.epoch + 1}`;
      }
      t.failedDispatches = 0;
      t.fuse = undefined;
      // A person's retry gives every product another chance.
      if (t.auto) t.auto.excluded = [];
      t.activeDispatchId = null;
      t.verifierDispatchId = null;
      this.setTask(t, this.depsDone(t) ? 'queued' : 'blocked', action, action === 'reassign' ? { channel: t.channel || 'auto', model: t.model } : undefined);
      if (g.status === 'fused') this.setGoal(g, 'running', `任务 ${t.key} ${action === 'retry' ? '重来' : '改派'}`);
    } else if (action === 'cancel') {
      this.setTask(t, 'cancelled', 'task_cancelled', { reason: body.reason || '人取消' });
    } else {
      throw new Error(`任务没有这个动作：${action}（verify、retry、reassign、cancel）`);
    }
    void this.step();
    return t;
  }

  // ---- the center's steps ----

  /** Called by the gateway whenever it saves a dispatch. */
  onDispatch(d: DispatchView): void {
    for (const t of this.tasks.values()) {
      if (t.activeDispatchId === d.id && t.status === 'dispatched') this.workerDispatchChanged(t, d);
      else if (t.verifierDispatchId === d.id && t.status === 'verifying') this.verifierDispatchChanged(t, d);
    }
  }

  /** One pass over the running goals: finish, stop, or dispatch whatever is ready. Safe to call any time. */
  async step(): Promise<void> {
    if (this.stepping) return;
    this.stepping = true;
    try {
      for (const g of this.goals.values()) {
        if (g.status !== 'running') continue;
        const tasks = this.tasksOf(g);
        for (const t of tasks) if (t.status === 'blocked' && this.depsDone(t)) this.setTask(t, 'queued', 'dependency_unblocked');
        if (tasks.every((t) => t.status === 'completed' || t.status === 'cancelled')) {
          this.setGoal(g, 'completed', '所有任务都过了验收');
          continue;
        }
        const failed = tasks.find((t) => t.status === 'failed');
        if (failed) {
          this.setGoal(g, 'fused', `任务 ${failed.key} 停下了：${failed.fuse || '失败'}`);
          continue;
        }
        if (Date.now() - Date.parse(g.createdAt) > g.budget.maxWallClockMs) {
          this.setGoal(g, 'paused', `超过时限 ${Math.round(g.budget.maxWallClockMs / 60000)} 分钟`);
          continue;
        }
        if (g.usage.sinceLastCompletion >= g.budget.maxStall) {
          this.setGoal(g, 'fused', `连续 ${g.usage.sinceLastCompletion} 次派活没有一个任务过验收（停滞）`);
          continue;
        }
        let running = tasks.filter((t) => t.status === 'dispatched' || (t.status === 'verifying' && t.verifierDispatchId)).length;
        // Checks that waited for a busy checker session.
        for (const t of tasks.filter((x) => x.status === 'verifying' && !x.verifierDispatchId && x.waitingWhy)) {
          if (running >= g.budget.maxParallel) break;
          if (await this.startVerify(t)) running++;
        }
        for (const t of tasks.filter((x) => x.status === 'queued')) {
          if (running >= g.budget.maxParallel) break;
          if (g.usage.dispatches >= g.budget.maxDispatches) {
            this.setGoal(g, 'paused', `派活次数用完（${g.budget.maxDispatches}）`);
            break;
          }
          if (await this.dispatchWorker(g, t)) running++;
        }
      }
    } finally {
      this.stepping = false;
    }
  }

  /** Why this session cannot take a new piece of work now (another task's dispatch or check is out to it, or a turn
   *  is running there), else null. */
  private sessionTaken(channel: string, sessionName: string, self: string): string | null {
    for (const o of this.tasks.values()) {
      if (o.id === self) continue;
      if (o.status === 'dispatched' && o.channel === channel && o.sessionName === sessionName) {
        return `会话 ${channel}/${sessionName} 正在做任务「${o.title}」，等它交回再派`;
      }
      if (o.status === 'verifying' && o.verifierDispatchId && o.verifyBy === `agent:${channel}` && `${o.sessionName}-verify` === sessionName) {
        return `会话 ${channel}/${sessionName} 正在验收任务「${o.title}」，等它验完再派`;
      }
    }
    return this.deps.sessionBusy?.(channel, sessionName) ? `会话 ${channel}/${sessionName} 有一轮正在跑，等它结束再派` : null;
  }

  /** Dispatch the task to its product (picking one first for an "auto" task). False when nothing went out. */
  private async dispatchWorker(g: GoalRecord, t: TaskRecord): Promise<boolean> {
    if (t.auto && !t.channel && !this.pick(t)) return false;
    // A named product that is on hold for now: wait, and say why (once per new reason).
    const hold = !t.auto ? this.deps.holdFor?.(t.channel) : null;
    if (hold) {
      if (t.waitingWhy !== hold) {
        t.waitingWhy = hold;
        this.log(t, 'waiting_for_channel', { why: hold });
      }
      return false;
    }
    // Sessions are shared across goals: one piece of work at a time, or a second task would be steered into the
    // first one's turn.
    const busy = this.sessionTaken(t.channel, t.sessionName, t.id);
    if (busy) {
      if (t.waitingWhy !== busy) {
        t.waitingWhy = busy;
        this.log(t, 'waiting_for_session', { why: busy });
      }
      return false;
    }
    t.waitingWhy = undefined;
    const upstream = t.dependsOn
      .map((k) => this.tasksOf(g).find((x) => x.key === k))
      .filter((x): x is TaskRecord => Boolean(x?.delivery))
      .map((x) => `- 前置任务「${x.title}」交回：${(x.delivery!.summary || x.delivery!.reply).slice(0, 1500)}${x.delivery!.files.length ? `\n  文件：${x.delivery!.files.join('，')}` : ''}`);
    const lines = [
      `这是目标「${g.title}」中的一个任务。`,
      `目标要做成：${g.objective}`,
      `你的任务：${t.title}`,
      t.goal !== t.title ? `说明：${t.goal}` : '',
      t.acceptance ? `验收标准：${t.acceptance}` : '',
      upstream.length ? `前置任务的结果：\n${upstream.join('\n')}` : '',
      t.verdict && !t.verdict.passed ? `上一次交回没过验收（第 ${t.reworkCount} 次返工）：${t.verdict.rework || t.verdict.note}` : '',
    ].filter(Boolean);
    t.epoch += 1;
    try {
      const d = await this.deps.dispatch({ toChannel: t.channel, toSessionName: t.sessionName, toModel: t.model, cwd: g.cwd, task: lines.join('\n') });
      t.activeDispatchId = d.id;
      t.dispatchHistory.push(d.id);
      g.usage.dispatches++;
      g.usage.sinceLastCompletion++;
      this.saveGoal(g);
      this.setTask(t, 'dispatched', 'dispatch_issued', { dispatchId: d.id, epoch: t.epoch, to: `${t.channel}/${t.sessionName}` });
      // The dispatch may already be over (a wait-mode gateway, or a fast failure).
      if (['completed', 'failed', 'stalled', 'cancelled'].includes(d.status)) this.workerDispatchChanged(t, d);
    } catch (e: any) {
      this.dispatchFailed(t, `派不出去：${e?.message || e}`);
    }
    return true;
  }

  /** The center's pick for an "auto" task; false (and why, logged once per new reason) when no product can take it now. */
  private pick(t: TaskRecord): boolean {
    const r = this.deps.pickChannel
      ? this.deps.pickChannel(t.auto!.candidates, t.auto!.excluded)
      : { channel: null, why: '中心没有接上选人（pickChannel）' };
    if (!r.channel) {
      if (t.waitingWhy !== r.why) {
        t.waitingWhy = r.why;
        this.log(t, 'waiting_for_channel', { why: r.why });
      }
      return false;
    }
    t.channel = r.channel;
    t.waitingWhy = undefined;
    this.log(t, 'channel_picked', { channel: r.channel, why: r.why });
    return true;
  }

  private workerDispatchChanged(t: TaskRecord, d: DispatchView) {
    if (d.status === 'completed' && d.delivery) {
      t.delivery = { at: d.delivery.at, summary: d.delivery.summary || '', reply: d.delivery.reply || '', files: d.delivery.files || [] };
      t.activeDispatchId = null;
      t.failedDispatches = 0;
      this.setTask(t, 'verifying', 'dispatch_delivered', { dispatchId: d.id, summary: t.delivery.summary.slice(0, 200), files: t.delivery.files });
      void this.startVerify(t);
    } else if (['failed', 'stalled', 'cancelled'].includes(d.status)) {
      t.activeDispatchId = null;
      this.dispatchFailed(t, `派活单 ${d.id} ${d.status}${d.error ? '：' + d.error : ''}`, d.failureKind);
    }
  }

  /**
   * A worker dispatch that did not hand back: try again once, then stop the task. An "auto" task tries again on
   * another product: the one that failed is left out of the next pick.
   */
  private dispatchFailed(t: TaskRecord, why: string, kind?: string) {
    // A used-up quota is the account's, not the task's: it does not count toward stopping the task. The task waits
    // (holdFor) until the account is back, or an "auto" task goes to another product.
    if (kind !== 'quota') t.failedDispatches++;
    if (t.auto && t.channel) {
      if (!t.auto.excluded.includes(t.channel)) t.auto.excluded.push(t.channel);
      t.channel = '';
    }
    if (t.failedDispatches >= 2) {
      t.fuse = `连续 ${t.failedDispatches} 次派活没交回：${why}`;
      this.setTask(t, 'failed', 'loop_fused', { level: 'dispatch', reason: t.fuse });
    } else {
      this.setTask(t, 'queued', 'dispatch_failed', { reason: why, ...(kind ? { kind } : {}) });
    }
    void this.step();
  }

  private async startVerify(t: TaskRecord): Promise<boolean> {
    const text = (t.delivery?.reply || t.delivery?.summary || '').trim();
    if (t.verifyBy === 'auto') {
      this.verdict(t, Boolean(text), text ? '自动：有交回' : '自动：交回是空的', 'auto', text ? undefined : '没有交回任何内容，请按任务要求完成后交回');
      return false;
    }
    if (!t.verifyBy.startsWith('agent:') || t.verifierDispatchId || this.verifyStarting.has(t.id)) return false; // 'human': wait for a person
    const g = this.mustGoal(t.goalId);
    if (g.usage.dispatches >= g.budget.maxDispatches) return false; // leave it for a person
    const channel = t.verifyBy.slice('agent:'.length);
    // The checker's session is shared too; step() tries again once it is free.
    const busy = this.sessionTaken(channel, `${t.sessionName}-verify`, t.id);
    if (busy) {
      if (t.waitingWhy !== busy) {
        t.waitingWhy = busy;
        this.log(t, 'waiting_for_session', { why: busy });
      }
      return false;
    }
    t.waitingWhy = undefined;
    this.verifyStarting.add(t.id);
    const task = [
      `请独立验收另一个智能体交回的工作。不要替它重做，只判断。`,
      `目标：${g.objective}`,
      `任务：${t.title}${t.goal !== t.title ? `（${t.goal}）` : ''}`,
      `验收标准：${t.acceptance || '完成了任务说的事，结果可信'}`,
      `它交回的内容：\n${text.slice(0, 6000)}`,
      t.delivery?.files.length ? `它说改动或产出的文件：${t.delivery.files.join('，')}（需要的话自己打开看）` : '',
      `交回时，第一行只写 PASS 或 FAIL，第二行起写理由；FAIL 时写清楚要怎么改。`,
    ].filter(Boolean);
    try {
      const d = await this.deps.dispatch({ toChannel: channel, toSessionName: `${t.sessionName}-verify`, cwd: g.cwd, task: lines(task) });
      t.verifierDispatchId = d.id;
      t.dispatchHistory.push(d.id);
      g.usage.dispatches++;
      this.saveGoal(g);
      this.saveTask(t);
      this.log(t, 'verify_dispatched', { dispatchId: d.id, by: channel });
      if (['completed', 'failed', 'stalled', 'cancelled'].includes(d.status)) this.verifierDispatchChanged(t, d);
      return true;
    } catch (e: any) {
      this.log(t, 'verify_dispatch_failed', { reason: String(e?.message || e) });
      return false;
    } finally {
      this.verifyStarting.delete(t.id);
    }
  }

  private verifierDispatchChanged(t: TaskRecord, d: DispatchView) {
    if (!['completed', 'failed', 'stalled', 'cancelled'].includes(d.status)) return;
    t.verifierDispatchId = null;
    const reply = String(d.delivery?.reply || d.delivery?.summary || '');
    const m = reply.match(/^\s*\**\s*(PASS|FAIL)\b[\s:：*]*(.*)$/im);
    if (d.status !== 'completed' || !m) {
      this.saveTask(t);
      this.log(t, 'verify_inconclusive', { dispatchId: d.id, status: d.status, reply: reply.slice(0, 200) });
      return; // a person decides
    }
    const rest = (m[2] + '\n' + reply.slice(reply.indexOf(m[0]) + m[0].length)).trim();
    this.verdict(t, m[1].toUpperCase() === 'PASS', rest.slice(0, 1000), t.verifyBy, m[1].toUpperCase() === 'FAIL' ? rest.slice(0, 1500) : undefined);
  }

  /** The verdict decides: pass → completed (downstream unblocks); fail → rework, unless a limit stops it. */
  private verdict(t: TaskRecord, passed: boolean, note: string, by: string, rework?: string) {
    const g = this.mustGoal(t.goalId);
    t.verdict = { at: now(), passed, note, by, rework };
    if (passed) {
      g.usage.sinceLastCompletion = 0;
      this.saveGoal(g);
      this.setTask(t, 'completed', 'verdict_passed', { by, note: note.slice(0, 200) });
      void this.step();
      return;
    }
    const reply = t.delivery?.reply || '';
    const same = t.previousReplies.length ? similarity(t.previousReplies[t.previousReplies.length - 1], reply) : 0;
    t.previousReplies = [...t.previousReplies, reply].slice(-3);
    t.reworkCount++;
    if (same >= SAME_REPLY) {
      t.fuse = `返工后交回的内容和上次几乎一样（相似度 ${same.toFixed(2)}），再返工也不会变`;
      this.setTask(t, 'failed', 'loop_fused', { level: 'same-reply', similarity: same, by });
    } else if (t.reworkCount > g.budget.maxRework) {
      t.fuse = `返工 ${t.reworkCount - 1} 次仍没过验收（上限 ${g.budget.maxRework}）`;
      this.setTask(t, 'failed', 'loop_fused', { level: 'rework-limit', by, note: note.slice(0, 200) });
    } else {
      this.setTask(t, 'queued', 'rework_requested', { by, rework: (rework || note).slice(0, 300), round: t.reworkCount });
    }
    void this.step();
  }

  // ---- storage ----

  private depsDone(t: TaskRecord): boolean {
    const g = this.goals.get(t.goalId);
    const sibs = g ? this.tasksOf(g) : [];
    return t.dependsOn.every((k) => sibs.find((x) => x.key === k)?.status === 'completed');
  }

  private assertAcyclic(items: Array<{ key: string; dependsOn: string[] }>) {
    const deps = new Map(items.map((i) => [i.key, i.dependsOn]));
    const state = new Map<string, 1 | 2>();
    const visit = (k: string, path: string[]) => {
      if (state.get(k) === 2) return;
      if (state.get(k) === 1) throw new Error(`任务依赖成环：${[...path, k].join(' → ')}`);
      state.set(k, 1);
      for (const d of deps.get(k) || []) visit(d, [...path, k]);
      state.set(k, 2);
    };
    for (const i of items) visit(i.key, []);
  }

  private mustGoal(id: string): GoalRecord {
    const g = this.goals.get(id);
    if (!g) throw new Error(`没有这个目标：${id}`);
    return g;
  }

  private mustTask(id: string): TaskRecord {
    const t = this.tasks.get(id);
    if (!t) throw new Error(`没有这个任务：${id}`);
    return t;
  }

  private setGoal(g: GoalRecord, status: GoalStatus, reason: string, detail?: any) {
    g.status = status;
    g.reason = reason;
    g.history.push({ at: now(), action: `goal_${status}`, detail: { reason, ...(detail || {}) } });
    this.saveGoal(g);
  }

  private setTask(t: TaskRecord, status: TaskStatus, action: string, detail?: any) {
    t.status = status;
    this.log(t, action, detail);
  }

  private log(t: TaskRecord, action: string, detail?: any) {
    t.history.push({ at: now(), action, ...(detail ? { detail } : {}) });
    this.saveTask(t);
    const g = this.goals.get(t.goalId);
    if (g) this.deps.changed?.(g);
  }

  private saveGoal(g: GoalRecord) {
    g.updatedAt = now();
    this.goals.set(g.id, g);
    writeAtomic(join(this.goalsDir, `${g.id}.json`), g);
    this.deps.changed?.(g);
  }

  private saveTask(t: TaskRecord) {
    t.updatedAt = now();
    this.tasks.set(t.id, t);
    writeAtomic(join(this.tasksDir, `${t.id}.json`), t);
  }
}

function lines(xs: string[]) {
  return xs.join('\n');
}

function writeAtomic(file: string, data: unknown) {
  const tmp = `${file}.tmp`;
  try {
    writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
    try {
      renameSync(tmp, file);
    } catch {
      writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
    }
  } catch {}
}

