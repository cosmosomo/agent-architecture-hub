// Hermes L1a phase 2: cancel-aftermath, steer, session/set_model, fork,
// load CLI session, close. Continues session 58118b2c-1745-4ea7-b016-61fd308a8839.
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { Readable, Writable } from "node:stream";

const ROOT = path.resolve(import.meta.dirname, "../../../..");
const LOG = path.join(import.meta.dirname, "l1a_log2.jsonl");
fs.writeFileSync(LOG, "");
const log = (dir, obj) => fs.appendFileSync(LOG, JSON.stringify({ t: Date.now(), dir, ...obj }) + "\n");

const argv = JSON.parse(fs.readFileSync(path.join(process.env.USERPROFILE, ".acpx", "config.json"), "utf8")).agents.hermes.argv;
const cp = spawn(argv[0], argv.slice(1), {
  cwd: ROOT,
  env: { ...process.env, PYTHONIOENCODING: "utf-8", PYTHONUTF8: "1", HTTP_PROXY: "http://127.0.0.1:7892", HTTPS_PROXY: "http://127.0.0.1:7892" },
  stdio: ["pipe", "pipe", "pipe"],
});
cp.stderr.on("data", () => {});

const sdkPath = path.join(process.env.APPDATA, "npm", "node_modules", "acpx", "node_modules", "@agentclientprotocol", "sdk");
const { ClientSideConnection, ndJsonStream } = await import(`file:///${sdkPath.replace(/\\/g, "/")}/dist/acp.js`);

const chunks = {}; // sessionId -> text
const kinds = new Set();
const permLog = [];
const clientHandler = {
  requestPermission: async (req) => {
    permLog.push(req);
    log("<-", { note: "requestPermission", peek: JSON.stringify(req).slice(0, 260) });
    const allow = (req.options || []).find((o) => o.kind === "allow_once" || o.kind === "allow_always");
    return allow ? { outcome: { outcome: "selected", optionId: allow.optionId } } : { outcome: { outcome: "approved" } };
  },
  sessionUpdate: async (notice) => {
    const u = notice.update || {};
    kinds.add(u.sessionUpdate);
    if (u.sessionUpdate === "agent_message_chunk") {
      chunks[notice.sessionId] = (chunks[notice.sessionId] || "") + (u.content?.text || "");
    }
    log("<-", { note: u.sessionUpdate, session: notice.sessionId, peek: JSON.stringify(u).slice(0, 150) });
  },
};
process.on("unhandledRejection", (e) => log("!!", { note: "unhandledRejection", error: String(e).slice(0, 300) }));

const connection = new ClientSideConnection(() => clientHandler, ndJsonStream(Writable.toWeb(cp.stdin), Readable.toWeb(cp.stdout)));
await connection.initialize({
  protocolVersion: 1,
  clientCapabilities: { fs: { readTextFile: true, writeTextFile: true }, terminal: true },
  clientInfo: { name: "probe-zcode-glm-hermes-l1a-p2", version: "1.0.0" },
});
const say = (...a) => console.log(...a);
const P = (t) => [{ type: "text", text: t }];
const SID = "58118b2c-1745-4ea7-b016-61fd308a8839";

// 1. cancel aftermath: resume + prompt
try {
  const r = await connection.resumeSession({ sessionId: SID, cwd: ROOT, mcpServers: [] });
  log("->", { note: "resume.after-cancel", peek: JSON.stringify(r).slice(0, 200) });
  await connection.prompt({ sessionId: SID, prompt: P("上一轮 ping 被打断了。不用再跑。只回复两个字:还活着") });
  say("AFTER_CANCEL_REPLY:", JSON.stringify(chunks[SID]));
  chunks[SID] = "";
} catch (e) {
  say("AFTER_CANCEL_ERR:", String(e).slice(0, 300));
  log("->", { note: "after-cancel.error", error: String(e).slice(0, 300) });
}

// 2. steer: second prompt mid-flight
let steerMain = null;
let steerErr = null;
const p1 = connection.prompt({ sessionId: SID, prompt: P("运行命令 ping -n 40 127.0.0.1，跑完后说 主任务完成。") }).then((r) => (steerMain = r), (e) => (steerErr = "main:" + String(e).slice(0, 200)));
await new Promise((r) => setTimeout(r, 10000));
let steerSecond = null;
let steerSecondErr = null;
try {
  steerSecond = await connection.prompt({ sessionId: SID, prompt: P("插话：结束词请改成 SKATE-99") });
  log("->", { note: "steer.second.result", stopReason: steerSecond.stopReason });
} catch (e) {
  steerSecondErr = String(e).slice(0, 300);
  log("->", { note: "steer.second.error", error: steerSecondErr });
}
await p1;
say("STEER_MAIN:", JSON.stringify(steerMain && steerMain.stopReason), "ERR:", JSON.stringify(steerErr));
say("STEER_SECOND:", JSON.stringify(steerSecond && steerSecond.stopReason), "ERR:", JSON.stringify(steerSecondErr));
say("STEER_TEXT:", JSON.stringify((chunks[SID] || "").slice(-260)));
chunks[SID] = "";

// 3. model-switch via extension method session/set_model
let sm = null;
try {
  sm = await connection.extMethod("session/set_model", { sessionId: SID, modelId: "custom:zai-glm-5.2:glm-5.2" });
  log("->", { note: "session/set_model.result", result: sm });
  say("SET_MODEL:", JSON.stringify(sm).slice(0, 400));
} catch (e) {
  log("->", { note: "session/set_model.error", error: String(e).slice(0, 300) });
  say("SET_MODEL_ERR:", String(e).slice(0, 300));
}
await connection.prompt({ sessionId: SID, prompt: P("你现在用的什么模型？只回复模型名。") });
say("MODEL_REPLY:", JSON.stringify((chunks[SID] || "").slice(-120)));
chunks[SID] = "";

// 4. fork
try {
  const fk = await connection.unstable_forkSession({ sessionId: SID, cwd: ROOT });
  log("->", { note: "session/fork.result", result: fk });
  say("FORK:", JSON.stringify(fk));
  await connection.prompt({ sessionId: fk.sessionId, prompt: P("暗号是什么？只回答暗号本身。") });
  say("FORK_REPLY:", JSON.stringify((chunks[fk.sessionId] || "").slice(-120)));
} catch (e) {
  log("->", { note: "session/fork.error", error: String(e).slice(0, 300) });
  say("FORK_ERR:", String(e).slice(0, 300));
}

// 5. list + load CLI-opened session
try {
  const ls = await connection.listSessions();
  log("->", { note: "session/list.result", peek: JSON.stringify(ls).slice(0, 900) });
  say("LIST:", JSON.stringify(ls).slice(0, 700));
} catch (e) {
  say("LIST_ERR:", String(e).slice(0, 250));
}
try {
  const lr = await connection.loadSession({ cwd: ROOT, mcpServers: [], sessionId: "20261017_180048_62652a" });
  log("->", { note: "session/load(cli).result", result: lr });
  say("LOAD_CLI:", JSON.stringify(lr).slice(0, 250));
  await connection.prompt({ sessionId: "20261017_180048_62652a", prompt: P("暗号是什么？只回答暗号本身。") });
  say("LOAD_CLI_REPLY:", JSON.stringify((chunks["20261017_180048_62652a"] || "").slice(-120)));
} catch (e) {
  log("->", { note: "session/load(cli).error", error: String(e).slice(0, 400) });
  say("LOAD_CLI_ERR:", String(e).slice(0, 400));
}

// 6. close
try {
  const cr = await connection.closeSession({ sessionId: SID });
  log("->", { note: "session/close.result", result: cr });
  say("CLOSE:", JSON.stringify(cr));
} catch (e) {
  log("->", { note: "session/close.error", error: String(e).slice(0, 300) });
  say("CLOSE_ERR:", String(e).slice(0, 300));
}

say("KINDS:", JSON.stringify([...kinds]));
cp.kill();
setTimeout(() => process.exit(0), 300);
