# 协作观察台：设计规格

日期：2026-10-09，10-10 改道。本文是观察台的设计依据，写给所有参与开发的人和智能体。设计来源：
`E:\program\GIT\Jobs\08_简历设计工作区\02_项目打磨与展示\智能体技术\多智能体协作\可视化架构_统一模型与六种视图_20261009.md`。

**改道（10-10）**：观察台不再是一个独立页面，而是叠加在原项目页面上的一个模式。原页面是仓库根目录的 `index.html`（Agent Architecture Designer v41，用户已本地化为中文）。它的画布、节点卡片、连线、侧栏、右侧详情、状态栏、配色和图标都照用；我们只往里加“观察”模式。原因：10-09 那版另起炉灶的界面，用户评价“好丑”，要求“复用技术栈或者直接在原代码上改”。`hub/index.html` 那套旧外壳作废。

---

## 1. 一句话

把 62 个团队预设变成 62 个“协作案例”：每个案例有定义（编排）、模拟运行出来的事实、以及分析结果；在原页面的画布上用六种常用视图去看它，视图之间只改观察状态的一两项，卡片原地移动，所以切换顺滑。

## 2. 硬规则（所有模块都要遵守）

1. **零新增依赖**：不加任何外部库、CDN、npm、构建步骤（原页面自带的 Google Fonts 保留）。纯 HTML + CSS + 原生 JS。
2. **经典脚本**：每个 JS 文件是一个 IIFE，只往 `window.HUB` 上挂东西，不用 ES module（要能用 file:// 直接打开）。
3. **沿用原页面的视觉语言**：个体就是原页面的 `.nd` 卡片（同样的 HTML 结构和类名），详情用原页面的 `.ds-*` 类，按钮用 `.btn`，颜色只用原页面的 CSS 变量（`--ph-*` 阶段色、`--mc-*` 模型色、`--accent1~4`、`--t1~3`、`--bg-panel`、`--brd` 等）。新增的东西（部门卡、分组框、判断点、决策卡）按同一套风格画。
4. **少改原代码**：原页面只加几处带 `/* hub */` 注释的钩子；我们的逻辑都在 `hub/js/obs/` 里。设计模式（原来的编辑器）必须照常可用。
5. **界面全中文**，文字朴素。
6. **所有数据来自 `HUB.model`**。不要在视图里编造数字。模拟出来的事实一律标“模拟数据”。
7. **对象用稳定编号**：卡片、框、线都按 `data-key` 复用，状态变化时原地补间，不整块重建。
8. **性能**：最大案例 27 个个体、上千条事实，每次状态变化的更新要在 30 毫秒内完成。

## 3. 文件布局

```
index.html            原页面。只加：顶栏的“观察｜设计”切换、zastTransf 里同步观察层、ladujPreset 里通知观察台、末尾加载 hub 脚本
hub/
  SPEC.md             本文
  css/obs.css         观察模式的全部样式（前缀 ob-），用原页面的变量
  css/collab.css      协作轨迹图的样式（前缀 obc-），线和标记用 obs.css 里已有的含义色
  data/base.js        由 tools/extract_base.js 从原页面生成（测试也用）
  data/zh.js          中文名与说明
  data/cases/*.js     精选案例的覆盖数据
  js/core/*.js        数据层：util、store（观察状态）、casedef、sim、analysis、model、views（六个视图预设）、
                      to-trace（一次运行 → Trace 契约的会话加决策标注，见 17.5）、
                      from-trace（本机会话 → 统一模型，真实的多智能体运行用 ①②③ 画，见 17.7）
  js/obs/stage.js     观察层：在原画布里按 key 渲染卡片、框、线，补间移动，镜头适配
  js/obs/cards.js     各种卡片的 HTML（个体卡＝原 .nd 结构）
  js/obs/scene-org.js ①②③ 的布局（纯函数，可在 node 里测）
  js/obs/scene-process.js ④
  js/obs/trace.js     ⑤⑥：一次运行的明细交给 Trace 视图画（树在中间，选中项的细节在右栏），见 17.6
  js/core/collab.js   协作轨迹图的数据（纯函数，可在 node 里测）：一个案例实例的成员、任务线、有依据的交接、按先后排的记录
  js/obs/collab.js    协作轨迹图：星图加下方按记录先后排开的全图，盖在画布上，自带逐条回放，见 7.2
  vendor/hub-trace.js Trace 视图的构建产物（trace/apps/viewer 的 npm run build 生成，随仓库提交，不手改）
  js/obs/panel.js     右侧详情和操作（写进原页面的右栏）
  js/obs/side.js      左栏的“结构”“体检”页
  js/obs/timeline.js  画布底部的时间轴和回放
  js/obs/main.js      模式切换、顶栏六个视图按钮、画布上下的控制条、状态栏、键盘
  tools/              提取、测试、打包脚本
```

页面结构（观察模式）：
- 顶栏中间（原来的“描述问题”输入框位置）：六个视图按钮 + 我的视图。
- 左栏：案例（就是原来的“预设”列表）、结构、体检。
- 画布：左上是面包屑和返回前进；上方中间是粒度、对照方式、图/面板；下方中间是线和叠加层的开关、回放、适应窗口；最底下一条是时间轴。
- 右栏：选中对象的详情和可做的操作；没选中时是案例概况。
- 状态栏：个体、交接、运行、调用、token、编排版本、时间。

## 4. 术语（与设计文章一致）

| 词 | 含义 |
|---|---|
| 关注面 | 想了解哪一方面：任务、信息、个体、能力渠道、时间、人。表现为线的筛选、叠加层和面板分区 |
| 主体 | 图上的节点是什么：`org` 组织（个体与分组）、`process` 流程（步骤与判断点）、`exec` 执行（一次运行里的决策与调用） |
| 粒度 | 展开到哪一层：组织 1=部门 2=小组 3=个体；流程 1=阶段 2=步骤；执行 1=决策 2=调用 |
| 聚焦 | 只突出一个实例：一个案例（`case`）或一次运行（`run`） |
| 对照方式 | `def` 只看定义、`fact` 只看事实、`both` 两者对照 |
| 观察状态 | 以上各项加选中对象，见第 6 节 |
| 视图 | 观察状态的预设。①～⑥ 是六个常用视图 |
| 呈现方式 | `graph` 图、`panel` 面板 |
| 案例（实例） | 模拟事实里的一次完整协作：一个需求和它的整棵任务树。编号 `K1`、`K2`… |

注意：“预设”（v41 的团队模板）在本项目里叫**案例模板**，下拉框里选的是它；一个案例模板下有若干个模拟的案例实例。

## 5. 数据模型（`HUB.model.current`）

```js
model = {
  id, name, summary,            // 案例模板编号、中文名、一句话说明
  synthetic: true,              // 事实是模拟的
  curated: bool,                // 是否有精选覆盖数据
  def: {
    version: 'v1',
    individuals: [{
      id,            // 'n0'..'nN'（预设里的节点序号），人 = 'human'，渠道维护者 = 'meta_maint'
      agentId,       // v41 智能体编号，人和维护者为 null
      kind,          // 'agent' | 'human' | 'meta'
      name,          // 中文名，重复的加 #2
      model,         // 'opus'|'sonnet'|'haiku'|'fable'|null
      groupId,       // 最内层分组
      role,          // 一句话职责
      trigger,       // 被什么触发
      watches: [],   // 视野：盯着哪些个体或渠道的编号
      docs: [],      // 该知道的文档编号（工作包）
      channels: [],  // 能用的渠道编号
      x, y,          // 基准位置（来自预设，已换算），稳定
      isHub: bool,   // 中枢智能体（人主要通过它下指令）
      enhanced: bool // 我们补上的个体（人、渠道维护者）
    }],
    groups: [{ id, name, level, parentId, order, children: [groupId], members: [individualId] }],
    relations: [{ id, type, sub, from, to, label }],
      // type: 'task' | 'info' | 'watch' | 'channel'
      // sub:  task: 'dispatch' 派发 | 'deliver' 交付 | 'roundtrip' 往返 | 'report' 汇报
      //       info: 'read' 读产出；watch: 'watch' 盯着；channel: 'use' 使用 | 'maintain' 维护
    channels: [{ id, kind, name, maintainer, capacity, quota, users: [individualId] }],   // kind: 'model'|'tool'
    docs: [{ id, layer, name, owner, summary, audience: [individualId], version }],      // layer: 'consensus'|'private'|'map'
    process: {
      stages: [{ id, name, order, groupId, steps: [{ id, name, executors: [individualId] }] }],
      gates:  [{ id, name, afterStage, decider: { type, who, text }, pass, fail, escalate }],
        // decider.type: 'rule'|'agent'|'human'；pass/fail 指向阶段编号或 'done'；escalate 为 'human' 或 null
      flows:  [{ id, from, to, kind, label }]   // from/to 为阶段、判断点、'start'、'done'、'human'；kind: 'normal'|'loop'|'escalate'
    }
  },
  facts: {
    span: { start: 0, end },     // 毫秒，模拟时钟
    cases:     [{ id, name, start, end, status }],                       // status: 'done'|'running'|'blocked'
    tasks:     [{ id, caseId, parentId, name, stepId, assignee, status, created, started, done }],
    runs:      [{ id, taskId, caseId, individualId, start, end, outcome, version, model, tokens }],
      // outcome: 'deliver'|'request'|'yield'|'escalate'|'failed'|'interrupted'|'running'
    decisions: [{ id, runId, idx, start, end, action, title, trigger, alternatives, choice, reason,
                  impact, outcome, stageTags, evidence: [callId], unsupported: [字段名] }],
      // action: 'deliver'|'request'|'yield'|'escalate'|'tool'；outcome: 'confirmed'|'overturned'|'pending'
    calls:     [{ id, runId, decisionId, parentId, kind, name, channelId, start, end,
                  tokensIn, tokensOut, status, repeat, input, output, context }],
      // kind: 'model'|'tool'；status: 'ok'|'error'|'retry'；context（仅模型调用）: { task, consensus, tools, dialog } 单位 token
    handoffs:  [{ id, caseId, from, to, fromTask, toTask, at, relationId, carried: [docId], missing: [docId] }],
      // relationId 为 null 表示编排里没有这条线（只有事实）
      // 真实轨迹（from-traces）的交接另带 basis: 'explicit'|'protocol'（记录里明写 / 按来源协议推出）。
      // 只凭相邻发言的不生成交接（10-12 起）。还带两端的记录序号 sentSeq、gotSeq；gotSeq 为 null 表示接收者在这份记录里没有再发言
    turns:     [{ id, caseId, seq, individualId, kind, to, text, tool, calls, sourceIndex, runId, at }],
      // 只有真实轨迹有：每个案例实例里按先后排的原始记录，seq 从 1 起，id 是 '<案例实例>.r<seq>'。
      // kind: 'say'|'think'|'tool'|'context'；calls 是这条记录发起的工具调用 [{ name, args }]。协作轨迹图和“一条记录”的详情用它
    deliveries:[{ id, runId, individualId, docId, kind, text, at, status, confirmed, by }],
      // kind: 'context'|'instruction'|'feedback'；status: 'delivered'|'missing'|'pending'
    gateEvents:[{ id, caseId, gateId, at, result, by, queue }],          // result: 'pass'|'fail'|'escalate'
    channelEvents:[{ id, channelId, at, kind, note }],                   // kind: 'outage'|'quota'|'recover'|'pause'|'resume'|'maint_task'|'maint_done'
    versionEvents:[{ id, at, version, note, by }],
    actions:   [{ id, at, kind, target, text, status }],                 // 页面上的人工操作
    messages:  [{ id, at, from, to, text }]                              // 和个体的对话
  },
  idx: {   // 全部是 Map
    ind, group, rel, ch, doc, stage, step, gate, flow,
    task, run, dec, call, case, handoff,
    runsByInd, runsByCase, tasksByCase, decsByRun, callsByRun, callsByDec,
    handoffsByCase, deliveriesByRun, relsByInd, membersDeep   // membersDeep: groupId -> 所有下层个体
  }
}
```

分析结果按时间窗计算：`HUB.model.an(state)`，同一个时间窗会缓存。

对照之前先看能不能对照（10-12）：`HUB.analysis.comparability(model)` 返回 `{ level, written, orderOnly }`，分析结果里也带一份（`an.comparability`）。
- `full`：定义和事实各有来源（模拟案例、本机会话）。结论照旧：从没被派出过、设计了没发生、未声明。
- `written`：事实是真实轨迹，定义是我们补写的编排，记录里有带依据的交接。只说“与补写的编排一致或不一致”“这份记录里没有出现”，不说对方系统偏离了设计。
- `none`：记录只有发言先后，没有任何带依据的交接。不和任务线对照。
页面上这一类结论的措辞集中在 `HUB.util.cmpWord(key)`，选中模型时由 `HUB.util.setCompare` 设一次。

```js
an = {
  t,                                       // 截止时刻，null 表示全部
  relStats:   { [relationId]: { count, first, last } },
  factOnly:   [{ id, type, from, to, count, handoffIds }],   // 发生了但编排里没有
  unusedRelations: [relationId],                              // 设计了没发生
  neverDispatched: [individualId],
  indStats:   { [individualId]: { runs, tasks, status, lastRunId, tokens } },
    // status: 'working'|'waiting'|'standby'|'error'|'never'
  groupStats: { [groupId]: { members, working, waiting, standby, error, never, runs } },
  stepStats:  { [stepId]: { tasks, done, rework, avgDur } },
  gateStats:  { [gateId]: { pass, fail, escalate, queueNow, queueMax } },
  flowStats:  { [flowId]: { count } },
  delivery:   { [individualId]: { expected: [docId], received: [docId], missing: [docId], pending: n } },
  channelStats: { [channelId]: { calls, errors, status, incidents } },   // status: 'ok'|'degraded'|'down'|'paused'
  health:     [{ id, kind, severity, text, target: { type, id } }],
    // kind: 'never_dispatched'|'unused_relation'|'fact_only'|'missing_info'|'rework_loop'|'queue'|'channel_down'
  needsHuman: [{ id, kind, text, target, at }],                          // kind: 'approval'|'escalation'|'direction'
  totals:     { individuals, relations, cases, runs, calls, tokens, firstPassRate, reworkRate }
}
```

## 6. 观察状态（`HUB.store`）

```js
state = {
  caseId: 'deep_five_minds',   // 案例模板
  instanceId: null,            // 当前案例实例 'K1'…，null 时视图自动选第一个
  subject: 'org',              // 'org'|'process'|'exec'|'collab'（协作轨迹图；它画的是组织里的个体和分组，粒度用 depth.org）
  depth: { org: 1, process: 1, exec: 1 },
  expanded:  { org: [], process: [], exec: [] },   // 比 depth 多展开的编号
  collapsed: { org: [], process: [], exec: [] },   // 比 depth 少展开的编号
  focus: null,                 // null | { type: 'case'|'run', id }
  time: null,                  // 截止时刻（毫秒），null = 全部
  compare: 'both',             // 'def'|'fact'|'both'
  lines: { task: true, info: false, watch: true, channel: false },
  overlays: { human: true, channels: false, delivery: false, lanes: true, evals: true },
    // evals：评价这一层（失误标注、结局），和执行事实分开。默认开；关掉时链接里写 noeval，旧链接读出来是开的
  present: 'graph',            // 'graph'|'panel'
  selection: null,             // null | { type, id }；type 里的 'turn' 是真实轨迹的一条记录（facts.turns 的 id）
  drawer: true
}
```

接口：
- `HUB.store.get()` 返回当前状态（不要直接改它）。
- `HUB.store.set(patch, opts)` 合并修改。`depth`、`expanded`、`collapsed`、`lines`、`overlays` 按键合并。`opts.history` 默认 true（进入历史，可返回）；只改选中对象时传 `{history:false}`。
- `HUB.store.back()`、`forward()`、`canBack()`、`canForward()`。
- `HUB.store.subscribe(fn)`，`fn(state, prev)`，返回取消订阅的函数。
- 状态会同步到地址栏的 `#` 后面，可以复制链接分享。

展开判定统一用：`HUB.store.isOpen(subject, id, level)`：
`(level < depth[subject] || expanded[subject] 含 id) && collapsed[subject] 不含 id`。
- 组织：部门 level=1，小组 level=2；打开的分组显示内部，关上的分组显示成一个节点。
- 流程：阶段 level=1；打开时显示步骤。
- 执行：决策 level=1；打开时显示调用。

`HUB.store.toggle(subject, id, level)`：切换一个对象的展开状态。

## 7. 视图（`HUB.views`）

```js
HUB.views.register({ id, num, name, short, question, subject, apply(state, model) -> patch, test(state) -> bool })
HUB.views.list()           // 按注册顺序
HUB.views.current(state)   // 匹配到的视图编号，没有则 null（界面显示“自定义”）
HUB.views.go(id)           // 套用预设
```

六个预设：

| 编号 | 名称 | 主体 | 粒度 | 聚焦 | 回答 |
|---|---|---|---|---|---|
| v1 | 完整协作图 | org | 3 | 无 | 看清所有个体和关系 |
| v2 | 部门架构图 | org | 1 | 无 | 看清组织和分工 |
| v3 | 单案例路由图 | org | 保持 | 案例 | 看清一次协作实际怎么发生 |
| v4 | 业务流程图 | process | 保持 | 保持案例 | 看清系统按什么规则运转 |
| v5 | 粗粒度决策链 | exec | 1 | 运行 | 看清做了哪些决定、依据是什么 |
| v6 | 细粒度执行链 | exec | 2 | 运行 | 看清每一步实际做了什么 |
| vc | 协作轨迹图 | collab | 3（模拟案例保持原粒度） | 案例实例（模拟案例不聚焦） | 看清一次协作里谁把什么交给谁 |

新视图只需要再注册一个对象，顶栏的按钮自动出现。用户也可以把当前状态存成“我的视图”（localStorage）。

`vc` 不占数字（⑤⑥ 的编号不动），顶栏排在 ④ 之后，快捷键 T；视图对象多一个可选字段 `key`，顶栏按钮据此显示快捷键。

### 7.1 视图的定义方式（10-10 用户补充）

视图不绑定唯一的数据来源。可切换的部门架构、单案例路由、业务流程三个视图，每个都允许不同的定义方式；定义在进入统一模型之前完成，前端只认模型（与 §18.1 的解耦一致）。已支持的方式：

| 视图 | 定义方式 |
|---|---|
| ② 部门架构图 | groups.md 显式分组（平铺 `members` / 嵌套 `parent-children` 两种写法）；标签命名空间自动分组（“自动分组”按钮，`suggestMerge` 按标签分桶）；无分组文档时按阶段 phase 的默认分组（`casedef.build`） |
| ③ 单案例路由图 | 定义层回退：无事实时按 `def.process.flows` 画默认走法；编排事实：scenarios.md 的 K 案例（path、返工、阻塞、注入 → sim 生成 handoffs）；真实会话：from-trace 把本机会话的交接变成 handoffs。三种来源按模型择一，时间截断（`state.time`）叠加在任一来源上——路由随时间生长 |
| ④ 业务流程图 | process.md 的 stages+gates（steps 列表或扁平 `executors` 两种写法）；关卡 `pass/fail` 双路或多路 `paths`；无编排文档时按分组与阶段自动生成（`casedef.defaultProcess`） |

单案例路由图是定义方式最多的一个，因为它的本质是“事实从哪来”：加一种新来源 = 写一个产出 handoffs 的适配器，视图本身不改。

### 7.2 协作轨迹图（10-12，任务书 2）

层次上在 ③ 和决策链之间：③ 看一个案例在组织图上走过哪里，协作轨迹图把同一个案例实例按记录先后一条一条排开，双击其中一个个体或一条记录进入 ⑤。它不走场景（第 8 节），和 ⑤⑥ 一样在画布上盖一层自己画：`HUB.collab.build(model, state)`（纯函数，`tools/check_collab.js` 全量跑）给出数据，`HUB.obsCollab.render(state, model)` 画。

和观察状态的对应：
- 实例：`instanceId`（没有就是 `focus` 的案例，再没有就是第一个）。面包屑里的实例选择在这个视图里列出全部实例，没有“不聚焦”。
- 成员：和 ①②③ 相同的代表（`HUB.orgRep`）：个体，或折起的分组。粒度 `depth.org`、单独展开折叠 `expanded.org`/`collapsed.org` 照常生效。
- 游标：`time`。`HUB.collab.cursorOf(st, time)` 是“到第几条为止”，`HUB.collab.timeOf(st, n)` 反过来。面包屑和状态栏的“截止”在这个视图里写本实例的记录序号。
- 对照：`compare`。“定义”只画定义里的成员和任务线，全图和回放收起；“事实”只画出现过的成员和有依据的交接；“对照”两者都画，并按 `comparability` 的三种情况措辞。
- 评价：`overlays.evals`。关掉后图上的旗子、标题栏的结局、讲解里的评价、右栏的结局和失误标注、名字里属于评价的括注（`HUB.util.quietEval`）一起不显示。
- 选中：成员是 `individual`/`group`，线是 `relation` 或 `factonly`，一条记录是 `turn`，右栏照常显示详情。

画法（事实边界）：
- 记录里明写的交接是实线楔形（宽的一端是发出者）和实心光；按来源协议推出的是点线和空心光；只凭相邻发言的不连线，只在下方全图里看得出先后。
- 一拍一条记录。数据只有先后，没有时间：节拍、光点的速度、全图里的间距都不表示时长、等待或并发。发出后接收者还没有发言的交接，光停在接收者边上，它发言时被接住。
- 编排里的任务线是双细线。对照时，不在任务线上的交接是橙色并标次数；合并到分组以后只有一部分不在任务线上的，标“其中 ×N”。
- 定义里有、这份记录里既没有发言也不是任何交接一端的成员画成虚线圈，只说“这份记录里没有出现”。
- 工具调用是渠道线上的事实，不是交接；工具返回的错误是执行时的事实，不是评价。
- 没采集的量写“未采集”。
- 事实是模拟数据的案例只显示定义，写明“这里不画”，并指向 ③；不把模拟出来的事实画成记录。
- 有真实运行但没有逐条记录的模型（本机会话）：一次运行一格；同一时刻开始的几次运行，游标一次走过。

## 8. 场景与渲染（`HUB.obsStage`、`HUB.obsScene*`）

每个视图由一个纯函数算出“场景”，渲染层只认场景：

```js
scene = {
  subject: 'org' | 'process' | 'exec',
  cards:  [{ key, kind, x, y, w, h, sel, toggle, anchor, dim, data }],   // x, y 是左上角
  frames: [{ key, kind, x, y, w, h, sel, toggle, anchor, dim, data }],   // 展开的分组、阶段、决策
  links:  [{ key, from, to, type, state, label, weight, particles, route, hl, dim, sel }],
  bbox:   { x, y, w, h }
}
```

- `HUB.obsSceneOrg.build(model, state, an, view)`：①②③。`HUB.obsSceneProcess.build`：④。都不碰 DOM，`tools/test_scenes.js` 在 node 里把 62 个模板全跑一遍。
- ⑤⑥ 不进顶栏（10-10 用户决定）：它们是某个个体一次运行的下钻明细，从个体打开（双击，或个体详情里的“打开最近一次运行的决策链”、运行列表），也可以从左栏“会话”页打开本机的真实会话。10-10 下午起不再自己画卡片（原来的 scene-run.js 已删，用户说它“还是工作流”，撑不住真实解析出的大量步骤）：由 Trace 视图画，树盖在画布中间，选中项的细节在右栏的概况下面；Esc 或顶栏的“返回”回到原视图。顶栏只放 ①～④。细节见 17.6。
- `key` 跨视图稳定：个体是 `i:<编号>`，折起的部门 `g:<编号>`、展开的部门框 `b:<编号>`，阶段 `s:`/`sb:`，步骤 `st:`，判断点 `g:`。同一个 key 在新场景里还在，卡片就原地移过去；新出现的从 `anchor` 列出的第一个旧位置长出来，消失的缩回 `anchor` 在新场景里的位置。
- `kind` 决定卡片长相：`ind`/`human`/`meta`（原页面的 `.nd` 卡）、`dept`、`channel`、`stage`、`step`、`gate`、`term`；框：`frame`、`stageframe`。HTML 在 `cards.js` 和各场景文件里登记（`HUB.obsCards.extra`、`extraFrame`）：新增一类节点，只加一个模板。
- `link.state`：`both` 实线（粗细按次数）、`defonly` 虚线、`factonly` 橙色、`def` 细实线。`hl` 是聚焦案例走过的路（金色，带光点），`particles` 是线上流动的光点数。
- `HUB.obsStage.render(scene, {instant})` 按 key 复用元素、补间移动；`fit(bbox, animate, pad)` 用原页面的 `scale/panX/panY` 移镜头。单击卡片或线 → `selection`；双击分组/阶段/决策 → 展开折叠；双击个体 → 它最近一次运行（⑤）；拖背景平移，滚轮缩放（原页面的）。

## 9. 加载顺序（根目录 index.html 末尾，由 `tools/patch_page.py` 维护）

```
hub/css/obs.css, hub/css/panels.css, hub/css/collab.css,
hub/data/base.js, hub/data/zh.js, hub/data/cases/*.js,
hub/js/core/util.js, store.js, casedef.js, sim.js, analysis.js, model.js, to-trace.js, views.js, collab.js,
hub/js/obs/cards.js, stage.js, scene-org.js, scene-process.js, hub/vendor/hub-trace.js,
hub/js/panels/panels.js, hub/js/obs/panel.js, side.js, timeline.js, guide.js, sessions.js, trace.js, collab.js, main.js
```

`python hub/tools/patch_page.py` 重复执行也安全：钩子已在就跳过，只刷新这一段脚本列表。`node hub/tools/build_single.js` 把它们内联成 `hub/dist/observatory.html` 单文件。

## 10. 视觉约定

- 一切跟原页面走：深色星空画布、玻璃面板、阶段色描边、模型徽标、按钮 `.btn`、详情 `.ds-*`、弹窗 `.mo`。浅色主题由原页面的 `[data-theme="light"]` 变量带过来，`obs.css` 只补自己的几种线色。
- 线的颜色（`obs.css` 顶部变量）：任务 `--ob-task`（靛）、信息 `--ob-info`（青）、监督 `--ob-watch`（琥珀）、渠道 `--ob-channel`（绿）、编排外 `--ob-factonly`（橙）、聚焦路径 `--ob-hl`（金）、流程流转 `--ob-flow`（紫）、打回 `--ob-fail`（红）。
- 对照的三种状态，三种主体同一套画法：两者都有＝实线；只有定义＝虚线、变淡；只有事实＝橙色并标“未声明”。`compare='def'` 时不画次数和状态，`compare='fact'` 时不画没发生的东西（从没派出的个体也不画）。
- 个体状态：在做＝原页面的转圈（`sim-active`）；出错＝红框；在等＝黄框；从没派出＝虚线淡卡。右上角小标签：缺（资料没送到）、曾缺、令（收到新指令）。
- 能力渠道（10-10）：每条渠道有 `tier`。`basic`（读写文件、改文件、命令行、创建任务等不限并发的工具）在能力层里合成一个虚线小块“基础能力”；`shared`（模型渠道、功能渠道，如 OpenCLI · 小红书）各自一张卡，显示状态、并发格子（在用或峰值对上限，满了变琥珀色）、谁在用；`native`（某个体自带，如豆包的“创建多智能体并行开发”、Claude Code 的派生子智能体）不进能力层，在所属个体卡底部挂金色标签，详情顶部有金色的专属能力卡。
- 并发：`channel.limit` 是并发上限（null 不限）。模拟里运行要等所在模型渠道有空位，功能渠道上的调用要等渠道空闲，等待时间记在 `run.queued`、`call.queued`；分析给出每条渠道的在用、排队、峰值、累计排队和等待时长。

## 11. 页面操作（`HUB.model.perform`）

```js
HUB.model.perform(kind, { target: {type, id}, text })
// kind: 'talk' 对话 | 'interject' 插话 | 'urge' 催办 | 'reassign' 改派 | 'redeliver' 补送信息
//       'edit_rule' 交给中枢智能体改规则 | 'pause_channel' | 'resume_channel' | 'assign_maint' | 'approve' 审批
```

每个操作都追加一条 `facts.actions`，再按种类追加对应事实（比如补送信息追加一条 `deliveries`，改规则追加一条 `versionEvents`），然后重新分析，界面自动刷新。对话会生成一条模拟回复。

## 12. 数据文件格式

### 12.1 `data/zh.js`

```js
window.HUB = window.HUB || {};
HUB.zh = {
  agents:  { orchestrator: { name: '编排者', role: '一句话职责，30 字以内' }, /* 全部 60 个 */ },
  presets: { deep_five_minds: { name: '深度五心智', summary: '一句话说明，40 字以内', flow: '流程概括，30 字以内' }, /* 全部 62 个 */ },
  phases:  { strategy: '战略', research: '调研', debate1: '五心智辩论', debate2: '五心智复议', build: '构建', qa: '质检', hitl: '人工把关' },
  tools:   { Read: '读文件', Write: '写文件' /* base.js 里出现的全部工具名 */ }
};
```

### 12.2 `data/cases/<预设编号>.js`（精选案例的覆盖数据）

个体一律用节点编号引用：`'n0'` 是该预设 `nodes[0]`，以此类推；人是 `'human'`，渠道维护者是 `'meta_maint'`。`at`、`dur` 是模拟时段里的比例（0 到 1）。所有字段都可选，没写的用默认推导。

```js
window.HUB = window.HUB || {};
HUB.cases = HUB.cases || {};
HUB.cases['feature_sprint'] = {
  title: '场景化的中文标题',
  summary: '两三句话：这个团队这次要完成什么',
  groups: [                                   // 覆盖默认分组，可嵌套一层 children
    { id: 'g_plan', name: '规划', members: ['n0', 'n1'] },
    { id: 'g_build', name: '构建', members: [], children: [
      { id: 'g_build_be', name: '后端小组', members: ['n4'] },
      { id: 'g_build_fe', name: '前端小组', members: ['n5'] } ] }
  ],
  individuals: { n1: { role: '…', trigger: '…', watches: ['n2', 'n3'] } },
  docs: [
    { id: 'd_spec', layer: 'consensus', name: '功能说明', owner: 'human', summary: '…', audience: 'all' },
    { id: 'd_api', layer: 'private', name: '接口约定', owner: 'n4', summary: '…', audience: ['n4', 'n5'] }
  ],
  infoReads: [['n2', 'n6', 'QA 直接读调研结论']],      // [产出方, 读者, 说明]
  watches:   [['n0', 'n6', '编排者盯着验收']],          // [盯的人, 被盯的对象]
  channels:  [{ id: 'ch_db', kind: 'tool', name: '工具：测试数据库', users: ['n4'], capacity: '…', quota: '…' }],
  process: {
    stages: [{ id: 's_plan', name: '需求分析', groupId: 'g_plan', steps: [{ id: 'st_split', name: '拆解需求', executors: ['n1'] }] }],
    gates:  [{ id: 'gt_qa', name: '验收是否通过', afterStage: 's_build',
               decider: { type: 'agent', who: 'n6', text: '按验收清单逐条判断' },
               pass: 'done', fail: 's_build', escalate: 'human' }]
  },
  scenario: {
    cases: [
      { id: 'K1', name: '…', rework: { gate: 'gt_qa', times: 1 },
        missing: [{ ind: 'n4', doc: 'd_api' }],
        inject: [{ at: 0.45, to: 'n5', kind: 'instruction', text: '…' }] },
      { id: 'K2', name: '…' },
      { id: 'K3', name: '…', blockedAt: 'gt_qa' }
    ],
    neverDispatch: ['n3'],
    undeclared: [['n5', 'n2', '前端直接找调研员要资料']],
    outage: [{ channel: 'ch_sonnet', at: 0.62, dur: 0.06, kind: 'quota', note: '额度用完' }],
    versionChanges: [{ at: 0.7, note: '…', by: 'human' }]
  },
  decisions: {
    n1: [{ title: '…', trigger: '…', alternatives: ['…', '…'], choice: '…', reason: '…', impact: '…', action: 'deliver' }]
  }
};
```

要求：
- 流程覆盖时，阶段的 `executors` 合起来要覆盖所有会被派活的个体；`neverDispatch` 里的个体不要出现在任何阶段里。
- 判断点的 `pass`、`fail` 只能指向已有阶段编号或 `'done'`。
- `inject.at` 是相对这个案例自己时间窗的比例（0 是案例开始，1 是案例时间窗结束，时间窗长 0.28 × 模拟跨度），不是整个模拟跨度的比例；`outage.at`、`versionChanges.at` 才是整个跨度的比例。
- 渠道编号：模型渠道固定为 `ch_opus`、`ch_sonnet`、`ch_haiku`、`ch_fable`；工具渠道固定为 `ch_tool_<工具名小写>`，比如 `ch_tool_websearch`。自定义渠道用别的编号。
- 写完用 `node hub/tools/check_case.js hub/data/cases/<编号>.js` 自检，必须零错误。

## 13. 验收

- 六个视图都能从顶栏一键进入，键盘 1～6 也行；当前视图高亮；改了粒度或聚焦后显示“自定义”。
- ①②之间切换，节点平滑移动，不跳。③ 点亮一个案例，其余变淡。④ 的判断点写明由谁判断。⑤⑥ 之间切换是原地展开和折叠。
- 返回、前进能回到之前的观察状态；地址栏链接能复原同一个视图。
- 三种对照方式在 ①～④ 都生效。
- 任一个体、渠道、判断点、运行都能在抽屉里看到详情和可用操作；操作后图上能看到变化。
- 全部 62 个案例模板都能打开，没有报错；精选案例的内容更丰富。
- 浅色、深色两套主题都清楚可读。
- 协作轨迹图（10-12）：所有带真实轨迹的案例都能打开；没有依据的地方不连线；事实是模拟数据的案例只显示定义；评价能整层关掉。`node hub/tools/check_collab.js` 全过。

## 14. 进度

10-10 改道后（提交 5b6f9c0 起）：
- 原页面加了观察模式：顶栏“观察｜设计”和六个视图按钮；画布左上面包屑和聚焦、右上粒度和对照、下方线和叠加开关、回放、底部时间轴；左栏多了“结构”“体检”；右栏是详情和操作；状态栏换成观察的统计。
- ①～⑥ 都能画，切换时卡片按 key 原地移动；62 个模板的场景测试全过（`node hub/tools/test_scenes.js`）。
- 操作（对话、插话、补送、催办、改派、改规则、放行、渠道暂停恢复和维护）都会记成事实并刷新。
- 浏览器里查过：深色、浅色、切换设计模式、从左栏换案例、面板呈现、地址栏链接还原、键盘。
- 旧的独立外壳（hub/index.html、shell、org 视图等）已删除。
- 10-10 下午：⑤⑥ 改由 Trace 视图画（17.6），原来的卡片画法 scene-run.js 删除；左栏会话页点一条在中间打开本机真实会话。
- 10-10 晚：浏览器实测抓到 renderCtrl 里未定义的 `m`（19:07 auto-group 提交引入）——组织视图一加载就 Uncaught ReferenceError，页面空白，即“打开没东西”的元凶。修复后六个视图、文档源案例、单文件在 http 下全部 0 控制台错误，单文件已重建。
- 新增 `启动观察台.bat`：双击 = 起本地静态服务器（127.0.0.1:8899，已在跑则复用）并开浏览器。file:// 直接双击 html 依然不行（fetch 被禁、文档源案例为空），看页面必须走 http。
- 10-10 晚二：from-docs 补齐到与 v41 精编案例同一条流水线：多行列表解析（alternatives / missing / inject / paths）、steps 与扁平 executors 两种 stage 写法、任务线按 stages 的 executors 推断、watch 双写去重（42→22）、frontmatter hub 校验、meta yaml 文件清单、_index 分隔行修复；**scenarios.md 接入 sim 事实层**——③任务路由、⑤⑥决策/执行链、时间轴、回放对文档案例全部点亮（deep_five_minds 76 runs / 627 calls / 218 决策全带候选；deep_research_v2 修复 stages 缺 order 导致案例一步即"完成"的问题）。新增 `node hub/tools/check_from_docs.js` 校验四个文档案例。

- 10-10 晚三：面板按原页卡片语言重排（1.5px 边框、14px 圆角、顶部内高光、indigo 悬停色调、dtl 发丝分隔线、topbar 同款渐变发丝线）；组织视图按部门出入口汇合——端点都在组框内且框不同时，线走框边 36px 量化共享口岸，卡片端保留错道扇出，同框/无框/回退弧走原路由（deep_five_minds 个体层 184 条线中 153 条成束）。

- 10-10 晚四：对照原 v41 预设补回 md 迁移时丢失的 agent——deep_research_v2 9→20 个（社区讨论/技术动态/技术论坛/官方文档四路调研员 + 提炼层 r_ex1~r_ex7，流程加 s_extract 长报告提炼阶段，调研质检关卡移到提炼之后），incident_war_room 8→10 个（代码取证员 forensics、质疑专家 devil）；extract_base.js 去掉角色文本截断（base.js 50 处恢复 v41 全文）；index.html 停载 4 个已归档的 data/cases/*.js（docs 源已接管这些 id）。

- 10-10 晚五：本地自动解析成环——① hub/cases/ 目录自动发现（_index.md 注册表 ∪ http 目录列表，`hub/cases/` 下新建目录免注册即出现；file:// 与纯静态托管回退 _index.md）；② `from-hub-graph.js` 落地（§18.2 的 JSON → 统一模型适配器，objects/relations 翻译 + 未知 type 降级 + 不跑模拟器），`hub/graph/*.json` 同样目录自动发现；③ 左栏预设列表新增"本地自动解析"小节（rPresety 注入钩子），不在 62 个预设里的案例可见可点，点击直进观察模式；④ `model.select` 支持异步加载源（原先只认同步 build，异步源接管默认案例即崩）；⑤ 活样例：`hub/cases/demo_minimal/`（故意不注册，纯目录发现）与 `hub/graph/research_triage.json`。

- 10-11：graph 静态托管回退补上（L2 缺口闭合）——GitHub Pages 对目录请求 404、没有目录列表，JSON 案例在线上不可见。`from-hub-graph.js` 的 scan 改为：目录列表扫到就用；扫不到（404/空）回退 `hub/graph/_index.json` 注册表（数组，元素是 id 字符串或 {id, name}）。节点脚本验证两条路径：静态模拟（目录 404 + _index.json）下发现/归属/加载/建索引全通；目录列表模拟下列表优先、`_index.json` 本身不进案例。规则写进 hub-graph-format.md §11。

- 10-11 二：**T13 Claude Code 适配器落地 + 解析器抽象 + 可视化小迭代**（参考 ccpopy/cc-sessions 与 jerrywu001/cc-sessions-viewer 的设计点：轮次摘要/标题优先级/成本统计/来源徽章）。①契约升 **0.2**（新增可选 stats.costUsd/linesAdded/linesRemoved，缓存与索引文件名带版本自动重建）；②**解析器抽象**：两个适配器完全重复的轮次机器（开轮/模型步开合/工具配对/结算/统计折叠/标题兜底）抽成 `adapters/src/turns.ts` 的 `TurnBuilder`（可配 userStartsTurn、messageClosesModel、turnForInferred——Claude 无轮次标记须开 running 轮，Codex 靠 task_started 定界），state 检测从 codex/ 上移到 `adapters/src/state.ts` 共用；codex/parse.ts 重写到基座上（713→560 行，纯记录映射），37 项测试全绿（含 62 预设 hub-import 回归）；③claude-code 适配器按真实格式重写（见 §17.3 T13），修掉"顶层 tool_result"格式误解；④viewer：会话列表加来源筛选（多来源时出现 Codex/Claude chips）、每行来源徽章与成本、详情头部成本行、搜索范围加产品名；⑤观察台会话页改双来源（标题按实际来源拼、行内来源徽章）。本地实测（整仓真实数据）：Codex 1425 文件 + Claude 88 文件 → 1300 会话，解析 60.7 秒 0 失败。

- 10-11 三：**"来源与项目"总览页**（继续借鉴 cc-sessions 两库的按项目分组）。①聚合器放在契约层 `packages/contract/src/overview.ts`（viewer/cli/未来 hub 都能用同一份 interchange 结构）：`overview(summaries, roots, contract)` 按来源 kind 聚合会话数/主子拆分/进行中/轮次/工具/错误/token/成本/模型分布，再按 cwd 聚成项目行（会话、轮次、成本、最后活动时间与状态点、项目内模型 top2），项目按最后活动倒序；注册了但目录不存在的来源也保留（exists:false），界面显示"目录不存在"；②CLI 服务加 `GET /api/overview`（root 存在性随响应带出），viewer `data.ts` 加 loadOverview；③新页面 `SourcesView.tsx`，路由 `#view=sources`（header 文件夹按钮进入，X 回列表；URL 可分享）：每个来源一张卡（徽章、根目录、最后活动、主/子/进行中/轮/工具/token/成本一行、模型 top4 条形图、项目表），时间窗筛选 全部/今天/7 天/30 天，每 15 秒自动刷新；点项目行跳 `#view=search&cwd=` 深链——直接检索这个目录里的每一步；④观察台会话页加入口"来源与项目 ↗"。真实数据（1300 会话）：Codex 1220 会话（691 主/529 子）、177 个项目、14978 轮、入 token 132.8 亿/出 6371 万；Claude Code 80 会话全主、22 个项目、1870 轮、$226.83（ap-vibe 单项目 10 会话/1166 轮/$127.34）。新增 overview 聚合单测 2 项，全套 39 项绿；无头 Edge 实测页面中文渲染与 199 条项目行正常。
- 10-11 四：**适配器普查收口 + OpenCode 目录束（bundle）适配器**。先普查本机所有 CLI 的落盘格式：OpenCode 是唯一真正没覆盖的；Gemini 的 `~/.gemini/tmp/<hash>/logs.json` 只有用户侧回显（119 条/31 会话，无模型步与工具结果），Cursor/Windsurf 是 IDE 扩展目录（2.8 万/1.7 万无关文件），Kilo 是 IDE 的 kilo.db，.qwen 只有一份 QWEN.md——都不做适配器。①**解析器抽象扩到"多文件一会话"**：`SourceAdapter` 新增可选 `parseBundle(file, bundle, opts)` 与 `bundleMembers(markerPath, allFiles)`，配套类型 `Bundle { files; read(path) }`；适配器仍然纯函数不碰 fs，Node store 注入读取器；束签名 = 成员 size 之和 + 最大 mtime（任一消息/part 文件变动即重解析），增量缓存沿用 adapter@version 失效；store 每个束根只走一次目录、按需懒解析成员。②OpenCode 适配器 v0.1.0（format `opencode/json-dir`）：marker `storage/session/<project>/ses_*.json` + 一消息一文件 `storage/message/<sid>/msg_*.json` + 一 part 一文件 `storage/part/<msgid>/prt_*.json`；消息按 time.created、part 按 time.start 排序（不能按文件名，u/a 前缀会乱序）；text/reasoning/tool/step-start/step-finish 映射到 TurnBuilder，工具状态 completed/error/running 配对输出，Task/bash/edit/webfetch/mcp 等归族；step-finish 的 tokens 与消息级 tokens 重复，用标记只计一次；`finish: stop|error` 是关轮信号，running 工具保持轮次开着交 state.ts 判 working/stale；marker.summary 给行数与成本，title 缺省回退首条用户消息；孤立 marker（消息被清）仍出元数据会话。③viewer/观察台加 OpenCode 徽章与中文收尾。④修 P1 列表 bug：来源 chips 筛选只过滤了搜索词/状态，漏了 kind，父会话行变灰但不折叠，OpenCode 筛选下冒出 38 行；`filtering` 补上 kind 后精确剩 3 行。真实数据全链路复测：扫描 1516 文件 0 失败（新解析 3、复用 1513），总 1303 会话（codex 1220=1187 envelope+33 legacy、claude 80、opencode 3）；3 个 OpenCode 会话共 20 轮/160 工具调用/4 错误/2 个项目，详情页实测有真实中文消息、bash 工具步及 680 字输出、usage（入 223198/缓存读 137007/出 1536）、71 条记录；FTS 索引 1303 会话/261782 步，会话内中文检索命中；来源页 201 个项目行、数字列全部右对齐、30 天窗 201→61 行、项目行深链到 cwd 检索 14 命中；无头 Edge 同源探针实测列表/详情/来源/检索四页：零横向溢出、无意外裁切、无小于 10px 文字、无低于 2.6 对比度。新增 8 项单测（注册边界/成员隔离/身份轮次/工具配对/token 只计一次/进行中转 stale/无标题/孤立 marker），全套 47 项绿。

- 10-11 五：**完整性复审第二轮（挑自己的刺）**。①脱敏复核：三个适配器的工具输入/输出与正文都由 TurnBuilder 中心收口（`clean(…, LIMITS.io)`，turns.ts:180/199），密钥模式在 text.ts 统一打码，OpenCode 不例外；补上唯一缺口——marker.title 现在过 oneLine（之前换行和密钥会原样进标题），新增单测把伪 GitHub token 放进标题/用户消息验证解析结果里逐字搜不到。②OpenCode 的 skipped 不再恒为 0：损坏消息/part、非 user/assistant 角色、未知 part 类型全部计数（未知类型同时进 notes），新增单测。③服务没启动时的空态补齐：检索页之前只有一行小红字，现在和列表/来源页一样给出 `npm run serve` 启动指引（用户曾因我把本地服务停了点进空白页）。④两主题实测：oklch 颜色自建亮度换算做对比度探针，浅/深两主题下列表/来源/检索页零横向溢出、最小字 12px、最低对比度 4.47（14px 分页次要文字，达 AA 4.5 的边沿），真实点击来源/检索切换后 DOM 正常重排。⑤CI：新增 `.github/workflows/trace-ci.yml`，trace/ 变更时 Node 24 跑 npm ci + test + typecheck + build（本地 npm ci 实测可复现）。全套 49 项测试绿。
- 10-11 六：**统计仪表盘 + 查看器接入观察台美学**（图表版式与组件思路借鉴 jhlee0409/claude-code-history-viewer，MIT，已在源码注明；材料语言用观察台自己的）。①检索层加 `stats()` 折叠：SQLite 一把出 日步数（按 kind 拆 message/tool/model + 当日会话数）、工具榜（含出错数）、模型榜、总步数与出错数；`GET /api/stats`，类型进契约（`stats.ts` 的 StatsDoc/DayStats/ToolStat/ModelStat）。②新页 `AnalyticsView`（`#view=analytics`，头部"统计"按钮、观察台会话页"统计 ↗"入口）：6 张指标卡（会话/轮次/工具调用/入 token/成本/索引步数，等宽大数字 + 彩色图标块）、30 天日活跃条形图、半年 GitHub 式热力图、工具/模型/来源排行条、项目榜（按轮次，含成本）；页脚注明索引口径。③**美学统一**：颜色 token 早已通过 make-theme.ts 桥接，这次把材料语言也接过来——`idiom.css` 定义 hi- 前缀的一套（玻璃卡 hi-card、渐变发丝线 hi-card-head、药丸 hi-pill、图标块 hi-chip-ic、进度条 hi-bar、辉光状态点 hi-dot、分段导航钮 hi-navbtn），来源页卡片、会话列表悬停、查看器头部按钮全部换到这套语言。④实测：230 天/261894 步出图；深浅两主题探针零溢出、最小字 10px、对比 3.79/3.18（探针升级：oklab/oklch 半透明背景做 alpha 合成后再算对比度，Chrome 会把 color-mix 归一化成带 alpha 的 oklab）；视觉门禁复审揪出并修掉：来源页数字列中文硬折行（"417 个会/话"）、Codex 无成本时整列空置（改为整列不渲染）、副标题措辞、tokens() 补 B 档（13.3B）。49 项测试绿。

- 10-11 七：**检索提速 + /trace/ 与观察台的壳级统一**。①检索卡顿根因：打开检索页的空查询在服务端要跑 7 次聚合扫描，26 万步全量无条件 JOIN 会话表、cwd 分面逐行 JOIN 分组（1.2 秒同步 SQLite 堵死单线程服务，页面所有轮询跟着冻）；组合筛选（词+类型+出错）更踩中 FTS 子查询进相关子查询逐会话重放的坑（实测 32.6 秒）。修复：steps 补 facet/status 索引、files 补 cwd 索引；无 cwd/role 筛选时不 JOIN files；cwd 分面在无搜索条件时改由 files 侧驱动（1516 会话各走覆盖索引计数再按目录 SUM，与旧查询逐值核对一致）；大重建后自动 ANALYZE（规划器无统计时选错 JOIN 方向：712ms vs 139ms）。空查询 1.2s→0.1s，组合 32.6s→0.17s。②割裂感解剖（视觉模型逐像素对比四页 + 代码归因）：主工作台是第三方 AgentPrism 的扁平 shadcn 语言（1px 描边/4px 圆角/零辉光/无彩色文字），与观察台的玻璃+发丝线+辉光体系是两套设计系统同处一应用。③壳级统一落地：/trace/ 接入观察台三件套——字体同链（Space Grotesk/Inter/JetBrains Mono，tailwind 加 display 字族）、画布换成深底+三团彩色网格辉光（body::before 径向渐变，观察台 mesh 的移植）、顶栏换玻璃带（渐变字品牌 + accent 发丝线 + hi-segment 分段导航，来源/统计/检索/观察台入口全在）、三栏从通栏 IDE 分割改成画布上的三块圆角玻璃浮卡（hi-panel）；来源/统计页去掉对话框感（X 和窄列），页头统一 hi-card-head + 显示字体。视觉门禁并排评审（观察台为基准）：顶栏/材料/字体/颜色四维高相似，割裂感判定消除，4/4 pass；补了一笔把网格辉光调亮（统计/来源页卡片盖住大半后底色读作纯黑）。DOM 探针：零溢出、最小字 10px、对比 5.07。49 测试绿。

- 10-11 八：**导入案例接上真实轨迹（提案 B+F 的第一批）**。新模块 `js/core/from-traces.js`：案例目录 `traces/` 里有认得的格式时，事实层从模拟换成实测，定义层仍是 md 编排，两边第一次各有独立来源，对照（实线/虚线/橙色“未声明”、体检）建立在真实记录上。①读取器按来源格式各一个：Who&When（184 个案例，含 Magentic-One 手工集的 `Orchestrator (-> WebSurfer)` 定向发言和数据集标注的失误步）、τ-bench（2 个案例，每个对话一个案例实例，reward=1 记成功，单案例最多载入 80 个文件并在状态栏注明 80/N）、CAMEL（7 个案例，结束原因决定成功/未完成）；②发言人按编号或名字对到 md 里的个体，对不上的不丢，作为“编排里没有”的个体加进来（这批里为 0）；同一人连续发言是一次运行，换人是一次交接，落在编排的任务线上就是实线，否则是“未声明”；工具输出是提问者的一次工具调用，工具成渠道（τ-bench 的业务 API 出现在基础能力里）；人说的话不是运行，是下一次运行的输入；③案例路径按发言人所在阶段铺在 md 的流程上，经过的关卡插进去，④ 能看到编排没写的回环（如 Magentic-One 从执行回到计划 28 次，编排者与网页浏览者往返 27 次）；④ 记录里没有时钟，时间按发言顺序（一条一分钟），`clock='ordinal'`，时间统一显示“第 N 条”；⑤ 录下的发言同时存成契约会话（`m.source.sessions/runs`），⑤⑥ 打开的是原文，不是模拟；md 里的决策记录保留，标“〔编排文档〕”；⑥ 状态栏、概况、操作说明按事实来源显示（`HUB.model.factLabel`），案例列表和案例详情显示记录的结局（成功/失败/未完成及依据），过长的路径折叠。`tools/check_real_facts.js`：193 个案例全部走实测事实，解析、分析、①～④ 场景、运行打开原文全通过；交接落在编排任务线上的比例：Who&When 60%、τ-bench 51%、CAMEL 14%（来回对话只声明了单向）。`check_from_docs.js` 1140 个案例、`test_scenes.js` 62 个预设照常通过；浏览器实测 Who&When/τ-bench 三个视图与运行下钻 0 脚本错误。MAST、aarch、Smallville、SOTA 的轨迹格式各异，还没有读取器，仍走模拟。

- 10-11 九：**检索最终提速 + 主页一眼可见的 Trace 入口**。①上一轮后空闲首击仍慢：请求路径触发重扫（1516 个文件的 stat 在 Windows 上 ~600ms），void refresh 只是改了等待为同线程争抢（空闲后新词查询实测 1514ms）。本轮：请求一律服务当前索引，重扫改由 15 秒定时器驱动（监听时先预热一次；节奏化让目录缓存常热，重扫本身变便宜），检索层加查询结果缓存（全参作键，同步真正变更才清空，上限 200 条 LRU）。②客户端：SearchView 结果存模块级变量——切走再切回先用上一次答案立即渲染（SWR，后台确认），App 加载索引后顺手预热默认浏览查询。实测：启动首查 90ms、缓存命中 7ms、空闲 20 秒后浏览视图即时（缓存）；重词首查 ~330ms 属该词聚合的真实成本，重复即时。③入口：主页顶栏加 ◷ Trace ↗ 小按钮，左栏最上方加渐变大按钮 TRACE 查看器（图标块+副标题），仅本地服务在线时显示（探针/health 检查，Pages 静态部署自动隐藏）——用户两轮反馈在主页找不到 /trace/。视觉验收：大入口醒目、与渐变字/玻璃语言协调、无遮挡；顺带发现 pre-existing 的右栏标题下偶发字面量 undefined（依赖选中案例的数据状态，本轮未动该代码，已记录）。49 测试绿。

- 10-11 十：**检索切换卡顿的最后一层（用户流实测驱动）**。用户报告"点检索→来源→再点检索又要重新加载"，端到端复现后找到三个叠加原因：①导航是三个布尔状态各管各的——切到来源时检索状态没清，再点检索第一次点击实际在"关闭"检索（页面无反应），第二次才切换，且每次都当新挂载重新拉取；②列表轮询每 8 秒全量拉 /api/sessions（1303 会话摘要，1.7MB JSON），客户端主线程反复解析兆级 JSON，输入和点击周期性卡顿——这才是"怎么优化查询都还卡"的主犯；③浏览器标签长期不刷新时跑的是旧 bundle（新修复不生效）。修复：①单一 view 状态机（list/search/sources/analytics，一次点击到位，hash 路由同步重写）；②store 维护 revision 计数（扫描真正变更才 +1），/api/sessions 带 ETag、If-None-Match 命中回 304——未变更轮询从 1.7MB 降到 0 字节；③客户端 loadIndex 走 ETag+本地缓存，预热只做一次。真实点击流实测（无头 Edge）：检索首开命中列表 0ms（预热缓存接住）、切来源 25ms、切回检索 25ms（模块级答案缓存立即渲染）、再切回列表一次到位。49 测试绿。

- 10-11 十一：**细节看得见 + 关卡分支补全**（用户：“我怕有些信息不会被解析然后看不出来”）。
  - ①**原始字段进详情页**：个体详情新增“原始字段”一节，显示编排文件里写的、页面别处没显示的全部内容（标签、`source_model` 等）。`*_file` 字段是到原文的链接，1046 个导入案例的提示词原文从此能点开看。`from-docs` 在模型上记下案例目录 `source.base`。这是 §18.2 早就约定的“不认识的进详情页”，此前一直没实现。
  - ②**关卡分支 bug**：只用 `paths:` 写的关卡，“不通过”的去向被算成和“通过”一样（拿了没写的 `a.pass` 去比），打回线不画，模拟器里也永远不打回。改为用实际的“通过”去向计算。
  - ③**`casedef.finishProcess` 画出全部出路**：三路以上的路由不再只画两路；往回走的是回环（“打回”），往前走的是分支，线上写条件。
  - ④**关卡详情列出“全部出路”**：每条出路的条件、去向、说明。
  - 全库关卡出路 2554 条，未画出的从 1273 降到 21。剩下的 21 条都是 ACB 导入时同一阶段后面挂了两个关卡（与阶段编号重复同源），属于导入产物。
  - `check_from_docs` 1140、`test_scenes` 62、`check_real_facts` 193 全过；浏览器实测 AWS 路由三条出路、Who&When 个体的提示词原文链接（200）、0 脚本错误。
  - 同日的接入原则见设计文档目录的 `核心设计总览_20261011.md` 第 9.4 节（当天先写的《通用接入抽象》已作废）；真实数据怎样解析成我们的语义见研究任务书 7，读取器以原始数据集为准重做见任务书 5。

还没做：
- 回放和补间在后台标签页里不跑（浏览器暂停动画帧），需要在前台看。
- 真实轨迹的第二批读取器：MAST（7 个框架的轨迹是日志文本，要按框架切发言人）、aarch 的 notebook、Smallville 回放、SOTA 生产账本。按 10-11 的接入设计，改为以原始数据集为准、经通用核心接入（任务书 5）。
- 并行超过 3 人丢线、中枢可选、工具进能力层、结局最小版、标签能用、基础读数（核心议题第 10.3 节“先做”里剩下的几项）。


- 10-12：**过渡读取器保真修正**。交接记 explicit/protocol/adjacent，明写对象优先，相邻发言只有补写的任务线存在才生成；Who&When 失误改为 human-label 评价与警示标记，不制造执行失败（178 条一致、6 条不一致，保留数据集分歧）；正文与带入消息逐字保留、步骤记 sourceIndex、正文截断计数为 0；token 未记录，顺序时钟按发言条数显示，送达与渠道健康/负载未采集，容量/额度注明补写声明；⑤⑥在 Hub 嵌入端隐藏时间条、耗时和合成日期，annotation 仅在展示副本映射为备注，未改 trace 包；读取失败明确警示，超过 80 文件等间隔取样。193 案例增强断言全部通过，指定 hc_08cae58d 明写派发 WebSurfer 29/Assistant 1、标注 WebSurfer 原始下标 4；τ-bench gpt_4o 取样成功 34/失败 46。check_from_docs 1140、test_scenes 全预设、check_real_facts 193 全过；无头 Edge 实测标注选择与⑤⑥隐藏、失败请求警示，无脚本错误。仍以合成 ISO 承载顺序，嵌入隐藏样式依赖当前组件 DOM，升级时须复验。

- 10-12 二：**协作轨迹图接入（任务书 2）**。在 ③ 和决策链之间加一个视图 `vc`（主体 `collab`，顶栏排在 ④ 之后，不占数字，快捷键 T），画法和它与观察状态的对应见 7.2。上面是星图，成员就是 ①②③ 的个体或折起的分组；下面是按记录先后排开的全图，兼作时间轴，自带逐条回放。
  - 读取器口径（用户 10-12 定）：只凭相邻一律不生成交接，补写的编排里有对应任务线也不生成；来源里没有“人”就不补“人 → 第一个智能体”。`facts.turns` 保留每条原始记录，交接带两端的记录序号 `sentSeq`/`gotSeq`，τ-bench 的工具调用名和参数读进记录。交接数因此变了：Who&When 1791 → 1376（相邻 289 → 0；协议 813 → 687，少的 126 条是没有人发言的案例里默认补的“人”；明写 689 不变），τ-bench 2065 → 1905（160 个对话各少一条默认补的“人”），CAMEL 1518 → 1288（230 个对话各少一条）。落在任务线上的比例现在是 57% / 47% / 9%。
  - 体检先判断能不能对照（第 5 节的 `comparability`）：193 个真实轨迹案例里 written 63 个、none 130 个。written 不再下“从没被派出过”“设计了没发生”，改说“这份记录里没有出现”“与补写的编排不一致，不是对方系统偏离了设计”；none 不和任务线对照。页面各处这类措辞集中到 `HUB.util.cmpWord`。
  - 新文件：`js/core/collab.js`、`js/obs/collab.js`、`css/collab.css`、`tools/check_collab.js`。其余都是增量：`views.js` 注册，`store.js` 评价开关，`main.js` 挂载、键盘、实例选择、“截止”的说法，`panel.js` “一条记录”的详情和案例详情里的入口，`side.js`、`cards.js`、`guide.js`、`util.js`、`analysis.js`、`model.js`、`from-traces.js`、`check_real_facts.js`、`patch_page.py`。
  - 检查：`check_collab.js` 193 个真实轨迹案例 220 个实例 4468 条记录、62 个预设、8 个“有运行没有逐条记录”的顶替模型全过；`check_real_facts` 193、`test_scenes` 62、`check_from_docs` 1140 照常通过。无头 Chromium 在真实页面里把 193 个真实轨迹案例、62 个预设和抽样的 63 个其余导入案例各打开一遍，2524 个画面逐项核对全过；49 项交互逐项通过；0 脚本错误。
  - 顺带修了一处：右栏案例实例详情里，交接指向的任务没有任何运行时取 `.id` 报错，62 个预设里有 53 个在 ③ 聚焦案例时会碰到。
  - 还没做：`hub/dist/observatory.html` 单文件没有重建。本机真实会话没有逐条记录这一层，按“一次运行一格”画，这条路只用顶替数据验证过，没有在真实会话上看过。读图测试要找真人做。CAMEL 四个学科集的所有发言被读成一个人（读取器的问题，没改）。导入脚本把评价写进了个体和案例实例的名字，本视图用短名并跟随评价开关，根子在导入。

## 15. 待思考：侧栏和其他区域的信息重复（10-10 记录，暂不改）

用户原话：“我觉得还不错，就是我担心和侧边栏有冗余”；“侧边栏的问题我觉得你要记录下来，然后后续多思考”。

现状核对（10-10）：

| 信息 | 现在出现在哪里 |
|---|---|
| 需要人处理的事 | 左栏「体检」、右栏概况、面板呈现 |
| 架构体检 | 左栏「体检」、右栏概况（前 6 条）、面板呈现 |
| 全局数字 | 右栏概况的 9 个数、状态栏、面板「系统总览」 |
| 案例实例 | 聚焦下拉框、右栏概况、左栏「结构」、时间轴的案例条 |
| 结构 | 画布本身、左栏「结构」树、面板「个体名册」 |
| 编排版本、当前时间 | 右栏概况、状态栏、时间轴、面包屑 |

当时给用户的三种方向（用户没选，要求先记录）：
1. 每类信息只留一个家，别处只放跳转：左栏＝预设＋体检，去掉「结构」页、改成画布上的定位搜索；右栏只放选中对象；数字只在状态栏；实例和时间只在时间轴选。
2. 保留左栏结构树（大团队里找人方便），只删右栏概况和面板里的重复。
3. 左栏恢复原样，体检变成画布上的一个按钮和弹出列表。

想清楚之前要回答的问题：每个区域各自回答什么问题；用户找东西时先看哪里；面板呈现和右栏概况是不是同一件事的两种形态。

## 16. 待定：决策链的规模（10-10 用户提出）

用户原话：“这部分需要从未来我们要集成到自动解析的过程中去考虑。然后解析下来可能是很多决策链，所以这个展示形式不一定很好……上千条决策链这种方式不方便查看”；此前一句：“其实我觉得面板都要换技术栈，因为决策链最后我也需要解析，可能要借鉴 langfuse 这种技术栈。”

现状：⑤⑥ 一次只看一条运行的链，适合看细节，不适合在成百上千条里找问题。

10-10 用户决定：“借鉴它的数据模型和界面，自己做轻量版吧，我觉得 agentscope 的更值得借鉴”。设计（AgentScope 2.0 的做法、对齐的数据模型、自动解析流程、地图/检索/归纳/单条四层、原型顺序）写在可视化架构文章第十二节，等用户确认后照 12.5 的顺序做原型。

## 17. Trace 与会话解析（10-10 起，独立模块）

用户确认（F18）：第十二节的设计通过，一定会改；不同智能体要各自专门设计，所以架构要可扩展、可调整、解耦；先接 Codex；Trace 查看器可以用 npm 构建。

### 17.1 目录和边界

```
trace/                      npm 工作区，和观察台（hub/，原生 JS）分开
  packages/contract/        数据契约：类型、版本号、校验。所有模块只通过它交换数据
  packages/adapters/        适配器接口和注册表；每种来源一个子目录（codex/、claude-code/、opencode/ …）
                            适配器是纯函数：行式 JSONL 走 createParser，目录束（多文件一会话）走 parseBundle，fs 由 store 注入
  packages/otel/            契约 → OpenTelemetry 文档（给 AgentPrism 等通用查看器）
  apps/cli/                 扫描本地会话 → 写出契约 JSON（增量、幂等）
  apps/viewer/              Trace 查看器：React 19 + TypeScript + Tailwind 3，组合 AgentPrism 的 TreeView 和 DetailsView
trace-data/                 解析结果（本机私有，不进 git）
```

规则：
- 适配器只依赖契约；查看器只依赖契约和 otel 导出；观察台以后通过同一份契约接入。
- 每个适配器自己处理来源的格式版本，输出带上 `source.formatVersion` 和 `source.adapterVersion`。
- 编号稳定：由来源里的编号生成，同一份记录重复解析结果不变。
- 脱敏在适配器里做（密钥、令牌一类的字符串打码，超长文本截断，加密内容和图片丢弃）。
- 会话正文是用户的私有内容：只在本机解析和查看，测试用手写的仿真样例，不用真实会话。

### 17.2 Codex 记录的结构（10-10 只看字段名核对，1226 个文件抽 70 个）

- 新格式每行是 `{timestamp, ordinal, type, payload}`；老格式第一行 `{id, timestamp, instructions, …}`，之后每行直接是 `message`、`reasoning`、`function_call` 等。
- `session_meta`：会话编号、父会话（子智能体）、分叉来源、工作目录、来源程序和版本、模型提供方、子智能体昵称和路径、git。
- 一轮：`event_msg/task_started` → … → `task_complete` 或 `turn_aborted`（带耗时、首字耗时、错误）；`turn_context` 给出这一轮的模型、推理强度、审批策略、沙箱。
- 工作项：`response_item` 下的 message（user、assistant、developer；phase 区分中间说明和最终回答）、reasoning（摘要）、function_call 和输出、custom_tool_call 和输出、agent_message（智能体之间，带作者和收件人）；`event_msg/item_completed` 下有命令执行（命令、退出码、耗时）、文件改动、MCP 工具调用、派生子智能体等。
- 用量：`token_usage_record`（每次响应、本轮、整个会话），`event_msg/token_count` 里还有额度是否触顶。
- 其他：`compacted`（上下文压缩）、`thread_settings_applied`、`thread_goal_updated`、`world_state`。

### 17.3 任务清单

- [x] T1 搭工作区（package.json、tsconfig、.gitignore 里排除 node_modules、dist、trace-data）
- [x] T2 契约 v0.1：会话、轮、工作项、用量、生命周期事件、会话状态、会话之间的关系
- [x] T3 适配器接口和注册表；Codex 适配器（两种格式）、脱敏、会话状态判断
- [x] T4 命令行扫描：`~/.codex/sessions` → `trace-data/`，只处理新增或变化的文件，写出索引
- [x] T5 OpenTelemetry 导出
- [x] T6 Trace 查看器：会话列表 + TreeView + DetailsView，中文，配色跟原页面
- [x] T7 测试：适配器用仿真样例；查看器能构建
- [x] T8 接回观察台：观察台能列出真实的 Codex 会话并打开 Trace 查看器
- [x] T9 检索层（17.4）：全部会话的每一步建全文索引，按类型、出错、工作目录、主或子智能体筛（提交 0b391a4）
- [x] T10 粗粒度标注层（17.5）：契约里的标注集，带“由谁生成”，单独存放、可重算；模拟器是第一个生成器
- [x] T11 观察台的 ⑤⑥ 改用 Trace 视图（17.6）：树在中间、细节在右栏；左栏会话页点一条也在中间打开
- [x] T12 数据来源接口（17.7）：模拟器和本地服务产出同一种模型；真实会话（Codex，带子智能体）按派出关系自动成图
- [x] T13 Claude Code 适配器（10-11 完成，v0.2.3）：读 `~/.claude/projects/*.jsonl`。工具结果是 user 记录里 message.content 的 `tool_result` 块（没有顶层 tool_result 记录——初版照夹具写错了，夹具已改回真实格式）；thinking 块 → model.reasoning；custom-title > ai-title > agent-name > 首条真实用户消息做标题（排队消息不抢标题）；cost-state → stats.costUsd/linesAdded/linesRemoved + usage 汇总；queued_command 附件保留为"[排队]"用户消息；33 种已知元数据/附件类型静默计数（来自真实目录普查），未识别的进 notes；isSidechain 线程跳过；fork 复制进来的外来 sessionId 不拆会话（文件即时间线）。真实数据验证：1513 文件 1300 会话 0 失败；333 轮会话 3274 个工具调用 100% 配到结果、4802 次模型调用 99% 带 usage、成本 $82.52 全进面板
- [x] T13b OpenCode 适配器 + 目录束支持（10-11 四，adapter v0.1.0，`opencode/json-dir`）：`SourceAdapter` 加可选 `parseBundle`/`bundleMembers`，store 注入 `{files, read}` 并按"成员 size 和 + 最大 mtime"做束签名增量缓存；读 `~/.local/share/opencode/storage` 下 session marker + message/part 三层文件，消息按 time.created、part 按 time.start 排序，finish 字段关轮，step-finish 与消息级 tokens 去重。真实数据：3 会话 20 轮 160 工具调用 0 解析失败。本机普查确认 Gemini/Cursor/Windsurf/Kilo 暂不做（理由见 10-11 四日志）
- [ ] T14 快速聚合和自动分组规则（圈选合成一个点；按父子会话、工作目录、模型、状态分组）

### 17.4 检索层

服务端把每一步的文本和类型写进 SQLite 全文索引（trigram，中文和代码片段都能搜），`/api/search` 按词、类型、出错、会话、工作目录、主或子智能体、时间筛，返回命中和各类型的次数。查看器的“检索”页和观察台会话页的入口都用它；点一条打开到那一步。请求和结果的类型在契约里（`SearchRequest`、`SearchResult`）。

### 17.5 粗粒度标注层（10-10 用户：“我们怎么去标注这个粗粒度呢？……还需要一个专门的字段，未来去添加粗粒度的自动解析功能”）

- 原始记录（会话 → 轮 → 步）是解析出来的样子，粗粒度分析不改它。
- 粗粒度是叠在上面的一层：`AnnotationSet`，每段（`Segment`）框住一轮里连续的几步并列出它们的编号，就是这一段的证据。现在只有一种段：决策，带触发、读到的、该知道但没读到的、运行中送进来的、备选、选择、理由、影响、后续结果和问题标记；以后可以加阶段、意图。
- 专门的字段是 `producer`：谁生成的（模拟器、规则、摘要智能体、人）、名字和版本、时间；`basis` 记着生成时会话有多少步。以后的自动解析写自己的一层：重跑只换自己那层；会话又长了，`isStale` 看得出标注过时；页面上可以对照不同生成器的版本。
- 标注集自带版本号 `ANNOTATION_VERSION`，和会话的 `CONTRACT_VERSION` 分开：加一层、改一层，不会让已经解析好的会话和索引作废。
- `validateAnnotationSet(set, session)` 检查：段都在自己那一轮里、步骤连续、一步不进两段、编号存在。
- 现在的生成器只有一个：`hub/js/core/to-trace.js` 把模拟器的决策写成标注（`producer.kind = 'simulator'`）。真实会话还没有标注，树按轮和步显示。
- 解析结果有两类读者（用户 10-10，见反馈台账 F39）：人看页面，其他智能体（下一个执行者、验收者、维护者、中枢智能体）读同一份结果决定下一步。所以标注集和会话一样存成文件（计划放在 `trace-data/annotations/<生成器>/<会话>.json`），命令行能直接输出，智能体不用经过页面也能读。

### 17.6 观察台里的 Trace 视图

- 同一套 Trace 视图两个入口：`/trace/` 独立查看器，和观察台的 ⑤⑥。观察台不再自己画决策链。
- `trace/apps/viewer/src/embed.tsx` 打包成一个普通脚本 `hub/vendor/hub-trace.js`（`npm run build` 一起生成，约 360 KB，含 React），提供 `window.HubTrace.mount({tree, details}, props)`，返回 `update`、`unmount`。观察台不用构建，用文件打开也能用。
- 输入只认契约：`session` 加可选的 `layer`（一个标注集）；`depth` 是粒度（1 折到决策 = ⑤，2 展开到步 = ⑥），`selected` 和 `onSelect` 是选中项。样式各自装在 shadow root 里，原页面的样式和 Tailwind 的重置互不影响；主题跟页面的 `data-theme`。
- 观察状态仍是唯一的真相：粒度是 `depth.exec`，选中的一步是 `selection {type: 'span'}`，打开的真实会话是 `focus {type: 'session'}`，都在地址里，链接能还原现场。
- `HUB.obsTrace`（`hub/js/obs/trace.js`）管两个容器（画布上的树、右栏概况下面的细节）和数据：模拟的运行由 `HUB.toTrace.fromRun(model, run, 时间截点)` 转换，真实会话从本地服务 `/api/sessions/<编号>` 读。
- 换展示组件（比如 AgentPrism 升级或换掉）只动 `embed.tsx` 这一处；加一种来源只加适配器；页面这边都不用改。
- 测试：`trace/packages/contract/test/hub-export.test.ts` 把 62 个预设的每一次模拟运行都转一遍，用契约的同一套校验检查会话和标注。

### 17.7 数据来源和真实会话成图（10-10 用户：“把现在这东西做成中间，未来接入会变得更简单”）

- 统一模型（第 5 节）是图这边的中间层：任何来源先变成它，①②③④、面板、侧栏只认它。
- 来源在 `HUB.model.addSource({ id, label, owns(id), build(id) 或 load(id) })` 登记。现在两个：
  - `sim`：62 个案例模板，`casedef` 加 `sim` 立即生成；
  - `sessions`（在 `hub/js/obs/sessions.js`）：`tree:<会话编号>` 是这个会话和它派出的全部子智能体，从本地服务的 `/api/sessions/<编号>/tree` 读来（一次返回整棵树，最多 600 个），由 `HUB.fromTrace.model` 变成模型。
  以后接别的协作系统（Paperclip、Orca、Cezar 这类）或编排目录，就是再登记一个来源。
- `HUB.fromTrace.model(sessions)`：会话里没有编排，定义从事实里读出来。每个会话是一个个体，没人派出的会话是人对话的那个主智能体；同一轮里一起派出去的子智能体算一组（一次派活，这是真实运行默认的粗粒度），嵌套在派出者的组下面，最多三层；派出是派发线，交回结果是交付线；每个模型是一条共享渠道，MCP 服务器是共享渠道，命令行、改文件、搜索、和其他智能体通信是基础能力，真的派出过子智能体的会话有“派生子智能体”这项专属能力。每一轮是一次运行（带一个任务），每个模型或工具步骤是一次调用。
- 下钻：`HUB.model.traceOf(model, run)` 对真实会话直接给原来的会话，打开在那一轮；对模拟的运行才转换（17.5）。
- 时间：真实会话的时间从第一个会话开始算，模型带 `clock`（那一刻），`HUB.util.fmtClock` 显示真实的月日时分；模拟的模型照旧显示“第几天”。
- 入口：左栏“会话”页，带子智能体的会话有“画成协作图”；右栏会话概况里也有按钮。链接 `#c=tree:<编号>` 打开时先读来再显示。④ 对真实会话显示一句说明：会话里只有事实，没有写下的业务流程。
- 本机实测（只看数量）：29 个会话的树，转换 45 毫秒，最细粒度 33 张卡；374 个会话的树，服务端第一次读文件约 8～14 秒，转换约 0.6 秒，最细粒度 382 张卡。
- 测试：`trace/packages/adapters/test/hub-import.test.ts` 用 Codex 的仿真样例（主会话派出一个子智能体）建模型，交给分析和 ①②③ 的场景；`apps/cli/test/cli.test.ts` 测 `/tree` 接口。

## 18. 通用格式与解析器解耦（10-10 讨论，设计方向）

### 18.1 核心原则

格式描述"是什么"，不描述"长什么样"。展示效果靠前端的组件注册表和布局引擎，不靠格式去表达布局——格式表达布局会膨胀成弱排版语言，前端反而更难做出高质量的展示效果。

解耦的边界：
- **解析器**：外部格式（JSON / Markdown / JSONL）→ 统一模型（第 5 节）。纯函数，不碰 DOM，不认识任何组件。
- **前端**：统一模型 → 页面。只认统一模型，不认格式。
- **格式**：统一模型的一种序列化形式，也是"数据来源"之一，不是架构的核心。

现在的 `addSource` 接口（`hub/js/core/model.js`）已经是这个边界的落地：每种来源登记一个适配器，前端零改动。

### 18.2 hub-graph 格式骨架

JSON 格式，用于"解析器输出 → 前端读取"这一跳：

```
{
  "format": "hub-graph",
  "formatVersion": "1.0",
  "meta": { "producer": "...", "producedAt": "...", "sourceRef": "..." },
  "objects":   [ /* 个体、部门、渠道、步骤、决策、调用、案例、任务、运行 */ ],
  "relations": [ /* 任务线、信息线、监督线、渠道线 */ ],
  "view":      { /* 可选：观察状态的序列化，对应 store.js 的 state */ },
  "panels":    { /* 可选：数字、清单、统计 */ }
}
```

关键约定：
1. `object.type` 是语义角色，不是画法：写 `"type":"individual"`，不写 `"shape":"rounded-rect"`。前端查组件注册表，决定画成什么。
2. `attributes` 是开放的键值袋：前端认识的键用于渲染变体，不认识的进详情页。加属性不改前端。
3. 未知 `type` 降级渲染：用默认卡片画出来，不崩。
4. `view` 段是"选哪个预设"，不是"布局指令"。
5. 版本迁移在解析器侧：格式升到 1.1 时解析器负责迁移到当前模型版本，前端不动。

### 18.3 可扩展的标签系统

标签是核心扩展点，比枚举字段更灵活，可以驱动层级化聚合和粗粒度图谱。

每个对象的 `attributes` 里可以有 `tags` 字段，值是字符串数组：

```json
{ "tags": ["phase/build", "model/sonnet", "team/wave-1", "status/working"] }
```

设计约束（刻意留出扩展余地，不写死）：
- 标签格式建议用 `namespace/value`，`/` 前是命名空间（`phase`、`model`、`team`、`status`、`role`……），`/` 后是值。
- 命名空间完全开放，解析器可以自由定义新的命名空间，前端不认识的命名空间不影响渲染，只进详情页。
- 同一个对象可以打多个标签，同一个命名空间下可以有多个值。
- 前端的"自动分组"按某个命名空间分组，扫描所有对象的 tags，按值分桶，每桶变成一个聚合占位卡（即第 18.4 节的快速聚合）。换命名空间 = 换聚合粒度，不改代码。

未来可迭代的方向（现在不定义，留口子）：
- 标签可以带权重或置信度（`phase/build:0.9`）
- 标签可以是层级树（`team/backend/auth`）
- 标签可以跨对象打（"这几个个体同属一个任务线"）

### 18.4 快速聚合（view 层，10-10 已实现）

`store.js` 里的 `merged: []` 是快速聚合的存储，每项 `{id, memberIds, name}`，纯 view 层，不改 def/facts。

`suggestMerge(m)` 按标签驱动：真实会话模型按父会话波次分组，模拟器按 phase 分组。未来可以改成按任意 `tags` 命名空间分组，不改接口。

### 18.5 前端组件注册表

"只改一处"的落点在前端，不在格式：

```js
HUB.obsCards.extra['my-new-type'] = function(c) { return { cls: '...', html: '...', sig: ... }; };
```

加一类节点 = 注册表加一行 + 写一个渲染函数。`scene-org.js` 里未知 kind 的卡片会走 `individual` 降级渲染。

### 18.6 Markdown 编排文档作为来源

编排文档（人写的 Markdown）也可以作为格式来源，由一个专门的适配器解析。建议用 frontmatter 做文件识别：

```markdown
---
hub: "1.0"
kind: agents
---

# @主智能体 [individual] #phase/build #model/sonnet
role: 接需求、拆任务、汇总
```

`@名字` 是标识符，`[type]` 是语义角色，`#tag` 是标签，frontmatter 里的 `hub: "1.0"` 是命名空间标识让解析器认出这是我们的文档。

**重要**：网页不直接解析 Markdown。编排文档先由适配器编译成统一模型（或 hub-graph JSON），页面只认统一模型。Markdown 是给人写的，页面渲染从统一模型出发，中间隔适配器这一层。

### 18.7 三条验收标准

1. 换一份 hub-graph JSON 文件，页面重新生成，零代码改动。
2. 加一类节点，只改注册表 + 一个渲染函数。
3. 格式升到 1.1，前端不动（解析器负责迁移到当前模型版本）。
