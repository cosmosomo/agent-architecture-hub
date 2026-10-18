# “一群会话”级协同中枢架构与系统设计方案

> **文档定位**：全系统核心层级——“一群会话”（Multi-Session Swarm）中枢控制层设计规范  
> **核心公理**：这一级宿主始终是我们中心，每一步决定下一个是谁、给他什么、停不停  
> **设计日期**：2026-10-18  
> **前置依赖模块**：[`trace/apps/cli/src/collab/taskboard.ts:1-569`](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/trace/apps/cli/src/collab/taskboard.ts#L1-L569)（丙已实现的底层任务编排板）  
> **理论依据**：
> - [`E:/program/GIT/Jobs/.../多智能体协作_第一稿_20261014.md`](file:///E:/program/GIT/Jobs/08_%E7%AE%80%E5%8E%86%E8%AE%BE%E8%AE%A1%E5%B7%A5%E4%BD%9C%E5%8C%BA/02_%E9%A1%B9%E7%9B%AE%E6%89%93%E7%A3%A8%E4%B8%8E%E5%B1%95%E7%A4%BA/%E6%99%BA%E8%83%BD%E4%BD%93%E6%8A%80%E6%9C%AF/%E5%A4%9A%E6%99%BA%E8%83%BD%E4%BD%93%E5%8D%8F%E4%BD%9C/%E7%A0%94%E7%A9%B6%E4%BB%BB%E5%8A%A1%E4%B9%A6_20261014/%E5%B1%80%E9%83%A8%E8%AE%B2%E6%B8%85%E6%A5%9A/%E5%A4%9A%E6%99%BA%E8%83%BD%E4%BD%93%E5%8D%8F%E4%BD%9C_%E7%AC%AC%E4%B8%80%E7%A8%BF_20261014.md)
> - [`E:/program/GIT/Jobs/.../核心设计总览_20261011.md`](file:///E:/program/GIT/Jobs/08_%E7%AE%80%E5%8E%86%E8%AE%BE%E8%AE%A1%E5%B7%A5%E4%BD%9C%E5%8C%BA/02_%E9%A1%B9%E7%9B%AE%E6%89%93%E7%A3%A8%E4%B8%8E%E5%B1%95%E7%A4%BA/%E6%99%BA%E8%83%BD%E4%BD%93%E6%8A%80%E6%9C%AF/%E5%A4%9A%E6%99%BA%E8%83%BD%E4%BD%93%E5%8D%8F%E4%BD%9C/%E6%A0%B8%E5%BF%83%E8%AE%BE%E8%AE%A1%E6%80%BB%E8%A7%88_20261011.md)
> - [`channels/probe/results/taskboard-20261018.md`](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/channels/probe/results/taskboard-20261018.md)

---

## 目录

1. [架构定位与设计哲学](#一架构定位与设计哲学)
2. [三大核心支柱的最小规格要求](#二三大核心支柱的最小规格要求)
   - [2.1 目标与预算（Goal & Budget）](#21-目标与预算goal--budget)
   - [2.2 循环熔断（Loop Breaker）](#22-循环熔断loop-breaker)
   - [2.3 协作图谱与轨迹（Collab Graph & Trajectory）](#23-协作图谱与轨迹collab-graph--trajectory)
3. [三层实体拓扑与数据流闭环](#三三层实体拓扑与数据流闭环)
4. [Web 控制台人机回环（Human-in-the-Loop）交互规格](#四web-控制台人机回环human-in-the-loop交互规格)
5. [历史经典设计对照与直接落地项](#五历史经典设计对照与直接落地项)
6. [分工与落地模块拆解（Implementation Chunks）](#六分工与落地模块拆解implementation-chunks)

---

## 一、架构定位与设计哲学

在《channels/README.md》的“立体认知”四层模型中：
- **L0 单个会话**：各家客户端的原生运行时（Claude Desktop, Codex CLI, Antigravity, OpenCode, ZCode, WorkBuddy）；
- **L1 两个会话之间**：派活单（`DispatchRecord`，`~/.agent-hub/dispatches/`）与唤醒机制（`auto-resume`）；
- **L2 一群会话（Swarm）**：**宿主始终是我们中心**。循环形式是**在协作图谱上一步接一步，每一步做三个决定：下一个是谁、给他什么、停不停**；
- **L3 跨设备/平台**：Tailscale/网关透传。

此前，丙同学已在 [`trace/apps/cli/src/collab/taskboard.ts:1-569`](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/trace/apps/cli/src/collab/taskboard.ts#L1-L569) 中交付了 `TaskBoard` 核心骨架（DAG 依赖解算、环路阻断、席位认领与 `epoch` 防并发、物理派活单联动、单任务返工与熔断）。  
**本方案的使命是在 TaskBoard 这一离散任务看板之上，拔高构建出面向完整业务目标（Swarm Goal）、全局预算治理（Global Budget）、多层级防震荡死循环（Oscillation Loop Breaker）以及全局可观测协作轨迹（Trace Graph）的完整顶层系统。**

```
┌────────────────────────────────────────────────────────────────────────┐
│                        中心宿主（Our Hub Center）                       │
│                                                                        │
│   ┌────────────────────────────────────────────────────────────────┐   │
│   │                      业务目标（Swarm Goal）                     │   │
│   │   - 目标描述与验收标准       - 全局预算（Token/Turns/Cost/Time）  │   │
│   │   - 停滞计数器（Stall Count）- 宏观状态（running/fused/done）    │   │
│   └───────────────────────────────┬────────────────────────────────┘   │
│                                   │ 展开为任务 DAG                      │
│   ┌───────────────────────────────v────────────────────────────────┐   │
│   │                   任务看板（TaskBoard / Tasks）                │   │
│   │   - DAG 拓扑与自动解封       - 认领席位与代数（epoch）           │   │
│   │   - 单任务返工上限（maxRetries）- 产物待验（verifying）           │   │
│   └───────┬───────────────────────────────────────────────▲────────┘   │
│           │ dispatchTask()                                │ deliver    │
│   ┌───────v───────────────────────────────────────────────┴────────┐   │
│   │                 物理派活单（Dispatches 契约）                   │   │
│   │   - issued -> delivered -> seen -> returned 四态回执           │   │
│   │   - 唤醒与插话机制 (wake/interrupt)                            │   │
│   └───────┬───────────────────────────────────────────────▲────────┘   │
└───────────┼───────────────────────────────────────────────┼────────────┘
            │ 真实指令下发                                   │ 结果回传
┌───────────v───────────────────────────────────────────────┴────────────┐
│                    执行端会话集群（Workers & Sessions）                  │
│     Claude Code    /    Codex CLI    /    Antigravity    /    ZCode    │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 二、三大核心支柱的最小规格要求

### 2.1 目标与预算（Goal & Budget）

在离散的单个 Task 之上，必须存在全局的 **Goal** 实体。一个 Goal 对应一次多智能体协同战役（例如“重构认证模块”、“跨平台回归测试”）。

#### 2.1.1 数据结构定义（`GoalRecord`）
```typescript
export interface GlobalBudget {
  maxTotalTokens?: number;       // 全局 Token 硬预算（所有关联派活单累加）
  maxCostUsd?: number;           // 全局成本硬预算（美元）
  maxTotalTurns?: number;        // 全局交互轮次上限
  maxWallClockMs?: number;       // 全局物理时限（超时自动终止整个目标）
  maxParallelTasks?: number;     // 全局最大并发派发数（防 API 限速爆流）
}

export interface BudgetAccumulator {
  consumedTokens: number;
  consumedCostUsd: number;
  consumedTurns: number;
  elapsedMs: number;
  activeDispatches: number;
}

export interface GoalRecord {
  id: string;                    // 目标全局编号，如 goal_20261018_alpha
  title: string;                 // 战役标题
  objective: string;             // 核心使命与业务意图陈述
  acceptanceCriteria: string[];  // 最终验收标准集（客观事实）
  taskIds: string[];             // 关联的逻辑任务 ID 列表（组成 DAG）
  budget: GlobalBudget;          // 预算上限
  usage: BudgetAccumulator;      // 实时消耗累加器
  status: 'planning' | 'running' | 'paused' | 'fused' | 'completed' | 'cancelled';
  verdict: {
    passed: boolean;
    concludedAt?: string;
    finalSummary?: string;
    evaluatedBy?: string;        // 'human' | 'center-agent'
  } | null;
  createdAt: string;
  updatedAt: string;
}
```

#### 2.1.2 最小功能要求（Minimal Requirements）
1. **树/图向分解（Goal $\to$ Task DAG）**：一个 Goal 包含若干 Task，Task 之间具备依赖关系。
2. **底层消耗自底向上累加（Bottom-Up Aggregation）**：
   - 当任一物理派活单 `dsp_...` 产生轮次更新或完成返回时，其消耗的 token、turn 和时间上报并累加至所属 Goal 的 `usage` 中；
3. **预算健康度阶梯（Budget Thresholds）**：
   - **`healthy`（消耗 < 80%）**：正常派发；
   - **`warning`（80% $\le$ 消耗 < 100%）**：向 Web UI 抛出黄色警示，限制并发扇出度（降为 1）；
   - **`exhausted`（消耗 $\ge$ 100%）**：中枢自动挂起（`status = 'paused'`），阻断所有处于 `queued` 态的新任务下发，等待人介入调整预算或终止。
4. **并发流量整流阀（Concurrency Governor）**：
   - 限制同时处于 `dispatched` 状态的任务总数不超过 `maxParallelTasks`（默认 2~3），防止各平台会话并发拥堵引发限速。

---

### 2.2 循环熔断（Loop Breaker）

在多智能体协作中，死循环具有欺骗性与破坏性。根据《多智能体协作_第一稿_20261014》第 4.2 节总结的经验，循环必须分层检测与熔断：

#### 2.2.1 四级防死循环梯度（Four-Tier Loop Breaker）

| 循环层级 | 现象与特征 | 触发判据 | 熔断动作与处理手段 |
|---|---|---|---|
| **L1：单步/工具级死循环** | 单会话内反复调用相同工具入参失败，或模型幻觉打转 | 同一工具入参哈希命中 $\ge 3$ 次，或单轮内连续抛错 $\ge 3$ 次 | 强行终止本轮派活，扣减重试次数，触发会话级中断插话 |
| **L2：单任务返工死循环** | 交付物持续达不到验收标准，打回返工过多 | TaskBoard 已实现：`retryCount > task.budget.maxRetries` | 单任务状态强制置为 `failed`，阻断下游依赖，告警上浮至中枢 |
| **L3：会话间踢皮球震荡** | A 派给 B，B 又推给 A，或 A-B-C-A 环形推诿，代码/产物无实质推进 | **动态派发依赖环路** 且 连续 2 轮交付物文本相似度（Jaccard/Levenshtein）$> 0.85$ | 判定为**协作震荡死循环**（`OSCILLATION_DETECTED`），紧急挂起目标，保留现场供人仲裁 |
| **L4：全局停滞死循环** | 借鉴 Magentic-One 停滞计数：全系统多轮推进但无新产出、无任务完成 | `stallCount >= maxStallTurns`（默认 4 步无任何 Task 状态向 `completed` 前进） | 触发**外循环重规划机制**：清空所有执行端上下文包，重写事实单与执行计划，或转交人拍板 |

#### 2.2.2 循环熔断器接口设计
```typescript
export interface LoopBreakerConfig {
  maxStepRepeats: number;        // 默认 3 次
  maxTaskRetries: number;        // 默认 2 次
  maxStallTurns: number;         // 默认 4 次停滞
  similarityThreshold: number;   // 默认 0.85 震荡阈值
}

export interface FuseEvent {
  level: 'L1_STEP' | 'L2_TASK' | 'L3_OSCILLATION' | 'L4_STAGNATION';
  goalId: string;
  taskId?: string;
  involvedSessions: string[];
  reason: string;
  evidence: {
    fingerprintHash?: string;
    similarityScore?: number;
    stallTurns?: number;
    lastError?: string;
  };
  triggeredAt: string;
}
```

---

### 2.3 协作图谱与轨迹（Collab Graph & Trajectory）

根据《核心设计总览_20261011》第 1 节公理：**协作图谱回答三层怎样连起来，轨迹回答实际发生了什么**。

#### 2.3.1 图谱最小实体（Graph Topology Schema）
- **图节点（Nodes）**：
  1. `GoalNode`：全局战役锚点；
  2. `TaskNode`：逻辑任务（属性包含 `id, title, status, priority, epoch`）；
  3. `SessionNode`：物理会话席位（属性包含 `channel, sessionName, model, cwd, liveState`）。
- **图有向边（Edges）**：
  1. `DependencyEdge`（Task $\to$ Task，类型 `depends_on`）：静态设计拓扑；
  2. `BindingEdge`（Task $\to$ Session，类型 `assigned_to`）：动态绑定关系，带 `epoch`；
  3. `DispatchEdge`（Session $\to$ Task，类型 `produces_for`）：产物交付与反馈边；
  4. `YieldEdge`（Session $\to$ Session，类型 `delegates_to`）：会话间直接协作与插话。

#### 2.3.2 轨迹事件流（Trajectory Event Stream）
所有中枢决策与执行事实记录为统一的不可变时间线事件：
```typescript
export interface CollabTraceEvent {
  eventId: string;
  goalId: string;
  taskId?: string;
  dispatchId?: string;
  timestamp: string;
  causedByEventId?: string;      // 因果因链追踪
  type:
    | 'goal_created'
    | 'task_created'
    | 'dependency_unblocked'
    | 'task_claimed'
    | 'dispatch_issued'
    | 'dispatch_delivered'
    | 'verdict_evaluated'
    | 'rework_requested'
    | 'loop_fused'
    | 'human_intervened';
  actor: {
    type: 'center' | 'agent' | 'human' | 'rule';
    id: string;                  // 如 'center/taskboard', 'claude/session_01', 'human'
  };
  payload: Record<string, any>;
}
```

---

## 三、三层实体拓扑与数据流闭环

中枢运行在统一的持久化目录规范之上：
- **`~/.agent-hub/goals/<goalId>.json`**：目标与全局预算层；
- **`~/.agent-hub/tasks/<taskId>.json`**：任务看板与 DAG 依赖层（TaskBoard 原生）；
- **`~/.agent-hub/dispatches/<dispatchId>.json`**：物理派活与会话通信单（Gateway 原生）。

```
                ┌──────────────────────────────────────┐
                │     Goal (~/.agent-hub/goals/)       │
                │      id, budget, usage, stallCount   │
                └──────────────────┬───────────────────┘
                                   │ 1:N 拥有与聚合
         ┌─────────────────────────┴─────────────────────────┐
         v                                                   v
┌─────────────────────────────────┐                 ┌─────────────────────────────────┐
│   Task A (~/.agent-hub/tasks/)  │  depends_on     │   Task B (~/.agent-hub/tasks/)  │
│ status: completed, epoch: 1     ├────────────────>│ status: queued, epoch: 0        │
└────────────────┬────────────────┘                 └─────────────────────────────────┘
                 │ 1:N 历史/当前执行
                 v
┌──────────────────────────────────────┐
│ Dispatch (~/.agent-hub/dispatches/)  │
│ id: dsp_123, to: {claude, session_1} │
│ receipt: returned, result: files[]   │
└──────────────────────────────────────┘
```

### 3.1 闭环运转四步节拍

1. **下发与认领节拍（Top-Down Dispatch）**：
   - Goal 启动，扫描首批前置依赖满足（`dependencies == []`）的 Task；
   - 处于 `queued` 态的 Task 由中心或会话认领，`epoch += 1`，跃迁为 `claimed`；
   - TaskBoard 调用 `dispatchTask()` 自动构造 `DispatchRecord` 落盘，Task 跃迁为 `dispatched`；
   - 对应产品的会话被网关唤醒执行。
2. **交付与验收节拍（Bottom-Up Delivery & Verdict）**：
   - 会话执行完毕，调用 `deliver` 交付产物，Dispatch 状态转为 `returned/completed`；
   - TaskBoard 巡检到返回，抽取产物放入 `task.deliverables`，Task 跃迁为 `verifying`；
   - 独立裁判（人或验收 Agent）输入 `verifyTask()` 裁决：
     - 若 `passed: true` $\to$ Task 跃迁为 `completed`，自动触发 `unblockDownstream()`，唤醒下游 Task 进入 `queued`；
     - 若 `passed: false` $\to$ 检查 `retryCount`：未超限则退回 `queued`（携带返工指令重新派发），超限则熔断为 `failed`。
3. **预算与停滞巡检节拍（Watchdog Loop）**：
   - 巡检定时器（每 15 秒）核算 Goal 下全部活跃 Dispatch 的资源消耗并刷新 `usage`；
   - 若本轮巡检没有任何任务推进且各会话空转，`stallCount += 1`；
   - 若 `stallCount >= maxStallTurns`，触发 L4 停滞熔断。
4. **终结节拍（Conclude）**：
   - 当 Goal 下全部 Task 达到 `completed` 时，Goal 状态自动跃迁为 `completed`；
   - 若有关键节点 `failed` 且无法绕过，Goal 转为 `fused`，等待人介入重规划。

---

## 四、Web 控制台人机回环（Human-in-the-Loop）交互规格

为了满足“**网页可以和操作 GUI 一样简单，像原生应用一样简单**”以及“**智能体请求审批、向人提问时，人能在网页上直接答**”的要求，Web 端（`m/` 及控制台）必须提供直观的可视化操作面板：

### 4.1 核心视图布局设计

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│ [战役] 重构统一鉴权模块 (Goal: goal_20261018_alpha)                [暂停] [人工接管] [终止] │
│ 进度: [████████████████░░░░] 4/6 任务完成   Token消耗: 45,210 / 100,000   轮次: 18/40 │
├─────────────────────────────────────────────────┬────────────────────────────────┤
│               动态协作图谱 (Interactive DAG)     │         右侧抽屉 / 检查面板     │
│                                                 │                                │
│   ┌──────────────┐     ┌──────────────┐         │ 任务名称: tsk_02 (接口联调)     │
│   │   Task 01    │────>│   Task 02    │         │ 执行者: Claude Code (haiku)    │
│   │  (协议设计)   │     │  (接口联调)   │         │ 状态: verifying (待验收)       │
│   │ [completed]  │     │ [verifying]  │         │ 认领代数: Epoch 1              │
│   └──────────────┘     └──────┬───────┘         │ 交付产物: auth_v2.ts, test.log │
│                               │                 │                                │
│                        ┌──────v───────┐         ├────────────────────────────────┤
│                        │   Task 03    │         │ [ 人机裁决与审批专区 ]          │
│                        │  (跨平台测试) │         │ 验收判定:                      │
│                        │  [blocked]   │         │  ( ) 通过并放行下游            │
│                        │              │         │  (•) 打回返工 (输入返工指令)   │
│                        └──────────────┘         │ [ 提交裁决 (Verdict) ]         │
├─────────────────────────────────────────────────┴────────────────────────────────┤
│ 实时协作轨迹流水 (Live Trajectory Stream via SSE /api/gateway/stream)             │
│ [14:22:01] Task 01 验收通过 (passed by human) -> 下游 Task 02 自动解封为 queued   │
│ [14:22:05] Claude 认领 Task 02 (Epoch 1) -> 物理派活单 dsp_mvdub6ag 下发执行      │
│ [14:23:40] Task 02 提交交付物 (auth_v2.ts) -> 进入 verifying 状态，等待人验收    │
└──────────────────────────────────────────────────────────────────────────────────┘
```

### 4.2 网页端必须支持的六大操作控件

1. **宏观战役控制栏（Swarm Global Controls）**：
   - **一键暂停/恢复（Pause/Resume）**：冻结正在派发中的任务，保持现场；
   - **紧急熔断/取消（Emergency Abort）**：向所有正在跑的派活单下发终止信号；
   - **全局预算滑块（Budget Tuning）**：人在页面动态上调 Token 或轮次上限，解除 `exhausted` 挂起状态。
2. **交互式 DAG 节点操作（DAG Node Actions）**：
   - 节点颜色状态映射：
     - 灰（`blocked`：前置未完成）
     - 黄（`queued`：就绪等待认领）
     - 蓝 + 呼吸光晕（`dispatched`：执行端正在飞速推演）
     - 紫（`verifying`：产物已提交，等待裁判打分）
     - 绿（`completed`：验收通过）
     - 红（`failed` / `fused`：死循环熔断或严重故障）
   - 点击任一节点，展开详情、历史派活单列表与原始提示词。
3. **独立人机验收与打回面板（Verdict & Rework Form）**：
   - 当任务处于 `verifying` 时，页面高亮浮出该卡片；
   - 展示交付物摘要、改动文件列表（点击可调用 Diff 对照查看）；
   - 人可点击 **【同意闭环】**（触发 `POST /api/gateway/tasks/<id>/verify` 带 `passed: true`）；
   - 人可点击 **【打回返工】**（文本框输入具体的改进要求，调用 `passed: false`，状态自动打回 `queued` 并把返工要求精准注入下一轮派活提示词）。
4. **死循环熔断仲裁弹窗（Loop Fuse Alert Modal）**：
   - 当触发 L1~L4 熔断时，页面弹出红色告警模态框，直观呈现熔断原因（如“检测到 Claude 与 ZCode 在任务 2 上产生 3 轮推诿震荡”）；
   - 提供四种人机恢复按钮：
     - **【强制放行】**（忽视熔断，将当前产物强行置为 `completed` 解封下游）；
     - **【改派执行端】**（清空原执行者，重新指定其他合格平台如 Codex 认领）；
     - **【人工注入新提示词重试】**（修改任务目标后重新置为 `queued`）；
     - **【剔除此分支】**（将该任务标记为 `cancelled`，隔离故障）。
5. **智能体提问与审批插话专区（Intervention & Questions）**：
   - 订阅 `/api/gateway/stream` 中的 `agent_question` 和 `pending_approval` 事件；
   - 在页面顶部出现专属问答气泡，人输入文字点击发送，后端通过网关 `interrupt` 机制直接送入对应会话的当前轮次中，实现真人在环协作。
6. **无感轮询与实时推进（Zero-Polling SSE Stream）**：
   - 彻底废弃 6~8 秒的无脑轮询机制；
   - 前端建立 `EventSource('/api/gateway/stream')`，接收到 `task_update`、`goal_update`、`trace_step` 时，局部响应式刷新 DAG 与进度条。

---

## 五、历史经典设计对照与直接落地项

对照《多智能体协作_第一稿_20261014》与《核心设计总览_20261011》的沉淀，以下设计不仅完全自洽，且具备直接落地性：

| 经典设计概念 | 来源出处 | 在本方案中的具体落地实现 | 状态与落地位置 |
|---|---|---|:---:|
| **每一步三个决定**<br>（下一个是谁、给他什么、停不停） | 《第一稿》§1、§5.1<br>《核心设计》§2 | 1. 下一个是谁 $\to$ `task.owner` 席位认领与候选渠道筛选（`eligibleChannels`）<br>2. 给他什么 $\to$ `dispatchTask()` 自动装配逻辑目标、验收条件与返工指令<br>3. 停不停 $\to$ `verifyTask()` 独立裁判、返工计数与循环熔断器 | **直接落地**<br>已在 `taskboard.ts` 落地并实测通过 |
| **四态送达与正面证据**<br>（该知道、送到、读、写） | 《第一稿》§6.2<br>（共同基础理论映射） | 派活单四态回执：`issued`（已出单） $\to$ `delivered`（送到宿主） $\to$ `seen`（被会话读取） $\to$ `returned`（交付产物写回），不依赖沉默假设 | **直接落地**<br>继承自 `~/.agent-hub/dispatches/` 物理规范 |
| **认领代数（`epoch`）防并发悬案** | 《第一稿》§4.2<br>`ap_mind` 精华 | 每次 Task 被重新认领时 `epoch += 1`，派发单元数据严格打上当前 `epoch`，回调时比对代数，彻底防止异步网络慢请求覆盖新轮次 | **直接落地**<br>已在 `taskboard.ts:290` 落地 |
| **防传话衰减：结构化工件隔离** | 《第一稿》§6.3 | 杜绝会话间多跳传话（“传话衰减是常态”），统一通过 `deliverables: { summary, reply, files }` 传递磁盘物理文件与原始事实材料 | **直接落地**<br>`TaskDeliverable` 接口 |
| **双层循环与停滞计数（Stall Count）** | 《第一稿》§4.2<br>Magentic-One 经验 | 内循环为 Task 级执行与返工；外循环为 Goal 级监控，持续多轮无进展时触发停滞计数器熔断并重规划事实单 | **本方案落地**<br>设计纳入 `GoalRecord.usage` 与 `loop_breaker.ts` |
| **反馈严格度光谱**<br>（人 $\to$ 模型 $\to$ 规则判定） | 《第一稿》§7 | `verifyTask` 裁判字段解耦：支持 `by: 'human'`（人工在网页验收）、`by: 'agent'`（监督会话自动化打分）和 `by: 'rule'`（自动化脚本测试） | **直接落地**<br>`TaskVerdict` 统一契约 |
| **设计拓扑 ↔ 观测拓扑 对照** | 《第一稿》§2.2<br>《核心设计》§1 | 静态依赖 DAG（设计拓扑）与时序轨迹事件流（观测拓扑）并在 Web DAG 呈现，一眼看出卡在哪一跳 | **本方案落地**<br>设计纳入 `collab_graph.ts` |

---

## 六、分工与落地模块拆解（Implementation Chunks）

为确保协作开发井然有序，杜绝多人在同一文件产生代码冲突，本架构落地明确拆解为 **4 个高内聚、弱耦合的实现工单（Chunks）**。每个 Chunk 严格限定为**一人、一文件、明确的输入输出契约**：

```
┌────────────────────────────────────────────────────────────────────────┐
│                              分工总览                                  │
│                                                                        │
│   [Chunk 1: 丙] goal_manager.ts ──> 战役目标与全局预算中枢               │
│   [Chunk 2: 丙] loop_breaker.ts ──> 多层级防死循环与震荡监控器           │
│   [Chunk 3: 丁] collab_graph.ts ──> 拓扑组装与轨迹 SSE 投影 API          │
│   [Chunk 4: 乙] swarm_view.js   ──> Web 控制台图谱交互与人机裁决面板     │
└────────────────────────────────────────────────────────────────────────┘
```

### Chunk 1：战役目标与全局预算中枢（`goal_manager.ts`）
- **负责人**：丙（系统与编排核心）
- **唯一新建文件**：[`trace/apps/cli/src/collab/goal_manager.ts`](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/trace/apps/cli/src/collab/goal_manager.ts)
- **职责范围**：
  1. `GoalRecord` 的增删改查与物理落盘（`~/.agent-hub/goals/<id>.json`）；
  2. 将 Goal 分解并批量挂载 Task 到 `TaskBoard`；
  3. 聚合累加各 Task / Dispatch 的 Token、轮次、费用与时间消耗；
  4. 监控全局预算健康度，预算耗尽时自动挂起目标派发并抛出 `budget_exhausted` 事件；
  5. 限制并行运行任务数（`maxParallelTasks` 并发流量整流）。
- **对外暴露接口**：
  ```typescript
  export class GoalManager {
    constructor(taskboard: TaskBoard, customGoalsDir?: string);
    createGoal(params: CreateGoalParams): GoalRecord;
    getGoal(id: string): GoalRecord | undefined;
    listGoals(filter?: { status?: string }): GoalRecord[];
    pauseGoal(id: string, reason?: string): GoalRecord;
    resumeGoal(id: string): GoalRecord;
    reconcileGoalBudget(goalId: string): GoalRecord;
  }
  ```

### Chunk 2：多层级防死循环与震荡监控器（`loop_breaker.ts`）
- **负责人**：丙（系统与编排核心）
- **唯一新建文件**：[`trace/apps/cli/src/collab/loop_breaker.ts`](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/trace/apps/cli/src/collab/loop_breaker.ts)
- **职责范围**：
  1. 订阅 TaskBoard 与 Dispatch 事件，独立于业务逻辑运行看门狗；
  2. 实现 L1（工具重复）、L2（任务返工超限）、L3（跨会话环路震荡与相似度检测）、L4（停滞计数超限）四大判定算法；
  3. 触发熔断时调用 `taskboard.verifyTask(..., { passed: false })` 或 `goalManager.pauseGoal()` 强制刹车；
  4. 产出结构化熔断事件与证据链日志（`~/.agent-hub/fuses/<id>.json`）。
- **对外暴露接口**：
  ```typescript
  export class LoopBreaker {
    constructor(config?: Partial<LoopBreakerConfig>);
    recordStepAction(sessionId: string, tool: string, args: any): void;
    recordTaskDelivery(taskId: string, deliverable: TaskDeliverable): void;
    checkOscillation(dispatchHistory: any[]): { isOscillating: boolean; similarity: number; reason?: string };
    recordStagnationTick(goalId: string, hasProgress: boolean): { stalled: boolean; stallTurns: number };
  }
  ```

### Chunk 3：拓扑组装与轨迹 SSE 投影 API（`collab_graph.ts`）
- **负责人**：丁（API 路由与数据投影）
- **唯一新建文件**：[`trace/apps/cli/src/collab/collab_graph.ts`](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/trace/apps/cli/src/collab/collab_graph.ts)
- **职责范围**：
  1. 读取 `goals/`、`tasks/`、`dispatches/` 以及 `/api/sessions`，实时合成为纯前端友好的图拓扑数据格式（Nodes + Edges）；
  2. 对比静态设计 DAG 与实际执行轨迹，输出节点差分状态；
  3. 将时序事件流格式化为标准 Server-Sent Events（SSE），挂载于 `/api/gateway/stream` 的 `collab_trace` 主题下；
  4. 为 Web 端提供 `GET /api/gateway/goals/:id/graph` 快速直读接口。
- **对外暴露接口**：
  ```typescript
  export class CollabGraphProjector {
    constructor(goalManager: GoalManager, taskboard: TaskBoard);
    assembleTopology(goalId: string): { nodes: GraphNode[]; edges: GraphEdge[]; summary: any };
    getRecentTraceEvents(goalId: string, limit?: number): CollabTraceEvent[];
    projectEventToSSE(event: CollabTraceEvent): string;
  }
  ```

### Chunk 4：Web 控制台图谱交互与人机裁决面板（`swarm_view.js`）
- **负责人**：乙（网页体验与前端交互）
- **唯一新建文件**：[`m/swarm_view.js`](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/m/swarm_view.js)（在 `m/index.html` 中引入，支持路由切换至 `#/swarm`）
- **职责范围**：
  1. 采用原生 Canvas/SVG 实现轻量级 DAG 拓扑图渲染（无外部大型重库依赖），支持高亮、悬停与点击缩放；
  2. 战役仪表盘：进度条、Token 消耗水银柱、暂停与人工接管按钮；
  3. 右侧人机交互抽屉：
     - 当节点为 `verifying` 时展示交付文件与【同意/打回】表单；
     - 当节点为 `fused` 时展示熔断原因与【强制放行/改派/终止】按钮；
  4. 建立 `EventSource('/api/gateway/stream')` 监听，接收到 `collab_trace` 时局部刷新节点高亮与动画，彻底消灭轮询闪烁。

---

## 七、总结与后续路线建议

1. **守住边界**：
   - 本设计恪守“中心始终是宿主，每一步回答三个决定”的根本原则；
   - 严格继承并复用了丙同学在 `taskboard.ts` 建立的原子落盘与 `epoch` 防并发基准；
   - 严格继承了 `~/.agent-hub/dispatches/` 的物理派活协议。
2. **渐进式实施推荐顺序**：
   - **第一步**：由丙在当前无冲突状态下完成 **Chunk 1（`goal_manager.ts`）** 与 **Chunk 2（`loop_breaker.ts`）**，编写独立单元测试验证全局预算与熔断闭环；
   - **第二步**：由丁完成 **Chunk 3（`collab_graph.ts`）**，挂载只读拓扑投影接口并接入 SSE 事件广播；
   - **第三步**：由乙在前端基于投影接口渲染 **Chunk 4（`swarm_view.js`）**，实现页面上点节点、看产物、做审批打回的全流程验收。
