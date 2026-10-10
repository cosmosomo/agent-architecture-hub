---
hub: "1.0"
kind: agents
case: deep_research_v2
---

# @leader [individual] #phase/plan #role/orchestrator #group/core #hub
name: 调研统筹者
model: claude-opus-5-5
role: 拆解调研方向，分配子调研员，汇总进度，触发辩论，提炼最终报告
trigger: 人工启动调研任务
watches: [brief, synthesis]

# @r_tools [individual] #phase/research #role/researcher #group/research
name: 调研员——工具功能
model: claude-sonnet-5-5
role: 扫描 LangGraph、AutoGen、CrewAI、AgentScope 等工具的可视化功能
trigger: leader 下发调研包后启动
watches: [brief, tool_list]

# @r_oss [individual] #phase/research #role/researcher #group/research
name: 调研员——开源项目
model: claude-sonnet-5-5
role: 扫描 GitHub 上以多智能体可视化为核心的开源项目
trigger: leader 下发调研包后启动（与 r_tools 并行）
watches: [brief, tool_list]

# @r_paper [individual] #phase/research #role/researcher #group/research
name: 调研员——学术与博客
model: claude-sonnet-5-5
role: 扫描近两年学术论文和技术博客中关于多智能体可视化的内容
trigger: leader 下发调研包后启动（与 r_tools、r_oss 并行）
watches: [brief]

# @r_ux [individual] #phase/research #role/researcher #group/research
name: 调研员——用户体验
model: claude-sonnet-5-5
role: 调研从业者对现有工具的真实使用体验，挖掘痛点和缺口
trigger: leader 下发调研包后启动（与其他调研员并行）
watches: [brief]

# @reviewer [individual] #phase/research #role/reviewer #group/core
name: 审核员
model: claude-opus-5-5
role: 核查四路调研材料的可信度、覆盖范围和内部一致性
trigger: 四路调研员均提交材料后启动
watches: [brief, research_bundle]

# @devil [individual] #phase/debate #role/challenger #group/debate
name: 唱反调者
model: claude-sonnet-5-5
role: 对调研结论提出质疑，识别遗漏、过度概括和偏见
trigger: reviewer 通过审核后启动
watches: [research_bundle, review_notes]

# @defender [individual] #phase/debate #role/defender #group/debate
name: 辩护者
model: claude-sonnet-5-5
role: 为调研结论辩护，回应质疑，必要时承认局限
trigger: 与 devil 同时启动
watches: [research_bundle, review_notes]

# @synthesizer [individual] #phase/synthesize #role/orchestrator #group/core
name: 综合者
model: claude-opus-5-5
role: 综合辩论结果，产出结构化对比报告，标注有争议的结论
trigger: 辩论结束后启动
watches: [debate_record, research_bundle]
