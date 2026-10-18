import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { Readable, Writable } from "node:stream";

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

const SECRET_CODE = "PROBE_NATIVE_SECRET_9824";

async function main() {
  console.log("=== Testing claude/L1a/claude-agent-acp · resume-native ===");

  // Step 1: Create a native session using claude -p
  console.log("Step 1: Creating native session via claude -p...");
  let nativeSid = null;
  let nativeStdout = "";
  let nativeEvents = [];

  const cpNative = spawn(CLAUDE_EXE, [
    "-p",
    "--model", "haiku",
    "--input-format", "stream-json",
    "--output-format", "stream-json",
    "--verbose",
    "--permission-mode", "bypassPermissions"
  ], {
    cwd: CWD,
    env: COMMON_ENV,
    stdio: ["pipe", "pipe", "pipe"]
  });

  cpNative.stdout.on("data", (d) => {
    const text = d.toString();
    nativeStdout += text;
    for (const l of text.split("\n")) {
      const trimmed = l.trim();
      if (!trimmed) continue;
      try {
        const ev = JSON.parse(trimmed);
        nativeEvents.push(ev);
        if (ev.session_id && !nativeSid) {
          nativeSid = ev.session_id;
        }
      } catch {}
    }
  });

  const prompt1 = JSON.stringify({
    type: "user",
    message: {
      role: "user",
      content: `你好，请牢记我们的秘密暗号是 ${SECRET_CODE}，并且只回复一句：暗号已牢记。`
    }
  }) + "\n";
  cpNative.stdin.write(prompt1);
  cpNative.stdin.end();

  const nativeExit = await new Promise((resolve) => {
    cpNative.on("close", resolve);
  });
  console.log(`Native session exit: ${nativeExit}, captured nativeSid: ${nativeSid}`);

  if (!nativeSid) {
    throw new Error("Failed to capture native session ID from claude -p output");
  }

  // Step 2: Connect to claude-agent-acp and call loadSession
  console.log(`Step 2: Connecting to claude-agent-acp and loadSession(${nativeSid})...`);
  const sdkPath = path.join(process.env.APPDATA, "npm", "node_modules", "acpx", "node_modules", "@agentclientprotocol", "sdk");
  const { ClientSideConnection, ndJsonStream } = await import(`file:///${sdkPath.replace(/\\/g, "/")}/dist/acp.js`);

  const cpAcp = spawn("cmd.exe", ["/c", "claude-agent-acp.cmd"], {
    cwd: CWD,
    env: COMMON_ENV,
    stdio: ["pipe", "pipe", "pipe"],
  });

  const acpUpdates = [];
  let fullAnswerText = "";

  const clientHandler = {
    requestPermission: async (req) => ({ outcome: { outcome: "approved" } }),
    sessionUpdate: async (notice) => {
      acpUpdates.push(notice);
      if (notice.update?.sessionUpdate === "agent_message_chunk" && notice.update.content?.text) {
        fullAnswerText += notice.update.content.text;
      }
    },
  };

  const stream = ndJsonStream(Writable.toWeb(cpAcp.stdin), Readable.toWeb(cpAcp.stdout));
  const connection = new ClientSideConnection(() => clientHandler, stream);

  const initRes = await connection.initialize({
    protocolVersion: 1,
    clientCapabilities: {},
    clientInfo: { name: "probe-resume-native-tester", version: "1.0.0" }
  });
  console.log("ACP initRes:", JSON.stringify(initRes));

  let loadSessionRes = null;
  let loadSessionError = null;
  try {
    loadSessionRes = await connection.loadSession({
      sessionId: nativeSid,
      cwd: CWD,
      mcpServers: []
    });
    console.log("ACP loadSessionRes:", JSON.stringify(loadSessionRes));
  } catch (err) {
    loadSessionError = { message: err.message, code: err.code };
    console.error("ACP loadSession error:", loadSessionError);
  }

  // Step 3: Ask for the secret code in the loaded session
  let promptRes = null;
  let promptError = null;
  if (!loadSessionError) {
    console.log("Step 3: Prompting loaded session to verify secret retrieval...");
    try {
      promptRes = await connection.prompt({
        sessionId: nativeSid,
        prompt: [{ type: "text", text: "刚才我们设定的秘密暗号是什么？只回复暗号本身，不要任何其他文字。" }]
      });
      console.log("ACP promptRes:", JSON.stringify(promptRes));
    } catch (err) {
      promptError = { message: err.message, code: err.code };
      console.error("ACP prompt error:", promptError);
    }
  }

  cpAcp.kill();

  const secretFound = fullAnswerText.includes(SECRET_CODE);
  console.log(`Full answer text from ACP loaded session: "${fullAnswerText.trim()}"`);
  console.log(`Secret found: ${secretFound}`);

  const record = {
    secretCode: SECRET_CODE,
    nativeSid,
    nativeEventsSample: nativeEvents.filter(e => e.type === "result"),
    initRes,
    loadSessionRes,
    loadSessionError,
    promptRes,
    promptError,
    fullAnswerText,
    secretFound,
    acpUpdatesCount: acpUpdates.length,
  };

  const outFile = path.join(OUT_DIR, "claude_l1a_resume_native_raw.json");
  fs.writeFileSync(outFile, JSON.stringify(record, null, 2), "utf8");
  console.log(`Saved result to ${outFile}`);
}

main().catch(console.error);
