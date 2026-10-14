---
channel_id: zhipu-glm
name: 智谱 GLM Coding Plan & Start Plan
category: model
maintainer: S6
status: 🟢 ok
upgrade_status: ✅ synced
verified_version: "paas-v4-coding"
detected_version: "paas-v4-coding"
holder: shared
last_verified_at: "2026-10-14T12:15:00+08:00"
capabilities:
  observe_only: true
  external_session_read: false
  control_lifecycle: { start: true, resume: false, fork: false, stop: false }
  steer_in_turn: { in_turn: false, next_turn: false, inbox_file: false }
  coordinate_team: { spawn_subagent: false, peer_message: false, task_board: false }
---

# 智谱 GLM (`zhipu-glm`) · 模型渠道能力与维护档案卡

## 一、渠道身份与接入入口
- **渠道定位**：日常高频调研、长文档合成与子代理并发主力（极快、成本低、夜间与非高峰优惠大）。
- **协议端点**：`https://open.bigmodel.cn/api/coding/paas/v4`
- **绑定宿主**：ZCode（内置 Start Plan + `~/.zcode/v2/provider_config.json`）、WorkBuddy（`--model glm-5.3`）。

## 二、独立能力矩阵（逐项核验记录）
| 能力项 | 支持度 | 已验证模型与特性 | 核验依据 |
|---|---|---|---|
| **主力推理与工具调用** | ✅ 极稳定 | `glm-5.3`、`GLM-5.3-Flash`（平均首包响应 ~1.0s） | `db.sqlite` `〔实测:39,070次调用〕` |
| **窗口限流自愈** | ✅ 自动退避 | 触发 5 小时滚动窗口 429（错误码 `1302/1113`）时，ZCode 内置指数退避可自愈 | `db.sqlite` `〔实测:640次rate_limited〕` |

## 三、当前状态、安全参数与防呆红线
- **当前状态**：🟢 可用
- **安全红线**：
  1. 注意偶发内容安全拦截错误码 `[1301]`（在 ZCode `compaction` 阶段曾出现 2 次因敏感词触发压缩失败），遇 `[1301]` 时需分段或脱敏处理；
  2. 严禁泄露 `~/.zcode/v2/provider_config.json` 与 `~/.workbuddy/models.json` 中的密钥。

## 四、渠道升级与功能演进日志
- **2026-10-02 ~ 10-14 · S6 最小请求探针 200 OK（耗时 1.02s）**。

## 五、状态变化与故障/攻防时间线
- **2026-09-15 ~ 10-14 · 🟡 累计 640 次 `rate_limited` 与 2 次 `compaction [1301]`**：整体成功率 >98%。

## 六、维护者（S6）挂账与待办
- 状态健康，无需额外操作。
