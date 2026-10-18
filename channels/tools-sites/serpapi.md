---
channel_id: serpapi
name: SerpApi 多引擎结构化搜索通道 (Google / Scholar / News / Patents)
category: tool_site
maintainer: S3
status: 🟢 ok
upgrade_status: ✅ synced
verified_version: "serpapi-rest-v1 (10-key-pool)"
detected_version: "serpapi-rest-v1 (10-key-pool)"
holder: shared
last_verified_at: "2026-10-14T22:27:00+08:00"
capabilities:
  observe_only: true
  external_session_read: false
  control_lifecycle: { start: true, resume: false, fork: false, stop: false }
  steer_in_turn: { in_turn: false, next_turn: false, inbox_file: false }
  coordinate_team: { spawn_subagent: false, peer_message: false, task_board: false }
---

# SerpApi (`serpapi`) · 外部搜索渠道能力与维护档案卡

## 一、渠道身份与接入入口
- **渠道定位**：全系统高精度 Google / Google Scholar / News / Patents 结构化搜索主力补充通道，**原生支持 `site:`、`filetype:`、`intitle:` 等高级搜索语法**（直接弥补 `anysearch` 不支持 `site:` 站内检索的短板）。
- **管理面板**：`https://serpapi.com/dashboard`
- **凭证金库位置**：`channels/_private/sites.local.json`（`serpapi.keys`，共 **10 把 Key**，单 Key 免费额度 `250 次/月`，全池合计 **`2,500 次/月`**；明文仅存于 `_private/`，严禁公开回显）。
- **10 把 Key 轮换池指纹清单（2026-10-14 实测全绿）**：
  1. `cosmostxy` (`44377178...b168`) — `primary`（实测 `249/250`）
  2. `andrewdick` (`13dd643a...bd0b`) — `backup_1`（实测 `250/250`）
  3. `ct2` (`5430a175...b136`) — `backup_2`（实测 `250/250`）
  4. `msz` (`57f849b9...c805`) — `backup_3`（实测 `250/250`）
  5. `sdiu` (`f4337069...5898`) — `backup_4`（实测 `250/250`）
  6. `2ct` (`afdd6880...8da1`) — `backup_5`（实测 `250/250`）
  7. `1ct` (`36eb43e3...8d1d`) — `backup_6`（实测 `250/250`）
  8. `cx` (`e19a851d...6d1c`) — `backup_7`（实测 `250/250`）
  9. `ct1` (`6de2d922...9034`) — `backup_8`（实测 `250/250`）
  10. `github1` (`8700c791...a1b8`) — `backup_9`（实测 `250/250`）

## 二、独立能力矩阵（逐项核验记录）
| 子能力项 | 支持度 | 实测结论与能力边界 | 核验依据 |
|---|---|---|---|
| **Google 网页搜索 (`engine=google`)** | ✅ 稳定可用 | 返回结构化 `organic_results`、`knowledge_graph`、`related_questions`，延迟 `~2.1s` | `2026-10-14` `HTTP 200` `〔实测〕` |
| **`site:` / `filetype:` 高级算子** | ✅ **原生支持** | 实测 `q=site:github.com modelcontextprotocol` 精准返回 GitHub 站内结果，完全解决 `anysearch` 分词失效问题 | `2026-10-14` `HTTP 200` `〔实测〕` |
| **学术与专利搜索 (`google_scholar` / `google_patents`)** | ✅ 稳定可用 | 支持 `engine=google_scholar`（含被引次数、PDF 链接、`as_ylo` 年份过滤）与 `engine=google_patents` | SerpApi 官方协议 |
| **零损耗余额查询 (`/account.json`)** | ✅ **0 配额消耗** | `GET https://serpapi.com/account.json?api_key=<KEY>` 实时返回 `total_searches_left` 与 `this_month_usage`，不扣次数 | `2026-10-14` 10 Key 全测通过 `〔实测〕` |
| **1 小时相同查询缓存** | ✅ **0 配额消耗** | 默认 `no_cache=false`，1 小时内完全相同的查询命中缓存不扣月度额度 | SerpApi 计费规则 |

## 三、当前状态、安全参数与防呆红线
- **当前状态**：🟢 可用（全池剩余 `2,499 / 2,500` 次/月，单账号限速 `250 次/小时`）
- **标准调用范式**：
  ```powershell
  # 1. 零损耗查单 Key 剩余次数
  curl.exe -s -x http://127.0.0.1:7892 "https://serpapi.com/account.json?api_key=$SERPAPI_KEY"

  # 2. Google 搜索（含 site: 高级语法、语言 hl=zh-cn、地区 gl=cn/us、条数 num=10）
  curl.exe -s -x http://127.0.0.1:7892 --get "https://serpapi.com/search.json" `
    --data-urlencode "engine=google" `
    --data-urlencode "q=site:github.com openclaw acpx" `
    --data-urlencode "num=10" `
    --data-urlencode "api_key=$SERPAPI_KEY"
  ```
- **安全与容错红线**：
  1. **严禁传 `no_cache=true`**：保持默认缓存机制以节省月度 250 次/Key 配额；
  2. **按需分级使用**：普通宽泛检索优先用 `tavily`（9,000 Credits/月）或 `anysearch`；需要 **`site:` 站内定向检索、Google 精确语法、`google_scholar` 学术检索** 时优先调 `serpapi`；
  3. **自动轮换**：当单把 Key `total_searches_left <= 5` 或返回 `HTTP 429` 时，自动切换 `sites.local.json` 中下一把备用 Key。

## 四、渠道升级与功能演进日志
- **2026-10-14 · 初次建卡入库**：接入 10 把 Free Plan Key（每把 250 次/月，总计 2,500 次/月），并集成至 `node hub/tools/agent_gateway.js quota` 实时巡检。

## 五、状态变化与故障/攻防时间线
- **2026-10-14T22:27+08:00 · 🟢 10 把 Key 全量验活通过**：`/account.json` 10/10 返回 `HTTP 200`，`cosmostxy` 实测 `site:github.com` 搜索 `HTTP 200`（`2163ms`）。

## 六、维护者（S3）挂账与待办
- 每次运行 `node hub/tools/agent_gateway.js quota` 时监控主 Key `cosmostxy` 余量，低于 10 次时轮换至 `andrewdick`。
