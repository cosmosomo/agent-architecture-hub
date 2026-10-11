import type { SourceAdapter } from '../types.ts';
import { GEMINI_ADAPTER_VERSION, GEMINI_KIND, createGeminiParser } from './parse.ts';

/** ~/.gemini/tmp/<hash>/*.json and *.jsonl — one session log per directory, three generations of shape. */
const LOGS_RE = /[\\/]\.gemini[\\/]tmp[\\/][^\\/]+[\\/][^\\/]+\.(json|jsonl)$/i;

export const geminiAdapter: SourceAdapter = {
  kind: GEMINI_KIND,
  version: GEMINI_ADAPTER_VERSION,
  label: 'Gemini CLI',
  homeRoots: ['.gemini/tmp'],
  matchFile: (path) => LOGS_RE.test(path),
  createParser: createGeminiParser,
};
