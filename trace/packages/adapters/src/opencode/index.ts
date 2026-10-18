import { parseOpencodeDb } from './db.ts';
import { OPENCODE_ADAPTER_VERSION, OPENCODE_CAPABILITIES, OPENCODE_KIND, createOpencodeParser, parseOpencodeBundle } from './parse.ts';
import type { Bundle, FinishOptions, SourceAdapter, SourceFile } from '../types.ts';

const SESSION_FILE_RE = /[\\/]storage[\\/]session[\\/][^\\/]+[\\/]ses_[A-Za-z0-9]+\.json$/i;
const DB_RE = /[\\/]opencode[\\/]opencode\.db$/i;
const MSG_DIR_RE = (sid: string) => new RegExp('[\\\\/]message[\\\\/]' + esc(sid) + '[\\\\/](msg_[A-Za-z0-9]+)\\.json$', 'i');
const PART_RE = /[\\/]part[\\/](msg_[A-Za-z0-9]+)[\\/]/i;
const SID_RE = /(ses_[A-Za-z0-9]+)\.json$/i;

function esc(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Every stored file that belongs to a session: its marker, its messages, and the
 * parts of those messages. Pure over the full file list, so the store (fs) and
 * tests (an in-memory list) call it the same way.
 */
export function opencodeBundleMembers(markerPath: string, allFiles: string[]): string[] {
  const sid = markerPath.match(SID_RE)?.[1];
  if (!sid) return [markerPath];
  const msgRe = MSG_DIR_RE(sid);
  const msgIds = new Set<string>();
  const out = [markerPath];
  for (const p of allFiles) {
    const mm = p.match(msgRe);
    if (mm) { msgIds.add(mm[1]); out.push(p); }
  }
  for (const p of allFiles) {
    const mm = p.match(PART_RE);
    if (mm && msgIds.has(mm[1])) out.push(p);
  }
  return out;
}

export const opencodeAdapter: SourceAdapter = {
  kind: OPENCODE_KIND,
  version: OPENCODE_ADAPTER_VERSION,
  label: 'OpenCode',
  capabilities: OPENCODE_CAPABILITIES,
  homeRoots: ['.local/share/opencode/storage'],
  matchFile: (path) => SESSION_FILE_RE.test(path),
  bundleMembers: opencodeBundleMembers,
  createParser: createOpencodeParser,
  parseBundle: (file: SourceFile, bundle: Bundle, opts: FinishOptions) => parseOpencodeBundle(file, bundle, opts),
};

export const opencodeDbAdapter: SourceAdapter = {
  kind: OPENCODE_KIND,
  version: OPENCODE_ADAPTER_VERSION,
  label: 'OpenCode',
  capabilities: OPENCODE_CAPABILITIES,
  homeRoots: ['.local/share/opencode'],
  matchFile: (path) => DB_RE.test(path),
  createParser: createOpencodeParser,
  parseSqlite: parseOpencodeDb,
};

export { OPENCODE_CAPABILITIES, createOpencodeParser, parseOpencodeBundle, toolFamily, OPENCODE_KIND, OPENCODE_ADAPTER_VERSION } from './parse.ts';
export { parseOpencodeDb } from './db.ts';
