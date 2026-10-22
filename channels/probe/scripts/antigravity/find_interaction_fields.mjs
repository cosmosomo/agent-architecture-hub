import fs from 'node:fs';

const buf = fs.readFileSync('C:/Users/COLORFIRE/AppData/Local/Programs/antigravity/resources/bin/language_server.exe');
const s = buf.toString('binary');

// Find protobuf field tags for HandleCascadeUserInteractionRequest
const m = s.match(/type HandleCascadeUserInteractionRequest struct \{([^}]+)\}/);
if (m) {
  console.log('found struct:', m[1]);
} else {
  // Search for the descriptor
  const idx = s.indexOf('HandleCascadeUserInteractionRequest');
  let p = 0;
  while ((p = s.indexOf('user_interaction', p + 1)) !== -1) {
    console.log('user_interaction at', p, s.slice(p - 100, p + 200).replace(/[^\x20-\x7E\n]/g, '.'));
  }
}
