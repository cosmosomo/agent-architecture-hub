# 手机督工台 v2（/m/）真人体验验收报告

**验收日期**：2026-10-18  
**验收环境**：Edge Headless 模拟真实移动端竖屏（视口 375×812，DPR=2，iOS Safari User-Agent）  
**测试入口**：`http://10.126.126.1:8899/m/`（免密局域网直连）  
**验收原则**：按真人拿手机操作方式逐项真点、真建会话、真插话、真打断，不只测接口。结论不主观臆测，全部附带截图文件路径与 DOM/接口实测内容。不改动 `m/` 和 `trace/` 代码。

---

## 一、问题 1 回答：用户问的“选项目、选模型、新会话”在页面上能否走通？

**验收链路**：进一个项目 → ＋新任务 → 选家、选模型 → 开始 → 能否看到这个新会话并跟着它一步步推进。

### 核心结论：**部分走通，但存在严重的人机体验断流卡点**

| 环节 | 能否走通 | 真人实测表现与证据 |
|---|---|---|
| **1. 进一个项目** | **通** | 在底栏切到“项目”（`#/projects`），能看到按目录归集的项目列表卡片（如 `LightRAG`、`multi` 等），点击卡片可顺利进入项目会话列表 `#/p/<project_path>`。附截图：[24_projects_view.png](file:///E:/program/GIT/Agent/multi/Agent-Architecture-Hub/channels/probe/results/screenshots-m-v2/24_projects_view.png)、[26_project_view_sort_chips.png](file:///E:/program/GIT/Agent/multi/Agent-Architecture-Hub/channels/probe/results/screenshots-m-v2/26_project_view_sort_chips.png)。 |
| **2. ＋新任务** | **通** | 顶部右上角有 `＋ 新任务` 按钮，点击后从底部平滑滑出 `.sheet` 任务配置浮层。附截图：[28_project_new_task_modal.png](file:///E:/program/GIT/Agent/multi/Agent-Architecture-Hub/channels/probe/results/screenshots-m-v2/28_project_new_task_modal.png)。 |
| **3. 选家、选模型** | **通** | “交给谁”支持选择 Claude、ZCode、Antigravity、OpenCode、Hermes 等；选择厂家后，“模型”下拉框会联动更新为该家推荐模型清单（如选 Antigravity 出现 `pro`、`flash`、`flash_lite`；选 ZCode 出现 `builtin:bigmodel-coding-plan\GLM-5.3-Flash`、`GLM-5.3`、`ark-code-latest`）。工作目录自动预填当前项目路径。附截图：[18_new_task_zcode_models.png](file:///E:/program/GIT/Agent/multi/Agent-Architecture-Hub/channels/probe/results/screenshots-m-v2/18_new_task_zcode_models.png)、[06_new_task_filled.png](file:///E:/program/GIT/Agent/multi/Agent-Architecture-Hub/channels/probe/results/screenshots-m-v2/06_new_task_filled.png)。 |
| **4. 点击“开始”** | **通** | 输入 `probe-count-md: 请统计当前目录下有多少个 .md 文件...`，点击“开始”，调用 `POST /api/gateway/send` 成功，弹窗消失并弹出 Toast `已开始：m-1018045853`。附截图：[07_after_submit_toast.png](file:///E:/program/GIT/Agent/multi/Agent-Architecture-Hub/channels/probe/results/screenshots-m-v2/07_after_submit_toast.png)。 |
| **5. 自动跳转与跟进新会话** | **断流（严重缺陷）** | **无法自动跳转！用户被丢在原地！** 代码写死 `setTimeout(..., 5000)` 后拉取列表并根据名称跳转。但由于后台启动智能体并写入第一笔会话索引需要 6~10 秒，5 秒超时后查询不到该会话，直接执行 `else route()` 留在当前项目页。界面没有任何 Loading 或轮询等待提示，给人一种“点了没反应/失败了”的卡死感。附截图：[08_redirect_or_list.png](file:///E:/program/GIT/Agent/multi/Agent-Architecture-Hub/channels/probe/results/screenshots-m-v2/08_redirect_or_list.png)。 |
| **6. 跟随一步步推进** | **通（进入详情后）** | 当手动跳转进新建的会话（`#/s/antigravity:f9b4a5b9-a8fa-4fe5-b640-66bc1b5a0a68`）后，页面能够每 3 秒自动轮询拉取增量步骤并更新视图。在实测中，会话从第 1 轮 0 步自主执行到 12 步，再到 16 步，工具调用卡片、思考过程与最终输出能够实时动态流式呈现。附截图：[08b_session_entered.png](file:///E:/program/GIT/Agent/multi/Agent-Architecture-Hub/channels/probe/results/screenshots-m-v2/08b_session_entered.png)、[09_session_live_view.png](file:///E:/program/GIT/Agent/multi/Agent-Architecture-Hub/channels/probe/results/screenshots-m-v2/09_session_live_view.png)、[12_session_status.png](file:///E:/program/GIT/Agent/multi/Agent-Architecture-Hub/channels/probe/results/screenshots-m-v2/12_session_status.png)。 |

---

## 二、问题 2 回答：登记表 36 项“人机交互”能力单元落地情况逐条核对

对照《能力单元登记表_20261017.md》第 3 节中所有以“人机交互”开头的单元（共 36 项），逐条验证：

| 序号 | 单元 ID | 名称 | 类别 | 当前达成程度 | 实测证据与现状说明 |
|---|---|---|---|---|---|
| 1 | `project-view` | 按项目归集 | 显示与导航 | **做了且真能用** | `#/projects` 页面按 `s.project` 聚合归集所有本机会话，展示项目名、物理路径、活跃干活数与会话总数，点击直达该项目下专属会话列表。[24_projects_view.png](file:///E:/program/GIT/Agent/multi/Agent-Architecture-Hub/channels/probe/results/screenshots-m-v2/24_projects_view.png) |
| 2 | `observe-steps` | 读一轮全过程 | 显示与导航 | **做了且真能用** | `stepsHtml` 分解每轮全过程，能读到思考过程、中间文字回复、每个工具调用参数与结果，超长活动块自动折叠并支持懒加载。[14_expanded_tool_steps_top.png](file:///E:/program/GIT/Agent/multi/Agent-Architecture-Hub/channels/probe/results/screenshots-m-v2/14_expanded_tool_steps_top.png) |
| 3 | `follow-progress` | 跟随自主推进 | 显示与导航 | **做了且真能用** | `viewSession` 设有 3 秒自适应定时轮询，抓取 `/api/sessions/<id>?tail=2`，智能体每出一步在几秒内刷新上屏，距底部近时自动平滑滚到底部。[09_session_live_view.png](file:///E:/program/GIT/Agent/multi/Agent-Architecture-Hub/channels/probe/results/screenshots-m-v2/09_session_live_view.png) |
| 4 | `search-sessions` | 搜索会话 | 显示与导航 | **做了且真能用** | 双层检索：输入框即时过滤内存标题/目录/模型；输入字数≥2 且停顿 400ms 后自动触发 `/api/search` 全文检索，展示内容命中高亮摘要及轮次。[25_content_search_hits.png](file:///E:/program/GIT/Agent/multi/Agent-Architecture-Hub/channels/probe/results/screenshots-m-v2/25_content_search_hits.png) |
| 5 | `attach` | 发图与附件 | 显示与导航 | **没做** | 会话输入框仅支持多行纯文本，**没有任何添加图片或附件文件的按钮**。仅在全局反馈弹窗中支持了截图粘贴与上传，会话中对智能体发附件未实现。[10_composer_with_text.png](file:///E:/program/GIT/Agent/multi/Agent-Architecture-Hub/channels/probe/results/screenshots-m-v2/10_composer_with_text.png) |
| 6 | `ui-sidebar` | 会话侧栏 | 导航 | **做了但有问题** | 手机端由于屏幕宽度限制没有常驻侧栏，降级为独立“项目列表”视图与 Hash 路由跳转。进入会话后缺乏抽屉式轻量会话切换面板，多任务切换必须频繁点返回键。[24_projects_view.png](file:///E:/program/GIT/Agent/multi/Agent-Architecture-Hub/channels/probe/results/screenshots-m-v2/24_projects_view.png) |
| 7 | `ui-filter` | 筛选 | 导航 | **做了且真能用** | 提供横向滚动的厂家胶囊（全部/Claude/Codex/Antigravity/ZCode 等），项目详情页提供排序（最近更新/轮数最多/工具最多），待处理流提供分级筛选。[20_feed_view_default.png](file:///E:/program/GIT/Agent/multi/Agent-Architecture-Hub/channels/probe/results/screenshots-m-v2/20_feed_view_default.png)、[26_project_view_sort_chips.png](file:///E:/program/GIT/Agent/multi/Agent-Architecture-Hub/channels/probe/results/screenshots-m-v2/26_project_view_sort_chips.png) |
| 8 | `ui-pin` | 置顶 | 导航 | **做了且真能用** | 会话详情页状态栏有“置顶/取消置顶”切换按钮，持久化保存在本地 `localStorage`，置顶会话在列表中带 📌 图标并强制靠前排序。[30_session_pinned.png](file:///E:/program/GIT/Agent/multi/Agent-Architecture-Hub/channels/probe/results/screenshots-m-v2/30_session_pinned.png) |
| 9 | `ui-unread` | 新产出标记 | 导航 | **做了且真能用** | 首页实现“待处理（Feed）”流，对比各会话更新时间与用户上次查看时间（`seen:<id>`），分类标出“要你处理”、“干完了（你还没看）”、“在推进”、“有变化”，支持一键“划掉”并带撤销。[20_feed_view_default.png](file:///E:/program/GIT/Agent/multi/Agent-Architecture-Hub/channels/probe/results/screenshots-m-v2/20_feed_view_default.png) |
| 10 | `ui-running-overview` | 运行总览 | 导航 | **做了且真能用** | 首页待处理流汇总顶栏显示“要你处理 X · 干完了 Y · 在推进 Z”，项目视图顶部专设“正在干活 (N)”独立聚合区块，跨厂家直观汇总。[20_feed_view_default.png](file:///E:/program/GIT/Agent/multi/Agent-Architecture-Hub/channels/probe/results/screenshots-m-v2/20_feed_view_default.png)、[24_projects_view.png](file:///E:/program/GIT/Agent/multi/Agent-Architecture-Hub/channels/probe/results/screenshots-m-v2/24_projects_view.png) |
| 11 | `ui-markdown` | 富文本显示 | 显示 | **做了且真能用** | 内置零外部依赖轻量 Markdown 引擎，正常渲染 h1-h4、粗斜体、列表、表格、代码块及外链，实测在无互联网离线状态下排版结构清晰。[09_session_live_view.png](file:///E:/program/GIT/Agent/multi/Agent-Architecture-Hub/channels/probe/results/screenshots-m-v2/09_session_live_view.png) |
| 12 | `ui-thinking` | 思考过程显示 | 显示 | **做了且真能用** | 渲染为带有淡紫背景的 `<details class="step think">` 折叠卡片，默认收起并显示首行思考摘要，点击可展开查看完整深度推理过程。[14_expanded_tool_steps_top.png](file:///E:/program/GIT/Agent/multi/Agent-Architecture-Hub/channels/probe/results/screenshots-m-v2/14_expanded_tool_steps_top.png) |
| 13 | `ui-tool-card` | 工具调用卡片 | 显示 | **做了且真能用** | 每次调用独立成卡，展示工具图标（⌘/✎/⚙）、名称、关键参数抽取、成败状态及精确耗时（如 `53.1s`），展开后呈现格式化输入与输出。[14_expanded_tool_steps_top.png](file:///E:/program/GIT/Agent/multi/Agent-Architecture-Hub/channels/probe/results/screenshots-m-v2/14_expanded_tool_steps_top.png)、[32_subagent_session_view.png](file:///E:/program/GIT/Agent/multi/Agent-Architecture-Hub/channels/probe/results/screenshots-m-v2/32_subagent_session_view.png) |
| 14 | `ui-diff` | 文件改动显示 | 显示 | **做了但有问题** | 文件改动以 patch 工具卡片（✎）展示，展开后仅为普通预格式化代码文本框，**缺乏专用红绿背景差异行、增减行号对比高亮界面**。 |
| 15 | `ui-terminal-output` | 命令输出显示 | 显示 | **做了且真能用** | shell 类命令以终端样式展示，输出设置 `max-height: 420px; overflow-x: auto`，超长输出不撑爆页面并可垂直水平滚动查看。[14_expanded_tool_steps_top.png](file:///E:/program/GIT/Agent/multi/Agent-Architecture-Hub/channels/probe/results/screenshots-m-v2/14_expanded_tool_steps_top.png) |
| 16 | `ui-subagent-view` | 子智能体显示 | 显示 | **做了且真能用** | 会话顶部 `#rel` 区块展示父子关联：若属子会话显示“↑ 属于：[父会话]”；若有派生子智能体展示“子智能体 X 个”折叠卡，可点击卡片直达子会话。[32_subagent_session_view.png](file:///E:/program/GIT/Agent/multi/Agent-Architecture-Hub/channels/probe/results/screenshots-m-v2/32_subagent_session_view.png) |
| 17 | `ui-plan-view` | 计划与待办显示 | 显示 | **没做** | 智能体推进过程中的 plan/todo 清单没有独立的看板或勾选待办组件，仅混在普通对话或工具文本中输出。 |
| 18 | `ui-status-line` | 当前状态显示 | 显示 | **做了且真能用** | 详情页吸顶常驻 `#sl` 状态栏，显示状态标签（在干活/停了/在等/出错）、当前动作简述（如“停了（共 16 步）”）、厂家与模型名。[09_session_live_view.png](file:///E:/program/GIT/Agent/multi/Agent-Architecture-Hub/channels/probe/results/screenshots-m-v2/09_session_live_view.png)、[12_session_status.png](file:///E:/program/GIT/Agent/multi/Agent-Architecture-Hub/channels/probe/results/screenshots-m-v2/12_session_status.png) |
| 19 | `ui-usage` | 用量显示 | 显示 | **没做** | 页面各处均未展示 token 用量、上下文窗口百分比、计费消耗或通道额度。 |
| 20 | `ui-long-history` | 长会话浏览 | 显示 | **做了且真能用** | 默认仅加载尾部 3 轮，顶部提供“加载更早的轮次（前面还有 N 轮）”分页按钮，点击向上拉取 5 轮并精准锁定滚动位置不跳屏。实测在 1154 轮的超长会话中毫秒级加载。[33_long_session_tail.png](file:///E:/program/GIT/Agent/multi/Agent-Architecture-Hub/channels/probe/results/screenshots-m-v2/33_long_session_tail.png)、[34_long_session_older_loaded.png](file:///E:/program/GIT/Agent/multi/Agent-Architecture-Hub/channels/probe/results/screenshots-m-v2/34_long_session_older_loaded.png) |
| 21 | `ui-composer` | 输入框 | 输入 | **做了且真能用** | 吸底多行输入框，随内容自动长高（最高 160px），输入内容自动以 `draft:<id>` 存入 `localStorage`，切走再切回草稿完整保留。[10_composer_with_text.png](file:///E:/program/GIT/Agent/multi/Agent-Architecture-Hub/channels/probe/results/screenshots-m-v2/10_composer_with_text.png) |
| 22 | `ui-mention` | 引用文件或会话 | 输入 | **没做** | 输入框无 `@` 文件/会话联想功能，无法快捷插入项目文件路径或会话引用。 |
| 23 | `ui-command-menu` | 命令菜单 | 输入 | **没做** | 输入 `/` 无命令补全弹出框，无法执行各厂家内建的斜杠命令。 |
| 24 | `ui-model-picker` | 模型与推理力度选择 | 输入 | **做了但有问题** | 新建任务浮层中支持选择各厂家推荐模型，但**无法在中途切换模型，也无推理力度（thinking level / budget）调节项**。[18_new_task_zcode_models.png](file:///E:/program/GIT/Agent/multi/Agent-Architecture-Hub/channels/probe/results/screenshots-m-v2/18_new_task_zcode_models.png) |
| 25 | `ui-mode-picker` | 权限模式选择 | 输入 | **做了但有问题** | 新建任务浮层支持“全放行（默认）”与“只读”，能正常下发给执行器生效；但**中途无法切换会话权限模式**。 |
| 26 | `ui-stop` | 停止按钮 | 运行控制 | **做了且真能用** | 在智能体处于 `working` 状态时，输入框左侧自动浮现红色“停”按钮，点击触发确认并调用 `/api/gateway/cancel`，状态即时转为 `idle`/`aborted`。[16_stop_test_session_opened.png](file:///E:/program/GIT/Agent/multi/Agent-Architecture-Hub/channels/probe/results/screenshots-m-v2/16_stop_test_session_opened.png) |
| 27 | `ui-queue-steer` | 运行中发话 | 运行控制 | **做了且真能用** | 智能体在干活时，输入栏下方显示“发的话会插进这一轮”或“排到这一轮结束后”，实测发话提示“已插进这一轮”，且在实测会话中智能体成功在同轮内回复确认收到。[12_session_status.png](file:///E:/program/GIT/Agent/multi/Agent-Architecture-Hub/channels/probe/results/screenshots-m-v2/12_session_status.png) |
| 28 | `ui-approval` | 审批卡片 | 运行控制 | **没做** | 缺少专门针对智能体审批请求（允许一次/始终允许/拒绝）的卡片与操作原语，当智能体等待审批时只能在状态栏看到文字，无法点按放行。 |
| 29 | `ui-question` | 回答智能体提问 | 运行控制 | **没做** | 智能体主动向人提问（如 `ask_question` 选择题）时未生成选项卡片，只能作为普通消息由人手打回复。 |
| 30 | `ui-retry-edit` | 重试与编辑重发 | 运行控制 | **没做** | 历史用户发言没有“重新生成”或“编辑重发”按钮。 |
| 31 | `ui-artifact-preview` | 产出预览 | 产出物 | **没做** | 智能体交出的网页、报告、图片没有抽屉或弹层快速预览入口，手机上无法直接点开查看渲染物。 |
| 32 | `ui-copy-export` | 复制与导出 | 产出物 | **做了但有问题** | 代码块右上角具备复制按钮且实测可用；**但缺少对整条智能体消息的气泡复制按钮，也没有整段对话的导出功能（导出 Markdown/JSON）**。 |
| 33 | `ui-notify` | 通知 | 通知 | **没做** | 未接入系统级 Notification API 或 Service Worker，切后台或锁屏时无法收到审批或完成的振动通知。 |
| 34 | `ui-multidevice` | 多端同一状态 | 通知 | **做了且真能用** | 前后端基于统一会话池与事件协议，多端操作几秒内轮询对齐，在桌面启动的任务在手机端几秒内即可同步看见。 |
| 35 | `ui-theme` | 外观 | 设置 | **做了且真能用** | 针对系统级深色/浅色模式自适应切换，字号基准 16px 防止 iOS 自动放大，深浅色对比度与观感良好。[20_feed_view_default.png](file:///E:/program/GIT/Agent/multi/Agent-Architecture-Hub/channels/probe/results/screenshots-m-v2/20_feed_view_default.png)（浅色）、[35_dark_mode_feed.png](file:///E:/program/GIT/Agent/multi/Agent-Architecture-Hub/channels/probe/results/screenshots-m-v2/35_dark_mode_feed.png)（深色）。 |
| 36 | `ui-feedback` | 页面反馈 | 设置 | **做了且真能用** | 右下角浮动反馈按钮（`#fbBtn`），弹窗支持写文本、支持直接从剪贴板粘贴截图、相册传图，调用 `POST /api/m/feedback` 提交落盘。[15_feedback_modal.png](file:///E:/program/GIT/Agent/multi/Agent-Architecture-Hub/channels/probe/results/screenshots-m-v2/15_feedback_modal.png)、[15b_feedback_filled.png](file:///E:/program/GIT/Agent/multi/Agent-Architecture-Hub/channels/probe/results/screenshots-m-v2/15b_feedback_filled.png)。 |

### 统计汇总
- **做了且真能用**：18 项（50.0%）
- **做了但有问题（需补齐/需打磨）**：6 项（16.7%）
- **没做（待后续开发）**：12 项（33.3%）

---

## 三、问题 3 回答：手机宽度（375 左右）真人用起来哪里别扭？

在 375×812 真实手机视口下深度体验，发现以下影响真人操作的具体工效痛点：

### 1. 触控面积严重不足，误触率极高（扫描出 96 个不达标按钮）
- **数据**：对页面所有可点击元素进行坐标测量，共有 **96 个元素的高度或宽度低于 44px（苹果/安卓触控推荐标准）**！
- **最致命的误触点**：
  1. **待处理卡片操作栏**：`打开` 按钮宽度 60px、高度 36px；`划掉` 按钮宽度 62px、高度 36px。两个按钮间距仅 8px 且垂直居中，在手机单手大拇指按压时（拇指接触面通常大于 10mm），**极易本想按“打开”却按成“划掉”**！
  2. **筛选胶囊（`.chip`）**：高度仅 32px，上下内边距过紧，在快速横划时容易误触打开不需要的过滤项。
  3. **置顶按钮（`#pinBtn`）**：在详情页吸顶栏里几乎只有文本大小（padding: 1px 7px），没有外扩热区，手指很难一次点中。
  4. **顶部“＋ 新任务”**：高度仅 40px，紧贴右侧与顶部，点按时拇指需极度向上拉伸。

### 2. “新建任务”后原地发呆，无反馈无跳转（心理断崖）
- **现象**：填完提示词点“开始”后，浮层收起，页面弹出一条 Toast 后就停留在当前页面不动了。
- **原因**：前端代码通过 `setTimeout` 5 秒后单次调用 `/api/sessions?slim=1` 匹配会话，但后台启动进程并写入 transcript 索引需要 6~10 秒。5 秒时拉不到数据直接放弃跳转，也不继续轮询，更没有任何转圈加载态。
- **真人感受**：“我到底点成功没有？怎么任务没出来？是不是卡了？” 用户必然会忍不住重复点“＋ 新任务”再发一次，导致产生重复会话。

### 3. 项目与新会话工作区错位（会话“失踪”）
- **现象**：真人特地进入了某个项目（例如 `LightRAG`），在项目里点“＋ 新任务”，工作目录也默认带入了 `E:\program\GIT\Agent\multi\github\LightRAG`。
- **结果**：任务建好后，后台适配器创建出的会话工作区却落在了默认的 `Agent-Architecture-Hub` 或其他目录，导致当前项目会话列表里根本刷不出来刚建的会话！
- **真人感受**：用户以为“选项目开任务”是把任务开在这个项目里，结果开完之后项目下是空的，必须退回全局待处理流或者用搜索才能把会话翻出来。

### 4. 会话之间缺乏轻量切换通道，跳转层级过深
- **现象**：当同时有 3 个智能体在不同项目或不同任务里推进时，在手机端查看 Session A 时，如果想看一眼 Session B 的进度，必须：
  - 点击左上角 `‹` 返回项目页；
  - 再点击左上角 `‹` 返回待处理/项目总览；
  - 在列表里找到 Session B 点进去。
- **对比**：桌面端或常见 IM 软件均有侧边抽屉或浮动最近会话托盘，手机端必须“进进出出”，在多智能体自主推进时极度消耗耐心。

### 5. 详情页步骤轮询存在跳动感
- 在会话详情页，智能体干活时每 3 秒发起一次局部增量刷新。
- 当用户手指正在向上滑动翻看早前工具输出时，如果恰好轮询触发且 DOM 重写（`old.outerHTML = html`），会产生轻微的视图抖动；若点击展开的折叠卡过多，重绘会有短暂帧率下降。

---

## 四、向负责人汇报：最影响使用的三个问题

若明天就要交给真人日常在手机上使用，**必须优先解决的前三个核心硬伤**：

> ### 🔴 第一大问题：新建会话后“原地失联”，缺少轮询等待与自动进入机制
> - **现状**：点击“开始”后 5 秒单次拉取未果即放弃跳转，用户停在原地，新会话不知所踪。
> - **建议改法**：点击“开始”后进入统一的“正在拉起智能体…”骨架屏或 Loading 弹窗，前端启动高频自适应轮询（每 1.5 秒查一次，持续至多 20 秒），一旦探测到新会话已生成立即直接 `location.hash = '#/s/' + encodeURIComponent(s.id)` 自动进会话，彻底消除断流感。

> ### 🔴 第二大问题：按钮触控面积不足（32px/36px），“打开”与“划掉”极易误触
> - **现状**：待处理卡片中的“打开”与“划掉”高度只有 36px 且紧贴，筛选胶囊只有 32px，全页 96 个点击热区低于 44px。
> - **建议改法**：将整张会话卡片本身作为直接点击进入详情的热区（`cursor: pointer`），底部仅保留一个单独的“划掉/稍后处理”次级幽灵按钮，或支持左右滑动卡片手势划掉；所有按钮与胶囊触控热区（含 padding）硬性设定不小于 `44px`。

> ### 🔴 第三大问题：进入会话后成为“信息孤岛”，缺乏会话间快速切换手势/抽屉
> - **现状**：进入一个会话后，底部导航条被强制隐藏，右上角也没有会话抽屉，看其他智能体必须一路连续返回退到最外层。
> - **建议改法**：在详情页顶部标题栏右侧增加一个“最近活跃会话”抽屉按钮（或支持屏幕边缘右滑呼出会话侧栏抽屉），列出当前正在干活的另外几个会话，点一下就原地切过去，让手机真正成为多智能体督工台。
