---
channel_id: factory-droid
name: Factory.ai Droid CLI & Daemon
category: host
maintainer: S5
status: 🟢 ok
upgrade_status: ✅ synced
verified_version: "0.228.0"
detected_version: "0.228.0"
holder: shared
last_verified_at: "2026-10-14T12:15:00+08:00"
capabilities:
  observe_only: true
  external_session_read: true
  control_lifecycle: { start: true, resume: true, fork: true, stop: true }
  steer_in_turn: { in_turn: false, next_turn: true, inbox_file: true }
  coordinate_team: { spawn_subagent: true, peer_message: false, task_board: true }
---

# Factory Droid (`factory-droid`) · 宿主能力与渠道维护档案卡

## 一、渠道身份与接入入口
- **角色定位**：内置 **Worker + Validator 双模型独立验收 Mission** 机制的工程执行器（支持在单次 Mission 中分别指定 `--worker-model` 与 `--validator-model`）。
- **CLI / 守护入口（`droid` `0.228.0`）**：
  - 非交互启动与续接：`droid exec "<prompt>" -s <session_id> --output-format stream-json`
  - 分叉会话：`droid exec -s <session_id> --fork "<prompt>"`
  - 双模型 Mission 模式：`droid exec --mission --worker-model <m1> --validator-model <m2> "<prompt>"`
  - 后台守护：`droid daemon`
- **本地会话落盘位置**：
  - 会话日志：`~/.factory/sessions/<encoded-cwd>/<uuid>.jsonl`
  - 会话配置与活跃时长：`~/.factory/sessions/<encoded-cwd>/<uuid>.settings.json`

## 二、独立能力矩阵（逐项核验记录）
| 能力维度 | 子能力项 | 支持度 | 精确命令 / 协议 / 字段依据 | 核验版本 & 证据 |
|---|---|---|---|---|
| **外部读 Sessions** | JSONL + `.settings.json` 直读 | ✅ 原生完备 | 直读 `~/.factory/sessions/**/*.jsonl`（含 `session_start`、`message`、`todo_state`、`compaction_state`） | `0.228.0` `〔实测:7会话〕` |
| **生命周期控制** | 启动 / 续接 / 分叉 / 权限档 | ✅ 原生完备 | `droid exec` / `-s <id>` / `--fork` / `--auto low\|medium\|high` | `0.228.0` `〔CLI帮助/实测〕` |
| **原生计划与压缩** | `todo_state` 与 `compaction_state` | ✅ 原生支持 | 落盘独立 `todo_state`（含 `priority`、`status`）与 `compaction_state`（含 `summaryText`） | `0.228.0` `〔实测〕` |
| **双模型 Mission** | Worker 产出 + Validator 验收 | ✅ 独家特性 | `--mission --worker-model --validator-model` + `ProposeMission` / `StartMissionRun` | `0.228.0` `〔实测〕` |

## 三、当前状态、安全参数与防呆红线
- **当前状态**：🟢 可用
- **解析与使用要点**：
  1. `factory` 落盘的 `todo_state` 与 `compaction_state` 是独立顶层 JSONL 行，已在 `trace/packages/adapters/src/factory/parse.ts` 完整映射为计划 `todos` 与 `EventStep: compaction`。

## 四、渠道升级与功能演进日志
- **2026-10-14 · 基线核验 `0.228.0` & 消除 14 条未识别残差**：
  - 修复 `todo_state`（10 次）与 `compaction_state`（4 次）未识别告警，并支持从目录名反解 `cwd`。

## 五、状态变化与故障/攻防时间线
- **2026-10-14 · 🟢 适配器全量 7 会话 0 未识别残差通过**。

## 六、维护者（S5）挂账与待办
- [x] 已消解 `type:todo_state` 与 `type:compaction_state` 残差。
