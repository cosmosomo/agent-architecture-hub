import type { SourceAdapter } from '../types.ts';
import { ZCODE_ADAPTER_VERSION, ZCODE_KIND, createZcodeParser } from './parse.ts';

/** ~/.zcode/v2/sessions/<project-hash>/<taskId>.json — one JSON file per task. */
const SESSION_RE = /[\\/]\.zcode[\\/]v2[\\/]sessions[\\/][^\\/]+[\\/][^\\/]+\.json$/i;

export const zcodeAdapter: SourceAdapter = {
  kind: ZCODE_KIND,
  version: ZCODE_ADAPTER_VERSION,
  label: 'ZCode',
  homeRoots: ['.zcode/v2/sessions'],
  matchFile: (path) => SESSION_RE.test(path),
  createParser: createZcodeParser,
};
