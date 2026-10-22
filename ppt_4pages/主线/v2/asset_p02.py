# -*- coding: utf-8 -*-
"""Page 02 right-side visual panel (700 x 400 @ 3x = 2100 x 1200 px).
Strictly grounded in channels/README.md and channels/probe/CAPABILITY_MAP.md (2026-10-18).
"""
from asset_p01 import COMMON_CSS


def html_p02() -> str:
    hosts = [
        ("Claude Code", "CC", "#D97706", "CLI/ACP", "实测64%"),
        ("Codex", "CX", "#0284C7", "app-server", "实测61%"),
        ("Antigravity", "AG", "#7C3AED", "RPC 332口", "实测55%"),
        ("ZCode", "ZC", "#9333EA", "ACP+补丁", "29%→43%"),
        ("WorkBuddy", "WB", "#059669", "本地套餐", "28%→41%"),
        ("OpenCode", "OC", "#2563EB", "serve+ACP", "33%→37%"),
        ("Hermes", "HM", "#0D9488", "内联+state库", "30%→36%"),
        ("Gemini/Droid", "GD", "#4F46E5", "ACP+旁路", "只读全通"),
        ("豆包桌面端", "DB", "#E11D48", "CDP 9225", "投递回读"),
        ("OpenCLI网页", "WEB", "#B45309", "CDP登录态", "160+站点"),
        ("cc-switch", "KEY", "#073E87", "单次换源", "30+供应商"),
        ("Search Hub", "SRC", "#0F172A", "自动轮换", "22把Key"),
    ]
    cards_html = "".join(
        f'''<div class="h-card">
          <div class="h-top">
            <span class="h-ico" style="background:{color};">{abbr}</span>
            <span class="h-name">{name}</span>
          </div>
          <div class="h-meta">
            <span class="h-proto">{proto}</span>
            <span class="h-cnt">{cnt}</span>
          </div>
        </div>'''
        for name, abbr, color, proto, cnt in hosts
    )

    rows = [
        (
            "1. 一轮之内",
            "10 项单元 · 70 格",
            "各产品当宿主",
            "<b>外部单口残缺</b>：桌面端有按钮，但 CLI 不支持轮内插话，ACP 桥无插话，AGY 无公开 ACP 桥",
            "<b>多路择优 + 四级降级补齐</b>：直连 <code>codex app-server</code> / <code>AGY Connect-RPC</code> 拿真插话；其余自动降级「排下一轮 ＞ MCP工具捎带 ＞ 收件箱」（<b>已证39格，已接33格</b>）",
        ),
        (
            "2. 一个会话",
            "34 项单元 · 238 格",
            "各产品 / 我们",
            "<b>锁死内部会话</b>：人开的会话带单写者锁（Codex 锁7分钟），ACP 桥无分叉与压缩，ZCode CLI 不认模型参数",
            "<b>跨入口接管 + 冷分叉反超单口</b>：统一 <code>&lt;产品&gt;:&lt;原生ID&gt;</code> 接管人开的会话；无 BOM 复制 JSONL 补齐冷分叉；<b>ZCode(29%→43%)、WB(28%→41%) 后端反超原生单口（已接111格）</b>",
        ),
        (
            "3. 两个会话间",
            "12 项单元 · 84 格",
            "跨家全归我们",
            "<b>仅限同产品内部子智能体（仅 12/84 格）</b>：跨产品派活、阶段送达回执、外部唤醒保管、所有权保护均为 <b>0</b>",
            "<b>中心当中间人宿主（从 12 格跃升至 58 格）</b>：统一保管等待、送达回执、五类唤醒（定时/消息/后台/卡住/重启）与<b>五态所有权锁</b>（人正打字时暂存不硬闯）",
        ),
        (
            "4. 一群会话",
            "5 项单元 · 35 格",
            "100% 归我们",
            "<b>跨产品能力接近 0（仅 8/35 格局部）</b>：各产品只看得到自己窗口，无跨家任务板、无循环熔断、无全局轨迹",
            "<b>中心独占提供</b>：跨 9 家本地库<b>全文检索</b>、共享任务板、循环熔断，以及手机网页 <code>/m/</code> 独有的<b>跨产品待处理流</b>（审批与提问置顶）与协作图谱",
        ),
        (
            "5. 渠道与交互",
            "15 渠道 + 50 交互",
            "渠道归我们供给",
            "<b>改供应商污染全局配置</b>：切换即影响整机所有会话；网页登录态与 CLI 割裂；仅桌面端有完整交互（32–43项）",
            "<b>单次调用换渠道 + 网页复刻桌面体验</b>：Claude <code>--settings</code> / Codex <code>modelProvider</code> 按次换源不动全局；手机页已覆盖桌面端 <b>53%–71%</b> 交互单元（<b>总计已接 231 格</b>）",
        ),
    ]
    rows_html = ""
    for scale, sub, host_who, native_txt, our_txt in rows:
        rows_html += f"""
        <tr>
          <td class="c-scale">
            <div class="sc-main">{scale}</div>
            <div class="sc-sub">{sub}</div>
            <span class="sc-who">{host_who}</span>
          </td>
          <td class="c-native">{native_txt}</td>
          <td class="c-ours">{our_txt}</td>
        </tr>"""

    return f"""<!DOCTYPE html><html><head><meta charset="utf-8"><style>
{COMMON_CSS}
.wrap {{ width: 700px; height: 400px; display: flex; flex-direction: column; gap: 5px; }}
.sec1 {{
  background: #FFFFFF; border: 1.5px solid #073E87; border-radius: 6px; padding: 4px 7px;
}}
.s-hdr {{
  display: flex; justify-content: space-between; align-items: center; margin-bottom: 3px;
}}
.s-title {{ font-size: 11px; font-weight: 800; color: #073E87; white-space: nowrap; }}
.h-grid {{
  display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 3.5px;
}}
.h-card {{
  background: #F8FAFC; border: 1px solid #CBD5E1; border-radius: 4px; padding: 2.5px 4px;
  display: flex; flex-direction: column; gap: 1.5px; min-width: 0; overflow: hidden;
}}
.h-top {{ display: flex; align-items: center; gap: 3px; min-width: 0; }}
.h-ico {{
  width: 15px; height: 15px; border-radius: 3px; color: #FFF; font-size: 7.5px;
  font-weight: 800; display: inline-flex; align-items: center; justify-content: center;
  flex-shrink: 0; font-family: 'Consolas', monospace;
}}
.h-name {{ font-size: 9px; font-weight: 700; color: #1F2937; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }}
.h-meta {{ display: flex; justify-content: space-between; align-items: center; font-size: 7.8px; white-space: nowrap; }}
.h-proto {{ color: #4B5563; font-weight: 600; }}
.h-cnt {{ color: #073E87; font-weight: 700; background: #E0E7FF; padding: 0.5px 2.5px; border-radius: 2px; }}

.sec2 {{
  flex: 1; background: #FFFFFF; border: 1.5px solid #073E87;
  border-radius: 6px; overflow: hidden; display: flex; flex-direction: column;
}}
.tbl-hdr {{
  background: #073E87; color: #FFFFFF; padding: 3.5px 8px;
  display: flex; justify-content: space-between; align-items: center;
  font-size: 10.6px; font-weight: 700; white-space: nowrap;
}}
table.cmp {{ width: 100%; border-collapse: collapse; flex: 1; }}
table.cmp th {{
  font-size: 9.6px; font-weight: 800; padding: 3px 6px; border-bottom: 1.5px solid #CBD5E1; text-align: left;
}}
table.cmp th.th-scale {{ width: 102px; background: #F1F5F9; color: #073E87; }}
table.cmp th.th-nat {{ width: 240px; background: #FEF2F2; color: #9D0A12; border-left: 1px solid #E5E7EB; }}
table.cmp th.th-our {{ background: #EFF6FF; color: #073E87; border-left: 1px solid #CBD5E1; }}
table.cmp td {{
  padding: 2.5px 6px; border-bottom: 1px solid #E5E7EB; vertical-align: middle;
  font-size: 9.1px; line-height: 1.22;
}}
table.cmp tr:last-child td {{ border-bottom: none; }}
td.c-scale {{ background: #F8FAFC; white-space: nowrap; }}
.sc-main {{ font-size: 9.6px; font-weight: 800; color: #073E87; }}
.sc-sub {{ font-size: 8.2px; color: #6B7280; margin: 0.5px 0; }}
.sc-who {{
  display: inline-block; font-size: 7.8px; font-weight: 700; padding: 0.5px 3.5px;
  border-radius: 2px; background: #E0E7FF; color: #1E40AF;
}}
td.c-native {{ background: #FFFBFB; color: #4B5563; border-left: 1px solid #F1F5F9; }}
td.c-native b {{ color: #9D0A12; }}
td.c-ours {{ background: #F4F8FF; color: #1F2937; border-left: 1px solid #CBD5E1; }}
td.c-ours b {{ color: #073E87; }}
td.c-ours code {{
  font-family: 'Consolas', monospace; font-size: 8.4px; background: #E0E7FF;
  color: #073E87; padding: 0 2.5px; border-radius: 2px;
}}
</style></head><body>
<div class="wrap">
  <div class="sec1">
    <div class="s-hdr">
      <span class="s-title">全生态产品与适配路线铺开（九类原生入口 × 多路择优驱动 × 能力渠道池）</span>
      <span class="tag tag-blue">76 核心单元(100%推上限) + 50 交互单元</span>
    </div>
    <div class="h-grid">{cards_html}</div>
  </div>
  <div class="sec2">
    <div class="tbl-hdr">
      <span>五级尺度实测对账：哪些是各家产品自己能做到的 vs 哪些是我们「多路适配器 + 中心当宿主」做到的</span>
      <span style="font-size:9px;font-weight:400;opacity:0.92;">源自 CAPABILITY_MAP.md 实测账本</span>
    </div>
    <table class="cmp">
      <thead>
        <tr>
          <th class="th-scale">五个尺度 (126单元)</th>
          <th class="th-nat">❌ 各家产品原生单口能做到的（局限与边界）</th>
          <th class="th-our">✅ 我们「多路适配器 + 中心当宿主」做到的（接通与跨级补齐）</th>
        </tr>
      </thead>
      <tbody>{rows_html}</tbody>
    </table>
  </div>
</div>
</body></html>"""
