---
channel_id: workbuddy
name: Tencent WorkBuddy / CodeBuddy CLI
category: host
maintainer: S5
status: 🟢 ok
upgrade_status: ✅ synced
verified_version: "2.160.0"
detected_version: "2.160.0"
holder: shared
last_verified_at: "2026-10-14T12:15:00+08:00"
capabilities:
  observe_only: true
  external_session_read: true
  control_lifecycle: { start: true, resume: true, fork: true, stop: true }
  steer_in_turn: { in_turn: true, next_turn: true, inbox_file: true }
  coordinate_team: { spawn_subagent: true, peer_message: false, task_board: true }
---

# WorkBuddy / CodeBuddy (`workbuddy`) · 宿主能力与渠道维护档案卡

## 一、渠道身份与接入入口
- **角色定位**：高性价比备用调研主力（与桌面版共享腾讯官方 Credits 池，且可通过 `--model custom-local:glm-5.3` 直接复用 `~/.workbuddy/models.json` 中的智谱 Coding Plan 额度）。
- **推荐模型**：优先 `--model "custom-local:glm-5.3"`（走本地 BYOK 智谱 Coding Plan，不耗腾讯官方 Credits），或 `deepseek-v4.1-flash` / `glm-5.3-flash`。
- **无头 ACP 统一调用入口（首选，`acpx workbuddy`）**：
  - `node hub/tools/agent_gateway.js run --agent workbuddy --session <name> --prompt "<text>"`
  - 或直接调 `acpx --format json --approve-reads --model "custom-local:glm-5.3" workbuddy -s <name> "<prompt>"`
  - **三大关键环境变量（已由 `agent_gateway.js` 自动注入）**：
    1. `CODEBUDDY_CONFIG_DIR="C:\Users\COLORFIRE\.workbuddy"`（确保读取 `.workbuddy/models.json` 而非 `.codebuddy`）；
    2. `ACC_PRODUCT_CONFIG_V3='{"authentication":{"type":"custom-token","attributes":{"token":"wb-local-byok"}}}'`（绕过 WorkBuddy Desktop 5.8.2 的 `$wbEncrypted` sidecar 落盘加密鉴权门禁，直接激活 `CustomTokenAuthenticationStorageImpl`）；
    3. `--model "custom-local:glm-5.3"`（因 `2.160.0` 官方内置模型表新增同名 `glm-5.3`，`CustomModelsProductProvider` 会给用户 `models.json` 模型自动加 `custom-local:` 前缀）。
- **CLI 入口（`codebuddy` `v2.160.0`）**：
  - 非交互执行：`codebuddy -p "<prompt>" -y --output-format json --model "custom-local:glm-5.3"`
  - 恢复会话：`codebuddy -c`（最近一次）或 `codebuddy -r <session_id>`
  - 服务与协议模式：`codebuddy --acp`（已在 `acpx` 完整跑通多轮会话恢复）、`codebuddy --serve`、`codebuddy --bg`、`codebuddy agents --json`
- **本地会话落盘位置**：
  - 主数据库：`~/.workbuddy/workbuddy.db`（SQLite，实测含 135 个历史会话、121 次自动化运行）
  - 进程心跳文件：`~/.workbuddy/sessions/<pid>.json`

## 二、独立能力矩阵（逐项核验记录）
| 能力维度 | 子能力项 | 支持度 | 精确命令 / 协议 / 字段依据 | 核验版本 & 证据 |
|---|---|---|---|---|
| **外部读 Sessions** | SQLite 主库与 PID 心跳读取 | ✅ 原生支持 | 只读查询 `~/.workbuddy/workbuddy.db` + `~/.workbuddy/sessions/<pid>.json` | `2.160.0` `〔实测:135会话〕` |
| **生命周期控制** | 启动 / 恢复 / 后台守护 | ✅ 原生完备 | `acpx workbuddy -s <name>` / `codebuddy -p -y` / `-c` / `-r <sid>` / `--bg` / `codebuddy stop <id>` | `2.160.0` `〔实测:T13/T07通过〕` |
| **运行中插话与 ACP** | 原生 `codebuddy --acp` 协议 | ✅ 原生完备 | `acpx workbuddy` + `codebuddy --acp`（支持持久会话、流式事件、Token 计量与模型枚举） | `2.160.0` `〔实测:T13通过〕` |
| **团队与子智能体** | 内置子代理派生 | ✅ 原生支持 | `codebuddy agents --json` + 内置 `Task` / `Agent` 工具 | `2.160.0` `〔实测〕` |

## 三、当前状态、安全参数与防呆红线
- **当前状态**：🟢 可用
- **安全参数与防呆红线**：
  1. **必带 `custom-local:` 前缀与 `ACC_PRODUCT_CONFIG_V3`**：直接传 `--model glm-5.3` 会命中腾讯官方内置模型并报 `Authentication required`；必须传 `--model "custom-local:glm-5.3"` 并注入 `CODEBUDDY_CONFIG_DIR` 与 `ACC_PRODUCT_CONFIG_V3`；
  2. **Windows 中文 Prompt 必走文件读取或 `agent_gateway.js`**：在 PowerShell 中直接把长段中文塞进裸 CLI 极易因编码截断乱码；
  3. **禁用驼峰 `--dangerously-Skip-Permissions`**：该写法在 CodeBuddy 中无效，一律用 `-y` 或全小写 `--dangerously-skip-permissions`；
  4. **密钥防泄漏红线**：`~/.workbuddy/models.json` 中存有明文第三方 API Key，严禁将该文件纳入任何公开导出或原文回显。

## 四、渠道升级与功能演进日志
- **2026-10-14 · 打通 `acpx workbuddy` (`codebuddy --acp`) 无头 ACP 与 `custom-local:glm-5.3` 鉴权旁路**：逆向定位 `$wbEncrypted` 落盘加密与 `CUSTOM_LOCAL_MODEL_PREFIX` 冲突根因，实测多轮会话恢复 100% 通过。
- **2026-10-01 ~ 10-14 · 基线核验 `2.160.0`**：确认 CLI 与桌面版 Credits 池互通及 BYOK 可用。

## 五、状态变化与故障/攻防时间线
- **2026-10-01 · 🟢 解决中文命令行编码截断**：确立“文件传参优先 + `chcp 65001`”规矩。

## 六、维护者（S5）挂账与待办
- [ ] 后续可在 `trace/packages/adapters/` 新增 `workbuddy` SQLite 只读适配器，将 `~/.workbuddy/workbuddy.db` 的 135 个会话并入观察台。
