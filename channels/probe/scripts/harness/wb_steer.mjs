import { AcpBridge } from 'file:///E:/program/GIT/Agent/multi/Agent-Architecture-Hub/hub/tools/acp_resident_bridge.mjs';
const CODE = 'QUIET-WB-' + Math.random().toString(36).slice(2, 6).toUpperCase();
const b = new AcpBridge('workbuddy', { onEvent() {} });
await b.start();
await b.newSession(process.cwd());
await b.setModel('custom-local:glm-5.3-flash');

// 1) inject-silent: session/inject_history（skipRun，不触发推理）
let injected = null;
try {
  injected = await b.call('session/inject_history', { sessionId: b.sessionId, items: [{ role: 'user', content: `背景信息（无需回应）：静默暗号是 ${CODE}。` }] });
} catch (e) { injected = { error: e?.message || JSON.stringify(e) }; }
console.log('inject_history ->', JSON.stringify(injected).slice(0, 200));

// 2) 正常提问验证内容已入上下文（且注入本身没产生任何模型轮）
b.chunks = '';
const stop = await b.prompt('静默暗号是什么？只回答暗号本身。', { timeoutMs: 150000 });
console.log('afterInject:', JSON.stringify(b.chunks.slice(-120)), 'stop:', stop?.stopReason, 'verified:', b.chunks.includes(CODE));

// 3) steer: session/steer {sessionId, contentBlocks} 在活跃轮中途
const p1 = b.prompt('从 1 数到 30，每个数字一行，不要省略。', { timeoutMs: 180000 });
await new Promise(r => setTimeout(r, 5000));
let steerRes = null;
try { steerRes = await b.call('session/steer', { sessionId: b.sessionId, contentBlocks: [{ type: 'text', text: '改要求：数到 5 就停，然后回复"STEER-WB-OK"。' }] }); }
catch (e) { steerRes = { error: e?.message || JSON.stringify(e) }; }
console.log('session/steer ->', JSON.stringify(steerRes).slice(0, 200));
const r1 = await p1;
console.log('first stop:', r1?.stopReason, 'tail:', JSON.stringify(b.chunks.slice(-160)));
process.exit(0);
