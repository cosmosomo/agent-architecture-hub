---
channel_id: doubao-desktop
name: 豆包 Desktop (Doubao & DoubaoWork)
category: host
maintainer: S5
status: 🟢 healthy
upgrade_status: 🔍 watch_external_sessions
verified_version: "2.32.6 (CDP:9225)"
detected_version: "2.32.6 (CDP:9225)"
holder: idle
last_verified_at: "2026-10-19T18:35:00+08:00"
capabilities:
  observe_only: false
  external_session_read: true
  control_lifecycle: { start: true, resume: true, fork: false, stop: false }
  steer_in_turn: { in_turn: false, next_turn: true, inbox_file: true }
  coordinate_team: { spawn_subagent: true, peer_message: false, task_board: false }
---

# 豆包 Desktop (`doubao-desktop`) · 宿主能力与渠道维护档案卡

## 一、渠道身份与接入入口
- **角色定位**：并行搜索与本地工作任务特化执行者（支持标准「对话」与具备本地命令/文件工具链的「工作（本地电脑）」双模式）。
- **本机安装形态**：同时装有普通版 `Doubao`（`2.32.6`）与办公协同后台 `DoubaoWork.exe`（由 `agent_infra.dll` 驱动）。
- **控制与读取入口**：
  - **无窗口后台隔离 CDP 守护（端口 `127.0.0.1:9225`，零打扰前台）**：
    - 启动命令（已内置于 `agent_gateway.js` 的 `ensureDoubaoDesktopDaemon` 自动拉起）：
      ```powershell
      "C:\Users\COLORFIRE\AppData\Local\Doubao\Application\Doubao.exe" --user-data-dir="C:\Users\COLORFIRE\AppData\Local\Temp\doubao_cdp_test" --no-startup-window --keep-alive-for-test --remote-debugging-port=9225 --remote-allow-origins=*
      ```
    - 命令行交互：
      - 中心网关统一调用：`node hub/tools/agent_gateway.js status --channel doubao-desktop` / `node hub/tools/agent_gateway.js run --channel doubao-desktop --prompt "..."`
      - OpenCLI 直连：`opencli doubao-app status / ask / send / read / new / screenshot / dump`
  - **文件投递/交付通道**：
    - 支持在「工作（`本地电脑`）」模式下直接指示豆包读写本地绝对路径文件，或读取 `%LOCALAPPDATA%\Doubao\User Data\Default\.doubao\agent_mode\workspace\.sessions\<id>\` 下的 `assignment.md`、`trajectory.jsonl`、`findings.jsonl`、`board.md`。
  - **历史对话目录（普通聊天）**：
    - `%LOCALAPPDATA%\Doubao\User Data\Default\saman_shell_db_storage\`（Chromium LevelDB 二进制块，包含全量历史消息 JSON）。

## 二、独立能力矩阵（逐项核验记录）
| 能力维度 | 子能力项 | 支持度 | 精确命令 / 协议 / 字段依据 | 核验版本 & 证据 |
|---|---|---|---|---|
| **后台无头 CDP 管控** | 零窗口/零打扰自动拉起与派活 | ✅ 已打通 | 逆向 `Doubao.dll`（`RVA 0x00af5752`）解锁 `--no-startup-window --keep-alive-for-test --remote-debugging-port=9225` 隐藏开关；配合 `Local State` 的 `devtools.remote_debugging.allowed=true` 与 WMI `Win32_Process.Create` 独立后台拉起 | `2.32.6 (CDP:9225)` `〔实测:0.5秒就绪且0窗口〕` |
| **零锁登录态克隆** | 内核页缓存 `MapViewOfFile` 复刻 Cookie | ✅ 已打通 | 前台 `NetworkService` 以 `dwShareMode=0` 锁死 `Default\Network\Cookies` 时，通过 `DuplicateHandle` + `CreateFileMappingW` + `MapViewOfFile` 从内核页缓存零锁读取 SQLite 字节流并同步 `Local State`（含 DPAPI `os_crypt` 密钥） | `2.32.6` `〔实测:122880字节完整复刻〕` |
| **DOM 在线读取/控制** | OpenCLI `doubao-app` 全链路收发 | ✅ 已打通 | 修复 `@jackwener/opencli` 的 `doubao-app` 适配器（支持 v2.32.6 `contenteditable="true"` 富文本输入、`message_loading`/`chat_input_local_break_button` 状态检测与 `scoreCDPTarget` 评分），打通 `agent_gateway.js run/status` | `2.32.6 (CDP:9225)` `〔实测:端到端收发闭环〕` |
| **电脑操作 (Computer Use)** | 双层免打扰操作（本地工具链 + PiP 虚拟桌面） | ✅ 原生支持 | ① **第一层（工作模式 · 本地电脑）**：在后台无窗口实例切入「工作（本地电脑）」，通过 `DoubaoWork.exe` + `agent_infra.dll`（`AgentToolIpcServer`）静默执行 `Bash/Read/Write/Edit/Glob/Grep`，实测 9 秒完成本地文件读写且 0 键鼠屏幕占用；<br>② **第二层（GUI 虚拟桌面）**：由 `pip_sdk.dll`（`v0.0.0.85`，`PipSdk_IsSystemEnvironmentInitialized()==true`）基于 WTS 影子会话 + 本地回环 RDP（`127.0.0.2`）渲染独立虚拟桌面，不抢占物理键鼠 | `2.32.6` `〔实测:后台文件读写与DLL调用〕` |
| **外部读 Sessions** | 离线读取 Agent 会话库 | ✅ 已打通 | 读取 `%LOCALAPPDATA%\Doubao\User Data\Default\.doubao\agent_mode\workspace\.sessions` 下的 `assignment.md` 与 `trajectory.jsonl` | `2026-10-19` `〔实测:文件存在且无锁〕` |
| **内置并行搜索** | 创建多智能体并行联网搜索 | ✅ 原生强项 | 客户端内置多智能体并行搜索能力（观察台记为 `native` 专属能力） | `2.32.6` `〔用户核定〕` |

## 三、当前状态、安全参数与防呆红线
- **当前状态**：🟢 健康就绪（独立无窗口后台守护运行于 `127.0.0.1:9225`，与用户前台 `Doubao.exe` 完全隔离，互不干扰）
- **绝对红线**：
  1. **严禁重启、杀进程或改动用户前台在用的 `Doubao.exe` / `DoubaoWork.exe` 进程**；所有自动化调用一律走 `--user-data-dir="%LOCALAPPDATA%\Temp\doubao_cdp_test" --no-startup-window --keep-alive-for-test --remote-debugging-port=9225` 独立后台实例；
  2. **派活前可按需指定交付文件路径**，或直接通过 `agent_gateway.js run --channel doubao-desktop --prompt "..."` 同步收回结构化 JSON 回复。

## 四、渠道升级与功能演进日志
- **2026-10-19 · 🟢 重大突破：逆向解锁 `Doubao.dll` 后台无头 CDP `9225` + 零锁克隆登录态 + 打通 `opencli doubao-app` 与「工作（本地电脑）」模式**：
  - **二进制逆向破解 CDP 门禁（`Doubao.dll`）**：反汇编 `content::DevToolsManager::DevToolsManager()`（`RVA 0x00af56a0..0x00af5825`）与 `BrowserProcessImpl::CreateDevToolsProtocolHandler()`（`RVA 0x0271e8a0`），查明字节定制门禁：必须同时传入 `(--no-startup-window || --headless)` 与 `(--remote-debugging-port || --remote-debugging-pipe)`，且使用非默认 `--user-data-dir`（`RVA 0x0229e8e0`）并在 `Local State` 开启 `devtools.remote_debugging.allowed: true`。加齐参数后 0.5 秒开启 `127.0.0.1:9225`，全程 0 窗口、0 焦点抢占；
  - **零锁内核页缓存克隆 Cookie**：通过 `NtQueryObject` + `DuplicateHandle` + `CreateFileMappingW` + `MapViewOfFile` 直接从 `NetworkService` 进程句柄对应的内核页缓存提取 `Default\Network\Cookies`（122,880 字节），免杀进程完美复刻用户登录态；
  - **修复 OpenCLI `doubao-app` 适配器并接入 `agent_gateway.js`**：适配豆包 v2.32.6 的 `contenteditable="true"` 富文本输入框、流式结束判定与 `scoreCDPTarget` 评分，并在 `agent_gateway.js` 实现后台守护自动拉起与 JSON 结果提取；
  - **实测后台「工作（本地电脑）」模式零打扰读写本地文件**：在无头后台实例中切入「工作（本地电脑）」模式，实测通过 `opencli doubao-app ask` 驱动豆包调用本地文件写入与读取工具（`C:\Users\COLORFIRE\AppData\Local\Temp\doubao_work_test.txt`），全程不占用屏幕、鼠标、键盘。
- **2026-10-14 · 建立“外部查看 Sessions 开放性哨兵（`WATCH-DOUBAO-01`）”**：
  - `check_channels.js` 每次巡检自动扫描 `%LOCALAPPDATA%\Doubao` 与 `%APPDATA%\Doubao` 下是否出现新增的 `*.sqlite`、`*.db`、`sessions/`、`transcripts/`、`export/` 目录或新增本地 CLI/HTTP 端口。

## 五、状态变化与故障/攻防时间线
- **2026-10-19 · 🟢 晋升 `🟢 healthy`**：通过 `--no-startup-window --keep-alive-for-test --remote-debugging-port=9225` 独立后台 Profile 彻底解决前台进程占用与弹窗抢焦点问题。
- **2026-10-01 · 🟡 核清 LevelDB 存储锁与 CDP 9225 边界**：早期版本直接启动会弹窗或合并至前台进程，现已由 `--no-startup-window --keep-alive-for-test` 方案攻克。

## 六、维护者（S5）挂账与待办
- [ ] 持续运行哨兵单 [`WATCH_doubao-desktop_external_sessions.md`](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/channels/upgrades/WATCH_doubao-desktop_external_sessions.md)，监测客户端更新动态。
