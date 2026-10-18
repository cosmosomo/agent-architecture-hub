---
channel_id: opencode
name: OpenCode CLI & HTTP Server
category: host
maintainer: S5
status: 🟢 ok
upgrade_status: ✅ synced
verified_version: "1.18.33"
detected_version: "1.18.33"
holder: shared
last_verified_at: "2026-10-14T12:15:00+08:00"
capabilities:
  observe_only: true
  external_session_read: true
  control_lifecycle: { start: true, resume: true, fork: true, stop: true }
  steer_in_turn: { in_turn: true, next_turn: true, inbox_file: true }
  coordinate_team: { spawn_subagent: true, peer_message: false, task_board: false }
---

# OpenCode (`opencode`) · 宿主能力与渠道维护档案卡

## 一、渠道身份与接入入口
- **角色定位**：开源多 Provider CLI 与本地 HTTP/ACP 服务端（支持挂载本地 `opencode serve` 供远程 attach）。
- **CLI / 服务端入口（`1.18.33`）**：
  - 非交互启动与恢复：`opencode run "<msg>" -s <session_id> --format json`
  - 分叉会话：`opencode run -s <session_id> --fork "<msg>"`
  - 离线会话列表與导出：`opencode session list` / `opencode export <sessionId>`
  - 常驻 HTTP 服务端：`opencode serve --port <port>` + `opencode run --attach http://127.0.0.1:<port>`
- **本地会话落盘位置（三层目录束 `opencode/json-dir`）**：
  - 会话 Marker：`~/.local/share/opencode/storage/session/<project>/ses_*.json`
  - 消息文件：`~/.local/share/opencode/storage/message/<sid>/msg_*.json`
  - 步骤分片：`~/.local/share/opencode/storage/part/<msgid>/prt_*.json`

## 二、独立能力矩阵（逐项核验记录）
| 能力维度 | 子能力项 | 支持度 | 精确命令 / 协议 / 字段依据 | 核验版本 & 证据 |
|---|---|---|---|---|
| **外部读 Sessions** | 三层目录束直读与 CLI 列表 | ✅ 原生完备 | `opencodeBundleMembers` 聚合 `session + message + part`（实测 3 会话、20 轮、160 工具调用 0 失败） | `1.18.33` `〔实测:3会话〕` |
| **生命周期控制** | 启动 / 恢复 / 分叉 / 服务端 | ✅ 原生完备 | `opencode run` / `-s <id>` / `--fork` / `opencode serve` | `1.18.33` `〔实测〕` |
| **运行中插话** | HTTP Server 附着控制 | ✅ 原生支持 | `opencode serve` + `--attach` HTTP API | `1.18.33` `〔CLI帮助〕` |
| **团队与子智能体** | `Task` 工具派生子任务 | ✅ 原生支持 | 内置 `Task` 工具（`family: 'agent'`） | `1.18.33` `〔实测〕` |

## 三、当前状态、安全参数与防呆红线
- **当前状态**：🟢 可用
- **解析注意事项**：
  1. 消息必须按 `time.created`、分片按 `time.start` 排序（不能按文件名排序，否则 `u/a` 前缀会导致乱序）；
  2. `step-finish` 的 `tokens` 与消息级 `tokens` 重复，适配器必须去重只计一次。

## 四、渠道升级与功能演进日志
- **2026-10-14 · 基线核验 `1.18.33`**：版本与 `--help` 指纹稳定，无未识别残差（`notes = 0`）。

## 五、状态变化与故障/攻防时间线
- **2026-10-11 · 🟢 完成三层目录束适配器与 Token 去重验证**。

## 六、维护者（S5）挂账与待办
- 暂无挂账，状态健康。
