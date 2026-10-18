// A new session without a chosen folder starts in a new empty folder; an existing session keeps its own
// folder even if the page sends '__new__' again; a chosen folder is used as is (2026-10-18).
// Uses ZCode (fast and cheap). Effect decides: where the acpx session record says the session lives.
// Usage: node verify_new_cwd.js [base-url]
const BASE = process.argv[2] || 'http://127.0.0.1:8941';
const post = (path, body) =>
  fetch(BASE + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
    .then((r) => r.json())
    .catch((e) => ({ ok: false, error: String(e.message) }));
const model = 'builtin:bigmodel-coding-plan\\GLM-5.3-Flash';

(async () => {
  const stamp = Date.now().toString(36);
  const out = {};

  const a = await post('/api/gateway/session/new', { channel: 'zcode', sessionName: `probe-cwd-a-${stamp}` });
  out.newWithoutCwd = { cwd: a.cwd, underWorkspace: /hub-workspaces/i.test(String(a.cwd || '')) };

  const b = await post('/api/gateway/session/new', { channel: 'zcode', sessionName: `probe-cwd-b-${stamp}`, cwd: '__new__' });
  out.newWithMarker = { cwd: b.cwd, underWorkspace: /hub-workspaces/i.test(String(b.cwd || '')), differsFromA: a.cwd !== b.cwd };

  const name = `probe-cwd-run-${stamp}`;
  const first = await post('/api/gateway/send', { channel: 'zcode', sessionName: name, model, cwd: '__new__', prompt: '只回复“好”。', wait: true, timeoutMs: 240000 });
  const second = await post('/api/gateway/send', { channel: 'zcode', sessionName: name, model, cwd: '__new__', prompt: '只回复“再好”。', wait: true, timeoutMs: 240000 });
  out.runInNewFolder = {
    firstCwd: first.cwd,
    firstStatus: first.status,
    secondCwd: second.cwd,
    secondStatus: second.status,
    sameFolderOnResume: first.cwd && first.cwd === second.cwd,
    underWorkspace: /hub-workspaces/i.test(String(first.cwd || '')),
  };

  const repo = 'E:\\program\\GIT\\Agent\\multi\\Agent-Architecture-Hub';
  const c = await post('/api/gateway/session/new', { channel: 'zcode', sessionName: `probe-cwd-c-${stamp}`, cwd: repo });
  out.chosenFolder = { cwd: c.cwd, usedAsIs: String(c.cwd || '').toLowerCase() === repo.toLowerCase() };

  console.log(JSON.stringify(out, null, 1));
})();
