# 任务（戊）交接与自动化全量回归工具架构设计报告：一条命令全测（按四张表自动回归）

**报告日期**：2026-10-18 21:40 (UTC+8)  
**责任人 / 提交方**：研发智能体（戊）  
**任务上下文**：响应 10-18 晚总负责人转达用户指示（“我说的是你开发，然后测试交给 zcode，argon 负责研发（拓展适配器边界），可以吗；一条命令全测的工具改由我来写，请现在停下：把你已经做了什么、写了哪些文件（如有）、想好的设计要点写进报告，然后停，不要再改代码”）。

---

## 一、当前执行状态与文件变更清单

1. **代码修改状态**：
   - 收到停工指令时，**未对任何代码文件进行脏修改**。
   - `hub/tools/agent_gateway.js`：未做改动，保持纯净。
   - `trace/`、`m/`、`hub/data/`：均未做改动。
   - 仓库内未产生任何未提交的 git diff，未执行任何 git commit 或 git push。
2. **唯一新建/修改交付物**：
   - 本报告文件：`channels/probe/results/verify-all-20261018.md`。
3. **环境与运行验证自查**：
   - 执行 `node channels/probe/scripts/tables.js check` 验证四张表与证据链：
     - 证据校验：**证据项 0 处站不住，全部黑板引用的 run_... / dsp_... 真实存在，时间戳无未来时间**。
     - 架构核对：唯一提示为 `产品表：hermes 还没有档案卡`（已有已知待补项）。
     - 8899 守护进程：状态正常，运行平稳，未做重启。

---

## 二、核心问题论证与回答

### 1. 能不能让“全测一遍”变成一条命令、几十分钟跑完、结果可信？

**结论：完全可行，且具备充分工程可行性。**

- **耗时测算**：
  - 目前后端已接通 34 个能力单元（见 `hub/data/integration-map.json` 的 `backend`），主要覆盖 7 个已接入后端产品（`codex`, `claude`, `zcode`, `workbuddy`, `opencode`, `hermes`, `antigravity`）以及只读/待补凭证的 3 个外部产品（`gemini`, `droid`, `doubao-desktop`）。
  - 全量后端格子总数约为 120~150 个（包含同一单元的不同渠道映射）。
  - 若完全串行执行，每个端到端会话交互耗时 10~30 秒，总耗时将长达 40~60 分钟。
  - **提速与并发调度策略**：
    - **同产品串行（互斥锁）**：由于 Codex app-server、Claude stream-json 等本地常驻驱动或进程对同工作区/会话并发有排它性或速率限制，同一产品内的测试项必须限制并发数（`concurrency = 1`）。
    - **不同产品间安全并行**：Codex、ZCode、Claude、Antigravity 之间资源独立、进程隔离，可多产品并行执行（并发数建议为 3~4）。
    - **轻量 Prompt 与快速判决**：除打断（cancel）与插话（steer）需要长文生成窗口期外，其余会话测试一律使用单句极短 Prompt（如“直接输出暗号 TEST_PONG”），单轮响应控制在 1~3 秒内完成。
    - **综合预估耗时**：全矩阵全量测试可在 **12 ~ 18 分钟** 内完整跑完。

- **结果可信（不信接口自报，双重凭证闭环）**：
  - 接口返回 `HTTP 200` 或 `started: true` 仅代表“命令已下发”，**绝不能作为测试通过的判据**。
  - 必须实施**双重铁证核验**：
    1. **中枢凭证（Hub Evidence）**：
       - `~/.agent-hub/runs.jsonl`：轮次必须落盘，且 `status === "completed"`（打断时为 `aborted`），提取到确切的 `runId`（`run_\d{13}_[a-z0-9]{4}`）。
       - `~/.agent-hub/dispatches/<id>.json`：协同任务必须落盘，且回执状态必须达到 `returned` 或 `delivered`，提取到确切的 `dspId`（`dsp_\d{6}_[a-z0-9]{4}`）。
    2. **产品原生凭证（Product Ground Truth）**：
       - `claude`：核查 `~/.claude/projects/` 下该会话的 `.jsonl` 文件，验证最后一条 `assistant` 消息真实包含了第一轮或第二轮暗号。
       - `codex`：核查 `~/.codex/sessions/` 或 app-server 的 `threadId`/`turnId` 产物，验证响应流转。
       - `zcode`：核查 `~/.zcode/v2/sessions/` 或 `.acpx/sessions/` 中的 session 文件。
       - `antigravity`：通过 `language_server` agentapi 取得真实会话 ID，并调用 `GET /api/sessions/antigravity:<id>` 核实轮次数据非空。

---

### 2. 哪些单元能自动测？哪些测不了？各自原因与分类矩阵

根据四张表定义与实际底层约束，全量能力单元划分为三大类：

| 类别 | 包含能力单元 | 自动化可行性 | 判定机制与约束条件 |
|---|---|:---:|---|
| **A 类：完全可全自动回归**<br>（约 23 个单元） | `open`, `resume`, `cancel`, `state`, `model-new`, `mode-switch`, `workspace`, `instructions`, `observe-live`, `observe-history`, `discover-sessions`, `ownership`, `project-view`, `artifact`, `spawn-subagent`, `act-deliver`, `act-report`, `act-yield`, `act-request`, `wait-visible`, `wake-bg`, `wake-msg`, `wake-stall`, `wake-persist`, `reclaim` | **100% 自动** | 纯后端 API + 中枢事件总线驱动，可编程比对输入、输出、状态流转与本地物理落盘记录。无需人工干预。 |
| **B 类：有条件自动化测试**<br>（需特定 Fixture/测试夹具，约 6 个单元） | `permission` (中途审批)<br>`steer` (轮内插话)<br>`inject-next` (下一轮注入)<br>`attach` (发图与附件)<br>`resume-native` (接管原生会话)<br>`model-switch` (中途切模型) | **需夹具支持** | - `permission`：需构造触发工具调用的 Prompt，在 45s 内监听 `pendingApprovals` 并调 `/api/gateway/approve` 答复。<br>- `steer`：需让智能体先执行长文耗时生成，在生成窗口期调用 `steer` 并核验同轮合并回复（目前仅 Codex app-server 与 Antigravity 支持）。<br>- `attach`：需自动生成 1x1 真实 PNG Base64 并核查服务端保存路径。<br>- `resume-native`：**严禁侵入人正使用的会话**；必须由脚本用原生 CLI/SDK 自行开一个测试用原生会话，再由中枢接管测试。<br>- `model-switch`：Claude 受用户红线硬性约束（仅允许 haiku），不可在测试中跨越至 sonnet/opus，其余渠道可全自动切。 |
| **C 类：无法在无人值守 CLI 中全自动测**<br>（约 5 个单元） | `ask-user` (向人提问)<br>`notify-user` (通知人)<br>`human-steer` (人中途插话)<br>`browser` / `dev-preview`<br>`quota` (查额度) | **需人/环境/外部凭据** | - `ask-user` / `notify-user` / `human-steer`：依赖人类操作者在桌面 UI 或通知中心物理点击并输入反馈。<br>- `browser` / `dev-preview`：依赖本地启动 Web 服务、启动无头/有头浏览器并捕获渲染 DOM。<br>- `quota`：大部分渠道缺乏标准余额查询协议，依赖平台内部专有接口或网页抓取。<br>- `gemini` / `droid` 的 `open`：当前环境未配置外部 API Key，且 headless 下 OAuth 交互会被系统强制取消（exit=55）。 |

---

## 三、“一条命令全测”回归工具的设计要点（交接蓝图）

建议总负责人实现时采纳以下**四层解耦、数据驱动**架构：

### 1. 架构总览与目录划分

```
Agent-Architecture-Hub/
├── hub/tools/agent_gateway.js        # 仅新增一行子命令转发：if (sub === 'verify') ...
└── channels/probe/scripts/
    ├── verify.js                     # 回归主控制器：CLI 参数解析、表加载、调度度量
    └── verify/
        ├── scheduler.js              # 队列与并发调度器（产品级互斥 + 跨产品并行）
        ├── runner_factory.js         # 测试器工厂：按动作类型分发执行套具
        ├── verifier.js               # 双重证据断言器（runs.jsonl, dispatches, session stores）
        ├── blackboard_writer.js      # L2 结果写入器（无 BOM、合规字段、动态生成）
        └── fixtures/                 # 标准执行夹具（Standard, Interrupt, Approval, Collab 等）
```

### 2. 网关入口：一行转发（零副作用）

在 `hub/tools/agent_gateway.js` 的 `main()` 函数中追加：
```javascript
// Verification regression engine: data-driven cross-agent regression by four tables
if (sub === 'verify') {
  require(path.join(ROOT_DIR, 'channels', 'probe', 'scripts', 'verify.js')).run(args);
  return;
}
```

### 3. 表驱动动态用例生成（不手写测试）

测试用例绝不手写写死在代码中，完全由数据表实时装配：
```javascript
// 核心装配逻辑：
function buildExecutionPlan(options = {}) {
  const { products, actions, integ, units } = loadTables();
  const targetProduct = options.product; // 可选 --product codex
  const targetUnit = options.unit;       // 可选 --unit cancel
  
  const plan = [];
  for (const [unitId, entries] of Object.entries(integ.backend || {})) {
    if (targetUnit && unitId !== targetUnit) continue;
    const unitMeta = units.find(u => u.id === unitId) || {};
    
    for (const entry of entries) {
      for (const ch of entry.channels || []) {
        if (targetProduct && ch !== targetProduct) continue;
        const prodMeta = products.products.find(p => p.id === ch);
        if (!prodMeta) continue;
        
        plan.push({
          unit: unitId,
          unitName: unitMeta.name,
          category: unitMeta.category,
          channel: ch,
          productName: prodMeta.name,
          declaredStatus: entry.status, // real | partial | built | todo
          action: entry.action,
          how: entry.how,
          fixtureType: resolveFixtureType(unitId, entry.action),
          defaultModel: ch === 'claude' ? 'haiku' : (ch === 'zcode' ? 'builtin:bigmodel-coding-plan\\GLM-5.3-Flash' : prodMeta.defaultModel),
        });
      }
    }
  }
  return plan;
}
```

### 4. 标准测试器套具（Fixture Runners）

将 34 个单元归纳为 6 种标准套具类型，当表里增加新单元或新产品时，只需映射到对应套具，自动生成用例：
1. **LifecycleRunner** (`open`, `resume`, `model-new`, `workspace`, `instructions`)：
   - 构造会话名 `probe-regress-${channel}-${unit}-${Date.now().toString().slice(-4)}`；
   - 第 1 轮：输入带随机数暗号的极短 Prompt；
   - 校验：`runs.jsonl` 中存在 `status === "completed"` 且产品原始记录包含暗号；
   - 若测试 `resume`，则发起第 2 轮询问第 1 轮暗号，验证回复。
2. **InterruptRunner** (`cancel`)：
   - 发送长文计算 Prompt（如“列出1到500每个数字平方”）；
   - 在 400ms 内调用 `POST /api/gateway/cancel`；
   - 校验：`runs.jsonl` 中该 `runId` 状态在 3s 内转变为 `aborted`，且进程/会话未崩溃。
3. **ApprovalRunner** (`permission`)：
   - 发送触发审批命令（如 `cmd.exe /c echo CODEX_APPROVAL_TEST`）；
   - 轮询等待 `pendingApprovals`；
   - 收到后 POST `/api/gateway/approve`；
   - 校验：轮次恢复执行并顺利 completed。
4. **CollabRunner** (`spawn-subagent`, `act-deliver`, `act-report`, `act-yield`, `wake-*`)：
   - 调用 `/api/gateway/dispatch` 发起派活单；
   - 被测会话调用 `/api/gateway/collab-event` 发送 report / yield / deliver；
   - 校验：`~/.agent-hub/dispatches/<id>.json` 状态为 returned，等待边成功移除。
5. **ObservabilityRunner** (`observe-history`, `discover-sessions`, `ownership`, `artifact`)：
   - 调用 `/api/sessions`、`/api/sessions/<id>` 与 `/api/sessions/<id>/files`；
   - 校验：返回合规的 Contract Session 结构，不发生丢失或字段异常。
6. **ModelSwitchRunner** (`model-switch`)：
   - 调用 `/api/gateway/model` 设置目标模型；
   - Claude 渠道跳过跨模型切换并记录说明，其余渠道发起新一轮对话；
   - 校验：会话记录与中枢记录中的 `model` 字段真实发生变更。

### 5. 严格的黑板（Blackboard）写入红线控制

在将测试结果追加至 `channels/probe/blackboard.jsonl` 时，务必遵守以下铁律：
1. **严禁 UTF-8 BOM**：必须使用 Node.js 的无 BOM 写入：
   ```javascript
   fs.appendFileSync(blackboardPath, JSON.stringify(record) + '\n', { encoding: 'utf8' });
   ```
2. **引用与时间必须真实**：
   - `at` 字段必须使用真实的 `new Date().toISOString()`；
   - `evidence` 必须真实引用落盘的 `run_...` 或 `dsp_...` 编号，严禁伪造不存在的 ID；
   - 运行前必须先执行命令，拿到真正生成的 ID 后再写黑板，不可在命令执行前提前预写。
3. **合成测试会话必须清理**：
   - 测试完毕后，如果是创建的临时探测会话，需在测试报告完成后清理对应临时目录，防止污染用户桌面会话列表。

---

## 四、功能矩阵现状盘点（与 10-18 最新复测对比）

截至 2026-10-18 21:30：
1. **矩阵达成度**：
   - 后端接通单元总数：34 个。
   - 绝大多数核心单元均已达成 `real`（实测通过）；
   - 今日刚由复测智能体完成 88 个 `built` 格子的实测，其中 87 个已顺利晋升 `real`；
   - 唯一合法保留为 `built` 的是：`model-switch @ claude`（受用户红线严格限制仅使用 haiku）；
   - 降级为 `todo` 的是：`open @ gemini` 与 `open @ droid`（缺少外部 Key，非交互阻塞）。
2. **核对基准线（tables check）**：
   - 当前四张表核对仅差 `hermes` 的档案卡文件，其余动作、路由、代码标记全部对齐。
   - 回归工具跑完后，若某项实测出现 fail，应高亮提示与现有 `integration-map.json` 的差异，辅助负责人精准定位到底是底层适配断裂、网络波动、还是模型端响应超时。

---

## 五、交接总结

- **研发代码状态**：纯净无污染，未动 `gateway.js`、`trace/`、`m/`。
- **设计方案成熟度**：已完成表驱动装配逻辑、并发调度模型、6 类标准套具、双重证据校验判决、无 BOM 黑板回填的完整详细设计。
- **后续执行建议**：总负责人可直接基于上述架构在 `channels/probe/scripts/verify.js` 实现，并派活给 ZCode 的 `GLM-5.3-Flash` 执行批量轻量回归与结果比对。
