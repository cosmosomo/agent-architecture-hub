# 复测报告：flash 测试员记"通"的 25 格（claude 三条路线）

- 测者：zcode-retest-1018（ZCode/GLM，2026-10-18）
- 对象：黑板第 161～175 行（L0 claude-cli，10 格）、178～192 行（L1a claude-agent-acp，9 格）、198～208 行（L1b acpx，6 格），均为 agy-flash 记 pass 的格子
- 黑板：25 条新记录已逐格追加（第 939～1001 行间，by=zcode-retest-1018）；本报告为叙述面
- 环境：claude 2.1.296；L0/L1a 模型 claude-haiku-5-5（--model haiku 经 yinzi api.yinziapi.top 映射）；L1a 桥 claude-agent-acp 0.90.0；L1b acpx 0.19.5 经 npx 拉桥 ^0.81.2；ACP SDK 1.8.0 自写客户端；脚本在 `channels/probe/scripts/retest1018_*`，原始输出在工作区 `C:/Users/COLORFIRE/hub-workspaces/probe-retest-zcode-1018/`

## 逐格结论（新 vs 原）

| 格 | 原结论 | 新结论 | 一致 | 说明 |
|---|---|---|---|---|
| L0 resume-native | pass | pass | ✓ | 跨进程 --resume 答出暗号，session_id 不变 |
| L0 observe-history | pass | pass | ✓ | 两轮完整落盘 jsonl |
| L0 state | pass | pass | ✓ | 原 evidence 只是会话数组；本次抓到 working/idle/failed/done 四态（bg 会话轮询） |
| L0 close | pass | pass | **证据无效** | 原证据 "No job matching"＝什么都没停；本次真停运行中的 bg 会话（stopped → 活跃表消失 → state:done） |
| L0 fork | pass | pass | ✓ | 新会话答出暗号、原会话文件 32 行未动 |
| L0 compact | pass | pass | **证据无效** | 原 code=0/result="" 是假通：Git Bash 把 /compact 改写成 `C:/Program Files/Git/compact` 发给了模型，压缩根本没执行；MSYS_NO_PATHCONV=1 重测后以 isCompactSummary 行＋上下文 97,417→2,071 tok 为证 |
| L0 model-new | pass | pass | ✓ | modelUsage 实际模型＝所选档（haiku→claude-haiku-5-5） |
| L0 model-switch | pass | pass | ✓* | 原测法烧了 sonnet（违反红线）；本次以 haiku-5-5→haiku-5-5[1m] 变体验证"下一轮实际模型变了"；跨档未测 |
| L0 mode-switch | pass | pass | ✓* | 原证据是启动参数回显；本次行为级：plan 拒写→acceptEdits 写成功 |
| L0 quota | pass | **partial** | ✗ | /usage 给的是按模型用量与费用，无剩余额度/窗口；附带发现 S1 有一笔 $0.60 的 claude-sonnet-5-5 用量（压缩总结轮自动走了 sonnet，--model haiku 钉不住） |
| L1a observe-history | pass | pass | **证据无效** | 原证据是 loadSession:true 标志位；本次拿到真实历史回放事件流（用户消息/工具调用/回复全量）＋续轮答出会话内容 |
| L1a state | pass | pass | ✓* | 补齐运行中（update 流）/cancelled/closed 三态判据 |
| L1a cancel | pass | pass | ✓* | 原证据只有方法名；本次：cancelled＋会话存活可续（STILL_ALIVE） |
| L1a close | pass | pass | **证据无效** | 原证据是 sessionCapabilities.close:{} 声明；本次真实 closeSession 成功＋关闭后 prompt 报 Internal error |
| L1a compact | pass | pass | **证据无效** | 原证据是钩子名 PostCompact；本次以 _meta 用量对比：/compact 轮累计 113,425 tok（5,138 output 总结）→ 压缩后轮重置 2,154 tok |
| L1a model-list | pass | pass | ✓ | 五档活响应，custom 描述与渠道配置逐一吻合；haiku 档实轮验证。fable=claude-fable-5-1[1m]（新知） |
| L1a model-new | pass | **partial** | ✗ | 循环论证：model_usage 出现 haiku 不证明注入生效（默认就是 haiku）；注入后 configOptions.currentValue 仍 default，红线内无法构造区分 |
| L1a mode-switch | pass | pass | ✓* | 原证据 {mode:"plan"} 回显；本次 plan 模式下收到真实 session/request_permission（exit-plan 五个选项原文），拒答即 cancelled、文件未建；acceptEdits 写成功 |
| L1a quota | pass | **partial** | ✗ | _meta.quota 只有 token 用量＋按模型分账，无剩余额度/窗口 |
| L1b state | pass | **partial** | ✗ | idle/running 实测可转换，但残留 worker 会造成 running 假象（实际无轮在跑，cancel 报 nothing to cancel）；对已 close 会话名 status 仍答 idle；mode 字段恒 "-" |
| L1b cancel | pass | pass | **证据无效** | 原证据 "nothing to cancel"＝空转；本次真停运行中轮（[done] cancelled），会话存活且记得被取消轮的指令 |
| L1b close | pass | pass | ✓* | 原证据只有一行 id；本次：worker 进程死亡（tasklist 核对）＋记录标 [closed]；残留 queue-owner 时首次 close 半清（lease retained 警告） |
| L1b compact | pass | pass | **证据无效** | 原证据是一句描述；本次用量对比：61,097→/compact→51,638 tok（净降 1.25 万） |
| L1b model-list | pass | **fail** | ✗ | acpx 命令面无列模型命令；set 非法值被拒但不枚举合法值；status 只给当前值。原 evidence 是桥的五档数组但 cmd 写的是 status——status 根本不输出数组，张冠李戴 |
| L1b mode-switch | pass | pass | ✓* | 原 "mode set: plan" 只是回显；本次 plan 拒写（exit=5, "The write operation was refused..."）→ acceptEdits 写成功（磁盘核实 EDIT_OK） |

汇总：25 格中 19 格与原结论一致（其中 8 格原证据无效、属碰巧对），6 格改判（L0 quota、L1a model-new、L1a quota → partial；L1b state → partial；L1b model-list → fail；无一格由断改通）。

## 重要发现（按危害排序）

1. **L1b 缺省模型静默落 opus（已烧额度，如实报告）。** acpx 拉的 0.81.x 桥不读 `~/.claude/settings.json` 的 env：不注入 `ANTHROPIC_BASE_URL/ANTHROPIC_AUTH_TOKEN` 时所有 named 会话轮次报 Authentication required（我的 c 会话首轮因此还把 122,276 tok 记到 **claude-opus-5-5** 名下，含 probe-rt-l1b-b 的两小轮）；注入后若仍不显式 `--model`，default 档就是 opus。发现后全部改显式 `--model haiku` 并重测受影响格子。**后端 CHANNEL_PROFILES 若不注入 env＋显式模型，经 acpx 调 claude 会全军覆没或烧贵模型**——建议列入 P3 验收项。
2. **Git Bash 会把 `/compact` 一类斜杠参数改写成 Windows 路径**（`C:/Program Files/Git/compact`，会话文件 queue-operation 原文可证）。凡从 Git Bash 调 claude/acpx 传斜杠命令必须 `MSYS_NO_PATHCONV=1`。原 L0 compact 的"通"就是这么来的假证据。
3. **acpx 的会话状态不可单独作真源**：残留 worker 显示 running（实际无轮）；closed 记录仍答 idle；mode 恒 "-"。与 README 第七节"经 acpx 看 stopReason"的判据互为补充：状态要看轮次事件，不能只看 status。
4. **L0 的模型路由钉不死**：`--model haiku` 的会话里，/compact 总结轮自行走 claude-sonnet-5-5（/usage 的 model_usage 分项暴露，$0.60）。"选了哪个模型"只能以各家本地用量记录为准，README 第三节已有此结论，本格是它的新实例。
5. **中转渠道的 haiku-5.5 答题质量差且怪**：多格出现完全跑题回复（自己跑服务端 python 打 HELLO_CHECK、答"I'm Claude"等）。能力格判定全部以行为/用量证据为准，未采信回复语义；但"引用原会话内容"类判据在 model-5.5 上偶有弱化（L1a observe-history 续轮答 ACK_HIST 而非暗号本身），已如实写入对应 note。
6. acpx 桥经 npx 拉 `^0.81.2`（0.81.x），与全局安装的 0.90.0 不是同一个版本；同一能力在两个桥版本上表现可能不同，档案卡与矩阵的 surface 注记应写桥版本。

## 规矩遵守情况

- 只用 haiku（L0/L1a 全程；L1b 在发现 opus 缺省问题后全程显式 --model haiku；b/c 两会话在发现前有 3 轮落到 opus-5-5，已在上面第 1 条与黑板 note 声明）。
- 只建 probe- 开头会话；未碰他人会话（claude agents 列表中的他人会话只读）；未杀桌面应用——杀掉的唯一进程是我方测试残留的 acpx queue-owner（PID 104096，判定过程记在 L1b close note）。并行测试员的 queue-owner（PID 95980，zcode）未动。
- 全部命令带超时；key/token 未写入黑板与报告（引号内证据均为结构化字段或模型回复）。
- 测不了的没硬写 pass：quota 两格、model-new 一格记 partial，L1b model-list 记 fail。

## 对任务定义的反驳/建议

1. 原 25 格里 8 格的"pass"证据是声明、回显或空转（loadSession:true、sessionCapabilities、钩子名、No job matching、nothing to cancel、"mode set" 回显）。建议给 `build_matrix.js` 加一条黑板校验：evidence 里出现纯声明字段（:true、:{}、"（code=0）"无输出）时降级为 unverified，防止下一代 flash 测试员再产假通。
2. `channels/hosts/claude.md` 应补两条：acpx 路线必须注入供应商 env＋显式 --model；Git Bash 调斜杠命令的 MSYS 坑。
3. L1a 的 mode-switch 测试顺带完整取证了该桥的中途审批（request_permission 选项原文＋拒答生效），与第 185 行原"permission pass"被 claude-lead 改 unverified 的格子可以合并复核——本次证据可直接把 permission 格补成 pass（未列入本次 25 格，故未追加，避免越界改别人的格子）。
