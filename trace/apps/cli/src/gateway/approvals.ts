/**
 * A person's answer inside a turn: approvals (resolveApproval) and questions an agent asks (askPerson, answerQuestion).
 * Mixed into AgentGatewayHub (gateway.ts); `this` is the hub.
 */
import type { AgentGatewayHub } from '../gateway.ts';
import type { ActiveRun, PendingQuestion } from './types.ts';

export const approvalMethods = {
  /** Interactive Approval Gate: Approve or reject a pending tool/permission request in the Control Room. */
  async resolveApproval(this: AgentGatewayHub, params: {
    id: string;
    decision: 'approve' | 'reject';
    customHint?: string;
  }) {
    const item = this.pendingApprovals.find((a) => a.id === params.id && a.status === 'pending');
    if (!item) {
      throw new Error(`未找到待审批项或已处理: ${params.id}`);
    }
    item.status = params.decision === 'approve' ? 'approved' : 'rejected';

    // 1. Live in-turn approval (Codex app-server or Claude stream-json suspended mid-turn)
    const liveResolver = this.liveApprovalResolvers.get(item.id);
    if (liveResolver) {
      this.liveApprovalResolvers.delete(item.id);
      liveResolver.resolve(params.decision === 'approve');
      const slot = this.slotKey(item.channel, item.sessionName);
      const activeRun = this.activeRuns.get(slot);
      if (activeRun && activeRun.waitingApprovalId === item.id) {
        activeRun.waitingApprovalId = undefined;
        this.broadcast('run_update', activeRun);
      }
      this.recordMetaAction(
        'meta_approver',
        item.channel,
        item.sessionName,
        params.decision === 'approve' ? '轮内原位批准放行' : '轮内原位驳回拦截',
        params.decision === 'approve'
          ? `已在当前轮次内原位放行会话 ${item.sessionName} 执行 ${item.toolName}（当轮继续，无需重开新轮次）`
          : `已在当前轮次内原位驳回会话 ${item.sessionName} 的工具操作 (${item.toolName})`,
      );
      this.broadcast('state', this.getState());
      return {
        ok: true,
        id: item.id,
        status: item.status,
        action: params.decision === 'approve' ? 'approved-in-turn' : 'rejected-in-turn',
        inTurn: true,
        mode: 'in-turn',
        runId: item.runId,
        run: activeRun || null,
      };
    }

    this.broadcast('state', this.getState());

    if (params.decision === 'reject') {
      this.recordMetaAction(
        'meta_approver',
        item.channel,
        item.sessionName,
        '人工驳回权限请求',
        `已拦截会话 ${item.sessionName} 的工具操作 (${item.toolName})`,
      );
      return { ok: true, id: item.id, status: 'rejected', inTurn: false, mode: 'session-retry' };
    }

    this.recordMetaAction(
      'meta_approver',
      item.channel,
      item.sessionName,
      '批准权限并续跑',
      `已批准会话 ${item.sessionName} 执行 ${item.toolName}，升级为全权限 (--approve-all) 继续执行`,
    );

    const resumePrompt =
      (params.customHint || '').trim() ||
      `已批准你的权限请求（工具：${item.toolName}），现已开启全读写与命令执行权限 (--approve-all)，请继续完成刚才的操作（原任务：${item.prompt.slice(0, 180)}）。`;

    const res = await this.sendPrompt({
      channel: item.channel,
      sessionName: item.sessionName,
      traceSessionId: item.traceSessionId,
      cwd: item.cwd,
      model: item.model,
      prompt: resumePrompt,
      permissions: 'all',
      mode: 'send',
      source: 'web',
      resumedByMeta: 'meta_approver',
    });

    return {
      ok: true,
      id: item.id,
      status: 'approved',
      inTurn: false,
      mode: 'session-retry',
      run: res.run,
    };
  },

  /**
   * An agent asks a person something mid-turn (unit ask-user): the question is held as a pending question (in
   * getState, and on the run as waitingQuestionId) and the turn waits until answerQuestion, or the run is cancelled
   * (resolves null). Asking is never a permission, so it reaches the person whatever the run's permissions.
   */
  askPerson(this: AgentGatewayHub, run: ActiveRun, questions: PendingQuestion['questions']): Promise<Record<string, string[]> | null> {
    const id = `q_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    this.pendingQuestions.unshift({
      id,
      runId: run.runId,
      channel: run.channel,
      sessionName: run.sessionName,
      traceSessionId: run.traceSessionId,
      questions,
      createdAt: new Date().toISOString(),
      status: 'pending',
    });
    if (this.pendingQuestions.length > 20) this.pendingQuestions.pop();
    run.waitingQuestionId = id;
    (run.warnings ||= []).push(`轮内等人回答：${questions.map((q) => q.question).join(' / ').slice(0, 120)}`);
    this.broadcast('run_update', run);
    this.broadcast('state', this.getState());
    return new Promise((resolve) => {
      this.liveQuestionResolvers.set(id, { runId: run.runId, resolve });
    });
  },

  /** The person's answer: by question id, one or more choices or free text each. A single answer fills every question. */
  answerQuestion(this: AgentGatewayHub, params: { id: string; answers?: Record<string, string | string[]>; answer?: string }) {
    const q = this.pendingQuestions.find((x) => x.id === params.id);
    const live = this.liveQuestionResolvers.get(params.id);
    if (!q || q.status !== 'pending' || !live) throw new Error(`没有在等回答的问题：${params.id}`);
    const answers: Record<string, string[]> = {};
    for (const item of q.questions) {
      const v = params.answers?.[item.id] ?? params.answers?.[item.question] ?? params.answer;
      if (v === undefined || v === null || (Array.isArray(v) ? !v.length : !String(v).trim())) {
        throw new Error(`问题「${item.question.slice(0, 40)}」还没有答案`);
      }
      answers[item.id] = (Array.isArray(v) ? v : [v]).map(String);
    }
    q.status = 'answered';
    q.answers = answers;
    this.liveQuestionResolvers.delete(params.id);
    const run = this.recentRunById(q.runId);
    if (run && run.waitingQuestionId === q.id) run.waitingQuestionId = undefined;
    live.resolve(answers);
    if (run) this.broadcast('run_update', run);
    this.broadcast('state', this.getState());
    return { ok: true, id: q.id, answers };
  },

  /** The active run with this id, if it is still running. */
  recentRunById(this: AgentGatewayHub, runId: string): ActiveRun | undefined {
    for (const r of this.activeRuns.values()) if (r.runId === runId) return r;
    return undefined;
  },
};
