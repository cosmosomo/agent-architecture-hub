# WorkBuddy 原生面续查（native-workbuddy-20261019）

- **派活单**：dsp_062326_pb8t → dsp_063907_wq4j → dsp_100827_xrif → dsp_105448_0wlq（同一任务续派）；**执行者**：WorkBuddy 本尊（goal-mvevbr-wb，GLM-5.3）
- **被测版本**：codebuddy CLI **2.168.2**（比档案卡 2.160.0 新，含 --swarm/--remote-control/--fork-session/--bg）
- **方法**：上午轮额度内跑了 CLI 行为轮（open/resume/fork/model/mode/terminal）；撞智谱 BYOK 5h 上限（429：18:08:18 重置）后转**零额度探测**：--serve 自起 HTTP 面实测、Web UI bundle 静态分析（RPC 方法/命令清单/面板清单/i18n 键）、SQLite 只读对账、既有落盘文件取证
- **黑板**：本轮追加 **40 行**（by=workbuddy，全部经 agent_gateway bb add，note 带派活单号），加上其他座席 10-19 的 4 行，family=workbuddy 的 10-19 行共 44

## 一、总账

| 口径 | 之前 | 现在 | 说明 |
|---|---|---|---|
| workbuddy 原生接口格（api 列） | 38 有记录（21 pass/12 unverified/4 fail/1 partial） | **63 有记录（30 pass/12 partial/18 unverified/3 fail）** | 本轮 +25 格翻面，null 从 89 降到 69 |
| 新增 pass 格 | — | +9（terminal/observe-steps/delete/discover-sessions(ui)/ui-pin/workspace-files/notify-user/artifact/fork-slash 等） | |
| 新增 partial 格 | — | +11（steer/rewind/quota/label/content-search/memory-mode/task-board/human-steer/goal 等） | |
| 结构证据格（unverified） | — | +6（ui-sidebar/browser/scheduler/queue/usage/credit 等） | UI 结构非行为实测 |

## 二、行为实测结论（有原始输出的）

1. **CLI 生命周期全通**：open/resume/fork（--fork-session 冷分叉=整文件复制+新 id，源文件保留）/model-new/model-switch（会话文件里逐轮 model 字段变真变）/mode-switch/terminal（Bash 工具 function_call+result 落盘）/observe-steps（一轮含 message/reasoning/function_call/result 全步骤）
2. **--serve 是被漏掉的原生编程入口**：自起实例（18907，--auth none）后 `/api/v1/*` 可编程操作 sessions 列表、**DELETE 删会话（204+文件真删）**、**pins 置顶读写**、settings、keybindings、fs/search 文件搜索、notify/native 系统通知（{ok:true}）、channels、agent-home；需 `x-codebuddy-request` 头
3. **后台任务**：--bg --name --exec 起后台 shell 任务，输出落 ~/.workbuddy/logs/exec-*.log；短命任务退出后 ps/logs 不再收留（kill 报 Session not found）
4. **两套会话存储分家（重要）**：CLI 会话只在 ~/.workbuddy/projects/<dir>/<sid>.jsonl；桌面端会话才进 workbuddy.db（143 行）。发现 CLI 会话要扫 projects 目录或起 serve 查 /api/v1/sessions
5. **额度面**：BYOK 429 直接给上限与重置点（"5 小时上限，18:08:18 重置"）；db session_usage.credit_json 逐笔按模型记 credits；帐户级余额查询入口未找到（partial）
6. **定时自动化真实在跑**：automations 表 1 条（每小时 :35，豆包车道）+ automation_runs **121 行全 ACCEPTED**；Web UI 有 scheduled 管理面板（174 个 i18n 键）

## 三、Web UI / RPC 面结构发现（推翻两个旧判断）

- **steer 旧判 fail 被推翻**：Web UI 有完整插话排队体系——queue.* 键（steerHeader 本轮插话/holdHeader 排队/sendNow/remove）+ RPC 方法 session/steer|enqueue_followup|get_followup_queue|remove_followup|send_followup_now。人中途插话在 Web/桌面会话是一等交互（10-17 fail 仅适用无头 -p）
- **rewind 存在**：_codebuddy.ai/checkpoint 扩展方法（checkpointUpdated/reverted 事件）+ UI revertToCheckpoint(checkpointId, target∈{Conversation,Code,CodeAndConversation})；会话文件里 file-history-snapshot 每轮落盘佐证
- **RPC 方法面全清单**（use-i18n chunk）：session/new|load|prompt|cancel|set_model|set_mode|set_config_option|request_permission|steer + 5 个 followup 队列方法 + _codebuddy.ai/* 扩展 40+（checkpoint/question/sideQuestion/session.cancelBackgroundTask/workflow.*/mods.*）
- **斜杠命令 42 条**（command.*.description）：/branch /fork /fork-bg（分叉三入口）/btw（旁路会话）/goal /task-manager（团队任务板）/remote-control /workflows /insights /loop 等
- **面板清单 20 个**：chat tasks plugins mods terminal canvas canvas-pane remote-control settings docs editor editor-page changes metrics workers logs keybindings stats traces app
- **消息通道结构**：team.*（waitingForTeammates/switchMember/recentCommunication）+ remoteControl.*（addWeChat/addWeCom/QR）+ centrifugo 长连接（本机 disconnected）；微信/企微机器人接入面在

## 四、给负责人的三件事

1. **接线优先走 serve 面**：会话删除/置顶/通知/文件搜索这些原先判"CLI 无入口"的格，起一个常驻 serve 就全有了；比扫 jsonl 和改 db 干净。注意 x-codebuddy-request 头和 auth 模式（我们网关可代管 token）
2. **ask-user 的 workbuddy 答复路径**：tables 里 workbuddy ask-user 还挂 todo——本轮证据（_codebuddy.ai/question + sideQuestion 方法 + tool.structuredInput 按钮文案）显示桌面/serve 会话有提问交互，无头 -p 仍无（10-19 ask-user-acp 已证 ACP 面做不到）；建议后端接 serve 面的 question 通知流
3. **待额度窗口补的**：session/steer|enqueue_followup 行为轮、checkpoint 回退行为轮、/goal 行为轮、browser-preview 实跑、团队任务板 /task-manager 实跑——结构证据已落黑板，行为验证各需 1-2 轮便宜模型

## 五、规矩自查

- 黑板 40 行全走 agent_gateway bb add（铁律 1）；未动 trace/、m/、hub/ 代码；probe 会话全在 hub-workspaces/probe-wb-native-1019 与 probe- 前缀；自起 serve（18907）已 kill，端口已关；未碰用户桌面端与在用会话；未提交未推送
- tables 自查通过（"四张表和代码全部对上"）；build_coverage 已重出

## 六、产物

- 黑板：+40 行（2026-10-19，by=workbuddy）
- 原始证据：hub-workspaces/probe-wb-native-1019/（serve-probe*.log、index.js、i18n.js、use-acp.js、panel_ctx.js、rows_batch*.json）
- 矩阵重出：CAPABILITY_MAP.md（workbuddy 原生接口 27%→约 50% 有据）
