// Native-surface probe for ZCode (dsp_181254_085v), 2026-10-19.
// Speaks raw JSON-RPC over stdio to zcode-acp-server and exercises, per
// capability unit: slash commands as turns, permission modes, mounted MCP
// tools, idle session creation, queued next-turn input, background-task wake,
// automation (wake-timer) hosting, per-session provider/model routing.
// Usage: node native_zcode_1019.mjs <stage>   stage = slash | modes | goal | bg
import { AcpRawTester } from './probe_ask_user_tester.mjs';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const HOME = os.homedir();
const PROBE_CWD = 'C:\\Users\\COLORFIRE\\hub-workspaces\\probe-zc-native-1019';
const OUT_FILE = path.join(HOME, 'hub-workspaces', 'probe-zc-native-1019', 'probe-results.jsonl');
const stage = process.argv[2] || 'slash';

const results = [];
function record(name, data) {
  const row = { name, ...data };
  results.push(row);
  fs.appendFileSync(OUT_FILE, JSON.stringify(row) + '\n');
  console.log('\n##### RESULT', JSON.stringify(row).slice(0, 1500), '\n');
}

function textOf(updates) {
  return updates
    .filter((u) => u.sessionUpdate === 'agent_message_chunk')
    .map((u) => u.content?.text || '')
    .join('');
}
function cmdsOf(updates) {
  const c = updates.filter((u) => u.sessionUpdate === 'available_commands_update');
  return c.length ? c[c.length - 1].availableCommands : null;
}
function configOptionsOf(updates) {
  const c = updates.filter((u) => u.sessionUpdate === 'config_option_update');
  return c.length ? c[c.length - 1].configOptions : null;
}

async function runPrompt(t, sid, text, timeoutMs = 120000) {
  const updates = [];
  // collect via wrapper: tap session/update notifications
  const orig = t.handleLine.bind(t);
  t.handleLine = (line) => {
    try {
      const m = JSON.parse(line.trim());
      if (m.method === 'session/update' && m.params?.update) updates.push(m.params.update);
    } catch {}
    orig(line);
  };
  const started = Date.now();
  try {
    const res = await Promise.race([
      t.call('session/prompt', { sessionId: sid, prompt: [{ type: 'text', text }] }),
      new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), timeoutMs)),
    ]);
    t.handleLine = orig;
    return { stopReason: res?.stopReason, updates, ms: Date.now() - started };
  } catch (e) {
    t.handleLine = orig;
    return { error: String(e.message || e), updates, ms: Date.now() - started };
  }
}

async function main() {
  fs.mkdirSync(PROBE_CWD, { recursive: true });
  const t = new AcpRawTester('zcode', { fs: { readTextFile: true, writeTextFile: true }, terminal: false });
  // permission auto-allow for the guarded-mode write test; log every payload
  t.onServerRequest = (msg, sendResult) => {
    record('server_request', { method: msg.method, params: msg.params });
    if (msg.method === 'session/request_permission') {
      const opts = msg.params?.options || [];
      const allow = opts.find((o) => /allow/i.test(o.kind)) || opts[0];
      sendResult({ outcome: { outcome: 'selected', optionId: allow?.optionId } });
    } else if (String(msg.method).startsWith('automation/')) {
      sendResult({ success: true, id: 'probe-automation-1', created: true });
    } else {
      sendResult({});
    }
  };
  await t.start();

  if (stage === 'slash') {
    const nw = await t.call('session/new', { cwd: PROBE_CWD, mcpServers: [] });
    const sid = nw.sessionId;
    record('session_new', { sid });
    await new Promise((r) => setTimeout(r, 1500));

    const slashTests = [
      ['/quota', 'quota 卡片'],
      ['/mcp', 'MCP 列表卡片'],
      ['/mode plan', '切 plan'],
      ['/mode build', '切回 build'],
      ['/thought high', '推理力度 high'],
      ['/model GLM-5.3-Flash', '切模型（同名）'],
      ['/compact', '压缩上下文'],
      ['/fork', '分叉'],
      ['/goal 只回复 GOAL-OK 三个字然后结束', 'goal 循环启动'],
      ['/goal status', 'goal 状态'],
      ['/goal stop', 'goal 停止'],
      ['/auto status', 'auto 状态'],
      ['/resume definitely-not-a-real-sid-1019', 'resume 假 id'],
      ['/new', 'TUI-only'],
      ['/help', 'TUI-only'],
      ['/workflows', 'workflow 门'],
      ['/dwf list', 'DWF 清单'],
      ['/rewind', '回退（后端命令）'],
      ['/this-command-does-not-exist-1019', '未知命令'],
    ];
    for (const [cmd, what] of slashTests) {
      const r = await runPrompt(t, sid, cmd, 150000);
      record('slash', {
        cmd,
        what,
        stopReason: r.stopReason,
        error: r.error,
        text: textOf(r.updates).slice(0, 600),
        tools: r.updates.filter((u) => u.sessionUpdate === 'tool_call').map((u) => u.title),
        hadCommands: !!cmdsOf(r.updates),
        modeUpdates: configOptionsOf(r.updates)?.length || 0,
        ms: r.ms,
      });
      await new Promise((r2) => setTimeout(r2, 500));
    }
    await t.close();
    process.exit(0);
  }

  if (stage === 'modes') {
    // open-idle: session/new then materialize via an extension call (no model turn)
    const nw = await t.call('session/new', { cwd: PROBE_CWD, mcpServers: [] });
    const sidIdle = nw.sessionId;
    record('open_idle_new', { sidIdle });
    try {
      const sm = await t.call('session/setMode', { sessionId: sidIdle, mode: 'build' });
      record('open_idle_setMode', { ok: true, result: sm });
    } catch (e) {
      record('open_idle_setMode', { ok: false, error: String(e.message || e) });
    }
    await new Promise((r) => setTimeout(r, 1200));

    // permission-scope: guarded mode, write outside workspace
    try {
      const sm2 = await t.call('session/setMode', { sessionId: sidIdle, mode: 'guarded' });
      record('guarded_set', { result: sm2 });
    } catch (e) {
      record('guarded_set', { error: String(e.message || e) });
    }
    const rp = await runPrompt(
      t,
      sidIdle,
      '请在目录 C:\\Users\\COLORFIRE\\hub-workspaces\\probe-zc-outside-1019 下创建文件 outside.txt（这个目录不在当前工作区内），内容写 OUTSIDE-OK，然后回复 DONE-WITH-PERMISSION',
      150000
    );
    record('permission_scope', {
      stopReason: rp.stopReason,
      error: rp.error,
      text: textOf(rp.updates).slice(0, 500),
      requests: rp.updates.filter((u) => u.sessionUpdate === 'tool_call').map((u) => ({ title: u.title, kind: u.kind, status: u.status })),
      ms: rp.ms,
    });

    // mount-tools + inject-tool: session/new with mcpServers
    const nw3 = await t.call('session/new', {
      cwd: PROBE_CWD,
      mcpServers: [{
        name: 'probe-tools',
        command: 'node',
        args: ['E:\\program\\GIT\\Agent\\multi\\Agent-Architecture-Hub\\channels\\probe\\scripts\\probe_mcp_echo_server.mjs'],
      }],
    });
    const sidMcp = nw3.sessionId;
    record('mcp_session_new', { sidMcp });
    await new Promise((r) => setTimeout(r, 1500));
    const rm = await runPrompt(
      t,
      sidMcp,
      '调用 probe-tools 服务里的 echo 工具，参数 text=HELLO-PROBE，把工具返回的原文完整回复给我',
      150000
    );
    record('mount_tools', {
      stopReason: rm.stopReason,
      error: rm.error,
      text: textOf(rm.updates).slice(0, 700),
      toolCalls: rm.updates.filter((u) => u.sessionUpdate === 'tool_call').map((u) => ({ title: u.title, rawInput: u.rawInput })),
      ms: rm.ms,
    });
    const injected = textOf(rm.updates).includes('TOOL-INJECTED-9911');
    record('inject_tool', { toolResultFollowed: injected });

    await t.close();
    process.exit(0);
  }

  if (stage === 'mount-http') {
    try {
      const nw3 = await t.call('session/new', {
        cwd: PROBE_CWD,
        mcpServers: [{ type: 'http', name: 'probe-http-tools', url: 'http://127.0.0.1:18921/', headers: [] }],
      });
      record('mcp_http_session_new', { sidMcp: nw3.sessionId });
      await new Promise((r) => setTimeout(r, 2000));
      const rm = await runPrompt(t, nw3.sessionId, '调用 probe-http-tools 的 echo 工具（参数 text=HELLO-PROBE），把工具返回原文完整回复给我', 150000);
      record('mount_tools_http', {
        stopReason: rm.stopReason, error: rm.error,
        text: textOf(rm.updates).slice(0, 700),
        toolCalls: rm.updates.filter((u) => u.sessionUpdate === 'tool_call').map((u) => ({ title: u.title, rawInput: u.rawInput, status: u.status })),
        ms: rm.ms,
      });
      record('inject_tool', { toolResultFollowed: textOf(rm.updates).includes('TOOL-INJECTED-9911') });
    } catch (e) {
      record('mcp_http_error', { error: JSON.stringify(e, Object.getOwnPropertyNames(e)).slice(0, 500) });
    }
    await t.close();
    process.exit(0);
  }

  if (stage === 'mount') {
    // mount-tools retry with full error dump
    try {
      const nw3 = await t.call('session/new', {
        cwd: PROBE_CWD,
        mcpServers: [{
          name: 'probe-tools',
          command: 'node',
          args: ['E:/program/GIT/Agent/multi/Agent-Architecture-Hub/channels/probe/scripts/probe_mcp_echo_server.mjs'],
          env: [],
        }],
      });
      record('mcp_session_new', { sidMcp: nw3.sessionId });
      await new Promise((r) => setTimeout(r, 1500));
      const rm = await runPrompt(t, nw3.sessionId, '调用 probe-tools 服务里的 echo 工具，参数 text=HELLO-PROBE，把工具返回的原文完整回复给我', 150000);
      record('mount_tools', {
        stopReason: rm.stopReason, error: rm.error,
        text: textOf(rm.updates).slice(0, 700),
        toolCalls: rm.updates.filter((u) => u.sessionUpdate === 'tool_call').map((u) => ({ title: u.title, rawInput: u.rawInput })),
        ms: rm.ms,
      });
      record('inject_tool', { toolResultFollowed: textOf(rm.updates).includes('TOOL-INJECTED-9911') });
    } catch (e) {
      record('mcp_session_new_error', { error: JSON.stringify(e, Object.getOwnPropertyNames(e)).slice(0, 800) });
    }
    await t.close();
    process.exit(0);
  }

  if (stage === 'goal') {
    // goal + budget via native session/goal extension (bridge-driven loop)
    const nw = await t.call('session/new', { cwd: PROBE_CWD, mcpServers: [] });
    const sid = nw.sessionId;
    await new Promise((r) => setTimeout(r, 1200));
    try {
      const g = await t.call('session/goal', { sessionId: sid, action: 'set', objective: '只回复 GOAL-SET-OK 然后结束' });
      record('session_goal_set', { result: JSON.stringify(g).slice(0, 400) });
    } catch (e) {
      record('session_goal_set', { error: String(e.message || e) });
    }
    await new Promise((r) => setTimeout(r, 3000));
    // wake-bg: background bash, then idle-wait for out-of-band updates
    const rb = await runPrompt(
      t,
      sid,
      '用 Bash 工具把命令 ping -n 8 127.0.0.1 放到后台（run_in_background=true）运行，不要等它结束，直接回复 BG-LAUNCHED 并结束这一轮',
      120000
    );
    record('wake_bg_launch', {
      stopReason: rb.stopReason,
      error: rb.error,
      text: textOf(rb.updates).slice(0, 300),
      ms: rb.ms,
    });
    const t0 = Date.now();
    await new Promise((r) => setTimeout(r, 45000));
    record('wake_bg_window', { waitedMs: Date.now() - t0, note: 'out-of-band updates during window: see bg_update rows' });
    await t.close();
    process.exit(0);
  }

  if (stage === 'bg') {
    // inject-next: queue a second prompt while a long turn runs
    const nw = await t.call('session/new', { cwd: PROBE_CWD, mcpServers: [] });
    const sid = nw.sessionId;
    await new Promise((r) => setTimeout(r, 1200));
    const longTurn = runPrompt(
      t,
      sid,
      '用 Bash 工具运行命令 ping -n 16 127.0.0.1 （约15秒），结束后回复 TURN1-DONE',
      180000
    );
    await new Promise((r) => setTimeout(r, 4000));
    const second = runPrompt(t, sid, '回复 QUEUE-OK', 180000);
    const [a, b] = await Promise.all([longTurn, second]);
    record('inject_next', {
      first: { stopReason: a.stopReason, error: a.error, text: textOf(a.updates).slice(0, 200), ms: a.ms },
      second: { stopReason: b.stopReason, error: b.error, text: textOf(b.updates).slice(0, 200), ms: b.ms },
      secondRanAfterFirst: b.ms > 0 && a.ms > 0 && b.stopReason === 'end_turn',
    });
    // channel-route: switch provider mid-session then one prompt
    try {
      const so = await t.call('session/set_config_option', {
        sessionId: sid,
        optionId: 'model',
        value: 'builtin:zai-coding-plan\\GLM-5.3-Flash',
      });
      record('channel_route_set', { result: JSON.stringify(so).slice(0, 300) });
    } catch (e) {
      record('channel_route_set', { error: String(e.message || e) });
    }
    const rc = await runPrompt(t, sid, '回复 ROUTE-OK', 120000);
    record('channel_route_turn', {
      stopReason: rc.stopReason,
      error: rc.error,
      text: textOf(rc.updates).slice(0, 200),
      usage: JSON.stringify(rc.updates.find((u) => u.sessionUpdate === 'usage_update') || {}).slice(0, 500),
    });
    await t.close();
    process.exit(0);
  }

  if (stage === 'list') {
    // cmd-list: capture available_commands_update pushed after session/new
    const seen = [];
    const orig = t.handleLine.bind(t);
    t.handleLine = (line) => {
      try {
        const m = JSON.parse(line.trim());
        if (m.method === 'session/update' && m.params?.update?.sessionUpdate === 'available_commands_update') {
          seen.push(m.params.update.availableCommands);
        }
      } catch {}
      orig(line);
    };
    const nw = await t.call('session/new', { cwd: PROBE_CWD, mcpServers: [] });
    await new Promise((r) => setTimeout(r, 3000));
    t.handleLine = orig;
    const cmds = seen.length ? seen[seen.length - 1] : null;
    record('cmd_list', { sid: nw.sessionId, count: cmds?.length, availableCommands: cmds });

    // discover-sessions + quota at L1a: session/list and account/usage_stats
    try {
      const ls = await t.call('session/list', { cwd: PROBE_CWD });
      record('session_list', { count: ls.sessions?.length, sample: ls.sessions?.slice(0, 2).map((s) => ({ sessionId: s.sessionId, title: s.title })) });
    } catch (e) {
      record('session_list', { error: String(e.message || e) });
    }
    try {
      const q = await t.call('account/usage_stats', {});
      record('usage_stats', { result: JSON.stringify(q).slice(0, 500) });
    } catch (e) {
      record('usage_stats', { error: String(e.message || e) });
    }

    // session/fork direct (slash /fork failed; isolate the error)
    try {
      const fk = await t.call('session/fork', { sessionId: nw.sessionId });
      record('session_fork', { result: JSON.stringify(fk).slice(0, 300) });
    } catch (e) {
      record('session_fork', { error: String(e.message || e) });
    }
    await t.close();
    process.exit(0);
  }

  if (stage === 'rewind') {
    // create a file so a workspace checkpoint exists, then /rewind latest
    const nw = await t.call('session/new', { cwd: PROBE_CWD, mcpServers: [] });
    const sid = nw.sessionId;
    await new Promise((r) => setTimeout(r, 1500));
    const r1 = await runPrompt(t, sid, '在当前工作目录创建文件 rewind-me.txt，内容正好是 REWIND-V1，然后回复 WROTE', 120000);
    record('rewind_setup', { stopReason: r1.stopReason, error: r1.error, text: textOf(r1.updates).slice(0, 200) });
    await new Promise((r) => setTimeout(r, 2000));
    const r2 = await runPrompt(t, sid, '/rewind latest', 60000);
    record('rewind_cmd', {
      stopReason: r2.stopReason,
      error: r2.error,
      text: textOf(r2.updates).slice(0, 400),
      tools: r2.updates.filter((u) => u.sessionUpdate === 'tool_call').map((u) => u.title),
    });
    await t.close();
    process.exit(0);
  }

  if (stage === 'wake-timer') {
    const nw = await t.call('session/new', { cwd: PROBE_CWD, mcpServers: [] });
    const sid = nw.sessionId;
    await new Promise((r) => setTimeout(r, 1500));
    const r1 = await runPrompt(
      t,
      sid,
      '请用 CronCreate 工具创建一个一次性定时任务：60 秒后触发，提示语是 TIMER-OK。创建成功就回复创建结果摘要；如果该工具在当前环境不可用，回复 TOOL-UNAVAILABLE 加原因',
      120000
    );
    record('wake_timer', {
      stopReason: r1.stopReason,
      error: r1.error,
      text: textOf(r1.updates).slice(0, 500),
      tools: r1.updates.filter((u) => u.sessionUpdate === 'tool_call').map((u) => ({ title: u.title, rawInput: u.rawInput })),
    });
    await new Promise((r) => setTimeout(r, 3000));
    await t.close();
    process.exit(0);
  }

  if (stage === 'route2') {
    const nw = await t.call('session/new', { cwd: PROBE_CWD, mcpServers: [] });
    const sid = nw.sessionId;
    await new Promise((r) => setTimeout(r, 1500));
    try {
      const so = await t.call('session/set_config_option', {
        sessionId: sid,
        configId: 'model',
        value: 'builtin:zai-coding-plan\GLM-5.3-Flash',
      });
      record('channel_route_set2', { ok: true, options: JSON.stringify(so).slice(0, 400) });
    } catch (e) {
      record('channel_route_set2', { error: JSON.stringify(e, Object.getOwnPropertyNames(e)).slice(0, 300) });
    }
    const rc = await runPrompt(t, sid, '回复 ROUTE2-OK', 120000);
    record('channel_route_turn2', {
      stopReason: rc.stopReason, error: rc.error,
      text: textOf(rc.updates).slice(0, 150),
      usage: JSON.stringify(rc.updates.find((u) => u.sessionUpdate === 'usage_update') || {}).slice(0, 300),
    });
    await t.close();
    process.exit(0);
  }

  if (stage === 'capacity') {
    // two concurrent native CLI runs
    const { spawn } = await import('node:child_process');
    const run = (p) => new Promise((res) => {
      const c = spawn(process.execPath, ['E:\\zcode\\resources\\glm\\zcode.cjs', '-p', p, '--json', '--cwd', PROBE_CWD],
        { env: { ...process.env }, windowsHide: true });
      let out = '';
      c.stdout.on('data', (d) => (out += d));
      c.on('exit', (code) => res({ code, out: out.slice(-200) }));
    });
    const t0 = Date.now();
    const [a, b] = await Promise.all([run('回复 CAP-1'), run('回复 CAP-2')]);
    record('capacity_two_concurrent', { ms: Date.now() - t0, a: { code: a.code, tail: a.out }, b: { code: b.code, tail: b.out } });
    process.exit(0);
  }

  if (stage === 'browser') {
    const { spawn } = await import('node:child_process');
    const c = spawn(process.execPath, ['E:\\zcode\\resources\\glm\\zcode.cjs', '-p',
      '用 browser-use 打开 https://example.com ，回复页面主标题', '--json', '--browser-use', 'headless', '--cwd', PROBE_CWD],
      { env: { ...process.env }, windowsHide: true });
    let out = '';
    c.stdout.on('data', (d) => (out += d));
    const timer = setTimeout(() => { try { c.kill(); } catch {} }, 150000);
    await new Promise((res) => c.on('exit', res));
    clearTimeout(timer);
    record('browser_use_headless', { out: out.slice(-600) });
    process.exit(0);
  }
}

main().catch((e) => {
  record('fatal', { error: String(e.stack || e) });
  process.exit(1);
});
