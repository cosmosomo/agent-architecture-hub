import type { AgentGatewayHub } from '../gateway.ts';
import { AcpResidentDriver } from '../drivers/acp_runtime.ts';
import { agentBaseEnv, CHANNEL_PROFILES } from './products.ts';
import { HOME } from './common.ts';
import { join } from 'node:path';

/** Read the product's live catalog; discovery does not claim inference verification. */
export async function listModels(hub: AgentGatewayHub, channel: string) {
  console.error(`[model-list] start ${channel}`);
  try {
    let models: Array<{ id: string; label: string }>;
    let source: string;
    if (channel === 'claude') {
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
        models = options.map((o: any) => ({ id: String(o.value), label: String(o.name || o.value) }));
        source = 'claude ACP session/new configOptions';
      } finally {
        clearTimeout(timer);
        await driver.close();
      }
    } else if (channel === 'antigravity') {
      const ls = hub.discoverAntigravityLs();
      const response = await fetch(`http://127.0.0.1:${ls.port}/exa.language_server_pb.LanguageServerService/GetCascadeModelConfigData`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-codeium-csrf-token': ls.csrf },
        body: '{}', signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok) throw new Error(`Antigravity model RPC HTTP ${response.status}`);
      const data = await response.json() as any;
      if (!Array.isArray(data.clientModelConfigs) || !data.clientModelConfigs.length) throw new Error('Antigravity returned no clientModelConfigs');
      models = data.clientModelConfigs.map((m: any) => ({ id: m.modelId, label: m.label }));
      source = 'antigravity GetCascadeModelConfigData';
    } else {
      throw new Error(`Live model discovery is not implemented for ${channel}`);
    }
    if (models.some((m) => !m.id || m.id === 'undefined')) throw new Error(`${channel} returned a model without an ID`);
    console.error(`[model-list] complete ${channel}: ${models.length}`);
    return { ok: true, channel, source, observedAt: new Date().toISOString(), inferenceVerified: false, models };
  } catch (error) {
    console.error(`[model-list] failed ${channel}:`, error);
    throw error;
  }
}
