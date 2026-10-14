---
channel_id: yinzi-api
name: 银子智能模型中转渠道 (api.yinziapi.top)
category: model
maintainer: S6
status: 🟢 ok
upgrade_status: ✅ synced
verified_version: "v1-responses-chat"
detected_version: "v1-responses-chat"
holder: shared
last_verified_at: "2026-10-14T12:15:00+08:00"
capabilities:
  observe_only: true
  external_session_read: false
  control_lifecycle: { start: true, resume: false, fork: false, stop: false }
  steer_in_turn: { in_turn: false, next_turn: false, inbox_file: false }
  coordinate_team: { spawn_subagent: false, peer_message: false, task_board: false }
---

# 银子智能 (`yinzi-api`) · 模型渠道能力与维护档案卡

## 一、渠道身份与接入入口
- **渠道定位**：全模型主力推理渠道（不限 Codex，ZCode / Claude Code / OpenCode 均可挂载）。
- **协议端点**：`https://api.yinziapi.top/v1`（支持 OpenAI `/v1/responses` 与 `/v1/chat/completions`）；管理后台 `https://yinziapi.top`。
- **配置绑定位置**：`~/.cc-switch/cc-switch.db`（Codex 当前激活源 `0684a63e-...`）；凭证引用见 `E:\program\sota\协作环境\_private\凭证.md`（**严禁在此回显 Key 明文**）。

## 二、独立能力矩阵（逐项核验记录）
| 能力项 | 支持度 | 已验证模型与特性 | 核验依据 |
|---|---|---|---|
| **OpenAI Responses 协议** | ✅ 原生支持 | `gpt-6.1-sol`（主力）、`gpt-6-luna`（轻活）支持 `reasoning_effort`、工具调用、流式输出 | `S6 requests.jsonl` `〔实测:200 OK〕` |
| **国产旗舰模型池** | ✅ 广泛支持 | `glm-5.3`、`deepseek-v4.1-flash` 等 | `INDEX.md` `〔用户核定〕` |
| **额度查询与熔断** | ⚠️ 需区分 | 管理后台 Session Token 与推理 API Key 权限分立，推理 Key 直接调余额接口会返 401/403 | `S6/当前.md` `〔实测〕` |

## 三、当前状态、安全参数与防呆红线
- **当前状态**：🟢 可用
- **三大安全红线**：
  1. **必须走本地代理 `http://127.0.0.1:7892`**：直连在高并发下必发 `stream disconnected before completion` 断流风暴；
  2. **遇到连续 HTTP 403 立即停机熔断**：代表账户余额或配额耗尽（如 10-07 14:59 事件），严禁继续盲目重派任务空转；
  3. **严禁回显 Key 明文**：`S6` 探针日志只记录 HTTP 状态码、延迟与脱敏指纹。

## 四、渠道升级与功能演进日志
- **2026-10-02 ~ 10-14 · S6 最小请求探针验收通过**。

## 五、状态变化与故障/攻防时间线
- **2026-10-07 14:59 · 🔴->🟢 账户额度耗尽全返 HTTP 403**：导致 AP-Vibe 在跑 Codex 任务全部中断，触发 `leader-pause-20261007` 排空暂停；补充额度后恢复。

## 六、维护者（S6）挂账与待办
- [ ] 在观察台 `analysis.js` 中对连续 $\ge 3$ 次 HTTP 403 / `stream disconnected` 自动触发渠道级熔断告警。
