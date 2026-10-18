import { spawn } from "node:child_process";
import path from "node:path";
import { Readable, Writable } from "node:stream";

const sdkPath = path.join(process.env.APPDATA, "npm", "node_modules", "acpx", "node_modules", "@agentclientprotocol", "sdk");
const { ClientSideConnection, ndJsonStream } = await import(`file:///${sdkPath.replace(/\\/g, "/")}/dist/acp.js`);

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
  const str = d.toString().trim();
  if (!str.includes("commands_changed")) console.error("[stderr]:", str.slice(0, 300));
});

const clientHandler = {
  requestPermission: async (req) => {
    console.log("[Client] requestPermission:", JSON.stringify(req));
    return { outcome: { outcome: "approved" } };
  },
  sessionUpdate: async (notice) => {
    const update = notice.update;
    if (update?.sessionUpdate === "agent_message_chunk") {
      process.stdout.write(update.content?.text || "");
    } else {
      console.log("\n[Client] sessionUpdate:", update?.sessionUpdate, JSON.stringify(update).slice(0, 150));
    }
  },
};

const stream = ndJsonStream(Writable.toWeb(cp.stdin), Readable.toWeb(cp.stdout));
const connection = new ClientSideConnection(() => clientHandler, stream);

await connection.initialize({
  protocolVersion: 1,
  clientCapabilities: {
    fs: { readTextFile: true, writeTextFile: true },
    terminal: true,
  },
  clientInfo: { name: "probe-claude-l1a", version: "1.0.0" },
});

const newSession = await connection.newSession({
  cwd: "E:\\program\\GIT\\Agent\\multi\\Agent-Architecture-Hub",
  mcpServers: [],
});
console.log("Session created:", newSession.sessionId);

// Set model to haiku
console.log("Setting model to haiku...");
await connection.setSessionConfigOption({
  sessionId: newSession.sessionId,
  configId: "model",
  value: "haiku",
});

console.log("Sending prompt: 回复 PING");
const promptResult = await connection.prompt({
  sessionId: newSession.sessionId,
  prompt: [{ type: "text", text: "回复 PING" }],
});
console.log("\nPrompt Result:", JSON.stringify(promptResult, null, 2));

cp.kill();
process.exit(0);
