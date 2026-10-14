---
channel_id: anthropic-official
name: Anthropic 官方登录态 (Claude Opus)
category: model
maintainer: S6
status: 🟡 cooldown_degraded
upgrade_status: ✅ synced
verified_version: "oauth-official"
detected_version: "oauth-official"
holder: core-only
last_verified_at: "2026-10-14T12:15:00+08:00"
capabilities:
  observe_only: true
  external_session_read: false
  control_lifecycle: { start: true, resume: false, fork: false, stop: false }
  steer_in_turn: { in_turn: false, next_turn: false, inbox_file: false }
  coordinate_team: { spawn_subagent: false, peer_message: false, task_board: false }
---

# Anthropic 官方登录态 (`anthropic-official`) · 模型渠道能力与维护档案卡

## 一、渠道身份与接入入口
- **渠道定位**：最高智力王牌（满血官方 `Claude Opus`），**仅限 `A1` 总调度与核心架构决策使用**。
- **接入方式**：Claude Code 原生 OAuth 登录态（不走第三方中转 Base URL）。

## 二、独立能力矩阵（逐项核验记录）
| 能力项 | 支持度 | 已验证模型与特性 | 核验依据 |
|---|---|---|---|
| **满血 Opus 推理** | ✅ 最高质量 | 官方原生 `Claude Opus`（长程规划、架构裁决、复杂排障） | `INDEX.md` `〔用户核定〕` |
| **配额裕度** | 🟡 额度有限 | 会员周/窗口额度不多，不可用于大批量子代理并发采集 | `INDEX.md §二` `〔用户更正口径〕` |

## 三、当前状态、安全参数与防呆红线
- **当前状态**：🟡 受保护可用（`core-only`）
- **绝对红线**：
  1. **严禁将中转渠道的 `opus5.5` 等同于官方登录态满血 Opus**（用户明确纠正：`opus5.5 ≠ 登录态 Opus`）；
  2. 严禁使用官方登录态跑大批量常规文献摘要或网页清洗任务。

## 四、渠道升级与功能演进日志
- **2026-10-14 · 口径对齐**：固化“Anthropic 会员额度不多，只留给核心任务”规则。

## 五、状态变化与故障/攻防时间线
- 无故障，按配额保护策略运行。

## 六、维护者（S6）挂账与待办
- 持续监控 Claude Code `cost-state` 消耗水位。
