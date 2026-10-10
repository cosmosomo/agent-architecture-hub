---
hub: "1.0"
kind: docs
case: incident_war_room
---

# @status_board [doc] #layer/consensus
name: 事故状态看板
owner: ic
summary: 当前事故级别、受影响范围、各组状态、最新进展
audience: all

# @timeline [doc] #layer/consensus
name: 事故时间线
owner: comms
summary: 告警触发时刻起的所有关键事件、行动和决策的时间戳记录
audience: all

# @infra_logs [doc] #layer/private
name: 基础设施日志
owner: diag_infra
summary: 网络、负载均衡、主机层面的告警日志和指标
audience: [diag_infra, ic]

# @app_logs [doc] #layer/private
name: 应用层日志
owner: diag_app
summary: 支付服务的错误日志、访问日志、依赖服务调用记录
audience: [diag_app, ic]

# @error_traces [doc] #layer/private
name: 错误追踪
owner: diag_app
summary: 异常堆栈、慢请求采样、第三方 SDK 返回码
audience: [diag_app, fix_eng]

# @db_metrics [doc] #layer/private
name: 数据库指标
owner: diag_db
summary: 连接池占用率、慢查询列表、锁等待事件
audience: [diag_db, ic]

# @db_logs [doc] #layer/private
name: 数据库日志
owner: diag_db
summary: 主从切换记录、错误日志、DDL 操作记录
audience: [diag_db, fix_eng]

# @diag_summary [doc] #layer/consensus
name: 诊断汇总
owner: ic
summary: 根因定位结论、置信度评级、各路诊断的关键发现
audience: [ic, fix_eng, validator, postmortem]

# @runbook [doc] #layer/consensus
name: 操作手册
owner: fix_eng
summary: 本次事故已执行的操作步骤、配置变更记录、回滚点
audience: [fix_eng, validator, postmortem]

# @metrics_dashboard [doc] #layer/private
name: 实时指标看板
owner: validator
summary: 错误率、P99 延迟、支付成功率的实时曲线
audience: [validator, ic]
