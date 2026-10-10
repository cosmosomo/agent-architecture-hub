---
hub: "1.0"
kind: decisions
case: incident_war_room
agent: ic
---

# @d_ic_1 [decision] #stage/triage #kind/deliver #agent/ic
title: 事故级别定为 P1 还是 P2
trigger: 告警显示错误率 14%，但影响范围只有支付接口，其他服务正常
alternatives:
  - P1：全员紧急响应，立即通知管理层
  - P2：核心团队响应，不触发全员告警
choice: P1：全员紧急响应，立即通知管理层
reason: 支付接口是核心收入路径，14% 错误率对用户直接可感知，时间成本高于误报成本
impact: 触发全员通报，comms 立即发布初始通告
action: deliver

# @d_ic_2 [decision] #stage/mitigate #kind/escalate #agent/ic
title: 三路诊断结论分散时是否等齐再行动
trigger: diag_db 置信度 70%（连接池），diag_app 置信度 60%（SDK 超时），diag_infra 排除自身
alternatives:
  - 等三路都提交最终结论再决策
  - 选置信度最高的方向先行动
  - 同时验证两个假设
choice: 选置信度最高的方向先行动
reason: 每多等 5 分钟损失约 2000 次失败支付，db 连接池假设有具体数据支撑
impact: 先执行连接池扩容，validator 同步监测指标，如无效立即转向 SDK 假设
action: escalate

# @d_ic_3 [decision] #stage/mitigate #kind/deliver #agent/ic
title: 修复操作后指标恶化，是否立即回滚
trigger: fix_eng 重启负载均衡后错误率从 14% 升至 21%
alternatives:
  - 立即回滚负载均衡配置
  - 再等 2 分钟观察是否自行恢复
  - 并行回滚 + 重新诊断
choice: 并行回滚 + 重新诊断
reason: 2 分钟观察期代价太高；只回滚不重新诊断会陷入循环
impact: 负载均衡恢复原状，同时 diag_app 开始重点排查最近部署记录
action: deliver
