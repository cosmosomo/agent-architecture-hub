---
hub: "1.0"
kind: process
case: deep_five_minds
---

# 阶段与关卡

## @s_strategy [stage] #group/g_strategy
name: 战略分析
steps:
  - id: st_kickoff,   name: 启动决策流程,   executors: [n0]
  - id: st_analyze,   name: 分析现状,       executors: [n1]
  - id: st_plan,      name: 制定调研计划,   executors: [n2]
  - id: st_sync,      name: 维护共识文档,   executors: [n3]
  - id: st_present_strategy, name: 呈报战略决策, executors: [n4]

## @s_research [stage] #group/g_research
name: 多方调研
steps:
  - id: st_res_tech,    name: 技术方向调研,   executors: [n5]
  - id: st_res_reddit,  name: 社区讨论调研,   executors: [n6]
  - id: st_res_ux,      name: 使用体验调研,   executors: [n7]
  - id: st_res_github,  name: 开源方案调研,   executors: [n8]
  - id: st_res_forums,  name: 专业论坛调研,   executors: [n9]
  - id: st_res_critic,  name: 调研材料审核,   executors: [n11]

## @s_debate [stage] #group/g_debate
name: 五心智辩论
steps:
  - id: st_debate_positions, name: 五位专家提出立场, executors: [n12, n13, n14, n15, n16]
  - id: st_debate_sync,      name: 整理辩论共识,     executors: [n3]
  - id: st_present_debate,   name: 呈报辩论决策,     executors: [n17]

## @s_build [stage] #group/g_build
name: 方案构建
steps:
  - id: st_build_backend,   name: 后端开发,   executors: [n18]
  - id: st_build_frontend,  name: 前端开发,   executors: [n19]
  - id: st_build_feature,   name: 功能开发,   executors: [n20]
  - id: st_build_design,    name: 界面设计,   executors: [n21]
  - id: st_build_integrate, name: 集成联调,   executors: [n22]
  - id: st_present_build,   name: 呈报构建决策, executors: [n23]

## @s_qa [stage] #group/g_qa
name: 质量检验
steps:
  - id: st_qa_security, name: 安全测试,     executors: [n24]
  - id: st_qa_quality,  name: 质量测试,     executors: [n25]
  - id: st_qa_summary,  name: 汇总质检结论, executors: [n26]

---

## @gt_strategy [gate]
name: 战略结论是否进入调研
after_stage: s_strategy
decider_type: human
decider_who: n4
decider_text: 人审阅战略呈报，决定要不要立项调研
pass: s_research
fail: s_strategy

## @gt_research [gate]
name: 调研来源是否够充分
after_stage: s_research
decider_type: rule
decider_text: 调研来源不少于 5 个
pass: s_debate
fail: s_research

## @gt_debate [gate]
name: 辩论方案是否进入构建
after_stage: s_debate
decider_type: human
decider_who: n17
decider_text: 人审阅候选方案和争议点，决定选哪个方向构建
pass: s_build
fail: s_debate

## @gt_build [gate]
name: 构建交付是否进入质检
after_stage: s_build
decider_type: human
decider_who: n23
decider_text: 人审阅构建组的交付和集成结果，决定要不要送质检
pass: s_qa
fail: s_build

## @gt_qa [gate]
name: 质检是否通过
after_stage: s_qa
decider_type: agent
decider_who: n26
decider_text: 质检负责人按安全测试和质量测试结论判断是否放行
pass: done
fail: s_build
