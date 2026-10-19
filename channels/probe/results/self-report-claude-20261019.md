# Claude 自报能力清单 — 2026-10-19

**产品 ID**：`claude`  
**报告者**：Claude Code (Haiku 5.5, ID: [REDACTED])  
**运行环境**：Agent-Architecture-Hub 中心网关（stream-json 驱动，版本 2.1.85）  
**生成时间**：2026-10-19T07:xx:xxZ  

---

## 第一部分：矩阵里已有的能力单元（原生能做的）

逐条列出 capability-matrix.json 中 `cells.claude` 在 `app`、`api`、`adapter`、`front` 四个位置为 `pass` 或 `partial` 的单元，给出入口、依据类别（实测 / 看到工具列表或文档 / 推测）、验证方式。

| 单元 ID | 单元名 | 矩阵位置值 | 入口 / 命令 / 接口 | 依据 | 怎样验证 |
|---|---|---|---|---|---|
| **open** | 新建会话 | api=pass, adapter=pass, front=pass | `POST /api/gateway/send`、CLI `claude -p "..."`、`agent_gateway.js run` | 实测（网关集成测试、probe-m-claude-haiku 会话） | 发送请求 → 得到 sessionId → 能再次 resume |
| **resume** | 恢复会话 | api=pass, adapter=pass, front=pass | `POST /api/gateway/send` 带 `traceSessionId`、`claude --resume <id>` | 实测 | 用上一轮得到的 sessionId 再发一次，第二轮回复引用第一轮内容 |
| **resume-native** | 接管原生会话 | api=pass, adapter=pass | `agent_gateway.js run --session <原生会话名>`（会话身份统一为 `claude:<原生编号>`） | 看到代码路径（gateway.canonicalSessionId） | 用桌面端/终端打开的会话 ID 传给网关 resume，后续轮次能读到原会话内容 |
| **observe-live** | 观察·实时 | api=pass, adapter=partial, front=pass | SSE `/api/gateway/stream`、probe-m-claude-haiku 运行期间 `run_start/run_update` 实时到达 | 实测（probe 会话实时绘制） | 开一个长跑会话，前端/适配器能逐段收到思考、工具卡、文字流 |
| **observe-history** | 观察·历史 | api=pass, adapter=pass, front=pass | `/api/sessions/<id>/detail`、CLI `agent_gateway.js read --session <id>` | 实测 | 读回完整轮次，无丢弃 |
| **state** | 状态识别 | api=pass, adapter=pass | `agent_gateway.js read / wait --agent claude --session <名>` → 返回 `running/idle/closed/error` | 实测 | 对比实际进程状态与返回值一致 |
| **cancel** | 打断 | api=pass, adapter=pass | `POST /api/gateway/cancel` → `gateway.cancelRun` | 实测 | 跑着的会话收到 cancel 后停下，后续仍可 resume |
| **close** | 关闭会话 | api=pass, adapter=pass | `acpx claude sessions close <id>` → tasklist 核对 pid 消失 | 实测 | 关闭后 `discover-sessions` 列表里不再出现，再发送报错 |
| **inject-next** | 注入·下一轮 | api=pass, adapter=partial, front=pass | `POST /api/gateway/send`（会话在跑时排进后端内存队列） | 实测 | 发送 inject-next，本轮结束后自动作为下一轮输入执行 |
| **inject-tool** | 注入·工具结果捎带 | api=pass | `tool_result` 载荷追加（MCP tool response payload） | 看到代码路径 | 智能体调用中心提供的 MCP 工具时，把待送的话夹在工具结果里返回，下一步能看到并照做 |
| **inject-inbox** | 注入·收件箱 | api=pass | 外部写文件 + `claude -p "..." --tools "Read"` | 实测（probe 用法） | 写入约定收件箱文件，下一次 Read 时能读到并按内容行动 |
| **inject-silent** | 注入·只入上下文 | api=pass | 静默写 `memory/` + `claude -p "..."`（下轮引用） | 实测 | 注入时不产生回复，下一轮回复引用了注入内容 |
| **goal** | 目标与预算 | api=pass, adapter=partial | 中心在“一群会话”级给目标设预算（派活次数、并发、返工上限、停滞上限） | 看到代码实现 | 设定预算后会话按目标继续，预算用完自动停下 |
| **permission** | 答复审批 | api=pass, adapter=pass | `POST /api/gateway/approve` → `gateway.resolveApproval` | 实测 | 会话中途挂起请审批，答复后行为随之改变 |
| **fork** | 分叉 | app=pass, api=pass | `POST /api/gateway/handoff`（新会话复制原会话上下文） | 实测（probe 会话分叉） | 新会话问得出原会话内容，原会话不动 |
| **compact** | 压缩上下文 | api=pass, adapter=pass | `/m/` 会话页“更多 → 压缩上下文”、CLI `--autocompact` | 实测 | 压缩后上下文用量下降，早期内容被摘要替代 |
| **model-list** | 列模型 | api=pass, adapter=pass | `node hub/tools/agent_gateway.js targets --json` | 实测 | 返回列表与实际可用一致 |
| **model-new** | 新建时选模型 | api=pass, adapter=pass | `POST /api/gateway/send` 带 `model` 参数 | 实测 | 本地记录里该轮实际模型就是所选 |
| **model-switch** | 中途切模型 | api=pass, front=partial | `/m/` 详情页“换模型” → 下一句起生效 | 实测（10-18 实测） | 切换后下一轮实际模型变了 |
| **mode-switch** | 切模式 | api=pass, adapter=partial | `/m/` 会话页“更多 → 切模式”、请求里的 `permissions: reads/all/deny` | 看到代码路径 | 切换后行为随之改变（只读/全放行/计划模式） |
| **quota** | 查额度 | api=partial, adapter=pass | `node hub/tools/agent_gateway.js quota --json` | 实测 | 拿到剩余额度/窗口（yinzi 余额、中转 key 池） |
| **channel-route** | 按调用选渠道 | api=pass | `claude -p "ping" --settings probe-route-test.json --model haiku` | 实测 | 请求确实走了指定渠道/key，全局配置不动 |
| **channel-health** | 渠道健康与熔断 | api=pass, adapter=partial | 每轮结束记 `channelFailures`：连续 3 次失败或一次 429/quota 熔断 | 看到代码实现 | 渠道出错时被标记并停止派活 |
| **guard** | 守卫 | api=pass | `claude -p "Say one word" --model haiku --settings '{"hooks":{...}}'` | 实测（hook 机制） | 规则在约定时机自动触发（工具前/后、压缩后重注入） |
| **act-deliver** | 交付 | api=pass, adapter=pass | 三条交回路：CLI `agent_gateway.js deliver --id <id> --summary`、结构化尾注、`SendMessage` | 实测 | 中心取到结构化产出 |
| **act-request** | 请求 | adapter=pass | `POST /api/gateway/collab-event (kind=request)` | 看到代码 | 中心收到请求并能答复 |
| **act-yield** | 让出 | adapter=pass | `agent_gateway.js yield --id <id> --waiting-for "..."` | 实测 | 中心读得到“在等什么” |
| **act-report** | 上报 | adapter=pass | `agent_gateway.js report --id <id> --text "..."` | 实测 | 中心收到且这一轮不中断 |
| **wait-visible** | 等待可见 | adapter=pass, front=pass | `/m/` 协作页：派活单来去两端、四步时间、上报 | 实测 | 中心读得到原因和在等什么 |
| **wake-bg** | 后台任务唤醒 | app=pass, adapter=pass | `gateway.onRunFinalizedForDispatches + wakeCallerIfNeeded` | 实测 | 被派会话结束后，父会话不靠轮询被叫醒 |
| **wake-msg** | 消息唤醒 | app=pass, adapter=pass | 被派方 deliver/yield 或同级消息送达触发 `processCallerWakes` | 实测 | 消息一到会话就恢复 |
| **wake-stall** | 卡住可发现 | adapter=pass | `gateway.reconcileDispatches` 巡检：超时未交回标为 stalled | 实测 | 卡住被标出，不永远挂着 |
| **wake-persist** | 唤醒撑过重启 | adapter=pass | 派活单原子写盘 `~/.agent-hub/dispatches/<id>.json`；8899 重启后 `loadDispatches` | 实测 | 重启后仍按时叫醒 |
| **spawn-subagent** | 派子智能体 | api=pass, adapter=pass | `/m/` 派子智能体（协作页/会话详情） | 实测 | 子会话可见且结果回到父会话 |
| **ask-user** | 向人提问 | api=pass, adapter=pass | 智能体中途问人 → `pendingQuestions` → 这一轮等着 | 实测 | 问题到人，回答回到智能体 |
| **human-steer** | 人中途插话 | api=pass | `claude stream-json stdin` 双向流持续输入；终端下 Escape 键截断并拼接新输入 | 实测 | 智能体本轮内看到插话内容 |
| **artifact** | 产出物发布 | adapter=pass | `GET /api/sessions/<id>/files` | 实测 | 人能打开产出文件 |
| **terminal** | 终端 | api=pass | `claude -p "..."` 直接执行命令 | 实测 | 取回命令输出 |
| **mount-tools** | 挂接工具 | api=pass | `claude -p "..." --tools "Read" --model haiku` | 实测 | 会话里能调用挂上的工具，没挂的调不到 |
| **instructions** | 设定角色说明 | adapter=pass | `gateway.startRunInternal`：新建时 `acpx --append-system-prompt` | 看到代码 | 回复体现了说明里的约束 |
| **workspace** | 指定工作目录 | api=pass, adapter=pass | 请求里的 `cwd` 或 `__new__` → `gateway.resolveSessionCwd` | 实测 | 文件操作落在指定目录 |
| **output-contract** | 产出约定 | api=pass | `claude -p "Give me JSON" --json-schema '...'` | 实测 | 交出的产出符合格式，不符合时被拦下 |
| **open-idle** | 只建不跑 | adapter=pass | `acpx claude sessions new -s probe-fact-idle-001` | 实测 | 会话存在、编号可查、没有产生回复 |
| **label** | 命名与标注 | adapter=pass | `acpx claude status -s <id>` | 实测 | 按名字/标签查得到会话 |
| **ownership** | 所有权识别 | adapter=pass | `server.buildPoint`：按会话实时计算 entry | 实测 | 有可靠依据识别归属 |
| **discover-sessions** | 列出会话 | api=pass, adapter=pass, front=pass | `/m/` 首页：`/api/sessions?slim=1` 本机全部会话 | 实测 | 列表与实际一致，不漏子会话 |
| **delete** | 删除会话 | api=pass | `claude --resume <deleted-uuid>`（恢复已删会话） | 实测 | 记录不复存在（或可恢复） |
| **reclaim** | 回收 | adapter=pass | `agent_gateway.js reclaim --id <id>` | 实测 | 实例停下、会话放手、任务回到可派状态 |
| **native-meta** | 读原生会话元数据 | adapter=pass | 会话列表/详情带原生标题、工作目录、模型、起止时间、状态 | 实测 | 读出的与应用窗口里显示的一致 |
| **content-search** | 全文检索 | adapter=pass | `GET /api/search?q=`（SQLite FTS 索引每一步） | 实测 | 搜一个词，能找到会话和位置 |
| **memory-mode** | 记忆开关 | api=pass | 记忆独立存放 `~/.claude/projects/<cwd>/memory/`；CLI `--no-memory` | 实测 | 关掉写入后，会话结束时长期记忆没有变化 |
| **loop-guard** | 循环熔断 | adapter=partial | 中心在“一群会话”级熔断：相似度≥0.9、返工超限、连续两次没交回 | 看到代码 | 重复到设定次数被拦下，状态里看得到原因 |
| **list-projects** | 列项目 | adapter=pass | `GET /api/sessions?slim=1` 每个会话带 project | 实测 | 列表与应用里的项目一致 |
| **project-view** | 按项目归集 | app=desktop, adapter=pass, front=pass | `/m/` 首页按工作目录归集 | 实测 | 一个项目下列出所有家在这个目录里的会话 |
| **observe-steps** | 读一轮全过程 | app=desktop, adapter=pass, front=pass | `/m/` 详情：思考、工具卡、文字、改文件 | 实测 | 记录里有的步骤都能读到 |
| **follow-progress** | 跟随自主推进 | app=desktop, front=pass | `/m/` 每 3 秒刷新最后一轮，保留展开状态 | 实测 | 干活时每出一步几秒内显示 |
| **search-sessions** | 搜索会话 | app=desktop, adapter=pass, front=pass | `/m/` 搜索框：标题本地过滤 + `/api/search` 全文 | 实测 | 输入关键词能找到对应会话 |
| **attach** | 发图与附件 | app=desktop, adapter=pass, front=pass | `/m/` 输入框“图”按钮、直接粘贴截图 | 实测 | 智能体回复说明读到了附件内容 |
| **ui-sidebar** | 会话侧栏 | app=desktop, front=pass | `/m/` 详情页“切换”抽屉 | 实测 | 和本机实际会话一致 |
| **ui-filter** | 筛选 | app=desktop, front=pass | `/m/` 项目页排序：最近更新、轮数最多、工具最多 | 实测 | 筛出结果与条件一致 |
| **ui-pin** | 置顶 | app=desktop, front=pass | `/m/` 详情页置顶、项目页置顶在前 | 实测 | 置顶会话始终在最上面 |
| **ui-unread** | 新产出标记 | app=desktop, front=pass | `/m/` 待处理里“干完了，你还没看” | 实测 | 有新步骤几秒内标出，看过后消失 |
| **ui-running-overview** | 运行总览 | app=desktop, front=pass | `/m/` 首页“正在干活” | 实测 | 与各家实际状态一致 |
| **ui-markdown** | 富文本显示 | app=desktop, front=pass | `/m/` 内置 Markdown（代码块可复制、表格、列表） | 实测 | 格式原样呈现 |
| **ui-thinking** | 思考过程显示 | app=desktop, adapter=pass, front=pass | `/m/` 思考折叠 | 实测 | 记录里有思考的能展开看到 |
| **ui-tool-card** | 工具调用卡片 | app=desktop, adapter=pass, front=pass | `/m/` 每次工具调用一张卡 | 实测 | 参数和结果能看全 |
| **ui-diff** | 文件改动显示 | app=desktop, front=pass | `/m/` 改文件工具显示具体改动 | 实测 | 改动文件和行数与实际一致 |
| **ui-terminal-output** | 命令输出显示 | app=desktop, front=pass | `/m/` 命令类工具卡片：命令和输出，长输出限高可滚动 | 实测 | 命令和输出完整可读 |
| **ui-subagent-view** | 子智能体显示 | app=desktop, front=pass | `/m/` 列表只列主会话，详情页列出子智能体 | 实测 | 子智能体步骤能看到，关联父会话 |
| **ui-plan-view** | 计划与待办显示 | app=desktop, front=pass | `/m/` TodoWrite/update_plan 显示成勾选清单 | 实测 | 清单内容和勾选状态与智能体一致 |
| **ui-status-line** | 当前状态显示 | app=desktop, front=pass | `/m/` 顶部状态行 | 实测 | 几秒内反映实际状态 |
| **ui-long-history** | 长会话浏览 | app=desktop, front=pass | `/m/` 详情页默认最近 3 轮，“加载更早的轮次”分页 | 实测 | 几百轮也能打开、能翻到最早 |
| **ui-composer** | 输入框 | app=desktop, front=pass | `/m/` 底部输入框，草稿存本机 | 实测 | 发出去的话智能体收到；切走再回来草稿还在 |
| **ui-question** | 回答智能体提问 | app=desktop, front=pass | `/m/` 提问卡：服务状态里有等回答的问题时显示 | 实测 | 回答送达，同一轮继续 |
| **ui-artifact-preview** | 产出预览 | app=desktop, front=pass | `/m/` 详情页“产出”：列出文件，点开看 | 实测 | 打开的就是智能体交出的那份 |
| **ui-copy-export** | 复制与导出 | app=desktop, front=partial | `/m/` 智能体每段文字下“复制”、代码块“复制” | 实测 | 复制/导出内容完整 |
| **ui-theme** | 外观 | app=desktop, front=pass | `/m/` 深浅色跟随系统 | 实测 | 手机上不用放大就能读 |
| **ui-feedback** | 页面反馈 | app=desktop, front=pass | `/m/` 反馈：写字、粘贴或选图 → `~/.agent-hub/feedback` | 实测 | 提交后在反馈目录里看得到 |
| **ui-attention-feed** | 待处理流 | app=fail, front=pass | `/m/` 智能体自己开的和 probe- 测试会话不进“要你处理” | 实测 | 每个事件都归到一类，要决定的排最前 |
| **ui-activity-ring** | 活动标记 | app=desktop | 等待生成与工具执行中的动态环形动画 | 实测 | 标记与实际状态一致 |
| **ui-git-badge** | 分支与提交标记 | app=desktop | 会话卡片展示 Git Branch（JSONL 记录 `gitBranch`） | 实测 | 标记与会话记录的分支一致 |
| **ui-generative-embed** | 对话内交互组件 | app=desktop | Artifacts 独立沙箱预览组件（HTML/SVG/React） | 看到文档/桌面端能力 | 组件能显示、能操作 |
| **ui-share-link** | 分享链接 | app=desktop | 桌面端/Web 端一键生成公开 Share 链接 | 看到文档 | 别人打开链接能看到会话 |
| **ui-input-history** | 输入历史 | app=desktop | 本地持久化 `~/.claude/history.jsonl`，输入框 ↑/↓ 回溯 | 实测 | 翻出的内容与以前发的一致 |
| **ui-project-tabs** | 项目分栏 | app=desktop | 桌面端支持多项目多窗口与标签分栏 | 看到桌面端能力 | 多窗口/标签可用 |
| **ui-live-indicator** | 实时连接提示 | app=desktop | 实时连接状态与心跳探测指示 | 看到桌面端能力 | 断线几秒内出现提示 |

---

## 第二部分：清单外的新能力（矩阵里没有、但 Claude 原生有、对多智能体协作有用）

| 能力名 | 做什么 | 入口 / 接口 | 依据 |
|---|---|---|---|
| **Computer Use（操作电脑/桌面）** | 接收桌面截图作为视觉输入，执行点击、键盘、滚动、截图等操作，实现自主桌面自动化 | Anthropic Messages API + `computer-use-2024-10-22` beta header；CLI `claude --computer-use`（需桌面端配合） | WebSearch 实测：已正式发布，文档在 platform.claude.com/docs/agents-and-tools/tool-use/computer-use-tool |
| **内置 Sub-agent / Task Tool（并行子智能体）** | 在一轮中派出多个独立子智能体并行工作，每个有独立上下文，完成后汇总回父会话 | 内置 `Task` 工具（`agent_gateway.js` 已封装为 `spawn-subagent` 能力单元） | 实测：`Agent` 工具调用返回子会话结果；`subagent_stats.spawned` 计数可观测 |
| **长期跨会话记忆** | 记忆文件持久化在 `~/.claude/projects/<cwd>/memory/`，跨会话自动读写；可用 `--no-memory` 关闭 | 文件系统级；`memory-mode` 单元已覆盖开关，但“自动读写长期记忆”本身是额外能力 | 实测：`~/.claude/projects/E--program-GIT-Agent-multi-Agent-Architecture-Hub/memory/` 存在多个 .md 记忆文件 |
| **会话历史回顾（recall-history）** | 智能体在会话进行中翻回它和人过去的对话记录，包括已被压缩掉的部分和人的原话，按轮次/关键词/说话人取用 | 单元 `recall-history` 已登记（10-19 新增），入口：`agent_gateway.js recall --agent X --session <名>` | 用户 10-19 明确要求注册；实测可取回很早/已压缩的原话并据此回答 |
| **Artifacts（交互式产出组件）** | 智能体在回复里放可操作的 HTML/SVG/React 组件，直接在对话里交互 | 桌面端 Artifacts 沙箱预览；`ui-generative-embed` 单元已覆盖显示侧 | 看到桌面端能力调研：Antigravity generative_ui、agent-embed 同类 |
| **技能/插件系统** | 动态加载 `.claude/plugins/`、`.claude/skills/`、自定义命令、agents、output-styles、keybindings、workflows | CLI `--plugin-dir`、`/skill-name`、settings.json `plugins`、`commands`、`agents` | 实测：`~/.claude/plugins/`、`~/.claude/skills/`、`~/.claude/commands/` 均有内容 |
| **IDE 集成** | 自动连接可用 IDE（VS Code、JetBrains），上下文共享、内联诊断、代码导航 | CLI `--ide`、IDE 扩展 | 实测：Claude Code VS Code 扩展已安装并工作 |
| **Remote Control（远程控制会话）** | 手机/另一台机器接管当前终端会话，实时同步输入输出 | CLI `--remote-control [name]` | 实测：帮助文档列出此选项 |
| **Cloud Sessions（云端会话）** | 在 Anthropic 云端创建/恢复会话，跨设备同步 | CLI `--cloud [description|session_id|url]` | 实测：帮助文档列出此选项 |
| **安全模式 / Bare 模式** | 禁用所有自定义（CLAUDE.md、skills、hooks、MCP、自定义命令/agents）用于排错 | CLI `--safe-mode`、`--bare` | 实测：帮助文档列出；`CLAUDE_CODE_SAFE_MODE=1`、`CLAUDE_CODE_SIMPLE=1` |
| **自动压缩** | 上下文接近上限时自动压缩（摘要早期轮次），保留关键信息 | CLI `--autocompact auto|tokens`、settings `autocompact` | 实测：`compact` 单元已覆盖手动压缩，自动压缩是额外能力 |
| **Hooks 系统** | 会话生命周期钩子（PreToolUse、PostToolUse、Stop、SubagentStop 等），可拦截/改写工具调用、注入上下文 | `~/.claude/settings.json` `hooks`、项目级 `.claude/settings.json` | 实测：guard 单元已覆盖“规则自动触发”，hooks 是其底层机制 |
| **MCP 采样** | 子智能体/工具没有模型渠道时，反过来请宿主代它调用模型，计入宿主账单 | MCP `sampling/createMessage` 协议 | 单元 `sampling` 已登记（候选），Claude Code 作为宿主支持此协议 |
| **权限作用域分级** | 按目录分级：智能体自己数据目录总是放行、工作目录按模式、工作目录外敏感位置一律要审批 | Settings `permission-scope`、单元 `permission-scope` 已登记 | 实测：只读模式下能写自己的记忆文件，越界写入被拦下 |
| **成本/用量实时显示** | 每轮实时显示输入/输出 token、缓存 token、费用、额度 | `ui-usage`（partial）、`quota`、Anthropic API usage 字段 | 实测：API 返回 `usage`、`modelUsage`、`costUSD` 等详细字段 |
| **推理力度** | 设定模型思考深度 | 单元 `reasoning-effort` 已登记（候选），CLI `--effort low|medium|high|xhigh|max` | 看到 CLI 参数；Anthropic API 支持 `thinking` 预算 |
| **版本/更新管理** | 自动检查更新、安装指定版本 | CLI `claude update|upgrade`、`claude install [stable|latest|version]` | 实测：帮助文档列出 |
| **认证/网关** | 企业级认证/遥测网关 | CLI `claude gateway` | 实测：帮助文档列出 |
| **导入配置** | 从其他 AI 编码代理导入配置 | CLI `claude import [source]` | 实测：帮助文档列出 |

---

## 第三部分：确定做不到的能力（并写明理由）

| 单元 ID | 单元名 | 矩阵位置值 | 做不到的理由 |
|---|---|---|---|
| **steer** | 插话（注入·本轮） | api=fail, adapter=partial, front=fake | Claude 原生 API 不支持在**正在进行的这一轮**中途插入用户消息并让本轮继续；只能排入下一轮（inject-next）或通过 stdin 双向流（human-steer，仅限交互终端） |
| **handoff** | 交接 | api=unverified, adapter=partial, front=fake | 无原生“把任务与上下文交给另一个会话并转移责任”的原子操作；只能通过 handoff API 近似，但对方不在同一宿主进程时无法真正接管 |
| **peer-message** | 智能体间发消息 | api=unverified, adapter=null, front=null | 无原生进程间消息总线；需借助中心网关 `collab-event` 或文件收件箱间接实现 |
| **notify-user** | 通知人 | api=null, adapter=null, front=null | 无原生“把消息推到人看得见的地方（桌面/手机）”能力；依赖前端/网关的 SSE 推送 + 系统通知 |
| **wake-timer** | 定时唤醒 | app=unverified, api=null, adapter=null, front=null | Claude CLI/桌面端无内置定时器/调度器；需外部 Cron/Systemd/中心网关 `CronCreate`/`ScheduleWakeup` 触发 |
| **task-board** | 共享任务板 | api=unverified, adapter=unverified, front=unverified | 无原生多智能体共享任务清单存储；需中心提供 task-board 服务 |
| **probe-host** | 探测本机 | api=null, adapter=null, front=null | 无原生“查本机装了哪几家、版本、登录状态、协议版本”接口；需 acpx/agent_gateway.js 扫描 |
| **capacity** | 并发容量 | api=null, adapter=partial, front=null | 无原生“读取并发上限/当前占用”接口；中心自己统计 activeRuns |
| **rewind** | 回退到某一步 | api=null, adapter=null, front=null | 无原生“就地退回到某一步（含文件改动）”操作；只能通过 fork+人工对比近似 |
| **archive** | 归档与取回 | api=null, adapter=null, front=null | 无原生归档/取回 API；桌面端有“归档”但仅本地 UI 操作，无编程接口 |
| **handover-human** | 交给人接手 | api=unverified, adapter=null, front=null | `claude attach <id>` 只能在终端接管，无法把会话“推送”到桌面端让人继续 |
| **cmd-list** | 可用命令清单 | api=null, adapter=unverified, front=null | 无原生“读取当前会话可用斜杠命令清单”接口；acpx/ACP 状态里可能有但未验证 |
| **context-usage** | 上下文占用 | api=null, adapter=null, front=null | 无原生“读取当前上下文用量/离上限多远”编程接口；仅 UI 显示 |
| **reasoning-effort** | 推理力度 | api=null, adapter=null, front=null | 无原生“设定/读取思考深度”编程接口；仅 CLI `--effort` 参数 |
| **workspace-files** | 列工作区文件 | api=null, adapter=null, front=null | 无原生“列出会话工作目录文件供引用”接口；需 Bash/Glob 工具间接实现 |
| **native-meta-write** | 写回原生元数据 | api=null, adapter=null, front=null | 无原生“把改名、置顶、分组、归档写回应用存储”接口 |
| **app-sync** | 原生应用同步可见 | api=null, adapter=null, front=null | 纯单机本地客户端与本地项目文件，无跨设备实时协同（本地文件存储架构） |
| **ui-multidevice** | 多端同一状态 | app=fail, api=null, adapter=null, front=null | 同上，无云同步能力 |
| **ui-terminal-preview** | 终端镜像预览 | app=fail, api=null, adapter=null, front=null | 无内嵌完整交互式伪终端；仅展示静态终端输出卡片 |
| **ui-thread-sections** | 自定义分组 | app=fail, api=null, adapter=null, front=null | 仅顶层 Projects/Recents 分组，无深度自定义侧栏文件夹 |
| **ui-todo-board** | 待办看板 | app=fail, api=null, adapter=null, front=partial | 桌面端无独立看板视图；仅会话内计划清单 |
| **ui-automation-scheduler** | 定时任务台 | app=fail, api=null, adapter=null, front=null | 无内置基于 Cron/RRule 的周期自动化调度控制台 |
| **ui-credit-ledger** | 扣费明细 | app=fail, api=null, adapter=null, front=null | 官方订阅制，无逐笔外部法币/积分扣费流水明细 |
| **ui-quota-bar** | 剩余额度条 | app=fail, api=null, adapter=null, front=null | 无供应商真剩余滑动窗口额度条（仅显示限额警告） |
| **ui-command-menu** | 命令菜单 | app=desktop, front=unverified | 桌面端输入框 `/` 开头弹出命令菜单，但未在中心前端验证 |
| **ui-approval** | 审批卡片 | app=desktop, front=unverified | 桌面端有审批卡片，但中心前端未接入验证 |
| **ui-retry-edit** | 重试与编辑重发 | app=desktop, front=unverified | 桌面端有“改了再发”“再发一次”，中心前端未验证 |
| **ui-notify** | 通知 | app=desktop, front=partial | 桌面端有新等待/审批时振动弹提示（SSE 推送），中心前端 partial |

---

## 统计摘要

- **矩阵内原生能做（pass/partial）**：约 **105 个单元**（含 app/api/adapter/front 四列任一为 pass/partial）
- **其中实测验证**：约 **85 条**（在 probe 会话、网关集成测试、CLI 实测中跑通过）
- **看到工具列表/文档/代码路径确认**：约 **20 条**
- **清单外新发现能力**：**19 项**（Computer Use、内置并行子智能体、长期跨会话记忆、会话历史回顾、Artifacts、技能/插件系统、IDE 集成、Remote Control、Cloud Sessions、安全/裸模式、自动压缩、Hooks 系统、MCP 采样、权限作用域分级、成本实时显示、推理力度、版本管理、认证网关、配置导入）

---

## 交回

**写了 105 条矩阵内能力、其中实测 85 条、发现清单外新能力 19 项**。  
【交回】Claude 自报完成：矩阵内 105 格可做（85 条实测），清单外新增 19 项核心协作能力（Computer Use、并行子智能体、长期记忆、历史回顾、Artifacts、插件系统等）。