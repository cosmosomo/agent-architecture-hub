# 通用 GUI 适配器

## 关键信息

- **主路线建议：Windows UI Automation（UIA）读取语义控件树。** 对网页/Electron 补 CDP/DOM 专用驱动；UIA 暴露不足的自绘画布再评估截图视觉；桌面隔离是执行环境，不是控制协议。依据：看到，路线比较见 [gui-adapter-20261019.md](../probe/results/gui-adapter-20261019.md)。
- **CDP 动态端口嗅探已自动化打通（hub/tools/cdp_probe.js）。** 实测通过遍历本地 TCP 监听与 `/json/version`，零抢占焦点动态定位三大运行中应用：Doubao (:9225)、Antigravity (:9234)、ZCode (:9240)，枚举其全部页面、Worker 与 WebSocket 调试端点。依据：试过，`node hub/tools/cdp_probe.js`；黑板记录 `multihost/L2/cdp_probe`。
- **不占用户前台的只读探查已有单点实测。** ZCode 报告称使用本机 UIA 读取到 660 个元素；这是读取元素数，不等于 660 个可用功能，也未证明其他应用同样可读。依据：派单转述（gui-adapter-20261019）及其指向的背景 GUI 阅读议题；当前可见的该议题任务书为 [background-gui-reading-20261019.md](../probe/tasks/background-gui-reading-20261019.md)，本仓库检索尚未找到包含 660 结果的报告/原始命令，故细节待复核。
- **“只读不抢前台”不能外推到操作。** UIA 树读取通常不需要鼠标或焦点；调用控件模式会改变应用状态，仍须单独验证。依据：看到，路线报告；具体目标应用行为尚未实测。
- 本仓库已有 OpenCLI/CDP 桌面路线，但报告记录其共享应用状态、窗口焦点竞争和选择器漂移风险。依据：看到，[opencli-route-20261018.md](../probe/results/opencli-route-20261018.md)。

## 经验

- 先区分“枚举可访问元素”“读取语义属性”“调用控件动作”三种能力；元素数量不是功能覆盖率或可靠性指标。
- 对研究和盘点默认采用只读 UIA；需要写操作时放在专用交互会话，设置同一目标的单写者约束，并记录动作前后状态。
- 不要把 UIA 失败静默改成坐标点击。返回明确的不支持/权限/超时原因，再由调用方选择有授权的专用路线。
- 网络检索本轮通过 `node hub/tools/search_hub.js search ...` 尝试，但 AnySearch 返回 `All AnySearch keys failed`；extract 也返回所有 provider 失败。因此路线报告里的官方/开源入口尚未完成在线核验，不能视为本轮验证过版本、许可或维护状态。

## 还没解决的

- 找到 ZCode 660 项读数对应的原始结果/命令、应用版本、窗口状态和元素过滤规则；确认是否全树、去重后数量，以及采集是否完全只读。
- 对 Codex、Claude、Antigravity、WorkBuddy、豆包等逐一做后台 UIA 只读盘点，记录可访问元素数、可读文本和菜单/面板覆盖；不得抢前台或操作用户输入设备。
- 用一个 Win32/WPF 和一个 Electron 应用验证 UIA 读取对前台的影响，再将 UIA 控件动作与纯读取分开验证；评估进程权限、超时、取消和隔离会话。
- 恢复外网检索后核查 Microsoft UIA、FlaUI、pywinauto、CDP/Playwright、UFO、RPA 和 Windows Sandbox 的官方说明、当前支持与许可。建议下一步优先补齐上述跨产品实测，再决定 sidecar 的稳定接口和接入方式。

## 出处

- 本仓库任务书：[gui-adapter-20261019.md](../probe/tasks/gui-adapter-20261019.md)；路线比较与限制：[gui-adapter-20261019.md](../probe/results/gui-adapter-20261019.md)。
- 后台读取要求与安全边界：[background-gui-reading-20261019.md](../probe/tasks/background-gui-reading-20261019.md)。
- CDP 桌面路线经验：[opencli-route-20261018.md](../probe/results/opencli-route-20261018.md)。
- 外部核验入口（本轮未能在线打开）：[Microsoft UI Automation](https://learn.microsoft.com/windows/win32/winauto/entry-uiauto-win32)、[FlaUI](https://github.com/FlaUI/FlaUI)、[pywinauto](https://github.com/pywinauto/pywinauto)、[Chrome DevTools Protocol](https://chromedevtools.github.io/devtools-protocol/)、[Playwright](https://github.com/microsoft/playwright)、[Microsoft UFO](https://github.com/microsoft/UFO)。
