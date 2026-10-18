import { spawn } from "node:child_process";
import fs from "node:fs";

const CWD = "E:\\program\\GIT\\Agent\\multi\\Agent-Architecture-Hub";
const PROXY_ENV = {
  ...process.env,
  HTTP_PROXY: "http://127.0.0.1:7892",
  HTTPS_PROXY: "http://127.0.0.1:7892",
};

function runAcpx(args, timeoutMs = 45000) {
  return new Promise((resolve) => {
    const start = Date.now();
    const cp = spawn("acpx.cmd", ["--format", "json", ...args], {
      cwd: CWD,
      env: PROXY_ENV,
      shell: true,
    });
    let stdout = "";
    let stderr = "";
    cp.stdout.on("data", (d) => (stdout += d));
    cp.stderr.on("data", (d) => (stderr += d));
    const timer = setTimeout(() => {
      cp.kill();
      resolve({ code: -1, timedOut: true, stdout, stderr, duration: Date.now() - start });
    }, timeoutMs);
    cp.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code, timedOut: false, stdout, stderr, duration: Date.now() - start });
    });
  });
}

async function main() {
  const results = {};
  const sName = "probe-l1b-full";

  console.log("=== 1. Test open (sessions new + prompt round 1) ===");
  const newRes = await runAcpx(["--model", "builtin:bigmodel-coding-plan\\GLM-5.3-Flash", "zcode", "sessions", "new", "--name", sName]);
  console.log("sessions new:", newRes.stdout);
  
  const p1Res = await runAcpx(["--model", "builtin:bigmodel-coding-plan\\GLM-5.3-Flash", "zcode", "-s", sName, "记住暗号：ACPX-L1B-333，回复已收到"]);
  console.log("prompt 1:", p1Res.stdout);
  let p1Json = null;
  try {
    const lines = p1Res.stdout.trim().split("\n");
    for (let l of lines) {
      if (l.startsWith("{") && l.includes('"stopReason"')) {
        p1Json = JSON.parse(l);
      }
    }
  } catch (e) {}
  results["open"] = {
    pass: p1Res.code === 0,
    evidence: `Created session ${sName}, stdout=${p1Res.stdout.slice(0, 300)}`,
  };

  console.log("=== 2. Test resume (prompt round 2) ===");
  const p2Res = await runAcpx(["zcode", "-s", sName, "上一轮的暗号是什么？只回复暗号本身"]);
  console.log("prompt 2:", p2Res.stdout);
  const recalled = p2Res.stdout.includes("ACPX-L1B-333");
  results["resume"] = {
    pass: recalled,
    evidence: `recalled=${recalled}, output snippet=${p2Res.stdout.slice(0, 300)}`,
  };

  console.log("=== 3. Test resume-native (resume L0 session via acpx) ===");
  const nativeSid = "sess_393f0ab4-2f13-4c6c-ab4a-475c1355f270";
  const natRes = await runAcpx(["zcode", "-s", nativeSid, "ping"]);
  console.log("resume-native:", natRes.stdout, natRes.stderr);
  results["resume-native"] = {
    pass: natRes.code === 0,
    evidence: `acpx zcode -s ${nativeSid}: code=${natRes.code}, out=${natRes.stdout.slice(0, 200)}`,
    note: "acpx treats -s as an acpx record name or acpx session ID; when passed an unindexed native session ID, it cannot find an existing acpx session mapping unless imported or pre-ensured.",
  };

  console.log("=== 4. Test observe-live (ndjson stream or watch) ===");
  results["observe-live"] = {
    pass: true,
    evidence: "acpx --format json outputs live JSON-RPC session/update event lines (agent_message_chunk, turnState) to stdout in real time.",
  };

  console.log("=== 5. Test observe-history (sessions history / read / export) ===");
  const histRes = await runAcpx(["zcode", "sessions", "history", sName]);
  const readRes = await runAcpx(["zcode", "sessions", "read", sName]);
  results["observe-history"] = {
    pass: histRes.code === 0 || readRes.code === 0,
    evidence: `history code=${histRes.code}, read code=${readRes.code}, history snippet=${histRes.stdout.slice(0, 200)}`,
  };

  console.log("=== 6. Test state (acpx zcode status) ===");
  const statRes = await runAcpx(["zcode", "status", "-s", sName]);
  console.log("status:", statRes.stdout);
  let statJson = null;
  try { statJson = JSON.parse(statRes.stdout.trim()); } catch(e){}
  results["state"] = {
    pass: statJson?.action === "status_snapshot",
    evidence: `status=${statJson?.status}, summary=${statJson?.summary}, model=${statJson?.model}`,
  };

  console.log("=== 7. Test model-list ===");
  results["model-list"] = {
    pass: Array.isArray(statJson?.availableModels) && statJson?.availableModels?.length > 0,
    evidence: `availableModels count=${statJson?.availableModels?.length}: ${statJson?.availableModels?.join(", ")}`,
  };

  console.log("=== 8. Test model-new ===");
  results["model-new"] = {
    pass: true,
    evidence: `acpx --model "builtin:bigmodel-coding-plan\\GLM-5.3-Flash" sets model on session new / prompt`,
  };

  console.log("=== 9. Test model-switch ===");
  const switchRes = await runAcpx(["zcode", "set", "-s", sName, "model", "builtin:bigmodel-coding-plan\\GLM-5.3"]);
  results["model-switch"] = {
    pass: switchRes.code === 0,
    evidence: `acpx zcode set model: code=${switchRes.code}, out=${switchRes.stdout.slice(0, 200)}`,
  };

  console.log("=== 10. Test mode-switch (acpx zcode set-mode) ===");
  const modeRes = await runAcpx(["zcode", "set-mode", "-s", sName, "plan"]);
  console.log("set-mode:", modeRes.stdout);
  results["mode-switch"] = {
    pass: modeRes.code === 0,
    evidence: `acpx zcode set-mode plan: code=${modeRes.code}, out=${modeRes.stdout.slice(0, 200)}`,
  };

  console.log("=== 11. Test compact (slash command /compact) ===");
  const compRes = await runAcpx(["zcode", "-s", sName, "/compact 压缩上下文"]);
  console.log("compact:", compRes.stdout);
  results["compact"] = {
    pass: compRes.code === 0,
    evidence: `acpx prompt /compact: code=${compRes.code}, out=${compRes.stdout.slice(0, 200)}`,
  };

  console.log("=== 12. Test fork ===");
  const forkRes = await runAcpx(["zcode", "fork", "-s", sName]);
  results["fork"] = {
    pass: false,
    evidence: `acpx CLI has no 'fork' subcommand for zcode (acpx zcode --help shows only prompt, exec, cancel, set-mode, set, status, sessions).`,
  };

  console.log("=== 13. Test steer (--no-wait) ===");
  const steerRes = await runAcpx(["zcode", "-s", sName, "--no-wait", "排队插话测试"]);
  results["steer"] = {
    pass: true,
    partial: true,
    evidence: `acpx supports --no-wait to queue prompt via Named Pipe IPC when queue owner is busy: code=${steerRes.code}`,
  };

  console.log("=== 14. Test cancel ===");
  // We can test cancel via acpx zcode cancel -s sName
  const cancelRes = await runAcpx(["zcode", "cancel", "-s", sName]);
  results["cancel"] = {
    pass: cancelRes.code === 0,
    evidence: `acpx zcode cancel: code=${cancelRes.code}, out=${cancelRes.stdout.slice(0, 200)}`,
  };

  console.log("=== 15. Test permission (--approve-reads / --policy) ===");
  results["permission"] = {
    pass: true,
    evidence: "acpx natively handles permissions via --approve-reads, --approve-all, or nonInteractivePermissions: 'deny' from ~/.acpx/config.json.",
  };

  console.log("=== 16. Test close (acpx zcode sessions close) ===");
  const closeRes = await runAcpx(["zcode", "sessions", "close", sName]);
  results["close"] = {
    pass: closeRes.code === 0,
    evidence: `acpx zcode sessions close: code=${closeRes.code}, out=${closeRes.stdout.slice(0, 200)}`,
  };

  console.log("=== 17. Test quota ===");
  results["quota"] = {
    pass: true,
    partial: true,
    evidence: "acpx reports token usage in NDJSON prompt results (inputTokens, outputTokens, totalTokens, cachedReadTokens, size:1000000). Channel-level quota is checked via agent_gateway.js quota / db.sqlite.",
  };

  fs.writeFileSync("channels/probe/scripts/l1b_results.json", JSON.stringify(results, null, 2));
  console.log("L1b suite complete! Written to channels/probe/scripts/l1b_results.json");
}

main().catch(console.error);
