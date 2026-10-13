# hub-graph 格式规范 v1.0

这份文档定义 `hub-graph` 格式：任何来源（Codex 会话、Claude Code 会话、编排文档、别的协作系统）都可以输出这个格式，页面读进来就能渲染。

格式只描述"是什么"，不描述"长什么样"。展示效果靠前端的组件注册表和布局引擎，不靠格式表达布局。

---

## 1. 顶层结构

```json
{
  "format": "hub-graph",
  "formatVersion": "1.0",
  "meta": {
    "producer": "codex-adapter@0.1",
    "producedAt": "2026-10-10T09:00:00Z",
    "sourceRef": "codex:01a0f31e..."
  },
  "objects":   [],
  "relations": [],
  "view":      {},
  "panels":    {}
}
```

| 字段 | 必填 | 说明 |
|------|------|------|
| `format` | 是 | 固定值 `"hub-graph"`，让解析器认出这是我们的格式 |
| `formatVersion` | 是 | `"1.0"`，解析器做版本迁移时依据这个 |
| `meta` | 是 | 生产者信息，不影响渲染 |
| `objects` | 是 | 所有节点：个体、部门、渠道、运行、决策、调用等 |
| `relations` | 是 | 所有连线：任务线、信息线、监督线、渠道线 |
| `view` | 否 | 观察状态的序列化，不给就用默认预设 |
| `panels` | 否 | 数字、清单、统计，供侧栏面板使用 |

---

## 2. objects — 节点

每个节点的公共字段：

```json
{
  "id": "agent-frontend",
  "type": "individual",
  "name": "前端开发",
  "tags": ["phase/build", "model/sonnet", "team/wave-1"],
  "attributes": {
    "model": "claude-sonnet-5-5",
    "role": "实现 UI 组件",
    "isHub": false
  }
}
```

| 字段 | 必填 | 说明 |
|------|------|------|
| `id` | 是 | 全局唯一字符串，relations 里引用这个 |
| `type` | 是 | 语义角色（见下表），不是画法 |
| `name` | 是 | 显示名称 |
| `tags` | 否 | 标签数组（见第 3 节） |
| `attributes` | 否 | 开放键值袋，前端认识的键用于渲染变体，不认识的进详情页 |

### 内置 type 枚举

| type | 含义 | 前端组件 |
|------|------|---------|
| `individual` | 一个智能体或人 | 个体卡（含专属能力变体） |
| `group` | 一批个体的归属（部门、波次） | 展开/折叠的框架 |
| `channel` | 模型渠道或功能渠道 | 渠道卡（含并发格子） |
| `run` | 一次运行（一轮对话） | 运行节点 |
| `decision` | 一个决策段（粗粒度） | 决策段卡（含因为/选了/理由） |
| `call` | 一次模型或工具调用 | 调用行 |
| `case` | 一个任务或案例 | 案例节点 |
| `merged` | 快速聚合的占位节点 | 聚合占位卡 |

**未知 type 降级渲染**：前端遇到不认识的 type，用默认卡片画出来，不崩。这是格式可扩展的前提。

---

## 3. 标签系统

标签是核心扩展点，比枚举字段更灵活，可以驱动层级化聚合和粗粒度图谱。

```json
"tags": [
  "phase/build",
  "model/sonnet",
  "team/wave-1",
  "status/working",
  "role/orchestrator"
]
```

### 格式约定

建议用 `namespace/value` 的格式，`/` 前是命名空间，`/` 后是值。

**命名空间完全开放**——解析器可以自由定义新的命名空间，前端不认识的命名空间不影响渲染，只进详情页。加一个新维度的分类不需要改前端。

内置命名空间（建议使用，不强制）：

| 命名空间 | 示例值 | 用途 |
|----------|--------|------|
| `phase` | `build` `qa` `research` `strategy` | 所处阶段，驱动颜色和自动分组 |
| `model` | `sonnet` `opus` `haiku` | 使用的模型 |
| `status` | `working` `waiting` `error` `idle` | 运行状态 |
| `team` | `wave-1` `backend` `auth` | 团队或波次分组 |
| `role` | `orchestrator` `reviewer` `planner` | 语义角色 |

### 标签驱动的自动分组

前端可以按任意命名空间分组：扫描所有节点的 tags，按某个命名空间下的值分桶，每桶变成一个聚合占位卡（`type: "merged"`）。换命名空间就换了一套聚合粒度，不改代码。

**刻意留出的扩展余地**（现在不定义，未来可迭代）：
- 标签带权重或置信度：`phase/build:0.9`
- 标签层级树：`team/backend/auth`
- 标签跨节点打（"这几个个体同属一个任务线"）

---

## 4. relations — 连线

```json
{
  "id": "r1",
  "type": "task",
  "sub": "dispatch",
  "from": "agent-main",
  "to": "agent-frontend",
  "label": "派出",
  "state": "both",
  "attributes": {}
}
```

| 字段 | 必填 | 说明 |
|------|------|------|
| `id` | 是 | 全局唯一 |
| `type` | 是 | 连线大类（见下表） |
| `sub` | 否 | 子类型，进一步区分同一大类里的语义 |
| `from` / `to` | 是 | 引用 object.id |
| `label` | 否 | 显示文字 |
| `state` | 否 | `"both"`（定义+事实）/ `"defined-only"`（只有定义）/ `"fact-only"`（只有事实）；实线虚线由前端决定 |

### 连线 type 枚举

| type | sub 示例 | 含义 |
|------|----------|------|
| `task` | `dispatch` `deliver` `report` | 任务派发和交付 |
| `info` | `read` `write` | 信息读写依赖 |
| `watch` | `watch` | 监督或观察 |
| `channel` | `use` | 使用渠道 |

---

## 5. view — 观察状态（可选）

`view` 段是"选哪个预设"或"记录当前的观察状态"，不是布局指令。对应 `hub/js/core/store.js` 里的 state。

```json
{
  "subject": "org",
  "depth": { "org": 2, "process": 1, "exec": 1 },
  "focus": { "type": "case", "id": "k1" },
  "compare": "both",
  "lines": { "task": true, "info": false, "watch": true, "channel": false },
  "overlays": { "human": true, "channels": true },
  "merged": [
    { "id": "mg_1", "name": "开发组", "memberIds": ["agent-frontend", "agent-backend"] }
  ]
}
```

不给 `view` 段就用前端的默认预设（部门架构图，粒度 1）。

---

## 6. panels — 侧栏面板数据（可选）

供侧栏面板使用的结构化数据：数字、清单、统计等。格式开放，前端认识的键渲染成对应面板，不认识的忽略。

```json
{
  "summary": {
    "agents": 5,
    "runs": 23,
    "toolErrors": 2,
    "durationMs": 3600000
  },
  "checklist": [
    { "id": "c1", "text": "实现登录页", "done": true },
    { "id": "c2", "text": "写单元测试", "done": false }
  ]
}
```

---

## 7. 适配器接口

每种来源实现一个适配器，输出 hub-graph JSON，前端通过 `HUB.model.addSource` 注册。

```js
HUB.model.addSource({
  id: 'my-source',
  label: '我的来源',
  owns: function(id) { return /^my:/.test(id); },
  load: function(id) {
    return fetch('/api/my-source/' + id)
      .then(r => r.json())
      .then(doc => HUB.fromHubGraph.model(doc));  // 反序列化到统一模型
  }
});
```

`HUB.fromHubGraph.model(doc)` 是格式到统一模型的转换函数。

**换来源不改前端**：加一种来源 = 写一个适配器 + 注册一行。

---

## 8. 版本迁移

- 格式升到 `1.1` 时，解析器负责迁移到当前统一模型版本，前端不动。
- 迁移规则写在适配器里，不在格式文档里。
- `formatVersion` 是迁移的依据，解析器读这个字段决定用哪套迁移路径。

---

## 9. 三条验收标准

1. 换一份 hub-graph JSON 文件，页面重新生成，零代码改动。
2. 加一类节点，只改注册表（`HUB.obsCards.extra`）+ 一个渲染函数。
3. 格式升到 `1.1`，前端不动（解析器负责迁移到当前模型版本）。

---

## 10. 和现有代码的对应关系

| hub-graph 概念 | 代码位置 |
|---------------|---------|
| `objects` (individual/group/channel) | `hub/js/sources/casedef.js` → `def` |
| `objects` (run/call/handoff) | `hub/js/sources/sim.js` → `facts` |
| `relations` | `def.relations` |
| `view` | `hub/js/core/store.js` state |
| `merged[]` | `store.state.merged` |
| 适配器注册 | `HUB.model.addSource` (`hub/js/core/model.js`) |
| 格式 → 统一模型 | `hub/js/sources/from-trace.js`（会话版），`from-hub-graph.js`（文件版） |
| type → 组件 | `hub/js/obs/cards.js` `HUB.obsCards.extra` |

---

## 11. 托管与案例发现

放在 `hub/graph/` 下的 `<案例id>.json` 由 `from-hub-graph.js` 自动发现，规则按顺序：

1. **目录列表**：本地 http 服务（python http.server 等）的目录页里能扫到 `href="*.json"` 就直接用，新建文件免注册；
2. **`hub/graph/_index.json` 回退**：目录请求拿不到列表（GitHub Pages 等纯静态托管对目录返回 404）时，读这份注册表——数组，元素是案例 id 字符串或 `{id, name}`。

也就是说：本地开发靠 1（零注册），公开静态托管靠 2（新案例往数组里加一行）。案例文件本身两种环境都能直接访问，回退只影响"发现"，不影响"加载"。
