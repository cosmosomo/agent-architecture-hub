import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { Readable, Writable } from "node:stream";

const CWD = "E:\\program\\GIT\\Agent\\multi\\Agent-Architecture-Hub";
const OUT_DIR = path.join(CWD, "channels", "probe", "scripts", "retest", "output");
fs.mkdirSync(OUT_DIR, { recursive: true });

const TEST_FILE = path.join(OUT_DIR, "perm_verify_created.txt");
if (fs.existsSync(TEST_FILE)) fs.unlinkSync(TEST_FILE);

const COMMON_ENV = {
  ...process.env,
  ACPX_CLAUDE_INCLUDE_USER_SETTINGS: "1",
  HTTP_PROXY: "http://127.0.0.1:7892",
  HTTPS_PROXY: "http://127.0.0.1:7892",
  ANTHROPIC_DEFAULT_HAIKU_MODEL: "claude-haiku-4-5",
  ANTHROPIC_MODEL: "claude-haiku-4-5",
};

async function testPermissionWrite() {
  console.log("=== Testing claude/L1a/claude-agent-acp · permission (file write) ===");

  const sdkPath = path.join(process.env.APPDATA, "npm", "node_modules", "acpx", "node_modules", "@agentclientprotocol", "sdk");
  const { ClientSideConnection, ndJsonStream } = await import(`file:///${sdkPath.replace(/\\/g, "/")}/dist/acp.js`);

  const cp = spawn("cmd.exe", ["/c", "claude-agent-acp.cmd"], {
    cwd: CWD,
    env: COMMON_ENV,
    stdio: ["pipe", "pipe", "pipe"],
  });

  const permissionRequests = [];
  const updates = [];
  const rawStderr = [];

  cp.stderr.on("data", d => rawStderr.push(d.toString()));

  const clientHandler = {
    requestPermission: async (req) => {
      console.log("\n>>> [HANDLER] requestPermission intercepted! Payload:", JSON.stringify(req, null, 2));
      permissionRequests.push(req);
      const allowOption = req.options?.find(o => o.kind === "allow_once" || o.kind === "allow_always")?.optionId || "allow-once";
      return {
        outcome: {
          outcome: "selected",
          optionId: allowOption
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

  // Switch mode to "default" (Manual: ask before changes)
  console.log("Setting mode to 'default'...");
  await connection.setSessionMode({
    sessionId,
    modeId: "default"
  });

  // Prompt to write a file using relative path to avoid path blocking
  const relFile = "channels/probe/scripts/retest/output/perm_verify_created.txt";
  console.log(`Prompting Claude to write file ${relFile}...`);
  const promptRes = await connection.prompt({
    sessionId,
    prompt: [{ type: "text", text: `请使用 Write 工具在文件 ${relFile} 中写入内容: PERMISSION_APPROVED_TOKEN_7731` }]
  });
  console.log("Prompt completed, stopReason:", promptRes.stopReason);

  cp.kill();

  const fileCreated = fs.existsSync(TEST_FILE);
  const fileContent = fileCreated ? fs.readFileSync(TEST_FILE, "utf8") : "";
  console.log(`Target file created: ${fileCreated}, content: "${fileContent.trim()}"`);

  const record = {
    sessionId,
    setMode: "default",
    permissionRequestsCount: permissionRequests.length,
    permissionRequests,
    fileCreated,
    fileContent: fileContent.trim(),
    promptStopReason: promptRes.stopReason,
    pass: permissionRequests.length > 0 && fileCreated
  };

  const outFile = path.join(OUT_DIR, "claude_l1a_permission_raw.json");
  fs.writeFileSync(outFile, JSON.stringify(record, null, 2), "utf8");
  console.log(`Saved output to ${outFile}`);
}

testPermissionWrite().catch(console.error);
