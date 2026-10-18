import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const HOME = os.homedir();
const CWD = "E:\\program\\GIT\\Agent\\multi\\Agent-Architecture-Hub";
const PROJECTS_DIR = path.join(HOME, ".workbuddy", "projects", "e-program-GIT-Agent-multi-Agent-Architecture-Hub");
const ACPX_SESSIONS_DIR = path.join(HOME, ".acpx", "sessions");

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

function runAcpx(args, timeout = 75000) {
  const start = Date.now();
  const res = spawnSync("acpx", args, {
    cwd: CWD,
    env: ENV,
    shell: true,
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

function findAcpSessionId(sessionName) {
  if (!fs.existsSync(ACPX_SESSIONS_DIR)) return null;
  const files = fs.readdirSync(ACPX_SESSIONS_DIR);
  for (const f of files) {
    if (f.endsWith(".stream.ndjson") || !f.endsWith(".json")) continue;
    try {
      const fullPath = path.join(ACPX_SESSIONS_DIR, f);
      const data = JSON.parse(fs.readFileSync(fullPath, "utf8"));
      if (data.name === sessionName) {
        return data.acp_session_id;
      }
    } catch (e) {}
  }
  return null;
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
const resultsFile = path.join(outDir, "wb_l1b_retest_results.json");

async function main() {
  const results = {};
  console.log("=== Testing workbuddy L1b acpx retest ===");

  const sessionName = `probe-wb-l1b-model-${Date.now()}`;
  console.log(`Session name: ${sessionName}`);

  // Create session first
  console.log("0. Creating session via sessions new...");
  const newSessRes = runAcpx(["--format", "json", "--model", "custom-local:glm-5.3", "workbuddy", "sessions", "new", "--name", sessionName]);
  console.log("sessions new code:", newSessRes.code, "stdout:", newSessRes.stdout.trim());

  // 1. Test model-new
  console.log("\n[1/2] Testing model-new...");
  const modelNewCmd = `acpx --format json --model custom-local:glm-5.3 workbuddy -s ${sessionName} "请只回复四个字：辰宿列张"`;
  const mNewRes = runAcpx([
    "--format",
    "json",
    "--model",
    "custom-local:glm-5.3",
    "workbuddy",
    "-s",
    sessionName,
    "请只回复四个字：辰宿列张",
  ]);

  console.log("model-new exit code:", mNewRes.code);
  let mNewParsed = null;
  try {
    mNewParsed = JSON.parse(mNewRes.stdout);
  } catch (e) {}
  console.log("acpx stdout sample:", mNewRes.stdout.slice(0, 200));

  const acpSessionId = findAcpSessionId(sessionName);
  console.log(`Found acp_session_id: ${acpSessionId}`);

  let mNewAssistantTurn = null;
  if (acpSessionId) {
    const entries = readSessionJsonl(acpSessionId);
    mNewAssistantTurn = entries
      .filter(e => e.type === "message" && e.role === "assistant")
      .pop();
    console.log("Turn 1 assistant providerData:", JSON.stringify(mNewAssistantTurn?.providerData));
  }

  const mNewPass = Boolean(
    mNewAssistantTurn?.providerData?.model === "glm-5.3" &&
    mNewAssistantTurn?.providerData?.requestModelId === "custom-local:glm-5.3"
  );

  results["model-new"] = {
    pass: mNewPass,
    sessionName,
    acpSessionId,
    acpxOutput: mNewParsed || mNewRes.stdout.slice(0, 300),
    actualAssistantTurn: mNewAssistantTurn,
    cmd: modelNewCmd,
  };
  fs.writeFileSync(resultsFile, JSON.stringify(results, null, 2), "utf8");
  console.log(`L1b model-new result: ${mNewPass ? "PASS" : "FAIL"}`);

  // 2. Test model-switch
  console.log("\n[2/2] Testing model-switch...");
  const setModelCmd = `acpx --format json workbuddy set model custom-local:glm-5.3-flash -s ${sessionName}`;
  const setRes = runAcpx([
    "--format",
    "json",
    "workbuddy",
    "set",
    "model",
    "custom-local:glm-5.3-flash",
    "-s",
    sessionName,
  ]);
  console.log("set model exit code:", setRes.code, "stdout:", setRes.stdout.trim());

  const switchTurnCmd = `acpx --format json workbuddy -s ${sessionName} "请只回复四个字：寒来暑往"`;
  const switchRes = runAcpx([
    "--format",
    "json",
    "workbuddy",
    "-s",
    sessionName,
    "请只回复四个字：寒来暑往",
  ]);
  console.log("switch turn exit code:", switchRes.code);
  let switchParsed = null;
  try {
    switchParsed = JSON.parse(switchRes.stdout);
  } catch (e) {}

  let turn1Assistant = null;
  let turn2Assistant = null;
  if (acpSessionId) {
    const entries = readSessionJsonl(acpSessionId);
    const assistantTurns = entries.filter(e => e.type === "message" && e.role === "assistant");
    turn1Assistant = assistantTurns[0];
    turn2Assistant = assistantTurns[1];
    console.log("Turn 1 assistant providerData:", JSON.stringify(turn1Assistant?.providerData));
    console.log("Turn 2 assistant providerData:", JSON.stringify(turn2Assistant?.providerData));
  }

  const switchPass = Boolean(
    turn1Assistant?.providerData?.requestModelId === "custom-local:glm-5.3" &&
    turn2Assistant?.providerData?.requestModelId === "custom-local:glm-5.3-flash"
  );

  results["model-switch"] = {
    pass: switchPass,
    sessionName,
    acpSessionId,
    setCommandResult: setRes.stdout.trim(),
    turn1Assistant,
    turn2Assistant,
    cmd: `${setModelCmd} -> ${switchTurnCmd}`,
  };
  fs.writeFileSync(resultsFile, JSON.stringify(results, null, 2), "utf8");
  console.log(`L1b model-switch result: ${switchPass ? "PASS" : "FAIL"}`);
}

main().catch(console.error);
