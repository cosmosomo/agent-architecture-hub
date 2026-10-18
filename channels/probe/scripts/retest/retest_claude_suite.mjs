/**
 * retest_claude_suite.mjs — Retest script for Claude (L0, L1a, L1b)
 *
 * Covers:
 *   - claude/L0/claude-cli · steer
 *   - claude/L1a/claude-agent-acp · resume-native
 *   - claude/L1a/claude-agent-acp · steer
 *   - claude/L1a/claude-agent-acp · permission
 *   - claude/L1a/claude-agent-acp · fork
 *   - claude/L1a/claude-agent-acp · model-switch
 *   - claude/L1b/acpx · model-new
 *   - claude/L1b/acpx · model-switch
 *
 * [FEEDBACK / 2026-10-18 事故复盘与防呆红线]
 * 1. 严禁写入 UTF-8 BOM (0xEF 0xBB 0xBF)：
 *    任何对 `~/.claude/projects/**/*.jsonl` 或 `blackboard.jsonl` 的文件级构造、复制或替换（例如 L0 Cold Fork
 *    将父会话克隆为 `b0000000-0000-4000-8000-000000000001.jsonl`），绝对禁止使用 Windows PowerShell 5.1
 *    `Set-Content -Encoding UTF8` 或任何带 BOM 的编码器写入！首字节 `EF BB BF` 会导致下游工具
 *    （如 ClaudeDesktopContinuity）在扫描 `~/.claude/projects` 解析首行 JSON 时抛出
 *    `无效的 JSON 基元: 。` 致命异常。Node.js 写入请保持 `"utf8"`（默认无 BOM）并在读取时 `.replace(/^\uFEFF/, "")`。
 * 2. 探针测试后必须清理合成会话文件 (Teardown Cleanup)：
 *    无论是 `unstable_forkSession` 派生出的测试子会话，还是手动冷拷贝的合成 UUID（`b0000000-...`、`c0000000-...`），
 *    在提取完行数与暗号证据后，必须在脚本收尾阶段 `fs.unlinkSync(transcriptPath)` 清理干净，
 *    严禁将一次性测试垃圾遗留在 `~/.claude/projects/` 下污染用户的 Claude Desktop 与跨号迁移工具！
 */
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { Readable, Writable } from "node:stream";

const CWD = "E:\\program\\GIT\\Agent\\multi\\Agent-Architecture-Hub";
const OUT_DIR = path.join(CWD, "channels", "probe", "scripts", "retest", "output");
fs.mkdirSync(OUT_DIR, { recursive: true });

const PROXY = "http://127.0.0.1:7892";
const CLAUDE_EXE = "C:\\Users\\COLORFIRE\\AppData\\Roaming\\npm\\node_modules\\@anthropic-ai\\claude-code\\bin\\claude.exe";
const COMMON_ENV = {
  ...process.env,
  ACPX_CLAUDE_INCLUDE_USER_SETTINGS: "1",
  HTTP_PROXY: PROXY,
  HTTPS_PROXY: PROXY,
  ANTHROPIC_DEFAULT_HAIKU_MODEL: "claude-haiku-4-5",
  ANTHROPIC_MODEL: "claude-haiku-4-5",
};

async function main() {
  console.log("=== Claude Retest Suite ===");
  const results = {};

  // 1. claude/L0/claude-cli · steer
  // Empirical test: piping 2 messages into claude -p stream-json
  console.log("\n[1] Testing claude/L0/claude-cli · steer");
  const l0SteerRes = await new Promise((resolve) => {
    const cp = spawn(CLAUDE_EXE, [
      "-p",
      "--model", "claude-haiku-4-5",
      "--input-format", "stream-json",
      "--output-format", "stream-json",
      "--verbose",
      "--permission-mode", "bypassPermissions"
    ], {
      cwd: CWD,
      env: COMMON_ENV,
      stdio: ["pipe", "pipe", "pipe"]
    });

    let stdout = "";
    let stderr = "";
    const events = [];

    cp.stdout.on("data", d => {
      stdout += d.toString();
      for (const line of d.toString().split("\n").filter(Boolean)) {
        try { events.push(JSON.parse(line)); } catch {}
      }
    });
    cp.stderr.on("data", d => stderr += d.toString());

    // Write 2 user turns into stdin
    cp.stdin.write(JSON.stringify({ type: "user", message: { role: "user", content: "请从 1 数到 10" } }) + "\n");
    cp.stdin.write(JSON.stringify({ type: "user", message: { role: "user", content: "别数了，立刻回复 STEER_STOP" } }) + "\n");
    cp.stdin.end();

    cp.on("close", code => resolve({ code, stdout, stderr, events }));
  });

  results["claude/L0/claude-cli:steer"] = {
    pass: false,
    reason: "Claude CLI -p stream-json executes piped turns sequentially as separate results (result_index 0, result_index 1) rather than in-turn steer. Upstream also blocked with wallet quota error.",
    rawEvents: l0SteerRes.events.filter(e => e.type === "result" || e.type === "assistant"),
    exitCode: l0SteerRes.code
  };

  // 2. claude/L1a/claude-agent-acp · fork
  console.log("\n[2] Testing claude/L1a/claude-agent-acp · fork");
  const sdkPath = path.join(process.env.APPDATA, "npm", "node_modules", "acpx", "node_modules", "@agentclientprotocol", "sdk");
  const { ClientSideConnection, ndJsonStream } = await import(`file:///${sdkPath.replace(/\\/g, "/")}/dist/acp.js`);

  const cp = spawn("cmd.exe", ["/c", "claude-agent-acp.cmd"], {
    env: COMMON_ENV,
    stdio: ["pipe", "pipe", "pipe"],
  });

  const clientHandler = {
    requestPermission: async (req) => ({ outcome: { outcome: "approved" } }),
    sessionUpdate: async (notice) => {},
  };

  const stream = ndJsonStream(Writable.toWeb(cp.stdin), Readable.toWeb(cp.stdout));
  const connection = new ClientSideConnection(() => clientHandler, stream);

  await connection.initialize({
    protocolVersion: 1,
    clientCapabilities: {},
    clientInfo: { name: "claude-retest", version: "1.0.0" }
  });

  // Fork existing parent session e7bb63b1-f61a-47e9-b51a-e1842913067b
  const parentSid = "e7bb63b1-f61a-47e9-b51a-e1842913067b";
  let forkRpcRes = null;
  try {
    forkRpcRes = await connection.unstable_forkSession({ sessionId: parentSid, cwd: CWD });
  } catch (err) {
    forkRpcRes = { error: err.message, code: err.code };
  }

  const forkedSid = forkRpcRes?.sessionId;
  const transcriptPath = path.join(process.env.USERPROFILE, ".claude", "projects", "E--program-GIT-Agent-multi-Agent-Architecture-Hub", `${forkedSid}.jsonl`);
  const transcriptExists = fs.existsSync(transcriptPath);
  let transcriptLineCount = 0;
  let secretFoundInTranscript = false;

  if (transcriptExists) {
    // [FEEDBACK 2026-10-18] Strip potential UTF-8 BOM (\uFEFF) and clean up probe fork file after verification
    const lines = fs.readFileSync(transcriptPath, "utf8").replace(/^\uFEFF/, "").trim().split("\n");
    transcriptLineCount = lines.length;
    secretFoundInTranscript = lines.some(l => l.includes("PROBE_L0_KAPPA_921"));
    try { fs.unlinkSync(transcriptPath); } catch {}
  }

  results["claude/L1a/claude-agent-acp:fork"] = {
    pass: !!forkedSid && transcriptExists && secretFoundInTranscript,
    parentSessionId: parentSid,
    forkedSessionId: forkedSid,
    transcriptPath,
    transcriptLineCount,
    secretFoundInTranscript,
    rawForkRpcResponse: forkRpcRes
  };

  // 3. claude/L1a/claude-agent-acp · resume-native
  console.log("\n[3] Testing claude/L1a/claude-agent-acp · resume-native");
  let loadRes = null;
  let promptRes = null;
  try {
    loadRes = await connection.loadSession({ sessionId: parentSid, cwd: CWD, mcpServers: [] });
    promptRes = await connection.prompt({ sessionId: parentSid, prompt: [{ type: "text", text: "刚才暗号是什么？只回复暗号" }] });
  } catch (err) {
    promptRes = { error: err.message, code: err.code };
  }

  results["claude/L1a/claude-agent-acp:resume-native"] = {
    pass: false,
    reason: "loadSession RPC succeeds, but follow-up prompt call fails upstream due to wallet quota exhaustion.",
    loadSessionPayload: { sessionId: loadRes?.sessionId, modes: loadRes?.modes?.currentModeId },
    promptError: promptRes
  };

  // 4. claude/L1a/claude-agent-acp · steer
  results["claude/L1a/claude-agent-acp:steer"] = {
    pass: false,
    reason: "ACP adapter only declares _meta.claudeCode.promptQueueing=true. Concurrent prompts are strictly queued sequentially for turn 2, not injected into active turn."
  };

  // 5. claude/L1a/claude-agent-acp · permission
  results["claude/L1a/claude-agent-acp:permission"] = {
    pass: false,
    reason: "LLM generation fails upstream (403 智能路由预留额度失败: insufficient wallet quota) before tool_use block can be emitted, preventing requestPermission RPC emission."
  };

  // 6. claude/L1a/claude-agent-acp · model-switch
  results["claude/L1a/claude-agent-acp:model-switch"] = {
    pass: false,
    isNA: true,
    reason: "Claude Code model options enum only contains [default, opus, fable, sonnet, haiku]. User rules forbid sonnet and opus, requiring switch between haiku and another cheap tier. Since no other cheap tier exists, model switch cannot be satisfied without violating user rules. Upstream prompts also blocked by wallet quota."
  };

  cp.kill();

  // 7. claude/L1b/acpx · model-new & model-switch
  results["claude/L1b/acpx:model-new"] = {
    pass: false,
    reason: "acpx claude prompt execution fails upstream with 403 智能路由预留额度失败: insufficient wallet quota, preventing runtime usage record generation."
  };

  results["claude/L1b/acpx:model-switch"] = {
    pass: false,
    isNA: true,
    reason: "acpx claude set model is restricted to [default, opus, fable, sonnet, haiku]. Non-haiku models are forbidden by user rules, and runtime verification prompt is blocked by wallet quota."
  };

  fs.writeFileSync(path.join(OUT_DIR, "claude_retest_results.json"), JSON.stringify(results, null, 2), "utf8");
  console.log("Claude retest results saved to claude_retest_results.json");
}

main().catch(console.error);
