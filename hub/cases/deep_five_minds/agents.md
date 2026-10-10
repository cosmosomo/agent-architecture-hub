---
hub: "1.0"
kind: agents
case: deep_five_minds
---

# @n0 [individual] #role/orchestrator #phase/strategy #hub #group/g_strategy
name: 编排者
model: claude-opus-5-5
role: 发起迁移决策流程，统筹三道人工关，向人汇总最终结果
trigger: 收到人提出的"订单核心服务要不要迁移到事件驱动架构"的问题
watches: [n3, n26]

# @n1 [individual] #role/analyst #phase/strategy #group/g_strategy
name: 分析师
model: claude-sonnet-5-5
role: 分析现有订单服务的现状、接口依赖和历史债务
trigger: 编排者启动战略分析阶段后派出

# @n2 [individual] #role/planner #phase/strategy #group/g_strategy
name: 规划师
model: claude-sonnet-5-5
role: 制定调研计划，拆解调研方向
trigger: 分析师完成现状分析后

# @n3 [individual] #role/coordinator #phase/strategy #phase/research #phase/debate #group/g_strategy
name: 综合者
model: claude-opus-5-5
role: 维护迁移目标与约束等共识文档，在调研、辩论之间来回确认结论
trigger: 任意阶段产出新结论，或专家对共识提出异议
watches: [n11, n12, n13, n14, n15, n16]

# @n4 [individual] #role/gate #phase/strategy #group/g_strategy #group/g_gate #native/hitl
name: 决策呈报员（战略关）
model: claude-sonnet-5-5
role: 把分析师和规划师的初步结论整理成选项，呈报给人决定要不要进入调研
trigger: 综合者确认战略阶段的结论已经稳定
watches: [n1, n2]

# @n5 [individual] #role/researcher #phase/research #group/g_research_general
name: 技术方向调研员
model: claude-haiku-5-5
role: 调研事件驱动架构的技术选型和最佳实践
trigger: 编排者派发调研任务

# @n6 [individual] #role/researcher #phase/research #group/g_research_community
name: 社区讨论调研员
model: claude-haiku-5-5
role: 在社区论坛和 Reddit 调研真实迁移经验和踩坑案例
trigger: 编排者派发调研任务

# @n7 [individual] #role/researcher #phase/research #group/g_research_general
name: 使用体验调研员
model: claude-haiku-5-5
role: 调研使用过事件驱动架构的团队的真实反馈
trigger: 编排者派发调研任务

# @n8 [individual] #role/researcher #phase/research #group/g_research_general
name: 开源方案调研员
model: claude-haiku-5-5
role: 调研开源事件驱动框架的成熟度和社区活跃度
trigger: 编排者派发调研任务

# @n9 [individual] #role/researcher #phase/research #group/g_research_community
name: 专业论坛调研员
model: claude-haiku-5-5
role: 在专业技术论坛调研架构迁移的讨论
trigger: 编排者派发调研任务

# @n10 [individual] #role/researcher #phase/research #group/g_research_community
name: 补充调研员
model: claude-haiku-5-5
role: 按需补充调研空白方向
trigger: 审核员指出调研存在空白时派出
never_dispatch: true

# @n11 [individual] #role/reviewer #phase/research #group/g_research_general
name: 调研审核员
model: claude-sonnet-5-5
role: 核验六路调研材料是否可信，是否覆盖现有系统约束
trigger: 收到调研员提交的材料
watches: [n5, n6, n7, n8, n9]

# @n12 [individual] #role/expert #phase/debate #group/g_debate
name: 工程派专家
model: claude-sonnet-5-5
role: 从工程可行性角度参与辩论，重点关注实施风险和技术债
trigger: 综合者整理出辩论材料包后

# @n13 [individual] #role/expert #phase/debate #group/g_debate
name: 务实派专家
model: claude-sonnet-5-5
role: 从业务连续性和渐进迁移角度参与辩论
trigger: 综合者整理出辩论材料包后

# @n14 [individual] #role/expert #phase/debate #group/g_debate
name: 创新派专家
model: claude-sonnet-5-5
role: 从长期架构演进角度参与辩论，推动更彻底的架构升级
trigger: 综合者整理出辩论材料包后

# @n15 [individual] #role/expert #phase/debate #group/g_debate
name: 保守派专家
model: claude-sonnet-5-5
role: 从风险控制角度参与辩论，质疑迁移的必要性和时机
trigger: 综合者整理出辩论材料包后

# @n16 [individual] #role/critic #phase/debate #group/g_debate
name: 唱反调者
model: claude-sonnet-5-5
role: 专找方案漏洞，质疑证据是否充分
trigger: 看到综合者整理出的辩论材料包
watches: [n11]

# @n17 [individual] #role/gate #phase/debate #group/g_gate #native/hitl
name: 决策呈报员（辩论关）
model: claude-sonnet-5-5
role: 把五心智辩论留下的候选方案和争议点整理呈报，供人决定要不要进入构建
trigger: 综合者汇总辩论共识后转交
watches: [n3, n16]

# @n18 [individual] #role/builder #phase/build #group/g_build_backend
name: 后端开发
model: claude-sonnet-5-5
role: 实现事件驱动架构的服务端核心逻辑和 API
trigger: 决策呈报员（辩论关）确认构建方案后

# @n19 [individual] #role/builder #phase/build #group/g_build_frontend
name: 前端开发
model: claude-sonnet-5-5
role: 实现与新架构对接的前端界面
trigger: 决策呈报员（辩论关）确认构建方案后

# @n20 [individual] #role/builder #phase/build #group/g_build_backend
name: 功能开发
model: claude-sonnet-5-5
role: 实现具体业务功能模块
trigger: 决策呈报员（辩论关）确认构建方案后

# @n21 [individual] #role/builder #phase/build #group/g_build_frontend
name: 界面设计
model: claude-sonnet-5-5
role: 设计并实现 UI 组件
trigger: 决策呈报员（辩论关）确认构建方案后

# @n22 [individual] #role/integrator #phase/build #group/g_build_backend
name: 集成者
model: claude-sonnet-5-5
role: 负责服务端与前端的集成联调，维护接口迁移清单
trigger: 各开发模块完成后

# @n23 [individual] #role/gate #phase/build #group/g_gate #native/hitl
name: 决策呈报员（构建关）
model: claude-sonnet-5-5
role: 把构建组的交付物和集成结果整理呈报，供人决定要不要送质检
trigger: 集成者完成集成后转交
watches: [n22]

# @n24 [individual] #role/qa #phase/qa #group/g_qa
name: 安全测试
model: claude-sonnet-5-5
role: 对新架构进行安全测试，输出安全测试报告
trigger: 决策呈报员（构建关）确认送质检后

# @n25 [individual] #role/qa #phase/qa #group/g_qa
name: 质量测试
model: claude-sonnet-5-5
role: 对新架构进行功能和性能测试，输出质量测试报告
trigger: 决策呈报员（构建关）确认送质检后

# @n26 [individual] #role/qa-lead #phase/qa #group/g_qa
name: 质检负责人
model: claude-sonnet-5-5
role: 汇总安全测试和质量测试的结论，判断本期迁移是否通过质检
trigger: 安全测试和质量测试都提交了结论
watches: [n24, n25]
