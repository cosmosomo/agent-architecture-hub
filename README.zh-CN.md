# Agent Architecture Hub

**文档即编排，以及它的调试器。**

[English](README.md) | 简体中文

把一个多智能体团队怎么组织写成 Markdown：谁做什么、按什么顺序、用哪些工具和模型、谁来把关。Hub 读这些文档，把团队画出来，并把**写下来的**和**真正发生的**放在一起：一份记录下来的运行，或你本机上真实的 Codex / Claude Code 会话。页面就是调试器：**定义 ↔ 事实 ↔ 分析**。

![从 Markdown 文档画出来的一个示例案例的团队](docs/img/overview.jpg)

## 为什么

多智能体系统会跑偏。计划里写着审核员读调研员的产出，实际运行里是执行者直接去问调研员；计划里有一道质量关，从来没有人被它拦下；某个智能体被定义了，却从没被派过活。编排活在提示词和人的脑子里时，这些都看不见。

Hub 把编排当成一等的、**写下来的**东西——谁都能读、能比对、能评审的文档——再拿事实去对。每一处差别都是一个发现：一条从没用过的线、一次没有任何文档声明的交接、一份没送到需要它的智能体手里的资料。

## 快速开始

需要 Node.js 24 或更新。

```bash
npm run setup     # 只做一次：安装依赖并构建 Trace 查看器
npm start         # 整个观察台在 http://127.0.0.1:8899/
```

Windows 下 `start.bat` 两步都做并打开浏览器。`npm start -- --port 9000` 换端口。

只有一个服务、一个地址：页面、会话接口和 Trace 查看器（`/trace/`）由同一个进程提供，所以总是一起在、一起不在。页面不打算从磁盘或静态托管打开——它的案例都从这个服务读。

## 页面上有什么

- **一个团队，几种看法。** ① 全部个体和它们的线，② 部门，③ 一个案例真实走过的路，④ 带关卡的业务流程，以及协作轨迹图（一条一条记录看谁把什么交给了谁）。快捷键 `1`–`4` 和 `T`；粒度（部门 / 小组 / 个体）和对照方式（*定义* / *对照* / *事实*）是单独的开关，所以切换视图只改一两项，卡片原地移动。
- **定义对事实。** 实线：写了也发生了；虚线：写了但从没发生；橙色：发生了但没写。“体检”页列出需要人处理的事和检查发现的问题。
- **时间。** 底部的时间轴可以在任一时刻切开事实，也能回放。
- **一次运行的细节。** 双击一个个体：它某次运行里的决策和调用，画成调用树。
- **直接动手。** 拖动卡片和部门标题，挪动量按案例记在浏览器里（“还原布局”放回去）；滚轮缩放，拖背景平移。页面上看到的一切都在地址栏里，所以一个链接就能还原。
- **明暗两套主题。**

![同一个案例的业务流程](docs/img/process.jpg)

## 写一个案例

案例就是 `hub/cases/` 下带 `meta.md` 的文件夹。放进去就出现在“目录”页里，不用登记。

```text
hub/cases/demo_minimal/
  meta.md      标题和一段话
  agents.md    团队里有谁
  groups.md    怎么分组
  process.md   阶段和关卡
  relations.md、docs.md、scenarios.md、decisions/<智能体>.md    （都可选）
```

最小示例的 `agents.md`：

```markdown
---
hub: "1.0"
kind: agents
case: demo_minimal
---

# @worker [individual] #phase/build #role/engineer #hub
name: 执行者
model: claude-sonnet-5-5
role: 按清单把活干完并交付
trigger: 分派任务后启动

# @checker [individual] #phase/qa #role/reviewer
name: 把关者
role: 检查交付是否符合清单，不合格打回
watches: [worker]
```

`# @id [type] #tag` 开一个对象，`key: value` 行描述它。页面能解析多少就画多少；只读懂一半的文档画到哪算哪，没读懂的在详情里的“原始字段”里。`hub/cases/` 下用 [hub-graph 格式](docs/hub-graph-format.md) 写的 `.json` 文件同样是案例，任何有识别器的条目也是。

名字以下划线开头的文件夹是**架子**：默认收着，点开才去读。大模型整理出来的参考案例放在这里（见 `hub/cases/_reference/README.md`），它们不属于这个仓库。

## 事实从哪来

| 来源 | 是什么 |
|---|---|
| 模拟 | 按写下来的编排确定性地模拟出来，所有出现的地方都标“模拟数据”。62 个内置示例团队和没有记录的案例用它。 |
| 记录的轨迹 | 案例里的 `traces/` 文件夹，由和案例 `source:` 对得上的读取器读。定义和事实各自独立，对照才有意义。 |
| 本机会话 | 你机器上的 Codex、Claude Code、OpenCode、Gemini CLI、Factory、ZCode 会话，在本机解析成同一份契约，显示在“会话”页和 Trace 查看器里（列表、调用树、全文检索、统计）。只读，不出本机。 |

## 扩展

每个接缝都是一张登记表，新增一类东西是一次登记，不是一处补丁：

| 想加…… | 登记…… |
|---|---|
| 一类磁盘上的案例 | 一个识别器（`HUB.catalog.recognize`）加一个来源（`HUB.model.addSource`） |
| 一种事实来源 | 一个提供者（`HUB.facts.register`） |
| 一个视图 | `HUB.views.register` |
| 画板能画的主体，或自带一层 | `HUB.render.register` |
| 一种智能体会话日志 | `trace/packages/adapters` 里的一个 `SourceAdapter` |

[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) 讲各部分怎么拼；[docs/SPEC.md](docs/SPEC.md) 是详细规格。

## 安全与隐私

- 服务只监听 `127.0.0.1`，`Host` 不是自己地址的请求一律拒绝（防 DNS 重绑定）；不发任何 CORS 头，所以浏览器里的其他网站读不到你的会话。
- 只读：只有 `GET`/`HEAD`，静态文件限定在 `hub/` 内，路径穿越一律拒绝（编码两次也不行）。
- 会话在你本机解析；索引缓存在 `~/.agent-hub/trace`（用 `HUB_TRACE_HOME` 改位置）。工具输入输出里像密钥的字符串在解析时打码。
- 页面带内容安全策略（`self`，字体另允许 Google Fonts）。没有网络时回退系统字体。

## 仓库结构

```text
index.html          页面
hub/
  js/core/          模型：状态、分析、视图、目录、事实提供者
  js/sources/       解析：案例文档、hub-graph、记录的轨迹、会话、模拟器
  js/shell/         画布外面的页面：镜头、标签页、主题
  js/obs/           画布和面板：场景、卡片、控件、侧栏页
  css/、data/       样式；内置的智能体、示例团队和文本
  cases/            案例（参考语料有的话放在 cases/_reference/）
  tools/            在 node 里不开浏览器把整个模型跑一遍的检查
  vendor/           Trace 视图的单文件构建产物（来自 trace/apps/viewer）
trace/              会话工作区：契约、适配器、OpenTelemetry 导出、服务、Trace 查看器
concept/            概念画板：独立的拖拽式团队设计器（自带数据），在 /concept/
docs/               架构、规格、格式
```

`npm test` 跑 node 检查和工作区测试；`npm run typecheck` 检查 TypeScript。

## 概念画板

`/concept/` 是这个项目当初长出来的那块手工搭建的团队画板：一个自包含的 HTML 页，拖拽组合智能体团队，带自己的智能体和团队目录。它保持原样，和观察台分开——数据不共用。

## 许可和致谢

MIT，见 [LICENSE](LICENSE)。页面的视觉语言、图标和内置的智能体与团队目录来自 TheJacksonCode 的 [Agent Architecture Designer](https://github.com/TheJacksonCode/Agent-Architecture)（MIT）；围绕它们的观察台是本项目的。
