# Codex 能力自报（2026-10-19）

范围：本机 Codex CLI 0.159.2、Codex app-server 与 ACP 驱动。证据来自仓库中 2026-10-18/19 的真实探测记录；“通过”表示探测当时端到端成功，不代表所有运行配置均可用。任务书要求此报告作为线索，不改能力矩阵/黑板。

## 一、矩阵中原生可做的单元

入口缩写：CLI=`codex exec`/`codex exec resume`；AS=`codex app-server --listen stdio://` 的 JSON-RPC；ACP=`acpx codex`。除非注明，证据类型为“试过”，验证方法为复跑同名探针并检查 RPC 结果、事件或输出。

| 单元 | 原生入口 | 依据与验证 |
|---|---|---|
| `open` | CLI `codex exec -`；AS `thread/start` + `turn/start`；ACP 新建 session 后 prompt | CLI `results_l0_exec.json` 成功建线程并回 `WORD_SAVED_OK`；AS `results_l0_appserver.json` 有 thread/turn；ACP `results_l1b_acpx.json` 有 initialize/prompt。验证：检查 thread/session ID 和完成的 assistant 输出。 |
| `open-idle` | AS `thread/start`，不调用 `turn/start` | `agy-fact-codex-20261018.md` 记录 idle 且 turns 为空；验证 thread/read 与 turns/list。 |
| `send` | CLI stdin；AS `turn/start`；ACP prompt | AS 活体事件含 `turn/started`、`item/agentMessage/delta`、`turn/completed`（同上 AS 结果）；验证获取最终响应及 completed 状态。 |
| `resume` | CLI `codex exec resume <thread-id> -`；AS `thread/resume` 后 turn/start | CLI 探针成功召回 `PROBE_SECRET_ALPHA_789`；AS 冷恢复 RPC 成功。AS 新轮召回实验另有失败记录，故这里仅确认 CLI 行为实测和 AS 会话重载接口成功。 |
| `observe-live` | AS ServerNotification 流；ACP `sessions watch` | AS 捕获 30 种通知（L0 结果）；ACP watch 能跟随并回放事件（L1b 结果）。验证：监听活动 turn，检查 delta/status 通知。 |
| `observe-history` | AS `thread/read` + `thread/turns/list`；ACP `sessions history <name>` | AS 读出两轮；ACP history 输出 4/4 条历史。CLI `codex history` 不存在。验证：对照先前唯一测试文本。 |
| `state` | AS `thread/status/changed`；ACP `status -s <name>` | AS 观测到 active→idle 转换；ACP 返回 idle。CLI 无 `codex status` 子命令。验证：运行中和完成后分别读状态。 |
| `cancel` | AS `turn/interrupt`；ACP `cancel -s <name>` | ACP 真实返回 cancel requested（L1b）；AS 产生 interrupted 状态（L0）。验证：中止长轮后确认 interrupted/cancelled 且会话可继续。 |
| `steer` | AS `turn/steer` | 已有 AS RPC 返回 turnId 的探测，但同一探测的回复为空；另一份 10-18 运行记录称注入 token 出现在回复中。证据等级：行为实测记录，待复测。验证：运行中插入唯一 token 并确认输出/rollout 含 token。CLI 单轮 stdin 不支持中途插话。 |
| `permission` | AS 反向请求 `item/*/requestApproval`，客户端答复 accept/decline | L0 记录真实收到文件审批请求并 accept；10-18 行为报告还记录命令审批后执行。验证：在受限探针目录触发需审批动作，检查请求与决定。CLI/ACP 无交互审批回调。 |
| `fork` | AS `thread/fork`；CLI `codex exec fork <thread-id> -` | AS 返回新 thread ID；CLI fork 记录返回 `FORK_BRANCH_OK`。验证：确认新 ID 与父子关联，并在分支读取父上下文。 |
| `compact` | AS `thread/compact/start` | L0 返回成功；10-18 rollout 记录 compact 轮完成。验证：启动压缩并检查 turn 类型/完成状态。CLI 无独立 compact 命令。 |
| `model-list` | AS `model/list`；CLI `codex debug models`；ACP `status` | 三者均实际返回模型列表（8-11 个，具体随配置变化）。验证：读取列表并确认结构。 |
| `model-new` | AS `thread/start {model}`；ACP `sessions new` / prompt | AS 指定 `gpt-5.6-sol`；ACP 新会话报告默认模型。验证：读取会话模型并完成一轮。 |
| `model-switch` | ACP `set ... model <slug>`；AS `thread/settings/update` 或 turn 参数 | ACP set 与后续 prompt 记录成功；AS 有 10-18 行为级成功记录。另一次 AS 探测在 Compact 活动期间失败，属状态限制。验证：切换后发新轮，核验实际 model 标记。 |
| `mode-switch` | ACP `set-mode -s <name> read-only`；AS `thread/settings/update` | ACP 返回 mode set；AS 更新返回成功。验证：读取会话设置并尝试受限写操作，确认策略生效。 |
| `close` | CLI `codex archive <thread-id>`；AS `thread/unsubscribe` + `thread/archive` | CLI 返回 Archived session；AS 两个 RPC 均成功。ACP close 探测无可用输出，不能据此宣称 ACP close 成功。 |
| `label` | AS `thread/name/set` | 10-18 app-server 报告记录命名成功；验证 thread/read 的名称。 |
| `resume-native` | AS `thread/resume {threadId}` | 真实重载成功；ACP 尝试接管 CLI thread 失败（Internal error），此项仅确认 AS 自身恢复。验证：重启 app-server 后 resume 并读取历史。 |
| `terminal` | AS 工具路由 `command/exec` | 10-19 审计记录实际运行 `cmd.exe /c echo ...`，exitCode 0 且 stdout 精确回显。验证同命令并检查退出码/输出。 |
| `instructions` | AS `thread/start {developerInstructions}` | 10-19 审计记录注入指令后真实模型输出包含指定 TAG。验证：新探针会话注入唯一标记并检查回复。 |
| `probe-host` | CLI `codex doctor --json` | 矩阵已有原生入口记录，但当前自报材料没有本轮命令输出；依据类型：看到矩阵/已有记录，尚待复测。验证：执行该命令并检查 JSON 环境诊断。 |
| `rewind` | AS `thread/revert {threadId,beforeTurnId}` | 矩阵记录 RPC 入口，当前已读材料未见闭环输出；依据类型：看到接口记录，行为未证实。验证：在临时 thread 回退后比较 turns/history。 |
| `archive` | AS `thread/archive` / `thread/unarchive` | archive 已由 AS close 探针调用；unarchive 在矩阵记录但没有本次行为结果。验证：归档后查询，再 unarchive 并重新加载。 |
| `delete` | AS `thread/delete {threadId}` | 仅矩阵登记 RPC 入口，当前证据未实际删除；依据类型：看到接口记录。验证：只对临时测试 thread 删除并确认读取报 not found。 |
| `cmd-list` | CLI `codex help` | 仅矩阵记录 CLI 入口，本次未执行；依据类型：看到入口。验证：执行 help 并核对实际子命令。 |
| `discover-sessions` | AS thread/list；CLI 本地 session 文件；桌面会话列表 | 矩阵记录 CLI/AS/桌面入口，当前报告所读探针未附该项实测输出；依据类型：看到入口。验证：列出临时会话并比对已知 ID。 |
| `memory-mode` | AS `thread/start` memory_mode 参数 | 仅矩阵记载参数入口；本次没有行为探测。依据类型：看到接口。验证：设定开/关分别启动探针会话，检查请求与历史召回差异。 |
| `browser` | Codex 工具 `browser`（本任务运行时未见该工具挂载） | 矩阵记载 Codex 配置可集成 `browser@openai-bundled`，但当前会话工具目录不含 browser，且没有此次调用证据。依据类型：配置/矩阵记录，当前环境可用性未证实。验证：在启用该 MCP 的 Codex 会话查看工具清单并进行只读页面访问。 |

上述范围只列矩阵中有原生 pass 记录或有明确原生入口记录的单元；矩阵为 null/unverified 且无可靠入口证据的其余单元不推定支持。`app-server` 的方法可调用性与桌面 UI 暴露能力是两回事。

## 二、清单外、对多智能体协作有用的能力

| 能力 | 作用与入口 | 依据 |
|---|---|---|
| `review` 专项审查 | Codex CLI/App 的审查工作流，可对未提交变更、基准分支或指定提交执行代码审查；部分 app-server 版本有 review RPC。 | 仓库 `agy-fact-codex-20261018.md` 的接口调查记录；属于看到工具/协议及文档描述，本轮未执行。验证：以临时 diff 发起审查并检查发现项。 |
| 动态工具挂载 | App-server 客户端可在建会话时提供 DynamicToolSpec，并经宿主回调执行工具。 | 同一事实报告记录协议/schema 调查；本轮未闭环验证。验证：注册只读临时动态工具，要求模型调用并检查真实宿主回调。 |
| 实时语音 | `thread/realtime/*` 方法覆盖启动、停止、音频/文本输入和 voice 列表。 | 事实报告记录方法/schema；没有实时音频闭环证据。验证：实际协商 SDP 并完成短音频往返。 |
| 守护审批审查员 | `approvalsReviewer` 可将敏感命令/文件审批交给独立 reviewer agent。 | 事实报告中为接口/Schema 发现；未验证 reviewer 是否实际阻断/放行。验证：配置 reviewer 并触发审批，核对其决定及执行结果。 |
| Windows 受限令牌沙箱 | Windows Restricted Token 沙箱执行，不依赖 WSL/Hyper-V。 | 事实报告为实现能力分析，未在此任务中实测；验证：在临时目录分别检查允许/拒绝访问与进程令牌限制。 |
| 本地会话记录可检索 | Codex 将 rollout JSONL 存于用户 profile 下 sessions 目录，可用于宿主级恢复、审计和跨会话分析。 | CLI 探针报告确认 history 子命令不存在，并明确指出记录文件位置；AS history 读取已行为实测。文件系统入口属看到路径/记录。验证：对临时会话用 `thread/turns/list` 与 rollout JSONL 内容交叉比对。 |
| 多智能体协作工具与子 agent | 本次 Codex 运行环境提供 `spawn_agent`、`send_message`、`list_agents` 等协作入口，可并行委派工作并收取结果。 | 本任务会话实际可见工具列表，且本次被中心调度派发后完成自报；证据类型：看到工具并经历一次实际派发。独立协作语义仍可用同一入口新建探针任务验证。 |
| 电脑/浏览器操作 | Codex 可通过环境挂载的计算机使用/浏览器工具操作界面。 | 本次运行时只有浏览器 UI automation 工具面向会话的外部接口，但任务没有操作目标，且并非 Codex 产品内生工具；不能据此声称 Codex 普遍原生具备。若 Codex 通过 MCP 挂载 browser/电脑工具，需在具体会话核实工具目录后再确认。 |

## 三、确定做不到或本轮环境下不可用

| 能力/限制 | 依据 |
|---|---|
| `codex history`、`codex status`、`codex compact`、`codex quota` 不是 CLI 子命令 | `results_l0_exec.json` 中逐项调用 `--help`，均返回 unrecognized subcommand。可由 app-server/ACP 对应能力替代，但 CLI 自身没有这些命令。 |
| `codex exec` 单轮 stdin 不支持轮内插话 | L0 探针记载进程启动即关闭 stdin；用该入口无法中途 steer。AS 提供另一条入口。 |
| ACP 交互式审批、fork、compact、quota 不可用 | L1b ACP 探针记录无交互审批 handler，且 fork/compact/quota 无子命令。AS 有独立入口，故限制仅限 ACP 驱动。 |
| 当前会话不可证明 Codex 自带可直接操作桌面/浏览器的内置工具 | 本任务工具清单没有 Codex browser/computer-use 工具；矩阵配置记录只是可接入 browser MCP 的线索。结论限定当前会话，不泛化到所有产品版本或 MCP 配置。 |

统计：第一部分 28 条矩阵单元，其中行为级有调用/运行结果记录 21 条，其余 7 条仅有接口、配置或矩阵入口证据，待后续按判据复测。第二部分 8 项清单外能力；其中多项仅为接口/文档线索。第三部分 4 类限制。最明确的新发现是 app-server 动态工具、review/实时语音协议能力，以及当前会话原生提供的多智能体派工入口；电脑操作是否由 Codex 自身提供仍未证实。
