---
channel_id: antigravity
name: Google AntiGravity Desktop IDE
category: host
maintainer: S5
status: 🟡 cooldown_degraded
upgrade_status: ✅ synced
verified_version: "CDP:9234"
detected_version: "CDP:9234"
holder: shared
last_verified_at: "2026-10-14T12:15:00+08:00"
capabilities:
  observe_only: true
  external_session_read: true
  control_lifecycle: { start: false, resume: true, fork: false, stop: false }
  steer_in_turn: { in_turn: false, next_turn: true, inbox_file: true }
  coordinate_team: { spawn_subagent: true, peer_message: true, task_board: false }
---

# AntiGravity (`antigravity`) · 宿主能力与渠道维护档案卡

## 一、渠道身份与接入入口
- **角色定位**：快速采集 / 网页与本地文件速览（主力模型 `gemini3.8flash`，速度极快但幻觉率较高）。
- **读取与控制入口**：
  - **外部无侵入直读（首选）**：读取 `~/.gemini/antigravity/brain/<conversation-id>/.system_generated/logs/transcript.jsonl`（紧凑版）与 `transcript_full.jsonl`（完整版），或运行 `ag_list.ps1` / `ag_read_transcript.ps1` / `ag_quota.ps1`
  - **桌面 CDP 控制（端口 `9234`）**：`opencli antigravity status` / `opencli antigravity send "<msg>"`

## 二、独立能力矩阵（逐项核验记录）
| 能力维度 | 子能力项 | 支持度 | 精确命令 / 协议 / 字段依据 | 核验版本 & 证据 |
|---|---|---|---|---|
| **外部读 Sessions** | `transcript.jsonl` 实时直读 | ✅ 原生完备 | `~/.gemini/antigravity/brain/<uuid>/.system_generated/logs/transcript.jsonl`（含 `USER_INPUT`、`PLANNER_RESPONSE`、`thinking`、`tool_calls`） | `CDP:9234` `〔实测:48+会话〕` |
| **子代理拓扑读取** | Subagents 状态与对话链 | ✅ 原生支持 | `.system_generated/subagents/*.json` + `transcript.jsonl` 中的 `invoke_subagent` / `send_message` | `CDP:9234` `〔实测〕` |
| **外部发消息控制** | CDP `9234` 注入指令 | 🟡 易假成功 | `opencli antigravity send` 返回 `sent:true` 仅代表写入 DOM 输入框，**不代表会话真正收到并触发推理** | `CDP:9234` `〔实测踩坑〕` |

## 三、当前状态、安全参数与防呆红线
- **当前状态**：🟡 可用但需遵守三大强约束
- **三大绝对红线（用户原话与实测铁律）**：
  1. **不让它下判断**：只安排“如实记录、保守分析、原文摘录”类采集活，禁止让其做最终裁决或复杂归因；
  2. **`send` 后必读 `transcript.jsonl` 验真**：调用 `opencli antigravity send` 后，必须等待 3~5 秒并检查对应会话 `transcript.jsonl` 是否新增 `USER_INPUT` 与 `PLANNER_RESPONSE` 步；
  3. **子代理死活只认文件 `mtime`**：`.system_generated/subagents/*.json` 中的 `SUBAGENT_STATE_ALIVE` 存在大量未清理僵尸态（实测 15 个僵尸子代理），一律按 `transcript.jsonl` 的最后修改时间判活。

## 四、渠道升级与功能演进日志
- **2026-10-01 ~ 10-14 · 基线核验**：完成 `ag_list.ps1`、`ag_read_transcript.ps1`、`ag_quota.ps1` 三件套无侵入读取脚本验证。

## 五、状态变化与故障/攻防时间线
- **2026-10-01 · 🟡 发现 `opencli antigravity send` 假成功与 15 个僵尸子代理**：确立“发后读 `transcript.jsonl` 验真 + 按 `mtime` 判活”规矩。

## 六、维护者（S5）挂账与待办
- [ ] 保持 CDP `9234` 连通性巡检；操作桌面进程严格遵守桌面安全六步 SOP。
