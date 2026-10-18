# L3 前端实测报告 · zcode-glm-L3（2026-10-17）

范围：`/console/`（console/index.html + console.js）与首页对话抽屉（hub/js/obs/chat.js + hub/js/obs/sessions.js，挂载 index.html:108-109，会话头由 trace.js:427 渲染）。方法：全量控件清单（`zcode-glm-L3-controls.md`，每条带 文件:行→接口→calls→verdict）＋自起 :8933 实例用与前端相同的请求体实测 5 个关键控件（脚本 `scripts/zcode-glm-L3-live.mjs`，日志 `scripts/tmp/zcode-glm-L3-live2.log`，被测 zcode GLM-5.3-Flash）。黑板追加 35 条（828→863 行，校验通过）。

## 一、真动作（点下去后端确实发生了）

- **发送**（POST /api/gateway/send，chat.js:1969 字段正确版 / console.js:1548 字段缺陷版）：实测 reply「OK-L3A（暗号 L3HUB2026 已记下）」。6 家走 acpx ensure+prompt（gateway.ts:4184-4238），AGY 走 agentapi（3647-3651）。
- **续接**：同槽位第二轮实测复述暗号「L3HUB2026」——`-s` 槽位续接真实。但对左侧树里的**原生会话**（codex:<uuid> 等），sessionName 解析不到 acpx 记录 → 落 `hub-<ch>` 空槽（gateway.ts:3389-3406），是假续。
- **取消**（POST /api/gateway/cancel）：实测 run 立即消失、底层 12s 无新消息、会话可续（reply「OK-L3C」）。acpx cancel（3557）/ AGY Connect-RPC（3531-3551）。
- **观察类**（/api/sessions 列表、tail/before 分页、tree、档案检索）：只读旁路 adapters，通。
- **巡检**（meta-agents/patrol）与**元智能体配置**（meta-agents）：真实拉大脑会话、配置被巡检定时器消费（gateway.ts:903）——每次巡检是一次真实模型调用。
- **跨渠道接力**（handoff）：目标渠道真收到一轮，但只带最近 3 轮、输入截 260 字/输出截 320 字的摘要（gateway.ts:3292-3329），「无缝打包」是夸大；toModel 不在白名单时被静默换回（3311-3314）。
- **chat 权限切换按钮**（toggle-perm，chat.js:2084）：接通——靠顺带停用 meta_approver 实现；权限本身仍是 acpx 启动旗标，非轮中审批。

## 二、假闭环

1. **console 权限下拉＝接错路**：console.js:1551-1558 发字段 `permissionMode`，server.ts:226-231 只读 `permissions` → 参数整体被忽略，恒 `--approve-all`。实测 deny-all 下 `l3-perm-console.txt` 照建（内容 hi）。显示它的 4 家（codex/claude/workbuddy/opencode）全部无效。
2. **审批横幅**：审批项是轮次**结束后**对输出做正则 `/permission|denied|…|拒绝执行/i` 产出（gateway.ts:3960-3987）；「批准」＝重发提示词带 `--approve-all`（3226-3241）。且 meta_approver 默认把 reads 静默升级 all（3414-3426，实测 reads 却 CREATED、pendingApprovals=0）→ 默认配置下横幅根本不可达。
3. **＋新建会话**：createNewSession 只写内存 draft（gateway.ts:2203-2250），toast 称「已创建」，实测 acpx 文件 58→58，首轮 send 才落盘。
4. **模型下拉对做不到/未验证的渠道照常显示**：opencode（L0 已证无效 MATRIX 345、L1b ❓738）、claude（❓219）两端都显示；真能切的 codex（✅677）、hermes（✅591）在 chat 抽屉反而被 Profile 硬编码隐藏——同一能力两个前端一砍一留。AGY：console 连新建选模型都不给（agentapi `--model` tier 其实通，MATRIX 420），chat 抽屉却给了。
5. **「中断并插队/立即插队」名不副实**：实现是 cancel+新开一轮（gateway.ts:3439-3440），不是轮内插话（ACP 无 steer）。
6. **离线默认渠道表是编造的**（console.js:8-61）：claude=glm-5.1、zcode=GLM-5.1/GLM-5-Turbo 等真机不存在的模型清单，与 gateway recommendedModels 又是两套硬编码。

## 三、死按钮与重复入口（HANDOFF 病灶 1「拥挤、重复」核实：属实）

- **死按钮**：console 实况条 `data-jump-session`/`data-jump-run`（console.js:714/724 渲染成 button，bindEvents:2213-2431 无任何分支）。
- **重复**：新建会话 console 6 处＋抽屉 3 处；模型选择 chat 2 处（会话头 trace.js:468＋composer chat.js:1646 同调 switchModel）＋console 1 处，模型表两页各一套；渠道切换两页各 2 处（console 胶囊=过滤、下拉=发送目标，语义不一致）；取消 chat 3 处＋console 2 处＋2 死药丸；巡检共 5 处；审批 console 2＋chat 1；续跑同目的两套实现两个接口（console 重发固定提示词 vs chat 走 /api/gateway/resume）；接力 console 4＋chat 1。console 与首页抽屉是两套平行 UI 调同一后端，本身就是最大重复。

## 四、回复翻倍（OK-L3NOK-L3N）的原因——已定位

- **直接原因（L2 网关合并缺陷，代码位置确凿）**：`run.text` 有两个互不去重的写入方——① 流式追加：`handleAcpxLine` 对每帧 `agent_message_chunk` 无条件 `run.text += u.content.text`（gateway.ts:4303-4305）；② 600ms 文件轮询：`syncFromAcpxSessionFile` 取记录里**最后一条 agent 消息**的全部 Text 重建全文，**仅在更长时才替换**（gateway.ts:4442-4444）。T3 轮的实际时序只能是：轮询先写入「OK-L3N」（6>0），流帧随后追加同一文本 →「OK-L3NOK-L3N」（12）；此后全文 6 字永不大于 12，无人纠正。两个来源各只含一份文本（解析记录与流帧均为单份），唯一能凑出 12 字的路径就是「先轮询、后追加」，此结论由帧计数＋长度算术唯一确定。
- **底层诱因（L1b/acpx 层）**：该轮同一 acpx 记录（85d7e111-*.json）里落了 **4 条消息：User→Agent(OK-L3N)→User→Agent(OK-L3N)**——一次 send 在记录里出现两轮问答；其 .stream.ndjson 里同轮有两次握手：`session/resume`（id:1）后跟 `session/new`（id:2）、两个不同 sessionId。即同一记录被两个 ACP 会话驱动、回复落了双份。哪一侧进程触发第二次投递（ensure 与 prompt 是两个桥进程）现有证据不足以指认。另注意 `session/resume`+`session/new` 双握手也出现在 probe-L3-send 的流里——draft 槽位首次发送被投递两次意味着**重复执行、双倍副作用**，建议负责人单独立项复测。

## 五、只保留「唯一真值入口」时，页面最少需要的控件

1. 渠道+会话选择（一处，含真实状态灯）；2. 输入框＋发送（运行中自动变「排队」，旁挂一枚「停止」）；3. 新建会话（一处，草稿态标「未创建」）；4. 模型下拉（仅当 (channel,surface) 下层真能切时渲染；模型表取自协议层 availableModels，非硬编码）；5. 审批条（只在**轮中**真有挂起审批时渲染——现假审批机制替换前应整体删除）；6. 接力/巡检/总管配置/CWD/断点续跑全部收进单一「高级」面板或砍掉。按此口径，两页约 60 组控件可收敛到约 10 组。

## 六、没把握 / 未验证

切模型只到配置层证据（record＋每轮 `--model` 参数，无下一轮实际模型字段，与 MATRIX 553 的 ⚠ 同限）；AGY 取消是代码路径结论未实测（桌面端在运行，规矩禁触）；中断实测落在工具未落首条消息的窗口，「打断执行中工具」那半不如「打断后可续」硬；巡检/总管配置/接力为代码路径闭环＋间接证据（events.jsonl 的 meta-brain-supervisor 轮）。对任务定义的一点补充：L3 判定需要第三个维度「请求体字段是否被后端读取」（console 权限下拉：200 返回但字段名错，整条链路是装饰），此类统一记「接错路」，黑板已按此执行。
