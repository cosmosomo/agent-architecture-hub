import fs from "node:fs";
import path from "node:path";

const l0 = JSON.parse(fs.readFileSync("channels/probe/scripts/workbuddy/l0_results.json", "utf8"));
const l1a = JSON.parse(fs.readFileSync("channels/probe/scripts/workbuddy/l1a_results.json", "utf8"));
const l1b = JSON.parse(fs.readFileSync("channels/probe/scripts/workbuddy/l1b_results.json", "utf8"));

const capabilities = [
  "open",
  "resume",
  "resume-native",
  "observe-live",
  "observe-history",
  "state",
  "cancel",
  "close",
  "steer",
  "permission",
  "fork",
  "compact",
  "model-list",
  "model-new",
  "model-switch",
  "mode-switch",
  "quota",
];

const layers = [
  {
    layer: "L0",
    route: "workbuddy/L0/native-cli",
    surface: "native-cli",
    data: l0,
    condition: "codebuddy -p 原生非交互命令行调用，注入 CODEBUDDY_CONFIG_DIR 与 ACC_PRODUCT_CONFIG_V3，使用 custom-local:glm-5.3",
  },
  {
    layer: "L1a",
    route: "workbuddy/L1a/codebuddy-acp",
    surface: "acp-bridge",
    data: l1a,
    condition: "codebuddy --acp 经由 ACP SDK ClientSideConnection 直接调用，注入 BYOK 环境变量，使用 custom-local:glm-5.3",
  },
  {
    layer: "L1b",
    route: "workbuddy/L1b/acpx",
    surface: "acpx",
    data: l1b,
    condition: "acpx workbuddy 命令调用，注入环境变量，使用 custom-local:glm-5.3",
  },
];

const now = "2026-10-17T17:58:00+08:00";
const entries = [];

for (const layerConfig of layers) {
  for (const cap of capabilities) {
    const item = layerConfig.data[cap] || {};
    const entry = {
      at: now,
      by: "agy-flash",
      family: "workbuddy",
      layer: layerConfig.layer,
      route: layerConfig.route,
      surface: layerConfig.surface,
      capability: cap,
      result: item.result || "unverified",
      condition: item.condition || layerConfig.condition,
      evidence: typeof item.evidence === "string" ? item.evidence : JSON.stringify(item.evidence || {}),
      cmd: item.cmd || `n/a`,
      note: item.note || "",
    };
    entries.push(entry);
  }
}

console.log(`Generated ${entries.length} blackboard records.`);
const lines = entries.map((e) => JSON.stringify(e)).join("\n") + "\n";
fs.appendFileSync("channels/probe/blackboard.jsonl", lines);
console.log(`Appended ${entries.length} lines to channels/probe/blackboard.jsonl.`);
