import type { Session } from '@hub-trace/contract';

/** What the caller knows about the source file. Adapters never touch the file system themselves. */
export type SourceFile = {
  path?: string;
  size?: number;
  mtimeMs?: number;
};

export type FinishOptions = {
  /** Current time in ms, for state detection. */
  now: number;
  /** An open turn whose source has not changed for this long counts as stale. */
  staleMs?: number;
};

/** Push-based so the CLI can stream big files and the browser can feed a dropped file. */
export type LineParser = {
  push(line: string): void;
  finish(opts: FinishOptions): Session;
};

export type SourceAdapter = {
  /** Contract `source.kind`. */
  kind: string;
  version: string;
  /** Display name. */
  label: string;
  /** Where this source keeps its sessions, relative to the user's home directory. */
  homeRoots: string[];
  /** Whether a file below a root is a session of this source. */
  matchFile(path: string): boolean;
  createParser(file: SourceFile): LineParser;
};
