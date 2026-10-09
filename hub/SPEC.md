# 协作观察台：设计规格

日期：2026-10-09。本文是 `hub/` 的唯一设计依据，写给所有参与开发的人和智能体。设计来源：
`E:\program\GIT\Jobs\08_简历设计工作区\02_项目打磨与展示\智能体技术\多智能体协作\可视化架构_统一模型与六种视图_20261009.md`。

标杆：同目录的 `v41/AGENT_TEAMS_CONFIGURATOR_v41.html`（Agent Architecture Designer）。沿用它的三栏布局、零依赖、可离线打开；案例取自它的 62 个团队预设。

---

## 1. 一句话

把 62 个团队预设变成 62 个“协作案例”：每个案例有定义（编排）、模拟运行出来的事实、以及分析结果；页面用六种常用视图去看它，视图之间只改观察状态的一两项，所以切换顺滑。

## 2. 硬规则（所有模块都要遵守）

1. **零依赖**：不用任何外部库、CDN、npm、构建步骤。纯 HTML + CSS + 原生 JS。
2. **经典脚本**：每个 JS 文件是一个 IIFE，只往 `window.HUB` 上挂东西，不用 ES module（要能用 file:// 直接打开）。
3. **只改自己负责的文件**。需要别人的接口时，按本文的接口来调用；接口不够用，写在交付说明里，不要去改别人的文件。
4. **界面全中文**。文字朴素，不用营销腔。
5. **去 AI 化**：不用 emoji、不用渐变、不用发光和阴影堆叠、不用霓虹配色。图标一律用文字或简单几何形状。
6. **只用 `css/tokens.css` 里的 CSS 变量取色**，不要写死颜色（类型色和状态色也在 tokens 里）。
7. **所有数据来自 `HUB.model`**。不要在视图里编造数字。模拟出来的事实一律标“模拟数据”。
8. **对象用稳定编号**：DOM 元素上写 `data-key="<类型>:<编号>"`，更新时就地改，不要整块重建（为了过渡动画）。
9. **性能**：最大案例 27 个个体、上千条事实，每次状态变化的更新要在 30 毫秒内完成。

## 3. 文件布局与分工

```
hub/
  index.html          壳：加载顺序固定（见第 9 节）
  SPEC.md             本文
  css/tokens.css      颜色、字号、间距，浅色和深色两套          [核心]
  css/app.css         整体布局：顶栏、上下文栏、侧栏、舞台、抽屉、时间线 [核心]
  css/org.css         ①②③                                       [核心]
  css/process.css     ④                                          [H5]
  css/run.css         ⑤⑥                                         [H6]
  css/panels.css      面板                                        [H7]
  css/details.css     详情抽屉                                    [H8]
  css/timeline.css    时间线、图例、概念说明                      [H9]
  data/base.js        由 tools/extract_base.js 从 v41 生成          [生成]
  data/zh.js          60 个智能体和 62 个预设的中文名与说明        [H1]
  data/cases/*.js     精选案例的覆盖数据                          [H2-H4]
  js/core/util.js     HUB.util、HUB.bus                           [核心]
  js/core/store.js    观察状态、历史、链接                         [核心]
  js/core/casedef.js  预设 → 定义                                 [核心]
  js/core/sim.js      定义 → 模拟事实（确定性）                    [核心]
  js/core/analysis.js 定义 + 事实 → 分析结果                       [核心]
  js/core/model.js    HUB.model：组装、缓存、操作                  [核心]
  js/core/views.js    视图注册表和六个预设                         [核心]
  js/render/svg.js    SVG 工具、平移缩放、补间                     [核心]
  js/views/org.js     ①②③ 组织主体的渲染器                       [核心]
  js/views/process.js ④ 流程主体的渲染器                          [H5]
  js/views/run.js     ⑤⑥ 执行主体的渲染器                         [H6]
  js/panels/panels.js 面板呈现                                     [H7]
  js/details/details.js 详情抽屉和操作                             [H8]
  js/ui/timeline.js   底部时间线                                   [H9]
  js/ui/guide.js      图例和概念说明                               [H9]
  js/ui/shell.js      顶栏、上下文栏、侧栏、面包屑、键盘            [核心]
  js/main.js          启动                                          [核心]
  tools/              提取、测试、打包脚本                          [核心]
```

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

## 8. 渲染器接口（`HUB.render`）

```js
HUB.render.register(subject, {
  mount(stageEl),                 // 主体切换进来时调用一次，在 stageEl 里建自己的 DOM
  update(model, state, prev),     // 每次状态或模型变化都调用；就地更新
  unmount(),                      // 主体切走时调用，清理事件
  fit()                           // 可选：适应窗口
})
```

渲染器内的交互约定：
- 单击对象：`HUB.store.set({ selection: {type, id}, drawer: true }, { history: false })`。
- 双击分组、阶段、决策：`HUB.store.toggle(...)`。
- 双击个体：进入它最近的一次运行（v5）。
- 选中类型名：`individual`、`group`、`relation`、`agg`（合并线）、`channel`、`doc`、`case`、`task`、`run`、`decision`、`call`、`stage`、`step`、`gate`、`flow`、`handoff`、`delivery`。

其他模块：
- `HUB.panels.render(el, model, state)`：面板呈现。
- `HUB.details.render(el, model, state)`：详情抽屉，内容取决于 `state.selection`；没有选中时显示当前案例概况。
- `HUB.timeline.mount(el)`、`HUB.timeline.update(model, state)`。
- `HUB.guide.open(topic)`、`HUB.guide.legend(el, state)`。
- `HUB.model.perform(kind, payload)`：页面操作，见第 11 节。

## 9. 加载顺序（index.html）

```
data/base.js, data/zh.js, data/cases/*.js,
js/core/util.js, js/core/store.js, js/core/casedef.js, js/core/sim.js, js/core/analysis.js, js/core/model.js, js/core/views.js,
js/render/svg.js, js/views/org.js, js/views/process.js, js/views/run.js,
js/panels/panels.js, js/details/details.js, js/ui/timeline.js, js/ui/guide.js, js/ui/shell.js, js/main.js
```

## 10. 视觉约定

颜色全部取 `css/tokens.css` 的变量：

| 用途 | 变量 |
|---|---|
| 正文、次要、弱 | `--ink`、`--ink-2`、`--ink-3` |
| 底色、面板、线 | `--bg`、`--panel`、`--panel-2`、`--line`、`--line-2` |
| 强调（选中、聚焦） | `--accent`、`--accent-weak` |
| 线的类型 | `--c-task`、`--c-info`、`--c-watch`、`--c-channel` |
| 只有事实 | `--c-factonly` |
| 个体状态 | `--s-working`、`--s-waiting`、`--s-standby`、`--s-error`、`--s-never` |
| 判断点 | `--c-gate` |

对照的三种状态，三种主体都用同一种画法：
- 两者都有：实线；线宽按次数（1 到 5 像素，对数）。
- 只有定义（设计了没发生）：虚线 `4 4`，降低不透明度；个体、分组、阶段画虚线框。
- 只有事实（编排里没有）：实线，颜色 `--c-factonly`，旁边标“未声明”。

`compare='def'` 时不画次数和状态；`compare='fact'` 时不画没发生的东西。

字号：正文 13px，次要 12px，最小 11px。字体用系统字体栈（tokens 里的 `--font`）。圆角 6px。动画 250～350 毫秒，`prefers-reduced-motion` 时关掉。

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
