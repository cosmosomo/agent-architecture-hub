import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const CWD = "E:\\program\\GIT\\Agent\\multi\\Agent-Architecture-Hub";
const OUT_DIR = path.join(CWD, "channels", "probe", "scripts", "retest", "output");
fs.mkdirSync(OUT_DIR, { recursive: true });

const COMMON_ENV = {
  ...process.env,
  ACPX_CLAUDE_INCLUDE_USER_SETTINGS: "1",
  HTTP_PROXY: "http://127.0.0.1:7892",
  HTTPS_PROXY: "http://127.0.0.1:7892",
};

async function runAcpxModel(modelAlias, sessionName) {
  console.log(`Running acpx claude with --model ${modelAlias} (session: ${sessionName})...`);
  return new Promise((resolve) => {
    const cp = spawn("cmd.exe", ["/c", "acpx.cmd", "--format", "json", "claude", "--model", modelAlias, "-s", sessionName, "ping, reply one word"], {
      cwd: CWD,
      env: COMMON_ENV,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    const events = [];

    cp.stdout.on("data", (d) => {
      const text = d.toString();
      stdout += text;
      for (const line of text.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          events.push(JSON.parse(trimmed));
        } catch {}
      }
    });

    cp.stderr.on("data", (d) => {
      stderr += d.toString();
    });

    const timer = setTimeout(() => {
      console.log(`Timeout killing acpx for ${modelAlias}`);
      cp.kill();
      resolve({ exitCode: -1, stdout, stderr, events });
    }, 60000);

    cp.on("close", (exitCode) => {
      clearTimeout(timer);
      resolve({ exitCode, stdout, stderr, events });
    });
  });
}

async function main() {
  console.log("=== Testing claude/L1b/acpx · model-new ===");

  const ts = Date.now();
  const sessionHaiku = `probe-haiku-${ts}`;
  const sessionSonnet = `probe-sonnet-${ts}`;

  const resHaiku = await runAcpxModel("haiku", sessionHaiku);
  console.log(`Haiku run exitCode: ${resHaiku.exitCode}, events count: ${resHaiku.events.length}`);

  const resSonnet = await runAcpxModel("sonnet", sessionSonnet);
  console.log(`Sonnet run exitCode: ${resSonnet.exitCode}, events count: ${resSonnet.events.length}`);

  // Find model metadata in output events or in ~/.acpx/sessions/
  const acpxSessionsDir = path.join(process.env.USERPROFILE, ".acpx", "sessions");
  let acpxSessionFiles = [];
  if (fs.existsSync(acpxSessionsDir)) {
    acpxSessionFiles = fs.readdirSync(acpxSessionsDir);
  }

  // Check Claude projects dir for recent session jsonl files
  const claudeProjectsDir = path.join(process.env.USERPROFILE, ".claude", "projects", "E--program-GIT-Agent-multi-Agent-Architecture-Hub");
  let recentClaudeFiles = [];
  if (fs.existsSync(claudeProjectsDir)) {
    recentClaudeFiles = fs.readdirSync(claudeProjectsDir)
      .map(f => ({ name: f, time: fs.statSync(path.join(claudeProjectsDir, f)).mtimeMs }))
      .sort((a, b) => b.time - a.time)
      .slice(0, 5);
  }

  const record = {
    haiku: {
      session: sessionHaiku,
      exitCode: resHaiku.exitCode,
      events: resHaiku.events,
      stdout: resHaiku.stdout.slice(0, 2000),
      stderr: resHaiku.stderr.slice(0, 2000),
    },
    sonnet: {
      session: sessionSonnet,
      exitCode: resSonnet.exitCode,
      events: resSonnet.events,
      stdout: resSonnet.stdout.slice(0, 2000),
      stderr: resSonnet.stderr.slice(0, 2000),
    },
    recentClaudeFiles,
  };

  const outFile = path.join(OUT_DIR, "claude_l1b_model_new_raw.json");
  fs.writeFileSync(outFile, JSON.stringify(record, null, 2), "utf8");
  console.log(`Saved result to ${outFile}`);
}

main().catch(console.error);
