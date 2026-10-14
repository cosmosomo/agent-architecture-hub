import type { SourceAdapter } from '../types.ts';
import { CODEX_ADAPTER_VERSION, CODEX_CAPABILITIES, CODEX_KIND, createCodexParser } from './parse.ts';

export const codexAdapter: SourceAdapter = {
  kind: CODEX_KIND,
  version: CODEX_ADAPTER_VERSION,
  label: 'Codex',
  capabilities: CODEX_CAPABILITIES,
  homeRoots: ['.codex/sessions', '.codex/archived_sessions'],
  matchFile: (path) => /(^|[\\/])rollout-[^\\/]*\.jsonl$/i.test(path),
  createParser: createCodexParser,
};

export { CODEX_CAPABILITIES, createCodexParser, toolFamily } from './parse.ts';
export { detectState, STALE_MS } from '../state.ts';
