# 卷宗：打破能力单元边界（frontier.md）

> **议题**：打破能力单元边界  
> **研究员**：Argon（Antigravity pro）· 固化会话 `research-frontier`  
> **职责全貌**：覆盖 `channels/research/briefs/argon-现状.md` 的四大片区（桌面与界面、Antigravity、打破能力单元边界、开源对照共 108 个单元），负责从理论极限推演到适配器真实闭环打通。  
> **核心要回答的问题**：原生做不到的单元，适配器能补到哪一级；如何通过外部工程手段把现状推到理论极限。  
> **维护规则**：新的写在前面，旧结论推翻注明证据；写短、一条一件事、大白话；长过程放报告，卷宗留结论与指针。  
> **最近更新**：2026-10-20 08:45

---

## 一、关键信息

### 1.1 本次推进（10-20 续研：黑板实测增量 3 行 2272-2274 落地 ＋ 边界降至 57 单元 191 格 ＋ 派研究 Top 10 单元适配器补齐层级推演 ＋ 核心断点定位）

#### A. 本轮黑板增量实测落地（3 行 pass：黑板 2272-2274，经 `bb find` 核实）
遵循铁律，通过中心网关工具以真实调用与状态核验追加至 `channels/probe/blackboard.jsonl`：
1. **黑板 2272 行（`antigravity` · `peer-message` · pass · `antigravity/L2/gateway`）**：
   - 实测调用：从 `antigravity/research-frontier` 向 `antigravity/test-peer-agy` 派发 `peer-message` 异步单据 `dsp_003506_0gv7`（携带专用暗号 `PEER_MSG_TOKEN_1020A8`）。
   - 行为证据：网关自动将消息投递至目标会话（`1aaeae7d-d1f9-4f5a-b857-9798e66a13de`），触发目标端自动唤醒执行；单据完整经历四段回执（`issued` 00:35:06 → `delivered` 00:35:08 → `seen` 00:35:18 → `returned` 00:35:28），目标会话回传确认文本，状态流转为 `completed`。
2. **黑板 2273 行（`antigravity` · `wake-persist` · pass · `antigravity/L2/gateway`）**：
   - 机制验证：全部 Antigravity 派活单（如 `dsp_002702_xcjp`、`dsp_003506_0gv7`）原子落盘于 `~/.agent-hub/dispatches/`。
   - 行为证据：中心网关 8899 服务重启后，由 `collab.ts:loadDispatches` 从磁盘完整恢复等待边与活动运行状态；实测 `GET /api/gateway/dispatches` 成功读出 355+ 条持久化单据与 active waitingEdges，证实跨进程重启不丢失唤醒状态。
3. **黑板 2274 行（`antigravity` · `wake-stall` · pass · `antigravity/L2/gateway`）**：
   - 机制验证：中心巡检逻辑 [collab.ts:144-150](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/trace/apps/cli/src/gateway/collab.ts#L144-L150) 的 `reconcileDispatches` 持续巡检派发至 Antigravity 的在途单据。
   - 行为证据：当派活目标超过 10 分钟无活跃进程运行且未交回结果时，系统自动将单据置为停滞（`d.status = 'stalled'`, `receipt = 'returned'`），唤醒调用方并避免会话永久挂起。

#### B. 边界清单推进核验
重跑 `node channels/probe/scripts/build_coverage.js` 与 `node channels/probe/scripts/build_briefs.mjs`：
- `argon` 边界清单未达理论上限的单元从 60 单元 194 格减少为 **57 单元 191 格**（`peer-message`、`wake-persist`、`wake-stall` 顺利从待推清单中脱离进入已通行列）。

#### C. 适配器硬断点定位（代码行级根因）
实测对 Antigravity 调用会话控制接口（`session-control`）时报错，精确定位适配器断点：
1. **`compact`（压缩上下文）断点**：[session_control.ts:89](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/trace/apps/cli/src/gateway/session_control.ts#L89) 硬编码报错 `${prof.label} 还不能压缩上下文`。Antigravity 无暴露的原生单会话就地压缩 RPC，需适配器补齐“读出转录 -> 提取摘要 -> 新建会话继承”链路。
2. **`mode-switch`（切模式）断点**：[session_control.ts:72](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/trace/apps/cli/src/gateway/session_control.ts#L72) 硬编码报错 `${prof.label} 还不能中途切模式`。Antigravity 会话模式在启动时定死，适配器未实现中途热切换或会话热重载。

#### D. 能力地图“派研究”高价值 Top 10 单元突破推演（原生做不到时，适配器最多补到哪一级）
依据 `channels/probe/CAPABILITY_MAP.md:77-89` 列出的前十项涉及 6~7 家的“派研究”高阶/底座单元，逐项推导适配器极限层级与工程解法：

1. **`human-steer`（人中途插话，一轮之内 · 7 家）**：
   - *原生现状与瓶颈*：CLI 模式单向等待退出，缺乏 mid-turn 标准事件管道。
   - *适配器最多补到哪一级*：**一轮之内（步骤间拦截）**。
   - *实现方案*：在两次工具调用返回间隙注入消息。Antigravity 走 `<SYSTEM_MESSAGE>` 注入；Hermes 走 ACP `agent.redirect()`；Codex 走 `turn/steer`；CLI 模式走“下次工具返回捎带用户插话”（Steer-in-Tool）。
   - *代价与限制*：模型在长 CoT 推理期间无法硬打断，需等待当前步骤执行完。
2. **`sampling`（借道采样，底座 · 7 家）**：
   - *原生现状与瓶颈*：7 家原生 MCP Client 均未实现反向 `sampling/createMessage` 回调。
   - *适配器最多补到哪一级*：**中间件代理层（MCP Gateway Proxy 拦截）**。
   - *实现方案*：已在 `hub/tools/mcp_sampling_proxy.js` 实现 stdio 代理，在宿主与 MCP 服务间透传时注入 sampling capability，遇到采样请求直接由代理拦截并打入中心模型池，端到端证实可用（`test_sampling_proxy.js`）。
   - *代价与限制*：走中间件代理消耗中心渠道配额，无法利用宿主免费点数。
3. **`computer-use`（操作电脑，高阶能力 · 7 家）**：
   - *原生现状与瓶颈*：代码智能体无系统级键鼠注入与屏幕视觉定位能力。
   - *适配器最多补到哪一级*：**宿主环境驱动层（双轨：CDP 静默注入 ＋ UIA 语义树 ＋ 虚拟屏 OSWorld）**。
   - *实现方案*：Electron 应用走本地开放的 CDP 端口（:9234, :9240, :9225）执行 `Page.captureScreenshot` 与 `Runtime.evaluate` 静默读写（黑板 1980, 1981）；Win32/WPF 应用走 Windows UIA 控件树；自绘窗口走无头虚拟屏幕 ＋ VLM 坐标推断模拟。
   - *代价与限制*：纯自绘界面依赖 VLM 推理坐标，有误触风险；严禁在前台抢占用户真机鼠标键盘。
4. **`deep-research`（深度调研，高阶能力 · 7 家）**：
   - *原生现状与瓶颈*：单会话窗口有限，多轮长文抓取会导致 100K+ token 上下文早衰。
   - *适配器最多补到哪一级*：**一群会话协作层（中心调度状态机）**。
   - *实现方案*：中心调度器（`goal deep-research`）充当宿主，由高阶模型作为 Planner 拆解正交子课题，并发派发轻快子智能体捞取素材，最后由 Synthesizer 模型交叉核验矛盾点并生成结构化引用研报。
   - *代价与限制*：耗时较长（分钟级），消耗并发轮次与搜索 API 配额。
5. **`image-gen`（生成图片，高阶能力 · 7 家）**：
   - *原生现状与瓶颈*：代码语言模型自身无图像扩散权重。
   - *适配器最多补到哪一级*：**会话工具挂载层（MCP 扩展 / 脚本渲染器）**。
   - *实现方案*：挂载 `gpt-image` MCP 工具（调用 `gpt-image-2.5-flare` 等多模态网关）或本地 Python 渲染脚本（Mermaid、Graphviz、Matplotlib、Playwright 无头 HTML 截图），生成高质量图片落盘并返回路径与预览。
   - *代价与限制*：依赖外部多模态生图 API 或本地图形依赖环境。
6. **`office-docs`（生成办公文档，高阶能力 · 7 家）**：
   - *原生现状与瓶颈*：模型直接生成二进制容易文件损坏，纯提示词无法精确控制排版碰撞。
   - *适配器最多补到哪一级*：**会话工具挂载 ＋ 确定性核验闭环层**。
   - *实现方案*：挂载专用文档 Skill 与本地 Python 环境，采用“模板填充/代码生成 ＋ 确定性规则核验打回（`verifier-hub` 校验）”双重闭环。
   - *代价与限制*：依赖本地 Python 运行时与第三方文档库；核验打回需额外一轮纠偏。
7. **`inject-silent`（注入·只入上下文，一轮之内 · 6 家）**：
   - *原生现状与瓶颈*：缺少免推理的追加消息 RPC，外部输入必触发新一轮推理。
   - *适配器最多补到哪一级*：**一轮之内（Pre-Invocation 钩子注入）或下一轮首步伪装**。
   - *实现方案*：Antigravity 走 `PreInvocation` hook 的 `injectSteps.ephemeralMessage`；Claude 走静默写 `memory/`；ACP 智能体直接向 SQLite `message` 表插入上下文；兜底在下一轮输入首行追加 `[CONTEXT_UPDATE: 仅供参考无需单独回答]`。
   - *代价与限制*：通用提示词降级方案仍会消耗模型前缀 Token。
8. **`browser`（浏览器交互，高阶能力 · 6 家）**：
   - *原生现状与瓶颈*：原生沙箱环境不提供有头/无头浏览器进程。
   - *适配器最多补到哪一级*：**宿主扩展工具层（无头浏览器 MCP 服务）**。
   - *实现方案*：适配器为智能体统一挂载 Playwright / Puppeteer MCP Server，提供 `browser_navigate`、`browser_click`、`browser_screenshot`、`browser_extract_content` 标准工具集，实现完整的 DOM 渲染与 JS 动态抓取。
   - *代价与限制*：启动 Chromium 进程带来约 150MB~300MB 内存开销；动态反爬页面需要 Cookie/Proxy 配合。
9. **`memory-mode`（记忆开关，一个会话 · 6 家）**：
   - *原生现状与瓶颈*：平台未暴露显式长期记忆开关，或将记忆与用户全局设置耦合。
   - *适配器最多补到哪一级*：**一个会话（工作区/配置目录动态隔离）**。
   - *实现方案*：启动智能体时通过独立环境变量或命令行参数指定隔离的记忆存储目录（Claude 传独立 `--settings`，Antigravity 传独立 `ANTIGRAVITY_PROJECT_ID` 与工作区）；会话销毁时清理记忆缓存；对于基于 SQLite 维护记忆的产品（OpenCode），建会话时通过 `sqlite3` 将 `is_memory_enabled` 置 0。
   - *代价与限制*：目录隔离会同时阻断全局 Skill 与规则的默认继承，需适配器额外补充显式挂载。
10. **`channel-lease`（渠道租约，底座 · 6 家）**：
    - *原生现状与瓶颈*：单体智能体进程独立运行，彼此无跨进程锁机制，高并发下极易并发调用同一 API 导致 429 限流。
    - *适配器最多补到哪一级*：**中心底座层（全局分布式租约与流量闸门）**。
    - *实现方案*：由中心统一提供带 TTL、心跳和等待队列的全局租约接口（`agent_gateway.js pick` 与 `POST /api/leases/acquire`）。智能体在调用特定渠道前先获取租约，超限自动在适配器层排队；调用方异常崩溃时租约超时自动释放，杜绝死锁与集群限流。
    - *代价与限制*：绕过中心直接发起的外部调用无法被纳管。

---

### 1.2 历史已有基石结论（10-18/10-19）
- **直连 CDP 破冰**：物理证实 ZCode 桌面应用监听 `http://127.0.0.1:9240`，Antigravity 监听 `http://127.0.0.1:9234`，豆包监听 `http://127.0.0.1:9225`，打通原生 WebSocket CDP 免界面抢占操控与无头截屏（黑板 1977-1981）。
- **会话双阶段彻底关闭（close）**：Connect-RPC `ForceStopCascadeTree` + `DeleteCascadeTrajectory` 双阶段彻底释放物理资源（黑板 1982）。
- **收件箱文件注入通道（inject-inbox）**：外部向约定的收件箱写入任务载荷，智能体启动巡检并在 3 秒内回显消费（黑板 1983）。
- **定时调度与回退（ui-automation-scheduler, rewind）**：CDP 原生发现 Automations 面板，原生 schedule 工具注册 cron；`RevertToCascadeStep` 实现步骤级回退与快照恢复（黑板 1984, 1985）。

---

## 二、经验

1. **真实黑板实测行是击穿边界的唯一铁证**：
   - 理论分析再完备，也必须在中心有端到端运行记录核验；本轮落地 `peer-message`（行 2272）、`wake-persist`（行 2273）、`wake-stall`（行 2274），通过 `build_briefs.mjs` 自动将 argon 边界缩减 3 格（194 -> 191），验证了“实测打通一行，边界消减一格”的正向飞轮。
2. **适配器补齐层级必须做根本限制评估**：
   - 适配器不是万能补丁，必须认清不同层级的代价：
     - *一轮之内*：依赖底层提供 mid-turn 钩子；纯 CLI 只能靠“下次工具调用返回捎带”。
     - *一个会话*：原生不支持时只能通过“新建会话 ＋ 摘要传递”降级，代价是失去原生物理记忆。
     - *一群会话*：单会话做深做宽必定早衰，必须通过中心调度状态机进行“分工拆解 ＋ 多角色并发”。
     - *底座层*：跨进程并发锁与 API 租约必须由中心统一持有，单体客户端无法自发协调。
3. **定位断点是推动中心迭代的抓手**：
   - 发现 `session_control.ts:72, 89` 对 Antigravity 的 `compact` 与 `mode-switch` 抛出硬编码不支持后，直接将根因定位于适配器代码而非平台本身缺陷，明确了后续针对 Antigravity 的适配器增强方案。
4. **三大 Electron 桌面端 CDP 直连已实测打通零抢占静默截屏与 DOM 注入**：
   - ZCode（:9240）、Antigravity（:9234）、豆包（:9225）均可在后台通过原生 WebSocket 直连 CDP 调试端口，无需聚焦前台窗口、不动鼠标键盘，即可调用 `Page.captureScreenshot` 毫秒级抓取无头截屏，并调用 `Runtime.evaluate` 执行任意 DOM 选择与事件注入，是实现免抢焦点后台电脑操作（`computer-use`）的最优工程解法。
5. **MCP Sampling 宿主不支持时的透明代理**：
   - 不要去改客户端二进制，在客户端与 MCP 服务的 Stdio 管道中间垫一层代理（`mcp_sampling_proxy.js`），由代理直接接管 sampling 请求并调用中心渠道池，这是最具兼容性的非侵入解法。

---

## 三、还没解决的（下一步计划）

1. **适配器层补齐 Antigravity `compact` 与 `mode-switch` 降级实现**：
   - *问题*：[session_control.ts:72,89](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/trace/apps/cli/src/gateway/session_control.ts#L72) 硬编码拦截报错。
   - *卡在哪*：Antigravity 适配器尚未实现“读取 SQLite/transcript 历史 -> 提取摘要 -> 新建会话继承”的自动紧凑化包装；以及通过重建会话实现模式参数重载。
   - *下一步打算怎么做*：向负责人提出适配器扩展建议，在 `session_control.ts` 内为 Antigravity 增加降级紧凑化路径。
2. **跨进程全局租约（channel-lease）中心服务化接入**：
   - *现状*：单机概念与文件锁完备，尚缺中心端点与并发租约管理器。
   - *下一步*：在 8899 后端或守护进程内实现带心跳、排队与绝对 TTL 的并发租约管理器（`POST /api/leases/acquire`），并在各适配器发起高频调用前强制介入申请。
3. **`computer-use` 双轨统一门面（desktop_inspector.js）沉淀**：
   - *现状*：CDP 路线已打通，Win32 UIA 路线脚本仍分散。
   - *下一步*：沉淀 `hub/tools/desktop_inspector.js` 统一门面，对 Electron 应用走 CDP，对原生应用走 Windows UIA，对外提供统一的静默读取与截屏接口。

---

## 四、出处

1. **黑板实测证据行（`channels/probe/blackboard.jsonl`，经 `bb find` 核实）**：
   - **黑板 2272 行**：`antigravity/peer-message` pass `antigravity/L2/gateway`（跨会话 peer-message 派发 `dsp_003506_0gv7`，四段回执齐并成功唤醒回复）
   - **黑板 2273 行**：`antigravity/wake-persist` pass `antigravity/L2/gateway`（派活单原子落盘，8899 服务重启后 `collab.ts:loadDispatches` 从磁盘完整恢复）
   - **黑板 2274 行**：`antigravity/wake-stall` pass `antigravity/L2/gateway`（巡检逻辑 `collab.ts:reconcileDispatches` 10 分钟超时判定与 stalled 唤醒）
   - **黑板 1977-1981 行**：`native-meta` 与 `computer-use` 经 CDP 9240/9234/9225 静默读 DOM 与截屏
   - **黑板 1982-1985 行**：`close`, `inject-inbox`, `ui-automation-scheduler`, `rewind` 真实闭环
2. **代码文件与行号证据**：
   - [session_control.ts:72](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/trace/apps/cli/src/gateway/session_control.ts#L72)：`mode-switch` 硬断点
   - [session_control.ts:89](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/trace/apps/cli/src/gateway/session_control.ts#L89)：`compact` 硬断点
   - [collab.ts:144-150](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/trace/apps/cli/src/gateway/collab.ts#L144-L150)：`reconcileDispatches` 超时 10 分钟判定停滞与唤醒
   - `hub/tools/mcp_sampling_proxy.js`：MCP Sampling stdio 代理拦截实现
3. **设计文档与核心矩阵**：
   - [CAPABILITY_MAP.md](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/channels/probe/CAPABILITY_MAP.md)：§现在还缺什么「派研究」（Top 10 单元）
   - [argon-边界.md](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/channels/research/briefs/argon-%E8%BE%B9%E7%95%8C.md)：argon 边界清单（降至 57 单元 191 格）


---

### 1.2 历史已有基石结论（10-18）

1. **人机核心交互闭环证实**：
   - `ask-user`（向人提问）：全部 7 家产品原生均具备提问阻断原语（OpenCode `question`、Hermes `ask_user`、Antigravity `ask_question`、Claude `AskFollowupQuestion`、Codex `requestApproval`）。
   - `human-steer`（人中途插话）：Codex（`turn/steer`）、Antigravity（`<SYSTEM_MESSAGE>` 注入）、Claude（双向流 Escape 截断）、Hermes（`agent.redirect()` 同轮生效）、OpenCode（serve `POST /message` 同轮生效）均已证实可在轮内吸收纠偏。
2. **直连 CDP 破冰**：物理证实 ZCode 桌面应用监听 `http://127.0.0.1:9240`（Chrome/146.0.7680.80），打通原生 WebSocket CDP 免界面抢占操控。
3. **8 个能力单元理论上限已推导**：`native-meta`、`content-search`、`context-usage`、`reasoning-effort`、`list-projects`、`workspace-files`、`native-meta-write`、`app-sync` 均已在《完整性检查》4.2 中闭环。

---

## 二、经验

1. **三大 Electron 桌面端 CDP 直连已实测打通零抢占静默截屏与 DOM 注入**：
   - 经验证，ZCode（:9240）、Antigravity（:9234）、豆包（:9225）均可在后台通过原生 WebSocket 直连 CDP 调试端口，无需聚焦前台窗口、不动鼠标键盘，即可调用 `Page.captureScreenshot` 毫秒级抓取无头截屏（318KB~1029KB），并调用 `Runtime.evaluate` 执行任意 DOM 选择与事件注入，是实现免抢焦点后台电脑操作（`computer-use`）的最优工程解法。
2. **研究员的职责是一整片，不做窄脚螺丝钉**：不能把研究窄化为回答单一细节问题，必须立足整个 108 单元矩阵，从顶层理论极限推演到最底层真实调用，排定优先级攻坚。
3. **红线只为不打扰用户，绝不是束手缩手**：不打扰用户的桌面、鼠标键盘和在用窗口是红线；但后台实例、无头服务（`opencode serve`、`hermes-gateway`）、CDP 调试端口（如 9240）、虚拟桌面完全可以放开手脚驱动。
4. **不要试图在单会话内做深度调研**：单会话放开多轮检索会瞬间吞噬 100K+ token 上下文，导致后续推理变钝甚至失焦。必须将调研任务提升到“一群会话”，由轻快模型（Flash/Haiku）多路并发捞取切片，中心汇总。
5. **桌面端操控优先走 CDP 与 UIAutomation 而非物理鼠标**：OS 物理模拟点击（PyAutoGUI）必然抢占用户的鼠标和键盘焦点，且极易受窗口遮挡和多分辨率 DPI 缩放影响；Electron 应用直接挂载 CDP 调试端口（如 9240），在后台发事件又快又稳，完全静默。
6. **MCP Sampling 宿主不支持时的透明代理**：不要去改客户端二进制，在客户端与 MCP 服务的 Stdio 管道中间垫一层代理（Proxy），由代理直接接管 sampling 请求并调用中心渠道池，这是最具兼容性的非侵入解法。
7. **搜索 API 必须建多 Key 轮转与冷却池**：单 Key 面对高并发或短时突发检索必定触发 429 报错。必须像 `search_hub.js` 一样，在适配器层构建游标轮转与带 TTL 冷却时间的健康池。
8. **跨会话终止与数据物理释放的完整性判据（close 闭环）**：会话彻底关闭不能只依赖杀进程，必须经宿主两阶段释放：先调 `ForceStopCascadeTree` 停止执行树并置空 presence 锁，再调 `DeleteCascadeTrajectory` 将 SQLite 元数据物理抹除（黑板 1982）。
9. **文件收件箱通道具有普适性（inject-inbox 闭环）**：外部向约定的收件箱路径（`channels/probe/tmp/inbox_signal.json`）落盘结构化指令，智能体启动巡检并在 3 秒内将其吸收至上下文并执行，是跨产品穿透最稳健的通道（黑板 1983）。
10. **就地步骤截断与快照回滚（rewind 闭环）**：`RevertToCascadeStep` 原生支持步骤级截断（`stepIndex`），并通过 `conversationOnly: false` 联动文件快照恢复，达成原会话无感回滚（黑板 1985）。

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
3. **黑板实测证据行（2026-10-19/10-20 批次）**：
   - `antigravity/L2/agent_gateway`（`recall-history` 成功回溯 Antigravity 本地转录）
   - `workbuddy/L2/agent_gateway`（`recall-history` 成功跨产品读取 WorkBuddy 会话）
   - `antigravity/L2/search_hub`（`web-search` 成功完成 22-Key 轮转检索）
   - **黑板 1977 行**：`zcode/L0/desktop-cdp`（`native-meta` 经 CDP 9240 读出 2183 元素、122 按钮与完整面板）
   - **黑板 1978 行**：`antigravity/L0/desktop-cdp`（`native-meta` 经 CDP 9234 读出 2326 元素、199 按钮与侧边栏）
   - **黑板 1979 行**：`doubao/L0/desktop-cdp`（`native-meta` 经 CDP 9225 读出 1424 元素、102 按钮与工作区）
   - **黑板 1980 行**：`zcode/L0/desktop-cdp`（`computer-use` 经 WebSocket 发送 `Page.captureScreenshot` 静默截屏 318,556 字节 PNG 与 DOM 注入）
   - **黑板 1981 行**：`antigravity/L0/desktop-cdp`（`computer-use` 经 WebSocket 发送 `Page.captureScreenshot` 静默截屏 1,029,000 字节 PNG 与 DOM 注入）
   - **黑板 1982 行**：`antigravity/L0/connect-rpc`（`close` 经 `ForceStopCascadeTree` + `DeleteCascadeTrajectory` 双阶段物理关闭）
   - **黑板 1983 行**：`antigravity/L0/file-inbox`（`inject-inbox` 经外部写收件箱文件与 3s 内动态 token 主动回显）
   - **黑板 1984 行**：`antigravity/L0/desktop-ui+tool`（`ui-automation-scheduler` 经 CDP 9234 Automations 菜单与原生 schedule 调度器工具注册）
   - **黑板 1985 行**：`antigravity/L0/connect-rpc`（`rewind` 经 `RevertToCascadeStep` 就地回滚步骤与快照恢复）
4. **外部官方规范与技术标准**：
   - Model Context Protocol: Sampling Specification (`modelcontextprotocol.io/specification/draft/client/sampling`)
   - Anthropic Computer Use Documentation (`platform.claude.com/docs/en/agents-and-tools/tool-use/computer-use-tool`)
   - Chrome DevTools Protocol Specification (`chromedevtools.github.io/devtools-protocol/`)
   - Microsoft UI Automation Specification (`learn.microsoft.com/en-us/windows/win32/winauto/`)

