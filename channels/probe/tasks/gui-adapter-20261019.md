# 通用 GUI 适配器：技术路线调研（10-19）

## 用户的原话

> “通用的guiuse适配器技术什么的也是值得单独研究的。”
>
> “我希望你能够调用一个便宜一点的 AI 去看。而且我基本上是一直在工作的，所以我希望这个便宜的 AI 能够不占用我自己的工作。”
>
> “一定要记得，所有原生的生态的研究都要辅助网络调研来研究，不能闭门造车。因为很有可能开源的项目就已经做了这个功能了。”

## 这是我的理解

很多产品的功能只在桌面界面上有，没有接口。中心要“看”和“用”这些界面，需要一种通用的 GUI 适配器。目录里的位置：`channels/research/README.md` 的“通用 GUI 适配器”一行。另一个会话（Antigravity flash）在实测本机各家能不能不抢屏幕地读出来，任务书 `background-gui-reading-20261019.md`；这一件不重复那件，而是调研外面已经有的技术路线。

## 要回答的问题

外面已经有哪些做 GUI 自动化或电脑操作的技术路线、开源项目和产品？各自怎么实现、要不要占用真实的屏幕和鼠标、在 Windows 上效果如何、能不能接到我们的中心？哪条最适合做成通用适配器？

## 已知

- 可能的路线（不限于这些）：系统无障碍接口（Windows UI Automation 一类）、浏览器或 Electron 的调试协议（CDP）、截图加视觉模型（各家的 Computer Use）、桌面虚拟化或隔离桌面（虚拟机、Windows 沙盒、另一个桌面会话），以及 RPA 工具。
- 本机已有：OpenCLI（`@jackwener/opencli`，CDP 路线，有豆包等适配器）；Claude 桌面端的内置浏览器面板（读无障碍树、截图、执行脚本）。
- 中心怎么接一家产品：`channels/README.md` 的“管线”一节、`hub/data/products.json`。

## 先查网上

动手之前先查：GitHub 上的开源项目（GUI 智能体、桌面自动化、视觉解析界面的工具）、官方文档、社区讨论、评测。报告里带链接，写清每条路线的出处。搜索：`node hub/tools/search_hub.js search "<词>" --max 5`（可加 `--domains github.com`），正文：`node hub/tools/search_hub.js extract "<链接>"`。

## 怎样算做成

- 报告：`channels/probe/results/gui-adapter-20261019.md`。每条路线写清：代表项目（链接）、实现办法、占不占用真实屏幕鼠标、Windows 上的情况、成本、能不能接进中心；最后写推荐哪条做通用适配器、为什么。
- 值得借用的产品功能，用 `node hub/tools/agent_gateway.js feature --agent <产品> --name <功能> --what <做什么> --entry <入口> --exclusive 独家|别家也有|不确定 --openness 开源|公开接口|只能界面|不开放 --evidence 看到 --how <实现路径>` 登记。
- 交回一句话：调研了几条路线、推荐哪条。

## 不能碰的

只调研、不在本机装软件、不操作用户的屏幕鼠标键盘；不改代码和全局配置；报告里不写密钥。
