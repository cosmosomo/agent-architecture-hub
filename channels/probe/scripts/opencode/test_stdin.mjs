import { spawn } from 'node:child_process';

const env = {
  ...process.env,
  HTTP_PROXY: 'http://127.0.0.1:7892',
  HTTPS_PROXY: 'http://127.0.0.1:7892',
  http_proxy: 'http://127.0.0.1:7892',
  https_proxy: 'http://127.0.0.1:7892'
};

console.log('Testing opencode run with stdin: ignore...');
const start = Date.now();
const p = spawn('cmd.exe', ['/c', 'opencode', 'run', '只回复两个字：收到', '-m', 'zhipuai-coding-plan/glm-5.3-flash', '--format', 'json'], {
  env,
  stdio: ['ignore', 'pipe', 'pipe'],
  cwd: 'E:\\program\\GIT\\Agent\\multi\\Agent-Architecture-Hub'
});

let out = '';
let err = '';
p.stdout.on('data', d => out += d);
p.stderr.on('data', d => err += d);

const timer = setTimeout(() => {
  p.kill();
  console.log('TIMEOUT (25s) KILLED! out:', out, 'err:', err);
  process.exit(1);
}, 25000);

p.on('close', code => {
  clearTimeout(timer);
  console.log(`Finished in ${Date.now() - start}ms, exit code: ${code}`);
  console.log('STDOUT:\n', out);
  console.log('STDERR:\n', err);
});
