import { test } from 'node:test';
import assert from 'node:assert/strict';
import { listModels } from '../src/gateway/models.ts';
import type { AgentGatewayHub } from '../src/gateway.ts';

test('unsupported products fail explicitly without a static catalog', async () => {
  await assert.rejects(listModels({} as AgentGatewayHub, 'unknown'), /not implemented/);
});

test('live Claude ACP catalog contains distinct IDs and does not claim inference verification',
  { skip: process.env.HUB_TEST_LIVE_MODELS !== '1' }, async () => {
    const result = await listModels({ repoRoot: process.cwd() } as AgentGatewayHub, 'claude');
    assert.ok(result.models.length > 0);
    assert.equal(new Set(result.models.map((m) => m.id)).size, result.models.length);
    assert.ok(result.models.every((m) => m.id && m.label));
    assert.equal(result.inferenceVerified, false);
    assert.equal(result.source, 'claude ACP session/new configOptions');
  });
