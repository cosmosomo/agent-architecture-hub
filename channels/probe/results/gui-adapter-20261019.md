# 通用 GUI 适配器：技术路线调研（2026-10-19）

## 结论

建议把**Windows UI Automation（UIA）作为桌面通用适配器的主路线**，以可访问性树和控件模式读写语义控件；对网页/Electron 内容优先走 DOM/CDP 专用驱动；对 UIA 暴露不足的画布、图像和远程桌面，再增加截图+视觉模型的按需能力。桌面会话隔离适合作为运行环境/并发边界，不是自动化 API；RPA 是上层流程编排与产品化形态，也不替代底层适配器。

这个组合覆盖 Windows 上较多原生应用，同时比纯坐标/截图操作更稳、推理成本更低，也能把真实用户桌面与自动化写者隔开。它不能保证“完全不影响用户”：UIA 的读取通常不需要抢焦点，控件写操作可能激活窗口或改变应用状态；进程/桌面隔离是否可行，要看权限、会话和被测应用限制。

## 证据范围与限制

任务书要求先查 GitHub、官方文档和社区。本轮尝试了指定本地 `search_hub.js`，返回 `All AnySearch keys failed`；联网搜索 MCP 调用被自动审批层拒绝。因此下表列的是供复核的项目与官方文档入口，**不表示本轮成功在线核验其最新版本、许可或兼容矩阵**。建议网络可用时按这些链接补查并记录版本。仓库内可核实的既有证据包括 `channels/probe/results/opencli-route-20261018.md`：OpenCLI 的 CDP UI 策略通过 DOM/按键驱动界面，会争用窗口焦点，且实测有选择器漂移；本机产品管线见 `hub/data/products.json`，已将豆包桌面端登记为 OpenCLI/CDP 路线。

## 路线比较

| 路线与代表项目 | 实现办法 | 占真实屏幕/鼠标 | Windows 情况 | 成本 | 接入中心 |
|---|---|---|---|---|---|
| **系统无障碍/控件接口**： [Microsoft UI Automation](https://learn.microsoft.com/windows/win32/winauto/entry-uiauto-win32)、[FlaUI](https://github.com/FlaUI/FlaUI)、[pywinauto](https://github.com/pywinauto/pywinauto) | 通过 UIA provider/control tree 查找控件，使用 Invoke、Value、Selection 等模式操作；FlaUI 是 .NET UIA2/UIA3 封装，pywinauto 提供 Python UIA/Win32 后端 | 读取通常不移动鼠标、不占屏幕；写入控件通常无需坐标鼠标，但激活窗口/应用自身副作用仍可能发生；UIA 不支持的自绘控件需别路 | 原生适配最好；应用暴露的 provider 质量不一，桌面会话/权限边界会影响跨进程访问 | 库开源免费；开发、应用特例维护成本中等 | **最适合作主适配器**。以独立 Windows worker 暴露本地 RPC/HTTP/MCP 受控接口；中心只传目标、动作和超时，回结构化树/结果/错误。需进程白名单、超时、审计和单写者锁 |
| **浏览器/Electron 调试协议**： [Chrome DevTools Protocol](https://chromedevtools.github.io/devtools-protocol/)、[Playwright](https://github.com/microsoft/playwright)、[OpenCLI](https://github.com/jackwener/opencli) | CDP 连接 Chromium/Electron renderer，直接查 DOM、可访问性节点、执行 JS、截图和输入；Playwright 封装浏览器自动化 | DOM 读不需鼠标；点击/键入走浏览器输入通道，不一定移动物理鼠标，但同一应用状态会改变；连接正在使用的桌面实例会与用户共享状态 | Chromium/Electron 覆盖好；不是通用 Win32 控件方案。Windows 上远程调试端口和应用启动参数/策略需逐应用确认 | 无模型成本；选择器维护与端口/版本管理成本中等 | **适合网页和 Electron 的专用 adapter**。仓库现有 OpenCLI 路线已接入产品表；已有报告指出真实桌面共享状态、并发写者需互斥，DOM 漂移风险较高 |
| **截图+视觉模型 Computer Use**： [OpenAI computer use guide](https://platform.openai.com/docs/guides/tools-computer-use)、[Anthropic computer use](https://docs.anthropic.com/en/docs/agents-and-tools/computer-use)、[Microsoft UFO](https://github.com/microsoft/UFO) | 截图交给视觉模型识别，再执行坐标点击、键盘输入、滚动并回传新截图；UFO 是面向 Windows 应用的开源 GUI agent 研究框架 | 通常需要可见桌面和真实输入注入；共享交互桌面会占用焦点/鼠标键盘。虚拟显示或隔离会话能分开用户，但仍有一个 GUI 桌面被驱动 | Windows 桌面可用性强；视觉定位对缩放、分辨率、动画、遮挡和语言敏感，校验闭环很重要 | 每个视觉推理/动作有模型费用和延迟；复杂桌面成本最高 | **作为兜底视觉 adapter**，不能作为默认操作路径。中心需把动作限定在隔离桌面，限制敏感操作，并对结果截图/状态做校验。产品 API 的可用性和许可需在线复核 |
| **桌面会话/VM/虚拟化隔离**： [Windows Sandbox](https://learn.microsoft.com/windows/security/application-security/application-isolation/windows-sandbox/)、[Windows Session 0 isolation](https://learn.microsoft.com/windows/win32/services/interactive-services) | 为自动化提供独立 VM、沙盒或独立交互式用户会话；上层仍需 UIA、CDP 或视觉控制 | 隔离会话通常不占用户当前桌面；Sandbox/VM 有独立显示表面。Windows 服务的 Session 0 不能直接当作交互桌面自动化环境 | 可行性受 Windows 版本、虚拟化能力、域/组策略、应用授权与登录态限制；Sandbox 生命周期偏临时，持久登录态需评估 | VM/资源与运维成本中高；并发需按实例扩容 | **运行隔离层，不是控制协议**。作为第二阶段为 GUI worker 提供隔离桌面池，中心管理租约、实例生命周期和人工交接 |
| **RPA 套件**： [Robot Framework](https://github.com/robotframework/robotframework)、[Robocorp RPA Framework](https://github.com/robocorp/rpaframework)、[Power Automate Desktop](https://learn.microsoft.com/power-automate/desktop-flows/introduction) | 用关键字/流程图编排 UIA、浏览器、键鼠和 OCR 等动作；平台额外提供任务调度、凭据/审计与录制器 | 取决于底层动作；桌面 UI 自动化一般要求可交互会话或专用机器人会话，浏览器 DOM 路线可少用坐标 | Windows 企业自动化成熟；开源框架与商业/微软平台在部署、治理、许可和无人值守能力上不同 | 框架本身可免费；平台许可、机器人 VM、维护和流程开发成本不一 | 中心可把 RPA 当外部执行器/流程编排器，但不宜先引入另一套中心。优先复用 UIA/CDP worker 的原子能力，需要业务流程治理时再评估 |

## 建议的接入形态

1. 在中心定义稳定的 GUI 能力契约：`inspect`（返回控件树/截图引用）、`act`（语义控件动作优先）、`wait`、`capture`、`health`；结果包括应用身份、会话/窗口、动作、耗时、可诊断错误和证据引用。
2. Windows sidecar 负责 UIA 访问与会话内执行，中心管道按产品登记 adapter，不把应用特例散落到中心流程。网页/Electron 应用可选 CDP driver，剩余控件缺口才要求视觉驱动。
3. 默认只读检查；写动作经过同一目标的单写者租约。将 worker 放进隔离的交互式用户会话，避免桌面鼠标键盘被用户和代理同时驱动。UIA 访问权限不足、元素不可见或不支持时返回明确错误，不静默改用坐标点击。
4. 按证据分批接入：先选一个标准 Win32/WPF 应用验证 UIA 树、控件模式、权限与取消；再选一个 Chromium/Electron 应用验证 CDP；最后对自绘控件评估隔离桌面+视觉路线。当前调研没有在本机操作屏幕或安装工具，也未对 Windows Sandbox/VM 做实机兼容验证。

## 决策

推荐 **UIA 主干 + CDP 专项 + 视觉兜底 + 隔离交互会话**。单一 UI 技术无法覆盖现代 Electron DOM、自绘画布、传统 Win32 与用户隔离这几类不同问题；分层 adapter 保持中心的能力契约一致，同时允许每个应用选择最稳的可观察接口。现阶段不建议直接以截图视觉路线统管全部 GUI：其屏幕竞争、推理费用、延迟和定位不确定性都高于语义接口。

## 待补证据

- 联网恢复后核验代表项目当前活跃度、许可证、Windows 版本支持和维护状态，尤其是 UFO、Robot Framework 生态的桌面库及 Power Automate Desktop 的无人值守限制。
- 选取三类目标应用做受控实测，逐项记录读取是否抢焦点、写操作影响、取消/超时、会话隔离能力、并发边界与维护成本。
- 验证 UIA sidecar 在中心管线中的进程生命周期、错误事件、访问控制和打包方式后，再登记为正式产品/adapter 能力。

