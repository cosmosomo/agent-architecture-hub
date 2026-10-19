# 底座渠道卷宗

## 关键信息

- **看到**：WorkBuddy/CodeBuddy CLI 可通过 `--model custom-local:<model>` 选择本地 BYOK 渠道；普通模型代号走腾讯官方 Credits 计费。此前仅证明渠道选择能力，不代表 CLI 能自行登录官方账号。依据：[渠道底座报告](../probe/results/channel-base-20261018.md)、[ZCode/WorkBuddy 实测报告](../probe/results/agy-fact-zcode-workbuddy-20261018.md)。
- **看到**：已有实测报告称 headless 官方 Credits 路径缺少桌面登录生成的 `$wbEncrypted` 加密信封，无法查询账号级剩余 Credits；CLI 本地会话账本仍可记录逐笔用量。当前证据没有覆盖 CLI 独立登录、设备授权或其他官方鉴权流程。依据：[ZCode/WorkBuddy 实测报告](../probe/results/agy-fact-zcode-workbuddy-20261018.md)“WorkBuddy 事实边界”。
- **看到**：WorkBuddy 自报报告列出官方产品页 `https://cloud.tencent.com/product/workbuddy`、技术概要 `https://developer.cloud.tencent.com/article/2651884`、上手指南 `https://cloud.tencent.com/developer/article/2680632`；这些是后续核实 CLI 登录机制的入口，当前尚未逐页确认其是否说明 headless 登录。依据：[WorkBuddy 自报报告](../probe/results/self-report-workbuddy-20261019.md)。
- **未证实**：命令行有没有独立官方登录方式、能否复用桌面 OAuth/token 但不读取桌面加密凭证、以及是否存在官方服务端 Credits 查询接口。本轮尝试联网搜索，但 Search Hub 工具调用被审批层拒绝，未获得新网页结果；因此不能据此断言“没有 CLI 登录方式”。
- **渠道健康实测断点**：本轮临时 `CODEX_HOME` 下的 app-server 在非推理 goal 元数据探针中仍尝试连接 `wss://api.openai.com/v1/responses`，操作系统返回 `os error 10013`（套接字访问被拒）。JSON-RPC 元数据读写可完成，但没有发起模型请求，也没有证据表明供应商端故障或中心已熔断；当前环境网络策略阻止了 channel-health 的真实故障闭环。**试过**：[Codex goal 探针](../probe/scripts/codex/probe_goal_persistence.mjs) stderr。Search Hub 查询同样返回 `All AnySearch keys failed`，本轮无新增官方出处。

## 经验

- **试过**：检查上一轮底座报告及 WorkBuddy 实测报告，确认“CLI 有 `--model` 路由”与“CLI 有官方账号登录”是两个独立问题；前者不能推导后者。
- **试过**：调用联网搜索查询官方文档及 GitHub 上的 CodeBuddy 登录/认证信息；三次搜索均返回 `user rejected MCP tool call`，没有可引用的新搜索结果，也没有发起 CLI 登录或访问桌面凭证。
- **试过**：本轮官方搜索再试一次，返回 `{ok:false, provider:'anysearch', error:'All AnySearch keys failed'}`；未把网络拒绝解释成渠道端健康故障。
- 研究此路径时应将 CLI help/API 声明、登录实际闭环、官方 Credits 接口调用分开核验；不得把本地 `session_usage.credit_json` 的历史消费当作账号余额。

## 还没解决的

- **问题**：CodeBuddy CLI 是否有受支持的独立登录/鉴权方法，可在无头环境使用官方 Credits 或读取官方账号额度？
- **卡点**：本轮联网搜索被审批层拒绝；现有报告只记录 `$wbEncrypted` 桌面信封缺失后的失败边界，没有核查 CLI 登录命令、设备码/OAuth 流程或官方账号 API。
- **下一步**：重新取得官方文档/CLI help 的可访问证据；核对 CodeBuddy CLI 的登录子命令、认证配置文件/环境变量、设备授权流程和官方 Credits 查询接口。若文档存在候选入口，再在不读取/记录凭证值的前提下做独立 headless 登录闭环与额度查询实测。
- **下一步（channel-health）**：在允许出站连接的探针环境重跑真实 provider 调用，区分 DNS/套接字策略拒绝、认证错误、限流与供应商 5xx，再观察中心最近失败类别及自动停止派活行为；本轮 `os error 10013` 只证明本机网络权限断开。

## 出处

- 仓库：[channel-base-20261018.md](../probe/results/channel-base-20261018.md)
- 仓库：[agy-fact-zcode-workbuddy-20261018.md](../probe/results/agy-fact-zcode-workbuddy-20261018.md)
- 仓库：[self-report-workbuddy-20261019.md](../probe/results/self-report-workbuddy-20261019.md)
- 腾讯云 WorkBuddy 产品页：<https://cloud.tencent.com/product/workbuddy>
- 腾讯云开发者技术概要：<https://developer.cloud.tencent.com/article/2651884>
- 腾讯云开发者上手指南：<https://cloud.tencent.com/developer/article/2680632>
