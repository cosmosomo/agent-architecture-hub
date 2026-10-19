/**
 * One turn on a product the center reaches only through its desktop UI (route opencli: Doubao). The driver itself is
 * hub/tools/agent_gateway.js's opencli path, written and hardened by the UI-route researcher (10-19): it starts a
 * windowless background Doubao on its CDP port when the port is down, asks through opencli, and reads the reply back.
 * The center runs it with --standalone, one process per turn, and reads its JSON — one driver, not two copies.
 * Mixed into AgentGatewayHub (gateway.ts); `this` is the hub.
 * User 10-20: “能不能像你调用antigravity一样，以后整个系统和所有智能体都可以轻松调用豆包了？”
 */
import type { AgentGatewayHub } from '../gateway.ts';
import { spawn } from 'node:child_process';
import { unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import type { RunOpts, ActiveRun } from './types.ts';
import { agentBaseEnv } from './products.ts';

const REPO_ROOT = resolve(import.meta.dirname, '..', '..', '..', '..', '..');
const GATEWAY_CLI = join(REPO_ROOT, 'hub', 'tools', 'agent_gateway.js');
/** How long one answer may take (opencli's own wait; the process gets 30 s more). */
const TURN_SEC = 600;

/** The CLI prints one JSON object (pretty-printed) on stdout, or on stderr when it refuses before running. */
function lastJson(text: string): any {
  const t = text.trim();
  const i = t.indexOf('{');
  if (i < 0) return null;
  try {
    return JSON.parse(t.slice(i));
  } catch {
    return null;
  }
}

export const opencliRunMethods = {
  startOpencliRun(this: AgentGatewayHub, run: ActiveRun, opts: RunOpts): ActiveRun {
    const { prof, sessionName, prompt } = opts;
    const key = this.slotKey(prof.id, sessionName);
    // The prompt goes through a file: dispatch prompts are long and full of quotes.
    const promptFile = join(tmpdir(), `opencli-prompt-${run.runId}.txt`);
    writeFileSync(promptFile, prompt, 'utf8');
    const child = spawn(
      process.execPath,
      [GATEWAY_CLI, 'run', '--agent', prof.id, '--standalone', '--session', sessionName, '--file', promptFile, '--timeout', String(TURN_SEC)],
      { cwd: REPO_ROOT, env: agentBaseEnv(), windowsHide: true },
    );
    this.activeProcs.set(key, child);
    let out = '';
    let err = '';
    child.stdout.on('data', (c: Buffer) => (out += c.toString('utf8')));
    child.stderr.on('data', (c: Buffer) => (err += c.toString('utf8')));
    const timer = setTimeout(() => child.kill(), (TURN_SEC + 30) * 1000);
    child.on('close', (code) => {
      clearTimeout(timer);
      try {
        unlinkSync(promptFile);
      } catch {}
      if (run.status === 'cancelling' || run.status === 'aborted') {
        run.status = 'aborted';
      } else {
        const r = lastJson(out) || lastJson(err);
        const reply = typeof r?.reply === 'string' ? r.reply.trim() : '';
        if (r?.ok && reply) {
          run.text = reply;
          run.status = 'completed';
        } else {
          run.status = 'failed';
          run.error =
            (typeof r?.error === 'string' ? r.error : r?.error?.message) ||
            r?.message ||
            (err || out).trim().slice(-500) ||
            `opencli 驱动退出码 ${code}`;
        }
      }
      this.finalizeRun(run, opts);
    });
    return run;
  },
};
