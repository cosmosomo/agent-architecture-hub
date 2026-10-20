/**
 * Why a turn failed, decided once when it ends (finalizeRun sets run.failureKind) and read by everyone who acts on a
 * failure: the breaker and quota accounts (capacity.ts), the automatic retry (finalizeRun's resumer), and the
 * dispatch and task board above it (collab.ts, collab/taskboard.ts). Before 10-19 each of them judged the error text
 * with its own pattern, and they disagreed (a quota error the breaker knew was retried by the resumer, a timeout was
 * retried for another hour).
 */
import type { ActiveRun } from './types.ts';
import { UPSTREAM_ERROR_REPLY } from './common.ts';

export type FailureKind =
  /** The account's quota or rate is used up: wait for the reset, or use another account. */
  | 'quota'
  /** The turn ran out its time limit. Trying again waits the whole limit again. */
  | 'timeout'
  /** A tool the permission policy refused; the agent then stopped. */
  | 'permission'
  /** The model refused, or the product wants a sign-in the client cannot give. */
  | 'refusal'
  /** The session could not be set up, so nothing was sent. */
  | 'setup'
  /** The model's upstream channel is down (5xx, no available channel): another model may work. */
  | 'upstream'
  /** The connection to the model dropped. */
  | 'network'
  /** The turn ended without a word or a tool. */
  | 'empty'
  /** The process or stream ended before the turn's own result came. */
  | 'broken'
  | 'other';

export const FAILURE_LABEL: Record<FailureKind, string> = {
  quota: '额度用完',
  timeout: '超时',
  permission: '权限被拒',
  refusal: '模型拒绝',
  setup: '会话没建起来',
  upstream: '上游渠道出错',
  network: '网络断开',
  empty: '空回复',
  broken: '中途断开',
  other: '其他',
};

/** A failure that says the account's quota or rate is used up: another try only hits the same wall. */
export function isQuotaError(text: string): boolean {
  return /\b429\b|\b1308\b|quota|rate.?limit|usage limit|out of credits|insufficient[ _](?:credits|balance|quota)|credit balance|余额不足|速率限制|额度|配额|使用上限|用量上限/i.test(text);
}

/** The kind of a failed turn, from what the run recorded and the error's words. First match wins. */
export function classifyFailure(run: Pick<ActiveRun, 'error' | 'stopReason' | 'setupFailed' | 'deniedTools' | 'text' | 'tools'>): FailureKind {
  const err = String(run.error || '');
  if (isQuotaError(err)) return 'quota';
  if (/timeout waiting for turn|秒没结束|内没有在 transcript 里写出最终回复/i.test(err)) return 'timeout';
  if (run.deniedTools?.length) return 'permission';
  if (run.setupFailed) return 'setup';
  if (run.stopReason === 'refusal' || /\brefusal\b|拒绝回答|OAuth/i.test(err)) return 'refusal';
  if (UPSTREAM_ERROR_REPLY.test(err) || /overloaded|model_not_found|\b50[234]\b/i.test(err)) return 'upstream';
  if (/ECONNRESET|ETIMEDOUT|ECONNREFUSED|socket hang up|fetch failed|Connection (dropped|error)|stream was interrupted|\bEOF\b/i.test(err)) return 'network';
  if (/什么都没回/.test(err) || (!String(run.text || '').trim() && !run.tools?.length && run.stopReason)) return 'empty';
  if (!run.stopReason) return 'broken';
  return 'other';
}
