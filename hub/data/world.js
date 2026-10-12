/* The built-in world the sample teams are placed in: the stages a team works through, the models and how much of them can be
   used at once, the outside capabilities some agents are given. hub/js/sources/casedef.js turns a team and this world into a definition. */
window.HUB = window.HUB || {};
HUB.world = {
  phases: ['strategy', 'research', 'debate1', 'build', 'debate2', 'qa', 'hitl'],
  phaseNames: { strategy: '战略', research: '调研', debate1: '五心智辩论', debate2: '五心智复议', build: '构建', qa: '质检', hitl: '人工把关' },
  stepNames: { strategy: '拆解与规划', research: '并行调研', debate1: '专家辩论', build: '构建实现', debate2: '专家复议', qa: '质量验收', hitl: '整理决策选项' },

  // concurrency limits: how many runs (model channels) or calls (tool channels) may use a channel at the same time
  modelLimit: { opus: 2, sonnet: 4, haiku: 6, fable: 1 },
  modelCapacity: { opus: '并发 2', sonnet: '并发 4', haiku: '并发 6', fable: '并发 1' },
  modelQuota: { opus: '每日 800 万 token', sonnet: '每日 2000 万 token', haiku: '每日 5000 万 token', fable: '每日 300 万 token' },
  modelNames: { opus: 'Opus', sonnet: 'Sonnet', haiku: 'Haiku', fable: 'Fable' },
  toolLimit: { websearch: 4, webfetch: 4 },

  // Function channels: outside capabilities with a session and an owner (a logged-in browser, an account), usually exclusive.
  // They are given to the agents whose work needs them.
  functionChannels: {
    ch_fn_xhs: { name: 'OpenCLI · 小红书', capacity: '独占：一个登录的浏览器会话，不能并发', quota: '每小时约 60 次访问', limit: 1,
      agents: ['res_x', 'res_reddit', 'social_strategist'] },
    ch_fn_boss: { name: 'OpenCLI · BOSS直聘', capacity: '独占：一个登录的浏览器会话，不能并发', quota: '每小时约 40 次访问', limit: 1,
      agents: ['career_document_builder'] }
  },

  // Capabilities an agent brings with it (its host), registered to that individual only; they get no node in the shared layer.
  nativeTools: {
    Agent: { host: 'Claude Code', name: '派生子智能体并行执行', short: '派生子智能体', limit: 10,
      note: '宿主自带：在一次运行里派出多个子智能体同时干活，再把结果收回来' }
  }
};
