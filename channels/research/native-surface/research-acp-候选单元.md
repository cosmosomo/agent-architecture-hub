# 原生接口普查 · 对不上号的候选单元（research-acp，2026-10-20）

范围：ZCode、WorkBuddy、OpenCode、Hermes 的原生面（CLI/ACP/HTTP/slash/SDK）。明细在同名目录 `<产品>.json`；这里只列**对不上现有 145 单元**的能力，按类归组，登不登由负责人决定。已有单元的新证据不在此列（如 OC /tui/* 建议直接对到已登的 `remote-control`，Hermes moa 对到 `multi-model-compare`，均无需新登）。

## A. 智能体即服务 / 反向协议（建议登记 ★★★）

- **Hermes `hermes mcp`**：能把 Hermes 自己跑成一个 **MCP server**——智能体反过来成为工具提供方，任何 MCP 客户端可调用它的技能/会话。级别：看到（`hermes --help` 原文 "run Hermes as an MCP server"）。几家有：仅 Hermes。
- 关联：WB `--serve`（Web UI+REST+ACP over HTTP SSE）和 OC `serve`（162 路径 OpenAPI）已经把智能体当服务暴露，但语义是"驱动它"，Hermes 的 MCP-as-server 语义是"调用它的能力"。框架里 `external-protocol` 只管"我们怎么驱动它"，装不下"它怎么被第三方用"。

## B. 凭据与安全基建（建议登记 ★★☆）

- **Hermes 五件套**：`hermes vault`（本地加密自动填充库）、`hermes secrets`（Bitwarden/1Password 外部密钥源）、`hermes egress`（iron-proxy 出口凭据注入防火墙）、`hermes pairing`（DM 配对码授权）、`hermes webhook`（动态 webhook 订阅）。级别：看到（--help）。现有 `provider-credential` 只覆盖推理凭证，装不下"通用密钥供给与出口管控"。
- **WB `--sandbox container/E2B/CVM + --teleport + --sandbox-kill`**：整场会话跑进远端沙箱（Docker/E2B 云/CVM），可传送、可保活复用。级别：看到（--help）。现有 `tool-sandbox` 是"工具级拦截"，这是"会话级远程沙箱"，不同层。

## C. 多代理协作面（对现有 spawn-subagent/peer-message 的增补候选 ★★☆）

- **WB HTTP `/api/v1/team/messages/{send,read,unread}`**：团队消息有独立 HTTP 面（发送/已读/未读），不是聊天转发。级别：看到（bundle 路径表）。
- **WB `--swarm`**：teammates 以独立进程跑（tmux 可视化）。级别：看到。
- **WB `_codebuddy.ai/sideQuestion`**：/btw 侧问——fork 出侧问通道、不影响主会话（问答型，非派活型）。级别：看到（bundle handleSideQuestion）。ZCode/OC/HM 均无此原语。
- **Hermes `hosted_room_*` 18 表**：房间/策略/水位线/转写/远程运行的完整状态机（本机未启用）。级别：看到（表结构）。

## D. VCS 与工作树原语（建议登记或并入 checkpoints ★★☆）

- **OC HTTP `/vcs/{status,diff,diff/raw,apply}`**：把版本控制做成一等 HTTP 原语（能 apply 补丁）。级别：看到（/doc 162 路径）。
- **WB `--worktree(+branch,--tmux)` / Hermes `hermes worktree`**：git worktree 会话（审计与回收）。级别：看到。
- 现有 `checkpoints` 是"文件快照回退"，VCS 原语是"仓库操作"，不同层；也可并入 artifact 域。

## E. 低优候选（记录在案，暂不建议登记）

- **WB `/api/v1/storage(/ns/{ns}/{key})`**：宿主 KV 存储面（看到）。
- **WB `/api/v1/client/resources/{complete,presign}`**：资源补全与预签名上传（看到）。
- **OC `/api/integration*`（connect/oauth/attempt）**：集成连接与 OAuth 尝试（看到）。
- **OC `opencode pr <number>`**：拉 GitHub PR 分支直接干活（看到，--help）。
- **ZCode `session/requestRuntimePreferences`**：运行时偏好查询（看到，dist 字符串）。
- **WB `--channels plugin:*|server:*`**：插件通道选择装载（看到，--help）。

## 对照说明（新登记单元的直接验证）

本轮把以下原生面对到了 **10-20 新登的 13 个单元**，证明登记有效：OC `/tui/*` → `remote-control`（WB 对应 `--remote-control wecom|AgentOS`）；Hermes `moa` → `multi-model-compare`；WB `/api/v1/stats`、Hermes `insights` → `events-usage`；Hermes `hooks/approvals` → `hooks`；WB `mcp/plugin`、OC `mcp`、Hermes `mcp/plugins/skills` → `config`/`mount-tools`/`extensions`。


---

## F. Claude Code + 豆包增补（10-21 第二批普查，research-acp）

### 建议登记 ★★☆

- **Claude Code 后台会话族**：--bg/attach/logs/agents/respawn/stop|kill/rm 子命令族——比 WB 的更完整（respawn=带对话重启到新版本；stop 后对话保留可 attach）。对应 wake-bg 已有单元，建议把 Claude Code 的这套作为 wake-bg 判据样板。级别：看到（claude --help 本轮）。
- **Claude Code --system-prompt-snapshot on|off**：系统提示词每会话记录一次、压缩前逐请求复用——ctx-system 的落盘策略有了显式开关。级别：看到（--help 原文）。建议并入 instructions/ctx-system 判据。
- **Claude Code ~/.claude/workflows/ 目录**：工作流定义落盘目录（42 构件框架没装下——内建工作流面，ZCode dwf_* 同类）。建议与 ZCode dwf_* 一起入'内建工作流'类目。级别：看到（本轮 ls）。
- **Claude Code --prompt-suggestions**：预测下一句用户输入并下发 prompt_suggestion 消息——交互预见性能力，登记表外。级别：看到。
- **Claude Code --cloud/--environment/ultrareview**：云端托管会话与云端多代理代码评审——执行位置从本机扩展到云，框架的'宿主'概念需要能装'云端会话'。级别：看到。
- **豆包 账号级工具流广播**：同账号双实例时云端 SSE 工具调用流广播给两端，后台无沙箱实例抢先报错打崩前台（宿主卡 blocked_down 根因）——'会话账号绑定与实例互斥'是登记表外新概念，建议作为 external-protocol 或 ownership-lease 的约束条件登记。
- **豆包 PiP 虚拟桌面（pip_sdk.dll，RDP 127.0.0.2）**：computer-use 的第二层（不抢物理键鼠的 GUI 桌面）——computer-use 单元的判据可加'虚拟桌面层'分级。

### 对照说明

- Claude Code 官方无 ACP（四家 ACP 里的 Claude 是第三方适配器面）；其外部协议面 = CLI 参数 + stream-json + SDK query() + 企业 gateway 子命令。
- 豆包本轮纯静态：UI 命令面/设置面板/网络协议（除已知 SSE 广播）留待 CDP 恢复后补。
