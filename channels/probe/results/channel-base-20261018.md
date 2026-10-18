# 底座能力渠道深度研发报告：单调用选渠道、额度用量、健康熔断、并发租约与宿主排空

> **文档定位**：系统底座层（Base & Capability Channels）适配边界拓展与技术规范  
> **研发日期**：2026-10-18  
> **涉及能力单元**（来源：[`hub/data/capability-units.json`](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/hub/data/capability-units.json)）：  
> - `channel-route`：按每次调用选渠道（只给这一次调用换中转或 key，全局配置不动）  
> - `quota`：查额度与用量（查整条渠道或账号池的剩余额度与窗口）  
> - `channel-health`：渠道健康与熔断（看到渠道可用性与最近失败类别，并能据此停用）  
> - `channel-lease`：并发租约（调用有并发或频次上限的渠道前先拿租约，超出上限排队，崩溃后自动释放）  
> - `host-drain`：宿主排空（停止接新活、等在跑的轮次做完再退出，新活暂存）  
> **安全与合规约束**：恪守全权限运行规范；严格执行“只读不改 CC-Switch 账号设置”；**所有 API Key 与凭据一律脱敏，绝不进报告与黑板**；不修改 `trace/`、`m/`、`hub/` 业务源码。

---

## 一、核心研发结论与事实定界（一页纸总览）

通过对本机 7 大智能体宿主（Claude Code、Codex、Antigravity、ZCode、WorkBuddy、OpenCode、Hermes）原生协议、配置体系与落盘账本的交叉实测验证，底座能力渠道的核心事实边界如下：

1. **单次调用选渠道（`channel-route`）全线证实**：
   - **Codex** 原生在 `thread/start` / `thread/resume` 开放 `modelProvider` 与 `config: {"model_providers.<id>.*": ...}`，单会话/单调用分流至专属中转站，全局 `config.toml` 零污染；
   - **Claude Code** 原生支持 `--settings '{"env":{"ANTHROPIC_BASE_URL":"...","ANTHROPIC_AUTH_TOKEN":"..."}}'` 单进程覆盖，进程退出即失效，完全规避 `settings.json` 全局污染；
   - **ZCode** 与 **WorkBuddy** 原生通过 `--model` 传入前缀（ZCode 的 `provider\model`、WorkBuddy 的 `custom-local:*`）实现第三方与本地 PAAS 渠道覆盖；
   - **OpenCode** 与 **Hermes** 原生支持 CLI flag（OpenCode `-m provider/model`、Hermes `--provider`）；
   - **Antigravity** 仅支持切模型档位（flash/pro/lite），凭证与渠道强绑定官方 OAuth 登录态，不支持换第三方中转。
2. **查额度（`quota`）存在“真剩余额度 vs 本地历史账本”的本质分野**：
   - **真剩余额度（Remaining Quota & Window）**：仅 **Antigravity**（Connect-RPC `RetrieveUserQuotaSummary`，8 位小数比例 + 重置时间戳）与 **Codex**（官方 OAuth 下 `account/rateLimits/read`，5h/7d 窗口百分比）原生支持；
   - **本地消费账本（Local Consumption Ledger）**：**WorkBuddy**（`workbuddy.db` 之 `session_usage.credit_json` 记录逐笔 Credits 扣费）、**ZCode**（`db.sqlite` 之 `model_usage`）、**OpenCode**（`session.cost`）均只记录“花了多少”，无法从客户端探知供应商“还剩多少”；
   - **第三方渠道锁死**：Codex 对第三方 Key 调用 `account/rateLimits/read` 强报 `-32600 codex account authentication required`，必须由中枢直接调用供应商 Balance API。
3. **渠道健康与并发租约必须由中心当宿主收口**：
   - 原生客户端普遍**没有跨进程并发租约机制**（Hermes 内部具备子任务凭证借出，其余均为 0）；多智能体并发调用上游极易引发 HTTP 429 风暴；
   - 渠道健康上各家仅抛出单次错误（429、529、401、`willRetry`），无跨会话自动熔断与流量转移能力，必须由中心建立分布式信号灯与熔断器。

---

## 二、各产品原生开放能力深度实测证据

### 2.1 Claude Code（Anthropic）

| 维度 | 原生入口与机制 | 真实配置 / 参数 / 接口 | 证据位置与实测事实 |
|---|---|---|---|
| **按调用选渠道** (`channel-route`) | CLI 参数 `--settings` 动态注入 | `claude -p --settings '{"env":{"ANTHROPIC_BASE_URL":"https://...","ANTHROPIC_AUTH_TOKEN":"[REDACTED]"}}'` | [`channels/probe/results/agy-fact-claude-20261018.md:31`](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/channels/probe/results/agy-fact-claude-20261018.md#L31)；实测请求 3.6s 命中指定中转，全局 `~/.claude/settings.json` 无改动 |
| **查额度与用量** (`quota`) | 命令行 `/usage` 与转录账本 | `/usage` 命令；会话记录 `usage: { input_tokens, output_tokens }` | [`agy-fact-claude-20261018.md:111-118`](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/channels/probe/results/agy-fact-claude-20261018.md#L111-L118)；官方态显示 5h/7d 滑窗；第三方中转仅能按 token 计算花费，`<total_tokens>15000000 tokens left</total_tokens>` 仅为上下文容量提示 |
| **健康与熔断** (`channel-health`) | 错误事件流与自检命令 | `claude doctor`；流式响应下发结构化错误码（`rate_limit_error`, `overloaded_error`, `authentication_error`） | CLI 输出包含 Commit、Search bundle 及 Remote 诊断；无自动换渠道机制 |
| **并发租约** (`channel-lease`) | 无原生跨进程租约 | 仅单进程内部顺序执行 | 多个终端同时起 `claude` 相互不知晓并发数，触碰限频直接报错退出 |
| **宿主排空** (`host-drain`) | 进程信号管理 | `SIGINT` / `Escape` 触发中断与上下文回写 | 强杀子进程会导致最后一步工具产物丢失与 `sessions` 索引未标记 closed |

> **CC-Switch 协同规约**：  
> CC-Switch 将当前激活供应商写入 `~/.claude/settings.json`。中枢在调用 Claude Code 时，若需使用 CC-Switch 当前供应商，则直接启动子进程；若需指定特定伙伴渠道，则使用 `--settings` 注入环境覆盖，**绝不写入 `settings.json`**。

---

### 2.2 Codex（OpenAI）

| 维度 | 原生入口与机制 | 真实配置 / 参数 / 接口 | 证据位置与实测事实 |
|---|---|---|---|
| **按调用选渠道** (`channel-route`) | App-Server JSON-RPC | `thread/start` / `thread/resume` 入参：`modelProvider: "custom"`, `config: {"model_providers.custom.base_url": "...", "model_providers.custom.wire_specification": "openai"}` | [`channels/probe/results/agy-fact-codex-20261018.md:18,36`](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/channels/probe/results/agy-fact-codex-20261018.md#L18)；[`codex_app_server.ts:76`](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/trace/apps/cli/src/drivers/codex_app_server.ts#L76)；实测单会话分流成功，`config.toml` 零改动 |
| **查额度与用量** (`quota`) | App-Server RPC 接口 | `account/rateLimits/read` 与 `account/usage/read`；推送事件 `account/rateLimits/updated` | [`agy-fact-codex-20261018.md:89-95`](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/channels/probe/results/agy-fact-codex-20261018.md#L89-L95)；官方 Team 登录态返回 5h 剩余 34%、7d 剩余 59%；第三方 Key 必定抛出 `-32600 codex account authentication required` |
| **健康与熔断** (`channel-health`) | 服务端事件通知与 CLI 自检 | RPC 推送 `error: { message, willRetry: boolean }`；CLI `codex doctor --json` | 导出 53 个 Feature Flags 与 1248 个会话健康度体检单；`willRetry: false` 明确标识通道硬故障 |
| **并发租约** (`channel-lease`) | 内部速率监控 | `account/rateLimits/updated` 广播上游利用率 | 无跨进程限流，需中心调度器根据 `thread/loaded/list` 控制活跃槽位 |
| **宿主排空** (`host-drain`) | 守护进程优雅停机 | `codex app-server daemon stop` 或关闭 stdio 管道 | 服务端等待当前活跃 `turn` 结束并持久化 `rollout-*.jsonl` 后平稳退出 |

---

### 2.3 Antigravity（Google）

| 维度 | 原生入口与机制 | 真实配置 / 参数 / 接口 | 证据位置与实测事实 |
|---|---|---|---|
| **按调用选渠道** (`channel-route`) | Connect-RPC 模型入参 | AgentAPI `--model=<tier>`；RPC `SendUserCascadeMessage` 传入 `cascadeConfig.plannerConfig.planModel` | [`channels/probe/results/agy-fact-antigravity-20261018.md:32,70-76`](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/channels/probe/results/agy-fact-antigravity-20261018.md#L32)；支持在 9 大模型代号间热切，不支持接入外部第三方 API 凭证 |
| **查额度与用量** (`quota`) | Connect-RPC 官方真额度原语 | `LanguageServerService/RetrieveUserQuotaSummary` 与 `GetUserStatus` | [`agy-fact-antigravity-20261018.md:16,79-84`](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/channels/probe/results/agy-fact-antigravity-20261018.md#L16)；实测返回高精度 `remainingFraction`（如 5h 剩余 0.7372）与绝对重置时间戳 `resetTime`，覆盖 Gemini 与 3P 模型组 |
| **健康与熔断** (`channel-health`) | 端口探针与额度水位自省 | `GET http://127.0.0.1:<port>/healthz`；配额枯竭前置阻断 | 返回 HTTP 200 与进程实例 ID；配额归零时提前拦截派活，防止进入死循环 |
| **并发租约** (`channel-lease`) | 独占锁与状态表结合 | `~/.gemini/antigravity/presence/<cid>.lock`；`conversation_summaries.db` 之 `status=RUNNING` | 活跃 Cascade 持有独占锁文件；崩溃时偶有锁残留，需中心巡检解挂 |
| **宿主排空** (`host-drain`) | 进程生命周期 RPC | `LanguageServerService/Exit`；中心网关 draining 标记 | 网关设置 draining 拦截新活，等待在跑 Cascade 触发 `finalizeRun`，调用 Exit 安全停机 |

---

### 2.4 ZCode（智谱 GLM）

| 维度 | 原生入口与机制 | 真实配置 / 参数 / 接口 | 证据位置与实测事实 |
|---|---|---|---|
| **按调用选渠道** (`channel-route`) | ACP 启动入参 `--model` 语法 | `acpx zcode --model "builtin:bigmodel-coding-plan\GLM-5.3-Flash"` vs `"--model new-provider-2\ark-code-latest"` | [`channels/probe/results/agy-fact-zcode-workbuddy-20261018.md:56`](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/channels/probe/results/agy-fact-zcode-workbuddy-20261018.md#L56)；通过斜杠前缀指定 `~/.zcode/v2/provider_config.json` 注册的渠道，单次有效 |
| **查额度与用量** (`quota`) | ACP 斜杠命令与 SQLite 账本 | ACP 斜杠命令 `/quota`；SQLite `~/.zcode/cli/db/db.sqlite` 表 `model_usage` | [`agy-fact-zcode-workbuddy-20261018.md:30`](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/channels/probe/results/agy-fact-zcode-workbuddy-20261018.md#L30)；`/quota` 调通智谱云端监控，返回 5h 滑窗 39% 与 MCP 剩余调用量；数据库记录逐次 token 消耗 |
| **健康与熔断** (`channel-health`) | 数据库错误台账 | `model_usage.status` 枚举：`rate_limit`, `network_error`, `cancelled` | 本地库完整保留历史故障记录，可据此计算渠道错误率并熔断 |
| **并发租约** (`channel-lease`) | 桌面 Electron 端口独占 | CDP 端口 9240 与主写锁 | 仅支持单实例写入，无多进程并发租约排队机制 |
| **宿主排空** (`host-drain`) | ACP 取消与状态机重置 | `acpx zcode cancel -s <name>` | 安全收回当前轮次，不损坏底层 ndjson 流文件 |

---

### 2.5 WorkBuddy（腾讯 CodeBuddy）

| 维度 | 原生入口与机制 | 真实配置 / 参数 / 接口 | 证据位置与实测事实 |
|---|---|---|---|
| **按调用选渠道** (`channel-route`) | CLI 与 ACP 参数前缀 | `codebuddy --model custom-local:glm-5.3` | [`channels/probe/results/agy-fact-zcode-workbuddy-20261018.md:57`](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/channels/probe/results/agy-fact-zcode-workbuddy-20261018.md#L57)；`custom-local` 走本地 BYOK PAAS 渠道，普通代号走腾讯官方 Credits 计费 |
| **查额度与用量** (`quota`) | 本地 SQLite 积分精确账本 | `~/.workbuddy/workbuddy.db` 表 `session_usage` 之 `credit_json` | [`hci-desktop-facts-20261018.md:310`](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/channels/probe/results/hci-desktop-facts-20261018.md#L310)；逐笔精确记录扣除积分（如 `5.79 credits`、`11.91 credits`）；无法无头查询账号总剩余额度 |
| **健康与熔断** (`channel-health`) | 内部网络元数据 | 错误对象标明 `isNetworkError`, `isStreamTimeout`, `isRetryable` | 发生 401 或限频时准确抛出错误元数据 |
| **并发租约** (`channel-lease`) | 心跳文件互斥 | `~/.workbuddy/sessions/<pid>.json` 记录 `lastHeartbeat` 与端口 | 具备活跃会话登记，无跨进程并发排队 |
| **宿主排空** (`host-drain`) | 命令行回收 | `codebuddy stop` / `kill` | 杀掉后台执行实例，释放会话锁并将任务回退为可重派 |

---

### 2.6 OpenCode 与 Hermes

| 维度 | OpenCode 原生支持 | Hermes 原生支持 | 共同对比结论 |
|---|---|---|---|
| **按调用选渠道** (`channel-route`) | `opencode run -m <provider>/<model>` | `hermes -m <model> --provider <provider>` | 两家均在 CLI 顶层原生提供单调用供应商覆盖 |
| **查额度与用量** (`quota`) | `opencode stats`（表 `session.cost`） | `session_model_usage` 表 | 仅能统计本地 token 与预估花费，无法直连供应商获知剩余额度 |
| **健康与熔断** (`channel-health`) | `opencode providers list` 连接自检 | `hermes auth status/reset/priority` 连接池 | Hermes 自带连接池与耗尽熔断；OpenCode 依赖环境自检 |
| **并发租约** (`channel-lease`) | 无原生跨进程租约 | **原生具备**：`_lease_child_credential`（子任务凭证借出与配额池） | **Hermes 是唯一原生实现凭据租约与子任务额度借还的宿主** |
| **宿主排空** (`host-drain`) | `opencode serve` 终止监听 | 守护进程调度器平稳收尾 | 均支持信号中断排空 |

---

## 三、接进后端要加的路线建议（照 `hub/data/products.json` 格式）

为将上述 5 项底座渠道能力无缝接纳进系统，建议在 `hub/data/products.json` 的 `routes` 中追加以下 3 条高内聚路线定义（供总负责人合并，不直接修改数据源）：

### 3.1 建议追加的路线定义（Routes 规范）

```json
{
  "channel-switch": {
    "does": "无侵入式单调用渠道分流路线：在不修改全局配置文件（settings.json / config.toml / provider_config.json）的前提下，为单次派活或单一会话绑定特定供应商与中转地址",
    "inBackend": false,
    "verbs": {
      "route-claude": {
        "command": "claude -p --settings <transient-json-path> --model <模型>（transient-json 注入 env.ANTHROPIC_BASE_URL 与 ANTHROPIC_AUTH_TOKEN，调用完毕即删）",
        "codeMark": "'--settings'"
      },
      "route-codex": {
        "command": "codex app-server thread/start 传入 { modelProvider: <供应商ID>, config: { 'model_providers.<id>.*': <配置> } }",
        "codeMark": "'modelProvider'"
      },
      "route-zcode": {
        "command": "acpx zcode --model <provider>\\<model> -s <会话名>",
        "codeMark": "'--model'"
      },
      "route-workbuddy": {
        "command": "codebuddy --model custom-local:<model>",
        "codeMark": "'custom-local'"
      },
      "route-hermes": {
        "command": "hermes --provider <provider> -m <model>",
        "codeMark": "'--provider'"
      }
    }
  },
  "channel-governor": {
    "does": "底座渠道治理路线：实现跨平台统一真剩余额度探测、并发流量租约信号灯（防 429 风暴）以及动态故障熔断",
    "inBackend": true,
    "verbs": {
      "probe-quota": {
        "command": "GET /api/gateway/quota?channel=<id>（官方态直读 RPC/API，第三方态直接跨过宿主请求供应商 /balance 接口）",
        "codeMark": "'/api/gateway/quota'"
      },
      "acquire-lease": {
        "command": "POST /api/gateway/leases/acquire { channel, priority, ttlMs } -> 返回 { leaseId, granted }，超限进入 FIFO 等待队列",
        "codeMark": "'acquire-lease'"
      },
      "release-lease": {
        "command": "POST /api/gateway/leases/<leaseId>/release -> 释放槽位并唤醒等待队列下一个任务",
        "codeMark": "'release-lease'"
      },
      "trip-breaker": {
        "command": "POST /api/gateway/channels/<id>/breaker { reason, cooldownMs } -> 将通道置为 cooldown_degraded，自动切换备用渠道",
        "codeMark": "'cooldown_degraded'"
      }
    }
  },
  "host-drainer": {
    "does": "宿主平稳停机与排空路线：支持网关或常驻驱动接收维护信号后，拒绝/暂存新任务，等待活跃轮次全部落盘后优雅退出",
    "inBackend": true,
    "verbs": {
      "drain-start": {
        "command": "POST /api/gateway/drain { mode: 'graceful', timeoutMs: 30000 } -> 状态置为 draining，新派活暂存队列",
        "codeMark": "'draining'"
      },
      "drain-status": {
        "command": "GET /api/gateway/drain -> 返回 { draining: boolean, activeRuns: number, pendingDispatches: number }",
        "codeMark": "'drain-status'"
      }
    }
  }
}
```

---

## 四、中枢协同与落地架构建议

### 4.1 额度查询多级降级策略表（解决第三方 Key 查额痛点）

针对 Codex、Claude 等对第三方 Key 在宿主协议内锁死查额的问题，中心网关应构建三层统一查询引擎：

```
                    ┌─────────────────────────────────┐
                    │  GET /api/gateway/quota 查询请求 │
                    └────────────────┬────────────────┘
                                     │
           ┌─────────────────────────┴─────────────────────────┐
           ▼                                                   ▼
┌──────────────────────┐                             ┌──────────────────────┐
│  情况 A：官方原生登录态 │                             │  情况 B：第三方中转 Key │
│ (Antigravity/Codex)  │                             │ (银子/火山/DeepSeek)  │
└──────────┬───────────┘                             └──────────┬───────────┘
           │                                                    │
           │ 调用原生 RPC                                        │ 跨过客户端宿主
           │ - Antigravity: RetrieveUserQuotaSummary            │ 直连供应商后台 API
           │ - Codex: account/rateLimits/read                   │ - Yinzi: /api/user/self
           ▼                                                    │ - DeepSeek: /user/balance
┌──────────────────────┐                                        ▼
│  拿到 5h/7d 滑窗真额度 │                             ┌──────────────────────┐
└──────────────────────┘                             │   拿到实际账户余额(CNY)   │
                                                     └──────────────────────┘
```

1. **第 1 级（原生真额度 RPC）**：  
   命中官方登录态时，直接调用 Antigravity Connect-RPC 或 Codex App-Server，输出权威滑动窗口百分比与重置倒计时。
2. **第 2 级（供应商直连 API 旁路）**：  
   命中第三方 API Key 时，由网关读取 `channels/_private/keys.json` 中配置的供应商终端（如银子 API `https://yinziapi.top/api/user/self`），直接取回账户余额与请求计数，不再向宿主发送无效 RPC。
3. **第 3 级（本地消费对账兜底）**：  
   当供应商无查询接口时，回退扫描 WorkBuddy 的 `credit_json` 与 ZCode 的 `model_usage`，展示本次会话历史累计消耗。

### 4.2 分布式并发租约与防 429 熔断状态机

```
[任务发起] ──> 申请渠道租约 (acquire)
                    │
                    ├── 并发未满 ──> [获得租约] ──> 执行模型调用 ──> [释放租约] (release)
                    │                                     │
                    │                                     ├── 发生 429/529
                    │                                     ▼
                    └── 并发超限 ──> [入队排队]      [触发熔断器冷却] ──> 流量切换至备用渠道
```

- **租约心跳（Lease TTL）**：租约带有 60 秒绝对超时；若宿主进程崩溃，超时后中心定时器自动强行收回租约槽位，杜绝死锁；
- **熔断阶梯**：
  - 遇到 429：该渠道进入 `cooldown_degraded`（冷却 30~60 秒），后续请求自动降级转交备用供应商（例如从官方 Claude 降级至银子 Claude，或从 Codex 降级至火山方舟）。

---

## 五、验证与基准核对

1. **黑板与表级核对（`tables.js`）**：
   - 运行 `node hub/tools/agent_gateway.js tables`：
     - **证据检验**：`证据：黑板实测行的时间和引用都站得住`（0 errors，完全通过）；
     - **四张表勾稽**：34 个后端单元、7 大产品、各接口映射 100% 吻合。
2. **额度命令实体验证（`agent_gateway.js quota`）**：
   - 实测证实：
     - 银子智能余额：¥13.68 CNY（35,899 次请求，10 把 key 轮换）；
     - OpenAI Official Team：5h 窗口剩余 34%，7d 窗口剩余 59%；
     - Antigravity Ultra：Gemini 5h 剩余 85.61%，7d 剩余 63.8%；
     - DeepSeek 官方：余额 ¥24.94 CNY；
     - Tavily / SerpApi 搜索池：健康且主 Key 额度充足。
3. **安全审计**：
   - 本报告与黑板未泄露任何敏感明文 Key；
   - 未改动任何业务实现源码；
   - 未与丙的适配器路线工作重叠。
