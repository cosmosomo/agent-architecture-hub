#!/usr/bin/env node
// census_codex_claude.mjs — Codex & Claude Code harness 会话考古·全量普查
// 只读：不改任何会话文件、不起停任何进程。数字可复跑。
// 产出：channels/research/harness/codex-census.json、claude-code-census.json

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const HOME = os.homedir();
const OUT = path.resolve(import.meta.dirname, '../../../research/harness');
fs.mkdirSync(OUT, { recursive: true });
const STR_MAX = 80;
const SECRET = /key|token|secret|authorization|password|credential/i;

function sanitize(v, depth = 0) {
  if (v === null || v === undefined) return v;
  if (typeof v === 'string') return v.length > STR_MAX ? v.slice(0, STR_MAX) + `…(${v.length})` : v;
  if (typeof v !== 'object') return v;
  if (depth > 3) return '[depth]';
  if (Array.isArray(v)) return v.slice(0, 5).map((x) => sanitize(x, depth + 1));
  const o = {};
  for (const [k, val] of Object.entries(v)) o[k] = SECRET.test(k) ? '[REDACTED]' : sanitize(val, depth + 1);
  return o;
}
function parseMaybeJson(s) { try { return JSON.parse(s); } catch { return null; } }

function findJsonlFiles(dir, maxFiles = Infinity) {
  const files = [];
  if (!fs.existsSync(dir)) return files;
  function walk(d) {
    if (files.length >= maxFiles) return;
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (files.length >= maxFiles) break;
      const p = path.join(d, e.name);
      if (e.isDirectory()) {
        walk(p);
      } else if (e.name.endsWith('.jsonl')) {
        files.push(p);
      }
    }
  }
  walk(dir);
  return files;
}

// JSONL 目录普查（按行 type 计数）
function censusJsonlDir(dir, { typeKey = 'type', maxFiles = Infinity } = {}) {
  const res = { kind: 'jsonl-dir', path: dir, files: 0, lines: 0, typeCounts: {}, unparsable: 0, sample: null };
  const files = findJsonlFiles(dir, maxFiles);
  res.files = files.length;
  for (const p of files) {
    const content = fs.readFileSync(p, 'utf8');
    for (const line of content.split(/\r?\n/)) {
      if (!line.trim()) continue;
      res.lines++;
      const j = parseMaybeJson(line);
      const ty = j?.[typeKey] ?? j?.role ?? '(none)';
      res.typeCounts[ty] = (res.typeCounts[ty] || 0) + 1;
      if (!j) res.unparsable++;
      if (!res.sample && j) res.sample = sanitize(j);
    }
  }
  res.typeCounts = Object.fromEntries(Object.entries(res.typeCounts).sort((a, b) => b[1] - a[1]).slice(0, 80));
  return res;
}

// Codex 特有：按 type 字段的子类型也统计
function censusCodexDetail(dir) {
  const res = {
    kind: 'codex-jsonl',
    path: dir,
    files: 0,
    lines: 0,
    topTypes: {},
    eventMsgTypes: {},
    responseItemTypes: {},
    itemCompletedTypes: {},
    unparsable: 0,
    sample: null
  };
  if (!fs.existsSync(dir)) return { ...res, missing: true };
  const files = findJsonlFiles(dir);
  res.files = files.length;
  for (const p of files) {
    const content = fs.readFileSync(p, 'utf8');
    for (const line of content.split(/\r?\n/)) {
      if (!line.trim()) continue;
      res.lines++;
      const j = parseMaybeJson(line);
      if (!j) { res.unparsable++; continue; }
      const t = j.type;
      if (t) res.topTypes[t] = (res.topTypes[t] || 0) + 1;

      if (t === 'event_msg' && j.payload) {
        const et = j.payload.type;
        if (et) res.eventMsgTypes[et] = (res.eventMsgTypes[et] || 0) + 1;
        if (et === 'item_completed' && j.payload.item) {
          const it = j.payload.item.type;
          if (it) res.itemCompletedTypes[it] = (res.itemCompletedTypes[it] || 0) + 1;
        }
      } else if (t === 'response_item' && j.payload) {
        const rt = j.payload.type;
        if (rt) res.responseItemTypes[rt] = (res.responseItemTypes[rt] || 0) + 1;
      }

      if (!res.sample && j) res.sample = sanitize(j);
    }
  }
  res.topTypes = Object.fromEntries(Object.entries(res.topTypes).sort((a,b)=>b[1]-a[1]).slice(0,40));
  res.eventMsgTypes = Object.fromEntries(Object.entries(res.eventMsgTypes).sort((a,b)=>b[1]-a[1]).slice(0,40));
  res.responseItemTypes = Object.fromEntries(Object.entries(res.responseItemTypes).sort((a,b)=>b[1]-a[1]).slice(0,40));
  res.itemCompletedTypes = Object.fromEntries(Object.entries(res.itemCompletedTypes).sort((a,b)=>b[1]-a[1]).slice(0,40));
  return res;
}

// 文件型工件（记忆/设置/检查点）
function fileList(paths) {
  const out = [];
  for (const p of paths) {
    try {
      if (!fs.existsSync(p)) continue;
      const st = fs.statSync(p);
      if (st.isDirectory()) {
        function walk(d) {
          for (const e of fs.readdirSync(d, { withFileTypes: true })) {
            const q = path.join(d, e.name);
            try {
              const qs = fs.statSync(q);
              if (qs.isDirectory()) walk(q);
              else out.push({ file: q, bytes: qs.size });
            } catch {}
          }
        }
        walk(p);
      } else out.push({ file: p, bytes: st.size });
    } catch {}
  }
  return out;
}

// Codex
function codex() {
  const sessionsDir = path.join(HOME, '.codex', 'sessions');
  const archivesDir = path.join(HOME, '.codex', 'archived_sessions');
  const stateDb = path.join(HOME, '.codex', 'state_5.sqlite');
  const goalsDb = path.join(HOME, '.codex', 'goals_1.sqlite');
  const configToml = path.join(HOME, '.codex', 'config.toml');
  const hooksJson = path.join(HOME, '.codex', 'hooks.json');
  const agentsMd = path.join(HOME, '.codex', 'AGENTS.md');
  const skillsDir = path.join(HOME, '.codex', 'skills');

  return {
    product: 'codex',
    stores: [
      censusCodexDetail(sessionsDir),
      censusJsonlDir(archivesDir, { typeKey: 'type', maxFiles: 50 }),
      { kind: 'sqlite-info', path: stateDb, exists: fs.existsSync(stateDb) },
      { kind: 'sqlite-info', path: goalsDb, exists: fs.existsSync(goalsDb) },
    ],
    artifacts: fileList([configToml, hooksJson, agentsMd, skillsDir]),
    notes: [
      'sessions/ 目录按 YYYY/MM/DD/rollout-*.jsonl 存放，格式为 envelope (timestamp, type, payload)',
      'legacy 格式（第一行 session_meta 无 payload）在早期会话中存在',
      'rollout 文件包含完整的上下文装配、工具调用、推理、压缩、多智能体通信记录',
      'archived_sessions/ 为归档会话，格式相同',
      'state_5.sqlite 存储会话状态、检查点等',
      'goals_1.sqlite 存储 thread goal 目标元数据（跨进程持久化）',
      'config.toml / hooks.json 为配置文件',
    ]
  };
}

// Claude Code
function claudeCode() {
  const projectsDir = path.join(HOME, '.claude', 'projects');
  const settingsJson = path.join(HOME, '.claude', 'settings.json');
  const settingsLocalJson = path.join(HOME, '.claude', 'settings.local.json');
  const keybindingsJson = path.join(HOME, '.claude', 'keybindings.json');
  const agentsMdGlobal = path.join(HOME, 'AGENTS.md');
  const ccSwitchDir = path.join(HOME, '.cc-switch');

  const res = censusJsonlDir(projectsDir, { typeKey: 'type', maxFiles: 581 });

  // Also count attachment subtypes and system subtypes
  let attachmentCounts = {};
  let systemSubtypes = {};
  let totalLines = 0;
  const files = findJsonlFiles(projectsDir, 581);
  for (const p of files) {
    const content = fs.readFileSync(p, 'utf8');
    for (const line of content.split(/\r?\n/)) {
      if (!line.trim()) continue;
      totalLines++;
      const j = parseMaybeJson(line);
      if (!j) continue;
      if (j.type === 'attachment' && j.attachment?.type) {
        attachmentCounts[j.attachment.type] = (attachmentCounts[j.attachment.type] || 0) + 1;
      }
      if (j.type === 'system' && j.subtype) {
        systemSubtypes[j.subtype] = (systemSubtypes[j.subtype] || 0) + 1;
      }
    }
  }

  res.attachmentTypeCounts = Object.fromEntries(Object.entries(attachmentCounts).sort((a,b)=>b[1]-a[1]).slice(0,80));
  res.systemSubtypeCounts = Object.fromEntries(Object.entries(systemSubtypes).sort((a,b)=>b[1]-a[1]).slice(0,40));

  return {
    product: 'claude-code',
    stores: [res],
    artifacts: fileList([
      settingsJson,
      settingsLocalJson,
      keybindingsJson,
      agentsMdGlobal,
      ccSwitchDir,
      path.join(HOME, '.claude', 'projects', 'C--Users-COLORFIRE', 'memory'),
      path.join(HOME, '.claude', 'projects', 'E--program-GIT-Agent-multi', 'memory'),
      path.join(HOME, '.claude', 'projects', 'E--program-GIT-Agent-multi-Agent-Architecture-Hub', 'memory'),
    ]),
    notes: [
      'projects/ 下按编码后的工作目录路径分文件夹，每个文件夹下是 <uuid>.jsonl 会话文件',
      '格式为 JSONL，每行一条记录：user/assistant 消息、attachment 上下文注入、system 元数据',
      '工具结果嵌在 user 消息的 tool_result 块中，不是顶层记录',
      'meta 记录：custom-title、ai-title、agent-name、cost-state、permission-mode 等',
      'attachment 记录：total_tokens_reminder、deferred_tools_record、environment、instructions、skill_listing、hook_additional_context、queued_command、silent_turn_reminder、file-history-snapshot 等',
      'system 记录：api_error、stop_hook_summary、compact_boundary 等',
      '子智能体会话在同目录下的 subagents/ 文件夹中',
      'settings.json / settings.local.json 为权限与配置',
      '.cc-switch/ 为供应商切换目录',
    ]
  };
}

const all = { codex, 'claude-code': claudeCode };
const picks = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(all);
for (const p of picks) {
  if (!all[p]) { console.error('unknown product', p); continue; }
  const census = all[p]();
  const outPath = path.join(OUT, `${p}-census.json`);
  fs.writeFileSync(outPath, JSON.stringify(census, null, 1));
  console.log(`${p} -> ${outPath}`);
  if (census.stores) {
    for (const s of census.stores) {
      console.log(`  ${s.kind}: ${s.path} (${s.files || '?'} files, ${s.lines || '?'} lines)`);
      if (s.topTypes) console.log(`    top types:`, Object.entries(s.topTypes).slice(0,5));
    }
  }
}