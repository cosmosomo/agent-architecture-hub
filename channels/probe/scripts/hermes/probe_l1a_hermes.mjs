// Hermes L1a: direct ACP-SDK probes against hermes' own acp_adapter.
// Route: spawn argv verbatim from ~/.acpx/config.json (hermes entry).
// Logs every JSON-RPC frame to l1a_log.jsonl next to this script.
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { Readable, Writable } from "node:stream";

const ROOT = path.resolve(import.meta.dirname, "../../../..");
const LOG = path.join(import.meta.dirname, "l1a_log.jsonl");
fs.writeFileSync(LOG, "");
const log = (dir, obj) =>
  fs.appendFileSync(LOG, JSON.stringify({ t: Date.now(), dir, ...obj }) + "\n");

const HERMES_PY = "E:\\program\\GIT\\Agent\\hermes and vcp like\\hermes-agent\\.venv\\Scripts\\python.exe";
const INLINE = fs
  .readFileSync(path.join(process.env.USERPROFILE, ".acpx", "config.json"), "utf8");
const argv = JSON.parse(INLINE).agents.hermes.argv;

const cp = spawn(argv[0], argv.slice(1), {
  cwd: ROOT,
  env: {
    ...process.env,
    PYTHONIOENCODING: "utf-8",
    PYTHONUTF8: "1",
    HTTP_PROXY: "http://127.0.0.1:7892",
    HTTPS_PROXY: "http://127.0.0.1:7892",
  },
  stdio: ["pipe", "pipe", "pipe"],
});
cp.stderr.on("data", (d) => process.stderr.write("[bridge-err] " + d));

const sdkPath = path.join(process.env.APPDATA, "npm", "node_modules", "acpx", "node_modules", "@agentclientprotocol", "sdk");
const { ClientSideConnection, ndJsonStream } = await import(
  `file:///${sdkPath.replace(/\\/g, "/")}/dist/acp.js`
);

const permLog = [];
const updateKinds = [];
const clientHandler = {
  requestPermission: async (req) => {
    permLog.push({ t: Date.now(), req });
    log("<-", { note: "requestPermission", req });
    const allow = (req.options || []).find((o) => o.kind === "allow_once" || o.kind === "allow_always");
    if (allow) return { outcome: { outcome: "selected", optionId: allow.optionId } };
    return { outcome: { outcome: "approved" } };
  },
  sessionUpdate: async (notice) => {
    const u = notice.update || {};
    updateKinds.push({ t: Date.now(), kind: u.sessionUpdate, session: notice.sessionId });
    log("<-", {
      note: "sessionUpdate",
      kind: u.sessionUpdate,
      session: notice.sessionId,
      peek: JSON.stringify(u).slice(0, 220),
    });
  },
};

const stream = ndJsonStream(
  Writable.toWeb(cp.stdin),
  Readable.toWeb(cp.stdout)
);
const connection = new ClientSideConnection(() => clientHandler, stream);

const say = (...a) => console.log(...a);
const text = (blocks) => blocks.map((b) => b.text || "").join("");

// ---- initialize ----
const init = await connection.initialize({
  protocolVersion: 1,
  clientCapabilities: { fs: { readTextFile: true, writeTextFile: true }, terminal: true },
  clientInfo: { name: "probe-zcode-glm-hermes-l1a", version: "1.0.0" },
});
log("->", { note: "initialize.result", result: init });
say("INIT:", JSON.stringify(init));

// ---- session/new (evidence: models / modes / configOptions) ----
const sess = await connection.newSession({ cwd: ROOT, mcpServers: [] });
log("->", { note: "session/new.result", result: sess });
say("NEW_SESSION:", JSON.stringify(sess));
const sid = sess.sessionId;

const P = (t) => [{ type: "text", text: t }];
const runPrompt = async (label, t) => {
  log("->", { note: "session/prompt", label, text: t });
  const r = await connection.prompt({ sessionId: sid, prompt: P(t) });
  log("->", { note: "prompt.result", label, stopReason: r.stopReason, usage: r.usage });
  return r;
};
const collectText = () => {
  // text chunks captured via sessionUpdate handler; assemble from log tail
  const lines = fs.readFileSync(LOG, "utf8").trim().split("\n");
  let out = "";
  for (const l of lines) {
    const o = JSON.parse(l);
    if (o.dir === "<-" && o.kind === "agent_message_chunk" && o.session === sid) {
      try {
        const u = JSON.parse(o.peek);
        out += u.content?.text || "";
      } catch {}
    }
  }
  return out;
};

// ---- open (round 1: plant code word; no memory tool) ----
await runPrompt("open", "暗号是PROBEACP7719。不要用记忆工具。只回复两个字:收到");
say("OPEN_REPLY:", JSON.stringify(collectText()));

// ---- resume (round 2 via session/resume on same id) ----
const res = await connection.resumeSession({ sessionId: sid, cwd: ROOT, mcpServers: [] });
log("->", { note: "session/resume.result", result: res });
say("RESUME:", JSON.stringify(res).slice(0, 300));
await runPrompt("resume", "暗号是什么？只回答暗号本身，不要用任何工具。");
say("RESUME_REPLY:", JSON.stringify(collectText()));

// ---- model-list / model-switch ----
say("MODELS_IN_NEW:", JSON.stringify(sess.models || sess.configOptions || null));
let modelSet = null;
try {
  const cfg = (sess.configOptions || []).find(
    (c) => /model/i.test(c.id || c.configId || "") || /model/i.test(c.name || "")
  );
  say("MODEL_CFG_OPTION:", JSON.stringify(cfg || sess.configOptions || null));
  if (cfg) {
    modelSet = await connection.setSessionConfigOption({
      sessionId: sid,
      configId: cfg.id || cfg.configId,
      value: "custom:zai-glm-5.2:glm-5.2",
    });
    log("->", { note: "set_config_option.result", result: modelSet });
    say("MODEL_SET:", JSON.stringify(modelSet).slice(0, 400));
  }
} catch (e) {
  log("->", { note: "set_config_option.error", error: String(e) });
  say("MODEL_SET_ERR:", String(e));
}
await runPrompt("model-check", "你现在用的什么模型？只回复模型名，不要用工具。");
say("MODEL_REPLY:", JSON.stringify(collectText()));

// ---- permission (write file, expect mid-turn requestPermission) ----
const permTarget = path.join(ROOT, "channels", "probe", "scripts", "tmp", "zcode-glm", "perm_l1a_hermes.txt");
await runPrompt(
  "permission",
  `用写文件工具在 channels/probe/scripts/tmp/zcode-glm 下创建 perm_l1a_hermes.txt，内容 perm-acp-1。完成后只回复:已写`
);
say("PERM_REQUESTS:", JSON.stringify(permLog));
say("PERM_FILE_EXISTS:", fs.existsSync(permTarget));

// ---- cancel ----
let cancelStop = null;
const longP = runPrompt("cancel-long", "运行命令 ping -n 90 127.0.0.1 并把最后统计行贴出来。").then(
  (r) => (cancelStop = r)
);
await new Promise((r) => setTimeout(r, 12000));
await connection.cancel({ sessionId: sid });
log("->", { note: "cancel.sent" });
await longP;
say("CANCEL_STOPREASON:", JSON.stringify(cancelStop));
await runPrompt("after-cancel", "刚才被打断了。不用再跑。只回复两个字:还活着");
say("AFTER_CANCEL_REPLY:", JSON.stringify(collectText()));

// ---- steer (second prompt while one in flight) ----
let steerErr = null;
const p1 = runPrompt("steer-main", "运行命令 ping -n 40 127.0.0.1，跑完后说 主任务完成。").catch(
  (e) => (steerErr = "main:" + String(e))
);
await new Promise((r) => setTimeout(r, 10000));
let steerQueued = null;
try {
  const r2 = await connection.prompt({ sessionId: sid, prompt: P("插话：结束词请改成 SKATE-99") });
  steerQueued = r2;
  log("->", { note: "steer.prompt.result", result: r2 });
} catch (e) {
  steerErr = "second:" + String(e);
  log("->", { note: "steer.prompt.error", error: String(e) });
}
await p1;
say("STEER_ERR:", JSON.stringify(steerErr));
say("STEER_SECOND_RESULT:", JSON.stringify(steerQueued)?.slice(0, 200));

// ---- fork ----
let forkRes = null;
try {
  forkRes = await connection.unstable_forkSession({ sessionId: sid, cwd: ROOT });
  log("->", { note: "session/fork.result", result: forkRes });
  say("FORK:", JSON.stringify(forkRes));
} catch (e) {
  log("->", { note: "session/fork.error", error: String(e) });
  say("FORK_ERR:", String(e));
}
if (forkRes && forkRes.sessionId) {
  await connection.prompt({ sessionId: forkRes.sessionId, prompt: P("暗号是什么？只回答暗号本身。") });
  say("FORK_REPLY:", JSON.stringify(collectText()));
}

// ---- resume-native (load a CLI-opened session via bridge) ----
let listed = null;
try {
  listed = await connection.listSessions();
  log("->", { note: "session/list.result", peek: JSON.stringify(listed).slice(0, 1200) });
  say("LIST_SESSIONS:", JSON.stringify(listed).slice(0, 800));
} catch (e) {
  log("->", { note: "session/list.error", error: String(e) });
  say("LIST_ERR:", String(e));
}
try {
  const lr = await connection.loadSession({
    cwd: ROOT,
    mcpServers: [],
    sessionId: "20261017_180048_62652a",
  });
  log("->", { note: "session/load(cli-id).result", result: lr });
  say("LOAD_CLI:", JSON.stringify(lr).slice(0, 300));
  await connection.prompt({ sessionId: "20261017_180048_62652a", prompt: P("暗号是什么？只回答暗号本身。") });
} catch (e) {
  log("->", { note: "session/load(cli-id).error", error: String(e) });
  say("LOAD_CLI_ERR:", String(e).slice(0, 400));
}

// ---- close ----
let closeRes = null;
try {
  closeRes = await connection.closeSession({ sessionId: sid });
  log("->", { note: "session/close.result", result: closeRes });
  say("CLOSE:", JSON.stringify(closeRes));
} catch (e) {
  log("->", { note: "session/close.error", error: String(e) });
  say("CLOSE_ERR:", String(e).slice(0, 300));
}

// ---- state between turns: request currentOutput if available ----
try {
  const co = await connection.currentOutput({ sessionId: sid });
  say("CURRENT_OUTPUT:", JSON.stringify(co).slice(0, 300));
} catch (e) {
  say("CURRENT_OUTPUT_ERR:", String(e).slice(0, 200));
}

say("UPDATE_KINDS:", JSON.stringify([...new Set(updateKinds.map((u) => u.kind))]));
cp.kill();
process.exit(0);
