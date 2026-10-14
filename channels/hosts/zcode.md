---
channel_id: zcode
name: ZCode (CLI & Electron Desktop)
category: host
maintainer: S5
status: 🟢 ok
upgrade_status: ✅ synced
verified_version: "0.16.9"
detected_version: "0.16.9"
holder: shared
last_verified_at: "2026-10-14T12:15:00+08:00"
capabilities:
  observe_only: true
  external_session_read: true
  control_lifecycle: { start: true, resume: true, fork: false, stop: false }
  steer_in_turn: { in_turn: false, next_turn: true, inbox_file: true }
  coordinate_team: { spawn_subagent: true, peer_message: true, task_board: true }
---

# ZCode (`zcode`) · 宿主能力与渠道维护档案卡

## 一、渠道身份与接入入口
- **角色定位**：日常文献/代码调研主力（跑智谱 GLM，速度快、成本低、智力稳）；同时担任 AP-Vibe 管理员常设会话（`sess_c328c093`）。
- **版本组成**：CLI 内核 `0.16.9` + Electron 桌面壳 `3.14.3+`。
- **读取与控制入口**：
  - **外部无侵入直读（首选，不依赖 CDP）**：
    - `opencli zcode list` / `opencli zcode tasks`
    - `opencli zcode subagents <sess_id> --alive`
    - `opencli zcode read-transcript <sess_id> --last N`
  - **桌面 UI 控制（依赖 CDP 端口 `9240`）**：
    - `opencli zcode status` / `opencli zcode send` / `opencli zcode new` / `opencli zcode open`
- **本地会话落盘位置（4 处互补数据源）**：
  1. CLI 主数据库：`~/.zcode/cli/db/db.sqlite`（含 `session` 708 条、`message` 43,663 条、`part` 122,424 条、`model_usage` 39,070 条、`session_task_link`）
  2. 桌面版任务快照：`~/.zcode/v2/sessions/<project-hash>/<taskId>.json`（133 个文件）与 `~/.zcode/v2/tasks-index.sqlite`
  3. 主会话滚动日志：`~/.zcode/cli/log/zcode-<date>.jsonl`
  4. 子代理实时落盘：`~/.zcode/cli/rollout/model-io-<sess_id>.jsonl`

## 二、独立能力矩阵（逐项核验记录）
| 能力维度 | 子能力项 | 支持度 | 精确命令 / 协议 / 字段依据 | 核验版本 & 证据 |
|---|---|---|---|---|
| **外部读 Sessions** | SQLite + JSON + Rollout 直读 | ✅ 原生完备 | 只读挂载 `db.sqlite`（`session/message/part/model_usage/session_task_link`）+ `.zcode/v2/sessions/*.json` | `0.16.9` `〔实测:539会话〕` |
| **活跃状态判定** | 识别真实运行 vs 僵尸会话 | ⚠️ 需修正 | **`tasks-index.sqlite` 的 `status='running'` 不可信（实测 8 个僵尸会话）**；必须按日志文件 `mtime` 与 `time_updated` 判活 | `0.16.9` `〔实测:8僵尸〕` |
| **生命周期与发消息** | 桌面 CDP 注入与 CLI 会话 | 🟡 依赖 CDP | 桌面端经 CDP `9240` 调 `opencli zcode send/new`；CLI headless 無法独立解密桌面 `enc:v1` 凭证 | `0.16.9` `〔实测〕` |
| **团队与子智能体** | DWF 动态工作流与子代理 | ✅ 原生支持 | `session.parent_id`（315 个子会话）+ `session_task_link`（17 条 DWF 链接）+ `Task` 工具 | `0.16.9` `〔实测〕` |

## 三、当前状态、安全参数与防呆红线
- **当前状态**：🟢 可用
- **桌面安全六步 SOP（铁律）**：
  1. 先快照进程与命令行（`Get-CimInstance Win32_Process`）；
  2. 先备份配置文件；
  3. **严禁使用 `Stop-Process -Name ZCode` 一刀切杀进程**（只按 PID 关自己拉起的子进程）；
  4. 改完配置必验 JSON 语法与字段完整性；
  5. 检查端口（`9240`）与窗口焦点（不抢用户前台焦点）；
  6. 异常立即回滚备份。
- **并发建议**：单桌面实例同时活跃复杂调研任务建议 $\le 3$ 个。

## 四、渠道升级与功能演进日志
- **2026-10-14 · 基线核验 `0.16.9`**：
  - 确认 `db.sqlite` 表集合为：`session`、`message`、`part`、`todo`、`permission`、`project`、`session_share`、`workspace`、`session_Summary_cache`、`session_task_link`、`model_usage`；
  - 在 `trace` 适配器中补齐对 `part.type === 'compaction'`（18 次）与 `part.type === 'file'`（22 次）及 `session_task_link` 的解析。

## 五、状态变化与故障/攻防时间线
- **2026-10-01 ~ 10-14 · 🟡 GLM 窗口限流与自动重试**：`model_usage` 累计记录 `rate_limited` 640 次、`cancelled_by_user` 93 次、`network_error` 41 次；内置指数退避重试多数可自愈。
- **2026-10-01 · 🟡 发现 8 个 `status=running` 僵尸会话**：确立“只认对应日志文件 `mtime`，不信数据库 `running` 标记”的判活金标准。

## 六、维护者（S5）挂账与待办
- [x] 已在 `trace/packages/adapters/src/zcode/db.ts` 接入 `compaction` / `file` part 与 `session_task_link`。
