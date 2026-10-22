// Compare the center's complete read view to native agent-mode trajectories; never write native files.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { maskSecrets, partsText } from '../../../trace/packages/adapters/src/text.ts';

const base = process.env.HUB_DAEMON_URL;
assert.ok(base, 'HUB_DAEMON_URL is required');
const native = join(homedir(), 'AppData/Local/Doubao/User Data/Default/.doubao/agent_mode/workspace/.sessions');
async function get(path) {
  const response = await fetch(base + path, { headers: { Connection: 'close' }, signal: AbortSignal.timeout(60_000) });
  assert.equal(response.status, 200, path);
  return response.json();
}
console.log('Doubao read-only comparison started');
const catalog = await get('/api/sessions?channel=doubao-desktop');
const sessions = catalog.sessions;
const expectedIds = [];
for (const session of readdirSync(native, { withFileTypes: true }).filter((e) => e.isDirectory())) {
  const agentsDir = join(native, session.name, 'agents');
  const agents = readdirSync(agentsDir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name);
  const main = agents.find((a) => a.startsWith('m_')) || agents.find((a) => a.startsWith('o_'));
  for (const agent of agents) expectedIds.push('doubao-desktop:' + session.name + (agent === main ? '' : ':' + agent));
}
assert.deepEqual(sessions.map((s) => s.id).sort(), expectedIds.sort(), 'every native agent must be listed');
const totals = { sessions: sessions.length, main: 0, children: 0, records: 0, users: 0, replies: 0, calls: 0, results: 0 };
for (const summary of sessions) {
  const before = readFileSync(summary.source.path, 'utf8');
  const path = summary.source.path.replace(/assignment\.md$/, 'trajectory.jsonl');
  let trajectory;
  try { trajectory = readFileSync(path, 'utf8'); } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    // A native assignment can exist before its first trajectory is created.
    trajectory = '';
  }
  const rows = trajectory.split(/\r?\n/).filter((s) => s.trim()).map((s) => JSON.parse(s));
  const document = await get('/api/sessions/' + encodeURIComponent(summary.id));
  const session = document.session;
  assert.equal(session.capabilities.observe_only, true);
  assert.equal(session.pointCapabilities.resume.enabled, false);
  assert.equal(session.stats.records, rows.length);
  assert.equal(session.stats.skipped, 0);
  const steps = session.turns.flatMap((t) => t.steps);
  const users = steps.filter((s) => s.kind === 'message' && s.role === 'user');
  const replies = steps.filter((s) => s.kind === 'model' && s.text);
  const calls = steps.filter((s) => s.kind === 'tool' && s.input !== undefined);
  const results = steps.filter((s) => s.kind === 'tool' && s.output !== undefined);
  assert.deepEqual(users.map((s) => s.text), rows.filter((r) => r.role === 'user').map((r) => maskSecrets(partsText(r.content))));
  assert.deepEqual(replies.map((s) => s.text), rows.filter((r) => r.role === 'assistant' && partsText(r.content)).map((r) => maskSecrets(partsText(r.content))));
  const nativeCalls = rows.flatMap((r) => r.tool_calls || []);
  assert.equal(calls.length, nativeCalls.length);
  for (let i = 0; i < calls.length; i++) {
    assert.equal(calls[i].name, nativeCalls[i].function.name);
    const value = nativeCalls[i].function.arguments;
    assert.equal(calls[i].input, maskSecrets(typeof value === 'string' ? value : JSON.stringify(value)));
  }
  assert.deepEqual(results.map((s) => s.output), rows.filter((r) => r.role === 'tool').map((r) => maskSecrets(partsText(r.content))));
  assert.equal(readFileSync(summary.source.path, 'utf8'), before, 'assignment changed during comparison');
  if (trajectory) assert.equal(readFileSync(path, 'utf8'), trajectory, 'trajectory changed during comparison');
  totals[summary.agent.role === 'main' ? 'main' : 'children']++;
  totals.records += rows.length;
  totals.users += users.length;
  totals.replies += replies.length;
  totals.calls += calls.length;
  totals.results += results.length;
  if ((totals.main + totals.children) % 50 === 0) console.log('Compared', totals.main + totals.children);
}
console.log(JSON.stringify({ ok: true, ...totals }));
