import { spawn } from 'node:child_process';

const env = {
  ...process.env,
  HTTP_PROXY: 'http://127.0.0.1:7892',
  HTTPS_PROXY: 'http://127.0.0.1:7892',
  http_proxy: 'http://127.0.0.1:7892',
  https_proxy: 'http://127.0.0.1:7892'
};

const p = spawn('opencode.cmd', ['run', '只回复数字42', '-m', 'opencode/big-pickle', '--format', 'json'], {
  env,
  shell: true,
  cwd: 'E:\\program\\GIT\\Agent\\multi\\Agent-Architecture-Hub'
});

let out = '';
let err = '';
p.stdout.on('data', d => out += d);
p.stderr.on('data', d => err += d);

p.on('close', code => {
  console.log('EXIT CODE:', code);
  console.log('STDERR:', err);
  console.log('STDOUT FULL:\n', out);
});

setTimeout(() => {
  p.kill();
  console.log('TIMEOUT');
  process.exit(1);
}, 30000);
