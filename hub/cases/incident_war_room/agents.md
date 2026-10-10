---
hub: "1.0"
kind: agents
case: incident_war_room
---

# @ic [individual] #phase/triage #role/orchestrator #group/command #hub
name: 事故指挥官
model: claude-opus-5-5
role: 声明事故级别，协调各组行动，对外通报，最终宣布恢复
trigger: 监控告警触发，人工确认启动战情室
watches: [timeline, status_board]

# @diag_infra [individual] #phase/triage #role/diagnoser #group/diagnose
name: 基础设施诊断员
model: claude-sonnet-5-5
role: 检查网络、DNS、负载均衡、主机层面的异常
trigger: ic 下达并行诊断指令后启动
watches: [infra_logs, status_board]

# @diag_app [individual] #phase/triage #role/diagnoser #group/diagnose
name: 应用层诊断员
model: claude-sonnet-5-5
role: 检查支付服务代码层面的错误、慢查询、第三方 SDK 异常
trigger: ic 下达并行诊断指令后启动（与 diag_infra 并行）
watches: [app_logs, error_traces, status_board]

# @diag_db [individual] #phase/triage #role/diagnoser #group/diagnose
name: 数据库诊断员
model: claude-sonnet-5-5
role: 检查数据库连接池、慢查询、死锁、主从切换事件
trigger: ic 下达并行诊断指令后启动（与 diag_infra、diag_app 并行）
watches: [db_metrics, db_logs, status_board]

# @comms [individual] #phase/triage #role/communicator #group/command
name: 对外通报员
model: claude-sonnet-5-5
role: 起草并发布内部通报和外部状态页更新，跟踪通报时间线
trigger: ic 声明事故级别后立即启动，持续运行直到关闭
watches: [timeline, status_board]

# @forensics [individual] #phase/triage #role/researcher #group/diagnose
name: 代码取证员
model: claude-sonnet-5-5
role: 检索代码仓库近期变更与部署记录，定位引入问题的提交和配置
trigger: ic 下达并行诊断指令后启动（与三路诊断并行）
watches: [status_board, timeline]

# @fix_eng [individual] #phase/mitigate #role/engineer #group/mitigate
name: 修复工程师
model: claude-sonnet-5-5
role: 根据诊断结论执行具体的止损或修复操作（回滚、配置变更、重启）
trigger: ic 确认根因后分配具体修复任务
watches: [runbook, diag_summary, status_board]

# @validator [individual] #phase/mitigate #role/reviewer #group/mitigate
name: 恢复验证员
model: claude-sonnet-5-5
role: 持续监测错误率、P99 延迟、成功率，判断修复是否生效
trigger: fix_eng 执行修复操作后立即启动
watches: [metrics_dashboard, status_board]

# @devil [individual] #phase/postmortem #role/challenger #group/command
name: 质疑专家
model: claude-opus-5-5
role: 质疑处置决策与复盘结论，找出被忽略的风险、伪根因和流程漏洞
trigger: ic 宣布恢复后启动，与复盘同步
watches: [timeline, diag_summary]

# @postmortem [individual] #phase/postmortem #role/analyst #group/command
name: 复盘分析员
model: claude-opus-5-5
role: 整理事故时间线，找出根本原因，提出预防措施和改进项
trigger: ic 宣布恢复后启动
watches: [timeline, diag_summary, runbook]
