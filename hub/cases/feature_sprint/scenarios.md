---
hub: "1.0"
kind: scenarios
case: feature_sprint
---

# K1 — 顺利冲刺

impl_a 和 impl_b 并行完成，qa 准确率 92% 超过 90% 目标，reviewer 无高风险意见，n3 顺利通过发布门控。

# K2 — 分类逻辑打回

qa 测试发现边界用例准确率只有 78%，未达标。gt_release 走"打回修复"路径，impl_a 重写 embedding 召回策略后重新测试。

# K3 — 接口偏差

arch 设计的接口输入格式与规格里的字段不一致，gt_design 打回。arch 与 ux 对齐后修订接口契约，再次评审通过。
