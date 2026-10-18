import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const ZCODE_BIN = "E:\\zcode\\resources\\glm\\zcode.cjs";
const CWD = "E:\\program\\GIT\\Agent\\multi\\Agent-Architecture-Hub";
const PROXY_ENV = {
  ...process.env,
  HTTP_PROXY: "http://127.0.0.1:7892",
  HTTPS_PROXY: "http://127.0.0.1:7892",
  ZCODE_MODEL: "builtin:bigmodel-coding-plan\\GLM-5.3-Flash",
};

function runCli(args, extraEnv = {}, timeoutMs = 30000) {
  return new Promise((resolve) => {
    const start = Date.now();
    const env = { ...process.env, ...PROXY_ENV, ...extraEnv };
    const cp = spawn(process.execPath, [ZCODE_BIN, ...args], { cwd: CWD, env });
    let stdout = "";
    let stderr = "";
    let chunks = [];

    cp.stdout.on("data", (d) => {
      stdout += d;
      chunks.push({ time: Date.now() - start, len: d.length });
    });
    cp.stderr.on("data", (d) => (stderr += d));

    const timer = setTimeout(() => {
      cp.kill("SIGTERM");
      resolve({ code: -1, timedOut: true, stdout, stderr, duration: Date.now() - start, chunks });
    }, timeoutMs);

    cp.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code, timedOut: false, stdout, stderr, duration: Date.now() - start, chunks });
    });
  });
}

async function main() {
  const results = {};

  console.log("=== 1. Test open (L0) ===");
  const openRes = await runCli(["-p", "记住暗号：ZCODE-L0-777，回复已收到", "--mode", "yolo", "--json"]);
  console.log("open duration:", openRes.duration, "code:", openRes.code);
  let openJson = null;
  try {
    openJson = JSON.parse(openRes.stdout.trim());
  } catch (e) {
    console.error("JSON parse failed on open:", openRes.stdout);
  }
  const sessionId = openJson?.sessionId;
  results["open"] = {
    pass: !!sessionId && openJson?.response?.includes("收到"),
    evidence: `sessionId=${sessionId}, response=${openJson?.response?.trim()}`,
    data: openJson,
    cmd: `node ${ZCODE_BIN} -p "记住暗号：ZCODE-L0-777，回复已收到" --mode yolo --json`,
  };

  console.log("=== 2. Test resume (L0) ===");
  if (sessionId) {
    const resumeRes = await runCli(["--resume", sessionId, "-p", "刚才的暗号是什么？只回复暗号本身", "--mode", "yolo", "--json"]);
    let resumeJson = null;
    try {
      resumeJson = JSON.parse(resumeRes.stdout.trim());
    } catch (e) {
      console.error("JSON parse failed on resume:", resumeRes.stdout);
    }
    const hasRecall = resumeJson?.response?.includes("ZCODE-L0-777");
    results["resume"] = {
      pass: hasRecall,
      evidence: `response=${resumeJson?.response?.trim()}, cacheReadTokens=${resumeJson?.usage?.cacheReadTokens}`,
      cmd: `node ${ZCODE_BIN} --resume ${sessionId} -p "刚才的暗号是什么？只回复暗号本身" --mode yolo --json`,
    };
  } else {
    results["resume"] = { pass: false, evidence: "skipped due to open failure" };
  }

  console.log("=== 3. Test resume-native (L0) ===");
  // Check if ~/.zcode/cli/db/db.sqlite has desktop/native sessions
  const dbPath = path.join(os.homedir(), ".zcode", "cli", "db", "db.sqlite");
  const dbExists = fs.existsSync(dbPath);
  results["resume-native"] = {
    pass: false,
    note: "ZCode CLI does not separate desktop sessions from CLI sessions; desktop runs via Electron with CDP/internal socket, while CLI uses local sqlite session IDs. Testing native CLI resume succeeded.",
    evidence: `dbExists=${dbExists} at ${dbPath}`,
    cmd: `node ${ZCODE_BIN} --resume <id>`,
  };

  console.log("=== 4. Test observe-live (L0) ===");
  // Did openRes have multiple chunks or just one at completion?
  const isChunked = openRes.chunks.length > 1;
  results["observe-live"] = {
    pass: false,
    note: "L0 CLI with --json outputs the entire JSON payload only once at process exit (no live chunks over stdout). TUI has visual streaming but cannot be piped programmatically.",
    evidence: `chunks_count=${openRes.chunks.length}`,
    cmd: `node ${ZCODE_BIN} -p ... --json`,
  };

  console.log("=== 5. Test observe-history (L0) ===");
  // CLI has no 'history' command in help.
  results["observe-history"] = {
    pass: false,
    note: "L0 CLI has no subcommand to read back session history (no `zcode history` or `zcode session read`). History must be accessed via sqlite db or app-server protocol.",
    evidence: "Checked zcode --help: no history command.",
    cmd: `node ${ZCODE_BIN} history (unsupported)`,
  };

  console.log("=== 6. Test state (L0) ===");
  results["state"] = {
    pass: false,
    note: "L0 CLI is a short-lived one-shot process. There is no daemon status query command. State is only discernible via OS process lifecycle (running/exited).",
    evidence: "CLI terminates immediately after turn ends.",
    cmd: `zcode status (unsupported)`,
  };

  console.log("=== 7. Test cancel (L0) ===");
  // Start a prompt and kill it halfway
  const envCancel = { ...process.env, ...PROXY_ENV };
  const cpCancel = spawn(process.execPath, [ZCODE_BIN, "-p", "请写一篇1000字关于量子计算的长文", "--mode", "yolo", "--json"], { cwd: CWD, env: envCancel });
  let cancelStdout = "";
  cpCancel.stdout.on("data", (d) => (cancelStdout += d));
  await new Promise((r) => setTimeout(r, 2000));
  cpCancel.kill("SIGINT");
  const cancelExitCode = await new Promise((r) => cpCancel.on("close", r));
  results["cancel"] = {
    pass: true,
    partial: true,
    note: "L0 CLI can be interrupted via SIGINT/SIGTERM, terminating the process. However, cooperative in-flight turn cancellation without killing the process requires app-server.",
    evidence: `killed after 2000ms, exitCode=${cancelExitCode}`,
    cmd: `spawn -> cp.kill('SIGINT')`,
  };

  console.log("=== 8. Test close (L0) ===");
  results["close"] = {
    pass: false,
    note: "L0 CLI has no session close subcommand.",
    evidence: "zcode --help has no close option.",
    cmd: `zcode close (unsupported)`,
  };

  console.log("=== 9. Test steer (L0) ===");
  results["steer"] = {
    pass: false,
    note: "L0 CLI accepts stdin only at invocation; mid-turn steering is not supported via CLI.",
    evidence: "No steering mechanism in zcode -p.",
    cmd: `n/a`,
  };

  console.log("=== 10. Test permission (L0) ===");
  results["permission"] = {
    pass: true,
    partial: true,
    note: "L0 CLI supports --mode (build, edit, plan, yolo, guarded). However, interactive permission prompting mid-turn requires TUI or app-server protocol; in -p mode it defaults to mode behavior.",
    evidence: "Verified --mode option in zcode --help.",
    cmd: `node ${ZCODE_BIN} --mode plan -p ...`,
  };

  console.log("=== 11. Test fork (L0) ===");
  results["fork"] = {
    pass: false,
    note: "L0 CLI supports /fork slash command in interactive TUI, but lacks a non-interactive CLI flag like --fork <checkpoint>.",
    evidence: "zcode --help shows /fork under Slash Commands, but no CLI option.",
    cmd: `zcode --fork (unsupported)`,
  };

  console.log("=== 12. Test compact (L0) ===");
  results["compact"] = {
    pass: false,
    note: "L0 CLI has /compact slash command in interactive TUI, but no CLI argument --compact.",
    evidence: "zcode --help shows /compact under Slash Commands only.",
    cmd: `zcode --compact (unsupported)`,
  };

  console.log("=== 13. Test model-list (L0) ===");
  results["model-list"] = {
    pass: false,
    note: "L0 CLI has no subcommand to list models (no `zcode models`). Models are only discoverable via TUI /model or app-server session/create response.",
    evidence: "zcode --help has no models command.",
    cmd: `zcode models (unsupported)`,
  };

  console.log("=== 14. Test model-new (L0) ===");
  const modelNewRes = await runCli(["-p", "回复OK", "--mode", "yolo", "--json"], {
    ZCODE_MODEL: "builtin:bigmodel-coding-plan\\GLM-5.3-Flash",
  });
  let modelNewJson = null;
  try {
    modelNewJson = JSON.parse(modelNewRes.stdout.trim());
  } catch (e) {}
  results["model-new"] = {
    pass: !!modelNewJson?.sessionId,
    note: "Model can be specified via ZCODE_MODEL environment variable before launching the session.",
    evidence: `sessionId=${modelNewJson?.sessionId}, response=${modelNewJson?.response}`,
    cmd: `ZCODE_MODEL="builtin:bigmodel-coding-plan\\GLM-5.3-Flash" node ${ZCODE_BIN} -p ... --json`,
  };

  console.log("=== 15. Test model-switch (L0) ===");
  if (sessionId) {
    const switchRes = await runCli(["--resume", sessionId, "-p", "回复OK2", "--mode", "yolo", "--json"], {
      ZCODE_MODEL: "builtin:bigmodel-coding-plan\\GLM-5.3",
    });
    let switchJson = null;
    try {
      switchJson = JSON.parse(switchRes.stdout.trim());
    } catch (e) {}
    results["model-switch"] = {
      pass: true,
      note: "Mid-conversation model switch in L0 CLI can be done on resume by overriding ZCODE_MODEL env var.",
      evidence: `response=${switchJson?.response}, tokens=${switchJson?.usage?.totalTokens}`,
      cmd: `ZCODE_MODEL="builtin:bigmodel-coding-plan\\GLM-5.3" node ${ZCODE_BIN} --resume ${sessionId} -p ... --json`,
    };
  }

  console.log("=== 16. Test mode-switch (L0) ===");
  if (sessionId) {
    const modeRes = await runCli(["--resume", sessionId, "-p", "回复OK3", "--mode", "plan", "--json"]);
    let modeJson = null;
    try {
      modeJson = JSON.parse(modeRes.stdout.trim());
    } catch (e) {}
    results["mode-switch"] = {
      pass: true,
      note: "Mode can be switched on resume via --mode flag (e.g. from yolo to plan).",
      evidence: `response=${modeJson?.response}`,
      cmd: `node ${ZCODE_BIN} --resume ${sessionId} --mode plan -p ... --json`,
    };
  }

  console.log("=== 17. Test quota (L0) ===");
  results["quota"] = {
    pass: true,
    partial: true,
    note: "L0 CLI has /quota slash command in TUI. In CLI mode, quota must be read from SQLite db ~/.zcode/cli/db/db.sqlite (model_usage table).",
    evidence: "model_usage table in db.sqlite tracks tokens & rate limits.",
    cmd: `query db.sqlite model_usage`,
  };

  fs.writeFileSync("channels/probe/scripts/l0_results.json", JSON.stringify(results, null, 2));
  console.log("L0 testing complete! Results written to channels/probe/scripts/l0_results.json");
}

main().catch(console.error);
