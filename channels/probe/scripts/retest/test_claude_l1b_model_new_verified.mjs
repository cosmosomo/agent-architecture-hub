import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const CWD = "E:\\program\\GIT\\Agent\\multi\\Agent-Architecture-Hub";
const OUT_DIR = path.join(CWD, "channels", "probe", "scripts", "retest", "output");
fs.mkdirSync(OUT_DIR, { recursive: true });

const COMMON_ENV = {
  ...process.env,
  ACPX_CLAUDE_INCLUDE_USER_SETTINGS: "1",
  HTTP_PROXY: "http://127.0.0.1:7892",
  HTTPS_PROXY: "http://127.0.0.1:7892",
};

function runModel(modelAlias) {
  console.log(`Running acpx --format json --model ${modelAlias} claude exec...`);
  const res = spawnSync("cmd.exe", [
    "/c",
    "acpx.cmd",
    "--format", "json",
    "--model", modelAlias,
    "claude",
    "exec",
    "ping, reply one word"
  ], {
    cwd: CWD,
    env: COMMON_ENV,
    encoding: "utf8",
    timeout: 45000,
  });

  const lines = (res.stdout || "").split("\n").filter(Boolean);
  const jsonEvents = [];
  for (const line of lines) {
    try {
      jsonEvents.push(JSON.parse(line));
    } catch {}
  }

  // Find model metadata in events
  const usageUpdateEvents = jsonEvents.filter(e => e.params?.update?.sessionUpdate === "usage_update");
  const promptResult = jsonEvents.find(e => e.result?.stopReason !== undefined);

  return {
    modelAlias,
    exitCode: res.status,
    eventsCount: jsonEvents.length,
    usageModels: usageUpdateEvents.map(e => e.params?.update?._meta?.["_claude/model"]),
    quotaModels: promptResult?.result?._meta?.quota?.model_usage?.map(m => m.model),
    sampleUsageEvent: usageUpdateEvents[0],
    promptResult,
  };
}

async function main() {
  console.log("=== Testing claude/L1b/acpx · model-new (re-recording verified run) ===");

  const haikuResult = runModel("haiku");
  console.log("Haiku detected models:", haikuResult.usageModels, haikuResult.quotaModels);

  const sonnetResult = runModel("sonnet");
  console.log("Sonnet detected models:", sonnetResult.usageModels, sonnetResult.quotaModels);

  const record = {
    haiku: haikuResult,
    sonnet: sonnetResult,
    pass: haikuResult.usageModels.includes("claude-haiku-5-5") && sonnetResult.usageModels.includes("claude-sonnet-5-5")
  };

  const outFile = path.join(OUT_DIR, "claude_l1b_model_new_raw.json");
  fs.writeFileSync(outFile, JSON.stringify(record, null, 2), "utf8");
  console.log(`Saved output to ${outFile}`);
  console.log("Verification result:", record.pass ? "PASS" : "FAIL");
}

main().catch(console.error);
