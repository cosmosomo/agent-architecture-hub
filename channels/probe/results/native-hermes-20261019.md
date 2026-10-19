# Hermes 原生面"？"格与空格查证报告（2026-10-19）

> 派活单：dsp_181255_2v0o（首轮，额度中断）/ dsp_040250_h7pt（续轮）
> 测试者：Hermes 自身（probe-hm-native-1019 会话）
> 版本：**Hermes Agent v0.21.1**（acp_adapter agentInfo；CLI 报 v0.21.3，安装目录 C:\Users\COLORFIRE\AppData\Local\hermes\hermes-agent，源码仓 E:\program\GIT\Agent\hermes and vcp like\hermes-agent 0.21.1+990473a）
> 日期：2026-10-19（证据行 at=2026-10-19T12:43:15+08:00 批次）

## 结论速览

- **黑板新写 38 行**（L0 29 行、L1a 9 行），全部带实际命令/帧/落盘证据。
- **Hermes 原生面证实格数：23 → 39**（30% → 51%，`build_coverage.js` 重出后 `CAPABILITY_MAP.md` "原生接口合计"）。逐入口：命令行 15→28（37%）、ACP 桥 13→16（21%）；实际能力（任一位置）44→52（68%）。
- 探针脚本：`channels/probe/scripts/hermes/acp_probe2.py`（slash/perm/reset/compress）、`acp_probe3.py`（redirect 插话）、`acp_probe5.py`（compact 大会话）、`probe_toolsets.py`（59 工具集枚举）、`append_bb_1019.py`（黑板行）。日志同名 `acp_probe_*.log`。
- 交回前已跑：`node hub/tools/agent_gateway.js tables` → "核对：四张表和代码全部对上"；`node channels/probe/scripts/build_coverage.js` → 重出通过。

## 一、任务书"还不知道的"三个问题

### 1. 哪些斜杠命令能经 ACP 真用？

**9 个无头命令全部能**：`/help /model /tools /context /reset /compress /steer /queue /version`。它们在 `acp_adapter/commands.py` 的 `_COMMANDS` 注册，作为一轮 `session/prompt` 发送即执行、不耗模型调用（实测 `/version` → `Hermes Agent v0.21.1`、`/context` → token 占用与压缩阈值）。未注册的斜杠（如 `/goal`）落到模型当普通文本。CLI/TUI 的完整斜杠表（`cli.py:3170` `_SLASH_DISPATCH`，约 40 个：new/model/retry/undo/save/agents/bg/queue/steer/compress/…）**不经过 ACP**——那些只在交互 REPL/TUI 里有效。

### 2. 子智能体、后台任务、分叉在原生上的行为和落盘位置

| 事项 | 行为 | 落盘 |
|---|---|---|
| 子智能体 | `delegate_task` 工具（hermes-acp 工具集 30 个工具之一，ACP 面可用）；父子并行、结果 schema 验证后回父轮 | `state.db sessions` 行 `source=subagent`、`parent_session_id` 指父；异步批次在 `async_delegations` 表（delegation_id/state/delivery_state/result_json 含每个子的 summary+tool_trace+tokens） |
| 后台任务 | `terminal(background=true)` 立即返回 session_id 让出执行权；`notify=true` 进程退出时宿主回推一条通知（不靠轮询）；`process_manage poll/wait` 查询 | state.db messages 落 tool 行（Background started → running → exited）；进程表在宿主内存，完成后 7 天内可回读 |
| 分叉 | ACP `session/fork`（10-17 L1a 已证 pass，SDK 前缀 unstable_forkSession）；CLI 无 fork 参数，最近似是 TUI `/branch` | 新 sessionId 带 `conversation_generations` 表记录世系 |

### 3. 轮内插话的真正入口（修正 10-17 结论的细节）

ACP 桥 `_claim_turn_or_queue`：turn 进行中来的第二个 text-only prompt，若运行时支持（`_supports_active_turn_redirect=True`）走 **`agent.redirect()`**——模型请求期取消当次请求、把纠正追加为真实 user 消息后重试；工具执行期降级为 `steer()` 追加到最后一个工具结果。实测（acp_probe3.py）：主轮后台 ping -n 45 进行中插话"改成 SKATE-88"，主轮回复 **SKATE-88**，插话在 state.db 同一会话落为 user 行——**本轮内生效，不是排队**。redirect 不适用时才进 `queued_prompts` 排下一轮（`server.py:705-712, 910-912`）。

## 二、逐格结论（38 行黑板的浓缩）

### 通（pass，14 格）
| 单元 | 入口 | 一句话证据 |
|---|---|---|
| cmd-list (L1a) | 桥 available_commands + /help | 9 命令清单实测 |
| context-usage (L1a) | /context | "~50,296 / 1,000,000 tokens (5.0%)，阈值 ~500,000" |
| steer (L1a) | 并发 prompt → redirect | SKATE-88 同轮生效 |
| inject-next (L1a) | queued_prompts | 源码+L1b 佐证 |
| permission (L1a) | requestPermission→allow_once | 文件落盘、同轮继续 |
| label (L0) | sessions rename/pin | pinned=1 落库 |
| archive (L0) | sessions archive/prune | 软隐藏+过滤器全套 |
| task-board (L0) | kanban create/list/complete/archive | t_4ec83d7a 全周期（已清理） |
| channel-route (L0) | --provider/-m 按调用 | 10-17 用量行佐证 |
| host-drain (L0) | .drain_request.json + pause/resume | 排空+急停两档 |
| wake-persist (L0) | cron/jobs.json + gateway ticker | 重启后 heartbeat 3s ago |
| discover-sessions (L0) | sessions list | 含 subagent 行 |
| act-deliver (L0) | output_schema 验证 + deliver | 三层结构化 |
| act-request (L0) | requestPermission/clarify/approvals | 审批链路通 |
| act-report (L0) | kanban comment/heartbeat + 事件流 | 轮内可写 |
| wake-bg (L0) | terminal(background,notify) | 退出通知实测 |
| mount-tools (L0) | -t 59 工具集 / mcp_servers / -s | 枚举实测 |
| instructions (L0) | SOUL.md/AGENTS.md/--ignore-rules | 原生注入体系 |

### 部分（partial，17 格）
capacity（常量+leases 表可读，无配额接口）、loop-guard（max_turns/run_budget/hardline 有，语义级循环检测无）、sampling（代码在，本机 MCP server 连不上没跑端到端）、peer-message / handoff / wake-msg / notify-user / artifact（机制齐全，本机无已配置消息平台，端到端未跑）、spawn-subagent（历史数据证，本轮省额度未新发）、act-yield / wait-visible（无统一让出原语，靠 handoff_state+lease+background 拼）、goal（预算硬停有、目标判定无）、handover-human（TUI --resume 接手，无桌面 app）、output-contract / channel-lease（只在委派子代理层）、guard / permission-scope（审批与黑白名单活，无目录树级）、open-idle（ACP new/prompt 分离天然支持，CLI 面不行）、compact (L1a)（命令通、50K 会话低于 500K 阈值看不到下降）。

### 不能（fail，1 格）
ask-user 经 ACP：适配层 `clarify_callback` 恒 None（10-19 ask-user-acp-20261019.md 已详证；CLI TUI 里 clarify 工具可用——断在桥，不在产品）。

## 三、对认知的修正

1. **steer 格 10-17 L1b 记 fail 是对的，但原因是 acpx 的排队策略，不是 Hermes**：桥本身 redirect 生效（本轮 L1a 实测+落盘）。矩阵里 hermes 原生面 steer 现在有 pass 证据。
2. **wake-bg 10-17 L0 记 fail 要看宿主**：oneshot 无头跑完即退（没人等结果）；交互/ACP/gateway 宿主下 background+notify 是真唤醒。已补 pass 行，route 同为 L0/cli，条件写明。
3. **Hermes 的"让出/在等什么"没有一等公民原语**：靠 handoff_state 列 + session_turn_leases（holder=pid:turn:platform + 8 分钟到期）+ last_activity_description 组合判读。这是接进我们后端时最值得补的缺口。
4. **compact 判据未达成的原因**：压缩启发式阈值 ~500K（50%），50K 会话压了等于没压（6→6 消息、token 不变）。要看到下降需灌到阈值之上，本轮额度紧张没跑；通路本身是通的。

## 四、没查的和为什么

- **inject-inbox / inject-tool**：Hermes 无收件箱文件约定；工具结果捎带=我们的 MCP 工具侧实现，不是 Hermes 原生面的事——留给中枢侧。
- **compact 大会话（>500K token）**：需 ~10 轮大灌入，智谱额度与其他产品共享，本轮放弃；下一轮额度宽裕时可跑 acp_probe5.py 加大 blob。
- **ui-* 50 格**：Hermes 无桌面端界面（列的定义是"桌面应用给人看什么"），这列对 Hermes 本就不适用；Dashboard :9119 是宿主侧网页，不属于"原生面"这层的判据。维持空。
- **peer-message / handoff / notify-user 端到端**：本机没有任何已配置消息平台（`hermes send --list` 空），需要用户配一个测试平台或给一个远端 peer 才能跑。

## 五、给负责人的接入建议（自己做的清单新增候选）

按"原生已证实、后端没接"：kanban（task-board，原生全套 CLI+DB）、sessions pin/rename/archive（ui-pin 底座）、/context（context-usage，ACP 一轮即得）、redirect 插话（steer，比 acpx 排队强一档）、pause/drain（host-drain）、approvals test（guard 的判定器）。
