# 修正 compact 行证据（大会话 6->6 无变化，改 partial）后一次性追加全部黑板行
import json, time

BB = r'E:/program/GIT/Agent/multi/Agent-Architecture-Hub/channels/probe/blackboard.jsonl'
now = time.strftime('%Y-%m-%dT%H:%M:%S+08:00')

def row(cap, layer, route, result, condition, evidence, cmd, note='-'):
    return {
        'at': now, 'by': 'hermes', 'family': 'hermes', 'layer': layer, 'route': route,
        'surface': 'acp-bridge' if layer == 'L1a' else 'native-cli',
        'capability': cap, 'result': result, 'condition': condition,
        'evidence': evidence[:480], 'cmd': cmd[:300], 'note': note[:200],
    }

rows = []
V = 'Hermes Agent v0.21.1 (acp_adapter agentInfo) / CLI v0.21.3'

# ---- L1a ACP 桥（本轮行为实测） ----
rows.append(row('cmd-list', 'L1a', 'hermes/L1a/acp-bridge', 'pass',
    '桥初始化后 available_commands_update；/help 一轮落地',
    f'/help 列 9 命令：help/model/tools/context/reset/compress/steer/queue/version；/version → "Hermes Agent v0.21.1"。{V}',
    'acp_probe2.py slash（session/prompt [{type:text,text:"/help"}]）',
    '任务书问号项：斜杠命令经 ACP 真用——9 个无头命令全可用，未注册的落到模型'))
rows.append(row('context-usage', 'L1a', 'hermes/L1a/acp-bridge', 'pass',
    '/context 读上下文占用',
    'Conversation: 6 messages / Context usage: ~50,296 / 1,000,000 tokens (5.0%) / Compression: ~449,704 tokens until threshold (~500,000, 50%)',
    'acp_probe5.py /context（compact3.log ctx-before 帧）',
    '估算 token、上下文上限、压缩阈值都有；usage_update 通知另有 size/used'))
rows.append(row('steer', 'L1a', 'hermes/L1a/acp-bridge', 'pass',
    '主 turn 进行中发第二个 session/prompt（text-only）',
    'bridge 日志 "Delivered /steer to agent after tool batch"；state.db 770def57 插话作 user 行落库、主轮回复 SKATE-88（同轮生效）',
    'acp_probe3.py redirect：主轮 terminal background ping -n 45 + poll，20s 后插话',
    'agent.redirect()：模型请求期取消该请求重试、工具期降级 steer 追加到工具结果；与 10-17 L1a steer=pass 一致并补落盘证据'))
rows.append(row('inject-next', 'L1a', 'hermes/L1a/acp-bridge', 'pass',
    'turn active 时桥排队路径 queued_prompts',
    'server.py _claim_turn_or_queue：redirect 不适用则 queued_prompts.append → 下一轮自动 pop 执行（server.py:910-912）；10-17 L1b acpx --no-wait 实测 "[queued]" 且下一轮执行',
    '读 acp_adapter/server.py:705-712 + L1b 佐证',
    '排队下一轮原生支持；与 redirect 并存（redirect 优先）'))
rows.append(row('permission', 'L1a', 'hermes/L1a/acp-bridge', 'pass',
    'default 模式写文件 → requestPermission → allow_once → 同轮继续',
    'title="Approve edit: perm_native_l1a.txt" options=[allow_once,deny]；答后回复"已写入"，文件落盘存在',
    'acp_probe2.py perm',
    '与 10-17 L1a permission=pass 复证；编辑类审批走 edit_approval.py'))
rows.append(row('compact', 'L1a', 'hermes/L1a/acp-bridge', 'partial',
    '/compress 经 ACP：4 消息小会话与 ~50K token 大会话各一次',
    '小: "Context compressed: 4 -> 4 ~15,846 -> ~15,846"；大: "6 -> 6 ~50,296 -> ~50,296"（/context 复核不变）。命令通路真、_compress_context 可调，但两档会话压缩启发式都判定无需压缩，判据"用量下降"未达成',
    'acp_probe2.py compress / acp_probe5.py compact3',
    '机制在（threshold ~500K 50%），50K 仍低于阈值；需 ~500K 会话才能看到实际下降，额度代价大未跑到'))
rows.append(row('ask-user', 'L1a', 'hermes/L1a/acp-bridge', 'fail',
    '经 ACP 让智能体向人提问',
    '10-19 ask-user-acp-20261019.md：acp_adapter 未注入 clarify_callback（恒 None），clarify 工具不可用，prompt 标 "running headless — do not call clarify"，模型文本结轮',
    'channels/probe/results/ask-user-acp-20261019.md 第一节 Hermes 行',
    'CLI TUI 里 clarify 可用（toolsets clarify:1 tools）；断在 ACP 适配层，非产品无此能力'))

# ---- L0 原生命令行 / 配置 / 本地记录 ----
rows.append(row('label', 'L0', 'hermes/L0/cli', 'pass',
    'sessions rename/pin/unpin/pinned',
    "rename → \"Session '969e613e…' renamed to: probe-hm-native-ping-1019\"；pin 后 pinned 列表显示（Src: acp）；state.db sessions.pinned=1；unpin 复位",
    'hermes sessions rename <id> <t>; hermes sessions pin <id>; hermes sessions pinned',
    'pinned 列即 ui-pin 原生底座；title 有唯一索引'))
rows.append(row('archive', 'L0', 'hermes/L0/cli', 'pass',
    'sessions archive 软隐藏 + prune/delete',
    'archive --help 全套过滤器（--older-than/--source/--title/--min-tokens/--include-pinned…）；sessions.archived 列；prune --dry-run 预览；delete 单删',
    'hermes sessions archive --help; hermes sessions prune --help; sqlite3 .schema sessions',
    '归档=软隐藏；取回无 unarchive 子命令（表字段在，可 sqlite 恢复）'))
rows.append(row('task-board', 'L0', 'hermes/L0/cli', 'pass',
    'kanban 共享任务板全流程',
    'create "probe-hm-native taskboard check 1019" → "Created t_4ec83d7a (ready, assignee=default)"；list ▶ ready；complete → "Completed"；archive → "Archived"（探针任务已清理）',
    'hermes kanban create/list/complete/archive（board=default, kanban.db SQLite）',
    '多 profile 原子认领（CAS）、依赖 task_links、评论、通知订阅、每 board 独立 DB'))
rows.append(row('capacity', 'L0', 'hermes/L0/cli', 'partial',
    '并发上限可读、当前占用可查',
    '_DEFAULT_MAX_CONCURRENT_CHILDREN=10（delegate_tool_config.py:17）、_DEFAULT_MAX_ASYNC_CHILDREN=3（async_delegation.py:40）；session_turn_leases 实时行：holder=pid:turn:platform=acp + acquired/expires（8 分钟租）',
    "grep 源码常量 + sqlite3 'SELECT * FROM session_turn_leases'",
    '上限=配置常量（config.yaml 可改），非动态配额；占用可读 leases 表，无 CLI 汇总'))
rows.append(row('channel-route', 'L0', 'hermes/L0/cli', 'pass',
    '单次调用换 provider/model 不动全局',
    'chat --provider <name> -m <model> 仅本进程生效；10-17 行 310/311 已证落 session_model_usage（glm-5.3→glm-5.2 新增行）；providers 在 config.yaml custom_providers（cc-switch 管理）',
    'hermes chat -q … --provider zai-glm-5.2 -m glm-5.2（同 10-17 L0 model-* 机制）',
    '原生即按调用选渠道；运行中会话热切 provider 无原语（切模型有 /model 与 set_model）'))
rows.append(row('host-drain', 'L0', 'hermes/L0/cli', 'pass',
    '宿主排空 + 急停',
    'gateway/drain_control.py：.drain_request.json 标记 → gateway watcher → gateway_state=draining（带 epoch/过期防孤儿）；hermes pause 全局急停（新 cron/kanban/gateway 轮不再起、在跑不杀），hermes resume 解除',
    'hermes pause --help; hermes resume --help; 源码 drain_control.py 模块头',
    '两档齐全：drain 优雅排空、pause 急停新活'))
rows.append(row('loop-guard', 'L0', 'hermes/L0/cli', 'partial',
    '循环/失败熔断',
    '无"重复同失败 N 次提醒换思路"通用实现；近似件全实测：approvals hardline-deny（rm -rf / → exit 3 永拒）、--max-turns（默认 500）、--run-budget（80% 提示收尾+截断 provider 超时）、cron incidents 失败落账',
    "hermes approvals test 'rm -rf /'; hermes chat --help (--max-turns/--run-budget)",
    '步数/时长预算原生有；语义级循环检测无——补齐空间'))
rows.append(row('sampling', 'L0', 'hermes/L0/cli', 'partial',
    'MCP sampling/createMessage 宿主代调',
    'tools/mcp_tool_sampling.py 完整客户端处理器（docstring: sampling/createMessage text+tool-use、elicitation）；本机唯一 MCP 服务器 ap-vibe 连接失败 parked（compact3.log stderr），端到端未跑',
    'head -30 tools/mcp_tool_sampling.py; 桥日志 MCP registered 0 tools (1 failed)',
    '代码路径在=声明+代码级；行为验证需可用 MCP server，本机暂无'))
rows.append(row('wake-persist', 'L0', 'hermes/L0/cli', 'pass',
    '约定唤醒撑过重启',
    'cron/jobs.json 持久（2 条 probe 任务 state:completed 可查）；executions 落盘；12:06 实测 gateway（PID 21660，10-18 起）ticker heartbeat "3s ago"——重启后调度恢复；10-17 cron runs 全史可读',
    'type cron/jobs.json; hermes cron status; hermes cron runs <id>',
    '10-17 partial 升 pass：磁盘持久 + 跨重启 ticker 活着双证'))
rows.append(row('peer-message', 'L0', 'hermes/L0/cli', 'partial',
    '跨机 Hermes↔Hermes DM',
    'hermes peer add/dm/run/status/stop：dm 送进远端 agent canonical Bot Chat 并打印回复（对端须开 api_server）；本机无注册 peer、send --list 无平台——端到端未跑',
    'hermes peer --help; hermes send --list',
    '机制声明级；同机多 profile 可借 peer dm localhost 理论可测，留待'))
rows.append(row('handoff', 'L0', 'hermes/L0/cli', 'partial',
    '/handoff 会话交给消息平台',
    'commands.py:72 CommandDef("handoff","Hand off this session to a messaging platform","Session")；sessions.handoff_state/handoff_platform/handoff_error 三列；CLI 退出后 gateway 持有生命周期（cli.py #88234）',
    'grep handoff hermes_cli/commands.py; sqlite3 .schema sessions',
    '原语+落库在；本机无已配置平台，行为级未跑'))
rows.append(row('discover-sessions', 'L0', 'hermes/L0/cli', 'pass',
    '列出全部会话含子会话',
    'hermes sessions list 显示 acp/cli/cron/gateway 各 source（Title/Preview/LastActive/ID）；state.db 75 会话含 2 条 source=subagent 子代理行（parent_session_id 指向父）',
    'hermes sessions list; sqlite3 sessions 表',
    'CLI 原生命令即可；ACP 面 listSessions({}) 10-17 已证'))
rows.append(row('spawn-subagent', 'L0', 'hermes/L0/cli', 'partial',
    'delegate_task 子代理行为与落盘',
    'sessions 表 source=subagent 行（parent_session_id 指父）；async_delegations deleg_09378432 完整周期：dispatched→completed→delivered，result_json 含 3 子代理各自 summary/tool_trace/tokens/model；hermes-acp 工具集 30 工具含 delegate_task',
    "sqlite3 'SELECT id,parent_session_id,source FROM sessions WHERE parent_session_id IS NOT NULL'",
    '判据"子会话可见+结果回父"历史数据已证；本轮未新发委派（省额度），10-17 L0 wake-bg 行的 503 是渠道问题非机制问题'))
rows.append(row('act-deliver', 'L0', 'hermes/L0/cli', 'pass',
    '结构化交付',
    'delegate_tool.py:334 _validate_child_output_schema 按 schema 验子代理产出（status/exit_reason/truncated）；async_delegations.result_json 结构化；协作中枢 deliver 交回（本任务即经此机制）',
    'grep _validate_child_output_schema tools/delegate_tool.py; agent_gateway deliver',
    'schema 验证、委派 JSON、派活单交回三层'))
rows.append(row('act-request', 'L0', 'hermes/L0/cli', 'pass',
    '中途请求资源/审批/提问',
    'requestPermission 实测同轮应答（本表 permission 行）；clarify 工具注册于 toolsets（clarify: 1 tool）——CLI TUI 可用、ACP 断（见 ask-user 行）；hermes approvals suggest 挖审批历史成白名单',
    "acp_probe2.py perm; toolsets 枚举 clarify; hermes approvals --help",
    '审批链路原生通；提问仅 TUI 面'))
rows.append(row('act-yield', 'L0', 'hermes/L0/cli', 'partial',
    '让出并写明在等什么',
    '三件拼：/handoff（→平台，handoff_state 落库）、terminal(background=true) 先返 session_id 让出执行权+notify=true 到点回推、cron 定时让出。无统一让出原语与 waiting_for 字段',
    'terminal_tool.py:164-166; sessions.handoff_state 列; cron --deliver',
    '语义由工具组合承载；判据"中心读得到在等什么"靠 handoff_state+lease 近似'))
rows.append(row('act-report', 'L0', 'hermes/L0/cli', 'pass',
    '轮内不中断上报',
    'kanban comment/heartbeat 写共享板；session/update 事件流实时外发（10-17 observe-live 8 类通知）；cron incidents 落账',
    'hermes kanban --help（comment/heartbeat/incidents）',
    '上报=写任务板/心跳/事件流，均在轮内可做'))
rows.append(row('wait-visible', 'L0', 'hermes/L0/cli', 'partial',
    '外部读在等什么',
    'session_turn_leases：holder=pid:turn:platform + acquired/expires（谁在跑+何时到期）；sessions.last_activity_description（"receiving stream response"）+ ended_at；handoff_state。无声明式 waiting_for',
    "sqlite3 'SELECT holder,expires_at FROM session_turn_leases'; last_activity_* 列",
    '组合判据可用；非一等公民字段'))
rows.append(row('wake-bg', 'L0', 'hermes/L0/cli', 'pass',
    '后台任务完成唤醒',
    '工具契约 "notify=true fires exactly one notification when the process exits"；实测 770def57：background 起 ping -n 45 → poll → exited 后同轮收尾 SKATE-88。10-17 oneshot fail 是无宿主场景，交互/ACP 宿主下成立',
    'acp_probe3.py redirect 会话 messages 落盘（Background started → poll running → exited）',
    '单次退出通知=不靠轮询；poll 是可选确认不是唤醒手段'))
rows.append(row('wake-msg', 'L0', 'hermes/L0/cli', 'partial',
    '外部消息唤醒待命会话',
    'gateway 常驻（PID 21660 running）收平台消息注入 Bot Chat；peer dm 跨机注入；cron --deliver bot-chat 本地注入。本机平台未配置（send --list 空），端到端未跑',
    'hermes status（Gateway ✓）; hermes peer --help; hermes send --list',
    '与 10-17 partial 同判：入口在、无对端'))
rows.append(row('goal', 'L0', 'hermes/L0/cli', 'partial',
    '目标与预算推进',
    '无原生 goal 原语；组合：--max-turns N / --run-budget S（80% 一次性收尾提示+provider 超时截断，"one hung call can\'t consume the run"）、delegate_task max_iterations、kanban swarm（workers→verifier→synthesizer 自动图）',
    'hermes chat --help; hermes kanban swarm --help',
    '预算硬停有；目标达成判定无（预算到≠目标成）'))
rows.append(row('handover-human', 'L0', 'hermes/L0/cli', 'partial',
    '人在原生界面接手会话',
    'hermes --tui/--cli --resume <ID>：人在终端原 UI 继续同一会话（跨入口恢复 10-17 已证：CLI 续 acp 开的会话）；无桌面 app，Dashboard :9119 是只读网页',
    'hermes --help（--tui --resume）; hosts/hermes.md',
    '接手入口=CLI/TUI；人正用时并发写受 lease 约8分钟约束'))
rows.append(row('notify-user', 'L0', 'hermes/L0/cli', 'partial',
    '推送到人可见处',
    'hermes send --to <platform>（含 MEDIA: 附件）出站管道；cron --deliver 可选推送；Dashboard :9119 在线。本机无平台配置（--list 空）',
    'hermes send --help/--list; netstat :9119',
    '管道在无目标；artifact 发布同借 send MEDIA:/Dashboard'))
rows.append(row('artifact', 'L0', 'hermes/L0/cli', 'partial',
    '产出发布',
    'Dashboard 插件体系 plugins/*/dashboard（HTTP 服务 :9119 kanban 页激活）；send MEDIA:<path> 附件；产物落会话 cwd 文件',
    'netstat :9119; hermes send --help MEDIA:',
    '"人能打开"=本机网页/文件；无公网发布'))
rows.append(row('mount-tools', 'L0', 'hermes/L0/cli', 'pass',
    '挂工具与 MCP',
    'chat -t TOOLSETS（实测枚举 59 个 toolset：terminal/file/browser/delegation/kanban/clarify/memory…）+ -s skills 预载；config.yaml mcp_servers → ACP 会话 mcpServers 参数 → mcp-<name> toolset；--safe-mode 全关对照；TUI /reload-mcp、/reload-skills 运行中重载',
    'probe_toolsets.py 枚举; hermes chat --help (-t/-s/--safe-mode)',
    '新建时挂载全通；运行中重载在 TUI 斜杠层'))
rows.append(row('instructions', 'L0', 'hermes/L0/cli', 'pass',
    '角色说明设定',
    '--ignore-rules 跳过 AGENTS.md/SOUL.md/.cursorrules/memory/预载 skills 注入；--ignore-user-config 隔离用户配置；config agent.personalities/system_prompt 设角色（本机 ENI profile 即此法）',
    'hermes chat --help（--ignore-rules/--ignore-user-config）',
    '新建时设定原生；建后不可改与性质边界一致'))
rows.append(row('output-contract', 'L0', 'hermes/L0/cli', 'partial',
    '产出格式约定',
    'delegate_task output_schema → _validate_child_output_schema 验证（status/exit_reason/truncated 枚举+schema）；主会话轮次无格式守卫',
    'grep -n _validate_child_output_schema tools/delegate_tool.py',
    '子代理层有契约；一般轮次无拦截'))
rows.append(row('channel-lease', 'L0', 'hermes/L0/cli', 'partial',
    '渠道租约',
    'delegate_tool.py:312 _lease_child_credential(child) → (child_pool, leased_cred_id)：凭证池租 key 给子代理+_start_heartbeat 防超时；hermes auth 管理池',
    'grep _lease_child_credential; hermes auth --help',
    '委派层租约（池+心跳+释放）在；一般调用无排队限流'))
rows.append(row('guard', 'L0', 'hermes/L0/cli', 'partial',
    '会话守卫',
    'approvals 三层：hardline blocklist（rm -rf / → hardline-deny exit 3 不可绕）、command_allowlist（suggest 从历史挖）、--yolo/--safe-mode 两极；config hooks shell 钩子（hermes hooks 管理，约定时机自动执行）+ --accept-hooks',
    "hermes approvals test 'rm -rf /'; hermes hooks --help",
    '10-17 L0 guard=fail（oneshot 无门）升 partial：交互/gateway/ACP 宿主下守卫链路活'))
rows.append(row('permission-scope', 'L0', 'hermes/L0/cli', 'partial',
    '按目录分级权限',
    'sessions.cwd 每会话隔离；ACP edit 审批按相对路径呈现（Approve edit: perm_native_l1a.txt）；危险命令全局 hardline。无任意目录树白名单',
    'acp perm 实测; hermes approvals --help',
    '粒度=会话 cwd+工具类+命令黑白名单；非目录树级'))
rows.append(row('open-idle', 'L0', 'hermes/L0/cli', 'partial',
    '只建会话不跑第一轮',
    'ACP session/new 建会话零轮次（slash 场景 new 后 /context 显示 Conversation is empty——存在、有编号、无回复）；CLI 面 chat -q 必跑一轮无"仅创建"参数',
    'acp_probe2.py slash（new 后 /context empty）',
    'ACP 面天然 new/prompt 分离；CLI 面不支持'))

with open(BB, 'a', encoding='utf-8') as f:
    for r in rows:
        f.write(json.dumps(r, ensure_ascii=False) + '\n')
print(f'appended {len(rows)} rows at {now}')
