import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const CWD = "E:\\program\\GIT\\Agent\\multi\\Agent-Architecture-Hub";
const OUT_DIR = path.join(CWD, "channels", "probe", "scripts", "retest", "output");
fs.mkdirSync(OUT_DIR, { recursive: true });

const CLAUDE_EXE = "C:\\Users\\COLORFIRE\\AppData\\Roaming\\npm\\node_modules\\@anthropic-ai\\claude-code\\bin\\claude.exe";
const COMMON_ENV = {
  ...process.env,
  ACPX_CLAUDE_INCLUDE_USER_SETTINGS: "1",
  HTTP_PROXY: "http://127.0.0.1:7892",
  HTTPS_PROXY: "http://127.0.0.1:7892",
  ANTHROPIC_DEFAULT_HAIKU_MODEL: "claude-haiku-4-5",
  ANTHROPIC_MODEL: "claude-haiku-4-5",
};

async function testL0Steer() {
  console.log("=== Testing claude/L0/claude-cli · steer ===");
  const rawEvents = [];
  let stdoutRaw = "";
  let stderrRaw = "";

  const cp = spawn(CLAUDE_EXE, [
    "-p",
    "--model", "haiku",
    "--input-format", "stream-json",
    "--output-format", "stream-json",
    "--verbose",
    "--permission-mode", "bypassPermissions"
  ], {
    cwd: CWD,
    env: COMMON_ENV,
    stdio: ["pipe", "pipe", "pipe"],
  });

  cp.stdout.on("data", (chunk) => {
    const text = chunk.toString();
    stdoutRaw += text;
    for (const line of text.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const parsed = JSON.parse(trimmed);
        rawEvents.push(parsed);
      } catch {
        // non-json line
      }
    }
  });

  cp.stderr.on("data", (chunk) => {
    stderrRaw += chunk.toString();
  });

  // Step 1: Send first prompt requesting slow/long output
  const msg1 = JSON.stringify({
    type: "user",
    message: {
      role: "user",
      content: "请从 1 数到 30，每个数字一行，不要解释"
    }
  }) + "\n";
  cp.stdin.write(msg1);

  // Wait 300ms while it starts processing, then inject steer message
  await new Promise((r) => setTimeout(r, 400));

  const msg2 = JSON.stringify({
    type: "user",
    message: {
      role: "user",
      content: "紧急插话：别数了，立刻停止，只输出 STEER_TRIGGERED"
    }
  }) + "\n";
  cp.stdin.write(msg2);
  cp.stdin.end();

  const code = await new Promise((resolve) => {
    const timer = setTimeout(() => {
      console.log("Process timed out after 60s, killing...");
      cp.kill();
      resolve(-1);
    }, 60000);

    cp.on("close", (exitCode) => {
      clearTimeout(timer);
      resolve(exitCode);
    });
  });

  const outputSummary = {
    exitCode: code,
    rawEventsCount: rawEvents.length,
    events: rawEvents,
    stdoutSample: stdoutRaw.slice(0, 1500),
    stderrSample: stderrRaw.slice(0, 1500),
  };

  const outFile = path.join(OUT_DIR, "claude_l0_steer_raw.json");
  fs.writeFileSync(outFile, JSON.stringify(outputSummary, null, 2), "utf8");
  console.log(`Saved output to ${outFile}`);
  console.log(`Exit code: ${code}`);

  // Inspect the assistant/result events
  const textEvents = rawEvents.filter(e => e.type === "text" || e.type === "assistant" || e.type === "result");
  console.log("Filtered meaningful events:", JSON.stringify(textEvents.slice(0, 10), null, 2));
}

testL0Steer().catch(console.error);
