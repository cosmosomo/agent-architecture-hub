# 界面路线卷宗：OpenCLI / CDP 与桌面宿主自动化

> **议题**：界面路线：OpenCLI / CDP  
> **研究员**：Antigravity · `research-ui-route`  
> **更新时间**：2026-10-19  
> **要回答的核心问题**：只能操作界面的产品怎么接？豆包怎么接？如何做到完全不打扰用户地操作与读取？

---

## 一、关键信息

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

1. **会话提取原则：绝不硬啃 LevelDB，找明文文件系统**：
   - 豆包普通对话保存在 `saman_shell_db_storage`（LevelDB 二进制块），进程运行时被独占锁死；
   - 深入挖掘发现豆包的工作/智能体模式（`agent_mode`）完全落地为磁盘树状文件夹与 `trajectory.jsonl`，外部进程读取完全无锁、格式清晰，这是接入外部会话总库的最佳切入点。
2. **桌面自动化避免干扰用户的三大手段**：
   - **手段 A（影子会话隔离 · 豆包 PiP）**：通过 WTS 影子会话隔离物理焦点与光标，这是真正意义上的“多桌面并发自动化”；
   - **手段 B（无窗口后台 Profile · 豆包 CDP 9225）**：指定独立 `--user-data-dir` 临时目录加 `--no-startup-window`，前台完全不出窗口，后台打通 CDP；
   - **手段 C（磁盘只读旁路 · Strategy.LOCAL）**：直接读数据库/文件，完全不碰运行中进程。
3. **CDP UI 自动化的脆弱性防范**：
   - 严禁把 OpenCLI / UI 自动化作为高并发生产通道（物理并发为 1）；
   - 前端版本升级会导致选择器漂移，必须建立 fallback 或基于无障碍树（A11y tree）定位。

---

## 三、还没解决的（下一步）

1. **【已解决】豆包智能体模式历史接入中心扫描脚本**：
   - *进展*：已在 `hub/tools/doubao_sessions_discover.js` 完成离散读取工具，输出兼容中心 `/api/sessions` 格式。下一步由负责人（Claude 会话）将该模块并入 `trace/apps/cli/src/gateway/` 的会话聚合路由。
2. **PiP 虚拟桌面在 Windows Home（家庭版）环境的降级机制**：
   - *问题*：Windows 家庭版默认不开放多用户/影子终端会话，豆包在家庭版下是否会自动退化为前台抢占操作，还是阻断运行？
   - *下一步*：进一步探查 `system_enviroment_detector.cc` 的分支逻辑，查验对无 TermService 环境的处理策略。
3. **跨桌面端 CDP 端口动态嗅探并入网关**：
   - *进展*：已开发 `hub/tools/cdp_probe.js` 成功识别 9225（Doubao）、9234（Antigravity）、9240（ZCode）。
   - *下一步*：将 `cdp_probe.js` 作为前置嗅探中间件注入 `agent_gateway.js targets`，动态感知宿主在线状态。

---

## 四、出处

1. **本仓库报告与档案**：
   - [opencli-route-20261018.md](file:///E:/program/GIT/Agent/multi/Agent-Architecture-Hub/channels/probe/results/opencli-route-20261018.md)（OpenCLI 各家能力单元对照与实测报告）
   - [doubao-desktop.md](file:///E:/program/GIT/Agent/multi/Agent-Architecture-Hub/channels/hosts/doubao-desktop.md)（豆包 Desktop 渠道档案与无头 CDP 突破记录）
2. **黑板证据行（`channels/probe/blackboard.jsonl`）**：
   - `doubao/L0/agent_mode` · `external-session-read`（直读 `trajectory.jsonl`，无锁明文）
   - `doubao/L0/agent_mode` · `discover-sessions`（枚举 `.sessions`，直读任务书与时间戳）
   - `doubao/L0/pip_sdk` · `observe-live`（基于 WTS 影子会话与独立虚拟光标，零抢占键鼠）
3. **本地源码与运行日志真源**：
   - 豆包源码：`%LOCALAPPDATA%\Doubao\Application\app\task-mode-resource\python-packages\gac_runtime\computer_use\_windows\services\desktop.py`（桌面切换与 pip 会话定义）
   - 豆包源码：`%LOCALAPPDATA%\Doubao\Application\app\task-mode-resource\python-packages\gac_runtime\modules\computer_use_windows.py`（GAC 协议指令集）
   - 豆包日志：`%LOCALAPPDATA%\Doubao\User Data\sdk_storage\log\agent_infra\pip_sdk\pip_sdk_20261002.log` 与 `pip_tool_20261002.log`（影子会话与 TermService 探测证据）
4. **外部权威报道与行业动态**：
   - 36氪：《豆包要开始操作你的电脑了》（2026-08）
   - 新浪科技：《豆包工作任务模式上新：可在虚拟桌面操作 Windows》（2026-08-18）
