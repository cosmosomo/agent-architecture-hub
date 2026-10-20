import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { normalizeSecurityMode, toolRequest, securityMethods, type SecurityRequest } from '../src/gateway/security.ts';

const gate = createRequire(import.meta.url)('../../../../hub/tools/security_gate.cjs');

test('security gate: default full mode allows normal reads and writes', () => {
  const p = gate.policy();
  const resWrite = gate.evaluate(p, {
    action: 'file.write',
    target: 'some/path/file.txt',
    mode: 'full',
    cwd: process.cwd(),
  });
  assert.equal(resWrite.decision, 'allow');
  assert.equal(resWrite.rule, 'default');

  const resKey = gate.evaluate(p, {
    action: 'key.borrow',
    target: 'zhipu/api_key',
    mode: 'full',
    cwd: process.cwd(),
  });
  assert.equal(resKey.decision, 'allow');
});

test('security gate: workspace mode denies outside-cwd writes and sensitive paths', () => {
  const p = gate.policy();
  const cwd = process.cwd();

  // 1. write inside cwd allowed
  const inCwd = gate.evaluate(p, {
    action: 'file.write',
    target: 'test_inner.txt',
    mode: 'workspace',
    cwd,
  });
  assert.equal(inCwd.decision, 'allow');

  // 2. write outside cwd denied
  const outCwd = gate.evaluate(p, {
    action: 'file.write',
    target: join(tmpdir(), 'test_outer.txt'),
    mode: 'workspace',
    cwd,
  });
  assert.equal(outCwd.decision, 'deny');
  assert.equal(outCwd.rule, 'modes:workspace:3');

  // 3. read sensitive denied
  const readSensitive = gate.evaluate(p, {
    action: 'file.read',
    target: '~/.agent-hub/secrets/canary.txt',
    mode: 'workspace',
    cwd,
  });
  assert.equal(readSensitive.decision, 'deny');
  assert.equal(readSensitive.rule, 'modes:workspace:0');

  // 4. shell run referencing sensitive denied
  const shellSensitive = gate.evaluate(p, {
    action: 'shell.run',
    target: 'cat ~/.agent-hub/secrets/canary.txt',
    mode: 'workspace',
    cwd,
  });
  assert.equal(shellSensitive.decision, 'deny');
  assert.equal(shellSensitive.rule, 'modes:workspace:1');
});

test('security gate: readonly mode denies all file writes', () => {
  const p = gate.policy();
  const res = gate.evaluate(p, {
    action: 'file.write',
    target: 'test_inner.txt',
    mode: 'readonly',
    cwd: process.cwd(),
  });
  assert.equal(res.decision, 'deny');
  assert.equal(res.rule, 'modes:readonly:2');
});

test('normalizeSecurityMode synthesizes permissions and mode into one concept', () => {
  assert.equal(normalizeSecurityMode('workspace', undefined), 'workspace');
  assert.equal(normalizeSecurityMode('readonly', undefined), 'readonly');
  assert.equal(normalizeSecurityMode('full', undefined), 'full');
  assert.equal(normalizeSecurityMode(undefined, 'deny'), 'deny');
  assert.equal(normalizeSecurityMode(undefined, 'reads'), 'reads');
  assert.equal(normalizeSecurityMode(undefined, 'all'), 'full');
  assert.equal(normalizeSecurityMode(undefined, undefined), 'full');
});

test('toolRequest classifies shell, write, and read tools correctly', () => {
  const mockRun: any = {
    channel: 'codex',
    sessionName: 'test-codex',
    runId: 'run-123',
    cwd: process.cwd(),
    securityMode: 'workspace',
  };

  const reqBash = toolRequest(mockRun, 'Bash', { command: 'ls -la' });
  assert.equal(reqBash.action, 'shell.run');
  assert.equal(reqBash.product, 'codex');

  const reqWrite = toolRequest(mockRun, 'FileChange', { file_path: 'channels/probe/tmp/foo.txt' });
  assert.equal(reqWrite.action, 'file.write');
  assert.equal(reqWrite.target, 'channels/probe/tmp/foo.txt');

  const reqRead = toolRequest(mockRun, 'Read', { path: 'README.md' });
  assert.equal(reqRead.action, 'file.read');
  assert.equal(reqRead.target, 'README.md');
});

test('audit logs all 7 required fields to security-audit.jsonl', () => {
  const tmpAudit = join(mkdtempSync(join(tmpdir(), 'hub-audit-')), 'security-audit.jsonl');
  const q = {
    product: 'zcode',
    session: 'test-zcode',
    task: 'task-99',
    action: 'file.write',
    target: 'C:/temp/outside.txt',
    cwd: process.cwd(),
    layer: 'L2',
  };
  const result = { decision: 'deny', rule: 'modes:workspace:3', mode: 'workspace' };
  gate.audit(q, result, tmpAudit);

  const row = JSON.parse(readFileSync(tmpAudit, 'utf8').trim());
  assert.ok(row.at, '时间 at 存在');
  assert.equal(row.product, 'zcode', '谁 product 正确');
  assert.equal(row.session, 'test-zcode', '谁 session 正确');
  assert.equal(row.task, 'task-99', '谁 task 正确');
  assert.equal(row.action, 'file.write', '动作 action 正确');
  assert.equal(row.object, 'C:/temp/outside.txt', '对象 object 正确');
  assert.equal(row.decision, 'deny', '结论 decision 正确');
  assert.equal(row.rule, 'modes:workspace:3', '依据规则 rule 正确');
  assert.equal(row.layer, 'L2', '在哪一层 layer 正确');
});

test('approval queue and session memory scoping', async () => {
  const hub: any = {
    pendingApprovals: [],
    liveApprovalResolvers: new Map(),
    getState: () => ({ pendingApprovals: hub.pendingApprovals }),
    broadcast: () => {},
  };
  for (const [k, f] of Object.entries(securityMethods)) hub[k] = f;

  const req: SecurityRequest = {
    product: 'claude',
    session: 'test-session-1',
    task: 'task-1',
    action: 'file.write',
    target: 'test-target.txt',
    cwd: process.cwd(),
    mode: 'workspace',
  };

  // Test session-scope remember
  hub.rememberSecurityApproval(req, 'session');
  // Second request in same session should be auto-approved via session memory
  // (We simulate an ask rule by mocking gate.judge if needed)
});

test('the old permissions keep their meaning: deny refuses everything, reads asks for anything but reading', () => {
  const p = gate.policy();
  const cwd = process.cwd();
  for (const action of ['file.read', 'file.write', 'shell.run', 'net']) assert.equal(gate.evaluate(p, { action, target: 'x', mode: 'deny', cwd }).decision, 'deny');
  assert.equal(gate.evaluate(p, { action: 'file.read', target: 'README.md', mode: 'reads', cwd }).decision, 'allow');
  assert.equal(gate.evaluate(p, { action: 'file.write', target: 'a.txt', mode: 'reads', cwd }).decision, 'ask');
  assert.equal(gate.evaluate(p, { action: 'shell.run', target: 'ls', mode: 'reads', cwd }).decision, 'ask');
});

test('a tool the classifier does not know is a write, so a restricting mode cannot be slipped past by a new name', () => {
  const run: any = { channel: 'zcode', sessionName: 's', runId: 'r', cwd: process.cwd(), securityMode: 'readonly' };
  assert.equal(toolRequest(run, 'mcpToolCall', { server: 'x' }).action, 'file.write');
  assert.equal(toolRequest(run, 'apply_diff', { path: 'a.txt' }).action, 'file.write');
  assert.equal(toolRequest(run, 'list_dir', { path: '.' }).action, 'file.read');
  assert.equal(toolRequest(run, 'grep_search', { path: '.' }).action, 'file.read');
  assert.equal(toolRequest(run, 'read_url_content', { url: 'https://example.org' }).action, 'net');
});

test('leaving plan mode goes to a person even in full mode', async () => {
  process.env.HUB_DATA_DIR = mkdtempSync(join(tmpdir(), 'hub-sec-')); // the audit row goes to a temp ledger, not the real one
  const pending: any[] = [];
  const resolvers = new Map<string, any>();
  const hub: any = { pendingApprovals: pending, liveApprovalResolvers: resolvers, broadcast() {}, getState() { return {}; } };
  const q: SecurityRequest = { product: 'zcode', session: 's', task: 'r', action: 'mode.switch', target: 'Exit plan mode', cwd: process.cwd(), mode: 'full', askPerson: true };
  const decided = securityMethods.securityCheck.call(hub, q);
  assert.equal(pending.length, 1);
  resolvers.get(pending[0].id).resolve(true);
  assert.equal(await decided, true);
});
