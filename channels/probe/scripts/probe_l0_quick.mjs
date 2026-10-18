import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const ZCODE_BIN = "E:\\zcode\\resources\\glm\\zcode.cjs";
const CWD = "E:\\program\\GIT\\Agent\\multi\\Agent-Architecture-Hub";

console.log("=== Testing L0 CLI Capabilities ===");

// 1. Check CLI help and subcommands
async function testCliOptions() {
  return new Promise((resolve) => {
    const cp = spawn("node", [ZCODE_BIN, "--help"], { cwd: CWD });
    let out = "";
    cp.stdout.on("data", (d) => (out += d));
    cp.on("close", (code) => {
      resolve({ code, hasResume: out.includes("--resume"), hasMode: out.includes("--mode"), hasJson: out.includes("--json") });
    });
  });
}

// 2. Run CLI prompt with --json
async function testCliPromptJson() {
  return new Promise((resolve) => {
    const start = Date.now();
    const env = { ...process.env, HTTP_PROXY: "http://127.0.0.1:7892", HTTPS_PROXY: "http://127.0.0.1:7892" };
    const cp = spawn("node", [ZCODE_BIN, "-p", "回复PING-L0", "--mode", "yolo", "--json"], { cwd: CWD, env });
    let stdout = "";
    let stderr = "";
    cp.stdout.on("data", (d) => (stdout += d));
    cp.stderr.on("data", (d) => (stderr += d));
    cp.on("close", (code) => {
      resolve({ code, duration: Date.now() - start, stdout, stderr });
    });
  });
}

const opts = await testCliOptions();
console.log("CLI Options:", opts);

console.log("Running CLI prompt --json...");
const promptRes = await testCliPromptJson();
console.log("CLI Prompt Code:", promptRes.code, "Duration:", promptRes.duration);
console.log("CLI Stdout snippet:", promptRes.stdout.slice(0, 500));
console.log("CLI Stderr snippet:", promptRes.stderr.slice(0, 500));
