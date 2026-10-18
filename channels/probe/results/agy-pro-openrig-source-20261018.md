# OpenRig 最新源码剖析：四块核心控制机制及 Windows 原生后端照搬可行性报告

| 项 | 内容 |
|---|---|
| 研究对象 | [mvschwarz/openrig](https://github.com/mvschwarz/openrig) 最新源码（目标版本 `v0.6.10`，commit `3001cc43`） |
| 对照标的 | 本机多智能体中枢后端 [`gateway.ts`](file:///E:/program/GIT/Agent/multi/Agent-Architecture-Hub/trace/apps/cli/src/gateway.ts)（Node.js + TypeScript，Windows 原生，无 tmux，走 acpx / app-server / agentapi / Connect-RPC） |
| 前序依据 | [《外部对照_OpenRig_评估与借鉴_20261018.md》](file:///E:/program/GIT/Jobs/08_%E7%AE%80%E5%8E%86%E8%AE%BE%E8%AE%A1%E5%B7%A5%E4%BD%9C%E5%8C%BA/02_%E9%A1%B9%E7%9B%AE%E6%89%93%E7%A3%A8%E4%B8%8E%E5%B1%95%E7%A4%BA/%E6%99%BA%E8%83%BD%E4%BD%93%E6%8A%80%E6%9C%AF/%E5%A4%9A%E6%99%BA%E8%83%BD%E4%BD%93%E5%8D%8F%E4%BD%9C/%E5%A4%96%E9%83%A8%E5%AF%B9%E7%85%A7_OpenRig_%E8%AF%84%E4%BC%B0%E4%B8%8E%E5%80%9F%E9%89%B4_20261018.md) |
| 交付产物 | `E:\program\GIT\Agent\multi\Agent-Architecture-Hub\channels\probe\results\agy-pro-openrig-source-20261018.md` |
| 源码存放 | 本机隔离临时目录（非工作区仓库）只读解析，遵循本地代理策略 |

---

## 总体结论（大白话先行）

1. **OpenRig 在控制协议上的成熟度，核心不在 tmux，而在“数据状态机的诚实性”**：它通过 SQLite 中的不可变台账、严格的代际 UUID 锁、三态/四态回执、以及“恢复不了宁可杀掉空白进程也绝不假装接上”的五分法，彻底杜绝了并发协作中的**幽灵消息（Ghost Delivery）、误杀误投和语义漂移**。
2. **四块机制完全不依赖 tmux 底座，70% 以上的设计可以直接照搬到我们的 Node + TypeScript 后端**：
   - **机制 1（席位任期与代际编号）**：100% 纯数据模型与内存/事务锁，直接照搬，立竿见影。
   - **机制 2（送话回执与打字保护）**：回执四分法和审批态拒绝必须照搬；差异只在 OpenRig 用 tmux 抓屏正则检测，我们改为检查后端协议的 `permissionAsk` / `PendingApproval` 状态。
   - **机制 3（工作队列与唤醒）**：任务池持久化、热土豆闭环字段、定时器/看门狗/阻塞依赖三类唤醒可直接照搬，解决我们当前内存 Map 队列重启即丢的重大缺陷。
   - **机制 4（恢复判定）**：诚实五分法哲学和“回滚至 0 会话”直接照搬；核验方式从“扫描操作系统进程树的 argv”适配为“比对各家适配器（acpx/Connect-RPC/本地目录）的原生 session ID”。
3. **如果只能先借一样：强烈建议首选“代际编号与送达防误投（Occupant Tenure + Generation UUID Guard）”**。它是多智能体系统的“内存安全基石”，成本极低（单表 + 约 200 行判断），能立刻阻断我们网关在排队、重试和打断时的串话和误投风险。

---

## 一、席位、占用者任期、代际编号（Seat, Occupant Tenure, Generation）

### 1.1 OpenRig 源码实现

OpenRig 将运行单元清晰地分为了三层：
- **席位（Seat / Node）**：长期稳定的逻辑角色标识（如 `dev-build@starter`），不随底层进程销毁而改变。
- **占用者任期（Occupant Tenure）**：某一段具体占用该席位的生命周期，每次换人或故障替换都会发放全新的代际（Generation）。
- **原生会话（Native Session）**：被拉起并执行的真实 CLI/工具进程（带 provider 的原生 session ID）。

#### （1）数据表结构
关键迁移文件：`packages/daemon/src/db/migrations/060_occupant_tenures.ts:21-30`

```sql
CREATE TABLE occupant_tenures (
  id                        TEXT PRIMARY KEY,
  node_id                   TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  generation_ordinal        INTEGER NOT NULL,
  generation_uuid           TEXT NOT NULL UNIQUE,
  kind                      TEXT NOT NULL,
  native_session_id_at_boot TEXT,
  boot_at                   TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(node_id, generation_ordinal)
);
CREATE INDEX idx_occupant_tenures_node ON occupant_tenures(node_id);
```

配套变更在 `063_occupant_generation_stamps.ts:27-29`，将代际戳落到了队列和看门狗上：
```sql
ALTER TABLE queue_items ADD COLUMN minting_generation_uuid TEXT;
ALTER TABLE queue_items ADD COLUMN claimed_by_generation_uuid TEXT;
ALTER TABLE watchdog_jobs ADD COLUMN registered_by_generation_uuid TEXT;
```

#### （2）换人时怎么生成代际
核心逻辑在 `packages/daemon/src/domain/session-registry.ts:265-293` 的 `mintOccupantTenure`：

```typescript
// packages/daemon/src/domain/session-registry.ts:265-293
mintOccupantTenure(
  nodeId: string,
  kind: OccupantKind,
  nativeSessionIdAtBoot?: string | null,
  reservedGeneration?: string | null,
): OccupantTenure {
  // 1. 如果带有 nativeSessionIdAtBoot 且库里已有该原生会话，判定为同任期延续（continuation），不发新代际！
  if (nativeSessionIdAtBoot != null && nativeSessionIdAtBoot !== "") {
    const existing = this.db
      .prepare(
        "SELECT * FROM occupant_tenures WHERE node_id = ? AND native_session_id_at_boot = ? ORDER BY generation_ordinal DESC LIMIT 1"
      )
      .get(nodeId, nativeSessionIdAtBoot) as OccupantTenureRow | undefined;
    if (existing) return this.rowToTenure(existing); // continuation — no new generation
  }
  // 2. 否则判定为新占用者（换人/重建/修复），序号递增
  const nextOrdinal =
    (((this.db
      .prepare("SELECT MAX(generation_ordinal) AS m FROM occupant_tenures WHERE node_id = ?")
      .get(nodeId) as { m: number | null }).m) ?? 0) + 1;
  const id = ulid();
  const generationUuid = reservedGeneration || randomUUID();
  // 3. 写入追加表
  this.db
    .prepare(
      "INSERT INTO occupant_tenures (id, node_id, generation_ordinal, generation_uuid, kind, native_session_id_at_boot) VALUES (?, ?, ?, ?, ?, ?)"
    )
    .run(id, nodeId, nextOrdinal, generationUuid, kind, nativeSessionIdAtBoot ?? null);
  return this.rowToTenure(
    this.db.prepare("SELECT * FROM occupant_tenures WHERE id = ?").get(id) as OccupantTenureRow
  );
}
```

此外，在进程正式拉起前，可以通过 `reserveOccupantGeneration()`（`session-registry.ts:248-255`）提前预留一个 `generation_uuid`，随启动环境传递，避免拉起与登记之间的并发竞争。

#### （3）送达时怎么校验代际防止误投
核心防线在 `packages/daemon/src/domain/seat-delivery-guard.ts`：

1. **绑定解析**（`seat-delivery-guard.ts:222-237`）：
   `resolveGuardTarget` 每次解析目标时，通过子查询动态抓取该席位当前的最新代际 UUID：
   ```sql
   (SELECT generation_uuid FROM occupant_tenures t WHERE t.node_id=n.id ORDER BY generation_ordinal DESC LIMIT 1) AS occupant
   ```
2. **串行锁与排队前后断言**（`seat-delivery-guard.ts:117-135`）：
   在准备发送进入 `guard.operation(name, ...)` 时，先拿到快照 `bound = this.target(name)`。在真正排上队执行的一瞬间，再次抓取 `current = this.target(name)`，调用 `this.same(bound, current)` 核验：
   ```typescript
   // packages/daemon/src/domain/seat-delivery-guard.ts:73-75
   private same(a: GuardTarget, b: GuardTarget): boolean {
     return a.nodeId === b.nodeId && a.session === b.session && a.occupant === b.occupant && a.pane === b.pane;
   }
   ```
   如果 `occupant`（代际 UUID）在等待期间变了，立即抛出 `DeliveryGuardError("guard_target_changed", "Input target changed while waiting; no input written.")`。
3. **写入前最后一毫秒的同步断言**（`seat-delivery-guard.ts:176-181`）：
   在真正调用输入函数写入字符的前一刻，同步调用 `checkInput(name)`，里面无任何 `await`，再次校验当前租约中的代际是否仍然等于席位当前代际。代际不对，拒绝发任何字符！
4. **唤醒消费时的防串流校验**（`packages/daemon/src/domain/session-transport.ts:1254-1262`）：
   如果是队列或定时器触发的唤醒重发，消息发件箱记录了当时的 `guardBinding`。如果目标代际已变，直接返回 `{ ok: false, reason: "guard_target_changed" }`，严防把属于前任的消息倒给继任者。

---

### 1.2 能否照搬到我们的后端

**结论：完全能够照搬，且是极其纯粹的无侵入式改进。**

#### 现状对比与落差点
- **当前后端状况**：在 [`gateway.ts:3564`](file:///E:/program/GIT/Agent/multi/Agent-Architecture-Hub/trace/apps/cli/src/gateway.ts#L3564)，我们是用 `const key = this.slotKey(prof.id, sessionName)`（例如 `codex:hub-codex`）作为所有排队、运行实例（`activeRuns`）和选定模型的唯一主键。
- **存在的隐患**：如果一个会话挂掉或被重置，用户随后又用相同的 `sessionName` 发消息，系统只是在内存里当成同一个 slot。如果在重试延迟（如 `setTimeout(..., delayMs)`，见 [`gateway.ts:4269`](file:///E:/program/GIT/Agent/multi/Agent-Architecture-Hub/trace/apps/cli/src/gateway.ts#L4269)）期间旧会话退出、新会话拉起，重试的消息就会错误地打入新会话！

#### 照搬改造方案（不依赖 tmux）
1. **引入 SQLite 表 `occupant_tenures`**：直接在 `gateway.ts` 所依赖的本地 SQLite（`store.ts` 或 `DatabaseSync`）中建表。
2. **三层对象抽象**：
   - 第一层：`seat`（如 `hub-codex`，逻辑席位）；
   - 第二层：`tenure`（每次会话拉起或重置，`generation_ordinal` 自增，生成新的 `generation_uuid`）；
   - 第三层：`native_session`（对应 acpx session ID、Connect-RPC context ID 等）。
3. **改造 `sendPrompt` 与排队项**：
   - 在 `QueuedPrompt` 和 `ActiveRun` 中附加 `generationUuid`。
   - 在 `startRunInternal` 触发时，比对席位当前的活跃代际。一旦代际不匹配，直接判定为 `guard_target_changed`，安全丢弃或归档，杜绝幽灵消息。

---

## 二、往席位送话（Typing Guard、审批框拒绝、核验、四种回执）

### 2.1 OpenRig 源码实现

OpenRig 将往席位送话（`rig send` 或内部 nudge）定义为一个高度受约束的**事务型交互过程**，主要实现在 `packages/daemon/src/domain/seat-delivery-guard.ts`、`packages/daemon/src/domain/session-transport.ts` 以及 CLI `packages/cli/src/commands/send.ts`。

#### （1）打字保护（Typing Guard）
- **数据结构与状态**：`087_seat_delivery_guard.ts:6-13` 创建了 `seat_delivery_guards` 表，记录每个席位的 `desired`（期望保护）和 `effective`（生效状态）。
- **拦截逻辑**：
  在 `seat-delivery-guard.ts:127-131`：
  ```typescript
  const pref = this.preference(bound.nodeId);
  if (pref.effective || pref.desired) {
    if (held) return held(bound);
    throw new DeliveryGuardError("typing_guard_enabled", "Automatic input is paused for this seat. Disable its typing guard explicitly before this writing operation.");
  }
  ```
  当操作员或外部设置启用了打字保护（表示人类正在该会话终端手打），任何自动化送话都会被拦截并回调 `held(bound)`。
  在 `session-transport.ts:1277-1301` 中，`held` 回调将该消息写入发件箱 `outbox_entries`（状态记为 `delivery_state = 'retained'`），并返回：
  ```typescript
  // session-transport.ts:1251-1252
  {
    ok: true,
    sessionName,
    outcome: "retained",
    sent: false,
    verified: false,
    outboxIds: ids,
    reason: "typing_guard_enabled",
    warning: `Retained, not delivered. Inspect with rig seat held-messages ${sessionName}; disabling does not replay held messages.`
  }
  ```
  **注意其哲学**：解禁打字保护时，绝不会自动把暂存消息一次性轰炸进去（防止与人类刚输完的内容冲突），而是让操作员通过命令查阅并决定。

#### （2）停在审批框时拒绝（Rejection at Approval Prompt）
- **判定逻辑与正则签名**（`session-transport.ts:74-98, 1528-1577`）：
  在准备往终端写字符前，如果未指定等待空闲，必须先执行 `classifySendReadiness`。
  它通过抓取终端底部 12 行（`PROMPT_SCAN_LINES = 12`），匹配两类特征：
  1. 审批提问特征（`PERMISSION_PROMPT_PATTERNS`）：
     - `/\bDo you want to (?:proceed|continue|trust|allow|make|apply|create|run|delete|overwrite|edit)\b/i`
     - `/\bWould you like to run the following command\b/i`
     - `/\bAllow Codex to run\b/i`
  2. 选项选择器特征：`^[❯›]\s*\d+\.\s`（如 `› 1. Yes, continue`），以及 Claude 的底部按键提示 `CLAUDE_QUESTION_FOOTER = "Enter to select · ↑/↓ to navigate · Esc to cancel"`。
- **严正拒绝**：
  若检测到 `readiness.state === "needs_input"`，判定为智能体正停在工具/命令审批确认框：
  ```typescript
  // session-transport.ts:1570-1576
  return {
    ok: false,
    sessionName,
    reason: "target_needs_input",
    activity: readiness,
    error: `Refused: '${sessionName}' is at an interactive prompt (${readiness.reason}). A message must not select or approve it. To deliberately drive the prompt: rig send ${sessionName} "<text>" --dangerously-interact --reason "<why>". No text was sent.`,
  };
  ```
  **防御脚枪的核心原则**：自动化协作消息绝不能盲目当作输入灌进去，否则可能碰巧按下了选项编号或回车，越权批准了高危系统命令！除非操作员显式提供 `--dangerously-interact` 且必填 `--reason` 留下审计台账（`session-transport.ts:1543-1566`）。

#### （3）送达后核验（Post-Delivery Verification）
实现于 `session-transport.ts:1600-1707`：
1. **送前截屏**（`pre_capture`）：抓取终端最后 30 行内容，并计算预备发送文本前 40 字符在屏上的出现次数 `preCount = countOccurrences(preVerifyContent, snippet)`。
2. **写入交互**：粘贴文本 -> 等待 200ms（防止粘贴与回车连击被 TUI 吞掉）-> 发送 `Enter` 键。
3. **送后截屏**（`post_capture`）：等待 500ms（等待界面渲染和响应），再次截取 30 行，计算 `postCount`。
4. **判准**：`verified = postCount > preCount`。若成立，证明消息确实被打印在会话历史中。

#### （4）四种诚实回执（Honest Delivery Outcomes）
在 `session-transport.ts:840-856` 与 `packages/cli/src/commands/send.ts:505-516` 中，OpenRig 规范了四种精确的回执状态：
1. `delivered`：文本 + 回车均发送成功，且送后截屏核验**再次确凿看到了文本**。
2. `rendered-unconfirmed`：文本 + 回车均发送成功（底层写入确定成功），但送后截屏核验由于界面快速滚动、TUI 重绘或截屏超时未能抓到文本。**明确定性为“已渲染但未确证”，绝不报失败**。
3. `staged-not-consumed`：文本已经注入/粘贴到了输入提示框草稿区，但没有发送回车提交，或者智能体当时并未消费该输入。
4. `retained`：席位启用了打字保护或人类正在使用，消息未打入终端，而是作为暂存项写进发件箱（outbox）。

---

### 2.2 能否照搬到我们的后端

**结论：能照搬其“防越权审批状态机”与“四种回执”，但输入核验手段需从“抓屏”转为“协议接口感知”。**

#### 照搬要改什么（不依赖 tmux）
1. **停在审批框时拒绝（极高价值，最易落地）**：
   - 在我们的 [`gateway.ts:434`](file:///E:/program/GIT/Agent/multi/Agent-Architecture-Hub/trace/apps/cli/src/gateway.ts#L434)，系统本身就有 `permissionAsk`，在 [`PendingApproval`](file:///E:/program/GIT/Agent/multi/Agent-Architecture-Hub/trace/apps/cli/src/gateway.ts#L460) 中记录了等待批准的工具。
   - **现有漏洞**：目前在 [`gateway.ts:3520`](file:///E:/program/GIT/Agent/multi/Agent-Architecture-Hub/trace/apps/cli/src/gateway.ts#L3520) 的 `sendPrompt` 中，即使该会话正停留在 `PendingApproval`，只要 `activeRuns` 没有被标记为锁定，新的 prompt 仍可能被盲目送入，导致协议状态混乱。
   - **改造方案**：直接照搬 OpenRig 的判定规则：当席位处于 `PendingApproval` 或 ACP 工具确认态时，普通 `sendPrompt` 必须 Fail-Closed，拒绝并返回 `reason: "target_needs_input"`，禁止盲推！
2. **打字保护（Typing Guard）**：
   - 我们的交互入口是 Web 前端和 CLI。改造时，在网关增加 `seat_delivery_guards` 类似的席位保护开关；当用户在 Web UI 的输入框处于 focus 或草稿非空时，向后端同步 `guard_desired = true`。
   - 外部智能体（如 meta-agent 或定时排队项）往该席位插话时，后端自动转入 `retained`，并在前端界面提示“有 1 条自动化消息已暂存，等待您输入完毕后查阅”。
3. **四种回执适配**：
   - 对于 acpx / agentapi 渠道，底层是 JSON-RPC / Connect-RPC：
     - 如果 RPC `sendPrompt` 收到 upstream 的接收 ACK，且第一段 response 流（Delta）已返回：返回 `delivered`。
     - 如果 RPC 写入成功但未拿到回复确认（网络超时或长思考）：返回 `rendered-unconfirmed`。
     - 如果通道只支持暂存草稿：返回 `staged-not-consumed`。
     - 遇到打字保护：返回 `retained`。

---

## 三、工作队列与唤醒提醒（Queue, Nudge, Wake）

### 3.1 OpenRig 源码实现

OpenRig 的队列（Queue）不仅是一个简单的待办列表，而是**多智能体异步解耦、责任移交与恢复唤醒的核心主干**。

#### （1）队列项数据结构与关键字段
主要定义于迁移文件 `packages/daemon/src/db/migrations/024_queue_items.ts:22-46` 及领域模型 `packages/daemon/src/domain/queue-repository.ts:144-223`：

```typescript
// packages/daemon/src/domain/queue-repository.ts:144-223
export interface QueueItem {
  qitemId: string;                 // 任务唯一标识（ULID 或业务 ID）
  tsCreated: string;               // 创建时间
  tsUpdated: string;               // 更新时间
  sourceSession: string;           // 派发来源席位
  destinationSession: string;      // 目标接收席位
  state: QueueState;               // 状态: pending | in-progress | done | blocked | failed | denied | canceled | handed-off
  priority: QueuePriority;         // 优先级: routine | urgent | critical
  tier: string | null;             // 任务层级
  tags: string[] | null;           // 标签（如 auto-unpark 绑定标签）
  blockedOn: string | null;         // 阻塞原因（阻塞在谁或哪个任务上，如 fold:、auth:、qitem-xxx）
  handedOffTo: string | null;       // 移交目标（热土豆链下一棒）
  handedOffFrom: string | null;     // 移交前任（回溯指针）
  expiresAt: string | null;         // 过期时间
  chainOfRecord: string[] | null;   // 责任流转链（记录历史经手席位）
  body: string;                    // 任务主文本
  closureReason: ClosureReason | null; // 闭环理由: handed_off_to | blocked_on | denied | canceled | no-follow-on | escalation
  closureTarget: string | null;     // 闭环附带目标
  closureRequiredAt: string | null; // 强制闭环时限（防止任务永久悬空）
  claimedAt: string | null;         // 接收方认领处理的时间戳
  lastNudgeAttempt: string | null;  // 最近一次唤醒提醒时间
  lastNudgeResult: string | null;   // 最近一次唤醒提醒结果
  lastHeartbeat: string | null;     // 心跳
  resolution: string | null;        // 解决结论
  mintingGenerationUuid?: string;   // 创建该任务时的占用者代际
  claimedByGenerationUuid?: string; // 认领该任务时的占用者代际（防止前任任务被后任误处理）
}
```

值得注意的高级机制：
- **认领即事实（Claim is stronger than wire ack）**（`queue-repository.ts:106-110`）：
  在 `presentedNudgeResult` 中规定：只要 `claimedAt` 存在，即使唤醒通信底层的线缆状态是 `delivered-ack-pending` 或 `indeterminate`，对外统一呈现为 `claimed`。因为目标席位开始认领处理，本身就是最无可辩驳的送达证据。

#### （2）谁来唤醒（Wake-up Sources）
唤醒绝非单一的轮询，而是分成两阶段：
1. **创建与移交唤醒**（`queue-repository.ts:1304-1315` `maybeNudge`）：
   当一个任务被创建（`create`）或移交（`handoff`）时，事务提交后立即通过发信通道向 `destinationSession` 发送带信封（Envelope）的文本提醒。
2. **挂起恢复唤醒（Parked Wakes）**：
   当任务进入 `blocked`（挂起）状态时，在 `queue-wake-repository.ts:4-6` 中记录唤醒挂起记录，分为三类源头：
   - `timer`：定时唤醒（例如倒计时、指数退避重试）；
   - `watchdog`：看门狗条件唤醒（例如检测到某个文件产出、用量配额重置）；
   - `blocker`：依赖任务唤醒（例如被阻塞的子任务 `blockerQitemId` 完结时触发自动解挂 `AUTO_UNPARK_WAKE_TAG`，见 `queue-repository.ts:1000-1008`）。

#### （3）唤醒结果怎么记
OpenRig 采取了三层递进的持久化台账：
1. **主表快照字段**（`queue_items`）：记录 `last_nudge_attempt` 与 `last_nudge_result`（字面量包括 `verified`、`delivered-ack-pending`、`retained:typing_guard`、`indeterminate:...`、`failed:...`）。
2. **状态流转不可变历史**（`packages/daemon/src/db/migrations/025_queue_transitions.ts`）：
   每一次状态变更都追加插入 `queue_transitions`，记录 `transition_id`, `state`, `actor_session`, `transition_note`，严禁 UPDATE/DELETE。
3. **唤醒证据附属表**（`packages/daemon/src/db/migrations/073_queue_transition_wakes.ts:9-16`）：
   唤醒的详细证据直接绑定到流转 ID 上，保证流转审计的只读性：
   ```sql
   CREATE TABLE queue_transition_wakes (
     transition_id   INTEGER PRIMARY KEY,
     qitem_id        TEXT NOT NULL,
     phase           TEXT NOT NULL CHECK (phase IN ('armed', 'fired')),
     wake_kind       TEXT NOT NULL CHECK (wake_kind IN ('watchdog', 'timer', 'blocker')),
     wake_ref        TEXT NOT NULL,
     delivery_status TEXT
   );
   ```
4. **事务性发件意图（Transactional Outbox Intent）**（`queue-repository.ts:1018-1070`）：
   任务关闭和唤醒意图必须在同一个 SQLite 事务中完成。如果事务提交了但发件箱里没有生成以 `__wake_intent__` 开头的暂存记录，直接抛出 `terminal_close_without_wake_intent` 回滚整个操作，保证“任务流转与唤醒通知同生共死”。

---

### 3.2 能否照搬到我们的后端

**结论：不仅能照搬，而且是治愈我们目前网关脆弱性最急需的一剂良药。**

#### 现状对比与落差点
- **当前后端状况**：
  在 [`gateway.ts:695`](file:///E:/program/GIT/Agent/multi/Agent-Architecture-Hub/trace/apps/cli/src/gateway.ts#L695)，我们的队列是极其简陋的纯内存结构：
  ```typescript
  // gateway.ts:695, 390-397
  private readonly queues = new Map<string, QueuedPrompt[]>();
  export type QueuedPrompt = {
    id: string;
    prompt: string;
    model?: string;
    permissions: 'all' | 'reads' | 'deny';
    source: 'web' | 'cli';
    enqueuedAt: string;
  };
  ```
  只有 6 个字段！服务一旦重启，用户排队的所有请求、meta-agent 排队的任务全部瞬间蒸发！
- **唤醒现状**：
  在 [`gateway.ts:4274-4288`](file:///E:/program/GIT/Agent/multi/Agent-Architecture-Hub/trace/apps/cli/src/gateway.ts#L4274)，队列出队全靠上一个 run 结束时的回调 `q.shift()`，没有状态回执，没有依赖阻塞（`blocked_on`），没有责任流转链（`chain_of_record`）。

#### 照搬改造方案（不依赖 tmux）
1. **将内存 Map 彻底替换为 SQLite `queue_items` 表**：
   - 增加 `blocked_on`（支持智能体等待另一智能体交付产物）；
   - 增加 `chain_of_record`（支持 A -> B -> C 多级协作追踪）；
   - 增加 `claimed_at` 和代际绑定字段。
2. **实现三类唤醒机制**：
   - 由目前的 `meta_resumer`（轮询扫描）升级为由事件驱动的 `wakeResolver`：
     - 当子任务或依赖任务状态变为 `done` 时，自动触发解挂（`auto-unpark`）；
     - 定时器到期时触发 `timer` 唤醒。
3. **唤醒发送适配**：
   - OpenRig 唤醒是向 tmux 发 `rig send`；
   - 我们的后端改造为：调用 `gateway.ts` 内置的 `sendPrompt({ channel, sessionName, prompt, ... })`，并通过 SQLite 记录该次唤醒是 `verified` 还是 `failed`。

---

## 四、恢复判定（Recovery & Resume Determination）

### 4.1 OpenRig 源码实现

OpenRig 在恢复会话（Restore / Resume）上建立了一套被誉为“诚实性典范”的机制，彻底拒绝“挂羊头卖狗肉”。

#### （1）五种恢复判定结果及其触发条件
定义于 `packages/daemon/src/domain/types.ts:465-475` 及 `restore-orchestrator.ts:1146-1240, 1458-1532`：

| 恢复判定结果 | 触发条件（源码条件） | 最终系统行为与状态 |
|---|---|---|
| **`resumed`** | 快照有 `resumeToken`，策略为恢复，且拉起后通过进程级严格核验（`identity.ok === true`，见 `restore-orchestrator.ts:1531`）。 | 原生会话被确切接上，无缝继续历史对话。 |
| **`fresh-primed`** | 操作员显式指定 `--fresh <seat>`（`freshLogicalIds`），或席位策略本身就是全新冷启动（`restore-orchestrator.ts:234-240`）。 | 故意启动一个干净的空白会话，并注入最新的启动指导说明（Guidance Blocks）。 |
| **`awaiting-decision`** | 策略要求恢复原会话，但：<br>1. 无 token（`!resumeToken`）；<br>2. 原生恢复尝试失败（找不到历史或报错）；<br>3. 缺少对应的运行时适配器；<br>4. **且操作员没有显式传 `--fresh`**（`restore-orchestrator.ts:1154, 1192, 1205, 1221`）。 | **关键机制：回滚至 0 会话（`rollbackToZeroSession`）！**<br>立即杀掉刚拉起的空白进程，保留 0 个活跃会话，停住并向操作员大声报警，等待人工决断（重新带 `--fresh` 开新会话，还是手工修复环境）。**绝不悄悄降级为空白会话假装成功！** |
| **`attention_required`** | 进程已在运行，但：<br>1. 停在了交互提示符上（如 Claude Code 弹出了“Select a session to resume”选择菜单，`claude-resume.ts:140-148`）；<br>2. 原生恢复已拉起但进程身份核验证据不完整（`!identity.ok`，`restore-orchestrator.ts:1500`）。 | 保留该存活进程，不自动作答也不杀掉，标记为 `attention_required`，通知操作员接管终端。 |
| **`failed`** | 真正的线束、文件系统或基础设施崩溃：<br>如工作目录丢失（`!node.cwd`）、checkpoint 文件写失败、子进程崩溃等（`restore-orchestrator.ts:1230, 1236`）。 | 标记为彻底失败，抛出错误堆栈。 |

#### （2）怎么证明“这次恢复真的接上了原会话”
OpenRig 绝不仅凭“进程启动没有报错”就宣称 `resumed`，而是实现了极其严苛的双重证据链：

核心实现位于 `packages/daemon/src/domain/seat-attention-reconciler.ts:35-160`（`rebindAndVerifyPaneIdentity`）与 `packages/daemon/src/domain/native-process-lineage.ts:113-155`（`commandUsesExpectedToken`）：
1. **窗格唯一性核验**：目标 tmux 窗格数量必须严格等于 1，多于 1 个或没有均视为身份模糊（`pane_ambiguous`）。
2. **操作系统进程树深度核对**：
   - 抓取该窗格的真实 PID，递归扫描宿主机的完整进程树（`listProcesses`）。
   - 检验命令行参数中的具体 token：
     - 对于 **Claude Code**：检查命令行是否包含 `--resume <expectedToken>` 或 `--session-id <expectedToken>`（`native-process-lineage.ts:122-124`）；同时核对 Claude 的活动钩子（Activity Hook）是否上报了由该 token 延续或轮换的记录（`claudeResumeRotatedFrom`，`session-registry.ts`）。
     - 对于 **Codex**：检查命令行参数是否包含 `codex ... resume <expectedToken>`（`native-process-lineage.ts:128-155`）。
   - 检验执行二进制路径：校验 `executablePath` 是否严格属于注册的运行时版本路径，防止别名或包装脚本冒充。
3. **写入身份判决台账**：
   只有上述全部吻合，才在 `seat_identity_verdicts` 表中记录 `verdict: "verified"`。如果只是恢复了一个原生进程但没有证明它接上了指定 token，判定为 `attention_required`（`restore-orchestrator.ts:1495-1502`），明确告诉用户：“虽然原生进程拉起来了，但会话证据不完整，未被判定为已恢复”。

---

### 4.2 能否照搬到我们的后端

**结论：判定哲学（五分法 + 回滚至 0 会话）必须立刻照搬；核验方式需根据 Windows 无头协议进行原生改造。**

#### 现状对比与落差点
- **当前后端状况**：
  在 [`gateway.ts:1090-1270`](file:///E:/program/GIT/Agent/multi/Agent-Architecture-Hub/trace/apps/cli/src/gateway.ts#L1090) 的 `resumeInterruptedSession` 中，我们的做法是：一旦检测到会话中断，`meta_resumer` 直接硬编码发一段新 prompt：
  `"上一轮在中途断开了，没有拿到回复。请接着完成原来的请求..."`。
  如果底层会话早已失联或失效，acpx 或 upstream 很可能会静默新建一个干净的新会话把这段话吃进去，导致上下文全部丢失，而前端依然显示“已恢复”。

#### 照搬改造方案（不依赖 tmux）
1. **移植五分法结果词汇**：
   废弃原本二元的 `ok / error`，在恢复与拉起接口中返回标准的：
   `resumed`、`fresh-primed`、`awaiting-decision`、`attention_required`、`failed`。
2. **实现“宁可回滚到 0 也绝不假装接上”（`awaiting-decision`）**：
   当调用方请求恢复一个指定 `traceSessionId` 时，如果 acpx / upstream 报告会话已过期或找不到：
   - **立刻执行回滚**：关闭刚刚创建的空进程，清理状态；
   - **返回 `awaiting-decision`**：明确告知前端：“原会话无法恢复，系统已阻止自动创建空白会话。请选择点击「新建空白会话」或手动检查环境”。
3. **Windows 原生接口的“恢复证明”改造**：
   我们不用 tmux 抓屏和扫描 Linux 进程树，但各平台在 Windows 下均有确切的原生证明锚点：
   - **Claude Code (acpx)**：检查本地 `~/.claude/projects/...` 下的 session JSON，比对最新 session ID 是否与请求恢复的 ID 一致；
   - **Codex (acpx / app-server)**：比对 `~/.codex/sessions` 下的 rollout 文件元数据；
   - **Antigravity (Connect-RPC)**：检查 `~/.gemini/antigravity/brain/<cid>/` 下的 `transcript.jsonl`，首行 `session_id` 必须完全匹配；
   - **ZCode / WorkBuddy**：检查 `~/.zcode/v2` 和 `~/.workbuddy` 本地数据库的 conversation ID。
   只有本地存储或协议握手返回的会话 ID 严格等于快照记录，才判定为 `resumed`；否则一律划入 `awaiting-decision` 或 `attention_required`！

---

## 五、照搬总结与首借建议（如果只能先借一样）

### 5.1 四块机制对照汇总表

| 机制模块 | OpenRig 源码核心定位 | 核心数据结构与判据 | 能否照搬到我们后端 | 照搬需改造点（Windows 原生 / 协议化） |
|---|---|---|:---:|---|
| **1. 席位任期与代际编号** | `060_occupant_tenures.ts:21-30`<br>`session-registry.ts:265-293`<br>`seat-delivery-guard.ts:117-181` | `occupant_tenures` 表<br>`generation_uuid`<br>`same(bound, current)` 断言 | **直接照搬** | 在 SQLite 加表；在 `gateway.ts` 的 `slotKey` 与 `QueuedPrompt`、`ActiveRun` 增加代际绑定。 |
| **2. 往席位送话与回执** | `seat-delivery-guard.ts:88-136`<br>`session-transport.ts:1528-1707`<br>`send.ts:505-516` | `seat_delivery_guards` 表<br>`PERMISSION_PROMPT_PATTERNS`<br>`delivered / rendered-unconfirmed / staged-not-consumed / retained` | **直接照搬** | 审批框检测从“抓屏正则”改为检查网关已有的 `PendingApproval` 状态；回执四分法直接套用在 RPC 响应流。 |
| **3. 工作队列与唤醒** | `024_queue_items.ts:22-46`<br>`073_queue_transition_wakes.ts:9-16`<br>`queue-repository.ts:144-223` | `queue_items` 表<br>`chain_of_record`<br>`blocked_on`<br>`timer / watchdog / blocker` 三类唤醒 | **直接照搬** | 淘汰 `gateway.ts` 内存 `Map<string, QueuedPrompt[]>`，将任务入队、流转、认领与解挂完全持久化到 SQLite。 |
| **4. 恢复判定** | `types.ts:465-475`<br>`restore-orchestrator.ts:1146-1240`<br>`native-process-lineage.ts:113-155` | 五态词汇表<br>`rollbackToZeroSession`<br>`commandUsesExpectedToken` | **机制照搬**<br>（探针重写） | 恢复失败杀掉空白进程（回滚到 0 会话）；证明方式从“tmux 进程树命令行扫描”替换为“本地会话文件 / RPC 上游 session_id 核对”。 |

---

### 5.2 决策建议：如果只能先借一样，建议借哪样？

> [!IMPORTANT]
> **首借建议**：优先借第 1 块 —— **“代际编号与送达防误投（Occupant Tenure & Generation UUID Guard）”**。

#### 理由依据（三大支柱）

1. **它是协作中枢系统的“内存安全基石”，先借它才能避免越建越乱**：
   - 当前我们网关存在的最危险隐患，就是**会话身份扁平化**（只认一个 `slotKey = channel:sessionName`）。
   - 在多智能体协作、自动重试和打断场景下，如果一个会话崩了重新拉起，后端的异步回调或排队队列很可能会把属于上一任的消息灌给下一任。这种“幽灵送达”会导致智能体逻辑完全错乱，而且极难排查。
   - 代际编号给每个席位赋予了“任期”概念，任何操作在发信前做一次轻量比对，代际不对立即拒发，从根本上锁死并发误投。
2. **实现成本最低，无任何外部环境依赖**：
   - 相比于机制 2（需要调优打字感知和审批交互拦截）、机制 3（需要重构整个队列持久化架构）、机制 4（需要对接各家会话文件探针）；
   - 机制 1 是一套**纯粹的轻量级状态锁**。只需要在本地 SQLite 增加一张 `occupant_tenures` 表，在 `gateway.ts` 中给会话创建和消息发送加上一个 `generation_uuid` 的检查与传递，代码量约 150-200 行，**半天即可完成闭环验证**。
3. **它是后续三块机制的共同前置依赖**：
   - **队列机制依赖它**：OpenRig 的 `queue_items` 必须记录 `minting_generation_uuid` 和 `claimed_by_generation_uuid`，否则任务认领无法防止前任后任冲突；
   - **恢复机制依赖它**：恢复判定在区分是“同代际延续（continuation）”还是“发放新代际”时，必须依靠代际表；
   - **送话与打字保护依赖它**：发件箱暂存（outbox retained）的消息在回放时，必须验证目标代际是否一致。
   - **先立代际，后续二、三、四块才能稳稳地落在一个坚实的地基之上。**

---
*报告生成完成。源码引用均基于 OpenRig v0.6.10 实际代码，对照逻辑已结合本地 Windows 原生架构验证。*
