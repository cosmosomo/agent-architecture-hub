/* ARCHIVED: v41 curated override for 'deep_five_minds'.
   Source of truth has moved to hub/cases/deep_five_minds/ (Markdown, parsed by from-docs.js).
   This file is kept for reference and backward compatibility with the sim pipeline.
   Do NOT edit — update hub/cases/deep_five_minds/ instead. */
window.HUB = window.HUB || {};
HUB.cases = HUB.cases || {};
HUB.cases['deep_five_minds'] = {
  title: '订单核心服务迁移决策：单体到事件驱动架构',
  summary: '订单核心服务要不要从单体架构迁移到事件驱动架构，这个方向一旦选定很难回头。团队先做六个方向的深度调研，再交给五位立场不同的专家辩论出方案。方案要经过三道人工关确认，最后交构建组落地并通过质检。',
  groups: [
    { id: 'g_strategy', name: '战略', members: ['n0', 'n1', 'n2', 'n3'] },
    { id: 'g_research', name: '调研', members: [], children: [
      { id: 'g_research_general', name: '通用调研', members: ['n5', 'n7', 'n8', 'n11'] },
      { id: 'g_research_community', name: '社区调研', members: ['n6', 'n9', 'n10'] }
    ] },
    { id: 'g_debate', name: '五心智辩论', members: ['n12', 'n13', 'n14', 'n15', 'n16'] },
    { id: 'g_gate', name: '人工把关', members: ['n4', 'n17', 'n23'] },
    { id: 'g_build', name: '构建', members: [], children: [
      { id: 'g_build_backend', name: '服务端小组', members: ['n18', 'n20', 'n22'] },
      { id: 'g_build_frontend', name: '界面小组', members: ['n19', 'n21'] }
    ] },
    { id: 'g_qa', name: '质检', members: ['n24', 'n25', 'n26'] }
  ],
  individuals: {
    n0: {
      role: '发起迁移决策流程，统筹三道人工关，向人汇总最终结果',
      trigger: '收到人提出的"订单核心服务要不要迁移到事件驱动架构"的问题',
      watches: ['n3', 'n26']
    },
    n3: {
      role: '维护迁移目标与约束等共识文档，在调研、辩论之间来回确认结论',
      trigger: '任意阶段产出新结论，或专家对共识提出异议',
      watches: ['n11', 'n12', 'n13', 'n14', 'n15', 'n16']
    },
    n4: {
      role: '把分析师和规划师的初步结论整理成选项，呈报给人决定要不要进入调研',
      trigger: '综合者确认战略阶段的结论已经稳定',
      watches: ['n1', 'n2']
    },
    n11: {
      role: '核验六路调研材料是否可信，是否覆盖现有系统约束',
      trigger: '收到调研员提交的材料',
      watches: ['n5', 'n6', 'n7', 'n8', 'n9']
    },
    n16: {
      role: '专找方案漏洞，质疑证据是否充分',
      trigger: '看到综合者整理出的辩论材料包',
      watches: ['n11']
    },
    n17: {
      role: '把五心智辩论留下的候选方案和争议点整理呈报，供人决定要不要进入构建',
      trigger: '综合者汇总辩论共识后转交',
      watches: ['n3', 'n16']
    },
    n23: {
      role: '把构建组的交付物和集成结果整理呈报，供人决定要不要送质检',
      trigger: '集成者完成集成后转交',
      watches: ['n22']
    },
    n26: {
      role: '汇总安全测试和质量测试的结论，判断本期迁移是否通过质检',
      trigger: '安全测试和质量测试都提交了结论',
      watches: ['n24', 'n25']
    }
  },
  docs: [
    { id: 'd_goal_constraints', layer: 'consensus', name: '迁移目标与约束', owner: 'n3', summary: '为什么要迁移、迁移范围边界、不能触碰的红线', audience: 'all' },
    { id: 'd_system_constraints', layer: 'consensus', name: '现有系统约束', owner: 'n1', summary: '订单服务现状：接口、依赖、历史债务、不能停机的时间窗口', audience: ['n5', 'n6', 'n7', 'n8', 'n9', 'n10', 'n11'] },
    { id: 'd_interface_checklist', layer: 'private', name: '接口迁移清单', owner: 'n22', summary: '需要新建或改造的接口列表，含事件契约和回滚方案', audience: ['n18', 'n19', 'n20', 'n21', 'n22'] },
    { id: 'd_resource_index', layer: 'map', name: '资料索引', owner: 'n11', summary: '六路调研材料和历史决策文档的索引，按主题分类', audience: 'all' },
    { id: 'd_debate_brief', layer: 'private', name: '辩论材料包', owner: 'n3', summary: '经审核的调研结论汇编，供五位专家辩论时引用', audience: ['n12', 'n13', 'n14', 'n15', 'n16'] },
    { id: 'd_qa_checklist', layer: 'private', name: '质检清单', owner: 'n26', summary: '安全测试和质量测试的验收项和通过标准', audience: ['n24', 'n25', 'n26'] }
  ],
  infoReads: [
    ['n16', 'n11', '唱反调者直接读调研审核员的原始报告，不等综合者转述'],
    ['n7', 'n6', '体验调研员直接读社区调研员摘录的原话，核对语境'],
    ['n24', 'n18', '安全测试直接读后端开发的代码产出，不经集成者转交']
  ],
  watches: [
    ['n0', 'n3', '编排者盯着综合者维护的共识文档'],
    ['n26', 'n24', '质检负责人盯着安全测试的结论'],
    ['n26', 'n25', '质检负责人盯着质量测试的结论']
  ],
  process: {
    stages: [
      { id: 's_strategy', name: '战略分析', groupId: 'g_strategy', steps: [
        { id: 'st_kickoff', name: '启动决策流程', executors: ['n0'] },
        { id: 'st_analyze', name: '分析现状', executors: ['n1'] },
        { id: 'st_plan', name: '制定调研计划', executors: ['n2'] },
        { id: 'st_sync', name: '维护共识文档', executors: ['n3'] },
        { id: 'st_present_strategy', name: '呈报战略决策', executors: ['n4'] }
      ] },
      { id: 's_research', name: '多方调研', groupId: 'g_research', steps: [
        { id: 'st_res_tech', name: '技术方向调研', executors: ['n5'] },
        { id: 'st_res_reddit', name: '社区讨论调研', executors: ['n6'] },
        { id: 'st_res_ux', name: '使用体验调研', executors: ['n7'] },
        { id: 'st_res_github', name: '开源方案调研', executors: ['n8'] },
        { id: 'st_res_forums', name: '专业论坛调研', executors: ['n9'] },
        { id: 'st_res_critic', name: '调研材料审核', executors: ['n11'] }
      ] },
      { id: 's_debate', name: '五心智辩论', groupId: 'g_debate', steps: [
        { id: 'st_debate_positions', name: '五位专家提出立场', executors: ['n12', 'n13', 'n14', 'n15', 'n16'] },
        { id: 'st_debate_sync', name: '整理辩论共识', executors: ['n3'] },
        { id: 'st_present_debate', name: '呈报辩论决策', executors: ['n17'] }
      ] },
      { id: 's_build', name: '方案构建', groupId: 'g_build', steps: [
        { id: 'st_build_backend', name: '后端开发', executors: ['n18'] },
        { id: 'st_build_frontend', name: '前端开发', executors: ['n19'] },
        { id: 'st_build_feature', name: '功能开发', executors: ['n20'] },
        { id: 'st_build_design', name: '界面设计', executors: ['n21'] },
        { id: 'st_build_integrate', name: '集成联调', executors: ['n22'] },
        { id: 'st_present_build', name: '呈报构建决策', executors: ['n23'] }
      ] },
      { id: 's_qa', name: '质量检验', groupId: 'g_qa', steps: [
        { id: 'st_qa_security', name: '安全测试', executors: ['n24'] },
        { id: 'st_qa_quality', name: '质量测试', executors: ['n25'] },
        { id: 'st_qa_summary', name: '汇总质检结论', executors: ['n26'] }
      ] }
    ],
    gates: [
      { id: 'gt_strategy', name: '战略结论是否进入调研', afterStage: 's_strategy',
        decider: { type: 'human', who: 'n4', text: '人审阅战略呈报，决定要不要立项调研' },
        pass: 's_research', fail: 's_strategy', escalate: 'human' },
      { id: 'gt_research', name: '调研来源是否够充分', afterStage: 's_research',
        decider: { type: 'rule', text: '调研来源不少于 5 个' },
        pass: 's_debate', fail: 's_research', escalate: null },
      { id: 'gt_debate', name: '辩论方案是否进入构建', afterStage: 's_debate',
        decider: { type: 'human', who: 'n17', text: '人审阅候选方案和争议点，决定选哪个方向构建' },
        pass: 's_build', fail: 's_debate', escalate: 'human' },
      { id: 'gt_build', name: '构建交付是否进入质检', afterStage: 's_build',
        decider: { type: 'human', who: 'n23', text: '人审阅构建组的交付和集成结果，决定要不要送质检' },
        pass: 's_qa', fail: 's_build', escalate: 'human' },
      { id: 'gt_qa', name: '质检是否通过', afterStage: 's_qa',
        decider: { type: 'agent', who: 'n26', text: '质检负责人按安全测试和质量测试结论判断是否放行' },
        pass: 'done', fail: 's_build', escalate: 'human' }
    ]
  },
  scenario: {
    cases: [
      { id: 'K1', name: '第一期迁移',
        rework: { gate: 'gt_qa', times: 1 },
        missing: [{ ind: 'n6', doc: 'd_system_constraints' }] },
      { id: 'K2', name: '迁移方案复核' },
      { id: 'K3', name: '第二期迁移',
        blockedAt: 'gt_build',
        inject: [{ at: 0.6, to: 'n22', kind: 'instruction', text: '人在运行中追加要求：第二期要支持灰度回滚，集成者补一份回滚脚本' }] }
    ],
    neverDispatch: ['n10'],
    undeclared: [['n19', 'n7', '前端直接找体验调研员要资料']],
    outage: [{ channel: 'ch_opus', at: 0.5, dur: 0.05, kind: 'quota', note: '额度用完' }],
    versionChanges: [{ at: 0.3, note: '人补充"现有系统约束"文档，追加给调研组工作包', by: 'human' }]
  },
  decisions: {
    n0: [
      { title: '是否启动完整的深度决策流程', trigger: '人提出订单核心服务要不要迁移到事件驱动架构的问题',
        alternatives: ['直接走轻量评估流程', '走完整的深度调研加五心智辩论流程', '先做小范围技术验证再决定要不要立项'],
        choice: '走完整的深度调研加五心智辩论流程',
        reason: '订单服务是核心交易链路，迁移方向难以回退，需要多角度证据和人工把关',
        impact: '流程拉长，但降低了做错方向的风险', action: 'request' },
      { title: 'K1 在质检关被打回后是否中止', trigger: 'K1 在质检关被打回一次，需要决定是否继续等整改',
        alternatives: ['中止本期迁移，退回构建阶段重做', '跳过本次质检问题直接上线', '升级给人裁决是否继续'],
        choice: '退回构建阶段重做，不跳过质检问题',
        reason: '质检发现的问题属于安全测试和质量测试共同确认的问题，跳过风险太高',
        impact: 'K1 上线时间推迟，但没有把已知问题带入生产', action: 'request' },
      { title: '收到质检负责人最终报告后是否结案', trigger: 'n26 汇总安全测试和质量测试结论并上报',
        alternatives: ['结案，归档本期迁移', '要求补充验证再结案', '升级给人做最终确认'],
        choice: '结案，归档本期迁移',
        reason: '质检已通过且无遗留问题，符合结案标准',
        impact: '本期迁移正式完成，经验纳入下一期立项参考', action: 'deliver' }
    ],
    n3: [
      { title: '调研材料来源不均衡时怎么处理', trigger: '审核员提交审核意见，指出部分调研样本量不足',
        alternatives: ['要求对应调研员补充材料', '接受现有材料进入辩论', '把问题标注出来一起交给专家辩论'],
        choice: '把问题标注出来一起交给专家辩论',
        reason: '时间有限，专家辩论本身就能检验证据是否充分',
        impact: '辩论里出现对数据不全的质疑，但没有拖慢进度', action: 'deliver' },
      { title: '辩论出现分歧时是否现在就收敛结论', trigger: '务实派和创新派在一次性迁移还是分批迁移上持续僵持',
        alternatives: ['现在收敛成一个折中方案', '保留两个方案都交给人工决策', '再给一轮时间让专家补充论据'],
        choice: '保留两个方案都交给人工决策',
        reason: '两个方案的风险取舍属于业务判断，不该由综合者单方面拍板',
        impact: '决策呈报员要把两个方案都整理清楚，人工关的决策内容变多', action: 'escalate' },
      { title: '唱反调者质疑数据不全后是否推迟辩论', trigger: 'n16 指出社区调研样本没有对照现有系统约束',
        alternatives: ['推迟辩论等补充材料', '辩论继续但把这条疑问记入纪要', '直接认定该调研结论无效'],
        choice: '辩论继续但把这条疑问记入纪要',
        reason: '补充材料需要的时间会拖累关键路径，先记录风险更务实',
        impact: '该疑问被带入人工决策参考，没有影响辩论阶段的进度', action: 'deliver' }
    ],
    n11: [
      { title: '六路调研材料是否都够资格进入辩论', trigger: '六位调研员提交各自材料',
        alternatives: ['全部材料直接转交', '剔除样本量不足的材料', '标注风险后全部转交'],
        choice: '标注风险后全部转交',
        reason: '调研来源要满足不少于 5 个的规则，剔除会跌破底线，但不能不提示风险',
        impact: '辩论材料包里保留了一份标了风险的材料，后续被唱反调者点出来', action: 'deliver' },
      { title: '发现社区调研缺少现有系统约束对照时怎么标注', trigger: '核对社区调研材料时发现没有引用现有系统约束文档',
        alternatives: ['打回社区调研员补充', '在审核意见里注明缺口', '忽略这个缺口'],
        choice: '在审核意见里注明缺口',
        reason: '退回会耽误整条链路，但缺口必须让后续环节知道',
        impact: '辩论阶段果然有人针对这个缺口提出质疑', action: 'deliver' }
    ],
    n16: [
      { title: '是否接受社区调研样本作为决策依据', trigger: '读到审核意见里标注的"样本缺少现有系统约束对照"的风险提示',
        alternatives: ['直接否决这份材料', '要求补充材料后再议', '接受材料但要求结论里写明局限性'],
        choice: '接受材料但要求结论里写明局限性',
        reason: '否决会让团队缺一路社区声音，但不写清楚局限性会误导构建阶段',
        impact: '最终方案文档里多了一条关于样本局限性的说明', action: 'request' },
      { title: '务实派和创新派快要达成一致时是否继续追问', trigger: '务实派提出分批迁移、创新派基本认可，讨论快要收敛',
        alternatives: ['不再反对，附议收敛', '继续追问分批方案的回滚细节', '提出第三个方案搅动讨论'],
        choice: '继续追问分批方案的回滚细节',
        reason: '回滚细节还没人认真推演过，过早收敛会把风险留到构建阶段才发现',
        impact: '讨论多花了一轮，但分批方案补上了回滚细节', action: 'request' }
    ],
    n17: [
      { title: '怎么把两个候选方案呈报给人', trigger: '综合者转来两个保留方案和唱反调者的回滚质疑',
        alternatives: ['只呈报务实派力推的分批方案', '两个方案并列呈报，附上争议点', '先帮人做初步筛选再呈报一个'],
        choice: '两个方案并列呈报，附上争议点',
        reason: '方案难以回退，呈报员不该替人做取舍，但要把争议点整理清楚',
        impact: '人工关耗时变长，但决策依据更完整', action: 'deliver' },
      { title: '人工关选定方案后怎么交接给构建组', trigger: '人在人工关选定分批迁移，先做第一期',
        alternatives: ['把完整辩论记录转给构建组自己提炼', '整理一份构建要点清单再交接', '只转交决策结果，细节让构建组来问'],
        choice: '整理一份构建要点清单再交接',
        reason: '构建组不需要重新读完整辩论记录，但完全不给细节会漏信息',
        impact: '构建组拿到接口迁移清单的雏形，减少了来回确认', action: 'deliver' }
    ],
    n26: [
      { title: 'K1 质检时两份测试结论冲突怎么判断', trigger: '安全测试通过，但质量测试发现事件重复消费的问题',
        alternatives: ['按安全测试通过放行', '认定不通过打回构建', '放行但记录为已知问题'],
        choice: '认定不通过打回构建',
        reason: '事件重复消费会影响订单金额准确性，属于不能带病上线的问题',
        impact: 'K1 在质检关被打回一次，构建组补上了幂等处理', action: 'request' },
      { title: '构建组补完幂等处理后要不要重新跑完整测试', trigger: '构建组提交了修复后的版本等待复检',
        alternatives: ['只重跑之前失败的用例', '重跑完整测试套件', '抽样复测关键路径'],
        choice: '重跑完整测试套件',
        reason: '修复涉及消息处理顺序，影响面不止原来失败的用例',
        impact: '复检时间变长，但没有再出现新的回归问题', action: 'tool' },
      { title: 'K3 还在构建阶段时要不要提前预演质检标准', trigger: '第二期迁移的集成工作接近完成，构建组询问质检关注点',
        alternatives: ['等正式送检再反馈', '提前把质检清单发给构建组', '口头提示几个重点，不正式发清单'],
        choice: '提前把质检清单发给构建组',
        reason: '第一期已经暴露过幂等问题，提前对齐能减少返工概率',
        impact: '构建组按清单自查，减少了 K3 送检后再次被打回的风险', action: 'deliver' }
    ]
  }
};
