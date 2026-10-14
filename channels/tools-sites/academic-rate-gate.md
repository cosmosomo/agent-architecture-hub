---
channel_id: academic-rate-gate
name: 学术与代码公开接口全局节流闸 (7 接口)
category: tool_site
maintainer: S3
status: 🟢 ok
upgrade_status: ✅ synced
verified_version: "rate_gate-v1"
detected_version: "rate_gate-v1"
holder: shared
last_verified_at: "2026-10-14T12:15:00+08:00"
capabilities:
  observe_only: true
  external_session_read: false
  control_lifecycle: { start: true, resume: false, fork: false, stop: false }
  steer_in_turn: { in_turn: false, next_turn: false, inbox_file: false }
  coordinate_team: { spawn_subagent: false, peer_message: false, task_board: true }
---

# 学术与公开代码接口 (`academic-rate-gate`) · 渠道能力与维护档案卡

## 一、渠道身份与接入入口
- **渠道定位**：多智能体并发检索学术文献与开源仓库时的跨进程全局限流协调器（防止多个子智能体同时打爆 arXiv / Semantic Scholar 触发本机出口 IP 封禁）。
- **控制入口**：
  - 节流脚本：`python E:\program\sota\code\rate_gate.py wait <channel>`
  - 全局冷却：`python E:\program\sota\code\rate_gate.py cooldown <channel> <seconds>`
  - 状态查看：`python E:\program\sota\code\rate_gate.py status`
  - 共享锁文件目录：`E:\program\sota\协作环境\渠道锁\*.json`

## 二、独立能力矩阵与各接口安全间隔
| 子接口代号 | 状态 | 强制最小间隔 | 单轮批量建议 | 核验依据 |
|---|---|---|---|---|
| `arxiv` | 🟢 可用 | **$\ge 3\text{s}$** | $\le 20$ 篇/轮 | 官方 API ToS + `渠道协调规则.md` `〔实测〕` |
| `semanticscholar` | 🟢 可用 | **$\ge 5\text{s}$** | 优先用 batch 接口 | 无 Key 极易 429 `〔实测〕` |
| `openalex` | 🟢 可用 | **$\ge 1\text{s}$** | 支持 `mailto:` 礼貌池 | 响应最稳 `〔实测〕` |
| `crossref` | 🟢 可用 | **$\ge 1\text{s}$** | DOI 元数据核验首选 | `渠道协调规则.md` `〔实测〕` |
| `dblp` | 🟢 可用 | **$\ge 2\text{s}$** | 计算机顶会检索 | `渠道协调规则.md` `〔实测〕` |
| `acl` | 🟢 可用 | **$\ge 2\text{s}$** | NLP 论文检索 | `渠道协调规则.md` `〔实测〕` |
| `github` (未认证) | 🟡 严限 | **$\ge 60\text{s}$** | 60 次/小时硬上限 | 优先带 `gh` 认证或 git 浅克隆 `〔实测〕` |

## 三、当前状态、安全参数与防呆红线
- **当前状态**：🟢 可用
- **绝对红线**：
  1. **调用前必跑 `rate_gate.py wait <接口>`**；
  2. **一人遇 429，全员停 10 分钟**：任何智能体收到 HTTP 429 或 `Retry-After`，必须立即执行 `python E:\program\sota\code\rate_gate.py cooldown <接口> 600`，严禁私自 sleep 几秒继续硬撞。

## 四、渠道升级与功能演进日志
- **2026-10-01 ~ 10-14 · `rate_gate.py` 跨进程锁稳定运行**。

## 五、状态变化与故障/攻防时间线
- 暂无本机 IP 级永久封禁事件。

## 六、维护者（S3）挂账与待办
- 监控 `协作环境/渠道锁/*.json` 的冷却状态。
