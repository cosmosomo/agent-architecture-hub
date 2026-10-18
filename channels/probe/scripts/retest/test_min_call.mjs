import { spawn } from "node:child_process";

const env = {
  ...process.env,
  ACPX_CLAUDE_INCLUDE_USER_SETTINGS: "1",
  HTTP_PROXY: "http://127.0.0.1:7892",
  HTTPS_PROXY: "http://127.0.0.1:7892",
};

console.log("Testing minimum claude call with -p 'ping'...");
const cp = spawn("claude.cmd", ["-p", "--model", "haiku", "ping, answer one word"], {
  env,
  shell: true,
  stdio: ["ignore", "pipe", "pipe"],
});

let stdout = "";
let stderr = "";

cp.stdout.on("data", (d) => (stdout += d.toString()));
cp.stderr.on("data", (d) => (stderr += d.toString()));

const timeout = setTimeout(() => {
  console.log("Timeout reached, killing process...");
  cp.kill();
}, 30000);

cp.on("close", (code) => {
  clearTimeout(timeout);
  console.log(`Exit code: ${code}`);
  console.log(`STDOUT:\n${stdout}`);
  console.log(`STDERR:\n${stderr}`);
});
