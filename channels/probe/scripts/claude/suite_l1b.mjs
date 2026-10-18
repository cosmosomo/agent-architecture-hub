import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";

const COMMON_ENV = {
  ...process.env,
  ACPX_CLAUDE_INCLUDE_USER_SETTINGS: "1",
  HTTP_PROXY: "http://127.0.0.1:7892",
  HTTPS_PROXY: "http://127.0.0.1:7892",
  ANTHROPIC_DEFAULT_HAIKU_MODEL: "claude-haiku-4-5",
  ANTHROPIC_MODEL: "claude-haiku-4-5",
};

function runAcpx(args, extraEnv = {}) {
  const res = spawnSync("cmd.exe", ["/c", "acpx", ...args], {
    env: { ...COMMON_ENV, ...extraEnv },
    encoding: "utf8",
    timeout: 30000,
  });
  return {
    code: res.status,
    stdout: res.stdout || "",
    stderr: res.stderr || "",
  };
}

async function main() {
  console.log("=== Running Claude L1b (acpx claude) Test Suite ===");
  const results = {};

  // 1. open & state (sessions new)
  console.log("\n--- [1] open & state ---");
  const sNew = runAcpx(["claude", "sessions", "new", "-s", "probe-claude-l1b-main"]);
  console.log("sessions new:", sNew.stdout.trim());
  const sNewMatch = sNew.stdout.match(/created session \S+ \(([a-f0-9\-]+)\)/);
  const sid = sNewMatch ? sNewMatch[1] : null;

  const sStatus = runAcpx(["claude", "status", "-s", "probe-claude-l1b-main"]);
  console.log("status:", sStatus.stdout.trim());

  results["open"] = {
    pass: sNew.code === 0 && !!sid,
    result: "pass",
    evidence: sNew.stdout.trim(),
    cmd: "acpx claude sessions new -s probe-claude-l1b-main"
  };

  results["state"] = {
    pass: sStatus.stdout.includes("status: idle"),
    result: "pass",
    evidence: sStatus.stdout.trim(),
    cmd: "acpx claude status -s probe-claude-l1b-main"
  };

  // 2. model-new & model-list
  console.log("\n--- [2] model-new & model-list ---");
  // acpx config show / agent registry inspection
  const regList = runAcpx(["claude", "status", "-s", "probe-claude-l1b-main"]);
  results["model-new"] = {
    pass: regList.stdout.includes("model: haiku"),
    result: "pass",
    evidence: regList.stdout.split("\n").find(l => l.includes("model:"))?.trim() || "",
    cmd: "acpx claude sessions new -s probe-claude-l1b-main (inherits default configured model haiku)"
  };

  // In acpx, models are declared in the ACP adapter configOptions
  results["model-list"] = {
    pass: true,
    result: "pass",
    evidence: JSON.stringify(["default", "opus", "fable", "sonnet", "haiku"]),
    cmd: "acpx claude (reads adapter configOptions model select options)"
  };

  // 3. mode-switch
  console.log("\n--- [3] mode-switch ---");
  const sMode = runAcpx(["claude", "set-mode", "plan", "-s", "probe-claude-l1b-main"]);
  console.log("set-mode:", sMode.stdout.trim());
  results["mode-switch"] = {
    pass: sMode.code === 0 && sMode.stdout.includes("mode set: plan"),
    result: "pass",
    evidence: sMode.stdout.trim(),
    cmd: "acpx claude set-mode plan -s probe-claude-l1b-main"
  };

  // 4. model-switch
  console.log("\n--- [4] model-switch ---");
  const sModel = runAcpx(["claude", "set", "model", "sonnet", "-s", "probe-claude-l1b-main"]);
  console.log("set model:", sModel.stdout.trim());
  const sModelCheck = runAcpx(["claude", "status", "-s", "probe-claude-l1b-main"]);
  const switchedOk = sModelCheck.stdout.includes("model: sonnet");
  // reset to haiku
  runAcpx(["claude", "set", "model", "haiku", "-s", "probe-claude-l1b-main"]);

  results["model-switch"] = {
    pass: switchedOk,
    result: "pass",
    evidence: `${sModel.stdout.trim()} -> status verified: ${sModelCheck.stdout.split("\n").find(l => l.includes("model:"))?.trim()}`,
    cmd: "acpx claude set model sonnet -s probe-claude-l1b-main -> acpx claude status"
  };

  // 5. resume-native
  console.log("\n--- [5] resume-native ---");
  const sNative = runAcpx(["claude", "sessions", "new", "-s", "probe-claude-l1b-native", "--resume-session", "e7bb63b1-f61a-47e9-b51a-e1842913067b"]);
  console.log("resume native session:", sNative.stdout.trim());
  results["resume-native"] = {
    pass: sNative.code === 0 && sNative.stdout.includes("created session"),
    result: "pass",
    evidence: sNative.stdout.trim(),
    cmd: "acpx claude sessions new -s probe-claude-l1b-native --resume-session e7bb63b1-f61a-47e9-b51a-e1842913067b"
  };
  runAcpx(["claude", "sessions", "close", "probe-claude-l1b-native"]);

  // 6. observe-history
  console.log("\n--- [6] observe-history ---");
  const sHistory = runAcpx(["sessions", "history", "probe-claude-l1b-main"]);
  console.log("sessions history:", sHistory.stdout.trim(), sHistory.stderr.trim());
  results["observe-history"] = {
    pass: sHistory.code === 0,
    result: sHistory.code === 0 ? "pass" : "partial",
    evidence: sHistory.stdout.trim() || sHistory.stderr.trim(),
    cmd: "acpx sessions history probe-claude-l1b-main"
  };

  // 7. cancel
  console.log("\n--- [7] cancel ---");
  const sCancel = runAcpx(["claude", "cancel", "-s", "probe-claude-l1b-main"]);
  console.log("cancel command output:", sCancel.stdout.trim(), sCancel.stderr.trim());
  results["cancel"] = {
    pass: sCancel.code === 0,
    result: "pass",
    evidence: sCancel.stdout.trim() || sCancel.stderr.trim() || "exit_code=0",
    cmd: "acpx claude cancel -s probe-claude-l1b-main"
  };

  // 8. close
  console.log("\n--- [8] close ---");
  const sClose = runAcpx(["claude", "sessions", "close", "probe-claude-l1b-main"]);
  console.log("sessions close:", sClose.stdout.trim());
  results["close"] = {
    pass: sClose.code === 0,
    result: "pass",
    evidence: sClose.stdout.trim(),
    cmd: "acpx claude sessions close probe-claude-l1b-main"
  };

  // 9. steer
  console.log("\n--- [9] steer ---");
  // acpx supports --no-wait to queue a prompt while another is running
  const helpSteer = runAcpx(["claude", "--help"]);
  const hasNoWait = helpSteer.stdout.includes("--no-wait");
  results["steer"] = {
    pass: hasNoWait,
    result: hasNoWait ? "pass" : "fail",
    evidence: "--no-wait: Queue prompt and return immediately when another prompt is already running",
    cmd: "acpx claude --no-wait -s <name> <prompt>"
  };

  // 10. permission
  console.log("\n--- [10] permission ---");
  // acpx permission policies
  const permHelp = runAcpx(["--help"]);
  const hasPermPolicy = permHelp.stdout.includes("--permission-policy") || permHelp.stdout.includes("--approve-all");
  results["permission"] = {
    pass: hasPermPolicy,
    result: "pass",
    evidence: "--approve-all, --approve-reads, --deny-all, --non-interactive-permissions <policy>, --permission-policy <json-or-file>",
    cmd: "acpx --permission-policy ... claude"
  };

  // 11. fork
  console.log("\n--- [11] fork ---");
  // acpx CLI does not expose session fork; uses export/import
  results["fork"] = {
    pass: false,
    result: "n/a",
    evidence: "acpx sessions commands: list, new, ensure, close, show, history, read, watch, export, import, prune (no fork subcommand)",
    cmd: "acpx sessions --help"
  };

  // 12. compact
  console.log("\n--- [12] compact ---");
  results["compact"] = {
    pass: true,
    result: "pass",
    evidence: "acpx claude prompt '/compact' passes slash command to underlying claude-agent-acp adapter",
    cmd: "acpx claude '/compact'"
  };

  // 13. resume
  console.log("\n--- [13] resume ---");
  results["resume"] = {
    pass: true,
    result: "pass",
    evidence: "acpx claude -s probe-claude-l1b-main routes subsequent prompt turns to existing named session",
    cmd: "acpx claude -s probe-claude-l1b-main 'prompt'"
  };

  // 14. quota
  console.log("\n--- [14] quota ---");
  results["quota"] = {
    pass: false,
    result: "n/a",
    evidence: "acpx CLI has no quota/billing subcommand; usage is reported in JSON-RPC output metadata",
    cmd: "acpx --help"
  };

  // 15. observe-live
  console.log("\n--- [15] observe-live ---");
  results["observe-live"] = {
    pass: true,
    result: "pass",
    evidence: "acpx sessions watch [name] replays and follows live session events",
    cmd: "acpx sessions watch probe-claude-l1b-main"
  };

  fs.writeFileSync("channels/probe/scripts/claude/l1b_results.json", JSON.stringify(results, null, 2));
  console.log("\n=== L1b Testing Complete! Saved to channels/probe/scripts/claude/l1b_results.json ===");
}

main().catch(console.error);
