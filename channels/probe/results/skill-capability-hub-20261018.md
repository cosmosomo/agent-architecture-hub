# 实测与交付：增强 local-capability-hub 技能（会话穿透、跨 Agent 协作闭环与一键同步）

- **测试员 / 执行者**：Antigravity (`agy-pro`)
- **执行时间**：2026-10-18T21:30:00+08:00
- **工作区**：`e:\program\GIT\Agent\multi\Agent-Architecture-Hub`
- **交付目标**：
  1. 增强 `local-capability-hub` Skill，让智能体学会查看本机其他智能体的会话（`/api/sessions`）、调用其他智能体（`dispatch` / `run`）、上报进度（`report`）、让出（`yield`）与完成交回（`deliver`）；
  2. 遵循“清晰比全面重要”原则，不硬编码易漂移命令，教智能体向运行中的系统探查（`agent_gateway.js tables` / `GET /api/capabilities`）；
  3. 比对并安全合并 `~/.agents/skills/local-capability-hub` 与正本差异；
  4. 实现 Skill 目录自带的一键全机同步功能（`sync_skill.js`），支持三态冲突识别、隔离安全备份（严禁污染各产品 skills 目录）、diff 报告与 SHA256 哈希复核；
  5. 真实链路端到端验收：派活给仅装载该 Skill 的 ZCode（GLM-5.3-Flash）会话，验证其零额外提示自主查阅 OpenCode 会话并派发暗号交回。

---

## 一、用户原话与目标对齐

### 1.1 用户原话（逐字）
> - 10-18 晚：“你派一个智能体把 /local-capability-hub 这个skill参考我们系统增强一下，让这个skill可以让agent学会如何借用我们的系统去学会调用其他智能体，查看其他智能体sessions。然后同步到电脑上所有的这个skill文件”
> - 最终目标：“我们的最终目标就是网页可以和操作gui一样简单，像原生应用一样简单，然后可以做更多功能拓展，并且暴露可以被agent调用的接口实现多智能体协作”
> - 清晰的标准：“清晰到什么程度呢？一眼没多少行的文档，就知道如何调用各家各层能力，如何维护，出bug如何处理。管线要非常清晰，没有什么冗杂的东西”
> - 补充要求：“这个skill得做一个一键同步的功能，识别冲突，处理，一键同步，做到skill里”

### 1.2 目标拆解与信息架构原则
- **极简管线**：文档控制在 150 行以内，不堆砌各家零散命令，而是以“四张表与中枢能力自省”为纲，教智能体问系统；
- **全生命周期闭环**：不仅教主调方怎么派活（`dispatch`），更教被派方如何识别派活单、中途上报（`report`）、让出（`yield`）和交付（`deliver`）；
- **会话全局穿透**：通过 `:8899/api/sessions` 穿透查看全机各产品运行态与单步执行历史，通过 `/api/search` 全文检索；
- **内生一键同步与隔离安全**：同步脚本直接内嵌在 Skill 目录 `scripts/sync_skill.js`，自动识别三态冲突，备份严格存放在 `~/.agent-hub/skill-backups/`，彻底杜绝被宿主误加载为新技能的风险。

---

## 二、正本与各副本状态比对与合并决策

### 2.1 变更前状态审查
- **正本位置**：`C:\Users\COLORFIRE\.cc-switch\skills\local-capability-hub`（SHA256: `DC580E6770192CBB257DEDD20B8029E0F0E83C09BCA3DF3B47A57B034F7D9E70`）
- **全机 11 处副本扫描**：
  - 9 处副本与正本哈希完全一致（`DC580E67...`）；
  - 2 处副本存在额外改动（`7176075272B43059549469CEA33D08EFE97D189B4517AAB5B3A1B500368CFAE9`）：
    1. `C:\Users\COLORFIRE\.agents\skills\local-capability-hub`
    2. `C:\Users\COLORFIRE\AppData\Local\Doubao\User Data\Default\.doubao\agent_mode\workspace\.user_skills\local-capability-hub`

### 2.2 差异分析与合并方案
比对发现 `.agents` 与 `Doubao (Default)` 副本在第 78 行增加了关于 Antigravity 原生通道与巡检的实战经验：
```markdown
> **Antigravity 原生通道与巡检实战（agentapi + Connect-RPC，非 CDP）**：LS 自动发现、会话状态库、卡死判定、eager 无审批等经验见 opencli-poweruser 适配器卡 `references/adapter-antigravity.md` 第十七节。巡检脚本 `C:\Users\COLORFIRE\Doubao\chats\2026-10-18\new-chat-2\agy_patrol.js` + 常驻守护进程 `agy_patrol_daemon.js`（每 15 分钟检测卡死会话并 `send-message` 重试，日志 `agy_patrol.log`；注意：周期调度勿用 Windows 计划任务，锁屏会挂起）；网关查状态 `agent_gateway.js status --agent antigravity`。
```
**合并决策**：该内容属于非常有价值的真实落地经验，予以完整保留并吸收合并进正本 `SKILL.md` 的第三节“跨 Agent 协作闭环”末尾，实现全机统一。

---

## 三、Skill 核心增强设计

### 3.1 YAML Frontmatter Description 精准触发器
针对各智能体产品（Claude、Codex、ZCode、Gemini 等）仅读取 description 判断是否加载技能的机制，全面升级了描述与触发词：
```yaml
description: >-
  本机 AI 全能力与协作中枢总控 Skill（会话穿透与跨 Agent 协作网关 + 22 把搜索 Key 自动轮换 + 四张表能力查询 + 一键同步 + 30+ 把大模型明文 Key）。
  当需要：① 查看本机各产品（Codex/Claude/ZCode/WorkBuddy/OpenCode/Antigravity/豆包等）正在运行的会话列表与步轮历史（/api/sessions）、会话全文检索；
  ② 跨智能体派发任务（dispatch）、交回结果（deliver）、上报进度（report）、让出等待（yield）与会话唤醒；
  ③ 查询本机运行中能力四张表（tables）与接口元数据（/api/capabilities）；
  ④ 联网搜索（Tavily/SerpApi/AnySearch 22-Key 轮换）与网页正文提取（Markdown）；
  ⑤ 技能一键同步与冲突比对（sync_skill）；
  ⑥ 查询各站余额配额或使用大模型明文 Key 时使用本 skill。
  触发词：查看会话、看别人会话、sessions、跨Agent调用、派活、dispatch、交回、deliver、让出、yield、agent_gateway、四张表、能力矩阵、capabilities、联网搜索、search_hub、同步skill、sync_skill、能力渠道。
```

### 3.2 技能正文结构（148 行精简管线）
1. **一、运行中系统与能力自省**：
   - 端口：`http://127.0.0.1:8899`
   - 四张表查询：`node hub/tools/agent_gateway.js tables` 或 `GET /api/capabilities`
   - 目标健康态与默认模型：`node hub/tools/agent_gateway.js targets`
   - 查账查额度：`node hub/tools/agent_gateway.js quota`
2. **二、穿透查看其他智能体的会话**：
   - 列出全机会话（产品、状态、步数、所有权）：`GET /api/sessions?slim=1`（支持 `?channel=<产品>&limit=10`）
   - 查看指定会话每步细节（思考、工具执行）：`GET /api/sessions/<ID>?compact=1&tail=1`
   - 会话全文检索：`GET /api/search?q=<关键词>`
3. **三、跨 Agent 协作闭环**：
   - 主调方派活：
     - 同步派活（阻塞等待结果）：`agent_gateway.js dispatch --to <产品> --to-session <会话名> --task "..."`
     - 异步派活（本端让出，自动唤醒）：`agent_gateway.js dispatch ... --from <产品> --from-session <会话> --wake-caller --async`
     - 查派活单与回执四态（issued/delivered/seen/returned）：`agent_gateway.js dispatches` / `dispatch-wait --id <ID>`
     - 基础单轮运行与续接：`agent_gateway.js run` / `read` / `wait`
   - 被派方交回与上报（派活单提示词自带 ID 与约定）：
     - 中途汇报进度（不打断轮次）：`node hub/tools/agent_gateway.js report --id <ID> --text "..."`
     - 完成交回：`node hub/tools/agent_gateway.js deliver --id <ID> --summary "..."`（或回复末尾附 `【交回】...`）
     - 阻塞让出：`node hub/tools/agent_gateway.js yield --id <ID> --waiting-for "..."`（或回复末尾附 `【让出：...】`）
   - Antigravity 原生通道与巡检经验
4. **四、技能一键同步与冲突保护（`sync_skill.js`）**
5. **五、22 把 Key 自动轮换搜索与网页提取（`search_hub.js`）**
6. **六、大模型明文密钥库与社媒/学术门禁（`opencli` · `rate_gate.py`）**

---

## 四、内生一键同步与冲突保护机制（`sync_skill.js`）

### 4.1 设计亮点
1. **三态状态判定**：比对 Canonical（正本）、Replica（副本）与 `.sync-manifest.json`（上次同步基线），准确区分：
   - `IN_SYNC`：哈希完全一致；
   - `SAFE_UPDATE`：正本更新，副本未被单独修改，可安全覆盖；
   - `CONFLICT_TARGET_MODIFIED`：正本未动，副本被本地独立修改；
   - `CONFLICT_BOTH_MODIFIED`：两端均有独立修改。
2. **防覆写安全气囊（隔离备份）**：
   - 严禁向任何宿主的 `skills/` 目录存放 `.backup` 或 `.conflict` 文件夹（否则会被宿主扫描加载为全量密钥的重复技能）；
   - 所有备份统一隔离存放至 `C:\Users\COLORFIRE\.agent-hub\skill-backups\<hostLabel>_local-capability-hub.<tag>.<timestamp>`。
3. **差异高亮输出**：遇到冲突输出逐行 diff 片段，阻断并提示操作。
4. **全机覆盖与哈希验证**：同步后对全部 11 个目录执行 SHA256 强校验。

### 4.2 冲突识别实测验证（注入测试）
1. **人工注入冲突**：在 `C:\Users\COLORFIRE\.codex\skills\local-capability-hub\SKILL.md` 注入行 `# TEST_CONFLICT_LINE_FOR_VERIFICATION`；
2. **安全同步拦截测试**：运行 `node hub/tools/sync_skill.js`，控制台立即捕获：
   ```
   [🔴 CONFLICT_TARGET_MODIFIED ] C:\Users\COLORFIRE\.codex\skills\local-capability-hub
        └─ SKILL.md (CONFLICT_TARGET_MODIFIED): 2 diff lines
           Diff excerpt:
             + [Target:157] # TEST_CONFLICT_LINE_FOR_VERIFICATION
   ❌ Sync blocked: One or more targets contain local modifications (conflicts).
   Automatic safety intervention:
      - Backed up conflicting replica: C:\Users\COLORFIRE\.codex\skills\local-capability-hub -> C:\Users\COLORFIRE\.agent-hub\skill-backups\codex_local-capability-hub.conflict.2026-10-18T13-31-10-513Z
   ```
3. **强制覆盖同步测试**：执行 `node hub/tools/sync_skill.js --force`，自动在 `skill-backups/` 完成隔离归档后完成分发；
4. **二次复核验证**：执行 `node hub/tools/sync_skill.js`，全部 11 处目标呈现 `🟢 IN_SYNC`，哈希 100% 一致（`ff7f7d112b28549b374b6399e45267031cad7ade5f60c8ba6743ab9d508cef2f`）。

---

## 五、真实链路端到端验收证据

### 5.1 验收会话与派活单基本信息
- **主调派发命令**：
  ```powershell
  node hub/tools/agent_gateway.js dispatch --to zcode --to-session probe-skill-learner-1018 --task "看看本机最近有哪些智能体在干活，挑一个 OpenCode 的会话告诉我它最后一轮做了什么；再派一个任务给 OpenCode 让它回复一个暗号并交回" --async
  ```
- **核心标识数据**：
  - **主派活单 ID**：`dsp_133456_dg9e`
  - **主会话所属产品**：`zcode`
  - **主会话名称**：`probe-skill-learner-1018`
  - **主会话追踪 ID**：`zcode:sess_f148673d-6498-4bd8-847a-e219cbdd7c62`
  - **主运行 ID**：`run_1792330496548_96jw`
  - **被测模型**：`builtin:bigmodel-coding-plan\GLM-5.3-Flash`
  - **下层派生单 1**：`dsp_133719_az5d`（目标 `opencode/probe-collab-opencode-1018`，遭遇 big-pickle 免费网关风控 403）
  - **下层派生单 2**：`dsp_133957_m8bz`（ZCode 尝试指定 GLM-5.3 进行结构化尾注回执校验，返回 `VERIFY_DSP_ZCODE_10181338` 成功）
  - **下层派生单 3（闭环完成单）**：`dsp_134047_o7h2`（目标 `opencode/probe-codeword-1018`，指定模型 `zhipuai-coding-plan/glm-5.3-flash`，成功获取暗号握手回执）

### 5.2 ZCode 智能体自主行为轨迹（零额外提示、纯依 Skill 指引）
1. **自动识别并装载 Skill**：
   ZCode 在收到派活后，首先输出：
   > “收到派活单。这个任务需要用到本机能力中枢（查会话 + 跨 Agent 派发），先加载对应 Skill。”
2. **中途主动上报进度（`report`）**：
   ZCode 依据 `SKILL.md` 规范，在执行过程中主动调用网关：
   ```json
   {
     "at": "2026-10-18T13:36:18.354Z",
     "text": "已加载中枢 Skill，开始查询全机智能体会话列表",
     "via": "cli"
   }
   ```
3. **调用中枢穿透查询会话（`/api/sessions?slim=1`）**：
   ZCode 成功获取全机 1590 个会话，并提取出最近活跃的 OpenCode 会话：
   > “本机概况已清楚：目前最活跃的是 Antigravity（多个任务书在跑）和 Claude（HUB人机交互架构清晰化，182 轮），OpenCode 最近活跃会话是 `probe-collab-opencode-1018`（5 轮，12:36 更新）。”
4. **穿透查看 OpenCode 单步历史（`/api/sessions/<id>?compact=1&tail=1`）**：
   ZCode 成功读取到该会话最后一轮（12:36Z）系回复 Hermes 派活单 `dsp_123117_368i`，以【交回】尾注确认链路畅通。
5. **跨智能体派发暗号任务（`dispatch`）与自主故障重试**：
   - 首次派活：向 OpenCode 续接会话派发暗号握手任务，遭遇 OpenCode 默认模型 `big-pickle` 免费网关风控拦截（403 Abuse Traffic）；
   - 自主查表排障：ZCode 查阅中枢能力表与网关参数，发现 OpenCode 还支持智谱和 DeepSeek 模型，且旧会话绑定了模型名，因此决策“新建会话名 `probe-codeword-1018` + 指定 `--model zhipuai-coding-plan/glm-5.3-flash`”重试；
   - 第二次派活成功：OpenCode 新会话成功启动，执行并在回复中调用 CLI `deliver`：
     ```json
     {
       "id": "dsp_134047_o7h2",
       "status": "completed",
       "receipt": "returned",
       "delivery": {
         "via": "cli",
         "summary": "握手成功，暗号：XINGHUO-HUB-1018",
         "reply": "握手成功，暗号：XINGHUO-HUB-1018"
       }
     }
     ```
6. **完成交回并向中心汇总报告（`deliver`）**：
   ZCode 验证暗号无误后，调用 `node hub/tools/agent_gateway.js deliver --id dsp_133456_dg9e`，交回最终完整结论：
   > **交付摘要（Delivery Summary）**：
   > “任务完成：本机9个渠道1590会话，当前最活跃为Antigravity多任务书与Claude架构会话；OpenCode会话probe-collab-opencode-1018最后一轮(12:36Z)系回复Hermes派活dsp_123117_368i，以【交回】尾注确认hermes→OpenCode链路畅通；随后向OpenCode新会话probe-codeword-1018(glm-5.3-flash)派单dsp_134047_o7h2成功，其经CLI deliver交回暗号「XINGHUO-HUB-1018」，握手闭环；注意OpenCode默认big-pickle模型现被免费网关风控(Forbidden abuse traffic)，跨会话需指定zhipuai/deepseek模型并配新会话名。”

---

## 六、四张表核对与系统健康检查

在交回前执行全机管线自检命令：
```powershell
node hub/tools/agent_gateway.js tables
```
**核对结果**：
- 动作表（Actions）：全部路由与方法 100% 对应；
- 单元 → 动作映射表（Integration Map）：34 个能力单元与后端接口全部对齐；
- 唯一现存提醒：`hermes 还没有档案卡`（为此前既有已知项，无新增问题）；
- 证据核对：黑板行与运行单据全部合法真实。

---

## 七、交付物清单与副本哈希一览

### 7.1 文件变更清单
1. **正本技能说明书**：`C:\Users\COLORFIRE\.cc-switch\skills\local-capability-hub\SKILL.md`（精炼管线，明确指向 `sync-targets.json` 与 `~/.agent-hub/skill-backups/` 隔离备份）；
2. **全机同步真值表清单（Single Source of Truth）**：
   - `C:\Users\COLORFIRE\.cc-switch\skills\local-capability-hub\sync-targets.json`
   - `E:\program\GIT\Agent\multi\Agent-Architecture-Hub\hub\data\skill-sync-targets.json`
3. **内生一键同步脚本**：
   - `C:\Users\COLORFIRE\.cc-switch\skills\local-capability-hub\scripts\sync_skill.js`
   - `E:\program\GIT\Agent\multi\Agent-Architecture-Hub\hub\tools\sync_skill.js`
4. **PowerShell 同步入口封装**：`E:\program\GIT\Agent\multi\Agent-Architecture-Hub\hub\tools\sync_capability_skill.ps1`
5. **全量明文密钥主档更新同步**：`C:\Users\COLORFIRE\.cc-switch\skills\local-capability-hub\references\keys-and-endpoints.md`（吸纳 OpenCLI 三边界治理）
6. **本次实测交付报告**：`E:\program\GIT\Agent\multi\Agent-Architecture-Hub\channels\probe\results\skill-capability-hub-20261018.md`

### 7.2 全机宿主技能目录勘测结论
- **豆包（Doubao / DoubaoWork）**：全部 3 个路径（`Profile 3`、`DoubaoWork Default`、`Doubao Default`）均真实存在并纳入统一同步管理；
- **Antigravity / Gemini CLI**：主技能注册目录为 `C:\Users\COLORFIRE\.gemini\config\skills\local-capability-hub`，实测已在当前运行态完全识别；
- **Hermes**：宿主配置目录为 `~/.hermes/`，经实测勘测其未设立原生 `skills/` 规范目录（通过 `config.yaml` 与 LSP 进行能力集成）；
- **Factory / Droid**：宿主目录为 `~/.factory/`，采用 `droids/*.md` 角色定义文件，非标准 `SKILL.md` 规范。

### 7.3 全机 11 处副本 SHA256 哈希复核
正本 SHA256：`2cfabcc925d64644dee1dd35703fb39cf797fef1c67530b8d0faa1e9edc2d7ae`

| 序号 | 宿主位置 | 状态 | SHA256 校验结果 |
|---|---|---|---|
| 1 | `Agent-Architecture-Hub\channels\_private\local-capability-hub` | 🟢 IN_SYNC | `2cfabcc925d64644...` |
| 2 | `C:\Users\COLORFIRE\.claude\skills\local-capability-hub` | 🟢 IN_SYNC | `2cfabcc925d64644...` |
| 3 | `C:\Users\COLORFIRE\.codex\skills\local-capability-hub` | 🟢 IN_SYNC | `2cfabcc925d64644...` |
| 4 | `C:\Users\COLORFIRE\.zcode\skills\local-capability-hub` | 🟢 IN_SYNC | `2cfabcc925d64644...` |
| 5 | `C:\Users\COLORFIRE\.workbuddy\skills\local-capability-hub` | 🟢 IN_SYNC | `2cfabcc925d64644...` |
| 6 | `C:\Users\COLORFIRE\.config\opencode\skills\local-capability-hub` | 🟢 IN_SYNC | `2cfabcc925d64644...` |
| 7 | `C:\Users\COLORFIRE\.gemini\config\skills\local-capability-hub` | 🟢 IN_SYNC | `2cfabcc925d64644...` |
| 8 | `C:\Users\COLORFIRE\.agents\skills\local-capability-hub` | 🟢 IN_SYNC | `2cfabcc925d64644...` |
| 9 | `DoubaoWork\User Data\Profile 3\...\local-capability-hub` | 🟢 IN_SYNC | `2cfabcc925d64644...` |
| 10 | `DoubaoWork\User Data\Default\...\local-capability-hub` | 🟢 IN_SYNC | `2cfabcc925d64644...` |
| 11 | `Doubao\User Data\Default\...\local-capability-hub` | 🟢 IN_SYNC | `2cfabcc925d64644...` |

**结论**：全部 11 处副本哈希 100% 一致，真值表 registry 统一入库，隔离备份机制完好无损，多智能体闭环调用实测完美通过。
