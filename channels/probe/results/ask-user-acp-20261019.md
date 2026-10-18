# 智能体向人提问经 ACP 桥交互机制深度实测与架构报告

> **任务标识**：`dsp_163125_397u`（Argon 研发线 · 拓展适配器边界）  
> **报告作者**：Antigravity (`probe-askuser-acp-1019`)  
> **实测日期**：2026-10-18 ~ 2026-10-19  
> **测试环境**：Windows 11 (10.0.26200), Node.js v24.19.0, JSON-RPC 2.0 stdio 原始协议探针  
> **覆盖产品与常驻 ACP 桥**：
> - **ZCode**：`zcode-acp-server@0.69.3` (`zcode/L1b/acp`)
> - **WorkBuddy**：`codebuddy --acp (v2.160.0)` (`workbuddy/L1b/acp`)
> - **OpenCode**：`opencode acp (v1.18.33)` (`opencode/L1b/acp`)
> - **Hermes**：`hermes acp (v0.21.1)` (`hermes/L1b/acp`)

---

## 一、核心结论总表：四家能不能问、能不能答、同一轮能否继续？

本次实测脱离桌面端 GUI 外壳，直接接入四大产品常驻 ACP 桥进程的标准输入输出（stdio JSON-RPC 2.0 链路），用原生探针脚本模拟客户端发送二选一提问指令，监听所有原始帧并完成应答。

### 1.1 一行结论全景表

| 产品 | 经 ACP 能否问到 | 经 ACP 能否答回 | 同一轮是否继续并采用答案 | 协议交互机制与断链根因 | 实测判定 |
|---|:---:|:---:|:---:|---|:---:|
| **ZCode** | **能** | **能** | **是（完美继续）** | 智能体调用 `AskUserQuestion` 时，ACP 桥优雅降级为 `session/request_permission`（附带各选项 `optionId`），客户端回传 `{ outcome: { outcome: "selected", optionId } }` 后，**同一轮未结轮、未换轮，智能体直接采用答案生成后续回复**。若客户端声明 `elicitation.form`，还支持原生表单。 | **PASS** |
| **WorkBuddy** | **半路阻断** | **不能** | **否（被迫结轮）** | 智能体调用 `AskUserQuestion` 被识别为 `DeferExecuteTool`，经 ACP 下发 `session/request_permission`。客户端批准后，底层的 `codebuddy-headless.js` 执行器发现 `bindings.ask` 为 `undefined` 从而返回 `deny("$.ui.ask")`。模型自诉“提问工具不可用”并降级为纯文本，随后 `end_turn` 结轮。 | **FAIL** |
| **OpenCode** | **不能** | **不能** | **否（纯文本结轮）** | `opencode acp` 桥接进程根本未向模型工具箱注入 `question` 工具（模型直言工具不存在）；若客户端在 `initialize` 时声明 `elicitation` 会直接触发进程未捕获异常崩溃。模型只能输出普通文本并在本轮结束。 | **FAIL** |
| **Hermes** | **不能** | **不能** | **否（纯文本结轮）** | Hermes 的 ACP 适配器（`acp_adapter/adapter.py`）只为文件编辑危险操作注入了 `approval_cb`，**未向工具注册表注入 `clarify_callback`**（恒为 `None`）。`clarify` 工具不可用且 prompt 明确标明 `running headless — do not call clarify`。模型直接表示无提问工具并以文本结轮。 | **FAIL** |

---

## 二、逐家实测剖析、原始帧结构与断链定位

### 2.1 ZCode：全流程打通，同一轮无缝闭环 (PASS)

- **实测脚本**：[`channels/probe/scripts/probe_zcode_ask.mjs`](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/channels/probe/scripts/probe_zcode_ask.mjs)
- **实测会话**：`d9840741-b00e-45bf-94c8-ed3344d57aaa`、`4c98fbee-87df-4af2-9750-23bb8e4a2157`
- **黑板存证**：`channels/probe/blackboard.jsonl:2382`

#### 2.1.1 提问时服务端向客户端抛出的原始逆向请求帧

当 ZCode 智能体决定向用户提问时，ACP 桥服务端主动向客户端发起 `session/request_permission`：

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "session/request_permission",
  "params": {
    "sessionId": "d9840741-b00e-45bf-94c8-ed3344d57aaa",
    "toolCall": {
      "toolCallId": "call_AskUserQuestion_1792341901",
      "title": "你更喜欢哪种水果？",
      "kind": "other",
      "status": "pending",
      "rawInput": {
        "questions": [
          {
            "question": "你更喜欢哪种水果？",
            "header": "水果偏好",
            "options": [
              { "label": "苹果", "description": "红富士，清甜爽口" },
              { "label": "香蕉", "description": "进口香蕉，软糯香甜" }
            ],
            "multiSelect": false
          }
        ]
      }
    },
    "options": [
      { "optionId": "苹果", "name": "苹果", "kind": "allow_once" },
      { "optionId": "香蕉", "name": "香蕉", "kind": "allow_once" },
      { "optionId": "__skip__", "name": "跳过提问", "kind": "reject_once" }
    ]
  }
}
```

#### 2.1.2 客户端回复帧格式

客户端只需将用户的选择作为 `optionId` 传回：

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "result": {
    "outcome": {
      "outcome": "selected",
      "optionId": "苹果"
    }
  }
}
```

#### 2.1.3 同一轮继续执行的真实流式输出证据

在客户端回复 `selected: "苹果"` 后，服务端立即触发流式内容下发（未发生任何换轮、未断开连接），模型在同一轮中直接消费该答案：

```text
[ZCode Stream] 收到你的选择：**苹果** 🍎

清脆爽口的经典之选！如果需要进一步的信息或者有其他问题，随时告诉我。
[ZCode Prompt Done] stopReason = "end_turn"
```

#### 2.1.4 源码架构剖析：ZCode 是如何做到的？

查阅 `zcode-acp-server`（位于 `~/.nvm/versions/node/v24.19.0/lib/node_modules/zcode-acp-server/dist/interaction/adapter.js`）：
1. **双模式自适应**：
   - 如果客户端在 `initialize` 时声明了 `elicitation: { form: true }`，ZCode 会直接调用标准的 `elicitation/create` 下发交互表单；
   - 如果客户端未声明 `elicitation`（我们当前的 `acp_runtime.ts` 就未声明），ZCode 实现了优雅降级逻辑 `handleAskUserQuestion`：自动把 `AskUserQuestion` 的问题与选项解析为 `session/request_permission` 的候选选项 `options: [{ optionId: label, name: label, kind: "allow_once" }]`。
2. **同一轮无缝恢复**：选项选择结果直接喂回内部 Agent 上下文的 Promise 决议器，ToolCall 状态由 `pending` 变为 `completed`，LLM 继续推理，完全符合预期。

---

### 2.2 WorkBuddy：断在 Headless 缺少 UI 绑定 (FAIL)

- **实测脚本**：[`channels/probe/scripts/probe_workbuddy_ask.mjs`](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/channels/probe/scripts/probe_workbuddy_ask.mjs)
- **实测会话**：`01a14fe6-3072-7a2e-b40a-d812729239c8`、`01a14fe8-2995-7aae-b179-0daf6069500e`
- **黑板存证**：`channels/probe/blackboard.jsonl:2383`

#### 2.2.1 提问时服务端向客户端抛出的原始逆向请求帧

WorkBuddy 将 `AskUserQuestion` 视为需要二次确认的延期执行工具（`DeferExecuteTool`）：

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "session/request_permission",
  "params": {
    "sessionId": "01a14fe6-3072-7a2e-b40a-d812729239c8",
    "toolCall": {
      "toolCallId": "tool_1852467389",
      "title": "DeferExecuteTool",
      "kind": "other",
      "status": "pending",
      "rawInput": {
        "tool_name": "AskUserQuestion",
        "parameters": {
          "questions": [
            {
              "question": "你更喜欢苹果还是香蕉？",
              "header": "水果选择",
              "options": [
                { "label": "苹果", "description": "红富士苹果" },
                { "label": "香蕉", "description": "进口香蕉" }
              ],
              "multiSelect": false
            }
          ]
        }
      }
    },
    "options": [
      { "optionId": "allow_always", "name": "Always Allow", "kind": "allow_always" },
      { "optionId": "allow", "name": "Allow Once", "kind": "allow_once" },
      { "optionId": "reject", "name": "Reject", "kind": "reject_once" }
    ]
  }
}
```

#### 2.2.2 客户端答复与底层崩塌

客户端回复批准执行：
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "result": { "outcome": { "outcome": "selected", "optionId": "allow" } }
}
```

然而，底层紧接着发生异常：
1. 桥进程在执行真实工具时，调用了 `codebuddy-headless.js:2073:1629` 内部的 `$.ui.ask`。
2. 在 headless（无头/CLI）环境下，宿主只注入了控制台日志和基础文件系统，**并未注入 `bindings.ask`**。
3. 执行器命中 fallback 分支直接抛出：`deny("$.ui.ask")`。
4. 智能体捕获到 Tool 执行错误后，在同一轮内无奈输出：
   ```text
   提问工具在当前环境不可用，我直接以文字形式向你提问：
   你更喜欢苹果还是香蕉？请告诉我你的选择。
   ```
5. 随后直接以 `stopReason: "end_turn"` 结束当前轮，彻底丧失了“在同一轮内把答案带回”的可能。

#### 2.2.3 源码定位与潜在接口

在 `codebuddy-acp-bundle.js` 中发现：
- WorkBuddy 的 ACP 协议层其实注册了一个名为 `_codebuddy.ai/resolveInterruption` 的扩展方法，用于解决中途打断/提问；
- 但由于 `codebuddy-headless` 核心并未将 `$.ui.ask` 导流到这个扩展方法，导致链路在 headless 层硬编码熔断。

---

### 2.3 OpenCode：ACP 桥未暴露提问工具 (FAIL)

- **实测脚本**：[`channels/probe/scripts/probe_opencode_ask.mjs`](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/channels/probe/scripts/probe_opencode_ask.mjs)
- **实测会话**：`ses_eb0139e60ffexZfBHUUf8ohdh6`、`ses_eb0143502ffe1l162Nvqhc1Nni`
- **黑板存证**：`channels/probe/blackboard.jsonl:2384`

#### 2.3.1 协议协商崩溃缺陷

当客户端尝试在 `initialize` 请求中告知 OpenCode 支持 `elicitation`：
```json
{
  "capabilities": {
    "fs": { "readTextFile": true, "writeTextFile": true },
    "elicitation": { "form": true }
  }
}
```
OpenCode ACP 桥进程（`opencode acp` v1.18.33）会因路由解析器假设能力对象字段为纯字符串而直接抛出：
`UnhandledPromiseRejection: TypeError: Cannot read properties of undefined (reading 'split')` 并异常崩溃退出。

#### 2.3.2 工具列表缺失

在正常协商连接后，要求智能体调用 `question` 工具，模型多次尝试寻找并明确回复：
```text
我当前的工具集中没有名为 question 的工具。
如果你想和我讨论苹果还是香蕉，我可以在这里和你聊聊：你更喜欢哪一个呢？
```
伴随 `stopReason: "end_turn"` 结轮。

#### 2.3.3 架构根因

OpenCode 的架构中，交互提问（`question`）是绑定在它的 Web UI / TUI 数据库（SQLite + EventBus）上的私有协议特性。OpenCode 的 ACP 适配器仅导出了 `bash`, `read_file`, `write_file`, `grep_search`, `file_search` 等基础工具，完全没有将提问工具包装进 ACP 协议通道。

---

### 2.4 Hermes：ACP 适配层未挂接 clarify_callback (FAIL)

- **实测脚本**：[`channels/probe/scripts/probe_hermes_ask.mjs`](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/channels/probe/scripts/probe_hermes_ask.mjs)
- **实测会话**：`d3c5546f-365c-4777-8a6d-a9c3d7155e01`
- **黑板存证**：`channels/probe/blackboard.jsonl:2385`

#### 2.4.1 源码直接定性

查阅 Hermes ACP 适配层核心代码（`hermes-agent/acp_adapter/adapter.py:312`）：
```python
# 初始化 Agent 工具箱时：
tools = registry.get_tools(approval_cb=self._approval_callback)
```
注意此处**仅传入了 `approval_cb`**，根本没有传入 `clarify_callback`！

再查阅 Hermes 工具注册与提示词构建层（`prompt_builder.py:186`）：
```python
if clarify_callback is None:
    # 注入系统提示词严厉禁止模型提问：
    system_prompt += "\nYou are running headless — do not call clarify."
```
当 `clarify_callback` 为 `None` 时，`clarify` 工具直接处于 `_UNAVAILABLE` 禁用状态。

#### 2.4.2 运行实测输出

向 Hermes 发出提问指令后，Hermes 尝试使用 `tool_search` 查找可用提问工具，确认无可用的交互工具后回复：
```text
当前会话里没有独立的提问/询问用户工具。
我可以直接在这里问你：在苹果和香蕉之间，你更喜欢哪一种？请直接打字回复。
```
随后发送结束帧 `stopReason: "end_turn"`。

---

## 三、对后端（`acp_runtime.ts` 与 `gateway.ts`）的落地建议

针对实测结果，研发线为负责人（Claude）推进网页端落地提供以下具体接入方案：

### 3.1 ZCode：立即在后端接通，扩展 `handleAcpApproval` 即可

ZCode 是目前四家 ACP 桥中**唯一原生、完整、同一轮打通提问答回**的产品。后端改造极其轻量：

1. **协议层识别（`acp_runtime.ts`）**：
   当收到 `session/request_permission` 时，检测 `params.toolCall.title` 或 `params.options`。若 options 的选项不是普通的 `[allow, reject]`，而是包含具有业务含义的选项文本（例如 `苹果`、`香蕉`），即可判定这是一个提问请求。
2. **状态层挂起（`state.ts`）**：
   将该请求生成一个 `pendingQuestion`（记录 `id: q_...`, `title`, `options`），会话状态标记为等待用户输入，通知前端网页弹出提问卡片。
3. **回答路由（`gateway.ts` 的 `POST /api/gateway/answer`）**：
   前端用户点击某个选项（如“苹果”）提交后，后端直接找到该 ACP 会话驱动，调用答复：
   ```typescript
   driver.replyPermission(reqId, {
     outcome: { outcome: "selected", optionId: selectedOption }
   });
   ```
   **无需任何新进程启动，原轮次立即收到事件并自动继续完成生成！**

### 3.2 WorkBuddy、OpenCode、Hermes：不建议走 ACP 桥接提问

- **WorkBuddy**：在官方修复 `codebuddy-headless` 的 `$.ui.ask` 缺失绑定前，ACP 桥无法支持提问。提问交互需依赖原生桌面端或等待其 headless 补齐接口。
- **OpenCode**：OpenCode 的提问交互只能走其本机的 Web Server REST/WebSocket 接口（带 SQLite 题卡持久化），ACP 命令行桥未实现也不支持该工具。
- **Hermes**：需在 `hermes-agent/acp_adapter/adapter.py` 中向 `registry.get_tools` 注入 `clarify_callback`，并在回调中向客户端发送类似 `session/request_permission` 的 RPC 请求；在官方 PR 或自研补丁落地前，Hermes 在 ACP 桥上只能降级为文本问答（跨轮）。

---

## 四、验证记录与测试脚本归档

| 文件路径 | 说明 |
|---|---|
| [`channels/probe/scripts/probe_ask_user_tester.mjs`](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/channels/probe/scripts/probe_ask_user_tester.mjs) | 标准无依赖 ACP stdio 原始协议探针基类 |
| [`channels/probe/scripts/probe_zcode_ask.mjs`](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/channels/probe/scripts/probe_zcode_ask.mjs) | ZCode 提问-答回-同轮验证实测脚本 |
| [`channels/probe/scripts/probe_workbuddy_ask.mjs`](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/channels/probe/scripts/probe_workbuddy_ask.mjs) | WorkBuddy 提问拦截与 headless 熔断复现脚本 |
| [`channels/probe/scripts/probe_opencode_ask.mjs`](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/channels/probe/scripts/probe_opencode_ask.mjs) | OpenCode 工具集缺失与能力协商探针脚本 |
| [`channels/probe/scripts/probe_hermes_ask.mjs`](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/channels/probe/scripts/probe_hermes_ask.mjs) | Hermes 提问禁用与系统提示词诊断脚本 |
| [`channels/probe/blackboard.jsonl`](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/channels/probe/blackboard.jsonl) | 黑板实测事实行（2382~2385 行）及修正行（2386 行） |
