# 分层实测：后端调用各家智能体的实现路线

被委托的研究员先通读本文，再开始。本文是任务定义，不是操作手册：方法、工具、顺序由你自己定；你觉得任务定义有问题，可以在报告里反驳。

---

## 一、用户原话（逐字，不改写）

> 「如果这个项目用不了，就直接从后端方式去调用啊，你的职责是研究清楚acp和后端调用不同agent生态的实现路线啊」

> 「可以委托agent去实测多项基本能力对吧，比如用antigravity的flash模型或者用zcode，然后层层测试，多agent测试，然后给你报告，或者写到黑板里，从最后端的各家端口测试到适配器测试到前端测试，分层测试，跑一跑你才知道现状，不是吗」

> 范围（用户写给上一个智能体的原话摘录）：「然后有一个关键区分点，就是不同的平台的agent之间也是不等价的，比如codex原生对话（人打开的页面），以及subagent和app-server的不一定等价，功能也不同，也需要细致区分。然后就是渠道能不能切换模型之类的能力矩阵，也是值得研究的东西，这些在我们的系统都不够确定，不够低熵。然后我指的范围主要是页面的对话模块，从对话到后台agentsession识别，状态识别，到acp协议，就是控制台到不同agent生态的完整系统。」

## 二、要回答的问题

对本机的每一家智能体、每一条调用路线、每一项基本能力：**现在实际能不能做到？在什么条件下？断在哪一层？为什么？**

---

## 三、负责人的理解（Claude，可以推翻）

### 3.1 分层

从最底层往上测，哪一层断了就停在哪一层说清楚，这样故障能定位到层：

| 层 | 测什么 | 例子 |
|---|---|---|
| **L0 原生后端** | 不经过任何适配器，直接用各家自己的命令行、守护进程或端口 | `codex exec` / `codex app-server`、`claude -p` / stream-json、`zcode app-server --stdio`、`opencode serve` / `run`、Antigravity 的 `language_server.exe agentapi` 与 Connect-RPC |
| **L1a ACP 桥直连** | 不经过 acpx，直接用 ACP SDK 对各家的 ACP 桥讲协议：先看 `initialize`、`session/new` 返回里**自己声明**了什么，再逐项调用验证 | SDK 在 `%APPDATA%\npm\node_modules\acpx\node_modules\@agentclientprotocol\sdk`（1.8.0）；各桥的启动命令见 `~/.acpx/config.json` 与 acpx 内置注册表 `acpx\dist\agent-registry-*.js` |
| **L1b acpx 命令行** | 经 `acpx <agent> ...` 调用 | `acpx --format json zcode -s probe-x "..."`、`status`、`cancel`、`set-mode`、`set-model` |
| **L2 我们的网关** | `hub/tools/agent_gateway.js` 的独立路径，以及统一服务（`npm start`）的 `/api/gateway/*` | 见 `trace/apps/cli/src/server.ts`、`gateway.ts` |
| **L3 前端** | `/console/` 和首页对话抽屉里的每个控件，点下去后端是否真的发生了对应的事 | `console/console.js`、`hub/js/obs/chat.js` |

### 3.2 基本能力（每一项都要单独给结论）

出处：设计文档《核心抽象》§2.7（必备：新建会话、恢复会话、观察、打断、关闭会话；可选：插话、答复审批、分叉、压缩上下文；渠道级：查额度）。用户特别点名的：同一家不同入口不等价、能不能切模型。

| 编号 | 能力 | 要弄清的 |
|---|---|---|
| open | 新建会话 | 新建会话并完成一轮 |
| resume | 续（自己开的会话） | 第二轮还记得第一轮 |
| resume-native | 接管原生会话 | 人在桌面端或原生命令行开的会话，能不能从后端续上；会话锁怎么表现 |
| observe-live | 观察·实时 | 一轮进行中能不能看到流式文本、工具调用、用量 |
| observe-history | 观察·历史 | 能不能读回一个会话的完整记录 |
| state | 状态识别 | 能不能可靠区分：工作中、等回应、待命（可恢复/被锁）、出错、已关 |
| cancel | 打断 | 一轮进行中打断，会话还在、还能恢复 |
| close | 关闭会话 | 关闭会话 |
| steer | 插话 | 一轮进行中加一句话，本轮内生效（区别于排队到下一轮） |
| permission | 答复审批 | 工具调用要审批时，调用方能不能**在中途**收到请求并答复 |
| fork | 分叉 | 原生分叉，不是复制文字新开 |
| compact | 压缩上下文 | 压缩上下文 |
| model-list | 列模型 | 能拿到真实可用的模型列表 |
| model-new | 新建时选模型 | |
| model-switch | 中途切模型 | 切完下一轮真的换了（看回复里的模型或用量记录，不是看配置文件） |
| mode-switch | 切权限/模式 | |
| quota | 查额度 | |
| wake-bg | 后台任务唤醒 | 智能体把一件慢事放到后台、先让出，事情结束后被自动叫醒，带着结果接着做（不靠轮询） |
| wake-timer | 定时唤醒 | 智能体约一个时间或周期，到点被叫醒 |
| wake-msg | 消息唤醒 | 外部（中心、别的智能体、人）发来的消息能唤醒让出中或待命的会话 |
| wait-visible | 等待可见 | 外部能看出它正在让出，以及在等什么 |
| wake-stall | 卡住可发现 | 等的东西迟迟不来时，有超时或能被外部发现，不会永远挂着 |
| wake-persist | 唤醒能否撑过重启 | 保管等待的那一方（宿主应用、守护进程、中枢）重启或关掉后，约好的唤醒还在不在 |

唤醒这一组的来由与思考见 `channels/README.md`“唤醒”一节。

### 3.3 同一家不同入口（surface）

同一家的不同入口要分开记：人打开的桌面端/终端会话、子智能体、原生守护进程（如 codex app-server）、ACP 桥包出来的会话。黑板里用 `surface` 字段区分。

---

## 四、已知

### 4.1 各家与系统里的适配代码

见 `channels/README.md`“链路”一节（表格与接入要点都已并入那里）。

### 4.2 已实测过的
- acpx 下 codex、claude、zcode、workbuddy、opencode 的新建、恢复命名会话、`status`、`cancel`（`channels/GATEWAY.md` 第三节 T02～T08，2026-10-14）。
- Antigravity 2.23.1：`agentapi` 新建（需 `ANTIGRAVITY_PROJECT_ID`）、恢复、工具调用后等最终回复（`channels/hosts/antigravity.md` 第四、五节，2026-10-17）。

### 4.3 只是声明、要当假设去验证的
- `channels/GATEWAY.md` 第四节：我们的原语到 ACP 方法的对照表。
- `HANDOFF.md` 第五、六节：各家不同入口的差异表、能力矩阵。
- `channels/hosts/*.md`、`channels/hosts/codex/*.md` 里的能力声明。

## 五、还不知道的
- 各家 ACP 桥自己声明的能力（`loadSession`、`session/fork`、modes、models 等）和实际行为是否一致。
- 中途审批、插话、中途切模型、接管原生会话，在哪几家哪几条路线上是真的通。
- 状态识别（尤其“被人占用/锁定”“桌面关了但库里还写着运行中”）每家用什么判据才可靠。
- 我们的网关和前端，哪些控件背后是真动作，哪些是假闭环。

## 六、怎样算做成
- 每个格子都有一条黑板记录，记录里有**真实调用的命令和证据**（返回片段、会话编号、日志行）。
- 结论分四种：通、断、部分通、不适用。断和部分通要写**断在哪一层、什么条件下、原因**；查不出原因就写“原因未知”，不要猜成事实。
- 验收走真实路径：比如“续上了”要以第二轮回复确实引用了第一轮内容为准；“切了模型”要以下一轮实际用的模型为准。脚本自己打印的“成功”只算中间证据。
- 通的和不通的同样要记，方法和条件写清楚，以后可以复现。

---

## 七、黑板（结果怎么写）

- **结构化记录**：往 `channels/probe/blackboard.jsonl` **追加**，一行一条 JSON，不改别人的行。字段：

```json
{"at":"2026-10-17T18:00:00+08:00","by":"<你是谁，例如 antigravity-flash/probe-lead-zcode>","family":"zcode","layer":"L0|L1a|L1b|L2|L3","route":"<具体路线，例如 zcode app-server --stdio>","surface":"<入口，例如 acp-bridge / native-desktop / native-cli / daemon / subagent>","capability":"<第 3.2 节的编号>","result":"pass|fail|partial|n/a","condition":"<在什么条件下>","evidence":"<证据片段>","cmd":"<可复现的命令或脚本路径>","note":"<原因、疑点>"}
```

- **`route` 用统一编号**：`<家>/<层>/<入口>`，例如 `codex/L0/app-server`、`codex/L1a/codex-acp`、`codex/L1b/acpx`。规则和更多例子见 `channels/README.md` 附录“黑板里的路线编号”。
- **L2、L3 的记录**：route 写 `<家>/L2/server-api`、`<家>/L2/agent_gateway`、`<家>/L3/console`、`<家>/L3/chat-drawer`；另加两个字段：`calls`（这一步实际调到了哪条下层路线，例如 `codex/L1b/acpx`）、`verdict`（`接通`＝下层能做且确实做了；`没接上`＝下层能做但这里没用；`假闭环`＝这里声称能做但实际没发生或下层做不到；`接错路`＝做了，但走了不该走的路线）。L3 再加 `control`（控件的 id 或文字）。
- 架构（各层、各家、各入口、我们的代码位置）以 `channels/README.md` 为准。
- **叙述报告**：写到 `channels/probe/results/<你的名字>-<范围>.md`：做了什么、发现了什么、哪些结论没把握、对任务定义的反驳。
- 写的测试脚本放 `channels/probe/scripts/`。

## 八、规矩
- **不改**仓库里已有的代码，不做 git 操作，不改全局配置（`~/.acpx/config.json`、`~/.claude/settings.json`、`~/.codex/config.toml` 等），不安装、不升级包。需要的话记下来交回。
- **不杀、不重启**用户的桌面应用（Antigravity、ZCode、WorkBuddy、Codex 桌面端、Claude Desktop 等）。
- **不往人正在用的会话里发消息。**要测“接管原生会话”，先自己用原生方式开一个会话再测。
- **【红线 · 2026-10-18 事故补记】严禁向任何 `.jsonl` 写入 UTF-8 BOM（`0xEF 0xBB 0xBF` / `\uFEFF`）**：
  - 无论是往 `channels/probe/blackboard.jsonl` 追加记录，还是在 `~/.claude/projects/` 下执行冷文件分叉（Cold Fork）复制/替换会话 `.jsonl`，**绝对禁止使用 Windows PowerShell 5.1 的 `Set-Content -Encoding UTF8` 或 `Out-File -Encoding UTF8`**（PowerShell 5.1 的 `UTF8` 默认携带 3 字节 BOM `EF BB BF`）。
  - 2026-10-18 实测事故：`agy-fact-claude` 在 `probe-claude-fact` 构造 `b0000000-0000-4000-8000-000000000001.jsonl` 与 `c0000000-0000-4000-8000-000000000002.jsonl` 时带入 UTF-8 BOM，直接导致下游 `ClaudeDesktopContinuity` 扫描 `~/.claude/projects` 首行 JSON 时抛出 `无效的 JSON 基元: 。` 崩溃。
  - **正确写法**：Python 必须使用 `encoding="utf-8"`（写入无 BOM）和 `encoding="utf-8-sig"`（读取自动剥离 BOM）；Node.js 使用 `"utf8"`；PowerShell 必须使用 `[System.IO.File]::WriteAllText($p, $s, (New-Object System.Text.UTF8Encoding($false)))`。
- **【红线 · 2026-10-18 事故补记】探针测试完毕必须清理 `~/.claude/projects/` 下的合成会话残留**：
  - 凡在探针测试中手动伪造的合成 UUID 会话文件（如 `b0000000-...`、`c0000000-...`）或一次性探测会话，在拿到实测证据并写入黑板后，**必须立即删除对应的测试 `.jsonl` 文件**（或清理 `hub-workspaces/probe-*` 映射目录），严禁长期遗留在 `~/.claude/projects/` 中污染用户的 Claude Desktop 会话列表与跨号迁移工具。
- **每条命令、每个脚本都要有超时**（建议 90 秒；脚本里先把已得到的结果写盘再等下一步）。守护进程类命令（`codex app-server`、`opencode serve` 等）不要当普通命令放后台等它结束，要在脚本里自己起、用完自己关。`opencode run` 在后台可能等标准输入，关掉标准输入再跑（2026-10-17 两位测试员因此各卡住 30 分钟）。
- 测试会话名一律以 `probe-` 开头。
- 省钱：被测的一方用它最便宜的模型，提示词一句话。**Claude 只用 haiku，不用 sonnet 和 opus**（用户 2026-10-17）。
- 命令行联网走代理 `http://127.0.0.1:7892`。
- 最终回复不超过 30 行：做了什么、通断概览、黑板写了多少条、需要负责人判断的事。
