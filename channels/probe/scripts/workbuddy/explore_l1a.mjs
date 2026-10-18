import { spawn } from "node:child_process";
import { Readable, Writable } from "node:stream";
import path from "node:path";
import os from "node:os";

const sdkPath = path.join(process.env.APPDATA, "npm", "node_modules", "acpx", "node_modules", "@agentclientprotocol", "sdk");
const { ClientSideConnection, ndJsonStream } = await import(`file:///${sdkPath.replace(/\\/g, "/")}/dist/acp.js`);

const CODEBUDDY_SCRIPT = "C:\\Users\\COLORFIRE\\AppData\\Roaming\\npm\\node_modules\\@tencent-ai\\codebuddy-code\\dist\\codebuddy.js";
const HOME = os.homedir();
const ENV = {
  ...process.env,
  CODEBUDDY_CONFIG_DIR: path.join(HOME, ".workbuddy"),
  WORKBUDDY_CONFIG_DIR: path.join(HOME, ".workbuddy"),
  ACC_PRODUCT_CONFIG_V3: JSON.stringify({
    authentication: {
      type: "custom-token",
      attributes: { token: "wb-local-byok" },
    },
  }),
  HTTP_PROXY: "http://127.0.0.1:7892",
  HTTPS_PROXY: "http://127.0.0.1:7892",
};

const cp = spawn(process.execPath, [CODEBUDDY_SCRIPT, "--acp"], {
  cwd: "E:\\program\\GIT\\Agent\\multi\\Agent-Architecture-Hub",
  env: ENV,
  stdio: ["pipe", "pipe", "pipe"],
});

cp.stderr.on("data", (d) => {
  // console.error('[stderr]', d.toString());
});

const clientHandler = {
  requestPermission: async (req) => {
    console.log("[Client] requestPermission:", JSON.stringify(req));
    return { outcome: { outcome: "approved" } };
  },
  sessionUpdate: async (notice) => {
    console.log("[Client] sessionUpdate:", notice.update?.sessionUpdate);
  },
};

const stream = ndJsonStream(Writable.toWeb(cp.stdin), Readable.toWeb(cp.stdout));
const connection = new ClientSideConnection(() => clientHandler, stream);

const initResult = await connection.initialize({
  protocolVersion: 1,
  clientCapabilities: {
    fs: { readTextFile: true, writeTextFile: true },
    terminal: true,
  },
  clientInfo: { name: "probe-workbuddy-l1a", version: "1.0.0" },
});

const newSessionRes = await connection.newSession({
  cwd: "E:\\program\\GIT\\Agent\\multi\\Agent-Architecture-Hub",
  mcpServers: [],
});

import fs from "node:fs";
fs.writeFileSync("channels/probe/scripts/workbuddy/l1a_init_data.json", JSON.stringify({ initResult, newSessionRes }, null, 2));
console.log("Written to channels/probe/scripts/workbuddy/l1a_init_data.json");

console.log("newSessionRes modes & models:", JSON.stringify({
  sessionId: newSessionRes.sessionId,
  modes: newSessionRes.modes,
  models: newSessionRes.models,
  configOptions: newSessionRes.configOptions,
}, null, 2));

cp.kill();
process.exit(0);
