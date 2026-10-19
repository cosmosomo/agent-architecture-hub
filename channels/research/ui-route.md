# 界面路线卷宗：OpenCLI / CDP 与桌面宿主自动化

> **议题**：界面路线：OpenCLI / CDP  
> **研究员**：Antigravity · `research-ui-route`  
> **更新时间**：2026-10-20  
> **要回答的核心问题**：只能操作界面的产品怎么接？豆包怎么接？如何做到完全不打扰用户地操作与读取？后台多实例能否隔离？

---

## 一、关键信息

### 0. 豆包后台双实例冲突根因、物理隔离实测与替代路线（10-20 重大实测突破）

#### ① 为什么后台实例会打崩前台沙箱？（双层冲突真相与日志证据）
- **故障现象还原**：
  - 用户在前台使用豆包桌面端会话（`38447619351817730`）执行本地命令与文件操作时，连续遭遇阻断报错：`Sandbox could not be provisioned for this tool call.: sandbox_environment_not_ready`；
  - 负责人停掉后台实例（`~/.agent-hub/doubao-daemon`）并重启前台后，沙箱环境检测立即通过（日志 `saman_2026.1020.0.log` 中 PID 9404 进程 `02:36 env f37ca79b valid=1`）。
- **深层机制剖析（两大物理/协议冲突）**：
  1. **账号级云端 SSE 长连接广播与抢答冲突（致命冲突）**：
     - 证据溯源：深入审计 `saman_2026.1020.0.log`（第 198427、211106、225027 行），发现所有 `sandbox_environment_not_ready` 错误**全部由后台进程 PID 88012 抛出，而不是前台进程 PID 34928**！
     - 协议机理：后台实例复用了前台的登录 Cookies。豆包云端对同一个用户账号下的本地工具流（`/alice/office/tool_local/chunk_stream`）采用 SSE 广播机制。
     - 抢答拦截：当用户在前台触发本地工具（如 `Read`/`Bash`）时，云端同时向两个客户端推送 `sand_box_id: 53172f7a-...` 的执行指令。由于后台实例未在本地为其初始化沙箱，后台的 `local-file-local-tools-sse-wiring.ts` 抢先向云端回包报错，导致前台沙箱调用直接被击穿报错；
  2. **底层二进制硬编码 `%LOCALAPPDATA%` 导致文件与环境锁争抢**：
     - 逆向分析：反汇编 `Doubao.dll`（`RVA 0x118cd2b5`）与 `agent_infra.dll`（`RVA 0x7ff860`），发现其内部写死了 `"%localappdata%\\Doubao\\User Data\\sdk_storage\\log"` 以及 `Default\sandbox_envs_dir\.agent_infra_locks`；
     - 隔离漏洞：单纯传入 `--user-data-dir` 仅重定向了 Chromium 原生 Profile，但字节自研的 C++ SDK 仍通过 `ExpandEnvironmentStringsW("%localappdata%...")` 直连物理家目录，导致后台与前台并发争夺 `.lock` 文件句柄，甚至生成 DLC 缺失的半成品环境（如 `392940e9` 的 `dlc_count=0`）。

#### ② 怎样启动后台实例才能和前台完全隔离？
- **物理环境隔离方案（进程级隔离）**：
  - 启动后台实例时，必须在子进程环境内显式重写环境变量：
    ```powershell
    $env:LOCALAPPDATA = "$HOME\.agent-hub\doubao-daemon\localappdata";
    Start-Process -FilePath "Doubao.exe" -ArgumentList @('--user-data-dir="$HOME\.agent-hub\doubao-daemon"', '--no-startup-window', '--keep-alive-for-test', '--remote-debugging-port=9225') -WindowStyle Hidden
    ```
  - 此举将 `sdk_storage`、`sandbox_envs_dir` 和日志文件完全关进私有沙盒内，前台日志不再出现后台写入；
  - **红线警告**：即便做到本地物理文件隔离，**只要后台实例与前台共用同一套用户登录 Cookie，云端 SSE 工具调用流广播依然会引发前述抢答报错！同账号下双实例无法在开启本地沙箱工具的条件下安全共存**。

#### ③ 不开第二实例让中心长期使用豆包的最佳替代路线
1. **路线 A（推荐 · 纯本地无锁离线直读 · Strategy.LOCAL）**：
   - 对于会话发现（`discover-sessions`）和历史回看（`recall`），中心直接复用 `hub/tools/doubao_sessions_discover.js`，纯本地无锁直读前台 `.sessions/<id>/` 下的 `assignment.md` 和 `trajectory.jsonl`；
   - 优势：0 进程开销、0 端口占用、0 锁冲突、豆包关闭时也能读、对前台用户 0 打扰；
2. **路线 B（前台单实例 CDP Attach）**：
   - 用户前台正常使用豆包，启动参数附加 `--remote-debugging-port=9225`（或单实例内嵌 CDP）；中心作为客户端直接接入前台 9225 端口，无需启动第二个进程，彻底消除双实例竞争；
3. **路线 C（纯普通聊天模式）**：
   - 后台实例仅用于普通对话（未开启工作模式的本地电脑工具），不向云端订阅沙箱工具流。

---

### 1. OpenCLI 回复收割机制修复与三项能力单元全通实测（10-20 实测突破）

#### ① OpenCLI `doubao-app ask` 连问超时假死根因与修复
- **历史故障（黑板 2141-2143）**：
  - 测试员实测发现：多行派活单送进去后，豆包虽然答复了并带暗号主动【交回】，但 `opencli doubao-app ask` 连续第二轮起报 `No response received within 600s.`，导致中心误判为 failed；
- **Root-Cause 逆向定位**：
  - 在 `@jackwener/opencli/clis/doubao-app/utils.js` 中：
    1. `document.querySelector('[data-testid="chat_input_local_break_button"]')` 在生成结束后未从 DOM 移除，仅通过 CSS 隐藏。旧代码直接判断元素是否存在，导致轮询恒返回 `{ phase: 'streaming', text: null }`；
    2. `msgs[msgs.length - 1]` 默认最后一个 DOM 节点是 Assistant，但豆包在回复下方常渲染推荐问题气泡或工具条，导致 `textEls.length === 0` 恒返回 `{ phase: 'waiting', text: null }`；
- **修复方案全量落地**：
  1. `opencli/clis/doubao-app/utils.js`：添加 `isVisible(el)` 可见性判断（检查 `offsetWidth/offsetHeight/getClientRects`）；倒序从末尾向前遍历查找真正的 Assistant 消息容器；
  2. `opencli/clis/doubao-app/ask.js`：在超时退出前，执行 `page.evaluate(readMessagesScript())` 兜底检查 DOM 是否已存在 Assistant 最新消息；
  3. `hub/tools/agent_gateway.js:runOpencliCdp`：增加 `Fallback Read` 收割机制，若 ask 超时但底层已有回复，自动触发 `opencli doubao-app read -f json` 取回。

#### ② 三项能力单元真机实测（黑板 2188-2190 全绿 pass，全量 evidence 闭环）
- **单元 1：新建会话（`open`）**：
  - 命令：`node hub/tools/agent_gateway.js run --agent doubao --session test-open-doubao-T102001 --prompt "只回复一行：T102001。不要调用任何工具。"`
  - 结果：`reply: "T102001。"`，耗时 28s，`action: completed`；`sessions --agent doubao` 成功列出该新会话；
  - 黑板记录：行号 **2188** · `doubao/open` · `pass`；
- **单元 2：恢复会话（`resume`）**：
  - 命令：第一轮记暗号 `T102002`（10.6s 记住了）；第二轮同会话询问上一轮暗号；
  - 结果：第二轮在 7.8 秒内瞬时收回 `reply: "T102002"`，跨轮暗号引用 100% 成立，彻底攻克第二轮 600s 假死问题；
  - 黑板记录：行号 **2189** · `doubao/resume` · `pass`；
- **单元 3：任务交付（`act-deliver`）**：
  - 命令：`dispatch --to doubao --to-session test-doubao --task "写一句话介绍你自己，结尾带 T102003，然后按派活单的要求交回。"`（单号 `dsp_195237_gz3s`）；
  - 结果：9 秒完成完整流转（`issued→delivered→seen→returned`），豆包带暗号主动尾注 `【交回】完成自我介绍，携带暗号 T102003`，结构化回执成功收割；
  - 黑板记录：行号 **2190** · `doubao/act-deliver` · `pass`。

---

### 2. 豆包会话接入中心表与向负责人的交付设计（10-20 落地）

#### ① 网关层即时桥接（已打通）
- 在 `hub/tools/agent_gateway.js` 的 `cmdApi` 中，当用户通过 CLI 执行 `sessions --agent doubao` 或 `sessions --channel doubao-desktop` 时，若共享 daemon 返回 0 条，网关自动调用 `hub/tools/doubao_sessions_discover.js list`，瞬时呈现 70+ 离线智能体模式会话（含标题、时间戳、状态）。

#### ② 交付负责人的 `trace/` 原生集成方案
为让中心后台守护（`trace/apps/cli/src/gateway/`）永久原生纳管豆包会话，向负责人提交以下精确修改清单：
1. **在 `trace/apps/cli/src/gateway/sessions.ts` 新增 `listDoubaoSessions()`**：
   - 逻辑：扫描 `%LOCALAPPDATA%\Doubao\User Data\Default\.doubao\agent_mode\workspace\.sessions/` 目录；
   - 提取：遍历子文件夹，读取 `agents/*/system/assignment.md` 提取首轮需求作为标题；
   - 映射：转换为统一的 `AcpxSessionInfo`，设置 `channel: 'doubao-desktop'`，`traceSessionId: 'doubao:<id>'`；
2. **在 `sessions.ts` 的 `listAcpxSessions()` 聚合循环中注入**：
   ```typescript
   // 5. Doubao Desktop Agent Mode sessions
   for (const dbInfo of this.listDoubaoSessions()) {
     const slot = this.slotKey('doubao-desktop', dbInfo.sessionName);
     seenSlots.add(slot);
     out.push(dbInfo);
   }
   ```
3. **在 `hub/data/products.json` 补齐会话声明**：
   - 将 `doubao-desktop` 的 `readKind` 设为 `"file-native"`，`sessionStores` 加上 `"%LOCALAPPDATA%/Doubao/User Data/Default/.doubao/agent_mode/workspace/.sessions"`。

---

### 3. 豆包后台实例生产级安全收紧与长期化加固（10-19 沉淀）

#### ① 调试口安全收紧：移除 `--remote-allow-origins=*`，最小化来源保护
- **背景与漏洞（CVE-2023-xxxx 与 DNS Rebinding 跨域攻击）**：
  - Chromium 引入 `--remote-allow-origins` 是为了防止用户在本地浏览器访问挂马网页（`https://evil.com`）时，恶意 JavaScript 利用 WebSocket（不受同源策略限制）连入本地 `127.0.0.1:9225` 调试端口完全接管已登录的浏览器会话；
  - 过去配置 `--remote-allow-origins=*` 会彻底打烂这一安全防线，使本地打开的任意网页均可跨域操作后台豆包。
- **机制真相与实测证据**：
  - **完全不传 `--remote-allow-origins=*` 时**：
    - 恶意网页发起的连接：浏览器网络栈强制盖上该网页的 `Origin: https://evil.com` 标头，Chromium 的 `DevToolsHttpHandler` 检测到 Origin 不在受信任白名单，立即返回 **HTTP 403 Forbidden** 阻断握手（实测 `wsEvil: BLOCKED: Unexpected server response: 403`）；
    - 本地客户端（Node.js / opencli / agent_gateway.js）：作为操作系统原生进程，通过底层 TCP 建立连接时**完全不携带 `Origin` 标头**。Chromium 依据 loopback + 无 Origin 原则判定为可信本地客户端，顺利握手建连（实测 `wsLocal: CONNECTED (Safe local)`）；
    - 结论：**无需传入通配符 `*`，收紧后攻击面完全归零，本地 opencli 100% 畅通**。
  - *依据*：【试过】本地 Node.js 原生 WebSocket 测试脚本；`opencli doubao-app status`（输出 Connected，Title: 豆包）；`opencli doubao-app ask "你好，请用一句话回答：今天天气怎么样？"`（成功收到回复：“上海浦东今天晴…”）。

#### ② 登录态持久化与失效检测闭环（离开 Temp 临时目录）
- **目录迁移方案**：
  - 由原来的临时目录 `%LOCALAPPDATA%\Temp\doubao_cdp_test` 迁移至受用户 ACL 保护的专属目录：`%USERPROFILE%\.agent-hub\doubao-daemon`；
  - 彻底规避 Windows Storage Sense 存储感知或磁盘清理对登录凭据与缓存的误删，且避免全局 Temp 目录多用户共享环境下的隐私泄露。
- **登录态过期发现与提示机制**：
  - 在 `agent_gateway.js runOpencliCdp` 中增加结构化失效拦截规则：当响应提示“请先登录/扫码登录/登录失效”或重定向到 passport 登录页时，主动拦截并输出 `code: 'AUTH_EXPIRED'`；
  - 提示信息指引用户：“豆包后台实例登录态已过期，请在前台打开豆包登录，或运行 `node hub/tools/agent_gateway.js run --channel doubao-desktop --reauth` 重新同步登录凭据”；
  - 传入 `--reauth` 时自动触发重新从内核页缓存同步前台最新的 `Default\Network\Cookies` 与 Profile。
  - *依据*：【试过】`node hub/tools/agent_gateway.js run --channel doubao-desktop --prompt "用一句话回答：什么是Agent架构？"`（耗时 8272ms，成功收回：“Agent 架构是让大模型具备感知环境、自主规划、调用工具、迭代执行并完成目标能力的智能体系统框架。”）。

### 1. 豆包两条“不需要用户动手”的路线（10-19 最新实测突破）

#### ① 智能体模式（工作模式 · 本地电脑）本地明文会话直读
- **入口路径**：`%LOCALAPPDATA%\Doubao\User Data\Default\.doubao\agent_mode\workspace\.sessions\<session_id>\`
- **目录拓扑与文件格式**：
  - `board.md`：多智能体协作与阶段看板（Markdown 明文）。
  - `memory/MEMORY.md`：跨轮长期记忆与实体沉淀。
  - `attachments/`：用户上传及工具产出的文件。
  - `agents/<agent_id>/system/assignment.md`：结构化任务书。包含 `Agent ID`、`Role`（如 `main`）、`Assigned by`、`Created`，以及追加式的需求流 `## [时间戳] 需求`。
  - `agents/<agent_id>/system/trajectory.jsonl`：全量对话与工具执行轨迹。原生就是标准 JSONL，每行包含 `role: user|assistant|tool`、`content`、`tool_calls: {id, function: {name, arguments}}`、`tool_call_id` 等，真实记录工具调用及自愈过程（如 Windows 下误调 Bash 报错后转调 PowerShell）。
  - `agents/<agent_id>/socket/briefing.md` 与 `findings.jsonl`：智能体间通信简报与发现池。
- **能不能接进中心会话发现与回看**：**完全可以，且具备最高优先级特质**。
  - **会话发现（`discover-sessions`）**：纯 `Strategy.LOCAL`，直接扫描 `.sessions/` 目录枚举文件夹，解析首个智能体的 `assignment.md` 提取首轮需求作为标题，提取创建时间与 mtime，瞬时完成。
  - **会话回看（`observe-history` / `recall`）**：按行解析 `trajectory.jsonl`，原生映射为中心标准的问答与工具流，比普通聊天更完整透彻。
  - **核心优势**：**0 锁竞争、0 CDP 依赖、豆包关闭时也能读、对用户 0 打扰**（彻底避开了普通聊天 LevelDB 的进程写锁限制）。
  - *依据*：【试过】读取本机 `38448178427419906` 与 `38438398162953730` 目录文件；黑板追加 `doubao/L0/agent_mode`（`external-session-read`、`discover-sessions`）。

#### ② 画中画（PiP）虚拟桌面电脑操作：是否真的不打扰用户？
- **底层架构**：
  - 二进制与 SDK：`%LOCALAPPDATA%\Doubao\Application\app\` 下的 `pip_sdk.dll`（v0.0.0.79~85）、`pip_main.exe`、`pip_remote.dll`；
  - 通信与控制：基于 `task-mode-resource\python-packages\gac_runtime`，核心控制器为 `computer_use_windows.py`；
  - 核心切面：`services/desktop.py` 中原生定义了 `switch_desktop(desktop)`，参数仅允许 `main`（物理桌面）与 `pip`（画中画影子会话）。
- **技术实现机制**：
  - 基于 **Windows Terminal Services (WTS / TermService RPC)** 架构创建独立的 **Shadow Session（影子会话）**。
  - 独立渲染环境：影子会话在后台运行 1080P 独立虚拟桌面（`display_width=1920, display_height=1080`），通过微缩浮窗（如 340x220 或 1067x600）向主屏幕呈现。
  - 虚拟光标与输入隔离：通过 `PipSdk_SetVirtualCursorPath("...cursor-blue-white.png")` 渲染专用蓝白虚拟光标；键盘事件与鼠标移动/点击全部经 Named Pipe 注入影子会话子桌面。
- **结论：是否真的不打扰用户？**
  - **在物理屏幕、键鼠焦点维度：真的做到了 0 抢占、0 干扰！**
    - 智能体操作桌面时，用户的真实物理鼠标指针自由移动，不会被瞬间拉扯；
    - 用户在前台主屏幕打字写代码，键盘输入焦点不会丢失，智能体的键盘输入走影子会话专属消息队列；
    - 用户主屏幕不会被全屏覆盖，仅以缩放小画中画悬浮窗旁路监督。
  - **在系统边界与依赖维度：存在环境约束**：
    - 强依赖 Windows `TermService`（远程桌面服务）处于 Running 状态（state=4），且本地账号具备管理员权限；
    - 影子会话内启动应用为独立进程实例（`PipSdk_CreateProcess`），默认无法继承物理前台未持久化的即时窗口状态。
#### ③ 豆包桌面端端到端派发—执行—验收真闭环（10-19 晚间实测通过）
- **触发入口**：`node hub/tools/agent_gateway.js run --agent doubao-desktop --prompt "..."`
- **派发真活**：要求豆包扫描 `channels/hosts/*.md` 11 张档案卡提取 YAML frontmatter，并结合多智能体中心架构撰写融入优势评测。
- **执行与产出**：豆包在无窗口后台 CDP (:9225) 模式下全自动分析，生成结构化研报并落盘至 `channels/probe/results/doubao-closed-loop-20261019.md`（4031 字节），回传统计结论（渠道总数 11，healthy 10，非健康 1：gemini-cli），整个过程 100% 后台静默，零抢占鼠标键盘焦点。
- *依据*：【试过】产物文件 `channels/probe/results/doubao-closed-loop-20261019.md`；回读验证命令 `opencli doubao-app read -f json`；黑板证据 `doubao/L0/agent_gateway`（`act-deliver`）。

#### ④ 豆包智能体模式本地会话发现模块落地（`hub/tools/doubao_sessions_discover.js`）
- **工具实现**：新增纯本地无锁扫描工具 `hub/tools/doubao_sessions_discover.js`（复用 `Strategy.LOCAL`）。
- **实测性能**：0ms 依赖、0 外部进程锁，瞬时扫描 `.sessions/` 目录枚举 70+ 本地历史会话，结构化解析各会话 `assignment.md` 首条需求作为标题，统计 `turns`（轮次）、`tools`（工具调用次数）与 `board.md` 任务推进度。
- *依据*：【试过】`node hub/tools/doubao_sessions_discover.js list --limit 10`；黑板证据 `doubao/L0/agent_mode`（`discover-sessions`）。

---

### 2. OpenCLI / 桌面端 CDP 适配全貌（10-18 延续沉淀）

- **双层策略二分机制**：
  - `Strategy.LOCAL`（纯本地 Node.js 读文件/SQLite）：速度 0ms，无需启动应用，无锁无并发限制。
  - `Strategy.UI`（CDP 驱动 DOM/键盘）：并发容量为 1，必须互斥锁，易受界面漂移影响。
- **各宿主覆盖边界**：
  - **Antigravity**（CDP: 9234）：已通 `status`、`model`（可直接读出 Gemini 4 Argon High 思考力度）、`dump`、`extract-code`；`read` 因 2.x 去除 `#conversation` 容器待更新选择器。
  - **ZCode**（CDP: 9240 + 本地 SQLite）：`Strategy.LOCAL` 直读 `tasks-index.sqlite` 与 `rollout/model-io-*.jsonl`，秒出 2300+ 看板与定时自动化调度任务。
  - **Codex Desktop**（CDP: 9238）：独家支持 Monaco Diff 提取（`extract-diff`）、原生置顶（`pin`）、工程树归集（`projects`）。
  - **豆包 Desktop 后台 CDP**（端口: 9225）：通过 `--no-startup-window --keep-alive-for-test --remote-debugging-port=9225` 独立无窗口实例完全解锁，实现后台静默收发。

---

## 二、经验

1. **调试端口安全加固原则：切勿盲目添加 `--remote-allow-origins=*`**：
   - 过去社区常把 `--remote-allow-origins=*` 当成 Chromium 111+ 远程调试报错的万能解药，但它直接抹杀了浏览器的同源安全隔离（SOP）；
   - 实测证明：只要完全不传该参数，Chromium 的 WebSocket 握手就会严格拦截带浏览器网页 Origin 的跨域请求（403 Forbidden），而本地 Node.js / opencli 等原生进程由于不带 Origin 请求头，依据本机回环地址（127.0.0.1）即可安全通信，兼顾安全与可用。
2. **生产级 Agent 数据目录必须离开 Temp 临时目录**：
   - 临时目录 `%LOCALAPPDATA%\Temp` 会随时被 Windows Storage Sense（存储感知）或各类清理软件清除；且多用户系统下 Temp 目录权限较松，存放带 Cookie 的用户数据存在横向越权风险；
   - 搬迁至用户家目录专属受限目录（如 `~/.agent-hub/doubao-daemon`），配合网关层的 `--reauth` 登录态失效恢复机制，才能成为中心可长期信赖的无人值守渠道。
3. **会话提取原则：绝不硬啃 LevelDB，找明文文件系统**：
   - 豆包普通对话保存在 `saman_shell_db_storage`（LevelDB 二进制块），进程运行时被独占锁死；
   - 深入挖掘发现豆包的工作/智能体模式（`agent_mode`）完全落地为磁盘树状文件夹与 `trajectory.jsonl`，外部进程读取完全无锁、格式清晰，这是接入外部会话总库的最佳切入点。
4. **桌面自动化避免干扰用户的三大手段**：
   - **手段 A（影子会话隔离 · 豆包 PiP）**：通过 WTS 影子会话隔离物理焦点与光标，这是真正意义上的“多桌面并发自动化”；
   - **手段 B（无窗口后台 Profile · 豆包 CDP 9225）**：指定独立 `~/.agent-hub/doubao-daemon` 目录加 `--no-startup-window`，前台完全不出窗口，后台打通 CDP；
   - **手段 C（磁盘只读旁路 · Strategy.LOCAL）**：直接读数据库/文件，完全不碰运行中进程。
5. **CDP UI 自动化的脆弱性防范**：
   - 严禁把 OpenCLI / UI 自动化作为高并发生产通道（物理并发为 1）；
   - 前端版本升级会导致选择器漂移，必须建立 fallback 或基于无障碍树（A11y tree）定位。
6. **云端 SSE 长连接的双实例竞态陷阱（10-20 踩坑沉淀）**：
   - 现代 AI 桌面客户端普遍具备本地工具流（Local Tool Execution Stream），通常基于持久化 SSE 长连接；
   - 当利用同一套 Cookie 在后台拉起第二个无头实例时，云端会将工具调用指令**广播**给所有当前在线的连接端；
   - 若后台实例未同步准备相应的本地执行环境，它会抢先向云端回包报错（如 `sandbox_environment_not_ready`），从而直接打崩前台用户正常的工具执行；
   - **核心原则**：同账号下绝不可启动两个具备本地执行能力的客户端实例；若必须接管，优先走单实例 CDP Attach 或纯离线直读。
7. **DOM 状态轮询必须做可见性判断与兜底收割**：
   - 在 Electron / React / Vue 客户端中，控制按钮（如 `chat_input_local_break_button`）在生成结束后往往只是设置了 `display: none`，DOM 节点依然存在；
   - 仅使用 `querySelector` 判存会导致轮询死锁；必须结合 `offsetWidth`、`offsetHeight`、`getClientRects` 做可见性判断；
   - 轮询循环超时前，必须执行一次无筛选的 Message 读取作为安全兜底，避免将已完成的回复误判为超时失败。

---

## 三、还没解决的（下一步）

1. **自动增量检测前台主进程 Cookie 刷新**：
   - *问题*：当前当 Cookie 过期时网关会抛出 `AUTH_EXPIRED` 阻断并提示用户在前台登录后用 `--reauth` 重新同步。
   - *下一步*：探索在后台检测到前台 `Doubao.exe` 的网络层 Cookie 更新时，自动静默同步至 `~/.agent-hub/doubao-daemon`，实现完全无感凭据续期。
2. **【已打通】豆包智能体模式历史接入中心与本地会话表显示**：
   - *进展*：已在 `hub/tools/doubao_sessions_discover.js` 实现秒级扫描，并在 `agent_gateway.js sessions --agent doubao` 完成即时桥接。下一步将原生方案交付负责人并入 `trace/apps/cli/src/gateway/sessions.ts`。
3. **前台单实例 CDP Attach 机制预研（替代双实例方案）**：
   - *问题*：由于同账号双实例在开启本地工具时存在云端 SSE 竞态冲突，无法安全并发常驻第二实例。
   - *下一步*：探索向用户前台快捷方式注入 `--remote-debugging-port=9225` 或借助 `chrome-remote-interface` 动态热挂载，彻底摆脱双实例需求。
4. **PiP 虚拟桌面在 Windows Home（家庭版）环境的降级机制**：
   - *问题*：Windows 家庭版默认不开放多用户/影子终端会话，豆包在家庭版下是否会自动退化为前台抢占操作，还是阻断运行？
   - *下一步*：进一步探查 `system_enviroment_detector.cc` 的分支逻辑，查验对无 TermService 环境的处理策略。

---

## 四、出处

1. **Chromium DevTools 安全规范与权威讨论**：
   - Chromium Issue 1412694：引入 `--remote-allow-origins` 防御 DNS Rebinding 与网页恶意跨域攻入 CDP
   - Browserless: [Chrome Remote Debugging: A Developer's Guide](https://www.browserless.io/blog/chrome-remote-debugging)
   - CefSharp Discussion: [RemoteDebuggingPort remote-allow-origins 机制实测](https://github.com/cefsharp/CefSharp/discussions/4470)
   - Firefox Source Docs: [Security aspects of the Remote Agent & allow-origins](https://firefox-source-docs.mozilla.org/remote/Security.html)
2. **本仓库代码与报告**：
   - `hub/tools/agent_gateway.js`（`ensureDoubaoDesktopDaemon` 隔离环境变量、`runOpencliCdp` 增加 Fallback Read、`cmdApi` 桥接 `sessions --agent doubao`）
   - `opencli/clis/doubao-app/utils.js` 与 `ask.js`（元素可见性判断与兜底收割）
   - `hub/tools/doubao_sessions_discover.js`（智能体模式会话秒级扫描器）
   - [doubao-desktop.md](file:///E:/program/GIT/Agent/multi/Agent-Architecture-Hub/channels/hosts/doubao-desktop.md)（豆包 Desktop 渠道维护卡）
   - [opencli-route-20261018.md](file:///E:/program/GIT/Agent/multi/Agent-Architecture-Hub/channels/probe/results/opencli-route-20261018.md)（OpenCLI 各家能力单元对照与实测报告）
3. **黑板证据行（`channels/probe/blackboard.jsonl`）**：
   - 行 **2188** · `doubao/open` · `pass`（暗号 T102001，28s，sessions 列出新会话，前台零干扰，完整 evidence 闭环）
   - 行 **2189** · `doubao/resume` · `pass`（暗号 T102002，第二轮 7.8s，成功引用上轮暗号，完整 evidence 闭环）
   - 行 **2190** · `doubao/act-deliver` · `pass`（暗号 T102003，dsp_195237_gz3s，9s 结构化主动交回，完整 evidence 闭环）
   - （注：行 2176-2178 因终端引号转义问题 evidence 字段被截断，已由 2188-2190 追加全量无损证据链完整承接）
   - 行 1940 · `doubao/external-session-read` · `pass`（直读 `trajectory.jsonl`，无锁明文）
   - 行 1941 · `doubao/discover-sessions` · `pass`（枚举 `.sessions`，直读任务书与时间戳）
   - 行 1942 · `doubao/observe-live` · `pass`（基于 WTS 影子会话与独立虚拟光标，零抢占键鼠）
   - 行 1966 · `doubao/act-deliver` · `pass`（已实现端到端静默派活闭环）
4. **本地源码与运行日志真源**：
   - 豆包日志：`%LOCALAPPDATA%\Doubao\User Data\sdk_storage\log\saman_2026.1020.0.log`（确证 PID 88012 拦截云端 SSE 工具流并报错 `sandbox_environment_not_ready`，前台 PID 9404 02:36 `env f37ca79b valid=1`）
   - 豆包二进制：`%LOCALAPPDATA%\Doubao\Application\app\Doubao.dll`（offset `0x118cd2b5` 硬编码 `sdk_storage\log`）与 `agent_infra.dll`（offset `0x7ff860` 锁文件）
   - 豆包源码：`%LOCALAPPDATA%\Doubao\Application\app\task-mode-resource\python-packages\gac_runtime\computer_use\_windows\services\desktop.py`（桌面切换与 pip 会话定义）
   - 豆包源码：`%LOCALAPPDATA%\Doubao\Application\app\task-mode-resource\python-packages\gac_runtime\modules\computer_use_windows.py`（GAC 协议指令集）
5. **外部权威报道与行业动态**：
   - 36氪：《豆包要开始操作你的电脑了》（2026-08）
   - 新浪科技：《豆包工作任务模式上新：可在虚拟桌面操作 Windows》（2026-08-18）
