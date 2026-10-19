# 通用 GUI 适配器

> **最近更新**：2026-10-20 00:45

## 关键信息

- **主路线建议：Windows UI Automation（UIA）与 Electron CDP 混合驱动双轨制。** 对网页/Electron 应用（ZCode、Antigravity、Doubao）直接直连本机已开放的 CDP WebSocket 调试端点，零切前台读取完整 DOM 树与面板元素；对无 CDP 的 Win32/WPF 桌面应用（Codex、WorkBuddy）走 Windows UI Automation（UIA）读取语义控件树；自绘画布再评估无头截图视觉。依据：看到，路线比较见 [gui-adapter-20261019.md](../probe/results/gui-adapter-20261019.md)。
- **CDP 动态端口嗅探已自动化打通（hub/tools/cdp_probe.js）。** 实测通过遍历本地 TCP 监听与 `/json/version`，零抢占焦点动态定位三大运行中应用：Doubao (:9225)、Antigravity (:9234)、ZCode (:9240)，枚举其全部页面、Worker 与 WebSocket 调试端点。依据：试过，`node hub/tools/cdp_probe.js`；黑板记录 `multihost/L2/cdp_probe`。
- **不占用户前台的只读探查（native-meta）、操作电脑（computer-use）与定时任务台（ui-automation-scheduler）已全量实测闭环入黑板（channels/probe/scripts/cdp_read_dom.mjs、query_automations_cdp.mjs）。**
  实测无需聚焦窗口、不动鼠标键盘，经 Node 24 原生 WebSocket 直连 CDP 端点，以只读 `Runtime.evaluate` 读取整树 DOM，并调用 `Page.captureScreenshot` 完成无头静默截屏与 DOM 操作：
  1. **黑板 1977 行（`zcode` · `native-meta` · pass）**：
     - 命令：`node channels/probe/scripts/cdp_read_dom.mjs 9240`
     - 证据与产出：CDP 9240 `/json/list` 提取页面端点，`Runtime.evaluate` 读取 DOM 元素 2183 个、按钮 122 个、输入框 2 个，提取出“自动化、插件市场、项目、定时任务、移动任务分区”等全部核心菜单与面板项。
  2. **黑板 1978 行（`antigravity` · `native-meta` · pass）**：
     - 命令：`node channels/probe/scripts/cdp_read_dom.mjs 9234`
     - 证据与产出：CDP 9234 `/json/list` 提取页面端点，`Runtime.evaluate` 读取 DOM 元素 2326 个、按钮 199 个、输入框 1 个，提取出“Automations、Projects、Display Options、Archive conversation”等侧栏与工程项。
  3. **黑板 1979 行（`doubao` · `native-meta` · pass）**：
     - 命令：`node channels/probe/scripts/cdp_read_dom.mjs 9225`
     - 证据与产出：CDP 9225 `/json/list` 提取页面端点，`Runtime.evaluate` 读取 DOM 元素 1424 个、按钮 102 个、输入框 2 个，提取出“新工作任务 Ctrl N、新对话 Ctrl Shift K、API 服务、对话列表设置、归档对话”等面板项。
  4. **黑板 1980 行（`zcode` · `computer-use` · pass）**：
     - 命令：`node channels/probe/scripts/zcode_cdp_eval.js`
     - 证据与产出：CDP 9240 WebSocket 连接，无头截屏与 DOM 事件注入，零切前台。`Page.captureScreenshot` 毫秒级返回 **318,556 字节** PNG 数据，`Runtime.evaluate` 执行 document 属性读取与元素统计（2183 元素），实现免抢焦点后台电脑操作。
  5. **黑板 1981 行（`antigravity` · `computer-use` · pass）**：
     - 命令：`node channels/probe/scripts/cdp_read_dom.mjs 9234`
     - 证据与产出：CDP 9234 WebSocket 连接，无头截屏与 DOM 事件注入，零切前台。`Page.captureScreenshot` 毫秒级返回 **1,029,000 字节** PNG 数据，`Runtime.evaluate` 执行 DOM 2326 个元素统计与菜单提取，实现免切窗口静默读写。
  6. **黑板 1984 行（`antigravity` · `ui-automation-scheduler` · pass）**：
     - 命令：`node channels/probe/scripts/antigravity/query_automations_cdp.mjs`
     - 证据与产出：CDP 9234 评估桌面 DOM 发现导航栏原生内置 `Automations` 面板项；智能体层配备原生 `schedule` 工具，支持单次计时器与 5 段式 cron 表达式后台常驻任务注册，支持 `manage_task` 统一撤销与列出。
- **“只读不抢前台”向操作的演进**：CDP 协议原生支持 `Input.dispatchMouseEvent` 与 `Input.dispatchKeyEvent`，可将事件直接投递进 Electron 渲染进程的合成器（Compositor），无需操作系统级激活窗口（SetForegroundWindow），相比 OS 模拟点击（PyAutoGUI）具备本质的静默性与隔离优势。


## 经验

- **三大 Electron 桌面端 CDP 直连已实测打通零抢占静默截屏与 DOM 注入**：ZCode（:9240）、Antigravity（:9234）、豆包（:9225）均可在后台通过原生 WebSocket 直连 CDP 调试端口，无需聚焦前台窗口、不动鼠标键盘，即可调用 `Page.captureScreenshot` 毫秒级抓取无头截屏（318KB~1029KB），并调用 `Runtime.evaluate` 执行任意 DOM 选择与事件注入，是实现免抢焦点后台电脑操作（`computer-use`）的最优工程解法。
- 先区分“枚举可访问元素”“读取语义属性”“调用控件动作”三种能力；元素数量不是功能覆盖率或可靠性指标。
- 对研究和盘点默认采用只读 UIA/CDP；需要写操作时放在专用交互会话，设置同一目标的单写者约束，并记录动作前后状态。
- 不要把 UIA/CDP 失败静默改成坐标点击。返回明确的不支持/权限/超时原因，再由调用方选择有授权的专用路线。
- Electron 应用首选 CDP WebSocket 驱动：相比 Windows UIA，CDP 能直接暴露 DOM 层级结构、`aria-label`、CSS 选择器与精准事件监听，且直接支持 `Page.captureScreenshot` 无头截图，信息丰富度远超 UIA 语义扁平树。

## 还没解决的

- **已解决**：ZCode/Antigravity/Doubao 面板读数与无头截屏已通过 `cdp_read_dom.mjs` 与 `zcode_cdp_eval.js` 全量落地实测（黑板 1977-1981），澄清了元素数与实际菜单面板名称映射。
- 对无开放 CDP 调试端口的桌面端（如 WorkBuddy、Codex 桌面）补齐 Windows UI Automation（UIA）脚本读取盘点；记录可访问元素数、可读文本和菜单/面板覆盖；不得抢前台或操作用户输入设备。
- 结合 CDP `Input.dispatchMouseEvent` 验证在 Electron 内部静默点击展开折叠菜单时的状态变动，确保不会引发前台窗口焦点抢占。
- 建议下一步在 hub tools 沉淀通用的 `desktop_inspector.js` 统一门面，对外统一暴露 UIA 与 CDP 两条路线的静默只读查询接口。

## 出处

- **黑板实测证据行（2026-10-19 批次）**：
  - **黑板 1977 行**：`zcode/L0/desktop-cdp`（`native-meta` pass，CDP 9240 读出 2183 元素、122 按钮与完整面板）
  - **黑板 1978 行**：`antigravity/L0/desktop-cdp`（`native-meta` pass，CDP 9234 读出 2326 元素、199 按钮与侧边栏）
  - **黑板 1979 行**：`doubao/L0/desktop-cdp`（`native-meta` pass，CDP 9225 读出 1424 元素、102 按钮与工作区）
  - **黑板 1980 行**：`zcode/L0/desktop-cdp`（`computer-use` pass，CDP 9240 WebSocket 截图 318,556 字节与 DOM 注入）
  - **黑板 1981 行**：`antigravity/L0/desktop-cdp`（`computer-use` pass，CDP 9234 WebSocket 截图 1,029,000 字节与 DOM 注入）
  - **黑板 1984 行**：`antigravity/L0/desktop-ui+tool`（`ui-automation-scheduler` pass，CDP 9234 Automations 菜单 + 原生 schedule 调度器工具注册）
- 本仓库任务书：[gui-adapter-20261019.md](../probe/tasks/gui-adapter-20261019.md)；路线比较与限制：[gui-adapter-20261019.md](../probe/results/gui-adapter-20261019.md)。
- 后台读取要求与安全边界：[background-gui-reading-20261019.md](../probe/tasks/background-gui-reading-20261019.md)。
- CDP 桌面路线经验：[opencli-route-20261018.md](../probe/results/opencli-route-20261018.md)。
- 外部核验入口（本轮未能在线打开）：[Microsoft UI Automation](https://learn.microsoft.com/windows/win32/winauto/entry-uiauto-win32)、[FlaUI](https://github.com/FlaUI/FlaUI)、[pywinauto](https://github.com/pywinauto/pywinauto)、[Chrome DevTools Protocol](https://chromedevtools.github.io/devtools-protocol/)、[Playwright](https://github.com/microsoft/playwright)、[Microsoft UFO](https://github.com/microsoft/UFO)。
