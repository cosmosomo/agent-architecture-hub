/* zcode-glm-L3 · L3 前端控件实测（5 个关键控件 × 与前端完全相同的请求体）
 * 起自己的服务实例 :8933，测完自己关。每步结果先写盘再继续。
 * 运行：node channels/probe/scripts/zcode-glm-L3-live.mjs
 */
import { spawn } from 'node:child_process';
import { readdirSync, readFileSync, existsSync, mkdirSync, writeFileSync, appendFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const REPO = 'E:\\program\\GIT\\Agent\\multi\\Agent-Architecture-Hub';
const PORT = 8933;
const BASE = `http://127.0.0.1:${PORT}`;
const HOME = (process.env.USERPROFILE || '');
const ACPX_DIR = join(HOME, '.acpx', 'sessions');
const LOG = join(REPO, 'channels', 'probe', 'scripts', 'tmp', 'zcode-glm-L3-live2.log');
const ZCODE_FLASH = 'builtin:bigmodel-coding-plan\\GLM-5.3-Flash';
const ZCODE_NONFLASH = 'builtin:bigmodel-coding-plan\\GLM-5.3';

mkdirSync(join(REPO, 'channels', 'probe', 'scripts', 'tmp'), { recursive: true });
writeFileSync(LOG, '');

function log(step, data) {
  const line = JSON.stringify({ at: new Date().toISOString(), step, ...data });
  appendFileSync(LOG, line + '\n', 'utf8');
  console.log(line);
}

async function api(method, path, body, timeoutMs = 120000) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetch(BASE + path, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: ac.signal,
    });
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch {}
    return { status: res.status, json, text: text.slice(0, 400) };
  } finally { clearTimeout(t); }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function acpxRecordsFor(sessionName) {
  const out = [];
  try {
    for (const f of readdirSync(ACPX_DIR)) {
      if (!f.endsWith('.json')) continue;
      try {
        const raw = JSON.parse(readFileSync(join(ACPX_DIR, f), 'utf8'));
        if (raw && raw.name === sessionName) out.push({ file: f, raw });
      } catch {}
    }
  } catch {}
  return out;
}

function acpxDirSnapshot() {
  try { return readdirSync(ACPX_DIR).filter((f) => f.endsWith('.json')).sort(); } catch { return []; }
}

async function waitFor(predicate, timeoutMs, everyMs = 1500) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    const v = await predicate();
    if (v) return v;
    await sleep(everyMs);
  }
  return null;
}

async function main() {
  // ---- 1. 起服务实例 ----
  log('server_start', { cmd: `node --no-warnings=ExperimentalWarning trace/apps/cli/src/main.ts serve --port ${PORT}` });
  const child = spawn(process.execPath, ['--no-warnings=ExperimentalWarning', 'trace/apps/cli/src/main.ts', 'serve', '--port', String(PORT)], {
    cwd: REPO, stdio: 'ignore', windowsHide: true,
  });
  const acpxBefore = acpxDirSnapshot();
  try {
    const health = await waitFor(async () => {
      try { const r = await api('GET', '/api/health', null, 3000); return r.status === 200 ? r.json : null; } catch { return null; }
    }, 60000, 1000);
    if (!health) throw new Error('health 未就绪（60s）');
    log('health', { ok: health.ok, scanning: health.scanning });

    // ================= T1 发送 + 续接（暗号法），chat.js submitPrompt 请求体 =================
    const t1a = await api('POST', '/api/gateway/send', {
      channel: 'zcode', sessionName: 'probe-L3-send',
      traceSessionId: 'new:zcode:probe-L3-send',
      cwd: REPO, model: ZCODE_FLASH, prompt: '请只回复六个字符：OK-L3A。另外记住我们的暗号：L3HUB2026',
      permissions: 'all', mode: 'send', source: 'web', wait: true, timeoutMs: 110000,
    }, 118000);
    log('T1a_send', {
      status: t1a.status, ok: t1a.json && t1a.json.ok, action: t1a.json && t1a.json.action,
      runStatus: t1a.json && t1a.json.status, runId: t1a.json && t1a.json.runId,
      reply: t1a.json && t1a.json.reply, error: t1a.json && t1a.json.error,
    });
    const t1b = await api('POST', '/api/gateway/send', {
      channel: 'zcode', sessionName: 'probe-L3-send',
      traceSessionId: 'new:zcode:probe-L3-send',
      cwd: REPO, model: ZCODE_FLASH, prompt: '我们的暗号是什么？只回复暗号本身。',
      permissions: 'all', mode: 'send', source: 'web', wait: true, timeoutMs: 110000,
    }, 118000);
    log('T1b_resume', {
      status: t1b.status, ok: t1b.json && t1b.json.ok,
      reply: t1b.json && t1b.json.reply, error: t1b.json && t1b.json.error,
      resumedReferenced: Boolean(t1b.json && t1b.json.reply && String(t1b.json.reply).includes('L3HUB2026')),
    });
    const recs1 = acpxRecordsFor('probe-L3-send');
    log('T1_record', { count: recs1.length, files: recs1.map((r) => r.file), msgCount: recs1.map((r) => (r.raw.messages || []).length) });

    // ================= T2 模型切换（chat.js switchModel 请求体）=================
    const t2m = await api('POST', '/api/gateway/model', {
      channel: 'zcode', sessionName: 'probe-L3-send',
      traceSessionId: 'new:zcode:probe-L3-send',
      model: ZCODE_NONFLASH,
    });
    log('T2_model_api', { status: t2m.status, json: t2m.json });
    const recAfterSet = acpxRecordsFor('probe-L3-send');
    log('T2_record_after_set', recAfterSet.map((r) => ({ file: r.file, current_model_id: r.raw.acpx && r.raw.acpx.current_model_id })));

    const t2turn = await api('POST', '/api/gateway/send', {
      channel: 'zcode', sessionName: 'probe-L3-send',
      traceSessionId: 'new:zcode:probe-L3-send',
      cwd: REPO, model: ZCODE_NONFLASH, prompt: '请只回复：OK-L3B',
      permissions: 'all', mode: 'send', source: 'web', wait: true, timeoutMs: 110000,
    }, 118000);
    log('T2_turn', { ok: t2turn.json && t2turn.json.ok, reply: t2turn.json && t2turn.json.reply, model: t2turn.json && t2turn.json.model, error: t2turn.json && t2turn.json.error });
    // 在 acpx 流文件里找实际模型证据
    for (const r of acpxRecordsFor('probe-L3-send')) {
      const streamFile = join(ACPX_DIR, r.file.replace(/\.json$/, '.stream.ndjson'));
      let modelLines = [];
      if (existsSync(streamFile)) {
        const buf = readFileSync(streamFile, 'utf8');
        const lines = buf.split(/\r?\n/);
        for (const ln of lines) {
          if (/"model"|model_id|modelId/i.test(ln)) {
            modelLines.push(ln.slice(0, 300));
            if (modelLines.length >= 6) break;
          }
        }
      }
      log('T2_stream_model_evidence', { file: r.file, streamExists: existsSync(streamFile), modelLines });
    }
    // 切回最便宜的模型
    await api('POST', '/api/gateway/model', { channel: 'zcode', sessionName: 'probe-L3-send', model: ZCODE_FLASH });

    // ================= T3 新建会话（console createNewSessionPrompt 请求体）=================
    const before3 = acpxDirSnapshot();
    const t3 = await api('POST', '/api/gateway/session/new', {
      channel: 'zcode', sessionName: 'probe-L3-new', cwd: REPO, model: ZCODE_FLASH,
    });
    const after3 = acpxDirSnapshot();
    const added = after3.filter((f) => !before3.includes(f));
    log('T3_session_new', { status: t3.status, ok: t3.json && t3.json.ok, traceSessionId: t3.json && t3.json.traceSessionId, acpxFilesAdded: added, acpxCountBefore: before3.length, acpxCountAfter: after3.length });
    // 前端的后续动作是直接向该槽位发消息；验证第一次 send 才真正落盘
    const t3send = await api('POST', '/api/gateway/send', {
      channel: 'zcode', sessionName: 'probe-L3-new',
      traceSessionId: 'new:zcode:probe-L3-new',
      cwd: REPO, model: ZCODE_FLASH, prompt: '请只回复：OK-L3N',
      permissions: 'all', mode: 'send', source: 'web', wait: true, timeoutMs: 110000,
    }, 118000);
    const recs3 = acpxRecordsFor('probe-L3-new');
    log('T3_first_send', { ok: t3send.json && t3send.json.ok, reply: t3send.json && t3send.json.reply, acpxRecordsNow: recs3.map((r) => r.file) });

    // ================= T4 打断 + 续（chat.js gw-cancel / console cancel-run 请求体）=================
    const t4start = await api('POST', '/api/gateway/send', {
      channel: 'zcode', sessionName: 'probe-L3-cancel',
      traceSessionId: 'new:zcode:probe-L3-cancel',
      cwd: REPO, model: ZCODE_FLASH,
      prompt: '请用 bash 工具执行命令：ping -n 45 127.0.0.1 >nul 。命令执行完后回复 DONE-L3。',
      permissions: 'all', mode: 'send', source: 'web',
    });
    log('T4_start', { ok: t4start.json && t4start.json.ok, runId: t4start.json && t4start.json.runId, action: t4start.json && t4start.json.action });
    const sawRun = await waitFor(async () => {
      const st = await api('GET', '/api/gateway/state', null, 5000);
      const runs = (st.json && st.json.activeRuns) || [];
      return runs.find((r) => r.sessionName === 'probe-L3-cancel' && r.status === 'running') || null;
    }, 30000, 2000);
    log('T4_run_seen', { seen: Boolean(sawRun), runId: sawRun && sawRun.runId, tools: sawRun && sawRun.tools && sawRun.tools.length });
    await sleep(12000); // 让工具跑起来
    const t4cancel = await api('POST', '/api/gateway/cancel', { channel: 'zcode', sessionName: 'probe-L3-cancel' });
    log('T4_cancel_api', { status: t4cancel.status, json: t4cancel.json });
    const t4state = await api('GET', '/api/gateway/state', null, 8000);
    const stillRunning = ((t4state.json && t4state.json.activeRuns) || []).some((r) => r.sessionName === 'probe-L3-cancel');
    const recs4a = acpxRecordsFor('probe-L3-cancel');
    const msgsA = recs4a.map((r) => (r.raw.messages || []).length);
    const lastTextA = recs4a.map((r) => { const ms = r.raw.messages || []; const last = ms[ms.length - 1]; return last ? JSON.stringify(last).slice(0, 160) : ''; });
    log('T4_after_cancel', { stillRunning, msgsA, lastTextA });
    await sleep(12000); // 观察底层 acpx 是否真的停了（消息数不再增长）
    const recs4b = acpxRecordsFor('probe-L3-cancel');
    const msgsB = recs4b.map((r) => (r.raw.messages || []).length);
    log('T4_12s_later', { msgsB, stoppedAtBackend: JSON.stringify(msgsA) === JSON.stringify(msgsB) });
    const t4resume = await api('POST', '/api/gateway/send', {
      channel: 'zcode', sessionName: 'probe-L3-cancel',
      traceSessionId: 'new:zcode:probe-L3-cancel',
      cwd: REPO, model: ZCODE_FLASH, prompt: '刚才的命令不用等了。请只回复：OK-L3C',
      permissions: 'all', mode: 'send', source: 'web', wait: true, timeoutMs: 110000,
    }, 118000);
    log('T4_resume_after_cancel', { ok: t4resume.json && t4resume.json.ok, reply: t4resume.json && t4resume.json.reply, error: t4resume.json && t4resume.json.error });

    // ================= T5a 审批（chat.js 正确字段 permissions:'reads'）=================
    const t5a = await api('POST', '/api/gateway/send', {
      channel: 'zcode', sessionName: 'probe-L3-perm',
      traceSessionId: 'new:zcode:probe-L3-perm',
      cwd: REPO, model: ZCODE_FLASH,
      prompt: '请在 channels/probe/scripts/tmp 目录创建文件 l3-perm-test.txt，内容为 hi，然后只回复 CREATED-L3。',
      permissions: 'reads', mode: 'send', source: 'web', wait: true, timeoutMs: 110000,
    }, 118000);
    log('T5a_reads_send', { ok: t5a.json && t5a.json.ok, runStatus: t5a.json && t5a.json.status, reply: t5a.json && t5a.json.reply, error: t5a.json && t5a.json.error });
    const t5state = await api('GET', '/api/gateway/state', null, 8000);
    const approvals = (t5state.json && t5state.json.pendingApprovals) || [];
    log('T5a_approvals', {
      count: approvals.length,
      items: approvals.map((a) => ({ id: a.id, channel: a.channel, sessionName: a.sessionName, toolName: a.toolName, status: a.status, reason: String(a.reason || '').slice(0, 120) })),
      fileCreated: existsSync(join(REPO, 'channels', 'probe', 'scripts', 'tmp', 'l3-perm-test.txt')),
    });
    if (approvals.length) {
      const t5approve = await api('POST', '/api/gateway/approve', { id: approvals[0].id, decision: 'approve' });
      log('T5a_approve_api', { status: t5approve.status, ok: t5approve.json && t5approve.json.ok, newRunStarted: Boolean(t5approve.json && t5approve.json.run), runStatus: t5approve.json && t5approve.json.run && t5approve.json.run.status });
      const created = await waitFor(() => existsSync(join(REPO, 'channels', 'probe', 'scripts', 'tmp', 'l3-perm-test.txt')), 90000, 3000);
      log('T5a_file_after_approve', { fileCreated: Boolean(created) });
    }

    // ================= T5b console 权限下拉的实际请求体（permissionMode 字段）=================
    const t5b = await api('POST', '/api/gateway/send', {
      channel: 'zcode', sessionName: 'probe-L3-perm2',
      traceSessionId: 'new:zcode:probe-L3-perm2',
      cwd: REPO, model: ZCODE_FLASH,
      prompt: '请在 channels/probe/scripts/tmp 目录创建文件 l3-perm-console.txt，内容为 hi，然后只回复 CREATED-L3B。',
      permissionMode: 'deny-all', // console.js sendPromptNow 实际发的字段名
      mode: 'send', source: 'web', wait: true, timeoutMs: 110000,
    }, 118000);
    const t5bFile = existsSync(join(REPO, 'channels', 'probe', 'scripts', 'tmp', 'l3-perm-console.txt'));
    let t5bFileContent = '';
    if (t5bFile) { try { t5bFileContent = readFileSync(join(REPO, 'channels', 'probe', 'scripts', 'tmp', 'l3-perm-console.txt'), 'utf8').slice(0, 40); } catch {} }
    log('T5b_console_permissionMode_deny_all', {
      ok: t5b.json && t5b.json.ok, reply: t5b.json && t5b.json.reply,
      fileCreated: t5bFile, fileContent: t5bFileContent,
      conclusion: t5bFile ? 'deny-all 未生效（文件被创建）——console 权限下拉字段名错误，后端读的是 permissions' : 'deny-all 生效或工具未执行',
    });

    log('done', {});
  } catch (e) {
    log('fatal', { error: String(e && e.stack || e) });
  } finally {
    try { child.kill(); } catch {}
    log('server_stopped', {});
  }
}

main();
