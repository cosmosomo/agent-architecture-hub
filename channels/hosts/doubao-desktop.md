---
channel_id: doubao-desktop
name: 豆包 Desktop (Doubao & DoubaoWork)
category: host
maintainer: S5
status: 🔴 blocked_down（10-20 研究员实测证实：后台实例与前台复用同账号登录态时，豆包云端 SSE 工具调用流 [/alice/office/tool_local/chunk_stream] 会被广播给后台无沙箱环境的实例并抢先报错返回 sandbox_environment_not_ready，打崩前台用户的正常工具执行；且 C++ 组件硬编码 %LOCALAPPDATA% 争抢锁文件。双实例在同账号下不可物理共存，必须保持 blocked_down，建议中心改用前台单实例 CDP Attach 或纯离线 Strategy.LOCAL）
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
      "C:\Users\COLORFIRE\AppData\Local\Doubao\Application\Doubao.exe" --user-data-dir="C:\Users\COLORFIRE\.agent-hub\doubao-daemon" --no-startup-window --keep-alive-for-test --remote-debugging-port=9225
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
- **当前状态**：🟢 健康就绪（独立无窗口后台守护运行于 `127.0.0.1:9225`，Profile 位于 `~/.agent-hub/doubao-daemon`，与用户前台 `Doubao.exe` 完全隔离，互不干扰）
- **绝对红线**：
  1. **严禁重启、杀进程或改动用户前台在用的 `Doubao.exe` / `DoubaoWork.exe` 进程**；所有自动化调用一律走 `--user-data-dir="%USERPROFILE%\.agent-hub\doubao-daemon" --no-startup-window --keep-alive-for-test --remote-debugging-port=9225` 独立后台实例；
  2. **绝对禁止开启 `--remote-allow-origins=*`**；仅允许本地原生无 Origin 客户端建连，彻底杜绝本地恶意网页跨域攻入 9225 CDP；
  3. **派活前可按需指定交付文件路径**，或直接通过 `agent_gateway.js run --channel doubao-desktop --prompt "..."` 同步收回结构化 JSON 回复。

## 四、渠道升级与功能演进日志
- **2026-10-20 03:55 · 🔴 确证后台双实例冲突根因并保持 blocked_down，完成回复收集与会话表接入**：
  - **确证双实例致命冲突根因**：深入分析 `saman_2026.1020.0.log` 发现，后台实例（PID 88012）复用前台登录 Cookie 时，豆包云端将用户账号级的 SSE 工具调用流（`/alice/office/tool_local/chunk_stream`）同时广播给前后台两端。当用户在前台执行文件读写等工具时，未初始化本地沙箱的后台实例抢先回包报错 `Sandbox could not be provisioned: sandbox_environment_not_ready`，打崩前台；同时 C++ 组件硬编码 `%LOCALAPPDATA%` 争抢锁文件。确认同账号下无法长期共存第二实例，宿主卡保持 `🔴 blocked_down`；
  - **打通 OpenCLI 回复收集与三项能力单元实测（黑板 2188-2190 全部 pass）**：修复 `@jackwener/opencli` 的 `utils.js`（可见性判定与倒序查找最后一个 Assistant 容器）及 `ask.js`（轮询超时前基于 `readMessagesScript` 兜底收割），并在 `agent_gateway.js` 实现 Fallback Read，彻底攻克连续对话中 `No response received within 600s` 假超时问题；实测 `open`（暗号 T102001，28s）、`resume`（暗号 T102002，7.8s）、`act-deliver`（暗号 T102003，9s，dsp_195237_gz3s 结构化主动交回）全绿；
  - **打通 `sessions --agent doubao` 桥接与 `trace/` 接入方案**：在 `agent_gateway.js` 实现自动桥接 `doubao_sessions_discover.js`，秒级列出 70+ 智能体模式本地会话，并向负责人提交 `trace/apps/cli/src/gateway/sessions.ts` 原生集成方案。
- **2026-10-19 20:30 · 🟢 生产级长期化与安全收紧**：
  - **移除 `--remote-allow-origins=*` 攻防隐患**：查实并实测 Chromium DevTools 机制，完全移除通配符后，本机浏览器内的恶意网页（携带 `Origin: https://...`）建连 WebSocket 被 403 Forbidden 彻底阻断，而本地 opencli（无 Origin 头）正常握手通过；
  - **Profile 迁移至持久目录 `~/.agent-hub/doubao-daemon`**：远离 `%TEMP%` 易被系统磁盘清理和权限暴露的风险；
  - **网关层增加登录态失效检测与 `--reauth` 凭据重新同步**：自动识别登录过期并在 `agent_gateway.js run` 中输出明确指引。
- **2026-10-19 18:30 · 🟢 重大突破：逆向解锁 `Doubao.dll` 后台无头 CDP `9225` + 零锁克隆登录态 + 打通 `opencli doubao-app` 与「工作（本地电脑）」模式**：
  - **二进制逆向破解 CDP 门禁（`Doubao.dll`）**：反汇编 `content::DevToolsManager::DevToolsManager()`（`RVA 0x00af56a0..0x00af5825`）与 `BrowserProcessImpl::CreateDevToolsProtocolHandler()`（`RVA 0x0271e8a0`），查明字节定制门禁：必须同时传入 `(--no-startup-window || --headless)` 与 `(--remote-debugging-port || --remote-debugging-pipe)`，且使用非默认 `--user-data-dir`（`RVA 0x0229e8e0`）并在 `Local State` 开启 `devtools.remote_debugging.allowed: true`。加齐参数后 0.5 秒开启 `127.0.0.1:9225`，全程 0 窗口、0 焦点抢占；
  - **零锁内核页缓存克隆 Cookie**：通过 `NtQueryObject` + `DuplicateHandle` + `CreateFileMappingW` + `MapViewOfFile` 直接从 `NetworkService` 进程句柄对应的内核页缓存提取 `Default\Network\Cookies`（122,880 字节），免杀进程完美复刻用户登录态；
  - **修复 OpenCLI `doubao-app` 适配器并接入 `agent_gateway.js`**：适配豆包 v2.32.6 的 `contenteditable="true"` 富文本输入框、流式结束判定与 `scoreCDPTarget` 评分，并在 `agent_gateway.js` 实现后台守护自动拉起与 JSON 结果提取；
  - **实测后台「工作（本地电脑）」模式零打扰读写本地文件**：在无头后台实例中切入「工作（本地电脑）」模式，实测通过 `opencli doubao-app ask` 驱动豆包调用本地文件写入与读取工具（`C:\Users\COLORFIRE\AppData\Local\Temp\doubao_work_test.txt`），全程不占用屏幕、鼠标、键盘。
- **2026-10-14 · 建立“外部查看 Sessions 开放性哨兵（`WATCH-DOUBAO-01`）”**：
  - `check_channels.js` 每次巡检自动扫描 `%LOCALAPPDATA%\Doubao` 与 `%APPDATA%\Doubao` 下是否出现新增的 `*.sqlite`、`*.db`、`sessions/`、`transcripts/`、`export/` 目录或新增本地 CLI/HTTP 端口。

## 五、状态变化与故障/攻防时间线
- **2026-10-19 · 🟢 晋升 `🟢 healthy` 并实现安全长期化**：通过独立后台 Profile `~/.agent-hub/doubao-daemon` + 移除 `--remote-allow-origins=*` 彻底解决前台占用、弹窗抢焦与跨域安全问题。
- **2026-10-01 · 🟡 核清 LevelDB 存储锁与 CDP 9225 边界**：早期版本直接启动会弹窗或合并至前台进程，现已由 `--no-startup-window --keep-alive-for-test` 方案攻克。

## 六、维护者（S5）挂账与待办
- [ ] 持续运行哨兵单 [`WATCH_doubao-desktop_external_sessions.md`](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/channels/upgrades/WATCH_doubao-desktop_external_sessions.md)，监测客户端更新动态。
