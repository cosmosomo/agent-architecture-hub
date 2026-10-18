# WorkBuddy 与 ZCode 复测报告：模型选择/切换与会话分叉原始证据闭环

**测试员**: agy-pro-wb-zcode  
**任务**: 针对此前证据不足、结论被负责人记为“未验证”的 7 个格子，逐一实测获取第一手原始证据，闭环判定。  
**测试范围**:
1. `workbuddy/L0/native-cli` · `fork` (原黑板行 221)
2. `workbuddy/L0/native-cli` · `model-new` (原黑板行 222)
3. `workbuddy/L0/native-cli` · `model-switch` (原黑板行 223)
4. `workbuddy/L1a/codebuddy-acp` · `model-new` (原黑板行 224)
5. `workbuddy/L1b/acpx` · `model-new` (原黑板行 225)
6. `workbuddy/L1b/acpx` · `model-switch` (原黑板行 226)
7. `zcode/L1b/acp-bridge` · `model-switch` (原黑板行 60)

**执行规矩与红线**:
- 严禁脚本自打标签（如 FORK_SUCCESS），以子会话实际问出父会话暗号、本地库实际调用的模型元数据为准；
- WorkBuddy 严禁使用腾讯官方内置模型，只使用 `custom-local:glm-5.3` 与 `custom-local:glm-5.3-flash`（BYOK 智谱 Coding Plan）；
- WorkBuddy 实际调用模型以 `~/.workbuddy/projects/<slug>/<sessionId>.jsonl` 记录的 `providerData` 元数据为准；
- ZCode 实际调用模型以 `~/.zcode/cli/db/db.sqlite` 的 `model_usage` 表记录为准，在智谱 Coding Plan 双档之间切换（`GLM-5.3-Flash` ↔ `GLM-5.3`）；
- 所有命令带超时（≤75s），测试仅操作新建的 `probe-` 会话，不重启桌面应用，不修改全局配置。

---

## 一、复测结论概览

| 序号 | 路线 (`route`) | 能力 (`capability`) | 原行号与未过原因 | 新结论 | 关键证据源 |
|:---:|---|---|---|:---:|---|
| 1 | `workbuddy/L0/native-cli` | `fork` | 行 221 · 脚本自打标签，未在分叉子会话中提问父会话内容 | **pass** | 子会话 `01a14974-d5ad-795f-b7da-125bbe9c36f2` 成功输出暗号 `WB-SECRET-58219` |
| 2 | `workbuddy/L0/native-cli` | `model-new` | 行 222 · 用量无模型字段，未以本地库实际模型为准 | **pass** | 项目库 `probe-wb-l0-model-1792233760844.jsonl` 记录 `requestModelId: custom-local:glm-5.3` |
| 3 | `workbuddy/L0/native-cli` | `model-switch` | 行 223 · 仅脚本标签，无切换后实际模型记录 | **pass** | 同上文件第 1 轮为 `glm-5.3`，第 2 轮记录 `requestModelId: custom-local:glm-5.3-flash` |
| 4 | `workbuddy/L1a/codebuddy-acp` | `model-new` | 行 224 · 仅配置了模型，无实际调用模型记录 | **pass** | ACP 会话 `01a14975-9dcc-7828-8b10-3c03856d77dc.jsonl` 记录实际 `requestModelId: custom-local:glm-5.3` |
| 5 | `workbuddy/L1b/acpx` | `model-new` | 行 225 · 证据为 initialize 样本，与选模型无关 | **pass** | 底层会话 `01a14977-7aa0-7ea3-bf15-9c1f0d775abd.jsonl` 记录实际 `requestModelId: custom-local:glm-5.3` |
| 6 | `workbuddy/L1b/acpx` | `model-switch` | 行 226 · 仅 set 命令返回 model_set，无下一轮实际模型 | **pass** | 同上文件第 2 轮 prompt 真实落地，记录 `requestModelId: custom-local:glm-5.3-flash` |
| 7 | `zcode/L1b/acp-bridge` | `model-switch` | 行 60 · 仅 set 命令返回 model_set，无下一轮实际模型 | **pass** | `~/.zcode/cli/db/db.sqlite` 表 `model_usage` 第 1 轮 `GLM-5.3-Flash`，第 2 轮 `GLM-5.3` |

**总计**: 7 格全部完成实测，结论全部达到硬规矩要求，判定为 **7 pass**。

---

## 二、WorkBuddy 逐格详细复测证据

### 1. `workbuddy/L0/native-cli` · `fork`
- **原问题**: 原证据返回 `FORK_SUCCESS`，系脚本在提示词中自定，并未在分叉后的新会话中要求模型召回父会话上下文。
- **复测操作**:
  1. 父会话 `probe-wb-l0-fork-parent-1792233738517` 存入随机暗号 `WB-SECRET-58219`；
  2. 使用 `codebuddy -r <parentSessionId> --fork-session -p "我们之前约定的暗号是什么？直接回答暗号，不要任何多余字。"` 创建分叉子会话并提问；
  3. 检查子会话 ID 与回复内容。
- **原始证据**:
  - 父会话 ID: `probe-wb-l0-fork-parent-1792233738517`
  - 子会话 ID: `01a14974-d5ad-795f-b7da-125bbe9c36f2`
  - 命令行返回 JSON:
    ```json
    {
      "type": "result",
      "subtype": "success",
      "result": "WB-SECRET-58219",
      "session_id": "01a14974-d5ad-795f-b7da-125bbe9c36f2",
      "duration_ms": 3374
    }
    ```
  - 本地落盘库文件 `~/.workbuddy/projects/e-program-GIT-Agent-multi-Agent-Architecture-Hub/01a14974-d5ad-795f-b7da-125bbe9c36f2.jsonl` 第 6 行：
    ```json
    {
      "id": "01a14974-db36-7429-a5b8-29004de5d456",
      "type": "message",
      "role": "assistant",
      "content": [{"type": "output_text", "text": "WB-SECRET-58219"}],
      "sessionId": "01a14974-d5ad-795f-b7da-125bbe9c36f2"
    }
    ```
- **结论**: **Pass**（分叉产生全新会话 ID，且在新会话中 100% 准确问出父会话存入的暗号原文）。

---

### 2. `workbuddy/L0/native-cli` · `model-new`
- **原问题**: 原证据中的 `usage` 结构体无模型字段，仅有脚本自标的 `MODEL_NEW_OK`，必须以 workbuddy 本地库记录为准。
- **本地存储机制发现**: WorkBuddy 在 CLI 模式下，每次对话将轮次事件追加至 `~/.workbuddy/projects/<slug>/<sessionId>.jsonl`；每条 `role: "assistant"` 消息的 `providerData` 字段精确记录了该轮请求的真实模型：
  `model`, `requestModelId`, `requestModelName`, `rawUsage`。
- **复测操作**:
  - 执行命令: `codebuddy -p "请只回复四个字：天地玄黄" --session-id probe-wb-l0-model-1792233760844 --model custom-local:glm-5.3 --output-format json`
- **原始证据**:
  - CLI 标准输出: `{"type":"result","subtype":"success","result":"天地玄黄","session_id":"probe-wb-l0-model-1792233760844"}`
  - 项目库文件 `probe-wb-l0-model-1792233760844.jsonl` 第 4 行 `assistant` 记录：
    ```json
    {
      "role": "assistant",
      "providerData": {
        "stepSeq": 1,
        "model": "glm-5.3",
        "requestModelId": "custom-local:glm-5.3",
        "requestModelName": "GLM-5.3",
        "rawUsage": {
          "prompt_tokens": 27505,
          "completion_tokens": 90,
          "total_tokens": 27595,
          "prompt_tokens_details": {"cached_tokens": 27456},
          "completion_tokens_details": {"reasoning_tokens": 85}
        }
      },
      "content": [{"type": "output_text", "text": "天地玄黄"}]
    }
    ```
- **结论**: **Pass**（本地落盘元数据证实实际请求与执行模型为 `custom-local:glm-5.3`）。

---

### 3. `workbuddy/L0/native-cli` · `model-switch`
- **原问题**: 原证据缺少切换后第 2 轮实际调用模型的本地落盘凭证。
- **复测操作**:
  - 在会话 `probe-wb-l0-model-1792233760844`（第 1 轮为 `custom-local:glm-5.3`）上续接并切换模型：
    `codebuddy -r probe-wb-l0-model-1792233760844 -p "请只回复四个字：宇宙洪荒" --model custom-local:glm-5.3-flash --output-format json`
- **原始证据**:
  - CLI 返回: `{"type":"result","subtype":"success","result":"宇宙洪荒","session_id":"probe-wb-l0-model-1792233760844"}`
  - 检查 `probe-wb-l0-model-1792233760844.jsonl` 两轮 assistant 记录对比：
    - **第 1 轮 (行 4)**: `"stepSeq": 1, "model": "glm-5.3", "requestModelId": "custom-local:glm-5.3"`
    - **第 2 轮 (行 8)**:
      ```json
      {
        "role": "assistant",
        "providerData": {
          "stepSeq": 2,
          "model": "glm-5.3-flash",
          "requestModelId": "custom-local:glm-5.3-flash",
          "requestModelName": "GLM-5.3-Flash",
          "rawUsage": {
            "prompt_tokens": 27532,
            "completion_tokens": 29,
            "total_tokens": 27561,
            "prompt_tokens_details": {"cached_tokens": 1408},
            "completion_tokens_details": {"reasoning_tokens": 24}
          }
        },
        "content": [{"type": "output_text", "text": "宇宙洪荒"}]
      }
      ```
- **结论**: **Pass**（第 2 轮实际调用的 requestModelId 真实变更为 `custom-local:glm-5.3-flash`）。

---

### 4. `workbuddy/L1a/codebuddy-acp` · `model-new`
- **原问题**: 原证据仅表明向 ACP 连接调用了 `setSessionConfigOption`，无实际调用轮次使用该模型的落地证据。
- **复测操作**:
  - 通过 ACP 客户端连接直连拉起 `codebuddy --acp`；
  - `initialize` -> `session/new` 创建会话 `01a14975-9dcc-7828-8b10-3c03856d77dc`；
  - `setSessionConfigOption({ sessionId, configId: "model", value: "custom-local:glm-5.3" })`；
  - 执行真实轮次 `prompt({ sessionId, prompt: [{ type: "text", text: "请只回复四个字：日月盈昃" }] })`；
  - 检查 `~/.workbuddy/projects/.../01a14975-9dcc-7828-8b10-3c03856d77dc.jsonl` 的 assistant 记录。
- **原始证据**:
  - ACP 连接响应: `{"stopReason": "end_turn"}`
  - 本地项目库落盘文件 `01a14975-9dcc-7828-8b10-3c03856d77dc.jsonl` 第 4 行：
    ```json
    {
      "role": "assistant",
      "providerData": {
        "stepSeq": 1,
        "model": "glm-5.3",
        "requestModelId": "custom-local:glm-5.3",
        "requestModelName": "GLM-5.3",
        "rawUsage": {
          "prompt_tokens": 27506,
          "completion_tokens": 79,
          "total_tokens": 27585,
          "prompt_tokens_details": {"cached_tokens": 27456},
          "completion_tokens_details": {"reasoning_tokens": 72}
        }
      },
      "content": [{"type": "output_text", "text": "日月盈昃"}]
    }
    ```
- **结论**: **Pass**（ACP 直连模式下配置模型并调用后，底层真实产生调用并记录 `custom-local:glm-5.3`）。

---

### 5. `workbuddy/L1b/acpx` · `model-new`
- **原问题**: 原证据截取了 initialize 的握手 JSON 片段，与选模型行为完全脱节。
- **复测操作**:
  - 通过 acpx 显式指定模型新建并执行首轮：
    `acpx --format json --model custom-local:glm-5.3 workbuddy sessions new --name probe-wb-l1b-model-1792233925297`
    `acpx --format json --model custom-local:glm-5.3 workbuddy -s probe-wb-l1b-model-1792233925297 "请只回复四个字：辰宿列张"`
  - 通过 `~/.acpx/sessions/` 映射找到底层 `acp_session_id` (`01a14977-7aa0-7ea3-bf15-9c1f0d775abd`)；
  - 读取底层项目库文件 `01a14977-7aa0-7ea3-bf15-9c1f0d775abd.jsonl`。
- **原始证据**:
  - `01a14977-7aa0-7ea3-bf15-9c1f0d775abd.jsonl` 第 4 行：
    ```json
    {
      "role": "assistant",
      "providerData": {
        "stepSeq": 1,
        "model": "glm-5.3",
        "requestModelId": "custom-local:glm-5.3",
        "requestModelName": "GLM-5.3",
        "rawUsage": {
          "prompt_tokens": 27506,
          "completion_tokens": 36,
          "total_tokens": 27542,
          "prompt_tokens_details": {"cached_tokens": 27456},
          "completion_tokens_details": {"reasoning_tokens": 30}
        }
      },
      "content": [{"type": "output_text", "text": "辰宿列张"}]
    }
    ```
- **结论**: **Pass**（acpx 首轮执行真实落地，底层库明确记录 `requestModelId: custom-local:glm-5.3`）。

---

### 6. `workbuddy/L1b/acpx` · `model-switch`
- **原问题**: 原证据仅截取了 `acpx workbuddy set model` 返回的 `model_set` JSON，没有下一轮实际调用的模型证据。
- **复测操作**:
  - 在上述会话 `probe-wb-l1b-model-1792233925297` 中下发模型切换：
    `acpx --format json workbuddy set model custom-local:glm-5.3-flash -s probe-wb-l1b-model-1792233925297`
  - 紧接着执行第 2 轮对话：
    `acpx --format json workbuddy -s probe-wb-l1b-model-1792233925297 "请只回复四个字：寒来暑往"`
  - 读取底层项目库文件 `01a14977-7aa0-7ea3-bf15-9c1f0d775abd.jsonl` 第 2 轮 assistant 记录。
- **原始证据**:
  - set 命令返回:
    `{"action":"model_set","modelId":"custom-local:glm-5.3-flash","resumed":false,"acpxRecordId":"91fd52e7-75e6-4002-9ead-fd5c962e2d75","acpxSessionId":"01a14977-7aa0-7ea3-bf15-9c1f0d775abd"}`
  - 底层库 `01a14977-7aa0-7ea3-bf15-9c1f0d775abd.jsonl` 第 8 行第 2 轮 assistant 记录：
    ```json
    {
      "role": "assistant",
      "providerData": {
        "stepSeq": 2,
        "model": "glm-5.3-flash",
        "requestModelId": "custom-local:glm-5.3-flash",
        "requestModelName": "GLM-5.3-Flash",
        "rawUsage": {
          "prompt_tokens": 27535,
          "completion_tokens": 6,
          "total_tokens": 27541,
          "prompt_tokens_details": {"cached_tokens": 1408},
          "completion_tokens_details": {"reasoning_tokens": 0}
        }
      },
      "content": [{"type": "output_text", "text": "寒来暑往"}]
    }
    ```
- **结论**: **Pass**（第 2 轮 prompt 真实使用了切换后的 `custom-local:glm-5.3-flash` 模型并准确落盘）。

---

## 三、ZCode 逐格详细复测证据

### 7. `zcode/L1b/acp-bridge` · `model-switch`
- **原问题**: 原黑板第 60 行证据只有 `set` 命令返回 `action=model_set`，没有下一轮实际模型记录。
- **特殊要求**: 银子渠道（new-provider）从 17:50 起认证失败，必须在智谱 Coding Plan 的两个档之间切（`GLM-5.3-Flash` ↔ `GLM-5.3`）；实际模型以 `~/.zcode/cli/db/db.sqlite` 的 `model_usage` 表为准。
- **复测操作**:
  1. 通过 acpx 创建并执行第 1 轮（使用 `builtin:bigmodel-coding-plan\GLM-5.3-Flash`）：
     `acpx --format json --model "builtin:bigmodel-coding-plan\GLM-5.3-Flash" zcode sessions new --name probe-zcode-l1b-mswitch-1792234191216`
     `acpx --format json --model "builtin:bigmodel-coding-plan\GLM-5.3-Flash" zcode -s probe-zcode-l1b-mswitch-1792234191216 "请只回答四个字：春生夏长"`
  2. 下发切换命令：
     `acpx --format json zcode set model "builtin:bigmodel-coding-plan\GLM-5.3" -s probe-zcode-l1b-mswitch-1792234191216`
  3. 执行第 2 轮对话（使用切换后的模型）：
     `acpx --format json zcode -s probe-zcode-l1b-mswitch-1792234191216 "请只回答四个字：秋收冬藏"`
  4. 查阅 `~/.zcode/cli/db/db.sqlite` 表 `model_usage` 与 `part` 表。
- **原始证据**:
  - set 命令返回:
    `{"action":"model_set","modelId":"builtin:bigmodel-coding-plan\\GLM-5.3","resumed":false,"acpxRecordId":"e58236ee-f174-4f38-b084-af4df0fbb5d2","acpxSessionId":"30bd8676-8c6e-4e76-b11a-f8cd3b6346f2"}`
  - 对应 ZCode 原生会话 ID: `sess_fa375dbb-464d-444d-8e8b-3b6a84d30944`
  - `model_usage` 数据库行（直接 SQL 导出）：
    - **第 1 轮**:
      ```json
      {
        "id": "usage_model_main_turn_msg_mvc9z96h_cb7201a8-1b76-4e9b-84b6-ca4178f19fc9_0",
        "session_id": "sess_fa375dbb-464d-444d-8e8b-3b6a84d30944",
        "turn_id": "turn_742a2b1f-6452-4938-97f4-c675bde63242",
        "query_source": "main_turn",
        "provider_id": "account:bigmodel-individual-coding-plan",
        "model_id": "GLM-5.3-Flash",
        "status": "completed",
        "started_at": 1792234218042,
        "completed_at": 1792234223428,
        "input_tokens": 20896,
        "output_tokens": 61,
        "computed_total_tokens": 20957
      }
      ```
    - **第 2 轮**:
      ```json
      {
        "id": "usage_model_main_turn_msg_mvc9zhcv_07695111-c1d1-4bd1-b486-4eb859be4bd7_0",
        "session_id": "sess_fa375dbb-464d-444d-8e8b-3b6a84d30944",
        "turn_id": "turn_4f07db77-fb39-46f4-915d-9c0b51b48396",
        "query_source": "main_turn",
        "provider_id": "account:bigmodel-individual-coding-plan",
        "model_id": "GLM-5.3",
        "status": "completed",
        "started_at": 1792234228639,
        "completed_at": 1792234234487,
        "input_tokens": 21014,
        "output_tokens": 73,
        "computed_total_tokens": 21087
      }
      ```
  - `part` 表事件证实中途模型切换记录:
    `{"timelineType":"model_change","display":"separator","status":"completed","time":{"start":1792234013914},"toModel":{"providerID":"account:bigmodel-individual-coding-plan","modelID":"GLM-5.3"}}`
- **结论**: **Pass**（在同一个原生会话中，第 1 轮真实使用 `GLM-5.3-Flash`，经过 `acpx set model` 后，第 2 轮在 `model_usage` 表中明确记录切换为 `GLM-5.3` 满血档并正常完成）。

---

## 四、产物与测试脚本路径清单

1. **测试脚本**:
   - `channels/probe/scripts/retest/retest_workbuddy_l0.mjs` (L0 native-cli fork / model-new / model-switch)
   - `channels/probe/scripts/retest/retest_workbuddy_l1a.mjs` (L1a codebuddy-acp model-new)
   - `channels/probe/scripts/retest/retest_workbuddy_l1b.mjs` (L1b acpx model-new / model-switch)
   - `channels/probe/scripts/retest/retest_zcode_l1b.mjs` (L1b acp-bridge model-switch)

2. **完整原始数据落盘文件**:
   - `channels/probe/scripts/retest/wb_l0_retest_results.json`
   - `channels/probe/scripts/retest/wb_l1a_retest_results.json`
   - `channels/probe/scripts/retest/wb_l1b_retest_results.json`
   - `channels/probe/scripts/retest/zcode_l1b_retest_results.json`

3. **黑板追加记录**:
   - 已追加至 `channels/probe/blackboard.jsonl` 末尾（7 条记录，署名 `agy-pro-wb-zcode`）。
