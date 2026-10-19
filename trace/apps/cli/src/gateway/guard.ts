/**
 * Keeps the shared append-only records append-only (AGENTS.md 铁律 1): the blackboard, registered features and
 * remarks under channels/probe/. Every minute it looks at each file; when one changed it is copied to
 * channels/probe/snapshots/ at most every ten minutes (the last 48 copies kept). When a file got shorter, someone
 * rewrote it: the short version is set aside, the file is rebuilt from the newest copy plus any rows the short version
 * has that the copy does not, and the event is logged. 10-19 an agent rewrote the blackboard whole, ~2600 rows to 18,
 * and the only backup was a day old.
 * Mixed into AgentGatewayHub (gateway.ts); `this` is the hub.
 */
import { appendFileSync, copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { HOME } from './common.ts';
import type { AgentGatewayHub } from '../gateway.ts';

const GUARDED = ['blackboard.jsonl', 'features.jsonl', 'annotations.jsonl'];
const SNAPSHOT_EVERY_MS = 10 * 60_000;
const KEEP = 48;

type Seen = { size: number; snapshotAt: number; snapshotSize: number };
const seen = new Map<string, Seen>();

/**
 * Every snapshot also goes into a private local git repository (never pushed): each version of each record stays
 * retrievable and comparable, not only the last 48 copies. HUB_RECORDS_HISTORY moves it (tests).
 */
export function commitHistory(name: string, src: string, why: string) {
  const dir = process.env.HUB_RECORDS_HISTORY || join(HOME, '.agent-hub', 'records-history');
  try {
    mkdirSync(dir, { recursive: true });
    const git = (...a: string[]) => spawnSync('git', ['-c', 'user.name=hub-guard', '-c', 'user.email=hub-guard@localhost', ...a], { cwd: dir, windowsHide: true, encoding: 'utf8' });
    if (!existsSync(join(dir, '.git'))) git('init', '-q');
    copyFileSync(src, join(dir, name));
    git('add', name);
    git('commit', '-q', '-m', `${name}: ${why}`);
  } catch {}
}

const stamp = () => new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);

/** Rows of a JSONL text; rows glued onto one line are split apart. */
export function jsonRows(text: string): string[] {
  const out: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    let rest = line.trim();
    while (rest) {
      let depth = 0;
      let inStr = false;
      let esc = false;
      let end = -1;
      for (let i = 0; i < rest.length; i++) {
        const c = rest[i];
        if (inStr) {
          if (esc) esc = false;
          else if (c === '\\') esc = true;
          else if (c === '"') inStr = false;
          continue;
        }
        if (c === '"') inStr = true;
        else if (c === '{') depth++;
        else if (c === '}' && --depth === 0) {
          end = i;
          break;
        }
      }
      if (end < 0) break;
      out.push(rest.slice(0, end + 1));
      rest = rest.slice(end + 1).trim();
    }
  }
  return out;
}

/** The newest snapshot first, then the short file's rows the snapshot lacks: what the file should hold. */
export function rebuild(snapshotText: string, shortText: string): string[] {
  const rows = jsonRows(snapshotText);
  const have = new Set(rows);
  for (const r of jsonRows(shortText)) if (!have.has(r)) {
    rows.push(r);
    have.add(r);
  }
  return rows;
}

/**
 * What each shared record must have; everything else is kept as given (用户 10-19：“要考虑智能体负担，不要预先定的
 * 太死”). The center stamps the time and who it came through; it never refuses a row for style, only for a missing field.
 */
const RECORDS: Record<string, { file: string; need: string[] }> = {
  blackboard: { file: 'blackboard.jsonl', need: ['by', 'family', 'capability', 'evidence'] },
  features: { file: 'features.jsonl', need: ['product', 'name', 'what'] },
  annotations: { file: 'annotations.jsonl', need: ['product', 'on'] },
};
const RESULTS = ['pass', 'partial', 'fail', 'unverified'];

/** One row as the center will write it, or why not. */
export function normalizeRecord(kind: string, raw: any): { row?: Record<string, any>; error?: string } {
  const spec = RECORDS[kind];
  if (!spec) return { error: `不认识的记录：${kind}（blackboard、features、annotations）` };
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { error: '每一行要是一个对象' };
  const missing = spec.need.filter((k) => !String(raw[k] ?? '').trim());
  if (missing.length) return { error: '缺：' + missing.join('、') };
  const row: Record<string, any> = { ...raw, at: new Date().toISOString(), via: 'center' };
  if (kind === 'blackboard') {
    const res = String(raw.result || '').toLowerCase();
    row.result = RESULTS.includes(res) ? res : 'unverified';
    const m = /^[\w-]+\/(L0|L1a|L1b|L2|L3)\/\S+$/.exec(String(raw.route || ''));
    if (m) row.layer = m[1];
  }
  return { row };
}

export const guardMethods = {
  /**
   * The one writer of the shared records (AGENTS.md 铁律 1): rows come in through POST /api/gateway/records and
   * `agent_gateway.js bb add | feature | note`, and only the center appends them to the files.
   */
  appendRecords(this: AgentGatewayHub, kind: string, rows: any[]) {
    const spec = RECORDS[kind];
    if (!spec) return { ok: false, error: `不认识的记录：${kind}（blackboard、features、annotations）` };
    const list = Array.isArray(rows) ? rows : [rows];
    const good: string[] = [];
    const errors: Array<{ index: number; error: string }> = [];
    list.forEach((raw, index) => {
      const r = normalizeRecord(kind, raw);
      if (r.row) good.push(JSON.stringify(r.row));
      else errors.push({ index, error: r.error! });
    });
    if (good.length) {
      const file = join(this.repoRoot, 'channels', 'probe', spec.file);
      appendFileSync(file, good.join('\n') + '\n');
      // The guard must not read our own growth as anything but growth.
      const s = seen.get(spec.file);
      if (s) s.size = statSync(file).size;
    }
    return { ok: errors.length === 0, appended: good.length, errors };
  },

  guardAppendOnly(this: AgentGatewayHub) {
    const dir = join(this.repoRoot, 'channels', 'probe');
    const snapDir = join(dir, 'snapshots');
    for (const name of GUARDED) {
      const file = join(dir, name);
      if (!existsSync(file)) continue;
      try {
        const size = statSync(file).size;
        const prev = seen.get(name);
        const copies = () => (existsSync(snapDir) ? readdirSync(snapDir).filter((f) => f.startsWith(name + '.') && f.endsWith('.snap')).sort() : []);
        if (prev && size < prev.size) {
          // Rewritten: set the short version aside and rebuild from the newest copy.
          mkdirSync(snapDir, { recursive: true });
          const shortCopy = join(snapDir, `${name}.shrunk-${stamp()}`);
          copyFileSync(file, shortCopy);
          const newest = copies().pop();
          if (newest) {
            const rows = rebuild(readFileSync(join(snapDir, newest), 'utf8'), readFileSync(file, 'utf8'));
            writeFileSync(file, rows.join('\n') + '\n');
          }
          const after = statSync(file).size;
          appendFileSync(
            this.eventsFile,
            JSON.stringify({ ts: new Date().toISOString(), kind: 'guard_restore', file: `channels/probe/${name}`, from: prev.size, shrunkTo: size, restoredTo: after, snapshot: newest || null, shortCopy: shortCopy.slice(this.repoRoot.length + 1) }) + '\n',
          );
          this.broadcast('guard_restore', { file: name, from: prev.size, shrunkTo: size, restoredTo: after });
          commitHistory(name, file, `restored after it shrank from ${prev.size} to ${size} bytes`);
          seen.set(name, { size: after, snapshotAt: prev.snapshotAt, snapshotSize: prev.snapshotSize });
          continue;
        }
        const s = prev || { size, snapshotAt: 0, snapshotSize: -1 };
        s.size = size;
        if (size !== s.snapshotSize && Date.now() - s.snapshotAt >= SNAPSHOT_EVERY_MS) {
          mkdirSync(snapDir, { recursive: true });
          copyFileSync(file, join(snapDir, `${name}.${stamp()}.snap`));
          commitHistory(name, file, `${size} bytes`);
          s.snapshotAt = Date.now();
          s.snapshotSize = size;
          const all = copies();
          for (const old of all.slice(0, Math.max(0, all.length - KEEP))) unlinkSync(join(snapDir, old));
        }
        seen.set(name, s);
      } catch {}
    }
  },
};
