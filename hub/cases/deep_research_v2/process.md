---
hub: "1.0"
kind: process
case: deep_research_v2
---

# @s_plan [stage] #group/core
name: 任务分发
executors: [leader]

# @s_research [stage] #group/research
name: 四路并行调研
executors: [r_tools, r_oss, r_paper, r_ux]

# @gt_research [gate] #kind/agent
name: 调研质检关卡
after_stage: s_research
decider_type: agent
decider_who: reviewer
paths:
  - condition: 四路材料覆盖完整，来源可信，无重大内部矛盾
    next: s_debate
  - condition: 某路材料覆盖严重不足
    next: s_research
    note: 指定调研员补充特定方向
  - condition: 存在可信度低的来源但整体覆盖达标
    next: s_debate
    note: 在 review_notes 里标注风险，辩论层自行判断

# @s_debate [stage] #group/debate
name: 结构化辩论
executors: [devil, defender]

# @gt_debate [gate] #kind/agent
name: 辩论收敛检查
after_stage: s_debate
decider_type: agent
decider_who: leader
paths:
  - condition: 主要争议点已有明确结论或标注为存疑
    next: s_synthesize
  - condition: 仍有重大未决分歧影响报告可用性
    next: s_debate
    note: 再给一轮聚焦辩论

# @s_synthesize [stage] #group/core
name: 综合提炼
executors: [synthesizer]

# @gt_final [gate] #kind/human
name: 报告发布关卡
after_stage: s_synthesize
decider_type: human
decider_who: leader
paths:
  - condition: 报告覆盖目标、结论清晰、存疑项已标注
    next: done
  - condition: 报告遗漏重要维度
    next: s_synthesize
    note: 补充指定维度后重新提交
