import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const HOME = os.homedir();
const CWD = "E:\\program\\GIT\\Agent\\multi\\Agent-Architecture-Hub";
const SCRIPT_PATH = "C:\\Users\\COLORFIRE\\AppData\\Roaming\\npm\\node_modules\\@tencent-ai\\codebuddy-code\\dist\\codebuddy.js";
const PROJECTS_DIR = path.join(HOME, ".workbuddy", "projects", "e-program-GIT-Agent-multi-Agent-Architecture-Hub");

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

function runSync(args, timeout = 75000) {
  const start = Date.now();
  const res = spawnSync(process.execPath, [SCRIPT_PATH, ...args], {
    cwd: CWD,
    env: ENV,
    encoding: "utf8",
    timeout,
    stdio: ["ignore", "pipe", "pipe"],
  });
  return {
    code: res.status,
    stdout: res.stdout || "",
    stderr: res.stderr || "",
    duration: Date.now() - start,
  };
}

function readSessionJsonl(sessionId) {
  const filePath = path.join(PROJECTS_DIR, `${sessionId}.jsonl`);
  if (!fs.existsSync(filePath)) return [];
  const lines = fs.readFileSync(filePath, "utf8").trim().split("\n");
  const parsed = [];
  for (const line of lines) {
    try {
      parsed.push(JSON.parse(line));
    } catch (e) {}
  }
  return parsed;
}

const outDir = path.join(CWD, "channels", "probe", "scripts", "retest");
const resultsFile = path.join(outDir, "wb_l0_retest_results.json");

async function main() {
  const results = {};
  console.log("=== Testing workbuddy L0 native-cli retest ===");

  // 1. Test Fork
  console.log("\n[1/3] Testing fork...");
  const ts = Date.now();
  const parentSessionId = `probe-wb-l0-fork-parent-${ts}`;
  const secretCode = `WB-SECRET-${Math.floor(10000 + Math.random() * 90000)}`;

  console.log(`Creating parent session: ${parentSessionId} with secret: ${secretCode}`);
  const parentRes = runSync([
    "-p",
    `请记住这个暗号：${secretCode}。只需回复：已记住`,
    "--session-id",
    parentSessionId,
    "--model",
    "custom-local:glm-5.3",
    "--output-format",
    "json",
  ]);

  console.log("Parent response exit code:", parentRes.code);
  let parentParsed = [];
  try {
    parentParsed = JSON.parse(parentRes.stdout);
  } catch (e) {}
  const parentLast = parentParsed[parentParsed.length - 1];
  console.log("Parent assistant reply:", parentLast?.result);

  console.log("Now running fork command...");
  const forkCmd = `codebuddy -r ${parentSessionId} --fork-session -p "我们之前约定的暗号是什么？直接回答暗号，不要任何多余字。" --model custom-local:glm-5.3 --output-format json`;
  const forkRes = runSync([
    "-r",
    parentSessionId,
    "--fork-session",
    "-p",
    "我们之前约定的暗号是什么？直接回答暗号，不要任何多余字。",
    "--model",
    "custom-local:glm-5.3",
    "--output-format",
    "json",
  ]);

  console.log("Fork response exit code:", forkRes.code);
  let forkParsed = [];
  try {
    forkParsed = JSON.parse(forkRes.stdout);
  } catch (e) {}
  const forkLast = forkParsed[forkParsed.length - 1];
  const forkedSessionId = forkLast?.session_id;
  const forkedReply = forkLast?.result || "";
  console.log(`Forked Session ID: ${forkedSessionId}`);
  console.log(`Forked Assistant reply: ${forkedReply}`);

  const forkPass = Boolean(
    forkedSessionId &&
    forkedSessionId !== parentSessionId &&
    forkedReply.includes(secretCode)
  );

  // Extract raw assistant turn from forked session jsonl
  const forkedJsonlEntries = readSessionJsonl(forkedSessionId);
  const forkedAssistantTurn = forkedJsonlEntries
    .filter(e => e.type === "message" && e.role === "assistant")
    .pop();

  results["fork"] = {
    pass: forkPass,
    parentSessionId,
    secretCode,
    forkedSessionId,
    forkedReply,
    rawOutput: forkLast,
    forkedAssistantTurn,
    cmd: forkCmd,
  };
  fs.writeFileSync(resultsFile, JSON.stringify(results, null, 2), "utf8");
  console.log(`Fork result: ${forkPass ? "PASS" : "FAIL"}`);

  // 2. Test model-new & 3. Test model-switch
  console.log("\n[2/3] Testing model-new...");
  const modelSessionId = `probe-wb-l0-model-${Date.now()}`;
  const modelNewCmd = `codebuddy -p "请只回复四个字：天地玄黄" --session-id ${modelSessionId} --model custom-local:glm-5.3 --output-format json`;
  const modelNewRes = runSync([
    "-p",
    "请只回复四个字：天地玄黄",
    "--session-id",
    modelSessionId,
    "--model",
    "custom-local:glm-5.3",
    "--output-format",
    "json",
  ]);

  console.log("model-new exit code:", modelNewRes.code);
  let mNewParsed = [];
  try {
    mNewParsed = JSON.parse(modelNewRes.stdout);
  } catch (e) {}
  const mNewLast = mNewParsed[mNewParsed.length - 1];
  console.log("model-new reply:", mNewLast?.result);

  const mNewEntries = readSessionJsonl(modelSessionId);
  const mNewAssistantTurn = mNewEntries
    .filter(e => e.type === "message" && e.role === "assistant")
    .pop();

  const mNewPass = Boolean(
    mNewAssistantTurn?.providerData?.model === "glm-5.3" &&
    mNewAssistantTurn?.providerData?.requestModelId === "custom-local:glm-5.3"
  );

  results["model-new"] = {
    pass: mNewPass,
    sessionId: modelSessionId,
    cliOutput: mNewLast,
    actualAssistantTurn: mNewAssistantTurn,
    cmd: modelNewCmd,
  };
  fs.writeFileSync(resultsFile, JSON.stringify(results, null, 2), "utf8");
  console.log(`model-new result: ${mNewPass ? "PASS" : "FAIL"}`);

  console.log("\n[3/3] Testing model-switch...");
  const switchCmd = `codebuddy -r ${modelSessionId} -p "请只回复四个字：宇宙洪荒" --model custom-local:glm-5.3-flash --output-format json`;
  const switchRes = runSync([
    "-r",
    modelSessionId,
    "-p",
    "请只回复四个字：宇宙洪荒",
    "--model",
    "custom-local:glm-5.3-flash",
    "--output-format",
    "json",
  ]);

  console.log("model-switch exit code:", switchRes.code);
  let switchParsed = [];
  try {
    switchParsed = JSON.parse(switchRes.stdout);
  } catch (e) {}
  const switchLast = switchParsed[switchParsed.length - 1];
  console.log("model-switch reply:", switchLast?.result);

  const switchEntries = readSessionJsonl(modelSessionId);
  const assistantTurns = switchEntries.filter(e => e.type === "message" && e.role === "assistant");
  const turn1Assistant = assistantTurns[0];
  const turn2Assistant = assistantTurns[1];

  console.log("Turn 1 requestModelId:", turn1Assistant?.providerData?.requestModelId, "model:", turn1Assistant?.providerData?.model);
  console.log("Turn 2 requestModelId:", turn2Assistant?.providerData?.requestModelId, "model:", turn2Assistant?.providerData?.model);

  const switchPass = Boolean(
    turn1Assistant?.providerData?.requestModelId === "custom-local:glm-5.3" &&
    turn2Assistant?.providerData?.requestModelId === "custom-local:glm-5.3-flash"
  );

  results["model-switch"] = {
    pass: switchPass,
    sessionId: modelSessionId,
    cliOutput: switchLast,
    turn1Assistant,
    turn2Assistant,
    cmd: switchCmd,
  };
  fs.writeFileSync(resultsFile, JSON.stringify(results, null, 2), "utf8");
  console.log(`model-switch result: ${switchPass ? "PASS" : "FAIL"}`);
}

main().catch(err => {
  console.error("Retest failed:", err);
  process.exit(1);
});
