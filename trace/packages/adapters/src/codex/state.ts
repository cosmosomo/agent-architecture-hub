/**
 * Session state from the parsed records and the file's last write time.
 * The records cannot tell a long command from a dead process; an open turn
 * that has not been written for `staleMs` is reported as stale, not as working.
 */
import type { Iso, Session, SessionState, ToolStep } from '@hub-trace/contract';

export const STALE_MS = 30 * 60 * 1000;

export type StateInput = {
  now: number;
  mtimeMs?: number;
  staleMs?: number;
  /** Tool calls still waiting for output. */
  openTools: ToolStep[];
};

function state(status: SessionState['status'], since: Iso | undefined, detail: string): SessionState {
  return since ? { status, since, detail } : { status, detail };
}

function span(ms: number): string {
  const min = Math.round(ms / 60000);
  if (min < 120) return min + ' 分钟';
  const h = Math.round(min / 60);
  return h < 48 ? h + ' 小时' : Math.round(h / 24) + ' 天';
}

export function detectState(s: Session, input: StateInput): SessionState {
  const last = s.turns[s.turns.length - 1];
  if (!last) return state('empty', s.updatedAt, '还没有任何一轮');
  const ended = last.endedAt || s.updatedAt;
  switch (last.status) {
    case 'completed':
      return state('idle', ended, '这一轮已完成，等下一条输入');
    case 'aborted':
      return state('aborted', ended, last.error || '被打断');
    case 'failed':
      return state('failed', ended, last.error || '出错');
    case 'running': {
      const since = s.updatedAt || last.startedAt;
      const touched = input.mtimeMs ?? (s.updatedAt ? Date.parse(s.updatedAt) : NaN);
      const age = Number.isFinite(touched) ? input.now - touched : Infinity;
      if (age > (input.staleMs ?? STALE_MS)) {
        return state('stale', since, Number.isFinite(age) ? '进行中的一轮已经 ' + span(age) + '没有新记录，进程可能已经退出' : '进行中的一轮没有时间信息');
      }
      const open = input.openTools.filter((t) => last.steps.includes(t));
      const waiting = open.find((t) => t.name === 'wait_agent' || t.name === 'wait');
      if (waiting) return state('waiting', waiting.at || since, '在等子智能体');
      const tool = open[open.length - 1];
      if (tool) return state('working', tool.at || since, '在执行 ' + tool.name);
      const step = last.steps[last.steps.length - 1];
      return state('working', since, step?.kind === 'model' ? '在生成回复' : '在等模型回复');
    }
  }
}
