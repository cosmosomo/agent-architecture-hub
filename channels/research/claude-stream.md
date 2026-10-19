# 卷宗：Claude stream-json

> 议题：stream-json 能给到的上限  
> 研究员：Claude（haiku）· research-claude  
> 最近更新：2026-10-19

---

## 关键信息

### 1. 合成报错消息（`<synthetic>` model） 【看到】
- **现象**：当上游 API 连接出错（如 ECONNRESET）时，Claude Code 会在流里插入一条 `assistant` 消息，其 `message.model === '<synthetic>'`，内容是错误文本（如 "API Error: Connection dropped (ECONNRESET)"）。
- **协议位置**：`assistant` 事件，`event.error` 或 `event.message.model === '<synthetic>'` 时触发。
- **关键陷阱**：即使出现了合成报错，**后续的 `result` 事件仍可能是 `subtype: "success"`**；中心必须把 `<synthetic>` 捕获为本轮失败的真相，不能只看 result 的 subtype。
- **驱动里的处理**：`claude_stream.ts:431-434` 在 handleStdoutLine 里把这类事件的文本存入 `turnApiError`，结算 result 时（447-452）若 `resultText === turnApiError` 则判定为 `failed`。
- **出处**：自测驱动代码 `trace/apps/cli/src/drivers/claude_stream.ts` 行 123-124、431-434、447-452；实测产物 `channels/probe/scripts/output/claude_stream_probe_20261018.json` 未复现（当时网络正常），但代码逻辑已防御。

### 2. 上下文压缩（auto-compact） 【看到+推测】
- **触发阈值**：剩余约 13,000 tokens 时自动触发（软着陆机制），预留 20,000 tokens 给摘要生成。
- **stream-json 表现**：**目前完全不可见**——CLI 在压缩期间（可达 3+ 分钟）彻底静默，**不下发任何事件**。
- **社区呼声**：GitHub Issue #48740 请求在压缩开始前发射 `compact_started` 事件，便于网关/编排层感知并给用户进度提示。
- **手动触发**：用户可在交互中输入 `/compact`；在 stream-json 里同样没有显式事件，只能靠后续 token 用量骤降侧写推断。
- **出处**：GitHub #48740、Ken Huang "Claude Code Pattern 6: Context Management at Scale"、Claude Code 官方最佳实践文档。

### 3. 子智能体在流里的形态 【看到】
- **调用方式**：主智能体通过 `Agent` 工具（tool_use name="Agent"）启动子智能体。
- **流式事件**：子智能体内部产生的消息在 stream-json 里**照常表现为 `assistant` / `user` 事件**，唯一区别是带有 `parent_tool_use_id` 字段（指向发起 Agent 工具调用的 tool_use_id）。
- **主会话消息**：`parent_tool_use_id === null`。
- **SDK 文档确认**：`parent_tool_use_id` 在 Python 里是 `None`、TS 里是 `null`；需通过完整消息对象的该字段归属子智能体。
- **出处**：Claude Code SDK 文档 "Subagents in the SDK"、"Stream responses in real-time"。

### 4. 已实测通过的能力单元（2026-10-18） 【试过】
| 单元 | 结论 | 关键参数/协议 |
|---|---|---|
| open | ✅ | `--session-id` + `initialize` control_request |
| send | ✅ | stdin 写 `{"type":"user",...}` → assistant 流 + result.success |
| resume (hot) | ✅ | 热进程直接投递，命中 prompt cache |
| steer | ❌ | 中途写入不干预当前轮，自动排队为次轮 |
| inject-next | ✅ | 轮内写入自动入队，首轮结束即启动次轮 |
| cancel | ✅ | `interrupt` control_request → error_during_execution，进程存活 |
| model-switch | ✅ | `set_model` control_request 热切 |
| permission | ✅ | `--permission-prompts host --permission-prompt-tool stdio` 双向挂起/答复 |
| fork | ✅ | `--resume <parent> --fork-session` 继承历史，独立落盘 |
| observe-live | ✅ | 44 条结构化事件（system.init, assistant, tool_use, control_request, result...） |
| observe-history | ✅ | `~/.claude/projects/<slug>/<sessionId>.jsonl` 物理归档 |

---

## 经验

1. **启动参数必须齐全**：
   ```
   claude -p --input-format stream-json --output-format stream-json --verbose \
     --model haiku --strict-mcp-config --setting-sources project,local \
     --permission-prompts host --permission-prompt-tool stdio
   ```
   - 缺 `--permission-prompts host` 则 `can_use_tool` 不会下发（agent-hub 遗留坑）。
   - `--setting-sources project,local` 必加，否则全局 `~/.claude/agents/*.md` 会污染首轮（HELLO_CHECK 反弹）。
   - `--verbose` 让 system.init 带上 `slash_commands` 数组，便于中心识别可用斜杠命令。

2. **握手差异**：
   - 新会话：启动后**必须先发 `initialize` control_request**，收到 success 才能提交 prompt。
   - Fork/Resume 会话：**直接写第一条 user 消息**；服务端会在首条输入后推送带新 `session_id` 的 `system.init`。

3. **inject-next ≠ steer**：
   - 中途塞指令只能排队成次轮，不能像 Codex 那样原地改向。中心若想“打断并重写”，只能 `interrupt` 后再 `submit` 新指令。

4. **审批双向通道**：
   - 服务端下发 `control_request {subtype:"can_use_tool", tool_name:"Write", ...}` → 驱动回传 `control_response {behavior:"allow"}` → 物理落盘 → 下一条 assistant 汇报完成。
   - `autoApprove: false` 时必须在驱动层实现 `onApprovalRequest` 回调（同步或异步均可）。

5. **磁盘历史是地毯**：
   - `~/.claude/projects/<project-slug>/<sessionId>.jsonl` 完整记录每轮快照与 token 统计，冷恢复、审计、跨进程水合全靠它。

---

## 还没解决的

1. **压缩不可见**：stream-json 无 `compact_started` / `compact_finished` 事件；中心无法实时感知、也无法向前端推进度。  
   → 下一步：关注 #48740 进展；或在驱动层用“长时间无事件 + token 用量骤降”启发式检测。

2. **合成报错的边界**：
   - 只有网络层错误会合成？模型侧拒绝（refusal）、策略拦截是否也走 `<synthetic>`？  
   → 下一步：人为制造各类上游故障（断网、429、400、policy violation）观测流里形态。

3. **子智能体多层嵌套**：
   - 子智能体里再 spawn 子智能体，`parent_tool_use_id` 链怎么串？是否只指向直接父工具？  
   → 下一步：编写探针让主智能体连续调用 2~3 层 Agent 工具，抓取完整事件流对账。

4. **大上下文下的流式性能**：
   - 100k+ tokens 会话里，`assistant` 增量事件数量级、内存占用、解析延迟未测。  
   → 下一步：构造长会话（注入大量文件/历史），压测驱动吞吐与内存。

5. **多会话并发池化**：
   - 当前驱动 `ClaudeStreamDriver.sessions` 是 Map，未做空闲回收、最大并发限制、冷热分级。
   → 下一步：在 gateway.ts 对接时补齐连接池策略（LRU、TTL、预热）。

6. **本轮边界推进未获得 Claude 运行证据**：本轮实际运行的是 Codex app-server 的 goal 元数据持久化探针；没有启动 Claude CLI/stream-json 进程或模型轮，因此不把 Codex 的跨重启结果外推给 Claude。网络研究入口 `search_hub.js` 返回 `All AnySearch keys failed`。下一步仍按 Claude 边界清单先挑 `inject-next` 或 goal/预算相关格，联网资料可用后做真实 stream-json 输入、同轮结束/次轮续跑及预算停止验证。**试过**：本轮搜索命令结果；**看到**：[Codex 边界清单](briefs/codex-边界.md)。

---

## 出处

### 本仓库报告
- `channels/probe/results/claude-stream-driver-20261018.md` —— 全能力实测报告（含代码、黑板行号、落盘路径）
- `channels/probe/scripts/probe_claude_stream.mjs` —— 完整闭环探针脚本
- `channels/probe/scripts/output/claude_stream_probe_20261018.json` —— 原始实测产物
- `channels/probe/blackboard.jsonl` 行 1797～1807 —— 10 项能力真实上链
- `trace/apps/cli/src/drivers/claude_stream.ts` —— 常驻驱动源码（616 行，原生 TS ESM）

### 外部链接
- GitHub Issue #48740: `Emit compact_started event in stream-json output before compaction begins`
- Ken Huang: "Claude Code Pattern 6: Context Management at Scale" (Substack)
- Claude Code 官方文档: "Subagents in the SDK", "Stream responses in real-time", "Best practices for Claude Code"
- GitHub Issue #24612: `Document all message types emitted by claude -p --output-format stream-json`

---

> 本卷宗由 research-claude 维护，后续每轮交回前更新。新结论写在前面，被推翻的旧结论划掉并注明推翻证据。
