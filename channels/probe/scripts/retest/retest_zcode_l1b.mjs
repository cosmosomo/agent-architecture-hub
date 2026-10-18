import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const HOME = os.homedir();
const CWD = "E:\\program\\GIT\\Agent\\multi\\Agent-Architecture-Hub";
const ZCODE_DB = path.join(HOME, ".zcode", "cli", "db", "db.sqlite");
const ACPX_SESSIONS_DIR = path.join(HOME, ".acpx", "sessions");

const ENV = {
  ...process.env,
  HTTP_PROXY: "http://127.0.0.1:7892",
  HTTPS_PROXY: "http://127.0.0.1:7892",
};

function runAcpx(args, timeout = 75000) {
  const start = Date.now();
  const res = spawnSync("acpx", args, {
    cwd: CWD,
    env: ENV,
    shell: true,
    encoding: "utf8",
    timeout,
    stdio: ["ignore", "pipe", "pipe"],
  });
  return {
    code: res.status,
    stdout: res.stdout || "",
    stderr: res.stderr || "",
    duration: Date.now() - start,
  };
}

function findAcpSessionId(sessionName) {
  if (!fs.existsSync(ACPX_SESSIONS_DIR)) return null;
  const files = fs.readdirSync(ACPX_SESSIONS_DIR);
  for (const f of files) {
    if (f.endsWith(".stream.ndjson") || !f.endsWith(".json")) continue;
    try {
      const fullPath = path.join(ACPX_SESSIONS_DIR, f);
      const data = JSON.parse(fs.readFileSync(fullPath, "utf8"));
      if (data.name === sessionName) {
        return data.acp_session_id;
      }
    } catch (e) {}
  }
  return null;
}

function queryZcodeSessionAndUsage(startTs) {
  const pyCode = `
import sqlite3, json
con = sqlite3.connect(r'${ZCODE_DB}')
cur = con.cursor()
sess = cur.execute('SELECT id, directory, time_created FROM session WHERE time_created >= ? ORDER BY time_created DESC LIMIT 1', (${startTs},)).fetchone()
if not sess:
    print(json.dumps({'session': None, 'rows': []}))
    exit(0)
sess_id = sess[0]
cols = [c[1] for c in cur.execute('PRAGMA table_info(model_usage)').fetchall()]
rows = cur.execute('SELECT * FROM model_usage WHERE session_id = ? AND query_source = "main_turn" ORDER BY started_at ASC', (sess_id,)).fetchall()
result = [dict(zip(cols, r)) for r in rows]
print(json.dumps({'session': sess_id, 'rows': result}, ensure_ascii=False))
`;
  const res = spawnSync("python", ["-c", pyCode], { encoding: "utf8" });
  try {
    return JSON.parse(res.stdout);
  } catch (e) {
    console.error("Failed to parse python query stdout:", res.stdout, res.stderr);
    return { session: null, rows: [] };
  }
}

const outDir = path.join(CWD, "channels", "probe", "scripts", "retest");
const resultsFile = path.join(outDir, "zcode_l1b_retest_results.json");

async function main() {
  console.log("=== Testing zcode L1b acp-bridge model-switch ===");
  const startTs = Date.now();
  const sessionName = `probe-zcode-l1b-mswitch-${startTs}`;
  console.log(`Session name: ${sessionName}, startTs: ${startTs}`);

  // Create session first
  console.log("0. Creating session via sessions new...");
  const newSessRes = runAcpx(["--format", "json", "--model", "builtin:bigmodel-coding-plan\\GLM-5.3-Flash", "zcode", "sessions", "new", "--name", sessionName]);
  console.log("sessions new code:", newSessRes.code, "stdout:", newSessRes.stdout.trim());

  // 1. Turn 1 with GLM-5.3-Flash
  console.log("\n[1/3] Running Turn 1 with GLM-5.3-Flash...");
  const t1Cmd = `acpx --format json --model "builtin:bigmodel-coding-plan\\GLM-5.3-Flash" zcode -s ${sessionName} "请只回答四个字：春生夏长"`;
  const t1Res = runAcpx([
    "--format",
    "json",
    "--model",
    "builtin:bigmodel-coding-plan\\GLM-5.3-Flash",
    "zcode",
    "-s",
    sessionName,
    "请只回答四个字：春生夏长",
  ]);

  console.log("Turn 1 exit code:", t1Res.code);
  console.log("Turn 1 stdout sample:", t1Res.stdout.slice(0, 300));

  const acpSessionId = findAcpSessionId(sessionName);
  console.log(`Resolved acp_session_id: ${acpSessionId}`);

  // 2. Set model to GLM-5.3
  console.log("\n[2/3] Switching model via acpx set model...");
  const setModelCmd = `acpx --format json zcode set model "builtin:bigmodel-coding-plan\\GLM-5.3" -s ${sessionName}`;
  const setRes = runAcpx([
    "--format",
    "json",
    "zcode",
    "set",
    "model",
    "builtin:bigmodel-coding-plan\\GLM-5.3",
    "-s",
    sessionName,
  ]);
  console.log("Set model exit code:", setRes.code, "stdout:", setRes.stdout.trim());

  // 3. Turn 2 with GLM-5.3
  console.log("\n[3/3] Running Turn 2 with switched model...");
  const t2Cmd = `acpx --format json zcode -s ${sessionName} "请只回答四个字：秋收冬藏"`;
  const t2Res = runAcpx([
    "--format",
    "json",
    "zcode",
    "-s",
    sessionName,
    "请只回答四个字：秋收冬藏",
  ]);

  console.log("Turn 2 exit code:", t2Res.code);
  console.log("Turn 2 stdout sample:", t2Res.stdout.slice(0, 300));

  // Query db for session and usage
  const dbData = queryZcodeSessionAndUsage(startTs);
  const zcodeNativeSessionId = dbData.session;
  const usageRowsAll = dbData.rows;
  console.log(`ZCode native session: ${zcodeNativeSessionId}`);
  console.log(`All DB main_turn model_usage rows count: ${usageRowsAll.length}`);
  for (const [idx, row] of usageRowsAll.entries()) {
    console.log(`Row ${idx + 1}: turn_id=${row.turn_id}, model_id=${row.model_id}, status=${row.status}, tokens=${row.computed_total_tokens}`);
  }

  const turn1Row = usageRowsAll[0];
  const turn2Row = usageRowsAll[usageRowsAll.length - 1];

  const pass = Boolean(
    turn1Row?.model_id?.toLowerCase().includes("flash") &&
    !turn2Row?.model_id?.toLowerCase().includes("flash") &&
    turn2Row?.model_id === "GLM-5.3"
  );

  const result = {
    pass,
    sessionName,
    acpSessionId,
    t1ExitCode: t1Res.code,
    setCommandResult: setRes.stdout.trim(),
    t2ExitCode: t2Res.code,
    turn1UsageRow: turn1Row,
    turn2UsageRow: turn2Row,
    allUsageRows: usageRowsAll,
    cmd: `${t1Cmd} -> ${setModelCmd} -> ${t2Cmd}`,
  };

  fs.writeFileSync(resultsFile, JSON.stringify(result, null, 2), "utf8");
  console.log(`\nZCode L1b model-switch result: ${pass ? "PASS" : "FAIL"}`);
}

main().catch(console.error);
