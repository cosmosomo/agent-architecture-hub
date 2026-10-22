import fs from 'node:fs';

const content = fs.readFileSync('channels/probe/scripts/antigravity/rpc_methods.txt', 'utf8');
const regex = /\/exa\.language_server_pb\.LanguageServerService\/([A-Za-z0-9_]*Conversation[A-Za-z0-9_]*)/g;
const methods = new Set();
let match;
while ((match = regex.exec(content)) !== null) {
  methods.add(match[1]);
}
console.log('Conversation methods:', Array.from(methods).sort());
