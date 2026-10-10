/**
 * Text hygiene shared by adapters: mask secret-like strings, drop images and
 * encrypted blobs, shorten long text. Sessions are private; this keeps the parsed
 * form safe to put on a screen, not safe to publish.
 */

export const LIMITS = {
  /** Message, reasoning and output text. */
  text: 12000,
  /** Tool inputs and outputs. */
  io: 8000,
  /** Labels, titles, list entries. */
  label: 160,
};

const SECRET_PATTERNS: RegExp[] = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
  /\bsk-(?:ant-|proj-)?[A-Za-z0-9_-]{16,}/g,
  /\bgh[pousr]_[A-Za-z0-9]{20,}/g,
  /\bgithub_pat_[A-Za-z0-9_]{20,}/g,
  /\bAKIA[0-9A-Z]{16}\b/g,
  /\bAIza[0-9A-Za-z_-]{35}\b/g,
  /\bxox[abprs]-[A-Za-z0-9-]{10,}/g,
  /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g,
  /\b(Bearer|Basic)\s+[A-Za-z0-9._~+/-]{16,}=*/g,
];
// key = value, key: value, "key": "value" for secret-sounding keys; the value is masked, the key kept.
const SECRET_ASSIGN = /((?:api[_-]?key|secret|token|password|passwd|pwd|access[_-]?key|private[_-]?key|auth(?:orization)?|cookie|session[_-]?id)["']?\s*[:=]\s*["']?)([^\s"',;]{8,})/gi;
const URL_CREDENTIALS = /(\b[a-z][a-z0-9+.-]*:\/\/)([^\s/:@]+):([^\s/@]+)@/gi;
const DATA_URL = /data:[a-z]+\/[a-z0-9.+-]+;base64,[A-Za-z0-9+/=]{64,}/gi;

export function maskSecrets(s: string): string {
  let out = s;
  for (const re of SECRET_PATTERNS) out = out.replace(re, '[已打码]');
  out = out.replace(SECRET_ASSIGN, (_m, k: string) => k + '[已打码]');
  out = out.replace(URL_CREDENTIALS, (_m, scheme: string) => scheme + '[已打码]@');
  out = out.replace(DATA_URL, '[图片]');
  return out;
}

export function shorten(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max) + '\n…（截断，原长 ' + s.length + ' 字）';
}

/** Clean text for display: masked and shortened. */
export function clean(s: unknown, max: number = LIMITS.text): string {
  if (typeof s !== 'string') return '';
  return shorten(maskSecrets(s), max);
}

/** One line: whitespace collapsed, masked, cut to `max`. */
export function oneLine(s: unknown, max: number = LIMITS.label): string {
  if (typeof s !== 'string') return '';
  const flat = maskSecrets(s).replace(/\s+/g, ' ').trim();
  return flat.length <= max ? flat : flat.slice(0, max - 1) + '…';
}

/**
 * Text from a content field that is either a string or a list of typed parts
 * ({type: 'input_text' | 'output_text' | 'text' | 'summary_text', text}).
 * Images become a marker; encrypted parts are dropped.
 */
export function partsText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  const out: string[] = [];
  for (const part of content) {
    if (typeof part === 'string') { out.push(part); continue; }
    if (!part || typeof part !== 'object') continue;
    const p = part as { type?: string; text?: unknown };
    if (typeof p.text === 'string') out.push(p.text);
    else if (p.type && /image/i.test(p.type)) out.push('[图片]');
  }
  return out.join('\n');
}

/** Stable ISO string for an epoch value in seconds or milliseconds; undefined when unusable. */
export function isoFromEpoch(v: unknown): string | undefined {
  if (typeof v !== 'number' || !Number.isFinite(v) || v <= 0) return undefined;
  const ms = v < 1e12 ? v * 1000 : v;
  const d = new Date(ms);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

export function msBetween(a?: string, b?: string): number | undefined {
  if (!a || !b) return undefined;
  const d = Date.parse(b) - Date.parse(a);
  return Number.isFinite(d) && d >= 0 ? d : undefined;
}
