import { AcpBridge } from 'file:///E:/program/GIT/Agent/multi/Agent-Architecture-Hub/hub/tools/acp_resident_bridge.mjs';
import fs from 'node:fs';
import path from 'node:path';
const dir = path.join(process.cwd(), 'channels', 'probe', 'scripts', 'output');
const f1 = path.join(dir, `hm-mode-default-${Date.now()}.txt`);
const f2 = path.join(dir, `hm-mode-accept-${Date.now()}.txt`);
const b = new AcpBridge('hermes');
await b.start();
await b.newSession(process.cwd());
// 阶段1：default 模式（编辑要审批）写文件
b.permissionFrames.length = 0;
await b.prompt(`创建文件 ${f1}，内容：MODE-DEFAULT。完成后只回复 OK。`, { timeoutMs: 150000 });
const framesDefault = b.permissionFrames.length;
const w1 = fs.existsSync(f1);
console.log('default:', JSON.stringify({ frames: framesDefault, firstKind: framesDefault ? b.permissionFrames[0]?.toolCall?.kind : null, written: w1 }));
// 阶段2：切 accept_edits 后写文件
let sm = null;
try { sm = await b.call('session/set_mode', { sessionId: b.sessionId, modeId: 'accept_edits' }); } catch (e) { sm = { error: e?.message || JSON.stringify(e) }; }
b.permissionFrames.length = 0;
b.chunks = '';
await b.prompt(`创建文件 ${f2}，内容：MODE-ACCEPT。完成后只回复 OK。`, { timeoutMs: 150000 });
const framesAccept = b.permissionFrames.length;
const w2 = fs.existsSync(f2);
console.log('accept_edits:', JSON.stringify({ setMode: sm, frames: framesAccept, written: w2 }));
console.log('behaviorChanged:', framesDefault > 0 && framesAccept === 0 && w1 && w2);
process.exit(0);
