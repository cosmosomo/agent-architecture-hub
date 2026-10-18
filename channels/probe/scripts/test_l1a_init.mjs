import { spawn } from "node:child_process";
import path from "node:path";

const sdkPath = path.join(process.env.APPDATA, "npm", "node_modules", "acpx", "node_modules", "@agentclientprotocol", "sdk");
const { ClientSideConnection, ndJsonStream } = await import(`file:///${sdkPath.replace(/\\/g, "/")}/dist/index.js`);

const cp = spawn("zcode-acp-server.cmd", [], {
  env: {
    ...process.env,
    HTTP_PROXY: "http://127.0.0.1:7892",
    HTTPS_PROXY: "http://127.0.0.1:7892",
  },
  stdio: ["pipe", "pipe", "inherit"],
});

const clientHandler = {
  requestPermission: async (req) => {
    console.log("[Client] requestPermission:", req);
    return { outcome: { outcome: "approved" } };
  },
  sessionUpdate: async (notice) => {
    console.log("[Client] sessionUpdate:", notice.update?.sessionUpdate);
  },
};

const stream = ndJsonStream(cp.stdin, cp.stdout);
const connection = new ClientSideConnection(() => clientHandler, stream);

console.log("=== Sending initialize ===");
const initResult = await connection.initialize({
  protocolVersion: 1,
  clientCapabilities: {
    fs: { readTextFile: true, writeTextFile: true },
    terminal: true,
  },
  clientInfo: { name: "probe-l1a", version: "1.0.0" },
});

console.log("Init Result:", JSON.stringify(initResult, null, 2));

cp.kill();
process.exit(0);
