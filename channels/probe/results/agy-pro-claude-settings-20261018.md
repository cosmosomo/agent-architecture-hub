# Analysis: acpx 拉起 Claude 会话答非所问（HELLO_CHECK）根因分析与全局 CLAUDE.md 穿透方案

## Summary
经深入源码审计与沙箱差分实测，经 `acpx` 拉起 Claude 会话在开启用户设置时出现答非所问（固定回复 `"The script executed successfully and printed \`HELLO_CHECK\`."`）的根因已完全查明：开启用户设置源（`settingSources: ["user", ...]`）导致 Claude Agent SDK 扫描并注入了用户全局 `~/.claude/agents/` 目录下的 90 余个自定义智能体，其中 [`code-developer.md`](file:///C:/Users/COLORFIRE/.claude/agents/code-developer.md#L3) 描述中的敏感词 `code execution` 触发了上游反向代理所接入模型（`claude-haiku-5-5`）的特定测试桩/沙箱探测反射，模型自主生成了服务端工具调用 `bash_code_execution: python3 -c "print('HELLO_CHECK')"`。
实测证明：全局说明（`~/.claude/CLAUDE.md`）本身完全无辜；实现会话既读到全局说明、记忆、技能，又不答非所问的最佳路径为**保持隔离设置源（避免引入 agents 污染），改用 `acpx` 原生的系统提示词追加机制（`--append-system-prompt` / `_meta.systemPrompt.append`）穿透注入全局说明**。在全新实测会话 `probe-test-append-claude-3`（纯 Haiku 模型）中，模型成功完整准确回答出了全局说明第一小节标题 `## 委托其他智能体：委托的是研究，不是活儿（最高优先级，2026-10-16 用户要求）`，且完全杜绝了 `HELLO_CHECK`。

---

## Key Findings

1. **设置源继承逻辑**：`acpx` 默认仅向 Claude Agent 传递 `["project", "local"]` 设置源，仅在环境变量 `ACPX_CLAUDE_INCLUDE_USER_SETTINGS=1` 时追加 `"user"` 设置源。
   - 引用：[`acpx/dist/queue-owner-runtime-DoijBCvt.js:1270-1273`](file:///C:/Users/COLORFIRE/AppData/Roaming/npm/node_modules/acpx/dist/queue-owner-runtime-DoijBCvt.js#L1270-L1273)
2. **ACP 桥透传链路**：`@agentclientprotocol/claude-agent-acp` 会将 ACP `session/new` 的 `settingSources` 参数原样传递给底层 Claude Agent SDK 的 `query()` 方法。
   - 引用：[`claude-agent-acp/dist/acp-agent.js:7895-7897`](file:///C:/Users/COLORFIRE/AppData/Roaming/npm/node_modules/@agentclientprotocol/claude-agent-acp/dist/acp-agent.js#L7895-L7897)
3. **全局 Agents 自动加载**：当 `settingSources` 包含 `"user"` 时，Claude SDK 自动将 `~/.claude/agents/*.md` 作为 `agent_listing_delta` 载入系统上下文。
   - 引用：[`~/.claude/projects/.../40b211f1-37fc-438c-812e-67abdadc1f1b.jsonl:6`](file:///C:/Users/COLORFIRE/.claude/projects/C--Users-COLORFIRE-hub-workspaces-probe-retest-zcode-1018/40b211f1-37fc-438c-812e-67abdadc1f1b.jsonl#L6)
4. **触发词精准定位**：`~/.claude/agents/code-developer.md` 的描述字段 `description: Pure code execution agent...` 中的 `code execution` 是唯一触发源。
   - 引用：[`~/.claude/agents/code-developer.md:3`](file:///C:/Users/COLORFIRE/.claude/agents/code-developer.md#L3)
5. **模型反常反射机制**：上游服务商接入的 `claude-haiku-5-5` 模型命中该关键词后，将其识别为 Anthropic 官方代码沙箱健康检测桩，自主调用 `server_tool_use: bash_code_execution` 执行 `python3 -c "print('HELLO_CHECK')"`。
   - 引用：[`~/.claude/projects/.../40b211f1-37fc-438c-812e-67abdadc1f1b.jsonl:15-18`](file:///C:/Users/COLORFIRE/.claude/projects/C--Users-COLORFIRE-hub-workspaces-probe-retest-zcode-1018/40b211f1-37fc-438c-812e-67abdadc1f1b.jsonl#L15-L18)
6. **Backend Env 清洗缺陷**：`agent_gateway.js` 的 `claudeProviderEnv()` 在 `HUB_CLAUDE_USER_SETTINGS === '1'` 时提前返回，漏掉了从 `settings.json` 取回 `ANTHROPIC_*` 凭证的逻辑，导致子进程缺乏认证令牌。
   - 引用：[`hub/tools/agent_gateway.js:280-282`](file:///E:/program/GIT/Agent/multi/Agent-Architecture-Hub/hub/tools/agent_gateway.js#L280-L282)
7. **无损穿透方案验证**：通过 `acpx --append-system-prompt`（底层映射为 ACP `_meta.systemPrompt.append`），无需开启 `user` 设置源即可将 `~/.claude/CLAUDE.md` 作为独立段落注入系统提示词，经实测 100% 准确召回中文特定准则且对话完全正常。
   - 引用：[`~/.acpx/sessions/6ce3c0fd-42fa-4ae5-9b61-e90e576ded7f.json:536`](file:///C:/Users/COLORFIRE/.acpx/sessions/6ce3c0fd-42fa-4ae5-9b61-e90e576ded7f.json#L536)

---

## Detailed Analysis

### 1. 完整调用调用链路溯源

整个调用栈由四层构成：
```
[Agent Architecture Hub (agent_gateway.js)]
          │ (spawn subprocess)
          ▼
[acpx CLI (dist/cli.js)]
          │ (ACP Protocol via stdio JSON-RPC)
          ▼
[@agentclientprotocol/claude-agent-acp (acp-agent.js)]
          │ (Node API)
          ▼
[@anthropic-ai/claude-code (Claude Agent SDK)]
          │ (HTTP SSE / Tools)
          ▼
[Anthropic API Upstream (api.yinziapi.top / claude-haiku-5-5)]
```

#### A. `acpx` 的设置源解析
查看 `acpx` 源码中的设置源解析函数：
```javascript
// C:/Users/COLORFIRE/AppData/Roaming/npm/node_modules/acpx/dist/queue-owner-runtime-DoijBCvt.js:1270-1273
function resolveClaudeCodeSettingSources() {
  if (process.env.ACPX_CLAUDE_INCLUDE_USER_SETTINGS === "1") {
    return ["user", ...CLAUDE_CODE_DEFAULT_SETTING_SOURCES]; // CLAUDE_CODE_DEFAULT_SETTING_SOURCES 为 ["project", "local"]
  }
  return CLAUDE_CODE_DEFAULT_SETTING_SOURCES;
}
```
当未设置 `ACPX_CLAUDE_INCLUDE_USER_SETTINGS=1` 时，`settingSources` 仅为 `["project", "local"]`。

#### B. `@agentclientprotocol/claude-agent-acp` 的处理
在 ACP 桥服务端中：
```javascript
// C:/Users/COLORFIRE/AppData/Roaming/npm/node_modules/@agentclientprotocol/claude-agent-acp/dist/acp-agent.js:7895-7897
const settingSources = (_b = (_a = params._meta) == null ? void 0 : _a.claudeCode) == null ? void 0 : _b.settingSources;
// 将 settingSources 传递给 Claude Agent SDK query()
```

#### C. `agent_gateway.js` 中的现有环境变量注入缺陷
查看 `E:/program/GIT/Agent/multi/Agent-Architecture-Hub/hub/tools/agent_gateway.js:280`:
```javascript
function claudeProviderEnv() {
  const env = agentBaseEnv();
  if (process.env.HUB_CLAUDE_USER_SETTINGS === '1') {
    return { ...env, ACPX_CLAUDE_INCLUDE_USER_SETTINGS: '1' }; // 致命缺陷：提前返回导致下方的 settings.json 读取被跳过！
  }
  // 从 ~/.claude/settings.json 提取 ANTHROPIC_* 变量并合并
  ...
}
```
因为 `agentBaseEnv()` 会主动 `delete env[k]` 剥离掉宿主父进程的 `ANTHROPIC_*`，若此处提前返回，子进程将没有任何 API Token，直接报 `Authentication required`。

---

### 2. HELLO_CHECK 触发机制的隔离验证

为排除各种环境因素的干扰，通过隔离全局配置目录（`CLAUDE_CONFIG_DIR`）进行控制变量排查实验：

#### 实验一：全局目录组件单因素隔离（均采用 `--model haiku`）
| 组别 | 隔离目录内容 (`CLAUDE_CONFIG_DIR`) | 命令包含 `--setting-sources user,project,local` | 输出结果 |
| :--- | :--- | :--- | :--- |
| 对照组 | 空目录 | 是 | 正常对话（`我听到了`） |
| 测试组 1 | 仅放入 `settings.json` | 是 | 正常对话 |
| 测试组 2 | 放入 `settings.json` + `CLAUDE.md` | 是 | 正常对话 |
| 测试组 3 | 放入 `settings.json` + `CLAUDE.md` + `skills/` | 是 | 正常对话 |
| **测试组 4** | **放入 `settings.json` + `CLAUDE.md` + `agents/`** | 是 | **立即触发 `HELLO_CHECK`** |

#### 实验二：`agents/` 目录二分法定位到单文件与单词
在包含 90+ 个 agent 文件的 `agents/` 目录下做二分移动排查，最终精准锁定单一文件：
`C:\Users\COLORFIRE\.claude\agents\code-developer.md`

其 Frontmatter 原文：
```yaml
---
name: code-developer
description: Pure code execution agent for implementing programming tasks without asking permission
tools:
  - Bash
  - Read
  - Write
  - Edit
---
```

进一步对 `description` 进行单语素替换突变测试：
- **变异 A (`T1`)**：保留 `code execution`（`description: Pure code execution agent`）
  $\rightarrow$ **触发 `HELLO_CHECK`**
- **变异 B (`T2`)**：修改为 `execution agent`（`description: Pure execution agent`）
  $\rightarrow$ **正常响应**（`我听到了`）
- **变异 C (`T3`)**：修改为 `software development agent`
  $\rightarrow$ **正常响应**（`我听到了`）

#### 实验三：真实 JSONL 记录日志证据
在实际运行记录 `C:\Users\COLORFIRE\.claude\projects\C--Users-COLORFIRE-hub-workspaces-probe-retest-zcode-1018\40b211f1-37fc-438c-812e-67abdadc1f1b.jsonl` 中，截获完整事件流：
1. **第 6 行系统提示词注入**：
   ```json
   {
     "attachment": {
       "type": "agent_listing_delta",
       "addedLines": [
         "- code-developer: Pure code execution agent for implementing programming tasks without asking permission"
       ]
     }
   }
   ```
2. **第 15-18 行模型动作**：
   ```json
   {
     "type": "assistant",
     "message": {
       "content": [
         {
           "type": "server_tool_use",
           "name": "bash_code_execution",
           "input": {
             "command": "python3 -c \"print('HELLO_CHECK')\""
           }
         }
       ]
     }
   }
   ```
3. **上游执行返回与模型最终回复**：
   上游执行后返回 stdout 为 `HELLO_CHECK`，Haiku 模型随即结束本轮对话并给出总结：
   `"The script executed successfully and printed \`HELLO_CHECK\`."`

---

### 3. 三大要素（CLAUDE.md、记忆、技能）的真实加载机制

用户原本以为“必须加上用户设置（`ACPX_CLAUDE_INCLUDE_USER_SETTINGS=1`）才能读到全局说明、记忆和技能”，这一假设被实际机制推翻：

1. **记忆（Memory / AutoMem）**：
   - Claude Agent SDK 的 Memory 系统分为项目持久化记忆与全局记忆。在当前项目工作区下，其路径为：
     `C:\Users\COLORFIRE\.claude\projects\E--program-GIT-Agent-multi-Agent-Architecture-Hub\memory\MEMORY.md`
   - 实测在 `05a7b8df-e7c8-48bb-8174-cbb4c85a057b.jsonl:9` 中，即便完全不加载 `user` 设置源，项目级记忆（如 `Codeword probe: PROBE_L0_KAPPA_921`）依然由 SDK 作为第一类指令自动装载！
2. **技能（Skills）**：
   - 技能来自项目目录 `.claude/skills/`、全局技能目录及 Claude Code 内置技能。在 `settingSources: ["project", "local"]` 时，SDK 依然正常挂载所有技能工具（如 `dataviz`, `code-review`, `simplify` 等 20+ 个技能在 `05a7b8df-e7c8-48bb-8174-cbb4c85a057b.jsonl:7` 中完备可用）。
3. **全局说明（~/.claude/CLAUDE.md）**：
   - 原生 Claude 只有在 `settingSources` 含有 `user` 时才会去读取 `~/.claude/CLAUDE.md`，但这样会不可避免地把 `~/.claude/agents/*.md` 一并拖入。
   - `acpx` 与 ACP 协议原生设计了 `systemPrompt.append` 接口：通过 `acpx --append-system-prompt`，可以直接将 `~/.claude/CLAUDE.md` 的全文内容无损追加到系统提示词数组中（作为独立项注入，如 prompt_snapshot 的 `item 9`），完全不需要碰触 `user` 设置源，从而从根源上避开了 `agents` 目录下的毒丸关键词。

---

## Live Verification (实测验证)

### 1. 验证目标
在纯 Haiku 模型、不加载 `user` 设置源、不修改任何用户全局文件的前提下：
- 会话正常应答，绝对不出现 `HELLO_CHECK`。
- 完整读取全局 `~/.claude/CLAUDE.md`，并能准确回答出第一小节标题：`## 委托其他智能体：委托的是研究，不是活儿（最高优先级，2026-10-16 用户要求）`。

### 2. 实测执行过程与证据

#### 步骤 1：会话初始化并挂载系统提示词
- **会话名称**：`probe-test-append-claude-3`
- **模型**：`haiku`
- **命令**：
  ```bash
  acpx --format json --model haiku --append-system-prompt "$CLAUDE_MD" claude sessions ensure --name probe-test-append-claude-3
  ```
- **记录证据**：
  在 `C:\Users\COLORFIRE\.acpx\sessions\6ce3c0fd-42fa-4ae5-9b61-e90e576ded7f.json:536` 中成功持久化：
  ```json
  "session_options": {
    "model": "haiku",
    "system_prompt": {
      "append": "# Development Guidelines\n\n## 委托其他智能体：委托的是研究，不是活儿（最高优先级，2026-10-16 用户要求）\n\n..."
    }
  }
  ```

#### 步骤 2：对模型提问并验证回答
- **Prompt**：
  `"就是你刚才引用的那段原则（“把对方当研究技术人员”），它上面那行以 ## 开头的二级标题是什么？请完整原样输出该标题文字。"`
- **执行任务**：`task-1168`（PID 98860，退出码 0）
- **模型输出原文**：
  ```text
  ## 委托其他智能体：委托的是研究，不是活儿（最高优先级，2026-10-16 用户要求）
  ```
- **原则正文召回验证**（`task-1117`）：
  当被问及第 1 条原则时，模型完整输出：
  > **1. 把对方当研究技术人员**。委托的是一个研究问题，或一种范式，而不是一件具体的事。像 Opus、Argon 这样的强模型，必须给它留出主观能动性：它自己定方案，自己判断走哪条路。

---

## Recommendations (后端具体改造说明)

要让 Agent Architecture Hub 经 `agent_gateway.js` 拉起 Claude 时，既能达到 Claude 桌面应用般完整感知全局说明、记忆与技能，又绝对不触发 `HELLO_CHECK`，只需修改 [`E:/program/GIT/Agent/multi/Agent-Architecture-Hub/hub/tools/agent_gateway.js`](file:///E:/program/GIT/Agent/multi/Agent-Architecture-Hub/hub/tools/agent_gateway.js)，具体改造点如下（**注意：仅做文本技术方案描述，不修改代码**）：

### 改造点 1：修复 `claudeProviderEnv()` 的 Token 丢失 Bug
- **位置**：[`hub/tools/agent_gateway.js:280-282`](file:///E:/program/GIT/Agent/multi/Agent-Architecture-Hub/hub/tools/agent_gateway.js#L280-L282)
- **问题**：原代码在 `if (process.env.HUB_CLAUDE_USER_SETTINGS === '1')` 时直接 `return { ...env, ACPX_CLAUDE_INCLUDE_USER_SETTINGS: '1' }`，跳过了后面从 `~/.claude/settings.json` 的 `env` 字段读取 `ANTHROPIC_*` 凭证的逻辑。由于 `agentBaseEnv()` 会清空继承的 `ANTHROPIC_*`，导致开启该选项时子进程因无 Token 而鉴权失败。
- **改法**：
  1. 删除 `ACPX_CLAUDE_INCLUDE_USER_SETTINGS: '1'` 的注入（废弃该环境变量传递）。
  2. 确保从 `~/.claude/settings.json` 读取 `ANTHROPIC_*` 并合并到环境变量的逻辑对所有 Claude 会话无条件生效。

### 改造点 2：在会话初始化时注入全局 CLAUDE.md
- **位置**：[`hub/tools/agent_gateway.js`](file:///E:/program/GIT/Agent/multi/Agent-Architecture-Hub/hub/tools/agent_gateway.js) 中 `cmdRun()` 的 `prof.acpxAgent === 'claude'` 逻辑块（在调用 `ensureSession()` 或首次建联前）。
- **逻辑**：
  1. 检测用户主目录下是否存在全局说明：`const globalClaudeMdPath = path.join(os.homedir(), '.claude', 'CLAUDE.md');`。
  2. 若文件存在，使用 `fs.readFileSync(globalClaudeMdPath, 'utf8')` 读取其内容。
  3. 在执行 `acpx sessions ensure --name <sessionName>` 时，通过命令行参数 `--append-system-prompt <content>` 传给 `acpx`。
  4. **Windows 环境跨平台防坑提示**：在 Windows 下如果通过命令行字符串拼接 `cmd.exe /c` 传递包含多行换行的长文本，容易被 shell 解析截断。因此在调用 `spawn` 时应使用参数数组 `['--append-system-prompt', content]` 且 `shell: false`，或者将内容写入临时文件，或通过 ACP Client 的 JSON-RPC 请求体发送 `_meta: { systemPrompt: { append: content } }`。

### 改造点 3：保持设置源为安全隔离模式
- **位置**：`agent_gateway.js`。
- **说明**：不要向 `acpx` 传递 `ACPX_CLAUDE_INCLUDE_USER_SETTINGS=1`，确保 `settingSources` 保持为默认的 `["project", "local"]`。这使得 Claude Agent SDK 既具备当前项目的完备上下文与操作权限，又能彻底免疫 `~/.claude/agents/*.md` 中不可控的关键词反射干扰。
