# Codex CLI (`0.159.2`) 全命令、参数与能力演进手册

> **适用版本**：验证于本机 `codex-cli 0.159.2` / `2026-10-14`（对比旧基线 `0.118.0`）
> **取证方式**：直接执行 `codex --help`、`codex help <subcmd>`、`codex features list` 与子命令 `--help` 实测提取（遵循 `channel-probing.md` L0 活体命令铁律，绝不凭印象猜参数）。
> **书写规范**：核心调用统一采用 **「场景 → 前提 → 动作与参数 → 验收 → 失败停点 → 出处」** 六要素格式。

---

## 一、`0.118.0 -> 0.159.2` 关键能力演进与实证勘误（必读）

在从 `0.118.0` 升级到 `0.159.2` 的核对中，通过 `codex help <subcmd>` 实测发现了 **3 项极易被 `--help` 假象误导的关键事实**：

| 常见误区 / 旧印象 | `0.159.2` 活体实测真相 | 为什么会产生误判？ | 正确调用入口 |
| :--- | :--- | :--- | :--- |
| 误以为 `codex hooks` 和 `codex goals` 是顶层 CLI 子命令 | ❌ `codex help hooks` 与 `codex help goals` 均返回 `error: unrecognized subcommand` | 因为顶层语法是 `codex [OPTIONS] [PROMPT]`，执行 `codex hooks --help` 时，`clap` 把 `"hooks"` 当作位置参数 `[PROMPT]`，把 `--help` 当作顶层帮助回显（Exit 0）！ | 1. **Feature Flag**：`hooks` 与 `goals` 在 `codex features list` 中均为 **`stable | true`（默认开启）**。<br>2. **Hooks 入口**：配置文件 `~/.codex/hooks.json` + App-Server RPC `hooks/list` + CLI 参数 `--dangerously-bypass-hook-trust`。<br>3. **Goals 入口**：存储于 `~/.codex/goals_1.sqlite` + App-Server RPC `thread/goal/{set,get,clear}`。 |
| 误以为仍有顶层 `codex mcp-server` 子命令 | ❌ `codex help mcp-server` 返回 `unrecognized subcommand` | 旧版 `mcp-server` 已演进并入常驻服务体系 | 改用 `codex app-server`（主控制面）或 `codex exec-server`（远程命令执行服务）；管理外部 MCP 用 `codex mcp <list\|get\|add\|remove\|login\|logout>`。 |
| 误以为有顶层 `codex status` 子命令 | ❌ `codex help status` 返回 `unrecognized subcommand` | 状态诊断已拆分为专项子命令 | 1. 全面诊断安装/配置/鉴权/运行时健康：**`codex doctor [--json] [--summary] [--all]`**；<br>2. 登录态检查：**`codex login status`**；<br>3. 云端任务状态：**`codex cloud status <TASK_ID>`**。 |

---

## 二、顶层 23 个子命令全景速查表 (`codex --help`)

| 分类 | 子命令 | `0.159.2` 职能说明 | 对应能力层原语 |
| :--- | :--- | :--- | :--- |
| **常驻与多会话控制** | `app-server` | 启动 JSON-RPC 2.0 常驻服务（`stdio://` / `ws://`）、管理后台 `daemon`、导出 TS/JSON Schema | 全套 `5+4` 能力原语 |
| | `agents` | **`0.159.2` 新增**：在共享本地 `app-server` 守护进程上浏览/附着/停止所有智能体会话 | `观察`、`打断` |
| | `queue` | **`0.159.2` 新增**：向已有会话排入下一轮消息（`--thread <ID> --message <TEXT>`） | `恢复会话`（跨进程无锁排队） |
| | `remote-control` | **`0.159.2` 新增 `[EXP]`**：管理开启远程控制的 `app-server` 守护进程（`start`/`stop`/`pair`） | 远程通道接入 |
| | `exec-server` | **`0.159.2` 新增 `[EXP]`**：独立启动或转发远程沙箱执行服务（`--listen` / `forward`） | 远端沙箱分离 |
| **非交互单轮运行** | `exec` (别名 `e`) | 非交互式执行一轮（含子命令：`exec resume`、`exec fork`、`exec review`） | `新建会话`、`恢复会话`、`分叉` |
| | `review` | 顶层非交互式代码审查快捷入口（`--uncommitted`、`--base`、`--commit`） | 专项 `新建会话` |
| **会话生命周期管理** | `resume` | 在交互式 TUI 中恢复历史会话（`[SESSION_ID] [PROMPT] --last --all`） | `恢复会话`（TUI） |
| | `fork` | 在交互式 TUI 中分叉历史会话（`[SESSION_ID] [PROMPT] --last --all`） | `分叉`（TUI） |
| | `archive` / `unarchive` / `delete` | **`0.159.2` 新增**：归档、取消归档或永久删除本地会话（`--force`） | `关闭会话` |
| | `migrate-rollouts` | **`0.159.2` 新增**：将旧版巨型 JSONL 会话迁移为分页线程历史（`--apply --thread <ID>`） | `整理`（存储层） |
| **扩展、工具与环境** | `mcp` | 管理外部 MCP 服务器（`list`、`get`、`add`、`remove`、`login`、`logout`） | 乙路工具与外部能力挂载 |
| | `plugin` | **`0.159.2` 新增**：管理插件与插件市场（`add`、`list`、`marketplace`、`remove`） | 能力扩展 |
| | `features` | 查看或开关 152 个特性标志（`list`、`enable <FEATURE>`、`disable <FEATURE>`） | 渠道特性治理 |
| | `sandbox` | 在 Codex 提供的 Windows 受限令牌 / Linux Landlock 沙箱中直接运行外部命令 | `守卫`（独立沙箱验证） |
| **运维、桌面与云端** | `doctor` | **`0.159.2` 新增**：诊断本地安装、配置、鉴权与运行时健康度（支持 `--json`） | 渠道探活与巡检 |
| | `update` | **`0.159.2` 新增**：自更新 Codex CLI 到最新版本 | 渠道升级 |
| | `login` / `logout` | 管理鉴权（`--with-api-key`、`--with-access-token`、`--device-auth`、`login status`） | 鉴权维护 |
| | `app` | 启动或下载 Codex 桌面端应用（`codex app [PATH]`） | 桌面宿主联动 |
| | `apply` (别名 `a`) | 将 Agent 产出的最新 diff 通过 `git apply` 应用到工作区（`codex apply <TASK_ID>`） | 补丁落地 |
| | `cloud` | `[EXP]` 浏览或触发 Codex Cloud 云端任务（`exec`、`status`、`list`、`apply`、`diff`） | 云端卸载 |
| | `debug` / `completion` | 内部调试工具（`models [--bundled]`、`app-server send-message-v2`）与 Shell 补全生成 | 调试与辅助 |

---

## 三、核心命令六要素详解（场景 $\to$ 前提 $\to$ 动作与参数 $\to$ 验收 $\to$ 失败停点 $\to$ 出处）

### 3.1 `codex exec`（及 `exec resume` / `exec fork` / `exec review`）—— 单轮非交互执行

- **场景**：无需常驻 `app-server` 时，单次启动独立进程完成一轮任务、恢复冷会话做下一轮、从已有会话分叉实验、或执行非交互式代码审查。
- **前提**：
  1. 若走银子网关（`https://api.yinziapi.top/v1`），环境变量已配置 `HTTP_PROXY=http://127.0.0.1:7892` 且代理端口有监听；
  2. 目标会话（`resume` 时）未在 Codex Desktop 或其他 CLI 中处于活跃写锁状态（否则会报 `already has an active writer`）；
  3. 若全局 `config.toml` 开启了桌面端 `code_mode=true`，必须在命令行显式关闭 `code_mode=false`，否则 Headless 进程会丢失 Shell 与 MCP 工具。
- **动作与参数**：
  ```powershell
  # 1. 新建一轮（通过 stdin '-' 传入 prompt，避免 Windows 命令行长度截断与参数转义污染）
  $prompt | codex exec --json --skip-git-repo-check `
    -C "E:\target\workspace" `
    -m "gpt-6.1-sol" `
    -s workspace-write `
    -c 'approval_policy="never"' `
    -c 'features={apps=false,plugins=false,remote_plugin=false,recommended_plugins=false,code_mode=false}' `
    --output-schema "E:\path\to\schema.json" `
    -o "E:\path\to\last_message.json" `
    -

  # 2. 冷会话原位恢复做下一轮（保持上下文记忆，不重读历史文件）
  $followupPrompt | codex exec resume --json --skip-git-repo-check `
    -m "gpt-6.1-sol" `
    -s workspace-write `
    -c 'approval_policy="never"' `
    <SESSION_UUID> -

  # 3. 从已有会话分叉出新会话做一轮（原会话保持不变）
  $branchPrompt | codex exec fork --json <SESSION_UUID> -

  # 4. 非交互式代码审查（对未提交改动或指定分支）
  codex exec review --json --uncommitted -o review_result.md
  ```
- **完整专用参数表 (`codex exec --help`)**：
  - `--json`：以 JSONL 格式向 stdout 流式输出事件（`thread.started` $\to$ `turn.started` $\to$ `item.started/completed` $\to$ `turn.completed/failed`）。
  - `-o, --output-last-message <FILE>`：将模型最终一条回复落盘到指定文件。
  - `--output-schema <FILE>`：强制模型最终回复符合给定的 JSON Schema 文件（甲路交付）。
  - `--ephemeral`：无状态运行，不在 `~/.codex/sessions/` 落盘会话 JSONL 文件。
  - `--skip-git-repo-check`：允许在非 Git 仓库目录中运行。
  - `--ignore-user-config`：不加载 `$CODEX_HOME/config.toml`（注意：这会同时屏蔽全局 Skills 与 MCP，需配合显式 `-c` 注入）。
  - `--ignore-rules`：不加载 `.rules` 执行策略文件。
  - `--dangerously-bypass-hook-trust`：跳过 `hooks.json` 的 SHA-256 信任校验。
  - `--thread-source <SOURCE>`：标记新创建或分叉线程的来源分类。
- **验收**：
  1. 子进程 `exitCode == 0` 且未超时；
  2. `--json` 事件流首行拿到 `{"type":"thread.started","thread_id":"..."}`，末行拿到 `{"type":"turn.completed","usage":{...}}`；
  3. 若指定了 `-o <FILE>`，文件非空且 JSON 解析通过（注意：若末尾因刷新截断缺 `}`，最多补 1–4 个 `}` 后校验）。
- **失败停点**：
  - 报 `stream disconnected before completion`：检查 `127.0.0.1:7892` 代理与 `stream_max_retries=5`，**用拿到的 `thread_id` 执行 `codex exec resume <thread_id>` 原位续跑**，禁止丢弃线程重开新会话！
  - 报 `already has an active writer`：立即停用 `exec resume`，改走下方 `codex queue`。
- **出处**：`codex exec --help`、`codex exec resume --help`、`codex exec fork --help`（`2026-10-14` 实测）。

---

### 3.2 `codex queue` —— 跨进程向已存在/活跃会话排入下一轮消息

- **场景**：目标会话正在 Codex Desktop 桌面端打开、或正忙于执行当前轮（持有单写者锁），外部调度器或协作智能体需要向该会话投递下一轮指令。
- **前提**：已知目标会话的 UUID（或精确名称），且 `~/.codex/queue_1.sqlite` 可写。
- **动作与参数**：
  ```powershell
  codex queue --thread "01a0f203-c4db-7d10-91a4-5aa2286239dc" --message "测测渠道"
  ```
  - 可选附加参数：`-i, --image <FILE>...`、`--remote <ADDR>`、`--remote-auth-token-env <ENV_VAR>`、`-m <MODEL>`、`-C <DIR>`。
- **验收（关键！两阶段验收）**：
  1. **入队验收**：`codex queue` 进程 `exitCode == 0` 仅代表**消息已写入 `~/.codex/queue_1.sqlite` 队列**，**不代表该轮已开始或已完成**！
  2. **执行完结验收**：必须在入队前记录该会话 `~/.codex/sessions/YYYY/MM/DD/rollout-*-<threadId>.jsonl` 的文件行数/字节偏移，随后增量监听该 JSONL 文件，直到出现：
     - `payload.type == "item_completed"` 且 `item.type == "userMessage"` 文本匹配刚入队的消息（拿到 `turn_id`）；
     - 同一 `turn_id` 的 `payload.type == "task_complete"`（拿到 `last_agent_message`）。
- **失败停点**：
  - 若入队后超过约定等待窗口（如 30 秒），`rollout-*.jsonl` 仍未出现对应的 `userMessage`（说明没有活跃宿主在消费队列），则回退调用 `codex exec resume --json <threadId> -`。
- **出处**：`codex queue --help`（`2026-10-14` 实测）。

---

### 3.3 `codex doctor`、`codex features`、`codex mcp`、`codex sandbox` —— 渠道巡检与治理

```powershell
# 1. 本地安装、配置、鉴权与运行时一键体检（输出结构化 JSON）
codex doctor --json

# 2. 列出全部 152 个 Feature Flags 及其阶段（stable / experimental / under development / deprecated / removed）與启用状态
codex features list
codex features enable <FEATURE>
codex features disable <FEATURE>

# 3. 查看本机已配置的全部 MCP 服务器（JSON 格式）
codex mcp list --json
codex mcp get <NAME> --json

# 4. 查看内置与可用模型列表
codex debug models --bundled

# 5. 在 Windows 受限令牌沙箱中独立测试某条命令能否跑通
codex sandbox -C "E:\program\GIT\Agent\multi" -- pwsh -NoProfile -Command "Get-Location"
```

---

## 四、`0.159.2` 全量 152 个 Feature Flags 核心分类速查 (`codex features list`)

| 状态分类 | 数量 | 核心代表标志（`codex features list` 实测） | 能力层/渠道治理意义 |
| :--- | :--- | :--- | :--- |
| **`stable \| true`**（默认开启） | 38 (+9 常驻开启) | `multi_agent`、`hooks`、`goals`、`daemon_auto_start`、`guardian_approval`、`guardian_reuse_parent_compaction`、`unified_exec`、`unified_exec_tty`、`shell_tool`、`shell_snapshot`、`sleep_tool`、`skill_search`、`skill_mcp_dependency_install`、`plugins`、`plugin_sharing`、`remote_plugin`、`browser_use`、`browser_use_external`、`browser_use_full_cdp_access`、`computer_use`、`code_mode_host`、`fast_mode`、`image_generation`、`view_image`、`realtime_conversation`、`system_proxy_fallback`、`unbounded_connection_retries`、`worktrees`、`write_stdin_approval`（以及常驻开启的 `steer`、`sqlite`、`collaboration_modes`、`tui_app_server`） | 标志着子智能体团队（`multi_agent`）、生命周期钩子（`hooks`）、目标追踪（`goals`）、轮内插话（`steer`）、自动代理回退（`system_proxy_fallback`）在 `0.159.2` 已全部进入稳定生产态。 |
| **`stable \| false`**（稳定但默认关闭） | 3 | `memories`、`multi_agent_v2`、`recommended_plugins` | 跨会话自动记忆抽取（`memories`）与二代多智能体（`multi_agent_v2`）已达 stable，可按需开启实验。 |
| **`experimental` / `under development \| false`** | 95 | `agent_message_board`、`chronicle`、`code_mode`、`context_management`、`default_mode_request_user_input`、`defer_mailbox_preemption`、`deferred_executor`、`exec_permission_approvals`、`executed_tool_call_metadata`、`executor_capability_discovery`、`external_agent_memory_import`、`guardianv2`、`instant_interrupt`、`local_thread_store_compression`、`network_proxy`、`prevent_idle_sleep`、`reasoning_effort_override`、`request_permissions_tool`、`rollout_budget`、`runtime_metrics`、`send_message_to_user_async`、`standalone_web_search`、`step_model_switching`、`token_budget`、`use_agent_identity`、`windows_sandbox_service` | **重点关注升级动向**：`agent_message_board`（原生黑板）、`defer_mailbox_preemption`（信箱抢占延迟）、`rollout_budget` / `token_budget`（原生预算硬顶）、`step_model_switching`（步级切模型）代表了 Codex 下一阶段的演进方向。 |
