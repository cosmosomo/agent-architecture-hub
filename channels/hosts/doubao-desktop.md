---
channel_id: doubao-desktop
name: 豆包 Desktop (Doubao & DoubaoWork)
category: host
maintainer: S5
status: 🟡 cooldown_degraded
upgrade_status: 🔍 watch_external_sessions
verified_version: "CDP:9225"
detected_version: "CDP:9225"
holder: user-active
last_verified_at: "2026-10-19T16:15:00+08:00"
capabilities:
  observe_only: false
  external_session_read: true
  control_lifecycle: { start: false, resume: false, fork: false, stop: false }
  steer_in_turn: { in_turn: false, next_turn: false, inbox_file: true }
  coordinate_team: { spawn_subagent: true, peer_message: false, task_board: false }
---

# 豆包 Desktop (`doubao-desktop`) · 宿主能力与渠道维护档案卡

## 一、渠道身份与接入入口
- **角色定位**：并行搜索特化执行者（智能体推理较弱但搜索召回极强，支持在客户端内直接启动多智能体并行搜索）。
- **本机安装形态**：同时装有普通版 `Doubao` 与办公版 `DoubaoWork` 两个客户端。
- **控制与读取入口**：
  - **CDP 端口控制（依赖 `--remote-debugging-port=9225`）**：`opencli doubao-app status / ask / send / read / new / screenshot / dump`
  - **文件投递/交付通道（首选）**：派活前先指定本地交付文件绝对路径，由豆包将搜索结果写入指定路径。
    - `%LOCALAPPDATA%\Doubao\User Data\Default\.doubao\agent_mode\workspace\.sessions\<id>\`
    - 结构：含 `agents/<id>/system/assignment.md`（需求）、`trajectory.jsonl`（轨迹）、`findings.jsonl`（发现）、`background_history_task/index.json`（后台命令）、`board.md`，无锁且格式标准，外部可直接只读旁路解析！
  - **历史对话目录（普通聊天）**：
    - `%LOCALAPPDATA%\Doubao\User Data\Default\saman_shell_db_storage\`（Chromium LevelDB 二进制块，客户端运行时独占锁）

## 二、独立能力矩阵（逐项核验记录）
| 能力维度 | 子能力项 | 支持度 | 精确命令 / 协议 / 字段依据 | 核验版本 & 证据 |
|---|---|---|---|---|
| **外部读 Sessions** | 离线读取 Agent 会话库 | ✅ 已打通 | 读取 `%LOCALAPPDATA%\Doubao\User Data\Default\.doubao\agent_mode\workspace\.sessions` 下的 `assignment.md` 与 `trajectory.jsonl` | `2026-10-19` `〔实测:文件存在且无锁〕` |
| **电脑操作 (Computer Use)** | 虚拟桌面免打扰操作 | ✅ 原生支持 | 基于 GAC(GUI as Coding) 协议与 `seed_computer_use` SDK，支持 `switch_desktop("pip")` 切换至画中画虚拟桌面会话，纯视觉截图与归一化键鼠动作，不移动宿主物理鼠标、不抢键盘焦点 | `2026-10-19` `〔实测:SDK代码与官方发布〕` |
| **DOM 在线读取/控制** | 读取当前激活会话内容与发话 | 🟡 依赖 CDP | 需以 `--remote-debugging-port=9225` 启动后调 `opencli doubao-app ask/send/read/dump`；win32 下 OpenCLI 暂不支持自动拉起 | `CDP:9225` `〔实测〕` |
| **内置并行搜索** | 创建多智能体并行联网搜索 | ✅ 原生强项 | 客户端内置多智能体并行搜索能力（观察台记为 `native` 专属能力） | `CDP:9225` `〔用户核定〕` |

## 三、当前状态、安全参数与防呆红线
- **当前状态**：🟡 用户前台使用中（CDP `9225` 待空闲窗口按需开启）
- **绝对红线**：
  1. **严禁重启、杀进程或改动用户在用的两个豆包客户端配置**；
  2. **派活前必给交付文件路径**：豆包智能体较笨，指令必须简短明确，第一行写清“将结果保存到 `<绝对路径>`”。

## 四、渠道升级与功能演进日志
- **2026-10-19 · 🟢 突破：发现 Agent 模式明文会话库与 PiP 虚拟桌面机制**：
  - **会话存储突破**：在 `.doubao\agent_mode\workspace\.sessions` 发现完整的 Markdown 与 JSONL 轨迹，无需再破解 LevelDB，中心可直接做会话发现与回看；
  - **电脑操作闭环**：在 `task-mode-resource\python-packages\gac_runtime` 查明 GAC 协议与 `seed_computer_use`，确认 `switch_desktop("pip")` 支持隔离虚拟桌面操作，解决“不能占用用户屏幕、鼠标、键盘”的核心诉求；
  - **OpenCLI 适配实测**：确认 OpenCLI `doubao-app` 适配器可用，但 win32 下 OpenCLI 不支持自动拉起，且受不能杀进程红线限制，需在启动时带参 `--remote-debugging-port=9225` 或单独启动隔离的后台实例。
- **2026-10-14 · 建立“外部查看 Sessions 开放性哨兵（`WATCH-DOUBAO-01`）”**：
  - `check_channels.js` 每次巡检自动扫描 `%LOCALAPPDATA%\Doubao` 与 `%APPDATA%\Doubao` 下是否出现新增的 `*.sqlite`、`*.db`、`sessions/`、`transcripts/`、`export/` 目录或新增本地 CLI/HTTP 端口；
  - 一旦豆包版本更新开放外部查看 sessions 的文件或接口，巡检脚本立即触发 `🔍 upgrade_pending` 告警并通知 **S5 / S3** 立项接入 `trace` 适配器！

## 五、状态变化与故障/攻防时间线
- **2026-10-01 · 🟡 核清 LevelDB 存储锁与 CDP 9225 边界**：确认运行时直接拷 LevelDB 易遇文件锁，优先走“指定路径文件交付 + 空闲窗口 CDP 9225”。

## 六、维护者（S5）挂账与待办
- [ ] 持续运行哨兵单 [`WATCH_doubao-desktop_external_sessions.md`](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/channels/upgrades/WATCH_doubao-desktop_external_sessions.md)，监测客户端更新动态。
