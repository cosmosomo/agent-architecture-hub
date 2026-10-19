# 把豆包接进中心（10-19）

## 用户的原话

> “你的服务比较珍贵，所以我希望你能够调用一个便宜一点的 AI 去看。而且我基本上是一直在工作的，所以我希望这个便宜的 AI 能够不占用我自己的工作。其实我感觉豆包是满足需求的，但是我们系统还没有接入豆包。”
>
> “其实有些生态他们的那个 Computer Use 会做的很好，豆包的 Computer Use 就做的很好。”
>
> “我们现在缺少对于原生桌面 GUI 的功能分析，没有打通这个闭环……如果 AI 可以像我一样打开页面，然后用一些功能，或者至少看一下面板，你就知道很多认知现在的认知是局限的。”
>
> “如果你要写豆包接入的任务书，你就直接发给反重力，让他优先用 opencli”

## 这是我的理解

中心（`Agent-Architecture-Hub`，服务在 8899）现在能驱动七家：Claude、Codex、Antigravity、ZCode、WorkBuddy、OpenCode、Hermes。豆包还没接进来。我们想借豆包的电脑操作（Computer Use），去看、去用各家桌面端的界面，补上“桌面端界面”这一列。这一列现在几乎是空的，很多功能只有在界面上才看得到，比如 WorkBuddy 的积分、模型倍率、限免模型、定时任务入口。

用户一直在用这台电脑工作，所以最要紧的一条是：**不能占用用户的屏幕、鼠标和键盘**。

## 要回答的问题

1. 中心怎样才能给豆包派活、收回结果？要做到和别的产品一样，经 `agent_gateway.js run / dispatch` 能用。
2. 豆包的电脑操作，能不能在不占用用户屏幕、鼠标、键盘的条件下工作？如果不能，在什么条件下可以，比如另一个桌面、虚拟机、Windows 沙盒、远程会话？

## 已知

- 档案卡：`channels/hosts/doubao-desktop.md`。现在只能经 CDP（豆包用 `--remote-debugging-port=9225` 启动）配合 `opencli doubao-app status / ask / send / read / new / screenshot / dump` 操作界面；会话记录存在 LevelDB 里，读不了。产品表 `hub/data/products.json` 里有一行 `doubao-desktop`，route 是 `opencli`，`backend: false`，也就是中心还不驱动它。
- 本机同时装了普通版豆包和办公版 DoubaoWork。
- 中心接一家产品的样子，参考产品表里别家的行、`trace/apps/cli/src/gateway/` 下的各路线文件，以及 `channels/README.md` 的“管线”一节。

- 用户要求优先用 opencli。本机全局装了 `@jackwener/opencli`（v1.8.6 以上），有现成的 `doubao-app` 适配器。用法和注意事项见技能 `opencli-poweruser`（`~/.claude/skills/opencli-poweruser/`）。opencli 走不通的地方再换别的办法，并写明为什么换。

## 还不知道

- 豆包有没有命令行、本地接口或别的不用操作界面的入口。
- 它的电脑操作具体怎么实现：截图加视觉，还是读系统无障碍信息，还是别的；会不会移动真实鼠标。
- 它的额度和计费方式。

## 怎样算做成

- 用户在用电脑的时候，中心经命令行给豆包派一件事，豆包做完把结果交回，整个过程用户的屏幕、鼠标、键盘不受影响。用户自己在旁边确认没被打扰，才算做成。
- 做不到就照实写：断在哪、在什么条件下能做到。
- 结论写进档案卡；能力用 `node hub/tools/agent_gateway.js feature --agent doubao-desktop ...` 登记，实现路径（`--how`）写清楚；实测写进 `channels/probe/blackboard.jsonl`。
- 要改中心代码的，写清楚改哪里、为什么，交给开发方（负责人 Claude 会话）来改，或者在用户同意后自己改，并跑 `node hub/tools/agent_gateway.js tables check` 和 `cd trace && npm run typecheck`。

## 不能碰的

- 不抢用户的屏幕、鼠标、键盘；不在用户正在用的豆包窗口里发消息。
- 不杀用户的应用，不改账号和凭证；不在报告里写明文密钥。
