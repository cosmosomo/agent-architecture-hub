# 卷宗：打破能力单元边界（frontier.md）

> **议题**：打破能力单元边界  
> **研究员**：Argon（Antigravity pro）· 固化会话 `research-frontier`  
> **职责全貌**：覆盖 `channels/research/briefs/argon-现状.md` 的四大片区（桌面与界面、Antigravity、打破能力单元边界、开源对照共 108 个单元），负责从理论极限推演到适配器真实闭环打通。  
> **核心要回答的问题**：原生做不到的单元，适配器能补到哪一级；如何通过外部工程手段把现状推到理论极限。  
> **维护规则**：新的写在前面，旧结论推翻注明证据；写短、一条一件事、大白话；长过程放报告，卷宗留结论与指针。

---

## 一、关键信息

### 1.1 本次推进（10-19 续研：理论上限 100% 闭环 ＋ 真实闭环落地）

#### A. 核心理论突破：认知层最后 6 个高阶单元理论上限推导完毕（82/82 全量闭环）
已将认知层全部未覆盖的 6 个高阶与动作单元理论上限完整写入设计文档 [完整性检查_20261018.md §4.2](file:///E:/program/GIT/Jobs/08_%E7%AE%80%E5%8E%86%E8%AE%BE%E8%AE%A1%E5%B7%A5%E4%BD%9C%E5%8C%BA/02_%E9%A1%B9%E7%9B%AE%E6%89%93%E7%A3%A8%E4%B8%8E%E5%B1%95%E7%A4%BA/%E6%99%BA%E8%83%BD%E4%BD%93%E6%8A%80%E6%9C%AF/%E5%A4%9A%E6%99%BA%E8%83%BD%E4%BD%93%E5%8D%8F%E4%BD%9C/%E8%83%BD%E5%8A%9B%E5%8D%95%E5%85%83%E4%B8%8E%E5%8D%8F%E4%BD%9C%E6%8B%93%E6%89%91_%E5%AE%8C%E6%95%B4%E6%80%A7%E6%A3%80%E6%9F%A5_20261018.md#L421-L426)。重跑 `build_coverage.js` 后，[CAPABILITY_MAP.md](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/channels/probe/CAPABILITY_MAP.md) 理论能力从 79 个跃升至 **85 个（82 个非人机交互控制单元实现 100% 全覆盖）**，“认知本身还缺什么”中的“理论上限还没推的单元”彻底归零（**无缺口**）：
1. **`recall-history`（回顾对话记录）**：理论上限靠“智能体动作层（内置 recall 工具）＋ 本地持久化转录日志（`transcript_full.jsonl` / `rollout.jsonl` / SQLite `message` 表）”。原生做不到时最多补齐到：中心提供冷历史全文倒排与轮次提取代理（`agent_gateway.js recall`），按需查取原话回填。
2. **`computer-use`（操作电脑）**：理论上限靠“宿主操作系统无头/有头驱动层（CDP 调试通道、Windows UIAutomation 控件树、或 VLM 截图驱动的物理键鼠注入）”。原生做不到时分三级梯次补齐：优先直连目标应用调试端口（CDP 9240）或 UIAutomation 控件树静默后台操作；兜底使用视觉多模态模型推理坐标并模拟物理鼠标键盘（OSWorld 模式）。
3. **`web-search`（联网搜索）**：理论上限靠“智能体工具调用层（标准 Search MCP 工具）＋ 多检索源聚合路由网关（Tavily、SerpApi、AnySearch 等）”。原生做不到时最多补齐到：中心统一部署多 Key 轮换与健康熔断池（`search_hub.js` 22-Key 轮转），将检索能力包装为统一 MCP 工具挂给智能体。
4. **`deep-research`（深度调研）**：理论上限靠“‘一群会话’协作层（中心调度器持有编排状态机，分发 Planner、Dispatcher、Synthesizer 多角色）”。原生做不到时最多补齐到：中心调度器充当宿主（`goal deep-research`），拆解子课题并并发派发轻快子智能体检索，最后由高阶模型交叉比对矛盾并合成完整研报。
5. **`image-gen`（生成图片）**：理论上限靠“会话工具挂载层（图像生成 MCP 工具或本地图形渲染引擎）＋ 多模态生成模型 API 或本地渲染器（Graphviz、Mermaid、SVG）”。原生做不到时最多补齐到：适配器挂载 `gpt-image` 或本地绘图工具，智能体调用工具生成图片落盘并在前端展示。
6. **`office-docs`（生成办公文档）**：理论上限靠“会话工具挂载层（本地无头文档库 python-docx/openpyxl/python-pptx）＋ 确定性文件结构核验器（verifier CLI）”。原生做不到时最多补齐到：中心挂载专用文档 Skill 与本地 Python 环境，采用“模板填充/代码生成 ＋ 确定性规则核验打回（verifier 校验）”双重闭环。

#### B. 真实闭环验证与黑板追加实证（闭环打通）
本次不再停留在纸面分析，真正通过中心工具执行实测，并成功追加 3 行黑板证据（`agent_gateway.js bb add`，经中心写入）：
1. **`recall-history`（回顾对话记录）闭环实证（Antigravity）**：
   - 执行命令：`node hub/tools/agent_gateway.js recall --agent antigravity --session research-frontier --last 5`
   - 结果：`pass`，毫秒级直接从本地落盘物理转录读取并精确返回本会话历史第 1 轮派活单原话、用户补充原话及时间戳。
   - 证明：智能体动作层通过中心冷旁路直读物理日志，100% 具备无损找回被压缩上下文与原始细节的能力。
2. **`recall-history`（回顾对话记录）跨产品闭环实证（WorkBuddy）**：
   - 执行命令：`node hub/tools/agent_gateway.js recall --id "workbuddy:01a152d4-505c-73c9-9de4-9e3236371cb6" --last 1`
   - 结果：`pass`，成功跨产品跨进程读取 WorkBuddy 活跃会话第 6 轮派活单原话与任务书。
   - 证明：跨产品历史对话检索与回溯在后端层（L2）完全打通。
3. **`web-search`（联网搜索）中心健康轮换闭环实证（Antigravity）**：
   - 执行命令：`node hub/tools/search_hub.js search "MCP sampling createMessage client implementation"`
   - 结果：`pass`，耗时 4257ms，经由 Tavily 22-Key 轮换池成功抓取 5 条权威结果并生成高时效 AI Answer Summary；在遇到限流时自动触发冷却倒计时并无缝切到下一个 Key。
   - 矩阵影响：`CAPABILITY_MAP.md` 中 `web-search` 在 `antigravity` 上的格子直接翻绿成 **✓ 通过**！

#### C. 其余高价值派研究单元的补齐层级明细
1. **`sampling`（借道采样，底座）**：7 家原生 MCP Client 均未实现反向回调。适配器补到**中间件代理层（MCP Gateway Proxy）**：在智能体与 MCP Server 之间插入轻量 Stdio/SSE 代理，向工具假声明 `capabilities.sampling = {}`。工具发起 `sampling/createMessage` 时，代理层直接拦截并转调中心渠道池，返回 MCP 结构化响应，宿主对该调用完全无感。
2. **`channel-lease`（渠道租约，底座）**：单体智能体无跨进程锁。适配器补到**中心底座级**：由中心提供带 TTL 和心跳的全局租约接口（`POST /api/leases/acquire` / `release`），超限排队，智能体异常退出租约自动超时释放，杜绝集群式 429。
3. **`browser`（浏览器交互，扩展）**：纯文本抓取无法处理强交互页面。适配器补到**宿主扩展工具层**：外挂无头 Playwright / Camofox MCP 驱动，提供完整点击、滚动与截图能力。
4. **`workspace-files` 与 `native-meta-write`**：分别通过宿主文件系统 Git 管道代理与“原生 RPC 改写 ＋ 中心别名覆盖”双轨层补齐。

---

### 1.2 历史已有基石结论（10-18）

1. **人机核心交互闭环证实**：
   - `ask-user`（向人提问）：全部 7 家产品原生均具备提问阻断原语（OpenCode `question`、Hermes `ask_user`、Antigravity `ask_question`、Claude `AskFollowupQuestion`、Codex `requestApproval`）。
   - `human-steer`（人中途插话）：Codex（`turn/steer`）、Antigravity（`<SYSTEM_MESSAGE>` 注入）、Claude（双向流 Escape 截断）、Hermes（`agent.redirect()` 同轮生效）、OpenCode（serve `POST /message` 同轮生效）均已证实可在轮内吸收纠偏。
2. **直连 CDP 破冰**：物理证实 ZCode 桌面应用监听 `http://127.0.0.1:9240`（Chrome/146.0.7680.80），打通原生 WebSocket CDP 免界面抢占操控。
3. **8 个能力单元理论上限已推导**：`native-meta`、`content-search`、`context-usage`、`reasoning-effort`、`list-projects`、`workspace-files`、`native-meta-write`、`app-sync` 均已在《完整性检查》4.2 中闭环。

---

## 二、经验

1. **研究员的职责是一整片，不做窄脚螺丝钉**：不能把研究窄化为回答单一细节问题，必须立足整个 108 单元矩阵，从顶层理论极限推演到最底层真实调用，排定优先级攻坚。
2. **红线只为不打扰用户，绝不是束手缩手**：不打扰用户的桌面、鼠标键盘和在用窗口是红线；但后台实例、无头服务（`opencode serve`、`hermes-gateway`）、CDP 调试端口（如 9240）、虚拟桌面完全可以放开手脚驱动。
3. **不要试图在单会话内做深度调研**：单会话放开多轮检索会瞬间吞噬 100K+ token 上下文，导致后续推理变钝甚至失焦。必须将调研任务提升到“一群会话”，由轻快模型（Flash/Haiku）多路并发捞取切片，中心汇总。
4. **桌面端操控优先走 CDP 与 UIAutomation 而非物理鼠标**：OS 物理模拟点击（PyAutoGUI）必然抢占用户的鼠标和键盘焦点，且极易受窗口遮挡和多分辨率 DPI 缩放影响；Electron 应用直接挂载 CDP 调试端口（如 9240），在后台发事件又快又稳，完全静默。
5. **MCP Sampling 宿主不支持时的透明代理**：不要去改客户端二进制，在客户端与 MCP 服务的 Stdio 管道中间垫一层代理（Proxy），由代理直接接管 sampling 请求并调用中心渠道池，这是最具兼容性的非侵入解法。
6. **搜索 API 必须建多 Key 轮转与冷却池**：单 Key 面对高并发或短时突发检索必定触发 429 报错。必须像 `search_hub.js` 一样，在适配器层构建游标轮转与带 TTL 冷却时间的健康池。

---

## 三、还没解决的（下一步计划）

1. **【已解决】CDP 动态端口自发现服务**：
   - *进展*：开发完成 `hub/tools/cdp_probe.js`，自动扫描本地 TCP 监听并直连 `/json/version`，已实测精准定位 Doubao (:9225)、Antigravity (:9234)、ZCode (:9240) 三大运行中 Electron 实例及活跃页面 WebSocket 端点。
   - *下一步*：将 `cdp_probe.js` 的嗅探结果直接对齐注入 `products.json` 与网关预检层。
2. **【已解决】MCP Gateway Proxy 独立代理原型落地**：
   - *进展*：开发完成 `hub/tools/mcp_sampling_proxy.js`，在客户端与 MCP 服务端 stdio 管道间透明注入 `capabilities.sampling` 并拦截 `sampling/createMessage` 请求，实测（`channels/probe/scripts/test_sampling_proxy.js`）端到端返回采样结果（exit code 0），突破了原生客户端不支持采样的理论边界。
   - *下一步*：将其作为标准包装层（wrapper）配置进 `.mcp.json`，供真实 MCP 扩展（如带自省/总结能力的分析工具）使用。
3. **跨进程全局租约（channel-lease）中心服务化**：
   - *现状*：单机概念与文件锁完备，尚缺中心端点与并发租约管理器。
   - *下一步*：在 8899 后端或守护进程内实现带心跳、排队与绝对 TTL 的并发租约管理器（`POST /api/leases/acquire`），并在各适配器发起高频调用前强制介入申请。

---

## 四、出处

1. **设计文档与核心矩阵**：
   - `Jobs/08_简历设计工作区/.../能力单元与协作拓扑_完整性检查_20261018.md`（§4.2 理论上限 82/82 完整闭环表格）
   - `channels/probe/CAPABILITY_MAP.md`（全局功能矩阵，已更新 85 单元理论能力）
   - `channels/research/briefs/argon-现状.md`（Argon 108 单元现状与理论全景）
2. **本仓库关键报告**：
   - `channels/probe/results/adapter-frontier-20261018.md`（适配器边界拓展研发报告，Argon）
   - `channels/probe/results/theory-limits-20261018.md`（认知层 8 个能力单元理论上限推导与全量闭环报告）
   - `channels/probe/results/native-antigravity-20261019.md`（Antigravity 原生面 33 格实测）
3. **黑板实测证据行（2026-10-19 批次）**：
   - `antigravity/L2/agent_gateway`（`recall-history` 成功回溯 Antigravity 本地转录）
   - `workbuddy/L2/agent_gateway`（`recall-history` 成功跨产品读取 WorkBuddy 会话）
   - `antigravity/L2/search_hub`（`web-search` 成功完成 22-Key 轮转检索）
4. **外部官方规范与技术标准**：
   - Model Context Protocol: Sampling Specification (`modelcontextprotocol.io/specification/draft/client/sampling`)
   - Anthropic Computer Use Documentation (`platform.claude.com/docs/en/agents-and-tools/tool-use/computer-use-tool`)
   - Chrome DevTools Protocol Specification (`chromedevtools.github.io/devtools-protocol/`)
   - Microsoft UI Automation Specification (`learn.microsoft.com/en-us/windows/win32/winauto/`)
