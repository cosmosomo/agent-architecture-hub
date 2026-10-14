import type { SourceAdapter } from '../types.ts';
import { CLAUDE_ADAPTER_VERSION, CLAUDE_CAPABILITIES, CLAUDE_KIND, createClaudeParser } from './parse.ts';

export const claudeCodeAdapter: SourceAdapter = {
  kind: CLAUDE_KIND,
  version: CLAUDE_ADAPTER_VERSION,
  label: 'Claude Code',
  capabilities: CLAUDE_CAPABILITIES,
  homeRoots: ['.claude/projects'],
  matchFile: (path) => /\.jsonl$/i.test(path) && path.includes('.claude'),
  createParser: createClaudeParser,
};

export { CLAUDE_CAPABILITIES, createClaudeParser, toolFamily } from './parse.ts';
