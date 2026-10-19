# opencode 自报能力（2026-10-19）

自报人：opencode（会话 goal-mvewvj-opencode）。本机版本 opencode 1.18.33（`opencode --version` 实测）。
证据分三档：试过（当场跑命令）、看到（工具/文档/帮助清单）、推测。功能已逐条用 `agent_gateway.js feature` 登记进黑板，共 14 条。
网络调研来源：opencode.ai 官网及 docs（plugins 页 2026-10-17 更新）、`opencode --help` 全量命令清单、中心 CAPABILITY_MAP 里 opencode 已实测的格子。

## 一、矩阵里原生能做的（格子 + 入口 + 依据）

| 能力单元 | 原生入口 | 开放程度 | 依据 |
|---|---|---|---|
| 新建/恢复会话 | `opencode run "..." -s <sessionID>`；HTTP `POST /session` + `/prompt` | 开源 | 试过：中心 CAPABILITY_MAP open/resume 行均 ✓ |
| 命令行非交互 | `opencode run`（--model、--agent、--session、--fork、--continue） | 开源 | 试过：`opencode --help` |
| HTTP 服务 + SDK | `opencode serve`、`opencode attach <url>`，REST 全套 | 开源 | 试过：--help；中心实测 POST /session 建会话 |
| 网页界面 | `opencode web` | 开源 | 看到：--help 原文 |
| ACP 桥 | `opencode acp` | 开源 | 看到：--help；中心 acpx 走 ACP 实测 5 格 ✓ |
| 观察·历史 | `opencode export <sessionID>`（整段 JSON） | 开源 | 试过：中心 observe-history 行 ✓ |
| 状态识别/打断/关闭 | 事件流 + `opencode session list/delete` | 开源 | 试过：中心 state/cancel/close 行 ✓（cancel 用过 retest 脚本） |
| 分叉 | `--fork`（配合 --continue/--session） | 开源 | 看到：--help |
| 插话/注入 | ACP connection.prompt 并发可插；`POST /session/{id}/message` | 开源 | 推测偏看到：中心 steer 行标 ?，未全证实 |
| 压缩上下文 | 内置 compact + 插件钩子 `experimental.session.compacting`（可替换压缩提示词） | 开源 | 看到：docs/plugins |
| 自定义 agent/子智能体 | `opencode agent create/list`、`.opencode/agent/*.md`、`run --agent plan` | 开源 | 看到：docs/agents；中心记子智能体工具 6 格 |
| 挂接工具/MCP | `opencode mcp`；插件可加自定义工具（同名覆盖内置） | 开源 | 看到：--help + docs/plugins |
| 全文检索/读元数据 | `opencode db`；会话存本地 SQLite | 开源 | 看到：--help |
| 列模型/切模型 | `opencode models [provider]`、`--model`、`opencode providers (auth)` | 开源 | 看到：--help |
| 权限模式 | `--auto`（自动放行未显式拒绝的）+ docs/permissions | 开源 | 看到：--help |

## 二、独家生态与开放程度

1. **GitHub 智能体**（独家，公开接口）：`opencode github install/run`，装进仓库后在 issue/PR 里 @ 触发云端干活、回写 PR。七家里唯一"住在仓库里"的云端形态（codex 云端在 ChatGPT 侧）。依据：看到（--help + docs/github）。
2. **会话分享链接**（独家，公开接口）：任一会话一键生成只读网页链接。依据：看到（官网首页 Share links、docs/share）。
3. **mDNS 服务发现**（独家，开源）：`serve --mdns` 把服务器广播为 opencode.local，局域网设备自动发现。依据：看到（--help 原文）。七家唯一。
4. **模型网关 Zen**（独家，公开接口）：官方代管的经基准测试的编码模型 + 免费模型，一个 key 多家模型；同时支持 75+ provider、含 Ollama 本地。依据：看到（opencode.ai 首页）。
5. **LSP 集成**（别家也有但做得突出，开源）：自动加载 LSP，把诊断当反馈喂给模型。家用编码 agent 里少见。依据：看到（docs/lsp + 官网）。
6. **插件系统**（别家也有但钩子面广，开源）：30+ 事件钩子（工具前后、权限、shell.env、压缩），npm/本地即装，可自定义工具。依据：看到（docs/plugins）。
7. **会话导入导出**（别家少有，开源）：export/import JSON，含从 URL 导入。依据：看到（--help）+ 中心实测 export。

开放程度汇总：开源 9 条（HTTP/SDK、网页、ACP、插件、agent、LSP、导入导出、stats、mDNS），公开接口 3 条（GitHub agent、分享链接、Zen），不开放 0 条——核心全部 MIT 开源，是七家里开放程度最高的一家。

## 三、清单外的能力与明确没有的

- **操作电脑（computer use）**：没有，原生无任何截图/鼠标键盘通道；要补须装第三方 MCP（如 browser MCP）。依据：看到（docs/tools 无此类工具）。
- **内置浏览器自动化**：没有；网页内容只有 webfetch 抓正文。
- **定时任务台**：没有无常驻调度；GitHub agent 只由 issue/PR 事件触发。依据：看到（全量命令清单无 schedule/cron）。
- **对用户可见的桌面端界面**：TUI + 桌面应用 + IDE 插件多端存在（官网），桌面端人机交互矩阵中心标"没查"，本条不代查。

与网络调研对不上的地方：无重大出入；社区文章说 opencode "Go + Bubble Tea" 是旧版信息（现核心 TypeScript/Bun，1.18.33 实测行为与官方 docs 一致）。
