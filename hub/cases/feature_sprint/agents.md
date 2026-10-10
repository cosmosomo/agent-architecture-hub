---
hub: "1.0"
kind: agents
case: feature_sprint
---

# @pm [individual] #phase/plan #role/orchestrator #group/leadership
name: 产品经理
model: claude-opus-5-5
role: 负责需求拆解、优先级决策、发布门控
trigger: 人工启动冲刺，或收到前一阶段产出后继续推进
watches: [spec, backlog]

# @ux [individual] #phase/plan #role/designer #group/leadership
name: UX 分析师
model: claude-sonnet-5-5
role: 分析现有反馈数据，提炼归类维度，定义标注规范
trigger: pm 下达需求后启动
watches: [feedback_sample, spec]

# @arch [individual] #phase/design #role/architect #group/engineering
name: 系统架构师
model: claude-opus-5-5
role: 设计归类模块架构，定义接口契约，评估技术风险
trigger: spec 冻结后启动
watches: [spec, tech_constraints]

# @impl_a [individual] #phase/build #role/engineer #group/engineering
name: 实现工程师 A（分类模型侧）
model: claude-sonnet-5-5
role: 实现核心文本分类逻辑，接入 embedding 服务
trigger: arch 产出接口文档后启动
watches: [api_contract, spec]

# @impl_b [individual] #phase/build #role/engineer #group/engineering
name: 实现工程师 B（数据管道侧）
model: claude-sonnet-5-5
role: 实现反馈数据摄取、清洗、写入归类结果的管道
trigger: arch 产出接口文档后启动（与 impl_a 并行）
watches: [api_contract, spec]

# @qa [individual] #phase/test #role/qa #group/quality
name: QA 工程师
model: claude-sonnet-5-5
role: 编写测试用例，执行集成测试，验收归类准确率
trigger: impl_a 和 impl_b 都完成后启动
watches: [api_contract, test_cases, feedback_sample]

# @reviewer [individual] #phase/test #role/reviewer #group/quality
name: 代码审查员
model: claude-opus-5-5
role: 审查实现代码的安全性、可维护性和接口合规性
trigger: impl_a 和 impl_b 完成后与 qa 并行启动
watches: [api_contract, tech_constraints]

# @n3 [individual] #phase/deliver #role/orchestrator #group/leadership
name: 综合协调员
model: claude-opus-5-5
role: 收集所有产出，判断是否满足发布门控，准备上线摘要
trigger: qa 和 reviewer 都通过后启动
watches: [test_report, review_notes, spec]
