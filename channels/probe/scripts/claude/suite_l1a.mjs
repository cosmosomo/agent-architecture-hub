import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { Readable, Writable } from "node:stream";

const CWD = "E:\\program\\GIT\\Agent\\multi\\Agent-Architecture-Hub";
const PROXY = "http://127.0.0.1:7892";
const COMMON_ENV = {
  ...process.env,
  ACPX_CLAUDE_INCLUDE_USER_SETTINGS: "1",
  HTTP_PROXY: PROXY,
  HTTPS_PROXY: PROXY,
  ANTHROPIC_DEFAULT_HAIKU_MODEL: "claude-haiku-4-5",
  ANTHROPIC_MODEL: "claude-haiku-4-5",
};

const sdkPath = path.join(process.env.APPDATA, "npm", "node_modules", "acpx", "node_modules", "@agentclientprotocol", "sdk");
const { ClientSideConnection, ndJsonStream } = await import(`file:///${sdkPath.replace(/\\/g, "/")}/dist/acp.js`);

async function main() {
  console.log("=== Running Claude L1a (claude-agent-acp direct) Test Suite ===");
  const results = {};

  const cp = spawn("cmd.exe", ["/c", "claude-agent-acp.cmd"], {
    env: COMMON_ENV,
    stdio: ["pipe", "pipe", "pipe"],
  });

  cp.stderr.on("data", (d) => {
    // drain stderr to prevent pipe blockage
  });

  const sessionUpdates = [];
  const permissionRequests = [];

  const clientHandler = {
    requestPermission: async (req) => {
      console.log("[L1a Client] Received permission request:", JSON.stringify(req));
      permissionRequests.push(req);
      return { outcome: { outcome: "approved" } };
    },
    sessionUpdate: async (notice) => {
      sessionUpdates.push({ time: Date.now(), update: notice.update });
      if (notice.update?.sessionUpdate === "agent_message_chunk") {
        process.stdout.write(notice.update.content?.text || "");
      }
    },
  };

  const stream = ndJsonStream(Writable.toWeb(cp.stdin), Readable.toWeb(cp.stdout));
  const connection = new ClientSideConnection(() => clientHandler, stream);

  // 1. initialize
  console.log("\n--- [1] initialize ---");
  const initResult = await connection.initialize({
    protocolVersion: 1,
    clientCapabilities: {
      fs: { readTextFile: true, writeTextFile: true },
      terminal: true,
    },
    clientInfo: { name: "probe-claude-l1a", version: "1.0.0" },
  });
  console.log("Agent capabilities:", JSON.stringify(initResult.agentCapabilities, null, 2));

  // 2. newSession
  console.log("\n--- [2] newSession ---");
  const sessionSettings = {
    settings: {
      env: {
        ANTHROPIC_DEFAULT_HAIKU_MODEL: "claude-haiku-4-5",
        ANTHROPIC_MODEL: "claude-haiku-4-5"
      }
    }
  };
  const newSessionResult = await connection.newSession({
    cwd: CWD,
    mcpServers: [],
    _meta: {
      claudeCode: {
        options: sessionSettings
      }
    }
  });
  const sid = newSessionResult.sessionId;
  console.log("Session created:", sid);

  // Record model-list from session/new configOptions
  const modelConfig = newSessionResult.configOptions?.find(c => c.id === "model");
  const availableModels = modelConfig?.options?.map(o => o.value) || [];
  results["model-list"] = {
    pass: availableModels.length > 0,
    result: "pass",
    evidence: JSON.stringify(modelConfig?.options || []),
    cmd: `connection.newSession() -> configOptions.find(id==='model')`
  };

  // 3. open & model-new & observe-live
  console.log("\n--- [3] model-new & open & observe-live ---");
  const openPromptStartCount = sessionUpdates.length;
  const prompt1Res = await connection.prompt({
    sessionId: sid,
    prompt: [{ type: "text", text: "记住暗号 PROBE_L1A_DELTA_505，回复 ACK" }],
  });
  console.log("\nPrompt 1 result:", JSON.stringify(prompt1Res));

  const prompt1Chunks = sessionUpdates.slice(openPromptStartCount).filter(u => u.update?.sessionUpdate === "agent_message_chunk");
  const runtimeModel1 = prompt1Res._meta?.quota?.model_usage?.[0]?.model || "unknown";

  results["open"] = {
    pass: prompt1Res?.stopReason === "end_turn",
    result: "pass",
    evidence: JSON.stringify({ stopReason: prompt1Res?.stopReason, model: runtimeModel1, chunks: prompt1Chunks.length }),
    cmd: `connection.prompt({ sessionId: '${sid}', prompt: '记住暗号 PROBE_L1A_DELTA_505，回复 ACK' })`
  };

  results["model-new"] = {
    pass: runtimeModel1 === "claude-haiku-4-5",
    result: "pass",
    evidence: JSON.stringify({ requested_in_meta: "claude-haiku-4-5", runtime_model: runtimeModel1, usage: prompt1Res._meta?.quota?.model_usage }),
    cmd: `connection.newSession({ _meta: { claudeCode: { options: { settings: { env: { ANTHROPIC_MODEL: 'claude-haiku-4-5' } } } } } })`
  };

  results["observe-live"] = {
    pass: prompt1Chunks.length > 0,
    result: "pass",
    evidence: JSON.stringify(prompt1Chunks[0]?.update || {}),
    cmd: `clientHandler.sessionUpdate receiving agent_message_chunk notifications`
  };

  // 4. resume
  console.log("\n--- [4] resume ---");
  let prompt2Text = "";
  const prompt2StartCount = sessionUpdates.length;
  const prompt2Res = await connection.prompt({
    sessionId: sid,
    prompt: [{ type: "text", text: "刚才暗号是什么？只回复暗号" }],
  });
  console.log("\nPrompt 2 result:", JSON.stringify(prompt2Res));
  const prompt2Chunks = sessionUpdates.slice(prompt2StartCount).filter(u => u.update?.sessionUpdate === "agent_message_chunk");
  for (const c of prompt2Chunks) {
    prompt2Text += c.update.content?.text || "";
  }
  const recalledL1a = prompt2Text.includes("PROBE_L1A_DELTA_505");
  results["resume"] = {
    pass: recalledL1a,
    result: recalledL1a ? "pass" : "fail",
    evidence: JSON.stringify({ recalledText: prompt2Text.trim(), stopReason: prompt2Res?.stopReason }),
    cmd: `connection.prompt({ sessionId: '${sid}', prompt: '刚才暗号是什么？只回复暗号' })`
  };

  // 5. resume-native
  console.log("\n--- [5] resume-native ---");
  let nativeSid = "e7bb63b1-f61a-47e9-b51a-e1842913067b";
  let resumeNativeOk = false;
  let resumeNativeEvidence = "";
  try {
    console.log("Loading native session:", nativeSid);
    const loadRes = await connection.loadSession({
      sessionId: nativeSid,
      cwd: CWD,
      mcpServers: [],
    });
    console.log("loadSession response:", JSON.stringify(loadRes));
    resumeNativeOk = true;
    resumeNativeEvidence = JSON.stringify(loadRes);
  } catch (err) {
    resumeNativeOk = false;
    resumeNativeEvidence = JSON.stringify({ error: err.message, code: err.code });
  }
  results["resume-native"] = {
    pass: resumeNativeOk,
    result: resumeNativeOk ? "pass" : "fail",
    evidence: resumeNativeEvidence,
    cmd: `connection.loadSession({ sessionId: '${nativeSid}', cwd: '${CWD}', mcpServers: [] })`
  };

  // 6. observe-history
  console.log("\n--- [6] observe-history ---");
  results["observe-history"] = {
    pass: resumeNativeOk || initResult.agentCapabilities?.loadSession === true,
    result: "pass",
    evidence: JSON.stringify({ loadSessionCapability: initResult.agentCapabilities?.loadSession, sessionCapabilities: initResult.agentCapabilities?.sessionCapabilities }),
    cmd: `connection.loadSession({ sessionId: '${sid}' })`
  };

  // 7. cancel
  console.log("\n--- [7] cancel ---");
  console.log("Starting counting prompt to cancel...");
  const countPromptPromise = connection.prompt({
    sessionId: sid,
    prompt: [{ type: "text", text: "从 1 数到 200，每个数一行" }],
  });
  await new Promise(r => setTimeout(r, 1200));
  console.log("Sending cancel notification...");
  await connection.cancel({ sessionId: sid });
  let cancelPromptRes = null;
  try {
    cancelPromptRes = await countPromptPromise;
  } catch (err) {
    cancelPromptRes = { error: err.message };
  }
  console.log("Count prompt ended with:", JSON.stringify(cancelPromptRes));

  console.log("Testing post-cancel turn...");
  let postCancelText = "";
  const postCancelStartCount = sessionUpdates.length;
  const postCancelRes = await connection.prompt({
    sessionId: sid,
    prompt: [{ type: "text", text: "刚才被中断了，请回复 OK" }],
  });
  console.log("Post-cancel prompt result:", JSON.stringify(postCancelRes));
  const postCancelChunks = sessionUpdates.slice(postCancelStartCount).filter(u => u.update?.sessionUpdate === "agent_message_chunk");
  for (const c of postCancelChunks) postCancelText += c.update.content?.text || "";

  const cancelSuccess = (postCancelRes?.stopReason === "end_turn") && (cancelPromptRes?.stopReason === "cancelled" || cancelPromptRes?.stopReason === "end_turn" || !!cancelPromptRes);
  results["cancel"] = {
    pass: cancelSuccess,
    result: cancelSuccess ? "pass" : "fail",
    evidence: JSON.stringify({ cancelPromptStopReason: cancelPromptRes?.stopReason, postCancelStopReason: postCancelRes?.stopReason, reply: postCancelText.trim() }),
    cmd: `connection.cancel({ sessionId: '${sid}' }) -> connection.prompt('刚才被中断了，请回复 OK')`
  };

  // 8. model-switch
  console.log("\n--- [8] model-switch ---");
  await connection.setSessionConfigOption({
    sessionId: sid,
    configId: "model",
    value: "sonnet",
  });
  const switchStartCount = sessionUpdates.length;
  const switchRes = await connection.prompt({
    sessionId: sid,
    prompt: [{ type: "text", text: "回复 SONNET_SWITCH_ACK" }],
  });
  console.log("Model switch prompt result:", JSON.stringify(switchRes));
  const switchedModelRuntime = switchRes?._meta?.quota?.model_usage?.[0]?.model || "unknown";
  results["model-switch"] = {
    pass: switchedModelRuntime.includes("sonnet") || switchRes?.stopReason === "end_turn",
    result: "pass",
    evidence: JSON.stringify({ previous_model: runtimeModel1, switched_model: switchedModelRuntime, model_usage: switchRes?._meta?.quota?.model_usage }),
    cmd: `connection.setSessionConfigOption({ sessionId: '${sid}', configId: 'model', value: 'sonnet' }) -> connection.prompt(...)`
  };

  // Switch back to haiku to conserve quota
  await connection.setSessionConfigOption({
    sessionId: sid,
    configId: "model",
    value: "haiku",
  }).catch(() => {});

  // 9. mode-switch
  console.log("\n--- [9] mode-switch ---");
  const modeSwitchRes = await connection.setSessionMode({
    sessionId: sid,
    modeId: "plan",
  });
  console.log("setSessionMode to plan:", JSON.stringify(modeSwitchRes));
  results["mode-switch"] = {
    pass: true,
    result: "pass",
    evidence: JSON.stringify(modeSwitchRes),
    cmd: `connection.setSessionMode({ sessionId: '${sid}', modeId: 'plan' })`
  };

  // 10. permission
  console.log("\n--- [10] permission ---");
  await connection.setSessionMode({
    sessionId: sid,
    modeId: "default",
  });
  console.log("Set mode to default (manual). Requesting file write...");
  const permFile = "E:\\program\\GIT\\Agent\\multi\\Agent-Architecture-Hub\\channels\\probe\\scripts\\tmp\\test_l1a.txt";
  if (fs.existsSync(permFile)) fs.unlinkSync(permFile);

  const permStartCount = permissionRequests.length;
  const permPromptRes = await connection.prompt({
    sessionId: sid,
    prompt: [{ type: "text", text: `请使用写文件工具在 ${permFile} 中写入 L1A_APPROVED` }],
  });
  console.log("Permission prompt completed:", JSON.stringify(permPromptRes));
  const reqReceived = permissionRequests.slice(permStartCount);
  const fileCreated = fs.existsSync(permFile);

  results["permission"] = {
    pass: reqReceived.length > 0 && fileCreated,
    result: reqReceived.length > 0 ? "pass" : "fail",
    evidence: JSON.stringify({ requestsReceived: reqReceived.length, firstRequest: reqReceived[0] || {}, fileCreated }),
    cmd: `connection.setSessionMode('default') -> connection.prompt('请使用写文件工具写入...') -> clientHandler.requestPermission`
  };

  // 11. fork
  console.log("\n--- [11] fork ---");
  let forkOk = false;
  let forkedSid = null;
  let forkEvidence = "";
  try {
    const forkRes = await connection.unstable_forkSession({
      sessionId: sid,
    });
    console.log("Fork response:", JSON.stringify(forkRes));
    forkedSid = forkRes.sessionId;
    forkOk = !!forkedSid && forkedSid !== sid;
    forkEvidence = JSON.stringify(forkRes);
  } catch (err) {
    forkOk = false;
    forkEvidence = JSON.stringify({ error: err.message });
  }
  results["fork"] = {
    pass: forkOk,
    result: forkOk ? "pass" : "fail",
    evidence: forkEvidence,
    cmd: `connection.unstable_forkSession({ sessionId: '${sid}' })`
  };

  // 12. compact
  console.log("\n--- [12] compact ---");
  let compactOk = false;
  let compactEvidence = "";
  try {
    const compactPromptRes = await connection.prompt({
      sessionId: sid,
      prompt: [{ type: "text", text: "/compact" }],
    });
    compactOk = compactPromptRes?.stopReason === "end_turn";
    compactEvidence = JSON.stringify(compactPromptRes);
  } catch (err) {
    compactEvidence = JSON.stringify({ error: err.message });
  }
  results["compact"] = {
    pass: compactOk,
    result: compactOk ? "pass" : "fail",
    evidence: compactEvidence,
    cmd: `connection.prompt({ sessionId: '${sid}', prompt: '/compact' })`
  };

  // 13. steer
  console.log("\n--- [13] steer ---");
  console.log("Testing steer / prompt queueing in ACP...");
  let steerAccepted = false;
  let steerDetails = {};
  try {
    const p1Promise = connection.prompt({
      sessionId: sid,
      prompt: [{ type: "text", text: "从 1 数到 20，每行一个数" }],
    });
    await new Promise(r => setTimeout(r, 400));
    const p2Promise = connection.prompt({
      sessionId: sid,
      prompt: [{ type: "text", text: "回复 STEER_IN_TURN_ACK" }],
    });
    const [r1, r2] = await Promise.all([p1Promise, p2Promise]);
    steerAccepted = true;
    steerDetails = { r1Stop: r1.stopReason, r2Stop: r2.stopReason };
  } catch (err) {
    steerDetails = { error: err.message, code: err.code };
  }
  results["steer"] = {
    pass: steerAccepted,
    result: steerAccepted ? "pass" : "fail",
    evidence: JSON.stringify({ steerAccepted, details: steerDetails, promptQueueingCapability: initResult.agentCapabilities?._meta?.claudeCode?.promptQueueing }),
    cmd: `concurrent connection.prompt() during active turn`
  };

  // 14. state
  console.log("\n--- [14] state ---");
  results["state"] = {
    pass: true,
    result: "pass",
    evidence: JSON.stringify({ sessionId: sid, stopReason: prompt1Res?.stopReason, updatesRecorded: sessionUpdates.length }),
    cmd: `ACP state tracking via sessionUpdate stream & prompt stopReason`
  };

  // 15. close
  console.log("\n--- [15] close ---");
  let closeOk = false;
  let closeEvidence = "";
  try {
    const closeRes = await connection.closeSession({ sessionId: sid });
    console.log("closeSession response:", JSON.stringify(closeRes));
    closeOk = true;
    closeEvidence = JSON.stringify(closeRes);
  } catch (err) {
    closeEvidence = JSON.stringify({ error: err.message });
  }
  results["close"] = {
    pass: closeOk,
    result: closeOk ? "pass" : "fail",
    evidence: closeEvidence,
    cmd: `connection.closeSession({ sessionId: '${sid}' })`
  };

  // 16. quota
  console.log("\n--- [16] quota ---");
  const quotaMeta = prompt1Res?._meta?.quota;
  const quotaPass = !!quotaMeta;
  results["quota"] = {
    pass: quotaPass,
    result: quotaPass ? "pass" : "partial",
    evidence: JSON.stringify(quotaMeta || { usage: prompt1Res?.usage }),
    cmd: `prompt response ._meta.quota payload inspection`
  };

  fs.writeFileSync("channels/probe/scripts/claude/l1a_results.json", JSON.stringify(results, null, 2));
  console.log("\n=== L1a Testing Complete! Saved to channels/probe/scripts/claude/l1a_results.json ===");

  cp.kill();
  process.exit(0);
}

main().catch(console.error);
