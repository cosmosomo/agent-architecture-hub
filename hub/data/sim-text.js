/* The simulator's decision texts: what each kind of individual decides, in what order, and what it calls on the way.
   hub/js/sources/sim.js decides which of them a run gets and how long it takes. Calls: read:<doc> / search / fetch / edit / bash / write / model. */
window.HUB = window.HUB || {};
HUB.simText = {
  decisions: {
    hub: [
      { title: '理解需求并拆解', trigger: '收到人的需求', alternatives: ['交给一个智能体从头做到尾', '按阶段拆给几个小组'], choice: '按阶段拆给几个小组', reason: '各阶段需要的专长不同，拆开能并行', impact: '生成各阶段的任务', action: 'tool', tags: ['意图理解', '获取信息'], calls: ['read:d_goal', 'read:d_map', 'model'] },
      { title: '确定分工和顺序', trigger: '拆解完成', alternatives: ['调研和构建同时开始', '先调研再构建'], choice: '先调研再构建', reason: '没有调研结论就动手，返工风险高', impact: '把任务派给下一阶段', action: 'deliver', tags: ['分析', '决策'], calls: ['model', 'write'] }
    ],
    strategy: [
      { title: '读需求和约束', trigger: '收到派发', alternatives: ['直接按经验拆', '先读完约束再拆'], choice: '先读完约束再拆', reason: '约束决定哪些方案根本不能选', impact: '形成拆解依据', action: 'tool', tags: ['获取信息'], calls: ['read:d_goal', 'read:own', 'model'] },
      { title: '形成结论', trigger: '信息基本齐全', alternatives: ['给一个方案', '给两个方案并写清取舍'], choice: '给两个方案并写清取舍', reason: '下游需要知道放弃了什么', impact: '结论写进共享文档', action: 'tool', tags: ['分析', '判断'], calls: ['model', 'read:repeat', 'model'] },
      { title: '交付给下游', trigger: '结论写完', alternatives: ['等全部确认再交', '先交主干，细节后补'], choice: '先交主干，细节后补', reason: '下游可以先开工', impact: '交接给下一阶段', action: 'deliver', tags: ['行动'], calls: ['write'] }
    ],
    research: [
      { title: '确定检索范围', trigger: '收到调研任务', alternatives: ['只查官方资料', '官方资料加社区讨论'], choice: '官方资料加社区讨论', reason: '社区里有真实的踩坑记录', impact: '列出检索关键词', action: 'tool', tags: ['意图理解', '获取信息'], calls: ['read:d_goal', 'search', 'search', 'model'] },
      { title: '筛选可信来源', trigger: '检索结果太多', alternatives: ['全部保留', '按可信度标准筛掉一半'], choice: '按可信度标准筛掉一半', reason: '低质量来源会误导后面的判断', impact: '保留下来的来源进入整理', action: 'tool', tags: ['分析'], calls: ['fetch', 'fetch', 'model'] },
      { title: '整理结论并交付', trigger: '来源整理完', alternatives: ['交原始材料', '交整理后的结论和出处'], choice: '交整理后的结论和出处', reason: '下游没有时间读原始材料', impact: '交接给下游', action: 'deliver', tags: ['行动'], calls: ['model', 'write'] }
    ],
    debate1: [
      { title: '提出立场', trigger: '收到辩题和调研结论', alternatives: ['支持主流方案', '提出替代方案'], choice: '提出替代方案', reason: '要让取舍摆在桌面上', impact: '立场写进辩论记录', action: 'tool', tags: ['获取信息', '分析'], calls: ['read:prev', 'read:d_goal', 'model'] },
      { title: '回应质疑', trigger: '收到其他专家的质疑', alternatives: ['坚持原立场', '吸收合理部分修改立场'], choice: '吸收合理部分修改立场', reason: '质疑点有数据支撑', impact: '更新立场', action: 'request', tags: ['判断'], calls: ['read:prev', 'model'] },
      { title: '给出结论', trigger: '辩论轮次结束', alternatives: ['弃权', '投出带理由的一票'], choice: '投出带理由的一票', reason: '综合者需要每个视角的明确结论', impact: '交给综合者', action: 'deliver', tags: ['决策', '行动'], calls: ['model', 'write'] }
    ],
    build: [
      { title: '读需求和约定', trigger: '收到构建任务', alternatives: ['边做边看', '先读完约定再动手'], choice: '先读完约定再动手', reason: '约定没读清，最容易返工', impact: '确定实现范围', action: 'tool', tags: ['获取信息'], calls: ['read:d_goal', 'read:own', 'read:repeat'] },
      { title: '实现并自测', trigger: '范围确定', alternatives: ['先写全部再测', '写一块测一块'], choice: '写一块测一块', reason: '问题能尽早暴露', impact: '代码和测试', action: 'tool', tags: ['行动'], calls: ['edit', 'bash', 'model', 'bash'] },
      { title: '提交交付', trigger: '自测通过', alternatives: ['等全部完成再交', '先交可用版本'], choice: '先交可用版本', reason: '验收可以先开始', impact: '交给验收', action: 'deliver', tags: ['行动'], calls: ['write', 'model'] }
    ],
    qa: [
      { title: '按清单检查', trigger: '收到交付', alternatives: ['抽查', '按清单逐条检查'], choice: '按清单逐条检查', reason: '漏检的代价比多花时间大', impact: '得到检查记录', action: 'tool', tags: ['获取信息', '分析'], calls: ['read:prev', 'grep', 'bash', 'model'] },
      { title: '给出检查结论', trigger: '检查完成', alternatives: ['只报严重问题', '全部问题分级上报'], choice: '全部问题分级上报', reason: '小问题累积起来也会出事', impact: '结论交给判断点', action: 'deliver', tags: ['判断', '行动'], calls: ['model', 'write'] }
    ],
    hitl: [
      { title: '整理决策选项', trigger: '上一阶段完成', alternatives: ['只给推荐方案', '给三个选项并写清代价'], choice: '给三个选项并写清代价', reason: '人要知道放弃的是什么', impact: '形成呈报材料', action: 'tool', tags: ['分析'], calls: ['read:prev', 'model', 'write'] },
      { title: '呈报给人', trigger: '材料整理完', alternatives: ['等人主动来看', '直接推送给人'], choice: '直接推送给人', reason: '这一关不能自动放行', impact: '等人拍板', action: 'escalate', tags: ['行动'], calls: ['model'] }
    ],
    meta: [
      { title: '确认故障', trigger: '渠道检查失败', alternatives: ['当作偶发忽略', '连续检查三次确认'], choice: '连续检查三次确认', reason: '避免误报，也避免漏报', impact: '确认渠道不可用', action: 'tool', tags: ['获取信息'], calls: ['bash', 'bash', 'read:own'] },
      { title: '生成维护任务', trigger: '故障已确认', alternatives: ['只记日志', '暂停派活并生成维护任务'], choice: '暂停派活并生成维护任务', reason: '继续派活只会制造更多失败', impact: '这条渠道暂停派活', action: 'tool', tags: ['决策', '行动'], calls: ['model', 'write'] },
      { title: '验证恢复', trigger: '额度恢复', alternatives: ['直接恢复派活', '先试一次再恢复'], choice: '先试一次再恢复', reason: '确认真的恢复了', impact: '恢复派活', action: 'deliver', tags: ['行动'], calls: ['bash', 'model'] }
    ],
    judge: [
      { title: '核对检查结论', trigger: '收到检查结论', alternatives: ['只看结论', '抽查原始记录'], choice: '抽查原始记录', reason: '结论可能漏写问题', impact: '形成判断依据', action: 'tool', tags: ['获取信息', '分析'], calls: ['read:prev', 'model'] },
      { title: '判定是否通过', trigger: '依据齐全', alternatives: ['通过', '打回'], choice: '通过', reason: '检查项全部满足', impact: '放行到下一阶段', action: 'deliver', tags: ['决策'], calls: ['model', 'write'] }
    ]
  },
  // asked of upstream: a document the work package lacks
  request: { title: '向上游要缺的资料', trigger: '工作包里缺一份该有的文档', alternatives: ['凭经验先做', '先要资料再做'], choice: '先要资料再做', reason: '缺的是约束类资料，猜错代价大', impact: '等上游补送', action: 'request', tags: ['获取信息'], calls: ['model'] },
  // asked of someone the definition does not connect
  undeclared: { title: '直接找人要资料', trigger: '交接里缺细节', alternatives: ['等正式交接', '直接找对方要'], choice: '直接找对方要', reason: '正式交接还要等很久', impact: '编排里没有这条线', action: 'request', tags: ['获取信息'], calls: ['model'] }
};
