import { AcpBridge } from 'file:///E:/program/GIT/Agent/multi/Agent-Architecture-Hub/hub/tools/acp_resident_bridge.mjs';
import fs from 'node:fs';
const b = new AcpBridge('opencode');
await b.start();
// open-idle: 只建不跑
await b.newSession(process.cwd());
await new Promise(r => setTimeout(r, 1500));
const idleChunks = b.chunks.length;
// session/list 证明存在、可查
let listed = null;
try { listed = await b.call('session/list', {}); } catch (e) { listed = { error: e?.message || JSON.stringify(e) }; }
const listOk = JSON.stringify(listed).includes(b.sessionId);
console.log('open-idle:', JSON.stringify({ sessionId: b.sessionId, idleChunks, listedInSessionList: listOk }));

// model-switch: big-pickle(免费) -> zhipuai glm-5.3-flash
let setModel = null;
try { setModel = await b.call('session/set_model', { sessionId: b.sessionId, modelId: 'zhipuai-coding-plan/glm-5.3-flash' }); }
catch (e) { setModel = { error: e?.message || JSON.stringify(e) }; }
b.chunks = '';
await b.prompt('只回答：你现在是哪个模型？（模型 ID）', { timeoutMs: 120000 });
console.log('model-switch:', JSON.stringify({ setModel, answer: b.chunks.slice(-100), cfgUpdate: JSON.stringify(b.toolCalls).length > 0 ? undefined : undefined }));

// permission: 让它写 cwd 之外的文件（external_directory -> ask）→ 驱动自动 allow → 落盘
const outside = process.env.USERPROFILE + '\AppData\Local\Temp\oc-perm-probe-1019.txt';
if (fs.existsSync(outside)) fs.unlinkSync(outside);
b.permissionFrames.length = 0;
b.chunks = '';
await b.prompt(`请创建文件 ${outside}，内容一行：PERM-OC-OK。`, { timeoutMs: 150000 });
console.log('permission:', JSON.stringify({ frames: b.permissionFrames.length, firstTitle: b.permissionFrames[0]?.toolCall?.title, fileWritten: fs.existsSync(outside), content: fs.existsSync(outside) ? fs.readFileSync(outside, 'utf8').trim() : null }));

// close: session/close 后再 prompt 应失败
let closed = null;
try { closed = await b.call('session/close', { sessionId: b.sessionId }); } catch (e) { closed = { error: e?.message || JSON.stringify(e) }; }
let afterClose = null;
try { await b.prompt('回复 PING', { timeoutMs: 60000 }); afterClose = { promptStillWorked: true, tail: b.chunks.slice(-60) }; }
catch (e) { afterClose = { promptRejected: e?.message || JSON.stringify(e) }; }
console.log('close:', JSON.stringify({ closed, afterClose }));
process.exit(0);
