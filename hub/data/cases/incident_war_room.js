/* ARCHIVED: v41 curated override for 'incident_war_room'.
   Source of truth has moved to hub/cases/incident_war_room/ (Markdown, parsed by from-docs.js).
   This file is kept for reference and backward compatibility with the sim pipeline.
   Do NOT edit — update hub/cases/incident_war_room/ instead. */
window.HUB = window.HUB || {};
HUB.cases = HUB.cases || {};
HUB.cases['incident_war_room'] = {
  title: '支付接口错误率突增处置',
  summary: '支付接口错误率短时间内升高，作战室并行查看遥测、日志和代码差异，专项分析完成后由唱反调者质疑，回滚前还要过人工关，事后由技术写作复盘。',
  groups: [
    { id: 'g_command', name: '指挥', members: ['n0'] },
    { id: 'g_investigate', name: '排查', members: [], children: [
      { id: 'g_onsite', name: '现场取证', members: ['n1', 'n2', 'n3'] },
      { id: 'g_analysis', name: '专项分析', members: ['n4', 'n5'] }
    ] },
    { id: 'g_challenge', name: '质疑', members: ['n6'] },
    { id: 'g_gate', name: '人工把关', members: ['n7'] },
    { id: 'g_handle', name: '处置', members: ['n8', 'n9'] }
  ],
  individuals: {
    n0: {
      role: '接警后拉起作战室，把取证和专项分析分派下去，汇总决策呈报员的结论后下发处置指令。',
      trigger: '监控告警或值班人员上报支付错误率异常。',
      watches: ['n7']
    },
    n1: {
      role: '巡查监控面板、日志和调用链，定位错误率升高的起始时间和影响范围。',
      trigger: '编排者派发取证任务。',
      watches: ['n4']
    },
    n6: {
      role: '对照专项分析的证据链找漏洞，证据不够或结论牵强就打回重新分析。',
      trigger: '专项分析提交结论。',
      watches: ['n4', 'n5']
    },
    n7: {
      role: '把唱反调者认可的结论和处置方案整理给人看，回滚前必须拿到人的确认。',
      trigger: '唱反调者认可一版结论。',
      watches: ['human']
    },
    meta_maint: {
      role: '维护监控平台查询渠道，保证取证和分析随时能查到数据。',
      trigger: '渠道接近限流或出现故障。',
      watches: ['ch_obs']
    }
  },
  docs: [
    { id: 'd_runbook', layer: 'consensus', name: '事故处置规程', owner: 'human', summary: '事故分级标准、处置流程和各角色职责的统一规定。', audience: 'all' },
    { id: 'd_impact', layer: 'consensus', name: '影响范围通报', owner: 'n0', summary: '当前事故影响的接口、地区和订单规模，随处置进度更新。', audience: 'all' },
    { id: 'd_release', layer: 'private', name: '最近一次发布记录', owner: 'human', summary: '近期上线的版本号、改动内容和发布时间点。', audience: ['n1', 'n3'] },
    { id: 'd_rollback', layer: 'private', name: '回滚步骤', owner: 'n8', summary: '支付网关各服务的回滚顺序、依赖关系和注意事项。', audience: ['n8', 'n7'] },
    { id: 'd_baseline', layer: 'private', name: '性能基线数据', owner: 'n4', summary: '连接池、延迟和错误率的正常区间，用于判断是否偏离基线。', audience: ['n4', 'n6'] },
    { id: 'd_obs_map', layer: 'map', name: '监控面板与日志入口', owner: 'meta_maint', summary: '各服务监控面板、日志平台和链路追踪的入口地址。', audience: 'all' }
  ],
  infoReads: [
    ['n1', 'n6', '唱反调者直接读遥测巡查员的原始发现，不等专项分析转述'],
    ['n3', 'n6', '唱反调者直接看开源调研员查到的最近提交记录，核对是不是改动引起的'],
    ['n4', 'n9', '技术写作直接读性能测试的分析结论，写事后复盘']
  ],
  watches: [
    ['n0', 'n7', '编排者盯着决策呈报员，结论一出就准备下发处置指令'],
    ['n1', 'n8', '遥测巡查员盯着处置进展，确认修复后错误率真的回落']
  ],
  channels: [
    { id: 'ch_obs', kind: 'tool', name: '工具：监控平台查询', maintainer: 'meta_maint', users: ['n1', 'n4'], capacity: '并发 4', quota: '每小时 500 次查询' }
  ],
  process: {
    stages: [
      { id: 's_investigate', name: '取证', groupId: 'g_investigate', steps: [
        { id: 'st_dispatch', name: '派发取证任务', executors: ['n0'] },
        { id: 'st_telemetry', name: '查看遥测指标', executors: ['n1'] },
        { id: 'st_logs', name: '排查日志与可复现性', executors: ['n2'] },
        { id: 'st_diff', name: '核对最近代码提交与已知问题', executors: ['n3'] }
      ] },
      { id: 's_analysis', name: '分析', groupId: 'g_analysis', steps: [
        { id: 'st_perf', name: '性能专项分析', executors: ['n4'] }
      ] },
      { id: 's_challenge', name: '质疑', groupId: 'g_challenge', steps: [
        { id: 'st_challenge', name: '质询专项分析结论', executors: ['n6'] },
        { id: 'st_present', name: '整理结论呈报人工关', executors: ['n7'] }
      ] },
      { id: 's_handle', name: '处置', groupId: 'g_handle', steps: [
        { id: 'st_fix', name: '执行修复或回滚', executors: ['n8'] },
        { id: 'st_review', name: '整理事后复盘', executors: ['n9'] }
      ] }
    ],
    gates: [
      { id: 'gt_rule', name: '是否进入质疑评估', afterStage: 's_analysis',
        decider: { type: 'rule', text: '错误率曲线与最近一次发布时间吻合，且复现路径明确，才进入质疑评估；否则退回分析补证据。' },
        pass: 's_challenge', fail: 's_analysis', escalate: null },
      { id: 'gt_challenge', name: '结论是否站得住', afterStage: 's_challenge',
        decider: { type: 'agent', who: 'n6', text: '核对专项分析的证据链能不能撑住结论，撑不住就打回重新分析。' },
        pass: 's_handle', fail: 's_analysis', escalate: null },
      { id: 'gt_rollback', name: '回滚前的人工确认', afterStage: 's_challenge',
        decider: { type: 'human', who: 'n7', text: '决策呈报员把回滚方案和依据摆出来，由值班负责人拍板是否回滚。' },
        pass: 's_handle', fail: 's_analysis', escalate: 'human' }
    ]
  },
  scenario: {
    cases: [
      { id: 'K1', name: '周五晚高峰支付超时',
        rework: { gate: 'gt_rollback', times: 1 },
        missing: [{ ind: 'n1', doc: 'd_release' }] },
      { id: 'K2', name: '某地区回调失败' },
      { id: 'K3', name: '凌晨数据库连接池耗尽',
        blockedAt: 'gt_rollback',
        inject: [{ at: 0.55, to: 'n8', kind: 'instruction', text: '先扩容连接池，暂不回滚服务' }] }
    ],
    neverDispatch: ['n5'],
    undeclared: [['n8', 'n1', '功能开发直接找遥测巡查员要最新错误日志，没有经过编排者转达']],
    outage: [{ channel: 'ch_obs', at: 0.4, dur: 0.06, kind: 'quota', note: '监控平台查询并发超限，接口被限流' }],
    versionChanges: [{ at: 0.3, note: '把"最近一次发布记录"加入现场取证组的标准工作包', by: 'human' }]
  },
  decisions: {
    n0: [
      { title: '是否立即拉起全量作战室', trigger: '监控告警触发支付错误率超过阈值',
        alternatives: ['先观察几分钟看是否自动恢复', '直接拉起作战室并行排查', '只通知值班群，不启动正式流程'],
        choice: '直接拉起作战室并行排查',
        reason: '错误率短时间内明显升高，等待观察会错过处置的黄金时间',
        impact: '取证和专项分析几乎同时开工，定位时间明显缩短',
        action: 'deliver' },
      { title: 'K1 人工关否决后怎么重新分派', trigger: 'K1 第一版修复方案在人工关被否',
        alternatives: ['让专项分析原地修正结论', '取证和分析全部重新来一遍', '只让专项分析重做，取证结果复用'],
        choice: '只让专项分析重做，取证结果复用',
        reason: '取证阶段的原始数据没有问题，问题出在分析结论和回滚方案上',
        impact: '重做只多花了一轮分析的时间，没有重新取证',
        action: 'request' },
      { title: 'K3 期间是否转达值班负责人的新指令', trigger: '值班负责人在人工关结果出来前提出先扩容连接池',
        alternatives: ['坚持原计划，等人工关结果', '立即把新指令转给功能开发', '先确认扩容是否会影响正在收集的证据'],
        choice: '确认扩容不影响证据后，把新指令转给功能开发',
        reason: '扩容是止血手段，和后续是否回滚的判断互不影响',
        impact: '功能开发提前开始扩容，人工关继续评估是否还需要回滚',
        action: 'deliver' }
    ],
    n1: [
      { title: '从哪个指标切入定位异常', trigger: '编排者派发取证任务',
        alternatives: ['先看支付网关的错误率曲线', '先看数据库连接池指标', '先看全链路追踪'],
        choice: '先看支付网关的错误率曲线',
        reason: '错误率曲线最先触发告警，是最直接的切入点',
        impact: '很快圈定了异常开始的时间窗口',
        action: 'deliver' },
      { title: '没拿到最近发布记录时怎么办', trigger: 'K1 中申请了最近一次发布记录但没有收到',
        alternatives: ['停下来等发布记录送到', '靠时间线肉眼比对告警和已知的上线窗口', '跳过发布比对，只看指标'],
        choice: '靠时间线肉眼比对告警和已知的上线窗口',
        reason: '完全跳过发布比对容易漏掉最可能的原因',
        impact: '比对多花了时间，定位比预期慢了一截',
        action: 'request' },
      { title: '监控查询被限流时怎么办', trigger: 'ch_obs 查询并发超限，请求被拒',
        alternatives: ['换成日志平台直接翻日志', '等限流解除再查', '降低查询频率重试'],
        choice: '降低查询频率重试',
        reason: '日志平台的数据不如监控面板直观，换渠道反而更慢',
        impact: '查询恢复后很快补上了缺的那段数据',
        action: 'tool' }
    ],
    n6: [
      { title: 'K1 第一版结论是否站得住', trigger: '专项分析提交 K1 的第一版结论',
        alternatives: ['直接认可，转给人工关', '要求补充证据再认可', '直接否决打回分析'],
        choice: '要求补充证据再认可',
        reason: '结论只看了错误率，没有对照最近一次发布的时间点',
        impact: '分析补上发布时间对照后结论更扎实，但流程多走了一轮',
        action: 'request' },
      { title: 'K1 第二版结论是否通过', trigger: '专项分析补上发布时间对照后重新提交',
        alternatives: ['通过，转人工关', '继续要求更多证据', '直接否决'],
        choice: '通过，转人工关',
        reason: '错误率曲线和发布时间精确吻合，复现路径也说得通',
        impact: '进入人工关评估是否回滚',
        action: 'deliver' },
      { title: 'K3 连接池耗尽的结论是否可信', trigger: '专项分析提交连接池耗尽的分析结论',
        alternatives: ['通过，转人工关', '打回去看是否有其他并发原因', '搁置等更多数据'],
        choice: '通过，转人工关',
        reason: '连接池耗尽的时间点和慢查询激增完全对应',
        impact: '进入人工关，等待是否回滚的决定',
        action: 'deliver' }
    ],
    n7: [
      { title: 'K1 第一版方案怎么呈报', trigger: '唱反调者认可 K1 第一版结论',
        alternatives: ['直接呈报回滚', '呈报回滚并说明风险', '建议先灰度验证再回滚'],
        choice: '呈报回滚并说明风险',
        reason: '回滚会影响到当时还在排队的订单，需要让人知道代价',
        impact: '人工关看到风险后否决了这版方案，要求重新分析',
        action: 'escalate' },
      { title: 'K1 第二版方案怎么呈报', trigger: '唱反调者认可补充证据后的第二版结论',
        alternatives: ['直接呈报整体回滚', '呈报定向限流而不是整体回滚', '继续等更多数据'],
        choice: '呈报定向限流而不是整体回滚',
        reason: '证据显示问题只出在一个下游依赖，不需要整体回滚',
        impact: '人工关批准了定向限流方案',
        action: 'escalate' },
      { title: 'K3 怎么呈报连接池耗尽', trigger: '唱反调者认可连接池耗尽的结论',
        alternatives: ['只呈报立即回滚上一版发布', '只呈报先扩容连接池观察', '两个方案一起呈报，让人选'],
        choice: '两个方案一起呈报，让人选',
        reason: '扩容和回滚各有代价，应该让值班负责人自己权衡',
        impact: '人工关还在评估，值班负责人先下了扩容的临时指令',
        action: 'escalate' }
    ],
    n8: [
      { title: 'K1 批准的限流方案怎么落地', trigger: '人工关批准了定向限流方案',
        alternatives: ['对整个支付网关限流', '只对出问题的下游依赖限流', '先下线该下游依赖的调用'],
        choice: '只对出问题的下游依赖限流',
        reason: '范围越小，对正常订单的影响越小',
        impact: '错误率回落，正常支付没有受到明显影响',
        action: 'deliver' },
      { title: 'K2 回调失败怎么修', trigger: '分析确认是某地区网关证书过期',
        alternatives: ['更新证书并重启该地区网关', '临时切到备用网关', '通知该地区暂停支付'],
        choice: '更新证书并重启该地区网关',
        reason: '证书问题修复后不会反复发生，备用网关只是临时方案',
        impact: '一次处理完，没有再复发',
        action: 'deliver' },
      { title: 'K3 收到临时指令后先做什么', trigger: '值班负责人要求先扩容连接池，暂不回滚',
        alternatives: ['立即执行扩容', '先问清楚扩容到多大再动手', '坚持等人工关的最终结论再动手'],
        choice: '先问清楚扩容到多大，再执行',
        reason: '扩容太小解决不了问题，太大会占用其他服务的资源',
        impact: '扩容后错误率明显下降，人工关仍在评估是否需要回滚上一版发布',
        action: 'request' }
    ]
  }
};
