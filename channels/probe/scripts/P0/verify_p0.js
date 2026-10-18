// Verifies the P0 fixes against a running test server (default http://127.0.0.1:8940).
// Checks: /api/control refuses unknown cases; permission field + read-only default reach acpx;
// acpx gets the long timeout; the reply is not doubled.
const { execFileSync } = require('child_process');

const BASE = process.argv[2] || 'http://127.0.0.1:8940';
const out = {};
const post = (p, body) =>
  fetch(BASE + p, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).then(async (r) => ({ status: r.status, body: await r.json().catch(() => null) }));

function acpxFlags(session) {
  try {
    const ps = execFileSync('powershell.exe', ['-NoProfile', '-Command',
      `Get-CimInstance Win32_Process | ? { $_.CommandLine -match 'acpx' -and $_.CommandLine -match '${session}' -and $_.CommandLine -match ' prompt ' } | % { $_.CommandLine }`], { encoding: 'utf8', timeout: 15000 });
    const line = ps.split(/\r?\n/).find((l) => l.includes(session)) || '';
    return {
      perm: (line.match(/--(approve-all|approve-reads|deny-all)/) || [])[1] || null,
      timeout: (line.match(/--timeout (\d+)/) || [])[1] || null,
    };
  } catch (e) {
    return { error: String(e.message).slice(0, 120) };
  }
}

async function sendAndWatch(name, body) {
  const p = post('/api/gateway/send', { ...body, wait: true, timeoutMs: 150000 });
  let flags = null;
  for (let i = 0; i < 20 && !flags?.perm; i++) {
    await new Promise((r) => setTimeout(r, 1500));
    flags = acpxFlags(body.sessionName);
  }
  const res = await p;
  out[name] = { flags, ok: res.body?.ok, status: res.body?.status, reply: res.body?.reply, error: res.body?.error };
}

(async () => {
  for (let i = 0; i < 60; i++) {
    try { if ((await fetch(BASE + '/api/health')).ok) break; } catch {}
    await new Promise((r) => setTimeout(r, 2000));
  }
  out.control = await post('/api/control', { modelId: 'probe_no_such_case', kind: 'interject', payload: { text: 'x' } });
  const stamp = Date.now().toString(36);
  // /console/ style: old field name, explicit deny
  await sendAndWatch('consoleDeny', { channel: 'zcode', sessionName: `probe-p0-deny-${stamp}`, prompt: '只回复 P0-DENY', model: 'builtin:bigmodel-coding-plan\\GLM-5.3-Flash', permissionMode: 'deny-all' });
  // no permission field at all: should default to read-only
  await sendAndWatch('noField', { channel: 'zcode', sessionName: `probe-p0-default-${stamp}`, prompt: '只回复 P0-OK', model: 'builtin:bigmodel-coding-plan\\GLM-5.3-Flash' });
  console.log(JSON.stringify(out, null, 1));
})();
