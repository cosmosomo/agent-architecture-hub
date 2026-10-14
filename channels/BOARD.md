# 本地能力与渠道维护专门工作台 · 全局总控状态板（BOARD）

> **工作台定位**：纯本地文件原生的“能力渠道档案 + 实时风控/配额状态 + 版本升级感知与调研”专门工作台（不做冗余 Web 外壳，直接由人类、总调度 `A1` 与三位专门维护者 `S5 / S6 / S3` 读写维护，并与 `trace` / `hub` 自动联动）。
> **最后巡检时间**：`2026-10-14T12:55:00+08:00`（巡检脚本：`node hub/tools/check_channels.js`）

---

## 〇、状态灯与维护协议速查

| 状态灯 | 编码 | 含义与调度动作 | 恢复/变更条件 |
| :--- | :--- | :--- | :--- |
| 🟢 | `ok` | **可用**：能力已核验、版本对齐、无风控阻断，可按卡内安全参数正常派活 | 出现连续 2 次限频或首条契约报错立即降级 `🟡` |
| 🟡 | `cooldown_degraded` | **冷却中 / 部分降级 / 待维护**：存在间歇性风控、子命令局部故障或僵尸锁风险，需遵守卡内绕行参数 | 专门维护者（S5/S6/S3）定位根因、留存 SHA256 取证并复测通过后恢复（**单次通过不自动关闭历史疑难故障**） |
| 🔴 | `blocked_down` | **封禁 / 额度耗尽 / 停用**：IP 级封禁、上游 403 欠费或模型 404 不存在，**严禁调用**，强制走备选渠道 | 人工充值/解封或由维护者完成替代链路切换 |
| 🔒 | `auth_wall` | **登录墙**：未登录态结构性关闭，需人工在安全窗口复登浏览器 Profile | 用户补充登录态 Cookie / Profile 后由 S3 冒烟复测 |
| 🔍 | `upgrade_pending` | **检测到渠道升级 / 新能力待调研**：本机实测版本（`detected_version`）高于上次核验基线（`verified_version`），或本地目录/DB 出现新结构 | 维护者按 `upgrades/` 下的**《渠道升级调研单》**完成实测，回填渠道卡 `§2 独立能力矩阵` 与 `§4 版本演进` 后消标 |

---

## 一、域 A：智能体宿主渠道池（Agent Hosts · 责任维护者：`S5`）

> **维护铁律（原则 12）**：**跨平台互助排障**——某宿主挂死或异常时，严禁让该宿主自己排障，必须由另一健康宿主（如 ZCode 异常用 Claude Code / Codex 排查）读取日志与状态卡诊断。操作桌面进程（ZCode / WorkBuddy / AntiGravity / 豆包）必走**桌面安全六步 SOP**。

| 渠道 ID | 宿主名称 | 状态 | 升级感知 (`verified` → `detected`) | 锁持有者 | 维护者 | 核心能力档位 (`capabilities`) | 当前关键状态备注 & 独立档案卡 |
| :--- | :--- | :---: | :--- | :---: | :---: | :--- | :--- |
| `codex` | **OpenAI Codex CLI** | 🟢 | ✅ `0.159.2` (**4册基准已建**) | `shared` | **S5** | 读:`✅` 控:`✅` 插:`✅` 团:`✅` | 已完成 `0.159.2` 170 RPC/23 CLI 全量实测与勘误；主力 `gpt-6.1-sol` · [codex/](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/channels/hosts/codex/README.md) / [卡](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/channels/hosts/codex.md) |
| `claude-code` | **Claude Code CLI** | 🟢 | 🔍 `2.1.85` → **`2.1.296`** | `shared` | **S5** | 读:`✅` 控:`✅` 插:`✅` 团:`✅` | 新增 `--bg` / `agents --json` / `stop` / `attach`；A1 首选 · [claude-code.md](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/channels/hosts/claude-code.md) |
| `zcode` | **ZCode (CLI + 桌面)** | 🟢 | ✅ `0.16.9` (桌面 `3.14.3+`) | `shared` | **S5** | 读:`✅` 控:`🟡(CDP)` 插:`🟡(CDP)` 团:`✅` | `status=running` 不可信（8 个僵尸会话），必按 `mtime` 判活 · [zcode.md](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/channels/hosts/zcode.md) |
| `workbuddy` | **WorkBuddy / CodeBuddy** | 🟢 | ✅ `2.160.0` | `shared` | **S5** | 读:`✅(SQLite)` 控:`✅` 插:`🟡` 团:`✅` | 与桌面共用 Credits；中文 Prompt 必走文件；防泄露 `models.json` · [workbuddy.md](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/channels/hosts/workbuddy.md) |
| `antigravity` | **AntiGravity 桌面** | 🟡 | ✅ `CDP:9234` (`brain` 日志) | `shared` | **S5** | 读:`✅` 控:`🟡(CDP)` 插:`🟡(CDP)` 团:`✅` | `send` 易假成功（发后必读 `transcript.jsonl` 验真）；不让下判断 · [antigravity.md](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/channels/hosts/antigravity.md) |
| `doubao-desktop` | **豆包 Desktop** | 🟡 | 🔍 `CDP:9225` (监测外部 sessions) | `user-active` | **S5** | 读:`🔒(LevelDB)` 控:`🟡(CDP)` 插:`❌` 团:`✅(内置搜索)` | 用户在用严禁重启；已设本地目录指纹探针监测何时开放外部 sessions · [doubao-desktop.md](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/channels/hosts/doubao-desktop.md) |
| `gemini-cli` | **Gemini CLI** | 🟡 | ✅ `0.62.0` | `shared` | **S5** | 读:`✅` 控:`✅` 插:`🟡(ACP)` 团:`❌` | 未登录时运行 `--list-sessions` 会阻塞弹浏览器；已修复 `chats/` 扫描 · [gemini-cli.md](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/channels/hosts/gemini-cli.md) |
| `opencode` | **OpenCode CLI** | 🟢 | ✅ `1.18.33` | `shared` | **S5** | 读:`✅` 控:`✅` 插:`✅(serve)` 团:`✅(Task)` | 三层目录束 `storage/{session,message,part}`，支持 `--fork` · [opencode.md](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/channels/hosts/opencode.md) |
| `factory-droid` | **Factory Droid** | 🟢 | ✅ `0.228.0` | `shared` | **S5** | 读:`✅` 控:`✅` 插:`🟡` 团:`✅(Mission)` | 原生 Worker+Validator 双模型 Mission；已消解 `todo_state` 残差 · [factory-droid.md](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/channels/hosts/factory-droid.md) |
| `ap-vibe` | **AP-Vibe 托管工作台** | 🟢 | ✅ `:8876` (`agent-hub`) | `shared` | **S5/AP** | 读:`✅(HTTP)` 控:`✅(HTTP)` 插:`✅(Blackboard)` 团:`✅` | **铁律 P22**：严禁直读运行中 8876 的 SQLite，一律走 HTTP · [ap-vibe.md](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/channels/hosts/ap-vibe.md) |

---

## 二、域 B：模型与算力渠道池（Model Channels · 责任维护者：`S6`）

> **维护铁律**：所有 API Key 明文仅存放在 `E:\program\sota\协作环境\_private\凭证.md` 与本机私有配置中，**严禁在任何日志、卡片或终端回显密钥明文**；严禁在有活跃运行会话时强切 `ccswitch`。

| 渠道 ID | 渠道名称 | 状态 | 协议与绑定宿主 | 锁持有者 | 维护者 | 主力可用模型 | 当前水位与故障/绕行备注 & 独立档案卡 |
| :--- | :--- | :---: | :--- | :---: | :---: | :--- | :--- |
| `yinzi-api` | **银子智能 (`yinziapi.top`)** | 🟢 | OpenAI Responses / Chat (`ccswitch` Codex 主源) | `shared` | **S6** | `gpt-6.1-sol`、`gpt-6-luna`、`glm-5.3`、`deepseek-v4.1-flash` | **必挂代理 `127.0.0.1:7892`**；10-07 曾发生 403 额度耗尽熔断 · [yinzi-api.md](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/channels/models/yinzi-api.md) |
| `zhipu-glm` | **智谱 GLM (`bigmodel.cn`)** | 🟢 | Coding Plan / ZCode 内置 Start Plan | `shared` | **S6** | `glm-5.3`、`GLM-5.3-Flash` | 极快且便宜（3.9 万次调用）；偶发 429 窗口限流（640 次）可重试自愈 · [zhipu-glm.md](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/channels/models/zhipu-glm.md) |
| `volcengine-ark` | **火山方舟 (`volces.com`)** | 🟢 | OpenAI / Anthropic Plan 兼容 | `shared` | **S6** | `ark-code-latest`、`doubao-embedding-vision` | 探针 200 OK（~1.8s），额度充裕，适合大批量解析与备选路由 · [volcengine-ark.md](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/channels/models/volcengine-ark.md) |
| `anthropic-official` | **Anthropic 官方登录态** | 🟡 | Claude Code 原生 OAuth | `core-only` | **S6** | 满血 `Claude Opus` | **核心额度不多**：仅限 A1 总调度或关键架构设计使用，日常勿占 · [anthropic-official.md](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/channels/models/anthropic-official.md) |
| `2chat` | **2Chat 中转 (`2chat.cc`)** | 🟡 | Claude `2Chatkiro` 🟢 / Codex 🔴 | `shared` | **S6** | Claude: `Grok 4.6` / `opus5.5`<br>Codex: 🔴 禁用 | 对 Codex `gpt-6.1-sol` 报 **HTTP 404 `model_not_found`**，严禁切给 Codex · [2chat.md](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/channels/models/2chat.md) |

---

## 三、域 C：外部工具、搜索与站点采集渠道池（Tools & Sites · 责任维护者：`S3` + Codex `01a0f203`）

> **维护铁律**：媒体与社区渠道（C5）**全系统仅允许 `S3` 单实例串行调用**（速率 $\le 3$ 次/分钟），且必须以全机唯一运行时状态板 [`C:\Users\COLORFIRE\.zcode\skills\opencli-poweruser\local\channel-state\BOARD.md`](file:///C:/Users/COLORFIRE/.zcode/skills/opencli-poweruser/local/channel-state/BOARD.md) 为准（严禁孤岛状态板）；首条报错（如 `Navigation rejected`、`0B`、`429`）**立即停手保现场**，严禁盲目重试或重启浏览器抹掉现场；历史疑难故障（如小红书 `T1`）不因单次复测通过而自动关闭。

| 渠道 ID | 渠道/站点名称 | 状态 | 升级/适配器基线 | 锁持有者 | 维护者 | 安全间隔 & 并发上限 | 当前攻防状态与关键绕行规矩 & 独立档案卡 |
| :--- | :--- | :---: | :--- | :---: | :---: | :--- | :--- |
| `anysearch` | **AnySearch 联网搜索** | 🟢 | `anysearch@skill` (一主两备 Key) | `shared` | **S3** | 连续 2 次报错切备 Key | **不支持 `site:` 语法**（会被当普通词分词）；替代 Codex 空返回与 BOSS 封禁 · [anysearch.md](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/channels/tools-sites/anysearch.md) |
| `academic-rate-gate` | **学术与代码公开接口 (7 源)** | 🟢 | `rate_gate.py` 全局文件锁 | `shared` | **S3** | arXiv `3s` / S2 `5s` / OA `1s` / GH `60s` | 遇 HTTP 429 必跑 `rate_gate.py cooldown <源> 600` 全机同步冷却 · [academic-rate-gate.md](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/channels/tools-sites/academic-rate-gate.md) |
| `opencli-xiaohongshu` | **小红书 (`xiaohongshu`)** | 🟡 | `opencli@1.8.8+ext1.0.24` | `none` | **S3** | `search` $\ge 30\text{s}$，单实例串行 | **双通道分记**：已登录 `v6pz9gjx` `search` 🟢（`10-14` 通过），`note` 🟡 1.1s 报 `Navigation rejected`（`T1`）；匿名通道 🔒 · [opencli-xiaohongshu.md](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/channels/tools-sites/opencli-xiaohongshu.md) |
| `opencli-zhihu` | **知乎 (`zhihu`)** | 🟡 | `opencli@1.8.8+ext1.0.24` | `none` | **S3** | $\ge 20\text{s}$，单实例串行 | `topstory / hot / question` 🟢；`search` 🟡 `10-14` 复测 1.0s 报 `Navigation rejected` (`T1`) · [opencli-zhihu.md](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/channels/tools-sites/opencli-zhihu.md) |
| `opencli-job-sites` | **招聘站点 (`51job/boss/maimai/nowcoder`)** | 🟡 | `opencli@1.8.8+ext1.0.24` | `none` | **S3** | `51job` $\ge 10\text{s}$ | `51job search/detail` 🟢（`10-14` 20项通过，PS 必先 `chcp 65001`）；`51job company` 🟡 (`T9`)；`boss` 🔴 IP 封禁勿碰；`maimai` 🔒 403；`nowcoder hot` 🟢（`10-14` 通过） · [opencli-job-sites.md](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/channels/tools-sites/opencli-job-sites.md) |
| `opencli-communities` | **技术与综合社区 (`bilibili/reddit/v2ex/odysseia/hn/twitter`)** | 🟡 | `opencli@1.8.8+ext1.0.24` | `none` | **S3** | $\ge 15\sim 30\text{s}$ | `10-14` 16平台实测：`bilibili/juejin/gh-trending/tieba/weixin/weibo/odysseia` 🟢；`hn` 🟡 (`T3`)；`reddit/huodongxing` 🟡 后台 `Navigation rejected` (`T1`)；`v2ex` 🟡 10s超时 (`T4`)；`twitter` 🟡 `exit=66` (`T13`) · [opencli-communities.md](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/channels/tools-sites/opencli-communities.md) |

---

## 四、当前活跃“渠道升级调研单（Upgrade Research Queue）”

| 调研单编号 | 关联渠道 | 触发原因（基线对比差量） | 负责维护者 | 当前状态 | 调研单链接 |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `UPG-20261014-01` | `codex` | 版本从 `0.118.0` 升级至 **`0.159.2`**，已完成 23 个顶层 CLI 子命令、152 项 Feature Flags、170 个 `app-server` JSON-RPC 方法全量实测与 `hooks`/`goals` 伪子命令勘误，建成 4 册长期维护基准库 | **S5** | ✅ 已实测结项 | [2026-10-14_codex_0.118_to_0.159.2.md](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/channels/upgrades/2026-10-14_codex_0.118_to_0.159.2.md) |
| `UPG-20261014-02` | `claude-code` | 版本从 `2.1.85` 升级至 **`2.1.296`**，`--help` 新增 `--bg`、`claude agents --json`、`claude ps/logs/attach/stop`、`--forward-subagent-text` | **S5** | 🔍 并发深测中 | [2026-10-14_claude-code_2.1.85_to_2.1.296.md](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/channels/upgrades/2026-10-14_claude-code_2.1.85_to_2.1.296.md) |
| `WATCH-DOUBAO-01` | `doubao-desktop` | 持续监测豆包 Desktop 客户端更新后是否开放外部读取本地 `sessions`（新增 SQLite/JSON 落盘或本地接口） | **S5 / S3** | 👀 持续哨兵监测 | [WATCH_doubao-desktop_external_sessions.md](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/channels/upgrades/WATCH_doubao-desktop_external_sessions.md) |
