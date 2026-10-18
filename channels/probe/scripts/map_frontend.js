// Maps a front-end file: which function each /api call sits in, and which element each event binding hangs on.
// Usage: node map_frontend.js <file.js>
const fs = require('fs');

const file = process.argv[2];
const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
const fnRe = /(?:async\s+)?function\s+([A-Za-z_$][\w$]*)|(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:function|\([^)]*\)\s*=>|[A-Za-z_$][\w$]*\s*=>)|^\s{0,4}(?:async\s+)?([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*\{\s*$/;
let fn = '(top)';
const apis = [];
const binds = [];
lines.forEach((l, i) => {
  const m = l.match(fnRe);
  if (m && !/^\s{6,}/.test(l)) fn = m[1] || m[2] || m[3];
  const api = l.match(/\/api\/[\w\/-]+/);
  if (api) apis.push(`${i + 1}\t${fn}\t${api[0]}`);
  const b = l.match(/(?:([\w$.]+(?:\([^)]*\))?)\.)?(addEventListener)\(\s*['"](\w+)['"]\s*,\s*([\w$.]+)?/);
  const on = l.match(/([\w$.#'"\[\]()-]+)\.on(click|change|input|keydown|submit)\s*=\s*([\w$.]+)?/);
  if (b) binds.push(`${i + 1}\t${fn}\t${(b[1] || '').slice(0, 50)}\t${b[3]}\t${b[4] || '(inline)'}`);
  else if (on) binds.push(`${i + 1}\t${fn}\t${on[1].slice(0, 50)}\t${on[2]}\t${on[3] || '(inline)'}`);
  const dataAct = l.match(/data-act(?:ion)?=["']([\w-]+)["']/g);
  if (dataAct) binds.push(`${i + 1}\t${fn}\t${dataAct.join(',').slice(0, 60)}\t(data-action)\t-`);
});
console.log(`# ${file}\n## API calls (line, function, path)`);
console.log(apis.join('\n'));
console.log('## Event bindings (line, in function, target, event, handler)');
console.log(binds.join('\n'));
