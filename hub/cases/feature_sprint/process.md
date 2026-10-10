---
hub: "1.0"
kind: process
case: feature_sprint
---

# @s_plan [stage] #group/leadership
name: 需求分析与规格制定
executors: [pm, ux]

# @gt_spec [gate] #kind/human
name: 规格冻结关卡
after_stage: s_plan
decider_type: human
decider_who: pm
paths:
  - condition: 规格书完整，归类维度清晰，准确率目标明确
    next: s_design
  - condition: 归类维度不清晰或存在歧义
    next: s_plan
    note: 打回补充维度定义

# @s_design [stage] #group/engineering
name: 架构设计与接口契约
executors: [arch]

# @gt_design [gate] #kind/agent
name: 接口契约评审
after_stage: s_design
decider_type: agent
decider_who: pm
paths:
  - condition: 接口定义完整，与规格一致，风险已评估
    next: s_build
  - condition: 接口定义与规格有偏差
    next: s_design
    note: 打回修订接口

# @s_build [stage] #group/engineering
name: 并行实现（分类模型 + 数据管道）
executors: [impl_a, impl_b]

# @gt_build [gate] #kind/rule
name: 实现完成检查
after_stage: s_build
decider_type: rule
decider_text: impl_a 和 impl_b 都标记完成，且无阻塞性技术债
paths:
  - condition: 两路实现均完成
    next: s_test
  - condition: 有一路未完成
    next: s_build
    note: 等待滞后方

# @s_test [stage] #group/quality
name: 并行测试与代码审查
executors: [qa, reviewer]

# @gt_release [gate] #kind/human
name: 发布门控
after_stage: s_test
decider_type: human
decider_who: pm
paths:
  - condition: 准确率达标，无高风险审查意见
    next: s_deliver
  - condition: 准确率不达标
    next: s_build
    note: 打回修复分类逻辑
  - condition: 有高风险安全或合规问题
    next: s_build
    note: 优先修复安全问题

# @s_deliver [stage] #group/leadership
name: 上线摘要与交付
executors: [n3]
