import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, renameSync } from 'node:fs';
import type { AgentGatewayHub } from '../gateway.ts';
import type { ActiveRun, PendingApproval } from './types.ts';

const gate = createRequire(import.meta.url)('../../../../../hub/tools/security_gate.cjs');

export type SecurityMode = 'full' | 'workspace' | 'readonly' | 'reads' | 'deny';

export type SecurityRequest = {
  product: string;
  session: string;
  task?: string;
  action: string;
  target: string;
  cwd: string;
  mode?: string;
  paths?: string[];
  layer?: string;
  /** Goes to a person whatever the rules say: leaving plan mode is the plan waiting for a yes. */
  askPerson?: boolean;
};

const scopes = new WeakMap<AgentGatewayHub, Map<string, string>>();

function signature(q: SecurityRequest) {
  return JSON.stringify([q.product, q.session, q.task, q.action, q.target, q.mode, q.cwd]);
}

export function normalizeSecurityMode(mode?: string, permissions?: string): SecurityMode {
  if (mode !== undefined && mode !== '') {
    return gate.modeName(mode);
  }
  // The old --permissions values keep their old meaning (policy modes reads, deny): reads allows reading and asks for
  // the rest, deny refuses everything. Folding both into readonly let shell through and denied writes unasked (10-20).
  if (permissions === 'deny' || permissions === 'reads') {
    return permissions;
  }
  return gate.modeName(undefined);
}

export function toolRequest(run: ActiveRun, name: string, input: any, kind?: string): SecurityRequest {
  const paths: string[] = [];
  const walk = (value: any, key = '') => {
    if (Array.isArray(value)) value.forEach((v) => walk(v, key));
    else if (value && typeof value === 'object') Object.entries(value).forEach(([k, v]) => walk(v, k));
    else if (typeof value === 'string' && /^(path|file_path|filePath|target_file|file|filename|cwd|directory|uri)$/i.test(key)) paths.push(value);
  };
  walk(input);
  // A tool none of these name is treated as a write: under a restricting mode an unknown tool must not pass as a read
  // (10-20: Codex's FileChange did, so a write slipped through readonly).
  const said = name + ' ' + (kind || '');
  const action = /shell|bash|exec|terminal|command/i.test(said) ? 'shell.run' :
    /edit|write|patch|delete|remove|create|move|rename|change|apply|replace|insert|update|save|mkdir/i.test(said) ? 'file.write' :
    /fetch|web|net|url/i.test(said) ? 'net' :
    /mode/i.test(said) ? 'mode.switch' :
    /read|view|list|ls\b|glob|grep|search|find|get|stat|open|cat\b|think/i.test(said) ? 'file.read' : 'file.write';
  const target = action === 'shell.run' ? (typeof input === 'string' ? input : JSON.stringify(input)) : (paths[0] || name);
  return {
    product: run.channel,
    session: run.sessionName,
    task: run.runId,
    action,
    target,
    paths,
    cwd: run.cwd,
    mode: run.securityMode,
    layer: 'L1-tool',
  };
}

export const securityMethods = {
  async securityCheck(this: AgentGatewayHub, q: SecurityRequest, run?: ActiveRun): Promise<boolean> {
    let result: { decision: string; rule: string; mode: string };
    if (q.askPerson) {
      result = { decision: 'ask', rule: 'plan-exit-asks-person', mode: gate.modeName(q.mode) };
      gate.audit(q, result);
    } else result = gate.judge(q);
    if (result.decision !== 'ask') return result.decision === 'allow';

    const remembered = scopes.get(this)?.get(signature(q));
    if (remembered) {
      gate.audit(q, { decision: 'allow', rule: remembered, mode: result.mode });
      return true;
    }

    const id = 'security_' + crypto.randomUUID();
    const item: PendingApproval = {
      id,
      runId: run?.runId || id,
      channel: q.product as any,
      sessionName: q.session,
      traceSessionId: run?.traceSessionId,
      cwd: q.cwd,
      model: run?.model || '',
      prompt: run?.prompt || '',
      toolName: q.action,
      toolInput: q.target,
      reason: `安全规则 ${result.rule} 要求批准：${q.action}（${q.target || ''}，批准不升级权限）`,
      createdAt: new Date().toISOString(),
      status: 'pending',
      inTurn: true,
      mode: 'in-turn',
      securityRequest: q,
    };

    this.pendingApprovals.unshift(item);
    if (this.pendingApprovals.length > 20) this.pendingApprovals.pop();
    if (run) run.waitingApprovalId = id;
    this.broadcast('state', this.getState());

    return new Promise<boolean>((resolve) => {
      const timer = setTimeout(() => {
        this.liveApprovalResolvers.delete(id);
        const appr = this.pendingApprovals.find((a) => a.id === id);
        if (appr?.status === 'pending') appr.status = 'rejected';
        gate.audit(q, { decision: 'deny', rule: 'approval-timeout', mode: result.mode });
        this.broadcast('state', this.getState());
        resolve(false);
      }, 600_000);
      timer.unref();

      this.liveApprovalResolvers.set(id, {
        runId: run?.runId || id,
        channel: q.product as any,
        resolve: (allow) => {
          clearTimeout(timer);
          gate.audit(q, { decision: allow ? 'allow' : 'deny', rule: `approval:${id}`, mode: result.mode });
          resolve(allow);
        },
      });
    });
  },

  rememberSecurityApproval(this: AgentGatewayHub, q: SecurityRequest, scope: string) {
    if (scope === 'session') {
      let entries = scopes.get(this);
      if (!entries) scopes.set(this, (entries = new Map()));
      entries.set(signature(q), 'session-approval');
    } else if (scope === 'always') {
      const p = JSON.parse(readFileSync(gate.policyFile, 'utf8'));
      p.rules.unshift({ action: q.action, who: { product: q.product }, target: q.target, decision: 'allow' });
      const temporary = gate.policyFile + '.' + crypto.randomUUID() + '.tmp';
      writeFileSync(temporary, JSON.stringify(p, null, 2) + '\n');
      renameSync(temporary, gate.policyFile);
    } else if (scope !== 'once') {
      throw new Error(`未知审批范围: ${scope}`);
    }
  },
};
