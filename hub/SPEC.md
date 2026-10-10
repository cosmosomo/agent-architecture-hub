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
  subject: 'org',              // 'org'|'process'|'exec'
  depth: { org: 1, process: 1, exec: 1 },
  expanded:  { org: [], process: [], exec: [] },   // 比 depth 多展开的编号
  collapsed: { org: [], process: [], exec: [] },   // 比 depth 少展开的编号
  focus: null,                 // null | { type: 'case'|'run', id }
  time: null,                  // 截止时刻（毫秒），null = 全部
  compare: 'both',             // 'def'|'fact'|'both'
  lines: { task: true, info: false, watch: true, channel: false },
  overlays: { human: true, channels: false, delivery: false, lanes: true },
  present: 'graph',            // 'graph'|'panel'
  selection: null,             // null | { type, id }
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

新视图只需要再注册一个对象，顶栏的按钮自动出现。用户也可以把当前状态存成“我的视图”（localStorage）。

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
hub/css/obs.css, hub/css/panels.css,
hub/data/base.js, hub/data/zh.js, hub/data/cases/*.js,
hub/js/core/util.js, store.js, casedef.js, sim.js, analysis.js, model.js, to-trace.js, views.js,
hub/js/obs/cards.js, stage.js, scene-org.js, scene-process.js, hub/vendor/hub-trace.js,
hub/js/panels/panels.js, hub/js/obs/panel.js, side.js, timeline.js, guide.js, sessions.js, trace.js, main.js
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

还没做：
- 回放和补间在后台标签页里不跑（浏览器暂停动画帧），需要在前台看。


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
  packages/adapters/        适配器接口和注册表；每种来源一个子目录（codex/，以后 claude-code/ …）
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
- [ ] T13 Claude Code 适配器：一个适配器读 `~/.claude/projects`，格式参考 cc-sessions，只取把记录整理成会话的部分
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
