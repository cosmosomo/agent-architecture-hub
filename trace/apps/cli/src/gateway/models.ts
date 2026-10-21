import type { AgentGatewayHub } from '../gateway.ts';
import { AcpResidentDriver } from '../drivers/acp_runtime.ts';
import { agentBaseEnv, CHANNEL_PROFILES, detectChannelFromCommand, resolveChannel } from './products.ts';
import type { ChannelProfile } from './types.ts';
import { HOME } from './common.ts';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

type Model = { id: string; label: string };
type Catalog = { at: string; source: string; models: Model[] };

// What each product last said it can run (unit model-list), kept across restarts. 'default' is left out: the center
// always names a model (Claude's 'default' lands on Opus).
const CATALOG_FILE = join(HOME, '.agent-hub', 'model-catalog.json');
let catalogs: Record<string, Catalog> | null = null;
function loadCatalogs(): Record<string, Catalog> {
  if (!catalogs) {
    try {
      catalogs = JSON.parse(readFileSync(CATALOG_FILE, 'utf8'));
    } catch {
      catalogs = {};
    }
  }
  return catalogs!;
}

/** Remember a product's model list (an ACP bridge's session/new or session/load, Codex model/list, ...). */
export function noteModels(channel: string, models: Model[] | undefined, source: string) {
  const list = (models || []).filter((m) => m.id && m.id !== 'default' && m.id !== 'undefined');
  if (!list.length) return;
  const all = loadCatalogs();
  const before = all[channel];
  all[channel] = { at: new Date().toISOString(), source, models: list };
  if (before && before.source === source && JSON.stringify(before.models) === JSON.stringify(list)) return;
  try {
    mkdirSync(join(HOME, '.agent-hub'), { recursive: true });
    writeFileSync(CATALOG_FILE, JSON.stringify(all, null, 2), 'utf8');
  } catch {}
}

/** The newest acpx record of this product that lists its models (acpx writes available_models and their names). */
function fromAcpxRecords(hub: AgentGatewayHub, channel: string): Catalog | null {
  if (!existsSync(hub.acpxDir)) return null;
  const files = readdirSync(hub.acpxDir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => {
      try {
        return { f, t: statSync(join(hub.acpxDir, f)).mtimeMs };
      } catch {
        return { f, t: 0 };
      }
    })
    .sort((a, b) => b.t - a.t)
    .slice(0, 300);
  for (const { f, t } of files) {
    try {
      const raw = JSON.parse(readFileSync(join(hub.acpxDir, f), 'utf8'));
      const ids = raw?.acpx?.available_models;
      if (!Array.isArray(ids) || !ids.length || detectChannelFromCommand(raw.agent_command || '') !== channel) continue;
      const names = raw.acpx.available_model_names || {};
      const models = ids.map((id: any) => ({ id: String(id), label: String(names[id] || id) })).filter((m: Model) => m.id !== 'default');
      return { at: new Date(t).toISOString(), source: `acpx 会话记录 ${f}`, models };
    } catch {}
  }
  return null;
}

/** Claude's list: a throwaway claude-agent-acp session (session/new answers with its model options). */
async function claudeLive(hub: AgentGatewayHub): Promise<Model[]> {
  const bridge = join(process.env.APPDATA || join(HOME, 'AppData', 'Roaming'), 'npm', 'node_modules', '@agentclientprotocol', 'claude-agent-acp', 'dist', 'index.js');
  const driver = new AcpResidentDriver({ product: 'claude', cwd: hub.repoRoot,
    bridge: { cmd: process.execPath, args: [bridge], env: { ...agentBaseEnv(), ...CHANNEL_PROFILES.claude.buildEnv() } },
    onApprovalRequest: () => 'reject_once' });
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const session = await Promise.race([driver.createSession(hub.repoRoot), new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('Claude model discovery timed out after 60s')), 60_000);
    })]);
    const config = session.configOptions?.find((c) => c.category === 'model' || c.id === 'model');
    const options = config?.options?.flatMap((o: any) => o.options || [o]);
    if (!Array.isArray(options) || !options.length) throw new Error('Claude ACP did not return model configOptions');
    return options.map((o: any) => ({ id: String(o.value), label: String(o.name || o.value) }));
  } finally {
    clearTimeout(timer);
    await driver.close();
  }
}

/**
 * A product's models as it reports them, each marked whether the product table vouches for it (verified: run
 * through the center and seen working). `live` says the list was read from the product just now; otherwise it is the
 * last one the product gave (an ACP bridge or acpx record). Listing a model does not mean it runs (no inference check).
 * Claude is read live only with refresh, since that starts a bridge.
 */
export async function listModels(hub: AgentGatewayHub, channel: string, refresh = false) {
  console.error(`[model-list] start ${channel}`);
  try {
    const prof = resolveChannel(channel);
    if (!prof) throw new Error(`未知渠道: ${channel}`);
    let got: Catalog | null = null;
    let live = false;
    if (prof.id === 'antigravity') {
      const ls = hub.discoverAntigravityLs();
      const response = await fetch(`http://127.0.0.1:${ls.port}/exa.language_server_pb.LanguageServerService/GetCascadeModelConfigData`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-codeium-csrf-token': ls.csrf },
        body: '{}', signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok) throw new Error(`Antigravity model RPC HTTP ${response.status}`);
      const data = await response.json() as any;
      if (!Array.isArray(data.clientModelConfigs) || !data.clientModelConfigs.length) throw new Error('Antigravity returned no clientModelConfigs');
      got = { at: new Date().toISOString(), source: 'antigravity GetCascadeModelConfigData', models: data.clientModelConfigs.map((m: any) => ({ id: m.modelId, label: m.label })) };
      live = true;
    } else if (prof.id === 'codex') {
      const driver = await hub.ensureCodexDriver();
      const data = await driver.listModels();
      const models = data.filter((m: any) => !m.hidden).map((m: any) => ({ id: String(m.model || m.id), label: String(m.displayName || m.model || m.id) }));
      noteModels('codex', models, 'codex app-server model/list');
      got = loadCatalogs().codex || null;
      live = true;
    } else if (prof.id === 'claude' && refresh) {
      noteModels('claude', await claudeLive(hub), 'claude ACP session/new configOptions');
      got = loadCatalogs().claude || null;
      live = true;
    }
    if (!got) {
      // The newer of what the resident bridge last said and what acpx last recorded.
      const kept = loadCatalogs()[prof.id] || null;
      const rec = fromAcpxRecords(hub, prof.id);
      got = kept && (!rec || kept.at >= rec.at) ? kept : rec;
    }
    if (!got && prof.id === 'claude') {
      noteModels('claude', await claudeLive(hub), 'claude ACP session/new configOptions');
      got = loadCatalogs().claude || null;
      live = true;
    }
    if (!got) throw new Error(`还没读到 ${prof.label} 的模型列表：中心开过或载入过它的会话之后才有`);
    if (got.models.some((m) => !m.id || m.id === 'undefined')) throw new Error(`${channel} returned a model without an ID`);
    const models = got.models.map((m) => ({ ...m, verified: prof.recommendedModels.includes(m.id) }));
    console.error(`[model-list] complete ${channel}: ${models.length}`);
    return { ok: true, channel: prof.id, source: got.source, observedAt: got.at, live, inferenceVerified: false, models };
  } catch (error) {
    console.error(`[model-list] failed ${channel}:`, error);
    throw error;
  }
}

/**
 * Whether a model a session's record names stands. One the center chose stands: the center's own driver record, or
 * a switch made through the center (marked hub_model_choice). One the product put there on its own must be on the
 * product table's list, else the table's default is used (WorkBuddy slipped in space-bunny, 10-18).
 */
export function recordedModelStands(prof: ChannelProfile, raw: any, model: string): boolean {
  return prof.recommendedModels.includes(model) || String(raw?.acpx_record_id || '').startsWith('driver-') || raw?.acpx?.hub_model_choice === model;
}
