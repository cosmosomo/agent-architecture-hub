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

async function testPermission() {
  console.log("=== Testing claude/L1a/claude-agent-acp · permission ===");

  const sdkPath = path.join(process.env.APPDATA, "npm", "node_modules", "acpx", "node_modules", "@agentclientprotocol", "sdk");
  const { ClientSideConnection, ndJsonStream } = await import(`file:///${sdkPath.replace(/\\/g, "/")}/dist/acp.js`);

  const cp = spawn("cmd.exe", ["/c", "claude-agent-acp.cmd"], {
    cwd: CWD,
    env: COMMON_ENV,
    stdio: ["pipe", "pipe", "pipe"],
  });

  const permissionRequests = [];
  const updates = [];

  const clientHandler = {
    requestPermission: async (req) => {
      console.log("\n>>> [HANDLER] requestPermission received:", JSON.stringify(req, null, 2));
      permissionRequests.push(req);
      // Approve the request
      return {
        outcome: {
          outcome: "approved"
        }
      };
    },
    sessionUpdate: async (notice) => {
      updates.push(notice);
      if (notice.update?.sessionUpdate === "tool_call") {
        console.log("Tool call update:", JSON.stringify(notice.update));
      }
    },
  };

  const stream = ndJsonStream(Writable.toWeb(cp.stdin), Readable.toWeb(cp.stdout));
  const connection = new ClientSideConnection(() => clientHandler, stream);

  const initRes = await connection.initialize({
    protocolVersion: 1,
    clientCapabilities: {},
    clientInfo: { name: "probe-perm-tester", version: "1.0.0" }
  });
  console.log("Init completed");

  const newSessionRes = await connection.newSession({
    cwd: CWD,
    mcpServers: []
  });
  const sessionId = newSessionRes.sessionId;
  console.log("Session created:", sessionId);
  console.log("Initial mode:", newSessionRes.modes?.currentModeId);

  // Switch mode to "default" (Manual: Always ask before making changes)
  console.log("Setting session mode to 'default'...");
  let setModeRes = null;
  try {
    setModeRes = await connection.setSessionMode({
      sessionId,
      modeId: "default"
    });
    console.log("setSessionMode result:", JSON.stringify(setModeRes));
  } catch (err) {
    console.log("setSessionMode error:", err.message);
  }

  // Ask Claude to run a bash tool
  console.log("Prompting Claude to run a bash command that requires permission...");
  let promptRes = null;
  let promptError = null;
  try {
    promptRes = await connection.prompt({
      sessionId,
      prompt: [{ type: "text", text: "请使用 Bash 工具执行命令: echo PROBE_PERM_VERIFIED_8821" }]
    });
    console.log("Prompt resolved with stopReason:", promptRes.stopReason);
  } catch (err) {
    promptError = { message: err.message, code: err.code };
    console.error("Prompt error:", promptError);
  }

  cp.kill();

  const record = {
    sessionId,
    initRes,
    newSessionRes,
    setModeRes,
    permissionRequests,
    permissionRequestsCount: permissionRequests.length,
    promptRes,
    promptError,
    updatesSample: updates.filter(u => u.update?.sessionUpdate === "tool_call" || u.update?.sessionUpdate === "tool_result"),
  };

  const outFile = path.join(OUT_DIR, "claude_l1a_permission_raw.json");
  fs.writeFileSync(outFile, JSON.stringify(record, null, 2), "utf8");
  console.log(`Saved permission test record to ${outFile}`);
}

testPermission().catch(console.error);
