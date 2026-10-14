---
channel_id: ap-vibe
name: AP-Vibe 协作工作台与托管伙伴池 (:8876)
category: host
maintainer: S5
status: 🟢 ok
upgrade_status: ✅ synced
verified_version: "8876-agent-hub"
detected_version: "8876-agent-hub"
holder: shared
last_verified_at: "2026-10-14T12:15:00+08:00"
capabilities:
  observe_only: true
  external_session_read: true
  control_lifecycle: { start: true, resume: true, fork: false, stop: true }
  steer_in_turn: { in_turn: false, next_turn: true, inbox_file: true }
  coordinate_team: { spawn_subagent: true, peer_message: true, task_board: true }
---

# AP-Vibe 工作台 (`ap-vibe`) · 宿主能力与渠道维护档案卡

## 一、渠道身份与接入入口
- **角色定位**：`sota` 多智能体团队的统一任务账本、黑板消息中心、伙伴池自动触发器与手机端远程监看台（对口管理员：ZCode 会话 `sess_c328c093`，源码仓 `E:\program\GIT\Agent\agent-hub`，分支 `fix/p16-followups`）。
- **服务端点与工具入口**：
  - 本机 HTTP：`http://127.0.0.1:8876`（EasyTier 手机端：`http://10.126.126.1:8876`）
  - 账本查询 CLI：`python E:\program\sota\code\ap_ledger.py`（全走 HTTP API，不碰 SQLite）
  - 安全排空重启脚本：`E:\program\GIT\Agent\agent-hub\scripts\deploy_drain_restart.ps1`
- **托管会话落盘位置**：
  - 服务端日志：`%TEMP%\ap-dev-8876\server-*.log`
  - 托管 Codex 会话：`<run-dir>\codex-home\sessions\YYYY\MM\DD\rollout-*.jsonl`

## 二、独立能力矩阵（逐项核验记录）
| 能力维度 | 子能力项 | 支持度 | 精确命令 / 协议 / 字段依据 | 核验版本 & 证据 |
|---|---|---|---|---|
| **外部读账本与日志** | HTTP API + 托管 `codex-home` | ✅ 原生完备 | `ap_ledger.py` (HTTP `:8876`) + 托管目录 `rollout-*.jsonl` | `8876` `〔实测:1170次运行〕` |
| **常设角色化调度** | `sota·A1` + 24 执行 + 5 验收 + `S3` | ✅ 原生支持 | `agent_Trigger` 自动拉起 + `ap_vibe_blackboard` 黑板通信 + `ap_vibe_tasks` 任务认领 | `8876` `〔实测〕` |
| **排空暂停与恢复** | 故障期安全排空停机 | ✅ 原生支持 | `leader-pause` 排空锁 + `deploy_drain_restart.ps1` | `8876` `〔实测〕` |

## 三、当前状态、安全参数与防呆红线
- **当前状态**：🟢 可用
- **三大绝对铁律（来自 `AP-Vibe底层问题记录.md` P01~P22 血泪教训）**：
  1. **铁律 P22（严禁直读运行中 SQLite）**：**任何智能体或脚本严禁直接打开运行中 8876 的 SQLite 数据库文件**（即便带 `mode=ro` 或 `immutable=1`，在 Windows WAL 模式下也会导致 AP 主进程出现 `attempt to write a readonly database` 崩溃）！查账本 100% 走 `http://127.0.0.1:8876` HTTP 接口；
  2. **铁律 P02/P06（重启必带 `--direct-delivery-project`）**：重启 8876 必须使用 `deploy_drain_restart.ps1` 并确保携带 `--direct-delivery-project E:\program\sota`，否则托管 Codex 退回只读沙箱，心跳正常但零文件产出；
  3. **铁律 P21（跨宿主 Skill 直读）**：托管运行带 `--ignore-user-config` 时不自动扫用户目录 Skill，需在任务书 `required_files` 显式给出 `SKILL.md` 绝对路径。

## 四、渠道升级与功能演进日志
- **2026-10-07 ~ 10-14 · 完成 P01~P22 底层问题治理与 `关键路径.md` 建立**。

## 五、状态变化与故障/攻防时间线
- **2026-10-07 14:59 · 🔴->🟢 银子智能 403 触发全局排空暂停（`leader-pause-20261007`）**：验证了排空暂停机制的有效性。
- **2026-10-05 · 🔴->🟢 P22 外部只读挂载 SQLite 引发 `readonly database` 事故**：封禁一切外部直连 SQLite 行为。

## 六、维护者（S5 / AP 管理员）挂账与待办
- [ ] 在观察台 `analysis.js` 中固化 P02/P06（只读沙箱零产出）与 P22（`readonly database`）的 1 分钟自动体检报警规则。
