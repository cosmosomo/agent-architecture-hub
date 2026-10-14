---
channel_id: opencli-zhihu
name: OpenCLI · 知乎通道 (zhihu)
category: tool_site
maintainer: S3
status: 🟡 cooldown_degraded
upgrade_status: ✅ synced
verified_version: "opencli@1.8.8+ext1.0.24"
detected_version: "opencli@1.8.8+ext1.0.24"
holder: none
last_verified_at: "2026-10-14T04:46:49+08:00"
capabilities:
  observe_only: true
  external_session_read: false
  control_lifecycle: { start: true, resume: false, fork: false, stop: false }
  steer_in_turn: { in_turn: false, next_turn: false, inbox_file: false }
  coordinate_team: { spawn_subagent: false, peer_message: false, task_board: true }
---

# OpenCLI · 知乎 (`opencli-zhihu`) · 渠道能力与攻防维护档案卡

> **本机唯一主状态卡同步源（严禁另建孤岛）**：
> - 全局状态板：[`C:\Users\COLORFIRE\.zcode\skills\opencli-poweruser\local\channel-state\BOARD.md`](file:///C:/Users/COLORFIRE/.zcode/skills/opencli-poweruser/local/channel-state/BOARD.md)
> - 渠道状态卡：[`C:\Users\COLORFIRE\.zcode\skills\opencli-poweruser\local\channel-state\channels\zhihu.md`](file:///C:/Users/COLORFIRE/.zcode/skills/opencli-poweruser/local/channel-state/channels/zhihu.md)
> - 专职维护会话：`codex://threads/01a0f203-c4db-7d10-91a4-5aa2286239dc`

## 一、渠道身份与接入入口
- **渠道定位**：中文技术与行业深度讨论采集源（`topstory / hot / question` 可用，`search` 挂账 `T1` 待修）。
- **接入方式**：`opencli zhihu <subcmd>`（走已登录浏览器后台默认 Profile `v6pz9gjx`）。

## 二、独立能力矩阵（按子命令单独记录）
| 子命令 | 状态 | 精确命令与表现 | 核验依据 |
|---|---|---|---|
| `topstory` | 🟢 可用 | `opencli zhihu topstory --limit 5 -f json` | `10-09/10-14` `〔实测:exit 0〕` |
| `hot` | 🟢 可用 | `opencli zhihu hot --limit 10 -f json` | `10-14` `〔实测:exit 0〕` |
| `question` | 🟢 可用 | `opencli zhihu question <qid> -f json` | `10-14` `〔实测:exit 0〕` |
| `search` | 🟡 **故障待修 (`T1`)** | `opencli zhihu search --query "<kw>" --limit 5 -f json` 在 ~1.0s 内返回 `Error: COMMAND_FAILED: Navigation rejected.` | `10-14 04:46` `〔实测:zhihu-search/process.json〕` |

## 三、当前状态、安全参数与防呆红线
- **当前状态**：🟡 部分可用（禁用 `zhihu search`，改用 `AnySearch` 搜知乎问题 ID 后调 `opencli zhihu question <id>`）
- **安全红线**：
  1. 调用间隔 $\ge 20\text{s}$，单实例串行；
  2. 首条报错（如 `Navigation rejected`）立即停手保现场，严禁盲目重试；
  3. 占锁运行结束后必须清锁（曾发生 `U02` Codex 异常退出遗留僵尸锁事件）。

## 四、渠道升级与功能演进日志
- **2026-10-09 ~ 10-14 · 确立“AnySearch 捞 Question ID + `opencli zhihu question` 读详情”的组合绕行方案**。

## 五、状态变化与故障/攻防时间线
- **2026-10-14 04:46 · 🟡 16 平台维护复测捕获 `T1`**：`opencli zhihu search --query AI --limit 5 -f json` 耗时 1018ms 返回 `exit=1` (`Navigation rejected.`)，证据归档于 `E:/program/GIT/media/opencli-poweruser/local/channel-test/2026-10-14/zhihu-search/`。
- **2026-10-07 ~ 10-12 · 🟡 治理 `U02` 遗留锁与 `search` `COMMAND_FAILED`**：清理 `codex` 陈旧锁并补齐 SHA256 取证索引。

## 六、维护者（S3 / Codex `01a0f203`）挂账与待办
- [ ] **`[T1]`** 排查后台 `tabs.update` 对知乎搜索 URL 1 秒内报 `Navigation rejected` 的根因（负责人：S3 / Codex `01a0f203`）。
