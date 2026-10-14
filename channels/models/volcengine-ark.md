---
channel_id: volcengine-ark
name: 火山方舟 Coding Plan (ark.cn-beijing.volces.com)
category: model
maintainer: S6
status: 🟢 ok
upgrade_status: ✅ synced
verified_version: "plan-v3"
detected_version: "plan-v3"
holder: shared
last_verified_at: "2026-10-14T12:15:00+08:00"
capabilities:
  observe_only: true
  external_session_read: false
  control_lifecycle: { start: true, resume: false, fork: false, stop: false }
  steer_in_turn: { in_turn: false, next_turn: false, inbox_file: false }
  coordinate_team: { spawn_subagent: false, peer_message: false, task_board: false }
---

# 火山方舟 (`volcengine-ark`) · 模型渠道能力与维护档案卡

## 一、渠道身份与接入入口
- **渠道定位**：高性价比批量解析、代码辅助与多模态 Embedding 备选主力（用户明确授权“随意使用”）。
- **协议端点**：
  - OpenAI 兼容：`https://ark.cn-beijing.volces.com/api/plan/v3`
  - Anthropic 兼容：`https://ark.cn-beijing.volces.com/api/plan`

## 二、独立能力矩阵（逐项核验记录）
| 能力项 | 支持度 | 已验证模型与特性 | 核验依据 |
|---|---|---|---|
| **代码与文本生成** | ✅ 原生支持 | `ark-code-latest`（探针响应 ~1.8s，200 OK） | `S6 requests.jsonl` `〔实测〕` |
| **多模态向量化** | ✅ 原生支持 | `doubao-embedding-vision` | `INDEX.md` `〔实测〕` |

## 三、当前状态、安全参数与防呆红线
- **当前状态**：🟢 可用
- **安全红线**：凭证统一由 `_private/凭证.md` 与环境变量管理，禁止明文硬编码。

## 四、渠道升级与功能演进日志
- **2026-10-02 ~ 10-14 · S6 最小请求探针验证 200 OK**。

## 五、状态变化与故障/攻防时间线
- 暂无异常故障记录。

## 六、维护者（S6）挂账与待办
- 可作为银子或 GLM 限流时的第一顺位降本备选路由。
