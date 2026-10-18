# 研究报告：WorkBuddy 和 ZCode 换套餐、换模型与额度查询深度实测

> **报告文件**：`channels/probe/results/agy-pro-wb-zcode-plans-20261018.md`  
> **测试员**：`antigravity-pro`  
> **测试日期**：2026-10-18  
> **认知入口与术语基准**：严格遵循 `channels/README.md`，使用项目统一词汇（前端、后端、适配器、各家；能力渠道、登录态、供应商；以本地落地数据为唯一真源）。

---

## 〇、结论摘要（大白话）

1. **两家都能按调用换套餐、换模型，但生效入口截然不同**：ZCode 的原生命令行（L0）根本没有设计 `--model` 这个参数，传了会被完全忽略；必须走 ACP 桥接（L1a / L1b `acpx`），传 `providerId\modelId`（如 `builtin:bigmodel-coding-plan\GLM-5.3-Flash` 或 `new-provider-2\ark-code-latest`），它会在内存中调用底层 RPC `session/setModel`，百分之百生效。WorkBuddy 则在原生命令行、ACP 桥、acpx 三条路上都能按调用换模型，但前提是必须注入三个特定的环境变量（绕过桌面端的加密鉴权门禁），走本地配置的智谱 Coding Plan（`custom-local:glm-5.3` 和 `custom-local:glm-5.3-flash`）。
2. **两家的套餐和模型清单都能用命令读出来**：ZCode 可以在 ACP 初始化后读取到完整的 3 个供应商共 7 个模型（包括智谱官方 Coding Plan、字节火山、银子）；WorkBuddy 在 `codebuddy --help` 中列出了官方内置的 20 多个模型，在 ACP 握手中更能直接读出每个官方模型的扣费倍率（例如 GLM-5.3 扣 0.79 credits，hy3 和 deepseek-v4.1-flash 扣 0 credits）以及本地自定义的 2 个模型。
3. **查额度有现成机制，ZCode 最强，WorkBuddy 靠本地账本**：ZCode 无论在交互还是 ACP 桥中，发一条 `/quota` 指令就能当场向智谱接口查询并输出 5 小时滑动窗口水位（如 `5h: 12%`）和 MCP 剩余次数（如 `3/100`）；WorkBuddy 的官方 Credits 在无头模式下目前查不到实时余额，但每轮调用的消耗会精确记录在 `~/.workbuddy/workbuddy.db` 的 `session_usage` 表里。
4. **派活推荐**：
   - 派给 **ZCode** 时，一律用 `acpx --approve-reads --model "builtin:bigmodel-coding-plan\GLM-5.3-Flash" zcode -s probe-<任务名> "<要求>"`（省 token、速度快）；如需深度推理则切为 `"builtin:bigmodel-coding-plan\GLM-5.3"`。
   - 派给 **WorkBuddy** 时，一律带上环境变量注入，指定 `--model "custom-local:glm-5.3"`，走本地智谱 Coding Plan（零消耗腾讯官方 Credits，不受桌面端登录态干扰）。

---

## 一、WorkBuddy 深度剖析：套餐、模型、切换与额度

### 1.1 WorkBuddy 的两类套餐与模型清单

WorkBuddy（底层内核为 `codebuddy-code v2.160.0`）在本机存在两套截然不同的模型“套餐”：

| 套餐类型 | 渠道属性 | 凭证与鉴权来源 | 包含模型 | 费用与扣费机制 |
|---|---|---|---|---|
| **腾讯官方 Credits 套餐** | 官方登录态 | 依赖桌面端登录生成的 `$wbEncrypted` 加密信封（或命令行 `codebuddy login`） | 官方内置 22 个模型：<br>1. `hy3` (x0.00 credits 免费)<br>2. `deepseek-v4.1-flash` (x0.00 credits 免费)<br>3. `deepseek-v4.1-flash-sg` (x0.03 credits)<br>4. `glm-5.3-flash` (x0.06 credits)<br>5. `space-bunny` (x0.08 credits)<br>6. `deepseek-v4.1-flash` (x0.11 credits)<br>7. `gpt-5.6-luna` (x0.14 credits)<br>8. `minimax-m2.7` (x0.19 credits)<br>9. `minimax-m3` (x0.25 credits)<br>10. `hy4-preview` (x0.29 credits)<br>11. `fast-model` (x0.34 credits)<br>12. `deepseek-v4-pro` (x0.51 credits)<br>13. `kimi-k2.6` (x0.52 credits)<br>14. `kimi-k2.7` (x0.57 credits)<br>15. `balanced-model` (x0.59 credits)<br>16. `kimi-k2.8-preview` (x0.77 credits)<br>17. `glm-5.3` (x0.79 credits)<br>18. `glm-5.2` (x0.79 credits)<br>19. `glm-5.1` (x0.79 credits)<br>20. `gemini-3.5-flash` (x0.99 credits)<br>21. `gpt-5.6-terra` (x1.39 credits)<br>22. `kimi-k3` (x1.62 credits)<br>23. `gpt-5.4` (x1.65 credits)<br>24. `primary-model` (x3.31 credits)<br>25. `gpt-5.5` (x3.31 credits)<br>26. `deep-model` (x3.33 credits)<br>27. `gpt-5.6-sol` (x3.47 credits)<br>28. `gpt-6-astra` (x6.67 credits) | 扣除腾讯云账号下的官方 Credits 额度。<br>**红线断点**：在无头脚本中若未登录直接调用，会报 `Authentication required. Please use /login command to sign in to your account`。 |
| **本地 BYOK 自定义套餐** | 本地自定义供应商（智谱 Coding Plan） | 来自 `~/.workbuddy/models.json` 配置的 PAAS v4 接口（通过环境变量注入 `ACC_PRODUCT_CONFIG_V3` 激活 `CustomTokenAuthenticationStorageImpl` 旁路） | 2 个模型：<br>1. `custom-local:glm-5.3`<br>2. `custom-local:glm-5.3-flash` | **完全不扣除**腾讯官方 Credits；消耗的是本地配置的智谱 Coding Plan 额度。 |

### 1.2 能否用命令列出清单？

**可以，且有两种方式**：
1. **L0 原生命令行**：运行 `codebuddy --help`，在 `--model` 参数的说明中会输出官方支持的模型标识符列表：
   ```text
   --model <model>  Model for the current session. Please provide the model ID.
   Currently supported: (default-model, fast-model, balanced-model, primary-model, deep-model,
   hy4-preview, hy3, deepseek-v4.1-flash, gpt-6-astra, gpt-5.6-sol, gpt-5.6-terra, gpt-5.6-luna,
   gpt-5.5, gpt-5.4, gemini-3.5-flash, glm-5.3-flash, glm-5.3, glm-5.2, kimi-k3, kimi-k2.6, kimi-k2.8-preview)
   ```
2. **L1a / L1b ACP 桥接**：启动 `codebuddy --acp` 完成握手后，`session/new` 的响应体中的 `configOptions` 数组第 2 项（`id: "model"`）完整列出 20 个可用选项，每个选项均带有名字和 `description`（明确标出 Credits 扣除倍率，如 `"description": "x0.79 credits"`），最后附带用户自定义的 `custom-local:glm-5.3` 和 `custom-local:glm-5.3-flash`。

### 1.3 怎样按调用指定套餐与模型？

要做到“不改全局配置文件、不重启桌面应用、单次调用自由指定”，必须注意以下三点：
1. **必须注入三项环境变量**：
   - `CODEBUDDY_CONFIG_DIR=C:\Users\COLORFIRE\.workbuddy`（指向用户目录）
   - `WORKBUDDY_CONFIG_DIR=C:\Users\COLORFIRE\.workbuddy`
   - `ACC_PRODUCT_CONFIG_V3='{"authentication":{"type":"custom-token","attributes":{"token":"wb-local-byok"}}}'`
2. **新建会话时指定模型**：
   - 命令行（L0）：`codebuddy -p "<prompt>" --session-id <name> --model custom-local:glm-5.3 --output-format json`
   - acpx（L1b）：`acpx --format json --model "custom-local:glm-5.3" workbuddy -s <name> "<prompt>"`
3. **续接会话时中途切换模型**：
   - 命令行（L0）：`codebuddy -r <name> -p "<prompt>" --model custom-local:glm-5.3-flash --output-format json`
   - acpx（L1b）：`acpx --format json workbuddy set model "custom-local:glm-5.3-flash" -s <name>`，紧接着发下一轮 prompt。

### 1.4 实测证据：本地记录里的模型与供应商字段

在本次实测中，我们在会话 `probe-wb-verify-byok` 中进行了两轮测试：
- **首轮测试**：请求模型 `custom-local:glm-5.3`，提问“请只回复四个字：验证成功”。
  - 命令行返回：
    ```json
    {
      "type": "result",
      "subtype": "success",
      "result": "验证成功",
      "session_id": "probe-wb-verify-byok",
      "duration_ms": 1996
    }
    ```
  - 本地项目日志（`~/.workbuddy/projects/e-program-GIT-Agent-multi/memory` 旁会话日志与 stdout 事件）中第 1 轮 assistant 记录真值：
    ```json
    {
      "stepSeq": 1,
      "model": "glm-5.3",
      "requestModelId": "custom-local:glm-5.3",
      "requestModelName": "GLM-5.3",
      "traceId": "409dab3075bb35e1ac8c1333acb83df1",
      "rawUsage": {
        "prompt_tokens": 27471,
        "completion_tokens": 4,
        "total_tokens": 27475,
        "prompt_tokens_details": { "cached_tokens": 20800 }
      }
    }
    ```
- **第二轮切换测试**：直接在同一个会话续接，切为 `custom-local:glm-5.3-flash`，提问“请只回复四个字：切换成功”。
  - 命令行返回：
    ```json
    {
      "type": "result",
      "subtype": "success",
      "result": "切换成功",
      "session_id": "probe-wb-verify-byok",
      "duration_ms": 8387
    }
    ```
  - 本地记录真值第 2 轮 assistant：
    ```json
    {
      "stepSeq": 2,
      "model": "glm-5.3-flash",
      "requestModelId": "custom-local:glm-5.3-flash",
      "requestModelName": "GLM-5.3-Flash",
      "traceId": "f454e575797c30870986c1098d6d23fb",
      "rawUsage": {
        "prompt_tokens": 27496,
        "completion_tokens": 37,
        "total_tokens": 27533
      }
    }
    ```
- **结论**：`requestModelId` 与 `model` 字段真实从 `custom-local:glm-5.3` 变更为 `custom-local:glm-5.3-flash`，证明按调用指定和中途切换模型真实落地生效。

### 1.5 额度怎么查？

1. **官方 Credits 额度**：
   - 命令行尚无直接查询“账户剩余总 Credits”的只读子命令（直接调用报 401）；
   - 但每次会话的单轮消耗均在 `~/.workbuddy/workbuddy.db` 的 `session_usage` 表记录，其 `credit_json` 字段记录了各个任务产生的 Credits 扣费明细（例如 `{"01a13fadc...": 11.91}`）；
   - 在 ACP 握手事件流中，服务端推送的 `usage_update` 带有上下文窗口消耗：`used: 30457, size: 200000`。
2. **BYOK 智谱 Coding Plan 额度**：
   - WorkBuddy 自身不管理外部接口余额，其消费直接体现为智谱 Coding Plan 的滑动窗口用量；
   - 可以通过下述 ZCode 的 `/quota` 工具或直接调智谱配额接口直接掌握该 Key 的水位。

---

## 二、ZCode 深度剖析：套餐、模型、切换与额度

### 2.1 ZCode 的套餐与模型清单

ZCode（版本 `0.16.9`）在本机注册了 3 个供应商（套餐），共有 7 个可用模型：

| 套餐编号与名称 | 渠道类型 | 配置文件位置 | 模型标识符 (`formatModelValue`) | 状态与实测特征 |
|---|---|---|---|---|
| **`builtin:bigmodel-coding-plan`**<br>(BigModel - Coding Plan) | 智谱官方 Coding Plan 登录态（OAuth） | `~/.zcode/v2/setting.json`<br>`~/.zcode/v2/credentials.json` | 1. `builtin:bigmodel-coding-plan\GLM-5.3`<br>2. `builtin:bigmodel-coding-plan\GLM-5.3-Flash` | 🟢 **主用主力**。<br>智谱 Coding Plan Lite 个人订阅；在 `db.sqlite` 中记录为 `account:bigmodel-individual-coding-plan`；速度快、智能稳定。 |
| **`builtin:bigmodel-start-plan`**<br>(BigModel - Start Plan) | 智谱基础体验计划 | 同上 | 3. `builtin:bigmodel-start-plan\GLM-5.3`<br>4. `builtin:bigmodel-start-plan\GLM-5.3-Flash` | 🟢 可用，备用通道。 |
| **`new-provider-2`**<br>(字节火山) | 第三方自定义中转（API Key） | `~/.zcode/v2/provider_config.json` | 5. `new-provider-2\ark-code-latest` | 🟢 **实测可用**。<br>接入火山方舟 `https://ark.cn-beijing.volces.com/api/plan`，在 `db.sqlite` 中已有 4020 次真实调用记录，实测按调用切换完全畅通。 |
| **`new-provider`**<br>(银子) | 第三方自定义中转（API Key） | `~/.zcode/v2/provider_config.json` | 6. `new-provider\deepseek-v4.1-flash`<br>7. `new-provider\glm-5.3` | 🔴 **认证失败**。<br>服务端返回 `auth_failed: Provider authentication failed.`，系外部 key/额度问题，暂不可用。 |

### 2.2 能否用命令列出清单？

- **原生命令行（L0）**：**不能**。`node zcode.cjs --help` 没有任何列出可用模型的选项或子命令。
- **ACP 桥接（L1a / L1b `acpx`）**：**可以，且完全结构化**。
  - 在 `zcode-acp-server` 启动并执行 `session/new` 时，返回的 `configOptions` 中 `id: "model"` 包含了全部 7 个选项及其规范名称；
  - 在本地 `~/.acpx/sessions/<recordId>.json` 中，会持久化记录 `available_models` 和 `available_model_names`。

### 2.3 模型参数到底在哪一层生效、哪一层被忽略？

这是本次研究最核心的机制发现：

```
[用户命令 / 网关输入]
     │
     ├── A. 原生命令行 (L0: node zcode.cjs -p "<prompt>")
     │        │
     │        └── ❌ 完全被忽略！
     │             【原因】：代码审查证实 zcode.cjs 的命令行参数解析器根本没有定义 --model 选项！
     │             环境变量 ZCODE_MODEL 在非交互的 -p 模式下也不被运行时读取。
     │             L0 无论传什么参数，底层永远只使用桌面端上次保存的默认模型（上周默认为银子 deepseek，
     │             导致前人测试出现“声称切了 GLM 实际全跑在 deepseek”的假 pass）。
     │
     └── B. 无头 ACP 客户端 (L1b: acpx zcode / L1a: zcode-acp-server)
              │
              └── ✅ 100% 真实生效！
                   【原因】：acpx 将 --model 传给 zcode-acp-server；
                   桥接器在 dist/config/options.js 中通过 parseModelValue() 解析出 { providerId, modelId }；
                   再经 dist/config/runtime-model.js 中的 applyModelSwitch() 向底层常驻的
                   zcode app-server 发送 JSON-RPC 请求：
                   session/setModel { sessionId, model: { providerId, modelId }, persistAsWorkspaceLastUsed: false }；
                   底层内核在内存中当场切换当前会话的路由目标，下一轮推理即发往该模型！
```

### 2.4 实测证据：本地 SQLite 数据库真值核验

本次新建全新测试会话 `probe-zcode-plan-check`（底层原生会话 `sess_ea378d90-cb56-4282-ac8b-160f9dfcd737`），进行三阶段动态切换实测：

1. **第一阶段：以 Flash 档新建并执行首轮**
   - 执行命令：`acpx --format json --approve-reads --model "builtin:bigmodel-coding-plan\GLM-5.3-Flash" zcode sessions new --name probe-zcode-plan-check` 紧接着发送 prompt `"请只回复四个字：首轮核验"`；
   - 模型输出：`"首轮核验"`；
   - 检查 `~/.zcode/cli/db/db.sqlite` 中 `model_usage` 记录：
     ```json
     {
       "session_id": "sess_ea378d90-cb56-4282-ac8b-160f9dfcd737",
       "provider_id": "account:bigmodel-individual-coding-plan",
       "model_id": "GLM-5.3-Flash",
       "status": "completed",
       "started_at": 1792263078979,
       "completed_at": 1792263084471,
       "input_tokens": 20443,
       "output_tokens": 23
     }
     ```
2. **第二阶段：同一会话中途切换为 GLM-5.3 满血档**
   - 下发切换：`acpx --format json zcode set model "builtin:bigmodel-coding-plan\GLM-5.3" -s probe-zcode-plan-check`
   - 返回回执：`{"action":"model_set","modelId":"builtin:bigmodel-coding-plan\\GLM-5.3","resumed":true}`
   - 发送第二轮 prompt：`"请只回复四个字：核验完成"`
   - 模型输出：`"核验完成"`；
   - 检查 `model_usage` 最新记录：
     ```json
     {
       "session_id": "sess_ea378d90-cb56-4282-ac8b-160f9dfcd737",
       "provider_id": "account:bigmodel-individual-coding-plan",
       "model_id": "GLM-5.3",
       "status": "completed",
       "started_at": 1792263176242,
       "completed_at": 1792263200930,
       "input_tokens": 18239,
       "output_tokens": 24
     }
     ```
3. **第三阶段：跨套餐切换至字节火山 `new-provider-2\ark-code-latest`**
   - 下发跨供应商切换：`acpx --format json zcode set model "new-provider-2\ark-code-latest" -s probe-zcode-plan-check`
   - 返回回执：`{"action":"model_set","modelId":"new-provider-2\\ark-code-latest","resumed":true}`
   - 发送第三轮 prompt：`"请只回复四个字：火山飞雪"`
   - 模型输出：`"火山飞雪"`；
   - 检查 `model_usage` 最新记录：
     ```json
     {
       "session_id": "sess_ea378d90-cb56-4282-ac8b-160f9dfcd737",
       "provider_id": "new-provider-2",
       "model_id": "ark-code-latest",
       "status": "completed",
       "started_at": 1792263359862,
       "completed_at": 1792263363299,
       "input_tokens": 20807,
       "output_tokens": 14
     }
     ```
- **结论**：在同一个物理会话中，从智谱 Coding Plan Flash 档到满血档，再到字节火山第三方套餐，调用模型与供应商在 SQLite 数据库中全部精确一一对应，换套餐和换模型完全成立。

### 2.5 额度怎么查？

ZCode 拥有非常优雅的原生配额查询链路：
1. **直接调用命令**：在任何会话中，直接下发 prompt 文本 `"/quota"`（例如 `acpx --format json zcode -s probe-zcode-plan-check "/quota"`）。
2. **底层实现机制**：`zcode-acp-server` 的 `dist/quota/client.js` 会自动读取当前账号凭证，向智谱官方接口 `https://open.bigmodel.cn/api/monitor/usage/quota/limit` 发送带鉴权的 HTTP GET 请求，并当场渲染出进度条卡片。
3. **实测原始返回内容**：
   ```text
   GLM Coding Plan · Lite
   ──────────────────────────────────
   5h    ██░░░░░░░░░░░░░░░░░░  12% · 10-18 07:16
   MCP   █░░░░░░░░░░░░░░░░░░░   3% · 11-13 14:15 · 3
     ├ search-prime  0
     ├ web-reader    0
     └ zread         3
   ```
   清晰展示了：
   - 当前套餐为 `GLM Coding Plan · Lite`；
   - 5 小时滑动窗口已用 12%，下次重置时间为 10-18 07:16；
   - MCP 工具已调用 3 次（上限 100 次），剩余 97%。

---

## 三、派活时的推荐调用方式（命令原样）

派活作为自动化工作者使用时，**必须满足三点要求**：带代理、按调用隔离、不修改全局配置。

### 3.1 派给 ZCode 的推荐命令

> **原则**：严禁使用 `zcode -p` 原生命令行（模型参数不生效）；必须走 `acpx zcode` 或统一网关 `agent_gateway.js`。

#### 方式 A：通过 `acpx` 命令行（最底层、最标准）

1. **新建任务会话并派第一轮活（推荐 Flash 档，省额度、反应极快）**：
   ```powershell
   $env:HTTP_PROXY="http://127.0.0.1:7892"; $env:HTTPS_PROXY="http://127.0.0.1:7892"
   acpx --format json --approve-reads --model "builtin:bigmodel-coding-plan\GLM-5.3-Flash" zcode sessions new --name probe-<任务名称>
   acpx --format json --approve-reads zcode -s probe-<任务名称> "<任务具体要求>"
   ```

2. **如果该任务需要复杂逻辑推理或大代码重构，切换至满血 GLM-5.3**：
   ```powershell
   $env:HTTP_PROXY="http://127.0.0.1:7892"; $env:HTTPS_PROXY="http://127.0.0.1:7892"
   acpx --format json zcode set model "builtin:bigmodel-coding-plan\GLM-5.3" -s probe-<任务名称>
   acpx --format json --approve-reads zcode -s probe-<任务名称> "<进一步的任务指令>"
   ```

3. **如果智谱限流，换到字节火山套餐备用**：
   ```powershell
   $env:HTTP_PROXY="http://127.0.0.1:7892"; $env:HTTPS_PROXY="http://127.0.0.1:7892"
   acpx --format json zcode set model "new-provider-2\ark-code-latest" -s probe-<任务名称>
   acpx --format json --approve-reads zcode -s probe-<任务名称> "<任务指令>"
   ```

4. **随时检查智谱额度水位**：
   ```powershell
   acpx --format json zcode -s probe-<任务名称> "/quota"
   ```

#### 方式 B：通过本项目的统一网关 `agent_gateway.js`（上层封装）

```powershell
node hub/tools/agent_gateway.js run --agent zcode --session probe-<任务名称> --model "builtin:bigmodel-coding-plan\GLM-5.3-Flash" --prompt "<任务指令>"
```

---

### 3.2 派给 WorkBuddy 的推荐命令

> **原则**：无头调用必须注入三大环境变量走 BYOK 智谱 Coding Plan（`custom-local:glm-5.3` 系列），不走腾讯官方内置模型（避免鉴权门禁阻断与误扣官方 Credits）。

#### 方式 A：通过原生命令行 `codebuddy -p`（一次性任务最快）

```powershell
$env:HTTP_PROXY="http://127.0.0.1:7892"
$env:HTTPS_PROXY="http://127.0.0.1:7892"
$env:CODEBUDDY_CONFIG_DIR="C:\Users\COLORFIRE\.workbuddy"
$env:WORKBUDDY_CONFIG_DIR="C:\Users\COLORFIRE\.workbuddy"
$env:ACC_PRODUCT_CONFIG_V3='{"authentication":{"type":"custom-token","attributes":{"token":"wb-local-byok"}}}'

# 派单轮任务并指定模型：
codebuddy -p "<任务指令>" --session-id probe-<任务名称> --model "custom-local:glm-5.3" --output-format json
```

#### 方式 B：通过 `acpx` 保持多轮会话并自由切模型（推荐）

```powershell
$env:HTTP_PROXY="http://127.0.0.1:7892"
$env:HTTPS_PROXY="http://127.0.0.1:7892"
$env:CODEBUDDY_CONFIG_DIR="C:\Users\COLORFIRE\.workbuddy"
$env:WORKBUDDY_CONFIG_DIR="C:\Users\COLORFIRE\.workbuddy"
$env:ACC_PRODUCT_CONFIG_V3='{"authentication":{"type":"custom-token","attributes":{"token":"wb-local-byok"}}}'

# 1. 建立会话并派第一轮（使用满血 GLM-5.3）
acpx --format json --approve-reads --model "custom-local:glm-5.3" workbuddy sessions new --name probe-<任务名称>
acpx --format json --approve-reads workbuddy -s probe-<任务名称> "<任务指令>"

# 2. 第二轮若需快速回答，切为 Flash 档
acpx --format json workbuddy set model "custom-local:glm-5.3-flash" -s probe-<任务名称>
acpx --format json --approve-reads workbuddy -s probe-<任务名称> "<后续指令>"
```

#### 方式 C：通过本项目的统一网关 `agent_gateway.js`

```powershell
node hub/tools/agent_gateway.js run --agent workbuddy --session probe-<任务名称> --model "custom-local:glm-5.3" --prompt "<任务指令>"
```

---

## 四、不确定的地方与原因

1. **WorkBuddy 桌面端登录态与 CLI 的会话互通**：
   - **现象**：WorkBuddy Desktop 正在前台运行，用户处于登录状态且拥有官方 Credits；但在独立的子进程终端中直接运行 `codebuddy -p --model deepseek-v4.1-flash` 时，报 `Authentication required`。
   - **原因**：桌面版将鉴权凭据写入了带机器特征加密的信封文件（`$wbEncrypted`），CLI 端默认不会自动去挂接该 Electron 内存状态。目前只有通过注入 `ACC_PRODUCT_CONFIG_V3` 的 BYOK 旁路才能稳定通行。
   - **判定**：推断若要在无头下直接消耗桌面版官方 Credits，必须在 CLI 下单独执行一次 `codebuddy login` 完成终端 OAuth，或者借助 opencli 等 CDP 工具。
2. **ZCode 银子渠道（`new-provider`）的恢复时机**：
   - **现象**：在 `db.sqlite` 中记录 `new-provider` 持续返回 `auth_failed: Provider authentication failed.`。
   - **原因**：属于上游中转服务或 API Key 失效，并非 ZCode 软件缺陷。一旦维护者在 `~/.zcode/v2/provider_config.json` 中更新有效 Key，该套餐可立即在 ACP 中通过 `new-provider\deepseek-v4.1-flash` 或 `new-provider\glm-5.3` 恢复调用。
3. **ZCode 原生命令行的未来版本演进**：
   - **现象**：当前 ZCode `0.16.9` 的 `zcode -p` 不支持 `--model` 参数。
   - **原因**：ZCode 官方 CLI 主要定位于 TUI 交互式界面，其模型切换逻辑绑定在 TUI 的 `/model` 斜杠命令与前端状态机上。后续版本是否会在非交互 CLI 中加入 `--model` 参数属于官方未公开计划，目前**不可依赖原生 CLI 传模型**。

---

## 五、本次实测新建测试会话清单

严格遵守“不往人正在用的会话里发消息、自己建的会话一律以 probe- 开头并列出”的纪律：

1. `probe-wb-verify-byok`：
   - WorkBuddy L0 原生命令行验证会话。
   - 验证了首轮 `custom-local:glm-5.3` 与续接轮 `custom-local:glm-5.3-flash` 的模型参数生效与日志落盘。
2. `probe-zcode-plan-check`：
   - ZCode L1b `acpx` 验证会话（对应底层原生会话 `sess_ea378d90-cb56-4282-ac8b-160f9dfcd737`）。
   - 验证了首轮 `builtin:bigmodel-coding-plan\GLM-5.3-Flash`、第二轮切换至 `builtin:bigmodel-coding-plan\GLM-5.3`、第三轮 `/quota` 额度查询、第四轮跨套餐切换至字节火山 `new-provider-2\ark-code-latest` 的全流程闭环。
