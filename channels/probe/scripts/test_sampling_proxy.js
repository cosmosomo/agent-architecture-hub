const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const serverScript = `
const readline = require('readline');
const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: false });

setTimeout(() => {
  console.log(JSON.stringify({
    jsonrpc: '2.0',
    id: 101,
    method: 'sampling/createMessage',
    params: {
      messages: [{ role: 'user', content: { type: 'text', text: 'Hello from MCP server needing inference' } }]
    }
  }));
}, 100);

rl.on('line', (line) => {
  try {
    const msg = JSON.parse(line);
    if (msg.id === 101 && msg.result) {
      console.error('SERVER_RECEIVED_SAMPLING_OK: ' + msg.result.content.text);
      process.exit(0);
    }
  } catch {}
});
`;

const dummyServerPath = path.resolve(__dirname, '..', 'tmp', 'dummy_sampling_server.js');
fs.mkdirSync(path.dirname(dummyServerPath), { recursive: true });
fs.writeFileSync(dummyServerPath, serverScript);

const proxyPath = path.resolve(__dirname, '..', '..', '..', 'hub', 'tools', 'mcp_sampling_proxy.js');
const proc = cp.spawn(process.execPath, [proxyPath, process.execPath, dummyServerPath], {
  stdio: ['pipe', 'pipe', 'pipe']
});

proc.stderr.on('data', (d) => console.log('Proxy/Server Stderr: ' + d.toString().trim()));
proc.stdout.on('data', (d) => console.log('Client Stdout: ' + d.toString().trim()));
proc.on('exit', (code) => {
  console.log('Sampling Proxy E2E test exit code: ' + code);
  process.exit(code || 0);
});
