import type { AdapterCapabilities, Session } from '@hub-trace/contract';

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

/**
 * A directory-style session: one marker file plus the other files that belong to
 * the same session (OpenCode keeps one JSON per message and per part). The Node
 * store discovers the file list and backs `read` with fs; tests pass an in-memory
 * map, so adapter code stays pure and runs in the browser.
 */
export type Bundle = {
  /** Every file of the session (absolute paths), marker included. */
  files: string[];
  read(path: string): string;
};

export type SourceAdapter = {
  /** Contract `source.kind`. */
  kind: string;
  version: string;
  /** Display name. */
  label: string;
  /** Honest 4-tier capability bitmap of this host adapter. */
  capabilities?: AdapterCapabilities;
  /** Where this source keeps its sessions, relative to the user's home directory. */
  homeRoots: string[];
  /** Whether a file below a root is a session of this source. */
  matchFile(path: string): boolean;
  createParser(file: SourceFile): LineParser;
  /** Directory-style sources: one session spans many files assembled into a Bundle. */
  parseBundle?(file: SourceFile, bundle: Bundle, opts: FinishOptions): Session;
  /** Which files, out of every file below the root, make up one marker file's session. */
  bundleMembers?(markerPath: string, allFiles: string[]): string[];
  /**
   * Database-backed sources (ZCode keeps one SQLite store for every session): the
   * store opens the file read-only and hands the adapter a query surface, the
   * adapter returns every session it finds. Like Bundle, this keeps adapters pure.
   */
  parseSqlite?(file: SourceFile, db: SqliteSource, opts: FinishOptions): Session[];
};

/** The read-only query surface the Node store injects into parseSqlite. */
export type SqliteSource = {
  all(sql: string, ...args: unknown[]): unknown[];
};
