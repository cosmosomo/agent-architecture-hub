# -*- coding: utf-8 -*-
"""Page 03 full-width visual panel (1168 x 342 @ 3x = 3504 x 1026 px).
Left: Coarsest 3 core abstractions + 2 connection paths + 4 nested scales (1 -> 2 -> >3 -> Orchestration).
Right: Multi-Agent Orchestration Topologies (5 atomic shapes with SVG diagrams + 3 decision sources & 甲/乙 paths + 4 edge types x 3 alignment states).
"""
from asset_p01 import COMMON_CSS


def html_p03() -> str:
    return f"""<!DOCTYPE html><html><head><meta charset="utf-8"><style>
{COMMON_CSS}
.wrap {{ width: 1168px; height: 342px; display: grid; grid-template-columns: 446px 710px; gap: 12px; }}
.panel {{
  background: #FFFFFF; border: 1.5px solid #073E87; border-radius: 6px;
  padding: 5px 8px; display: flex; flex-direction: column; justify-content: space-between;
}}
.p-hdr {{
  display: flex; justify-content: space-between; align-items: center;
  border-bottom: 1.5px solid #E5E7EB; padding-bottom: 3px;
}}
.p-title {{ font-size: 11.5px; font-weight: 800; color: #073E87; white-space: nowrap; }}

.act-bar {{
  border-radius: 4px; padding: 3px 7px; font-size: 9.3px; line-height: 1.22;
  display: flex; justify-content: space-between; align-items: center; gap: 4px; white-space: nowrap;
}}
.act-write {{ background: #F5F3FF; border: 1px solid #C4B5FD; color: #4C1D95; }}
.act-watch {{ background: #FEF2F2; border: 1px solid #FCA5A5; color: #7F1D1D; }}

.tri-box {{
  display: grid; grid-template-columns: 102px 1fr 106px; gap: 5px; align-items: stretch;
}}
.obj-side {{
  border-radius: 5px; padding: 4px 4px; display: flex; flex-direction: column;
  justify-content: space-between; text-align: center; gap: 2px;
}}
.obj-chan {{ background: #FFFBEB; border: 1.5px solid #F59E0B; color: #92400E; }}
.obj-info {{ background: #F0F9FF; border: 1.5px solid #0284C7; color: #075985; }}
.obj-t {{ font-size: 10.8px; font-weight: 800; }}
.obj-it {{
  font-size: 8.7px; background: rgba(255,255,255,0.9); border-radius: 3px;
  padding: 2px 2px; border: 1px solid rgba(0,0,0,0.08); white-space: nowrap;
}}

.obj-agent {{
  background: #F8FAFC; border: 2px solid #073E87; border-radius: 5px; padding: 4px 6px;
  display: flex; flex-direction: column; justify-content: space-between;
}}
.ag-top {{ text-align: center; font-size: 10.8px; font-weight: 800; color: #073E87; }}
.ports-row {{ display: flex; justify-content: space-between; align-items: center; margin: 1px 0; }}
.port {{ font-size: 8.8px; font-weight: 700; padding: 1px 4px; border-radius: 3px; white-space: nowrap; }}
.port-l {{ background: #FEF3C7; color: #B45309; border: 1px solid #F59E0B; }}
.port-r {{ background: #E0F2FE; color: #0369A1; border: 1px solid #0284C7; }}
.model-core {{
  background: #073E87; color: #FFF; font-size: 9.2px; font-weight: 700;
  padding: 1px 6px; border-radius: 10px; white-space: nowrap;
}}
.loop-grid {{ display: grid; grid-template-columns: repeat(3, 1fr); gap: 2px; margin-top: 1px; }}
.lp-step {{
  background: #FFFFFF; border: 1px solid #CBD5E1; border-radius: 3px;
  padding: 1.5px 2px; font-size: 8.4px; color: #1F2937; text-align: center; font-weight: 600; white-space: nowrap;
}}

.conn-box {{
  background: #F8FAFC; border: 1px solid #CBD5E1; border-left: 3px solid #073E87;
  border-radius: 4px; padding: 3px 6px; font-size: 9px; line-height: 1.28;
}}
.conn-box b {{ color: #073E87; }}

.nest-box {{
  background: #FFFDF9; border: 1px solid #FCD34D; border-left: 3px solid #D97706;
  border-radius: 4px; padding: 3.5px 6px; display: flex; flex-direction: column; gap: 2.5px;
}}
.nest-top {{ display: flex; justify-content: space-between; align-items: center; font-size: 9px; font-weight: 800; color: #92400E; }}
.nest-chain {{ display: grid; grid-template-columns: repeat(4, 1fr); gap: 3px; }}
.nc-item {{
  background: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 3px; padding: 2px 3px;
  text-align: center; font-size: 8.4px; line-height: 1.18;
}}
.nc-item b {{ color: #073E87; display: block; font-size: 8.8px; }}
.nc-hi {{ border-color: #9D0A12; background: #FEF2F2; }}
.nc-hi b {{ color: #9D0A12; }}

/* Right panel: Orchestration Topologies */
.topo-sec-hdr {{
  display: flex; justify-content: space-between; align-items: center;
  font-size: 9.6px; font-weight: 800; color: #1F2937; margin-bottom: 1px;
}}
.shapes-grid {{
  display: grid; grid-template-columns: repeat(5, 1fr); gap: 5px;
}}
.sh-card {{
  background: #F8FAFC; border: 1px solid #CBD5E1; border-top: 2.5px solid #073E87;
  border-radius: 4px; padding: 3.5px 4.5px; display: flex; flex-direction: column;
  justify-content: space-between; gap: 2px;
}}
.sh-card.sh-red {{ border-top-color: #9D0A12; background: #FFFDFD; }}
.sh-card.sh-gold {{ border-top-color: #D97706; background: #FFFDF7; }}
.sh-hdr {{ display: flex; justify-content: space-between; align-items: center; }}
.sh-name {{ font-size: 9.8px; font-weight: 800; color: #073E87; white-space: nowrap; }}
.sh-card.sh-red .sh-name {{ color: #9D0A12; }}
.sh-card.sh-gold .sh-name {{ color: #B45309; }}
.sh-code {{ font-size: 8.2px; font-weight: 700; color: #4B5563; background: #E5E7EB; padding: 0.5px 3.5px; border-radius: 2px; }}
.sh-svg {{
  height: 40px; background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 3px;
  display: flex; align-items: center; justify-content: center;
}}
.sh-desc {{ font-size: 8.4px; color: #374151; line-height: 1.22; }}
.sh-desc b {{ color: #111827; }}

.mech-grid {{
  display: grid; grid-template-columns: 1.05fr 1.15fr 1.05fr; gap: 5px;
}}
.m-card {{
  background: #F8FAFC; border: 1px solid #CBD5E1; border-radius: 4px;
  padding: 3.5px 6px; display: flex; flex-direction: column; justify-content: space-between; gap: 1.5px;
}}
.m-title {{
  font-size: 9.5px; font-weight: 800; color: #073E87; border-bottom: 1px solid #E2E8F0;
  padding-bottom: 1.5px; display: flex; justify-content: space-between; align-items: center;
}}
.m-line {{ font-size: 8.6px; color: #1F2937; line-height: 1.24; }}
.m-line b {{ color: #073E87; }}
.m-line .r {{ color: #9D0A12; font-weight: 700; }}

.align-bar {{
  background: #F8FAFC; border: 1.5px solid #9D0A12; border-radius: 5px;
  padding: 4px 7px; display: flex; flex-direction: column; gap: 3px;
}}
.ab-top {{ display: flex; justify-content: space-between; align-items: center; }}
.ab-title {{ font-size: 9.8px; font-weight: 800; color: #9D0A12; }}
.ab-grid {{ display: grid; grid-template-columns: 1.12fr 1.18fr 1fr; gap: 5px; align-items: stretch; }}
.ab-box {{
  background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 3px;
  padding: 3px 5px; font-size: 8.5px; line-height: 1.24; color: #1F2937;
}}
.ab-box b {{ color: #073E87; }}
.edge-pill {{
  display: inline-block; padding: 0.5px 4px; border-radius: 2px; font-size: 8.2px; font-weight: 700; margin-right: 2px;
}}
</style></head><body>
<div class="wrap">
  <!-- LEFT PANEL -->
  <div class="panel">
    <div class="p-hdr">
      <span class="p-title">最粗一层：三个核心抽象 × 两条通路 × 四级同构嵌套</span>
      <span class="tag tag-blue">外层一步 = 里层一圈</span>
    </div>

    <div class="act-bar act-write">
      <span><b>✍ 写下它（编排）</b>：把角色、拓扑、交接与验收写成 <code>CLAUDE.md / TASK.md / Skill</code></span>
      <span class="mono" style="font-weight:700;">↓ 落入信息池</span>
    </div>

    <div class="tri-box">
      <div class="obj-side obj-chan">
        <div class="obj-t">能力渠道</div>
        <div class="obj-it">内置工具 (读写/Shell)</div>
        <div class="obj-it">外部扩展 (MCP/CDP)</div>
        <div class="obj-it">本地脚本 / CLI 工具</div>
        <div class="obj-it" style="border-color:#D97706;font-weight:700;">其他智能体 (当工具)</div>
      </div>

      <div class="obj-agent">
        <div class="ag-top">智能体 = 模型 + Harness</div>
        <div class="ports-row">
          <span class="port port-l">◀ 工具口</span>
          <span class="model-core">模型推理</span>
          <span class="port port-r">上下文口 ▶</span>
        </div>
        <div class="loop-grid">
          <div class="lp-step">① 构造上下文</div>
          <div class="lp-step">② 模型推理</div>
          <div class="lp-step">③ 调工具渠道</div>
          <div class="lp-step">④ 拿回结果</div>
          <div class="lp-step">⑤ 判断停不停</div>
          <div class="lp-step">⑥ 写回信息池</div>
        </div>
      </div>

      <div class="obj-side obj-info">
        <div class="obj-t">信 息</div>
        <div class="obj-it">契约规则 (MD文档)</div>
        <div class="obj-it">历史与外部资料</div>
        <div class="obj-it" style="border-color:#0284C7;font-weight:700;">交接包 (四件套指针)</div>
        <div class="obj-it" style="border-color:#0284C7;font-weight:700;">共享状态 (JSONL黑板)</div>
      </div>
    </div>

    <div class="conn-box">
      <div><b>多智能体相连的两条唯一通路（不引入第 4 个新概念）：</b></div>
      <div>① <b>靠「信息」相连</b>：A 的产出经「交接包 / 共享黑板」进入 B 的「上下文口」</div>
      <div>② <b>靠「能力渠道」相连</b>：A 通过「工具口」把 B 当成子代理/工具直接调用（问答）</div>
    </div>

    <div class="nest-box">
      <div class="nest-top">
        <span>四级同构嵌套（每步共用：🟣下一个是谁 → 🔵给他什么 → 🟠执行 → 🟢停不停）</span>
      </div>
      <div class="nest-chain">
        <div class="nc-item"><b>① 1 个智能体</b>单轮 6 步微循环<br>调工具或直接答</div>
        <div class="nc-item"><b>② 2 个之间</b>最小单元「问答」<br>送入→等完→取回</div>
        <div class="nc-item nc-hi"><b>③ 超过 3 个</b>5 种基本协作拓扑<br>按规则/智能体选人</div>
        <div class="nc-item nc-hi"><b>④ 编排层</b>写下它 ⇄ 看着它<br>轨迹对照与升级</div>
      </div>
    </div>

    <div class="act-bar act-watch">
      <span><b>👁 看着它（双颗粒度 Trace）</b>：粗粒度决策段(触发/备选/选择/理由) 叠在细粒度轮/步上</span>
      <span class="mono" style="font-weight:700;">↺ 反哺契约</span>
    </div>
  </div>

  <!-- RIGHT PANEL: ORCHESTRATION TOPOLOGY SHOWCASE -->
  <div class="panel" style="border-color:#9D0A12;">
    <div class="p-hdr">
      <span class="p-title" style="color:#9D0A12;">「超过 3 个智能体」与「编排层」拓扑结构全景：五种原子形状 × 决策通路 × 双颗粒度对照</span>
      <span class="tag tag-red">多智能体编排拓扑</span>
    </div>

    <!-- 1. Five Atomic Topology Shapes -->
    <div>
      <div class="topo-sec-hdr">
        <span>1. 五种基本拓扑形状（所有超过 3 个智能体的协作模式，均由这 5 种原子形状自由拼装）</span>
        <span style="font-size:8.6px;color:#6B7280;font-weight:600;">节点 = 智能体会话 ｜ 边 = 问答/交接包</span>
      </div>
      <div class="shapes-grid">
        <!-- Shape 1: Pipeline -->
        <div class="sh-card">
          <div class="sh-hdr"><span class="sh-name">① 接力</span><span class="sh-code">A→B→C</span></div>
          <div class="sh-svg">
            <svg width="118" height="34" viewBox="0 0 118 34">
              <defs><marker id="ar1" markerWidth="5" markerHeight="5" refX="4" refY="2.5" orient="auto"><path d="M0,0 L5,2.5 L0,5 Z" fill="#073E87"/></marker></defs>
              <circle cx="18" cy="17" r="10" fill="#073E87"/><text x="18" y="20" font-size="9" fill="#FFF" text-anchor="middle" font-weight="bold">A</text>
              <line x1="29" y1="17" x2="45" y2="17" stroke="#073E87" stroke-width="1.8" marker-end="url(#ar1)"/>
              <circle cx="59" cy="17" r="10" fill="#0284C7"/><text x="59" y="20" font-size="9" fill="#FFF" text-anchor="middle" font-weight="bold">B</text>
              <line x1="70" y1="17" x2="86" y2="17" stroke="#073E87" stroke-width="1.8" marker-end="url(#ar1)"/>
              <circle cx="100" cy="17" r="10" fill="#047857"/><text x="100" y="20" font-size="9" fill="#FFF" text-anchor="middle" font-weight="bold">C</text>
            </svg>
          </div>
          <div class="sh-desc">A 产出作 B 输入<br><b>拼出</b>：流水线 / 控制权转移</div>
        </div>

        <!-- Shape 2: Fan-out -->
        <div class="sh-card">
          <div class="sh-hdr"><span class="sh-name">② 分发</span><span class="sh-code">A→B₁..ₙ</span></div>
          <div class="sh-svg">
            <svg width="118" height="34" viewBox="0 0 118 34">
              <circle cx="22" cy="17" r="10" fill="#073E87"/><text x="22" y="20" font-size="9" fill="#FFF" text-anchor="middle" font-weight="bold">A</text>
              <line x1="33" y1="13" x2="78" y2="6" stroke="#073E87" stroke-width="1.5" marker-end="url(#ar1)"/>
              <line x1="33" y1="17" x2="78" y2="17" stroke="#073E87" stroke-width="1.5" marker-end="url(#ar1)"/>
              <line x1="33" y1="21" x2="78" y2="28" stroke="#073E87" stroke-width="1.5" marker-end="url(#ar1)"/>
              <circle cx="92" cy="6" r="5.5" fill="#0284C7"/><text x="92" y="9" font-size="7" fill="#FFF" text-anchor="middle">B₁</text>
              <circle cx="92" cy="17" r="5.5" fill="#0284C7"/><text x="92" y="20" font-size="7" fill="#FFF" text-anchor="middle">B₂</text>
              <circle cx="92" cy="28" r="5.5" fill="#0284C7"/><text x="92" y="31" font-size="7" fill="#FFF" text-anchor="middle">B₃</text>
            </svg>
          </div>
          <div class="sh-desc">同一任务派多人并行<br><b>拼出</b>：并行探索 / 多路竞速</div>
        </div>

        <!-- Shape 3: Fan-in -->
        <div class="sh-card">
          <div class="sh-hdr"><span class="sh-name">③ 汇总</span><span class="sh-code">B₁..ₙ→C</span></div>
          <div class="sh-svg">
            <svg width="118" height="34" viewBox="0 0 118 34">
              <circle cx="24" cy="6" r="5.5" fill="#0284C7"/><text x="24" y="9" font-size="7" fill="#FFF" text-anchor="middle">B₁</text>
              <circle cx="24" cy="17" r="5.5" fill="#0284C7"/><text x="24" y="20" font-size="7" fill="#FFF" text-anchor="middle">B₂</text>
              <circle cx="24" cy="28" r="5.5" fill="#0284C7"/><text x="24" y="31" font-size="7" fill="#FFF" text-anchor="middle">B₃</text>
              <line x1="31" y1="6" x2="78" y2="13" stroke="#073E87" stroke-width="1.5" marker-end="url(#ar1)"/>
              <line x1="31" y1="17" x2="78" y2="17" stroke="#073E87" stroke-width="1.5" marker-end="url(#ar1)"/>
              <line x1="31" y1="28" x2="78" y2="21" stroke="#073E87" stroke-width="1.5" marker-end="url(#ar1)"/>
              <circle cx="94" cy="17" r="10" fill="#047857"/><text x="94" y="20" font-size="9" fill="#FFF" text-anchor="middle" font-weight="bold">C</text>
            </svg>
          </div>
          <div class="sh-desc">多路输出合交一人收口<br><b>拼出</b>：主管派活 (分发+汇总)</div>
        </div>

        <!-- Shape 4: Loop / Debate -->
        <div class="sh-card sh-red">
          <div class="sh-hdr"><span class="sh-name">④ 往返</span><span class="sh-code">A ⇄ B</span></div>
          <div class="sh-svg">
            <svg width="118" height="34" viewBox="0 0 118 34">
              <defs><marker id="ar2" markerWidth="5" markerHeight="5" refX="4" refY="2.5" orient="auto"><path d="M0,0 L5,2.5 L0,5 Z" fill="#9D0A12"/></marker></defs>
              <circle cx="28" cy="17" r="10" fill="#073E87"/><text x="28" y="20" font-size="8.5" fill="#FFF" text-anchor="middle" font-weight="bold">实</text>
              <path d="M 40 11 Q 59 2 78 11" fill="none" stroke="#073E87" stroke-width="1.6" marker-end="url(#ar1)"/>
              <path d="M 78 23 Q 59 32 40 23" fill="none" stroke="#9D0A12" stroke-width="1.6" marker-end="url(#ar2)"/>
              <circle cx="90" cy="17" r="10" fill="#9D0A12"/><text x="90" y="20" font-size="8.5" fill="#FFF" text-anchor="middle" font-weight="bold">审</text>
            </svg>
          </div>
          <div class="sh-desc">两人多轮打回与修正<br><b>拼出</b>：实现+评审 / 辩论裁判</div>
        </div>

        <!-- Shape 5: Shared Blackboard / Pool -->
        <div class="sh-card sh-gold">
          <div class="sh-hdr"><span class="sh-name">⑤ 共享</span><span class="sh-code">A,B,C⇄板</span></div>
          <div class="sh-svg">
            <svg width="118" height="34" viewBox="0 0 118 34">
              <rect x="34" y="3" width="50" height="13" rx="2" fill="#FEF3C7" stroke="#D97706" stroke-width="1.3"/>
              <text x="59" y="12" font-size="7.5" fill="#92400E" text-anchor="middle" font-weight="bold">JSONL黑板</text>
              <circle cx="22" cy="27" r="6" fill="#073E87"/><text x="22" y="30" font-size="7" fill="#FFF" text-anchor="middle">A</text>
              <circle cx="59" cy="27" r="6" fill="#0284C7"/><text x="59" y="30" font-size="7" fill="#FFF" text-anchor="middle">B</text>
              <circle cx="96" cy="27" r="6" fill="#047857"/><text x="96" y="30" font-size="7" fill="#FFF" text-anchor="middle">C</text>
              <line x1="28" y1="24" x2="42" y2="16" stroke="#D97706" stroke-width="1.3"/>
              <line x1="59" y1="21" x2="59" y2="16" stroke="#D97706" stroke-width="1.3"/>
              <line x1="90" y1="24" x2="76" y2="16" stroke="#D97706" stroke-width="1.3"/>
            </svg>
          </div>
          <div class="sh-desc">共用黑板/任务池读写<br><b>拼出</b>：自主认领 / 按板选人</div>
        </div>
      </div>
    </div>

    <!-- 2. Decision Sources + Two Paths + Handover 4-Pack -->
    <div class="mech-grid">
      <div class="m-card">
        <div class="m-title"><span>2. 三个决定的 3 种答案来源</span><span class="tag tag-blue" style="font-size:8px;padding:0.5px 4px;">谁拍板</span></div>
        <div class="m-line"><b>① 规则驱动</b>：按预设顺序、条件分支或轮流表走</div>
        <div class="m-line"><b>② 智能体驱动</b>：由主管/当前角色输出决定调谁与停不停</div>
        <div class="m-line"><b>③ 混合+人兜底</b>：正常走规则，遇分歧交智能体或人工裁决</div>
      </div>

      <div class="m-card">
        <div class="m-title"><span>3. 智能体向中心传决定的 2 条路</span><span class="tag tag-gold" style="font-size:8px;padding:0.5px 4px;">怎么传</span></div>
        <div class="m-line"><b>甲路（写在输出末尾）</b>：按约定写 <code>下一位:B / 结束</code>，<b>全宿主通用</b></div>
        <div class="m-line"><b>乙路（轮中调中心 MCP）</b>：直接调 <code>问(B,问题)</code>，中心跑完 B 塞回结果</div>
        <div class="m-line"><span class="r">★ 问答原语</span>：送进去(插话/恢复/新建) → 等结束 → 取输出</div>
      </div>

      <div class="m-card">
        <div class="m-title"><span>4. 交接包四件套（传指针不传长文）</span><span class="tag tag-green" style="font-size:8px;padding:0.5px 4px;">防漂移</span></div>
        <div class="m-line"><b>① 需求文件</b> + <b>② 角色任务书</b> + <b>③ 记忆文件</b> + <b>④ 上游产物</b></div>
        <div class="m-line"><b>8 种标准交接</b>：派发/交付/提问/回答/退回/转交/上报/广播</div>
        <div class="m-line"><b>单写者锁</b>：同一产物同一时刻仅一人持锁改写，杜绝覆盖</div>
      </div>
    </div>

    <!-- 3. Orchestration Layer: 4 Edge Types x 3 Alignment States + Dual-Granularity Trace -->
    <div class="align-bar">
      <div class="ab-top">
        <span class="ab-title">5. 编排层「写下它 ⇄ 看着它」：四类拓扑连线 × 三态轨迹对照 × 双颗粒度 Trace</span>
        <span class="mono" style="font-size:8.5px;color:#7F1D1D;font-weight:700;">粗粒度决策段 (turn+steps) ⇄ 细粒度调用步</span>
      </div>
      <div class="ab-grid">
        <div class="ab-box">
          <div><b>四类拓扑连线（节点=角色/文件/渠道）：</b></div>
          <div style="margin-top:1.5px;">
            <span class="edge-pill" style="background:#DBEAFE;color:#1E40AF;">任务线</span>派发/交付/退回
            <span class="edge-pill" style="background:#E0F2FE;color:#0369A1;">信息线</span>读谁产出
          </div>
          <div style="margin-top:1px;">
            <span class="edge-pill" style="background:#FEE2E2;color:#991B1B;">监督线</span>审查/介入
            <span class="edge-pill" style="background:#FEF3C7;color:#92400E;">渠道线</span>宿主与模型配额
          </div>
        </div>

        <div class="ab-box">
          <div><b>三态轨迹对照（预期契约 vs 真实轨迹）：</b></div>
          <div style="margin-top:1px;"><span style="color:#047857;font-weight:800;">━━ 实线（已兑现）</span>：契约写了，实际也按约发生</div>
          <div><span style="color:#6B7280;font-weight:800;">┈┈ 虚线（未发生）</span>：契约写了，但本轮跳过未触发</div>
          <div><span style="color:#D97706;font-weight:800;">━━ 橙色（越权偏离）</span>：实际发生但契约没写（私调/越界）</div>
        </div>

        <div class="ab-box">
          <div><b>双颗粒度 Trace 叠层（<code>annotate.js</code>）：</b></div>
          <div style="margin-top:1px;"><b>粗粒度决策段</b>：触发/备选/选择/理由（挂 <code>turn+steps</code>）</div>
          <div><b>细粒度会话层</b>：展开到底层每一步推理与工具调用证据</div>
        </div>
      </div>
    </div>
  </div>
</div>
</body></html>"""
