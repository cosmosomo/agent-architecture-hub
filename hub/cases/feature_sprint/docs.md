---
hub: "1.0"
kind: docs
case: feature_sprint
---

# @spec [doc] #layer/consensus
name: 功能规格书
owner: pm
summary: 归类维度定义、准确率目标、边界条件
audience: all

# @backlog [doc] #layer/consensus
name: 任务拆解列表
owner: pm
summary: 工程任务、优先级、依赖关系
audience: all

# @api_contract [doc] #layer/consensus
name: 接口契约文档
owner: arch
summary: 分类服务输入输出格式、错误码、SLA
audience: [arch, impl_a, impl_b, qa, reviewer]

# @tech_constraints [doc] #layer/private
name: 技术约束说明
owner: arch
summary: 现有基础设施限制、依赖版本、安全要求
audience: [arch, impl_a, impl_b, reviewer]

# @feedback_sample [doc] #layer/private
name: 反馈数据样本
owner: ux
summary: 500 条脱敏反馈，涵盖主要类型
audience: [ux, qa]

# @test_cases [doc] #layer/private
name: 测试用例集
owner: qa
summary: 功能测试、边界用例、准确率评估
audience: [qa, reviewer]

# @test_report [doc] #layer/private
name: 测试报告
owner: qa
summary: 测试结果、准确率数据、遗留问题
audience: [n3, pm]

# @review_notes [doc] #layer/private
name: 代码审查意见
owner: reviewer
summary: 问题清单、风险评级、修改建议
audience: [n3, impl_a, impl_b]
