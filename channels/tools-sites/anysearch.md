---
channel_id: anysearch
name: AnySearch 联网搜索与网页正文提取通道
category: tool_site
maintainer: S3
status: 🟢 ok
upgrade_status: ✅ synced
verified_version: "anysearch-skill-v1"
detected_version: "anysearch-skill-v1"
holder: shared
last_verified_at: "2026-10-14T12:15:00+08:00"
capabilities:
  observe_only: true
  external_session_read: false
  control_lifecycle: { start: true, resume: false, fork: false, stop: false }
  steer_in_turn: { in_turn: false, next_turn: false, inbox_file: false }
  coordinate_team: { spawn_subagent: false, peer_message: false, task_board: false }
---

# AnySearch (`anysearch`) · 外部搜索渠道能力与维护档案卡

## 一、渠道身份与接入入口
- **渠道定位**：全系统联网搜索保底通道（替代 Codex 内置 `web_search` 空返回与 ZCode 内置搜索配额耗尽，并作为 BOSS 直聘 IP 封禁时的降级替代）。
- **入口位置**：
  - Skill 说明：`C:\Users\COLORFIRE\.zcode\skills\anysearch\SKILL.md`
  - 运行时主 Key：`C:\Users\COLORFIRE\.zcode\skills\anysearch\.env`（CLI 自动加载；另备 2 把 Key 存于 `E:\program\sota\协作环境\_private\凭证.md`，严禁回显明文）。

## 二、独立能力矩阵（逐项核验记录）
| 子能力项 | 支持度 | 实测结论与能力边界 | 核验依据 |
|---|---|---|---|
| **通用关键词联网搜索** | ✅ 稳定可用 | 一主两备三把 Key 轮换保底 | `INDEX.md §三` `〔实测〕` |
| **`site:` 站内限定语法** | ❌ **不支持** | **AnySearch 不遵守 `site:` 语法**（会把 `site:xxx` 当普通关键词分词）；站内定向检索勿依赖 `site:` | `xiaohongshu.md:33` `〔实证教训〕` |
| **登录墙站点 `extract`** | ❌ 不可绕过 | 对小红书、脉脉等强登录墙站点，服务端 `extract` 同样无法绕过登录墙 | `xiaohongshu.md:27` `〔实测〕` |

## 三、当前状态、安全参数与防呆红线
- **当前状态**：🟢 可用
- **安全与容错红线**：
  1. 遇连续 **2 次 Connection Error / 429 / 403** 立即切换备用 Key 或改走其他搜索渠道，严禁死循环硬重试；
  2. 严禁将 `.env` 或 `_private/凭证.md` 中的三把 Key 明文打印到日志。

## 四、渠道升级与功能演进日志
- **2026-09-22 ~ 10-14 · 核定 `site:` 语法失效边界与一主两备 Key 机制**。

## 五、状态变化与故障/攻防时间线
- **2026-10-03 ~ 10-07 · 🟢 承接 Codex B2 调研搜索保底**：解决 Codex 内置 `web_search` 在 32 次运行中 6 次空返回的问题。

## 六、维护者（S3）挂账与待办
- 定期核验主 Key 额度水位。
