# OpenCode · 会话考古（harness 普查）

2026-10-20 · research-acp · 全量普查，可复跑：`node channels/probe/scripts/harness/census_harness.mjs opencode` → `opencode-census.json`

## 关键信息

双轨并存：新库 `~/.local/share/opencode/opencode.db`（16,637 行，22 表，1.18.33）+ 旧文件制 `storage/{session,message,part,session_diff}/`（JSON 每件一条）。**同一台机器上两代格式同时可读**，版本差异的现成样本。

### opencode.db（新库）

| 表 | 行数 | 内容与归属 |
|---|---|---|
| **event** | 10,922 | **事件总线持久化**：message.part.updated 6,193 · message.updated 3,313 · session.updated 1,281 · session.created 108 · step/prompt/text/reasoning/agent-switched 生命周期事件全套（v1/v2 后缀代际）——可观测：外部客户端就是吃这张表 |
| message | 1,264 | data JSON（role 内嵌：user/assistant） |
| part | 4,142 | data JSON：**step-start 913 · step-finish 905 · text 853 · tool 810 · reasoning 593 · patch 66 · compaction 2** |
| **session_context_epoch** | 3 | **压缩世代**：`{session_id, baseline, snapshot, baseline_seq}`——压缩后把环境上下文整块作为 baseline 重注入（样本 baseline 以 "Here is some useful information about the environment…<env>Working directory…" 开头）。**"压缩后剩什么"的直接答案：env 块 + 快照** |
| session_input | 5 | **delivery=steer 5**——插话是一等投递类别（带 admitted_seq/promoted_seq） |
| session_message | 13 | user 5 / assistant 5 / **agent-switched 3**（模式/智能体切换事件） |
| todo | 5 | 计划 |
| permission | 0 | 权限规则表（审批决策不落盘） |
| project / project_directory / workspace / account / credential / session_share | 少量 | 项目/账号/分享组织层 |

### 旧文件制 storage/（JSON 每件一条）

- message/ 130 文件（assistant 109 / user 21）；part/ 542 文件（tool 160 · step-start 108 · reasoning 108 · step-finish 108 · text 58）；session/ 3 文件；session_diff/ 5 文件。
- 与 db 表的 type 分布同构，是同一 harness 的旧落盘格式；migration 表在 db 里（`data_migration`/`migration`）。

### harness 归属要点

- **上下文装配**：message+part（含 patch=补丁部件）；env 注入块在 context_epoch.baseline 里原文可读。
- **预算与压缩**：compaction part + session_context_epoch；token 记账在 part.usage（message.updated 事件里推）。
- **组织**：step-start/finish=主循环节拍；agent-switched=模式切换；session_input.delivery=steer=插话队列；todo=计划。
- **工具系统**：tool part 810（db）+160（文件），callID/调用与状态机。
- **会话外**：`~/.config/opencode/opencode.json`（mcp/model/provider/small_model，无 permission 键）；`~/.config/opencode/AGENTS.md` 不存在，全局说明走项目 AGENTS.md。

### 会话里看不到的

- provider 请求体（发给模型的原文）本机无 dump；压缩决策阈值；`question` 工具的 pending 题卡（内存态，见 acp.md——服务内存 Question.pending，不落盘）；wait 503 的内部状态。

依据：条数=脚本实测可复跑；epoch.baseline/steer/agent-switched=census sample 与 SQL 直查（本卷宗附样文）；格式语义参照 sst/opencode 开源仓（packages/opencode/src/session、storage 迁移代码）。
