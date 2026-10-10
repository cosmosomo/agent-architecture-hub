---
hub: "1.0"
kind: process
case: incident_war_room
---

# @s_triage [stage] #group/command
name: 事故声明与并行诊断启动
executors: [ic, comms]

# @s_diagnose [stage] #group/diagnose
name: 三路并行诊断
executors: [diag_infra, diag_app, diag_db]

# @gt_rootcause [gate] #kind/human
name: 根因确认关卡
after_stage: s_diagnose
decider_type: human
decider_who: ic
paths:
  - condition: 至少一路诊断给出置信度高的根因，其他路排除自身
    next: s_mitigate
  - condition: 三路诊断结论分散，根因不明
    next: s_diagnose
    note: ic 指定重点方向，继续诊断
  - condition: 根因跨越多层（如应用层触发了数据库问题）
    next: s_mitigate
    note: 制定多步骤修复方案，按依赖顺序执行

# @s_mitigate [stage] #group/mitigate
name: 止损操作与实时验证
executors: [fix_eng, validator]

# @gt_recovery [gate] #kind/human
name: 恢复确认关卡
after_stage: s_mitigate
decider_type: human
decider_who: ic
paths:
  - condition: 错误率回落到 0.5% 以下，P99 延迟恢复正常，持续 5 分钟
    next: s_postmortem
  - condition: 指标改善但未完全恢复
    next: s_mitigate
    note: 继续追加修复操作
  - condition: 操作后指标恶化
    next: s_diagnose
    note: 修复方向有误，重新诊断

# @s_postmortem [stage] #group/command
name: 事故复盘
executors: [postmortem]
