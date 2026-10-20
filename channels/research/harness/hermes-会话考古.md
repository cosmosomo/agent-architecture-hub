# Hermes · 会话考古（harness 普查）

2026-10-20 · research-acp · 全量普查，可复跑：`node channels/probe/scripts/harness/census_harness.mjs hermes` → `hermes-census.json`

## 关键信息

主库 `~/AppData/Local/hermes/state.db`（1,713 行，40 表）+ `sessions/`（22 个失败请求转储）+ 记忆五件套。开源仓 NousResearch/hermes-agent（本机安装 0.21.x），表语义可直接对源码。

### 转录与装配

- **messages 1,359**：assistant 618 / tool 524 / user 217（role 列），带 `messages_fts` 全文索引（trigram）——检索内建。
- **system_prompts 68 行**：**装配后的系统提示词整篇落盘**——四家里唯一把"发给模型的系统提示词"存下来的。上下文装配研究的一手材料（含 skills/memory 注入结果；用样本时注意脱敏）。
- **sessions/request_dump_*.json 22 个**：失败请求转储 `{timestamp, session_id, reason, request{method,url,headers,body}, error}`，reason = max_retries_exhausted 14 / non_retryable_client_error 8。**request.body 就是发给模型的完整消息序列**——上下文装配的最直接证据，但 headers 含凭证，引用前必须脱敏。

### sessions 表：60+ 列，一张表就是一份 harness 要素清单

| 要素族 | 列 |
|---|---|
| 预算 | input/output/cache_read/cache_write/reasoning_tokens、api_call_count、message_count/tool_call_count、estimated/actual_cost_usd、cost_status/source、**pricing_version** |
| **压缩** | compression_failure_cooldown_until、compression_failure_error、compression_fallback_streak、compression_ineffective_count、compression_recovery_deadline |
| 组织 | parent_session_id（子代理）、session_key/chat_id/chat_type/thread_id/display_name/origin_json（多平台房间）、profile_name、pinned/hidden/last_read_at |
| 交接 | handoff_state / handoff_platform / handoff_error |
| git 代际 | git_branch / git_repo_root / git_metadata_generation |
| 可观测 | end_reason、rewind_count、last_activity_description/provenance、title_source、tool_names |

### 组织/多智能体表（多数 0 行——机制在、本机未用）

- 有数据：session_turn_leases 1（轮租约 holder=pid:turn:platform）、async_delegations 1（异步子代理批次含每子结果/用量）、session_model_usage 181（按模型记账）、gateway_heartbeats、hosted_room_events。
- 全 0 但表结构完整：compression_locks、delivery_obligations、gateway_routing、conversation_generations（分叉世系）、hosted_room_* 18 张（房间/策略/水位线/转写/远程运行——多智能体房间的全套状态机）。

### 记忆与状态（会话之外）

- `memories/MEMORY.md + USER.md`（各带 .lock——锁文件即"中心写入权"的证据）；`SOUL.md`；`config.yaml`（provider/模型/压缩阈值）。
- 旁库：kanban.db（8 行任务板）、shared-state.db、projects.db（0）、`state-snapshots/`、`cron/`（jobs.json 定时唤醒）、`checkpoints/`、`pending_messages/`、`spawn-ledger.json`。

### 会话里看不到的

- 压缩决策的实时过程（sessions 表只留结果列：失败冷却/无效计数）；clarify 题卡 pending 态（内存，tools/clarify_gateway 的 `_entries`）；工具 schema 全集（state.db 不存，重 derivation 自 toolsets）；正常请求体（只有失败才 dump）。

依据：条数=脚本实测可复跑；sessions 列语义与源码对应（`hermes_cli/session_store`、`gateway/run_turn_runner.py`，本机安装 0.21.x 与上游 master 大体一致）；hosted_room_* 全 0 判"机制在未用"=表结构直读 + 本机 platforms:{}。
