---
channel_id: tavily
name: Tavily AI 联网搜索与网页正文提取通道 (/search + /extract)
category: tool_site
maintainer: S3
status: 🟢 ok
upgrade_status: ✅ synced
verified_version: "tavily-rest-v1 (9-key-pool)"
detected_version: "tavily-rest-v1 (9-key-pool)"
holder: shared
last_verified_at: "2026-10-14T22:27:00+08:00"
capabilities:
  observe_only: true
  external_session_read: false
  control_lifecycle: { start: true, resume: false, fork: false, stop: false }
  steer_in_turn: { in_turn: false, next_turn: false, inbox_file: false }
  coordinate_team: { spawn_subagent: false, peer_message: false, task_board: false }
---

# Tavily (`tavily`) · 外部搜索与正文提取渠道能力与维护档案卡

## 一、渠道身份与接入入口
- **渠道定位**：专为 LLM / Agent 设计的**高配额主力联网搜索与 URL 正文清洗提取通道**（单 Key `1,000 Credits/月`，9 把 Key 轮换池共 **`9,000 Credits/月`**，支持搜索结果直出清洗后正文与 AI 综述回答，以及批量 URL Markdown 提取）。
- **管理面板**：`https://app.tavily.com/home`
- **凭证金库位置**：`channels/_private/sites.local.json`（`tavily.keys`，共 **9 把 Researcher Plan Key**；明文仅存于 `_private/`，严禁公开回显）。
- **9 把 Key 轮换池指纹清单（2026-10-14 实测全绿，全池剩余 `8,554 / 9,000` Credits）**：
  1. `ct` (`tvly-dev...xEso`) — `primary`（实测剩余 `554/1000`，已用 `446`）
  2. `ct1` (`tvly-dev...r7sa`) — `backup_1`（实测剩余 `1000/1000`）
  3. `github1` (`tvly-dev...ib2D`) — `backup_2`（实测剩余 `1000/1000`）
  4. `andrewdick` (`tvly-dev...QOpJ`) — `backup_3`（实测剩余 `1000/1000`）
  5. `ct2` (`tvly-dev...j4z2`) — `backup_4`（实测剩余 `1000/1000`）
  6. `msz` (`tvly-dev...5sJa`) — `backup_5`（实测剩余 `1000/1000`）
  7. `sdiu` (`tvly-dev...nzEf`) — `backup_6`（实测剩余 `1000/1000`）
  8. `2ct` (`tvly-dev...BtAL`) — `backup_7`（实测剩余 `1000/1000`）
  9. `cx` (`tvly-dev...EhLD`) — `backup_8`（实测剩余 `1000/1000`）

## 二、独立能力矩阵（逐项核验记录）
| 子能力项 | 支持度 | 实测结论与能力边界 | 核验依据 |
|---|---|---|---|
| **AI 联网搜索 (`POST /search`)** | ✅ 稳定可用 | `search_depth="basic"` 耗 **1 credit**（延迟 `~1.7s`），`"advanced"` 耗 **2 credits**；支持 `include_answer: true` 免费附带综述答案与 `include_raw_content` | `2026-10-14` `HTTP 200` `〔实测〕` |
| **域名定向过滤 (`include_domains`)** | ✅ 原生支持 | 传入 `"include_domains": ["github.com", "arxiv.org"]` 实现结构化站内限定检索，支持 `"exclude_domains"` 排除噪音站 | Tavily API v1 规范 |
| **批量网页正文提取 (`POST /extract`)** | ✅ **高性价比** | 传入 `"urls": [...]`（最多 20 个 URL），`basic` 模式**每成功提取 5 个 URL 仅扣 1 credit**（失败不扣费） | `2026-10-14` `HTTP 200` (`1394ms`) `〔实测〕` |
| **零损耗额度查询 (`GET /usage`)** | ✅ **0 Credit 消耗** | `GET https://api.tavily.com/usage`（Bearer 鉴权）实时返回 `key.usage` 与 `account.plan_usage / plan_limit`，不扣 Credit | `2026-10-14` 9 Key 全测通过 `〔实测〕` |

## 三、当前状态、安全参数与防呆红线
- **当前状态**：🟢 可用（全池剩余 `8,554 / 9,000` Credits/月）
- **标准调用范式**：
  ```powershell
  # 1. 零损耗查单 Key 剩余 Credits
  curl.exe -s -x http://127.0.0.1:7892 -H "Authorization: Bearer $TAVILY_KEY" "https://api.tavily.com/usage"

  # 2. 联网搜索（basic 模式 = 1 credit，带 AI 回答与域名过滤）
  curl.exe -s -x http://127.0.0.1:7892 -X POST "https://api.tavily.com/search" `
    -H "Content-Type: application/json" `
    -H "Authorization: Bearer $TAVILY_KEY" `
    -d '{"query":"OpenClaw ACP protocol","search_depth":"basic","max_results":5,"include_answer":true,"include_domains":["github.com"]}'

  # 3. 批量网页正文提取（每 5 个成功 URL = 1 credit）
  curl.exe -s -x http://127.0.0.1:7892 -X POST "https://api.tavily.com/extract" `
    -H "Content-Type: application/json" `
    -H "Authorization: Bearer $TAVILY_KEY" `
    -d '{"urls":["https://example.com"],"extract_depth":"basic"}'
  ```
- **安全与容错红线**：
  1. **默认优先用 `search_depth: "basic"`（1 Credit）**：除非深度调研明确需要高精度片段，勿默认开 `"advanced"`（翻倍扣 2 Credits）；
  2. **域名过滤优先用 `include_domains` 数组**：比在 `query` 字符串里拼 `site:` 更稳定；
  3. **自动轮换**：当单把 Key `plan_limit - plan_usage <= 20` 或遇 `HTTP 429 / 432`（配额耗尽）时，立即切换 `sites.local.json` 中下一把满额 Key（`ct1` ~ `cx`）。

## 四、渠道升级与功能演进日志
- **2026-10-14 · 初次建卡入库**：接入 9 把 Researcher Plan Key（每把 1,000 Credits/月，总计 9,000 Credits/月），完成 `/usage`、`/search`、`/extract` 三大端点实测，并集成至 `node hub/tools/agent_gateway.js quota`。

## 五、状态变化与故障/攻防时间线
- **2026-10-14T22:27+08:00 · 🟢 9 把 Key 全量验活通过**：`ct` 剩余 `554/1000`，其余 8 把（`ct1`、`github1`、`andrewdick`、`ct2`、`msz`、`sdiu`、`2ct`、`cx`）全部满额 `1000/1000`。

## 六、维护者（S3）挂账与待办
- 持续通过 `agent_gateway.js quota` 监控 `ct` 剩余额度，耗尽前平滑切换至 `ct1`。
