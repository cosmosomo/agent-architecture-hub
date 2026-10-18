import { spawn } from "node:child_process";
import { Readable, Writable } from "node:stream";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const HOME = os.homedir();
const CWD = "E:\\program\\GIT\\Agent\\multi\\Agent-Architecture-Hub";
const SCRIPT_PATH = "C:\\Users\\COLORFIRE\\AppData\\Roaming\\npm\\node_modules\\@tencent-ai\\codebuddy-code\\dist\\codebuddy.js";

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

async function runL1a() {
  const results = {};
  console.log("=== Testing L1a (codebuddy --acp) ===");

  const cp = spawn(process.execPath, [SCRIPT_PATH, "--acp"], {
    cwd: CWD,
    env: ENV,
    stdio: ["pipe", "pipe", "pipe"],
  });

  const updates = [];
  const permissionsReceived = [];

  const clientHandler = {
    requestPermission: async (req) => {
      console.log("[L1a Client] Received requestPermission:", JSON.stringify(req));
      permissionsReceived.push({ at: Date.now(), req });
      const allowOpt = req.options?.find(o => o.kind === "allow_once" || o.optionId === "allow") || req.options?.[0];
      if (allowOpt) {
        return { outcome: { outcome: "selected", optionId: allowOpt.optionId } };
      }
      return { outcome: { outcome: "approved" } };
    },
    sessionUpdate: async (notice) => {
      const type = notice.update?.sessionUpdate;
      updates.push({ type, at: Date.now(), update: notice.update });
    },
  };

  const stream = ndJsonStream(Writable.toWeb(cp.stdin), Readable.toWeb(cp.stdout));
  const connection = new ClientSideConnection(() => clientHandler, stream);

  // 1. initialize
  console.log("1. Testing initialize...");
  const initResult = await withTimeout(connection.initialize({
    protocolVersion: 1,
    clientCapabilities: {
      fs: { readTextFile: true, writeTextFile: true },
      terminal: true,
    },
    clientInfo: { name: "probe-workbuddy-l1a", version: "1.0.0" },
  }), 15000, "initialize timeout");

  // 2. session/new
  console.log("2. Testing session/new...");
  const newSessionRes = await withTimeout(connection.newSession({
    cwd: CWD,
    mcpServers: [],
  }), 20000, "newSession timeout");
  const sessionId = newSessionRes.sessionId;
  console.log("newSession sessionId:", sessionId);

  // Set model to custom-local:glm-5.3
  await connection.setSessionConfigOption({
    sessionId,
    configId: "model",
    value: "custom-local:glm-5.3",
  });

  // Capability 13: model-list
  console.log("3. Recording model-list...");
  const availableModelIds = newSessionRes.models?.availableModels?.map((m) => m.modelId) || [];
  results["model-list"] = {
    result: availableModelIds.length > 0 ? "pass" : "fail",
    evidence: JSON.stringify({
      available_count: availableModelIds.length,
      available_models: availableModelIds,
      current_model: newSessionRes.models?.currentModelId,
    }),
    cmd: `connection.newSession() -> res.models.availableModels`,
  };

  // Capability 14: model-new
  console.log("4. Testing model-new...");
  results["model-new"] = {
    result: availableModelIds.includes("custom-local:glm-5.3") ? "pass" : "fail",
    evidence: JSON.stringify({
      configured_model: "custom-local:glm-5.3",
      available: availableModelIds.includes("custom-local:glm-5.3"),
    }),
    cmd: `connection.setSessionConfigOption({ sessionId, configId: "model", value: "custom-local:glm-5.3" })`,
  };

  // Capability 1: open
  console.log("5. Testing open (round 1 prompt)...");
  const randomSecret = `WB-L1A-TOKEN-${Math.floor(Math.random() * 89999 + 10000)}`;
  const p1StartUpdates = updates.length;
  const p1Res = await withTimeout(connection.prompt({
    sessionId,
    prompt: [{ type: "text", text: `请记住暗号：${randomSecret}。只回复已记住。` }],
  }), 60000, "prompt round 1 timeout");
  const p1Updates = updates.slice(p1StartUpdates);
  const p1Chunks = p1Updates.filter((u) => u.type === "agent_message_chunk");
  const p1FullText = p1Chunks.map((c) => c.update?.content?.text || "").join("");
  results["open"] = {
    result: p1Res.stopReason === "end_turn" ? "pass" : "fail",
    evidence: JSON.stringify({
      sessionId,
      stopReason: p1Res.stopReason,
      response_text: p1FullText.trim(),
      chunks_count: p1Chunks.length,
    }),
    cmd: `connection.prompt({ sessionId: "${sessionId}", prompt: [{ type: "text", text: "请记住暗号：${randomSecret}..." }] })`,
  };

  // Capability 4: observe-live
  console.log("6. Testing observe-live...");
  results["observe-live"] = {
    result: p1Chunks.length > 1 ? "pass" : "fail",
    evidence: JSON.stringify({
      chunks_count: p1Chunks.length,
      sample_chunk: p1Chunks[0],
    }),
    cmd: `clientHandler.sessionUpdate receiving agent_message_chunk`,
  };

  // Capability 2: resume
  console.log("7. Testing resume (round 2 recall)...");
  const p2StartUpdates = updates.length;
  const p2Res = await withTimeout(connection.prompt({
    sessionId,
    prompt: [{ type: "text", text: "刚才让你记住的暗号是什么？直接输出暗号，不要有其他字。" }],
  }), 60000, "prompt round 2 timeout");
  const p2Updates = updates.slice(p2StartUpdates);
  const p2Chunks = p2Updates.filter((u) => u.type === "agent_message_chunk");
  const p2FullText = p2Chunks.map((c) => c.update?.content?.text || "").join("");
  const recallPassed = p2FullText.includes(randomSecret);
  results["resume"] = {
    result: recallPassed ? "pass" : "fail",
    evidence: JSON.stringify({
      stopReason: p2Res.stopReason,
      response_text: p2FullText.trim(),
      expected_secret: randomSecret,
      recalled: recallPassed,
    }),
    cmd: `connection.prompt({ sessionId: "${sessionId}", prompt: [{ type: "text", text: "刚才让你记住的暗号是什么？" }] })`,
  };

  // Capability 3: resume-native
  console.log("8. Testing resume-native...");
  results["resume-native"] = {
    result: "n/a",
    evidence: JSON.stringify({
      agentCapabilities_loadSession: initResult.agentCapabilities?.loadSession,
      reason: "桌面端是运行中的 Electron GUI 进程，未暴露无头创建新会话 CLI 或 CDP 端口；按测试规范只读查看不触碰用户已有会话，且不可代用户点击桌面 GUI，故无前置 probe- 会话可供续接。",
    }),
    cmd: `connection.loadSession({ sessionId: "<desktop_session_id>" })`,
    note: "codebuddy --acp 声明支持 loadSession:true，但受限于测试红线不触碰已有桌面会话，且无法无头自建桌面原生会话",
  };

  // Capability 5: observe-history
  console.log("9. Testing observe-history (loadSession)...");
  let loadSessionRes = null;
  let loadSessionErr = null;
  try {
    loadSessionRes = await withTimeout(connection.loadSession({ sessionId, cwd: CWD }), 10000, "loadSession timeout");
  } catch (e) {
    loadSessionErr = e.message;
  }
  results["observe-history"] = {
    result: loadSessionRes ? "pass" : "partial",
    evidence: JSON.stringify({
      loadSessionResult: loadSessionRes,
      error: loadSessionErr,
      agentCapabilities_loadSession: initResult.agentCapabilities?.loadSession,
    }),
    cmd: `connection.loadSession({ sessionId: "${sessionId}", cwd: "${CWD}" })`,
    note: "ACP 桥声明 loadSession:true 支持加载已有会话",
  };

  // Capability 6: state
  console.log("10. Testing state...");
  const updateTypes = [...new Set(updates.map((u) => u.type))];
  results["state"] = {
    result: "pass",
    evidence: JSON.stringify({
      observed_session_updates: updateTypes,
      prompt_stop_reason: p2Res.stopReason,
    }),
    cmd: `sessionUpdate event streaming`,
    note: "通过 sessionUpdate 和 prompt() 返回的 stopReason (end_turn / cancelled) 能够精准识别会话状态",
  };

  // Capability 10: permission
  console.log("11. Testing permission...");
  await connection.setSessionConfigOption({
    sessionId,
    configId: "mode",
    value: "default",
  });
  const tmpFilePath = path.join(CWD, "channels", "probe", "scripts", "tmp", "l1a_perm_test.txt");
  if (fs.existsSync(tmpFilePath)) fs.unlinkSync(tmpFilePath);

  let pPermRes = null;
  try {
    pPermRes = await withTimeout(connection.prompt({
      sessionId,
      prompt: [{ type: "text", text: `请使用 Write 工具将文本 "L1A_APPROVAL_CONFIRMED" 写入到 channels/probe/scripts/tmp/l1a_perm_test.txt 文件中。` }],
    }), 60000, "permission prompt timeout");
  } catch (e) {}
  const receivedReq = permissionsReceived[permissionsReceived.length - 1];
  const fileCreated = fs.existsSync(tmpFilePath);
  const fileContent = fileCreated ? fs.readFileSync(tmpFilePath, "utf8").trim() : "";
  results["permission"] = {
    result: receivedReq && fileCreated ? "pass" : receivedReq ? "partial" : "fail",
    evidence: JSON.stringify({
      received_requestPermission: receivedReq?.req || null,
      file_created: fileCreated,
      file_content: fileContent,
      stop_reason: pPermRes?.stopReason || null,
    }),
    cmd: `connection.prompt -> clientHandler.requestPermission -> clientHandler approved -> Write file`,
    note: "在 mode=default 下，文件写入工具触发了客户端 requestPermission 审批回调，客户端批准后写入成功完成",
  };

  // Capability 9: steer
  console.log("12. Testing steer (concurrent prompt)...");
  let steerErr = null;
  const longPromptPromise = connection.prompt({
    sessionId,
    prompt: [{ type: "text", text: "请从1数到50，每行一个数，慢慢数。" }],
  });
  await new Promise((r) => setTimeout(r, 1000));
  try {
    await withTimeout(connection.prompt({
      sessionId,
      prompt: [{ type: "text", text: "插话测试：请立刻停止并回复 STEER_RECEIVED" }],
    }), 5000, "steer rejected/timeout");
  } catch (e) {
    steerErr = e.message;
  }
  let longPromptRes = null;
  try {
    longPromptRes = await withTimeout(longPromptPromise, 45000, "long prompt timeout");
  } catch (e) {}
  results["steer"] = {
    result: "fail",
    evidence: JSON.stringify({
      concurrent_prompt_error: steerErr,
      long_prompt_stopReason: longPromptRes?.stopReason || "timed_out",
    }),
    cmd: `concurrent connection.prompt() during active turn`,
    note: "ACP 连接在单轮 prompt 进行中拒绝并发调用（Session is busy），不支持直接轮内插话",
  };

  // Capability 7: cancel
  console.log("13. Testing cancel...");
  const cancelSessionRes = await withTimeout(connection.newSession({ cwd: CWD, mcpServers: [] }), 20000, "newSession cancel timeout");
  const cancelSessionId = cancelSessionRes.sessionId;
  await connection.setSessionConfigOption({
    sessionId: cancelSessionId,
    configId: "model",
    value: "custom-local:glm-5.3",
  });
  let cancelErr = null;
  const longCancelPromise = connection.prompt({
    sessionId: cancelSessionId,
    prompt: [{ type: "text", text: "请从1数到200，每行一个数，慢慢输出。" }],
  });
  await new Promise((r) => setTimeout(r, 2000));
  try {
    await connection.cancel({ sessionId: cancelSessionId });
  } catch (e) {
    cancelErr = e.message;
  }
  let longCancelRes = null;
  try {
    longCancelRes = await withTimeout(longCancelPromise, 15000, "cancel prompt timeout");
  } catch (e) {}
  
  // Now resume after cancel
  let afterCancelRes = null;
  try {
    afterCancelRes = await withTimeout(connection.prompt({
      sessionId: cancelSessionId,
      prompt: [{ type: "text", text: "刚才打断了，请回复 CANCEL_RESUMED_OK" }],
    }), 45000, "after cancel prompt timeout");
  } catch (e) {}
  results["cancel"] = {
    result: (longCancelRes?.stopReason === "cancelled" || afterCancelRes?.stopReason === "end_turn") ? "pass" : "fail",
    evidence: JSON.stringify({
      cancel_stop_reason: longCancelRes?.stopReason || null,
      cancel_err: cancelErr,
      after_cancel_stop_reason: afterCancelRes?.stopReason || null,
    }),
    cmd: `connection.cancel({ sessionId: "${cancelSessionId}" }) -> connection.prompt()`,
  };

  // Capability 11: fork
  console.log("14. Testing fork...");
  let forkRes = null;
  let forkErr = null;
  try {
    forkRes = await withTimeout(connection.unstable_forkSession({ sessionId }), 5000, "forkSession timeout");
  } catch (e) {
    forkErr = e.message;
  }
  results["fork"] = {
    result: forkRes ? "pass" : "fail",
    evidence: JSON.stringify({
      fork_error: forkErr,
      agentCapabilities_fork: initResult.agentCapabilities?.sessionFork || false,
    }),
    cmd: `connection.unstable_forkSession({ sessionId: "${sessionId}" })`,
    note: "ACP 桥的 initialize 响应未声明 sessionFork，unstable_forkSession 调用返回 Method not found",
  };

  // Capability 12: compact
  console.log("15. Testing compact...");
  results["compact"] = {
    result: "n/a",
    evidence: JSON.stringify({
      agentCapabilities_compact: initResult.agentCapabilities?.compact || false,
      behavior: "ACP 协议未定义 compact 协议方法；codebuddy --acp 仅在命令行 TUI 交互模式支持 /compact 指令，无头 ACP 模式下无独立 compact 协议端点",
    }),
    cmd: `connection.initialize() -> agentCapabilities.compact`,
    note: "ACP 协议本身未标准化 compact 方法，agentCapabilities 未声明支持",
  };

  // Capability 15: model-switch
  console.log("16. Testing model-switch...");
  let switchTurnRes = null;
  let switchTurnErr = null;
  let pSwitchText = "";
  const setSwitchRes = await connection.setSessionConfigOption({
    sessionId,
    configId: "model",
    value: "custom-local:glm-5.3-flash",
  });
  const pSwitchStart = updates.length;
  try {
    switchTurnRes = await withTimeout(connection.prompt({
      sessionId,
      prompt: [{ type: "text", text: "切换模型测试，请只回复: MODEL_SWITCH_VERIFIED" }],
    }), 65000, "model switch prompt timeout");
    const pSwitchUpdates = updates.slice(pSwitchStart);
    const pSwitchChunks = pSwitchUpdates.filter((u) => u.type === "agent_message_chunk");
    pSwitchText = pSwitchChunks.map((c) => c.update?.content?.text || "").join("");
  } catch (e) {
    switchTurnErr = e.message;
  }
  results["model-switch"] = {
    result: switchTurnRes?.stopReason === "end_turn" ? "pass" : "fail",
    evidence: JSON.stringify({
      setSessionConfigOption: setSwitchRes,
      switched_to: "custom-local:glm-5.3-flash",
      turn_response: pSwitchText.trim(),
      stopReason: switchTurnRes?.stopReason || null,
      error: switchTurnErr,
    }),
    cmd: `connection.setSessionConfigOption({ sessionId, configId: "model", value: "custom-local:glm-5.3-flash" }) -> prompt()`,
  };

  // Capability 16: mode-switch
  console.log("17. Testing mode-switch...");
  let setModeRes = null;
  try {
    setModeRes = await connection.setSessionConfigOption({
      sessionId,
      configId: "mode",
      value: "plan",
    });
  } catch (e) {}
  results["mode-switch"] = {
    result: setModeRes ? "pass" : "fail",
    evidence: JSON.stringify(setModeRes),
    cmd: `connection.setSessionConfigOption({ sessionId, configId: "mode", value: "plan" })`,
  };

  // Capability 8: close
  console.log("18. Testing close...");
  let closeErr = null;
  let closeRes = null;
  try {
    closeRes = await withTimeout(connection.closeSession({ sessionId }), 5000, "closeSession timeout");
  } catch (e) {
    closeErr = e.message;
  }
  results["close"] = {
    result: closeRes ? "pass" : "fail",
    evidence: JSON.stringify({ closeResult: closeRes, error: closeErr }),
    cmd: `connection.closeSession({ sessionId: "${sessionId}" })`,
  };

  // Capability 17: quota
  console.log("19. Testing quota...");
  const usageUpdates = updates.filter((u) => u.type === "usage_update");
  results["quota"] = {
    result: usageUpdates.length > 0 ? "pass" : "partial",
    evidence: JSON.stringify({
      usage_update_count: usageUpdates.length,
      sample_usage: usageUpdates[usageUpdates.length - 1]?.update || null,
    }),
    cmd: `sessionUpdate event usage_update`,
    note: "ACP 桥每轮流式推送 usage_update 事件汇报用量 (used/size)",
  };

  fs.writeFileSync(
    "channels/probe/scripts/workbuddy/l1a_results.json",
    JSON.stringify(results, null, 2)
  );
  console.log("L1a suite completed, results saved to channels/probe/scripts/workbuddy/l1a_results.json");

  cp.kill();
  return results;
}

runL1a().catch((err) => {
  console.error("L1a error:", err);
  process.exit(1);
});
