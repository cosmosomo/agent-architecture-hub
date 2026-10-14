---
channel_id: claude-code
name: Anthropic Claude Code CLI
category: host
maintainer: S5
status: 🟢 ok
upgrade_status: 🔍 delta_detected
verified_version: "2.1.85"
detected_version: "2.1.296"
holder: shared
last_verified_at: "2026-10-14T12:15:00+08:00"
capabilities:
  observe_only: true
  external_session_read: true
  control_lifecycle: { start: true, resume: true, fork: true, stop: true }
  steer_in_turn: { in_turn: true, next_turn: true, inbox_file: true }
  coordinate_team: { spawn_subagent: true, peer_message: true, task_board: true }
---

# Claude Code (`claude-code`) · 宿主能力与渠道维护档案卡

## 一、渠道身份与接入入口
- **角色定位**：中心设计 / Leader / `A1` 总调度首选（速度快、工具链成熟）；核心决策用官方登录态满血 Opus，日常执行用 `2Chatkiro`（Grok 4.6 / `opus5.5`）或银子渠道。
- **CLI / 进程控制入口**：
  - 非交互启动：`claude -p "<prompt>" --output-format stream-json --verbose`
  - 后台守护启动：`claude --bg -p "<prompt>"`
  - 会话续接与分叉：`claude --resume <session_id> -p "<prompt>"` / `--fork-session`
  - 在线实例巡检与控制：`claude agents --json`、`claude ps`、`claude logs <id>`、`claude attach <id>`、`claude stop <id>`
- **本地会话落盘位置**：
  - 主会话：`~/.claude/projects/<encoded-cwd>/<uuid>.jsonl`
  - 子智能体：`~/.claude/projects/<encoded-cwd>/<session-uuid>/subagents/agent-<id>.jsonl`
  - 编排工作流：`~/.claude/projects/<encoded-cwd>/workflows/`

## 二、独立能力矩阵（逐项核验记录）
| 能力维度 | 子能力项 | 支持度 | 精确命令 / 协议 / 字段依据 | 核验版本 & 证据 |
|---|---|---|---|---|
| **外部读 Sessions** | 主会话与 Subagents 直读 | ✅ 原生完备 | 直读 `.claude/projects/**/*.jsonl`（含 `assistant`、`user`、`tool_use`、`tool_result`、`cost-state`、`thinking`） | `2.1.296` `〔实测:227会话〕` |
| **在线活跃探测** | 精确查询本机运行中进程 | ✅ 原生完备 | `claude agents --json`（直接输出 PID、`sessionId`、`status: idle\|working`、`cwd`） | `2.1.296` `〔实测〕` |
| **生命周期控制** | 启动 / 续接 / 分叉 / 停止 | ✅ 原生完备 | `claude -p` / `--bg` / `--resume <id>` / `--fork-session` / `claude stop <id>`（优雅停止并保留上下文） | `2.1.296` `〔实测〕` |
| **运行中插话** | 轮内流式注入与附着 | ✅ 原生支持 | `--input-format stream-json` stdin 双向流、`claude attach <id>`、Hook `additionalContext` | `2.1.296` `〔CLI帮助/协议〕` |
| **生命周期 Hooks** | 12+ 事件拦截与回注 | ✅ 原生完备 | `SessionStart`、`UserPromptSubmit`、`PreToolUse`、`PostToolUse`、`SubagentStart`、`SubagentStop`、`Stop` 等 | `2.1.296` `〔文档/实测〕` |
| **团队与子智能体** | 派生 / 结队 / 看板 / 消息 | ✅ 原生完备 | `Agent`（176 次）、`TeamCreate`、`SendMessage`、`TaskCreate/Update/List`、`ScheduleWakeup` | `2.1.296` `〔实测〕` |

## 三、当前状态、安全参数与防呆红线
- **当前状态**：🟢 可用（附 `🔍 UPG-20261014-02` 升级调研单待 S5 验收后台进程池管理子命令）
- **安全参数与红线**：
  1. **官方 Opus 核心额度保护**：Anthropic 官方登录态额度有限，仅限 `A1` 总调度或核心架构设计使用；切勿把中转渠道的 `opus5.5` 当作官方登录态满血 Opus；
  2. 切换 `~/.cc-switch` 供应商前，先跑 `claude agents --json` 确认无活跃 `working` 会话。

## 四、渠道升级与功能演进日志
- **2026-10-14 · 版本跃迁 `2.1.85 -> 2.1.296`（触发调研单 `UPG-20261014-02`）**：
  - 探测到 `claude --help` 新增完整后台会话管理套件：`--bg`、`claude ps`、`claude logs`、`claude attach`、`claude stop`、`claude agents --json`，以及 `--forward-subagent-text`、`--exclude-dynamic-system-prompt-sections`（跨机器 Prompt 缓存优化）。

## 五、状态变化与故障/攻防时间线
- **2026-10-11 · 🟢 适配器修复顶层 `tool_result` 误判**：确认真实落盘中工具结果位于 `user` 消息的 `message.content` 块内，配对率达 100%（3,274 次工具调用零丢失）。

## 六、维护者（S5）挂账与待办
- [ ] 执行升级调研单 [`2026-10-14_claude-code_2.1.85_to_2.1.296.md`](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/channels/upgrades/2026-10-14_claude-code_2.1.85_to_2.1.296.md)，实测 `claude --bg` + `claude stop <id>` 在观察台反向控制端点中的闭环表现。
