import type { SourceAdapter } from '../types.ts';
import { FACTORY_ADAPTER_VERSION, FACTORY_KIND, createFactoryParser } from './parse.ts';

/** ~/.factory/sessions/<uuid>.jsonl — one streamed JSON record per line; the sibling <uuid>.settings.json is not a session. */
const SESSION_RE = /[\\/]\.factory[\\/]sessions[\\/][A-Za-z0-9-]+\.jsonl$/i;

export const factoryAdapter: SourceAdapter = {
  kind: FACTORY_KIND,
  version: FACTORY_ADAPTER_VERSION,
  label: 'Factory',
  homeRoots: ['.factory/sessions'],
  matchFile: (path) => SESSION_RE.test(path),
  createParser: createFactoryParser,
};
