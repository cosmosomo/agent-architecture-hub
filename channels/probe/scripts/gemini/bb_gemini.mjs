// Append gemini L0/L1a/L1b blackboard records (auth-blocked everywhere).
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "../../../..");
const BB = path.join(ROOT, "channels", "probe", "blackboard.jsonl");

// Shared evidence strings (verbatim from this run)
const E_AUTH_CANCEL = 'echo n | gemini -m gemini-2.5-flash -p "只回复两个字:收到" → "Opening authentication page in your browser. Do you want to continue? [Y/n]: n" + "Error authenticating: FatalCancellationError: Authentication cancelled by user. at initOauthClient (…gemini-cli/bundle/chunk-MLY4WQFO.js…)" exit=55';
const E_AUTH_EXPIRED = "~/.gemini/oauth_creds.json: {\"expiry_date\":1761505425112}（=2025-10-26，已过期近一年）；settings.json security.auth.selectedType=\"oauth-personal\"；环境无 GEMINI_API_KEY/GOOGLE_API_KEY";
const E_AUTH_HANG = "gemini -p … < /dev/null → 卡在 \"Opening authentication page in your browser. Do you want to continue? [Y/n]:\"，timeout 90 击杀 EXIT=124，无任何模型输出";
const E_L1A_HANG = "spawn gemini --acp（stdio 管道）：25s 后发 initialize 无任何响应，stdout/stderr 全空，timeout 击杀 EXIT=124（gem_l1a_log.jsonl 仅 bridge.exit/probe.error 两行）";
const E_L1B_ACpx = 'acpx gemini sessions new --name probe-gemini-x1 → "Gemini CLI ACP startup timed out before initialize completed. This usually means the local Gemini CLI is waiting on interactive OAuth… Detected Gemini CLI version: 0.62.0. No GEMINI_API_KEY or GOOGLE_API_KEY was set for non-interactive auth."；随后 prompt 报 {"code":-32002,"message":"⚠ No acpx session found…","data":{"acpxCode":"NO_SESSION"}} exit=4';
const E_HELP = "gemini --help（0.62.0）参数全文已存 channels/probe/scripts/tmp/zcode-glm/：-p/-m/--resume/--list-sessions/--delete-session/--session-id/-o text|json|stream-json/--approval-mode default|auto_edit|yolo|plan/--acp/-y；无 fork/compact/quota/steer/定时类参数";

const rows = [];
const add = (layer, route, surface, capability, result, condition, evidence, cmd, note) =>
  rows.push({ layer, route, surface, capability, result, condition, evidence, cmd, note });

// ---------- L0 native CLI ----------
const L0 = "gemini/L0/cli";
const l0rows = [
  ["open", "fail", "oauth 已过期且拒绝浏览器重登（按任务书不登录）", E_AUTH_CANCEL, "echo n | timeout 90 gemini -m gemini-2.5-flash -p \"只回复两个字:收到\" -o json", "same wall for all -p runs"],
  ["resume", "fail", "--resume 存在但建会话已不可能", E_AUTH_CANCEL + "；" + E_HELP, "gemini --help（--resume latest|index）", "-"],
  ["resume-native", "fail", "无原生会话可开，无从续起", E_AUTH_CANCEL, "-", "本轮未能自开 probe- 会话"],
  ["observe-live", "fail", "-o stream-json 存在但运行不到那一步", E_AUTH_HANG, "gemini -p … -o stream-json", "-"],
  ["observe-history", "fail", "--list-sessions 也被 auth 门挡住；本地旧会话文件存在", "timeout 90 gemini --list-sessions < /dev/null → 同一 Y/n 提示，EXIT=124；ls ~/.gemini/history → agent-architecture-hub/ agent-hub/；find ~/.gemini/tmp -name logs.json → 多个 hash 目录", "gemini --list-sessions", "旧数据可读但无法做本轮端到端验证"],
  ["state", "fail", "同上，--list-sessions 不可用", E_AUTH_HANG, "gemini --list-sessions", "-"],
  ["cancel", "fail", "无 turn 可跑，无从打断", E_AUTH_CANCEL, "-", "-p 模式下只能杀进程（未验证）"],
  ["close", "fail", "--delete-session 依赖 --list-sessions 出索引，而后者被挡", E_AUTH_HANG, "gemini --delete-session <index>", "-"],
  ["steer", "n/a", "-p 模式 stdin 只在启动时一次性拼入 prompt（help 原文：Appended to input on stdin (if any)），无中途通道", E_HELP, "gemini --help", "-"],
  ["permission", "fail", "--approval-mode default 需要交互应答，headless 无法应答；且 auth 已挡", E_AUTH_CANCEL + "；" + E_HELP, "gemini --help（--approval-mode default|auto_edit|yolo|plan）", "未达可测条件"],
  ["fork", "n/a", "CLI 无 fork 参数", E_HELP, "gemini --help", "-"],
  ["compact", "n/a", "CLI 无 compact/compress 参数（交互 REPL 命令不适用于 headless）", E_HELP, "gemini --help", "-"],
  ["model-list", "fail", "无列表命令；-m 自由填写；auth 挡住一切", E_AUTH_CANCEL + "；" + E_HELP, "gemini --help", "-"],
  ["model-new", "fail", "-m gemini-2.5-flash 传了但 turn 不可达，无法验证实际模型", E_AUTH_CANCEL, "gemini -m gemini-2.5-flash -p …", "-"],
  ["model-switch", "fail", "CLI 无会话中切换机制（--resume+-m 未验证，auth 挡）", E_AUTH_CANCEL, "-", "-"],
  ["mode-switch", "n/a", "--approval-mode 仅是启动 flag，无会话中切换入口", E_HELP, "gemini --help", "-"],
  ["quota", "n/a", "无额度命令", E_HELP, "gemini --help", "-"],
  ["wake-bg", "n/a", "CLI 无后台任务/委派功能", E_HELP, "gemini --help", "-"],
  ["wake-timer", "n/a", "CLI 无定时功能", E_HELP, "gemini --help", "-"],
  ["wake-msg", "n/a", "CLI 无外部消息唤醒机制", E_HELP, "gemini --help", "-"],
  ["wait-visible", "n/a", "无让出/等待语义", E_HELP, "gemini --help", "-"],
  ["wake-stall", "n/a", "无等待语义；headless 卡死只能外部 timeout", E_AUTH_HANG, "-", "本轮 auth 卡死即是一例：外部 timeout 90 才能收回"],
  ["wake-persist", "n/a", "无等待可持久", E_HELP, "gemini --help", "-"],
];
for (const [capability, result, condition, evidence, cmd, note] of l0rows) {
  add("L0", L0, "native-cli", capability, result, condition, evidence, cmd, note);
}

// ---------- L1a direct gemini --acp ----------
const L1A = "gemini/L1a/gemini-acp";
for (const [cap, kind] of [
  ["open", "sess"], ["resume", "sess"], ["resume-native", "sess"], ["observe-live", "sess"],
  ["observe-history", "sess"], ["state", "sess"], ["cancel", "sess"], ["close", "sess"],
  ["steer", "sess"], ["permission", "sess"], ["model-new", "sess"], ["model-switch", "sess"],
  ["fork", "na"], ["compact", "proto"], ["model-list", "sess"], ["mode-switch", "sess"],
  ["quota", "proto"], ["wake-bg", "proto"], ["wake-timer", "proto"], ["wake-msg", "proto"],
  ["wait-visible", "proto"], ["wake-stall", "proto"], ["wake-persist", "proto"],
]) {
  const ev = cap === "open" ? E_L1A_HANG + "；" + E_L1B_ACpx.split("；")[0] : E_L1A_HANG;
  add("L1a", L1A, "acp-bridge", cap,
    kind === "proto" ? "n/a" : "fail",
    kind === "proto" ? "桥未达 initialize，声明未知；且 ACP 1.8 schema 本无此原语" : "桥启动即挂，initialize 90s 无响应，会话无从建立",
    ev,
    "timeout 90 node channels/probe/scripts/gemini/probe_l1a_gemini.mjs（SDK initialize→session/new→prompt）",
    kind === "sess" ? "initialize 无响应→agentCapabilities 未知，逐项调用不可进行" : "依据：@agentclientprotocol/sdk schema.json 无 compact/quota/wake 类方法，且桥未可达");
}

// ---------- L1b acpx gemini ----------
const L1B = "gemini/L1b/acpx";
for (const [cap, kind, extra] of [
  ["open", "fail", "sessions new 失败→NO_SESSION"],
  ["resume", "fail", "无会话可续"],
  ["resume-native", "fail", "无原生会话可开，也无从续"],
  ["observe-live", "fail", "无会话，无流可看"],
  ["observe-history", "fail", "acpx gemini sessions list 依赖会话存在"],
  ["state", "fail", "acpx hermes 式 status 对 gemini 无会话可查"],
  ["cancel", "fail", "无在跑 turn"],
  ["close", "fail", "无会话可关"],
  ["steer", "fail", "无在跑 turn"],
  ["permission", "fail", "无在跑 turn"],
  ["fork", "na", "acpx 子命令集无 fork（同 hermes L1b 依据：prompt/exec/cancel/set-mode/set/status/sessions）"],
  ["compact", "na", "acpx 子命令集无 compact"],
  ["model-list", "na", "acpx 无模型列表命令（--model 仅设置）"],
  ["model-new", "fail", "--model 无会话可应用"],
  ["model-switch", "fail", "无会话"],
  ["mode-switch", "fail", "set-mode 需活会话"],
  ["quota", "na", "acpx 无额度命令"],
  ["wake-bg", "na", "acpx 无后台原语"],
  ["wake-timer", "na", "acpx 无定时"],
  ["wake-msg", "na", "acpx 无消息唤醒"],
  ["wait-visible", "fail", "status 无会话可报"],
  ["wake-stall", "na", "acpx --timeout 可兜底，但本轮失败属启动挂而非等待"],
  ["wake-persist", "na", "无等待可持久"],
]) {
  add("L1b", L1B, "acpx-cli", cap, kind,
    kind === "na" ? extra : extra + "；根因同启动超时",
    E_L1B_ACpx,
    "timeout 90 acpx gemini sessions new --name probe-gemini-x1; timeout 90 acpx --format json gemini -s probe-gemini-x1 \"只回复两个字:收到\"",
    kind === "fail" ? "根因：OAuth 交互等待 + 无 API Key（见 L0 行）" : "-");
}

const routeSurf = { L0: ["gemini/L0/cli", "native-cli"], L1a: ["gemini/L1a/gemini-acp", "acp-bridge"], L1b: ["gemini/L1b/acpx", "acpx-cli"] };
const out = rows.map((r) =>
  JSON.stringify({
    at: new Date().toISOString(),
    by: "zcode-glm",
    family: "gemini",
    layer: r.layer,
    route: routeSurf[r.layer][0],
    surface: routeSurf[r.layer][1],
    capability: r.capability,
    result: r.result,
    condition: r.condition,
    evidence: r.evidence,
    cmd: r.cmd,
    note: r.note,
  })
);
fs.appendFileSync(BB, out.join("\n") + "\n");
console.log("appended", out.length, "gemini rows");
