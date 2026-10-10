---
hub: "1.0"
kind: decisions
case: feature_sprint
agent: pm
---

# @d_pm_1 [decision] #stage/plan #kind/deliver #agent/pm
title: 归类维度应该由 AI 自动聚类还是预定义
trigger: ux 提交维度分析报告，两种方案各有支持
alternatives:
  - 完全自动聚类，上线后观察
  - 预定义 12 个维度，AI 对号入座
  - 混合：预定义主维度，允许少量新增
choice: 混合：预定义主维度，允许少量新增
reason: 完全自动聚类在准确率评估上无标准可依；纯预定义容易有死角
impact: 测试用例需要覆盖新增维度的边界情况
action: deliver

# @d_pm_2 [decision] #stage/test #kind/deliver #agent/pm
title: 准确率 88% 是否通过发布门控
trigger: qa 测试报告显示整体准确率 88%，低于 90% 目标
alternatives:
  - 不通过，打回修复
  - 通过，带风险标注上线
  - 推迟发布，追加一轮优化
choice: 推迟发布，追加一轮优化
reason: 差距只有 2%，值得追加一轮，上线后再打回改造成本更高
impact: 冲刺延期一个迭代，impl_a 针对低准确率维度补充训练数据
action: deliver
