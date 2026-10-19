/**
 * The products the backend drives, read from hub/data/products.json (CHANNEL_PROFILES), and the environment
 * each agent process starts with.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { ChannelId, ChannelCapabilities, ChannelProfile } from './types.ts';
import { HOME } from './common.ts';

/**
 * Variables a Claude host (Claude Code, the Claude desktop app) puts into every process it starts. If the hub
 * runs inside such a host it would pass them on, and a Claude it launches then fails to log in ("Authentication
 * required") because the host's own ANTHROPIC_* are not meant for it (2026-10-18; agent-hub's runs.platform_env()
 * learnt the same). They are removed for every agent the hub starts.
 */
const HOST_ENV = /^(CLAUDECODE$|CLAUDE_|ANTHROPIC_)/;
export function agentBaseEnv(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {};
  for (const [k, v] of Object.entries(process.env)) if (!HOST_ENV.test(k)) env[k] = v;
  return env;
}

/**
 * Claude Code keeps its relay address and token in ~/.claude/settings.json. They are read at launch and given
 * to this one process only, never written or logged. Loading the whole user settings instead
 * (ACPX_CLAUDE_INCLUDE_USER_SETTINGS=1) gave a canned, unrelated first reply on 2026-10-18 ("printed
 * HELLO_CHECK"); set HUB_CLAUDE_USER_SETTINGS=1 to go back to it.
 */
export function claudeProviderEnv(): Record<string, string> {
  const env: Record<string, string> = { HTTP_PROXY: 'http://127.0.0.1:7892', HTTPS_PROXY: 'http://127.0.0.1:7892' };
  // Loading the whole user settings ("user" setting source) also loads ~/.claude/agents/*.md, and one description
  // there ("code execution") makes the relayed model answer every prompt with a sandbox self-test (HELLO_CHECK,
  // channels/probe/results/agy-pro-claude-settings-20261018.md). The global CLAUDE.md is appended to the system
  // prompt instead (claudeGlobalInstructions); memory and skills load without it. The provider variables below are
  // needed either way: returning early here used to drop them.
  if (process.env.HUB_CLAUDE_USER_SETTINGS === '1') env.ACPX_CLAUDE_INCLUDE_USER_SETTINGS = '1';
  try {
    const settings = JSON.parse(readFileSync(join(HOME, '.claude', 'settings.json'), 'utf8'));
    for (const [k, v] of Object.entries(settings?.env || {})) {
      if (/^ANTHROPIC_/.test(k) && typeof v === 'string') env[k] = v;
    }
  } catch {}
  return env;
}

/** The user's global instructions (~/.claude/CLAUDE.md), which a Claude session started here would otherwise miss. */
export function claudeGlobalInstructions(): string {
  try {
    const text = readFileSync(join(HOME, '.claude', 'CLAUDE.md'), 'utf8').trim();
    return text ? '以下是用户的全局说明（~/.claude/CLAUDE.md），和用户直接说的话同等有效：\n\n' + text : '';
  } catch {
    return '';
  }
}

/**
 * acpx's own entry script, run with node directly: no cmd.exe in between, so arguments (a multi-line system prompt)
 * arrive whole. Without it the caller falls back to `cmd.exe /c acpx …`, which cuts an argument at a newline.
 */
export const ACPX_CLI = join(process.env.APPDATA || join(HOME, 'AppData', 'Roaming'), 'npm', 'node_modules', 'acpx', 'dist', 'cli.js');

/**
 * The products come from the product table, hub/data/products.json: the one list of products, shared with
 * hub/tools/agent_gateway.js. The backend drives the rows marked backend. Only Claude's provider variables stay
 * code (claudeProviderEnv, read at launch). The capability flags are not written here either: they follow the
 * unit → action table (hub/data/integration-map.json), where anything implemented counts, tested or not.
 */
const REPO_ROOT = resolve(import.meta.dirname, '..', '..', '..', '..', '..');
type ProductRow = {
  id: string; name: string; label: string; aliases?: string[]; route: string; acpxAgent: string | null; backend: boolean;
  readKind: string | null; defaultModel: string | null; models: string[]; env?: Record<string, string>; envFrom?: string;
  accent: string; badge: string; notes: string;
  /** Resident ACP route: which of the agent's own modes each permission level maps to (ZCode: yolo / guarded / plan). */
  acpModes?: Partial<Record<'all' | 'reads' | 'deny', string>>;
  /** The agent's own working modes, for switching mid-session (session-control mode). */
  modes?: string[];
  maxConcurrent?: number;
  quotaAccount?: string;
};
const PRODUCT_TABLE = JSON.parse(readFileSync(join(REPO_ROOT, 'hub', 'data', 'products.json'), 'utf8'));
const PRODUCT_ROWS: ProductRow[] = PRODUCT_TABLE.products;
/** Quota accounts several products may share: label, and the timezone the provider writes its reset time in. */
export const QUOTA_ACCOUNTS: Record<string, { label: string; resetTimezone?: string; note?: string }> = PRODUCT_TABLE.quotaAccounts || {};

function productEnv(p: ProductRow): Record<string, string> {
  const env = Object.fromEntries(Object.entries(p.env || {}).map(([k, v]) => [k, v.replaceAll('{HOME}', HOME)]));
  return p.envFrom === 'claude-settings' ? { ...env, ...claudeProviderEnv() } : env;
}

function unitFlags(id: string): ChannelCapabilities {
  let backend: Record<string, Array<{ channels?: string[]; status?: string }>> = {};
  try {
    backend = JSON.parse(readFileSync(join(REPO_ROOT, 'hub', 'data', 'integration-map.json'), 'utf8')).backend || {};
  } catch {}
  const has = (unit: string) => (backend[unit] || []).some((e) => (e.channels || []).includes(id) && e.status !== 'todo');
  return {
    canCreateSession: has('open'),
    canSendPrompt: has('open'),
    canCancelRun: has('cancel'),
    canSwitchModelOnNew: has('model-new'),
    canSwitchModelMidSession: has('model-switch'),
    canSetPermissionMode: has('mode-switch'),
    canReadExternalSessions: has('discover-sessions'),
  };
}

export const CHANNEL_PROFILES = Object.fromEntries(
  PRODUCT_ROWS.filter((p) => p.backend).map((p) => [
    p.id,
    {
      id: p.id as ChannelId,
      label: p.label,
      product: p.name,
      traceKind: p.readKind || p.id,
      route: p.route,
      acpModes: p.acpModes,
      modes: p.modes,
      maxConcurrent: p.maxConcurrent || 3,
      quotaAccount: p.quotaAccount,
      acpxAgent: p.acpxAgent || p.aliases?.[0] || p.id,
      defaultModel: p.defaultModel || '',
      recommendedModels: p.models,
      get capabilities() {
        return unitFlags(p.id);
      },
      accent: p.accent,
      badge: p.badge,
      buildEnv: () => productEnv(p),
      notes: p.notes,
    } satisfies ChannelProfile,
  ]),
) as Record<ChannelId, ChannelProfile>;

export function resolveChannel(raw?: string | null): ChannelProfile | null {
  if (!raw) return null;
  const k = raw.trim().toLowerCase();
  if (k === 'claude-code') return CHANNEL_PROFILES.claude;
  if (k === 'codebuddy' || k === 'workbuddy') return CHANNEL_PROFILES.workbuddy;
  if (k === 'agy' || k === 'antigravity') return CHANNEL_PROFILES.antigravity;
  if (k === 'hermes' || k === 'hermes-agent') return CHANNEL_PROFILES.hermes;
  if (k in CHANNEL_PROFILES) return CHANNEL_PROFILES[k as ChannelId];
  return null;
}

export function detectChannelFromCommand(cmd: string): ChannelId {
  const s = (cmd || '').toLowerCase();
  if (s.includes('antigravity') || s.includes('language_server') || s === 'agy') return 'antigravity';
  if (s.includes('hermes')) return 'hermes';
  if (s.includes('claude')) return 'claude';
  if (s.includes('zcode')) return 'zcode';
  if (s.includes('codebuddy') || s.includes('workbuddy')) return 'workbuddy';
  if (s.includes('opencode')) return 'opencode';
  return 'codex';
}

export function normalizeAgyCliModel(raw?: string | null): 'flash_lite' | 'flash' | 'pro' {
  const m = String(raw || '').trim().toLowerCase();
  if (!m) return 'pro';
  if (m === 'flash_lite' || m.includes('flash-low') || m.includes('lite')) return 'flash_lite';
  if (m === 'flash' || m.includes('flash') || m.includes('argon-low')) return 'flash';
  return 'pro';
}

/**
 * Since AGY 2.23.1 `agentapi new-conversation` fails with "project_id is required" unless
 * ANTIGRAVITY_PROJECT_ID is set (the sidecar SDK passes it the same way). Pick the registered
 * project in ~/.gemini/config/projects whose folder contains cwd (longest match), else
 * "outside-of-project".
 */
export function resolveAgyProjectId(cwd: string): string {
  if (process.env.ANTIGRAVITY_PROJECT_ID) return process.env.ANTIGRAVITY_PROJECT_ID;
  const norm = (p: string) => p.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
  const target = norm(resolve(cwd));
  const dir = join(HOME, '.gemini', 'config', 'projects');
  let best = { id: 'outside-of-project', len: 0 };
  let files: string[] = [];
  try {
    files = readdirSync(dir).filter((f) => f.endsWith('.json'));
  } catch {}
  for (const f of files) {
    let proj: any;
    try {
      proj = JSON.parse(readFileSync(join(dir, f), 'utf8'));
    } catch {
      continue;
    }
    for (const r of proj?.projectResources?.resources || []) {
      const uri: string | undefined = r?.folderUri || r?.gitFolder?.folderUri;
      if (!uri) continue;
      const folder = norm(decodeURIComponent(uri.replace(/^file:\/\/\//, '')));
      if ((target === folder || target.startsWith(folder + '/')) && folder.length > best.len) {
        best = { id: proj.id, len: folder.length };
      }
    }
  }
  return best.id;
}
