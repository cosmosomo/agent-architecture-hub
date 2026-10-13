# Agent Architecture Hub

**把你的多智能体团队写下来，再看它实际是怎么干活的。**

[English](README.md) | 简体中文

大多数多智能体系统的编排散落在提示词里，也装在人的脑子里。Hub 给编排一个安身之处——写成普通的 Markdown：团队里有谁、谁归谁管、流程怎么走、每个人用哪些工具和模型——然后拿现实去对：一份记录下来的运行，或你本机上真实的 Codex / Claude Code 会话。两边对不上的地方，一眼就能看到。

![一个团队，从几份 Markdown 文档画出来](docs/img/overview.jpg)

## 它能帮上什么忙

多智能体系统会跑偏。计划里写着审核员读调研员的产出，实际运行里却是执行者直接去问调研员；有一道质量关，从来没人被它拦下；有的智能体被定义了，却一直没分到活。编排散在各处的时候，这些都看不见。

Hub 把编排当成一件真实的、**写下来的**东西——谁都能读、能比对、能评审的文档——再拿事实去对。每一处差别都是一个发现：一条从没用过的线、一次没有任何文档声明的交接、一份没送到需要它的智能体手里的资料。

## 看一圈

下面全是随仓库带的小示例案例（`hub/cases/`）的真实截图，没有做过任何美化。（协作轨迹那张是公开数据集里一次真实记录下来的失败，对应的案例放在仓库外面。）

**一切从一个 Markdown 文件夹开始。** 上面那张图就是 `hub/cases/feature_sprint/`：几份文档，写清团队有谁、怎么分组、流程怎么走。部门可以折成一张卡，也可以展开成里面的人；点任何一个人，就能看到他的职责、他盯着谁、他该收到哪些资料。

<table>
<tr>
<td width="50%"><img src="docs/img/route.jpg" alt="一个案例实例走过的路，金色点亮"><br><b>跟着一件活走一遍。</b>选一个案例实例，它真正走过的路用金色点亮，交接按顺序编号，没碰过的部分淡下去。</td>
<td width="50%"><img src="docs/img/health.jpg" alt="写的和发生的对照，以及体检清单"><br><b>看计划和事实在哪里分了手。</b>实线：写了也发生了；虚线：写了但没用上；橙色：发生了但哪里都没写。体检页把这些变成一张待办清单。</td>
</tr>
<tr>
<td width="50%"><img src="docs/img/run.jpg" alt="一次运行的决策树，带输入输出"><br><b>下钻到一个决策。</b>双击一个智能体：它做了什么决定、权衡过什么、调用了什么，真实的输入和输出就在旁边。</td>
<td width="50%"><img src="docs/img/trajectory.jpg" alt="一次记录下来的失败运行，一条一条看"><br><b>一条记录一条记录地回放。</b>一次真实记录下来的失败：谁把什么交给了谁，数据集标出的那个出错的步骤被旗子标着。记录里没有依据的东西，一条线也不画。</td>
</tr>
<tr>
<td width="50%"><img src="docs/img/process.jpg" alt="带关卡的业务流程"><br><b>不只看组织图，也看流程。</b>阶段、关卡、谁来判断每一道关、什么时候打回、什么时候上报给人。</td>
<td width="50%"><img src="docs/img/light.jpg" alt="浅色主题"><br><b>明或暗，随你。</b>两套主题一样认真做过，选了就记住。</td>
</tr>
</table>

## 用着用着会发现有用的小地方

- **不装懂。** 模拟出来的事实，出现的每个地方都标着“模拟数据”。交接只在记录里写明发生过才画，绝不靠“B 在 A 之后说话”去猜。没人测过的量写“未采集”，不会冒出一个 0。
- **你的会话还是你的。** Codex、Claude Code、OpenCode、Gemini CLI、Factory、ZCode 的会话都在你本机读、本机解析成同一份契约，能一步一步全文检索，不会上传。像密钥的字符串在解析时就打码了。
- **一个链接就是一个视图。** 案例、视图、粒度、时间切面、选中的东西，全在地址栏里；你看到什么，发给别人的就是什么。
- **能动手挪。** 拖卡片、拖部门标题，页面按案例记住；一个按钮全部放回去。
- **一条命令。** `npm start` 把页面、会话接口和 Trace 查看器一起起来。端口被占了，它会换下一个并告诉你。
- **长得出去。** 每个接缝都是一张登记表：新增一类磁盘上的案例、一种事实来源、一个视图、画板上的一种新画法，都是一次登记，不是一处补丁。
- **自己拿大量案例考自己。** 有一道检查能把指给它的案例逐个画一遍——作者那份语料里有 1141 个机器整理出来的——数空框、没名字的卡、破文字。页面就是这样学会了不画空壳。

## 快速开始

需要 Node.js 24 或更新。

```bash
npm run setup     # 只做一次：安装依赖并构建 Trace 查看器
npm start         # 整个观察台在 http://127.0.0.1:8899/
```

Windows 下 `start.bat` 两步都做并打开浏览器。`npm start -- --port 9000` 换端口。

只有一个服务、一个地址：页面、会话接口和 Trace 查看器（`/trace/`）由同一个进程提供，所以总是一起在。页面不打算从磁盘或静态托管打开——它的案例都从这个服务读，连不上时会直接告诉你。

快捷键：`1`–`4` 和 `T` 切视图，`F` 适应窗口，`?` 讲解页面上的一切。粒度（部门 / 小组 / 个体）和对照方式（*定义* / *对照* / *事实*）是单独的开关，所以切换视图只改一两项，卡片原地移动。

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

[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) 讲各部分怎么拼；[docs/hub-graph-format.md](docs/hub-graph-format.md) 是 JSON 格式规范。

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

`/concept/` 是这个项目当初长出来的那块手工搭建的团队画板：一个自包含的 HTML 页，拖拽组合智能体团队，带自己的智能体和团队目录。就是中文版页面，保持原样，和观察台分开——数据不共用。

## 许可和致谢

MIT，见 [LICENSE](LICENSE)。页面的视觉语言、图标和内置的智能体与团队目录来自 TheJacksonCode 的 [Agent Architecture Designer](https://github.com/TheJacksonCode/Agent-Architecture)（MIT）；围绕它们的观察台是本项目的。
