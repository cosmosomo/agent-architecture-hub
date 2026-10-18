import { spawn } from "node:child_process";
import path from "node:path";

const sdkPath = path.join(process.env.APPDATA, "npm", "node_modules", "acpx", "node_modules", "@agentclientprotocol", "sdk");
const { ClientSideConnection, ndJsonStream } = await import(`file:///${sdkPath.replace(/\\/g, "/")}/dist/acp.js`);

console.log("Spawning claude-agent-acp...");
const cp = spawn("cmd.exe", ["/c", "claude-agent-acp.cmd"], {
  env: {
    ...process.env,
    ACPX_CLAUDE_INCLUDE_USER_SETTINGS: "1",
    HTTP_PROXY: "http://127.0.0.1:7892",
    HTTPS_PROXY: "http://127.0.0.1:7892",
  },
  stdio: ["pipe", "pipe", "pipe"],
});

cp.stderr.on("data", (d) => {
  console.error("[claude-agent-acp stderr]:", d.toString().trim());
});

const clientHandler = {
  requestPermission: async (req) => {
    console.log("[Client] requestPermission:", JSON.stringify(req));
    return { outcome: { outcome: "approved" } };
  },
  sessionUpdate: async (notice) => {
    console.log("[Client] sessionUpdate:", JSON.stringify(notice));
  },
};

import { Readable, Writable } from "node:stream";

const stream = ndJsonStream(Writable.toWeb(cp.stdin), Readable.toWeb(cp.stdout));
const connection = new ClientSideConnection(() => clientHandler, stream);

console.log("=== 1. initialize ===");
const initResult = await connection.initialize({
  protocolVersion: 1,
  clientCapabilities: {
    fs: { readTextFile: true, writeTextFile: true },
    terminal: true,
  },
  clientInfo: { name: "probe-claude-l1a", version: "1.0.0" },
});
console.log("Init Result agentCapabilities:", JSON.stringify(initResult.agentCapabilities, null, 2));

console.log("=== 2. session/new ===");
const newSessionResult = await connection.newSession({
  cwd: "E:\\program\\GIT\\Agent\\multi\\Agent-Architecture-Hub",
  mcpServers: [],
});
console.log("New Session Result:", JSON.stringify(newSessionResult, null, 2));

cp.kill();
process.exit(0);
