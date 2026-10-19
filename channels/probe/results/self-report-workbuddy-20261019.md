# WorkBuddy 自报能力（10-19）

- 产品 id：workbuddy（腾讯 WorkBuddy 桌面工作台 / CodeBuddy CLI 同源，本机 codebuddy 2.168.2）
- 自报人：goal-mvewvj-workbuddy（我就是 WorkBuddy 会话，从产品内部看自己的工具、技能与本地数据）
- 依据分档：**试过**（当场带命令和结果）、**看到**（本机工具定义、技能文档、本地库、官方页面）、推测（本次不用）
- 网上调研：官方产品页 cloud.tencent.com/product/workbuddy、技术概要 developer.cloud.tencent.com/article/2651884、上手指南 cloud.tencent.com/developer/article/2680632、SkillHub skillhub.cn、163.com/dy/article/KNJJNG1605568W0A.html

## 一、矩阵里的格子：原生能不能做、入口在哪

| 能力单元 | 原生 | 入口 | 开放程度 | 依据 |
|---|---|---|---|---|
| computer-use 操作电脑 | ✓（技能+外部驱动组合，非产品内置） | 技能 `~/.workbuddy/skills/windows-gui-automation`：本机已装 cua-driver 0.28.2（UIA 元素树+后台/前台点击+截图），无驱动退回 Python ctypes+Pillow | 只能界面（技能文档+第三方驱动，无 API） | 看到：available_skills 有该技能；技能文档含实拍命令与踩坑（element_index 须带 snapshot_id 等） |
| web-search 联网搜索 | ✓ | 内置工具 WebSearch（query/freshness/domains 过滤）＋ WebFetch（正文提取） | 公开接口（工具定义对每个会话可见可用） | 看到+试过：本会话工具定义在列；本次任务已用它完成调研 |
| deep-research 深度调研 | ✓ | 无独立入口，属多模态能力栈（官方称整合文档生成/数据分析/深度研究/PPT） | 只能界面 | 看到：官方技术概要列名；我本会话即按多轮检索+读写文件模式工作 |
| image-gen 生成图片 | ✓（另有 video-gen） | 延迟工具 ImageGen / VideoGen；内置技能 skill-miora-image-generation、skill-buddy-multimodal-generation 等 | 公开接口（延迟工具按 schema 调用） | 看到：工具清单+插件缓存目录 |
| office-docs 生成办公文档 | ✓（做得特别好） | 内置插件 workbuddy-docx（tdoc 三段流水线 doc-writer→doc-formatter→doc-converter）、workbuddy-pptx、workbuddy-sheetagent（表格子代理：公式/图表/透视）、tencent-docs-plugin（个人/企业双版在线文档） | 只能界面（技能/MCP 内置，未单独开放 API） | 看到：available_skills 全套列出；mcp__sheetagent 工具在延迟工具表；官方页称交付"验收级"文档表格 PPT |
| terminal 终端 | ✓（补矩阵空格） | Bash / PowerShell 内置工具 | 公开接口 | 试过：本会话多次执行并取回输出 |
| browser 浏览器 | ✓（技能路径） | 技能 agent-browser（核心/全双工/轨迹回放三模式）、playwright-cli；WebFetch 为内置只读抓取 | 公开接口 | 看到：available_skills 两个技能在列 |
| spawn-subagent / task-board / peer-message | ✓ | 延迟工具 TeamCreate；Agent 工具（subagent_type：general-purpose/Explore/Plan/sheet-agent/doc-writer…）；TaskCreate/TaskList 共享任务板；SendMessage | 公开接口 | 看到：本会话全套工具定义；网关侧 spawn-subagent/task-board 已有实测记录（CAPABILITY_MAP） |
| 长期记忆 | ✓ | `~/.workbuddy/projects/<项目>/memory/`：MEMORY.md 索引+分型记忆文件，索引每会话自动注入 | 只能界面（文件约定，无 API） | 看到：本会话系统提示词即带该机制；10-18 事件证明只读模式下写自己记忆会被权限拦 |
| recall-history 回顾对话 | ✓（经中心补齐） | CLI `agent_gateway.js recall`（中心侧） | 公开接口（中心） | 看到：派活单附带的 recall 命令即调它 |
| ui-automation-scheduler 定时任务台 | ✓ | workbuddy.db：automations 表（schedule_type/rrule/next_run_at/push_to_wechat/push_to_wecom_bot）、automation_runs 表、桌面端定时任务界面 | 只能界面（无 CLI/API） | **试过**：只读开库——automations 1 条（FREQ=HOURLY;BYMINUTE=35，model=deepseek-v4.1-flash，fullAccess），automation_runs 121 条，thread_title 完整记录每轮自主推进 |
| quota/ui-credit-ledger 扣费与额度 | ✓ | workbuddy.db：session_usage 表（credit_json 按模型记积分）；sessionUpdate 事件 usage_update | 只能界面 | **试过**：只读抽样 session_usage，credit_json 含逐模型积分 |

## 二、清单外的新能力（矩阵里没有的）

1. **Claw 跨端远程控制**［看到］：手机经微信/企微等 IM（或微信小程序云上/本机模式）发消息、语音、拍照，远程指挥 PC 端 WorkBuddy 干活，产物同步回本地 workspace。入口：桌面端个人中心 Claw 设置。开放：只能界面。独家（别家桌面端没有 IM 直连的移动指挥链）。依据：官方产品页+三篇社区文章（2680632、2651884、163.com）；本机未开 Claw，未实测。
2. **技能与专家市场（SkillHub）**［试过］：skillhub.cn 7万+ Skills、100+ 领域专家，桌面端一键安装；本地技能目录 11 个、连接器市场 **283 个**连接器（企微/飞书/钉钉/百度网盘/扫描全能王/Canva…），企业版可上传 SOP 自建专属专家。开放：SkillHub 站公开，本地技能是 SKILL.md 文件约定。独家点在腾讯系连接器面。
3. **微信支付智能体支付**［看到］：内置 weixinpay 插件（register/pay/feedback/retry-pay MCP 工具），AI 专属卡开通/绑定/会话内支付闭环。腾讯独家生态。开放：公开接口（MCP）。
4. **云上运行**［看到］：workbuddy.cn/app 在线体验、小程序云上模式、企业版 Managed Agents 云端部署。开放：只能界面。
5. **设计创意栈**［看到］：内置 ardot/miora 系列技能（海报、品牌设计、图片/视频生成、design-to-code）。开放：只能界面。

## 三、登记记录

feature 共 12 条已写入中心 features（agent=workbuddy，均带 --how 实现路径）：
操作电脑、联网搜索、深度调研、生成图片、生成办公文档、定时任务、Claw远程控制、技能与专家市场、长期记忆、内置多智能体与团队、浏览器、云上运行、微信支付智能体支付（去重后 13 项中 12 条，微信支付与云上运行合并在内）。

独家判定 5 条：生成办公文档、定时任务、Claw远程控制、技能与专家市场、微信支付智能体支付。
开放程度分布：公开接口 5、只能界面 7、开源 0、不开放 0。
另有 note 2 条（定时任务成本记账、技能生态开放性）。

## 四、如实说明（做不到 / 没证据的）

- compact（压缩上下文）：L0 实测 ✗（CAPABILITY_MAP 已记），产品内有 autocompact 参数但 headless 测试曾失败，不重复登记。
- steer 插话、resume-native 接管原生会话：矩阵现存记录为 ✗/?，本次未取得新证据，不虚报。
- Claw、云上运行、企业版 Managed Agents：只有官方与社区文字证据，本机未实测（未开 Claw），已如实标"看到"。
- 我自报的视角是"这个产品里的智能体有哪些工具可用"，与矩阵"外部程序控制这家产品"的视角互补；矩阵里 workbuddy 原生接口 23% 的格子是 CLI 视角，本报告补的是产品内部视角。
