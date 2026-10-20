// Real roots, no agent execution: profile the actual service and its read-only hot paths.
import { spawn } from 'node:child_process';
import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const phase = process.argv[2];
const label = process.argv[3] || phase;
if (!/^[\w-]+$/.test(label)) throw new Error('Invalid output label');
if (phase === 'service') {
  const { AgentGatewayHub } = await import('../../../trace/apps/cli/src/gateway.ts');
  const { SessionStore } = await import('../../../trace/apps/cli/src/store.ts');
  let hub;
  for (const name of ['loadMetaAgents', 'listAcpxSessions', 'getAcpxSessionAsContract', 'loadHermesSessions', 'tickMetaPatrol', 'externalBusy']) {
    const original = AgentGatewayHub.prototype[name];
    AgentGatewayHub.prototype[name] = function (...args) {
      if (name === 'loadMetaAgents') hub = this;
      const start = performance.now();
      try {
        const result = original.apply(this, args);
        if (result && typeof result.then === 'function') return result.finally(() => {
          console.log('MEASURE ' + JSON.stringify({ name: name + ':async', ms: performance.now() - start, at: Date.now() }));
        });
        return result;
      } finally {
        const ms = performance.now() - start;
        if (ms >= 10) console.log('MEASURE ' + JSON.stringify({ name, ms, at: Date.now() }));
      }
    };
  }
  const originalScan = SessionStore.prototype.scan;
  SessionStore.prototype.scan = function (...args) {
    const start = performance.now();
    return originalScan.apply(this, args).then((report) => {
      console.log('MEASURE ' + JSON.stringify({ name: 'scan', ms: performance.now() - start, report, at: Date.now() }));
      return report;
    });
  };
  setInterval(() => {
    if (!hub) return;
    const start = performance.now();
    // With HUB_BACKGROUND=0 reconciliation exits without dispatching; there are no runs in this copy.
    Promise.resolve(hub.tickMetaPatrol()).catch((error) => console.error('[benchmark-patrol]', error));
    hub.holdFor('claude');
    hub.listAcpxSessions(); // exact read performed by finalizeRun, without manufacturing a completed run.
    console.log('MEASURE ' + JSON.stringify({ name: 'patrol-pick-finalize-read', ms: performance.now() - start, at: Date.now() }));
  }, 15_000).unref();
  process.argv = [process.execPath, resolve(root, 'trace/apps/cli/src/main.ts'), 'serve', '--port', '18920'];
  await import('../../../trace/apps/cli/src/main.ts');
} else {
  if (!['before', 'after'].includes(phase)) throw new Error('Expected before or after');
  const dir = resolve(root, 'channels/probe/tmp/dsp_000536_qc3x');
  mkdirSync(dir, { recursive: true });
  const log = resolve(dir, label + '-samples.jsonl');
  const child = spawn(process.execPath, ['--no-warnings=ExperimentalWarning', fileURLToPath(import.meta.url), 'service'], {
    cwd: root, env: { ...process.env, HUB_BACKGROUND: '0', HUB_TRACE_HOME: resolve(dir, label + '-cache') },
    windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
  });
  let ready = 0;
  let active = 0;
  const samples = [];
  child.stdout.on('data', (data) => {
    const text = data.toString();
    appendFileSync(resolve(dir, label + '-service.log'), text);
    if (!ready && text.includes('观察台 http://127.0.0.1:18920/')) { ready = Date.now(); console.log(phase, 'listening; measuring 60s startup + 600s steady'); }
  });
  child.stderr.on('data', (data) => appendFileSync(resolve(dir, label + '-service.err.log'), data));
  child.on('error', (error) => { throw error; });
  child.on('exit', (code) => { if (code && Date.now() - ready < 660_000) throw new Error('Service exited: ' + code); });
  const timer = setInterval(async () => {
    if (!ready || Date.now() - ready > 660_000) return;
    const at = Date.now();
    const start = performance.now();
    active++;
    let error;
    let status;
    try {
      const response = await fetch('http://127.0.0.1:18920/api/gateway/goals', { headers: { Connection: 'close' }, signal: AbortSignal.timeout(5000) });
      status = response.status;
      await response.text();
    } catch (caught) { error = String(caught); }
    const row = { stage: at - ready < 60_000 ? 'startup' : 'steady', at, ms: performance.now() - start, status, error };
    samples.push(row);
    appendFileSync(log, JSON.stringify(row) + '\n');
    active--;
  }, 200);
  const progress = setInterval(() => console.log(phase, 'samples', samples.length, 'over1s', samples.filter((s) => s.ms >= 1000 || s.error || s.status !== 200).length, 'elapsed', ready ? Math.round((Date.now() - ready) / 1000) : 'booting'), 30_000);
  while (!ready || Date.now() - ready < 661_000 || active) await new Promise((r) => setTimeout(r, 1000));
  clearInterval(timer); clearInterval(progress);
  const stats = {};
  for (const stage of ['startup', 'steady']) {
    const rows = samples.filter((s) => s.stage === stage);
    const sorted = rows.map((s) => s.ms).sort((a, b) => a - b);
    stats[stage] = { count: rows.length, maxMs: sorted.at(-1), p99Ms: sorted[Math.floor(sorted.length * .99)], over1s: rows.filter((s) => s.ms >= 1000).length, errors: rows.filter((s) => s.error || s.status !== 200).length };
  }
  appendFileSync(resolve(dir, label + '-summary.json'), JSON.stringify(stats, null, 2));
  console.log(JSON.stringify(stats));
  child.kill();
}
