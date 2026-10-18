// Open + resume through the gateway for the acpx families, same method as the L2-A test:
// turn 1 gives the agent a project number, turn 2 asks for it back. Effect, not the API's ok, decides.
// 2026-10-18: OpenCode model renamed (zai-coding-plan/* is no longer advertised); prompts no longer say
// "暗号" (haiku read it as an injected instruction and refused); stopReason, warnings and refused tools
// are recorded so a failure can be traced to the right cause.
// Usage: node verify_open_resume.js [base-url] [family,family,...]
const BASE = process.argv[2] || 'http://127.0.0.1:8940';
const ONLY = process.argv[3] ? new Set(process.argv[3].split(',')) : null;
const FAMILIES = [
  ['zcode', 'builtin:bigmodel-coding-plan\\GLM-5.3-Flash'],
  ['workbuddy', 'custom-local:glm-5.3-flash'],
  ['opencode', 'zhipuai-coding-plan/glm-5.3-flash'],
  ['hermes', 'custom:glm-5.3'],
  ['codex', 'gpt-5.6-sol'],
  ['claude', 'haiku'],
].filter(([c]) => !ONLY || ONLY.has(c));
const send = (body) =>
  fetch(BASE + '/api/gateway/send', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...body, wait: true, timeoutMs: 240000 }) })
    .then((r) => r.json())
    .catch((e) => ({ ok: false, error: String(e.message) }));
const brief = (a, ms, n) => ({
  ok: a.ok,
  status: a.status,
  ms,
  stopReason: a.run?.stopReason || null,
  reply: String(a.reply || '').slice(0, n),
  error: String(a.error || '').slice(0, 160),
  warnings: (a.run?.warnings || []).map((w) => String(w).slice(0, 120)),
  deniedTools: a.run?.deniedTools || [],
});

(async () => {
  for (let i = 0; i < 60; i++) {
    try { if ((await fetch(BASE + '/api/health')).ok) break; } catch {}
    await new Promise((r) => setTimeout(r, 2000));
  }
  const stamp = Date.now().toString(36);
  const out = {};
  for (const [channel, model] of FAMILIES) {
    const token = `P0-${channel.toUpperCase()}-${Math.floor(Math.random() * 1e6)}`;
    const sessionName = `probe-p0-or-${channel}-${stamp}`;
    let t = Date.now();
    const a = await send({ channel, sessionName, model, prompt: `我们接下来要用的项目编号是 ${token}。先只回复“收到”。` });
    const openMs = Date.now() - t;
    t = Date.now();
    const b = await send({ channel, sessionName, model, prompt: '我们要用的项目编号是多少？只回复编号。' });
    out[channel] = { open: brief(a, openMs, 40), resume: brief(b, Date.now() - t, 60), recalled: String(b.reply || '').includes(token) };
    console.log(channel, JSON.stringify(out[channel]));
  }
  require('fs').writeFileSync(__dirname + '/open_resume_result.json', JSON.stringify(out, null, 1));
})();
