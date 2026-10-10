/* HUB.obsGuide: "what is this and how do I read it" — a modal in the page's own .mo style, with the legend. */
(function () {
  'use strict';
  var HUB = (window.HUB = window.HUB || {});
  var esc = HUB.util.esc;
  var el = null;

  var TERMS = [
    ['关注面', '想了解哪一方面：任务、信息、个体、能力渠道、时间、人。表现为线的开关、叠加层和面板分区'],
    ['主体', '图上的卡片是什么：组织（个体和部门）、流程（阶段和判断点）、执行（一次运行里的决策和调用）'],
    ['粒度', '展开到哪一层。组织：部门 / 小组 / 个体；流程：阶段 / 步骤；执行：决策 / 调用'],
    ['聚焦', '只点亮一个案例实例或一次运行，其余变淡'],
    ['时间', '看到哪一刻为止的事实；拖动底部时间轴，或按回放'],
    ['对照方式', '只看编排里的定义、只看实际发生的事实，或两者对照'],
    ['观察状态', '以上几项加上选中的对象，合起来就是“现在在看什么”；地址栏的链接能还原它'],
    ['视图', '观察状态的预设。六个常用视图是六组现成的设置，不是六个页面'],
    ['案例实例', '模拟出来的一次完整协作：一个需求和由它引出的整棵任务树，编号 K1、K2…']
  ];
  var VIEWS = [
    ['① 完整协作图', '所有个体和它们之间的线', '组织 · 个体粒度'],
    ['② 部门架构图', '组织和分工；部门合成一张卡，线合并并标次数', '组织 · 部门粒度'],
    ['③ 单案例路由图', '一次协作实际怎么走：点亮经过的个体和交接，其余变淡；可以回放', '组织 · 聚焦一个案例'],
    ['④ 业务流程图', '系统按什么规则运转：阶段、判断点、打回和上报', '流程 · 可聚焦同一个案例'],
    ['决策链 / 执行链', '某个个体一次运行做了哪些决定、背后调用了什么。不在顶栏：双击个体打开，或单击后在右栏点它的运行，或在左栏“会话”页点本机的真实会话；右上角“决策 / 调用”切换粗细', '从个体下钻 · Esc 返回']
  ];
  var ACTIONS = [
    ['对话', '直接跟一个个体说话'], ['插话', '往它的下一次运行里塞一条新指令'], ['催办 / 改派', '通过中枢智能体推动或转交任务'],
    ['补送', '把“该知道却没送到”的资料重新送一次'], ['交给中枢改规则', '提出编排的修改，生成新的编排版本'],
    ['暂停 / 恢复渠道、指派维护', '处理模型和工具渠道的故障'], ['放行', '人在人工判断点上拍板']
  ];
  var KEYS = [['1 ～ 4', '切换四个常用视图'], ['Alt + ← / →', '返回、前进观察状态'], ['[ / ]', '粒度收起一层 / 展开一层'], ['G', '图和面板之间切换'],
    ['F', '适应窗口'], ['空格', '回放'], ['Esc', '取消选中，再按取消聚焦'], ['?', '打开本说明']];

  function table(rows, cls) {
    return '<table class="ob-gtable ' + (cls || '') + '">' + rows.map(function (r) { return '<tr>' + r.map(function (c, i) { return '<td' + (i === 0 ? ' class="k"' : '') + '>' + esc(c) + '</td>'; }).join('') + '</tr>'; }).join('') + '</table>';
  }
  function legend() {
    var line = function (cls, dash, label) {
      return '<div class="ob-lg"><svg width="46" height="12"><path d="M2 6 H44" class="ob-lgp ' + cls + '" ' + (dash ? 'stroke-dasharray="5 5"' : '') + '/></svg><span>' + esc(label) + '</span></div>';
    };
    return '<div class="ob-lgrid">' +
      line('t-task', false, '任务线：派活、交付、汇报') + line('t-info', false, '信息线：谁读谁的产出') + line('t-watch', false, '监督线：谁盯着谁') + line('t-channel', false, '渠道线：用哪个模型和工具') +
      line('t-task', false, '实线：编排里有，也发生过（越粗次数越多）') + line('t-task', true, '虚线：编排里有，但从没发生') + line('t-factonly', false, '橙色：发生了，编排里却没有（未声明）') + line('t-hl', false, '金色：聚焦的案例实际走过的路') +
      '</div><p class="ob-gnote">卡片：转圈的是此刻正在干活的；红框是最近一次运行失败；黄框是有案例等它判断；虚线淡卡是从没被派过活的。右上角小标签：“缺”是该送到的资料没送到，“令”是收到的新指令。线上流动的光点表示这条线真的运送过任务。</p>';
  }

  function build() {
    var html = '<div class="mo-box" style="max-width:820px">' +
      '<div class="mo-h"><h2 id="moObs-title">协作观察：这是什么，怎么看</h2><button class="btn btn-d" type="button" data-close aria-label="关闭">&#10005;</button></div>' +
      '<div class="mo-b ob-guide">' +
      '<h3>这是什么</h3><p>这是一台文字编排的调试器：把编排文档里写的分工、流程和渠道，和运行后真实发生的任务、交接、调用放在一起对照，看清信息有没有真正送到每个智能体手里；发现不一致，能直接从右栏把指令、补送和规则修改发回去。案例取自本页的 62 个团队预设，事实按同一套规则模拟生成，不是真实运行记录。</p>' +
      '<h3>图例</h3>' + legend() +
      '<h3>四种常用视图和一种下钻</h3>' + table(VIEWS, 'views') +
      '<h3>切换为什么顺</h3><p>每次切换只改观察状态的一两项，卡片按编号原地移动：①②之间只改粒度；③在此基础上加一个聚焦的案例；③④之间只换主体，聚焦不变；双击一个个体进入⑤，画布上盖一层它这次运行的决策链，右栏显示选中项的细节；⑤⑥之间只改粒度，就是把树折到决策，或展开到每一步。一个决策是一组调用的上级，就像一个部门是一组个体的上级，折叠和展开在三处是同一个道理。</p>' +
      '<h3>术语</h3>' + table(TERMS) +
      '<h3>能做的操作（右栏）</h3>' + table(ACTIONS) + '<p class="ob-gnote">每个操作都会记成一条事实，分析重新算一遍，图上、时间轴上和体检里马上能看到。</p>' +
      '<h3>键盘</h3>' + table(KEYS) +
      '</div><div class="mo-f"><button class="btn" type="button" data-design>切到原来的设计器</button><button class="btn btn-p" type="button" data-close>开始看</button></div></div>';
    var mo = document.createElement('div');
    mo.className = 'mo';
    mo.id = 'moObs';
    mo.setAttribute('role', 'dialog');
    mo.setAttribute('aria-modal', 'true');
    mo.setAttribute('aria-labelledby', 'moObs-title');
    mo.innerHTML = html;
    mo.addEventListener('click', function (e) {
      if (e.target === mo || e.target.closest('[data-close]')) close();
      if (e.target.closest('[data-design]')) { close(); HUB.obs.setMode(false); }
    });
    document.body.appendChild(mo);
    return mo;
  }
  function open() { if (!el) el = build(); el.classList.add('show'); }
  function close() { if (el) el.classList.remove('show'); }

  HUB.obsGuide = { open: open, close: close };
})();
