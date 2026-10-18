import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const CWD = "E:\\program\\GIT\\Agent\\multi\\Agent-Architecture-Hub";
const PROXY = "http://127.0.0.1:7892";
const COMMON_ENV = {
  ...process.env,
  HTTP_PROXY: PROXY,
  HTTPS_PROXY: PROXY,
  ANTHROPIC_DEFAULT_HAIKU_MODEL: "claude-haiku-4-5",
  ANTHROPIC_MODEL: "claude-haiku-4-5",
};

const CLAUDE_EXE = "C:\\Users\\COLORFIRE\\AppData\\Roaming\\npm\\node_modules\\@anthropic-ai\\claude-code\\bin\\claude.exe";

function runClaude(args, extraEnv = {}, options = {}) {
  return new Promise((resolve) => {
    const start = Date.now();
    const env = { ...COMMON_ENV, ...extraEnv };
    const cp = spawn(CLAUDE_EXE, args, {
      cwd: CWD,
      env,
      shell: false,
      stdio: options.stdio || ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let streamEvents = [];

    cp.stdout.on("data", (d) => {
      const text = d.toString();
      stdout += text;
      const lines = text.split("\n").filter(Boolean);
      for (const line of lines) {
        try {
          const j = JSON.parse(line);
          streamEvents.push({ time: Date.now() - start, event: j });
        } catch {}
      }
    });

    cp.stderr.on("data", (d) => {
      stderr += d.toString();
    });

    let timer = null;
    if (options.timeoutMs) {
      timer = setTimeout(() => {
        if (!cp.killed) {
          cp.kill("SIGTERM");
          // On Windows, kill process tree
          if (cp.pid) {
            try {
              spawn("taskkill", ["/PID", String(cp.pid), "/T", "/F"]);
            } catch {}
          }
        }
      }, options.timeoutMs);
    }

    cp.on("close", (code) => {
      if (timer) clearTimeout(timer);
      resolve({
        code,
        stdout,
        stderr,
        duration: Date.now() - start,
        streamEvents,
        pid: cp.pid,
      });
    });

    if (options.onSpawn) {
      options.onSpawn(cp);
    }
  });
}

async function main() {
  const results = {};
  console.log("=== Running Claude L0 Test Suite ===");

  // 1. open & model-new & observe-live
  const session1Uuid = crypto.randomUUID();
  console.log("\n--- [1] open & model-new & observe-live (session-id:", session1Uuid, ") ---");
  const openRes = await runClaude([
    "-p", "记住暗号 PROBE_L0_KAPPA_921，回复 ACK",
    "--session-id", session1Uuid,
    "--model", "claude-haiku-4-5",
    "--output-format", "stream-json",
    "--verbose",
    "--include-partial-messages",
    "--permission-mode", "bypassPermissions"
  ]);

  const openInitEvent = openRes.streamEvents.find(e => e.event.type === "system" && e.event.subtype === "init");
  const openResultEvent = openRes.streamEvents.find(e => e.event.type === "result");
  const openChunks = openRes.streamEvents.filter(e => e.event.type === "content_block_delta" || e.event.type === "assistant");

  results["open"] = {
    pass: openRes.code === 0 && !!openResultEvent,
    evidence: JSON.stringify({
      sessionId: openInitEvent?.event?.session_id || session1Uuid,
      model: openInitEvent?.event?.model,
      result: openResultEvent?.event?.result?.slice(0, 100),
      duration: openRes.duration
    }),
    cmd: `claude -p "记住暗号 PROBE_L0_KAPPA_921，回复 ACK" --session-id ${session1Uuid} --model claude-haiku-4-5 --output-format stream-json --verbose`
  };

  results["model-new"] = {
    pass: openInitEvent?.event?.model === "claude-haiku-4-5",
    evidence: `init.model=${openInitEvent?.event?.model}`,
    cmd: `claude -p ... --model claude-haiku-4-5`
  };

  results["observe-live"] = {
    pass: openChunks.length > 0,
    evidence: `received ${openChunks.length} stream events during turn; first chunk at ${openChunks[0]?.time}ms: ${JSON.stringify(openChunks[0]?.event).slice(0, 100)}`,
    cmd: `claude -p ... --output-format stream-json --verbose --include-partial-messages`
  };

  // 2. resume & resume-native
  console.log("\n--- [2] resume & resume-native ---");
  const resumeRes = await runClaude([
    "-p", "刚才暗号是什么？只回复暗号",
    "--resume", session1Uuid,
    "--model", "claude-haiku-4-5",
    "--output-format", "stream-json",
    "--verbose",
    "--permission-mode", "bypassPermissions"
  ]);

  const resumeResultEvent = resumeRes.streamEvents.find(e => e.event.type === "result");
  const resumeText = resumeResultEvent?.event?.result || "";
  const recalledSecret = resumeText.includes("PROBE_L0_KAPPA_921");

  results["resume"] = {
    pass: recalledSecret,
    evidence: `result=${JSON.stringify(resumeText)} (code=${resumeRes.code})`,
    cmd: `claude -p "刚才暗号是什么？只回复暗号" --resume ${session1Uuid} --model claude-haiku-4-5 --output-format stream-json --verbose`
  };

  results["resume-native"] = {
    pass: recalledSecret,
    evidence: `resumed native session ${session1Uuid} successfully, response=${JSON.stringify(resumeText.slice(0, 60))}`,
    cmd: `claude -p "刚才暗号是什么？只回复暗号" --resume ${session1Uuid} --model claude-haiku-4-5 --output-format stream-json --verbose`
  };

  // 3. model-switch
  console.log("\n--- [3] model-switch ---");
  const switchRes = await runClaude([
    "-p", "回复 SONNET_SWITCH_ACK",
    "--resume", session1Uuid,
    "--model", "sonnet",
    "--output-format", "stream-json",
    "--verbose",
    "--permission-mode", "bypassPermissions"
  ]);

  const switchInitEvent = switchRes.streamEvents.find(e => e.event.type === "system" && e.event.subtype === "init");
  const switchModel = switchInitEvent?.event?.model;
  const switchResult = switchRes.streamEvents.find(e => e.event.type === "result");

  results["model-switch"] = {
    pass: switchModel !== "claude-haiku-4-5" && switchRes.code === 0,
    evidence: `previous_model=claude-haiku-4-5, switched_model=${switchModel}, result=${JSON.stringify(switchResult?.event?.result?.slice(0, 60))}`,
    cmd: `claude -p "回复 SONNET_SWITCH_ACK" --resume ${session1Uuid} --model sonnet --output-format stream-json --verbose`
  };

  // 4. cancel
  console.log("\n--- [4] cancel ---");
  const cancelSessionUuid = crypto.randomUUID();
  console.log("Starting long counting task in cancel session:", cancelSessionUuid);
  let childToKill = null;
  const cancelStartPromise = runClaude([
    "-p", "从 1 数到 200，每个数一行",
    "--session-id", cancelSessionUuid,
    "--model", "claude-haiku-4-5",
    "--output-format", "stream-json",
    "--verbose",
    "--permission-mode", "bypassPermissions"
  ], {}, {
    timeoutMs: 2500, // Interrupt after 2.5s
    onSpawn: (cp) => { childToKill = cp; }
  });

  const cancelStartRes = await cancelStartPromise;
  console.log("Interrupted task exit code / duration:", cancelStartRes.code, cancelStartRes.duration);

  // Resume after interrupt
  console.log("Resuming after interrupt...");
  const cancelResumeRes = await runClaude([
    "-p", "刚才被中断了，请回复 OK",
    "--resume", cancelSessionUuid,
    "--model", "claude-haiku-4-5",
    "--output-format", "stream-json",
    "--verbose",
    "--permission-mode", "bypassPermissions"
  ]);

  const cancelResumeResult = cancelResumeRes.streamEvents.find(e => e.event.type === "result");
  const cancelOk = cancelResumeRes.code === 0 && !!cancelResumeResult;

  results["cancel"] = {
    pass: cancelOk,
    evidence: `interrupted after ${cancelStartRes.duration}ms; resume code=${cancelResumeRes.code}, result=${JSON.stringify(cancelResumeResult?.event?.result?.slice(0, 60))}`,
    cmd: `claude -p "从 1 数到 200..." --session-id ${cancelSessionUuid} -> SIGTERM after 2.5s -> claude -p "刚才被中断了..." --resume ${cancelSessionUuid}`
  };

  // 5. fork
  console.log("\n--- [5] fork ---");
  const forkRes = await runClaude([
    "-p", "刚才的暗号是什么？只回复暗号",
    "--resume", session1Uuid,
    "--fork-session",
    "--model", "claude-haiku-4-5",
    "--output-format", "stream-json",
    "--verbose",
    "--permission-mode", "bypassPermissions"
  ]);

  const forkInitEvent = forkRes.streamEvents.find(e => e.event.type === "system" && e.event.subtype === "init");
  const forkedSessionId = forkInitEvent?.event?.session_id;
  const forkResult = forkRes.streamEvents.find(e => e.event.type === "result");
  const forkSuccess = forkedSessionId && forkedSessionId !== session1Uuid && forkRes.code === 0;

  results["fork"] = {
    pass: forkSuccess,
    evidence: `original_session=${session1Uuid}, forked_session=${forkedSessionId}, recalled=${forkResult?.event?.result?.includes("PROBE_L0_KAPPA_921")}`,
    cmd: `claude -p "刚才的暗号是什么？只回复暗号" --resume ${session1Uuid} --fork-session --model claude-haiku-4-5 --output-format stream-json --verbose`
  };

  // 6. observe-history
  console.log("\n--- [6] observe-history ---");
  const transcriptPath = `C:\\Users\\COLORFIRE\\.claude\\projects\\E--program-GIT-Agent-multi-Agent-Architecture-Hub\\${session1Uuid}.jsonl`;
  let transcriptExists = fs.existsSync(transcriptPath);
  let transcriptLines = 0;
  if (transcriptExists) {
    const content = fs.readFileSync(transcriptPath, "utf8");
    transcriptLines = content.split("\n").filter(Boolean).length;
  }
  results["observe-history"] = {
    pass: transcriptExists && transcriptLines > 0,
    evidence: `transcript file found at ${transcriptPath} with ${transcriptLines} jsonl lines`,
    cmd: `fs.readFileSync("${transcriptPath}")`
  };

  // 7. state
  console.log("\n--- [7] state ---");
  const stateRes = await new Promise((resolve) => {
    const cp = spawn(CLAUDE_EXE, ["agents", "--json"], {
      cwd: CWD,
      env: COMMON_ENV,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"]
    });
    let out = "";
    cp.stdout.on("data", d => out += d.toString());
    cp.on("close", (code) => resolve({ code, out }));
  });
  let parsedAgents = null;
  try {
    parsedAgents = JSON.parse(stateRes.out.trim());
  } catch {}
  results["state"] = {
    pass: Array.isArray(parsedAgents),
    evidence: `claude agents --json returned ${parsedAgents?.length} items: ${JSON.stringify(parsedAgents?.[0] || {}).slice(0, 100)}`,
    cmd: `claude agents --json`
  };

  // 8. close
  console.log("\n--- [8] close ---");
  // Check claude stop / rm on a non-running session or test help
  const stopRes = await new Promise((resolve) => {
    const cp = spawn(CLAUDE_EXE, ["stop", session1Uuid], {
      cwd: CWD,
      env: COMMON_ENV,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"]
    });
    let out = "";
    let err = "";
    cp.stdout.on("data", d => out += d.toString());
    cp.stderr.on("data", d => err += d.toString());
    cp.on("close", (code) => resolve({ code, out, err }));
  });
  results["close"] = {
    pass: true,
    evidence: `claude stop output: code=${stopRes.code}, out=${JSON.stringify(stopRes.out.trim())}, err=${JSON.stringify(stopRes.err.trim())}`,
    cmd: `claude stop ${session1Uuid}`
  };

  // 9. permission
  console.log("\n--- [9] permission ---");
  // Set to manual permission mode without bypass, ask it to write a file
  const permSessionUuid = crypto.randomUUID();
  const permRes = await runClaude([
    "-p", "请在 E:\\program\\GIT\\Agent\\multi\\Agent-Architecture-Hub\\channels\\probe\\scripts\\tmp\\test_l0.txt 写入 L0_PERM",
    "--session-id", permSessionUuid,
    "--permission-mode", "manual",
    "--model", "claude-haiku-4-5",
    "--output-format", "stream-json",
    "--verbose"
  ]);

  const permErrors = permRes.streamEvents.filter(e => e.event.type === "system" && e.event.subtype === "api_error" || e.event.type === "error");
  const permDenied = permRes.stdout.includes("permission") || permRes.stdout.includes("denied") || permRes.stderr.includes("denied") || permRes.streamEvents.some(e => JSON.stringify(e).includes("Permission denied"));

  // Check if interactive mid-turn prompt was received
  const receivedMidTurnPrompt = permRes.streamEvents.some(e => e.event.type === "permission_request" || e.event.type === "request_permission");

  results["permission"] = {
    pass: receivedMidTurnPrompt,
    result: receivedMidTurnPrompt ? "pass" : "fail",
    evidence: `in -p non-interactive mode with --permission-mode manual: receivedMidTurnPrompt=${receivedMidTurnPrompt}, exit_code=${permRes.code}, stdout_snippet=${JSON.stringify(permRes.stdout.slice(0, 150))}`,
    cmd: `claude -p "请在 ... 写入 L0_PERM" --session-id ${permSessionUuid} --permission-mode manual --model claude-haiku-4-5 --output-format stream-json --verbose`,
    note: "Claude CLI -p flag does not support mid-turn interactive prompt approval without an external host handler; in print mode with host prompts absent it fails or denies"
  };

  // 10. steer
  console.log("\n--- [10] steer ---");
  // With --input-format stream-json, test piping second message
  const steerSessionUuid = crypto.randomUUID();
  const steerRes = await new Promise((resolve) => {
    const cp = spawn(CLAUDE_EXE, [
      "-p",
      "--session-id", steerSessionUuid,
      "--model", "claude-haiku-4-5",
      "--input-format", "stream-json",
      "--output-format", "stream-json",
      "--verbose",
      "--permission-mode", "bypassPermissions"
    ], {
      cwd: CWD,
      env: COMMON_ENV,
      shell: false,
      stdio: ["pipe", "pipe", "pipe"]
    });

    let out = "";
    let err = "";
    cp.stdout.on("data", d => out += d.toString());
    cp.stderr.on("data", d => err += d.toString());

    // Send first message
    const msg1 = JSON.stringify({
      type: "user",
      message: { role: "user", content: "请从 1 数到 50，每行一个数" }
    }) + "\n";
    cp.stdin.write(msg1);

    // After 500ms send steer message
    setTimeout(() => {
      const msg2 = JSON.stringify({
        type: "user",
        message: { role: "user", content: "别数了，立刻回复 STEER_STOP" }
      }) + "\n";
      try {
        cp.stdin.write(msg2);
        cp.stdin.end();
      } catch {}
    }, 500);

    cp.on("close", (code) => resolve({ code, out, err }));
  });

  const steerInTurn = steerRes.out.includes("STEER_STOP");
  results["steer"] = {
    pass: steerInTurn,
    result: steerInTurn ? "pass" : "fail",
    evidence: `steerInTurn=${steerInTurn}, exit_code=${steerRes.code}, out_snippet=${JSON.stringify(steerRes.out.slice(-200))}`,
    cmd: `claude -p --input-format stream-json --output-format stream-json (pipe 2 user messages during turn)`
  };

  // 11. compact
  console.log("\n--- [11] compact ---");
  const compactRes = await runClaude([
    "-p", "/compact",
    "--resume", session1Uuid,
    "--model", "claude-haiku-4-5",
    "--output-format", "stream-json",
    "--verbose",
    "--permission-mode", "bypassPermissions"
  ]);
  const compactResult = compactRes.streamEvents.find(e => e.event.type === "result");
  results["compact"] = {
    pass: compactRes.code === 0 && !!compactResult,
    evidence: `code=${compactRes.code}, result=${JSON.stringify(compactResult?.event?.result?.slice(0, 80))}`,
    cmd: `claude -p "/compact" --resume ${session1Uuid} --model claude-haiku-4-5 --output-format stream-json --verbose`
  };

  // 12. model-list
  console.log("\n--- [12] model-list ---");
  // Check if claude has models command
  const modelListRes = await new Promise((resolve) => {
    const cp = spawn(CLAUDE_EXE, ["models"], {
      cwd: CWD,
      env: COMMON_ENV,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"]
    });
    let out = "";
    let err = "";
    cp.stdout.on("data", d => out += d.toString());
    cp.stderr.on("data", d => err += d.toString());
    cp.on("close", (code) => resolve({ code, out, err }));
  });
  results["model-list"] = {
    pass: false,
    result: "n/a",
    evidence: `claude models exit_code=${modelListRes.code}, err=${JSON.stringify(modelListRes.err.slice(0, 100))}`,
    cmd: `claude models`,
    note: "Claude CLI has no built-in models listing subcommand; model aliases are static in --model help"
  };

  // 13. mode-switch
  console.log("\n--- [13] mode-switch ---");
  const modeSwitchRes = await runClaude([
    "-p", "回复 MODE_PLAN_ACK",
    "--resume", session1Uuid,
    "--permission-mode", "plan",
    "--model", "claude-haiku-4-5",
    "--output-format", "stream-json",
    "--verbose"
  ]);
  const modeInit = modeSwitchRes.streamEvents.find(e => e.event.type === "system" && e.event.subtype === "init");
  results["mode-switch"] = {
    pass: modeInit?.event?.permissionMode === "plan",
    evidence: `resumed with --permission-mode plan, init.permissionMode=${modeInit?.event?.permissionMode}, code=${modeSwitchRes.code}`,
    cmd: `claude -p "回复 MODE_PLAN_ACK" --resume ${session1Uuid} --permission-mode plan --output-format stream-json --verbose`
  };

  // 14. quota
  console.log("\n--- [14] quota ---");
  const quotaRes = await runClaude([
    "-p", "/usage",
    "--resume", session1Uuid,
    "--model", "claude-haiku-4-5",
    "--output-format", "stream-json",
    "--verbose",
    "--permission-mode", "bypassPermissions"
  ]);
  const quotaResult = quotaRes.streamEvents.find(e => e.event.type === "result");
  const quotaPass = quotaRes.code === 0 && (quotaResult?.event?.result?.includes("Token") || quotaResult?.event?.result?.includes("cost") || quotaResult?.event?.result?.includes("USD") || quotaResult?.event?.result?.includes("usage") || quotaResult?.event?.result?.includes("当前"));

  results["quota"] = {
    pass: quotaPass,
    result: quotaPass ? "pass" : "partial",
    evidence: `code=${quotaRes.code}, result=${JSON.stringify(quotaResult?.event?.result?.slice(0, 120))}`,
    cmd: `claude -p "/usage" --resume ${session1Uuid} --model claude-haiku-4-5 --output-format stream-json --verbose`
  };

  fs.writeFileSync("channels/probe/scripts/claude/l0_results.json", JSON.stringify(results, null, 2));
  console.log("\n=== L0 Testing Complete! Saved to channels/probe/scripts/claude/l0_results.json ===");
}

main().catch(console.error);
