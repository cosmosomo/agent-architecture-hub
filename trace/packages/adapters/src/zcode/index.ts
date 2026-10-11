import type { SourceAdapter } from '../types.ts';
import { parseZcodeDb } from './db.ts';
import { ZCODE_ADAPTER_VERSION, ZCODE_KIND, createZcodeParser } from './parse.ts';

/** ~/.zcode/v2/sessions/<project-hash>/<taskId>.json — one JSON file per task. */
const SESSION_RE = /[\\/]\.zcode[\\/]v2[\\/]sessions[\\/][^\\/]+[\\/][^\\/]+\.json$/i;

/** ~/.zcode/cli/db/db.sqlite — every session of the CLI in one store. */
const DB_RE = /[\\/]\.zcode[\\/]cli[\\/]db[\\/]db\.sqlite$/i;

export const zcodeAdapter: SourceAdapter = {
  kind: ZCODE_KIND,
  version: ZCODE_ADAPTER_VERSION,
  label: 'ZCode',
  homeRoots: ['.zcode/v2/sessions'],
  matchFile: (path) => SESSION_RE.test(path),
  createParser: createZcodeParser,
};

export const zcodeDbAdapter: SourceAdapter = {
  kind: ZCODE_KIND,
  version: ZCODE_ADAPTER_VERSION,
  label: 'ZCode',
  homeRoots: ['.zcode/cli/db'],
  matchFile: (path) => DB_RE.test(path),
  createParser: createZcodeParser, // unused for a database; parseSqlite is the entry
  parseSqlite: parseZcodeDb,
};
