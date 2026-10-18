import { spawn, execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { Readable, Writable } from "node:stream";

const CWD = "E:\\program\\GIT\\Agent\\multi\\Agent-Architecture-Hub";
const OUT_DIR = path.join(CWD, "channels", "probe", "scripts", "retest", "output");
fs.mkdirSync(OUT_DIR, { recursive: true });

const COMMON_ENV = {
  ...process.env,
  ACPX_CLAUDE_INCLUDE_USER_SETTINGS: "1",
  HTTP_PROXY: "http://127.0.0.1:7892",
  HTTPS_PROXY: "http://127.0.0.1:7892",
  ANTHROPIC_DEFAULT_HAIKU_MODEL: "claude-haiku-4-5",
  ANTHROPIC_MODEL: "claude-haiku-4-5",
};

const SECRET_CODE = "PROBE_NATIVE_SECRET_9824";
const testSessionId = crypto.randomUUID();

async function main() {
  console.log(`=== Testing claude/L1a/claude-agent-acp · resume-native (UUID: ${testSessionId}) ===`);

  // Step 1: Create native session with explicit UUID and secret
  console.log("Step 1: Creating native session via claude -p with explicit session ID...");
  const cmd = `claude -p --model haiku --session-id ${testSessionId} "你好，请牢记我们的秘密暗号是 ${SECRET_CODE}，并且只回复：暗号已牢记" < nul`;
  
  let nativeOut = "";
  try {
    nativeOut = execSync(cmd, {
      cwd: CWD,
      env: COMMON_ENV,
      shell: "cmd.exe",
      timeout: 45000,
      encoding: "utf8"
    });
    console.log("Native output:", nativeOut.trim());
  } catch (err) {
    console.error("Native call failed:", err.message);
    throw err;
  }

  // Check if session file was written to disk
  const projectDirName = CWD.replace(/[:\\\/]/g, "-");
  const sessionFilePath = path.join(process.env.USERPROFILE, ".claude", "projects", projectDirName, `${testSessionId}.jsonl`);
  const fileExists = fs.existsSync(sessionFilePath);
  console.log(`Session file ${sessionFilePath} exists: ${fileExists}`);

  // Step 2: Connect to claude-agent-acp and call loadSession
  console.log(`Step 2: Connecting to claude-agent-acp and loading session ${testSessionId}...`);
  const sdkPath = path.join(process.env.APPDATA, "npm", "node_modules", "acpx", "node_modules", "@agentclientprotocol", "sdk");
  const { ClientSideConnection, ndJsonStream } = await import(`file:///${sdkPath.replace(/\\/g, "/")}/dist/acp.js`);

  const cpAcp = spawn("cmd.exe", ["/c", "claude-agent-acp.cmd"], {
    cwd: CWD,
    env: COMMON_ENV,
    stdio: ["pipe", "pipe", "pipe"],
  });

  let fullAnswerText = "";
  const clientHandler = {
    requestPermission: async (req) => ({ outcome: { outcome: "approved" } }),
    sessionUpdate: async (notice) => {
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
    clientInfo: { name: "probe-resume-native-fixed", version: "1.0.0" }
  });
  console.log("ACP initRes version:", initRes.protocolVersion);

  const loadSessionRes = await connection.loadSession({
    sessionId: testSessionId,
    cwd: CWD,
    mcpServers: []
  });
  console.log("ACP loadSession returned sessionId:", loadSessionRes.sessionId);

  // Step 3: Ask for the secret code in the loaded session
  console.log("Step 3: Prompting ACP loaded session to retrieve secret...");
  const promptRes = await connection.prompt({
    sessionId: testSessionId,
    prompt: [{ type: "text", text: "刚才我们设定的秘密暗号是什么？只回复暗号本身，不要任何其他文字。" }]
  });

  cpAcp.kill();

  console.log("Prompt result stopReason:", promptRes.stopReason);
  console.log(`Full answer text from ACP loaded session: "${fullAnswerText.trim()}"`);
  const secretFound = fullAnswerText.includes(SECRET_CODE);
  console.log(`Secret found: ${secretFound}`);

  const cleanRecord = {
    sessionId: testSessionId,
    secretCode: SECRET_CODE,
    nativeOut: nativeOut.trim(),
    sessionFileExists: fileExists,
    loadSessionSessionId: loadSessionRes.sessionId,
    promptStopReason: promptRes.stopReason,
    fullAnswerText: fullAnswerText.trim(),
    secretFound: secretFound,
    pass: secretFound
  };

  const outFile = path.join(OUT_DIR, "claude_l1a_resume_native_raw.json");
  fs.writeFileSync(outFile, JSON.stringify(cleanRecord, null, 2), "utf8");
  console.log(`Saved result to ${outFile}`);
}

main().catch(console.error);
