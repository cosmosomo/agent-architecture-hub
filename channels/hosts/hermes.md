---
channel_id: hermes
name: Hermes Agent（本机源码版，ACP）
category: host
maintainer: leader
status: 🟢 ok
upgrade_status: ✅ synced
verified_version: "0.21.1"
detected_version: "0.21.1"
holder: shared
last_verified_at: "2026-10-18T23:00:00+08:00"
capabilities:
  observe_only: false
  external_session_read: true
  control_lifecycle: { start: true, resume: true, fork: false, stop: true }
  steer_in_turn: { in_turn: false, next_turn: true, inbox_file: false }
  coordinate_team: { spawn_subagent: true, peer_message: false, task_board: false }
---

# Hermes（`hermes`）· 宿主能力与渠道维护档案卡

## 一、身份与入口
- **是什么**：本机源码装的 Hermes Agent（`E:\program\GIT\Agent\hermes and vcp like\hermes-agent`，版本 0.21.1，提交 990473a79c），用自带的 `.venv` 跑；没有桌面端。
- **我们怎么调**：ACP 桥。启动命令写在 `~/.acpx/config.json` 的 `agents.hermes.argv`（acpx 和后端常驻驱动用同一条）：用 venv 的 python 跑 `acp_adapter.entry`，启动前打两个补丁——把可选模型换成我们配的五个（`custom:glm-5.3` 等），以及切工作目录时按新目录重建智能体。环境变量 `HERMES_ACP_SKIP_CONFIGURED_MCP=1`、`PYTHONUTF8=1`（见 `hub/data/products.json`）。
- **会话落盘**：`~/AppData/Local/hermes/state.db`（SQLite），只读旁路读它列会话。

## 二、能力（10-18 实测）
| 能力 | 怎么做到 | 依据 |
|---|---|---|
| 新建、续聊、停止、换模型 | 后端常驻 ACP 桥：`session/new`、`session/load`、`session/cancel`、`session/set_model` | `verify.js` 10181442 六项全过 |
| 轮内审批 | 默认模式 `default` 写文件前发 `session/request_permission`，后端挂起等人答，批准后同一轮继续 | `probe_acp_approval.js` 10181455 |
| 模式 | `default`（会问）、`accept_edits`、`dont_ask` | `session/new` 返回的 modes |
| 被派活、交回、验收别人的活 | 派活单经常驻桥跑一轮，回复末尾的【交回】或命令行 `deliver` 交回 | 目标 goal_mvdxyieq_5ysz 里当验收方回 PASS |

## 三、要注意的
- 重载已有会话时偶尔报 “No LLM provider configured”，但随后的一轮照常回答；后端把它当警告不当失败。
- 没有轮内插话：一轮进行中再发话，排到下一轮。

## 四、变化记录
- **2026-10-18**：从每轮起一个 acpx 进程改为后端常驻 ACP 桥（`trace/apps/cli/src/drivers/acp_runtime.ts`）；补这张档案卡。
