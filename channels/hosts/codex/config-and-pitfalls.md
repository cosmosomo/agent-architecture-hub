# Codex 配置规范 (`config.toml` / `hooks.json` / `AGENTS.md`)、红线防呆与故障台账

> **适用版本**：验证于 `codex-cli 0.159.2` / `2026-10-14`
> **本机核心配置文件**：
> - 全局主配置：`C:\Users\COLORFIRE\.codex\config.toml`
> - 生命周期钩子：`C:\Users\COLORFIRE\.codex\hooks.json`
> - 全局指令级联：`C:\Users\COLORFIRE\.codex\AGENTS.md` + 各工作区 `AGENTS.md`
> - 渠道切换管理：`%USERPROFILE%\.cc-switch\cc-switch.db`（由 S6 维护，当前生效供应商：`银子智能低价`）

---

## 一、`config.toml` 核心配置结构与黄金防呆规范

### 1.1 模型、推理强度、审批、沙箱与网络重试黄金基线

```toml
# 1. 模型与推理强度（日常仅允许 gpt-6.1-sol 与 gpt-6-luna；严禁启用旧 2chat 的 gpt-5.6）
model = "gpt-6.1-sol"
model_reasoning_effort = "medium"   # 可选: minimal | low | medium | high | xhigh | ultra
approvals_reviewer = "user"         # Headless 自动化推荐显式设 approval_policy = "never"

# 2. Windows 沙箱后端（0.159.2 推荐 mxc 受限令牌沙箱）
[windows]
sandbox = "mxc"

# 3. 桌面端队列模式
[desktop]
follow_up_queue_mode = "queue"
conversation_detail_mode = "STEPS_COMMANDS"

# 4. 银子网关 / 自定义供应商网络韧性配置（防 stream disconnected 必配）
[model_providers.yinzi]
name = "银子智能低价"
base_url = "https://api.yinziapi.top/v1"
wire_api = "responses"
env_key = "OPENAI_API_KEY"          # 密钥仅通过环境变量或私有文件注入，严禁明文入库
request_max_retries = 4             # ⚠️ 严禁设为 0（见 T-CDX-02 / P20）
stream_max_retries = 5              # ⚠️ 严禁设为 0，确保上游闪断时自动重连 1/5..5/5

# 5. 历史线程兼容别名（防桌面端打开旧会话时报 "Model provider 'xxx' not found"）
[model_providers.custom]
name = "OpenAI"
base_url = "https://chatgpt.com/backend-api/codex"
wire_api = "responses"
requires_openai_auth = true

[model_providers.packycode]
name = "OpenAI"
base_url = "https://chatgpt.com/backend-api/codex"
wire_api = "responses"
requires_openai_auth = true
```

### 1.2 MCP 服务器免审批挂载规范（防 `approval_policy="never"` 静默拒调）

当在无人值守模式（`approval_policy = "never"`）下运行 Codex 时，**任何未声明 `default_tools_approval_mode = "approve"`（或 `"auto"`）的 MCP 服务器工具调用都会被 Codex 静默拒绝**！

```toml
[mcp_servers.hub]
command = "python"
args = ["-m", "agent_hub.mcp_server"]
default_tools_approval_mode = "approve"   # 必配：允许在 approval_policy="never" 下免审调用中心乙路工具
```

---

## 二、生命周期钩子 (`hooks.json`) 机制与守卫实现

### 2.1 支持的 11 类 Hook 事件（`0.159.2` Schema 核实）
- **会话与轮级**：`SessionStart`（支持 `matcher: "startup|resume|clear|compact"`）、`UserPromptSubmit`、`Stop`、`Interrupt`、`SessionEnd`
- **子智能体级**：`SubagentStart`、`SubagentStop`
- **工具与权限级**：`PreToolUse`、`PermissionRequest`、`PostToolUse`
- **上下文整理级**：`PreCompact`、`PostCompact`

### 2.2 本机生效的 `~/.codex/hooks.json` 结构与输入/输出契约

本机 `~/.codex/hooks.json` 已挂载 `SessionStart`、`UserPromptSubmit`、`SubagentStart`、`Stop` 四大钩子：

1. **Hook 进程标准输入 (`stdin`)**：Codex 向钩子脚本传入一行 JSON，包含 `hook_event_name`、`cwd`、`session_id`、`turn_id`、`transcript_path`（指向当前会话的 `rollout-*.jsonl`）、`prompt`（`UserPromptSubmit` 时）以及 `stop_hook_active`（`Stop` 时）。
2. **上下文注入型钩子输出 (`SessionStart` / `UserPromptSubmit` / `SubagentStart`)**：
   ```json
   {
     "hookSpecificOutput": {
       "hookEventName": "SessionStart",
       "additionalContext": "【压缩后自动重注入的工作包摘要】..."
     }
   }
   ```
   - **核心应用**：当 `SessionStart` 命中 `compact` 时，自动向压缩后的上下文重注入 1 页任务工作包，根治 `context_compacted` 导致的失忆与重复读文件 26 次问题（见 `T-CDX-01`）。
3. **停机守卫型钩子输出 (`Stop`)**：
   - 允许正常结束本轮：输出 `{}`。
   - **拦截停机并强制继续收尾**：输出 `{"decision": "block", "reason": "尚未更新状态板或未清理锁，请补齐后再结束"}`。Codex 会立即阻止本轮结束，并将 `reason` 作为新一轮提示词继续执行！（注意：务必检查 `stdin` 中的 `stop_hook_active == true` 时放行，防止死循环）。
4. **钩子 SHA-256 信任机制**：
   - Codex 默认拒绝执行未在 `config.toml` 中登记 SHA-256 哈希的钩子，除非传入 `--dangerously-bypass-hook-trust`，或通过 `codex app-server` 的 `hooks/list` 获取 `currentHash` 并写入 `config.toml` 的 `[hooks.state.'...'] trusted_hash = "sha256:..."`。

---

## 三、`AGENTS.md` 级联加载与渐进式披露规范

1. **级联顺序与 32 KiB 硬顶**：
   - 全局层：读取 `$CODEX_HOME/AGENTS.override.md`（优先）或 `$CODEX_HOME/AGENTS.md`。
   - 项目层：从 Git 仓库根目录向下遍历至当前 `cwd`，每层目录最多读取一个文件（优先级：`AGENTS.override.md` > `AGENTS.md` > `project_doc_fallback_filenames`），按从根到叶顺序拼接，总字节数上限默认 `project_doc_max_bytes = 32768`（32 KiB）。
2. **渐进式披露铁律（防上下文挤爆）**：
   - `AGENTS.md` 只放**全局红线与文档导航地图（去哪找什么）**，绝不塞入具体议题长文或全量渠道状态；
   - 单次运行专属的角色指令通过 `codex app-server` `thread/start.developerInstructions` 或 `codex exec -c developer_instructions="..."` 注入，不污染工作区 `AGENTS.md`。

---

## 四、Codex 渠道未修与已定界故障台账 (`T-CDX-*`)

> 沿用 `opencli-poweruser/references/pitfalls.md §〇` 的三级诊断标准：
> **诊断**：🔍 只见现象 ｜ 🧪 已定界（知道哪一层出问题） ｜ ✅ 根因查实（有源码/日志/对照实验为证）
> **归属**：宿主/CLI 代码 ｜ 上游网关/模型侧 ｜ 本机环境（网络/代理/OS） ｜ 调度器配置层 ｜ 瞬时

| 编号 | 现象（原始报错 / 异常特征） | 触发场景与实证规模 | 诊断 · 归属 | 临时绕行与根治方案 | 实证出处 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **T-CDX-01** | `context_compacted` 频繁触发（1,229 会话触发 **218 次**）；单次运行重复读取相同规则/任务文件 **中位数 26 次**；`sota·A1` 单线程累计消耗 $1.08\times 10^8$ Tokens | 长任务、或 MCP 工具返回巨型 JSON（如单次返回 8 万～9.6 万字符）撑爆上下文窗口 | ✅ 根因查实 · 模型上下文窗口 + 调度器工具回包设计 | 1. `A1` 总调度严守「多委托、少通读」，主线程只读 `heartbeat` 增量；<br>2. 控制单次 MCP 工具回包 $<5\text{k}$ 字符；<br>3. 利用 `hooks.json` 的 `SessionStart` (`matcher: "compact"`) 在压缩后自动重注入精简工作包。 | `调研评估与换模型_20261007.md:68-90,106`；`AP-Vibe底层问题记录.md:96-98 (P15)` |
| **T-CDX-02** | `stream disconnected before completion: error sending request` / `stream closed before response.completed` | 63 次跑超 5 分钟失败的长运行中占 **49 次（77.8%）**，白费 **2,368 分钟**；直连 `api.yinziapi.top` 在 7–8 并发下 12 秒必断 | ✅ 根因查实 · 本机网络代理 + 调度器重试配置 (`P20`) | 1. 强制设置 `HTTP_PROXY` / `HTTPS_PROXY = http://127.0.0.1:7892`；<br>2. 保持 `request_max_retries = 4, stream_max_retries = 5`；<br>3. 断流后必须用 `codex exec resume <sid>` 原位续跑，严禁丢弃旧会话重开。 | `实测记录/2026-10-02_模型上游与托管沙箱.md:18-28`；`AP-Vibe底层问题记录.md:112-117 (P20)` |
| **T-CDX-03** | `apply_patch` 报错：`需要 UTF-8 参数` / `末行必须是 End Patch` / `找不到要改的行` | 第一轮 103 份轨迹中共出现 **165 次** `apply_patch` 工具失败 | ✅ 根因查实 · 宿主工具在 Windows CRLF 与多行中文下的脆弱性 | 监控 `patch_failure_loop`：同一会话连续 $\ge 2$ 次 `apply_patch` 失败立即停用该工具，改用脚本按 UTF-8 无 BOM 原子改写文件。 | `调研评估与换模型_20261007.md:90-93` |
| **T-CDX-04** | 传入 `--approve-for-me -c sandbox_mode="danger-full-access"` 后，沙箱静默变成 `read-only` 且报 `自动权限审核未在时限内完成` | `P06` 事故：`sota·A1` 正常跑完多轮心跳但黑板 0 字节写入 | ✅ 根因查实 · CLI 参数优先级覆盖 (`P06`) + 服务重启漏参 (`P02`) | Headless 自动化严禁使用 `--approve-for-me`；统一显式传 `-s workspace-write -c approval_policy="never"`（或直交项目传 `--dangerously-bypass-approvals-and-sandbox`）。 | `实测记录/2026-10-02_模型上游与托管沙箱.md:6-16`；`AP-Vibe底层问题记录.md:19-25,44-49` |
| **T-CDX-05** | Headless `codex exec` 启动后，模型看不到任何 Shell 工具与已配置的 MCP 工具 | 当全局 `config.toml` 被 Codex Desktop 写入 `features.code_mode = true` 时触发 | ✅ 根因查实 · 宿主 Feature Flag 耦合 | 在所有 `codex exec` 自动化调用中显式覆写：`-c 'features={...,code_mode=false}'`。 | `C:\Users\COLORFIRE\.codex\config.toml`；`codex features list` |
| **T-CDX-06** | `already has an active writer` / `thread is currently loaded` | 对正在 Codex Desktop 或另一 CLI 中打开（或 7 分钟内活跃过）的会话执行 `codex exec resume` | ✅ 根因查实 · Codex 单线程写锁保护机制 | 改用 `codex queue --thread <sid> --message <text>` 无锁入队，并通过监听 `rollout-*.jsonl` 的 `task_complete` 验收完结。 | `codex queue --help`；本机实测 |
| **T-CDX-07** | `Custom tool call output is missing for call id` 每 35 秒向 stderr 刷一条诊断日志，导致空闲看门狗计时器被无限重置 | 会话在工具调用中途被强杀后，再次 `codex exec resume` 恢复该残损会话 (`P07`) | ✅ 根因查实 · 残损会话恢复诊断循环 (`P07`) | 1. 优先用 `codex app-server` 的 `turn/interrupt` 优雅停轮而非强杀进程；<br>2. 看门狗活跃度判定只认 `rollout-*.jsonl` 实质 step 推进，忽略纯诊断 stderr。 | `实测记录/2026-10-02_P0改造实测.md:25-29` |
| **T-CDX-08** | 内置 `web_search` 工具返回空结果（32 次调研运行中 6 个子问题全空，失效率 **18.8%**） | 学术调研与垂直社区深水区检索 | 🧪 已定界 · 内置搜索召回边界 | 学术检索走 `rate_gate.py` 控频脚本（arXiv/S2/OpenAlex）；网页搜索走 `anysearch` Skill（一主两备 Key）；社区采集走 `opencli-poweruser`（对齐共享状态板）。 | `调研评估与换模型_20261007.md:97-99` |
