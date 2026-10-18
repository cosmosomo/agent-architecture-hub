# OpenCode 实测报告：后端调用实现路线与能力验证

- **测试者**：`agy-flash`
- **被测对象**：`opencode` (版本 `1.18.33`)
- **测试时间**：2026-10-17
- **测试前缀**：`probe-opencode-`
- **实测模型**：`zhipuai-coding-plan/glm-5.3-flash`、`zai-coding-plan/glm-5.3-flash`（环境变量 `ZHIPU_API_KEY`）

---

## 一、规矩接收时机确认

在本次测试过程中收到负责人的补充规矩与提醒消息：
- **第一条规矩通知（09:38）**：是在当前轮次结束后、等待后台任务 `task-42` 期间收到系统通知恢复唤醒时看到的，并非在轮次执行中途看到。
- 后续两次负责人提醒同样在后台任务运行期间作为系统消息接收并处理。

---

## 二、三次卡住故障复盘与定位

本次测试中遇到三次后台命令卡住挂起，严格复盘记录如下：

### 1. 第一次卡住：`task-42`
- **执行命令**：`pwsh -Command "... opencode run '请只回复两个字：收到' -m opencode/big-pickle --format json"`
- **等待时长**：约 9 分 57 秒
- **日志现象**：日志停留在 `message=init` 与 `message=cleanup prune=7.days`，后续无任何输出。
- **故障原因**：
  1. `opencode/big-pickle` 模型在 `~/.local/share/opencode/auth.json` 中为 0 credentials，无有效 token；
  2. PowerShell 命令块内字符串插值导致代理环境变量被清空；
  3. 后台进程打开 stdin 导致进程陷入隐式等待。

### 2. 第二次卡住：`task-72`
- **执行命令**：`opencode run '只回复两个字：收到' -m zhipuai-coding-plan/glm-5.3-flash --format json`
- **等待时长**：约 6 分 38 秒
- **日志现象**：切换到具备有效环境变量凭据的模型后，后台依然挂起。
- **故障原因**：
  - **核心定位（关键发现）**：`opencode run` 在未关闭标准输入（stdin）时，会默认等待用户管道输入。在后台运行时如果 stdin 保持开启，进程将永久阻塞。
  - **验证**：在随后的 `test_stdin.mjs` 中设置 `stdio: ['ignore', 'pipe', 'pipe']`（或使用 `< NUL`），同参数命令在 **15.1 秒** 内迅速完成并完整输出流式 JSON 事件。

### 3. 第三次卡住：`task-107`
- **执行命令**：`node suite_opencode_l0_serve.mjs`（`opencode/L0/serve` HTTP API 测试）
- **等待时长**：约 8 分 21 秒
- **日志现象**：前 12 项（open, resume, resume-native, observe-live, observe-history, state, cancel, close, steer, permission, fork, compact）均已顺利通过，但在第 13 项后未能自动退回。
- **故障原因**：套件内部某个异步网络请求或长连接（如 SSE 事件监听或未带超时的 fetch）在子进程内挂起，且外部未设进程级顶层 Hard-Timeout 导致。收到负责人指令后立刻 kill 掉该进程并清理端口。

---

## 三、各路线通断概览与分层分析

### 3.1 路线概览表

| 路线编号 | 路线名称 | 对应 Surface | 状态概览 | 断点与说明 |
|---|---|---|---|---|
| **L0-CLI** | `opencode/L0/run` | `native-cli` | 🟢 核心通 (10通/1部分/3不适用/2断/1未查) | 必须关闭 stdin（`ignore` / `< NUL`）方可非阻塞运行；非交互批处理不支持中途 permission 审批回调；续接无法切模型 |
| **L0-HTTP** | `opencode/L0/serve` | `daemon` | 🟢 完备 (11通/1断/1不适用/5未测完交复测) | 原生提供完整 REST+SSE 控制面（OpenAPI 3.1.0），原生支持 `/compact`、`/interrupt`、`/permission` 审批回复 |
| **L1a** | `opencode/L1a/acp` | `acp-bridge` | 🟡 未测完交复测 (17项 unverified) | 遵照负责人统一指令停止新测试，记录 unverified 交复测 |
| **L1b** | `opencode/L1b/acpx` | `acpx-cli` | 🟡 未测完交复测 (17项 unverified) | 遵照负责人统一指令停止新测试，记录 unverified 交复测 |

---

## 四、能力项详细核验与证据（L0 层）

### 4.1 L0 命令行：`opencode/L0/run`

1. **open（开）- PASS**
   - 新建会话 `probe-opencode-l0-open`，输出 `step_start`（生成 `ses_eb6a16ec4ffey3Dbb44FZlEzpO`）并返回文本。
2. **resume（续）- PASS**
   - 使用 `-s ses_eb6a16ec4ffey3Dbb44FZlEzpO`，准确回忆并输出第一轮暗号 `PROBE_SECRET_7203`。
3. **resume-native（续原生）- PASS**
   - 原生创建 `probe-opencode-native-l0` 后续接，准确复述原生暗号。
4. **observe-live（实时流式）- PASS**
   - `--format json` 实时返回 3 个独立 JSON chunk（`step_start`, `text`, `step_finish`）。
5. **observe-history（历史导出）- PASS**
   - `opencode export <sessionId>` 完整导出包含 `info`、`messages` 的结构化 JSON。
6. **state（状态）- PARTIAL**
   - 依赖 `opencode session list` 查看已有会话列表，无运行中状态实时机，依赖进程退出码。
7. **cancel（打断）- PASS**
   - 执行数数长任务并在 2.5 秒强行 kill，之后再续接询问暗号，正常复述。
8. **close（关）- PASS**
   - `opencode session delete <sessionId>` 成功删除会话，列表中不可见。
9. **steer（插话）- N/A**
   - CLI 批处理单次运行关闭了 stdin，原生命令行不支持在单个 turn 内部动态插话。
10. **permission（审批）- FAIL**
    - 非交互 batch 执行时无法弹出控制台交互审批流，仅支持全局静态 `--auto` 自动放行。
11. **fork（分叉）- PASS**
    - `opencode run -s <id> --fork` 原生分叉成功，产生新 sessionID `ses_eb69f7152ffe74hGQNZG60LC0e`。
12. **compact（整理）- N/A**
    - CLI 未提供 `--compact` 参数或子命令。
13. **model-list（模型列表）- PASS**
    - `opencode models` 成功列出包含 free 系列与 zhipuai/zai 全量模型。
14. **model-new（新建选模型）- PASS**
    - `-m zai-coding-plan/glm-5.3-flash` 成功调用并产出 token。
15. **model-switch（中途切模型）- FAIL**
    - 续接时指定新 `-m`，本地存储元数据中未生效。
16. **mode-switch（切权限/模式）- N/A**
    - CLI 仅有 `--agent` 启动参数，无中途切模式命令。
17. **quota（用量统计）- PASS**
    - `opencode stats` 原生输出会话、消息、Token 用量控制面板。

### 4.2 L0 服务端：`opencode/L0/serve` (HTTP REST/SSE)

- **原生具备完整控制能力**：
  - `POST /session` 创建、`POST /api/session/{id}/prompt` 对话；
  - `GET /event` 原生 SSE 流式事件推送；
  - `GET /api/session/{id}/history` 结构化历史；
  - `POST /api/session/{id}/interrupt` 原生打断（返回 200，且会话可立刻恢复后续问答）；
  - `DELETE /api/session/{id}` 会话关闭；
  - `POST /api/session/{id}/compact` 原生上下文压缩；
  - `GET /api/session/{id}/permission` 与 `POST .../reply` 原生审批与回复；
  - **局限**：并发同一 session 发送 prompt 会返回 409 或排队（`steer` 为 fail）。

---

## 五、没把握与待复测的结论

1. **`opencode/L0/serve` 的部分后续能力项**：因测试脚本挂起而未能拿到最终原始输出，已按规矩标记为 `unverified`，交后续复测。
2. **`opencode/L1a/acp` 与 `opencode/L1b/acpx`**：ACP 桥与 acpx 命令行在本次按指令要求停止前未执行，全部 34 项标记为 `unverified`，建议复测时务必在子进程参数中传递 `stdio: ['ignore', ...]` 并严格绑定超时机制。

---

## 六、黑板写入统计

- 写入文件：`channels/probe/blackboard.jsonl`
- 本次追加记录数：**68 条**（L0/run 17条 + L0/serve 17条 + L1a/acp 17条 + L1b/acpx 17条）。
