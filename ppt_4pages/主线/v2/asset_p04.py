# -*- coding: utf-8 -*-
"""Page 04 full-width visual panel (1168 x 400 @ 3x = 3504 x 1200 px) with zoomed-in focal crops."""
import base64
import io
from pathlib import Path
from PIL import Image, ImageDraw
from asset_p01 import COMMON_CSS

DIR_V4_SHOTS = Path(
    r"E:\program\GIT\Jobs\08_简历设计工作区\02_项目打磨与展示\智能体技术\多智能体协作\研究任务书_20261014\成果\方向1\协作图演示_v4\截图"
)
DIR_DIR1 = Path(
    r"E:\program\GIT\Jobs\08_简历设计工作区\02_项目打磨与展示\智能体技术\多智能体协作\研究任务书_20261014\成果\方向1"
)
DIR_MOBILE = Path(
    r"E:\program\GIT\Agent\multi\Agent-Architecture-Hub\channels\probe\results\screenshots-m-v2"
)


def _pil_to_b64(im: Image.Image) -> str:
    buf = io.BytesIO()
    im.save(buf, format="PNG", optimize=True)
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode("ascii")


def _crop_card1_blackboard() -> str:
    """Focal crop of Light-theme Shared Blackboard Gravity Field + 4-quadrant delivery ring."""
    im = Image.open(DIR_V4_SHOTS / "02_light_whowhen24_collapsed.png").convert("RGB")
    # Central stage focal area (width=880, height=642) — includes top green channel box & full 终端执行器 label at y=670..722
    stage = im.crop((535, 86, 1415, 728)).copy()
    # Overlay active case tab 'Who&When · 第 24 号 (群聊黑板)' in top-left blank area
    case_tab = im.crop((694, 6, 908, 45))
    stage.paste(case_tab, (10, 8))
    # Overlay full '送达四分外环 · 共享黑板' card (y=700..850 in 1920x1080) into bottom-left blank area
    ring_card = im.crop((10, 700, 332, 850))
    ring_card = ring_card.resize((290, 135), Image.Resampling.LANCZOS)
    stage.paste(ring_card, (10, stage.height - ring_card.height - 8))
    return _pil_to_b64(stage)


def _crop_card2_console_left() -> str:
    """Focal crop of Light-theme Console (1280x800): Agent Roster + Shared Model/Tool Channel Control Matrix."""
    im = Image.open(DIR_DIR1 / "hub_02_light_1280_panel_dedup.png").convert("RGB")
    # In 1280x800, Panel ② starts at y=188 and ends cleanly at y=584 right before Panel ④
    crop = im.crop((748, 188, 1226, 584))
    return _pil_to_b64(crop)


def _crop_card2_reverse_right() -> str:
    """Focal crop of Reverse Control & Markdown Diff Writeback Drawer (1920x1080)."""
    im = Image.open(DIR_V4_SHOTS / "04_dark_reverse_control_diff.png").convert("RGB")
    # Includes tab bar '⚡ 反向调控' at y=360 down to full Markdown Diff preview at y=836
    crop = im.crop((1546, 360, 1914, 836))
    return _pil_to_b64(crop)


def _crop_mobile_1_feed() -> str:
    """Focal crop of Light-theme /m/ Feed view (375x812 -> top 375x560)."""
    im = Image.open(DIR_MOBILE / "20_feed_view_default.png").convert("RGB")
    return _pil_to_b64(im.crop((0, 0, im.width, 560)))


def _crop_mobile_2_steer() -> str:
    """Focal composite of Light-theme /m/ live tool step + steer interjection composer (375x560)."""
    im_steps = Image.open(DIR_MOBILE / "14_expanded_tool_steps_top.png").convert("RGB")
    im_comp = Image.open(DIR_MOBILE / "10_composer_with_text.png").convert("RGB")
    w = im_steps.width
    out = Image.new("RGB", (w, 560), (255, 255, 255))
    # Top session status bar (height=96)
    out.paste(im_steps.crop((0, 0, w, 96)), (0, 0))
    # Clean start of '思考' card (y=260..364 -> height=104)
    out.paste(im_steps.crop((0, 260, w, 364)), (0, 96))
    # Clean start of '⌘ run_command' card (y=480..710 -> height=230, stops above floating 反馈 button)
    out.paste(im_steps.crop((0, 480, w, 710)), (0, 200))
    # Live steer composer at bottom (【probe-steer-test】请确认收到此插话 [发送], height=130)
    out.paste(im_comp.crop((0, im_comp.height - 130, w, im_comp.height)), (0, 430))
    return _pil_to_b64(out)


def _crop_mobile_3_projects() -> str:
    """Focal crop of Light-theme /m/ Cross-host Projects view (375x812 -> top 375x560)."""
    im = Image.open(DIR_MOBILE / "24_projects_view.png").convert("RGB")
    return _pil_to_b64(im.crop((0, 0, im.width, 560)))


def html_p04() -> str:
    img_bb = _crop_card1_blackboard()
    img_rc_left = _crop_card2_console_left()
    img_rc_right = _crop_card2_reverse_right()
    img_m1 = _crop_mobile_1_feed()
    img_m2 = _crop_mobile_2_steer()
    img_m3 = _crop_mobile_3_projects()

    return f"""<!DOCTYPE html><html><head><meta charset="utf-8"><style>
{COMMON_CSS}
.wrap {{ width: 1168px; height: 400px; display: flex; flex-direction: column; gap: 7px; }}
.wb-row {{
  display: grid; grid-template-columns: 382px 382px 384px; gap: 10px; height: 258px;
}}
.wb-card {{
  background: #FFFFFF; border: 1.5px solid #073E87; border-radius: 6px;
  padding: 5px 8px; display: flex; flex-direction: column; justify-content: space-between;
}}
.wb-hdr {{ display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px; }}
.wb-title {{ font-size: 11.5px; font-weight: 800; color: #073E87; }}
.shot-box {{
  height: 204px; flex: none; background: #F8FAFC; border-radius: 4px; overflow: hidden;
  border: 1px solid #CBD5E1; display: flex; align-items: center; justify-content: center;
}}
.shot-box img {{ width: 100%; height: 100%; object-fit: fill; }}
.dual-shot {{
  height: 204px; flex: none; display: grid; grid-template-columns: 1.12fr 0.88fr; gap: 4px;
  background: #E2E8F0; border-radius: 4px; padding: 2px; border: 1px solid #CBD5E1;
  overflow: hidden;
}}
.dual-shot img {{
  width: 100%; height: 198px; object-fit: fill; border-radius: 3px;
}}
.mobile-strip {{
  height: 204px; flex: none; display: grid; grid-template-columns: repeat(3, 1fr); gap: 5px;
  background: #F1F5F9; border-radius: 4px; padding: 3px; border: 1px solid #CBD5E1;
  overflow: hidden;
}}
.mobile-strip img {{
  width: 100%; height: 196px; object-fit: fill;
  border-radius: 3px; border: 1px solid #CBD5E1;
}}
.wb-cap {{
  margin-top: 2px; font-size: 9.6px; color: #374151; line-height: 1.25;
  display: flex; justify-content: space-between; align-items: center; white-space: nowrap;
}}
.wb-cap b {{ color: #073E87; }}

.cmp-box {{
  flex: 1; background: #FFFFFF; border: 1.5px solid #9D0A12; border-radius: 6px;
  overflow: hidden; display: flex; flex-direction: column;
}}
.cmp-hdr {{
  background: #9D0A12; color: #FFFFFF; padding: 3.5px 10px;
  display: flex; justify-content: space-between; align-items: center;
  font-size: 11px; font-weight: 700;
}}
.cmp-grid {{
  flex: 1; display: grid; grid-template-columns: repeat(4, 1fr);
}}
.cmp-col {{
  padding: 4.5px 8px; border-right: 1px solid #E5E7EB;
  display: flex; flex-direction: column; justify-content: space-between;
}}
.cmp-col:last-child {{ border-right: none; }}
.c-top {{ display: flex; justify-content: space-between; align-items: center; }}
.c-dim {{ font-size: 11.5px; font-weight: 800; color: #073E87; }}
.c-vs {{
  background: #FEF2F2; border-left: 2.5px solid #9D0A12; padding: 3px 6px;
  font-size: 9.8px; color: #4B5563; line-height: 1.28; border-radius: 2px;
}}
.c-vs b {{ color: #9D0A12; }}
.c-our {{
  background: #F0F7FF; border-left: 2.5px solid #073E87; padding: 3.5px 6px;
  font-size: 10px; color: #1F2937; line-height: 1.28; border-radius: 2px;
}}
.c-our b {{ color: #073E87; }}
</style></head><body>
<div class="wrap">
  <div class="wb-row">
    <div class="wb-card">
      <div class="wb-hdr">
        <span class="wb-title">① 编排与黑板观察台（局部：黑板引力场 + 四分外环）</span>
        <span class="tag tag-blue">14 视图对账</span>
      </div>
      <div class="shot-box"><img src="{img_bb}"></div>
      <div class="wb-cap">
        <span><b>局部聚焦</b>：共享黑板广播流、角色送达四分外环（该知/送到/已读/已写）、失误定位</span>
      </div>
    </div>

    <div class="wb-card">
      <div class="wb-hdr">
        <span class="wb-title">② 宿主调控与写回台（局部：渠道矩阵 + Diff 写回）</span>
        <span class="tag tag-gold">运行态 + 设计态</span>
      </div>
      <div class="dual-shot">
        <img src="{img_rc_left}">
        <img src="{img_rc_right}">
      </div>
      <div class="wb-cap">
        <span><b>局部聚焦</b>：左看个体与共享模型/工具渠道启停，右看插话 <code>inbox.md</code> Diff 预览</span>
      </div>
    </div>

    <div class="wb-card" style="border-color:#9D0A12;">
      <div class="wb-hdr">
        <span class="wb-title" style="color:#9D0A12;">③ 手机端实时督工台（/m/ 移动端核心局部）</span>
        <span class="tag tag-red">全双工热操控</span>
      </div>
      <div class="mobile-strip">
        <img src="{img_m1}">
        <img src="{img_m2}">
        <img src="{img_m3}">
      </div>
      <div class="wb-cap">
        <span><b>局部聚焦</b>：待处理卡片（22 待办）、工具步骤与 <code>steer</code> 插话发送、跨家活跃项目池</span>
      </div>
    </div>
  </div>

  <div class="cmp-box">
    <div class="cmp-hdr">
      <span>相比 35+ 开源智能体项目的 4 个本质维度对位（为什么现有开源方案无法替代本系统）</span>
      <span style="font-size:10px;font-weight:400;opacity:0.92;">覆盖 CLI 桥接器 / 编排运行时 / 代码框架 / 遥测看板四大赛道</span>
    </div>
    <div class="cmp-grid">
      <div class="cmp-col">
        <div class="c-top"><span class="c-dim">1. 调度对象</span><span class="tag tag-blue">调谁</span></div>
        <div class="c-vs"><b>LangGraph / acpx / opencli</b>：或只调裸模型 API 丢弃宿主工具，或仅覆盖单路协议</div>
        <div class="c-our"><b>调「完整宿主智能体」</b>：协议 + CDP + 适配器三路合一，10 大宿主与 160+ 网页全覆盖</div>
      </div>
      <div class="cmp-col">
        <div class="c-top"><span class="c-dim">2. 观测评估</span><span class="tag tag-blue">看什么</span></div>
        <div class="c-vs"><b>Langfuse / Arize / OTel</b>：仅记单层细粒度 API 进出流水账，缺粗粒度决策段，跨不出封闭宿主</div>
        <div class="c-our"><b>双颗粒度 Trace + 9 家直读</b>：粗粒度决策段(触发/备选/选择/理由)叠在细粒度轮/步证据上</div>
      </div>
      <div class="cmp-col">
        <div class="c-top"><span class="c-dim">3. 运行控制</span><span class="tag tag-blue">怎么管</span></div>
        <div class="c-vs"><b>GasTown / Paperclip / OpenRig</b>：绑死 POSIX tmux 或单向盲跑，遇权限弹窗或死锁即断</div>
        <div class="c-our"><b>常驻热进程全双工操控</b>：手机端实时批权限、答提问、轮内插话纠偏、无损恢复与分叉</div>
      </div>
      <div class="cmp-col">
        <div class="c-top"><span class="c-dim">4. 协作演进</span><span class="tag tag-blue">怎么改</span></div>
        <div class="c-vs"><b>MetaGPT / CrewAI / council</b>：代码写死 DAG 改不动，或群聊上下文滚雪球导致目标漂移</div>
        <div class="c-our"><b>MD 渐进契约 + JSONL 黑板</b>：自然语言即时重构角色分工，构造化上下文严防长程漂移</div>
      </div>
    </div>
  </div>
</div>
</body></html>"""
