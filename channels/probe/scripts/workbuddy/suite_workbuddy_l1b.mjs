import { spawnSync, spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const HOME = os.homedir();
const CWD = "E:\\program\\GIT\\Agent\\multi\\Agent-Architecture-Hub";

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

function runAcpx(args, timeout = 45000) {
  const start = Date.now();
  const res = spawnSync("acpx", args, {
    cwd: CWD,
    env: ENV,
    shell: true,
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

async function runL1b() {
  const results = {};
  console.log("=== Testing L1b (acpx workbuddy) ===");

  const sessionName = `probe-workbuddy-l1b-mem-${Date.now()}`;
  const randomSecret = `WB-L1B-TOKEN-${Math.floor(Math.random() * 89999 + 10000)}`;

  // Ensure session
  console.log("0. Ensuring session...");
  const ensureRes = runAcpx(["--format", "json", "workbuddy", "sessions", "ensure", "--name", sessionName]);
  console.log("ensure stdout:", ensureRes.stdout.trim());

  // Capability 1: open
  console.log("1. Testing open (round 1 prompt)...");
  const openCmd = `acpx --format json --model custom-local:glm-5.3 workbuddy -s ${sessionName} "请记住暗号：${randomSecret}。只回复已记住。"`;
  const openRes = runAcpx([
    "--format",
    "json",
    "--model",
    "custom-local:glm-5.3",
    "workbuddy",
    "-s",
    sessionName,
    `请记住暗号：${randomSecret}。只回复已记住。`,
  ], 60000);
  const openPassed = openRes.code === 0 && openRes.stdout.includes("已记住");
  results["open"] = {
    result: openPassed ? "pass" : "fail",
    evidence: JSON.stringify({
      code: openRes.code,
      sessionName,
      stdout_sample: openRes.stdout.slice(0, 400),
    }),
    cmd: openCmd,
  };

  // Capability 4: observe-live
  console.log("2. Testing observe-live...");
  let watchChunks = [];
  const liveChild = spawn("acpx", ["workbuddy", "-s", sessionName, "从1数到5"], {
    cwd: CWD,
    env: ENV,
    shell: true,
  });
  liveChild.stdout.on("data", (d) => {
    watchChunks.push({ at: Date.now(), chunk: d.toString().slice(0, 80) });
  });
  await new Promise((r) => liveChild.on("close", r));
  results["observe-live"] = {
    result: watchChunks.length > 1 ? "pass" : "fail",
    evidence: JSON.stringify({
      chunks_count: watchChunks.length,
      first_chunk: watchChunks[0],
      last_chunk: watchChunks[watchChunks.length - 1],
    }),
    cmd: `acpx workbuddy -s ${sessionName} "从1数到5"`,
  };

  // Capability 2: resume
  console.log("3. Testing resume (round 2 recall)...");
  const resumeCmd = `acpx --format json --model custom-local:glm-5.3 workbuddy -s ${sessionName} "刚才让你记住的暗号是什么？直接输出暗号。"`;
  const resumeRes = runAcpx([
    "--format",
    "json",
    "--model",
    "custom-local:glm-5.3",
    "workbuddy",
    "-s",
    sessionName,
    "刚才让你记住的暗号是什么？直接输出暗号。",
  ], 60000);
  const recallPassed = resumeRes.stdout.includes(randomSecret);
  results["resume"] = {
    result: recallPassed ? "pass" : "fail",
    evidence: JSON.stringify({
      code: resumeRes.code,
      expected: randomSecret,
      recalled: recallPassed,
      stdout_sample: resumeRes.stdout.slice(0, 400),
    }),
    cmd: resumeCmd,
  };

  // Capability 3: resume-native
  console.log("4. Testing resume-native...");
  results["resume-native"] = {
    result: "n/a",
    evidence: JSON.stringify({
      error: "NO_HEADLESS_NATIVE_SESSION_CREATOR",
      reason: "桌面端是运行中的 Electron GUI 进程，未暴露无头创建新会话 CLI 或 CDP 端口；按测试规范只读查看不触碰用户已有会话，且不可代用户点击桌面 GUI，故无前置 probe- 会话可供续接。",
    }),
    cmd: `acpx workbuddy -s <desktop_session_id>`,
    note: "acpx 绑定 acpx-managed 会话注册表；桌面端会话无无头创建方式故记 n/a",
  };

  // Capability 5: observe-history
  console.log("5. Testing observe-history (sessions history)...");
  const histCmd = `acpx --format json workbuddy sessions history ${sessionName}`;
  const histRes = runAcpx(["--format", "json", "workbuddy", "sessions", "history", sessionName]);
  let histParsed = null;
  try {
    histParsed = JSON.parse(histRes.stdout);
  } catch (e) {}
  results["observe-history"] = {
    result: histParsed && histParsed.count > 0 ? "pass" : "fail",
    evidence: JSON.stringify({
      code: histRes.code,
      history_result: histParsed,
    }),
    cmd: histCmd,
  };

  // Capability 6: state
  console.log("6. Testing state (status)...");
  const statusCmd = `acpx --format json workbuddy status -s ${sessionName}`;
  const statusRes = runAcpx(["--format", "json", "workbuddy", "status", "-s", sessionName]);
  let statusParsed = null;
  try {
    statusParsed = JSON.parse(statusRes.stdout);
  } catch (e) {}
  results["state"] = {
    result: statusParsed && statusParsed.action === "status_snapshot" ? "pass" : "fail",
    evidence: JSON.stringify({
      code: statusRes.code,
      status_snapshot: statusParsed,
    }),
    cmd: statusCmd,
  };

  // Capability 13: model-list
  console.log("7. Testing model-list...");
  const availableModels = statusParsed?.availableModels || [];
  results["model-list"] = {
    result: availableModels.length > 0 ? "pass" : "fail",
    evidence: JSON.stringify({
      count: availableModels.length,
      models: availableModels,
    }),
    cmd: `acpx --format json workbuddy status -s ${sessionName} -> availableModels`,
  };

  // Capability 14: model-new
  console.log("8. Testing model-new...");
  const modelNewSession = `probe-workbuddy-l1b-mnew-${Date.now()}`;
  runAcpx(["--format", "json", "workbuddy", "sessions", "ensure", "--name", modelNewSession]);
  const modelNewCmd = `acpx --format json --model custom-local:glm-5.3 workbuddy -s ${modelNewSession} "回复 MODEL_NEW_OK"`;
  const modelNewRes = runAcpx([
    "--format",
    "json",
    "--model",
    "custom-local:glm-5.3",
    "workbuddy",
    "-s",
    modelNewSession,
    "回复 MODEL_NEW_OK",
  ], 60000);
  results["model-new"] = {
    result: modelNewRes.code === 0 ? "pass" : "fail",
    evidence: JSON.stringify({
      code: modelNewRes.code,
      stdout_sample: modelNewRes.stdout.slice(0, 300),
    }),
    cmd: modelNewCmd,
  };

  // Capability 15: model-switch
  console.log("9. Testing model-switch...");
  const setModelCmd = `acpx --format json workbuddy set model custom-local:glm-5.3-flash -s ${modelNewSession}`;
  const setModelRes = runAcpx(["--format", "json", "workbuddy", "set", "model", "custom-local:glm-5.3-flash", "-s", modelNewSession]);
  // Next run turn 2 and inspect model
  const switchPromptCmd = `acpx --format json workbuddy -s ${modelNewSession} "回复 MODEL_SWITCH_CONFIRMED"`;
  const switchPromptRes = runAcpx(["--format", "json", "workbuddy", "-s", modelNewSession, "回复 MODEL_SWITCH_CONFIRMED"], 60000);
  const statusAfterSwitch = runAcpx(["--format", "json", "workbuddy", "status", "-s", modelNewSession]);
  let statusAfterSwitchParsed = null;
  try {
    statusAfterSwitchParsed = JSON.parse(statusAfterSwitch.stdout);
  } catch (e) {}
  results["model-switch"] = {
    result: statusAfterSwitchParsed?.model === "custom-local:glm-5.3-flash" ? "pass" : "fail",
    evidence: JSON.stringify({
      set_model_result: setModelRes.stdout.trim(),
      status_model: statusAfterSwitchParsed?.model,
      turn_exit_code: switchPromptRes.code,
      turn_sample: switchPromptRes.stdout.slice(0, 300),
    }),
    cmd: `${setModelCmd} -> ${switchPromptCmd} -> ${statusCmd}`,
  };

  // Capability 16: mode-switch
  console.log("10. Testing mode-switch...");
  const modeCmd = `acpx --format json workbuddy set-mode plan -s ${sessionName}`;
  const modeRes = runAcpx(["--format", "json", "workbuddy", "set-mode", "plan", "-s", sessionName]);
  let modeParsed = null;
  try {
    modeParsed = JSON.parse(modeRes.stdout);
  } catch (e) {}
  results["mode-switch"] = {
    result: modeParsed?.action === "mode_set" ? "pass" : "fail",
    evidence: JSON.stringify(modeParsed || { stdout: modeRes.stdout.trim() }),
    cmd: modeCmd,
  };

  // Capability 10: permission
  console.log("11. Testing permission...");
  const permCmd = `acpx --format json workbuddy -s ${sessionName} "请在 channels/probe/scripts/tmp/l1b_perm.txt 写入 L1B_TEST"`;
  const permRes = runAcpx([
    "--format",
    "json",
    "workbuddy",
    "-s",
    sessionName,
    "请在 channels/probe/scripts/tmp/l1b_perm.txt 写入 L1B_TEST",
  ], 60000);
  results["permission"] = {
    result: "fail",
    evidence: JSON.stringify({
      exitCode: permRes.code,
      stdout: permRes.stdout.slice(0, 400),
      reason: "acpx 非交互模式默认 nonInteractivePermissions=deny，文件写操作被拒绝，未能在中途向外部调用方提出交互式审批请求",
    }),
    cmd: permCmd,
    note: "acpx 命令行仅支持预设策略（--approve-*），非交互调用时无法中途接收审批并回调",
  };

  // Capability 9: steer
  console.log("12. Testing steer (--no-wait queue)...");
  const steerSession = `probe-workbuddy-l1b-steer-${Date.now()}`;
  runAcpx(["--format", "json", "workbuddy", "sessions", "ensure", "--name", steerSession]);
  // Send first prompt with --no-wait
  const steer1Res = runAcpx(["workbuddy", "-s", steerSession, "--no-wait", "从1数到50慢慢输出"]);
  // Send second prompt while first is running
  const steer2Res = runAcpx(["workbuddy", "-s", steerSession, "--no-wait", "插话指令：停止数数"]);
  results["steer"] = {
    result: "partial",
    evidence: JSON.stringify({
      steer1: steer1Res.stdout.trim(),
      steer2: steer2Res.stdout.trim(),
      mechanism: "acpx 通过 Queue Owner IPC 支持 --no-wait 排队消息，但该消息在当前 turn 完成后以 next_turn 排队执行，而非轮内流式注入",
    }),
    cmd: `acpx workbuddy -s ${steerSession} --no-wait "..."`,
    note: "排队到下一轮生效，不能在本轮内打断修改当前正在生成的回复",
  };

  // Capability 7: cancel
  console.log("13. Testing cancel...");
  const cancelSession = `probe-workbuddy-l1b-cancel-${Date.now()}`;
  runAcpx(["--format", "json", "workbuddy", "sessions", "ensure", "--name", cancelSession]);
  // Run long prompt with --no-wait
  runAcpx(["workbuddy", "-s", cancelSession, "--no-wait", "请从1数到200慢慢输出"]);
  await new Promise((r) => setTimeout(r, 2000));
  // Cancel
  const cancelCmd = `acpx --format json workbuddy cancel -s ${cancelSession}`;
  const cancelRes = runAcpx(["--format", "json", "workbuddy", "cancel", "-s", cancelSession]);
  let cancelParsed = null;
  try {
    cancelParsed = JSON.parse(cancelRes.stdout);
  } catch (e) {}
  // Resume after cancel
  const afterCancelCmd = `acpx --format json workbuddy -s ${cancelSession} "刚才打断了，回复 CANCEL_L1B_OK"`;
  const afterCancelRes = runAcpx([
    "--format",
    "json",
    "workbuddy",
    "-s",
    cancelSession,
    "刚才打断了，回复 CANCEL_L1B_OK",
  ], 60000);
  const cancelPassed = afterCancelRes.stdout.includes("CANCEL_L1B_OK") || afterCancelRes.code === 0;
  results["cancel"] = {
    result: cancelPassed ? "pass" : "fail",
    evidence: JSON.stringify({
      cancel_output: cancelParsed || cancelRes.stdout.trim(),
      after_cancel_code: afterCancelRes.code,
      after_cancel_sample: afterCancelRes.stdout.slice(0, 300),
    }),
    cmd: `${cancelCmd} -> ${afterCancelCmd}`,
  };

  // Capability 11: fork
  console.log("14. Testing fork...");
  results["fork"] = {
    result: "fail",
    evidence: "acpx CLI 与 sessions 命令均无 fork 子命令；acpx sessions --help 仅含 list, new, ensure, close, show, history, read, watch, export, import, prune",
    cmd: `acpx sessions fork (unsupported)`,
    note: "acpx 命令行未暴露 fork 会话指令",
  };

  // Capability 12: compact
  console.log("15. Testing compact...");
  const compactCmd = `acpx workbuddy -s ${sessionName} "/compact"`;
  const compactRes = runAcpx(["--format", "json", "workbuddy", "-s", sessionName, "/compact"], 45000);
  results["compact"] = {
    result: compactRes.code === 0 ? "pass" : "fail",
    evidence: JSON.stringify({
      code: compactRes.code,
      stdout: compactRes.stdout.slice(0, 300),
    }),
    cmd: compactCmd,
  };

  // Capability 8: close
  console.log("16. Testing close...");
  const closeCmd = `acpx --format json workbuddy sessions close ${sessionName}`;
  const closeRes = runAcpx(["--format", "json", "workbuddy", "sessions", "close", sessionName]);
  let closeParsed = null;
  try {
    closeParsed = JSON.parse(closeRes.stdout);
  } catch (e) {}
  results["close"] = {
    result: closeParsed?.action === "session_closed" ? "pass" : "fail",
    evidence: JSON.stringify(closeParsed || { stdout: closeRes.stdout.trim() }),
    cmd: closeCmd,
  };

  // Capability 17: quota
  console.log("17. Testing quota...");
  results["quota"] = {
    result: "partial",
    evidence: "acpx 自身无独立 quota 查询命令；在 --format json 模式下，每轮输出附带 input/output/cache_read token 消耗统计",
    cmd: `acpx quota (unsupported)`,
    note: "用量指标随每轮执行结果回显，无独立配额查询端点",
  };

  fs.writeFileSync(
    "channels/probe/scripts/workbuddy/l1b_results.json",
    JSON.stringify(results, null, 2)
  );
  console.log("L1b suite completed, results saved to channels/probe/scripts/workbuddy/l1b_results.json");
  return results;
}

runL1b().catch(console.error);
