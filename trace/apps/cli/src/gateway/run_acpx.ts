/**
 * One turn through acpx (route acpx; also the fallback of acp-resident), and the ACP frame parser every ACP route shares.
 * Mixed into AgentGatewayHub (gateway.ts); `this` is the hub.
 */
import type { AgentGatewayHub } from '../gateway.ts';
import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { RunOpts, LiveToolCall, ActiveRun } from './types.ts';
import { agentBaseEnv, claudeGlobalInstructions, ACPX_CLI } from './products.ts';
import { ACPX_TURN_TIMEOUT_SEC, UPSTREAM_ERROR_REPLY, classifyTool, quoteWinArg } from './common.ts';

export const acpxRunMethods = {
  /** One turn through acpx: `sessions ensure`, then `prompt`, one process per turn. */
  startAcpxRun(this: AgentGatewayHub, run: ActiveRun, opts: RunOpts): ActiveRun {
    const { prof, sessionName, cwd, prompt, model, permissions } = opts;
    const key = this.slotKey(prof.id, sessionName);
    const env = { ...agentBaseEnv(), ...prof.buildEnv() };
    const permFlag =
      permissions === 'all'
        ? '--approve-all'
        : permissions === 'deny'
        ? '--deny-all'
        : '--approve-reads';

    // Whether acpx already has this session. Only a session that does not exist yet makes a failed ensure fatal.
    const existedBefore = this.listAcpxSessions().some(
      (s) => s.channel === prof.id && s.sessionName === sessionName && Boolean(s.fromAcpxStore),
    );

    // A session this family wrote on its own (desktop app, its CLI) is addressed by its trace id "<traceKind>:<id>".
    // Taking it over means binding the acpx name to that same agent session, not starting a fresh one beside it
    // (the "read and control are two identities" problem, evaluation R3).
    const nativeId =
      !existedBefore && opts.traceSessionId?.startsWith(prof.traceKind + ':') ? opts.traceSessionId.slice(prof.traceKind.length + 1) : '';

    // A new Claude session gets the user's global instructions appended to its system prompt (set once, when acpx
    // creates the session; an existing session keeps what it has).
    const appendPrompt = prof.id === 'claude' && !existedBefore && existsSync(ACPX_CLI) ? claudeGlobalInstructions() : '';

    // Ensure session asynchronously then stream prompt
    const ensureArgs = [
      '--format',
      'json',
      '--cwd',
      cwd,
      ...(model ? ['--model', model] : []),
      ...(appendPrompt ? ['--append-system-prompt', appendPrompt] : []),
      prof.acpxAgent,
      'sessions',
      'ensure',
      '--name',
      sessionName,
      ...(nativeId ? ['--resume-session', nativeId] : []),
    ];
    const ensureCmd = ['acpx', ...ensureArgs.map(quoteWinArg)].join(' ');

    const ensureProc = spawn(existsSync(ACPX_CLI) ? process.execPath : 'cmd.exe', existsSync(ACPX_CLI) ? [ACPX_CLI, ...ensureArgs] : ['/d', '/s', '/c', ensureCmd], {
      cwd,
      env,
      // acpx sessions ensure blocks until stdin hits EOF when stdin is a pipe (measured 2026-10-17:
      // 200 s with an open pipe vs 12 s closed), which stalled every first turn sent from the page.
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });

    ensureProc.stdout.on('data', (chunk: Buffer) => {
      this.parseNdjsonChunk(run, chunk.toString('utf8'));
    });
    let ensureErr = '';
    ensureProc.stderr.on('data', (chunk: Buffer) => {
      ensureErr += chunk.toString('utf8');
    });

    ensureProc.on('close', (ensureCode) => {
      if (run.status !== 'running') return;
      // A failed ensure used to fall through to the prompt, whose "No acpx session found" then replaced
      // the real reason (OpenCode 2026-10-18: the requested model was not one the agent advertised).
      // For a session that already exists the failure is only a warning: Hermes reported "No LLM provider
      // configured" while reloading an existing session, yet the prompt that followed answered correctly.
      if (ensureCode !== 0 && !existedBefore) {
        run.setupFailed = true;
        run.status = 'failed';
        const reason = run.warnings?.[run.warnings.length - 1] || ensureErr.trim() || `acpx 退出码 ${ensureCode}`;
        run.error = `建会话失败：${reason}`;
        this.finalizeRun(run, opts);
        return;
      }

      const promptArgs = [
        '--format',
        'json',
        permFlag,
        '--timeout',
        String(ACPX_TURN_TIMEOUT_SEC),
        '--cwd',
        cwd,
        ...(model ? ['--model', model] : []),
        prof.acpxAgent,
        'prompt', '-s', sessionName, '-f', '-',
      ];
      const runCmd = ['acpx', ...promptArgs.map(quoteWinArg)].join(' ');

      const child = spawn(
        existsSync(ACPX_CLI) ? process.execPath : 'cmd.exe',
        existsSync(ACPX_CLI) ? [ACPX_CLI, ...promptArgs] : ['/d', '/s', '/c', runCmd],
        {
          cwd,
          env,
          windowsHide: true,
        },
      );

      this.activeProcs.set(key, child);

      // Write prompt to stdin: plain text, or an ACP content-block array when pictures came with it.
      try {
        const pics = this.promptImages.get(prompt);
        if (pics) this.promptImages.delete(prompt);
        child.stdin.write(pics ? JSON.stringify([{ type: 'text', text: prompt }, ...pics]) : prompt, 'utf8');
        child.stdin.end();
      } catch {}

      let stdoutBuf = '';
      child.stdout.on('data', (chunk: Buffer) => {
        stdoutBuf += chunk.toString('utf8');
        const lines = stdoutBuf.split(/\r?\n/);
        stdoutBuf = lines.pop() || '';
        for (const line of lines) {
          if (line.trim()) this.handleAcpxLine(run, line.trim());
        }
      });

      let stderrBuf = '';
      child.stderr.on('data', (chunk: Buffer) => {
        stderrBuf += chunk.toString('utf8');
      });

      // Poll acpx session file every 600ms while running to catch live Thinking / ToolUse updates
      const pollTimer = setInterval(() => {
        this.syncFromAcpxSessionFile(run);
      }, 600);

      child.on('close', async (code) => {
        clearInterval(pollTimer);
        if (stdoutBuf.trim()) this.handleAcpxLine(run, stdoutBuf.trim());
        if (run.channel === 'hermes') this.hermesCache = null;
        this.syncFromAcpxSessionFile(run);

        if (run.status === 'cancelling' || run.status === 'aborted') {
          run.status = 'aborted';
        } else {
          const outcome = this.judgeAcpxTurn(run, code, stderrBuf);
          run.status = outcome.status;
          if (outcome.error) run.error = outcome.error;
        }

        this.finalizeRun(run, opts);
      });
    });

    return run;
  },

  /**
   * How an acpx turn ended. The turn's own prompt result decides. Errors from other requests in the same
   * stream (reloading an old backend session, applying a model) are kept as warnings: Hermes answered
   * correctly on 2026-10-17 but one of those errors marked the turn failed and set off two retries.
   * WorkBuddy's bridge reports stopReason "cancelled" even for a normal reply, so a cancelled turn that did
   * reply counts as done; one that was cancelled after a tool was refused says which tool.
   */
  judgeAcpxTurn(this: AgentGatewayHub, run: ActiveRun, code: number | null, stderr: string): { status: 'completed' | 'failed'; error?: string } {
    // A refused tool with no reply: name the tool. WorkBuddy's own note ("Permission denied for tool(s):
    // unknown") does not say which tool it was, so it only follows in brackets.
    if (run.deniedTools?.length && !run.text.trim()) {
      const tools = run.deniedTools.slice(-3).join('；');
      const own = run.error ? `（智能体的原话：${run.error}）` : '';
      return {
        status: 'failed',
        error: `权限被拒：${tools}。当前权限不允许这个操作，智能体随后结束了这一轮，没有回复。需要的话，允许后重新发送。${own}`,
      };
    }
    if (run.error) return { status: 'failed', error: run.error }; // refusal or an error the agent attached to its result
    const stop = run.stopReason;
    // After its retries run out Codex prints the upstream error as the reply and still ends with end_turn
    // (seen 2026-10-18: "unexpected status 503 Service Unavailable: No available channel for model ...").
    if (run.upstreamErrors && UPSTREAM_ERROR_REPLY.test(run.text)) {
      return { status: 'failed', error: `上游模型渠道出错，Codex 重试 ${run.upstreamErrors} 次后放弃：${run.text.trim().slice(0, 200)}` };
    }
    if (stop === 'end_turn' || stop === 'max_tokens' || stop === 'max_turn_requests') return { status: 'completed' };
    if (stop === 'cancelled') {
      if (run.text.trim()) return { status: 'completed' };
      return { status: 'failed', error: '智能体取消了这一轮，没有回复' };
    }
    if (stop === 'refusal') return { status: 'failed', error: '模型拒绝回答（stopReason: refusal）' };
    // No result for this turn's prompt: the process ended before the agent answered.
    const last = run.warnings?.[run.warnings.length - 1];
    if (code !== 0 || !run.text) return { status: 'failed', error: last || stderr.trim() || `进程退出码 ${code}` };
    return { status: 'completed' };
  },

  parseNdjsonChunk(this: AgentGatewayHub, run: ActiveRun, chunk: string) {
    for (const line of chunk.split(/\r?\n/)) {
      if (line.trim()) this.handleAcpxLine(run, line.trim());
    }
  },

  handleAcpxLine(this: AgentGatewayHub, run: ActiveRun, line: string) {
    let obj: any;
    try {
      obj = JSON.parse(line);
    } catch {
      // Plain text fallback
      if (!line.startsWith('{')) {
        run.text += (run.text ? '\n' : '') + line;
        this.broadcast('run_update', run);
      }
      return;
    }
    this.handleAcpFrame(run, obj);
  },

  /** One ACP frame of a turn, from acpx's `--format json` output or from a resident bridge. */
  handleAcpFrame(this: AgentGatewayHub, run: ActiveRun, obj: any) {
    try {
      if (obj.acpxSessionId || obj.acpxRecordId) {
        const linked = this.listAcpxSessions().find(
          (s) => s.acpxRecordId === obj.acpxRecordId || s.acpSessionId === obj.acpxSessionId,
        );
        if (linked) run.traceSessionId = linked.traceSessionId;
      }
      if (obj.method === 'session/update' && obj.params?.update) {
        this.markRunSeenByDispatch(run);
        const u = obj.params.update;
        const kind = u.sessionUpdate;
        if (kind === 'agent_thought_chunk' && u.content?.text) {
          run.thoughts += u.content.text;
          this.broadcast('run_update', run);
        } else if (kind === 'agent_message_chunk' && u.content?.text) {
          // The stream and the session-file poll each see the whole reply; keep them apart and show the
          // longer one, instead of appending onto text the poll already filled in (reply came out doubled).
          run.streamText = (run.streamText || '') + u.content.text;
          if (run.streamText.length > run.text.length) run.text = run.streamText;
          this.broadcast('run_update', run);
        } else if (kind === 'tool_call' || kind === 'tool_call_update') {
          const tid = String(u.toolCallId || u.id || `tc_${run.tools.length + 1}`);
          const rawName = String(u.title || u.name || u.toolName || 'tool');
          const inStr =
            typeof u.rawInput === 'string'
              ? u.rawInput
              : u.input
              ? JSON.stringify(u.input)
              : '';
          const outStr =
            typeof u.output === 'string'
              ? u.output
              : Array.isArray(u.content)
              ? u.content.map((c: any) => c?.text || c?.content?.text || '').join('\n')
              : '';
          const cls = classifyTool(rawName, inStr);
          let existing = run.tools.find((x) => x.id === tid);
          const st: LiveToolCall['status'] =
            u.status === 'failed' || u.status === 'error' || u.isError
              ? 'error'
              : u.status === 'completed' || u.status === 'done' || Boolean(outStr)
              ? 'ok'
              : 'running';

          if (!existing) {
            existing = {
              id: tid,
              name: rawName,
              category: cls.category,
              icon: cls.icon,
              summary: cls.summary,
              status: st,
              input: inStr || undefined,
              output: outStr || undefined,
              startedAt: new Date().toISOString(),
            };
            run.tools.push(existing);
          } else {
            if (rawName && rawName !== 'tool') {
              existing.name = rawName;
              existing.summary = cls.summary;
              existing.category = cls.category;
              existing.icon = cls.icon;
            }
            if (inStr) existing.input = inStr;
            if (outStr) existing.output = outStr;
            existing.status = st;
          }
          this.broadcast('run_update', run);
        }
      }
      // Codex reports each upstream failure it retries as `_meta.codex.error` ("Reconnecting... 1/5").
      const codexErr = obj.params?.update?._meta?.codex?.error;
      if (codexErr) {
        run.upstreamErrors = (run.upstreamErrors || 0) + 1;
        (run.warnings ||= []).push(String(codexErr.message || '上游模型渠道出错'));
      }
      // Permission asks and how the policy answered them. WorkBuddy sends an empty title, so fall back to
      // the tool call just before the ask (e.g. "Write …\memory\user_passcode.md").
      if (obj.method === 'session/request_permission') {
        const title = String(obj.params?.toolCall?.title || '').trim();
        const last = run.tools[run.tools.length - 1];
        run.permissionAsk = title || (last ? last.name : '某个工具');
      }
      const outcome = obj.result?.outcome;
      if (outcome && run.permissionAsk) {
        if (outcome.outcome === 'cancelled' || /reject|deny/i.test(String(outcome.optionId || ''))) {
          (run.deniedTools ||= []).push(run.permissionAsk);
        }
        run.permissionAsk = undefined;
      }
      if (typeof obj.result?.stopReason === 'string') run.stopReason = obj.result.stopReason;
      if (obj.result?.stopReason === 'refusal' || obj.result?._meta?.['codebuddy.ai/errorMessage']) {
        run.error =
          obj.result?._meta?.['codebuddy.ai/errorMessage'] ||
          '模型拒绝响应或需客户端 OAuth 鉴权 (stopReason: refusal)';
        this.broadcast('run_update', run);
      }
      // Errors are kept as warnings here; judgeAcpxTurn decides whether the turn failed.
      if (obj.error) {
        const details = obj.error.data?.details ? `（${String(obj.error.data.details).slice(0, 200)}）` : '';
        (run.warnings ||= []).push((obj.error.message || JSON.stringify(obj.error)) + details);
        this.broadcast('run_update', run);
      }
    } catch {}
  },

  /** Sync current turn's Thinking / ToolUse / Text from `~/.acpx/sessions/*.json` ONLY for messages added in THIS run. */
  syncFromAcpxSessionFile(this: AgentGatewayHub, run: ActiveRun) {
    try {
      const info = this.listAcpxSessions().find(
        (s) => s.channel === run.channel && s.sessionName === run.sessionName,
      );
      if (!info) return;
      run.traceSessionId = info.traceSessionId;
      const file = join(this.acpxDir, `${info.acpxRecordId}.json`);
      if (!existsSync(file)) return;
      const raw = JSON.parse(readFileSync(file, 'utf8'));
      const msgs: any[] = Array.isArray(raw.messages) ? raw.messages : [];
      const minIdx = run.initialMsgCount ?? 0;
      // CRITICAL: Do not read messages from previous turns! Wait until acpx appends the new turn.
      if (msgs.length <= minIdx) return;

      const newSlice = msgs.slice(minIdx);
      const lastAgent = [...newSlice].reverse().find((m) => Boolean(m?.Agent));
      if (!lastAgent?.Agent) return;

      const contents: any[] = Array.isArray(lastAgent.Agent.content) ? lastAgent.Agent.content : [];
      const results: Record<string, any> = lastAgent.Agent.tool_results || {};
      let changed = false;

      let thoughts = '';
      let text = '';
      for (const item of contents) {
        if (item?.Thinking?.text) {
          const clean = String(item.Thinking.text).replace(/^Thinking…\s*/i, '').trim();
          if (clean) thoughts += (thoughts ? '\n\n' : '') + clean;
        } else if (typeof item?.Text === 'string' && item.Text) {
          text += (text ? '\n\n' : '') + item.Text;
        } else if (item?.ToolUse) {
          const tu = item.ToolUse;
          const tid = String(tu.id || '');
          if (!tid) continue;
          const tr = results[tid];
          const inStr = tu.raw_input || (tu.input ? JSON.stringify(tu.input) : '');
          const outStr = tr?.output || tr?.content?.Text || '';
          const cls = classifyTool(tu.name || 'tool', inStr);
          const st: LiveToolCall['status'] = tr ? (tr.is_error ? 'error' : 'ok') : 'running';
          const ex = run.tools.find((x) => x.id === tid);
          if (!ex) {
            run.tools.push({
              id: tid,
              name: tu.name || 'tool',
              category: cls.category,
              icon: cls.icon,
              summary: cls.summary,
              status: st,
              input: inStr || undefined,
              output: outStr || undefined,
              startedAt: new Date().toISOString(),
            });
            changed = true;
          } else if (ex.status !== st || (outStr && !ex.output)) {
            ex.status = st;
            if (outStr) ex.output = outStr;
            changed = true;
          }
        }
      }
      if (thoughts.length > run.thoughts.length) {
        run.thoughts = thoughts;
        changed = true;
      }
      if (text.length > run.text.length) {
        run.text = text;
        changed = true;
      }
      if (changed) {
        this.markRunSeenByDispatch(run);
        this.broadcast('run_update', run);
      }
    } catch {}
  },
};
