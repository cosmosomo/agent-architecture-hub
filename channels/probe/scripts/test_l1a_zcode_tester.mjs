// L1a 实测：直连 zcode-acp-server（ACP SDK），按 channels/probe/README.md 3.2 能力清单逐项验证。
// 入口用真实存在的 dist/cli.js（旧 suite 里的 dist/bin/zcode-acp-server.js 不存在）。
// 只写 channels/probe/scripts/l1a_tester_results.json，不改任何已有文件。
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

const results = { startedAt: new Date().toISOString(), turns: {}, raw: {} };
const updates = [];
const permissionCalls = [];

function summarizeUpdate(u) {
  return { type: u.type, dt: u.at, sessionUpdate: u.update?.sessionUpdate, kind: u.update?.kind };
}

const clientHandler = {
  requestPermission: async (req) => {
    const options = req.options || [];
    const rejectOpt = options.find((o) => /reject/i.test(o.kind || o.name || ""));
    const outcome = rejectOpt
      ? { outcome: { outcome: "selected", optionId: rejectOpt.optionId } }
      : { outcome: { outcome: "rejected" } };
    permissionCalls.push({ at: Date.now(), tool: req.toolCall?.title || req.toolCall?.kind, kind: req.toolCall?.kind, options: options.map((o) => ({ optionId: o.optionId, name: o.name, kind: o.kind })), replied: outcome.outcome });
    console.log("[permission] request for:", req.toolCall?.title, "-> replied:", JSON.stringify(outcome.outcome));
    return outcome;
  },
  sessionUpdate: async (notice) => {
    updates.push({ at: Date.now(), update: notice.update });
    const t = notice.update?.sessionUpdate;
    if (t === "agent_message_chunk") process.stdout.write(".");
  },
};

const cp = spawn(process.execPath, [BRIDGE], {
  cwd: CWD,
  env: { ...process.env, HTTP_PROXY: "http://127.0.0.1:7892", HTTPS_PROXY: "http://127.0.0.1:7892" },
  stdio: ["pipe", "pipe", "pipe"],
});
cp.stderr.on("data", (d) => { results.raw.bridgeStderr = (results.raw.bridgeStderr || "") + d; });
const stream = ndJsonStream(Writable.toWeb(cp.stdin), Readable.toWeb(cp.stdout));
const connection = new ClientSideConnection(() => clientHandler, stream);

async function prompt(sessionId, text) {
  const t0 = Date.now();
  const mark = updates.length;
  const res = await connection.prompt({ sessionId, prompt: [{ type: "text", text }] });
  const chunks = updates.slice(mark);
  return {
    stopReason: res.stopReason, usage: res.usage ?? null, durationMs: Date.now() - t0,
    messageText: chunks.filter((u) => u.update?.sessionUpdate === "agent_message_chunk")
      .map((u) => u.update.content?.text || "").join(""),
    updateTypes: [...new Set(chunks.map((u) => u.update?.sessionUpdate))],
    chunkCount: chunks.length,
  };
}

async function tryRaw(name, method, params) {
  try {
    const r = await connection.connection.sendRequest(method, params);
    results.raw[name] = { ok: true, res: r };
    return r;
  } catch (e) {
    results.raw[name] = { ok: false, error: String(e.message || e).slice(0, 300) };
    return null;
  }
}

// 1. initialize
console.log("== initialize ==");
const init = await connection.initialize({
  protocolVersion: 1,
  clientCapabilities: { fs: { readTextFile: true, writeTextFile: true }, terminal: true },
  clientInfo: { name: "probe-l1a-tester", version: "1.0.0" },
});
results.raw.initialize = init;
const modeIds = (init.modes || {}).currentModeId !== undefined ? (init.modes?.availableModes || []).map((m) => m.id) : [];
console.log("protocolVersion:", init.protocolVersion, "authMethods:", (init.authMethods || []).length,
  "modes:", JSON.stringify(init.modes), "configOptions:", JSON.stringify(init.configOptions ?? null));

// 2. session/new
console.log("== session/new ==");
const nw = await connection.newSession({ cwd: CWD, mcpServers: [] });
const sessionId = nw.sessionId;
results.raw.sessionNew = { sessionId, configOptions: nw.configOptions, modes: nw.modes };
const modelCfg = (nw.configOptions || []).find((c) => c.id === "model" || c.category === "model");
const modelOptions = (modelCfg?.options || []).map((o) => ({ value: o.value, name: o.name }));
const currentMode = nw.modes?.currentModeId;
const availableModes = (nw.modes?.availableModes || []).map((m) => m.id);
console.log("sessionId:", sessionId, "\nmodels:", JSON.stringify(modelOptions), "\nmodes:", JSON.stringify(availableModes), "current:", currentMode);

// 3. open + observe-live：第 1 轮
console.log("\n== turn1 open ==");
results.turns.t1_open = await prompt(sessionId, "记住暗号：ACP-L1A-999，回复已收到");
console.log(JSON.stringify(results.turns.t1_open, null, 1).slice(0, 700));

// 4. resume：第 2 轮复述
console.log("\n== turn2 resume ==");
results.turns.t2_resume = await prompt(sessionId, "上一轮的暗号是什么？只回复暗号本身");
console.log("answer:", results.turns.t2_resume.messageText.trim().slice(0, 120));

// 5. model-switch：切到列表里另一个模型，第 3 轮
let modelSwitch = { attempted: false };
if (modelOptions.length >= 2) {
  const from = modelOptions.find((o) => /flash/i.test(o.value || o.name))?.value || modelOptions[0].value;
  const to = modelOptions.find((o) => o.value !== from)?.value;
  modelSwitch = { attempted: true, from, to };
  try {
    await connection.setConfigOption({ sessionId, configId: modelCfg.id, value: to });
    modelSwitch.setOk = true;
  } catch (e) { modelSwitch.setOk = false; modelSwitch.setError = String(e.message || e).slice(0, 200); }
  console.log("\n== turn3 after model switch ->", to, "==");
  results.turns.t3_afterModelSwitch = await prompt(sessionId, "回复OK2");
  console.log(JSON.stringify(results.turns.t3_afterModelSwitch).slice(0, 400));
}
results.raw.modelSwitch = modelSwitch;
results.switchEpochMs = Date.now(); // 供事后按时间窗查 db.sqlite model_usage

// 6. mode-switch(plan) + permission 拒绝回路：第 4 轮要求建文件
const planId = availableModes.find((m) => /plan/i.test(m));
let modeSwitch = { availableModes, currentMode };
if (planId) {
  try { await connection.setMode({ sessionId, modeId: planId }); modeSwitch.setPlanOk = true; }
  catch (e) { modeSwitch.setPlanOk = false; modeSwitch.setError = String(e.message || e).slice(0, 200); }
  console.log("\n== turn4 in plan mode (write request) ==");
  results.turns.t4_planWrite = await prompt(sessionId, `在 ${TMPDIR.replace(/\\/g, "/")} 目录创建 plan-test.txt 写入 hello`);
  console.log(JSON.stringify(results.turns.t4_planWrite).slice(0, 500));
  try { await connection.setMode({ sessionId, modeId: currentMode || availableModes[0] }); modeSwitch.restoreOk = true; }
  catch (e) { modeSwitch.restoreOk = false; }
}
results.raw.modeSwitch = modeSwitch;

// 7. yolo 回来建文件（mode 行为对照 + 会话仍可用）
if (availableModes.includes("yolo")) {
  try { await connection.setMode({ sessionId, modeId: "yolo" }); } catch (e) {}
  console.log("\n== turn5 in yolo (write request) ==");
  results.turns.t5_yoloWrite = await prompt(sessionId, `在 ${TMPDIR.replace(/\\/g, "/")} 目录创建 yolo-test.txt 写入 hello`);
  console.log(JSON.stringify(results.turns.t5_yoloWrite).slice(0, 400));
}
results.raw.permissionCalls = permissionCalls;

// 8. cancel：打断长轮 + 会话存活
console.log("\n== turn6 cancel ==");
const p6 = connection.prompt({ sessionId, prompt: [{ type: "text", text: "从1数到300，每个数单独一行输出" }] });
await new Promise((r) => setTimeout(r, 2500));
let cancelErr = null;
try { await connection.cancel({ sessionId }); } catch (e) { cancelErr = String(e.message || e); }
try {
  const r6 = await p6;
  results.raw.cancel = { stopReason: r6.stopReason, cancelErr };
} catch (e) { results.raw.cancel = { promptError: String(e.message || e).slice(0, 200), cancelErr }; }
console.log("cancel:", JSON.stringify(results.raw.cancel));
try { results.raw.postCancelAlive = await prompt(sessionId, "暗号是什么？只回复暗号本身"); } catch (e) { results.raw.postCancelAlive = { error: String(e.message || e).slice(0, 200) }; }
console.log("post-cancel alive:", JSON.stringify(results.raw.postCancelAlive).slice(0, 300));

// 9. steer：轮内插话（同时发第二个 prompt，记录协议真实行为）
console.log("\n== steer probe ==");
const p7 = connection.prompt({ sessionId, prompt: [{ type: "text", text: "从1数到200，每个数单独一行输出" }] });
await new Promise((r) => setTimeout(r, 1500));
try {
  const steer = await connection.prompt({ sessionId, prompt: [{ type: "text", text: "插话：数到10就停" }] });
  results.raw.steer = { accepted: true, stopReason: steer.stopReason };
} catch (e) { results.raw.steer = { accepted: false, error: String(e.message || e).slice(0, 200) }; }
try { const r7 = await p7; results.raw.steer.firstTurnStopReason = r7.stopReason; } catch (e) { results.raw.steer.firstTurnError = String(e.message || e).slice(0, 200); }
console.log("steer:", JSON.stringify(results.raw.steer));

// 10. 非标准方法探测：session/read、session/compact、session/fork、session/close
await tryRaw("sessionRead", "session/read", { sessionId });
await tryRaw("sessionCompact", "session/compact", { sessionId });
await tryRaw("sessionFork", "session/fork", { sessionId });

// 11. 状态相关：汇总本会话收到的 update 类型与 usage_update
results.raw.updateTypeHistogram = updates.reduce((m, u) => { const t = u.update?.sessionUpdate || "other"; m[t] = (m[t] || 0) + 1; return m; }, {});
results.raw.usageUpdateSample = updates.find((u) => u.update?.sessionUpdate === "usage_update")?.update ?? null;

await tryRaw("sessionClose", "session/close", { sessionId });
try { cp.kill(); } catch (e) {}

fs.writeFileSync(path.join(import.meta.dirname, "l1a_tester_results.json"), JSON.stringify(results, null, 1));
console.log("\nDONE ->", path.join(import.meta.dirname, "l1a_tester_results.json"));
process.exit(0);
