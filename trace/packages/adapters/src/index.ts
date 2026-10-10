/**
 * Source adapters. Each source (Codex now, Claude Code and others later) is one
 * SourceAdapter: it recognises its files and turns their lines into the contract.
 * Adding a source = adding a folder here and an entry in ADAPTERS; nothing else changes.
 */
import type { Session } from '@hub-trace/contract';
import { codexAdapter } from './codex/index.ts';
import { claudeCodeAdapter } from './claude-code/index.ts';
import { opencodeAdapter } from './opencode/index.ts';
import type { SourceAdapter, SourceFile } from './types.ts';

export const ADAPTERS: readonly SourceAdapter[] = [codexAdapter, claudeCodeAdapter, opencodeAdapter];

export function adapterByKind(kind: string): SourceAdapter | undefined {
  return ADAPTERS.find((a) => a.kind === kind);
}

export function adapterForFile(path: string): SourceAdapter | undefined {
  return ADAPTERS.find((a) => a.matchFile(path));
}

/** Parse a whole text (e.g. a dropped file) with one adapter. */
export function parseText(adapter: SourceAdapter, text: string, file: SourceFile = {}, now: number = Date.now()): Session {
  const p = adapter.createParser(file);
  for (const line of text.split('\n')) p.push(line);
  return p.finish({ now });
}

export type { FinishOptions, LineParser, SourceAdapter, SourceFile } from './types.ts';
export { codexAdapter, createCodexParser, detectState, STALE_MS, toolFamily } from './codex/index.ts';
export { claudeCodeAdapter, createClaudeParser, toolFamily as claudeToolFamily } from './claude-code/index.ts';
export { opencodeAdapter, createOpencodeParser, opencodeBundleMembers } from './opencode/index.ts';
export { TurnBuilder, titleFallback } from './turns.ts';
export { LIMITS, clean, maskSecrets, oneLine } from './text.ts';
