import { spawn } from "node:child_process";
import { Readable, Writable } from "node:stream";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const HOME = os.homedir();
const CWD = "E:\\program\\GIT\\Agent\\multi\\Agent-Architecture-Hub";
const SCRIPT_PATH = "C:\\Users\\COLORFIRE\\AppData\\Roaming\\npm\\node_modules\\@tencent-ai\\codebuddy-code\\dist\\codebuddy.js";
const PROJECTS_DIR = path.join(HOME, ".workbuddy", "projects", "e-program-GIT-Agent-multi-Agent-Architecture-Hub");

const sdkPath = path.join(process.env.APPDATA, "npm", "node_modules", "acpx", "node_modules", "@agentclientprotocol", "sdk");
const { ClientSideConnection, ndJsonStream } = await import(`file:///${sdkPath.replace(/\\/g, "/")}/dist/acp.js`);

const ENV = {
  ...process.env,
  CODEBUDDY_CONFIG_DIR: path.join(HOME, ".workbuddy"),
  WORKBUDDY_CONFIG_DIR: path.join(HOME, ".workbuddy"),
  ACC_PRODUCT_CONFIG_V3: JSON.stringify({
    authentication: {
      type: "custom-token",
      attributes: { token: "wb-local-byok" },
    },
  }),
  HTTP_PROXY: "http://127.0.0.1:7892",
  HTTPS_PROXY: "http://127.0.0.1:7892",
};

function withTimeout(promise, ms, fallbackMsg = "TIMEOUT") {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(fallbackMsg)), ms)),
  ]);
}

function readSessionJsonl(sessionId) {
  const filePath = path.join(PROJECTS_DIR, `${sessionId}.jsonl`);
  if (!fs.existsSync(filePath)) return [];
  const lines = fs.readFileSync(filePath, "utf8").trim().split("\n");
  const parsed = [];
  for (const line of lines) {
    try {
      parsed.push(JSON.parse(line));
    } catch (e) {}
  }
  return parsed;
}

const outDir = path.join(CWD, "channels", "probe", "scripts", "retest");
const resultsFile = path.join(outDir, "wb_l1a_retest_results.json");

async function main() {
  console.log("=== Testing workbuddy L1a codebuddy-acp retest ===");

  const cp = spawn(process.execPath, [SCRIPT_PATH, "--acp"], {
    cwd: CWD,
    env: ENV,
    stdio: ["pipe", "pipe", "pipe"],
  });

  const updates = [];
  const clientHandler = {
    requestPermission: async (req) => {
      return { outcome: { outcome: "approved" } };
    },
    sessionUpdate: async (notice) => {
      updates.push({ at: Date.now(), update: notice.update });
    },
  };

  const stream = ndJsonStream(Writable.toWeb(cp.stdin), Readable.toWeb(cp.stdout));
  const connection = new ClientSideConnection(() => clientHandler, stream);

  try {
    console.log("1. Initializing ACP connection...");
    const initRes = await withTimeout(connection.initialize({
      protocolVersion: 1,
      clientCapabilities: {
        fs: { readTextFile: true, writeTextFile: true },
        terminal: true,
      },
      clientInfo: { name: "probe-wb-l1a-retest", version: "1.0.0" },
    }), 20000, "initialize timeout");
    console.log("Initialize ok. Protocol version:", initRes.protocolVersion);

    console.log("2. Creating new session...");
    const newSessionRes = await withTimeout(connection.newSession({
      cwd: CWD,
      mcpServers: [],
    }), 20000, "newSession timeout");
    const sessionId = newSessionRes.sessionId;
    console.log("Created sessionId:", sessionId);

    console.log("3. Setting model to custom-local:glm-5.3...");
    const setRes = await withTimeout(connection.setSessionConfigOption({
      sessionId,
      configId: "model",
      value: "custom-local:glm-5.3",
    }), 15000, "setSessionConfigOption timeout");
    console.log("setSessionConfigOption result:", JSON.stringify(setRes));

    console.log("4. Sending prompt: 请只回复四个字：日月盈昃 ...");
    const pRes = await withTimeout(connection.prompt({
      sessionId,
      prompt: [{ type: "text", text: "请只回复四个字：日月盈昃" }],
    }), 60000, "prompt timeout");
    console.log("Prompt completed, stopReason:", pRes.stopReason);

    // Give a brief moment for jsonl flush
    await new Promise(r => setTimeout(r, 2000));

    // Close connection cleanly
    cp.kill();

    // Check project jsonl
    console.log("5. Checking backend project jsonl for actual model used...");
    const entries = readSessionJsonl(sessionId);
    const assistantTurn = entries
      .filter(e => e.type === "message" && e.role === "assistant")
      .pop();

    console.log("Actual assistant turn providerData:", JSON.stringify(assistantTurn?.providerData));

    const pass = Boolean(
      assistantTurn?.providerData?.model === "glm-5.3" &&
      assistantTurn?.providerData?.requestModelId === "custom-local:glm-5.3"
    );

    const result = {
      pass,
      sessionId,
      stopReason: pRes.stopReason,
      actualAssistantTurn: assistantTurn,
      cmd: `codebuddy --acp -> setSessionConfigOption(model=custom-local:glm-5.3) -> prompt("请只回复四个字：日月盈昃")`,
    };

    fs.writeFileSync(resultsFile, JSON.stringify(result, null, 2), "utf8");
    console.log(`L1a model-new result: ${pass ? "PASS" : "FAIL"}`);
    process.exit(0);
  } catch (err) {
    cp.kill();
    console.error("L1a execution error:", err);
    fs.writeFileSync(resultsFile, JSON.stringify({ pass: false, error: String(err) }, null, 2), "utf8");
    process.exit(1);
  }
}

main().catch(console.error);
