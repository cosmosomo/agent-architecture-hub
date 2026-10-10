window.HUB = window.HUB || {};
HUB.cases = HUB.cases || {};
HUB.cases['feature_sprint'] = {
  title: '反馈自动归类功能冲刺',
  summary: '客服后台要在两天内加一个功能：把用户反馈按缺陷、建议、咨询自动分类，并支持在后台列表按分类筛选。团队先后做了三件事：第一版上线、补充按产品线筛选、再加一个分类准确率看板。',

  groups: [
    { id: 'g_plan', name: '规划', members: ['n0', 'n1'] },
    { id: 'g_research', name: '调研', members: ['n2', 'n3'] },
    { id: 'g_build', name: '构建', members: [], children: [
      { id: 'g_build_be', name: '后端小组', members: ['n4'] },
      { id: 'g_build_fe', name: '前端小组', members: ['n5'] }
    ] },
    { id: 'g_qa', name: '质检', members: ['n6'] }
  ],

  individuals: {
    n0: {
      role: '接收人类的功能需求，拆给分析师，并跟进调研、构建和质检的进度',
      trigger: '人类提出新的功能需求，或者在运行过程中追加指令',
      watches: ['n1', 'n6']
    },
    n1: {
      role: '把功能需求拆成技术方向和体验方向的调研任务，并定出验收标准',
      trigger: '编排者派发的功能需求',
      watches: ['n2', 'n3']
    },
    n6: {
      role: '对照验收清单检查后端和前端的实现，判断能不能通过',
      trigger: '后端和前端都提交了各自的实现',
      watches: ['n4', 'n5']
    }
  },

  // 后端开发接入的是豆包：它自带“创建多智能体并行开发”，这是只属于它的能力
  native: [
    { owner: 'n4', host: '豆包', id: 'ch_nat_doubao_multi', name: '豆包 · 创建多智能体并行开发', short: '多智能体并行开发', limit: 6,
      note: '豆包自带：把一项开发拆成几个子智能体同时写，写完自动合并；本团队只有后端开发有这个能力' }
  ],

  docs: [
    { id: 'd_spec', layer: 'consensus', name: '功能说明', owner: 'human', audience: 'all',
      summary: '把客服反馈按缺陷、建议、咨询三类自动分类，后台列表支持按分类筛选的需求说明' },
    { id: 'd_accept', layer: 'consensus', name: '验收清单', owner: 'n1', audience: 'all',
      summary: '三类判定的示例集合、筛选交互的验收标准，后续又补了一条分类准确率的最低要求' },
    { id: 'd_api', layer: 'private', name: '接口约定', owner: 'n4', audience: ['n4', 'n5'],
      summary: '分类字段的命名、取值范围和筛选参数格式，后端和前端按这份对齐接口' },
    { id: 'd_wireframe', layer: 'private', name: '界面草图', owner: 'n3', audience: ['n5'],
      summary: '列表页分类标签和筛选控件的位置草图，给前端实现界面用' },
    { id: 'd_index', layer: 'map', name: '资料索引', owner: 'n0', audience: 'all',
      summary: '团队里所有文档和调研结论的索引，告诉成员该去哪里找哪份资料' }
  ],

  infoReads: [
    ['n1', 'n6', '质量测试直接读分析师的需求拆解，核对验收标准'],
    ['n2', 'n5', '前端读技术调研员关于分类规则可选方案的结论'],
    ['n2', 'n6', '质量测试读技术调研员关于分类准确率基线的结论，用来判断看板数据是否合理']
  ],

  watches: [
    ['n0', 'n6', '编排者盯着质检结果，判断要不要催办或改派'],
    ['n1', 'n4', '分析师盯着后端进度，防止再次漏发接口约定']
  ],

  process: {
    stages: [
      { id: 's_analysis', name: '需求分析', groupId: 'g_plan', steps: [
        { id: 'st_dispatch', name: '派发需求', executors: ['n0'] },
        { id: 'st_split', name: '拆解需求和验收标准', executors: ['n1'] }
      ] },
      { id: 's_research', name: '调研', groupId: 'g_research', steps: [
        { id: 'st_tech', name: '调研分类技术方案', executors: ['n2'] },
        { id: 'st_ux', name: '调研筛选交互方案', executors: ['n3'] }
      ] },
      { id: 's_build', name: '构建', groupId: 'g_build', steps: [
        { id: 'st_backend', name: '实现分类接口和筛选参数', executors: ['n4'] },
        { id: 'st_frontend', name: '实现列表分类标签和筛选控件', executors: ['n5'] }
      ] },
      { id: 's_qa', name: '质检', groupId: 'g_qa', steps: [
        { id: 'st_check', name: '对照验收清单检查实现', executors: ['n6'] }
      ] }
    ],
    gates: [
      { id: 'gt_sources', name: '调研来源是否足够', afterStage: 's_research',
        decider: { type: 'rule', text: '技术方向和体验方向的结论，每个至少有 3 个独立来源' },
        pass: 's_build', fail: 's_research' },
      { id: 'gt_plan_confirm', name: '方案是否确认', afterStage: 's_research',
        decider: { type: 'human', who: 'human', text: '人确认调研结论和技术选型，再放行构建' },
        pass: 's_build', fail: 's_research' },
      { id: 'gt_qa', name: '验收是否通过', afterStage: 's_build',
        decider: { type: 'agent', who: 'n6', text: '按验收清单逐条检查后端和前端的实现' },
        pass: 'done', fail: 's_build', escalate: 'human' }
    ]
  },

  scenario: {
    cases: [
      { id: 'K1', name: '第一版上线：反馈自动归类',
        rework: { gate: 'gt_qa', times: 1 },
        missing: [{ ind: 'n4', doc: 'd_api' }] },
      { id: 'K2', name: '补充筛选：按产品线筛选' },
      { id: 'K3', name: '新增分类准确率看板',
        blockedAt: 'gt_qa',
        inject: [{ at: 0.75, to: 'n5', kind: 'instruction', text: '看板先只做周维度的统计，日维度以后再加' }] }
    ],
    neverDispatch: [],
    undeclared: [
      ['n5', 'n2', '前端直接找技术调研员要分类算法的实现细节，这条线编排里没有']
    ],
    outage: [
      { channel: 'ch_haiku', at: 0.6, dur: 0.05, kind: 'quota', note: 'haiku 渠道额度用完' }
    ],
    versionChanges: [
      { at: 0.38, note: '把验收清单正式加入构建组的工作包，后端和前端开始同步对照验收标准', by: 'human' }
    ]
  },

  decisions: {
    n0: [
      { title: '是否先补文档再推进构建', trigger: 'K1 质检被打回，原因是后端没拿到接口约定文档',
        alternatives: ['让后端凭经验先改字段', '让分析师立刻补发接口约定文档，构建重新对齐', '把整个任务退回需求分析重新拆解'],
        choice: '让分析师立刻补发接口约定文档，构建重新对齐',
        reason: '字段分歧是信息没送到，不是需求本身有问题，补发文档比重新拆解更快',
        impact: 'K1 多了一次质检返工，但没有退回需求分析阶段',
        action: 'request' },
      { title: 'K3 是否要因为 haiku 额度用完而暂停', trigger: '质量测试依赖的 haiku 渠道额度用完',
        alternatives: ['等额度恢复', '把质量测试临时换成别的模型渠道', '先让质检排队，构建继续推进其他部分'],
        choice: '先让质检排队，构建继续推进其他部分',
        reason: '额度恢复时间不长，换渠道成本更高，排队不影响构建继续做完',
        impact: 'K3 停在质检关前，构建的结果保留等待质检恢复',
        action: 'yield' },
      { title: '是否把验收清单正式加入构建组的工作包', trigger: 'K1 返工之后要避免同样的信息遗漏',
        alternatives: ['只口头提醒后端前端对照验收清单', '把验收清单文档正式加入构建组的工作包', '改成每次构建前单独开会过一遍'],
        choice: '把验收清单文档正式加入构建组的工作包',
        reason: '文档化比口头提醒和额外开会更稳定，不依赖人记得',
        impact: '构建组从 K2 开始都能直接看到验收清单，减少对齐成本',
        action: 'deliver' }
    ],
    n1: [
      { title: '需求拆解时要不要把接口约定单独立项', trigger: '前后端都要用到分类字段，容易出现字段对不齐',
        alternatives: ['把接口约定写进统一的功能说明里', '单独立一份接口约定文档，只给后端和前端', '不单独立项，让后端前端开发时自己对'],
        choice: '单独立一份接口约定文档，只给后端和前端',
        reason: '字段约定变化比功能说明频繁，单独立项方便改动不影响主文档',
        impact: '文档建立了，但 K1 执行时没有及时送到后端手里，仍然引发一次返工',
        action: 'deliver' },
      { title: '调研方向怎么分配给两个调研员', trigger: '需求同时涉及分类技术选型和筛选交互方式',
        alternatives: ['技术和体验都交给同一个调研员顺序做', '技术调研员和体验调研员并行各看一个方向', '先做技术调研，体验调研等技术方案定了再开始'],
        choice: '技术调研员和体验调研员并行各看一个方向',
        reason: '两个方向耦合不深，并行能缩短调研时间，符合两天内上线的节奏',
        impact: '调研时间缩短，但两人结论需要在构建前对一次，于是加了方案确认这一关',
        action: 'deliver' },
      { title: 'K3 的验收标准要不要包含准确率数值目标', trigger: '分类准确率看板是新需求，旧验收清单没有对应标准',
        alternatives: ['先沿用旧的验收清单，不额外加标准', '另外补一条准确率的最低标准', '等看板做出来再补标准'],
        choice: '另外补一条准确率的最低标准',
        reason: '没有数值标准，质检没法判断看板数据算不算合格',
        impact: '验收清单多了一条准确率标准，质检有了明确依据',
        action: 'deliver' }
    ],
    n4: [
      { title: 'K1 没拿到接口约定时要不要先凭经验实现', trigger: '构建阶段开始，但接口约定文档还没送到',
        alternatives: ['按自己对需求的理解先定字段名和取值', '向分析师要接口约定文档，等到了再写', '参考技术调研员结论里的示例先垫一版'],
        choice: '按自己对需求的理解先定字段名和取值',
        reason: '两天时间紧，等文档会耽误进度，先写一版后面能改',
        impact: '字段和前端约定的不一致，质检没通过，产生一次返工',
        action: 'yield' },
      { title: '返工时要不要让前端确认一遍接口约定', trigger: 'K1 质检打回后查出来是字段对不齐',
        alternatives: ['接口约定改好直接发给前端，不用确认', '接口约定改好后请前端确认一遍再继续', '两边各自重新读一遍需求说明，不新增确认步骤'],
        choice: '接口约定改好后请前端确认一遍再继续',
        reason: '上一次问题就是文档没被前端实际看到，加一次确认能堵住同样的漏洞',
        impact: 'K2 开始构建前多了一步确认，没有再出现字段不对齐的问题',
        action: 'request' },
      { title: 'K3 准确率看板的统计口径要不要先做到按日', trigger: '人类中途补充指令，要求看板先只做周维度',
        alternatives: ['继续按原计划做到日维度', '只做周维度，日维度留到下一个迭代', '周和日都做，只是日维度先不接入看板界面'],
        choice: '只做周维度，日维度留到下一个迭代',
        reason: '人类的指令已经明确缩小范围，没必要做超出当前要求的部分',
        impact: 'K3 构建范围变小，更可能在截止前进入质检',
        action: 'yield' }
    ],
    n6: [
      { title: 'K1 字段对不齐算不算通过验收', trigger: '对照验收清单检查时发现后端和前端的字段名不一致',
        alternatives: ['字段名不一致但功能能跑，判定通过', '判定不通过，打回构建阶段重新对齐字段', '自己改字段名让两边先凑合通过'],
        choice: '判定不通过，打回构建阶段重新对齐字段',
        reason: '验收清单里写明字段要和接口约定一致，这条不满足就不能算通过',
        impact: 'K1 多了一次返工，避免了字段问题留到上线后才被发现',
        action: 'escalate' },
      { title: 'K2 要不要因为是追加功能就简化检查', trigger: 'K2 只是在 K1 基础上加一个筛选条件',
        alternatives: ['只测新加的筛选功能，其余跳过', '按完整验收清单重新走一遍', '抽查新功能，再加一两个老功能点'],
        choice: '按完整验收清单重新走一遍',
        reason: '筛选条件改动涉及列表查询逻辑，可能影响已有的分类筛选，不能只测新增部分',
        impact: 'K2 检查时间变长，但一次通过，没有引入新的返工',
        action: 'deliver' },
      { title: 'haiku 额度用完时要不要换方式完成质检', trigger: 'K3 要进质检关时，自己所在的 haiku 渠道额度用完',
        alternatives: ['等额度恢复再检查', '换成人工直接看代码，不经过自己', '只做一部分检查，剩下的等额度恢复'],
        choice: '等额度恢复再检查',
        reason: '质检需要完整对照验收清单，部分检查容易漏判，换人工又绕开了既定流程',
        impact: 'K3 停在质检关前，状态变成进行中',
        action: 'yield' }
    ]
  }
};
