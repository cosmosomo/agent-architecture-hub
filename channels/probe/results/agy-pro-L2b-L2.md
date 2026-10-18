# L2 网关层实测报告 (agy-pro-L2b)

- **测试员**：`agy-pro-L2b`
- **执行时间**：2026-10-17
- **测试端口**：`8932`（自启动常驻服务实例，实测完毕自动销毁）
- **会话命名**：统一使用 `probe-L2b-*` 前缀，未触碰 L2a 的 `probe-L2a-*` 及任何他人会话
- **测试范围**：REST 接口（`session/new`、`model`、`cwd`、`approve`、`handoff`、`meta-agents` 与 `patrol`、`control`）及命令行网关 `agent_gateway.js`（`targets`、`status`、`run`、`cancel`、`quota`），全量覆盖 7 大主力平台（codex、claude、zcode、workbuddy、opencode、hermes、antigravity）。

---

## 核心核实结论（对 HANDOFF.md 第三节自评的实证裁判）

对照 `HANDOFF.md` 第三节自评表格与代码现场，逐一核实如下：

1. **点开原生会话发消息是否新建了 acpx 空会话？**
   - **核实结论：完全属实（判定：接错路 / 假闭环）**。
   - **代码位置**：[trace/apps/cli/src/gateway.ts:3388-3406](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/trace/apps/cli/src/gateway.ts#L3388-L3406)
   - **证据与机制**：原生历史会话 ID 形式为 `codex:<uuid>` 或 `claude-code:<uuid>`。前端点击并发送消息时，后端在 `sendPrompt` 中解析 `tsid`，执行 `this.listAcpxSessions().find(...)`，但 `listAcpxSessions` 仅扫描 `~/.acpx/sessions/*.json`、`workbuddy.db`、`state.db` 和 Antigravity `brain/`，根本匹配不到原生 Codex/Claude 会话；随后 `sessionName` 被直接降级默认取为 `hub-codex` 或 `hub-claude`，接着调用 `acpx codex -s hub-codex`，在 `~/.acpx/sessions/` 下新建了割裂的空会话，原生的上下文并未被续接。

2. **权限审批是否是进程结束后用正则匹配出来的？**
   - **核实结论：完全属实（判定：假闭环）**。
   - **代码位置**：[trace/apps/cli/src/gateway.ts:3960-3987](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/trace/apps/cli/src/gateway.ts#L3960-L3987)、[trace/apps/cli/src/gateway.ts:3226-3242](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/trace/apps/cli/src/gateway.ts#L3226-L3242)
   - **证据与机制**：真正的 ACP `session/request_permission` 应该在工具执行中途挂起等待 client 响应。但 `gateway.ts` 是在子进程已经彻底执行退出后的 `finalizeRun` 里，使用正则 `const permRe = /(permission|denied|not allowed|read-only|refused|approval|未经授权|权限被拒|拒绝执行)/i` 匹配 stdout 输出文本；匹配到了就在前端凭空塞入一个 `PendingApproval` 卡片。当用户点击“批准”调用 `/api/gateway/approve` 时，`resolveApproval` 只是新发了一条带提示词（`"已批准你的权限请求... 现已开启全读写与命令执行权限 (--approve-all)..."`）的新轮次 prompt，原进程早已死亡，完全不存在中途挂起与动态恢复。

3. **切模型是否只改了 .acpx 会话文件？**
   - **核实结论：基本属实，且对 Antigravity 根本无动作（判定：假闭环）**。
   - **代码位置**：[trace/apps/cli/src/gateway.ts:3011-3058](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/trace/apps/cli/src/gateway.ts#L3011-L3058)
   - **证据与机制**：
     - 对 `antigravity`：代码在 `if (prof.id !== 'antigravity')` 中直接将其排除，未向 Connect-RPC 或 agentapi 发出任何请求，仅在内存 Map 中改了个值（`calls: none`）。
     - 对其余 6 家：代码仅读取 `~/.acpx/sessions/*.json`，修改其中的 `raw.acpx.current_model_id = model` 并写回磁盘，随后后台异步 `spawn('acpx set-model ...')`。如果用户切的是新建的 draft 会话或原生会话，磁盘根本没有 `.json` 文件，`acpx set-model` 报错退出；且实测下层矩阵已证明（MATRIX.md 行 86、685），修改 `.acpx` JSON 或调用 `acpx set-model` 下一轮实际模型往往依然不变（如 Claude 桥不支持 set-model，ZCode 实际依然走 deepseek/glm 默认）。

4. **“分叉”是否只是把文字拼成提示发给新会话？**
   - **核实结论：完全属实（判定：假闭环 / 接错路）**。
   - **代码位置**：[trace/apps/cli/src/gateway.ts:3292-3330](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/trace/apps/cli/src/gateway.ts#L3292-L3330)
   - **证据与机制**：`handoffSession` 抓取源会话最近 3 轮，拼成一段 Markdown 文本：`【跨智能体协同接力 (Session Handoff): ...】\n- 最近 3 轮上下文摘要: ...\n【接力执行指令】: ...`，然后直接调用 `sendPrompt` 发往目标渠道开启新会话。根本没有调用任何原生会话分叉协议（如 Codex app-server 的 `thread/fork` 或 ZCode 的原生分叉接口），完全是人工提示词接力。

5. **四个元智能体实际做什么？“自动批准”是否会把权限静默升级为全部放行？**
   - **核实结论：完全属实（判定：存在权限静默放大风险）**。
   - **代码位置**：[trace/apps/cli/src/gateway.ts:3413-3426](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/trace/apps/cli/src/gateway.ts#L3413-L3426)
   - **实测证据**：实测调用 `sendPrompt` 传入 `permissions: 'reads'`，在 `meta_approver` 默认启用且 `policy: 'all'` 时，网关打印日志并留痕：`已将工具权限从只读 (reads) 自动升级为全自动读写 (--approve-all)`，`permissions` 变量被硬编码覆盖为 `'all'`，前端原本选择的只读限制在未经提示的情况下被全部放行。
   - **四个元智能体实际职责**：
     - `meta_approver`：自动把 Web 端只读权限静默重写为 `--approve-all`，并在事后将正则匹配到的报错生成假卡片（[gateway.ts:529-547](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/trace/apps/cli/src/gateway.ts#L529-L547)）。
     - `meta_resumer`：巡检最近 60 分钟内中断或报错会话，塞入 `externalAnomalies`，并用拼接提示词在断点处强制续跑（[gateway.ts:548-567](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/trace/apps/cli/src/gateway.ts#L548-L567)、[969-1010](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/trace/apps/cli/src/gateway.ts#L969-L1010)）。
     - `meta_maint`：监控渠道连续报错，维护熔断状态机（`closed`/`open`/`probing`），支持模型容灾降级（[gateway.ts:568-585](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/trace/apps/cli/src/gateway.ts#L568-L585)）。
     - `meta_auditor`：巡检运行中会话，若连续工具报错超过 `maxConsecutiveErrors`（默认 3 次）或 240s 无实质输出，标记死循环并唤醒总管大脑注入纠偏或中断（[gateway.ts:586-605](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/trace/apps/cli/src/gateway.ts#L586-L605)、[930-966](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/trace/apps/cli/src/gateway.ts#L930-L966)）。

---

## 接口分项实测明细

### 1. `POST /api/gateway/session/new`
- **代码位置**：[trace/apps/cli/src/server.ts:266-275](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/trace/apps/cli/src/server.ts#L266-L275)、[trace/apps/cli/src/gateway.ts:2203-2251](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/trace/apps/cli/src/gateway.ts#L2203-L2251)
- **下层路线 (calls)**：`none`
- **判定 (verdict)**：**假闭环**（全部 7 家均为假闭环）
- **现象与证据**：
  - 调用 7 家接口均返回 HTTP 200，格式如 `{"ok":true,"channel":"codex","sessionName":"probe-L2b-codex-new","traceSessionId":"new:codex:probe-L2b-codex-new","session":null}`。
  - 检查磁盘 `~/.acpx/sessions/`、Codex/Claude 本地数据库、Antigravity `brain/`，**没有任何文件或会话行生成**。
  - 本质是仅在网关内存 `this.draftSessions` 中暂存一个草稿，底层智能体完全不知晓该会话存在。

### 2. `POST /api/gateway/model`
- **代码位置**：[trace/apps/cli/src/server.ts:277-286](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/trace/apps/cli/src/server.ts#L277-L286)、[trace/apps/cli/src/gateway.ts:2970-3068](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/trace/apps/cli/src/gateway.ts#L2970-L3068)
- **下层路线 (calls)**：
  - `antigravity`：`none`（判定：**假闭环**）
  - 其余 6 家：`<family>/L1b/acpx`（判定：**假闭环**）
- **现象与证据**：
  - 返回 HTTP 200 `{"ok":true,"channel":"...","model":"..."}`。
  - Antigravity 根本未触发 RPC；
  - 其余 6 家尝试修改磁盘 `.acpx/sessions/<name>.json` 中的 `current_model_id`，并异步 spawn `acpx set-model`。但对草稿或原生会话，该文件根本不存在，下层直接抛错；且即使改写了 JSON 文件，底层模型调用矩阵证明并不会在下一轮生效。

### 3. `POST /api/gateway/cwd`
- **代码位置**：[trace/apps/cli/src/server.ts:288-297](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/trace/apps/cli/src/server.ts#L288-L297)、[trace/apps/cli/src/gateway.ts:2900-2967](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/trace/apps/cli/src/gateway.ts#L2900-L2967)
- **下层路线 (calls)**：`none`
- **判定 (verdict)**：**假闭环**
- **现象与证据**：
  - 合法目录返回 200 `{"ok":true,"cwd":"E:\\program\\GIT\\Agent\\multi\\Agent-Architecture-Hub"}`；非法目录抛 500。
  - 仅在内存 `this.selectedCwds` 缓存，并在存在 `.acpx` JSON 时修改其 `cwd` 字段。并未向任何底层正在运行的 Agent 或长驻守护进程发送改变目录的指令，属于静态配置保存。

### 4. `POST /api/gateway/approve`
- **代码位置**：[trace/apps/cli/src/server.ts:240-248](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/trace/apps/cli/src/server.ts#L240-L248)、[trace/apps/cli/src/gateway.ts:3194-3249](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/trace/apps/cli/src/gateway.ts#L3194-L3249)
- **下层路线 (calls)**：`<family>/L1b/acpx`（antigravity 走 `antigravity/L0/agentapi`）
- **判定 (verdict)**：**假闭环**
- **现象与证据**：
  - 传不存在的 ID 返回 500 `{"error":"未找到待审批项或已处理: appr_xxx"}`。
  - 待审批条目全部来源于进程结束后的事后正则匹配（`gateway.ts:3960-3987`），批准后只是以 `--approve-all` 开启全新的一轮任务，根本不是 ACP 协议中途挂起与动态应答。

### 5. `POST /api/gateway/handoff`
- **代码位置**：[trace/apps/cli/src/server.ts:250-264](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/trace/apps/cli/src/server.ts#L250-L264)、[trace/apps/cli/src/gateway.ts:3251-3362](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/trace/apps/cli/src/gateway.ts#L3251-L3362)
- **下层路线 (calls)**：`<toChannel>/L1b/acpx`（或 `antigravity/L0/agentapi`）
- **判定 (verdict)**：**假闭环 / 接错路**
- **现象与证据**：
  - 实测从 codex 接力到 zcode，返回 200 `action: "started"`。
  - 内部实现提取最近 3 轮文本，拼装为提示词发往目标渠道。并未调用底层原生的会话分叉（如 Codex app-server fork），属于用提示词伪造分叉。

### 6. `GET /api/gateway/meta-agents`、`POST /api/gateway/meta-agents` 与 `/patrol`
- **代码位置**：[trace/apps/cli/src/server.ts:309-346](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/trace/apps/cli/src/server.ts#L309-L346)、[trace/apps/cli/src/gateway.ts:764-858](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/trace/apps/cli/src/gateway.ts#L764-L858)、[trace/apps/cli/src/gateway.ts:1027-1243](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/trace/apps/cli/src/gateway.ts#L1027-L1243)
- **下层路线 (calls)**：`none`（`local_rules` 模式）或 `<brainChannel>/L1b/acpx`（`agent_brain` 模式）
- **判定 (verdict)**：**接通**
- **现象与证据**：
  - GET 返回 4 个元智能体配置列表及最近日志；POST 成功修改规则。
  - 实测验证了 `meta_approver` 的权限升级行为（只读静默变 `--approve-all`）。
  - patrol 接口在 `local_rules` 下直接返回确定性决策，在 `agent_brain` 下调起总管协调会话。

### 7. `POST /api/control`
- **代码位置**：[trace/apps/cli/src/server.ts:359-406](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/trace/apps/cli/src/server.ts#L359-L406)
- **下层路线 (calls)**：`none`
- **判定 (verdict)**：**假闭环**
- **现象与证据**：
  - 实测对 7 家发送调控指令，均返回 200 `writtenFiles: ["agents/<family>/inbox.md","traces/human_actions.jsonl"]`。
  - 纯粹向 `hub/cases/` 本地目录追加 Markdown 与 JSONL 文件，供 Mode 1 拓扑仿真读取，完全未与任何底层 Agent 运行时交互。

---

## 命令行网关 `hub/tools/agent_gateway.js` 实测明细

### 1. `targets` 命令
- **代码位置**：[hub/tools/agent_gateway.js:355-382](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/hub/tools/agent_gateway.js#L355-L382)
- **下层路线 (calls)**：`none`
- **判定 (verdict)**：**接通**（作为静态拓扑名录）
- **现象与证据**：
  - 执行 `node hub/tools/agent_gateway.js targets --json`，准确解析返回 10 个目标对象（含 7 大渠道、droid、gemini、doubao-desktop），包含驱动器、默认模型与注入环境变量。

### 2. `status` 命令
- **代码位置**：[hub/tools/agent_gateway.js:734-786](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/hub/tools/agent_gateway.js#L734-L786)
- **下层路线 (calls)**：
  - `antigravity`：`antigravity/L0/connect-rpc`
  - 其余 6 家：`<family>/L1b/acpx`
- **判定 (verdict)**：**接通**
- **现象与证据**：
  - 7 家全部返回 exitCode=0。
  - `antigravity` 成功通过 Connect-RPC 连接 `localhost:65529`，获取到真实 `userTier='Google AI Ultra'`、Gemini 5h/7d 配额剩余百分比及积分；
  - 其余 6 家成功调用 `acpx <agent> status`，返回标准 JSON 快照。

### 3. `run` 命令
- **代码位置**：[hub/tools/agent_gateway.js:852-994](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/hub/tools/agent_gateway.js#L852-L994)
- **下层路线 (calls)**：
  - `antigravity`：`antigravity/L0/agentapi`
  - 其余 6 家：`<family>/L1b/acpx`
- **判定 (verdict)**：**接通**（部分模型存在配置不匹配）
- **现象与证据**：
  - `antigravity`：exitCode=0，耗时 10.4s，返回会话 `d2cc1caa-a4e6-41df-a520-8396c3837adb`，成功回复 `PROBE_L2B_VERIFY`。
  - `claude`：exitCode=0，耗时 23.2s，成功通过 `haiku` 模型完成对话并返回用量。
  - `codex`：exitCode=1，下层 ACP 报错 `Cannot apply --model "gpt-5.4-mini": the ACP agent did not advertise that model`，表明网关硬编码的推荐模型与底层 Codex ACP 暴露的模型列表不一致。

### 4. `cancel` 命令
- **代码位置**：[hub/tools/agent_gateway.js:996-1026](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/hub/tools/agent_gateway.js#L996-L1026)
- **下层路线 (calls)**：
  - `antigravity`：`none`（判定：**没接上**）
  - 其余 6 家：`<family>/L1b/acpx`（判定：**接通**）
- **现象与证据**：
  - 6 家 acpx 渠道均成功调用 `acpx <agent> cancel` 返回 `cancel_result`。
  - `antigravity` 报错退出（exitCode=1）：`{"ok":false,"error":"Standalone cancel requires an acpx agent (got: antigravity)"}`。代码在第 1017 行硬编码拦截非 acpx 渠道，而 Antigravity 底层在 Connect-RPC 上完全具备实测可用的 `CancelCascadeInvocation`，网关在独立路径下完全没接上底层能力。

### 5. `quota` 命令
- **代码位置**：[hub/tools/agent_gateway.js:1258-1384](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/hub/tools/agent_gateway.js#L1258-L1384)
- **下层路线 (calls)**：
  - `antigravity`：`antigravity/L0/connect-rpc`
  - `codex`：`codex/L0/rollout-jsonl`
  - 其余：`none`
- **判定 (verdict)**：
  - `antigravity` 与 `codex`：**接通**
  - 其余渠道：**假闭环**（仅列出静态机制与模型卡，无实时读数）
- **现象与证据**：
  - 成功实时抓取银子 API 余额（剩余 ¥18.76 CNY）、Codex 官方 Team 速率限制（5h 剩余 34%、7d 剩余 59%）、Antigravity 配额（Gemini 5h 剩余 90.95%、3p 5h 剩余 100%）。
  - 对 ZCode、WorkBuddy、OpenCode、Hermes，仅打印出静态描述卡片，未真正调用各自的额度接口。

---

## 汇总与问题定位表

| 接口 / 命令 | 涉及底层真实调用 (calls) | 核心判定 (verdict) | 核心代码位置 |
|---|---|---|---|
| `POST /api/gateway/session/new` | `none` | **假闭环** | [gateway.ts:2203-2251](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/trace/apps/cli/src/gateway.ts#L2203-L2251) 仅网关内存设 draft，底层零动作 |
| `POST /api/gateway/model` | AGY: `none` / 其它: `L1b/acpx` | **假闭环** | [gateway.ts:2970-3068](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/trace/apps/cli/src/gateway.ts#L2970-L3068) 仅改 .acpx JSON 且跳过 AGY，下轮不生效 |
| `POST /api/gateway/cwd` | `none` | **假闭环** | [gateway.ts:2900-2967](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/trace/apps/cli/src/gateway.ts#L2900-L2967) 仅内存记录，不通知下层运行时 |
| `POST /api/gateway/approve` | `L1b/acpx` / `L0/agentapi` | **假闭环** | [gateway.ts:3960-3987](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/trace/apps/cli/src/gateway.ts#L3960-L3987) 进程死后事后正则匹配造假卡片，重开新轮次 |
| `POST /api/gateway/handoff` | `L1b/acpx` / `L0/agentapi` | **假闭环 / 接错路** | [gateway.ts:3292-3330](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/trace/apps/cli/src/gateway.ts#L3292-L3330) 拼装历史文本做提示词，伪造原生分叉 |
| `GET/POST /api/gateway/meta-agents` | `none` / `L1b/acpx` | **接通 (伴随权限放大)** | [gateway.ts:3413-3426](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/trace/apps/cli/src/gateway.ts#L3413-L3426) `meta_approver` 静默将 reads 升为 `--approve-all` |
| `POST /api/control` | `none` | **假闭环** | [server.ts:359-406](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/trace/apps/cli/src/server.ts#L359-L406) 纯写入本地案例目录，不调智能体 |
| `agent_gateway.js targets` | `none` | **接通** | [agent_gateway.js:355-382](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/hub/tools/agent_gateway.js#L355-L382) 静态配置名录 |
| `agent_gateway.js status` | AGY: `L0/rpc` / 其它: `L1b/acpx` | **接通** | [agent_gateway.js:734-786](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/hub/tools/agent_gateway.js#L734-L786) 状态查询全部通畅 |
| `agent_gateway.js run` | AGY: `L0/agentapi` / 其它: `L1b/acpx` | **接通** | [agent_gateway.js:852-994](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/hub/tools/agent_gateway.js#L852-L994) 通过文件传参防截断，AGY与Claude成功执行 |
| `agent_gateway.js cancel` | AGY: `none` / 其它: `L1b/acpx` | AGY: **没接上** / 其它: **接通** | [agent_gateway.js:1017](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/hub/tools/agent_gateway.js#L1017) 独立路径把 AGY 拒之门外，未调 Connect-RPC 取消 |
| `agent_gateway.js quota` | AGY: `L0/rpc` / Codex: `L0/file` | 部分**接通** / 部分**假闭环** | [agent_gateway.js:1258-1384](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/hub/tools/agent_gateway.js#L1258-L1384) AGY与Codex读到真实水位，其余为静态卡片 |
