import { AcpBridge } from 'file:///E:/program/GIT/Agent/multi/Agent-Architecture-Hub/hub/tools/acp_resident_bridge.mjs';
const CODE = 'QUIET-WB-' + Math.random().toString(36).slice(2, 6).toUpperCase();
const b = new AcpBridge('workbuddy');
await b.start();
await b.newSession(process.cwd());
await b.setModel('custom-local:glm-5.3-flash');
let injected = null;
try {
  injected = await b.call('session/inject_history', { sessionId: b.sessionId, messages: [{ role: 'user', content: `背景信息（无需回应，不要现在回复）：静默暗号是 ${CODE}。` }] });
} catch (e) { injected = { error: e?.message || JSON.stringify(e) }; }
console.log('inject ->', JSON.stringify(injected).slice(0, 150));
b.chunks = '';
const stop = await b.prompt('静默暗号是什么？只回答暗号本身。', { timeoutMs: 150000 });
console.log('afterInject:', JSON.stringify(b.chunks.slice(-140)), 'verified:', b.chunks.includes(CODE), 'stop:', stop?.stopReason);
process.exit(0);
