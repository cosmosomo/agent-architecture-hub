import { AcpBridge } from 'file:///E:/program/GIT/Agent/multi/Agent-Architecture-Hub/hub/tools/acp_resident_bridge.mjs';
import { execSync } from 'node:child_process';
const mode = process.argv[2];
if (mode === 'zcode') {
  const code = 'LOAD-ZC-' + Math.random().toString(36).slice(2, 6).toUpperCase();
  const b1 = new AcpBridge('zcode');
  await b1.start(); await b1.newSession(process.cwd());
  await b1.prompt(`请记住暗号 ${code}，只回复"已记住"。`, { timeoutMs: 120000 });
  const sid = b1.sessionId; b1.close();
  const b = new AcpBridge('zcode');
  await b.start();
  await b.call('session/load', { sessionId: sid, cwd: process.cwd(), mcpServers: [] });
  b.sessionId = sid;
  b.chunks = '';
  await b.prompt('仅凭会话记忆回答：暗号是什么？只回答暗号。', { timeoutMs: 120000 });
  console.log(JSON.stringify({ afterLoad: b.chunks.slice(-100), verified: b.chunks.includes(code) }));
  b.close();
} else {
  const b = new AcpBridge('hermes');
  await b.start();
  const list = execSync('hermes sessions list --limit 5', { encoding: 'utf8', timeout: 30000 });
  const uuid = (list.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/) || [])[0];
  const cli = (list.match(/[0-9]{8}_[0-9]{6}_[0-9a-f]+/) || [])[0];
  for (const [label, sid] of [['acp-uuid', uuid], ['cli-native', cli]]) {
    if (!sid) { console.log(label, 'no id'); continue; }
    try {
      const r = await b.call('session/load', { sessionId: sid, cwd: process.cwd(), mcpServers: [] });
      console.log(label, 'load ok:', JSON.stringify(r).slice(0, 100));
      b.sessionId = sid; b.chunks = '';
      await b.prompt('一句话：这个会话此前在做什么？若你没有该会话上下文就说"无上下文"。', { timeoutMs: 120000 });
      console.log(label, 'afterLoad:', JSON.stringify(b.chunks.slice(-160)));
    } catch (e) { console.log(label, 'load ERR', JSON.stringify(e?.message ?? e?.code ?? String(e)).slice(0, 160), JSON.stringify(e?.data || {}).slice(0, 120)); }
  }
  b.close();
}
process.exit(0);
