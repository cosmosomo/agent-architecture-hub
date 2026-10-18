# “一群会话”级任务编排中枢（TaskBoard）设计与落地报告

> **任务定位**：全系统最空的一级——“一群会话”（宿主始终是中心，每一步决定下一个是谁、给他什么、停不停）任务板、目标与预算、循环熔断落地  
> **实测日期**：2026-10-18  
> **测试环境**：Windows 11 (10.0.26200), Node.js v24.19.0, 专用测试端口 `18903`  
> **交付代码与产物**：  
> - 核心模块：[`trace/apps/cli/src/collab/taskboard.ts`](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/trace/apps/cli/src/collab/taskboard.ts)（新建，TypeScript 原生 ESM，纯标准库零依赖）  
> - 完整测试脚本：[`channels/probe/scripts/test_taskboard.mjs`](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/channels/probe/scripts/test_taskboard.mjs)  
> - 测试输出数据：[`channels/probe/scripts/output/taskboard_test_results.json`](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/channels/probe/scripts/output/taskboard_test_results.json)  
> - 持久化存储落地：`~/.agent-hub/tasks/`（JSON 实体落盘）与 `~/.agent-hub/dispatches/`（物理派活单联动）  
> - 黑板事实记录：`channels/probe/blackboard.jsonl`（路由 `hub/L2/taskboard`）  

---

## 一、核心问题回答

### 1. 任务板最少要哪些东西才能让“一群会话”这一级跑起来？

在《channels/README.md》的“立体认知”中，“一群会话”这一级的宿主**始终是我们自己（中心）**。它的循环形式是**协作图谱上一步接一步，每一步做三个决定：下一个是谁、给他什么、停不停**。  
要让这一级脱离无序放任，任务板最少必须具备以下**五大核心支柱（Minimal Pillars）**：

1. **任务与目标（Task & Goal）**：
   - `id`（逻辑任务全局唯一标识，如 `tsk_1792330000_abcd`）；
   - `title`、`goal`（目标陈述）、`acceptance`（客观验收事实条件，非空描述）；
   - 严谨的有限状态机：`blocked`（依赖阻断） $\to$ `queued`（就绪待领） $\to$ `claimed`（席位认领） $\to$ `dispatched`（已下发派活单） $\to$ `verifying`（产物待验） $\to$ `completed`（验收闭环） / `failed`（熔断失败） / `cancelled`（人工终止）。
2. **谁领（Seats & Claim & Epoch）**：
   - 席位认领机制（`owner: { channel, sessionName }`）；
   - 候选渠道限制（`eligibleChannels: string[]`，限制哪些产品能领）；
   - **认领代数（`epoch: number`）**：每次被认领代数自增（`epoch += 1`）。凡下发的执行与回调均携带此 `epoch`，彻底消除异步回调中旧轮次结果覆盖新轮次的并发悬案。
3. **依赖（Dependencies & DAG）**：
   - 有向无环图（DAG）关系（`dependencies: string[]`）；
   - **循环依赖检测（Cycle Detection）**：建任务时遍历祖先栈，发现环路立即抛错阻断；
   - **自动解封机制（Auto-Unblock）**：当前置依赖任务全部达到 `completed` 时，中心自动将处于 `blocked` 的下游任务推进为 `queued`，无需人工干预。
4. **预算（Budget & Resource Limits）**：
   - 单任务硬指标：`maxTurns`（单次允许的最大交互轮数）、`timeoutMs`（单次执行超时）、`maxRetries`（允许的最大返工次数，默认 2 次）；
   - 杜绝无底洞消耗 Token 与死循环。
5. **停不停（Stop / Loop Breaker / Verdict）**：
   - **独立验收（Verdict）**：区分 `passed: true` 与 `passed: false`（带返工要求 `reworkInstructions`）；
   - **死循环熔断（Loop Breaker）**：当验收不通过返工次数超过 `maxRetries`，或者底层执行连续报错超过阈值（`consecutiveErrors >= 3`），状态机**强制熔断为 `failed`**，停下该分支，并向中心告警。

---

### 2. 和已有的派活单（`~/.agent-hub/dispatches/`）怎么接？

在现有架构中，`~/.agent-hub/dispatches/` 负责的是**两个具体会话之间的单次物理执行与投递协议**（带 `issued/delivered/seen/returned` 四态回执与唤醒机制）。

**Task（逻辑任务）与 Dispatch（物理派活单）是“目标层”与“执行层”的关系**：
- **Task 是持久的业务意图**：一个任务可能经历多次重试（Epoch 1, Epoch 2...），包含目标、依赖关系和验收标准；
- **Dispatch 是具体的单次执行单**：由 Task 调度器向具体执行端会话（`to.channel`, `to.sessionName`）发起。

**具体连接闭环协议**：
1. **下行派发（Task $\to$ Dispatch）**：
   - 当任务处于 `claimed` 状态时，调度器调用 `board.dispatchTask(taskId)`；
   - 自动生成符合 `gateway.ts` 规范的 `DispatchRecord`，落盘到 `~/.agent-hub/dispatches/<dispatchId>.json`；
   - 将逻辑目标、验收条件以及上一次的返工说明（`reworkInstructions`）自动装配进 `task` 提示词；
   - 在 Dispatch 的 `metadata` 中挂载 `{ taskId, epoch, priority }`；
   - Task 自身记录 `activeDispatchId = dispatchId` 并记入 `dispatchHistory`，状态更新为 `dispatched`。
2. **上行回执与验收（Dispatch $\to$ Task）**：
   - 当执行端通过 `collab-event deliver` 交付结果后，Dispatch 状态转为 `completed`；
   - TaskBoard 的 `reconcile()` 巡检或网关事件将 `dsp.delivery`（含交付文本、产出文件清单）提取为 Task 的 `deliverables`，并将 Task 推进到 `verifying`；
   - 验收通过转 `completed`，触发下游依赖解封；验收不通过则返工或熔断。

---

### 3. 借 `ap_mind` 的哪些、不借哪些？

对比上一代项目 `E:\program\GIT\Agent\agent-hub\src\ap_mind\`（`studio_tasks.py` 697 行、`studio_budget.py` 176 行、`studio_verdicts.py` 157 行）：

#### 3.1 借什么（精华与定律）
1. **借：乐观并发与认领代数（`assignment_epoch`）**：
   `studio_tasks.py` 中的 `assignment_epoch` 是最精妙的防串话设计，有效防止网络重发或异步回调错位，本次完全继承。
2. **借：DAG 依赖解算与环路防御（`_ready` & `_dependencies`）**：
   严格的 DAG 拓扑判空与环路检测机制，前置任务未全部闭环绝不放行，本次以纯 TypeScript 实现。
3. **借：独立验收裁决（`verdicts`）与返工隔离**：
   `ap_mind` 强调“执行者不能自己给自己验收”。本次 TaskBoard 将 `deliverables`（交付物）与 `verdict`（裁判裁决）彻底分为两个结构。
4. **借：防死循环熔断（`max_rework_rounds`）**：
   严格限制返工轮次上限，防止智能体互相推诿死循环。
5. **借：物理落盘优先与幂等性**：
   所有状态变更必须先安全落盘再返回。

#### 3.2 不借什么（摒弃冗杂，保持轻量）
1. **不借：SQLite 繁琐建表与连接锁机制**：
   `ap_mind` 深度依赖 SQLite `c.executescript(...)`、行锁与 SQL 查询。我们当前项目遵循“目录即数据库、单个 JSON 存状态、原子写入（`tmp -> rename`）、人与脚本可读”（与 `~/.agent-hub/dispatches/` 统一），采用 `~/.agent-hub/tasks/<taskId>.json`，纯原生无外部依赖。
2. **不借：过载的“虚拟角色/席位工作室”（Studio Avatars & Appearances）**：
   `ap_mind` 包含了大量针对 Agent Studio 虚拟人设、头像、评级的重度包装代码，与我们当前聚焦的“各产品真实会话协作与调度”无关，一律剔除。
3. **不借：复杂的跨货币汇率记账体系**：
   `studio_budget.py` 里花费大量篇幅做多币种汇率换算与价格账本。在“一群会话”这一级，真正管用的是**轮次上限（`maxTurns`）**、**返工重试上限（`maxRetries`）**和**连续错误熔断（`consecutiveErrors`）**等硬闸门，因此本次实现直截了当的硬预算控制。
4. **不借：专有 Runner 强耦合调度**：
   `ap_mind` 在 `dispatch` 时直接耦合其特有的 `studio.start(request)` runner。我们解耦为生成通用的 `DispatchRecord`，直接与现有的跨产品派活管线对接。

---

## 二、代码架构与实现细节

模块源码落地于：[`trace/apps/cli/src/collab/taskboard.ts`](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/trace/apps/cli/src/collab/taskboard.ts)（390 行，TypeScript 原生 ESM，零外部不可靠依赖）。

### 2.1 状态流转图

```
                  ┌──────────────────────┐
                  │       blocked        │ (前置依赖未满足)
                  └──────────┬───────────┘
                             │ 前置全部 completed (自动解封 unblockDownstream)
                             v
                  ┌──────────────────────┐
                  │        queued        │ (就绪待领)
                  └──────────┬───────────┘
                             │ claimTask()
                             v
                  ┌──────────────────────┐
                  │       claimed        │ (席位已认领，epoch += 1)
                  └──────────┬───────────┘
                             │ dispatchTask() -> 落盘 ~/.agent-hub/dispatches/<id>.json
                             v
                  ┌──────────────────────┐
                  │      dispatched      │ (物理执行中)
                  └──────────┬───────────┘
                             │ submitDelivery()
                             v
                  ┌──────────────────────┐
                  │      verifying       │ (产物已交付待验)
                  └──────────┬───────────┘
                             │ verifyTask()
            ┌────────────────┴────────────────┐
            v                                 v
   (passed == true)                  (passed == false)
┌──────────────────────┐                      │
│      completed       │                      │ retryCount <= maxRetries?
└──────────────────────┘             ┌────────┴────────┐
  (自动触发下游解封)                    v (Yes)           v (No)
                              ┌─────────────┐   ┌─────────────┐
                              │   queued    │   │   failed    │
                              │ (返工重试)   │   │ (死循环熔断) │
                              └─────────────┘   └─────────────┘
```

---

## 三、实测验证与端口 18903 检验

通过专属测试套件 [`channels/probe/scripts/test_taskboard.mjs`](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/channels/probe/scripts/test_taskboard.mjs)，在专用测试端口 **`18903`** 上进行了全链路实物闭环验证：

### 3.1 实测项与判据记录表

| 实测项 | 状态 | 验证判据与输出证据 |
|---|:---:|---|
| **DAG 依赖初始判定** | ✅ PASS | 任务 A 创建后为 `queued`；依赖任务 A 的任务 B 创建后正确置为 `blocked` |
| **席位认领与代数自增** | ✅ PASS | Task A 经 `claude` 认领后状态转 `claimed`，代数自增 `epoch=1` |
| **物理派活单联动生成** | ✅ PASS | 调用 `dispatchTask()` 成功在磁盘生成 `~/.agent-hub/dispatches/dsp_mvdub6ag_iw6o.json`，元数据包含 `taskId: probe_task_a_*` |
| **产物交付与独立验收** | ✅ PASS | 提交交付物后状态转 `verifying`；裁决 `passed=true` 后 Task A 状态转为 `completed` |
| **下游依赖自动解封** | ✅ PASS | Task A 完成后，下游 Task B 自动从 `blocked` 跃迁为 `queued`，控制台证实：`Task B auto-unblocked status: queued` |
| **循环熔断（Loop Breaker）** | ✅ PASS | Task C 设置 `maxRetries=1`；第 1 次未通过退回 `queued`；第 2 次未通过触发熔断，状态强制转为 `failed`，避免死循环 |
| **循环依赖防御检测** | ✅ PASS | 捕获构造环路依赖，抛出 `Task dependency cycle detected` 异常并阻断 |
| **物理落盘持久化验证** | ✅ PASS | 磁盘目录 `~/.agent-hub/tasks/` 实体验证，成功写入并读回 5 个探针任务文件 |
| **端口 18903 HTTP REST 闭环** | ✅ PASS | 启动端口 18903 独立服务，`GET /api/gateway/tasks` 返回 HTTP 200（count=5），`POST /api/gateway/tasks` 成功创建任务返回 HTTP 201 |

实测原始数据已归档至：[`channels/probe/scripts/output/taskboard_test_results.json`](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/channels/probe/scripts/output/taskboard_test_results.json)。

---

## 四、动作表（`hub/data/actions.json`）建议追加行

按照分工约束，本任务不直接修改 `hub/data/actions.json` 和 `server.ts`。以下为给总负责人合并入动作表的建议配置行（标准 JSON 格式）：

```json
[
  {
    "id": "task-list",
    "method": "GET",
    "path": "/api/gateway/tasks",
    "does": "列出全部逻辑任务（一群会话编排板），支持按 status、channel、priority 筛选",
    "cli": "tasks"
  },
  {
    "id": "task-get",
    "method": "GET",
    "path": "/api/gateway/tasks/<id>",
    "does": "查询指定逻辑任务的完整详情、依赖拓扑、执行历史与交付产物",
    "cli": "task"
  },
  {
    "id": "task-create",
    "method": "POST",
    "path": "/api/gateway/tasks",
    "does": "创建逻辑任务，定义目标、验收条件、依赖 DAG、预算上限与候选渠道",
    "cli": "task-new"
  },
  {
    "id": "task-claim",
    "method": "POST",
    "path": "/api/gateway/tasks/<id>/claim",
    "does": "会话或产品席位认领就绪任务，自增 epoch 防并发冲突",
    "cli": "task-claim"
  },
  {
    "id": "task-dispatch",
    "method": "POST",
    "path": "/api/gateway/tasks/<id>/dispatch",
    "does": "将已认领任务转化为物理派活单（~/.agent-hub/dispatches/），下发执行",
    "cli": "task-dispatch"
  },
  {
    "id": "task-verify",
    "method": "POST",
    "path": "/api/gateway/tasks/<id>/verify",
    "does": "对任务交付产物进行独立验收裁决；通过则自动解封下游依赖任务，超限则触发死循环熔断",
    "cli": "task-verify"
  },
  {
    "id": "task-cancel",
    "method": "POST",
    "path": "/api/gateway/tasks/<id>/cancel",
    "does": "中止或取消逻辑任务，级联终止关联派活单",
    "cli": "task-cancel"
  }
]
```

---

## 五、后端接法建议（留给总负责人）

在 `server.ts` 或后续拆分出的协作路由模块中：
1. **实例化**：
   ```typescript
   import { TaskBoard } from './collab/taskboard.ts';
   const taskboard = new TaskBoard();
   ```
2. **挂载 HTTP 路由**：
   将上述 7 个建议 action 映射至对应路由处理器，直接调用 `taskboard.createTask`、`taskboard.listTasks`、`taskboard.claimTask`、`taskboard.dispatchTask` 与 `taskboard.verifyTask`。
3. **巡检定时器集成**：
   将 `taskboard.reconcile()` 挂入现有的后台定时巡检循环中（如每 15 秒一次），自动同步物理派活单返回的产物并刷新 DAG 解封。

---

## 六、测试环境隔离与历史测试数据归档（2026-10-18 优化）

### 6.1 真实数据目录隔离改造
为避免探针测试生成的假任务和假派活单混入网页真实协作页（`/m/#/collab`）：
1. **支持环境变量覆盖**：
   `TaskBoard` 构造函数改造为支持 `process.env.HUB_DATA_DIR`（以及 `HUB_TASKS_DIR` / `HUB_DISPATCHES_DIR`），基准目录支持外部动态注入：
   ```typescript
   const base = process.env.HUB_DATA_DIR || join(homedir(), '.agent-hub');
   this.tasksDir = customTasksDir || process.env.HUB_TASKS_DIR || join(base, 'tasks');
   this.dispatchesDir = customDispatchesDir || process.env.HUB_DISPATCHES_DIR || join(base, 'dispatches');
   ```
2. **测试脚本全面重定向至系统临时目录**：
   [`test_taskboard.mjs`](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/channels/probe/scripts/test_taskboard.mjs) 自动为每次运行分配独立的临时目录（`path.join(os.tmpdir(), 'agent-hub-test-taskboard-*')`），并注入 `process.env.HUB_DATA_DIR = testBaseDir`。实测证实：测试过程中的 5 个任务与物理派活单全部落入 Temp 目录，不再污染 `~/.agent-hub/`。

### 6.2 存量测试数据安全归档
已将此前两轮测试遗留在真实目录下的所有探针数据完整迁移至归档目录，严禁硬删除：
- **逻辑任务文件**：12 个 `probe_task_*.json` 与 `tsk_*` 测试文件安全移入 `~/.agent-hub/test-archive/tasks/`。
- **物理派活单文件**：6 个测试派活单（`dsp_mvdub6*` 与 `dsp_mvdudk*`）安全移入 `~/.agent-hub/test-archive/dispatches/`。
- **真实目录恢复对账**：
  - `~/.agent-hub/dispatches/` 恢复为干净的 **54** 张真实协作单；
  - `~/.agent-hub/tasks/` 恢复为 **0** 个假任务。
