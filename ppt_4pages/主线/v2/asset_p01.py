# -*- coding: utf-8 -*-
"""Page 01 right-side visual panel (700 x 400 @ 3x = 2100 x 1200 px)."""

COMMON_CSS = """
* { box-sizing: border-box; margin: 0; padding: 0; }
body {
  font-family: 'Microsoft YaHei UI', 'Microsoft YaHei', 'PingFang SC', sans-serif;
  background: transparent;
  color: #1F2937;
  -webkit-font-smoothing: antialiased;
}
.tag {
  display: inline-block;
  padding: 1.5px 7px;
  border-radius: 3px;
  font-size: 10px;
  font-weight: 700;
  white-space: nowrap;
  flex-shrink: 0;
}
.tag-red { background: rgba(157,10,18,0.10); color: #9D0A12; border: 1px solid rgba(157,10,18,0.28); }
.tag-blue { background: rgba(7,62,135,0.10); color: #073E87; border: 1px solid rgba(7,62,135,0.28); }
.tag-gold { background: rgba(201,162,39,0.16); color: #7C5800; border: 1px solid rgba(201,162,39,0.45); }
.tag-green { background: rgba(5,150,105,0.12); color: #047857; border: 1px solid rgba(5,150,105,0.32); }
.mono { font-family: 'Consolas', 'JetBrains Mono', monospace; white-space: nowrap; }
"""


def html_p01() -> str:
    return f"""<!DOCTYPE html><html><head><meta charset="utf-8"><style>
{COMMON_CSS}
.wrap {{
  width: 700px; height: 400px;
  display: flex; flex-direction: column; gap: 7px;
}}
.top-row {{
  display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 8px; height: 148px;
}}
.box {{
  background: #FFFFFF; border: 1.5px solid #D1D9E6; border-radius: 6px;
  padding: 5px 8px; display: flex; flex-direction: column; justify-content: space-between; min-width: 0; overflow: hidden;
}}
.box-bad {{ border-top: 3.5px solid #9D0A12; background: #FFFDFD; }}
.box-good {{ border-top: 3.5px solid #073E87; background: #F8FAFF; }}
.b-hdr {{ display: flex; justify-content: space-between; align-items: center; gap: 4px; }}
.b-title {{ font-size: 11px; font-weight: 800; color: #1F2937; white-space: nowrap; }}
.pros-cons {{ display: flex; flex-direction: column; gap: 3px; margin: 2px 0; }}
.pc-row {{
  border-radius: 3px; padding: 3px 6px; font-size: 9.4px; line-height: 1.24;
}}
.pc-pro {{ background: #ECFDF5; border: 1px solid #A7F3D0; color: #065F46; }}
.pc-con {{ background: #FEF2F2; border: 1px solid #FECACA; color: #991B1B; }}
.bad-foot {{
  background: rgba(157,10,18,0.08); border-radius: 4px; padding: 3.5px 6px;
  font-size: 9.2px; color: #9D0A12; font-weight: 700; line-height: 1.22; white-space: nowrap;
}}
.route-list {{ display: flex; flex-direction: column; gap: 2.5px; margin: 2px 0; }}
.route-item {{
  background: #FFFFFF; border: 1px solid #BFD3F2; border-left: 3px solid #073E87;
  border-radius: 3px; padding: 2.5px 6px; display: flex; justify-content: space-between; align-items: center;
  font-size: 9.5px; white-space: nowrap;
}}
.route-item b {{ color: #073E87; }}
.good-foot {{
  background: rgba(7,62,135,0.08); border-radius: 4px; padding: 3.5px 6px;
  font-size: 9.2px; color: #073E87; font-weight: 700; line-height: 1.22; white-space: nowrap;
}}
.tbl-wrap {{
  flex: 1; background: #FFFFFF; border: 1.5px solid #073E87; border-radius: 6px;
  overflow: hidden; display: flex; flex-direction: column;
}}
.tbl-hdr {{
  background: #073E87; color: #FFFFFF; padding: 3.5px 9px;
  display: flex; justify-content: space-between; align-items: center;
  font-size: 10.8px; font-weight: 700;
}}
table {{ width: 100%; border-collapse: collapse; flex: 1; }}
th {{
  background: #EEF3FA; color: #073E87; font-size: 9.8px; font-weight: 800;
  text-align: left; padding: 3px 7px; border-bottom: 1.5px solid #CBD5E1;
}}
td {{
  padding: 2.5px 7px; font-size: 9.3px; border-bottom: 1px solid #E5E7EB;
  vertical-align: middle; line-height: 1.22;
}}
tr:last-child td {{ border-bottom: none; }}
.dim-col {{ width: 82px; font-weight: 800; color: #073E87; background: #F8FAFC; white-space: nowrap; }}
.bad-col {{ width: 286px; color: #4B5563; background: #FFFBFB; border-left: 1px solid #E5E7EB; }}
.bad-col b {{ color: #9D0A12; }}
.good-col {{ color: #1F2937; background: #F4F8FF; border-left: 1px solid #CBD5E1; }}
.good-col b {{ color: #073E87; }}
.good-col code {{
  font-family: 'Consolas', monospace; font-size: 8.6px; background: #E0E7FF;
  color: #073E87; padding: 0 3px; border-radius: 2px;
}}
</style></head><body>
<div class="wrap">
  <div class="top-row">
    <div class="box box-bad">
      <div class="b-hdr">
        <span class="b-title">⚖ 各家成品生态：红利诱人但封闭难拓展</span>
        <span class="tag tag-red">封闭 vs 反代</span>
      </div>
      <div class="pros-cons">
        <div class="pc-row pc-pro"><b>✔ 为什么借力各家产品</b>：有<b>活动补贴/包月便宜</b>，且自带<b>闭源功能、完整生态与独家优化</b>（补丁/沙箱/缓存）</div>
        <div class="pc-row pc-con"><b>✘ 各家产品最大痛点</b>：<b>高度封闭、可拓展性差</b>（锁死单窗口，跨家无法协同）</div>
      </div>
      <div class="bad-foot">
        ⚠ 拆凭证逆向反代裸 API：违反条款封号，且废掉各家闭源功能与独家优化
      </div>
    </div>
    <div class="box box-good">
      <div class="b-hdr">
        <span class="b-title">✅ 本系统：协议 + CDP + 适配器三路破局</span>
        <span class="tag tag-blue">吃尽红利+高拓展</span>
      </div>
      <div class="route-list">
        <div class="route-item"><span><b>① 官方协议</b>：ACP / App-Server / SDK</span><span class="mono" style="color:#047857;font-weight:700;">保住独家优化</span></div>
        <div class="route-item"><span><b>② 桌面/网页 CDP</b>：DOM 注入 + 登录复用</span><span class="mono" style="color:#047857;font-weight:700;">享尽套餐优惠</span></div>
        <div class="route-item"><span><b>③ 自研适配器</b>：本地库直读 + 中心当宿主</span><span class="mono" style="color:#047857;font-weight:700;">跨家自由拓展</span></div>
      </div>
      <div class="good-foot">
        ✔ 零反代接通 10 大产品与 160+ 网页：兼得低价闭源优势与跨生态拓展性
      </div>
    </div>
  </div>

  <div class="tbl-wrap">
    <div class="tbl-hdr">
      <span>底层代码框架（什么都要手写）与闭源单品（封闭难拓展） vs 本系统核心设计对位</span>
      <span style="font-size:9.5px;font-weight:400;opacity:0.92;">直击开发成本、双颗粒度 Trace、生态拓展、漂移与恢复</span>
    </div>
    <table>
      <thead>
        <tr>
          <th>核心维度</th>
          <th>传统底层代码框架（LangGraph/AutoGen）与闭源单品局限</th>
          <th>本系统（复用成品闭源生态 + MD 渐进编排 + 双颗粒度 Trace）</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td class="dim-col">1. 开发与编排</td>
          <td class="bad-col"><b>底层框架什么都要自己写 + DAG 写死</b>：只给空架子调裸 API，补丁/沙箱/记忆全靠手写；改角色或流程需重写 Python 代码</td>
          <td class="good-col"><b>直接白拿 10 大成品宿主工具链 + MD 渐进编排</b>：免造底层轮子；用 <code>CLAUDE.md / TASK.md</code> 自然语言随时重构角色与拓扑</td>
        </tr>
        <tr>
          <td class="dim-col">2. 决策链还原</td>
          <td class="bad-col"><b>单层调用流水账 + 埋点全靠手写</b>：通用 Trace 仅记细粒度 API 进出文本，满屏步骤却看不出「当时为什么这么选」</td>
          <td class="good-col"><b>首创「双颗粒度 Trace」</b>：<b>粗粒度决策段</b>（触发/备选/选择/理由）经 <code>turn+steps</code> 叠在 <b>9 家细粒度轮/步证据</b>之上，一键下钻</td>
        </tr>
        <tr>
          <td class="dim-col">3. 生态与拓展</td>
          <td class="bad-col"><b>各家产品封闭、可拓展性差</b>：虽有<b>活动低价、闭源功能与独家优化</b>，但锁死单窗口，无法跨产品编排与横向对账</td>
          <td class="good-col"><b>中心当宿主破除封闭 + 126 项实测账本</b>：小尺度吃尽各家闭源独家优化，大尺度由中心跨家调度，按优惠额度与强项路由</td>
        </tr>
        <tr>
          <td class="dim-col">4. 漂移监控</td>
          <td class="bad-col"><b>长程盲盒运行</b>：多轮群聊上下文滚雪球偏离初衷（Goal Drift），缺乏「写的契约 vs 实际轨迹」实时对账</td>
          <td class="good-col"><b>四件套指针交接 + 三态轨迹对照</b>：交接传路径指针不传长文；画布实线/虚线/橙色实时对账，手机端中途插话纠偏</td>
        </tr>
        <tr>
          <td class="dim-col">5. 出错恢复</td>
          <td class="bad-col"><b>单向批处理易崩</b>：遇权限弹窗或死锁即断，重跑丢失现场且浪费 Token</td>
          <td class="good-col"><b>常驻进程全双工操控 + 跨级补齐</b>：手机远程批权限、答提问、无损打断、冷分叉（无 BOM 复制 JSONL 换 ID 原位续跑）</td>
        </tr>
      </tbody>
    </table>
  </div>
</div>
</body></html>"""
