# 研究报告：Codex 经 acpx 新建会话耗时、超时根因与分步实测

> **报告文件**：`channels/probe/results/agy-pro-codex-slow-open-20261018.md`  
> **测试员**：`antigravity-pro`  
> **测试日期**：2026-10-18  
> **认知入口与术语基准**：严格遵循 `channels/README.md`，使用项目统一词汇（前端、后端、适配器、各家；能力渠道、登录态、供应商；以本地落地数据为唯一真源）。

---

## 〇、结论摘要（大白话）

1. **慢的根因完全不在“新建会话”（`sessions ensure` 或 `thread/start`），而在“模型请求轮次”（`prompt`）**：
   实测直连 `codex app-server` 的 `thread/start` 新建线程仅耗时 **0.14～0.48 秒**；经 `acpx codex sessions ensure` 完成 Node 运行时拉起、插件加载、JSON-RPC 握手与落盘，耗时稳定在 **13.9～14.7 秒（平均 14.3 秒）**。新建会话本身从未出现过“几分钟”的现象。
2. **耗时几分钟甚至打爆 240 秒门禁的致命根因，是上游模型供应商连续报错触发了 Codex 本地 5 轮长重试**：
   Codex 在 `~/.codex/config.toml` 中配置了网络韧性参数（`stream_max_retries = 5, request_max_retries = 4`）。当前生效的“混池”供应商（`api.aizzz.xyz`）存在严重故障：
   - 用户与网关默认指定的 `gpt-6-luna` 在该供应商中**根本未开通**，直接返回 `HTTP 503 Service Unavailable: No available channel for model gpt-6-luna`；
   - 自动化复测脚本 `verify_open_resume.js` 使用的 `gpt-5.6-sol` 以及主力 `gpt-6.1-sol` 则全量返回 `HTTP 502 Bad Gateway`；
   - 遭遇 502/503 时，Codex 误认为是网络闪断，强制执行 5 次重连（`Reconnecting 1/5` 到 `5/5`）。503 快速失败时 5 轮累计耗时 **50～75 秒**；502 网关超时重试时 5 轮累计高达 **183.04 秒（3 分 03 秒）**！
3. **为什么复测会表现为“超过 240 秒没有结果”**：
   - 脚本 `verify_open_resume.js` 设定的单次 HTTP 请求超时为 240 秒（`timeoutMs: 240000`）。在测 `gpt-5.6-sol` 时，由于单轮 5 次重试耗时 183 秒，若包含第二轮（resume）或网络稍微抖动（183s + 183s = 366s），必定突破 240 秒硬门禁；
   - 此外，在 Hub 服务刚启动的 164 秒内，后台主线程正在同步执行 775 个会话的检索索引重建（`search.sync()`），导致 Node.js 事件循环被卡死，HTTP 请求在队列中白白等待达 **126 秒**。排队 126 秒 + Codex 5 重试 76 秒 = **202 秒**，极易直接超时中断。
4. **后端判据存在严重漏洞，把报错当成功**：
   Codex 在 5 轮重试全部耗尽后，将 502/503 报错文本作为消息正文输出，并标记 `stopReason: "end_turn"`。后端的 `judgeAcpxTurn()` 只要看到 `end_turn` 就判定为成功（`status: 'completed'`），导致错误文本被当作正常回复返回给上层，测试断言失败。

---

## 一、分步计时与对照实测表

本节对各个入口、各个阶段执行至少 3 次重复计时测试，命令行均挂载本机代理 `HTTP_PROXY=http://127.0.0.1:7892` 与 `HTTPS_PROXY=http://127.0.0.1:7892`。

### 1.1 直连基准对照：`codex app-server` 原生协议控制

通过 JSON-RPC 2.0 stdio 直接向 `codex.exe app-server` 发送 `initialize`、`thread/start` 和 `turn/start`，精确测量每个协议阶段的耗时：

| 轮次 | 模型 | `initialize` (握手) | `thread/start` (建会话) | `turn/start` (模型轮次) | 总耗时 | 结果与重连次数 |
|---|---|---|---|---|---|---|
| **第 1 次** | `gpt-6-luna` | 829 ms | 484 ms | 84,681 ms | 86,657 ms (86.7s) | `completed`（重试 5/5，返回 503 报错） |
| **第 2 次** | `gpt-6-luna` | 427 ms | 214 ms | 45,710 ms | 46,358 ms (46.4s) | `completed`（重试 5/5，返回 503 报错） |
| **第 3 次** | `gpt-6-luna` | 335 ms | 143 ms | 44,581 ms | 45,064 ms (45.1s) | `completed`（重试 5/5，返回 503 报错） |

> **对照结论**：Codex 原生建立会话（`thread/start`）仅需 **0.14～0.48 秒**。耗时 99% 消耗在 `turn/start` 触发模型推理后的 5 次断网重试上。

### 1.2 直连基准对照：`codex exec` 一次性命令行

在 `C:\Users\COLORFIRE\hub-workspaces` 目录下，标准输入重定向关闭（`< nul`），执行 `codex exec`：

| 轮次 | 命令行参数 | 开始时间 | 结束时间 | 耗时 | 结果状态与原始输出特征 |
|---|---|---|---|---|---|
| **第 1 次** | `codex exec -m gpt-6-luna --json "只回复'收到'。"` | 2026-10-18 02:40:00 | 2026-10-18 02:40:56 | 55,508 ms | `turn.failed` (HTTP 503: No available channel) |
| **第 2 次** | `codex exec -m gpt-6-luna --json "只回复'收到'。"` | 2026-10-18 02:40:56 | 2026-10-18 02:41:46 | 49,773 ms | `turn.failed` (HTTP 503: No available channel) |
| **第 3 次** | `codex exec -m gpt-6-luna --json "只回复'收到'。"` | 2026-10-18 02:41:46 | 2026-10-18 02:42:33 | 47,169 ms | `turn.failed` (HTTP 503: No available channel) |
| **对照组** | `codex exec -m gpt-5.6-sol --json "只回复'收到'。"` | 2026-10-18 02:43:24 | 2026-10-18 02:46:27 | **183,042 ms** (183.0s) | `turn.failed` (HTTP 502: Bad Gateway，Reconnecting 1/5..5/5) |

> **对照结论**：复测脚本中使用的 `gpt-5.6-sol` 在中转端返回 502 Bad Gateway，触发了 5 次长达 36 秒的网关重试，单次运行直接耗费 **183 秒**！

### 1.3 `acpx codex sessions ensure` 独立新建会话耗时（3 次全新测试）

命令：`acpx --format json --cwd "C:\Users\COLORFIRE\hub-workspaces" --model gpt-6-luna codex sessions ensure --name <sessionName> < nul`

| 轮次 | 会话名（`probe-`） | 开始时间 (UTC) | 结束时间 (UTC) | 耗时 (ms) | `acpxRecordId` | 底层 Codex 线程 ID |
|---|---|---|---|---|---|---|
| **第 1 次** | `probe-bench-rep-1-c273af91` | 03:09:48.083 | 03:10:02.397 | 14,320 ms (14.3s) | `53c4992b-a2b1-4c18-a8e0-8fcf1614daf3` | `01a14b45-40c6-7c12-95d4-00c74f36c6a7` |
| **第 2 次** | `probe-bench-rep-2-1992a5fc` | 03:10:02.444 | 03:10:17.145 | 14,700 ms (14.7s) | `3a52f40a-3537-4c77-8f1e-f42fbf0faa0a` | `01a14b45-77ed-7980-b209-8183e319e0b9` |
| **第 3 次** | `probe-bench-rep-3-f0a020a3` | 03:10:17.169 | 03:10:31.086 | 13,917 ms (13.9s) | `341bdb08-d60e-4f27-bce0-3ea494016e42` | `01a14b45-b1bb-71c1-8dd5-314e1bd7ee54` |

> **实测结论**：经 `acpx` 新建 Codex 会话耗时稳定在 **13.9～14.7 秒**。耗时主要分布在 Node 进程初始化、拉起 `@agentclientprotocol/codex-acp` 桥、桥拉起 `codex app-server`、加载 11 个内置插件及 MCP 服务配置，以及写入 `~/.acpx/sessions/`。这一步**绝不需要几分钟**。

### 1.4 `acpx codex prompt` 轮次耗时实测

对已建立的 `probe-bench-debug-1` 会话发送提示词：`echo hello | acpx --format json --approve-reads --timeout 3600 --cwd "C:\Users\COLORFIRE\hub-workspaces" --model gpt-6-luna codex prompt -s probe-bench-debug-1 -f -`

| 阶段 | 耗时 | 输出事件与特征 |
|---|---|---|
| 设置模型 (`session/set_config_option`) | < 1,000 ms | 成功将 model 置为 `gpt-6-luna` |
| 模型提示词 (`session/prompt`) | **64,000 ms** (64s) | 触发 5 次 `Reconnecting...`，上游返回 503，最后以 `stopReason: "end_turn"` 结束 |

### 1.5 Hub 后端 `/api/gateway/send` 完整链路实测（端口 8941）

通过测试服务 `http://127.0.0.1:8941/api/gateway/send` 测试完整流程：

| 场景 | 会话名 | 首轮新建 (`open`) 耗时 | 第二轮恢复 (`resume`) 耗时 | 现象与日志分析 |
|---|---|---|---|---|
| **冷启动期（与服务索引重建撞车）** | `probe-gw-codex-mvcriotr` | **202,391 ms** (202.4s) | 61,080 ms (61.1s) | 服务启动时执行 `search.sync()` 重建 775 个会话耗费 164.4s，导致 HTTP 请求排队等待 126s 后才进入 `startRunInternal`；Codex 执行 75.9s。 |
| **热态正常（索引构建完毕）** | `probe-gw-codex-mvcrpch9` | **66,501 ms** (66.5s) | **49,831 ms** (49.8s) | `sessions ensure` 耗费不到 1 秒（会话创建与调度无瓶颈），Codex 执行 prompt 耗费 66.1s（重试 5 次 503 报错）。 |

---

## 二、根因剖析与详细证据

### 2.1 根因一：混池中转站渠道故障与模型配置漂移（首要瓶颈，耗时 50～183 秒）

通过直接向中转端 `https://api.aizzz.xyz/v1` 进行接口探测（挂载代理 `http://127.0.0.1:7892`），查明上游中转站存在严重状态异常：

1. **`gpt-6-luna` 根本不存在**：
   - 查询 `GET /v1/models` 返回当前中转站登记的模型仅有 5 个：
     ```text
     codex-auto-review
     gpt-5.6-sol
     gpt-6-astra
     gpt-6-sol
     gpt-6.1-sol
     ```
   - 请求 `gpt-6-luna` 时，中转站直接返回 HTTP 503：
     ```json
     {
       "error": {
         "code": "model_not_found",
         "message": "No available channel for model gpt-6-luna under group GPT混池 (distributor) (request id: 202610171848424168209448268d9d6XK7C2Xga)",
         "type": "new_api_error"
       }
     }
     ```
2. **现存模型全线返回 `502 Bad Gateway`**：
   - 对 `gpt-6.1-sol`、`gpt-6-sol`、`gpt-6-astra`、`gpt-5.6-sol`、`codex-auto-review` 发送测试请求，上游均返回 `HTTP/1.1 502 Bad Gateway (error code: 502)`。

### 2.2 根因二：Codex 本地重试机制将 502/503 放大 5 倍

在 `C:\Users\COLORFIRE\.codex\config.toml` 中，为防止网络断流配置了重试参数：
```toml
request_max_retries = 4
stream_max_retries = 5
```
当上游接口返回 502 或 503 时，Codex 并不立即报错退出，而是视为可恢复的断流，强制执行 5 轮指数退避重试。
- **503 报错重试**：单次重试约 8～12 秒，5 次重试累计 **50～75 秒**。
- **502 报错重试**：Cloudflare / Nginx 网关等待上游超时单次约 36 秒，5 次重试累计 **183 秒**。

**原始事件流证据（来自 `acpx prompt` 原始 NDJSON 输出）**：
```json
{"jsonrpc":"2.0","method":"session/update","params":{"update":{"_meta":{"codex":{"error":{"message":"Reconnecting... 1/5","codexErrorInfo":{"responseStreamDisconnected":{"httpStatusCode":503}},"willRetry":true}}}}}}
{"jsonrpc":"2.0","method":"session/update","params":{"update":{"_meta":{"codex":{"error":{"message":"Reconnecting... 2/5","willRetry":true}}}}}}
{"jsonrpc":"2.0","method":"session/update","params":{"update":{"_meta":{"codex":{"error":{"message":"Reconnecting... 3/5","willRetry":true}}}}}}
{"jsonrpc":"2.0","method":"session/update","params":{"update":{"_meta":{"codex":{"error":{"message":"Reconnecting... 4/5","willRetry":true}}}}}}
{"jsonrpc":"2.0","method":"session/update","params":{"update":{"_meta":{"codex":{"error":{"message":"Reconnecting... 5/5","willRetry":true}}}}}}
```

### 2.3 根因三：自动化复测脚本的 240 秒超时门禁被击穿

在测试脚本 `channels/probe/scripts/P0/verify_open_resume.js` 中：
```javascript
18: const send = (body) =>
19:   fetch(BASE + '/api/gateway/send', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...body, wait: true, timeoutMs: 240000 }) })
```
- 该脚本在调用 `codex` 时使用了 `gpt-5.6-sol`（第 14 行：`['codex', 'gpt-5.6-sol']`）；
- 单轮重试耗时即高达 183 秒；如果发生任何细微排队（如首轮新建目录耗时、`acpx ensure` 的 14 秒），或者执行第二轮（183s + 183s = 366s），总耗时必然超过 240,000 ms，直接导致脚本抛出超时异常，表现为“超过 240 秒没有结果”。

### 2.4 根因四：后端 `judgeAcpxTurn` 误判错误为正常完成

在 `trace/apps/cli/src/gateway.ts:4439` 中：
```typescript
    if (run.error) return { status: 'failed', error: run.error };
    const stop = run.stopReason;
    if (stop === 'end_turn' || stop === 'max_tokens' || stop === 'max_turn_requests') return { status: 'completed' };
```
- Codex 在 5 次重试均告失败后，会通过 `agent_message_chunk` 吐出错误文本：`unexpected status 503 Service Unavailable...`；
- 随后发出的协议结果中，Codex 将其标记为正常的 `stopReason: "end_turn"`；
- 后端直接判定该轮为 `completed`，并把错误文本作为正常模型回复赋予 `reply`；
- 导致前端/脚本显示“成功完成”，但回复内容实际是 503 报错，暗号核验必然失败。

### 2.5 根因五：服务冷启动时检索索引构建阻塞主线程（偶发叠加，耗时 120～160 秒）

在 `trace/apps/cli/src/main.ts:140` 中：
```typescript
scan(store)
  .then(() => search.sync(store.files(), (f) => store.parseSource(f)))
  .then((r) => { if (r.indexed || r.removed) console.log('检索索引就绪：重建 ' + r.indexed + ' 个会话，用时 ' + (r.ms / 1000).toFixed(1) + ' 秒'); })
```
- `search.sync()` 在主线程中同步解析 775 个会话文件并写入 SQLite，本次实测实载耗时为 **164.4 秒**；
- 在这 164 秒期间，Node.js 主事件循环受到显著饥饿，刚刚启动服务就发起的 HTTP 请求会在 TCP / 事件队列中积压等待达 126 秒，与 Codex 的 75 秒重试叠加后达到 **202 秒**，严重时直接触发调用方超时。

---

## 三、修复与绕开建议（改动点指南，未改动仓库源码）

> **注**：严格遵守测试规范，本报告仅指出定位与建议修改位置，未对仓库中任何源码做修改与提交。

### 建议 1：修复 `verify_open_resume.js` 的测试模型与超时策略

- **目标文件**：`channels/probe/scripts/P0/verify_open_resume.js`
- **问题行**：第 14 行 `['codex', 'gpt-5.6-sol']`
- **建议**：
  1. `gpt-5.6-sol` 在当前中转站返回 502 且属于老旧模型，而 `gpt-6-luna` 在该中转站未配置。在中转站修复或切换有效供应商之前，不宜直接跑多轮重试；
  2. 若要验证通道连通性，应使用中转站确认可用的模型，或者切换至健康的供应商；
  3. `verify_open_resume.js` 应该对 `open` 和 `resume` 设定独立的超时，而不是两轮共用粗放的大超时。

### 建议 2：修复 `gateway.ts` 的 Codex 错误吞噬与误判漏洞

- **目标文件**：`trace/apps/cli/src/gateway.ts`
- **位置**：`judgeAcpxTurn()`（约第 4426 行～4450 行）
- **修改建议**：
  在依据 `stopReason === 'end_turn'` 放行之前，增加对输出内容的错误特征防御与 `_meta` 状态拦截：
  ```typescript
  // 检查 Codex 特有的系统报错特征（防止 502/503 重连失败被当成正常完成）
  if (run.channel === 'codex' && run.text) {
    if (/unexpected status 50\d|No available channel for model|error code: 502/i.test(run.text)) {
      return { status: 'failed', error: `Codex 模型上游调用失败: ${run.text.trim().slice(0, 150)}` };
    }
  }
  ```

### 建议 3：在 `CHANNEL_PROFILES` 中纠正推荐模型

- **目标文件**：`trace/apps/cli/src/gateway.ts`
- **位置**：`CHANNEL_PROFILES.codex`（约第 129～130 行）
- **建议**：
  检查 `defaultModel: 'gpt-6-luna'`。既然当前中转站没有 `gpt-6-luna`，默认发起 `gpt-6-luna` 会百分之百触发 503 重试风暴。建议与当前生效的供应商清单保持一致（或由配置驱动动态获取）。

### 建议 4：解耦服务启动时的全量检索构建，避免主循环饿死

- **目标文件**：`trace/apps/cli/src/main.ts`
- **位置**：第 139～142 行 `scan(store).then(() => search.sync(...))`
- **建议**：
  `search.sync()` 同步耗费 164 秒，应当采用批处理分片（`setImmediate` 分批）或放入 Worker 线程中运行，绝不能在启动时直接阻塞主事件循环，导致任何刚刚建立的会话请求在入口处无辜排队 2 分钟。

---

## 四、测试会话台账

本次调查研究期间新建的所有测试会话均严格以 `probe-` 开头，未向任何真实用户会话注入消息，记录如下：

| 会话名称 (Session Name) | 关联底层/ACPX 编号 | 测试用途 | 最终状态 |
|---|---|---|---|
| `probe-bench-ensure-1` | `0683205f-23a0-4935-a0db-f22a649939eb` / thread `01a14b32-6569-73f0-98a2-8624c0634d73` | acpx ensure 独立计时首测 | 已落盘待命 |
| `probe-bench-debug-1` | `01ed3bd9-351b-4254-8299-1aa1a9dd7ac9` / thread `01a14b39-d1e2-7c42-aa13-d71d2917294e` | acpx prompt 逐事件跟踪测试 | 已落盘待命 |
| `probe-bench-rep-1-c273af91` | `53c4992b-a2b1-4c18-a8e0-8fcf1614daf3` / thread `01a14b45-40c6-7c12-95d4-00c74f36c6a7` | ensure 3 次重复测第 1 轮 | 已落盘待命 |
| `probe-bench-rep-2-1992a5fc` | `3a52f40a-3537-4c77-8f1e-f42fbf0faa0a` / thread `01a14b45-77ed-7980-b209-8183e319e0b9` | ensure 3 次重复测第 2 轮 | 已落盘待命 |
| `probe-bench-rep-3-f0a020a3` | `341bdb08-d60e-4f27-bce0-3ea494016e42` / thread `01a14b45-b1bb-71c1-8dd5-314e1bd7ee54` | ensure 3 次重复测第 3 轮 | 已落盘待命 |
| `probe-gw-codex-mvcriotr` | `codex:01a14b3f-a3bd-74e1-b774-88007add352d` | 后端 `/api/gateway/send` 冷启动撞车测试 | 已落盘待命 |
| `probe-gw-codex-mvcrpch9` | `codex:01a14b42-604b-7190-8936-bd5c5069393a` | 后端 `/api/gateway/send` 热态标准测试 | 已落盘待命 |
| 原生线程对照组 | thread `01a14b2d-0fd3-7842-8483-29880b974a02` | `codex exec` 直连 502 重试对照（耗时 183s） | 已落盘（本地 sessions） |

