// Gemini L1a: direct ACP-SDK probes against `gemini --acp`.
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { Readable, Writable } from "node:stream";

const ROOT = path.resolve(import.meta.dirname, "../../../..");
const LOG = path.join(import.meta.dirname, "gem_l1a_log.jsonl");
fs.writeFileSync(LOG, "");
const log = (dir, obj) => fs.appendFileSync(LOG, JSON.stringify({ t: Date.now(), dir, ...obj }) + "\n");

const cp = spawn("gemini", ["--acp"], {
  cwd: ROOT,
  shell: true,
  env: { ...process.env, HTTP_PROXY: "http://127.0.0.1:7892", HTTPS_PROXY: "http://127.0.0.1:7892" },
  stdio: ["pipe", "pipe", "pipe"],
});
cp.on("error", (e) => log("!!", { note: "spawn.error", error: String(e) }));
let errOut = "";
cp.stderr.on("data", (d) => { errOut += d; });
cp.on("exit", (c) => log("<-", { note: "bridge.exit", code: c }));

const sdkPath = path.join(process.env.APPDATA, "npm", "node_modules", "acpx", "node_modules", "@agentclientprotocol", "sdk");
const { ClientSideConnection, ndJsonStream } = await import(`file:///${sdkPath.replace(/\\/g, "/")}/dist/acp.js`);

const permLog = [];
const chunks = {};
const clientHandler = {
  requestPermission: async (req) => {
    permLog.push(req);
    log("<-", { note: "requestPermission", peek: JSON.stringify(req).slice(0, 220) });
    const allow = (req.options || []).find((o) => o.kind === "allow_once");
    return allow ? { outcome: { outcome: "selected", optionId: allow.optionId } } : { outcome: { outcome: "approved" } };
  },
  sessionUpdate: async (n) => {
    const u = n.update || {};
    if (u.sessionUpdate === "agent_message_chunk") chunks[n.sessionId] = (chunks[n.sessionId] || "") + (u.content?.text || "");
    log("<-", { note: u.sessionUpdate, session: n.sessionId, peek: JSON.stringify(u).slice(0, 120) });
  },
};
process.on("unhandledRejection", (e) => log("!!", { error: String(e).slice(0, 250) }));

const connection = new ClientSideConnection(() => clientHandler, ndJsonStream(Writable.toWeb(cp.stdin), Readable.toWeb(cp.stdout)));

try {
  const init = await connection.initialize({
    protocolVersion: 1,
    clientCapabilities: { fs: { readTextFile: true, writeTextFile: true }, terminal: true },
    clientInfo: { name: "probe-zcode-glm-gemini-l1a", version: "1.0.0" },
  });
  log("->", { note: "initialize.result", result: init });
  console.log("INIT:", JSON.stringify(init));

  const sess = await connection.newSession({ cwd: ROOT, mcpServers: [] });
  log("->", { note: "session/new.result", result: sess });
  console.log("NEW:", JSON.stringify(sess).slice(0, 900));
  const sid = sess.sessionId;
  const r = await connection.prompt({ sessionId: sid, prompt: [{ type: "text", text: "只回复两个字:收到" }] });
  log("->", { note: "prompt.result", result: r });
  console.log("PROMPT:", JSON.stringify(r));
  console.log("REPLY:", JSON.stringify((chunks[sid] || "").slice(-100)));
} catch (e) {
  log("->", { note: "probe.error", error: String(e).slice(0, 400) });
  console.log("ERR:", String(e).slice(0, 400));
}
await new Promise((r) => setTimeout(r, 500));
console.log("BRIDGE_ERR:", errOut.slice(0, 300));
cp.kill();
process.exit(0);
