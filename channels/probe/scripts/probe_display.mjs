#!/usr/bin/env node
// 读取显示的回归：每家抽几个真实会话，拿网页显示用的同一份会话数据（GET /api/sessions/<id>）照单元判据核对，
// 能读原始文件的格式再按条对数。10-19 起这样测，因为 Antigravity 的“读历史”“工具调用卡片”在矩阵上标着通过，
// 实际工具结果全丢、系统通知冒充人话——当时的证据只是页面能打开。
//
//   node channels/probe/scripts/probe_display.mjs [--base http://127.0.0.1:8899] [--per 6] [--write]
//
// 单元与判据（hub/data/capability-units.json）：
//   observe-history  读回全部轮次，丢弃为零：解析器报的“未识别”记录、系统通知被当成人说的话
//   observe-steps    记录里有的步骤都能读到：原始工具调用数对解析出的工具步骤数；有回复的轮要有模型步骤
//   ui-tool-card     每次调用都有卡，参数和结果能看全：工具步骤的参数、结果
//   ui-thinking      记录里有思考的能展开看到：原始思考块数对解析出的思考
// 能读原始文件（claude-code、codex、antigravity 的 jsonl）的，结果照写黑板；只看解析结果的格式只在发现问题时写，
// 不写“通过”——没对原始记录就不算证实。后端（L2）不合格的，网页（L3）同记不合格：网页照这份数据显示。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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

/** Counts from the original file, for the formats that are plain jsonl; null when the format is not read here. */
function rawCounts(s) {
  const fmt = s.source.format;
  const ls = s.source.path && lines(s.source.path);
  if (!ls) return null;
  const c = { tools: 0, thinking: 0 };
  if (fmt === 'claude-code/jsonl') {
    for (const o of ls.map(parse)) {
      if (!o || o.type !== 'assistant' || o.isSidechain || !Array.isArray(o.message?.content)) continue;
      for (const b of o.message.content) {
        if (b.type === 'tool_use') c.tools++;
        if (b.type === 'thinking' && String(b.thinking || '').trim()) c.thinking++;
      }
    }
    return c;
  }
  if (fmt === 'codex/envelope') {
    for (const o of ls.map(parse)) {
      const p = o?.type === 'response_item' ? o.payload : null;
      if (!p) continue;
      if (TOOL_ITEM.has(p.type)) c.tools++;
      if (p.type === 'reasoning' && (p.summary || []).some((x) => String(x?.text || '').trim())) c.thinking++;
    }
    return c;
  }
  if (fmt === 'antigravity/transcript-jsonl') {
    for (const o of ls.map(parse)) {
      if (o?.type !== 'PLANNER_RESPONSE') continue;
      c.tools += Array.isArray(o.tool_calls) ? o.tool_calls.length : 0;
      if (String(o.thinking || '').trim()) c.thinking++;
    }
    return c;
  }
  return null;
}

/** What the page shows, counted. */
function parsedCounts(s) {
  const c = { tools: 0, toolNoInput: 0, toolNoOutput: 0, thinking: 0, notPerson: [], outputNoModel: 0, unknown: 0, unknownKinds: [] };
  const turns = s.turns || [];
  turns.forEach((t, ti) => {
    const last = ti === turns.length - 1;
    let model = 0;
    for (const x of t.steps || []) {
      if (x.kind === 'tool') {
        c.tools++;
        if (!String(x.input || '').trim()) c.toolNoInput++;
        // The last turn of a session may have a call still waiting for its result.
        if (!String(x.output || '').trim() && x.status !== 'error' && !last) c.toolNoOutput++;
      } else if (x.kind === 'model') {
        model++;
        if (String(x.reasoning || '').trim()) c.thinking++;
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
function grade(r, pass, partial) {
  return r >= pass ? 'pass' : r >= partial ? 'partial' : 'fail';
}

const list = (await get('/api/sessions?limit=2000')).sessions;
const byFam = {};
for (const s of list) {
  const fam = FAMILY[s.source.kind];
  if (!fam || s.state?.status === 'working' || !(s.stats?.turns > 0)) continue;
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
    for (const k of ['tools', 'toolNoInput', 'toolNoOutput', 'thinking', 'outputNoModel', 'unknown']) agg[k] += p[k];
    agg.notPerson.push(...p.notPerson);
    agg.unknownKinds.push(...p.unknownKinds);
    const raw = rawCounts(s);
    if (raw) {
      agg.raw ||= { tools: 0, thinking: 0, parsedTools: 0, parsedThinking: 0 };
      agg.raw.tools += raw.tools;
      agg.raw.thinking += raw.thinking;
      agg.raw.parsedTools += p.tools;
      agg.raw.parsedThinking += p.thinking;
    }
  }
  if (!agg.sessions) {
    report.push({ fam, note: '没有可测的会话' });
    continue;
  }
  const raw = agg.raw;
  const cond = `抽 ${agg.sessions} 个会话（${[...fmts].join('、')}），${agg.records} 条记录`;
  const results = {};
  // observe-history
  {
    const bad = agg.notPerson.length;
    const share = agg.unknown / Math.max(1, agg.records);
    const res = bad ? 'fail' : agg.unknown === 0 ? 'pass' : share <= 0.01 ? 'partial' : 'fail';
    results['observe-history'] = { res, raw: true, ev: `未识别 ${agg.unknown} 条（${agg.unknownKinds.slice(0, 4).join('、') || '无'}）；非本人的话被当成人说的 ${bad} 条${bad ? '：' + agg.notPerson.slice(0, 2).join(' / ') : ''}` };
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
    const r = 1 - (agg.toolNoOutput + agg.toolNoInput) / Math.max(1, agg.tools);
    let res = grade(r, 0.99, 0.9);
    if (raw && res === 'pass' && Math.abs(raw.tools - raw.parsedTools) > raw.tools * 0.02) res = 'partial';
    const ev = `工具步骤 ${agg.tools}：没有参数 ${agg.toolNoInput}、没有结果 ${agg.toolNoOutput}${raw ? `；原始调用 ${raw.tools}` : '（没对原始记录）'}`;
    if (raw || res !== 'pass') results['ui-tool-card'] = { res, raw: !!raw, ev };
  }
  // ui-thinking
  if (raw && raw.thinking) {
    results['ui-thinking'] = { res: grade(ratio(raw.parsedThinking, raw.thinking), 0.95, 0.5), raw: true, ev: `原始思考 ${raw.thinking} 段，解析出 ${raw.parsedThinking} 段` };
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
  console.log(`\n${r.fam}  ${r.cond || r.note}${r.contractOnly ? '  〔只看解析结果，没对原始记录〕' : ''}`);
  for (const [u, x] of Object.entries(r.results || {})) console.log(`  ${x.res.padEnd(8)} ${u.padEnd(16)} ${x.ev}`);
}
if (WRITE && rows.length) {
  fs.appendFileSync(BLACKBOARD, rows.map((r) => JSON.stringify(r)).join('\n') + '\n');
  console.log(`\n写入黑板 ${rows.length} 行`);
} else {
  console.log(`\n${rows.length} 行待写（加 --write 写入黑板）`);
}
