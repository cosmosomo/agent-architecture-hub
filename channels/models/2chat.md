---
channel_id: 2chat
name: 2Chat 模型中转渠道 (2chat.cc)
category: model
maintainer: S6
status: 🟡 cooldown_degraded
upgrade_status: ✅ synced
verified_version: "2chat-v1"
detected_version: "2chat-v1"
holder: shared
last_verified_at: "2026-10-14T12:15:00+08:00"
capabilities:
  observe_only: true
  external_session_read: false
  control_lifecycle: { start: true, resume: false, fork: false, stop: false }
  steer_in_turn: { in_turn: false, next_turn: false, inbox_file: false }
  coordinate_team: { spawn_subagent: false, peer_message: false, task_board: false }
---

# 2Chat (`2chat`) · 模型渠道能力与维护档案卡

## 一、渠道身份与接入入口
- **渠道定位**：Claude Code 日常执行中转源（`2Chatkiro`）；**对 Codex 主力模型不可用**。
- **协议端点**：Claude 兼容 `https://2chat.cc`；OpenAI 兼容 `https://2chat.cc/v1`。
- **配置位置**：`~/.cc-switch/cc-switch.db`（Claude 当前激活源 `2chat-1790745756227`）。

## 二、独立能力矩阵（按宿主分开记录）
| 绑定宿主 | 状态 | 支持模型 | 实测结论 & 证据 |
|---|---|---|---|
| **Claude Code (`2Chatkiro`)** | 🟢 可用 | `Grok 4.6`、`opus5.5`、`sonnet` | 日常非核心任务可用 `〔实测〕` |
| **Codex CLI** | 🔴 禁用 | 旧卡配置为 `gpt-5.6`；请求 `gpt-6.1-sol` 返回 **HTTP 404 `model_not_found`** | `S6 requests.jsonl` `〔实测:404〕` |

## 三、当前状态、安全参数与防呆红线
- **当前状态**：🟡 仅限 Claude Code 日常使用，Codex 禁用
- **绝对红线**：
  1. **严禁在 `ccswitch` 中将 Codex 切换到 `2chat` 供应商卡**（既不支持 `gpt-6.1-sol`，且旧卡里的 `gpt-5.6` 违反用户模型禁令）。

## 四、渠道升级与功能演进日志
- **2026-10-02 ~ 10-14 · S6 探针核实 Codex `gpt-6.1-sol` 404 边界**。

## 五、状态变化与故障/攻防时间线
- **2026-10-02 · 🔴 实测 `2chat.cc/v1` 请求 `gpt-6.1-sol` 返回 HTTP 404 `model_not_found`**：永久标记 Codex 侧禁用该卡。

## 六、维护者（S6）挂账与待办
- 保持 `cc-switch.db` 中 Codex 指向 `yinzi-api`，不切 `2chat`。
