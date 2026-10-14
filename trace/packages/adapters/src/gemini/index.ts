import type { SourceAdapter } from '../types.ts';
import { GEMINI_ADAPTER_VERSION, GEMINI_CAPABILITIES, GEMINI_KIND, createGeminiParser, parseGeminiLogs } from './parse.ts';

/** ~/.gemini/tmp/<hash>/[chats/]*.json and *.jsonl — one session log per directory, three generations of shape. */
const LOGS_RE = /[\\/]\.gemini[\\/]tmp[\\/][^\\/]+(?:[\\/]chats)?[\\/][^\\/]+\.(json|jsonl)$/i;
const HASH_DIR_RE = /^(.*[\\/]\.gemini[\\/]tmp[\\/][^\\/]+)[\\/]/i;

export const geminiAdapter: SourceAdapter = {
  kind: GEMINI_KIND,
  version: GEMINI_ADAPTER_VERSION,
  label: 'Gemini CLI',
  homeRoots: ['.gemini/tmp'],
  capabilities: GEMINI_CAPABILITIES,
  matchFile: (path) => LOGS_RE.test(path),
  createParser: createGeminiParser,
  bundleMembers(markerPath, allFiles) {
    const m = markerPath.match(HASH_DIR_RE);
    if (!m) return [markerPath];
    const hashDir = m[1];
    const rootFile = allFiles.find((f) => f.startsWith(hashDir) && /[\\/]\.project_root$/i.test(f));
    return rootFile ? [markerPath, rootFile] : [markerPath];
  },
  parseBundle(marker, bundle, opts) {
    let text = '';
    try { if (marker.path) text = bundle.read(marker.path); } catch { text = ''; }
    let projectRoot: string | undefined;
    const rootFile = bundle.files.find((f) => /[\\/]\.project_root$/i.test(f));
    if (rootFile) {
      try { projectRoot = bundle.read(rootFile).trim(); } catch { projectRoot = undefined; }
    }
    return parseGeminiLogs(text, marker, opts, projectRoot);
  },
};
