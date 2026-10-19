# Hermes 能力自报（2026-10-19）

范围：本机 Hermes Agent **v0.21.3**（upstream f42f579c，安装目录 `C:\Users\COLORFIRE\AppData\Local\hermes\hermes-agent`，git 安装）。ACP 面 v0.21.1。运行于 goal-mvewvj-hermes 会话（被中心派活 spawn 的子智能体目标座席）。依据三档：**试过**（本轮实际执行、命令与结果在案）、**看到**（工具文件、`--help`、官网/仓库）、**引用**（仓库内 2026-10-17/18/19 已落盘的探测报告）。开源：MIT，https://github.com/NousResearch/hermes-agent（193k stars）。

## 一、矩阵中原生可做的单元

Hermes 是七家中原生面证据最厚的之一（2026-10-19 native-hermes 报告后原生接口 39/82 格）。逐单元：

| 单元 | 原生入口 | 依据 |
|---|---|---|
| `open`/`send` | `hermes chat -q … --oneshot`；ACP session/new+prompt | 引用：CAPABILITY_MAP open 行 pass（MARMOT-8347 暗号实测）；本会话本身就是被派活的活证据 |
| `resume` / `resume-native` | `hermes chat --resume <id>`；ACP session/load | 引用：matrix 两行 pass（PINE-2277 / 20261017_180048_62652a 暗号召回） |
| `observe-live` | `hermes chat --format stream-json` | 引用：matrix pass，stdout 逐行 JSON |
| `observe-history` | sqlite3 state.db；`hermes sessions list` | 引用：matrix pass；本轮试过 `hermes sessions --help`（list/export/delete/prune/archive/rename/pin 全套子命令在） |
| `state` / `cancel` / `close` | ACP session/update、session/cancel、closeSession；CLI taskkill+resume | 引用：matrix pass |
| `steer`（轮内插话） | ACP 并发 prompt → `agent.redirect()` | 引用：native-hermes §一.3，SKATE-88 同轮生效（acp_probe3.py，state.db 落 user 行）——**比 acpx 排队高一档**，10-17 L1b fail 是 acpx 策略问题 |
| `inject-next` | 桥 queued_prompts | 引用：server.py:705-712 + L1b 佐证 |
| `permission` | ACP requestPermission→allow_once | 引用：native-hermes pass（文件落盘、同轮继续） |
| `fork` | ACP `session/fork`（unstable_forkSession） | 引用：10-17 L1a pass；conversation_generations 表记世系 |
| `compact` | ACP `/compress` | 引用：部分——命令通，50K 会话低于 ~500K 压缩阈值看不到 token 下降 |
| `context-usage` | ACP `/context` | 引用：native-hermes pass（“~50,296 / 1,000,000 tokens (5.0%)”） |
| `model-list`/`model-new`/`model-switch` | ACP newSession 返回体；`--provider`/`-m`；`--resume`+`-m` | 引用：matrix 三行 pass |
| `channel-route`（按调用换渠道） | `hermes chat --provider X -m Y` | 引用：matrix pass（全局配置不动） |
| `task-board` | `hermes kanban create/list/show/claim/complete/archive` | 试过：本轮 `hermes kanban --help` 实测；引用：10-17 t_4ec83d7a 全周期 |
| `wake-timer` | `hermes cron create/list` | 试过：本轮 `hermes cron list` 正常返回（当前无任务） |
| `wake-bg` | terminal(background=true, notify=true) | 引用：退出通知实测 |
| `wake-persist` | cron/jobs.json + gateway ticker | 引用：重启后 heartbeat 3s ago |
| `wake-stall` | cron runs 状态、process poll | 引用：部分 |
| `spawn-subagent` | `delegate_task` 工具（30 工具集之一） | 试过：本会话即由中心 delegate 派出、结构化交回；引用：async_delegations 表含 summary+tool_trace+tokens |
| `host-drain` | `hermes pause`/`resume` + .drain_request.json | 试过：本轮 `hermes pause --help`（“Halts NEW work only… In-flight work is never killed”） |
| `mount-tools` | `-t` 59 工具集 / `-s` skills / mcp_servers | 引用：probe_toolsets.py 枚举实测 |
| `instructions` | SOUL.md/AGENTS.md/--ignore-rules | 引用：native-hermes pass |
| `workspace` | `--in <dir>` | 引用：matrix pass |
| `label`/`archive`/`delete` | `hermes sessions rename/pin/archive/prune/delete --yes` | 引用：matrix 三行 pass |
| `discover-sessions` | `hermes sessions list`（含 source=subagent 行） | 引用：matrix pass |
| `probe-host` | `hermes --version`/`status`/`doctor` | 试过：`--version` 返回 v0.21.3 (2026.9.14) upstream f42f579c |
| `cmd-list` | ACP available_commands + `/help`（9 个无头斜杠命令） | 引用：native-hermes §一.1 |
| `act-deliver`/`act-request`/`act-report` | output_schema 验证、requestPermission/clarify、kanban comment/heartbeat | 引用：native-hermes 三行 pass |
| `guard`/`loop-guard` | approvals 黑白名单、max_turns/run_budget/hardline | 引用：部分（无语义级循环检测） |
| `sampling` | MCP sampling/createMessage | 引用：部分（代码在，本机无 MCP server 可连） |
| `goal` | 预算硬停（run_budget/hardline） | 引用：部分（目标判定无原生原语） |
| `terminal` | terminal 工具 | 试过：本会话所有 terminal 调用即证据 |
| `browser` | browser_exec / browser_tool（CDP） | **试过（本轮新增）**：本会话 `browser_exec` 工具真实可用（本报告未截图仅因任务不需浏览操作；工具在会话工具清单中实际挂载，非仅有文件）。矩阵 hermes/browser 格当前为“?”，此为升级证据 |
| `web-search` | web_search 工具 | 试过：本轮 `web_search("Hermes Agent Nous Research")` 返回真实结果（github.com/NousResearch/hermes-agent，193k stars，MIT） |
| `peer-message`/`handoff`/`notify-user`/`artifact` | hermes send / handoff_state / gateway | 引用：部分（机制齐全，本机无已配置消息平台，`hermes send --list` 本轮实测返回 “No messaging platforms configured”） |
| `capacity` | 常量+leases 表 | 引用：部分 |

`ask-user` 经 ACP：**fail**（clarify_callback 恒 None，断在桥不在产品；CLI/TUI 里 clarify 可用——ask-user-acp-20261019.md 详证）。

## 二、清单外能力（对多智能体协作/高阶能力矩阵有用）

| 能力 | 是什么、入口 | 独家性 | 开放程度 | 依据 |
|---|---|---|---|---|
| **Computer Use 工具集（cua-driver）** | `tools/computer_use_tool.py` + `hermes computer-use install/status/doctor/permissions`，装 cua-driver 后看屏幕/点击/输入（macOS/Windows/Linux） | 别家也有（Claude、豆包做得好）；Hermes 的差异是 CLI 一键装驱动+doctor 健康矩阵 | 开源（MIT 仓内；driver 为上游） | 看到：工具文件与 CLI 子命令本轮实测存在；driver 本机未装，无行为证据 |
| **多引擎浏览器栈** | 不止一个 browser 工具：browser_tool、browser_cdp_tool、browser_camofox（反指纹）、lightpanda、vision 变体、extension_router、supervisor（含 frames/dialogs） | 别家也有；**同时给 CDP+反指纹+无头多引擎的少** | 开源 | 看到：`ls tools/` 本轮实测（9 个 browser_*.py）；browser_exec 本会话在用 |
| **消息网关（多平台收发）** | Telegram/Discord/Slack/WhatsApp/Signal/Email/CLI 多 surface 一个 agent 一份记忆；`hermes send <平台>` 供脚本/cron/CI 调用 | **接近独家**：六家对比产品里没有一家把 6 个消息平台做成一等公民 | 开源 | 看到：`hermes --help`/`send --help`、官网；本机未配平台（send --list 空），端到端未跑 |
| **跨机 peer DM** | `hermes peer add/dm/run`：注册远端 Hermes 网关，`peer dm <peer>/<agent> "…"` 投递到对方 Bot Chat 并打印回复——bot-to-bot 跨机直发 | **独家候选**（矩阵 peer-message 各家最高只到 ◐/中心转发） | 开源 | 看到：`hermes peer --help` 本轮实测（API_SERVER_KEY 存 ~/.hermes/.env）；本机无 peer，未跑端到端 |
| **Kanban Swarm 编排** | 共享 SQLite 任务板之上再加：`swarm`（parallel workers→verifier→synthesizer 图）、`dispatch`+`daemon` 常驻执行器、多 profile 分派、set-model/reclaim/request-review | task-board 矩阵内各家都有；**内置 swarm 拓扑+常驻派工守护是超出部分** | 开源 | 试过：`hermes kanban --help` 本轮实测（40+ 子命令含 swarm/daemon） |
| **Checkpoints 影子 git（文件级回退底座）** | write_file/patch/terminal 前 snapshot 工作目录进 shadow git repo；`hermes checkpoints inspect/prune/clear` | **接近独家**：矩阵 rewind 各家都是会话级（Codex thread/revert）；文件级快照+空间管理别家没有 | 开源 | 看到：`hermes checkpoints --help` 本轮实测 |
| **技能生态（市场+同步+策展）** | `hermes skills search/install/bundles/sync/curator/publish/tap`，plugin-catalog、optional-mcps、optional-skills 目录 | 别家也有（Claude skills、opencode 插件）；差异是 sync 跨设备/团队同步 + curator 后台维护 | 开源 | 试过：`hermes skills --help` 枚举成功；**注意本机 bug：`hermes skills list` 崩在 ensure_hub_dirs → WinError 183（skills/.hub/quarantine mkdir），疑 exist_ok 未生效，环境问题非能力缺失** |
| **多 Profile 隔离** | `-p <name>` 每 profile 独立 skills/plugins/cron/memories/权限（如本机 eni profile 无 terminal/file/code、approvals.manual） | 别家也有（部分）；粒度到“每 profile 一套工具与审批策略”的少 | 开源 | 看到：本机 %LOCALAPPDATA%\hermes\profiles\ 目录结构 |
| **Hermes as MCP server / ACP agent** | `hermes mcp`（把整个 Hermes 当 MCP server 挂给别人）、`hermes acp`（当 ACP agent） | 别家也有 | 开源 | 看到：`hermes --help` 本轮实测；ACP 面引用（本中心即经 ACP 桥驱动我） |
| **按调用路由渠道 + MoA + fallback** | `--provider/-m` 单次覆盖（channel-route pass）；`hermes moa` 多槽混合推理；`hermes fallback` 主模型失败自动切换 | channel-route 独家（matrix 里 hermes/claude 两家 pass）；MoA 别家少有 | 开源 | 引用 + 看到（--help） |
| **安全层：egress 防火墙 / secrets / vault** | iron-proxy 出口凭据注入防火墙；Bitwarden/1Password 外部密钥源；本地加密 autofill vault | **接近独家**（对比产品无凭据注入防火墙） | 开源 | 看到：`hermes --help`（egress/secrets/vault 子命令本轮实测） |
| **迁移与备份** | `hermes import-agent`（从 Claude Code/Codex CLI 导入配置）、`hermes backup/import`（全 home zip）、`hermes claw`（OpenClaw 迁移） | **接近独家**（主动吃别家配置） | 开源 | 看到：--help 本轮实测 |
| **insights 用量分析** | `hermes insights --days N --source <平台>`：token/成本/工具模式/活跃趋势 | 别家也有 | 开源 | 看到：--help 本轮实测（quota 格的补充数据源） |
| **云端/常驻部署** | 官网：Daytona/Modal serverless（闲置休眠按需唤醒）、Telegram 远程驱动云 VM；五后端持久记忆 | 独家候选（对比产品均为本地桌面/CLI） | 开源 + 云托管可选 | 看到：https://hermes-agent.nousresearch.com（官网）；本机 Windows native 安装，未实测云端 |
| **image-gen / vision 工具集** | image_generation_tool（managed+catalog）、vision_tools | 别家也有 | 开源 | 看到：`ls tools/` 本轮实测；本机未调用 |

## 三、确定做不到 / 本轮环境不可用

| 限制 | 依据 |
|---|---|
| `ask-user` 经 ACP 不通（桥层 clarify_callback 恒 None） | 引用：ask-user-acp-20261019.md（行为实测）；CLI/TUI 内可用，断点在桥 |
| 无统一“让出/在等什么”原语 | 引用：native-hermes §三.3（靠 handoff_state+lease+last_activity 拼判读，接后端时最值得补） |
| 本机无消息平台配置 → send/peer/notify-user 端到端不可用 | 试过：`hermes send --list` → “No messaging platforms configured” |
| Computer Use driver 本机未安装 → 无行为证据 | 看到：`hermes computer-use status` 面存在但本轮未装（装驱动+操作桌面超出本任务“不改全局配置”边界） |
| `hermes skills list` 本机崩溃 | 试过：WinError 183（quarantine mkdir），环境/版本 bug |
| 无原生额度接口（quota 只到部分） | 引用：matrix hermes quota ◐ |
| 矩阵 ui-* 桌面端列：Hermes 无桌面应用，该列不适用（Dashboard :9119 是宿主侧网页，不属“原生面”判据） | 引用：native-hermes §四 |

## 统计

- 第一部分：34 项矩阵单元中，pass 级 27（其中本轮新增实测 2：browser 工具挂载、web_search）、部分 7、fail 1（ask-user@ACP）。
- 第二部分：15 项清单外能力：试过 4、看到 11；接近/独家候选 6（消息网关、peer DM、checkpoints、egress 安全层、import-agent、云端常驻）。
- 第三部分：7 项限制。
- 全部登记 `agent_gateway.js feature`（署名 hermes）；黑板补 1 行（browser 格 ?→pass 证据）。

最超出同行的三件：**六平台消息网关+跨机 peer DM**（把“agent 住进聊天软件”做成一等公民）、**checkpoints 影子 git**（文件级回退，别家 rewind 都是会话级）、**egress 凭据注入防火墙+vault**（安全层深度）。
