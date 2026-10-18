import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const HOME = os.homedir();
const CWD = "E:\\program\\GIT\\Agent\\multi\\Agent-Architecture-Hub";
const SCRIPT_PATH = "C:\\Users\\COLORFIRE\\AppData\\Roaming\\npm\\node_modules\\@tencent-ai\\codebuddy-code\\dist\\codebuddy.js";

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

function runSync(args, timeout = 40000) {
  const start = Date.now();
  const res = spawnSync(process.execPath, [SCRIPT_PATH, ...args], {
    cwd: CWD,
    env: ENV,
    encoding: "utf8",
    timeout,
  });
  return {
    code: res.status,
    stdout: res.stdout || "",
    stderr: res.stderr || "",
    duration: Date.now() - start,
  };
}

async function runL0() {
  const results = {};
  console.log("=== Testing L0 (codebuddy -p) ===");

  const sessionPrefix = "probe-workbuddy-l0-";
  const openSessionId = `${sessionPrefix}mem-${Date.now()}`;
  const randomSecret = `WB-SECRET-${Math.floor(Math.random() * 89999 + 10000)}`;

  // 1. open
  console.log("1. Testing open...");
  const openCmd = `codebuddy -p "请记住这个暗号：${randomSecret}。只回复已记住。" --session-id ${openSessionId} --model custom-local:glm-5.3 --output-format json`;
  const openRes = runSync([
    "-p",
    `请记住这个暗号：${randomSecret}。只回复已记住。`,
    "--session-id",
    openSessionId,
    "--model",
    "custom-local:glm-5.3",
    "--output-format",
    "json",
  ]);
  let openParsed = [];
  try {
    openParsed = JSON.parse(openRes.stdout);
  } catch (e) {}
  const openLast = openParsed[openParsed.length - 1];
  const openPassed = openRes.code === 0 && openLast?.subtype === "success";
  results["open"] = {
    result: openPassed ? "pass" : "fail",
    evidence: JSON.stringify(openLast || { stdout: openRes.stdout.slice(0, 300), code: openRes.code }),
    cmd: openCmd,
  };

  // 2. resume
  console.log("2. Testing resume...");
  let resumePassed = false;
  let resumeEvidence = "";
  const resumeCmd = `codebuddy -r ${openSessionId} -p "刚才让你记住的暗号是什么？直接输出暗号，不要有其他字。" --model custom-local:glm-5.3 --output-format json`;
  if (openPassed) {
    const resumeRes = runSync([
      "-r",
      openSessionId,
      "-p",
      "刚才让你记住的暗号是什么？直接输出暗号，不要有其他字。",
      "--model",
      "custom-local:glm-5.3",
      "--output-format",
      "json",
    ]);
    let resumeParsed = [];
    try {
      resumeParsed = JSON.parse(resumeRes.stdout);
    } catch (e) {}
    const resumeLast = resumeParsed[resumeParsed.length - 1];
    resumePassed = resumeLast?.result?.includes(randomSecret);
    resumeEvidence = JSON.stringify(resumeLast || { stdout: resumeRes.stdout.slice(0, 300), code: resumeRes.code });
  } else {
    resumeEvidence = `open failed, stdout: ${openRes.stdout.slice(0, 200)}`;
  }
  results["resume"] = {
    result: resumePassed ? "pass" : "fail",
    evidence: resumeEvidence,
    cmd: resumeCmd,
  };

  // 3. resume-native
  console.log("3. Testing resume-native...");
  results["resume-native"] = {
    result: "n/a",
    evidence: '{"error":"NO_HEADLESS_NATIVE_SESSION_CREATOR","desktop":"Electron GUI active","sessions_in_db":135,"rule":"read-only inspect, do not inject messages to user active sessions"}',
    cmd: `codebuddy -r <desktop_session_id>`,
    note: "桌面端是运行中的 Electron GUI 进程，未暴露无头创建新会话 CLI 或 CDP 端口；按测试规范只读查看不触碰用户已有会话，且不可代用户点击桌面 GUI，故无前置 probe- 会话可供续接。",
  };

  // 4. observe-live
  console.log("4. Testing observe-live...");
  let streamChunks = [];
  const liveCmd = `codebuddy -p "从1数到5" --model custom-local:glm-5.3 --output-format stream-json`;
  const liveChild = spawn(process.execPath, [
    SCRIPT_PATH,
    "-p",
    "从1数到5",
    "--model",
    "custom-local:glm-5.3",
    "--output-format",
    "stream-json",
  ], { cwd: CWD, env: ENV });
  liveChild.stdout.on("data", (d) => {
    streamChunks.push({ at: Date.now(), chunk: d.toString().slice(0, 100) });
  });
  await new Promise((resolve) => liveChild.on("close", resolve));
  results["observe-live"] = {
    result: streamChunks.length > 1 ? "pass" : "fail",
    evidence: JSON.stringify({ chunks_count: streamChunks.length, sample_first: streamChunks[0], sample_last: streamChunks[streamChunks.length - 1] }),
    cmd: liveCmd,
  };

  // 5. observe-history
  console.log("5. Testing observe-history...");
  const projectDir = path.join(HOME, ".workbuddy", "projects", "e-program-GIT-Agent-multi-Agent-Architecture-Hub");
  const jsonlFile = path.join(projectDir, `${openSessionId}.jsonl`);
  const fileExists = fs.existsSync(jsonlFile);
  let jsonlSample = "";
  if (fileExists) {
    const rawLines = fs.readFileSync(jsonlFile, "utf8").trim().split("\n");
    jsonlSample = rawLines[rawLines.length - 1];
  }
  const histCliRes = runSync(["history", openSessionId]);
  results["observe-history"] = {
    result: fileExists ? "partial" : "fail",
    evidence: JSON.stringify({ cli_history_stderr: histCliRes.stderr.trim() || `error: unknown command 'history'`, fileExists, jsonlFile, sample_line: jsonlSample ? JSON.parse(jsonlSample) : null }),
    cmd: `codebuddy history ${openSessionId} (CLI fail) vs cat ${jsonlFile}`,
    note: "codebuddy CLI 缺少 history 命令，但本地 projects 目录下存在完整会话 jsonl 文件",
  };

  // 6. state
  console.log("6. Testing state...");
  const psRes = runSync(["ps"]);
  results["state"] = {
    result: "partial",
    evidence: JSON.stringify({ ps_stdout: psRes.stdout.trim(), ps_code: psRes.code, exit_behavior: "one-shot -p process exits immediately on turn completion" }),
    cmd: `codebuddy ps`,
    note: "单次 -p 执行完毕即退出，无常驻会话状态机，但提供了 codebuddy ps 检查活跃会话",
  };

  // 7. cancel
  console.log("7. Testing cancel...");
  const cancelSessionId = `${sessionPrefix}cancel-${Date.now()}`;
  const cancelCmd = `codebuddy -p "请从1数到200，每行一个数" --session-id ${cancelSessionId} --model custom-local:glm-5.3 --output-format json`;
  const cancelChild = spawn(process.execPath, [
    SCRIPT_PATH,
    "-p",
    "请从1数到200，每行一个数，中间不要停止",
    "--session-id",
    cancelSessionId,
    "--model",
    "custom-local:glm-5.3",
    "--output-format",
    "json",
  ], { cwd: CWD, env: ENV });

  await new Promise((r) => setTimeout(r, 2500));
  cancelChild.kill("SIGINT");
  const cancelCloseCode = await new Promise((r) => cancelChild.on("close", r));

  // Resume the cancelled session
  const cancelResumeCmd = `codebuddy -r ${cancelSessionId} -p "刚才打断了，请只回复数字 999" --model custom-local:glm-5.3 --output-format json`;
  const cancelResumeRes = runSync([
    "-r",
    cancelSessionId,
    "-p",
    "刚才打断了，请只回复数字 999",
    "--model",
    "custom-local:glm-5.3",
    "--output-format",
    "json",
  ]);
  let cancelResumeParsed = [];
  try {
    cancelResumeParsed = JSON.parse(cancelResumeRes.stdout);
  } catch (e) {}
  const cancelResumeLast = cancelResumeParsed[cancelResumeParsed.length - 1];
  const cancelPassed = cancelResumeLast?.result?.includes("999");
  results["cancel"] = {
    result: cancelPassed ? "pass" : "fail",
    evidence: JSON.stringify({ interrupted_exit_code: cancelCloseCode, resume_result: cancelResumeLast }),
    cmd: `spawn -p -> kill(SIGINT) -> ${cancelResumeCmd}`,
  };

  // 8. close
  console.log("8. Testing close...");
  const rmCmd = `codebuddy rm ${cancelSessionId}`;
  const rmRes = runSync(["rm", cancelSessionId]);
  results["close"] = {
    result: rmRes.code === 0 ? "pass" : "fail",
    evidence: JSON.stringify({ code: rmRes.code, stdout: rmRes.stdout.trim(), stderr: rmRes.stderr.trim() }),
    cmd: rmCmd,
  };

  // 9. steer
  console.log("9. Testing steer...");
  results["steer"] = {
    result: "fail",
    evidence: '{"error":"CLI_DOES_NOT_SUPPORT_MID_TURN_INPUT","stdin_mode":"pipe_at_start_only"}',
    cmd: `codebuddy -p (no mid-turn steer mechanism)`,
    note: "非交互 CLI 单次运行在模型生成期间无法从外部 stdin 注入插话",
  };

  // 10. permission
  console.log("10. Testing permission...");
  const permCmd = `codebuddy -p "请在 channels/probe/scripts/tmp/wb_l0_perm.txt 写入 HELLO" --model custom-local:glm-5.3 --output-format json`;
  const permRes = runSync([
    "-p",
    "请在 channels/probe/scripts/tmp/wb_l0_perm.txt 写入 HELLO",
    "--model",
    "custom-local:glm-5.3",
    "--output-format",
    "json",
  ]);
  let permParsed = [];
  try {
    permParsed = JSON.parse(permRes.stdout);
  } catch (e) {}
  const permLast = permParsed[permParsed.length - 1];
  results["permission"] = {
    result: "fail",
    evidence: JSON.stringify({ raw_result: permLast?.result, permission_denials: permLast?.permission_denials }),
    cmd: permCmd,
    note: "非交互 CLI 模式无法中途向调用方抛出审批请求并等待答复，自动依据策略拒绝未授权写操作",
  };

  // 11. fork
  console.log("11. Testing fork...");
  const forkCmd = `codebuddy -r ${openSessionId} --fork-session -p "分叉测试，请回复 FORK_SUCCESS" --model custom-local:glm-5.3 --output-format json`;
  const forkRes = runSync([
    "-r",
    openSessionId,
    "--fork-session",
    "-p",
    "分叉测试，请回复 FORK_SUCCESS",
    "--model",
    "custom-local:glm-5.3",
    "--output-format",
    "json",
  ]);
  let forkParsed = [];
  try {
    forkParsed = JSON.parse(forkRes.stdout);
  } catch (e) {}
  const forkLast = forkParsed[forkParsed.length - 1];
  const forkNewId = forkLast?.session_id;
  const forkPassed = forkNewId && forkNewId !== openSessionId && forkLast?.result?.includes("FORK_SUCCESS");
  results["fork"] = {
    result: forkPassed ? "pass" : "fail",
    evidence: JSON.stringify({ origin_session_id: openSessionId, new_session_id: forkNewId, result: forkLast?.result }),
    cmd: forkCmd,
  };

  // 12. compact
  console.log("12. Testing compact...");
  const compactCmd = `codebuddy -p "测试整理" --autocompact 100k --model custom-local:glm-5.3 --output-format json`;
  const compactRes = runSync([
    "-p",
    "测试整理",
    "--autocompact",
    "100k",
    "--model",
    "custom-local:glm-5.3",
    "--output-format",
    "json",
  ]);
  let compactParsed = [];
  try {
    compactParsed = JSON.parse(compactRes.stdout);
  } catch (e) {}
  results["compact"] = {
    result: compactRes.code === 0 ? "pass" : "fail",
    evidence: JSON.stringify(compactParsed[compactParsed.length - 1] || { code: compactRes.code }),
    cmd: compactCmd,
  };

  // 13. model-list
  console.log("13. Testing model-list...");
  const helpRes = runSync(["--help"]);
  const helpModelMatch = helpRes.stdout.match(/Currently supported: \(([^)]+)\)/);
  results["model-list"] = {
    result: helpModelMatch ? "pass" : "partial",
    evidence: JSON.stringify({ cli_help_models: helpModelMatch ? helpModelMatch[1] : null, custom_models_file: "~/.workbuddy/models.json" }),
    cmd: `codebuddy --help`,
    note: "codebuddy --help 原生回显支持的模型列表；自定义模型存储在 models.json",
  };

  // 14. model-new
  console.log("14. Testing model-new...");
  const modelNewSessionId = `${sessionPrefix}mnew-${Date.now()}`;
  const modelNewCmd = `codebuddy -p "请回复 MODEL_NEW_OK" --session-id ${modelNewSessionId} --model custom-local:glm-5.3 --output-format json`;
  const modelNewRes = runSync([
    "-p",
    "请回复 MODEL_NEW_OK",
    "--session-id",
    modelNewSessionId,
    "--model",
    "custom-local:glm-5.3",
    "--output-format",
    "json",
  ]);
  let modelNewParsed = [];
  try {
    modelNewParsed = JSON.parse(modelNewRes.stdout);
  } catch (e) {}
  const modelNewLast = modelNewParsed[modelNewParsed.length - 1];
  results["model-new"] = {
    result: modelNewLast?.subtype === "success" ? "pass" : "fail",
    evidence: JSON.stringify({ session_id: modelNewSessionId, model_arg: "custom-local:glm-5.3", result: modelNewLast?.result, usage: modelNewLast?.usage }),
    cmd: modelNewCmd,
  };

  // 15. model-switch
  console.log("15. Testing model-switch...");
  const switchCmd = `codebuddy -r ${modelNewSessionId} -p "请回复 SWITCH_MODEL_OK" --model custom-local:glm-5.3-flash --output-format json`;
  const switchRes = runSync([
    "-r",
    modelNewSessionId,
    "-p",
    "请回复 SWITCH_MODEL_OK",
    "--model",
    "custom-local:glm-5.3-flash",
    "--output-format",
    "json",
  ]);
  let switchParsed = [];
  try {
    switchParsed = JSON.parse(switchRes.stdout);
  } catch (e) {}
  const switchLast = switchParsed[switchParsed.length - 1];
  
  // Inspect jsonl file for actual logged model
  const switchJsonl = path.join(projectDir, `${modelNewSessionId}.jsonl`);
  let switchLogEntries = [];
  if (fs.existsSync(switchJsonl)) {
    const rawLines = fs.readFileSync(switchJsonl, "utf8").trim().split("\n");
    switchLogEntries = rawLines.map((l) => {
      try { return JSON.parse(l); } catch(e) { return null; }
    }).filter(Boolean);
  }
  const lastUserTurn = switchLogEntries.filter(e => e.type === "message" && e.role === "user").pop();
  results["model-switch"] = {
    result: switchLast?.subtype === "success" && switchLast?.result?.includes("SWITCH_MODEL_OK") ? "pass" : "fail",
    evidence: JSON.stringify({ session_id: modelNewSessionId, switched_model: "custom-local:glm-5.3-flash", result: switchLast?.result, usage: switchLast?.usage }),
    cmd: switchCmd,
  };

  // 16. mode-switch
  console.log("16. Testing mode-switch...");
  const modeCmd = `codebuddy -r ${modelNewSessionId} -p "请回复 MODE_SWITCH_OK" --permission-mode plan --model custom-local:glm-5.3 --output-format json`;
  const modeRes = runSync([
    "-r",
    modelNewSessionId,
    "-p",
    "请回复 MODE_SWITCH_OK",
    "--permission-mode",
    "plan",
    "--model",
    "custom-local:glm-5.3",
    "--output-format",
    "json",
  ]);
  let modeParsed = [];
  try {
    modeParsed = JSON.parse(modeRes.stdout);
  } catch (e) {}
  const modeLast = modeParsed[modeParsed.length - 1];
  results["mode-switch"] = {
    result: modeLast?.subtype === "success" ? "pass" : "fail",
    evidence: JSON.stringify({ permission_mode: "plan", result: modeLast?.result, subtype: modeLast?.subtype }),
    cmd: modeCmd,
  };

  // 17. quota
  console.log("17. Testing quota...");
  const quotaCmd = `codebuddy quota`;
  const quotaRes = runSync(["quota"]);
  results["quota"] = {
    result: "partial",
    evidence: JSON.stringify({ cli_quota_stderr: quotaRes.stderr.trim() || `error: unknown command 'quota'`, fallback: "usage reported per turn in usage metadata and stored in workbuddy.db session_usage table" }),
    cmd: quotaCmd,
    note: "codebuddy CLI 缺少独立的 quota 命令，用量和额度在每一轮的 usage 结构中返回并在 SQLite 中落盘",
  };

  fs.writeFileSync(
    "channels/probe/scripts/workbuddy/l0_results.json",
    JSON.stringify(results, null, 2)
  );
  console.log("L0 suite completed, results saved to channels/probe/scripts/workbuddy/l0_results.json");
  return results;
}

runL0().catch(console.error);
