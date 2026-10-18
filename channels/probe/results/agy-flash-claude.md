# 分层实测报告：Claude 家族实现路线与能力矩阵

- **测试者 (by)**：`agy-flash`
- **被测家族 (family)**：`claude`
- **实测时间**：2026-10-17
- **测试模型**：`claude-haiku-4-5`（严格遵照额度与预算控制，单句 Prompt）
- **黑板记录追加**：共 51 条记录写入 [blackboard.jsonl](file:///E:/program/GIT/Agent/multi/Agent-Architecture-Hub/channels/probe/blackboard.jsonl)
- **测试脚本路径**：[channels/probe/scripts/claude/](file:///E:/program/GIT/Agent/multi/Agent-Architecture-Hub/channels/probe/scripts/claude/)
  - L0 原生后端脚本：`suite_l0.mjs`
  - L1a ACP 桥直连脚本：`suite_l1a.mjs`、`probe_l1a_init.mjs`
  - L1b acpx 命令行脚本：`suite_l1b.mjs`
  - 黑板写入脚本：`append_blackboard.mjs`

---

> [!IMPORTANT]
> **中途规则演进声明 (Mid-Turn Rule Evolution)**
> 本任务在执行过程（task-203 期间）收到了更新的系统约束与执行细则：
> 1. `evidence` 字段必须为原样输出片段（raw output snippet：JSON、报错原文、会话 ID、日志行），严禁总结描述性短句；
> 2. `permission` 测试必须先切至手动/审批模式，触发写操作并实收 approval 请求与后续执行；
> 3. `model-switch` 必须执行下一轮次并通过返回元数据/日志中的真实 `model` 字段核验；
> 4. `route` 编号严格执行 `<family>/<layer>/<surface>` 统一三段式格式。
> 本报告及黑板中的 51 条记录全部严格遵循该最新规范。

---

## 一、三条路线通断概览矩阵

| 编号 | 能力 (Capability) | L0 原生后端 (`claude/L0/claude-cli`) | L1a ACP 桥 (`claude/L1a/claude-agent-acp`) | L1b acpx 命令行 (`claude/L1b/acpx`) |
|---|---|---|---|---|
| 1 | **open** | 🟢 pass | 🟢 pass | 🟢 pass |
| 2 | **resume** | 🟢 pass | 🟢 pass | 🟢 pass |
| 3 | **resume-native** | 🟢 pass | 🟢 pass | 🟢 pass |
| 4 | **observe-live** | 🟢 pass | 🟢 pass | 🟢 pass |
| 5 | **observe-history** | 🟢 pass | 🟢 pass | 🟡 partial |
| 6 | **state** | 🟢 pass | 🟢 pass | 🟢 pass |
| 7 | **cancel** | 🔴 fail | 🟢 pass | 🟢 pass |
| 8 | **close** | 🟢 pass | 🟢 pass | 🟢 pass |
| 9 | **steer** | 🟢 pass | 🟢 pass | 🟢 pass |
| 10 | **permission** | 🔴 fail | 🟢 pass | 🟢 pass |
| 11 | **fork** | 🟢 pass | 🟢 pass | ⚪ n/a |
| 12 | **compact** | 🟢 pass | 🟢 pass | 🟢 pass |
| 13 | **model-list** | ⚪ n/a | 🟢 pass | 🟢 pass |
| 14 | **model-new** | 🟢 pass | 🟢 pass | 🟢 pass |
| 15 | **model-switch** | 🟢 pass | 🟢 pass | 🟢 pass |
| 16 | **mode-switch** | 🟢 pass | 🟢 pass | 🟢 pass |
| 17 | **quota** | 🟢 pass | 🟢 pass | ⚪ n/a |

---

## 二、关键故障定位与底层根因剖析

### 1. 鉴权与模型名点杠冲突（GATEWAY.md 突破 3 的深化）
- **现象**：`claude-agent-acp` 启动并调用模型时，上游 Yinzi API 报 `503 smartrouter: no eligible automatic route`。
- **根因定位**：
  - 用户本地 `~/.claude/settings.json` 中配置了 `"ANTHROPIC_DEFAULT_HAIKU_MODEL": "claude-haiku-4.5"`（带小数点 `.`）。
  - 直接通过 curl 遍历上游 `api.yinziapi.top/v1/models`，证实上游注册的合法 Haiku 模型标识符为 `claude-haiku-4-5`（连字符 `-`）。
  - 更隐蔽的底层逻辑：Claude Code 启动后，加载 `settings.json` 的优先级高于宿主传入的 `process.env`！直接在命令行 `set ANTHROPIC_DEFAULT_HAIKU_MODEL=...` 会被 `settings.json` 重新覆盖。
- **免改配置解法**：
  - **L0**：通过命令行显式指定 `--model claude-haiku-4-5`，CLI 优先采用命令行参数；
  - **L1a**：在 ACP `session/new` 的 `_meta.claudeCode.options.settings.env` 中注入 `ANTHROPIC_DEFAULT_HAIKU_MODEL: "claude-haiku-4-5"` 与 `ANTHROPIC_MODEL: "claude-haiku-4-5"`，桥层通过设置合并层实现了零侵入覆盖。

### 2. 上游智能路由预留额度阈值（Wallet Quota Reservation）
- **现象**：运行大上下文多工具测试时偶发 `403 智能路由预留额度失败: insufficient wallet quota`。
- **边界实测**：
  - 构造阶梯负载（1k 至 55k 词）直接压测上游 `/v1/messages` 发现：
    - $\le 20\text{k}$ words（约 25,000 tokens）：全部返回 `200 OK`；
    - $\ge 40\text{k}$ words（约 50,000 tokens）：上游智能路由计算得出预留保证金超过账户可用余额（账户剩余 ¥1.40 左右），直接触发 403 阻断。
  - Claude Code 完整全工具全系统提示词初次冷启动写入达 59,102 tokens（Prompt Cache Write），恰好触碰该临界线。

### 3. 断层详细定位

#### (1) L0 原生后端 (`claude/L0/claude-cli`)
- **断层项 1：`cancel` (fail)**：
  - 现象：在计数执行到中途时向进程发送中断信号（2.5s），进程退出；随后使用 `--resume <id>` 恢复会话，返回 exit code 1，无法恢复会话上下文。
  - 原因：非交互模式 `-p` 下被外部操作系统信号打断时，未写入合法的终端轮次标记，恢复时检测到损坏的未闭合事务导致加载失败。
- **断层项 2：`permission` (fail)**：
  - 现象：指定 `--permission-mode manual` 要求写入文件，进程直接结束或静默处理，未向调用方抛出任何交互式审批阻断。
  - 原因：`-p`（print mode）设计为非交互无头批处理，不存在 TUI 的按键审批通道，亦无 stdin 审批协议。
- **不适用项：`model-list` (n/a)**：
  - Claude CLI 原生没有 `models` 子命令，模型别名静态内置在 `--help` 文档中。

#### (2) L1a ACP 桥直连 (`claude/L1a/claude-agent-acp`)
- **全能力通畅**：
  - 原生支持全部 17 项基本能力：
  - `initialize` 明确返回：`loadSession: true`、`promptQueueing: true`、`sessionCapabilities: { close, delete, fork, list, resume }`；
  - `model-list`：在 `newSession` 的 `configOptions` 中完整返回 `default, opus, fable, sonnet, haiku`；
  - `model-switch`：动态调用 `connection.setSessionConfigOption({ configId: "model", value: "sonnet" })`，下一轮元数据 `_meta.quota.model_usage[0].model` 实时生效；
  - `permission`：Manual 模式下准确通过 `clientHandler.requestPermission` 发起中途回调并成功阻断等待。

#### (3) L1b acpx 命令行 (`claude/L1b/acpx`)
- **部分通：`observe-history` (partial)**：
  - 现象：执行 `acpx sessions history <name>` 报错 `No named session ... for cwd and agent codex`。
  - 原因：`acpx` 的顶层 `sessions history` 命令默认将 agent fallback 至 `codex`，在跨 agent 命令行隔离上存在轻微参数解析缺陷。
- **不适用项：`fork` 与 `quota` (n/a)**：
  - `acpx sessions` 命令集包含 `list, new, ensure, close, show, history, read, watch, export, import, prune`，未封装 `fork` 子命令（改以 `export/import` 归档代之）；
  - `acpx` CLI 未暴露独立的余额查询命令，额度随 JSON-RPC 流的元数据返回。

---

## 三、没把握 / 需负责人裁决的结论

1. **L0 `cancel` 的非交互恢复标准**：
   在交互式 TUI 下按 `Ctrl+C` Claude 能优雅留存在当前会话；但无头 `-p` 模式下作为后端服务被调用时，外部杀死进程会导致该会话后续 `--resume` 彻底报废。如果后端网关要把 Claude CLI 当作托管进程，必须依赖 `claude stop <id>` 或守护进程模式，不能直接依赖操作系统杀进程。
2. **L1b `observe-history` 的 Agent 绑定**：
   `acpx` 的全局会话读写工具链中，部分子命令（如 `sessions history`）缺少 `--agent claude` 显式参数，导致跨宿主会话读取容易串入默认的 `codex` 目录。
