# WorkBuddy · 会话考古（harness 普查）

2026-10-20 · research-acp · 全量普查，可复跑：`node channels/probe/scripts/harness/census_harness.mjs workbuddy` → `workbuddy-census.json`

## 关键信息

存储是**双轨**：转录在 `~/.workbuddy/projects/<转义cwd>/<会话名>.jsonl`（166 文件、11,906 行，claude-code 血统）；元数据/自动化在 `~/.workbuddy/workbuddy.db`（451 行，11 表）。版本 2.168.2（CBC 系）。

### 转录 JSONL（11,906 行，按 type 全量计数）

| type | 条数 | harness 归属与时机 |
|---|---|---|
| function_call / function_call_result | 3,277 / 3,250 | 工具系统：调用与结果成对落盘 |
| reasoning | 1,872 | 推理流（思考文本单独记） |
| message | 1,591 | 用户/助手消息（role 在行内） |
| **file-history-snapshot** | 1,082 | 检查点：每次文件改动前后的文件历史快照（回退的底座） |
| session-meta | 403 | 会话元数据头，含 `_meta["codebuddy.ai/hostKind"]`（如 unopted）等来源标注 |
| **credit-usage** | 251 | 预算：额度消耗记账（条级） |
| **summary** | 93 | 压缩摘要：`{summary, providerData:{source:"initial-user-message"}}` 等——压缩后以 summary 形式回填 |
| **ai-title** | 86 | 自动起标题（记忆/组织） |
| model-usage | 1 | 按模型用量 |

### workbuddy.db（元数据库，11 表）

- **sessions 143**：会话登记（含 permission_mode——切模式落库处）。
- **session_usage 142**：上下文占用（session_id, used, size）——预算。
- **automations 1 / automation_runs 121 / automation_runtime_state 1 / automation_delivery_outbox**：定时唤醒与派发队列全套（cron→run→outbox）。
- **buddy_snapshots**：快照库（样本里是整棵技能树的快照，含 SKILL.md/引用文件）——检查点的重装形态。
- **workspace_trust_decisions 4 / workspaces 5**：工作区信任边界（守卫的一种）。
- `~/.workbuddy/sessions/<pid>.json`（2 个）：**进程注册表** `{pid, sessionId, cwd, kind:"interactive", lastHeartbeat}`——所有权识别的依据，不是转录。
- audit-log：8 文件 124 行（审计流水）。

### 记忆系统（会话之外）

五件套常驻：`MEMORY.md`(631B) / `USER.md`(579B) / `SOUL.md`(1,792B) / `IDENTITY.md`(557B) / `BOOTSTRAP.md`(1,089B)，外加按 agent 的 `memory/<agentId>_memory.md`（带 .bak 备份）。10-20 实测：注入的"静默暗号"会被这套自动记忆当事实主动写盘（记忆写入走审批帧）。

### 会话里看不到的

- 系统提示词/技能清单拼装；AskUserQuestion 的实际 UI 帧（协议在 bundle 里，见 acp.md）；`$.ui.ask` 等 mods 绑定的运行时状态；压缩触发的启发式参数（只看到 summary 结果，看不到决策依据）。

依据：全部条数=普查脚本实测可复跑；JSONL 各 type 语义=样本直读（session-meta/summary/credit-usage 字段见 census.json sample）+ 与 Claude Code 公开格式的同源性（claude-import 文件互证）；hostKind 等取值含义为暂定。
