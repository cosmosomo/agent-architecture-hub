#!/usr/bin/env node
// 读取显示的回归：每家抽几个真实会话，拿网页显示用的同一份会话数据（GET /api/sessions/<id>）照单元判据核对，
// 再按条对原始记录。10-19 起这样测，因为 Antigravity 的“读历史”“工具调用卡片”在矩阵上标着通过，实际工具结果
// 全丢、系统通知冒充人话——当时的证据只是页面能打开。
//
//   node channels/probe/scripts/probe_display.mjs [--base http://127.0.0.1:8899] [--per 6] [--write]
//
// 单元与判据（hub/data/capability-units.json）：
//   observe-history  读回全部轮次，丢弃为零：解析器报的“未识别”记录、系统通知被当成人说的话
//   observe-steps    记录里有的步骤都能读到：原始工具调用数对解析出的工具步骤数；有回复的轮要有模型步骤
//   ui-tool-card     每次调用都有卡，参数和结果能看全：工具步骤的参数、结果
//   ui-thinking      记录里有思考的能展开看到：原始思考的字数对解析出的思考字数（有的格式把连着的几段并成一段）
// 原始记录按格式数：claude-code、codex、antigravity、workbuddy 的 jsonl，zcode、opencode、hermes 的 sqlite。
// 认得出来、解析器却不显示的原始种类（如 zcode 的 timeline、opencode 的 patch）列在证据里，不计分。
// 没对上原始记录的格式只在发现问题时写黑板，不写“通过”。后端（L2）不合格的，网页（L3）同记不合格：网页照这份数据显示。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const args = process.argv.slice(2);
const opt = (k, d) => {
  const i = args.indexOf(k);
  return i >= 0 ? args[i + 1] : d;
};
if (args.includes('--help')) {
  console.log('node channels/probe/scripts/probe_display.mjs [--base URL] [--per N] [--write]');
  process.exit(0);
}
const BASE = opt('--base', process.env.HUB_BASE || 'http://127.0.0.1:8899');
const PER = Number(opt('--per', 6));
const WRITE = args.includes('--write');
const BLACKBOARD = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'blackboard.jsonl');

const FAMILY = { 'claude-code': 'claude', codex: 'codex', antigravity: 'antigravity', zcode: 'zcode', workbuddy: 'workbuddy', opencode: 'opencode', hermes: 'hermes' };
// Words that are not the person's: product notices, sub-agent reports, harness wrappers.
const NOT_PERSON = /^\s*(\[Notice\]|The subagent .+ with id "|Task id ".+" finished|<SYSTEM_MESSAGE>|The following is a <SYSTEM_MESSAGE>)/;
const TOOL_ITEM = new Set(['function_call', 'custom_tool_call', 'local_shell_call', 'web_search_call', 'mcp_tool_call']);
// Part kinds of the sqlite formats that are bookkeeping, not content.
const PART_PLUMBING = new Set(['step-start', 'step-finish', 'text', 'tool', 'reasoning']);

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
const has = (v) => (typeof v === 'string' ? v.trim().length > 0 : Array.isArray(v) ? v.some((x) => has(typeof x === 'string' ? x : x?.text ?? (x?.type === 'image' ? 'img' : ''))) : v != null && typeof v === 'object');
const len = (t) => String(t || '').replace(/\s+/g, '').length;
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

/** Counts from the original record: tool calls, characters of thinking, other content kinds. Null when not read here. */
function rawCounts(s) {
  const fmt = s.source.format;
  // results: calls whose result in the record is not empty (some tools return nothing by design).
  // modelOnly: the starts of texts the record marks as written for the model only; they must not show as the person's words.
  const c = { tools: 0, results: 0, thinking: 0, other: {}, modelOnly: [] };
  const other = (k) => (c.other[k] = (c.other[k] || 0) + 1);
  if (/jsonl|envelope/.test(fmt)) {
    const ls = s.source.path && lines(s.source.path);
    if (!ls) return null;
    const recs = ls.map(parse).filter(Boolean);
    if (fmt === 'claude-code/jsonl') {
      for (const o of recs) {
        if (o.type !== 'assistant' || o.isSidechain || !Array.isArray(o.message?.content)) continue;
        for (const b of o.message.content) {
          if (b.type === 'tool_use') c.tools++;
          if (b.type === 'thinking') c.thinking += len(b.thinking);
        }
      }
      for (const o of recs) {
        if (o.type !== 'user' || o.isSidechain || !Array.isArray(o.message?.content)) continue;
        for (const b of o.message.content) if (b.type === 'tool_result' && has(b.content)) c.results++;
      }
      return c;
    }
    if (fmt === 'codex/envelope') {
      for (const o of recs) {
        const p = o.type === 'response_item' ? o.payload : null;
        if (!p) continue;
        if (TOOL_ITEM.has(p.type)) c.tools++;
        if (/_output$/.test(p.type) && has(p.output)) c.results++;
        if (p.type === 'reasoning') c.thinking += len((p.summary || []).map((x) => x?.text).join(''));
      }
      return c;
    }
    if (fmt === 'antigravity/transcript-jsonl') {
      for (const o of recs) {
        if (o.type === 'GENERIC' && o.source === 'MODEL' && (has(o.content) || has(o.error))) c.results++;
        if (o.type !== 'PLANNER_RESPONSE') continue;
        c.tools += Array.isArray(o.tool_calls) ? o.tool_calls.length : 0;
        c.thinking += len(o.thinking);
      }
      return c;
    }
    if (fmt === 'workbuddy/projects-jsonl') {
      for (const o of recs) {
        if (o.type === 'function_call') c.tools++;
        else if (o.type === 'function_call_result') {
          if (has(o.output) || has(o.content) || has(o.result)) c.results++;
        } else if (o.type === 'reasoning') {
          const items = Array.isArray(o.rawContent) ? o.rawContent : Array.isArray(o.content) ? o.content : [];
          c.thinking += len(items.map((x) => x?.text).join(''));
        } else if (o.type && o.type !== 'message') other(o.type);
      }
      return c;
    }
    return null;
  }
  const d = s.source.path && db(s.source.path);
  if (!d) return null;
  try {
    if (fmt === 'zcode/sqlite' || fmt === 'opencode/sqlite') {
      const parts =
        fmt === 'zcode/sqlite'
          ? d.prepare('SELECT p.data AS data FROM part p JOIN message m ON m.id = p.message_id WHERE m.session_id = ?').all(s.sourceId)
          : d.prepare('SELECT data FROM part WHERE session_id = ?').all(s.sourceId);
      for (const { data } of parts) {
        const p = parse(data);
        if (!p) continue;
        if (p.type === 'tool') {
          c.tools++;
          if (has(p.state?.output) || has(p.state?.error)) c.results++;
        } else if (p.type === 'reasoning') c.thinking += len(p.text);
        else if (p.type === 'text' && p.metadata?.visibility === 'model-only' && has(p.text)) c.modelOnly.push(String(p.text).trim().slice(0, 40));
        if (!PART_PLUMBING.has(p.type)) other(p.type);
      }
      return c;
    }
    if (fmt === 'hermes/state-sqlite') {
      for (const m of d.prepare("SELECT tool_calls, reasoning, reasoning_content FROM messages WHERE session_id = ? AND role = 'assistant'").all(s.sourceId)) {
        const calls = parse(m.tool_calls || '[]');
        c.tools += Array.isArray(calls) ? calls.length : 0;
        c.thinking += len(m.reasoning || m.reasoning_content);
      }
      c.results = d.prepare("SELECT COUNT(*) AS n FROM messages WHERE session_id = ? AND role = 'tool' AND TRIM(COALESCE(content, '')) <> ''").get(s.sourceId).n;
      return c;
    }
  } catch {
    return null;
  }
  return null;
}

/** What the page shows, counted. */
function parsedCounts(s) {
  const c = { tools: 0, toolWithOutput: 0, toolNoInput: 0, toolNoOutput: 0, thinking: 0, thinkingCut: 0, thinkingCutChars: 0, compactions: 0, notPerson: [], outputNoModel: 0, unknown: 0, unknownKinds: [] };
  const turns = s.turns || [];
  turns.forEach((t, ti) => {
    const last = ti === turns.length - 1;
    let model = 0;
    for (const x of t.steps || []) {
      if (x.kind === 'tool') {
        c.tools++;
        if (!String(x.input || '').trim()) c.toolNoInput++;
        if (String(x.output || '').trim()) c.toolWithOutput++;
        // The last turn of a session may have a call still waiting for its result.
        if (!String(x.output || '').trim() && x.status !== 'error' && !last) c.toolNoOutput++;
      } else if (x.kind === 'model') {
        model++;
        c.thinking += len(x.reasoning);
        // Text over the display limit is cut with a note of its original length (adapters' LIMITS.text): known, shown.
        const cutm = /…（截断，原长 (\d+) 字）\s*$/.exec(String(x.reasoning || ''));
        if (cutm) {
          c.thinkingCut++;
          c.thinkingCutChars += Math.max(0, Number(cutm[1]) - String(x.reasoning).length);
        }
      } else if (x.kind === 'event' && x.name === 'compaction') {
        c.compactions++;
      } else if (x.kind === 'message' && x.role === 'user' && NOT_PERSON.test(String(x.text || ''))) {
        c.notPerson.push(String(x.text).slice(0, 60));
      }
    }
    if (String(t.output || '').trim() && !model) c.outputNoModel++;
  });
  for (const n of s.notes || []) {
    const m = /^未识别 (.+) × (\d+)$/.exec(String(n));
    if (m) {
      c.unknown += Number(m[2]);
      c.unknownKinds.push(`${m[1]}×${m[2]}`);
    }
  }
  return c;
}

const ratio = (a, b) => (b ? a / b : 1);
const grade = (r, pass, partial) => (r >= pass ? 'pass' : r >= partial ? 'partial' : 'fail');
const sumKinds = (list) => {
  const m = {};
  for (const k of list) {
    const [name, n] = k.split('×');
    m[name] = (m[name] || 0) + Number(n);
  }
  return Object.entries(m).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k}×${n}`);
};

const list = (await get('/api/sessions?limit=2000')).sessions;
const byFam = {};
for (const s of list) {
  const fam = FAMILY[s.source.kind];
  // A session written to in the last five minutes would be read twice at different moments (the page's data, then
  // the raw record) and differ by what came in between.
  const fresh = Date.now() - Date.parse(s.updatedAt || 0) < 5 * 60_000;
  if (!fam || fresh || s.state?.status === 'working' || !(s.stats?.turns > 0)) continue;
  (byFam[fam] ||= []).push(s);
}
const rows = [];
const now = new Date().toISOString();
const report = [];
for (const fam of Object.values(FAMILY)) {
  const all = (byFam[fam] || []).sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  const pick = all.slice(0, PER);
  const biggest = [...all].sort((a, b) => (b.stats?.records || 0) - (a.stats?.records || 0))[0];
  if (biggest && !pick.includes(biggest)) pick.push(biggest);
  const agg = { sessions: 0, records: 0, raw: null, ...parsedCounts({}) };
  const fmts = new Set();
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
    const p = parsedCounts(s);
    for (const k of ['tools', 'toolWithOutput', 'toolNoInput', 'toolNoOutput', 'thinking', 'thinkingCut', 'thinkingCutChars', 'compactions', 'outputNoModel', 'unknown']) agg[k] += p[k];
    agg.notPerson.push(...p.notPerson);
    agg.unknownKinds.push(...p.unknownKinds);
    const raw = rawCounts(s);
    if (raw?.modelOnly.length) {
      const said = (s.turns || []).flatMap((t) => (t.steps || []).filter((x) => x.kind === 'message' && x.role === 'user').map((x) => String(x.text || '')));
      for (const m of new Set(raw.modelOnly)) if (said.some((w) => w.includes(m))) agg.notPerson.push('只给模型看的：' + m);
    }
    if (raw) {
      agg.raw ||= { sessions: 0, tools: 0, results: 0, thinking: 0, parsedTools: 0, parsedResults: 0, parsedThinking: 0, other: {} };
      agg.raw.sessions++;
      agg.raw.tools += raw.tools;
      agg.raw.thinking += raw.thinking;
      agg.raw.parsedTools += p.tools;
      agg.raw.results += raw.results;
      agg.raw.parsedResults += p.toolWithOutput;
      agg.raw.parsedThinking += p.thinking;
      for (const [k, n] of Object.entries(raw.other)) agg.raw.other[k] = (agg.raw.other[k] || 0) + n;
    }
  }
  if (!agg.sessions) {
    report.push({ fam, note: '没有可测的会话' });
    continue;
  }
  const raw = agg.raw;
  // Compactions are checked against the compaction events the page shows; other kinds are only listed.
  const rawCompactions = raw?.other.compaction || 0;
  const otherKinds = raw ? Object.entries(raw.other).filter(([k]) => k !== 'compaction').map(([k, n]) => `${k}×${n}`).join('、') : '';
  const cond = `抽 ${agg.sessions} 个会话（${[...fmts].join('、')}），${agg.records} 条记录${raw ? `，其中 ${raw.sessions} 个对了原始记录` : ''}`;
  const results = {};
  // observe-history
  {
    const bad = agg.notPerson.length;
    const share = agg.unknown / Math.max(1, agg.records);
    let res = bad ? 'fail' : agg.unknown === 0 ? 'pass' : share <= 0.01 ? 'partial' : 'fail';
    if (res === 'pass' && rawCompactions > agg.compactions) res = 'partial';
    results['observe-history'] = {
      res,
      raw: !!raw,
      ev: `未识别 ${agg.unknown} 条（${sumKinds(agg.unknownKinds).slice(0, 4).join('、') || '无'}）；非本人的话被当成人说的 ${bad} 条${bad ? '：' + agg.notPerson.slice(0, 2).join(' / ') : ''}${rawCompactions ? `；原始压缩 ${rawCompactions} 次，显示出压缩事件 ${agg.compactions} 个` : ''}${otherKinds ? `；原始记录里另有 ${otherKinds}（未核对是否显示）` : ''}`,
    };
  }
  // observe-steps
  if (raw) {
    const r = Math.min(ratio(raw.parsedTools, raw.tools), ratio(raw.tools, raw.parsedTools));
    const res = agg.outputNoModel ? 'partial' : grade(r, 0.98, 0.9);
    results['observe-steps'] = { res, raw: true, ev: `原始工具调用 ${raw.tools}，解析出 ${raw.parsedTools}；有回复却没有模型步骤的轮 ${agg.outputNoModel}` };
  } else if (agg.outputNoModel) {
    results['observe-steps'] = { res: 'partial', raw: false, ev: `有回复却没有模型步骤的轮 ${agg.outputNoModel}（没对原始记录）` };
  }
  // ui-tool-card
  {
    // With the record at hand, a missing result is one the record has and the page does not; without it, any empty one.
    const missing = raw ? Math.max(0, raw.results - raw.parsedResults) : agg.toolNoOutput;
    const r = 1 - (missing + agg.toolNoInput) / Math.max(1, agg.tools);
    let res = grade(r, 0.99, 0.9);
    if (raw && res === 'pass' && Math.abs(raw.tools - raw.parsedTools) > raw.tools * 0.02) res = 'partial';
    const ev = raw
      ? `工具步骤 ${agg.tools}（原始调用 ${raw.tools}）：没有参数 ${agg.toolNoInput}；原始有结果的 ${raw.results} 个，显示出结果 ${raw.parsedResults} 个`
      : `工具步骤 ${agg.tools}：没有参数 ${agg.toolNoInput}、没有结果 ${agg.toolNoOutput}（没对原始记录）`;
    if (raw || res !== 'pass') results['ui-tool-card'] = { res, raw: !!raw, ev };
  }
  // ui-thinking
  if (raw && raw.thinking) {
    // What is missing beyond the cuts the page itself notes is what counts.
    const shown = raw.parsedThinking + agg.thinkingCutChars;
    results['ui-thinking'] = {
      res: grade(ratio(Math.min(shown, raw.thinking), raw.thinking), 0.99, 0.5),
      raw: true,
      ev: `原始思考 ${raw.thinking} 字，解析出 ${raw.parsedThinking} 字${agg.thinkingCut ? `；${agg.thinkingCut} 段超过显示上限、按原长注明截断（约 ${agg.thinkingCutChars} 字）` : ''}`,
    };
  }
  report.push({ fam, cond, results, contractOnly: !raw });
  for (const [unit, r] of Object.entries(results)) {
    if (!r.raw && r.res === 'pass') continue;
    const base = { at: now, by: 'probe_display.mjs', family: fam, capability: unit, result: r.res, condition: cond, evidence: r.ev, cmd: 'node channels/probe/scripts/probe_display.mjs --write' };
    rows.push({ ...base, layer: 'L2', route: `${fam}/L2/server-api`, surface: 'gateway-api' });
    if (r.res !== 'pass') rows.push({ ...base, layer: 'L3', route: `${fam}/L3/m`, surface: 'web', note: '网页照这份会话数据显示，后端缺的网页也缺' });
  }
}

for (const r of report) {
  console.log(`\n${r.fam}  ${r.cond || r.note}${r.contractOnly ? '  〔没对原始记录〕' : ''}`);
  for (const [u, x] of Object.entries(r.results || {})) console.log(`  ${x.res.padEnd(8)} ${u.padEnd(16)} ${x.ev}`);
}
if (WRITE && rows.length) {
  fs.appendFileSync(BLACKBOARD, rows.map((r) => JSON.stringify(r)).join('\n') + '\n');
  console.log(`\n写入黑板 ${rows.length} 行`);
} else {
  console.log(`\n${rows.length} 行待写（加 --write 写入黑板）`);
}
