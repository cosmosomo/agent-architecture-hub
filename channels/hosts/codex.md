---
channel_id: codex
name: OpenAI Codex CLI & App-Server
category: host
maintainer: S5
status: 🟢 ok
upgrade_status: ✅ verified
verified_version: "0.159.2"
detected_version: "0.159.2"
holder: shared
last_verified_at: "2026-10-14T14:10:00+08:00"
deep_docs_dir: "./codex/"
capabilities:
  observe_only: true
  external_session_read: true
  control_lifecycle: { start: true, resume: true, fork: true, stop: true }
  steer_in_turn: { in_turn: true, next_turn: true, inbox_file: true }
  coordinate_team: { spawn_subagent: true, peer_message: true, task_board: true }
---

# Codex (`codex`) · 宿主能力与渠道维护档案卡（基准样板）

> **长期维护深度知识库入口（4 册基准文档）**：
> 1. **[`./codex/README.md`](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/channels/hosts/codex/README.md)**：核心基本能力抽象（能力层 `会话/轮`、`三状态`、`五必需+四可选+守卫`、`四上行动作×甲乙两路`）与认知框架深度评判（基本使用逻辑、4 大亮点、5 大实证缺陷、权威信息源）
> 2. **[`./codex/app-server.md`](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/channels/hosts/codex/app-server.md)**：`codex app-server` JSON-RPC 2.0 完整协议字典（170 个 Client Request = 107 稳定 + 63 实验、10 个反向 ServerRequest 审批/提问回调、83 个 ServerNotification、17 类 ThreadItem、冷态续接绑定铁律与 SQLite 锁防冲突）
> 3. **[`./codex/cli-commands.md`](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/channels/hosts/codex/cli-commands.md)**：`codex-cli 0.159.2` 全部 23 个顶层子命令实测手册（含 `hooks`/`goals` 伪子命令实证勘误、按“场景→前提→动作与参数→验收→失败停点→出处”六要素编写的 `exec`/`queue`/`doctor`/`features`/`mcp`/`sandbox` 规程，以及 152 项 Feature Flags 分类表）
> 4. **[`./codex/config-and-pitfalls.md`](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/channels/hosts/codex/config-and-pitfalls.md)**：`~/.codex/config.toml` 黄金基线、`hooks.json` 11 类生命周期事件契约、`AGENTS.md` 级联加载规则与 `T-CDX-01..08` 历史故障台账

---

## 一、渠道身份与接入入口
- **角色定位**：聪明但慢（文献引用核查 12/12 全真）；适合高难度推理、跨文件取证核验、长程渠道维护（如 OpenCLI 专职维护会话 `codex://threads/01a0f203-c4db-7d10-91a4-5aa2286239dc`）与代码合成。
- **允许模型**：主力 `gpt-6.1-sol`，轻活 `gpt-6-luna`（**严禁使用旧 `gpt-5.6`**）。
- **CLI / 服务端入口（`0.159.2` 实测确认）**：
  - 非交互启动（做一轮）：`codex exec -C <cwd> --sandbox workspace-write --json "<prompt>"`
  - 非交互恢复：`codex exec resume <session_id> "<prompt>" --json`（或 `--last`）
  - 非交互分叉：`codex exec fork <session_id> "<prompt>" --json`
  - 队列注入（下一轮）：`codex queue --thread <会话编号或名字> --message "<message>"`（2026-10-18 按本机 0.159.2 `--help` 更正：两个都是必填的命名参数，不是位置参数）
  - 环境自检：`codex doctor`
  - 常驻控制服务：`codex app-server --listen stdio://`（或 `ws://127.0.0.1:<port>`，支持 `daemon`/`proxy`/`generate-ts`/`generate-json-schema`）
- **本地会话与状态落盘位置**：
  - 本机默认：`~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl`、`~/.codex/archived_sessions/`、`~/.codex/state_5.sqlite`、`~/.codex/goals_1.sqlite`
  - AP 托管隔离态：`<run-dir>/codex-home/sessions/YYYY/MM/DD/rollout-*.jsonl`

## 二、独立能力矩阵（逐项核验记录 · 对齐《基础能力推演》与《核心抽象》）
| 能力层动作 / 维度 | 支持度 | 精确命令 / `app-server` JSON-RPC 2.0 协议 / 落盘依据 | 核验版本 & 证据 |
|---|---|---|---|
| **开 (`Start`)** | ✅ 原生完备 | CLI: `codex exec --json "<prompt>"`；RPC: `thread/start` + `turn/start` | `0.159.2` `〔实测握手通过〕` |
| **续 (`Resume`)** | ✅ 原生完备 | 冷态：`codex exec resume <id> "<prompt>"` 或 RPC `thread/resume` + `turn/start`；热态：直接 `turn/start` | `0.159.2` `〔实测:1229会话〕` |
| **观察 (`Observe`)** | ✅ 原生最全 | 旁路直读 `rollout-*.jsonl`（含 `session_meta`、`turn_context`、`event_msg`、`response_item`、`token_count`）；RPC 读 `thread/list`、`thread/read` 与 83 种 `ServerNotification` | `0.159.2` `〔实测:thread/list返回〕` |
| **打断 (`Interrupt`)** | ✅ 原生完备 | RPC `turn/interrupt { threadId, turnId }` → 触发 `turn/completed (status="interrupted")` 退回热待命 | `0.159.2` `〔Schema实测〕` |
| **关 (`Close`)** | ✅ 原生完备 | RPC `thread/unsubscribe`（卸载内存保磁盘）；CLI `codex archive <id>` / `codex delete <id>` | `0.159.2` `〔CLI帮助实测〕` |
| **插话 (`Steer`)** | ✅ 双轨支持 | **轮内实时**：RPC `turn/steer { threadId, expectedTurnId, input }`（前提必须有活跃 Turn）；**下一轮排队**：CLI `codex queue --thread <id> --message "<msg>"` | `0.159.2` `〔Schema+CLI实测〕` |
| **回应 (`Respond`)** | ✅ 10类反向请求 | 响应 `ServerRequest`（`item/commandExecution/requestApproval`、`item/fileChange/requestApproval`、`item/tool/requestUserInput`、`mcpServer/elicitation/request` 等） | `0.159.2` `〔Schema实测〕` |
| **分叉 (`Fork`)** | ✅ 双轨支持 | CLI `codex fork <id>` / `codex exec fork <id>`；RPC `thread/fork` | `0.159.2` `〔CLI+Schema实测〕` |
| **整理 (`Compact`)** | ✅ 自动+手动 | 自动 `context_compacted`（本机已发生 218 次）+ 手动 RPC `thread/compact/start` / `thread/rollback` | `0.159.2` `〔Schema+日志实测〕` |
| **守卫与目标 (`Hooks & Goals`)** | ✅ 协议+配置原生 | **注：无 `codex hooks`/`codex goals` CLI 子命令**（`T-CDX-05`）；通过 `~/.codex/hooks.json`（11 类事件）+ RPC `hooks/list`、`thread/goal/{set,get,clear}` 驱动 | `0.159.2` `〔codex help实测勘误〕` |
| **个体嵌套 (`Collab`)** | ✅ 原生完备 | 内置工具 `spawn_agent`、`send_input`、`wait`、`close_agent`（子会话 JSONL 写入 `source.subagent.thread_spawn`） | `0.159.2` `〔实测:spawn 25次〕` |

## 三、当前状态、安全参数与防呆红线
- **当前状态**：🟢 可用（已完成 `UPG-20261014-01` 全量实测与 4 册长期档案建档）
- **必配防断流参数**（`~/.codex/config.toml`）：
  - `request_max_retries = 4`
  - `stream_max_retries = 5`
  - `stream_idle_timeout_ms = 300000`
  - 走银子智能渠道时必须挂本地代理 `http://127.0.0.1:7892`
- **绝对红线（详列于 `./codex/config-and-pitfalls.md` `T-CDX-01..08`）**：
  1. **`T-CDX-01` 上下文压迫**：严禁让裸 Codex 会话直接通读长文档充当 `A1` 总调度，必挂工作台并下放长文阅读；
  2. **`T-CDX-02` 沙箱只读静默失败**：AP 重启必传 `--direct-delivery-project`，直接调 CLI 必传 `--sandbox workspace-write`；
  3. **`T-CDX-04` Windows `apply_patch` 脆弱（累计 165 次报错）**：连续失败 2 次立即停用 `apply_patch`，改用脚本落盘；
  4. **`T-CDX-05` 伪子命令陷阱**：核验子命令必用 `codex help <subcmd>`，切勿用 `codex <word> --help`；
  5. **`T-CDX-06` SQLite 锁冲突**：同一 `CODEX_HOME` 严禁高并发裸起数十个 `codex exec`，优先走单实例 `codex app-server` 多线程复用或分目录隔离。

## 四、渠道升级与功能演进日志
- **2026-10-14 · 完成 `0.118.0 -> 0.159.2` 深度实测与勘误（结项 `UPG-20261014-01`）**：
  - 导出全量 JSON-RPC 2.0 Schema（170 请求 / 10 反向请求 / 83 通知）并通过 `probe_rpc.js` 完成无损握手与只读 `thread/list`、`config/read` 实测；
  - 查明 23 个真实顶层 CLI 子命令（新增 `agents`、`queue`、`archive`/`unarchive`/`delete`、`migrate-rollouts`、`plugin`、`remote-control`、`exec-server`、`doctor`、`update`、`app` 及 `exec {resume,fork,review}`、`app-server {daemon,proxy,generate-ts,generate-json-schema}`）；
  - **关键实证勘误**：证实 `hooks`、`goals`、`mcp-server`、`status` 并非 CLI 子命令，`hooks` 与 `goals` 实为默认开启的稳定 Feature Flag + `hooks.json`/`goals_1.sqlite` + `app-server` 原生 RPC 域。

## 五、状态变化与故障/攻防时间线
- **2026-10-07 14:59 · 🔴 上游银子智能 403 额度耗尽**：全量 Codex 运行返回 HTTP 403，触发 AP `leader-pause-20261007` 排空暂停；补充额度后恢复 🟢。
- **2026-10-03 ~ 10-07 · 🟡 上游断流风暴（`T-CDX-03`）**：49/63 次中途失败源于 `stream disconnected before completion`（浪费 2,368 分钟）；通过配置 `stream_max_retries=5` 与 `7892` 代理收敛。
- **2026-10-02 · 🟡 沙箱只读拒写事故（`T-CDX-02` / P02 / P06）**：重启脚本漏传 `--direct-delivery-project`，导致托管 Codex 退回只读沙箱，心跳正常但无法落盘；已固化至重启脚本。

## 六、维护者（S5）挂账与待办
- [x] 执行升级调研单 [`2026-10-14_codex_0.118_to_0.159.2.md`](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/channels/upgrades/2026-10-14_codex_0.118_to_0.159.2.md)，完成 `0.159.2` 全量 CLI / App-Server / Feature Flags 实测，建成 [`channels/hosts/codex/`](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/channels/hosts/codex/README.md) 长期维护基准目录。
