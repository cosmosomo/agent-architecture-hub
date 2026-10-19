# 渠道档案卡扫描报告 · 豆包闭环验证

- **扫描时间**：2026-10-19（Asia/Shanghai）
- **扫描范围**：`E:\program\GIT\Agent\multi\Agent-Architecture-Hub\channels\hosts\*.md`（全部 11 张档案卡）
- **提取字段**：`channel_id`、`name`、`status`、`verified_version`、`holder`（YAML frontmatter）

## 一、渠道汇总表

| # | channel_id | name | status | verified_version | holder |
|---|---|---|---|---|---|
| 1 | ap-vibe | AP-Vibe 协作工作台与托管伙伴池 (:8876) | 🟢 ok | 8876-agent-hub | shared |
| 2 | antigravity | Google Antigravity (AGY 2.0 App / IDE / CLI / SDK & Language Server RPC) | 🟢 ok | hub-2.23.0 (LS-ConnectRPC+agentapi) | shared |
| 3 | factory-droid | Factory.ai Droid CLI & Daemon | 🟢 ok | 0.228.0 | shared |
| 4 | gemini-cli | Google Gemini CLI | 🟡 cooldown_degraded | 0.62.0 | shared |
| 5 | opencode | OpenCode CLI & HTTP Server | 🟢 ok | 1.18.33 | shared |
| 6 | workbuddy | Tencent WorkBuddy / CodeBuddy CLI | 🟢 ok | 2.160.0 | shared |
| 7 | codex | OpenAI Codex CLI & App-Server | 🟢 ok | 0.159.2 | shared |
| 8 | claude-code | Anthropic Claude Code CLI | 🟢 ok | 2.1.85 | shared |
| 9 | hermes | Hermes Agent（本机源码版，ACP） | 🟢 ok | 0.21.1 | shared |
| 10 | zcode | ZCode (CLI & Electron Desktop) | 🟢 ok | 0.16.9 | shared |
| 11 | doubao-desktop | 豆包 Desktop (Doubao & DoubaoWork) | 🟢 healthy | 2.32.6 (CDP:9225) | idle |

**统计**：渠道总数 **11**；healthy 渠道（🟢 ok + 🟢 healthy）**10**；非健康 **1**（gemini-cli，🟡 cooldown_degraded）。

## 二、豆包桌面端融入多智能体中心的优势总结

> 主题：豆包桌面端通过**无窗口 CDP 9225** 与**工作模式本地工具链**融入多智能体中心

1. **零打扰后台常驻，不抢占前台焦点**。`Doubao.exe` 以 `--no-startup-window --keep-alive-for-test --remote-debugging-port=9225` 拉起无窗口隔离守护，与普通版 `Doubao` / `DoubaoWork.exe` 并存，由 `agent_gateway.js` 的 `ensureDoubaoDesktopDaemon` 自动保活；调度交互全部走 CDP `127.0.0.1:9225`，对用户桌面零打扰，符合"所有自动化必须后台运行"的执行红线。

2. **唯一兼具"对话 + 真机执行"双模态的宿主渠道**。普通对话模式可承担并行搜索等任务；「工作（本地电脑）」模式直接挂载本地命令/文件工具链，可读写本地绝对路径文件，具备**落地执行**能力（frontmatter `observe_only: false`），而非仅观察/读取的旁路渠道——这是与其余 10 个纯 CLI/协议型渠道的本质差异。

3. **中心网关原生接入，调度成本低**。既可通过 `agent_gateway.js`（`status` / `run`）统一调用，也可用 OpenCLI 直连（`status / ask / send / read / new / screenshot / dump`），无需额外适配器即可被多智能体中心按既有渠道规范调度。

4. **四件套落盘协议实现双向闭环**。工作模式下会话工作区 `workspace\.sessions\<id>\` 落盘 `assignment.md`、`trajectory.jsonl`、`findings.jsonl`、`board.md`：中心下发任务（assignment）→ 豆包执行并留痕（trajectory）→ 结论回写（findings/board），中心可全程可审计读取，形成"派单—执行—验收"闭环，支撑将其从 `idle` 状态激活为常设执行渠道。

5. **作为"人机交汇"测试床**。豆包桌面端既是多智能体中心的执行渠道，也是工作模式本地工具链在真实 Windows 环境中的验证载体；本次闭环任务（档案卡扫描 → 汇总报告落盘）即为其工作模式本地路径能力的实证用例。

## 三、结论

- 扫描到渠道总数：**11**
- healthy 渠道数：**10**（ap-vibe、antigravity、factory-droid、opencode、workbuddy、codex、claude-code、hermes、zcode、doubao-desktop）
- 非健康：**1**（gemini-cli，🟡 cooldown_degraded，共享持有）
- 报告文件：`E:\program\GIT\Agent\multi\Agent-Architecture-Hub\channels\probe\reports\doubao-closed-loop-20261019.md`
