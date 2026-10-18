# Claude 复测报告：5 格能力矩阵原始证据闭环与断点分析

**测试员**: agy-pro-claude2  
**测试任务**: 针对此前因上游中转余额不足（403 credit_limit_reached / 智能路由预留额度失败）导致证据不足或中断的 Claude 5 个格子（3 个原始待复测项 + 2 个顺带复测项），在用户充值后逐一实测，获取真实第一手原始证据，完成确证闭环或明确断点判据。  
**前置验证**:
- 已首先进行单词最小调用 `claude -p --model haiku "ping, answer one word"` 验证，上游 yinzi 渠道（`https://api.yinziapi.top`）返回正常（code 0, stdout: "Pong"），确认 403 阻断已完全解除。
- 测试全程遵守调用上限（≤30次）与模型约束（仅使用 haiku / sonnet，绝不用 opus）。

---

## 一、复测结论总览表

| 序号 | 路线 (`route`) | 表面 (`surface`) | 能力 (`capability`) | 原行号 | 新行号 | 新结论 | 关键原始证据与判据 |
|:---:|---|---|---|:---:|:---:|:---:|---|
| 1 | `claude/L0/claude-cli` | `native-cli` | `steer` | 678 | 739 | **fail** | `claude -p stream-json` 中途管道输入第 2 个 user 消息；第 1 轮完整输出 1~30（`result_index: 0`），第 2 条消息被作为下一轮顺序排队执行（`result_index: 1`, 输出 `"STEER_TRIGGERED"`），无法在当前轮进行中插话生效。原始数据：`channels/probe/scripts/retest/output/claude_l0_steer_raw.json` |
| 2 | `claude/L1a/claude-agent-acp` | `acp-bridge` | `steer` | 680 | 740 | **fail** | 在首个 `session/prompt` 运行中途发送并发的第二个 `session/prompt`，ACP 桥直接返回 JSON-RPC 报错 `{"code":-32603,"message":"Failed to process request: Claude is already running. Wait for completion or send cancel request first."}`，首轮正常输出未受打断。原始数据：`channels/probe/scripts/retest/output/claude_l1a_steer_raw.json` |
| 3 | `claude/L1a/claude-agent-acp` | `acp-bridge` | `resume-native` | 686 | 741 | **pass** | 原生 CLI `claude -p --session-id <uuid>` 创建会话并存入暗号 `PROBE_NATIVE_SECRET_9824`（会话落盘为 `013af44f-1769-43ea-a6ad-41946f0a7f35.jsonl`）；ACP 桥 `loadSession` 成功加载，提问“刚才我们设定的秘密暗号是什么？只回复暗号本身”，模型返回 `[{"text":"PROBE_NATIVE_SECRET_9824","type":"text"}]`，问出暗号。原始数据：`channels/probe/scripts/retest/output/claude_l1a_resume_native_raw.json` |
| 4 | `claude/L1a/claude-agent-acp` | `acp-bridge` | `permission` | 687 | 742 | **pass** | 会话通过 `setSessionMode` 切换至 `default`（Manual）模式并触发 `Write` 工具；客户端在运行中途收到 `session/request_permission` 原文（包含 toolCallId `toolu_01DgtQ6hKPnLoFyWAwB9dCCH`、Write 文件路径及 options `allow-once`/`reject`）；客户端回复 `{ outcome: { outcome: "selected", optionId: "allow-once" } }` 后，文件 `perm_verify_created.txt` 成功创建并写入内容 `PERMISSION_APPROVED_TOKEN_7731`。原始数据：`channels/probe/scripts/retest/output/claude_l1a_permission_raw.json` |
| 5 | `claude/L1b/acpx` | `acpx` | `model-new` | 688 | 743 | **pass** | 使用 `acpx --format json --model <haiku\|sonnet> claude exec` 选模型新建执行；haiku 轮次返回元数据 `usage_update._meta._claude/model: "claude-haiku-5-5"` 且 quota `model_usage: [{"model":"claude-haiku-5-5"}]`；sonnet 轮次返回元数据 `usage_update._meta._claude/model: "claude-sonnet-5-5"` 且 quota `model_usage: [{"model":"claude-sonnet-5-5"}]`。原始数据：`channels/probe/scripts/retest/output/claude_l1b_model_new_raw.json` |

---

## 二、逐格详细复测证据与断点分析

### 1. `claude/L0/claude-cli` · `steer`
- **对应黑板行号**: 739（原行 678）
- **复测脚本**: `channels/probe/scripts/retest/test_claude_l0_steer.mjs`
- **原始证据位置**: `channels/probe/scripts/retest/output/claude_l0_steer_raw.json`
- **测试过程**:
  使用 `claude -p --model haiku --input-format stream-json --output-format stream-json`。向 stdin 管道首先写入要求从 1 数到 30 的长输出任务；在模型正在输出时，向 stdin 写入插话指令：`"紧急插话：别数了，立刻停止，只输出 STEER_TRIGGERED"`。
- **原始返回截取**:
  ```json
  [
    {
      "type": "result",
      "subtype": "success",
      "result_index": 0,
      "result": "1\n2\n3\n4\n5\n6\n7\n8\n9\n10\n11\n12\n13\n14\n15\n16\n17\n18\n19\n20\n21\n22\n23\n24\n25\n26\n27\n28\n29\n30"
    },
    {
      "type": "result",
      "subtype": "success",
      "result_index": 1,
      "result": "STEER_TRIGGERED"
    }
  ]
  ```
- **结论与断点**: **fail**。Claude CLI -p stream-json 采用队列化串行模型执行管道中的 user 消息，第 1 条消息独立完整生成完所有 30 个数字（`result_index: 0`），第 2 条消息作为新的一轮顺序排队执行（`result_index: 1`），无法在一轮进行中插话打断当前轮。

---

### 2. `claude/L1a/claude-agent-acp` · `steer`
- **对应黑板行号**: 740（原行 680）
- **复测脚本**: `channels/probe/scripts/retest/test_claude_l1a_steer.mjs`
- **原始证据位置**: `channels/probe/scripts/retest/output/claude_l1a_steer_raw.json`
- **测试过程**:
  启动 `claude-agent-acp` 桥并创建新会话，先发送长任务 `session/prompt`，在首个 prompt 处于 running 状态时（未收到 response），向同一个 sessionId 并发发送第二个 prompt（尝试进行插话）。
- **原始返回截取**:
  ```json
  {
    "steerError": {
      "message": "Failed to process request: Claude is already running. Wait for completion or send cancel request first.",
      "code": -32603,
      "name": "RequestError"
    },
    "prompt1Res": {
      "stopReason": "end_turn"
    }
  }
  ```
- **结论与断点**: **fail**。ACP 桥协议层通过互斥检查显式拒绝并发 prompt，直接返回 JSON-RPC 内部错误码 `-32603`，要求等待当前轮完成或显式下发 cancel。协议未开放轮内插话管道，能力断在 ACP 协议层。

---

### 3. `claude/L1a/claude-agent-acp` · `resume-native`
- **对应黑板行号**: 741（原行 686）
- **复测脚本**: `channels/probe/scripts/retest/test_claude_l1a_resume_native_fixed.mjs`
- **原始证据位置**: `channels/probe/scripts/retest/output/claude_l1a_resume_native_raw.json`
- **测试过程**:
  1. 通过原生 CLI 创建独立会话：`claude -p --session-id 013af44f-1769-43ea-a6ad-41946f0a7f35 "你好，请牢记我们的秘密暗号是 PROBE_NATIVE_SECRET_9824，并且只回复：暗号已牢记" < nul`。会话文件成功写入 `~/.claude/projects/E--program-GIT-Agent-multi-Agent-Architecture-Hub/013af44f-1769-43ea-a6ad-41946f0a7f35.jsonl`；
  2. 启动 `claude-agent-acp`，调用 `loadSession({ sessionId: "013af44f-1769-43ea-a6ad-41946f0a7f35", cwd: CWD })`；
  3. 在同一个 connection 上发送 prompt：“刚才我们设定的秘密暗号是什么？只回复暗号本身，不要任何其他文字。”
- **原始返回截取**:
  磁盘会话文件 `013af44f-1769-43ea-a6ad-41946f0a7f35.jsonl`:
  ```json
  Line 2: {"type":"user","message":{"role":"user","content":"你好，请牢记我们的秘密暗号是 PROBE_NATIVE_SECRET_9824，并且只回复：暗号已牢记"}}
  Line 25: {"type":"user","message":{"role":"user","content":[{"type":"text","text":"刚才我们设定的秘密暗号是什么？只回复暗号本身，不要任何其他文字。"}]}}
  Line 29: {"type":"assistant","message":{"role":"assistant","content":[{"text":"PROBE_NATIVE_SECRET_9824","type":"text"}]}}
  ```
  `claude_l1a_resume_native_raw.json`:
  ```json
  {
    "sessionId": "013af44f-1769-43ea-a6ad-41946f0a7f35",
    "secretCode": "PROBE_NATIVE_SECRET_9824",
    "sessionFileExists": true,
    "loadSessionSessionId": "013af44f-1769-43ea-a6ad-41946f0a7f35",
    "promptStopReason": "end_turn",
    "fullAnswerText": "The script executed successfully and printed `HELLO_CHECK`.PROBE_NATIVE_SECRET_9824",
    "secretFound": true,
    "pass": true
  }
  ```
- **结论**: **pass**。ACP 桥的 `loadSession` 能够直接复用原生 CLI 落盘的会话状态，且模型在后续轮次准确记忆并说出前序原生轮设定的暗号。

---

### 4. `claude/L1a/claude-agent-acp` · `permission`
- **对应黑板行号**: 742（原行 687）
- **复测脚本**: `channels/probe/scripts/retest/test_claude_l1a_permission_write.mjs`
- **原始证据位置**: `channels/probe/scripts/retest/output/claude_l1a_permission_raw.json`
- **测试过程**:
  1. 通过 ACP 桥新建会话，调用 `setSessionMode({ sessionId, modeId: "default" })` 切换到 Manual 模式（覆盖全局 settings.json 中的 bypassPermissions）；
  2. 触发破坏性操作：要求模型使用 `Write` 工具写入测试文件 `perm_verify_created.txt`；
  3. 客户端在轮次中途拦截到 `session/request_permission`，打印请求入参原文；
  4. 客户端按 ACP 规范返回 `{ outcome: { outcome: "selected", optionId: "allow-once" } }` 进行批准；
  5. 检查答复后目标文件是否生成且写入预期内容。
- **原始返回截取**:
  ```json
  {
    "sessionId": "a8d3cdff-ea5d-4548-838d-c11a5cf1e2a3",
    "setMode": "default",
    "permissionRequestsCount": 1,
    "permissionRequests": [
      {
        "sessionId": "a8d3cdff-ea5d-4548-838d-c11a5cf1e2a3",
        "toolCall": {
          "toolCallId": "toolu_01DgtQ6hKPnLoFyWAwB9dCCH",
          "kind": "edit",
          "status": "pending",
          "title": "Write channels\\probe\\scripts\\retest\\output\\perm_verify_created.txt",
          "name": "Write",
          "rawInput": {
            "file_path": "E:\\program\\GIT\\Agent\\multi\\Agent-Architecture-Hub\\channels\\probe\\scripts\\retest\\output\\perm_verify_created.txt",
            "content": "PERMISSION_APPROVED_TOKEN_7731"
          }
        },
        "options": [
          {
            "optionId": "allow-once",
            "name": "Yes",
            "kind": "allow_once"
          },
          {
            "optionId": "reject",
            "name": "No",
            "kind": "reject_once"
          }
        ]
      }
    ],
    "fileCreated": true,
    "fileContent": "PERMISSION_APPROVED_TOKEN_7731",
    "promptStopReason": "end_turn",
    "pass": true
  }
  ```
- **结论**: **pass**。在 default 模式下对文件写入等破坏性操作，ACP 桥在中途稳定向客户端发起 `session/request_permission`；客户端答复批准后，模型切实完成了文件写入。

---

### 5. `claude/L1b/acpx` · `model-new`
- **对应黑板行号**: 743（原行 688）
- **复测脚本**: `channels/probe/scripts/retest/test_claude_l1b_model_new_verified.mjs`
- **原始证据位置**: `channels/probe/scripts/retest/output/claude_l1b_model_new_raw.json`
- **测试过程**:
  通过 `acpx --format json --model <alias> claude exec` 选模型新建调用，分别指定 `haiku` 和 `sonnet`。观察 acpx 返回的流式 JSON 中的 `usage_update` 元数据以及 `prompt` 最终用量。
- **原始返回截取**:
  - **Haiku 轮**:
    ```json
    {
      "method": "session/update",
      "params": {
        "update": {
          "sessionUpdate": "usage_update",
          "used": 1053,
          "_meta": {
            "_claude/model": "claude-haiku-5-5"
          }
        }
      }
    }
    ```
    Prompt 结果中 `_meta.quota.model_usage`: `[{"model":"claude-haiku-5-5","token_count":{...}}]`
  - **Sonnet 轮**:
    ```json
    {
      "method": "session/update",
      "params": {
        "update": {
          "sessionUpdate": "usage_update",
          "used": 1053,
          "_meta": {
            "_claude/model": "claude-sonnet-5-5"
          }
        }
      }
    }
    ```
    Prompt 结果中 `_meta.quota.model_usage`: `[{"model":"claude-sonnet-5-5","token_count":{...}}]`
- **结论**: **pass**。此前失败的原因是测试脚本误将 `--model` 作为子命令参数写在 `claude` 之后导致 acpx 报 `unknown option '--model'`。修正为全局参数后，acpx 完美将模型参数传递至底层桥，并在返回的 usage 元数据和 quota 日志中确凿记录了生效的模型版本。

---

## 三、需要负责人判断的事项

1. **全局 settings.json 与会话级模式覆盖**:
   - `~/.claude/settings.json` 中配置了 `"defaultMode": "bypassPermissions"`。原生 CLI 和未切模式的 ACP 会话会默认继承该配置而自动放行非破坏性工具；
   - 在 ACP 桥中，客户端必须通过 `setSessionMode` 显式设置为 `default` 或 `approveTools`，才能激活工具调用的中途审批机制。我们的 L2 网关若希望实现人机交互审批，需在建立会话时主动下发 `setSessionMode`。
2. **Claude Code 内部对 Safe Command 的自动放行**:
   - 在 `default` 模式下，纯只读命令（如 `echo`）被视为无害操作直接执行，不触发中途审批；只有真实的文件写改、破坏性 Bash 或敏感工具才会发出 `session/request_permission`。测试用例必须使用真实的文件写入操作（如 Write 工具）方能验证该闭环。
3. **acpx 参数位置语法**:
   - `acpx` 的 `--model` 是 CLI 全局选项，必须置于 agent 名称之前（如 `acpx --model haiku claude ...`）；若写成 `acpx claude --model haiku ...` 会被 Commander.js 报 `unknown option '--model'`。
