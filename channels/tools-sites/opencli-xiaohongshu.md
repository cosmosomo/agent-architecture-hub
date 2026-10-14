---
channel_id: opencli-xiaohongshu
name: OpenCLI · 小红书通道 (xiaohongshu)
category: tool_site
maintainer: S3
status: 🟡 cooldown_degraded
upgrade_status: ✅ synced
verified_version: "opencli@1.8.8+ext1.0.24"
detected_version: "opencli@1.8.8+ext1.0.24"
holder: none
last_verified_at: "2026-10-14T12:44:11+08:00"
capabilities:
  observe_only: true
  external_session_read: false
  control_lifecycle: { start: true, resume: false, fork: false, stop: false }
  steer_in_turn: { in_turn: false, next_turn: false, inbox_file: false }
  coordinate_team: { spawn_subagent: false, peer_message: false, task_board: true }
---

# OpenCLI · 小红书 (`opencli-xiaohongshu`) · 渠道能力与攻防维护档案卡

> **本机主状态卡同步源**：[`C:\Users\COLORFIRE\.zcode\skills\opencli-poweruser\local\channel-state\channels\xiaohongshu.md`](file:///C:/Users/COLORFIRE/.zcode/skills/opencli-poweruser/local/channel-state/channels/xiaohongshu.md)

## 一、渠道身份与两条子通道严格分立
| 子通道 | 当前状态 | 接入方式 | 核定结论 |
|---|---|---|---|
| **1. 已登录浏览器通道 (`v6pz9gjx`)** | 🟡 可用但带 `T1` 观察项 | `opencli xiaohongshu search / feed / note / comments`（全程后台默认 Profile `v6pz9gjx`） | `search` 2026-10-14 复测通过；`note` 存在间歇性 `COMMAND_FAILED` / `Navigation rejected`（挂账 `T1`） |
| **2. 匿名爬虫通道 (SSR / AnySearch)** | 🔒 **结构性关闭** | 直抓 HTML / AnySearch `extract` / 搜索引擎快照 | 未登录态仅返回 12KB 占位页，搜索引擎摘要全为 `"No information available"`，彻底不可用 |

## 二、独立能力矩阵（已登录通道 `v6pz9gjx`）
| 子命令 | 支持度 | 精确命令与参数要求 | 核验版本 & 证据 |
|---|---|---|---|
| `search` | 🟢 可用 | `opencli xiaohongshu search "<kw>" --limit 5`（默认筛选已做本地补丁绕过诱饵 DOM，**非默认筛选禁用**） | `1.8.8` `〔10-14实测通过〕` |
| `feed` | 🟢 可用 | `opencli xiaohongshu feed`（若默认后台导航拒绝，可做一次后台 `persistent` 诊断） | `1.8.8` `〔10-11实测〕` |
| `note` | 🟡 间歇故障 (`T1`) | `opencli xiaohongshu note '<search返回的完整带xsec_token签名URL>'`（**必加单引号**） | `1.8.8` `〔10-14复测note失败1次〕` |
| `comments` | 🟢 可用 | `opencli xiaohongshu comments '<完整签名URL>' --limit 5` | `1.8.8` `〔10-11实测通过〕` |

## 三、当前状态、安全参数与防呆红线
- **当前状态**：🟡 已登录通道 `search` 可用，`note` 挂账 `T1`（历史故障不因单次通过自动关闭）
- **安全参数與铁律**：
  1. **调用间隔**：`search` 词间 **$\ge 30\text{s}$**；全系统仅允许 `S3` 单实例串行调用；
  2. **签名 URL 铁律**：`note` 与 `comments` 必须原样传入 `search` 返回的完整带签名 URL，并用单引号包裹（防止 `&` 被 Shell 截断）；
  3. **首错停手保现场铁律**：遇 `Navigation rejected.`、`0B` 输出、`COMMAND_FAILED` 或错误码 `300017` **立即停手**，保存 `process.json` / `stdout` / `stderr` 与 tab 租约状态，**严禁盲目重试或重启浏览器抹掉现场**！

## 四、渠道升级与反爬攻防演进日志
- **2026-09-29 · 攻克站方反自动化诱饵 DOM (`data-hp-kind` / `ambiguous_option`)**：
  - **攻防现象**：小红书在筛选面板每个选项旁叠加了反自动化诱饵克隆节点（带 `data-hp-kind` 属性），导致官方适配器点击默认筛选时匹配到两个节点报错 `ambiguous_option`；
  - **修复方案**：在 `~/.opencli/clis/xiaohongshu/search.js`（及权威仓 `adapters/xiaohongshu/`）打补丁——默认筛选不再触碰筛选面板，结合 `OPENCLI_BROWSER_COMMAND_TIMEOUT=150` 恢复稳定。
- **2026-10-11 · 勘误豆包批量脚本 `Navigation rejected` 归因**：
  - 查明 7 个失败文件实为 `exitCode=1` 伴随 `Navigation rejected.`（Chromium `tabs.update` 内容层拒绝导航），修复了批量脚本“把 stderr 混入 JSON 且不验退出码继续跑”的缺陷。

## 五、状态变化与故障/攻防时间线
- **2026-10-14 04:42~04:44 · 🟡 维护复测**：后台 `search` `exit=0`（返回 3 项）；紧接着 `note` 1 次返回 `COMMAND_FAILED`，立即按规矩停手保现场，证据存 `E:/program/GIT/media/opencli-poweruser/local/channel-test/2026-10-14/xhs-note/process.json`。

## 六、维护者（S3）挂账与待办
- [ ] **`[T1]`** 持续追踪 `note` 间歇性 `Navigation rejected` / `COMMAND_FAILED` 触发条件（负责人：S3）。
