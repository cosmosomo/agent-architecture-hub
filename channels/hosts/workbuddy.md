---
channel_id: workbuddy
name: Tencent WorkBuddy / CodeBuddy CLI
category: host
maintainer: S5
status: 🟢 ok
upgrade_status: ✅ synced
verified_version: "2.160.0"
detected_version: "2.160.0"
holder: shared
last_verified_at: "2026-10-14T12:15:00+08:00"
capabilities:
  observe_only: true
  external_session_read: true
  control_lifecycle: { start: true, resume: true, fork: true, stop: true }
  steer_in_turn: { in_turn: true, next_turn: true, inbox_file: true }
  coordinate_team: { spawn_subagent: true, peer_message: false, task_board: true }
---

# WorkBuddy / CodeBuddy (`workbuddy`) · 宿主能力与渠道维护档案卡

## 一、渠道身份与接入入口
- **角色定位**：高性价比备用调研主力（与桌面版共享腾讯官方 Credits 池，且可通过 `--model glm-5.3` 复用智谱额度）。
- **推荐模型**：优先 `DeepSeek V4.1 Flash` / `GLM Flash`（省 Credits），复杂任务用 `--model glm-5.3`。
- **CLI 入口（`codebuddy` `v2.160.0`）**：
  - 非交互执行：`codebuddy -p "<prompt>" -y --output-format json`
  - 续接会话：`codebuddy -c`（最近一次）或 `codebuddy -r <session_id>`
  - 服务与协议模式：`codebuddy --serve`、`codebuddy --acp`、`codebuddy --bg`、`codebuddy agents --json`
- **本地会话落盘位置**：
  - 主数据库：`~/.workbuddy/workbuddy.db`（SQLite，实测含 135 个历史会话、121 次自动化运行）
  - 进程心跳文件：`~/.workbuddy/sessions/<pid>.json`

## 二、独立能力矩阵（逐项核验记录）
| 能力维度 | 子能力项 | 支持度 | 精确命令 / 协议 / 字段依据 | 核验版本 & 证据 |
|---|---|---|---|---|
| **外部读 Sessions** | SQLite 主库与 PID 心跳读取 | ✅ 原生支持 | 只读查询 `~/.workbuddy/workbuddy.db` + `~/.workbuddy/sessions/<pid>.json` | `2.160.0` `〔实测:135会话〕` |
| **生命周期控制** | 启动 / 续接 / 后台守护 | ✅ 原生完备 | `codebuddy -p -y` / `-c` / `-r <sid>` / `--bg` / `codebuddy stop <id>` | `2.160.0` `〔实测〕` |
| **运行中插话** | 服务端与 ACP 协议 | 🟡 协议支持 | `codebuddy --serve` / `--acp` / `--input-format stream-json` | `2.160.0` `〔CLI帮助〕` |
| **团队与子智能体** | 内置子代理派生 | ✅ 原生支持 | `codebuddy agents --json` + 内置 `Task` / `Agent` 工具 | `2.160.0` `〔实测〕` |

## 三、当前状态、安全参数与防呆红线
- **当前状态**：🟢 可用
- **安全参数与防呆红线**：
  1. **Windows 中文 Prompt 必走文件读取**：在 PowerShell 中直接把长段中文塞进 `codebuddy -p "..."` 极易因 GBK/UTF-8 编码截断乱码，必须先把任务写入 `.md` 文件再让其读取；
  2. **禁用驼峰 `--dangerously-Skip-Permissions`**：该写法在 CodeBuddy 中无效，一律用 `-y` 或全小写 `--dangerously-skip-permissions`；
  3. **密钥防泄漏红线**：`~/.workbuddy/models.json` 中存有明文第三方 API Key，严禁将该文件纳入任何公开导出或原文回显。

## 四、渠道升级与功能演进日志
- **2026-10-01 ~ 10-14 · 基线核验 `2.160.0`**：确认 CLI 与桌面版 Credits 池互通及 BYOK `--model glm-5.3` 可用。

## 五、状态变化与故障/攻防时间线
- **2026-10-01 · 🟢 解决中文命令行编码截断**：确立“文件传参优先 + `chcp 65001`”规矩。

## 六、维护者（S5）挂账与待办
- [ ] 后续可在 `trace/packages/adapters/` 新增 `workbuddy` SQLite 只读适配器，将 `~/.workbuddy/workbuddy.db` 的 135 个会话并入观察台。
