// L1a 重测：用 SDK 1.8.0 的正确方法名 setSessionMode / setSessionConfigOption。
// 验证：plan 模式拦截写文件 + requestPermission 拒绝回路、yolo 恢复、切模型的 db 真值、session/load 复活 fork 会话。
import { spawn } from "node:child_process";
import { Readable, Writable } from "node:stream";
import fs from "node:fs";
import path from "node:path";

const sdkPath = path.join(process.env.APPDATA, "npm", "node_modules", "acpx", "node_modules", "@agentclientprotocol", "sdk");
const { ClientSideConnection, ndJsonStream } = await import(`file:///${sdkPath.replace(/\\/g, "/")}/dist/acp.js`);
const BRIDGE = path.join(process.env.APPDATA, "npm", "node_modules", "zcode-acp-server", "dist", "cli.js");
const CWD = "E:\\program\\GIT\\Agent\\multi\\Agent-Architecture-Hub";
const TMPDIR = "C:\\Users\\COLORFIRE\\AppData\\Local\\Temp\\probe-l1a";
fs.mkdirSync(TMPDIR, { recursive: true });

const results = { permissionCalls: [], modeUpdates: [], updates: [] };
const clientHandler = {
  requestPermission: async (req) => {
    const options = req.options || [];
    const rejectOpt = options.find((o) => /reject/i.test(o.kind || "") || /reject|deny/i.test(o.name || ""));
    const outcome = rejectOpt
      ? { outcome: { outcome: "selected", optionId: rejectOpt.optionId } }
      : { outcome: { outcome: "rejected" } };
    results.permissionCalls.push({
      toolTitle: req.toolCall?.title, kind: req.toolCall?.kind,
      options: options.map((o) => ({ optionId: o.optionId, name: o.name, kind: o.kind })),
      replied: outcome.outcome,
    });
    console.log("[permission]", req.toolCall?.title, "->", JSON.stringify(outcome.outcome));
    return outcome;
  },
  sessionUpdate: async (notice) => {
    const u = notice.update;
    results.updates.push({ sessionUpdate: u?.sessionUpdate, at: Date.now() });
    if (u?.sessionUpdate === "current_mode_update") {
      results.modeUpdates.push(u);
      console.log("[mode-update]", JSON.stringify(u));
    }
  },
};

function connect() {
  const cp = spawn(process.execPath, [BRIDGE], {
    cwd: CWD,
    env: { ...process.env, HTTP_PROXY: "http://127.0.0.1:7892", HTTPS_PROXY: "http://127.0.0.1:7892" },
    stdio: ["pipe", "pipe", "pipe"],
  });
  const stream = ndJsonStream(Writable.toWeb(cp.stdin), Readable.toWeb(cp.stdout));
  const connection = new ClientSideConnection(() => clientHandler, stream);
  return { cp, connection };
}

async function prompt(connection, sessionId, text) {
  const res = await connection.prompt({ sessionId, prompt: [{ type: "text", text }] });
  return { stopReason: res.stopReason, usage: res.usage ?? null };
}

// ---- 进程 A：mode / model / permission ----
const a = connect();
await a.connection.initialize({
  protocolVersion: 1,
  clientCapabilities: { fs: { readTextFile: true, writeTextFile: true }, terminal: true },
  clientInfo: { name: "probe-l1a-retest", version: "1.0.0" },
});
const nw = await a.connection.newSession({ cwd: CWD, mcpServers: [] });
const sessionId = nw.sessionId;
const modes = (nw.modes?.availableModes || []).map((m) => m.id);
console.log("session:", sessionId, "modes:", JSON.stringify(modes), "current:", nw.modes?.currentModeId);

// 1) setSessionMode -> plan
try {
  await a.connection.setSessionMode({ sessionId, modeId: "plan" });
  results.setPlan = { ok: true };
} catch (e) { results.setPlan = { ok: false, error: String(e.message || e).slice(0, 200) }; }
console.log("setPlan:", JSON.stringify(results.setPlan));
await new Promise((r) => setTimeout(r, 500));

// 2) plan 模式下要求写文件（期望：触发审批或被拦）
console.log("== plan-mode write turn ==");
try { results.planWriteTurn = await prompt(a.connection, sessionId, `在 ${TMPDIR.replace(/\\/g, "/")} 目录创建 retest-plan.txt 写入 hello`); }
catch (e) { results.planWriteTurn = { error: String(e.message || e).slice(0, 300) }; }
console.log("planWriteTurn:", JSON.stringify(results.planWriteTurn).slice(0, 400));

// 3) 切回 yolo 再写（期望：直接建成）
try { await a.connection.setSessionMode({ sessionId, modeId: "yolo" }); results.setYolo = { ok: true }; }
catch (e) { results.setYolo = { ok: false, error: String(e.message || e).slice(0, 200) }; }
await new Promise((r) => setTimeout(r, 500));
console.log("== yolo write turn ==");
try { results.yoloWriteTurn = await prompt(a.connection, sessionId, `在 ${TMPDIR.replace(/\\/g, "/")} 目录创建 retest-yolo.txt 写入 hello`); }
catch (e) { results.yoloWriteTurn = { error: String(e.message || e).slice(0, 300) }; }
console.log("yoloWriteTurn:", JSON.stringify(results.yoloWriteTurn).slice(0, 400));

// 4) setSessionConfigOption 切模型 -> new-provider\deepseek-v4.1-flash，再跑一轮
try {
  await a.connection.setSessionConfigOption({ sessionId, configId: "model", value: "new-provider\\deepseek-v4.1-flash" });
  results.setModel = { ok: true, to: "new-provider\\deepseek-v4.1-flash" };
} catch (e) { results.setModel = { ok: false, error: String(e.message || e).slice(0, 200) }; }
console.log("setModel:", JSON.stringify(results.setModel));
console.log("== turn after model switch ==");
try { results.afterSwitchTurn = await prompt(a.connection, sessionId, "回复OK3"); }
catch (e) { results.afterSwitchTurn = { error: String(e.message || e).slice(0, 300) }; }
console.log("afterSwitchTurn:", JSON.stringify(results.afterSwitchTurn).slice(0, 300));
results.switchEpochMs = Date.now();
results.acpSessionId = sessionId;

// 拿桥内部真实 session id（供 db 对照）：fork 返回 parentSessionId
try {
  const fk = await a.connection.connection.sendRequest("session/fork", { sessionId });
  results.bridgeNativeSessionId = fk?.parentSessionId || null;
  results.forkAgain = fk;
} catch (e) { results.forkAgain = { error: String(e.message || e).slice(0, 200) }; }
console.log("bridgeNativeSessionId:", results.bridgeNativeSessionId);

a.cp.kill();

// ---- 进程 B：session/load 复活上一轮 fork 出的会话 ----
const FORKED = process.env.PROBE_FORKED_ID || "sess_6ba5eca1-8f4e-4122-86cc-f4f855e9c3d1";
const b = connect();
await b.connection.initialize({
  protocolVersion: 1,
  clientCapabilities: { fs: { readTextFile: true, writeTextFile: true }, terminal: true },
  clientInfo: { name: "probe-l1a-reload", version: "1.0.0" },
});
try {
  const loaded = await b.connection.connection.sendRequest("session/load", { sessionId: FORKED, cwd: CWD, mcpServers: [] });
  results.sessionLoad = { ok: true, keys: Object.keys(loaded || {}) };
  try { results.loadTurn = await prompt(b.connection, FORKED, "只回复两个字：复活"); } catch (e) { results.loadTurn = { error: String(e.message || e).slice(0, 200) }; }
  console.log("sessionLoad:", JSON.stringify(results.sessionLoad), "loadTurn:", JSON.stringify(results.loadTurn).slice(0, 200));
} catch (e) {
  results.sessionLoad = { ok: false, error: String(e.message || e).slice(0, 300) };
  console.log("sessionLoad:", JSON.stringify(results.sessionLoad));
}
b.cp.kill();

fs.writeFileSync(path.join(import.meta.dirname, "l1a_retest_results.json"), JSON.stringify(results, null, 1));
console.log("DONE ->", path.join(import.meta.dirname, "l1a_retest_results.json"));
process.exit(0);
