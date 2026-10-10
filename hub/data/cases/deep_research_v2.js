/* ARCHIVED: v41 curated override for 'deep_research_v2'.
   Source of truth has moved to hub/cases/deep_research_v2/ (Markdown, parsed by from-docs.js).
   This file is kept for reference and backward compatibility with the sim pipeline.
   Do NOT edit — update hub/cases/deep_research_v2/ instead. */
window.HUB = window.HUB || {};
HUB.cases = HUB.cases || {};
HUB.cases['deep_research_v2'] = {
  title: '深度调研 v2：多智能体协作可视化的工具与做法扫描',
  summary: '团队要回答一个问题：多智能体协作可视化领域现在有哪些工具和做法，各自的长处和短板。7 个调研员按一手资料和社区声音两路检索，7 个提取员把长报告压成事实表，审核员把关来源质量，精简综合者合并出最终结论。这一轮共跑了三个调研实例：全景扫描、开源可视化做法补查、商业定价补查。',
  groups: [
    { id: 'g_cmd', name: '指挥', members: ['n0'] },
    { id: 'g_research', name: '调研', children: [
      { id: 'g_research_primary', name: '一手资料', members: ['n1', 'n5', 'n7'] },
      { id: 'g_research_community', name: '社区声音', members: ['n2', 'n3', 'n4', 'n6'] }
    ] },
    { id: 'g_extract', name: '提取', members: ['n8', 'n9', 'n10', 'n11', 'n12', 'n13', 'n14'] },
    { id: 'g_review', name: '审核', members: ['n15'] },
    { id: 'g_synthesis', name: '综合', members: ['n16'] }
  ],
  individuals: {
    n0: {
      role: '拆解调研问题，把方向派给 7 个调研员，收到精简综合报告后决定是否结束',
      trigger: '收到人下达的调研目标，或精简综合者交回报告',
      watches: ['n15']
    },
    n8: {
      role: '把技术调研员的长报告压成 15 到 30 条可引用事实表，标注矛盾和空白',
      trigger: '技术调研员交付报告后开始提取',
      watches: ['n1']
    },
    n15: {
      role: '审核事实表和原始报告，检查来源是否多元、是否有官方依据，决定能不能进入综合阶段',
      trigger: '7 份事实表全部交齐后开始审核',
      watches: ['n8', 'n12']
    },
    n16: {
      role: '把 7 份事实表和审核结论合并成一份精简综合报告，供人确认能不能用',
      trigger: '审核通过后开始综合，或人没确认通过要求重新综合',
      watches: ['n15']
    }
  },
  docs: [
    { id: 'd_scope', layer: 'consensus', name: '调研问题与范围', owner: 'n0', summary: '这轮调研要回答的问题、覆盖的工具范围、不覆盖的内容', audience: 'all' },
    { id: 'd_cred_std', layer: 'consensus', name: '来源可信度标准', owner: 'n15', summary: '什么算一手资料、什么算转述，官方文档、代码仓库、社区帖子的可信度怎么排序', audience: 'all' },
    { id: 'd_extract_std', layer: 'private', name: '提取标准', owner: 'n15', summary: '事实表的字段、每条事实要不要带来源链接、矛盾和空白怎么标注', audience: ['n8', 'n9', 'n10', 'n11', 'n12', 'n13', 'n14'] },
    { id: 'd_keywords', layer: 'private', name: '各平台检索关键词', owner: 'n0', summary: '7 个调研员各自在对应平台上用的检索词和限定条件', audience: ['n1', 'n2', 'n3', 'n4', 'n5', 'n6', 'n7'] },
    { id: 'd_collected_index', layer: 'map', name: '已收集资料索引', owner: 'n16', summary: '目前已经收集并提取过的来源清单，避免重复调研', audience: 'all' },
    { id: 'd_review_checklist', layer: 'private', name: '审核清单', owner: 'n15', summary: '审核时逐项检查的条目：来源数量、来源类型分布、是否有官方依据、矛盾是否标注', audience: ['n15', 'n16'] }
  ],
  infoReads: [
    ['n8', 'n15', '审核员直接读提取员的事实表，不只看调研员的原始报告'],
    ['n7', 'n16', '精简综合者直接读文档调研员的原始报告，核对官方信息'],
    ['n5', 'n15', '审核员抽查开源调研员的原始报告，核实事实表里的仓库名']
  ],
  watches: [
    ['n0', 'n15', '编排者盯着审核员，关注调研有没有被挡在审核关'],
    ['n15', 'n8', '审核员盯着这份事实表，核对技术类事实有没有标矛盾'],
    ['n15', 'n12', '审核员盯着这份事实表，核对开源类事实是否覆盖官方仓库说明']
  ],
  process: {
    stages: [
      { id: 's_dispatch', name: '派发', groupId: 'g_cmd', steps: [
        { id: 'st_scope', name: '拆解调研范围并派发', executors: ['n0'] }
      ] },
      { id: 's_research', name: '调研', groupId: 'g_research', steps: [
        { id: 'st_primary', name: '一手资料检索', executors: ['n1', 'n5', 'n7'] },
        { id: 'st_community', name: '社区声音检索', executors: ['n2', 'n3', 'n6'] }
      ] },
      { id: 's_extract', name: '提取', groupId: 'g_extract', steps: [
        { id: 'st_extract_primary', name: '压缩一手资料事实表', executors: ['n8', 'n12', 'n14'] },
        { id: 'st_extract_community', name: '压缩社区声音事实表', executors: ['n9', 'n10', 'n13'] }
      ] },
      { id: 's_review', name: '审核', groupId: 'g_review', steps: [
        { id: 'st_review_check', name: '逐项审核事实表与来源', executors: ['n15'] }
      ] },
      { id: 's_synthesis', name: '综合', groupId: 'g_synthesis', steps: [
        { id: 'st_synth_merge', name: '合并精简综合报告', executors: ['n16'] }
      ] }
    ],
    gates: [
      { id: 'gt_research_rule', name: '调研产出是否足够', afterStage: 's_research',
        decider: { type: 'rule', text: '每个来源至少要能整理出 5 条可引用事实，不够就退回补充调研' },
        pass: 's_extract', fail: 's_research' },
      { id: 'gt_review', name: '审核是否通过', afterStage: 's_review',
        decider: { type: 'agent', who: 'n15', text: '检查来源是否多元、是否覆盖官方文档、矛盾有没有标注' },
        pass: 's_synthesis', fail: 's_research' },
      { id: 'gt_human', name: '结论能不能对外使用', afterStage: 's_synthesis',
        decider: { type: 'human', who: 'human', text: '人确认综合报告的结论是否可以对外使用' },
        pass: 'done', fail: 's_review', escalate: 'human' }
    ]
  },
  scenario: {
    cases: [
      { id: 'K1', name: '第一轮全面调研：工具与做法全景',
        rework: { gate: 'gt_review', times: 1 },
        missing: [
          { ind: 'n10', doc: 'd_extract_std' },
          { ind: 'n12', doc: 'd_extract_std' }
        ] },
      { id: 'K2', name: '补查：开源项目的可视化做法' },
      { id: 'K3', name: '补查：商业产品的定价与使用限制',
        blockedAt: 'gt_review',
        inject: [
          { at: 0.72, to: 'n7', kind: 'instruction', text: '只看 2025 年以后的定价和限制信息，更早的版本不用列' }
        ] }
    ],
    neverDispatch: ['n4', 'n11'],
    undeclared: [
      ['n16', 'n1', '精简综合者直接联系技术调研员，追问一个版本号数据的原始出处']
    ],
    outage: [
      { channel: 'ch_haiku', at: 0.35, dur: 0.05, kind: 'quota', note: 'haiku 模型额度用完，7 个提取员短暂调不动模型' }
    ],
    versionChanges: [
      { at: 0.4, note: '把提取标准文档加进全部提取员的工作包，避免再出现表格格式不一致', by: 'human' }
    ]
  },
  decisions: {
    n0: [
      { title: '调研范围怎么拆', trigger: '收到人下达的调研目标',
        alternatives: ['按平台拆，7 个调研员各管一类来源', '按问题维度拆，比如功能、价格、生态', '先按平台拆，后面综合阶段再按问题整合'],
        choice: '先按平台拆，后面综合阶段再按问题整合',
        reason: '不同平台的检索方式差别大，按平台分工上手最快，问题维度留给综合阶段统一处理',
        impact: '7 个调研员的任务边界清楚，但综合阶段要多做一次整合',
        action: 'deliver' },
      { title: 'K1 被打回后怎么处理', trigger: '审核员打回调研结果，指出来源集中、缺官方文档',
        alternatives: ['让 7 个调研员全部重新跑一遍', '只让技术和文档调研员补查官方资料', '不改范围，只要求提取员重新整理'],
        choice: '只让技术和文档调研员补查官方资料',
        reason: '审核反馈主要指向官方文档不够，不用七路全部重跑，能缩短返工时间',
        impact: '调研周期多了一轮，但范围控制住了，没有影响其他 5 个调研员',
        action: 'request' },
      { title: 'K3 要不要新增一个调研员', trigger: '人提出要补查商业产品的定价和使用限制',
        alternatives: ['新增一个专职的商业调研员', '让文档调研员顺带查官网定价页', '让技术调研员顺带查'],
        choice: '让文档调研员顺带查官网定价页',
        reason: '定价和限制信息大多在产品官网和文档里，属于文档调研员的主场，不用新增角色',
        impact: '团队规模没有变化，文档调研员这一轮的工作量变大',
        action: 'deliver' }
    ],
    n1: [
      { title: '要不要收录商业产品的宣传页', trigger: '搜索技术对比资料时，很多结果是商业产品的宣传页面',
        alternatives: ['全部收录，交给提取员过滤', '只收录带具体功能说明的页面', '完全不用商业产品的页面'],
        choice: '只收录带具体功能说明的页面',
        reason: '纯宣传页信息密度低，留给提取员过滤会拉低事实表的可引用比例',
        impact: '报告里来源数量略少，但可引用事实的密度更高',
        action: 'deliver' },
      { title: '被打回后要不要换检索方式', trigger: '审核指出来源太集中、缺官方文档，要求补查',
        alternatives: ['换个搜索引擎，关键词不变', '改用更偏官方文档的关键词组合，并直接查官网', '等文档调研员补查，自己不动'],
        choice: '改用更偏官方文档的关键词组合，并直接查官网',
        reason: '问题出在来源类型不对，不是搜索引擎不够用，直接查官网最对症',
        impact: '补查后来源结构明显改善，K1 复审时通过了审核关',
        action: 'tool' },
      { title: 'K3 的定价调研要不要自己兼着做', trigger: '编排者问能不能顺带查一下工具的定价',
        alternatives: ['接下来自己一起做', '建议交给文档调研员专门做', '和文档调研员各查一半'],
        choice: '建议交给文档调研员专门做',
        reason: '定价信息大多在官网定价页，属于文档调研员的主场，自己再查会重复',
        impact: 'K3 的定价调研整个交给了文档调研员，自己继续专注技术对比',
        action: 'yield' }
    ],
    n8: [
      { title: '几个来源说的是同一个特点，要不要合并', trigger: '技术调研报告里多个来源描述的是同一个工具的同一个特点',
        alternatives: ['每条来源各记一条，不合并', '只留最权威的来源那一条', '合并成一条事实，备注全部来源'],
        choice: '合并成一条事实，备注全部来源',
        reason: '提取标准要求事实表尽量精简，备注来源既不丢信息，又不占多条',
        impact: '事实表条数变少，单条事实的可信度标注更清楚',
        action: 'deliver' },
      { title: '两个来源的说法互相矛盾，怎么记', trigger: '两个来源对同一个工具是否支持实时协作的说法不一致',
        alternatives: ['都记下来，标注为矛盾', '只留看起来更新的一条', '先搁置，等调研员确认'],
        choice: '都记下来，标注为矛盾',
        reason: '提取员的职责是压缩事实，不是裁决真假，矛盾应该原样交给审核员处理',
        impact: '审核员能看到这个矛盾点，综合阶段会单独说明',
        action: 'deliver' },
      { title: '表格字段要不要按自己的习惯调整', trigger: '提取标准里的字段顺序不太顺手',
        alternatives: ['按标准一字不改', '调整列的顺序，字段不变', '按自己的习惯重新设计表格'],
        choice: '按标准一字不改',
        reason: '7 份事实表要交给精简综合者统一处理，格式不一致会增加综合阶段的负担',
        impact: '表格格式和其他提取员保持一致，综合阶段不用额外清洗格式',
        action: 'deliver' }
    ],
    n15: [
      { title: 'K1 的来源够不够', trigger: '收到 7 份事实表，准备审核',
        alternatives: ['通过，后续综合阶段再补', '打回调研阶段重新找来源', '只打回缺官方文档的那几份'],
        choice: '打回调研阶段重新找来源',
        reason: '来源主要集中在社区帖子和社交平台，缺官方文档支撑，直接通过会让结论站不住脚',
        impact: '调研周期多了一轮，但报告的可信度提高了',
        action: 'request' },
      { title: '两份事实表格式不全，怎么处理', trigger: '审核时发现两份事实表缺栏目，和其他 5 份不一致',
        alternatives: ['直接打回这两份重做', '自己按其他 5 份的格式补齐', '记录问题，建议补发标准文档给全部提取员'],
        choice: '记录问题，建议补发标准文档给全部提取员',
        reason: '问题的根源是工作包里没附提取标准，不是提取员能力问题，补发文档才能根治',
        impact: '推动了后续的工作包调整，第二个案例的 7 份事实表格式一致',
        action: 'escalate' },
      { title: 'K3 没做完要不要先给意见', trigger: '商业定价的调研还在进行，人询问能不能先看初步结论',
        alternatives: ['现在就给初步意见', '等全部来源到齐再审', '只提醒没有把握的部分'],
        choice: '等全部来源到齐再审',
        reason: '定价信息常有版本和地区差异，来源不全就审容易给出错误结论',
        impact: 'K3 停在审核关前，等调研补齐再往下走',
        action: 'yield' }
    ],
    n16: [
      { title: '事实表里标了矛盾的一条，结论怎么写', trigger: '合并事实表时发现技术类有一条事实标了矛盾',
        alternatives: ['选一个更可信的说法写进结论', '两种说法都写，注明有争议', '跳过这条不写'],
        choice: '两种说法都写，注明有争议',
        reason: '精简综合者不该替审核员和调研员裁决分歧，这类情况应该原样呈现给看报告的人',
        impact: '结论里保留了一处待确认的分歧，供人工决策时参考',
        action: 'deliver' },
      { title: '原始报告和事实表的一个数据对不上', trigger: '核对文档调研员的原始报告时，发现一个版本号和事实表不一致',
        alternatives: ['按事实表写，不再核实', '按原始报告改，不问提取员', '直接联系技术调研员确认'],
        choice: '直接联系技术调研员确认',
        reason: '版本号这类具体数据错一位就会误导读者，值得跨级确认一次',
        impact: '绕开了提取员和审核员，形成一次没有写进编排的直接联系',
        action: 'request' },
      { title: '报告要不要等 K3 做完再交', trigger: '人询问本轮能不能先拿到一份完整报告',
        alternatives: ['只交 K1、K2 的结论', '把 K3 的半成品也写进去，标注未完成', '等 K3 完成再统一交付'],
        choice: '只交 K1、K2 的结论，K3 单独标注进行中',
        reason: 'K3 还没过审核关，写进正式结论里风险比较大',
        impact: '人先拿到一份可用的报告，K3 的结论等审核通过后再补',
        action: 'deliver' }
    ]
  }
};
