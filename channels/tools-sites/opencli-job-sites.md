---
channel_id: opencli-job-sites
name: OpenCLI · 招聘站点通道群 (51job / boss / maimai / nowcoder)
category: tool_site
maintainer: S3
status: 🟡 cooldown_degraded
upgrade_status: ✅ synced
verified_version: "opencli@1.8.8"
detected_version: "opencli@1.8.8"
holder: none
last_verified_at: "2026-10-14T12:30:00+08:00"
capabilities:
  observe_only: true
  external_session_read: false
  control_lifecycle: { start: true, resume: false, fork: false, stop: false }
  steer_in_turn: { in_turn: false, next_turn: false, inbox_file: false }
  coordinate_team: { spawn_subagent: false, peer_message: false, task_board: true }
---

# OpenCLI · 招聘与职场站点群 (`opencli-job-sites`) · 渠道能力与攻防维护档案卡

> **本机主状态卡同步源**：[`51job-search.md`](file:///C:/Users/COLORFIRE/.zcode/skills/opencli-poweruser/local/channel-state/channels/51job-search.md)、[`51job-detail.md`](file:///C:/Users/COLORFIRE/.zcode/skills/opencli-poweruser/local/channel-state/channels/51job-detail.md)、[`51job-company.md`](file:///C:/Users/COLORFIRE/.zcode/skills/opencli-poweruser/local/channel-state/channels/51job-company.md)、[`boss.md`](file:///C:/Users/COLORFIRE/.zcode/skills/opencli-poweruser/local/channel-state/channels/boss.md)、[`maimai.md`](file:///C:/Users/COLORFIRE/.zcode/skills/opencli-poweruser/local/channel-state/channels/maimai.md)、[`nowcoder.md`](file:///C:/Users/COLORFIRE/.zcode/skills/opencli-poweruser/local/channel-state/channels/nowcoder.md)

## 一、各招聘站点独立能力与状态矩阵
| 站点 / 子通道 | 状态 | 精确调用命令与安全间隔 | 核心能力边界与攻防现状 |
|---|---|---|---|
| **`51job search`** | 🟢 可用 | `chcp 65001 > $null; opencli 51job search "<kw>"`（间隔 $\ge 10\text{s}$） | **PowerShell 编码坑**：直接传中文若未切 UTF-8 代码页会变乱码导致 0 结果；切 `65001` 后完全正常 `〔实测〕` |
| **`51job detail`** | 🟢 可用 | `opencli 51job detail <jobId>`（间隔 $\ge 10\text{s}$） | 岗位 JD 正文与要求提取稳定 `〔实测〕` |
| **`51job company`** | 🟡 **待修 (`U08`)** | `opencli 51job company <encCoId>` | 1. `search` 返回的 `encCoId` 含连字符（此前被校验器拒绝，已修）；<br>2. 页面 DOM 公司名易误抓为 `"APP下载"`，当前显式 `COMMAND_EXEC` 阻断脏数据 `〔实测:T11/U08〕` |
| **`boss` (BOSS直聘)** | 🔴 **封禁勿碰** | **禁止调用 `opencli boss`** | 触发账号/IP 级强风控封禁，**全系统强制降级为 `AnySearch` + `51job search/detail`** `〔实测:🔴〕` |
| **`maimai` (脉脉)** | 🔒 **登录墙/403** | 暂停轮转 | 未登录或 Token 失效下返回 HTTP 403 `AUTH_REQUIRED`，与小红书匿名通道同属结构性关闭 `〔实测:🔒〕` |
| **`nowcoder` (牛客)** | 🟢 可用 | `opencli nowcoder <subcmd>`（间隔 $\ge 15\text{s}$） | 面经与求职讨论采集正常 `〔10-14实测〕` |

## 二、当前状态、安全参数与防呆红线
- **当前状态**：🟡 主力走 `51job search + detail` 与 `nowcoder`；`boss` 🔴 禁碰
- **绝对红线**：
  1. 任何智能体**严禁尝试调用 `opencli boss`**；
  2. 核验 51job 公司归属时，直接读取 `search/detail` 返回里的 `companyFull` 字段，不要调 `51job company`。

## 三、渠道升级与功能演进日志
- **2026-10-09 · `51job company` 输入契约修复**：放行含连字符 `encCoId`，并增加错误公司名 `"APP下载"` 的拦截保护。

## 四、状态变化与故障/攻防时间线
- **2026-10-07 ~ 10-09 · 🟡 离线复核 `51job` ID 契约 (`U08` / `T11`)**：留存证据于 `E:/program/GIT/media/opencli-poweruser/local/channel-repair/2026-10-09/`。

## 五、维护者（S3）挂账与待办
- [ ] **`[U08 / T11]`** 修复 `51job company` 页面真实公司名称选择器（负责人：S3）。
