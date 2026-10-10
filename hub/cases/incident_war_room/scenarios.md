---
hub: "1.0"
kind: scenarios
case: incident_war_room
---

# K1 — 快速定位数据库连接池耗尽

diag_db 在 T+8min 确认数据库连接池因慢查询堆积被耗尽，diag_infra 和 diag_app 排除自身。gt_rootcause 通过，fix_eng 执行连接池扩容 + 慢查询中止，T+22min 错误率恢复到 0.3%。全程 27 分钟。

# K2 — 根因跨层：第三方 SDK 超时引发连接泄漏

diag_app 发现第三方支付 SDK 超时未释放连接，diag_db 同时发现连接泄漏症状。ic 判断根因跨越应用层和数据库层，进入"多步骤修复"路径：先重启支付服务释放连接，再修复 SDK 超时配置。validator 在两步后确认恢复。

# K3 — 修复方向错误，重新诊断

fix_eng 按照 diag_infra 的建议重启负载均衡，但 validator 发现错误率反而升高。gt_recovery 走"指标恶化"路径，重新进入诊断阶段。这次 diag_app 找到真正根因：一个上线 2 小时的代码变更引入了空指针异常，回滚后恢复正常。

rework_gate: gt_recovery
inject: 负载均衡重启后错误率从 14% 升至 21%
blocked_at: s_mitigate
