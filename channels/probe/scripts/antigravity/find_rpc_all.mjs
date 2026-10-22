import fs from 'node:fs';

const content = fs.readFileSync('channels/probe/scripts/antigravity/rpc_methods.txt', 'utf8');
const regex = /\/exa\.language_server_pb\.LanguageServerService\/([A-Za-z0-9_]+)/g;
const methods = new Set();
let match;
while ((match = regex.exec(content)) !== null) {
  methods.add(match[1]);
}
console.log('Total methods:', methods.size);
for (const m of ['DeleteCascadeTrajectory', 'CancelCascadeInvocation', 'ForceStopCascadeTree']) {
  const idx = content.indexOf(m);
  if (idx !== -1) {
    console.log('--- ' + m + ' ---');
    console.log(content.slice(Math.max(0, idx - 100), idx + 150));
  }
}

