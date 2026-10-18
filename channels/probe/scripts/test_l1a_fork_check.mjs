// fork 上下文连续性终验：向 fork 出的会话问最初的暗号。答出 ACP-L1A-999 = 真分叉带了完整上下文。
import { spawn } from "node:child_process";
import { Readable, Writable } from "node:stream";
import path from "node:path";

const sdkPath = path.join(process.env.APPDATA, "npm", "node_modules", "acpx", "node_modules", "@agentclientprotocol", "sdk");
const { ClientSideConnection, ndJsonStream } = await import(`file:///${sdkPath.replace(/\\/g, "/")}/dist/acp.js`);
const BRIDGE = path.join(process.env.APPDATA, "npm", "node_modules", "zcode-acp-server", "dist", "cli.js");
const CWD = "E:\\program\\GIT\\Agent\\multi\\Agent-Architecture-Hub";
const FORKED = process.env.PROBE_FORKED_ID || "sess_6ba5eca1-8f4e-4122-86cc-f4f855e9c3d1";

let text = "";
const cp = spawn(process.execPath, [BRIDGE], { cwd: CWD, env: { ...process.env, HTTP_PROXY: "http://127.0.0.1:7892", HTTPS_PROXY: "http://127.0.0.1:7892" }, stdio: ["pipe", "pipe", "pipe"] });
const conn = new ClientSideConnection(
  () => ({ sessionUpdate: async (n) => { if (n.update?.sessionUpdate === "agent_message_chunk") text += n.update.content?.text || ""; } }),
  ndJsonStream(Writable.toWeb(cp.stdin), Readable.toWeb(cp.stdout))
);
await conn.initialize({ protocolVersion: 1, clientCapabilities: { fs: { readTextFile: true, writeTextFile: true }, terminal: true }, clientInfo: { name: "probe-fork-check", version: "1.0.0" } });
await conn.connection.sendRequest("session/load", { sessionId: FORKED, cwd: CWD, mcpServers: [] });
const r = await conn.prompt({ sessionId: FORKED, prompt: [{ type: "text", text: "最初的那个暗号是什么？只回复暗号本身" }] });
console.log("stopReason:", r.stopReason);
await new Promise((r2) => setTimeout(r2, 500));
console.log("forked session answer:", JSON.stringify(text.trim().slice(0, 200)));
cp.kill();
process.exit(0);
