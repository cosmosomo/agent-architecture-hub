import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
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

async function testL1aSteer() {
  console.log("=== Testing claude/L1a/claude-agent-acp · steer ===");

  const sdkPath = path.join(process.env.APPDATA, "npm", "node_modules", "acpx", "node_modules", "@agentclientprotocol", "sdk");
  const { ClientSideConnection, ndJsonStream } = await import(`file:///${sdkPath.replace(/\\/g, "/")}/dist/acp.js`);

  const cp = spawn("cmd.exe", ["/c", "claude-agent-acp.cmd"], {
    cwd: CWD,
    env: COMMON_ENV,
    stdio: ["pipe", "pipe", "pipe"],
  });

  const updates = [];
  const clientHandler = {
    requestPermission: async (req) => ({ outcome: { outcome: "approved" } }),
    sessionUpdate: async (notice) => {
      updates.push(notice);
    },
  };

  const stream = ndJsonStream(Writable.toWeb(cp.stdin), Readable.toWeb(cp.stdout));
  const connection = new ClientSideConnection(() => clientHandler, stream);

  const initRes = await connection.initialize({
    protocolVersion: 1,
    clientCapabilities: {},
    clientInfo: { name: "probe-steer-tester", version: "1.0.0" }
  });
  console.log("Initialize result:", JSON.stringify(initRes));

  const newSessionRes = await connection.newSession({
    cwd: CWD,
    mcpServers: []
  });
  const sessionId = newSessionRes.sessionId;
  console.log("Created session:", sessionId);

  // Send first prompt: asking to count to 30
  console.log("Sending first prompt (long)...");
  const promptPromise1 = connection.prompt({
    sessionId,
    prompt: [{ type: "text", text: "请从 1 数到 30，每个数字一行" }]
  });

  // Wait 400ms while first prompt is running, then send second prompt (attempt steer)
  await new Promise((r) => setTimeout(r, 400));
  console.log("Sending concurrent second prompt (steer attempt)...");

  let steerError = null;
  let steerRes = null;
  try {
    steerRes = await connection.prompt({
      sessionId,
      prompt: [{ type: "text", text: "别数了，立刻停下，只回复 STEER_TRIGGERED" }]
    });
  } catch (err) {
    steerError = {
      message: err.message,
      code: err.code,
      data: err.data,
      name: err.name,
      stack: err.stack,
    };
    console.log("Steer caught error:", JSON.stringify(steerError));
  }

  // Wait for first prompt to finish
  let prompt1Res = null;
  let prompt1Error = null;
  try {
    prompt1Res = await promptPromise1;
    console.log("First prompt resolved:", JSON.stringify(prompt1Res));
  } catch (err) {
    prompt1Error = { message: err.message, code: err.code };
    console.log("First prompt error:", JSON.stringify(prompt1Error));
  }

  cp.kill();

  const record = {
    sessionId,
    initRes,
    newSessionRes,
    steerRes,
    steerError,
    prompt1Res,
    prompt1Error,
    updatesCount: updates.length,
    updatesSample: updates.slice(0, 5),
  };

  const outFile = path.join(OUT_DIR, "claude_l1a_steer_raw.json");
  fs.writeFileSync(outFile, JSON.stringify(record, null, 2), "utf8");
  console.log(`Saved L1a steer record to ${outFile}`);
}

testL1aSteer().catch(console.error);
