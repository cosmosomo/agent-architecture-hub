// Hermes L1a mini-probes: model-new via newSession._meta, setSessionMode, listSessions retry.
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { Readable, Writable } from "node:stream";

const ROOT = path.resolve(import.meta.dirname, "../../../..");
const LOG = path.join(import.meta.dirname, "l1a_log3.jsonl");
fs.writeFileSync(LOG, "");
const log = (dir, obj) => fs.appendFileSync(LOG, JSON.stringify({ t: Date.now(), dir, ...obj }) + "\n");

const argv = JSON.parse(fs.readFileSync(path.join(process.env.USERPROFILE, ".acpx", "config.json"), "utf8")).agents.hermes.argv;
const cp = spawn(argv[0], argv.slice(1), {
  cwd: ROOT,
  env: { ...process.env, PYTHONIOENCODING: "utf-8", PYTHONUTF8: "1", HTTP_PROXY: "http://127.0.0.1:7892", HTTPS_PROXY: "http://127.0.0.1:7892" },
  stdio: ["pipe", "pipe", "pipe"],
});
cp.stderr.on("data", () => {});
process.on("unhandledRejection", (e) => log("!!", { error: String(e).slice(0, 200) }));

const sdkPath = path.join(process.env.APPDATA, "npm", "node_modules", "acpx", "node_modules", "@agentclientprotocol", "sdk");
const { ClientSideConnection, ndJsonStream } = await import(`file:///${sdkPath.replace(/\\/g, "/")}/dist/acp.js`);

let modeInfo = null;
const clientHandler = {
  requestPermission: async () => ({ outcome: { outcome: "approved" } }),
  sessionUpdate: async (n) => {
    const u = n.update || {};
    if (u.sessionUpdate === "session_info_update") {
      modeInfo = u;
      log("<-", { note: "session_info_update", peek: JSON.stringify(u).slice(0, 300) });
    }
  },
};
const connection = new ClientSideConnection(() => clientHandler, ndJsonStream(Writable.toWeb(cp.stdin), Readable.toWeb(cp.stdout)));
await connection.initialize({
  protocolVersion: 1,
  clientCapabilities: { fs: { readTextFile: true, writeTextFile: true }, terminal: true },
  clientInfo: { name: "probe-zcode-glm-hermes-l1a-p3", version: "1.0.0" },
});

// 1) model-new attempt: newSession with _meta.modelId / _meta.model
let s2 = null;
try {
  s2 = await connection.newSession({
    cwd: ROOT,
    mcpServers: [],
    _meta: { hermes: { modelId: "custom:zai-glm-5.2:glm-5.2" } },
  });
  log("->", { note: "newSession(_meta.modelId).result", currentModelId: s2.models?.currentModelId, sessionId: s2.sessionId });
  console.log("MODEL_NEW_CURRENT:", JSON.stringify(s2.models?.currentModelId));
} catch (e) {
  console.log("MODEL_NEW_ERR:", String(e).slice(0, 250));
  log("->", { note: "newSession(_meta).error", error: String(e).slice(0, 250) });
}

// 2) mode-switch: setSessionMode on that session
try {
  const r = await connection.setSessionMode({ sessionId: s2.sessionId, modeId: "accept_edits" });
  log("->", { note: "setSessionMode.result", result: r });
  console.log("SET_MODE_RESULT:", JSON.stringify(r));
  // read back via fork (returns modes state)
  const fk = await connection.unstable_forkSession({ sessionId: s2.sessionId, cwd: ROOT });
  console.log("MODE_AFTER:", JSON.stringify(fk.modes?.currentModeId));
  log("->", { note: "mode.after", currentModeId: fk.modes?.currentModeId });
} catch (e) {
  console.log("SET_MODE_ERR:", String(e).slice(0, 300));
  log("->", { note: "setSessionMode.error", error: String(e).slice(0, 300) });
}

// 3) listSessions retry
try {
  const ls = await connection.listSessions({});
  console.log("LIST_OK:", JSON.stringify(ls).slice(0, 400));
  log("->", { note: "listSessions({}).result", peek: JSON.stringify(ls).slice(0, 400) });
} catch (e) {
  console.log("LIST_ERR2:", String(e).slice(0, 200));
  log("->", { note: "listSessions({}).error", error: String(e).slice(0, 200) });
}

cp.kill();
setTimeout(() => process.exit(0), 200);
