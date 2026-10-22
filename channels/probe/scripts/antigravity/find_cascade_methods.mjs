import fs from 'node:fs';

const content = fs.readFileSync('channels/probe/scripts/antigravity/rpc_methods.txt', 'utf8');
const regex = /\/exa\.language_server_pb\.LanguageServerService\/([A-Za-z0-9_]*Cascade[A-Za-z0-9_]*)/g;
const methods = new Set();
let match;
while ((match = regex.exec(content)) !== null) {
  methods.add(match[1]);
}
const idx = content.indexOf('RevertToCascadeStep');
console.log('Context of RevertToCascadeStep:');
console.log(content.slice(Math.max(0, idx - 200), idx + 300));

