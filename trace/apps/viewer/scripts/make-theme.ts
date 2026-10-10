/**
 * Writes src/hub-theme.css: AgentPrism's color tokens filled with the observatory's palette
 * (index.html :root and [data-theme="light"]). Tokens are OKLCH triples, as AgentPrism expects.
 * Usage (from trace/): node apps/viewer/scripts/make-theme.ts
 */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

type Palette = Record<string, string>;

const DARK: Palette = {
  background: '#12151C', foreground: '#E6E8EE',
  primary: '#E6E8EE', 'primary-foreground': '#12151C',
  secondary: '#1A1F2B', 'secondary-foreground': '#8089A0',
  muted: '#161A23', 'muted-foreground': '#B5BAC7',
  accent: '#242B3A', 'accent-foreground': '#242B3A',
  brand: '#818CF8', 'brand-foreground': '#0B0D12',
  'brand-secondary': '#F59E0B', 'brand-secondary-foreground': '#0B0D12',
  border: '#252A3B', 'border-subtle': '#1A1F2B', 'border-strong': '#2F3650', 'border-inverse': '#E6E8EE',
  success: '#34D399', 'success-muted': '#10291F', 'success-muted-foreground': '#6EE7B7',
  error: '#F87171', 'error-muted': '#2C1519', 'error-muted-foreground': '#FCA5A5',
  warning: '#FBBF24', 'warning-muted': '#2B2311', 'warning-muted-foreground': '#FCD34D',
  pending: '#A78BFA', 'pending-muted': '#211B38', 'pending-muted-foreground': '#C4B5FD',
  'code-string': '#FCD34D', 'code-number': '#F87171', 'code-key': '#8AB4F8', 'code-base': '#8089A0',
  'badge-default': '#1A1F2B', 'badge-default-foreground': '#B5BAC7',
  'badge-claude-thinking': '#211B38', 'badge-claude-thinking-foreground': '#C4B5FD',
  'context-source-conversation': '#A78BFA',
  ...kind('llm', '#8B5CF6', '#211B38', '#C4B5FD', '#A78BFA'),
  ...kind('agent', '#6366F1', '#1C1E3A', '#A5B4FC', '#818CF8'),
  ...kind('tool', '#F59E0B', '#2B2311', '#FCD34D', '#FBBF24'),
  ...kind('chain', '#0891B2', '#0D2730', '#67E8F9', '#22C4E6'),
  ...kind('retrieval', '#1F5FD6', '#142238', '#8AB4F8', '#5B8DEF'),
  ...kind('embedding', '#047857', '#10291F', '#6EE7B7', '#34D399'),
  ...kind('guardrail', '#B91C1C', '#2C1519', '#FCA5A5', '#F87171'),
  ...kind('create-agent', '#059669', '#10291F', '#6EE7B7', '#34D399'),
  ...kind('span', '#545B6E', '#1A1F2B', '#B5BAC7', '#8089A0'),
  ...kind('event', '#545B6E', '#1A1F2B', '#B5BAC7', '#8089A0'),
  ...kind('unknown', '#545B6E', '#1A1F2B', '#8089A0', '#545B6E'),
};

const LIGHT: Palette = {
  background: '#FFFFFF', foreground: '#0F172A',
  primary: '#0F172A', 'primary-foreground': '#F8FAFC',
  secondary: '#F4F5F8', 'secondary-foreground': '#64748B',
  muted: '#FAFAFB', 'muted-foreground': '#475569',
  accent: '#E9EBF0', 'accent-foreground': '#E9EBF0',
  brand: '#6366F1', 'brand-foreground': '#FFFFFF',
  'brand-secondary': '#D97706', 'brand-secondary-foreground': '#FFFFFF',
  border: '#E2E5EF', 'border-subtle': '#EEF0F5', 'border-strong': '#CBD0DD', 'border-inverse': '#0F172A',
  success: '#059669', 'success-muted': '#ECFDF5', 'success-muted-foreground': '#047857',
  error: '#DC2626', 'error-muted': '#FEF2F2', 'error-muted-foreground': '#B91C1C',
  warning: '#D97706', 'warning-muted': '#FFFBEB', 'warning-muted-foreground': '#B45309',
  pending: '#6D28D9', 'pending-muted': '#F3EEFF', 'pending-muted-foreground': '#6D28D9',
  'code-string': '#B91C1C', 'code-number': '#B45309', 'code-key': '#1F5FD6', 'code-base': '#64748B',
  'badge-default': '#F1F3F7', 'badge-default-foreground': '#475569',
  'badge-claude-thinking': '#F3EEFF', 'badge-claude-thinking-foreground': '#6D28D9',
  'context-source-conversation': '#6D28D9',
  ...kind('llm', '#7C3AED', '#F3EEFF', '#6D28D9', '#A78BFA'),
  ...kind('agent', '#6366F1', '#EEF0FF', '#4F46E5', '#818CF8'),
  ...kind('tool', '#D97706', '#FFF7E6', '#B45309', '#F59E0B'),
  ...kind('chain', '#0891B2', '#E6F7FB', '#0E7490', '#22C4E6'),
  ...kind('retrieval', '#1F5FD6', '#EAF1FD', '#1F5FD6', '#5B8DEF'),
  ...kind('embedding', '#059669', '#ECFDF5', '#047857', '#34D399'),
  ...kind('guardrail', '#DC2626', '#FEF2F2', '#B91C1C', '#F87171'),
  ...kind('create-agent', '#059669', '#ECFDF5', '#047857', '#34D399'),
  ...kind('span', '#64748B', '#F1F3F7', '#475569', '#94A3B8'),
  ...kind('event', '#64748B', '#F1F3F7', '#475569', '#94A3B8'),
  ...kind('unknown', '#94A3B8', '#F1F3F7', '#64748B', '#CBD5E1'),
};

function kind(name: string, avatar: string, badge: string, badgeFg: string, timeline: string): Palette {
  return { ['avatar-' + name]: avatar, ['badge-' + name]: badge, ['badge-' + name + '-foreground']: badgeFg, ['timeline-' + name]: timeline };
}

/** sRGB hex -> "L% C H" (OKLCH), per Björn Ottosson's OKLab. */
function oklch(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const lin = (c: number) => { const v = c / 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  const r = lin((n >> 16) & 255), g = lin((n >> 8) & 255), b = lin(n & 255);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  const C = Math.sqrt(A * A + B * B);
  let H = (Math.atan2(B, A) * 180) / Math.PI;
  if (H < 0) H += 360;
  return (L * 100).toFixed(1) + '% ' + C.toFixed(3) + ' ' + (C < 0.002 ? '0' : H.toFixed(1));
}

const block = (sel: string, p: Palette) => sel + ' {\n' + Object.entries(p).map(([k, v]) => '  --agentprism-' + k + ': ' + oklch(v) + '; /* ' + v + ' */').join('\n') + '\n}\n';

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'hub-theme.css');
writeFileSync(out, '/* Generated by scripts/make-theme.ts from the observatory palette. Do not edit by hand. */\n' + block(':root, [data-theme="dark"]', DARK) + block('[data-theme="light"]', LIGHT));
console.log('wrote ' + out);
