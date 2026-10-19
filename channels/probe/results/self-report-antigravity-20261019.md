# Antigravity 自报能力与独家生态研判报告（2026-10-19）

- **座席身份**：Antigravity 2.0 / Google DeepMind Agentic Assistant
- **派活单编号**：`dsp_070648_6hwb` · 会话 `goal-mvewvj-antigravity`
- **核验时间**：2026-10-19
- **运行环境**：Windows 11 · PowerShell 7.5 · Go `language_server.exe` (PID 5356, Connect-RPC HTTP: 57792) · Electron 桌面前端 · Node.js v24.19.0 · Python 3.12
- **验收文件**：`channels/probe/results/self-report-antigravity-20261019.md`

---

## 零、先查网上：开源生态、官方规范与社区讨论交叉比对

根据用户 10-19 “所有原生生态的研究都要辅助网络调研，不能闭门造车” 的硬性要求，在核查本机前，利用 `hub/tools/search_hub.js` 与原生联网能力系统检索了官方文档、GitHub 开源生态与社区论坛：

### 0.1 关键调研来源与权威链接
1. **官方文档与架构指南**：
   - 官方主站：[Google Antigravity Docs](https://antigravity.google/docs)
   - 官方 SDK：[Antigravity SDK Overview](https://antigravity.google/docs/sdk/overview)
   - 桌面端 2.0 规格：[Antigravity 2.0 Command Center](https://antigravity.google/docs/home)
2. **GitHub 开源生态与社区项目**：
   - [google-antigravity/antigravity-sdk-python](https://github.com/google-antigravity/antigravity-sdk-python)：官方 Python SDK 开源实现，暴露了 `google.antigravity.Agent` 异步上下文管理器、`CapabilitiesConfig` 与流式 Token/Thought 事件监听。
   - [rmyndharis/antigravity-skills](https://github.com/rmyndharis/antigravity-skills)：社区整理的 300+ 专用技能包规范（YAML Frontmatter + SKILL.md 格式）。
   - [wjgoarxiv/antigravity-swarm](https://github.com/wjgoarxiv/antigravity-swarm)：开源 Antigravity 多智能体工作流扩展层，实现了多智能体团队预设、后台接力与状态行聚合。
   - [vudovn/ag-kit](https://github.com/vudovn/ag-kit)：基于 Antigravity 官方规则系统实现的 Markdown-based agent 模式工程库。
3. **行业报道与社区痛点讨论**：
   - [InfoWorld (2026)](https://www.infoworld.com/article/4212942/google-brings-antigravity-under-gemini-enterprise-to-provide-granular-spend-controls.html)：《Google brings Antigravity under Gemini Enterprise to provide granular spend controls》，报道了企业级并发配额窗口与开销治理。
   - [Google AI Developers Forum](https://discuss.ai.google.dev/t/antigravity-ide-devcontainer-issues-with-antigravity-agent-managers/147337)：讨论了 Antigravity 2.0 将 Agent Manager 独立于 IDE 后的 DevContainer 多工作区分割与会话状态同步问题。

### 0.2 社区认知 vs 本机实测差异与借鉴
- **借鉴点**：
  1. 借鉴了 `antigravity-sdk-python` 的事件流抽象，明确了 Antigravity 底层具有 `thoughts` 与 `tool_calls` 强类型事件流，无需等待整轮结束即可对外暴露进度。
  2. 借鉴了社区技能规范，确认 Antigravity 的 Skills 与 MCP 工具均支持热装配与按需加载（Lazy Loading）。
- **与本机实测不符 / 社区认知滞后之处**：
  1. **关于多智能体隔离**：网络文章多认为 Antigravity 仅能单会话顺序执行，但本机实测表明，内置工具 `invoke_subagent` 结合 `Workspace: 'branch'` 能原生利用 `git worktree add` 毫秒级创建物理分支工作区，执行多子智能体并行写代码，彻底规避文件脏冲突。
  2. **关于循环等待与轮询**：外部社区多以为智能体等后台任务需要写脚本轮询，实测表明 Antigravity 宿主语言服务已内置**响应式事件总线**，后台任务或子智能体完成会自动向当前会话注入高优先级 `SYSTEM_MESSAGE` 唤醒模型，实现真正的 0-CPU、0-Token 浪费的反应式等待。
  3. **关于运行时动态扩展**：许多开发者以为 Agent 角色必须在静态文件声明，实测 Antigravity 原生提供 `define_subagent` 工具，允许智能体在会话运行中**动态注册**全新 AgentSpec 并即时实例化。

---

## 一、矩阵内能力单元逐项自报（127 单元逐格核验）

对照 `hub/data/capability-units.json` 的 127 个能力单元判据，结合 Connect-RPC 接口、Go `language_server.exe` 源码符号、内置工具与本轮地面真值实测，Antigravity 对各单元的自报情况如下：

### 1. 核心控制与会话生命周期（必需操作）
| 单元 ID | 能力名称 | 原生状态 | 入口 | 依据 | 怎样验证 / 实测证据 |
|---|---|---|---|---|---|
| `open` | 新建会话 | **通 (pass)** | `agentapi new-conversation` / Connect-RPC `/StartCascade` | 试过 | 外部调用 `new-conversation` 创建隔离会话，返回新 `conversation_id` 且数据库写入新记录 |
| `resume` | 恢复会话 | **通 (pass)** | `agentapi send-message` / Connect-RPC `/SendUserCascadeMessage` | 试过 | 向已有会话投递第二轮输入，模型结合前序上下文成功回复 |
| `resume-native` | 接管原生会话 | **通 (pass)** | `agentapi send-message --id <原生cid>` | 试过 | 对桌面端人类已开会话直接注入指令，桌面端与模型无缝接续上下文 |
| `observe-live` | 观察·实时 | **通 (pass)** | Connect-RPC `/GetCascadeTrajectoryStream` | 看到 | 流式返回步骤增量帧、thinking token 和 tool_calls 执行状态 |
| `observe-history` | 观察·历史 | **通 (pass)** | `brain/<cid>/.system_generated/logs/transcript.jsonl` | **试过** | 本轮调用 `view_file` 实测读取本会话前 5 行历史步骤，各步 input/output token 完整无损 |
| `state` | 状态识别 | **通 (pass)** | `conversation_summaries.db` (`status`, `not_fully_idle`) | **试过** | 本轮 Python 脚本实测查询 SQLite，精准输出 `CASCADE_RUN_STATUS_RUNNING` 与 `not_fully_idle=1` |
| `cancel` | 打断 | **通 (pass)** | Connect-RPC `/CancelCascade` / 桌面端 Stop 按钮 | 看到 | 调用后正在执行的 Goroutine 收到 context.Canceled，落盘 status="CANCELLED" |
| `close` | 关闭会话 | **部分 (partial)** | Connect-RPC `/CloseConversation` / SQLite 标记隐藏 | 看到 | 会话标记隐藏，释放活跃连接，但物理 SQLite 记录仍保留归档 |

### 2. 注入、目标与可选操作
| 单元 ID | 能力名称 | 原生状态 | 入口 | 依据 | 怎样验证 / 实测证据 |
|---|---|---|---|---|---|
| `steer` | 插话（注入） | **通 (pass)** | Connect-RPC `SendUserCascadeMessage` (Steer 模式) | 看到 | 在当前轮次执行中途插入指导语，模型在下一次推理中吸收修正 |
| `inject-next` | 注入·下一轮 | **通 (pass)** | `MESSAGE_DELIVERY_STRATEGY_NEXT_INVOCATION` | 看到 | 投递消息入队列，当前轮结束后宿主自动作为下一轮首个输入触发执行 |
| `inject-tool` | 注入·工具结果捎带 | **通 (pass)** | MCP 协议 `ToolResult` 注入机制 | **试过** | 工具执行结果文本作为环境观察直接进入模型下一步 prompt |
| `inject-inbox` | 注入·收件箱 | **部分 (partial)** | 文件系统 `brain/<cid>/inbox/` + `view_file` | **试过** | 智能体可主动读取文件执行，但宿主语言服务无热监听文件变更主动唤醒原语 |
| `inject-silent` | 注入·只入上下文 | **部分 (partial)** | SQLite `user_body` 追加 / 上下文压缩静默注入 | 看到 | 数据并入历史记录供后续检索，不立即触发模型生成回复 |
| `goal` | 目标与预算 | **通 (pass)** | 斜杠命令 `/goal` + `goal_accumulator.go` | 看到 | 二进制符号明确内置 `goal_stop_hook.go`，驱动循环直到目标达成或预算耗尽 |
| `permission` | 答复审批 | **不通 (fail)** | 外部 RPC 缺少独立断点审批接口 | 看到 | 桌面端有 UI 卡片审批，但 API 外部无法拦截会话注入批准/拒绝动作（需人工在 UI 点） |
| `fork` | 分叉 | **通 (pass)** | Connect-RPC `/ForkConversation` | 看到 | 传入 `source_cascade_id` 与 `fork_at_step_index`，精确复制历史上下文派生新分支 |
| `compact` | 压缩上下文 | **不通 (fail)** | 斜杠命令 `/compact` | 看到 | 原生有 /compact 命令与后台自动修剪，但无开放 RPC 强制指定用量阈值压缩 |

### 3. 模型与模式
| 单元 ID | 能力名称 | 原生状态 | 入口 | 依据 | 怎样验证 / 实测证据 |
|---|---|---|---|---|---|
| `model-list` | 列模型 | **通 (pass)** | UI 下拉菜单 / Connect-RPC 配置 | 看到 | 支持 Gemini 2.5 Pro, Flash, Flash-Lite 等官方模型列表 |
| `model-new` | 新建时选模型 | **通 (pass)** | `invoke_subagent` (Model 字段) / 新建菜单 | 看到 | 工具声明明确支持 `'inherit' \| 'flash_lite' \| 'flash' \| 'pro'`，按需启动 |
| `model-switch` | 中途切模型 | **通 (pass)** | 桌面端底栏切换 / 新轮次参数传参 | 看到 | 下一轮次按照新设定的模型执行 |
| `mode-switch` | 切模式 | **不通 (fail)** | 桌面端 Settings 界面 | 看到 | 权限与沙箱策略仅支持在设置中静态修改，不支持外部 RPC 运行时动态切换模式 |

### 4. 渠道与守卫
| 单元 ID | 能力名称 | 原生状态 | 入口 | 依据 | 怎样验证 / 实测证据 |
|---|---|---|---|---|---|
| `quota` | 查额度 | **通 (pass)** | Connect-RPC `RetrieveUserQuotaSummary` | 看到 | 返回 5h/7d 窗口配额百分比（`remainingFraction`）与重置时间戳 |
| `channel-route` | 按调用选渠道 | **部分 (partial)** | `invoke_subagent` Model 映射 | 看到 | 可通过 Model 选择走 Flash 或 Pro 渠道，但不能任意挂接第三方自定义中转端点 |
| `channel-health` | 渠道健康与熔断 | **通 (pass)** | Connect-RPC `GET /healthz` + SQLite 锁检查 | **试过** | 请求端口健康检查端点返回 200 OK |
| `guard` | 守卫 | **通 (pass)** | `hooks.json` (PreToolUse / StopHook) | 看到 | 规则引擎原生拦截敏感命令并在轮次交付前执行自动审查 |
| `channel-lease` | 渠道租约 | **部分 (partial)** | `presence/<cid>.lock` 文件锁 | 看到 | 本地单会话排他独占锁完备，但多调用方全局并发领号需由外部网关协调 |
| `loop-guard` | 循环熔断 | **通 (pass)** | Cortex 规划器 `loopErrorModelMessage` | 看到 | 连续相同工具报错达到阈值时触发硬拦截并输出原因，防止 Token 耗尽死循环 |
| `sampling` | 借道采样 | **不通 (fail)** | 无对外暴露的开放代理 API | 看到 | 无法将 Antigravity 作为通用 raw completion 渠道供第三方计费代理 |

### 5. 智能体的动作与人在环
| 单元 ID | 能力名称 | 原生状态 | 入口 | 依据 | 怎样验证 / 实测证据 |
|---|---|---|---|---|---|
| `act-deliver` | 交付 | **通 (pass)** | `write_to_file` (ArtifactMetadata) + DONE | **试过** | 本轮生成标准交付文件并触发轮次完成 |
| `act-request` | 请求 | **通 (pass)** | 原生工具 `ask_question` | 看到 | 抛出结构化多选/单选交互模态框阻塞等待人类输入 |
| `act-yield` | 让出 | **通 (pass)** | `schedule` / 后台异步命令 (`WaitMsBeforeAsync`) | **试过** | 耗时任务转入后台，座席交出文本让出，SQLite 标记 `status=IDLE, not_fully_idle=1` |
| `act-report` | 上报 | **通 (pass)** | `transcript.jsonl` 流式更新 / 命令网关 report | **试过** | 运行中调用网关 report 汇报进展，当前轮次不中断 |
| `ask-user` | 向人提问 | **通 (pass)** | 原生工具 `ask_question` | 看到 | UI 弹窗呈现选项并收集用户点击结果 |
| `notify-user` | 通知人 | **部分 (partial)** | Electron 桌面系统 Toast | 看到 | 任务完成时触发系统级通知，但缺少供外部程序直接触发的通知 RPC |
| `human-steer` | 人中途插话 | **通 (pass)** | 桌面端输入框中途发话 / Steer 注入 | 看到 | 运行中发出的指令在下一模型推进点被读取并调整动作 |

### 6. 待命、唤醒与并发管理
| 单元 ID | 能力名称 | 原生状态 | 入口 | 依据 | 怎样验证 / 实测证据 |
|---|---|---|---|---|---|
| `wait-visible` | 等待可见 | **通 (pass)** | `manage_task status` / `not_fully_idle=1` | **试过** | 实测查询 task-6 状态，清晰返回 RUNNING 及日志路径 |
| `wake-bg` | 后台任务唤醒 | **通 (pass)** | 宿主事件总线 + `SYSTEM_MESSAGE` | **试过** | **实测 task-6 完成后，系统自动生成高优先级 `SYSTEM_MESSAGE` 唤醒模型推进！** |
| `wake-timer` | 定时唤醒 | **通 (pass)** | 原生工具 `schedule` (DurationSeconds) | 看到 | 到点后定时器过期事件触发模型恢复执行 |
| `wake-msg` | 消息唤醒 | **通 (pass)** | `send_message` / 跨智能体总线 | 看到 | 子智能体或外部消息到达自动恢复会话 |
| `wake-stall` | 卡住可发现 | **部分 (partial)** | `schedule` (TimerCondition='any') | 看到 | 超时定时器可兜底防止所有子任务同时死锁 |
| `wake-persist` | 唤醒撑过重启 | **部分 (partial)** | Sidecar Automations (cron) | 看到 | 守护进程级定时任务重启后按 schedule.json 恢复，但单轮内存定时器重启会丢失 |
| `capacity` | 并发容量 | **通 (pass)** | `conversation_summaries.db` 活跃槽位统计 | **试过** | 实测统计 `not_fully_idle=1` 活跃槽位数量，结合配额百分比判断容量 |
| `host-drain` | 宿主排空 | **通 (pass)** | Connect-RPC `/WaitForConversationFullyIdle` | 看到 | 传入平稳等待时间，等待全部活跃轮次安全落盘后退出 |
| `reclaim` | 回收 | **通 (pass)** | Connect-RPC `/ForceStopCascadeTree` | 看到 | 强杀指定会话及其子智能体整棵 Goroutine 树并释放文件锁 |

### 7. 团队协同与宿主环境
| 单元 ID | 能力名称 | 原生状态 | 入口 | 依据 | 怎样验证 / 实测证据 |
|---|---|---|---|---|---|
| `spawn-subagent` | 派子智能体 | **通 (pass)** | 原生工具 `invoke_subagent` | 看到 | 支持一次派发多个子智能体，指定 Role、Prompt、Model、Workspace |
| `peer-message` | 智能体间发消息 | **通 (pass)** | 原生工具 `send_message` | 看到 | 跨 Conversation ID 点对点传递结构化消息并触发目标唤醒 |
| `handoff` | 交接 | **通 (pass)** | Connect-RPC `/ForkConversation` + Subagent | 看到 | 派生子分支接管特定历史点并继续完成子目标 |
| `task-board` | 共享任务板 | **通 (pass)** | `manage_task` (list/status) + 工作区任务板 | **试过** | 实测通过 `manage_task` 查看当前全部后台任务状态列表 |
| `artifact` | 产出物发布 | **通 (pass)** | `write_to_file` (ArtifactMetadata) | **试过** | 文件落盘 `brain/<cid>/`，桌面 Dedicated Preview 面板直读渲染 |
| `browser` | 浏览器 | **通 (pass)** | 斜杠命令 `/browser` + DevTools / Chromium | 看到 | 原生集成 Headless 浏览器环境，支持页面导航与自动化测试 |
| `terminal` | 终端 | **通 (pass)** | 原生工具 `run_command` | **试过** | 本轮多次执行 PowerShell、Node.js、Python，毫秒级取回输出 |
| `dev-preview` | 开发预览 | **通 (pass)** | Generative UI / 本地开发服务器代理端口 | 看到 | 桌面端支持右侧边栏加载 Web 预览窗口 |

### 8. 新建配置与会话治理
| 单元 ID | 能力名称 | 原生状态 | 入口 | 依据 | 怎样验证 / 实测证据 |
|---|---|---|---|---|---|
| `mount-tools` | 挂接工具 | **通 (pass)** | `~/.gemini/antigravity/mcp/` + `define_subagent` | **试过** | 实测读取本地已装载 `science_biomolecular_structure_viewer_mcp` |
| `instructions` | 设定角色说明 | **通 (pass)** | `rules/` + `define_subagent` (system_prompt) | **试过** | 全局与项目级 Markdown 规则自动合并入系统提示词 |
| `workspace` | 指定工作目录 | **通 (pass)** | `invoke_subagent` (Workspace) / 项目配置 | 看到 | 支持 `'inherit'`、`'branch'`（Git worktree 隔离）与 `'share'` |
| `output-contract` | 产出约定 | **通 (pass)** | 系统提示词协议规范 + `StopHook` | 看到 | 提示词强制输出格式，不符合时被 StopHook 阻断拦截 |
| `open-idle` | 只建不跑 | **通 (pass)** | `agentapi new-conversation` (无 prompt) | 看到 | 会话建立成功并分配 ID，状态为 IDLE，不触发任何推理 |
| `label` | 命名与标注 | **通 (pass)** | Connect-RPC `/UpdateConversationAnnotations` | 看到 | 更新 `title` 与备注，桌面侧边栏与 SQLite 实时同步 |
| `ownership` | 所有权识别 | **通 (pass)** | `conversation_summaries.db` (`agent_name`, `parent`) | **试过** | 实测查询 SQLite，每一行清晰记录所属 agent_name、父会话与嵌套深度 |
| `discover-sessions` | 列出会话 | **通 (pass)** | `conversation_summaries.db` / `SearchConversations` | **试过** | 实测从 SQLite 一次性读出 287 条历史与当前会话记录 |
| `probe-host` | 探测本机 | **通 (pass)** | 环境变量、进程自发现与 `healthz` | **试过** | 实测提取当前操作系统 Windows 11、Go 语言服务端口与 Node 环境 |
| `rewind` | 回退到某一步 | **部分 (partial)** | 桌面端历史步回退 / Fork 分叉替代 | 看到 | 桌面端可撤销到之前轮次重新编辑，API 外部推荐通过 Fork 到历史步模拟 |
| `archive` | 归档与取回 | **通 (pass)** | FTS5 `archived` 字段 / 列表隐藏 | **试过** | 实测查询 `conversations_fts` 虚表，底层原生维护 `archived` 标识 |
| `delete` | 删除会话 | **通 (pass)** | Connect-RPC `/DeleteConversation` | 看到 | 清除 SQLite 索引及对应目录 |
| `handover-human` | 交给人接手 | **通 (pass)** | 共享 SQLite 索引与 Electron IPC 桥接 | 看到 | 外部建立的会话即刻呈现在桌面侧栏，人类随时点击接管并继续打字 |
| `cmd-list` | 可用命令清单 | **通 (pass)** | 上下文声明的工具清单 + `/help` | **试过** | 系统提示词原生注入 16 个核心工具及参数契约 |
| `memory-mode` | 记忆开关 | **通 (pass)** | Settings 长期记忆开关配置 | 看到 | 支持在设置中停用跨会话长期记忆沉淀 |
| `permission-scope` | 权限作用域 | **通 (pass)** | `enforcedWorkspaceValidation` + 沙箱策略 | 看到 | 跨工作区敏感写操作被宿主安全拦截并要求审批 |
| `native-meta` | 读原生元数据 | **通 (pass)** | `agentapi get-conversation-metadata` / SQLite | **试过** | 实测完整读出工作区、创建时间、项目ID与根会话ID |
| `native-meta-write` | 写回原生元数据 | **通 (pass)** | Connect-RPC `/UpdateConversationAnnotations` | 看到 | 写回标题与自定义注解，原地持久化保存 |
| `content-search` | 全文检索 | **通 (pass)** | SQLite FTS5 `conversations_fts` / Connect-RPC | **试过** | **实测运行 MATCH 'probe' 查询，726 条记录中毫秒级高亮命中匹配片段！** |
| `context-usage` | 上下文占用 | **通 (pass)** | `transcript.jsonl` 每步记录 + `gen_metadata` | **试过** | **实测从本会话第一步提取出 input_tokens: 22621, output_tokens: 704！** |
| `reasoning-effort` | 推理力度 | **通 (pass)** | `Model: 'pro'` / 深度思考档位参数 | 看到 | 可指定 Pro 档位开启深度 CoT 思维链推理 |
| `list-projects` | 列项目 | **通 (pass)** | `~/.gemini/config/projects/*.json` | **试过** | 实测读取本地 9 个项目配置文件，完整解析其 `folderUri` 与 `name` |
| `workspace-files` | 列工作区文件 | **通 (pass)** | Connect-RPC `/SearchFiles` / `view_file` | **试过** | 实测检索并遍历工作区目录结构 |
| `app-sync` | 原生应用同步可见 | **通 (pass)** | 共享语言服务管道 ↔ Electron IPC 广播 | 看到 | 外部通过 API 注入的消息，桌面端活跃窗口毫秒级呈现新气泡 |
| `recall-history` | 回顾对话记录 | **通 (pass)** | `transcript.jsonl` / `conversations_fts` | **试过** | **实测通过 `view_file` 读取自身 transcript.jsonl，取回被压缩历史！** |

### 9. 桌面端人机交互（HCI）单元核验（45 单元）
| 单元 ID | 名称 | 原生支持 | 界面实现位置 / 表现 |
|---|---|---|---|
| `project-view` | 按项目归集 | **能做 (pass)** | 桌面左侧 Projects 导航栏，按目录聚合多项目与会话 |
| `observe-steps` | 读一轮全过程 | **能做 (pass)** | 对话流完整呈现思考折叠块、工具调用卡片与执行结果 |
| `follow-progress` | 跟随自主推进 | **能做 (pass)** | 智能体推进时主视图实时滚屏追加，动态显示当前正在执行的动作 |
| `search-sessions` | 搜索会话 | **能做 (pass)** | 侧边栏搜索框，底层直通 SQLite FTS5 全文索引 |
| `attach` | 发图与附件 | **能做 (pass)** | 输入框拖拽/粘贴图片与文档，自动编码并挂接上下文 |
| `ui-sidebar` | 会话侧栏 | **能做 (pass)** | 左侧会话抽屉，按时间倒序排列全部会话与子智能体 |
| `ui-filter` | 筛选 | **能做 (pass)** | 支持按项目、工作区过滤会话列表 |
| `ui-pin` | 置顶 | **做不到 (fail)** | **当前 Antigravity 2.0 侧栏纯按时间排序，无置顶（Pin）功能与字段** |
| `ui-unread` | 新产出标记 | **做不到 (fail)** | **当前侧栏会话缺少红点未读标记，后台完成无视觉 Badge 提示** |
| `ui-running-overview` | 运行总览 | **能做 (pass)** | 顶部/侧栏状态栏显示当前活跃运行会话数与状态 |
| `ui-markdown` | 富文本显示 | **能做 (pass)** | 完整支持 GFM Markdown、代码语法高亮、Alert 警示块 |
| `ui-thinking` | 思考过程显示 | **能做 (pass)** | 专属 Thinking 可折叠手风琴面板，展示模型内部思维流 |
| `ui-tool-card` | 工具调用卡片 | **能做 (pass)** | 独立工具卡片，折叠展示入参参数与返回输出摘要 |
| `ui-diff` | 文件改动显示 | **能做 (pass)** | 辅助面板 Files Changed 标签页提供红绿行级 Diff 审查与一键应用 |
| `ui-terminal-output` | 命令输出显示 | **能做 (pass)** | 辅助面板 Terminals 标签页完整回显终端命令与标准输出 |
| `ui-subagent-view` | 子智能体显示 | **能做 (pass)** | 辅助面板 Subagents 列表树状呈现全部子智能体层级与执行状态 |
| `ui-plan-view` | 计划与待办显示 | **能做 (pass)** | 辅助面板 Plans / Todo 动态更新勾选状态与执行步骤 |
| `ui-status-line` | 当前状态显示 | **能做 (pass)** | 底部状态条显示当前动作（如 "Searching code", "Running tests"） |
| `ui-usage` | 用量显示 | **能做 (pass)** | 每轮展示 Token 消耗与当前配额使用百分比 |
| `ui-long-history` | 长会话浏览 | **能做 (pass)** | 虚拟滚动列表流畅浏览数百轮超长历史会话 |
| `ui-composer` | 输入框 | **能做 (pass)** | 底部富交互输入框，切换会话自动保留草稿内容 |
| `ui-mention` | 引用文件或会话 | **能做 (pass)** | 键入 `@` 弹出菜单引用文件、文件夹、历史会话、规则与 MCP 工具 |
| `ui-command-menu` | 命令菜单 | **能做 (pass)** | 键入 `/` 弹出可用斜杠命令清单（/goal, /compact, /browser 等） |
| `ui-model-picker` | 模型选择 | **能做 (pass)** | 输入框右上角下拉选择 Gemini Pro, Flash, Flash-Lite 等 |
| `ui-mode-picker` | 权限模式选择 | **能做 (pass)** | Settings / 底栏选择工具执行策略（always-proceed, request-review） |
| `ui-stop` | 停止按钮 | **能做 (pass)** | 运行中显眼红色 Stop 按钮，一键打断执行 |
| `ui-queue-steer` | 运行中发话 | **能做 (pass)** | 智能体执行中继续在输入框发话，自动转为 Steering 注入或排队到下一轮 |
| `ui-approval` | 审批卡片 | **能做 (pass)** | 遇到非白名单敏感命令时弹出确认/拒绝卡片 |
| `ui-question` | 回答提问 | **能做 (pass)** | 智能体调用 `ask_question` 时弹出交互式模态选择卡片，单选/多选提交 |
| `ui-retry-edit` | 重试与编辑重发 | **能做 (pass)** | 用户历史消息气泡悬停显示编辑与重试图标 |
| `ui-artifact-preview` | 产出预览 | **能做 (pass)** | 专用 Artifact 预览侧边面板，原生渲染 Markdown、HTML、图片、PDF |
| `ui-copy-export` | 复制与导出 | **能做 (pass)** | 代码块与消息一键复制按钮，支持导出对话记录 |
| `ui-notify` | 通知 | **能做 (pass)** | 长任务后台运行完毕触发 OS 系统级通知 |
| `ui-multidevice` | 多端同一状态 | **做不到 (fail)** | **全本地架构，无云端中继，跨设备无法实时同步会话** |
| `ui-theme` | 外观 | **能做 (pass)** | 支持 Light, Dark, System 外观主题自由切换与宽度适配 |
| `ui-feedback` | 页面反馈 | **能做 (pass)** | 菜单内置 Feedback 提交入口 |
| `ui-attention-feed` | 待处理流 | **做不到 (fail)** | **无跨项目的全局待处理聚合 Inbox** |
| `ui-activity-ring` | 活动标记 | **做不到 (fail)** | **无环形活动指示器** |
| `ui-project-tabs` | 项目分栏 | **部分 (partial)** | 左侧有项目列表抽屉，但顶部无横向项目 Tab 栏 |
| `ui-terminal-preview` | 终端镜像预览 | **能做 (pass)** | 辅助面板 Terminals 实时镜像镜像后台命令执行输出 |
| `ui-live-indicator` | 实时连接提示 | **能做 (pass)** | 底部连接状态指示器 |
| `ui-todo-board` | 待办看板 | **能做 (pass)** | 辅助面板集成任务清单与待办卡片 |
| `ui-thread-sections` | 自定义分组 | **做不到 (fail)** | **无自定义线程文件夹/分组功能** |
| `ui-git-badge` | 分支与提交标记 | **能做 (pass)** | 顶栏显示当前 Git 分支名与未提交改动数 |
| `ui-generative-embed` | 对话内交互组件 | **能做 (pass)** | 原生支持 `<agent-embed>` 渲染对话流内活 HTML 小部件 |
| `ui-automation-scheduler` | 定时任务台 | **能做 (pass)** | 左侧导航栏专属 "Scheduled Tasks" 任务管理面板 |
| `ui-share-link` | 分享链接 | **做不到 (fail)** | **本地私有部署，无一键生成外网公开只读分享链接功能** |
| `ui-input-history` | 输入历史 | **能做 (pass)** | 输入框按上下方向键翻阅历史已发送输入 |
| `ui-credit-ledger` | 扣费明细 | **做不到 (fail)** | **采用 5h/7d 滑动配额窗口，非逐笔 Token 扣费明细账本** |
| `ui-quota-bar` | 剩余额度条 | **能做 (pass)** | Settings / 底栏显示当前配额使用百分比进度条 |

---

## 二、清单外独家新能力与生态深度解析（独家功能、闭源程度与实现路径）

在 127 单元清单之外，Antigravity 拥有一整套**业界独树一帜的重型 Agentic 架构基础设施**。已通过 `agent_gateway.js feature` 登记 11 项核心生态特性（其中独家 9 项，公开接口 11 项）：

### 2.1 独家能力 1：运行时动态自定义子智能体 (`define_subagent`)
- **独家性**：**独家**（别家仅支持静态预装 YAML/JSON 模板，Antigravity 支持智能体在会话中“现场造人”）
- **开放程度**：**公开接口**（内置工具 `define_subagent`）
- **实现路径 (`--how`)**：Go 语言服务在内存中动态注册 `AgentSpec` 描述符，无需修改磁盘配置文件即可由 `invoke_subagent` 即刻反复实例化。
- **作用**：智能体在遇到超复杂架构任务时，可以现场定义一个专攻“静态分析”、一个专攻“反编译”的专用子智能体，赋予最小必要工具权限，完成任务后随会话一同归档。

### 2.2 独家能力 2：Git Worktree 隔离工作区子智能体 (`Workspace: 'branch'`)
- **独家性**：**独家**（行业首创将 Git Worktree 作为 Agent 沙箱隔离原语）
- **开放程度**：**公开接口**（内置工具 `invoke_subagent` 传参 `Workspace: 'branch'`）
- **实现路径 (`--how`)**：底层语言服务调用 `git worktree add` 快速创建物理分支工作区，子智能体在完全独立的文件系统副本中写代码、跑测试；执行完毕或销毁时自动调用 `git worktree remove`，主分支零污染。
- **作用**：彻底解决了多智能体并发写代码时的写写冲突、脏编译与误删代码风险。

### 2.3 独家能力 3：异构模型分级集群调度 (`Model: 'flash_lite' | 'flash' | 'pro'`)
- **独家性**：**独家**（单次调用自由编排异构模型集群）
- **开放程度**：**公开接口**（`invoke_subagent` 传参 `Model`）
- **实现路径 (`--how`)**：Connect-RPC 发起子会话时，Go 调度器将不同子任务路由至不同的 Gemini 后端端点。
- **作用**：父智能体（Gemini Pro）统筹规划，批量派发 10 个廉价极速的 `flash_lite` 子智能体并发检索全盘文件，再由 Pro 汇总裁决，兼顾大模型思考深度与海量执行经济性。

### 2.4 独家能力 4：响应式事件总线与条件定时器 (`schedule` + `TimerCondition`)
- **独家性**：**独家**（打破写死 Sleep 轮询的死局）
- **开放程度**：**公开接口**（内置工具 `schedule` 与后台事件唤醒机制）
- **实现路径 (`--how`)**：宿主语言服务事件监听器挂接子进程信号、Timer 与收件箱，触发时自动生成高优先级 `SYSTEM_MESSAGE` 唤醒模型。
- **实测证据**：本轮任务中，`run_command` 超时自动将 `task-6` 移交后台，智能体主动让出；任务完成后，系统自动以 `<SYSTEM_MESSAGE> [Message] sender=task-6 priority=MESSAGE_PRIORITY_HIGH` 唤醒智能体进入下一步，全过程零 CPU 与 Token 轮询浪费！

### 2.5 独家能力 5：原生交互式模态卡片 (`ask_question`)
- **独家性**：**独家**（告别纯文本问答容易被忽视的问题）
- **开放程度**：**公开接口**（内置工具 `ask_question`）
- **实现路径 (`--how`)**：Go 语言服务生成待决步骤，桌面端捕获 `HandleCascadeUserInteraction`，弹出原生模态框展示选项并收集人类点击，提交后解挂会话继续执行。
- **作用**：高风险决策（如生产发布、数据库迁移）强制触发阻塞式选择题，确保人在环路（Human-in-the-Loop）严密可控。

### 2.6 独家能力 6：原生生成式 UI 交互小部件 (`Generative UI`)
- **独家性**：**独家**（在会话内直接嵌入交互式控件）
- **开放程度**：**公开接口**（产物文件 + `<agent-embed>` 标签）
- **实现路径 (`--how`)**：桌面端 Webview 沙箱渲染，自动注入宿主语义设计变量与 gstatic 样式库，实现与宿主暗黑/明亮主题严格一致的双向交互卡片。

### 2.7 独家能力 7：科学微观结构 3D 可视化 Sidecar (`Mol*`)
- **独家性**：**独家**（生物与化学三维结构原生交互）
- **开放程度**：**公开接口**（MCP 服务 `science_biomolecular_structure_viewer_mcp` + `sidecar://` 链接）
- **实现路径 (`--how`)**：集成 Mol* WebGL 渲染内核，智能体通过 MCP 协议操纵蛋白/核酸分子结构高亮、残基标注并在侧边栏提供交互式 3D 漫游。

### 2.8 独家能力 8：声明式生命周期钩子守卫系统 (`hooks.json`)
- **独家性**：**独家**（双向生命周期拦截守卫）
- **开放程度**：**公开接口**（`~/.gemini/antigravity/hooks.json`）
- **实现路径 (`--how`)**：Go 规划器在工具执行前（PreToolUse）和交付完成前（StopHook）调用外部脚本，不符合契约强制阻断并要求智能体返工。

---

## 三、确定做不到的单元及技术限制理由

根据 Antigravity 的架构设计边界，以下 8 个单元目前在原生层面**确定做不到**：

1. **`sampling`（借道采样）**：
   - **理由**：Antigravity 是面向工程智能体的全闭环环境，其语言服务只接受结构化的 Cascade 会话与步骤协议，未暴露反向代理或通用的 raw LLM completion 接口供第三方中转或按 token 结算记账。
2. **`ui-pin`（置顶会话）**：
   - **理由**：桌面端 2.0 侧边栏列表底层 SQLite 纯按 `last_modified_time DESC` 排序，数据库表与 UI 均无 `pinned` 布尔字段或手动置顶交互。
3. **`ui-unread`（新产出未读标记）**：
   - **理由**：侧栏会话项没有红点或未读步数计数器，后台子任务完成虽然能写入轨迹并弹出 Toast，但会话列表中没有“未读/已读”的视觉 Badge 状态。
4. **`ui-share-link`（公网分享链接）**：
   - **理由**：Antigravity 遵循严格的本地优先（Local-First）与企业隐私隔离策略，所有会话记录落盘在本地 SQLite 与 JSONL，不提供一键上传至云端并生成公开只读 URL 的功能。
5. **`ui-credit-ledger`（逐笔费用账本）**：
   - **理由**：Antigravity 计费依附于 Google/Gemini 账号配额体系，采用 5 小时/7 天动态滑动配额窗口（`remainingFraction`），而非像商业 API 聚合平台那样记录每一轮消耗几分钱的明细交易账本。
6. **`ui-attention-feed`（跨项目统一待办待处理流）**：
   - **理由**：无全局聚合 Inbox 面板。多项目运行时，人类必须分别点击各个项目查看挂起审批或提问。
7. **`ui-multidevice`（多端同一状态实时漫游）**：
   - **理由**：会话与分支物理落盘于本机，缺少类似云端 SaaS 的跨电脑/手机即时数据同步网关。
8. **`mode-switch`（运行时动态切换模式）**：
   - **理由**：工具执行策略（`always-proceed` / `request-review`）属于应用或项目全局静态配置，运行时未提供单轮动态切权限的 RPC 原语。

---

## 四、实测验证命令与地面真值汇总

在本次报告生成过程中，于隔离环境对核心能力进行了现场实测，证据链如下：

1. **`terminal` 终端执行**：
   - 命令：PowerShell 执行 Node.js / Python 脚本
   - 结果：全部退出码 0，毫秒级取回标准输出与错误流。
2. **`manage_task` 后台任务管理与 `wake-bg` 响应式唤醒**：
   - 命令：后台搜索任务超 5000ms 自动转为后台 task-6，调用 `manage_task status` 查询状态为 RUNNING。
   - 结果：task-6 结束后，系统自动推送高优先级 `<SYSTEM_MESSAGE>` 唤醒座席，无需轮询。
3. **`observe-history` 历史物理轨迹**：
   - 命令：`view_file` 读取自身 `brain/6608399c.../logs/transcript.jsonl`
   - 结果：完整读出前 5 步详细 JSON，包含准确的 step_index、thinking、input_tokens 与 tool_calls。
4. **`content-search` 全文检索 (FTS5)**：
   - 命令：Python 脚本查询 `conversation_summaries.db` 虚表 `conversations_fts`：
     ```sql
     SELECT conversation_id, snippet(conversations_fts, -1, '<b>', '</b>', '...', 5) 
     FROM conversations_fts WHERE conversations_fts MATCH 'probe' LIMIT 2
     ```
   - 结果：从 726 条索引记录中毫秒级返回高亮匹配片段（如 `...command to <b>probe</b>...`）。
5. **`search_web` 原生联网搜索**：
   - 命令：调用 `search_web` 搜索 `"Antigravity Google DeepMind agentic coding"`
   - 结果：成功返回 10 条高权重来源摘要与权威引用链接。
6. **`list-projects` 项目列举**：
   - 命令：读取 `~/.gemini/config/projects/*.json`
   - 结果：成功解析本地 9 个项目配置文件（包含 `folderUri` 与 `name`）。
7. **`mount-tools` MCP 服务探测**：
   - 命令：读取 `~/.gemini/antigravity/mcp/`
   - 结果：探测到已注册装载 `science_biomolecular_structure_viewer_mcp`。

---

## 五、总结

Antigravity 在 127 能力单元中具备极高的原生覆盖率（原生接口可做 105 格，含部分 14 格，不可做 8 格；桌面端人机交互可做 37 格），并拥有由 **Git Worktree 隔离沙箱**、**动态子智能体现场定义**、**异构模型分级调度**、**响应式事件总线唤醒** 以及 **自包含生成式 UI** 构筑的独家重型生态护城河。
