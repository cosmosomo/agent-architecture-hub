#!/usr/bin/env node
// 显示与交互单元的回归（第二批）：probe_display.mjs 覆盖 observe-history、observe-steps、ui-tool-card、ui-thinking
// 之后，本脚本照同样的方法（网页显示用的那份会话数据对原始记录逐条核对）再测这些单元：
//
//   ui-diff            改动的文件和行数与实际一致：编辑类调用数量、文件路径、内容逐条一致
//   ui-terminal-output 命令和输出完整可读：命令类调用数量、命令可见（结果完整性由 ui-tool-card 覆盖）
//   ui-subagent-view   子智能体的步骤能看到，和父会话关联：调用数对子会话链接
//   ui-plan-view       清单内容和勾选状态与智能体一致：最后一条计划调用的清单两边对
//   ui-usage           数字和各家记录一致：解析出的 usage 对原始记录里的 token 汇总
//   ui-long-history    几百轮的会话也能打开、能翻到最早：最大会话全量返回，最早的人话在
//   ui-markdown        格式原样呈现：原始模型文本里的 ``` 围栏、标题行，解析后还在的比例
//   search-sessions    输入关键词能找到对应会话：拿会话里的关键词查 /api/search（没对原始记录，只在有问题时写）
//   project-view       一个项目下列出所有家在这个目录里的会话：各家原始存档里本项目的会话数对接口数
//   ui-sidebar         和本机实际会话一致：各家原始存档的会话总数对接口数
//
//   node channels/probe/scripts/probe_display_units.mjs [--base http://127.0.0.1:8899] [--per 6] [--write]
//
// 与 probe_display.mjs 相同的约定：默认只打印，--write 才写黑板；没对上原始记录的只在发现问题时写，不写"通过"。
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const args = process.argv.slice(2);
const opt = (k, d) => {
  const i = args.indexOf(k);
  return i >= 0 ? args[i + 1] : d;
};
if (args.includes('--help')) {
  console.log('node channels/probe/scripts/probe_display_units.mjs [--base URL] [--per N] [--write]');
  process.exit(0);
}
const BASE = opt('--base', process.env.HUB_BASE || 'http://127.0.0.1:8899');
const PER = Number(opt('--per', 6));
const WRITE = args.includes('--write');

const FAMILY = { 'claude-code': 'claude', codex: 'codex', antigravity: 'antigravity', zcode: 'zcode', workbuddy: 'workbuddy', opencode: 'opencode', hermes: 'hermes' };
const HOME = os.homedir();
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const normP = (p) => String(p || '').replace(/[\\/]+/g, '\\').toLowerCase();
// claude 的项目目录名把 ":" 也换成 "-"（E--program-…），workbuddy 只换路径分隔符（e-program-…）
const projKey = (p, joint) => normP(String(p).replace(/:/g, joint ? '' : '-')).replace(/[\\/]+/g, '-');

// 编辑类 / 命令类工具在各家的名字。codex 的文件改动走 exec 调用、正文含 "*** Begin Patch"，两边用同一条规则认。
const EDIT_RE = {
  'claude-code': /^(Edit|Write|MultiEdit|NotebookEdit)$/,
  codex: /^(Edit|Write|MultiEdit|apply_patch)$/,
  antigravity: /^(write_to_file|replace_file_content)$/,
  workbuddy: /^(Edit|Write|MultiEdit|NotebookEdit)$/i,
  zcode: /^(Edit|Write|MultiEdit|NotebookEdit)$/i,
  opencode: /^(edit|write|patch)$/i,
  hermes: /^(write_file|patch|edit|str_replace)$/i,
};
const SHELL_RE = {
  'claude-code': /^(Bash|PowerShell)$/,
  codex: /^(exec|shell|local_shell|container_exec)$/,
  antigravity: /^run_command$/,
  workbuddy: /^(Bash|PowerShell|terminal)$/i,
  zcode: /^(Bash|PowerShell|bash|terminal)$/i,
  opencode: /^(bash|terminal|shell)$/i,
  hermes: /^(terminal)$/i,
};
const PLAN_RE = /(TodoWrite|todowrite|update_plan|manage_task|TaskCreate|TaskUpdate|^todo$)/i;
const CUT_NOTE = /…（截断，原长 (\d+) 字）\s*$/;
const len = (t) => String(t || '').replace(/\s+/g, '').length;
// codex：正文带补丁的 exec 算编辑；其余按名字认。
const classify = (kind, name, input) => {
  const patch = kind === 'codex' && /\*\*\* Begin Patch/.test(String(input || ''));
  if (EDIT_RE[kind]?.test(name || '') || patch) return 'edit';
  if (SHELL_RE[kind]?.test(name || '')) return 'shell';
  if (PLAN_RE.test(name || '')) return 'plan';
  if (/^(Agent|Task|invoke_subagent)$/.test(name || '')) return 'sub';
  return null;
};
/** 键序无关的比较串；antigravity 的原始参数值外包引号、双反斜杠、字符串布尔，适配器都会归一，这里照样归一再比。 */
const canon = (v, unquote = false) => {
  if (typeof v === 'string') {
    if (unquote) {
      if (/^".*"$/s.test(v)) v = v.slice(1, -1);
      if (v === 'true' || v === 'false') return String(v === 'true');
      // antigravity 的参数值还带一层 JSON 转义（\" 、\n），归一成真实字符再比
      if (v.includes('\\')) {
        try {
          v = JSON.parse('"' + v.split('\r\n').join('\\n').split('\n').join('\\n').split('\r').join('\\n') + '"');
        } catch { /* 转不开就照原样比 */ }
      }
      if (/^-?\d+(\.\d+)?$/.test(v)) return String(Number(v));
    }
    return JSON.stringify(String(v).split('\r\n').join('\n'));
  }
  if (Array.isArray(v)) return '[' + v.map((x) => canon(x, unquote)).join(',') + ']';
  if (v && typeof v === 'object') return '{' + Object.keys(v).sort().map((k) => JSON.stringify(k) + ':' + canon(v[k], unquote)).join(',') + '}';
  return JSON.stringify(v ?? null);
};
const hasPathKey = (o, inpS) => !!(o.file_path || o.path || o.FilePath || o.TargetFile || (typeof inpS === 'string' && /\*\*\* (?:Add|Update|Delete) File: |"file_path"|"TargetFile"/.test(inpS)));
/** 人话外的包装：剥掉系统提醒、压缩摘要、任务通知等包装块后取剩余；纯包装返回 null。 */
const peel = (t) => {
  let s = String(t || '').trim();
  if (!s) return null;
  s = s.replace(/<(system-reminder|cb_summary|task-notification|conversation_history_summary)\b[\s\S]*?<\/\1>\s*/gi, '');
  if (/^please continue with the conversation/i.test(s.trim())) return null;
  const m = /^<USER_REQUEST>\s*([\s\S]*?)\s*<\/USER_REQUEST>/.exec(s.trim());
  if (m) s = m[1];
  return s.trim() || null;
};

const get = async (p) => {
  const r = await fetch(BASE + p);
  if (!r.ok) throw new Error(`${p} → ${r.status}`);
  return r.json();
};
const lines = (file) => {
  try {
    return fs.readFileSync(file, 'utf8').split(/\r?\n/).filter((l) => l.trim());
  } catch {
    return null;
  }
};
const parse = (l) => {
  try {
    return JSON.parse(l);
  } catch {
    return null;
  }
};
const dbs = new Map();
const db = (file) => {
  if (!dbs.has(file)) {
    try {
      dbs.set(file, new DatabaseSync(file, { readOnly: true }));
    } catch {
      dbs.set(file, null);
    }
  }
  return dbs.get(file);
};
const shownLen = (t) => {
  const s = String(t || '');
  const m = CUT_NOTE.exec(s);
  if (!m) return len(s);
  return len(s) + Math.max(0, Number(m[1]) - s.length);
};
const ratio = (a, b) => (b ? Math.min(a, b) / Math.max(a, b) : 1);
const grade = (r, pass, partial) => (r >= pass ? 'pass' : r >= partial ? 'partial' : 'fail');

/** 原始记录里数出与本批单元有关的东西。null 表示这种格式这里读不了。 */
function raw(s) {
  const kind = s.source.kind;
  const fmt = s.source.format;
  const c = {
    edits: 0, editWithPath: 0, editInputs: [], editTrunc: 0,
    shells: 0, shellWithCmd: 0,
    plans: 0, lastPlan: null,
    subs: 0, subExtra: '',
    usage: null, usageHow: '',
    mdFences: 0, mdHeads: 0,
    firstUser: null,
  };
  const md = (t) => {
    const x = String(t || '');
    c.mdFences += (x.match(/```/g) || []).length;
    c.mdHeads += (x.match(/^\s*#{1,6} /gm) || []).length;
  };
  const count = (name, inp, unquote = false) => {
    const inpS = typeof inp === 'string' ? inp : JSON.stringify(inp ?? '');
    const k = classify(kind, name, inpS);
    if (!k) return;
    const o = (typeof inp === 'string' ? parse(inp) : inp) || {};
    if (k === 'edit') {
      c.edits++;
      if (hasPathKey(o, inpS)) c.editWithPath++;
      c.editInputs.push(canon(o, unquote) + (typeof inp === 'string' && !parse(inp) ? '|raw:' + inp : ''));
    } else if (k === 'shell') {
      c.shells++;
      if (o.command || o.CommandLine || o.cmd) c.shellWithCmd++;
    } else if (k === 'plan') {
      c.plans++;
      c.lastPlan = o;
    } else if (k === 'sub') c.subs++;
  };

  if (/jsonl|envelope/.test(fmt)) {
    const ls = s.source.path && lines(s.source.path);
    if (!ls) return null;
    const recs = ls.map(parse).filter(Boolean);
    if (fmt === 'claude-code/jsonl') {
      let usageSum = null, lastCost = null;
      const firstInner = (parts) => {
        for (const p of parts || []) {
          if (p?.type !== 'text' || !p.text) continue;
          const inner = peel(p.text);
          if (inner) return inner;
        }
        return null;
      };
      for (const o of recs) {
        if (o.isSidechain || o.isMeta) continue;
        if (o.type === 'user' && c.firstUser == null) {
          const ct = o.message?.content;
          const inner = typeof ct === 'string' ? peel(ct) : Array.isArray(ct) ? firstInner(ct) : null;
          if (inner) c.firstUser = inner.slice(0, 80);
        }
        if (o.type === 'assistant' && Array.isArray(o.message?.content)) {
          for (const b of o.message.content) {
            if (b.type === 'tool_use') count(b.name, b.input);
            if (b.type === 'text') md(b.text);
          }
          const u = o.message?.usage;
          if (u) {
            usageSum ||= { input: 0, output: 0, cached: 0, cacheWrite: 0 };
            usageSum.input += u.input_tokens || 0; usageSum.output += u.output_tokens || 0;
            usageSum.cached += u.cache_read_input_tokens || 0; usageSum.cacheWrite += u.cache_creation_input_tokens || 0;
          }
        }
        if (o.type === 'cost-state' && o.modelUsage) lastCost = o;
      }
      if (lastCost) {
        const t = { input: 0, output: 0, cached: 0, cacheWrite: 0 };
        for (const m of Object.values(lastCost.modelUsage)) { t.input += m.inputTokens || 0; t.output += m.outputTokens || 0; t.cached += m.cacheReadInputTokens || 0; t.cacheWrite += m.cacheCreationInputTokens || 0; }
        c.usage = t; c.usageHow = 'cost-state 汇总';
      } else if (usageSum) { c.usage = usageSum; c.usageHow = '逐条 usage 加总'; }
      return c;
    }
    if (fmt === 'codex/envelope') {
      let lastTok = null, agentMsgs = 0;
      for (const o of recs) {
        const p = o.type === 'response_item' ? o.payload : null;
        if (p) {
          if (p.type === 'message' && p.role === 'user' && c.firstUser == null) {
            const t = (p.content || []).filter((x) => x.type === 'input_text').map((x) => x.text).join('');
            const inner = peel(t);
            if (inner) c.firstUser = inner.slice(0, 80);
          }
          if (/^(custom_tool_call|function_call|local_shell_call)$/.test(p.type || '')) {
            const inp = typeof p.input === 'string' ? p.input : typeof p.arguments === 'string' ? p.arguments : p.action ? JSON.stringify(p.action) : JSON.stringify(p.input ?? '');
            count(p.name || '', inp);
          }
          if (p.type === 'message' && p.role === 'assistant') md((p.content || []).filter((x) => x.type === 'output_text' || x.type === 'text').map((x) => x.text).join(''));
          if (p.type === 'agent_message') agentMsgs++;
        }
        if (o.type === 'event_msg' && o.payload?.type === 'token_count' && o.payload.info?.total_token_usage) lastTok = o.payload.info.total_token_usage;
      }
      if (agentMsgs) c.subExtra = `另有无解密的 agent_message ×${agentMsgs}（原始即密文）`;
      if (lastTok) {
        c.usage = { input: lastTok.input_tokens || 0, output: (lastTok.output_tokens || 0) + (lastTok.reasoning_output_tokens || 0), cached: lastTok.cached_input_tokens || 0, cacheWrite: lastTok.cache_write_input_tokens || 0 };
        c.usageHow = '末次 token_count 累计';
      }
      return c;
    }
    if (fmt === 'antigravity/transcript-jsonl') {
      let uI = 0, uO = 0;
      for (const o of recs) {
        if (o.type === 'USER_INPUT' && c.firstUser == null) {
          const inner = peel(o.content);
          if (inner) c.firstUser = inner.slice(0, 80);
        }
        if (o.type !== 'PLANNER_RESPONSE') continue;
        for (const t of o.tool_calls || []) count(t.name, t.args, true);
        uI += o.input_tokens || 0; uO += o.output_tokens || 0;
        md(o.content);
      }
      if (uI || uO) { c.usage = { input: uI, output: uO, cached: 0, cacheWrite: 0 }; c.usageHow = 'PLANNER_RESPONSE token 加总'; }
      return c;
    }
    if (fmt === 'workbuddy/projects-jsonl') {
      let uI = 0, uO = 0;
      for (const o of recs) {
        if (o.type === 'message' && o.role === 'user' && c.firstUser == null) {
          const items = Array.isArray(o.content) ? o.content.map((x) => x.text) : [o.content];
          let inner = null;
          for (const t of items) { inner = peel(t); if (inner) break; }
          if (inner) c.firstUser = inner.slice(0, 80);
        }
        // 初始人话也存在 summary 记录里
        if (o.type === 'summary' && o.providerData?.source === 'initial-user-message' && c.firstUser == null) {
          const inner = peel(o.summary);
          if (inner) c.firstUser = inner.slice(0, 80);
        }
        if (o.type === 'function_call') count(o.name, o.arguments);
        if (o.type === 'message' && o.role === 'assistant') {
          const ct = Array.isArray(o.content) ? o.content.filter((x) => x.type === 'output_text' || x.type === 'text').map((x) => x.text).join('') : o.content;
          md(ct);
        }
        const u = o.providerData?.usage;
        if (u) { uI += u.inputTokens || 0; uO += u.outputTokens || 0; }
      }
      if (uI || uO) { c.usage = { input: uI, output: uO, cached: 0, cacheWrite: 0 }; c.usageHow = 'providerData.usage 加总'; }
      return c;
    }
    return null;
  }

  const d = s.source.path && db(s.source.path);
  if (!d) return null;
  try {
    if (fmt === 'zcode/sqlite') {
      const rows = d.prepare('SELECT m.data AS mdata, p.data AS pdata FROM message m LEFT JOIN part p ON p.message_id = m.id WHERE m.session_id = ? ORDER BY m.sequence, p.rowid').all(s.sourceId);
      for (const r of rows) {
        const m = parse(r.mdata);
        const p = r.pdata && parse(r.pdata);
        if (m && c.firstUser == null && m.role === 'user' && p?.type === 'text') {
          const inner = peel(p.text);
          if (inner) c.firstUser = inner.slice(0, 80);
        }
        if (m?.role === 'assistant' && p?.type === 'text') md(p.text);
        if (p?.type === 'tool') count(p.tool, p.state?.input);
      }
      const toks = d.prepare('SELECT data FROM message WHERE session_id = ?').all(s.sourceId);
      let uI = 0, uO = 0;
      for (const { data } of toks) {
        const u = parse(data)?.tokens;
        if (u) { uI += (u.input || 0) + (u.cachedInput || 0) + (u.cacheWrite || 0) + (u.cacheRead || 0); uO += (u.output || 0) + (u.reasoning || 0); }
      }
      if (uI || uO) { c.usage = { input: uI, output: uO, cached: 0, cacheWrite: 0 }; c.usageHow = 'message.tokens 加总'; }
      return c;
    }
    if (fmt === 'opencode/sqlite') {
      let uI = 0, uO = 0;
      let list2 = null;
      try {
        list2 = d.prepare('SELECT p.data AS pdata, m.data AS mdata FROM part p JOIN message m ON p.message_id = m.id WHERE p.session_id = ?').all(s.sourceId);
      } catch {
        list2 = d.prepare('SELECT data AS pdata, NULL AS mdata FROM part WHERE session_id = ?').all(s.sourceId);
      }
      for (const r of list2) {
        const p = parse(r.pdata);
        const m = r.mdata && parse(r.mdata);
        if (!p) continue;
        if (m?.role === 'assistant' && p.type === 'text') md(p.text);
        if (p.type === 'tool') count(p.tool, p.state?.input);
        if (p.type === 'step-finish' && p.tokens) { uI += p.tokens.input || 0; uO += p.tokens.output || 0; }
      }
      if (uI || uO) { c.usage = { input: uI, output: uO, cached: 0, cacheWrite: 0 }; c.usageHow = 'step-finish tokens 加总'; }
      return c;
    }
    if (fmt === 'hermes/state-sqlite') {
      const sess = d.prepare('SELECT * FROM sessions WHERE id = ?').get(s.sourceId);
      if (sess && (sess.input_tokens != null || sess.output_tokens != null)) {
        c.usage = { input: sess.input_tokens || 0, output: sess.output_tokens || 0, cached: sess.cache_read_tokens || 0, cacheWrite: sess.cache_write_tokens || 0 };
        c.usageHow = 'sessions 表 token 列';
      }
      const ms = d.prepare('SELECT role, content, tool_calls FROM messages WHERE session_id = ? ORDER BY rowid').all(s.sourceId);
      for (const m of ms) {
        if (m.role === 'user' && c.firstUser == null) {
          const inner = peel(m.content);
          if (inner) c.firstUser = inner.slice(0, 80);
        }
        if (m.role === 'assistant') md(m.content);
        if (m.tool_calls) {
          for (const call of parse(m.tool_calls) || []) {
            const f = call.function || {};
            count(f.name, typeof f.arguments === 'string' ? f.arguments : JSON.stringify(f.arguments ?? ''));
          }
        }
      }
      return c;
    }
  } catch {
    return null;
  }
  return null;
}

/** 网页同一份会话数据里数出同样的东西。 */
function parsed(s) {
  const kind = s.source.kind;
  const c = {
    edits: 0, editWithPath: 0, editInputs: [], editTrunc: 0,
    shells: 0, shellWithCmd: 0,
    plans: 0, lastPlan: null, lastPlanCut: false,
    subs: 0,
    mdFences: 0, mdHeads: 0,
    firstUser: null,
  };
  const md = (t) => {
    const x = String(t || '');
    c.mdFences += (x.match(/```/g) || []).length;
    c.mdHeads += (x.match(/^\s*#{1,6} /gm) || []).length;
  };
  const textOf = (v) => (v == null ? '' : typeof v === 'object' ? String(v.text ?? JSON.stringify(v)) : String(v));
  for (const t of s.turns || []) {
    const ti = peel(textOf(t.input));
    if (ti && c.firstUser == null) c.firstUser = ti.slice(0, 80);
    for (const x of t.steps || []) {
      if (x.kind === 'tool') {
        const inpS = String(x.input ?? '');
        const k = classify(kind, x.name, inpS);
        if (k === 'edit') {
          c.edits++;
          const o = parse(inpS) || {};
          if (hasPathKey(o, inpS)) c.editWithPath++;
          if (CUT_NOTE.test(inpS)) c.editTrunc++;
          c.editInputs.push(CUT_NOTE.test(inpS) ? 'cut' : canon(o) + (parse(inpS) ? '' : '|raw:' + inpS));
        } else if (k === 'shell') {
          c.shells++;
          const o = parse(inpS) || {};
          if (o.command || o.CommandLine || o.cmd || (inpS.trim() && inpS !== '{}')) c.shellWithCmd++;
        } else if (k === 'plan') {
          c.plans++;
          const o = parse(inpS);
          if (CUT_NOTE.test(inpS)) c.lastPlanCut = true;
          else if (o) c.lastPlan = o;
        } else if (k === 'sub') c.subs++;
      } else if (x.kind === 'model') {
        md(x.text);
      } else if (x.kind === 'message' && x.role === 'user' && c.firstUser == null) {
        const inner = peel(x.text);
        if (inner) c.firstUser = inner.slice(0, 80);
      }
    }
  }
  return c;
}

const list = (await get('/api/sessions?limit=2000')).sessions;
const byFam = {};
for (const s of list) {
  const fam = FAMILY[s.source.kind];
  const fresh = Date.now() - Date.parse(s.updatedAt || 0) < 5 * 60_000;
  if (!fam || fresh || s.state?.status === 'working' || !(s.stats?.turns > 0)) continue;
  (byFam[fam] ||= []).push(s);
}
const rows = [];
const report = [];
const searchMisses = [];
const pushRows = (fam, unit, r, route) => {
  const base = { by: 'probe_display_units.mjs', family: fam, capability: unit, result: r.res, condition: r.cond, evidence: r.ev, cmd: 'node channels/probe/scripts/probe_display_units.mjs --write' };
  rows.push({ ...base, layer: 'L2', route: `${fam}/L2/${route}`, surface: 'gateway-api' });
  if (r.res !== 'pass') rows.push({ ...base, layer: 'L3', route: `${fam}/L3/m`, surface: 'web', note: '网页照这份会话数据显示，后端缺的网页也缺' });
};

for (const fam of Object.values(FAMILY)) {
  const all = (byFam[fam] || []).sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  const pick = all.slice(0, PER);
  const biggest = [...all].sort((a, b) => (b.stats?.records || 0) - (a.stats?.records || 0))[0];
  if (biggest && !pick.includes(biggest)) pick.push(biggest);
  const agg = {
    sessions: 0, records: 0,
    rEdits: 0, edits: 0, editWithPath: 0, editTrunc: 0, editOk: 0, editMask: 0, editPairs: 0,
    rShells: 0, shells: 0, shellWithCmd: 0,
    rPlans: 0, plans: 0, planMatch: 0, planMismatch: 0, planCut: 0,
    rSubs: 0, subs: 0, childLinks: 0, subExtra: '',
    usageOk: 0, usageBad: 0, usageNone: 0, usageNotes: [],
    rMdFences: 0, mdFences: 0, rMdHeads: 0, mdHeads: 0,
    long: null,
  };
  const fmts = new Set();
  let rawN = 0;
  for (const sum of pick) {
    let s;
    try {
      s = (await get('/api/sessions/' + encodeURIComponent(sum.id))).session;
    } catch {
      continue;
    }
    agg.sessions++;
    agg.records += s.stats?.records || 0;
    fmts.add(s.source.format);
    const R = raw(s);
    if (!R) continue;
    rawN++;
    const P = parsed(s);
    agg.rEdits += R.edits; agg.edits += P.edits; agg.editWithPath += P.editWithPath; agg.editTrunc += P.editTrunc;
    const nPair = Math.min(R.editInputs.length, P.editInputs.length);
    agg.editPairs += nPair;
    for (let i = 0; i < nPair; i++) {
      const a = R.editInputs[i], b = P.editInputs[i];
      if (b === 'cut') { agg.editOk++; continue; }
      const ai = a.indexOf('|raw:'), bi = b.indexOf('|raw:');
      if (ai >= 0 || bi >= 0) {
        const ra = ai >= 0 ? a.slice(ai + 5) : a, rb = bi >= 0 ? b.slice(bi + 5) : b;
        if (ra === rb) { agg.editOk++; continue; }
      }
      if (a === b) { agg.editOk++; continue; }
      // 解析侧把敏感值显示成 [仅打码]，是有意的安全归一，不算丢内容
      if (b.includes('打码') && !a.includes('打码')) { agg.editMask++; continue; }
    }
    agg.rShells += R.shells; agg.shells += P.shells; agg.shellWithCmd += P.shellWithCmd;
    agg.rPlans += R.plans; agg.plans += P.plans;
    if (R.plans) {
      if (P.lastPlanCut) agg.planCut++;
      else if (canon(R.lastPlan ?? null, s.source.kind === 'antigravity') === canon(P.lastPlan ?? null)) agg.planMatch++;
      else agg.planMismatch++;
    }
    agg.rSubs += R.subs; agg.subs += P.subs;
    if (R.subExtra) agg.subExtra = R.subExtra;
    agg.childLinks += (sum.links || []).filter((l) => l.rel === 'child').length;
    agg.rMdFences += R.mdFences; agg.mdFences += P.mdFences;
    agg.rMdHeads += R.mdHeads; agg.mdHeads += P.mdHeads;
    if (R.usage) {
      const u = s.usage;
      if (!u || Object.keys(u).length === 0) {
        agg.usageNone++;
        agg.usageNotes.push(`解析无 usage，原始(${R.usageHow}) i:${R.usage.input}/o:${R.usage.output}`);
      } else {
        const din = Math.abs((u.input || 0) - R.usage.input) <= Math.max(1000, R.usage.input * 0.02);
        // opencode 的 step-finish output 不含 reasoning，直接对 u.output；其余家 output 含推理
        const rOut = s.source.kind === 'opencode' ? (u.output || 0) : (u.output || 0) + (u.reasoning || 0);
        const dout = Math.abs(rOut - R.usage.output) <= Math.max(1000, R.usage.output * 0.02);
        if (din && dout) agg.usageOk++;
        else { agg.usageBad++; agg.usageNotes.push(`解析 i:${u.input}/o:${u.output}，原始(${R.usageHow}) i:${R.usage.input}/o:${R.usage.output}`); }
      }
    }
  }

  // ui-long-history：最大的会话全量打开，最早的人话在
  if (biggest) {
    try {
      const d = (await get('/api/sessions/' + encodeURIComponent(biggest.id))).session;
      const R = raw(d), P = parsed(d);
      const records = d.stats?.records || 0;
      const turnsN = d.turns?.length || 0;
      const okOpen = turnsN > 0 && records > 0;
      let okFirst = null;
      if (R?.firstUser && P.firstUser) okFirst = normT(P.firstUser).includes(normT(R.firstUser).slice(0, 30)) || normT(R.firstUser).includes(normT(P.firstUser).slice(0, 30));
      agg.long = { records, turns: turnsN, okOpen, okFirst, big: records >= 400 };
    } catch (e) {
      agg.long = { err: String(e.message || e) };
    }
  }

  const cond = `抽 ${agg.sessions} 个会话（${[...fmts].join('、')}），${agg.records} 条记录，其中 ${rawN} 个对了原始记录`;
  const results = {};
  const add = (unit, res, ev) => { results[unit] = { res, ev, cond }; };

  if (rawN && agg.rEdits + agg.edits > 0) {
    const r = Math.min(ratio(agg.edits, agg.rEdits), agg.edits ? agg.editWithPath / agg.edits : 1, agg.editPairs ? (agg.editOk + agg.editMask) / agg.editPairs : 1);
    add('ui-diff', grade(r, 0.98, 0.9), `编辑调用 原始 ${agg.rEdits}，解析出 ${agg.edits}（有文件路径 ${agg.editWithPath}，注明截断 ${agg.editTrunc}；逐条内容一致 ${agg.editOk + agg.editMask}/${agg.editPairs}${agg.editMask ? "（其中敏感值打码 " + agg.editMask + "）" : ""}）`);
  }
  if (rawN && agg.rShells + agg.shells > 0) {
    const r = Math.min(ratio(agg.shells, agg.rShells), agg.shells ? agg.shellWithCmd / agg.shells : 1);
    add('ui-terminal-output', grade(r, 0.98, 0.9), `命令调用 原始 ${agg.rShells}，解析出 ${agg.shells}（命令可见 ${agg.shellWithCmd}）`);
  }
  if (rawN && agg.rSubs > 0) {
    if (fam === 'zcode') {
      add('ui-subagent-view', agg.childLinks > 0 ? 'pass' : 'fail', `Agent 调用 ${agg.rSubs} 次，父会话带子会话链接 ${agg.childLinks} 条`);
    } else {
      add('ui-subagent-view', 'fail', `子智能体调用 原始 ${agg.rSubs} 次（解析出调用卡 ${agg.subs}），子会话链接 0 条${fam === 'claude' ? '；子智能体转录在会话目录 subagents/agent-*.jsonl，扫描器没有读' : ''}${agg.subExtra ? '；' + agg.subExtra : ''}`);
    }
  }
  if (rawN && agg.rPlans > 0) {
    let res = 'pass';
    if (agg.planMismatch > 0) res = agg.planMismatch > agg.planMatch ? 'fail' : 'partial';
    else if (agg.planCut > 0) res = 'partial';
    add('ui-plan-view', res, `计划调用 原始 ${agg.rPlans}，解析出 ${agg.plans}；最后一条清单对上 ${agg.planMatch}，不一致 ${agg.planMismatch}，截断 ${agg.planCut}`);
  }
  if (rawN && agg.usageOk + agg.usageBad + agg.usageNone > 0) {
    let res;
    if (agg.usageNone > 0 && agg.usageOk === 0) res = 'fail';
    else if (agg.usageBad === 0 && agg.usageNone === 0) res = 'pass';
    else res = 'partial';
    add('ui-usage', res, `对上 ${agg.usageOk}，对不上 ${agg.usageBad}，解析无数字 ${agg.usageNone}${agg.usageNotes.length ? '；如 ' + agg.usageNotes.slice(0, 2).join('；') : ''}`);
  }
  if (rawN && agg.rMdFences + agg.rMdHeads > 10) {
    const r = Math.min(ratio(agg.mdFences, agg.rMdFences), ratio(agg.mdHeads, agg.rMdHeads));
    add('ui-markdown', grade(r, 0.9, 0.6), `原始模型文本 \`\`\`×${agg.rMdFences}、标题行×${agg.rMdHeads}，解析后 \`\`\`×${agg.mdFences}、标题行×${agg.mdHeads}`);
  }
  if (agg.long) {
    const L = agg.long;
    if (L.err) add('ui-long-history', 'fail', `最大会话打不开：${L.err}`);
    else if (L.big) add('ui-long-history', L.okOpen && L.okFirst !== false ? 'pass' : 'fail', `最大会话 ${L.records} 条记录 ${L.turns} 轮全量返回${L.okFirst == null ? '（最早一条人话两边没取到，没对）' : L.okFirst ? '，最早的人话在' : '，最早的人话不在'}`);
    else if (!L.okOpen) add('ui-long-history', 'fail', `最大会话只有 ${L.records} 条记录 ${L.turns} 轮，还没打开全`);
  }

  report.push({ fam, cond, results });
  for (const [unit, r] of Object.entries(results)) pushRows(fam, unit, r, 'server-api');

  // search-sessions：拿这家一个会话的关键词查
  {
    const sum = all.find((x) => (x.stats?.records || 0) > 30);
    if (sum) {
      try {
        const s = (await get('/api/sessions/' + encodeURIComponent(sum.id))).session;
        const kw = keyword(s);
        if (kw) {
          const hits = (await get('/api/search?q=' + encodeURIComponent(kw))).hits || [];
          if (!hits.some((h) => h.session === sum.id)) searchMisses.push({ fam, ev: `查「${kw}」，${sum.id} 不在前 ${hits.length} 条结果里` });
        }
      } catch (e) {
        searchMisses.push({ fam, ev: `搜索接口报错 ${e.message}` });
      }
    }
  }
}
function keyword(s) {
  const texts = [];
  for (const t of (s.turns || []).slice(0, 3)) {
    const ti = t.input == null ? '' : typeof t.input === 'object' ? String(t.input.text ?? '') : String(t.input);
    if (ti) texts.push(ti);
    for (const x of t.steps || []) if (x.kind === 'message' && x.role === 'user') texts.push(String(x.text || ''));
  }
  for (const t of texts) {
    const runs = t.match(/[\u4e00-\u9fff]{4,}/g) || [];
    if (runs.length) return runs.sort((a, b) => b.length - a.length)[0].slice(0, 8);
  }
  return null;
}
function normT(t) {
  return String(t || '').replace(/\s+/g, '');
}

// ---- project-view / ui-sidebar：各家原始存档对接口 ----
{
  const pvResults = {};
  const cond = '各家原始存档里本项目的会话数 / 全库会话数，对接口里的数目';

  const dirsOf = (dbf, table, col) => {
    const d = db(dbf);
    if (!d) return null;
    try {
      return d.prepare(`SELECT ${col} AS dir, COUNT(*) AS n FROM ${table} WHERE ${col} IS NOT NULL GROUP BY ${col}`).all().map((r) => [normP(r.dir), r.n]);
    } catch {
      return null;
    }
  };
  const apiInRepo = (kind) => list.filter((s) => s.source.kind === kind && normP(s.cwd || '').startsWith(normP(REPO))).length;
  const apiAll = (kind) => list.filter((s) => s.source.kind === kind).length;

  // claude / workbuddy：项目目录名前缀匹配，数该前缀下所有目录里的会话文件
  const countFilesUnder = (root, prefix, suffix, skipDir) => {
    let n = 0;
    const st = [root];
    while (st.length) {
      const dir = st.pop();
      let ents;
      try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch { continue; }
      for (const e of ents) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) {
          if (skipDir && e.name === skipDir) continue;
          st.push(p);
        } else if (e.isFile() && e.name.endsWith(suffix)) n++;
      }
    }
    return n;
  };
  // 简化：直接比较换算后的目录名前缀
  const dirMatches = (name, base, joint) => projKey(name, joint).startsWith(projKey(base, joint));
  const clRoot = path.join(HOME, '.claude', 'projects');
  let clRaw = 0;
  for (const d0 of fs.existsSync(clRoot) ? fs.readdirSync(clRoot) : []) {
    const p = path.join(clRoot, d0);
    if (fs.statSync(p).isDirectory() && dirMatches(d0, REPO, false)) clRaw += countFilesUnder(p, '', '.jsonl', 'subagents');
  }
  pvResults.claude = { raw: clRaw, api: apiInRepo('claude-code'), rawAll: countFilesUnder(clRoot, '', '.jsonl', 'subagents') };

  const wbRoot = path.join(HOME, '.workbuddy', 'projects');
  let wbRaw = 0;
  for (const d0 of fs.existsSync(wbRoot) ? fs.readdirSync(wbRoot) : []) {
    const p = path.join(wbRoot, d0);
    if (fs.statSync(p).isDirectory() && dirMatches(d0, REPO, true)) wbRaw += countFilesUnder(p, '', '.jsonl');
  }
  pvResults.workbuddy = { raw: wbRaw, api: apiInRepo('workbuddy'), rawAll: countFilesUnder(wbRoot, '', '.jsonl') };

  // codex：读每份 rollout 的 session_meta cwd
  let cdxRepo = 0, cdxAll = 0;
  const stack = [path.join(HOME, '.codex', 'sessions')];
  while (stack.length) {
    const dir = stack.pop();
    let ents;
    try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch { continue; }
    for (const e of ents) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) stack.push(p);
      else if (e.isFile() && /\.jsonl?$/.test(e.name)) {
        cdxAll++;
        const o = parse(lines(p)?.[0] || '');
        if (o?.payload?.cwd && normP(o.payload.cwd).startsWith(normP(REPO))) cdxRepo++;
      }
    }
  }
  pvResults.codex = { raw: cdxRepo, api: apiInRepo('codex'), rawAll: cdxAll };

  const inRepo = (dirs) => (dirs ? dirs.filter(([d]) => d.startsWith(normP(REPO))).reduce((a, [, n]) => a + n, 0) : -1);
  const zDirs = dirsOf(path.join(HOME, '.zcode', 'cli', 'db', 'db.sqlite'), 'session', 'directory');
  pvResults.zcode = { raw: inRepo(zDirs), api: apiInRepo('zcode'), rawAll: zDirs ? zDirs.reduce((a, [, n]) => a + n, 0) : -1 };
  const oDirs = dirsOf(path.join(HOME, '.local', 'share', 'opencode', 'opencode.db'), 'session', 'directory');
  pvResults.opencode = { raw: inRepo(oDirs), api: apiInRepo('opencode'), rawAll: oDirs ? oDirs.reduce((a, [, n]) => a + n, 0) : -1 };
  const hDbFile = path.join(HOME, 'AppData', 'Local', 'hermes', 'state.db');
  const hDirs = dirsOf(hDbFile, 'sessions', 'cwd');
  const hDb = db(hDbFile);
  pvResults.hermes = { raw: inRepo(hDirs), api: apiInRepo('hermes'), rawAll: hDb ? hDb.prepare('SELECT COUNT(*) AS n FROM sessions').get().n : -1 };

  // antigravity：原始 transcript 没有 cwd，只能对全库
  let agyAll = 0;
  const agyRoot = path.join(HOME, '.gemini', 'antigravity', 'brain');
  if (fs.existsSync(agyRoot)) for (const d0 of fs.readdirSync(agyRoot)) if (fs.existsSync(path.join(agyRoot, d0, '.system_generated', 'logs', 'transcript.jsonl'))) agyAll++;
  pvResults.antigravity = { raw: -1, api: apiAll('antigravity'), rawAll: agyAll };

  for (const [fam, v] of Object.entries(pvResults)) {
    const famName = FAMILY[fam] || fam;
    const apiTotal = apiAll(fam === 'claude' ? 'claude-code' : fam);
    const ratioAll = Math.min(v.rawAll / Math.max(1, apiTotal), apiTotal / Math.max(1, v.rawAll));
    if (fam === 'antigravity') {
      if (ratioAll < 0.8) pushRows(famName, 'ui-sidebar', { res: 'fail', cond, ev: `brain 目录里 ${v.rawAll} 份 transcript，接口里共 ${apiTotal} 个` }, 'server-api');
      continue; // project-view 没有原始 cwd，不写
    }
    const ratioRepo = Math.min(v.raw / Math.max(1, v.api), v.api / Math.max(1, v.raw));
    const res = ratioRepo >= 0.8 && ratioAll >= 0.8 ? 'pass' : ratioRepo >= 0.5 && ratioAll >= 0.5 ? 'partial' : 'fail';
    pushRows(famName, 'project-view', { res, cond, ev: `本项目 原始存档 ${v.raw} 个会话，接口里 ${v.api} 个` }, 'server-api');
    pushRows(famName, 'ui-sidebar', { res, cond, ev: `全库 原始存档 ${v.rawAll} 个会话，接口里 ${apiTotal} 个` }, 'server-api');
  }
  report.push({ fam: '（跨家）', cond, results: Object.fromEntries(Object.entries(pvResults).map(([k, v]) => [k, `本项目 原始${v.raw}/接口${v.api}${v.rawAll != null ? '；全库 原始' + v.rawAll + '/接口' + apiAll(k === 'claude' ? 'claude-code' : k) : ''}`])) });
}

for (const r of report) {
  console.log(`\n${r.fam}  ${r.cond || ''}`);
  for (const [u, x] of Object.entries(r.results || {})) console.log(`  ${u.padEnd(20)} ${typeof x === 'string' ? x : x.res + '  ' + x.ev}`);
}
if (searchMisses.length) {
  console.log('\nsearch-sessions 没找到的：');
  for (const m of searchMisses) console.log(`  ${m.fam}  ${m.ev}`);
  for (const m of searchMisses) {
    const base = { by: 'probe_display_units.mjs', family: m.fam, capability: 'search-sessions', result: 'fail', condition: '拿会话里的关键词查 /api/search', evidence: m.ev, cmd: 'node channels/probe/scripts/probe_display_units.mjs --write' };
    rows.push({ ...base, layer: 'L2', route: `${m.fam}/L2/search-api`, surface: 'gateway-api' });
    rows.push({ ...base, layer: 'L3', route: `${m.fam}/L3/m`, surface: 'web', note: '网页照这份检索结果显示' });
  }
}
if (WRITE && rows.length) {
  const res = await (await fetch(BASE + '/api/gateway/records', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ kind: 'blackboard', rows }) })).json();
  console.log(`\n写入黑板 ${res.appended || 0} 行${res.errors && res.errors.length ? `，${res.errors.length} 行没收下：${JSON.stringify(res.errors.slice(0, 3))}` : ''}`);
} else {
  console.log(`\n${rows.length} 行待写（加 --write 写入黑板）`);
}
