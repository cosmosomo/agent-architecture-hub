---
channel_id: gemini-cli
name: Google Gemini CLI
category: host
maintainer: S5
status: 🟡 cooldown_degraded
upgrade_status: ✅ synced
verified_version: "0.62.0"
detected_version: "0.62.0"
holder: shared
last_verified_at: "2026-10-14T12:15:00+08:00"
capabilities:
  observe_only: true
  external_session_read: true
  control_lifecycle: { start: true, resume: true, fork: false, stop: false }
  steer_in_turn: { in_turn: true, next_turn: true, inbox_file: true }
  coordinate_team: { spawn_subagent: false, peer_message: false, task_board: false }
---

# Gemini CLI (`gemini-cli`) · 宿主能力与渠道维护档案卡

## 一、渠道身份与接入入口
- **角色定位**：命令行 Gemini 节点与 ACP（Agent Communication Protocol）桥接器。
- **CLI 入口（`0.62.0`）**：
  - 非交互执行：`gemini -p "<prompt>" -o stream-json --approval-mode yolo`
  - 恢复会话：`gemini -r latest -p "<prompt>"`（或 `-r <index>`）
  - 协议服务：`gemini --acp`
- **本地会话落盘位置**：
  - 完整对话记录：`~/.gemini/tmp/<projectHash>/chats/session-*.json`（含 `user` + `gemini` 消息、`thoughts`、`toolCalls`、`tokens`、`model`）
  - 用户输入回显：`~/.gemini/tmp/<projectHash>/logs.json`
  - 项目路径映射：`~/.gemini/tmp/<projectHash>/.project_root`

## 二、独立能力矩阵（逐项核验记录）
| 能力维度 | 子能力项 | 支持度 | 精确命令 / 协议 / 字段依据 | 核验版本 & 证据 |
|---|---|---|---|---|
| **外部读 Sessions** | `chats/session-*.json` + `.project_root` | ✅ 原生完备 | 直读 `~/.gemini/tmp/<hash>/chats/session-*.json` 并关联 `.project_root` 还原 `cwd` | `0.62.0` `〔实测:12会话〕` |
| **生命周期控制** | 启动 / 恢复 / 删除会话 | ✅ 原生支持 | `gemini -p` / `gemini -r <latest\|idx>` / `gemini --delete-session <idx>` | `0.62.0` `〔CLI帮助〕` |
| **运行中插话** | ACP 与 `stream-json` | 🟡 协议支持 | `gemini --acp` / `-o stream-json` | `0.62.0` `〔CLI帮助〕` |
| **团队与子智能体** | 原生子代理派生 | ❌ 不支持 | 本地会话中 `subagents = 0` | `0.62.0` `〔实测〕` |

## 三、当前状态、安全参数与防呆红线
- **当前状态**：🟡 本地文件直读完全可用；CLI 交互命令需注意登录态阻塞
- **绝对红线**：
  1. **严禁在无人值守脚本中盲目调 `gemini --list-sessions`**：当 OAuth 登录态过期或未配置 `GEMINI_API_KEY` 时，该命令会拉起浏览器认证并无限期挂起阻塞进程！查会话一律走 `trace` 本地文件直读。

## 四、渠道升级与功能演进日志
- **2026-10-14 · 修复 `trace` 适配器漏扫 `chats/session-*.json` 与 `.project_root`**：
  - 升级 `trace/packages/adapters/src/gemini/`，将 `.gemini/tmp/<hash>/chats/session-*.json` 纳入扫描并支持通过 Bundle 读取 `.project_root` 还原真实 `cwd`。

## 五、状态变化与故障/攻防时间线
- **2026-10-14 · 🟡 实测捕获 `gemini --list-sessions` OAuth 弹窗阻塞**：记录进防呆红线。

## 六、维护者（S5）挂账与待办
- [x] 已在 `trace/packages/adapters/src/gemini/` 完成 `chats/session-*.json` 与 `.project_root` 解析升级。
