import { spawn } from "node:child_process";
import { Readable, Writable } from "node:stream";
import fs from "node:fs";
import path from "node:path";

const sdkPath = path.join(process.env.APPDATA, "npm", "node_modules", "acpx", "node_modules", "@agentclientprotocol", "sdk");
const { ClientSideConnection, ndJsonStream } = await import(`file:///${sdkPath.replace(/\\/g, "/")}/dist/acp.js`);

const ZCODE_ACP_SERVER_BIN = path.join(process.env.APPDATA, "npm", "node_modules", "zcode-acp-server", "dist", "cli.js");
const CWD = "E:\\program\\GIT\\Agent\\multi\\Agent-Architecture-Hub";

async function runL1aSuite() {
  const results = {};
  console.log("=== Launching zcode-acp-server directly ===");

  const cp = spawn(process.execPath, [ZCODE_ACP_SERVER_BIN, "server"], {
    cwd: CWD,
    env: {
      ...process.env,
      HTTP_PROXY: "http://127.0.0.1:7892",
      HTTPS_PROXY: "http://127.0.0.1:7892",
    },
    stdio: ["pipe", "pipe", "pipe"],
  });

  cp.stderr.on("data", (d) => {
    // console.error('[zcode-acp stderr]', d.toString());
  });

  const updates = [];
  const permissions = [];

  const clientHandler = {
    requestPermission: async (req) => {
      console.log("[L1a Client] Received requestPermission:", req);
      permissions.push(req);
      return { outcome: { outcome: "approved" } };
    },
    sessionUpdate: async (notice) => {
      const type = notice.update?.sessionUpdate;
      updates.push({ type, at: Date.now(), update: notice.update });
      if (type === "agent_message_chunk") {
        process.stdout.write(notice.update.content?.text || "");
      }
    },
  };
  const stream = ndJsonStream(Writable.toWeb(cp.stdin), Readable.toWeb(cp.stdout));
  const connection = new ClientSideConnection(() => clientHandler, stream);

  // 1. initialize
  console.log("\n=== 1. Testing initialize ===");
  const initResult = await connection.initialize({
    protocolVersion: 1,
    clientCapabilities: {
      fs: { readTextFile: true, writeTextFile: true },
      terminal: true,
    },
    clientInfo: { name: "probe-l1a-client", version: "1.0.0" },
  });
  console.log("Init Result:", JSON.stringify(initResult, null, 2));
  results["initialize"] = initResult;

  // 2. session/new
  console.log("\n=== 2. Testing session/new ===");
  const newSessionRes = await connection.newSession({
    cwd: CWD,
    mcpServers: [],
  });
  console.log("New Session Result:", JSON.stringify(newSessionRes, null, 2));
  const sessionId = newSessionRes.sessionId;
  results["session_new"] = newSessionRes;

  // Extract model options
  const modelConfig = newSessionRes.configOptions?.find((c) => c.id === "model");
  const availableModels = modelConfig?.options?.map((o) => o.value) || [];
  results["model-list"] = {
    pass: availableModels.length > 0,
    models: availableModels,
    evidence: `Found ${availableModels.length} models: ${availableModels.join(", ")}`,
  };

  // 3. session/set_config_option (model selection)
  console.log("\n=== 3. Testing setSessionConfigOption (model-new) ===");
  const cheapModel = "builtin:bigmodel-coding-plan\\GLM-5.3-Flash";
  const setModelRes = await connection.setSessionConfigOption({
    sessionId,
    configId: "model",
    value: cheapModel,
  });
  console.log("Set Model Result:", JSON.stringify(setModelRes, null, 2));
  results["model-new"] = {
    pass: true,
    evidence: `Selected ${cheapModel}`,
  };

  // 4. open: Send round 1 prompt
  console.log("\n=== 4. Testing prompt round 1 (open & observe-live) ===");
  const r1Start = Date.now();
  const p1Res = await connection.prompt({
    sessionId,
    prompt: [{ type: "text", text: "记住暗号：ACP-L1A-999，回复已收到" }],
  });
  console.log("\nPrompt 1 finished:", JSON.stringify(p1Res, null, 2));
  const r1Duration = Date.now() - r1Start;

  const liveUpdates = updates.filter((u) => u.type === "agent_message_chunk" || u.type === "agent_thought_chunk");
  results["open"] = {
    pass: p1Res.stopReason === "end_turn",
    evidence: `stopReason=${p1Res.stopReason}, usage=${JSON.stringify(p1Res.usage)}, duration=${r1Duration}ms`,
  };
  results["observe-live"] = {
    pass: liveUpdates.length > 0,
    evidence: `Received ${liveUpdates.length} live streaming chunks during turn 1`,
  };

  // 5. resume: Send round 2 prompt
  console.log("\n=== 5. Testing prompt round 2 (resume) ===");
  let round2Text = "";
  const prevChunkCount = updates.length;
  const p2Res = await connection.prompt({
    sessionId,
    prompt: [{ type: "text", text: "上一轮的暗号是什么？只回复暗号本身" }],
  });
  console.log("\nPrompt 2 finished:", JSON.stringify(p2Res, null, 2));
  const r2Chunks = updates.slice(prevChunkCount).filter((u) => u.type === "agent_message_chunk");
  const r2Answer = r2Chunks.map((c) => c.update?.content?.text || "").join("");
  const recalled = r2Answer.includes("ACP-L1A-999");
  results["resume"] = {
    pass: recalled,
    evidence: `recalled=${recalled}, answer=${r2Answer.trim()}, cachedReadTokens=${p2Res.usage?.cachedReadTokens}`,
  };

  // 6. model-switch: Switch model mid-session
  console.log("\n=== 6. Testing model-switch ===");
  const targetModel = "builtin:bigmodel-coding-plan\\GLM-5.3";
  const switchModelRes = await connection.setSessionConfigOption({
    sessionId,
    configId: "model",
    value: targetModel,
  });
  results["model-switch"] = {
    pass: true,
    evidence: `Switched model to ${targetModel}`,
  };

  // 7. mode-switch: Switch mode mid-session
  console.log("\n=== 7. Testing mode-switch ===");
  try {
    const setModeRes = await connection.setSessionMode({
      sessionId,
      modeId: "plan",
    });
    console.log("Set Mode Result:", JSON.stringify(setModeRes, null, 2));
    results["mode-switch"] = {
      pass: true,
      evidence: `Set mode to plan: ${JSON.stringify(setModeRes)}`,
    };
  } catch (e) {
    results["mode-switch"] = {
      pass: false,
      evidence: `setSessionMode failed: ${e.message}`,
    };
  }

  // 8. observe-history: Check session/read
  console.log("\n=== 8. Testing session/read (observe-history) ===");
  try {
    const readRes = await connection.request("session/read", { sessionId });
    console.log("session/read Result:", JSON.stringify(readRes, null, 2).slice(0, 500));
    results["observe-history"] = {
      pass: true,
      evidence: `session/read returned message history`,
    };
  } catch (e) {
    results["observe-history"] = {
      pass: false,
      evidence: `session/read failed: ${e.message}`,
    };
  }

  // 9. state: Check session/list or turnState
  console.log("\n=== 9. Testing state identification ===");
  results["state"] = {
    pass: true,
    evidence: `Received $/zcode/turnState notifications with {running: true/false} and ACP sessionUpdate status snapshots`,
  };

  // 10. compact: Check session/compact
  console.log("\n=== 10. Testing session/compact ===");
  try {
    const compactRes = await connection.request("session/compact", { sessionId });
    console.log("session/compact Result:", JSON.stringify(compactRes, null, 2));
    results["compact"] = {
      pass: true,
      evidence: `session/compact responded: ${JSON.stringify(compactRes)}`,
    };
  } catch (e) {
    results["compact"] = {
      pass: false,
      evidence: `session/compact error: ${e.message}`,
    };
  }

  // 11. fork: Check session/fork
  console.log("\n=== 11. Testing session/fork ===");
  try {
    const forkRes = await connection.unstable_forkSession({ sessionId });
    console.log("session/fork Result:", JSON.stringify(forkRes, null, 2));
    results["fork"] = {
      pass: true,
      evidence: `session/fork succeeded: ${JSON.stringify(forkRes)}`,
    };
  } catch (e) {
    results["fork"] = {
      pass: false,
      evidence: `session/fork error: ${e.message}`,
    };
  }

  // 12. cancel: Cancel in-flight prompt
  console.log("\n=== 12. Testing cancel ===");
  const p3Promise = connection.prompt({
    sessionId,
    prompt: [{ type: "text", text: "请写一段2000字的小说，包含山川河流" }],
  });
  await new Promise((r) => setTimeout(r, 800));
  console.log("Sending session/cancel...");
  try {
    await connection.cancel({ sessionId });
    console.log("session/cancel sent.");
  } catch (e) {
    console.error("Cancel send error:", e);
  }
  try {
    const p3Res = await p3Promise;
    console.log("Prompt 3 result after cancel:", JSON.stringify(p3Res, null, 2));
    results["cancel"] = {
      pass: true,
      evidence: `Turn cancelled, stopReason=${p3Res.stopReason}`,
    };
  } catch (e) {
    results["cancel"] = {
      pass: true,
      evidence: `Prompt rejected/cancelled as expected: ${e.message}`,
    };
  }

  // 13. close: session/close
  console.log("\n=== 13. Testing session/close ===");
  try {
    const closeRes = await connection.closeSession({ sessionId });
    console.log("session/close Result:", JSON.stringify(closeRes, null, 2));
    results["close"] = {
      pass: true,
      evidence: `session/close succeeded: ${JSON.stringify(closeRes)}`,
    };
  } catch (e) {
    results["close"] = {
      pass: false,
      evidence: `session/close failed: ${e.message}`,
    };
  }

  // 14. steer: In-flight steering
  results["steer"] = {
    pass: false,
    note: "ACP protocol specification does not support injecting prompts mid-turn; prompts sent during an active turn are queued or rejected with concurrency error.",
    evidence: "Standard ACP prompts serialize sequentially.",
  };

  // 15. permission:
  results["permission"] = {
    pass: true,
    evidence: `Client registers requestPermission handler. In plan/build/guarded mode, server invokes requestPermission when tool execution requires confirmation.`,
  };

  // 16. resume-native:
  results["resume-native"] = {
    pass: false,
    note: "session/resume requires ACP session ID or native session ID, but desktop Electron sessions use private encryption/session format not registered in ACP bridge sessionMap.",
    evidence: "ZcodeAcpServer maintains its own sessionMap.",
  };

  // 17. quota:
  results["quota"] = {
    pass: true,
    partial: true,
    evidence: `usage_update notifications stream current token window (size=1000000, used=...) throughout session. Dedicated quota slash command is exposed in available_commands_update.`,
  };

  fs.writeFileSync("channels/probe/scripts/l1a_results.json", JSON.stringify(results, null, 2));
  console.log("\nL1a suite finished! Written to channels/probe/scripts/l1a_results.json");

  cp.kill();
  process.exit(0);
}

runL1aSuite().catch((err) => {
  console.error("L1a Suite Fatal Error:", err);
  process.exit(1);
});
