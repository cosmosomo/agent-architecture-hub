import { spawn } from "node:child_process";
import fs from "node:fs";

const ZCODE_BIN = "E:\\zcode\\resources\\glm\\zcode.cjs";
const CWD = "E:\\program\\GIT\\Agent\\multi\\Agent-Architecture-Hub";
const PROXY_ENV = {
  ...process.env,
  HTTP_PROXY: "http://127.0.0.1:7892",
  HTTPS_PROXY: "http://127.0.0.1:7892",
  ZCODE_MODEL: "builtin:bigmodel-coding-plan\\GLM-5.3-Flash",
};

function runCli(args, extraEnv = {}, timeoutMs = 60000) {
  return new Promise((resolve) => {
    const start = Date.now();
    const env = { ...process.env, ...PROXY_ENV, ...extraEnv };
    const cp = spawn(process.execPath, [ZCODE_BIN, ...args], { cwd: CWD, env });
    let stdout = "";
    let stderr = "";

    cp.stdout.on("data", (d) => (stdout += d));
    cp.stderr.on("data", (d) => (stderr += d));

    const timer = setTimeout(() => {
      cp.kill("SIGTERM");
      resolve({ code: -1, timedOut: true, stdout, stderr, duration: Date.now() - start });
    }, timeoutMs);

    cp.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code, timedOut: false, stdout, stderr, duration: Date.now() - start });
    });
  });
}

console.log("=== Step 1: Open session ===");
const res1 = await runCli(["-p", "记住暗号：BETA-888，回复已收到", "--mode", "yolo", "--json"]);
console.log("Step 1 output:", res1.stdout);
let json1 = {};
try { json1 = JSON.parse(res1.stdout.trim()); } catch(e){}
const sid = json1.sessionId;
console.log("Session ID:", sid);

if (sid) {
  console.log("=== Step 2: Resume session ===");
  const res2 = await runCli(["--resume", sid, "-p", "刚才的暗号是什么？只回复暗号本身", "--mode", "yolo", "--json"]);
  console.log("Step 2 output:", res2.stdout);
  let json2 = {};
  try { json2 = JSON.parse(res2.stdout.trim()); } catch(e){}
  console.log("Recall response:", json2.response, "Tokens:", json2.usage);
  
  fs.writeFileSync("channels/probe/scripts/l0_open_resume_result.json", JSON.stringify({ open: json1, resume: json2 }, null, 2));
}
