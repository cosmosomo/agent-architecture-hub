import fs from 'node:fs';

const buf = fs.readFileSync('C:/Users/COLORFIRE/AppData/Local/Programs/antigravity/resources/bin/language_server.exe');
const s = buf.toString('binary');
let idx = 0;
while (true) {
  idx = s.indexOf('HandleCascadeUserInteractionRequest', idx + 1);
  if (idx === -1) break;
  console.log('found at', idx);
  console.log(s.slice(idx, idx + 600).replace(/[^\x20-\x7E\n]/g, '.'));
}
